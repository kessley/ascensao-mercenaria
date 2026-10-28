import { useEffect, useMemo, useRef, useState } from "react";
import { useGameStore } from "../../store/useGameStore";
import { generateWorld } from "../../game/worldgen/generateWorld";
import { randomSeed, seedFromText } from "../../game/worldgen/rng";
import { settlementFromSeed } from "../../game/sim/realm";
import { SETTLEMENT_KIND_LABEL } from "../../game/data/world";
import { Button } from "../components/Button";
import { SavePanel } from "../components/SavePanel";
import { listSaves } from "../../game/save/saveGame";
import { MAP_H, MAP_W, drawWorldMap } from "./WorldMapView";

const hex = (c: number) => `#${c.toString(16).padStart(6, "0")}`;

/**
 * Criação do mundo: cada campanha nasce num mundo gerado de uma semente (digitável e
 * compartilhável). Mostra o mapa, os reinos com seus governantes e a crônica de séculos.
 */
export function NewWorldView() {
  const startCampaign = useGameStore((s) => s.startCampaign);
  const loadGame = useGameStore((s) => s.loadGame);
  const [saves] = useState(listSaves);
  const [seedText, setSeedText] = useState(() => String(randomSeed()));
  const world = useMemo(() => generateWorld(seedFromText(seedText) || 1), [seedText]);
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
            height={MAP_H}
            className="w-[min(1024px,62vw)] rounded border border-neutral-700"
            style={{ aspectRatio: `${MAP_W} / ${MAP_H}` }}
          />
          <p className="text-xs text-neutral-500">
            Quadrados = povoados na cor do reino dono (claro = livres) · círculos = locais de contrato · elipse dourada = o seu acampamento.
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
