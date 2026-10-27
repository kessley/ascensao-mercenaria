import Phaser from "phaser";
import { Commander, type CommanderKeys } from "../entities/Commander";
import { Battalion } from "../entities/Battalion";
import { Enemy } from "../entities/Enemy";
import { Messenger, type MissionStop } from "../entities/Messenger";
import { Scout, type ScoutMode } from "../entities/Scout";
import { Unit } from "../entities/Unit";
import { resolveAttacks } from "../systems/CombatSystem";
import { FogOfWar, type VisionSource } from "../systems/FogOfWar";
import { updateMorale } from "../systems/MoraleSystem";
import { clampToWorld, separateUnits } from "../systems/MovementSystem";
import { layoutGroup } from "../systems/GroupLayout";
import { TerrainMap } from "../world/TerrainMap";
import { BATTLE_MAPS, type EnemyGroupDef } from "../data/battleMaps";
import {
  useGameStore,
  type BattleCommand,
  type BattleResult,
  type SupportReport,
  type TrumpetCall,
} from "../../store/useGameStore";
import {
  BALANCE,
  CAMERA,
  COLORS,
  FORMATIONS,
  SUPPORT,
  WORLD_HEIGHT,
  WORLD_WIDTH,
  type EnemyKind,
  type Formation,
} from "../../utils/constants";
import { startingMorale } from "../../utils/economy";
import { angleTo, centroid, distance, nearest, type Point } from "../../utils/math";

type BattleKeys = CommanderKeys & {
  SPACE: Phaser.Input.Keyboard.Key;
  F: Phaser.Input.Keyboard.Key;
  Q: Phaser.Input.Keyboard.Key;
  ESC: Phaser.Input.Keyboard.Key;
  ONE: Phaser.Input.Keyboard.Key;
  TWO: Phaser.Input.Keyboard.Key;
  THREE: Phaser.Input.Keyboard.Key;
  FOUR: Phaser.Input.Keyboard.Key;
  C: Phaser.Input.Keyboard.Key;
  H: Phaser.Input.Keyboard.Key;
  UP: Phaser.Input.Keyboard.Key;
  DOWN: Phaser.Input.Keyboard.Key;
  LEFT: Phaser.Input.Keyboard.Key;
  RIGHT: Phaser.Input.Keyboard.Key;
  R: Phaser.Input.Keyboard.Key;
};

const FORMATION_KEYS: [keyof BattleKeys, Formation][] = [
  ["ONE", "LINE"],
  ["TWO", "SHIELD_WALL"],
  ["THREE", "WEDGE"],
  ["FOUR", "LOOSE"],
];

const SCOUT_MODE_LABEL: Record<ScoutMode, string> = {
  VANGUARD: "Vanguarda",
  EXPLORE: "Explorar",
  RECALL: "Recolher",
};

/** Arrasto menor que isto (px de mundo) conta como clique, não como caixa de seleção. */
const DRAG_THRESHOLD = 6;
const FEED_SIZE = 5;

function isShiftHeld(pointer: Phaser.Input.Pointer): boolean {
  return (pointer.event as MouseEvent | undefined)?.shiftKey ?? false;
}

/** Quem pode receber ordens (batalhão ou batedor). */
type OrderRecipient = Battalion | Scout;

/**
 * Natureza da ordem, que define por qual meio ela pode chegar:
 * COMPLEX (ponto, alvo, foco, arranjo) só por voz ou mensageiro; BASIC também por trombeta;
 * VISUAL (formação) também por estandarte; BASIC_VISUAL (seguir/reunir) por qualquer um.
 */
type OrderChannel = "COMPLEX" | "BASIC" | "VISUAL" | "BASIC_VISUAL";
type Reach = "VOICE" | "TRUMPET" | "BANNER";

/** Entrega que precisa de mensageiro, aguardando o fim do lote para ser agrupada. */
interface PendingDelivery {
  order: string;
  stop: MissionStop;
  recipient: OrderRecipient;
}

const TRUMPET_LABEL: Record<TrumpetCall, string> = {
  ADVANCE: "Avançar",
  HALT: "Alto",
  CHARGE: "Carregar",
  RETREAT: "Recuar",
  RALLY: "Reunir ao estandarte",
};

export class BattleScene extends Phaser.Scene {
  private commander!: Commander;
  private battalions: Battalion[] = [];
  private scouts: Scout[] = [];
  private messengers: Messenger[] = [];
  private enemies: Enemy[] = [];
  private enemiesTotal = 0;
  private keys!: BattleKeys;
  private lastHudAt = 0;
  private lastFogAt = -Infinity;
  private ended = false;
  private dragStart: Point | null = null;
  /** Assinatura de quem está seguindo o Comandante (ver assignFollowSlots). */
  private followKey = "";
  private selectionBox!: Phaser.GameObjects.Graphics;

  private fog!: FogOfWar;
  /** Último lugar e momento em que cada inimigo foi visto (fantasmas na névoa). */
  private lastSeen = new Map<Enemy, { x: number; y: number; t: number }>();
  private ghostGfx!: Phaser.GameObjects.Graphics;
  private commandRing!: Phaser.GameObjects.Graphics;
  private missionGfx!: Phaser.GameObjects.Graphics;
  private feed: string[] = [];
  private deadScoutIds: string[] = [];
  private deadMessengerIds: string[] = [];

  /** Câmera presa no Comandante (padrão) ou solta para comandar a distância. */
  private cameraLocked = true;
  /** Arrasto com o botão do meio: ponto inicial da tela e da câmera. */
  private panDrag: { x: number; y: number; scrollX: number; scrollY: number } | null = null;
  /** O mouse se moveu dentro do jogo e não saiu (evita rolar pela borda com posição velha). */
  private pointerInGame = false;
  /** Entregas por mensageiro acumuladas durante uma ordem em grupo (ver withOrderBatch). */
  private pendingBatch: PendingDelivery[] | null = null;
  private lastTrumpetFx = -Infinity;
  private lastBannerFx = -Infinity;
  private warCryAt = -Infinity;

  constructor() {
    super("BattleScene");
  }

