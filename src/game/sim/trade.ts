import { GOODS, GOOD_LIST, TRADE, BUILDINGS, type BuildingId, type Good } from "../../utils/constants";
import { INDUSTRIES, industriesOf, emptyStock, type Economy, type Stock } from "./market";
import { kingdomsAtWar, type KingdomWar, type Settlement } from "./realm";

/**
 * Comércio do bando (Marco 14), em funções puras: a carga nas carroças (com a origem, para o
 * contrabando, e o custo, para saber o lucro), o Livro de Preços (o que o bando sabe de cada
 * mercado e de quando é a notícia), feitorias, guildas e empréstimos.
 */

/** Lote de mercadoria nas carroças: de onde veio (reino de origem) e quanto custou cada unidade. */
export interface TradeLot {
  good: Good;
  qty: number;
  /** Povoado onde foi comprado ("LOOT" = saque; "CAMP" = do depósito). */
  from: string;
  /** Reino de origem (para o embargo); null = livre ou do bando. */
  faction: string | null;
  /** Custo médio por unidade (0 = saque). */
  cost: number;
}

export function freightWeight(lots: readonly TradeLot[]): number {
  return lots.reduce((sum, l) => sum + GOODS[l.good].weight * l.qty, 0);
}

export function freightOf(lots: readonly TradeLot[], g: Good): number {
  return lots.filter((l) => l.good === g).reduce((sum, l) => sum + l.qty, 0);
}

/** Junta um lote à carga (mesmo bem e mesma origem viram um só, com custo médio). */
export function addLot(lots: readonly TradeLot[], lot: TradeLot): TradeLot[] {
  if (lot.qty <= 0) return [...lots];
  const same = lots.find((l) => l.good === lot.good && l.faction === lot.faction && l.from === lot.from);
  if (!same) return [...lots, { ...lot }];
  const qty = same.qty + lot.qty;
  return lots.map((l) => (l === same ? { ...l, qty, cost: (l.cost * l.qty + lot.cost * lot.qty) / qty } : l));
}

/**
 * Tira `qty` de um bem da carga, os lotes mais baratos primeiro (ou só os de um reino).
 * Devolve a carga nova e os pedaços tirados.
 */
export function takeLots(lots: readonly TradeLot[], g: Good, qty: number, only?: (l: TradeLot) => boolean): { lots: TradeLot[]; taken: TradeLot[] } {
  let left = qty;
  const taken: TradeLot[] = [];
  const order = lots.filter((l) => l.good === g && (!only || only(l))).sort((a, b) => a.cost - b.cost);
  const out = lots.map((l) => ({ ...l }));
  for (const lot of order) {
    if (left <= 0) break;
    const target = out.find((l) => l.good === lot.good && l.from === lot.from && l.faction === lot.faction);
    if (!target) continue;
    const n = Math.min(left, target.qty);
    target.qty -= n;
    left -= n;
    taken.push({ ...lot, qty: n });
  }
  return { lots: out.filter((l) => l.qty > 0), taken };
}

/** Vender aqui é contrabando? (a carga vem de um reino em guerra com o dono do povoado) */
export function isContraband(lot: TradeLot, town: Settlement, wars: readonly KingdomWar[]): boolean {
  return !!lot.faction && /^F\d+$/.test(town.owner) && lot.faction !== town.owner && kingdomsAtWar(wars, lot.faction, town.owner);
}

// --- Livro de Preços ---

export type NoteSource = "VISIT" | "TRAVELER" | "TAVERN" | "POST" | "CARAVAN" | "COURIER";

export const NOTE_SOURCE_LABEL: Record<NoteSource, string> = {
  VISIT: "visto pelo Comandante",
  TRAVELER: "contado por viajantes",
  TAVERN: "ouvido na taverna",
  POST: "carta da feitoria",
  CARAVAN: "contado por mercadores",
  COURIER: "despachos interceptados",
};

/** O que o bando sabe de um mercado num certo dia. */
export interface PriceNote {
  day: number;
  prices: Stock;
  /** Estoque aproximado (os mercadores exageram: arredondado). */
  stock: Stock;
  source: NoteSource;
}

