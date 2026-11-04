import Phaser from "phaser";
import { Unit } from "../../entities/Unit";
import { seasonOf } from "../../../utils/season";
import { bandSize, type WarbandEvent } from "../../systems/Warbands";
import { TOWN_SIZE, insideTown, nearestGate } from "../../world/townLayout";
import { nobleName } from "../../sim/nobility";
import type { WildlifeContext } from "../../world/Wildlife";
import type { TradeNews } from "../../world/TradeRoutes";
import { geoOf } from "../../worldgen/geoMap";
import { TheRealm, ofRealm } from "../../worldgen/names";
import type { EnemyGroupDef } from "../../data/battleMaps";
import { ferryDocks, regionName } from "../../data/world";
import { isRaiderKind } from "../../sim/realm";
import { activeLairs, siteFill } from "../../sim/siteLife";
import { useGameStore } from "../../../store/useGameStore";
import { SUPPORT, GEO, PROGRESSION, REALM, KINGDOM, WOLF, WORLD, CAMP_MOVE, FATIGUE, SEASONS, TRADE } from "../../../utils/constants";
import { cargoCapacity } from "../../../utils/economy";
import { freightWeight } from "../../sim/trade";
import { distance, pointAlong, routeLength, type Point } from "../../../utils/math";
import { TRAVEL_STEP_DAYS, CLOCK_FLUSH_MS } from "./shared";
import type { WorldScene } from "../WorldScene";

/**
 * O mundo em volta: bichos, calamidades, exércitos dos reinos, revoltas, o relógio, os eventos dos bandos, a viagem e as pontes.
 * Uma parte da `WorldScene`: os métodos entram no protótipo dela (ver o fim de `WorldScene.ts`).
 */
