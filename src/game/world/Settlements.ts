import Phaser from "phaser";
import { SETTLEMENT_KIND_LABEL, type SettlementKind, type WorldDef } from "../data/world";
import { isCalamityOwner, ownerLabel, type Calamity, type Settlement } from "../sim/realm";
import { CAMP_COLORS, drawTentShape, worldLabel, type Interactable } from "./CampArea";
import type { StaticCuller } from "./StaticCuller";
import { COLORS } from "../../utils/constants";

const ROAD_COLOR = 0x8d7b52;
const WALL_COLOR = 0x8a8478;
const ROOF_COLORS = [0x8e4a2b, 0x7a3b22, 0x9c6b3c, 0x6b5a4a];

/** Até onde se interage com a praça de um povoado. */
const TOWN_INTERACT_RADIUS = 140;
const TOWN_SIZE: Record<SettlementKind, { w: number; h: number; houses: number }> = {
  VILLAGE: { w: 520, h: 380, houses: 9 },
  CITY: { w: 760, h: 520, houses: 18 },
  FORT: { w: 600, h: 460, houses: 11 },
};

/** Cor da bandeira de quem manda no povoado. */
export function ownerColor(world: WorldDef, calamities: readonly Calamity[], owner: string): number {
  if (owner === "PLAYER") return COLORS.ALLY;
  if (owner === "FREE") return 0xf0e6d2;
  if (owner === "RUINED") return 0x2b2b2b;
  if (isCalamityOwner(owner)) return calamities.find((c) => c.id === owner)?.kind === "NECROMANCER" ? 0x5b2c6f : 0x2f4a16;
  return world.factions.find((f) => f.id === owner)?.color ?? 0xffffff;
}

/** Estradas de terra entre o acampamento, os povoados e os locais de contrato (só visuais). */
export function drawRoads(scene: Phaser.Scene, world: WorldDef, culler: StaticCuller): void {
  for (const road of world.roads) {
    const g = scene.add.graphics().setDepth(-8.8);
    g.lineStyle(34, ROAD_COLOR, 0.55);
    for (let i = 1; i < road.length; i++) g.lineBetween(road[i - 1].x, road[i - 1].y, road[i].x, road[i].y);
    g.fillStyle(ROAD_COLOR, 0.55);
    for (const p of road.slice(1, -1)) g.fillCircle(p.x, p.y, 17);
    const xs = road.map((p) => p.x);
    const ys = road.map((p) => p.y);
    const minX = Math.min(...xs) - 20;
    const minY = Math.min(...ys) - 20;
    culler.add(g, new Phaser.Geom.Rectangle(minX, minY, Math.max(...xs) - minX + 40, Math.max(...ys) - minY + 40));
  }
}

/** Marcas dos locais de contrato com o nome. */
export function drawSites(scene: Phaser.Scene, world: WorldDef, culler: StaticCuller): void {
  for (const site of world.sites) {
    const g = scene.add.graphics({ x: site.center.x, y: site.center.y }).setDepth(-7);
    g.lineStyle(3, 0x5a3d1e, 0.6);
    g.strokeCircle(0, 0, 90);
    g.fillStyle(0x5a3d1e, 0.25);
    g.fillCircle(0, 0, 90);
    const label = worldLabel(scene, site.center.x, site.center.y - 110, site.name.toUpperCase(), "#e8c8a0").setAlpha(0.8);
    const bounds = new Phaser.Geom.Rectangle(site.center.x - 300, site.center.y - 140, 600, 240);
    culler.add(g, bounds);
    culler.add(label, bounds);
  }
}

