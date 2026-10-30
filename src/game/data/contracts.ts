import { travelDaysBetween, type SiteTheme, type WorldDef } from "./world";
import { distance, type Point } from "../../utils/math";
import { GOODS, type Good } from "../../utils/constants";
import type { Economy } from "../sim/market";
import { roadGraphOf } from "../sim/roadGraph";

export type Difficulty = 1 | 2 | 3;

/**
 * Tipos de contrato: limpar um local (o clássico) e, desde o Marco 14, os da economia:
 * entregar mercadoria em falta, escoltar uma caravana, recuperar carga roubada por goblins e
 * sabotar o comércio de um reino inimigo do cliente.
 */
export type ContractKind = "SITE" | "DELIVERY" | "ESCORT" | "RECOVER" | "SABOTAGE";

/** Oferta de trabalho na mesa estratégica: um povoado contrata o bando. */
export interface Contract {
  id: string;
  kind?: ContractKind;
  title: string;
  /** Quem paga (ex.: "Aldeia de Ferrada", "Senhor de Cinzal"). */
  client: string;
  /** Povoado contratante (a relação com o reino dele melhora ao cumprir). */
  clientId: string;
  description: string;
  /** Local a limpar ("" nos contratos da economia). */
  siteId: string;
  difficulty: Difficulty;
  /** Dias de marcha estimados do acampamento até o local. */
  travelDays: number;
  /** Pago ao aceitar. */
  advance: number;
  /** Pago só na vitória. */
  reward: number;
  /** Entrega e recuperação: o bem e a quantidade. */
  good?: Good;
  qty?: number;
  /** Escolta: de onde a caravana sai e aonde vai. */
  fromId?: string;
  targetId?: string;
  /** Recuperação: o bando goblin que leva a carga. */
  bandId?: string;
  /** Sabotagem: o reino cujas caravanas o cliente quer ver queimadas, e quantas. */
  factionTarget?: string;
  need?: number;
}

/** O que os contratos da economia precisam saber do mundo vivo. */
export interface EconomyContext {
  settlements: readonly (ClientSettlement & { econ: Economy })[];
  wars: readonly { a: string; b: string; peace?: number }[];
  stolenCargo: readonly { bandId: string; bandName: string; good: Good; qty: number; townId: string; day: number }[];
  factionName: (id: string) => string;
}

export const DIFFICULTY: Record<Difficulty, { label: string; enemyMultiplier: number; advance: number; reward: number }> = {
  1: { label: "Fácil", enemyMultiplier: 0.7, advance: 20, reward: 70 },
  2: { label: "Média", enemyMultiplier: 1, advance: 30, reward: 110 },
  3: { label: "Difícil", enemyMultiplier: 1.4, advance: 45, reward: 170 },
};

const TEMPLATES: Record<SiteTheme, { title: string; description: string }[]> = {
  GOBLIN_NEST: [
    { title: "Limpar o ninho goblin", description: "Um bando goblin saqueia as colheitas. Acabem com o ninho." },
    { title: "Resgatar a caravana", description: "Goblins cercaram uma caravana perto das colinas." },
  ],
  BANDIT_CAMP: [
    { title: "Acabar com os salteadores", description: "Bandidos cobram pedágio na estrada e enforcam quem não paga." },
    { title: "Recuperar o tributo roubado", description: "O tributo do senhor foi roubado por desertores escondidos na mata." },
  ],
  HAUNTED_RUINS: [
    { title: "Purificar as ruínas", description: "Os mortos das ruínas antigas voltaram a andar à noite." },
    { title: "Escoltar o abade às ruínas", description: "Um abade precisa rezar entre os ossos; os ossos discordam." },
  ],
  SWAMP_FORD: [
    { title: "Tomar o vau do pântano", description: "Goblins controlam a única travessia do pântano." },
    { title: "Expulsar os saqueadores do vau", description: "Arqueiros goblins atiram de uma colina além do vau." },
  ],
};

/** Povoado que pode contratar (o estado vivo do store: dono, posição...). */
export interface ClientSettlement {
  id: string;
  name: string;
  kind: "VILLAGE" | "CITY" | "FORT";
  x: number;
  y: number;
  owner: string;
}

