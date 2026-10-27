import { mutinyLeader, useGameStore } from "../../../store/useGameStore";
import { TROOPS } from "../../../utils/constants";
import { Button } from "../Button";

/** Aviso de motim: pagar os atrasados ou enfrentar o batalhão rebelado. */
export function MutinyBanner() {
  const pending = useGameStore((s) => s.pendingMutiny);
  const debt = useGameStore((s) => s.debt);
  const gold = useGameStore((s) => s.gold);
  const battalions = useGameStore((s) => s.battalions);
  const payDebt = useGameStore((s) => s.payDebt);
  const confrontMutiny = useGameStore((s) => s.confrontMutiny);

  if (!pending) return null;
  const leader = mutinyLeader(battalions);

  return (
    <div className="flex flex-col gap-3 rounded border-2 border-red-600 bg-red-950/70 p-4">
      <div>
        <h2 className="text-xl font-bold text-red-300">MOTIM!</h2>
        <p className="text-sm text-red-100">
          Os salários estão atrasados há semanas.{" "}
          {leader && (
            <>
              <b>{leader.name}</b> ({TROOPS[leader.troopType].label}, {leader.soldiers} soldados) lidera a revolta.
            </>
          )}{" "}
          Pague os atrasados ou enfrente os amotinados. Nenhum contrato pode ser aceito até isso ser resolvido.
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button disabled={gold < debt} onClick={payDebt}>
          Pagar atrasados ({debt} ouro)
        </Button>
        <Button variant="danger" onClick={confrontMutiny}>
          Enfrentar os amotinados
        </Button>
      </div>
      {gold < debt && <p className="text-xs text-red-200">Ouro insuficiente: faltam {debt - gold}.</p>}
    </div>
  );
}
