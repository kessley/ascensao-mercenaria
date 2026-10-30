import type { SettlementKind } from "../data/world";
import type { Point } from "../../utils/math";
import { createRng, seedFromText } from "../worldgen/rng";

/**
 * Planta de um povoado (Marco 12): muralha de verdade (paliçada nas aldeias, pedra nas
 * cidades e fortalezas) com torres e portões, ruas em grade, quarteirões de casas, praça do
 * mercado, paço ou castelo, templo, lavouras fora dos muros e, por dentro de cada portão, o
 * acampamento da guarnição (os soldados do povoado vivem ali e patrulham as ruas). Função pura
 * e determinística
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
  /** Onde um exército barrado no portão espera: na estrada, do lado de fora. */
  wait: Point;
}

/**
 * Acampamento da guarnição por dentro de um portão, no quarteirão ao lado da rua que chega
 * nele (os soldados do povoado vivem ali, guardam a entrada e saem para patrulhar as ruas).
 */
export interface GarrisonCamp {
  /** Índice do portão que o acampamento guarda. */
  gate: number;
  rect: Rect;
  /** Barracas (sólidas). */
  tents: Rect[];
  fire: Point;
  /** Armeiro com as lanças em pé (só desenho). */
  rack: Rect;
  flag: Point;
  /** Postos das duas sentinelas, um de cada lado do vão do portão. */
  posts: [Point, Point];
  /** Lugares da tropa: em volta da fogueira e no pátio. */
  spots: Point[];
  /** Linha logo atrás do portão onde a tropa forma quando há perigo perto. */
  muster: Point[];
  /** Interação "Guarnição de X", na beira voltada para a rua do portão. */
  door: Point;
  /** Bonecos de treino no pátio (só desenho). */
  dummies: Point[];
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
  /** Acampamentos da guarnição por dentro dos portões (nenhum em ruínas). */
  camps: GarrisonCamp[];
  /** Interações: a praça (mercado) e a porta do paço/castelo (administração). */
  market: Point;
  hall: Point;
  /** Casas em ruínas (só desenho: entulho). */
  rubble: Rect[];
  /**
   * Capital (Marco 15): a muralha interna em volta da Cidade Alta. Quem passa pelo portão dela
   * vai para outro mapa, bem maior (ver capitalLayout.ts).
   */
  inner: InnerCity | null;
}

/** Muralha interna de uma capital: o miolo é sólido (a Cidade Alta é outro mapa). */
export interface InnerCity {
  rect: Rect;
  walls: Rect[];
  towers: Rect[];
  /** Diante do portão, do lado de fora (onde o aviso aparece). */
  door: Point;
  /** Largura do portão, no meio do lado sul da muralha. */
  gateWidth: number;
}

/** Tamanho externo da muralha por tipo de povoado. */
export const TOWN_SIZE: Record<SettlementKind, { w: number; h: number }> = {
  VILLAGE: { w: 1400, h: 1100 },
  CITY: { w: 2600, h: 2100 },
  FORT: { w: 1800, h: 1600 },
  CAPITAL: { w: 3800, h: 3000 },
};

/** Muralha interna da capital (centrada, um pouco ao norte: a praça do mercado fica diante do portão). */
const INNER_SIZE = { w: 1700, h: 1160, thickness: 56, tower: 110, gate: 200 };

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
  CAPITAL: {
    wallKind: "STONE",
    thickness: 56,
    ring: 180,
    street: 180,
    cols: 6,
    rows: 5,
    gates: ["N", "S", "E", "W"],
    tower: 120,
    towerEvery: 640,
    square: { w: 860, h: 420 },
    empty: 0.08,
    fields: 8,
  },
};

const GATE_WIDTH = 230;

