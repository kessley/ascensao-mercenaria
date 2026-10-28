import Phaser from "phaser";
import { CAMERA, GAME_HEIGHT, GAME_WIDTH, TIME } from "../../utils/constants";

export interface Light {
  x: number;
  y: number;
  radius: number;
}

const BRUSH_KEY = "luz-pincel";
const BRUSH_SIZE = 256;
/** A escuridão é desenhada em meia resolução e ampliada (as bordas das luzes já são suaves). */
const RES = 0.5;

/**
 * Noite (Marco 10): uma camada escura sobre o mundo, com "buracos" de luz onde há tochas,
 * fogueiras, janelas acesas e o brilho dos covis. Fica abaixo da névoa de guerra e dos nomes
 * dos lugares. A intensidade segue a hora (aurora e crepúsculo são rampas).
 */
export class NightLayer {
  private readonly rt: Phaser.GameObjects.RenderTexture;

  constructor(scene: Phaser.Scene) {
    if (!scene.textures.exists(BRUSH_KEY)) {
      const tex = scene.textures.createCanvas(BRUSH_KEY, BRUSH_SIZE, BRUSH_SIZE);
      const ctx = tex?.getContext();
      if (tex && ctx) {
        const c = BRUSH_SIZE / 2;
        const grad = ctx.createRadialGradient(c, c, 0, c, c, c);
        grad.addColorStop(0, "rgba(255,255,255,1)");
        grad.addColorStop(0.45, "rgba(255,255,255,0.85)");
        grad.addColorStop(1, "rgba(255,255,255,0)");
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, BRUSH_SIZE, BRUSH_SIZE);
        tex.refresh();
      }
    }
    // Cobre a maior área que a câmera mostra (zoom mínimo)
    const w = Math.ceil((GAME_WIDTH / CAMERA.MIN_ZOOM) * RES);
    const h = Math.ceil((GAME_HEIGHT / CAMERA.MIN_ZOOM) * RES);
    this.rt = scene.add.renderTexture(0, 0, w, h).setOrigin(0, 0).setScale(1 / RES).setDepth(14).setVisible(false);
  }

  /** Redesenha a escuridão sobre a área da câmera. `darkness` 0 = dia (camada some). */
  update(camera: Phaser.Cameras.Scene2D.Camera, darkness: number, lights: readonly Light[]): void {
    const rt = this.rt;
    if (darkness <= 0.01) {
      rt.setVisible(false);
      return;
    }
    const view = camera.worldView;
    rt.setVisible(true).setPosition(view.x, view.y);
    rt.clear();
    rt.fill(TIME.DARKNESS_COLOR, TIME.DARKNESS_ALPHA * darkness, 0, 0, view.width * RES + 2, view.height * RES + 2);
    for (const l of lights) {
      if (l.x + l.radius < view.x || l.x - l.radius > view.right || l.y + l.radius < view.y || l.y - l.radius > view.bottom) continue;
      rt.stamp(BRUSH_KEY, undefined, (l.x - view.x) * RES, (l.y - view.y) * RES, {
        scale: (l.radius * 2 * RES) / BRUSH_SIZE,
        originX: 0.5,
        originY: 0.5,
        blendMode: Phaser.BlendModes.ERASE,
      });
    }
    rt.render();
  }

  destroy(): void {
    this.rt.destroy();
  }
}
