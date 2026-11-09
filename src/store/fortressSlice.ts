import { CAMP_BUILDINGS, STONE_WALL, isFortress, readyOf, shortOf, type CampCost, type CampKind } from "../game/data/campGrid";
import { buildScenarioWorld, seatSiegeScenario, type EnemyFactionId } from "../game/data/scenarios";
import { PROGRESSION, REALM, setWorldSize } from "../utils/constants";
import { distance, type Point } from "../utils/math";
import { siteFill } from "../game/sim/siteLife";
import {
  LORD_RADIUS,
  RUINS_RADIUS,
  SACK,
  SEAT_SIEGE,
  WILD_FEAR,
  fieldPitchProblem,
  fortressPlan,
  kitProblem,
  sackGold,
  sackedPlan,
  seatDefense,
  seatSiege,
  siegeEvery,
  siegeHost,
  standardCost,
  standardProblem,
  type Fortress,
  type LandCtx,
  type LandPath,
} from "../game/sim/fortress";
import {
  ARTISAN_IRON,
  STAGE,
  cityDrivers,
  feverWeek,
  growCity,
  inRealm,
  newSeatCity,
  realmFigures,
  retire,
  retireProblem,
  stageOf,
  weeklyGold,
  type CityDrivers,
  type CityTax,
  type Decree,
  type SeatCity,
} from "../game/sim/seatCity";
import type { Settlement } from "../game/sim/realm";
import { continentState, type BoardingBackup, type ContinentKey } from "./seaSlice";
import type { BattalionData, GameState, LogTone } from "./useGameStore";

/**
 * A fortaleza no jogo (Marco 22, parte 3): fincar o estandarte, a muralha, o castelão, o kit do
 * acampamento de campo e o cerco à sede. As regras puras estão em `game/sim/fortress.ts`; a
 * fortaleza é a própria planta do acampamento (`campPlan`, 34×34), que não se levanta mais.
 */

export interface SeatAlarm {
  attackers: number;
  faction: EnemyFactionId;
  /** Quem vem (para a notícia e o chefe da batalha). */
  name: string;
}

export interface FortressState {
  fortress: Fortress | null;
  /** Onde o acampamento de campo está montado (null = nas carroças). */
  fieldCamp: Point | null;
  /** O inimigo chegou à sede com o bando em casa: a batalha espera o Comandante. */
  seatAlarm: SeatAlarm | null;
  /** A campanha guardada durante a batalha do cerco à sede. */
  seatBattle: (BoardingBackup & { alarm: SeatAlarm }) | null;
  /** A cidade que nasce em volta da sede (Marco 22, parte 4). */
  seatCity: SeatCity | null;
}

export const INITIAL_FORTRESS: FortressState = { fortress: null, fieldCamp: null, seatAlarm: null, seatBattle: null, seatCity: null };

export interface FortressActions {
  /** Finca o estandarte por um dos caminhos da terra; `fit` é o que a cena diz do terreno (null = cabe). */
  plantStandard: (path: LandPath, fit: string | null) => string | null;
  buildStoneWall: () => string | null;
  setCastellan: (lieutenantId: string | null) => void;
  setFieldKit: (kit: CampKind[]) => string | null;
  pitchFieldCamp: (at: Point) => string | null;
  strikeFieldCamp: (quiet?: boolean) => void;
  /** Os dias que passaram, para a sede: fama do salão, a feira e o cerco. */
  fortressDays: (from: number, to: number) => void;
  startSeatSiege: () => void;
  endSeatSiege: () => void;
  /** Os decretos da cidade da sede (Marco 22, parte 4). */
  setDecree: (decree: Decree, on: boolean) => string | null;
  setCityTax: (tax: CityTax) => void;
  /** Aposenta `n` veteranos de um batalhão na cidade: viram milícia. */
  retireVeterans: (battalionId: string, n: number) => string | null;
}

type Setter = (partial: Partial<GameState> | ((s: GameState) => Partial<GameState>)) => void;

interface Links {
  note: (text: string, tone?: LogTone) => void;
  stock: (s: GameState) => { gold: number; wood: number; iron: number };
  paid: (s: GameState, c: CampCost) => Pick<GameState, "gold" | "iron" | "depot">;
  fresh: (world: NonNullable<GameState["world"]>, day: number) => Pick<GameState, ContinentKey>;
  /** O povoado do reino que a vila da sede vira (Marco 9), já com o nome dela. */
  seatTown: (s: GameState, city: SeatCity) => Settlement;
}

