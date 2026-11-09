import Phaser from "phaser";
import { flagKey, sheetOf } from "../art/atlas";
import { flagCell, flagFrame, type FlagSpec } from "../art/flags";
import { WEATHER } from "../../utils/constants";
import type { Wind } from "../../utils/season";

/**
 * Uma bandeira no mastro que o vento mexe (G6, parte 2): caída com calmaria e tremulando para o
 * lado do vento, mais depressa quanto mais forte ele sopra. O vento é um só para todas (a cena
 * troca `FlagSprite.wind` quando o tempo muda), e cada bandeira tremula no seu tempo.
 */
export class FlagSprite extends Phaser.GameObjects.Sprite {
  static wind: Wind = { dir: 1, strength: 0.3 };

  private readonly phase: number;
  private readonly frames: readonly Phaser.Textures.Frame[];
  private shown = -1;

  constructor(scene: Phaser.Scene, spec: FlagSpec, x: number, y: number, depth: number) {
    const key = flagKey(scene, spec);
    super(scene, Math.round(x), Math.round(y), key, 0);
    const cell = flagCell(spec);
    this.setOrigin(cell.footX / cell.w, cell.footY / cell.h).setDepth(depth);
    const h = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
    this.phase = (h - Math.floor(h)) * 4;
    this.frames = sheetOf(this.texture);
    scene.add.existing(this);
  }

  preUpdate(time: number, delta: number): void {
    super.preUpdate(time, delta);
    if (!this.visible) return;
    const w = FlagSprite.wind;
    const f = flagFrame(w.strength, WEATHER.CALM, time, this.phase);
    if (f !== this.shown) {
      const fr = this.frames[f];
      if (fr) this.frame = fr;
      this.shown = f;
    }
    const west = w.dir < 0;
    if (this.flipX !== west) this.setFlipX(west);
  }

  /** O quadro de agora (0 = caída), para os testes. */
  get waving(): number {
    return this.shown;
  }
}

/** Uma bandeira ao vento com o pé do mastro em (x, y). */
export function flagSprite(scene: Phaser.Scene, spec: FlagSpec, x: number, y: number, depth: number): FlagSprite {
  return new FlagSprite(scene, spec, x, y, depth);
}
