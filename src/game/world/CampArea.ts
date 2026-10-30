import Phaser from "phaser";
import { drawTroopShape } from "../entities/shapes";
import type { Commander } from "../entities/Commander";
import { CAMP_SITES, CAMPFIRE, INTERACT_RADIUS, PALISADE, QUARTER_SLOTS, type CampSite } from "../data/campLayout";
import type { CampDef } from "../data/world";
import { fullName, type LieutenantData } from "../data/lieutenants";
import { Pathfinder } from "./Pathfinder";
import { mutinyLeader, type BattalionData, type CampPanel, type GameState } from "../../store/useGameStore";
import { COLORS, type CampWork } from "../../utils/constants";
import { distance, type Point } from "../../utils/math";
import type { Rect } from "./townLayout";

/** Torres da obra "Torres de vigia" (coordenadas locais). */
const EXTRA_TOWERS: Point[] = [
  { x: 900, y: 170 },
  { x: 1400, y: 280 },
  { x: 1400, y: 1020 },
];

/** Raio sólido da fogueira (pedras em volta). */
const FIRE_RADIUS = 34;
/** A paliçada tem esta folga por dentro (estacas). */
const PALISADE_INSET = 30;

/** Ponto de interação no mundo: um local do acampamento, um alojamento, um tenente ou uma cidade. */
export interface Interactable {
  label: string;
  door: Point;
  panel: CampPanel;
  /** Área clicável (coordenadas do mundo). */
  bounds: Phaser.Geom.Rectangle;
  /** Distância da porta em que aparece o aviso "E — ...". */
  radius: number;
  /** Estrutura com lado de dentro (Marco 14): a chave do interior; E entra em vez de abrir o painel. */
  enter?: string;
}

export const CAMP_COLORS = {
  GRASS: 0x3a7d2c,
  DIRT: 0x7a6a45,
  PATH: 0x8d7b52,
  POST: 0x5a3d1e,
  TREE: 0x1f4a18,
  CANVAS: 0xc9b48a,
  CANVAS_DARK: 0x9c8660,
  COMMAND_TENT: 0x8e2b22,
  WOOD: 0x6b4a2b,
  STONE: 0x6f6f6f,
  FIRE: 0xff8c1a,
  FIRE_CORE: 0xffe066,
  BANNER: 0xe0b040,
} as const;

export const worldLabel = (scene: Phaser.Scene, x: number, y: number, text: string, color = "#ffffff") =>
  scene.add
    .text(x, y, text, { fontFamily: "monospace", fontSize: "13px", color, stroke: "#000000", strokeThickness: 3 })
    .setOrigin(0.5)
    .setDepth(20);

/**
 * O acampamento do bando, desenhado no próprio mundo (greybox): paliçada com portão a oeste,
 * fogueira, tenda do Comandante, intendência, recrutamento, treino, estábulo, ferraria e um
 * alojamento por batalhão. O layout está em campLayout.ts (coordenadas locais) e é deslocado
 * para this.origin. Dentro da paliçada o relógio para e as tropas descansam nos alojamentos.
 */
export class CampArea {
  readonly interactables: Interactable[] = [];
  /** Retângulos sólidos (barracas, carroça, forja...) que o Comandante contorna. */
  private obstacles: Phaser.Geom.Rectangle[] = [];
  private quarterObjects: Phaser.GameObjects.GameObject[] = [];
  private quarterRects: Phaser.Geom.Rectangle[] = [];
  private pathfinder: Pathfinder | null = null;
  readonly campfire: Point;
  private readonly center: Point;
  /** Canto do layout do acampamento no mundo (gerado com o mundo). */
  private readonly origin: Point;

