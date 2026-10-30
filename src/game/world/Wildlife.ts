import type { Enemy } from "../entities/Enemy";
import type { Unit } from "../entities/Unit";
import { WOLF, type EnemyKind } from "../../utils/constants";
import { distance, type Point } from "../../utils/math";

/** O que os bichos precisam saber do mundo. */
export interface WildlifeContext {
  /** Todo o bando do jogador em campo. */
  allies: readonly Unit[];
  /** Quem anda sozinho (presa dos lobos). */
  lone: readonly Unit[];
  canSee: (p: Point) => boolean;
  /** Mato fechado, tundra ou colinas, longe de povoados e do acampamento. */
  wild: (p: Point) => boolean;
  /** Há caminho por terra da toca até a presa (nada de alcateia do outro lado do rio)? */
  reachable?: (from: Point, to: Point) => boolean;
  night: boolean;
  /** Lobos abatidos pelo bando desde a última vez (as peles valem ouro). */
  onPelts: (n: number) => void;
}

interface Pack {
  id: number;
  members: Enemy[];
  den: Point;
}

/**
 * Alcateias de lobos (Marco 12): aparecem fora de vista no mato perto de quem anda sozinho —
 * batedor, mensageiro ou o Comandante sem escolta — e o atacam; diante de um grupo, fogem e
 * somem. De noite são mais comuns. Cada lobo abatido rende uma pele.
 */
export class WildlifeManager {
  private packs: Pack[] = [];
  private lastTry = 0;
  private nextId = 1;

  constructor(
    private readonly spawn: (x: number, y: number, kind: EnemyKind) => Enemy,
    private readonly despawn: (e: Enemy) => void,
  ) {}

  get wolves(): Enemy[] {
    return this.packs.flatMap((p) => p.members.filter((m) => m.isAlive));
  }

  update(time: number, ctx: WildlifeContext): void {
    let pelts = 0;
    for (const pack of [...this.packs]) {
      pelts += pack.members.filter((m) => !m.isAlive && m.lastHitFrom?.team === "ALLY").length;
      pack.members = pack.members.filter((m) => m.isAlive);
      const alive = pack.members;
      const center = alive[0] ?? pack.den;
      const near = ctx.allies.some((a) => distance(a, center) < WOLF.DESPAWN_DISTANCE);
      const gone = alive.length > 0 && alive.every((m) => m.scared && !ctx.canSee(m));
      if (alive.length === 0 || !near || gone) {
        for (const m of alive) this.despawn(m);
        this.packs = this.packs.filter((p) => p !== pack);
      }
    }
    if (pelts > 0) ctx.onPelts(pelts);

    if (time - this.lastTry < WOLF.SPAWN_EVERY_MS) return;
    this.lastTry = time;
    if (this.packs.length >= WOLF.MAX_PACKS || ctx.lone.length === 0) return;
    if (Math.random() > (ctx.night ? WOLF.SPAWN_CHANCE.NIGHT : WOLF.SPAWN_CHANCE.DAY)) return;
    this.spawnPack(ctx.lone[Math.floor(Math.random() * ctx.lone.length)], ctx);
  }

  /** Uma alcateia no mato, fora de vista, a caminho de `prey`. Devolve false se não achou lugar. */
  spawnPack(prey: Point, ctx: Pick<WildlifeContext, "canSee" | "wild" | "reachable">): boolean {
    const [d0, d1] = WOLF.SPAWN_DISTANCE;
    for (let tries = 0; tries < 16; tries++) {
      const a = Math.random() * Math.PI * 2;
      const d = d0 + Math.random() * (d1 - d0);
      const den = { x: prey.x + Math.cos(a) * d, y: prey.y + Math.sin(a) * d };
      if (!ctx.wild(den) || ctx.canSee(den) || (ctx.reachable && !ctx.reachable(den, prey))) continue;
      const id = this.nextId++;
      const n = WOLF.PACK[0] + Math.floor(Math.random() * (WOLF.PACK[1] - WOLF.PACK[0] + 1));
      const members: Enemy[] = [];
      for (let k = 0; k < n; k++) {
        const e = this.spawn(den.x + (Math.random() - 0.5) * 80, den.y + (Math.random() - 0.5) * 80, "WOLF");
        e.owner = { kind: "WILDLIFE", pack: id };
        e.home = { ...den };
        members.push(e);
      }
      this.packs.push({ id, members, den });
      return true;
    }
    return false;
  }

  clearAll(): void {
    for (const p of this.packs) for (const m of p.members) this.despawn(m);
    this.packs = [];
  }
}