  create(): void {
    this.battalions = [];
    this.scouts = [];
    this.messengers = [];
    this.enemies = [];
    this.ended = false;
    this.lastHudAt = 0;
    this.lastFogAt = -Infinity;
    this.dragStart = null;
    this.lastSeen = new Map();
    this.feed = [];
    this.deadScoutIds = [];
    this.deadMessengerIds = [];
    this.cameraLocked = true;
    this.panDrag = null;
    this.pointerInGame = false;
    this.lastTrumpetFx = -Infinity;
    this.lastBannerFx = -Infinity;
    this.warCryAt = -Infinity;

    // A batalha (mapa, inimigos) vem do contrato aceito ou do motim
    const store = useGameStore.getState();
    const setup = store.currentBattle?.setup ?? BATTLE_MAPS.GOBLIN_NEST;

    this.drawGround();
    const terrain = new TerrainMap(setup.terrain);
    terrain.draw(this);
    Unit.terrain = terrain;
    const cleanup = () => {
      if (Unit.terrain === terrain) Unit.terrain = null;
    };
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, cleanup);
    this.events.once(Phaser.Scenes.Events.DESTROY, cleanup);

    const { x: startX, y: startY } = setup.start;
    this.commander = new Commander(this, startX, startY);
    this.commandRing = this.add.graphics().setDepth(-3);
    this.drawCommandRing();

    // Fome e salários atrasados: os batalhões já entram na batalha desanimados
    const morale = startingMorale(store.hungryDays, store.arrearsWeeks).value;
    this.battalions = store.battalions.map((data, i) => {
      const lieutenant = store.lieutenants.find((l) => l.battalionId === data.id) ?? null;
      const y = startY + (i - (store.battalions.length - 1) / 2) * 130;
      const b = new Battalion(this, data, startX - 90, y, this.commander, lieutenant);
      b.morale = morale;
      return b;
    });
    this.followKey = "";
    this.assignFollowSlots();

    // Batedores à frente; mensageiros na escolta do Comandante
    this.scouts = store.scouts.map((data, i) => new Scout(this, startX + 60, startY - 40 + i * 40, data));
    this.messengers = store.messengers.map((data, i) => new Messenger(this, startX - 30 + i * 20, startY + 40, data, i));

    for (const group of setup.enemyGroups) this.spawnEnemyGroup(group);
    this.enemiesTotal = this.enemies.length;

    this.missionGfx = this.add.graphics().setDepth(14);
    this.fog = new FogOfWar(this, WORLD_WIDTH, WORLD_HEIGHT);
    this.ghostGfx = this.add.graphics().setDepth(16);
    this.updateVision(0);

    const cam = this.cameras.main;
    cam.setBounds(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
    cam.startFollow(this.commander, true, 0.1, 0.1);

    this.setupInput();
    this.publishHud();

    // Acesso para depuração/testes automatizados (somente em dev)
    if (import.meta.env.DEV) (window as unknown as { __battle?: BattleScene }).__battle = this;
  }

  update(time: number, delta: number): void {
    if (this.ended) return;
    // O HUD pode encerrar a batalha (recuo) — para a simulação
    if (useGameStore.getState().battleReport) {
      this.ended = true;
      return;
    }

    const dt = Math.min(delta, 50) / 1000;
    const k = this.keys;

    this.processUiCommands();

    this.commander.handleMovement(k, dt);
    if (k.SPACE.isDown) this.commander.trySwing(this.enemies, time);
    this.commandRing.setPosition(this.commander.x, this.commander.y);
    this.updateFreeCamera(dt);

    const allies = this.allAllies();
    if (time - this.lastFogAt >= SUPPORT.FOG_UPDATE_MS) this.updateVision(time);
    else this.updateReveal(allies, time);
    const visibleEnemies = this.visibleEnemies();

    for (const e of this.enemies) e.think(dt, allies);
    this.assignFollowSlots();
    for (const b of this.battalions) b.update(dt, visibleEnemies);
    for (const s of this.scouts) s.think(dt, this.commander, this.enemies);
    this.updateMessengers(dt);

    const everyone: Unit[] = [...allies, ...this.enemies];
    resolveAttacks(this, everyone, time);
    const faltering = this.commander.hp / this.commander.maxHp < SUPPORT.BANNER_FALTER_HP;
    for (const b of this.battalions) {
      const seen = !b.isDestroyed && this.seesBanner(b.center);
      updateMorale(b, this.enemies, this.commander, dt, time, { seen, faltering });
    }

    separateUnits(everyone);
    clampToWorld(everyone);

    this.enemies = this.enemies.filter((e) => e.isAlive);
    this.collectSupportLosses();
    this.drawMissions();

    if (time - this.lastHudAt >= BALANCE.HUD_UPDATE_MS) {
      this.lastHudAt = time;
      this.publishHud();
    }

    if (!this.commander.isAlive) this.finish("DEFEAT");
    else if (this.enemies.length === 0) this.finish("VICTORY");
  }

  private allAllies(): Unit[] {
    const allies: Unit[] = [];
    if (this.commander.isAlive) allies.push(this.commander);
    for (const b of this.battalions) for (const s of b.soldiers) if (s.isAlive) allies.push(s);
    for (const s of this.scouts) if (s.isAlive) allies.push(s);
    for (const m of this.messengers) if (m.isAlive) allies.push(m);
    return allies;
  }

  private drawGround(): void {
    const g = this.add.graphics().setDepth(-10);
    g.fillStyle(COLORS.GRASS, 1);
    g.fillRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
    g.lineStyle(1, COLORS.GRID, 0.6);
    for (let x = 0; x <= WORLD_WIDTH; x += 100) g.lineBetween(x, 0, x, WORLD_HEIGHT);
    for (let y = 0; y <= WORLD_HEIGHT; y += 100) g.lineBetween(0, y, WORLD_WIDTH, y);
  }

  private spawnEnemyGroup(group: EnemyGroupDef): void {
    const kinds = group.units.flatMap(([kind, n]) => Array<EnemyKind>(n).fill(kind));
    const cols = Math.ceil(Math.sqrt(kinds.length));
    kinds.forEach((kind, i) => {
      const x = group.x + ((i % cols) - (cols - 1) / 2) * 30 + Phaser.Math.Between(-6, 6);
      const y = group.y + (Math.floor(i / cols) - (cols - 1) / 2) * 30 + Phaser.Math.Between(-6, 6);
      this.enemies.push(new Enemy(this, x, y, kind));
    });
  }

  // --- Névoa de guerra e visão ---

