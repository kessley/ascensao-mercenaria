import type { CapitalLayout, CityBuilding } from "./capitalLayout";
import type { Rect } from "./townLayout";
import type { Point } from "../../utils/math";

/**
 * Pintura da Cidade Alta em canvas 2D (Marco 15), por pedaços: são mais de mil prédios, e num
 * objeto Graphics isso pesaria em todo quadro. Cada pedaço vira uma textura uma vez só.
 */

const ROOFS = ["#8e4a2b", "#7a3b22", "#9c6b3c", "#6b5a4a", "#5b5046", "#4e4a3e", "#66594a", "#3a6a8a", "#8a3a3a", "#3a7a5a"];
const OUTLINE = "#1a1a1a";

const hex = (c: number) => `#${c.toString(16).padStart(6, "0")}`;
const hits = (a: Rect, x: number, y: number, s: number) => a.x < x + s && a.x + a.w > x && a.y < y + s && a.y + a.h > y;
const near = (p: Point, x: number, y: number, s: number, pad = 60) => p.x > x - pad && p.x < x + s + pad && p.y > y - pad && p.y < y + s + pad;

function rect(ctx: CanvasRenderingContext2D, r: Rect, fill: string, stroke?: string, width = 2): void {
  ctx.fillStyle = fill;
  ctx.fillRect(r.x, r.y, r.w, r.h);
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = width;
    ctx.strokeRect(r.x, r.y, r.w, r.h);
  }
}

function roofed(ctx: CanvasRenderingContext2D, b: CityBuilding): void {
  const r = b.rect;
  rect(ctx, r, ROOFS[b.roof % ROOFS.length], OUTLINE, 2);
  ctx.fillStyle = "rgba(0,0,0,0.18)";
  ctx.fillRect(r.x + r.w / 2, r.y, r.w / 2, r.h);
  ctx.strokeStyle = "rgba(0,0,0,0.35)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  if (r.w > r.h) {
    ctx.moveTo(r.x, r.y + r.h / 2);
    ctx.lineTo(r.x + r.w, r.y + r.h / 2);
  } else {
    ctx.moveTo(r.x + r.w / 2, r.y);
    ctx.lineTo(r.x + r.w / 2, r.y + r.h);
  }
  ctx.stroke();
  ctx.fillStyle = "#2a1c10";
  ctx.fillRect(b.door.x - 8, b.door.y < r.y ? r.y - 2 : r.y + r.h - 4, 16, 6);
}

function palace(ctx: CanvasRenderingContext2D, b: CityBuilding, color: string): void {
  const r = b.rect;
  rect(ctx, r, "#a8a092", OUTLINE, 3);
  rect(ctx, { x: r.x + r.w * 0.28, y: r.y + r.h * 0.22, w: r.w * 0.44, h: r.h * 0.5 }, "#5f8a52", OUTLINE, 2);
  ctx.fillStyle = ROOFS[b.roof % 4];
  ctx.fillRect(r.x + 8, r.y + 8, r.w - 16, r.h * 0.16);
  ctx.fillRect(r.x + 8, r.y + r.h * 0.76, r.w - 16, r.h * 0.16);
  ctx.fillStyle = color;
  ctx.fillRect(b.door.x - 22, r.y + r.h - 8, 44, 10);
  ctx.fillStyle = "#2a1c10";
  ctx.fillRect(b.door.x - 12, r.y + r.h - 4, 24, 8);
}

