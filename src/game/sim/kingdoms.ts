import { BUILDINGS, COURT, KINGDOM, REALM, type BuildingId } from "../../utils/constants";
import { seasonOf } from "../../utils/season";
import type { FactionDef, WorldDef } from "../data/world";
import { distance, type Point } from "../../utils/math";
import { createRng, randomSeed, type Rng } from "../worldgen/rng";
import { TheRealm, inRealm, ofRealm, theRealm, toRealm } from "../worldgen/names";
import { canHost } from "./trade";
import { isCalamityOwner, isFactionOwner, kingdomsAtWar, plunder, settlementDefense, type FactionState, type KingdomWar, type RealmLog, type RealmState, type Settlement } from "./realm";
import {
  crown,
  deathChance,
  heirsOf,
  isAdult,
  lordsOf,
  nobleName,
  officer,
  replaceOfficer,
  rulerOf,
  rulerTitle,
  type Noble,
} from "./nobility";

/**
 * Reinos vivos (Marco 15): toda semana cada reino olha o que precisa (fome, ameaça, oportunidade,
 * vingança, riqueza) e escolhe um plano, que vira coisa de verdade no mapa: convocação que tira
 * gente do campo, exército de um lorde marchando, cerco que dura dias. A guerra cansa e acaba em
 * tratado; reis morrem e herdeiros disputam o trono; lordes conspiram; povoados com fome e
 * impostos altos se revoltam. O jogador só fica sabendo quando a notícia chega (rumors.ts).
 */

export type PlanKind = "CAMPAIGN" | "DEFEND" | "CRUSADE" | "EXPAND" | "TRADE" | "RECOVER";

export const PLAN_LABEL: Record<PlanKind, string> = {
  CAMPAIGN: "campanha militar",
  DEFEND: "defesa das fronteiras",
  CRUSADE: "cruzada contra a calamidade",
  EXPAND: "expansão para terras livres",
  TRADE: "obras e comércio",
  RECOVER: "recuperar o reino",
};

export interface KingdomPlan {
  kind: PlanKind;
  /** Reino, povoado ou calamidade contra quem. */
  targetId?: string;
  since: number;
  reason: string;
}

/** Exército de um lorde: registro da simulação (a cena põe o bando de verdade no mapa). */
export interface FieldArmy {
  id: string;
  factionId: string;
  lordId: string | null;
  fromId: string;
  targetId: string;
  size: number;
  since: number;
  /** A cena já pôs o bando no mapa (id do bando). */
  bandId?: string;
  /** Dia em que chegou e começou o cerco; como pretende tomar a cidade (Marco 16). */
  sieging?: number;
  siegeMode?: "ASSAULT" | "STARVE";
  /** Acabou: tomou a cidade, desistiu ou foi chamado de volta (a cena desmonta o bando). */
  outcome?: "TOOK" | "FAILED" | "RECALLED";
}

export interface Alliance {
  a: string;
  b: string;
  since: number;
}

export type CourtEventKind = "FEAST" | "TOURNAMENT" | "WEDDING" | "FUNERAL" | "CORONATION";

export const COURT_EVENT_LABEL: Record<CourtEventKind, string> = {
  FEAST: "Banquete",
  TOURNAMENT: "Torneio",
  WEDDING: "Casamento",
  FUNERAL: "Funeral",
  CORONATION: "Coroação",
};

/** Festa ou cerimônia numa capital: anunciada com dias de antecedência e real no mapa. */
export interface CourtEvent {
  id: string;
  kind: CourtEventKind;
  townId: string;
  day: number;
  /** Nobres no centro da cerimônia. */
  who: string[];
  purse?: number;
}

const rng = () => createRng(randomSeed());
const realmName = (world: WorldDef, id: string) => world.factions.find((f) => f.id === id)?.name ?? "reino";
const townsOf = (s: RealmState, id: string) => s.settlements.filter((t) => t.owner === id);
const seatOf = (s: RealmState, f: FactionState) => s.settlements.find((t) => t.id === f.seatId) ?? townsOf(s, f.id)[0];
const here = (p: Point | undefined): Point | undefined => (p ? { x: p.x, y: p.y } : undefined);

/** Nome do nobre para as notícias (com o título certo do reino dele). */
export const nameOf = (n: Noble, world: WorldDef) => nobleName(n, realmName(world, n.factionId));

/** Guerras em andamento de um reino. */
function warsOf(s: RealmState, id: string): KingdomWar[] {
  return s.wars.filter((w) => w.peace === undefined && (w.a === id || w.b === id));
}

const foeIn = (w: KingdomWar, id: string) => (w.a === id ? w.b : w.a);

function allied(s: RealmState, a: string, b: string): boolean {
  return s.alliances.some((x) => (x.a === a && x.b === b) || (x.a === b && x.b === a));
}

function onTruce(s: RealmState, a: string, b: string): boolean {
  return s.wars.some((w) => w.peace !== undefined && ((w.a === a && w.b === b) || (w.a === b && w.b === a)));
}

/** Força militar aproximada: guarnições e homens em campo. */
function powerOf(s: RealmState, id: string): number {
  return townsOf(s, id).reduce((n, t) => n + t.garrison, 0) + s.armies.filter((a) => a.factionId === id).reduce((n, a) => n + a.size, 0);
}

/** O povoado mais perto de um ponto. */
function nearestTown(from: Point, towns: readonly Settlement[]): Settlement | undefined {
  return [...towns].sort((a, b) => distance(a, from) - distance(b, from))[0];
}

/** Declara a guerra; os aliados dos dois lados entram nela. */
function declareWar(s: RealmState, world: WorldDef, day: number, a: string, b: string, why: string, log: RealmLog[]): void {
  if (kingdomsAtWar(s.wars, a, b)) return;
  s.wars.push({ a, b, since: day });
  log.push({ text: `Guerra! ${TheRealm(realmName(world, a))} declarou guerra ${toRealm(realmName(world, b))} (${why}). Embargo entre os dois: armas e cavalos sobem de preço.`, tone: "info", where: here(seatOf(s, s.factions.find((f) => f.id === a) as FactionState)) });
  // Aliados entram na guerra
  for (const al of s.alliances) {
    const ally = al.a === b ? al.b : al.b === b ? al.a : null;
    if (!ally || ally === a || kingdomsAtWar(s.wars, ally, a) || onTruce(s, ally, a)) continue;
    if (!s.factions.some((f) => f.id === ally && !f.fallen)) continue;
    s.wars.push({ a: ally, b: a, since: day });
    log.push({ text: `${TheRealm(realmName(world, ally))} honrou a aliança e entrou na guerra contra ${theRealm(realmName(world, a))}.`, tone: "info", where: here(seatOf(s, s.factions.find((f) => f.id === ally) as FactionState)) });
  }
  // A aliança entre os dois lados acabou
  s.alliances = s.alliances.filter((x) => !((x.a === a && x.b === b) || (x.a === b && x.b === a)));
}

