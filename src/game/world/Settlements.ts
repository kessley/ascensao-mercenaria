import Phaser from "phaser";
import { SETTLEMENT_KIND_LABEL, type WorldDef } from "../data/world";
import { isCalamityOwner, ownerLabel, type Calamity, type Settlement } from "../sim/realm";
import { CAMP_COLORS, drawTentShape, worldLabel, type Interactable } from "./CampArea";
import type { StaticCuller } from "./StaticCuller";
import { COLORS } from "../../utils/constants";
import type { Point } from "../../utils/math";
import { specialHouses, templeDoor, townLayout, type GarrisonCamp, type InnerCity, type TownLayout } from "./townLayout";

const WALL_COLOR = 0x8a8478;
const ROOF_COLORS = [0x8e4a2b, 0x7a3b22, 0x9c6b3c, 0x6b5a4a];

/** Cor da bandeira de quem manda no povoado. */
export function ownerColor(world: WorldDef, calamities: readonly Calamity[], owner: string): number {
  if (owner === "PLAYER") return COLORS.ALLY;
  if (owner === "FREE") return 0xf0e6d2;
  if (owner === "RUINED") return 0x2b2b2b;
  if (isCalamityOwner(owner)) return calamities.find((c) => c.id === owner)?.kind === "NECROMANCER" ? 0x5b2c6f : 0x2f4a16;
  return world.factions.find((f) => f.id === owner)?.color ?? 0xffffff;
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

/** Até onde se interage com a praça e com a porta do paço de um povoado. */
const MARKET_RADIUS = 190;
const HALL_RADIUS = 120;
const CAMP_RADIUS = 150;

/** Luz de um povoado à noite (praça, portões, janelas). */
export interface TownLight {
  x: number;
  y: number;
  radius: number;
}

interface DrawnTown {
  layout: TownLayout;
  /** Tipo + ruína: muda a planta (muros com brechas) e obriga a redesenhar a base. */
  layoutKey: string;
  base: Phaser.GameObjects.GameObject[];
  banner: Phaser.GameObjects.GameObject[];
  bannerKey: string;
  lights: TownLight[];
}

/**
 * Povoados no mapa (Marco 12): a planta inteira — lavouras, ruas, praça com barracas, casas,
 * paço ou castelo, templo, muralha com torres e portões. A base é redesenhada quando o
 * povoado cai em ruínas ou é reconstruído; as bandeiras e o nome, quando o dono muda.
 * Interações: a praça (mercado), a porta do paço (administração) e, do lado de fora, os
 * acampamentos da guarnição junto aos portões (de onde se ataca o povoado).
 */
export class SettlementLayer {
  private drawn = new Map<string, DrawnTown>();
  private spots = new Map<string, Interactable[]>();

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly world: WorldDef,
    private readonly culler: StaticCuller,
    /** Terra firme? (lavouras não são desenhadas sobre água) */
    private readonly isLand: (p: Point) => boolean,
  ) {}

  get interactables(): Interactable[] {
    return [...this.spots.values()].flat();
  }

  /** Plantas atuais (colisão, navegação, moradores). */
  get layouts(): TownLayout[] {
    return [...this.drawn.values()].map((d) => d.layout);
  }

  layoutOf(id: string): TownLayout | undefined {
    return this.drawn.get(id)?.layout;
  }

  /** Luzes de todos os povoados habitados (para a noite). */
  get lights(): TownLight[] {
    return [...this.drawn.values()].flatMap((d) => d.lights);
  }

  /**
   * Atualiza o desenho a partir do store. Devolve true se alguma planta mudou (povoado novo,
   * em ruínas ou reconstruído): a colisão e a navegação precisam ser refeitas.
   */
  sync(settlements: readonly Settlement[], calamities: readonly Calamity[]): boolean {
    let changed = false;
    for (const t of settlements) {
      const ruined = t.owner === "RUINED";
      const layoutKey = `${t.kind}|${ruined}`;
      let entry = this.drawn.get(t.id);
      if (!entry || entry.layoutKey !== layoutKey) {
        for (const o of entry?.base ?? []) o.destroy();
        for (const o of entry?.banner ?? []) o.destroy();
        const layout = townLayout(t.id, t.kind, t.x, t.y, ruined);
        entry = { layout, layoutKey, base: [], banner: [], bannerKey: "", lights: [] };
        entry.base = this.cull(layout, this.drawBase(layout, ruined));
        entry.lights = ruined ? [] : townLights(t.id, layout);
        this.drawn.set(t.id, entry);
        changed = true;
      }
      const bannerKey = `${t.owner}|${t.name}`;
      if (entry.bannerKey === bannerKey) continue;
      for (const o of entry.banner) o.destroy();
      entry.banner = this.cull(entry.layout, this.drawBanner(t, entry.layout, calamities));
      entry.bannerKey = bannerKey;
      this.spots.set(t.id, this.spotsFor(t, entry.layout));
    }
    return changed;
  }

  private spotsFor(t: Settlement, layout: TownLayout): Interactable[] {
    const panel = (at: "MARKET" | "HALL" | "CAMP" | "GATE") => ({ kind: "TOWN" as const, settlementId: t.id, at });
    if (t.owner === "RUINED") {
      return [{ label: `Ruínas de ${t.name}`, door: layout.market, panel: panel("MARKET"), bounds: rectAround(layout.market, 160), radius: MARKET_RADIUS }];
    }
    const hall = t.owner === "PLAYER" ? `Sala de Administração de ${t.name}` : t.kind === "VILLAGE" ? `Casa do Conselho de ${t.name}` : `Paço de ${t.name}`;
    // Marco 15: na capital, a "porta do paço" é o portão da muralha interna (a Cidade Alta é outro mapa)
    const hallSpot: Interactable = layout.inner
      ? { label: `Portão da Cidade Alta de ${t.name}`, door: layout.hall, panel: panel("HALL"), bounds: new Phaser.Geom.Rectangle(layout.keep.x, layout.keep.y, layout.keep.w, layout.keep.h), radius: HALL_RADIUS + 30, enter: `capital:${t.id}` }
      : { label: hall, door: layout.hall, panel: panel("HALL"), bounds: new Phaser.Geom.Rectangle(layout.keep.x, layout.keep.y, layout.keep.w, layout.keep.h), radius: HALL_RADIUS, enter: `town:${t.id}:hall` };
    // Marco 14: paço, taverna, Casa dos Mercadores e templo têm lado de dentro
    const special = specialHouses(layout);
    const houseSpot = (i: number | null, label: string, enter: string): Interactable[] => {
      if (i === null) return [];
      const h = layout.houses[i];
      return [{ label, door: h.door, panel: { kind: "TOWN", settlementId: t.id, at: "MARKET" }, bounds: new Phaser.Geom.Rectangle(h.rect.x, h.rect.y, h.rect.w, h.rect.h), radius: 70, enter }];
    };
    const temple = templeDoor(layout);
    return [
      { label: `Mercado de ${t.name}`, door: layout.market, panel: panel("MARKET"), bounds: rectAround(layout.market, 160), radius: MARKET_RADIUS },
      hallSpot,
      ...houseSpot(special.tavern, `Taverna de ${t.name}`, `town:${t.id}:tavern`),
      ...houseSpot(special.guild, `Casa dos Mercadores de ${t.name}`, `town:${t.id}:guild`),
      ...(temple && layout.temple
        ? [{ label: `Templo de ${t.name}`, door: temple, panel: panel("MARKET"), bounds: new Phaser.Geom.Rectangle(layout.temple.x, layout.temple.y, layout.temple.w, layout.temple.h), radius: 90, enter: `town:${t.id}:temple` }]
        : []),
      ...layout.camps.map((c) => ({
        label: `Guarnição de ${t.name}`,
        door: c.door,
        panel: panel("CAMP"),
        bounds: new Phaser.Geom.Rectangle(c.rect.x, c.rect.y, c.rect.w, c.rect.h),
        radius: CAMP_RADIUS,
        enter: `town:${t.id}:garrison`,
      })),
      // Do lado de fora de cada portão (onde o exército fica): é dali que se ataca
      ...layout.gates.map((g) => ({
        label: `Portão de ${t.name}`,
        door: g.outside,
        panel: panel("GATE"),
        bounds: rectAround(g.outside, 90),
        radius: CAMP_RADIUS,
      })),
    ];
  }

  /** Desenhos de um povoado entram no culling (o continente tem dezenas deles). */
  private cull(layout: TownLayout, objects: Phaser.GameObjects.GameObject[]): Phaser.GameObjects.GameObject[] {
    const b = layout.bounds;
    let x0 = b.x - 200;
    let y0 = b.y - 260;
    let x1 = b.x + b.w + 200;
    let y1 = b.y + b.h + 200;
    for (const f of [...layout.fields, ...layout.camps.map((c) => c.rect)]) {
      x0 = Math.min(x0, f.x - 60);
      y0 = Math.min(y0, f.y - 120);
      x1 = Math.max(x1, f.x + f.w + 60);
      y1 = Math.max(y1, f.y + f.h + 60);
    }
    const bounds = new Phaser.Geom.Rectangle(x0, y0, x1 - x0, y1 - y0);
    for (const o of objects) this.culler.add(o as Phaser.GameObjects.Graphics, bounds);
    return objects;
  }

  private drawBase(layout: TownLayout, ruined: boolean): Phaser.GameObjects.GameObject[] {
    const scene = this.scene;
    const rnd = new Phaser.Math.RandomDataGenerator([`casas-${layout.cx}-${layout.cy}`]);
    const b = layout.bounds;
    const t = layout.wallThickness;

    // Chão: lavouras lá fora, terra batida por dentro, ruas e praça
    const ground = scene.add.graphics().setDepth(-6.7);
    for (const f of layout.fields) {
      if (!this.isLand({ x: f.x + f.w / 2, y: f.y + f.h / 2 }) || !this.isLand({ x: f.x, y: f.y }) || !this.isLand({ x: f.x + f.w, y: f.y + f.h })) continue;
      ground.fillStyle(ruined ? 0x56552f : 0x8f7f3c, 0.9);
      ground.fillRect(f.x, f.y, f.w, f.h);
      ground.lineStyle(3, ruined ? 0x46452a : 0x6e6029, 0.8);
      const vertical = f.w < f.h;
      for (let k = 30; k < (vertical ? f.w : f.h); k += 34) {
        if (vertical) ground.lineBetween(f.x + k, f.y + 10, f.x + k, f.y + f.h - 10);
        else ground.lineBetween(f.x + 10, f.y + k, f.x + f.w - 10, f.y + k);
      }
      ground.lineStyle(2, 0x4d3b20, 0.7);
      ground.strokeRect(f.x, f.y, f.w, f.h);
    }
    ground.fillStyle(ruined ? 0x5d584a : 0x7d6f50, 1);
    ground.fillRect(b.x + t, b.y + t, b.w - t * 2, b.h - t * 2);
    ground.fillStyle(ruined ? 0x6a6454 : 0x998a63, 1);
    for (const s of layout.streets) ground.fillRect(s.x, s.y, s.w, s.h);
    const sq = layout.square;
    ground.fillStyle(ruined ? 0x6f6a5c : 0xa89f86, 1);
    ground.fillRect(sq.x, sq.y, sq.w, sq.h);
    ground.lineStyle(3, 0x6b6250, 1);
    ground.strokeRect(sq.x, sq.y, sq.w, sq.h);
    // Poço da praça
    const well = { x: sq.x + sq.w * 0.25, y: sq.y + sq.h * 0.3 };
    ground.fillStyle(CAMP_COLORS.STONE, 1);
    ground.fillCircle(well.x, well.y, 20);
    ground.fillStyle(0x2b4a6b, 1);
    ground.fillCircle(well.x, well.y, 11);

    // Construções
    const g = scene.add.graphics().setDepth(-6.4);
    if (!ruined) {
      for (const st of layout.stalls) {
        const c = rnd.pick([0xb84a3a, 0x3a6ab8, 0xc9a23a, 0x3a9a5a]);
        g.fillStyle(c, 1);
        g.fillRect(st.x, st.y, st.w, st.h);
        g.fillStyle(0xf0e6d2, 0.8);
        for (let k = 0; k < st.w; k += 16) g.fillRect(st.x + k, st.y, 8, st.h);
        g.lineStyle(2, COLORS.OUTLINE, 0.8);
        g.strokeRect(st.x, st.y, st.w, st.h);
      }
    }
    for (const hs of layout.houses) {
      const r = hs.rect;
      g.fillStyle(ROOF_COLORS[hs.roof % ROOF_COLORS.length], 1);
      g.fillRect(r.x, r.y, r.w, r.h);
      g.fillStyle(0x000000, 0.18);
      g.fillRect(r.x + r.w / 2, r.y, r.w / 2, r.h);
      g.lineStyle(2, COLORS.OUTLINE, 0.85);
      g.strokeRect(r.x, r.y, r.w, r.h);
      g.lineStyle(2, 0x000000, 0.35);
      if (r.w > r.h) g.lineBetween(r.x, r.y + r.h / 2, r.x + r.w, r.y + r.h / 2);
      else g.lineBetween(r.x + r.w / 2, r.y, r.x + r.w / 2, r.y + r.h);
      // Porta no lado da rua
      g.fillStyle(0x2a1c10, 1);
      g.fillRect(hs.door.x - 8, hs.door.y < r.y ? r.y - 2 : r.y + r.h - 4, 16, 6);
    }
    // Placas da taverna (caneca dourada) e da Casa dos Mercadores (balança azul), Marco 14
    if (!ruined) {
      const special = specialHouses(layout);
      const sign = (i: number | null, color: number) => {
        if (i === null) return;
        const hs = layout.houses[i];
        const above = hs.door.y < hs.rect.y;
        const sy = above ? hs.rect.y + 14 : hs.rect.y + hs.rect.h - 14;
        g.fillStyle(0x2a1c10, 1);
        g.fillRect(hs.door.x + 14, sy - 10, 26, 20);
        g.fillStyle(color, 1);
        g.fillRect(hs.door.x + 17, sy - 7, 20, 14);
        g.fillStyle(0x2a1c10, 1);
        g.fillCircle(hs.door.x + 27, sy, 4);
      };
      sign(special.tavern, 0xe0b040);
      sign(special.guild, 0x3a6ab8);
    }
    for (const r of layout.rubble) {
      g.fillStyle(0x3b3730, 0.9);
      g.fillRect(r.x + 6, r.y + 6, r.w - 12, r.h - 12);
      g.fillStyle(0x23201b, 0.9);
      for (let k = 0; k < 4; k++) g.fillRect(r.x + rnd.between(4, Math.max(5, r.w - 30)), r.y + rnd.between(4, Math.max(5, r.h - 24)), rnd.between(12, 26), rnd.between(8, 18));
    }
    // Capital: a Cidade Alta por trás da muralha interna (telhados, cúpula e torres ao fundo)
    const walls = scene.add.graphics().setDepth(-6);
    if (layout.inner) drawInnerCity(g, walls, layout.inner, rnd, ruined);
    // Paço/castelo: pedra com pátio e torrinhas
    const k = layout.keep;
    if (!layout.inner) {
    g.fillStyle(ruined ? 0x4e4b45 : 0x8d877c, 1);
    g.fillRect(k.x, k.y, k.w, k.h);
    g.lineStyle(4, COLORS.OUTLINE, 1);
    g.strokeRect(k.x, k.y, k.w, k.h);
    if (k.w > 260) {
      g.fillStyle(0x6e685e, 1);
      g.fillRect(k.x + k.w * 0.25, k.y + k.h * 0.25, k.w * 0.5, k.h * 0.5);
      for (const [px, py] of [[k.x, k.y], [k.x + k.w, k.y], [k.x, k.y + k.h], [k.x + k.w, k.y + k.h]]) {
        g.fillStyle(0x77716a, 1);
        g.fillCircle(px, py, 26);
        g.lineStyle(3, COLORS.OUTLINE, 1);
        g.strokeCircle(px, py, 26);
      }
    } else {
      g.fillStyle(0x5a3a22, 1);
      g.fillRect(k.x + 10, k.y + 10, k.w - 20, k.h - 20);
    }
    g.fillStyle(0x2a1c10, 1);
    g.fillRect(layout.hall.x - 16, k.y + k.h - 8, 32, 12);
    }
    if (layout.temple) {
      const tp = layout.temple;
      g.fillStyle(ruined ? 0x56534c : 0xd9d2bf, 1);
      g.fillRect(tp.x, tp.y, tp.w, tp.h);
      g.lineStyle(3, COLORS.OUTLINE, 1);
      g.strokeRect(tp.x, tp.y, tp.w, tp.h);
      g.fillStyle(0x8a7f62, 1);
      g.fillRect(tp.x + tp.w / 2 - 10, tp.y + 20, 20, tp.h - 40);
      g.fillRect(tp.x + 30, tp.y + tp.h * 0.35, tp.w - 60, 20);
    }
    for (const camp of layout.camps) drawGarrisonCamp(ground, g, camp);

    // Muralha, torres e portões
    const stone = layout.wallKind === "STONE";
    for (const w of layout.walls) {
      walls.fillStyle(stone ? WALL_COLOR : CAMP_COLORS.WOOD, 1);
      walls.fillRect(w.x, w.y, w.w, w.h);
      walls.lineStyle(2, COLORS.OUTLINE, 0.9);
      walls.strokeRect(w.x, w.y, w.w, w.h);
      if (stone) {
        // Ameias: dentes ao longo do adarve
        walls.fillStyle(0x6c675d, 1);
        const along = w.w > w.h;
        const len = along ? w.w : w.h;
        for (let d = 10; d < len - 10; d += 26) {
          if (along) walls.fillRect(w.x + d, w.y + 4, 12, Math.max(6, w.h * 0.3));
          else walls.fillRect(w.x + 4, w.y + d, Math.max(6, w.w * 0.3), 12);
        }
      } else {
        walls.fillStyle(CAMP_COLORS.POST, 1);
        const along = w.w > w.h;
        const len = along ? w.w : w.h;
        for (let d = 6; d < len; d += 18) {
          if (along) walls.fillCircle(w.x + d, w.y + w.h / 2, w.h / 2 + 1);
          else walls.fillCircle(w.x + w.w / 2, w.y + d, w.w / 2 + 1);
        }
      }
    }
    for (const tw of layout.towers) {
      walls.fillStyle(stone ? 0x77716a : 0x5c3f24, 1);
      walls.fillRect(tw.x, tw.y, tw.w, tw.h);
      walls.lineStyle(3, COLORS.OUTLINE, 1);
      walls.strokeRect(tw.x, tw.y, tw.w, tw.h);
      walls.fillStyle(stone ? 0x5f5a52 : 0x4a321c, 1);
      walls.fillRect(tw.x + tw.w * 0.25, tw.y + tw.h * 0.25, tw.w * 0.5, tw.h * 0.5);
    }
    if (!ruined) {
      // Portões abertos: as duas folhas encostadas nas laterais do vão
      for (const gt of layout.gates) {
        const horizontal = gt.side === "N" || gt.side === "S";
        walls.fillStyle(0x5a3d1e, 1);
        if (horizontal) {
          walls.fillRect(gt.x - gt.width / 2, gt.y - t / 2 - 6, 18, t + 12);
          walls.fillRect(gt.x + gt.width / 2 - 18, gt.y - t / 2 - 6, 18, t + 12);
        } else {
          walls.fillRect(gt.x - t / 2 - 6, gt.y - gt.width / 2, t + 12, 18);
          walls.fillRect(gt.x - t / 2 - 6, gt.y + gt.width / 2 - 18, t + 12, 18);
        }
      }
    }
    return [ground, g, walls];
  }

  /** Bandeiras do dono (no paço e nos portões), o nome e o dono. */
  private drawBanner(t: Settlement, layout: TownLayout, calamities: readonly Calamity[]): Phaser.GameObjects.GameObject[] {
    const scene = this.scene;
    const color = ownerColor(this.world, calamities, t.owner);
    const g = scene.add.graphics().setDepth(-5.5);
    const flag = (x: number, y: number, size: number) => {
      g.lineStyle(4, CAMP_COLORS.WOOD, 1);
      g.lineBetween(x, y - size * 2.2, x, y);
      g.fillStyle(color, 1);
      g.fillRect(x, y - size * 2.2, size * 1.6, size);
      g.lineStyle(2, COLORS.OUTLINE, 1);
      g.strokeRect(x, y - size * 2.2, size * 1.6, size);
    };
    if (t.owner !== "RUINED") {
      if (layout.inner) {
        const r = layout.inner.rect;
        for (const x of [r.x + r.w * 0.36, r.x + r.w * 0.64]) flag(x, r.y + r.h - 6, 30);
      } else flag(layout.keep.x + layout.keep.w - 20, layout.keep.y + 10, 28);
      for (const gt of layout.gates) flag(gt.x + gt.width / 2 + 30, gt.y, 18);
      for (const c of layout.camps) flag(c.flag.x, c.flag.y, 16);
    }
    const owner = ownerLabel(this.world, calamities, t.owner);
    const tone = t.owner === "PLAYER" ? "#9cc4ff" : t.owner === "RUINED" ? "#aaaaaa" : "#ffe9b0";
    const top = layout.bounds.y;
    const name = worldLabel(scene, layout.cx, top - 90, `${t.name.toUpperCase()}`, tone).setFontSize(22);
    const sub = worldLabel(scene, layout.cx, top - 62, `${SETTLEMENT_KIND_LABEL[t.kind]} · ${owner}`, "#d8d8d8").setFontSize(13);
    return [g, name, sub];
  }
}

