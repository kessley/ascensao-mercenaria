import { SUPPORT } from "../../utils/constants";

/** Batedor: cavaleiro de reconhecimento (persistente; morte permanente). */
export interface ScoutData {
  id: string;
  name: string;
  /** Batalhas em que voltou vivo. */
  missions: number;
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
const pick = <T>(list: readonly T[]): T => list[Math.floor(Math.random() * list.length)];

export function newScout(): ScoutData {
  return { id: crypto.randomUUID(), name: pick(RIDER_NAMES), missions: 0 };
}

export function newMessenger(): MessengerData {
  return { id: crypto.randomUUID(), name: pick(RIDER_NAMES), level: 1, deliveries: 0 };
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
