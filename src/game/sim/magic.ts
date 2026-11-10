import { MAGIC } from "../../utils/constants";
import type { Point } from "../../utils/math";
import type { CultureId } from "../data/planet";

/**
 * As regras da magia do Comandante (Marco 19), sem Phaser: o que cada magia custa, até onde vai,
 * quanto fere e quanto cura, e quando o arcano volta.
 */

export type SpellId = keyof typeof MAGIC.SPELLS;
export const SPELL_IDS = Object.keys(MAGIC.SPELLS) as SpellId[];

/** A tecla de cada magia em campo: 5 para a primeira que o Comandante sabe, 6 para a segunda... até o 0. */
export const SPELL_KEYS = ["FIVE", "SIX", "SEVEN", "EIGHT", "NINE", "ZERO"] as const;
export const SPELL_KEY_LABEL = ["5", "6", "7", "8", "9", "0"] as const;

export type SpellDef = (typeof MAGIC.SPELLS)[SpellId];

export function spellDef(id: SpellId): SpellDef {
  return MAGIC.SPELLS[id];
}

/** Por que não dá para lançar agora (null = dá). */
export function castProblem(
  spell: SpellId,
  s: { known: readonly SpellId[]; arcane: number; readyIn: number },
  from: Point,
  to: Point,
): string | null {
  const def = MAGIC.SPELLS[spell];
  if (!s.known.includes(spell)) return "O Comandante não conhece essa magia.";
  if (s.readyIn > 0) return `${def.name}: ainda faltam ${Math.ceil(s.readyIn)} s.`;
  if (s.arcane < def.cost) return `Arcano de menos para ${def.name.toLowerCase()} (precisa de ${def.cost}).`;
  if (Math.hypot(to.x - from.x, to.y - from.y) > def.range) return "Longe demais.";
  return null;
}

/** O ponto mais perto de `to` que o Comandante alcança (a mira para na borda do alcance). */
export function clampToRange(from: Point, to: Point, range: number): Point {
  const d = Math.hypot(to.x - from.x, to.y - from.y);
  if (d <= range) return { x: to.x, y: to.y };
  return { x: from.x + ((to.x - from.x) / d) * range, y: from.y + ((to.y - from.y) / d) * range };
}

/** O dano da explosão a `dist` do meio: cheio no meio, `EDGE` dele na borda, nada fora. */
export function blastDamage(dist: number, radius = MAGIC.SPELLS.FIREBALL.radius, damage: number = MAGIC.FIREBALL.DAMAGE): number {
  if (dist > radius) return 0;
  const k = dist / radius;
  return damage * (1 - k * (1 - MAGIC.FIREBALL.EDGE));
}

/** Quanto a cura devolve a quem tem `hp` de `maxHp` (sem passar do máximo). */
export function mendAmount(hp: number, maxHp: number): number {
  return Math.max(0, Math.min(maxHp - hp, maxHp * MAGIC.MEND.SHARE));
}

/** O arcano depois de `days` dias (enche devagar, até o máximo). */
export function arcaneAfter(arcane: number, days: number): number {
  return Math.min(MAGIC.ARCANE_MAX, arcane + Math.max(0, days) * MAGIC.ARCANE_PER_DAY);
}

// --- Aprender pelo mundo (parte 3) ---

/** Os grimórios das ruínas assombradas, na ordem em que aparecem. */
export const RUIN_SPELLS: readonly SpellId[] = ["FIREBALL", "FREEZE", "MIST"];
/** O que os magos das cortes sabem (cada corte começa num ponto da lista). */
export const COURT_SPELLS: readonly SpellId[] = ["MEND", "DOUSE", "FIREBALL"];
/** O que os mestres de cada terra ensinam. Na terra do bando não há mestre: é preciso cruzar o mar. */
export const MASTER_SPELLS: Readonly<Record<CultureId, readonly SpellId[]>> = {
  REALMS: [],
  SANDS: ["TERROR", "FIREBALL"],
  ISLES: ["MIST", "FREEZE"],
  JADE: ["TERROR", "MEND"],
};

/** O grimório que umas ruínas guardam: a primeira magia da lista que o Comandante não sabe nem tem em grimório. */
export function nextGrimoire(known: readonly SpellId[], grimoires: readonly SpellId[]): SpellId | null {
  return RUIN_SPELLS.find((s) => !known.includes(s) && !grimoires.includes(s)) ?? null;
}

function hashOf(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return h;
}

/** O que o mago da corte de um povoado sabe e o Comandante ainda não: cada corte começa num ponto da lista. */
export function courtMageSpell(townId: string, known: readonly SpellId[]): SpellId | null {
  const start = hashOf(townId) % COURT_SPELLS.length;
  for (let i = 0; i < COURT_SPELLS.length; i++) {
    const s = COURT_SPELLS[(start + i) % COURT_SPELLS.length];
    if (!known.includes(s)) return s;
  }
  return null;
}

/** O que um mestre desta terra ensina e o Comandante ainda não sabe. */
export function masterOffers(land: CultureId | undefined, known: readonly SpellId[]): SpellId[] {
  return (MASTER_SPELLS[land ?? "REALMS"] ?? []).filter((s) => !known.includes(s));
}

/** Por onde se aprende cada magia (para a interface e os testes). */
export function waysToLearn(spell: SpellId): ("RUINS" | "COURT" | "MASTER")[] {
  const out: ("RUINS" | "COURT" | "MASTER")[] = [];
  if (RUIN_SPELLS.includes(spell)) out.push("RUINS");
  if (COURT_SPELLS.includes(spell)) out.push("COURT");
  if (Object.values(MASTER_SPELLS).some((l) => l.includes(spell))) out.push("MASTER");
  return out;
}

/** Quantas magias cabem no arcano cheio, gastando primeiro a mais barata (para a interface e os testes). */
export function castsPerFill(spells: readonly SpellId[]): number {
  const cheapest = Math.min(...spells.map((s) => MAGIC.SPELLS[s].cost));
  return Number.isFinite(cheapest) ? Math.floor(MAGIC.ARCANE_MAX / cheapest) : 0;
}
