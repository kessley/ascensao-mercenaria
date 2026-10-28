import type { TerrainZone } from "../world/TerrainMap";
import type { EnemyGroupDef } from "../data/battleMaps";
import { CAMP_HEIGHT, CAMP_WIDTH, CAMPFIRE, COMMANDER_SPAWN, PALISADE } from "../data/campLayout";
import {
  SITE_THEME_LABEL,
  regionName,
  type Biome,
  type FactionDef,
  type HistoryEntry,
  type RegionDef,
  type SettlementKind,
  type SettlementSeed,
  type SiteDef,
  type SiteTheme,
  type Temperament,
  type WorldDef,
} from "../data/world";
import { WORLD, WORLD_COLS, WORLD_HEIGHT, WORLD_ROWS, WORLD_WIDTH } from "../../utils/constants";
import { distance, type Point } from "../../utils/math";
import { createRng, type Rng } from "./rng";
import * as names from "./names";

/**
 * Gerador de mundos (estilo Dwarf Fortress, em escala greybox): a partir de uma semente,
 * cria um continente de 10×8 regiões com bioma, acampamento, ~20 povoados, 3–4 reinos rivais
 * com governantes, locais de contrato com layout próprio, covis, estradas e uma crônica de
 * séculos de história.
 */

const MARGIN = 500;
const FACTION_COLORS = [0xe67e22, 0x1abc9c, 0xbdc3c7, 0xd4ac0d];
const TEMPERAMENTS: Temperament[] = ["BELLIGERENT", "MERCANTILE", "PIOUS"];

/** Peso de cada tipo de terreno por bioma da região. */
const BIOME_ZONES: Record<Biome, TerrainZone["type"][]> = {
  PLAINS: ["HILL", "FOREST", "MUD"],
  FOREST: ["FOREST", "FOREST", "FOREST", "HILL", "SWAMP"],
  HILLS: ["HILL", "HILL", "HILL", "FOREST", "MUD"],
  MARSH: ["SWAMP", "SWAMP", "MUD", "MUD", "FOREST"],
};
const BIOME_DENSITY: Record<Biome, [number, number]> = {
  PLAINS: [3, 5],
  FOREST: [7, 10],
  HILLS: [6, 9],
  MARSH: [6, 9],
};

function randomPoint(rng: Rng, margin = MARGIN): Point {
  return { x: rng.range(margin, WORLD_WIDTH - margin), y: rng.range(margin, WORLD_HEIGHT - margin) };
}

/** Sorteia um ponto que respeite as distâncias mínimas (ou o melhor encontrado). */
function placePoint(rng: Rng, ok: (p: Point) => number, tries = 300, margin = MARGIN): Point {
  let best = randomPoint(rng, margin);
  let bestScore = -Infinity;
  for (let i = 0; i < tries; i++) {
    const p = randomPoint(rng, margin);
    const score = ok(p);
    if (score >= 0) return p;
    if (score > bestScore) {
      best = p;
      bestScore = score;
    }
  }
  return best;
}

/** Folga em relação às distâncias mínimas: >= 0 quando todas são respeitadas. */
function slack(p: Point, rules: readonly { at: Point; min: number }[]): number {
  let worst = Infinity;
  for (const r of rules) worst = Math.min(worst, distance(p, r.at) - r.min);
  return worst === Infinity ? 0 : worst;
}

function market(rng: Rng, kind: SettlementKind): SettlementSeed["market"] {
  const j = () => rng.range(0.85, 1.15);
  switch (kind) {
    case "VILLAGE":
      return { rationPrice: 0.6 * j(), ironBuy: Math.round(10 * j()), ironSell: Math.round(3 * j()) };
    case "CITY":
      return { rationPrice: 1 * j(), ironBuy: Math.round(6 * j()), ironSell: Math.round(5 * j()) };
    case "FORT":
      return { rationPrice: 1.3 * j(), ironBuy: Math.round(8 * j()), ironSell: Math.round(7 * j()) };
  }
}