const nameOf = (s: Pick<GameState, "world" | "extraFactions">, id: string) =>
  s.world?.factions.find((f) => f.id === id)?.name ?? s.extraFactions.find((f) => f.id === id)?.name ?? "o reino";

/** A terra em volta da fogueira: quem manda nela e se há ruínas para reerguer. */
export function landCtxOf(s: GameState): LandCtx {
  const camp = s.world?.camp.center;
  if (!camp) return { lord: null, liege: s.liege, ruins: null };
  const owned = s.settlements
    .filter((t) => s.factions.some((f) => f.id === t.owner))
    .map((t) => ({ t, d: distance(t, camp) }))
    .filter((x) => x.d <= LORD_RADIUS)
    .sort((a, b) => a.d - b.d)[0];
  const f = owned ? s.factions.find((x) => x.id === owned.t.owner) : undefined;
  const ruin = (s.world?.sites ?? [])
    .filter((x) => x.theme === "HAUNTED_RUINS" && distance(x.center, camp) <= RUINS_RADIUS)
    .sort((a, b) => distance(a.center, camp) - distance(b.center, camp))[0];
  return {
    lord: f ? { id: f.id, name: nameOf(s, f.id), relation: f.relation, atWar: f.atWar } : null,
    liege: s.liege,
    ruins: ruin ? { id: ruin.id, name: ruin.name, fill: siteFill(s.siteLife[ruin.id], s.day) } : null,
  };
}

/** Quem guarda a sede: os batalhões que ficaram (com o bando fora) ou todos (com ele em casa). */
export function garrisonOf(s: Pick<GameState, "battalions" | "campStay" | "exposure">): BattalionData[] {
  if (!s.exposure.away) return s.battalions;
  const stay = new Set(s.campStay);
  return s.battalions.filter((b) => stay.has(b.id));
}

/** O castelão está mesmo na sede? (o tenente existe e o batalhão dele não marchou) */
export function castellanHome(s: Pick<GameState, "fortress" | "lieutenants" | "campStay" | "exposure">): boolean {
  const l = s.fortress?.castellan ? s.lieutenants.find((x) => x.id === s.fortress?.castellan) : undefined;
  if (!l) return false;
  return !s.exposure.away || !l.battalionId || s.campStay.includes(l.battalionId);
}

/** Quem vem cercar: um reino em guerra com o bando; sem guerra, salteadores, e orcs com fama alta. */
function attackerOf(s: GameState): { faction: EnemyFactionId; name: string } {
  const war = s.factions.find((f) => f.atWar);
  if (war) return { faction: "KINGDOM", name: `o exército ${nameOf(s, war.id).startsWith("o ") ? "d" : "de "}${nameOf(s, war.id)}` };
  return s.fame >= 60 ? { faction: "ORCS", name: "uma horda orc" } : { faction: "BANDITS", name: "um bando de salteadores" };
}

/** Save com fortaleza de antes da cidade da sede: o arraial nasce com a gente que já andava com o bando. */
export function migrateSeatCity(store: Record<string, unknown>): void {
  const f = store.fortress as Fortress | null | undefined;
  if (!f || store.seatCity !== undefined) return;
  const followers = Array.isArray(store.followers) ? store.followers.length : 0;
  const soldiers = Array.isArray(store.battalions) ? (store.battalions as BattalionData[]).reduce((n, b) => n + b.soldiers, 0) : 0;
  store.seatCity = newSeatCity(f.founded, followers, soldiers);
}

/** O que a sede oferece à cidade hoje. */
export function cityDriversOf(s: GameState): CityDrivers {
  const garrison = garrisonOf(s).reduce((n, b) => n + b.soldiers, 0);
  return cityDrivers({ plan: s.campPlan, garrison, militia: s.seatCity?.militia ?? 0, rations: s.rations, fame: s.fame, decrees: s.seatCity?.decrees ?? [] });
}

