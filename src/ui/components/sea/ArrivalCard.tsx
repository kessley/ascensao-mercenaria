import { CULTURES } from "../../../game/data/planet";
import type { ArrivalTopic } from "../../../game/sim/arrival";
import { useGameStore } from "../../../store/useGameStore";
import { Button } from "../Button";

const TOPIC_LABEL: Record<ArrivalTopic, string> = {
  FOLK: "A gente",
  TONGUE: "A língua",
  FAITH: "A fé",
  ORDERS: "As ordens",
  RULE: "O governo",
};

const TONE_CLASS = { good: "text-emerald-300", bad: "text-yellow-300", info: "text-neutral-200" } as const;

/**
 * Outra terra (Marco 23, parte 4): ao desembarcar, o que muda de uma vez: a gente, a língua e quem
 * fala por ela, a fé dos templos e o calendário, quem não entende as ordens e quem governa.
 */
export function ArrivalCard() {
  const arrival = useGameStore((s) => s.arrival);
  const dismiss = useGameStore((s) => s.dismissArrival);
  const busy = useGameStore((s) => s.voyage !== null || s.battleReport !== null || s.campEvent !== null);
  if (!arrival || busy) return null;
  return (
    <div className="pointer-events-auto absolute inset-0 z-20 flex items-center justify-center bg-black/60" data-arrival={arrival.land}>
      <div className="frame-wood flex max-h-[85vh] w-[34rem] max-w-[calc(100vw-2rem)] flex-col gap-3 overflow-y-auto p-5">
        <header>
          <h2 className="font-serif text-2xl text-amber-100">{arrival.back ? `De volta a ${arrival.name}` : `Outra terra: ${arrival.name}`}</h2>
          <p className="text-xs text-neutral-400">{CULTURES[arrival.land].label}</p>
        </header>
        <ul className="flex flex-col gap-2">
          {arrival.lines.map((l) => (
            <li key={l.topic} className="flex flex-col gap-0.5 text-sm" data-arrival-topic={l.topic}>
              <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">{TOPIC_LABEL[l.topic]}</span>
              <span className={TONE_CLASS[l.tone]}>{l.text}</span>
            </li>
          ))}
        </ul>
        <footer className="flex justify-end">
          <Button onClick={dismiss}>Pisar em terra</Button>
        </footer>
      </div>
    </div>
  );
}