/** Acampamento da guarnição: largura (ao longo do muro), fundura (para dentro) e barracas. */
const CAMP_SIZE: Record<SettlementKind, { w: number; d: number; tents: number }> = {
  VILLAGE: { w: 400, d: 250, tents: 2 },
  CITY: { w: 400, d: 260, tents: 3 },
  FORT: { w: 540, d: 380, tents: 4 },
  CAPITAL: { w: 480, d: 300, tents: 4 },
};
/** O exército barrado no portão espera a esta distância do muro, do lado de fora. */
const WAIT_OUT = 420;

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
  // Capital: a muralha interna ocupa o centro; a praça fica diante do portão dela
  const inner = kind === "CAPITAL" ? innerCity(cx, cy - 170) : null;
  const squareCenter = inner ? { x: cx, y: inner.rect.y + inner.rect.h + 120 + spec.square.h / 2 } : { x: cx, y: cy };
  const square: Rect = { x: squareCenter.x - spec.square.w / 2, y: squareCenter.y - spec.square.h / 2, w: spec.square.w, h: spec.square.h };
  // Ninguém anda por dentro da muralha interna: os cruzamentos de lá saem da grade de ruas
  if (inner) dropNodesInside(nodes, edges, inset(inner.rect, -70));
  const keepBlock = blocks.find((b) => b.r === Math.max(0, spec.rows / 2 - 1) - (kind === "CITY" ? 1 : 0) && b.c === Math.max(0, spec.cols / 2 - 1)) ?? blocks[0];
  let keep: Rect;
  if (inner) keep = inner.rect;
  else if (kind === "FORT") keep = inset(keepBlock.rect, 30);
  else if (kind === "CITY") keep = inset(keepBlock.rect, 24);
  else {
    // Casa do Conselho: no canto do quarteirão voltado para a praça
    const r = keepBlock.rect;
    keep = { x: r.x + r.w - 230, y: r.y + r.h - 160, w: 210, h: 140 };
  }
  const keepDoor = inner ? inner.door : { x: keep.x + keep.w / 2, y: keep.y + keep.h + 14 };
  let temple: Rect | null = null;
  if (kind === "CITY" || kind === "CAPITAL") {
    const tb = inner ? (blocks.find((b) => b.r === 4 && b.c === 4) ?? blocks[1]) : (blocks.find((b) => b.r === 0 && b.c === spec.cols / 2) ?? blocks[1]);
    temple = { x: tb.rect.x + tb.rect.w / 2 - 120, y: tb.rect.y + 20, w: 240, h: tb.rect.h - 40 };
  }
  const solidsTaken = [inner ? inset(keep, -20) : keep, ...(temple ? [temple] : []), inset(square, -30)];
  // Acampamentos da guarnição no quarteirão ao lado de cada portão (em ruínas o terreno fica vazio)
  const allCamps: GarrisonCamp[] = [];
  gates.forEach((g, i) => {
    const horizontal = g.side === "N" || g.side === "S";
    const c = gateCamp(g, i, kind, t, S, spec.ring, horizontal ? bw : bh, horizontal ? bh : bw, solidsTaken);
    if (c) allCamps.push(c);
  });
  const camps = ruined ? [] : allCamps;
  const lots = [...solidsTaken, ...allCamps.map((c) => inset(c.rect, -14))];

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
        if (lots.some((s) => overlaps(s, rect))) continue;
        if (rng.chance(spec.empty)) continue;
        const doorY = row === 0 ? rect.y - 8 : rect.y + rect.h + 8;
        const streetY = row === 0 ? b.rect.y - (b.r === 0 ? spec.ring : S) / 2 : b.rect.y + b.rect.h + (b.r === spec.rows - 1 ? spec.ring : S) / 2;
        houses.push({ rect, roof: rng.int(0, 3), door: { x: rect.x + rect.w / 2, y: doorY }, street: { x: rect.x + rect.w / 2, y: streetY } });
      }
    }
  }

  // Barracas do mercado em volta da praça
  const stalls: Rect[] = [];
  const nStalls = kind === "CAPITAL" ? 14 : kind === "CITY" ? 8 : kind === "VILLAGE" ? 4 : 2;
  for (let k = 0; k < nStalls; k++) {
    const a = (k / nStalls) * Math.PI * 2 + 0.3;
    const px = squareCenter.x + Math.cos(a) * (square.w / 2 - 70);
    const py = squareCenter.y + Math.sin(a) * (square.h / 2 - 60);
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
    camps,
    market: squareCenter,
    hall: keepDoor,
    rubble,
    inner,
  };
}

