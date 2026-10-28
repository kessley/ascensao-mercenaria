import { BUILDINGS, ECONOMY, REALM, type BuildingId } from "../../utils/constants";
import { regionName, type MarketDef, type SettlementKind, type SettlementSeed, type WorldDef } from "../data/world";
import { chiefName, necromancerName, personName } from "../worldgen/names";
import { createRng, randomSeed } from "../worldgen/rng";
import { distance, type Point } from "../../utils/math";

/**
 * Simulação do reino e do mundo vivo (Marco 9), em funções puras usadas pelo store:
 * povoados (donos, prosperidade, população, guarnição, construções, impostos),
 * reinos rivais (relação, guerra, governantes), calamidades e eventos semanais.
 */

/** Dono de um povoado: id de facção ("F0"), "PLAYER", "FREE", "RUINED" ou id de calamidade ("C1"). */
export type Owner = string;

export interface Settlement {
  id: string;
  name: string;
  kind: SettlementKind;
  x: number;
  y: number;
  owner: Owner;
  prosperity: number;
  population: number;
  garrison: number;
  buildings: BuildingId[];
  /** 0 baixos, 1 normais, 2 altos (só povoados do jogador). */
  taxRate: 0 | 1 | 2;
  market: MarketDef;
  description: string;
  lastRaidDay: number | null;
}

export interface FactionState {
  id: string;
  ruler: string;
  /** -100 a 100: o que o reino pensa do bando. */
  relation: number;
  atWar: boolean;
  lastArmyDay: number;
}

export type CalamityKind = "NECROMANCER" | "ORC_HORDE";

export interface Calamity {
  id: string;
  kind: CalamityKind;
  /** Nome do evento ("A Noite de Morvan, o Pálido"). */
  name: string;
  leader: string;
  lair: Point;
  region: string;
  startDay: number;
  /** Cresce com o tempo e com cada povoado que cai: hordas maiores. */
  power: number;
  /** O covil foi visto (aparece no Mapa Múndi). */
  revealed: boolean;
  defeated: boolean;
  lastHordeDay: number;
}

export interface RealmState {
  settlements: Settlement[];
  factions: FactionState[];
  calamities: Calamity[];
  nextCalamityDay: number;
  gold: number;
  rations: number;
  iron: number;
}

export type RealmLog = { text: string; tone: "info" | "good" | "bad" };

export function settlementFromSeed(seed: SettlementSeed): Settlement {
  return { ...seed, prosperity: 100, buildings: [], taxRate: 1, lastRaidDay: null };
}

/** Ids de calamidade são "C1", "C2"...; de facção, "F0", "F1"... ("FREE" não é facção). */
export const isCalamityOwner = (owner: Owner) => /^C\d+$/.test(owner);
export const isFactionOwner = (owner: Owner) => /^F\d+$/.test(owner);

export function ownerLabel(world: WorldDef, calamities: readonly Calamity[], owner: Owner): string {
  if (owner === "PLAYER") return `os ${world.bandName}`;
  if (owner === "FREE") return "livre";
  if (owner === "RUINED") return "em ruínas";
  if (isCalamityOwner(owner)) return calamities.find((c) => c.id === owner)?.leader ?? "a calamidade";
  return world.factions.find((f) => f.id === owner)?.name ?? "?";
}

/** Defesa abstrata (quando o exército do jogador não está lá): guarnição, muralhas e tipo. */
export function settlementDefense(s: Settlement): number {
  const walls = s.buildings.includes("WALLS") ? 2 : 1;
  return s.garrison * walls + REALM.BASE_DEFENSE[s.kind];
}

/** Preços locais: prosperidade baixa encarece a compra e paga menos na venda. */
export function townPrices(s: Settlement): { rationPack: number; ironBuy: number; ironSell: number } {
  const scarcity = 1 + ((100 - s.prosperity) / 100) * 0.8;
  return {
    rationPack: Math.max(1, Math.round(ECONOMY.RATION_PACK_PRICE * s.market.rationPrice * scarcity)),
    ironBuy: Math.round(s.market.ironBuy * scarcity),
    ironSell: Math.max(1, Math.round(s.market.ironSell * Math.max(0.4, s.prosperity / 100))),
  };
}

/** Renda semanal de um povoado do jogador. */
export function weeklyYield(s: Settlement): { gold: number; rations: number; iron: number } {
  const tax = REALM.TAX[s.taxRate].income * (s.buildings.includes("MARKET") ? 1.4 : 1);
  return {
    gold: Math.round((s.population / 10) * REALM.GOLD_PER_10_POP * tax * (s.prosperity / 100)),
    rations: Math.round(s.population / 25) * REALM.RATIONS_PER_25_POP + (s.buildings.includes("FARM") ? 12 : 0),
    iron: s.buildings.includes("MINE") ? 5 : 0,
  };
}