export function noteOf(econ: Economy, day: number, source: NoteSource): PriceNote {
  const prices = emptyStock();
  const stock = emptyStock();
  for (const g of GOOD_LIST) {
    prices[g] = Math.round(econ.price[g] * 10) / 10;
    stock[g] = Math.round(econ.stock[g]);
  }
  return { day, prices, stock, source };
}

/** Anota uma observação no Livro (a mais nova por último; notícia velha não substitui uma nova). */
export function addNote(book: Record<string, PriceNote[]>, id: string, note: PriceNote): Record<string, PriceNote[]> {
  const list = book[id] ?? [];
  const last = list[list.length - 1];
  if (last && last.day > note.day) return book;
  const kept = last && last.day === note.day ? list.slice(0, -1) : list;
  return { ...book, [id]: [...kept, note].slice(-TRADE.BOOK_HISTORY) };
}

export function latestNote(book: Record<string, PriceNote[]>, id: string): PriceNote | null {
  const list = book[id];
  return list && list.length > 0 ? list[list.length - 1] : null;
}

// --- Guildas (investimentos) ---

export interface GuildStake {
  settlementId: string;
  building: BuildingId;
  invested: number;
  since: number;
  /** Dividendos já recebidos. */
  paid: number;
}

/** Oficinas em que o bando pode investir (as que produzem bens). */
export const GUILD_BUILDINGS: readonly BuildingId[] = ["FARM", "MINE", "SAWMILL", "SALTWORKS", "WEAVERY", "PASTURE", "MILL", "PORT"];

/** A oficina pode ser construída neste povoado (recurso, rio ou mar)? */
export function canHost(t: Pick<Settlement, "resources" | "river" | "port">, b: BuildingId): boolean {
  const need = BUILDINGS[b].needs;
  if (!need) return true;
  if (need === "RIVER") return !!t.river;
  if (need === "PORT") return !!t.port;
  if (need === "SALT") return !!t.port || (t.resources ?? []).includes("SALT");
  return (t.resources ?? []).includes(need);
}

/**
 * Dividendos semanais de uma participação: o lucro que a oficina acrescenta ao povoado
 * (o que ela produz a mais, a preço de mercado, menos os insumos) vezes a parte do bando.
 */
export function stakeDividend(t: Settlement, stake: GuildStake): number {
  const with_ = industriesOf(t);
  const without = industriesOf({ ...t, buildings: t.buildings.filter((b) => b !== stake.building) });
  const work = 0.5 + t.prosperity / 200;
  let value = 0;
  for (const ind of with_) {
    const before = without.find((x) => x.id === ind.id)?.level ?? 0;
    const extra = ind.level - before;
    if (extra <= 0) continue;
    const def = INDUSTRIES[ind.id];
    for (const [g, v] of Object.entries(def.outputs) as [Good, number][]) value += v * extra * work * t.econ.price[g];
    for (const [g, v] of Object.entries(def.inputs) as [Good, number][]) value -= v * extra * work * t.econ.price[g];
  }
  return Math.max(0, Math.round(value * 7 * TRADE.GUILD_SHARE));
}

// --- Empréstimos ---

export interface Loan {
  id: string;
  /** Cidade da casa de câmbio (o reino dela cobra a dívida). */
  from: string;
  principal: number;
  /** Juros por semana. */
  interest: number;
  dueDay: number;
  /** Semanas de juros não pagos. */
  missed: number;
}

// --- Caravanas próprias ---

export interface OwnCaravan {
  id: string;
  name: string;
  /** Os dois mercados da rota (vai e volta entre eles). */
  a: string;
  b: string;
  /** Viagens feitas e lucro acumulado. */
  trips: number;
  profit: number;
  /** Onde ela está parada agora (a próxima viagem sai daqui); sem valor, sai de `a`. */
  at?: string;
  /** Destruída por saqueadores (fica na lista para a notícia; some na semana seguinte). */
  lost?: number;
}
