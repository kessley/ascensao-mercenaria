import { SUPPORT } from "../../utils/constants";

/** Harpia: águia treinada de um batedor (Marco 16). Só serve depois do treino (`readyDay`). */
export interface HarpyData {
  name: string;
  readyDay: number;
}

/** Batedor: cavaleiro de reconhecimento (persistente; morte permanente). */
export interface ScoutData {
  id: string;
  name: string;
  /** Missões de onde voltou vivo (batalhas e explorações): dá patente. */
  missions: number;
  harpy?: HarpyData | null;
}

/** Mensageiro a cavalo: leva as ordens do Comandante às tropas fora do raio de comando. */
export interface MessengerData {
  id: string;
  name: string;
  /** Nível de comando 1–3 (cresce com as entregas). */
  level: number;
  deliveries: number;
}

const RIDER_NAMES = ["Iago", "Brisa", "Tarek", "Nell", "Odo", "Sabine", "Kael", "Runa", "Pim", "Vesna", "Lio", "Asha", "Teo", "Mika"];
const HARPY_NAMES = ["Garra", "Sombra", "Vento", "Rainha", "Flecha", "Cinza", "Trovão", "Nuvem"];
const pick = <T>(list: readonly T[]): T => list[Math.floor(Math.random() * list.length)];

export function newScout(): ScoutData {
  return { id: crypto.randomUUID(), name: pick(RIDER_NAMES), missions: 0 };
}

export function newMessenger(): MessengerData {
  return { id: crypto.randomUUID(), name: pick(RIDER_NAMES), level: 1, deliveries: 0 };
}

export function newHarpy(readyDay: number): HarpyData {
  return { name: pick(HARPY_NAMES), readyDay };
}

/** Patente do batedor (0 novato, 1 experiente, 2 veterano), pelas missões. */
export function scoutRank(missions: number): number {
  let rank = 0;
  SUPPORT.SCOUT.RANK_AT.forEach((need, i) => {
    if (missions >= need) rank = i;
  });
  return rank;
}

/** Nível de comando correspondente ao total de entregas. */
export function messengerLevelFor(deliveries: number): number {
  let level = 1;
  SUPPORT.MESSENGER.LEVEL_AT.forEach((need, i) => {
    if (deliveries >= need) level = i + 1;
  });
  return level;
}

/** Atributos do mensageiro conforme o nível de comando. */
export function messengerProfile(level: number) {
  const M = SUPPORT.MESSENGER;
  const bonus = level - 1;
  return {
    speed: M.stats.speed * (1 + M.SPEED_PER_LEVEL * bonus),
    evasion: M.evasion + M.EVASION_PER_LEVEL * bonus,
    authority: M.AUTHORITY_MORALE_PER_LEVEL * level,
    canRally: level >= M.RALLY_FROM_LEVEL,
    /** Distância a que sinaliza a ordem (trombeta/bandeira), sem precisar chegar à tropa. */
    signalRange: M.SIGNAL_RANGE[Math.min(level, M.SIGNAL_RANGE.length) - 1],
  };
}

/** Salário semanal de batedores e mensageiros. */
export function supportWages(scouts: number, messengers: number): number {
  return scouts * SUPPORT.SCOUT.WAGE + messengers * SUPPORT.MESSENGER.WAGE;
}
