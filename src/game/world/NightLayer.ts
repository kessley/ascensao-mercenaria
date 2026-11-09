import Phaser from "phaser";
import { CAMERA, GAME_HEIGHT, GAME_WIDTH, TIME } from "../../utils/constants";
import { flicker } from "../art/fire";

export interface Light {
  x: number;
  y: number;
  radius: number;
  /** Halo quente em volta (G6), de 0 a 1: perto do fogo, a escuridão fica alaranjada. */
  glow?: number;
  /** Cor do halo (sem ela, a do fogo). */
  tint?: number;
  /** Quanto o raio tremula (0,06 = 6%): chama treme, janela não. */
  flicker?: number;
}

const BRUSH_KEY = "luz-pincel";
const HALO_KEY = "luz-halo";
const BRUSH_SIZE = 256;

const flickerAt = (l: Light, time: number): number => flicker(l.x, l.y, l.flicker ?? 0, time);
/** A escuridão é desenhada em meia resolução e ampliada (as bordas das luzes já são suaves). */
const RES = 0.5;

/**
 * Noite (Marco 10): uma camada escura sobre o mundo, com "buracos" de luz onde há tochas,
 * fogueiras, janelas acesas e o brilho dos covis. Fica abaixo da névoa de guerra e dos nomes
 * dos lugares. A intensidade segue a hora (aurora e crepúsculo são rampas).
 *
 * Por cima dela (G6), o halo: o brilho quente das chamas, somado à cena. Ele passa um pouco da
 * borda do buraco de luz, e é ali que a escuridão fica alaranjada. As chamas tremulam.
 */
export class NightLayer {
  private readonly rt: Phaser.GameObjects.RenderTexture;
  private readonly halo: Phaser.GameObjects.RenderTexture;

  constructor(scene: Phaser.Scene) {
    if (!scene.textures.exists(HALO_KEY)) {
      const tex = scene.textures.createCanvas(HALO_KEY, BRUSH_SIZE, BRUSH_SIZE);
      const ctx = tex?.getContext();
      if (tex && ctx) {
        const c = BRUSH_SIZE / 2;
        const grad = ctx.createRadialGradient(c, c, 0, c, c, c);
        grad.addColorStop(0, "rgba(255,255,255,0.85)");
        grad.addColorStop(0.35, "rgba(255,255,255,0.38)");
        grad.addColorStop(0.75, "rgba(255,255,255,0.08)");
        grad.addColorStop(1, "rgba(255,255,255,0)");
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, BRUSH_SIZE, BRUSH_SIZE);
        tex.refresh();
      }
    }
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
    // Cobre a maior área que a câmera mostra (zoom mínimo); tela maior que a de referência amplia em update
    const w = Math.ceil((GAME_WIDTH / CAMERA.MIN_ZOOM) * RES);
    const h = Math.ceil((GAME_HEIGHT / CAMERA.MIN_ZOOM) * RES);
    this.rt = scene.add.renderTexture(0, 0, w, h).setOrigin(0, 0).setScale(1 / RES).setDepth(14).setVisible(false);
    this.halo = scene.add
      .renderTexture(0, 0, w, h)
      .setOrigin(0, 0)
      .setScale(1 / RES)
      .setDepth(14.05)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setVisible(false);
  }

  /** Quantos halos foram desenhados no último quadro (os testes conferem). */
  halos = 0;

  /** Redesenha a escuridão sobre a área da câmera. `darkness` 0 = dia (camada some). */
  update(camera: Phaser.Cameras.Scene2D.Camera, darkness: number, lights: readonly Light[], time = 0): void {
    const rt = this.rt;
    const halo = this.halo;
    if (darkness <= 0.01) {
      rt.setVisible(false);
      halo.setVisible(false);
      this.halos = 0;
      return;
    }
    const view = camera.worldView;
    const w = Math.ceil(view.width * RES) + 2;
    const h = Math.ceil(view.height * RES) + 2;
    for (const t of [rt, halo]) {
      if (w > t.width || h > t.height) t.resize(Math.max(w, t.width), Math.max(h, t.height));
      t.setVisible(true).setPosition(view.x, view.y);
      t.clear();
    }
    rt.fill(TIME.DARKNESS_COLOR, TIME.DARKNESS_ALPHA * darkness, 0, 0, view.width * RES + 2, view.height * RES + 2);
    const G = TIME.GLOW;
    let halos = 0;
    for (const l of lights) {
      const spread = l.glow ? G.SPREAD : 1;
      const reach = l.radius * spread * (1 + (l.flicker ?? 0));
      if (l.x + reach < view.x || l.x - reach > view.right || l.y + reach < view.y || l.y - reach > view.bottom) continue;
      const k = flickerAt(l, time);
      const x = (l.x - view.x) * RES;
      const y = (l.y - view.y) * RES;
      rt.stamp(BRUSH_KEY, undefined, x, y, {
        scale: (l.radius * k * 2 * RES) / BRUSH_SIZE,
        originX: 0.5,
        originY: 0.5,
        blendMode: Phaser.BlendModes.ERASE,
      });
      if (!l.glow) continue;
      halo.stamp(HALO_KEY, undefined, x, y, {
        scale: (l.radius * spread * k * 2 * RES) / BRUSH_SIZE,
        originX: 0.5,
        originY: 0.5,
        tint: l.tint ?? G.COLOR,
        alpha: Math.min(1, l.glow * G.ALPHA * darkness * (0.85 + 0.15 * k)),
      });
      halos++;
    }
    this.halos = halos;
    rt.render();
    halo.render();
  }

  destroy(): void {
    this.rt.destroy();
    this.halo.destroy();
  }
}
