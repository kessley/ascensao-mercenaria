import { describe, expect, it } from "vitest";
import { ENEMY_FACTIONS, PRESET_SCENARIOS, SCENARIO_MAPS, SCENARIO_TOWN, SIEGE_MAPS, armyStart, blankScenario, buildScenarioWorld, cleanScenario, forceSize, forceStance, forceStart, newForce, newSiege, scenarioDay, scenarioProblem, withSiege, type ScenarioMapId } from "../../src/game/data/scenarios";
import { TOWN_SIZE } from "../../src/game/world/townLayout";
import { ENEMIES, TROOPS } from "../../src/utils/constants";
import { seasonOf } from "../../src/utils/season";
import { newId } from "../../src/utils/id";

describe("cenários prontos", () => {
  it("todos podem começar", () => {
    for (const s of PRESET_SCENARIOS) expect(scenarioProblem(s), s.name).toBeNull();
  });

  it("usam tropas que existem", () => {
    for (const s of PRESET_SCENARIOS) {
      for (const b of s.army.battalions) expect(TROOPS[b.troop], s.name).toBeDefined();
      for (const f of s.forces) for (const kind of Object.keys(f.units)) expect(ENEMIES[kind as keyof typeof ENEMIES], `${s.name}: ${kind}`).toBeDefined();
    }
  });

  it("todo mapa gera um mundo", () => {
    for (const s of PRESET_SCENARIOS) {
      const w = buildScenarioWorld(s);
      expect(w.regions.length).toBe(4);
      expect(w.geo.elevation.length).toBe(w.geo.cols * w.geo.rows);
    }
  });

  it("cada facção oferece mais de um tipo de tropa", () => {
    for (const f of Object.values(ENEMY_FACTIONS)) expect(f.units.length).toBeGreaterThanOrEqual(3);
  });
});

describe("cenário salvo", () => {
  it("o que não faz sentido volta ao padrão", () => {
    const s = cleanScenario({ name: "x", map: "LUA" as never, distance: 9e9, surviveMinutes: -3, army: { battalions: [{ troop: "DRAGOES" as never, soldiers: 999, level: 99, gear: -1 } as never], scouts: 99, messengers: -1, wagons: 2 } });
    expect(s.map).toBe("PLAINS");
    expect(s.distance).toBeLessThanOrEqual(2400);
    expect(s.surviveMinutes).toBeGreaterThanOrEqual(1);
    expect(s.army.battalions[0].troop).toBe("INFANTRY");
    expect(s.army.battalions[0].soldiers).toBeLessThanOrEqual(16);
    expect(s.army.scouts).toBeLessThanOrEqual(3);
  });

  it("guarda tropa nova", () => {
    const s = cleanScenario({ ...blankScenario(), army: { battalions: [{ troop: "KNIGHTS" } as never], scouts: 0, messengers: 0, wagons: 0 } });
    expect(s.army.battalions[0].troop).toBe("KNIGHTS");
    expect(TROOPS.KNIGHTS.formations).toContain(s.army.battalions[0].formation);
  });

  it("descarta tropa de outra facção", () => {
    const s = cleanScenario({ forces: [{ faction: "UNDEAD", units: { SKELETON: 5, KNIGHT: 9 } } as never] });
    expect(forceSize(s.forces[0])).toBe(5);
  });

  it("ordens diretas ligadas por padrão, inclusive em cenário antigo", () => {
    expect(blankScenario().directOrders).toBe(true);
    expect(cleanScenario({}).directOrders).toBe(true);
    expect(cleanScenario({ directOrders: false }).directOrders).toBe(false);
  });
});

describe("calendário do cenário", () => {
  it("cai na estação pedida", () => {
    for (const season of ["SPRING", "SUMMER", "AUTUMN", "WINTER"] as const) expect(seasonOf(scenarioDay(season))).toBe(season);
  });
});

describe("identificador", () => {
  it("funciona sem contexto seguro (jogo aberto pelo IP da rede)", () => {
    const original = crypto.randomUUID;
    Object.defineProperty(crypto, "randomUUID", { value: undefined, configurable: true });
    try {
      const a = newId();
      const b = newId();
      expect(a).not.toBe(b);
      expect(a.length).toBeGreaterThan(16);
    } finally {
      Object.defineProperty(crypto, "randomUUID", { value: original, configurable: true });
    }
  });
});

