import type { Enemy } from "../../entities/Enemy";
import { Soldier } from "../../entities/Soldier";
import { Unit } from "../../entities/Unit";
import { lodOf } from "../../art/atlas";
import { ANIM } from "../../art/figures";
import { timeRate } from "../../gameClock";
import { aiPace, aiSpeed, duelAi, fateOf, makeFighter, makeMind, reachOf, startDuel, stepDuel, type DuelEvent, type DuelFate, type DuelFighter, type DuelInput, type DuelMind, type DuelState, type DuelTemper } from "../../sim/duel";
import { duelSkill, heroTemper, seeksDuel } from "../../data/heroes";
import type { CaptainData } from "../../data/captains";
import type { WarHost } from "../../systems/WarHost";
import { useGameStore, type DuelHud } from "../../../store/useGameStore";
import { BALANCE, DUEL, FIELD_DUEL, PRISONERS, REPUTE } from "../../../utils/constants";
import { sfx } from "../../../audio/sounds";
import { angleTo, centroid, distance, type Point } from "../../../utils/math";
import type { WorldScene } from "../WorldScene";

/** Um duelo em curso no meio da batalha. */
export interface FieldDuel {
  /** `a` = o nosso (o Comandante ou um capitão), `b` = o herói inimigo. */
  state: DuelState;
  ours: Unit;
  hero: Enemy;
  /** O capitão nosso desafiado (null = o Comandante). */
  captain: CaptainData | null;
  /** A cabeça do nosso lado (null = o jogador nas teclas) e a do herói. */
  minds: { a: DuelMind | null; b: DuelMind };
  /** Sem o Comandante: a batalha não desacelera nem a câmera muda. */
  auto: boolean;
  /** Vida de cada um quando o duelo abriu (quem já estava ferido arrisca mais). */
  start: { ours: number; hero: number };
  /** Zoom de antes, para devolver no fim. */
  zoom: number;
  /** Quem parou para olhar. */
  watchers: Set<Unit>;
}

/** O que cada lance diz em cima de quem fez (ou de quem aparou e esquivou). */
const SAY: Partial<Record<DuelEvent["kind"], string>> = {
  PARRY: "Aparou!",
  BREAK: "Guarda quebrada!",
  EVADE: "Esquivou!",
  FEINT: "Fingiu!",
};

/** A pose da figura conforme o momento do duelo (null = a animação comum, parada ou andando). Também na Liça. */
export function poseOf(f: DuelFighter, now: number): number | null {
  switch (f.stance) {
    case "WINDUP":
      return f.move === "HEAVY" ? ANIM.HEAVY : f.move === "SHOVE" ? ANIM.ATTACK + 2 : ANIM.ATTACK;
    case "RECOVER":
      return now - f.since < 0.14 ? ANIM.ATTACK + 1 : ANIM.ATTACK + 2;
    case "BLOCK":
      return ANIM.GUARD;
    case "DODGE":
      return ANIM.DODGE;
    case "STAGGER":
      return ANIM.STAGGER;
    default:
      return null;
  }
}

/** O jeito de lutar de um capitão nosso, pelos traços. */
function captainTemper(c: CaptainData): DuelTemper {
  if (c.traits.includes("BRAVE") || c.traits.includes("BLOODTHIRSTY") || c.traits.includes("AMBITIOUS")) return "AGGRESSIVE";
  return c.traits.includes("CAUTIOUS") ? "PATIENT" : "STEADY";
}

const clampMorale = (v: number) => Math.max(0, Math.min(BALANCE.MORALE.MAX, v));

/**
 * O duelo no campo (Marco 21, parte 3): o herói inimigo que procura briga vai atrás do Comandante;
 * a 60 px dele, o anel se abre, a batalha em volta anda em câmera lenta e os dois lutam pelas regras
 * de `sim/duel.ts`, as mesmas da Liça. Contra um capitão nosso, as duas cabeças lutam sozinhas.
 * Uma parte da `WorldScene`: os métodos entram no protótipo dela (ver o fim de `WorldScene.ts`).
 */
