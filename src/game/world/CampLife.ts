import Phaser from "phaser";
import type { Battalion } from "../entities/Battalion";
import type { Soldier } from "../entities/Soldier";
import { CAMP_SITES, CAMPFIRE, PALISADE, type CampSiteKind } from "../data/campLayout";
import type { CampArea } from "./CampArea";
import type { Follower, FollowerRole } from "../sim/campEvents";
import { COLORS } from "../../utils/constants";
import { Unit } from "../entities/Unit";
import { distance, type Point } from "../../utils/math";

type Activity =
  | "SLEEP"
  | "EAT"
  | "QUEUE"
  | "SIT"
  | "DICE"
  | "TRAIN"
  | "CHORE"
  | "WHISPER"
  | "CROWD"
  | "PARTY"
  | "WANDER"
  | "TALK"
  | "GUARD"
  | "STABLE"
  /** Treino de verdade (ordem do Campo de Treino): fileiras e duelos de pares. */
  | "DRILL"
  /** Ferido depois de um combate, deitado na enfermaria da curandeira. */
  | "WOUNDED"
  /** Ouvindo o sermão do capelão. */
  | "SERMON"
  /** Olhando as bugigangas do mascate. */
  | "BROWSE"
  /** Fila do pagamento diante da tenda do Comandante, no dia do soldo. */
  | "PAY"
  /** Levando ferro da Intendência para a Ferraria. */
  | "HAUL";
export type Pose = "STAND" | "SIT" | "SLEEP";

/** O que o acampamento está vivendo agora (lido do store a cada quadro). */
export interface CampState {
  hour: number;
  hungry: boolean;
  lowMorale: boolean;
  arrears: boolean;
  /** Batalhão prestes a se amotinar (null = ninguém). */
  rebelId: string | null;
  /** Vitória recente: festa em volta da fogueira. */
  party: boolean;
  /** Pares de tenentes amigos (ids). */
  friends: [string, string][];
  /** Batalhões em treino no Campo de Treino. */
  training: readonly string[];
  /** Combate há pouco: há feridos no acampamento. */
  wounded: boolean;
  /** Dia do soldo, de manhã, com o pagamento em dia: fila diante da tenda. */
  payday: boolean;
  /** Há ferro no depósito (os soldados o levam para a Ferraria). */
  iron: boolean;
}

interface Task {
  activity: Activity;
  path: Point[];
  spot: Point;
  /** Quando escolher outra coisa para fazer (tempo da cena). */
  until: number;
  pose: Pose;
  bubble: string | null;
  bubbleColor: string;
  /** Posição recalculada pelo grupo (roda da fogueira, fila, rodinha). */
  grouped: boolean;
  /** Carregando: passa por `via` (a Intendência) e de lá leva a carga (ferro) até o destino. */
  via?: Point;
  loaded?: boolean;
}

const BUBBLE: Partial<Record<Activity, { text: string[]; color: string }>> = {
  QUEUE: { text: ["fome!", "e a comida?", "…"], color: "#ffd27a" },
  SIT: { text: ["…", "suspiro", "…"], color: "#c9c9c9" },
  WHISPER: { text: ["?!", "e o soldo?", "pssst"], color: "#ffb36b" },
  CROWD: { text: ["!!", "SOLDO!", "!!"], color: "#ff6b6b" },
  PARTY: { text: ["♪", "♫", "viva!"], color: "#9cf29c" },
  TALK: { text: ["☺", "ha ha", "lembra?"], color: "#bfe3ff" },
  SLEEP: { text: ["z", "zz"], color: "#9aa7c7" },
  DICE: { text: ["6!", "dados", "outra!"], color: "#e8d9a8" },
  DRILL: { text: ["hah!", "hup!", "um, dois!", "de novo!"], color: "#ffe9b0" },
  WOUNDED: { text: ["ai…", "obrigado", "ugh"], color: "#ff9a8a" },
  SERMON: { text: ["amém", "…", "amém"], color: "#e0e0ff" },
  BROWSE: { text: ["quanto?", "hmm", "isso aí!"], color: "#c9a23a" },
  PAY: { text: ["soldo!", "$", "até que enfim"], color: "#f1d36b" },
  HAUL: { text: ["ufa", "pesado!"], color: "#bcc6cf" },
};

const MAX_BUBBLES = 28;

interface FollowerFigure {
  follower: Follower;
  gfx: Phaser.GameObjects.Graphics;
  home: Point;
  target: Point;
  waitUntil: number;
  /** Ajudante de ferreiro voltando da Intendência com ferro. */
  carrying?: boolean;
}

