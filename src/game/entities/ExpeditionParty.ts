import Phaser from "phaser";
import { Unit } from "./Unit";
import { COLORS, TROOPS, type TroopType } from "../../utils/constants";
import type { Point } from "../../utils/math";
import { troopLook, vehicleLook } from "../art/looks";
import type { Look } from "../art/figures";
import { LOD_SCALE, standardKey, type StandardGlyph } from "../art/atlas";

/** Mais que isso não cabe na coluna sem virar um borrão. */
const MAX_MARCHERS = 36;
const FILE = 3;
/** Carroças do comboio, no máximo. */
const MAX_CARTS = 4;
/** Salto grande (viagem rápida, relógio adiantado): vai direto, sem deslizar pelo mapa. */
const JUMP = 500;

/** Quem vai na coluna: o tipo de tropa e quantos. */
export interface PartyTroop {
  troop: TroopType;
  soldiers: number;
}

/** Figura só de enfeite (G4): anda com a coluna, não luta e não é alvo de ninguém. */
class Marcher extends Unit {
  constructor(scene: Phaser.Scene, x: number, y: number, look: Look, radius: number) {
    super(scene, x, y, "ALLY", { hp: 1, speed: 0, damage: 0, range: 0, cooldown: 1e9, radius });
    this.autoAttack = false;
    this.wear(look);
    this.drawBody();
  }

  protected drawBody(): void {
    this.bodyGfx.clear();
  }
}

/** Uma figura por soldado até o limite; acima dele, a mesma proporção de cada tropa. */
function roster(troops: readonly PartyTroop[]): TroopType[] {
  const all = troops.flatMap((t) => Array<TroopType>(Math.max(0, t.soldiers)).fill(t.troop));
  if (all.length <= MAX_MARCHERS) return all;
  return Array.from({ length: MAX_MARCHERS }, (_, i) => all[Math.floor((i * all.length) / MAX_MARCHERS)]);
}

function glyphOf(troop: TroopType): StandardGlyph {
  if (troop === "SPEARMEN") return "SPEAR";
  const family = TROOPS[troop].family;
  return family === "ARCHERS" ? "BOW" : family === "CAVALRY" ? "HORSE" : "SWORD";
}

/**
 * Tropa em expedição e comboio de suprimentos vistos no mapa (pixel art no G4): a coluna em
 * marcha, só desenho. O porta-estandarte vai na frente (dourado com capitão, Marco 20), os
 * soldados em filas de três atrás dele e, no comboio, os carros de bois no fim.
 *
 * Quem manda nela é o relógio (ver `expeditionStage`); a luta dela continua resolvida em conta,
 * então ninguém a ataca. As figuras são `Unit`s de enfeite: a animação, a direção e o zoom saem
 * de graça, como os de todo mundo.
 */
export class ExpeditionParty {
  x: number;
  y: number;
  private facing = 0;
  private readonly marchers: Marcher[];
  private carts: Marcher[] = [];
  private readonly standard: Phaser.GameObjects.Image | null;
  private readonly label: Phaser.GameObjects.Text;
  /** Distância entre as filas e entre quem vai lado a lado (cavalo ocupa mais). */
  private readonly along: number;
  private readonly across: number;

  /** `tag` vai depois do nome ("em missão"); o comboio de suprimentos não leva nenhum. */
  constructor(
    private readonly scene: Phaser.Scene,
    at: Point,
    troops: readonly PartyTroop[],
    name: string,
    captain = false,
    tag: string | null = "em missão",
  ) {
    this.x = at.x;
    this.y = at.y;
    const list = roster(troops);
    const rides = list.some((t) => TROOPS[t].stats.mounted);
    this.along = rides ? 30 : 20;
    this.across = rides ? 22 : 16;
    this.marchers = list.map((t) => new Marcher(scene, at.x, at.y, troopLook(t), TROOPS[t].stats.radius));
    this.standard = list.length > 0 ? scene.add.image(at.x, at.y, standardKey(scene, captain ? COLORS.CAPTAIN : 0x38bdf8, glyphOf(list[0]))).setOrigin(2.5 / 19, 1) : null;
    this.label = scene.add
      .text(at.x, at.y, tag ? `${name} · ${tag}` : name, { fontFamily: "monospace", fontSize: "12px", color: "#bfe3ff", stroke: "#10202e", strokeThickness: 3 })
      .setOrigin(0.5, 1)
      .setDepth(6);
    this.place();
  }

  /** Carroças atrás da coluna (o comboio leva todas as do bando; a expedição de escolta, uma). */
  setCart(cart: boolean, count = 1): void {
    const n = cart ? Math.max(1, Math.min(MAX_CARTS, count)) : 0;
    if (n === this.carts.length) return;
    while (this.carts.length > n) this.carts.pop()?.destroy();
    while (this.carts.length < n) this.carts.push(new Marcher(this.scene, this.x, this.y, vehicleLook("WAGON", COLORS.ALLY), 16));
    this.place();
  }

  /** Anda até o ponto que o relógio manda (o relógio avança aos saltos: o desenho desliza). */
  follow(to: Point, facing: number, dt: number): void {
    const dx = to.x - this.x;
    const dy = to.y - this.y;
    const step = Math.hypot(dx, dy) > JUMP ? 1 : Math.min(1, dt * 3);
    this.x += dx * step;
    this.y += dy * step;
    this.facing = facing;
    this.place();
  }

  /** Cada figura no seu lugar da coluna, virada para onde ela vai. */
  private place(): void {
    const c = Math.cos(this.facing);
    const s = Math.sin(this.facing);
    const at = (along: number, across: number) => ({ x: this.x + c * along - s * across, y: this.y + s * along + c * across });
    this.marchers.forEach((m, i) => {
      // O porta-estandarte na frente; os outros em filas de três atrás dele, um tico fora do alinhamento
      const k = i - 1;
      const along = i === 0 ? 0 : -(Math.floor(k / FILE) + 1) * this.along + ((i * 7) % 5) - 2;
      const across = i === 0 ? 0 : ((k % FILE) - 1) * this.across + ((i * 3) % 3) - 1;
      const p = at(along, across);
      m.x = p.x;
      m.y = p.y;
      m.setFacing(this.facing);
    });
    const rows = this.marchers.length > 0 ? Math.ceil((this.marchers.length - 1) / FILE) + 1 : 0;
    const start = rows > 0 ? rows * this.along + 26 : 0;
    this.carts.forEach((w, i) => {
      const p = at(-start - i * 58, 0);
      w.x = p.x;
      w.y = p.y;
      w.setFacing(this.facing);
    });
    const head = this.marchers[0] ?? this.carts[0];
    const lod = LOD_SCALE[Unit.lod];
    if (this.standard && head) {
      // O mastro na mão de quem vai na frente, um tico à frente dele na tela
      this.standard.setPosition(head.x + 4, head.y + head.feetY - 4).setScale(lod).setDepth(head.depth + 1e-7);
    }
    const top = head ? head.y + head.headY - (this.standard ? 26 * lod : 6) : this.y - 46;
    this.label.setPosition(head?.x ?? this.x, top);
  }

  destroy(): void {
    for (const u of [...this.marchers, ...this.carts]) u.destroy();
    this.carts = [];
    this.standard?.destroy();
    this.label.destroy();
  }
}
