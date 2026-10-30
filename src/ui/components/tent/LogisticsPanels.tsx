import { PEDDLER_ITEMS, useGameStore, type PeddlerItem } from "../../../store/useGameStore";
import { CAMP_MOVE, CAMP_WORKS, SUPPLY, type CampWork } from "../../../utils/constants";
import { cargoCapacity, dailyRations } from "../../../utils/economy";
import { SICKNESS_LABEL } from "../../../game/sim/logistics";
import { Button } from "../Button";

/** Intendência: o trem de carroças (Marco 13). */
export function WagonPanel() {
  const gold = useGameStore((s) => s.gold);
  const wagons = useGameStore((s) => s.wagons);
  const rations = useGameStore((s) => s.rations);
  const battalions = useGameStore((s) => s.battalions);
  const buyWagon = useGameStore((s) => s.buyWagon);
  const cap = cargoCapacity(wagons.length);
  const need = dailyRations(battalions);
  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-sm font-bold uppercase tracking-wider text-neutral-400">Trem de carroças</h2>
      <p className="text-xs text-neutral-400">
        Em campo, o exército come o que as carroças levam: ao sair, elas carregam o que cabe do depósito (deixando {SUPPLY.CAMP_RESERVE_DAYS} dias para
        quem fica). São lentas na lama e na neve e são o alvo preferido dos saqueadores.
      </p>
      <div className="text-sm text-neutral-200">
        {wagons.length} carroça(s) · levam até <b>{cap}</b> rações ({Math.floor(cap / Math.max(1, need))} dias de marcha para o exército de hoje) ·
        depósito: {rations}
      </div>
      <div className="flex flex-wrap gap-1 text-xs">
        {wagons.map((w, i) => (
          <span key={w.id} className={`rounded px-1.5 ${w.hp < SUPPLY.WAGON.hp ? "bg-amber-900 text-amber-100" : "bg-neutral-700 text-neutral-200"}`}>
            Carroça {i + 1} · {Math.round((w.hp / SUPPLY.WAGON.hp) * 100)}%
          </span>
        ))}
      </div>
      <Button disabled={gold < SUPPLY.WAGON_COST || wagons.length >= SUPPLY.MAX_WAGONS} onClick={buyWagon}>
        Comprar carroça (+{SUPPLY.WAGON_CAPACITY} rações de carga) — {SUPPLY.WAGON_COST} ouro
      </Button>
    </section>
  );
}

/** Banca do mascate (seguidor): o que ele vende. */
export function PeddlerPanel() {
  const gold = useGameStore((s) => s.gold);
  const day = useGameStore((s) => s.day);
  const blanketsUntil = useGameStore((s) => s.blanketsUntil);
  const wounded = useGameStore((s) => s.battalions.reduce((n, b) => n + (b.wounded ?? 0), 0));
  const peddler = useGameStore((s) => s.followers.find((f) => f.role === "PEDDLER"));
  const buy = useGameStore((s) => s.buyFromPeddler);
  if (!peddler) return <p className="text-sm text-neutral-400">O mascate não segue mais o bando.</p>;
  return (
    <section className="flex flex-col gap-2">
      <p className="text-xs text-neutral-400">{peddler.name} abre a carroça de bugigangas: "Coisa boa, preço de amigo."</p>
      {(Object.keys(PEDDLER_ITEMS) as PeddlerItem[]).map((k) => {
        const it = PEDDLER_ITEMS[k];
        const useless = k === "BANDAGES" && wounded === 0;
        return (
          <div key={k} className="flex items-center justify-between gap-2 text-sm">
            <span>
              {it.label} <span className="text-xs text-neutral-400">— {it.effect}</span>
              {k === "BLANKETS" && blanketsUntil > day && <span className="text-xs text-emerald-300"> (a tropa tem cobertores até o dia {blanketsUntil})</span>}
              {useless && <span className="text-xs text-neutral-500"> (ninguém ferido)</span>}
            </span>
            <Button disabled={gold < it.gold || useless} onClick={() => buy(k)}>
              {it.gold} ouro
            </Button>
          </div>
        );
      })}
    </section>
  );
}

/** Tenda: enfermaria (feridos e doentes de cada batalhão). */
export function InfirmaryPanel() {
  const battalions = useGameStore((s) => s.battalions);
  const out = battalions.filter((b) => (b.wounded ?? 0) + (b.sick ?? 0) > 0);
  if (out.length === 0) return null;
  return (
    <section className="flex flex-col gap-1">
      <h2 className="text-sm font-bold uppercase tracking-wider text-neutral-400">Enfermaria</h2>
      <p className="text-xs text-neutral-400">
        Feridos e doentes não lutam, mas comem. No acampamento saram bem mais depressa (e a curandeira ajuda); em campo, alguns morrem.
      </p>
      {out.map((b) => (
        <div key={b.id} className="text-sm text-rose-200">
          {b.name}: {(b.wounded ?? 0) > 0 && `${b.wounded} ferido(s)`}
          {(b.wounded ?? 0) > 0 && (b.sick ?? 0) > 0 && " · "}
          {(b.sick ?? 0) > 0 && `${b.sick} doente(s)${b.sickness ? ` de ${SICKNESS_LABEL[b.sickness]}` : ""}`}
        </div>
      ))}
    </section>
  );
}

/** Tenda: obras do acampamento fixo e levantar acampamento (Marco 13). */
export function CampWorksPanel() {
  const gold = useGameStore((s) => s.gold);
  const iron = useGameStore((s) => s.iron);
  const works = useGameStore((s) => s.campWorks);
  const training = useGameStore((s) => s.training.length);
  const build = useGameStore((s) => s.buildCampWork);
  const send = useGameStore((s) => s.sendBattleCommand);
  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-sm font-bold uppercase tracking-wider text-neutral-400">Acampamento</h2>
      <div className="flex flex-col gap-1">
        {(Object.keys(CAMP_WORKS) as CampWork[]).map((w) => {
          const c = CAMP_WORKS[w];
          const done = works.includes(w);
          return (
            <div key={w} className="flex items-center justify-between gap-2 text-sm">
              <span className={done ? "text-emerald-300" : "text-neutral-200"}>
                {done ? "✓ " : ""}
                {c.label} <span className="text-xs text-neutral-400">— {c.effect}</span>
              </span>
              {!done && (
                <Button disabled={gold < c.gold || iron < c.iron} onClick={() => build(w)}>
                  {c.gold} ouro{c.iron > 0 ? ` · ${c.iron} ferro` : ""}
                </Button>
              )}
            </div>
          );
        })}
      </div>
      <div className="flex items-center justify-between gap-2 border-t border-neutral-700 pt-2 text-xs text-neutral-400">
        <span>
          Levantar o acampamento: {CAMP_MOVE.PACK_DAYS} dia(s) de trabalho; tudo vai nas carroças (a coluna fica mais lenta) e as obras se perdem. Monte-o de novo
          em qualquer terra firme longe de povoados ({CAMP_MOVE.PITCH_DAYS} dia).
        </span>
        <Button variant="danger" disabled={training > 0} onClick={() => send({ type: "PACK_CAMP", ids: [] })}>
          Levantar acampamento
        </Button>
      </div>
    </section>
  );
}
