import { supportWages } from "../../../game/data/riders";
import { useGameStore } from "../../../store/useGameStore";
import { dailyRations, daysUntilPayday, startingMorale, weeklyWages } from "../../../utils/economy";

function Stat({ label, value, hint, tone = "" }: { label: string; value: string; hint?: string; tone?: string }) {
  return (
    <div className="flex flex-col rounded bg-black/60 px-3 py-1.5 backdrop-blur-sm">
      <span className="text-[10px] uppercase tracking-wider text-neutral-400">{label}</span>
      <span className={`font-mono text-base font-bold leading-tight ${tone}`}>{value}</span>
      {hint && <span className="text-xs text-neutral-400">{hint}</span>}
    </div>
  );
}

/** Painel de situação do acampamento: dia, recursos, salários e moral com que as tropas sairão. */
export function CampStatus() {
  const day = useGameStore((s) => s.day);
  const gold = useGameStore((s) => s.gold);
  const rations = useGameStore((s) => s.rations);
  const iron = useGameStore((s) => s.iron);
  const debt = useGameStore((s) => s.debt);
  const hungryDays = useGameStore((s) => s.hungryDays);
  const arrearsWeeks = useGameStore((s) => s.arrearsWeeks);
  const battalions = useGameStore((s) => s.battalions);
  const lieutenants = useGameStore((s) => s.lieutenants);
  const riders = useGameStore((s) => supportWages(s.scouts.length, s.messengers.length));

  const perDay = dailyRations(battalions);
  const foodDays = Math.floor(rations / perDay);
  const wages = weeklyWages(battalions, lieutenants) + riders;
  const payIn = daysUntilPayday(day);
  const morale = startingMorale(hungryDays, arrearsWeeks);
  const moraleHint = [morale.hunger && `fome −${morale.hunger}`, morale.arrears && `atrasos −${morale.arrears}`]
    .filter(Boolean)
    .join(", ");

  return (
    <div className="grid grid-cols-3 gap-2">
      <Stat label="Dia" value={String(day)} />
      <Stat label="Ouro" value={String(gold)} tone="text-yellow-400" />
      <Stat label="Ferro" value={String(iron)} tone="text-sky-300" />
      <Stat
        label="Rações"
        value={String(rations)}
        hint={`${perDay}/dia · dura ${foodDays} dia(s)`}
        tone={foodDays < 3 ? "text-red-400" : "text-orange-300"}
      />
      <Stat
        label="Salários"
        value={`${wages}/sem.`}
        hint={`pagamento em ${payIn} dia(s)`}
        tone={gold < wages + debt ? "text-red-400" : ""}
      />
      <Stat
        label="Dívida"
        value={String(debt)}
        hint={arrearsWeeks > 0 ? `${arrearsWeeks} semana(s) de atraso` : "em dia"}
        tone={debt > 0 ? "text-red-400" : "text-green-400"}
      />
      <Stat
        label="Moral inicial"
        value={`${morale.value}`}
        hint={moraleHint || "tropas satisfeitas"}
        tone={morale.value < 100 ? "text-red-400" : "text-green-400"}
      />
    </div>
  );
}
