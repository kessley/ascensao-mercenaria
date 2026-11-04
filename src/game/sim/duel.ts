import { DUEL } from "../../utils/constants";
import { angleDiff, angleTo, distance, type Point } from "../../utils/math";

/**
 * Regras do duelo (Marco 21), puras: a Liça (Marco 15) e o anel no meio da batalha usam as
 * mesmas. Todo golpe avisa antes. O leve é rápido; o pesado avisa mais cedo e enche a postura de
 * quem bloqueia. Bloquear gasta fôlego; erguer a guarda no instante certo apara e atordoa quem
 * atacou. A esquiva tem um instante em que nada acerta, e o empurrão abre quem só se defende.
 */

export type DuelWeapon = "SWORD" | "SPEAR" | "AXE" | "SHIELD";
export type DuelTemper = "AGGRESSIVE" | "STEADY" | "PATIENT" | "TREACHEROUS";
export type DuelMove = "LIGHT" | "HEAVY" | "SHOVE";
export type DuelStance = "IDLE" | "WINDUP" | "RECOVER" | "BLOCK" | "DODGE" | "STAGGER";
export type DuelEventKind = "HIT" | "BLOCK" | "PARRY" | "BREAK" | "SHOVE" | "MISS" | "EVADE" | "DODGE" | "FEINT";

export interface WeaponPace {
  label: string;
  reach: number;
  /** Aviso do golpe leve e do pesado, em segundos. */
  light: number;
  heavy: number;
  damage: number;
  /** Quanto enche a postura de quem bloqueia (o machado quebra escudo). */
  crush: number;
  /** Quanto passa pela guarda de quem bloqueia com ela (o escudo segura mais). */
  guard: number;
  /** Custo da esquiva, e o passo dela encolhe na mesma conta (com escudo, esquiva-se pior). */
  dodge: number;
}

export const WEAPONS: Record<DuelWeapon, WeaponPace> = {
  SWORD: { label: "espada", reach: 72, light: 0.24, heavy: 0.56, damage: 1, crush: 1, guard: 1, dodge: 1 },
  SPEAR: { label: "lança", reach: 94, light: 0.3, heavy: 0.64, damage: 0.95, crush: 0.9, guard: 1.1, dodge: 1 },
  AXE: { label: "machado", reach: 66, light: 0.3, heavy: 0.68, damage: 1.15, crush: 1.6, guard: 1.15, dodge: 1 },
  SHIELD: { label: "espada e escudo", reach: 68, light: 0.26, heavy: 0.6, damage: 0.9, crush: 1, guard: 0.6, dodge: 1.5 },
};

type Press = DuelMove | "DODGE";

export interface DuelFighter {
  name: string;
  x: number;
  y: number;
  facing: number;
  hp: number;
  maxHp: number;
  stamina: number;
  /** Fôlego máximo: o cansaço de antes do duelo tira daqui. */
  maxStamina: number;
  /** Equilíbrio, de 0 a 100; cheio, a guarda quebra. */
  posture: number;
  stance: DuelStance;
  /** Quando o estado atual começou (relógio do duelo). */
  since: number;
  /** Segundos que faltam no estado (aviso, recuperação, atordoado, esquiva). */
  timer: number;
  /** O golpe em aviso ou em recuperação. */
  move: DuelMove | null;
  /** Pesado fingido: vira leve quando faltar este tanto do aviso (0 = golpe de verdade). */
  feintAt: number;
  /** Quando a guarda caiu pela última vez (para não aparar martelando a tecla). */
  guardDownAt: number;
  dash: Point;
  /** Folga da esquiva que ainda resta. */
  untouchable: number;
  /** Tecla apertada esperando a vez. */
  queued: { press: Press; left: number; feint: boolean } | null;
  weapon: DuelWeapon;
  /** Parte do dano que a armadura segura (0 a 0,5). */
  armor: number;
  /** Duração dos golpes (1 = o ritmo do Comandante). */
  pace: number;
  /** Passo (1 = o do Comandante). */
  speed: number;
  /** Golpes limpos que acertou. */
  hits: number;
}

export interface DuelEvent {
  kind: DuelEventKind;
  by: DuelFighter;
  to: DuelFighter;
  damage: number;
}

