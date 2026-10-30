import { BUILDINGS, CALAMITY_RATES, ECONOMY, GEO, HEALTH, KINGDOM, MARKET, REALM, SEASONS, TRADE, type BuildingId, type Good } from "../../utils/constants";
import { seasonOf, weatherAt } from "../../utils/season";
import { regionName, type FactionDef, type MarketDef, type SettlementKind, type SettlementSeed, type WorldDef, type ResourceId } from "../data/world";
import { chiefName, necromancerName } from "../worldgen/names";
import { createRng, randomSeed, seedFromText } from "../worldgen/rng";
import { geoOf } from "../worldgen/geoMap";
import { distance, type Point } from "../../utils/math";
import { diffuse, initEconomy, marketDay, needsOf, quote, rationPackPrice, type Economy } from "./market";
import { courtCalendar, kingdomsWeek, loyaltyDay, noblesWeek, siegesDay, type Alliance, type CourtEvent, type FieldArmy, type KingdomPlan } from "./kingdoms";
import type { Noble, Plot } from "./nobility";

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
  /** Na costa (porto) e à beira de um rio. */
  port?: boolean;
  river?: boolean;
  lastRaidDay: number | null;
  /** Recursos da terra em volta (renda extra para o dono). */
  resources?: ResourceId[];
  /** Febre até este dia (Marco 13). */
  sickUntil?: number;
  /** Mercado, estoque, preços e nível de vida (Marco 14). */
  econ: Economy;
  /** Taxa de mercado (povoados do bando): 0 baixa, 1 normal, 2 alta. */
  marketTax?: 0 | 1 | 2;
  /** Lealdade ao dono (Marco 15): baixa recusa impostos; muito baixa, revolta. */
  loyalty?: number;
  /** Gente convocada para a guerra (fração da população). */
  levy?: number;
  /** Conquistado neste dia (a gente demora a aceitar o dono novo). */
  conqueredDay?: number;
  /** Cerco em andamento: o reino que acampou diante dos muros. */
  besiegedBy?: string;
}

/** Guerra entre dois reinos (Marco 14): embargo, armas caras e escaramuças na fronteira. */
export interface KingdomWar {
  a: string;
  b: string;
  since: number;
  /** Dia da paz (depois da trégua, o registro some). */
  peace?: number;
  /** Guerra civil: `b` é o lado do pretendente. */
  civil?: boolean;
}

const pairCache = new Map<string, [number, number][]>();

/** Pares de povoados vizinhos (perto o bastante para o comércio miúdo), calculados uma vez. */
function neighborPairs(towns: readonly Settlement[]): [number, number][] {
  const key = towns.map((t) => t.id).join("|");
  let pairs = pairCache.get(key);
  if (!pairs) {
    pairs = [];
    for (let i = 0; i < towns.length; i++) {
      for (let j = i + 1; j < towns.length; j++) if (distance(towns[i], towns[j]) < MARKET.DIFFUSION_RADIUS) pairs.push([i, j]);
    }
    if (pairCache.size > 20) pairCache.clear();
    pairCache.set(key, pairs);
  }
  return pairs;
}

/** Os dois reinos estão em guerra agora? */
export function kingdomsAtWar(wars: readonly KingdomWar[], a: string, b: string): boolean {
  return wars.some((w) => w.peace === undefined && ((w.a === a && w.b === b) || (w.a === b && w.b === a)));
}

export interface FactionState {
  id: string;
  ruler: string;
  /** -100 a 100: o que o reino pensa do bando. */
  relation: number;
  atWar: boolean;
  lastArmyDay: number;
  /** Marco 15: onde a corte está, o plano da semana, tesouro, convocação, cansaço de guerra. */
  seatId?: string;
  plan?: KingdomPlan;
  treasury?: number;
  levy?: number;
  weariness?: number;
  /** Sem nenhum povoado: o reino acabou. */
  fallen?: boolean;
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
  /** O covil foi visto (aparece no Mapa do Continente). */
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
  wars: KingdomWar[];
  // --- Reinos vivos (Marco 15) ---
  nobles: Noble[];
  plots: Plot[];
  alliances: Alliance[];
  armies: FieldArmy[];
  courtEvents: CourtEvent[];
  /** Povoados em que a gente pegou em armas (a cena põe o bando rebelde no mapa). */
  revolts: string[];
  /** Reinos nascidos de uma guerra civil (voltam ao mundo na carga). */
  extraFactions: FactionDef[];
  honor: number;
  fear: number;
  liege: string | null;
  spouseId: string | null;
  wanted: Record<string, number>;
}

