import { COLORS, ENEMIES, type EnemyKind, type TroopType } from "../../utils/constants";
import type { FigureBody, HeadGear, Look, ShieldKind, Vehicle, Weapon } from "./figures";

/**
 * Visual de cada tropa e de cada inimigo: corpo, cabeça, armadura, arma, escudo e montaria.
 * O que dá para tirar dos atributos (montado, armadura, escudo, quem atira) sai deles; o resto
 * é a cara da tropa.
 */

const TROOP_LOOKS: Record<TroopType, Omit<Look, "color">> = {
  INFANTRY: { body: "HUMAN", head: "HELM", armor: 1, weapon: "SWORD", shield: "ROUND", mount: "NONE" },
  SPEARMEN: { body: "HUMAN", head: "HELM", armor: 1, weapon: "SPEAR", shield: "ROUND", mount: "NONE" },
  HEAVY: { body: "HUMAN", head: "GREAT_HELM", armor: 2, weapon: "SWORD", shield: "KITE", mount: "NONE" },
  ARCHERS: { body: "HUMAN", head: "HOOD", armor: 0, weapon: "BOW", shield: "NONE", mount: "NONE" },
  CROSSBOW: { body: "HUMAN", head: "HELM", armor: 1, weapon: "CROSSBOW", shield: "NONE", mount: "NONE" },
  JAVELINS: { body: "HUMAN", head: "CAP", armor: 0, weapon: "JAVELIN", shield: "NONE", mount: "NONE" },
  CAVALRY: { body: "HUMAN", head: "HELM", armor: 1, weapon: "SWORD", shield: "NONE", mount: "HORSE" },
  KNIGHTS: { body: "HUMAN", head: "GREAT_HELM", armor: 2, weapon: "LANCE", shield: "KITE", mount: "BARDED" },
  HORSE_ARCHERS: { body: "HUMAN", head: "HOOD", armor: 0, weapon: "BOW", shield: "NONE", mount: "HORSE" },
};

const TROOP_COLORS: Record<TroopType, number> = {
  INFANTRY: COLORS.ALLY,
  SPEARMEN: COLORS.ALLY_SPEAR,
  HEAVY: COLORS.ALLY_HEAVY,
  ARCHERS: COLORS.ALLY_ARCHER,
  CROSSBOW: COLORS.ALLY_CROSSBOW,
  JAVELINS: COLORS.ALLY_JAVELIN,
  CAVALRY: COLORS.ALLY_CAVALRY,
  KNIGHTS: COLORS.ALLY_KNIGHT,
  HORSE_ARCHERS: COLORS.ALLY_ARCHER,
};

export function troopLook(troop: TroopType, color = TROOP_COLORS[troop]): Look {
  return { ...TROOP_LOOKS[troop], color };
}

/** Amotinados usam o equipamento da tropa de onde saíram. */
const MUTINY: Partial<Record<EnemyKind, TroopType>> = { MUTINEER: "INFANTRY", MUTINEER_ARCHER: "ARCHERS", MUTINEER_RIDER: "CAVALRY" };

const SPEARS = new Set<EnemyKind>(["GOBLIN_SPEAR", "SAND_SPEAR", "PIKEMAN", "PIKE_LEVY", "JADE_GUARD"]);
const LANCES = new Set<EnemyKind>(["LANCER", "KNIGHT", "DEATH_KNIGHT", "MAMELUKE"]);
const AXES = new Set<EnemyKind>(["AXEMAN", "HOUSECARL", "ORC", "ORC_BRUTE", "ORC_CHIEF", "ORC_CAPTAIN", "ORC_WARLORD", "PIRATE"]);
const CROSSBOWS = new Set<EnemyKind>(["CROSSBOW", "REPEATER", "PIRATE_BOW"]);
const UNARMED = new Set<EnemyKind>(["CIVILIAN", "MERCHANT", "COURIER", "HERALD"]);

function bodyOf(kind: EnemyKind): FigureBody {
  if (kind.startsWith("GOBLIN") || kind === "WOLF_RIDER") return "GOBLIN";
  if (kind.startsWith("ORC")) return "ORC";
  if (kind.startsWith("SKELETON") || kind === "BONE_GUARD" || kind === "DEATH_KNIGHT") return "SKELETON";
  return "HUMAN";
}

