import { useGameStore } from "../../store/useGameStore";
import { chooseDialog } from "../../game/interiorBridge";
import { ResourceBar } from "../components/ResourceBar";

/**
 * Dentro de um prédio (Marco 14): o nome do lugar, os recursos do bando e a caixa de diálogo
 * de quem fala com o Comandante (respostas por clique ou pelas teclas 1–4).
 */
export function InteriorView() {
  const interior = useGameStore((s) => s.interior);
  const dialog = useGameStore((s) => s.dialog);
  const panel = useGameStore((s) => s.campPanel);
  if (!interior) return null;
  return (
    <div className="pointer-events-none absolute inset-0 text-white">
      <div className="absolute left-1/2 top-3 -translate-x-1/2 rounded-full border border-amber-300/50 bg-black/75 px-5 py-1.5 text-base font-bold tracking-wide text-amber-200">
        {interior.title}
      </div>
      <div className="absolute bottom-3 right-3">
        <ResourceBar />
      </div>
      <div className="absolute bottom-3 left-3 rounded bg-black/60 px-3 py-1 font-mono text-[11px] text-neutral-300">
        WASD andar · E falar/interagir · pise no tapete da porta para sair · Esc fecha
      </div>
      {dialog && !panel && (
        <div className="pointer-events-auto absolute bottom-16 left-1/2 w-[40rem] max-w-[92vw] -translate-x-1/2 rounded-lg border-2 border-amber-200/60 bg-neutral-950/95 p-4 shadow-2xl">
          <div className="mb-1 text-sm font-bold text-amber-300">{dialog.speaker}</div>
          <p className="text-sm leading-relaxed text-neutral-100">{dialog.text}</p>
          <div className="mt-3 flex max-h-72 flex-col gap-1 overflow-y-auto">
            {dialog.options.map((o, i) => (
              <button
                key={o.id}
                type="button"
                onClick={() => chooseDialog(o.id)}
                className="rounded border border-neutral-600 bg-neutral-800 px-3 py-1.5 text-left text-sm hover:border-amber-300 hover:bg-neutral-700"
              >
                <span className="mr-2 font-mono text-amber-300">{i + 1}.</span>
                {o.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
