import { useGameStore } from "../../../store/useGameStore";
import { freightOf, freightWeight } from "../../../game/sim/trade";
import { GOODS, GOOD_LIST, TRADE, type Good } from "../../../utils/constants";
import { cargoCapacity } from "../../../utils/economy";

const sectionTitle = "text-sm font-bold uppercase tracking-wider text-neutral-400";
const small = "rounded border px-2 py-0.5 text-[11px] font-semibold disabled:opacity-30";

/**
 * Depósito de mercadorias do acampamento (Marco 14): o que fica guardado e o que vai nas
 * carroças para vender; grão e carne viram rações; a ração de cerveja da semana.
 */
export function DepotPanel() {
  const depot = useGameStore((s) => s.depot);
  const iron = useGameStore((s) => s.iron);
  const freight = useGameStore((s) => s.freight);
  const wagons = useGameStore((s) => s.wagons.length);
  const away = useGameStore((s) => s.exposure.away);
  const aleRation = useGameStore((s) => s.aleRation);
  const soldiers = useGameStore((s) => s.battalions.reduce((n, b) => n + b.soldiers, 0));
  const moveGoods = useGameStore((s) => s.moveGoods);
  const millFood = useGameStore((s) => s.millFood);
  const setAleRation = useGameStore((s) => s.setAleRation);
  const inDepot = (g: Good) => (g === "IRON" ? iron : (depot[g] ?? 0));
  const goods = GOOD_LIST.filter((g) => inDepot(g) > 0 || freightOf(freight, g) > 0);
  const room = cargoCapacity(wagons) - freightWeight(freight);
  const alePerWeek = Math.max(1, Math.ceil((soldiers / 20) * TRADE.ALE_PER_20));

  return (
    <section className="flex flex-col gap-2">
      <h3 className={sectionTitle}>Depósito de mercadorias</h3>
      <p className="text-xs text-neutral-400">
        Mercadoria nas carroças: peso {freightWeight(freight)}/{cargoCapacity(wagons)} (rações entram na carga ao sair). Carga pesada atrasa a marcha. Ao voltar, o ferro vai para a Ferraria e
        os cavalos para o estábulo; o resto fica nas carroças.
      </p>
      {goods.length === 0 && <p className="text-xs text-neutral-500">Nada guardado. Compre nos mercados e traga, ou tome dos inimigos.</p>}
      {goods.map((g) => (
        <div key={g} className="flex items-center justify-between gap-2 text-xs">
          <span>
            {GOODS[g].icon} {GOODS[g].label}: <b>{inDepot(g)}</b> no depósito · <b className="text-violet-300">{freightOf(freight, g)}</b> nas carroças
          </span>
          <span className="flex gap-1">
            <button type="button" className={`${small} border-blue-400 bg-blue-700`} disabled={away || inDepot(g) < 1 || GOODS[g].weight * Math.min(5, inDepot(g)) > room} onClick={() => moveGoods(g, Math.min(5, inDepot(g)))}>
              → carroças
            </button>
            <button type="button" className={`${small} border-amber-400 bg-amber-800`} disabled={away || freightOf(freight, g) < 1} onClick={() => moveGoods(g, -freightOf(freight, g))}>
              → depósito
            </button>
            {(g === "GRAIN" || g === "MEAT") && (
              <button type="button" className={`${small} border-orange-400 bg-orange-800`} disabled={(depot[g] ?? 0) < 1} onClick={() => millFood(g, Math.min(5, depot[g] ?? 0))} title={`1 de ${GOODS[g].label.toLowerCase()} = ${TRADE.RATIONS_PER_FOOD} rações`}>
                → rações
              </button>
            )}
          </span>
        </div>
      ))}
      <label className="flex items-center gap-2 text-xs text-neutral-300">
        <input type="checkbox" checked={aleRation} onChange={(e) => setAleRation(e.target.checked)} />
        Ração de cerveja: {alePerWeek} barril(is) por semana para a tropa (humor +{TRADE.ALE_MOOD}; sem cerveja, reclamações).
      </label>
    </section>
  );
}
