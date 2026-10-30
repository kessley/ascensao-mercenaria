import { GOODS, GOOD_LIST, MARKET, CARAVAN, TRADE, type BuildingId, type Good, type Need, type Season } from "../../utils/constants";
import type { ResourceId, SettlementKind } from "../data/world";

/**
 * Economia dos povoados (Marco 14), em funções puras. Inspirada no Victoria 3, em escala de
 * greybox: cada povoado tem gente de três camadas (camponeses, burgueses e nobres) com
 * necessidades, oficinas que transformam bens (a armaria gasta ferro e madeira e faz armas) e
 * um mercado com estoque. O preço de cada bem vem da procura e do estoque; o nível de vida
 * (quanto das necessidades foi atendido) faz o povoado prosperar ou passar fome. As
 * caravanas levam bens de onde estão baratos para onde estão caros.
 */

export type Stock = Record<Good, number>;

export const emptyStock = (): Stock => Object.fromEntries(GOOD_LIST.map((g) => [g, 0])) as Stock;

export interface Economy {
  stock: Stock;
  /** Preço de agora (ouro por unidade). */
  price: Stock;
  /** Procura de referência (procura diária × dias + folga): o preço sai dela e do estoque. */
  want: Stock;
  /** Preços a cada 2 dias (os últimos MARKET.HISTORY). */
  history: Record<Good, number[]>;
  /** Nível de vida (0–100): quanto das necessidades a gente conseguiu comprar. */
  sol: number;
  /** Agitação (0–100), nos povoados do bando: em 100, revolta. */
  unrest: number;
  famine: boolean;
  /** Produzido e consumido ontem (o painel do mercado mostra). */
  made: Stock;
  used: Stock;
  /** Revolta (povoado do bando): não paga impostos até este dia. */
  revoltUntil: number;
}

/** O que a economia precisa saber de um povoado (o `Settlement` do reino tem tudo isso). */
export interface EconTown {
  kind: SettlementKind;
  population: number;
  prosperity: number;
  garrison: number;
  buildings: readonly BuildingId[];
  resources?: readonly ResourceId[];
  port?: boolean;
  river?: boolean;
  /** Parte da gente convocada para a guerra (Marco 15): faltam braços no campo. */
  levy?: number;
}

/** O que muda o mercado do dia (estação, guerra, calamidade por perto, tempestade no porto). */
export interface MarketContext {
  season: Season;
  atWar: boolean;
  hoard: boolean;
  storm: boolean;
  /** Dia (o histórico guarda um preço a cada 2 dias). */
  day: number;
}

export type IndustryId =
  | "FARMS"
  | "PASTURE"
  | "FISHERY"
  | "SALTWORKS"
  | "LOGGING"
  | "MINE"
  | "WEAVERY"
  | "BREWERY"
  | "ARMORY"
  | "STUD"
  | "HERBALIST"
  | "TRAPPERS"
  | "PORT";

/** Oficinas: o que cada nível gasta e produz por dia. As lavouras seguem a estação. */
export const INDUSTRIES: Record<IndustryId, { label: string; inputs: Partial<Stock>; outputs: Partial<Stock>; harvest?: boolean }> = {
  FARMS: { label: "Lavouras", inputs: {}, outputs: { GRAIN: 1.4 }, harvest: true },
  PASTURE: { label: "Pastagens", inputs: {}, outputs: { MEAT: 0.6 } },
  FISHERY: { label: "Pesca", inputs: {}, outputs: { MEAT: 0.8 } },
  SALTWORKS: { label: "Salina", inputs: {}, outputs: { SALT: 1.6 } },
  LOGGING: { label: "Lenhadores", inputs: {}, outputs: { WOOD: 1.6 } },
  MINE: { label: "Mina", inputs: {}, outputs: { IRON: 3.5 } },
  WEAVERY: { label: "Tecelagem", inputs: { MEAT: 0.15 }, outputs: { CLOTH: 0.8 } },
  BREWERY: { label: "Cervejaria", inputs: { GRAIN: 0.5 }, outputs: { ALE: 1.3 } },
  ARMORY: { label: "Armaria", inputs: { IRON: 1.2, WOOD: 0.4 }, outputs: { ARMS: 0.45 } },
  STUD: { label: "Haras", inputs: {}, outputs: { HORSES: 0.2 } },
  HERBALIST: { label: "Ervanários", inputs: {}, outputs: { LUXURY: 0.12 } },
  TRAPPERS: { label: "Caçadores de peles", inputs: {}, outputs: { CLOTH: 0.3, LUXURY: 0.08 } },
  PORT: { label: "Porto", inputs: {}, outputs: { LUXURY: 0.2, SALT: 0.35 } },
};

