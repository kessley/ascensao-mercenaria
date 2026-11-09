import type { CultureId } from "../data/planet";
import { FAITH, SEASONS, type Season } from "../../utils/constants";
import { dayOfYear, seasonDay, seasonOf } from "../../utils/season";
import { BAND_HOME, cultureOf } from "./culture";

/**
 * Fés (Marco 23, parte 2): uma fé de cada cultura e a Palavra Nova, dos pregadores, que corre
 * entre elas. Cada fé tem templo, clero, calendário (dia santo, jejum, festa) e preceitos que
 * obrigam a decidir. As regras são puras: a cena e o store só perguntam.
 */

export type FaithId = "FLAME" | "VEIL" | "TIDE" | "PATH" | "WORD";
export type PreceptId = "HOLY_DAY" | "BURY" | "FAST" | "NO_MAGIC";

export const FAITH_IDS: readonly FaithId[] = ["FLAME", "VEIL", "TIDE", "PATH", "WORD"];

export interface FaithDef {
  label: string;
  /** "da Chama": fiéis da Chama, templo da Chama. */
  of: string;
  /** A cultura de onde a fé é (a Palavra Nova não tem terra). */
  culture: CultureId | null;
  clergy: string;
  /** Dia do ciclo de HOLY_EVERY dias que é santo (só para quem guarda o dia santo). */
  holy: number;
  precepts: readonly PreceptId[];
  fast?: { season: Season; from: number; days: number; label: string };
  feast: { season: Season; day: number; label: string };
  color: string;
}

export const FAITHS: Record<FaithId, FaithDef> = {
  FLAME: {
    label: "Chama Eterna",
    of: "da Chama",
    culture: "REALMS",
    clergy: "sacerdotes da Chama",
    holy: 6,
    precepts: ["HOLY_DAY", "BURY"],
    feast: { season: "AUTUMN", day: 10, label: "Festa das Colheitas" },
    color: "#f0a040",
  },
  VEIL: {
    label: "Véu das Estrelas",
    of: "do Véu",
    culture: "SANDS",
    clergy: "astrólogos do Véu",
    holy: 4,
    precepts: ["FAST", "HOLY_DAY"],
    fast: { season: "SUMMER", from: 5, days: 5, label: "Jejum das Estrelas" },
    feast: { season: "SUMMER", day: 10, label: "Noite das Estrelas" },
    color: "#8fa8ff",
  },
  TIDE: {
    label: "Deuses do Mar",
    of: "do Mar",
    culture: "ISLES",
    clergy: "videntes das marés",
    holy: 0,
    precepts: ["BURY", "NO_MAGIC"],
    feast: { season: "SPRING", day: 15, label: "Festa da Primeira Vela" },
    color: "#5fc8c0",
  },
  PATH: {
    label: "Caminho dos Ancestrais",
    of: "do Caminho",
    culture: "JADE",
    clergy: "monges do Caminho",
    holy: 2,
    precepts: ["FAST", "BURY"],
    fast: { season: "WINTER", from: 1, days: 5, label: "Jejum dos Ancestrais" },
    feast: { season: "WINTER", day: 8, label: "Festa das Lanternas" },
    color: "#7fd08a",
  },
  WORD: {
    label: "Palavra Nova",
    of: "da Palavra",
    culture: null,
    clergy: "pregadores da Palavra",
    holy: 8,
    precepts: ["NO_MAGIC", "HOLY_DAY"],
    feast: { season: "SPRING", day: 1, label: "Dia da Aurora" },
    color: "#e8e0c8",
  },
};

export const PRECEPTS: Record<PreceptId, string> = {
  HOLY_DAY: "não lutar no dia santo",
  BURY: "enterrar os mortos antes de marchar",
  FAST: "jejuar no tempo do jejum",
  NO_MAGIC: "não tocar em magia",
};

/** A Palavra Nova briga com todas; a Chama e o Véu são rivais antigos. */
const FOES: Record<FaithId, readonly FaithId[]> = {
  FLAME: ["VEIL", "WORD"],
  VEIL: ["FLAME", "WORD"],
  TIDE: ["WORD"],
  PATH: ["WORD"],
  WORD: ["FLAME", "VEIL", "TIDE", "PATH"],
};

export function clash(a: FaithId, b: FaithId): boolean {
  return FOES[a].includes(b);
}

export function keeps(f: FaithId, p: PreceptId): boolean {
  return FAITHS[f].precepts.includes(p);
}

