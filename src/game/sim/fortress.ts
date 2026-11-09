import {
  CAMP_BUILDINGS,
  CARGO_PER_WAGON,
  INFIRMARY_BEDS,
  PALISADE,
  growProblem,
  isBuilt,
  isFortress,
  readyOf,
  type CampCost,
  type CampKind,
  type CampPlan,
  type WallKind,
} from "../data/campGrid";
import type { Point } from "../../utils/math";

/**
 * Marco 22, parte 3: a fortaleza (GDD 9.7). O bando finca o estandarte no lugar do acampamento
 * grande: a planta cresce para 34×34, ganha muralha e não anda mais. A terra vem por um de três
 * caminhos; a sede fica com um castelão e uma guarnição, e pode ser cercada com o bando longe. Em
 * campanha, o bando leva o acampamento de campo, um kit de até 6 construções nas carroças.
 *
 * Tudo aqui é regra pura (sem Phaser nem store), usada pelo store, pela cena e pelos testes.
 */

// --- A terra ---

export type LandPath = "CHARTER" | "RUINS" | "WILD";
export const LAND_PATHS: readonly LandPath[] = ["CHARTER", "RUINS", "WILD"];

export const LAND: Record<LandPath, { label: string; text: string; cost: CampCost }> = {
  CHARTER: {
    label: "Carta de terra",
    text: "O senhor destas terras concede o chão. Sai barato, mas o bando vira vassalo: os inimigos dele passam a ser os seus, e ele chama para a guerra.",
    cost: { gold: 120 },
  },
  RUINS: {
    label: "Reerguer as ruínas",
    text: "As pedras do forte velho viram muralha: sai mais barato. Antes, é preciso limpar quem mora nelas.",
    cost: { gold: -200, wood: -15 },
  },
  WILD: {
    label: "Terra de ninguém",
    text: "Ninguém manda aqui, e ninguém cobra. Mas os vizinhos desconfiam de um castelo de mercenários: o temor sobe e os cercos vêm mais cedo.",
    cost: { gold: 0 },
  },
};

/** Um senhor manda num povoado a até isto da fogueira: a terra é dele. */
export const LORD_RADIUS = 3200;
/** Ruínas assombradas a até isto da fogueira servem de pedreira. */
export const RUINS_RADIUS = 1600;
/** O local das ruínas precisa estar com no máximo isto de moradores (0 a 1). */
export const RUINS_CLEAR = 0.25;
/** Relação com o senhor para ele conceder a carta. */
export const CHARTER_RELATION = 25;
/** Terra de ninguém: temor que o castelo dá, e quanto mais cedo vêm os cercos. */
export const WILD_FEAR = 10;
export const WILD_SIEGE_PACE = 0.6;

/** O que a cena e o store sabem da terra em volta da fogueira. */
export interface LandCtx {
  /** O senhor da terra: dono do povoado de reino mais perto, a até `LORD_RADIUS`. */
  lord: { id: string; name: string; relation: number; atWar: boolean } | null;
  /** O reino a quem o Comandante já jurou fidelidade. */
  liege: string | null;
  /** As ruínas assombradas mais perto, a até `RUINS_RADIUS`, e quanto têm de moradores. */
  ruins: { id: string; name: string; fill: number } | null;
}

/** Por que este caminho não serve aqui (null = serve). */
export function landProblem(path: LandPath, ctx: LandCtx): string | null {
  if (path === "CHARTER") {
    if (!ctx.lord) return "Ninguém manda nesta terra para conceder uma carta";
    if (ctx.lord.atWar) return `Em guerra com ${ctx.lord.name}`;
    if (ctx.liege && ctx.liege !== ctx.lord.id) return "O Comandante já é vassalo de outra coroa";
    if (ctx.lord.relation < CHARTER_RELATION) return `${ctx.lord.name} ainda não confia no bando (relação ${CHARTER_RELATION})`;
    return null;
  }
  if (path === "RUINS") {
    if (!ctx.ruins) return "Não há ruínas perto do acampamento";
    if (ctx.ruins.fill > RUINS_CLEAR) return `Antes, limpe ${ctx.ruins.name} de quem mora lá`;
    return null;
  }
  return ctx.lord ? `Esta terra é de ${ctx.lord.name}` : null;
}

/** Quanto custa fincar o estandarte por este caminho: a muralha de madeira e o preço da terra. */
export function standardCost(path: LandPath): CampCost {
  const base = PALISADE[34].cost;
  const land = LAND[path].cost;
  return {
    gold: Math.max(0, base.gold + land.gold),
    wood: Math.max(0, (base.wood ?? 0) + (land.wood ?? 0)),
    iron: Math.max(0, (base.iron ?? 0) + (land.iron ?? 0)),
  };
}

