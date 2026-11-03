import Phaser from "phaser";
import { BootScene } from "./scenes/BootScene";
import { WorldScene } from "./scenes/WorldScene";
import { InteriorScene } from "./scenes/InteriorScene";
import { CapitalScene } from "./scenes/CapitalScene";
import { DuelScene } from "./scenes/DuelScene";
import { COLORS } from "../utils/constants";
import { screenFit } from "./screen";

export function createGameConfig(parent: HTMLElement): Phaser.Types.Core.GameConfig {
  // Escala inteira (ver screen.ts): o tamanho acompanha o contêiner, sem esticar
  const fit = screenFit(parent.clientWidth, parent.clientHeight, window.devicePixelRatio || 1);
  return {
    type: Phaser.AUTO,
    parent,
    width: fit.width,
    height: fit.height,
    backgroundColor: COLORS.BACKGROUND,
    scale: {
      mode: Phaser.Scale.NONE,
      zoom: fit.zoom,
      autoCenter: Phaser.Scale.CENTER_BOTH,
    },
    // O interior de um prédio (Marco 14) é uma cena à parte: o mundo dorme enquanto isso
    // A Cidade Alta das capitais e os duelos da Liça (Marco 15) também
    scene: [BootScene, WorldScene, InteriorScene, CapitalScene, DuelScene],
  };
}
