import type { EnemyGroupDef } from "../data/battleMaps";
import { SITE_LIFE, type EnemyKind } from "../../utils/constants";
import { distance, type Point } from "../../utils/math";

/**
 * Locais de missão sempre habitados (Fase 3, etapa 10). Cada local tem moradores fixos, com uma
 * parte da força que o contrato traria. Limpo, fica vazio por uns dias e volta a se encher devagar.
 *
 * O store guarda só quanto o local tinha (`fill`, de 0 a 1) e desde quando (`since`): o quanto ele
 * tem hoje sai da conta, sem nada a rodar por dia.
 */
export interface SiteLife {
  fill: number;
  since: number;
}

/** Quanto o local tem agora (0 a 1). Sem registro, está cheio (também nos saves antigos). */
export function siteFill(life: SiteLife | undefined, now: number): number {
  if (!life || life.fill >= 1) return 1;
  const fill = Math.max(0, life.fill);
  // Vazio de todo, ninguém volta logo; com gente ainda lá, os outros começam a voltar já
  const wait = fill <= 0 ? SITE_LIFE.EMPTY_DAYS : 0;
  return Math.min(1, fill + Math.max(0, now - life.since - wait) * SITE_LIFE.REGROW_PER_DAY);
}

/**
 * Os moradores do local: os mesmos grupos do contrato, com `SHARE` da força, conforme o quanto o
 * local está cheio. Local quase vazio ainda tem um morador (o primeiro a voltar).
 */
export function residentGroups(groups: readonly EnemyGroupDef[], fill: number): EnemyGroupDef[] {
  const share = SITE_LIFE.SHARE * Math.max(0, Math.min(1, fill));
  if (share <= 0) return [];
  const out = groups
    .map((g) => ({ ...g, units: g.units.map(([kind, n]) => [kind, Math.round(n * share)] as [EnemyKind, number]).filter(([, n]) => n > 0) }))
    .filter((g) => g.units.length > 0);
  const first = groups[0];
  if (out.length === 0 && first?.units[0]) return [{ ...first, units: [[first.units[0][0], 1]] }];
  return out;
}

/** Covis que podem mandar bando: os perto de um local vazio ficam quietos até ele se encher de novo. */
export function activeLairs(lairs: readonly Point[], sites: readonly { id: string; center: Point }[], fillOf: (id: string) => number): Point[] {
  const quiet = sites.filter((s) => fillOf(s.id) < SITE_LIFE.QUIET_BELOW);
  if (quiet.length === 0) return [...lairs];
  return lairs.filter((l) => !quiet.some((s) => distance(s.center, l) < SITE_LIFE.QUIET_RADIUS));
}
