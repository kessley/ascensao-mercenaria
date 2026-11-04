import { CLEAR, Grid, OUTLINE, enlarge, glint, gridBitmap, ramp, rimLight, type Bitmap, type Ramp } from "./pixel";

/**
 * Figuras em pixel art, vista 3/4 (Marco G1): soldados, monstros, cavaleiros e lobos, todos
 * montados em camadas a partir de um `Look` (corpo, cabeça, armadura, arma, escudo, montaria e
 * cor da tropa). Assim as dezenas de tropas saem de combinações, sem um desenho para cada.
 *
 * Folha de cada figura: 3 linhas (de frente, de lado, de costas; o outro lado é espelhado) e
 * 12 quadros por linha: parado (2), andando (4), atacando (3) e morrendo (3).
 */

export type FigureBody = "HUMAN" | "GOBLIN" | "ORC" | "SKELETON";
export type HeadGear = "HAIR" | "BARE" | "HOOD" | "HELM" | "GREAT_HELM" | "CAP" | "BANDANA";
/** `STICK` (cajado de caminhante) e `HOE` (enxada) são da gente que não luta (G4). */
export type Weapon = "SWORD" | "AXE" | "SPEAR" | "LANCE" | "JAVELIN" | "BOW" | "CROSSBOW" | "STAFF" | "STICK" | "HOE" | "NONE";
export type ShieldKind = "NONE" | "ROUND" | "KITE";
export type Mount = "NONE" | "HORSE" | "BARDED" | "WOLF";
export type Dir = "S" | "E" | "N";
/** Carro de bois, carroça de mercador e aríete coberto (G4): a folha sai de `vehicles.ts`. */
export type Vehicle = "WAGON" | "CART" | "RAM";

export interface Look {
  /** Bicho sem cavaleiro: o resto do visual não conta. O cervo é do mapa vivo (G4). */
  beast?: "WOLF" | "DEER";
  /** Veículo: também ignora o resto, menos a cor (a camisa do carroceiro, o toldo, a flâmula). */
  vehicle?: Vehicle;
  body: FigureBody;
  head: HeadGear;
  /** 0 = pano ou couro, 1 = malha, 2 = placas. */
  armor: 0 | 1 | 2;
  weapon: Weapon;
  shield: ShieldKind;
  mount: Mount;
  /** Cor da tropa: tabardo, capuz, escudo e caparazão. */
  color: number;
  /** Penacho, fivela e friso: chefes, oficiais e o Comandante. */
  trim?: number;
  cape?: number;
  /** Chifres no elmo (o Senhor da Guerra orc). */
  horns?: boolean;
  /** Olhos acesos nessa cor (o Necromante, debaixo do capuz). */
  eyes?: number;
  /**
   * Chefes de calamidade saem no dobro do tamanho, desenhados em resolução dobrada: o pixel
   * tem o mesmo tamanho do de todo mundo, sem ficar grosso.
   */
  scale?: 1 | 2;
}

export const DIRS: readonly Dir[] = ["S", "E", "N"];
export const FRAMES = 16;
/** Colunas da folha. As do duelo (Marco 21) vêm depois da queda: guarda, pesado armando, esquiva e atordoado. */
export const ANIM = { IDLE: 0, WALK: 2, ATTACK: 6, DIE: 9, GUARD: 12, HEAVY: 13, DODGE: 14, STAGGER: 15 } as const;
/** As três colunas da queda (a última é o corpo no chão). */
const isFall = (frame: number) => frame >= ANIM.DIE && frame < ANIM.DIE + 3;

export const lookKey = (l: Look): string =>
  [l.vehicle ?? "", l.beast ?? "", l.body, l.head, l.armor, l.weapon, l.shield, l.mount, l.color.toString(16), l.trim?.toString(16) ?? "", l.cape?.toString(16) ?? "", l.horns ? "h" : "", l.eyes?.toString(16) ?? "", l.scale ?? 1].join(".");

export const rides = (l: Look) => !!l.beast || l.mount !== "NONE";

/** Célula em que a figura é desenhada (antes de dobrar, no caso dos chefes). */
function baseCell(l: Look): { w: number; h: number; feetX: number; feetY: number } {
  return rides(l) ? { w: 46, h: 44, feetX: 23, feetY: 40 } : { w: 32, h: 38, feetX: 16, feetY: 34 };
}

const big = (l: Look) => l.scale === 2;
const times = <T extends Record<string, number>>(o: T, k: number): T => Object.fromEntries(Object.entries(o).map(([key, v]) => [key, v * k])) as T;

/** Tamanho da célula de cada quadro e onde ficam os pés (a âncora do sprite). */
export function cellOf(l: Look): { w: number; h: number; feetX: number; feetY: number } {
  return times(baseCell(l), big(l) ? 2 : 1);
}

const baseMini = (l: Look) => (rides(l) ? { w: 16, h: 13 } : { w: 10, h: 14 });
const baseDot = (l: Look) => (rides(l) ? { w: 6, h: 5 } : { w: 4, h: 6 });

/** Tamanho do mini-sprite (zoom de 50%) e do bloquinho (zoom de 25%). */
export const miniOf = (l: Look) => times(baseMini(l), big(l) ? 2 : 1);
export const dotOf = (l: Look) => times(baseDot(l), big(l) ? 2 : 1);

/** Chefe: dobra a resolução, põe luz nas bordas e acende o orbe do cajado. */
function grow(g: Grid, l: Look): Grid {
  if (!big(l)) return g;
  const out = enlarge(g);
  rimLight(out);
  if (l.weapon === "STAFF") glint(out, staffTip(l), 0xf4e6ff);
  return out;
}

interface Metrics {
  headW: number;
  headH: number;
  torsoW: number;
  torsoH: number;
  legH: number;
  legW: number;
  armW: number;
}

const METRICS: Record<FigureBody, Metrics> = {
  HUMAN: { headW: 8, headH: 8, torsoW: 8, torsoH: 7, legH: 6, legW: 3, armW: 2 },
  GOBLIN: { headW: 8, headH: 7, torsoW: 6, torsoH: 5, legH: 4, legW: 2, armW: 2 },
  ORC: { headW: 9, headH: 8, torsoW: 10, torsoH: 8, legH: 6, legW: 4, armW: 3 },
  SKELETON: { headW: 7, headH: 7, torsoW: 7, torsoH: 7, legH: 6, legW: 2, armW: 2 },
};

const SKIN: Record<FigureBody, Ramp> = {
  HUMAN: { light: 0xf2c8a0, base: 0xdba878, dark: 0xb67a52 },
  GOBLIN: { light: 0xb0d068, base: 0x82a442, dark: 0x5a7a2c },
  ORC: { light: 0x9caa6c, base: 0x77894a, dark: 0x52623a },
  SKELETON: { light: 0xf4eedc, base: 0xd8d0b8, dark: 0xa49c84 },
};

const IRON: Ramp = { light: 0xd4dce0, base: 0x98a4ad, dark: 0x5c6670 };
const LEATHER: Ramp = { light: 0xa87748, base: 0x7c522e, dark: 0x54361c };
const CLOTH: Ramp = { light: 0x8a7a64, base: 0x6b5a48, dark: 0x4a3e32 };
const BOOT = { base: 0x46322a, dark: 0x2e201a };
const WOOD = { base: 0x8f6338, dark: 0x5e3f22 };
const HAIR = 0x4a3020;
const STRING = 0xe8e0d0;
const TUSK = 0xf0ead8;
const HORSE: Ramp = { light: 0xa77b52, base: 0x7d5636, dark: 0x553820 };
const MANE = 0x2e2018;
const WOLF: Ramp = { light: 0xaeaea6, base: 0x7c7c78, dark: 0x52524e };
const DEER: Ramp = { light: 0xc0905a, base: 0x9a6a3c, dark: 0x6a4626 };
const ANTLER = 0xd8c8a0;
const DEER_TAIL = 0xf0e8d8;

interface Pose {
  bob: number;
  /** Quanto cada pé sobe (de frente) e quanto anda para a frente (de lado). */
  lift: [number, number];
  stride: [number, number];
  /** Ângulo do braço armado, em graus: 0 é para a frente, 90 para cima. */
  arm: number;
  lean: number;
  /** 0 = nada, 1 = armando o golpe (puxando a corda), 2 = golpe (soltando). */
  act: 0 | 1 | 2;
  /** Guarda erguida (duelo): o escudo sobe para a frente do corpo e a lâmina fica de pé. */
  guard?: boolean;
}

