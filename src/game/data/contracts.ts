import { travelDaysBetween, type SiteTheme, type WorldDef } from "./world";
import { distance, type Point } from "../../utils/math";
import { GOODS, type Good } from "../../utils/constants";
import type { Economy } from "../sim/market";
import { roadGraphOf } from "../sim/roadGraph";
import { TheRealm, ofRealm, theRealm } from "../worldgen/names";
import type { FieldArmy } from "../sim/kingdoms";
import { RANSOM_OF, nobleName, type Noble } from "../sim/nobility";

export type Difficulty = 1 | 2 | 3;

/**
 * Tipos de contrato: limpar um local (o clássico) e, desde o Marco 14, os da economia:
 * entregar mercadoria em falta, escoltar uma caravana, recuperar carga roubada por goblins,
 * abrir uma estrada infestada de salteadores e sabotar o comércio de um reino inimigo do cliente.
 */
export type ContractKind = "SITE" | "DELIVERY" | "ESCORT" | "RECOVER" | "ROUTE" | "SABOTAGE" | "RELIEF" | "CIVIL" | "BURN" | "RANSOM";

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
  /** Recuperação: o bando goblin que leva a carga. Rota infestada: os salteadores da estrada. */
  bandId?: string;
  /** Sabotagem: o reino cujas caravanas o cliente quer ver queimadas, e quantas. */
  factionTarget?: string;
  need?: number;
  /** Marco 15: exército a derrotar (cerco, guerra civil), ponte a queimar e nobre a libertar. */
  armyId?: string;
  crossingId?: string;
  nobleId?: string;
  /** O lado contrário: quem paga o preço (e guarda rancor) quando o contrato é cumprido. */
  rival?: string;
}

/** O que os contratos da economia precisam saber do mundo vivo. */
export interface EconomyContext {
  settlements: readonly (ClientSettlement & { econ: Economy })[];
  wars: readonly { a: string; b: string; peace?: number; civil?: boolean }[];
  stolenCargo: readonly { bandId: string; bandName: string; good: Good; qty: number; townId: string; day: number }[];
  factionName: (id: string) => string;
  /** Marco 15: exércitos em marcha e nobres (para os contratos que nascem da guerra). */
  armies: readonly FieldArmy[];
  nobles: readonly Noble[];
  relationOf: (factionId: string) => number;
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
  kind: "VILLAGE" | "CITY" | "FORT" | "CAPITAL";
  x: number;
  y: number;
  owner: string;
}

const CLIENT_FORM: Record<ClientSettlement["kind"], string[]> = {
  VILLAGE: ["Aldeia de", "Liga dos Lavradores de"],
  CITY: ["Guilda dos Mercadores de", "Conselho de", "Abadia de"],
  FORT: ["Senhor de", "Barão de"],
  CAPITAL: ["Guilda dos Mercadores de", "Chancelaria de", "Tesouro de"],
};

const pick = <T>(list: readonly T[]): T => list[Math.floor(Math.random() * list.length)];

/**
 * Novo contrato: um povoado que não esteja em guerra com o bando contrata a limpeza de um
 * local, de preferência perto dele. `from` = onde o bando está (estimativa da marcha).
 */
