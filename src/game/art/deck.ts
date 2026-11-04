import { CLEAR, Grid, SHADOW, gridBitmap, ramp, seeded, type Bitmap, type Ramp } from "./pixel";

/**
 * O convés da batalha no mar (G4): os dois navios amarrados, as pranchas entre eles e o mar.
 * Tudo a 1 px por px de mundo, como o chão e as figuras. O navio é desenhado com a proa a
 * oeste (o nosso); o deles é o mesmo desenho espelhado, em madeira mais escura.
 */

export interface DeckShape {
  /** O convés onde se anda e a amurada em volta (as paredes da cena). */
  w: number;
  h: number;
  rail: number;
  /** Centro de cada prancha, a partir do alto do convés, e a largura delas. */
  planks: readonly number[];
  plankWidth: number;
}

/** Quanto o desenho passa do convés: a proa à frente e o costado embaixo. */
export const DECK_BOW = 260;
export const DECK_SIDE = 40;
const FOAM_ROOM = 12;

/** Onde fica o canto do convés (o retângulo onde se anda) dentro do desenho do navio. */
export const deckOrigin = (s: DeckShape) => ({ x: DECK_BOW + s.rail, y: s.rail });
export const deckSize = (s: DeckShape) => ({ w: DECK_BOW + s.w + 2 * s.rail, h: s.h + 2 * s.rail + DECK_SIDE + FOAM_ROOM });

interface Woods {
  hull: Ramp;
  deck: readonly number[];
  seam: number;
  rail: Ramp;
  trim: number;
}

const OURS: Woods = { hull: ramp(0x6a4428), deck: [0x8a6840, 0x84623c, 0x906e46], seam: 0x5e4428, rail: ramp(0x9a7448), trim: 0x2f5f8a };
const THEIRS: Woods = { hull: ramp(0x4a3424), deck: [0x6e5434, 0x684e30, 0x745a3a], seam: 0x46321e, rail: ramp(0x7a5c3a), trim: 0x8a2f2a };

const FOAM = 0xd6e8ec;
const ROPE = 0xb89a68;
const ROPE_DARK = 0x7a6440;
const IRON = 0x34302c;

type P = readonly [number, number];

/** O contorno do casco visto de cima: a popa reta a leste, a proa em ponta a oeste. */
function hullOutline(s: DeckShape): P[] {
  const H = s.h + 2 * s.rail;
  const right = DECK_BOW + s.w + 2 * s.rail;
  const top: P[] = [];
  const bottom: P[] = [];
  for (let x = 0; x <= DECK_BOW + 40; x += 4) {
    const t = Math.min(1, x / (DECK_BOW + 40));
    // Em ponta, com os lados curvos (uma ogiva), e não redonda como uma tina
    const half = (H / 2) * t * (2 - t);
    top.push([x, H / 2 - half]);
    bottom.push([x, H / 2 + half]);
  }
  return [...top, [right, 0], [right, H], ...bottom.reverse()];
}

/** A cor um pouco mais escura (a sombra da vela no convés). */
function dim(c: number): number {
  if (c < 0) return c;
  const ch = (s: number) => Math.round(((c >> s) & 255) * 0.78);
  return (ch(16) << 16) | (ch(8) << 8) | ch(0);
}

const shift = (pts: readonly P[], dx: number, dy: number): P[] => pts.map(([x, y]) => [x + dx, y + dy]);