function poseOf(frame: number): Pose {
  const base: Pose = { bob: 0, lift: [0, 0], stride: [0, 0], arm: -35, lean: 0, act: 0 };
  switch (frame) {
    case 1:
      return { ...base, bob: 1 };
    case 2:
      return { ...base, lift: [2, 0], stride: [2, -2], arm: -20 };
    case 3:
      return { ...base, bob: 1, lift: [1, 0], arm: -30 };
    case 4:
      return { ...base, lift: [0, 2], stride: [-2, 2], arm: -45 };
    case 5:
      return { ...base, bob: 1, lift: [0, 1], arm: -30 };
    case 6:
      return { ...base, arm: 110, lean: -1, act: 1 };
    case 7:
      return { ...base, arm: 5, lean: 1, stride: [2, -1], act: 2 };
    case 8:
      return { ...base, arm: -50, lean: 1, stride: [1, 0], act: 0 };
    case ANIM.GUARD:
      return { ...base, bob: 1, arm: 60, lean: -1, stride: [1, -1], guard: true };
    case ANIM.HEAVY:
      return { ...base, bob: 1, arm: 150, lean: -2, stride: [-1, 1], act: 1 };
    case ANIM.DODGE:
      return { ...base, bob: 2, lift: [1, 0], stride: [-2, 2], arm: -60, lean: -2 };
    case ANIM.STAGGER:
      return { ...base, bob: 1, lift: [0, 1], stride: [-1, 1], arm: -80, lean: -2 };
    default:
      return base;
  }
}

function polar(x: number, y: number, deg: number, len: number, flip = 1): [number, number] {
  const a = (deg * Math.PI) / 180;
  return [Math.round(x + flip * Math.cos(a) * len), Math.round(y - Math.sin(a) * len)];
}

// --- Peças ---

function gearColor(l: Look): number {
  switch (l.head) {
    case "HELM":
    case "GREAT_HELM":
      return IRON.light;
    case "HOOD":
      return l.color;
    case "CAP":
      return LEATHER.base;
    case "BANDANA":
      return l.trim ?? 0xa8322a;
    case "HAIR":
      return HAIR;
    default:
      return SKIN[l.body].base;
  }
}

/** Chifres de osso saindo do elmo, um de cada lado da cabeça (`x` e `w` são os da cabeça). */
function horns(g: Grid, l: Look, x: number, y: number, w: number): void {
  if (!l.horns) return;
  const bone = 0xb8ae94;
  for (const [hx, out] of [
    [x - 1, -1],
    [x + w, 1],
  ] as const) {
    g.px(hx, y + 2, bone);
    g.px(hx, y + 1, bone);
    g.px(hx + out, y + 1, TUSK);
    g.px(hx + out, y, TUSK);
    g.px(hx + out, y - 1, TUSK);
  }
}

function plume(g: Grid, l: Look, x: number, y: number): void {
  if (l.trim === undefined || (l.head !== "HELM" && l.head !== "GREAT_HELM")) return;
  g.rect(x, y - 2, 2, 2, l.trim);
}

function headFront(g: Grid, m: Metrics, cx: number, y: number, l: Look): void {
  const w = m.headW;
  const h = m.headH;
  const x = cx - Math.floor(w / 2);
  const skin = SKIN[l.body];
  const team = ramp(l.color);
  g.rect(x, y, w, h, skin.base);
  g.rect(x + w - 1, y, 1, h, skin.dark);
  g.rect(x, y + h - 1, w, 1, skin.dark);
  const eyeY = y + Math.floor(h * 0.6);
  if (l.body === "SKELETON") {
    g.rect(x + 1, eyeY - 1, 2, 2, OUTLINE);
    g.rect(x + w - 3, eyeY - 1, 2, 2, OUTLINE);
    g.px(cx - 1, eyeY + 1, skin.dark);
  } else {
    g.px(x + 2, eyeY, l.eyes ?? OUTLINE);
    g.px(x + w - 3, eyeY, l.eyes ?? OUTLINE);
  }
  if (l.body === "ORC") {
    g.px(x + 2, y + h - 2, TUSK);
    g.px(x + w - 3, y + h - 2, TUSK);
  }
  if (l.body === "GOBLIN" && l.head !== "HOOD" && l.head !== "GREAT_HELM") {
    g.px(x - 1, eyeY - 1, skin.base);
    g.px(x - 2, eyeY - 2, skin.light);
    g.px(x + w, eyeY - 1, skin.base);
    g.px(x + w + 1, eyeY - 2, skin.dark);
  }
  switch (l.head) {
    case "HELM": {
      const helm = Math.floor(h * 0.55);
      g.rect(x, y, w, helm, IRON.base);
      g.rect(x + 1, y + 1, w - 2, 1, IRON.light);
      g.rect(x + w - 1, y, 1, helm, IRON.dark);
      g.rect(x, y + helm - 1, w, 1, IRON.dark);
      break;
    }
    case "GREAT_HELM":
      g.rect(x, y, w, h, IRON.base);
      g.rect(x + 1, y + 1, w - 2, 1, IRON.light);
      g.rect(x + w - 1, y, 1, h, IRON.dark);
      g.rect(x + 1, eyeY - 1, w - 2, 1, OUTLINE);
      g.px(cx - 1, eyeY - 1, IRON.base);
      break;
    case "HOOD": {
      const hood = Math.floor(h * 0.45);
      g.rect(x, y, w, hood, team.base);
      g.rect(x + 1, y + 1, w - 3, 1, team.light);
      g.rect(x, y, 1, h - 1, team.base);
      g.rect(x + w - 1, y, 1, h - 1, team.dark);
      break;
    }
    case "CAP": {
      const cap = Math.max(2, Math.floor(h * 0.35));
      g.rect(x, y, w, cap, LEATHER.base);
      g.rect(x + 1, y, w - 2, 1, LEATHER.light);
      g.rect(x - 1, y + cap - 1, w + 2, 1, LEATHER.dark);
      break;
    }
    case "BANDANA": {
      const c = ramp(gearColor(l));
      g.rect(x, y, w, 3, c.base);
      g.rect(x + 1, y, w - 2, 1, c.light);
      break;
    }
    case "HAIR":
      g.rect(x, y, w, 2, HAIR);
      g.rect(x, y + 2, 1, 3, HAIR);
      g.rect(x + w - 1, y + 2, 1, 2, HAIR);
      break;
    default:
      if (l.body === "ORC") g.rect(cx - 1, y - 2, 2, 2, HAIR);
  }
  plume(g, l, cx - 1, y);
  g.px(x, y, CLEAR);
  g.px(x + w - 1, y, CLEAR);
  horns(g, l, x, y, w);
}

function headSide(g: Grid, m: Metrics, cx: number, y: number, l: Look): void {
  const w = m.headW - 1;
  const h = m.headH;
  const x = cx - Math.floor(w / 2);
  const skin = SKIN[l.body];
  const team = ramp(l.color);
  g.rect(x, y, w, h, skin.base);
  g.rect(x, y + h - 1, w, 1, skin.dark);
  const eyeY = y + Math.floor(h * 0.6);
  if (l.body === "SKELETON") g.rect(x + w - 3, eyeY - 1, 2, 2, OUTLINE);
  else g.px(x + w - 2, eyeY, l.eyes ?? OUTLINE);
  if (l.body === "ORC") g.px(x + w - 1, y + h - 2, TUSK);
  if (l.body === "GOBLIN") {
    g.px(x + w, eyeY + 1, skin.base);
    if (l.head !== "HOOD" && l.head !== "GREAT_HELM") {
      g.px(x - 1, eyeY - 1, skin.base);
      g.px(x - 2, eyeY - 2, skin.light);
    }
  }
  switch (l.head) {
    case "HELM": {
      const helm = Math.floor(h * 0.55);
      g.rect(x, y, w, helm, IRON.base);
      g.rect(x + 1, y + 1, w - 2, 1, IRON.light);
      g.rect(x, y + helm - 1, w, 1, IRON.dark);
      g.rect(x, y, 2, h - 2, IRON.base);
      g.rect(x, y, 1, h - 2, IRON.dark);
      break;
    }
    case "GREAT_HELM":
      g.rect(x, y, w, h, IRON.base);
      g.rect(x + 1, y + 1, w - 2, 1, IRON.light);
      g.rect(x, y, 1, h, IRON.dark);
      g.rect(x + w - 3, eyeY - 1, 3, 1, OUTLINE);
      break;
    case "HOOD":
      g.rect(x, y, w, Math.floor(h * 0.45), team.base);
      g.rect(x + 1, y + 1, w - 3, 1, team.light);
      g.rect(x, y, 3, h, team.base);
      g.rect(x, y, 1, h, team.dark);
      break;
    case "CAP": {
      const cap = Math.max(2, Math.floor(h * 0.35));
      g.rect(x, y, w, cap, LEATHER.base);
      g.rect(x + 1, y, w - 2, 1, LEATHER.light);
      g.rect(x + w - 1, y + cap - 1, 2, 1, LEATHER.dark);
      break;
    }
    case "BANDANA": {
      const c = ramp(gearColor(l));
      g.rect(x, y, w, 3, c.base);
      g.rect(x + 1, y, w - 2, 1, c.light);
      g.px(x - 1, y + 2, c.base);
      g.px(x - 2, y + 3, c.dark);
      break;
    }
    case "HAIR":
      g.rect(x, y, w, 2, HAIR);
      g.rect(x, y + 2, 2, 3, HAIR);
      break;
    default:
      if (l.body === "ORC") g.rect(x + 1, y - 2, 2, 2, HAIR);
  }
  plume(g, l, x + 1, y);
  g.px(x, y, CLEAR);
  g.px(x + w - 1, y, CLEAR);
  horns(g, l, x, y, w);
}