/**
 * Vida no acampamento (Marco 12): os soldados dos batalhões que descansam no acampamento
 * deixam a formação e vivem a rotina — dormem na barraca à noite, comem na fogueira, treinam,
 * jogam dados, fazem tarefas, cuidam dos cavalos. O comportamento mostra o estado do bando:
 * - fome: fila na Intendência e gente sentada, cabisbaixa;
 * - moral baixa: rodas de gente sentada e calada;
 * - salário atrasado: rodinhas cochichando entre as barracas;
 * - motim prestes a estourar: o batalhão rebelado se junta diante da tenda do Comandante;
 * - vitória recente: festa e cantoria em volta da fogueira.
 * Os seguidores (cozinheiro, mascate, curandeira, capelão, famílias) também andam por ali,
 * e tenentes amigos se visitam. Se o inimigo aparecer, todo mundo larga tudo e luta.
 */
export class CampLife {
  private tasks = new Map<Soldier, Task>();
  private bubbles: Phaser.GameObjects.Text[] = [];
  private figures: FollowerFigure[] = [];
  private state: CampState = { hour: 12, hungry: false, lowMorale: false, arrears: false, rebelId: null, party: false, friends: [], training: [], wounded: false, payday: false, iron: false };
  /** Carga nas costas de quem leva ferro (e do ajudante de ferreiro). */
  private readonly carryGfx: Phaser.GameObjects.Graphics;
  /** Estações de trabalho dos seguidores (caldeirão, banca, enfermaria, púlpito, varal). */
  private stationGfx: Phaser.GameObjects.Graphics | null = null;
  private readonly stations: Record<FollowerRole, Point>;
  /** Texto sobre o Campo de Treino enquanto alguém treina. */
  private readonly trainingLabel: Phaser.GameObjects.Text;
  private lastGroupAt = -Infinity;
  /** Ordem dos batalhões no acampamento (alojamento de cada um) e o tenente de cada um. */
  private quarterOf = new Map<string, number>();
  private lieutenantOf = new Map<string, string>();
  readonly sites: Record<CampSiteKind, Point>;
  private readonly fire: Point;
  private readonly gate: Point;
  private readonly center: Point;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly camp: CampArea,
    origin: Point,
  ) {
    const at = (p: Point) => ({ x: origin.x + p.x, y: origin.y + p.y });
    this.sites = Object.fromEntries(CAMP_SITES.map((s) => [s.kind, at(s.door)])) as Record<CampSiteKind, Point>;
    this.fire = at(CAMPFIRE);
    this.gate = at({ x: PALISADE.x - PALISADE.rx + 70, y: PALISADE.y });
    this.center = at(PALISADE);
    const f = this.fire;
    this.stations = {
      COOK: { x: f.x + 80, y: f.y + 70 },
      PEDDLER: { x: this.sites.QUARTERMASTER.x - 30, y: this.sites.QUARTERMASTER.y + 90 },
      HEALER: { x: this.sites.TENT.x - 190, y: this.sites.TENT.y + 50 },
      CHAPLAIN: { x: f.x + 150, y: f.y - 95 },
      FAMILY: { x: f.x - 170, y: f.y + 230 },
      SMITH: { x: this.sites.FORGE.x + 10, y: this.sites.FORGE.y + 62 },
    };
    this.carryGfx = scene.add.graphics().setDepth(6);
    this.trainingLabel = scene.add
      .text(this.sites.TRAINING.x - 125, this.sites.TRAINING.y - 110, "", { fontFamily: "monospace", fontSize: "13px", color: "#ffe9b0", stroke: "#000000", strokeThickness: 3 })
      .setOrigin(0.5)
      .setDepth(20);
    for (let i = 0; i < MAX_BUBBLES; i++) {
      this.bubbles.push(
        scene.add
          .text(0, 0, "", { fontFamily: "monospace", fontSize: "12px", color: "#ffffff", stroke: "#000000", strokeThickness: 3 })
          .setOrigin(0.5)
          .setDepth(21)
          .setVisible(false),
      );
    }
  }

  setState(state: CampState): void {
    const before = this.state;
    this.state = state;
    // O acampamento reage logo a uma mudança (fome, soldo, motim, festa, noite, refeição):
    // cada um larga o que fazia em até 1,5 s (não todos no mesmo quadro)
    const phase = (s: CampState) => (s.hour >= 21 || s.hour < 5 ? "noite" : (s.hour >= 7 && s.hour < 8.5) || (s.hour >= 18 && s.hour < 19.5) ? "refeição" : "dia");
    const changed =
      before.training.join() !== state.training.join() ||
      before.wounded !== state.wounded ||
      before.hungry !== state.hungry ||
      before.arrears !== state.arrears ||
      before.rebelId !== state.rebelId ||
      before.party !== state.party ||
      before.lowMorale !== state.lowMorale ||
      before.payday !== state.payday ||
      phase(before) !== phase(state);
    if (!changed) return;
    const now = this.scene.time.now;
    for (const t of this.tasks.values()) t.until = Math.min(t.until, now + Math.random() * 1500);
    // Os seguidores também trocam de tarefa (o cozinheiro corre para o caldeirão na refeição)
    for (const f of this.figures) {
      f.target = { x: f.gfx.x, y: f.gfx.y };
      f.waitUntil = 0;
    }
  }

  /** Seguidores do acampamento como figuras (refeito quando a lista muda). */
  setFollowers(followers: readonly Follower[]): void {
    for (const f of this.figures) f.gfx.destroy();
    this.figures = followers.map((follower, i) => {
      const home = this.followerHome(follower.role, i);
      const gfx = this.scene.add.graphics({ x: home.x, y: home.y }).setDepth(4);
      drawFollower(gfx, follower.role);
      return { follower, gfx, home, target: home, waitUntil: 0 };
    });
    this.stationGfx?.destroy();
    this.stationGfx = this.scene.add.graphics().setDepth(-2.1);
    for (const role of new Set(followers.map((f) => f.role))) drawStation(this.stationGfx, role, this.stations[role]);
  }

  private has(role: FollowerRole): boolean {
    return this.figures.some((f) => f.follower.role === role);
  }

  /** Banca do mascate (onde se compra dele), se ele segue o bando. */
  peddlerStall(): Point | null {
    return this.has("PEDDLER") ? this.stations.PEDDLER : null;
  }

  /** Texto do treino em andamento sobre o Campo de Treino (vazio = ninguém treinando). */
  setTrainingText(text: string): void {
    this.trainingLabel.setText(text).setVisible(text.length > 0);
  }

  /** Função que o batalhão chama para cada soldado enquanto descansa (true = cuidou do soldado). */
  driverFor(b: Battalion, quarterIndex: number): (s: Soldier, i: number, dt: number) => boolean {
    this.quarterOf.set(b.id, quarterIndex);
    if (b.lieutenant) this.lieutenantOf.set(b.id, b.lieutenant.id);
    return (s, i, dt) => this.drive(b, s, i, dt);
  }

  /** O batalhão saiu do acampamento: volta à forma, de pé. */
  release(b: Battalion): void {
    for (const s of b.soldiers) {
      this.tasks.delete(s);
      s.setPose("STAND");
    }
    this.quarterOf.delete(b.id);
    this.lieutenantOf.delete(b.id);
  }

  update(time: number, dt: number, near: boolean): void {
    // Rodas, filas e rodinhas: posições recalculadas em grupo duas vezes por segundo
    if (time - this.lastGroupAt > 500) {
      this.lastGroupAt = time;
      this.arrangeGroups(time);
    }
    this.updateFollowers(time, dt);
    this.updateBubbles(time, near);
    this.drawCarried(near);
  }

  /** Barras de ferro nas costas de quem as leva para a Ferraria. */
  private drawCarried(near: boolean): void {
    const g = this.carryGfx;
    g.clear();
    if (!near) return;
    const bar = (x: number, y: number) => {
      g.fillStyle(0x8a949c, 1);
      g.fillRect(x - 7, y - 3, 14, 6);
      g.lineStyle(1, 0x2b2b2b, 1);
      g.strokeRect(x - 7, y - 3, 14, 6);
    };
    for (const [s, t] of this.tasks) if (t.activity === "HAUL" && t.loaded && s.isAlive && s.unitState === "MOVING") bar(s.x + 8, s.y - 10);
    for (const f of this.figures) if (f.follower.role === "SMITH" && f.carrying) bar(f.gfx.x + 9, f.gfx.y - 9);
  }

  destroy(): void {
    this.carryGfx.destroy();
    for (const b of this.bubbles) b.destroy();
    for (const f of this.figures) f.gfx.destroy();
    this.stationGfx?.destroy();
    this.trainingLabel.destroy();
    this.tasks.clear();
  }

  /** Luzes do acampamento à noite além da fogueira (a tocha da sentinela). */
  lights(): Point[] {
    const out: Point[] = [];
    for (const [s, t] of this.tasks) if (t.activity === "GUARD" && s.isAlive) out.push({ x: s.x, y: s.y });
    return out;
  }

  // --- Soldados ---

  private drive(b: Battalion, s: Soldier, i: number, dt: number): boolean {
    if (!s.isAlive) return false;
    const now = this.scene.time.now;
    let task = this.tasks.get(s);
    if (!task || now > task.until) {
      task = this.choose(b, s, i, now);
      this.tasks.set(s, task);
    }
    const goal = task.path[0] ?? task.spot;
    // Quem leva ferro pega a carga ao passar pela Intendência
    if (task.via && !task.loaded && distance(s, task.via) < 45) task.loaded = true;
    const arrivedNow = s.moveTowards(goal.x, goal.y, dt, task.activity === "PARTY" ? 0.6 : task.activity === "CHORE" || task.activity === "HAUL" ? 0.8 : 0.55);
    if (arrivedNow && task.path.length > 0) task.path.shift();
    const resting = arrivedNow && task.path.length === 0;
    s.unitState = resting ? "IDLE" : "MOVING";
    s.setPose(resting ? task.pose : "STAND");
    if (resting && task.activity === "TRAIN") s.setFacing(s.facing + Math.sin(now / 180 + i) * 0.08);
    if (resting && task.activity === "DRILL") {
      // Fileira golpeia os bonecos (para oeste); os pares de duelo se viram um para o outro
      const pair = i % 4 >= 2;
      s.setFacing((pair ? (i % 2 === 0 ? 0 : Math.PI) : Math.PI) + Math.sin(now / 150 + i * 1.7) * 0.55);
    }
    return true;
  }

  /** O que este soldado vai fazer agora (pelo estado do bando e pela hora). */
  private choose(b: Battalion, s: Soldier, i: number, now: number): Task {
    const st = this.state;
    const r = Math.random();
    const night = st.hour >= 21 || st.hour < 5;
    const quarter = this.camp.quarterSlot(this.quarterOf.get(b.id) ?? 0) ?? this.center;
    const tent = { x: quarter.x, y: quarter.y - 20 };
    const firstSoldier = i === 0 && (this.quarterOf.get(b.id) ?? 0) === 0;
    const jitter = (p: Point, d: number) => ({ x: p.x + (Math.random() - 0.5) * d, y: p.y + (Math.random() - 0.5) * d });
    const make = (activity: Activity, spot: Point, pose: Pose, seconds: number, grouped = false): Task => {
      const path = grouped ? [] : this.camp.findPath(s, spot, s.radius);
      const bubble = BUBBLE[activity];
      return {
        activity,
        path,
        spot,
        pose,
        until: now + seconds * 1000 * (0.7 + Math.random() * 0.6),
        bubble: bubble ? bubble.text[Math.floor(Math.random() * bubble.text.length)] : null,
        bubbleColor: bubble?.color ?? "#ffffff",
        grouped,
      };
    };

    // Treino de verdade: quem foi mandado ao Campo de Treino passa o dia lá
    const trainee = st.training.indexOf(b.id);
    if (trainee >= 0 && !night) return make("DRILL", this.drillSpot(trainee, i), "STAND", 15);
    // Uma sentinela no portão, de noite e de dia
    if (firstSoldier && trainee < 0 && (night || r < 0.5)) return make("GUARD", this.gate, "STAND", 30);
    // Dorme na esteira diante da barraca (a barraca é sólida)
    if (night) return make("SLEEP", { x: tent.x + (Math.random() - 0.5) * 80, y: tent.y + 48 + Math.random() * 22 }, "SLEEP", 40);
    // Feridos de um combate recente: com curandeira, deitados na enfermaria
    if (st.wounded && r < 0.25) {
      if (this.has("HEALER")) return make("WOUNDED", this.cot(i + (this.quarterOf.get(b.id) ?? 0) * 7), "SLEEP", 20);
      return make("SIT", jitter({ x: tent.x, y: tent.y + 70 }, 60), "SIT", 15);
    }
    if (st.rebelId === b.id) return make("CROWD", this.fire, "STAND", 12, true);
    // Tenente: visita um amigo no alojamento dele (ou espera por ele na fogueira)
    const me = this.lieutenantOf.get(b.id);
    if (s.isLieutenant && me && r < 0.45) {
      const pair = st.friends.find(([a, c]) => a === me || c === me);
      if (pair) {
        const friend = pair[0] === me ? pair[1] : pair[0];
        const theirs = [...this.lieutenantOf.entries()].find(([, l]) => l === friend)?.[0];
        const spot = theirs ? (this.camp.quarterSlot(this.quarterOf.get(theirs) ?? 0) ?? this.fire) : this.fire;
        return make("TALK", jitter({ x: spot.x + 70, y: spot.y + 30 }, 30), "STAND", 14);
      }
    }
    if (st.arrears && r < 0.55) return make("WHISPER", quarter, "STAND", 10, true);
    if (st.hungry) {
      if (r < 0.6) return make("QUEUE", this.sites.QUARTERMASTER, "STAND", 12, true);
      return make("SIT", jitter({ x: tent.x, y: tent.y + 70 }, 90), "SIT", 10);
    }
    if (st.party && r < 0.75) return make("PARTY", this.fire, "STAND", 12, true);
    // Dia do soldo: fila diante da tenda do Comandante para receber
    if (st.payday && r < 0.7) return make("PAY", this.sites.TENT, "STAND", 14, true);
    const meal = (st.hour >= 7 && st.hour < 8.5) || (st.hour >= 18 && st.hour < 19.5);
    if (meal && r < 0.8) return make("EAT", this.fire, "SIT", 10, true);
    if (st.lowMorale && r < 0.6) return make("SIT", jitter({ x: tent.x, y: tent.y + 80 }, 110), "SIT", 12);
    // Sermão do capelão (de manhã e no fim da tarde)
    const sermon = (st.hour >= 9 && st.hour < 10) || (st.hour >= 17 && st.hour < 18);
    if (sermon && this.has("CHAPLAIN") && r < 0.5) return make("SERMON", this.stations.CHAPLAIN, "SIT", 12, true);
    // Dia comum
    if (this.has("PEDDLER") && r < 0.12) return make("BROWSE", jitter({ x: this.stations.PEDDLER.x, y: this.stations.PEDDLER.y + 34 }, 50), "STAND", 8);
    if (s.troopType === "CAVALRY" && r < 0.35) return make("STABLE", jitter(this.sites.STABLE, 60), "STAND", 12);
    const roll = Math.random();
    if (roll < 0.3) return make("TRAIN", jitter({ x: this.sites.TRAINING.x - 120, y: this.sites.TRAINING.y }, 140), "STAND", 12);
    if (roll < 0.5) return make("DICE", quarter, "SIT", 12, true);
    // Leva ferro do depósito para a Ferraria (se houver ferro)
    if (roll < 0.58 && st.iron) {
      const via = this.sites.QUARTERMASTER;
      const forge = this.sites.FORGE;
      const task = make("HAUL", forge, "STAND", 25);
      task.path = [...this.camp.findPath(s, via, s.radius), ...this.camp.findPath(via, forge, s.radius)];
      task.via = via;
      task.loaded = false;
      return task;
    }
    if (roll < 0.65) return make("CHORE", Math.random() < 0.5 ? this.sites.FORGE : this.sites.QUARTERMASTER, "STAND", 6);
    if (roll < 0.85) return make("WANDER", this.randomInside(), "STAND", 8);
    return make("SIT", jitter({ x: tent.x, y: tent.y + 75 }, 100), "SIT", 12);
  }

  private randomInside(): Point {
    for (let k = 0; k < 20; k++) {
      const p = { x: this.center.x + (Math.random() - 0.5) * PALISADE.rx * 1.6, y: this.center.y + (Math.random() - 0.5) * PALISADE.ry * 1.6 };
      if (this.camp.contains(p, 40) && !Unit.terrain?.isBlocked(p.x, p.y)) return p;
    }
    return this.fire;
  }

  /** Lugar de cada soldado em treino: fileiras diante dos bonecos e, no fundo, pares de duelo. */
  private drillSpot(battalionIndex: number, i: number): Point {
    const t = this.sites.TRAINING;
    const yard = { x: t.x - 125, y: t.y };
    const k = battalionIndex * 16 + i;
    const col = k % 7;
    const row = Math.floor(k / 7) % 5;
    return { x: yard.x - 95 + col * 32, y: yard.y - 70 + row * 34 };
  }

  /** Esteira na enfermaria da curandeira. */
  private cot(k: number): Point {
    const h = this.stations.HEALER;
    return { x: h.x - 60 + (k % 5) * 30, y: h.y + 40 + (Math.floor(k / 5) % 3) * 26 };
  }

  /** Posições de quem faz algo em grupo: roda na fogueira, fila na Intendência, rodinhas. */
  private arrangeGroups(time: number): void {
    const byActivity = new Map<string, Soldier[]>();
    for (const [s, t] of this.tasks) {
      if (!t.grouped || !s.isAlive) continue;
      const key = t.activity === "WHISPER" || t.activity === "DICE" ? `${t.activity}:${s.battalion.id}` : t.activity;
      const list = byActivity.get(key) ?? [];
      list.push(s);
      byActivity.set(key, list);
    }
    for (const [key, list] of byActivity) {
      const activity = key.split(":")[0] as Activity;
      list.forEach((s, k) => {
        const t = this.tasks.get(s);
        if (!t) return;
        t.spot = this.groupSpot(activity, k, list.length, s, time);
      });
    }
  }

  private groupSpot(activity: Activity, k: number, n: number, s: Soldier, time: number): Point {
    const f = this.fire;
    switch (activity) {
      case "PARTY": {
        // Dança em volta da fogueira: a roda gira devagar
        const a = (k / n) * Math.PI * 2 + time * 0.0005;
        return { x: f.x + Math.cos(a) * 95, y: f.y + Math.sin(a) * 80 };
      }
      case "EAT": {
        // Com cozinheiro: os primeiros fazem fila no caldeirão; o resto come em volta da fogueira
        if (this.has("COOK") && k < 5) {
          const pot = this.stations.COOK;
          return { x: pot.x + 30 + k * 22, y: pot.y + 26 };
        }
        const a = (k / n) * Math.PI * 2;
        return { x: f.x + Math.cos(a) * (75 + (k % 2) * 30), y: f.y + Math.sin(a) * (65 + (k % 2) * 26) };
      }
      case "SERMON": {
        // Meia-lua diante do capelão
        const c = this.stations.CHAPLAIN;
        const a = Math.PI * (0.15 + (0.7 * k) / Math.max(1, n - 1));
        return { x: c.x + Math.cos(a) * (70 + (k % 2) * 26), y: c.y + Math.sin(a) * (50 + (k % 2) * 20) };
      }
      case "QUEUE": {
        const door = this.sites.QUARTERMASTER;
        return { x: door.x + 24 + (k % 9) * 24, y: door.y + 16 + Math.floor(k / 9) * 26 };
      }
      case "PAY": {
        // Fila do pagamento: sai da porta da tenda do Comandante para leste, em fileiras de 8
        const door = this.sites.TENT;
        return { x: door.x + 30 + (k % 8) * 20, y: door.y + 40 + Math.floor(k / 8) * 26 };
      }
      case "CROWD": {
        // Diante da tenda do Comandante, em meia-lua
        const door = this.sites.TENT;
        const a = Math.PI * (0.15 + (0.7 * k) / Math.max(1, n - 1));
        return { x: door.x + Math.cos(a) * 110, y: door.y + 30 + Math.sin(a) * 70 };
      }
      case "WHISPER":
      case "DICE": {
        const quarter = this.camp.quarterSlot(this.quarterOf.get(s.battalion.id) ?? 0) ?? f;
        const c = activity === "WHISPER" ? { x: quarter.x - 70, y: quarter.y + 75 } : { x: quarter.x + 60, y: quarter.y + 85 };
        const a = (k / n) * Math.PI * 2;
        return { x: c.x + Math.cos(a) * 24, y: c.y + Math.sin(a) * 20 };
      }
      default:
        return s;
    }
  }

  // --- Seguidores ---

  private followerHome(role: FollowerRole, i: number): Point {
    const st = this.stations[role];
    return role === "FAMILY" ? { x: st.x + i * 26, y: st.y } : { ...st };
  }

  /**
   * Os seguidores trabalham de verdade: o cozinheiro mexe o caldeirão nas refeições e busca
   * lenha no resto do dia; o mascate atende na banca; a curandeira percorre as esteiras dos
   * feridos; o capelão prega nas horas de sermão e anda pelo acampamento no resto; as famílias
   * estendem roupa no varal.
   */
  private workTarget(fig: FollowerFigure, time: number): { to: Point; wait: number } {
    const st = this.state;
    const home = fig.home;
    const near = (p: Point, d: number) => ({ x: p.x + (Math.random() - 0.5) * d, y: p.y + (Math.random() - 0.5) * d * 0.7 });
    const meal = (st.hour >= 7 && st.hour < 8.5) || (st.hour >= 18 && st.hour < 19.5);
    switch (fig.follower.role) {
      case "COOK":
        if (meal) return { to: near(home, 24), wait: 700 };
        // Fora das refeições: vai à lenha da Intendência e volta ao caldeirão
        return distance({ x: fig.gfx.x, y: fig.gfx.y }, home) < 30 ? { to: { x: this.sites.QUARTERMASTER.x - 150, y: this.sites.QUARTERMASTER.y - 60 }, wait: 1500 } : { to: near(home, 10), wait: 4000 };
      case "PEDDLER":
        return { to: near(home, 30), wait: 2500 + Math.random() * 3000 };
      case "HEALER":
        if (st.wounded) return { to: this.cot(Math.floor(Math.random() * 10)), wait: 1800 };
        return { to: near(home, 40), wait: 3000 };
      case "CHAPLAIN": {
        const sermon = (st.hour >= 9 && st.hour < 10) || (st.hour >= 17 && st.hour < 18);
        if (sermon) return { to: home, wait: 1000 };
        return { to: near(this.fire, 520), wait: 2500 + Math.random() * 4000 };
      }
      case "FAMILY":
        // Ao longo do varal, estendendo e recolhendo roupa
        return { to: { x: this.stations.FAMILY.x + Math.random() * 120, y: this.stations.FAMILY.y + (Math.random() - 0.5) * 20 }, wait: 1500 + Math.random() * 2500 + (time % 7) };
      case "SMITH": {
        // Martela na bigorna; de vez em quando busca ferro na Intendência (e volta carregando)
        const at = { x: fig.gfx.x, y: fig.gfx.y };
        const store = { x: this.sites.QUARTERMASTER.x + 40, y: this.sites.QUARTERMASTER.y + 30 };
        if (distance(at, store) < 30) {
          fig.carrying = st.iron;
          return { to: near(home, 10), wait: 4000 };
        }
        fig.carrying = false;
        if (st.iron && distance(at, home) < 30 && Math.random() < 0.3) return { to: store, wait: 1200 };
        return { to: near(home, 12), wait: 2500 + Math.random() * 2500 };
      }
    }
  }

  private updateFollowers(time: number, dt: number): void {
    const night = this.state.hour >= 21 || this.state.hour < 5;
    for (const fig of this.figures) {
      fig.gfx.setAlpha(night ? 0.45 : 1);
      if (night) continue;
      const g = fig.gfx;
      const d = distance({ x: g.x, y: g.y }, fig.target);
      if (d < 4) {
        // Trabalhando no lugar: o cozinheiro mexe a panela, a curandeira se abaixa
        if (fig.follower.role === "COOK" || fig.follower.role === "HEALER") g.rotation = Math.sin(time / 220) * 0.4;
        // Ajudante na bigorna: martelando
        if (fig.follower.role === "SMITH" && distance({ x: g.x, y: g.y }, fig.home) < 20) g.rotation = Math.abs(Math.sin(time / 120)) * 0.6;
        if (time > fig.waitUntil) {
          const w = this.workTarget(fig, time);
          fig.target = w.to;
          fig.waitUntil = time + w.wait;
        }
        continue;
      }
      g.rotation = 0;
      const step = Math.min(d, 45 * dt);
      g.x += ((fig.target.x - g.x) / d) * step;
      g.y += ((fig.target.y - g.y) / d) * step;
    }
  }

  // --- Balões ---

  private updateBubbles(time: number, near: boolean): void {
    let used = 0;
    if (near) {
      for (const [s, t] of this.tasks) {
        if (used >= MAX_BUBBLES) break;
        if (!t.bubble || !s.isAlive || !s.visible) continue;
        // Cada um fala de vez em quando (não todos ao mesmo tempo)
        const phase = (time + (s.x * 7 + s.y * 13)) % 9000;
        if (phase > (t.activity === "CROWD" || t.activity === "PARTY" ? 4500 : 2600)) continue;
        const b = this.bubbles[used++];
        b.setText(t.bubble).setColor(t.bubbleColor).setPosition(s.x, s.y - s.radius - 16).setVisible(true);
      }
    }
    for (let i = used; i < this.bubbles.length; i++) this.bubbles[i].setVisible(false);
  }
}

