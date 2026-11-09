import type { CultureId } from "../data/planet";
import { isFemaleName, wordIn } from "../worldgen/names";
import { LANGUAGE } from "../../utils/constants";
import { hashString } from "../../utils/hash";
import { BAND_HOME, CULTURE_IDS, cultureOf } from "./culture";

/**
 * As línguas (Marco 23, parte 3): cada cultura fala a sua. O Comandante aprende a do lugar com o
 * tempo passado ali; até lá, quem fala por ele é o intérprete (um seguidor), um tenente ou um
 * capitão que saiba as duas. Sem ninguém, o bando entende mal: preços piores, contratos com menos
 * detalhe, boatos truncados, prisioneiros que dizem menos e falas com palavras de lá.
 * As regras são puras: a cena e o store só perguntam.
 */

/** Quanto o Comandante sabe de cada língua, de 0 a 100 (a da terra dele é sempre 100). */
export type Fluency = Partial<Record<CultureId, number>>;

export const TONGUE: Record<CultureId, { label: string; in: string; short: string }> = {
  REALMS: { label: "a língua dos reinos", in: "na língua dos reinos", short: "reinos" },
  SANDS: { label: "a língua das areias", in: "na língua das areias", short: "areias" },
  ISLES: { label: "a língua dos fiordes", in: "na língua dos fiordes", short: "fiordes" },
  JADE: { label: "a língua de jade", in: "na língua de jade", short: "jade" },
};

interface Speaker {
  culture?: CultureId;
  tongues?: Fluency;
}

/** Quanto o Comandante fala de uma língua (0 a 100). */
export function fluencyOf(leader: Speaker, t: CultureId): number {
  if (cultureOf(leader) === t) return 100;
  return Math.max(0, Math.min(100, leader.tongues?.[t] ?? 0));
}

/** O Comandante fala a língua sem ajuda? */
export const isFluent = (leader: Speaker, t: CultureId): boolean => fluencyOf(leader, t) >= LANGUAGE.FLUENT;

/** As línguas que o Comandante fala sem ajuda. */
export function leaderTongues(leader: Speaker): CultureId[] {
  return CULTURE_IDS.filter((t) => isFluent(leader, t));
}

interface Officer {
  name: string;
  culture?: CultureId;
  tongues?: CultureId[];
}

/** As línguas de um oficial: a da terra dele e as que aprendeu (de save antigo, só a da terra). */
export function officerTongues(o: { culture?: CultureId; tongues?: CultureId[] }): CultureId[] {
  const own = cultureOf(o);
  const more = (o.tongues ?? []).filter((t) => t !== own);
  return [own, ...more];
}

export const speaks = (o: { culture?: CultureId; tongues?: CultureId[] }, t: CultureId): boolean => officerTongues(o).includes(t);

/**
 * As línguas de quem é contratado: a dele; quem é de fora já pegou a da terra onde vive; e alguns
 * rodaram o mundo e sabem mais uma (de preferência a dos reinos, a do bando).
 */
export function hireTongues(native: CultureId, land: CultureId, r: number): CultureId[] {
  const out: CultureId[] = [native];
  if (land !== native) out.push(land);
  if (r < LANGUAGE.WELL_TRAVELED) {
    const others = CULTURE_IDS.filter((c) => !out.includes(c));
    const extra = others.includes(BAND_HOME) ? BAND_HOME : others[Math.min(others.length - 1, Math.floor((r / LANGUAGE.WELL_TRAVELED) * others.length))];
    if (extra) out.push(extra);
  }
  return out;
}

export type VoiceBy = "SELF" | "INTERPRETER" | "OFFICER" | "NONE";

export interface Voice {
  /** 0 a 1: quanto o bando entende e se faz entender nessa língua. */
  level: number;
  by: VoiceBy;
  /** Quem fala por ele (o intérprete ou o oficial). */
  who: string | null;
}

export interface VoiceCtx {
  leader: Speaker;
  lieutenants: readonly Officer[];
  captains: readonly Officer[];
  followers: readonly { name: string; role: string; tongue?: CultureId }[];
}

/**
 * Quem fala pelo Comandante numa língua: ele mesmo, se já a fala; o intérprete dela; ou um oficial
 * que saiba essa e uma que o Comandante fale (o oficial se vira, mas não traduz tudo). Sem ninguém,
 * o que ele já aprendeu vale em parte.
 */
export function voiceFor(t: CultureId, ctx: VoiceCtx): Voice {
  const own = fluencyOf(ctx.leader, t);
  if (own >= LANGUAGE.FLUENT) return { level: 1, by: "SELF", who: null };
  const interpreter = ctx.followers.find((f) => f.role === "INTERPRETER" && f.tongue === t);
  if (interpreter) return { level: 1, by: "INTERPRETER", who: interpreter.name };
  const mine = leaderTongues(ctx.leader);
  const officer = [...ctx.captains, ...ctx.lieutenants].find((o) => speaks(o, t) && officerTongues(o).some((x) => x !== t && mine.includes(x)));
  const partial = Math.round((own / LANGUAGE.FLUENT) * 100) / 100;
  if (officer && LANGUAGE.OFFICER_LEVEL > partial) return { level: LANGUAGE.OFFICER_LEVEL, by: "OFFICER", who: officer.name };
  return { level: partial, by: "NONE", who: null };
}

