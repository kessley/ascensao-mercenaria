import Phaser from "phaser";
import { Unit } from "../entities/Unit";
import { wallOutward, type Gate, type Rect, type TownLayout } from "../world/townLayout";
import { gateBarPiece, gateDebrisPiece, gateDoorPiece, ladderPiece, type Culture } from "../art/buildings";
import { vehicleLook } from "../art/looks";
import { sfx } from "../../audio/sounds";
import { pieceImage } from "../world/TownArt";
import { COLORS, GEO, SIEGE } from "../../utils/constants";
import { angleTo, distance, type Point } from "../../utils/math";

/** Um portão no cerco: fechado é sólido; o aríete o derruba. */
export interface SiegeGate {
  gate: Gate;
  rect: Rect;
  hp: number;
  maxHp: number;
  broken: boolean;
}

/** Aríete coberto (pixel art no G4): vai até o portão mais perto e bate até ele cair. Quem chegar perto pode destruí-lo. */
export class SiegeRam extends Unit {
  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, "ALLY", SIEGE.RAM);
    this.autoAttack = false;
    this.role = "WAGON";
    this.lure = 0.5;
    this.townAccess = "ANY";
    this.wear(vehicleLook("RAM", COLORS.ALLY));
    this.drawBody();
  }

  /** A figura é o aríete inteiro: nada no chão. */
  protected drawBody(): void {
    this.bodyGfx.clear();
  }
}

/** Trechos da porta fechada nos portões L e O (como a muralha na vertical). */
const BAR = 48;
let serial = 0;

/** O que a cena precisa saber das obras do cerco. */
export interface SiegeChange {
  /** Portões de pé (sólidos) e passagens abertas nos muros (escadas). */
  solids: Rect[];
  breaches: Rect[];
}

/**
 * Obras de um cerco de verdade (Marco 16), só enquanto o bando está diante dos muros: portões
 * fechados (sólidos, com vida), escadas (brechas na muralha) e o aríete.
 */
export class SiegeWorks {
  readonly gates: SiegeGate[];
  readonly ladders: Rect[] = [];
  ram: Unit | null = null;
  /** Surtida: os portões ficam abertos até este momento (tempo da cena). */
  sallyUntil = 0;
  /** As escadas desenhadas, na ordem de `ladders`. */
  private readonly ladderArt: Phaser.GameObjects.Image[] = [];
  private gone = false;
  /** As folhas fechadas de cada portão (somem na surtida e quando ele cai) e os destroços dos que caíram. */
  private readonly doors: Phaser.GameObjects.Image[][];
  private readonly debris: (Phaser.GameObjects.Image | null)[];

  constructor(
    private readonly scene: Phaser.Scene,
    readonly layout: TownLayout,
    private readonly culture: Culture,
    /** Índice do portão mais fraco (o batedor descobre qual é). */
    weakGate: number,
    private readonly onChange: () => void,
    private readonly onGateDown: (g: Gate) => void,
  ) {
    const stone = layout.wallKind === "STONE";
    this.gates = layout.gates.map((gate, i) => {
      const vertical = gate.side === "E" || gate.side === "W";
      const t = layout.wallThickness + 4;
      const rect: Rect = vertical ? { x: gate.x - t / 2, y: gate.y - gate.width / 2 - 4, w: t, h: gate.width + 8 } : { x: gate.x - gate.width / 2 - 4, y: gate.y - t / 2, w: gate.width + 8, h: t };
      const maxHp = (stone ? SIEGE.GATE_HP.STONE : SIEGE.GATE_HP.PALISADE) * (i === weakGate ? SIEGE.WEAK_GATE : 1);
      return { gate, rect, hp: maxHp, maxHp, broken: false };
    });
    this.doors = layout.gates.map((gate) => this.makeDoor(gate));
    this.debris = layout.gates.map(() => null);
    this.draw();
  }

  /** Folhas fechadas por cima do portão aberto da arte do povoado (o mesmo pé, um tico na frente). */
  private makeDoor(gate: Gate): Phaser.GameObjects.Image[] {
    const b = this.layout.bounds;
    const t = this.layout.wallThickness;
    const stone = this.layout.wallKind === "STONE";
    const key = `siege-door-${serial++}`;
    if (gate.side === "N" || gate.side === "S") {
      const y = gate.side === "N" ? b.y : b.y + b.h - t;
      return [pieceImage(this.scene, key, gateDoorPiece(Math.round(gate.width), Math.round(t), stone, this.culture), gate.x - gate.width / 2, y, y + t + 0.01)];
    }
    const top = gate.y - gate.width / 2;
    const end = gate.y + gate.width / 2;
    const out: Phaser.GameObjects.Image[] = [];
    for (let y = top; y < end; y += BAR) {
      const len = Math.round(Math.min(BAR, end - y));
      out.push(pieceImage(this.scene, `${key}-${out.length}`, gateBarPiece(len, Math.round(t), this.culture, y + BAR >= end), gate.x - t / 2, y, y + len));
    }
    return out;
  }

