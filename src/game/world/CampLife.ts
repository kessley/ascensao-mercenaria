import Phaser from "phaser";
import type { Battalion } from "../entities/Battalion";
import type { Soldier } from "../entities/Soldier";
import { CAMP_SITES, CAMPFIRE, PALISADE, type CampSiteKind } from "../data/campLayout";
import type { CampArea } from "./CampArea";
import type { Follower, FollowerRole } from "../sim/campEvents";
import { COLORS } from "../../utils/constants";
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
  | "STABLE";
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
};

const MAX_BUBBLES = 28;

interface FollowerFigure {
  follower: Follower;
  gfx: Phaser.GameObjects.Graphics;
  home: Point;
  target: Point;
  waitUntil: number;
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
  private state: CampState = { hour: 12, hungry: false, lowMorale: false, arrears: false, rebelId: null, party: false, friends: [] };
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
      before.hungry !== state.hungry ||
      before.arrears !== state.arrears ||
      before.rebelId !== state.rebelId ||
      before.party !== state.party ||
      before.lowMorale !== state.lowMorale ||
      phase(before) !== phase(state);
    if (!changed) return;
    const now = this.scene.time.now;
    for (const t of this.tasks.values()) t.until = Math.min(t.until, now + Math.random() * 1500);
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
  }

  destroy(): void {
    for (const b of this.bubbles) b.destroy();
    for (const f of this.figures) f.gfx.destroy();
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
    const arrivedNow = s.moveTowards(goal.x, goal.y, dt, task.activity === "PARTY" ? 0.6 : task.activity === "CHORE" ? 0.8 : 0.55);
    if (arrivedNow && task.path.length > 0) task.path.shift();
    const resting = arrivedNow && task.path.length === 0;
    s.unitState = resting ? "IDLE" : "MOVING";
    s.setPose(resting ? task.pose : "STAND");
    if (resting && task.activity === "TRAIN") s.setFacing(s.facing + Math.sin(now / 180 + i) * 0.08);
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

    // Uma sentinela no portão, de noite e de dia
    if (firstSoldier && (night || r < 0.5)) return make("GUARD", this.gate, "STAND", 30);
    if (night) return make("SLEEP", jitter({ x: tent.x, y: tent.y - 10 }, 70), "SLEEP", 40);
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
    const meal = (st.hour >= 7 && st.hour < 8.5) || (st.hour >= 18 && st.hour < 19.5);
    if (meal && r < 0.8) return make("EAT", this.fire, "SIT", 10, true);
    if (st.lowMorale && r < 0.6) return make("SIT", jitter({ x: tent.x, y: tent.y + 80 }, 110), "SIT", 12);
    // Dia comum
    if (s.troopType === "CAVALRY" && r < 0.35) return make("STABLE", jitter(this.sites.STABLE, 60), "STAND", 12);
    const roll = Math.random();
    if (roll < 0.3) return make("TRAIN", jitter({ x: this.sites.TRAINING.x - 120, y: this.sites.TRAINING.y }, 140), "STAND", 12);
    if (roll < 0.5) return make("DICE", quarter, "SIT", 12, true);
    if (roll < 0.65) return make("CHORE", Math.random() < 0.5 ? this.sites.FORGE : this.sites.QUARTERMASTER, "STAND", 6);
    if (roll < 0.85) return make("WANDER", this.randomInside(), "STAND", 8);
    return make("SIT", jitter({ x: tent.x, y: tent.y + 75 }, 100), "SIT", 12);
  }

  private randomInside(): Point {
    for (let k = 0; k < 20; k++) {
      const p = { x: this.center.x + (Math.random() - 0.5) * PALISADE.rx * 1.6, y: this.center.y + (Math.random() - 0.5) * PALISADE.ry * 1.6 };
      if (this.camp.contains(p, 40)) return p;
    }
    return this.fire;
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
        const a = (k / n) * Math.PI * 2;
        return { x: f.x + Math.cos(a) * (75 + (k % 2) * 30), y: f.y + Math.sin(a) * (65 + (k % 2) * 26) };
      }
      case "QUEUE": {
        const door = this.sites.QUARTERMASTER;
        return { x: door.x + 24 + (k % 9) * 24, y: door.y + 16 + Math.floor(k / 9) * 26 };
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
    const f = this.fire;
    switch (role) {
      case "COOK":
        return { x: f.x + 46, y: f.y + 44 };
      case "PEDDLER":
        return { x: this.sites.QUARTERMASTER.x - 40, y: this.sites.QUARTERMASTER.y + 70 };
      case "HEALER":
        return { x: this.sites.TENT.x - 150, y: this.sites.TENT.y + 30 };
      case "CHAPLAIN":
        return { x: f.x - 60, y: f.y - 60 };
      case "FAMILY":
        return { x: f.x - 160 + i * 34, y: f.y + 210 };
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
        if (time > fig.waitUntil) {
          // Anda um pouco em volta do posto (o capelão percorre o acampamento)
          const range = fig.follower.role === "CHAPLAIN" ? 360 : fig.follower.role === "FAMILY" ? 120 : 60;
          fig.target = { x: fig.home.x + (Math.random() - 0.5) * range, y: fig.home.y + (Math.random() - 0.5) * range * 0.7 };
          fig.waitUntil = time + 2500 + Math.random() * 5000;
        }
        continue;
      }
      const step = Math.min(d, 40 * dt);
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

/** Seguidor visto de cima: civil sem armas, com a marca do ofício. */
function drawFollower(g: Phaser.GameObjects.Graphics, role: FollowerRole): void {
  const colors: Record<FollowerRole, number> = { COOK: 0xe8dcc0, PEDDLER: 0x9c6b3c, HEALER: 0x6f8f5a, CHAPLAIN: 0x2b2b2b, FAMILY: 0xb08a6a };
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
  }
}
