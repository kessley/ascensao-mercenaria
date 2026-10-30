import Phaser from "phaser";
import { tournamentRival } from "../data/courtTalk";
import { useGameStore } from "../../store/useGameStore";
import { COLORS } from "../../utils/constants";
import { angleTo, distance } from "../../utils/math";

type Stance = "IDLE" | "WINDUP" | "RECOVER" | "BLOCK" | "STAGGER";

interface Fighter {
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  stamina: number;
  stance: Stance;
  /** Segundos que faltam no estado atual. */
  timer: number;
  blockedAt: number;
  facing: number;
  gfx: Phaser.GameObjects.Graphics;
  color: number;
}

const ARENA_R = 300;
const CX = 640;
const CY = 380;
const REACH = 74;
const STEP = 190;

/**
 * Duelo na Liça (Marco 15): um contra um, em tempo real, até a rendição. O golpe avisa antes (o
 * arco vermelho): dá para sair do alcance ou bloquear. Bloquear na hora certa atordoa quem atacou;
 * bloquear cansa, e sem fôlego não há bloqueio. Ninguém morre: quem perde cede.
 */
export class DuelScene extends Phaser.Scene {
  private me!: Fighter;
  private foe!: Fighter;
  private keys!: Record<string, Phaser.Input.Keyboard.Key>;
  private hud!: Phaser.GameObjects.Graphics;
  private arc!: Phaser.GameObjects.Graphics;
  private title!: Phaser.GameObjects.Text;
  private tip!: Phaser.GameObjects.Text;
  private over = false;
  private think = 0;
  private skill = 3;
  private aggressive = false;
  private from: "CapitalScene" | "WorldScene" = "CapitalScene";

  constructor() {
    super("DuelScene");
  }

  create(): void {
    const duel = useGameStore.getState().duel;
    this.from = duel?.from ?? "CapitalScene";
    if (!duel) {
      this.finish("");
      return;
    }
    useGameStore.getState().setCampPrompt(null);
    this.over = false;
    this.think = 1;
    this.skill = duel.skill;
    this.aggressive = duel.aggressive;
    this.cameras.main.setBackgroundColor(0x2a2418).fadeIn(220, 0, 0, 0);
    const g = this.add.graphics();
    g.fillStyle(0xd8c070, 1);
    g.fillCircle(CX, CY, ARENA_R);
    g.lineStyle(10, 0x6b4a2b, 1);
    g.strokeCircle(CX, CY, ARENA_R);
    g.lineStyle(2, 0xa89040, 0.6);
    g.strokeCircle(CX, CY, 90);
    this.arc = this.add.graphics().setDepth(2);
    this.hud = this.add.graphics().setDepth(5);
    this.me = this.fighter(CX - 150, CY, 110, COLORS.ALLY);
    this.foe = this.fighter(CX + 150, CY, 70 + this.skill * 9, 0xc0503a);
    this.foe.facing = Math.PI;
    const round = duel.tournament ? ` · ${duel.tournament.round}ª rodada do torneio` : "";
    this.title = this.add.text(CX, 24, `Liça${round}`, { fontFamily: "monospace", fontSize: "18px", color: "#ffe9b0", stroke: "#000000", strokeThickness: 4 }).setOrigin(0.5).setDepth(6);
    const small = { fontFamily: "monospace", fontSize: "13px", color: "#ffffff", stroke: "#000000", strokeThickness: 3 };
    this.add.text(170, 36, "Comandante", small).setDepth(6);
    this.add.text(1110, 36, duel.opponent, small).setOrigin(1, 0).setDepth(6);
    this.tip = this.add.text(CX, 700, "WASD anda · Espaço golpeia · Shift bloqueia (na hora certa, atordoa) · o arco vermelho avisa o golpe", { fontFamily: "monospace", fontSize: "13px", color: "#d8d8d8", stroke: "#000000", strokeThickness: 3 }).setOrigin(0.5).setDepth(6);
    const keyboard = this.input.keyboard;
    if (!keyboard) throw new Error("Teclado indisponível");
    this.keys = keyboard.addKeys("W,A,S,D,SPACE,SHIFT,UP,DOWN,LEFT,RIGHT") as Record<string, Phaser.Input.Keyboard.Key>;
    this.keys.SPACE.on("down", () => this.strike(this.me));
    if (import.meta.env.DEV) (window as unknown as { __duel?: DuelScene }).__duel = this;
  }

