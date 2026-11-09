import { useGameStore } from "../../store/useGameStore";
import { DialogBox } from "../components/DialogBox";
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
      <div className="absolute left-1/2 top-3 -translate-x-1/2 hud-box px-5 py-1.5 font-serif text-base font-bold tracking-wide text-amber-200">
        {interior.title}
      </div>
      <div className="absolute bottom-3 right-3">
        <ResourceBar />
      </div>
      <div className="absolute bottom-3 left-3 hud-box px-3 py-1 font-mono text-[11px] text-neutral-300">
        WASD andar · E falar/interagir · pise no tapete da porta para sair · Esc fecha
      </div>
      {dialog && !panel && <DialogBox dialog={dialog} />}
    </div>
  );
}
