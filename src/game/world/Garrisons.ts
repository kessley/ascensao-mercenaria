import type { Enemy } from "../entities/Enemy";
import { isCalamityOwner, type Settlement } from "../sim/realm";
import { garrisonPosts, streetPath, wallWalk, type GarrisonPost, type TownLayout } from "./townLayout";
import { REALM, type EnemyKind } from "../../utils/constants";
import { distance, type Point } from "../../utils/math";

/** Soldados da guarnição postos no mapa por povoado (um por homem até aqui). */
const MAX_GARRISON = 30;
/** O povoado a esta distância (dos muros) de alguém do bando: a guarnição está no mapa. */
const MATERIALIZE = 2600;
/** Mais longe que isso de todos (e ninguém lutando): volta a ser só um número. */
const DEMATERIALIZE = 3600;

interface Guard {
  unit: Enemy;
  post: GarrisonPost;
  slot: number;
  /** Ronda: os próximos cruzamentos. */
  patrol: Point[];
  waitUntil: number;
}

interface TownGarrison {
  owner: string;
  guards: Guard[];
  /** Moradores armados durante um cerco (completam a defesa abaixo do mínimo). */
  militia: Enemy[];
  militiaRaised: boolean;
  provoked: boolean;
}

/** O que as guarnições precisam saber do mundo a cada quadro. */
export interface GarrisonContext {
  settlements: readonly Settlement[];
  layoutOf: (id: string) => TownLayout | undefined;
  /** Garrison atual no store (lido de novo depois das baixas do quadro). */
  garrisonOf: (id: string) => number;
  /** Onde está o bando do jogador. */
  presence: readonly Point[];
  /** A guarnição luta contra o bando (guerra, calamidade, cerco)? */
  hostile: (t: Settlement) => boolean;
  siegeId: string | null;
  hour: number;
  /** Perigo perto (bando hostil): a tropa forma atrás do portão. */
  danger: (id: string) => boolean;
  color: (owner: string) => number | undefined;
  calamityKind: (owner: string) => "NECROMANCER" | "ORC_HORDE" | undefined;
}

const rectDistance = (r: { x: number; y: number; w: number; h: number }, p: Point) =>
  Math.hypot(Math.max(r.x - p.x, 0, p.x - r.x - r.w), Math.max(r.y - p.y, 0, p.y - r.y - r.h));

/**
 * Guarnições de verdade (Marco 12): perto do bando, cada homem da guarnição de um povoado é
 * uma unidade no mapa, morando no acampamento por dentro dos portões.
 * - Sentinelas no lado de fora de cada portão; um vigia na fogueira; os outros se revezam
 *   entre o acampamento (treino de manhã, dados e conversa, sono nas barracas à noite) e a
 *   ronda pelas ruas.
 * - Em paz, não atacam o bando, mas lutam contra goblins e hordas que cheguem (são do lado
 *   do povoado); bater num deles é atacar o povoado. Em guerra, sob calamidade ou num cerco,
 *   lutam contra o bando; num cerco, moradores armados completam a defesa.
 * - Cada soldado que morre sai da guarnição no store; longe do bando, a guarnição volta a ser
 *   um número (e reaparece nos postos quando o bando volta).
 */
export class GarrisonManager {
  private towns = new Map<string, TownGarrison>();
  private ctx: GarrisonContext | null = null;

  constructor(
    private readonly spawn: (x: number, y: number, kind: EnemyKind, color?: number) => Enemy,
    private readonly despawn: (e: Enemy) => void,
    private readonly onLosses: (townId: string, dead: number) => void,
    private readonly onProvoked: (townId: string) => void,
  ) {}

  /** Soldados (e milicianos) de um povoado no mapa agora. */
  units(townId: string): Enemy[] {
    const g = this.towns.get(townId);
    return g ? [...g.guards.map((x) => x.unit), ...g.militia] : [];
  }

  /** Cerco: a guarnição está no mapa, a milícia já saiu e todos caíram. */
  defeated(townId: string): boolean {
    const g = this.towns.get(townId);
    return !!g && g.militiaRaised && g.guards.every((x) => !x.unit.isAlive) && g.militia.every((m) => !m.isAlive);
  }

  /** Tochas à noite: sentinelas e rondas. */
  lights(): Point[] {
    const out: Point[] = [];
    for (const g of this.towns.values()) {
      for (const x of g.guards) if (x.unit.isAlive && (x.post.role === "SENTRY" || x.post.role === "PATROL" || x.post.role === "WATCH" || x.post.role === "WALL")) out.push({ x: x.unit.x, y: x.unit.y });
    }
    return out;
  }

  /** Papel de cada soldado no mapa (para os testes). */
  roles(townId: string): Record<string, number> {
    const out: Record<string, number> = {};
    for (const x of this.towns.get(townId)?.guards ?? []) if (x.unit.isAlive) out[x.post.role] = (out[x.post.role] ?? 0) + 1;
    return out;
  }

  clearAll(): void {
    for (const id of [...this.towns.keys()]) this.clear(id);
  }