  /** O vão do portão caído, com as tábuas no chão (embaixo de quem passa). */
  private makeDebris(gate: Gate, i: number): Phaser.GameObjects.Image {
    const b = this.layout.bounds;
    const t = Math.round(this.layout.wallThickness);
    const w = Math.round(gate.width);
    const key = `siege-debris-${serial++}`;
    const seed = Math.round(gate.x * 31 + gate.y * 17) + i;
    if (gate.side === "N" || gate.side === "S") {
      const y = gate.side === "N" ? b.y : b.y + b.h - t;
      return pieceImage(this.scene, key, gateDebrisPiece(w, t, this.culture, seed), gate.x - w / 2, y, y);
    }
    const y = gate.y - w / 2;
    return pieceImage(this.scene, key, gateDebrisPiece(t, w, this.culture, seed), gate.x - t / 2, y, y);
  }

  /** Folhas à mostra só nos portões de pé e fora da surtida. */
  private showDoors(): void {
    const shut = this.scene.time.now >= this.sallyUntil;
    this.gates.forEach((s, i) => {
      for (const img of this.doors[i]) img.setVisible(shut && !s.broken);
    });
  }

  /** Portões de pé agora (na surtida, abertos). */
  private standing(): SiegeGate[] {
    return this.gates.filter((g) => !g.broken && this.scene.time.now >= this.sallyUntil);
  }

  get change(): SiegeChange {
    return { solids: this.standing().map((g) => g.rect), breaches: this.ladders };
  }

  /** Abriu passagem: algum portão caiu, ou há escada de pé. */
  get open(): boolean {
    return this.ladders.length > 0 || this.gates.some((g) => g.broken);
  }

  /** Escada no trecho de muralha mais perto de `near` (longe dos portões e das torres). */
  addLadder(near: Point): Rect | null {
    const l = this.layout;
    const walls = l.walls.filter((w) => Math.max(w.w, w.h) >= 90);
    const clearOfTowers = (p: Point) => l.towers.every((r) => p.x < r.x - 50 || p.x > r.x + r.w + 50 || p.y < r.y - 50 || p.y > r.y + r.h + 50);
    let best: { p: Point; vertical: boolean } | null = null;
    let bestDist = Infinity;
    for (const w of walls) {
      const vertical = w.h > w.w;
      const len = vertical ? w.h : w.w;
      for (let t = 40; t <= len - 40; t += 40) {
        // No eixo de uma célula de navegação: é por ali que as rotas passam
        const along = (Math.floor(((vertical ? w.y : w.x) + t) / GEO.NAV_CELL) + 0.5) * GEO.NAV_CELL;
        const p = vertical ? { x: w.x + w.w / 2, y: along } : { x: along, y: w.y + w.h / 2 };
        // Na muralha lisa: nem em cima das torres nem colada num portão
        if (!clearOfTowers(p) || l.gates.some((g) => distance(p, g) < 140)) continue;
        if (this.ladders.some((r) => distance(p, { x: r.x + r.w / 2, y: r.y + r.h / 2 }) < 120)) continue;
        const d = distance(p, near);
        if (d < bestDist) {
          bestDist = d;
          best = { p, vertical };
        }
      }
    }
    if (!best) return null;
    const t = this.layout.wallThickness + 8;
    const W = SIEGE.LADDER_WIDTH;
    const rect: Rect = best.vertical ? { x: best.p.x - t / 2, y: best.p.y - W / 2, w: t, h: W } : { x: best.p.x - W / 2, y: best.p.y - t / 2, w: W, h: t };
    this.ladders.push(rect);
    this.draw();
    this.onChange();
    return rect;
  }

  /** Portão ainda de pé mais perto de um ponto. */
  nearestGate(p: Point): SiegeGate | null {
    let best: SiegeGate | null = null;
    let bestDist = Infinity;
    for (const g of this.gates) {
      if (g.broken) continue;
      const d = distance(p, g.gate);
      if (d < bestDist) {
        bestDist = d;
        best = g;
      }
    }
    return best;
  }

  spawnRam(at: Point): Unit {
    this.ram = new SiegeRam(this.scene, at.x, at.y);
    return this.ram;
  }

  /** Aríete de quem assalta a muralha do bando: a tropa dele é quem o leva ao portão. */
  takeRam(ram: Unit): void {
    this.ram = ram;
  }