  constructor(
    private readonly scene: Phaser.Scene,
    camp: CampDef,
    /** Acampamento levantado (Marco 13): nada no chão, tudo nas carroças. */
    readonly packed = false,
    works: readonly CampWork[] = [],
  ) {
    this.origin = camp.origin;
    this.campfire = this.at(CAMPFIRE);
    this.center = this.at(PALISADE);
    if (packed) return;
    this.drawGround(works.includes("PALISADE"));
    this.drawCampfire();
    for (const site of CAMP_SITES) this.drawSite(site);
    this.drawProps(works.includes("TOWERS"));
    // Portão (Marco 14): ali se escolhe quem sai com o Comandante e quem fica de guarda
    const gate = { x: PALISADE.x + Math.cos(PALISADE.gateAngle) * (PALISADE.rx - 70), y: PALISADE.y + Math.sin(PALISADE.gateAngle) * (PALISADE.ry - 70) };
    this.interactables.push({
      label: "Portão: quem sai com o Comandante",
      door: this.at(gate),
      panel: { kind: "DEPARTURE" },
      bounds: new Phaser.Geom.Rectangle(this.origin.x + gate.x - 50, this.origin.y + gate.y - 60, 100, 120),
      radius: 80,
    });
  }

  /** Centro e raios da paliçada (o fosso corre em volta dela). */
  get palisade(): { cx: number; cy: number; rx: number; ry: number; gateAngle: number; gateHalf: number } {
    return { cx: this.center.x, cy: this.center.y, rx: PALISADE.rx, ry: PALISADE.ry, gateAngle: PALISADE.gateAngle, gateHalf: PALISADE.gateHalfWidth };
  }

  /** Torres de vigia das obras (ficam nos quatro cantos; enxergam longe). */
  get watchtowers(): Point[] {
    return EXTRA_TOWERS.map((p) => this.at(p));
  }

  /** Avisado quando barracas e estruturas mudam (a colisão e a navegação são refeitas). */
  onSolidsChanged: (() => void) | null = null;
  /** Tochas fincadas ao longo dos caminhos (acesas à noite). */
  readonly torches: Point[] = [];

