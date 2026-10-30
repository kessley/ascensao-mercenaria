import { useEffect, useMemo, useRef, useState } from "react";
import { useGameStore } from "../../store/useGameStore";
import { generateWorld } from "../../game/worldgen/generateWorld";
import { randomSeed, seedFromText } from "../../game/worldgen/rng";
import { settlementFromSeed } from "../../game/sim/realm";
import { BIOME_LABEL, SETTLEMENT_KIND_LABEL, type Biome } from "../../game/data/world";
import {
  CALAMITY_RATES,
  DEFAULT_WORLD_OPTIONS,
  WORLD_AGES,
  WORLD_SIZES,
  type CalamityRateId,
  type WorldAgeId,
  type WorldOptions,
  type WorldSizeId,
} from "../../utils/constants";
import { Button } from "../components/Button";
import { SavePanel } from "../components/SavePanel";
import { listSaves } from "../../game/save/saveGame";
import { MAP_W, drawWorldMap, mapHeight } from "./WorldMapView";

const hex = (c: number) => `#${c.toString(16).padStart(6, "0")}`;

/** Um seletor de opção da criação do mundo. */
function Choice<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: Record<T, { label: string }>;
  onChange: (v: T) => void;
}) {
  return (
    <label className="flex flex-col text-xs text-neutral-400">
      {label}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as T)}
        className="rounded border border-neutral-600 bg-neutral-900 px-2 py-1.5 text-sm text-white"
      >
        {(Object.keys(options) as T[]).map((k) => (
          <option key={k} value={k}>
            {options[k].label}
          </option>
        ))}
      </select>
    </label>
  );
}

/**
 * Criação do mundo: cada campanha nasce num mundo gerado de uma semente (digitável e
 * compartilhável) e das opções (tamanho, idade da história, frequência de calamidades).
 * Mostra o mapa com relevo e rios, os reinos com seus governantes e a crônica simulada.
 */
