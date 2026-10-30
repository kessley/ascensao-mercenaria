import type { TerrainZone } from "../world/TerrainMap";
import type { EnemyGroupDef } from "../data/battleMaps";
import { CAMP_HEIGHT, CAMP_WIDTH, CAMPFIRE, campDefAt } from "../data/campLayout";
import {
  SITE_THEME_LABEL,
  ferryDocks,
  regionName,
  type Biome,
  type CrossingDef,
  type HistoryEntry,
  type RegionDef,
  type SettlementKind,
  type SettlementSeed,
  type SiteDef,
  type SiteTheme,
  type WorldDef,
} from "../data/world";
import {
  DEFAULT_WORLD_OPTIONS,
  GEO,
  REALM,
  WORLD,
  WORLD_AGES,
  WORLD_HEIGHT,
  WORLD_SIZES,
  WORLD_WIDTH,
  setWorldSize,
  type WorldOptions,
} from "../../utils/constants";
import { distance, type Point } from "../../utils/math";
import { NavGrid } from "../systems/NavGrid";
import { TOWN_SIZE, nearestGate, townLayout, type TownLayout } from "../world/townLayout";
import { generateGeography } from "./geography";
import { GeoMap } from "./geoMap";
import { simulateHistory } from "./history";
import { resourcesAround } from "./resources";
import { createRng, type Rng } from "./rng";
import * as names from "./names";

/**
 * Gerador de mundos (estilo Dwarf Fortress, em escala greybox), Marco 11. A partir de uma
 * semente e das opções (tamanho, idade, calamidades):
 * 1. geografia: relevo, clima, biomas, lagos e rios (geography.ts);
 * 2. acampamento e povoados em terra firme, preferindo rios, costa e terra fértil;
 * 3. séculos de história simulada decidem reinos, fronteiras e ruínas (history.ts);
 * 4. locais de contrato, covis e terreno de superfície conforme o bioma;
 * 5. estradas pelo caminho de menor custo, que criam pontes, vaus e passos nas montanhas.
 */

const FACTION_COLORS = [0xe67e22, 0x1abc9c, 0xbdc3c7, 0xd4ac0d, 0xe84393, 0x8e6c3a];

/** Tipos de terreno de superfície por bioma (sorteados) e quantos por região. */
const BIOME_ZONES: Record<Biome, TerrainZone["type"][]> = {
  OCEAN: [],
  COAST: ["MUD", "FOREST"],
  PLAINS: ["HILL", "FOREST", "MUD"],
  FOREST: ["FOREST", "FOREST", "FOREST", "HILL", "SWAMP"],
  DEEP_FOREST: ["FOREST", "FOREST", "FOREST", "FOREST", "FOREST", "SWAMP"],
  HILLS: ["HILL", "HILL", "HILL", "FOREST", "MUD"],
  MOUNTAINS: ["HILL", "FOREST"],
  MARSH: ["SWAMP", "SWAMP", "MUD", "MUD", "FOREST"],
  STEPPE: ["HILL", "MUD"],
  DESERT: ["HILL"],
  TUNDRA: ["FOREST", "MUD", "HILL"],
};
const BIOME_DENSITY: Record<Biome, [number, number]> = {
  OCEAN: [0, 0],
  COAST: [1, 2],
  PLAINS: [3, 5],
  FOREST: [7, 10],
  DEEP_FOREST: [10, 14],
  HILLS: [6, 9],
  MOUNTAINS: [2, 3],
  MARSH: [6, 9],
  STEPPE: [1, 3],
  DESERT: [1, 2],
  TUNDRA: [2, 4],
};
/** Quanto cada bioma atrai povoados (terra fértil sim, deserto e tundra não). */
const FERTILITY: Record<Biome, number> = {
  OCEAN: -9,
  COAST: 1,
  PLAINS: 1,
  FOREST: 0.5,
  DEEP_FOREST: 0,
  HILLS: 0.3,
  MOUNTAINS: -9,
  MARSH: -0.5,
  STEPPE: 0,
  DESERT: -1.5,
  TUNDRA: -1.5,
};