export interface DuelState {
  a: DuelFighter;
  b: DuelFighter;
  center: Point;
  /** Até onde os dois podem ir a partir do centro. */
  radius: number;
  /** Tamanho das distâncias (1 = a Liça; no campo, as figuras são menores). */
  scale: number;
  time: number;
  winner: DuelFighter | null;
  timedOut: boolean;
  /** O que aconteceu desde a última vez que quem chama esvaziou a lista (som, faísca, texto). */
  events: DuelEvent[];
  rng: () => number;
}

/** O que cada um quer neste passo. Golpes, empurrão e esquiva são apertos; a guarda, segurar. */
export interface DuelInput {
  /** Direção do passo (não precisa ter tamanho 1). */
  dx: number;
  dy: number;
  block: boolean;
  light?: boolean;
  heavy?: boolean;
  /** O pesado é fingido: vira leve no meio do aviso. */
  feint?: boolean;
  shove?: boolean;
  dodge?: boolean;
}

export interface FighterSpec {
  name: string;
  x: number;
  y: number;
  facing?: number;
  maxHp?: number;
  /** Vida com que entra, de 0 a 1 (ferimentos de antes contam). */
  health?: number;
  /** Cansaço, de 0 a 1: tira até metade do fôlego. */
  fatigue?: number;
  weapon?: DuelWeapon;
  armor?: number;
  pace?: number;
  speed?: number;
}

export function makeFighter(spec: FighterSpec): DuelFighter {
  const maxHp = spec.maxHp ?? 100;
  const maxStamina = DUEL.STAMINA * (1 - 0.5 * clamp01(spec.fatigue ?? 0));
  return {
    name: spec.name,
    x: spec.x,
    y: spec.y,
    facing: spec.facing ?? 0,
    hp: Math.max(1, maxHp * clamp01(spec.health ?? 1)),
    maxHp,
    stamina: maxStamina,
    maxStamina,
    posture: 0,
    stance: "IDLE",
    since: 0,
    timer: 0,
    move: null,
    feintAt: 0,
    guardDownAt: -Infinity,
    dash: { x: 0, y: 0 },
    untouchable: 0,
    queued: null,
    weapon: spec.weapon ?? "SWORD",
    armor: Math.min(0.5, Math.max(0, spec.armor ?? 0)),
    pace: spec.pace ?? 1,
    speed: spec.speed ?? 1,
    hits: 0,
  };
}

export function startDuel(a: DuelFighter, b: DuelFighter, at: { center: Point; radius: number; scale?: number; rng?: () => number }): DuelState {
  a.facing = angleTo(a, b);
  b.facing = angleTo(b, a);
  return { a, b, center: at.center, radius: at.radius, scale: at.scale ?? 1, time: 0, winner: null, timedOut: false, events: [], rng: at.rng ?? Math.random };
}

export const opponentOf = (d: DuelState, f: DuelFighter): DuelFighter => (f === d.a ? d.b : d.a);
export const reachOf = (d: DuelState, f: DuelFighter): number => WEAPONS[f.weapon].reach * d.scale;
export const isOver = (d: DuelState): boolean => d.winner !== null || d.timedOut;

/** Aviso de um golpe, em segundos, para quem tem este ritmo. */
export function windupOf(f: Pick<DuelFighter, "weapon" | "pace">, move: DuelMove): number {
  if (move === "SHOVE") return DUEL.SHOVE.WINDUP * f.pace;
  return (move === "HEAVY" ? WEAPONS[f.weapon].heavy : WEAPONS[f.weapon].light) * f.pace;
}

/**
 * Um passo do duelo: primeiro os apertos e os passos, depois os relógios e os golpes que chegam
 * (a guarda erguida neste quadro já vale para o golpe que chega neste quadro).
 */
export function stepDuel(d: DuelState, dt: number, ia: DuelInput, ib: DuelInput): void {
  if (isOver(d)) return;
  d.time += dt;
  steer(d, d.a, d.b, ia, dt);
  steer(d, d.b, d.a, ib, dt);
  keepApart(d);
  tick(d, d.a, d.b, dt);
  if (!d.winner) tick(d, d.b, d.a, dt);
  if (!d.winner && d.time >= DUEL.TIMEOUT_S) d.timedOut = true;
}

function enter(d: DuelState, f: DuelFighter, stance: DuelStance, timer: number): void {
  if (f.stance === "BLOCK" && stance !== "BLOCK") f.guardDownAt = d.time;
  f.stance = stance;
  f.since = d.time;
  f.timer = timer;
  if (stance !== "WINDUP" && stance !== "RECOVER") f.move = null;
  if (stance !== "WINDUP") f.feintAt = 0;
}