export function NewWorldView() {
  const startCampaign = useGameStore((s) => s.startCampaign);
  const loadGame = useGameStore((s) => s.loadGame);
  const [saves] = useState(listSaves);
  const [seedText, setSeedText] = useState(() => String(randomSeed()));
  const [options, setOptions] = useState<WorldOptions>(DEFAULT_WORLD_OPTIONS);
  const world = useMemo(() => generateWorld(seedFromText(seedText) || 1, options), [seedText, options]);
  // Geografia em números para o painel: biomas que mais aparecem, rios, pontes, ruínas
  const facts = useMemo(() => {
    const count = new Map<Biome, number>();
    for (const r of world.regions) if (r.biome !== "OCEAN") count.set(r.biome, (count.get(r.biome) ?? 0) + 1);
    const biomes = [...count.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4).map(([b]) => BIOME_LABEL[b].toLowerCase());
    return {
      biomes,
      rivers: world.geo.rivers.filter((r) => r.kind !== "STREAM").length,
      great: world.geo.rivers.filter((r) => r.kind === "GREAT").map((r) => r.name),
      bridges: world.geo.crossings.filter((c) => c.kind === "BRIDGE").length,
      fords: world.geo.crossings.filter((c) => c.kind === "FORD").length,
      ferries: world.geo.crossings.filter((c) => c.kind === "FERRY").length,
      iron: world.settlements.filter((s) => s.resources.includes("IRON")).length,
      ruins: world.settlements.filter((s) => s.owner === "RUINED").length,
      ports: world.settlements.filter((s) => s.port).length,
    };
  }, [world]);
  const settlements = useMemo(() => world.settlements.map(settlementFromSeed), [world]);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const ctx = canvasRef.current?.getContext("2d");
    if (ctx) drawWorldMap(ctx, { world, settlements, calamities: [], snap: null, contractSiteId: null, dest: null, regions: true });
  }, [world, settlements]);

  return (
    <div className="flex h-screen w-screen flex-col gap-3 overflow-y-auto bg-neutral-950 p-5 text-white">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-wide">Ascensão Mercenária</h1>
          <p className="text-sm text-neutral-400">Um mundo novo a cada campanha. Escolha onde os seus mercenários vão começar.</p>
        </div>
        <div className="flex items-end gap-2">
          <label className="flex flex-col text-xs text-neutral-400">
            Semente
            <input
              value={seedText}
              onChange={(e) => setSeedText(e.target.value)}
              className="w-44 rounded border border-neutral-600 bg-neutral-900 px-2 py-1.5 font-mono text-sm text-white"
            />
          </label>
          {saves.length > 0 && (
            <Button className="border-sky-500 bg-sky-800 hover:bg-sky-700" onClick={() => loadGame(saves[0].slot)} title={`${saves[0].bandName} · dia ${saves[0].day}`}>
              Continuar
            </Button>
          )}
          <Choice<WorldSizeId> label="Tamanho" value={options.size} options={WORLD_SIZES} onChange={(size) => setOptions({ ...options, size })} />
          <Choice<WorldAgeId> label="Idade" value={options.age} options={WORLD_AGES} onChange={(age) => setOptions({ ...options, age })} />
          <Choice<CalamityRateId>
            label="Calamidades"
            value={options.calamities}
            options={CALAMITY_RATES}
            onChange={(calamities) => setOptions({ ...options, calamities })}
          />
          <Button onClick={() => setSeedText(String(randomSeed()))}>Outro mundo</Button>
          <Button className="bg-amber-600 hover:bg-amber-500 border-amber-400" onClick={() => startCampaign(world)}>
            Começar campanha
          </Button>
        </div>
      </header>

      <div className="flex flex-wrap gap-4">
        <div className="flex flex-col gap-1">
          <h2 className="text-xl font-semibold">
            {world.name} <span className="text-sm font-normal text-neutral-400">· Ano {world.year} da {world.era}</span>
          </h2>
          <canvas
            ref={canvasRef}
            width={MAP_W}
            height={mapHeight(world)}
            className="w-[min(1024px,62vw)] rounded border border-neutral-700"
            style={{ aspectRatio: `${MAP_W} / ${mapHeight(world)}` }}
          />
          <p className="text-xs text-neutral-500">
            Quadrados = povoados na cor do reino dono (claro = livres) · ⚓ = porto · círculos = locais de contrato · elipse dourada = o seu
            acampamento · azul = rios · marrom = pontes · pontos claros = vaus.
          </p>
          <p className="text-xs text-neutral-300">
            Terra de {facts.biomes.join(", ")} · {facts.rivers} rios{facts.great.length > 0 ? ` (o maior: ${facts.great[0]})` : ""} ·{" "}
            {facts.bridges} pontes, {facts.fords} vaus e {facts.ferries} balsas · {facts.ports} portos · {facts.iron} povoado(s) com ferro · {facts.ruins} povoado(s) em ruínas ·{" "}
            {WORLD_AGES[options.age].years} anos de história simulada.
          </p>
        </div>

        <aside className="flex min-w-[18rem] flex-1 flex-col gap-3 text-sm">
          {saves.length > 0 && <SavePanel canSave={false} />}
          <section>
            <h3 className="mb-1 text-xs font-bold uppercase tracking-wider text-neutral-400">O bando</h3>
            <p>{world.bandName}</p>
          </section>
          <section>
            <h3 className="mb-1 text-xs font-bold uppercase tracking-wider text-neutral-400">Reinos</h3>
            {world.factions.map((f) => (
              <div key={f.id} className="mb-1">
                <span className="mr-1 inline-block h-3 w-3 rounded-sm align-middle" style={{ background: hex(f.color) }} />
                <b>{f.name}</b>
                <div className="text-xs text-neutral-400">
                  {f.ruler} · capital {world.settlements.find((s) => s.id === f.capitalId)?.name} ·{" "}
                  {world.settlements.filter((s) => s.owner === f.id).length} povoado(s)
                </div>
              </div>
            ))}
          </section>
          <section>
            <h3 className="mb-1 text-xs font-bold uppercase tracking-wider text-neutral-400">Povoados</h3>
            <div className="text-xs text-neutral-300">
              {world.settlements.map((s) => `${s.name} (${SETTLEMENT_KIND_LABEL[s.kind].toLowerCase()}${s.owner === "FREE" ? ", livre" : ""})`).join(" · ")}
            </div>
          </section>
          <section className="flex min-h-0 flex-col">
            <h3 className="mb-1 text-xs font-bold uppercase tracking-wider text-neutral-400">Crônica</h3>
            <ol className="flex max-h-[38vh] flex-col gap-1 overflow-y-auto rounded bg-neutral-900 p-3 text-xs text-neutral-300">
              {world.history.map((h, i) => (
                <li key={i}>
                  <span className="font-mono text-amber-300/80">Ano {h.year}</span> — {h.text}
                </li>
              ))}
            </ol>
          </section>
        </aside>
      </div>
    </div>
  );
}