const CLIENT_FORM: Record<ClientSettlement["kind"], string[]> = {
  VILLAGE: ["Aldeia de", "Liga dos Lavradores de"],
  CITY: ["Guilda dos Mercadores de", "Conselho de", "Abadia de"],
  FORT: ["Senhor de", "Barão de"],
};

const pick = <T>(list: readonly T[]): T => list[Math.floor(Math.random() * list.length)];

/**
 * Novo contrato: um povoado que não esteja em guerra com o bando contrata a limpeza de um
 * local, de preferência perto dele. `from` = onde o bando está (estimativa da marcha).
 */
export function generateContract(world: WorldDef, clients: readonly ClientSettlement[], from: Point, econ?: EconomyContext): Contract | null {
  if (clients.length === 0 || world.sites.length === 0) return null;
  // Marco 14: quase metade das ofertas nasce da economia (falta de um bem, caravanas, guerras)
  if (econ && Math.random() < 0.45) {
    const c = economicContract(world, clients, from, econ);
    if (c) return c;
  }
  // O continente é grande: quase sempre quem contrata são os vizinhos; às vezes, um cliente distante
  const nearby = [...clients].sort((a, b) => distance(a, from) - distance(b, from)).slice(0, 6);
  const client = Math.random() < 0.75 ? pick(nearby) : pick(clients);
  const sites = [...world.sites].sort((a, b) => travelDaysBetween(a.center, client) - travelDaysBetween(b.center, client));
  const site = pick(sites.slice(0, 3));
  const template = pick(TEMPLATES[site.theme]);
  const difficulty = pick([1, 2, 2, 3] as const);
  const d = DIFFICULTY[difficulty];
  const travelDays = Math.max(1, Math.ceil(travelDaysBetween(from, site.center)));
  const jitter = () => 0.9 + Math.random() * 0.2;
  return {
    id: crypto.randomUUID(),
    title: template.title,
    client: `${pick(CLIENT_FORM[client.kind])} ${client.name}`,
    clientId: client.id,
    description: template.description,
    siteId: site.id,
    difficulty,
    travelDays,
    advance: Math.round(d.advance * jitter()),
    reward: Math.round(d.reward * jitter() * (1 + Math.max(0, travelDays - 2) * 0.1)),
  };
}

/** Quanto de um bem cabe numa entrega de duas carroças (os cavalos vão a pé). */
function deliveryQty(g: Good): number {
  const w = GOODS[g].weight;
  return w > 0 ? Math.max(3, Math.round(80 / w)) : 4;
}