/** Um navio do convés, com a proa a oeste. */
export function deckShipBitmap(s: DeckShape, enemy: boolean): Bitmap {
  const wood = enemy ? THEIRS : OURS;
  const size = deckSize(s);
  const g = new Grid(size.w, size.h);
  const rand = seeded(enemy ? 71 : 17);
  const R = s.rail;
  const o = deckOrigin(s);
  const hull = hullOutline(s);

  // A sombra na água, o costado (o casco visto um pouco de lado) e a espuma
  g.poly(shift(hull, 10, DECK_SIDE + 8), SHADOW);
  g.poly(shift(hull, 0, DECK_SIDE), wood.hull.dark);
  g.poly(shift(hull, 0, DECK_SIDE / 2), wood.hull.base);
  g.poly(hull, wood.hull.base);
  for (let y = 0; y < size.h; y++) {
    for (let x = 0; x < size.w; x++) {
      const c = g.get(x, y);
      if (c !== wood.hull.base && c !== wood.hull.dark) continue;
      // As tábuas do costado e a cinta na cor do navio
      if (y % 8 === 0) g.px(x, y, wood.hull.dark);
      else if (y % 8 === 1) g.px(x, y, wood.hull.light);
    }
  }
  for (let x = 0; x < size.w; x++) {
    let low = -1;
    for (let y = size.h - 1; y >= 0; y--) {
      const c = g.get(x, y);
      if (c !== CLEAR && c !== SHADOW) {
        low = y;
        break;
      }
    }
    if (low < 0) continue;
    g.px(x, low + 1, 0x1a1522);
    if ((x * 7 + Math.floor(x / 23)) % 5 < 3) g.px(x, low + 2, FOAM);
    if (x % 11 < 2) g.px(x, low + 3, FOAM);
  }

  // O tombadilho da proa (mais alto: não se anda) e a amurada em volta dele
  g.poly(hull, wood.rail.base);
  g.poly(shift(hullOutline({ ...s, h: s.h, rail: s.rail - 6 }), 6, 6), wood.deck[0]);
  for (let y = R; y < size.h; y += 22) for (let x = 6; x < DECK_BOW; x++) if (g.get(x, y) === wood.deck[0]) g.px(x, y, wood.seam);

  // O convés: tábuas ao comprido, em três tons, com as emendas desencontradas e os pregos
  const boards = Math.ceil(s.h / 22);
  for (let b = 0; b < boards; b++) {
    const y0 = o.y + b * 22;
    const tone = wood.deck[Math.floor(rand() * wood.deck.length)];
    g.rect(o.x, y0, s.w, Math.min(22, o.y + s.h - y0), tone);
    g.rect(o.x, y0, s.w, 1, wood.seam);
    const step = 160 + Math.floor(rand() * 60);
    for (let x = o.x + Math.floor(rand() * step); x < o.x + s.w; x += step) {
      g.rect(x, y0, 1, 22, wood.seam);
      g.px(x - 3, y0 + 5, IRON);
      g.px(x - 3, y0 + 16, IRON);
      g.px(x + 3, y0 + 5, IRON);
      g.px(x + 3, y0 + 16, IRON);
    }
  }

  // As escotilhas, com a grade
  for (const hy of [90, s.h - 134]) {
    const hx = o.x + s.w / 2 - 22;
    g.rect(hx - 3, o.y + hy - 3, 50, 50, wood.rail.dark);
    g.rect(hx, o.y + hy, 44, 44, 0x2a1c12);
    for (let i = 0; i < 44; i += 8) {
      g.rect(hx + i, o.y + hy, 3, 44, wood.rail.base);
      g.rect(hx, o.y + hy + i, 44, 3, wood.rail.base);
    }
  }

  // O mastro grande, com a sombra da vela atravessando o convés e os cabos enrolados
  const mx = o.x + s.w / 2 + 160;
  const my = o.y + s.h / 2;
  for (let y = o.y + 6; y < o.y + s.h; y++) {
    const lean = Math.round((y - o.y) * 0.25);
    for (let x = mx + 30 + lean; x < mx + 110 + lean; x++) g.px(x, y, dim(g.get(x, y)));
  }
  g.oval(mx, my, 14, 12, wood.rail.dark);
  g.oval(mx, my, 10, 8, wood.hull.base);
  g.oval(mx - 3, my - 3, 3, 2, wood.hull.light);
  for (const [cx, cy] of [
    [mx - 60, o.y + 34],
    [o.x + 70, o.y + s.h - 40],
    [o.x + s.w - 90, o.y + 30],
  ]) {
    for (let r = 9; r >= 3; r -= 3) {
      g.oval(cx, cy, r, Math.max(2, r - 3), r % 2 === 0 ? ROPE_DARK : ROPE);
    }
    g.px(cx, cy, ROPE_DARK);
  }

  // A amurada em volta do convés: corrimão claro, balaústres e, do lado de cima, a face de dentro
  const railStrip = (x: number, y: number, w: number, h: number, posts: "x" | "y") => {
    g.rect(x, y, w, h, wood.rail.base);
    if (posts === "x") {
      g.rect(x, y, w, 2, wood.rail.light);
      g.rect(x, y + h - 2, w, 2, wood.rail.dark);
      for (let i = x + 30; i < x + w - 10; i += 60) g.rect(i, y + 3, 6, h - 6, wood.rail.dark);
    } else {
      g.rect(x, y, 2, h, wood.rail.light);
      g.rect(x + w - 2, y, 2, h, wood.rail.dark);
      for (let i = y + 30; i < y + h - 10; i += 60) g.rect(x + 3, i, w - 6, 6, wood.rail.dark);
    }
  };
  railStrip(DECK_BOW, 0, s.w + 2 * R, R, "x");
  g.rect(o.x, R, s.w, 6, wood.hull.dark);
  railStrip(DECK_BOW, R + s.h, s.w + 2 * R, R, "x");
  g.rect(DECK_BOW, 2 * R + s.h - 3, s.w + 2 * R, 3, wood.trim);
  railStrip(DECK_BOW, R, R, s.h, "y");
  // A popa, cortada onde as pranchas apoiam, com um cunho de ferro de cada lado
  const sx = o.x + s.w;
  let from = R;
  for (const p of s.planks) {
    const a = R + p - s.plankWidth / 2;
    railStrip(sx, from, R, a - from, "y");
    from = a + s.plankWidth;
    for (const cy of [a - 8, from + 2]) g.rect(sx + 4, cy, 12, 6, IRON);
  }
  railStrip(sx, from, R, R + s.h - from, "y");
  return gridBitmap(g);
}

