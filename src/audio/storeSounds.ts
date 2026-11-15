import { useGameStore } from "../store/useGameStore";
import { cultureOf } from "../game/sim/culture";
import { TROOP_VOICE } from "./speech";
import { clickSound, stateSounds } from "./uiRules";
import { playUi } from "./uiSounds";
import { say } from "./voice";

/** O que responde com som ao ser apertado. */
const CLICKABLE = "button, [role='button'], a[href], summary, select, input[type='checkbox'], input[type='radio'], .cursor-pointer, [data-sound]";

/** O botão (ou o que faz as vezes de botão) que foi apertado diz o seu som. */
function pressed(target: EventTarget | null): void {
  if (!(target instanceof Element)) return;
  const el = target.closest(CLICKABLE);
  if (!el) return;
  const disabled = (el as HTMLButtonElement).disabled === true || el.getAttribute("aria-disabled") === "true";
  const sound = clickSound({ disabled, text: el.textContent ?? "", hint: el.closest("[data-sound]")?.getAttribute("data-sound") });
  if (sound) playUi(sound);
}

/**
 * Os sons da interface (fora do Phaser), instalados uma vez na inicialização:
 * - todo botão responde ao aperto (clique leve, confirmar, cancelar ou "não pode");
 * - o estado do jogo dá o resto: abrir e fechar painel (com a assinatura do lugar), o mapa, as
 *   moedas, o martelo ao construir, o tambor ao recrutar, a pena e o selo do contrato, o soldo
 *   e as fanfarras. As regras estão em `uiRules.ts`.
 */
export function installStoreSounds(): () => void {
  // No aperto, e não na soltura: o som sai junto com o dedo
  const onPointer = (e: PointerEvent): void => {
    if (e.button === 0) pressed(e.target);
  };
  // Botão acionado pelo teclado (Enter, espaço): o clique chega sem aperto antes
  const onClick = (e: MouseEvent): void => {
    if (e.detail === 0) pressed(e.target);
  };
  document.addEventListener("pointerdown", onPointer, true);
  document.addEventListener("click", onClick, true);

  const unsubscribe = useGameStore.subscribe((s, prev) => {
    for (const sound of stateSounds(prev, s)) {
      // No relatório da batalha, a subida de nível espera a fanfarra da vitória acabar
      playUi(sound, sound === "levelUp" && s.battleReport && !prev.battleReport ? 1.6 : 0);
      if (sound === "recruit") {
        // Quem chegou responde: um grito na língua e na voz da tropa nova
        const fresh = s.battalions[s.battalions.length - 1];
        say({ key: "recrutas", tongue: cultureOf(fresh), species: "human", timbre: TROOP_VOICE[fresh.troopType] }, "cheer", undefined, { volume: 0.7 });
      }
    }
  });

  return () => {
    document.removeEventListener("pointerdown", onPointer, true);
    document.removeEventListener("click", onClick, true);
    unsubscribe();
  };
}
