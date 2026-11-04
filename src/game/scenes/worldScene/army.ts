import { Battalion } from "../../entities/Battalion";
import { Enemy } from "../../entities/Enemy";
import { Messenger } from "../../entities/Messenger";
import { Scout } from "../../entities/Scout";
import { Unit } from "../../entities/Unit";
import { Wagon } from "../../entities/Wagon";
import { layoutGroup } from "../../systems/GroupLayout";
import { scaleGroups } from "../../data/battleMaps";
import { DIFFICULTY, type Contract } from "../../data/contracts";
import { leaderBonus } from "../../sim/legacy";
import { useGameStore, type BattalionData, type GameState } from "../../../store/useGameStore";
import { BALANCE, WORLD, FATIGUE, GOODS, PRISONERS } from "../../../utils/constants";
import { campMoraleBonus, startingMorale } from "../../../utils/economy";
import { roadGraphOf } from "../../sim/roadGraph";
import { centroid, distance, type Point } from "../../../utils/math";
import type { WorldScene } from "../WorldScene";

/**
 * O exército em campo (criado a partir do store), o líder, as carroças, a fadiga e o cortejo.
 * Uma parte da `WorldScene`: os métodos entram no protótipo dela (ver o fim de `WorldScene.ts`).
 */
export const armyMethods = {
  // --- Exército em campo (criado a partir do store) ---

  spawnBattalion(this: WorldScene, data: BattalionData, index: number, at: Point | null): Battalion {
    const store = useGameStore.getState();
    const lieutenant = store.lieutenants.find((l) => l.battalionId === data.id) ?? null;
    // O capitão marcha com a guarda: o primeiro batalhão da companhia (Marco 20)
    const captain = store.captains.find((c) => c.battalionIds[0] === data.id) ?? null;
    const slot = this.campArea.quarterSlot(index);
    const spawn = this.world.camp.spawn;
    const pos = at ?? slot ?? { x: spawn.x - 120, y: spawn.y + 80 * index };
    const b = new Battalion(this, data, pos.x, pos.y, this.commander, lieutenant, captain);
    // Fome, salários atrasados e o humor do acampamento: os batalhões já saem animados ou desanimados
    b.morale = startingMorale(store.hungryDays, store.arrearsWeeks, campMoraleBonus(store.campMood, store.followers)).value;
    if ((data.turncoatUntil ?? 0) > store.day) b.morale = Math.max(30, b.morale - PRISONERS.TURNCOAT_MORALE);
    b.fatigue = this.fatigueById.get(data.id) ?? 0;
    if (!at && slot) this.quarter(b, index, slot);
    this.fieldSignatures.set(b, this.battalionSignature(data, lieutenant?.id ?? null, captain?.id ?? null));
    this.battalions.push(b);
    return b;
  },

  riderBase(this: WorldScene): Point {
    const spawn = this.world.camp.spawn;
    return this.inCamp ? { x: spawn.x + 220, y: spawn.y - 40 } : { x: this.commander.x, y: this.commander.y };
  },

  spawnRiders(this: WorldScene): void {
    const store = useGameStore.getState();
    const base = this.riderBase();
    this.scouts = store.scouts.map((data, i) => new Scout(this, base.x + 60, base.y - 40 + i * 40, data));
    this.messengers = store.messengers.map((data, i) => new Messenger(this, base.x - 30 + i * 20, base.y + 40, data, i));
  },

  battalionSignature(this: WorldScene, data: BattalionData, lieutenantId: string | null, captainId: string | null): string {
    return [data.troopType, data.level, data.skills.join(","), data.equipment.weapon, data.equipment.armor, data.soldiers, lieutenantId, captainId].join("|");
  },

  /**
   * Recria em campo o que mudou no store: batalhões recrutados, reforçados, que subiram de
   * nível, trocaram de tenente, desertaram ou se amotinaram; batedores e mensageiros novos.
   * Só fora de combate. Quem não mudou continua onde está, com a ordem que tinha.
   */
  reconcileArmy(this: WorldScene): void {
    this.armyDirty = false;
    const store = useGameStore.getState();
    this.syncMutiny(store);

    const kept: Battalion[] = [];
    const old = this.battalions;
    for (const b of old) {
      const data = store.battalions.find((d) => d.id === b.id);
      const lieutenantId = store.lieutenants.find((l) => l.battalionId === b.id)?.id ?? null;
      const captainId = store.captains.find((c) => c.battalionIds[0] === b.id)?.id ?? null;
      if (data && this.fieldSignatures.get(b) === this.battalionSignature(data, lieutenantId, captainId) && b.aliveCount === data.soldiers) {
        kept.push(b);
      }
    }
    const rebuilt = old.filter((b) => !kept.includes(b));
    const centers = new Map(rebuilt.filter((b) => b.soldiers.length > 0).map((b) => [b.id, b.center]));
    // Quem descansava no acampamento (ex.: acabou de treinar) volta ao alojamento, não ao Comandante
    const wasQuartered = new Set(rebuilt.filter((b) => this.quartered.has(b.id)).map((b) => b.id));
    for (const [id, at] of centers) this.leftFrom.set(id, at);
    for (const b of rebuilt) {
      this.campLife.release(b);
      b.destroy();
      this.quartered.delete(b.id);
    }
    this.battalions = kept;
    store.battalions.forEach((data, i) => {
      if (kept.some((b) => b.id === data.id)) return;
      // Recriado onde estava (ou no alojamento, se o Comandante está no acampamento)
      // A escolta de um comboio que chegou aparece onde ele parou
      const was = centers.get(data.id) ?? this.convoyArrivals.get(data.id);
      this.convoyArrivals.delete(data.id);
      const at = was && !this.inCamp && !wasQuartered.has(data.id) ? was : null;
      const b = this.spawnBattalion(data, i, at);
      if (at) b.orderFollow(this.commander);
    });
    const order = (id: string) => store.battalions.findIndex((d) => d.id === id);
    this.battalions.sort((a, b) => order(a.id) - order(b.id));
    this.followKey = "";

    // Batedores continuam onde estão (podem estar longe, em missão): só entra quem é novo e sai quem não existe mais
    for (const s of this.scouts) {
      const data = store.scouts.find((d) => d.id === s.rider.id);
      if (data) s.rider = data;
      else if (s.isAlive) s.destroy();
    }
    this.scouts = this.scouts.filter((s) => store.scouts.some((d) => d.id === s.rider.id));
    const riderBase = this.riderBase();
    store.scouts.forEach((data, i) => {
      if (!this.scouts.some((s) => s.rider.id === data.id)) this.scouts.push(new Scout(this, riderBase.x + 60, riderBase.y - 40 + i * 40, data));
    });
    this.syncHarpies();

    // Mensageiros: recriados se a lista ou o nível mudou (e ninguém está em missão)
    const riderKey = store.messengers.map((r) => `${r.id}:${r.level}`).join("|");
    const fieldKey = this.messengers.filter((m) => m.isAlive).map((m) => `${m.rider.id}:${m.rider.level}`).join("|");
    if (riderKey !== fieldKey && this.messengers.every((m) => !m.isAlive || m.available)) {
      for (const r of this.messengers) r.destroy();
      this.messengers = store.messengers.map((data, i) => new Messenger(this, riderBase.x - 30 + i * 20, riderBase.y + 40, data, i));
    } else if (riderKey !== fieldKey) {
      this.armyDirty = true; // tenta de novo quando os mensageiros voltarem
    }

    this.campArea.buildQuarters(store, this.awayBattalions());
  },

  awayBattalions(this: WorldScene): Set<string> {
    return new Set(this.battalions.filter((b) => !this.quartered.has(b.id)).map((b) => b.id));
  },

  /** Motim: o batalhão rebelado vira inimigo ali mesmo, onde está. */
  syncMutiny(this: WorldScene, store: GameState): void {
    if (!store.mutiny || this.mutineers.length > 0) return;
    const rebel = this.battalions.find((b) => b.id === store.mutiny?.rebel.id);
    const at = rebel && rebel.soldiers.length > 0 ? rebel.center : (this.campArea.quarterSlot(store.battalions.length) ?? this.world.camp.center);
    this.mutineers = this.spawnEnemyGroup({ x: at.x, y: at.y, units: store.mutiny.units }, { kind: "MUTINY" });
    this.pushFeed(`Motim! ${store.mutiny.rebel.name} pegou em armas no acampamento.`);
  },

  /** Contrato aceito: os inimigos aparecem no local marcado; abandonado ou vencido o prazo, eles somem. */
  syncContract(this: WorldScene): void {
    const active = useGameStore.getState().activeContract;
    if ((active?.contract.id ?? null) === this.contractId) return;
    for (const e of this.contractEnemies) {
      if (!e.isAlive) continue;
      // Quem está à vista não some do nada: fica como inimigo sem dono
      if (e.revealed) e.owner = null;
      else {
        e.unitState = "DEAD";
        e.destroy();
      }
    }
    this.enemies = this.enemies.filter((e) => e.isAlive);
    this.contractEnemies = [];
    const was = this.contractId;
    this.contractId = active?.contract.id ?? null;
    // Escolta abandonada ou vencida: a caravana da guilda desiste, e os salteadores largam a tocaia
    if (was && !active) {
      this.trade.dropEscort();
      for (const b of this.warbands.bands) if (b.rest > 1e8) b.rest = 0;
    }
    if (!active) return;

    const { contract } = active;
    if (contract.kind && contract.kind !== "SITE") {
      this.syncTradeContract(contract);
      return;
    }
    const site = this.world.sites.find((x) => x.id === contract.siteId);
    if (!site) return;
    scaleGroups(site.groups, DIFFICULTY[contract.difficulty].enemyMultiplier).forEach((group, i) => {
      const units = this.spawnEnemyGroup(group, { kind: "CONTRACT", contractId: contract.id }, undefined, true);
      this.contractEnemies.push(...units);
      this.attachGroup(`contract:${contract.id}:${i}`, units);
    });
    // O cliente indicou o lugar: ele fica conhecido no mapa (destino da viagem rápida)
    this.fog?.revealExplored(site.center, 700);
    this.pushFeed(`Contrato: "${contract.title}" — o local (${site.name}) está marcado no Mapa do Continente.`);
  },

  /**
   * Contratos da economia (Marco 14): a caravana a escoltar espera no portão (e salteadores
   * esperam no meio da estrada); o bando goblin com a carga roubada e as caravanas do reino a
   * sabotar aparecem no Mapa do Continente.
   */
  syncTradeContract(this: WorldScene, contract: Contract): void {
    const s = useGameStore.getState();
    const day = s.day;
    const name = (id?: string) => s.settlements.find((t) => t.id === id)?.name ?? "?";
    if (contract.kind === "ESCORT" && contract.fromId && contract.targetId) {
      const band = this.trade.spawnEscort(contract.fromId, contract.targetId);
      if (!band) return;
      band.spotted = true;
      band.lastSeen = { x: band.anchor.x, y: band.anchor.y, day };
      this.fog?.revealExplored(band.anchor, 700);
      // Salteadores esperam a caravana no meio do caminho
      const mid = band.route[Math.floor(band.route.length * 0.55)];
      if (mid) {
        const n = 4 + contract.difficulty * 2;
        const ambush = this.warbands.spawnBand({
          name: `Salteadores da estrada de ${name(contract.targetId)}`,
          kind: "GOBLIN",
          units: [
            ["BANDIT", Math.ceil(n * 0.65)],
            ["BANDIT_ARCHER", Math.floor(n * 0.35)],
          ],
          origin: { x: mid.x + 500, y: mid.y + 300 },
          ownerId: null,
        });
        // Esperam escondidos até a caravana passar perto (aí caçam a carga)
        ambush.route = [];
        ambush.goal = { kind: "WANDER" };
        ambush.goalPoint = { ...ambush.anchor };
        ambush.rest = 1e9;
      }
      this.pushFeed(`Contrato: a caravana espera o bando no portão de ${name(contract.fromId)} (marcada no Mapa do Continente).`);
      return;
    }
    if (contract.kind === "ROUTE" && contract.fromId && contract.targetId) {
      // Salteadores no meio da estrada: o id deles fica no contrato (vai no save)
      const road = roadGraphOf(this.world).route(contract.fromId, contract.targetId);
      const mid = road?.points[Math.floor(road.points.length * 0.5)];
      if (!mid) return;
      const n = 6 + contract.difficulty * 2;
      const band = this.warbands.spawnBand({
        name: `Salteadores da estrada de ${name(contract.targetId)}`,
        kind: "GOBLIN",
        units: [
          ["BANDIT", Math.ceil(n * 0.65)],
          ["BANDIT_ARCHER", Math.floor(n * 0.35)],
        ],
        origin: { x: mid.x, y: mid.y },
        ownerId: null,
      });
      band.route = [];
      band.goal = { kind: "WANDER" };
      band.goalPoint = { ...band.anchor };
      band.rest = 1e9;
      band.spotted = true;
      band.lastSeen = { x: band.anchor.x, y: band.anchor.y, day };
      this.fog?.revealExplored(band.anchor, 500);
      useGameStore.setState((st) => (st.activeContract ? { activeContract: { ...st.activeContract, contract: { ...st.activeContract.contract, bandId: band.id } } } : {}));
      this.pushFeed(`Contrato: ${band.name} — marcados no Mapa do Continente.`);
      return;
    }
    if (contract.kind === "RECOVER" && contract.bandId) {
      const band = this.warbands.bands.find((b) => b.id === contract.bandId);
      if (band) {
        band.spotted = true;
        band.lastSeen = { x: band.anchor.x, y: band.anchor.y, day };
        this.pushFeed(`Contrato: o ${band.name} foi visto pela última vez perto de ${this.placeName(band.anchor)} (Mapa do Continente).`);
      } else {
        this.pushFeed("Contrato: ninguém sabe onde o bando com a carga está. Procurem nos ermos.");
      }
      return;
    }
    if (contract.kind === "SABOTAGE" && contract.factionTarget) {
      for (const b of this.warbands.bands) {
        if (b.kind !== "CARAVAN" || b.ownerId !== contract.factionTarget) continue;
        b.spotted = true;
        b.lastSeen = { x: b.anchor.x, y: b.anchor.y, day };
      }
      this.pushFeed(`Contrato: os espiões do cliente marcaram as caravanas inimigas na estrada (Mapa do Continente).`);
      return;
    }
    // Marco 15: quem o bando precisa enfrentar aparece no Mapa do Continente
    if ((contract.kind === "RELIEF" || contract.kind === "CIVIL") && contract.armyId) {
      const army = s.armies.find((a) => a.id === contract.armyId);
      const band = this.warbands.bands.find((b) => b.id === army?.bandId);
      if (band) {
        band.spotted = true;
        band.lastSeen = { x: band.anchor.x, y: band.anchor.y, day };
      }
      this.pushFeed(`Contrato: ${band?.name ?? "o exército inimigo"} está marcado no Mapa do Continente.`);
      return;
    }
    if (contract.kind === "BURN" && contract.crossingId) {
      const c = this.world.geo.crossings.find((x) => x.id === contract.crossingId);
      if (c) this.fog?.revealExplored(c, 700);
      this.pushFeed(`Contrato: a ponte a queimar fica em ${c ? this.placeName(c) : "lugar incerto"} (revelada no Mapa do Continente).`);
      return;
    }
    if (contract.kind === "RANSOM") {
      this.pushFeed(`Contrato: o preso está na masmorra de ${name(contract.targetId)}. Fale com o Camareiro-mor na Cidade Alta, ou vá pelos esgotos.`);
      return;
    }
    if (contract.kind === "DELIVERY") {
      this.pushFeed(`Contrato: levem ${contract.qty} de ${contract.good ? GOODS[contract.good].label.toLowerCase() : "mercadoria"} a ${name(contract.targetId)} — falem com o mercado de lá.`);
    }
  },

  // --- Trem de carroças (Marco 13) ---

  /** Carroças em campo = as do store (compradas, perdidas). Novas saem do acampamento (ou do Comandante). */
  syncWagons(this: WorldScene): void {
    const store = useGameStore.getState();
    for (const w of this.wagons) {
      if (store.wagons.some((d) => d.id === w.wagonId) && w.isAlive) continue;
      if (w.isAlive) w.destroy();
    }
    this.wagons = this.wagons.filter((w) => w.active && w.isAlive && store.wagons.some((d) => d.id === w.wagonId));
    store.wagons.forEach((d, i) => {
      if (this.wagons.some((w) => w.wagonId === d.id)) return;
      const at = this.inCamp && !this.campArea.packed ? this.campArea.wagonPark(i) : this.wagonSlot(i);
      this.wagons.push(new Wagon(this, at.x, at.y, d.id, d.hp));
    });
  },

  /** Lugar da carroça `i` na coluna: atrás do exército (ou estacionada no acampamento). */
  wagonSlot(this: WorldScene, i: number): Point {
    if (this.inCamp && !this.campArea.packed) return this.campArea.wagonPark(i);
    // Rações refeitas (Fase 3): sem ordem de ir, as carroças esperam no acampamento
    if (useGameStore.getState().train !== "ARMY" && !this.campArea.packed) return this.campArea.wagonPark(i);
    const c = this.commander;
    // Comandante dentro de um povoado que barra o exército: as carroças esperam com a tropa no portão
    const hold = this.visit?.hold;
    const following = this.battalions.filter((b) => !b.isDestroyed && b.isFollowing).length;
    // Tropa parada em outro lugar (o Comandante saiu sozinho): as carroças ficam com ela
    const troops = this.battalions.filter((b) => !b.isDestroyed && !this.quartered.has(b.id));
    // Ninguém marchou (a tropa toda ficou nos alojamentos): as carroças também ficam
    if (troops.length === 0 && this.battalions.length > 0 && !this.campArea.packed) return this.campArea.wagonPark(i);
    const stay =!hold && following === 0 && troops.length > 0 ? centroid(troops.map((b) => b.center)) : null;
    const base = hold ? hold.point : (stay ?? { x: c.x, y: c.y });
    const facing = hold ? hold.facing : c.facing;
    const back = BALANCE.FOLLOW_DISTANCE + Math.ceil(following / 2) * 110 + 90 + Math.floor(i / 2) * 70;
    const lateral = (i % 2 === 0 ? -1 : 1) * 36;
    return {
      x: base.x - Math.cos(facing) * back - Math.sin(facing) * lateral,
      y: base.y - Math.sin(facing) * back + Math.cos(facing) * lateral,
    };
  },

  updateWagons(this: WorldScene, dt: number): void {
    const train = useGameStore.getState().train;
    const parked = (this.inCamp || train !== "ARMY") && !this.campArea.packed;
    this.wagons.forEach((w, i) => {
      if (!w.isAlive) return;
      // Na estrada, o comboio é desenhado à parte (ver updateConvoy)
      w.setVisible(train !== "ROAD");
      const slot = this.wagonSlot(i);
      // Ficaram muito para trás (viagem, cais da balsa): alcançam a coluna
      if (parked || distance(w, slot) > 2600) {
        if (distance(w, slot) > 40) {
          w.x = slot.x;
          w.y = slot.y;
        }
        w.unitState = "IDLE";
        return;
      }
      w.follow(slot, dt);
    });
  },

  /** Carroça destruída: a carga dela se perde (e vira notícia). */
  collectWagonLosses(this: WorldScene): void {
    const dead = this.wagons.filter((w) => !w.isAlive);
    if (dead.length === 0) return;
    this.wagons = this.wagons.filter((w) => w.isAlive);
    const store = useGameStore.getState();
    for (const w of dead) {
      const by = w.lastHitFrom instanceof Enemy ? (w.lastHitFrom.side === "WILD" ? "Os saqueadores" : "O inimigo") : "O inimigo";
      store.loseWagon(w.wagonId, by);
      this.engagement?.notes.push(`${by} destruiu uma carroça: a comida que ela levava se perdeu.`);
      this.pushFeed(`Uma carroça foi destruída! As rações que ela levava se perderam.`);
    }
  },

  /** Vida das carroças no store (antes de salvar, ao fim de um combate). */
  storeWagonHp(this: WorldScene): void {
    const hp: Record<string, number> = {};
    for (const w of this.wagons) if (w.isAlive) hp[w.wagonId] = w.hp;
    useGameStore.getState().setWagonHp(hp);
  },

  // --- Fadiga (Marco 13) ---

  /**
   * Fadiga de cada batalhão: marchar cansa (à noite, em terreno ruim, na neve e na marcha
   * forçada, mais); lutar cansa; parado, recupera (nos alojamentos, depressa).
   */
  updateFatigue(this: WorldScene, dt: number): void {
    const F = FATIGUE;
    const night = 1 + Unit.darkness * (F.NIGHT - 1);
    for (const b of this.battalions) {
      if (b.isDestroyed) continue;
      const c = b.center;
      const prev = this.fatiguePos.get(b.id) ?? c;
      this.fatiguePos.set(b.id, c);
      const moved = Math.min(distance(prev, c), 80);
      let f = b.fatigue;
      if (this.quartered.has(b.id)) f -= F.CAMP_PER_SEC * dt;
      else if (b.soldiers.some((s) => s.target)) f += F.COMBAT_PER_SEC * dt;
      else if (moved > 0.4) {
        const t = Unit.terrain?.typeAt(c.x, c.y) ?? "GRASS";
        const rough = t === "MUD" || t === "SWAMP" || t === "FOREST" || t === "SHALLOW" || t === "ICE" || this.groundAt(c.x, c.y, t) < 0.85;
        f += (moved / WORLD.DAY_DISTANCE) * F.MARCH_PER_DAY * night * (rough ? F.ROUGH : 1) * (this.forced ? F.FORCED : 1);
        if (b.running) f += F.RUN_PER_SEC * dt;
      } else if (!this.engagement) f -= (F.REST_PER_DAY * dt) / WORLD.DAY_SECONDS;
      b.fatigue = Math.max(0, Math.min(100, f));
      this.fatigueById.set(b.id, b.fatigue);
    }
  },

  /** Dias de marcha cansam todos os batalhões que marcharam (viagem rápida). */
  tireBy(this: WorldScene, days: number): void {
    const add = days * FATIGUE.MARCH_PER_DAY * (this.forced ? FATIGUE.FORCED : 1);
    for (const b of this.battalions) {
      if (b.isDestroyed || this.quartered.has(b.id)) continue;
      b.fatigue = Math.min(100, b.fatigue + add);
      this.fatigueById.set(b.id, b.fatigue);
    }
  },

  restBy(this: WorldScene, amount: number): void {
    for (const b of this.battalions) {
      b.fatigue = Math.max(0, b.fatigue - amount);
      this.fatigueById.set(b.id, b.fatigue);
    }
  },

  /** O corpo do Comandante acompanha quem está no cargo: traços e cicatrizes. */
  applyLeader(this: WorldScene): void {
    const bonus = leaderBonus(useGameStore.getState().leader);
    this.commander.embody(bonus.hp, bonus.damage);
  },

  // --- Cortejo ---

  /**
   * Organiza o cortejo atrás do Comandante com os batalhões que estão seguindo,
   * conforme o arranjo de grupo escolhido (ex.: arqueiros na fileira de trás).
   * Só recalcula quando muda quem segue, a formação de alguém ou o arranjo,
   * para não ficar trocando de lugar.
   */
  assignFollowSlots(this: WorldScene): void {
    const followers = this.battalions.filter((b) => b.isFollowing);
    const arrangement = useGameStore.getState().groupArrangement;
    const key = arrangement + "#" + followers.map((b) => `${b.id}:${b.formation}:${b.soldiers.length}`).join("|");
    if (key === this.followKey) return;
    this.followKey = key;

    for (const slot of layoutGroup(followers, arrangement, this.commander.facing, this.commander)) {
      slot.battalion.followSlot = { lateral: slot.lateral, back: slot.back + BALANCE.FOLLOW_DISTANCE };
    }
  },
};

export type ArmyMethods = typeof armyMethods;
