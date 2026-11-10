import type { CampKind, CampNeed } from "../data/campGrid";
import type { Formation, Good, TroopType, Weather } from "../../utils/constants";
import { ICON_ART, type ArtId } from "./iconArt";
import { OUTLINE, type Bitmap } from "./pixel";

/**
 * Os ícones da interface (G5, parte 3), em pixel art feita por código como as figuras: as tropas,
 * os bens, as construções do Marco 22, os botões de batalha e os sinais do texto (⚑, ★, ☠...).
 * Os desenhos ficam em `iconArt.ts`; aqui saem as cores, o contorno e o bitmap. Sem DOM: quem
 * transforma o bitmap em imagem é `ui/pixelIcons.ts`.
 */

/** Lado do desenho (sem o contorno) e do ícone pronto, que tem a altura da fonte de pixel. */
export const ICON_ART_SIZE = 10;
export const ICON_SIZE = ICON_ART_SIZE + 2;

/** As cores dos desenhos, uma letra por cor (o ponto é vazio). */
export const ICON_PALETTE: Readonly<Record<string, number>> = {
  w: 0xfbf6ea,
  n: 0xe8dcc6,
  N: 0xa89478,
  k: 0x2e2a36,
  s: 0xd8dde3,
  S: 0x9aa1aa,
  t: 0x5d636b,
  g: 0xf6d36a,
  G: 0xd29a2e,
  h: 0x8a5a1a,
  b: 0xb4804c,
  B: 0x7a4e2c,
  d: 0x4a2e1a,
  r: 0xe0574a,
  R: 0x9a2a2a,
  e: 0x9ccc5a,
  E: 0x4a7a2a,
  u: 0x7fb4ec,
  U: 0x3a62a8,
  p: 0xd08ae0,
  P: 0x7a3a9a,
  x: 0xf28a24,
  y: 0xf8e070,
  Y: 0xc8a040,
  c: 0xdfeaf2,
  C: 0x8f9caa,
  a: 0x5ab8e0,
  A: 0x2a6aa8,
  m: 0xd8786a,
};

type Art = readonly string[];

const flipV = (a: Art): Art => [...a].reverse();
const recolor = (a: Art, map: Readonly<Record<string, string>>): Art => a.map((row) => [...row].map((c) => map[c] ?? c).join(""));
/** `b` por cima de `a`, onde `b` não é vazio. */
const overlay = (a: Art, b: Art): Art => a.map((row, y) => [...row].map((c, x) => (b[y]?.[x] && b[y][x] !== "." ? b[y][x] : c)).join(""));

/** Os que saem de outro desenho: espelhados, em outra cor ou com uma peça por cima. */
const DERIVED = {
  RETREAT: flipV(ICON_ART.ADVANCE),
  CLOSE: recolor(ICON_ART.CROSS, { r: "s", R: "S" }),
  TENT_GOLD: recolor(ICON_ART.TENT, { r: "g" }),
  TENT_BLUE: recolor(ICON_ART.TENT, { r: "u" }),
  STANDARD: recolor(ICON_ART.BANNER, { r: "u", R: "U" }),
  /** O cavalo com a barda de ferro e o penacho */
  KNIGHT: recolor(ICON_ART.HORSES, { b: "S", B: "t", d: "r" }),
  /** O cavalo com a flecha embaixo */
  HORSE_ARCHER: overlay(ICON_ART.HORSES, ["", "", "", "", "", "", "", "", "....", "rrSSs"]),
  FORAGE: ICON_ART.GRAIN,
  /** A caveira roxa do pavor (Marco 19) */
  TERROR: recolor(ICON_ART.SKULL, { n: "p", N: "P" }),
} satisfies Record<string, Art>;

const ICONS: Readonly<Record<ArtId | keyof typeof DERIVED, Art>> = { ...ICON_ART, ...DERIVED };

export type IconId = keyof typeof ICONS;
export const ICON_IDS = Object.keys(ICONS) as IconId[];

const cache = new Map<IconId, Bitmap>();

