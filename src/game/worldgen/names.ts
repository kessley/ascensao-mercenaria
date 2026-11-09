import type { Rng } from "./rng";

/**
 * Nomes procedurais com sabor ibérico-medieval: lugares por sílabas, pessoas, reinos,
 * chefes goblins e senhores de calamidades. Tudo a partir do gerador com semente.
 */

export type TongueId = "REALMS" | "SANDS" | "ISLES" | "JADE";

const REALMS_START = [
  "Pedr", "Vau", "Cinz", "Mont", "Ferr", "Lob", "Corv", "Alb", "Bran", "Roch", "Fri", "Val",
  "Car", "Tor", "Sal", "Est", "Mor", "Quel", "Arn", "Gal", "Ced", "Dour", "Ermid", "Fal",
  "Grav", "Lam", "Nev", "Orv", "Pin", "Rav", "Silv", "Tal", "Urz", "Vid", "Zar", "Bel",
];
const REALMS_END = [
  "alva", "ocha", "fria", "ével", "ada", "eira", "onte", "al", "edo", "ina", "oso", "ária",
  "elos", "agem", "ais", "ença", "ar", "ume", "ilha", "ório", "ado", "anha", "eda", "ola",
];
const REALMS_SUFFIX = ["", "", "", "", " do Vale", " da Serra", " Velha", " do Norte", " de Baixo", " das Pedras"];
const REALM_MALE = ["Afonso", "Sancho", "Fernão", "Gonçalo", "Rodrigo", "Nuno", "Martim", "Egas", "Vasco", "Mendo", "Paio", "Soeiro"];
const REALM_FEMALE = ["Beatriz", "Urraca", "Teresa", "Leonor", "Mafalda", "Elvira", "Inês", "Sancha", "Guiomar", "Brites", "Aldonça", "Dulce"];

interface Tongue {
  start: readonly string[];
  end: readonly string[];
  suffix: readonly string[];
  male: readonly string[];
  female: readonly string[];
  /** Sempre no masculino: os textos dizem "do Sultanato de X". */
  realms: readonly string[];
  worlds: readonly string[];
  eras: readonly string[];
}

const TONGUES: Record<TongueId, Tongue> = {
  REALMS: {
    start: REALMS_START,
    end: REALMS_END,
    suffix: REALMS_SUFFIX,
    male: REALM_MALE,
    female: REALM_FEMALE,
    realms: ["Reino de", "Ducado de", "Baronato de", "Liga de", "Condado de", "Principado de"],
    worlds: ["Terras de", "Marca de", "Reinos de", "Fronteira de", "Vales de"],
    eras: ["Era das Cinzas", "Era do Ferro", "Era dos Reis Partidos", "Era da Longa Noite", "Era das Coroas"],
  },
  SANDS: {
    start: ["Zah", "Qas", "Mar", "Sam", "Bah", "Ras", "Tar", "Kha", "Nab", "Sur", "Dar", "Has", "Jaz", "Far", "Shar", "Aqa", "Sab", "Yas"],
    end: ["ara", "abad", "iya", "un", "ah", "ur", "iz", "an", "ira", "ash", "eh", "ad", "ima", "ul", "ani", "esh"],
    suffix: ["", "", "", " do Oásis", " das Dunas", " Alta", " do Poço"],
    male: ["Harun", "Yusuf", "Tariq", "Khalid", "Idris", "Samir", "Malik", "Rashid", "Zayd", "Faris", "Omar", "Nasir"],
    female: ["Layla", "Zahra", "Amira", "Salma", "Yasmin", "Nadia", "Samira", "Farah", "Dalia", "Rania", "Hana", "Noor"],
    realms: ["Emirado de", "Sultanato de", "Califado de", "Xeicado de", "Vizirato de"],
    worlds: ["Areias de", "Emirados de", "Costa de"],
    eras: ["Era das Caravanas", "Era dos Sete Poços", "Era do Sol Alto"],
  },
  ISLES: {
    start: ["Skar", "Hal", "Thor", "Bjor", "Ulf", "Grim", "Ran", "Sig", "Hraf", "Eir", "Ask", "Stein", "Vik", "Trol", "Frey", "Odd", "Kol"],
    end: ["vik", "heim", "fjord", "holm", "by", "stad", "nes", "gard", "ey", "dal", "borg", "vang", "sund"],
    suffix: ["", "", "", " do Fiorde", " das Ilhas", " Negra", " da Neve"],
    male: ["Bjorn", "Sigurd", "Ragnar", "Harald", "Leif", "Erik", "Ulf", "Ivar", "Torsten", "Knut", "Olaf", "Gunnar"],
    female: ["Astrid", "Freya", "Sigrid", "Ingrid", "Gudrun", "Thora", "Helga", "Solveig", "Ragnhild", "Eira", "Hilda", "Runa"],
    realms: ["Jarlado de", "Reino de", "Clã de", "Trono de"],
    worlds: ["Ilhas de", "Fiordes de", "Mares de"],
    eras: ["Era do Longo Inverno", "Era dos Barcos", "Era do Machado"],
  },
  JADE: {
    start: ["Lin", "Shan", "Qing", "Hua", "Jin", "Wei", "Long", "Tai", "Yun", "Mei", "Zhao", "Feng", "Hai", "Bai", "Kai", "Ren"],
    end: ["zhou", "shan", "yang", "ling", "an", "hai", "du", "ning", "men", "gang", "lou", "tai"],
    suffix: ["", "", "", " do Rio", " de Jade", " da Névoa", " Imperial"],
    male: ["Bao", "Cheng", "Da", "Feng", "Guang", "Hao", "Jun", "Kang", "Li", "Ming", "Tao", "Wen"],
    female: ["An", "Bai", "Chun", "Fen", "Hua", "Jia", "Lan", "Mei", "Ning", "Qiu", "Shu", "Yue"],
    realms: ["Império de", "Principado de", "Reino de", "Protetorado de"],
    worlds: ["Impérios de", "Rios de", "Montes de"],
    eras: ["Era do Mandato", "Era das Dez Dinastias", "Era da Seda"],
  },
};

