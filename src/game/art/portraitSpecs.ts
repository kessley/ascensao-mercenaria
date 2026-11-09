import type { Culture } from "./buildings";
import { hashSeed, type PortraitSpec } from "./portraits";
import { CAPTAIN_WOMEN, type CaptainData } from "../data/captains";
import { LIEUTENANT_WOMEN, type LieutenantData } from "../data/lieutenants";
import type { Leader } from "../sim/legacy";
import type { Noble } from "../sim/nobility";
import { isFemaleName } from "../worldgen/names";
import { COLORS } from "../../utils/constants";

/**
 * De quem é cada retrato (G5, parte 4): o que o jogo sabe de cada personagem vira um `PortraitSpec`.
 * O bando vem dos Reinos (é estrangeiro nas outras terras, Marco 17); quem entra nele vem de toda
 * parte; os nobres são da terra.
 */

const CULTURES: readonly Culture[] = ["REALMS", "SANDS", "ISLES", "JADE"];

/** A terra de onde o bando saiu. */
export const BAND_HOME: Culture = "REALMS";

/** O nome é de mulher? (as listas dos reinos, dos capitães e dos tenentes) */
export function isWoman(name: string): boolean {
  const first = name.split(" ")[0];
  return isFemaleName(name) || CAPTAIN_WOMEN.has(first) || LIEUTENANT_WOMEN.has(first);
}

/** Metade do bando é da terra natal, a maior parte do resto é da terra onde ele está, e um ou outro veio de mais longe. */
export function bandCulture(seed: string, world: Culture): Culture {
  const r = hashSeed(`${seed}#terra`) % 100;
  if (r < 50) return BAND_HOME;
  if (r < 85) return world;
  return CULTURES[r % CULTURES.length];
}

/** Idade de quem não tem idade guardada: sai da semente (22 a 45). */
export function bandAge(seed: string): number {
  return 22 + (hashSeed(`${seed}#idade`) % 24);
}

export function commanderPortrait(leader: Pick<Leader, "name" | "generation" | "wounds" | "face">, age: number, world: Culture): PortraitSpec {
  const seed = leader.face ?? `${leader.name}#${leader.generation}`;
  return {
    seed,
    female: isWoman(leader.name),
    age,
    // Quem fundou o bando é da terra natal; os herdeiros, de onde vieram
    culture: leader.generation === 1 && !leader.face ? BAND_HOME : bandCulture(seed, world),
    scars: leader.wounds,
    role: "COMMANDER",
    color: COLORS.ALLY,
  };
}

export function captainPortrait(c: Pick<CaptainData, "id" | "name" | "origin" | "battles">, world: Culture): PortraitSpec {
  return {
    seed: c.id,
    female: isWoman(c.name),
    age: bandAge(c.id) + Math.floor(c.battles / 8),
    // O nobre sem terra e o inimigo que mudou de lado são da terra
    culture: c.origin === "NOBLE" || c.origin === "CAPTURED" ? world : bandCulture(c.id, world),
    scars: Math.min(4, Math.floor(c.battles / 5)),
    role: "CAPTAIN",
    color: COLORS.ALLY,
  };
}

export function lieutenantPortrait(l: Pick<LieutenantData, "id" | "name" | "kills">, world: Culture): PortraitSpec {
  return {
    seed: l.id,
    female: isWoman(l.name),
    age: bandAge(l.id),
    culture: bandCulture(l.id, world),
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
