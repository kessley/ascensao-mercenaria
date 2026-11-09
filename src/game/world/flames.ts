import Phaser from "phaser";
import { flameKey } from "../art/atlas";
import { FLAMES, type FlameKind } from "../art/fire";

/** As chamas fixas que estão no mundo agora (o que apaga o fogo num lugar procura nelas). */
const live = new Set<Phaser.GameObjects.Sprite>();

export function placedFlames(): ReadonlySet<Phaser.GameObjects.Sprite> {
  return live;
}

/**
 * Uma chama animada no mundo (G6): a da fogueira, a da tocha no poste ou a brasa da forja, com o
 * pé em (x, y). A animação é do jogo inteiro (feita uma vez), e cada chama começa num quadro, para
 * as tochas de uma rua não piscarem juntas.
 */
export function flameSprite(scene: Phaser.Scene, kind: FlameKind, x: number, y: number, depth: number): Phaser.GameObjects.Sprite {
  const key = flameKey(scene, kind);
  const cell = FLAMES[kind];
  const anim = `${key}:anim`;
  if (!scene.anims.exists(anim)) {
    scene.anims.create({ key: anim, frames: scene.anims.generateFrameNumbers(key, { start: 0, end: cell.frames - 1 }), frameRate: cell.fps, repeat: -1 });
  }
  const s = scene.add
    .sprite(Math.round(x), Math.round(y), key, 0)
    .setOrigin(cell.footX / cell.w, cell.footY / cell.h)
    .setDepth(depth);
  const h = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
  s.play({ key: anim, startFrame: Math.floor((h - Math.floor(h)) * cell.frames) });
  live.add(s);
  s.once(Phaser.GameObjects.Events.DESTROY, () => live.delete(s));
  return s;
}
