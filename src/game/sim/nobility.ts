import { COURT, KINGDOM, type Good } from "../../utils/constants";
import type { SettlementKind, WorldDef } from "../data/world";
import { createRng, seedFromText, type Rng } from "../worldgen/rng";
import { epithet, firstName, isFemaleName } from "../worldgen/names";

/**
 * A nobreza (Marco 15): rei ou rainha, consorte, herdeiros, lordes vassalos e os oficiais da
 * corte são gente de verdade. Têm idade, traços, ambição, feudos, família e uma memória pessoal
 * do Comandante (favores e ofensas). Envelhecem, casam, conspiram e morrem, e a morte de quem
 * governa abre uma sucessão, às vezes uma crise. Tudo em funções puras sobre os dados: a corte
 * (cena e diálogos) só mostra e mexe nesses dados.
 */

export type NobleRank = "RULER" | "CONSORT" | "HEIR" | "CHILD" | "LORD" | "KIN" | "COURTIER";
export type CourtOffice = "CHANCELLOR" | "MARSHAL" | "SPYMASTER" | "PRIEST" | "CHAMBERLAIN";
export type NobleTrait =
  | "HONORABLE"
  | "CRUEL"
  | "GREEDY"
  | "AMBITIOUS"
  | "PIOUS"
  | "CUNNING"
  | "BRAVE"
  | "COWARD"
  | "GENEROUS"
  | "ENVIOUS"
  | "ROMANTIC"
  | "SCHOLAR";

/** Assuntos de conversa: cada traço gosta de uns e detesta outros. */
export type TalkTopic = "WAR" | "TRADE" | "FAITH" | "FAMILY" | "GOSSIP";

export const TOPIC_LABEL: Record<TalkTopic, string> = {
  WAR: "Falar de guerra e de batalhas",
  TRADE: "Falar de negócios e de ouro",
  FAITH: "Falar dos deuses e dos templos",
  FAMILY: "Perguntar pela família e pela casa",
  GOSSIP: "Falar dos outros nobres (intriga)",
};

export const NOBLE_TRAITS: Record<NobleTrait, { label: string; likes: TalkTopic[]; hates: TalkTopic[]; gift: Good }> = {
  HONORABLE: { label: "Honrado", likes: ["FAMILY"], hates: ["GOSSIP"], gift: "ARMS" },
  CRUEL: { label: "Cruel", likes: ["WAR"], hates: ["FAITH"], gift: "ARMS" },
  GREEDY: { label: "Ganancioso", likes: ["TRADE"], hates: ["FAITH"], gift: "LUXURY" },
  AMBITIOUS: { label: "Ambicioso", likes: ["GOSSIP", "WAR"], hates: [], gift: "HORSES" },
  PIOUS: { label: "Devoto", likes: ["FAITH"], hates: ["GOSSIP", "WAR"], gift: "CLOTH" },
  CUNNING: { label: "Astuto", likes: ["GOSSIP"], hates: [], gift: "LUXURY" },
  BRAVE: { label: "Bravo", likes: ["WAR"], hates: ["TRADE"], gift: "HORSES" },
  COWARD: { label: "Medroso", likes: ["FAMILY"], hates: ["WAR"], gift: "ALE" },
  GENEROUS: { label: "Generoso", likes: ["FAMILY", "FAITH"], hates: [], gift: "ALE" },
  ENVIOUS: { label: "Invejoso", likes: ["GOSSIP"], hates: ["FAMILY"], gift: "LUXURY" },
  ROMANTIC: { label: "Romântico", likes: ["FAMILY"], hates: ["TRADE"], gift: "LUXURY" },
  SCHOLAR: { label: "Letrado", likes: ["FAITH", "TRADE"], hates: ["WAR"], gift: "CLOTH" },
};

const OPPOSITE: Partial<Record<NobleTrait, NobleTrait>> = { BRAVE: "COWARD", COWARD: "BRAVE", GENEROUS: "GREEDY", GREEDY: "GENEROUS", HONORABLE: "CRUEL", CRUEL: "HONORABLE" };
const ALL_TRAITS = Object.keys(NOBLE_TRAITS) as NobleTrait[];