// --- De quem é cada fé ---

export function nativeFaith(c: CultureId): FaithId {
  return (FAITH_IDS.find((f) => FAITHS[f].culture === c) ?? "FLAME") as FaithId;
}

/** A fé de alguém do bando (quem é de antes do Marco 23 segue a fé da sua terra). */
export function faithOf(x: { faith?: FaithId; culture?: CultureId } | null | undefined): FaithId {
  return x?.faith ?? nativeFaith(cultureOf(x));
}

/** Parte dos pregadores da Palavra Nova na gente de um povoado. */
export function preacherShare(ownerFaith?: FaithId | null): number {
  return FAITH.PREACHER_SHARE + (ownerFaith === "WORD" ? FAITH.CONVERTED_SHARE : 0);
}

/** Uma pessoa sorteada: a fé da sua terra, ou a Palavra Nova dos pregadores (`r` de 0 a 1). */
export function pickFaith(culture: CultureId, share: number, r: number): FaithId {
  return r < share ? "WORD" : nativeFaith(culture);
}

/** A fé de um reino (sem conversão, a da terra). */
export function factionFaith(f: { faith?: FaithId } | null | undefined, land: CultureId | undefined): FaithId {
  return f?.faith ?? nativeFaith(land ?? BAND_HOME);
}

/** O templo de um povoado: o do rei, ou o da gente de lá. */
export function townFaith(main: CultureId, ownerFaith?: FaithId | null): FaithId {
  return ownerFaith ?? nativeFaith(main);
}

// --- Calendário ---

export function isHolyDay(f: FaithId, day: number): boolean {
  return keeps(f, "HOLY_DAY") && dayOfYear(day) % FAITH.HOLY_EVERY === FAITHS[f].holy;
}

export function isFasting(f: FaithId, day: number): boolean {
  const fast = FAITHS[f].fast;
  if (!fast || seasonOf(day) !== fast.season) return false;
  const d = seasonDay(day);
  return d >= fast.from && d < fast.from + fast.days;
}

/** Último dia do jejum: quem jejuou até o fim ganha o favor do templo. */
export function fastEnds(f: FaithId, day: number): boolean {
  const fast = FAITHS[f].fast;
  return !!fast && seasonOf(day) === fast.season && seasonDay(day) === fast.from + fast.days - 1;
}

export function isFeast(f: FaithId, day: number): boolean {
  const feast = FAITHS[f].feast;
  return seasonOf(day) === feast.season && seasonDay(day) === feast.day;
}

/** Ano do jejum (para lembrar quem já o quebrou). */
export function fastKey(f: FaithId, day: number): string {
  return `${f}:${Math.floor((day - 1 + SEASONS.START_OFFSET) / (SEASONS.DAYS * 4))}`;
}

export interface FaithToday {
  holy: ReadonlySet<FaithId>;
  fasting: ReadonlySet<FaithId>;
  feast: ReadonlySet<FaithId>;
}

/** Batalha personalizada: nenhum dia santo nem jejum. */
export const NO_FAITH_DAY: FaithToday = { holy: new Set(), fasting: new Set(), feast: new Set() };

let memo: { day: number; today: FaithToday } | null = null;

/** O que cada fé guarda hoje (a cena pergunta a cada quadro, então fica guardado por dia). */
export function faithToday(day: number): FaithToday {
  if (memo?.day === day) return memo.today;
  const today = {
    holy: new Set(FAITH_IDS.filter((f) => isHolyDay(f, day))),
    fasting: new Set(FAITH_IDS.filter((f) => isFasting(f, day))),
    feast: new Set(FAITH_IDS.filter((f) => isFeast(f, day))),
  };
  memo = { day, today };
  return today;
}

let keptMemo: { day: number; broken: readonly string[]; kept: FaithToday } | null = null;

/** O que o bando guarda hoje: o mesmo calendário, menos os jejuns que o Comandante quebrou. */
export function keptToday(day: number, broken: readonly string[]): FaithToday {
  if (keptMemo && keptMemo.day === day && keptMemo.broken === broken) return keptMemo.kept;
  const t = faithToday(day);
  const kept = { holy: t.holy, feast: t.feast, fasting: new Set([...t.fasting].filter((f) => !broken.includes(fastKey(f, day)))) };
  keptMemo = { day, broken, kept };
  return kept;
}

