import { travelDaysBetween, type SiteTheme, type WorldDef } from "./world";
import { distance, type Point } from "../../utils/math";

export type Difficulty = 1 | 2 | 3;

/** Oferta de trabalho na mesa estratégica: um povoado contrata o bando para limpar um local. */
export interface Contract {
  id: string;
  title: string;
  /** Quem paga (ex.: "Aldeia de Ferrada", "Senhor de Cinzal"). */
  client: string;
  /** Povoado contratante (a relação com o reino dele melhora ao cumprir). */
  clientId: string;
  description: string;
  siteId: string;
  difficulty: Difficulty;
  /** Dias de marcha estimados do acampamento até o local. */
  travelDays: number;
  /** Pago ao aceitar. */
  advance: number;
  /** Pago só na vitória. */
  reward: number;
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
export function generateContract(world: WorldDef, clients: readonly ClientSettlement[], from: Point): Contract | null {
  if (clients.length === 0 || world.sites.length === 0) return null;
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
