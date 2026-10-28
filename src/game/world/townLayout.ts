import type { SettlementKind } from "../data/world";
import type { Point } from "../../utils/math";
import { createRng, seedFromText } from "../worldgen/rng";

/**
 * Planta de um povoado (Marco 12): muralha de verdade (paliçada nas aldeias, pedra nas
 * cidades e fortalezas) com torres e portões, ruas em grade, quarteirões de casas, praça do
 * mercado, paço ou castelo, templo e lavouras fora dos muros. Função pura e determinística
 * (a mesma semente dá a mesma planta): a colisão, a navegação, o desenho, os moradores e as
 * estradas do gerador usam a mesma planta. Povoados em ruínas têm brechas nos muros e casas
 * destruídas.
 */

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export type Side = "N" | "S" | "E" | "W";

export interface Gate {
  side: Side;
  /** Centro do vão do portão (na linha da muralha). */
  x: number;
  y: number;
  /** Logo fora e logo dentro do portão (estradas chegam por fora; os moradores entram por dentro). */
  outside: Point;
  inside: Point;
  width: number;
}

export interface House {
  rect: Rect;
  /** Índice da cor do telhado. */
  roof: number;
  /** Porta: na rua em frente. */
  door: Point;
  /** Ponto da rua diante da porta (os moradores chegam por ali). */
  street: Point;
}

export interface TownLayout {
  kind: SettlementKind;
  cx: number;
  cy: number;
  /** Retângulo externo da muralha. */
  bounds: Rect;
  wallKind: "PALISADE" | "STONE";
  wallThickness: number;
  /** Pedaços de muralha e torres (sólidos). */
  walls: Rect[];
  towers: Rect[];
  gates: Gate[];
  /** Casas, paço/castelo e templo (sólidos). Em ruínas, as casas destruídas não contam. */
  houses: House[];
  keep: Rect;
  temple: Rect | null;
  /** Praça do mercado (aberta), com as barracas (só desenho). */
  square: Rect;
  stalls: Rect[];
  /** Ruas (abertas): para o desenho. */
  streets: Rect[];
  /** Grade de ruas para os moradores andarem (cruzamentos e ligações). */
  nodes: Point[];
  edges: [number, number][];
  /** Lavouras fora dos muros (onde os camponeses trabalham). */
  fields: Rect[];
  /** Interações: a praça (mercado) e a porta do paço/castelo (administração). */
  market: Point;
  hall: Point;
  /** Casas em ruínas (só desenho: entulho). */
  rubble: Rect[];
}

/** Tamanho externo da muralha por tipo de povoado. */
export const TOWN_SIZE: Record<SettlementKind, { w: number; h: number }> = {
  VILLAGE: { w: 1400, h: 1100 },
  CITY: { w: 2600, h: 2100 },
  FORT: { w: 1800, h: 1600 },
};

interface KindSpec {
  wallKind: "PALISADE" | "STONE";
  thickness: number;
  /** Rua de ronda por dentro da muralha. */
  ring: number;
  street: number;
  cols: number;
  rows: number;
  gates: Side[];
  tower: number;
  /** Uma torre a cada tantos px de muralha (além dos cantos e dos portões). */
  towerEvery: number;
  square: { w: number; h: number };
  /** Fração de lotes vazios (quintais, hortas). */
  empty: number;
  fields: number;
}

const SPEC: Record<SettlementKind, KindSpec> = {
  VILLAGE: {
    wallKind: "PALISADE",
    thickness: 22,
    ring: 160,
    street: 180,
    cols: 2,
    rows: 2,
    gates: ["N", "S"],
    tower: 56,
    towerEvery: 0,
    square: { w: 380, h: 320 },
    empty: 0.3,
    fields: 6,
  },
  CITY: {
    wallKind: "STONE",
    thickness: 44,
    ring: 170,
    street: 180,
    cols: 4,
    rows: 4,
    gates: ["N", "S", "E", "W"],
    tower: 104,
    towerEvery: 640,
    square: { w: 620, h: 480 },
    empty: 0.12,
    fields: 5,
  },
  FORT: {
    wallKind: "STONE",
    thickness: 58,
    ring: 170,
    street: 200,
    cols: 2,
    rows: 2,
    gates: ["N", "S"],
    tower: 120,
    towerEvery: 560,
    square: { w: 420, h: 340 },
    empty: 0.05,
    fields: 0,
  },
};

