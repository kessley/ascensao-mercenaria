import Phaser from "phaser";
import type { Weather } from "../../utils/constants";

interface Drop {
  /** Posição na tela (0–1). */
  x: number;
  y: number;
  speed: number;
  size: number;
  phase: number;
}

const DROPS = 140;

/**
 * Clima na tela (Marco 13): chuva em riscos inclinados, neve caindo devagar e nevoeiro (um
 * véu claro com bancos de névoa que passam). Desenhado sobre a área da câmera, abaixo da
 * névoa de guerra e dos nomes; some com o céu limpo.
 */
export class WeatherLayer {
  private readonly gfx: Phaser.GameObjects.Graphics;
  private readonly drops: Drop[] = [];
  private t = 0;

  constructor(scene: Phaser.Scene) {
    this.gfx = scene.add.graphics().setDepth(14.5);
    for (let i = 0; i < DROPS; i++) {
      this.drops.push({ x: Math.random(), y: Math.random(), speed: 0.6 + Math.random() * 0.6, size: 0.6 + Math.random() * 0.8, phase: Math.random() * 6 });
    }
  }

  update(camera: Phaser.Cameras.Scene2D.Camera, weather: Weather, dt: number): void {
    const g = this.gfx;
    g.clear();
    if (weather === "CLEAR") return;
    this.t += dt;
    const v = camera.worldView;
    const unit = v.width / 1280;
    if (weather === "FOG") {
      g.fillStyle(0xdde4e8, 0.3);
      g.fillRect(v.x, v.y, v.width, v.height);
      for (let i = 0; i < 7; i++) {
        const x = v.x + (((i * 0.17 + this.t * 0.012 * (1 + (i % 3))) % 1.3) - 0.15) * v.width;
        const y = v.y + ((i * 0.37) % 1) * v.height;
        g.fillStyle(0xe8eef0, 0.16);
        g.fillEllipse(x, y, 520 * unit, 220 * unit);
      }
      return;
    }
    const storm = weather === "STORM";
    const rain = weather === "RAIN" || storm;
    if (rain) {
      g.fillStyle(0x1a2a3a, storm ? 0.26 : 0.12);
      g.fillRect(v.x, v.y, v.width, v.height);
      // Relâmpago: um clarão de vez em quando
      if (storm && Math.sin(this.t * 0.9) > 0.985) {
        g.fillStyle(0xf0f4ff, 0.22);
        g.fillRect(v.x, v.y, v.width, v.height);
      }
      g.lineStyle((storm ? 2 : 1.5) * unit, 0xbcd0e0, storm ? 0.7 : 0.55);
    } else {
      g.fillStyle(0xffffff, 0.06);
      g.fillRect(v.x, v.y, v.width, v.height);
      g.fillStyle(0xffffff, 0.85);
    }
    for (const d of this.drops) {
      d.y += (storm ? 2.2 : rain ? 1.6 : 0.12) * d.speed * dt;
      d.x += (storm ? 0.7 : rain ? 0.25 : 0.02 * Math.sin(this.t + d.phase)) * dt;
      if (d.y > 1) {
        d.y -= 1;
        d.x = Math.random();
      }
      d.x = ((d.x % 1) + 1) % 1;
      const x = v.x + d.x * v.width;
      const y = v.y + d.y * v.height;
      if (rain) g.lineBetween(x, y, x - (storm ? 16 : 6) * unit, y - 22 * unit * d.size);
      else g.fillCircle(x, y, 2.6 * unit * d.size);
    }
  }

  destroy(): void {
    this.gfx.destroy();
  }
}