const rectAround = (p: Point, r: number) => new Phaser.Geom.Rectangle(p.x - r, p.y - r, r * 2, r * 2);

/**
 * A Cidade Alta vista de fora: telhados apertados, a cúpula do templo maior e o castelo ao
 * fundo, por trás da muralha interna (quem quiser ver de perto tem de passar pelo portão).
 */
function drawInnerCity(g: Phaser.GameObjects.Graphics, walls: Phaser.GameObjects.Graphics, inner: InnerCity, rnd: Phaser.Math.RandomDataGenerator, ruined: boolean): void {
  const r = inner.rect;
  g.fillStyle(ruined ? 0x4e4b45 : 0x6d6452, 1);
  g.fillRect(r.x, r.y, r.w, r.h);
  for (let y = r.y + 70; y < r.y + r.h - 110; y += 62) {
    for (let x = r.x + 70; x < r.x + r.w - 110; x += 74) {
      if (y < r.y + 420 && Math.abs(x - (r.x + r.w / 2)) < 320) continue; // lugar do castelo
      g.fillStyle(ROOF_COLORS[rnd.between(0, 3)], ruined ? 0.5 : 1);
      g.fillRect(x, y, rnd.between(46, 64), rnd.between(34, 48));
    }
  }
  const c = { x: r.x + r.w / 2, y: r.y + 230 };
  g.fillStyle(ruined ? 0x56534c : 0x9a9488, 1);
  g.fillRect(c.x - 280, c.y - 150, 560, 300);
  g.lineStyle(4, COLORS.OUTLINE, 1);
  g.strokeRect(c.x - 280, c.y - 150, 560, 300);
  g.fillStyle(ruined ? 0x46433d : 0x7c766c, 1);
  g.fillRect(c.x - 130, c.y - 80, 260, 160);
  for (const [dx, dy] of [[-280, -150], [280, -150], [-280, 150], [280, 150]]) {
    g.fillStyle(0x77716a, 1);
    g.fillCircle(c.x + dx, c.y + dy, 44);
    g.lineStyle(3, COLORS.OUTLINE, 1);
    g.strokeCircle(c.x + dx, c.y + dy, 44);
  }
  // Muralha interna e torres
  for (const w of inner.walls) {
    walls.fillStyle(0x938c7e, 1);
    walls.fillRect(w.x, w.y, w.w, w.h);
    walls.lineStyle(2, COLORS.OUTLINE, 0.9);
    walls.strokeRect(w.x, w.y, w.w, w.h);
    walls.fillStyle(0x6c675d, 1);
    const along = w.w > w.h;
    const len = along ? w.w : w.h;
    for (let d = 10; d < len - 10; d += 26) {
      if (along) walls.fillRect(w.x + d, w.y + 4, 12, Math.max(6, w.h * 0.3));
      else walls.fillRect(w.x + 4, w.y + d, Math.max(6, w.w * 0.3), 12);
    }
  }
  for (const tw of inner.towers) {
    walls.fillStyle(0x7f786e, 1);
    walls.fillRect(tw.x, tw.y, tw.w, tw.h);
    walls.lineStyle(3, COLORS.OUTLINE, 1);
    walls.strokeRect(tw.x, tw.y, tw.w, tw.h);
    walls.fillStyle(0x5f5a52, 1);
    walls.fillRect(tw.x + tw.w * 0.25, tw.y + tw.h * 0.25, tw.w * 0.5, tw.h * 0.5);
  }
  // Portão: duas folhas de ferro fechadas (entra-se com E: a Cidade Alta é outro mapa)
  const gx = r.x + r.w / 2;
  const gy = r.y + r.h;
  walls.fillStyle(0x3a2412, 1);
  walls.fillRect(gx - inner.gateWidth / 2, gy - 62, inner.gateWidth, 62);
  walls.lineStyle(4, 0x8fa6b8, 1);
  for (let d = 18; d < inner.gateWidth; d += 28) walls.lineBetween(gx - inner.gateWidth / 2 + d, gy - 62, gx - inner.gateWidth / 2 + d, gy);
  walls.lineStyle(3, 0xe0b040, 1);
  walls.strokeRect(gx - inner.gateWidth / 2, gy - 62, inner.gateWidth, 62);
}

