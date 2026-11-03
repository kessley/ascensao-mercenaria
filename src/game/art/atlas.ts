import Phaser from "phaser";
import { addCanvasTexture } from "./canvasTexture";
import { cellOf, dotOf, dotSprite, figureSheet, lookKey, miniOf, miniSheet, rides, type Look } from "./figures";
import type { Bitmap } from "./pixel";

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
  /** Montado (ou bicho): passo mais largo na animação. */
  rides: boolean;
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

/** Primeira linha com corpo (não sombra) no quadro parado de frente. */
function topOf(b: Bitmap, w: number, h: number): number {
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (b.rgba[(y * b.width + x) * 4 + 3] === 255) return y;
  return 0;
}

export function skinOf(scene: Phaser.Scene, look: Look): Skin {
  const id = lookKey(look);
  let skin = skins.get(id);
  if (skin && scene.textures.exists(skin.full)) return skin;
  const cell = cellOf(look);
  const mini = miniOf(look);
  const dot = dotOf(look);
  const sheet = figureSheet(look);
  skin = {
    full: `fig:${id}`,
    mini: `fig:${id}:mini`,
    dot: `fig:${id}:dot`,
    cell,
    mini2: mini,
    dot2: dot,
    height: cell.feetY - topOf(sheet, cell.w, cell.h),
    rides: rides(look),
  };
  addSheet(scene, skin.full, sheet, cell.w, cell.h);
  addSheet(scene, skin.mini, miniSheet(look), mini.w, mini.h);
  addSheet(scene, skin.dot, dotSprite(look), dot.w, dot.h);
  skins.set(id, skin);
  return skin;
}