const GATE_WIDTH = 230;

const overlaps = (a: Rect, b: Rect) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
const inset = (r: Rect, d: number): Rect => ({ x: r.x + d, y: r.y + d, w: r.w - d * 2, h: r.h - d * 2 });

/** Planta do povoado `id` (tipo, centro). `ruined` = muros com brechas e casas destruídas. */
export function townLayout(id: string, kind: SettlementKind, cx: number, cy: number, ruined = false): TownLayout {
  const rng = createRng(seedFromText(`cidade-${id}-${kind}`));
  const spec = SPEC[kind];
  const { w, h } = TOWN_SIZE[kind];
  const bounds: Rect = { x: cx - w / 2, y: cy - h / 2, w, h };
  const t = spec.thickness;

  // --- Muralha, torres e portões ---
  const gates: Gate[] = spec.gates.map((side) => gateAt(side, bounds, t));
  const walls: Rect[] = [];
  const towers: Rect[] = [];
  const sides: { side: Side; from: Point; to: Point }[] = [
    { side: "N", from: { x: bounds.x, y: bounds.y }, to: { x: bounds.x + w, y: bounds.y } },
    { side: "S", from: { x: bounds.x, y: bounds.y + h - t }, to: { x: bounds.x + w, y: bounds.y + h - t } },
    { side: "W", from: { x: bounds.x, y: bounds.y }, to: { x: bounds.x, y: bounds.y + h } },
    { side: "E", from: { x: bounds.x + w - t, y: bounds.y }, to: { x: bounds.x + w - t, y: bounds.y + h } },
  ];
  for (const sd of sides) {
    const horizontal = sd.side === "N" || sd.side === "S";
    const len = horizontal ? w : h;
    const gate = gates.find((g) => g.side === sd.side);
    // Trechos da muralha (o vão do portão fica de fora)
    const spans: [number, number][] = gate ? [[0, len / 2 - GATE_WIDTH / 2], [len / 2 + GATE_WIDTH / 2, len]] : [[0, len]];
    for (const [a, b] of spans) {
      walls.push(horizontal ? { x: sd.from.x + a, y: sd.from.y, w: b - a, h: t } : { x: sd.from.x, y: sd.from.y + a, w: t, h: b - a });
    }
    // Torres ao longo da muralha (fora dos portões)
    if (spec.towerEvery > 0) {
      const n = Math.floor(len / spec.towerEvery);
      for (let k = 1; k < n; k++) {
        const at = (k * len) / n;
        if (gate && Math.abs(at - len / 2) < GATE_WIDTH / 2 + spec.tower) continue;
        const c = horizontal ? { x: sd.from.x + at, y: sd.from.y + t / 2 } : { x: sd.from.x + t / 2, y: sd.from.y + at };
        towers.push({ x: c.x - spec.tower / 2, y: c.y - spec.tower / 2, w: spec.tower, h: spec.tower });
      }
    }
  }
  // Cantos e as duas torres de cada portão
  for (const [x, y] of [
    [bounds.x, bounds.y],
    [bounds.x + w, bounds.y],
    [bounds.x, bounds.y + h],
    [bounds.x + w, bounds.y + h],
  ]) {
    towers.push({ x: x - spec.tower / 2, y: y - spec.tower / 2, w: spec.tower, h: spec.tower });
  }
  for (const g of gates) {
    const off = GATE_WIDTH / 2 + spec.tower / 2;
    const along = g.side === "N" || g.side === "S" ? { x: 1, y: 0 } : { x: 0, y: 1 };
    for (const k of [-1, 1]) {
      const c = { x: g.x + along.x * off * k, y: g.y + along.y * off * k };
      towers.push({ x: c.x - spec.tower / 2, y: c.y - spec.tower / 2, w: spec.tower, h: spec.tower });
    }
  }

  // --- Ruas em grade e quarteirões ---
  const interior = inset(bounds, t + spec.ring);
  const S = spec.street;
  const bw = (interior.w - (spec.cols - 1) * S) / spec.cols;
  const bh = (interior.h - (spec.rows - 1) * S) / spec.rows;
  const blocks: { r: number; c: number; rect: Rect }[] = [];
  for (let r = 0; r < spec.rows; r++) {
    for (let c = 0; c < spec.cols; c++) {
      blocks.push({ r, c, rect: { x: interior.x + c * (bw + S), y: interior.y + r * (bh + S), w: bw, h: bh } });
    }
  }
  // Linhas de rua: a ronda por dentro do muro e as ruas entre os quarteirões
  const xs = [interior.x - spec.ring / 2, ...Array.from({ length: spec.cols - 1 }, (_, c) => interior.x + (c + 1) * bw + c * S + S / 2), interior.x + interior.w + spec.ring / 2];
  const ys = [interior.y - spec.ring / 2, ...Array.from({ length: spec.rows - 1 }, (_, r) => interior.y + (r + 1) * bh + r * S + S / 2), interior.y + interior.h + spec.ring / 2];
  const streets: Rect[] = [
    ...xs.slice(1, -1).map((x) => ({ x: x - S / 2, y: interior.y - spec.ring, w: S, h: interior.h + spec.ring * 2 })),
    ...ys.slice(1, -1).map((y) => ({ x: interior.x - spec.ring, y: y - S / 2, w: interior.w + spec.ring * 2, h: S })),
  ];
  const nodes: Point[] = [];
  const edges: [number, number][] = [];
  const idx = (i: number, j: number) => j * xs.length + i;
  for (let j = 0; j < ys.length; j++) for (let i = 0; i < xs.length; i++) nodes.push({ x: xs[i], y: ys[j] });
  for (let j = 0; j < ys.length; j++) {
    for (let i = 0; i < xs.length; i++) {
      if (i + 1 < xs.length) edges.push([idx(i, j), idx(i + 1, j)]);
      if (j + 1 < ys.length) edges.push([idx(i, j), idx(i, j + 1)]);
    }
  }
  // Portões ligados à grade (o cruzamento da ronda em frente a cada um)
  for (const g of gates) {
    const near = nodes.reduce((best, p, k) => (Math.hypot(p.x - g.inside.x, p.y - g.inside.y) < Math.hypot(nodes[best].x - g.inside.x, nodes[best].y - g.inside.y) ? k : best), 0);
    nodes.push({ ...g.outside });
    edges.push([near, nodes.length - 1]);
  }

  // --- Praça no centro, paço/castelo e templo ---
  const square: Rect = { x: cx - spec.square.w / 2, y: cy - spec.square.h / 2, w: spec.square.w, h: spec.square.h };
  const keepBlock = blocks.find((b) => b.r === Math.max(0, spec.rows / 2 - 1) - (kind === "CITY" ? 1 : 0) && b.c === Math.max(0, spec.cols / 2 - 1)) ?? blocks[0];
  let keep: Rect;
  if (kind === "FORT") keep = inset(keepBlock.rect, 30);
  else if (kind === "CITY") keep = inset(keepBlock.rect, 24);
  else {
    // Casa do Conselho: no canto do quarteirão voltado para a praça
    const r = keepBlock.rect;
    keep = { x: r.x + r.w - 230, y: r.y + r.h - 160, w: 210, h: 140 };
  }
  const keepDoor = { x: keep.x + keep.w / 2, y: keep.y + keep.h + 14 };
  let temple: Rect | null = null;
  if (kind === "CITY") {
    const tb = blocks.find((b) => b.r === 0 && b.c === spec.cols / 2) ?? blocks[1];
    temple = { x: tb.rect.x + tb.rect.w / 2 - 120, y: tb.rect.y + 20, w: 240, h: tb.rect.h - 40 };
  }
  const solidsTaken = [keep, ...(temple ? [temple] : []), inset(square, -30)];

  // --- Casas: duas fileiras por quarteirão (portas para as ruas de cima e de baixo) ---
  const houses: House[] = [];
  for (const b of blocks) {
    const rowH = (b.rect.h - 14) / 2;
    for (const row of [0, 1]) {
      let x = b.rect.x;
      while (x < b.rect.x + b.rect.w - 80) {
        const hw = Math.min(b.rect.x + b.rect.w - x, rng.range(110, 190));
        if (hw < 80) break;
        const rect: Rect = { x: x + 6, y: b.rect.y + row * (rowH + 14) + 6, w: hw - 12, h: rowH - 12 };
        x += hw;
        if (solidsTaken.some((s) => overlaps(s, rect))) continue;
        if (rng.chance(spec.empty)) continue;
        const doorY = row === 0 ? rect.y - 8 : rect.y + rect.h + 8;
        const streetY = row === 0 ? b.rect.y - (b.r === 0 ? spec.ring : S) / 2 : b.rect.y + b.rect.h + (b.r === spec.rows - 1 ? spec.ring : S) / 2;
        houses.push({ rect, roof: rng.int(0, 3), door: { x: rect.x + rect.w / 2, y: doorY }, street: { x: rect.x + rect.w / 2, y: streetY } });
      }
    }
  }

  // Barracas do mercado em volta da praça
  const stalls: Rect[] = [];
  const nStalls = kind === "CITY" ? 8 : kind === "VILLAGE" ? 4 : 2;
  for (let k = 0; k < nStalls; k++) {
    const a = (k / nStalls) * Math.PI * 2 + 0.3;
    const px = cx + Math.cos(a) * (square.w / 2 - 70);
    const py = cy + Math.sin(a) * (square.h / 2 - 60);
    stalls.push({ x: px - 34, y: py - 22, w: 68, h: 44 });
  }

  // --- Lavouras fora dos muros (longe dos eixos dos portões, por onde chegam as estradas) ---
  const fields: Rect[] = [];
  for (let tries = 0; fields.length < spec.fields && tries < 60; tries++) {
    const fw = rng.range(420, 760);
    const fh = rng.range(260, 460);
    const side = rng.pick<Side>(["N", "S", "E", "W"]);
    const gap = rng.range(140, 520);
    let f: Rect;
    if (side === "E" || side === "W") {
      const fy = rng.range(bounds.y - 300, bounds.y + h + 300 - fh);
      f = { x: side === "E" ? bounds.x + w + gap : bounds.x - gap - fw, y: fy, w: fw, h: fh };
    } else {
      const fx = rng.range(bounds.x - 300, bounds.x + w + 300 - fw);
      f = { x: fx, y: side === "S" ? bounds.y + h + gap : bounds.y - gap - fh, w: fw, h: fh };
    }
    const onGateAxis = gates.some((g) => overlaps(f, g.side === "N" || g.side === "S" ? { x: g.x - 260, y: f.y, w: 520, h: f.h } : { x: f.x, y: g.y - 260, w: f.w, h: 520 }));
    if (onGateAxis || fields.some((o) => overlaps(inset(o, -60), f))) continue;
    fields.push(f);
  }

  // --- Ruínas: brechas nos muros, casas destruídas ---
  const rubble: Rect[] = [];
  let finalWalls = walls;
  let finalHouses = houses;
  if (ruined) {
    finalWalls = [];
    for (const wall of walls) {
      // Corta um trecho do meio de cada pedaço (brecha) e às vezes o pedaço inteiro
      if (rng.chance(0.25)) continue;
      if (wall.w > wall.h && wall.w > 500) {
        const gx = wall.x + rng.range(0.25, 0.65) * wall.w;
        finalWalls.push({ ...wall, w: gx - wall.x }, { ...wall, x: gx + 240, w: wall.x + wall.w - gx - 240 });
      } else if (wall.h > 500) {
        const gy = wall.y + rng.range(0.25, 0.65) * wall.h;
        finalWalls.push({ ...wall, h: gy - wall.y }, { ...wall, y: gy + 240, h: wall.y + wall.h - gy - 240 });
      } else finalWalls.push(wall);
    }
    finalWalls = finalWalls.filter((r) => r.w > 10 && r.h > 10);
    finalHouses = [];
    for (const hs of houses) {
      if (rng.chance(0.6)) rubble.push(hs.rect);
      else finalHouses.push(hs);
    }
  }

  return {
    kind,
    cx,
    cy,
    bounds,
    wallKind: spec.wallKind,
    wallThickness: t,
    walls: finalWalls,
    towers: ruined ? towers.filter(() => rng.chance(0.6)) : towers,
    gates,
    houses: finalHouses,
    keep,
    temple,
    square,
    stalls,
    streets,
    nodes,
    edges,
    fields,
    market: { x: cx, y: cy },
    hall: keepDoor,
    rubble,
  };
}

