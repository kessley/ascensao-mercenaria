import type { WorldDef } from "../data/world";
import { WORLD, SUPPORT } from "../../utils/constants";
import type { Point } from "../../utils/math";
import { geoOf } from "./geoMap";
import { createRng } from "./rng";

export interface HarpyNest extends Point {
  id: string;
}

/**
 * Ninhos de harpia (Marco 16): no pé das montanhas, onde um cavalo ainda chega. Saem da semente
 * do mundo, então não vão no save (só quais já foram achados).
 */
export function harpyNests(world: WorldDef): HarpyNest[] {
  const geo = geoOf(world.geo);
  const r = createRng(world.seed ^ 0x5eed);
  const w = world.cols * WORLD.REGION_WIDTH;
  const h = world.rows * WORLD.REGION_HEIGHT;
  const out: HarpyNest[] = [];
  for (let tries = 0; tries < 4000 && out.length < SUPPORT.HARPY.NESTS; tries++) {
    const p = { x: r.next() * w, y: r.next() * h };
    if (geo.biomeAt(p.x, p.y) !== "HILLS" || !geo.isOpenLand(p, 40)) continue;
    // Com montanha logo ali, e longe dos outros ninhos
    const peak = [0, 1, 2, 3, 4, 5, 6, 7].some((i) => geo.biomeAt(p.x + Math.cos((i * Math.PI) / 4) * 900, p.y + Math.sin((i * Math.PI) / 4) * 900) === "MOUNTAINS");
    if (!peak || out.some((n) => Math.hypot(n.x - p.x, n.y - p.y) < 4000)) continue;
    out.push({ id: `nest-${out.length}`, x: Math.round(p.x), y: Math.round(p.y) });
  }
  return out;
}
