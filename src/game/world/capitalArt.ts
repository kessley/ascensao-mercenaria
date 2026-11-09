import { bannerPiece, gatePiece, housePiece, stallPiece, templePiece, tentPiece, towerPiece, wallPieceEW, wallPieceNS, type Culture, type Piece } from "../art/buildings";
import { donjonPiece, donjonTop, fountainPiece, lampPiece, palacePiece, stoneHallPiece, tombPiece } from "../art/cityArt";
import { oakPiece, type Foliage } from "../art/trees";
import type { CapitalLayout, CityBuilding } from "./capitalLayout";
import type { Rect } from "./townLayout";

/**
 * As peças da Cidade Alta em pixel art (G4, parte 5), para a TownArt montar: os prédios de cada
 * bairro, as três muralhas com as torres, o Portão Velho, os chafarizes, as árvores, os
 * lampiões, as lápides, as bancas do mercado, os estandartes da avenida e o camarote da Liça.
 * Os portões do Bairro Nobre e do castelo ficam de fora: abrem e fecham (a cena cuida deles).
 *
 * São milhares de peças num mapa de 9600×7200: elas vêm separadas em grupos de GROUP px, para a
 * TownArt só montar os grupos que a câmera tem por perto.
 */

/** Peça a fazer, como a da TownArt (sem importar o Phaser). */
export interface CityJob {
  make: () => Piece;
  x: number;
  y: number;
  depth: number;
}

export const GROUP = 1200;
const SEG = 48;
const MAX_SPAN = 960;
const SIGNS = [0xb84a3a, 0x3a6ab8, 0xc9a23a, 0x3a9a5a];

const R = Math.round;
const hits = (a: Rect, b: Rect) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
const inside = (a: Rect, b: Rect, pad = 0) => a.x >= b.x - pad && a.y >= b.y - pad && a.x + a.w <= b.x + b.w + pad && a.y + a.h <= b.y + b.h + pad;

/** Intervalos de [a, b) que sobram depois de tirar os pedaços cobertos (pelas torres). */
function spans(a: number, b: number, covers: [number, number][]): [number, number][] {
  let out: [number, number][] = [[a, b]];
  for (const [c0, c1] of covers) {
    out = out.flatMap(([s0, s1]): [number, number][] => {
      if (c1 <= s0 || c0 >= s1) return [[s0, s1]];
      const keep: [number, number][] = [];
      if (c0 > s0) keep.push([s0, c0]);
      if (c1 < s1) keep.push([c1, s1]);
      return keep;
    });
  }
  return out.filter(([s0, s1]) => s1 - s0 >= 6);
}

/** Placa da casa pelo nome (taverna e estalagem em ouro, mercadores e banco em azul...). */
function signOf(label: string | undefined): number | null {
  if (!label) return null;
  if (/Taverna|Estalagem/.test(label)) return 0xe0b040;
  if (/Mercadores|Banco/.test(label)) return 0x3a6ab8;
  if (/Falcoaria/.test(label)) return 0x6a8a3a;
  if (/Rato/.test(label)) return 0x3a3430;
  return null;
}

function buildingPiece(b: CityBuilding, l: CapitalLayout, culture: Culture, seed: number): () => Piece {
  const r = b.rect;
  const w = R(r.w);
  const h = R(r.h);
  const south = b.door.y > r.y + r.h / 2;
  const doorX = R(Math.min(w - 12, Math.max(12, b.door.x - r.x)));
  switch (b.kind) {
    case "KEEP":
      return () => donjonPiece(w, h, culture, doorX, seed);
    case "TEMPLE":
      return () => templePiece(w, h, culture, seed, false);
    case "PALACE":
      return () => palacePiece(w, h, culture, b.roof, doorX, seed);
    case "CIVIC": {
      // No castelo e nos prédios da Coroa, pedra; as tavernas e as casas do povo, de enxaimel
      const stone = inside(r, l.castleRect) || /Banco|Quartel|Mercadores/.test(b.label ?? "");
      if (stone) return () => stoneHallPiece(w, h, culture, inside(r, l.castleRect) ? -1 : b.roof, doorX, seed);
      const sign = signOf(b.label);
      return () => housePiece(w, h, culture, b.roof, doorX, seed, false, false, sign);
    }
    case "SHOP": {
      const sign = seed % 3 === 0 ? null : SIGNS[seed % SIGNS.length];
      return () => housePiece(w, h, culture, b.roof, south ? doorX : null, seed, false, false, sign, south ? null : doorX);
    }
    default:
      return () => housePiece(w, h, culture, b.roof, south ? doorX : null, seed, false, false, null, south ? null : doorX);
  }
}