  /** Raio de visão de uma fonte conforme o terreno onde está (colina amplia, floresta reduz). */
  private visionAt(p: Point, base: number): number {
    const t = Unit.terrain?.typeAt(p.x, p.y) ?? "GRASS";
    if (t === "HILL") return base * SUPPORT.VISION_HILL_BONUS;
    if (t === "FOREST") return base * SUPPORT.VISION_FOREST_PENALTY;
    return base;
  }

  private visionSources(): VisionSource[] {
    const V = SUPPORT.VISION;
    const sources: VisionSource[] = [];
    const add = (p: Point, base: number) => sources.push({ x: p.x, y: p.y, radius: this.visionAt(p, base) });
    if (this.commander.isAlive) add(this.commander, V.COMMANDER);
    for (const b of this.battalions) if (!b.isDestroyed) add(b.center, V.BATTALION);
    for (const s of this.scouts) if (s.isAlive) add(s, V.SCOUT);
    for (const m of this.messengers) if (m.isAlive) add(m, V.MESSENGER);
    return sources;
  }

  private updateVision(time: number): void {
    this.lastFogAt = time;
    this.fog.update(this.visionSources());
    this.updateReveal(this.allAllies(), time);
  }

  /**
   * Inimigo visível = dentro da visão de alguém (névoa) e, se estiver na floresta,
   * só com um aliado bem perto. Atacar revela por um instante. Quem some deixa um "fantasma".
   */
  private updateReveal(allies: readonly Unit[], time: number): void {
    for (const e of this.enemies) {
      const recentAttack = time - e.lastAttackAt < BALANCE.REVEAL_AFTER_ATTACK_MS;
      const seen = this.fog.canSee(e);
      const forestOk = !e.isInForest || allies.some((a) => distance(a, e) <= BALANCE.FOREST_REVEAL_RANGE);
      e.revealed = (seen && forestOk) || recentAttack;
      if (e.isAlive) e.setVisible(e.revealed);
      if (e.revealed) this.lastSeen.set(e, { x: e.x, y: e.y, t: time });
    }
    for (const a of allies) a.setAlpha(a.isInForest ? 0.6 : 1);
    this.drawGhosts(time);
  }

  private drawGhosts(time: number): void {
    const g = this.ghostGfx;
    g.clear();
    for (const [e, seen] of this.lastSeen) {
      if (!e.isAlive) {
        this.lastSeen.delete(e);
        continue;
      }
      if (e.revealed || time - seen.t > SUPPORT.GHOST_MS) continue;
      const s = e.radius;
      g.fillStyle(COLORS.ENEMY, 0.3);
      g.fillRect(seen.x - s, seen.y - s, s * 2, s * 2);
      g.lineStyle(1, COLORS.ENEMY, 0.6);
      g.strokeRect(seen.x - s, seen.y - s, s * 2, s * 2);
    }
  }

  private visibleEnemies(): Enemy[] {
    return this.enemies.filter((e) => e.revealed);
  }

  // --- Câmera ---

  /** Presa: segue o Comandante. Solta: fica onde está e rola com setas, borda da tela ou botão do meio. */
  private setCameraLocked(locked: boolean): void {
    if (this.cameraLocked === locked) return;
    this.cameraLocked = locked;
    const cam = this.cameras.main;
    if (locked) cam.startFollow(this.commander, true, 0.1, 0.1);
    else cam.stopFollow();
    this.publishHud();
  }

  /** Leva a visão até o Comandante sem prender a câmera. */
  private centerOnCommander(): void {
    this.cameras.main.centerOn(this.commander.x, this.commander.y);
  }

  private updateFreeCamera(dt: number): void {
    if (this.cameraLocked || this.panDrag) return;
    const cam = this.cameras.main;
    const k = this.keys;
    let vx = (k.RIGHT.isDown ? 1 : 0) - (k.LEFT.isDown ? 1 : 0);
    let vy = (k.DOWN.isDown ? 1 : 0) - (k.UP.isDown ? 1 : 0);

    // Mouse encostado na borda da tela rola a visão (só com o mouse de fato dentro do jogo)
    const p = this.input.activePointer;
    if (this.pointerInGame) {
      if (p.x <= CAMERA.EDGE_PX) vx -= 1;
      else if (p.x >= this.scale.width - CAMERA.EDGE_PX) vx += 1;
      if (p.y <= CAMERA.EDGE_PX) vy -= 1;
      else if (p.y >= this.scale.height - CAMERA.EDGE_PX) vy += 1;
    }
    if (vx === 0 && vy === 0) return;
    const speed = (CAMERA.PAN_SPEED / cam.zoom) * dt;
    cam.setScroll(cam.scrollX + Math.sign(vx) * speed, cam.scrollY + Math.sign(vy) * speed);
  }

  // --- Raio de comando e mensageiros ---

  /** Dois anéis pontilhados: alcance da voz (forte) e da trombeta (fraco). */
  private drawCommandRing(): void {
    const g = this.commandRing;
    g.clear();
    const ring = (r: number, alpha: number, dashes: number) => {
      g.lineStyle(2, COLORS.COMMAND_RING, alpha);
      for (let i = 0; i < dashes; i += 2) {
        g.beginPath();
        g.arc(0, 0, r, (i / dashes) * Math.PI * 2, ((i + 1) / dashes) * Math.PI * 2);
        g.strokePath();
      }
    };
    ring(SUPPORT.COMMAND_RADIUS, 0.28, 56);
    ring(SUPPORT.TRUMPET_RADIUS, 0.12, 120);
  }

  /** Onda que se expande a partir de quem sinaliza (trombeta, bandeira, grito de guerra). */
  private signalWave(x: number, y: number, color: number, radius: number): void {
    // Redesenha o anel a cada quadro (escalar engrossaria a linha)
    const g = this.add.graphics({ x, y }).setDepth(13);
    const wave = { r: 20, a: 0.9 };
    this.tweens.add({
      targets: wave,
      r: radius,
      a: 0,
      duration: 700,
      ease: "Cubic.easeOut",
      onUpdate: () => {
        g.clear();
        g.lineStyle(3, color, wave.a);
        g.strokeCircle(0, 0, wave.r);
      },
      onComplete: () => g.destroy(),
    });
  }

