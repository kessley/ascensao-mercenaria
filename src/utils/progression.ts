import { BALANCE, FORMATIONS, PROGRESSION, TROOPS, type UnitStats } from "./constants";
import { SKILLS, type SkillId, type SkillMods } from "../game/data/skills";
import type { BattalionData } from "../store/useGameStore";

export type EquipmentSlot = "weapon" | "armor";

/** XP necessária para sair do nível atual. */
export function xpToNextLevel(level: number): number {
  return PROGRESSION.XP_PER_LEVEL * level;
}

/** Soma XP e aplica as subidas de nível (cada nível dá 1 ponto de habilidade). */
export function gainXp(b: BattalionData, amount: number): { battalion: BattalionData; levelsGained: number } {
  let { level, xp, skillPoints } = b;
  xp += amount;
  let levelsGained = 0;
  while (level < PROGRESSION.MAX_LEVEL && xp >= xpToNextLevel(level)) {
    xp -= xpToNextLevel(level);
    level++;
    skillPoints++;
    levelsGained++;
  }
  if (level >= PROGRESSION.MAX_LEVEL) xp = 0;
  return { battalion: { ...b, level, xp, skillPoints }, levelsGained };
}

/** Pode aprender a habilidade agora? Retorna o motivo se não puder. */
export function canLearn(b: BattalionData, id: SkillId): string | null {
  const skill = SKILLS[id];
  if (skill.troopType !== b.troopType) return "Habilidade de outra tropa.";
  if (b.skills.includes(id)) return "Já aprendida.";
  if (skill.requires && !b.skills.includes(skill.requires)) return `Requer ${SKILLS[skill.requires].label}.`;
  if (b.skillPoints <= 0) return "Sem pontos de habilidade.";
  return null;
}

export function forgeCost(currentTier: number): { gold: number; iron: number } {
  return { gold: PROGRESSION.FORGE_GOLD * (currentTier + 1), iron: PROGRESSION.FORGE_IRON * (currentTier + 1) };
}

/** Modificadores finais do batalhão: nível × habilidades × equipamento. */
export interface BattalionMods extends Required<Omit<SkillMods, "chargeBonus">> {
  chargeBonus: number;
  /** Arco de proteção e velocidade da Parede de Escudos (Muralha Viva melhora). */
  shieldWallArc: number;
  shieldWallSpeed: number;
}

export function battalionMods(b: BattalionData): BattalionMods {
  const levelBonus = 1 + PROGRESSION.LEVEL_STAT_BONUS * (b.level - 1);
  const mods: BattalionMods = {
    hp: levelBonus,
    damage: levelBonus * (1 + PROGRESSION.WEAPON_DAMAGE_PER_TIER * b.equipment.weapon),
    range: 1,
    cooldown: 1,
    speed: 1,
    meleeTaken: 1 - PROGRESSION.ARMOR_REDUCTION_PER_TIER * b.equipment.armor,
    rangedTaken: 1 - PROGRESSION.ARMOR_REDUCTION_PER_TIER * b.equipment.armor,
    moraleLoss: 1,
    chargeBonus: 0,
    chargeDistance: 1,
    knockback: 1,
    shieldWallArc: FORMATIONS.SHIELD_WALL.frontArc ?? Math.PI / 3,
    shieldWallSpeed: FORMATIONS.SHIELD_WALL.speed,
  };
  for (const id of b.skills) {
    const m = SKILLS[id].mods;
    mods.hp *= m.hp ?? 1;
    mods.damage *= m.damage ?? 1;
    mods.range *= m.range ?? 1;
    mods.cooldown *= m.cooldown ?? 1;
    mods.speed *= m.speed ?? 1;
    mods.meleeTaken *= m.meleeTaken ?? 1;
    mods.rangedTaken *= m.rangedTaken ?? 1;
    mods.moraleLoss *= m.moraleLoss ?? 1;
    mods.chargeBonus += m.chargeBonus ?? 0;
    mods.chargeDistance *= m.chargeDistance ?? 1;
    mods.knockback *= m.knockback ?? 1;
  }
  if (b.skills.includes("LIVING_WALL")) {
    mods.shieldWallArc = Math.PI * 0.6; // ~108°: cobre boa parte dos flancos
    mods.shieldWallSpeed = 0.75;
  }
  return mods;
}

/** Atributos de um soldado deste batalhão (base da tropa com os modificadores). */
export function soldierStats(b: BattalionData, mods: BattalionMods): UnitStats {
  const base = TROOPS[b.troopType].stats;
  return {
    ...base,
    hp: Math.round(base.hp * mods.hp),
    damage: base.damage * mods.damage,
    range: base.range * mods.range,
    cooldown: base.cooldown * mods.cooldown,
    speed: base.speed * mods.speed,
  };
}

/** Resumo legível dos bônus (para a UI). */
export function describeMods(b: BattalionData): string[] {
  const m = battalionMods(b);
  const pct = (x: number) => `${x >= 1 ? "+" : "−"}${Math.round(Math.abs(x - 1) * 100)}%`;
  const lines: string[] = [];
  if (m.hp !== 1) lines.push(`Vida ${pct(m.hp)}`);
  if (m.damage !== 1) lines.push(`Dano ${pct(m.damage)}`);
  if (m.range !== 1) lines.push(`Alcance ${pct(m.range)}`);
  if (m.cooldown !== 1) lines.push(`Cadência ${pct(1 / m.cooldown)}`);
  if (m.speed !== 1) lines.push(`Velocidade ${pct(m.speed)}`);
  if (m.meleeTaken !== 1) lines.push(`Dano corpo a corpo recebido ${pct(m.meleeTaken)}`);
  if (m.rangedTaken !== 1) lines.push(`Dano de flechas recebido ${pct(m.rangedTaken)}`);
  if (m.moraleLoss !== 1) lines.push(`Perda de moral ${pct(m.moraleLoss)}`);
  if (m.chargeBonus) lines.push(`Investida ${BALANCE.CHARGE_MULTIPLIER + m.chargeBonus}x`);
  return lines;
}
