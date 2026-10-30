import type { Point } from "../../utils/math";
import { createRng, seedFromText, type Rng } from "../worldgen/rng";
import type { CourtPlace } from "../sim/nobility";
import type { AccessPlace } from "../sim/reputation";
import type { Rect } from "./townLayout";

/**
 * Planta da Cidade Alta de uma capital (Marco 15): um mapa à parte, bem maior que a cidade do
 * mapa do continente (9600×7200, treze vezes a área de uma cidade comum). Tudo é uma função pura e
 * determinística do id do povoado:
 * - ao norte, o Castelo, com fosso, ponte, muralha e um pátio com a Torre de Menagem;
 * - a oeste dele, o Bairro Nobre, murado, com os palácios das grandes casas;
 * - a leste, o Bairro do Templo e a Catedral;
 * - no meio, a Praça Real; descendo a Avenida Real, o Grande Mercado, até o Portão Velho;
 * - a oeste, a Liça dos torneios; a sudoeste, o Bairro Baixo, com a boca dos esgotos;
 * - a leste, os mercadores e, a sudeste, os artesãos.
 */

export const CAPITAL_W = 9600;
export const CAPITAL_H = 7200;
const WALL = 90;
const STREET = 150;
const AVENUE = 260;
const AVENUE_X = CAPITAL_W / 2;

/** Linhas de rua (a do meio é a Avenida Real). */
const XS = [220, 900, 1680, 2460, 3240, 4020, 4800, 5580, 6360, 7140, 7920, 8700, 9380];
const YS = [220, 740, 1360, 1980, 2600, 3220, 3840, 4460, 5080, 5700, 6320, 6940];

export type CityZone = "COMMON" | "NOBLE" | "CASTLE";

export type DistrictId = "CASTLE" | "NOBLE" | "TEMPLE" | "PLAZA" | "MARKET" | "ARENA" | "SLUMS" | "MERCHANTS" | "ARTISANS" | "COMMONS";

export interface District {
  id: DistrictId;
  name: string;
  rect: Rect;
  /** Onde a liteira deixa o passageiro. */
  stand: Point;
}

export type BuildingKind = "HOUSE" | "SHOP" | "PALACE" | "CIVIC" | "TEMPLE" | "KEEP" | "ARENA" | "SHACK";

export interface CityBuilding {
  rect: Rect;
  kind: BuildingKind;
  /** Cor do telhado (índice). */
  roof: number;
  door: Point;
  label?: string;
}

/** Ponto de interação: porta de um prédio ou algo na rua. */
export interface CityDoor {
  x: number;
  y: number;
  label: string;
  /** Chave do interior (sem o prefixo "town:<id>:"). */
  enter?: string;
  /** Exige reconhecimento desse lugar (porta com guarda). */
  access?: AccessPlace;
  /** Ação no diálogo (liteira, esgotos, sair). */
  action?: string;
  radius: number;
}

/** Portão entre duas zonas: bloqueia até o guarda deixar passar. */
export interface CityGate {
  place: AccessPlace;
  rect: Rect;
  /** Onde os guardas ficam, do lado de fora. */
  post: Point;
  /** Do lado de dentro (para onde o Comandante vai ao passar). */
  inside: Point;
}