/** Estação de trabalho de um seguidor (só desenho). */
function drawStation(g: Phaser.GameObjects.Graphics, role: FollowerRole, at: Point): void {
  switch (role) {
    case "COOK":
      // Trempe com caldeirão e um monte de lenha
      g.lineStyle(3, 0x3b2a17, 1);
      g.lineBetween(at.x - 18, at.y + 14, at.x, at.y - 16);
      g.lineBetween(at.x + 18, at.y + 14, at.x, at.y - 16);
      g.fillStyle(0x2b2b2b, 1);
      g.fillCircle(at.x, at.y, 14);
      g.fillStyle(0x8a6a3a, 1);
      g.fillCircle(at.x, at.y, 9);
      g.fillStyle(0xe67e22, 0.8);
      g.fillCircle(at.x, at.y + 14, 5);
      break;
    case "PEDDLER":
      // Banca com toldo e bugigangas
      g.fillStyle(0x6b4a2b, 1);
      g.fillRect(at.x - 34, at.y + 6, 68, 18);
      g.fillStyle(0x3a6ab8, 0.9);
      g.fillRect(at.x - 38, at.y - 14, 76, 14);
      g.fillStyle(0xf0e6d2, 0.9);
      for (let k = 0; k < 76; k += 16) g.fillRect(at.x - 38 + k, at.y - 14, 8, 14);
      for (const [dx, c] of [[-24, 0xc9a23a], [-8, 0xb84a3a], [8, 0x3a9a5a], [24, 0xd8d8d8]] as [number, number][]) {
        g.fillStyle(c, 1);
        g.fillRect(at.x + dx - 5, at.y + 10, 10, 9);
      }
      break;
    case "HEALER":
      // Tenda da enfermaria com cruz e esteiras
      g.fillStyle(0xe8e0cc, 1);
      g.fillRect(at.x - 34, at.y - 30, 68, 44);
      g.lineStyle(2, COLORS.OUTLINE, 1);
      g.strokeRect(at.x - 34, at.y - 30, 68, 44);
      g.fillStyle(0xc0392b, 1);
      g.fillRect(at.x - 4, at.y - 22, 8, 26);
      g.fillRect(at.x - 13, at.y - 13, 26, 8);
      g.fillStyle(0x9c8660, 0.9);
      for (let k = 0; k < 5; k++) g.fillRect(at.x - 70 + k * 30, at.y + 32, 20, 12);
      break;
    case "CHAPLAIN":
      // Púlpito de caixotes com um estandarte branco
      g.fillStyle(0xb08850, 1);
      g.fillRect(at.x - 12, at.y - 10, 24, 20);
      g.lineStyle(2, COLORS.OUTLINE, 1);
      g.strokeRect(at.x - 12, at.y - 10, 24, 20);
      g.lineStyle(3, 0x6b4a2b, 1);
      g.lineBetween(at.x + 18, at.y + 8, at.x + 18, at.y - 36);
      g.fillStyle(0xf5f0e0, 1);
      g.fillRect(at.x + 18, at.y - 36, 22, 16);
      break;
    case "SMITH":
      // Bigorna num toco, balde d'água e uma pilha de ferro
      g.fillStyle(0x6b4a2b, 1);
      g.fillCircle(at.x, at.y + 4, 12);
      g.fillStyle(0x3a3a3a, 1);
      g.fillRect(at.x - 14, at.y - 6, 28, 10);
      g.fillTriangle(at.x + 14, at.y - 6, at.x + 24, at.y - 2, at.x + 14, at.y + 4);
      g.fillStyle(0x2b4a6b, 1);
      g.fillCircle(at.x - 30, at.y + 10, 8);
      g.fillStyle(0x8a949c, 1);
      for (let k = 0; k < 3; k++) g.fillRect(at.x + 26, at.y + 8 + k * 5, 16, 4);
      break;
    case "FAMILY": {
      // Varal com roupa estendida
      g.lineStyle(3, 0x6b4a2b, 1);
      g.lineBetween(at.x - 10, at.y - 24, at.x - 10, at.y + 6);
      g.lineBetween(at.x + 130, at.y - 24, at.x + 130, at.y + 6);
      g.lineStyle(1.5, 0xd8d0b8, 1);
      g.lineBetween(at.x - 10, at.y - 22, at.x + 130, at.y - 22);
      const colors = [0xc0392b, 0x2e86c1, 0xf5f0e0, 0x7d6608, 0x6c3483];
      for (let k = 0; k < 6; k++) {
        g.fillStyle(colors[k % colors.length], 1);
        g.fillRect(at.x + 4 + k * 20, at.y - 22, 12, 14);
      }
      break;
    }
  }
}

