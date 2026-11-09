import { CULTURES, type CultureId } from "../data/planet";
import type { SettlementKind } from "../data/world";
import { CULTURE } from "../../utils/constants";
import { hashString } from "../../utils/hash";

/**
 * Cultura (Marco 23, parte 1): cada povoado tem a sua mistura de gente, e cada um no bando tem
 * uma origem, guardada desde que entrou. As regras são puras: a cena e o store só perguntam.
 */

export const CULTURE_IDS: readonly CultureId[] = ["REALMS", "SANDS", "ISLES", "JADE"];

/** A terra de onde o bando saiu: o fundador e os primeiros batalhões são de lá. */
export const BAND_HOME: CultureId = "REALMS";

/** Parte de cada cultura numa gente (soma 1). */
export type FolkMix = Record<CultureId, number>;

/** De onde alguém do bando vem (quem é de antes do Marco 23 é da terra natal). */
export function cultureOf(x: { culture?: CultureId } | null | undefined): CultureId {
  return x?.culture ?? BAND_HOME;
}

function emptyMix(): FolkMix {
  return { REALMS: 0, SANDS: 0, ISLES: 0, JADE: 0 };
}

/**
 * A gente de um povoado: quase toda da terra, com estrangeiros nos portos e nas cidades grandes
 * (dois povos de fora, um mais que o outro). A vila da sede é metade gente do bando. Sai do id,
 * então é sempre a mesma, sem precisar guardar no save.
 */
export function folkOf(t: { id: string; kind: SettlementKind; port?: boolean; seat?: boolean }, land: CultureId, band: CultureId = BAND_HOME): FolkMix {
  const mix = emptyMix();
  const h = hashString(t.id);
  let foreign = (CULTURE.FOREIGN_SHARE[t.kind] + (t.port ? CULTURE.FOREIGN_PORT : 0)) * (0.6 + ((h % 100) / 100) * 0.8);
  if (t.seat) {
    mix[band] += 0.45;
    foreign *= 0.5;
  }
  const others = CULTURE_IDS.filter((c) => c !== land);
  mix[others[h % others.length]] += foreign * 0.7;
  mix[others[(h >>> 7) % others.length]] += foreign * 0.3;
  const rest = 1 - CULTURE_IDS.reduce((n, c) => n + mix[c], 0);
  mix[land] += rest;
  for (const c of CULTURE_IDS) mix[c] = Math.round(mix[c] * 100) / 100;
  return mix;
}

/** A cultura de mais gente. */
export function mainCulture(mix: FolkMix): CultureId {
  return CULTURE_IDS.reduce((best, c) => (mix[c] > mix[best] ? c : best), CULTURE_IDS[0]);
}

/** Uma pessoa sorteada da gente (`r` de 0 a 1). */
export function pickCulture(mix: FolkMix, r: number): CultureId {
  let acc = 0;
  for (const c of CULTURE_IDS) {
    acc += mix[c];
    if (r < acc) return c;
  }
  return mainCulture(mix);
}

/** "gente de jade", "gente dos reinos"... */
export function peopleOf(c: CultureId): string {
  return CULTURES[c].people;
}

/** A mistura em texto, da maior parte para a menor ("88% gente de jade, 12% gente dos reinos"). */
export function mixText(mix: FolkMix): string {
  return CULTURE_IDS.filter((c) => mix[c] >= 0.01)
    .sort((a, b) => mix[b] - mix[a])
    .map((c) => `${Math.round(mix[c] * 100)}% ${peopleOf(c)}`)
    .join(", ");
}

/** Quem governa: o bando, pela cultura do Comandante; os reinos e o conselho são da terra. */
export function rulerCulture(owner: string, land: CultureId, band: CultureId): CultureId | null {
  if (owner === "RUINED") return null;
  return owner === "PLAYER" ? band : land;
}

/** Lealdade a menos quando quem governa é de outra gente (conforme o tanto da gente que é de lá). */
export function foreignRule(mix: FolkMix, ruler: CultureId | null): number {
  if (!ruler) return 0;
  const main = mainCulture(mix);
  return main === ruler ? 0 : Math.round(CULTURE.FOREIGN_RULE * mix[main] * 10) / 10;
}

/** De onde vem quem se candidata a tenente ou capitão: da terra onde o bando está, ou da terra natal. */
export function officerCulture(r: number, land: CultureId): CultureId {
  if (land !== BAND_HOME) return r < CULTURE.OFFICER_FROM_HOME ? BAND_HOME : land;
  // Na terra natal, um ou outro aventureiro de longe
  if (r < 0.9) return BAND_HOME;
  const others = CULTURE_IDS.filter((c) => c !== BAND_HOME);
  return others[Math.min(others.length - 1, Math.floor(((r - 0.9) / 0.1) * others.length))];
}

/** A gente do bando: a parte de cada cultura, contando os soldados. */
export function bandMix(battalions: readonly { culture?: CultureId; soldiers: number }[]): FolkMix {
  const mix = emptyMix();
  const total = battalions.reduce((n, b) => n + b.soldiers, 0);
  if (total === 0) {
    mix[BAND_HOME] = 1;
    return mix;
  }
  for (const b of battalions) mix[cultureOf(b)] += b.soldiers / total;
  return mix;
}

/** O povoado mais perto de um ponto (quem se alista no acampamento é a gente dali). */
export function nearestFolk<T extends { x: number; y: number }>(towns: readonly T[], at: { x: number; y: number }): T | null {
  let best: T | null = null;
  let d = Infinity;
  for (const t of towns) {
    const dd = (t.x - at.x) ** 2 + (t.y - at.y) ** 2;
    if (dd < d) {
      d = dd;
      best = t;
    }
  }
  return best;
}