export interface CapitalLayout {
  townId: string;
  w: number;
  h: number;
  walls: Rect[];
  towers: Rect[];
  moat: Rect[];
  /** Ponte do castelo (desenho). */
  bridge: Rect;
  /** Ruas e avenida (desenho). */
  streets: Rect[];
  plazas: { rect: Rect; kind: "PLAZA" | "MARKET" | "GARDEN" | "YARD" | "CEMETERY" | "BAILEY" | "NOBLE_GROUND" }[];
  arena: Rect;
  buildings: CityBuilding[];
  /** Sólidos estáticos (muros, fosso, prédios). */
  solids: Rect[];
  gates: CityGate[];
  doors: CityDoor[];
  districts: District[];
  /** Grade de ruas para os moradores (cada nó tem a zona dele). */
  nodes: (Point & { zone: CityZone })[];
  edges: [number, number][];
  lamps: Point[];
  trees: Point[];
  fountains: Point[];
  stalls: Rect[];
  tombs: Point[];
  /** Palácios das casas nobres, na ordem em que os lordes os ocupam. */
  palaces: CityBuilding[];
  /** Onde os nobres ficam quando estão em lugares abertos. */
  hotspots: Partial<Record<CourtPlace, Point>>;
  /** Entrada, ao lado do Portão Velho. */
  spawn: Point;
  exit: Point;
  /** Muro do Bairro Nobre e do castelo, para saber em que zona se está. */
  nobleRect: Rect;
  castleRect: Rect;
}

const hits = (a: Rect, b: Rect) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
const inRect = (r: Rect, p: Point, pad = 0) => p.x >= r.x - pad && p.x <= r.x + r.w + pad && p.y >= r.y - pad && p.y <= r.y + r.h + pad;

/** O segmento cruza o retângulo? (amostras a cada 40 px) */
function crosses(a: Point, b: Point, r: Rect): boolean {
  const len = Math.hypot(a.x - b.x, a.y - b.y);
  const n = Math.max(1, Math.ceil(len / 40));
  for (let i = 0; i <= n; i++) if (inRect(r, { x: a.x + ((b.x - a.x) * i) / n, y: a.y + ((b.y - a.y) * i) / n })) return true;
  return false;
}

const cache = new Map<string, CapitalLayout>();

export function capitalLayout(townId: string): CapitalLayout {
  const hit = cache.get(townId);
  if (hit) return hit;
  const layout = build(townId);
  if (cache.size > 8) cache.clear();
  cache.set(townId, layout);
  return layout;
}