/** Seguidor visto de cima: civil sem armas, com a marca do ofício. */
function drawFollower(g: Phaser.GameObjects.Graphics, role: FollowerRole): void {
  const colors: Record<FollowerRole, number> = { COOK: 0xe8dcc0, PEDDLER: 0x9c6b3c, HEALER: 0x6f8f5a, CHAPLAIN: 0x2b2b2b, FAMILY: 0xb08a6a, SMITH: 0x4a3a2a };
  g.clear();
  if (role === "PEDDLER") {
    // Carroça de bugigangas ao lado
    g.fillStyle(0x6b4a2b, 1);
    g.fillRect(14, -12, 30, 22);
    g.fillStyle(0xc9a23a, 1);
    g.fillRect(18, -8, 8, 8);
    g.fillStyle(0x3a6ab8, 1);
    g.fillRect(30, -6, 8, 8);
  }
  const r = role === "FAMILY" ? 6 : 8;
  g.fillStyle(colors[role], 1);
  g.fillCircle(0, 0, r);
  g.lineStyle(2, COLORS.OUTLINE, 1);
  g.strokeCircle(0, 0, r);
  if (role === "HEALER") {
    g.fillStyle(0xc0392b, 1);
    g.fillRect(-1.5, -5, 3, 10);
    g.fillRect(-5, -1.5, 10, 3);
  } else if (role === "CHAPLAIN") {
    g.fillStyle(0xffffff, 1);
    g.fillRect(-3, -6, 6, 3);
  } else if (role === "COOK") {
    g.fillStyle(0x7a5a3a, 1);
    g.fillCircle(12, 6, 6); // panela
  } else if (role === "FAMILY") {
    g.fillStyle(0xd2b48c, 1);
    g.fillCircle(10, 6, 4); // criança
  } else if (role === "SMITH") {
    // Avental de couro e o martelo
    g.fillStyle(0x7a5a3a, 1);
    g.fillRect(-4, -2, 8, 7);
    g.lineStyle(2, 0x6b4a2b, 1);
    g.lineBetween(6, 0, 15, -6);
    g.fillStyle(0x5a5a5a, 1);
    g.fillRect(12, -10, 7, 5);
  }
}