function headBack(g: Grid, m: Metrics, cx: number, y: number, l: Look): void {
  const w = m.headW;
  const h = m.headH;
  const x = cx - Math.floor(w / 2);
  const skin = SKIN[l.body];
  let c: Ramp = skin;
  if (l.head === "HELM" || l.head === "GREAT_HELM") c = IRON;
  else if (l.head === "HOOD") c = ramp(l.color);
  else if (l.head === "HAIR") c = { light: 0x5e3e2a, base: HAIR, dark: 0x30200f };
  g.rect(x, y, w, h, c.base);
  g.rect(x + 1, y + 1, w - 2, 1, c.light);
  g.rect(x + w - 1, y, 1, h, c.dark);
  g.rect(x, y + h - 1, w, 1, c.dark);
  if (l.head === "CAP") g.rect(x, y, w, Math.max(2, Math.floor(h * 0.35)), LEATHER.base);
  if (l.head === "BANDANA") {
    const b = ramp(gearColor(l));
    g.rect(x, y, w, 3, b.base);
    g.rect(cx - 1, y + 3, 2, 2, b.dark);
  }
  if (l.body === "GOBLIN" && l.head !== "HOOD" && l.head !== "GREAT_HELM") {
    g.px(x - 1, y + 3, skin.base);
    g.px(x + w, y + 3, skin.base);
  }
  if (l.body === "ORC" && l.head === "BARE") g.rect(cx - 1, y - 2, 2, 2, HAIR);
  plume(g, l, cx - 1, y);
  g.px(x, y, CLEAR);
  g.px(x + w - 1, y, CLEAR);
  horns(g, l, x, y, w);
}

function torso(g: Grid, m: Metrics, x: number, y: number, w: number, l: Look, front: boolean): void {
  const team = ramp(l.color);
  const h = m.torsoH;
  if (l.body === "SKELETON" && l.armor === 0) {
    const bone = SKIN.SKELETON;
    g.box(x, y, w, h, bone);
    for (let r = y + 1; r < y + h - 1; r += 2) g.rect(x + 1, r, w - 2, 1, bone.dark);
    g.rect(x + Math.floor(w / 2), y, 1, h, bone.dark);
    return;
  }
  if (l.armor === 2) {
    g.box(x, y, w, h, IRON);
    g.rect(x + 1, y, w - 2, 1, IRON.light);
    const stripe = front ? Math.max(2, w - 4) : w - 2;
    g.rect(x + Math.floor((w - stripe) / 2), y + 2, stripe, h - 3, team.base);
  } else if (l.armor === 1) {
    g.box(x, y, w, h, team);
    g.rect(x, y, w, 2, IRON.base);
    g.rect(x, y, w, 1, IRON.light);
  } else if ((l.weapon === "BOW" || l.weapon === "CROSSBOW" || l.weapon === "JAVELIN") && l.body !== "GOBLIN") {
    // Atirador: colete de couro por cima da cor da tropa
    g.box(x, y, w, h, LEATHER);
    g.rect(x + 2, y + 1, Math.max(1, w - 4), h - 2, team.base);
  } else {
    g.box(x, y, w, h, team);
  }
  g.rect(x, y + h - 1, w, 1, LEATHER.dark);
  if (front && l.trim !== undefined) g.px(x + Math.floor(w / 2), y + h - 1, l.trim);
}

function legColor(l: Look): Ramp {
  if (l.armor === 2) return IRON;
  if (l.body === "SKELETON") return SKIN.SKELETON;
  return CLOTH;
}

function sleeve(l: Look): Ramp {
  if (l.armor >= 1) return IRON;
  if (l.body === "SKELETON") return SKIN.SKELETON;
  return ramp(l.color);
}

function leg(g: Grid, m: Metrics, x: number, top: number, bottom: number, lift: number, c: Ramp): void {
  const end = bottom - lift;
  const h = Math.max(0, end - top - 1);
  g.rect(x, top, m.legW, h, c.base);
  if (m.legW > 1) g.rect(x + m.legW - 1, top, 1, h, c.dark);
  g.rect(x, end - 1, m.legW, 2, BOOT.base);
  g.rect(x, end, m.legW, 1, BOOT.dark);
}

function roundShield(g: Grid, cx: number, cy: number, t: Ramp): void {
  g.oval(cx, cy, 3, 4, t.base);
  g.oval(cx - 1, cy - 1, 1, 2, t.light);
  g.rect(cx - 1, cy - 1, 2, 2, IRON.light);
  g.px(cx, cy, IRON.dark);
}

function kiteShield(g: Grid, x: number, y: number, t: Ramp, trim: number | undefined): void {
  g.rect(x, y, 5, 6, t.base);
  g.rect(x + 1, y + 6, 3, 1, t.base);
  g.px(x + 2, y + 7, t.base);
  g.rect(x, y, 1, 6, t.light);
  g.rect(x + 2, y + 1, 1, 6, trim ?? t.light);
}

function sideShield(g: Grid, x: number, cy: number, t: Ramp, kite: boolean): void {
  const up = kite ? 5 : 4;
  const down = kite ? 5 : 4;
  g.rect(x, cy - up, 2, up + down + 1, t.base);
  g.rect(x, cy - up, 1, up + down + 1, t.dark);
  g.px(x + 1, cy - up, CLEAR);
  g.px(x + 1, cy + down, CLEAR);
  if (!kite) g.rect(x + 1, cy - 1, 1, 3, IRON.light);
}

function blade(g: Grid, hx: number, hy: number, deg: number, flip: number, axe: boolean): void {
  const len = axe ? 7 : 8;
  const [tx, ty] = polar(hx, hy, deg, len, flip);
  g.line(hx, hy, tx, ty, axe ? WOOD.base : IRON.light);
  if (axe) {
    const [ax, ay] = polar(tx, ty, deg + 90, 2, flip);
    const [bx, by] = polar(tx, ty, deg - 90, 1, flip);
    g.line(ax, ay, bx, by, IRON.base);
    g.px(tx, ty, IRON.light);
  }
}

/** Haste longa (lança, dardo, cajado) entre a mão e a ponta, com um pouco para trás da mão. */
function pole(g: Grid, hx: number, hy: number, deg: number, len: number, flip: number, tip: number): void {
  const [bx, by] = polar(hx, hy, deg + 180, 3, flip);
  const [tx, ty] = polar(hx, hy, deg, len, flip);
  g.line(bx, by, tx, ty, WOOD.base);
  const [px, py] = polar(hx, hy, deg, len - 2, flip);
  g.line(px, py, tx, ty, tip);
}

function bowSide(g: Grid, hx: number, hy: number, drawn: boolean, flip = 1): void {
  const h = 7;
  let px = hx;
  let py = hy - h;
  for (let i = -h; i <= h; i++) {
    const x = hx + flip * Math.round(2 * (1 - (i * i) / (h * h)));
    g.line(px, py, x, hy + i, WOOD.base);
    px = x;
    py = hy + i;
  }
  const pull = drawn ? 4 : 0;
  g.line(hx, hy - h, hx - flip * pull, hy, STRING);
  g.line(hx - flip * pull, hy, hx, hy + h, STRING);
  if (drawn) {
    g.line(hx - flip * pull, hy, hx + flip * 4, hy, IRON.light);
    g.px(hx + flip * 5, hy, IRON.base);
  }
}

