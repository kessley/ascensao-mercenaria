import Phaser from "phaser";
import { SETTLEMENT_KIND_LABEL, type SiteDef, type WorldDef } from "../data/world";
import { isCalamityOwner, ownerLabel, type Calamity, type Settlement } from "../sim/realm";
import { worldLabel, type Interactable } from "./CampArea";
import type { StaticCuller } from "./StaticCuller";
import { COLORS } from "../../utils/constants";
import type { Point } from "../../utils/math";
import { specialHouses, templeDoor, townLayout, type Rect, type TownLayout } from "./townLayout";
import { TownArt, type ArtJob } from "./TownArt";
import { bannerPiece, STYLES, WALL_FACE, type Culture } from "../art/buildings";
import { lairDecor, siteDecor, type GroundAt } from "./wildLayout";

/** Cor da bandeira de quem manda no povoado. */
export function ownerColor(world: WorldDef, calamities: readonly Calamity[], owner: string): number {
  if (owner === "PLAYER") return COLORS.ALLY;
  if (owner === "FREE") return 0xf0e6d2;
  if (owner === "RUINED") return 0x2b2b2b;
  if (isCalamityOwner(owner)) return calamities.find((c) => c.id === owner)?.kind === "NECROMANCER" ? 0x5b2c6f : 0x2f4a16;
  return world.factions.find((f) => f.id === owner)?.color ?? 0xffffff;
}

/**
 * A cidade da sede (Marco 22, parte 4): a planta vem de fora (cresce com a gente e cerca a
 * fortaleza do bando). Antes da vila ela é só desenho; depois, é a planta do povoado do reino.
 */
export interface SeatTown {
  layout: TownLayout;
  /** Muda quando a planta muda (etapa, casas de pé, muralha). */
  key: string;
  settlementId: string | null;
}
const SEAT_ID = "sede";

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
 * paço ou castelo, templo, muralha com torres e portões. O chão é pintado com o resto do chão
 * (TerrainMap) e as construções são sprites em pixel art (TownArt, G3), refeitos quando o
 * povoado cai em ruínas ou é reconstruído; as bandeiras e o nome, quando o dono muda.
 * Interações: a praça (mercado), a porta do paço (administração) e, do lado de fora, os
 * acampamentos da guarnição junto aos portões (de onde se ataca o povoado).
 */
