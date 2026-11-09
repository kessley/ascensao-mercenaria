import type { CapitalLayout } from "./capitalLayout";
import type { Rect } from "./townLayout";
import type { Paving } from "../art/cityArt";

/**
 * O chão da Cidade Alta em pixel art (G4, parte 5), 1 px de textura por px de mundo, em pedaços.
 * Em duas demãos, com o filtro do chão do continente no meio:
 * - a base: terra batida nos quintais, grama no Bairro Nobre, no jardim e no cemitério, saibro no
 *   pátio dos cavalos, a água do fosso e a areia da Liça — o filtro dá a textura e o barranco;
 * - o calçamento por cima: as ruas de pedra (lajes claras no Bairro Nobre, a Avenida Real mais
 *   larga), as lajes da Praça Real, do Grande Mercado e do pátio do castelo, a ponte de tábuas e a
 *   arquibancada da Liça com o povo sentado.
 * Os padrões são ancorados no mundo: pedaços vizinhos se encontram sem emenda.
 */

const DIRT = "#7d6f50";
const BASE: Partial<Record<CapitalLayout["plazas"][number]["kind"], string>> = {
  NOBLE_GROUND: "#6a8a4a",
  GARDEN: "#5f8a52",
  CEMETERY: "#627a4a",
  YARD: "#b7a678",
};
const WATER = "#2f5f7f";
const SAND = "#d8c070";
const CURB = "#4e4638";
const AVENUE = 260;

const hits = (a: Rect, x: number, y: number, s: number) => a.x < x + s && a.x + a.w > x && a.y < y + s && a.y + a.h > y;

function intersect(a: Rect, b: Rect): Rect | null {
  const x = Math.max(a.x, b.x);
  const y = Math.max(a.y, b.y);
  const r = Math.min(a.x + a.w, b.x + b.w);
  const t = Math.min(a.y + a.h, b.y + b.h);
  return r > x && t > y ? { x, y, w: r - x, h: t - y } : null;
}

/** Meia largura da elipse (rx, ry) na altura dy do centro; -1 fora dela. */
const halfWidth = (rx: number, ry: number, dy: number) => (Math.abs(dy) >= ry ? -1 : rx * Math.sqrt(1 - (dy * dy) / (ry * ry)));

/** Elipse cheia em linhas de 1 px (sem a borda borrada do `ellipse` do canvas). */
function ellipseRows(ctx: CanvasRenderingContext2D, cx: number, cy: number, rx: number, ry: number, y0: number, y1: number): void {
  for (let y = Math.max(y0, Math.ceil(cy - ry)); y < Math.min(y1, cy + ry); y++) {
    const hw = Math.round(halfWidth(rx, ry, y + 0.5 - cy));
    if (hw > 0) ctx.fillRect(Math.round(cx) - hw, y, hw * 2, 1);
  }
}

/** A base do pedaço (canto em x0, y0 do mundo, `size` px de lado), para o filtro do chão. */
export function paintCapitalBase(ctx: CanvasRenderingContext2D, l: CapitalLayout, x0: number, y0: number, size: number): void {
  ctx.setTransform(1, 0, 0, 1, -x0, -y0);
  ctx.fillStyle = DIRT;
  ctx.fillRect(x0, y0, size, size);
  for (const kind of ["NOBLE_GROUND", "GARDEN", "CEMETERY", "YARD"] as const) {
    ctx.fillStyle = BASE[kind] as string;
    for (const p of l.plazas) if (p.kind === kind && hits(p.rect, x0, y0, size)) ctx.fillRect(p.rect.x, p.rect.y, p.rect.w, p.rect.h);
  }
  ctx.fillStyle = WATER;
  for (const m of l.moat) if (hits(m, x0, y0, size)) ctx.fillRect(m.x, m.y, m.w, m.h);
  const a = l.arena;
  if (hits(a, x0, y0, size)) {
    ctx.fillStyle = SAND;
    ellipseRows(ctx, a.x + a.w / 2, a.y + a.h / 2, a.w * 0.36, a.h * 0.34, y0, y0 + size);
  }
}