function bowFront(g: Grid, hx: number, hy: number, drawn: boolean): void {
  const w = 6;
  let px = hx - w;
  let py = hy;
  for (let i = -w; i <= w; i++) {
    const y = hy + Math.round(2 * (1 - (i * i) / (w * w)));
    g.line(px, py, hx + i, y, WOOD.base);
    px = hx + i;
    py = y;
  }
  if (drawn) g.line(hx, hy + 2, hx, hy + 6, IRON.light);
}

function crossbowSide(g: Grid, hx: number, hy: number, loaded: boolean): void {
  g.line(hx - 3, hy, hx + 3, hy, WOOD.base);
  g.line(hx + 3, hy - 2, hx + 3, hy + 2, IRON.base);
  if (loaded) g.line(hx - 1, hy - 1, hx + 4, hy - 1, IRON.light);
}

function crossbowFront(g: Grid, cx: number, y: number): void {
  g.rect(cx - 3, y, 7, 1, IRON.base);
  g.rect(cx, y, 1, 3, WOOD.base);
}

function quiver(g: Grid, x: number, y: number): void {
  g.rect(x, y, 2, 6, LEATHER.dark);
  g.rect(x, y, 1, 6, LEATHER.base);
  g.rect(x, y - 2, 1, 2, STRING);
}

function staffTip(l: Look): number {
  if (l.weapon === "STICK") return WOOD.dark;
  return l.trim ?? 0xb070ff;
}

/** O brilho do cajado do mago no golpe; o de caminhante não brilha. */
const staffFlash = (l: Look, p: Pose) => (p.act === 1 && l.weapon === "STAFF" ? 0xffffff : staffTip(l));

/** Enxada: cabo de madeira e a folha de ferro atravessada na ponta. */
function hoe(g: Grid, hx: number, hy: number, deg: number, flip: number): void {
  const [bx, by] = polar(hx, hy, deg + 180, 2, flip);
  const [tx, ty] = polar(hx, hy, deg, 10, flip);
  g.line(bx, by, tx, ty, WOOD.base);
  const [ax, ay] = polar(tx, ty, deg - 90, 3, flip);
  g.line(tx, ty, ax, ay, IRON.dark);
}

// --- Figura a pé ---

function drawFront(g: Grid, m: Metrics, cx: number, fy: number, p: Pose, l: Look): void {
  const top = fy - m.legH + 1 + p.bob;
  const y0 = top - m.torsoH;
  const yh = y0 - m.headH + 1 - p.lean;
  const gap = m.torsoW - m.legW * 2;
  const x0 = cx - Math.floor(m.torsoW / 2);
  const team = ramp(l.color);
  const lc = legColor(l);
  if (l.cape !== undefined) {
    const c = ramp(l.cape);
    g.rect(x0 - 1, y0 + 1, 1, m.torsoH + 3, c.dark);
    g.rect(x0 + m.torsoW, y0 + 1, 1, m.torsoH + 3, c.dark);
  }
  leg(g, m, x0 + Math.floor(gap / 2), top, fy, p.lift[0], lc);
  leg(g, m, x0 + m.torsoW - m.legW - Math.floor(gap / 2), top, fy, p.lift[1], lc);
  torso(g, m, x0, y0, m.torsoW, l, true);
  const armH = m.torsoH - 1;
  const armX0 = x0 - m.armW;
  const armX1 = x0 + m.torsoW;
  const s = sleeve(l);
  const skin = SKIN[l.body];
  g.box(armX0, y0 + 1, m.armW, armH, s);
  g.box(armX1, y0 + 1, m.armW, armH, s);
  g.rect(armX0, y0 + armH + 1, m.armW, 2, skin.base);
  g.rect(armX1, y0 + armH + 1, m.armW, 2, skin.base);
  headFront(g, m, cx, yh, l);
  const hx = armX0 + Math.floor(m.armW / 2);
  const hy = y0 + armH + 2;
  // Na guarda, o escudo vem para a frente do peito
  const up = p.guard ? 2 : 0;
  if (l.shield === "ROUND") roundShield(g, armX1 - up, y0 + 4 - up, team);
  if (l.shield === "KITE") kiteShield(g, armX1 - 1 - up, y0 + 1 - up / 2, team, l.trim);
  switch (l.weapon) {
    case "SWORD":
    case "AXE": {
      const axe = l.weapon === "AXE";
      if (p.guard) blade(g, hx + 1, y0 + 3, 70, -1, axe);
      else if (p.act === 1) blade(g, hx - 1, y0 - 1, 100, -1, axe);
      else if (p.act === 2) blade(g, hx + 1, hy, -60, -1, axe);
      else blade(g, hx, hy, p.arm + 150, -1, axe);
      break;
    }
    case "SPEAR":
    case "LANCE":
    case "JAVELIN": {
      const len = l.weapon === "JAVELIN" ? 11 : 16;
      if (p.act === 2) pole(g, hx, y0 + 2, -70, 10, -1, IRON.light);
      else if (p.guard) pole(g, hx, y0 + 4, 60, len, -1, IRON.light);
      else if (p.act === 1 && l.weapon === "JAVELIN") pole(g, hx, y0 - 2, 80, len, -1, IRON.light);
      else pole(g, hx, hy, 88, len, -1, IRON.light);
      break;
    }
    case "STAFF":
    case "STICK":
      g.line(hx, fy, hx, yh - 3, WOOD.base);
      g.rect(hx - 1, yh - 5, 2, 2, staffFlash(l, p));
      break;
    case "HOE":
      // O trabalho: ergue a enxada e crava no chão à frente
      if (p.act === 1) hoe(g, hx, y0 - 1, 95, -1);
      else if (p.act === 2) hoe(g, hx, hy, -80, -1);
      else hoe(g, hx, hy, 85, -1);
      break;
    case "BOW":
      if (p.act === 1) bowFront(g, cx, y0 + 3, true);
      else bowSide(g, armX0 - 1, y0 + 3, false, -1);
      break;
    case "CROSSBOW":
      if (p.act > 0) crossbowFront(g, cx, y0 + 2 - (p.act === 1 ? 1 : 0));
      else g.line(armX0 + 1, hy, armX1, hy - 3, WOOD.base);
      break;
    default:
  }
}

function drawBack(g: Grid, m: Metrics, cx: number, fy: number, p: Pose, l: Look): void {
  const top = fy - m.legH + 1 + p.bob;
  const y0 = top - m.torsoH;
  const yh = y0 - m.headH + 1;
  const gap = m.torsoW - m.legW * 2;
  const x0 = cx - Math.floor(m.torsoW / 2);
  const armX0 = x0 - m.armW;
  const armX1 = x0 + m.torsoW;
  const team = ramp(l.color);
  // Arma na frente do corpo: de costas, fica atrás dele
  switch (l.weapon) {
    case "SWORD":
    case "AXE":
      if (p.act === 1) blade(g, armX1, y0 - 2, 80, 1, l.weapon === "AXE");
      else blade(g, armX1, y0 + 3, 75 - p.act * 25, 1, l.weapon === "AXE");
      break;
    case "SPEAR":
    case "LANCE":
    case "JAVELIN":
      pole(g, armX1 + 1, y0 + m.torsoH, p.act === 2 ? 100 : 92, l.weapon === "JAVELIN" ? 11 : 16, 1, IRON.light);
      break;
    case "STAFF":
    case "STICK":
      g.line(armX1 + 1, fy, armX1 + 1, yh - 3, WOOD.base);
      g.rect(armX1, yh - 5, 2, 2, staffTip(l));
      break;
    case "HOE":
      hoe(g, armX1 + 1, y0 + m.torsoH, p.act === 1 ? 95 : p.act === 2 ? 110 : 88, 1);
      break;
    case "BOW":
      bowSide(g, armX1 + m.armW + 1, y0 + 3 - (p.act === 1 ? 3 : 0), false);
      break;
    case "CROSSBOW":
      crossbowFront(g, cx, y0 - 1);
      break;
    default:
  }
  const lc = legColor(l);
  leg(g, m, x0 + Math.floor(gap / 2), top, fy, p.lift[0], lc);
  leg(g, m, x0 + m.torsoW - m.legW - Math.floor(gap / 2), top, fy, p.lift[1], lc);
  torso(g, m, x0, y0, m.torsoW, l, false);
  const armH = m.torsoH - 1;
  const s = sleeve(l);
  const skin = SKIN[l.body];
  g.box(armX0, y0 + 1, m.armW, armH, s);
  g.box(armX1, y0 + 1, m.armW, armH, s);
  g.rect(armX0, y0 + armH + 1, m.armW, 2, skin.base);
  g.rect(armX1, y0 + armH + 1, m.armW, 2, skin.base);
  if (l.cape !== undefined) {
    const c = ramp(l.cape);
    g.rect(x0, y0 + 1, m.torsoW, m.torsoH + 3, c.base);
    g.rect(x0, y0 + 1, 1, m.torsoH + 3, c.light);
    g.rect(x0 + m.torsoW - 1, y0 + 1, 1, m.torsoH + 3, c.dark);
  }
  headBack(g, m, cx, yh, l);
  if (l.shield === "ROUND") roundShield(g, armX0, y0 + 4, team);
  if (l.shield === "KITE") kiteShield(g, armX0 - 3, y0 + 1, team, l.trim);
  if (l.weapon === "BOW" || l.weapon === "JAVELIN") quiver(g, cx + 1, y0 + 1);
}

