import { useGameStore } from "../../store/useGameStore";
import { cargoCapacity } from "../../utils/economy";
import { wagonsWithArmy } from "../../store/useGameStore";
import { useFieldFood } from "./SupplyPanel";
import { freightOf, freightWeight } from "../../game/sim/trade";
import { GOODS, GOOD_LIST } from "../../utils/constants";
import { GOOD_ICON } from "../../game/art/icons";
import { PixelIcon } from "./PixelIcon";

export function ResourceBar() {
  const gold = useGameStore((s) => s.gold);
  const rations = useGameStore((s) => s.rations);
  const iron = useGameStore((s) => s.iron);
  const cargo = useGameStore((s) => s.cargo);
  const wagons = useGameStore((s) => wagonsWithArmy(s));
  const away = useGameStore((s) => s.exposure.away);
  const packed = useGameStore((s) => s.campPacked);
  const freight = useGameStore((s) => s.freight);
  // Em campo cada batalhão come da mochila: quantos dias de comida o exército leva
  const field = useFieldFood();
  const days = away && !packed ? Math.floor(field.days) : null;
  const goods = freightWeight(freight);
  const fieldCargo = away && !packed ? cargo : 0;
  const carried = GOOD_LIST.map((g) => ({ g, n: freightOf(freight, g) })).filter((x) => x.n > 0);
  const fame = useGameStore((s) => s.fame);
  const honor = useGameStore((s) => s.honor);
  const fear = useGameStore((s) => s.fear);

  return (
    <div className="flex items-center gap-4 whitespace-nowrap hud-box px-4 py-2 text-sm font-mono text-white">
      <span className="text-yellow-400" title={`Ouro: ${gold}`}>
        <PixelIcon id="GOLD" /> {gold}
      </span>
      <span
        className="text-orange-300"
        title={
          packed
            ? `Rações: ${rations}. Acampamento levantado: o depósito inteiro vai nas carroças`
            : `Rações: ${rations} no depósito do acampamento · comida que marcha com o exército (mochilas, bolsa e carroças) e os dias que ela dura`
        }
      >
        <PixelIcon id="FOOD" /> {rations}
        {away && !packed && (
          <span className={days !== null && days <= 1 ? "text-red-400" : "text-orange-200"}>
            {" "}
            · <PixelIcon id="PACK" /> {Math.floor(field.food)} ({days}d)
          </span>
        )}
        {wagons > 0 && !packed && (fieldCargo > 0 || goods > 0) && (
          <span className="text-orange-200">
            {" "}
            · <PixelIcon id="WAGON" /> {Math.round(fieldCargo + goods)}/{cargoCapacity(wagons)}
          </span>
        )}
        {packed && <span className="text-amber-200"> · nas carroças</span>}
      </span>
      <span className="text-sky-300" title={`Ferro: ${iron}`}>
        <PixelIcon id="IRON" /> {iron}
      </span>
      <span title="Fama, Honra e Temor: o nome do bando (Livro da Nobreza, na mesa da Tenda)">
        <span className="text-amber-300">
          <PixelIcon id="STAR" /> {Math.round(fame)}
        </span>{" "}
        <span className="text-sky-200">
          <PixelIcon id="SCALES" /> {Math.round(honor)}
        </span>{" "}
        <span className="text-rose-400">
          <PixelIcon id="SKULL" /> {Math.round(fear)}
        </span>
      </span>
      {freight.length > 0 && (
        <span
          className="text-violet-300"
          title={`Mercadorias nas carroças (peso ${goods}): ${carried.map((x) => `${x.n} ${GOODS[x.g].label.toLowerCase()}`).join(", ")}`}
        >
          {carried.map((x) => (
            <span key={x.g} className="mr-1.5">
              <PixelIcon id={GOOD_ICON[x.g]} /> {x.n}
            </span>
          ))}
        </span>
      )}
    </div>
  );
}