function build(townId: string): CapitalLayout {
  const rng = createRng(seedFromText(`cidade-alta-${townId}`));
  const W = CAPITAL_W;
  const H = CAPITAL_H;
  const walls: Rect[] = [];
  const towers: Rect[] = [];
  const buildings: CityBuilding[] = [];
  const doors: CityDoor[] = [];
  const plazas: CapitalLayout["plazas"] = [];
  const palaces: CityBuilding[] = [];

  // --- Muralha de fora, com o Portão Velho ao sul ---
  const gateW = 300;
  walls.push({ x: 0, y: 0, w: W, h: WALL }, { x: 0, y: WALL, w: WALL, h: H - WALL }, { x: W - WALL, y: WALL, w: WALL, h: H - WALL });
  walls.push({ x: WALL, y: H - WALL, w: AVENUE_X - gateW / 2 - WALL, h: WALL }, { x: AVENUE_X + gateW / 2, y: H - WALL, w: AVENUE_X - gateW / 2 - WALL, h: WALL });
  const tower = (x: number, y: number, s = 150) => towers.push({ x: x - s / 2, y: y - s / 2, w: s, h: s });
  for (let x = 0; x <= W; x += 1600) {
    tower(x, 45);
    if (Math.abs(x - AVENUE_X) > 400) tower(x, H - 45);
  }
  for (let y = 1600; y < H; y += 1600) {
    tower(45, y);
    tower(W - 45, y);
  }
  tower(AVENUE_X - gateW / 2 - 90, H - 45, 170);
  tower(AVENUE_X + gateW / 2 + 90, H - 45, 170);

  // --- Castelo: fosso, muralha, ponte ---
  const castleRect: Rect = { x: 3400, y: 200, w: 2800, h: 2140 };
  const moatT = 80;
  const moat: Rect[] = [
    { x: castleRect.x - moatT, y: WALL, w: moatT, h: castleRect.y + castleRect.h + moatT - WALL },
    { x: castleRect.x + castleRect.w, y: WALL, w: moatT, h: castleRect.y + castleRect.h + moatT - WALL },
    { x: castleRect.x, y: castleRect.y + castleRect.h, w: AVENUE_X - castleRect.x - 90, h: moatT },
    { x: AVENUE_X + 90, y: castleRect.y + castleRect.h, w: castleRect.x + castleRect.w - AVENUE_X - 90, h: moatT },
  ];
  const bridge: Rect = { x: AVENUE_X - 90, y: castleRect.y + castleRect.h - 60, w: 180, h: moatT + 110 };
  const cw = 60;
  const cr = castleRect;
  walls.push(
    { x: cr.x, y: cr.y, w: cr.w, h: cw },
    { x: cr.x, y: cr.y + cw, w: cw, h: cr.h - cw },
    { x: cr.x + cr.w - cw, y: cr.y + cw, w: cw, h: cr.h - cw },
    { x: cr.x + cw, y: cr.y + cr.h - cw, w: AVENUE_X - 100 - cr.x - cw, h: cw },
    { x: AVENUE_X + 100, y: cr.y + cr.h - cw, w: cr.x + cr.w - AVENUE_X - 100 - cw, h: cw },
  );
  for (const [x, y] of [[cr.x, cr.y], [cr.x + cr.w, cr.y], [cr.x, cr.y + cr.h], [cr.x + cr.w, cr.y + cr.h], [AVENUE_X - 130, cr.y + cr.h], [AVENUE_X + 130, cr.y + cr.h], [AVENUE_X, cr.y]]) tower(x, y, 140);
  plazas.push({ rect: { x: cr.x + cw, y: cr.y + cw, w: cr.w - cw * 2, h: cr.h - cw * 2 }, kind: "BAILEY" });

  // --- Bairro Nobre: muro ao sul e a leste, um portão na rua de baixo ---
  const nobleRect: Rect = { x: WALL, y: WALL, w: 3120, h: 2400 };
  const nw = 60;
  const nobleGateX = XS[3];
  const nobleBottom = nobleRect.y + nobleRect.h;
  walls.push(
    { x: WALL, y: nobleBottom - nw, w: nobleGateX - 100 - WALL, h: nw },
    { x: nobleGateX + 100, y: nobleBottom - nw, w: nobleRect.x + nobleRect.w - nobleGateX - 100, h: nw },
    { x: nobleRect.x + nobleRect.w - nw, y: WALL, w: nw, h: nobleRect.h },
  );
  tower(nobleGateX - 130, nobleBottom - 30, 110);
  tower(nobleGateX + 130, nobleBottom - 30, 110);
  tower(nobleRect.x + nobleRect.w - 30, nobleBottom - 30, 120);
  plazas.push({ rect: { x: nobleRect.x, y: nobleRect.y, w: nobleRect.w - nw, h: nobleRect.h - nw }, kind: "NOBLE_GROUND" });

  const gates: CityGate[] = [
    { place: "NOBLE", rect: { x: nobleGateX - 100, y: nobleBottom - nw, w: 200, h: nw }, post: { x: nobleGateX, y: nobleBottom + 44 }, inside: { x: nobleGateX, y: nobleBottom - nw - 60 } },
    { place: "CASTLE", rect: { x: AVENUE_X - 100, y: cr.y + cr.h - cw, w: 200, h: cw + moatT }, post: { x: AVENUE_X, y: cr.y + cr.h + moatT + 44 }, inside: { x: AVENUE_X, y: cr.y + cr.h - cw - 60 } },
  ];

  // --- Prédios especiais ---
  const special = (rect: Rect, kind: BuildingKind, door: Point, label: string, extra: Partial<CityDoor> = {}, roof = 0): CityBuilding => {
    const b: CityBuilding = { rect, kind, roof, door, label };
    buildings.push(b);
    doors.push({ x: door.x, y: door.y, label, radius: 90, ...extra });
    return b;
  };

  // Pátio do castelo
  special({ x: 4300, y: 420, w: 1000, h: 760 }, "KEEP", { x: AVENUE_X, y: 1200 }, "Torre de Menagem: Sala do Trono", { enter: "throne", access: "THRONE", radius: 120 });
  special({ x: 3620, y: 420, w: 560, h: 520 }, "KEEP", { x: 3900, y: 960 }, "Grande Salão", { enter: "greathall" }, 1);
  special({ x: 5420, y: 420, w: 560, h: 520 }, "KEEP", { x: 5700, y: 960 }, "Aposentos Reais", { enter: "royal", access: "ROYAL" }, 1);
  special({ x: 3620, y: 1120, w: 420, h: 340 }, "CIVIC", { x: 3830, y: 1480 }, "Sala do Conselho", { enter: "council", access: "THRONE" }, 2);
  special({ x: 5560, y: 1120, w: 420, h: 340 }, "CIVIC", { x: 5770, y: 1480 }, "Biblioteca Real", { enter: "library" }, 2);
  special({ x: 3620, y: 1700, w: 360, h: 420 }, "TEMPLE", { x: 3800, y: 2140 }, "Capela Real", { enter: "chapel" }, 3);
  special({ x: 5620, y: 1700, w: 360, h: 300 }, "CIVIC", { x: 5800, y: 2020 }, "Arsenal Real", { enter: "armory", access: "ARMORY" }, 3);
  special({ x: 5040, y: 1900, w: 260, h: 220 }, "CIVIC", { x: 5170, y: 2140 }, "Porta da Masmorra", { action: "dungeon", radius: 70 }, 3);
  plazas.push({ rect: { x: 4120, y: 1330, w: 520, h: 460 }, kind: "GARDEN" }, { rect: { x: 4960, y: 1330, w: 520, h: 460 }, kind: "YARD" });

  // Catedral e cemitério, no Bairro do Templo
  special({ x: 7240, y: 900, w: 1300, h: 900 }, "TEMPLE", { x: 7890, y: 1820 }, "Catedral", { enter: "cathedral", radius: 120 });
  plazas.push({ rect: { x: 7240, y: 280, w: 1300, h: 440 }, kind: "CEMETERY" });

  // Praça Real e Grande Mercado
  plazas.push({ rect: { x: 3980, y: 2700, w: 1640, h: 1060 }, kind: "PLAZA" }, { rect: { x: 3980, y: 4540, w: 1640, h: 1080 }, kind: "MARKET" });
  doors.push({ x: AVENUE_X, y: 5080, label: "Grande Mercado", action: "market", radius: 260 });
  doors.push({ x: AVENUE_X, y: 3220, label: "Arauto da Praça Real", action: "herald", radius: 150 });

  // Liça dos torneios
  const arena: Rect = { x: 820, y: 3300, w: 1560, h: 1060 };
  special(arena, "ARENA", { x: 1600, y: 4374 }, "Liça dos Torneios", { enter: "arena", radius: 130 });

  // Prédios públicos em volta do mercado e do portão
  const civic = (i: number, j: number, label: string, enter: string, roof: number) => {
    const bx = XS[i] + STREET / 2;
    const by = YS[j] + STREET / 2;
    const bw = XS[i + 1] - XS[i] - STREET;
    const bh = YS[j + 1] - YS[j] - STREET;
    return special({ x: bx + 40, y: by + 30, w: bw - 80, h: bh - 60 }, "CIVIC", { x: bx + bw / 2, y: by + bh - 16 }, label, { enter, radius: 90 }, roof);
  };
  civic(4, 7, "Casa dos Mercadores", "guild", 1);
  civic(7, 7, "Banco da Coroa", "guild", 2);
  civic(4, 8, "Taverna do Javali", "tavern", 0);
  civic(7, 8, "Quartel da Guarda", "garrison", 3);
  civic(5, 10, "Estalagem do Portão Velho", "inn", 1);
  civic(1, 9, "Casa do Rato (Ladrões)", "thieves", 2);
  civic(2, 10, "Taverna do Rato Manco", "tavern", 3);
  doors.push({ x: XS[2], y: YS[10], label: "Boca dos esgotos", action: "sewer", radius: 70 });
  // Liteiras nos grandes cruzamentos
  for (const [i, j] of [[6, 10], [6, 7], [6, 5], [9, 6], [3, 6], [9, 3]]) doors.push({ x: XS[i] + 90, y: YS[j] + 90, label: "Ponto de liteiras", action: "litter", radius: 60 });
  // Sair: o Portão Velho
  doors.push({ x: AVENUE_X, y: H - 130, label: "Portão Velho (sair da Cidade Alta)", action: "leave", radius: 110 });

  // --- Quarteirões: cada bairro com o seu jeito de casa ---
  const reserved = (r: Rect) => plazas.filter((p) => p.kind !== "NOBLE_GROUND" && p.kind !== "BAILEY").some((p) => hits(p.rect, r)) || buildings.some((b) => hits(b.rect, r)) || hits(castleRect, r) || moat.some((m) => hits(m, r));
  for (let j = 0; j < YS.length - 1; j++) {
    for (let i = 0; i < XS.length - 1; i++) {
      const block: Rect = { x: XS[i] + STREET / 2, y: YS[j] + STREET / 2, w: XS[i + 1] - XS[i] - STREET, h: YS[j + 1] - YS[j] - STREET };
      if (i === 5 || i === 6) {
        // A avenida é mais larga
        if (i === 5) block.w -= (AVENUE - STREET) / 2;
        else {
          block.x += (AVENUE - STREET) / 2;
          block.w -= (AVENUE - STREET) / 2;
        }
      }
      if (reserved(block)) continue;
      const inNoble = i <= 3 && j <= 3;
      if (inNoble) {
        // O muro corta os quarteirões da beira
        if (block.x + block.w > nobleRect.x + nobleRect.w - nw - 20) block.w = nobleRect.x + nobleRect.w - nw - 20 - block.x;
        if (block.y + block.h > nobleBottom - nw - 20) block.h = nobleBottom - nw - 20 - block.y;
        if (block.w < 200 || block.h < 200) continue;
        const rect: Rect = { x: block.x + 60, y: block.y + 40, w: block.w - 120, h: block.h - 130 };
        const b: CityBuilding = { rect, kind: "PALACE", roof: (i + j) % 4, door: { x: rect.x + rect.w / 2, y: rect.y + rect.h + 12 } };
        buildings.push(b);
        palaces.push(b);
        continue;
      }
      const slum = i <= 3 && j >= 8;
      const merchants = i >= 7 && j >= 4 && j <= 7;
      const artisans = i >= 7 && j >= 8;
      fillBlock(rng, block, buildings, doors, slum ? "SLUM" : merchants ? "MERCHANT" : artisans ? "ARTISAN" : "COMMON");
    }
  }

  // --- Ruas ---
  const streets: Rect[] = [];
  for (let j = 0; j < YS.length; j++) streets.push({ x: XS[0], y: YS[j] - STREET / 2, w: XS[XS.length - 1] - XS[0], h: STREET });
  for (let i = 0; i < XS.length; i++) streets.push(i === 6 ? { x: AVENUE_X - AVENUE / 2, y: YS[4], w: AVENUE, h: H - YS[4] } : { x: XS[i] - STREET / 2, y: YS[0], w: STREET, h: YS[YS.length - 1] - YS[0] });

  // --- Sólidos, zonas e grade de ruas ---
  const solids: Rect[] = [...walls, ...towers, ...moat, ...buildings.map((b) => b.rect)];
  const zoneOf = (p: Point): CityZone => (inRect(castleRect, p) ? "CASTLE" : inRect(nobleRect, p) ? "NOBLE" : "COMMON");
  const blockers = [...walls, ...moat, ...towers, arena, ...buildings.filter((b) => b.kind !== "HOUSE" && b.kind !== "SHOP" && b.kind !== "SHACK").map((b) => b.rect)];
  const raw: (Point & { zone: CityZone })[] = [];
  const index = new Map<string, number>();
  for (let j = 0; j < YS.length; j++) {
    for (let i = 0; i < XS.length; i++) {
      const p = { x: XS[i], y: YS[j] };
      if (blockers.some((r) => inRect(r, p, 20)) || inRect(castleRect, p, 100)) continue;
      index.set(`${i},${j}`, raw.length);
      raw.push({ ...p, zone: zoneOf(p) });
    }
  }
  const edges: [number, number][] = [];
  const link = (a?: number, b?: number) => {
    if (a === undefined || b === undefined || raw[a].zone !== raw[b].zone) return;
    if (blockers.some((r) => crosses(raw[a], raw[b], r))) return;
    edges.push([a, b]);
  };
  for (let j = 0; j < YS.length; j++) {
    for (let i = 0; i < XS.length; i++) {
      const a = index.get(`${i},${j}`);
      link(a, index.get(`${i + 1},${j}`));
      link(a, index.get(`${i},${j + 1}`));
    }
  }
  // Por dentro do castelo a grade é uma estrela: portão, pátio e portas
  const hub = raw.length;
  raw.push({ x: AVENUE_X, y: 1500, zone: "CASTLE" });
  for (const p of [{ x: AVENUE_X, y: 2220 }, { x: AVENUE_X, y: 1230 }, { x: 3900, y: 1020 }, { x: 5700, y: 1020 }, { x: 3830, y: 1540 }, { x: 5770, y: 1540 }]) {
    raw.push({ ...p, zone: "CASTLE" });
    edges.push([hub, raw.length - 1]);
  }

  // --- Enfeites ---
  const lamps: Point[] = [];
  for (let j = 0; j < YS.length; j += 1) for (let i = 0; i < XS.length; i++) if ((i + j) % 2 === 0 || i === 6) lamps.push({ x: XS[i] + 86, y: YS[j] + 86 });
  for (let y = YS[4] + 300; y < H - 200; y += 320) lamps.push({ x: AVENUE_X - 150, y }, { x: AVENUE_X + 150, y });
  for (const b of [...palaces]) lamps.push({ x: b.door.x, y: b.door.y + 30 });
  lamps.push({ x: 4100, y: 1100 }, { x: 5500, y: 1100 }, { x: 4600, y: 2200 }, { x: 5000, y: 2200 }, { x: AVENUE_X, y: 1260 }, { x: 7890, y: 1860 });

  const trees: Point[] = [];
  for (const b of palaces) {
    const r = b.rect;
    for (let k = 0; k < 6; k++) trees.push({ x: r.x - 40 + rng.range(0, r.w + 80), y: r.y + r.h + rng.range(30, 80) });
  }
  const garden = plazas.find((p) => p.kind === "GARDEN")?.rect as Rect;
  for (let k = 0; k < 14; k++) trees.push({ x: garden.x + 30 + rng.range(0, garden.w - 60), y: garden.y + 30 + rng.range(0, garden.h - 60) });
  for (let k = 0; k < 16; k++) trees.push({ x: 7240 + rng.range(0, 1300), y: 1860 + rng.range(0, 60) });
  const fountains: Point[] = [{ x: AVENUE_X - 420, y: 3220 }, { x: AVENUE_X + 420, y: 3220 }, { x: garden.x + garden.w / 2, y: garden.y + garden.h / 2 }];
  const stalls: Rect[] = [];
  const market = plazas.find((p) => p.kind === "MARKET")?.rect as Rect;
  for (let row = 0; row < 4; row++) {
    for (let col = 0; col < 8; col++) {
      if (Math.abs(col - 3.5) < 1) continue; // a avenida passa pelo meio
      stalls.push({ x: market.x + 40 + col * 200, y: market.y + 50 + row * 250, w: 110, h: 60 });
    }
  }
  const cemetery = plazas.find((p) => p.kind === "CEMETERY")?.rect as Rect;
  const tombs: Point[] = [];
  for (let row = 0; row < 4; row++) for (let col = 0; col < 18; col++) tombs.push({ x: cemetery.x + 30 + col * 70 + rng.range(-8, 8), y: cemetery.y + 40 + row * 100 + rng.range(-8, 8) });

  const districts: District[] = [
    { id: "CASTLE", name: "Castelo", rect: castleRect, stand: { x: AVENUE_X, y: 2560 } },
    { id: "NOBLE", name: "Bairro Nobre", rect: nobleRect, stand: { x: nobleGateX, y: 2560 } },
    { id: "TEMPLE", name: "Bairro do Templo", rect: { x: 6280, y: WALL, w: W - 6280 - WALL, h: 2500 }, stand: { x: 7890, y: 1980 } },
    { id: "PLAZA", name: "Praça Real", rect: { x: 3320, y: 2590, w: 2960, h: 1270 }, stand: { x: AVENUE_X + 90, y: 3310 } },
    { id: "MARKET", name: "Grande Mercado", rect: { x: 3320, y: 3860, w: 2960, h: 1850 }, stand: { x: AVENUE_X + 90, y: 4550 } },
    { id: "ARENA", name: "Campo da Liça", rect: { x: WALL, y: 2600, w: 3230, h: 2480 }, stand: { x: XS[3] + 90, y: YS[6] + 90 } },
    { id: "SLUMS", name: "Bairro Baixo", rect: { x: WALL, y: 5080, w: 3230, h: H - 5080 }, stand: { x: XS[3], y: YS[9] } },
    { id: "MERCHANTS", name: "Rua dos Mercadores", rect: { x: 6280, y: 2600, w: W - 6280, h: 2480 }, stand: { x: XS[9] + 90, y: YS[6] + 90 } },
    { id: "ARTISANS", name: "Bairro dos Artesãos", rect: { x: 6280, y: 5080, w: W - 6280, h: H - 5080 }, stand: { x: XS[9], y: YS[9] } },
    { id: "COMMONS", name: "Cidade Velha", rect: { x: 3320, y: 5710, w: 2960, h: H - 5710 }, stand: { x: AVENUE_X + 90, y: YS[10] + 90 } },
  ];

  return {
    townId,
    w: W,
    h: H,
    walls,
    towers,
    moat,
    bridge,
    streets,
    plazas,
    arena,
    buildings,
    solids,
    gates,
    doors,
    districts,
    nodes: raw,
    edges,
    lamps,
    trees,
    fountains,
    stalls,
    tombs,
    palaces,
    hotspots: {
      GARDEN: { x: garden.x + garden.w / 2, y: garden.y + garden.h + 20 },
      YARD: { x: 5220, y: 1560 },
      FOREYARD: { x: AVENUE_X + 170, y: 1290 },
      MARKET: { x: AVENUE_X + 300, y: 5080 },
      ARENA: { x: 1600, y: 4460 },
      STREET: { x: XS[1], y: YS[2] },
    },
    spawn: { x: AVENUE_X, y: H - 250 },
    exit: { x: AVENUE_X, y: H - 40 },
    nobleRect,
    castleRect,
  };
}