/**
 * Plano da semana: o reino olha o perigo (calamidade), a guerra, a fome, as terras livres e o
 * tesouro. Quem governa pesa: bravos e cruéis atacam com menos vantagem, medrosos se defendem.
 */
function choosePlan(s: RealmState, world: WorldDef, day: number, f: FactionState, r: Rng): KingdomPlan {
  const own = townsOf(s, f.id);
  const seat = seatOf(s, f);
  const winter = seasonOf(day) === "WINTER";
  const ruler = rulerOf(s.nobles, f.id);
  const bold = (ruler?.traits.includes("BRAVE") ? 0.25 : 0) + (ruler?.traits.includes("CRUEL") ? 0.15 : 0) - (ruler?.traits.includes("COWARD") ? 0.3 : 0);
  const plan = (kind: PlanKind, reason: string, targetId?: string): KingdomPlan => ({ kind, reason, targetId, since: f.plan?.kind === kind && f.plan.targetId === targetId ? f.plan.since : day });

  // A calamidade tomou povoados por perto: todos os reinos sentem
  const held = s.settlements.filter((t) => isCalamityOwner(t.owner) && seat && distance(t, seat) < 22000);
  if (held.length > 0 && !winter) return plan("CRUSADE", `${held[0].name} está nas mãos da calamidade`, held[0].id);
  // Guerra em andamento
  const wars = warsOf(s, f.id);
  if (wars.length > 0) {
    const foe = foeIn(wars[0], f.id);
    const ratio = powerOf(s, f.id) / Math.max(1, powerOf(s, foe));
    if (!winter && ratio >= 0.75 - bold) return plan("CAMPAIGN", `a guerra contra ${theRealm(realmName(world, foe))}`, foe);
    return plan("DEFEND", `${theRealm(realmName(world, foe))} é forte demais para atacar agora`, foe);
  }
  if (f.atWar) return plan(winter ? "DEFEND" : "CAMPAIGN", "os mercenários viraram inimigos da coroa", "PLAYER");
  const hungry = own.filter((t) => t.econ.famine).length / Math.max(1, own.length);
  if (hungry >= 0.25) return plan("RECOVER", "a fome nas terras do reino");
  if ((f.levy ?? 0) > 0.15) return plan("RECOVER", "faltam braços no campo");
  const free = seat ? s.settlements.filter((t) => t.owner === "FREE" && distance(t, seat) < 18000) : [];
  if (free.length > 0 && !winter && r.chance(0.5)) return plan("EXPAND", `${free[0].name} não tem senhor`, nearestTown(seat as Point, free)?.id);
  return plan("TRADE", "o tesouro pede obras");
}

/** Convoca um exército: um lorde (ou o marechal) leva gente tirada do campo. */
function raiseArmy(s: RealmState, world: WorldDef, day: number, f: FactionState, target: Settlement, log: RealmLog[]): FieldArmy | null {
  const own = townsOf(s, f.id);
  if (own.length === 0 || (f.treasury ?? 0) < KINGDOM.ARMY_COST) return null;
  if (s.armies.filter((a) => a.factionId === f.id).length >= KINGDOM.MAX_ARMIES) return null;
  if (s.armies.some((a) => a.factionId === f.id && a.targetId === target.id)) return null;
  // Socorro a uma cidade do próprio reino: sai de outra cidade
  const from = (nearestTown(target, own.filter((t) => t.id !== target.id)) ?? nearestTown(target, own)) as Settlement;
  const free = [...lordsOf(s.nobles, f.id), ...s.nobles.filter((n) => n.alive && n.factionId === f.id && n.office === "MARSHAL" && !n.captiveOf)].filter((n) => !n.armyId && isAdult(n));
  const lord = free.sort((a, b) => b.martial - a.martial)[0] ?? null;
  const size = Math.min(KINGDOM.ARMY_SIZE.MAX, KINGDOM.ARMY_SIZE.BASE + own.length * KINGDOM.ARMY_SIZE.PER_TOWN + (lord?.martial ?? 2));
  const army: FieldArmy = { id: `A${day}-${f.id}-${s.armies.length}`, factionId: f.id, lordId: lord?.id ?? null, fromId: from.id, targetId: target.id, size, since: day };
  s.armies.push(army);
  f.treasury = (f.treasury ?? 0) - KINGDOM.ARMY_COST;
  f.levy = Math.min(KINGDOM.LEVY_MAX, (f.levy ?? 0) + KINGDOM.LEVY_PER_ARMY);
  if (lord) {
    lord.armyId = army.id;
    lord.at = from.id;
  }
  const who = lord ? nameOf(lord, world) : `${TheRealm(realmName(world, f.id))}`;
  log.push({ text: `${who} convocou ${size} homens em ${from.name} e marcha contra ${target.name}. Faltam braços nas lavouras do reino.`, tone: "info", where: here(from) });
  return army;
}

function runPlan(s: RealmState, world: WorldDef, day: number, f: FactionState, r: Rng, log: RealmLog[]): void {
  const plan = f.plan;
  if (!plan) return;
  const own = townsOf(s, f.id);
  const seat = seatOf(s, f);
  if (!seat) return;
  switch (plan.kind) {
    case "CAMPAIGN": {
      // Contra o bando, os exércitos saem pela regra de sempre (WorldScene.spawnArmies)
      if (plan.targetId === "PLAYER" || !plan.targetId) return;
      const prize = nearestTown(seat, townsOf(s, plan.targetId));
      if (prize) raiseArmy(s, world, day, f, prize, log);
      return;
    }
    case "CRUSADE": {
      const t = s.settlements.find((x) => x.id === plan.targetId);
      if (t) raiseArmy(s, world, day, f, t, log);
      return;
    }
    case "EXPAND": {
      const t = s.settlements.find((x) => x.id === plan.targetId && x.owner === "FREE");
      if (!t) return;
      // Metade das vezes a aldeia jura sem luta (o reino rico compra, o forte assusta)
      if ((f.treasury ?? 0) > 200 && r.chance(0.5)) {
        t.owner = f.id;
        f.treasury = (f.treasury ?? 0) - 150;
        const lord = lordsOf(s.nobles, f.id)[0];
        if (lord) lord.fiefs = [...lord.fiefs, t.id];
        log.push({ text: `${t.name} jurou fidelidade ${toRealm(realmName(world, f.id))}.`, tone: "info", where: here(t) });
      } else raiseArmy(s, world, day, f, t, log);
      return;
    }
    case "TRADE": {
      if ((f.treasury ?? 0) < 260) return;
      const t = r.pick(own);
      const options = (Object.keys(BUILDINGS) as BuildingId[]).filter((b) => !t.buildings.includes(b) && canHost(t, b));
      if (options.length === 0) return;
      const b = r.pick(options);
      t.buildings = [...t.buildings, b];
      f.treasury = (f.treasury ?? 0) - BUILDINGS[b].gold * 1.5;
      log.push({ text: `${TheRealm(realmName(world, f.id))} ergueu ${BUILDINGS[b].label.toLowerCase()} em ${t.name}.`, tone: "info", where: here(t) });
      return;
    }
    case "RECOVER":
      f.levy = Math.max(0, (f.levy ?? 0) - KINGDOM.LEVY_RETURN);
      for (const t of own) if (t.econ.famine) t.prosperity = Math.min(100, t.prosperity + 3);
      return;
    case "DEFEND":
      for (const t of own.slice(0, 3)) t.garrison = Math.min(Math.round(REALM.BASE_GARRISON[t.kind] * 1.5), t.garrison + 2);
      return;
  }
}

