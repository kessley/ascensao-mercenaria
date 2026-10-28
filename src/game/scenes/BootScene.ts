import Phaser from "phaser";

/** Cena inicial. No greybox não há assets: abre direto o mundo contínuo. */
export class BootScene extends Phaser.Scene {
  constructor() {
    super("BootScene");
  }

  create(): void {
    this.scene.start("WorldScene");
  }
}