/**
 * Linha do diário do dia. Com `where` (Marco 15), é uma notícia do mundo: nasce ali e só chega ao
 * diário quando alcançar alguém do bando (rumors.ts).
 */
export type RealmLog = { text: string; tone: "info" | "good" | "bad"; where?: Point };

/**
 * Construções que os povoados já têm no começo (Marco 14), conforme a terra, o rio e o mar:
 * as cadeias de produção do continente existem antes do bando chegar.
 */
function startingBuildings(seed: SettlementSeed): BuildingId[] {
  if (seed.owner === "RUINED") return [];
  const r = createRng(seedFromText(`obras-${seed.id}`));
  const res = seed.resources ?? [];
  const out: BuildingId[] = [];
  const big = seed.kind !== "VILLAGE";
  if (seed.port && (big || r.chance(0.4))) out.push("PORT");
  if (seed.river && r.chance(big ? 0.7 : 0.35)) out.push("MILL");
  if (res.includes("WOOD") && r.chance(0.5)) out.push("SAWMILL");
  if (res.includes("SALT") && r.chance(0.6)) out.push("SALTWORKS");
  if (res.includes("IRON") && r.chance(0.6)) out.push("MINE");
  if (res.includes("HORSES") && r.chance(0.6)) out.push("PASTURE");
  if ((seed.kind === "CITY" || seed.kind === "CAPITAL") && r.chance(0.6)) out.push("WEAVERY");
  if (seed.kind === "CAPITAL") out.push("MARKET", "WALLS");
  if (res.includes("GRAIN") && r.chance(0.4)) out.push("FARM");
  return out;
}