/** Muralha interna da capital: sólida por inteiro, com torres e um portão ao sul. */
function innerCity(cx: number, cy: number): InnerCity {
  const { w, h, thickness: t, tower, gate } = INNER_SIZE;
  const rect: Rect = { x: cx - w / 2, y: cy - h / 2, w, h };
  const walls: Rect[] = [
    { x: rect.x, y: rect.y, w, h: t },
    { x: rect.x, y: rect.y + t, w: t, h: h - t },
    { x: rect.x + w - t, y: rect.y + t, w: t, h: h - t },
    { x: rect.x + t, y: rect.y + h - t, w: w / 2 - gate / 2 - t, h: t },
    { x: cx + gate / 2, y: rect.y + h - t, w: w / 2 - gate / 2 - t, h: t },
  ];
  const towers: Rect[] = [];
  const at = (x: number, y: number) => towers.push({ x: x - tower / 2, y: y - tower / 2, w: tower, h: tower });
  for (const x of [rect.x, rect.x + w]) for (const y of [rect.y, rect.y + h / 2, rect.y + h]) at(x, y);
  for (const x of [rect.x + w / 3, rect.x + (2 * w) / 3]) at(x, rect.y);
  // As duas torres do portão
  at(cx - gate / 2 - tower / 2, rect.y + h);
  at(cx + gate / 2 + tower / 2, rect.y + h);
  return { rect, walls, towers, door: { x: cx, y: rect.y + h + 56 }, gateWidth: gate };
}

/** Tira da grade de ruas os cruzamentos dentro de um retângulo (e as ligações deles). */
function dropNodesInside(nodes: Point[], edges: [number, number][], r: Rect): void {
  const keep: number[] = [];
  const map = new Map<number, number>();
  nodes.forEach((p, i) => {
    if (p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h) return;
    map.set(i, keep.length);
    keep.push(i);
  });
  const kept = keep.map((i) => nodes[i]);
  const links = edges.filter(([a, b]) => map.has(a) && map.has(b)).map(([a, b]): [number, number] => [map.get(a) as number, map.get(b) as number]);
  nodes.length = 0;
  nodes.push(...kept);
  edges.length = 0;
  edges.push(...links);
}

/** Direção "para fora" de cada lado da muralha. */
const OUTWARD: Record<Side, Point> = { N: { x: 0, y: -1 }, S: { x: 0, y: 1 }, W: { x: -1, y: 0 }, E: { x: 1, y: 0 } };

function gateAt(side: Side, b: Rect, t: number): Gate {
  const cx = b.x + b.w / 2;
  const cy = b.y + b.h / 2;
  const n = OUTWARD[side];
  const x = side === "W" ? b.x + t / 2 : side === "E" ? b.x + b.w - t / 2 : cx;
  const y = side === "N" ? b.y + t / 2 : side === "S" ? b.y + b.h - t / 2 : cy;
  const at = (d: number) => ({ x: x + n.x * (t / 2 + d), y: y + n.y * (t / 2 + d) });
  return {
    side,
    x,
    y,
    outside: at(160),
    inside: at(-t - 90),
    width: GATE_WIDTH,
    wait: at(WAIT_OUT),
  };
}

/**
 * Acampamento da guarnição do portão `g`, por dentro dos muros: no canto do quarteirão ao
 * lado da rua que chega ao portão (o lado que não tiver paço, templo ou praça). Barracas no
 * fundo; pátio com fogueira, armeiro e bonecos de treino virado para a rua. As sentinelas
 * ficam do lado de fora do portão.
 */