function tick(d: DuelState, f: DuelFighter, foe: DuelFighter, dt: number): void {
  const regen = f.stance === "BLOCK" ? DUEL.REGEN_BLOCK : f.stance === "IDLE" ? DUEL.REGEN : DUEL.REGEN_BUSY;
  f.stamina = Math.min(f.maxStamina, f.stamina + regen * dt);
  if (f.stance !== "BLOCK" && f.stance !== "STAGGER") f.posture = Math.max(0, f.posture - DUEL.POSTURE.DECAY * dt);
  f.untouchable = Math.max(0, f.untouchable - dt);
  if (f.queued && (f.queued.left -= dt) <= 0) f.queued = null;
  if (f.stance === "IDLE" || f.stance === "BLOCK") return;
  f.timer -= dt;
  if (f.stance === "WINDUP" && f.feintAt > 0 && f.timer <= f.feintAt) {
    // O pesado era fingido: vira leve, e o golpe sai logo
    f.move = "LIGHT";
    f.feintAt = 0;
    f.timer = Math.min(f.timer, windupOf(f, "LIGHT") * 0.6);
    d.events.push({ kind: "FEINT", by: f, to: foe, damage: 0 });
  }
  if (f.timer > 0) return;
  if (f.stance === "WINDUP" && f.move) {
    const move = f.move;
    strike(d, f, foe, move);
    if (f.stance === "WINDUP") enter(d, f, "RECOVER", move === "SHOVE" ? DUEL.SHOVE.RECOVER : DUEL[move].RECOVER);
    return;
  }
  if (f.stance === "DODGE") return enter(d, f, "RECOVER", DUEL.DODGE.RECOVER);
  enter(d, f, "IDLE", 0);
}

function steer(d: DuelState, f: DuelFighter, foe: DuelFighter, input: DuelInput, dt: number): void {
  if (f.stance === "IDLE" || f.stance === "BLOCK") {
    if (input.block && f.stamina > 2) {
      if (f.stance === "IDLE") enter(d, f, "BLOCK", 0);
    } else if (f.stance === "BLOCK") {
      enter(d, f, "IDLE", 0);
    }
  }
  const press: Press | null = input.dodge ? "DODGE" : input.heavy ? "HEAVY" : input.light ? "LIGHT" : input.shove ? "SHOVE" : null;
  if (press) f.queued = { press, left: DUEL.BUFFER_S, feint: press === "HEAVY" && !!input.feint };
  if (f.queued && (f.stance === "IDLE" || f.stance === "BLOCK") && begin(d, f, foe, f.queued, input)) f.queued = null;

  const want = angleTo(f, foe);
  if (f.stance === "WINDUP") f.facing = turnToward(f.facing, want, DUEL.WINDUP_TURN * dt);
  else if (f.stance !== "STAGGER") f.facing = want;

  if (f.stance === "DODGE") {
    const speed = (DUEL.DODGE.DISTANCE * d.scale) / WEAPONS[f.weapon].dodge / DUEL.DODGE.TIME;
    f.x += f.dash.x * speed * dt;
    f.y += f.dash.y * speed * dt;
    return;
  }
  if (f.stance === "STAGGER") return;
  const len = Math.hypot(input.dx, input.dy);
  if (len < 1e-6) return;
  const slow = f.stance === "BLOCK" ? 0.4 : f.stance === "WINDUP" ? 0.5 : f.stance === "RECOVER" ? 0.7 : 1;
  const speed = DUEL.STEP * d.scale * f.speed * slow;
  f.x += (input.dx / len) * speed * dt;
  f.y += (input.dy / len) * speed * dt;
}