/** O ferro do intendente, mais barato com o decreto dos artesãos. */
export function ironBuyPrice(s: Pick<GameState, "seatCity">): number {
  return s.seatCity?.decrees.includes("ARTISANS") ? Math.round(PROGRESSION.IRON_BUY_PRICE * ARTISAN_IRON) : PROGRESSION.IRON_BUY_PRICE;
}

/** Ouro que a feira do castelo rende por semana. */
export const FAIR_GOLD = (fame: number) => Math.round(20 + fame / 2);
export const GREAT_HALL_FAME = 0.1;

export function fortressSlice(set: Setter, get: () => GameState, links: Links): FortressActions {
  const { note } = links;

  /**
   * O cerco resolvido sem o bando: a guarnição, a muralha e a sorte. `lost`: o bando perdeu a
   * batalha nos muros (as baixas já vieram dela) e a sede é saqueada.
   */
  const siegeAway = (alarm: SeatAlarm, lost = false) => {
    const s = get();
    const f = s.fortress;
    if (!f) return;
    const garrison = lost ? [] : garrisonOf(s);
    const soldiers = garrison.reduce((n, b) => n + b.soldiers, 0);
    const r = lost ? { held: false, loss: 0, killed: 0 } : seatSiege(seatDefense(s.campPlan, soldiers, castellanHome(s)), alarm.attackers);
    const ids = new Set(garrison.map((b) => b.id));
    const battalions = s.battalions
      .map((b) => (ids.has(b.id) ? { ...b, soldiers: b.soldiers - Math.round(b.soldiers * r.loss) } : b))
      .filter((b) => b.soldiers > 0);
    const next: Fortress = { ...f, sieges: f.sieges + 1, nextSiege: s.day + siegeEvery(f.land, s.fame) };
    if (r.held) {
      set({ battalions, fortress: next, fame: Math.min(100, s.fame + 3), seatAlarm: null });
      note(`${cap(alarm.name)} cercou a sede e foi repelido${soldiers > 0 ? ` pela guarnição (${r.killed} caídos do lado deles)` : ""}. A muralha aguentou.`, "good");
      return;
    }
    // A sede caiu: saqueiam o que dá e queimam um terço das construções
    const sacked = sackedPlan(s.campPlan);
    const gold = sackGold(s.campPlan, s.gold);
    const depot = Object.fromEntries(Object.entries(s.depot).map(([k, v]) => [k, Math.floor((v ?? 0) * (1 - SACK.DEPOT))]));
    // O castelão que estava lá foge (com o bando em casa, ele lutou ao lado do Comandante)
    const castellan = !lost && castellanHome(s) ? null : f.castellan;
    // A cidade em volta também sofre: um quinto da gente foge ou morre
    const city = s.seatCity ? { ...s.seatCity, people: Math.round(s.seatCity.people * 0.8) } : null;
    set({
      seatCity: city,
      battalions,
      gold: s.gold - gold,
      rations: Math.floor(s.rations * (1 - SACK.RATIONS)),
      depot,
      campPlan: sacked.plan,
      fortress: { ...next, castellan },
      fame: Math.max(0, s.fame - 5),
      seatAlarm: null,
    });
    const burned = sacked.burned.map((k) => CAMP_BUILDINGS[k].label.toLowerCase());
    note(
      `A SEDE CAIU! ${cap(alarm.name)} passou pela muralha${lost ? " e o bando teve de recuar" : soldiers > 0 ? " e a guarnição foi destroçada" : ", sem ninguém para defendê-la"}. Levaram ${gold > 0 ? `${gold} de ouro, ` : ""}metade das rações e do depósito${burned.length > 0 ? `, e queimaram: ${burned.join(", ")}` : ""}.${castellan === null && f.castellan ? " O castelão fugiu e não volta." : ""}`,
      "bad",
    );
  };

  /** Um dia da cidade da sede: cresce, e a cada semana paga, e às vezes adoece. */
  const cityDay = (day: number) => {
    const s = get();
    const c = s.seatCity;
    if (!c) return;
    const d = cityDriversOf(s);
    let city = growCity(c, d, s.campPlan);
    const before = stageOf(c.people);
    const after = stageOf(city.people);
    const patch: Partial<GameState> = {};
    if (after !== before) {
      const up = STAGE[after].from > STAGE[before].from;
      const a = `${after === "TOWN" || after === "CITY" ? "uma" : "um"} ${STAGE[after].label.toLowerCase()}`;
      note(up ? `A gente em volta da sede cresceu: agora é ${a}. ${STAGE[after].text}` : `A gente vai embora da sede: ela voltou a ser ${a}.`, up ? "good" : "bad");
    }
    // A vila entra no reino (Marco 9): impostos, recrutas, bens, guarnição e lealdade
    if (inRealm(after) && !city.settlementId && s.world) {
      const town = links.seatTown(s, city);
      city = { ...city, settlementId: town.id };
      patch.settlements = [...s.settlements, town];
      note(`A gente em volta da sede ergueu a paliçada de fora: ${town.name} é agora uma vila do bando, com impostos, guarnição e lealdade como as outras.`, "good");
    } else if (city.settlementId) {
      // O povoado do reino acompanha a cidade (a gente, o tipo e a guarnição da milícia): toda semana, e quando vira cidade
      const fig = realmFigures(city);
      const id = city.settlementId;
      const own = s.settlements.find((t) => t.id === id && t.owner === "PLAYER");
      if (own && (day % 7 === 0 || own.kind !== fig.kind)) {
        patch.settlements = s.settlements.map((t) => (t === own ? { ...t, kind: fig.kind, population: fig.population, garrison: Math.max(t.garrison, fig.garrison) } : t));
      }
    }
    if (day % 7 === 0) {
      const gold = weeklyGold(city, d);
      if (gold !== 0) {
        patch.gold = Math.max(0, s.gold + gold);
        if (gold > 0) note(`A cidade da sede pagou ${gold} de ouro esta semana (${Math.round(city.people)} moradores).`, "good");
      }
      const fever = feverWeek(city, Math.random());
      if (fever.lost > 0) {
        city = fever.city;
        note(`Febre na cidade da sede: ${fever.lost} moradores morreram ou fugiram.`, "bad");
      }
    }
    set({ ...patch, seatCity: city });
  };

  return {
    plantStandard: (path, fit) => {
      const s = get();
      if (s.scenario) return "Não numa batalha personalizada.";
      if (s.campPacked) return "O acampamento está levantado.";
      if (s.exposure.away) return "O Comandante precisa estar no acampamento.";
      const land = landCtxOf(s);
      const why = standardProblem(s.campPlan, { fame: s.fame, battalions: s.battalions.length }, path, land) ?? fit;
      if (why) return why;
      const cost = standardCost(path);
      const short = shortOf(cost, links.stock(s));
      if (short) return short;
      const fortress: Fortress = {
        founded: s.day,
        land: path,
        lord: path === "CHARTER" ? (land.lord?.id ?? null) : null,
        ruinId: path === "RUINS" ? (land.ruins?.id ?? null) : null,
        castellan: null,
        nextSiege: s.day + siegeEvery(path, s.fame),
        sieges: 0,
        kit: [],
      };
      const soldiers = s.battalions.reduce((n, b) => n + b.soldiers, 0);
      const patch: Partial<GameState> = { ...links.paid(s, cost), campPlan: fortressPlan(s.campPlan), fortress, seatCity: newSeatCity(s.day, s.followers.length, soldiers) };
      const band = s.world?.bandName ?? "mercenários";
      if (path === "CHARTER" && land.lord) {
        // Vassalo: os inimigos do suserano passam a ser os do bando
        const lord = land.lord.id;
        const enemies = new Set(s.wars.filter((w) => w.peace === undefined && (w.a === lord || w.b === lord)).map((w) => (w.a === lord ? w.b : w.a)));
        patch.liege = lord;
        patch.factions = s.factions.map((x) => (x.id === lord ? { ...x, relation: Math.min(100, x.relation + 10), atWar: false } : enemies.has(x.id) ? { ...x, atWar: true, relation: Math.min(x.relation, REALM.WAR_BELOW) } : x));
        set(patch);
        note(`Com a carta de terra de ${land.lord.name}, os ${band} fincaram o estandarte: o acampamento virou fortaleza, e o bando agora é vassalo.`, "good");
      } else if (path === "RUINS" && land.ruins) {
        // As ruínas viram pedreira: quem morava nelas não volta
        patch.siteLife = { ...s.siteLife, [land.ruins.id]: { fill: 0, since: 1e9 } };
        set(patch);
        note(`Das pedras de ${land.ruins.name}, os ${band} ergueram a fortaleza: o estandarte está fincado.`, "good");
      } else {
        patch.fear = Math.min(100, s.fear + WILD_FEAR);
        set(patch);
        note(`Os ${band} fincaram o estandarte em terra de ninguém: a fortaleza é só deles, e os vizinhos olham para ela com desconfiança.`, "good");
      }
      return null;
    },

    buildStoneWall: () => {
      const s = get();
      if (!isFortress(s.campPlan)) return "Só na fortaleza.";
      if (s.campPlan.wall === "STONE") return "A muralha já é de pedra.";
      const short = shortOf(STONE_WALL.cost, links.stock(s));
      if (short) return short;
      set({ ...links.paid(s, STONE_WALL.cost), campPlan: { ...s.campPlan, wall: "STONE" } });
      note("A muralha da fortaleza agora é de pedra.", "good");
      return null;
    },

    setCastellan: (id) => {
      const s = get();
      if (!s.fortress) return;
      set({ fortress: { ...s.fortress, castellan: id } });
      const l = id ? s.lieutenants.find((x) => x.id === id) : undefined;
      if (l) note(`${l.name} fica como castelão da fortaleza.`);
    },

    setFieldKit: (kit) => {
      const s = get();
      if (!s.fortress) return "Só com a fortaleza.";
      const why = kitProblem(kit, s.campPlan, s.wagons.length);
      if (why) return why;
      set({ fortress: { ...s.fortress, kit } });
      return null;
    },

    pitchFieldCamp: (at) => {
      const s = get();
      if (!s.fortress || !s.world) return "Só com a fortaleza.";
      if (s.train !== "ARMY") return "O kit vai nas carroças: elas precisam estar com o exército.";
      const why = fieldPitchProblem(at, s.world.camp.center, !!s.fieldCamp);
      if (why) return why;
      set({ fieldCamp: { x: Math.round(at.x), y: Math.round(at.y) } });
      const kit = s.fortress.kit.map((k) => CAMP_BUILDINGS[k].label.toLowerCase());
      note(`O acampamento de campo foi montado${kit.length > 0 ? `: ${kit.join(", ")}` : " (só a tenda e a fogueira)"}.`);
      return null;
    },

    strikeFieldCamp: (quiet) => {
      if (!get().fieldCamp) return;
      set({ fieldCamp: null });
      if (!quiet) note("O acampamento de campo voltou para as carroças.");
    },

    fortressDays: (from, to) => {
      for (let day = from + 1; day <= to; day++) {
        const s = get();
        const f = s.fortress;
        if (!f || s.scenario) return;
        const patch: Partial<GameState> = {};
        // O salão do Comandante: fama todo dia
        if (readyOf(s.campPlan, "GREAT_HALL").length > 0) patch.fame = Math.min(100, s.fame + GREAT_HALL_FAME);
        // A feira do castelo rende toda semana (com o mascate ou outro no posto)
        const fair = s.campPlan.buildings.find((b) => b.kind === "CASTLE_FAIR" && b.built === undefined && !b.off);
        if (fair && day % 7 === 0) {
          const gold = FAIR_GOLD(s.fame);
          patch.gold = s.gold + gold;
          note(`A feira do castelo rendeu ${gold} de ouro esta semana.`, "good");
        }
        if (Object.keys(patch).length > 0) set(patch);
        cityDay(day);
        // O aviso do cerco: com o pombal, uma semana antes; sem ele, na véspera
        const warn = readyOf(s.campPlan, "DOVECOTE").length > 0 ? SEAT_SIEGE.WARN_DOVECOTE : 1;
        if (day === f.nextSiege - warn) {
          const who = attackerOf(s);
          note(`${warn > 1 ? "Os pombos trazem a notícia" : "Os vigias avistaram fogueiras"}: ${who.name} marcha contra a sede, e chega ${warn > 1 ? `no dia ${f.nextSiege}` : "amanhã"}. Deixe uma guarnição (e um castelão) atrás da muralha.`, "bad");
        }
        if (day < f.nextSiege) continue;
        // Um alarme sem resposta: o Comandante saiu, e a guarnição se vira sozinha
        const alarm = s.seatAlarm ?? { ...attackerOf(s), attackers: siegeHost(s.fame, f.sieges) };
        if (s.exposure.away) siegeAway(alarm);
        else if (!s.seatAlarm) {
          set({ seatAlarm: alarm });
          note(`${cap(alarm.name)} chegou à sede: ${alarm.attackers} homens, com escadas e aríete. Às muralhas!`, "bad");
        }
      }
    },

    startSeatSiege: () => {
      const s = get();
      const alarm = s.seatAlarm;
      if (!alarm || !s.world || s.seatBattle || s.scenario) return;
      const scenario = seatSiegeScenario(alarm.attackers, alarm.faction, "", s.warDifficulty, s.campPlan.wall === "STONE");
      const world = buildScenarioWorld(scenario);
      setWorldSize(world.cols, world.rows);
      set({
        ...links.fresh(world, s.day),
        seatBattle: { world: s.world, land: continentState(s), scouts: s.scouts, messengers: s.messengers, wagons: s.wagons, nextEventDay: s.nextEventDay, alarm },
        seatAlarm: null,
        world,
        scenario,
        scenarioResult: null,
        scenarioHud: null,
        scenarioPaused: false,
        scouts: [],
        messengers: [],
        wagons: [],
        nextEventDay: Infinity,
        pendingField: null,
        campPanel: null,
        loadNonce: s.loadNonce + 1,
      });
    },

    setDecree: (decree, on) => {
      const s = get();
      const c = s.seatCity;
      if (!c) return "Só com a cidade da sede.";
      if (on === c.decrees.includes(decree)) return null;
      set({ seatCity: { ...c, decrees: on ? [...c.decrees, decree] : c.decrees.filter((k) => k !== decree) } });
      return null;
    },

    setCityTax: (tax) => {
      const s = get();
      const c = s.seatCity;
      if (!c) return;
      // Na vila do reino, o imposto é o mesmo do povoado (Marco 9)
      set({ seatCity: { ...c, tax }, settlements: c.settlementId ? s.settlements.map((t) => (t.id === c.settlementId && t.owner === "PLAYER" ? { ...t, taxRate: tax } : t)) : s.settlements });
    },

    retireVeterans: (battalionId, n) => {
      const s = get();
      const b = s.battalions.find((x) => x.id === battalionId);
      if (!b) return "Batalhão não encontrado.";
      const why = retireProblem(s.seatCity, b.level, b.soldiers, n);
      if (why || !s.seatCity) return why;
      set({ seatCity: retire(s.seatCity, n), battalions: s.battalions.map((x) => (x.id === b.id ? { ...x, soldiers: x.soldiers - n } : x)) });
      note(`${n} veteranos de ${b.name} penduraram a espada e ganharam terra na cidade da sede: agora são a milícia dela.`, "good");
      return null;
    },

    endSeatSiege: () => {
      const s = get();
      const b = s.seatBattle;
      const r = s.scenarioResult;
      if (!b || !r) return;
      const won = r.outcome === "VICTORY";
      const alive = new Map(r.battalions.map((x) => [x.id, x.alive]));
      const battalions = s.battalions.map((d) => ({ ...d, soldiers: alive.get(d.id) ?? d.soldiers })).filter((d) => d.soldiers > 0);
      setWorldSize(b.world.cols, b.world.rows);
      set({
        ...b.land,
        world: b.world,
        seatBattle: null,
        scenario: null,
        scenarioResult: null,
        scenarioHud: null,
        scouts: b.scouts,
        messengers: b.messengers,
        wagons: b.wagons,
        nextEventDay: b.nextEventDay,
        battalions,
        // Volta para a sede: o mundo é refeito com o bando dentro dela
        pendingField: null,
        loadNonce: s.loadNonce + 1,
      });
      const after = get();
      const f = after.fortress;
      if (!f) return;
      if (won) {
        set({ fortress: { ...f, sieges: f.sieges + 1, nextSiege: after.day + siegeEvery(f.land, after.fame) }, fame: Math.min(100, after.fame + 5) });
        note(`O cerco à sede foi repelido: ${cap(b.alarm.name)} deixou ${r.enemyKilled} mortos ao pé da muralha.`, "good");
        return;
      }
      // Perdida a batalha, a sede é saqueada
      siegeAway(b.alarm, true);
    },
  };
}

const cap = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);
