import Phaser from "phaser";
import { tournamentRival } from "../data/courtTalk";
import { aiPace, aiSpeed, duelAi, makeFighter, makeMind, reachOf, startDuel, stepDuel, WEAPONS, type DuelFighter, type DuelInput, type DuelMind, type DuelState } from "../sim/duel";
import { useGameStore } from "../../store/useGameStore";
import { COLORS, DUEL, GAME_HEIGHT, GAME_WIDTH } from "../../utils/constants";

const ARENA_R = 300;
const CX = 640;
const CY = 380;

/** O que cada lance diz em cima de quem levou. */
const SAY: Partial<Record<string, string>> = {
  PARRY: "Aparou!",
  BREAK: "Guarda quebrada!",
  EVADE: "Esquivou!",
  FEINT: "Fingiu!",
};

/**
 * Duelo na Liça (Marco 15), com as regras do duelo em campo (Marco 21, `sim/duel.ts`): um contra
 * um, em tempo real, até a rendição. Todo golpe avisa antes (o arco vermelho; o pesado, mais
 * largo e escuro). Ninguém morre: quem perde cede.
 */
export class DuelScene extends Phaser.Scene {
  private duel!: DuelState;
  private mind!: DuelMind;
  private gfx = new Map<DuelFighter, Phaser.GameObjects.Graphics>();
  private keys!: Record<string, Phaser.Input.Keyboard.Key>;
  private hud!: Phaser.GameObjects.Graphics;
  private arc!: Phaser.GameObjects.Graphics;
  private title!: Phaser.GameObjects.Text;
  private tip!: Phaser.GameObjects.Text;
  /** Apertos desde o último passo. */
  private pressed: Pick<DuelInput, "light" | "heavy" | "shove" | "dodge"> = {};
  private over = false;
  private from: "CapitalScene" | "WorldScene" = "CapitalScene";

  constructor() {
    super("DuelScene");
  }

  create(): void {
    const spec = useGameStore.getState().duel;
    this.from = spec?.from ?? "CapitalScene";
    if (!spec) {
      this.finish("");
      return;
    }
    useGameStore.getState().setCampPrompt(null);
    this.over = false;
    this.pressed = {};
    this.gfx.clear();
    // O quadro da arena (1280×720) fica no meio de qualquer tamanho de tela
    this.cameras.main.setBackgroundColor(0x2a2418).centerOn(GAME_WIDTH / 2, GAME_HEIGHT / 2).fadeIn(220, 0, 0, 0);
    const g = this.add.graphics();
    g.fillStyle(0xd8c070, 1);
    g.fillCircle(CX, CY, ARENA_R);
    g.lineStyle(10, 0x6b4a2b, 1);
    g.strokeCircle(CX, CY, ARENA_R);
    g.lineStyle(2, 0xa89040, 0.6);
    g.strokeCircle(CX, CY, 90);
    this.arc = this.add.graphics().setDepth(2);
    this.hud = this.add.graphics().setDepth(5);
    const skill = spec.skill;
    const me = makeFighter({ name: "Comandante", x: CX - 150, y: CY, armor: 0.1 });
    const foe = makeFighter({ name: spec.opponent, x: CX + 150, y: CY, maxHp: 80 + skill * 5, armor: 0.1, pace: aiPace(skill), speed: aiSpeed(skill) });
    this.duel = startDuel(me, foe, { center: { x: CX, y: CY }, radius: ARENA_R - 24 });
    this.mind = makeMind(spec.aggressive ? "AGGRESSIVE" : "STEADY", skill);
    for (const [f, color] of [[me, COLORS.ALLY], [foe, 0xc0503a]] as const) this.gfx.set(f, this.add.graphics().setDepth(3).setData("color", color));
    const round = spec.tournament ? ` · ${spec.tournament.round}ª rodada do torneio` : "";
    this.title = this.add.text(CX, 24, `Liça${round}`, { fontFamily: "monospace", fontSize: "18px", color: "#ffe9b0", stroke: "#000000", strokeThickness: 4 }).setOrigin(0.5).setDepth(6);
    const small = { fontFamily: "monospace", fontSize: "13px", color: "#ffffff", stroke: "#000000", strokeThickness: 3 };
    this.add.text(170, 36, "Comandante", small).setDepth(6);
    this.add.text(1110, 36, spec.opponent, small).setOrigin(1, 0).setDepth(6);
    this.tip = this.add
      .text(CX, 694, "WASD anda · Espaço ou clique: golpe leve · Q ou botão direito: pesado · Shift: bloquear (na hora certa, apara)\nF: esquiva · E: empurrão · o arco vermelho avisa o golpe; o largo e escuro é o pesado", { fontFamily: "monospace", fontSize: "13px", color: "#d8d8d8", stroke: "#000000", strokeThickness: 3, align: "center" })
      .setOrigin(0.5)
      .setDepth(6);
    const keyboard = this.input.keyboard;
    if (!keyboard) throw new Error("Teclado indisponível");
    this.keys = keyboard.addKeys("W,A,S,D,SPACE,SHIFT,Q,E,F,UP,DOWN,LEFT,RIGHT") as Record<string, Phaser.Input.Keyboard.Key>;
    this.keys.SPACE.on("down", () => (this.pressed.light = true));
    this.keys.Q.on("down", () => (this.pressed.heavy = true));
    this.keys.E.on("down", () => (this.pressed.shove = true));
    this.keys.F.on("down", () => (this.pressed.dodge = true));
    this.input.mouse?.disableContextMenu();
    this.input.on("pointerdown", (p: Phaser.Input.Pointer) => {
      if (p.rightButtonDown()) this.pressed.heavy = true;
      else if (p.leftButtonDown()) this.pressed.light = true;
    });
    if (import.meta.env.DEV) (window as unknown as { __duel?: DuelScene }).__duel = this;
  }