/** Covil de uma calamidade: torre negra do necromante ou acampamento de guerra orc. */
export function drawCalamityLair(scene: Phaser.Scene, c: Calamity): Phaser.GameObjects.GameObject[] {
  const g = scene.add.graphics({ x: c.lair.x, y: c.lair.y }).setDepth(-6);
  if (c.kind === "NECROMANCER") {
    g.fillStyle(0x1b1424, 0.85);
    g.fillCircle(0, 0, 260);
    g.fillStyle(0x3d2a4f, 1);
    g.fillCircle(0, 0, 70);
    g.lineStyle(4, 0x9b59b6, 0.9);
    g.strokeCircle(0, 0, 70);
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      g.fillStyle(0xd8d2c0, 0.8);
      g.fillRect(Math.cos(a) * 170 - 6, Math.sin(a) * 170 - 10, 12, 20); // lápides
    }
  } else {
    g.fillStyle(0x4a3a22, 0.85);
    g.fillCircle(0, 0, 240);
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2;
      g.lineStyle(5, 0x2b1d0e, 1);
      g.lineBetween(Math.cos(a) * 220, Math.sin(a) * 220, Math.cos(a) * 250, Math.sin(a) * 250); // estacas
    }
    for (const [x, y] of [[-70, -40], [60, -60], [0, 60]]) drawTentShape(g, x, y, 60, 44, 0x6b2b1b);
  }
  const label = worldLabel(scene, c.lair.x, c.lair.y - 290, c.leader.toUpperCase(), "#ff9a8a");
  return [g, label];
}

/**
 * Povoados no mapa: a construção é desenhada uma vez; a bandeira, o nome e as marcas de
 * ruína são redesenhados quando o dono muda (conquista, saque, calamidade).
 */
