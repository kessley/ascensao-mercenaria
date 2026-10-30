import { useEffect, useMemo, useRef, useState } from "react";
import { useGameStore, type WorldSnapshot } from "../../store/useGameStore";
import { pointsOfInterest, regionName, travelDaysBetween, type WorldDef } from "../../game/data/world";
import { PALISADE } from "../../game/data/campLayout";
import { isCalamityOwner, type Calamity, type Settlement } from "../../game/sim/realm";
import { SEASONS, SUPPORT, WEATHER, WORLD, WORLD_HEIGHT, WORLD_WIDTH } from "../../utils/constants";
import type { ScoutOrder } from "../../game/entities/Scout";
import { seasonDay, seasonOf, weatherAt } from "../../utils/season";
import { geoOf } from "../../game/worldgen/geoMap";
import { groundColor } from "../../game/world/TerrainMap";
import { dailyRations } from "../../utils/economy";
import { distance, type Point } from "../../utils/math";
import { Button } from "../components/Button";

export const MAP_W = 1024;

/** Altura do mapa (px) para as proporções deste continente. */
export function mapHeight(world: WorldDef): number {
  return Math.round((MAP_W * world.rows * WORLD.REGION_HEIGHT) / (world.cols * WORLD.REGION_WIDTH));
}

/** px do mapa por px do mundo. */
const scaleOf = (world: WorldDef) => MAP_W / (world.cols * WORLD.REGION_WIDTH);

const RELIEF_STEP = 100;
const reliefCache = new WeakMap<WorldDef, HTMLCanvasElement>();

/** Relevo sombreado do continente (uma vez por mundo): o mesmo chão do jogo, em amostras de 100 px. */
function reliefOf(world: WorldDef): HTMLCanvasElement {
  const cached = reliefCache.get(world);
  if (cached) return cached;
  const geo = geoOf(world.geo);
  const w = Math.round((world.cols * WORLD.REGION_WIDTH) / RELIEF_STEP);
  const h = Math.round((world.rows * WORLD.REGION_HEIGHT) / RELIEF_STEP);
  const heights = new Float32Array((w + 1) * (h + 1));
  for (let j = 0; j <= h; j++) for (let i = 0; i <= w; i++) heights[j * (w + 1) + i] = geo.heightAt(i * RELIEF_STEP, j * RELIEF_STEP);
  const img = new ImageData(w, h);
  const color = [0, 0, 0];
  for (let j = 0; j < h; j++) {
    for (let i = 0; i < w; i++) {
      const k = j * (w + 1) + i;
      groundColor(geo, i * RELIEF_STEP, j * RELIEF_STEP, heights[k], heights[k + 1], heights[k + w + 1], color, RELIEF_STEP);
      const o = (j * w + i) * 4;
      img.data[o] = color[0];
      img.data[o + 1] = color[1];
      img.data[o + 2] = color[2];
      img.data[o + 3] = 255;
    }
  }
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  canvas.getContext("2d")?.putImageData(img, 0, 0);
  reliefCache.set(world, canvas);
  return canvas;
}
/** Clique a menos disto (px do mundo) de um local conhecido escolhe o local. */
const SNAP_RADIUS = 450;

const hex = (c: number) => `#${c.toString(16).padStart(6, "0")}`;

/** "visto hoje", "visto há 2 dias": toda informação tem idade. */
const agoText = (days: number) => (days <= 0 ? "visto hoje" : days === 1 ? "visto ontem" : `visto há ${days} dias`);

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
  /** Contratos da economia (Marco 14): os povoados envolvidos (entrega, escolta). */
  contractTownIds?: readonly string[];
  /** Ponte a queimar (contrato do Marco 15). */
  contractCrossing?: string;
  dest: Destination | null;
  /** Mostrar a grade das regiões (prévia do mundo). */
  regions?: boolean;
  /** Pontes queimadas (desenhadas em preto). */
  burnedBridges?: readonly string[];
  /** Dia de hoje: o tempo de cada região já vista (Marco 13). */
  day?: number;
  /** Acampamento levantado (não aparece no mapa). */
  campPacked?: boolean;
}

interface Destination {
  point: Point;
  name: string;
}