/** Contratos que nascem da economia: o que falta num povoado, caravanas, carga roubada e guerras. */
function economicContract(world: WorldDef, clients: readonly ClientSettlement[], from: Point, econ: EconomyContext): Contract | null {
  const ids = new Set(clients.map((c) => c.id));
  const towns = econ.settlements.filter((t) => ids.has(t.id));
  const nearby = [...towns].sort((a, b) => distance(a, from) - distance(b, from)).slice(0, 8);
  const days = (p: Point) => Math.max(1, Math.ceil(travelDaysBetween(from, p)));
  const jitter = () => 0.9 + Math.random() * 0.2;
  const kinds = ["DELIVERY", "ESCORT", "RECOVER", "SABOTAGE"] as const;
  const order = [...kinds].sort(() => Math.random() - 0.5);
  for (const kind of order) {
    if (kind === "DELIVERY") {
      // Um povoado com falta de algum bem (preço lá em cima) paga bem por uma entrega
      const short: { t: (typeof towns)[number]; g: Good; ratio: number }[] = [];
      for (const t of nearby) {
        for (const g of Object.keys(GOODS) as Good[]) {
          const ratio = t.econ.price[g] / GOODS[g].base;
          if (ratio >= 1.8 && g !== "LUXURY") short.push({ t, g, ratio });
        }
      }
      if (short.length === 0) continue;
      const pickd = short.sort((a, b) => b.ratio - a.ratio)[Math.floor(Math.random() * Math.min(3, short.length))];
      const qty = deliveryQty(pickd.g);
      const d = days(pickd.t);
      return {
        id: crypto.randomUUID(),
        kind: "DELIVERY",
        title: `Entregar ${GOODS[pickd.g].label.toLowerCase()} em ${pickd.t.name}`,
        client: `${pick(CLIENT_FORM[pickd.t.kind])} ${pickd.t.name}`,
        clientId: pickd.t.id,
        description: `Falta ${GOODS[pickd.g].label.toLowerCase()} em ${pickd.t.name} (o preço está ${pickd.ratio.toFixed(1)}× o normal). Tragam ${qty} até o prazo — comprem onde estiver barato.`,
        siteId: "",
        difficulty: 1,
        travelDays: d,
        advance: Math.round(15 * jitter()),
        reward: Math.round((qty * GOODS[pickd.g].base * 2.2 + 40) * jitter()),
        good: pickd.g,
        qty,
        targetId: pickd.t.id,
      };
    }
    if (kind === "ESCORT") {
      // Uma guilda quer a caravana dela escoltada até outro mercado pela estrada
      const roads = roadGraphOf(world);
      const origin = nearby.filter((t) => t.kind !== "VILLAGE" || t.econ.sol > 50)[Math.floor(Math.random() * Math.min(4, nearby.length))];
      if (!origin) continue;
      const dests = roads.reachable(origin.id, 3).filter((r) => r.days >= 0.8 && ids.has(r.id));
      if (dests.length === 0) continue;
      const dest = dests[Math.floor(Math.random() * dests.length)];
      const target = towns.find((t) => t.id === dest.id);
      if (!target) continue;
      const difficulty: Difficulty = dest.days > 2 ? 3 : dest.days > 1.4 ? 2 : 1;
      return {
        id: crypto.randomUUID(),
        kind: "ESCORT",
        title: `Escoltar a caravana até ${target.name}`,
        client: `Guilda dos Mercadores de ${origin.name}`,
        clientId: origin.id,
        description: `A caravana espera o bando no portão de ${origin.name} e só parte com a escolta. A estrada até ${target.name} (${dest.days.toFixed(1)} dias) anda infestada.`,
        siteId: "",
        difficulty,
        travelDays: days(origin) + Math.ceil(dest.days),
        advance: Math.round(20 * jitter()),
        reward: Math.round((80 + dest.days * 45) * jitter()),
        fromId: origin.id,
        targetId: target.id,
      };
    }
    if (kind === "RECOVER") {
      const lost = econ.stolenCargo.filter((s) => ids.has(s.townId));
      if (lost.length === 0) continue;
      const s = lost[Math.floor(Math.random() * lost.length)];
      const t = towns.find((x) => x.id === s.townId);
      if (!t) continue;
      return {
        id: crypto.randomUUID(),
        kind: "RECOVER",
        title: `Recuperar a carga roubada de ${t.name}`,
        client: `Guilda dos Mercadores de ${t.name}`,
        clientId: t.id,
        description: `O ${s.bandName} saqueou uma caravana de ${t.name} e leva ${s.qty} de ${GOODS[s.good].label.toLowerCase()}. Destruam o bando e devolvam a carga.`,
        siteId: "",
        difficulty: 2,
        travelDays: days(t),
        advance: Math.round(15 * jitter()),
        reward: Math.round((s.qty * GOODS[s.good].base * 1.2 + 60) * jitter()),
        good: s.good,
        qty: s.qty,
        bandId: s.bandId,
        targetId: t.id,
      };
    }
    if (kind === "SABOTAGE") {
      const war = econ.wars.filter((w) => w.peace === undefined)[0];
      if (!war) continue;
      const side = Math.random() < 0.5 ? [war.a, war.b] : [war.b, war.a];
      const client = nearby.find((t) => t.owner === side[0]);
      if (!client) continue;
      const need = Math.random() < 0.5 ? 1 : 2;
      return {
        id: crypto.randomUUID(),
        kind: "SABOTAGE",
        title: `Queimar as caravanas do ${econ.factionName(side[1])}`,
        client: `${pick(CLIENT_FORM[client.kind])} ${client.name}`,
        clientId: client.id,
        description: `Em guerra, o ${econ.factionName(side[0])} quer o comércio do inimigo estrangulado: saqueiem ${need} caravana(s) do ${econ.factionName(side[1])}. O reino atacado não vai gostar.`,
        siteId: "",
        difficulty: need === 2 ? 3 : 2,
        travelDays: days(client),
        advance: Math.round(30 * jitter()),
        reward: Math.round((110 + need * 60) * jitter()),
        factionTarget: side[1],
        need,
      };
    }
  }
  return null;
}
