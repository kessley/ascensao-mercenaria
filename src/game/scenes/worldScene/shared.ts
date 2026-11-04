import Phaser from "phaser";
import type { CommanderKeys } from "../../entities/Commander";
import { Battalion } from "../../entities/Battalion";
import { Enemy } from "../../entities/Enemy";
import type { MissionStop } from "../../entities/Messenger";
import { Scout, type ScoutMode, type ScoutOrder } from "../../entities/Scout";
import type { Warband } from "../../systems/Warbands";
import type { Rect, TownLayout } from "../../world/townLayout";
import type { BattleScenario, ScenarioForce } from "../../data/scenarios";
import type { HeroData } from "../../data/heroes";
import type { GameState, TrumpetCall } from "../../../store/useGameStore";
import type { Formation } from "../../../utils/constants";
import type { Point } from "../../../utils/math";

/** Constantes, tipos e ajudantes que as partes da `WorldScene` dividem. */

export type BattleKeys = CommanderKeys & {
  L: Phaser.Input.Keyboard.Key;
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
  E: Phaser.Input.Keyboard.Key;
  TAB: Phaser.Input.Keyboard.Key;
  T: Phaser.Input.Keyboard.Key;
  V: Phaser.Input.Keyboard.Key;
  G: Phaser.Input.Keyboard.Key;
  P: Phaser.Input.Keyboard.Key;
  X: Phaser.Input.Keyboard.Key;
  Z: Phaser.Input.Keyboard.Key;
  B: Phaser.Input.Keyboard.Key;
  N: Phaser.Input.Keyboard.Key;
  J: Phaser.Input.Keyboard.Key;
};

export const FORMATION_KEYS: [keyof BattleKeys, Formation][] = [
  ["ONE", "LINE"],
  ["TWO", "SHIELD_WALL"],
  ["THREE", "WEDGE"],
  ["FOUR", "LOOSE"],
];

export const SCOUT_ORDER_LABEL: Record<ScoutOrder["kind"], string> = {
  VANGUARD: "Vanguarda",
  RECALL: "Recolher",
  RETURN: "Voltar",
  WATCH: "Vigiar",
  REGION: "Explorar região",
  PATROL: "Patrulhar rota",
  SHADOW: "Seguir bando",
};

/** Ordens que o batedor recebe por trombeta; as outras precisam de voz, mensageiro ou harpia. */
export const SCOUT_BASIC_ORDERS: readonly ScoutMode[] = ["VANGUARD", "RECALL"];

export const SIDE_WORD = { N: "norte", S: "sul", E: "leste", W: "oeste" } as const;
/** Quem luta de verdade: batedores e arautos só rondam. */
export const isFighter = (m: Enemy) => !m.isOutrider && m.kind !== "HERALD";
/** "o acampamento" vira "no acampamento"; "Alva", "em Alva". */
export const inPlace = (place: string) => (place.startsWith("o ") ? `no ${place.slice(2)}` : place.startsWith("a ") ? `na ${place.slice(2)}` : place.startsWith("margens ") ? `nas ${place}` : `em ${place}`);
/** Lado da muralha, pelo ângulo que ela olha (ver wallOutward). */
export const wallSide = (out: number) => (out === 0 ? "E" : out === Math.PI ? "W" : out < 0 ? "N" : "S");

/** Cor das ordens de correr. */
export const COMBAT_RUN_COLOR = 0xffd166;

/** Arrasto menor que isto (px de mundo) conta como clique, não como caixa de seleção. */
export const DRAG_THRESHOLD = 6;
export const FEED_SIZE = 5;

export function isShiftHeld(pointer: Phaser.Input.Pointer): boolean {
  return (pointer.event as MouseEvent | undefined)?.shiftKey ?? false;
}

/** Quem pode receber ordens (batalhão ou batedor). */
export type OrderRecipient = Battalion | Scout;

/**
 * Natureza da ordem, que define por qual meio ela pode chegar:
 * COMPLEX (ponto, alvo, foco, arranjo) só por voz ou mensageiro; BASIC também por trombeta;
 * VISUAL (formação) também por estandarte; BASIC_VISUAL (seguir/reunir) por qualquer um.
 */
