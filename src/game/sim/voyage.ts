import { SEA, TROOPS, type ShipType, type TroopType } from "../../utils/constants";
import type { Season } from "../../utils/constants";

/**
 * Viagens por mar (Marco 17): lugares a bordo, dias de viagem, preço do frete e o que o mar faz
 * com quem está nele. Só contas: o estado da viagem mora no store.
 */

/** Lugares de um batalhão: cada soldado ocupa 1, e o cavalo dele mais 3. */
export function battalionSeats(b: { troopType: TroopType; soldiers: number }): number {
  const horse = TROOPS[b.troopType].family === "CAVALRY" ? SEA.SEATS.HORSE : 0;
  return b.soldiers * (SEA.SEATS.SOLDIER + horse);
}

export function seatsNeeded(battalions: readonly { troopType: TroopType; soldiers: number }[], wagons: number): number {
  return battalions.reduce((n, b) => n + battalionSeats(b), 0) + wagons * SEA.SEATS.WAGON;
}

export function fleetSeats(fleet: readonly { type: ShipType }[]): number {
  return fleet.reduce((n, s) => n + SEA.SHIPS[s.type].seats, 0);
}

/** A frota anda no passo do navio mais lento. */
export function fleetSpeed(fleet: readonly { type: ShipType }[]): number {
  return fleet.length > 0 ? Math.min(...fleet.map((s) => SEA.SHIPS[s.type].speed)) : 1;
}

/** Só naus e cocas cruzam o mar aberto; a barca chega onde a costa alcança. */
export function fleetReaches(fleet: readonly { type: ShipType }[], distance: number): boolean {
  return distance <= SEA.COAST_RANGE || fleet.some((s) => SEA.SHIPS[s.type].openSea);
}

export function voyageDays(distance: number, speed: number, season: Season): number {
  return Math.max(3, Math.ceil(distance / (SEA.MAP_PER_DAY * speed * SEA.WIND[season])));
}

export function charterCost(seats: number, days: number): number {
  return Math.ceil(Math.max(seats, SEA.CHARTER_MIN_SEATS) * SEA.CHARTER_PER_SEAT_DAY * days);
}

export function pirateToll(seats: number): number {
  return Math.max(SEA.TOLL_MIN, Math.ceil(seats * SEA.TOLL_PER_SEAT));
}

export function escapeChance(speed: number): number {
  return Math.min(0.8, SEA.ESCAPE * speed);
}

export type SeaEvent = "STORM" | "CALM" | "PIRATES";

/** O que o mar reserva para hoje (quase sempre, nada). */
export function rollSeaDay(season: Season, random: () => number = Math.random): SeaEvent | null {
  const r = random();
  let edge = SEA.STORM[season];
  if (r < edge) return "STORM";
  edge += SEA.CALM[season];
  if (r < edge) return "CALM";
  edge += SEA.PIRATES;
  return r < edge ? "PIRATES" : null;
}

/** Dias que uma notícia leva de um continente a outro. */
export function newsDelay(distance: number): number {
  return Math.ceil(distance * SEA.NEWS_PER_MAP);
}

/** Tripulação dos piratas conforme quem está a bordo: pirata não ataca o que não pode vencer. */
export function pirateCrew(seats: number, random: () => number = Math.random): { PIRATE: number; PIRATE_BOW: number; PIRATE_CAPTAIN: number } {
  const men = Math.round(Math.min(40, 6 + seats * 0.4) * (0.8 + random() * 0.4));
  const bows = Math.round(men * 0.25);
  return { PIRATE: men - bows, PIRATE_BOW: bows, PIRATE_CAPTAIN: 1 };
}
