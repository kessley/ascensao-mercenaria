import { describe, expect, it } from "vitest";
import { ICON_ART } from "../../src/game/art/iconArt";
import {
  BUILDING_ICON,
  FORMATION_ICON,
  GOOD_ICON,
  ICON_ART_SIZE,
  ICON_IDS,
  ICON_PALETTE,
  ICON_SIZE,
  NEED_ICON,
  SYMBOL_ICON,
  TROOP_ICON,
  WEATHER_ICON,
  iconBitmap,
  splitIcons,
} from "../../src/game/art/icons";
import { OUTLINE } from "../../src/game/art/pixel";
import { BUILD_ORDER, CAMP_NEEDS } from "../../src/game/data/campGrid";
import { GOODS, TROOPS } from "../../src/utils/constants";

const at = (id: Parameters<typeof iconBitmap>[0], x: number, y: number) => {
  const bm = iconBitmap(id);
  const i = (y * bm.width + x) * 4;
  return { a: bm.rgba[i + 3], c: (bm.rgba[i] << 16) | (bm.rgba[i + 1] << 8) | bm.rgba[i + 2] };
};

describe("os ícones da interface", () => {
  it("cada desenho tem 10×10 e só usa as cores da paleta", () => {
    for (const [id, rows] of Object.entries(ICON_ART)) {
      expect(rows.length, id).toBe(ICON_ART_SIZE);
      for (const row of rows) {
        expect(row.length, `${id}: "${row}"`).toBe(ICON_ART_SIZE);
        for (const c of row) expect(c === "." || ICON_PALETTE[c] !== undefined, `${id}: "${c}"`).toBe(true);
      }
      expect(rows.some((r) => /[^.]/.test(r)), id).toBe(true);
    }
  });

  it("o ícone pronto tem 12×12, com o contorno escuro em volta do desenho", () => {
    for (const id of ICON_IDS) {
      const bm = iconBitmap(id);
      expect(bm.width).toBe(ICON_SIZE);
      expect(bm.height).toBe(ICON_SIZE);
    }
    // A estrela começa na coluna 5 da linha 1 do desenho: em cima dela, o contorno
    expect(at("STAR", 5, 0)).toEqual({ a: 255, c: OUTLINE });
    expect(at("STAR", 5, 1).c).toBe(ICON_PALETTE.g);
    // Longe do desenho, vazio
    expect(at("STAR", 0, 0).a).toBe(0);
  });

  it("toda tropa, bem, formação, tempo, necessidade e construção tem ícone", () => {
    const ids = new Set(ICON_IDS);
    for (const t of Object.keys(TROOPS) as (keyof typeof TROOPS)[]) expect(ids.has(TROOP_ICON[t]), t).toBe(true);
    for (const g of Object.keys(GOODS) as (keyof typeof GOODS)[]) expect(ids.has(GOOD_ICON[g]), g).toBe(true);
    for (const f of ["LINE", "SHIELD_WALL", "WEDGE", "LOOSE"] as const) expect(ids.has(FORMATION_ICON[f])).toBe(true);
    for (const w of ["CLEAR", "RAIN", "FOG", "SNOW", "STORM"] as const) expect(ids.has(WEATHER_ICON[w])).toBe(true);
    for (const n of CAMP_NEEDS) expect(ids.has(NEED_ICON[n]), n).toBe(true);
    for (const k of [...BUILD_ORDER, "COMMAND_TENT", "CAMPFIRE"] as const) expect(ids.has(BUILDING_ICON[k]), k).toBe(true);
    for (const [ch, id] of Object.entries(SYMBOL_ICON)) expect(ids.has(id), ch).toBe(true);
  });

  it("os derivados: a retirada é o avanço de cabeça para baixo, o cavaleiro é o cavalo de ferro", () => {
    for (let y = 0; y < ICON_SIZE; y++)
      for (let x = 0; x < ICON_SIZE; x++) expect(at("RETREAT", x, y).a).toBe(at("ADVANCE", x, ICON_SIZE - 1 - y).a);
    expect(at("KNIGHT", 6, 9).c).toBe(ICON_PALETTE.S);
    expect(at("HORSES", 6, 9).c).toBe(ICON_PALETTE.b);
  });

  it("corta o texto nos sinais, e o seletor de variação do emoji some", () => {
    expect(splitIcons("⚑ O capitão caiu!")).toEqual([{ text: "⚑", icon: "BANNER" }, { text: " O capitão caiu!" }]);
    expect(splitIcons("Carga 🌾\uFE0F3")).toEqual([{ text: "Carga " }, { text: "🌾", icon: "GRAIN" }, { text: "3" }]);
    expect(splitIcons("sem sinal")).toEqual([{ text: "sem sinal" }]);
  });
});
