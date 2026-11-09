import Phaser from "phaser";
import { Extra } from "../entities/Extra";
import { troopLook } from "../art/looks";
import type { Commander } from "../entities/Commander";
import { INTERACT_RADIUS, type CampSiteKind } from "../data/campLayout";
import type { CampDef } from "../data/world";
import { fullName, type LieutenantData } from "../data/lieutenants";
import {
  CAMP_BUILDINGS,
  CELL,
  cellAt,
  cellCenter,
  cellRect,
  cellsOf,
  costText,
  doorCells,
  fenceRuns,
  gateLane,
  gatePoints,
  halfOf,
  insideShape,
  isBuilt,
  workOf,
  onGate,
  shapeOf,
  tierOf,
  type CampBuilding,
  type CampKind,
  type CampPlan,
  type CampShape,
} from "../data/campGrid";
import { Pathfinder } from "./Pathfinder";
import { mutinyLeader, type BattalionData, type CampPanel, type GameState } from "../../store/useGameStore";
import { COLORS } from "../../utils/constants";
import { distance, type Point } from "../../utils/math";
import type { Rect } from "./townLayout";
import type { CampGround } from "./TerrainMap";
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
  stallPiece,
  type Culture,
  type Piece,
} from "../art/buildings";
import { brazierPiece, gravePiece, hutPiece, postsPiece, spikesPiece, totemPiece } from "../art/wilds";
import { tombPiece } from "../art/cityArt";
import { bushPiece } from "../art/trees";

/** Raio sólido da fogueira (pedras em volta). */
const FIRE_RADIUS = 30;
/** O quadrado tem esta folga por dentro da cerca (estacas). */
const FENCE_INSET = 14;
/** Estacas da paliçada: uma a cada STAKE px, em grupos de STAKE_GROUP (cada grupo com a própria profundidade). */
const STAKE = 6;
const STAKE_GROUP = 6;
/** O bivaque é marcado por estacas e cordas: uma estaca a cada BIVOUAC_STAKE px. */
const BIVOUAC_STAKE = 40;
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
  OFFICERS: 0x34507a,
  INFIRMARY: 0xe4dccb,
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

/** As duas plantas são iguais, a não ser pelo andamento das obras (nenhuma ficou pronta)? */
function sameButProgress(a: CampPlan, b: CampPlan): boolean {
  if (a.size !== b.size || a.gate !== b.gate || a.ditch !== b.ditch || a.buildings.length !== b.buildings.length) return false;
  return a.buildings.every((x, i) => {
    const y = b.buildings[i];
    return x.id === y.id && x.kind === y.kind && x.x === y.x && x.y === y.y && x.level === y.level && x.off === y.off && isBuilt(x) === isBuilt(y);
  });
}

/**
 * O rótulo de uma construção, logo acima das células dela: quebra em linhas na largura da peça (as
 * pequenas, de 2×2, ficam lado a lado sem um rótulo cobrir o outro) e cresce para cima.
 */
const planLabel = (scene: Phaser.Scene, r: Rect & { center: Point }, text: string, color: string) =>
  scene.add
    .text(r.center.x, r.y + 2, text, {
      fontFamily: "monospace",
      fontSize: r.w <= 2 * CELL ? "11px" : "13px",
      color,
      stroke: "#000000",
      strokeThickness: 3,
      align: "center",
      wordWrap: { width: r.w + 4 },
    })
    .setOrigin(0.5, 1)
    .setDepth(20);

/** As construções que já tinham painel e interior antes do Marco 22 (a chave do interior é a mesma). */
const SITE_OF: Partial<Record<CampKind, CampSiteKind>> = {
  COMMAND_TENT: "TENT",
  QUARTERMASTER: "QUARTERMASTER",
  RECRUIT_POST: "RECRUIT",
  TRAINING: "TRAINING",
  STABLE: "STABLE",
  FORGE: "FORGE",
};

/** Construções a céu aberto: dá para andar por dentro (não são sólidas). */
const OPEN_YARD: ReadonlySet<CampKind> = new Set(["TRAINING", "ARCHERY", "CAMPFIRE", "RIDING", "GARDEN", "CEMETERY", "CALTROPS", "STORY_FIRE"]);

/**
 * O acampamento do bando, desenhado no próprio mundo a partir da planta na grade (Marco 22):
 * o quadrado com a cerca e o portão no lado escolhido, cada construção na sua célula, a porta
 * de cada uma e um alojamento por barraca. Dentro da cerca o relógio para e as tropas descansam.
 */
export class CampArea {
  readonly interactables: Interactable[] = [];
  /** Retângulos sólidos (barracas, carroça, forja...) que o Comandante contorna. */
  private obstacles: Phaser.Geom.Rectangle[] = [];
  private quarterObjects: Phaser.GameObjects.GameObject[] = [];
  private quarterRects: Phaser.Geom.Rectangle[] = [];
  private pathfinder: Pathfinder | null = null;
  /** O centro da grade (no mundo). */
  readonly center: Point;
  campfire: Point;
  private plan: CampPlan;
  private shape: CampShape;
  /** A porta de cada construção (célula diante dela, no mundo). */
  private doors = new Map<string, Point>();
  /** Pixel art (G3): as peças fixas e as dos alojamentos (refeitas quando o exército muda). */
  private readonly art: TownArt;
  private artJobs: ArtJob[] = [];
  private quarterJobs: ArtJob[] = [];
  /** Rótulos, chamas e brasas da planta (refeitos quando ela muda). */
  private planObjects: Phaser.GameObjects.GameObject[] = [];
  /** O rótulo de cada obra em andamento (o trabalho de cada dia só troca o texto). */
  private workLabels = new Map<string, Phaser.GameObjects.Text>();
  private ghost: Phaser.GameObjects.Graphics | null = null;
  private ghostText: Phaser.GameObjects.Text | null = null;

  constructor(
    private readonly scene: Phaser.Scene,
    camp: CampDef,
    /** Acampamento levantado (Marco 13): nada no chão, tudo nas carroças. */
    readonly packed = false,
    plan: CampPlan,
    private readonly culture: Culture = "REALMS",
  ) {
    this.center = camp.center;
    this.plan = plan;
    this.shape = shapeOf(plan, this.center);
    this.campfire = { ...this.center };
    this.art = new TownArt(scene);
    if (packed) return;
    this.drawPlan();
  }