function drawSide(g: Grid, m: Metrics, cx: number, fy: number, p: Pose, l: Look): void {
  const top = fy - m.legH + 1 + p.bob;
  const y0 = top - m.torsoH;
  const yh = y0 - m.headH + 1;
  const w = m.torsoW - 2;
  const x0 = cx - Math.floor(w / 2) + p.lean;
  const team = ramp(l.color);
  const lc = legColor(l);
  const legX = cx - Math.floor(m.legW / 2);
  // Perna de trás primeiro, mais escura
  leg(g, m, legX + p.stride[1], top, fy, p.lift[1], { ...lc, base: lc.dark });
  leg(g, m, legX + p.stride[0], top, fy, p.lift[0], lc);
  if (l.cape !== undefined) g.rect(x0 - 2, y0 + 1, 2, m.torsoH + 3, ramp(l.cape).dark);
  if (l.weapon === "BOW" || l.weapon === "JAVELIN") quiver(g, x0 - 2, y0);
  torso(g, m, x0, y0, w, l, false);
  headSide(g, m, cx + p.lean, yh, l);
  const sx = cx + p.lean;
  const sy = y0 + 2;
  const skin = SKIN[l.body];
  const arm = sleeve(l);
  if (l.shield !== "NONE") sideShield(g, x0 + w + (p.guard ? 1 : 0), y0 + (p.guard ? 1 : 3), team, l.shield === "KITE");
  const reach = (deg: number) => {
    const [hx, hy] = polar(sx, sy, deg, 5);
    g.line(sx, sy, hx, hy, arm.dark);
    if (m.armW > 2) g.line(sx, sy + 1, hx, hy + 1, arm.base);
    g.px(hx, hy, skin.base);
    return [hx, hy] as const;
  };
  switch (l.weapon) {
    case "SWORD":
    case "AXE": {
      const [hx, hy] = reach(p.arm);
      blade(g, hx, hy, p.arm + 25, 1, l.weapon === "AXE");
      break;
    }
    case "SPEAR":
    case "LANCE": {
      const deg = p.act === 1 ? 12 : p.act === 2 ? 2 : p.guard ? 30 : 72;
      const [hx, hy] = reach(p.act === 1 ? -40 : p.act === 2 || p.guard ? 0 : -30);
      pole(g, hx + (p.act === 2 ? 2 : 0), hy, deg, 14, 1, IRON.light);
      break;
    }
    case "JAVELIN": {
      if (p.act === 1) {
        const [hx, hy] = reach(120);
        pole(g, hx, hy, 8, 10, 1, IRON.light);
      } else if (p.act === 2) reach(0);
      else {
        const [hx, hy] = reach(-30);
        pole(g, hx, hy, 75, 10, 1, IRON.light);
      }
      break;
    }
    case "STAFF":
    case "STICK": {
      const [hx] = reach(-20);
      g.line(hx + 1, fy, hx + 1, yh - 3, WOOD.base);
      g.rect(hx, yh - 5, 2, 2, staffFlash(l, p));
      break;
    }
    case "HOE": {
      // Erguida atrás da cabeça e cravada no chão à frente
      const [hx, hy] = reach(p.act === 1 ? 60 : p.act === 2 ? -20 : -40);
      hoe(g, hx, hy, p.act === 1 ? 115 : p.act === 2 ? -50 : 70, 1);
      break;
    }
    case "BOW": {
      const hx = x0 + w + 2;
      const hy = sy + 1;
      g.line(sx, sy + 1, hx, hy, arm.dark);
      g.px(hx, hy, skin.base);
      bowSide(g, hx + 1, hy, p.act === 1);
      break;
    }
    case "CROSSBOW": {
      const hx = x0 + w + 1;
      const hy = sy + (p.act > 0 ? 0 : 3);
      g.line(sx, sy + 1, hx, hy, arm.dark);
      crossbowSide(g, hx, hy, p.act !== 2);
      break;
    }
    default:
      reach(-80);
  }
}

/** Morte a pé: ajoelha, tomba e fica no chão. Vale para as três direções. */
function drawFall(g: Grid, m: Metrics, cx: number, fy: number, stage: number, l: Look): void {
  if (stage === 0) {
    drawFront(g, m, cx, fy, { ...poseOf(0), bob: 3 }, l);
    return;
  }
  const team = ramp(l.color);
  const body = l.armor === 2 ? IRON : l.body === "SKELETON" && l.armor === 0 ? SKIN.SKELETON : team;
  const lay = stage === 2;
  const len = m.torsoH + 2;
  const thick = lay ? m.torsoW - 3 : m.torsoW - 2;
  const y = fy - thick + 1 - (lay ? 0 : 2);
  const x = cx - Math.floor(len / 2);
  g.rect(x - m.legH + 1, y + 1, m.legH, Math.max(1, thick - 2), legColor(l).base);
  g.rect(x - m.legH + 1, y + 1, 2, Math.max(1, thick - 2), BOOT.base);
  g.box(x, y, len, thick, body);
  g.rect(x, y + thick - 1, len, 1, body.dark);
  const hw = m.headH - 2;
  g.rect(x + len, y - 1, hw, thick + 1, SKIN[l.body].base);
  g.rect(x + len + Math.floor(m.headH / 3), y - 1, hw - Math.floor(m.headH / 3), thick + 1, gearColor(l));
  g.px(x + len + hw - 1, y - 1, CLEAR);
  g.px(x + len + hw - 1, y + thick - 1, CLEAR);
  if (l.shield !== "NONE") g.oval(x - 1, y + thick, 3, 2, team.dark);
  if (l.weapon === "SWORD" || l.weapon === "AXE") g.line(x + 3, y - 2, x + len + 2, y - 3, IRON.light);
  else if (l.weapon !== "NONE") g.line(x - 2, y - 2, x + len + 4, y - 2, WOOD.base);
  if (lay && l.body !== "SKELETON") {
    g.rect(x + 2, fy + 1, len - 1, 1, 0x7a1f1f);
    g.rect(x + 4, fy + 2, len - 4, 1, 0x7a1f1f);
  }
}

// --- Montaria ---

function mountRamp(l: Look): Ramp {
  if (l.beast === "DEER") return DEER;
  return l.mount === "WOLF" || l.beast === "WOLF" ? WOLF : HORSE;
}

/** Pernas do bicho de lado: quatro, num trote que alterna os pares. */
function gaitOffsets(frame: number): number[] {
  if (frame < ANIM.WALK || frame >= ANIM.ATTACK) return [0, 0, 0, 0];
  return [
    [2, -1, -2, 1],
    [0, 0, 0, 0],
    [-2, 1, 2, -1],
    [0, 0, 0, 0],
  ][frame - ANIM.WALK];
}

