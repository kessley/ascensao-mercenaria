import { seeded } from "../art/pixel";
import { bannerPiece, propPiece, rubblePiece, tentPiece, towerPiece, wagonPiece, type Culture, type Piece } from "../art/buildings";
import { bonesPiece, brazierPiece, darkTowerPiece, deadTreePiece, gravePiece, hutPiece, postsPiece, reedsPiece, ruinWallPiece, spikesPiece, totemPiece } from "../art/wilds";
import type { SiteDef } from "../data/world";
import type { Calamity } from "../sim/realm";
import type { ArtJob } from "./TownArt";
import type { Rect } from "./townLayout";
import { TERRAIN, type TerrainType } from "../../utils/constants";
import { distance, type Point } from "../../utils/math";

/**
 * Onde ficam as peças dos ermos (G3): os locais de contrato e os covis das calamidades. Só
 * posições e peças (sem Phaser): o desenho é do TownArt, e as peças grandes (barracas,
 * choupanas, muros caídos, a torre negra) viram sólidos como as casas.
 */
export interface WildDecor {
  jobs: ArtJob[];
  solids: Rect[];
}

/** Terreno num ponto (o do mundo: água, pântano, montanha...). */
export type GroundAt = (x: number, y: number) => TerrainType;

/** Uma peça a pôr: com pé retangular (`foot`, centrado no ponto) ou miúda (âncora no ponto). */
interface Item {
  make: (seed: number) => Piece;
  /** Raio que a peça ocupa (para não encostar em outra). */
  r: number;
  foot?: { w: number; h: number; solid: boolean };
  /** Faixa de distância do centro onde pode ficar. */
  band: [number, number];
  /** Só na lama ou no pântano (juncos, estacas do vau). */
  wet?: boolean;
}

const WET: readonly TerrainType[] = ["MUD", "SWAMP", "SHALLOW"];

function seedOf(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return h >>> 0;
}

const times = (n: number, item: (i: number) => Item): Item[] => Array.from({ length: n }, (_, i) => item(i));

/** O que cada tipo de local tem, na ordem de prioridade (as grandes primeiro). */
function siteItems(theme: SiteDef["theme"], culture: Culture): Item[] {
  const small = (make: (seed: number) => Piece, r: number, band: [number, number] = [90, 320]): Item => ({ make, r, band });
  const tree = small((s) => deadTreePiece(s), 20, [120, 340]);
  const bones = small((s) => bonesPiece(s), 15);
  switch (theme) {
    case "BANDIT_CAMP":
      return [
        ...times(3, (i) => ({
          make: (s) => tentPiece(60, 40, [0x8a7a5a, 0x7a6a4a, 0x6a6a52][i], i === 1 ? 0x7a2a2a : null, s),
          r: 40,
          foot: { w: 60, h: 40, solid: true },
          band: [150, 300],
        })),
        { make: (s) => wagonPiece(100, 44, culture, s), r: 56, foot: { w: 100, h: 44, solid: true }, band: [170, 320] },
        small((s) => propPiece("FIRE", culture, s), 24, [80, 160]),
        small(() => bannerPiece(0x7a2a2a, true, 50), 14, [110, 220]),
        { make: (s) => propPiece("RACK", culture, s, 40, 8), r: 26, foot: { w: 40, h: 8, solid: false }, band: [110, 260] },
        ...times(3, () => small((s) => propPiece("CRATE", culture, s), 12)),
        ...times(3, () => small((s) => propPiece("BARREL", culture, s), 10)),
      ];
    case "GOBLIN_NEST":
      return [
        ...times(4, () => ({ make: (s: number) => hutPiece(48, 34, s), r: 34, foot: { w: 48, h: 34, solid: true }, band: [130, 320] as [number, number] })),
        small((s) => totemPiece(s, 0x6a8a2a), 16, [90, 200]),
        small((s) => propPiece("FIRE", culture, s), 24, [80, 180]),
        ...times(3, () => bones),
        tree,
        ...times(2, () => small((s) => propPiece("CRATE", culture, s), 12)),
      ];
    case "HAUNTED_RUINS":
      return [
        ...times(3, (i) => {
          const len = [128, 96, 112][i];
          return { make: (s: number) => ruinWallPiece(len, s), r: len / 2 + 6, foot: { w: len, h: 12, solid: true }, band: [110, 300] as [number, number] };
        }),
        { make: (s) => towerPiece(44, true, culture, s, true), r: 34, foot: { w: 44, h: 44, solid: true }, band: [180, 320] },
        { make: (s) => rubblePiece(60, 36, culture, s), r: 34, foot: { w: 60, h: 36, solid: false }, band: [100, 300] },
        ...times(7, (i) => small((s) => gravePiece(i % 3, s), 13, [100, 330])),
        ...times(3, () => tree),
        ...times(2, () => bones),
      ];
    case "SWAMP_FORD":
      return [
        { make: (s) => hutPiece(48, 34, s), r: 34, foot: { w: 48, h: 34, solid: true }, band: [150, 340] },
        ...times(5, () => ({ ...small((s) => postsPiece(s), 10, [40, 340]), wet: true })),
        ...times(10, () => ({ ...small((s) => reedsPiece(s), 12, [40, 340]), wet: true })),
        ...times(2, () => tree),
        ...times(2, () => bones),
      ];
  }
}

