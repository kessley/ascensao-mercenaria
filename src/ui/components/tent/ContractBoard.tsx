import { supportWages } from "../../../game/data/riders";
import { useGameStore } from "../../../store/useGameStore";
import { WORLD } from "../../../utils/constants";
import { DIFFICULTY, contractGoal, type Difficulty } from "../../../game/data/contracts";
import { dailyRations, daysUntilPayday, weeklyWages } from "../../../utils/economy";
import { CouncilOpinions } from "./LieutenantPanels";

const DIFFICULTY_COLOR: Record<Difficulty, string> = {
  1: "text-green-400",
  2: "text-yellow-400",
  3: "text-red-400",
};

/** Mesa estratégica: contratos oferecidos, com previsão do que a marcha vai custar. */
export function ContractBoard() {
  const contracts = useGameStore((s) => s.contracts);
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
  const abandonContract = useGameStore((s) => s.abandonContract);
  const active = useGameStore((s) => s.activeContract);
  const mutiny = useGameStore((s) => s.mutiny);
  const world = useGameStore((s) => s.world);
  const settlements = useGameStore((s) => s.settlements);
  const siteName = (id: string) => world?.sites.find((x) => x.id === id)?.name ?? "?";
  const names = {
    site: siteName,
    town: (id?: string) => settlements.find((t) => t.id === id)?.name ?? "?",
    realm: (id?: string) => world?.factions.find((f) => f.id === id)?.name ?? "?",
  };

  const perDay = dailyRations(battalions, followers);
  const wages = weeklyWages(battalions, lieutenants) + riders;

  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-sm font-bold uppercase tracking-wider text-neutral-400">Mesa estratégica: contratos</h2>
      {active && (
        <div className="flex flex-col gap-2 rounded border border-amber-500/70 bg-amber-950/40 p-3 text-sm">
          <div className="font-semibold text-amber-200">Em andamento: {active.contract.title}</div>
          <p className="text-xs text-neutral-300">
            {contractGoal(active.contract, names, active.progress ?? 0).long} Até o dia <b>{active.deadline}</b>, pelo bônus de {active.contract.reward}.
          </p>
          <button
            type="button"
            onClick={abandonContract}
            className="self-end rounded border border-red-500 px-3 py-1 text-xs text-red-200 hover:bg-red-900/50"
          >
            Abandonar contrato
          </button>
        </div>
      )}
      {contracts.map((c) => {
        const food = perDay * c.travelDays;
        const hungry = food > rations;
        const payday = daysUntilPayday(day) <= c.travelDays;
        const cantPay = payday && gold + c.advance < wages + debt;
        return (
          <div key={c.id} className="flex flex-col gap-2 rounded border border-neutral-700 bg-neutral-800 p-3 text-sm">
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="font-semibold">{c.title}</div>
                <div className="text-xs text-neutral-400">
                  {c.client} · {contractGoal(c, names).short}
                </div>
              </div>
              <span className={`text-xs font-bold ${DIFFICULTY_COLOR[c.difficulty]}`}>
                {DIFFICULTY[c.difficulty].label}
              </span>
            </div>
            <p className="text-xs text-neutral-300">{c.description}</p>
            <div className="flex flex-wrap gap-x-4 gap-y-1 font-mono text-xs">
              <span className="text-yellow-400">Adiantamento {c.advance}</span>
              <span className="text-yellow-300">Bônus {c.reward}</span>
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
            <button
              type="button"
              disabled={pendingMutiny || !!mutiny || !!active}
              title={active ? "Termine ou abandone o contrato em andamento" : undefined}
              onClick={() => acceptContract(c.id)}
              className="self-end rounded border border-blue-400 bg-blue-600 px-3 py-1 font-semibold text-white hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Aceitar
            </button>
          </div>
        );
      })}
    </section>
  );
}
