import Phaser from "phaser";
import { Commander, type CommanderKeys } from "../entities/Commander";
import { drawRiderShape, drawTroopShape } from "../entities/shapes";
import {
  CAMP_HEIGHT,
  CAMP_SITES,
  CAMP_WIDTH,
  CAMPFIRE,
  COMMANDER_SPAWN,
  INTERACT_RADIUS,
  PALISADE,
  QUARTER_SLOTS,
  type CampSite,
} from "../data/campLayout";
import { Pathfinder } from "../world/Pathfinder";
import { fullName, type LieutenantData } from "../data/lieutenants";
import { mutinyLeader, useGameStore, type BattalionData, type CampPanel } from "../../store/useGameStore";
import { COLORS, TROOPS } from "../../utils/constants";
import { distance, type Point } from "../../utils/math";

type CampKeys = CommanderKeys & { E: Phaser.Input.Keyboard.Key; ESC: Phaser.Input.Keyboard.Key };

/** Raio sólido da fogueira (pedras em volta). */
const FIRE_RADIUS = 34;

/** Ponto de interação: um local fixo ou o alojamento de um batalhão. */
interface Interactable {
  label: string;
  door: Point;
  panel: CampPanel;
  /** Área clicável (coordenadas do mundo). */
  bounds: Phaser.Geom.Rectangle;
}

const CAMP_COLORS = {
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
  TEXT: "#ffffff",
} as const;

const label = (scene: Phaser.Scene, x: number, y: number, text: string, color = "#ffffff") =>
  scene.add
    .text(x, y, text, { fontFamily: "monospace", fontSize: "13px", color, stroke: "#000000", strokeThickness: 3 })
    .setOrigin(0.5)
    .setDepth(20);

/**
 * Acampamento explorável (greybox): o Comandante anda entre a tenda, a intendência,
 * o recrutamento, o campo de treino, a ferraria e os alojamentos dos batalhões.
 * Aproximar-se de um local mostra "E — ..."; interagir abre o painel React correspondente.
 */
export class CampScene extends Phaser.Scene {
  private commander!: Commander;
  private keys!: CampKeys;
  private interactables: Interactable[] = [];
  /** Retângulos sólidos (barracas, carroça, forja...) que o Comandante contorna. */
  private obstacles: Phaser.Geom.Rectangle[] = [];
  private quarterObjects: Phaser.GameObjects.GameObject[] = [];
  /** Caminhada por clique: pontos da rota (desviando de obstáculos) e o painel a abrir ao chegar. */
  private walkTarget: { path: Point[]; open?: CampPanel } | null = null;
  /** Rotas pelo acampamento; recriado quando os obstáculos mudam (alojamentos). */
  private pathfinder: Pathfinder | null = null;
  private nearest: Interactable | null = null;

  constructor() {
    super("CampScene");
  }

  create(): void {
    this.interactables = [];
    this.obstacles = [];
    this.quarterObjects = [];
    this.walkTarget = null;

    this.drawGround();
    this.drawCampfire();
    for (const site of CAMP_SITES) this.drawSite(site);
    this.buildQuarters();

    this.commander = new Commander(this, COMMANDER_SPAWN.x, COMMANDER_SPAWN.y);
    this.commander.setFacing(-Math.PI / 2);
    this.commander.setDepth(10);

    const cam = this.cameras.main;
    cam.setBounds(0, 0, CAMP_WIDTH, CAMP_HEIGHT);
    cam.startFollow(this.commander, true, 0.12, 0.12);

    this.setupInput();

    // Recrutar, reforçar, desertar ou um motim mudam os alojamentos na hora
    const unsubscribe = useGameStore.subscribe((s, prev) => {
      if (
        s.battalions !== prev.battalions ||
        s.pendingMutiny !== prev.pendingMutiny ||
        s.lieutenants !== prev.lieutenants ||
        s.scouts !== prev.scouts ||
        s.messengers !== prev.messengers
      ) {
        this.buildQuarters();
      }
    });
    // SHUTDOWN (troca de cena) ou DESTROY (o React desmonta o Phaser): sem isso a cena
    // destruída continuaria ouvindo o store e tentaria desenhar num Phaser que não existe mais
    const cleanup = () => {
      unsubscribe();
      useGameStore.getState().setCampPrompt(null);
    };
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, cleanup);
    this.events.once(Phaser.Scenes.Events.DESTROY, cleanup);

