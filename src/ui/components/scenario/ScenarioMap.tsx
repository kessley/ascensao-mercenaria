import { useEffect, useRef } from "react";
import { BIOME_COLOR, TerrainMap } from "../../../game/world/TerrainMap";
import { geoOf } from "../../../game/worldgen/geoMap";
import { SCENARIO_HEIGHT, SCENARIO_MAPS, SCENARIO_WIDTH, armyStart, buildScenarioWorld, forceSize, forceStart, type BattleScenario } from "../../../game/data/scenarios";
import type { TerrainType } from "../../../utils/constants";

const W = 480;
const H = 360;
const CELL = 6;

/** Cor de cada terreno na miniatura (o campo usa a cor do bioma). */
const TERRAIN_COLOR: Partial<Record<TerrainType, string>> = {
  HILL: "#7d9a4a",
  MUD: "#6b4f2e",
  SWAMP: "#3f5240",
  FOREST: "#1f4a1a",
  SHALLOW: "#6fa7c0",
  BRIDGE: "#8a6a3a",
  WATER: "#2f6f9c",
  MOUNTAIN: "#6e6a64",
};

const HOUR_VEIL = { DAWN: "rgba(120,90,140,0.16)", NOON: "rgba(0,0,0,0)", DUSK: "rgba(120,50,20,0.24)", NIGHT: "rgba(8,10,34,0.5)" };

/** Miniatura do campo: terreno, de onde cada lado vem e a hora do dia. */
export function ScenarioMap({ scenario }: { scenario: BattleScenario }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const ctx = ref.current?.getContext("2d");
    if (!ctx) return;
    const world = buildScenarioWorld(scenario);
    const terrain = new TerrainMap(world.terrain, geoOf(world.geo), SCENARIO_WIDTH, SCENARIO_HEIGHT);
    const scale = SCENARIO_WIDTH / W;
    const [r, g, b] = BIOME_COLOR[SCENARIO_MAPS[scenario.map].biome];
    const snow = scenario.season === "WINTER";
    const base = snow ? "rgb(214,222,228)" : `rgb(${r},${g},${b})`;
    for (let y = 0; y < H; y += CELL) {
      for (let x = 0; x < W; x += CELL) {
        const t = terrain.typeAt((x + CELL / 2) * scale, (y + CELL / 2) * scale);
        ctx.fillStyle = TERRAIN_COLOR[t] ?? base;
        ctx.fillRect(x, y, CELL, CELL);
      }
    }
    ctx.fillStyle = HOUR_VEIL[scenario.hour];
    ctx.fillRect(0, 0, W, H);

    const dot = (p: { x: number; y: number }, draw: (x: number, y: number) => void) => draw(p.x / scale, p.y / scale);
    for (const force of scenario.forces) {
      if (forceSize(force) === 0) continue;
      dot(forceStart(scenario, force), (x, y) => {
        const late = force.delay > 0;
        const size = Math.min(13, 6 + forceSize(force) / 8);
        ctx.fillStyle = late ? "rgba(214,64,44,0.35)" : "#d6402c";
        ctx.strokeStyle = "#fff0e6";
        ctx.lineWidth = 1.5;
        ctx.setLineDash(late ? [3, 2] : []);
        ctx.fillRect(x - size, y - size, size * 2, size * 2);
        ctx.strokeRect(x - size, y - size, size * 2, size * 2);
        ctx.setLineDash([]);
      });
    }
    dot(armyStart(scenario), (x, y) => {
      ctx.fillStyle = "#3f86d6";
      ctx.strokeStyle = "#f6e6a8";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(x, y, 10, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    });
  }, [scenario]);

  return <canvas ref={ref} width={W} height={H} role="img" aria-label={`Mapa: ${SCENARIO_MAPS[scenario.map].label}`} className="aspect-[4/3] w-full rounded border border-neutral-700" />;
}