/** O ícone pronto: o desenho no meio de 12×12, com o contorno escuro em volta (4 vizinhos). */
export function iconBitmap(id: IconId): Bitmap {
  const hit = cache.get(id);
  if (hit) return hit;
  const art = ICONS[id];
  const color = new Int32Array(ICON_SIZE * ICON_SIZE).fill(-1);
  art.forEach((row, y) => {
    [...row].forEach((c, x) => {
      const v = ICON_PALETTE[c];
      if (v !== undefined) color[(y + 1) * ICON_SIZE + x + 1] = v;
    });
  });
  const filled = color.slice();
  for (let y = 0; y < ICON_SIZE; y++) {
    for (let x = 0; x < ICON_SIZE; x++) {
      if (filled[y * ICON_SIZE + x] >= 0) continue;
      const near = (dx: number, dy: number) => {
        const nx = x + dx;
        const ny = y + dy;
        return nx >= 0 && ny >= 0 && nx < ICON_SIZE && ny < ICON_SIZE && filled[ny * ICON_SIZE + nx] >= 0;
      };
      if (near(1, 0) || near(-1, 0) || near(0, 1) || near(0, -1)) color[y * ICON_SIZE + x] = OUTLINE;
    }
  }
  const rgba = new Uint8ClampedArray(ICON_SIZE * ICON_SIZE * 4);
  color.forEach((v, i) => {
    if (v < 0) return;
    rgba[i * 4] = (v >> 16) & 255;
    rgba[i * 4 + 1] = (v >> 8) & 255;
    rgba[i * 4 + 2] = v & 255;
    rgba[i * 4 + 3] = 255;
  });
  const bm: Bitmap = { width: ICON_SIZE, height: ICON_SIZE, rgba };
  cache.set(id, bm);
  return bm;
}

/** O ícone de cada bem tem o nome do bem. */
export const GOOD_ICON: Readonly<Record<Good, IconId>> = {
  GRAIN: "GRAIN",
  MEAT: "MEAT",
  SALT: "SALT",
  WOOD: "WOOD",
  IRON: "IRON",
  CLOTH: "CLOTH",
  ALE: "ALE",
  ARMS: "ARMS",
  HORSES: "HORSES",
  LUXURY: "LUXURY",
};

export const TROOP_ICON: Readonly<Record<TroopType, IconId>> = {
  INFANTRY: "SWORD",
  SPEARMEN: "SPEAR",
  HEAVY: "HELM",
  ARCHERS: "BOW",
  CROSSBOW: "CROSSBOW",
  JAVELINS: "JAVELINS",
  CAVALRY: "HORSES",
  KNIGHTS: "KNIGHT",
  HORSE_ARCHERS: "HORSE_ARCHER",
};

export const FORMATION_ICON: Readonly<Record<Formation, IconId>> = {
  LINE: "LINE",
  SHIELD_WALL: "SHIELD_WALL",
  WEDGE: "WEDGE",
  LOOSE: "LOOSE",
};

export const WEATHER_ICON: Readonly<Record<Weather, IconId>> = {
  CLEAR: "SUN",
  RAIN: "RAIN",
  FOG: "FOG",
  SNOW: "SNOW",
  STORM: "STORM",
};

export const NEED_ICON: Readonly<Record<CampNeed, IconId>> = {
  BEDS: "BEDS",
  FOOD: "FOOD",
  SALUBRITY: "DROP",
  CURE: "CURE",
  MORALE: "HEART",
  SECURITY: "SHIELD",
  CRAFT: "HAMMER",
};