/** Fim de uma guerra: tratado (quem está mais cansado paga), trégua e exércitos de volta. */
function makePeace(s: RealmState, world: WorldDef, day: number, w: KingdomWar, log: RealmLog[]): void {
  w.peace = day;
  const fa = s.factions.find((f) => f.id === w.a) as FactionState;
  const fb = s.factions.find((f) => f.id === w.b) as FactionState;
  for (const a of s.armies) {
    if (a.outcome || (a.factionId !== w.a && a.factionId !== w.b)) continue;
    const t = s.settlements.find((x) => x.id === a.targetId);
    if (t && (t.owner === w.a || t.owner === w.b)) a.outcome = "RECALLED";
  }
  const [tired, fresh] = (fa.weariness ?? 0) >= (fb.weariness ?? 0) ? [fa, fb] : [fb, fa];
  const tribute = Math.min(KINGDOM.PEACE_TRIBUTE, Math.max(0, tired.treasury ?? 0));
  tired.treasury = (tired.treasury ?? 0) - tribute;
  fresh.treasury = (fresh.treasury ?? 0) + tribute;
  fa.weariness = Math.max(0, (fa.weariness ?? 0) - 25);
  fb.weariness = Math.max(0, (fb.weariness ?? 0) - 25);
  // Quem perdeu cede uma aldeia da fronteira, se o vencedor estiver bem à frente
  let ceded = "";
  if ((tired.weariness ?? 0) > (fresh.weariness ?? 0) + 25) {
    const seat = seatOf(s, fresh);
    const prize = seat ? nearestTown(seat, townsOf(s, tired.id).filter((t) => t.kind === "VILLAGE")) : undefined;
    if (prize) {
      prize.owner = fresh.id;
      prize.conqueredDay = day;
      ceded = ` e cede ${prize.name}`;
    }
  }
  log.push({
    text: `Paz entre ${theRealm(realmName(world, w.a))} e ${theRealm(realmName(world, w.b))}: ${theRealm(realmName(world, tired.id))} paga ${tribute} de ouro de tributo${ceded}. Trégua de ${KINGDOM.TRUCE_DAYS} dias.`,
    tone: "info",
    where: here(seatOf(s, fresh)),
  });
  // Nobres presos voltam com a paz
  for (const n of s.nobles) {
    if (n.alive && n.captiveOf && ((n.factionId === w.a && n.captiveOf === w.b) || (n.factionId === w.b && n.captiveOf === w.a))) {
      n.captiveOf = undefined;
      n.at = n.fiefs[0] ?? seatOf(s, s.factions.find((f) => f.id === n.factionId) as FactionState)?.id ?? n.at;
    }
  }
}

/** Reinos e guerra: uma vez por semana. */
export function kingdomsWeek(s: RealmState, world: WorldDef, day: number): RealmLog[] {
  const r = rng();
  const log: RealmLog[] = [];
  const winter = seasonOf(day) === "WINTER";
  s.wars = s.wars.filter((w) => w.peace === undefined || day - w.peace < KINGDOM.TRUCE_DAYS);

  for (const f of s.factions) {
    if (f.fallen) continue;
    const own = townsOf(s, f.id);
    if (own.length === 0) {
      f.fallen = true;
      f.plan = undefined;
      log.push({ text: `${TheRealm(realmName(world, f.id))} deixou de existir: não lhe resta nenhum povoado.`, tone: "info" });
      for (const w of warsOf(s, f.id)) w.peace = day;
      // A corte vai para o exílio: ninguém mora mais no palácio
      for (const n of s.nobles) if (n.alive && n.factionId === f.id && !n.captiveOf) n.at = "EXILE";
      continue;
    }
    // Capital caiu: a corte foge para a maior cidade que sobrou
    if (!own.some((t) => t.id === f.seatId)) {
      const next = [...own].sort((a, b) => b.population - a.population)[0];
      log.push({ text: `A corte ${ofRealm(realmName(world, f.id))} fugiu para ${next.name}.`, tone: "info", where: here(next) });
      f.seatId = next.id;
      for (const n of s.nobles) if (n.alive && n.factionId === f.id && n.rank !== "LORD" && !n.captiveOf) n.at = next.id;
    }
    // Tesouro: impostos entram, exércitos custam
    const income = own.reduce((n, t) => n + (t.population / 10) * KINGDOM.TREASURY_PER_10_POP * (t.prosperity / 100), 0);
    const upkeep = s.armies.filter((a) => a.factionId === f.id).length * KINGDOM.ARMY_UPKEEP;
    f.treasury = Math.round((f.treasury ?? 0) + income - upkeep);
    // Gente volta para o campo; cansaço de guerra
    if (!s.armies.some((a) => a.factionId === f.id)) f.levy = Math.max(0, (f.levy ?? 0) - KINGDOM.LEVY_RETURN);
    const fighting = warsOf(s, f.id).length > 0;
    const famine = own.filter((t) => t.econ.famine).length;
    f.weariness = Math.max(0, Math.min(100, (f.weariness ?? 0) + (fighting ? KINGDOM.WEARINESS_WEEK + famine * KINGDOM.WEARINESS_FAMINE : -KINGDOM.WEARINESS_REST)));
    const before = f.plan?.kind;
    f.plan = choosePlan(s, world, day, f, r);
    if (f.plan.kind !== before && (f.plan.kind === "CAMPAIGN" || f.plan.kind === "CRUSADE")) {
      log.push({ text: `O conselho ${ofRealm(realmName(world, f.id))} decidiu: ${PLAN_LABEL[f.plan.kind]} (${f.plan.reason}).`, tone: "info", where: here(seatOf(s, f)) });
    }
    runPlan(s, world, day, f, r, log);
  }

  // Paz: passado o limite de cansaço, a chance cresce a cada semana
  for (const w of s.wars) {
    if (w.peace !== undefined) continue;
    const fa = s.factions.find((f) => f.id === w.a);
    const fb = s.factions.find((f) => f.id === w.b);
    if (!fa || !fb) continue;
    if (w.civil) {
      endCivilWar(s, world, day, w, r, log);
      continue;
    }
    const weary = Math.max(fa.weariness ?? 0, fb.weariness ?? 0);
    if (weary >= KINGDOM.WEARINESS_PEACE && r.chance(0.2 + (weary - KINGDOM.WEARINESS_PEACE) / 80)) makePeace(s, world, day, w, log);
  }

  // Guerras novas: nunca em inverno, nunca em trégua; belicosos e cruéis começam mais
  const living = s.factions.filter((f) => !f.fallen && townsOf(s, f.id).length > 0);
  if (!winter && living.length >= 2 && s.wars.filter((w) => w.peace === undefined).length < 3) {
    for (const f of r.shuffle(living)) {
      if (warsOf(s, f.id).length > 0 || (f.weariness ?? 0) > 25) continue;
      const def = world.factions.find((x) => x.id === f.id);
      const ruler = rulerOf(s.nobles, f.id);
      const mood = (def?.temperament === "BELLIGERENT" ? 2 : def?.temperament === "PIOUS" ? 0.5 : 1) * (ruler?.traits.some((t) => t === "CRUEL" || t === "AMBITIOUS") ? 1.5 : 1);
      if (!r.chance(KINGDOM.WAR_CHANCE * mood)) continue;
      const seat = seatOf(s, f);
      const foes = living
        .filter((o) => o !== f && !allied(s, f.id, o.id) && !onTruce(s, f.id, o.id) && !kingdomsAtWar(s.wars, f.id, o.id))
        .sort((a, b) => distance(seatOf(s, a), seat) - distance(seatOf(s, b), seat));
      const foe = foes[0];
      if (!foe) continue;
      declareWar(s, world, day, f.id, foe.id, r.pick(["uma velha disputa de fronteira", "uma ofensa à coroa", "o controle das estradas", "um casamento desfeito"]), log);
      break;
    }
  }

  // Alianças e casamentos entre reinos em paz
  if (living.length >= 2 && r.chance(KINGDOM.ALLIANCE_CHANCE * 2)) {
    const [a, b] = r.shuffle(living);
    if (!allied(s, a.id, b.id) && !kingdomsAtWar(s.wars, a.id, b.id)) {
      const common = warsOf(s, a.id).some((w) => warsOf(s, b.id).some((x) => foeIn(x, b.id) === foeIn(w, a.id)));
      if (common || r.chance(0.5)) {
        s.alliances.push({ a: a.id, b: b.id, since: day });
        log.push({ text: `Aliança defensiva entre ${theRealm(realmName(world, a.id))} e ${theRealm(realmName(world, b.id))}.`, tone: "info", where: here(seatOf(s, a)) });
      }
    }
  }
  if (living.length >= 2 && r.chance(KINGDOM.MARRIAGE_CHANCE)) royalMarriage(s, world, day, r, log);

  // Coalizão contra o bando: quem cresce demais ou espalha terror
  const mine = townsOf(s, "PLAYER").length;
  if ((mine >= KINGDOM.COALITION_TOWNS || s.fear >= KINGDOM.COALITION_FEAR) && r.chance(KINGDOM.COALITION_CHANCE)) {
    const members = living.filter((f) => !f.atWar && f.relation < 20 && f.id !== s.liege);
    if (members.length >= 2) {
      for (const f of members) {
        f.atWar = true;
        f.relation = Math.min(f.relation, REALM.WAR_BELOW);
      }
      log.push({ text: `COALIZÃO! ${members.map((f) => `${TheRealm(realmName(world, f.id))}`).join(", ")} ${members.length > 1 ? "juraram" : "jurou"} acabar com os ${world.bandName}.`, tone: "bad" });
    }
  }
  return log;
}