export function strata(t: EconTown): { peasants: number; burghers: number; nobles: number } {
  const s = MARKET.STRATA[t.kind];
  return { peasants: t.population * s.peasants * (1 - (t.levy ?? 0)), burghers: t.population * s.burghers, nobles: t.population * s.nobles };
}

/** Oficinas de um povoado e o tamanho de cada uma (pela gente, pela terra e pelas construções). */
export function industriesOf(t: EconTown): { id: IndustryId; level: number }[] {
  const has = (b: BuildingId) => t.buildings.includes(b);
  const res = (r: ResourceId) => (t.resources ?? []).includes(r);
  const { peasants, burghers } = strata(t);
  const list: [IndustryId, number][] = [
    ["FARMS", ((peasants / 100) * (res("GRAIN") ? 1.6 : 1) + (has("FARM") ? 1.5 : 0)) * (has("MILL") ? 1.25 : 1)],
    ["PASTURE", peasants / 220 + (res("HORSES") ? 1.5 : 0) + (has("PASTURE") ? 1.5 : 0)],
    ["FISHERY", (res("FISH") ? 1.5 : 0) + (t.port ? 0.5 : 0)],
    ["SALTWORKS", (res("SALT") ? 1.5 : 0) + (has("SALTWORKS") ? 1.5 : 0)],
    ["LOGGING", 0.3 + (res("WOOD") ? 1.5 : 0) + (has("SAWMILL") ? 1.5 : 0)],
    ["MINE", (res("IRON") ? 1.5 : 0) + (has("MINE") ? (res("IRON") ? 1.5 : 0.75) : 0)],
    ["WEAVERY", burghers / 150 + (res("FURS") ? 0.5 : 0) + (has("WEAVERY") ? 1.5 : 0)],
    ["BREWERY", burghers / 120 + (has("MILL") ? 0.5 : 0)],
    ["ARMORY", (t.kind === "CITY" ? 1.2 : t.kind === "CAPITAL" ? 2 : t.kind === "FORT" ? 1.5 : 0) + (has("BARRACKS") ? 0.5 : 0)],
    ["STUD", (res("HORSES") ? 1.2 : 0) + (has("PASTURE") && res("HORSES") ? 0.8 : 0)],
    ["HERBALIST", res("HERBS") ? 1.2 : 0],
    ["TRAPPERS", res("FURS") ? 1.2 : 0],
    ["PORT", t.port ? 1 + (has("PORT") ? 1.5 : 0) : 0],
  ];
  return list.filter(([, level]) => level > 0.01).map(([id, level]) => ({ id, level }));
}

/** Procura diária de cada necessidade (gente, guarnição, guerra, inverno, calamidade). */
export function needsOf(t: EconTown, ctx: Pick<MarketContext, "season" | "atWar" | "hoard">): Partial<Record<Need, number>> {
  const out: Partial<Record<Need, number>> = {};
  const add = (n: Need, v: number) => (out[n] = (out[n] ?? 0) + v);
  const groups = strata(t);
  for (const key of ["peasants", "burghers", "nobles"] as const) {
    for (const [n, per100] of Object.entries(MARKET.NEEDS[key]) as [Need, number][]) add(n, (groups[key] / 100) * per100);
  }
  for (const [n, per] of Object.entries(MARKET.GARRISON) as [Need, number][]) add(n, t.garrison * per);
  if (ctx.atWar) for (const [n, mult] of Object.entries(MARKET.WAR_DEMAND) as [Need, number][]) out[n] = (out[n] ?? 0) * mult;
  if (ctx.hoard) out.FOOD = (out.FOOD ?? 0) * MARKET.HOARD_FOOD;
  if (ctx.season === "WINTER") out.WOOD = (out.WOOD ?? 0) * MARKET.WINTER_WOOD;
  return out;
}

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