  update(_t: number, delta: number): void {
    if (this.over) return;
    const dt = Math.min(delta, 50) / 1000;
    const d = this.duel;
    stepDuel(d, dt, this.myInput(), duelAi(d, d.b, this.mind, dt));
    this.pressed = {};
    for (const e of d.events) {
      const text = SAY[e.kind];
      if (text) this.float(e.kind === "PARRY" || e.kind === "EVADE" ? e.to : e.by, text);
    }
    d.events.length = 0;
    this.draw();
    if (d.winner) this.end(d.winner === d.a);
    else if (d.timedOut) this.end(d.a.hp / d.a.maxHp >= d.b.hp / d.b.maxHp);
  }

  private myInput(): DuelInput {
    const k = this.keys;
    let dx = 0;
    let dy = 0;
    if (k.A.isDown || k.LEFT.isDown) dx -= 1;
    if (k.D.isDown || k.RIGHT.isDown) dx += 1;
    if (k.W.isDown || k.UP.isDown) dy -= 1;
    if (k.S.isDown || k.DOWN.isDown) dy += 1;
    return { dx, dy, block: k.SHIFT.isDown, ...this.pressed };
  }

  /** Uma palavra que sobe e some em cima de quem fez o lance. */
  private float(f: DuelFighter, text: string): void {
    const t = this.add.text(f.x, f.y - 34, text, { fontFamily: "monospace", fontSize: "14px", color: "#ffe9b0", stroke: "#000000", strokeThickness: 3 }).setOrigin(0.5).setDepth(6);
    this.tweens.add({ targets: t, y: t.y - 26, alpha: 0, duration: 800, onComplete: () => t.destroy() });
  }

  private draw(): void {
    const d = this.duel;
    for (const [f, g] of this.gfx) {
      g.clear();
      const color = g.getData("color") as number;
      g.fillStyle(f.stance === "STAGGER" ? 0xffffff : color, f.stance === "DODGE" ? 0.5 : 1);
      g.fillCircle(0, 0, DUEL.BODY);
      g.lineStyle(3, COLORS.OUTLINE, 1);
      g.strokeCircle(0, 0, DUEL.BODY);
      g.lineStyle(f.weapon === "AXE" ? 7 : 5, 0xe8e8e8, 1);
      // A arma recua no aviso (mais no pesado) e estica no golpe
      const reach = WEAPONS[f.weapon].reach * 0.6;
      const len = f.stance === "WINDUP" ? (f.move === "HEAVY" ? reach * 0.3 : reach * 0.55) : reach;
      const back = f.stance === "WINDUP" && f.move === "HEAVY" ? -0.9 : 0;
      g.lineBetween(0, 0, Math.cos(f.facing + back) * len, Math.sin(f.facing + back) * len);
      if (f.stance === "BLOCK") {
        g.lineStyle(8, 0x8fa6b8, 1);
        g.beginPath();
        g.arc(0, 0, 28, f.facing - 0.9, f.facing + 0.9);
        g.strokePath();
      }
      g.setPosition(f.x, f.y);
    }
    const a = this.arc;
    a.clear();
    for (const f of [d.a, d.b]) {
      if (f.stance !== "WINDUP" || !f.move) continue;
      const heavy = f.move === "HEAVY";
      const half = f.move === "SHOVE" ? DUEL.SHOVE.ARC : DUEL[f.move].ARC;
      const reach = f.move === "SHOVE" ? DUEL.SHOVE.REACH : reachOf(d, f);
      a.fillStyle(f === d.a ? 0x60a0ff : heavy ? 0xa01010 : 0xff3030, heavy ? 0.5 : 0.35);
      a.slice(f.x, f.y, reach, f.facing - half, f.facing + half);
      a.fillPath();
    }
    const h = this.hud;
    h.clear();
    const bar = (x: number, f: DuelFighter, color: number) => {
      h.fillStyle(0x000000, 0.7);
      h.fillRect(x, 54, 300, 34);
      h.fillStyle(color, 1);
      h.fillRect(x + 2, 56, 296 * Math.max(0, f.hp / f.maxHp), 14);
      h.fillStyle(0xe0c040, 1);
      h.fillRect(x + 2, 72, 296 * (f.stamina / DUEL.STAMINA), 6);
      // Postura: enche a cada golpe bloqueado; cheia, a guarda quebra
      h.fillStyle(f.posture > 75 ? 0xff7040 : 0xc8c8c8, 1);
      h.fillRect(x + 2, 80, 296 * (f.posture / 100), 6);
    };
    bar(170, d.a, 0x60b060);
    bar(810, d.b, 0xc05040);
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