  /** A planta mudou (construção nova, mudada, desmontada, portão, paliçada): tudo é redesenhado. */
  /**
   * A planta só mudou no andamento das obras (o trabalho de um dia, sem nenhuma ficar pronta)? Então
   * basta trocar o texto dos rótulos, sem redesenhar o acampamento (que remonta a arte inteira).
   */
  updateProgress(plan: CampPlan): boolean {
    if (this.packed || !sameButProgress(this.plan, plan)) return false;
    this.plan = plan;
    for (const b of plan.buildings) {
      const label = this.workLabels.get(b.id);
      if (label) label.setText(`${CAMP_BUILDINGS[b.kind].label}
obra ${b.built ?? 0}/${workOf(b.kind)}`);
    }
    return true;
  }

  setPlan(plan: CampPlan, state: Pick<GameState, "battalions" | "pendingMutiny" | "lieutenants">, away: ReadonlySet<string>): void {
    if (this.packed) return;
    this.plan = plan;
    this.shape = shapeOf(plan, this.center);
    for (const o of this.planObjects) o.destroy();
    this.planObjects = [];
    this.workLabels.clear();
    this.obstacles = [];
    this.quarterRects = [];
    this.torches.length = 0;
    this.interactables.length = 0;
    this.drawPlan();
    this.buildQuarters(state, away);
  }

  private drawPlan(): void {
    this.artJobs = [];
    this.doors = new Map([...doorCells(this.plan)].map(([id, [x, y]]) => [id, cellCenter(this.center, x, y)]));
    const fire = this.plan.buildings.find((b) => b.kind === "CAMPFIRE");
    this.campfire = fire ? this.rectOf(fire).center : { ...this.center };
    this.drawFence();
    for (const b of this.plan.buildings) this.drawBuilding(b);
    this.publishArt();
    // Portão (Marco 14): ali se escolhe quem sai com o Comandante e quem fica de guarda
    const gate = gatePoints(this.shape, 50).inner;
    this.interactables.push({
      label: "Portão: quem sai com o Comandante",
      door: gate,
      panel: { kind: "DEPARTURE" },
      bounds: new Phaser.Geom.Rectangle(gate.x - 50, gate.y - 50, 100, 100),
      radius: 70,
    });
    this.torches.push(gatePoints(this.shape, 10).inner);
    this.onSolidsChanged?.();
  }

  /** O quadrado do acampamento (o fosso corre em volta dele). */
  get palisade(): CampShape {
    return this.shape;
  }

  /** O chão do acampamento para o TerrainMap pintar (terra batida, trilhas e aterro). */
  get ground(): CampGround | null {
    if (this.packed) return null;
    return { shape: this.shape, fire: this.campfire, doors: [...this.doors.values()], palisade: tierOf(this.plan) >= 1 };
  }

  /** Onde o Comandante aparece: diante da tenda dele. */
  get spawnPoint(): Point {
    const tent = this.plan.buildings.find((b) => b.kind === "COMMAND_TENT");
    return (tent && this.doors.get(tent.id)) ?? this.center;
  }

  /** O meio do portão, por dentro. */
  get gateInside(): Point {
    return gatePoints(this.shape, 70).inner;
  }

  /** As torres de vigia da planta (enxergam longe). */
  get watchtowers(): Point[] {
    return this.plan.buildings.filter((b) => b.kind === "TOWER" && isBuilt(b)).map((b) => this.rectOf(b).center);
  }

  /** As obras em andamento (onde vai quem está no turno de obra). */
  get worksites(): Point[] {
    return this.plan.buildings.filter((b) => !isBuilt(b)).map((b) => this.doors.get(b.id) ?? this.rectOf(b).center);
  }

  /** Um ponto por dentro da cerca, dando a volta (k de 0 a 1): a ronda da guarda e os cavalos amarrados. */
  fencePoint(k: number, inset = 34): Point {
    const h = this.shape.half - inset;
    const t = ((k % 1) + 1) % 1;
    const side = Math.floor(t * 4);
    const u = (t * 4 - side) * 2 - 1;
    const { cx, cy } = this.shape;
    if (side === 0) return { x: cx + u * h, y: cy - h };
    if (side === 1) return { x: cx + h, y: cy + u * h };
    if (side === 2) return { x: cx - u * h, y: cy + h };
    return { x: cx - h, y: cy - u * h };
  }

  /** A porta de um dos locais de antes (intendência, ferraria...), ou a fogueira se ele não existe. */
  siteDoor(kind: CampSiteKind): Point {
    const b = this.siteBuilding(kind);
    return (b && this.doors.get(b.id)) ?? this.campfire;
  }

  /** O meio de um local (o pátio do campo de treino), ou a fogueira se ele não existe. */
  siteCenter(kind: CampSiteKind): Point {
    const b = this.siteBuilding(kind);
    return b ? this.rectOf(b).center : this.campfire;
  }

  hasSite(kind: CampSiteKind): boolean {
    return !!this.siteBuilding(kind);
  }

  private siteBuilding(kind: CampSiteKind): CampBuilding | undefined {
    return this.plan.buildings.find((b) => SITE_OF[b.kind] === kind && isBuilt(b));
  }

  /** Avisado quando barracas e estruturas mudam (a colisão e a navegação são refeitas). */
  onSolidsChanged: (() => void) | null = null;
  /** Tochas fincadas ao longo dos caminhos (acesas à noite). */
  readonly torches: Point[] = [];

  /**
   * Tudo o que bloqueia no acampamento, para todo mundo (soldados, inimigos, cavaleiros), não
   * só para o Comandante: construções, a fogueira e a cerca (com o vão do portão).
   */
  solids(): { rect: Rect; type: "WALL" | "BUILDING" }[] {
    if (this.packed) return [];
    const out: { rect: Rect; type: "WALL" | "BUILDING" }[] = this.obstacles.map((r) => ({ rect: { x: r.x, y: r.y, w: r.width, h: r.height }, type: "BUILDING" as const }));
    const f = FIRE_RADIUS * 0.8;
    out.push({ rect: { x: this.campfire.x - f, y: this.campfire.y - f, w: f * 2, h: f * 2 }, type: "BUILDING" });
    for (const [x0, y0, x1, y1] of fenceRuns(this.shape)) {
      const t = 17;
      out.push({ rect: { x: Math.min(x0, x1) - t, y: Math.min(y0, y1) - t, w: Math.abs(x1 - x0) + t * 2, h: Math.abs(y1 - y0) + t * 2 }, type: "WALL" });
    }
    return out;
  }

