import { useEffect, useRef } from "react";
import { CULTURES, PLANET_HEIGHT, PLANET_WIDTH, type CultureId, type PlanetDef } from "../../../game/data/planet";

const LAND: Record<CultureId, string> = { REALMS: "#6f8f4e", SANDS: "#c9a25c", ISLES: "#8fa3a8", JADE: "#4f8f6a" };

interface Props {
  planet: PlanetDef;
  /** Onde o bando está. */
  here: string;
  /** Continentes conhecidos (cartas e visitas). */
  known: readonly string[];
  /** Viagem em curso: de onde, para onde e quanto já andou. */
  route?: { from: string; to: string; share: number } | null;
  onPick?: (id: string) => void;
  selected?: string | null;
}

/** O planeta: oceanos, as terras conhecidas e o contorno das outras, nunca mais que isso. */
export function PlanetMap({ planet, here, known, route, onPick, selected }: Props) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const ctx = ref.current?.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = "#14324a";
    ctx.fillRect(0, 0, PLANET_WIDTH, PLANET_HEIGHT);
    ctx.strokeStyle = "rgba(255,255,255,0.05)";
    ctx.lineWidth = 1;
    for (let x = 0; x <= PLANET_WIDTH; x += 100) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, PLANET_HEIGHT);
      ctx.stroke();
    }
    for (let y = 0; y <= PLANET_HEIGHT; y += 100) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(PLANET_WIDTH, y);
      ctx.stroke();
    }
    for (const c of planet.continents) {
      const seen = known.includes(c.id);
      ctx.beginPath();
      c.coast.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
      ctx.closePath();
      ctx.fillStyle = seen ? LAND[c.culture] : "rgba(160,190,210,0.12)";
      ctx.fill();
      ctx.strokeStyle = c.id === selected ? "#fbbf24" : seen ? "rgba(240,230,200,0.8)" : "rgba(200,220,235,0.35)";
      ctx.lineWidth = c.id === selected ? 3 : 1.5;
      ctx.setLineDash(seen ? [] : [5, 5]);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.textAlign = "center";
      ctx.fillStyle = seen ? "#fff7e0" : "rgba(220,235,245,0.6)";
      ctx.font = "bold 16px Georgia, serif";
      ctx.fillText(seen ? c.name : "Terra sem carta", c.x, c.y);
      ctx.font = "12px sans-serif";
      if (seen) ctx.fillText(CULTURES[c.culture].label, c.x, c.y + 18);
    }
    const at = planet.continents.find((c) => c.id === here);
    if (route) {
      const a = planet.continents.find((c) => c.id === route.from);
      const b = planet.continents.find((c) => c.id === route.to);
      if (a && b) {
        ctx.strokeStyle = "#fbbf24";
        ctx.lineWidth = 2;
        ctx.setLineDash([8, 6]);
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
        ctx.setLineDash([]);
        const x = a.x + (b.x - a.x) * route.share;
        const y = a.y + (b.y - a.y) * route.share;
        ctx.fillStyle = "#fff";
        ctx.strokeStyle = "#0b2536";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(x - 12, y + 4);
        ctx.lineTo(x + 12, y + 4);
        ctx.lineTo(x + 7, y + 10);
        ctx.lineTo(x - 7, y + 10);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(x, y + 3);
        ctx.lineTo(x, y - 12);
        ctx.lineTo(x + 9, y - 2);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      }
    } else if (at) {
      ctx.fillStyle = "#e0b040";
      ctx.strokeStyle = "#2a1c10";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(at.x, at.y - 30, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
  }, [planet, here, known, route, selected]);

  const click = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const box = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - box.left) / box.width) * PLANET_WIDTH;
    const y = ((e.clientY - box.top) / box.height) * PLANET_HEIGHT;
    const hit = planet.continents.reduce((best, c) => (Math.hypot(c.x - x, c.y - y) < Math.hypot(best.x - x, best.y - y) ? c : best));
    if (Math.hypot(hit.x - x, hit.y - y) < 170) onPick?.(hit.id);
  };

  return <canvas ref={ref} width={PLANET_WIDTH} height={PLANET_HEIGHT} role="img" aria-label="Mapa Múndi" onClick={onPick ? click : undefined} className={`w-full rounded border border-neutral-700 ${onPick ? "cursor-pointer" : ""}`} />;
}
