import Phaser from "phaser";
import { TERRAIN, type TerrainType } from "../../utils/constants";

/** Zona de terreno elíptica. Zonas posteriores na lista têm prioridade quando se sobrepõem. */
export interface TerrainZone {
  type: Exclude<TerrainType, "GRASS">;
  x: number;
  y: number;
  rx: number;
  ry: number;
}

const ZONE_COLORS: Record<TerrainZone["type"], { base: number; detail: number }> = {
  HILL: { base: 0x6f8f3a, detail: 0x86a64a },
  MUD: { base: 0x6b4f2e, detail: 0x57401f },
  SWAMP: { base: 0x3f5240, detail: 0x2b4a4a },
  FOREST: { base: 0x22501c, detail: 0x173d12 },
};

/** Terreno do campo de batalha: consulta de tipo por ponto e desenho greybox. */
export class TerrainMap {
  constructor(readonly zones: readonly TerrainZone[]) {}

  typeAt(x: number, y: number): TerrainType {
    for (let i = this.zones.length - 1; i >= 0; i--) {
      const z = this.zones[i];
      const dx = (x - z.x) / z.rx;
      const dy = (y - z.y) / z.ry;
      if (dx * dx + dy * dy <= 1) return z.type;
    }
    return "GRASS";
  }

  draw(scene: Phaser.Scene): void {
    const g = scene.add.graphics().setDepth(-9);
    const rnd = new Phaser.Math.RandomDataGenerator(["ascensao-terreno"]);

    for (const z of this.zones) {
      const c = ZONE_COLORS[z.type];
      g.fillStyle(c.base, 1);
      g.fillEllipse(z.x, z.y, z.rx * 2, z.ry * 2, 96);

      switch (z.type) {
        case "HILL":
          // Curvas de nível
          for (const k of [0.75, 0.5, 0.25]) {
            g.lineStyle(2, c.detail, 0.9);
            g.strokeEllipse(z.x, z.y, z.rx * 2 * k, z.ry * 2 * k, 96);
          }
          break;
        case "MUD":
          for (let i = 0; i < 14; i++) {
            const p = this.randomPointIn(z, rnd, 0.85);
            g.fillStyle(c.detail, 1);
            g.fillEllipse(p.x, p.y, rnd.between(20, 50), rnd.between(10, 24));
          }
          break;
        case "SWAMP":
          for (let i = 0; i < 10; i++) {
            const p = this.randomPointIn(z, rnd, 0.8);
            g.fillStyle(c.detail, 1);
            g.fillEllipse(p.x, p.y, rnd.between(40, 90), rnd.between(20, 40));
          }
          break;
        case "FOREST": {
          const trees = Math.round((z.rx * z.ry) / 1400);
          for (let i = 0; i < trees; i++) {
            const p = this.randomPointIn(z, rnd, 0.92);
            g.fillStyle(c.detail, 1);
            g.fillCircle(p.x, p.y, rnd.between(8, 15));
          }
          break;
        }
      }

      scene.add
        .text(z.x, z.y - z.ry + 14, TERRAIN[z.type].label.toUpperCase(), {
          fontFamily: "monospace",
          fontSize: "13px",
          color: "#ffffff",
        })
        .setOrigin(0.5)
        .setAlpha(0.35)
        .setDepth(-8);
    }
  }

  private randomPointIn(z: TerrainZone, rnd: Phaser.Math.RandomDataGenerator, scale: number) {
    const a = rnd.angle() * (Math.PI / 180);
    const r = Math.sqrt(rnd.frac()) * scale;
    return { x: z.x + Math.cos(a) * z.rx * r, y: z.y + Math.sin(a) * z.ry * r };
  }
}
