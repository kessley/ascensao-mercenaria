import Phaser from "phaser";
import { addCanvasTexture } from "./canvasTexture";
import { cellOf, dotOf, dotSprite, duelBannerSprite, figureSheet, lookKey, miniOf, miniSheet, rides, type Look } from "./figures";
import type { Bitmap } from "./pixel";
import { VEHICLE_CELL, VEHICLE_DOT, VEHICLE_MINI, vehicleDot, vehicleMiniSheet, vehicleSheet } from "./vehicles";

/**
 * Texturas das figuras, feitas na primeira vez que alguém veste aquele visual e guardadas no
 * gerenciador do jogo (valem para todas as cenas). Filtro "mais próximo" em cada textura: os
 * pixels ficam duros sem mudar o filtro do resto do jogo (texto, interface, chão).
 */

/** Nível de detalhe pelo zoom: sprite animado, mini-sprite de 2 quadros ou bloquinho na cor da tropa. */
export type Lod = "FULL" | "MINI" | "DOT";

export const lodOf = (zoom: number): Lod => (zoom >= 1 ? "FULL" : zoom >= 0.5 ? "MINI" : "DOT");

/** Quanto cada nível amplia a arte: o mini e o bloquinho são desenhados menores. */
export const LOD_SCALE: Record<Lod, number> = { FULL: 1, MINI: 2, DOT: 4 };

export interface Skin {
  full: string;
  mini: string;
  dot: string;
  cell: { w: number; h: number; feetX: number; feetY: number };
  mini2: { w: number; h: number };
  dot2: { w: number; h: number };
  /** Altura da figura acima dos pés (de frente, parada): nomes e avisos vão em cima. */
  height: number;
  /** Chão percorrido a cada quadro do passo: montado (ou bicho) dá passo mais largo; roda de veículo, mais curto. */
  stride: number;
}

const skins = new Map<string, Skin>();

function addSheet(scene: Phaser.Scene, key: string, b: Bitmap, fw: number, fh: number): void {
  if (scene.textures.exists(key)) return;
  const canvas = document.createElement("canvas");
  canvas.width = b.width;
  canvas.height = b.height;
  canvas.getContext("2d")?.putImageData(new ImageData(b.rgba, b.width, b.height), 0, 0);
  const texture = addCanvasTexture(scene.textures, key, canvas);
  if (!texture) return;
  texture.setFilter(Phaser.Textures.FilterMode.NEAREST);
  const cols = b.width / fw;
  const rows = b.height / fh;
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) texture.add(r * cols + c, 0, c * fw, r * fh, fw, fh);
}

/** O estandarte do desafio dos heróis inimigos (uma textura só para todos). */
export function duelBannerKey(scene: Phaser.Scene): string {
  const key = "duel-banner";
  const b = duelBannerSprite();
  addSheet(scene, key, b, b.width, b.height);
  return key;
}

const sheets = new WeakMap<Phaser.Textures.Texture, Phaser.Textures.Frame[]>();

/** Os quadros de uma folha pelo número (todos do mesmo tamanho, como `addSheet` corta). */
export function sheetOf(texture: Phaser.Textures.Texture): readonly Phaser.Textures.Frame[] {
  let list = sheets.get(texture);
  if (!list) {
    list = [];
    for (const name of texture.getFrameNames()) {
      const i = Number(name);
      if (Number.isInteger(i)) list[i] = texture.get(i);
    }
    sheets.set(texture, list);
  }
  return list;
}

/** Primeira linha com corpo (não sombra) no quadro parado de frente. */
function topOf(b: Bitmap, w: number, h: number): number {
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (b.rgba[(y * b.width + x) * 4 + 3] === 255) return y;
  return 0;
}

export function skinOf(scene: Phaser.Scene, look: Look): Skin {
  const id = lookKey(look);
  let skin = skins.get(id);
  if (skin && scene.textures.exists(skin.full)) return skin;
  const vehicle = !!look.vehicle;
  const cell = vehicle ? VEHICLE_CELL : cellOf(look);
  const mini = vehicle ? VEHICLE_MINI : miniOf(look);
  const dot = vehicle ? VEHICLE_DOT : dotOf(look);
  const sheet = vehicle ? vehicleSheet(look) : figureSheet(look);
  skin = {
    full: `fig:${id}`,
    mini: `fig:${id}:mini`,
    dot: `fig:${id}:dot`,
    cell,
    mini2: mini,
    dot2: dot,
    height: cell.feetY - topOf(sheet, cell.w, cell.h),
    stride: vehicle ? 8 : rides(look) ? 18 : 11,
  };
  addSheet(scene, skin.full, sheet, cell.w, cell.h);
  addSheet(scene, skin.mini, vehicle ? vehicleMiniSheet(look) : miniSheet(look), mini.w, mini.h);
  addSheet(scene, skin.dot, vehicle ? vehicleDot(look) : dotSprite(look), dot.w, dot.h);
  skins.set(id, skin);
  return skin;
}