  /** O batalhão enxerga o estandarte do Comandante? (alcance e sem floresta no caminho de nenhum dos dois) */
  private seesBanner(p: Point): boolean {
    if (!this.commander.isAlive || this.commander.isInForest) return false;
    if ((Unit.terrain?.typeAt(p.x, p.y) ?? "GRASS") === "FOREST") return false;
    return distance(p, this.commander) <= SUPPORT.BANNER_RADIUS;
  }

  /** Por qual meio uma ordem deste tipo chega ao destinatário sem mensageiro (ou null). */
  private reachOf(r: OrderRecipient, channel: OrderChannel): Reach | null {
    const p = this.recipientPosition(r);
    const d = distance(p, this.commander);
    if (d <= SUPPORT.COMMAND_RADIUS) return "VOICE";
    if ((channel === "BASIC" || channel === "BASIC_VISUAL") && d <= SUPPORT.TRUMPET_RADIUS) return "TRUMPET";
    if ((channel === "VISUAL" || channel === "BASIC_VISUAL") && this.seesBanner(p)) return "BANNER";
    return null;
  }

  private recipientPosition(r: OrderRecipient): Point {
    return r instanceof Battalion ? r.center : { x: r.x, y: r.y };
  }

  private recipientName(r: OrderRecipient): string {
    return r instanceof Battalion ? r.name : `batedor ${r.rider.name}`;
  }

  /** Dentro do alcance da voz qualquer ordem é instantânea. */
  private inCommand(r: OrderRecipient): boolean {
    return distance(this.recipientPosition(r), this.commander) <= SUPPORT.COMMAND_RADIUS;
  }

  /** Toque de trombeta (efeito visual; no máximo um a cada 300 ms para ordens em grupo). */
  private trumpetFx(): void {
    if (this.time.now - this.lastTrumpetFx < 300) return;
    this.lastTrumpetFx = this.time.now;
    this.signalWave(this.commander.x, this.commander.y, COLORS.PENNANT, 260);
  }

  private bannerFx(): void {
    if (this.time.now - this.lastBannerFx < 300) return;
    this.lastBannerFx = this.time.now;
    this.signalWave(this.commander.x, this.commander.y, COLORS.LIEUTENANT, 160);
    this.commander.floatText("⚑ sinal", "#dfe3ee");
  }

  /**
   * Grito de guerra: o nome do bando ecoa. Batalhões próximos ganham moral;
   * os em pânico bem perto do Comandante se reagrupam. Recarga de 30 s.
   */
  private warCry(): void {
    const W = SUPPORT.WAR_CRY;
    if (this.ended || !this.commander.isAlive || this.time.now - this.warCryAt < W.COOLDOWN_MS) return;
    this.warCryAt = this.time.now;
    this.signalWave(this.commander.x, this.commander.y, COLORS.PANIC, W.RADIUS);
    this.commander.floatText("Pela Ascensão!", "#ffb4a8");
    const heard: string[] = [];
    for (const b of this.battalions) {
      if (b.isDestroyed) continue;
      const d = distance(b.center, this.commander);
      if (d > W.RADIUS) continue;
      b.morale = Math.min(BALANCE.MORALE.MAX, b.morale + W.MORALE);
      if (b.panicking && d <= W.RALLY_RADIUS) b.rally();
      heard.push(b.name);
    }
    this.pushFeed(heard.length ? `Grito de guerra! ${heard.join(", ")} recobram o ânimo.` : "Grito de guerra! Ninguém perto o bastante para ouvir.");
    this.publishHud();
  }

  /** Toques de trombeta pré-combinados, para os selecionados (ou todos). */
  private trumpetCall(call: TrumpetCall, targets: readonly Battalion[]): void {
    this.withOrderBatch(() => this.soundTrumpetCall(call, targets));
  }

  private soundTrumpetCall(call: TrumpetCall, targets: readonly Battalion[]): void {
    const label = TRUMPET_LABEL[call];
    for (const b of targets) {
      if (b.isDestroyed) continue;
      const apply = (): void => {
        switch (call) {
          case "ADVANCE": {
            const p = { x: b.center.x + Math.cos(b.facing) * SUPPORT.ADVANCE_DISTANCE, y: b.center.y + Math.sin(b.facing) * SUPPORT.ADVANCE_DISTANCE };
            b.orderMove(p, b.facing);
            break;
          }
          case "HALT":
            b.holdPosition();
            break;
          case "CHARGE":
            b.orderCharge(this.visibleEnemies());
            break;
          case "RETREAT": {
            const c = this.commander;
            b.orderMove({ x: c.x - Math.cos(c.facing) * 120, y: c.y - Math.sin(c.facing) * 120 }, c.facing);
            break;
          }
          case "RALLY":
            b.orderFollow(this.commander);
            break;
        }
      };
      this.dispatch(b, label, apply, call === "RALLY" ? "BASIC_VISUAL" : "BASIC");
    }
  }

  /**
   * Envia uma ordem pelo meio que a época permitiria:
   * - VOZ (raio de comando): qualquer ordem, na hora;
   * - TROMBETA: só toques básicos combinados (Avançar, Alto, Carregar, Recuar, Reunir);
   *   no meio do corpo a corpo o batalhão pode não ouvir;
   * - ESTANDARTE/BANDEIRAS: sinais visuais (formações, seguir), com linha de visão;
   * - MENSAGEIRO: ordens complexas (ponto, alvo, foco, arranjo) ou quando nada mais alcança.
   *   Ele cavalga até ficar ao alcance do próprio sinal — não precisa encostar na tropa.
   */
  private dispatch(recipient: OrderRecipient, order: string, apply: () => void, channel: OrderChannel = "COMPLEX"): boolean {
    const name = this.recipientName(recipient);
    const reach = this.reachOf(recipient, channel);
    if (reach === "VOICE") {
      apply();
      return true;
    }
    if (reach === "TRUMPET") {
      this.trumpetFx();
      if (recipient instanceof Battalion && recipient.status === "ENGAGED" && Math.random() < SUPPORT.TRUMPET_MISS_IN_MELEE) {
        this.pushFeed(`${name} não ouviu o toque "${order}" no meio do combate.`);
        return false;
      }
      apply();
      this.pushFeed(`Trombeta: "${order}" — ${name} obedece.`);
      return true;
    }
    if (reach === "BANNER") {
      this.bannerFx();
      apply();
      this.pushFeed(`Bandeiras: "${order}" — ${name} viu o sinal.`);
      return true;
    }

    // Precisa de mensageiro: numa ordem em grupo, entra no lote (um mensageiro por grupo próximo)
    if (recipient instanceof Battalion) recipient.pendingOrder = order;
    const stop = this.missionStop(recipient, apply);
    if (this.pendingBatch) {
      this.pendingBatch.push({ order, stop, recipient });
      return true;
    }
    return this.sendMessengers(order, [{ order, stop, recipient }]);
  }

