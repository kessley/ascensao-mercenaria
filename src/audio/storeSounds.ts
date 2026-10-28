import { useGameStore } from "../store/useGameStore";
import { sfx } from "./sounds";

/**
 * Sons ligados ao estado do jogo (fora do Phaser): moedas quando o ouro muda
 * num painel (compras, salários, forja) e um clique ao abrir um painel. Chamado uma vez na inicialização.
 */
export function installStoreSounds(): () => void {
  return useGameStore.subscribe((s, prev) => {
    if (s.campPanel && prev.campPanel && s.gold !== prev.gold) {
      sfx.coin(s.gold > prev.gold);
    }
    if (s.campPanel && s.campPanel !== prev.campPanel) sfx.click();
  });
}
