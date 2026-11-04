import Phaser from "phaser";
import { addCanvasTexture } from "../art/canvasTexture";
import type { Look, Weapon } from "../art/figures";
import { pixelGround } from "../art/ground";
import { commanderLook } from "../art/looks";
import { tournamentRival } from "../data/courtTalk";
import { Extra } from "../entities/Extra";
import { Unit } from "../entities/Unit";
import { aiPace, aiSpeed, duelAi, makeFighter, makeMind, reachOf, startDuel, stepDuel, type DuelFighter, type DuelInput, type DuelMind, type DuelState } from "../sim/duel";
import { paintStands } from "../world/capitalPaint";
import { poseOf } from "./worldScene/duel";
import { useGameStore } from "../../store/useGameStore";
import { DUEL, GAME_HEIGHT, GAME_WIDTH } from "../../utils/constants";

const ARENA_R = 300;
const CX = 640;
const CY = 380;
const ARENA_KEY = "lica-duelo";

/** O lutador na Liça, no dobro do tamanho (desenhado em resolução dobrada, sem engrossar o pixel). */
function duelistLook(base: Look, weapon: DuelFighter["weapon"]): Look {
  const w: Weapon = weapon === "SPEAR" ? "SPEAR" : weapon === "AXE" ? "AXE" : "SWORD";
  return { ...base, weapon: w, shield: weapon === "SHIELD" ? "KITE" : base.shield, scale: 2 };
}

/** O adversário: cavaleiro de placas, com o tabardo vermelho e o friso de ouro. */
const RIVAL: Look = { body: "HUMAN", head: "HELM", armor: 2, weapon: "SWORD", shield: "ROUND", mount: "NONE", color: 0xc0503a, trim: 0xe0b040, cape: 0x5a1a1a };

/** O chão da Liça em pixel art: a areia (com o filtro do chão), a arquibancada cheia e a cerca. Uma vez só. */
function arenaTexture(scene: Phaser.Scene): void {
  if (scene.textures.exists(ARENA_KEY)) return;
  const canvas = document.createElement("canvas");
  canvas.width = GAME_WIDTH;
  canvas.height = GAME_HEIGHT;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return;
  ctx.fillStyle = "#7d6f50";
  ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
  ctx.fillStyle = "#d8c070";
  for (let y = CY - ARENA_R; y < CY + ARENA_R; y++) {
    const dy = y + 0.5 - CY;
    const hw = Math.round(Math.sqrt(Math.max(0, ARENA_R * ARENA_R - dy * dy)));
    ctx.fillRect(CX - hw, y, hw * 2, 1);
  }
  const img = ctx.getImageData(0, 0, GAME_WIDTH, GAME_HEIGHT);
  pixelGround(img.data, GAME_WIDTH, GAME_HEIGHT, 0, 0, 0);
  ctx.putImageData(img, 0, 0);
  paintStands(ctx, CX, CY, 720, 470, ARENA_R, ARENA_R, 0, GAME_HEIGHT, false);
  addCanvasTexture(scene.textures, ARENA_KEY, canvas)?.setFilter(Phaser.Textures.FilterMode.NEAREST);
}

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
  private figs = new Map<DuelFighter, Extra>();
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
    this.figs.clear();
    // O quadro da arena (1280×720) fica no meio de qualquer tamanho de tela
    this.cameras.main.setBackgroundColor(0x2a2418).centerOn(GAME_WIDTH / 2, GAME_HEIGHT / 2).fadeIn(220, 0, 0, 0);
    arenaTexture(this);
    if (this.textures.exists(ARENA_KEY)) this.add.image(0, 0, ARENA_KEY).setOrigin(0, 0).setDepth(-1);
    // O aviso do golpe fica no chão, debaixo das figuras
    this.arc = this.add.graphics().setDepth(-0.5);
    this.hud = this.add.graphics().setDepth(5);
    const skill = spec.skill;
    const me = makeFighter({ name: "Comandante", x: CX - 150, y: CY, armor: 0.1 });
    const foe = makeFighter({ name: spec.opponent, x: CX + 150, y: CY, maxHp: 80 + skill * 5, armor: 0.1, pace: aiPace(skill), speed: aiSpeed(skill) });
    this.duel = startDuel(me, foe, { center: { x: CX, y: CY }, radius: ARENA_R - 24 });
    this.mind = makeMind(spec.aggressive ? "AGGRESSIVE" : "STEADY", skill);
    for (const [f, look] of [[me, commanderLook()], [foe, RIVAL]] as const) {
      const fig = new Extra(this, f.x, f.y, duelistLook(look, f.weapon), DUEL.BODY);
      fig.setOwnLod("FULL");
      this.figs.set(f, fig);
    }
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

  update(time: number, delta: number): void {
    Unit.animateAll(time, this.cameras.main.worldView, this);
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
    const t = this.add.text(f.x, f.y - 74, text, { fontFamily: "monospace", fontSize: "14px", color: "#ffe9b0", stroke: "#000000", strokeThickness: 3 }).setOrigin(0.5).setDepth(6);
    this.tweens.add({ targets: t, y: t.y - 26, alpha: 0, duration: 800, onComplete: () => t.destroy() });
  }

  private draw(): void {
    const d = this.duel;
    // As figuras: o lugar, a direção e a pose do momento (armar, golpear, guarda, esquiva, tropeço)
    for (const [f, fig] of this.figs) {
      fig.x = f.x;
      fig.y = f.y;
      fig.setFacing(f.facing);
      fig.duelPose = poseOf(f, d.time);
      fig.setAlpha(f.stance === "DODGE" ? 0.7 : 1);
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