function horseSide(g: Grid, cx: number, fy: number, frame: number, l: Look): number {
  const c = mountRamp(l);
  const wolf = l.mount === "WOLF" || l.beast === "WOLF";
  const legH = wolf ? 4 : 6;
  const gait = gaitOffsets(frame);
  const p = poseOf(frame);
  const crouch = wolf && p.act === 1 ? 1 : 0;
  const lunge = wolf && p.act === 2 ? 2 : 0;
  const bodyY = fy - legH - (wolf ? 2 : 3) + p.bob + crouch;
  const rx = wolf ? 6 : 8;
  const legsX = wolf ? [cx + 4, cx - 5, cx + 2, cx - 7] : [cx + 6, cx - 6, cx + 4, cx - 8];
  const leg = (x: number, shade: number, lift: number) => {
    g.rect(x, bodyY + 1, 2, fy - bodyY - lift, shade);
    g.rect(x, fy - lift, 2, 1, OUTLINE);
  };
  leg(legsX[2] + gait[2] + lunge, c.dark, gait[2] > 0 ? 1 : 0);
  leg(legsX[3] + gait[3] + lunge, c.dark, gait[3] > 0 ? 1 : 0);
  const deer = l.beast === "DEER";
  // Rabo
  if (wolf) g.line(cx - rx, bodyY - 1, cx - rx - 3, bodyY - 3, c.light);
  else if (deer) g.rect(cx - rx - 1, bodyY - 3, 2, 2, DEER_TAIL);
  else {
    g.line(cx - rx, bodyY - 2, cx - rx - 2, bodyY + 4, MANE);
    g.px(cx - rx - 1, bodyY - 2, MANE);
  }
  g.oval(cx + lunge, bodyY, rx, wolf ? 2 : 3, c.base);
  g.rect(cx - rx + 2 + lunge, bodyY - (wolf ? 2 : 3), rx * 2 - 4, 1, c.light);
  g.rect(cx - rx + 2 + lunge, bodyY + (wolf ? 2 : 3), rx * 2 - 4, 1, c.dark);
  if (l.mount === "BARDED") {
    const t = ramp(l.color);
    g.oval(cx, bodyY, rx, 3, t.base);
    g.rect(cx - rx + 1, bodyY + 1, rx * 2 - 1, 3, t.base);
    g.rect(cx - rx + 1, bodyY + 3, rx * 2 - 1, 1, l.trim ?? t.light);
    g.rect(cx - rx + 2, bodyY - 3, rx * 2 - 4, 1, t.light);
  }
  if (wolf) {
    const hx = cx + rx - 1 + lunge;
    const hy = bodyY - 3;
    g.rect(hx, hy, 4, 3, c.base);
    g.rect(hx + 4, hy + 1, 2, 2, c.base);
    g.px(hx + 5, hy + 2, p.act === 2 ? 0x8a2020 : OUTLINE);
    g.px(hx + 1, hy - 1, c.dark);
    g.px(hx + 2, hy - 2, c.dark);
    g.px(hx + 3, hy, OUTLINE);
  } else {
    // Pescoço, cabeça e crina
    g.rect(cx + 6, bodyY - 5, 3, 4, c.base);
    g.rect(cx + 7, bodyY - 8, 3, 3, c.base);
    g.rect(cx + 9, bodyY - 9, 4, 3, c.base);
    g.rect(cx + 12, bodyY - 8, 2, 2, c.dark);
    g.px(cx + 10, bodyY - 8, OUTLINE);
    g.px(cx + 8, bodyY - 10, c.dark);
    if (deer) {
      // Sem crina: a galhada, com as pontas para trás
      g.line(cx + 9, bodyY - 10, cx + 8, bodyY - 14, ANTLER);
      g.line(cx + 8, bodyY - 12, cx + 6, bodyY - 13, ANTLER);
      g.line(cx + 11, bodyY - 10, cx + 12, bodyY - 14, ANTLER);
      g.px(cx + 13, bodyY - 13, ANTLER);
      g.px(cx + 9, bodyY - 7, DEER_TAIL);
    } else g.line(cx + 6, bodyY - 6, cx + 8, bodyY - 9, MANE);
    if (l.mount === "BARDED") g.rect(cx + 9, bodyY - 9, 3, 1, IRON.light);
  }
  leg(legsX[0] + gait[0] + lunge, c.base, gait[0] > 0 ? 1 : 0);
  leg(legsX[1] + gait[1] + lunge, c.base, gait[1] > 0 ? 1 : 0);
  return bodyY - (wolf ? 2 : 3);
}

/** No passo, de frente ou de costas, um par de patas sobe de cada vez. */
const stepOf = (frame: number) => (frame >= ANIM.WALK && frame < ANIM.ATTACK ? ((frame - ANIM.WALK) % 2 === 0 ? 1 : 0) : 0);

/** Pata vista de frente ou de costas, com o casco escuro. */
function hoof(g: Grid, x: number, top: number, bottom: number, w: number, shade: number): void {
  g.rect(x, top, w, bottom - top, shade);
  g.rect(x, bottom - 1, w, 1, MANE);
}

/** Lombo atrás (ou à frente) do cavaleiro: é ele que diz "isto é um cavalo" de frente e de costas. */
function barrel(g: Grid, cx: number, y: number, c: Ramp, l: Look): void {
  const cover = l.mount === "BARDED" ? ramp(l.color) : c;
  g.oval(cx, y, 5, 3, cover.base);
  g.rect(cx - 3, y - 3, 6, 1, cover.light);
  g.rect(cx + 3, y - 1, 2, 3, cover.dark);
}

/** Cavalo de frente: patas, lombo e peito largo. A cabeça vem depois do cavaleiro, por cima dele. */
function horseFront(g: Grid, cx: number, fy: number, frame: number, l: Look): number {
  const c = mountRamp(l);
  const step = stepOf(frame);
  const chestY = fy - 13 + poseOf(frame).bob;
  // As de trás ficam mais longe, então terminam mais alto
  hoof(g, cx - 5, chestY + 5, fy - 1 - (1 - step), 1, c.dark);
  hoof(g, cx + 4, chestY + 5, fy - 1 - step, 1, c.dark);
  barrel(g, cx, chestY - 2, c, l);
  hoof(g, cx - 3, chestY + 5, fy + 1 - step, 2, c.base);
  hoof(g, cx + 1, chestY + 5, fy + 1 - (1 - step), 2, c.base);
  g.box(cx - 5, chestY, 10, 6, c);
  if (l.mount === "BARDED") {
    const t = ramp(l.color);
    g.box(cx - 5, chestY, 10, 6, t);
    g.rect(cx - 5, chestY + 5, 10, 1, l.trim ?? t.light);
  }
  return chestY;
}

/** Pescoço e cabeça de frente, por cima da barriga do cavaleiro: orelhas, testa e focinho. */
function horseHead(g: Grid, cx: number, chestY: number, l: Look): void {
  const c = mountRamp(l);
  g.rect(cx - 3, chestY - 2, 6, 3, c.dark);
  g.rect(cx - 2, chestY - 3, 4, 8, c.base);
  g.rect(cx - 2, chestY - 3, 1, 6, c.light);
  g.rect(cx - 2, chestY + 3, 4, 2, c.dark);
  g.px(cx - 1, chestY + 4, OUTLINE);
  g.px(cx, chestY + 4, OUTLINE);
  g.px(cx - 2, chestY - 1, OUTLINE);
  g.px(cx + 1, chestY - 1, OUTLINE);
  g.px(cx - 2, chestY - 4, c.dark);
  g.px(cx + 1, chestY - 4, c.dark);
  if (l.beast === "DEER") {
    // A galhada aberta em V e o focinho claro
    g.line(cx - 2, chestY - 4, cx - 4, chestY - 8, ANTLER);
    g.line(cx + 1, chestY - 4, cx + 3, chestY - 8, ANTLER);
    g.px(cx - 5, chestY - 7, ANTLER);
    g.px(cx + 4, chestY - 7, ANTLER);
    g.rect(cx - 1, chestY + 3, 2, 1, DEER_TAIL);
  } else g.rect(cx - 1, chestY - 3, 2, 1, MANE);
  if (l.mount === "BARDED") g.rect(cx - 1, chestY - 2, 2, 4, IRON.light);
}

/** Cavalo de costas: garupa larga e rabo na frente, lombo atrás do cavaleiro. */
function horseBack(g: Grid, cx: number, fy: number, frame: number, l: Look): number {
  const c = mountRamp(l);
  const step = stepOf(frame);
  const rumpY = fy - 14 + poseOf(frame).bob;
  // As da frente do bicho ficam longe, entre as de trás
  hoof(g, cx - 2, rumpY + 6, fy - 1 - step, 1, c.dark);
  hoof(g, cx + 1, rumpY + 6, fy - 1 - (1 - step), 1, c.dark);
  barrel(g, cx, rumpY - 1, c, l);
  hoof(g, cx - 5, rumpY + 6, fy + 1 - (1 - step), 2, c.base);
  hoof(g, cx + 3, rumpY + 6, fy + 1 - step, 2, c.base);
  // Garupa mais larga que o cavaleiro, partida ao meio pelo rabo
  const cover = l.mount === "BARDED" ? ramp(l.color) : c;
  g.oval(cx, rumpY + 3, 7, 3, cover.base);
  g.rect(cx - 6, rumpY + 1, 4, 1, cover.light);
  g.rect(cx + 2, rumpY + 1, 4, 1, cover.light);
  g.rect(cx + 5, rumpY + 3, 2, 3, cover.dark);
  if (l.mount === "BARDED") g.rect(cx - 6, rumpY + 6, 13, 1, l.trim ?? cover.light);
  if (l.beast === "DEER") {
    // O traseiro branco e o rabo curto; a galhada aparece por cima da garupa
    g.oval(cx, rumpY + 3, 3, 2, DEER_TAIL);
    g.rect(cx - 1, rumpY + 1, 2, 2, c.dark);
    g.line(cx - 2, rumpY - 3, cx - 4, rumpY - 7, ANTLER);
    g.line(cx + 1, rumpY - 3, cx + 3, rumpY - 7, ANTLER);
    return rumpY;
  }
  // Rabo: balança no passo e abre na ponta
  const sway = step ? 1 : 0;
  g.rect(cx - 1, rumpY, 2, 6, MANE);
  g.rect(cx - 1 + sway, rumpY + 6, 2, 3, MANE);
  g.rect(cx - 2 + sway, rumpY + 9, 4, 1, MANE);
  return rumpY;
}