/** Preço de referência para um estoque (o preço de agora anda até ele). */
export function targetPrice(g: Good, stock: number, want: number): number {
  return GOODS[g].base * clamp(want / (Math.max(0, stock) + 2), MARKET.MIN_PRICE, MARKET.MAX_PRICE);
}

/** Procura de referência de cada bem: a comida divide-se entre grão e carne; as oficinas também compram. */
function wantOf(t: EconTown, needs: Partial<Record<Need, number>>): Stock {
  const daily = emptyStock();
  for (const g of GOOD_LIST) daily[g] = needs[g] ?? 0;
  daily.GRAIN += (needs.FOOD ?? 0) * 0.65;
  daily.MEAT += (needs.FOOD ?? 0) * 0.35;
  for (const ind of industriesOf(t)) {
    for (const [g, v] of Object.entries(INDUSTRIES[ind.id].inputs) as [Good, number][]) daily[g] += v * ind.level;
  }
  const want = emptyStock();
  for (const g of GOOD_LIST) want[g] = daily[g] * MARKET.DEMAND_DAYS + 2;
  return want;
}

/** Mercado novo de um povoado: estoque de algumas semanas e preços de equilíbrio. */
export function initEconomy(t: EconTown): Economy {
  const ctx = { season: "SPRING" as Season, atWar: false, hoard: false };
  const needs = needsOf(t, ctx);
  const want = wantOf(t, needs);
  const made = dailyOutput(t, "SUMMER");
  const stock = emptyStock();
  const price = emptyStock();
  const history = {} as Record<Good, number[]>;
  for (const g of GOOD_LIST) {
    const daily = (want[g] - 2) / MARKET.DEMAND_DAYS;
    stock[g] = Math.round((daily * MARKET.START_DAYS + made[g] * 4) * 10) / 10;
    price[g] = round1(targetPrice(g, stock[g], want[g]));
    history[g] = [Math.round(price[g])];
  }
  return { stock, price, want, history, sol: 70, unrest: 0, famine: false, made, used: emptyStock(), revoltUntil: 0 };
}

/** Produção sem falta de insumos (para o estoque inicial e o painel). */
function dailyOutput(t: EconTown, season: Season): Stock {
  const out = emptyStock();
  const work = 0.5 + t.prosperity / 200;
  for (const ind of industriesOf(t)) {
    const def = INDUSTRIES[ind.id];
    const k = ind.level * work * (def.harvest ? MARKET.HARVEST[season] : 1);
    for (const [g, v] of Object.entries(def.outputs) as [Good, number][]) out[g] += v * k;
  }
  return out;
}

const round1 = (v: number) => Math.round(v * 10) / 10;

/**
 * Um dia do mercado de um povoado: as oficinas produzem (se tiverem os insumos), a gente
 * compra o que precisa (a comida mais barata primeiro), a comida estraga, o excesso sai para
 * longe e os preços andam rumo à oferta e à procura. Devolve a economia nova e o nível de
 * vida (com a fome) para o reino aplicar na prosperidade e na população.
 */