export function garrisonCap(s: Settlement): number {
  return s.buildings.includes("BARRACKS") ? REALM.GARRISON_CAP_BARRACKS : REALM.GARRISON_CAP;
}

export function buildingCost(id: BuildingId): { gold: number; iron: number } {
  return { gold: BUILDINGS[id].gold, iron: BUILDINGS[id].iron };
}

/** Título do Comandante conforme quantos povoados governa. */
export function titleFor(count: number): string {
  let label: string = REALM.TITLES[0].label;
  for (const t of REALM.TITLES) if (count >= t.min) label = t.label;
  return label;
}

const rng = () => createRng(randomSeed());

/**
 * Um dia do reino e do mundo: prosperidade, renda semanal (antes do pagamento de salários),
 * relações, eventos semanais entre os reinos e o despertar de calamidades.
 * `day` = o dia que está começando.
 */
export function realmDay(input: RealmState, world: WorldDef, day: number, camp: Point): { state: RealmState; log: RealmLog[] } {
  const log: RealmLog[] = [];
  const s: RealmState = {
    ...input,
    settlements: input.settlements.map((x) => ({ ...x })),
    factions: input.factions.map((f) => ({ ...f })),
    calamities: input.calamities.map((c) => ({ ...c })),
  };

  // Prosperidade: recupera com o tempo; impostos do jogador mexem nela
  for (const t of s.settlements) {
    if (t.owner === "RUINED") continue;
    const tax = t.owner === "PLAYER" ? REALM.TAX[t.taxRate].prosperity : 0;
    t.prosperity = Math.max(0, Math.min(100, t.prosperity + 3 + tax));
  }

  // Relações esfriam (ou esquentam) devagar rumo à neutralidade, fora de guerra
  for (const f of s.factions) {
    if (!f.atWar && f.relation !== 0) f.relation += f.relation > 0 ? -0.25 : 0.5;
  }

  // Semana: renda do reino do jogador (antes do pagamento de salários do mesmo dia)
  if (day % ECONOMY.PAYDAY_INTERVAL === 0) {
    let gold = 0;
    let rations = 0;
    let iron = 0;
    for (const t of s.settlements) {
      if (t.owner !== "PLAYER") continue;
      const y = weeklyYield(t);
      gold += y.gold;
      rations += y.rations;
      iron += y.iron;
      const max = REALM.MAX_POPULATION[t.kind];
      t.population = Math.min(max, Math.round(t.population * (1 + REALM.POP_GROWTH * (t.prosperity / 100))));
      t.garrison = Math.min(garrisonCap(t), t.garrison + (t.buildings.includes("BARRACKS") ? 3 : 1));
    }
    if (gold + rations + iron > 0) {
      s.gold += gold;
      s.rations += rations;
      s.iron += iron;
      log.push({ text: `Renda do reino: ${gold} de ouro, ${rations} rações e ${iron} de ferro.`, tone: "good" });
    }
    log.push(...worldEvent(s, world));
  }

  // Calamidades: crescem; quando chega a hora, uma nova desperta longe do bando
  for (const c of s.calamities) {
    if (!c.defeated && (day - c.startDay) % REALM.CALAMITY_POWER_EVERY_DAYS === 0 && day > c.startDay) c.power++;
  }
  if (!s.calamities.some((c) => !c.defeated) && day >= s.nextCalamityDay) {
    const c = newCalamity(world, s.calamities.length, day, camp);
    s.calamities.push(c);
    log.push({
      text:
        c.kind === "NECROMANCER"
          ? `Rumores sombrios: os mortos se erguem em ${c.region}. Dizem que ${c.leader} voltou.`
          : `Tambores de guerra em ${c.region}: ${c.leader} uniu os clãs orcs numa horda.`,
      tone: "bad",
    });
  }
  return { state: s, log };
}

function newCalamity(world: WorldDef, index: number, day: number, camp: Point): Calamity {
  const r = rng();
  const kind: CalamityKind = r.chance(0.5) ? "NECROMANCER" : "ORC_HORDE";
  // Covil nem colado ao acampamento nem do outro lado do continente: a ameaça precisa chegar
  const byDistance = [...world.lairs].sort((a, b) => distance(a, camp) - distance(b, camp));
  const middle = byDistance.filter((p) => distance(p, camp) >= 6000 && distance(p, camp) <= 14000);
  const base = r.pick(middle.length > 0 ? middle : byDistance.slice(-2));
  const lair = { x: base.x + r.range(-300, 300), y: base.y + r.range(-300, 300) };
  const leader = kind === "NECROMANCER" ? necromancerName(r.next) : chiefName(r.next);
  return {
    id: `C${index + 1}`,
    kind,
    name: kind === "NECROMANCER" ? `A Noite de ${leader}` : `A Horda de ${leader}`,
    leader,
    lair,
    region: regionName(world, lair),
    startDay: day,
    power: 1,
    revealed: false,
    defeated: false,
    lastHordeDay: day,
  };
}