export type OrderChannel = "COMPLEX" | "BASIC" | "VISUAL" | "BASIC_VISUAL";
export type Reach = "VOICE" | "TRUMPET" | "BANNER";

/** Entrega que precisa de mensageiro, aguardando o fim do lote para ser agrupada. */
export interface PendingDelivery {
  order: string;
  stop: MissionStop;
  recipient: OrderRecipient;
}

/** Combate em andamento no mundo: quem lutou, como estava no começo e o que já aconteceu. */
export interface Engagement {
  enemies: Set<Enemy>;
  /** Oficiais caídos neste combate (podem ter se rendido feridos). */
  officers: { name: string; factionId: string | null; hero?: HeroData }[];
  /** Batalhões que entraram no combate (só eles ganham XP e entram no relatório). */
  participants: Set<Battalion>;
  /** Abates de cada batalhão (e do tenente) quando entrou no combate. */
  startKills: Map<Battalion, { kills: number; lieutenantKills: number; captainKills: number }>;
  quietSince: number | null;
  region: string;
  contractDone: boolean;
  /** Acontecimentos para o relatório (povoado tomado, líder abatido...). */
  notes: string[];
}

/** Batalha personalizada em andamento: o que só a cena acompanha. */
/** Batalha de cerco: a muralha e o que o inimigo ainda tem para vencê-la. */
export interface SiegeRun {
  layout: TownLayout;
  ladders: number;
  rams: number;
  /** Desde quando há inimigo ao pé da muralha. */
  footSince: number | null;
  nextLook: number;
  /** Forças já acomodadas no campo. */
  seated: Set<Warband>;
}

export interface ScenarioRun {
  def: BattleScenario;
  siege: SiegeRun | null;
  nextSweep: number;
  seconds: number;
  /** Forças que ainda vão entrar em campo. */
  pending: ScenarioForce[];
  bands: Warband[];
  /** Saíram do campo em ordem: contam como quem fugiu. */
  left: Warband[];
  fled: number;
  officers: string[];
  nextCourse: number;
  /** Desde quando não há ninguém lutando do outro lado. */
  clearSince: number | null;
  /** Quem o objetivo de matar o chefe manda caçar: a primeira força. */
  prey: Warband | null;
  chiefDown: boolean;
  /** Quantos soldados cada batalhão levou a campo. */
  start: Map<string, number>;
  /** Flechas que caíram sobre os nossos. */
  friendlyFire: number;
}

/**
 * Portões de um povoado (Marco 12): o exército do bando só entra nos povoados do bando e nas
 * ruínas; o Comandante e os cavaleiros entram nos outros, menos em guerra, sob calamidade ou
 * durante um cerco.
 */
export interface GateRule {
  id: string;
  name: string;
  bounds: Rect;
  army: boolean;
  visitor: boolean;
}

/** O reino conhece o bando o bastante para deixar passar sem portagem. */
export const isFactionFriend = (s: GameState, owner: string) => owner === "PLAYER" || (s.factions.find((f) => f.id === owner)?.relation ?? 0) >= 15;

export const inRect = (r: Rect, p: Point, pad = 0) => p.x >= r.x - pad && p.x <= r.x + r.w + pad && p.y >= r.y - pad && p.y <= r.y + r.h + pad;
/** Distância de um ponto até um retângulo (0 dentro dele). */
export const rectDistance = (r: Rect, p: Point) => Math.hypot(Math.max(r.x - p.x, 0, p.x - r.x - r.w), Math.max(r.y - p.y, 0, p.y - r.y - r.h));

/** Passos da viagem rápida (fração de dia por passo). */
export const TRAVEL_STEP_DAYS = 0.05;
/** O relógio do store é atualizado em lotes (não a cada quadro). */
export const CLOCK_FLUSH_MS = 500;
export const SNAPSHOT_MS = 500;

export const TRUMPET_LABEL: Record<TrumpetCall, string> = {
  ADVANCE: "Avançar",
  HALT: "Alto",
  CHARGE: "Carregar",
  RETREAT: "Recuar",
  RALLY: "Reunir ao estandarte",
};