/** A segunda demão, por cima do chão já filtrado: calçamento, ponte e arquibancada. */
export function paveCapital(ctx: CanvasRenderingContext2D, l: CapitalLayout, x0: number, y0: number, size: number, tiles: Record<Paving, CanvasPattern>): void {
  ctx.setTransform(1, 0, 0, 1, -x0, -y0);
  ctx.imageSmoothingEnabled = false;
  const box: Rect = { x: x0, y: y0, w: size, h: size };
  const a = l.arena;
  const acx = a.x + a.w / 2;
  const acy = a.y + a.h / 2;
  const fill = (r: Rect, style: string | CanvasPattern, grow = 0) => {
    ctx.fillStyle = style;
    ctx.fillRect(r.x - grow, r.y - grow, r.w + grow * 2, r.h + grow * 2);
  };

  // Ruas: não passam pelo fosso, pelo castelo (o pátio tem as lajes dele), pelo cemitério nem pela Liça
  const streets = l.streets.filter((s) => hits(s, x0 - 4, y0 - 4, size + 8));
  if (streets.length > 0) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(x0, y0, size, size);
    for (const m of l.moat) ctx.rect(m.x, m.y, m.w, m.h);
    const c = l.castleRect;
    ctx.rect(c.x, c.y, c.w, c.h);
    for (const p of l.plazas) if (p.kind === "CEMETERY") ctx.rect(p.rect.x, p.rect.y, p.rect.w, p.rect.h);
    if (hits(a, x0, y0, size)) {
      ctx.moveTo(acx + a.w / 2, acy);
      ctx.ellipse(acx, acy, a.w / 2, a.h / 2, 0, 0, Math.PI * 2);
    }
    ctx.clip("evenodd");
    for (const s of streets) fill(s, CURB, 2);
    for (const s of streets) {
      fill(s, s.w === AVENUE ? tiles.AVENUE : tiles.COBBLE);
      const lane = intersect(s, l.nobleRect);
      if (lane) fill(lane, tiles.NOBLE);
    }
    ctx.restore();
  }

  // Praça Real e Grande Mercado com o meio-fio; o pátio do castelo (menos o jardim e o pátio dos cavalos)
  for (const p of l.plazas) {
    if (!hits(p.rect, x0 - 4, y0 - 4, size + 8)) continue;
    if (p.kind === "PLAZA" || p.kind === "MARKET") {
      fill(p.rect, CURB, 3);
      fill(p.rect, p.kind === "PLAZA" ? tiles.FLAG : tiles.MARKET);
    } else if (p.kind === "BAILEY") {
      ctx.save();
      ctx.beginPath();
      ctx.rect(p.rect.x, p.rect.y, p.rect.w, p.rect.h);
      for (const q of l.plazas) if (q.kind === "GARDEN" || q.kind === "YARD") ctx.rect(q.rect.x, q.rect.y, q.rect.w, q.rect.h);
      ctx.clip("evenodd");
      fill(p.rect, tiles.BAILEY);
      ctx.restore();
      for (const q of l.plazas) {
        if (q.kind !== "GARDEN" && q.kind !== "YARD") continue;
        // Mureta baixa em volta do jardim e do pátio
        ctx.fillStyle = CURB;
        ctx.fillRect(q.rect.x - 3, q.rect.y - 3, q.rect.w + 6, 3);
        ctx.fillRect(q.rect.x - 3, q.rect.y + q.rect.h, q.rect.w + 6, 3);
        ctx.fillRect(q.rect.x - 3, q.rect.y, 3, q.rect.h);
        ctx.fillRect(q.rect.x + q.rect.w, q.rect.y, 3, q.rect.h);
      }
    }
  }

  // A ponte do castelo: tábuas, guarda-corpos e a sombra na água
  const b = l.bridge;
  if (hits(b, x0 - 8, y0 - 8, size + 16)) {
    fill({ x: b.x + 4, y: b.y + 4, w: b.w, h: b.h }, "rgba(0,0,0,0.35)");
    fill(b, tiles.PLANKS);
    ctx.fillStyle = "#4a321c";
    ctx.fillRect(b.x, b.y, 5, b.h);
    ctx.fillRect(b.x + b.w - 5, b.y, 5, b.h);
    ctx.fillStyle = "#8a6440";
    ctx.fillRect(b.x + 1, b.y, 2, b.h);
    ctx.fillRect(b.x + b.w - 4, b.y, 2, b.h);
    ctx.fillStyle = "#3a2614";
    for (let y = b.y + 10; y < b.y + b.h; y += 30) {
      ctx.fillRect(b.x - 2, y, 9, 4);
      ctx.fillRect(b.x + b.w - 7, y, 9, 4);
    }
  }

  if (intersect(a, box)) paintStands(ctx, acx, acy, a.w / 2, a.h / 2, a.w * 0.36, a.h * 0.34, y0, y0 + size, true);
}