type BlockStyle = "COMMON" | "SLUM" | "MERCHANT" | "ARTISAN";

const STYLE: Record<BlockStyle, { min: number; max: number; depth: number; empty: number; kind: BuildingKind; roofs: number[] }> = {
  COMMON: { min: 110, max: 180, depth: 160, empty: 0.1, kind: "HOUSE", roofs: [0, 1, 2, 3] },
  SLUM: { min: 70, max: 120, depth: 120, empty: 0.16, kind: "SHACK", roofs: [4, 5, 6] },
  MERCHANT: { min: 170, max: 260, depth: 190, empty: 0.05, kind: "SHOP", roofs: [7, 8, 9] },
  ARTISAN: { min: 130, max: 200, depth: 170, empty: 0.08, kind: "SHOP", roofs: [2, 3, 6] },
};

/** Duas fileiras de casas, com as portas para as ruas de cima e de baixo e o quintal no meio. */
function fillBlock(rng: Rng, block: Rect, buildings: CityBuilding[], doors: CityDoor[], style: BlockStyle): void {
  const st = STYLE[style];
  for (const row of [0, 1]) {
    let x = block.x;
    while (x < block.x + block.w - 60) {
      const hw = Math.min(block.x + block.w - x, rng.range(st.min, st.max));
      if (hw < 60) break;
      const y = row === 0 ? block.y + 8 : block.y + block.h - st.depth - 8;
      const rect: Rect = { x: x + 5, y, w: hw - 10, h: st.depth };
      x += hw;
      if (rng.chance(st.empty)) continue;
      const door = { x: rect.x + rect.w / 2, y: row === 0 ? rect.y - 10 : rect.y + rect.h + 10 };
      const b: CityBuilding = { rect, kind: st.kind, roof: rng.pick(st.roofs), door };
      buildings.push(b);
      doors.push({ x: door.x, y: door.y, label: style === "SLUM" ? "Barraco" : style === "MERCHANT" ? "Casa de mercador" : style === "ARTISAN" ? "Oficina" : "Casa de moradores", enter: `house:${buildings.length - 1}`, radius: 36 });
    }
  }
}

