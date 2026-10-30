import { nearestMarket, sutlerPackPrice, useGameStore } from "../../../store/useGameStore";
import { ECONOMY } from "../../../utils/constants";
import { Button } from "../Button";

/**
 * Intendência: compra de rações e pagamento de salários atrasados. Desde o Marco 14 o
 * vivandeiro busca a comida no mercado mais perto: o preço acompanha o de lá (mais o frete).
 */
export function MarketPanel() {
  const gold = useGameStore((s) => s.gold);
  const debt = useGameStore((s) => s.debt);
  const pendingMutiny = useGameStore((s) => s.pendingMutiny);
  const buyRations = useGameStore((s) => s.buyRations);
  const payDebt = useGameStore((s) => s.payDebt);
  const price = useGameStore((s) => sutlerPackPrice(s));
  const source = useGameStore((s) => nearestMarket(s)?.name ?? null);

  const packs = [1, 3];

  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-sm font-bold uppercase tracking-wider text-neutral-400">Intendência</h2>
      <p className="text-xs text-neutral-400">
        O vivandeiro compra em {source ?? "algum mercado"} e cobra o frete: {price} de ouro por {ECONOMY.RATION_PACK_SIZE} rações. Comprar direto na praça sai mais barato.
      </p>
      <div className="flex flex-wrap gap-2">
        {packs.map((n) => (
          <Button key={n} disabled={gold < n * price} onClick={() => buyRations(n)}>
            +{n * ECONOMY.RATION_PACK_SIZE} rações ({n * price} ouro)
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
