import { HOME_CONTINENT, seaDistance, type ContinentDef, type PlanetDef } from "../game/data/planet";
import { boardingScenario, buildScenarioWorld } from "../game/data/scenarios";
import { continentWorld } from "../game/worldgen/generateWorld";
import { campDefAt } from "../game/data/campLayout";
import { captureField, type FieldSave } from "../game/save/saveGame";
import { farWeek } from "../game/sim/farWorld";
import { battalionSeats, charterCost, escapeChance, fleetReaches, fleetSeats, fleetSpeed, newsDelay, pirateCrew, pirateToll, rollSeaDay, seatsNeeded, voyageDays } from "../game/sim/voyage";
import { personName } from "../game/worldgen/names";
import { createRng, randomSeed } from "../game/worldgen/rng";
import { SEA, setWorldSize, type Season, type ShipType } from "../utils/constants";
import { newId } from "../utils/id";
import { seasonOf } from "../utils/season";
import type { BattalionData, GameState, LogTone, WagonData } from "./useGameStore";

/**
 * Mares e continentes (Marco 17). Cada continente é um mundo inteiro: o bando viaja, e tudo o que
 * pertence à terra fica para trás, guardado como um save parcial que continua vivo em passos
 * semanais (ver farWorld.ts). Fica à parte do store principal, como a corte e a guerra.
 */

/** O que é da terra: fica nela quando o bando parte. O resto (ouro, tropas, carga) vai junto. */
export const CONTINENT_KEYS = [
  "settlements", "factions", "wars", "calamities", "nextCalamityDay", "nobles", "plots", "alliances", "armies", "courtEvents",
  "revolts", "extraFactions", "rumors", "rumorSeq", "commanderAt", "knights", "liege", "spouseId", "wanted", "passLetters",
  "passes", "audiences", "quests", "summons", "contracts", "activeContract", "priceBook", "depot", "posts", "stakes", "loans",
  "ownCaravans", "marketTaxIncome", "stolenCargo", "townIntel", "battlefields", "burnedBridges", "siege", "forage", "campAt",
  "campPacked", "campPlan", "campForest", "campStay", "followers", "exposure", "fame", "fear", "nestsFound", "siteLife", "training", "captives", "captiveOfficers",
  "fortress", "fieldCamp", "seatAlarm", "seatCity",
] as const satisfies readonly (keyof GameState)[];

export type ContinentKey = (typeof CONTINENT_KEYS)[number];

export function continentState(s: GameState): Pick<GameState, ContinentKey> {
  const out: Partial<Record<ContinentKey, unknown>> = {};
  for (const k of CONTINENT_KEYS) out[k] = s[k];
  return out as Pick<GameState, ContinentKey>;
}

/** Continente onde o bando não está. */
export interface ParkedContinent {
  store: Pick<GameState, ContinentKey>;
  field: FieldSave | null;
  /** Quem ficou no cais e volta a se juntar ao bando. */
  left: BattalionData[];
  leftWagons: WagonData[];
  portId: string;
  /** Quando o bando partiu e como a terra estava: para contar o que mudou na volta. */
  leftDay: number;
  owners: Record<string, string>;
  /** Nomes dos reinos: longe, o mundo gerado não fica em memória. */
  realmNames: Record<string, string>;
}

export interface OwnedShip {
  id: string;
  type: ShipType;
  name: string;
}

export interface VoyageNote {
  day: number;
  text: string;
  tone: LogTone;
}

export interface Voyage {
  from: string;
  to: string;
  portId: string;
  shipLabel: string;
  speed: number;
  seats: number;
  day: number;
  days: number;
  notes: VoyageNote[];
  /** Velas no horizonte: esperando a decisão do Comandante. */
  pirates: boolean;
  stay: BattalionData[];
  stayWagons: WagonData[];
  /** O campo como ficou no porto de saída. */
  field: FieldSave | null;
}

/** O que fica guardado enquanto o bando luta no convés. */
export interface BoardingBackup {
  world: NonNullable<GameState["world"]>;
  land: Pick<GameState, ContinentKey>;
  scouts: GameState["scouts"];
  messengers: GameState["messengers"];
  wagons: GameState["wagons"];
  nextEventDay: number;
}

export interface SeaNews {
  arrives: number;
  text: string;
  from: string;
}