/** A língua de onde se está: nomes novos, de nobres a povoados, saem nela. */
let tongue: Tongue = TONGUES.REALMS;
let tongueId: TongueId = "REALMS";

export function useTongue(id: TongueId): void {
  tongue = TONGUES[id];
  tongueId = id;
}

export const currentTongue = (): TongueId => tongueId;

export function placeName(rng: Rng): string {
  return rng.pick(tongue.start) + rng.pick(tongue.end);
}

/** Nome de povoado: às vezes ganha um complemento ("Ferrada do Vale"). */
export function settlementName(rng: Rng, used: Set<string>): string {
  for (let i = 0; i < 40; i++) {
    const name = placeName(rng) + rng.pick(tongue.suffix);
    if (!used.has(name)) {
      used.add(name);
      return name;
    }
  }
  const fallback = `${placeName(rng)} ${used.size}`;
  used.add(fallback);
  return fallback;
}

const MALE_EPITHETS = ["o Velho", "o Justo", "o Cruel", "o Sábio", "o Gordo", "o Calvo", "o Bravo", "o Piedoso", "o Ruivo", "o Manco", "o Lobo", "o de Ferro", "o Tardio", "o Conquistador"];
const FEMALE_EPITHETS = ["a Velha", "a Justa", "a Cruel", "a Sábia", "a Gorda", "a Calva", "a Brava", "a Piedosa", "a Ruiva", "a Manca", "a Loba", "a de Ferro", "a Tardia", "a Conquistadora"];

/** Nome com alcunha, sempre no gênero certo ("Urraca a Brava"). */
export function personName(rng: Rng, female = rng.chance(0.5)): string {
  return `${rng.pick(female ? tongue.female : tongue.male)} ${rng.pick(female ? FEMALE_EPITHETS : MALE_EPITHETS)}`;
}

/** Só o primeiro nome (nobres sem alcunha ganham uma com o tempo, ou ao subir ao trono). */
export function firstName(rng: Rng, female: boolean): string {
  return rng.pick(female ? tongue.female : tongue.male);
}

/** Um primeiro nome numa língua dada, fora do gerador com semente (gente de outra terra que entra no bando). */
export function nameIn(id: TongueId, female: boolean, r: () => number = Math.random): string {
  const list = female ? TONGUES[id].female : TONGUES[id].male;
  return list[Math.floor(r() * list.length)];
}

/** O nome é de mulher? (reis e rainhas vêm da história como texto). */
export function isFemaleName(name: string): boolean {
  return Object.values(TONGUES).some((t) => t.female.includes(name.split(" ")[0]));
}

/** Alcunha nova (coroação). */
export function epithet(rng: Rng, female: boolean): string {
  return rng.pick(female ? FEMALE_EPITHETS : MALE_EPITHETS);
}

export function factionName(rng: Rng): string {
  return `${rng.pick(tongue.realms)} ${placeName(rng)}`;
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

export function worldName(rng: Rng): string {
  return `${rng.pick(tongue.worlds)} ${placeName(rng)}`;
}

export function eraName(rng: Rng): string {
  return rng.pick(tongue.eras);
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

/** "o Reino de X" / "a Liga de X". */
export const theRealm = (name: string) => (/^Liga /.test(name) ? `a ${name}` : `o ${name}`);
/** "no Reino de X" / "na Liga de X". */
export const inRealm = (name: string) => (/^Liga /.test(name) ? `na ${name}` : `no ${name}`);
/** "ao Reino de X" / "à Liga de X". */
export const toRealm = (name: string) => (/^Liga /.test(name) ? `à ${name}` : `ao ${name}`);
const cap = (t: string) => t[0].toUpperCase() + t.slice(1);
/** Começo de frase: "O Reino de X" / "A Liga de X". */
export const TheRealm = (name: string) => cap(theRealm(name));
