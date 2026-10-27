import { useGameStore } from "../../../store/useGameStore";
import { ECONOMY } from "../../../utils/constants";
import { Button } from "../Button";

/** Intendência: compra de rações e pagamento de salários atrasados. */
export function MarketPanel() {
  const gold = useGameStore((s) => s.gold);
  const debt = useGameStore((s) => s.debt);
  const pendingMutiny = useGameStore((s) => s.pendingMutiny);
  const buyRations = useGameStore((s) => s.buyRations);
  const payDebt = useGameStore((s) => s.payDebt);

  const packs = [1, 3];

  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-sm font-bold uppercase tracking-wider text-neutral-400">Intendência</h2>
      <div className="flex flex-wrap gap-2">
        {packs.map((n) => (
          <Button key={n} disabled={gold < n * ECONOMY.RATION_PACK_PRICE} onClick={() => buyRations(n)}>
            +{n * ECONOMY.RATION_PACK_SIZE} rações ({n * ECONOMY.RATION_PACK_PRICE} ouro)
          </Button>
        ))}
        {debt > 0 && !pendingMutiny && (
          <Button variant="danger" disabled={gold < debt} onClick={payDebt}>
            Pagar atrasados ({debt} ouro)
          </Button>
        )}
      </div>
    </section>
  );
}