export function settlementFromSeed(seed: SettlementSeed): Settlement {
  const base = { ...seed, prosperity: 100, buildings: startingBuildings(seed), taxRate: 1 as const, lastRaidDay: null };
  return { ...base, econ: initEconomy(base) };
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

/**
 * Preços locais (Marco 14: saem do mercado de verdade): o pacote de rações custa a comida
 * mais barata da praça, e o ferro, o preço do ferro ali. A febre encarece a comida.
 */
export function townPrices(s: Settlement, day = 0): { rationPack: number; ironBuy: number; ironSell: number } {
  const sick = isSick(s, day) ? 1.2 : 1;
  return {
    rationPack: Math.max(2, Math.round(rationPackPrice(s.econ) * sick)),
    ironBuy: Math.max(1, quote(s.econ, "IRON", 1, "BUY").total),
    ironSell: Math.max(1, quote(s.econ, "IRON", 1, "SELL").total),
  };
}

/** Febre no povoado (Marco 13): passa ao bando que se demora ali e aos vizinhos pela estrada. */
export function isSick(s: Settlement, day: number): boolean {
  return s.sickUntil !== undefined && s.sickUntil > day;
}

/** Povoado do bando em revolta (Marco 14): não paga nada até acalmar. */
export function inRevolt(s: Settlement, day: number): boolean {
  return s.econ.revoltUntil > day;
}

/**
 * Renda semanal de um povoado do jogador (Marco 14): impostos em ouro (a prosperidade e o
 * nível de vida pesam; no outono, os impostos rurais) e o tributo em espécie tirado do que
 * sobra no mercado: comida (vira rações) e ferro. Com fome na cidade, não sobra comida.
 */
export function weeklyYield(s: Settlement, day = 0): { gold: number; rations: number; iron: number; food: Partial<Record<Good, number>> } {
  if (inRevolt(s, day)) return { gold: 0, rations: 0, iron: 0, food: {} };
  const harvest = day > 0 && seasonOf(day) === "AUTUMN";
  const tax = REALM.TAX[s.taxRate].income * (s.buildings.includes("MARKET") ? 1.4 : 1);
  // A pedra da terra em volta é vendida aos construtores (os outros recursos já são bens do mercado)
  const stone = (s.resources ?? []).includes("STONE") ? 6 : 0;
  const content = 0.5 + s.econ.sol / 200;
  const gold = Math.round((s.population / 10) * REALM.GOLD_PER_10_POP * tax * (s.prosperity / 100) * content) + stone;
  // Tributo em espécie: uma parte do que passa de uma semana de procura
  const needs = needsOf(s, { season: seasonOf(Math.max(1, day)), atWar: false, hoard: false });
  const foodWeek = (needs.FOOD ?? 0) * 7;
  const st = s.econ.stock;
  const spare = Math.max(0, st.GRAIN + st.MEAT - foodWeek);
  const levy = Math.floor(spare * 0.25 * (s.taxRate === 2 ? 1.4 : s.taxRate === 0 ? 0.6 : 1));
  const grain = Math.min(levy, Math.floor(st.GRAIN));
  const meat = Math.min(levy - grain, Math.floor(st.MEAT));
  const ironSpare = Math.max(0, st.IRON - (needs.IRON ?? 0) * 7);
  const iron = Math.floor(ironSpare * 0.3);
  return {
    gold: harvest ? Math.round(gold * SEASONS.HARVEST_GOLD) : gold,
    rations: (grain + meat) * TRADE.RATIONS_PER_FOOD,
    iron,
    food: { GRAIN: grain, MEAT: meat, IRON: iron },
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
    wars: input.wars.map((w) => ({ ...w })),
    nobles: input.nobles.map((n) => ({ ...n })),
    plots: input.plots.map((p) => ({ ...p })),
    armies: input.armies.map((a) => ({ ...a })),
    courtEvents: input.courtEvents,
    revolts: [...input.revolts],
  };

  const season = seasonOf(day);
  const geo = geoOf(world.geo);
  const threats = s.calamities.filter((c) => !c.defeated);

  // Mercados (Marco 14): produção, consumo, preços e nível de vida; a prosperidade segue o
  // nível de vida (e os impostos do jogador); a fome mata gente e derruba a cidade
  for (const t of s.settlements) {
    if (t.owner === "RUINED") continue;
    const atWar =
      (isFactionOwner(t.owner) && (s.factions.some((f) => f.id === t.owner && f.atWar) || s.wars.some((w) => w.peace === undefined && (w.a === t.owner || w.b === t.owner)))) ||
      (t.owner === "PLAYER" && s.factions.some((f) => f.atWar));
    // A convocação tira gente das lavouras (Marco 15)
    if (isFactionOwner(t.owner)) t.levy = s.factions.find((f) => f.id === t.owner)?.levy ?? 0;
    const hoard = threats.some((c) => distance(c.lair, t) < MARKET.HOARD_RADIUS);
    const storm = !!t.port && weatherAt(world.seed, day, t, geo) === "STORM";
    const wasFamine = t.econ.famine;
    t.econ = marketDay(t, t.econ, { season, atWar, hoard, storm, day });
    const tax = t.owner === "PLAYER" ? REALM.TAX[t.taxRate].prosperity : 0;
    // Febre: o comércio para e a prosperidade não volta
    const sick = isSick(t, day) ? -5 : 0;
    const famine = t.econ.famine ? -3 : 0;
    t.prosperity = Math.max(0, Math.min(100, t.prosperity + MARKET.PROSPERITY_BASE + (t.econ.sol - 60) / 25 + tax + sick + famine));
    if (t.econ.famine) t.population = Math.max(20, Math.round(t.population * 0.995));
    if (t.econ.famine && !wasFamine && (t.owner === "PLAYER" || t.kind !== "VILLAGE")) {
      log.push({ text: `Fome em ${t.name}: os celeiros estão vazios e o pão custa uma fortuna.`, tone: t.owner === "PLAYER" ? "bad" : "info", where: t.owner === "PLAYER" ? undefined : t });
    }
    // Povoados do bando: o nível de vida baixo agita a gente; em 100, revolta (sem impostos por duas semanas)
    // (o comércio miúdo entre vizinhos vem depois de todos os mercados do dia)
    if (t.owner === "PLAYER") {
      const delta = t.econ.sol < MARKET.UNREST_BELOW_SOL ? (MARKET.UNREST_BELOW_SOL - t.econ.sol) / 4 + (t.taxRate === 2 ? 2 : 0) : -3;
      t.econ = { ...t.econ, unrest: Math.max(0, Math.min(100, t.econ.unrest + delta)) };
      if (t.econ.unrest >= 100 && !inRevolt(t, day)) {
        t.econ = { ...t.econ, unrest: 40, revoltUntil: day + MARKET.REVOLT_DAYS };
        t.prosperity = Math.max(0, t.prosperity - 20);
        log.push({ text: `Revolta em ${t.name}! A gente não aguenta mais a carestia: nada de impostos por duas semanas.`, tone: "bad" });
      }
    }
  }
  // Comércio miúdo entre vizinhos (mascates, feiras): aplaina os preços de cada região
  const open = s.settlements.filter((t) => t.owner !== "RUINED" && !isCalamityOwner(t.owner));
  const at = (i: number) => open[i].owner;
  diffuse(
    open.map((t) => t.econ),
    neighborPairs(open),
    (a, b) => isFactionOwner(at(a)) && isFactionOwner(at(b)) && kingdomsAtWar(s.wars, at(a), at(b)),
  );

  // Reinos vivos (Marco 15): cercos, lealdade dos povoados e o calendário da corte
  log.push(...siegesDay(s, world, day), ...loyaltyDay(s, world, day), ...courtCalendar(s, world, day));

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
      // Os reinos e as aldeias livres repõem a guarnição dos acampamentos aos poucos
      if (t.owner !== "PLAYER") {
        if (t.owner !== "RUINED" && !isCalamityOwner(t.owner) && t.garrison < REALM.BASE_GARRISON[t.kind]) t.garrison += 1;
        // Nível de vida bom atrai gente; carestia espanta
        if (t.owner !== "RUINED" && !t.econ.famine) {
          const max = REALM.MAX_POPULATION[t.kind];
          t.population = Math.max(20, Math.min(max, Math.round(t.population * (1 + 0.02 * ((t.econ.sol - 60) / 40)))));
        }
        continue;
      }
      // Com lealdade baixa, o povoado recusa os impostos
      if ((t.loyalty ?? KINGDOM.LOYALTY_START) < KINGDOM.LOYALTY_NO_TAX) {
        log.push({ text: `${t.name} se recusa a pagar impostos: a lealdade ao bando está no chão.`, tone: "bad" });
        continue;
      }
      const y = weeklyYield(t, day);
      gold += y.gold;
      rations += y.rations;
      iron += y.iron;
      // O tributo em espécie sai do mercado do povoado
      const stock = { ...t.econ.stock };
      for (const [g, v] of Object.entries(y.food) as [Good, number][]) stock[g] = Math.max(0, stock[g] - v);
      t.econ = { ...t.econ, stock };
      const max = REALM.MAX_POPULATION[t.kind];
      // Cresce com a prosperidade e com o nível de vida (com fome, não cresce)
      const growth = t.econ.famine ? 0 : REALM.POP_GROWTH * (t.prosperity / 100) * (t.econ.sol / 100);
      t.population = Math.min(max, Math.round(t.population * (1 + growth)));
      t.garrison = Math.min(garrisonCap(t), t.garrison + (t.buildings.includes("BARRACKS") ? 3 : 1));
    }
    if (gold + rations + iron > 0) {
      s.gold += gold;
      s.rations += rations;
      s.iron += iron;
      log.push({
        text: `Renda do reino${season === "AUTUMN" ? " (colheita e impostos rurais)" : ""}: ${gold} de ouro, ${rations} rações e ${iron} de ferro.`,
        tone: "good",
      });
    }
    // Outono: feiras da colheita animam os mercados de todo o continente
    if (season === "AUTUMN") {
      for (const t of s.settlements) if (t.owner !== "RUINED") t.prosperity = Math.min(100, t.prosperity + SEASONS.FAIR_PROSPERITY);
      log.push({ text: "Feiras da colheita: os mercados se enchem e a comida está barata.", tone: "info" });
    }
    log.push(...spreadFever(s, day));
    log.push(...noblesWeek(s, world, day), ...kingdomsWeek(s, world, day));
    log.push(...worldEvent(s, world, day));
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
  // Deslocado do covil antigo, mas nunca dentro d'água ou na rocha
  const moved = { x: base.x + r.range(-300, 300), y: base.y + r.range(-300, 300) };
  const lair = geoOf(world.geo).isOpenLand(moved, 150) ? moved : { x: base.x, y: base.y };
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

/** A febre passa de um povoado ao vizinho pelas estradas (uma vez por semana). */
function spreadFever(s: RealmState, day: number): RealmLog[] {
  const r = rng();
  const log: RealmLog[] = [];
  const sick = s.settlements.filter((t) => isSick(t, day));
  for (const t of sick) {
    if (!r.chance(HEALTH.TOWN_SPREAD * (seasonOf(day) === "WINTER" ? 1.4 : 1))) continue;
    const next = s.settlements
      .filter((o) => o !== t && o.owner !== "RUINED" && !isSick(o, day) && distance(o, t) < HEALTH.TOWN_SPREAD_RADIUS)
      .sort((a, b) => distance(a, t) - distance(b, t))[0];
    if (!next) continue;
    next.sickUntil = day + HEALTH.TOWN_SICK_DAYS;
    log.push({ text: `A febre de ${t.name} chegou a ${next.name} com os viajantes da estrada.`, tone: next.owner === "PLAYER" ? "bad" : "info", where: next.owner === "PLAYER" ? undefined : next });
  }
  return log;
}

/** Um acontecimento por semana entre os reinos (o mundo não espera pelo jogador). */
function worldEvent(s: RealmState, world: WorldDef, day: number): RealmLog[] {
  const r = rng();
  const name = (fid: string) => world.factions.find((f) => f.id === fid)?.name ?? "?";
  const roll = r.next();

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

  // Guerras, paz e sucessões vêm da simulação dos reinos (kingdoms.ts); aqui ficam feiras e pragas
  const towns = s.settlements.filter((x) => x.owner !== "RUINED");
  if (towns.length === 0) return [];
  if (roll < 0.65) {
    // Feira: mercadores de longe enchem a praça de tecido, cerveja e luxos
    const t = r.pick(towns);
    t.prosperity = Math.min(100, t.prosperity + 20);
    t.econ = restock(t.econ, { CLOTH: 8, ALE: 10, LUXURY: 3, SALT: 4 });
    return [{ text: `Uma feira em ${t.name} atrai mercadores de longe: tecido, cerveja e luxos baratos por uns dias.`, tone: "info", where: t }];
  }
  if (roll < 0.8) {
    const t = r.pick(towns);
    t.prosperity = Math.max(0, t.prosperity - 25);
    t.population = Math.round(t.population * 0.9);
    t.sickUntil = day + HEALTH.TOWN_SICK_DAYS;
    return [{ text: `Febre em ${t.name}: muitos morreram e o comércio parou. Quem passar por lá pode adoecer.`, tone: "bad", where: t.owner === "PLAYER" ? undefined : t }];
  }
  if (roll < 0.9) {
    // Choques do mercado (Marco 14): praga nos celeiros, mina alagada, gado doente
    const t = r.pick(towns);
    const shock = r.pick<[Good, string]>([
      ["GRAIN", `Gorgulhos nos celeiros de ${t.name}: metade do grão se perdeu. O pão vai encarecer por lá.`],
      ["MEAT", `Peste no gado em volta de ${t.name}: a carne sumiu do mercado.`],
      ["IRON", `Uma galeria desabou nas minas perto de ${t.name}: falta ferro.`],
      ["WOOD", `Um incêndio consumiu o depósito de madeira de ${t.name}.`],
    ]);
    t.econ = { ...t.econ, stock: { ...t.econ.stock, [shock[0]]: Math.round(t.econ.stock[shock[0]] * 0.4) } };
    return [{ text: shock[1], tone: "info", where: t }];
  }
  return [];
}

/** Saque: some parte do que havia no mercado. */
export function plunder(econ: Economy, share: number): Economy {
  const stock = { ...econ.stock };
  for (const g of Object.keys(stock) as Good[]) stock[g] = Math.round(stock[g] * (1 - share) * 10) / 10;
  return { ...econ, stock };
}

/** Mercadoria que chega ao mercado (caravana, feira, entrega do bando). */
export function restock(econ: Economy, add: Partial<Record<Good, number>>): Economy {
  const stock = { ...econ.stock };
  for (const [g, v] of Object.entries(add) as [Good, number][]) stock[g] = Math.max(0, Math.round((stock[g] + v) * 10) / 10);
  return { ...econ, stock };
}

/** Bandos do mundo: os que atacam (goblins, exércitos, hordas) e os que não (patrulha, mensageiro, refugiados). */
export type BandKind = "GOBLIN" | "FACTION" | "HORDE" | "PATROL" | "COURIER" | "REFUGEES" | "CARAVAN" | "REBELS";

/** Bandos que saqueiam povoados quando chegam. */
export const isRaiderKind = (k: BandKind) => k === "GOBLIN" || k === "FACTION" || k === "HORDE" || k === "REBELS";
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
    // Os armazéns são o que os goblins levam
    s.econ = plunder(s.econ, 0.4);
    return { settlement: s, outcome: "RAIDED" };
  }
  // Camponeses que vencem expulsam o senhor: a aldeia fica livre (Marco 15)
  if (band.kind === "REBELS") {
    s.owner = "FREE";
    s.garrison = 3;
    s.loyalty = 70;
    s.conqueredDay = undefined;
    return { settlement: s, outcome: "CAPTURED" };
  }
  if (band.kind === "HORDE" && band.calamityKind === "NECROMANCER") {
    s.owner = "RUINED";
    s.population = Math.round(s.population / 3);
    s.prosperity = 0;
    s.garrison = 0;
    s.econ = plunder(s.econ, 0.9);
    return { settlement: s, outcome: "RUINED" };
  }
  s.owner = band.ownerId ?? "FREE";
  s.prosperity = Math.max(0, s.prosperity - 40);
  s.econ = plunder(s.econ, 0.25);
  s.garrison = Math.max(4, Math.round(band.strength / 2));
  return { settlement: s, outcome: "CAPTURED" };
}