export const OFFICE_LABEL: Record<CourtOffice, [string, string]> = {
  CHANCELLOR: ["Chanceler", "Chanceler"],
  MARSHAL: ["Marechal", "Marechala"],
  SPYMASTER: ["Mestre dos Segredos", "Mestra dos Segredos"],
  PRIEST: ["Sumo Sacerdote", "Suma Sacerdotisa"],
  CHAMBERLAIN: ["Camareiro-mor", "Camareira-mor"],
};

/** O que o nobre lembra do Comandante. */
export interface NobleMemory {
  day: number;
  text: string;
  delta: number;
}

export interface Noble {
  id: string;
  /** Nome ("Urraca a Brava"; sem alcunha até subir ao trono). */
  name: string;
  female: boolean;
  /** "Casa de Ferrada". */
  house: string;
  factionId: string;
  rank: NobleRank;
  office?: CourtOffice;
  /** Barão (aldeia) ou conde (cidade, fortaleza). */
  tier?: "COUNT" | "BARON";
  age: number;
  traits: NobleTrait[];
  ambition: number;
  /** Lealdade à coroa (0–100). */
  loyalty: number;
  /** Habilidade com as armas (1–10): comando de exércitos e duelos. */
  martial: number;
  /** Povoados que ele governa (ids). */
  fiefs: string[];
  spouseId: string | null;
  /** Pai ou mãe (linhagem e herança). */
  parentId: string | null;
  /** −100..100: o que acha do Comandante. */
  opinion: number;
  memory: NobleMemory[];
  /** Onde está agora: id do povoado (no paço ou na corte). */
  at: string;
  /** No comando de um exército em campo (id do registro em `armies`). */
  armyId?: string;
  /** Preso: o reino (ou "PLAYER") que o tem na masmorra da capital. */
  captiveOf?: string;
  alive: boolean;
  deathDay?: number;
  /** Já foi apresentado ao Comandante. */
  met: boolean;
  /** O que ele mais gosta de ganhar de presente. */
  likes: Good;
  /** Última conversa e último presente do Comandante (uma por dia, um por semana). */
  lastTalk?: number;
  lastGift?: number;
}

/** Conspiração contra quem governa: nasce de um lorde ambicioso e cresce em segredo. */
export interface Plot {
  id: string;
  factionId: string;
  leaderId: string;
  members: string[];
  strength: number;
  since: number;
  /** O Comandante sabe (ouviu, leu uma carta, foi convidado) e entrou nela. */
  known: boolean;
  joined: boolean;
}

/** Guerra, cortejo, ofensa: mexe na opinião e fica guardado (só as 8 lembranças mais recentes). */
export function remember(n: Noble, day: number, text: string, delta: number): Noble {
  return {
    ...n,
    opinion: Math.max(-100, Math.min(100, Math.round(n.opinion + delta))),
    memory: [...n.memory, { day, text, delta }].slice(-8),
  };
}

/** Tipo de governante pela forma do nome do reino. */
const RULER_TITLE: [RegExp, string, string][] = [
  [/^Reino/, "Rei", "Rainha"],
  [/^Ducado/, "Duque", "Duquesa"],
  [/^Baronato/, "Barão", "Baronesa"],
  [/^Liga/, "Doge", "Dogaresa"],
  [/^Condado/, "Conde", "Condessa"],
  [/^Principado/, "Príncipe", "Princesa"],
];

export function rulerTitle(realm: string, female: boolean): string {
  const form = RULER_TITLE.find(([re]) => re.test(realm));
  if (!form) return female ? "Senhora" : "Senhor";
  return female ? form[2] : form[1];
}