/**
 * A arquibancada de uma liça (a da Cidade Alta e a do duelo): entre a elipse de fora (rx0, ry0) e
 * a da areia (rx1, ry1), o muro, os degraus com o povo sentado e a cerca; com `tilt`, a barreira
 * da justa no meio da areia. Só as linhas de y0 a y1.
 */
export function paintStands(ctx: CanvasRenderingContext2D, cx: number, cy: number, rx0: number, ry0: number, rx1: number, ry1: number, y0: number, y1: number, tilt: boolean): void {
  // Faixas de fora para dentro: muro, e degraus alternando pedra e banco de madeira
  const bands: [number, string][] = [[1, "#5e584e"], [0.965, "#8f897d"]];
  const tiers = 7;
  for (let k = 0; k < tiers; k++) {
    const f = 0.93 - (k / tiers) * 0.9;
    bands.push([f, "#7a5432"], [f - 0.045, "#8f897d"]);
  }
  bands.push([0.035, "#6b4a2b"]);
  const ring = (f: number, y: number) => halfWidth(rx1 + (rx0 - rx1) * f, ry1 + (ry0 - ry1) * f, y + 0.5 - cy);
  for (let y = Math.max(y0, Math.floor(cy - ry0)); y < Math.min(y1, cy + ry0); y++) {
    for (let k = 0; k < bands.length; k++) {
      const out = ring(bands[k][0], y);
      if (out < 0) continue;
      const inn = k + 1 < bands.length ? ring(bands[k + 1][0], y) : ring(0, y);
      ctx.fillStyle = bands[k][1];
      const o = Math.round(out);
      const i = inn < 0 ? 0 : Math.round(inn);
      if (o - i <= 0) continue;
      ctx.fillRect(Math.round(cx) - o, y, o - i, 1);
      ctx.fillRect(Math.round(cx) + i, y, o - i, 1);
    }
  }
  // O povo nos bancos: cabeça e ombros de cores sorteadas (sempre os mesmos, pela posição)
  const skins = ["#e0b890", "#c89870", "#a87050", "#f0d0b0"];
  const cloth = ["#9a3b2b", "#3a5a8a", "#c9a23a", "#5a7a3a", "#7a5a8a", "#d8d0c0", "#6a4a30", "#2a3a4a"];
  for (let k = 0; k < tiers; k++) {
    const f = 0.93 - (k / tiers) * 0.9 - 0.022;
    const rx = rx1 + (rx0 - rx1) * f;
    const ry = ry1 + (ry0 - ry1) * f;
    const n = Math.round((Math.PI * (rx + ry)) / 4);
    for (let i = 0; i < n; i++) {
      let h = Math.imul(i + 1, 0x27d4eb2d) ^ Math.imul(k + 7, 0x165667b1);
      h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d) >>> 0;
      if (h % 100 > 58) continue;
      const t = (i / n) * Math.PI * 2;
      const px = Math.round(cx + Math.cos(t) * rx);
      const py = Math.round(cy + Math.sin(t) * ry);
      if (py < y0 - 4 || py > y1 + 4) continue;
      ctx.fillStyle = cloth[(h >>> 8) % cloth.length];
      ctx.fillRect(px - 1, py - 1, 3, 3);
      ctx.fillStyle = skins[(h >>> 12) % skins.length];
      ctx.fillRect(px, py - 3, 2, 2);
    }
  }
  if (!tilt) return;
  // A barreira da justa no meio da areia, com os postes
  const bx0 = Math.round(cx - rx1 * 0.7);
  const bx1 = Math.round(cx + rx1 * 0.7);
  const by = Math.round(cy);
  if (by + 6 > y0 && by - 6 < y1) {
    ctx.fillStyle = "rgba(0,0,0,0.3)";
    ctx.fillRect(bx0 + 3, by + 3, bx1 - bx0, 3);
    ctx.fillStyle = "#6b4a2b";
    ctx.fillRect(bx0, by - 3, bx1 - bx0, 4);
    ctx.fillStyle = "#9a7448";
    ctx.fillRect(bx0, by - 3, bx1 - bx0, 1);
    ctx.fillStyle = "#4a321c";
    for (let x = bx0; x <= bx1; x += 24) ctx.fillRect(x, by - 5, 3, 9);
  }
}
