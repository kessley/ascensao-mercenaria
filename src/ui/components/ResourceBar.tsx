import { useGameStore } from "../../store/useGameStore";
import { cargoCapacity, dailyRations } from "../../utils/economy";
import { freightOf, freightWeight } from "../../game/sim/trade";
import { GOODS, GOOD_LIST } from "../../utils/constants";

export function ResourceBar() {
  const gold = useGameStore((s) => s.gold);
  const rations = useGameStore((s) => s.rations);
  const iron = useGameStore((s) => s.iron);
  const cargo = useGameStore((s) => s.cargo);
  const wagons = useGameStore((s) => s.wagons.length);
  const away = useGameStore((s) => s.exposure.away);
  const packed = useGameStore((s) => s.campPacked);
  const battalions = useGameStore((s) => s.battalions);
  const freight = useGameStore((s) => s.freight);
  // Em campo o exército come das carroças: quantos dias de comida elas levam
  const days = away && !packed ? Math.floor(cargo / Math.max(1, dailyRations(battalions))) : null;
  const goods = freightWeight(freight);
  const fieldCargo = away && !packed ? cargo : 0;
  const carried = GOOD_LIST.map((g) => ({ g, n: freightOf(freight, g) })).filter((x) => x.n > 0);
  const fame = useGameStore((s) => s.fame);
  const honor = useGameStore((s) => s.honor);
  const fear = useGameStore((s) => s.fear);

  return (
    <div className="flex gap-4 whitespace-nowrap rounded bg-black/60 px-4 py-2 text-sm font-mono text-white">
      <span className="text-yellow-400">Ouro: {gold}</span>
      <span
        className="text-orange-300"
        title={
          packed
            ? "Acampamento levantado: o depósito inteiro vai nas carroças"
            : "Depósito do acampamento · carga das carroças / capacidade (em campo, o exército come o que as carroças levam)"
        }
      >
        Rações: {rations}
        {(away || cargo > 0 || goods > 0) && !packed && (
          <span className={days !== null && days <= 1 ? "text-red-400" : "text-orange-200"}>
            {" "}
            · 🛒 {fieldCargo + goods}/{cargoCapacity(wagons)}
            {days !== null && ` (${days}d)`}
          </span>
        )}
        {packed && <span className="text-amber-200"> · nas carroças</span>}
      </span>
      <span className="text-sky-300">Ferro: {iron}</span>
      <span title="Fama, Honra e Temor: o nome do bando (Livro da Nobreza, na mesa da Tenda)">
        <span className="text-amber-300">★{Math.round(fame)}</span> <span className="text-sky-200">⚖{Math.round(honor)}</span> <span className="text-rose-400">☠{Math.round(fear)}</span>
      </span>
      {freight.length > 0 && (
        <span
          className="text-violet-300"
          title={`Mercadorias nas carroças (peso ${goods}): ${carried.map((x) => `${x.n} ${GOODS[x.g].label.toLowerCase()}`).join(", ")}`}
        >
          Carga: {carried.map((x) => `${GOODS[x.g].icon}${x.n}`).join(" ")}
        </span>
      )}
    </div>
  );
}