/** Título de um nobre ("Rainha", "Conde", "Chanceler"...). */
export function nobleTitle(n: Noble, realm: string): string {
  switch (n.rank) {
    case "RULER":
      return rulerTitle(realm, n.female);
    case "CONSORT":
      return n.female ? `${rulerTitle(realm, true)} consorte` : `${rulerTitle(realm, false)} consorte`;
    case "HEIR":
      return n.female ? "Princesa herdeira" : "Príncipe herdeiro";
    case "CHILD":
      return n.female ? "Princesa" : "Príncipe";
    case "LORD":
      return n.tier === "BARON" ? (n.female ? "Baronesa" : "Barão") : n.female ? "Condessa" : "Conde";
    case "COURTIER":
      return n.office ? OFFICE_LABEL[n.office][n.female ? 1 : 0] : n.female ? "Dama da corte" : "Fidalgo";
    default:
      return n.female ? "Dona" : "Dom";
  }
}

/** Nome completo para diálogos e listas ("Conde Nuno, Casa de Ferrada"). */
export function nobleName(n: Noble, realm: string): string {
  return n.rank === "LORD" || n.rank === "KIN" ? `${nobleTitle(n, realm)} ${n.name}, ${n.house}` : `${nobleTitle(n, realm)} ${n.name}`;
}

export const isAdult = (n: Noble) => n.age >= KINGDOM.ADULT;

function pickTraits(r: Rng, seed?: NobleTrait): NobleTrait[] {
  const out: NobleTrait[] = seed ? [seed] : [];
  while (out.length < 2) {
    const t = r.pick(ALL_TRAITS);
    if (out.includes(t) || out.some((o) => OPPOSITE[o] === t)) continue;
    out.push(t);
  }
  return out;
}

function makeNoble(r: Rng, id: string, base: Partial<Noble> & Pick<Noble, "factionId" | "house" | "rank" | "age" | "at">, seedTrait?: NobleTrait): Noble {
  const female = base.female ?? r.chance(0.5);
  const traits = base.traits ?? pickTraits(r, seedTrait);
  const has = (t: NobleTrait) => traits.includes(t);
  return {
    id,
    name: base.name ?? firstName(r, female),
    female,
    house: base.house,
    factionId: base.factionId,
    rank: base.rank,
    office: base.office,
    tier: base.tier,
    age: base.age,
    traits,
    ambition: Math.min(100, r.int(15, 75) + (has("AMBITIOUS") ? 25 : 0)),
    loyalty: Math.max(5, Math.min(100, r.int(45, 90) - (has("ENVIOUS") ? 12 : 0) - (has("AMBITIOUS") ? 15 : 0) + (has("HONORABLE") ? 10 : 0))),
    martial: Math.max(1, Math.min(10, r.int(2, 7) + (has("BRAVE") ? 2 : 0) - (has("COWARD") ? 2 : 0))),
    fiefs: base.fiefs ?? [],
    spouseId: base.spouseId ?? null,
    parentId: base.parentId ?? null,
    opinion: 0,
    memory: [],
    at: base.at,
    alive: true,
    met: false,
    likes: NOBLE_TRAITS[traits[0]].gift,
  };
}

/** Peso de um povoado na hora de repartir feudos. */
const FIEF_ORDER: Record<SettlementKind, number> = { CAPITAL: 4, CITY: 3, FORT: 2, VILLAGE: 1 };

/**
 * Nobreza inicial de cada reino (da semente): quem governa, consorte e filhos, os lordes com os
 * feudos repartidos e os cinco oficiais da corte. Um dos governantes é sempre bem velho: o mundo
 * já começa com uma sucessão à vista.
 */