export interface SeaState {
  planet: PlanetDef | null;
  continent: string;
  parked: Record<string, ParkedContinent>;
  /** Continentes com carta náutica: só para eles dá para traçar rota. */
  charts: string[];
  fleet: OwnedShip[];
  voyage: Voyage | null;
  seaNews: SeaNews[];
  /** Povoado onde o bando acaba de desembarcar: a cena põe o exército ali. */
  landing: string | null;
  atlasOpen: boolean;
  boarding: BoardingBackup | null;
  /** Até que dia as terras distantes já foram simuladas. */
  farDay: number;
}

export const INITIAL_SEA: SeaState = {
  planet: null,
  continent: HOME_CONTINENT,
  parked: {},
  charts: [],
  fleet: [],
  voyage: null,
  seaNews: [],
  landing: null,
  atlasOpen: false,
  boarding: null,
  farDay: 1,
};

export interface EmbarkPlan {
  to: string;
  portId: string;
  battalionIds: string[];
  wagons: number;
  /** Frota própria ou um navio fretado deste tipo. */
  ship: ShipType | "FLEET";
}

export interface EmbarkQuote {
  seats: number;
  capacity: number;
  days: number;
  price: number;
  speed: number;
  label: string;
  /** Por que não dá (null = dá). */
  problem: string | null;
}

export interface SeaActions {
  setAtlasOpen: (open: boolean) => void;
  buyChart: (id: string) => string | null;
  buyShip: (type: ShipType) => string | null;
  sellShip: (id: string) => string | null;
  /** Quanto custa e quanto leva uma viagem assim. */
  quoteVoyage: (plan: EmbarkPlan) => EmbarkQuote;
  embark: (plan: EmbarkPlan) => string | null;
  /** Um dia de mar; quando a viagem acaba, o bando desembarca. */
  sailDay: () => void;
  answerPirates: (choice: "PAY" | "RUN") => string | null;
  /** Lutar: a batalha acontece num convés, com quem estiver a bordo. */
  startBoarding: () => void;
  /** Fim da abordagem: as baixas ficam, e a viagem continua. */
  endBoarding: () => void;
  /** Desembarca no destino: guarda esta terra e traz a outra. */
  land: () => void;
  /** Uma semana nas terras onde o bando não está; chegam as notícias que estavam no mar. */
  farTick: () => void;
}

type Setter = (partial: Partial<GameState> | ((s: GameState) => Partial<GameState>)) => void;

const SHIP_NAMES = ["Santa Clara", "Boa Viagem", "Gaivota", "Vento Leste", "Fortuna", "Sete Marés", "Estrela do Mar", "Andorinha"];

const continentOf = (s: GameState, id: string): ContinentDef | undefined => s.planet?.continents.find((c) => c.id === id);
const seasonNow = (s: GameState): Season => seasonOf(s.day);

