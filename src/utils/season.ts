import { SEASONS, WEATHER, WORLD, type Season, type Weather } from "./constants";
import type { Point } from "./math";

/**
 * Calendário e clima (Marco 13). O ano tem 4 estações de SEASONS.DAYS dias; a campanha começa
 * no meio da primavera. O clima de cada dia é sorteado por célula (2×2 regiões) a partir da
 * semente do mundo e do dia: o mesmo lugar no mesmo dia tem sempre o mesmo tempo, então ele
 * não precisa ir no save e dá para prever o de amanhã.
 */

/** Dia do ano (0 a 4×DAYS−1) de um dia da campanha. */
function dayOfYear(day: number): number {
  const year = SEASONS.DAYS * 4;
  return (((day - 1 + SEASONS.START_OFFSET) % year) + year) % year;
}

export function seasonOf(day: number): Season {
  return SEASONS.ORDER[Math.floor(dayOfYear(day) / SEASONS.DAYS)];
}

/** Dia dentro da estação (1 a DAYS). */
export function seasonDay(day: number): number {
  return (dayOfYear(day) % SEASONS.DAYS) + 1;
}

/** Ano da campanha (1 = o ano em que o bando montou acampamento). */
export function campaignYear(day: number): number {
  return Math.floor((day - 1 + SEASONS.START_OFFSET) / (SEASONS.DAYS * 4)) + 1;
}

/** Cheia da primavera: os vaus dos rios ficam fundos. */
export function isFlood(day: number): boolean {
  return seasonOf(day) === "SPRING" && seasonDay(day) <= SEASONS.FLOOD_DAYS;
}

/** Dias até a próxima estação começar. */
export function daysToNextSeason(day: number): number {
  return SEASONS.DAYS - seasonDay(day) + 1;
}

function hash(a: number, b: number, c: number, d: number): number {
  let h = (a * 374761393 + b * 668265263 + c * 2147483647 + d * 1274126177) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

/** O que o clima precisa saber do lugar (bioma e temperatura). */
export interface ClimateProbe {
  biomeAt(x: number, y: number): string;
  temperatureAt(x: number, y: number): number;
  /** Há mar perto? (a tempestade vem do mar e alcança a costa) */
  nearSea?(p: Point, r: number): boolean;
}

/**
 * Tempo de um dia num lugar. Desertos e estepes quase não têm chuva; pântanos têm mais
 * nevoeiro; no frio do inverno a chuva cai como neve.
 */
export function weatherAt(seed: number, day: number, p: Point, geo: ClimateProbe | null): Weather {
  const season = seasonOf(day);
  const cx = Math.floor(p.x / (WORLD.REGION_WIDTH * WEATHER.CELL_REGIONS));
  const cy = Math.floor(p.y / (WORLD.REGION_HEIGHT * WEATHER.CELL_REGIONS));
  const r = hash(seed, day, cx, cy);
  const biome = geo?.biomeAt(p.x, p.y) ?? "PLAINS";
  const chance = WEATHER.CHANCE[season];
  const dry = biome === "DESERT" ? 0.2 : biome === "STEPPE" ? 0.5 : 1;
  const foggy = biome === "MARSH" || biome === "COAST" ? 1.8 : biome === "DESERT" ? 0.3 : 1;
  const wet = chance.wet * dry;
  if (r < wet) {
    const cold = season === "WINTER" && (geo?.temperatureAt(p.x, p.y) ?? 0.5) < SEASONS.SNOW_BELOW;
    if (cold) return "SNOW";
    // Na costa e no mar, o outono e o inverno trazem tempestades (os navios ficam no porto)
    const stormSeason = season === "AUTUMN" || season === "WINTER";
    const sea = stormSeason && (biome === "COAST" || biome === "OCEAN" || (geo?.nearSea?.(p, WEATHER.STORM_REACH) ?? false));
    const stormy = sea && hash(seed + 7, day, cx, cy) < WEATHER.STORM_SHARE;
    return stormy ? "STORM" : "RAIN";
  }
  if (r < wet + chance.fog * foggy) return "FOG";
  return "CLEAR";
}

/** Neve no chão: inverno e frio (norte e montanhas). */
export function snowyAt(day: number, temperature: number): boolean {
  return seasonOf(day) === "WINTER" && temperature < SEASONS.SNOW_BELOW;
}