function keep(ctx: CanvasRenderingContext2D, b: CityBuilding, color: string): void {
  const r = b.rect;
  rect(ctx, r, "#8d877c", OUTLINE, 4);
  rect(ctx, { x: r.x + r.w * 0.2, y: r.y + r.h * 0.2, w: r.w * 0.6, h: r.h * 0.6 }, "#6e685e", OUTLINE, 2);
  for (const [x, y] of [[r.x, r.y], [r.x + r.w, r.y], [r.x, r.y + r.h], [r.x + r.w, r.y + r.h]]) {
    ctx.fillStyle = "#77716a";
    ctx.beginPath();
    ctx.arc(x, y, Math.min(r.w, r.h) * 0.13, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 3;
    ctx.stroke();
  }
  ctx.fillStyle = color;
  ctx.fillRect(b.door.x - 26, r.y + r.h - 14, 52, 14);
  ctx.fillStyle = "#2a1c10";
  ctx.fillRect(b.door.x - 18, r.y + r.h - 10, 36, 12);
}

function temple(ctx: CanvasRenderingContext2D, b: CityBuilding): void {
  const r = b.rect;
  rect(ctx, r, "#d9d2bf", OUTLINE, 3);
  ctx.fillStyle = "#8a7f62";
  ctx.fillRect(r.x + r.w / 2 - r.w * 0.06, r.y + 20, r.w * 0.12, r.h - 40);
  ctx.fillRect(r.x + 30, r.y + r.h * 0.34, r.w - 60, r.h * 0.12);
  ctx.fillStyle = "#b8a878";
  ctx.beginPath();
  ctx.arc(r.x + r.w / 2, r.y + r.h * 0.4, Math.min(r.w, r.h) * 0.16, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = OUTLINE;
  ctx.stroke();
  ctx.fillStyle = "#2a1c10";
  ctx.fillRect(b.door.x - 20, r.y + r.h - 10, 40, 12);
}

function arena(ctx: CanvasRenderingContext2D, r: Rect): void {
  const cx = r.x + r.w / 2;
  const cy = r.y + r.h / 2;
  ctx.fillStyle = "#8a7f62";
  ctx.beginPath();
  ctx.ellipse(cx, cy, r.w / 2, r.h / 2, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = OUTLINE;
  ctx.lineWidth = 4;
  ctx.stroke();
  ctx.fillStyle = "#d8c070";
  ctx.beginPath();
  ctx.ellipse(cx, cy, r.w * 0.36, r.h * 0.34, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#6b4a2b";
  ctx.lineWidth = 6;
  ctx.stroke();
  ctx.strokeStyle = "#7a6a4a";
  ctx.lineWidth = 2;
  for (let k = 1; k < 3; k++) {
    ctx.beginPath();
    ctx.ellipse(cx, cy, r.w * (0.36 + k * 0.045), r.h * (0.34 + k * 0.05), 0, 0, Math.PI * 2);
    ctx.stroke();
  }
}

/** Pinta um pedaço da cidade (x, y, tamanho em px da cidade) num canvas de `tex` px. */
export function paintCapitalChunk(ctx: CanvasRenderingContext2D, l: CapitalLayout, x0: number, y0: number, size: number, tex: number, realm: number): void {
  const color = hex(realm);
  const scale = tex / size;
  ctx.setTransform(scale, 0, 0, scale, -x0 * scale, -y0 * scale);
  ctx.fillStyle = "#7d6f50";
  ctx.fillRect(x0, y0, size, size);

  for (const s of l.streets) if (hits(s, x0, y0, size)) rect(ctx, s, "#a4957a");
  for (const p of l.plazas) {
    if (!hits(p.rect, x0, y0, size)) continue;
    const fill = { PLAZA: "#b8ad94", MARKET: "#a89f86", GARDEN: "#5f8a52", YARD: "#b7a678", CEMETERY: "#6a7a52", BAILEY: "#a89b7d", NOBLE_GROUND: "#88966a" }[p.kind];
    rect(ctx, p.rect, fill, p.kind === "PLAZA" || p.kind === "MARKET" ? "#6b6250" : undefined, 4);
  }
  // Ruas por dentro do Bairro Nobre: pedra clara
  for (const s of l.streets) {
    if (!hits(s, x0, y0, size)) continue;
    const inter = intersect(s, l.nobleRect);
    if (inter) rect(ctx, inter, "#c0b8a4");
    const yard = intersect(s, l.castleRect);
    if (yard) rect(ctx, yard, "#a89b7d");
  }
  for (const m of l.moat) if (hits(m, x0, y0, size)) rect(ctx, m, "#2f5f7f");
  if (hits(l.bridge, x0, y0, size)) {
    rect(ctx, l.bridge, "#6b4a2b", OUTLINE, 2);
    ctx.strokeStyle = "rgba(0,0,0,0.4)";
    ctx.lineWidth = 2;
    for (let y = l.bridge.y + 12; y < l.bridge.y + l.bridge.h; y += 18) {
      ctx.beginPath();
      ctx.moveTo(l.bridge.x, y);
      ctx.lineTo(l.bridge.x + l.bridge.w, y);
      ctx.stroke();
    }
  }
  if (hits(l.arena, x0, y0, size)) arena(ctx, l.arena);
  for (const t of l.tombs) {
    if (!near(t, x0, y0, size)) continue;
    ctx.fillStyle = "#c8c2b0";
    ctx.fillRect(t.x - 7, t.y - 10, 14, 20);
  }
  for (const s of l.stalls) {
    if (!hits(s, x0, y0, size)) continue;
    rect(ctx, s, ["#b84a3a", "#3a6ab8", "#c9a23a", "#3a9a5a"][Math.round(s.x + s.y) % 4], OUTLINE, 2);
    ctx.fillStyle = "rgba(240,230,210,0.8)";
    for (let k = 0; k < s.w; k += 22) ctx.fillRect(s.x + k, s.y, 10, s.h);
  }
  for (const b of l.buildings) {
    if (!hits(b.rect, x0, y0, size)) continue;
    if (b.kind === "PALACE") palace(ctx, b, color);
    else if (b.kind === "KEEP") keep(ctx, b, color);
    else if (b.kind === "TEMPLE") temple(ctx, b);
    else if (b.kind !== "ARENA") roofed(ctx, b);
  }
  for (const f of l.fountains) {
    if (!near(f, x0, y0, size)) continue;
    ctx.fillStyle = "#77716a";
    ctx.beginPath();
    ctx.arc(f.x, f.y, 46, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#3a7a9a";
    ctx.beginPath();
    ctx.arc(f.x, f.y, 34, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#c8c2b0";
    ctx.beginPath();
    ctx.arc(f.x, f.y, 10, 0, Math.PI * 2);
    ctx.fill();
  }
  for (const t of l.trees) {
    if (!near(t, x0, y0, size)) continue;
    ctx.fillStyle = "#2f5a26";
    ctx.beginPath();
    ctx.arc(t.x, t.y, 22, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#3f7a34";
    ctx.beginPath();
    ctx.arc(t.x - 5, t.y - 6, 12, 0, Math.PI * 2);
    ctx.fill();
  }
  // Muralhas com ameias e torres
  for (const w of l.walls) {
    if (!hits(w, x0, y0, size)) continue;
    rect(ctx, w, "#8a8478", OUTLINE, 2);
    ctx.fillStyle = "#6c675d";
    const along = w.w > w.h;
    const len = along ? w.w : w.h;
    for (let d = 10; d < len - 10; d += 26) {
      if (along) ctx.fillRect(w.x + d, w.y + 4, 12, w.h * 0.3);
      else ctx.fillRect(w.x + 4, w.y + d, w.w * 0.3, 12);
    }
  }
  for (const t of l.towers) {
    if (!hits(t, x0, y0, size)) continue;
    rect(ctx, t, "#77716a", OUTLINE, 3);
    rect(ctx, { x: t.x + t.w * 0.25, y: t.y + t.h * 0.25, w: t.w * 0.5, h: t.h * 0.5 }, "#5f5a52");
  }
  // Estandartes do reino ao longo da avenida
  for (let y = 2800; y < l.h - 300; y += 640) {
    for (const x of [l.w / 2 - 136, l.w / 2 + 136]) {
      if (!near({ x, y }, x0, y0, size)) continue;
      ctx.fillStyle = "#3a2a14";
      ctx.fillRect(x - 3, y - 36, 6, 50);
      ctx.fillStyle = color;
      ctx.fillRect(x + 3, y - 36, 30, 22);
      ctx.strokeStyle = OUTLINE;
      ctx.lineWidth = 1;
      ctx.strokeRect(x + 3, y - 36, 30, 22);
    }
  }
}

function intersect(a: Rect, b: Rect): Rect | null {
  const x = Math.max(a.x, b.x);
  const y = Math.max(a.y, b.y);
  const r = Math.min(a.x + a.w, b.x + b.w);
  const t = Math.min(a.y + a.h, b.y + b.h);
  return r > x && t > y ? { x, y, w: r - x, h: t - y } : null;
}
