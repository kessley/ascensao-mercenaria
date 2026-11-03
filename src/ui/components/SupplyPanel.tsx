import { useState } from "react";
import { marchingIds, useGameStore, wagonsWithArmy, type GameState } from "../../store/useGameStore";
import { convoyDays, convoyRisk, packCapacity, packOf } from "../../game/sim/logistics";
import { dailyRations } from "../../utils/economy";
import { SUPPLY, TROOPS } from "../../utils/constants";
import { distance } from "../../utils/math";

const sectionTitle = "text-sm font-bold uppercase tracking-wider text-neutral-400";

/** Comida que marcha com o exército: mochilas de quem saiu, bolsa do Comandante e carroças junto. */
export function fieldFood(s: Pick<GameState, "battalions" | "training" | "campStay" | "cargo">): { food: number; need: number; days: number } {
  const going = marchingIds(s);
  const field = s.battalions.filter((b) => going.has(b.id));
  const food = field.reduce((n, b) => n + packOf(b), 0) + s.cargo;
  const need = dailyRations(field);
  return { food, need, days: food / Math.max(1, need) };
}

export function useFieldFood(): { food: number; need: number; days: number } {
  const battalions = useGameStore((s) => s.battalions);
  const training = useGameStore((s) => s.training);
  const campStay = useGameStore((s) => s.campStay);
  const cargo = useGameStore((s) => s.cargo);
  return fieldFood({ battalions, training, campStay, cargo });
}

const WHERE: Record<GameState["train"], string> = {
  CAMP: "paradas no acampamento",
  ARMY: "andando com o exército",
  ROAD: "na estrada, num comboio",
};

/**
 * Suprimentos (rações refeitas na Fase 3): cada batalhão leva a própria comida na mochila; as
 * carroças ficam no acampamento e saem num comboio quando a comida aperta, com escolta ou sem.
 */
