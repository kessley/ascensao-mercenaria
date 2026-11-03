import type { Point } from "../../utils/math";
import type { Biome } from "../data/world";
import { seeded } from "../art/pixel";
import type { TerrainZone } from "./TerrainMap";

/** Onde ficam as árvores de cada mata (sem Phaser, para os testes). O desenho é do ForestArt. */

export type TreeKind = "PINE" | "OAK" | "BUSH" | "ROCK" | "BIG_ROCK";

export interface TreeSpot extends Point {
  kind: TreeKind;
  seed: number;
}

/** Quanto de cada coisa a mata tem, conforme o bioma: pinheiros no frio e na serra, folhas no resto. */
const MIX: Partial<Record<Biome, { pine: number; spacing: number }>> = {
  DEEP_FOREST: { pine: 0.65, spacing: 42 },
  FOREST: { pine: 0.4, spacing: 48 },
  TUNDRA: { pine: 0.92, spacing: 54 },
  MOUNTAINS: { pine: 0.8, spacing: 52 },
  HILLS: { pine: 0.55, spacing: 52 },
  MARSH: { pine: 0.1, spacing: 58 },
};
const DEFAULT_MIX = { pine: 0.2, spacing: 56 };

/**
 * Onde ficam as árvores de uma zona: uma grade sacudida, mais rala na borda, com clareiras, e só
 * onde o chão é mata de verdade (`ok`): fora da água, das casas e das estradas.
 */
export function forestSpots(z: TerrainZone, seed: number, biome: Biome | null, ok: (p: Point) => boolean): TreeSpot[] {
  const rnd = seeded(seed);
  const mix = (biome && MIX[biome]) ?? DEFAULT_MIX;
  const s = mix.spacing;
  // Duas ou três clareiras: lugar para a luta e para a mata respirar
  const clearings = Array.from({ length: 2 + Math.floor(rnd() * 2) }, () => {
    const a = rnd() * Math.PI * 2;
    const r = Math.sqrt(rnd()) * 0.6;
    return { x: z.x + Math.cos(a) * z.rx * r, y: z.y + Math.sin(a) * z.ry * r, r: 50 + rnd() * 70 };
  });
  const out: TreeSpot[] = [];
  for (let y = z.y - z.ry; y <= z.y + z.ry; y += s) {
    for (let x = z.x - z.rx; x <= z.x + z.rx; x += s) {
      const p = { x: Math.round(x + (rnd() - 0.5) * s * 0.8), y: Math.round(y + (rnd() - 0.5) * s * 0.8) };
      const dx = (p.x - z.x) / z.rx;
      const dy = (p.y - z.y) / z.ry;
      const d = dx * dx + dy * dy;
      if (d > 1) continue;
      const roll = rnd();
      // Na borda a mata rareia e vira moita
      const edge = d > 0.7;
      if (edge && roll < 0.35) continue;
      if (clearings.some((c) => Math.hypot(p.x - c.x, p.y - c.y) < c.r)) {
        if (roll < 0.88) continue;
      }
      if (!ok(p)) continue;
      const pick = rnd();
      const kind: TreeKind = pick < (edge ? 0.3 : 0.12) ? "BUSH" : pick < (edge ? 0.34 : 0.15) ? (rnd() < 0.3 ? "BIG_ROCK" : "ROCK") : rnd() < mix.pine ? "PINE" : "OAK";
      out.push({ ...p, kind, seed: Math.floor(rnd() * 2 ** 31) });
      // Moita ao pé de algumas árvores
      if ((kind === "OAK" || kind === "PINE") && rnd() < 0.18) {
        const q = { x: p.x + Math.round((rnd() - 0.5) * s * 0.6), y: p.y + Math.round(s * 0.25 + rnd() * 6) };
        if (ok(q)) out.push({ ...q, kind: "BUSH", seed: Math.floor(rnd() * 2 ** 31) });
      }
    }
  }
  return out;
}