const DESCRIPTIONS: Record<SettlementKind, string[]> = {
  VILLAGE: [
    "Lavradores e moinhos: comida barata, quase nada de ferro.",
    "Pastores e colmeias; a gente desconfia de forasteiros armados.",
    "Uma aldeia de lenhadores à beira da mata.",
  ],
  CITY: [
    "Cidade de mercadores e minas: o ferro é farto e o comércio, justo.",
    "Muralhas velhas, guildas ricas e muita intriga no mercado.",
    "Porto fluvial onde tudo se compra, inclusive lealdade.",
  ],
  FORT: [
    "Guarnição de fronteira: paga bem pelo ferro, cobra caro pela comida.",
    "Castelo de pedra negra que vigia as estradas do reino.",
  ],
};

const POPULATION: Record<SettlementKind, [number, number]> = { VILLAGE: [110, 200], CITY: [480, 780], FORT: [240, 380] };
const GARRISON: Record<SettlementKind, number> = { VILLAGE: 6, CITY: 14, FORT: 20 };

// --- Locais de contrato ---

function rotate(p: Point, a: number): Point {
  return { x: p.x * Math.cos(a) - p.y * Math.sin(a), y: p.x * Math.sin(a) + p.y * Math.cos(a) };
}

/** Layout de um local conforme o tema: terreno à volta e grupos inimigos (girados ao acaso). */
function siteLayout(rng: Rng, theme: SiteTheme, c: Point): { zones: TerrainZone[]; groups: EnemyGroupDef[] } {
  const a = rng.range(0, Math.PI * 2);
  const at = (x: number, y: number) => {
    const r = rotate({ x, y }, a);
    return { x: c.x + r.x, y: c.y + r.y };
  };
  const zone = (type: TerrainZone["type"], x: number, y: number, rx: number, ry: number): TerrainZone => ({ type, ...at(x, y), rx, ry });
  const group = (x: number, y: number, units: EnemyGroupDef["units"]): EnemyGroupDef => ({ ...at(x, y), units });
  const n = (min: number, max: number) => rng.int(min, max);

  switch (theme) {
    case "GOBLIN_NEST":
      return {
        zones: [zone("HILL", 320, 0, 230, 170), zone("FOREST", -80, -480, 340, 220), zone("MUD", 0, 420, 220, 120)],
        groups: [
          group(-220, 0, [["GOBLIN", n(5, 7)]]),
          group(-80, -480, [["GOBLIN", n(4, 6)]]),
          group(330, 0, [["GOBLIN_ARCHER", n(4, 6)]]),
          group(120, 320, [["GOBLIN", n(5, 7)]]),
        ],
      };
    case "BANDIT_CAMP":
      return {
        zones: [zone("FOREST", 0, -520, 420, 230), zone("FOREST", 0, 520, 420, 230), zone("HILL", 380, 0, 160, 130)],
        groups: [
          group(0, 0, [["BANDIT", n(6, 8)]]),
          group(380, 0, [["BANDIT_ARCHER", n(3, 5)]]),
          group(-250, 480, [["BANDIT", n(3, 5)]]),
          group(150, -460, [["BANDIT", n(3, 4)], ["BANDIT_ARCHER", 2]]),
        ],
      };
    case "HAUNTED_RUINS":
      return {
        zones: [zone("MUD", 0, 0, 380, 260), zone("SWAMP", -420, 300, 260, 160), zone("FOREST", 420, -300, 260, 180)],
        groups: [
          group(-200, -120, [["SKELETON", n(5, 7)]]),
          group(220, -60, [["SKELETON", n(5, 7)]]),
          group(0, 260, [["SKELETON", n(6, 8)]]),
        ],
      };
    case "SWAMP_FORD":
      return {
        zones: [
          zone("SWAMP", -200, -720, 260, 520),
          zone("SWAMP", -200, 720, 260, 520),
          zone("MUD", -200, 0, 150, 120),
          zone("HILL", 450, 0, 260, 200),
        ],
        groups: [
          group(150, 0, [["GOBLIN", n(7, 9)]]),
          group(460, -20, [["GOBLIN_ARCHER", n(5, 6)]]),
          group(650, 300, [["GOBLIN", n(5, 7)]]),
        ],
      };
  }
}

