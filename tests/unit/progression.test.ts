import { describe, expect, it } from "vitest";
import { SKILLS, SKILL_TREE, type SkillId } from "../../src/game/data/skills";
import type { BattalionData } from "../../src/store/useGameStore";
import { PROGRESSION, TROOPS, type TroopType } from "../../src/utils/constants";
import { PROMOTIONS, battalionMods, canLearn, canPromote, canTrain, describeMods, exclusiveSkills, gainXp, promotionCost, soldierStats, trainingCost } from "../../src/utils/progression";
import { migrateSkills } from "../../src/store/useGameStore";

const unit = (over: Partial<BattalionData> = {}): BattalionData => ({ id: "b", name: "Teste", troopType: "INFANTRY", formation: "LINE", level: 1, xp: 0, skillPoints: 0, skills: [], equipment: { weapon: 0, armor: 0 }, totalKills: 0, soldiers: 8, maxSoldiers: 8, ...over });
const FAMILIES = ["INFANTRY", "ARCHERS", "CAVALRY"] as const;

describe("árvore", () => {
  it("toda família tem 4 escolhas de 2 opções", () => {
    for (const f of FAMILIES) {
      expect(SKILL_TREE[f]).toHaveLength(PROGRESSION.MAX_LEVEL - 1);
      for (const pair of SKILL_TREE[f]) expect(new Set(pair).size).toBe(2);
    }
  });

  it("cada habilidade aparece uma vez só, na família certa", () => {
    const all = FAMILIES.flatMap((f) => SKILL_TREE[f].flat().map((id) => [f, id] as const));
    expect(new Set(all.map(([, id]) => id)).size).toBe(all.length);
    for (const [f, id] of all) expect(SKILLS[id].troopType).toBe(f);
    expect(all).toHaveLength(Object.keys(SKILLS).length);
  });

  it("toda habilidade tem efeito de verdade", () => {
    for (const s of Object.values(SKILLS)) {
      if (s.id === "LIVING_WALL") continue; // o efeito dela mora na própria formação
      expect(Object.keys(s.mods).length, s.id).toBeGreaterThan(0);
    }
  });
});

describe("a escolha", () => {
  it("escolher uma perde a outra da mesma linha", () => {
    const b = unit({ level: 2, skillPoints: 1, skills: ["REINFORCED_SHIELDS"] });
    expect(canLearn(b, "IRON_DISCIPLINE")).toContain("se perdeu");
  });

  it("não dá para pular de linha", () => {
    expect(canLearn(unit({ level: 3, skillPoints: 2 }), "LIVING_WALL")).toContain("linha de cima");
  });

  it("cada linha pede o nível dela", () => {
    expect(canLearn(unit({ level: 2, skillPoints: 2, skills: ["IRON_DISCIPLINE"] }), "COUNTERATTACK")).toContain("nível 3");
  });

  it("sem ponto, sem habilidade", () => {
    expect(canLearn(unit({ level: 2 }), "IRON_DISCIPLINE")).toContain("Sem pontos");
  });

  it("habilidade de outra tropa não serve", () => {
    expect(canLearn(unit({ level: 2, skillPoints: 1 }), "EAGLE_EYE")).toContain("outra tropa");
  });

  it("no fim, cada veterano ficou com metade da árvore", () => {
    const picks: SkillId[] = [];
    let b = unit({ level: PROGRESSION.MAX_LEVEL, skillPoints: 4 });
    for (const [first] of SKILL_TREE.INFANTRY) {
      expect(canLearn(b, first)).toBeNull();
      picks.push(first);
      b = { ...b, skills: [...picks], skillPoints: b.skillPoints - 1 };
    }
    expect(b.skills).toHaveLength(4);
    expect(SKILL_TREE.INFANTRY.flat().filter((id) => canLearn({ ...b, skillPoints: 9 }, id) === null)).toHaveLength(0);
  });

  it("existem 16 veteranos diferentes por família", () => {
    expect(2 ** SKILL_TREE.ARCHERS.length).toBe(16);
  });
});

describe("efeitos", () => {
  it("sem habilidades, nada muda", () => {
    const m = battalionMods(unit());
    expect([m.rankSupport, m.flankDamage, m.spread, m.ammo, m.arrowShock, m.breakThrough, m.cycleHit, m.chargeShock, m.huntDamage]).toEqual([1, 1, 1, 1, 1, 1, 1, 1, 1]);
    expect(m.moveFire).toBe(false);
    expect(m.meleeShock).toBe(0);
  });

  it("tiro em marcha liga o tiro andando", () => {
    expect(battalionMods(unit({ troopType: "ARCHERS", skills: ["MARCHING_FIRE"] })).moveFire).toBe(true);
  });

  it("último reduto segura o pânico", () => {
    expect(battalionMods(unit({ skills: ["LAST_STAND"] })).panicBelow).toBeLessThan(battalionMods(unit()).panicBelow);
  });

  it("salva cerrada e aljava mudam o soldado", () => {
    const base = unit({ troopType: "ARCHERS" });
    const tight = unit({ troopType: "ARCHERS", skills: ["TIGHT_VOLLEY"] });
    const deep = unit({ troopType: "ARCHERS", skills: ["DEEP_QUIVER"] });
    expect(soldierStats(tight, battalionMods(tight)).spread).toBeLessThan(soldierStats(base, battalionMods(base)).spread as number);
    expect(soldierStats(deep, battalionMods(deep)).ammo).toBeGreaterThan(soldierStats(base, battalionMods(base)).ammo as number);
  });

  it("quem não atira não ganha munição do nada", () => {
    expect(soldierStats(unit(), battalionMods(unit())).ammo).toBeUndefined();
  });

  it("toda habilidade aparece no resumo do batalhão", () => {
    for (const s of Object.values(SKILLS)) {
      if (s.id === "LIVING_WALL") continue;
      expect(describeMods(unit({ troopType: "INFANTRY", skills: [s.id] })).length, s.id).toBeGreaterThan(0);
    }
  });
});