/** Filhos adultos e solteiros de duas coroas casam: nasce uma aliança e uma festa na capital. */
function royalMarriage(s: RealmState, world: WorldDef, day: number, r: Rng, log: RealmLog[]): void {
  const single = s.nobles.filter((n) => n.alive && !n.spouseId && !n.captiveOf && isAdult(n) && n.age < 40 && (n.rank === "HEIR" || n.rank === "CHILD" || n.rank === "RULER"));
  for (const a of r.shuffle(single)) {
    const b = single.find((o) => o.factionId !== a.factionId && o.female !== a.female && !kingdomsAtWar(s.wars, a.factionId, o.factionId));
    if (!b) continue;
    a.spouseId = b.id;
    b.spouseId = a.id;
    // Quem não herda vai morar na corte do outro
    const [stays, moves] = a.rank === "RULER" || a.rank === "HEIR" ? [a, b] : [b, a];
    if (moves.rank === "RULER") continue;
    const other = moves.factionId;
    moves.factionId = stays.factionId;
    moves.rank = stays.rank === "RULER" ? "CONSORT" : "KIN";
    moves.at = stays.at;
    if (!allied(s, stays.factionId, other)) s.alliances.push({ a: stays.factionId, b: other, since: day });
    const town = s.settlements.find((t) => t.id === stays.at);
    if (town) {
      s.courtEvents.push({ id: `E${day}-${a.id}`, kind: "WEDDING", townId: town.id, day: day + COURT.EVENT_NOTICE, who: [a.id, b.id] });
      log.push({ text: `Casamento real: ${nameOf(a, world)} e ${nameOf(b, world)} se casam em ${town.name} daqui a ${COURT.EVENT_NOTICE} dias.`, tone: "info", where: here(town) });
    }
    return;
  }
}

// --- Exércitos e cercos ---

/** Um exército chegou ao alvo: começa o cerco (a cidade para de comerciar e a comida some). */
export function beginSiege(s: RealmState, world: WorldDef, army: FieldArmy, day: number): RealmLog[] {
  const t = s.settlements.find((x) => x.id === army.targetId);
  if (!t) return [];
  // Socorro que chegou à própria cidade: não há o que cercar, vai para casa
  if (t.owner === army.factionId) {
    army.outcome = "RECALLED";
    return [];
  }
  army.sieging = day;
  t.besiegedBy = army.factionId;
  return [{ text: `Cerco a ${t.name}: o exército ${ofRealm(realmName(world, army.factionId))} acampou diante dos muros.`, tone: t.owner === "PLAYER" ? "bad" : "info", where: here(t) }];
}

/** Assalto ou fome (Marco 16): conforme a tropa, o que há nos armazéns, a estação e o jeito do lorde. */
function siegePlan(s: RealmState, a: FieldArmy, t: Settlement, day: number): "ASSAULT" | "STARVE" {
  const lord = s.nobles.find((n) => n.id === a.lordId);
  const hot = lord?.traits.includes("BRAVE") || lord?.traits.includes("CRUEL");
  const patient = lord?.traits.includes("CUNNING") || lord?.traits.includes("COWARD") || lord?.traits.includes("SCHOLAR");
  const ratio = a.size / Math.max(1, settlementDefense(t));
  // No inverno não se espera no frio; cidade com fome não precisa de escada
  if (t.econ.famine) return "STARVE";
  if (seasonOf(day) === "WINTER" || hot) return ratio >= 0.7 ? "ASSAULT" : "STARVE";
  if (patient) return ratio >= 1.6 ? "ASSAULT" : "STARVE";
  return ratio >= 1.2 ? "ASSAULT" : "STARVE";
}

/** Socorro: um reino manda um exército até a própria cidade cercada (Marco 16). */
export function reliefArmy(s: RealmState, world: WorldDef, day: number, townId: string): RealmLog[] {
  const t = s.settlements.find((x) => x.id === townId);
  const f = t ? s.factions.find((x) => x.id === t.owner) : undefined;
  if (!t || !f) return [];
  const log: RealmLog[] = [];
  raiseArmy(s, world, day, f, t, log);
  return log;
}

