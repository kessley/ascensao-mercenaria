import type { TroopType } from "../../utils/constants";
import { SIEGE, SUPPLY } from "../../utils/constants";
import {
  CAMP_BUILDINGS,
  isBuilt,
  readyOf,
  running,
  workOf,
  type CampBuilding,
  type CampCost,
  type CampKind,
  type CampPlan,
} from "../data/campGrid";
import { FOLLOWERS, type Follower } from "./campEvents";

/**
 * Marco 22, parte 2: a vida no acampamento, em regras puras (GDD 9.4).
 * - **Turnos:** cada batalhão no acampamento passa o dia descansando, treinando, na obra ou de guarda.
 * - **Gente nos postos:** cozinha, enfermaria, ferraria e as outras oficinas só funcionam com alguém
 *   nelas. Os seguidores ocupam os postos sozinhos (os do papel certo primeiro); o que sobra, um
 *   batalhão na obra cobre com soldados.
 * - **Obras levam dias:** o trabalho que sobra dos postos vai para as obras, na ordem em que foram postas.
 * - **Manutenção:** algumas construções custam ouro por semana.
 */

export type Shift = "REST" | "TRAIN" | "WORK" | "GUARD";
export const SHIFTS: readonly Shift[] = ["REST", "TRAIN", "WORK", "GUARD"];
export const SHIFT_LABEL: Record<Shift, string> = { REST: "Descanso", TRAIN: "Treino", WORK: "Obra", GUARD: "Guarda" };
export const SHIFT_EFFECT: Record<Shift, string> = {
  REST: "Nada a fazer: o batalhão descansa.",
  TRAIN: "Ganha experiência todo dia (mais com o campo, o estande ou o picadeiro da tropa).",
  WORK: "4 de trabalho por dia: cobre os postos sem ninguém e ergue as obras.",
  GUARD: "Vigia o acampamento: evita 15% do saque e ninguém é pego de surpresa.",
};

/** Trabalho por dia: um batalhão na obra, cada seguidor livre e o estado-maior do Comandante. */
export const LABOR = { BATTALION: 4, FOLLOWER: 1, BASE: 2 } as const;
/** XP por dia no turno de treino: com o pátio da tropa e sem ele. */
export const SHIFT_XP = { YARD: 6, NONE: 2 } as const;

/** Onde cada tropa treina no turno de treino. */
export function yardOf(troop: TroopType): CampKind {
  switch (troop) {
    case "ARCHERS":
    case "CROSSBOW":
    case "JAVELINS":
      return "ARCHERY";
    case "CAVALRY":
    case "HORSE_ARCHERS":
    case "KNIGHTS":
      return "RIDING";
    default:
      return "TRAINING";
  }
}

export const shiftXp = (plan: CampPlan, troop: TroopType) => (readyOf(plan, yardOf(troop)).length > 0 ? SHIFT_XP.YARD : SHIFT_XP.NONE);

export interface Staffing {
  /** Construções que funcionam (prontas, e com alguém se têm posto). */
  working: Set<string>;
  /** Quem está em cada posto: o nome do seguidor ou "soldados". */
  staff: Map<string, string>;
  /** Postos prontos sem ninguém (a construção parou). */
  idle: CampBuilding[];
  /** Trabalho que sobra para as obras hoje. */
  labor: number;
}

/**
 * Põe gente nos postos: primeiro os seguidores do papel certo, depois qualquer seguidor, depois
 * os soldados dos batalhões na obra (1 de trabalho por posto). O trabalho que sobra vai para as obras.
 */
export function staffPosts(plan: CampPlan, followers: readonly Follower[], workBattalions: number): Staffing {
  const working = new Set<string>();
  const staff = new Map<string, string>();
  const posts: CampBuilding[] = [];
  for (const b of plan.buildings) {
    if (!isBuilt(b)) continue;
    const def = CAMP_BUILDINGS[b.kind];
    if (!def.post) working.add(b.id);
    else if (!b.off) posts.push(b);
  }
  const free = [...followers];
  const take = (f: Follower, b: CampBuilding) => {
    free.splice(free.indexOf(f), 1);
    staff.set(b.id, `${f.name} (${FOLLOWERS[f.role].label.toLowerCase()})`);
    working.add(b.id);
  };
  // O papel certo primeiro, na ordem de preferência de cada posto
  for (const b of posts) {
    const roles = CAMP_BUILDINGS[b.kind].post!;
    for (const role of roles) {
      const f = free.find((x) => x.role === role);
      if (f) {
        take(f, b);
        break;
      }
    }
  }
  for (const b of posts) if (!working.has(b.id) && free.length > 0) take(free[0], b);
  let soldiers = workBattalions * LABOR.BATTALION;
  const idle: CampBuilding[] = [];
  for (const b of posts) {
    if (working.has(b.id)) continue;
    if (soldiers >= 1) {
      soldiers--;
      staff.set(b.id, "soldados do turno de obra");
      working.add(b.id);
    } else idle.push(b);
  }
  return { working, staff, idle, labor: LABOR.BASE + soldiers + free.length * LABOR.FOLLOWER };
}