  private fighter(x: number, y: number, hp: number, color: number): Fighter {
    const gfx = this.add.graphics().setDepth(3);
    return { x, y, hp, maxHp: hp, stamina: 100, stance: "IDLE", timer: 0, blockedAt: -1, facing: 0, gfx, color };
  }

  private strike(f: Fighter): void {
    if (this.over || f.stance !== "IDLE" || f.stamina < 16) return;
    f.stamina -= 16;
    f.stance = "WINDUP";
    f.timer = f === this.me ? 0.24 : Math.max(0.26, 0.5 - this.skill * 0.025);
  }

  update(_t: number, delta: number): void {
    if (this.over) return;
    const dt = Math.min(delta, 50) / 1000;
    this.tick(this.me, dt);
    this.tick(this.foe, dt);
    this.moveMe(dt);
    this.foeAi(dt);
    this.draw();
  }

  private tick(f: Fighter, dt: number): void {
    f.stamina = Math.min(100, f.stamina + (f.stance === "BLOCK" ? 6 : 24) * dt);
    if (f.stance === "IDLE" || f.stance === "BLOCK") return;
    f.timer -= dt;
    if (f.timer > 0) return;
    if (f.stance === "WINDUP") {
      this.resolve(f, f === this.me ? this.foe : this.me);
      if (this.over) return;
      if (f.stance === "WINDUP") {
        f.stance = "RECOVER";
        f.timer = 0.34;
      }
      return;
    }
    f.stance = "IDLE";
  }

  private resolve(a: Fighter, b: Fighter): void {
    const d = distance(a, b);
    const toB = angleTo(a, b);
    const off = Math.abs(Phaser.Math.Angle.Wrap(toB - a.facing));
    if (d > REACH || off > 1.05) return;
    const dmg = a === this.me ? 15 + Math.random() * 6 : 9 + this.skill * 1.1 + Math.random() * 4;
    const facing = Math.abs(Phaser.Math.Angle.Wrap(angleTo(b, a) - b.facing)) < 1.3;
    if (b.stance === "BLOCK" && facing && b.stamina > 0) {
      b.stamina = Math.max(0, b.stamina - 16);
      const perfect = this.time.now - b.blockedAt < 240;
      b.hp -= dmg * 0.1;
      if (perfect) {
        a.stance = "STAGGER";
        a.timer = 0.9;
      }
      return;
    }
    b.hp -= dmg;
    b.stance = "STAGGER";
    b.timer = 0.28;
    const push = 26;
    b.x += Math.cos(toB) * push;
    b.y += Math.sin(toB) * push;
    this.clampArena(b);
    if (b.hp <= 0) this.end(b === this.foe);
  }

  private clampArena(f: Fighter): void {
    const d = distance(f, { x: CX, y: CY });
    if (d <= ARENA_R - 24) return;
    f.x = CX + ((f.x - CX) / d) * (ARENA_R - 24);
    f.y = CY + ((f.y - CY) / d) * (ARENA_R - 24);
  }

  private moveMe(dt: number): void {
    const f = this.me;
    const k = this.keys;
    const blocking = k.SHIFT.isDown && f.stamina > 2 && (f.stance === "IDLE" || f.stance === "BLOCK");
    if (blocking && f.stance === "IDLE") {
      f.stance = "BLOCK";
      f.blockedAt = this.time.now;
    }
    if (!blocking && f.stance === "BLOCK") f.stance = "IDLE";
    f.facing = angleTo(f, this.foe);
    if (f.stance === "STAGGER") return;
    let vx = 0;
    let vy = 0;
    if (k.A.isDown || k.LEFT.isDown) vx -= 1;
    if (k.D.isDown || k.RIGHT.isDown) vx += 1;
    if (k.W.isDown || k.UP.isDown) vy -= 1;
    if (k.S.isDown || k.DOWN.isDown) vy += 1;
    if (vx === 0 && vy === 0) return;
    const len = Math.hypot(vx, vy);
    const speed = STEP * (f.stance === "BLOCK" ? 0.4 : f.stance === "WINDUP" ? 0.5 : 1);
    f.x += (vx / len) * speed * dt;
    f.y += (vy / len) * speed * dt;
    this.clampArena(f);
  }

