import Phaser from "phaser";
import { Extra } from "../entities/Extra";
import { troopLook } from "../art/looks";
import type { Commander } from "../entities/Commander";
import { CAMP_SITES, CAMPFIRE, INTERACT_RADIUS, PALISADE, QUARTER_SLOTS, type CampSite } from "../data/campLayout";
import type { CampDef } from "../data/world";
import { fullName, type LieutenantData } from "../data/lieutenants";
import { Pathfinder } from "./Pathfinder";
import { mutinyLeader, type BattalionData, type CampPanel, type GameState } from "../../store/useGameStore";
import { COLORS, type CampWork } from "../../utils/constants";
import { distance, type Point } from "../../utils/math";
import type { Rect } from "./townLayout";
import { TownArt, type ArtJob } from "./TownArt";
import {
  bannerPiece,
  bonfirePiece,
  campPropPiece,
  fencePiece,
  forgeGlow,
  forgePiece,
  propPiece,
  stablePiece,
  stakesPiece,
  tablePiece,
  tentPiece,
  towerPiece,
  wagonPiece,
  wellPiece,
  type Culture,
  type Piece,
} from "../art/buildings";

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
/** Estacas da paliçada: uma a cada STAKE px da elipse, em grupos de STAKE_GROUP (cada grupo com a própria profundidade). */
const STAKE = 6;
const STAKE_GROUP = 6;
const ART_ID = "acampamento";
/** As peças dos seguidores (caldeirão, banca, enfermaria...), refeitas quando a lista muda. */
const FOLLOWER_ART_ID = "acampamento:seguidores";

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
  /** Pixel art (G3): as peças fixas e as dos alojamentos (refeitas quando o exército muda). */
  private readonly art: TownArt;
  private readonly artJobs: ArtJob[] = [];
  private quarterJobs: ArtJob[] = [];

  constructor(
    private readonly scene: Phaser.Scene,
    camp: CampDef,
    /** Acampamento levantado (Marco 13): nada no chão, tudo nas carroças. */
    readonly packed = false,
    works: readonly CampWork[] = [],
    private readonly culture: Culture = "REALMS",
  ) {
    this.origin = camp.origin;
    this.campfire = this.at(CAMPFIRE);
    this.center = this.at(PALISADE);
    this.art = new TownArt(scene);
    if (packed) return;
    this.drawGround(works.includes("PALISADE"));
    this.drawCampfire();
    for (const site of CAMP_SITES) this.drawSite(site);
    this.drawProps(works.includes("TOWERS"));
    this.publishArt();
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
    const c = this.culture;
    const jobs = this.artJobs;
    // Obra: torres de vigia altas nos quatro cantos da paliçada (sólidas)
    if (towers) {
      for (const p of EXTRA_TOWERS) {
        this.artFoot(jobs, p.x - 30, p.y - 30, 60, () => towerPiece(60, false, c, p.x * 7 + p.y, false));
        this.obstacles.push(this.solid(p.x - 30, p.y - 30, 60, 60));
        this.torches.push(this.at(p));
      }
    }
    // Torres de vigia dos dois lados do portão (sólidas)
    for (const [tx, ty] of [[205, 535], [205, 765]]) {
      this.artFoot(jobs, tx - 26, ty - 26, 52, () => towerPiece(52, false, c, tx + ty, false));
      this.obstacles.push(this.solid(tx - 26, ty - 26, 52, 52));
    }
    // Poço de pedra (sólido)
    const well = { x: 1100, y: 870 };
    this.artFoot(jobs, well.x - 20, well.y - 20, 40, () => wellPiece(20, c, 11, false));
    this.obstacles.push(this.solid(well.x - 22, well.y - 22, 44, 44));
    // Lenha empilhada junto à Intendência (sólida)
    this.artFoot(jobs, 442, 550, 24, () => campPropPiece("WOODPILE", c, 12, 58, 24));
    this.obstacles.push(this.solid(442, 550, 58, 24));
    // Barris e caixotes (só desenho)
    for (const [bx, by] of [[505, 690], [524, 700], [1288, 700], [1320, 905]]) this.artAt(jobs, bx, by + 6, () => propPiece("BARREL", c, bx));
    for (const [cx, cy] of [[492, 712], [1430, 760]]) this.artFoot(jobs, cx, cy, 10, () => propPiece("CRATE", c, cx));
    // Feno do estábulo
    for (const [hx, hy] of [[1250, 455], [1250, 485]]) this.artFoot(jobs, hx, hy, 20, () => campPropPiece("HAY", c, hy, 30, 20));
    // Tochas ao longo dos caminhos
    for (const [px, py] of [[700, 650], [430, 650], [900, 520], [1070, 650], [740, 760], [1110, 760]]) {
      this.artAt(jobs, px, py, () => campPropPiece("TORCH", c, px));
      this.torches.push(this.at({ x: px, y: py - 20 }));
    }
    // Estandartes no portão
    for (const fy of [580, 720]) this.artAt(jobs, 150, fy, () => bannerPiece(COLORS.ALLY, false));
    this.onSolidsChanged?.();
  }

  /** Peça com o canto do pé em (x, y), local, e o pé descendo h: a profundidade é a linha de baixo. */
  private artFoot(list: ArtJob[], x: number, y: number, h: number, make: () => Piece): void {
    const o = this.origin;
    list.push({ x: Math.round(o.x + x), y: Math.round(o.y + y), depth: Math.round(o.y + y + h), make });
  }

  /** Peça com a âncora no ponto local (o pé de um mastro, de um boneco, de uma tocha). */
  private artAt(list: ArtJob[], x: number, y: number, make: () => Piece): void {
    const o = this.origin;
    list.push({ x: Math.round(o.x + x), y: Math.round(o.y + y), depth: Math.round(o.y + y), make });
  }

  /** Manda as peças para a montagem (a antiga fica na tela até a nova acabar). */
  private publishArt(): void {
    this.art.setJobs(ART_ID, [...this.artJobs, ...this.quarterJobs]);
  }

  /** As peças dos lugares de trabalho dos seguidores, na mesma montagem do acampamento. */
  setFollowerArt(jobs: ArtJob[]): void {
    this.art.setJobs(FOLLOWER_ART_ID, jobs);
  }

  /** Monta e mostra as peças perto da câmera (chamado a cada quadro). */
  updateArt(camera: Phaser.Cameras.Scene2D.Camera): void {
    this.art.update(camera);
  }

  /** Quantas peças do acampamento estão de pé (para testes). */
  get artPieces(): number {
    return this.art.pieceCount;
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

  // --- Desenho: peças de pixel art (G3) nas coordenadas locais do layout, levadas para o mundo. ---

  /**
   * A terra batida e as trilhas são pintadas com o chão (TerrainMap). Aqui, a paliçada: estacas
   * ao longo da elipse, com um portão a oeste, em grupos curtos (cada um com a própria profundidade).
   */
  private drawGround(reinforced: boolean): void {
    const { rx, ry } = PALISADE;
    const n = Math.round((2 * Math.PI * Math.sqrt((rx * rx + ry * ry) / 2)) / STAKE);
    let group: Point[] = [];
    const flush = () => {
      if (group.length === 0) return;
      const x0 = Math.min(...group.map((p) => p.x));
      const y0 = Math.min(...group.map((p) => p.y));
      const y1 = Math.max(...group.map((p) => p.y));
      const pts = group.map((p) => ({ x: p.x - x0, y: p.y - y0 }));
      const seed = Math.round(x0 * 31 + y0);
      this.artFoot(this.artJobs, x0, y0, y1 - y0, () => stakesPiece(pts, this.culture, seed, reinforced));
      group = [];
    };
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const gateDiff = Math.abs(Math.atan2(Math.sin(a - PALISADE.gateAngle), Math.cos(a - PALISADE.gateAngle)));
      if (gateDiff < PALISADE.gateHalfWidth) {
        flush();
        continue;
      }
      group.push({ x: PALISADE.x + Math.cos(a) * rx, y: PALISADE.y + Math.sin(a) * ry });
      if (group.length >= STAKE_GROUP) flush();
    }
    flush();
    worldLabel(this.scene, this.origin.x + PALISADE.x - PALISADE.rx - 70, this.origin.y + PALISADE.y - 40, "ACAMPAMENTO", "#ffe9b0");
  }

  private drawCampfire(): void {
    const r = 28;
    this.artFoot(this.artJobs, CAMPFIRE.x - r, CAMPFIRE.y - r, 2 * r, () => bonfirePiece(r, 5));
    // A chama (ainda forma simples, pisca) por cima da lenha: quem está atrás da fogueira some atrás dela
    const flame = this.scene.add.graphics({ x: this.campfire.x, y: this.campfire.y - 6 }).setDepth((this.campfire.y + r) * 1e-6 + 1e-7);
    flame.fillStyle(CAMP_COLORS.FIRE, 0.9);
    flame.fillCircle(0, 0, 11);
    flame.fillStyle(CAMP_COLORS.FIRE_CORE, 1);
    flame.fillCircle(0, 2, 5);
    this.scene.tweens.add({ targets: flame, scale: 1.25, alpha: 0.75, duration: 280, yoyo: true, repeat: -1, ease: "Sine.easeInOut" });
  }

  private solid(x: number, y: number, w: number, h: number): Phaser.Geom.Rectangle {
    return new Phaser.Geom.Rectangle(this.origin.x + x, this.origin.y + y, w, h);
  }

  private drawSite(site: CampSite): void {
    const { x, y, w, h } = site;
    const solid = this.solid(x - w / 2, y - h / 2, w, h);
    const c = this.culture;
    const jobs = this.artJobs;
    const foot = (make: () => Piece) => this.artFoot(jobs, x - w / 2, y - h / 2, h, make);

    switch (site.kind) {
      case "TENT":
        // Pavilhão listrado e o estandarte do Comandante
        foot(() => tentPiece(w, h, CAMP_COLORS.COMMAND_TENT, 0xb8902c, 41));
        this.artAt(jobs, x + w / 2 + 14, y + 10, () => bannerPiece(CAMP_COLORS.BANNER, true, 74));
        this.obstacles.push(solid);
        break;
      case "QUARTERMASTER":
        foot(() => wagonPiece(w, h, c, 42));
        this.obstacles.push(solid);
        break;
      case "RECRUIT":
        foot(() => tablePiece(w, h, c));
        this.artAt(jobs, x + w / 2 + 12, y + 10, () => bannerPiece(COLORS.ALLY, false, 70));
        this.obstacles.push(solid);
        break;
      case "TRAINING": {
        // Cercado com bonecos de treino (área caminhável): aberto do lado da porta (leste)
        const x0 = x - w / 2;
        const y0 = y - h / 2;
        this.artFoot(jobs, x0, y0, 0, () => fencePiece(w, true, [], c));
        this.artFoot(jobs, x0, y0 + h, 0, () => fencePiece(w, true, [], c));
        for (const [fx, open] of [[x0, false], [x0 + w, true]] as const) {
          for (let d = 0; d < h; d += 44) {
            const len = Math.min(44, h - d);
            const mid = d + len / 2;
            const gaps: [number, number][] = open && Math.abs(mid - h / 2) < h * 0.22 ? [[0, len]] : [];
            this.artFoot(jobs, fx, y0 + d, len, () => fencePiece(len, false, gaps, c));
          }
        }
        for (const [dx, dy] of [[-60, -30], [0, -30], [60, -30], [-30, 30], [30, 30]]) this.artAt(jobs, x + dx, y + dy + 14, () => propPiece("DUMMY", c, dx * 3 + dy));
        break;
      }
      case "STABLE":
        // Alpendre e curral com cocho (batedores e mensageiros descansam por perto)
        foot(() => stablePiece(w, h, c, 43));
        this.obstacles.push(solid);
        break;
      case "FORGE": {
        foot(() => forgePiece(w, h, c, 44));
        // A brasa do fogão pisca (por cima da ferraria, que fica atrás de quem passa na frente)
        const at = forgeGlow(w);
        const glow = this.scene.add.graphics({ x: this.origin.x + x - w / 2 + at.x, y: this.origin.y + y - h / 2 + at.y }).setDepth((this.origin.y + y + h / 2) * 1e-6 + 1e-7);
        glow.fillStyle(CAMP_COLORS.FIRE, 0.55);
        glow.fillCircle(0, 0, 7);
        this.scene.tweens.add({ targets: glow, alpha: 0.25, duration: 500, yoyo: true, repeat: -1 });
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
    this.quarterJobs = [];

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
    this.publishArt();
    this.onSolidsChanged?.();
  }

  private addLieutenantSpot(l: LieutenantData, pos: Point, drawFigure: boolean): void {
    if (drawFigure) {
      // Sentado na roda da fogueira, virado para o fogo, com o anel prateado de tenente
      const fig = new Extra(this.scene, pos.x, pos.y, { ...troopLook("INFANTRY"), trim: 0xdfe3ee }, 8, COLORS.LIEUTENANT);
      const fire = this.at(CAMPFIRE);
      fig.setFacing(Math.atan2(fire.y - pos.y, fire.x - pos.x));
      fig.setPose("SIT");
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
    // Barraca e o estandarte com a cor da tropa (roxos no motim)
    const canvas = mutinous ? COLORS.MUTINEER : CAMP_COLORS.CANVAS;
    this.artFoot(this.quarterJobs, slot.x - 40, tentY - 28, 56, () => tentPiece(80, 56, canvas, null, slot.x));
    this.artAt(this.quarterJobs, slot.x + 56, tentY + 30, () => bannerPiece(mutinous ? COLORS.MUTINEER : COLORS.ALLY, false, 60));

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

