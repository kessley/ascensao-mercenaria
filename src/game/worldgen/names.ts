import type { Rng } from "./rng";

/**
 * Nomes procedurais com sabor ibérico-medieval: lugares por sílabas, pessoas, reinos,
 * chefes goblins e senhores de calamidades. Tudo a partir do gerador com semente.
 */

const PLACE_START = [
  "Pedr", "Vau", "Cinz", "Mont", "Ferr", "Lob", "Corv", "Alb", "Bran", "Roch", "Fri", "Val",
  "Car", "Tor", "Sal", "Est", "Mor", "Quel", "Arn", "Gal", "Ced", "Dour", "Ermid", "Fal",
  "Grav", "Lam", "Nev", "Orv", "Pin", "Rav", "Silv", "Tal", "Urz", "Vid", "Zar", "Bel",
];
const PLACE_END = [
  "alva", "ocha", "fria", "ével", "ada", "eira", "onte", "al", "edo", "ina", "oso", "ária",
  "elos", "agem", "ais", "ença", "ar", "ume", "ilha", "ório", "ado", "anha", "eda", "ola",
];
const PLACE_SUFFIX = ["", "", "", "", " do Vale", " da Serra", " Velha", " do Norte", " de Baixo", " das Pedras"];

export function placeName(rng: Rng): string {
  return rng.pick(PLACE_START) + rng.pick(PLACE_END);
}

/** Nome de povoado: às vezes ganha um complemento ("Ferrada do Vale"). */
export function settlementName(rng: Rng, used: Set<string>): string {
  for (let i = 0; i < 40; i++) {
    const name = placeName(rng) + rng.pick(PLACE_SUFFIX);
    if (!used.has(name)) {
      used.add(name);
      return name;
    }
  }
  const fallback = `${placeName(rng)} ${used.size}`;
  used.add(fallback);
  return fallback;
}

const FIRST_NAMES = [
  "Afonso", "Beatriz", "Sancho", "Urraca", "Teresa", "Fernão", "Leonor", "Gonçalo", "Mafalda",
  "Rodrigo", "Elvira", "Nuno", "Inês", "Martim", "Sancha", "Egas", "Guiomar", "Vasco", "Brites",
  "Mendo", "Aldonça", "Paio", "Dulce", "Soeiro",
];
const EPITHETS = [
  "o Velho", "a Justa", "o Cruel", "a Sábia", "o Gordo", "o Calvo", "a Brava", "o Piedoso",
  "a Ruiva", "o Manco", "o Lobo", "a de Ferro", "o Tardio", "o Conquistador",
];

export function personName(rng: Rng): string {
  return `${rng.pick(FIRST_NAMES)} ${rng.pick(EPITHETS)}`;
}

const REALM_FORMS = ["Reino de", "Ducado de", "Baronato de", "Liga de", "Condado de", "Principado de"];

export function factionName(rng: Rng): string {
  return `${rng.pick(REALM_FORMS)} ${placeName(rng)}`;
}

const REGION_FORMS: Record<string, string[]> = {
  PLAINS: ["Campos de", "Planície de", "Charneca de", "Vale de"],
  FOREST: ["Bosque de", "Mata de", "Floresta de", "Selva Velha de"],
  HILLS: ["Colinas de", "Serra de", "Penhascos de", "Altos de"],
  MARSH: ["Pântano de", "Brejo de", "Lodaçal de", "Alagados de"],
  OCEAN: ["Mar de", "Baía de", "Águas de"],
  COAST: ["Costa de", "Praias de", "Enseada de"],
  DEEP_FOREST: ["Selva de", "Mata Fechada de", "Floresta Negra de"],
  MOUNTAINS: ["Montes de", "Cordilheira de", "Picos de"],
  STEPPE: ["Estepe de", "Pradarias de", "Campinas de"],
  DESERT: ["Deserto de", "Areais de", "Dunas de"],
  TUNDRA: ["Tundra de", "Ermos Gelados de", "Neves de"],
};

export function regionName(rng: Rng, biome: string): string {
  return `${rng.pick(REGION_FORMS[biome])} ${placeName(rng)}`;
}

const WORLD_FORMS = ["Terras de", "Marca de", "Reinos de", "Fronteira de", "Vales de"];

export function worldName(rng: Rng): string {
  return `${rng.pick(WORLD_FORMS)} ${placeName(rng)}`;
}

const ERAS = ["Era das Cinzas", "Era do Ferro", "Era dos Reis Partidos", "Era da Longa Noite", "Era das Coroas"];

export function eraName(rng: Rng): string {
  return rng.pick(ERAS);
}

const CHIEFS = ["Grukk", "Snaga", "Ruzbag", "Ugrash", "Mogg", "Zirak", "Bolg", "Narzug", "Skarr", "Gorbat", "Lugdush", "Azgar"];
const CHIEF_EPITHETS = ["Dente-Podre", "Orelha-Rasgada", "Come-Ratos", "Olho-Torto", "Faca-Cega", "Pé-de-Lama", "Rói-Ossos", "Quebra-Crânios"];

/** Chefes de bandos goblins e de hordas orcs (aleatoriedade de jogo, não de mundo). */
export function chiefName(random: () => number = Math.random): string {
  const pick = <T>(l: readonly T[]) => l[Math.floor(random() * l.length)];
  return `${pick(CHIEFS)} ${pick(CHIEF_EPITHETS)}`;
}

const DARK_TITLES = ["o Pálido", "o Sem-Túmulo", "a Voz dos Ossos", "o Último Abade", "a Rainha Cinzenta", "o Devorador de Nomes"];
const DARK_NAMES = ["Morvan", "Ysolde", "Calvar", "Nerith", "Odric", "Saevra", "Malakor", "Vesna"];

export function necromancerName(random: () => number = Math.random): string {
  const pick = <T>(l: readonly T[]) => l[Math.floor(random() * l.length)];
  return `${pick(DARK_NAMES)} ${pick(DARK_TITLES)}`;
}

/** Sempre no masculino plural: os textos dizem "os Corvos de Cinza", "aos Corvos de Cinza". */
const BAND_NAMES = ["Corvos de Cinza", "Lobos sem Senhor", "Filhos da Estrada", "Lanceiros do Ocaso", "Cães da Fronteira", "Irmãos do Estandarte Partido"];

export function bandName(rng: Rng): string {
  return rng.pick(BAND_NAMES);
}

/** "do Reino de X" / "da Liga de X": a preposição certa para o nome de um reino. */
export function ofRealm(name: string): string {
  return /^Liga /.test(name) ? `da ${name}` : `do ${name}`;
}
