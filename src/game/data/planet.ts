import type { EnemyKind, WorldSizeId } from "../../utils/constants";
import type { Point } from "../../utils/math";
import { createRng } from "../worldgen/rng";
import type { TongueId } from "../worldgen/names";
import * as names from "../worldgen/names";

/**
 * O planeta (Marco 17): a terceira escala do mapa. Cada continente é um mundo inteiro, gerado por
 * `generateWorld` só quando alguém desembarca nele; até lá existe apenas como estes dados grossos.
 */

export type CultureId = TongueId;

export interface CultureDef {
  label: string;
  people: string;
  /** O luxo que só esta terra produz. */
  luxury: string;
  /** Ajuste do clima na geração: quente e seco, frio, úmido... */
  climate: { heat: number; wet: number };
  /** Tropas típicas: quem ocupa o lugar de cada soldado comum dos reinos. */
  troops: Partial<Record<EnemyKind, EnemyKind>>;
  /** Quanto o luxo local rende nas oficinas de um porto. */
  luxuryOutput: number;
}

export const CULTURES: Record<CultureId, CultureDef> = {
  REALMS: { label: "Reinos do Oeste", people: "gente dos reinos", luxury: "vinho fino", climate: { heat: 0, wet: 0 }, troops: {}, luxuryOutput: 0 },
  SANDS: {
    label: "Emirados das Areias",
    people: "gente das areias",
    luxury: "especiarias",
    climate: { heat: 0.22, wet: -0.2 },
    troops: { SOLDIER: "SAND_SPEAR", PIKEMAN: "SAND_SPEAR", CROSSBOW: "DUNE_ARCHER", LONGBOW: "DUNE_ARCHER", LANCER: "MAMELUKE", KNIGHT: "MAMELUKE" },
    luxuryOutput: 1.4,
  },
  ISLES: {
    label: "Jarlados do Norte",
    people: "gente dos fiordes",
    luxury: "âmbar",
    climate: { heat: -0.24, wet: 0.08 },
    troops: { SOLDIER: "AXEMAN", PIKEMAN: "AXEMAN", MAN_AT_ARMS: "HOUSECARL", KNIGHT: "HOUSECARL", CROSSBOW: "LONGBOW" },
    luxuryOutput: 1,
  },
  JADE: {
    label: "Impérios de Jade",
    people: "gente de jade",
    luxury: "seda",
    climate: { heat: 0.1, wet: 0.2 },
    troops: { SOLDIER: "PIKE_LEVY", PIKEMAN: "PIKE_LEVY", CROSSBOW: "REPEATER", LONGBOW: "REPEATER", MAN_AT_ARMS: "JADE_GUARD", KNIGHT: "JADE_GUARD" },
    luxuryOutput: 1.8,
  },
};

export interface ContinentDef {
  id: string;
  name: string;
  culture: CultureId;
  /** Semente do mundo deste continente. */
  seed: number;
  size: WorldSizeId;
  /** Centro no mapa do planeta. */
  x: number;
  y: number;
  /** Contorno no mapa do planeta. */
  coast: Point[];
  home: boolean;
}

export interface PlanetDef {
  seed: number;
  continents: ContinentDef[];
}

export const PLANET_WIDTH = 1000;
export const PLANET_HEIGHT = 600;
export const HOME_CONTINENT = "C0";

/** Onde cada terra fica, com folga para variar de um mundo para outro. */
const SPOTS: { culture: CultureId; x: number; y: number; rx: number; ry: number; size: WorldSizeId }[] = [
  { culture: "ISLES", x: 560, y: 125, rx: 120, ry: 70, size: "SMALL" },
  { culture: "SANDS", x: 610, y: 465, rx: 150, ry: 85, size: "SMALL" },
  { culture: "JADE", x: 860, y: 270, rx: 105, ry: 150, size: "MEDIUM" },
];

function coastOf(rng: ReturnType<typeof createRng>, x: number, y: number, rx: number, ry: number): Point[] {
  const a = rng.range(0, Math.PI * 2);
  const b = rng.range(0, Math.PI * 2);
  const c = rng.range(0, Math.PI * 2);
  const out: Point[] = [];
  for (let i = 0; i < 36; i++) {
    const t = (i / 36) * Math.PI * 2;
    const r = 0.82 + 0.16 * Math.sin(t * 2 + a) + 0.1 * Math.sin(t * 3 + b) + 0.06 * Math.sin(t * 5 + c);
    out.push({ x: x + Math.cos(t) * rx * r, y: y + Math.sin(t) * ry * r });
  }
  return out;
}

/** O planeta nasce da semente do continente natal, sempre igual. */
export function generatePlanet(home: { seed: number; name: string; options: { size: WorldSizeId } }): PlanetDef {
  const rng = createRng((home.seed ^ 0x5bd1e995) >>> 0 || 1);
  const spoken = names.currentTongue();
  const continents: ContinentDef[] = [
    { id: HOME_CONTINENT, name: home.name, culture: "REALMS", seed: home.seed, size: home.options.size, x: 225, y: 300, coast: coastOf(rng, 225, 300, 170, 175), home: true },
  ];
  SPOTS.forEach((spot, i) => {
    const x = spot.x + rng.range(-24, 24);
    const y = spot.y + rng.range(-18, 18);
    names.useTongue(spot.culture);
    const name = names.worldName(rng);
    continents.push({ id: `C${i + 1}`, name, culture: spot.culture, seed: rng.int(1, 2 ** 30), size: spot.size, x, y, coast: coastOf(rng, x, y, spot.rx, spot.ry), home: false });
  });
  names.useTongue(spoken);
  return { seed: home.seed, continents };
}

/** Distância de mar entre dois continentes, no mapa do planeta. */
export function seaDistance(a: Pick<ContinentDef, "x" | "y">, b: Pick<ContinentDef, "x" | "y">): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/** Quem ocupa o lugar deste soldado na cultura local. */
export function localTroop(culture: CultureId | undefined, kind: EnemyKind): EnemyKind {
  return (culture && CULTURES[culture].troops[kind]) ?? kind;
}