function gateAt(side: Side, b: Rect, t: number): Gate {
  const cx = b.x + b.w / 2;
  const cy = b.y + b.h / 2;
  switch (side) {
    case "N":
      return { side, x: cx, y: b.y + t / 2, outside: { x: cx, y: b.y - 160 }, inside: { x: cx, y: b.y + t + 90 }, width: GATE_WIDTH };
    case "S":
      return { side, x: cx, y: b.y + b.h - t / 2, outside: { x: cx, y: b.y + b.h + 160 }, inside: { x: cx, y: b.y + b.h - t - 90 }, width: GATE_WIDTH };
    case "W":
      return { side, x: b.x + t / 2, y: cy, outside: { x: b.x - 160, y: cy }, inside: { x: b.x + t + 90, y: cy }, width: GATE_WIDTH };
    case "E":
      return { side, x: b.x + b.w - t / 2, y: cy, outside: { x: b.x + b.w + 160, y: cy }, inside: { x: b.x + b.w - t - 90, y: cy }, width: GATE_WIDTH };
  }
}

/** Portão (lado de fora) mais perto de um ponto: onde as estradas chegam. */
export function nearestGate(layout: TownLayout, p: Point): Gate {
  return layout.gates.reduce((best, g) => (Math.hypot(g.outside.x - p.x, g.outside.y - p.y) < Math.hypot(best.outside.x - p.x, best.outside.y - p.y) ? g : best), layout.gates[0]);
}

/** Todos os retângulos sólidos da planta, com o tipo (muralha ou construção). */
export function townSolids(layout: TownLayout): { rect: Rect; type: "WALL" | "BUILDING" }[] {
  return [
    ...layout.walls.map((rect) => ({ rect, type: "WALL" as const })),
    ...layout.towers.map((rect) => ({ rect, type: "WALL" as const })),
    ...layout.houses.map((hs) => ({ rect: hs.rect, type: "BUILDING" as const })),
    { rect: layout.keep, type: "BUILDING" as const },
    ...(layout.temple ? [{ rect: layout.temple, type: "BUILDING" as const }] : []),
  ];
}

/** O ponto está dentro dos muros (retângulo externo)? */
export function insideTown(layout: TownLayout, p: Point, pad = 0): boolean {
  const b = layout.bounds;
  return p.x >= b.x - pad && p.x <= b.x + b.w + pad && p.y >= b.y - pad && p.y <= b.y + b.h + pad;
}