// --- Estradas: árvore geradora mínima (Prim) ---

function minimumSpanningTree(points: readonly Point[]): [number, number][] {
  const inTree = new Set([0]);
  const edges: [number, number][] = [];
  while (inTree.size < points.length) {
    let best: [number, number] | null = null;
    let bestD = Infinity;
    for (const i of inTree) {
      for (let j = 0; j < points.length; j++) {
        if (inTree.has(j)) continue;
        const d = distance(points[i], points[j]);
        if (d < bestD) {
          bestD = d;
          best = [i, j];
        }
      }
    }
    if (!best) break;
    inTree.add(best[1]);
    edges.push(best);
  }
  return edges;
}

/** Estrada com uma curva no meio (não fica reta como régua). */
function road(rng: Rng, a: Point, b: Point): Point[] {
  const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  const len = distance(a, b);
  const nx = -(b.y - a.y) / (len || 1);
  const ny = (b.x - a.x) / (len || 1);
  const bend = rng.range(-0.15, 0.15) * len;
  return [a, { x: mid.x + nx * bend, y: mid.y + ny * bend }, b];
}

// --- Mundo ---

export function generateWorld(seed: number): WorldDef {
  const rng = createRng(seed);
  const usedNames = new Set<string>();

  // Regiões com bioma
  const regions: RegionDef[] = [];
  for (let row = 0; row < WORLD_ROWS; row++) {
    for (let col = 0; col < WORLD_COLS; col++) {
      const biome = rng.pick<Biome>(["PLAINS", "PLAINS", "FOREST", "HILLS", "MARSH"]);
      regions.push({ col, row, biome, name: names.regionName(rng, biome) });
    }
  }

  // Acampamento numa região interna (longe das bordas)
  const campCenter = {
    x: rng.range(WORLD.REGION_WIDTH * 1.2, WORLD_WIDTH - WORLD.REGION_WIDTH * 1.2),
    y: rng.range(WORLD.REGION_HEIGHT * 0.9, WORLD_HEIGHT - WORLD.REGION_HEIGHT * 0.9),
  };
  const origin = { x: Math.round(campCenter.x - CAMP_WIDTH / 2), y: Math.round(campCenter.y - CAMP_HEIGHT / 2) };
  const local = (p: Point) => ({ x: origin.x + p.x, y: origin.y + p.y });
  const camp = {
    origin,
    center: local(CAMPFIRE),
    spawn: local(COMMANDER_SPAWN),
    gate: local({ x: PALISADE.x - PALISADE.rx - 40, y: PALISADE.y }),
  };

  // Povoados: os primeiros são capitais (cidade ou fortaleza)
  const factionCount = rng.int(3, 4);
  const count = rng.int(18, 24);
  const settlements: SettlementSeed[] = [];
  for (let i = 0; i < count; i++) {
    const kind: SettlementKind =
      i < factionCount ? rng.pick<SettlementKind>(["CITY", "CITY", "FORT"]) : rng.chance(0.2) ? "FORT" : "VILLAGE";
    const rules = [{ at: camp.center, min: 1900 }, ...settlements.map((s) => ({ at: s as Point, min: i < factionCount ? 8000 : 1900 }))];
    const p = placePoint(rng, (q) => slack(q, rules), 400, 700);
    const [pmin, pmax] = POPULATION[kind];
    settlements.push({
      id: `S${i}`,
      name: names.settlementName(rng, usedNames),
      kind,
      x: Math.round(p.x),
      y: Math.round(p.y),
      owner: "FREE",
      population: rng.int(pmin, pmax),
      garrison: GARRISON[kind],
      market: market(rng, kind),
      description: rng.pick(DESCRIPTIONS[kind]),
    });
  }

  // Reinos rivais: cada capital funda um; os outros povoados juram fidelidade ao mais próximo
  const factions: FactionDef[] = settlements.slice(0, factionCount).map((capital, i) => ({
    id: `F${i}`,
    name: names.factionName(rng),
    ruler: names.personName(rng),
    color: FACTION_COLORS[i],
    capitalId: capital.id,
    temperament: rng.pick(TEMPERAMENTS),
  }));
  for (const s of settlements) {
    const capitals = factions.map((f) => ({ f, c: settlements.find((x) => x.id === f.capitalId)! }));
    capitals.sort((a, b) => distance(a.c, s) - distance(b.c, s));
    // Algumas aldeias distantes vivem livres de qualquer coroa
    s.owner = s.kind === "VILLAGE" && rng.chance(0.25) ? "FREE" : capitals[0].f.id;
  }

  // Locais de contrato nos ermos
  const sites: SiteDef[] = [];
  const allThemes: SiteTheme[] = ["GOBLIN_NEST", "BANDIT_CAMP", "HAUNTED_RUINS", "SWAMP_FORD"];
  const themes = rng.shuffle<SiteTheme>([...allThemes, ...allThemes, ...Array.from({ length: 4 }, () => rng.pick(allThemes))]);
  const siteZones: TerrainZone[] = [];
  themes.forEach((theme, i) => {
    const rules = [
      { at: camp.center, min: 2300 },
      ...settlements.map((s) => ({ at: s as Point, min: 1500 })),
      ...sites.map((s) => ({ at: s.center, min: 2000 })),
    ];
    const center = placePoint(rng, (q) => slack(q, rules), 400, 1100);
    const layout = siteLayout(rng, theme, center);
    siteZones.push(...layout.zones);
    sites.push({ id: `L${i}`, name: `${SITE_THEME_LABEL[theme]} de ${names.placeName(rng)}`, theme, center, groups: layout.groups });
  });

  // Covis goblins: longe de tudo, perto das bordas
  const lairs: Point[] = [];
  for (let i = 0; i < 10; i++) {
    const rules = [
      { at: camp.center, min: 3000 },
      ...settlements.map((s) => ({ at: s as Point, min: 1800 })),
      ...sites.map((s) => ({ at: s.center, min: 1200 })),
      ...lairs.map((l) => ({ at: l, min: 3000 })),
    ];
    lairs.push(placePoint(rng, (q) => slack(q, rules), 300, 250));
  }

  // Terreno: zonas por bioma, sem cobrir povoados, acampamento, locais e covis
  const protectedAreas = [
    ...settlements.map((s) => ({ at: s as Point, min: 650 })),
    { at: camp.center, min: 1150 },
    ...sites.map((s) => ({ at: s.center, min: 1000 })),
    ...lairs.map((l) => ({ at: l, min: 250 })),
  ];
  const terrain: TerrainZone[] = [];
  for (const region of regions) {
    const [dmin, dmax] = BIOME_DENSITY[region.biome];
    const target = rng.int(dmin, dmax);
    let placed = 0;
    for (let tries = 0; placed < target && tries < 120; tries++) {
      const type = rng.pick(BIOME_ZONES[region.biome]);
      const rx = rng.range(160, 480);
      const ry = rng.range(110, 320);
      const x = region.col * WORLD.REGION_WIDTH + rng.range(200, WORLD.REGION_WIDTH - 200);
      const y = region.row * WORLD.REGION_HEIGHT + rng.range(200, WORLD.REGION_HEIGHT - 200);
      if (protectedAreas.some((a) => distance(a.at, { x, y }) < a.min + Math.max(rx, ry))) continue;
      terrain.push({ type, x, y, rx, ry });
      placed++;
    }
  }
  terrain.push(...siteZones);

  // Estradas: árvore mínima entre o acampamento e os povoados; cada local liga ao povoado mais próximo
  const hubs: Point[] = [camp.gate, ...settlements];
  const roads = minimumSpanningTree(hubs).map(([a, b]) => road(rng, hubs[a], hubs[b]));
  for (const s of sites) {
    const near = [...settlements].sort((a, b) => distance(a, s.center) - distance(b, s.center))[0];
    roads.push(road(rng, near, s.center));
  }

  const year = rng.int(380, 920);
  const era = names.eraName(rng);
  const bandName = names.bandName(rng);
  const world: WorldDef = {
    seed,
    name: names.worldName(rng),
    era,
    year,
    bandName,
    regions,
    terrain,
    camp,
    settlements,
    factions,
    sites,
    lairs,
    roads,
    history: [],
  };
  world.history = generateHistory(rng, world);
  return world;
}