/** Lobo de frente e de costas: mais baixo, cabeça larga e rabo para cima. */
function wolfFront(g: Grid, cx: number, fy: number, frame: number): number {
  const step = stepOf(frame);
  const chestY = fy - 8 + poseOf(frame).bob;
  g.rect(cx - 3, chestY + 4, 2, fy - chestY - 4 - step, WOLF.dark);
  g.rect(cx + 1, chestY + 4, 2, fy - chestY - 4 - (1 - step), WOLF.base);
  g.box(cx - 4, chestY, 8, 5, WOLF);
  return chestY;
}

function wolfHead(g: Grid, cx: number, chestY: number): void {
  g.rect(cx - 3, chestY - 2, 6, 4, WOLF.base);
  g.rect(cx - 1, chestY + 1, 2, 2, WOLF.dark);
  g.px(cx - 3, chestY - 3, WOLF.dark);
  g.px(cx + 2, chestY - 3, WOLF.dark);
  g.px(cx - 2, chestY - 1, OUTLINE);
  g.px(cx + 1, chestY - 1, OUTLINE);
}

function wolfBack(g: Grid, cx: number, fy: number, frame: number): number {
  const step = stepOf(frame);
  const rumpY = fy - 8 + poseOf(frame).bob;
  g.rect(cx - 4, rumpY + 4, 2, fy - rumpY - 4 - step, WOLF.dark);
  g.rect(cx + 2, rumpY + 4, 2, fy - rumpY - 4 - (1 - step), WOLF.base);
  g.box(cx - 5, rumpY, 10, 5, WOLF);
  g.line(cx, rumpY, cx + 1, rumpY - 4, WOLF.light);
  return rumpY;
}

/** Cavaleiro sentado: tronco, cabeça, perna de fora e a arma, a partir do assento. */
function riderSide(g: Grid, m: Metrics, cx: number, seat: number, p: Pose, l: Look): void {
  const team = ramp(l.color);
  const w = m.torsoW - 3;
  const h = m.torsoH - 1;
  const y0 = seat - h;
  const x0 = cx - Math.floor(w / 2) - 1;
  g.rect(cx - 1, seat - 1, 2, 5, legColor(l).base);
  g.rect(cx - 1, seat + 3, 2, 1, BOOT.base);
  if (l.cape !== undefined) g.rect(x0 - 2, y0 + 1, 2, h + 2, ramp(l.cape).dark);
  if (l.weapon === "BOW") quiver(g, x0 - 2, y0);
  torso(g, { ...m, torsoH: h }, x0, y0, w, l, false);
  headSide(g, m, cx - 1, y0 - m.headH + 1, l);
  const sx = cx - 1;
  const sy = y0 + 2;
  const arm = sleeve(l);
  const skin = SKIN[l.body];
  if (l.shield !== "NONE") sideShield(g, x0 + w, y0 + 3, team, l.shield === "KITE");
  const reach = (deg: number) => {
    const [hx, hy] = polar(sx, sy, deg, 5);
    g.line(sx, sy, hx, hy, arm.dark);
    g.px(hx, hy, skin.base);
    return [hx, hy] as const;
  };
  switch (l.weapon) {
    case "LANCE":
    case "SPEAR": {
      const [hx, hy] = reach(p.act === 1 ? -30 : p.act === 2 ? 0 : -40);
      pole(g, hx + (p.act === 2 ? 2 : 0), hy, p.act === 1 ? 8 : p.act === 2 ? 0 : 70, 18, 1, IRON.light);
      break;
    }
    case "BOW": {
      const hx = x0 + w + 2;
      g.line(sx, sy + 1, hx, sy + 1, arm.dark);
      bowSide(g, hx + 1, sy + 1, p.act === 1);
      break;
    }
    case "CROSSBOW":
      crossbowSide(g, x0 + w + 1, sy + 1, p.act !== 2);
      break;
    case "NONE":
      reach(-60);
      break;
    default: {
      const [hx, hy] = reach(p.arm);
      blade(g, hx, hy, p.arm + 25, 1, l.weapon === "AXE");
    }
  }
}

function riderUpright(g: Grid, m: Metrics, cx: number, seat: number, l: Look, front: boolean): void {
  const team = ramp(l.color);
  const w = m.torsoW;
  const h = m.torsoH - 1;
  const y0 = seat - h;
  const x0 = cx - Math.floor(w / 2);
  // Pernas abertas por cima do lombo, botas caindo dos lados do bicho
  const lc = legColor(l);
  g.rect(x0 - 2, seat - 1, 2, 5, lc.base);
  g.rect(x0 + w, seat - 1, 2, 5, lc.dark);
  g.rect(x0 - 2, seat + 4, 2, 2, BOOT.base);
  g.rect(x0 + w, seat + 4, 2, 2, BOOT.base);
  torso(g, { ...m, torsoH: h }, x0, y0, w, l, front);
  const s = sleeve(l);
  g.box(x0 - m.armW, y0 + 1, m.armW, h - 1, s);
  g.box(x0 + w, y0 + 1, m.armW, h - 1, s);
  if (!front && l.cape !== undefined) {
    const c = ramp(l.cape);
    g.rect(x0, y0 + 1, w, h + 2, c.base);
    g.rect(x0, y0 + 1, 1, h + 2, c.light);
  }
  if (front) headFront(g, m, cx, y0 - m.headH + 1, l);
  else headBack(g, m, cx, y0 - m.headH + 1, l);
  const hx = front ? x0 - m.armW : x0 + w + 1;
  if (l.weapon === "LANCE" || l.weapon === "SPEAR") pole(g, hx, seat, 88, 18, 1, IRON.light);
  else if (l.weapon === "SWORD" || l.weapon === "AXE") blade(g, hx, seat - 1, front ? -100 : 80, 1, l.weapon === "AXE");
  else if (l.weapon === "BOW") bowSide(g, hx - (front ? 1 : 0), y0 + 3, false, front ? -1 : 1);
  if (front && l.shield !== "NONE") roundShield(g, x0 + w + 1, y0 + 3, team);
  if (!front && l.shield !== "NONE") roundShield(g, x0 - m.armW, y0 + 3, team);
}

function drawMounted(g: Grid, m: Metrics, cx: number, fy: number, dir: Dir, frame: number, l: Look): void {
  const p = poseOf(frame);
  const wolf = l.mount === "WOLF";
  if (l.beast === "WOLF") {
    if (dir === "E") horseSide(g, cx, fy, frame, l);
    else if (dir === "S") wolfHead(g, cx, wolfFront(g, cx, fy, frame));
    else wolfBack(g, cx, fy, frame);
    return;
  }
  if (l.beast === "DEER") {
    if (dir === "E") horseSide(g, cx, fy, frame, l);
    else if (dir === "S") horseHead(g, cx, horseFront(g, cx, fy, frame, l), l);
    else horseBack(g, cx, fy, frame, l);
    return;
  }
  if (dir === "E") {
    const back = horseSide(g, cx, fy, frame, l);
    riderSide(g, m, cx - 1, back + 1, p, l);
  } else if (dir === "S") {
    const chest = wolf ? wolfFront(g, cx, fy, frame) : horseFront(g, cx, fy, frame, l);
    riderUpright(g, m, cx, wolf ? chest + 1 : chest - 2, l, true);
    if (wolf) wolfHead(g, cx, chest);
    else horseHead(g, cx, chest, l);
  } else {
    const rump = wolf ? wolfBack(g, cx, fy, frame) : horseBack(g, cx, fy, frame, l);
    riderUpright(g, m, cx, wolf ? rump + 1 : rump - 2, l, false);
  }
}