  /** Por onde se passa agora, do lado de dentro: portões caídos e escadas. */
  get gaps(): Point[] {
    const inside = this.ladders.map((r) => {
      const c = { x: r.x + r.w / 2, y: r.y + r.h / 2 };
      const out = wallOutward(this.layout, c);
      return { x: c.x - Math.cos(out) * 120, y: c.y - Math.sin(out) * 120 };
    });
    return [...this.gates.filter((g) => g.broken).map((g) => g.gate.inside), ...inside];
  }

  /** Está em cima da muralha (por dentro, junto dela)? */
  onRamparts(p: Point): boolean {
    const b = this.layout.bounds;
    if (p.x < b.x || p.y < b.y || p.x > b.x + b.w || p.y > b.y + b.h) return false;
    return Math.min(p.x - b.x, b.x + b.w - p.x, p.y - b.y, b.y + b.h - p.y) <= SIEGE.RAMPART_DEPTH;
  }

  /** Golpes num portão (aríete ou machado). */
  batter(g: SiegeGate, damage: number): void {
    if (g.broken) return;
    g.hp -= damage;
    if (g.hp > 0) return;
    g.broken = true;
    this.draw();
    this.onChange();
    this.onGateDown(g.gate);
  }

  /** Aríete: anda até o portão e bate (`time` é o relógio das figuras: o golpe aparece nele). */
  update(dt: number, time: number): void {
    const r = this.ram;
    if (!r) return;
    if (!r.isAlive) {
      this.ram = null;
      return;
    }
    const g = this.nearestGate(r);
    if (!g) {
      r.unitState = "IDLE";
      return;
    }
    const front = g.gate.outside;
    if (distance(r, front) > 50) {
      r.moveTowards(front.x, front.y, dt);
      r.unitState = "MOVING";
      return;
    }
    r.unitState = "IDLE";
    // A viga recua e bate: a figura mostra o golpe, e o portão range
    if (time - r.lastAttackAt >= SIEGE.RAM_SWING_MS) {
      r.lastAttackAt = time;
      r.setFacing(angleTo(r, g.gate));
      sfx.charge(r);
    }
    this.batter(g, SIEGE.RAM_DPS * dt);
  }

  /** O que vai no save: as escadas de pé e os portões caídos. */
  serialize(): { ladders: Rect[]; broken: number[] } {
    return { ladders: this.ladders.map((r) => ({ ...r })), broken: this.gates.flatMap((g, i) => (g.broken ? [i] : [])) };
  }

  restore(data: { ladders: Rect[]; broken: number[] }): void {
    this.ladders.push(...data.ladders);
    for (const i of data.broken) if (this.gates[i]) this.gates[i].broken = true;
    this.draw();
    this.onChange();
  }

  /** Surtida: abre os portões por um tempo (a guarnição sai para queimar as obras). */
  sally(ms: number): void {
    this.sallyUntil = this.scene.time.now + ms;
    this.showDoors();
    this.onChange();
    this.scene.time.delayedCall(ms + 50, () => {
      if (this.gone) return;
      this.showDoors();
      this.onChange();
    });
  }

  private draw(): void {
    this.gates.forEach((s, i) => {
      if (s.broken && !this.debris[i]) this.debris[i] = this.makeDebris(s.gate, i);
    });
    this.showDoors();
    // Escadas: um par encostado na muralha em cada brecha nova, do lado de fora
    const stone = this.layout.wallKind === "STONE";
    for (let i = this.ladderArt.length; i < this.ladders.length; i++) {
      const r = this.ladders[i];
      const out = wallOutward(this.layout, { x: r.x + r.w / 2, y: r.y + r.h / 2 });
      const side = Math.abs(Math.cos(out)) > 0.5 ? (Math.cos(out) > 0 ? "E" : "W") : Math.sin(out) > 0 ? "S" : "N";
      const { piece, depth } = ladderPiece(side, Math.round(r.w), Math.round(r.h), Math.round(this.layout.wallThickness), stone);
      this.ladderArt.push(pieceImage(this.scene, `siege-ladder-${serial++}`, piece, Math.round(r.x), Math.round(r.y), r.y + depth));
    }
  }

  destroy(): void {
    this.gone = true;
    for (const img of [...this.doors.flat(), ...this.debris, ...this.ladderArt]) {
      if (!img) continue;
      const key = img.texture.key;
      img.destroy();
      if (this.scene.textures.exists(key)) this.scene.textures.remove(key);
    }
    if (this.ram?.isAlive) this.ram.destroy();
    this.ram = null;
  }
}
