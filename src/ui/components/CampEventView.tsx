import { useGameStore } from "../../store/useGameStore";

/**
 * Evento do acampamento com escolha (Marco 12): um pequeno drama — ladrão de rações, briga de
 * tenentes, desertor arrependido, festa da vitória, seguidor no portão — e 2 ou 3 respostas.
 * Com o evento aberto o mundo fica em pausa.
 */
export function CampEventView() {
  const event = useGameStore((s) => s.campEvent);
  const resolve = useGameStore((s) => s.resolveCampEvent);
  if (!event) return null;
  return (
    <div className="pointer-events-auto absolute inset-0 z-40 flex items-center justify-center bg-black/55 p-4 text-white">
      <div className="flex w-[34rem] max-w-full flex-col gap-3 rounded border border-amber-700/70 bg-neutral-900/95 p-5 shadow-2xl">
        <span className="text-xs uppercase tracking-wider text-amber-300/80">No acampamento</span>
        <h2 className="text-xl font-bold">{event.title}</h2>
        <p className="text-sm leading-relaxed text-neutral-200">{event.text}</p>
        <div className="flex flex-col gap-2">
          {event.options.map((o, i) => (
            <button
              key={i}
              type="button"
              disabled={o.disabled}
              onClick={() => resolve(i)}
              className="flex flex-col rounded border border-neutral-600 bg-neutral-800 px-3 py-2 text-left hover:border-amber-400 hover:bg-neutral-700 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <span className="text-sm font-semibold">{o.label}</span>
              <span className="text-xs text-neutral-400">{o.hint}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
