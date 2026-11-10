import { BALANCE, FORMATIONS, PROGRESSION, TROOPS, type TroopType, type UnitStats } from "./constants";
import { SKILLS, SKILL_TREE, type SkillId, type SkillMods } from "../game/data/skills";
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

/**
 * Save de antes da progressão da Fase 3: as duas habilidades de uma linha podiam ser aprendidas
 * (eram dois ramos, cada um com o seu pré-requisito). Hoje a linha é escolha exclusiva: fica a
 * aprendida primeiro, e o ponto da outra volta. Devolve o mesmo objeto se não há o que mudar.
 */
export function exclusiveSkills(b: BattalionData): BattalionData {
  const skills = b.skills ?? [];
  const tree = SKILL_TREE[TROOPS[b.troopType]?.family];
  if (!tree || skills.length < 2) return b;
  const kept = skills.filter((id, i) => {
    const line = tree.find((pair) => pair.includes(id));
    return !line || !skills.slice(0, i).some((x) => line.includes(x));
  });
  if (kept.length === skills.length) return b;
  return { ...b, skills: kept, skillPoints: (b.skillPoints ?? 0) + skills.length - kept.length };
}

/** Pode aprender a habilidade agora? Retorna o motivo se não puder. */
export function canLearn(b: BattalionData, id: SkillId): string | null {
  const skill = SKILLS[id];
  if (skill.troopType !== TROOPS[b.troopType].family) return "Habilidade de outra tropa.";
  if (b.skills.includes(id)) return "Já aprendida.";
  const tree = SKILL_TREE[skill.troopType];
  const line = tree.findIndex((pair) => pair.includes(id));
  const taken = tree[line].find((x) => b.skills.includes(x));
  if (taken) return `${SKILLS[id].label} se perdeu: a escolha foi ${SKILLS[taken].label}.`;
  if (b.level < line + 2) return `Pede o nível ${line + 2}.`;
  if (line > 0 && !tree[line - 1].some((x) => b.skills.includes(x))) return "Escolha a linha de cima primeiro.";
  if (b.skillPoints <= 0) return "Sem pontos de habilidade.";
  return null;
}

/** Quem pode virar quem: a tropa aprende um ofício novo, e isso custa. */
export const PROMOTIONS: Partial<Record<TroopType, readonly TroopType[]>> = {
  INFANTRY: ["HEAVY", "SPEARMEN"],
  SPEARMEN: ["HEAVY"],
  ARCHERS: ["CROSSBOW", "HORSE_ARCHERS"],
  JAVELINS: ["ARCHERS"],
  CAVALRY: ["KNIGHTS", "HORSE_ARCHERS"],
};

export function promotionCost(from: TroopType, to: TroopType): { gold: number; iron: number } {
  return { gold: Math.max(PROGRESSION.PROMOTION_MIN_GOLD, Math.round((TROOPS[to].cost - TROOPS[from].cost) * 1.5)), iron: PROGRESSION.PROMOTION_IRON };
}

/** Pode ser promovido a esta tropa? Retorna o motivo se não puder. */
export function canPromote(b: Pick<BattalionData, "troopType" | "level">, to: TroopType): string | null {
  if (!PROMOTIONS[b.troopType]?.includes(to)) return "Esta tropa não vira aquela.";
  if (b.level < PROGRESSION.PROMOTION_LEVEL) return `Pede o nível ${PROGRESSION.PROMOTION_LEVEL}.`;
  return null;
}

/** Custo do treino: quanto mais veterano, mais caro ensinar. */
export function trainingCost(level: number): number {
  return PROGRESSION.TRAINING_COST * level;
}

export function canTrain(level: number): boolean {
  return level < PROGRESSION.TRAINING_MAX_LEVEL;
}

export function forgeCost(currentTier: number, smith = false): { gold: number; iron: number } {
  // Com um ajudante de ferreiro entre os seguidores, a Ferraria gasta 25% menos
  const k = smith ? 0.75 : 1;
  return { gold: Math.round(PROGRESSION.FORGE_GOLD * (currentTier + 1) * k), iron: Math.round(PROGRESSION.FORGE_IRON * (currentTier + 1) * k) };
}

/** Modificadores finais do batalhão: nível × habilidades × equipamento. */
export interface BattalionMods extends Required<Pick<SkillMods, "hp" | "damage" | "range" | "cooldown" | "speed" | "meleeTaken" | "rangedTaken" | "moraleLoss" | "chargeDistance" | "knockback">> {
  chargeBonus: number;
  rankSupport: number;
  flankDamage: number;
  panicBelow: number;
  meleeShock: number;
  spread: number;
  ammo: number;
  arrowShock: number;
  moveFire: boolean;
  breakThrough: number;
  cycleHit: number;
  chargeShock: number;
  huntDamage: number;
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
    rankSupport: 1,
    flankDamage: 1,
    panicBelow: BALANCE.MORALE.PANIC_BELOW,
    meleeShock: 0,
    spread: 1,
    ammo: 1,
    arrowShock: 1,
    moveFire: false,
    breakThrough: 1,
    cycleHit: 1,
    chargeShock: 1,
    huntDamage: 1,
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
    mods.rankSupport *= m.rankSupport ?? 1;
    mods.flankDamage *= m.flankDamage ?? 1;
    mods.panicBelow = Math.min(mods.panicBelow, m.panicBelow ?? Infinity);
    mods.meleeShock += m.meleeShock ?? 0;
    mods.spread *= m.spread ?? 1;
    mods.ammo *= m.ammo ?? 1;
    mods.arrowShock *= m.arrowShock ?? 1;
    mods.moveFire ||= !!m.moveFire;
    mods.breakThrough *= m.breakThrough ?? 1;
    mods.cycleHit *= m.cycleHit ?? 1;
    mods.chargeShock *= m.chargeShock ?? 1;
    mods.huntDamage *= m.huntDamage ?? 1;
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
    ...(base.ranged ? { spread: (base.spread ?? 1) * mods.spread } : {}),
    ...(base.ammo === undefined ? {} : { ammo: Math.round(base.ammo * mods.ammo) }),
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
  if (m.rankSupport !== 1) lines.push(`Apoio das fileiras ${pct(m.rankSupport)}`);
  if (m.flankDamage !== 1) lines.push(`Dano pelo flanco ${pct(m.flankDamage)}`);
  if (m.panicBelow !== BALANCE.MORALE.PANIC_BELOW) lines.push(`Pânico só com moral abaixo de ${m.panicBelow}`);
  if (m.meleeShock) lines.push(`Golpes abalam a moral do alvo`);
  if (m.spread !== 1) lines.push(`Dispersão das flechas ${pct(m.spread)}`);
  if (m.ammo !== 1) lines.push(`Munição ${pct(m.ammo)}`);
  if (m.arrowShock !== 1) lines.push(`Abalo das flechas ${pct(m.arrowShock)}`);
  if (m.moveFire) lines.push("Atira enquanto anda");
  if (m.breakThrough !== 1) lines.push(`Passagem pela linha inimiga ${pct(m.breakThrough)}`);
  if (m.cycleHit !== 1) lines.push(`Tempo no choque ${pct(m.cycleHit)}`);
  if (m.chargeShock !== 1) lines.push(`Abalo da investida ${pct(m.chargeShock)}`);
  if (m.huntDamage !== 1) lines.push(`Dano em quem foge e em quem atira ${pct(m.huntDamage)}`);
  if (m.chargeDistance !== 1) lines.push(`Distância para a investida ${pct(m.chargeDistance)}`);
  if (m.knockback !== 1) lines.push(`Empurrão da investida ${pct(m.knockback)}`);
  return lines;
}
