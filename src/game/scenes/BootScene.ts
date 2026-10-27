import Phaser from "phaser";
import { useGameStore } from "../../store/useGameStore";

/** Cena inicial. No greybox não há assets: abre o acampamento ou a batalha conforme a tela atual. */
export class BootScene extends Phaser.Scene {
  constructor() {
    super("BootScene");
  }

  create(): void {
    const screen = useGameStore.getState().currentScreen;
    this.scene.start(screen === "BATTLE" ? "BattleScene" : "CampScene");
  }
}
