import Phaser from "phaser";
import { bitmapKey, sheetKey } from "../art/atlas";
import { dropFrame, fogBank, FOG_BANK, skySheet, SKY, SKY_CELL, slantOf } from "../art/weatherArt";
import type { Weather } from "../../utils/constants";
import type { Wind } from "../../utils/season";

interface Drop {
  /** Posição na tela (0–1). */
  x: number;
  y: number;
  /** Onde a gota bate no chão (0–1 da altura da tela). */
  land: number;
  speed: number;
  phase: number;
  /** Floco: 0 miúdo, 1 médio, 2 a estrelinha. */
  flake: number;
  bob: Phaser.GameObjects.Bob;
}

interface Splash {
  x: number;
  y: number;
  /** Segundos desde que a gota bateu. */
  age: number;
  bob: Phaser.GameObjects.Bob;
}

interface Bank {
  /** Posição relativa à tela (0–1), que o vento leva. */
  x: number;
  y: number;
  speed: number;
  img: Phaser.GameObjects.Image;
}

const DROPS = 180;
const BANKS = 7;
const SPLASH_S = 0.18;
const SKY_KEY = "weather:sky";

/**
 * O tempo na tela (Marco 13; em pixel art no G6, parte 2): gotas de chuva inclinadas pelo vento,
 * que respingam onde batem; flocos de neve que o vento leva; e bancos de nevoeiro pontilhados que
 * passam. O pixel do tempo tem o tamanho do pixel da arte (inteiro na tela em qualquer zoom). Por
 * cima de tudo vai um véu: o céu escuro da chuva, o clarão do relâmpago e o branco do nevoeiro.
 */
export class WeatherLayer {
  private readonly veil: Phaser.GameObjects.Graphics;
  private readonly sky: Phaser.GameObjects.Blitter;
  private readonly drops: Drop[] = [];
  private readonly splashes: Splash[] = [];
  private readonly banks: Bank[] = [];
  private t = 0;
  /** Gotas e flocos à vista e respingos no último quadro (os testes conferem). */
  stats = { drops: 0, splashes: 0, banks: 0, slant: 0 };

  constructor(scene: Phaser.Scene) {
    this.veil = scene.add.graphics().setDepth(14.5);
    const key = sheetKey(scene, SKY_KEY, skySheet, SKY_CELL, SKY_CELL);
    this.sky = scene.add.blitter(0, 0, key).setDepth(14.55);
    for (let i = 0; i < DROPS; i++) {
      const bob = this.sky.create(0, 0, SKY.RAIN + 3, false);
      this.drops.push({ x: Math.random(), y: Math.random(), land: 0.15 + Math.random() * 0.95, speed: 0.6 + Math.random() * 0.6, phase: Math.random() * 6, flake: Math.floor(Math.random() * 3), bob });
    }
    for (let k = 0; k < FOG_BANK.kinds; k++) bitmapKey(scene, `weather:fog:${k}`, () => fogBank(k));
    for (let i = 0; i < BANKS; i++) {
      const img = scene.add.image(0, 0, `weather:fog:${i % FOG_BANK.kinds}`).setDepth(14.52).setVisible(false);
      this.banks.push({ x: Math.random() * 1.3 - 0.15, y: (i * 0.37 + 0.1) % 1, speed: 0.6 + (i % 3) * 0.3, img });
    }
  }