function gateCamp(
  g: Gate,
  index: number,
  kind: SettlementKind,
  t: number,
  street: number,
  ring: number,
  blockAlong: number,
  blockDepth: number,
  taken: readonly Rect[],
): GarrisonCamp | null {
  const out = OUTWARD[g.side];
  const m = { x: -out.x, y: -out.y };
  const size = CAMP_SIZE[kind];
  const w = Math.min(size.w, blockAlong - 30);
  const fullD = Math.min(size.d, blockDepth - 30);
  // Coordenadas locais: u ao longo do muro (a partir do eixo do portão), v para dentro (a partir da face de dentro)
  const fx = g.x + (m.x * t) / 2;
  const fy = g.y + (m.y * t) / 2;
  // Tenta os dois lados da rua; se o paço, o templo ou a praça ocupam o canto, um acampamento mais raso
  for (const [sign, depth] of [[1, 1], [-1, 1], [1, 0.72], [-1, 0.72], [1, 0.55], [-1, 0.55]]) {
    const d = Math.max(150, fullD * depth);
    const side = { x: -out.y * sign, y: out.x * sign };
    const at = (u: number, v: number): Point => ({ x: fx + side.x * u + m.x * v, y: fy + side.y * u + m.y * v });
    const box = (a0: number, b0: number, a1: number, b1: number): Rect => {
      const a = at(a0, b0);
      const b = at(a1, b1);
      return { x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), w: Math.abs(a.x - b.x), h: Math.abs(a.y - b.y) };
    };
    const u0 = street / 2 + 14;
    const u1 = u0 + w;
    const v0 = ring + 14;
    const v1 = v0 + d;
    const rect = box(u0, v0, u1, v1);
    if (taken.some((r) => overlaps(inset(rect, -10), r))) continue;
    const tentW = 90;
    const tentD = 66;
    const tents: Rect[] = [];
    for (let k = 0; k < size.tents; k++) {
      const uc = u0 + 30 + (k + 0.5) * ((w - 60) / size.tents);
      tents.push(box(uc - tentW / 2, v1 - 14 - tentD, uc + tentW / 2, v1 - 14));
    }
    const yardEnd = v1 - 24 - tentD;
    const fu = u0 + w * 0.6;
    const fv = (v0 + yardEnd) / 2;
    const spots: Point[] = [];
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2;
      spots.push(at(fu + Math.cos(a) * 56, fv + Math.sin(a) * Math.min(46, (yardEnd - v0) / 2 - 8)));
    }
    // Pátio de treino: fileiras entre a rua e a fogueira, de frente para os bonecos
    for (let row = 0; row < 2; row++) {
      for (let col = 0; col < 3; col++) spots.push(at(u0 + 34 + col * 32, v0 + 30 + row * 40));
    }
    const muster: Point[] = [];
    for (let row = 0; row < 2; row++) {
      for (let col = -4; col <= 4; col++) muster.push(at(col * 30, 70 + row * 34));
    }
    return {
      gate: index,
      rect,
      tents,
      fire: at(fu, fv),
      rack: box(u1 - 70, v0 + 14, u1 - 18, v0 + 34),
      flag: at(u0 + 14, v0 + 18),
      posts: [at(-(GATE_WIDTH / 2 - 22), -(t + 36)), at(GATE_WIDTH / 2 - 22, -(t + 36))],
      spots,
      muster,
      door: at(u0 + 8, (v0 + yardEnd) / 2),
      dummies: yardEnd - v0 > 120 ? [at(u0 + 50, v0 + 112), at(u0 + 98, v0 + 112)] : [],
    };
  }
  return null;
}

/**
 * O que cada soldado da guarnição faz: sentinela no portão, vigia da fogueira, acampamento,
 * ronda pelas ruas ou guarda na muralha (anda o caminho de ronda junto ao muro).
 */
export type GarrisonRole = "SENTRY" | "WATCH" | "CAMP" | "PATROL" | "WALL";

/** Posto de um soldado da guarnição. */
export interface GarrisonPost {
  at: Point;
  role: GarrisonRole;
  camp: number;
  /** Lugar dele entre os do acampamento. */
  rank: number;
}

/**
 * Onde fica cada um dos `n` soldados da guarnição. Os soldados se revezam entre os portões;
 * em cada um: o 1º é sentinela, o 2º vigia a fogueira, o 3º patrulha as ruas, o 4º é a
 * segunda sentinela; daí em diante, metade fica no acampamento e metade patrulha. O posto do
 * soldado k não muda quando a guarnição cresce ou diminui.
 */
export function garrisonPosts(layout: TownLayout, n: number): GarrisonPost[] {
  const camps = layout.camps;
  const out: GarrisonPost[] = [];
  if (camps.length === 0) return out;
  const count = camps.map(() => 0);
  for (let k = 0; k < n; k++) {
    const c = k % camps.length;
    const rank = count[c]++;
    const camp = camps[c];
    if (rank === 0 || rank === 3) out.push({ at: camp.posts[rank === 0 ? 0 : 1], role: "SENTRY", camp: c, rank });
    else if (rank === 1) out.push({ at: camp.spots[0], role: "WATCH", camp: c, rank });
    // O 3º de metade dos portões guarda a muralha; o dos outros faz a ronda pelas ruas
    else if (rank === 2 && c % 2 === 0) out.push({ at: wallWalk(layout)[0], role: "WALL", camp: c, rank });
    else if (rank === 2 || rank % 2 === 1) out.push({ at: camp.door, role: "PATROL", camp: c, rank });
    else {
      const i = (rank - 3) % camp.spots.length;
      out.push({ at: camp.spots[i], role: "CAMP", camp: c, rank });
    }
  }
  return out;
}

