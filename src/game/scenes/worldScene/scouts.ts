import { Battalion } from "../../entities/Battalion";
import { Enemy } from "../../entities/Enemy";
import { Scout, type ScoutHazard, type ScoutOrder, type ScoutReport, type ScoutWorld } from "../../entities/Scout";
import { Harpy, type HarpyEvent, type HarpyWorld } from "../../entities/Harpy";
import { Unit } from "../../entities/Unit";
import { weatherAt } from "../../../utils/season";
import { bandSize } from "../../systems/Warbands";
import { geoOf } from "../../worldgen/geoMap";
import { seedFromText } from "../../worldgen/rng";
import type { FieldSave } from "../../save/saveGame";
import { useGameStore } from "../../../store/useGameStore";
import { SUPPORT } from "../../../utils/constants";
import { centroid, distance, type Point } from "../../../utils/math";
import { SCOUT_ORDER_LABEL, SCOUT_BASIC_ORDERS, SIDE_WORD, type OrderChannel } from "./shared";
import type { WorldScene } from "../WorldScene";

/**
 * Os batedores longe do bando e as harpias (Marco 16).
 * Uma parte da `WorldScene`: os métodos entram no protótipo dela (ver o fim de `WorldScene.ts`).
 */
export const scoutsMethods = {
  // --- Batedores longe do bando e harpias (Marco 16) ---

  scoutWorld(this: WorldScene, active: readonly Enemy[]): ScoutWorld {
    return {
      commander: this.commander,
      threats: active,
      time: this.time.now,
      day: useGameStore.getState().day,
      bandAt: (id) => this.warbands.bands.find((b) => b.id === id)?.anchor ?? null,
      isExplored: (p) => this.fog.isExplored(p),
      isOpen: (p) => this.nav.isOpen(p),
      lookout: (p) => this.lookoutNear(p),
    };
  },

  /** Colina perto do ponto (enxerga mais longe); na falta dela, mata (esconde). */
  lookoutNear(this: WorldScene, p: Point): Point | null {
    const terrain = Unit.terrain;
    if (!terrain) return null;
    let forest: Point | null = null;
    for (const r of [0, 240, 480]) {
      for (let i = 0; i < (r === 0 ? 1 : 8); i++) {
        const q = { x: p.x + Math.cos((i * Math.PI) / 4) * r, y: p.y + Math.sin((i * Math.PI) / 4) * r };
        const t = terrain.typeAt(q.x, q.y);
        if (t === "HILL") return q;
        if (t === "FOREST") forest ??= q;
      }
    }
    return forest;
  },

  /** Ordem para um batedor: fora de contato, só a harpia chega até ele. */
  orderScout(this: WorldScene, s: Scout, order: ScoutOrder): boolean {
    const label = SCOUT_ORDER_LABEL[order.kind];
    const channel: OrderChannel = (SCOUT_BASIC_ORDERS as readonly string[]).includes(order.kind) ? "BASIC" : "COMPLEX";
    if (!s.inContact && !this.reachOf(s, channel)) {
      const h = this.harpyOf(s);
      if (!h) {
        this.pushFeed(`${s.rider.name} está fora de contato: só recebe ordens quando voltar.`);
        return false;
      }
      h.orders = [...h.orders.filter((o) => !("order" in o)), { label, order }];
      this.pushFeed(`"${label}" para ${s.rider.name}: vai na próxima viagem da harpia.`);
      return true;
    }
    return this.dispatch(s, label, () => s.setOrder(order), channel);
  },

  /** Inimigo avistou um batedor: um ou dois vão atrás, e o bando fica sabendo que há gente por perto. */
  onScoutSpotted(this: WorldScene, e: Enemy, scout: Unit): void {
    const o = e.owner;
    const key = o ? `${o.kind}:${"id" in o ? o.id : "contractId" in o ? o.contractId : "settlementId" in o ? o.settlementId : "pack" in o ? o.pack : ""}` : `solo:${e.x | 0}`;
    const now = this.time.now;
    if (now - (this.spotAt.get(key) ?? -Infinity) < 4000) return;
    this.spotAt.set(key, now);
    const group = this.enemies.filter((x) => x.isAlive && !x.dormant && x.hostile && !x.target && (o ? x.owner?.kind === o.kind && distance(x, e) < 700 : x === e));
    group.sort((a, b) => distance(a, scout) - distance(b, scout));
    for (const h of group.slice(0, 2)) {
      h.huntsScouts = true;
      h.target = scout;
    }
    if (o?.kind === "WARBAND") {
      const band = this.warbands.bands.find((b) => b.id === o.id);
      if (band) band.alert = Math.max(band.alert ?? 0, 2);
    }
    if (scout instanceof Scout && scout.inContact) this.pushFeed(`${scout.rider.name} foi avistado! ${e.kind === "WOLF" ? "Os lobos vão" : "O inimigo manda gente"} atrás dele.`);
  },

  /** Entrou ou saiu do alcance do Comandante: ao voltar, conta o que viu. */
  updateScoutContact(this: WorldScene, time: number): void {
    for (const s of this.scouts) {
      if (!s.isAlive) continue;
      const live = distance(s, this.commander) <= SUPPORT.SCOUT.LIVE_RANGE;
      if (live) s.lastContact = { x: s.x, y: s.y };
      if (live !== s.inContact) {
        s.inContact = live;
        s.setVisible(live);
        if (live) {
          if (s.hasNews) this.deliverReport(s, s.takeReport(), "RIDE");
        } else {
          s.awaySince = time;
        }
      }
      if (live && s.mode === "RETURN") {
        s.setOrder({ kind: "VANGUARD" });
        useGameStore.getState().scoutReturned(s.rider.id);
      }
    }
  },

  /** O que cada batedor fora de contato vê vai para o relatório dele; ninguém mais fica sabendo. */
  recordScoutViews(this: WorldScene): void {
    const s0 = useGameStore.getState();
    for (const s of this.scouts) {
      if (!s.isAlive) continue;
      // Ninho à vista
      for (const n of this.nests) {
        if (s0.nestsFound.includes(n.id) || distance(n, s) > SUPPORT.HARPY.NEST_REACH) continue;
        if (s.inContact) s0.nestFound(n.id, s.rider.name);
        else s.noteNest(n.id);
      }
      // Um batedor perto dos muros conta a guarnição e acha o portão mal cuidado
      for (const t of s0.settlements) {
        if (t.owner === "PLAYER" || t.owner === "RUINED" || distance(t, s) > s.vision + 400) continue;
        const had = useGameStore.getState().townIntel[t.id];
        if (had && s0.day - had.day < 2) continue;
        const layout = this.settlementLayer.layoutOf(t.id);
        if (layout) useGameStore.getState().noteTownIntel(t.id, SIDE_WORD[layout.gates[Math.abs(seedFromText(t.id)) % Math.max(1, layout.gates.length)].side]);
      }
      if (s.inContact) continue;
      s.noteView();
      for (const band of this.warbands.bands) {
        if (!band.materialized) continue;
        const seen = band.members.filter((m) => m.isAlive && s.notices(m));
        if (seen.length === 0) continue;
        const c = centroid(seen);
        const hostile = this.bandHostile(band);
        s.noteSighting({ bandId: band.id, name: band.name, x: c.x, y: c.y, day: s0.day, count: s.countOf(bandSize(band)), hostile });
        if (hostile && bandSize(band) >= SUPPORT.HARPY.ALERT_SIZE && !s.alerted.has(band.id)) {
          s.alerted.add(band.id);
          s.urgent = true;
        }
      }
    }
  },

  /** O relatório chegou (a cavalo ou na garra da harpia): a névoa abre e os bandos entram no mapa, com a data. */
  deliverReport(this: WorldScene, s: Scout, report: ScoutReport, via: "RIDE" | "HARPY"): void {
    const store = useGameStore.getState();
    for (const p of report.views) this.fog.revealExplored(p, report.radius);
    const news: string[] = [];
    for (const v of report.sightings) {
      const band = this.warbands.bands.find((b) => b.id === v.bandId);
      if (band) {
        if (!band.lastSeen || band.lastSeen.day <= v.day) band.lastSeen = { x: v.x, y: v.y, day: v.day };
        band.reportedCount = v.count;
        band.spotted = true;
      }
      const ago = store.day - v.day;
      news.push(`${v.name} (uns ${v.count}) perto de ${this.placeName(v)}${ago > 0 ? `, há ${ago} dia${ago > 1 ? "s" : ""}` : ""}`);
      if (v.hostile) store.chronicle(`${s.rider.name} avistou ${v.name} perto de ${this.placeName(v)} (uns ${v.count}).`, "bad");
    }
    for (const id of report.nests) store.nestFound(id, s.rider.name);
    if (news.length === 0 && report.nests.length === 0 && report.views.length < 3) return;
    const who = via === "HARPY" ? `A harpia de ${s.rider.name} chegou` : `${s.rider.name} voltou`;
    this.pushFeed(`${who}: ${news.length > 0 ? news.slice(0, 3).join("; ") : "nada de hostil na região"}.`);
    this.publishHud();
  },

  /** Harpias em campo = as dos batedores vivos, já treinadas. */
  syncHarpies(this: WorldScene): void {
    const s = useGameStore.getState();
    this.harpies = this.harpies.filter((h) => {
      const data = s.scouts.find((x) => x.id === h.scout.rider.id);
      if (data?.harpy && data.harpy.readyDay <= s.day && h.scout.isAlive) return true;
      h.destroy();
      return false;
    });
    for (const scout of this.scouts) {
      const data = scout.rider.harpy;
      if (!data || data.readyDay > s.day || !scout.isAlive || this.harpyOf(scout)) continue;
      this.harpies.push(new Harpy(this, scout, this.time.now));
    }
  },

  harpyOf(this: WorldScene, s: Scout): Harpy | null {
    return this.harpies.find((h) => h.scout === s) ?? null;
  },

  /** Dá para a ave voar aqui agora? Noite fechada e tempestade a seguram no chão. */
  canFly(this: WorldScene, p: Point): boolean {
    if (Unit.darkness > SUPPORT.HARPY.DARK_LIMIT) return false;
    return weatherAt(this.world.seed, useGameStore.getState().day, p, geoOf(this.world.geo)) !== "STORM";
  },

  /** Solta a ave com o que o batedor tem. Sem novidade, ela vai assim mesmo: as ordens voltam com ela. */
  sendHarpy(this: WorldScene, h: Harpy, manual = false): void {
    const s = h.scout;
    const refuse = (why: string) => {
      if (manual) this.pushFeed(why);
    };
    if (h.state !== "PERCHED") return refuse(`A harpia de ${s.rider.name} está fora.`);
    if (!s.isAlive || s.inContact) return refuse(`${s.rider.name} está perto: conta pessoalmente.`);
    if (distance(s, this.commander) > SUPPORT.HARPY.RANGE) return refuse(`Longe demais para a harpia de ${s.rider.name}.`);
    if (!this.canFly(s)) return refuse("Noite fechada ou tempestade: a harpia não voa.");
    h.launch(s.hasNews ? s.takeReport() : null, this.time.now);
    s.urgent = false;
  },

  updateHarpies(this: WorldScene, dt: number, time: number, active: readonly Enemy[]): void {
    if (this.harpies.length === 0) return;
    const world: HarpyWorld = {
      commander: this.commander,
      archers: active.filter((e) => e.ranged && e.hostile),
      canFly: (p) => this.canFly(p),
      canSee: (p) => this.fog.canSee(p),
      time,
    };
    for (const h of [...this.harpies]) {
      if (h.state === "PERCHED" && h.scout.isAlive && !h.scout.inContact && (h.scout.urgent || time - h.lastFlightAt >= SUPPORT.HARPY.REPORT_EVERY_MS)) this.sendHarpy(h);
      const ev = h.update(dt, world);
      if (ev) this.onHarpyEvent(h, ev);
    }
  },

  onHarpyEvent(this: WorldScene, h: Harpy, ev: HarpyEvent): void {
    const s = h.scout;
    if (ev.type === "AT_COMMANDER") {
      if (ev.report) this.deliverReport(s, ev.report, "HARPY");
      return;
    }
    if (ev.type === "SHOT") {
      this.pushFeed(`A harpia ${s.rider.harpy?.name ?? ""} de ${s.rider.name} foi derrubada por uma flecha${ev.report ? ": o relatório se perdeu" : ""}!`);
      useGameStore.getState().harpyLost(s.rider.id);
      h.destroy();
      this.harpies = this.harpies.filter((x) => x !== h);
      return;
    }
    for (const o of ev.orders) {
      if ("order" in o) {
        s.setOrder(o.order);
        this.pushFeed(`${s.rider.name} recebeu "${o.label}" pela harpia.`);
      } else {
        s.relay = { to: o.relay.to, apply: o.relay.apply, label: o.label };
      }
    }
  },

  /** Batedor com harpia perto de um batalhão destacado, longe de todo o resto. */
  relayFor(this: WorldScene, b: Battalion): Harpy | null {
    const c = b.center;
    if (distance(c, this.commander) < SUPPORT.HARPY.RELAY_MIN_DISTANCE) return null;
    let best: Harpy | null = null;
    let bestDist: number = SUPPORT.HARPY.RELAY_RADIUS;
    for (const h of this.harpies) {
      if (!h.scout.isAlive || h.scout.inContact) continue;
      const d = distance(h.scout, c);
      if (d <= bestDist) {
        best = h;
        bestDist = d;
      }
    }
    return best;
  },

  /** Dias que passam de uma vez: os batedores em missão seguem como dados, e as harpias também. */
  advanceScouts(this: WorldScene, days: number): void {
    if (this.scouts.length === 0) return;
    const hazards: ScoutHazard[] = this.warbands.bands
      .filter((b) => this.bandHostile(b))
      .map((b) => ({ x: b.anchor.x, y: b.anchor.y, size: bandSize(b), bandId: b.id, name: b.name }));
    const world = this.scoutWorld([]);
    for (const s of this.scouts) {
      const before = s.isAlive;
      const r = s.advance(days, world, hazards);
      if (before && r === "HURT") this.pushFeed(`${s.rider.name} foi surpreendido em campo e volta ferido.`);
    }
    for (const h of this.harpies) {
      const s = h.scout;
      if (!s.isAlive || s.inContact) continue;
      h.idleDays += days;
      if (h.idleDays < 0.3 || distance(s, this.commander) > SUPPORT.HARPY.RANGE) continue;
      h.idleDays = 0;
      if (s.hasNews) this.deliverReport(s, s.takeReport(), "HARPY");
      for (const o of h.orders) if ("order" in o) s.setOrder(o.order);
      h.orders = h.orders.filter((o) => !("order" in o));
    }
  },

  /** Batedor para o save: a ave que estava no ar devolve o que levava (ela volta pousada). */
  scoutSave(this: WorldScene, s: Scout): FieldSave["scouts"][number] {
    const h = this.harpyOf(s);
    if (h?.cargo) {
      s.restoreReport(h.cargo);
      h.cargo = null;
    }
    return { id: s.rider.id, x: s.x, y: s.y, hp: s.hp, ...s.serialize() };
  },

  scoutAt(this: WorldScene, x: number, y: number): Scout | null {
    return this.scouts.find((s) => s.isAlive && distance(s, { x, y }) <= s.radius + 10) ?? null;
  },
};

export type ScoutsMethods = typeof scoutsMethods;