function randomPoint(rng: Rng, margin: number): Point {
  return { x: rng.range(margin, WORLD_WIDTH - margin), y: rng.range(margin, WORLD_HEIGHT - margin) };
}

/** Folga em relação às distâncias mínimas: >= 0 quando todas são respeitadas. */
function slack(p: Point, rules: readonly { at: Point; min: number }[]): number {
  let worst = Infinity;
  for (const r of rules) worst = Math.min(worst, distance(p, r.at) - r.min);
  return worst === Infinity ? 0 : worst;
}

/**
 * Sorteia `tries` pontos válidos (`ok`) e fica com o de maior nota que respeite as distâncias;
 * se nenhum respeitar, o que chegou mais perto disso.
 */
function bestPoint(
  rng: Rng,
  ok: (p: Point) => boolean,
  rules: readonly { at: Point; min: number }[],
  score: (p: Point) => number,
  tries = 300,
  margin = 600,
): Point {
  let best: Point | null = null;
  let bestScore = -Infinity;
  let fallback: Point | null = null;
  let fallbackSlack = -Infinity;
  for (let i = 0; i < tries; i++) {
    const p = randomPoint(rng, margin);
    if (!ok(p)) continue;
    const s = slack(p, rules);
    if (s >= 0) {
      const sc = score(p);
      if (sc > bestScore) {
        best = p;
        bestScore = sc;
      }
    } else if (s > fallbackSlack) {
      fallback = p;
      fallbackSlack = s;
    }
  }
  return best ?? fallback ?? randomPoint(rng, margin);
}

/** Recursos da terra barateiam o mercado local (comida farta, ferro de mina). */
export function adjustMarket(m: SettlementSeed["market"], resources: readonly string[]): SettlementSeed["market"] {
  const food = resources.includes("GRAIN") || resources.includes("FISH");
  const iron = resources.includes("IRON");
  return {
    rationPrice: m.rationPrice * (food ? 0.75 : 1),
    ironBuy: Math.max(2, Math.round(m.ironBuy * (iron ? 0.65 : 1))),
    ironSell: Math.max(1, Math.round(m.ironSell * (iron ? 0.8 : 1))),
  };
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
    case "CAPITAL":
      return { rationPrice: 1.1 * j(), ironBuy: Math.round(7 * j()), ironSell: Math.round(6 * j()) };
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
  CAPITAL: [
    "A maior cidade do reino. Atrás da muralha interna fica a Cidade Alta, com o castelo, os palácios e a corte.",
    "Cidade imensa em volta de uma muralha mais velha que o reino: lá dentro, nobres, intrigas e a sala do trono.",
  ],
};

const POPULATION: Record<SettlementKind, [number, number]> = { VILLAGE: [110, 200], CITY: [480, 780], FORT: [240, 380], CAPITAL: [900, 1300] };
const PORT_DESCRIPTIONS = [
  "Porto de pescadores e contrabandistas: o sal e as notícias chegam pelo mar.",
  "Cais de pedra e armazéns cheirando a peixe; os navios esperam o vento.",
];
const RIVER_DESCRIPTIONS = [
  "Moinhos à beira do rio e várzeas férteis: pão não falta.",
  "Cresceu em volta da travessia do rio; quem controla a margem cobra passagem.",
];



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

// --- Estradas e travessias ---

/** Curvas suaves (Chaikin): corta os cantos do caminho em grade. */
function smoothLine(points: readonly Point[], iterations = 2): Point[] {
  let pts = [...points];
  for (let k = 0; k < iterations; k++) {
    if (pts.length < 3) return pts;
    const out: Point[] = [pts[0]];
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i];
      const b = pts[i + 1];
      out.push({ x: a.x * 0.75 + b.x * 0.25, y: a.y * 0.75 + b.y * 0.25 }, { x: a.x * 0.25 + b.x * 0.75, y: a.y * 0.25 + b.y * 0.75 });
    }
    out.push(pts[pts.length - 1]);
    pts = out;
  }
  return pts.map((p) => ({ x: Math.round(p.x), y: Math.round(p.y) }));
}