export function marketDay(t: EconTown, econ: Economy, ctx: MarketContext): Economy {
  const stock = { ...econ.stock };
  const made = emptyStock();
  const used = emptyStock();
  const work = 0.5 + t.prosperity / 200;

  // 1. Oficinas: cada uma produz na proporção do insumo que achou
  for (const ind of industriesOf(t)) {
    const def = INDUSTRIES[ind.id];
    // Tempestade: o porto fica parado
    if (ind.id === "PORT" && ctx.storm) continue;
    // Oficina que vende barato produz menos (a gente vai fazer outra coisa); vendendo caro, contrata
    const main = Object.keys(def.outputs)[0] as Good;
    const elastic = Math.max(MARKET.ELASTIC[0], Math.min(MARKET.ELASTIC[1], 0.35 + 0.65 * (econ.price[main] / GOODS[main].base)));
    const k = ind.level * work * elastic * (def.harvest ? MARKET.HARVEST[ctx.season] : 1);
    let f = 1;
    for (const [g, v] of Object.entries(def.inputs) as [Good, number][]) f = Math.min(f, stock[g] / Math.max(0.001, v * k));
    f = clamp(f, 0, 1);
    for (const [g, v] of Object.entries(def.inputs) as [Good, number][]) {
      stock[g] -= v * k * f;
      used[g] += v * k * f;
    }
    for (const [g, v] of Object.entries(def.outputs) as [Good, number][]) {
      stock[g] += v * k * f;
      made[g] += v * k * f;
    }
  }

  // 2. A gente compra o que precisa
  const needs = needsOf(t, ctx);
  const satisfied: Partial<Record<Need, number>> = {};
  for (const [n, need] of Object.entries(needs) as [Need, number][]) {
    if (need <= 0) continue;
    if (n === "FOOD") {
      let left = need;
      const order: Good[] = econ.price.GRAIN <= econ.price.MEAT ? ["GRAIN", "MEAT"] : ["MEAT", "GRAIN"];
      for (const g of order) {
        const take = Math.min(left, Math.max(0, stock[g]));
        stock[g] -= take;
        used[g] += take;
        left -= take;
      }
      satisfied.FOOD = 1 - left / need;
      continue;
    }
    const take = Math.min(need, Math.max(0, stock[n]));
    stock[n] -= take;
    used[n] += take;
    satisfied[n] = take / need;
  }

  // 3. Nível de vida: média ponderada do que foi atendido
  let w = 0;
  let sum = 0;
  for (const [n, weight] of Object.entries(MARKET.SOL_WEIGHT) as [Need, number][]) {
    if (satisfied[n] === undefined) continue;
    w += weight;
    sum += weight * (satisfied[n] ?? 0);
  }
  const sol = w > 0 ? Math.round((sum / w) * 100) : 70;
  const famine = (satisfied.FOOD ?? 1) < MARKET.FAMINE_BELOW;

  // 4. Comida estraga (o sal conserva a carne); o que passa do teto vai para longe
  const want = wantOf(t, needs);
  for (const g of GOOD_LIST) {
    const decay = g === "MEAT" && stock.SALT > 5 ? MARKET.SALTED_MEAT_DECAY : (MARKET.DECAY[g] ?? 0);
    stock[g] = Math.max(0, stock[g] * (1 - decay));
    const daily = (want[g] - 2) / MARKET.DEMAND_DAYS;
    const cap = MARKET.CAP_BASE + daily * MARKET.CAP_DAYS + made[g] * MARKET.CAP_PRODUCTION_DAYS;
    stock[g] = round1(Math.min(stock[g], cap));
  }

  // 5. Preços andam rumo à oferta e à procura; a cada 2 dias, uma amostra para o histórico
  const price = emptyStock();
  const history = { ...econ.history };
  for (const g of GOOD_LIST) {
    const target = targetPrice(g, stock[g], want[g]);
    price[g] = round1(econ.price[g] + (target - econ.price[g]) * MARKET.PRICE_SMOOTHING);
    if (ctx.day % 2 === 0) history[g] = [...(econ.history[g] ?? []), Math.round(price[g] * 10) / 10].slice(-MARKET.HISTORY);
  }
  return { ...econ, stock, price, want, history, sol, famine, made, used };
}

/**
 * Preço total de comprar (ou vender) `qty` unidades, unidade a unidade: cada compra tira do
 * estoque e encarece a próxima; cada venda barateia. Devolve o total e o preço depois.
 */
export function quote(econ: Economy, g: Good, qty: number, side: "BUY" | "SELL", margin = 0): { total: number; after: number; unit: number } {
  const ref = targetPrice(g, econ.stock[g], econ.want[g]);
  let total = 0;
  let stock = econ.stock[g];
  for (let i = 0; i < qty; i++) {
    const p = econ.price[g] * (targetPrice(g, stock, econ.want[g]) / ref);
    total += side === "BUY" ? p * (MARKET.BUY_MARKUP - margin) : p * (MARKET.SELL_MARKDOWN + margin);
    stock += side === "BUY" ? -1 : 1;
  }
  const after = econ.price[g] * (targetPrice(g, stock, econ.want[g]) / ref);
  return { total: Math.round(total), after: round1(after), unit: qty > 0 ? total / qty : econ.price[g] };
}