/** Desenha o mundo (terreno, estradas, povoados com a cor do dono, locais, névoa e exércitos). */
export function drawWorldMap(ctx: CanvasRenderingContext2D, layers: MapLayers): void {
  const { world, settlements, calamities, snap, contractSiteId, dest, contractTownIds = [] } = layers;
  const s = scaleOf(world);
  const mapH = mapHeight(world);
  ctx.clearRect(0, 0, MAP_W, mapH);
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(reliefOf(world), 0, 0, MAP_W, mapH);

  // Rios (a largura de verdade, com um mínimo para aparecer)
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  for (const river of world.geo.rivers) {
    ctx.strokeStyle = river.kind === "STREAM" ? "rgba(95,156,184,0.75)" : "#3a74a4";
    for (let k = 1; k < river.points.length; k++) {
      const a = river.points[k - 1];
      const b = river.points[k];
      ctx.lineWidth = Math.max(river.kind === "STREAM" ? 0.8 : 1.3, river.widths[k] * s * 1.6);
      ctx.beginPath();
      ctx.moveTo(a.x * s, a.y * s);
      ctx.lineTo(b.x * s, b.y * s);
      ctx.stroke();
    }
  }
  ctx.strokeStyle = "rgba(141,123,82,0.9)";
  ctx.lineWidth = 2;
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

  // Pontes (quadradinho marrom; queimadas, preto) e vaus (pontos claros)
  for (const c of world.geo.crossings) {
    if (c.kind === "FERRY") {
      // Balsa: barquinho
      ctx.fillStyle = "#e0c27a";
      ctx.beginPath();
      ctx.moveTo(c.x * s - 4, c.y * s - 1);
      ctx.lineTo(c.x * s + 4, c.y * s - 1);
      ctx.lineTo(c.x * s + 2, c.y * s + 3);
      ctx.lineTo(c.x * s - 2, c.y * s + 3);
      ctx.closePath();
      ctx.fill();
    } else if (c.kind === "BRIDGE") {
      ctx.fillStyle = layers.burnedBridges?.includes(c.id) ? "#111" : "#8a6234";
      ctx.fillRect(c.x * s - 3, c.y * s - 3, 6, 6);
      if (c.id === layers.contractCrossing) label("★ ponte do contrato", c, -8, "#fbbf24");
    } else {
      ctx.fillStyle = "#cfe6ee";
      ctx.beginPath();
      ctx.arc(c.x * s, c.y * s, 2.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  if (layers.regions) {
    ctx.strokeStyle = "rgba(255,255,255,0.1)";
    ctx.lineWidth = 1;
    for (let c = 1; c < world.cols; c++) {
      ctx.beginPath();
      ctx.moveTo(c * WORLD.REGION_WIDTH * s, 0);
      ctx.lineTo(c * WORLD.REGION_WIDTH * s, mapH);
      ctx.stroke();
    }
    for (let r = 1; r < world.rows; r++) {
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
      // Nunca visto: escuro, mas a forma da terra (costa, rios, montanhas) ainda se adivinha
      fog.data[i * 4 + 3] = v === 2 ? 0 : v === 1 ? 100 : 178;
    }
    const small = document.createElement("canvas");
    small.width = snap.cols;
    small.height = snap.rows;
    small.getContext("2d")?.putImageData(fog, 0, 0);
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(small, 0, 0, snap.cols * snap.cell * s, snap.rows * snap.cell * s);
  }

  // Tempo de hoje nas regiões já vistas (uma célula de clima = 2×2 regiões)
  if (snap && layers.day !== undefined) {
    const cw = WORLD.REGION_WIDTH * WEATHER.CELL_REGIONS;
    const ch = WORLD.REGION_HEIGHT * WEATHER.CELL_REGIONS;
    ctx.font = "16px sans-serif";
    ctx.textAlign = "center";
    for (let y = ch / 2; y < WORLD_HEIGHT; y += ch) {
      for (let x = cw / 2; x < WORLD_WIDTH; x += cw) {
        const p = { x, y };
        if (!explored(snap, p)) continue;
        const w = weatherAt(world.seed, layers.day, p, geoOf(world.geo));
        if (w === "CLEAR") continue;
        ctx.globalAlpha = 0.8;
        ctx.fillText(WEATHER.ICON[w], x * s, y * s);
        ctx.globalAlpha = 1;
      }
    }
    ctx.font = "11px monospace";
  }

  // Acampamento, povoados (cor do dono) e locais de contrato
  if (!layers.campPacked) {
    ctx.strokeStyle = "#e0b040";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(world.camp.center.x * s, world.camp.center.y * s, PALISADE.rx * s, PALISADE.ry * s, 0, 0, Math.PI * 2);
    ctx.stroke();
    label("Acampamento", world.camp.center, -PALISADE.ry * s - 6, "#ffe9b0");
  }
  for (const t of settlements) {
    const size = t.kind === "CAPITAL" ? 24 : t.kind === "CITY" ? 18 : t.kind === "FORT" ? 15 : 11;
    ctx.fillStyle = ownerFill(world, calamities, t.owner);
    ctx.fillRect(t.x * s - size / 2, t.y * s - size / 2, size, size);
    ctx.strokeStyle = "#111";
    ctx.lineWidth = 1.5;
    ctx.strokeRect(t.x * s - size / 2, t.y * s - size / 2, size, size);
    label(`${t.kind === "CAPITAL" ? "♛ " : ""}${t.besiegedBy ? "⚔ " : ""}${t.port ? "⚓ " : ""}${contractTownIds.includes(t.id) ? "★ " : ""}${t.owner === "RUINED" ? `${t.name} (ruínas)` : t.name}`, t, -size / 2 - 4, contractTownIds.includes(t.id) ? "#fbbf24" : t.owner === "PLAYER" ? "#9cc4ff" : "#ffe9b0");
    if (contractTownIds.includes(t.id)) {
      ctx.strokeStyle = "#fbbf24";
      ctx.lineWidth = 3;
      ctx.strokeRect(t.x * s - size / 2 - 4, t.y * s - size / 2 - 4, size + 8, size + 8);
    }
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
    // Caravanas (Marco 14): losango dourado (as do bando, azul; atacadas, vermelho)
    if (w.kind === "CARAVAN") {
      ctx.fillStyle = w.own ? "#5aa8ff" : w.hostile ? "#c0392b" : "#e0b040";
      ctx.beginPath();
      ctx.moveTo(w.x * s, w.y * s - 6);
      ctx.lineTo(w.x * s + 6, w.y * s);
      ctx.lineTo(w.x * s, w.y * s + 6);
      ctx.lineTo(w.x * s - 6, w.y * s);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = "#111";
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.globalAlpha = 1;
      continue;
    }
    // Hostis em vermelho; patrulhas e mensageiros (em paz) em cinza-azulado; refugiados em bege
    ctx.fillStyle = w.hostile === false ? (w.kind === "REFUGEES" ? "#d8c39a" : w.kind === "FACTION" ? "#b98cff" : "#7f9db3") : "#c0392b";
    ctx.fillRect(w.x * s - size / 2, w.y * s - size / 2, size, size);
    ctx.strokeStyle = "#111";
    ctx.lineWidth = 1;
    ctx.strokeRect(w.x * s - size / 2, w.y * s - size / 2, size, size);
    label(`${w.visible ? "" : "?"}${w.count}`, w, size + 8, w.hostile === false ? "#d8e4ee" : "#ffb4a8");
    ctx.globalAlpha = 1;
  }

  // Barcos à vista (Marco 14): casco e vela
  for (const sh of snap.ships ?? []) {
    ctx.fillStyle = "#5a3a1e";
    ctx.fillRect(sh.x * s - 5, sh.y * s, 10, 3);
    ctx.fillStyle = "#f0e8d8";
    ctx.beginPath();
    ctx.moveTo(sh.x * s, sh.y * s - (sh.kind === "SHIP" ? 8 : 6));
    ctx.lineTo(sh.x * s + 4, sh.y * s);
    ctx.lineTo(sh.x * s - 1, sh.y * s);
    ctx.closePath();
    ctx.fill();
  }

  // Batedores: ao vivo, ou o último lugar em que o Comandante soube deles
  for (const sc of snap.scouts ?? []) {
    ctx.globalAlpha = sc.live ? 1 : 0.5;
    ctx.fillStyle = "#3f8f6b";
    ctx.beginPath();
    ctx.arc(sc.x * s, sc.y * s, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#9dff6b";
    ctx.lineWidth = 1;
    ctx.stroke();
    label(sc.live ? sc.name : `${sc.name}?`, sc, -8, "#c6ff8a");
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
 * Mapa do Continente (Tab): visão distanciada do mundo para viagem rápida e para observar
 * movimentos de exércitos dentro do que as tropas enxergam (ou a última posição conhecida).
 * Com ele aberto o mundo fica em pausa. A viagem passa os dias da marcha de verdade.
 */
export function WorldMapView() {
  const open = useGameStore((s) => s.worldMapOpen);
  const world = useGameStore((s) => s.world);
  const settlements = useGameStore((s) => s.settlements);
  const calamities = useGameStore((s) => s.calamities);
  const burnedBridges = useGameStore((s) => s.burnedBridges);
  const snap = useGameStore((s) => s.worldSnapshot);
  const activeContract = useGameStore((s) => s.activeContract);
  const battalions = useGameStore((s) => s.battalions);
  const followers = useGameStore((s) => s.followers);
  const day = useGameStore((s) => s.day);
  const campPacked = useGameStore((s) => s.campPacked);
  // Em campo, o exército só come o que as carroças levam
  const rations = useGameStore((s) => (s.exposure.away && !s.campPacked ? s.cargo : s.rations));
  const engaged = useGameStore((s) => s.battleHud?.engaged ?? false);
  const setWorldMapOpen = useGameStore((s) => s.setWorldMapOpen);
  const sendBattleCommand = useGameStore((s) => s.sendBattleCommand);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [dest, setDest] = useState<Destination | null>(null);
  /** Rota de patrulha sendo marcada, por batedor. */
  const [route, setRoute] = useState<Record<string, Point[]>>({});

  const contractSiteId = activeContract?.contract.siteId || null;
  const contractTownIds = useMemo(() => {
    const c = activeContract?.contract;
    return c && c.kind && c.kind !== "SITE" ? [c.targetId, c.fromId].filter((x): x is string => !!x) : [];
  }, [activeContract]);

  useEffect(() => {
    if (!open) setDest(null);
  }, [open]);

  useEffect(() => {
    const ctx = canvasRef.current?.getContext("2d");
    if (ctx && world) drawWorldMap(ctx, { world, settlements, calamities, snap, contractSiteId, contractTownIds, contractCrossing: activeContract?.contract.crossingId, dest, burnedBridges, day, campPacked });
  }, [world, settlements, calamities, snap, contractSiteId, contractTownIds, activeContract, dest, open, burnedBridges, day, campPacked]);

  const plan = useMemo(() => {
    if (!dest || !snap) return null;
    const days = travelDaysBetween(snap.commander, dest.point);
    const food = Math.ceil(days * dailyRations(battalions, followers));
    const known = explored(snap, dest.point);
    const bandsNearRoute = snap.warbands.filter((w) => {
      const a = snap.commander;
      const b = dest.point;
      const len2 = (b.x - a.x) ** 2 + (b.y - a.y) ** 2 || 1;
      const t = Math.max(0, Math.min(1, ((w.x - a.x) * (b.x - a.x) + (w.y - a.y) * (b.y - a.y)) / len2));
      return distance(w, { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }) < WORLD.INTERCEPT_RADIUS * 2.5;
    });
    return { days, food, known, bandsNearRoute };
  }, [dest, snap, battalions, followers]);

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

  /** Bando que aparece perto do ponto escolhido (dá para mandar um batedor atrás dele). */
  const bandNear = dest && snap ? (snap.warbands.filter((w) => !w.own).map((w) => ({ w, d: distance(w, dest.point) })).sort((a, b) => a.d - b.d).find((x) => x.d < SNAP_RADIUS)?.w ?? null) : null;
  const scoutOrder = (id: string, order: ScoutOrder) => sendBattleCommand({ type: "SCOUT_ORDER", ids: [id], order });

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
          <h2 className="text-xl font-bold">
            Mapa do Continente · {world.name}
            <span className="ml-2 text-sm font-normal text-neutral-300">
              {SEASONS.LABEL[seasonOf(day)]}, dia {seasonDay(day)}/{SEASONS.DAYS}
            </span>
          </h2>
          <span className="text-xs text-neutral-400">Clique num destino · Tab ou Esc fecha · o mundo está em pausa</span>
        </div>
        <canvas
          ref={canvasRef}
          width={MAP_W}
          height={mapHeight(world)}
          onClick={onClick}
          className="max-h-[80vh] w-auto max-w-[70vw] cursor-crosshair rounded border border-neutral-600"
          style={{ aspectRatio: `${MAP_W} / ${mapHeight(world)}` }}
        />
        <div className="flex flex-wrap gap-x-4 text-xs text-neutral-400">
          <span><span className="text-amber-300">●</span> Comandante</span>
          <span><span className="text-emerald-400">●</span> batedor (? = último lugar conhecido)</span>
          <span><span className="text-blue-400">■</span> seus povoados</span>
          <span><span className="text-red-500">■</span> bando à vista (- - - rumo)</span>
          <span><span className="text-red-500/50">■</span> ? última posição conhecida</span>
          <span><span className="text-red-400">☠</span> covil de calamidade</span>
          <span><span className="text-amber-400">★</span> contrato ativo</span>
          <span><span className="text-sky-500">━</span> rio</span>
          <span><span className="text-amber-700">■</span> ponte</span>
          <span><span className="text-sky-100">●</span> vau</span>
          <span>⚓ porto</span>
          <span>♛ capital</span>
          <span>⚔ sob cerco</span>
          <span><span className="text-violet-400">■</span> exército de um reino (em paz com o bando)</span>
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
                {plan.days < 0.1 ? "logo ali" : `${plan.days.toFixed(1).replace(".", ",")} dia(s) em linha reta`} · ~{plan.food} rações
              </div>
              <div className="text-xs text-neutral-500">
                A marcha segue estradas, pontes e vaus: rios e montanhas alongam o caminho.
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

        {snap && (snap.scouts ?? []).length > 0 && (
          <div className="flex flex-col gap-1 border-t border-neutral-700 pt-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-400">Batedores</h3>
            {(snap.scouts ?? []).map((sc) => (
              <div key={sc.id} className="flex flex-col gap-1 text-xs">
                <span className={sc.live ? "text-lime-300" : "text-neutral-400"}>
                  {sc.name}
                  {sc.live ? "" : " (fora de contato)"}
                </span>
                {dest && (
                  <span className="flex flex-wrap gap-1">
                    <button type="button" onClick={() => scoutOrder(sc.id, { kind: "REGION", point: dest.point, radius: SUPPORT.SCOUT.REGION_RADIUS })} className="rounded border border-neutral-600 px-1 hover:border-lime-400">
                      Explorar região
                    </button>
                    <button type="button" onClick={() => scoutOrder(sc.id, { kind: "WATCH", point: dest.point })} className="rounded border border-neutral-600 px-1 hover:border-lime-400">
                      Vigiar
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const points = [...(route[sc.id] ?? []), dest.point];
                        setRoute({ ...route, [sc.id]: points });
                      }}
                      className="rounded border border-neutral-600 px-1 hover:border-lime-400"
                    >
                      + rota{(route[sc.id] ?? []).length > 0 ? ` (${(route[sc.id] ?? []).length})` : ""}
                    </button>
                    {(route[sc.id] ?? []).length > 1 && (
                      <button
                        type="button"
                        onClick={() => {
                          scoutOrder(sc.id, { kind: "PATROL", points: route[sc.id] });
                          setRoute({ ...route, [sc.id]: [] });
                        }}
                        className="rounded border border-lime-600 px-1 text-lime-200 hover:border-lime-300"
                      >
                        Patrulhar
                      </button>
                    )}
                    {bandNear && (
                      <button type="button" onClick={() => scoutOrder(sc.id, { kind: "SHADOW", bandId: bandNear.id })} className="rounded border border-neutral-600 px-1 hover:border-lime-400">
                        Seguir {bandNear.name}
                      </button>
                    )}
                  </span>
                )}
              </div>
            ))}
          </div>
        )}

        {snap && snap.warbands.length > 0 && (
          <div className="flex flex-col gap-1 border-t border-neutral-700 pt-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-400">Exércitos avistados</h3>
            {snap.warbands.map((w) => (
              <div key={w.id} className={`text-xs ${w.visible ? "text-red-300" : "text-neutral-500"}`}>
                {w.name}: {w.visible ? `${w.count} à vista` : `~${w.count}, ${agoText(day - w.seenDay)}`} — {regionName(world, w)}
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