/** Morte montada: o bicho dobra as pernas e deita de lado, e quem montava cai na frente. */
function drawMountedFall(g: Grid, m: Metrics, cx: number, fy: number, stage: number, l: Look): void {
  const c = mountRamp(l);
  const wolf = l.mount === "WOLF" || l.beast === "WOLF";
  if (stage < 2) {
    const sink = stage === 0 ? 2 : 4;
    const bodyY = fy - (wolf ? 4 : 7) + sink;
    g.oval(cx, bodyY, wolf ? 6 : 8, wolf ? 2 : 3, c.base);
    g.rect(cx - 6, bodyY + 2, 2, fy - bodyY - 2, c.dark);
    g.rect(cx + 5, bodyY + 2, 2, fy - bodyY - 2, c.dark);
    if (!wolf) g.rect(cx + 7, bodyY - 5 + sink, 3, 5, c.base);
    if (!l.beast) riderSide(g, m, cx - 1, bodyY - 2, poseOf(0), l);
    return;
  }
  g.oval(cx - 2, fy - 3, wolf ? 6 : 9, wolf ? 2 : 3, c.base);
  for (const x of wolf ? [cx - 4, cx] : [cx - 6, cx - 2, cx + 2]) g.line(x, fy - 1, x + 3, fy + 1, c.dark);
  g.rect(cx + (wolf ? 4 : 7), fy - 4, wolf ? 4 : 5, 3, c.base);
  if (l.mount === "BARDED") g.oval(cx - 2, fy - 3, 8, 2, ramp(l.color).base);
  if (!l.beast) {
    const team = ramp(l.color);
    g.box(cx - 10, fy - 9, 7, 3, l.armor === 2 ? IRON : team);
    g.rect(cx - 3, fy - 10, 3, 4, gearColor(l));
  }
}

function frameGrid(l: Look, dir: Dir, frame: number): Grid {
  const cell = baseCell(l);
  let g = new Grid(cell.w, cell.h);
  const m = METRICS[l.body];
  const cx = cell.feetX;
  const fy = cell.feetY;
  const mounted = rides(l);
  if (isFall(frame)) {
    if (mounted) drawMountedFall(g, m, cx, fy, frame - ANIM.DIE, l);
    else drawFall(g, m, cx, fy, frame - ANIM.DIE, l);
  } else if (mounted) drawMounted(g, m, cx, fy, dir, frame, l);
  else if (dir === "S") drawFront(g, m, cx, fy, poseOf(frame), l);
  else if (dir === "N") drawBack(g, m, cx, fy, poseOf(frame), l);
  else drawSide(g, m, cx, fy, poseOf(frame), l);
  g = grow(g, l);
  g.outline();
  const k = big(l) ? 2 : 1;
  // Quem já está no chão não faz sombra
  if (frame !== ANIM.DIE + 2) g.shadow(cx * k, (fy + 1) * k, (mounted ? 9 : Math.floor(m.torsoW * 0.7)) * k, 2 * k);
  return g;
}

/** Folha completa de uma figura: linhas = direções, colunas = quadros. */
export function figureSheet(l: Look): Bitmap {
  const cell = cellOf(l);
  const sheet = new Grid(cell.w * FRAMES, cell.h * DIRS.length);
  DIRS.forEach((dir, row) => {
    for (let f = 0; f < FRAMES; f++) sheet.stamp(frameGrid(l, dir, f), f * cell.w, row * cell.h);
  });
  return gridBitmap(sheet);
}

/** Mini-sprite do zoom de 50%: dois quadros, só cabeça, corpo na cor da tropa e pernas. */
export function miniSheet(l: Look): Bitmap {
  const { w, h } = baseMini(l);
  const k = big(l) ? 2 : 1;
  const sheet = new Grid(w * 2 * k, h * k);
  const team = ramp(l.color);
  for (let f = 0; f < 2; f++) {
    let g = new Grid(w, h);
    const cx = Math.floor(w / 2);
    if (rides(l)) {
      const c = mountRamp(l);
      g.rect(cx - 5, h - 6, 10, 3, l.mount === "BARDED" ? team.base : c.base);
      g.rect(cx - 4, h - 3, 1, 2 - f, c.dark);
      g.rect(cx + 3, h - 3, 1, 1 + f, c.dark);
      g.rect(cx + 5, h - 8, 2, 3, c.base);
      if (!l.beast) {
        g.box(cx - 2, h - 10, 4, 4, team);
        g.rect(cx - 1, h - 12, 2, 2, gearColor(l));
      }
    } else {
      const head = gearColor(l);
      g.rect(cx - 2, 1, 4, 4, head);
      g.rect(cx - 1, 4, 2, 1, SKIN[l.body].base);
      const bodyH = h - 9;
      g.box(cx - 3, 5, 6, bodyH, l.armor === 2 ? IRON : team);
      if (l.armor === 2) g.rect(cx - 1, 6, 2, bodyH - 1, team.base);
      g.rect(cx - 2, 5 + bodyH, 2, f === 0 ? 2 : 1, BOOT.base);
      g.rect(cx, 5 + bodyH, 2, f === 0 ? 1 : 2, BOOT.base);
    }
    g = grow(g, l);
    g.outline();
    sheet.stamp(g, f * w * k, 0);
  }
  return gridBitmap(sheet);
}

/** Bloquinho do zoom mais aberto: a tropa inteira vira uma mancha na cor dela. */
export function dotSprite(l: Look): Bitmap {
  const { w, h } = baseDot(l);
  const g = new Grid(w, h);
  const team = ramp(l.color);
  if (l.beast) {
    g.rect(0, 1, w, h - 2, mountRamp(l).base);
    return gridBitmap(g);
  }
  g.rect(0, 0, w, h - 1, team.base);
  g.rect(0, 0, w, 1, gearColor(l));
  g.rect(0, h - 1, w, 1, rides(l) ? HORSE.dark : team.dark);
  return gridBitmap(big(l) ? enlarge(g) : g);
}

/**
 * Estandarte do desafio (Marco 21): o herói que procura o Comandante para um duelo leva uma
 * flâmula vermelha de duas pontas, com duas espadas cruzadas. Aparece antes do contato.
 */
export function duelBannerSprite(): Bitmap {
  const g = new Grid(13, 22);
  const cloth = ramp(0xb0242a);
  g.rect(1, 0, 2, 22, WOOD.base);
  g.rect(2, 0, 1, 22, WOOD.dark);
  g.rect(1, 0, 2, 1, 0xd8b048);
  // Flâmula de duas pontas, presa no alto do mastro
  g.rect(3, 1, 9, 9, cloth.base);
  g.rect(3, 1, 9, 1, cloth.light);
  g.rect(3, 10, 4, 2, cloth.base);
  g.rect(9, 10, 3, 2, cloth.base);
  g.rect(7, 9, 2, 1, CLEAR);
  g.rect(3, 9, 9, 1, cloth.dark);
  const ink = 0xf4ecd8;
  g.line(5, 8, 10, 3, ink);
  g.line(5, 3, 10, 8, ink);
  g.outline();
  return gridBitmap(g);
}

/** Estandarte do batalhão no zoom aberto: diz de longe quem é quem. */
export function bannerSprite(color: number, glyph: "SWORD" | "BOW" | "HORSE" | "SPEAR"): Bitmap {
  const g = new Grid(19, 25);
  const t = ramp(color);
  g.rect(2, 1, 2, 23, WOOD.base);
  g.rect(3, 1, 1, 23, WOOD.dark);
  g.rect(4, 2, 13, 13, t.base);
  g.rect(4, 2, 13, 1, t.light);
  g.rect(4, 14, 13, 1, t.dark);
  const ink = 0xffffff;
  if (glyph === "SWORD") {
    g.line(7, 12, 14, 4, ink);
    g.line(8, 7, 11, 11, ink);
  } else if (glyph === "SPEAR") {
    g.line(7, 13, 14, 4, ink);
    g.rect(13, 4, 2, 2, ink);
  } else if (glyph === "BOW") {
    g.line(8, 4, 8, 12, ink);
    g.line(8, 4, 13, 8, ink);
    g.line(13, 8, 8, 12, ink);
    g.line(6, 8, 14, 8, ink);
  } else {
    g.rect(6, 8, 8, 3, ink);
    g.rect(12, 5, 2, 3, ink);
    g.rect(6, 11, 1, 2, ink);
    g.rect(12, 11, 1, 2, ink);
  }
  g.outline();
  return gridBitmap(g);
}