/** O que falta para fincar o estandarte (sem o preço). */
export function standardProblem(plan: CampPlan, ctx: { fame: number; battalions: number }, path: LandPath, land: LandCtx): string | null {
  if (isFortress(plan)) return "O estandarte já está fincado";
  if (plan.size !== 28) return "Só a partir da paliçada grande";
  return growProblem(plan, ctx) ?? landProblem(path, land);
}

/** A planta vira fortaleza: o quadrado cresce 3 células de cada lado, com muralha de madeira. */
export function fortressPlan(plan: CampPlan): CampPlan {
  return { ...plan, size: 34, wall: "WOOD", ditch: plan.ditch };
}

// --- A sede: o castelão, a guarnição e o cerco ---

export interface Fortress {
  /** Dia em que o estandarte foi fincado. */
  founded: number;
  land: LandPath;
  /** Carta de terra: o reino que concedeu. */
  lord: string | null;
  /** Ruínas reerguidas: o local (os moradores não voltam). */
  ruinId: string | null;
  /** Tenente deixado no comando (null = a guarnição se vira sozinha). */
  castellan: string | null;
  /** Dia do próximo cerco à sede. */
  nextSiege: number;
  /** Quantos cercos já vieram (cada um vem maior). */
  sieges: number;
  /** O kit do acampamento de campo. */
  kit: CampKind[];
}

/** Cercos: o intervalo cai com a fama; na terra de ninguém, vêm mais cedo. */
export const SEAT_SIEGE = {
  EVERY: 45,
  MIN_EVERY: 20,
  FAME_PACE: 0.25,
  /** Com o pombal, o aviso chega com isto de dias; sem ele, no dia. */
  WARN_DOVECOTE: 7,
  /** Tamanho da força: base, por fama e por cerco já vindo. */
  BASE: 24,
  PER_FAME: 0.6,
  PER_SIEGE: 8,
} as const;

export function siegeEvery(land: LandPath, fame: number): number {
  const days = Math.max(SEAT_SIEGE.MIN_EVERY, SEAT_SIEGE.EVERY - fame * SEAT_SIEGE.FAME_PACE);
  return Math.round(days * (land === "WILD" ? WILD_SIEGE_PACE : 1));
}

export function siegeHost(fame: number, sieges: number): number {
  return Math.round(SEAT_SIEGE.BASE + fame * SEAT_SIEGE.PER_FAME + sieges * SEAT_SIEGE.PER_SIEGE);
}

/** Quantos soldados valem cada defensor atrás da muralha. */
export const WALL_DEFENSE: Record<WallKind, number> = { WOOD: 1.6, STONE: 2.6 };
export const SEAT_BONUS = { KEEP: 1.3, CISTERN: 1.15, STOREHOUSE: 1.1, CASTELLAN: 1.2, NO_CASTELLAN: 0.85, TOWER: 4 } as const;

/** A força com que a sede se defende sozinha: a guarnição, a muralha e o que há dentro. */
export function seatDefense(plan: CampPlan, garrison: number, castellan: boolean): number {
  let k = WALL_DEFENSE[plan.wall ?? "WOOD"] * (castellan ? SEAT_BONUS.CASTELLAN : SEAT_BONUS.NO_CASTELLAN);
  if (readyOf(plan, "KEEP").length > 0) k *= SEAT_BONUS.KEEP;
  if (readyOf(plan, "CISTERN").length > 0) k *= SEAT_BONUS.CISTERN;
  if (readyOf(plan, "STOREHOUSE").length > 0) k *= SEAT_BONUS.STOREHOUSE;
  return garrison * k + readyOf(plan, "TOWER").length * SEAT_BONUS.TOWER;
}

export interface SeatSiegeResult {
  held: boolean;
  /** Fração da guarnição que morre. */
  loss: number;
  /** Quanto do cercador cai (para a notícia). */
  killed: number;
}

/**
 * O cerco à sede sem o bando: a defesa, com a sorte do dia (de 80% a 120%), contra quem veio. A
 * sede que aguenta perde gente na proporção do ataque; a que cai perde quase toda a guarnição.
 */
export function seatSiege(defense: number, attackers: number, roll = Math.random()): SeatSiegeResult {
  const luck = 0.8 + roll * 0.4;
  const held = defense * luck >= attackers;
  const ratio = attackers / Math.max(1, defense * luck);
  return {
    held,
    loss: held ? Math.min(0.5, ratio * 0.35) : 0.8,
    killed: Math.round(Math.min(attackers, held ? attackers * 0.6 : defense * 0.5)),
  };
}

