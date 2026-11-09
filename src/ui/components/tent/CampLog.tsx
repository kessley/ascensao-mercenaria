import { useGameStore, type LogTone } from "../../../store/useGameStore";
import { IconText } from "../PixelIcon";

/** Tinta no pergaminho (G5, parte 2). */
const TONE: Record<LogTone, string> = {
  info: "text-[#3b2a1a]",
  good: "text-green-900",
  bad: "text-red-800",
};

/** Diário do acampamento, do mais recente para o mais antigo. */
export function CampLog() {
  const log = useGameStore((s) => s.log);

  return (
    <section className="flex shrink-0 flex-col gap-2">
      <h2 className="text-sm font-bold uppercase tracking-wider text-neutral-400">Diário</h2>
      <ol className="frame-parchment flex max-h-56 flex-col gap-1 overflow-y-auto px-1 text-xs">
        {[...log].reverse().map((e) => (
          <li key={e.id} className={TONE[e.tone]}>
            <span className="font-mono text-[#8a6a3e]">Dia {e.day} · </span>
            <IconText text={e.text} />
          </li>
        ))}
      </ol>
    </section>
  );
}