  update(ctx: GarrisonContext): void {
    this.ctx = ctx;
    const seen = new Set<string>();
    for (const t of ctx.settlements) {
      seen.add(t.id);
      const layout = ctx.layoutOf(t.id);
      let g = this.towns.get(t.id);
      const gone = !layout || t.owner === "RUINED" || layout.camps.length === 0;
      const near = !gone && ctx.presence.some((p) => rectDistance(layout.bounds, p) < MATERIALIZE);
      const far = gone || ctx.presence.every((p) => rectDistance(layout.bounds, p) > DEMATERIALIZE);
      if (g && (gone || g.owner !== t.owner || (far && !this.fighting(g)))) {
        this.clear(t.id);
        g = undefined;
      }
      if (!g && near) {
        g = { owner: t.owner, guards: [], militia: [], militiaRaised: false, provoked: false };
        this.towns.set(t.id, g);
      }
      if (!g || !layout) continue;

      // Quem caiu sai da guarnição (os milicianos, não: são moradores)
      const dead = g.guards.filter((x) => !x.unit.isAlive).length;
      if (dead > 0) {
        g.guards = g.guards.filter((x) => x.unit.isAlive);
        this.onLosses(t.id, dead);
      }
      g.militia = g.militia.filter((m) => m.isAlive);

      // Bater num soldado de um povoado em paz é atacá-lo
      const hostile = t.owner !== "PLAYER" && ctx.hostile(t);
      if (!hostile && !g.provoked && g.guards.some((x) => x.unit.provoked)) {
        g.provoked = true;
        this.onProvoked(t.id);
      }

      this.syncCount(t, layout, g, ctx);
      const calamity = isCalamityOwner(t.owner);
      for (const x of g.guards) {
        x.unit.hostile = hostile;
        if (hostile) x.unit.provoked = false;
      }

      // Cerco: moradores armados completam a defesa até o mínimo
      if (ctx.siegeId === t.id && !g.militiaRaised) {
        g.militiaRaised = true;
        const missing = Math.max(0, REALM.SIEGE_MIN_DEFENDERS - g.guards.length);
        for (let k = 0; k < missing; k++) {
          const gate = layout.gates[k % layout.gates.length];
          const e = this.spawn(gate.inside.x + (Math.random() - 0.5) * 120, gate.inside.y + (Math.random() - 0.5) * 60, this.kindFor(t, 99, "CAMP"), ctx.color(t.owner));
          e.owner = { kind: "GARRISON", settlementId: t.id, militia: true };
          e.side = calamity ? "WILD" : "TOWN";
          e.hostile = true;
          g.militia.push(e);
        }
      } else if (ctx.siegeId !== t.id && g.militiaRaised) {
        for (const m of g.militia) this.despawn(m);
        g.militia = [];
        g.militiaRaised = false;
      }
    }
    for (const id of [...this.towns.keys()]) if (!seen.has(id)) this.clear(id);
  }

  private fighting(g: TownGarrison): boolean {
    return g.guards.some((x) => x.unit.isAlive && x.unit.target?.isAlive) || g.militia.some((m) => m.isAlive && m.target?.isAlive);
  }

  private clear(id: string): void {
    const g = this.towns.get(id);
    if (!g) return;
    for (const x of g.guards) this.despawn(x.unit);
    for (const m of g.militia) this.despawn(m);
    this.towns.delete(id);
  }

  /** Tantos soldados no mapa quanto a guarnição (quem chega vem das barracas; quem sobra sai). */
  private syncCount(t: Settlement, layout: TownLayout, g: TownGarrison, ctx: GarrisonContext): void {
    const want = Math.min(MAX_GARRISON, ctx.garrisonOf(t.id));
    const extra = g.guards.filter((x) => x.slot >= want);
    if (extra.length > 0) {
      for (const x of extra) this.despawn(x.unit);
      g.guards = g.guards.filter((x) => x.slot < want);
    }
    if (g.guards.length >= want) return;
    const fresh = g.guards.length === 0;
    const have = new Set(g.guards.map((x) => x.slot));
    const posts = garrisonPosts(layout, want);
    const friendly = t.owner === "PLAYER";
    const color = ctx.color(t.owner);
    for (let k = 0; k < want; k++) {
      if (have.has(k) || !posts[k]) continue;
      const post = posts[k];
      // Guarnição que acaba de aparecer: cada um no seu posto; reforço: sai de uma barraca
      const camp = layout.camps[post.camp];
      const tent = camp.tents[k % camp.tents.length];
      const from = fresh ? post.at : { x: tent.x + tent.w / 2, y: tent.y + tent.h / 2 };
      const e = this.spawn(from.x, from.y, this.kindFor(t, k, post.role), color);
      e.owner = { kind: "GARRISON", settlementId: t.id };
      e.side = isCalamityOwner(t.owner) ? "WILD" : "TOWN";
      if (friendly) e.setFriendly(true);
      e.home = { ...post.at };
      const guard: Guard = { unit: e, post, slot: k, patrol: [], waitUntil: 0 };
      e.routine = (dt) => this.drive(guard, t.id, dt);
      g.guards.push(guard);
    }
  }

