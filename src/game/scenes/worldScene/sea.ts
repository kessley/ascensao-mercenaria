import { Unit } from "../../entities/Unit";
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
    const g = this.add.graphics().setDepth(-4.5);
    g.fillStyle(0x1f4f6e, 1);
    g.fillRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
    const solids: { rect: Rect; type: "WALL" }[] = [];
    const wall = (x: number, y: number, w: number, h: number) => solids.push({ rect: { x, y, w, h }, type: "WALL" });
    const R = DECK.RAIL;
    const half = DECK.PLANK_WIDTH / 2;
    const openings: Rect[] = [];
    for (const [ship, gapSide] of [[DECK.OURS, "E"], [DECK.THEIRS, "W"]] as const) {
      g.fillStyle(0x7a5a38, 1);
      g.fillRect(ship.x, ship.y, ship.w, ship.h);
      g.lineStyle(2, 0x5a4028, 0.8);
      for (let y = ship.y + 44; y < ship.y + ship.h; y += 44) g.lineBetween(ship.x, y, ship.x + ship.w, y);
      g.fillStyle(0x3a2616, 1);
      g.fillRect(ship.x + ship.w / 2 - 22, ship.y + 90, 44, 44);
      g.fillRect(ship.x + ship.w / 2 - 22, ship.y + ship.h - 134, 44, 44);
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
    g.fillStyle(0x9a7a50, 1);
    for (const y of DECK.PLANKS) {
      g.fillRect(left, y - half, right - left, DECK.PLANK_WIDTH);
      wall(left + R, y - half - R, right - left - 2 * R, R);
      wall(left + R, y + half, right - left - 2 * R, R);
      openings.push({ x: left - R, y: y - half, w: right - left + 2 * R, h: DECK.PLANK_WIDTH });
    }
    g.fillStyle(0x3a2616, 1);
    for (const s of solids) g.fillRect(s.rect.x, s.rect.y, s.rect.w, s.rect.h);
    Unit.terrain?.setExtraSolids(solids);
    this.nav.setOpenings(openings);
    this.armyNav.setOpenings(openings);
    this.nav.invalidateAll();
    this.armyNav.invalidateAll();
  },
};

export type SeaMethods = typeof seaMethods;
