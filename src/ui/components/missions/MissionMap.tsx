import { useEffect, useRef } from "react";
import { BIOME_COLOR } from "../../../game/world/TerrainMap";
import type { MissionPlan, MissionPoint } from "../../../game/data/missionGuide";
import type { WorldDef } from "../../../game/data/world";
import { WORLD, WORLD_HEIGHT, WORLD_WIDTH } from "../../../utils/constants";
import type { Point } from "../../../utils/math";

const W = 320;
const H = 170;

/** Chão do continente, uma vez por mundo: cada célula do relevo vira um pixel. */
const terrainCache = new WeakMap<WorldDef, HTMLCanvasElement>();

function terrainOf(world: WorldDef): HTMLCanvasElement {
  const had = terrainCache.get(world);
  if (had) return had;
  const { cols, rows, biome } = world.geo;
  const canvas = document.createElement("canvas");
  canvas.width = cols;
  canvas.height = rows;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    const img = ctx.createImageData(cols, rows);
    biome.forEach((b, i) => {
      const [r, g, bl] = BIOME_COLOR[b];
      img.data.set([r, g, bl, 255], i * 4);
    });
    ctx.putImageData(img, 0, 0);
  }
  terrainCache.set(world, canvas);
  return canvas;
}

/** Janela do mundo que mostra todos os pontos, com folga e na proporção do desenho. */
function frameOf(points: readonly Point[]): { x: number; y: number; w: number; h: number } {
  const minW = WORLD.REGION_WIDTH * 1.2;
  const x0 = Math.min(...points.map((p) => p.x));
  const x1 = Math.max(...points.map((p) => p.x));
  const y0 = Math.min(...points.map((p) => p.y));
  const y1 = Math.max(...points.map((p) => p.y));
  const w = Math.min(WORLD_WIDTH, Math.max(minW, (x1 - x0) * 1.35, ((y1 - y0) * 1.35 * W) / H));
  const h = (w * H) / W;
  const x = Math.max(0, Math.min(WORLD_WIDTH - w, (x0 + x1) / 2 - w / 2));
  const y = Math.max(0, Math.min(Math.max(0, WORLD_HEIGHT - h), (y0 + y1) / 2 - h / 2));
  return { x, y, w, h };
}

/** Minimapa do serviço: onde o bando está, de onde sai, para onde vai e por onde passa. */
export function MissionMap({ world, plan, army, who = "Você" }: { world: WorldDef; plan: MissionPlan; army: Point | null; who?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const ctx = ref.current?.getContext("2d");
    if (!ctx) return;
    const marks: { p: MissionPoint; color: string; text: string }[] = [];
    if (plan.from) marks.push({ p: plan.from, color: "#34d399", text: `Saída: ${plan.from.name}` });
    if (plan.to) marks.push({ p: plan.to, color: "#fbbf24", text: `${plan.from ? "Chegada: " : ""}${plan.to.name}` });
    const anchors: Point[] = [...marks.map((m) => m.p), ...plan.route, ...(army ? [army] : [])];
    if (anchors.length === 0) return;
    const f = frameOf(anchors);
    const k = W / f.w;
    const sx = (p: Point) => (p.x - f.x) * k;
    const sy = (p: Point) => (p.y - f.y) * k;

    ctx.imageSmoothingEnabled = true;
    ctx.fillStyle = "#1e466e";
    ctx.fillRect(0, 0, W, H);
    const cell = world.geo.cell;
    ctx.drawImage(terrainOf(world), f.x / cell, f.y / cell, f.w / cell, f.h / cell, 0, 0, W, H);
    ctx.fillStyle = "rgba(0,0,0,0.32)";
    ctx.fillRect(0, 0, W, H);

    if (plan.route.length > 1) {
      ctx.strokeStyle = "#fde68a";
      ctx.lineWidth = 2.5;
      ctx.setLineDash([7, 5]);
      ctx.beginPath();
      plan.route.forEach((p, i) => (i === 0 ? ctx.moveTo(sx(p), sy(p)) : ctx.lineTo(sx(p), sy(p))));
      ctx.stroke();
      ctx.setLineDash([]);
    }
    if (army) {
      const first = plan.from ?? plan.to;
      if (first) {
        ctx.strokeStyle = "rgba(147,197,253,0.7)";
        ctx.lineWidth = 1.5;
        ctx.setLineDash([3, 4]);
        ctx.beginPath();
        ctx.moveTo(sx(army), sy(army));
        ctx.lineTo(sx(first), sy(first));
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }

    ctx.font = "bold 12px system-ui, sans-serif";
    ctx.textBaseline = "middle";
    const note = (text: string, x: number, y: number, color: string) => {
      const width = ctx.measureText(text).width;
      const left = Math.max(2, Math.min(W - width - 2, x + 10));
      ctx.lineWidth = 3;
      ctx.strokeStyle = "rgba(0,0,0,0.85)";
      ctx.strokeText(text, left, y);
      ctx.fillStyle = color;
      ctx.fillText(text, left, y);
    };
    for (const m of marks) {
      ctx.fillStyle = m.color;
      ctx.strokeStyle = "#111";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(sx(m.p), sy(m.p), 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      note(m.text, sx(m.p), sy(m.p), m.color);
    }
    if (army) {
      ctx.fillStyle = "#60a5fa";
      ctx.strokeStyle = "#fff";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(sx(army), sy(army), 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      note(who, sx(army), sy(army), "#bfdbfe");
    }
  }, [world, plan, army, who]);

  return <canvas ref={ref} width={W} height={H} role="img" aria-label="Mapa do serviço" className="w-full max-w-sm rounded border border-neutral-700" />;
}