/** Cada construção pelo que ela faz. */
export const BUILDING_ICON: Readonly<Record<CampKind, IconId>> = {
  COMMAND_TENT: "TENT_GOLD",
  CAMPFIRE: "FIRE",
  BARRACK: "TENT",
  RECRUIT_MAST: "MAST",
  QUARTERMASTER: "CRATE",
  RECRUIT_POST: "RECRUIT",
  TRAINING: "DUMMY",
  ARCHERY: "TARGET",
  STABLE: "HORSESHOE",
  FORGE: "ANVIL",
  OFFICERS_TENT: "TENT_BLUE",
  KITCHEN: "POT",
  INFIRMARY: "CURE",
  WELL: "WELL",
  TOWER: "TOWER",
  OVEN: "BREAD",
  SMOKEHOUSE: "MEAT",
  LATRINE: "OUTHOUSE",
  HERBALIST: "HERB",
  CAPTAIN_TENT: "BANNER",
  CAMP_TAVERN: "ALE",
  DICE: "DICE",
  STANDARD: "STANDARD",
  TROPHY: "TROPHY",
  CEMETERY: "GRAVE",
  STORY_FIRE: "LUTE",
  ALTAR: "ALTAR",
  CARPENTRY: "SAW",
  SADDLERY: "SADDLE",
  TAILOR: "CLOTH",
  LUMBER: "AXE",
  GARDEN: "SPROUT",
  RIDING: "HORSES",
  ARSENAL: "ARMS",
  PEN: "CHAIN",
  MAP_TENT: "MAP",
  CALTROPS: "CALTROP",
  SENTRY: "EYE",
  KEEP: "KEEP",
  BARRACKS_HALL: "HALL",
  GREAT_HALL: "GOBLET",
  DUNGEON: "BARS",
  CISTERN: "DROP",
  STOREHOUSE: "BARREL",
  OFFICER_SCHOOL: "BOOK",
  TREASURY: "CHEST",
  SIEGE_WORKSHOP: "LADDER",
  CASTLE_FAIR: "STALL",
  DOVECOTE: "DOVE",
  TEMPLE: "TEMPLE",
};

/**
 * Os sinais que aparecem no meio do texto (o diário, as notícias, os rótulos) e o ícone de cada
 * um. Os emojis antigos dos bens e do tempo entram aqui também, para nenhum sair na fonte do
 * sistema.
 */
export const SYMBOL_ICON: Readonly<Record<string, IconId>> = {
  "⚑": "BANNER",
  "★": "STAR",
  "✓": "CHECK",
  "✗": "CROSS",
  "✕": "CLOSE",
  "☠": "SKULL",
  "♛": "CROWN",
  "👑": "CROWN",
  "⚔": "ARMS",
  "⚓": "ANCHOR",
  "✉": "LETTER",
  "↩": "RETURN",
  "✦": "SPARK",
  "⚠": "WARN",
  "🔒": "LOCK",
  "📖": "BOOK",
  "🔥": "FIRE",
  "⛺": "TENT",
  "🛒": "WAGON",
  "🎒": "PACK",
  "⚖": "SCALES",
  "☾": "MOON",
  "☀": "SUN",
  "◐": "DUSK",
  "⏸": "PAUSE",
  "☔": "RAIN",
  "🌫": "FOG",
  "❄": "SNOW",
  "⛈": "STORM",
  "🌾": "GRAIN",
  "🥩": "MEAT",
  "🧂": "SALT",
  "🪵": "WOOD",
  "⛓": "IRON",
  "🧵": "CLOTH",
  "🍺": "ALE",
  "🐎": "HORSES",
  "💎": "LUXURY",
};

/**
 * Corta o texto nos sinais de `SYMBOL_ICON`: os pedaços pares são texto, os ímpares são ícones.
 * O seletor de variação (U+FE0F) que às vezes vem colado no emoji sai junto.
 */
export function splitIcons(text: string): { text: string; icon?: IconId }[] {
  const out: { text: string; icon?: IconId }[] = [];
  let buf = "";
  const chars = [...text];
  for (let i = 0; i < chars.length; i++) {
    const icon = SYMBOL_ICON[chars[i]];
    if (!icon) {
      if (chars[i] !== "️") buf += chars[i];
      continue;
    }
    if (buf) out.push({ text: buf });
    buf = "";
    out.push({ text: chars[i], icon });
  }
  if (buf) out.push({ text: buf });
  return out;
}