/** Começa o que estava na fila; sem fôlego, a tecla espera (e expira). */
function begin(d: DuelState, f: DuelFighter, foe: DuelFighter, q: { press: Press; feint: boolean }, input: DuelInput): boolean {
  if (q.press === "DODGE") {
    const cost = DUEL.DODGE.COST * WEAPONS[f.weapon].dodge;
    if (f.stamina < cost) return false;
    f.stamina -= cost;
    let dx = input.dx;
    let dy = input.dy;
    let len = Math.hypot(dx, dy);
    if (len < 1e-6) {
      // Sem direção, o passo é para trás
      const away = angleTo(foe, f);
      dx = Math.cos(away);
      dy = Math.sin(away);
      len = 1;
    }
    f.dash = { x: dx / len, y: dy / len };
    enter(d, f, "DODGE", DUEL.DODGE.TIME);
    f.untouchable = DUEL.DODGE.UNTOUCHABLE;
    d.events.push({ kind: "DODGE", by: f, to: foe, damage: 0 });
    return true;
  }
  const cost = q.press === "SHOVE" ? DUEL.SHOVE.COST : DUEL[q.press].COST;
  if (f.stamina < cost) return false;
  f.stamina -= cost;
  enter(d, f, "WINDUP", windupOf(f, q.press));
  f.move = q.press;
  f.feintAt = q.press === "HEAVY" && q.feint ? f.timer * DUEL.FEINT_AT : 0;
  return true;
}

/** O golpe chega: errou, foi esquivado, aparado, bloqueado ou acertou. */
function strike(d: DuelState, a: DuelFighter, b: DuelFighter, move: DuelMove): void {
  const say = (kind: DuelEventKind, damage = 0): void => {
    d.events.push({ kind, by: a, to: b, damage });
  };
  const reach = (move === "SHOVE" ? DUEL.SHOVE.REACH : WEAPONS[a.weapon].reach) * d.scale;
  const arc = move === "SHOVE" ? DUEL.SHOVE.ARC : DUEL[move].ARC;
  const toB = angleTo(a, b);
  if (distance(a, b) > reach || angleDiff(toB, a.facing) > arc) return say("MISS");
  if (b.untouchable > 0) return say("EVADE");
  const guarded = b.stance === "BLOCK" && angleDiff(angleTo(b, a), b.facing) < DUEL.BLOCK_ARC;

  if (move === "SHOVE") {
    shove(d, b, toB, DUEL.SHOVE.PUSH);
    b.posture = Math.min(100, b.posture + DUEL.POSTURE.SHOVE * (guarded ? 1 : 0.5));
    if (b.posture >= 100) return breakGuard(d, a, b);
    if (guarded) enter(d, b, "STAGGER", DUEL.SHOVE.OPEN);
    else if (b.stance === "IDLE" || b.stance === "RECOVER") enter(d, b, "STAGGER", DUEL.SHOVE.STUN);
    return say("SHOVE");
  }

  const rules = DUEL[move];
  const raw = rules.DAMAGE * WEAPONS[a.weapon].damage * (1 - b.armor) * (0.9 + d.rng() * 0.2);
  if (guarded) {
    const guard = WEAPONS[b.weapon].guard;
    if (d.time - b.since <= DUEL.PARRY_WINDOW && b.since - b.guardDownAt >= DUEL.PARRY_REARM) {
      enter(d, a, "STAGGER", DUEL.PARRY_STUN);
      b.posture = Math.max(0, b.posture - DUEL.POSTURE.PARRY_RELIEF);
      return say("PARRY");
    }
    const chip = raw * DUEL.CHIP[move] * guard;
    b.stamina = Math.max(0, b.stamina - DUEL.BLOCK_COST[move] * guard);
    b.posture = Math.min(100, b.posture + DUEL.POSTURE[move] * WEAPONS[a.weapon].crush * guard);
    b.hp -= chip;
    if (b.hp <= 0) return fell(d, a, b, chip);
    if (b.posture >= 100 || b.stamina <= 0) return breakGuard(d, a, b);
    return say("BLOCK", chip);
  }
  a.hits++;
  b.hp -= raw;
  if (b.hp <= 0) return fell(d, a, b, raw);
  b.posture = Math.min(100, b.posture + DUEL.POSTURE.HIT);
  shove(d, b, toB, rules.PUSH);
  enter(d, b, "STAGGER", rules.STUN);
  say("HIT", raw);
}

function fell(d: DuelState, a: DuelFighter, b: DuelFighter, damage: number): void {
  b.hp = 0;
  enter(d, b, "STAGGER", Infinity);
  d.winner = a;
  d.events.push({ kind: "HIT", by: a, to: b, damage });
}

/** Postura cheia: a guarda quebra e o próximo golpe está garantido. */
function breakGuard(d: DuelState, a: DuelFighter, b: DuelFighter): void {
  b.posture = 0;
  enter(d, b, "STAGGER", DUEL.POSTURE.BROKEN_S);
  d.events.push({ kind: "BREAK", by: a, to: b, damage: 0 });
}