/** Em que zona fica um ponto (o castelo e o Bairro Nobre têm portão). */
export function zoneAt(l: CapitalLayout, p: Point): CityZone {
  if (inRect(l.castleRect, p)) return "CASTLE";
  if (inRect(l.nobleRect, p)) return "NOBLE";
  return "COMMON";
}

export function districtAt(l: CapitalLayout, p: Point): District {
  return l.districts.find((d) => inRect(d.rect, p)) ?? l.districts[l.districts.length - 1];
}

/** Caminho pelas ruas (busca em largura na grade), só dentro da zona de partida. */
export function cityPath(l: CapitalLayout, from: Point, to: Point, zone: CityZone): Point[] {
  const d2 = (a: Point, b: Point) => (a.x - b.x) ** 2 + (a.y - b.y) ** 2;
  let a = -1;
  let b = -1;
  l.nodes.forEach((n, i) => {
    if (n.zone !== zone) return;
    if (a < 0 || d2(n, from) < d2(l.nodes[a], from)) a = i;
    if (b < 0 || d2(n, to) < d2(l.nodes[b], to)) b = i;
  });
  if (a < 0 || b < 0) return [to];
  const prev = new Map<number, number>([[a, -1]]);
  const queue = [a];
  while (queue.length) {
    const u = queue.shift() as number;
    if (u === b) break;
    for (const v of adjacency(l)[u] ?? []) {
      if (prev.has(v)) continue;
      prev.set(v, u);
      queue.push(v);
    }
  }
  if (!prev.has(b)) return [to];
  const path: Point[] = [];
  for (let v = b; v !== -1; v = prev.get(v) as number) path.unshift(l.nodes[v]);
  return path;
}

const adj = new WeakMap<CapitalLayout, number[][]>();
function adjacency(l: CapitalLayout): number[][] {
  let list = adj.get(l);
  if (!list) {
    list = l.nodes.map(() => []);
    for (const [a, b] of l.edges) {
      list[a].push(b);
      list[b].push(a);
    }
    adj.set(l, list);
  }
  return list;
}