export const realmMethods = {
  /** Lobos: quem anda sozinho no mato é presa; as peles dos abatidos valem ouro. */
  wildlifeContext(this: WorldScene): WildlifeContext {
    const s = useGameStore.getState();
    const allies = this.allAllies();
    const lone = allies.filter((a) => !this.inCamp && allies.filter((b) => b !== a && distance(a, b) < WOLF.ESCORT_RADIUS).length < 2);
    const geo = geoOf(this.world.geo);
    return {
      allies,
      lone,
      canSee: (p) => this.fog.canSee(p),
      reachable: (from, to) => this.nav.findPath(from, to, 6000) !== null,
      night: Unit.darkness > 0.6,
      wild: (p) => {
        const biome = geo.biomeAt(p.x, p.y);
        if (biome !== "FOREST" && biome !== "DEEP_FOREST" && biome !== "TUNDRA" && biome !== "HILLS") return false;
        if (!geo.isOpenLand(p, 40) || Unit.terrain?.isBlocked(p.x, p.y)) return false;
        return distance(p, this.world.camp.center) > 3000 && s.settlements.every((t) => distance(t, p) > 2800);
      },
      onPelts: (n) => {
        useGameStore.setState((st) => ({ gold: st.gold + n * WOLF.PELT_GOLD }));
        this.pushFeed(`Peles de lobo: +${n * WOLF.PELT_GOLD} de ouro.`);
      },
    };
  },

  /** Calamidade nova: o covil aparece no mapa com o líder e a guarda dele. */
  syncCalamities(this: WorldScene): void {
    for (const c of useGameStore.getState().calamities) {
      if (c.defeated || this.calamityObjects.has(c.id)) continue;
      const objects = this.settlementLayer.addLair(c, (x, y) => Unit.terrain?.typeAt(x, y) ?? "GRASS");
      const guard: EnemyGroupDef["units"] = [[c.kind === "NECROMANCER" ? "SKELETON" : "ORC", 6 + c.power]];
      const guards = this.spawnEnemyGroup({ x: c.lair.x + 120, y: c.lair.y + 60, units: guard }, { kind: "CALAMITY", id: c.id });
      const [boss] = this.spawnEnemyGroup(
        { x: c.lair.x, y: c.lair.y, units: [[c.kind === "NECROMANCER" ? "NECROMANCER" : "ORC_WARLORD", 1]] },
        { kind: "CALAMITY", id: c.id },
      );
      this.calamityObjects.set(c.id, { objects, boss });
      this.attachGroup(`calamity:${c.id}`, [...guards, boss], { name: c.leader, traits: ["CRUEL"], martial: 5 + c.power }).standFast = true;
      this.applyLair(c.lair);
    }
  },

  /** Covil novo ou vencido: os sólidos dos ermos, o chão do covil e as rotas em volta. */
  applyLair(this: WorldScene, at: Point): void {
    const terrain = Unit.terrain;
    if (!terrain) return;
    terrain.setWildSolids(this.settlementLayer.wildSolids);
    const calamities = useGameStore.getState().calamities;
    terrain.lairGrounds = calamities.filter((c) => this.calamityObjects.has(c.id)).map((c) => ({ id: c.id, kind: c.kind, at: c.lair }));
    this.terrainStreamer.invalidate(at, 700);
    this.nav.invalidate(at, 500);
    this.armyNav.invalidate(at, 500);
    for (const u of [...(this.commander ? this.allAllies() : []), ...this.enemies]) {
      if (!u.isAlive || distance(u, at) > 500 || !terrain.isBlocked(u.x, u.y)) continue;
      const safe = this.nav.nearestOpen(u, 300);
      if (safe) {
        u.x = safe.x;
        u.y = safe.y;
      }
    }
  },

  /** Virando o dia: hordas das calamidades e exércitos dos reinos em guerra marcham. */
  spawnArmies(this: WorldScene, day: number): void {
    const store = useGameStore.getState();
    const playerSeats = store.settlements.filter((t) => t.owner === "PLAYER");
    const season = seasonOf(day);
    for (const c of store.calamities) {
      // Os orcs se arrastam na neve; os mortos-vivos não sentem frio
      const every = REALM.HORDE_EVERY_DAYS * (season === "WINTER" && c.kind === "ORC_HORDE" ? SEASONS.WINTER_HORDE_EVERY : 1);
      if (c.defeated || day - c.lastHordeDay < every) continue;
      store.markHorde(c.id, day);
      // A horda sai do covil ou de uma cidade que já caiu nas mãos dela
      const held = store.settlements.filter((t) => t.owner === c.id);
      const origin = held.length > 0 && Math.random() < 0.5 ? held[Math.floor(Math.random() * held.length)] : c.lair;
      const size = REALM.HORDE_BASE_SIZE + c.power * 2;
      this.warbands.spawnBand({
        name: c.kind === "NECROMANCER" ? `Mortos de ${c.leader}` : `Horda de ${c.leader}`,
        kind: "HORDE",
        units: [[c.kind === "NECROMANCER" ? "SKELETON" : "ORC", size]],
        origin: { x: origin.x, y: origin.y },
        ownerId: c.id,
        calamityKind: c.kind,
      });
      store.chronicle(`${c.kind === "NECROMANCER" ? "Uma nova leva de mortos" : "Uma nova horda"} (${size}) saiu de ${c.region}.`, "bad");
    }
    // Inverno: quartéis de inverno (nenhum exército sai); verão: temporada de campanha
    const armyEvery = REALM.ARMY_EVERY_DAYS * (season === "SUMMER" ? SEASONS.SUMMER_ARMY_EVERY : 1);
    for (const f of store.factions) {
      if (season === "WINTER" || !f.atWar || day - f.lastArmyDay < armyEvery) continue;
      const own = store.settlements.filter((t) => t.owner === f.id);
      if (own.length === 0) continue;
      store.markArmy(f.id, day);
      const target = playerSeats[0] ?? this.world.camp.center;
      const origin = [...own].sort((a, b) => distance(a, target) - distance(b, target))[0];
      const size = REALM.ARMY_BASE_SIZE + own.length * 2;
      const archers = Math.round(size / 3);
      const def = this.world.factions.find((x) => x.id === f.id);
      // Um lorde do reino lidera, se houver quem (Marco 15)
      const lord = store.nobles.find((n) => n.alive && n.factionId === f.id && n.rank === "LORD" && !n.armyId && !n.captiveOf);
      this.warbands.spawnBand({
        name: lord ? `Exército de ${nobleName(lord, def?.name ?? "reino")}` : `Exército ${ofRealm(def?.name ?? "reino")}`,
        kind: "FACTION",
        units: [
          ["SOLDIER", size - archers],
          ["CROSSBOW", archers],
        ],
        origin: { x: origin.x, y: origin.y + 300 },
        ownerId: f.id,
        color: def?.color,
        chief: lord ? { name: lord.name, traits: lord.traits, martial: lord.martial } : undefined,
        doctrine: store.warLessons[f.id],
      });
      store.chronicle(`${TheRealm(def?.name ?? "reino")} pôs um exército (${size}) em marcha contra os ${this.world.bandName}.`, "bad");
    }
    this.syncArmies();
    this.syncRevolts();
  },

  /**
   * Exércitos dos lordes (Marco 15): a simulação decide; aqui eles viram bandos de verdade,
   * marcham, cercam, e os que acabaram (tomaram a cidade, desistiram) deixam o mapa.
   */
  syncArmies(this: WorldScene): void {
    const store = useGameStore.getState();
    for (const a of store.armies) {
      const band = a.bandId ? this.warbands.bands.find((b) => b.id === a.bandId) : undefined;
      if (a.outcome) {
        if (band && a.outcome !== "TOOK") {
          if (!band.homeward) this.warbands.sendHome(band);
          continue;
        }
        if (band) this.warbands.disband(band);
        useGameStore.getState().armyDone(a.id, a.size);
        continue;
      }
      if (band) continue;
      // Sumiu do mapa, ou o inverno chegou antes de sair: a convocação acaba
      if (a.bandId || this.season === "WINTER") {
        useGameStore.getState().armyDone(a.id);
        continue;
      }
      const from = store.settlements.find((t) => t.id === a.fromId);
      const target = store.settlements.find((t) => t.id === a.targetId);
      const def = this.world.factions.find((f) => f.id === a.factionId);
      if (!from || !target || !def) {
        useGameStore.getState().armyDone(a.id);
        continue;
      }
      const layout = this.settlementLayer.layoutOf(from.id);
      const origin = layout ? nearestGate(layout, target).outside : { x: from.x, y: from.y + 300 };
      const lord = a.lordId ? store.nobles.find((n) => n.id === a.lordId) : undefined;
      const archers = Math.round(a.size / 3);
      const spawned = this.warbands.spawnBand({
        name: lord ? `Exército de ${nobleName(lord, def.name)}` : `Exército ${ofRealm(def.name)}`,
        kind: "FACTION",
        units: [
          ["SOLDIER", a.size - archers],
          ["CROSSBOW", archers],
        ],
        origin,
        ownerId: a.factionId,
        color: def.color,
        goalId: target.id,
        armyId: a.id,
        chief: lord ? { name: lord.name, traits: lord.traits, martial: lord.martial } : undefined,
        doctrine: store.warLessons[a.factionId],
      });
      useGameStore.getState().armySpawned(a.id, spawned.id);
    }
  },

  /** Povoado em revolta: a gente sai de casa com foices e marcha contra os próprios muros. */
  syncRevolts(this: WorldScene): void {
    const store = useGameStore.getState();
    for (const id of store.revolts) {
      if (this.warbands.bands.some((b) => b.kind === "REBELS" && b.goal.kind === "SETTLEMENT" && b.goal.id === id)) continue;
      const t = store.settlements.find((x) => x.id === id);
      const layout = t ? this.settlementLayer.layoutOf(id) : undefined;
      if (!t || !layout) {
        store.revoltHandled(id);
        continue;
      }
      const n = Math.max(6, Math.min(KINGDOM.REVOLT_MAX, Math.round((t.population / 100) * KINGDOM.REVOLT_PER_100)));
      const gate = layout.gates[0];
      this.warbands.spawnBand({ name: `Camponeses revoltados de ${t.name}`, kind: "REBELS", units: [["BANDIT", n]], origin: { x: gate.wait.x, y: gate.wait.y }, ownerId: null, goalId: id });
    }
  },

  /**
   * Relógio do mundo: fora do acampamento e fora de combate, o dia corre com a marcha
   * (DAY_DISTANCE por dia) e devagar com o tempo parado (DAY_SECONDS). Dentro das muralhas de
   * um povoado só o relógio parado corre (andar pelas ruas não é marcha); dentro da paliçada
   * do acampamento o tempo para.
   */
  tickClock(this: WorldScene, time: number, dt: number): void {
    // Batalha personalizada: a hora e o tempo escolhidos valem até o fim
    if (this.run) return;
    const moved = distance(this.commander, this.lastCommanderPos);
    this.lastCommanderPos = { x: this.commander.x, y: this.commander.y };
    if (!this.inCamp && !this.engagement && moved < 200) {
      const inTown = this.settlementLayer.layouts.some((l) => insideTown(l, this.commander));
      // Marcha forçada rende mais caminho por dia; lama, neve e a coluna do acampamento levantado, menos
      const c = this.commander;
      const pace = (this.forced ? FATIGUE.FORCED_DAY : 1) * this.groundAt(c.x, c.y, c.terrainType) * (this.campArea.packed ? CAMP_MOVE.PACKED_SPEED : 1);
      this.clockAccum += (inTown ? 0 : moved / (WORLD.DAY_DISTANCE * pace)) + dt / WORLD.DAY_SECONDS;
    } else if (this.inCamp && !this.engagement && (useGameStore.getState().training.length > 0 || useGameStore.getState().expeditions.length > 0)) {
      // No acampamento o tempo para — menos enquanto alguém treina (assiste-se ao treino) ou está fora, na estrada
      this.clockAccum += dt / PROGRESSION.TRAINING_CAMP_DAY_SECONDS;
    }
    if (time - this.lastClockFlush < CLOCK_FLUSH_MS || this.clockAccum <= 0) return;
    this.lastClockFlush = time;
    this.updateExposure();
    this.passTime(this.clockAccum);
    this.clockAccum = 0;
  },

  /** Passa tempo no store; virando o dia, um bando novo pode surgir num covil. */
  passTime(this: WorldScene, days: number): void {
    const store = useGameStore.getState();
    const before = store.day;
    // Notícias alcançam o Comandante onde ele está (Marco 15)
    if (days > 0 && before !== Math.floor(before + store.dayProgress + days)) useGameStore.setState({ commanderAt: { x: Math.round(this.commander.x), y: Math.round(this.commander.y) } });
    const logBefore = store.log[store.log.length - 1]?.id ?? 0;
    store.advanceTime(days);
    const after = useGameStore.getState().day;
    if (after === before) return;
    // As notícias que chegaram hoje aparecem no HUD (as três mais novas)
    for (const l of useGameStore.getState().log.filter((e) => e.id > logBefore && e.text.startsWith("Chegou")).slice(-3)) this.pushFeed(l.text);
    this.applySeason();
    this.syncHarpies();
    // Inverno: os goblins saem menos dos covis
    this.maybeCorsairs(after);
    // Covis perto de um local limpo ficam quietos até ele se encher de novo (Fase 3, etapa 10)
    const lives = useGameStore.getState().siteLife;
    const lairs = activeLairs(this.world.lairs, this.world.sites, (id) => siteFill(lives[id], after));
    const band = this.warbands.maybeSpawnGoblins(after, lairs, (p) => this.fog.canSee(p), this.season === "WINTER" ? SEASONS.WINTER_GOBLIN_EVERY : 1);
    if (band) useGameStore.getState().chronicle(`Rumores: um bando goblin deixou seu covil nos ermos.`, "bad");
    this.spawnArmies(after);
    this.spawnAgents();
    this.newsTick();
    this.siegeTick();
    useGameStore.getState().captivesDay();
    this.captivityTick();
    // Comércio (Marco 14): o mar fecha com a tempestade; mercadores mandam carga
    this.tradeNews(this.trade.weatherCheck(after));
    this.tradeNews(this.trade.daily(after));
    this.autosave();
  },

  /**
   * Chegadas dos bandos sem o exército por perto: combate abstrato no povoado (resistiu,
   * saqueado, tomado, arruinado) ou saque ao acampamento desguarnecido.
   */
  handleWarbandEvents(this: WorldScene, events: readonly WarbandEvent[]): void {
    const store = useGameStore.getState();
    for (const ev of events) {
      // Caravanas (Marco 14): chegada, saque, destruição; goblins com carga roubada
      const contractBand = ev.type === "DESTROYED" && ev.band.id === store.activeContract?.contract.bandId;
      if (ev.type === "DELIVERED" || ev.type === "CARAVAN_RAIDED" || (ev.type === "DESTROYED" && (ev.band.kind === "CARAVAN" || ev.band.loot || contractBand))) {
        const near = (p: Point) => this.presence().some((a) => distance(a, p) < 2600);
        this.tradeNews(this.trade.onEvent(ev, near));
        if (ev.type !== "DESTROYED" || ev.band.kind === "CARAVAN") continue;
      }
      // Exércitos dos lordes (Marco 15)
      if (ev.type === "ARMY_AT") {
        if (ev.band.armyId) store.armyArrived(ev.band.armyId);
        if (ev.band.spotted || distance(this.commander, ev.band.anchor) < 5000) this.pushFeed(`${ev.band.name} acampou diante de ${this.placeName(ev.band.anchor)}: é um cerco.`);
        continue;
      }
      if (ev.type === "ARMY_HOME") {
        if (ev.band.armyId) store.armyDone(ev.band.armyId, bandSize(ev.band));
        continue;
      }
      if (ev.type === "ARMY_CLASH") {
        const near = ev.winner.spotted || ev.loser.spotted || distance(this.commander, ev.at) < 5000;
        if (near) this.pushFeed(`${ev.winner.name} destroçou o ${ev.loser.name} perto de ${this.placeName(ev.at)}.`);
        store.armiesClash(ev.winner.armyId ?? null, ev.loser.armyId ?? null, ev.at);
        store.markBattlefield(ev.at.x, ev.at.y, ev.losses + 8);
        continue;
      }
      if (ev.type === "SKIRMISH") {
        const near = ev.winner.spotted || ev.loser.spotted || distance(this.commander, ev.at) < 5000;
        if (near) {
          const text = `${ev.winner.name} venceu o ${ev.loser.name} perto de ${this.placeName(ev.at)}.`;
          this.pushFeed(text);
          store.chronicle(text, ev.winner.kind === "PATROL" ? "good" : "bad");
        }
        store.markBattlefield(ev.at.x, ev.at.y);
        continue;
      }
      if (ev.type === "SHELTERED") {
        const t = useGameStore.getState().settlements.find((x) => x.id === ev.settlementId);
        if (ev.band.spotted && t) this.pushFeed(`Os ${ev.band.name.toLowerCase()} chegaram a ${t.name}.`);
        continue;
      }
      if (ev.type === "MASSACRE") {
        const text = `O ${ev.by.name} alcançou os ${ev.band.name.toLowerCase()} na estrada. Ninguém sobreviveu.`;
        store.chronicle(text, "bad");
        if (distance(this.commander, ev.band.anchor) < 6000) this.pushFeed(text);
        store.markBattlefield(ev.band.anchor.x, ev.band.anchor.y);
        continue;
      }
      if (ev.type === "QUARTERED") {
        // O exército vira guarnição do povoado onde passa o inverno
        const t = useGameStore.getState().settlements.find((x) => x.id === ev.settlementId);
        const n = bandSize(ev.band);
        if (t) {
          useGameStore.setState((st) => ({
            settlements: st.settlements.map((x) => (x.id === t.id ? { ...x, garrison: Math.min(REALM.SIEGE_MAX_DEFENDERS, x.garrison + n) } : x)),
          }));
          store.chronicle(`O ${ev.band.name} recolheu-se aos quartéis de inverno em ${t.name}.`);
          if (ev.band.spotted) this.pushFeed(`O ${ev.band.name} foi passar o inverno em ${t.name}.`);
        }
        continue;
      }
      const band = ev.band;
      if (ev.type === "DESTROYED") {
        // Mensageiro real abatido pelo bando: os despachos são lidos
        if (band.kind === "COURIER") {
          // Quem pedia socorro não chegou: o exército não vem
          if (band.reliefFor && store.siege?.settlementId === band.reliefFor) {
            useGameStore.setState((st) => (st.siege ? { siege: { ...st.siege, reliefDay: undefined } } : {}));
            this.pushFeed("O mensageiro da cidade foi abatido: o pedido de socorro não chegou.");
          }
          if (band.materialized && band.ownerId) {
            this.pushFeed(`Mensageiro real interceptado! ${store.interceptCourier(band.ownerId)}`);
            this.revealArmiesOf(band.ownerId);
          }
          continue;
        }
        if (band.kind === "REFUGEES") continue;
        // Quem prendia o Comandante caiu: ele está livre
        if (store.captivity?.bandId === band.id) this.pushFeed(store.endCaptivity("RESCUED"));
        // Exército de um lorde caiu: quem esteve perto do bando conta como obra do bando
        if (band.armyId) {
          const near = distance(this.commander, band.anchor) < 2500;
          store.armyDestroyed(band.armyId, near, band.anchor);
          store.markBattlefield(band.anchor.x, band.anchor.y, 14);
          // Quem foi destruído pelo bando aprende: o próximo exército vem preparado
          if (near && band.ownerId) store.learnFrom(band.ownerId, this.armyShares());
          this.pushFeed(`O ${band.name} não existe mais.`);
          continue;
        }
        // Revolta acabou: a gente volta para casa com medo (e menos gente)
        if (band.kind === "REBELS") {
          if (band.goal.kind === "SETTLEMENT") store.revoltHandled(band.goal.id);
          store.chronicle(`A revolta de ${this.placeName(band.anchor)} foi esmagada.`, "info");
          continue;
        }
        if (band.spotted || band.kind !== "GOBLIN") {
          // Patrulha que caiu (diante dos goblins) é má notícia; bando hostil destruído, boa
          store.chronicle(`${band.kind === "PATROL" ? "A" : "O"} ${band.name} foi destruíd${band.kind === "PATROL" ? "a" : "o"}.`, isRaiderKind(band.kind) ? "good" : "bad");
          this.pushFeed(`O ${band.name} não existe mais.`);
        }
        continue;
      }
      // O exército por perto defende: o bando luta em vez de resolver no abstrato
      const guarded = this.commander.isAlive && distance(this.commander, band.anchor) < WORLD.WARBAND.CAMP_GUARD_RADIUS;
      if (guarded || band.members.some((m) => m.target)) continue;
      if (ev.goal.kind === "CAMP") {
        const camp = this.world.camp.center;
        const defenders = this.battalions.some((b) => !b.isDestroyed && distance(b.center, camp) < WORLD.WARBAND.CAMP_GUARD_RADIUS);
        // Acampamento levantado: só um chão vazio para trás
        if (!defenders && !this.campArea.packed) {
          store.raidCamp(band.name);
          this.pushFeed(`${band.name} atacou o acampamento desguarnecido!`);
        }
        this.warbands.retarget(band);
        continue;
      }
      if (ev.goal.kind !== "SETTLEMENT") continue;
      const outcome = store.bandArrives(ev.goal.id, {
        name: band.name,
        kind: band.kind,
        members: bandSize(band),
        ownerId: band.ownerId,
        calamityKind: band.calamityKind,
      });
      const t = useGameStore.getState().settlements.find((x) => x.id === (ev.goal as { id: string }).id);
      // Camponeses: acabou de um jeito ou de outro
      if (band.kind === "REBELS") {
        store.revoltHandled(ev.goal.id);
        if (t) this.pushFeed(outcome === "CAPTURED" ? `${t.name} expulsou o senhor: a aldeia é livre.` : `A revolta de ${t.name} foi contida pela guarnição.`);
        this.warbands.disband(band);
        continue;
      }
      if (outcome === "REPELLED") {
        // Os defensores derrubam metade do bando antes de ele recuar
        this.warbands.loseHalf(band);
        if (t) this.pushFeed(`${t.name} repeliu o ${band.name}.`);
      } else if (outcome === "CAPTURED") {
        if (t) this.pushFeed(`${t.name} caiu nas mãos do ${band.name}.`);
        if (t) this.spawnRefugees(t);
        this.warbands.disband(band); // o bando vira a guarnição do povoado
        continue;
      } else if (outcome === "RUINED" || outcome === "RAIDED") {
        if (t) this.pushFeed(outcome === "RUINED" ? `${t.name} foi tomada pelos mortos!` : `${band.name} saqueou ${t.name}!`);
      }
      // Quem escapou foge pela estrada até o povoado de pé mais perto
      if (t && (outcome === "RAIDED" || outcome === "RUINED")) this.spawnRefugees(t);
      this.warbands.retarget(band);
    }
  },

  /** Notícias do comércio: no HUD (se perto) e na crônica. */
  tradeNews(this: WorldScene, news: readonly TradeNews[]): void {
    for (const n of news) {
      if (!n.quiet) this.pushFeed(n.text);
      useGameStore.getState().chronicle(n.text, n.tone);
    }
  },

  /** Nome do lugar para o HUD e os relatórios: povoado, acampamento, local de contrato ou região. */
  placeName(this: WorldScene, p: Point): string {
    if (this.campArea.contains(p, -200)) return "o acampamento";
    const town = useGameStore.getState().settlements.find((t) => {
      const layout = this.settlementLayer.layoutOf(t.id);
      // Os acampamentos da guarnição e o portão (onde o exército espera) contam como o povoado
      return layout ? insideTown(layout, p, 800) : distance(t, p) < 600;
    });
    if (town) return town.name;
    const site = this.world.sites.find((x) => distance(x.center, p) < 1200);
    if (site) return site.name;
    const river = geoOf(this.world.geo).riverAt(p.x, p.y, 250);
    if (river) return `margens do ${river.river.name}`;
    return regionName(this.world, p);
  },

  /** Onde nasce a aldeia fundada: logo à frente (ao sul) do Comandante, com o portão norte para ele. */
  foundSite(this: WorldScene): Point {
    return { x: Math.round(this.commander.x), y: Math.round(this.commander.y + TOWN_SIZE.VILLAGE.h / 2 + 380) };
  },

  /**
   * Plantas mudaram (aldeia fundada, povoado em ruínas ou reconstruído): colisão, navegação e
   * rotas são refeitas, e quem ficou dentro de uma parede sai para a rua mais próxima.
   */
  applyTowns(this: WorldScene): void {
    const terrain = Unit.terrain;
    if (!terrain) return;
    terrain.setTowns(this.settlementLayer.layouts);
    // (o raio cobre os acampamentos da guarnição, do lado de fora dos muros)
    for (const l of this.settlementLayer.layouts) {
      // O chão do povoado é pintado com o chão: ruínas e reconstrução repintam os pedaços
      this.terrainStreamer.invalidate({ x: l.cx, y: l.cy }, Math.max(l.bounds.w, l.bounds.h) / 2 + 1000);
      this.nav.invalidate({ x: l.cx, y: l.cy }, Math.max(l.bounds.w, l.bounds.h) / 2 + 700);
      this.armyNav.invalidate({ x: l.cx, y: l.cy }, Math.max(l.bounds.w, l.bounds.h) / 2 + 700);
    }
    for (const u of [...this.allAllies(), ...this.enemies]) {
      if (!u.isAlive || !terrain.isBlocked(u.x, u.y)) continue;
      const safe = this.nav.nearestOpen(u, 800);
      if (safe) {
        u.x = safe.x;
        u.y = safe.y;
      }
    }
    this.warbands.repathAll();
  },

  /** Sólidos do acampamento mudaram (alojamentos refeitos): colisão e rotas em volta dele. */
  applyCampSolids(this: WorldScene): void {
    const terrain = Unit.terrain;
    if (!terrain || !this.campArea) return;
    terrain.setExtraSolids(this.campArea.solids());
    const c = this.world.camp.center;
    this.nav?.invalidate(c, 1100);
    this.armyNav?.invalidate(c, 1100);
    for (const u of [...(this.commander ? this.allAllies() : []), ...this.enemies]) {
      if (!u.isAlive || !terrain.isBlocked(u.x, u.y) || distance(u, c) > 1100) continue;
      const safe = this.nav.nearestOpen(u, 300);
      if (safe) {
        u.x = safe.x;
        u.y = safe.y;
      }
    }
  },

  /** Pode fundar uma vila aqui? (null = sim; senão, o motivo) */
  foundBlocked(this: WorldScene): string | null {
    const store = useGameStore.getState();
    if (this.run) return "Só na campanha";
    if (this.inCamp) return "Saia do acampamento";
    if (this.engagement) return "Em combate";
    // A mesma regra do store: distância medida de onde a aldeia nasce (à frente do Comandante)
    const site = this.foundSite();
    const near = [...store.settlements, this.world.camp.center].some((t) => distance(t, site) < REALM.FOUND_MIN_DISTANCE);
    if (near) return "Perto demais de outro povoado";
    const { w, h } = TOWN_SIZE.VILLAGE;
    const geo = geoOf(this.world.geo);
    const terrain = Unit.terrain;
    for (let j = 0; j <= 4; j++) {
      for (let i = 0; i <= 4; i++) {
        const p = { x: site.x - w / 2 - 150 + ((w + 300) * i) / 4, y: site.y - h / 2 - 150 + ((h + 300) * j) / 4 };
        if (!geo.isOpenLand(p, 60) || terrain?.isBlocked(p.x, p.y)) return "Terreno impróprio (água, rio, montanha ou construções)";
      }
    }
    if (store.gold < REALM.FOUND_COST.gold || store.iron < REALM.FOUND_COST.iron) return "Ouro ou ferro insuficiente";
    return null;
  },

  /**
   * Viagem rápida (Mapa do Continente): o exército marcha pela rota por terra até o destino em passos de
   * fração de dia, os bandos marcham junto, e a viagem para se algum deles cruzar o caminho.
   */
  fastTravel(this: WorldScene, dest: Point): void {
    const store = useGameStore.getState();
    const refuse = (why: string) => {
      this.pushFeed(why);
      this.publishHud();
    };
    if (this.engagement) return refuse("Em combate: impossível viajar.");
    if (store.mutiny) return refuse("Motim no acampamento: resolva antes de partir.");
    if (this.visibleEnemies().some((e) => distance(e, this.commander) < WORLD.TRAVEL_BLOCK_RADIUS)) {
      return refuse("Inimigos à vista: impossível viajar.");
    }
    if (this.messengers.some((m) => m.isAlive && !m.available)) return refuse("Aguarde os mensageiros voltarem antes de viajar.");
    if (!this.fog.isExplored(dest)) return refuse("Destino desconhecido: explore a região antes.");
    const start = { x: this.commander.x, y: this.commander.y };
    // O exército marcha pelas rotas das tropas: povoado que o barra = a marcha termina no portão
    const shut = this.closedRule("ARMY", dest, 400);
    const target = this.armyNav.nearestOpen(shut ? this.gateWait(shut.id, start).point : dest, 800);
    if (!target) return refuse("Não há onde parar ali (água ou montanha).");
    const path = this.armyNav.findPath(this.armyNav.nearestOpen(start, 1500) ?? start, target, 250000);
    if (!path) return refuse("Não há caminho por terra até lá (rio sem ponte, mar ou montanha).");

    const route = [start, ...path];
    const days = routeLength(route) / (WORLD.DAY_DISTANCE * this.marchPace(route));
    const { at, elapsed, interceptedBy, facing } = this.simulateMarch(route, days, WORLD.INTERCEPT_RADIUS);

    this.placeArmy(at, facing);
    this.passTime(elapsed);
    this.tireBy(elapsed);
    store.setWorldMapOpen(false);
    const dayText = elapsed < 1 ? "menos de um dia" : `${elapsed.toFixed(1).replace(".", ",")} dias`;
    this.pushFeed(
      interceptedBy
        ? `Interceptados pelo ${interceptedBy} no caminho! (${dayText} de marcha)`
        : `Chegamos a ${this.placeName(at)} após ${dayText} de marcha.`,
    );
    this.updateVision(this.time.now);
    this.publishHud();
  },

  /**
   * Passo da marcha numa rota (multiplica o caminho por dia): o chão da estação ao longo dela,
   * a marcha forçada, a tropa cansada, as carroças na lama e a coluna do acampamento levantado.
   */
  marchPace(this: WorldScene, route: readonly Point[]): number {
    const total = routeLength(route);
    const n = Math.max(1, Math.ceil(total / 800));
    let ground = 0;
    for (let i = 0; i < n; i++) {
      const p = pointAlong(route, (total * (i + 0.5)) / n);
      ground += this.groundAt(p.x, p.y, Unit.terrain?.typeAt(p.x, p.y) ?? "GRASS");
    }
    ground /= n;
    const marching = this.battalions.filter((b) => !b.isDestroyed && !this.quartered.has(b.id));
    const tired = marching.length > 0 ? Math.min(...marching.map((b) => b.fatigueSpeed)) : 1;
    // Carroças atolam mais que gente: o exército espera por elas; carregadas de mercadoria, mais ainda (Marco 14).
    // Sem carroças junto (ficaram no acampamento ou estão na estrada), ninguém espera
    const withArmy = (useGameStore.getState().train === "ARMY" || this.campArea.packed) && this.wagons.length > 0;
    const wagons = (withArmy && ground < 0.9 ? 0.9 : 1) * (withArmy ? this.loadPace() : 1);
    return ground * wagons * tired * (this.forced ? FATIGUE.FORCED_DAY : 1) * (this.campArea.packed ? CAMP_MOVE.PACKED_SPEED : 1);
  },

  /** Carroças pesadas de mercadoria andam mais devagar (até −15% com tudo cheio). */
  loadPace(this: WorldScene): number {
    const s = useGameStore.getState();
    const cap = cargoCapacity(s.wagons.length);
    return cap > 0 ? 1 - TRADE.LOAD_SLOW * Math.min(1, freightWeight(s.freight) / cap) : 1;
  },

  /**
   * Dias que passam de uma vez (viagem rápida ou descanso): o exército percorre a rota em
   * passos de fração de dia, os bandos marcham junto, e tudo para se algum chegar perto.
   */
  simulateMarch(
    this: WorldScene, route: readonly Point[],
    totalDays: number,
    interceptRadius: number,
  ): { at: Point; elapsed: number; interceptedBy: string | null; facing: number } {
    for (const e of this.enemies) e.dormant = true; // ninguém vê o caminho inteiro: tudo anda em bloco
    const total = routeLength(route);
    const steps = Math.max(1, Math.ceil(totalDays / TRAVEL_STEP_DAYS));
    let at = route[0];
    let elapsed = 0;
    let interceptedBy: string | null = null;
    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      at = pointAlong(route, total * t);
      elapsed = totalDays * t;
      this.handleWarbandEvents(this.warbands.advance(totalDays / steps));
      this.tradeNews(this.trade.advance(totalDays / steps));
      this.advanceScouts(totalDays / steps);
      this.fog.revealExplored(at, SUPPORT.VISION.MARCH);
      const band = this.warbands.bands.find((b) => this.bandHostile(b) && distance(b.anchor, at) < interceptRadius);
      if (band) {
        interceptedBy = band.name;
        // Para um pouco antes, de frente para o bando
        at = pointAlong(route, Math.max(0, total * t - 250));
        break;
      }
    }
    // Olhando na direção do último trecho da rota
    const last = route[route.length - 1];
    const prev = route[route.length - 2];
    const facing = prev ? Math.atan2(last.y - prev.y, last.x - prev.x) : this.commander.facing;
    return { at, elapsed, interceptedBy, facing };
  },

  // --- Pontes ---

  buildBridgeSpots(this: WorldScene, burned: readonly string[]): void {
    const riverName = (id: string) => this.world.geo.rivers.find((r) => r.id === id)?.name ?? "rio";
    this.bridgeSpots = this.world.geo.crossings
      .filter((c) => c.kind === "BRIDGE")
      .map((c) => {
        const river = riverName(c.riverId);
        return {
          label: burned.includes(c.id) ? `Ponte queimada sobre o ${river}` : `Ponte sobre o ${river}`,
          door: { x: c.x, y: c.y },
          panel: { kind: "BRIDGE" as const, bridgeId: c.id },
          bounds: new Phaser.Geom.Rectangle(c.x - 120, c.y - 120, 240, 240),
          radius: 230,
        };
      });
    // Balsas: um cais em cada margem
    for (const c of this.world.geo.crossings.filter((x) => x.kind === "FERRY")) {
      for (const dock of ferryDocks(c)) {
        this.bridgeSpots.push({
          label: `Balsa do ${riverName(c.riverId)}`,
          door: dock,
          panel: { kind: "FERRY" as const, ferryId: c.id },
          bounds: new Phaser.Geom.Rectangle(dock.x - 70, dock.y - 70, 140, 140),
          radius: 170,
        });
      }
    }
  },

  /** Balsa: o exército inteiro passa ao cais da outra margem (ouro e um pedaço do dia). */
  crossFerry(this: WorldScene, id: string): void {
    const store = useGameStore.getState();
    const c = this.world.geo.crossings.find((x) => x.id === id && x.kind === "FERRY");
    if (!c) return;
    if (this.engagement) return this.pushFeed("Em combate: o barqueiro não sai.");
    if (this.visibleEnemies().some((e) => distance(e, this.commander) < WORLD.TRAVEL_BLOCK_RADIUS)) return this.pushFeed("Inimigos à vista: o barqueiro não sai.");
    if (this.messengers.some((m) => m.isAlive && !m.available)) return this.pushFeed("Aguarde os mensageiros voltarem antes de atravessar.");
    const [a, b] = ferryDocks(c);
    const from = distance(this.commander, a) <= distance(this.commander, b) ? a : b;
    const to = from === a ? b : a;
    const river = this.world.geo.rivers.find((r) => r.id === c.riverId)?.name ?? "rio";
    if (!store.payFerry(GEO.FERRY_GOLD, river)) return this.pushFeed("Sem ouro para a balsa.");
    // Desembarca terra adentro, virado para longe do rio (a tropa fica entre o Comandante e o cais)
    const dir = Math.atan2(to.y - from.y, to.x - from.x);
    const land = { x: to.x + Math.cos(dir) * 480, y: to.y + Math.sin(dir) * 480 };
    this.placeArmy(this.armyNav.nearestOpen(land, 400) ?? land, dir);
    this.passTime(GEO.FERRY_DAYS);
    this.pushFeed(`O exército atravessou o ${river} de balsa.`);
    this.updateVision(this.time.now);
  },

  /** Ponte queimada ou reconstruída: terreno, desenho, rotas e o que os bandos planejavam mudam. */
  applyBridges(this: WorldScene, burned: readonly string[], before: readonly string[]): void {
    const terrain = Unit.terrain;
    if (!terrain) return;
    terrain.setBurned(burned);
    const changed = [...burned.filter((id) => !before.includes(id)), ...before.filter((id) => !burned.includes(id))];
    for (const id of changed) {
      const c = this.world.geo.crossings.find((x) => x.id === id);
      if (!c) continue;
      this.terrainStreamer.invalidate(c, 500);
      this.nav.invalidate(c, 400);
      // Quem estava sobre a ponte em chamas cai na margem mais próxima
      for (const u of [...this.allAllies(), ...this.enemies]) {
        if (!u.isAlive || !terrain.isBlocked(u.x, u.y) || distance(u, c) > 400) continue;
        const safe = this.nav.nearestOpen(u, 600);
        if (safe) {
          u.x = safe.x;
          u.y = safe.y;
        }
      }
    }
    this.warbands.repathAll();
    this.buildBridgeSpots(burned);
  },

  /** Pedágio: ao pisar numa ponte de outro, paga (ou passa à força). */
  updateBridgeCrossing(this: WorldScene): void {
    const c = this.commander;
    const id = c.terrainType === "BRIDGE" ? (geoOf(this.world.geo).crossingAt(c.x, c.y)?.id ?? null) : null;
    if (id === this.onBridge) return;
    this.onBridge = id;
    if (!id) return;
    const msg = useGameStore.getState().crossBridge(id);
    if (msg) this.pushFeed(msg);
  },
};

export type RealmMethods = typeof realmMethods;