/** Força de um bando para o combate abstrato. */
export function bandStrength(kind: BandKind, members: number): number {
  return Math.round(members * (kind === "HORDE" ? 1.5 : kind === "FACTION" ? 1.2 : 1));
}

/** Calamidades raras esperam mais; frequentes, menos (opção da criação do mundo). */
export function calamityDelay(world: WorldDef): number {
  return CALAMITY_RATES[world.options.calamities].delay;
}

/** Quem controla uma ponte: o povoado mais próximo dela (até BRIDGE_CONTROL_RADIUS), se houver. */
export function bridgeController(settlements: readonly Settlement[], p: Point): Settlement | null {
  let best: Settlement | null = null;
  let bestD: number = GEO.BRIDGE_CONTROL_RADIUS;
  for (const t of settlements) {
    const d = distance(t, p);
    if (d < bestD && t.owner !== "RUINED") {
      best = t;
      bestD = d;
    }
  }
  return best;
}

/** Pontes de pé controladas pelo bando (rendem pedágio toda semana). */
export function playerBridges(world: WorldDef, settlements: readonly Settlement[], burned: readonly string[]): number {
  return world.geo.crossings.filter((c) => c.kind === "BRIDGE" && !burned.includes(c.id) && bridgeController(settlements, c)?.owner === "PLAYER").length;
}