export const duelMethods = {
  /** Começo de campo novo: nenhum duelo, ninguém duelou ainda. */
  resetDuels(this: WorldScene): void {
    this.fieldDuel = null;
    this.duelCooldownUntil = -Infinity;
    this.duelLookAt = 0;
    this.duelDone = new WeakSet();
    this.duelTaken = new Set();
    this.duelSeekers = new Set();
    this.duelPressed = {};
    this.duelGfx = this.add.graphics().setDepth(-2);
  },

  /** O Comandante está no anel: as teclas e o mouse são do duelo, e a voz dele não chega à tropa. */
  inDuel(this: WorldScene): boolean {
    return !!this.fieldDuel && !this.fieldDuel.auto;
  },

  /** Um aperto do jogador no duelo (vale no próximo passo). */
  duelPress(this: WorldScene, move: "light" | "heavy" | "shove" | "dodge"): void {
    this.duelPressed[move] = true;
  },

  // --- Antes do anel ---

  /**
   * Quem procura o Comandante sai do esquadrão e vai atrás dele enquanto ele estiver por perto (e
   * derruba quem estiver no caminho). Longe demais, ou com outro duelo no campo, volta para os seus.
   */
  seekDuels(this: WorldScene, active: readonly Enemy[]): void {
    const c = this.commander;
    const open = c.isAlive && !this.inCamp && !this.fieldDuel;
    for (const e of active) {
      const h = e.hero;
      if (!h || !seeksDuel(h)) continue;
      const wants = open && e.hostile && !e.routed && !this.duelDone.has(e) && distance(e, c) <= FIELD_DUEL.SEEK;
      if (wants && !e.driver) {
        e.driver = (dt) => this.driveSeeker(e, dt);
        this.duelSeekers.add(e);
      } else if (!wants && this.duelSeekers.has(e)) {
        e.driver = null;
        e.target = null;
        this.duelSeekers.delete(e);
      }
    }
  },

  driveSeeker(this: WorldScene, e: Enemy, dt: number): void {
    const c = this.commander;
    const now = this.time.now;
    if (now >= e.nextLookAt) {
      e.nextLookAt = now + 400;
      let best: Unit | null = null;
      let reach = e.attackRange() + 10;
      for (const b of this.battalions) {
        for (const s of b.soldiers) {
          if (!s.isAlive || s.dueling) continue;
          const d = e.edgeDistanceTo(s);
          if (d < reach) {
            best = s;
            reach = d;
          }
        }
      }
      e.target = best;
    }
    const t = e.target;
    if (t?.isAlive && !t.dueling && e.inRange(t)) {
      e.setFacing(angleTo(e, t));
      e.unitState = "ATTACKING";
      return;
    }
    e.moveTowards(c.x, c.y, dt);
    e.unitState = "MOVING";
  },

  /** O herói chegou a 60 px do Comandante (ou de um capitão nosso): o duelo abre, sem perguntar. */
  checkDuelTriggers(this: WorldScene, time: number): void {
    if (this.fieldDuel || time < this.duelCooldownUntil || time < this.duelLookAt) return;
    this.duelLookAt = time + 100;
    const c = this.commander;
    for (const e of this.enemies) {
      const h = e.hero;
      if (!h || !e.isAlive || e.dormant || !e.hostile || e.routed || !seeksDuel(h) || this.duelDone.has(e)) continue;
      if (c.isAlive && !this.inCamp && distance(e, c) <= FIELD_DUEL.TRIGGER) return this.openDuel(e, c, null);
      for (const b of this.battalions) {
        const cap = b.captainSoldier;
        if (cap && b.captain && !b.panicking && distance(e, cap) <= FIELD_DUEL.TRIGGER) return this.openDuel(e, cap, b.captain);
      }
    }
  },

  openDuel(this: WorldScene, hero: Enemy, ours: Unit, captain: CaptainData | null): void {
    const h = hero.hero;
    if (!h) return;
    const auto = captain !== null;
    const center = { x: (hero.x + ours.x) / 2, y: (hero.y + ours.y) / 2 };
    const heroSkill = duelSkill(h.duel);
    let a: DuelFighter;
    let mindA: DuelMind | null = null;
    if (captain) {
      const skill = duelSkill(captain.duel);
      const spear = ours instanceof Soldier && ours.troopType === "SPEARMEN";
      a = makeFighter({ name: captain.name, x: ours.x, y: ours.y, maxHp: 80 + skill * 5, health: ours.hp / ours.maxHp, weapon: spear ? "SPEAR" : "SWORD", armor: 0.1, pace: aiPace(skill), speed: aiSpeed(skill) });
      mindA = makeMind(captainTemper(captain), skill);
    } else {
      a = makeFighter({ name: "Comandante", x: ours.x, y: ours.y, health: ours.hp / ours.maxHp, armor: 0.1 });
    }
    const b = makeFighter({ name: h.name, x: hero.x, y: hero.y, maxHp: 80 + heroSkill * 5, health: hero.hp / hero.maxHp, weapon: h.weapon, armor: 0.1, pace: aiPace(heroSkill), speed: aiSpeed(heroSkill) });
    const state = startDuel(a, b, { center, radius: FIELD_DUEL.RING - 16, scale: FIELD_DUEL.SCALE });
    const cam = this.cameras.main;
    this.fieldDuel = {
      state,
      ours,
      hero,
      captain,
      minds: { a: mindA, b: makeMind(heroTemper(h), heroSkill) },
      auto,
      start: { ours: ours.hp / ours.maxHp, hero: hero.hp / hero.maxHp },
      zoom: cam.zoom,
      watchers: new Set(),
    };
    for (const u of [hero, ours]) {
      u.dueling = true;
      u.target = null;
      u.unitState = "IDLE";
    }
    if (this.duelSeekers.delete(hero)) hero.driver = null;
    this.duelPressed = {};
    sfx.charge(center);
    if (auto) {
      this.pushFeed(`${h.name} desafia ${captain?.name ?? "um capitão"} para um duelo! Os homens abrem o anel.`);
    } else {
      // A batalha de fora anda devagar; a câmera vai aos dois
      this.walkPath = null;
      this.dragStart = null;
      this.selectionBox.clear();
      if (this.lineDrag) this.cancelLine();
      this.stopSlowMotion();
      this.setRate(FIELD_DUEL.SLOW);
      cam.stopFollow();
      cam.setZoom(FIELD_DUEL.ZOOM);
      Unit.setLod(lodOf(FIELD_DUEL.ZOOM));
      cam.centerOn(center.x, center.y - 30);
      this.pushFeed(`${h.name} desafia o Comandante! O anel se abre.`);
    }
    this.publishHud();
  },

  // --- No anel ---

  /** Um passo do duelo: as teclas (ou a cabeça do capitão), as regras, as figuras e o anel no chão. */
  updateFieldDuel(this: WorldScene, dt: number): void {
    const fd = this.fieldDuel;
    if (!fd) return;
    if (!fd.hero.isAlive || !fd.ours.isAlive || !fd.hero.active || !fd.ours.active) return this.closeDuel();
    const d = fd.state;
    // O duelo do Comandante anda no tempo de verdade; o de fora, na câmera lenta
    const step = fd.auto ? dt : dt / timeRate();
    const ia = fd.minds.a ? duelAi(d, d.a, fd.minds.a, step) : this.duelInput();
    const ib = duelAi(d, d.b, fd.minds.b, step);
    stepDuel(d, step, ia, ib);
    this.duelPressed = {};
    for (const ev of d.events) this.duelEvent(fd, ev);
    d.events.length = 0;
    this.syncDuelist(fd.ours, d.a, d.time);
    this.syncDuelist(fd.hero, d.b, d.time);
    this.drawDuel(fd);
    // Um pouco acima do anel: as barras do duelo ficam em cima da tela
    if (!fd.auto) this.cameras.main.centerOn(d.center.x, d.center.y - 30);
    if (d.winner || d.timedOut) this.endFieldDuel(fd);
  },

  duelInput(this: WorldScene): DuelInput {
    const k = this.keys;
    let dx = 0;
    let dy = 0;
    if (k.A.isDown || k.LEFT.isDown) dx -= 1;
    if (k.D.isDown || k.RIGHT.isDown) dx += 1;
    if (k.W.isDown || k.UP.isDown) dy -= 1;
    if (k.S.isDown || k.DOWN.isDown) dy += 1;
    return { dx, dy, block: k.SHIFT.isDown, ...this.duelPressed };
  },

  syncDuelist(this: WorldScene, u: Unit, f: DuelFighter, now: number): void {
    u.x = f.x;
    u.y = f.y;
    u.safeX = f.x;
    u.safeY = f.y;
    u.setFacing(f.facing);
    u.duelPose = poseOf(f, now);
    u.unitState = "IDLE";
  },

  duelEvent(this: WorldScene, fd: FieldDuel, ev: DuelEvent): void {
    const unitOf = (f: DuelFighter) => (f === fd.state.a ? fd.ours : fd.hero);
    const by = unitOf(ev.by);
    const to = unitOf(ev.to);
    const text = SAY[ev.kind];
    if (text) (ev.kind === "PARRY" || ev.kind === "EVADE" ? to : by).floatText(text, "#ffe9b0");
    switch (ev.kind) {
      case "HIT":
        to.flashHit();
        sfx.clash(to);
        break;
      case "BLOCK":
      case "PARRY":
      case "BREAK":
        sfx.clash(to);
        break;
      case "DODGE":
      case "EVADE":
        sfx.dodge(by);
        break;
      case "SHOVE":
        sfx.thud(to);
        break;
      case "MISS":
        sfx.swing(by);
        break;
      default:
    }
  },

  /** O anel no chão e o aviso de cada golpe (o largo e escuro é o pesado), como na Liça. */
  drawDuel(this: WorldScene, fd: FieldDuel): void {
    const d = fd.state;
    const g = this.duelGfx;
    g.clear();
    g.lineStyle(2, 0xe8d8a0, 0.55);
    g.strokeCircle(d.center.x, d.center.y, FIELD_DUEL.RING);
    for (const f of [d.a, d.b]) {
      if (f.stance !== "WINDUP" || !f.move) continue;
      const heavy = f.move === "HEAVY";
      const half = f.move === "SHOVE" ? DUEL.SHOVE.ARC : DUEL[f.move].ARC;
      const reach = f.move === "SHOVE" ? DUEL.SHOVE.REACH * d.scale : reachOf(d, f);
      g.fillStyle(f === d.a ? 0x60a0ff : heavy ? 0xa01010 : 0xff3030, heavy ? 0.5 : 0.35);
      g.slice(f.x, f.y, reach, f.facing - half, f.facing + half);
      g.fillPath();
    }
  },

  /**
   * Ninguém entra no anel: quem estava dentro recua até a borda. Quem está perto para de lutar e
   * fica olhando (o combate e as flechas não tocam nele nem nos dois).
   */
  keepRingClear(this: WorldScene, units: readonly Unit[]): void {
    const fd = this.fieldDuel;
    if (!fd) return;
    const c = fd.state.center;
    const watch = FIELD_DUEL.WATCH * FIELD_DUEL.WATCH;
    for (const u of units) {
      if (!u.isAlive || u.dueling) continue;
      const dx = u.x - c.x;
      const dy = u.y - c.y;
      const d2 = dx * dx + dy * dy;
      if (d2 > watch) {
        if (u.watching) {
          u.watching = false;
          fd.watchers.delete(u);
        }
        continue;
      }
      if (!u.watching) {
        u.watching = true;
        fd.watchers.add(u);
      }
      const d = Math.sqrt(d2) || 1;
      const min = FIELD_DUEL.RING + u.radius;
      if (d < min) {
        u.x = c.x + (dx / d) * min;
        u.y = c.y + (dy / d) * min;
      }
      u.setFacing(Math.atan2(-dy, -dx));
    }
  },

  /** As barras dos dois na interface. */
  duelHud(this: WorldScene): DuelHud | null {
    const fd = this.fieldDuel;
    if (!fd) return null;
    const d = fd.state;
    const bar = (f: DuelFighter, ally: boolean) => ({ name: f.name, hp: f.hp / f.maxHp, stamina: f.stamina / DUEL.STAMINA, posture: f.posture / 100, ally });
    return { auto: fd.auto, left: Math.max(0, Math.ceil(DUEL.TIMEOUT_S - d.time)), fighters: [bar(d.a, true), bar(d.b, false)] };
  },

  // --- O fim ---

  /** Fim do duelo: o anel se desfaz e o tempo volta; só então o resultado (que pode derrubar alguém). */
  endFieldDuel(this: WorldScene, fd: FieldDuel): void {
    const d = fd.state;
    const h = fd.hero.hero;
    // A vida do duelo volta ao corpo (quem perdeu fica com o mínimo até o destino dele)
    fd.ours.restoreHp((fd.ours.maxHp * d.a.hp) / d.a.maxHp);
    fd.hero.restoreHp((fd.hero.maxHp * d.b.hp) / d.b.maxHp);
    this.closeDuel();
    if (!h) return;
    const oursName = fd.captain?.name ?? "o Comandante";
    if (!d.winner) {
      // Tempo demais: os homens de cada um separam os dois
      const away = angleTo(fd.ours, fd.hero);
      this.dragAway(fd.hero, away, 50);
      this.dragAway(fd.ours, away + Math.PI, 50);
      this.duelNote(`O duelo entre ${oursName} e ${h.name} se arrastou demais: os homens de cada um os separaram, exaustos.`, "info");
      return;
    }
    const roll = Math.random();
    if (d.winner === d.a) {
      const cruel = fd.captain ? fd.captain.traits.includes("BLOODTHIRSTY") : useGameStore.getState().leader.traits.includes("BLOODTHIRSTY");
      this.heroBeaten(fd, fateOf({ woundedBefore: fd.start.hero < 0.5 }, cruel, roll));
    } else {
      this.oursBeaten(fd, fateOf({ woundedBefore: fd.start.ours < 0.5 }, h.trait === "CRUEL", roll));
    }
  },

  /** Desfaz o anel: flags, quem olhava, a câmera e o tempo. Um duelo por herói em cada batalha. */
  closeDuel(this: WorldScene): void {
    const fd = this.fieldDuel;
    if (!fd) return;
    this.fieldDuel = null;
    for (const u of [fd.ours, fd.hero]) {
      u.dueling = false;
      u.duelPose = null;
    }
    for (const u of fd.watchers) u.watching = false;
    this.duelDone.add(fd.hero);
    this.duelCooldownUntil = this.time.now + FIELD_DUEL.COOLDOWN_MS;
    this.duelPressed = {};
    this.duelGfx.clear();
    if (!fd.auto) {
      this.setRate(1);
      const cam = this.cameras.main;
      cam.setZoom(fd.zoom);
      Unit.setLod(lodOf(fd.zoom));
      if (this.cameraLocked) cam.startFollow(this.commander, true, 0.1, 0.1);
    }
    this.publishHud();
  },

  /** O herói perdeu: rende-se (preso), sai ferido ou morre. O nosso lado cresce, o dele vacila. */
  heroBeaten(this: WorldScene, fd: FieldDuel, fate: DuelFate): void {
    const e = fd.hero;
    const h = e.hero;
    if (!h) return;
    const store = useGameStore.getState();
    const host = this.hosts.hosts.find((x) => x.members.includes(e));
    // O lorde de um exército tem destino próprio (preso, morto ou fugido): quem decide é a corte
    const lord = !!host?.band?.armyId && host.leader === e;
    const by = fd.captain?.name ?? "O Comandante";
    let text: string;
    if (!lord) this.duelTaken.add(h.name);
    if (fate === "DEAD") {
      e.evasion = 0;
      e.takeDamage(e.maxHp * 100, fd.ours, this.time.now);
      text = `${by} venceu o duelo: ${h.name} caiu morto.`;
    } else {
      e.fled = true;
      e.unitState = "DEAD";
      e.destroy();
      if (fate === "SURRENDER") {
        if (!this.run && !lord) store.addCaptiveOfficer({ name: h.name, factionId: host?.band?.ownerId ?? null, nobleId: null, ransom: PRISONERS.RANSOM_OFFICER, hero: { duel: h.duel, trait: h.trait, weapon: h.weapon } });
        text = `${by} venceu o duelo: ${h.name} se rendeu e foi levado preso.`;
      } else text = `${by} venceu o duelo: ${h.name} caiu ferido e os seus o carregaram para longe.`;
    }
    this.duelMorale(fd.state.center, true, host);
    if (!this.run && !fd.captain) store.addFame(REPUTE.FAME.DUEL);
    this.duelNote(text, "good");
  },

  /** O nosso perdeu: morre (a regra do herdeiro decide) ou é arrastado para trás pela guarda. */
  oursBeaten(this: WorldScene, fd: FieldDuel, fate: DuelFate): void {
    const e = fd.hero;
    const h = e.hero;
    if (!h) return;
    const store = useGameStore.getState();
    const host = this.hosts.hosts.find((x) => x.members.includes(e));
    const u = fd.ours;
    const who = fd.captain?.name ?? "o Comandante";
    let text: string;
    if (fate === "DEAD") {
      u.evasion = 0;
      u.takeDamage(u.maxHp * 100, e, this.time.now);
      text = `${h.name} venceu o duelo: ${who} caiu!`;
    } else {
      u.restoreHp(u.maxHp * (fate === "WOUNDED" ? FIELD_DUEL.WOUNDED_HP : FIELD_DUEL.BEATEN_HP));
      // A guarda o leva para o lado dos nossos, longe do herói
      const own = fd.captain ? this.battalions.find((b) => b.captainSoldier === u)?.center : this.ownCenter();
      this.dragAway(u, own ? angleTo(e, own) : angleTo(e, u), fd.captain ? 90 : FIELD_DUEL.DRAG);
      if (fate === "WOUNDED" && !fd.captain && !this.run) store.commanderScarred(`perdeu o duelo para ${h.name}`);
      text = `${h.name} venceu o duelo: ${who} ${fate === "WOUNDED" ? "caiu ferido" : "cedeu"}, e a guarda o arrastou para trás.`;
    }
    this.duelMorale(fd.state.center, false, host);
    if (!this.run && !fd.captain) store.addFame(-FIELD_DUEL.LOSS_FAME);
    this.duelNote(text, "bad");
  },

  /** Centro do nosso exército em campo (para onde a guarda leva o Comandante vencido). */
  ownCenter(this: WorldScene): Point | null {
    const field = this.battalions.filter((b) => !b.isDestroyed);
    return field.length > 0 ? centroid(field.map((b) => b.center)) : null;
  },

  /** Leva alguém um tanto naquela direção, sem cair na água nem na pedra. */
  dragAway(this: WorldScene, u: Unit, angle: number, amount: number): void {
    const goal = { x: u.x + Math.cos(angle) * amount, y: u.y + Math.sin(angle) * amount };
    const at = this.nav.nearestOpen(goal, 300) ?? goal;
    u.x = at.x;
    u.y = at.y;
    u.safeX = at.x;
    u.safeY = at.y;
  },

  /** Quem venceu ganha moral; quem perdeu o seu duelista sente o abalo, mais forte perto do anel. */
  duelMorale(this: WorldScene, center: Point, oursWon: boolean, host: WarHost | undefined): void {
    const F = FIELD_DUEL;
    const change = (near: boolean, won: boolean) => (won ? F.MORALE_WIN : -F.MORALE_LOSS) * (near ? 2 : 1);
    for (const b of this.battalions) {
      if (b.isDestroyed) continue;
      b.morale = clampMorale(b.morale + change(distance(b.center, center) <= F.NEAR, oursWon));
    }
    for (const s of host?.squads ?? []) {
      if (s.isDestroyed) continue;
      s.morale = clampMorale(s.morale + change(distance(s.center, center) <= F.NEAR, !oursWon));
    }
  },

  /** O resultado vai para o feed, para o relatório da batalha e para o diário. */
  duelNote(this: WorldScene, text: string, tone: "good" | "bad" | "info"): void {
    this.pushFeed(text);
    this.engagement?.notes.push(text);
    if (!this.run) useGameStore.getState().chronicle(`${text} (${this.placeName(this.commander)})`, tone);
    this.publishHud();
  },
};

export type DuelMethods = typeof duelMethods;
