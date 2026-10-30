import type { GeoDef, ResourceId } from "../data/world";
import type { GeoMap } from "./geoMap";
import type { Rng } from "./rng";
import type { Point } from "../../utils/math";

/**
 * Recursos de um povoado pelo que há em volta dele (Marco 11, completado no Marco 12): mata dá
 * madeira, colina dá pedra, montanha dá ferro, planície dá grão, estepe dá cavalos, a costa e
 * os rios dão peixe, a costa e o deserto dão sal, a mata fechada e a tundra dão peles, o
 * pântano dá ervas. No máximo três por povoado, os mais fartos primeiro.
 */
export function resourcesAround(geo: GeoMap, def: GeoDef, p: Point, rng: Rng, port = false, river = false): ResourceId[] {
  const count: Record<string, number> = {};
  let mountains = 0;
  for (let ring = 1; ring <= 4; ring++) {
    const r = ring * 650;
    for (let k = 0; k < 12; k++) {
      const a = (k / 12) * Math.PI * 2 + ring * 0.4;
      const q = { x: p.x + Math.cos(a) * r, y: p.y + Math.sin(a) * r };
      if (geo.heightAt(q.x, q.y) > def.mountainLevel) mountains++;
      const b = geo.biomeAt(q.x, q.y);
      count[b] = (count[b] ?? 0) + 1;
    }
  }
  const c = (b: string) => count[b] ?? 0;
  const score: [ResourceId, number][] = [
    ["WOOD", c("FOREST") + c("DEEP_FOREST") - 3],
    ["FURS", c("DEEP_FOREST") + c("TUNDRA") * 1.5 - 4],
    ["STONE", c("HILLS") + mountains - 4],
    ["IRON", mountains * 2 + (c("HILLS") >= 6 && rng.chance(0.5) ? 4 : 0) - 3],
    ["GRAIN", c("PLAINS") - 7],
    ["HORSES", c("STEPPE") - 4],
    ["FISH", (port ? 6 : 0) + (river ? 4 : 0) + c("COAST") - 2],
    ["SALT", (port && rng.chance(0.5) ? 5 : 0) + c("DESERT") * 1.5 - 4],
    ["HERBS", c("MARSH") * 1.5 - 3],
  ];
  const found = score.filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]).map(([id]) => id);
  return found.length > 0 ? found.slice(0, 3) : ["GRAIN"];
}