/** Um dia de cada cerco da IA: a comida acaba, a guarnição cai e chega a hora do assalto. */
export function siegesDay(s: RealmState, world: WorldDef, day: number): RealmLog[] {
  const log: RealmLog[] = [];
  const r = rng();
  for (const a of s.armies) {
    if (a.sieging === undefined || a.outcome) continue;
    const t = s.settlements.find((x) => x.id === a.targetId);
    if (!t) {
      a.outcome = "FAILED";
      continue;
    }
    // O alvo mudou de mãos, ou fizeram as pazes: não há mais o que fazer aqui
    const atPeace = (isFactionOwner(t.owner) && !kingdomsAtWar(s.wars, a.factionId, t.owner)) || (t.owner === "PLAYER" && !s.factions.some((f) => f.id === a.factionId && f.atWar));
    const foe = t.owner !== a.factionId && t.owner !== "RUINED" && !atPeace;
    if (!foe) {
      a.outcome = "RECALLED";
      t.besiegedBy = undefined;
      continue;
    }
    t.econ = { ...t.econ, stock: { ...t.econ.stock, GRAIN: t.econ.stock.GRAIN * (1 - KINGDOM.SIEGE_FOOD_PER_DAY), MEAT: t.econ.stock.MEAT * (1 - KINGDOM.SIEGE_FOOD_PER_DAY) } };
    if (t.garrison > 1 && r.chance(0.35)) t.garrison -= 1;
    // Quem cerca também come: no inverno, a fome e a doença levam mais gente
    if (r.chance(seasonOf(day) === "WINTER" ? 0.35 : 0.15)) a.size = Math.max(2, a.size - 1);
    a.siegeMode ??= siegePlan(s, a, t, day);
    // Guarnição com força sai para queimar as máquinas
    if (t.garrison >= a.size * 0.5 && r.chance(0.25)) {
      a.size = Math.max(2, a.size - 2);
      t.garrison = Math.max(1, t.garrison - 1);
    }
    const days = day - a.sieging;
    // A cidade pede socorro ao reino dela no segundo dia
    if (days === 2 && isFactionOwner(t.owner) && t.owner !== "PLAYER") {
      const help = s.factions.find((x) => x.id === t.owner);
      if (help) raiseArmy(s, world, day, help, t, log);
    }
    if (days < KINGDOM.SIEGE_MIN_DAYS) continue;
    // Assalto custa gente; a fome só cobra dias
    const hungry = t.econ.famine ? 0.6 : 1;
    const defense = settlementDefense(t) * hungry * (t.kind === "CAPITAL" ? 1.3 : 1);
    if (a.siegeMode === "ASSAULT" || t.econ.famine || days >= KINGDOM.SIEGE_MAX_DAYS - 1) {
      if (a.size * (0.8 + r.next() * 0.5) + days * 1.2 > defense) {
        takeTown(s, world, a, t, day, log);
        continue;
      }
      if (a.siegeMode === "ASSAULT") a.size = Math.max(2, a.size - Math.ceil(defense * 0.12));
    }
    if (days >= KINGDOM.SIEGE_MAX_DAYS) {
      a.outcome = "FAILED";
      a.size = Math.round(a.size * 0.7);
      t.besiegedBy = undefined;
      const f = s.factions.find((x) => x.id === a.factionId);
      if (f) f.weariness = Math.min(100, (f.weariness ?? 0) + KINGDOM.WEARINESS_ARMY_LOST);
      log.push({ text: `O cerco a ${t.name} fracassou: o exército ${ofRealm(realmName(world, a.factionId))} levantou acampamento.`, tone: t.owner === "PLAYER" ? "good" : "info", where: here(t) });
    }
  }
  return log;
}

/** O exército tomou a cidade: dono novo, armazéns saqueados, feudo para o lorde. */
function takeTown(s: RealmState, world: WorldDef, a: FieldArmy, t: Settlement, day: number, log: RealmLog[]): void {
  const old = t.owner;
  a.outcome = "TOOK";
  t.besiegedBy = undefined;
  t.owner = a.factionId;
  t.lastRaidDay = day;
  t.conqueredDay = day;
  t.prosperity = Math.max(0, t.prosperity - 30);
  t.econ = plunder(t.econ, 0.3);
  t.garrison = Math.max(4, Math.round(a.size / 2));
  for (const n of s.nobles) n.fiefs = n.fiefs.filter((id) => id !== t.id);
  const lord = s.nobles.find((n) => n.id === a.lordId);
  if (lord && lord.alive) {
    lord.fiefs = [...lord.fiefs, t.id];
    lord.loyalty = Math.min(100, lord.loyalty + 8);
    lord.armyId = undefined;
    lord.at = t.id;
  }
  const loser = s.factions.find((f) => f.id === old);
  if (loser) loser.weariness = Math.min(100, (loser.weariness ?? 0) + KINGDOM.WEARINESS_TOWN_LOST);
  log.push({
    text: `${t.name} caiu! ${TheRealm(realmName(world, a.factionId))} tomou a cidade${isFactionOwner(old) ? ` ${ofRealm(realmName(world, old))}` : ""}.`,
    tone: old === "PLAYER" ? "bad" : "info",
    where: old === "PLAYER" ? undefined : here(t),
  });
}

/** Dois exércitos em guerra se encontraram: o mais forte fica no campo; o lorde vencido pode cair. */
export function armyBattle(s: RealmState, world: WorldDef, winner: FieldArmy | null, loser: FieldArmy | null, day: number, at: Point): RealmLog[] {
  const log: RealmLog[] = [];
  const r = rng();
  if (loser) {
    const f = s.factions.find((x) => x.id === loser.factionId);
    if (f) f.weariness = Math.min(100, (f.weariness ?? 0) + KINGDOM.WEARINESS_ARMY_LOST);
    log.push(...armyLost(s, world, loser, winner?.factionId ?? null, day, at, r));
  }
  return log;
}

/** O exército acabou (batalha, derrota para o bando): o lorde morre, cai preso ou escapa. */
export function armyLost(s: RealmState, world: WorldDef, army: FieldArmy, by: string | null, day: number, at: Point, r: Rng = rng()): RealmLog[] {
  const log: RealmLog[] = [];
  const t = s.settlements.find((x) => x.id === army.targetId);
  if (t && t.besiegedBy === army.factionId) t.besiegedBy = undefined;
  s.armies = s.armies.filter((a) => a.id !== army.id);
  const lord = s.nobles.find((n) => n.id === army.lordId);
  if (!lord || !lord.alive) return log;
  lord.armyId = undefined;
  const roll = r.next();
  if (roll < 0.2) {
    log.push(...nobleDies(s, world, lord, day, "caiu em batalha", at));
  } else if (roll < 0.5 && by) {
    const captor = s.factions.find((f) => f.id === by);
    lord.captiveOf = by;
    if (captor) lord.at = captor.seatId ?? lord.at;
    if (by === "PLAYER") log.push({ text: `${nameOf(lord, world)} foi capturado pelo bando.`, tone: "good" });
    else log.push({ text: `${nameOf(lord, world)} foi capturado e levado à masmorra ${ofRealm(realmName(world, by))}.`, tone: "info", where: at });
  } else {
    lord.at = lord.fiefs[0] ?? s.factions.find((f) => f.id === lord.factionId)?.seatId ?? lord.at;
    log.push({ text: `O exército de ${nameOf(lord, world)} foi destroçado; o lorde escapou.`, tone: "info", where: at });
  }
  return log;
}