  update(camera: Phaser.Cameras.Scene2D.Camera, weather: Weather, dt: number, wind: Wind = { dir: 1, strength: 0.3 }): void {
    const g = this.veil;
    g.clear();
    const v = camera.worldView;
    // O pixel do tempo: do tamanho do pixel da arte, mas nunca menor que um pixel da tela
    const px = Math.max(1, Math.round(camera.zoom)) / camera.zoom;
    this.sky.setScale(px);
    this.t += dt;
    const fog = weather === "FOG";
    const storm = weather === "STORM";
    const rain = weather === "RAIN" || storm;
    const snow = weather === "SNOW";
    this.updateBanks(v, fog, dt, wind, px);
    let drops = 0;
    if (fog) {
      g.fillStyle(0xdde4e8, 0.26);
      g.fillRect(v.x, v.y, v.width, v.height);
    } else if (rain) {
      g.fillStyle(0x1a2a3a, storm ? 0.26 : 0.12);
      g.fillRect(v.x, v.y, v.width, v.height);
      // Relâmpago: um clarão de vez em quando
      if (storm && Math.sin(this.t * 0.9) > 0.985) {
        g.fillStyle(0xf0f4ff, 0.22);
        g.fillRect(v.x, v.y, v.width, v.height);
      }
    } else if (snow) {
      g.fillStyle(0xffffff, 0.06);
      g.fillRect(v.x, v.y, v.width, v.height);
    }
    const slant = slantOf(wind.dir, storm ? Math.max(0.8, wind.strength) : wind.strength);
    const frame = dropFrame(slant, storm);
    // A gota anda na tela: quanto o vento a empurra de lado a cada altura que ela cai
    const drift = (slant / 7) * (SKY_CELL / 12);
    for (const d of this.drops) {
      if (!rain && !snow) {
        d.bob.setVisible(false);
        continue;
      }
      if (rain) {
        const fall = (storm ? 2.2 : 1.6) * d.speed * dt;
        d.y += fall;
        d.x += fall * drift * (v.height / v.width) * 1.2;
      } else {
        d.y += 0.12 * d.speed * dt;
        d.x += (wind.dir * wind.strength * 0.05 + 0.02 * Math.sin(this.t + d.phase)) * dt;
      }
      if (d.y >= d.land) {
        // A gota bate no chão: fica o respingo ali, e ela volta lá em cima
        if (rain) this.splash(v.x + d.x * v.width, v.y + d.land * v.height);
        d.y = -0.05 - Math.random() * 0.1;
        d.x = Math.random();
        d.land = 0.15 + Math.random() * 0.95;
      }
      d.x = ((d.x % 1) + 1) % 1;
      const x = v.x + d.x * v.width;
      const y = v.y + d.y * v.height;
      d.bob.setVisible(true);
      d.bob.x = Math.round(x / px - SKY_CELL / 2);
      d.bob.y = Math.round(y / px - SKY_CELL);
      d.bob.setFrame(rain ? frame : SKY.FLAKE + d.flake);
      drops++;
    }
    let splashes = 0;
    for (const s of this.splashes) {
      if (!s.bob.visible) continue;
      s.age += dt;
      const f = Math.floor((s.age / SPLASH_S) * SKY.SPLASH_FRAMES);
      if (f >= SKY.SPLASH_FRAMES || !rain) {
        s.bob.setVisible(false);
        continue;
      }
      s.bob.setFrame(SKY.SPLASH + f);
      s.bob.x = Math.round(s.x / px - SKY_CELL / 2);
      s.bob.y = Math.round(s.y / px - SKY_CELL + 1);
      splashes++;
    }
    this.stats = { drops, splashes, banks: this.banks.filter((b) => b.img.visible).length, slant: rain ? slant : 0 };
  }

  /** Um respingo onde a gota bateu (reaproveita os que acabaram). */
  private splash(x: number, y: number): void {
    let s = this.splashes.find((x) => !x.bob.visible);
    if (!s) {
      if (this.splashes.length >= DROPS) return;
      s = { x, y, age: 0, bob: this.sky.create(0, 0, SKY.SPLASH, false) };
      this.splashes.push(s);
    }
    s.x = x;
    s.y = y;
    s.age = 0;
    s.bob.setVisible(true);
  }

  /** Os bancos de nevoeiro passam com o vento, em volta da tela. */
  private updateBanks(v: Phaser.Geom.Rectangle, fog: boolean, dt: number, wind: Wind, px: number): void {
    for (const b of this.banks) {
      if (!fog) {
        b.img.setVisible(false);
        continue;
      }
      b.x += wind.dir * (0.008 + 0.03 * wind.strength) * b.speed * dt;
      if (b.x > 1.25) b.x -= 1.5;
      if (b.x < -0.25) b.x += 1.5;
      const scale = 2 * px;
      b.img
        .setVisible(true)
        .setScale(scale)
        .setAlpha(0.45 + 0.1 * (b.speed - 0.6))
        .setPosition(Math.round(v.x + b.x * v.width), Math.round(v.y + b.y * v.height));
    }
  }

  destroy(): void {
    this.veil.destroy();
    this.sky.destroy();
    for (const b of this.banks) b.img.destroy();
  }
}