/** Aplica uma compra ou venda no mercado (o estoque muda e o preço anda na hora). */
export function applyTrade(econ: Economy, g: Good, qty: number, side: "BUY" | "SELL"): Economy {
  const q = quote(econ, g, qty, side);
  const stock = { ...econ.stock, [g]: round1(Math.max(0, econ.stock[g] + (side === "BUY" ? -qty : qty))) };
  return { ...econ, stock, price: { ...econ.price, [g]: q.after } };
}

/** Uma unidade de comida (grão ou carne, a mais barata) vira 10 rações; o pacote custa a preparação. */
export function foodGood(econ: Economy): Good {
  if (econ.stock.GRAIN < 1 && econ.stock.MEAT >= 1) return "MEAT";
  if (econ.stock.MEAT < 1) return "GRAIN";
  return econ.price.GRAIN <= econ.price.MEAT ? "GRAIN" : "MEAT";
}

/** Pacote de rações (10) num mercado: o preço da comida mais barata, mais moagem e embalagem. */
export function rationPackPrice(econ: Economy): number {
  const g = foodGood(econ);
  return Math.max(2, Math.round(quote(econ, g, 1, "BUY").total * 1.4));
}

// --- Comércio miúdo entre vizinhos ---

/**
 * Mascates, carroceiros e camponeses que vendem na feira do vizinho (não aparecem no mapa):
 * entre povoados próximos, um pouco de cada bem passa de onde está barato para onde está
 * caro, todo dia. Aplaina os preços de uma região; as diferenças grandes, de longe, ficam
 * para as caravanas (e para o bando). Reinos em guerra não trocam nada.
 */
export function diffuse(econs: Economy[], pairs: readonly [number, number][], blocked: (a: number, b: number) => boolean): void {
  for (const [a, b] of pairs) {
    if (blocked(a, b)) continue;
    const ea = econs[a];
    const eb = econs[b];
    for (const g of GOOD_LIST) {
      const pa = ea.price[g];
      const pb = eb.price[g];
      if (pa <= 0 || pb <= 0) continue;
      const [from, to] = pa < pb ? [ea, eb] : [eb, ea];
      const ratio = Math.max(pa, pb) / Math.min(pa, pb);
      if (ratio < 1.25) continue;
      const qty = Math.min(from.stock[g] * MARKET.DIFFUSION * Math.min(3, ratio - 1), from.stock[g] * 0.1);
      if (qty < 0.05) continue;
      from.stock[g] = round1(from.stock[g] - qty);
      to.stock[g] = round1(to.stock[g] + qty);
    }
  }
}

// --- Caravanas ---

export interface TradePlan {
  good: Good;
  qty: number;
  /** Preço médio de compra na origem e de venda no destino. */
  buy: number;
  sell: number;
  profit: number;
}

/**
 * O melhor negócio entre dois mercados para uma caravana: o bem com mais lucro, contando que
 * comprar encarece a origem e vender barateia o destino, e o custo dos dias de estrada.
 */
export function bestTrade(from: Economy, to: Economy, days: number, capacity: number = CARAVAN.CAPACITY, minProfit: number = CARAVAN.MIN_PROFIT): TradePlan | null {
  let best: TradePlan | null = null;
  for (const g of GOOD_LIST) {
    const w = GOODS[g].weight;
    const maxQty = Math.floor(Math.min(from.stock[g] * 0.5, w > 0 ? capacity / w : 6));
    if (maxQty < 1) continue;
    for (const qty of [maxQty, Math.ceil(maxQty / 2), Math.ceil(maxQty / 4)]) {
      const buy = quote(from, g, qty, "BUY").total;
      const sell = quote(to, g, qty, "SELL").total;
      const profit = sell - buy - CARAVAN.COST_PER_DAY * days;
      if (!best || profit > best.profit) best = { good: g, qty, buy: buy / qty, sell: sell / qty, profit };
    }
  }
  return best && best.profit >= minProfit ? best : null;
}

/** Peso de uma carga. */
export function cargoWeight(lots: readonly { good: Good; qty: number }[]): number {
  return lots.reduce((sum, l) => sum + GOODS[l.good].weight * l.qty, 0);
}

/** Rações que uma unidade de grão ou carne rende. */
export const RATIONS_PER_FOOD = TRADE.RATIONS_PER_FOOD;
