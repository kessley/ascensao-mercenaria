import { useGameStore } from "../../../store/useGameStore";

function Meter({ label, value, tone, tip }: { label: string; value: number; tone: string; tip: string }) {
  return (
    <span className={tone} title={tip}>
      {label} {Math.round(value)}
    </span>
  );
}

/** Fama, Honra e Temor (Marco 15): os três nomes que o bando tem no continente. */
export function ReputationBar() {
  const fame = useGameStore((s) => s.fame);
  const honor = useGameStore((s) => s.honor);
  const fear = useGameStore((s) => s.fear);
  return (
    <div className="flex gap-3 whitespace-nowrap rounded bg-black/60 px-3 py-1 font-mono text-xs">
      <Meter label="Fama" value={fame} tone="text-amber-300" tip="Vitórias e feitos: abre portões, paga contratos melhores." />
      <Meter label="Honra" value={honor} tone="text-sky-300" tip="Palavra cumprida: a corte fecha a porta para quem não tem." />
      <Meter label="Temor" value={fear} tone="text-rose-400" tip="Saques e sangue: guardas cedem, mas a gente odeia e os reinos se unem." />
    </div>
  );
}
