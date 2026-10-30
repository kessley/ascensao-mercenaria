import { useGameStore } from "../../store/useGameStore";
import { RIVER_KIND_LABEL } from "../../game/data/world";
import { GEO } from "../../utils/constants";
import { Button } from "./Button";

const sectionTitle = "text-sm font-bold uppercase tracking-wider text-neutral-400";

/**
 * Balsa num rio grande (Marco 11, completado no Marco 12): onde não há ponte, o barqueiro leva
 * o exército inteiro de um cais ao outro, por um preço e um pedaço do dia. Bandos e a viagem
 * rápida não usam balsas.
 */
export function FerryPanel({ ferryId }: { ferryId: string }) {
  const world = useGameStore((s) => s.world);
  const gold = useGameStore((s) => s.gold);
  const mutiny = useGameStore((s) => s.mutiny);
  const sendBattleCommand = useGameStore((s) => s.sendBattleCommand);
  const setCampPanel = useGameStore((s) => s.setCampPanel);
  const crossing = world?.geo.crossings.find((c) => c.id === ferryId && c.kind === "FERRY");
  if (!world || !crossing) return <p className="text-sm text-neutral-400">Esta balsa não existe.</p>;
  const river = world.geo.rivers.find((r) => r.id === crossing.riverId);

  return (
    <section className="flex flex-col gap-3 text-sm">
      <div>
        <h3 className={sectionTitle}>{river?.name ?? "Rio"}</h3>
        <p className="text-xs text-neutral-400">
          {river ? `${RIVER_KIND_LABEL[river.kind]} com ${Math.round(crossing.width)} px de largura: ninguém atravessa a pé` : ""}
        </p>
      </div>
      <p className="text-xs text-neutral-300">
        O barqueiro leva o exército inteiro, com cavalos e tudo, até o cais da outra margem: {GEO.FERRY_GOLD} de ouro e cerca de{" "}
        {GEO.FERRY_DAYS.toString().replace(".", ",")} dia de travessia. Bandos e a viagem rápida não usam balsas.
      </p>
      <Button
        disabled={gold < GEO.FERRY_GOLD || !!mutiny}
        onClick={() => {
          sendBattleCommand({ type: "FERRY", ids: [], ferryId });
          setCampPanel(null);
        }}
      >
        Atravessar de balsa ({GEO.FERRY_GOLD} ouro)
      </Button>
      {mutiny && <p className="text-xs text-red-400">Ninguém sai daqui durante um motim.</p>}
    </section>
  );
}