  /** Peça com o canto do pé em (x, y), no mundo, e o pé descendo h: a profundidade é a linha de baixo. */
  private foot(list: ArtJob[], x: number, y: number, h: number, make: () => Piece): void {
    list.push({ x: Math.round(x), y: Math.round(y), depth: Math.round(y + h), make });
  }

  /** Peça com a âncora no ponto do mundo (o pé de um mastro, de um boneco, de uma tocha). */
  private anchor(list: ArtJob[], x: number, y: number, make: () => Piece): void {
    list.push({ x: Math.round(x), y: Math.round(y), depth: Math.round(y), make });
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

  /** Dentro da cerca? (`pad` > 0 = um pouco mais para dentro) */
  contains(p: Point, pad = 0): boolean {
    return !this.packed && insideShape(this.shape, p, FENCE_INSET + pad);
  }

  /** Um ponto livre ao acaso dentro do acampamento (para quem anda à toa). */
  randomInside(): Point {
    const h = halfOf(this.plan);
    const busy = this.busyCells();
    for (let k = 0; k < 30; k++) {
      const x = Math.floor(Math.random() * 2 * h) - h;
      const y = Math.floor(Math.random() * 2 * h) - h;
      if (!busy.has(`${x},${y}`)) return cellCenter(this.center, x, y);
    }
    return this.campfire;
  }

  /**
   * A célula livre mais perto de um ponto (fora das construções e da frente do portão), para
   * pôr seguidores, carroças e quem dorme ao relento. `skip` = quantas livres pular.
   */
  openNear(p: Point, skip = 0, avoid: ReadonlySet<string> = new Set()): Point {
    const h = halfOf(this.plan);
    const busy = this.busyCells();
    const [px, py] = cellAt(this.center, p);
    const free: { x: number; y: number; d: number }[] = [];
    for (let y = -h + 1; y < h - 1; y++) {
      for (let x = -h + 1; x < h - 1; x++) {
        if (busy.has(`${x},${y}`) || avoid.has(`${x},${y}`)) continue;
        free.push({ x, y, d: Math.hypot(x - px, y - py) });
      }
    }
    free.sort((a, b) => a.d - b.d);
    const c = free[Math.min(skip, free.length - 1)];
    return c ? cellCenter(this.center, c.x, c.y) : this.campfire;
  }

  /** Células ocupadas por construções, pela frente do portão e pelas portas. */
  private busyCells(): Set<string> {
    const out = new Set<string>();
    for (const b of this.plan.buildings) for (const [x, y] of cellsOf(b)) out.add(`${x},${y}`);
    for (const [x, y] of gateLane(this.plan)) out.add(`${x},${y}`);
    for (const d of this.doors.values()) {
      const [x, y] = cellAt(this.center, d);
      out.add(`${x},${y}`);
    }
    return out;
  }

  /** As barracas da planta, na ordem: a barraca i é o alojamento do batalhão i. */
  private barracks(): CampBuilding[] {
    return this.plan.buildings.filter((b) => b.kind === "BARRACK");
  }

  /** Posição (no mundo) do alojamento do batalhão de índice `i`: a porta da barraca dele, ou um canto ao relento. */
  quarterSlot(i: number): Point | null {
    if (this.packed) return null;
    const bar = this.barracks();
    if (i < bar.length) return this.doors.get(bar[i].id) ?? this.rectOf(bar[i]).center;
    // Sem leito: o batalhão dorme no chão, perto da fogueira
    return this.openNear(this.campfire, (i - bar.length) * 3 + 2);
  }

  /** Onde as carroças ficam estacionadas: junto da intendência, ou logo depois do portão. */
  wagonPark(i: number): Point {
    const qm = this.siteBuilding("QUARTERMASTER");
    const from = qm ? this.rectOf(qm).center : this.gateInside;
    return this.openNear(from, i * 2);
  }

  /**
   * Colisões do Comandante: construções, a fogueira e a cerca (só se entra e sai pelo portão).
   * `prev` = posição antes do movimento deste quadro.
   */
  collide(c: Commander, prev: Point): void {
    if (this.packed) return;
    const r = c.radius;
    const s = this.shape;
    if (Math.abs(c.x - s.cx) > s.half + 80 || Math.abs(c.y - s.cy) > s.half + 80) return;
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
    // Cerca: cruzá-la fora do portão desfaz o passo
    const wasIn = insideShape(s, prev);
    const isIn = insideShape(s, c);
    if (wasIn !== isIn && !onGate(s, c) && !onGate(s, prev)) {
      c.x = prev.x;
      c.y = prev.y;
    }
  }

  /** Rota pelo acampamento desviando das construções e da fogueira (caminhada por clique). */
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

  // --- A peça fantasma (modo construção) ---

  /** A célula de canto que fica sob o ponteiro para uma peça de `kind` (centrada no ponteiro). */
  cellUnder(p: Point, kind: CampKind): [number, number] {
    const k = CAMP_BUILDINGS[kind].size;
    return cellAt(this.center, { x: p.x - ((k - 1) * CELL) / 2, y: p.y - ((k - 1) * CELL) / 2 });
  }

  /** Mostra a peça fantasma: verde se cabe, vermelha se não, com o custo (ou o motivo) ao lado. */
  showGhost(kind: CampKind, x: number, y: number, problem: string | null, price: boolean): void {
    const k = CAMP_BUILDINGS[kind].size;
    const r = cellRect(this.center, x, y, k);
    if (!this.ghost) this.ghost = this.scene.add.graphics().setDepth(19);
    if (!this.ghostText) {
      this.ghostText = this.scene.add
        .text(0, 0, "", { fontFamily: "monospace", fontSize: "13px", color: "#ffffff", stroke: "#000000", strokeThickness: 3, align: "left" })
        .setOrigin(0, 0.5)
        .setDepth(21);
    }
    const ok = problem === null;
    const g = this.ghost.clear().setVisible(true);
    // A grade em volta (só as células de dentro), para ajudar a mirar
    g.lineStyle(1, 0xffffff, 0.12);
    const h = halfOf(this.plan);
    for (let i = -h; i <= h; i++) {
      g.lineBetween(this.center.x + i * CELL, this.center.y - h * CELL, this.center.x + i * CELL, this.center.y + h * CELL);
      g.lineBetween(this.center.x - h * CELL, this.center.y + i * CELL, this.center.x + h * CELL, this.center.y + i * CELL);
    }
    const color = ok ? 0x5fd35f : 0xe05050;
    g.fillStyle(color, 0.32).fillRect(r.x, r.y, r.w, r.h);
    g.lineStyle(2, color, 0.95).strokeRect(r.x, r.y, r.w, r.h);
    const def = CAMP_BUILDINGS[kind];
    const cost = price ? costText(def.cost) : "mudar de lugar";
    this.ghostText
      .setPosition(r.x + r.w + 10, r.y + r.h / 2)
      .setText(`${def.label}\n${ok ? cost : problem}`)
      .setColor(ok ? "#c6ff8a" : "#ff9a8a")
      .setVisible(true);
  }

  hideGhost(): void {
    this.ghost?.setVisible(false);
    this.ghostText?.setVisible(false);
  }

  // --- Desenho: peças de pixel art (G3) em cada célula da planta ---

  private rectOf(b: Pick<CampBuilding, "kind" | "x" | "y">): Rect & { center: Point } {
    const r = cellRect(this.center, b.x, b.y, CAMP_BUILDINGS[b.kind].size);
    return { ...r, center: { x: r.x + r.w / 2, y: r.y + r.h / 2 } };
  }

  /**
   * A cerca: na paliçada, estacas juntas ao longo dos quatro lados (mais grossas na média e na
   * grande), com as torres do portão; no bivaque, estacas espaçadas com corda.
   */
  private drawFence(): void {
    const palisade = tierOf(this.plan) >= 1;
    const reinforced = this.plan.size >= 22;
    const step = palisade ? STAKE : BIVOUAC_STAKE;
    for (const [x0, y0, x1, y1] of fenceRuns(this.shape)) {
      const len = Math.hypot(x1 - x0, y1 - y0);
      const n = Math.max(1, Math.round(len / step));
      let group: Point[] = [];
      const flush = () => {
        if (group.length === 0) return;
        const gx = Math.min(...group.map((p) => p.x));
        const gy = Math.min(...group.map((p) => p.y));
        const gy1 = Math.max(...group.map((p) => p.y));
        const pts = group.map((p) => ({ x: p.x - gx, y: p.y - gy }));
        const seed = Math.round(gx * 31 + gy);
        this.foot(this.artJobs, gx, gy, gy1 - gy, () => stakesPiece(pts, this.culture, seed, reinforced));
        group = [];
      };
      for (let i = 0; i <= n; i++) {
        const t = i / n;
        group.push({ x: x0 + (x1 - x0) * t, y: y0 + (y1 - y0) * t });
        if (group.length >= (palisade ? STAKE_GROUP : 1)) flush();
      }
      flush();
    }
    const gate = gatePoints(this.shape, 0);
    const across = this.shape.gate === "W" || this.shape.gate === "E" ? { x: 0, y: 1 } : { x: 1, y: 0 };
    const g = this.shape.gateHalf + 30;
    if (palisade) {
      // Torres dos dois lados do portão (sólidas)
      for (const side of [-1, 1]) {
        const t = { x: gate.inner.x + across.x * g * side, y: gate.inner.y + across.y * g * side };
        this.foot(this.artJobs, t.x - 24, t.y - 24, 48, () => towerPiece(48, false, this.culture, Math.round(t.x + t.y), false));
        this.obstacles.push(new Phaser.Geom.Rectangle(t.x - 24, t.y - 24, 48, 48));
      }
    }
    // Estandartes no portão
    const out = gatePoints(this.shape, 30).outer;
    for (const side of [-1, 1]) this.anchor(this.artJobs, out.x + across.x * (g - 6) * side, out.y + across.y * (g - 6) * side, () => bannerPiece(COLORS.ALLY, false));
    const top = { x: this.shape.cx, y: this.shape.cy - this.shape.half - 46 };
    const label = palisade ? "ACAMPAMENTO" : "BIVAQUE";
    this.planObjects.push(worldLabel(this.scene, top.x, top.y, label, "#ffe9b0"));
  }

  private drawBuilding(b: CampBuilding): void {
    const r = this.rectOf(b);
    const def = CAMP_BUILDINGS[b.kind];
    const c = this.culture;
    const jobs = this.artJobs;
    // O desenho fica dentro do quadrado das células, com uma folga
    const pad = 6;
    const box = { x: r.x + pad, y: r.y + pad, w: r.w - pad * 2, h: r.h - pad * 2 };
    const solid = () => this.obstacles.push(new Phaser.Geom.Rectangle(box.x + 4, box.y + box.h * 0.35, box.w - 8, box.h * 0.65 - 2));
    const footed = (w: number, h: number, make: () => Piece) => this.foot(jobs, r.center.x - w / 2, box.y + box.h - h, h, make);
    const seed = b.x * 31 + b.y * 7;

    // Obra em andamento: estacas nos cantos, a madeira empilhada e o rótulo com o trabalho que falta
    if (!isBuilt(b)) {
      for (const [fx, fy] of [[box.x + 4, box.y + 10], [box.x + box.w - 4, box.y + 10], [box.x + 4, box.y + box.h - 2], [box.x + box.w - 4, box.y + box.h - 2]]) {
        this.anchor(jobs, fx, fy, () => postsPiece(seed + fx));
      }
      this.foot(jobs, r.center.x - 20, r.center.y - 6, 20, () => campPropPiece("WOODPILE", c, seed, 40, 20));
      this.anchor(jobs, r.center.x + 16, r.center.y + 18, () => propPiece("CRATE", c, seed));
      this.obstacles.push(new Phaser.Geom.Rectangle(r.center.x - 22, r.center.y - 8, 44, 24));
      const label = planLabel(this.scene, r, `${def.label}
obra ${b.built ?? 0}/${workOf(b.kind)}`, "#ffd27a");
      this.workLabels.set(b.id, label);
      this.planObjects.push(label);
      this.interactables.push({
        label: `${def.label} (em obra)`,
        door: this.doors.get(b.id) ?? r.center,
        panel: { kind: "CAMP_BUILDING", buildingId: b.id },
        bounds: new Phaser.Geom.Rectangle(r.x, r.y, r.w, r.h),
        radius: INTERACT_RADIUS,
      });
      return;
    }

    switch (b.kind) {
      case "COMMAND_TENT":
        footed(box.w, box.h * 0.7, () => tentPiece(Math.round(box.w), Math.round(box.h * 0.7), CAMP_COLORS.COMMAND_TENT, 0xb8902c, 41));
        this.anchor(jobs, box.x + box.w + 2, box.y + box.h - 4, () => bannerPiece(CAMP_COLORS.BANNER, true, 74));
        solid();
        break;
      case "CAMPFIRE": {
        const fr = 26;
        this.foot(jobs, r.center.x - fr, r.center.y - fr, 2 * fr, () => bonfirePiece(fr, 5));
        // A chama (forma simples, pisca) por cima da lenha: quem está atrás da fogueira some atrás dela
        const flame = this.scene.add.graphics({ x: r.center.x, y: r.center.y - 6 }).setDepth((r.center.y + fr) * 1e-6 + 1e-7);
        flame.fillStyle(CAMP_COLORS.FIRE, 0.9);
        flame.fillCircle(0, 0, 11);
        flame.fillStyle(CAMP_COLORS.FIRE_CORE, 1);
        flame.fillCircle(0, 2, 5);
        this.scene.tweens.add({ targets: flame, scale: 1.25, alpha: 0.75, duration: 280, yoyo: true, repeat: -1, ease: "Sine.easeInOut" });
        this.planObjects.push(flame);
        break;
      }
      case "BARRACK":
        footed(box.w * 0.85, box.h * 0.6, () => tentPiece(Math.round(box.w * 0.85), Math.round(box.h * 0.6), CAMP_COLORS.CANVAS, null, seed));
        solid();
        break;
      case "OFFICERS_TENT":
        footed(box.w * 0.9, box.h * 0.62, () => tentPiece(Math.round(box.w * 0.9), Math.round(box.h * 0.62), CAMP_COLORS.OFFICERS, 0xdfe3ee, seed));
        this.anchor(jobs, box.x + box.w - 4, box.y + box.h - 6, () => bannerPiece(0xdfe3ee, true, 56));
        solid();
        break;
      case "INFIRMARY":
        footed(box.w * 0.9, box.h * 0.62, () => tentPiece(Math.round(box.w * 0.9), Math.round(box.h * 0.62), CAMP_COLORS.INFIRMARY, 0xa83232, seed));
        solid();
        break;
      case "RECRUIT_MAST":
        // O mastro alto com o estandarte do bando e um banco para quem chega
        this.anchor(jobs, r.center.x, r.center.y + 10, () => bannerPiece(COLORS.ALLY, false, 78, 26));
        this.foot(jobs, r.center.x - 18, r.center.y + 14, 10, () => propPiece("CRATE", c, seed));
        this.obstacles.push(new Phaser.Geom.Rectangle(r.center.x - 8, r.center.y - 4, 16, 18));
        break;
      case "QUARTERMASTER":
        footed(box.w * 0.85, box.h * 0.5, () => wagonPiece(Math.round(box.w * 0.85), Math.round(box.h * 0.5), c, 42));
        this.foot(jobs, box.x, box.y, 22, () => campPropPiece("WOODPILE", c, 12, Math.round(box.w * 0.5), 22));
        for (const k of [0, 1]) this.anchor(jobs, box.x + box.w - 10 - k * 16, box.y + 26, () => propPiece("BARREL", c, seed + k));
        solid();
        break;
      case "RECRUIT_POST":
        footed(box.w * 0.8, box.h * 0.5, () => tablePiece(Math.round(box.w * 0.8), Math.round(box.h * 0.5), c));
        this.anchor(jobs, box.x + box.w - 2, box.y + box.h - 4, () => bannerPiece(COLORS.ALLY, false, 70));
        solid();
        break;
      case "TRAINING":
      case "ARCHERY":
        this.drawYard(b, box);
        break;
      case "STABLE":
        footed(box.w, box.h * 0.6, () => stablePiece(Math.round(box.w), Math.round(box.h * 0.6), c, 43));
        this.foot(jobs, box.x, box.y, 18, () => campPropPiece("HAY", c, seed, 28, 18));
        solid();
        break;
      case "FORGE": {
        const fw = Math.round(box.w * 0.85);
        const fh = Math.round(box.h * 0.7);
        footed(fw, fh, () => forgePiece(fw, fh, c, 44));
        // A brasa do fogão pisca (por cima da ferraria, que fica atrás de quem passa na frente)
        const at = forgeGlow(fw);
        const glow = this.scene.add.graphics({ x: r.center.x - fw / 2 + at.x, y: box.y + box.h - fh + at.y }).setDepth((box.y + box.h) * 1e-6 + 1e-7);
        glow.fillStyle(CAMP_COLORS.FIRE, 0.55);
        glow.fillCircle(0, 0, 7);
        this.scene.tweens.add({ targets: glow, alpha: 0.25, duration: 500, yoyo: true, repeat: -1 });
        this.planObjects.push(glow);
        solid();
        break;
      }
      case "KITCHEN":
        // Fogão de pedra com o caldeirão, a lenha e o varal das panelas
        this.anchor(jobs, r.center.x, r.center.y + 6, () => propPiece("FIRE", c, seed));
        this.anchor(jobs, box.x + 12, box.y + box.h - 8, () => propPiece("RACK", c, seed));
        this.foot(jobs, box.x + box.w - 44, box.y + 4, 20, () => campPropPiece("WOODPILE", c, seed, 40, 20));
        this.anchor(jobs, box.x + box.w - 12, box.y + box.h - 8, () => propPiece("BARREL", c, seed + 1));
        this.obstacles.push(new Phaser.Geom.Rectangle(r.center.x - 20, r.center.y - 14, 40, 28));
        break;
      case "WELL":
        this.foot(jobs, r.center.x - 20, r.center.y - 20, 40, () => wellPiece(20, c, seed, false));
        this.obstacles.push(new Phaser.Geom.Rectangle(r.center.x - 22, r.center.y - 22, 44, 44));
        break;
      case "TOWER":
        this.foot(jobs, box.x, box.y, box.h, () => towerPiece(Math.round(box.w), false, c, seed, false));
        this.obstacles.push(new Phaser.Geom.Rectangle(box.x, box.y, box.w, box.h));
        this.torches.push(r.center);
        break;
      // --- Parte 2 ---
      case "OVEN":
        // O forno de barro (uma cabana baixa) com a brasa na boca e os sacos de farinha
        footed(box.w * 0.7, box.h * 0.55, () => hutPiece(Math.round(box.w * 0.7), Math.round(box.h * 0.55), seed));
        this.anchor(jobs, box.x + box.w - 8, box.y + box.h - 4, () => propPiece("CRATE", c, seed));
        this.torches.push({ x: r.center.x, y: r.center.y + 4 });
        solid();
        break;
      case "SMOKEHOUSE":
        footed(box.w * 0.8, box.h * 0.6, () => hutPiece(Math.round(box.w * 0.8), Math.round(box.h * 0.6), seed + 3));
        this.anchor(jobs, box.x + 6, box.y + box.h - 4, () => propPiece("RACK", c, seed));
        solid();
        break;
      case "LATRINE":
        footed(box.w * 0.5, box.h * 0.45, () => hutPiece(Math.round(box.w * 0.5), Math.round(box.h * 0.45), seed + 5));
        this.obstacles.push(new Phaser.Geom.Rectangle(r.center.x - box.w * 0.25, r.center.y - 6, box.w * 0.5, box.h * 0.4));
        break;
      case "HERBALIST":
        footed(box.w * 0.85, box.h * 0.55, () => stallPiece(Math.round(box.w * 0.85), Math.round(box.h * 0.55), 0x4f7a3a, c, seed));
        for (const k of [0, 1]) this.anchor(jobs, box.x + 8 + k * 18, box.y + box.h, () => bushPiece(seed + k, "SUMMER"));
        solid();
        break;
      case "CAPTAIN_TENT":
        footed(box.w * 0.9, box.h * 0.62, () => tentPiece(Math.round(box.w * 0.9), Math.round(box.h * 0.62), 0x6a3a7a, 0xe0b040, seed));
        this.anchor(jobs, box.x + box.w - 4, box.y + box.h - 6, () => bannerPiece(0x6a3a7a, true, 56));
        solid();
        break;
      case "CAMP_TAVERN":
        footed(box.w * 0.9, box.h * 0.6, () => tentPiece(Math.round(box.w * 0.9), Math.round(box.h * 0.6), 0xa8742e, 0x6b4a2b, seed));
        for (const k of [0, 1, 2]) this.anchor(jobs, box.x + 10 + k * 16, box.y + box.h + 2, () => propPiece("BARREL", c, seed + k));
        solid();
        break;
      case "DICE":
        footed(box.w * 0.7, box.h * 0.45, () => tablePiece(Math.round(box.w * 0.7), Math.round(box.h * 0.45), c));
        this.anchor(jobs, box.x + 6, box.y + box.h - 2, () => propPiece("BARREL", c, seed));
        solid();
        break;
      case "STANDARD":
        this.anchor(jobs, r.center.x, r.center.y + 14, () => bannerPiece(COLORS.ALLY, false, 92, 30));
        this.obstacles.push(new Phaser.Geom.Rectangle(r.center.x - 6, r.center.y + 4, 12, 12));
        break;
      case "TROPHY":
        this.anchor(jobs, r.center.x, r.center.y + 14, () => totemPiece(seed, 0x8e2b22));
        this.anchor(jobs, r.center.x + 16, r.center.y + 16, () => bannerPiece(0x5a5a5a, true, 50, 18));
        this.obstacles.push(new Phaser.Geom.Rectangle(r.center.x - 8, r.center.y + 2, 16, 14));
        break;
      case "CEMETERY":
        for (let k = 0; k < 6; k++) this.anchor(jobs, box.x + 14 + (k % 3) * ((box.w - 28) / 2), box.y + 30 + Math.floor(k / 3) * (box.h * 0.45), () => gravePiece(k % 3, seed + k));
        this.foot(jobs, box.x, box.y + box.h, 0, () => fencePiece(box.w, true, [[box.w * 0.35, box.w * 0.65]], c));
        break;
      case "STORY_FIRE": {
        const fr = 18;
        this.foot(jobs, r.center.x - fr, r.center.y - fr, 2 * fr, () => bonfirePiece(fr, seed));
        for (const [dx, dy] of [[-30, 12], [30, 12], [0, 30]]) this.anchor(jobs, r.center.x + dx, r.center.y + dy, () => propPiece("CRATE", c, seed + dx));
        this.torches.push(r.center);
        this.obstacles.push(new Phaser.Geom.Rectangle(r.center.x - fr, r.center.y - fr / 2, 2 * fr, fr));
        break;
      }
      case "ALTAR":
        this.anchor(jobs, r.center.x, r.center.y + 10, () => tombPiece(seed));
        for (const dx of [-24, 24]) this.anchor(jobs, r.center.x + dx, r.center.y + 14, () => brazierPiece(false));
        this.torches.push(r.center);
        this.obstacles.push(new Phaser.Geom.Rectangle(r.center.x - 16, r.center.y - 4, 32, 18));
        break;
      case "CARPENTRY":
        footed(box.w * 0.85, box.h * 0.55, () => stallPiece(Math.round(box.w * 0.85), Math.round(box.h * 0.55), 0x8a6a3a, c, seed));
        this.foot(jobs, box.x, box.y, 20, () => campPropPiece("WOODPILE", c, seed, Math.round(box.w * 0.6), 20));
        this.anchor(jobs, box.x + box.w - 10, box.y + box.h + 2, () => propPiece("CRATE", c, seed + 1));
        solid();
        break;
      case "SADDLERY":
        footed(box.w * 0.85, box.h * 0.55, () => stallPiece(Math.round(box.w * 0.85), Math.round(box.h * 0.55), 0x7a4a2a, c, seed));
        this.anchor(jobs, box.x + 10, box.y + box.h + 2, () => propPiece("RACK", c, seed));
        solid();
        break;
      case "TAILOR":
        footed(box.w * 0.85, box.h * 0.55, () => stallPiece(Math.round(box.w * 0.85), Math.round(box.h * 0.55), COLORS.ALLY, c, seed));
        solid();
        break;
      case "LUMBER":
        this.foot(jobs, box.x, box.y + 6, 22, () => campPropPiece("WOODPILE", c, seed, Math.round(box.w), 22));
        this.anchor(jobs, r.center.x, box.y + box.h, () => propPiece("RACK", c, seed));
        this.obstacles.push(new Phaser.Geom.Rectangle(box.x, box.y + 6, box.w, 24));
        break;
      case "GARDEN": {
        // Os canteiros e o curral (aberto: dá para andar entre os canteiros)
        for (let k = 0; k < 6; k++) this.anchor(jobs, box.x + 14 + (k % 3) * ((box.w - 28) / 2), box.y + 26 + Math.floor(k / 3) * 34, () => bushPiece(seed + k, "SUMMER"));
        this.foot(jobs, box.x, box.y + box.h, 0, () => fencePiece(box.w, true, [[box.w * 0.4, box.w * 0.6]], c));
        this.foot(jobs, box.x + box.w - 40, box.y + box.h - 30, 18, () => campPropPiece("HAY", c, seed, 30, 18));
        break;
      }
      case "RIDING":
      case "PEN":
        this.drawYard(b, box);
        if (b.kind === "PEN") solid();
        break;
      case "ARSENAL":
        footed(box.w * 0.85, box.h * 0.55, () => stallPiece(Math.round(box.w * 0.85), Math.round(box.h * 0.55), 0x5a5f6a, c, seed));
        for (const k of [0, 1]) this.anchor(jobs, box.x + 10 + k * 18, box.y + box.h + 2, () => propPiece("RACK", c, seed + k));
        solid();
        break;
      case "MAP_TENT":
        footed(box.w * 0.85, box.h * 0.6, () => tentPiece(Math.round(box.w * 0.85), Math.round(box.h * 0.6), 0x7a6a4a, 0x2e4e6a, seed));
        solid();
        break;
      case "CALTROPS":
        for (const dy of [12, 36, 60]) this.foot(jobs, box.x, box.y + dy, 8, () => spikesPiece(Math.round(box.w), seed + dy));
        break;
      case "SENTRY":
        this.anchor(jobs, r.center.x, r.center.y + 16, () => postsPiece(seed));
        this.anchor(jobs, r.center.x + 10, r.center.y + 14, () => bannerPiece(CAMP_COLORS.BANNER, true, 60, 16));
        this.anchor(jobs, r.center.x - 14, r.center.y + 14, () => campPropPiece("TORCH", c, seed));
        this.torches.push({ x: r.center.x - 14, y: r.center.y - 6 });
        this.obstacles.push(new Phaser.Geom.Rectangle(r.center.x - 10, r.center.y + 2, 20, 14));
        break;
    }

    // Tochas nas portas das construções grandes
    const door = this.doors.get(b.id);
    if (door && def.size >= 3 && !OPEN_YARD.has(b.kind)) {
      const tx = door.x + CELL * 0.6;
      this.anchor(jobs, tx, door.y, () => campPropPiece("TORCH", c, seed));
      this.torches.push({ x: tx, y: door.y - 20 });
    }

    // O rótulo e o ponto de conversa (as barracas são dos batalhões: ver buildQuarters)
    if (b.kind === "CAMPFIRE" || b.kind === "BARRACK") return;
    const level = def.upgrades ? ` · Nv ${b.level}` : "";
    this.planObjects.push(planLabel(this.scene, r, `${def.label}${level}`, "#ffe9b0"));
    const site = SITE_OF[b.kind];
    const panel: CampPanel = site ? { kind: site, buildingId: b.id } : { kind: "CAMP_BUILDING", buildingId: b.id };
    this.interactables.push({
      label: def.label,
      door: door ?? r.center,
      panel,
      bounds: new Phaser.Geom.Rectangle(r.x, r.y, r.w, r.h),
      radius: INTERACT_RADIUS,
      // Tudo o que tem teto e já tinha interior se entra (o campo de treino é a céu aberto)
      enter: site && site !== "TRAINING" ? `camp:${site}` : undefined,
    });
  }

  /** Pátio cercado (campo de treino, estande de tiro): aberto do lado da porta, com bonecos ou alvos. */
  private drawYard(b: CampBuilding, box: Rect): void {
    const c = this.culture;
    const jobs = this.artJobs;
    const door = this.doors.get(b.id);
    const openSide = !door ? "S" : door.y > box.y + box.h ? "S" : door.y < box.y ? "N" : door.x < box.x ? "W" : "E";
    const gapOf = (len: number): [number, number][] => [[len * 0.3, len * 0.7]];
    this.foot(jobs, box.x, box.y, 0, () => fencePiece(box.w, true, openSide === "N" ? gapOf(box.w) : [], c));
    this.foot(jobs, box.x, box.y + box.h, 0, () => fencePiece(box.w, true, openSide === "S" ? gapOf(box.w) : [], c));
    for (const [fx, side] of [[box.x, "W"], [box.x + box.w, "E"]] as const) {
      this.foot(jobs, fx, box.y, box.h, () => fencePiece(box.h, false, openSide === side ? gapOf(box.h) : [], c));
    }
    const cx = box.x + box.w / 2;
    if (b.kind === "TRAINING") {
      for (const [dx, dy] of [[-40, -30], [0, -30], [40, -30], [-20, 16], [20, 16]]) this.anchor(jobs, cx + dx, box.y + box.h / 2 + dy + 14, () => propPiece("DUMMY", c, dx * 3 + dy));
    } else if (b.kind === "RIDING") {
      // Picadeiro: as balizas da volta e o feno
      for (const [dx, dy] of [[-44, -30], [44, -30], [-44, 30], [44, 30]]) this.anchor(jobs, cx + dx, box.y + box.h / 2 + dy + 10, () => postsPiece(dx + dy));
      this.foot(jobs, box.x + 6, box.y + 6, 18, () => campPropPiece("HAY", c, b.x, 28, 18));
    } else if (b.kind === "PEN") {
      for (const dx of [-24, 24]) this.anchor(jobs, cx + dx, box.y + box.h / 2 + 10, () => postsPiece(dx));
    } else {
      // Estande de tiro: os alvos numa fila no fundo, a linha de tiro na frente
      for (const dx of [-42, -14, 14, 42]) this.anchor(jobs, cx + dx, box.y + 30, () => propPiece("DUMMY", c, dx * 5 + b.level));
      this.anchor(jobs, box.x + 14, box.y + box.h - 10, () => propPiece("RACK", c, b.level));
    }
  }

  /**
   * (Re)desenha os alojamentos: o estandarte e o rótulo de cada batalhão na barraca dele (as tropas
   * de verdade ficam em forma diante dela quando estão no acampamento), quem não tem barraca ao
   * relento, e os tenentes sem comando na fogueira. `away` = batalhões fora do acampamento.
   */
  buildQuarters(state: Pick<GameState, "battalions" | "pendingMutiny" | "lieutenants">, away: ReadonlySet<string>): void {
    if (this.packed) return;
    for (const o of this.quarterObjects) o.destroy();
    this.quarterObjects = [];
    this.pathfinder = null; // obstáculos mudaram
    this.interactables.splice(
      0,
      this.interactables.length,
      ...this.interactables.filter((it) => it.panel.kind !== "BATTALION" && it.panel.kind !== "LIEUTENANT" && !(it.panel.kind === "CAMP_BUILDING" && this.isBarrack(it.panel.buildingId))),
    );
    this.obstacles = this.obstacles.filter((r) => !this.quarterRects.includes(r));
    this.quarterRects = [];
    this.quarterJobs = [];

    const { battalions, pendingMutiny, lieutenants } = state;
    const rebel = pendingMutiny ? mutinyLeader(battalions) : null;
    const bar = this.barracks();
    battalions.forEach((b, i) => this.buildQuarter(b, i, bar[i] ?? null, b.id === rebel?.id, away.has(b.id)));
    // Barracas vazias: esperam o próximo batalhão
    for (const b of bar.slice(battalions.length)) {
      const r = this.rectOf(b);
      this.quarterObjects.push(worldLabel(this.scene, r.center.x, r.y - 14, "Barraca vazia", "#bdb59a"));
      this.interactables.push({
        label: "Barraca vazia",
        door: this.doors.get(b.id) ?? r.center,
        panel: { kind: "CAMP_BUILDING", buildingId: b.id },
        bounds: new Phaser.Geom.Rectangle(r.x, r.y, r.w, r.h),
        radius: INTERACT_RADIUS,
      });
    }

    // Tenentes: junto ao alojamento do batalhão que comandam, ou sentados na fogueira
    let idleSeat = 0;
    for (const l of lieutenants) {
      const i = battalions.findIndex((b) => b.id === l.battalionId);
      const slot = i >= 0 ? this.quarterSlot(i) : null;
      if (slot) {
        // O tenente de verdade marcha com o batalhão; aqui fica só o ponto de conversa
        this.addLieutenantSpot(l, { x: slot.x + 56, y: slot.y + 6 }, false);
      } else if (i < 0) {
        const a = Math.PI * 0.15 + idleSeat++ * 0.55; // lado sul da fogueira
        this.addLieutenantSpot(l, { x: this.campfire.x + Math.cos(a) * 62, y: this.campfire.y + Math.sin(a) * 52 }, true);
      }
    }
    this.publishArt();
    this.onSolidsChanged?.();
  }

  private isBarrack(id: string): boolean {
    return this.plan.buildings.some((b) => b.id === id && b.kind === "BARRACK");
  }

  private addLieutenantSpot(l: LieutenantData, pos: Point, drawFigure: boolean): void {
    if (drawFigure) {
      // Sentado na roda da fogueira, virado para o fogo, com o anel prateado de tenente
      const fig = new Extra(this.scene, pos.x, pos.y, { ...troopLook("INFANTRY"), trim: 0xdfe3ee }, 8, COLORS.LIEUTENANT);
      const fire = this.campfire;
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

  /** O alojamento de um batalhão: a barraca dele (com o estandarte) ou um canto no chão, ao relento. */
  private buildQuarter(b: BattalionData, i: number, barrack: CampBuilding | null, mutinous: boolean, away: boolean): void {
    const slot = this.quarterSlot(i);
    if (!slot) return;
    const r = barrack ? this.rectOf(barrack) : null;
    const flag = r ? { x: r.x + r.w - 10, y: r.y + r.h - 10 } : { x: slot.x + 22, y: slot.y };
    this.anchor(this.quarterJobs, flag.x, flag.y, () => bannerPiece(mutinous ? COLORS.MUTINEER : COLORS.ALLY, false, 60));
    if (mutinous && r) {
      // A barraca dos amotinados ganha o pano roxo por cima
      this.foot(this.quarterJobs, r.center.x - r.w * 0.36, r.y + r.h - 6 - r.h * 0.5, r.h * 0.5, () => tentPiece(Math.round(r.w * 0.72), Math.round(r.h * 0.45), COLORS.MUTINEER, null, i));
    }
    const points = b.skillPoints > 0 ? `  +${b.skillPoints}` : "";
    const where = away ? "  (em campo)" : r ? "" : "  (ao relento)";
    const color = mutinous ? "#d7a6ff" : b.skillPoints > 0 ? "#c6ff8a" : r ? "#ffffff" : "#ffb08a";
    const labelY = r ? r.y - 14 : slot.y - 40;
    this.quarterObjects.push(worldLabel(this.scene, r ? r.center.x : slot.x, labelY, `${b.name} · Nv ${b.level}${points}${where}`, color));
    if (mutinous) this.quarterObjects.push(worldLabel(this.scene, r ? r.center.x : slot.x, labelY - 18, "MOTIM", "#ff6b6b"));

    this.interactables.push({
      label: r ? `Alojamento: ${b.name}` : `${b.name} (ao relento)`,
      door: slot,
      panel: { kind: "BATTALION", battalionId: b.id },
      bounds: r ? new Phaser.Geom.Rectangle(r.x, r.y, r.w, r.h + 40) : new Phaser.Geom.Rectangle(slot.x - 50, slot.y - 50, 100, 90),
      radius: INTERACT_RADIUS,
      enter: mutinous || !r ? undefined : `camp:Q:${b.id}`,
    });
  }
}