  /** Destinatário de uma missão: na entrega, a autoridade do mensageiro age antes da ordem. */
  private missionStop(recipient: OrderRecipient, apply: () => void): MissionStop {
    return {
      recipient: this.recipientName(recipient),
      position: () => this.recipientPosition(recipient),
      gone: () => (recipient instanceof Battalion ? recipient.isDestroyed : !recipient.isAlive),
      deliver: (m) => {
        if (recipient instanceof Battalion) {
          recipient.pendingOrder = null;
          if (recipient.panicking && m.canRally) {
            recipient.rally();
            this.pushFeed(`${m.rider.name} reagrupou ${recipient.name} em pânico!`);
          }
          recipient.morale = Math.min(BALANCE.MORALE.MAX, recipient.morale + m.authority);
        }
        apply();
      },
    };
  }

  /**
   * Executa `fn` agrupando as entregas por mensageiro: uma ordem dada a vários batalhões
   * sai com UM mensageiro para cada grupo de batalhões próximos (não um por batalhão).
   */
  private withOrderBatch<T>(fn: () => T): T {
    if (this.pendingBatch) return fn(); // já dentro de um lote
    this.pendingBatch = [];
    try {
      return fn();
    } finally {
      const batch = this.pendingBatch;
      this.pendingBatch = null;
      const byOrder = new Map<string, PendingDelivery[]>();
      for (const p of batch) byOrder.set(p.order, [...(byOrder.get(p.order) ?? []), p]);
      for (const [order, deliveries] of byOrder) this.sendMessengers(order, deliveries);
    }
  }

  /**
   * Agrupa os destinatários por proximidade e manda um mensageiro por grupo.
   * Faltando mensageiros, os grupos que sobram entram na rota de quem já está saindo
   * com essa ordem; sem nenhum mensageiro livre, a ordem não sai.
   */
  private sendMessengers(order: string, deliveries: PendingDelivery[]): boolean {
    const groups: PendingDelivery[][] = [];
    for (const d of deliveries) {
      const p = d.stop.position();
      const group = groups.find((g) => g.some((x) => distance(x.stop.position(), p) <= SUPPORT.MESSENGER.GROUP_RADIUS));
      if (group) group.push(d);
      else groups.push([d]);
    }

    const used: Messenger[] = [];
    let sent = false;
    for (const group of groups) {
      const names = group.map((d) => d.stop.recipient).join(", ");
      const messenger = this.messengers.find((m) => m.available);
      if (messenger) {
        messenger.send({ order, stops: group.map((d) => d.stop) });
        used.push(messenger);
        sent = true;
        this.pushFeed(`${messenger.rider.name} partiu com "${order}" para ${names}.`);
      } else if (used.length > 0) {
        const carrier = used[used.length - 1];
        carrier.addStops(group.map((d) => d.stop));
        sent = true;
        this.pushFeed(`Sem outro mensageiro: ${carrier.rider.name} também levará "${order}" a ${names}.`);
      } else {
        for (const d of group) if (d.recipient instanceof Battalion) d.recipient.pendingOrder = null;
        this.pushFeed(`Sem mensageiro livre: "${order}" não chegou a ${names}.`);
      }
    }
    return sent;
  }

  private updateMessengers(dt: number): void {
    for (const m of this.messengers) {
      const event = m.think(dt, this.commander);
      if (event?.type === "DELIVERED") {
        // O mensageiro sinaliza de longe: trombeta e bandeira até onde a tropa vê e ouve
        this.signalWave(event.at.x, event.at.y, COLORS.PENNANT, m.signalRange);
        const more = event.remaining > 0 ? ` Segue para mais ${event.remaining}.` : "";
        this.pushFeed(`${m.rider.name} sinalizou "${event.order}" a ${event.recipients.join(" e ")}.${more}`);
      }
      if (event?.type === "ABORTED") this.pushFeed(`${m.rider.name} voltou: os destinatários de "${event.order}" não existem mais.`);
    }
  }

  /** Registra batedores e mensageiros abatidos (ordens em mãos se perdem). */
  private collectSupportLosses(): void {
    for (const m of this.messengers) {
      if (m.isAlive || this.deadMessengerIds.includes(m.rider.id)) continue;
      this.deadMessengerIds.push(m.rider.id);
      if (m.mission) {
        const names = m.mission.stops.map((s) => s.recipient);
        this.pushFeed(`${m.rider.name} foi interceptado! A ordem "${m.mission.order}" para ${names.join(", ")} se perdeu.`);
        for (const b of this.battalions) if (names.includes(b.name)) b.pendingOrder = null;
        m.mission = null;
      } else {
        this.pushFeed(`O mensageiro ${m.rider.name} caiu.`);
      }
    }
    for (const s of this.scouts) {
      if (s.isAlive || this.deadScoutIds.includes(s.rider.id)) continue;
      this.deadScoutIds.push(s.rider.id);
      this.pushFeed(`O batedor ${s.rider.name} foi abatido.`);
    }
  }

  /** Linha pontilhada de cada mensageiro em missão até cada destinatário que falta. */
  private drawMissions(): void {
    const g = this.missionGfx;
    g.clear();
    for (const m of this.messengers) {
      if (!m.isAlive || m.riderState !== "OUTBOUND" || !m.mission) continue;
      const current = m.currentStop();
      for (const stop of m.mission.stops) {
        const p = stop.position();
        const d = distance(m, p);
        const steps = Math.floor(d / 18);
        // Destino atual em destaque; os seguintes, mais fracos
        g.fillStyle(COLORS.PENNANT, stop === current ? 0.8 : 0.35);
        for (let i = 1; i < steps; i++) {
          const t = i / steps;
          g.fillCircle(m.x + (p.x - m.x) * t, m.y + (p.y - m.y) * t, 2);
        }
      }
    }
  }

