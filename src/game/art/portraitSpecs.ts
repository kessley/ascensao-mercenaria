import type { Culture } from "./buildings";
import { hashSeed, type PortraitSpec } from "./portraits";
import { CAPTAIN_WOMEN, type CaptainData } from "../data/captains";
import { LIEUTENANT_WOMEN, type LieutenantData } from "../data/lieutenants";
import type { Leader } from "../sim/legacy";
import type { Noble } from "../sim/nobility";
import { BAND_HOME } from "../sim/culture";
import { isFemaleName } from "../worldgen/names";
import { COLORS } from "../../utils/constants";

/**
 * De quem é cada retrato (G5, parte 4): o que o jogo sabe de cada personagem vira um `PortraitSpec`.
 * A cultura é a guardada em cada um desde que entrou no bando (Marco 23); os nobres são da terra.
 */

export { BAND_HOME };

/** O nome é de mulher? (as listas dos reinos, dos capitães e dos tenentes) */
export function isWoman(name: string): boolean {
  const first = name.split(" ")[0];
  return isFemaleName(name) || CAPTAIN_WOMEN.has(first) || LIEUTENANT_WOMEN.has(first);
}

/** Idade de quem não tem idade guardada: sai da semente (22 a 45). */
export function bandAge(seed: string): number {
  return 22 + (hashSeed(`${seed}#idade`) % 24);
}

export function commanderPortrait(leader: Pick<Leader, "name" | "generation" | "wounds" | "face" | "culture">, age: number): PortraitSpec {
  return {
    seed: leader.face ?? `${leader.name}#${leader.generation}`,
    female: isWoman(leader.name),
    age,
    culture: leader.culture ?? BAND_HOME,
    scars: leader.wounds,
    role: "COMMANDER",
    color: COLORS.ALLY,
  };
}

export function captainPortrait(c: Pick<CaptainData, "id" | "name" | "origin" | "battles" | "culture">, world: Culture): PortraitSpec {
  return {
    seed: c.id,
    female: isWoman(c.name),
    age: bandAge(c.id) + Math.floor(c.battles / 8),
    // Sem origem guardada: o nobre sem terra e o inimigo que mudou de lado são da terra
    culture: c.culture ?? (c.origin === "NOBLE" || c.origin === "CAPTURED" ? world : BAND_HOME),
    scars: Math.min(4, Math.floor(c.battles / 5)),
    role: "CAPTAIN",
    color: COLORS.ALLY,
  };
}

export function lieutenantPortrait(l: Pick<LieutenantData, "id" | "name" | "kills" | "culture">): PortraitSpec {
  return {
    seed: l.id,
    female: isWoman(l.name),
    age: bandAge(l.id),
    culture: l.culture ?? BAND_HOME,
    scars: Math.min(3, Math.floor(l.kills / 30)),
    role: "LIEUTENANT",
    color: COLORS.ALLY,
  };
}

export function noblePortrait(n: Pick<Noble, "id" | "female" | "age" | "rank" | "martial">, factionColor: number, world: Culture): PortraitSpec {
  return {
    seed: n.id,
    female: n.female,
    age: n.age,
    culture: world,
    scars: n.martial >= 8 ? 1 : 0,
    role: "NOBLE",
    color: factionColor,
    crown: n.rank === "RULER" ? "CROWN" : n.rank === "CONSORT" || n.rank === "HEIR" ? "CIRCLET" : undefined,
  };
}
