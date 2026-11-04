import { Unit } from "../../entities/Unit";
import type { Warband } from "../../systems/Warbands";
import { ExpeditionParty } from "../../entities/ExpeditionParty";
import { missionPlan } from "../../data/missionGuide";
import { expeditionStage } from "../../sim/expeditions";
import { captainName } from "../../data/captains";
import { ownerColor } from "../../world/Settlements";
import type { MapLifeContext } from "../../world/MapLife";
import { ofRealm } from "../../worldgen/names";
import { isCalamityOwner, isFactionOwner, isRaiderKind, type Settlement } from "../../sim/realm";
import { useGameStore, type Expedition } from "../../../store/useGameStore";
import { AGENTS, TIME, WORLD, FATIGUE, WAR_AI } from "../../../utils/constants";
import { daysUntilHour, formatHour, hourOf, phaseOf } from "../../../utils/time";
import { centroid, distance, type Point } from "../../../utils/math";
import type { WorldScene } from "../WorldScene";

/**
 * Os agentes do mundo (Marco 12), o comboio, as expedições e o descanso.
 * Uma parte da `WorldScene`: os métodos entram no protótipo dela (ver o fim de `WorldScene.ts`).
 */
export const agentsMethods = {
  // --- Agentes do mundo (Marco 12) ---

  /** O bando ataca o jogador? Goblins, exércitos e hordas sim; patrulhas e mensageiros só em guerra ou provocados. */
  bandHostile(this: WorldScene, b: Warband): boolean {
    const s = useGameStore.getState();
    // Camponeses só querem a terra deles; só são inimigos do senhor (Marco 15)
    if (b.kind === "REBELS") return b.goal.kind === "SETTLEMENT" && s.settlements.find((t) => t.id === (b.goal as { id: string }).id)?.owner === "PLAYER";
    // Exércitos dos reinos só atacam o bando em guerra com ele (ou provocados)
    if (b.kind === "FACTION") return b.provoked || s.factions.some((f) => f.id === b.ownerId && f.atWar) || !b.armyId;
    if (isRaiderKind(b.kind)) return true;
    if (b.kind === "REFUGEES" || b.ownerId === "PLAYER") return false;
    if (b.provoked) return true;
    return s.factions.some((f) => f.id === b.ownerId && f.atWar);
  },

  /** Hostilidade de quem está em campo; quem foi atacado pelo bando é provocado (e o dono fica sabendo). */
  updateHostility(this: WorldScene): void {
    for (const band of this.warbands.bands) {
      if (!band.materialized) continue;
      // Caravana do próprio bando (Marco 14): luta do nosso lado
      if (band.ownerId === "PLAYER") {
        for (const m of band.members) if (!m.friendly) m.setFriendly(true);
        continue;
      }
      if (!band.provoked && band.members.some((m) => m.provoked)) {
        band.provoked = true;
        const store = useGameStore.getState();
        // Caravana atacada: a honra e a relação pesam quando ela cair (o saque é do bando)
        if (band.kind === "CARAVAN") {
          this.pushFeed(`Atacamos ${band.name} (${this.trade.realmOf(band)})! Se ela cair, a carga é nossa — e o nome do bando, sujo.`);
          for (const m of band.members) m.hostile = true;
          continue;
        }
        if (band.kind === "REFUGEES") store.attackRefugees(band.name.replace(/^Refugiados de /, ""));
        else if (band.ownerId && !store.factions.some((f) => f.id === band.ownerId && f.atWar)) {
          store.provokeFaction(band.ownerId, band.kind === "PATROL" ? "uma patrulha" : band.kind === "FACTION" ? "um exército" : "o mensageiro real");
        }
        const realm = this.world.factions.find((f) => f.id === band.ownerId)?.name ?? "reino";
        this.pushFeed(
          `Atacamos ${band.kind === "REFUGEES" ? "refugiados" : band.kind === "PATROL" ? `a patrulha ${ofRealm(realm)}` : `o mensageiro ${ofRealm(realm)}`}!`,
        );
      }
      // Mensageiros e refugiados nunca lutam (fogem); patrulhas lutam em guerra ou provocadas
      const hostile = band.kind !== "COURIER" && band.kind !== "REFUGEES" && this.bandHostile(band);
      for (const m of band.members) m.hostile = hostile;
    }
  },

  /**
   * Notícias do bando: o que os soldados viram chega ao reino com atraso, e quem passa perto de um
   * povoado é visto por alguém. Acampamento perto de um bando deixa de ser segredo.
   */
  newsTick(this: WorldScene): void {
    const s = useGameStore.getState();
    const now = s.day + s.dayProgress;
    const size = this.battalions.reduce((n, b) => n + b.aliveCount, 0);
    const here: Point = { x: this.commander.x, y: this.commander.y };
    for (const t of s.settlements) {
      if (!isFactionOwner(t.owner) || t.owner === "PLAYER" || distance(t, here) > WAR_AI.TOWN_WATCH) continue;
      this.warbands.noteArmy(t.owner, { ...here, day: now, size });
    }
    this.newsOfArmy = this.newsOfArmy.filter((n) => {
      if (n.at.day > now) return true;
      this.warbands.noteArmy(n.key, n.at);
      return false;
    });
    if (this.campArea.packed) return;
    const camp = this.world.camp.center;
    for (const b of this.warbands.bands) {
      if (distance(b.anchor, camp) > WAR_AI.CAMP_SEEN || !this.bandHostile(b)) continue;
      this.warbands.noteCamp(b.id);
      if (b.ownerId) this.warbands.noteCamp(b.ownerId);
    }
  },

  /** Patrulhas e mensageiros: cada reino mantém os seus em movimento. */
  spawnAgents(this: WorldScene): void {
    const s = useGameStore.getState();
    for (const f of s.factions) {
      const own = s.settlements.filter((t) => t.owner === f.id);
      const def = this.world.factions.find((x) => x.id === f.id);
      if (own.length === 0 || !def) continue;
      const gateOf = (t: Settlement) => {
        const layout = this.settlementLayer.layoutOf(t.id);
        return layout ? layout.gates[Math.floor(Math.random() * layout.gates.length)].outside : { x: t.x, y: t.y };
      };
      const patrols = this.warbands.bands.filter((b) => b.kind === "PATROL" && b.ownerId === f.id).length;
      const want = Math.min(AGENTS.PATROL_MAX, Math.ceil(own.length / AGENTS.PATROL_PER_SETTLEMENTS));
      // Inverno: patrulhas novas não saem (as que estão na estrada terminam a ronda)
      if (patrols < want && this.season !== "WINTER") {
        this.warbands.spawnBand({
          name: `Patrulha ${ofRealm(def.name)}`,
          kind: "PATROL",
          units: [
            ["SOLDIER", AGENTS.PATROL_SIZE.SOLDIER],
            ["CROSSBOW", AGENTS.PATROL_SIZE.CROSSBOW],
          ],
          origin: gateOf(own[Math.floor(Math.random() * own.length)]),
          ownerId: f.id,
          color: def.color,
        });
      }
      if (own.length >= 2 && !this.warbands.bands.some((b) => b.kind === "COURIER" && b.ownerId === f.id)) {
        const capital = own.find((t) => t.id === def.capitalId) ?? own[0];
        this.warbands.spawnBand({ name: `Mensageiro ${ofRealm(def.name)}`, kind: "COURIER", units: [["COURIER", 1]], origin: gateOf(capital), ownerId: f.id, color: def.color });
      }
    }
  },

  /** Povoado atacado: quem escapou foge pela estrada. */
  spawnRefugees(this: WorldScene, t: Settlement): void {
    const layout = this.settlementLayer.layoutOf(t.id);
    const origin = layout ? layout.gates[0].outside : { x: t.x, y: t.y };
    const n = Math.max(4, Math.min(10, Math.round(t.population / 80)));
    this.warbands.spawnBand({ name: `Refugiados de ${t.name}`, kind: "REFUGEES", units: [["CIVILIAN", n]], origin, ownerId: null });
  },

  /** Despachos interceptados: os exércitos do reino em marcha aparecem no mapa. */
  revealArmiesOf(this: WorldScene, factionId: string): void {
    const day = useGameStore.getState().day;
    for (const b of this.warbands.bands) {
      if (b.ownerId !== factionId || (b.kind !== "FACTION" && b.kind !== "PATROL")) continue;
      b.lastSeen = { x: b.anchor.x, y: b.anchor.y, day };
      b.spotted = true;
    }
  },

  /** A rota da expedição, a partir de onde a tropa estava quando saiu do campo. */
  startExpedition(this: WorldScene, e: Expedition): void {
    const s = useGameStore.getState();
    const from = e.battalions.flatMap((b) => this.leftFrom.get(b.id) ?? []);
    const origin = from.length > 0 ? centroid(from) : { x: this.commander.x, y: this.commander.y };
    const plan = missionPlan(e.contract, { world: this.world, settlements: s.settlements });
    const first = plan.route[0] ?? plan.to ?? null;
    const lead = first ? (this.nav.findPath(this.nav.nearestOpen(origin, 1400) ?? origin, this.nav.nearestOpen(first, 1400) ?? first, 200000) ?? [first]) : [];
    const path = [origin, ...lead, ...plan.route.slice(1)];
    useGameStore.setState((st) => ({ expeditions: st.expeditions.map((x) => (x.id === e.id ? { ...x, path, meet: lead.length } : x)) }));
    for (const b of e.battalions) this.leftFrom.delete(b.id);
    const who = e.battalions.map((b) => b.name).join(" e ");
    this.pushFeed(e.captain ? `O capitão ${captainName(e.captain)} sai com ${who} para: ${e.contract.title}.` : `${who} sai para: ${e.contract.title}.`);
  },

  updateConvoy(this: WorldScene, dt: number): void {
    const s = useGameStore.getState();
    const c = s.convoy;
    if (!c) {
      this.convoyParty?.party.destroy();
      this.convoyParty = null;
      return;
    }
    const now = s.day + s.dayProgress;
    const t = Math.max(0, Math.min(1, (now - c.departAt) / Math.max(0.01, c.arriveAt - c.departAt)));
    // Indo, ele procura o exército onde ele estiver; voltando, vai para o acampamento
    const to = c.returning || this.inCamp ? this.world.camp.center : { x: this.commander.x, y: this.commander.y };
    const at = { x: c.from.x + (to.x - c.from.x) * t, y: c.from.y + (to.y - c.from.y) * t };
    if (this.convoyParty?.id !== c.id) {
      this.convoyParty?.party.destroy();
      const escort = c.escort.map((b) => ({ troop: b.troopType, soldiers: b.soldiers }));
      const party = new ExpeditionParty(this, at, escort, c.returning ? "Carroças voltando" : c.escort.length > 0 ? "Comboio escoltado" : "Comboio sem escolta", false, null);
      // O comboio leva as carroças do bando (as de verdade ficam escondidas enquanto ele está na estrada)
      party.setCart(true, s.wagons.length);
      this.convoyParty = { id: c.id, party };
    }
    this.convoyParty.party.follow(at, Math.atan2(to.y - c.from.y, to.x - c.from.x), dt);
    if (t < 1) return;
    // Chegou: perto do exército, as carroças e a escolta aparecem atrás da coluna
    if (!c.returning && !this.inCamp) for (const b of c.escort) this.convoyArrivals.set(b.id, at);
    s.convoyArrives();
    const after = useGameStore.getState();
    this.wagons.forEach((w, i) => {
      const p = after.train === "ARMY" ? { x: at.x - 40 * (i % 2), y: at.y + 30 * i } : this.wagonSlot(i);
      w.x = p.x;
      w.y = p.y;
    });
    for (const l of after.log.slice(-2)) this.pushFeed(l.text);
  },

  /** Quem está em expedição anda pelo mapa conforme o relógio. */
  updateExpeditions(this: WorldScene, dt: number): void {
    if (this.armyDirty) return;
    const s = useGameStore.getState();
    for (const e of s.expeditions) if (!e.path) this.startExpedition(e);
    const now = s.day + s.dayProgress;
    const list = useGameStore.getState().expeditions;
    for (const e of list) {
      const stage = expeditionStage(e, now, this.commander);
      let entry = this.parties.get(e.id);
      if (!entry) {
        const troops = e.battalions.map((b) => ({ troop: b.troopType, soldiers: b.soldiers }));
        const name = e.captain ? `Companhia de ${captainName(e.captain)}` : (e.battalions[0]?.name ?? "Tropa");
        entry = { party: new ExpeditionParty(this, stage.at, troops, name, !!e.captain), leg: stage.leg };
        this.parties.set(e.id, entry);
      }
      entry.party.follow(stage.at, stage.facing, dt);
      entry.party.setCart(stage.escorting);
      if (stage.leg !== entry.leg) {
        entry.leg = stage.leg;
        if (stage.leg === "WORK") this.pushFeed(`${e.battalions[0]?.name ?? "A tropa"} chegou ao serviço: ${e.contract.title}.`);
      }
    }
    for (const [id, entry] of this.parties) {
      if (list.some((e) => e.id === id)) continue;
      entry.party.destroy();
      this.parties.delete(id);
    }
  },

  /** Gente perto da câmera e os sinais do mapa. */
  updateMapLife(this: WorldScene, time: number, dt: number): void {
    const s = useGameStore.getState();
    const now = s.day + s.dayProgress;
    const towns: MapLifeContext["towns"] = [];
    // Numa batalha de cerco, os moradores estão trancados em casa
    for (const t of this.run ? [] : s.settlements) {
      const layout = this.settlementLayer.layoutOf(t.id);
      if (layout) towns.push({ settlement: t, layout });
    }
    const smoke: MapLifeContext["smoke"] = [];
    const crows: Point[] = s.battlefields.filter((b) => s.day - b.day <= 2);
    for (const t of s.settlements) {
      const raided = t.lastRaidDay !== null && s.day - t.lastRaidDay <= 2;
      if (raided || isCalamityOwner(t.owner)) smoke.push({ x: t.x, y: t.y, strength: 1 });
      else if (t.owner === "RUINED") smoke.push({ x: t.x, y: t.y, strength: 0.45 });
      else if (t.besiegedBy) smoke.push({ x: t.x, y: t.y, strength: 0.7 });
      if (raided) crows.push({ x: t.x, y: t.y - 200 });
    }
    const tracks: MapLifeContext["tracks"] = [];
    // Na lama (primavera, chuva) e na neve os rastros ficam fundos e duram o dobro
    const soft = this.season === "SPRING" || this.season === "WINTER" || this.weather === "RAIN";
    for (const b of this.warbands.bands) {
      for (let i = 1; i < b.trail.length; i++) {
        const p = b.trail[i];
        const q = b.trail[i - 1];
        const deep = soft && this.groundAt(p.x, p.y, "GRASS") < 1;
        tracks.push({ x: p.x, y: p.y, dir: Math.atan2(p.y - q.y, p.x - q.x), age: (now - p.day) / (deep ? 2 : 1) });
      }
    }
    const army: Point[] = [this.commander];
    for (const b of this.battalions) if (!b.isDestroyed) army.push(b.center);
    this.mapLife.update(time, dt, {
      view: this.cameras.main.worldView,
      hour: hourOf(s.dayProgress),
      darkness: Unit.darkness,
      towns,
      roads: this.world.roads,
      canSee: (p) => this.fog.canSee(p),
      threats: this.warbands.bands.filter((b) => this.bandHostile(b)).map((b) => b.anchor),
      army,
      factionColor: (owner) => ownerColor(this.world, s.calamities, owner),
      terrain: Unit.terrain,
      smoke,
      crows,
      tracks,
    });
  },

  /** Pode descansar até o amanhecer? (null = sim; senão, o motivo) */
  restBlocked(this: WorldScene): string | null {
    const store = useGameStore.getState();
    if (this.run) return "Só na campanha";
    if (this.engagement) return "Em combate";
    if (store.mutiny) return "Motim no acampamento";
    if (this.visibleEnemies().some((e) => distance(e, this.commander) < WORLD.TRAVEL_BLOCK_RADIUS)) return "Inimigos à vista";
    if (this.messengers.some((m) => m.isAlive && !m.available)) return "Mensageiros fora";
    if (phaseOf(store.dayProgress) === "DAY") return "Ainda é dia";
    return null;
  },

  /**
   * Descansar até o amanhecer: a noite passa de uma vez (rações e salários correm), os bandos
   * marcham, e o descanso é interrompido se algum chegar perto do bando.
   */
  restUntilDawn(this: WorldScene): void {
    const why = this.restBlocked();
    if (why) {
      this.pushFeed(`Não dá para descansar agora: ${why.toLowerCase()}.`);
      this.publishHud();
      return;
    }
    const store = useGameStore.getState();
    const here = { x: this.commander.x, y: this.commander.y };
    const r = this.simulateMarch([here], daysUntilHour(store.dayProgress, TIME.DAWN[1]), WORLD.WARBAND.CAMP_GUARD_RADIUS);
    this.passTime(r.elapsed);
    // Uma noite de sono: no acampamento a tropa acorda inteira; ao relento, só em parte
    const full = daysUntilHour(store.dayProgress, TIME.DAWN[1]) || 1;
    this.restBy((this.inCamp ? FATIGUE.NIGHT_REST.CAMP : FATIGUE.NIGHT_REST.FIELD) * Math.min(1, r.elapsed / full));
    const now = formatHour(useGameStore.getState().dayProgress);
    this.pushFeed(
      r.interceptedBy
        ? `Alarme às ${now}! O ${r.interceptedBy} chegou perto do bando.`
        : this.inCamp
          ? `O bando dormiu no acampamento e acordou com o sol (${now}).`
          : `O bando dormiu ao relento e levantou acampamento ao amanhecer (${now}).`,
    );
    if (this.inCamp && !r.interceptedBy) useGameStore.getState().campTick("REST");
    this.updateVision(this.time.now);
    this.publishHud();
  },
};

export type AgentsMethods = typeof agentsMethods;