function shove(d: DuelState, f: DuelFighter, angle: number, amount: number): void {
  f.x += Math.cos(angle) * amount * d.scale;
  f.y += Math.sin(angle) * amount * d.scale;
}

/** Os dois não se atravessam nem saem do anel. */
function keepApart(d: DuelState): void {
  const { a, b } = d;
  const min = DUEL.BODY * 2 * d.scale;
  // Contra a borda, separar empurra um para fora e a borda devolve: umas voltas e eles escorregam
  for (let i = 0; i < 4; i++) {
    const gap = distance(a, b);
    if (gap < min) {
      // Grudados no mesmo ponto, separam-se ao longo da borda
      const angle = gap > 1e-6 ? angleTo(a, b) : angleTo(d.center, a) + Math.PI / 2;
      const half = (min - gap) / 2;
      a.x -= Math.cos(angle) * half;
      a.y -= Math.sin(angle) * half;
      b.x += Math.cos(angle) * half;
      b.y += Math.sin(angle) * half;
    }
    for (const f of [a, b]) {
      const r = distance(f, d.center);
      if (r <= d.radius) continue;
      f.x = d.center.x + ((f.x - d.center.x) / r) * d.radius;
      f.y = d.center.y + ((f.y - d.center.y) / r) * d.radius;
    }
  }
  // Ainda grudados (os dois na mesma linha do centro): quem está mais para dentro cede
  const gap = distance(a, b);
  if (gap >= min || gap < 1e-6) return;
  const [inner, outer] = distance(a, d.center) < distance(b, d.center) ? [a, b] : [b, a];
  const away = angleTo(outer, inner);
  inner.x += Math.cos(away) * (min - gap);
  inner.y += Math.sin(away) * (min - gap);
}

function turnToward(from: number, to: number, max: number): number {
  const diff = Math.atan2(Math.sin(to - from), Math.cos(to - from));
  return Math.abs(diff) <= max ? to : from + Math.sign(diff) * max;
}

const clamp01 = (v: number): number => Math.min(1, Math.max(0, v));

// --- A cabeça de quem luta sozinho ---

/** O que a IA está lendo e planejando. */
export interface DuelMind {
  temper: DuelTemper;
  /** 1–10: quanto lê o aviso, acerta a distância e emenda golpes. */
  skill: number;
  think: number;
  /** O aviso do outro já lido (início dele e o golpe). */
  readAt: number;
  readMove: DuelMove | null;
  /** Guarda planejada para o golpe que vem (relógio do duelo; -1 = nenhuma). */
  guardFrom: number;
  guardUntil: number;
  dodgeAt: number;
  dodgeSide: number;
  /** Golpes que ainda quer emendar. */
  chain: number;
}

export function makeMind(temper: DuelTemper, skill: number): DuelMind {
  return { temper, skill: Math.min(10, Math.max(1, skill)), think: 0.8, readAt: -1, readMove: null, guardFrom: -1, guardUntil: -1, dodgeAt: -1, dodgeSide: 1, chain: 0 };
}

/** Ritmo e passo da IA conforme a mão: a fraca avisa bem antes; a melhor, quase como o Comandante. */
export const aiPace = (skill: number): number => 2 - skill * 0.07;
export const aiSpeed = (skill: number): number => 0.62 + skill * 0.03;

const TEMPER = {
  AGGRESSIVE: { parry: -0.1, dodge: 0.05, block: -0.1, attack: 0.85, heavy: 0.3, feint: 0, chain: 2, keep: 0.8, wait: 0.35 },
  STEADY: { parry: 0, dodge: 0, block: 0.05, attack: 0.6, heavy: 0.3, feint: 0, chain: 1, keep: 0.95, wait: 0.55 },
  PATIENT: { parry: 0.15, dodge: 0.05, block: 0.2, attack: 0.35, heavy: 0.25, feint: 0, chain: 0, keep: 1.05, wait: 0.75 },
  TREACHEROUS: { parry: 0.05, dodge: 0.05, block: 0, attack: 0.6, heavy: 0.55, feint: 0.7, chain: 1, keep: 1, wait: 0.55 },
} as const;