export class SettlementLayer {
  private drawn = new Map<string, { base: Phaser.GameObjects.GameObject[]; banner: Phaser.GameObjects.GameObject[]; key: string }>();
  private spots = new Map<string, Interactable>();

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly world: WorldDef,
    private readonly culler: StaticCuller,
  ) {}

  /** Desenhos de um povoado entram no culling (o continente tem dezenas deles). */
  private cull(t: Settlement, objects: Phaser.GameObjects.GameObject[]): Phaser.GameObjects.GameObject[] {
    const { w, h } = TOWN_SIZE[t.kind];
    const bounds = new Phaser.Geom.Rectangle(t.x - w / 2 - 60, t.y - h / 2 - 120, w + 120, h + 180);
    for (const o of objects) this.culler.add(o as Phaser.GameObjects.Graphics, bounds);
    return objects;
  }

  get interactables(): Interactable[] {
    return [...this.spots.values()];
  }

  sync(settlements: readonly Settlement[], calamities: readonly Calamity[]): void {
    for (const t of settlements) {
      const key = `${t.owner}|${t.name}`;
      let entry = this.drawn.get(t.id);
      if (!entry) {
        entry = { base: this.cull(t, this.drawBase(t)), banner: [], key: "" };
        this.drawn.set(t.id, entry);
        this.spots.set(t.id, {
          label: "",
          door: { x: t.x, y: t.y + 110 },
          panel: { kind: "TOWN", settlementId: t.id },
          bounds: new Phaser.Geom.Rectangle(t.x - 100, t.y - 100, 200, 200),
          radius: TOWN_INTERACT_RADIUS,
        });
      }
      if (entry.key === key) continue;
      for (const o of entry.banner) o.destroy();
      entry.banner = this.cull(t, this.drawBanner(t, calamities));
      entry.key = key;
      const spot = this.spots.get(t.id);
      if (spot) spot.label = t.owner === "PLAYER" ? `Sala de Administração de ${t.name}` : t.owner === "RUINED" ? `Ruínas de ${t.name}` : `Mercado de ${t.name}`;
    }
  }

  private drawBase(t: Settlement): Phaser.GameObjects.GameObject[] {
    const scene = this.scene;
    const { w, h, houses } = TOWN_SIZE[t.kind];
    const { x, y } = t;
    const rnd = new Phaser.Math.RandomDataGenerator([t.id + t.name]);
    const g = scene.add.graphics().setDepth(-6.5);

    g.fillStyle(0x6f6a55, 1);
    g.fillRect(x - w / 2, y - h / 2, w, h);
    for (let i = 0, tries = 0; i < houses && tries < 200; tries++) {
      const hw = rnd.between(50, 90);
      const hh = rnd.between(40, 70);
      const hx = rnd.between(x - w / 2 + 30, x + w / 2 - 30 - hw);
      const hy = rnd.between(y - h / 2 + 30, y + h / 2 - 30 - hh);
      if (Math.abs(hx + hw / 2 - x) < 150 && Math.abs(hy + hh / 2 - y) < 110) continue;
      g.fillStyle(ROOF_COLORS[i % ROOF_COLORS.length], 1);
      g.fillRect(hx, hy, hw, hh);
      g.lineStyle(2, COLORS.OUTLINE, 0.8);
      g.strokeRect(hx, hy, hw, hh);
      g.lineStyle(2, 0x000000, 0.35);
      g.lineBetween(hx, hy + hh / 2, hx + hw, hy + hh / 2);
      i++;
    }
    // Praça: poço e barracas de mercado
    g.fillStyle(0x9a8f70, 1);
    g.fillCircle(x, y, 95);
    g.fillStyle(CAMP_COLORS.STONE, 1);
    g.fillCircle(x, y, 16);
    g.fillStyle(0x2b4a6b, 1);
    g.fillCircle(x, y, 9);
    drawTentShape(g, x - 55, y + 45, 46, 30, 0xb84a3a);
    drawTentShape(g, x + 55, y + 45, 46, 30, 0x3a6ab8);

    // Muralha (paliçada de madeira nas aldeias) com portões ao norte e ao sul
    const walls = scene.add.graphics().setDepth(-6);
    walls.lineStyle(t.kind === "VILLAGE" ? 6 : 12, t.kind === "VILLAGE" ? CAMP_COLORS.WOOD : WALL_COLOR, 1);
    const gate = 70;
    walls.lineBetween(x - w / 2, y - h / 2, x - gate / 2, y - h / 2);
    walls.lineBetween(x + gate / 2, y - h / 2, x + w / 2, y - h / 2);
    walls.lineBetween(x - w / 2, y + h / 2, x - gate / 2, y + h / 2);
    walls.lineBetween(x + gate / 2, y + h / 2, x + w / 2, y + h / 2);
    walls.lineBetween(x - w / 2, y - h / 2, x - w / 2, y + h / 2);
    walls.lineBetween(x + w / 2, y - h / 2, x + w / 2, y + h / 2);
    if (t.kind === "FORT") {
      walls.fillStyle(WALL_COLOR, 1);
      for (const [cx, cy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) walls.fillCircle(x + (cx * w) / 2, y + (cy * h) / 2, 24);
    }
    return [g, walls];
  }

  /** Bandeira do dono, nome e (se for o caso) as marcas de ruína ou de ocupação. */
  private drawBanner(t: Settlement, calamities: readonly Calamity[]): Phaser.GameObjects.GameObject[] {
    const scene = this.scene;
    const { w, h } = TOWN_SIZE[t.kind];
    const color = ownerColor(this.world, calamities, t.owner);
    const g = scene.add.graphics().setDepth(-5.5);
    const px = t.x + w / 2 - 30;
    const py = t.y - h / 2 - 10;
    g.lineStyle(4, CAMP_COLORS.WOOD, 1);
    g.lineBetween(px, py - 70, px, py + 20);
    g.fillStyle(color, 1);
    g.fillRect(px, py - 70, 48, 30);
    g.lineStyle(2, COLORS.OUTLINE, 1);
    g.strokeRect(px, py - 70, 48, 30);
    if (t.owner === "RUINED" || isCalamityOwner(t.owner)) {
      // Fumaça e escombros por cima do povoado
      const rnd = new Phaser.Math.RandomDataGenerator([t.id, "ruina"]);
      for (let i = 0; i < 14; i++) {
        g.fillStyle(0x111111, rnd.realInRange(0.35, 0.6));
        g.fillCircle(t.x + rnd.between(-w / 2 + 20, w / 2 - 20), t.y + rnd.between(-h / 2 + 20, h / 2 - 20), rnd.between(20, 50));
      }
    }
    const owner = ownerLabel(this.world, calamities, t.owner);
    const tone = t.owner === "PLAYER" ? "#9cc4ff" : t.owner === "RUINED" ? "#aaaaaa" : "#ffe9b0";
    const name = worldLabel(scene, t.x, t.y - h / 2 - 46, `${t.name.toUpperCase()}`, tone).setFontSize(16);
    const sub = worldLabel(scene, t.x, t.y - h / 2 - 26, `${SETTLEMENT_KIND_LABEL[t.kind]} · ${owner}`, "#d8d8d8").setFontSize(11);
    return [g, name, sub];
  }
}