/** Todas as peças da Cidade Alta, em grupos de GROUP px (pela posição do pé). */
export function capitalJobs(l: CapitalLayout, culture: Culture, realm: number, foliage: Foliage, seed0: number): Map<string, CityJob[]> {
  const groups = new Map<string, CityJob[]>();
  const seed = (x: number, y: number) => (Math.imul(R(x), 73856093) ^ Math.imul(R(y), 19349663) ^ seed0) >>> 0;
  const push = (job: CityJob) => {
    const key = `${Math.floor(job.x / GROUP)},${Math.floor(job.depth / GROUP)}`;
    const list = groups.get(key) ?? [];
    list.push(job);
    groups.set(key, list);
  };
  const add = (r: Rect, make: () => Piece) => push({ x: R(r.x), y: R(r.y), depth: R(r.y + r.h), make });
  const at = (x: number, y: number, make: () => Piece, depth = y) => push({ x: R(x), y: R(y), depth: R(depth), make });

  // Prédios (a Liça é desenhada no chão)
  for (const b of l.buildings) {
    if (b.kind === "ARENA") continue;
    add(b.rect, buildingPiece(b, l, culture, seed(b.rect.x, b.rect.y)));
    if (b.kind === "PALACE") at(b.door.x + 22, b.door.y - 4, () => bannerPiece(realm, false, 40, 20), b.rect.y + b.rect.h + 2);
    const top = b.kind === "KEEP" ? donjonTop(R(b.rect.w), R(b.rect.h)) : null;
    if (top) at(b.rect.x + top.x, b.rect.y + top.y, () => bannerPiece(realm, true, 56, 30), b.rect.y + b.rect.h + 1);
  }

  // Muralhas: a de fora, a do castelo e a do Bairro Nobre (o lado de cada trecho sai do centro do recinto dele)
  const city = { x: l.w / 2, y: l.h / 2 };
  const castle = { x: l.castleRect.x + l.castleRect.w / 2, y: l.castleRect.y + l.castleRect.h / 2 };
  const noble = { x: l.nobleRect.x + l.nobleRect.w / 2, y: l.nobleRect.y + l.nobleRect.h / 2 };
  const outer = (w: Rect) => w.x <= 0 || w.y <= 0 || w.x + w.w >= l.w || w.y + w.h >= l.h;
  for (const w of l.walls) {
    const center = outer(w) ? city : inside(w, l.castleRect, 1) ? castle : noble;
    if (w.w >= w.h) {
      const side = w.y + w.h / 2 < center.y ? "N" : "S";
      const covers = l.towers.filter((tw) => tw.y < w.y + w.h && tw.y + tw.h > w.y).map((tw): [number, number] => [tw.x, tw.x + tw.w]);
      for (const [a, e] of spans(w.x, w.x + w.w, covers)) {
        for (let x = a; x < e; x += MAX_SPAN) {
          const len = R(Math.min(MAX_SPAN, e - x));
          add({ x, y: w.y, w: len, h: w.h }, () => wallPieceEW(len, R(w.h), side, true, culture, seed(x, w.y), false));
        }
      }
    } else {
      const side = w.x + w.w / 2 < center.x ? "W" : "E";
      const covers = l.towers.filter((tw) => tw.x < w.x + w.w && tw.x + tw.w > w.x).map((tw): [number, number] => [tw.y, tw.y + tw.h]);
      for (const [a, e] of spans(w.y, w.y + w.h, covers)) {
        for (let y = a; y < e; y += SEG) {
          const len = R(Math.min(SEG, e - y));
          const end = y + SEG >= e;
          add({ x: w.x, y, w: w.w, h: len }, () => wallPieceNS(len, R(w.w), side, true, culture, end, seed(w.x, y), false));
        }
      }
    }
  }
  for (const tw of l.towers) add(tw, () => towerPiece(R(tw.w), true, culture, seed(tw.x, tw.y), false));
  // O Portão Velho, aberto (é por ele que se sai)
  const gw = 300;
  const wt = R(l.walls[0].h);
  add({ x: l.w / 2 - gw / 2, y: l.h - wt, w: gw, h: wt }, () => gatePiece(gw, wt, "S", true, culture, seed(l.w / 2, l.h), false));

  // Enfeites
  for (const f of l.fountains) add({ x: f.x - 46, y: f.y - 28, w: 92, h: 57 }, () => fountainPiece(46, seed(f.x, f.y)));
  for (const t of l.trees) at(t.x, t.y, () => oakPiece(seed(t.x, t.y), foliage));
  for (const p of l.lamps) at(p.x, p.y, () => lampPiece());
  for (const t of l.tombs) at(t.x, t.y + 8, () => tombPiece(seed(t.x, t.y)));
  for (const s of l.stalls) {
    const color = SIGNS[seed(s.x, s.y) % SIGNS.length];
    add(s, () => stallPiece(R(s.w), R(s.h), color, culture, seed(s.x, s.y)));
  }
  // Estandartes do reino dos dois lados da Avenida Real
  for (let y = 2800; y < l.h - 300; y += 640) for (const x of [l.w / 2 - 136, l.w / 2 + 136]) at(x, y, () => bannerPiece(realm, false, 50, 24));
  // A Liça: o camarote real no alto da arquibancada do norte, e as flâmulas em volta
  const a = l.arena;
  const box = { x: a.x + a.w / 2 - 70, y: a.y + R(a.h * 0.07), w: 140, h: 54 };
  add(box, () => tentPiece(box.w, box.h, 0xe8dcc0, realm, seed(box.x, box.y)));
  for (let k = 0; k < 12; k++) {
    const t = (k / 12) * Math.PI * 2 + 0.26;
    const x = a.x + a.w / 2 + Math.cos(t) * a.w * 0.5;
    const y = a.y + a.h / 2 + Math.sin(t) * a.h * 0.5;
    if (hits({ x: x - 20, y: y - 20, w: 40, h: 40 }, box)) continue;
    at(x, y, () => bannerPiece(k % 2 ? realm : 0xe8dcc0, true, 46, 22));
  }
  return groups;
}