function weaponOf(kind: EnemyKind, ranged: boolean, mounted: boolean): Weapon {
  if (kind === "NECROMANCER") return "STAFF";
  if (UNARMED.has(kind)) return "NONE";
  if (ranged) return CROSSBOWS.has(kind) ? "CROSSBOW" : kind === "BANDIT_JAVELIN" ? "JAVELIN" : "BOW";
  if (LANCES.has(kind)) return mounted ? "LANCE" : "SPEAR";
  if (SPEARS.has(kind)) return "SPEAR";
  if (AXES.has(kind)) return "AXE";
  return "SWORD";
}

function headOf(kind: EnemyKind, body: FigureBody, armor: 0 | 1 | 2, ranged: boolean, officer: boolean): HeadGear {
  if (kind.startsWith("PIRATE")) return "BANDANA";
  if (kind === "NECROMANCER") return "HOOD";
  if (kind === "CIVILIAN" || kind === "MERCHANT") return "HAIR";
  if (kind === "COURIER" || kind === "HERALD") return "CAP";
  if (body === "GOBLIN" || body === "ORC" || body === "SKELETON") return armor > 0 || officer ? "HELM" : "BARE";
  if (kind.startsWith("BANDIT")) return officer ? "HELM" : "HOOD";
  if (armor === 2) return "GREAT_HELM";
  if (armor === 1) return "HELM";
  return ranged ? "HOOD" : "CAP";
}

export function enemyLook(kind: EnemyKind, color: number): Look | null {
  const def = ENEMIES[kind];
  if (kind === "CART") return vehicleLook("CART", color);
  if (kind === "SIEGE_RAM") return vehicleLook("RAM", color);
  if (kind === "WOLF") return { beast: "WOLF", body: "HUMAN", head: "BARE", armor: 0, weapon: "NONE", shield: "NONE", mount: "NONE", color };
  const mutiny = MUTINY[kind];
  if (mutiny) return troopLook(mutiny, color);
  const s = def.stats;
  const body = bodyOf(kind);
  const armorStat = s.armor ?? 0;
  const armor: 0 | 1 | 2 = armorStat >= 0.35 ? 2 : armorStat >= 0.1 ? 1 : 0;
  const ranged = !!s.ranged;
  const mounted = !!s.mounted || kind === "COURIER" || kind === "HERALD" || kind === "OUTRIDER";
  const officer = !!def.officer || !!def.boss;
  const shield: ShieldKind = (s.shield ?? 0) > 0 && !ranged ? (armor === 2 ? "KITE" : "ROUND") : "NONE";
  return {
    body,
    head: headOf(kind, body, armor, ranged, officer),
    armor,
    weapon: weaponOf(kind, ranged, mounted),
    shield,
    mount: kind === "WOLF_RIDER" ? "WOLF" : mounted ? (armor === 2 ? "BARDED" : "HORSE") : "NONE",
    color,
    ...(def.officer === "CHIEF" || def.boss ? { trim: 0xf1c40f } : def.officer ? { trim: 0xdfe3ee } : {}),
    ...(kind === "NECROMANCER" ? { trim: 0xb070ff, cape: 0x2a1438, eyes: 0xd8a8ff } : {}),
    ...(kind === "ORC_WARLORD" ? { horns: true, cape: 0x5a1a14 } : {}),
    ...(def.boss ? { scale: 2 as const } : {}),
  };
}

/** Veículo (G4): só o tipo e a cor contam (o resto do visual é de enfeite). */
export function vehicleLook(vehicle: Vehicle, color: number): Look {
  return { vehicle, body: "HUMAN", head: "BARE", armor: 0, weapon: "NONE", shield: "NONE", mount: "NONE", color };
}

/** O Comandante: capa e penacho dourados, para ser achado de longe no meio da tropa. */
export function commanderLook(): Look {
  return { body: "HUMAN", head: "HELM", armor: 1, weapon: "SWORD", shield: "ROUND", mount: "NONE", color: COLORS.ALLY, trim: COLORS.COMMANDER_OUTLINE, cape: 0x8a2a2a };
}

export function scoutLook(): Look {
  return { body: "HUMAN", head: "HOOD", armor: 0, weapon: "BOW", shield: "NONE", mount: "HORSE", color: COLORS.SCOUT };
}

export function messengerLook(): Look {
  return { body: "HUMAN", head: "CAP", armor: 0, weapon: "NONE", shield: "NONE", mount: "HORSE", color: COLORS.MESSENGER, trim: COLORS.PENNANT };
}