describe("batalha de cerco", () => {
  const siegeOf = (role: "ATTACK" | "DEFEND", town: "VILLAGE" | "FORT" | "CITY" = "FORT") => withSiege(blankScenario(), { ...newSiege(role), town });
  const inside = (s: ReturnType<typeof siegeOf>, p: { x: number; y: number }) => {
    const size = TOWN_SIZE[s.siege?.town ?? "FORT"];
    const c = buildScenarioWorld(s).settlements[0];
    return Math.abs(p.x - c.x) <= size.w / 2 && Math.abs(p.y - c.y) <= size.h / 2;
  };

  it("sem cerco, nenhum povoado no mapa", () => {
    expect(buildScenarioWorld(blankScenario()).settlements).toHaveLength(0);
  });

  it("a fortaleza fica no centro, sem guarnição própria", () => {
    const [town] = buildScenarioWorld(siegeOf("ATTACK")).settlements;
    expect(town.id).toBe(SCENARIO_TOWN);
    expect(town.garrison).toBe(0);
    expect(town.owner).toBe("FREE");
    expect(buildScenarioWorld(siegeOf("DEFEND")).settlements[0].owner).toBe("PLAYER");
  });

  it("mata e lama não nascem dentro dos muros", () => {
    for (const map of SIEGE_MAPS) {
      const s = { ...siegeOf("ATTACK", "CITY"), map };
      const size = TOWN_SIZE.CITY;
      const c = buildScenarioWorld(s).settlements[0];
      for (const z of buildScenarioWorld(s).terrain) expect(Math.abs(z.x - c.x) > size.w / 2 || Math.abs(z.y - c.y) > size.h / 2, map).toBe(true);
    }
  });

  it("quem ataca começa fora; quem defende, dentro", () => {
    for (const town of ["VILLAGE", "FORT", "CITY"] as const) {
      const attack = siegeOf("ATTACK", town);
      expect(inside(attack, armyStart(attack)), town).toBe(false);
      expect(inside(attack, forceStart(attack, attack.forces[0])), town).toBe(true);
      const defend = siegeOf("DEFEND", town);
      expect(inside(defend, armyStart(defend)), town).toBe(true);
    }
  });

  it("de onde quer que venham, as forças começam fora dos muros e dentro do mapa", () => {
    for (const town of ["VILLAGE", "FORT", "CITY"] as const) {
      for (const side of ["FRONT", "LEFT", "RIGHT", "REAR"] as const) {
        for (const delay of [0, 120]) {
          const s = { ...siegeOf("DEFEND", town), distance: 2400, forces: [{ ...newForce(), side, delay }] };
          const p = forceStart(s, s.forces[0]);
          expect(inside(s, p), `${town} ${side}`).toBe(false);
          expect(p.x).toBeGreaterThan(0);
          expect(p.y).toBeGreaterThan(0);
        }
      }
    }
  });

  it("ligar o ataque manda a primeira força para trás dos muros", () => {
    const s = siegeOf("ATTACK");
    expect(s.forces[0].side).toBe("WALLS");
    expect(forceStance(s, s.forces[0])).toBe("HOLD");
  });

  it("passar para a defesa tira o inimigo de dentro e obriga o assalto", () => {
    const s = withSiege(siegeOf("ATTACK"), newSiege("DEFEND"));
    expect(s.forces[0].side).toBe("FRONT");
    expect(forceStance(s, { ...s.forces[0], stance: "HOLD" })).toBe("ATTACK");
  });

  it("mapa com rio ou desfiladeiro não recebe a fortaleza", () => {
    for (const map of Object.keys(SCENARIO_MAPS) as ScenarioMapId[]) {
      if (SIEGE_MAPS.includes(map)) continue;
      expect(withSiege({ ...blankScenario(), map }, newSiege()).map, map).toBe("PLAINS");
      expect(scenarioProblem({ ...siegeOf("ATTACK"), map }), map).not.toBeNull();
    }
  });

  it("sem escada nem aríete não dá para atacar", () => {
    expect(scenarioProblem(withSiege(blankScenario(), { ...newSiege(), ladders: 0, rams: 0 }))).not.toBeNull();
    expect(scenarioProblem(siegeOf("ATTACK"))).toBeNull();
  });

  it("atacar exige alguém atrás dos muros", () => {
    const s = siegeOf("ATTACK");
    expect(scenarioProblem({ ...s, forces: [{ ...s.forces[0], side: "FRONT" }] })).not.toBeNull();
  });

  it("cenário guardado volta coerente", () => {
    expect(cleanScenario({ ...blankScenario(), siege: undefined }).siege).toBeNull();
    const back = cleanScenario(JSON.parse(JSON.stringify(siegeOf("ATTACK", "CITY"))));
    expect(back.siege?.town).toBe("CITY");
    expect(back.forces[0].side).toBe("WALLS");
    expect(cleanScenario({ ...blankScenario(), forces: [{ ...newForce(), side: "WALLS" }] }).forces[0].side).toBe("FRONT");
    expect(cleanScenario({ ...siegeOf("ATTACK"), siege: { role: "ATTACK", town: "FORT", ladders: 99, rams: 99 } }).siege?.ladders).toBeLessThanOrEqual(6);
  });

  it("os cercos prontos começam", () => {
    const sieges = PRESET_SCENARIOS.filter((p) => p.siege);
    expect(sieges.some((p) => p.siege?.role === "ATTACK")).toBe(true);
    expect(sieges.some((p) => p.siege?.role === "DEFEND")).toBe(true);
    for (const p of sieges) expect(scenarioProblem(p), p.name).toBeNull();
  });
});
