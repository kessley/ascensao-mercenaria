import { supportWages } from "../../../game/data/riders";
import { townBarrier, townTongue, useGameStore } from "../../../store/useGameStore";
import { TONGUE, garble, losesDetail } from "../../../game/sim/language";
import { hashString } from "../../../utils/hash";
import { WORLD } from "../../../utils/constants";
import { DIFFICULTY, type Contract, type Difficulty } from "../../../game/data/contracts";
import { dailyRations, daysUntilPayday, weeklyWages } from "../../../utils/economy";
import { CouncilOpinions } from "./LieutenantPanels";
import { MissionMap } from "../missions/MissionMap";
import { DelegateButton, MissionSteps, useArmyAt, useMissionPlan } from "../missions/MissionParts";

const DIFFICULTY_COLOR: Record<Difficulty, string> = {
  1: "text-green-400",
  2: "text-yellow-400",
  3: "text-red-400",
};

/** Uma oferta: quem paga, o que fazer, por onde, quanto custa e quem vai. */
function ContractOffer({ c }: { c: Contract }) {
  const pendingMutiny = useGameStore((s) => s.pendingMutiny);
  const battalions = useGameStore((s) => s.battalions);
  const followers = useGameStore((s) => s.followers);
  const lieutenants = useGameStore((s) => s.lieutenants);
  const riders = useGameStore((s) => supportWages(s.scouts.length, s.messengers.length));
  const rations = useGameStore((s) => s.rations);
  const gold = useGameStore((s) => s.gold);
  const debt = useGameStore((s) => s.debt);
  const day = useGameStore((s) => s.day);
  const acceptContract = useGameStore((s) => s.acceptContract);
  const active = useGameStore((s) => s.activeContract);
  const mutiny = useGameStore((s) => s.mutiny);
  const world = useGameStore((s) => s.world);
  const army = useArmyAt();
  const plan = useMissionPlan(c);
  // O contrato vem na língua de quem paga: sem quem a fale, chega com menos detalhe (Marco 23)
  const tongue = useGameStore((s) => {
    const t = s.settlements.find((x) => x.id === c.clientId);
    return t ? townTongue(s, t) : null;
  });
  const barrier = useGameStore((s) => {
    const t = s.settlements.find((x) => x.id === c.clientId);
    return t ? townBarrier(s, t) : 0;
  });
  const vague = !!tongue && losesDetail(barrier);

  const perDay = dailyRations(battalions, followers);
  const wages = weeklyWages(battalions, lieutenants) + riders;
  const food = perDay * c.travelDays;
  const hungry = food > rations;
  const payday = daysUntilPayday(day) <= c.travelDays;
  const cantPay = payday && gold + c.advance < wages + debt;

  return (
    <article className="flex flex-col gap-2 rounded border border-neutral-700 bg-neutral-800 p-3 text-sm">
      <header className="flex items-start justify-between gap-2">
        <div>
          <h3 className="font-semibold">{c.title}</h3>
          <div className="text-xs text-neutral-400">{c.client}</div>
        </div>
        <span className={`text-xs font-bold ${vague ? "text-neutral-400" : DIFFICULTY_COLOR[c.difficulty]}`}>{vague ? "perigo: ?" : DIFFICULTY[c.difficulty].label}</span>
      </header>
      <p className="text-xs text-neutral-300">{vague && tongue ? garble(c.description, tongue, barrier, hashString(c.id)) : c.description}</p>
      {vague && tongue && (
        <p className="text-xs italic text-yellow-300" data-contract-vague={tongue}>
          Veio {TONGUE[tongue].in}, e ninguém no bando a fala bem: sem o perigo nem o caminho. Um intérprete ou um oficial que a fale traria o detalhe.
        </p>
      )}
      {plan && world && !vague && (
        <div className="flex flex-col gap-2">
          <MissionSteps plan={plan} army={army} />
          <MissionMap world={world} plan={plan} army={army} />
        </div>
      )}
      <div className="flex flex-wrap gap-x-4 gap-y-1 font-mono text-xs">
        <span className="text-yellow-400">Adiantamento {c.advance}</span>
        <span className="text-yellow-300">Na entrega {c.reward}</span>
        <span className="text-neutral-300">~{c.travelDays} dia(s) daqui</span>
        <span className="text-neutral-400">prazo {c.travelDays + WORLD.CONTRACT_GRACE_DAYS} dias</span>
        <span className={hungry ? "text-red-400" : "text-neutral-400"}>−{food} rações</span>
      </div>
      {(hungry || payday) && (
        <div className="text-xs">
          {hungry && <div className="text-red-400">Rações não bastam para a marcha: as tropas chegarão com fome.</div>}
          {payday && (
            <div className={cantPay ? "text-red-400" : "text-neutral-400"}>
              Dia de pagamento durante a marcha ({wages + debt} ouro)
              {cantPay ? ": ouro insuficiente, haverá deserções." : "."}
            </div>
          )}
        </div>
      )}
      <CouncilOpinions contract={c} />
      <footer className="flex flex-wrap items-end justify-end gap-2">
        <DelegateButton contract={c} />
        <button
          type="button"
          disabled={pendingMutiny || !!mutiny || !!active}
          title={active ? "O Comandante só faz um contrato por vez: termine ou abandone o que está em andamento" : undefined}
          onClick={() => acceptContract(c.id)}
          className="rounded border border-blue-400 bg-blue-600 px-3 py-1 font-semibold text-white hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Aceitar (Comandante vai)
        </button>
      </footer>
    </article>
  );
}

/** Mesa estratégica: contratos oferecidos, com previsão do que a marcha vai custar. */
export function ContractBoard() {
  const contracts = useGameStore((s) => s.contracts);
  const setCampPanel = useGameStore((s) => s.setCampPanel);
  const busy = useGameStore((s) => (s.activeContract ? 1 : 0) + s.expeditions.length);
  return (
    <section className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-bold uppercase tracking-wider text-neutral-400">Mesa estratégica: contratos</h2>
        <button type="button" onClick={() => setCampPanel({ kind: "MISSIONS" })} className="rounded border border-amber-500 px-2 py-1 text-xs text-amber-200 hover:bg-amber-900/40">
          Diário de missões{busy > 0 ? ` (${busy})` : ""}
        </button>
      </div>
      {contracts.map((c) => (
        <ContractOffer key={c.id} c={c} />
      ))}
    </section>
  );
}
