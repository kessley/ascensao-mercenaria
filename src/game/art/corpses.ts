import Phaser from "phaser";
import type { Lod } from "./atlas";

/** Quantos mortos ficam no chão de uma vez: o mais antigo some quando chega mais um. */
const MAX = 400;
/** Tempo de jogo até o corpo começar a sumir, e quanto leva sumindo. */
const LINGER_MS = 120_000;
const FADE_MS = 6000;
/** Abaixo de quem está vivo (as figuras ficam entre 0 e 0,04) e acima das marcas no chão. */
const DEPTH = -0.7;

export interface Corpse {
  texture: string;
  frame: number;
  x: number;
  y: number;
  originX: number;
  originY: number;
  flip: boolean;
}

/**
 * Quem morre fica caído no último quadro da queda, um pouco mais escuro, e some aos poucos
 * depois de 2 minutos. Só no zoom de perto: de longe, corpos virariam ruído.
 */
export class Corpses {
  private readonly list: { img: Phaser.GameObjects.Image; at: number }[] = [];
  private now = 0;
  private shown = true;

  constructor(readonly scene: Phaser.Scene, lod: Lod) {
    this.shown = lod === "FULL";
  }

  add(c: Corpse): void {
    if (this.list.length >= MAX) this.list.shift()?.img.destroy();
    const img = this.scene.add
      .image(c.x, c.y, c.texture, c.frame)
      .setOrigin(c.originX, c.originY)
      .setFlipX(c.flip)
      .setTint(0xa09a94)
      .setTintMode(Phaser.TintModes.MULTIPLY)
      .setDepth(DEPTH)
      .setVisible(this.shown);
    this.list.push({ img, at: this.now });
  }

  /** Relógio da cena (o mesmo da animação das figuras). */
  update(now: number): void {
    this.now = now;
    const list = this.list;
    // Em ordem de morte: só os primeiros podem estar sumindo
    while (list.length > 0 && now - list[0].at >= LINGER_MS + FADE_MS) list.shift()?.img.destroy();
    for (const c of list) {
      const age = now - c.at;
      if (age < LINGER_MS) break;
      c.img.setAlpha(1 - (age - LINGER_MS) / FADE_MS);
    }
  }

  setLod(lod: Lod): void {
    this.shown = lod === "FULL";
    for (const c of this.list) c.img.setVisible(this.shown);
  }

  get count(): number {
    return this.list.length;
  }
}
