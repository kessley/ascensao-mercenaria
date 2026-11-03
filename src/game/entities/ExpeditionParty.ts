import Phaser from "phaser";
import { COLORS } from "../../utils/constants";
import type { Point } from "../../utils/math";

/** Mais que isso não cabe na coluna sem virar um borrão. */
const MAX_DOTS = 36;
const FILE = 3;
const GAP = 24;
const DOT = 8;
/** Salto grande (viagem rápida, relógio adiantado): vai direto, sem deslizar pelo mapa. */
const JUMP = 500;

/**
 * Tropa em expedição vista no mapa: uma coluna em marcha, só desenho. Quem manda nela é o relógio
 * (ver `expeditionStage`); a luta dela continua resolvida em conta, então ninguém a ataca.
 */
export class ExpeditionParty extends Phaser.GameObjects.Container {
  private readonly column: Phaser.GameObjects.Graphics;
  private readonly label: Phaser.GameObjects.Text;
  private readonly dots: number;
  private cart = false;
  /** Com capitão (Marco 20), o estandarte dele vai à frente, dourado. */
  private readonly captain: boolean;

  /** `tag` vai depois do nome ("em missão"); o comboio de suprimentos não leva nenhum. */
  constructor(scene: Phaser.Scene, at: Point, soldiers: number, name: string, captain = false, tag: string | null = "em missão") {
    super(scene, at.x, at.y);
    this.dots = Math.min(MAX_DOTS, soldiers);
    this.captain = captain;
    this.column = scene.add.graphics();
    this.label = scene.add
      .text(0, -46, tag ? `${name} · ${tag}` : name, { fontFamily: "monospace", fontSize: "12px", color: "#bfe3ff", stroke: "#10202e", strokeThickness: 3 })
      .setOrigin(0.5, 1);
    this.add([this.column, this.label]);
    this.setDepth(6);
    scene.add.existing(this as Phaser.GameObjects.GameObject);
    this.draw();
  }

  /** Coluna olhando para +X: o estandarte na frente, os soldados em fila e a carroça atrás. */
  private draw(): void {
    const g = this.column;
    g.clear();
    g.fillStyle(COLORS.OUTLINE, 1);
    g.fillRect(GAP - 2, -22, 3, 24);
    g.fillStyle(this.captain ? 0xe8b84a : 0x38bdf8, 1);
    g.fillTriangle(GAP + 1, -22, GAP + 18, -16, GAP + 1, -10);
    if (this.captain) {
      g.fillStyle(0x7a1f1f, 1);
      g.fillRect(GAP + 1, -10, 12, 3);
    }
    for (let i = 0; i < this.dots; i++) {
      const x = -Math.floor(i / FILE) * GAP;
      const y = ((i % FILE) - (FILE - 1) / 2) * GAP;
      g.fillStyle(COLORS.ALLY, 1);
      g.fillCircle(x, y, DOT);
      g.lineStyle(1.5, COLORS.OUTLINE, 1);
      g.strokeCircle(x, y, DOT);
    }
    if (!this.cart) return;
    const back = -(Math.ceil(this.dots / FILE) + 1) * GAP;
    g.fillStyle(0x6b4a2a, 1);
    g.fillRect(back - 22, -13, 44, 26);
    g.fillStyle(0xe8dcc0, 1);
    g.fillRect(back - 16, -10, 30, 20);
    g.lineStyle(2, COLORS.OUTLINE, 1);
    g.strokeRect(back - 22, -13, 44, 26);
  }

  setCart(cart: boolean): void {
    if (cart === this.cart) return;
    this.cart = cart;
    this.draw();
  }

  /** Anda até o ponto que o relógio manda (o relógio avança aos saltos: o desenho desliza). */
  follow(to: Point, facing: number, dt: number): void {
    const dx = to.x - this.x;
    const dy = to.y - this.y;
    const step = Math.hypot(dx, dy) > JUMP ? 1 : Math.min(1, dt * 3);
    this.x += dx * step;
    this.y += dy * step;
    this.column.rotation = facing;
  }
}