/**
 * O que a IA aperta neste passo. Lê o aviso do outro depois de um tempo de reação, decide uma vez
 * por golpe (aparar, esquivar, bloquear ou nada), castiga quem errou ou caiu, e quando livre ataca
 * conforme o temperamento: o agressivo emenda, o paciente espera o erro, o traiçoeiro finge.
 */
export function duelAi(d: DuelState, me: DuelFighter, mind: DuelMind, dt: number): DuelInput {
  const foe = opponentOf(d, me);
  const rng = d.rng;
  const t = TEMPER[mind.temper];
  const s = mind.skill;
  const reach = reachOf(d, me);
  const gap = distance(me, foe);
  const out: DuelInput = { dx: 0, dy: 0, block: false };
  const reaction = 0.26 - s * 0.018;
  // Quanto erra a distância: a mão fraca ataca de longe demais
  const slack = (10 - s) * 2.5 * d.scale;

  // 1. O aviso do outro: decide uma vez por golpe (e de novo se o pesado virar leve)
  if (foe.stance === "WINDUP" && foe.move && (mind.readAt !== foe.since || mind.readMove !== foe.move) && d.time - foe.since >= reaction) {
    const fresh = mind.readAt !== foe.since;
    mind.readAt = foe.since;
    mind.readMove = foe.move;
    if (fresh || rng() < s * 0.07) plan(d, me, foe, mind, gap);
  }
  if (foe.stance !== "WINDUP" && d.time > mind.guardUntil) {
    mind.guardFrom = -1;
    mind.dodgeAt = -1;
  }

  // 2. O plano de defesa
  if (mind.dodgeAt >= 0 && d.time >= mind.dodgeAt) {
    const side = angleTo(foe, me) + (Math.PI / 2) * mind.dodgeSide;
    out.dodge = true;
    out.dx = Math.cos(side);
    out.dy = Math.sin(side);
    mind.dodgeAt = -1;
    return out;
  }
  const guarding = mind.guardFrom >= 0 && d.time >= mind.guardFrom && d.time <= mind.guardUntil;
  out.block = guarding;
  // Contra o empurrão, a guarda não serve: sai do alcance
  const shoving = foe.stance === "WINDUP" && foe.move === "SHOVE" && mind.readAt === foe.since;

  // 3. Castigo: quem caiu, quem errou, quem só bloqueia
  const inReach = gap <= reach + slack * 0.4;
  if (!guarding && inReach && me.stance !== "WINDUP") {
    if (foe.stance === "STAGGER" && d.time - foe.since >= reaction) {
      const heavy = foe.timer > windupOf(me, "HEAVY") + 0.05;
      if (heavy) out.heavy = true;
      else out.light = true;
    } else if (foe.stance === "RECOVER" && d.time - foe.since >= reaction && foe.timer > windupOf(me, "LIGHT") * 0.6 && rng() < (mind.temper === "PATIENT" ? 0.9 : 0.5) * dt * 12) {
      out.light = true;
    } else if (foe.stance === "BLOCK" && d.time - foe.since > 0.7 && gap <= DUEL.SHOVE.REACH * d.scale && rng() < s * 0.08 * dt * 4) {
      if (me.weapon === "AXE") out.heavy = true;
      else out.shove = true;
    }
  }
  // Emendar: saindo de um golpe, o próximo já está na fila
  if (me.stance === "RECOVER" && me.move && !me.queued && mind.chain > 0 && gap <= reach + slack && me.timer < DUEL.BUFFER_S) {
    mind.chain--;
    out.light = true;
  }

  // 4. Livre: atacar quando der, conforme o temperamento
  mind.think -= dt;
  if (mind.think <= 0 && !guarding && (me.stance === "IDLE" || me.stance === "BLOCK")) {
    mind.think = (t.wait + rng() * (t.wait + 0.3)) * (1.3 - s * 0.04);
    const tired = me.stamina < 25 && mind.temper !== "AGGRESSIVE";
    if (!tired && gap <= reach + slack && foe.stance !== "DODGE" && rng() < t.attack) {
      if (rng() < t.heavy) {
        out.heavy = true;
        out.feint = rng() < t.feint;
      } else {
        out.light = true;
      }
      mind.chain = rng() < 0.5 + s * 0.04 ? t.chain : 0;
    }
  }

  // 5. Passos: guarda a distância do temperamento e anda em volta
  const tired = me.stamina < 25 && mind.temper !== "AGGRESSIVE";
  // Quem errou ou caiu está aberto: chega perto para castigar
  const opening = foe.stance === "RECOVER" || foe.stance === "STAGGER";
  // No meio do próprio golpe, avança para não errar a distância
  const lunging = me.stance === "WINDUP" && me.move !== "SHOVE";
  const keep = shoving ? reach * 1.6 : opening || lunging ? reach * 0.75 : tired ? reach * 1.5 : reach * t.keep;
  const dir = gap > keep + 6 * d.scale ? 1 : gap < keep - 12 * d.scale ? -1 : 0;
  const toFoe = angleTo(me, foe);
  const sway = Math.sin(d.time * 2 + s) * 0.6;
  out.dx = Math.cos(toFoe) * dir + Math.cos(toFoe + Math.PI / 2) * sway * 0.5;
  out.dy = Math.sin(toFoe) * dir + Math.sin(toFoe + Math.PI / 2) * sway * 0.5;
  return out;
}

