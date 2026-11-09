import { horseDeal, recruitProblem, useGameStore, type BattalionData } from "../../../store/useGameStore";
import { troopFacts } from "../../../game/data/troopFacts";
import { BALANCE, FORMATIONS, PROGRESSION, TRADE, TROOPS, type TroopType } from "../../../utils/constants";
import { battalionWage, reinforceCostPerSoldier } from "../../../utils/economy";
import { xpToNextLevel } from "../../../utils/progression";
import { PixelIcon } from "../PixelIcon";
import { TroopIcon } from "../battle/BattleIcons";
import { cultureOf, peopleOf } from "../../../game/sim/culture";

/** Um batalhão: efetivo, tropa, formação, salário e reforço de soldados perdidos. */
export function BattalionCard({ battalion: b }: { battalion: BattalionData }) {
  const gold = useGameStore((s) => s.gold);
  // O tenente da mesma gente da tropa segura mais a moral (Marco 23)
  const lieutenant = useGameStore((s) => s.lieutenants.find((l) => l.battalionId === b.id));
  const kin = !!lieutenant && cultureOf(lieutenant) === cultureOf(b);
  const reinforceBattalion = useGameStore((s) => s.reinforceBattalion);
  const missing = b.maxSoldiers - b.soldiers;
  const per = reinforceCostPerSoldier(b);

  const maxed = b.level >= PROGRESSION.MAX_LEVEL;
  const next = xpToNextLevel(b.level);

  return (
    <div className="flex flex-col gap-1 rounded bg-neutral-800 px-3 py-2 text-sm">
      <div className="flex items-center justify-between gap-3">
        <span className="flex items-center gap-2 font-semibold">
          <TroopIcon troop={b.troopType} scale={2} />
          <span className="rounded bg-amber-700/80 px-1.5 font-mono text-xs text-amber-100">Nv {b.level}</span>
          {b.name}
          {b.skillPoints > 0 && (
            <span className="rounded bg-lime-600 px-1.5 text-xs text-white" title="Pontos de habilidade para gastar no alojamento">
              +{b.skillPoints}
            </span>
          )}
        </span>
        <span className="font-mono text-neutral-300">
          {b.soldiers}/{b.maxSoldiers} soldados
        </span>
      </div>
      <div className="flex items-center gap-2 text-xs text-neutral-400">
        <div className="h-1.5 flex-1 overflow-hidden rounded bg-neutral-700">
          <div className="h-full bg-amber-400" style={{ width: maxed ? "100%" : `${(b.xp / next) * 100}%` }} />
        </div>
        <span className="font-mono">{maxed ? "nível máximo" : `${b.xp}/${next} XP`}</span>
        <span title="Nível das armas e armaduras forjadas">
          arma {b.equipment.weapon} · armad. {b.equipment.armor}
        </span>
        <span title="Abates na carreira">{b.totalKills} abates</span>
      </div>
      <div className="flex items-center justify-between gap-3 text-xs text-neutral-400">
        <span>
          {TROOPS[b.troopType].label} · {FORMATIONS[b.formation].label} · salário {battalionWage(b)}/sem. ·{" "}
          <span data-origin={cultureOf(b)} title={kin ? "O tenente é da mesma gente: a tropa perde menos moral" : undefined} className={kin ? "text-emerald-300" : undefined}>
            {peopleOf(cultureOf(b))}
            {kin ? " (tenente da terra)" : ""}
          </span>
        </span>
        {missing > 0 && (
          <button
            type="button"
            disabled={gold < per}
            onClick={() => reinforceBattalion(b.id)}
            className="rounded border border-neutral-600 px-2 py-0.5 text-neutral-200 hover:border-blue-500 disabled:cursor-not-allowed disabled:opacity-40"
            title={`${per} de ouro por soldado; repõe quantos o ouro permitir`}
          >
            Reforçar {missing} ({missing * per} ouro)
          </button>
        )}
      </div>
    </div>
  );
}

/** Todos os batalhões do exército. */
export function BattalionList() {
  const battalions = useGameStore((s) => s.battalions);
  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-sm font-bold uppercase tracking-wider text-neutral-400">Exército</h2>
      {battalions.length === 0 && (
        <p className="rounded border border-dashed border-neutral-700 p-3 text-sm text-neutral-400">
          Nenhum batalhão. O Comandante lutará sozinho.
        </p>
      )}
      {battalions.map((b) => (
        <BattalionCard key={b.id} battalion={b} />
      ))}
    </section>
  );
}

/** Recrutamento de tropas cruas (custo e salário semanal de cada tipo). */
export function RecruitPanel() {
  const gold = useGameStore((s) => s.gold);
  const recruitBattalion = useGameStore((s) => s.recruitBattalion);
  // Cavalaria (Marco 14): um cavalo por cavaleiro; os que faltam no estábulo, o negociante traz
  const depot = useGameStore((s) => s.depot);
  const settlements = useGameStore((s) => s.settlements);
  const factions = useGameStore((s) => s.factions);
  const world = useGameStore((s) => s.world);
  const horses = horseDeal({ depot, settlements, factions, world }, BALANCE.BATTALION_SIZE * TRADE.HORSES_PER_RIDER);
  const stable = depot.HORSES ?? 0;
  // Cada tropa pede a sua construção (Marco 22)
  const campPlan = useGameStore((s) => s.campPlan);

  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-sm font-bold uppercase tracking-wider text-neutral-400">Recrutar tropas cruas</h2>
      <div className="grid grid-cols-1 gap-2">
        {(Object.keys(TROOPS) as TroopType[]).map((type) => {
          const cavalry = TROOPS[type].family === "CAVALRY";
          const cost = TROOPS[type].cost + (cavalry ? horses.cost : 0);
          const locked = recruitProblem({ campPlan }, type);
          return (
            <button
              key={type}
              type="button"
              disabled={gold < cost || (cavalry && !horses.ok) || !!locked}
              onClick={() => recruitBattalion(type)}
              className="flex flex-col gap-1 rounded border border-neutral-700 bg-neutral-800 p-3 text-left hover:border-blue-500 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-neutral-700"
            >
              <span className="flex items-center gap-1.5 font-semibold">
                <TroopIcon troop={type} scale={2} />
                {TROOPS[type].label}
                {locked && (
                  <span className="ml-1 text-xs font-normal text-red-300">
                    <PixelIcon id="LOCK" /> {locked}
                  </span>
                )}
              </span>
              <span className="font-mono text-xs text-yellow-400">
                {cost} ouro · +{Math.ceil(TROOPS[type].wagePerSoldier * 8)}/sem.
              </span>
              {cavalry && (
                <span className="text-xs text-amber-200">
                  {horses.ok
                    ? `${BALANCE.BATTALION_SIZE} cavalos: ${horses.fromStable} do estábulo${horses.cost > 0 ? `, o resto do negociante (${horses.cost} de ouro já somados)` : ""}.`
                    : `Faltam cavalos: há ${stable} no estábulo e o mercado mais perto não tem os outros. Compre cavalos nas estepes.`}
                </span>
              )}
              <span className="text-xs text-neutral-400">{TROOPS[type].hint}</span>
              <span className="text-xs text-neutral-500">{troopFacts(type).join(" · ")}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
