import { describe, expect, it } from "vitest";
import { PAVING, donjonPiece, fountainPiece, lampPiece, palacePiece, pavingTile, stoneHallPiece, tombPiece, type Paving } from "../../src/game/art/cityArt";
import type { Piece } from "../../src/game/art/buildings";
import { capitalJobs, GROUP } from "../../src/game/world/capitalArt";
import { CAPITAL_H, CAPITAL_W, capitalLayout } from "../../src/game/world/capitalLayout";

/** O pé (w × h a partir do canto) cabe na grade, e a peça tem algo desenhado. */
function fits(p: Piece, w: number, h: number, what: string): void {
  expect(-p.dx, what).toBeGreaterThanOrEqual(0);
  expect(-p.dy, what).toBeGreaterThanOrEqual(0);
  expect(-p.dx + w, what).toBeLessThanOrEqual(p.grid.w);
  expect(-p.dy + h, what).toBeLessThanOrEqual(p.grid.h);
  expect(p.grid.data.some((c) => c >= 0), what).toBe(true);
}

describe("a Cidade Alta em pixel art", () => {
  it("torre de menagem, paços de pedra e palácios cabem no pé e sobem acima dele", () => {
    for (const culture of ["REALMS", "SANDS", "ISLES", "JADE"] as const) {
      for (const [w, h] of [[1000, 760], [560, 520], [260, 220]]) {
        const p = donjonPiece(w, h, culture, w / 2, 3);
        fits(p, w, h, `torre ${culture} ${w}x${h}`);
        expect(-p.dy, culture).toBeGreaterThan(56);
      }
      for (const [w, h] of [[420, 340], [260, 220]]) fits(stoneHallPiece(w, h, culture, -1, w / 2, 5), w, h, `paço ${culture}`);
      for (const [w, h] of [[510, 340], [300, 240]]) fits(palacePiece(w, h, culture, 1, w / 2, 7), w, h, `palácio ${culture}`);
    }
  });

  it("chafariz, lampião e lápide saem desenhados", () => {
    fits(fountainPiece(46, 1), 92, 57, "chafariz");
    for (const [p, what] of [[lampPiece(), "lampião"], [tombPiece(2), "lápide"]] as const) {
      expect(p.grid.data.some((c) => c >= 0), what).toBe(true);
      expect(-p.dy, what).toBeGreaterThan(10);
    }
  });

  it("os calçamentos são ladrilhos inteiros, sem furo, que fecham na emenda", () => {
    for (const k of ["COBBLE", "AVENUE", "FLAG", "MARKET", "NOBLE", "BAILEY", "PLANKS"] as Paving[]) {
      const t = pavingTile(k);
      expect(t.width, k).toBe(PAVING);
      expect(t.height, k).toBe(PAVING);
      for (let i = 3; i < t.rgba.length; i += 4) expect(t.rgba[i], k).toBe(255);
    }
  });

  it("todo prédio da Cidade Alta vira peça (menos a Liça, que é chão), dentro do mapa e no grupo certo", () => {
    const l = capitalLayout("S0");
    const groups = capitalJobs(l, "REALMS", 0xc0a040, "SUMMER", 11);
    const jobs = [...groups.values()].flat();
    const feet = new Set(jobs.map((j) => `${j.x},${j.y}`));
    for (const b of l.buildings) {
      if (b.kind === "ARENA") continue;
      expect(feet.has(`${Math.round(b.rect.x)},${Math.round(b.rect.y)}`), `${b.kind} ${b.label ?? ""}`).toBe(true);
    }
    for (const [key, list] of groups) {
      for (const j of list) {
        expect(j.x).toBeGreaterThanOrEqual(-100); // as torres dos cantos saem metade para fora
        expect(j.x).toBeLessThanOrEqual(CAPITAL_W + 100);
        expect(j.depth).toBeLessThanOrEqual(CAPITAL_H + 100);
        expect(key).toBe(`${Math.floor(j.x / GROUP)},${Math.floor(j.depth / GROUP)}`);
      }
    }
    // As peças grandes e uma amostra das outras saem inteiras
    const special = jobs.filter((_, i) => i % 97 === 0);
    for (const b of l.buildings.filter((x) => x.kind === "KEEP" || x.kind === "TEMPLE" || x.kind === "PALACE").slice(0, 6)) {
      const j = jobs.find((x) => x.x === Math.round(b.rect.x) && x.y === Math.round(b.rect.y));
      if (j) special.push(j);
    }
    for (const j of special) expect(j.make().grid.data.some((c) => c >= 0)).toBe(true);
  });
});