  private pushFeed(line: string): void {
    this.feed = [...this.feed, line].slice(-FEED_SIZE);
  }

  // --- Cortejo ---

  /**
   * Organiza o cortejo atrás do Comandante com os batalhões que estão seguindo,
   * conforme o arranjo de grupo escolhido (ex.: arqueiros na fileira de trás).
   * Só recalcula quando muda quem segue, a formação de alguém ou o arranjo,
   * para não ficar trocando de lugar.
   */
  private assignFollowSlots(): void {
    const followers = this.battalions.filter((b) => b.isFollowing);
    const arrangement = useGameStore.getState().groupArrangement;
    const key = arrangement + "#" + followers.map((b) => `${b.id}:${b.formation}:${b.soldiers.length}`).join("|");
    if (key === this.followKey) return;
    this.followKey = key;

    for (const slot of layoutGroup(followers, arrangement, this.commander.facing, this.commander)) {
      slot.battalion.followSlot = { lateral: slot.lateral, back: slot.back + BALANCE.FOLLOW_DISTANCE };
    }
  }

  // --- Entrada ---

  private setupInput(): void {
    const keyboard = this.input.keyboard;
    if (!keyboard) throw new Error("Teclado indisponível");
    this.keys = keyboard.addKeys("W,A,S,D,SPACE,F,Q,ESC,ONE,TWO,THREE,FOUR,C,H,UP,DOWN,LEFT,RIGHT,R") as BattleKeys;

    this.input.mouse?.disableContextMenu();
    this.selectionBox = this.add.graphics().setDepth(20);

    // --- Câmera: C prende/solta, H centraliza, roda = zoom, botão do meio arrasta ---
    this.keys.C.on("down", () => this.setCameraLocked(!this.cameraLocked));
    this.keys.H.on("down", () => this.centerOnCommander());
    this.input.on("wheel", (_p: Phaser.Input.Pointer, _o: unknown, _dx: number, dy: number) => {
      const cam = this.cameras.main;
      const zoom = Phaser.Math.Clamp(cam.zoom - Math.sign(dy) * CAMERA.ZOOM_STEP, CAMERA.MIN_ZOOM, CAMERA.MAX_ZOOM);
      cam.setZoom(Math.round(zoom * 100) / 100);
      this.publishHud();
    });

    this.input.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
      if (this.ended) return;
      useGameStore.getState().setContextMenu(null);

      if (pointer.middleButtonDown()) {
        // Arrastar a visão solta a câmera
        this.setCameraLocked(false);
        const cam = this.cameras.main;
        this.panDrag = { x: pointer.x, y: pointer.y, scrollX: cam.scrollX, scrollY: cam.scrollY };
      } else if (pointer.rightButtonDown()) {
        this.withOrderBatch(() => this.handleRightClick(pointer));
      } else if (pointer.leftButtonDown()) {
        this.dragStart = { x: pointer.worldX, y: pointer.worldY };
      }
    });

    this.input.on("gameout", () => {
      this.pointerInGame = false;
    });
    this.input.on("pointermove", (pointer: Phaser.Input.Pointer) => {
      this.pointerInGame = true;
      if (this.panDrag && pointer.middleButtonDown()) {
        const cam = this.cameras.main;
        cam.setScroll(
          this.panDrag.scrollX - (pointer.x - this.panDrag.x) / cam.zoom,
          this.panDrag.scrollY - (pointer.y - this.panDrag.y) / cam.zoom,
        );
        return;
      }
      if (!this.dragStart || !pointer.leftButtonDown()) return;
      this.drawSelectionBox(this.selectionRect(pointer));
    });

    this.input.on("pointerup", (pointer: Phaser.Input.Pointer) => {
      if (pointer.button === 1) this.panDrag = null;
      if (!this.dragStart || pointer.button !== 0) return;
      const rect = this.selectionRect(pointer);
      const additive = isShiftHeld(pointer);
      this.dragStart = null;
      this.selectionBox.clear();
      if (this.ended) return;

      if (rect.width < DRAG_THRESHOLD && rect.height < DRAG_THRESHOLD) {
        const scout = this.scoutAt(pointer.worldX, pointer.worldY);
        const hit = scout ? null : this.battalionAt(pointer.worldX, pointer.worldY);
        if (additive && (scout || hit)) {
          if (scout) scout.selected = !scout.selected;
          if (hit) hit.selected = !hit.selected;
        } else {
          this.select(hit ? [hit] : [], scout ? [scout] : [], additive);
        }
      } else {
        this.select(
          this.battalions.filter((b) => b.intersectsRect(rect)),
          this.scouts.filter((s) => s.isAlive && rect.contains(s.x, s.y)),
          additive,
        );
      }
      this.publishHud();
    });

    this.keys.F.on("down", () => {
      if (this.ended) return;
      this.withOrderBatch(() => {
        for (const b of this.commandTargets()) this.dispatch(b, "Reunir ao estandarte", () => b.orderFollow(this.commander), "BASIC_VISUAL");
      });
    });

    this.keys.Q.on("down", () => {
      if (this.ended) return;
      const near = this.battalions.filter(
        (b) => !b.isDestroyed && distance(b.center, this.commander) <= BALANCE.NEARBY_SELECT_RADIUS,
      );
      this.select(near, [], false);
      this.publishHud();
    });

    this.keys.ESC.on("down", () => {
      useGameStore.getState().setContextMenu(null);
      this.select([], [], false);
      this.publishHud();
    });

    this.keys.R.on("down", () => this.warCry());

    // 1–4: formação dos selecionados (cada tipo de tropa ignora as que não sabe fazer)
    for (const [key, formation] of FORMATION_KEYS) {
      this.keys[key].on("down", () => {
        if (this.ended) return;
        this.withOrderBatch(() => {
          for (const b of this.commandTargets()) {
            if (b.canUseFormation(formation)) {
              this.dispatch(b, `Formação: ${FORMATIONS[formation].label}`, () => b.setFormation(formation), "VISUAL");
            }
          }
        });
        this.publishHud();
      });
    }
  }

  /**
   * Botão direito:
   * - sobre um batalhão aliado → abre o menu de contexto (React);
   * - sobre um inimigo → batalhões selecionados atacam;
   * - no chão → batalhões selecionados marcham e batedores selecionados exploram o ponto.
   * Ordens para quem está fora do raio de comando vão por mensageiro.
   */
  private handleRightClick(pointer: Phaser.Input.Pointer): void {
    const { worldX: x, worldY: y } = pointer;

    const selected = this.battalions.filter((b) => b.selected);
    const selectedScouts = this.scouts.filter((s) => s.selected && s.isAlive);

    // Sobre um batalhão: menu do grupo selecionado (se ele faz parte de uma seleção múltipla) ou só dele
    const own = this.battalionAt(x, y);
    if (own) {
      const ev = pointer.event as MouseEvent;
      const ids = own.selected && selected.length > 1 ? selected.map((b) => b.id) : [own.id];
      useGameStore.getState().setContextMenu({ battalionIds: ids, x: ev.clientX, y: ev.clientY });
      return;
    }

    if (selected.length === 0 && selectedScouts.length === 0) return;

    const point = { x, y };
    let accepted = false;
    for (const s of selectedScouts) {
      accepted = this.dispatch(s, "Explorar", () => s.setMode("EXPLORE", point)) || accepted;
    }

    const enemy = nearest(this.visibleEnemies(), point, 40);
    if (enemy) {
      for (const b of selected) accepted = this.dispatch(b, "Atacar", () => b.orderAttack(enemy)) || accepted;
    } else if (selected.length > 0) {
      accepted = this.groupMove(selected, point) || accepted;
    }
    if (accepted) this.showOrderMarker(x, y, enemy ? COLORS.ORDER_ATTACK : COLORS.ORDER_MOVE);
  }

  /**
   * Marcha em grupo: os batalhões se dispõem conforme o arranjo escolhido
   * (fileira da frente centrada no ponto clicado, demais fileiras atrás),
   * todos virados para a mesma direção e sem cruzar o caminho um do outro.
   */
  private groupMove(group: readonly Battalion[], target: Point, facing?: number): boolean {
    const movable = group.filter((b) => !b.isDestroyed);
    if (movable.length === 0) return false;
    const origin = centroid(movable.map((b) => b.center));
    const dir = facing ?? angleTo(origin, target);
    if (movable.length === 1) {
      const b = movable[0];
      return this.dispatch(b, "Marchar", () => b.orderMove(target, dir));
    }

    const fx = Math.cos(dir);
    const fy = Math.sin(dir);
    const arrangement = useGameStore.getState().groupArrangement;
    let sent = false;
    for (const { battalion, lateral, back } of layoutGroup(movable, arrangement, dir, origin)) {
      const p = { x: target.x - fx * back - fy * lateral, y: target.y - fy * back + fx * lateral };
      sent = this.dispatch(battalion, "Marchar", () => battalion.orderMove(p, dir)) || sent;
    }
    return sent;
  }

  /** Reorganiza o grupo no lugar onde já está (após trocar o arranjo), mantendo a direção da frente. */
  private regroupInPlace(group: readonly Battalion[]): void {
    const movable = group.filter((b) => !b.panicking && !b.isDestroyed && !b.isFollowing);
    if (movable.length < 2) return;
    // Direção média das frentes atuais
    const sx = movable.reduce((s, b) => s + Math.cos(b.facing), 0);
    const sy = movable.reduce((s, b) => s + Math.sin(b.facing), 0);
    const dir = Math.atan2(sy, sx);
    const origin = centroid(movable.map((b) => b.center));
    // Centraliza o grupo inteiro (não só a fileira da frente) onde ele já está
    const slots = layoutGroup(movable, useGameStore.getState().groupArrangement, dir, origin);
    const meanBack = slots.reduce((s, x) => s + x.back, 0) / slots.length;
    this.groupMove(movable, { x: origin.x + Math.cos(dir) * meanBack, y: origin.y + Math.sin(dir) * meanBack }, dir);
  }

  /** Aplica os comandos enviados pela UI React (menu de contexto, cards do HUD). */
  private processUiCommands(): void {
    const commands = useGameStore.getState().drainBattleCommands();
    if (commands.length === 0) return;
    // Cada comando da UI é UMA ordem: batalhões próximos dividem o mesmo mensageiro
    for (const cmd of commands) this.withOrderBatch(() => this.applyUiCommand(cmd));
    this.publishHud();
  }

  private applyUiCommand(cmd: BattleCommand): void {
    {
      const picked = this.battalions.filter((b) => cmd.ids.includes(b.id) && !b.isDestroyed);

      switch (cmd.type) {
        case "SELECT":
          if (cmd.additive && picked.every((b) => b.selected)) for (const b of picked) b.selected = false;
          else this.select(picked, [], cmd.additive);
          break;
        case "SELECT_SCOUT": {
          const scouts = this.scouts.filter((s) => cmd.ids.includes(s.rider.id) && s.isAlive);
          if (cmd.additive && scouts.every((s) => s.selected)) for (const s of scouts) s.selected = false;
          else this.select([], scouts, cmd.additive);
          break;
        }
        case "CAMERA":
          if (cmd.action === "TOGGLE") this.setCameraLocked(!this.cameraLocked);
          else this.centerOnCommander();
          break;
        case "TRUMPET": {
          // Sem seleção, o toque vale para todo o exército
          const targets = picked.length > 0 ? picked : this.battalions.filter((b) => !b.isDestroyed);
          this.trumpetCall(cmd.call, targets);
          break;
        }
        case "WAR_CRY":
          this.warCry();
          break;
        case "SCOUT_MODE":
          for (const s of this.scouts.filter((x) => cmd.ids.includes(x.rider.id) && x.isAlive)) {
            this.dispatch(s, SCOUT_MODE_LABEL[cmd.mode], () => s.setMode(cmd.mode), "BASIC");
          }
          break;
        case "FOLLOW":
          for (const b of picked) this.dispatch(b, "Reunir ao estandarte", () => b.orderFollow(this.commander), "BASIC_VISUAL");
          break;
        case "HOLD":
          for (const b of picked) this.dispatch(b, "Alto", () => b.holdPosition(), "BASIC");
          break;
        case "FORMATION":
          for (const b of picked) {
            if (b.canUseFormation(cmd.formation)) {
              this.dispatch(b, `Formação: ${FORMATIONS[cmd.formation].label}`, () => b.setFormation(cmd.formation), "VISUAL");
            }
          }
          break;
        case "CHARGE":
          for (const b of picked) {
            this.dispatch(
              b,
              "Carregar",
              () => {
                if (b.orderCharge(this.visibleEnemies()) && b.order.type === "ATTACK") {
                  this.showOrderMarker(b.order.target.x, b.order.target.y, COLORS.ORDER_ATTACK);
                }
              },
              "BASIC",
            );
          }
          break;
        case "FOCUS": {
          // Todos no mesmo alvo: o inimigo visível mais próximo do centro do grupo
          const target = nearest(this.visibleEnemies(), centroid(picked.map((b) => b.center)));
          if (!target) break;
          let accepted = false;
          for (const b of picked) accepted = this.dispatch(b, "Foco no alvo", () => b.orderAttack(target)) || accepted;
          if (accepted) this.showOrderMarker(target.x, target.y, COLORS.ORDER_ATTACK);
          break;
        }
        case "ARRANGEMENT":
          useGameStore.getState().setGroupArrangement(cmd.arrangement);
          this.regroupInPlace(picked); // quem segue o Comandante se reorganiza via assignFollowSlots
          break;
      }
    }
  }

  private select(battalions: readonly Battalion[], scouts: readonly Scout[], additive: boolean): void {
    if (!additive) {
      for (const b of this.battalions) b.selected = false;
      for (const s of this.scouts) s.selected = false;
    }
    for (const b of battalions) if (!b.isDestroyed) b.selected = true;
    for (const s of scouts) if (s.isAlive) s.selected = true;
  }

  /** Selecionados; sem seleção, todos (atalho de teclado). */
  private commandTargets(): Battalion[] {
    const selected = this.battalions.filter((b) => b.selected);
    return selected.length > 0 ? selected : this.battalions;
  }

  private battalionAt(x: number, y: number): Battalion | null {
    return this.battalions.find((b) => !b.isDestroyed && b.containsPoint({ x, y })) ?? null;
  }

  private scoutAt(x: number, y: number): Scout | null {
    return this.scouts.find((s) => s.isAlive && distance(s, { x, y }) <= s.radius + 10) ?? null;
  }

  private selectionRect(pointer: Phaser.Input.Pointer): Phaser.Geom.Rectangle {
    const start = this.dragStart ?? { x: pointer.worldX, y: pointer.worldY };
    return new Phaser.Geom.Rectangle(
      Math.min(start.x, pointer.worldX),
      Math.min(start.y, pointer.worldY),
      Math.abs(pointer.worldX - start.x),
      Math.abs(pointer.worldY - start.y),
    );
  }

  private drawSelectionBox(rect: Phaser.Geom.Rectangle): void {
    const g = this.selectionBox;
    g.clear();
    g.fillStyle(COLORS.SELECTION, 0.12);
    g.fillRectShape(rect);
    g.lineStyle(1, COLORS.SELECTION, 0.9);
    g.strokeRectShape(rect);
  }

  private showOrderMarker(x: number, y: number, color: number): void {
    const marker = this.add.graphics({ x, y }).setDepth(4);
    marker.lineStyle(2, color, 1);
    marker.strokeCircle(0, 0, 14);
    marker.lineBetween(-6, 0, 6, 0);
    marker.lineBetween(0, -6, 0, 6);
    this.tweens.add({
      targets: marker,
      alpha: 0,
      scale: 1.6,
      duration: 450,
      onComplete: () => marker.destroy(),
    });
  }

  // --- HUD e fim de batalha ---

  private supportReport(): SupportReport {
    return {
      deadScoutIds: [...this.deadScoutIds],
      deadMessengerIds: [...this.deadMessengerIds],
      deliveries: Object.fromEntries(this.messengers.map((m) => [m.rider.id, m.deliveries])),
    };
  }

  private publishHud(): void {
    useGameStore.getState().setBattleHud({
      commanderHp: this.commander.hp,
      commanderMaxHp: this.commander.maxHp,
      battalions: this.battalions.map((b) => ({
        id: b.id,
        name: b.name,
        troopType: b.troopType,
        formation: b.formation,
        terrain: Unit.terrain?.typeAt(b.center.x, b.center.y) ?? "GRASS",
        level: b.level,
        kills: b.kills,
        lieutenant: b.lieutenant ? { name: b.lieutenant.name, alive: b.lieutenantAlive, kills: b.lieutenantKills } : null,
        alive: b.aliveCount,
        max: b.startingCount,
        morale: Math.round(b.morale),
        status: b.status,
        selected: b.selected,
        inCommand: !b.isDestroyed && this.inCommand(b),
        reach: b.isDestroyed ? "NONE" : (this.reachOf(b, "BASIC_VISUAL") ?? "NONE"),
        seesBanner: !b.isDestroyed && this.seesBanner(b.center),
        pendingOrder: b.pendingOrder,
      })),
      scouts: this.scouts.map((s) => ({
        id: s.rider.id,
        name: s.rider.name,
        hp: Math.ceil(s.hp),
        maxHp: s.maxHp,
        mode: s.mode,
        alive: s.isAlive,
        selected: s.selected,
        fleeing: s.unitState === "FLEEING",
      })),
      messengers: this.messengers.map((m) => ({
        id: m.rider.id,
        name: m.rider.name,
        level: m.rider.level,
        state: m.isAlive ? m.riderState : "DEAD",
      })),
      feed: this.feed,
      support: this.supportReport(),
      camera: { locked: this.cameraLocked, zoom: this.cameras.main.zoom },
      warCryIn: Math.max(0, Math.ceil((SUPPORT.WAR_CRY.COOLDOWN_MS - (this.time.now - this.warCryAt)) / 1000)),
      bannerFaltering: this.commander.hp / this.commander.maxHp < SUPPORT.BANNER_FALTER_HP,
      enemiesAlive: this.enemies.length,
      enemiesTotal: this.enemiesTotal,
    });
  }

  private finish(result: BattleResult): void {
    this.ended = true;
    this.selectionBox.clear();
    this.publishHud();
    useGameStore.getState().setContextMenu(null);
    useGameStore.getState().endBattle(
      result,
      this.battalions.map((b) => ({
        id: b.id,
        survivors: b.aliveCount,
        formation: b.formation,
        kills: b.kills,
        lieutenantAlive: b.lieutenant ? b.lieutenantAlive : undefined,
        lieutenantKills: b.lieutenantKills,
      })),
      this.supportReport(),
    );
  }
}
