import type { MapId } from "./battleMaps";

export type Difficulty = 1 | 2 | 3;

/** Oferta de trabalho na mesa estratégica. */
export interface Contract {
  id: string;
  title: string;
  client: string;
  description: string;
  mapId: Exclude<MapId, "CAMP">;
  difficulty: Difficulty;
  /** Dias de marcha até o local (consomem rações e podem cair num dia de pagamento). */
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

const TEMPLATES: Record<Contract["mapId"], { title: string; description: string }[]> = {
  GOBLIN_NEST: [
    { title: "Limpar o ninho goblin", description: "Um bando goblin saqueia as colheitas. Acabem com o ninho." },
    { title: "Resgatar a caravana", description: "Goblins cercaram uma caravana perto das colinas." },
  ],
  FOREST_ROAD: [
    { title: "Abrir a estrada da floresta", description: "Emboscadores nas matas fecham a rota comercial." },
    { title: "Escoltar mensageiros", description: "A estrada entre as florestas precisa ser limpa antes da passagem." },
  ],
  SWAMP_FORD: [
    { title: "Tomar o vau do pântano", description: "Goblins controlam a única travessia do pântano." },
    { title: "Expulsar os saqueadores do vau", description: "Arqueiros goblins atiram de uma colina além do vau." },
  ],
};

const CLIENTS = [
  "Aldeia de Vaurocha",
  "Guilda dos Mercadores",
  "Barão de Cinzafria",
  "Abadia do Monte Velado",
  "Senhor de Pedralva",
  "Liga dos Lenhadores",
];

const pick = <T>(list: readonly T[]): T => list[Math.floor(Math.random() * list.length)];

export function generateContract(): Contract {
  const mapId = pick(Object.keys(TEMPLATES) as Contract["mapId"][]);
  const template = pick(TEMPLATES[mapId]);
  const difficulty = pick([1, 2, 2, 3] as const);
  const d = DIFFICULTY[difficulty];
  const travelDays = 2 + Math.floor(Math.random() * 3); // 2–4 dias
  // Pequena variação para as ofertas não parecerem idênticas; viagem longa paga um pouco mais
  const jitter = () => 0.9 + Math.random() * 0.2;
  return {
    id: crypto.randomUUID(),
    title: template.title,
    client: pick(CLIENTS),
    description: template.description,
    mapId,
    difficulty,
    travelDays,
    advance: Math.round(d.advance * jitter()),
    reward: Math.round(d.reward * jitter() * (1 + (travelDays - 2) * 0.1)),
  };
}

export function generateContracts(count: number): Contract[] {
  return Array.from({ length: count }, generateContract);
}