/** Sede saqueada: um terço das construções (fora as fixas e as cavadas) queima e volta a ser obra. */
export const SACK_BURNS = 1 / 3;
export function sackedPlan(plan: CampPlan, random = Math.random): { plan: CampPlan; burned: CampKind[] } {
  const burnable = plan.buildings.filter((b) => !CAMP_BUILDINGS[b.kind].fixed && !CAMP_BUILDINGS[b.kind].stays && b.built === undefined);
  const n = Math.round(burnable.length * SACK_BURNS);
  const order = [...burnable].sort(() => random() - 0.5).slice(0, n);
  const burned = new Set(order.map((b) => b.id));
  return {
    plan: { ...plan, buildings: plan.buildings.map((b) => (burned.has(b.id) ? { ...b, built: 0 } : b)) },
    burned: order.map((b) => b.kind),
  };
}

/** O saque na sede que cai: parte do ouro (nada, com a tesouraria) e do depósito. */
export const SACK = { GOLD: 0.4, DEPOT: 0.5, RATIONS: 0.5 } as const;
export function sackGold(plan: CampPlan, gold: number): number {
  return readyOf(plan, "TREASURY").length > 0 ? 0 : Math.floor(gold * SACK.GOLD);
}

// --- O acampamento de campo ---

export const FIELD_KIT_MAX = 6;

/** O que pode ir no kit: o que existe pronto na fortaleza e anda nas carroças. */
export function kitChoices(plan: CampPlan): CampKind[] {
  const out: CampKind[] = [];
  for (const b of plan.buildings.filter(isBuilt)) {
    const def = CAMP_BUILDINGS[b.kind];
    if (def.fixed || def.stays || def.tier > 1 || def.cargo <= 0) continue;
    if (!out.includes(b.kind)) out.push(b.kind);
  }
  return out;
}

export const kitCargo = (kit: readonly CampKind[]) => kit.reduce((n, k) => n + CAMP_BUILDINGS[k].cargo, 0);

/** Por que este kit não vai (null = vai). Cada construção vai uma vez, e o kit cabe nas carroças. */
export function kitProblem(kit: readonly CampKind[], plan: CampPlan, wagons: number): string | null {
  if (kit.length > FIELD_KIT_MAX) return `No máximo ${FIELD_KIT_MAX} construções`;
  if (new Set(kit).size !== kit.length) return "Cada construção vai uma vez só";
  const choices = kitChoices(plan);
  const missing = kit.find((k) => !choices.includes(k));
  if (missing) return `A fortaleza não tem ${CAMP_BUILDINGS[missing].label.toLowerCase()} pronta`;
  if (kitCargo(kit) > wagons * CARGO_PER_WAGON) return `Não cabe nas carroças (${kitCargo(kit)} de carga, ${wagons * CARGO_PER_WAGON} de lugar)`;
  return null;
}

/** O que o acampamento de campo montado dá ao exército. */
export interface FieldCamp {
  /** Barracas: ninguém dorme ao relento (sem frio nem pântano). */
  shelter: boolean;
  /** Fogueira ou cozinha: a comida sai cozida (sem o gasto de quem come cru). */
  cooked: boolean;
  /** Leitos da enfermaria: os doentes saram como no acampamento. */
  sickBeds: number;
  /** Ferraria ou outra oficina: a necessidade de Ofício conta em campo. */
  craft: number;
}

export function fieldCampOf(kit: readonly CampKind[]): FieldCamp {
  return {
    shelter: kit.includes("BARRACK"),
    cooked: true,
    sickBeds: kit.includes("INFIRMARY") ? INFIRMARY_BEDS : 0,
    craft: kit.filter((k) => CAMP_BUILDINGS[k].craft).length,
  };
}

/** Quem está a até isto do acampamento de campo montado conta como acampado ali. */
export const FIELD_RADIUS = 700;
/** Longe da fortaleza: a partir daqui dá para montar o acampamento de campo. */
export const FIELD_MIN_DISTANCE = 2500;

export function fieldPitchProblem(at: Point, seat: Point, pitched: boolean): string | null {
  if (pitched) return "O acampamento de campo já está montado";
  if (Math.hypot(at.x - seat.x, at.y - seat.y) < FIELD_MIN_DISTANCE) return "Perto da fortaleza, o bando dorme nela";
  return null;
}
