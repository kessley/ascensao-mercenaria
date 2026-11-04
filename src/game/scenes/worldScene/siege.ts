import { Battalion } from "../../entities/Battalion";
import { Unit, type TownAccess } from "../../entities/Unit";
import { SiegeWorks } from "../../systems/SiegeWorks";
import { ownerColor } from "../../world/Settlements";
import { nearestGate, type TownLayout } from "../../world/townLayout";
import { seedFromText } from "../../worldgen/rng";
import { isCalamityOwner, isFactionOwner, isRaiderKind } from "../../sim/realm";
import { useGameStore, type SiegeAction } from "../../../store/useGameStore";
import { REALM, SIEGE } from "../../../utils/constants";
import { hourOf } from "../../../utils/time";
import { angleTo, centroid, distance, nearest, type Point } from "../../../utils/math";
import { SIDE_WORD, type GateRule, inRect, rectDistance } from "./shared";
import type { WorldScene } from "../WorldScene";

/**
 * O cerco de verdade (Marco 16), os portões e as guarnições.
 * Uma parte da `WorldScene`: os métodos entram no protótipo dela (ver o fim de `WorldScene.ts`).
 */
export const siegeMethods = {
  /**
   * Cerco declarado (ou guarnição que saiu em guerra): os soldados que vivem nos acampamentos
   * por dentro dos portões passam a lutar contra o bando ali mesmo, e moradores armados
   * completam a defesa (ver Garrisons). Cerco desfeito: a milícia volta para casa e a
   * guarnição, para a rotina.
   */
  syncSiege(this: WorldScene): void {
    const store = useGameStore.getState();
    const id = store.siege?.settlementId ?? null;
    if (id === this.siegeId) return;
    this.siegeId = id;
    this.closeWorks();
    const t = id ? store.settlements.find((x) => x.id === id) : null;
    if (!t) return;
    const layout = this.settlementLayer.layoutOf(t.id);
    if (store.siege?.walled && layout) {
      this.openWorks(t.id, layout);
      if (!store.scenario) this.pushFeed(`${t.name}: os portões se fecham. Agora é fome ou escada.`);
      this.updateGateRules();
      return;
    }
    for (const c of layout?.camps ?? []) this.fog.revealExplored(c.fire, 500);
    this.fog.revealExplored(t, 600);
    const n = Math.min(REALM.SIEGE_MAX_DEFENDERS, Math.max(REALM.SIEGE_MIN_DEFENDERS, t.garrison));
    this.pushFeed(`${t.name}: a guarnição (${n}) sai dos acampamentos para lutar.`);
  },

  // --- Cerco de verdade (Marco 16) ---

  openWorks(this: WorldScene, townId: string, layout: TownLayout): void {
    const weak = Math.abs(seedFromText(townId)) % Math.max(1, layout.gates.length);
    this.works = new SiegeWorks(
      this,
      layout,
      this.world.culture ?? "REALMS",
      weak,
      () => this.applyWorks(),
      (g) => {
        this.pushFeed(`O portão ${SIDE_WORD[g.side]} de ${this.placeName(g)} caiu!`);
        if (this.run) this.run.nextCourse = 0;
      },
    );
    this.applyWorks();
    // O mensageiro sai pedindo socorro (matá-lo no caminho é impedir o exército)
    const s = useGameStore.getState();
    const t = s.settlements.find((x) => x.id === townId);
    if (t && isFactionOwner(t.owner) && t.owner !== "PLAYER") {
      const def = this.world.factions.find((f) => f.id === t.owner);
      const help = s.settlements.filter((x) => x.owner === t.owner && x.id !== t.id).sort((a, b) => distance(a, t) - distance(b, t))[0];
      if (def && help) {
        const gate = layout.gates[0];
        const band = this.warbands.spawnBand({ name: `Mensageiro de ${t.name}`, kind: "COURIER", units: [["COURIER", 1]], origin: gate.outside, ownerId: t.owner, color: def.color, goalId: help.id });
        band.reliefFor = t.id;
        useGameStore.setState((st) => (st.siege ? { siege: { ...st.siege, reliefDay: s.day + SIEGE.RELIEF_DAYS } } : {}));
      }
    }
  },

  closeWorks(this: WorldScene): void {
    if (!this.works) return;
    this.works.destroy();
    this.works = null;
    Unit.terrain?.setSiegeWorks([], []);
    this.nav.setOpenings([]);
    this.armyNav.setOpenings([]);
    this.afterWorks(null);
  },

  /** Portões e escadas mudaram: colisão e rotas em volta dos muros. */
  applyWorks(this: WorldScene): void {
    const w = this.works;
    if (!w) return;
    const c = w.change;
    Unit.terrain?.setSiegeWorks(c.solids, c.breaches);
    this.nav.setOpenings(c.breaches);
    this.armyNav.setOpenings(c.breaches);
    this.afterWorks(w.layout);
    this.updateGateRules();
  },

  afterWorks(this: WorldScene, layout: TownLayout | null): void {
    const l = layout ?? this.settlementLayer.layoutOf(this.siegeId ?? "");
    if (!l) {
      this.nav.invalidateAll();
      this.armyNav.invalidateAll();
      return;
    }
    const r = Math.max(l.bounds.w, l.bounds.h) / 2 + 300;
    this.nav.invalidate({ x: l.cx, y: l.cy }, r);
    this.armyNav.invalidate({ x: l.cx, y: l.cy }, r);
  },

  siegeCommand(this: WorldScene, action: SiegeAction): void {
    const s = useGameStore.getState();
    const c = s.siege;
    const t = c ? s.settlements.find((x) => x.id === c.settlementId) : undefined;
    if (!c?.walled || !t) return;
    switch (action) {
      case "WAIT": {
        if (this.engagement) return this.pushFeed("Em combate: agora não dá para esperar.");
        this.passTime(1);
        break;
      }
      case "LADDER":
      case "RAM":
        this.pushFeed(s.siegeBuild(action));
        break;
      case "DEMAND":
        this.pushFeed(s.demandSurrender());
        break;
      case "LIFT":
        s.liftSiege();
        this.truce = { townId: t.id, until: this.time.now + 90000 };
        this.pushFeed(`O cerco a ${t.name} foi levantado.`);
        break;
      case "PLANT_LADDER":
        this.plantLadder();
        break;
      case "SEND_RAM":
        this.sendRam();
        break;
      case "ASSAULT": {
        const w = this.works;
        if (!w) return;
        let any = false;
        while (useGameStore.getState().useLadder()) {
          if (w.addLadder(this.commander)) any = true;
        }
        if (useGameStore.getState().useRam()) {
          const g = w.nearestGate(this.commander);
          if (g) {
            w.spawnRam(this.armyNav.nearestOpen(g.gate.wait, 400) ?? g.gate.wait);
            any = true;
          }
        }
        this.pushFeed(any ? "Ao assalto! Escadas nos muros, aríete no portão!" : "Sem escadas nem aríete, o assalto não tem por onde entrar.");
        break;
      }
    }
    this.publishHud();
  },

  /** Quem está mais perto da muralha entre as tropas escolhidas (sem escolha, entre todas). */
  troopAtWall(this: WorldScene, layout: TownLayout): Battalion | null {
    const picked = this.battalions.filter((b) => b.selected && !b.isDestroyed);
    const pool = picked.length > 0 ? picked : this.battalions.filter((b) => !b.isDestroyed);
    let best: Battalion | null = null;
    let bestDist: number = SIEGE.LADDER_REACH;
    for (const b of pool) {
      const d = rectDistance(layout.bounds, b.center);
      if (d <= bestDist) {
        best = b;
        bestDist = d;
      }
    }
    return best;
  },

  /** Batalha de cerco: a tropa ao pé da muralha ergue uma escada ali mesmo. */
  plantLadder(this: WorldScene): void {
    const w = this.works;
    if (!w) return;
    const troop = this.troopAtWall(w.layout);
    if (!troop) return this.pushFeed("Leve uma tropa ao pé da muralha para erguer a escada.");
    const store = useGameStore.getState();
    if (!store.siege?.ladders) return this.pushFeed("Não há mais escadas.");
    if (!w.addLadder(troop.center)) return this.pushFeed("Não há onde apoiar outra escada neste trecho.");
    store.useLadder();
    this.pushFeed(`${troop.name} ergue a escada!`);
  },

  /** Batalha de cerco: o aríete sai de perto da tropa mais próxima do portão, e leva tempo para chegar. */
  sendRam(this: WorldScene): void {
    const w = this.works;
    if (!w) return;
    if (w.ram?.isAlive) return this.pushFeed("O aríete já está a caminho.");
    const standing = this.battalions.filter((b) => !b.isDestroyed);
    const from = nearest(standing.map((b) => b.center), this.selectionCenter()) ?? this.commander;
    const gate = w.nearestGate(from);
    if (!gate || !useGameStore.getState().useRam()) return;
    // À frente da tropa, para não sair de dentro dela
    const ahead = angleTo(from, gate.gate.outside);
    const spot = { x: from.x + Math.cos(ahead) * 170, y: from.y + Math.sin(ahead) * 170 };
    w.spawnRam(this.nav.nearestOpen(spot, 300) ?? spot);
    this.pushFeed(`O aríete segue para o portão ${SIDE_WORD[gate.gate.side]}.`);
  },

  /** Onde estão as tropas escolhidas (sem escolha, o Comandante). */
  selectionCenter(this: WorldScene): Point {
    const picked = this.battalions.filter((b) => b.selected && !b.isDestroyed);
    return picked.length > 0 ? centroid(picked.map((b) => b.center)) : this.commander;
  },

  /** Comandante preso: o mapa sabe onde ele está, e às vezes ele foge sozinho. */
  captivityTick(this: WorldScene): void {
    const s = useGameStore.getState();
    const c = s.captivity;
    if (!c) return;
    const band = this.warbands.bands.find((b) => b.id === c.bandId);
    if (band) band.lastSeen = { x: band.anchor.x, y: band.anchor.y, day: s.day };
    // Levaram para trás de um muro: agora, só com ouro
    else if (c.bandId) useGameStore.setState({ captivity: { ...c, bandId: null } });
  },

  /** Um dia de cerco: comida, madeira, fome, surtida, socorro. */
  siegeTick(this: WorldScene): void {
    const s = useGameStore.getState();
    const c = s.siege;
    const t = c ? s.settlements.find((x) => x.id === c.settlementId) : undefined;
    if (!c?.walled || !t) return;
    const soldiers = this.battalions.reduce((n, b) => n + b.aliveCount, 0);
    const r = s.siegeDay(soldiers);
    if (r.surrendered) {
      this.pushFeed(`${t.name} não aguentou a fome e abriu os portões.`);
      s.conquerSettlement(t.id);
      return;
    }
    if (r.sally && this.works) {
      this.works.sally(SIEGE.SALLY_MS);
      this.pushFeed(`Surtida! A guarnição de ${t.name} saiu para queimar as obras.`);
    }
    if (c.reliefDay !== undefined && s.day >= c.reliefDay) {
      useGameStore.setState((st) => (st.siege ? { siege: { ...st.siege, reliefDay: undefined } } : {}));
      useGameStore.getState().callRelief(t.id);
    }
  },

  /** Atacamos um soldado de um povoado em paz: é atacar o povoado (guerra e cerco). */
  provokeTown(this: WorldScene, id: string): void {
    const store = useGameStore.getState();
    const t = store.settlements.find((x) => x.id === id);
    if (!t || store.siege) return;
    this.pushFeed(`Atacamos a guarnição de ${t.name}!`);
    store.besiege(id);
  },

  /** Guarnições de verdade perto do bando (soldados nos acampamentos, nas portas e nas ruas). */
  updateGarrisonUnits(this: WorldScene): void {
    const s = useGameStore.getState();
    const presence = this.presence();
    const threats = this.warbands.bands.filter((b) => isRaiderKind(b.kind)).map((b) => b.anchor);
    this.garrisons.update({
      settlements: s.settlements,
      layoutOf: (id) => this.settlementLayer.layoutOf(id),
      garrisonOf: (id) => useGameStore.getState().settlements.find((t) => t.id === id)?.garrison ?? 0,
      presence,
      hostile: (t) => this.gateRules.some((r) => r.id === t.id && r.visitor),
      // Na batalha de cerco quem luta são as forças do cenário: o povoado não põe gente em campo
      siegeId: this.run ? null : this.siegeId,
      walled: !!s.siege?.walled && !this.works?.open,
      sallying: !!this.works && this.time.now < this.works.sallyUntil,
      hour: hourOf(s.dayProgress),
      danger: (id) => {
        const t = s.settlements.find((x) => x.id === id);
        return !!t && threats.some((p) => distance(p, t) < 2600);
      },
      color: (owner) => (isCalamityOwner(owner) ? undefined : ownerColor(this.world, s.calamities, owner)),
      calamityKind: (owner) => s.calamities.find((c) => c.id === owner)?.kind,
    });
  },

  /** Portões fechados para quem tem esse acesso, neste ponto (null = pode passar). */
  closedRule(this: WorldScene, access: TownAccess, p: Point, pad = 0): GateRule | null {
    if (access === "ANY") return null;
    for (const r of this.gateRules) if ((access === "ARMY" ? r.army : r.visitor) && inRect(r.bounds, p, pad)) return r;
    return null;
  },

  /** Quem pode passar por quais portões (muda com o dono, a guerra e o cerco). */
  updateGateRules(this: WorldScene): void {
    const s = useGameStore.getState();
    const before = new Map(this.gateRules.map((r) => [r.id, r.army]));
    const rules: GateRule[] = [];
    for (const t of s.settlements) {
      const layout = this.settlementLayer.layoutOf(t.id);
      if (!layout || t.owner === "RUINED") continue;
      // Escada ou portão caído: a tropa entra por ali
      const army = t.owner !== "PLAYER" && !(this.works?.open && this.siegeId === t.id);
      const war = isCalamityOwner(t.owner) || s.factions.some((f) => f.id === t.owner && f.atWar) || s.siege?.settlementId === t.id || (!!t.besiegedBy && !s.factions.some((f) => f.id === t.besiegedBy && f.atWar && t.owner === "PLAYER"));
      rules.push({ id: t.id, name: t.name, bounds: layout.bounds, army, visitor: army && war });
    }
    this.gateRules = rules;
    // Povoado que passou a barrar (ou a deixar entrar) o exército: as rotas das tropas em volta são refeitas
    const changed = new Set<string>();
    for (const r of rules) if (before.get(r.id) !== r.army) changed.add(r.id);
    for (const [id, army] of before) if (army && !rules.some((r) => r.id === id)) changed.add(id);
    for (const id of changed) {
      const l = this.settlementLayer.layoutOf(id);
      if (l) this.armyNav.invalidate({ x: l.cx, y: l.cy }, Math.max(l.bounds.w, l.bounds.h) / 2 + 200);
    }
  },

  /** Onde o exército espera diante do portão de um povoado mais perto de `near` (virado para ele). */
  gateWait(this: WorldScene, townId: string, near: Point): { point: Point; facing: number } {
    const layout = this.settlementLayer.layoutOf(townId) as TownLayout;
    const gate = nearestGate(layout, near);
    const point = this.armyNav.nearestOpen(gate.wait, 600) ?? gate.wait;
    return { point, facing: Math.atan2(gate.y - point.y, gate.x - point.x) };
  },

  /** O Comandante entrou num povoado que barra o exército: a tropa que o segue espera no portão. */
  updateTownVisit(this: WorldScene): void {
    const rule = this.closedRule("ARMY", this.commander);
    if (!rule) {
      if (this.visit) {
        this.visit = null;
        for (const b of this.battalions) b.followHold = null;
      }
      return;
    }
    if (this.visit?.townId !== rule.id) {
      this.visit = { townId: rule.id, hold: this.gateWait(rule.id, this.commander) };
      if (this.battalions.some((b) => b.isFollowing)) this.pushFeed(`${rule.name}: os guardas deixam o Comandante entrar; o exército espera no portão.`);
    }
    for (const b of this.battalions) b.followHold = this.visit.hold;
  },

  /**
   * Guarnições: em guerra (ou sob calamidade), o exército perto dos muros faz a guarnição sair
   * dos acampamentos para lutar; o bando que se afasta de um cerco o levanta.
   */
  updateGarrisons(this: WorldScene, time: number): void {
    if (this.run || time - this.lastGarrisonAt < 500) return;
    this.lastGarrisonAt = time;
    const store = useGameStore.getState();
    const army: Point[] = [this.commander];
    for (const b of this.battalions) if (!b.isDestroyed) army.push(b.center);
    if (store.siege) {
      const t = store.settlements.find((x) => x.id === store.siege?.settlementId);
      const layout = t ? this.settlementLayer.layoutOf(t.id) : undefined;
      if (t && layout && !this.engagement && army.every((p) => rectDistance(layout.bounds, p) > REALM.SIEGE_LEAVE_RADIUS)) {
        store.liftSiege();
        this.pushFeed(`O cerco a ${t.name} foi levantado: a guarnição volta aos acampamentos.`);
      }
      return;
    }
    for (const r of this.gateRules) {
      if (!r.visitor || army.every((p) => rectDistance(r.bounds, p) > REALM.SALLY_RADIUS)) continue;
      if (this.truce?.townId === r.id && time < this.truce.until) continue;
      if (store.garrisonSally(r.id, this.battalions.reduce((n, b) => n + b.aliveCount, 0))) break;
    }
  },
};

export type SiegeMethods = typeof siegeMethods;
