import { describe, expect, it } from "vitest";
import { CULTURES, generatePlanet, localTroop, seaDistance } from "../../src/game/data/planet";
import { farWeek, type FarRealm } from "../../src/game/sim/farWorld";
import type { FactionState, Settlement } from "../../src/game/sim/realm";
import { battalionSeats, charterCost, escapeChance, fleetReaches, fleetSeats, fleetSpeed, newsDelay, pirateCrew, pirateToll, rollSeaDay, seatsNeeded, voyageDays } from "../../src/game/sim/voyage";
import { currentTongue, settlementName, useTongue } from "../../src/game/worldgen/names";
import { createRng } from "../../src/game/worldgen/rng";
import { SEA } from "../../src/utils/constants";

const home = { seed: 1234, name: "Vales de Teste", options: { size: "MEDIUM" as const } };

describe("planeta", () => {
  it("sai sempre igual da mesma semente", () => {
    expect(generatePlanet(home)).toEqual(generatePlanet(home));
  });

  it("tem de 3 a 5 continentes, cada um com sua cultura", () => {
    const { continents } = generatePlanet(home);
    expect(continents.length).toBeGreaterThanOrEqual(3);
    expect(continents.length).toBeLessThanOrEqual(5);
    expect(new Set(continents.map((c) => c.culture)).size).toBe(continents.length);
  });

  it("o continente natal é o mundo da campanha", () => {
    const [first] = generatePlanet(home).continents;
    expect(first.home).toBe(true);
    expect(first.seed).toBe(home.seed);
    expect(first.name).toBe(home.name);
  });

  it("cada continente tem semente própria", () => {
    const seeds = generatePlanet(home).continents.map((c) => c.seed);
    expect(new Set(seeds).size).toBe(seeds.length);
  });

  it("os continentes não se encostam", () => {
    const { continents } = generatePlanet(home);
    for (const a of continents) for (const b of continents) if (a !== b) expect(seaDistance(a, b)).toBeGreaterThan(200);
  });

  it("gerar o planeta não troca a língua de quem está falando", () => {
    useTongue("JADE");
    generatePlanet(home);
    expect(currentTongue()).toBe("JADE");
    useTongue("REALMS");
  });
});

describe("culturas", () => {
  it("a língua muda os nomes", () => {
    const rng = createRng(7);
    useTongue("ISLES");
    const name = settlementName(rng, new Set());
    useTongue("REALMS");
    expect(name).toMatch(/vik|heim|fjord|holm|by|stad|nes|gard|ey|dal|borg|vang|sund/);
  });

  it("cada terra tem tropas típicas e um luxo", () => {
    for (const id of ["SANDS", "ISLES", "JADE"] as const) {
      expect(localTroop(id, "SOLDIER")).not.toBe("SOLDIER");
      expect(CULTURES[id].luxuryOutput).toBeGreaterThan(0);
    }
  });

  it("nos reinos do oeste, soldado é soldado", () => {
    expect(localTroop("REALMS", "SOLDIER")).toBe("SOLDIER");
    expect(localTroop(undefined, "SOLDIER")).toBe("SOLDIER");
  });

  it("quem não tem equivalente continua o mesmo", () => {
    expect(localTroop("SANDS", "GOBLIN")).toBe("GOBLIN");
  });
});

describe("a bordo", () => {
  it("cavalo ocupa mais que soldado", () => {
    expect(battalionSeats({ troopType: "INFANTRY", soldiers: 8 })).toBe(8);
    expect(battalionSeats({ troopType: "CAVALRY", soldiers: 8 })).toBe(32);
  });

  it("carroça ocupa 4 lugares", () => {
    expect(seatsNeeded([{ troopType: "INFANTRY", soldiers: 8 }], 2)).toBe(16);
  });

  it("a frota soma lugares e anda no passo do mais lento", () => {
    const fleet = [{ type: "NAU" as const }, { type: "BARCA" as const }];
    expect(fleetSeats(fleet)).toBe(SEA.SHIPS.NAU.seats + SEA.SHIPS.BARCA.seats);
    expect(fleetSpeed(fleet)).toBe(SEA.SHIPS.BARCA.speed);
  });

  it("barca só vai até onde a costa alcança", () => {
    expect(fleetReaches([{ type: "BARCA" }], SEA.COAST_RANGE - 1)).toBe(true);
    expect(fleetReaches([{ type: "BARCA" }], SEA.COAST_RANGE + 1)).toBe(false);
    expect(fleetReaches([{ type: "COCA" }], 2000)).toBe(true);
  });
});

