import { Unit } from "../../entities/Unit";
import { bitmapKey } from "../../art/atlas";
import { deckOrigin, deckShipBitmap, deckSize, gangplankBitmap, SEA_TILE, seaTileBitmap, type DeckShape } from "../../art/deck";
import type { Rect } from "../../world/townLayout";
import { DECK } from "../../data/scenarios";
import { useGameStore } from "../../../store/useGameStore";
import { WORLD_HEIGHT, WORLD_WIDTH, SEA } from "../../../utils/constants";
import type { Point } from "../../../utils/math";
import type { WorldScene } from "../WorldScene";

/**
 * O mar: corsários, desembarque e o convés da batalha entre navios.
 * Uma parte da `WorldScene`: os métodos entram no protótipo dela (ver o fim de `WorldScene.ts`).
 */
export const seaMethods = {
  // --- Batalha personalizada ---

  /** A IA no mar: corsários desembarcam perto de um porto e marcham para saqueá-lo. */
  maybeCorsairs(this: WorldScene, day: number): void {
    if (this.run || day % SEA.CORSAIR_EVERY !== 0 || Math.random() > SEA.CORSAIR_CHANCE) return;
    const ports = useGameStore.getState().settlements.filter((t) => t.port && t.owner !== "RUINED");
    const town = ports[Math.floor(Math.random() * ports.length)];
    if (!town) return;
    // A praia: o último chão aberto antes do mar, partindo do porto
    let beach: Point | null = null;
    for (let turn = 0; turn < 16 && !beach; turn++) {
      const a = (turn / 16) * Math.PI * 2;
      for (let r = 900; r <= 3600; r += 200) {
        const p = { x: town.x + Math.cos(a) * r, y: town.y + Math.sin(a) * r };
        if (this.nav.isOpen(p)) continue;
        beach = r > 900 ? { x: town.x + Math.cos(a) * (r - 200), y: town.y + Math.sin(a) * (r - 200) } : null;
        break;
      }
    }
    if (!beach) return;
    const men = SEA.CORSAIR_SIZE[0] + Math.floor(Math.random() * (SEA.CORSAIR_SIZE[1] - SEA.CORSAIR_SIZE[0] + 1));
    const bows = Math.round(men / 4);
    this.warbands.spawnBand({ name: "Corsários", kind: "GOBLIN", units: [["PIRATE", men - bows], ["PIRATE_BOW", bows]], origin: beach, ownerId: null, goalId: town.id });
    useGameStore.getState().chronicle(`Velas de corsários na costa: um bando desembarcou perto de ${town.name}.`, "bad");
  },

  /** Desembarque: o exército desce no portão do porto, que passa a ser conhecido. */
  landAt(this: WorldScene, townId: string): void {
    useGameStore.setState({ landing: null });
    const layout = this.settlementLayer.layoutOf(townId);
    const town = useGameStore.getState().settlements.find((t) => t.id === townId);
    if (!layout || !town) return;
    const gate = layout.gates[0];
    const at = this.armyNav.nearestOpen(gate.wait, 900) ?? gate.wait;
    this.placeArmy(at, 0);
    this.fog.revealExplored(town, 1400);
    this.updateVision(this.time.now);
    this.pushFeed(`Terra! O bando desce em ${town.name}.`);
  },

  /** Dois navios amarrados: só as pranchas ligam um ao outro; em volta, o mar. */
  buildDeck(this: WorldScene): void {
    const g = this.add.graphics().setDepth(-4.6);
    g.fillStyle(0x1f4f6e, 1);
    g.fillRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
    // O mar que se mexe, em volta dos navios (além dele, a cor lisa)
    const middle = { x: (DECK.OURS.x + DECK.THEIRS.x + DECK.THEIRS.w) / 2, y: DECK.OURS.y + DECK.OURS.h / 2 };
    const sea = this.add.tileSprite(middle.x, middle.y, SEA_TILE * 64, SEA_TILE * 40, bitmapKey(this, "deck:sea", seaTileBitmap)).setDepth(-4.5);
    this.tweens.add({ targets: sea, tilePositionX: SEA_TILE, duration: 26000, repeat: -1 });
    // Os dois navios: o nosso com a proa a oeste, o deles espelhado
    const shapeOf = (ship: Rect): DeckShape => ({ w: ship.w, h: ship.h, rail: DECK.RAIL, planks: DECK.PLANKS.map((y) => y - ship.y), plankWidth: DECK.PLANK_WIDTH });
    for (const [ship, enemy] of [[DECK.OURS, false], [DECK.THEIRS, true]] as const) {
      const shape = shapeOf(ship);
      const o = deckOrigin(shape);
      const size = deckSize(shape);
      const key = bitmapKey(this, `deck:ship:${enemy ? "theirs" : "ours"}:${ship.w}x${ship.h}`, () => deckShipBitmap(shape, enemy));
      // Espelhado, o desenho vira em volta do meio: o convés tem de cair de novo no lugar
      const left = enemy ? ship.x + ship.w + o.x - size.w : ship.x - o.x;
      this.add.image(left + size.w / 2, ship.y - o.y + size.h / 2, key).setFlipX(enemy).setDepth(-4.45);
    }
    const solids: { rect: Rect; type: "WALL" }[] = [];
    const wall = (x: number, y: number, w: number, h: number) => solids.push({ rect: { x, y, w, h }, type: "WALL" });
    const R = DECK.RAIL;
    const half = DECK.PLANK_WIDTH / 2;
    const openings: Rect[] = [];
    for (const [ship, gapSide] of [[DECK.OURS, "E"], [DECK.THEIRS, "W"]] as const) {
      wall(ship.x - R, ship.y - R, ship.w + 2 * R, R);
      wall(ship.x - R, ship.y + ship.h, ship.w + 2 * R, R);
      const side = gapSide === "E" ? ship.x + ship.w : ship.x - R;
      if (gapSide === "E") wall(ship.x - R, ship.y, R, ship.h);
      else wall(ship.x + ship.w, ship.y, R, ship.h);
      // A amurada que dá para o outro navio, cortada onde as pranchas apoiam
      let from = ship.y;
      for (const y of DECK.PLANKS) {
        wall(side, from, R, y - half - from);
        from = y + half;
      }
      wall(side, from, R, ship.y + ship.h - from);
    }
    const left = DECK.OURS.x + DECK.OURS.w;
    const right = DECK.THEIRS.x;
    const plank = bitmapKey(this, `deck:plank:${right - left}`, () => gangplankBitmap(right - left, DECK.PLANK_WIDTH, R));
    for (const y of DECK.PLANKS) {
      this.add.image(left, y - half - R, plank).setOrigin(0, 0).setDepth(-4.4);
      wall(left + R, y - half - R, right - left - 2 * R, R);
      wall(left + R, y + half, right - left - 2 * R, R);
      openings.push({ x: left - R, y: y - half, w: right - left + 2 * R, h: DECK.PLANK_WIDTH });
    }
    Unit.terrain?.setExtraSolids(solids);
    this.nav.setOpenings(openings);
    this.armyNav.setOpenings(openings);
    this.nav.invalidateAll();
    this.armyNav.invalidateAll();
  },
};

export type SeaMethods = typeof seaMethods;