// --- História ---

/**
 * Crônica do mundo antes do jogo começar: fundações, coroações, guerras que trocaram
 * povoados de mãos, uma calamidade antiga que deixou ruínas e a fundação do bando.
 */
function generateHistory(rng: Rng, world: WorldDef): HistoryEntry[] {
  const h: HistoryEntry[] = [];
  const { year, settlements, factions, sites, regions } = world;
  const name = (id: string) => settlements.find((s) => s.id === id)?.name ?? "?";

  for (const s of settlements) {
    const capital = factions.some((f) => f.capitalId === s.id);
    const founded = year - rng.int(capital ? 280 : 60, capital ? 380 : 260);
    h.push({ year: founded, text: `${names.personName(rng)} fundou ${s.name}${capital ? ", que viria a ser uma capital" : ""}.` });
  }
  for (const f of factions) {
    h.push({ year: year - rng.int(150, 260), text: `${name(f.capitalId)} proclamou o ${f.name}.` });
    h.push({ year: year - rng.int(1, 30), text: `${f.ruler} subiu ao trono do ${f.name}.` });
  }

  // Calamidade antiga: a origem das ruínas assombradas
  const ruins = sites.find((s) => s.theme === "HAUNTED_RUINS");
  const ancient = rng.pick(["a Praga Cinzenta", "a Noite dos Mil Ossos", "a Fome Vermelha", "o Despertar do Rei-Lich"]);
  const ancientRegion = rng.pick(regions);
  h.push({
    year: year - rng.int(120, 220),
    text: ruins
      ? `${ancient[0].toUpperCase()}${ancient.slice(1)} devastou ${ancientRegion.name}; as ${ruins.name.toLowerCase()} ainda guardam os mortos.`
      : `${ancient[0].toUpperCase()}${ancient.slice(1)} devastou ${ancientRegion.name}.`,
  });

  // Guerras entre os reinos
  if (factions.length >= 2) {
    const wars = rng.int(1, 3);
    for (let i = 0; i < wars; i++) {
      const [a, b] = rng.shuffle(factions);
      const prize = rng.pick(settlements.filter((s) => s.owner === a.id && s.id !== a.capitalId)) ?? null;
      const when = year - rng.int(10, 110);
      h.push({
        year: when,
        text: prize
          ? `Guerra entre o ${a.name} e o ${b.name}: ${prize.name} mudou de mãos e hoje serve ao ${a.name}.`
          : `Guerra entre o ${a.name} e o ${b.name} terminou sem vencedor, mas com muitas viúvas.`,
      });
    }
  }

  // Goblins e bandidos
  const village = settlements.find((s) => s.kind === "VILLAGE");
  if (village) h.push({ year: year - rng.int(2, 12), text: `Goblins dos ermos saquearam ${village.name}; ninguém foi punido.` });
  const bandits = sites.find((s) => s.theme === "BANDIT_CAMP");
  if (bandits) h.push({ year: year - rng.int(1, 5), text: `Desertores de guerra formaram o ${bandits.name.toLowerCase()} e cobram pedágio nas estradas.` });

  h.push({ year: year - 1, text: `Um punhado de soldados sem senhor jurou lealdade a um novo Comandante: nasciam os ${world.bandName}.` });
  h.push({ year, text: `Os ${world.bandName} montam acampamento em ${regionName(world, world.camp.center)} em busca de contratos.` });
  return h.sort((x, y) => x.year - y.year);
}

// Acesso para depuração/testes automatizados (somente em dev)
if (import.meta.env.DEV) (window as unknown as { __worldgen?: typeof generateWorld }).__worldgen = generateWorld;
