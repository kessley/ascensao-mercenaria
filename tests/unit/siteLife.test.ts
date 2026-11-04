import { describe, expect, it } from "vitest";
import { activeLairs, residentGroups, siteFill } from "../../src/game/sim/siteLife";
import { SiteResidents, type SiteContext } from "../../src/game/world/SiteResidents";
import type { EnemyGroupDef } from "../../src/game/data/battleMaps";
import type { SiteDef } from "../../src/game/data/world";
import type { Enemy } from "../../src/game/entities/Enemy";
import { SITE_LIFE } from "../../src/utils/constants";

const GROUPS: EnemyGroupDef[] = [
  { x: 0, y: 0, units: [["GOBLIN", 6], ["GOBLIN_ARCHER", 3]] },
  { x: 200, y: 0, units: [["GOBLIN", 4]] },
];
const count = (gs: EnemyGroupDef[]) => gs.reduce((n, g) => n + g.units.reduce((m, [, k]) => m + k, 0), 0);

describe("locais de missão sempre habitados: as contas", () => {
  it("sem registro (campanha nova ou save antigo), o local está cheio", () => {
    expect(siteFill(undefined, 30)).toBe(1);
  });

  it("limpo, fica vazio uns dias e depois volta a encher devagar até cheio", () => {
    const cleared = { fill: 0, since: 10 };
    expect(siteFill(cleared, 10 + SITE_LIFE.EMPTY_DAYS - 0.5)).toBe(0);
    const later = siteFill(cleared, 10 + SITE_LIFE.EMPTY_DAYS + 2);
    expect(later).toBeGreaterThan(0);
    expect(later).toBeLessThan(1);
    expect(siteFill(cleared, 200)).toBe(1);
  });

  it("com gente ainda lá, os outros começam a voltar já", () => {
    expect(siteFill({ fill: 0.4, since: 10 }, 11)).toBeCloseTo(0.4 + SITE_LIFE.REGROW_PER_DAY);
  });

  it("os moradores são uma parte da força do contrato, e um local quase vazio tem um só", () => {
    const full = count(GROUPS);
    const residents = count(residentGroups(GROUPS, 1));
    expect(residents).toBeGreaterThan(0);
    expect(residents).toBeLessThan(full);
    expect(residents).toBeCloseTo(full * SITE_LIFE.SHARE, -1);
    expect(count(residentGroups(GROUPS, 0.05))).toBe(1);
    expect(residentGroups(GROUPS, 0)).toEqual([]);
  });

  it("os covis perto de um local vazio param de mandar bando", () => {
    const lairs = [
      { x: 1000, y: 0 },
      { x: 20000, y: 0 },
    ];
    const sites = [{ id: "L0", center: { x: 0, y: 0 } }];
    expect(activeLairs(lairs, sites, () => 1)).toHaveLength(2);
    expect(activeLairs(lairs, sites, () => 0)).toEqual([{ x: 20000, y: 0 }]);
  });
});

/** Inimigo de mentira: só o que o gerente dos moradores olha. */
function fakeEnemy(): Enemy {
  return { isAlive: true, revealed: false, target: null, owner: null } as unknown as Enemy;
}

describe("locais de missão sempre habitados: o gerente", () => {
  const site: SiteDef = { id: "L0", name: "Ninho goblin de Teste", theme: "GOBLIN_NEST", center: { x: 0, y: 0 }, groups: GROUPS };
  const setup = () => {
    const spawned: Enemy[] = [];
    const gone: Enemy[] = [];
    const lives = new Map<string, { fill: number; since: number }>();
    const cleared: string[] = [];
    const r = new SiteResidents(
      (_s, g) => {
        const out = g.units.flatMap(([, n]) => Array.from({ length: n }, fakeEnemy));
        spawned.push(...out);
        return out;
      },
      (e) => {
        (e as { isAlive: boolean }).isAlive = false;
        gone.push(e);
      },
    );
    const ctx = (over: Partial<SiteContext> = {}): SiteContext => ({
      sites: [site],
      presence: [{ x: 500, y: 0 }],
      now: 3,
      lifeOf: (id) => lives.get(id),
      contractSite: null,
      fighting: false,
      onChange: (id, life) => lives.set(id, life),
      onCleared: (s) => {
        cleared.push(s.id);
        lives.set(s.id, { fill: 0, since: 3 });
      },
      ...over,
    });
    return { r, spawned, gone, lives, cleared, ctx };
  };

  it("o bando chega perto: os moradores aparecem; longe, ainda não", () => {
    const t = setup();
    t.r.update(t.ctx({ presence: [{ x: 9000, y: 0 }] }));
    expect(t.spawned).toHaveLength(0);
    t.r.update(t.ctx());
    expect(t.spawned.length).toBe(count(residentGroups(GROUPS, 1)));
  });

  it("quem cai baixa o número; o último a cair deixa o local limpo", () => {
    const t = setup();
    t.r.update(t.ctx());
    const n = t.spawned.length;
    (t.spawned[0] as { isAlive: boolean }).isAlive = false;
    t.r.update(t.ctx());
    expect(t.lives.get("L0")?.fill).toBeCloseTo((n - 1) / n);
    for (const e of t.spawned) (e as { isAlive: boolean }).isAlive = false;
    t.r.update(t.ctx());
    expect(t.cleared).toEqual(["L0"]);
    // Limpo, ninguém volta logo, nem com o bando ao lado
    t.r.update(t.ctx({ now: 4 }));
    expect(t.spawned.length).toBe(n);
  });

  it("o bando vai embora sem lutar: os moradores voltam a ser número, sem perder ninguém", () => {
    const t = setup();
    t.r.update(t.ctx());
    t.r.update(t.ctx({ presence: [{ x: 9000, y: 0 }] }));
    expect(t.gone.length).toBe(t.spawned.length);
    expect(t.lives.get("L0")).toBeUndefined();
  });

  it("contrato aceito para o local: os moradores saem (o contrato traz a força inteira)", () => {
    const t = setup();
    t.r.update(t.ctx());
    t.r.update(t.ctx({ contractSite: "L0" }));
    expect(t.r.members("L0")).toHaveLength(0);
    expect(t.lives.get("L0")).toBeUndefined();
  });
});