  private kindFor(t: Settlement, k: number, role: GarrisonPost["role"]): EnemyKind {
    if (isCalamityOwner(t.owner)) return this.ctx?.calamityKind(t.owner) === "NECROMANCER" ? "SKELETON" : "ORC";
    if (role === "SENTRY") return "SOLDIER";
    return k % 3 === 2 ? "CROSSBOW" : "SOLDIER";
  }

  /** Rotina de um soldado sem inimigo à vista. */
  private drive(guard: Guard, townId: string, dt: number): void {
    const ctx = this.ctx;
    const e = guard.unit;
    const layout = ctx?.layoutOf(townId);
    const camp = layout?.camps[guard.post.camp];
    if (!ctx || !layout || !camp) return;
    const now = e.scene.time.now;
    const night = ctx.hour >= 21 || ctx.hour < 5;
    const alarm = ctx.danger(townId) || e.hostile;
    const walk = (p: Point, mult: number) => {
      e.home = { x: p.x, y: p.y };
      const arrived = e.moveTowards(p.x, p.y, dt, mult);
      e.unitState = arrived ? "IDLE" : "MOVING";
      return arrived;
    };
    e.setPose("STAND");
    const role = guard.post.role;
    const muster = () => camp.muster[(guard.post.rank + guard.slot) % camp.muster.length];

    if (role === "SENTRY") {
      if (walk(guard.post.at, 0.6)) {
        const gate = layout.gates[camp.gate];
        e.setFacing(Math.atan2(gate.outside.y - gate.y, gate.outside.x - gate.x));
      }
      return;
    }
    if (role === "WATCH") {
      if (walk(alarm ? muster() : guard.post.at, alarm ? 1 : 0.5)) e.setFacing(Math.atan2(camp.fire.y - e.y, camp.fire.x - e.x));
      return;
    }
    if (alarm) {
      // Perigo perto: a tropa larga tudo e forma atrás do portão
      guard.patrol = [];
      walk(muster(), 1);
      return;
    }
    if (role === "WALL") {
      // Guarda na muralha: anda o caminho de ronda junto ao muro, de canto a canto, olhando para fora
      const corners = wallWalk(layout);
      if (guard.patrol.length === 0) {
        const at = corners.reduce((best, p, k) => (distance(p, e) < distance(corners[best], e) ? k : best), 0);
        const dir = guard.slot % 2 === 0 ? 1 : 3;
        guard.patrol = [corners[(at + dir) % 4]];
      }
      if (walk(guard.patrol[0], 0.4)) {
        guard.patrol = [];
        guard.waitUntil = now + 2000;
      } else {
        // Olha para fora do povoado enquanto anda
        const out = Math.atan2(e.y - layout.cy, e.x - layout.cx);
        e.setFacing(out + Math.sin(now / 900 + guard.slot) * 0.6);
      }
      return;
    }
    if (role === "PATROL") {
      // Ronda pelas ruas, de cruzamento em cruzamento (de noite também, com tocha)
      if (guard.patrol.length === 0) {
        if (now < guard.waitUntil) {
          e.unitState = "IDLE";
          return;
        }
        const to = layout.nodes[Math.floor(Math.random() * layout.nodes.length)];
        guard.patrol = streetPath(layout, e, to);
        guard.waitUntil = now + 1500 + Math.random() * 3000;
        if (guard.patrol.length === 0) return;
      }
      if (walk(guard.patrol[0], 0.45)) guard.patrol.shift();
      return;
    }
    // Acampamento
    if (night) {
      const tent = camp.tents[guard.slot % camp.tents.length];
      const c = { x: tent.x + tent.w / 2, y: tent.y + tent.h / 2 };
      const d = distance(c, camp.fire) || 1;
      const lateral = ((guard.slot % 3) - 1) * 22;
      const bed = { x: c.x + ((camp.fire.x - c.x) / d) * 58 - ((camp.fire.y - c.y) / d) * lateral, y: c.y + ((camp.fire.y - c.y) / d) * 58 + ((camp.fire.x - c.x) / d) * lateral };
      if (walk(bed, 0.5)) e.setPose("SLEEP");
      return;
    }
    const drill = ctx.hour >= 7 && ctx.hour < 10;
    if (drill) {
      // Treino da manhã: em fileira no pátio, golpeando o ar
      const spot = camp.spots[8 + (guard.slot % Math.max(1, camp.spots.length - 8))] ?? guard.post.at;
      if (walk(spot, 0.6)) e.setFacing(Math.PI / 2 + Math.sin(now / 160 + guard.slot) * 0.5);
      return;
    }
    if (now > guard.waitUntil) {
      guard.waitUntil = now + 3000 + Math.random() * 5000;
      e.home = { x: guard.post.at.x + (Math.random() - 0.5) * 40, y: guard.post.at.y + (Math.random() - 0.5) * 34 };
    }
    if (walk(e.home, 0.4)) e.setFacing(Math.atan2(camp.fire.y - e.y, camp.fire.x - e.x));
  }
}
