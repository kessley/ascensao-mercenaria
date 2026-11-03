/**
 * Ambições (Marco 18): objetivos que o jogador escolhe para o bando. Nenhuma é obrigatória; cada
 * uma dá um prêmio ao ser cumprida e entra no epílogo, e o herdeiro continua de onde parou.
 */

export type AmbitionId = "CROWN" | "SLAYER" | "SALT" | "UNITE" | "SEAS" | "VETERAN";

/** O que as ambições olham na campanha. */
export interface AmbitionView {
  /** Povoados do bando no continente onde ele está. */
  owned: number;
  /** Povoados habitados nesse continente. */
  towns: number;
  calamities: number;
  saltSold: number;
  victories: number;
  /** Continentes já pisados. */
  visited: number;
  continents: number;
  ships: number;
}

export interface AmbitionDef {
  label: string;
  description: string;
  /** Quanto falta, de 0 a 1, e a conta para mostrar. */
  progress: (v: AmbitionView) => { share: number; text: string };
  reward: { gold: number; fame: number };
  /** Frase do epílogo. */
  epilogue: string;
}

const share = (n: number, of: number) => Math.min(1, n / Math.max(1, of));

const KING_TOWNS = 4;
const SLAIN = 3;
const SALT_GOAL = 200;
const SHIPS_GOAL = 3;
const VICTORIES = 40;
/** Unir um continente: esta parte dos povoados basta (sempre sobra uma aldeia teimosa). */
const UNITY = 0.8;

export const AMBITIONS: Record<AmbitionId, AmbitionDef> = {
  CROWN: {
    label: "Tornar-se rei",
    description: `Governar ${KING_TOWNS} povoados e ser chamado de rei.`,
    progress: (v) => ({ share: share(v.owned, KING_TOWNS), text: `${v.owned} de ${KING_TOWNS} povoados` }),
    reward: { gold: 1500, fame: 15 },
    epilogue: "Mercenários que viraram reis: a coroa que usaram nunca foi herdada de ninguém.",
  },
  SLAYER: {
    label: "Vencer três calamidades",
    description: `Derrubar ${SLAIN} calamidades com o estandarte do bando.`,
    progress: (v) => ({ share: share(v.calamities, SLAIN), text: `${v.calamities} de ${SLAIN} calamidades` }),
    reward: { gold: 1200, fame: 20 },
    epilogue: "Quando o céu escureceu, foi o estandarte deles que as aldeias procuraram no horizonte.",
  },
  SALT: {
    label: "Dominar o comércio de sal",
    description: `Vender ${SALT_GOAL} de sal nos mercados.`,
    progress: (v) => ({ share: share(v.saltSold, SALT_GOAL), text: `${v.saltSold} de ${SALT_GOAL} de sal` }),
    reward: { gold: 2000, fame: 8 },
    epilogue: "Nenhuma panela do continente era temperada sem que uma moeda chegasse ao bando.",
  },
  UNITE: {
    label: "Unir um continente",
    description: `Governar ${Math.round(UNITY * 100)}% dos povoados de um continente.`,
    progress: (v) => ({ share: share(v.owned, Math.ceil(v.towns * UNITY)), text: `${v.owned} de ${Math.ceil(v.towns * UNITY)} povoados` }),
    reward: { gold: 3000, fame: 30 },
    epilogue: "Pela primeira vez, uma só bandeira tremulou de costa a costa.",
  },
  SEAS: {
    label: "Senhor dos mares",
    description: `Pisar em todos os continentes e manter ${SHIPS_GOAL} navios.`,
    progress: (v) => ({ share: (share(v.visited, v.continents) + share(v.ships, SHIPS_GOAL)) / 2, text: `${v.visited} de ${v.continents} continentes · ${v.ships} de ${SHIPS_GOAL} navios` }),
    reward: { gold: 2500, fame: 20 },
    epilogue: "Marinheiros de quatro terras ainda contam histórias das velas do bando.",
  },
  VETERAN: {
    label: "Quarenta vitórias",
    description: `Vencer ${VICTORIES} batalhas.`,
    progress: (v) => ({ share: share(v.victories, VICTORIES), text: `${v.victories} de ${VICTORIES} vitórias` }),
    reward: { gold: 1000, fame: 15 },
    epilogue: "Ninguém mais contava as batalhas: contavam quem tinha sobrado para lutar contra eles.",
  },
};

export const AMBITION_IDS = Object.keys(AMBITIONS) as AmbitionId[];
/** Mais que isso ao mesmo tempo é só desejo. */
export const AMBITION_SLOTS = 2;

export function ambitionDone(id: AmbitionId, v: AmbitionView): boolean {
  return AMBITIONS[id].progress(v).share >= 1;
}