  /** O adversário: quanto melhor, mais depressa lê o golpe, mais bloqueia e menos erra a distância. */
  private foeAi(dt: number): void {
    const f = this.foe;
    const me = this.me;
    f.facing = angleTo(f, me);
    if (f.stance === "STAGGER") return;
    const d = distance(f, me);
    this.think -= dt;
    if (me.stance === "WINDUP" && d < REACH + 20 && f.stance === "IDLE" && Math.random() < this.skill * 0.09 * dt * 8 && f.stamina > 20) {
      f.stance = "BLOCK";
      f.blockedAt = this.time.now - 100;
      f.timer = 0.4;
    }
    if (f.stance === "BLOCK") {
      f.timer -= dt;
      if (f.timer <= 0) f.stance = "IDLE";
      return;
    }
    if (this.think <= 0) {
      this.think = 0.5 + Math.random() * (1.3 - this.skill * 0.08);
      if (d < REACH + 8 && (this.aggressive || Math.random() < 0.7)) this.strike(f);
    }
    const want = this.aggressive ? REACH - 14 : REACH + 6;
    const speed = STEP * (0.62 + this.skill * 0.03) * (f.stance === "WINDUP" ? 0.4 : 1);
    const dir = d > want ? 1 : d < want - 18 ? -1 : 0;
    const sway = Math.sin(this.time.now / 500) * 0.6;
    f.x += (Math.cos(f.facing + sway) * dir + Math.cos(f.facing + Math.PI / 2) * sway * 0.5) * speed * dt;
    f.y += (Math.sin(f.facing + sway) * dir + Math.sin(f.facing + Math.PI / 2) * sway * 0.5) * speed * dt;
    this.clampArena(f);
  }

  private draw(): void {
    const paint = (f: Fighter) => {
      const g = f.gfx;
      g.clear();
      g.fillStyle(f.stance === "STAGGER" ? 0xffffff : f.color, 1);
      g.fillCircle(0, 0, 20);
      g.lineStyle(3, COLORS.OUTLINE, 1);
      g.strokeCircle(0, 0, 20);
      g.lineStyle(5, 0xe8e8e8, 1);
      const len = f.stance === "WINDUP" ? 26 : 44;
      g.lineBetween(0, 0, Math.cos(f.facing) * len, Math.sin(f.facing) * len);
      if (f.stance === "BLOCK") {
        g.lineStyle(8, 0x8fa6b8, 1);
        g.beginPath();
        g.arc(0, 0, 28, f.facing - 0.9, f.facing + 0.9);
        g.strokePath();
      }
      g.setPosition(f.x, f.y);
    };
    paint(this.me);
    paint(this.foe);
    const a = this.arc;
    a.clear();
    for (const f of [this.me, this.foe]) {
      if (f.stance !== "WINDUP") continue;
      a.fillStyle(f === this.me ? 0x60a0ff : 0xff3030, 0.35);
      a.slice(f.x, f.y, REACH, f.facing - 1.05, f.facing + 1.05);
      a.fillPath();
    }
    const h = this.hud;
    h.clear();
    const bar = (x: number, f: Fighter, color: number) => {
      h.fillStyle(0x000000, 0.7);
      h.fillRect(x, 54, 300, 26);
      h.fillStyle(color, 1);
      h.fillRect(x + 2, 56, 296 * Math.max(0, f.hp / f.maxHp), 14);
      h.fillStyle(0xe0c040, 1);
      h.fillRect(x + 2, 72, 296 * (f.stamina / 100), 6);
    };
    bar(170, this.me, 0x60b060);
    bar(810, this.foe, 0xc05040);
  }

  /** Fim da luta: mostra o resultado e volta à cidade, ou segue para a próxima rodada. */
  private end(won: boolean): void {
    this.over = true;
    const store = useGameStore.getState();
    const duel = store.duel;
    this.title.setText(won ? "O adversário se rende!" : "O Comandante se rende.");
    this.tip.setText("");
    this.time.delayedCall(1300, () => {
      if (won && duel?.tournament && duel.tournament.round < 3) {
        const next = duel.tournament.round + 1;
        const rival = tournamentRival(duel.tournament.townId, next);
        store.setDuel({ ...duel, opponent: rival.name, skill: rival.skill, aggressive: rival.aggressive, tournament: { ...duel.tournament, round: next } });
        this.scene.restart();
        return;
      }
      const text = store.duelOver(won);
      store.setDuel(null);
      this.finish(text);
    });
  }

  private finish(text: string): void {
    this.scene.wake(this.from, { after: "duelover", text });
    this.scene.stop();
  }
}