export function generateContract(world: WorldDef, clients: readonly ClientSettlement[], from: Point, econ?: EconomyContext): Contract | null {
  if (clients.length === 0 || world.sites.length === 0) return null;
  // Marco 15: primeiro o que a simulação pede agora (cercos, guerra civil, prisioneiros, pontes)
  if (econ && Math.random() < 0.6) {
    const c = warContract(world, clients, from, econ);
    if (c) return c;
  }
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

/** O que falta fazer num contrato (mesa da Tenda e faixa do HUD). */
export function contractGoal(
  c: Contract,
  name: { town: (id?: string) => string; site: (id: string) => string; realm: (id?: string) => string },
  done = 0,
): { short: string; long: string } {
  const label = c.good ? GOODS[c.good].label.toLowerCase() : "mercadoria";
  switch (c.kind) {
    case "DELIVERY":
      return { short: `levar ${c.qty} de ${label} a ${name.town(c.targetId)}`, long: `Leve ${c.qty} de ${label} ao mercado de ${name.town(c.targetId)} (★ no Mapa do Continente — Tab).` };
    case "ESCORT":
      return {
        short: `escoltar a caravana de ${name.town(c.fromId)} a ${name.town(c.targetId)}`,
        long: `A caravana espera no portão de ${name.town(c.fromId)} e só parte com o bando por perto. Leve-a até ${name.town(c.targetId)}.`,
      };
    case "RECOVER":
      return { short: `recuperar ${c.qty} de ${label}`, long: `Destrua o bando que levou a carga e devolva ${c.qty} de ${label} ao mercado de ${name.town(c.targetId)}.` };
    case "ROUTE":
      return {
        short: `limpar a estrada até ${name.town(c.targetId)}`,
        long: `Acabe com os salteadores na estrada entre ${name.town(c.fromId)} e ${name.town(c.targetId)} (marcados no Mapa do Continente — Tab).`,
      };
    case "SABOTAGE":
      return { short: `saquear caravanas (${done}/${c.need ?? 1})`, long: `Saqueie ${c.need ?? 1} caravana(s) ${ofRealm(name.realm(c.factionTarget))} (${done} até agora). O reino atacado não vai gostar.` };
    case "RELIEF":
      return { short: `romper o cerco de ${name.town(c.targetId)}`, long: `Destrua o exército ${ofRealm(name.realm(c.rival))} diante de ${name.town(c.targetId)} (★ no Mapa do Continente). Se ele recuar, o contrato também vale.` };
    case "CIVIL":
      return { short: `derrotar o exército ${ofRealm(name.realm(c.rival))}`, long: `Guerra civil: destrua o exército ${ofRealm(name.realm(c.rival))} que marcha contra ${name.town(c.targetId)}. O outro lado não vai esquecer.` };
    case "BURN":
      return { short: "queimar a ponte", long: `Queime a ponte marcada no Mapa do Continente (fale com a ponte: E). ${TheRealm(name.realm(c.rival))} não vai gostar.` };
    case "RANSOM":
      return { short: `libertar o nobre em ${name.town(c.targetId)}`, long: `Vá à Cidade Alta de ${name.town(c.targetId)}: pague o resgate ao Camareiro-mor na corte, ou tire o preso da masmorra pelos esgotos.` };
    default:
      return { short: name.site(c.siteId), long: `Os inimigos estão em ${name.site(c.siteId)} (★ no Mapa do Continente — Tab). Elimine todos.` };
  }
}

/**
 * Contratos que nascem da simulação dos reinos (Marco 15): sempre há gente de verdade do outro
 * lado, e ela guarda rancor. Uma cidade sitiada pede socorro, cada lado de uma guerra civil
 * contrata o bando, a família paga para tirar um nobre da masmorra, um rei quer a ponte do
 * inimigo queimada.
 */
function warContract(world: WorldDef, clients: readonly ClientSettlement[], from: Point, econ: EconomyContext): Contract | null {
  const ids = new Set(clients.map((c) => c.id));
  const towns = econ.settlements.filter((t) => ids.has(t.id));
  const days = (p: Point) => Math.max(1, Math.ceil(travelDaysBetween(from, p)));
  const jitter = () => 0.9 + Math.random() * 0.2;
  const options: (() => Contract | null)[] = [];
  const realm = econ.factionName;
  for (const a of econ.armies) {
    if (a.outcome) continue;
    const t = towns.find((x) => x.id === a.targetId);
    if (!t || t.owner === a.factionId) continue;
    const civil = econ.wars.some((w) => w.civil && w.peace === undefined && (w.a === a.factionId || w.b === a.factionId) && (w.a === t.owner || w.b === t.owner));
    options.push(() => ({
      id: crypto.randomUUID(),
      kind: civil ? "CIVIL" : "RELIEF",
      title: civil ? `Guerra civil: salvar ${t.name}` : a.sieging !== undefined ? `Romper o cerco de ${t.name}` : `Deter o exército que marcha contra ${t.name}`,
      client: t.owner === "FREE" ? `Conselho de ${t.name}` : realm(t.owner),
      clientId: t.id,
      description: civil
        ? `${realm(a.factionId)} marcha contra ${t.name} com ${a.size} homens. Os dois lados da guerra civil pagam bem por mercenários; este aqui quer aquele exército destruído.`
        : `${a.size} homens ${ofRealm(realm(a.factionId))} ${a.sieging !== undefined ? "cercam" : "marcham contra"} ${t.name}. Quem salvar a cidade ganha um amigo, e um inimigo.`,
      siteId: "",
      difficulty: a.size >= 24 ? 3 : a.size >= 14 ? 2 : 1,
      travelDays: days(t),
      advance: Math.round(40 * jitter()),
      reward: Math.round((150 + a.size * 9) * jitter()),
      armyId: a.id,
      targetId: t.id,
      rival: a.factionId,
    }));
  }
  for (const n of econ.nobles) {
    if (!n.alive || !n.captiveOf || n.captiveOf === "PLAYER" || n.captiveOf === n.factionId) continue;
    const home = towns.find((t) => t.owner === n.factionId);
    const prison = econ.settlements.find((t) => t.id === n.at);
    if (!home || !prison) continue;
    const ransom = RANSOM_OF(n);
    options.push(() => ({
      id: crypto.randomUUID(),
      kind: "RANSOM",
      title: `Libertar ${n.name}`,
      client: realm(n.factionId),
      clientId: home.id,
      description: `${nobleName(n, realm(n.factionId))} apodrece na masmorra de ${prison.name}. Pagamos o bastante para cobrir o resgate (${ransom} de ouro), ou mais, se sair de graça pelos esgotos.`,
      siteId: "",
      difficulty: 2,
      travelDays: days(prison),
      advance: Math.round(ransom * 0.2),
      reward: Math.round((ransom + 120) * jitter()),
      nobleId: n.id,
      targetId: prison.id,
      rival: n.captiveOf,
    }));
  }
  for (const w of econ.wars) {
    if (w.peace !== undefined) continue;
    const side = Math.random() < 0.5 ? [w.a, w.b] : [w.b, w.a];
    const client = towns.find((t) => t.owner === side[0]);
    const foeTowns = econ.settlements.filter((t) => t.owner === side[1]);
    if (!client || foeTowns.length === 0) continue;
    const bridge = world.geo.crossings.find((c) => c.kind === "BRIDGE" && foeTowns.some((t) => distance(t, c) < 5000));
    if (!bridge) continue;
    options.push(() => ({
      id: crypto.randomUUID(),
      kind: "BURN",
      title: `Queimar a ponte ${ofRealm(realm(side[1]))}`,
      client: realm(side[0]),
      clientId: client.id,
      description: `Sem aquela ponte, o exército ${ofRealm(realm(side[1]))} perde dias de marcha. Toquem fogo nela. Quem cruzar com o bando depois vai saber quem foi.`,
      siteId: "",
      difficulty: 2,
      travelDays: days(bridge),
      advance: Math.round(30 * jitter()),
      reward: Math.round(170 * jitter()),
      crossingId: bridge.id,
      rival: side[1],
    }));
  }
  if (options.length === 0) return null;
  return options[Math.floor(Math.random() * options.length)]();
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
  const kinds = ["DELIVERY", "ESCORT", "RECOVER", "ROUTE", "SABOTAGE"] as const;
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
    if (kind === "ROUTE") {
      // Salteadores fecharam a estrada entre dois mercados: enquanto estiverem lá, caravana não passa
      const roads = roadGraphOf(world);
      const origin = nearby[Math.floor(Math.random() * Math.min(5, nearby.length))];
      if (!origin) continue;
      const dests = roads.reachable(origin.id, 2.5).filter((r) => r.days >= 0.7 && ids.has(r.id));
      if (dests.length === 0) continue;
      const dest = dests[Math.floor(Math.random() * dests.length)];
      const target = towns.find((t) => t.id === dest.id);
      if (!target) continue;
      const difficulty: Difficulty = dest.days > 1.6 ? 3 : 2;
      return {
        id: crypto.randomUUID(),
        kind: "ROUTE",
        title: `Abrir a estrada de ${origin.name} a ${target.name}`,
        client: `Guilda dos Mercadores de ${origin.name}`,
        clientId: origin.id,
        description: `Salteadores tomaram a estrada entre ${origin.name} e ${target.name}: as caravanas não passam e os preços sobem. Acabem com eles.`,
        siteId: "",
        difficulty,
        travelDays: days(origin) + 1,
        advance: Math.round(25 * jitter()),
        reward: Math.round((90 + difficulty * 35) * jitter()),
        fromId: origin.id,
        targetId: target.id,
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
        title: `Queimar as caravanas ${ofRealm(econ.factionName(side[1]))}`,
        client: `${pick(CLIENT_FORM[client.kind])} ${client.name}`,
        clientId: client.id,
        description: `Em guerra, ${theRealm(econ.factionName(side[0]))} quer o comércio do inimigo estrangulado: saqueiem ${need} caravana(s) ${ofRealm(econ.factionName(side[1]))}. O reino atacado não vai gostar.`,
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