/** Divide o trabalho do dia entre as obras, na ordem da planta. Devolve a planta e o que ficou pronto. */
export function advanceWorks(plan: CampPlan, labor: number): { plan: CampPlan; finished: CampBuilding[] } {
  let left = labor;
  const finished: CampBuilding[] = [];
  let changed = false;
  const buildings = plan.buildings.map((b) => {
    if (left <= 0 || isBuilt(b)) return b;
    const need = workOf(b.kind) - (b.built ?? 0);
    const put = Math.min(need, left);
    left -= put;
    changed = true;
    const built = (b.built ?? 0) + put;
    if (built >= workOf(b.kind)) {
      const done = { ...b };
      delete done.built;
      finished.push(done);
      return done;
    }
    return { ...b, built };
  });
  return { plan: changed ? { ...plan, buildings } : plan, finished };
}

/** Obras na planta (ainda não prontas). */
export const worksOf = (plan: CampPlan) => plan.buildings.filter((b) => !isBuilt(b));

/** Dias que faltam para uma obra, com tanto trabalho por dia (na fila, as de antes vão primeiro). */
export function daysLeft(plan: CampPlan, id: string, laborPerDay: number): number {
  let before = 0;
  for (const b of plan.buildings) {
    if (isBuilt(b)) continue;
    before += workOf(b.kind) - (b.built ?? 0);
    if (b.id === id) break;
  }
  return laborPerDay > 0 ? Math.ceil(before / laborPerDay) : Infinity;
}

// --- Moral ---

/**
 * O humor a que o acampamento tende: a moral das construções contra os batalhões que ela tem
 * de alegrar. Quem dorme ao relento puxa para baixo. Antes do Marco 22 o humor voltava sempre a 0.
 */
export function moodTarget(mood: number, inCamp: number, unbedded: number): number {
  return Math.max(-10, Math.min(12, (mood - inCamp) * 2 - unbedded * 2));
}

/** O humor anda 2 por dia na direção do alvo. */
export const driftMood = (current: number, target: number) => (current > target ? Math.max(target, current - 2) : Math.min(target, current + 2));

/** Na mesa de dados, por semana: a chance de sair briga. */
export const DICE_BRAWL = 0.15;

// --- O que o acampamento produz e custa ---

export interface Produce {
  rations: number;
  wood: number;
  fame: number;
}

/** O que sai por dia do acampamento montado (a horta, o lenhador, os troféus e o bardo). */
export function campProduce(plan: CampPlan, working: ReadonlySet<string>, forest: number): Produce {
  return {
    rations: running(plan, "GARDEN", working) ? 3 : 0,
    wood: running(plan, "LUMBER", working) && forest > 0.05 ? Math.round((1 + forest * 2) * 10) / 10 : 0,
    fame: (running(plan, "TROPHY", working) ? 0.1 : 0) + (running(plan, "STORY_FIRE", working) ? 0.05 : 0),
  };
}

/** Ouro por semana para manter as construções prontas. */
export function upkeepOf(plan: CampPlan): number {
  return plan.buildings.reduce((n, b) => n + (isBuilt(b) ? CAMP_BUILDINGS[b.kind].upkeep ?? 0 : 0), 0);
}

/** Quais batalhões dormem em leito: os primeiros, até acabarem as barracas (a cena usa a mesma ordem). */
export function bedded(ids: readonly string[], beds: number): Set<string> {
  return new Set(ids.slice(0, Math.max(0, beds)));
}

// --- A carpintaria ---

export type CarpentryItem = "WAGON" | "LADDER" | "RAM";
export interface SiegeKit {
  ladders: number;
  rams: number;
}
export const CARPENTRY: Record<CarpentryItem, { label: string; cost: CampCost; effect: string }> = {
  WAGON: { label: "Carroça", cost: { gold: 20, wood: 6 }, effect: "Mais uma carroça (mais barata que no mercado)." },
  LADDER: { label: "Escada de cerco", cost: { gold: 0, wood: SIEGE.LADDER_WOOD }, effect: `Pronta para o próximo cerco (até ${SIEGE.MAX_LADDERS}).` },
  RAM: { label: "Aríete", cost: { gold: 10, wood: SIEGE.RAM_WOOD }, effect: "Pronto para o próximo cerco (um por vez)." },
};

/** Por que a carpintaria não faz isso agora (null = faz). A oficina de cerco da fortaleza faz escadas e aríetes. */
export function carpentryProblem(plan: CampPlan, working: ReadonlySet<string>, item: CarpentryItem, kit: SiegeKit, wagons: number): string | null {
  const shop = item !== "WAGON" && running(plan, "SIEGE_WORKSHOP", working);
  if (!shop && !running(plan, "CARPENTRY", working)) return readyOf(plan, "CARPENTRY").length > 0 ? "A carpintaria está sem ninguém" : "Precisa da carpintaria";
  if (item === "WAGON" && wagons >= SUPPLY.MAX_WAGONS) return "O bando já tem carroças de sobra";
  if (item === "LADDER" && kit.ladders >= SIEGE.MAX_LADDERS) return "Escadas de sobra";
  const rams = shop ? 2 : 1;
  if (item === "RAM" && kit.rams >= rams) return rams > 1 ? "Os dois aríetes já estão prontos" : "O aríete já está pronto";
  return null;
}

/** O preço na carpintaria: com a oficina de cerco, a escada sai pela metade da madeira. */
export function carpentryCost(plan: CampPlan, working: ReadonlySet<string>, item: CarpentryItem): CampCost {
  const cost = CARPENTRY[item].cost;
  if (item !== "LADDER" || !running(plan, "SIEGE_WORKSHOP", working)) return cost;
  return { ...cost, wood: Math.ceil((cost.wood ?? 0) / 2) };
}