/** Cantos do caminho de ronda junto à muralha, por dentro (sentido horário a partir do noroeste). */
export function wallWalk(layout: TownLayout): Point[] {
  const b = layout.bounds;
  // Folga para passar por dentro das torres (que avançam muro adentro)
  const d = layout.wallThickness + 62;
  return [
    { x: b.x + d, y: b.y + d },
    { x: b.x + b.w - d, y: b.y + d },
    { x: b.x + b.w - d, y: b.y + b.h - d },
    { x: b.x + d, y: b.y + b.h - d },
  ];
}

/** Lugares ao longo da muralha, por dentro, para a tropa de um cerco (Marco 16). */
export function wallPosts(layout: TownLayout): Point[] {
  const [a, b, c, d] = wallWalk(layout);
  const out: Point[] = [];
  for (const [p, q] of [[a, b], [b, c], [c, d], [d, a]] as [Point, Point][]) {
    for (let i = 1; i <= 4; i++) out.push({ x: p.x + ((q.x - p.x) * i) / 5, y: p.y + ((q.y - p.y) * i) / 5 });
  }
  return out;
}

/** Caminho de `from` até `to` pelas ruas (busca em largura na grade de cruzamentos da planta). */
export function streetPath(layout: TownLayout, from: Point, to: Point): Point[] {
  const d2 = (a: Point, b: Point) => (a.x - b.x) ** 2 + (a.y - b.y) ** 2;
  const nearestNode = (p: Point) => layout.nodes.reduce((best, n, k) => (d2(n, p) < d2(layout.nodes[best], p) ? k : best), 0);
  const a = nearestNode(from);
  const b = nearestNode(to);
  const prev = new Map<number, number>([[a, -1]]);
  const queue = [a];
  while (queue.length) {
    const u = queue.shift() as number;
    if (u === b) break;
    for (const [x, y] of layout.edges) {
      const v = x === u ? y : y === u ? x : -1;
      if (v < 0 || prev.has(v)) continue;
      prev.set(v, u);
      queue.push(v);
    }
  }
  const path: Point[] = [];
  for (let v = b; v !== -1 && prev.has(v); v = prev.get(v) as number) path.unshift(layout.nodes[v]);
  return path;
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
    ...(layout.inner?.towers ?? []).map((rect) => ({ rect, type: "WALL" as const })),
    ...layout.houses.map((hs) => ({ rect: hs.rect, type: "BUILDING" as const })),
    { rect: layout.keep, type: "BUILDING" as const },
    ...(layout.temple ? [{ rect: layout.temple, type: "BUILDING" as const }] : []),
    ...layout.camps.flatMap((c) => c.tents.map((rect) => ({ rect, type: "BUILDING" as const }))),
  ];
}

/** O ponto está dentro dos muros (retângulo externo)? */
export function insideTown(layout: TownLayout, p: Point, pad = 0): boolean {
  const b = layout.bounds;
  return p.x >= b.x - pad && p.x <= b.x + b.w + pad && p.y >= b.y - pad && p.y <= b.y + b.h + pad;
}


/**
 * Casas com função (Marco 14): a taverna é a casa mais perto da praça; a Casa dos Mercadores,
 * a segunda (nas aldeias pequenas, só a taverna). O resto são casas de moradores.
 */
export function specialHouses(layout: TownLayout): { tavern: number | null; guild: number | null } {
  const order = layout.houses
    .map((h, i) => ({ i, d: Math.hypot(h.door.x - layout.market.x, h.door.y - layout.market.y) }))
    .sort((a, b) => a.d - b.d)
    .map((x) => x.i);
  const guild = layout.kind !== "VILLAGE" || layout.houses.length >= 6 ? (order[1] ?? null) : null;
  return { tavern: order[0] ?? null, guild };
}

/** Porta do templo: no meio do lado de baixo. */
export function templeDoor(layout: TownLayout): Point | null {
  const t = layout.temple;
  return t ? { x: t.x + t.w / 2, y: t.y + t.h + 10 } : null;
}