/** Quantos dias até o próximo dia santo, jejum e festa de uma fé (0 = hoje; null = não tem). */
export function faithCalendar(f: FaithId, day: number): { holy: number | null; fast: number | null; feast: number } {
  const year = SEASONS.DAYS * 4;
  const find = (test: (d: number) => boolean): number | null => {
    for (let i = 0; i < year; i++) if (test(day + i)) return i;
    return null;
  };
  return {
    holy: find((d) => isHolyDay(f, d)),
    fast: FAITHS[f].fast ? find((d) => isFasting(f, d)) : null,
    feast: find((d) => isFeast(f, d)) ?? 0,
  };
}

// --- O bando ---

export type FaithMix = Record<FaithId, number>;

/** A parte de cada fé no bando, pelos soldados. */
export function faithMix(battalions: readonly { soldiers: number; faith?: FaithId; culture?: CultureId }[]): FaithMix {
  const mix: FaithMix = { FLAME: 0, VEIL: 0, TIDE: 0, PATH: 0, WORD: 0 };
  const total = battalions.reduce((n, b) => n + b.soldiers, 0);
  if (total === 0) return mix;
  for (const b of battalions) mix[faithOf(b)] += b.soldiers / total;
  return mix;
}

/**
 * Fés em conflito no mesmo bando, cada lado com pelo menos FRICTION_SHARE: o humor do
 * acampamento azeda. O altar põe cada um no seu canto (metade); o templo, de pedra, acaba com
 * a briga.
 */
export function friction(mix: FaithMix, worship: { altar: boolean; temple: boolean }): { pairs: [FaithId, FaithId][]; mood: number } {
  const pairs: [FaithId, FaithId][] = [];
  for (let i = 0; i < FAITH_IDS.length; i++) {
    for (let j = i + 1; j < FAITH_IDS.length; j++) {
      const a = FAITH_IDS[i];
      const b = FAITH_IDS[j];
      if (clash(a, b) && mix[a] >= FAITH.FRICTION_SHARE && mix[b] >= FAITH.FRICTION_SHARE) pairs.push([a, b]);
    }
  }
  const calm = worship.temple ? 0 : worship.altar ? 0.5 : 1;
  return { pairs, mood: -Math.min(2, pairs.length) * FAITH.FRICTION_MOOD * calm };
}

/** Moral que o capelão dá a um batalhão: muita aos da fé dele, um pouco aos outros, nada aos rivais. */
export function chaplainBonus(chaplain: FaithId | null, battalion: FaithId): number {
  if (!chaplain) return 0;
  if (chaplain === battalion) return FAITH.CHAPLAIN_SAME;
  return clash(chaplain, battalion) ? 0 : FAITH.CHAPLAIN_OTHER;
}

/** A fé de mais gente no bando. */
export function mainFaith(mix: FaithMix): FaithId {
  return FAITH_IDS.reduce((best, f) => (mix[f] > mix[best] ? f : best), FAITH_IDS[0]);
}

// --- Os templos ---

/** O que cada templo pensa do bando (−100 a 100). */
export type FaithFavor = Partial<Record<FaithId, number>>;

export function addFavor(favor: FaithFavor, f: FaithId, delta: number): FaithFavor {
  const v = Math.max(-100, Math.min(100, (favor[f] ?? 0) + delta));
  return { ...favor, [f]: Math.round(v * 10) / 10 };
}

/** O favor volta devagar a zero (os templos esquecem). */
export function decayFavor(favor: FaithFavor): FaithFavor {
  const out: FaithFavor = {};
  for (const f of FAITH_IDS) {
    const v = favor[f] ?? 0;
    if (v !== 0) out[f] = Math.round(v * (1 - FAITH.FAVOR_DECAY) * 10) / 10;
  }
  return out;
}

/** Para onde a relação de um reino com o bando tende: o sacerdote fala no conselho. */
export function courtVoice(favor: FaithFavor | undefined, f: FaithId): number {
  return Math.round((favor?.[f] ?? 0) * FAITH.COURT_VOICE * 10) / 10;
}

export function favorText(v: number): string {
  if (v >= 40) return "abençoa o bando";
  if (v >= 10) return "fala bem do bando";
  if (v <= -40) return "amaldiçoa o bando";
  if (v <= -10) return "desconfia do bando";
  return "não pensa no bando";
}

/** O rei abraça a Palavra Nova? Devotos e letrados ouvem mais os pregadores. */
export function convertChance(traits: readonly string[]): number {
  return FAITH.CONVERT_CHANCE * (traits.includes("PIOUS") || traits.includes("SCHOLAR") ? 3 : 1);
}