describe("ritmo", () => {
  it("chegar ao topo pede 1500 de XP", () => {
    expect(gainXp(unit(), 1499).battalion.level).toBe(4);
    expect(gainXp(unit(), 1500).battalion.level).toBe(PROGRESSION.MAX_LEVEL);
  });

  it("cada nível dá um ponto, até 4 no total", () => {
    expect(gainXp(unit(), 5000).battalion.skillPoints).toBe(4);
  });

  it("treino só leva até veterano novato", () => {
    expect(canTrain(PROGRESSION.TRAINING_MAX_LEVEL - 1)).toBe(true);
    expect(canTrain(PROGRESSION.TRAINING_MAX_LEVEL)).toBe(false);
  });

  it("ensinar veterano custa mais", () => {
    expect(trainingCost(2)).toBeGreaterThan(trainingCost(1));
  });
});

describe("promoção", () => {
  const paths = Object.entries(PROMOTIONS) as [TroopType, TroopType[]][];

  it("só a partir do nível pedido", () => {
    expect(canPromote({ troopType: "INFANTRY", level: 2 }, "HEAVY")).toContain("nível");
    expect(canPromote({ troopType: "INFANTRY", level: 3 }, "HEAVY")).toBeNull();
  });

  it("só para as tropas do caminho", () => {
    expect(canPromote({ troopType: "INFANTRY", level: 5 }, "KNIGHTS")).not.toBeNull();
  });

  it("todo caminho leva a outra tropa e custa alguma coisa", () => {
    for (const [from, list] of paths) {
      for (const to of list) {
        expect(to).not.toBe(from);
        expect(TROOPS[to]).toBeDefined();
        expect(promotionCost(from, to).gold).toBeGreaterThanOrEqual(PROGRESSION.PROMOTION_MIN_GOLD);
      }
    }
  });

  it("subir para tropa cara custa mais que recrutar a diferença", () => {
    expect(promotionCost("INFANTRY", "HEAVY").gold).toBeGreaterThan(TROOPS.HEAVY.cost - TROOPS.INFANTRY.cost);
  });

  it("ninguém fica preso num ciclo de promoções", () => {
    const seen = (t: TroopType, path: TroopType[]): void => {
      expect(path).not.toContain(t);
      for (const n of PROMOTIONS[t] ?? []) seen(n, [...path, t]);
    };
    for (const [from] of paths) seen(from, []);
  });
});

describe("saves de antes da progressão da Fase 3", () => {
  it("as duas da mesma linha viram uma: fica a aprendida primeiro, e o ponto volta", () => {
    const old = unit({ level: 5, skillPoints: 0, skills: ["IRON_DISCIPLINE", "REINFORCED_SHIELDS", "COUNTERATTACK", "LIVING_WALL"] });
    const b = exclusiveSkills(old);
    expect(b.skills).toEqual(["IRON_DISCIPLINE", "COUNTERATTACK"]);
    expect(b.skillPoints).toBe(2);
    // Com os pontos de volta, a árvore de hoje deixa seguir pela linha de baixo
    expect(canLearn({ ...b }, "CLOSE_RANKS")).toBeNull();
    expect(canLearn({ ...b }, "REINFORCED_SHIELDS")).toMatch(/se perdeu/);
  });

  it("um ramo só do jeito antigo já vale hoje e não muda", () => {
    const old = unit({ troopType: "ARCHERS", level: 3, skillPoints: 0, skills: ["RAPID_FIRE", "SKIRMISHERS"] });
    expect(exclusiveSkills(old)).toBe(old);
    const fresh = unit();
    expect(exclusiveSkills(fresh)).toBe(fresh);
  });

  it("o save inteiro: bando, expedição, escolta do comboio e o cais do outro continente", () => {
    const both = (id: string) => unit({ id, troopType: "CAVALRY", level: 3, skills: ["CHARGE_LANCES", "GALLOP"] });
    const store: Record<string, unknown> = {
      battalions: [both("a"), unit({ id: "b" })],
      expeditions: [{ id: "e", battalions: [both("c")] }],
      convoy: { id: "k", escort: [both("d")] },
      parked: { C0: { store: {}, left: [both("f")] } },
    };
    migrateSkills(store);
    const all = [
      ...(store.battalions as BattalionData[]),
      ...(store.expeditions as { battalions: BattalionData[] }[])[0].battalions,
      ...(store.convoy as { escort: BattalionData[] }).escort,
      ...(store.parked as Record<string, { left: BattalionData[] }>).C0.left,
    ];
    expect(all.filter((b) => b.troopType === "CAVALRY").map((b) => b.skills)).toEqual([["CHARGE_LANCES"], ["CHARGE_LANCES"], ["CHARGE_LANCES"], ["CHARGE_LANCES"]]);
    expect(all.filter((b) => b.troopType === "CAVALRY").every((b) => b.skillPoints === 1)).toBe(true);
  });

  it("save sem nada disso não quebra", () => {
    const store: Record<string, unknown> = { battalions: [], convoy: null };
    migrateSkills(store);
    expect(store).toEqual({ battalions: [], convoy: null });
  });
});