/** Um acontecimento por semana entre os reinos (o mundo não espera pelo jogador). */
function worldEvent(s: RealmState, world: WorldDef): RealmLog[] {
  const r = rng();
  const name = (fid: string) => world.factions.find((f) => f.id === fid)?.name ?? "?";
  const roll = r.next();
  const living = s.factions.filter((f) => s.settlements.some((t) => t.owner === f.id));

  // Reinos beligerantes com rancor declaram guerra ao bando
  for (const f of s.factions) {
    const def = world.factions.find((x) => x.id === f.id);
    if (f.atWar || f.relation > REALM.WAR_BELOW + 20) continue;
    if (def?.temperament === "BELLIGERENT" || f.relation <= REALM.WAR_BELOW) {
      f.atWar = true;
      f.relation = Math.min(f.relation, REALM.WAR_BELOW);
      return [{ text: `O ${name(f.id)} declarou guerra aos ${world.bandName}!`, tone: "bad" }];
    }
  }

  if (roll < 0.35 && living.length >= 2) {
    // Escaramuça entre reinos: um povoado menor muda de mãos
    const [a, b] = r.shuffle(living);
    const capitals = new Set(world.factions.map((f) => f.capitalId));
    const prize = s.settlements.find((t) => t.owner === b.id && !capitals.has(t.id) && t.kind === "VILLAGE");
    if (prize) {
      prize.owner = a.id;
      prize.prosperity = Math.max(0, prize.prosperity - 30);
      return [{ text: `O ${name(a.id)} tomou ${prize.name} do ${name(b.id)}.`, tone: "info" }];
    }
    return [{ text: `Escaramuças na fronteira entre o ${name(a.id)} e o ${name(b.id)}.`, tone: "info" }];
  }
  if (roll < 0.5 && living.length > 0) {
    const f = r.pick(living);
    const old = f.ruler;
    f.ruler = personName(r);
    return [{ text: `${old} morreu; ${f.ruler} é agora quem governa o ${name(f.id)}.`, tone: "info" }];
  }
  if (roll < 0.7) {
    const t = r.pick(s.settlements.filter((x) => x.owner !== "RUINED"));
    if (!t) return [];
    t.prosperity = Math.min(100, t.prosperity + 20);
    return [{ text: `Uma feira em ${t.name} atrai mercadores de longe.`, tone: "info" }];
  }
  if (roll < 0.85) {
    const t = r.pick(s.settlements.filter((x) => x.owner !== "RUINED"));
    if (!t) return [];
    t.prosperity = Math.max(0, t.prosperity - 25);
    t.population = Math.round(t.population * 0.9);
    return [{ text: `Febre em ${t.name}: muitos morreram e o comércio parou.`, tone: "bad" }];
  }
  return [];
}

export type BandKind = "GOBLIN" | "FACTION" | "HORDE";
export type RaidOutcome = "REPELLED" | "RAIDED" | "CAPTURED" | "RUINED" | "IGNORED";

/**
 * Um bando chegou a um povoado sem o exército do jogador por perto: combate abstrato
 * (força do bando × defesa do povoado). Muda o povoado e devolve o resultado.
 */
export function resolveRaid(
  t: Settlement,
  band: { kind: BandKind; strength: number; ownerId: string | null; calamityKind?: CalamityKind },
  day: number,
): { settlement: Settlement; outcome: RaidOutcome } {
  if (t.owner === "RUINED" || (band.ownerId && t.owner === band.ownerId)) return { settlement: t, outcome: "IGNORED" };
  const s = { ...t };
  const defense = settlementDefense(s);
  if (defense >= band.strength) {
    s.garrison = Math.max(0, s.garrison - Math.ceil(band.strength / 4));
    return { settlement: s, outcome: "REPELLED" };
  }
  s.lastRaidDay = day;
  if (band.kind === "GOBLIN") {
    s.prosperity = Math.max(0, s.prosperity - 30);
    s.garrison = Math.floor(s.garrison * 0.75);
    return { settlement: s, outcome: "RAIDED" };
  }
  if (band.kind === "HORDE" && band.calamityKind === "NECROMANCER") {
    s.owner = "RUINED";
    s.population = Math.round(s.population / 3);
    s.prosperity = 0;
    s.garrison = 0;
    return { settlement: s, outcome: "RUINED" };
  }
  s.owner = band.ownerId ?? "FREE";
  s.prosperity = Math.max(0, s.prosperity - 40);
  s.garrison = Math.max(4, Math.round(band.strength / 2));
  return { settlement: s, outcome: "CAPTURED" };
}

/** Força de um bando para o combate abstrato. */
export function bandStrength(kind: BandKind, members: number): number {
  return Math.round(members * (kind === "HORDE" ? 1.5 : kind === "FACTION" ? 1.2 : 1));
}