export function generateNobles(world: WorldDef, towns: readonly { id: string; name: string; kind: SettlementKind; owner: string }[]): Noble[] {
  const r = createRng(seedFromText(`nobreza-${world.seed}`));
  const out: Noble[] = [];
  world.factions.forEach((f, fi) => {
    const own = towns.filter((t) => t.owner === f.id);
    const seat = towns.find((t) => t.id === f.capitalId) ?? own[0];
    const seatId = seat?.id ?? "";
    const nid = (key: string | number) => `N${f.id}-${key}`;
    const dynasty = `Casa de ${seat?.name.split(" ")[0] ?? f.name}`;
    const female = isFemaleName(f.ruler);
    const rulerTrait: NobleTrait = f.temperament === "BELLIGERENT" ? r.pick<NobleTrait>(["BRAVE", "CRUEL", "AMBITIOUS"]) : f.temperament === "MERCANTILE" ? r.pick<NobleTrait>(["GREEDY", "CUNNING"]) : r.pick<NobleTrait>(["PIOUS", "HONORABLE"]);
    const rulerAge = fi === 0 ? r.int(62, 73) : r.int(34, 66);
    const ruler = makeNoble(r, nid("rei"), { factionId: f.id, house: dynasty, rank: "RULER", age: rulerAge, name: f.ruler, female, at: seatId, fiefs: own.filter((t) => t.id === seatId).map((t) => t.id) }, rulerTrait);
    ruler.loyalty = 100;
    out.push(ruler);
    // Consorte e filhos (um reino em cada dez não tem herdeiro: crise garantida)
    const married = r.chance(0.85);
    if (married) {
      const spouse = makeNoble(r, nid("consorte"), { factionId: f.id, house: dynasty, rank: "CONSORT", age: Math.max(20, rulerAge + r.int(-8, 4)), female: !female, spouseId: ruler.id, at: seatId });
      ruler.spouseId = spouse.id;
      out.push(spouse);
    }
    const children = married && r.chance(0.9) ? r.int(1, 3) : 0;
    const eldest = Math.max(1, Math.min(34, rulerAge - 19));
    for (let c = 0; c < children; c++) {
      const age = Math.max(1, eldest - c * r.int(2, 6) - r.int(0, 6));
      out.push(makeNoble(r, nid(`filho${c}`), { factionId: f.id, house: dynasty, rank: c === 0 ? "HEIR" : "CHILD", age, parentId: ruler.id, at: seatId }));
    }
    // Lordes: cada um com a sua casa e os seus feudos (a coroa guarda a capital)
    const fiefs = own.filter((t) => t.id !== seatId).sort((a, b) => FIEF_ORDER[b.kind] - FIEF_ORDER[a.kind]);
    const lords = Math.max(2, Math.min(4, Math.ceil(fiefs.length / 2)));
    const held: string[][] = Array.from({ length: lords }, () => []);
    fiefs.forEach((t, i) => held[i % lords].push(t.id));
    for (let l = 0; l < lords; l++) {
      const first = towns.find((t) => t.id === held[l][0]);
      const house = first ? `Casa de ${first.name.split(" ")[0]}` : `Casa de ${r.pick(["Alvor", "Monsanto", "Trancoso", "Sintrão"])}`;
      const age = r.int(24, 64);
      const lord = makeNoble(r, nid(`lorde${l}`), {
        factionId: f.id,
        house,
        rank: "LORD",
        tier: first && first.kind !== "VILLAGE" ? "COUNT" : "BARON",
        age,
        fiefs: held[l],
        at: held[l][0] ?? seatId,
      });
      out.push(lord);
      if (r.chance(0.6)) {
        const spouse = makeNoble(r, nid(`lorde${l}-par`), { factionId: f.id, house, rank: "KIN", age: Math.max(20, age + r.int(-8, 4)), female: !lord.female, spouseId: lord.id, at: lord.at });
        lord.spouseId = spouse.id;
        out.push(spouse);
      }
      if (age > 38 && r.chance(0.55)) out.push(makeNoble(r, nid(`lorde${l}-filho`), { factionId: f.id, house, rank: "KIN", age: age - r.int(18, 24), parentId: lord.id, at: lord.at }));
    }
    // Oficiais da corte: vivem na capital
    const offices: [CourtOffice, NobleTrait | undefined][] = [
      ["CHAMBERLAIN", undefined],
      ["CHANCELLOR", "SCHOLAR"],
      ["MARSHAL", "BRAVE"],
      ["SPYMASTER", "CUNNING"],
      ["PRIEST", "PIOUS"],
    ];
    for (const [office, trait] of offices) {
      out.push(makeNoble(r, nid(office.toLowerCase()), { factionId: f.id, house: dynasty, rank: "COURTIER", office, age: r.int(32, 68), at: seatId }, trait));
    }
  });
  return out;
}