// --- Nobres: vida, morte e sucessão ---

/** Um nobre morreu: herança dos feudos, sucessão se governava, luto e uma notícia. */
export function nobleDies(s: RealmState, world: WorldDef, n: Noble, day: number, how: string, where?: Point): RealmLog[] {
  const log: RealmLog[] = [];
  const r = rng();
  n.alive = false;
  n.deathDay = day;
  const seat = s.settlements.find((t) => t.id === n.at);
  const place = where ?? here(seat);
  const spouse = n.spouseId ? s.nobles.find((x) => x.id === n.spouseId) : undefined;
  if (spouse) spouse.spouseId = null;
  log.push({ text: `${nameOf(n, world)} ${how}, aos ${n.age} anos.`, tone: n.opinion >= 30 ? "bad" : "info", where: n.id === s.spouseId ? undefined : place });
  // Plano de quem morreu morre junto
  s.plots = s.plots.filter((p) => p.leaderId !== n.id);
  for (const p of s.plots) p.members = p.members.filter((id) => id !== n.id);
  const army = n.armyId ? s.armies.find((a) => a.id === n.armyId) : undefined;
  if (army) army.lordId = null;
  if (n.id === s.spouseId) {
    log.push({ text: `O Comandante está de luto: ${nameOf(n, world)} morreu.`, tone: "bad" });
    s.spouseId = null;
  }
  if (n.rank === "RULER") log.push(...succession(s, world, day, n, r));
  else if (n.rank === "HEIR") {
    const ruler = rulerOf(s.nobles, n.factionId);
    const next = ruler ? heirsOf(s.nobles, ruler).find((h) => h.id !== n.id) : undefined;
    if (next) next.rank = "HEIR";
  } else if (n.rank === "LORD") {
    const heir = s.nobles.filter((x) => x.alive && x.parentId === n.id && isAdult(x)).sort((a, b) => b.age - a.age)[0];
    if (heir) {
      heir.rank = "LORD";
      heir.tier = n.tier;
      heir.fiefs = n.fiefs;
      heir.at = n.at;
      log.push({ text: `${nameOf(heir, world)} herdou as terras de ${n.house}.`, tone: "info", where: place });
    } else {
      // Sem herdeiro: a coroa fica com as terras e dá a outro lorde
      const other = lordsOf(s.nobles, n.factionId).filter((x) => x.id !== n.id)[0];
      if (other) other.fiefs = [...other.fiefs, ...n.fiefs];
    }
    n.fiefs = [];
  } else if (n.rank === "COURTIER") {
    replaceOfficer(s.nobles, n, day);
  }
  return log;
}

/** Sucessão: herdeiro adulto sobe; criança abre regência; sem ninguém, os lordes disputam. */
function succession(s: RealmState, world: WorldDef, day: number, old: Noble, r: Rng): RealmLog[] {
  const log: RealmLog[] = [];
  const f = s.factions.find((x) => x.id === old.factionId);
  if (!f) return log;
  const seat = seatOf(s, f);
  const heirs = heirsOf(s.nobles, old);
  const adult = heirs.find(isAdult);
  const child = heirs[0];
  const rivals = lordsOf(s.nobles, f.id).filter((n) => n.ambition >= 45 && n.loyalty < 80 && isAdult(n)).sort((a, b) => b.ambition - a.ambition);
  const pretender = rivals[0];
  const consort = old.spouseId ? s.nobles.find((n) => n.alive && n.id === old.spouseId) : undefined;
  if (seat) s.courtEvents.push({ id: `F${day}-${old.id}`, kind: "FUNERAL", townId: seat.id, day: day + 2, who: [old.id] });

  const title = (n: Noble) => rulerTitle(realmName(world, f.id), n.female);
  const announce = (n: Noble, regent?: Noble) => {
    const crowned = crown(s.nobles, n, r);
    f.ruler = crowned.name;
    if (seat) s.courtEvents.push({ id: `C${day}-${n.id}`, kind: "CORONATION", townId: seat.id, day: day + 4, who: [n.id] });
    for (const l of lordsOf(s.nobles, f.id)) l.loyalty = Math.max(20, Math.min(100, l.loyalty + r.int(-10, 5)));
    log.push({
      text: `${crowned.name} é agora ${title(crowned)} ${ofRealm(realmName(world, f.id))}${regent ? `, sob a regência de ${nameOf(regent, world)}` : ""}.`,
      tone: "info",
      where: here(seat),
    });
    return crowned;
  };

  if (adult) {
    announce(adult);
    if (pretender && r.chance(0.4)) startCivilWar(s, world, day, f, pretender, r, log);
    return log;
  }
  if (child) {
    const regent = consort ?? officer(s.nobles, f.id, "CHANCELLOR");
    announce(child, regent);
    if (pretender && r.chance(0.75)) startCivilWar(s, world, day, f, pretender, r, log);
    return log;
  }
  // Ninguém da linhagem: o lorde mais forte toma a coroa; se houver outro à altura, guerra civil
  const claimants = lordsOf(s.nobles, f.id).filter(isAdult).sort((a, b) => b.ambition + b.martial * 3 - (a.ambition + a.martial * 3));
  if (claimants.length === 0) {
    const marshal = officer(s.nobles, f.id, "MARSHAL") ?? officer(s.nobles, f.id, "CHANCELLOR");
    if (marshal) announce(marshal);
    return log;
  }
  log.push({ text: `${old.name} morreu sem herdeiros: os lordes ${ofRealm(realmName(world, f.id))} disputam a coroa.`, tone: "info", where: here(seat) });
  announce(claimants[0]);
  if (claimants[1]) startCivilWar(s, world, day, f, claimants[1], r, log);
  return log;
}

/** Cor do lado do pretendente: a do reino, escurecida. */
const darker = (c: number) => (((c >> 16) & 255) * 0.6) << 16 | (((c >> 8) & 255) * 0.6) << 8 | ((c & 255) * 0.6);

/**
 * Guerra civil: o pretendente leva os feudos dele e dos lordes que o apoiam para um lado novo.
 * Os dois lados contratam o bando (contratos emergentes).
 */
