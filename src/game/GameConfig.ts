import Phaser from "phaser";
import { BootScene } from "./scenes/BootScene";
import { WorldScene } from "./scenes/WorldScene";
import { InteriorScene } from "./scenes/InteriorScene";
import { CapitalScene } from "./scenes/CapitalScene";
import { DuelScene } from "./scenes/DuelScene";
import { COLORS, GAME_HEIGHT, GAME_WIDTH } from "../utils/constants";

export function createGameConfig(parent: HTMLElement): Phaser.Types.Core.GameConfig {
  return {
    type: Phaser.AUTO,
    parent,
    width: GAME_WIDTH,
    height: GAME_HEIGHT,
    backgroundColor: COLORS.BACKGROUND,
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
    },
    // O interior de um prédio (Marco 14) é uma cena à parte: o mundo dorme enquanto isso
    // A Cidade Alta das capitais e os duelos da Liça (Marco 15) também
    scene: [BootScene, WorldScene, InteriorScene, CapitalScene, DuelScene],
  };
}
