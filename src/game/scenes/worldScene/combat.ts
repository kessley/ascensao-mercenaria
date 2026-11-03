import Phaser from "phaser";
import { Commander } from "../../entities/Commander";
import { Enemy } from "../../entities/Enemy";
import { Scout } from "../../entities/Scout";
import { Unit } from "../../entities/Unit";
import type { VisionSource } from "../../systems/FogOfWar";
import { makeStaff, promoteRoster, type StaffData, type WarHost } from "../../systems/WarHost";
import { kingdomsAtWar } from "../../sim/realm";
import { ofRealm } from "../../worldgen/names";
import type { EnemyGroupDef } from "../../data/battleMaps";
import { fullName } from "../../data/lieutenants";
import { localTroop } from "../../data/planet";
import { useGameStore, type BattalionSurvivors, type BattleResult } from "../../../store/useGameStore";
import { BALANCE, COLORS, SUPPORT, REALM, WORLD, WEATHER, PRISONERS, WAR_AI, type EnemyKind, type TroopType } from "../../../utils/constants";
import { sfx } from "../../../audio/sounds";
import { distance, type Point } from "../../../utils/math";
import { inPlace, type Engagement } from "./shared";
import type { WorldScene } from "../WorldScene";

/**
 * O combate no mundo: os inimigos em campo, o encontro, os prisioneiros, os objetivos, o fim do combate, a derrota e a visão.
 * Uma parte da `WorldScene`: os métodos entram no protótipo dela (ver o fim de `WorldScene.ts`).
 */