/** Quem governa um reino. */
export function rulerOf(nobles: readonly Noble[], factionId: string): Noble | undefined {
  return nobles.find((n) => n.factionId === factionId && n.rank === "RULER" && n.alive);
}

export const officer = (nobles: readonly Noble[], factionId: string, office: CourtOffice) => nobles.find((n) => n.alive && n.factionId === factionId && n.office === office);

/** Lordes vivos e livres de um reino, com quem manda em algum feudo. */
export function lordsOf(nobles: readonly Noble[], factionId: string): Noble[] {
  return nobles.filter((n) => n.alive && n.factionId === factionId && n.rank === "LORD" && !n.captiveOf);
}

/** Herdeiros na ordem da sucessão: filhos vivos do governante, do mais velho ao mais novo. */
export function heirsOf(nobles: readonly Noble[], ruler: Noble): Noble[] {
  return nobles.filter((n) => n.alive && n.parentId === ruler.id).sort((a, b) => b.age - a.age);
}

/** Chance semanal de morte natural pela idade. */
export function deathChance(age: number): number {
  return KINGDOM.DEATH_BASE + Math.max(0, age - KINGDOM.DEATH_OLD_FROM) * KINGDOM.DEATH_PER_YEAR;
}

/** Sobe ao trono: ganha uma alcunha (quem já tinha fica com ela), o consorte vira consorte de verdade. */
export function crown(nobles: Noble[], heir: Noble, rng: Rng): Noble {
  const named = heir.name.includes(" ") ? heir.name : `${heir.name} ${epithet(rng, heir.female)}`;
  const crowned: Noble = { ...heir, name: named, rank: "RULER", loyalty: 100 };
  nobles[nobles.findIndex((n) => n.id === heir.id)] = crowned;
  if (crowned.spouseId) {
    const i = nobles.findIndex((n) => n.id === crowned.spouseId);
    if (i >= 0) nobles[i] = { ...nobles[i], rank: "CONSORT" };
  }
  // O filho mais velho do novo governante vira herdeiro; os filhos e o consorte do antigo viram parentes
  for (let i = 0; i < nobles.length; i++) {
    const n = nobles[i];
    if (!n.alive || n.id === crowned.id || n.factionId !== crowned.factionId) continue;
    if (n.rank === "HEIR" || n.rank === "CHILD" || (n.rank === "CONSORT" && n.id !== crowned.spouseId)) nobles[i] = { ...n, rank: "KIN" };
  }
  const first = heirsOf(nobles, crowned)[0];
  if (first) nobles[nobles.findIndex((n) => n.id === first.id)] = { ...first, rank: "HEIR" };
  return crowned;
}

/** Substitui um oficial que morreu (a corte não fica sem camareiro). */
export function replaceOfficer(nobles: Noble[], dead: Noble, day: number): Noble | null {
  if (dead.rank !== "COURTIER" || !dead.office) return null;
  const r = createRng(seedFromText(`oficial-${dead.id}-${day}`));
  const n = makeNoble(r, `${dead.id}-${day}`, { factionId: dead.factionId, house: dead.house, rank: "COURTIER", office: dead.office, age: r.int(30, 55), at: dead.at });
  nobles.push(n);
  return n;
}

/**
 * Onde um nobre está a esta hora, dentro da capital: o que preenche os prédios e as ruas. A rotina
 * sai dos traços e do cargo, e sempre dá no mesmo para o mesmo dia.
 */
