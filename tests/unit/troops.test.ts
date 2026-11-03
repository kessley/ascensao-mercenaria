import { describe, expect, it } from "vitest";
import { SKILL_TREE, SKILLS } from "../../src/game/data/skills";
import { armorFactor, hitChance } from "../../src/game/sim/combatRules";
import { COMBAT, ENEMIES, FORMATIONS, MUTINEER_OF, TROOPS, WAR_AI, type EnemyKind, type TroopType } from "../../src/utils/constants";

const troops = Object.keys(TROOPS) as TroopType[];
const enemies = Object.keys(ENEMIES) as EnemyKind[];

/** Dano esperado por segundo de `a` batendo de frente em `b`, para comparar tropas. */
function dps(a: TroopType, b: TroopType): number {
  const s = TROOPS[a].stats;
  const t = TROOPS[b].stats;
  const hit = hitChance(s.attack ?? 40, t.defense ?? 40, "FRONT");
  return ((s.damage * (t.mounted ? (s.antiCavalry ?? 1) : 1) * COMBAT.DAMAGE_PACE * hit * armorFactor(t.armor ?? 0, s.pierce ?? 0)) / s.cooldown) * 1000;
}

describe("tropas do jogador", () => {
  it("são pelo menos nove, em três famílias", () => {
    expect(troops.length).toBeGreaterThanOrEqual(9);
    expect(new Set(troops.map((t) => TROOPS[t].family))).toEqual(new Set(["INFANTRY", "ARCHERS", "CAVALRY"]));
  });

  it("cada uma tem formação conhecida, dica e custo", () => {
    for (const t of troops) {
      expect(TROOPS[t].formations.length).toBeGreaterThan(0);
      for (const f of TROOPS[t].formations) expect(FORMATIONS[f]).toBeDefined();
      expect(TROOPS[t].hint.length).toBeGreaterThan(10);
      expect(TROOPS[t].cost).toBeGreaterThan(0);
    }
  });

  it("quem atira tem munição e fica na família dos que atiram ou a cavalo", () => {
    for (const t of troops) {
      const s = TROOPS[t].stats;
      if (s.ranged) expect(s.ammo).toBeGreaterThan(0);
      if (s.ranged) expect(["ARCHERS", "CAVALRY"]).toContain(TROOPS[t].family);
    }
  });

  it("toda família tem árvore de habilidades e tipo de amotinado", () => {
    for (const family of ["INFANTRY", "ARCHERS", "CAVALRY"] as const) {
      expect(SKILL_TREE[family].length).toBeGreaterThan(0);
      for (const branch of SKILL_TREE[family]) for (const id of branch) expect(SKILLS[id].troopType).toBe(family);
      expect(MUTINEER_OF[family]).toBeDefined();
    }
  });

  it("toda tropa pesada custa e pesa mais do que a comum", () => {
    expect(TROOPS.HEAVY.cost).toBeGreaterThan(TROOPS.INFANTRY.cost);
    expect(TROOPS.HEAVY.stats.mass ?? 1).toBeGreaterThan(TROOPS.INFANTRY.stats.mass ?? 1);
    expect(TROOPS.KNIGHTS.cost).toBeGreaterThan(TROOPS.CAVALRY.cost);
    expect(TROOPS.KNIGHTS.stats.mass ?? 1).toBeGreaterThan(TROOPS.CAVALRY.stats.mass ?? 1);
  });
});

describe("cada tropa tem um papel", () => {
  it("lanças batem mais em cavalo; contra infantaria, menos que a espada", () => {
    expect(dps("SPEARMEN", "CAVALRY")).toBeGreaterThan(dps("INFANTRY", "CAVALRY"));
    expect(dps("SPEARMEN", "INFANTRY")).toBeLessThan(dps("INFANTRY", "INFANTRY"));
  });

  it("a guarda pesada vence a infantaria no um a um", () => {
    expect(dps("HEAVY", "INFANTRY")).toBeGreaterThan(dps("INFANTRY", "HEAVY") * 1.5);
  });

  it("a guarda pesada é mais lenta que a infantaria", () => {
    expect(TROOPS.HEAVY.stats.speed).toBeLessThan(TROOPS.INFANTRY.stats.speed);
  });

  it("dardeiros correm mais e alcançam menos que arqueiros", () => {
    expect(TROOPS.JAVELINS.stats.speed).toBeGreaterThan(TROOPS.ARCHERS.stats.speed);
    expect(TROOPS.JAVELINS.stats.range).toBeLessThan(TROOPS.ARCHERS.stats.range);
  });

  it("besta atira devagar, atravessa armadura e é mais precisa que o arco", () => {
    expect(TROOPS.CROSSBOW.stats.cooldown).toBeGreaterThan(TROOPS.ARCHERS.stats.cooldown);
    expect(TROOPS.CROSSBOW.stats.pierce ?? 0).toBeGreaterThan(TROOPS.ARCHERS.stats.pierce ?? 0);
    expect(TROOPS.CROSSBOW.stats.spread ?? 1).toBeLessThan(TROOPS.ARCHERS.stats.spread ?? 1);
  });

  it("cavaleiros têm a investida mais forte", () => {
    expect(TROOPS.KNIGHTS.stats.charge ?? 1).toBeGreaterThan(TROOPS.CAVALRY.stats.charge ?? 1);
  });
});

describe("inimigos", () => {
  it("todos têm atributos válidos", () => {
    for (const k of enemies) {
      const s = ENEMIES[k].stats;
      expect(s.hp, k).toBeGreaterThan(0);
      expect(s.armor ?? 0, k).toBeLessThan(1);
      expect(s.shield ?? 0, k).toBeLessThan(1);
    }
  });

  it("quem atira e luta tem munição ou é chefe de calamidade", () => {
    for (const k of enemies) {
      const s = ENEMIES[k].stats;
      if (s.ranged) expect(s.ammo, k).toBeDefined();
    }
  });

  it("esqueletos não sentem medo; quem sabe lutar sente menos", () => {
    expect(WAR_AI.DISCIPLINE.SKELETON).toBe(0);
    expect(WAR_AI.DISCIPLINE.SKELETON_ARCHER).toBe(0);
    expect(WAR_AI.DISCIPLINE.MAN_AT_ARMS ?? 1).toBeLessThan(WAR_AI.DISCIPLINE.GOBLIN ?? 1);
  });

  it("lanceiros inimigos seguram cavalo", () => {
    expect(ENEMIES.PIKEMAN.stats.brace).toBe(true);
    expect(ENEMIES.GOBLIN_SPEAR.stats.brace).toBe(true);
  });

  it("amotinados herdam os atributos da tropa", () => {
    expect(ENEMIES.MUTINEER.stats.armor).toBe(TROOPS.INFANTRY.stats.armor);
    expect(ENEMIES.MUTINEER_RIDER.stats.mounted).toBe(true);
  });
});