  /**
   * Tudo o que bloqueia no acampamento, para todo mundo (soldados, inimigos, cavaleiros), não
   * só para o Comandante: barracas e estruturas, a fogueira e a paliçada (com o vão do portão).
   */
  solids(): { rect: Rect; type: "WALL" | "BUILDING" }[] {
    if (this.packed) return [];
    const out: { rect: Rect; type: "WALL" | "BUILDING" }[] = this.obstacles.map((r) => ({ rect: { x: r.x, y: r.y, w: r.width, h: r.height }, type: "BUILDING" as const }));
    const f = FIRE_RADIUS * 0.8;
    out.push({ rect: { x: this.campfire.x - f, y: this.campfire.y - f, w: f * 2, h: f * 2 }, type: "BUILDING" });
    // Paliçada: blocos sobrepostos ao longo da elipse (34 px, mais largos que o passo entre eles)
    const n = 170;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const gateDiff = Math.abs(Math.atan2(Math.sin(a - PALISADE.gateAngle), Math.cos(a - PALISADE.gateAngle)));
      if (gateDiff < PALISADE.gateHalfWidth) continue;
      const x = this.center.x + Math.cos(a) * PALISADE.rx;
      const y = this.center.y + Math.sin(a) * PALISADE.ry;
      out.push({ rect: { x: x - 17, y: y - 17, w: 34, h: 34 }, type: "WALL" });
    }
    return out;
  }

  /** Enfeites do acampamento: torres de vigia no portão, poço, lenha, barris, feno e tochas. */
  private drawProps(towers: boolean): void {
    const g = this.gfx(-2.2);
    const rnd = new Phaser.Math.RandomDataGenerator(["acampamento-enfeites"]);
    // Obra: torres de vigia altas nos quatro cantos da paliçada (sólidas)
    if (towers) {
      for (const p of EXTRA_TOWERS) {
        g.fillStyle(0x4a321c, 1);
        g.fillRect(p.x - 30, p.y - 30, 60, 60);
        g.lineStyle(3, COLORS.OUTLINE, 1);
        g.strokeRect(p.x - 30, p.y - 30, 60, 60);
        g.fillStyle(0x6b4a2b, 1);
        g.fillRect(p.x - 22, p.y - 22, 44, 44);
        g.fillStyle(CAMP_COLORS.FIRE, 1);
        g.fillCircle(p.x, p.y, 5);
        this.obstacles.push(this.solid(p.x - 30, p.y - 30, 60, 60));
        this.torches.push(this.at(p));
      }
    }
    // Torres de vigia dos dois lados do portão (sólidas)
    for (const [tx, ty] of [[205, 535], [205, 765]]) {
      g.fillStyle(0x5c3f24, 1);
      g.fillRect(tx - 26, ty - 26, 52, 52);
      g.lineStyle(3, COLORS.OUTLINE, 1);
      g.strokeRect(tx - 26, ty - 26, 52, 52);
      g.fillStyle(0x4a321c, 1);
      g.fillRect(tx - 16, ty - 16, 32, 32);
      g.lineStyle(2, 0x2b1d0e, 1);
      g.lineBetween(tx - 26, ty - 26, tx + 26, ty + 26);
      g.lineBetween(tx + 26, ty - 26, tx - 26, ty + 26);
      this.obstacles.push(this.solid(tx - 26, ty - 26, 52, 52));
    }
    // Poço de pedra (sólido)
    const well = { x: 1100, y: 870 };
    g.fillStyle(CAMP_COLORS.STONE, 1);
    g.fillCircle(well.x, well.y, 22);
    g.fillStyle(0x2b4a6b, 1);
    g.fillCircle(well.x, well.y, 12);
    g.lineStyle(3, CAMP_COLORS.WOOD, 1);
    g.lineBetween(well.x - 24, well.y - 18, well.x + 24, well.y - 18);
    this.obstacles.push(this.solid(well.x - 22, well.y - 22, 44, 44));
    // Lenha empilhada junto à Intendência (sólida)
    g.fillStyle(CAMP_COLORS.WOOD, 1);
    for (let k = 0; k < 4; k++) g.fillRect(442, 550 + k * 6, 58, 5);
    g.lineStyle(1, COLORS.OUTLINE, 0.7);
    g.strokeRect(442, 550, 58, 24);
    this.obstacles.push(this.solid(442, 550, 58, 24));
    // Barris e caixotes (só desenho)
    for (const [bx, by] of [[505, 690], [524, 700], [1288, 700], [1320, 905]]) {
      g.fillStyle(0x6b4a2b, 1);
      g.fillCircle(bx, by, 9);
      g.lineStyle(1.5, COLORS.OUTLINE, 0.8);
      g.strokeCircle(bx, by, 9);
    }
    g.fillStyle(0xb08850, 1);
    for (const [cx, cy] of [[492, 712], [1430, 760]]) {
      g.fillRect(cx, cy, 18, 18);
      g.strokeRect(cx, cy, 18, 18);
    }
    // Feno do estábulo
    g.fillStyle(0xd8c06a, 1);
    for (const [hx, hy] of [[1250, 455], [1250, 485]]) {
      g.fillRect(hx, hy, 30, 20);
      g.lineStyle(1, 0x9a8540, 1);
      g.strokeRect(hx, hy, 30, 20);
    }
    // Tochas ao longo dos caminhos
    for (const [px, py] of [[700, 650], [430, 650], [900, 520], [1070, 650], [740, 760], [1110, 760]]) {
      g.lineStyle(3, CAMP_COLORS.WOOD, 1);
      g.lineBetween(px, py, px, py - 18);
      g.fillStyle(CAMP_COLORS.FIRE, 1);
      g.fillCircle(px, py - 20, 5);
      this.torches.push(this.at({ x: px, y: py - 20 }));
    }
    // Estandartes no portão
    for (const fy of [580, 720]) {
      g.lineStyle(3, CAMP_COLORS.WOOD, 1);
      g.lineBetween(150, fy, 150, fy - 44);
      g.fillStyle(COLORS.ALLY, 1);
      g.fillRect(150, fy - 44, 26, 16);
    }
    // Chão: manchas mais escuras e tufos de capim
    const ground = this.gfx(-8.5);
    for (let k = 0; k < 60; k++) {
      const a = rnd.frac() * Math.PI * 2;
      const r = Math.sqrt(rnd.frac()) * 0.9;
      const x = PALISADE.x + Math.cos(a) * PALISADE.rx * r;
      const y = PALISADE.y + Math.sin(a) * PALISADE.ry * r;
      if (k < 30) {
        ground.fillStyle(rnd.pick([0x6f6040, 0x857450, 0x6a5a3a]), 0.7);
        ground.fillEllipse(x, y, rnd.between(40, 110), rnd.between(20, 50));
      } else {
        ground.lineStyle(2, 0x4f7a2c, 0.9);
        for (let b = -1; b <= 1; b++) ground.lineBetween(x, y, x + b * 5, y - 9);
      }
    }
    this.onSolidsChanged?.();
  }

  /** Ponto do layout local (campLayout.ts) no mundo. */
  private at(p: Point): Point {
    return { x: this.origin.x + p.x, y: this.origin.y + p.y };
  }

  /** Dentro da paliçada? (`pad` > 0 = um pouco mais para dentro) */
  contains(p: Point, pad = 0): boolean {
    return !this.packed && this.ellipseNorm(p, pad) <= 1;
  }

  /** Posição (no mundo) do alojamento do batalhão de índice `i` no exército. */
  quarterSlot(i: number): Point | null {
    return !this.packed && i < QUARTER_SLOTS.length ? this.at(QUARTER_SLOTS[i]) : null;
  }

  /** Onde as carroças ficam estacionadas (atrás da Intendência). */
  wagonPark(i: number): Point {
    return this.at({ x: 330 + (i % 3) * 70, y: 420 + Math.floor(i / 3) * 60 });
  }

  private ellipseNorm(p: Point, pad = 0): number {
    return Math.hypot(
      (p.x - this.center.x) / (PALISADE.rx - PALISADE_INSET - pad),
      (p.y - this.center.y) / (PALISADE.ry - PALISADE_INSET - pad),
    );
  }

  /** O ponto está no vão do portão (oeste)? */
  private atGate(p: Point): boolean {
    const a = Math.atan2((p.y - this.center.y) / PALISADE.ry, (p.x - this.center.x) / PALISADE.rx);
    return Math.abs(Math.atan2(Math.sin(a - PALISADE.gateAngle), Math.cos(a - PALISADE.gateAngle))) < PALISADE.gateHalfWidth;
  }

  /**
   * Colisões do Comandante: barracas e estruturas, a fogueira e a paliçada
   * (só se entra e sai pelo portão). `prev` = posição antes do movimento deste quadro.
   */
  collide(c: Commander, prev: Point): void {
    if (this.packed) return;
    const r = c.radius;
    const near = distance(c, this.center) < PALISADE.rx + 60;
    if (!near) return;
    for (const rect of this.obstacles) {
      const left = rect.x - r;
      const right = rect.right + r;
      const top = rect.y - r;
      const bottom = rect.bottom + r;
      if (c.x <= left || c.x >= right || c.y <= top || c.y >= bottom) continue;
      // Empurra pelo lado de menor penetração
      const pushes = [c.x - left, right - c.x, c.y - top, bottom - c.y];
      const min = Math.min(...pushes);
      if (min === pushes[0]) c.x = left;
      else if (min === pushes[1]) c.x = right;
      else if (min === pushes[2]) c.y = top;
      else c.y = bottom;
    }
    const df = distance(c, this.campfire);
    const fireR = FIRE_RADIUS + r;
    if (df < fireR && df > 0.001) {
      c.x = this.campfire.x + ((c.x - this.campfire.x) / df) * fireR;
      c.y = this.campfire.y + ((c.y - this.campfire.y) / df) * fireR;
    }
    // Paliçada: cruzar a cerca fora do portão desfaz o passo naquele eixo
    const wasIn = this.ellipseNorm(prev) <= 1;
    const isIn = this.ellipseNorm(c) <= 1;
    if (wasIn !== isIn && !this.atGate(c) && !this.atGate(prev)) {
      const k = this.ellipseNorm(c);
      const target = wasIn ? 0.995 : 1.005;
      c.x = this.center.x + ((c.x - this.center.x) / k) * target;
      c.y = this.center.y + ((c.y - this.center.y) / k) * target;
    }
  }

  /** Rota pelo acampamento desviando de barracas e da fogueira (caminhada por clique). */
  findPath(from: Point, to: Point, walkerRadius: number): Point[] {
    if (!this.pathfinder) {
      this.pathfinder = new Pathfinder(
        this.obstacles,
        [{ x: this.campfire.x, y: this.campfire.y, r: FIRE_RADIUS }],
        walkerRadius,
        (p) => this.contains(p, walkerRadius),
      );
    }
    return this.pathfinder.findPath(from, to);
  }

  nearestInteractable(p: Point, extra: readonly Interactable[]): Interactable | null {
    let best: Interactable | null = null;
    let bestDist = Infinity;
    for (const it of [...this.interactables, ...extra]) {
      const d = distance(it.door, p);
      if (d <= it.radius && d < bestDist) {
        best = it;
        bestDist = d;
      }
    }
    return best;
  }

  // --- Desenho (só primitivas). Os gráficos ficam na origem do acampamento e usam as coordenadas locais do layout. ---

  private gfx(depth: number): Phaser.GameObjects.Graphics {
    return this.scene.add.graphics({ x: this.origin.x, y: this.origin.y }).setDepth(depth);
  }

  private drawGround(reinforced: boolean): void {
    const g = this.gfx(-8.6);
    g.fillStyle(CAMP_COLORS.DIRT, 1);
    g.fillEllipse(PALISADE.x, PALISADE.y, PALISADE.rx * 2 - 40, PALISADE.ry * 2 - 40, 96);

    // Trilhas da fogueira até cada local
    g.lineStyle(26, CAMP_COLORS.PATH, 0.6);
    for (const site of CAMP_SITES) g.lineBetween(CAMPFIRE.x, CAMPFIRE.y, site.door.x, site.door.y);
    g.lineBetween(CAMPFIRE.x, CAMPFIRE.y, PALISADE.x - PALISADE.rx, PALISADE.y); // até o portão

    // Paliçada: estacas ao longo da elipse, com um portão a oeste
    const posts = this.gfx(-6);
    const n = 140;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const gateDiff = Math.abs(Math.atan2(Math.sin(a - PALISADE.gateAngle), Math.cos(a - PALISADE.gateAngle)));
      if (gateDiff < PALISADE.gateHalfWidth) continue;
      const x = PALISADE.x + Math.cos(a) * PALISADE.rx;
      const y = PALISADE.y + Math.sin(a) * PALISADE.ry;
      // Obra: paliçada reforçada (estacas grossas com escora de terra por fora)
      if (reinforced) {
        posts.fillStyle(0x6a5232, 1);
        posts.fillCircle(PALISADE.x + Math.cos(a) * (PALISADE.rx + 12), PALISADE.y + Math.sin(a) * (PALISADE.ry + 12), 11);
      }
      posts.fillStyle(CAMP_COLORS.POST, 1);
      posts.fillCircle(x, y, reinforced ? 12 : 9);
      posts.lineStyle(2, COLORS.OUTLINE, 0.8);
      posts.strokeCircle(x, y, reinforced ? 12 : 9);
    }
    worldLabel(this.scene, this.origin.x + PALISADE.x - PALISADE.rx - 70, this.origin.y + PALISADE.y - 40, "ACAMPAMENTO", "#ffe9b0");
  }

  private drawCampfire(): void {
    const g = this.gfx(-4);
    // Pedras e lenha
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2;
      g.fillStyle(CAMP_COLORS.STONE, 1);
      g.fillCircle(CAMPFIRE.x + Math.cos(a) * 28, CAMPFIRE.y + Math.sin(a) * 28, 7);
    }
    g.lineStyle(7, CAMP_COLORS.WOOD, 1);
    g.lineBetween(CAMPFIRE.x - 18, CAMPFIRE.y - 10, CAMPFIRE.x + 18, CAMPFIRE.y + 10);
    g.lineBetween(CAMPFIRE.x - 18, CAMPFIRE.y + 10, CAMPFIRE.x + 18, CAMPFIRE.y - 10);

    const flame = this.scene.add.graphics({ x: this.campfire.x, y: this.campfire.y }).setDepth(-3);
    flame.fillStyle(CAMP_COLORS.FIRE, 0.9);
    flame.fillCircle(0, 0, 15);
    flame.fillStyle(CAMP_COLORS.FIRE_CORE, 1);
    flame.fillCircle(0, 0, 7);
    this.scene.tweens.add({ targets: flame, scale: 1.25, alpha: 0.75, duration: 280, yoyo: true, repeat: -1, ease: "Sine.easeInOut" });
  }

  private solid(x: number, y: number, w: number, h: number): Phaser.Geom.Rectangle {
    return new Phaser.Geom.Rectangle(this.origin.x + x, this.origin.y + y, w, h);
  }

  private drawSite(site: CampSite): void {
    const g = this.gfx(-2);
    const { x, y, w, h } = site;
    const solid = this.solid(x - w / 2, y - h / 2, w, h);

    switch (site.kind) {
      case "TENT":
        drawTentShape(g, x, y, w, h, CAMP_COLORS.COMMAND_TENT);
        // Estandarte do Comandante
        g.lineStyle(3, CAMP_COLORS.WOOD, 1);
        g.lineBetween(x + w / 2 + 14, y - h / 2 - 20, x + w / 2 + 14, y + 10);
        g.fillStyle(CAMP_COLORS.BANNER, 1);
        g.fillTriangle(x + w / 2 + 14, y - h / 2 - 20, x + w / 2 + 44, y - h / 2 - 10, x + w / 2 + 14, y - h / 2);
        this.obstacles.push(solid);
        break;
      case "QUARTERMASTER":
        // Carroça com caixotes
        g.fillStyle(CAMP_COLORS.WOOD, 1);
        g.fillRect(x - w / 2, y - h / 2, w, h);
        g.lineStyle(2, COLORS.OUTLINE, 1);
        g.strokeRect(x - w / 2, y - h / 2, w, h);
        g.fillStyle(0x2b2b2b, 1);
        for (const [wx, wy] of [[-w / 2 + 16, -h / 2], [w / 2 - 16, -h / 2], [-w / 2 + 16, h / 2], [w / 2 - 16, h / 2]]) {
          g.fillCircle(x + wx, y + wy, 10);
        }
        g.fillStyle(0xb08850, 1);
        for (let i = 0; i < 3; i++) g.fillRect(x - w / 2 + 10 + i * 32, y - 14, 26, 26);
        this.obstacles.push(solid);
        break;
      case "RECRUIT":
        // Mesa de alistamento + bandeira
        g.fillStyle(CAMP_COLORS.WOOD, 1);
        g.fillRect(x - w / 2, y - h / 2, w, h);
        g.lineStyle(2, COLORS.OUTLINE, 1);
        g.strokeRect(x - w / 2, y - h / 2, w, h);
        g.fillStyle(0xf5f0e0, 1);
        g.fillRect(x - 20, y - 10, 30, 20); // pergaminho
        g.lineStyle(3, CAMP_COLORS.WOOD, 1);
        g.lineBetween(x + w / 2 + 12, y - 60, x + w / 2 + 12, y + 10);
        g.fillStyle(COLORS.ALLY, 1);
        g.fillRect(x + w / 2 + 12, y - 60, 30, 20);
        this.obstacles.push(solid);
        break;
      case "TRAINING": {
        // Cercado com bonecos de treino (área caminhável)
        g.lineStyle(4, CAMP_COLORS.WOOD, 1);
        g.strokeRect(x - w / 2, y - h / 2, w, h);
        for (let i = 0; i <= 6; i++) {
          g.fillStyle(CAMP_COLORS.POST, 1);
          g.fillCircle(x - w / 2 + (i * w) / 6, y - h / 2, 5);
          g.fillCircle(x - w / 2 + (i * w) / 6, y + h / 2, 5);
        }
        for (const [dx, dy] of [[-60, -30], [0, -30], [60, -30], [-30, 30], [30, 30]]) {
          g.lineStyle(4, CAMP_COLORS.WOOD, 1);
          g.lineBetween(x + dx - 12, y + dy, x + dx + 12, y + dy);
          g.lineBetween(x + dx, y + dy - 14, x + dx, y + dy + 14);
          g.fillStyle(0xd8c39a, 1);
          g.fillCircle(x + dx, y + dy - 14, 6);
        }
        break;
      }
      case "STABLE": {
        // Cercado de cavalos com cocho (batedores e mensageiros descansam por perto)
        g.fillStyle(0x6e5a36, 1);
        g.fillRect(x - w / 2, y - h / 2, w, h);
        g.lineStyle(4, CAMP_COLORS.WOOD, 1);
        g.strokeRect(x - w / 2, y - h / 2, w, h);
        for (let i = 0; i <= 6; i++) {
          g.fillStyle(CAMP_COLORS.POST, 1);
          g.fillCircle(x - w / 2 + (i * w) / 6, y - h / 2, 5);
          g.fillCircle(x - w / 2 + (i * w) / 6, y + h / 2, 5);
        }
        g.fillStyle(0x3b2a17, 1);
        g.fillRect(x - w / 2 + 8, y - h / 2 + 8, 40, 10); // cocho
        this.obstacles.push(solid);
        break;
      }
      case "FORGE": {
        g.fillStyle(CAMP_COLORS.STONE, 1);
        g.fillRect(x - w / 2, y - h / 2, w, h);
        g.lineStyle(2, COLORS.OUTLINE, 1);
        g.strokeRect(x - w / 2, y - h / 2, w, h);
        g.fillStyle(0x2b2b2b, 1);
        g.fillRect(x - 30, y + 8, 30, 14); // bigorna
        const glow = this.scene.add.graphics({ x: this.origin.x + x + 18, y: this.origin.y + y - 14 }).setDepth(-1);
        glow.fillStyle(CAMP_COLORS.FIRE, 1);
        glow.fillCircle(0, 0, 12);
        this.scene.tweens.add({ targets: glow, alpha: 0.5, duration: 500, yoyo: true, repeat: -1 });
        this.obstacles.push(solid);
        break;
      }
    }

    worldLabel(this.scene, this.origin.x + x, this.origin.y + y - h / 2 - 26, site.label, "#ffe9b0");
    this.interactables.push({
      label: site.label,
      door: this.at(site.door),
      panel: site.panel,
      bounds: this.solid(x - w / 2 - 10, y - h / 2 - 10, w + 20, h + 20),
      radius: INTERACT_RADIUS,
      // Tudo o que tem teto se entra (o Campo de Treino é a céu aberto)
      enter: site.kind === "TRAINING" ? undefined : `camp:${site.kind}`,
    });
  }

  /**
   * (Re)desenha os alojamentos: barraca e estandarte de cada batalhão (as tropas de verdade
   * ficam em forma diante dela quando estão no acampamento) e os tenentes sem comando na fogueira.
   * `away` = batalhões que estão fora do acampamento (a barraca mostra "em campo").
   */
  buildQuarters(state: Pick<GameState, "battalions" | "pendingMutiny" | "lieutenants">, away: ReadonlySet<string>): void {
    if (this.packed) return;
    for (const o of this.quarterObjects) o.destroy();
    this.quarterObjects = [];
    this.pathfinder = null; // obstáculos mudaram
    this.interactables.splice(
      0,
      this.interactables.length,
      ...this.interactables.filter((it) => it.panel.kind !== "BATTALION" && it.panel.kind !== "LIEUTENANT"),
    );
    this.obstacles = this.obstacles.filter((r) => !this.quarterRects.includes(r));
    this.quarterRects = [];

    const { battalions, pendingMutiny, lieutenants } = state;
    const rebel = pendingMutiny ? mutinyLeader(battalions) : null;
    battalions.slice(0, QUARTER_SLOTS.length).forEach((b, i) => {
      this.buildQuarter(b, QUARTER_SLOTS[i], b.id === rebel?.id, away.has(b.id));
    });

    // Tenentes: junto ao alojamento do batalhão que comandam, ou sentados na fogueira
    let idleSeat = 0;
    for (const l of lieutenants) {
      const i = battalions.findIndex((b) => b.id === l.battalionId);
      if (i >= 0 && i < QUARTER_SLOTS.length) {
        // O tenente de verdade marcha com o batalhão; aqui fica só o ponto de conversa
        const slot = QUARTER_SLOTS[i];
        this.addLieutenantSpot(l, this.at({ x: slot.x + 72, y: slot.y + 18 }), false);
      } else if (i < 0) {
        const a = Math.PI * 0.15 + idleSeat++ * 0.55; // lado sul da fogueira
        this.addLieutenantSpot(l, this.at({ x: CAMPFIRE.x + Math.cos(a) * 70, y: CAMPFIRE.y + Math.sin(a) * 60 }), true);
      }
    }
    this.onSolidsChanged?.();
  }

  private addLieutenantSpot(l: LieutenantData, pos: Point, drawFigure: boolean): void {
    if (drawFigure) {
      const fig = this.scene.add.graphics({ x: pos.x, y: pos.y }).setDepth(6);
      drawTroopShape(fig, "INFANTRY", 11);
      fig.lineStyle(3, COLORS.LIEUTENANT, 1);
      fig.strokeCircle(0, 0, 16);
      fig.rotation = Math.PI / 2;
      this.quarterObjects.push(fig);
      this.quarterObjects.push(worldLabel(this.scene, pos.x, pos.y - 26, l.name, "#dfe3ee"));
    }
    this.interactables.push({
      label: `Tenente ${fullName(l)}`,
      door: { x: pos.x, y: pos.y + 26 },
      panel: { kind: "LIEUTENANT", lieutenantId: l.id },
      bounds: new Phaser.Geom.Rectangle(pos.x - 20, pos.y - 34, 40, 54),
      radius: INTERACT_RADIUS,
    });
  }

  private buildQuarter(b: BattalionData, slot: Point, mutinous: boolean, away: boolean): void {
    const tentY = slot.y - 55;
    const g = this.gfx(-2);
    drawTentShape(g, slot.x, tentY, 80, 56, mutinous ? COLORS.MUTINEER : CAMP_COLORS.CANVAS);
    // Estandarte com a cor da tropa
    g.lineStyle(3, CAMP_COLORS.WOOD, 1);
    g.lineBetween(slot.x + 56, tentY - 30, slot.x + 56, tentY + 30);
    g.fillStyle(mutinous ? COLORS.MUTINEER : COLORS.ALLY, 1);
    g.fillRect(slot.x + 56, tentY - 30, 22, 16);
    this.quarterObjects.push(g);

    const tentRect = this.solid(slot.x - 40, tentY - 28, 80, 56);
    this.quarterRects.push(tentRect);
    this.obstacles.push(tentRect);

    const points = b.skillPoints > 0 ? `  +${b.skillPoints}` : "";
    const where = away ? "  (em campo)" : "";
    const color = mutinous ? "#d7a6ff" : b.skillPoints > 0 ? "#c6ff8a" : "#ffffff";
    this.quarterObjects.push(
      worldLabel(this.scene, this.origin.x + slot.x, this.origin.y + tentY - 44, `${b.name} · Nv ${b.level}${points}${where}`, color),
    );
    if (mutinous) this.quarterObjects.push(worldLabel(this.scene, this.origin.x + slot.x, this.origin.y + tentY - 62, "MOTIM", "#ff6b6b"));

    this.interactables.push({
      label: `Alojamento: ${b.name}`,
      door: this.at(slot),
      panel: { kind: "BATTALION", battalionId: b.id },
      bounds: this.solid(slot.x - 60, tentY - 40, 140, 160),
      radius: INTERACT_RADIUS,
      enter: mutinous ? undefined : `camp:Q:${b.id}`,
    });
  }
}

/** Barraca vista de cima: lona com cumeeira e a porta voltada para o sul. */
export function drawTentShape(g: Phaser.GameObjects.Graphics, x: number, y: number, w: number, h: number, color: number): void {
  g.fillStyle(color, 1);
  g.fillRect(x - w / 2, y - h / 2, w, h);
  g.fillStyle(0x000000, 0.18);
  g.fillRect(x, y - h / 2, w / 2, h); // metade sombreada
  g.lineStyle(3, COLORS.OUTLINE, 1);
  g.strokeRect(x - w / 2, y - h / 2, w, h);
  g.lineStyle(3, 0x000000, 0.5);
  g.lineBetween(x, y - h / 2, x, y + h / 2); // cumeeira
  g.fillStyle(0x1b1b1b, 1);
  g.fillTriangle(x - 14, y + h / 2, x + 14, y + h / 2, x, y + h / 2 - 22); // porta
}