/** Direção do rio perto de um ponto (a do trecho mais próximo). */
function riverAngleAt(river: { points: Point[] }, p: Point): number {
  let best = 0;
  let bestD = Infinity;
  for (let i = 1; i < river.points.length; i++) {
    const a = river.points[i - 1];
    const b = river.points[i];
    const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    const d = distance(mid, p);
    if (d < bestD) {
      bestD = d;
      best = Math.atan2(b.y - a.y, b.x - a.x);
    }
  }
  return best;
}

// --- Mundo ---

export function generateWorld(seed: number, options: WorldOptions = DEFAULT_WORLD_OPTIONS): WorldDef {
  const size = WORLD_SIZES[options.size];
  setWorldSize(size.cols, size.rows);
  const W = WORLD_WIDTH;
  const H = WORLD_HEIGHT;
  const rng = createRng(seed);
  const usedNames = new Set<string>();
  const area = (size.cols * size.rows) / 80; // em relação ao continente médio

  // 1. Geografia
  const geoDef = generateGeography(rng, size.cols, size.rows);
  const geo = new GeoMap(geoDef);

  // Regiões: bioma da maioria das células, com nome
  const regions: RegionDef[] = [];
  const perCol = Math.round(WORLD.REGION_WIDTH / geoDef.cell);
  const perRow = Math.round(WORLD.REGION_HEIGHT / geoDef.cell);
  for (let row = 0; row < size.rows; row++) {
    for (let col = 0; col < size.cols; col++) {
      const count = new Map<Biome, number>();
      let land = 0;
      for (let r = row * perRow; r < (row + 1) * perRow; r++) {
        for (let c = col * perCol; c < (col + 1) * perCol; c++) {
          const b = geoDef.biome[r * geoDef.cols + c];
          if (b !== "OCEAN") land++;
          count.set(b, (count.get(b) ?? 0) + (b === "OCEAN" ? 0.35 : 1));
        }
      }
      const biome = land < perCol * perRow * 0.2 ? "OCEAN" : [...count.entries()].filter(([b]) => b !== "OCEAN").sort((a, b) => b[1] - a[1])[0][0];
      regions.push({ col, row, biome, name: names.regionName(rng, biome) });
    }
  }

  // A terra principal (a maior massa de terra): ilhas ficam para os navios (Marco 17)
  const main = mainLandmass(geoDef.cols, geoDef.rows, (i) => geoDef.biome[i] !== "OCEAN" && geoDef.lake[i] === 0);
  const onMain = (p: Point) => main[geo.cellIndex(p.x, p.y)] === 1;
  const landOk = (p: Point, clearance = 0) => onMain(p) && geo.isOpenLand(p, clearance);
  /** Uma área retangular inteira em terra firme, sem rio (amostras numa grade de ~300 px). */
  const areaOk = (c: Point, w: number, h: number) => {
    const nx = Math.max(2, Math.ceil(w / 300));
    const ny = Math.max(2, Math.ceil(h / 300));
    for (let j = 0; j <= ny; j++) {
      for (let i = 0; i <= nx; i++) {
        const p = { x: c.x - w / 2 + (i * w) / nx, y: c.y - h / 2 + (j * h) / ny };
        if (!landOk(p) || geo.riverAt(p.x, p.y, 120)) return false;
      }
    }
    return true;
  };

  // 2. Acampamento: terra temperada, perto do meio do continente, longe de rios
  const campCenter = bestPoint(
    rng,
    (p) => areaOk(p, CAMP_WIDTH + 300, CAMP_HEIGHT + 300) && ["PLAINS", "FOREST", "STEPPE", "COAST", "HILLS"].includes(geo.biomeAt(p.x, p.y)),
    [],
    (p) => -distance(p, { x: W / 2, y: H / 2 }) + rng.range(0, 3000),
    600,
    WORLD.REGION_WIDTH,
  );
  const camp = campDefAt({ x: Math.round(campCenter.x - CAMP_WIDTH / 2) + CAMPFIRE.x, y: Math.round(campCenter.y - CAMP_HEIGHT / 2) + CAMPFIRE.y });

  // 3. Povoados: os primeiros serão capitais dos reinos da história
  const survivors = options.size === "SMALL" ? 3 : options.size === "LARGE" ? rng.int(4, 5) : rng.int(3, 4);
  const years = WORLD_AGES[options.age].years;
  const capitals = Math.min(FACTION_COLORS.length, survivors + (options.age === "YOUNG" ? 1 : options.age === "MIDDLE" ? 2 : 3));
  const count = Math.max(capitals + 6, Math.round(rng.int(18, 24) * area));
  const capitalSpacing = Math.sqrt((W * H) / capitals) * 0.55;
  const settlements: SettlementSeed[] = [];
  for (let i = 0; i < count; i++) {
    const kind: SettlementKind =
      // Marco 15: os reinos nascem em capitais (a planta enorme, com a Cidade Alta no meio)
      i < capitals ? "CAPITAL" : rng.chance(0.12) ? "CITY" : rng.chance(0.2) ? "FORT" : "VILLAGE";
    // A planta inteira (muralha e um pouco de campo em volta) cabe em terra firme
    const { w, h } = { w: TOWN_SIZE[kind].w + 500, h: TOWN_SIZE[kind].h + 500 };
    const rules = [{ at: camp.center, min: kind === "CAPITAL" ? 5600 : 3800 }, ...settlements.map((s) => ({ at: s as Point, min: i < capitals ? capitalSpacing : 4200 }))];
    // Plantas nunca se sobrepõem (as capitais são enormes): nem o plano B do sorteio aceita isso
    const clear = (q: Point) => settlements.every((o) => Math.abs(o.x - q.x) >= (TOWN_SIZE[o.kind].w + TOWN_SIZE[kind].w) / 2 + 200 || Math.abs(o.y - q.y) >= (TOWN_SIZE[o.kind].h + TOWN_SIZE[kind].h) / 2 + 200);
    const fits = (q: Point) => areaOk(q, w, h) && clear(q);
    const p = bestPoint(
      rng,
      fits,
      rules,
      (q) => {
        // Rio e mar contam a partir da muralha (a planta inteira fica em terra firme)
        const reach = Math.max(w, h) / 2;
        const river = geo.distanceToRiver(q, reach + 1800);
        return FERTILITY[geo.biomeAt(q.x, q.y)] + (river < reach + 1500 ? 2 : 0) + (geo.nearSea(q, reach + 700) ? 0.8 : 0) + rng.range(0, 1.2);
      },
      i < capitals ? 3000 : 400,
      700,
    );
    // Mundo apertado: sem lugar de verdade, esse povoado simplesmente não existe
    if (!fits(p)) continue;
    const [pmin, pmax] = POPULATION[kind];
    // Porto e rio contam a partir da muralha (Marco 14: desde que as cidades cresceram, o
    // centro fica longe da água; o cais e o moinho ficam do lado de fora dos muros)
    const half = Math.max(TOWN_SIZE[kind].w, TOWN_SIZE[kind].h) / 2;
    const port = [half + 500, half + 1000, half + 1500].some((r) => geo.nearSea(p, r));
    const river = geo.distanceToRiver(p, half + 1800) < half + 1500;
    const resources = resourcesAround(geo, geoDef, p, rng, port, river);
    settlements.push({
      id: `S${i}`,
      name: names.settlementName(rng, usedNames),
      kind,
      x: Math.round(p.x),
      y: Math.round(p.y),
      owner: "FREE",
      population: rng.int(pmin, pmax),
      garrison: REALM.BASE_GARRISON[kind],
      market: adjustMarket(market(rng, kind), resources),
      description: kind === "CAPITAL" ? rng.pick(DESCRIPTIONS.CAPITAL) : port ? rng.pick(PORT_DESCRIPTIONS) : river ? rng.pick(RIVER_DESCRIPTIONS) : rng.pick(DESCRIPTIONS[kind]),
      port,
      river,
      resources,
    });
  }

  // 4. Séculos de história decidem reinos, fronteiras e ruínas
  const year = rng.int(380, 920);
  const history = simulateHistory(rng, settlements, capitals, survivors, year, years, FACTION_COLORS);
  for (const s of settlements) {
    s.owner = history.owners.get(s.id) ?? "FREE";
    if (s.owner === "RUINED") {
      s.population = 0;
      s.garrison = 0;
    }
  }
  const factions = history.factions;

  // 5. Locais de contrato nos ermos (o vau do pântano procura um rio)
  const allThemes: SiteTheme[] = ["GOBLIN_NEST", "BANDIT_CAMP", "HAUNTED_RUINS", "SWAMP_FORD"];
  const siteCount = Math.max(6, Math.round(12 * area));
  const themes = rng.shuffle<SiteTheme>(Array.from({ length: siteCount }, (_, i) => (i < 8 ? allThemes[i % 4] : rng.pick(allThemes))));
  const sites: SiteDef[] = [];
  const siteZones: TerrainZone[] = [];
  for (const [i, theme] of themes.entries()) {
    const rules = [
      { at: camp.center, min: 3500 },
      ...settlements.map((s) => ({ at: s as Point, min: 2900 })),
      ...sites.map((s) => ({ at: s.center, min: 3000 })),
    ];
    let chosen: { center: Point; layout: ReturnType<typeof siteLayout> } | null = null;
    for (let attempt = 0; attempt < 6 && !chosen; attempt++) {
      const center = bestPoint(
        rng,
        (q) => landOk(q, 500),
        rules,
        (q) => (theme === "SWAMP_FORD" ? -Math.abs(geo.distanceToRiver(q, 2000) - 900) / 300 : 0) + rng.range(0, 1),
        300,
        1100,
      );
      const layout = siteLayout(rng, theme, center);
      if (layout.groups.every((g) => landOk(g, 60))) chosen = { center, layout };
    }
    if (!chosen) continue;
    siteZones.push(...chosen.layout.zones);
    sites.push({ id: `L${i}`, name: `${SITE_THEME_LABEL[theme]} de ${names.placeName(rng)}`, theme, center: chosen.center, groups: chosen.layout.groups });
  }

  // Covis goblins: longe de tudo, de preferência em colinas e matas
  const lairs: Point[] = [];
  const lairCount = Math.max(5, Math.round(10 * area));
  for (let i = 0; i < lairCount; i++) {
    const rules = [
      { at: camp.center, min: 4500 },
      ...settlements.map((s) => ({ at: s as Point, min: 3000 })),
      ...sites.map((s) => ({ at: s.center, min: 1800 })),
      ...lairs.map((l) => ({ at: l, min: 4500 })),
    ];
    const p = bestPoint(
      rng,
      (q) => landOk(q, 250),
      rules,
      (q) => (["HILLS", "FOREST", "DEEP_FOREST", "MOUNTAINS"].includes(geo.biomeAt(q.x, q.y)) ? 1 : 0) + rng.range(0, 1),
      300,
      400,
    );
    lairs.push({ x: Math.round(p.x), y: Math.round(p.y) });
  }

  // 6. Terreno de superfície: zonas conforme o bioma do lugar, sem cobrir povoados e locais
  const protectedAreas = [
    ...settlements.map((s) => ({ at: s as Point, min: Math.hypot(TOWN_SIZE[s.kind].w, TOWN_SIZE[s.kind].h) / 2 + 500 })),
    { at: camp.center, min: 1300 },
    ...sites.map((s) => ({ at: s.center, min: 1000 })),
    ...lairs.map((l) => ({ at: l, min: 250 })),
  ];
  const terrain: TerrainZone[] = [];
  for (const region of regions) {
    const [dmin, dmax] = BIOME_DENSITY[region.biome];
    const target = rng.int(dmin, dmax);
    let placed = 0;
    for (let tries = 0; placed < target && tries < 120; tries++) {
      const x = region.col * WORLD.REGION_WIDTH + rng.range(200, WORLD.REGION_WIDTH - 200);
      const y = region.row * WORLD.REGION_HEIGHT + rng.range(200, WORLD.REGION_HEIGHT - 200);
      const choices = BIOME_ZONES[geo.biomeAt(x, y)];
      if (choices.length === 0 || !geo.isOpenLand({ x, y })) continue;
      const type = rng.pick(choices);
      const rx = rng.range(200, 650);
      const ry = rng.range(150, 440);
      if (protectedAreas.some((a) => distance(a.at, { x, y }) < a.min + Math.max(rx, ry))) continue;
      terrain.push({ type, x: Math.round(x), y: Math.round(y), rx: Math.round(rx), ry: Math.round(ry) });
      placed++;
    }
  }
  terrain.push(...siteZones);

  // 7. Estradas pelo caminho de menor custo: atravessar rio custa (vira ponte ou vau), montanha
  //    custa muito (vira passo); estradas já abertas são reaproveitadas
  const layouts = new Map<string, TownLayout>(settlements.map((s) => [s.id, townLayout(s.id, s.kind, s.x, s.y, s.owner === "RUINED")]));
  const townBounds = [...layouts.values()].map((l) => l.bounds);
  const insideAnyTown = (x: number, y: number) => townBounds.some((b) => x > b.x - 90 && x < b.x + b.w + 90 && y > b.y - 90 && y < b.y + b.h + 90);
  const roadCost = (x: number, y: number): number => {
    if (insideAnyTown(x, y)) return Infinity;
    const hgt = geo.heightAt(x, y);
    if (hgt < geoDef.seaLevel || geo.isLake(x, y)) return Infinity;
    const river = geo.riverAt(x, y, 60);
    if (river) return river.width <= 50 ? 2 : 7;
    if (hgt > geoDef.mountainLevel) return 9;
    switch (geo.biomeAt(x, y)) {
      case "HILLS":
        return 1.6;
      case "MARSH":
        return 2.4;
      case "DEEP_FOREST":
        return 1.8;
      case "FOREST":
      case "DESERT":
        return 1.4;
      default:
        return 1;
    }
  };
  const nav = new NavGrid(W, H, 200, roadCost, 1, 0.5);
  const roads: Point[][] = [];
  const route = (a: Point, b: Point, head: Point[] = [], tail: Point[] = []): Point[] | null => {
    const path = nav.findPath(a, b, 150000, false);
    if (!path) return null;
    const line = smoothLine([a, ...path.slice(0, -1), b]);
    nav.markRoad(line, 0.5);
    // Dentro do povoado a estrada vira a rua que vai do portão à praça
    return [...head, ...line, ...tail];
  };
  /** Ponto de chegada de uma estrada: o portão do povoado voltado para o outro lado. */
  const doorOf = (i: number, toward: Point): { out: Point; inner: Point[] } => {
    if (i === 0) return { out: camp.gate, inner: [] };
    const s = settlements[i - 1];
    const layout = layouts.get(s.id) as TownLayout;
    const g = nearestGate(layout, toward);
    return { out: g.outside, inner: [{ x: g.x, y: g.y }] };
  };
  const hubs: Point[] = [camp.gate, ...settlements];
  for (const [a, b] of minimumSpanningTree(hubs)) {
    const da = doorOf(a, hubs[b]);
    const db = doorOf(b, hubs[a]);
    const line = route(da.out, db.out, da.inner, db.inner);
    if (line) roads.push(line);
  }
  const siteRoads = new Set<Point[]>();
  for (const s of sites) {
    const near = [...settlements].sort((a, b) => distance(a, s.center) - distance(b, s.center))[0];
    const door = doorOf(settlements.indexOf(near) + 1, s.center);
    const line = route(door.out, s.center, door.inner);
    if (line) {
      roads.push(line);
      siteRoads.add(line);
    }
  }

  // Travessias e passos ao longo das estradas
  const crossings: CrossingDef[] = [];
  const addCrossing = (kind: CrossingDef["kind"], p: Point, river: { id: string; points: Point[] }, width: number) => {
    if (crossings.some((c) => distance(c, p) < 400)) return;
    crossings.push({ id: `X${crossings.length}`, kind, x: Math.round(p.x), y: Math.round(p.y), angle: riverAngleAt(river, p), width: Math.round(width), riverId: river.id });
  };
  for (const line of roads) {
    let entry: Point | null = null;
    let lastPass: Point | null = null;
    for (let k = 1; k < line.length; k++) {
      const a = line[k - 1];
      const b = line[k];
      const steps = Math.max(1, Math.ceil(distance(a, b) / 40));
      for (let s = 0; s <= steps; s++) {
        const p = { x: a.x + ((b.x - a.x) * s) / steps, y: a.y + ((b.y - a.y) * s) / steps };
        const river = geo.riverAt(p.x, p.y);
        if (river && river.width > 50) {
          entry ??= p;
        } else if (entry) {
          const mid = { x: (entry.x + p.x) / 2, y: (entry.y + p.y) / 2 };
          const r = geo.riverAt(mid.x, mid.y) ?? geo.riverAt(entry.x, entry.y);
          if (r) addCrossing(siteRoads.has(line) && r.width < 130 && rng.chance(0.6) ? "FORD" : "BRIDGE", mid, r.river, r.width);
          entry = null;
        }
        if (geo.heightAt(p.x, p.y) > geoDef.mountainLevel - 0.02 && (!lastPass || distance(lastPass, p) > 200)) {
          geoDef.passes.push({ x: Math.round(p.x), y: Math.round(p.y), r: GEO.PASS_RADIUS });
          lastPass = p;
        }
      }
    }
  }
  geoDef.crossings = crossings;
  // Vaus naturais ao longo dos rios médios (os grandes só se atravessam por ponte)
  for (const river of geoDef.rivers) {
    if (river.kind === "STREAM") continue;
    let run = rng.range(0.4, 1) * GEO.FORD_EVERY;
    for (let i = 1; i < river.points.length; i++) {
      run -= distance(river.points[i - 1], river.points[i]);
      const w = river.widths[i];
      if (run > 0 || w <= 50) continue;
      run = GEO.FORD_EVERY * rng.range(0.8, 1.3);
      const p = river.points[i];
      if (w >= 130 || (!landOk({ x: p.x + w, y: p.y }) && !landOk({ x: p.x - w, y: p.y }))) continue;
      if (!rng.chance(0.65)) continue;
      const r = geo.riverAt(p.x, p.y);
      if (r && r.river.id === river.id) addCrossing("FORD", p, river, r.width);
    }
  }
  // Balsas nos rios grandes, longe das pontes: cais nas duas margens
  for (const river of geoDef.rivers) {
    if (river.kind !== "GREAT") continue;
    let run = rng.range(0.5, 1) * GEO.FERRY_EVERY;
    for (let i = 1; i < river.points.length; i++) {
      run -= distance(river.points[i - 1], river.points[i]);
      if (run > 0) continue;
      const p = river.points[i];
      const r = geo.riverAt(p.x, p.y);
      if (!r || r.river.id !== river.id || r.width < 110) continue;
      if (geoDef.crossings.some((c) => distance(c, p) < 2200)) continue;
      const angle = riverAngleAt(river, p);
      const probe: CrossingDef = { id: "", kind: "FERRY", x: p.x, y: p.y, angle, width: r.width, riverId: river.id };
      const [a, b] = ferryDocks(probe);
      if (!landOk(a, 40) || !landOk(b, 40) || geo.riverAt(a.x, a.y) || geo.riverAt(b.x, b.y)) continue;
      run = GEO.FERRY_EVERY * rng.range(0.8, 1.3);
      geoDef.crossings.push({ ...probe, id: `X${geoDef.crossings.length}`, x: Math.round(p.x), y: Math.round(p.y), width: Math.round(r.width) });
    }
  }

  const era = names.eraName(rng);
  const bandName = names.bandName(rng);
  const world: WorldDef = {
    seed,
    options,
    cols: size.cols,
    rows: size.rows,
    geo: geoDef,
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
  world.history = finishHistory(rng, world, history.entries);
  return world;
}

/** Maior massa de terra (células conectadas pelos lados). */
function mainLandmass(cols: number, rows: number, isLand: (i: number) => boolean): Uint8Array {
  const comp = new Int32Array(cols * rows).fill(-1);
  let best = -1;
  let bestSize = 0;
  let id = 0;
  for (let i = 0; i < cols * rows; i++) {
    if (comp[i] !== -1 || !isLand(i)) continue;
    const stack = [i];
    comp[i] = id;
    let size = 0;
    while (stack.length) {
      const u = stack.pop() as number;
      size++;
      const c = u % cols;
      const r = Math.floor(u / cols);
      for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const cc = c + dc;
        const rr = r + dr;
        if (cc < 0 || rr < 0 || cc >= cols || rr >= rows) continue;
        const v = rr * cols + cc;
        if (comp[v] === -1 && isLand(v)) {
          comp[v] = id;
          stack.push(v);
        }
      }
    }
    if (size > bestSize) {
      bestSize = size;
      best = id;
    }
    id++;
  }
  const out = new Uint8Array(cols * rows);
  for (let i = 0; i < out.length; i++) if (comp[i] === best) out[i] = 1;
  return out;
}