export function seaSlice(set: Setter, get: () => GameState, links: { fresh: (world: NonNullable<GameState["world"]>, day: number) => Pick<GameState, ContinentKey>; note: (text: string, tone?: LogTone) => void }): SeaActions {
  return {
    setAtlasOpen: (open) => set({ atlasOpen: open }),

    buyChart: (id) => {
      const s = get();
      const c = continentOf(s, id);
      if (!c) return "Essa terra não existe nas cartas.";
      if (s.charts.includes(id)) return "O bando já tem essa carta.";
      if (s.gold < SEA.CHART_PRICE) return `Falta ouro: a carta custa ${SEA.CHART_PRICE}.`;
      set({ gold: s.gold - SEA.CHART_PRICE, charts: [...s.charts, id] });
      links.note(`O bando comprou uma carta náutica: ${c.name}.`);
      return null;
    },

    buyShip: (type) => {
      const s = get();
      const def = SEA.SHIPS[type];
      if (s.gold < def.price) return `Falta ouro: ${def.label} custa ${def.price}.`;
      const taken = new Set(s.fleet.map((x) => x.name));
      const name = SHIP_NAMES.find((n) => !taken.has(n)) ?? `Nau ${s.fleet.length + 1}`;
      set({ gold: s.gold - def.price, fleet: [...s.fleet, { id: newId(), type, name }] });
      links.note(`O bando comprou ${def.label.toLowerCase()}, a ${name}.`, "good");
      return null;
    },

    sellShip: (id) => {
      const s = get();
      const ship = s.fleet.find((x) => x.id === id);
      if (!ship) return "Esse navio não é do bando.";
      const price = Math.round(SEA.SHIPS[ship.type].price * 0.6);
      set({ gold: s.gold + price, fleet: s.fleet.filter((x) => x !== ship) });
      links.note(`A ${ship.name} foi vendida por ${price} de ouro.`);
      return null;
    },

    quoteVoyage: (plan) => {
      const s = get();
      const here = continentOf(s, s.continent);
      const there = continentOf(s, plan.to);
      const party = s.battalions.filter((b) => plan.battalionIds.includes(b.id));
      const seats = seatsNeeded(party, plan.wagons);
      const blank = { seats, capacity: 0, days: 0, price: 0, speed: 1, label: "" };
      if (!here || !there) return { ...blank, problem: "Escolha o destino." };
      const distance = seaDistance(here, there);
      const fleet = plan.ship === "FLEET" ? s.fleet : [{ type: plan.ship }];
      const speed = fleetSpeed(fleet);
      const days = voyageDays(distance, speed, seasonNow(s));
      const capacity = fleetSeats(fleet);
      const owned = plan.ship === "FLEET";
      const price = owned ? 0 : charterCost(seats, days);
      const label = owned ? `frota de ${s.fleet.length} navio(s)` : `${SEA.SHIPS[plan.ship as ShipType].label} fretada`;
      const problem =
        party.length === 0
          ? "Escolha quem embarca."
          : owned && s.fleet.length === 0
            ? "O bando não tem navios."
            : !fleetReaches(fleet, distance)
              ? "Este navio não cruza mar aberto."
              : seats > capacity
                ? `Não cabe: são ${seats} lugares para ${capacity}.`
                : price > s.gold
                  ? `Falta ouro: o frete custa ${price}.`
                  : null;
      return { seats, capacity, days, price, speed, label, problem };
    },

    embark: (plan) => {
      const s = get();
      const q = get().quoteVoyage(plan);
      if (q.problem) return q.problem;
      if (s.activeContract) return "Há um contrato em andamento: termine ou abandone antes de partir.";
      if (s.expeditions.length > 0) return "Há tropas em missão: espere a volta delas.";
      if (s.siege) return "Com um cerco em andamento, ninguém embarca.";
      if (s.pendingMutiny || s.mutiny) return "Com um motim no acampamento, ninguém embarca.";
      if (s.battalions.some((b) => plan.battalionIds.includes(b.id) && s.training.some((t) => t.battalionId === b.id))) return "Quem está em treino não pode embarcar.";
      const field = captureField();
      if (typeof field === "string") return field;
      const stay = s.battalions.filter((b) => !plan.battalionIds.includes(b.id));
      const gone = plan.wagons;
      set({
        gold: s.gold - q.price,
        battalions: s.battalions.filter((b) => plan.battalionIds.includes(b.id)),
        wagons: s.wagons.slice(0, gone),
        // O diário segue a viagem; os acontecimentos do acampamento esperam a volta a terra
        nextEventDay: s.day + q.days + 3,
        campPanel: null,
        voyage: {
          from: s.continent,
          to: plan.to,
          portId: plan.portId,
          shipLabel: q.label,
          speed: q.speed,
          seats: q.seats,
          day: 0,
          days: q.days,
          notes: [{ day: s.day, text: "Soltaram as amarras.", tone: "info" }],
          pirates: false,
          stay,
          stayWagons: s.wagons.slice(gone),
          field,
        },
      });
      links.note(`O bando embarcou: ${q.days} dias de mar até ${continentOf(s, plan.to)?.name}.`);
      return null;
    },

    sailDay: () => {
      const s = get();
      const v = s.voyage;
      if (!v || v.pirates) return;
      get().advanceTime(1);
      const now = get();
      const notes = [...v.notes];
      let days = v.days;
      let pirates = false;
      const event = rollSeaDay(seasonNow(now));
      const patch: Partial<GameState> = {};
      if (event === "STORM") {
        patch.freight = now.freight.map((lot) => ({ ...lot, qty: Math.floor(lot.qty * (1 - SEA.STORM_CARGO)) })).filter((lot) => lot.qty > 0);
        let lost = 0;
        patch.battalions = now.battalions.map((b) => {
          const dead = Math.min(b.soldiers - 1, Math.random() < SEA.STORM_MEN * b.soldiers ? 1 : 0);
          lost += dead;
          return dead > 0 ? { ...b, soldiers: b.soldiers - dead } : b;
        });
        notes.push({ day: now.day, text: lost > 0 ? `Tempestade: parte da carga foi ao mar, e ${lost} homem(ns) com ela.` : "Tempestade: parte da carga foi ao mar.", tone: "bad" });
      } else if (event === "CALM") {
        const extra = SEA.CALM_DAYS[0] + Math.floor(Math.random() * (SEA.CALM_DAYS[1] - SEA.CALM_DAYS[0] + 1));
        days += extra;
        notes.push({ day: now.day, text: `Calmaria: nenhum vento. ${extra} dia(s) a mais de viagem.`, tone: "bad" });
      } else if (event === "PIRATES") {
        pirates = true;
        notes.push({ day: now.day, text: "Velas negras no horizonte!", tone: "bad" });
      }
      const day = v.day + 1;
      set({ ...patch, voyage: { ...v, day, days, notes: notes.slice(-12), pirates } });
      if (!pirates && day >= days) get().land();
    },

    answerPirates: (choice) => {
      const s = get();
      const v = s.voyage;
      if (!v?.pirates) return null;
      if (choice === "PAY") {
        const toll = pirateToll(v.seats);
        if (s.gold < toll) return `Falta ouro: eles pedem ${toll}.`;
        set({ gold: s.gold - toll, voyage: { ...v, pirates: false, notes: [...v.notes, { day: s.day, text: `Pagamos ${toll} de ouro, e eles nos deixaram passar.`, tone: "info" as const }].slice(-12) } });
        return null;
      }
      if (Math.random() < escapeChance(v.speed)) {
        set({ voyage: { ...v, pirates: false, days: v.days + 1, notes: [...v.notes, { day: s.day, text: "Soltamos todo o pano e os deixamos para trás. Um dia perdido na volta larga.", tone: "good" as const }].slice(-12) } });
        return null;
      }
      set({ voyage: { ...v, notes: [...v.notes, { day: s.day, text: "Não deu: eles são mais rápidos.", tone: "bad" as const }].slice(-12) } });
      return "Eles são mais rápidos.";
    },

    startBoarding: () => {
      const s = get();
      const v = s.voyage;
      if (!v?.pirates || !s.world || s.boarding) return;
      const scenario = boardingScenario(pirateCrew(v.seats), s.warDifficulty);
      const world = buildScenarioWorld(scenario);
      setWorldSize(world.cols, world.rows);
      set({
        ...links.fresh(world, s.day),
        boarding: { world: s.world, land: continentState(s), scouts: s.scouts, messengers: s.messengers, wagons: s.wagons, nextEventDay: s.nextEventDay },
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

    endBoarding: () => {
      const s = get();
      const b = s.boarding;
      const r = s.scenarioResult;
      const v = s.voyage;
      if (!b || !r || !v) return;
      const won = r.outcome === "VICTORY";
      // Pirata vive de resgate: quem perde no convés vira prisioneiro, não cadáver
      const ransomed = won ? 0 : SEA.RANSOMED;
      const fallen = new Map(r.battalions.map((x) => [x.id, Math.max(x.alive, Math.ceil(x.start * ransomed))]));
      const battalions = s.battalions.flatMap((d) => {
        const alive = fallen.get(d.id) ?? d.soldiers;
        return alive > 0 ? [{ ...d, soldiers: alive }] : [];
      });
      const prize = won ? SEA.PRIZE_GOLD[0] + Math.floor(Math.random() * (SEA.PRIZE_GOLD[1] - SEA.PRIZE_GOLD[0] + 1)) : 0;
      const taken = won ? 0 : Math.floor(s.gold * 0.5);
      const text = won ? `Tomamos o navio pirata. O porão rendeu ${prize} de ouro.` : `Fomos vencidos no convés. Levaram ${taken} de ouro e metade da carga; os prisioneiros voltaram a bordo, e nos deixaram à deriva.`;
      setWorldSize(b.world.cols, b.world.rows);
      set({
        ...b.land,
        world: b.world,
        boarding: null,
        scenario: null,
        scenarioResult: null,
        scenarioHud: null,
        scouts: b.scouts,
        messengers: b.messengers,
        wagons: b.wagons,
        nextEventDay: b.nextEventDay,
        battalions,
        gold: s.gold + prize - taken,
        freight: won ? s.freight : s.freight.map((lot) => ({ ...lot, qty: Math.floor(lot.qty / 2) })).filter((lot) => lot.qty > 0),
        voyage: { ...v, pirates: false, notes: [...v.notes, { day: s.day, text, tone: won ? ("good" as const) : ("bad" as const) }].slice(-12) },
        loadNonce: s.loadNonce + 1,
      });
      links.note(text, won ? "good" : "bad");
      if (v.day >= v.days) get().land();
    },

    land: () => {
      const s = get();
      const v = s.voyage;
      if (!v || !s.world) return;
      const def = continentOf(s, v.to);
      if (!def) return;
      const here: ParkedContinent = {
        store: continentState(s),
        field: v.field,
        left: v.stay,
        leftWagons: v.stayWagons,
        portId: v.portId,
        leftDay: s.day,
        owners: Object.fromEntries(s.settlements.map((t) => [t.id, t.owner])),
        realmNames: Object.fromEntries([...s.world.factions, ...s.extraFactions].map((f) => [f.id, f.name])),
      };
      const parked = { ...s.parked, [s.continent]: here };
      const back = parked[v.to];
      const world = continentWorld(def, s.world.options);
      world.bandName = s.world.bandName;
      if (back?.store.campAt) world.camp = campDefAt(back.store.campAt);
      world.factions.push(...(back?.store.extraFactions ?? []));
      const arrival = back ? back.store : links.fresh(world, s.day);
      const rest = { ...parked };
      delete rest[v.to];
      const port = back?.portId ?? arrival.settlements.find((t) => t.port && t.owner !== "RUINED")?.id ?? arrival.settlements.find((t) => t.owner !== "RUINED")?.id ?? null;
      set({
        ...arrival,
        world,
        continent: v.to,
        parked: rest,
        voyage: null,
        battalions: back ? [...s.battalions, ...back.left] : s.battalions,
        wagons: back ? [...s.wagons, ...back.leftWagons] : s.wagons,
        pendingField: back?.field ?? null,
        landing: port,
        campPanel: null,
        loadNonce: s.loadNonce + 1,
      });
      links.note(back ? `O bando desembarcou de volta em ${def.name}.` : `O bando desembarcou em ${def.name}. Aqui ninguém conhece o nome dele.`, "good");
      if (!back) return;
      // Na volta, o porto conta de uma vez o que as cartas ainda não tinham trazido
      const told = s.seaNews.filter((n) => n.from === def.name);
      for (const n of told) links.note(`Enquanto o bando esteve fora: ${n.text}`);
      const changed = back.store.settlements.filter((t) => back.owners[t.id] !== t.owner).length;
      const weeks = Math.floor((s.day - back.leftDay) / 7);
      if (weeks > 0) links.note(`${weeks} semana(s) longe de ${def.name}: ${changed > 0 ? `${changed} povoado(s) mudaram de dono` : "as fronteiras são as mesmas"}.`);
      set((st) => ({ seaNews: st.seaNews.filter((n) => n.from !== def.name) }));
    },

    farTick: () => {
      const s = get();
      const ids = Object.keys(s.parked);
      // Viagem rápida e descanso pulam dias: contam as semanas que passaram, não o calendário
      const weeks = Math.floor((s.day - s.farDay) / 7);
      if (weeks > 0) set({ farDay: s.farDay + weeks * 7 });
      // Navio parado também custa: tripulação e casco, toda semana
      if (s.fleet.length > 0 && weeks > 0) {
        const upkeep = s.fleet.reduce((n, f) => n + SEA.SHIPS[f.type].upkeep, 0) * weeks;
        set({ gold: Math.max(0, s.gold - upkeep) });
        links.note(`Manutenção da frota: ${upkeep} de ouro.`);
      }
      const due = s.seaNews.filter((n) => n.arrives <= s.day);
      if (due.length > 0) {
        for (const n of due) links.note(`Notícias de ${n.from} (o mar atrasa tudo): ${n.text}`);
        set((st) => ({ seaNews: st.seaNews.filter((n) => n.arrives > s.day) }));
      }
      if (ids.length === 0 || weeks <= 0) return;
      const here = continentOf(s, s.continent);
      const parked = { ...s.parked };
      const incoming: SeaNews[] = [];
      for (const id of ids) {
        const def = continentOf(s, id);
        const land = parked[id];
        if (!def || !land) continue;
        const rng = createRng(randomSeed());
        let realm = { settlements: land.store.settlements, factions: land.store.factions };
        const delay = here ? newsDelay(seaDistance(here, def)) : 14;
        for (let w = 0; w < weeks; w++) {
          const step = farWeek(realm, { factionName: (fid) => land.realmNames[fid] ?? "um reino", heir: () => personName(rng) });
          realm = step.realm;
          for (const text of step.news) incoming.push({ arrives: s.day + delay, text, from: def.name });
        }
        parked[id] = { ...land, store: { ...land.store, ...realm } };
      }
      set((st) => ({ parked, seaNews: [...st.seaNews, ...incoming] }));
    },
  };
}

export { battalionSeats };