describe("viagem", () => {
  it("navio rápido chega antes", () => {
    expect(voyageDays(600, SEA.SHIPS.NAU.speed, "SUMMER")).toBeLessThan(voyageDays(600, SEA.SHIPS.COCA.speed, "SUMMER"));
  });

  it("o inverno atrasa", () => {
    expect(voyageDays(600, 1, "WINTER")).toBeGreaterThan(voyageDays(600, 1, "SUMMER"));
  });

  it("nenhuma travessia leva menos de 3 dias", () => {
    expect(voyageDays(10, 2, "SUMMER")).toBe(3);
  });

  it("o frete cobra por lugar, por dia, com um mínimo", () => {
    expect(charterCost(100, 10)).toBeGreaterThan(charterCost(50, 10));
    expect(charterCost(1, 10)).toBe(charterCost(SEA.CHARTER_MIN_SEATS, 10));
  });

  it("o mar decide pelo número sorteado", () => {
    expect(rollSeaDay("WINTER", () => 0)).toBe("STORM");
    expect(rollSeaDay("WINTER", () => 0.99)).toBeNull();
    expect(rollSeaDay("SUMMER", () => SEA.STORM.SUMMER + 0.01)).toBe("CALM");
    expect(rollSeaDay("SUMMER", () => SEA.STORM.SUMMER + SEA.CALM.SUMMER + 0.01)).toBe("PIRATES");
  });

  it("quase sempre o dia passa sem nada", () => {
    let quiet = 0;
    let n = 0;
    for (let r = 0; r < 1; r += 0.001) {
      n++;
      if (rollSeaDay("SPRING", () => r) === null) quiet++;
    }
    expect(quiet / n).toBeGreaterThan(0.8);
  });

  it("o pedágio cresce com o navio e tem um piso", () => {
    expect(pirateToll(100)).toBeGreaterThan(pirateToll(50));
    expect(pirateToll(1)).toBe(SEA.TOLL_MIN);
  });

  it("navio rápido despista melhor", () => {
    expect(escapeChance(1.3)).toBeGreaterThan(escapeChance(0.75));
    expect(escapeChance(100)).toBeLessThanOrEqual(0.8);
  });

  it("piratas têm capitão e crescem com a presa, até um limite", () => {
    const small = pirateCrew(10, () => 0.5);
    const big = pirateCrew(120, () => 0.5);
    expect(small.PIRATE_CAPTAIN).toBe(1);
    expect(big.PIRATE + big.PIRATE_BOW).toBeGreaterThan(small.PIRATE + small.PIRATE_BOW);
    expect(pirateCrew(9999, () => 0.5).PIRATE).toBeLessThan(60);
  });

  it("notícia de longe demora mais", () => {
    expect(newsDelay(700)).toBeGreaterThan(newsDelay(200));
    expect(newsDelay(600)).toBeGreaterThanOrEqual(21);
  });
});

describe("terra distante", () => {
  const town = (id: string, owner: string): Settlement => ({ id, name: id, owner, prosperity: 100, garrison: 4 }) as unknown as Settlement;
  const realm = (): FarRealm => ({
    settlements: [town("capA", "F0"), town("a1", "F0"), town("capB", "F1"), town("b1", "F1"), town("nosso", "PLAYER")],
    factions: [{ id: "F0", ruler: "Velho", seatId: "capA" } as FactionState, { id: "F1", ruler: "Velha", seatId: "capB" } as FactionState],
  });
  const links = { factionName: (id: string) => `Reino ${id}`, heir: () => "Herdeiro" };

  it("com o tempo, a prosperidade muda", () => {
    const { realm: after } = farWeek(realm(), links, () => 0.9);
    expect(after.settlements[0].prosperity).not.toBe(100);
  });

  it("não mexe no estado original", () => {
    const before = realm();
    farWeek(before, links, () => 0);
    expect(before.settlements.map((t) => t.owner)).toEqual(["F0", "F0", "F1", "F1", "PLAYER"]);
    expect(before.factions[0].ruler).toBe("Velho");
  });

  it("uma guerra troca uma cidade de dono e vira notícia", () => {
    const { realm: after, news } = farWeek(realm(), links, () => 0);
    expect(after.settlements.find((t) => t.id === "b1")?.owner).toBe("F0");
    expect(news.some((n) => n.includes("tomou b1"))).toBe(true);
  });

  it("a capital não cai numa escaramuça", () => {
    const { realm: after } = farWeek(realm(), links, () => 0);
    expect(after.settlements.find((t) => t.id === "capB")?.owner).toBe("F1");
  });

  it("o trono pode vagar", () => {
    const { realm: after, news } = farWeek(realm(), links, () => 0.001);
    expect(after.factions[0].ruler).toBe("Herdeiro");
    expect(news.some((n) => n.includes("Herdeiro"))).toBe(true);
  });

  it("povoado do bando, sem o bando, pode se perder", () => {
    const { realm: after, news } = farWeek(realm(), links, () => 0.03);
    expect(after.settlements.find((t) => t.id === "nosso")?.owner).toBe("F0");
    expect(news.some((n) => n.includes("nosso"))).toBe(true);
  });

  it("semana calma não dá notícia", () => {
    expect(farWeek(realm(), links, () => 0.9).news).toHaveLength(0);
  });

  it("terra em ruínas continua em ruínas", () => {
    const r = realm();
    r.settlements.push(town("ruina", "RUINED"));
    expect(farWeek(r, links, () => 0.9).realm.settlements.find((t) => t.id === "ruina")?.prosperity).toBe(100);
  });
});