/**
 * Peças de um local de contrato, espalhadas em anéis em volta do centro: longe dos grupos
 * inimigos (onde a luta começa), fora da água e da montanha, sem encostar uma na outra.
 */
export function siteDecor(site: SiteDef, culture: Culture, ground: GroundAt): WildDecor {
  const rnd = seeded(seedOf(site.id));
  const c = site.center;
  const spots: Point[] = [];
  for (let r = 60; r <= 340; r += 28) {
    const n = Math.max(6, Math.round((2 * Math.PI * r) / 40));
    const a0 = rnd() * Math.PI * 2;
    for (let k = 0; k < n; k++) {
      const a = a0 + (k / n) * Math.PI * 2;
      spots.push({ x: Math.round(c.x + Math.cos(a) * r + (rnd() - 0.5) * 14), y: Math.round(c.y + Math.sin(a) * r + (rnd() - 0.5) * 14) });
    }
  }
  // Ordem ao acaso, a mesma em toda partida
  for (let i = spots.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [spots[i], spots[j]] = [spots[j], spots[i]];
  }
  const groups = site.groups.map((g) => ({ x: g.x, y: g.y }));
  const placed: { p: Point; r: number }[] = [];
  const out: WildDecor = { jobs: [], solids: [] };
  for (const item of siteItems(site.theme, culture)) {
    const at = spots.find((p) => {
      const d = distance(p, c);
      if (d < item.band[0] || d > item.band[1]) return false;
      const clear = item.foot?.solid ? 100 + item.r : 50;
      if (groups.some((g) => distance(g, p) < clear)) return false;
      if (placed.some((o) => distance(o.p, p) < o.r + item.r + 8)) return false;
      return fits(ground, p, item);
    });
    if (!at) continue;
    placed.push({ p: at, r: item.r });
    put(out, item, at, rnd);
  }
  return out;
}

/** O chão aguenta a peça? (os quatro cantos do pé e o meio; a molhada só na lama) */
function fits(ground: GroundAt, p: Point, item: Item): boolean {
  const hw = item.foot ? item.foot.w / 2 : 4;
  const hh = item.foot ? item.foot.h / 2 : 4;
  const points = [p, { x: p.x - hw, y: p.y - hh }, { x: p.x + hw, y: p.y - hh }, { x: p.x - hw, y: p.y + hh }, { x: p.x + hw, y: p.y + hh }];
  for (const q of points) {
    const t = ground(q.x, q.y);
    if (TERRAIN[t].blocked || t === "BRIDGE" || t === "ICE") return false;
    if (item.wet ? !WET.includes(t) : t === "SWAMP" || t === "SHALLOW") return false;
  }
  return true;
}

function put(out: WildDecor, item: Item, p: Point, rnd: () => number): void {
  const seed = Math.floor(rnd() * 1e9);
  if (item.foot) {
    const x = Math.round(p.x - item.foot.w / 2);
    const y = Math.round(p.y - item.foot.h / 2);
    out.jobs.push({ make: () => item.make(seed), x, y, depth: y + item.foot.h });
    if (item.foot.solid) out.solids.push({ x, y, w: item.foot.w, h: item.foot.h });
  } else {
    out.jobs.push({ make: () => item.make(seed), x: p.x, y: p.y, depth: p.y });
  }
}

