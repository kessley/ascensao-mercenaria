import Phaser from "phaser";
import type { Point } from "../../utils/math";
import { bushPiece, oakPiece, pinePiece, rockPiece, type Foliage } from "../art/trees";
import { forestSpots, type TreeSpot } from "./forestLayout";
import type { TerrainMap, TerrainZone } from "./TerrainMap";
import { TownArt, type ArtJob } from "./TownArt";

/**
 * Matas em pixel art (G2): cada zona de mata vira árvores, moitas e pedras de verdade, com a
 * profundidade do pé (o soldado passa atrás da árvore). As peças vêm das mesmas folhas dos
 * povoados (`TownArt`): só existem perto da câmera, e de longe ficam reduzidas.
 *
 * O lugar de cada árvore sai da semente da zona, então a mata é sempre a mesma. A estação muda
 * só o desenho (folhas, cor do outono, galho pelado, neve), nunca onde as árvores estão.
 */

/** Ninguém planta árvore na estrada. */
const ROAD_CLEAR = 34;

function hashText(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

function segmentDistance(p: Point, a: Point, b: Point): number {
  const vx = b.x - a.x;
  const vy = b.y - a.y;
  const len = vx * vx + vy * vy;
  const t = len > 0 ? Math.max(0, Math.min(1, ((p.x - a.x) * vx + (p.y - a.y) * vy) / len)) : 0;
  return Math.hypot(p.x - (a.x + vx * t), p.y - (a.y + vy * t));
}

export interface ForestSeason {
  foliage: Foliage;
  /** Neve no chão abaixo desta temperatura (null: sem neve). */
  snowBelow: number | null;
}

export class ForestArt {
  private readonly art: TownArt;
  private season: ForestSeason = { foliage: "SUMMER", snowBelow: null };
  private readonly forests: { id: string; zone: TerrainZone; bounds: Phaser.Geom.Rectangle; spots: TreeSpot[] | null }[];
  private readonly roadsNear: (b: Phaser.Geom.Rectangle) => [Point, Point][];

  constructor(
    scene: Phaser.Scene,
    private readonly terrain: TerrainMap,
    roads: readonly Point[][],
  ) {
    this.art = new TownArt(scene);
    this.forests = terrain.zones.flatMap((zone, i) =>
      zone.type === "FOREST"
        ? [{ id: `mata-${i}-${Math.round(zone.x)}-${Math.round(zone.y)}`, zone, bounds: new Phaser.Geom.Rectangle(zone.x - zone.rx - 40, zone.y - zone.ry - 80, zone.rx * 2 + 80, zone.ry * 2 + 100), spots: null }]
        : [],
    );
    // Segmentos de estrada perto de cada mata (para não plantar árvore no caminho)
    this.roadsNear = (b) => {
      const out: [Point, Point][] = [];
      for (const road of roads) {
        for (let k = 1; k < road.length; k++) {
          const a = road[k - 1];
          const c = road[k];
          if (Math.max(a.x, c.x) < b.x - ROAD_CLEAR || Math.min(a.x, c.x) > b.right + ROAD_CLEAR || Math.max(a.y, c.y) < b.y - ROAD_CLEAR || Math.min(a.y, c.y) > b.bottom + ROAD_CLEAR) continue;
          out.push([a, c]);
        }
      }
      return out;
    };
    this.plantAll();
  }

  /** Árvores em pé agora (para testes e medições). */
  get pieceCount(): number {
    return this.art.pieceCount;
  }

  /** A estação mudou: as matas perto da câmera são redesenhadas sem piscar. */
  setSeason(season: ForestSeason): void {
    if (season.foliage === this.season.foliage && season.snowBelow === this.season.snowBelow) return;
    this.season = season;
    this.plantAll();
  }

  update(camera: Phaser.Cameras.Scene2D.Camera): void {
    this.art.update(camera);
  }

  private plantAll(): void {
    for (const f of this.forests) this.art.setLazy(f.id, f.bounds, () => this.jobsOf(f));
  }

  private jobsOf(f: ForestArt["forests"][number]): ArtJob[] {
    if (!f.spots) {
      const geo = this.terrain.geo;
      const roads = this.roadsNear(f.bounds);
      const ok = (p: Point) => this.terrain.typeAt(p.x, p.y) === "FOREST" && roads.every(([a, b]) => segmentDistance(p, a, b) > ROAD_CLEAR);
      f.spots = forestSpots(f.zone, hashText(f.id), geo ? geo.biomeAt(f.zone.x, f.zone.y) : null, ok);
    }
    const { foliage, snowBelow } = this.season;
    const geo = this.terrain.geo;
    const green = foliage !== "WINTER";
    return f.spots.map((t) => {
      const snow = snowBelow !== null && !!geo && geo.temperatureAt(t.x, t.y) < snowBelow;
      const make =
        t.kind === "PINE"
          ? () => pinePiece(t.seed, snow)
          : t.kind === "OAK"
            ? () => oakPiece(t.seed, foliage, snow)
            : t.kind === "BUSH"
              ? () => bushPiece(t.seed, foliage, snow)
              : () => rockPiece(t.seed, t.kind === "BIG_ROCK", green, snow);
      return { make, x: t.x, y: t.y, depth: t.y };
    });
  }
}