/** Decide o que fazer com o golpe que vem. */
function plan(d: DuelState, me: DuelFighter, foe: DuelFighter, mind: DuelMind, gap: number): void {
  mind.guardFrom = -1;
  mind.dodgeAt = -1;
  const move = foe.move;
  if (!move || move === "SHOVE") return;
  // Vai chegar? (um passo dele no aviso conta)
  if (gap > reachOf(d, foe) + DUEL.BODY * d.scale * 1.5) return;
  const rng = d.rng;
  const t = TEMPER[mind.temper];
  const s = mind.skill;
  const err = (10 - s) * 0.018;
  const noise = (rng() - 0.5) * 2 * err;
  const arrives = d.time + foe.timer;
  mind.guardUntil = arrives + 0.3;
  const canDodge = me.stamina >= DUEL.DODGE.COST * WEAPONS[me.weapon].dodge + 10;
  const canParry = me.stance !== "BLOCK" && d.time - me.guardDownAt >= DUEL.PARRY_REARM;
  // Contra o pesado, bloquear sai caro: a mão boa prefere aparar ou esquivar
  const heavy = move === "HEAVY" ? 0.1 : 0;
  // Lido tarde (já dentro da janela de aparar), só dá para aparar ou esquivar; tarde demais, nada
  const late = foe.timer <= DUEL.PARRY_WINDOW;
  if (foe.timer < 0.04) return;
  const roll = rng();
  const parry = canParry ? Math.max(0, s * 0.04 + t.parry + heavy) : 0;
  const dodge = canDodge ? Math.max(0, (s * 0.025 + t.dodge + heavy) / WEAPONS[me.weapon].dodge) : 0;
  const block = late ? 0 : Math.max(0, s * 0.07 + t.block - heavy);
  if (roll < parry) {
    mind.guardFrom = Math.max(d.time, arrives - DUEL.PARRY_WINDOW * 0.6 + noise);
  } else if (roll < parry + dodge) {
    mind.dodgeAt = Math.max(d.time, arrives - DUEL.DODGE.UNTOUCHABLE * 0.6 + noise);
    mind.dodgeSide = rng() < 0.5 ? 1 : -1;
  } else if (roll < parry + dodge + block) {
    mind.guardFrom = d.time;
  }
}

// --- Fim ---

export type DuelFate = "SURRENDER" | "WOUNDED" | "DEAD";

/**
 * O que acontece com quem caiu. Quase sempre se rende (vira prisioneiro) ou sai ferido; morrer é
 * raro: só quem já estava ferido ou caiu na mão de alguém cruel corre esse risco de verdade.
 */
export function fateOf(loser: { woundedBefore: boolean }, cruelWinner: boolean, roll: number): DuelFate {
  const death = 0.05 + (loser.woundedBefore ? 0.15 : 0) + (cruelWinner ? 0.2 : 0);
  if (roll < death) return "DEAD";
  if (roll < death + 0.35) return "WOUNDED";
  return "SURRENDER";
}

/** Duelo sem ninguém nas teclas: as duas cabeças lutam até o fim, no mesmo regulamento. */
export function fightOut(d: DuelState, ma: DuelMind, mb: DuelMind, dt = 1 / 30): DuelState {
  while (!isOver(d)) {
    const ia = duelAi(d, d.a, ma, dt);
    const ib = duelAi(d, d.b, mb, dt);
    stepDuel(d, dt, ia, ib);
    d.events.length = 0;
  }
  return d;
}