export function startCivilWar(s: RealmState, world: WorldDef, day: number, crownSide: FactionState, pretender: Noble, r: Rng, log: RealmLog[]): void {
  const fiefs = s.settlements.filter((t) => pretender.fiefs.includes(t.id) && t.owner === crownSide.id);
  if (fiefs.length === 0) return;
  const nextId = `F${Math.max(...world.factions.map((f) => Number(f.id.slice(1)))) + 1}`;
  const crownDef = world.factions.find((f) => f.id === crownSide.id) as FactionDef;
  const name = `Liga de ${fiefs[0].name.split(" ")[0]}`;
  const def: FactionDef = { id: nextId, name, ruler: pretender.name, color: darker(crownDef.color), capitalId: fiefs[0].id, temperament: "BELLIGERENT" };
  world.factions.push(def);
  s.extraFactions = [...s.extraFactions, def];
  s.factions.push({ id: nextId, ruler: pretender.name, relation: 0, atWar: false, lastArmyDay: 0, seatId: fiefs[0].id, treasury: 400, levy: 0, weariness: 0 });
  // Lordes descontentes vão com ele
  const side = [pretender, ...lordsOf(s.nobles, crownSide.id).filter((n) => n.id !== pretender.id && n.loyalty < 55 && r.chance(0.6))];
  for (const n of side) {
    n.factionId = nextId;
    for (const t of s.settlements) if (n.fiefs.includes(t.id) && t.owner === crownSide.id) t.owner = nextId;
    for (const k of s.nobles) if (k.alive && k.house === n.house && k.rank === "KIN") k.factionId = nextId;
  }
  pretender.rank = "RULER";
  pretender.loyalty = 100;
  s.wars.push({ a: crownSide.id, b: nextId, since: day, civil: true });
  log.push({
    text: `GUERRA CIVIL ${inRealm(realmName(world, crownSide.id))}! ${nameOf(pretender, world)} recusa a coroa de ${crownSide.ruler} e levanta ${side.length > 1 ? `${side.length} casas` : "a sua casa"}: nasce a ${name}. Os dois lados vão contratar mercenários.`,
    tone: "info",
    where: here(fiefs[0]),
  });
}

/** A guerra civil acaba quando um lado cai ou cansa; o pretendente perdedor vai para o exílio. */
function endCivilWar(s: RealmState, world: WorldDef, day: number, w: KingdomWar, r: Rng, log: RealmLog[]): void {
  const a = s.factions.find((f) => f.id === w.a) as FactionState;
  const b = s.factions.find((f) => f.id === w.b) as FactionState;
  const ta = townsOf(s, a.id).length;
  const tb = townsOf(s, b.id).length;
  const tired = Math.max(a.weariness ?? 0, b.weariness ?? 0) >= KINGDOM.WEARINESS_PEACE + 15;
  if (ta > 0 && tb > 0 && !(tired && r.chance(0.3))) return;
  w.peace = day;
  if (tb === 0 || (ta >= tb && ta > 0)) {
    // A coroa venceu: as terras voltam
    for (const t of townsOf(s, b.id)) t.owner = a.id;
    for (const n of s.nobles) {
      if (!n.alive || n.factionId !== b.id) continue;
      n.factionId = a.id;
      if (n.rank === "RULER") {
        n.rank = "LORD";
        n.tier = n.tier ?? "COUNT";
        n.loyalty = 15;
      } else n.loyalty = Math.min(n.loyalty, 40);
    }
    b.fallen = true;
    log.push({ text: `Fim da guerra civil: ${theRealm(realmName(world, a.id))} esmagou ${theRealm(realmName(world, b.id))}. Os rebeldes dobraram o joelho.`, tone: "info", where: here(seatOf(s, a)) });
  } else if (ta === 0) {
    // O pretendente venceu e fica com o nome do reino
    for (const t of townsOf(s, a.id)) t.owner = b.id;
    a.fallen = true;
    for (const n of s.nobles) if (n.alive && n.factionId === a.id && !n.captiveOf) n.at = "EXILE";
    log.push({ text: `Fim da guerra civil: ${theRealm(realmName(world, b.id))} venceu. ${TheRealm(realmName(world, a.id))} acabou.`, tone: "info", where: here(seatOf(s, b)) });
  } else {
    log.push({ text: `Fim da guerra civil: ${theRealm(realmName(world, b.id))} foi reconhecida. Agora são dois reinos.`, tone: "info", where: here(seatOf(s, b)) });
  }
}

/** Vida da nobreza: uma vez por semana envelhecem, morrem, viajam e conspiram. */
export function noblesWeek(s: RealmState, world: WorldDef, day: number): RealmLog[] {
  const log: RealmLog[] = [];
  const r = rng();
  const newYear = Math.floor(day / KINGDOM.YEAR_DAYS) !== Math.floor((day - 7) / KINGDOM.YEAR_DAYS);
  for (const n of [...s.nobles]) {
    if (!n.alive) continue;
    if (newYear) n.age++;
    if (r.chance(deathChance(n.age))) {
      log.push(...nobleDies(s, world, n, day, r.pick(["morreu dormindo", "morreu depois de uma longa doença", "não resistiu à febre", "caiu do cavalo e não se levantou"])));
      continue;
    }
    // Lealdade: levas pesadas e reis cruéis cansam os lordes; paz e mercê os acalmam
    if (n.rank === "LORD") {
      const f = s.factions.find((x) => x.id === n.factionId);
      const ruler = rulerOf(s.nobles, n.factionId);
      const drift = ((f?.levy ?? 0) > 0.15 ? -1.5 : 0.4) + (ruler?.traits.includes("CRUEL") ? -1 : 0) + (ruler?.traits.includes("GENEROUS") ? 0.8 : 0) + ((f?.weariness ?? 0) > 50 ? -1 : 0);
      n.loyalty = Math.max(0, Math.min(100, n.loyalty + drift));
    }
    // Viagens: em tempos calmos, os lordes vão à corte; com festa marcada, quase todos
    if (n.rank === "LORD" && !n.armyId && !n.captiveOf) {
      const f = s.factions.find((x) => x.id === n.factionId);
      const seat = f?.seatId;
      const party = s.courtEvents.some((e) => e.townId === seat && e.day >= day && e.day <= day + 7);
      n.at = seat && r.chance(party ? 0.8 : 0.35) ? seat : (n.fiefs[0] ?? seat ?? n.at);
    }
  }
  log.push(...plotsWeek(s, world, day, r));
  return log;
}

