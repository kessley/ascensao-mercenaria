import { useEffect, useMemo, useRef, useState } from "react";
import { useGameStore, type WorldSnapshot } from "../../store/useGameStore";
import { pointsOfInterest, regionName, travelDaysBetween, type WorldDef } from "../../game/data/world";
import { PALISADE } from "../../game/data/campLayout";
import { isCalamityOwner, type Calamity, type Settlement } from "../../game/sim/realm";
import { WORLD, WORLD_COLS, WORLD_HEIGHT, WORLD_ROWS, WORLD_WIDTH } from "../../utils/constants";
import { dailyRations } from "../../utils/economy";
import { distance, type Point } from "../../utils/math";
import { Button } from "../components/Button";

export const MAP_W = 1024;
export const MAP_H = (MAP_W * WORLD_HEIGHT) / WORLD_WIDTH;
const SCALE = MAP_W / WORLD_WIDTH;
/** Clique a menos disto (px do mundo) de um local conhecido escolhe o local. */
const SNAP_RADIUS = 450;

const ZONE_FILL: Record<string, string> = {
  HILL: "#6f8f3a",
  MUD: "#6b4f2e",
  SWAMP: "#3f5240",
  FOREST: "#22501c",
};

const hex = (c: number) => `#${c.toString(16).padStart(6, "0")}`;

/** Cor da bandeira de um povoado no mapa. */
function ownerFill(world: WorldDef, calamities: readonly Calamity[], owner: string): string {
  if (owner === "PLAYER") return "#2f6fdf";
  if (owner === "FREE") return "#f0e6d2";
  if (owner === "RUINED") return "#3a3a3a";
  if (isCalamityOwner(owner)) return calamities.find((c) => c.id === owner)?.kind === "NECROMANCER" ? "#5b2c6f" : "#2f4a16";
  const f = world.factions.find((x) => x.id === owner);
  return f ? hex(f.color) : "#ffffff";
}

export interface MapLayers {
  world: WorldDef;
  settlements: readonly Settlement[];
  calamities: readonly Calamity[];
  /** Névoa e exércitos (null = mapa inteiro revelado, como na criação do mundo). */
  snap: WorldSnapshot | null;
  contractSiteId: string | null;
  dest: Destination | null;
  /** Mostrar a grade das regiões (prévia do mundo). */
  regions?: boolean;
}

interface Destination {
  point: Point;
  name: string;
}