export class SettlementLayer {
  private drawn = new Map<string, DrawnTown>();
  private spots = new Map<string, Interactable[]>();
  /** Sólidos dos locais de contrato e dos covis, por lugar. */
  private wild = new Map<string, Rect[]>();
  private readonly art: TownArt;
  private readonly culture: Culture;
  private seat: SeatTown | null = null;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly world: WorldDef,
    private readonly culler: StaticCuller,
  ) {
    this.art = new TownArt(scene);
    this.culture = world.culture ?? "REALMS";
  }

  /** Monta e mostra as construções perto da câmera (a cada quadro). */
  updateArt(camera: Phaser.Cameras.Scene2D.Camera): void {
    this.art.update(camera);
  }

  /**
   * Locais de contrato (G3): barracas de bandidos, choupanas goblins, ruínas ou o vau, conforme o
   * tipo, e o nome por cima. As peças grandes entram em `wildSolids`.
   */
  addSites(sites: readonly SiteDef[], ground: GroundAt): void {
    for (const site of sites) {
      const decor = siteDecor(site, this.culture, ground);
      this.art.setJobs(`local:${site.id}`, decor.jobs);
      this.wild.set(`local:${site.id}`, decor.solids);
      const c = site.center;
      const label = worldLabel(this.scene, c.x, c.y - 300, site.name.toUpperCase(), "#e8c8a0").setAlpha(0.8);
      this.culler.add(label, new Phaser.Geom.Rectangle(c.x - 360, c.y - 400, 720, 760));
    }
  }

  /** Covil de uma calamidade: torre negra do necromante ou acampamento de guerra orc, e o nome do líder. */
  addLair(c: Calamity, ground: GroundAt): Phaser.GameObjects.GameObject[] {
    const decor = lairDecor(c, this.culture, ground);
    this.art.setJobs(`covil:${c.id}`, decor.jobs);
    this.wild.set(`covil:${c.id}`, decor.solids);
    return [worldLabel(this.scene, c.lair.x, c.lair.y - 420, c.leader.toUpperCase(), "#ff9a8a")];
  }

  /** O líder caiu: o covil some (as peças e os sólidos). */
  removeLair(id: string): void {
    this.art.remove(`covil:${id}`);
    this.wild.delete(`covil:${id}`);
  }

  /** Construções sólidas dos ermos (colisão). */
  get wildSolids(): Rect[] {
    return [...this.wild.values()].flat();
  }

  /** Quantas construções estão de pé agora (para testes). */
  get artPieces(): number {
    return this.art.pieceCount;
  }

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

  /** A cidade da sede mudou (vale no próximo `sync`). */
  setSeat(seat: SeatTown | null): void {
    this.seat = seat;
  }

  /**
   * Atualiza o desenho a partir do store. Devolve true se alguma planta mudou (povoado novo,
   * em ruínas ou reconstruído): a colisão e a navegação precisam ser refeitas.
   */
  sync(settlements: readonly Settlement[], calamities: readonly Calamity[]): boolean {
    let changed = false;
    // A cidade da sede antes da vila: só o desenho, sem povoado (nem praça, nem paço, nem portões)
    const free = this.seat && !this.seat.settlementId ? this.seat : null;
    const old = this.drawn.get(SEAT_ID);
    if (old && old.layoutKey !== free?.key) {
      this.art.remove(SEAT_ID);
      this.drawn.delete(SEAT_ID);
      changed = true;
    }
    if (free && !this.drawn.has(SEAT_ID)) {
      this.art.set(SEAT_ID, free.layout, this.culture, false);
      this.drawn.set(SEAT_ID, { layout: free.layout, layoutKey: free.key, base: [], banner: [], bannerKey: "", lights: townLights(SEAT_ID, free.layout) });
      changed = true;
    }
    for (const t of settlements) {
      const ruined = t.owner === "RUINED";
      const seat = this.seat && this.seat.settlementId === t.id ? this.seat : null;
      const layoutKey = seat ? `sede|${seat.key}` : `${t.kind}|${ruined}`;
      let entry = this.drawn.get(t.id);
      if (!entry || entry.layoutKey !== layoutKey) {
        for (const o of entry?.base ?? []) o.destroy();
        for (const o of entry?.banner ?? []) o.destroy();
        const layout = seat ? seat.layout : townLayout(t.id, t.kind, t.x, t.y, ruined);
        entry = { layout, layoutKey, base: [], banner: [], bannerKey: "", lights: [] };
        this.art.set(t.id, layout, this.culture, ruined);
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

  /** Bandeiras do dono (no paço e nos portões, em pixel art), o nome e o dono. */
  private drawBanner(t: Settlement, layout: TownLayout, calamities: readonly Calamity[]): Phaser.GameObjects.GameObject[] {
    const scene = this.scene;
    const color = ownerColor(this.world, calamities, t.owner);
    const flags: ArtJob[] = [];
    // Cada bandeira no alto da construção dela, com a profundidade do pé (passa na frente da construção)
    const flag = (x: number, y: number, size: number, foot: number) => {
      flags.push({ make: () => bannerPiece(color, false, Math.round(size * 2.2), Math.round(size * 1.2)), x: Math.round(x), y: Math.round(y), depth: foot + 0.1 });
    };
    if (t.owner !== "RUINED") {
      const k = layout.keep;
      if (layout.inner) {
        const r = layout.inner.rect;
        const it = layout.inner.walls[0].h;
        for (const x of [r.x + r.w * 0.36, r.x + r.w * 0.64]) flag(x, r.y + r.h - it / 2 - WALL_FACE, 30, r.y + r.h);
      } else if (layout.kind === "VILLAGE" || layout.seat) flag(k.x + k.w / 2 + 12, k.y + k.h * 0.34 - STYLES[this.culture].facade - 6, 20, k.y + k.h);
      else flag(k.x + k.w / 2, k.y + k.h * 0.3 - 80, 28, k.y + k.h);
      const stone = layout.wallKind === "STONE";
      for (const gt of layout.gates) {
        const tower = layout.towers.find((tw) => Math.abs(tw.x + tw.w / 2 - (gt.x + gt.width / 2 + tw.w / 2)) < 2 && Math.abs(tw.y + tw.h / 2 - gt.y) < 2);
        const foot = tower ? tower.y + tower.h : gt.y;
        const x = tower ? tower.x + tower.w / 2 : gt.x + gt.width / 2 + 30;
        const y = tower ? tower.y + tower.h / 2 - (stone ? 66 : 50) : gt.y;
        flag(x, y, 18, foot);
      }
      for (const c of layout.camps) flag(c.flag.x, c.flag.y, 16, c.flag.y);
    }
    // As bandeiras são uma "construção" à parte: trocar de dono não refaz o povoado
    if (flags.length) this.art.setJobs(`${t.id}:bandeiras`, flags);
    else this.art.remove(`${t.id}:bandeiras`);
    const owner = ownerLabel(this.world, calamities, t.owner);
    const tone = t.owner === "PLAYER" ? "#9cc4ff" : t.owner === "RUINED" ? "#aaaaaa" : "#ffe9b0";
    const top = layout.bounds.y;
    const name = worldLabel(scene, layout.cx, top - 90, `${t.name.toUpperCase()}`, tone).setFontSize(22);
    const sub = worldLabel(scene, layout.cx, top - 62, `${SETTLEMENT_KIND_LABEL[t.kind]} · ${owner}`, "#d8d8d8").setFontSize(13);
    return [name, sub];
  }
}

const rectAround = (p: Point, r: number) => new Phaser.Geom.Rectangle(p.x - r, p.y - r, r * 2, r * 2);

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
