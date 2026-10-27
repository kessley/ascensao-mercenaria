import { useGameStore, type LogTone } from "../../../store/useGameStore";

const TONE: Record<LogTone, string> = {
  info: "text-neutral-300",
  good: "text-green-400",
  bad: "text-red-400",
};

/** Diário do acampamento, do mais recente para o mais antigo. */
export function CampLog() {
  const log = useGameStore((s) => s.log);

  return (
    <section className="flex min-h-0 flex-col gap-2">
      <h2 className="text-sm font-bold uppercase tracking-wider text-neutral-400">Diário</h2>
      <ol className="flex max-h-56 flex-col gap-1 overflow-y-auto rounded bg-neutral-800 p-3 text-xs">
        {[...log].reverse().map((e) => (
          <li key={e.id} className={TONE[e.tone]}>
            <span className="font-mono text-neutral-500">Dia {e.day} · </span>
            {e.text}
          </li>
        ))}
      </ol>
    </section>
  );
}