/** Desenha o mundo (terreno, estradas, povoados com a cor do dono, locais, névoa e exércitos). */
export function drawWorldMap(ctx: CanvasRenderingContext2D, layers: MapLayers): void {
  const { world, settlements, calamities, snap, contractSiteId, dest } = layers;
  const s = SCALE;
  ctx.clearRect(0, 0, MAP_W, MAP_H);
  ctx.fillStyle = "#3a7d2c";
  ctx.fillRect(0, 0, MAP_W, MAP_H);

  for (const z of world.terrain) {
    ctx.fillStyle = ZONE_FILL[z.type];
    ctx.beginPath();
    ctx.ellipse(z.x * s, z.y * s, z.rx * s, z.ry * s, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.strokeStyle = "rgba(141,123,82,0.85)";
  ctx.lineWidth = 3;
  ctx.lineJoin = "round";
  for (const road of world.roads) {
    ctx.beginPath();
    road.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x * s, p.y * s) : ctx.lineTo(p.x * s, p.y * s)));
    ctx.stroke();
  }

  ctx.font = "11px monospace";
  ctx.textAlign = "center";
  const label = (text: string, p: Point, dy: number, color: string) => {
    ctx.fillStyle = "rgba(0,0,0,0.7)";
    ctx.fillText(text, p.x * s + 1, p.y * s + dy + 1);
    ctx.fillStyle = color;
    ctx.fillText(text, p.x * s, p.y * s + dy);
  };

  if (layers.regions) {
    ctx.strokeStyle = "rgba(255,255,255,0.12)";
    ctx.lineWidth = 1;
    for (let c = 1; c < WORLD_COLS; c++) {
      ctx.beginPath();
      ctx.moveTo(c * WORLD.REGION_WIDTH * s, 0);
      ctx.lineTo(c * WORLD.REGION_WIDTH * s, MAP_H);
      ctx.stroke();
    }
    for (let r = 1; r < WORLD_ROWS; r++) {
      ctx.beginPath();
      ctx.moveTo(0, r * WORLD.REGION_HEIGHT * s);
      ctx.lineTo(MAP_W, r * WORLD.REGION_HEIGHT * s);
      ctx.stroke();
    }
  }

  // Névoa: uma célula = um pixel numa imagem pequena, ampliada com suavização
  if (snap) {
    const fog = new ImageData(snap.cols, snap.rows);
    for (let i = 0; i < snap.cols * snap.rows; i++) {
      const v = snap.fog.charCodeAt(i) - 48;
      fog.data[i * 4] = 10;
      fog.data[i * 4 + 1] = 13;
      fog.data[i * 4 + 2] = 10;
      fog.data[i * 4 + 3] = v === 2 ? 0 : v === 1 ? 107 : 224;
    }
    const small = document.createElement("canvas");
    small.width = snap.cols;
    small.height = snap.rows;
    small.getContext("2d")?.putImageData(fog, 0, 0);
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(small, 0, 0, snap.cols * snap.cell * s, snap.rows * snap.cell * s);
  }

  // Acampamento, povoados (cor do dono) e locais de contrato
  ctx.strokeStyle = "#e0b040";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.ellipse(world.camp.center.x * s, world.camp.center.y * s, PALISADE.rx * s, PALISADE.ry * s, 0, 0, Math.PI * 2);
  ctx.stroke();
  label("Acampamento", world.camp.center, -PALISADE.ry * s - 6, "#ffe9b0");
  for (const t of settlements) {
    const size = t.kind === "CITY" ? 18 : t.kind === "FORT" ? 15 : 11;
    ctx.fillStyle = ownerFill(world, calamities, t.owner);
    ctx.fillRect(t.x * s - size / 2, t.y * s - size / 2, size, size);
    ctx.strokeStyle = "#111";
    ctx.lineWidth = 1.5;
    ctx.strokeRect(t.x * s - size / 2, t.y * s - size / 2, size, size);
    label(t.owner === "RUINED" ? `${t.name} (ruínas)` : t.name, t, -size / 2 - 4, t.owner === "PLAYER" ? "#9cc4ff" : "#ffe9b0");
  }
  for (const site of world.sites) {
    const active = site.id === contractSiteId;
    ctx.strokeStyle = active ? "#fbbf24" : "rgba(232,200,160,0.5)";
    ctx.lineWidth = active ? 3 : 1.5;
    ctx.beginPath();
    ctx.arc(site.center.x * s, site.center.y * s, active ? 14 : 8, 0, Math.PI * 2);
    ctx.stroke();
    label(active ? `★ ${site.name}` : site.name, site.center, -14, active ? "#fbbf24" : "#e8c8a0");
  }

  if (!snap) return;

  // Covis de calamidade já descobertos
  for (const c of snap.calamityLairs) {
    ctx.fillStyle = "#5b1f2f";
    ctx.beginPath();
    ctx.arc(c.x * s, c.y * s, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#ff6b6b";
    ctx.lineWidth = 2;
    ctx.stroke();
    label(`☠ ${c.name}`, c, -14, "#ff9a8a");
  }

  // Bandos e exércitos: à vista (com rumo) ou na última posição conhecida
  for (const w of snap.warbands) {
    const size = 6 + Math.min(10, w.count / 2);
    ctx.globalAlpha = w.visible ? 1 : 0.45;
    if (w.visible && w.heading) {
      ctx.strokeStyle = "#ff8a7a";
      ctx.setLineDash([4, 4]);
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(w.x * s, w.y * s);
      ctx.lineTo(w.heading.x * s, w.heading.y * s);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    ctx.fillStyle = "#c0392b";
    ctx.fillRect(w.x * s - size / 2, w.y * s - size / 2, size, size);
    ctx.strokeStyle = "#111";
    ctx.lineWidth = 1;
    ctx.strokeRect(w.x * s - size / 2, w.y * s - size / 2, size, size);
    label(`${w.visible ? "" : "?"}${w.count}`, w, size + 8, "#ffb4a8");
    ctx.globalAlpha = 1;
  }

  ctx.fillStyle = "#2f6fdf";
  for (const b of snap.battalions) {
    ctx.beginPath();
    ctx.arc(b.x * s, b.y * s, 3, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.strokeStyle = "#e0b040";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(snap.commander.x * s, snap.commander.y * s, 6, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  if (dest) {
    ctx.strokeStyle = "#ffffff";
    ctx.setLineDash([6, 5]);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(snap.commander.x * s, snap.commander.y * s);
    ctx.lineTo(dest.point.x * s, dest.point.y * s);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.arc(dest.point.x * s, dest.point.y * s, 7, 0, Math.PI * 2);
    ctx.stroke();
  }
}

/** A célula da névoa no ponto já foi explorada? */
function explored(snap: WorldSnapshot, p: Point): boolean {
  const col = Math.floor(p.x / snap.cell);
  const row = Math.floor(p.y / snap.cell);
  if (col < 0 || row < 0 || col >= snap.cols || row >= snap.rows) return false;
  return snap.fog[row * snap.cols + col] !== "0";
}

/**
 * Mapa Múndi (Tab): visão distanciada do mundo para viagem rápida e para observar
 * movimentos de exércitos dentro do que as tropas enxergam (ou a última posição conhecida).
 * Com ele aberto o mundo fica em pausa. A viagem passa os dias da marcha de verdade.
 */
export function WorldMapView() {
  const open = useGameStore((s) => s.worldMapOpen);
  const world = useGameStore((s) => s.world);
  const settlements = useGameStore((s) => s.settlements);
  const calamities = useGameStore((s) => s.calamities);
  const snap = useGameStore((s) => s.worldSnapshot);
  const activeContract = useGameStore((s) => s.activeContract);
  const battalions = useGameStore((s) => s.battalions);
  const rations = useGameStore((s) => s.rations);
  const engaged = useGameStore((s) => s.battleHud?.engaged ?? false);
  const setWorldMapOpen = useGameStore((s) => s.setWorldMapOpen);
  const sendBattleCommand = useGameStore((s) => s.sendBattleCommand);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [dest, setDest] = useState<Destination | null>(null);

  const contractSiteId = activeContract?.contract.siteId ?? null;

  useEffect(() => {
    if (!open) setDest(null);
  }, [open]);

  useEffect(() => {
    const ctx = canvasRef.current?.getContext("2d");
    if (ctx && world) drawWorldMap(ctx, { world, settlements, calamities, snap, contractSiteId, dest });
  }, [world, settlements, calamities, snap, contractSiteId, dest, open]);

  const plan = useMemo(() => {
    if (!dest || !snap) return null;
    const days = travelDaysBetween(snap.commander, dest.point);
    const food = Math.ceil(days * dailyRations(battalions));
    const known = explored(snap, dest.point);
    const bandsNearRoute = snap.warbands.filter((w) => {
      const a = snap.commander;
      const b = dest.point;
      const len2 = (b.x - a.x) ** 2 + (b.y - a.y) ** 2 || 1;
      const t = Math.max(0, Math.min(1, ((w.x - a.x) * (b.x - a.x) + (w.y - a.y) * (b.y - a.y)) / len2));
      return distance(w, { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }) < WORLD.INTERCEPT_RADIUS * 2.5;
    });
    return { days, food, known, bandsNearRoute };
  }, [dest, snap, battalions]);

  if (!open || !world) return null;

  const onClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const p = {
      x: ((e.clientX - rect.left) / rect.width) * WORLD_WIDTH,
      y: ((e.clientY - rect.top) / rect.height) * WORLD_HEIGHT,
    };
    const poi = pointsOfInterest(world, settlements)
      .filter((x) => !snap || explored(snap, x))
      .map((x) => ({ x, d: distance(x, p) }))
      .sort((a, b) => a.d - b.d)[0];
    if (poi && poi.d <= SNAP_RADIUS) setDest({ point: poi.x, name: poi.x.name });
    else setDest({ point: p, name: regionName(world, p) });
  };

  const travel = () => {
    if (!dest) return;
    sendBattleCommand({ type: "TRAVEL", ids: [], x: dest.point.x, y: dest.point.y });
  };

  const blocked = engaged
    ? "Em combate: impossível viajar."
    : snap && snap.messengersOut > 0
      ? "Mensageiros fora: espere eles voltarem."
      : plan && !plan.known
        ? "Destino desconhecido: explore antes (a névoa esconde o caminho)."
        : null;

  return (
    <div className="pointer-events-auto absolute inset-0 z-30 flex items-center justify-center gap-4 bg-black/80 p-4 text-white">
      <div className="flex flex-col gap-2">
        <div className="flex items-baseline justify-between">
          <h2 className="text-xl font-bold">Mapa Múndi · {world.name}</h2>
          <span className="text-xs text-neutral-400">Clique num destino · Tab ou Esc fecha · o mundo está em pausa</span>
        </div>
        <canvas
          ref={canvasRef}
          width={MAP_W}
          height={MAP_H}
          onClick={onClick}
          className="max-h-[80vh] w-auto max-w-[70vw] cursor-crosshair rounded border border-neutral-600"
          style={{ aspectRatio: `${MAP_W} / ${MAP_H}` }}
        />
        <div className="flex flex-wrap gap-x-4 text-xs text-neutral-400">
          <span><span className="text-amber-300">●</span> Comandante</span>
          <span><span className="text-blue-400">■</span> seus povoados</span>
          <span><span className="text-red-500">■</span> bando à vista (- - - rumo)</span>
          <span><span className="text-red-500/50">■</span> ? última posição conhecida</span>
          <span><span className="text-red-400">☠</span> covil de calamidade</span>
          <span><span className="text-amber-400">★</span> contrato ativo</span>
        </div>
      </div>

      <aside className="flex w-72 flex-col gap-3 rounded border border-neutral-700 bg-neutral-900/95 p-4 text-sm">
        <h3 className="text-sm font-bold uppercase tracking-wider text-neutral-400">Viagem rápida</h3>
        {!dest || !plan ? (
          <p className="text-neutral-400">Escolha um destino no mapa: o acampamento, um povoado, o local do contrato ou qualquer área já explorada.</p>
        ) : (
          <>
            <div>
              <div className="font-semibold">{dest.name}</div>
              <div className="font-mono text-xs text-neutral-300">
                {plan.days < 0.1 ? "logo ali" : `${plan.days.toFixed(1).replace(".", ",")} dia(s) de marcha`} · ~{plan.food} rações
              </div>
              {plan.food > rations && <div className="text-xs text-red-400">As rações não bastam: o bando chegará com fome.</div>}
            </div>
            {plan.bandsNearRoute.length > 0 && (
              <div className="text-xs text-red-300">
                Perigo: {plan.bandsNearRoute.map((w) => w.name).join(", ")} perto da rota. A marcha pode ser interceptada.
              </div>
            )}
            {blocked && <div className="text-xs text-amber-300">{blocked}</div>}
            <Button disabled={!!blocked} onClick={travel}>
              Viajar
            </Button>
          </>
        )}

        {snap && snap.warbands.length > 0 && (
          <div className="flex flex-col gap-1 border-t border-neutral-700 pt-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-400">Exércitos avistados</h3>
            {snap.warbands.map((w) => (
              <div key={w.id} className={`text-xs ${w.visible ? "text-red-300" : "text-neutral-500"}`}>
                {w.name}: {w.visible ? `${w.count} à vista` : `~${w.count}, visto no dia ${w.seenDay}`} — {regionName(world, w)}
              </div>
            ))}
          </div>
        )}
        <Button variant="danger" onClick={() => setWorldMapOpen(false)}>
          Fechar
        </Button>
      </aside>
    </div>
  );
}
