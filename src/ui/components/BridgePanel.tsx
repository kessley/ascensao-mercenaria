import { useState } from "react";
import { useGameStore } from "../../store/useGameStore";
import { RIVER_KIND_LABEL } from "../../game/data/world";
import { bridgeController, ownerLabel } from "../../game/sim/realm";
import { GEO } from "../../utils/constants";
import { Button } from "./Button";

const sectionTitle = "text-sm font-bold uppercase tracking-wider text-neutral-400";

/**
 * Ponte sobre um rio (Marco 11): quem a controla (o povoado mais próximo), o pedágio e a
 * escolha de queimá-la — corta a passagem de exércitos e hordas, mas irrita o dono — ou de
 * reconstruí-la com madeira comprada.
 */
export function BridgePanel({ bridgeId }: { bridgeId: string }) {
  const world = useGameStore((s) => s.world);
  const settlements = useGameStore((s) => s.settlements);
  const calamities = useGameStore((s) => s.calamities);
  const burned = useGameStore((s) => s.burnedBridges.includes(bridgeId));
  const gold = useGameStore((s) => s.gold);
  const burnBridge = useGameStore((s) => s.burnBridge);
  const rebuildBridge = useGameStore((s) => s.rebuildBridge);
  const [confirm, setConfirm] = useState(false);
  const crossing = world?.geo.crossings.find((c) => c.id === bridgeId);
  if (!world || !crossing) return <p className="text-sm text-neutral-400">Esta ponte não existe.</p>;
  const river = world.geo.rivers.find((r) => r.id === crossing.riverId);
  const town = bridgeController(settlements, crossing);
  const owner = town ? ownerLabel(world, calamities, town.owner) : null;
  const mine = town?.owner === "PLAYER";

  return (
    <section className="flex flex-col gap-3 text-sm">
      <div>
        <h3 className={sectionTitle}>{river?.name ?? "Rio"}</h3>
        <p className="text-xs text-neutral-400">
          {river ? `${RIVER_KIND_LABEL[river.kind]} com ${Math.round(crossing.width)} px de largura nesta travessia` : ""}
        </p>
      </div>
      <p>
        {burned ? (
          <span className="text-red-300">Queimada: só restam os pilares. Ninguém atravessa aqui.</span>
        ) : (
          <span className="text-emerald-300">De pé: exércitos, hordas e caravanas passam por aqui.</span>
        )}
      </p>
      <p className="text-xs text-neutral-300">
        {town
          ? mine
            ? `Controlada pelo bando (${town.name}): rende ${GEO.BRIDGE_TOLL} de ouro de pedágio por semana.`
            : `Controlada por ${town.name} (${owner}): quem cruza paga ${Math.round(GEO.BRIDGE_TOLL / 2)} de ouro, a não ser em guerra.`
          : "Longe de qualquer povoado: ninguém cobra pedágio."}
      </p>

      {burned ? (
        <Button disabled={gold < GEO.BRIDGE_REBUILD_GOLD} onClick={() => rebuildBridge(bridgeId)}>
          Reconstruir ({GEO.BRIDGE_REBUILD_GOLD} de ouro em madeira)
        </Button>
      ) : confirm ? (
        <div className="flex flex-col gap-2 rounded border border-red-800 bg-red-950/40 p-3 text-xs">
          <span>
            Queimar a ponte corta a passagem (as rotas vão buscar outra travessia).
            {town && !mine && owner ? ` ${owner} vai se lembrar disso (${GEO.BRIDGE_BURN_RELATION} de relação).` : ""}
          </span>
          <div className="flex gap-2">
            <Button
              className="border-red-500 bg-red-800 hover:bg-red-700"
              onClick={() => {
                burnBridge(bridgeId);
                setConfirm(false);
              }}
            >
              Queimar
            </Button>
            <Button onClick={() => setConfirm(false)}>Deixar de pé</Button>
          </div>
        </div>
      ) : (
        <Button onClick={() => setConfirm(true)}>Queimar a ponte…</Button>
      )}
    </section>
  );
}