    if (import.meta.env.DEV) (window as unknown as { __camp?: CampScene }).__camp = this;
  }

  update(_time: number, delta: number): void {
    const dt = Math.min(delta, 50) / 1000;
    const store = useGameStore.getState();

    if (store.campPanel) {
      // Painel aberto: o Comandante fica parado
      this.commander.unitState = "IDLE";
      this.walkTarget = null;
    } else if (this.commander.handleMovement(this.keys, dt)) {
      this.walkTarget = null; // teclado cancela a caminhada por clique
    } else if (this.walkTarget) {
      const t = this.walkTarget;
      if (this.commander.moveTowards(t.path[0].x, t.path[0].y, dt)) {
        t.path.shift();
        this.lastWalkDist = Infinity;
        if (t.path.length === 0) {
          this.walkTarget = null;
          if (t.open) store.setCampPanel(t.open);
        }
      } else {
        this.commander.unitState = "MOVING";
      }
    }

    const before = { x: this.commander.x, y: this.commander.y };
    this.resolveCollisions();
    // Destino inalcançável (fora da paliçada, dentro de uma barraca): desiste em vez de empurrar para sempre
    if (this.walkTarget && distance(before, this.commander) > 0 && this.isStuck()) this.walkTarget = null;
    this.updatePrompt();
  }

  // --- Interação ---

  private setupInput(): void {
    const keyboard = this.input.keyboard;
    if (!keyboard) throw new Error("Teclado indisponível");
    this.keys = keyboard.addKeys("W,A,S,D,E,ESC") as CampKeys;

    this.keys.E.on("down", () => {
      const store = useGameStore.getState();
      if (store.campPanel) store.setCampPanel(null);
      else if (this.nearest) store.setCampPanel(this.nearest.panel);
    });
    this.keys.ESC.on("down", () => useGameStore.getState().setCampPanel(null));

    // Clique: no local → caminha até a porta e abre; no chão → caminha até lá
    this.input.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
      if (!pointer.leftButtonDown()) return;
      const store = useGameStore.getState();
      if (store.campPanel) store.setCampPanel(null);
      const hit = this.interactables.find((it) => it.bounds.contains(pointer.worldX, pointer.worldY));
      const goal = hit ? hit.door : { x: pointer.worldX, y: pointer.worldY };
      this.walkTarget = { path: this.getPathfinder().findPath(this.commander, goal), open: hit?.panel };
      this.lastWalkDist = Infinity;
      this.stuckFrames = 0;
    });
  }

  private getPathfinder(): Pathfinder {
    if (!this.pathfinder) {
      const inner = { rx: PALISADE.rx - 30 - this.commander.radius, ry: PALISADE.ry - 30 - this.commander.radius };
      this.pathfinder = new Pathfinder(
        this.obstacles,
        [{ x: CAMPFIRE.x, y: CAMPFIRE.y, r: FIRE_RADIUS }],
        this.commander.radius,
        (p) => Math.hypot((p.x - PALISADE.x) / inner.rx, (p.y - PALISADE.y) / inner.ry) <= 1,
      );
    }
    return this.pathfinder;
  }

  /** Sem progresso na caminhada por ~0,4 s (colisões desfazendo o passo). */
  private stuckFrames = 0;
  private lastWalkDist = Infinity;
  private isStuck(): boolean {
    if (!this.walkTarget) return false;
    const d = distance(this.commander, this.walkTarget.path[0]);
    this.stuckFrames = d > this.lastWalkDist - 0.5 ? this.stuckFrames + 1 : 0;
    this.lastWalkDist = d;
    if (this.stuckFrames > 24) {
      this.stuckFrames = 0;
      this.lastWalkDist = Infinity;
      return true;
    }
    return false;
  }

  private updatePrompt(): void {
    let best: Interactable | null = null;
    let bestDist = INTERACT_RADIUS;
    for (const it of this.interactables) {
      const d = distance(it.door, this.commander);
      if (d <= bestDist) {
        best = it;
        bestDist = d;
      }
    }
    this.nearest = best;
    const store = useGameStore.getState();
    store.setCampPrompt(best && !store.campPanel ? `E — ${best.label}` : null);
  }

  /** Mantém o Comandante dentro da paliçada e fora das barracas e estruturas. */
  private resolveCollisions(): void {
    const c = this.commander;
    const r = c.radius;
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
    // Fogueira
    const df = distance(c, CAMPFIRE);
    const fireR = FIRE_RADIUS + r;
    if (df < fireR && df > 0.001) {
      c.x = CAMPFIRE.x + ((c.x - CAMPFIRE.x) / df) * fireR;
      c.y = CAMPFIRE.y + ((c.y - CAMPFIRE.y) / df) * fireR;
    }
    // Paliçada (elipse interna)
    const ex = (c.x - PALISADE.x) / (PALISADE.rx - 30);
    const ey = (c.y - PALISADE.y) / (PALISADE.ry - 30);
    const k = Math.hypot(ex, ey);
    if (k > 1) {
      c.x = PALISADE.x + (c.x - PALISADE.x) / k;
      c.y = PALISADE.y + (c.y - PALISADE.y) / k;
    }
  }

  // --- Desenho (só primitivas) ---

  private drawGround(): void {
    const g = this.add.graphics().setDepth(-10);
    g.fillStyle(CAMP_COLORS.GRASS, 1);
    g.fillRect(0, 0, CAMP_WIDTH, CAMP_HEIGHT);
    g.fillStyle(CAMP_COLORS.DIRT, 1);
    g.fillEllipse(PALISADE.x, PALISADE.y, PALISADE.rx * 2 - 40, PALISADE.ry * 2 - 40, 96);

    // Trilhas da fogueira até cada local
    g.lineStyle(26, CAMP_COLORS.PATH, 0.6);
    for (const site of CAMP_SITES) g.lineBetween(CAMPFIRE.x, CAMPFIRE.y, site.door.x, site.door.y);
    g.lineBetween(CAMPFIRE.x, CAMPFIRE.y, PALISADE.x - PALISADE.rx, PALISADE.y); // até o portão

    // Paliçada: estacas ao longo da elipse, com um portão a oeste
    const posts = this.add.graphics().setDepth(-6);
    const n = 140;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const gateDiff = Math.abs(Math.atan2(Math.sin(a - PALISADE.gateAngle), Math.cos(a - PALISADE.gateAngle)));
      if (gateDiff < PALISADE.gateHalfWidth) continue;
      const x = PALISADE.x + Math.cos(a) * PALISADE.rx;
      const y = PALISADE.y + Math.sin(a) * PALISADE.ry;
      posts.fillStyle(CAMP_COLORS.POST, 1);
      posts.fillCircle(x, y, 9);
      posts.lineStyle(2, COLORS.OUTLINE, 0.8);
      posts.strokeCircle(x, y, 9);
    }

    // Árvores fora da paliçada
    const trees = this.add.graphics().setDepth(-7);
    const rnd = new Phaser.Math.RandomDataGenerator(["ascensao-acampamento"]);
    for (let i = 0; i < 90; i++) {
      const x = rnd.between(0, CAMP_WIDTH);
      const y = rnd.between(0, CAMP_HEIGHT);
      const k = Math.hypot((x - PALISADE.x) / (PALISADE.rx + 40), (y - PALISADE.y) / (PALISADE.ry + 40));
      if (k < 1) continue;
      trees.fillStyle(CAMP_COLORS.TREE, 1);
      trees.fillCircle(x, y, rnd.between(14, 26));
    }
  }

  private drawCampfire(): void {
    const g = this.add.graphics().setDepth(-4);
    // Pedras e lenha
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2;
      g.fillStyle(CAMP_COLORS.STONE, 1);
      g.fillCircle(CAMPFIRE.x + Math.cos(a) * 28, CAMPFIRE.y + Math.sin(a) * 28, 7);
    }
    g.lineStyle(7, CAMP_COLORS.WOOD, 1);
    g.lineBetween(CAMPFIRE.x - 18, CAMPFIRE.y - 10, CAMPFIRE.x + 18, CAMPFIRE.y + 10);
    g.lineBetween(CAMPFIRE.x - 18, CAMPFIRE.y + 10, CAMPFIRE.x + 18, CAMPFIRE.y - 10);

    const flame = this.add.graphics({ x: CAMPFIRE.x, y: CAMPFIRE.y }).setDepth(-3);
    flame.fillStyle(CAMP_COLORS.FIRE, 0.9);
    flame.fillCircle(0, 0, 15);
    flame.fillStyle(CAMP_COLORS.FIRE_CORE, 1);
    flame.fillCircle(0, 0, 7);
    this.tweens.add({ targets: flame, scale: 1.25, alpha: 0.75, duration: 280, yoyo: true, repeat: -1, ease: "Sine.easeInOut" });
  }

  private drawSite(site: CampSite): void {
    const g = this.add.graphics().setDepth(-2);
    const { x, y, w, h } = site;
    const solid = new Phaser.Geom.Rectangle(x - w / 2, y - h / 2, w, h);

    switch (site.kind) {
      case "TENT":
        this.drawTentShape(g, x, y, w, h, CAMP_COLORS.COMMAND_TENT);
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
        // Cercado de cavalos com cocho (os cavaleiros são desenhados em buildQuarters)
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
        const glow = this.add.graphics({ x: x + 18, y: y - 14 }).setDepth(-1);
        glow.fillStyle(CAMP_COLORS.FIRE, 1);
        glow.fillCircle(0, 0, 12);
        this.tweens.add({ targets: glow, alpha: 0.5, duration: 500, yoyo: true, repeat: -1 });
        this.obstacles.push(solid);
        break;
      }
    }

    label(this, x, y - h / 2 - 26, site.label, "#ffe9b0");
    this.interactables.push({
      label: site.label,
      door: site.door,
      panel: site.panel,
      bounds: new Phaser.Geom.Rectangle(x - w / 2 - 10, y - h / 2 - 10, w + 20, h + 20),
    });
  }

  /** Barraca vista de cima: lona com cumeeira e a porta voltada para o sul. */
  private drawTentShape(g: Phaser.GameObjects.Graphics, x: number, y: number, w: number, h: number, color: number): void {
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

  /** (Re)desenha os alojamentos: uma barraca, o estandarte e os soldados de cada batalhão. */
  private buildQuarters(): void {
    for (const o of this.quarterObjects) o.destroy();
    this.quarterObjects = [];
    this.pathfinder = null; // obstáculos mudaram
    this.interactables = this.interactables.filter((it) => it.panel.kind !== "BATTALION" && it.panel.kind !== "LIEUTENANT");
    this.obstacles = this.obstacles.filter((r) => !(r as Phaser.Geom.Rectangle & { quarter?: boolean }).quarter);

    const { battalions, pendingMutiny } = useGameStore.getState();
    const rebel = pendingMutiny ? mutinyLeader(battalions) : null;

    battalions.slice(0, QUARTER_SLOTS.length).forEach((b, i) => {
      const slot = QUARTER_SLOTS[i];
      this.buildQuarter(b, slot, b.id === rebel?.id);
    });

    // Batedores e mensageiros: cavalos no cercado do Estábulo
    const stable = CAMP_SITES.find((s) => s.kind === "STABLE");
    if (stable) {
      const { scouts, messengers } = useGameStore.getState();
      const riders = [
        ...scouts.map((r) => ({ color: COLORS.SCOUT, pennant: COLORS.SELECTION, name: r.name })),
        ...messengers.map((r) => ({ color: COLORS.MESSENGER, pennant: COLORS.PENNANT, name: r.name })),
      ];
      riders.forEach((r, i) => {
        const fx = stable.x - stable.w / 2 + 24 + (i % 4) * 34;
        const fy = stable.y - 6 + Math.floor(i / 4) * 30;
        const fig = this.add.graphics({ x: fx, y: fy }).setDepth(5);
        drawRiderShape(fig, r.color, 9, r.pennant);
        this.quarterObjects.push(fig);
      });
    }

    // Tenentes: junto ao alojamento do batalhão que comandam, ou perto da fogueira
    const { lieutenants } = useGameStore.getState();
    let idleSeat = 0;
    for (const l of lieutenants) {
      const i = battalions.findIndex((b) => b.id === l.battalionId);
      let pos: Point;
      if (i >= 0 && i < QUARTER_SLOTS.length) {
        pos = { x: QUARTER_SLOTS[i].x + 72, y: QUARTER_SLOTS[i].y + 18 };
      } else {
        const a = Math.PI * 0.15 + idleSeat++ * 0.55; // sentados em volta do fogo, do lado sul
        pos = { x: CAMPFIRE.x + Math.cos(a) * 70, y: CAMPFIRE.y + Math.sin(a) * 60 };
      }
      this.buildLieutenantFigure(l, pos);
    }
  }

  private buildLieutenantFigure(l: LieutenantData, pos: Point): void {
    const fig = this.add.graphics({ x: pos.x, y: pos.y }).setDepth(6);
    drawTroopShape(fig, "INFANTRY", 11);
    fig.lineStyle(3, COLORS.LIEUTENANT, 1);
    fig.strokeCircle(0, 0, 16);
    fig.rotation = Math.PI / 2;
    this.quarterObjects.push(fig);
    this.quarterObjects.push(label(this, pos.x, pos.y - 26, l.name, "#dfe3ee"));
    this.interactables.push({
      label: `Tenente ${fullName(l)}`,
      door: { x: pos.x, y: pos.y + 26 },
      panel: { kind: "LIEUTENANT", lieutenantId: l.id },
      bounds: new Phaser.Geom.Rectangle(pos.x - 20, pos.y - 34, 40, 54),
    });
  }

  private buildQuarter(b: BattalionData, slot: Point, mutinous: boolean): void {
    const tentY = slot.y - 55;
    const g = this.add.graphics().setDepth(-2);
    this.drawTentShape(g, slot.x, tentY, 80, 56, mutinous ? COLORS.MUTINEER : CAMP_COLORS.CANVAS);
    // Estandarte com a cor da tropa
    g.lineStyle(3, CAMP_COLORS.WOOD, 1);
    g.lineBetween(slot.x + 56, tentY - 30, slot.x + 56, tentY + 30);
    g.fillStyle(mutinous ? COLORS.MUTINEER : COLORS.ALLY, 1);
    g.fillRect(slot.x + 56, tentY - 30, 22, 16);
    this.quarterObjects.push(g);

    const tentRect = new Phaser.Geom.Rectangle(slot.x - 40, tentY - 28, 80, 56) as Phaser.Geom.Rectangle & { quarter?: boolean };
    tentRect.quarter = true;
    this.obstacles.push(tentRect);

    // Soldados em forma diante da barraca (4 por fileira), com leve "respiração"
    const r = TROOPS[b.troopType].stats.radius;
    for (let i = 0; i < b.soldiers; i++) {
      const fx = slot.x + ((i % 4) - 1.5) * 24;
      const fy = slot.y + 4 + Math.floor(i / 4) * 24;
      const fig = this.add.graphics({ x: fx, y: fy }).setDepth(5);
      drawTroopShape(fig, b.troopType, r, { mutinous });
      fig.rotation = Math.PI / 2; // olhando para o sul (para a fogueira/estrada)
      this.tweens.add({
        targets: fig,
        y: fy - 1.5,
        duration: 900 + Math.random() * 700,
        delay: Math.random() * 800,
        yoyo: true,
        repeat: -1,
        ease: "Sine.easeInOut",
      });
      this.quarterObjects.push(fig);
    }

    const points = b.skillPoints > 0 ? `  +${b.skillPoints}` : "";
    const name = label(this, slot.x, tentY - 44, `${b.name} · Nv ${b.level}${points}`, mutinous ? "#d7a6ff" : b.skillPoints > 0 ? "#c6ff8a" : "#ffffff");
    this.quarterObjects.push(name);
    if (mutinous) this.quarterObjects.push(label(this, slot.x, tentY - 62, "MOTIM", "#ff6b6b"));

    this.interactables.push({
      label: `Alojamento: ${b.name}`,
      door: { x: slot.x, y: slot.y },
      panel: { kind: "BATTALION", battalionId: b.id },
      bounds: new Phaser.Geom.Rectangle(slot.x - 60, tentY - 40, 140, 160),
    });
  }
}
