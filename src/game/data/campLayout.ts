import type { CampPanel } from "../../store/useGameStore";
import type { Point } from "../../utils/math";

export const CAMP_WIDTH = 1800;
export const CAMP_HEIGHT = 1300;

/** Paliçada elíptica que cerca o acampamento (o Comandante não sai dela). */
export const PALISADE = { x: 900, y: 650, rx: 780, ry: 540, gateAngle: Math.PI, gateHalfWidth: 0.16 };

export const CAMPFIRE: Point = { x: 900, y: 650 };
/** O Comandante começa entre a fogueira e a própria tenda, de frente para a porta. */
export const COMMANDER_SPAWN: Point = { x: 900, y: 560 };

export type CampSiteKind = "TENT" | "QUARTERMASTER" | "RECRUIT" | "TRAINING" | "FORGE" | "STABLE";

/** Local fixo do acampamento com interação. */
export interface CampSite {
  kind: CampSiteKind;
  label: string;
  /** Centro do desenho. */
  x: number;
  y: number;
  w: number;
  h: number;
  /** Onde o Comandante para para interagir (porta, balcão...). */
  door: Point;
  panel: CampPanel;
}

export const CAMP_SITES: CampSite[] = [
  {
    kind: "TENT",
    label: "Tenda do Comandante",
    x: 900,
    y: 380,
    w: 170,
    h: 120,
    door: { x: 900, y: 475 },
    panel: { kind: "TENT" },
  },
  {
    kind: "QUARTERMASTER",
    label: "Intendência",
    x: 560,
    y: 620,
    w: 110,
    h: 60,
    door: { x: 640, y: 660 },
    panel: { kind: "QUARTERMASTER" },
  },
  {
    kind: "RECRUIT",
    label: "Posto de Recrutamento",
    x: 1240,
    y: 620,
    w: 90,
    h: 50,
    door: { x: 1170, y: 660 },
    panel: { kind: "RECRUIT" },
  },
  {
    kind: "TRAINING",
    label: "Campo de Treino",
    x: 420,
    y: 820,
    w: 220,
    h: 150,
    door: { x: 545, y: 820 },
    panel: { kind: "TRAINING" },
  },
  {
    kind: "STABLE",
    label: "Estábulo",
    x: 1150,
    y: 470,
    w: 150,
    h: 80,
    door: { x: 1150, y: 545 },
    panel: { kind: "STABLE" },
  },
  {
    kind: "FORGE",
    label: "Ferraria",
    x: 1380,
    y: 820,
    w: 90,
    h: 80,
    door: { x: 1300, y: 830 },
    panel: { kind: "FORGE" },
  },
];

/** Alojamentos dos batalhões (barraca + soldados em forma), na ordem do exército. */
export const QUARTER_SLOTS: Point[] = [
  { x: 560, y: 1010 },
  { x: 780, y: 1010 },
  { x: 1000, y: 1010 },
  { x: 1220, y: 1010 },
  { x: 540, y: 330 },
  { x: 1260, y: 330 },
];

/** Distância do ponto de interação em que aparece o aviso "E — ...". */
export const INTERACT_RADIUS = 70;