/** Uma prancha entre os navios: tábuas ao comprido, travessas para o pé, corda nos dois lados. */
export function gangplankBitmap(len: number, width: number, rail: number): Bitmap {
  const h = width + 2 * rail + 14;
  const g = new Grid(len, h);
  const top = rail;
  // A sombra na água, embaixo
  for (let y = top + 10; y < top + width + 14; y++) for (let x = 0; x < len; x++) g.px(x, y, SHADOW);
  const tones = [0xa07c50, 0x9a764a, 0xa68256];
  for (let b = 0; b * 16 < width; b++) {
    g.rect(0, top + b * 16, len, Math.min(16, width - b * 16), tones[b % tones.length]);
    g.rect(0, top + b * 16, len, 1, 0x6e5232);
  }
  for (let x = 20; x < len - 10; x += 44) {
    g.rect(x, top, 6, width, 0x7a5a36);
    g.rect(x, top, 6, 1, 0xb8946a);
  }
  g.rect(0, top + width, len, 3, 0x5a4026);
  // O corrimão de corda, entre estacas
  for (const y of [Math.floor(rail / 2), top + width + Math.floor(rail / 2)]) {
    for (let x = 10; x < len; x += 70) {
      g.rect(x - 3, y - 3, 6, 7, 0x5a4026);
      g.rect(x - 3, y - 3, 6, 1, 0x9a7448);
    }
    for (let x = 0; x < len; x++) {
      const sag = Math.round(Math.sin((((x - 10) % 70) / 70) * Math.PI) * 2);
      g.px(x, y + sag, ROPE);
      g.px(x, y + sag + 1, ROPE_DARK);
    }
  }
  return gridBitmap(g);
}

/** Um ladrilho do mar, que se repete sem emenda: ondas curtas, cavados e brilhos. */
export const SEA_TILE = 128;

export function seaTileBitmap(): Bitmap {
  const n = SEA_TILE;
  const g = new Grid(n, n);
  const rand = seeded(5);
  g.rect(0, 0, n, n, 0x1f4f6e);
  const put = (x: number, y: number, c: number) => g.px(((x % n) + n) % n, ((y % n) + n) % n, c);
  for (let i = 0; i < 14; i++) {
    const x = Math.floor(rand() * n);
    const y = Math.floor(rand() * n);
    const r = 10 + Math.floor(rand() * 14);
    for (let dy = -r; dy <= r; dy++) for (let dx = -r * 2; dx <= r * 2; dx++) if ((dx * dx) / 4 + dy * dy <= r * r && (dx + dy) % 3 === 0) put(x + dx, y + dy, 0x225677);
  }
  for (let i = 0; i < 26; i++) {
    const x = Math.floor(rand() * n);
    const y = Math.floor(rand() * n);
    const w = 4 + Math.floor(rand() * 6);
    for (let k = 0; k < w; k++) {
      const lift = k === 0 || k === w - 1 ? 1 : 0;
      put(x + k, y + lift, 0x3c7192);
      put(x + k, y + 2, 0x183f59);
    }
    if (rand() < 0.4) put(x + Math.floor(w / 2), y, 0x9cc8da);
  }
  return gridBitmap(g);
}