export const combatMethods = {
  spawnEnemy(this: WorldScene, x: number, y: number, kind: EnemyKind, color?: number): Enemy {
    const at = this.nav?.nearestOpen({ x, y }, 600) ?? { x, y };
    const e = new Enemy(this, at.x, at.y, localTroop(this.world.culture, kind), color);
    e.dormant = true; // acorda quando alguém do bando chegar perto
    e.setVisible(false);
    this.enemies.push(e);
    return e;
  },

  /** Reino → soldados em campo dos reinos em guerra com ele. */
  warFoes(this: WorldScene, active: readonly Enemy[]): Map<string, Enemy[]> {
    const out = new Map<string, Enemy[]>();
    const owners = new Map<string, Enemy[]>();
    for (const e of active) {
      if (!e.factionId) continue;
      const list = owners.get(e.factionId);
      if (list) list.push(e);
      else owners.set(e.factionId, [e]);
    }
    if (owners.size < 2) return out;
    const wars = useGameStore.getState().wars;
    for (const a of owners.keys()) {
      for (const [b, units] of owners) {
        if (a === b || !kingdomsAtWar(wars, a, b)) continue;
        out.set(a, [...(out.get(a) ?? []), ...units]);
      }
    }
    return out;
  },

  /** Grupo fixo com comando (local de contrato, covil): sem bando, mas com chefe e esquadrões. */
  attachGroup(this: WorldScene, key: string, units: Enemy[], chief?: { name: string; traits: StaffData["traits"]; martial?: number }): WarHost {
    const kinds = units.map((u) => u.kind);
    const base = kinds.includes("SKELETON") || kinds.includes("ORC") ? 2 : kinds.includes("BANDIT") ? 2 : kinds.includes("SOLDIER") ? 3 : 1;
    return this.hosts.attachGroup(key, units, makeStaff(kinds, base, chief));
  },

  spawnEnemyGroup(this: WorldScene, group: EnemyGroupDef, owner: Enemy["owner"], color?: number, led = false): Enemy[] {
    const plain = group.units.flatMap(([kind, n]) => Array<EnemyKind>(n).fill(kind));
    const kinds = led ? promoteRoster(plain) : plain;
    const cols = Math.ceil(Math.sqrt(kinds.length));
    return kinds.map((kind, i) => {
      const x = group.x + ((i % cols) - (cols - 1) / 2) * 30 + Phaser.Math.Between(-6, 6);
      const y = group.y + (Math.floor(i / cols) - (cols - 1) / 2) * 30 + Phaser.Math.Between(-6, 6);
      const e = this.spawnEnemy(x, y, kind, color);
      e.owner = owner;
      return e;
    });
  },

  /** Inimigos perto de alguém do bando (os outros "dormem": o mundo é grande demais para simular tudo). */
  activeEnemies(this: WorldScene): Enemy[] {
    return this.enemies.filter((e) => e.isAlive && !e.dormant);
  },

  /** Onde o bando do jogador está: centro da bolha de detalhe e de quem "acorda" os inimigos. */
  presence(this: WorldScene): Point[] {
    const anchors: Point[] = [this.commander, ...this.scouts.filter((s) => s.isAlive), ...this.messengers.filter((m) => m.isAlive)];
    for (const b of this.battalions) if (!b.isDestroyed) anchors.push(b.center);
    return anchors;
  },

  updateDormancy(this: WorldScene): void {
    const anchors = this.presence();
    const r2 = WORLD.ACTIVE_RADIUS ** 2;
    for (const e of this.enemies) {
      // Batalha personalizada: o campo é pequeno, ninguém dorme
      const near = !!this.run || anchors.some((a) => (a.x - e.x) ** 2 + (a.y - e.y) ** 2 <= r2);
      if (e.dormant && near) e.dormant = false;
      else if (!e.dormant && !near && !e.target) e.dormant = true;
    }
  },

  // --- Mundo: combate, objetivos, relógio, bandos e viagem ---

  /** Inimigos "quentes": perseguindo alguém do bando ou à vista e perto de uma tropa. */
  isHot(this: WorldScene, e: Enemy, allyPoints: readonly Point[]): boolean {
    if (!e.hostile) return false;
    // Ir atrás de um batedor não é combate: o bando nem fica sabendo
    if (e.target?.isAlive && e.target.team === "ALLY" && !e.target.isScout) return true;
    // Quem foge não está lutando: o combate acaba sem esperar ele sumir no horizonte
    if (e.routed) return false;
    // Cerco: quem está atrás dos muros só conta se estiver atirando (dá para acampar fora do alcance)
    if (!e.revealed || e.keepInside) return false;
    const r2 = WORLD.ENGAGE_RADIUS ** 2;
    return allyPoints.some((a) => (a.x - e.x) ** 2 + (a.y - e.y) ** 2 <= r2);
  },

  /**
   * O combate começa quando inimigos e tropas se encontram e acaba depois de alguns
   * segundos sem ninguém lutando: aí sai o relatório (XP, saque, baixas, contrato).
   */
  updateEngagement(this: WorldScene, time: number, active: readonly Enemy[]): void {
    const allyPoints: Point[] = [this.commander];
    for (const b of this.battalions) if (!b.isDestroyed) allyPoints.push(b.center);
    const hot = active.filter((e) => this.isHot(e, allyPoints));

    if (hot.length > 0) {
      if (!this.engagement) {
        this.engagement = {
          enemies: new Set(),
          officers: [],
          participants: new Set(),
          startKills: new Map(),
          quietSince: null,
          region: this.placeName(this.commander),
          contractDone: false,
          notes: [],
        };
        this.pushFeed(`Combate em ${this.engagement.region}!`);
        this.checkNightAmbush(hot, time);
      }
      const eng = this.engagement;
      eng.quietSince = null;
      for (const e of hot) eng.enemies.add(e);
      // Entra no combate quem está perto dos inimigos ou já trocou golpes
      for (const b of this.battalions) {
        if (b.isDestroyed || eng.participants.has(b)) continue;
        const c = b.center;
        const close = hot.some((e) => distance(e, c) <= WORLD.ENGAGE_RADIUS * 1.5);
        if (close || b.soldiers.some((s) => s.target)) {
          eng.participants.add(b);
          eng.startKills.set(b, { kills: b.kills, lieutenantKills: b.lieutenantKills, captainKills: b.captainKills });
        }
      }
      return;
    }

    if (!this.engagement) return;
    this.engagement.quietSince ??= time;
    if (time - this.engagement.quietSince >= WORLD.ENGAGE_END_MS) this.endEngagement(this.engagementResult());
  },

  /** O campo ficou com o bando se o inimigo morreu, fugiu ou largou a luta. */
  engagementResult(this: WorldScene): BattleResult {
    const eng = this.engagement;
    if (!eng) return "RETREAT";
    return [...eng.enemies].every((e) => !e.isAlive || e.routed) ? "VICTORY" : "RETREAT";
  },

  /** Oficial inimigo caído: nota no combate; um lorde tem o destino resolvido na hora. */
  onOfficerDown(this: WorldScene, host: WarHost, name: string, chief: boolean): void {
    const eng = this.engagement;
    const armyId = host.band?.armyId;
    if (chief && armyId) {
      const text = useGameStore.getState().lordDown(armyId);
      if (text) {
        eng?.notes.push(text);
        this.pushFeed(text);
      }
      return;
    }
    eng?.notes.push(chief ? `${name}, que comandava o ${host.band?.name ?? "bando"}, caiu em combate.` : `O capitão ${name} caiu em combate.`);
    if (this.run) {
      this.run.officers.push(name);
      if (chief && host.band === this.run.prey) this.run.chiefDown = true;
    }
    eng?.officers.push({ name, factionId: host.band?.ownerId ?? null });
  },

  /** Quem se rendeu: uma parte dos que caíram e dos que fugiam perto da tropa (Marco 16). */
  takePrisoners(this: WorldScene, eng: Engagement): void {
    const P = PRISONERS;
    const store = useGameStore.getState();
    const tally = new Map<string, { label: string; count: number; factionId: string | null; ransom: number; troop: TroopType | null }>();
    const points = this.battalions.filter((b) => !b.isDestroyed).map((b) => b.center);
    for (const e of eng.enemies) {
      const fallen = !e.isAlive && !e.fled;
      const routed = e.isAlive && e.routed && points.some((p) => distance(p, e) < P.CAPTURE_RADIUS);
      if (!fallen && !routed) continue;
      if (Math.random() > (fallen ? P.SHARE_FALLEN : P.SHARE_ROUTED)) continue;
      const c = this.captiveClass(e);
      if (!c) continue;
      const key = `${c.label}|${c.troop}`;
      const had = tally.get(key);
      if (had) had.count++;
      else tally.set(key, { ...c, count: 1 });
      if (routed) {
        e.fled = true;
        e.unitState = "DEAD";
        e.destroy();
      }
    }
    store.addCaptives([...tally.values()]);
    const taken = [...tally.values()].reduce((n, g) => n + g.count, 0);
    if (taken > 0) eng.notes.push(`${taken} inimigo${taken > 1 ? "s se renderam" : " se rendeu"}: veja a lista de prisioneiros.`);
    for (const o of eng.officers) {
      if (Math.random() > P.OFFICER_CAPTURE) continue;
      store.addCaptiveOfficer({ name: o.name, factionId: o.factionId, nobleId: null, ransom: P.RANSOM_OFFICER });
      eng.notes.push(`${o.name} se rendeu ferido.`);
    }
  },

  /** De quem é e no que vira quem se rende. */
  captiveClass(this: WorldScene, e: Enemy): { label: string; factionId: string | null; ransom: number; troop: TroopType | null } | null {
    const P = PRISONERS;
    const def = e.factionId ? this.world.factions.find((f) => f.id === e.factionId) : undefined;
    const troop: TroopType = e.ranged ? "ARCHERS" : e.mounted ? "CAVALRY" : e.canBrace ? "SPEARMEN" : "INFANTRY";
    switch (e.kind) {
      case "SOLDIER":
      case "PIKEMAN":
      case "MAN_AT_ARMS":
      case "CROSSBOW":
      case "LONGBOW":
      case "LANCER":
      case "KNIGHT":
      case "OUTRIDER":
      case "HERALD":
        return { label: def ? `soldados ${ofRealm(def.name)}` : "soldados", factionId: e.factionId, ransom: P.RANSOM_SOLDIER, troop };
      case "BANDIT":
      case "BANDIT_ARCHER":
      case "BANDIT_JAVELIN":
      case "BANDIT_RIDER":
        return { label: "salteadores", factionId: null, ransom: P.RANSOM_BANDIT, troop };
      case "GOBLIN":
      case "GOBLIN_ARCHER":
      case "GOBLIN_SPEAR":
      case "WOLF_RIDER":
        return { label: "goblins", factionId: null, ransom: 0, troop: null };
      case "ORC":
      case "ORC_BRUTE":
        return { label: "orcs", factionId: null, ransom: 0, troop: null };
      default:
        return null;
    }
  },

  /** Emboscada do inimigo: quem foi pego perde o ânimo. */
  sprungAmbush(this: WorldScene, at: Point): void {
    const caught = this.battalions.filter((b) => !b.isDestroyed && distance(b.center, at) < 640);
    for (const b of caught) b.morale = Math.max(0, b.morale - WAR_AI.AMBUSH_MORALE);
    this.engagement?.notes.push("O inimigo emboscou o bando.");
  },

  /** Contrato cumprido (todos os inimigos do local mortos), povoado tomado ou líder de calamidade abatido. */
  checkObjectives(this: WorldScene): void {
    if (this.contractId && this.contractEnemies.length > 0 && this.contractEnemies.every((e) => !e.isAlive)) {
      if (this.engagement) this.engagement.contractDone = true;
      // Largaram o local sem ninguém lutando: o serviço está feito do mesmo jeito
      else {
        useGameStore.getState().finishContract(true, "os inimigos abandonaram o local");
        this.contractId = null;
      }
      this.contractEnemies = [];
    }
    const store = useGameStore.getState();
    const sieged = this.siegeId ? store.settlements.find((x) => x.id === this.siegeId) : undefined;
    if (sieged && sieged.garrison <= 0 && this.garrisons.defeated(sieged.id)) {
      const t = sieged;
      {
        // O cerco acaba no store; syncSiege limpa a guarnição em campo e devolve os acampamentos
        store.conquerSettlement(t.id);
        this.engagement?.notes.push(`${t.name} agora pertence ao bando.`);
        this.pushFeed(`${t.name} foi tomada!`);
      }
    }
    for (const [id, c] of this.calamityObjects) {
      if (c.boss.isAlive) continue;
      const cal = store.calamities.find((x) => x.id === id);
      for (const o of c.objects) o.destroy();
      this.calamityObjects.delete(id);
      this.settlementLayer.removeLair(id);
      if (cal) this.applyLair(cal.lair);
      if (cal && !cal.defeated) {
        store.defeatCalamity(id);
        this.engagement?.notes.push(`${cal.leader} caiu: ${cal.name} chegou ao fim (+${REALM.CALAMITY_REWARD} de ouro).`);
        this.pushFeed(`${cal.leader} caiu!`);
      }
    }
  },

  endEngagement(this: WorldScene, result: BattleResult): void {
    const eng = this.engagement;
    this.engagement = null;
    // Batalha personalizada: quem decide o fim é scenarioTick
    if (this.run) return;
    const clock = useGameStore.getState();
    this.lastCombatDay = clock.day + clock.dayProgress;
    if (!eng && result !== "DEFEAT") return;

    const store = useGameStore.getState();
    const participants = eng ? [...eng.participants] : this.battalions;
    const survivors: BattalionSurvivors[] = participants.map((b) => {
      const start = eng?.startKills.get(b) ?? { kills: 0, lieutenantKills: 0, captainKills: 0 };
      return {
        id: b.id,
        survivors: b.aliveCount,
        formation: b.formation,
        kills: b.kills - start.kills,
        lieutenantAlive: b.lieutenant ? b.lieutenantAlive : undefined,
        lieutenantKills: b.lieutenantKills - start.lieutenantKills,
        captainId: b.captain?.id,
        captainAlive: b.captain ? b.captainAlive : undefined,
        captainKills: b.captainKills - start.captainKills,
      };
    });
    // Quem fugiu de um local de contrato não volta: o lugar está limpo
    if (eng && result === "VICTORY") {
      // Bando que perdeu o campo não fica por perto para tentar de novo
      for (const h of this.hosts.hosts) if (h.members.some((m) => eng.enemies.has(m))) h.giveUp();
      for (const e of this.contractEnemies) {
        if (!e.isAlive || !e.routed) continue;
        e.fled = true;
        e.unitState = "DEAD";
        e.destroy();
      }
      this.contractEnemies = this.contractEnemies.filter((e) => e.isAlive);
    }
    if (eng && result === "VICTORY") this.takePrisoners(eng);
    const killed = eng ? [...eng.enemies].filter((e) => !e.isAlive && !e.fled).length : 0;
    const fled = eng ? [...eng.enemies].filter((e) => e.fled || (e.isAlive && e.routed)).length : 0;
    if (eng && fled > 0) eng.notes.push(`${fled} inimigo${fled > 1 ? "s fugiram" : " fugiu"} do campo.`);
    if (eng && killed >= 4) {
      const fallen = [...eng.enemies];
      store.markBattlefield(fallen.reduce((n, e) => n + e.x, 0) / fallen.length, fallen.reduce((n, e) => n + e.y, 0) / fallen.length);
    }
    const mutinyOver = !!store.mutiny && this.mutineers.length > 0 && this.mutineers.every((e) => !e.isAlive);
    // Só o contrato de limpar um local termina em combate (os da economia têm fim próprio)
    const siteContract = !!store.activeContract && (store.activeContract.contract.kind ?? "SITE") === "SITE";
    const contractDone = !!eng?.contractDone || (!!this.contractId && this.contractEnemies.length === 0 && siteContract);

    if (result === "VICTORY") sfx.victory();
    else if (result === "DEFEAT") sfx.defeat();
    this.storeWagonHp();
    this.selectionBox.clear();
    store.setContextMenu(null);
    store.resolveEngagement(result, survivors, this.supportReport(), {
      title: `Combate em ${eng?.region ?? this.placeName(this.commander)}`,
      enemiesKilled: killed,
      contractDone,
      mutinyOver,
      notes: eng?.notes ?? [],
    });
    // Flechas dos muros num cerco: é o dia a dia, não uma batalha com relatório
    if (this.works && result === "RETREAT" && killed === 0 && !contractDone) {
      const hurt = useGameStore.getState().battleReport;
      store.clearReport();
      if (hurt && hurt.casualties + hurt.wounded > 0) this.pushFeed(`Flechas dos muros: ${hurt.casualties + hurt.wounded} homem(ns) fora de combate. Acampem mais longe.`);
    }
    // O que já foi informado não entra no próximo relatório
    for (const m of this.messengers) m.deliveries = 0;
    for (const id of [...this.deadScoutIds, ...this.deadMessengerIds]) this.reportedDead.add(id);
    if (mutinyOver || (result === "DEFEAT" && store.mutiny)) this.mutineers = [];
    if (contractDone) this.contractId = null;
    // Quem sobreviveu ao combate (XP, nível, baixas) é recriado a partir dos dados novos
    this.armyDirty = true;
    for (const b of this.battalions) b.resupply();
    this.publishHud();
  },

  /**
   * O Comandante caiu: o combate é perdido, os amotinados (se houver) fogem e o bando
   * recua carregando-o ferido para o acampamento.
   */
  defeat(this: WorldScene): void {
    if (this.run) return this.endScenario(this.run, "DEFEAT", "O Comandante caiu em combate.");
    if (!this.engagement) {
      this.engagement = {
        enemies: new Set(this.activeEnemies().filter((e) => e.target)),
        officers: [],
        participants: new Set(this.battalions.filter((b) => !b.isDestroyed)),
        startKills: new Map(),
        quietSince: null,
        region: this.placeName(this.commander),
        contractDone: false,
        notes: [],
      };
    }
    const store = useGameStore.getState();
    const mutiny = !!store.mutiny;
    // Quem está em volta faz prisioneiros: bichos e mortos-vivos, não
    const captor = this.hosts.hosts.find((h) => !!h.band && h.band.kind !== "HORDE" && h.members.some((m) => distance(m, this.commander) < 700));
    const where = this.engagement.region;
    this.endEngagement("DEFEAT");
    if (captor?.band && !mutiny && !useGameStore.getState().captivity && Math.random() < PRISONERS.COMMANDER_CAPTURE) this.commanderTaken(captor);
    // Quem foi levado vivo não morreu; quem ficou no chão, talvez não se levante (Marco 18)
    if (!useGameStore.getState().captivity) useGameStore.getState().commanderFell(mutiny ? "no motim do próprio bando" : `caiu em combate ${inPlace(where)}`);
    // Cerco perdido: a guarnição volta para trás dos muros
    if (useGameStore.getState().siege) useGameStore.getState().liftSiege();
    if (mutiny) {
      for (const e of this.enemies) {
        if (e.owner?.kind !== "MUTINY") continue;
        e.unitState = "DEAD";
        e.destroy();
      }
      this.enemies = this.enemies.filter((e) => e.isAlive);
    }

    // Novo Comandante (o mesmo, recuperado) no acampamento; o exército volta com ele
    const spawn = this.world.camp.spawn;
    this.commander = new Commander(this, spawn.x, spawn.y);
    this.applyLeader();
    this.commander.setFacing(-Math.PI / 2);
    this.cameras.main.startFollow(this.commander, true, 0.1, 0.1);
    this.cameraLocked = true;
    this.lastCommanderPos = { x: this.commander.x, y: this.commander.y };
    this.walkPath = null;
    this.inCamp = true;
    for (const b of this.battalions) this.unquarter(b);
    this.quartered.clear();
    useGameStore.getState().battalions.forEach((data, i) => {
      const b = this.battalions.find((x) => x.id === data.id);
      const slot = this.campArea.quarterSlot(i) ?? spawn;
      if (!b || b.isDestroyed) return;
      if (b.panicking) b.rally();
      b.teleportTo(slot);
      this.quarter(b, i, slot);
    });
    for (const r of [...this.scouts, ...this.messengers]) {
      // Batedor em missão longe dali não fica sabendo: segue o que estava fazendo
      if (!r.isAlive || (r instanceof Scout && r.onMission)) continue;
      r.x = spawn.x + Phaser.Math.Between(150, 260);
      r.y = spawn.y + Phaser.Math.Between(-60, 60);
      r.target = null;
    }
    for (const e of this.enemies) if (e.target) e.target = null;
    // O que sobrou do trem de carroças volta com o Comandante e descarrega
    useGameStore.getState().unloadWagons();
    this.wagons.forEach((w, i) => {
      const p = this.wagonSlot(i);
      w.x = p.x;
      w.y = p.y;
    });
    this.armyDirty = true;
  },

  /** O Comandante foi levado: um tenente assume o bando até resgatá-lo. */
  commanderTaken(this: WorldScene, captor: WarHost): void {
    const band = captor.band;
    if (!band) return;
    const s = useGameStore.getState();
    const acting = s.lieutenants[0];
    s.beginCaptivity({
      by: captor.name,
      factionId: band.ownerId,
      bandId: band.id,
      acting: acting ? fullName(acting) : "o sargento mais velho",
      ransom: PRISONERS.COMMANDER_RANSOM + Math.round(s.fame * PRISONERS.COMMANDER_RANSOM_FAME),
    });
    band.spotted = true;
    band.lastSeen = { x: band.anchor.x, y: band.anchor.y, day: s.day };
    s.chronicle(`O Comandante caiu nas mãos de ${captor.name}. ${acting ? fullName(acting) : "Um sargento"} assume o bando.`, "bad");
    this.pushFeed(`O Comandante foi levado por ${captor.name}!`);
    if (band.armyId) this.warbands.sendHome(band);
  },

  // --- Névoa de guerra e visão ---

  /** Raio de visão de uma fonte conforme o terreno onde está (colina amplia, floresta reduz). */
  visionAt(this: WorldScene, p: Point, base: number): number {
    const t = Unit.terrain?.typeAt(p.x, p.y) ?? "GRASS";
    if (t === "HILL") return base * SUPPORT.VISION_HILL_BONUS;
    if (t === "FOREST") return base * SUPPORT.VISION_FOREST_PENALTY;
    return base;
  },

  visionSources(this: WorldScene): VisionSource[] {
    const V = SUPPORT.VISION;
    const sources: VisionSource[] = [];
    // Noite e tempo (nevoeiro, neve, chuva) encurtam a visão
    const night = this.nightVision() * WEATHER.VISION[this.weather];
    const add = (p: Point, base: number) => sources.push({ x: p.x, y: p.y, radius: this.visionAt(p, base) * night });
    if (this.commander.isAlive) add(this.commander, V.COMMANDER);
    // Quem atira precisa enxergar além do próprio alcance
    for (const b of this.battalions) if (!b.isDestroyed) add(b.center, b.ammoLeft !== null ? V.ARCHERS : V.BATTALION);
    // Fora de contato o batedor enxerga, mas ninguém fica sabendo (ver recordScoutViews)
    for (const s of this.scouts) if (s.isAlive && s.inContact) add(s, s.vision);
    for (const m of this.messengers) if (m.isAlive) add(m, V.MESSENGER);
    for (const { party } of this.parties.values()) add(party, V.BATTALION);
    // Batalha personalizada sem névoa: todo o campo à vista
    if (this.run && !this.run.def.fog) sources.push({ x: this.world.camp.center.x, y: this.world.camp.center.y, radius: 20000 });
    // Torres de vigia do acampamento (obra): enxergam longe em volta dele
    if (!this.campArea.packed && useGameStore.getState().campWorks.includes("TOWERS")) {
      for (const t of this.campArea.watchtowers) sources.push({ x: t.x, y: t.y, radius: V.TOWER * night });
    }
    return sources;
  },

  updateVision(this: WorldScene, time: number): void {
    this.lastFogAt = time;
    // Bandos entram na bolha (viram unidades) ou saem dela (voltam a ser dados)
    this.warbands.updateBubble(this.presence());
    this.updateDormancy();
    this.updateScoutContact(time);
    this.recordScoutViews();
    this.fog.update(this.visionSources(), this.cameras.main.worldView);
    this.updateReveal(this.allAllies(), time);
    this.noteSightings();
  },

  /**
   * Inimigo visível = dentro da visão de alguém (névoa) e, se estiver na floresta,
   * só com um aliado bem perto. Atacar revela por um instante. Quem some deixa um "fantasma".
   */
  updateReveal(this: WorldScene, allies: readonly Unit[], time: number): void {
    for (const e of this.enemies) {
      if (e.dormant) {
        // Longe de todos: invisível (e sem custo de visão)
        e.revealed = false;
        e.setVisible(false);
        continue;
      }
      const recentAttack = time - e.lastAttackAt < BALANCE.REVEAL_AFTER_ATTACK_MS;
      const seen = this.fog.canSee(e);
      const forestOk = !e.isInForest || allies.some((a) => distance(a, e) <= BALANCE.FOREST_REVEAL_RANGE);
      const was = e.revealed;
      e.revealed = (seen && forestOk) || recentAttack;
      if (e.revealed && !was) this.firstSeenAt.set(e, time);
      if (e.isAlive) e.setVisible(e.revealed);
      if (e.revealed) this.lastSeen.set(e, { x: e.x, y: e.y, t: time });
    }
    for (const a of allies) a.setAlpha(a.isInForest ? 0.6 : 1);
    this.drawGhosts(time);
  },

  drawGhosts(this: WorldScene, time: number): void {
    const g = this.ghostGfx;
    g.clear();
    for (const [e, seen] of this.lastSeen) {
      if (!e.isAlive) {
        this.lastSeen.delete(e);
        continue;
      }
      if (e.revealed || !e.hostile || time - seen.t > SUPPORT.GHOST_MS) continue;
      const s = e.radius;
      g.fillStyle(COLORS.ENEMY, 0.3);
      g.fillRect(seen.x - s, seen.y - s, s * 2, s * 2);
      g.lineStyle(1, COLORS.ENEMY, 0.6);
      g.strokeRect(seen.x - s, seen.y - s, s * 2, s * 2);
    }
  },

  /** Inimigos à vista (só os hostis: patrulhas em paz, refugiados e mensageiros não contam). */
  visibleEnemies(this: WorldScene): Enemy[] {
    return this.enemies.filter((e) => e.revealed && e.hostile);
  },
};

export type CombatMethods = typeof combatMethods;