/** O quanto falta entender: 0 (tudo claro) a 1 (nada). */
export const barrierOf = (v: Voice): number => Math.round((1 - v.level) * 100) / 100;

/** A margem do mercador piora com quem não entende o preço (somar à margem do `quote`). */
export const priceMargin = (barrier: number): number => -LANGUAGE.PRICE * barrier;

/** O que se perde: contratos sem detalhe e prisioneiros que dizem menos. */
export const losesDetail = (barrier: number): boolean => barrier > LANGUAGE.DETAIL_BARRIER;

/** Um gerador pequeno a partir de um número (o mesmo texto sai sempre igual). */
function seeded(seed: number): () => number {
  let h = seed >>> 0 || 1;
  return () => {
    h = (Math.imul(h ^ (h >>> 15), 0x2c1b3c6d) + 0x6d2b79f5) >>> 0;
    h ^= h >>> 13;
    return (h >>> 0) / 4294967296;
  };
}

/**
 * O texto como o Comandante o entende: com a barreira, parte das palavras sai na língua de lá.
 * Os números e as palavras curtas ficam (dá para pegar "quantos" e "onde" mesmo sem a língua).
 */
export function garble(text: string, t: CultureId, barrier: number, seed = 0): string {
  const share = barrier * LANGUAGE.GARBLE;
  if (share <= 0) return text;
  let i = 0;
  return text.replace(/[A-Za-zÀ-ÿ]{4,}/g, (word) => {
    const r = seeded(hashString(`${seed}:${i++}:${word}`));
    if (r() >= share) return word;
    const w = wordIn(t, r);
    return word[0] === word[0].toUpperCase() ? w[0].toUpperCase() + w.slice(1) : w;
  });
}

/** "Yusuf, o intérprete" ou "Layla, a intérprete". */
export const interpreterTitle = (name: string): string => `${name}, ${isFemaleName(name) ? "a" : "o"} intérprete`;

/** Uma linha sobre quem falou: "Na língua das areias; Yusuf, o intérprete, traduz." */
export function heardNote(t: CultureId, v: Voice): string | null {
  if (v.by === "SELF") return null;
  const said = TONGUE[t].in[0].toUpperCase() + TONGUE[t].in.slice(1);
  if (v.by === "INTERPRETER") return `${said}; ${interpreterTitle(v.who ?? "?")}, traduz.`;
  if (v.by === "OFFICER") return `${said}; ${v.who} traduz como pode.`;
  return v.level > 0.4 ? `${said}: o Comandante pega uma parte.` : `${said}: o Comandante quase não entende.`;
}

/**
 * Um dia no lugar: o Comandante pega um pouco da língua dele (mais depressa com um intérprete ou um
 * oficial dela ao lado). Diz se ele passou de um marco (o básico, ou falar sem ajuda).
 */
export function learnDay(leader: Speaker, t: CultureId, helped: boolean, days = 1): { tongues: Fluency; reached: "BASIC" | "FLUENT" | null } | null {
  const before = fluencyOf(leader, t);
  if (before >= 100 || cultureOf(leader) === t || days <= 0) return null;
  const after = Math.min(100, Math.round((before + days * LANGUAGE.LEARN_PER_DAY * (helped ? LANGUAGE.LEARN_HELPED : 1)) * 100) / 100);
  const reached = before < LANGUAGE.FLUENT && after >= LANGUAGE.FLUENT ? "FLUENT" : before < LANGUAGE.BASIC && after >= LANGUAGE.BASIC ? "BASIC" : null;
  return { tongues: { ...(leader.tongues ?? {}), [t]: after }, reached };
}

/**
 * Uma ordem de viva voz a um batalhão: o Comandante fala a língua dele, ou o tenente fala as duas.
 * Sem isso a tropa demora a entender (as trombetas e as bandeiras não precisam de língua).
 */
export function orderVoice(leader: Speaker, troops: CultureId, lieutenant: { culture?: CultureId; tongues?: CultureId[] } | null): "SELF" | "LIEUTENANT" | null {
  if (isFluent(leader, troops)) return "SELF";
  if (lieutenant && speaks(lieutenant, troops)) {
    const mine = leaderTongues(leader);
    if (officerTongues(lieutenant).some((x) => mine.includes(x))) return "LIEUTENANT";
  }
  return null;
}

/** "reinos, areias": as línguas de um oficial, curtas. */
export const tonguesText = (list: readonly CultureId[]): string => list.map((t) => TONGUE[t].short).join(", ");