export type CourtPlace = "THRONE" | "COUNCIL" | "GREAT_HALL" | "ROYAL" | "CHAPEL" | "GARDEN" | "YARD" | "FOREYARD" | "CATHEDRAL" | "MARKET" | "ARENA" | "PALACE" | "TAVERN" | "LIBRARY" | "STREET" | "DUNGEON";

export function scheduleOf(n: Noble, hour: number, day: number, feast: boolean): CourtPlace {
  if (n.captiveOf) return "DUNGEON";
  const has = (t: NobleTrait) => n.traits.includes(t);
  const lives: CourtPlace = n.rank === "LORD" || n.rank === "KIN" ? "PALACE" : "ROYAL";
  if (hour < 7 || hour >= 22) return lives;
  if (feast && hour >= 18) return "GREAT_HALL";
  if (n.rank === "RULER" || n.rank === "CONSORT") {
    if (hour < 12) return "THRONE";
    if (hour < 14) return "GREAT_HALL";
    if (n.rank === "RULER") return hour < 17 ? "COUNCIL" : has("PIOUS") ? "CHAPEL" : "GARDEN";
    return hour < 17 ? "GARDEN" : "CHAPEL";
  }
  // O Camareiro recebe no pátio, diante da Torre de Menagem: quem quer audiência fala com ele ali
  if (n.office === "CHAMBERLAIN") return hour < 19 ? "FOREYARD" : "ROYAL";
  if (n.office === "CHANCELLOR" || n.office === "MARSHAL") {
    if (hour < 12) return "THRONE";
    return hour < 18 ? "COUNCIL" : n.office === "MARSHAL" ? "YARD" : "LIBRARY";
  }
  if (n.office === "SPYMASTER") return hour < 12 ? "COUNCIL" : hour < 20 ? "TAVERN" : "COUNCIL";
  if (n.office === "PRIEST") return hour < 19 ? "CATHEDRAL" : "CHAPEL";
  if (n.age < 12) return hour < 16 ? "GARDEN" : "ROYAL";
  // O resto vai a um lugar por dia, conforme o gosto (nobres não fazem tudo todo dia)
  const roll = (day * 7 + n.id.length * 13 + Math.floor(hour / 4)) % 3;
  if (hour < 12) return n.rank === "LORD" ? "THRONE" : has("BRAVE") ? "YARD" : has("SCHOLAR") ? "LIBRARY" : "GARDEN";
  if (hour < 14) return "GREAT_HALL";
  if (hour < 19) {
    if (has("PIOUS") && roll !== 0) return "CATHEDRAL";
    if ((has("BRAVE") || has("CRUEL")) && roll !== 1) return "ARENA";
    if ((has("GREEDY") || has("GENEROUS")) && roll !== 2) return "MARKET";
    if (has("CUNNING") && roll === 0) return "TAVERN";
    if (has("ROMANTIC") && roll !== 2) return "GARDEN";
    return roll === 0 ? "MARKET" : roll === 1 ? "GARDEN" : "STREET";
  }
  return lives;
}

export const PLACE_LABEL: Record<CourtPlace, string> = {
  THRONE: "Sala do Trono",
  COUNCIL: "Sala do Conselho",
  GREAT_HALL: "Grande Salão",
  ROYAL: "Aposentos Reais",
  CHAPEL: "Capela Real",
  GARDEN: "Jardim Real",
  YARD: "Pátio de Armas",
  FOREYARD: "Pátio do Castelo",
  CATHEDRAL: "Catedral",
  MARKET: "Grande Mercado",
  ARENA: "Liça",
  PALACE: "Palácio da casa",
  TAVERN: "Taverna do Javali",
  LIBRARY: "Biblioteca Real",
  STREET: "Ruas da Cidade Alta",
  DUNGEON: "Masmorra",
};

export const RANSOM_OF = (n: Noble) => Math.round(COURT.RANSOM * (n.rank === "RULER" ? 4 : n.rank === "HEIR" || n.rank === "CONSORT" ? 2.5 : n.tier === "COUNT" ? 1.5 : 1));
