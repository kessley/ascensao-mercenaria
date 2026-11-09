import Phaser from "phaser";
import { CAMP_BUILDINGS, type CampKind } from "../data/campGrid";
import { bannerPiece, bonfirePiece, forgePiece, stallPiece, tentPiece, type Culture, type Piece } from "../art/buildings";
import { COLORS } from "../../utils/constants";
import type { Point } from "../../utils/math";
import { pieceImage } from "./TownArt";
import { CAMP_COLORS } from "./CampArea";

/**
 * O acampamento de campo montado (Marco 22, parte 3): a tenda do Comandante, a fogueira e as até 6
 * construções do kit em volta, só desenho (sem grade nem planta: ele é a mochila do bando). Os
 * sólidos são poucos e pequenos; quem acampa ali dorme entre as barracas.
 */
const RING = 150;

export class FieldCampArt {
  private objects: Phaser.GameObjects.GameObject[] = [];
  private keys: string[] = [];
  private shown: string | null = null;
  /** Retângulos sólidos (as barracas), para quem quiser contar com eles. */
  solids: { x: number; y: number; w: number; h: number }[] = [];

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly culture: Culture,
  ) {}

  /** Mostra o acampamento em `at` com o kit (null = some). Só redesenha quando muda. */
  show(at: Point | null, kit: readonly CampKind[]): void {
    const id = at ? `${at.x},${at.y}:${kit.join(",")}` : null;
    if (id === this.shown) return;
    this.clear();
    this.shown = id;
    if (!at) return;
    const put = (key: string, piece: Piece, x: number, y: number, h: number) => {
      const k = `campo-de-campo:${key}`;
      this.keys.push(k);
      this.objects.push(pieceImage(this.scene, k, piece, Math.round(x), Math.round(y), Math.round(y + h)));
    };
    put("tenda", tentPiece(96, 64, CAMP_COLORS.COMMAND_TENT, 0xb8902c, 41), at.x - 48, at.y - 120, 64);
    put("bandeira", bannerPiece(COLORS.ALLY, true, 60), at.x + 52, at.y - 60, 0);
    put("fogo", bonfirePiece(18, 7), at.x - 18, at.y - 18, 36);
    this.solids = [{ x: at.x - 44, y: at.y - 90, w: 88, h: 34 }];
    kit.forEach((kind, i) => {
      const a = Math.PI * 0.15 + (i / Math.max(1, kit.length)) * Math.PI * 1.7;
      const p = { x: at.x + Math.cos(a) * RING, y: at.y + Math.sin(a) * RING * 0.75 };
      const w = CAMP_BUILDINGS[kind].size >= 3 ? 72 : 52;
      const h = Math.round(w * 0.66);
      const piece =
        kind === "FORGE"
          ? forgePiece(w, h, this.culture, 44)
          : kind === "BARRACK"
            ? tentPiece(w, h, CAMP_COLORS.CANVAS, null, i)
            : kind === "INFIRMARY"
              ? tentPiece(w, h, CAMP_COLORS.INFIRMARY, 0xa83232, i)
              : kind === "OFFICERS_TENT"
                ? tentPiece(w, h, CAMP_COLORS.OFFICERS, 0xdfe3ee, i)
                : CAMP_BUILDINGS[kind].craft || kind === "QUARTERMASTER"
                  ? stallPiece(w, h, 0x8a6a3a, this.culture, i)
                  : tentPiece(w, h, CAMP_COLORS.CANVAS_DARK, null, i);
      put(`${kind}-${i}`, piece, p.x - w / 2, p.y - h, h);
      this.solids.push({ x: p.x - w / 2 + 4, y: p.y - h * 0.5, w: w - 8, h: h * 0.5 });
    });
  }

  clear(): void {
    for (const o of this.objects) o.destroy();
    for (const k of this.keys) if (this.scene.textures.exists(k)) this.scene.textures.remove(k);
    this.objects = [];
    this.keys = [];
    this.solids = [];
    this.shown = null;
  }
}
