import { chooseDialog } from "../../game/interiorBridge";
import { useGameStore, type Dialog } from "../../store/useGameStore";
import { NoblePortrait } from "./Portrait";

/**
 * A caixa de diálogo dos interiores e da Cidade Alta: quem fala (com o retrato, quando é um nobre),
 * o texto e as respostas, por clique ou pelas teclas 1 a 9.
 */
export function DialogBox({ dialog }: { dialog: Dialog }) {
  const noble = useGameStore((s) => (dialog.nobleId ? s.nobles.find((n) => n.id === dialog.nobleId) : undefined));
  return (
    <div className="pointer-events-auto absolute bottom-16 left-1/2 w-[40rem] max-w-[92vw] -translate-x-1/2 frame-wood p-3 shadow-2xl" data-dialog>
      <div className="flex gap-3">
        {noble && <NoblePortrait noble={noble} />}
        <div className="min-w-0 flex-1">
          <div className="mb-1 text-sm font-bold text-amber-300">{dialog.speaker}</div>
          <p className="text-sm leading-relaxed text-neutral-100">{dialog.text}</p>
        </div>
      </div>
      <div className="mt-3 flex max-h-72 flex-col gap-1 overflow-y-auto">
        {dialog.options.map((o, i) => (
          <button key={o.id} type="button" onClick={() => chooseDialog(o.id)} className="rounded border border-neutral-600 bg-neutral-800 px-3 py-1.5 text-left text-sm hover:border-amber-300 hover:bg-neutral-700">
            <span className="mr-2 font-mono text-amber-300">{i + 1}.</span>
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}
