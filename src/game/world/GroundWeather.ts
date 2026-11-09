import Phaser from "phaser";
import { bitmapKey, sheetKey } from "../art/atlas";
import { PUDDLE, puddleFrame, puddleSheet, SNOW_LEVELS, SNOW_TILE, snowCover } from "../art/weatherArt";
import { WEATHER, type TerrainType, type Weather } from "../../utils/constants";

/** Onde pode haver poça: o chão aberto, a lama, o brejo e a mata (não a água, a pedra ou o telhado). */
const PUDDLE_GROUND: ReadonlySet<TerrainType> = new Set(["GRASS", "MUD", "SWAMP", "HILL", "FOREST"]);
/** Uma poça a cada tantos px (no máximo uma por quadrado). */
const CELL = 140;

interface Puddle {
  x: number;
  y: number;
  size: number;
  /** Com quanto de chão molhado (0 a 1) ela aparece: as grandes e as da lama vêm primeiro. */
  from: number;
  phase: number;
}

/** O terreno onde as poças caem (a cena passa o mapa). */
export type TerrainProbe = (x: number, y: number) => TerrainType;

function hash(a: number, b: number, c: number): number {
  let h = (a * 374761393 + b * 668265263 + c * 1274126177) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

/**
 * O chão com o tempo (G6, parte 2). A chuva encharca o chão aos poucos: ele escurece e as poças
 * aparecem, primeiro na lama e no brejo, e a chuva faz círculos nelas. Parada a chuva, o chão
 * seca devagar. A neve cobre o chão em manchas que crescem até fechar; parada a neve, derrete
 * devagar (mais depressa na chuva). Tudo fica abaixo de quem anda e das construções.
 */
export class GroundWeather {
  /** Quanto o chão está molhado e coberto de neve, de 0 a 1 (os testes conferem e podem mudar). */
  wetness = 0;
  snow = 0;
  /** Poças à vista no último quadro. */
  shownPuddles = 0;

  private readonly wet: Phaser.GameObjects.Rectangle;
  private readonly puddles: Phaser.GameObjects.Blitter;
  private readonly bobs = new Map<number, Phaser.GameObjects.Bob>();
  private readonly cache = new Map<number, Puddle | null>();
  private readonly cover: [Phaser.GameObjects.TileSprite, Phaser.GameObjects.TileSprite];
  private stamp = -1;
  private t = 0;

  constructor(scene: Phaser.Scene, private readonly terrain: TerrainProbe) {
    // Logo acima do chão (e da água), abaixo dos brilhos do rio e de tudo o que anda
    this.wet = scene.add.rectangle(0, 0, 10, 10, 0x0a1220, 1).setOrigin(0, 0).setDepth(-9.85).setVisible(false);
    this.puddles = scene.add.blitter(0, 0, sheetKey(scene, "weather:puddles", puddleSheet, PUDDLE.w, PUDDLE.h)).setDepth(-9.75);
    for (let i = 0; i < SNOW_LEVELS.length; i++) bitmapKey(scene, `weather:snow:${i}`, () => snowCover(i));
    const tile = (i: number) => scene.add.tileSprite(0, 0, 16, 16, `weather:snow:${i}`).setOrigin(0, 0).setDepth(-9.7).setVisible(false);
    this.cover = [tile(0), tile(1)];
  }

  /** O terreno mudou (estação, cerco, povoado novo): as poças são sorteadas de novo. */
  invalidate(): void {
    this.cache.clear();
  }

  update(camera: Phaser.Cameras.Scene2D.Camera, weather: Weather, dt: number, groundStamp: number): void {
    if (groundStamp !== this.stamp) {
      this.stamp = groundStamp;
      this.cache.clear();
    }
    this.t += dt;
    const G = WEATHER.GROUND;
    const rain = weather === "RAIN" || weather === "STORM";
    if (rain) this.wetness = Math.min(1, this.wetness + dt / (weather === "STORM" ? G.STORM_WET_IN : G.WET_IN));
    else if (weather !== "SNOW") this.wetness = Math.max(0, this.wetness - dt / G.DRY_OUT);
    if (weather === "SNOW") this.snow = Math.min(1, this.snow + dt / G.SNOW_IN);
    else this.snow = Math.max(0, this.snow - dt / (rain ? G.RAIN_MELT : G.MELT));
    const v = camera.worldView;
    this.drawWet(v);
    this.drawPuddles(v, rain);
    this.drawSnow(v);
  }

  private drawWet(v: Phaser.Geom.Rectangle): void {
    const a = 0.2 * this.wetness;
    this.wet.setVisible(a > 0.005);
    if (a <= 0.005) return;
    this.wet.setPosition(v.x - 2, v.y - 2).setSize(v.width + 4, v.height + 4).setAlpha(a);
  }

  private puddleAt(col: number, row: number): Puddle | null {
    const key = row * 100000 + col;
    const known = this.cache.get(key);
    if (known !== undefined) return known;
    let out: Puddle | null = null;
    const r = hash(col, row, 7);
    const x = (col + 0.15 + 0.7 * hash(col, row, 11)) * CELL;
    const y = (row + 0.15 + 0.7 * hash(col, row, 13)) * CELL;
    const ground = this.terrain(x, y);
    if (PUDDLE_GROUND.has(ground)) {
      const soft = ground === "MUD" || ground === "SWAMP";
      if (r < (soft ? 0.75 : 0.32)) {
        const size = hash(col, row, 17) < 0.3 ? 0 : hash(col, row, 19) < 0.55 ? 1 : 2;
        const from = 0.12 + (soft ? 0 : 0.25) + (size * 0.12) + 0.2 * hash(col, row, 23);
        out = { x: Math.round(x), y: Math.round(y), size, from, phase: hash(col, row, 29) * 10 };
      }
    }
    this.cache.set(key, out);
    return out;
  }

  private drawPuddles(v: Phaser.Geom.Rectangle, rain: boolean): void {
    const c0 = Math.floor(v.x / CELL) - 1;
    const c1 = Math.floor(v.right / CELL) + 1;
    const r0 = Math.floor(v.y / CELL) - 1;
    const r1 = Math.floor(v.bottom / CELL) + 1;
    const seen = new Set<number>();
    let shown = 0;
    if (this.wetness > 0.05 && (c1 - c0) * (r1 - r0) < 2500) {
      for (let row = r0; row <= r1; row++) {
        for (let col = c0; col <= c1; col++) {
          const p = this.puddleAt(col, row);
          if (!p) continue;
          // (A neve que cobre o chão cobre também as poças)
          const alpha = Math.min(1, (this.wetness - p.from) * 4) * Math.max(0, 1 - this.snow * 2.5);
          if (alpha <= 0) continue;
          const key = row * 100000 + col;
          seen.add(key);
          let bob = this.bobs.get(key);
          if (!bob) {
            bob = this.puddles.create(p.x - PUDDLE.w / 2, p.y - PUDDLE.h / 2, puddleFrame(p.size, 0));
            this.bobs.set(key, bob);
          }
          // Na chuva, uma gota cai na poça de tempos em tempos e o círculo cresce
          const k = (this.t * 1.6 + p.phase) % 2.2;
          const f = rain && k < 0.6 ? 1 + Math.floor(k / 0.2) : 0;
          bob.setFrame(puddleFrame(p.size, Math.min(3, f)));
          bob.setAlpha(alpha);
          shown++;
        }
      }
    }
    for (const [key, bob] of this.bobs) {
      if (seen.has(key)) continue;
      bob.destroy();
      this.bobs.delete(key);
    }
    this.shownPuddles = shown;
  }

  private drawSnow(v: Phaser.Geom.Rectangle): void {
    const level = this.snow * SNOW_LEVELS.length;
    const base = Math.floor(level) - 1;
    const frac = level - Math.floor(level);
    const [under, over] = this.cover;
    const place = (t: Phaser.GameObjects.TileSprite, i: number, alpha: number) => {
      if (i < 0 || alpha <= 0.01) {
        t.setVisible(false);
        return;
      }
      const tex = `weather:snow:${Math.min(SNOW_LEVELS.length - 1, i)}`;
      if (t.texture.key !== tex) t.setTexture(tex);
      // O ladrilho preso ao mundo: o chão não escorrega quando a câmera anda
      const x = Math.floor(v.x) - 1;
      const y = Math.floor(v.y) - 1;
      t.setVisible(true).setPosition(x, y).setSize(Math.ceil(v.width) + 2, Math.ceil(v.height) + 2).setAlpha(alpha);
      t.setTilePosition(((x % SNOW_TILE) + SNOW_TILE) % SNOW_TILE, ((y % SNOW_TILE) + SNOW_TILE) % SNOW_TILE);
    };
    if (this.snow >= 1) {
      place(under, SNOW_LEVELS.length - 1, 0.92);
      place(over, -1, 0);
      return;
    }
    place(under, base, 0.92);
    place(over, base + 1, 0.92 * frac);
  }

  destroy(): void {
    this.wet.destroy();
    this.puddles.destroy();
    for (const t of this.cover) t.destroy();
  }
}
