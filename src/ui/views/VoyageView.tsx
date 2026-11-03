import { useEffect, useMemo, useState } from "react";
import { pirateToll } from "../../game/sim/voyage";
import { useGameStore } from "../../store/useGameStore";
import { Button } from "../components/Button";
import { PlanetMap } from "../components/sea/PlanetMap";

const DAY_MS = 900;
const TONE = { info: "text-neutral-200", good: "text-emerald-300", bad: "text-red-300" };

/** Viagem por mar: os dias passam no Mapa Múndi, até o porto ou até alguém cruzar o caminho. */
export function VoyageView() {
  const voyage = useGameStore((s) => s.voyage);
  const planet = useGameStore((s) => s.planet);
  const here = useGameStore((s) => s.continent);
  const charts = useGameStore((s) => s.charts);
  const parked = useGameStore((s) => s.parked);
  const gold = useGameStore((s) => s.gold);
  const rations = useGameStore((s) => s.rations);
  const soldiers = useGameStore((s) => s.battalions.reduce((n, b) => n + b.soldiers, 0));
  const sailDay = useGameStore((s) => s.sailDay);
  const answerPirates = useGameStore((s) => s.answerPirates);
  const startBoarding = useGameStore((s) => s.startBoarding);
  const fighting = useGameStore((s) => s.scenario !== null);
  const [why, setWhy] = useState<string | null>(null);
  const known = useMemo(() => [here, ...Object.keys(parked), ...charts], [here, parked, charts]);

  const pirates = voyage?.pirates ?? false;
  useEffect(() => {
    if (!voyage || pirates || fighting) return;
    const timer = setInterval(sailDay, DAY_MS);
    return () => clearInterval(timer);
  }, [!!voyage, pirates, fighting, sailDay]);

  if (!voyage || !planet || fighting) return null;
  const toll = pirateToll(voyage.seats);
  const target = planet.continents.find((c) => c.id === voyage.to);
  return (
    <div className="pointer-events-auto absolute inset-0 z-30 flex items-center justify-center bg-black/85 text-white">
      <div className="flex w-[64rem] max-w-[calc(100vw-2rem)] flex-col gap-3 p-4">
        <header className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="font-serif text-2xl text-amber-100">Rumo a {target?.name}</h2>
          <span className="text-sm text-neutral-300">
            {voyage.shipLabel} · dia {voyage.day} de {voyage.days} · {soldiers} soldados · {Math.floor(rations)} rações · {gold} de ouro
          </span>
        </header>
        <div className="grid gap-3 md:grid-cols-[2fr_1fr]">
          <PlanetMap planet={planet} here={here} known={known} route={{ from: voyage.from, to: voyage.to, share: Math.min(1, voyage.day / voyage.days) }} />
          <ol className="flex max-h-[24rem] flex-col gap-1 overflow-y-auto rounded bg-neutral-900 p-3 text-sm">
            {voyage.notes.map((n, i) => (
              <li key={i} className={TONE[n.tone]}>
                {n.text}
              </li>
            ))}
          </ol>
        </div>
        {pirates && (
          <section className="flex flex-col gap-2 rounded border border-red-800 bg-red-950/40 p-3">
            <h3 className="font-serif text-lg text-red-200">Piratas!</h3>
            <p className="text-sm text-neutral-200">Um navio de velas negras corta o rumo e iça uma bandeira de parlamento: {toll} de ouro, ou abordam.</p>
            {why && <p className="text-xs text-red-300">{why}</p>}
            <div className="flex flex-wrap gap-2">
              <Button variant="danger" onClick={startBoarding}>
                Lutar no convés
              </Button>
              <Button variant="quiet" disabled={gold < toll} onClick={() => setWhy(answerPirates("PAY"))}>
                Pagar {toll} de ouro
              </Button>
              <Button variant="quiet" onClick={() => setWhy(answerPirates("RUN"))}>
                Tentar despistar
              </Button>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

/** Mapa Múndi fora de viagem: as terras conhecidas e a frota (Shift+Tab). */
export function AtlasView() {
  const open = useGameStore((s) => s.atlasOpen);
  const planet = useGameStore((s) => s.planet);
  const here = useGameStore((s) => s.continent);
  const charts = useGameStore((s) => s.charts);
  const parked = useGameStore((s) => s.parked);
  const fleet = useGameStore((s) => s.fleet);
  const news = useGameStore((s) => s.seaNews.length);
  const close = useGameStore((s) => s.setAtlasOpen);
  const known = useMemo(() => [here, ...Object.keys(parked), ...charts], [here, parked, charts]);
  if (!open || !planet) return null;
  return (
    <div className="pointer-events-auto absolute inset-0 z-20 flex items-center justify-center bg-black/80 text-white">
      <div className="flex w-[64rem] max-w-[calc(100vw-2rem)] flex-col gap-3 p-4">
        <header className="flex items-baseline justify-between gap-2">
          <h2 className="font-serif text-2xl text-amber-100">Mapa Múndi</h2>
          <span className="text-xs text-neutral-300">
            Frota: {fleet.length} navio(s){news > 0 ? ` · ${news} notícia(s) no mar` : ""} · cartas náuticas se compram no cais dos portos
          </span>
        </header>
        <PlanetMap planet={planet} here={here} known={known} />
        <div>
          <Button variant="danger" onClick={() => close(false)}>
            Fechar
          </Button>
        </div>
      </div>
    </div>
  );
}