/**
 * Acampamento da guarnição (dentro dos muros): pátio de terra batida com cerca de estacas
 * (aberta para a rua do portão), barracas listradas com espeques e cordas, fogueira com
 * lenha empilhada, armeiro com lanças e escudos, bonecos de treino, barris e caixotes.
 */
function drawGarrisonCamp(ground: Phaser.GameObjects.Graphics, g: Phaser.GameObjects.Graphics, camp: GarrisonCamp): void {
  const r = camp.rect;
  const rnd = new Phaser.Math.RandomDataGenerator([`guarnicao-${Math.round(r.x)}-${Math.round(r.y)}`]);
  ground.fillStyle(0x86744a, 1);
  ground.fillRect(r.x, r.y, r.w, r.h);
  // Manchas de chão pisado e tufos de capim
  for (let k = 0; k < 10; k++) {
    ground.fillStyle(rnd.pick([0x7a6942, 0x917f55, 0x6f6040]), 0.8);
    ground.fillEllipse(r.x + rnd.between(20, r.w - 20), r.y + rnd.between(20, r.h - 20), rnd.between(30, 70), rnd.between(16, 36));
  }
  // Cerca de estacas, com a entrada voltada para a rua do portão (o lado da porta)
  const sides = [
    { a: { x: r.x, y: r.y }, b: { x: r.x + r.w, y: r.y } },
    { a: { x: r.x, y: r.y + r.h }, b: { x: r.x + r.w, y: r.y + r.h } },
    { a: { x: r.x, y: r.y }, b: { x: r.x, y: r.y + r.h } },
    { a: { x: r.x + r.w, y: r.y }, b: { x: r.x + r.w, y: r.y + r.h } },
  ];
  const doorSide = sides.reduce((best, sd) => {
    const d = (s: typeof sd) => Math.hypot((s.a.x + s.b.x) / 2 - camp.door.x, (s.a.y + s.b.y) / 2 - camp.door.y);
    return d(sd) < d(best) ? sd : best;
  }, sides[0]);
  for (const sd of sides) {
    const len = Math.hypot(sd.b.x - sd.a.x, sd.b.y - sd.a.y);
    ground.lineStyle(3, CAMP_COLORS.WOOD, 1);
    for (let d = 0; d <= len; d += 22) {
      const f = d / len;
      if (sd === doorSide && Math.abs(f - 0.5) < 0.22) continue;
      const x = sd.a.x + (sd.b.x - sd.a.x) * f;
      const y = sd.a.y + (sd.b.y - sd.a.y) * f;
      ground.fillStyle(CAMP_COLORS.POST, 1);
      ground.fillRect(x - 4, y - 4, 8, 8);
      // Travessa entre as estacas
      const nf = Math.min(1, (d + 22) / len);
      if (!(sd === doorSide && Math.abs(nf - 0.5) < 0.22) && d + 22 <= len) {
        ground.lineBetween(x, y, sd.a.x + (sd.b.x - sd.a.x) * nf, sd.a.y + (sd.b.y - sd.a.y) * nf);
      }
    }
  }
  // Barracas: lona listrada, cordas e espeques
  for (const t of camp.tents) {
    const cx = t.x + t.w / 2;
    const cy = t.y + t.h / 2;
    g.lineStyle(1.5, 0x4d3b20, 0.8);
    for (const [dx, dy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      g.lineBetween(cx + (dx * t.w) / 2, cy + (dy * t.h) / 2, cx + (dx * (t.w / 2 + 14)), cy + (dy * (t.h / 2 + 12)));
      g.fillStyle(CAMP_COLORS.POST, 1);
      g.fillRect(cx + dx * (t.w / 2 + 14) - 2, cy + dy * (t.h / 2 + 12) - 2, 4, 4);
    }
    drawTentShape(g, cx, cy, t.w, t.h, CAMP_COLORS.CANVAS);
    g.fillStyle(0x9a3b2b, 0.55);
    if (t.w > t.h) for (let k = 1; k < 4; k++) g.fillRect(t.x + (k * t.w) / 4 - 3, t.y + 2, 6, t.h - 4);
    else for (let k = 1; k < 4; k++) g.fillRect(t.x + 2, t.y + (k * t.h) / 4 - 3, t.w - 4, 6);
  }
  // Fogueira: anel de pedras, brasas e lenha empilhada ao lado
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2;
    g.fillStyle(CAMP_COLORS.STONE, 1);
    g.fillCircle(camp.fire.x + Math.cos(a) * 15, camp.fire.y + Math.sin(a) * 15, 5);
  }
  g.fillStyle(0x3a2412, 1);
  g.fillCircle(camp.fire.x, camp.fire.y, 10);
  g.fillStyle(0xe67e22, 0.95);
  g.fillCircle(camp.fire.x, camp.fire.y, 6);
  g.fillStyle(0xf9d56e, 1);
  g.fillCircle(camp.fire.x, camp.fire.y, 3);
  g.fillStyle(CAMP_COLORS.WOOD, 1);
  for (let k = 0; k < 3; k++) g.fillRect(camp.fire.x + 26, camp.fire.y - 10 + k * 7, 26, 5);
  // Armeiro: cavalete com lanças em pé e dois escudos encostados
  const k = camp.rack;
  g.fillStyle(CAMP_COLORS.WOOD, 1);
  g.fillRect(k.x, k.y, k.w, k.h);
  g.lineStyle(2, 0xd8d8d8, 1);
  const vertical = k.h > k.w;
  for (let d = 6; d < (vertical ? k.h : k.w); d += 9) {
    if (vertical) g.lineBetween(k.x - 8, k.y + d, k.x + k.w + 8, k.y + d);
    else g.lineBetween(k.x + d, k.y - 8, k.x + d, k.y + k.h + 8);
  }
  for (const [sx, sy] of [[k.x - 10, k.y + k.h / 2], [k.x + k.w + 10, k.y + k.h / 2]]) {
    g.fillStyle(0x8a2f2f, 1);
    g.fillCircle(sx, sy, 8);
    g.fillStyle(0xc9a23a, 1);
    g.fillCircle(sx, sy, 3);
  }
  // Bonecos de treino: poste, travessa e cabeça de palha
  for (const d of camp.dummies) {
    g.lineStyle(4, CAMP_COLORS.WOOD, 1);
    g.lineBetween(d.x - 12, d.y, d.x + 12, d.y);
    g.lineBetween(d.x, d.y - 12, d.x, d.y + 12);
    g.fillStyle(0xd8c39a, 1);
    g.fillCircle(d.x, d.y - 12, 6);
  }
  // Barris e caixotes perto da fogueira (o lado oposto à lenha)
  const corner = { x: camp.fire.x - 52, y: camp.fire.y - 10 };
  g.fillStyle(0x6b4a2b, 1);
  g.fillCircle(corner.x, corner.y, 9);
  g.fillCircle(corner.x + 18, corner.y + 4, 9);
  g.lineStyle(1.5, COLORS.OUTLINE, 0.8);
  g.strokeCircle(corner.x, corner.y, 9);
  g.strokeCircle(corner.x + 18, corner.y + 4, 9);
  g.fillStyle(0xb08850, 1);
  g.fillRect(corner.x - 6, corner.y + 16, 18, 16);
  g.strokeRect(corner.x - 6, corner.y + 16, 18, 16);
}

/** Luzes de um povoado: a praça, os portões e algumas janelas (sempre as mesmas). */
function townLights(id: string, layout: TownLayout): TownLight[] {
  const rnd = new Phaser.Math.RandomDataGenerator([`janelas-${id}`]);
  const lights: TownLight[] = [{ x: layout.cx, y: layout.cy, radius: 460 }];
  for (const g of layout.gates) lights.push({ x: g.outside.x, y: g.outside.y, radius: 230 }, { x: g.inside.x, y: g.inside.y, radius: 200 });
  for (const hs of layout.houses) if (rnd.frac() < 0.35) lights.push({ x: hs.door.x, y: hs.door.y, radius: 150 });
  lights.push({ x: layout.hall.x, y: layout.hall.y, radius: 220 });
  for (const c of layout.camps) lights.push({ x: c.fire.x, y: c.fire.y, radius: 240 });
  return lights;
}