export function SupplyPanel() {
  const battalions = useGameStore((s) => s.battalions);
  const training = useGameStore((s) => s.training);
  const campStay = useGameStore((s) => s.campStay);
  const wagons = useGameStore((s) => s.wagons.length);
  const train = useGameStore((s) => s.train);
  const convoy = useGameStore((s) => s.convoy);
  const rations = useGameStore((s) => s.rations);
  const followers = useGameStore((s) => s.followers);
  const away = useGameStore((s) => s.exposure.away);
  const packed = useGameStore((s) => s.campPacked);
  const clock = useGameStore((s) => s.day + s.dayProgress);
  const army = useGameStore((s) => s.battleHud?.position ?? null);
  const camp = useGameStore((s) => s.world?.camp.center ?? null);
  const withArmy = useGameStore((s) => wagonsWithArmy(s));
  const sendSupplies = useGameStore((s) => s.sendSupplies);
  const sendWagonsHome = useGameStore((s) => s.sendWagonsHome);
  const { food, need, days } = useFieldFood();
  const [escort, setEscort] = useState<string[]>([]);
  const [problem, setProblem] = useState<string | null>(null);

  const going = marchingIds({ battalions, training, campStay });
  const field = battalions.filter((b) => going.has(b.id));
  const busy = new Set(training.map((t) => t.battalionId));
  const home = battalions.filter((b) => !going.has(b.id) && !busy.has(b.id));
  const picked = home.filter((b) => escort.includes(b.id));
  const staying = battalions.filter((b) => !going.has(b.id) && !escort.includes(b.id));
  const reserve = Math.max(0, dailyRations(staying, followers) - 1) * SUPPLY.CAMP_RESERVE_DAYS;
  const load = Math.min(wagons * SUPPLY.WAGON_CAPACITY, Math.max(0, rations - reserve));
  const trip = army && camp ? convoyDays(distance(camp, army)) : 0;
  const risk = convoyRisk(trip, picked.reduce((n, b) => n + b.soldiers, 0));
  const toggle = (id: string) => setEscort((list) => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id]));

  return (
    <>
      <section className="flex flex-col gap-2">
        <h3 className={sectionTitle}>Comida em campo</h3>
        <p className={`text-sm ${days <= 1.5 ? "text-red-300" : "text-neutral-200"}`}>
          {Math.floor(food)} rações com o exército · {need}/dia · <b>{days.toFixed(1)} dia(s)</b>
        </p>
        <ul className="flex flex-col gap-1 text-xs">
          {field.map((b) => {
            const cap = packCapacity(b);
            const share = cap > 0 ? packOf(b) / cap : 0;
            return (
              <li key={b.id} className="flex items-center gap-2 rounded bg-neutral-800 px-2 py-1">
                <span className="w-40 truncate">
                  <b>{b.name}</b> <span className="text-neutral-400">{TROOPS[b.troopType].label}</span>
                </span>
                <span className="h-1.5 flex-1 overflow-hidden rounded bg-neutral-700">
                  <span className={`block h-full ${share <= 0.2 ? "bg-red-500" : "bg-amber-400"}`} style={{ width: `${Math.round(share * 100)}%` }} />
                </span>
                <span className="w-16 text-right font-mono">
                  {Math.floor(packOf(b))}/{cap}
                </span>
              </li>
            );
          })}
        </ul>
        <p className="text-xs text-neutral-400">
          Cada batalhão sai do acampamento com {SUPPLY.PACK_DAYS} dias de comida na mochila. Comprar num povoado e forragear enchem as mochilas; o que sobra vai na bolsa do Comandante ou nas carroças.
        </p>
      </section>

      <section className="flex flex-col gap-2">
        <h3 className={sectionTitle}>Carroças</h3>
        <p className="text-sm text-neutral-200">
          {wagons} carroça(s), {WHERE[train]}
          {withArmy > 0 ? " (a coluna anda no passo delas)" : ""}.
        </p>
        {convoy && (
          <p className="rounded bg-neutral-800 p-2 text-xs text-neutral-200">
            {convoy.returning ? "Voltando ao acampamento" : "A caminho do exército"} com {Math.round(convoy.load)} rações
            {convoy.escort.length > 0 ? `, escoltado por ${convoy.escort.map((b) => b.name).join(" e ")}` : ", sem escolta"} · chega em cerca de{" "}
            {Math.max(1, Math.round((convoy.arriveAt - clock) * 24))} hora(s).
          </p>
        )}
        {!away && <p className="text-xs text-neutral-400">No acampamento todos comem do depósito. No Portão, escolha se as carroças vão junto.</p>}
        {away && packed && <p className="text-xs text-neutral-400">Acampamento levantado: o depósito inteiro anda nas carroças com o exército.</p>}
        {away && !packed && train === "CAMP" && wagons > 0 && (
          <div className="flex flex-col gap-2 rounded border border-amber-700/70 bg-amber-950/30 p-2">
            <h4 className="text-sm font-semibold text-amber-200">Mandar um comboio</h4>
            <p className="text-xs text-neutral-300">
              As carroças saem do acampamento com {load} rações (fica a reserva de quem está lá) e alcançam o exército em cerca de {Math.max(1, Math.round(trip * 24))} hora(s). Quem escolta vai com a mochila cheia e fica com o exército.
            </p>
            {home.length === 0 ? (
              <p className="text-xs text-neutral-500">Ninguém de guarda no acampamento para escoltar: o comboio vai sozinho.</p>
            ) : (
              <div className="flex flex-col gap-1">
                {home.map((b) => (
                  <label key={b.id} className="flex items-center gap-2 text-xs">
                    <input type="checkbox" checked={escort.includes(b.id)} onChange={() => toggle(b.id)} className="accent-amber-400" />
                    escoltar com <b>{b.name}</b> ({TROOPS[b.troopType].label}, {b.soldiers})
                  </label>
                ))}
              </div>
            )}
            <p className={`text-xs ${risk >= 0.3 ? "text-red-300" : "text-neutral-300"}`}>
              Chance de salteadores no caminho: {Math.round(risk * 100)}%{picked.length === 0 ? " (sem escolta, perdem-se parte da carga e às vezes uma carroça)" : " (a escolta repele, com baixas)"}.
            </p>
            {problem && <p className="text-xs text-red-300">{problem}</p>}
            <button
              type="button"
              disabled={load <= 0 && picked.length === 0}
              onClick={() => setProblem(sendSupplies(escort))}
              className="self-end rounded border border-amber-400 bg-amber-700 px-3 py-1 text-sm font-semibold text-white hover:bg-amber-600 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Mandar o comboio
            </button>
          </div>
        )}
        {away && !packed && train === "CAMP" && wagons === 0 && <p className="text-xs text-neutral-400">O bando não tem carroças: compre na Intendência do acampamento.</p>}
        {away && !packed && train === "ARMY" && (
          <div className="flex flex-col gap-1">
            <p className="text-xs text-neutral-400">As carroças atrasam a coluna na lama e atraem saqueadores. Mandadas de volta, levam a comida que sobrou para o depósito.</p>
            {problem && <p className="text-xs text-red-300">{problem}</p>}
            <button type="button" onClick={() => setProblem(sendWagonsHome())} className="self-start rounded border border-neutral-500 px-3 py-1 text-sm hover:border-amber-400">
              Mandar as carroças de volta
            </button>
          </div>
        )}
      </section>
    </>
  );
}