// --- História: a simulada mais as notícias recentes ---

function finishHistory(rng: Rng, world: WorldDef, simulated: HistoryEntry[]): HistoryEntry[] {
  const h = [...simulated];
  const { year, settlements, sites } = world;
  const ruins = sites.find((s) => s.theme === "HAUNTED_RUINS");
  if (ruins) h.push({ year: year - rng.int(20, 90), text: `Os mortos voltaram a andar nas ${ruins.name.toLowerCase()}; ninguém mais passa por lá à noite.` });
  const village = settlements.find((s) => s.kind === "VILLAGE" && s.owner !== "RUINED");
  if (village) h.push({ year: year - rng.int(2, 12), text: `Goblins dos ermos saquearam ${village.name}; ninguém foi punido.` });
  const bandits = sites.find((s) => s.theme === "BANDIT_CAMP");
  if (bandits) h.push({ year: year - rng.int(1, 5), text: `Desertores de guerra formaram o ${bandits.name.toLowerCase()} e cobram pedágio nas estradas.` });
  const great = world.geo.rivers.find((r) => r.kind === "GREAT");
  if (great) h.push({ year: year - rng.int(30, 150), text: `Uma cheia do ${great.name} levou pontes e moinhos; os velhos ainda contam.` });
  h.push({ year: year - 1, text: `Um punhado de soldados sem senhor jurou lealdade a um novo Comandante: nasciam os ${world.bandName}.` });
  h.push({ year, text: `Os ${world.bandName} montam acampamento em ${regionName(world, world.camp.center)} em busca de contratos.` });
  return h.sort((x, y) => x.year - y.year);
}

// Acesso para depuração/testes automatizados (somente em dev)
if (import.meta.env.DEV) (window as unknown as { __worldgen?: typeof generateWorld }).__worldgen = generateWorld;