/** Conspirações: um lorde ambicioso junta descontentes em segredo; o mestre dos segredos caça. */
function plotsWeek(s: RealmState, world: WorldDef, day: number, r: Rng): RealmLog[] {
  const log: RealmLog[] = [];
  for (const f of s.factions) {
    if (f.fallen || s.plots.some((p) => p.factionId === f.id) || !r.chance(KINGDOM.PLOT_CHANCE)) continue;
    const leader = lordsOf(s.nobles, f.id).filter((n) => n.ambition >= 45 && n.loyalty < 75 && !n.armyId && isAdult(n)).sort((a, b) => b.ambition - a.ambition)[0];
    if (leader) s.plots.push({ id: `P${day}-${f.id}`, factionId: f.id, leaderId: leader.id, members: [], strength: 10, since: day, known: false, joined: false });
  }
  for (const p of [...s.plots]) {
    const leader = s.nobles.find((n) => n.id === p.leaderId);
    const ruler = rulerOf(s.nobles, p.factionId);
    if (!leader?.alive || !ruler) {
      s.plots = s.plots.filter((x) => x !== p);
      continue;
    }
    for (const n of lordsOf(s.nobles, p.factionId)) if (n.id !== leader.id && !p.members.includes(n.id) && n.loyalty < 65 && r.chance(0.3)) p.members.push(n.id);
    p.strength += 8 + p.members.length * 6 + leader.ambition / 12 + (p.joined ? 15 : 0);
    // O mestre dos segredos pode descobrir tudo
    const spy = officer(s.nobles, p.factionId, "SPYMASTER");
    if (r.chance(spy ? 0.06 : 0.02)) {
      s.plots = s.plots.filter((x) => x !== p);
      leader.captiveOf = p.factionId;
      leader.loyalty = 0;
      leader.at = s.factions.find((f) => f.id === p.factionId)?.seatId ?? leader.at;
      log.push({ text: `Conspiração descoberta ${inRealm(realmName(world, p.factionId))}: ${nameOf(leader, world)} foi preso por traição.`, tone: "info", where: here(s.settlements.find((t) => t.id === ruler.at)) });
      if (p.joined) log.push({ text: `O nome do Comandante apareceu entre os conspiradores: a coroa ${ofRealm(realmName(world, p.factionId))} quer a sua cabeça.`, tone: "bad" });
      if (p.joined) s.wanted = { ...s.wanted, [p.factionId]: 100 };
      continue;
    }
    if (p.strength < KINGDOM.PLOT_STRENGTH) continue;
    // Golpe: mata quem governa ou levanta o reino
    s.plots = s.plots.filter((x) => x !== p);
    const f = s.factions.find((x) => x.id === p.factionId) as FactionState;
    if (r.chance(0.55)) {
      log.push(...nobleDies(s, world, ruler, day, r.pick(["foi assassinado na própria cama", "morreu envenenado num banquete", "foi apunhalado na escadaria do castelo"])));
      if (!f.fallen && !s.wars.some((w) => w.peace === undefined && w.civil && (w.a === f.id || w.b === f.id))) {
        const heirNow = rulerOf(s.nobles, f.id);
        if (heirNow && heirNow.id !== leader.id) startCivilWar(s, world, day, f, leader, r, log);
      }
    } else {
      startCivilWar(s, world, day, f, leader, r, log);
    }
    if (p.joined) log.push({ text: `O golpe que o Comandante apoiou estourou ${inRealm(realmName(world, p.factionId))}.`, tone: "good" });
  }
  return log;
}

/** Calendário da corte: banquetes e torneios de cada capital, anunciados com antecedência. */
export function courtCalendar(s: RealmState, _world: WorldDef, day: number): RealmLog[] {
  const log: RealmLog[] = [];
  s.courtEvents = s.courtEvents.filter((e) => e.day >= day - 1);
  s.factions.forEach((f, i) => {
    if (f.fallen || !f.seatId) return;
    const seat = s.settlements.find((t) => t.id === f.seatId);
    if (!seat || seat.owner !== f.id) return;
    const when = day + COURT.EVENT_NOTICE;
    const add = (kind: "FEAST" | "TOURNAMENT", text: string, purse?: number) => {
      s.courtEvents.push({ id: `${kind[0]}${when}-${f.id}`, kind, townId: seat.id, day: when, who: [], purse });
      log.push({ text, tone: "info", where: here(seat) });
    };
    if ((when + i * 5) % COURT.TOURNAMENT_EVERY === 0 && seasonOf(when) !== "WINTER") {
      const purse = COURT.TOURNAMENT_PURSE + Math.min(300, Math.round((f.treasury ?? 0) * 0.05));
      add("TOURNAMENT", `Torneio em ${seat.name} no dia ${when}: bolsa de ${purse} de ouro para quem vencer.`, purse);
    } else if ((when + i * 3) % COURT.FEAST_EVERY === 0) {
      add("FEAST", `Banquete da corte em ${seat.name} no dia ${when}.`);
    }
  });
  return log;
}

/** Lealdade de um povoado ao dono: impostos, fome, saques, guarnição, conquista e o nome do senhor. */
export function loyaltyTarget(t: Settlement, day: number, ctx: { honor: number; fear: number; levy: number; weariness: number }): number {
  let v = 72;
  v -= ctx.weariness * 0.3;
  if (t.besiegedBy) v -= 10;
  if (t.owner === "PLAYER") v += (ctx.honor - 50) * 0.3 - ctx.fear * 0.25 + (t.taxRate === 2 ? -18 : t.taxRate === 0 ? 8 : 0);
  if (t.econ.famine) v -= 30;
  if (t.econ.sol < 40) v -= 15;
  if (t.lastRaidDay !== null && day - t.lastRaidDay < 15) v -= 12;
  if (t.conqueredDay !== undefined) v -= Math.max(0, 40 - (day - t.conqueredDay));
  if (t.garrison >= REALM.BASE_GARRISON[t.kind]) v += 6;
  v -= ctx.levy * 40;
  return Math.max(0, Math.min(100, v));
}

/** Um dia da lealdade dos povoados: abaixo do limite, a gente pega em armas (a cena põe o bando no mapa). */
export function loyaltyDay(s: RealmState, world: WorldDef, day: number): RealmLog[] {
  const log: RealmLog[] = [];
  const r = rng();
  for (const t of s.settlements) {
    if (t.owner === "RUINED" || isCalamityOwner(t.owner)) continue;
    const f = s.factions.find((x) => x.id === t.owner);
    const target = loyaltyTarget(t, day, { honor: s.honor, fear: s.fear, levy: f?.levy ?? 0, weariness: f?.weariness ?? 0 });
    t.loyalty = Math.round(((t.loyalty ?? KINGDOM.LOYALTY_START) + (target - (t.loyalty ?? KINGDOM.LOYALTY_START)) * KINGDOM.LOYALTY_DRIFT) * 10) / 10;
    if (t.loyalty > KINGDOM.LOYALTY_REVOLT || s.revolts.includes(t.id) || !r.chance(0.08)) continue;
    s.revolts.push(t.id);
    const realm = t.owner === "PLAYER" ? `os ${world.bandName}` : t.owner === "FREE" ? "o conselho" : `${theRealm(realmName(world, t.owner))}`;
    log.push({ text: `Revolta camponesa em ${t.name}! A gente pegou em foices contra ${realm}.`, tone: t.owner === "PLAYER" ? "bad" : "info", where: t.owner === "PLAYER" ? undefined : here(t) });
  }
  return log;
}

/** Texto curto do estado de um reino para o painel e para quem sabe das coisas na corte. */
export function planText(f: FactionState, world: WorldDef): string {
  if (!f.plan) return "sem planos conhecidos";
  const target = f.plan.targetId;
  const on = target && world.factions.some((x) => x.id === target) ? ` contra ${theRealm(realmName(world, target))}` : "";
  return `${PLAN_LABEL[f.plan.kind]}${on}: ${f.plan.reason}`;
}
