import { useState } from "react";
import { useGameStore } from "../../store/useGameStore";
import { AUTO_SLOT, MANUAL_SLOTS, listSaves, slotLabel, type SaveMeta } from "../../game/save/saveGame";
import { WorldChronicle } from "./tent/RealmPanels";

const sectionTitle = "text-sm font-bold uppercase tracking-wider text-neutral-400";

function when(iso: string): string {
  return new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

/** Linha de um espaço de save: o que tem nele e os botões de salvar/carregar. */
function SlotRow({ slot, meta, canSave, onDone }: { slot: string; meta?: SaveMeta; canSave: boolean; onDone: (msg: string) => void }) {
  const saveGame = useGameStore((s) => s.saveGame);
  const loadGame = useGameStore((s) => s.loadGame);
  return (
    <div className="flex items-center justify-between gap-2 rounded bg-neutral-800 px-3 py-2 text-xs">
      <div className="min-w-0">
        <div className="font-semibold text-neutral-200">{slotLabel(slot)}</div>
        <div className="truncate text-neutral-400">
          {meta ? `${meta.bandName} · ${meta.worldName} · dia ${meta.day} · ${when(meta.savedAt)}` : "vazio"}
        </div>
      </div>
      <div className="flex shrink-0 gap-1">
        {canSave && slot !== AUTO_SLOT && (
          <button
            type="button"
            onClick={() => onDone(saveGame(slot) ?? `Salvo em ${slotLabel(slot).toLowerCase()}.`)}
            className="rounded border border-emerald-600 px-2 py-1 text-emerald-200 hover:bg-emerald-900/50"
          >
            Salvar
          </button>
        )}
        {meta && (
          <button
            type="button"
            onClick={() => {
              const why = loadGame(slot);
              if (why) onDone(why);
            }}
            className="rounded border border-sky-600 px-2 py-1 text-sky-200 hover:bg-sky-900/50"
          >
            Carregar
          </button>
        )}
      </div>
    </div>
  );
}

/**
 * Salvar e carregar (Marco 10). O save guarda a semente do mundo, a campanha e o campo;
 * não dá para salvar em combate nem com mensageiros fora. O automático grava a cada dia
 * e ao entrar no acampamento.
 */
export function SavePanel({ canSave = true }: { canSave?: boolean }) {
  const [message, setMessage] = useState<string | null>(null);
  // Relido a cada render: salvar mostra uma mensagem, e isso já redesenha a lista
  const saves = listSaves();
  const bySlot = new Map(saves.map((m) => [m.slot, m]));
  return (
    <section className="flex flex-col gap-2">
      <h2 className={sectionTitle}>Salvar e carregar</h2>
      {[AUTO_SLOT, ...MANUAL_SLOTS].map((slot) => (
        <SlotRow key={slot} slot={slot} meta={bySlot.get(slot)} canSave={canSave} onDone={setMessage} />
      ))}
      {message && <p className="text-xs text-amber-200">{message}</p>}
    </section>
  );
}

/** Painel "Jogo" do HUD: salvar, carregar e a crônica do mundo (com "Novo mundo…"). */
export function GamePanel() {
  return (
    <>
      <SavePanel />
      <WorldChronicle />
    </>
  );
}
