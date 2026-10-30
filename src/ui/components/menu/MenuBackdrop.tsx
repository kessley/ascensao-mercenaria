import { useEffect, useRef } from "react";
import { createRng } from "../../../game/worldgen/rng";

interface Ember {
  x: number;
  y: number;
  speed: number;
  drift: number;
  size: number;
  phase: number;
}

/** Linha de serra: altura de cada ponto, somando ondas com a mesma semente de sempre. */
function ridge(seed: number, w: number, base: number, rough: number): number[] {
  const rng = createRng(seed);
  const waves = Array.from({ length: 5 }, (_, i) => ({ f: (i + 1) * rng.range(0.6, 1.4), p: rng.range(0, 6.3), a: rough / (i + 1) }));
  const out: number[] = [];
  for (let x = 0; x <= w; x += 8) out.push(base + waves.reduce((n, o) => n + Math.sin((x / w) * 6.3 * o.f + o.p) * o.a, 0));
  return out;
}

function fillRidge(ctx: CanvasRenderingContext2D, line: readonly number[], w: number, h: number, color: string): void {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(0, h);
  line.forEach((y, i) => ctx.lineTo(i * 8, y));
  ctx.lineTo(w, h);
  ctx.closePath();
  ctx.fill();
}

/** Céu de fim de batalha, serras e os dois exércitos em greybox: círculos contra quadrados. */
function paintScene(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  const sky = ctx.createLinearGradient(0, 0, 0, h * 0.74);
  sky.addColorStop(0, "#0d0b12");
  sky.addColorStop(0.5, "#2a1418");
  sky.addColorStop(0.82, "#7c3218");
  sky.addColorStop(1, "#c8682a");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, h);

  const sun = ctx.createRadialGradient(w * 0.68, h * 0.66, 0, w * 0.68, h * 0.66, h * 0.42);
  sun.addColorStop(0, "rgba(255,190,110,0.75)");
  sun.addColorStop(0.2, "rgba(240,130,60,0.3)");
  sun.addColorStop(1, "rgba(240,130,60,0)");
  ctx.fillStyle = sun;
  ctx.fillRect(0, 0, w, h);

  fillRidge(ctx, ridge(11, w, h * 0.6, h * 0.05), w, h, "#4a2320");
  fillRidge(ctx, ridge(23, w, h * 0.67, h * 0.04), w, h, "#301a1b");
  const field = ridge(37, w, h * 0.76, h * 0.016);
  fillRidge(ctx, field, w, h, "#1a1216");

  const ground = (x: number) => field[Math.max(0, Math.min(field.length - 1, Math.round(x / 8)))];
  const rng = createRng(5);
  const unit = Math.max(3, h * 0.0075);
  // Cada lado em blocos, com um estandarte por bloco
  const block = (x0: number, rows: number, cols: number, color: string, square: boolean) => {
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const x = x0 + c * unit * 3.2 + r * unit * 1.2 + rng.range(-1, 1);
        const y = ground(x) + 2 + r * unit * 2.1 + rng.range(-1, 1);
        ctx.fillStyle = color;
        ctx.beginPath();
        if (square) ctx.rect(x - unit, y - unit, unit * 2, unit * 2);
        else ctx.arc(x, y, unit, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    const fx = x0 + (cols / 2) * unit * 3.2;
    const fy = ground(fx) - unit * 7;
    ctx.strokeStyle = "#0f0c0e";
    ctx.lineWidth = Math.max(1.5, unit * 0.4);
    ctx.beginPath();
    ctx.moveTo(fx, fy);
    ctx.lineTo(fx, fy + unit * 8);
    ctx.stroke();
    ctx.fillStyle = color;
    ctx.fillRect(fx, fy, unit * 3.4, unit * 2.2);
  };
  const size = w / 100;
  for (const at of [34, 44, 54]) block(size * at, 4, 8, "#5f8fc4", false);
  for (const at of [72, 81, 90]) block(size * at, 4, 7, "#b5442f", true);

  // Escurece onde fica o menu e a base da tela
  const veil = ctx.createLinearGradient(0, 0, w, 0);
  veil.addColorStop(0, "rgba(8,6,9,0.94)");
  veil.addColorStop(0.3, "rgba(8,6,9,0.72)");
  veil.addColorStop(0.55, "rgba(8,6,9,0.08)");
  veil.addColorStop(1, "rgba(8,6,9,0)");
  ctx.fillStyle = veil;
  ctx.fillRect(0, 0, w, h);
  const floor = ctx.createLinearGradient(0, h * 0.8, 0, h);
  floor.addColorStop(0, "rgba(8,6,9,0)");
  floor.addColorStop(1, "rgba(8,6,9,0.85)");
  ctx.fillStyle = floor;
  ctx.fillRect(0, h * 0.8, w, h * 0.2);
}

/** Fundo do menu: a cena pintada uma vez e fagulhas subindo por cima. */
export function MenuBackdrop() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const scene = document.createElement("canvas");
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let embers: Ember[] = [];
    let frame = 0;
    const seedEmber = (w: number, h: number, anywhere: boolean): Ember => ({
      x: Math.random() * w,
      y: anywhere ? Math.random() * h : h * (0.7 + Math.random() * 0.3),
      speed: 14 + Math.random() * 34,
      drift: 8 + Math.random() * 18,
      size: 0.8 + Math.random() * 1.8,
      phase: Math.random() * 6.3,
    });
    const resize = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      canvas.width = w;
      canvas.height = h;
      scene.width = w;
      scene.height = h;
      const sceneCtx = scene.getContext("2d");
      if (sceneCtx) paintScene(sceneCtx, w, h);
      embers = Array.from({ length: Math.round(w / 22) }, () => seedEmber(w, h, true));
      ctx.drawImage(scene, 0, 0);
    };
    resize();
    window.addEventListener("resize", resize);
    let last = performance.now();
    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const w = canvas.width;
      const h = canvas.height;
      ctx.drawImage(scene, 0, 0);
      for (let i = 0; i < embers.length; i++) {
        const e = embers[i];
        e.y -= e.speed * dt;
        e.x += Math.sin(now / 900 + e.phase) * e.drift * dt;
        if (e.y < h * 0.15) embers[i] = seedEmber(w, h, false);
        const fade = Math.min(1, (e.y - h * 0.15) / (h * 0.25));
        ctx.fillStyle = `rgba(255,${150 + Math.round(70 * Math.sin(now / 300 + e.phase) ** 2)},80,${0.75 * fade})`;
        ctx.fillRect(e.x, e.y, e.size, e.size);
      }
      frame = requestAnimationFrame(tick);
    };
    if (!still) frame = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return <canvas ref={canvasRef} aria-hidden className="absolute inset-0 h-full w-full" />;
}