/**
 * Covil de uma calamidade, em volta do líder (que fica no centro, com a guarda a sudeste):
 * a torre negra ao norte com braseiros, sepulturas e árvores mortas; ou o acampamento de guerra
 * orc, com barracas de couro, totens e um anel de cavalos-de-frisa aberto em três lugares.
 */
export function lairDecor(c: Calamity, culture: Culture, ground: GroundAt): WildDecor {
  const rnd = seeded(seedOf(c.id));
  const o = c.lair;
  const out: WildDecor = { jobs: [], solids: [] };
  const guard = { x: o.x + 120, y: o.y + 60 };
  const at = (dx: number, dy: number, item: Item) => {
    const p = { x: Math.round(o.x + dx), y: Math.round(o.y + dy) };
    if (!item.foot?.solid || distance(p, guard) > 70 + item.r) {
      if (fits(ground, p, item)) put(out, item, p, rnd);
    }
  };
  const small = (make: (seed: number) => Piece, r = 12): Item => ({ make, r, band: [0, 0] });
  if (c.kind === "NECROMANCER") {
    at(0, -170, { make: (s) => darkTowerPiece(64, s), r: 46, foot: { w: 64, h: 64, solid: true }, band: [0, 0] });
    at(-52, -120, small(() => brazierPiece(true)));
    at(52, -120, small(() => brazierPiece(true)));
    // Sepulturas em dois anéis, menos no lado da torre e onde a guarda espera
    for (let k = 0; k < 16; k++) {
      const a = -Math.PI / 2 + 0.75 + (k / 16) * (Math.PI * 2 - 1.5);
      const r = (k % 2 ? 165 : 215) + Math.floor(rnd() * 20);
      const p = { x: Math.cos(a) * r, y: Math.sin(a) * r };
      if (distance({ x: o.x + p.x, y: o.y + p.y }, guard) < 60) continue;
      at(p.x, p.y, small((s) => gravePiece(k % 3, s)));
    }
    for (const a of [-2.2, -0.9, 0.9, 2.3]) at(Math.cos(a) * 265, Math.sin(a) * 250, small((s) => deadTreePiece(s), 20));
    for (const [dx, dy] of [[-90, 40], [70, -60], [-30, 120]]) at(dx, dy, small((s) => bonesPiece(s)));
  } else {
    const hide = [0x6b3a2a, 0x5a4030, 0x6a4a2a, 0x4a3a2a];
    const tents: [number, number][] = [[-150, -120], [20, -175], [165, -95], [-205, 30]];
    tents.forEach(([dx, dy], i) => at(dx, dy, { make: (s) => tentPiece(64, 44, hide[i], i % 2 ? 0x3a2a1c : null, s), r: 42, foot: { w: 64, h: 44, solid: true }, band: [0, 0] }));
    at(-80, 105, small((s) => propPiece("FIRE", culture, s), 24));
    at(-48, -52, small((s) => totemPiece(s, 0x2f4a16), 16));
    at(58, -64, small((s) => totemPiece(s, 0x2f4a16), 16));
    at(-130, -20, { make: (s) => propPiece("RACK", culture, s, 40, 8), r: 26, foot: { w: 40, h: 8, solid: false }, band: [0, 0] });
    at(40, 160, { make: (s) => propPiece("RACK", culture, s, 40, 8), r: 26, foot: { w: 40, h: 8, solid: false }, band: [0, 0] });
    for (const [dx, dy] of [[-110, 60], [95, -10], [-20, -110]]) at(dx, dy, small((s) => bonesPiece(s)));
    // Anel de cavalos-de-frisa, aberto ao sul e dos lados
    const gaps = [Math.PI / 2, -0.25, Math.PI + 0.25];
    for (let k = 0; k < 28; k++) {
      const a = (k / 28) * Math.PI * 2;
      if (gaps.some((g) => Math.abs(Math.atan2(Math.sin(a - g), Math.cos(a - g))) < 0.3)) continue;
      const x = Math.cos(a) * 262;
      const y = Math.sin(a) * 236;
      at(x, y, { make: (s) => spikesPiece(44, s), r: 22, foot: { w: 44, h: 10, solid: true }, band: [0, 0] });
    }
    for (const dx of [-42, 42]) at(dx, 236, small(() => bannerPiece(0x2f4a16, false, 56), 14));
  }
  return out;
}
