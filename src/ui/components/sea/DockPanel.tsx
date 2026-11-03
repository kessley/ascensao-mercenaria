import { useMemo, useState } from "react";
import { CULTURES, seaDistance } from "../../../game/data/planet";
import { battalionSeats } from "../../../game/sim/voyage";
import { useGameStore } from "../../../store/useGameStore";
import type { EmbarkPlan } from "../../../store/seaSlice";
import { SEA, TROOPS, type ShipType } from "../../../utils/constants";
import { Button } from "../Button";
import { PlanetMap } from "./PlanetMap";

const sectionTitle = "text-sm font-bold uppercase tracking-wider text-neutral-400";
const SHIP_TYPES = Object.keys(SEA.SHIPS) as ShipType[];

/** Cais de um porto: cartas náuticas, navios e quem embarca para onde. */
export function DockPanel({ settlementId }: { settlementId: string }) {
  const planet = useGameStore((s) => s.planet);
  const here = useGameStore((s) => s.continent);
  const charts = useGameStore((s) => s.charts);
  const parked = useGameStore((s) => s.parked);
  const fleet = useGameStore((s) => s.fleet);
  const gold = useGameStore((s) => s.gold);
  const battalions = useGameStore((s) => s.battalions);
  const wagonCount = useGameStore((s) => s.wagons.length);
  const buyChart = useGameStore((s) => s.buyChart);
  const buyShip = useGameStore((s) => s.buyShip);
  const sellShip = useGameStore((s) => s.sellShip);
  const quoteVoyage = useGameStore((s) => s.quoteVoyage);
  const embark = useGameStore((s) => s.embark);
  const [to, setTo] = useState<string | null>(null);
  const [ship, setShip] = useState<ShipType | "FLEET">("COCA");
  const [ids, setIds] = useState<string[]>(battalions.map((b) => b.id));
  const [wagons, setWagons] = useState(wagonCount);
  const [error, setError] = useState<string | null>(null);

  const known = useMemo(() => [here, ...Object.keys(parked), ...charts], [here, parked, charts]);
  if (!planet) return null;
  const others = planet.continents.filter((c) => c.id !== here);
  const herePlace = planet.continents.find((c) => c.id === here);
  const plan: EmbarkPlan = { to: to ?? "", portId: settlementId, battalionIds: ids, wagons, ship };
  const quote = quoteVoyage(plan);
  const toggle = (id: string) => setIds((list) => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id]));

  return (
    <>
      <section className="flex flex-col gap-2">
        <h3 className={sectionTitle}>Para onde</h3>
        <PlanetMap planet={planet} here={here} known={known} selected={to} onPick={(id) => id !== here && known.includes(id) && setTo(id)} />
        <ul className="flex flex-col gap-1 text-sm">
          {others.map((c) => {
            const has = known.includes(c.id);
            const dist = herePlace ? Math.round(seaDistance(herePlace, c)) : 0;
            return (
              <li key={c.id} className="flex items-center justify-between gap-2 rounded bg-neutral-800 px-2 py-1">
                <span>
                  {has ? c.name : "Terra sem carta"}
                  {has && <span className="text-xs text-neutral-400"> · {CULTURES[c.culture].label}, onde se compra {CULTURES[c.culture].luxury}</span>}
                </span>
                {has ? (
                  <button type="button" onClick={() => setTo(c.id)} className={`rounded border px-2 py-0.5 text-xs ${to === c.id ? "border-amber-400 text-amber-200" : "border-neutral-600 text-neutral-200"}`}>
                    Rumar
                  </button>
                ) : (
                  <button type="button" disabled={gold < SEA.CHART_PRICE} title={`A ${dist} léguas de mar`} onClick={() => setError(buyChart(c.id))} className="rounded border border-neutral-600 px-2 py-0.5 text-xs text-neutral-200 disabled:opacity-40">
                    Carta náutica ({SEA.CHART_PRICE})
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      </section>

      <section className="flex flex-col gap-2">
        <h3 className={sectionTitle}>Quem embarca</h3>
        <ul className="flex flex-col gap-1 text-sm">
          {battalions.map((b) => (
            <li key={b.id}>
              <label className="flex items-center gap-2 rounded bg-neutral-800 px-2 py-1">
                <input type="checkbox" checked={ids.includes(b.id)} onChange={() => toggle(b.id)} className="accent-amber-500" />
                <span className="flex-1">
                  {b.name} <span className="text-xs text-neutral-400">({TROOPS[b.troopType].label})</span>
                </span>
                <span className="text-xs text-neutral-300">{battalionSeats(b)} lugares</span>
              </label>
            </li>
          ))}
        </ul>
        <label className="flex items-center justify-between gap-2 text-sm">
          Carroças ({SEA.SEATS.WAGON} lugares cada)
          <input type="number" min={0} max={wagonCount} value={wagons} onChange={(e) => setWagons(Math.max(0, Math.min(wagonCount, Math.round(Number(e.target.value) || 0))))} className="w-16 rounded border border-neutral-600 bg-neutral-900 px-2 py-1 text-center" />
        </label>
        <p className="text-xs text-neutral-400">Quem fica espera no cais e volta a se juntar ao bando quando ele voltar a esta terra.</p>
      </section>

      <section className="flex flex-col gap-2">
        <h3 className={sectionTitle}>Em que navio</h3>
        <div className="flex flex-wrap gap-1">
          {fleet.length > 0 && (
            <button type="button" onClick={() => setShip("FLEET")} className={`rounded border px-2 py-1 text-xs ${ship === "FLEET" ? "border-amber-400 text-amber-200" : "border-neutral-600 text-neutral-200"}`}>
              Frota do bando
            </button>
          )}
          {SHIP_TYPES.map((type) => (
            <button key={type} type="button" onClick={() => setShip(type)} className={`rounded border px-2 py-1 text-xs ${ship === type ? "border-amber-400 text-amber-200" : "border-neutral-600 text-neutral-200"}`}>
              Fretar {SEA.SHIPS[type].label.toLowerCase()}
            </button>
          ))}
        </div>
        <ul className="flex flex-col gap-1 text-sm">
          {SHIP_TYPES.map((type) => (
            <li key={type} className="flex items-center justify-between gap-2 rounded bg-neutral-800 px-2 py-1">
              <span title={SEA.SHIPS[type].description}>
                {SEA.SHIPS[type].label} <span className="text-xs text-neutral-400">· {SEA.SHIPS[type].seats} lugares · {SEA.SHIPS[type].upkeep}/semana</span>
              </span>
              <button type="button" disabled={gold < SEA.SHIPS[type].price} onClick={() => setError(buyShip(type))} className="rounded border border-neutral-600 px-2 py-0.5 text-xs text-neutral-200 disabled:opacity-40">
                Comprar ({SEA.SHIPS[type].price})
              </button>
            </li>
          ))}
          {fleet.map((f) => (
            <li key={f.id} className="flex items-center justify-between gap-2 rounded border border-sky-900 bg-sky-950/40 px-2 py-1">
              <span>
                {f.name} <span className="text-xs text-neutral-400">· {SEA.SHIPS[f.type].label}</span>
              </span>
              <button type="button" onClick={() => setError(sellShip(f.id))} className="rounded border border-neutral-600 px-2 py-0.5 text-xs text-neutral-200">
                Vender
              </button>
            </li>
          ))}
        </ul>
      </section>

      <section className="flex flex-col gap-2 rounded border border-amber-800/60 bg-amber-950/20 p-3">
        <p className="text-sm">
          {quote.seats} de {quote.capacity || "?"} lugares
          {quote.days > 0 && ` · ${quote.days} dias de mar`}
          {quote.price > 0 && ` · frete ${quote.price} de ouro`}
        </p>
        {(error ?? quote.problem) && <p className="text-xs text-red-300">{error ?? quote.problem}</p>}
        <Button
          variant="gold"
          disabled={!!quote.problem}
          onClick={() => {
            const why = embark(plan);
            if (why) setError(why);
          }}
        >
          Zarpar
        </Button>
      </section>
    </>
  );
}
