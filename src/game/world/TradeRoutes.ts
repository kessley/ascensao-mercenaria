import Phaser from "phaser";
import type { WorldDef } from "../data/world";
import type { TownLayout } from "./townLayout";
import { roadGraphOf } from "../sim/roadGraph";
import { bestTrade, type TradePlan } from "../sim/market";
import { isCalamityOwner, isFactionOwner, isSick, kingdomsAtWar, type Settlement } from "../sim/realm";
import { WarbandManager, bandSize, type CaravanCargo, type Warband, type WarbandEvent } from "../systems/Warbands";
import { useGameStore } from "../../store/useGameStore";
import { CARAVAN, GOODS, WORLD, type Good } from "../../utils/constants";
import { weatherAt } from "../../utils/season";
import { geoOf } from "../worldgen/geoMap";
import { ofRealm } from "../worldgen/names";
import { distance, type Point } from "../../utils/math";

/** Barcaça num rio ou navio na costa (Marco 14): anda por uma linha (o rio, o mar) com a carga. */
export interface Ship {
  id: string;
  kind: "BARGE" | "SHIP";
  name: string;
  path: Point[];
  /** Distância já percorrida ao longo do caminho. */
  done: number;
  /** px por segundo (tempo real) e por dia (viagem rápida). */
  speed: number;
  cargo: CaravanCargo;
  /** Parado no porto pela tempestade (vale o dia todo). */
  held: boolean;
}

export type ShipSave = Omit<Ship, "held">;

/** Notícia do comércio para o HUD e o diário. */
export interface TradeNews {
  text: string;
  tone: "info" | "good" | "bad";
  /** Aconteceu longe: vai só para a crônica. */
  quiet?: boolean;
}

const lengthOf = (path: readonly Point[]) => path.reduce((sum, p, i) => (i === 0 ? 0 : sum + distance(path[i - 1], p)), 0);

/**
 * Comércio do continente na cena (Marco 14): os mercadores mandam caravanas pelas estradas
 * (bandos de verdade, que entram na bolha, podem ser saqueados por goblins e pelo bando),
 * barcaças pelos rios e navios pela costa (que ficam no porto com a tempestade e às vezes
 * afundam). Também põe na estrada as caravanas próprias do bando e a caravana escoltada de
 * um contrato.
 */
export class TradeRoutes {
  ships: Ship[] = [];
  private readonly gfx: Phaser.GameObjects.Graphics;
  private seq = 0;
  /** Caminhos por mar e por rio já calculados (par de povoados → linha; null = não há). */
  private readonly waterPaths = new Map<string, Point[] | null>();
  /** Caravanas que já contaram ao bando os preços de onde vieram. */
  private readonly told = new WeakSet<Warband>();

  constructor(
    scene: Phaser.Scene,
    private readonly world: WorldDef,
    private readonly warbands: WarbandManager,
    private readonly layoutOf: (id: string) => TownLayout | undefined,
  ) {
    this.gfx = scene.add.graphics().setDepth(-1.5);
  }

  destroy(): void {
    this.gfx.destroy();
  }

  // --- Partidas (uma vez por dia) ---

  /** Dia novo: mercadores mandam caravanas, barcaças e navios; as caravanas do bando partem. */
  daily(day: number): TradeNews[] {
    const news: TradeNews[] = [];
    const s = useGameStore.getState();
    const open = (t: Settlement) => t.owner !== "RUINED" && !isCalamityOwner(t.owner) && !isSick(t, day) && t.prosperity >= 25;
    const embargo = (a: Settlement, b: Settlement) => isFactionOwner(a.owner) && isFactionOwner(b.owner) && kingdomsAtWar(s.wars, a.owner, b.owner);
    const caravans = this.warbands.bands.filter((b) => b.kind === "CARAVAN");
    const max = Math.min(CARAVAN.MAX, Math.ceil(s.settlements.length / CARAVAN.PER_SETTLEMENTS));
    const roads = roadGraphOf(this.world);
    const towns = [...s.settlements].sort(() => Math.random() - 0.5);
    let count = caravans.length;
    for (const t of towns) {
      if (count >= max) break;
      if (!open(t) || caravans.some((c) => c.cargo?.from === t.id && !c.cargo.own)) continue;
      const chance = CARAVAN.DAILY_CHANCE * (t.kind === "CITY" ? 1.5 : 1) * (t.buildings.includes("MARKET") ? 1.3 : 1);
      if (Math.random() > chance) continue;
      let best: { plan: TradePlan; to: Settlement; days: number } | null = null;
      for (const r of roads.reachable(t.id, CARAVAN.MAX_DAYS).slice(0, 6)) {
        const to = s.settlements.find((x) => x.id === r.id);
        if (!to || !open(to) || embargo(t, to)) continue;
        const plan = bestTrade(t.econ, to.econ, r.days);
        if (plan && (!best || plan.profit > best.plan.profit)) best = { plan, to, days: r.days };
      }
      if (!best) continue;
      if (this.sendCaravan(t, best.to, best.plan)) count++;
    }
    this.sendShips(day);
    news.push(...this.sendOwnCaravans());
    return news;
  }

  /** Caravana dos mercadores de `from` até `to` pelas estradas. */
  private sendCaravan(from: Settlement, to: Settlement, plan: TradePlan, own?: { id: string; name: string }): boolean {
    const route = roadGraphOf(this.world).route(from.id, to.id);
    if (!route) return false;
    const store = useGameStore.getState();
    const cost = store.caravanDeparts(from.id, plan.good, plan.qty, own?.id);
    if (cost <= 0 && !own) return false;
    const def = isFactionOwner(from.owner) ? this.world.factions.find((f) => f.id === from.owner) : undefined;
    const guards = CARAVAN.GUARDS[0] + Math.floor(Math.random() * (CARAVAN.GUARDS[1] - CARAVAN.GUARDS[0] + 1));
    const cargo: CaravanCargo = { good: plan.good, qty: cost > 0 ? plan.qty : 0, from: from.id, to: to.id, cost, own: own?.id };
    this.warbands.spawnBand({
      name: own ? own.name : `Caravana de ${from.name}`,
      kind: "CARAVAN",
      units: [
        ["CART", 1],
        ["MERCHANT", 1],
        ["CARAVAN_GUARD", guards],
      ],
      origin: route.points[0],
      ownerId: own ? "PLAYER" : (def?.id ?? null),
      color: own ? 0x2f6fdf : def?.color,
      cargo,
      route: route.points.slice(1),
      goalId: to.id,
    });
    return true;
  }

  /** Caravanas próprias do bando: cada uma parte de onde está para a outra ponta da rota. */
  private sendOwnCaravans(): TradeNews[] {
    const s = useGameStore.getState();
    const news: TradeNews[] = [];
    for (const c of s.ownCaravans) {
      if (c.lost || this.warbands.bands.some((b) => b.cargo?.own === c.id)) continue;
      const fromId = c.at ?? c.a;
      const toId = fromId === c.a ? c.b : c.a;
      const from = s.settlements.find((x) => x.id === fromId);
      const to = s.settlements.find((x) => x.id === toId);
      if (!from || !to) continue;
      const route = roadGraphOf(this.world).route(from.id, to.id);
      if (!route) {
        news.push({ text: `${c.name} não acha estrada entre ${from.name} e ${to.name}.`, tone: "bad", quiet: true });
        continue;
      }
      // Leva o bem mais lucrativo (mesmo com lucro pequeno); sem nenhum, viaja vazia
      const plan = bestTrade(from.econ, to.econ, route.days) ?? planAnyway(from, to, route.days);
      this.sendCaravan(from, to, plan ?? { good: "GRAIN", qty: 0, buy: 0, sell: 0, profit: 0 }, { id: c.id, name: c.name });
    }
    return news;
  }

  /** Caravana do contrato de escolta: espera o bando no portão de `fromId`. */
  spawnEscort(fromId: string, toId: string): Warband | null {
    const s = useGameStore.getState();
    const from = s.settlements.find((x) => x.id === fromId);
    const to = s.settlements.find((x) => x.id === toId);
    const route = from && to ? roadGraphOf(this.world).route(from.id, to.id) : null;
    if (!from || !to || !route) return null;
    const plan = bestTrade(from.econ, to.econ, route.days) ?? planAnyway(from, to, route.days);
    const good: Good = plan?.good ?? "CLOTH";
    const qty = plan?.qty ?? 10;
    const def = isFactionOwner(from.owner) ? this.world.factions.find((f) => f.id === from.owner) : undefined;
    const layout = this.layoutOf(from.id);
    const start = layout ? layout.gates[0].outside : route.points[0];
    return this.warbands.spawnBand({
      name: `Caravana da Guilda de ${from.name}`,
      kind: "CARAVAN",
      units: [
        ["CART", 1],
        ["MERCHANT", 1],
        ["CARAVAN_GUARD", 2],
      ],
      origin: start,
      ownerId: def?.id ?? null,
      color: def?.color,
      cargo: { good, qty, from: from.id, to: to.id, cost: 0, escort: true },
      route: route.points,
      goalId: to.id,
    });
  }

  // --- Barcaças e navios ---

  /** Portos com navios e povoados de rio com barcaças mandam carga a outros portos e cidades do mesmo rio. */
  private sendShips(day: number): void {
    const s = useGameStore.getState();
    if (this.ships.length >= 10) return;
    const geo = geoOf(this.world.geo);
    for (const t of s.settlements) {
      if (t.owner === "RUINED" || isCalamityOwner(t.owner) || isSick(t, day)) continue;
      if (this.ships.some((sh) => sh.cargo.from === t.id)) continue;
      const harbor = t.port && (t.buildings.includes("PORT") || t.kind !== "VILLAGE");
      const wharf = t.river && (t.buildings.includes("MILL") || t.kind !== "VILLAGE");
      if (!harbor && !wharf) continue;
      if (Math.random() > 0.18) continue;
      // Tempestade no porto: ninguém sai
      if (harbor && weatherAt(this.world.seed, day, t, geo) === "STORM") continue;
      let best: { plan: TradePlan; to: Settlement; path: Point[]; kind: Ship["kind"] } | null = null;
      for (const to of s.settlements) {
        if (to === t || to.owner === "RUINED" || isCalamityOwner(to.owner)) continue;
        if (isFactionOwner(t.owner) && isFactionOwner(to.owner) && kingdomsAtWar(s.wars, t.owner, to.owner)) continue;
        const kind: Ship["kind"] | null = harbor && to.port ? "SHIP" : wharf && to.river ? "BARGE" : null;
        if (!kind) continue;
        if (distance(t, to) > WORLD.DAY_DISTANCE * 4) continue;
        const path = kind === "SHIP" ? this.seaPath(t, to) : this.riverPath(t, to);
        if (!path) continue;
        const speedDay = this.speedOf(kind, path) * (WORLD.WARBAND.DAY_DISTANCE / WORLD.WARBAND.SPEED);
        const days = lengthOf(path) / speedDay;
        const plan = bestTrade(t.econ, to.econ, days * 0.5, kind === "SHIP" ? CARAVAN.SHIP_CAPACITY : CARAVAN.BARGE_CAPACITY);
        if (plan && (!best || plan.profit > best.plan.profit)) best = { plan, to, path, kind };
      }
      if (!best) continue;
      const cost = s.caravanDeparts(t.id, best.plan.good, best.plan.qty);
      if (cost <= 0) continue;
      this.ships.push({
        id: `ship-${++this.seq}`,
        kind: best.kind,
        name: best.kind === "SHIP" ? `Navio de ${t.name}` : `Barcaça de ${t.name}`,
        path: best.path,
        done: 0,
        speed: this.speedOf(best.kind, best.path),
        cargo: { good: best.plan.good, qty: best.plan.qty, from: t.id, to: best.to.id, cost },
        held: false,
      });
      if (this.ships.length >= 10) return;
    }
  }

  /** Rio abaixo é mais rápido; rio acima, mais lento; o navio é o mais rápido. */
  private speedOf(kind: Ship["kind"], path: readonly Point[]): number {
    if (kind === "SHIP") return WORLD.WARBAND.SPEED * CARAVAN.SHIP_SPEED;
    const down = path.length > 1 && (path as Point[] & { down?: boolean }).down !== false;
    return WORLD.WARBAND.SPEED * (down ? CARAVAN.BARGE_SPEED.DOWN : CARAVAN.BARGE_SPEED.UP);
  }

  /** Trecho do rio entre dois povoados à beira do mesmo rio (só rios navegáveis, não riachos). */
  private riverPath(a: Settlement, b: Settlement): Point[] | null {
    const key = `R|${a.id}|${b.id}`;
    if (this.waterPaths.has(key)) return this.waterPaths.get(key) ?? null;
    let found: Point[] | null = null;
    for (const r of this.world.geo.rivers) {
      if (r.kind === "STREAM") continue;
      const near = (p: Point) => {
        let best = -1;
        let bd = 3200;
        r.points.forEach((q, i) => {
          const d = distance(p, q);
          if (d < bd) {
            bd = d;
            best = i;
          }
        });
        return best;
      };
      const ia = near(a);
      const ib = near(b);
      if (ia < 0 || ib < 0 || ia === ib) continue;
      const down = ia < ib;
      const slice = down ? r.points.slice(ia, ib + 1) : r.points.slice(ib, ia + 1).reverse();
      const path = slice.map((p) => ({ ...p })) as Point[] & { down?: boolean };
      path.down = down;
      found = path;
      break;
    }
    this.waterPaths.set(key, found);
    return found;
  }

  /** Rota por mar entre dois portos: busca em largura pelas células de mar do continente. */
  private seaPath(a: Settlement, b: Settlement): Point[] | null {
    // Calculado uma vez por par (do id menor para o maior); na volta, ao contrário
    const [first, second] = a.id < b.id ? [a, b] : [b, a];
    const key = `S|${first.id}|${second.id}`;
    if (!this.waterPaths.has(key)) this.waterPaths.set(key, this.searchSea(first, second));
    const path = this.waterPaths.get(key) ?? null;
    return path && first !== a ? [...path].reverse() : path;
  }

  private searchSea(first: Settlement, second: Settlement): Point[] | null {
    const g = this.world.geo;
    const sea = (i: number) => g.elevation[i] < g.seaLevel;
    const cellOf = (p: Point) => Math.max(0, Math.min(g.rows - 1, Math.floor(p.y / g.cell))) * g.cols + Math.max(0, Math.min(g.cols - 1, Math.floor(p.x / g.cell)));
    const nearestSea = (p: Point): number => {
      const c0 = cellOf(p);
      const cx = c0 % g.cols;
      const cy = Math.floor(c0 / g.cols);
      let best = -1;
      let bd = Infinity;
      for (let dy = -5; dy <= 5; dy++) {
        for (let dx = -5; dx <= 5; dx++) {
          const x = cx + dx;
          const y = cy + dy;
          if (x < 0 || y < 0 || x >= g.cols || y >= g.rows) continue;
          const i = y * g.cols + x;
          if (sea(i) && dx * dx + dy * dy < bd) {
            bd = dx * dx + dy * dy;
            best = i;
          }
        }
      }
      return best;
    };
    const start = nearestSea(first);
    const goal = nearestSea(second);
    let path: Point[] | null = null;
    if (start >= 0 && goal >= 0) {
      const prev = new Int32Array(g.cols * g.rows).fill(-1);
      prev[start] = start;
      const queue = [start];
      for (let qi = 0; qi < queue.length && prev[goal] < 0; qi++) {
        const c = queue[qi];
        const x = c % g.cols;
        const y = Math.floor(c / g.cols);
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            const nx = x + dx;
            const ny = y + dy;
            if ((dx === 0 && dy === 0) || nx < 0 || ny < 0 || nx >= g.cols || ny >= g.rows) continue;
            const n = ny * g.cols + nx;
            if (prev[n] >= 0 || !sea(n)) continue;
            prev[n] = c;
            queue.push(n);
          }
        }
      }
      if (prev[goal] >= 0) {
        const cells: number[] = [goal];
        while (cells[0] !== start) cells.unshift(prev[cells[0]]);
        path = cells.map((c) => ({ x: (c % g.cols) * g.cell + g.cell / 2, y: Math.floor(c / g.cols) * g.cell + g.cell / 2 }));
      }
    }
    return path;
  }

  // --- Movimento ---

  /** Tempo real: os barcos andam; a caravana escoltada parte quando o bando chega perto. */
  update(dt: number, view: Phaser.Geom.Rectangle, army: readonly Point[]): TradeNews[] {
    const news = this.move(dt, (sh) => sh.speed * dt);
    for (const b of this.warbands.bands) {
      if (b.kind !== "CARAVAN") continue;
      const near = army.some((p) => distance(p, b.anchor) < 900);
      if (b.waiting && near) {
        b.waiting = false;
        const to = useGameStore.getState().settlements.find((t) => t.id === b.cargo?.to);
        news.push({ text: `A caravana partiu de ${b.name.replace(/^Caravana da Guilda de /, "")}: acompanhem-na até ${to?.name ?? "o destino"}.`, tone: "info" });
      }
      // Mercadores à vista contam como estavam os preços de onde vieram
      if (near && b.materialized && b.cargo && !b.provoked && !this.told.has(b)) {
        this.told.add(b);
        const from = useGameStore.getState().settlements.find((t) => t.id === b.cargo?.from);
        if (from) {
          const age = Math.max(1, Math.round(distance(from, b.anchor) / WORLD.WARBAND.DAY_DISTANCE));
          useGameStore.getState().notePrices(from.id, "CARAVAN", age);
          news.push({ text: `Mercadores na estrada contaram como estavam os preços em ${from.name} (há ${age} dia(s)).`, tone: "info" });
        }
      }
    }
    this.draw(view);
    return news;
  }

  /** Viagem rápida: os barcos andam os mesmos dias. */
  advance(days: number): TradeNews[] {
    return this.move(days, (sh) => sh.speed * (WORLD.WARBAND.DAY_DISTANCE / WORLD.WARBAND.SPEED) * days);
  }

  /** Dia novo no mar: tempestade segura o navio no porto ou o afunda em alto-mar. */
  weatherCheck(day: number): TradeNews[] {
    const news: TradeNews[] = [];
    const geo = geoOf(this.world.geo);
    const s = useGameStore.getState();
    for (const sh of [...this.ships]) {
      const at = this.positionOf(sh);
      const storm = weatherAt(this.world.seed, day, at, geo) === "STORM";
      sh.held = storm && sh.kind === "SHIP";
      if (!sh.held || sh.done < 400 || Math.random() > CARAVAN.STORM_SINK) continue;
      this.ships = this.ships.filter((x) => x !== sh);
      const from = s.settlements.find((t) => t.id === sh.cargo.from);
      news.push({ text: `${sh.name} afundou numa tempestade com ${sh.cargo.qty} de ${GOODS[sh.cargo.good].label.toLowerCase()}${from ? ` de ${from.name}` : ""}.`, tone: "info", quiet: true });
    }
    return news;
  }

  private move(_dtOrDays: number, step: (sh: Ship) => number): TradeNews[] {
    const news: TradeNews[] = [];
    for (const sh of [...this.ships]) {
      if (sh.held) continue;
      sh.done += step(sh);
      if (sh.done < lengthOf(sh.path)) continue;
      this.ships = this.ships.filter((x) => x !== sh);
      useGameStore.getState().caravanArrives(sh.cargo.to, sh.cargo);
    }
    return news;
  }

  /** Onde está cada barco (para o Mapa do Continente). */
  positions(): { x: number; y: number; kind: Ship["kind"] }[] {
    return this.ships.map((sh) => ({ ...this.positionOf(sh), kind: sh.kind }));
  }

  private positionOf(sh: Ship): Point {
    let left = sh.done;
    for (let i = 1; i < sh.path.length; i++) {
      const a = sh.path[i - 1];
      const b = sh.path[i];
      const d = distance(a, b);
      if (left <= d) return { x: a.x + ((b.x - a.x) * left) / Math.max(1, d), y: a.y + ((b.y - a.y) * left) / Math.max(1, d) };
      left -= d;
    }
    return sh.path[sh.path.length - 1];
  }

  /** Barcos à vista: casco, vela e o rastro na água. */
  private draw(view: Phaser.Geom.Rectangle): void {
    const g = this.gfx;
    g.clear();
    for (const sh of this.ships) {
      const p = this.positionOf(sh);
      if (p.x < view.x - 100 || p.y < view.y - 100 || p.x > view.right + 100 || p.y > view.bottom + 100) continue;
      const ahead = this.positionOf({ ...sh, done: sh.done + 40 });
      const a = Math.atan2(ahead.y - p.y, ahead.x - p.x);
      const big = sh.kind === "SHIP" ? 1.6 : 1;
      const c = Math.cos(a);
      const s = Math.sin(a);
      const pt = (x: number, y: number) => ({ x: p.x + (x * c - y * s) * big, y: p.y + (x * s + y * c) * big });
      g.fillStyle(0xffffff, 0.25);
      const w1 = pt(-30, -8);
      const w2 = pt(-30, 8);
      const w3 = pt(-60, 0);
      g.fillTriangle(w1.x, w1.y, w2.x, w2.y, w3.x, w3.y);
      g.fillStyle(0x5a3a1e, 1);
      const h = [pt(22, 0), pt(10, -9), pt(-20, -9), pt(-20, 9), pt(10, 9)] as unknown as Phaser.Math.Vector2[];
      g.fillPoints(h, true);
      g.lineStyle(2, 0x1a1008, 1);
      g.strokePoints(h, true);
      // Vela (os navios têm duas)
      g.fillStyle(sh.held ? 0x9a9a9a : 0xf0e8d8, 1);
      for (const off of sh.kind === "SHIP" ? [6, -10] : [0]) {
        const m1 = pt(off, -13);
        const m2 = pt(off, 13);
        const m3 = pt(off - 9, 0);
        g.fillTriangle(m1.x, m1.y, m2.x, m2.y, m3.x, m3.y);
      }
    }
  }

  // --- Eventos das caravanas (a cena repassa) ---

  /**
   * Chegada, saque por goblins (longe do bando) ou destruição de uma caravana na bolha. Devolve
   * notícias. `byBand` = morreu nas mãos do bando do jogador.
   */
  onEvent(ev: WarbandEvent, nearArmy: (p: Point) => boolean): TradeNews[] {
    const s = useGameStore.getState();
    const news: TradeNews[] = [];
    const name = (id: string) => s.settlements.find((t) => t.id === id)?.name ?? "?";
    const escort = s.activeContract?.contract.kind === "ESCORT" ? s.activeContract.contract : null;
    if (ev.type === "DELIVERED") {
      s.caravanArrives(ev.cargo.to, ev.cargo);
      if (ev.cargo.escort && escort && escort.targetId === ev.cargo.to) {
        s.finishContract(true, `a caravana chegou a ${name(ev.cargo.to)}`);
        news.push({ text: `A caravana escoltada chegou a ${name(ev.cargo.to)}. Contrato cumprido!`, tone: "good" });
      }
      return news;
    }
    if (ev.type === "CARAVAN_RAIDED") {
      const text = `${ev.by.name} saqueou ${ev.band.name} na estrada: ${ev.cargo.qty} de ${GOODS[ev.cargo.good].label.toLowerCase()} não chegaram a ${name(ev.cargo.to)}.`;
      news.push({ text, tone: ev.cargo.own ? "bad" : "info", quiet: !nearArmy(ev.band.anchor) && !ev.cargo.own });
      if (ev.cargo.own) s.ownCaravanLost(ev.cargo.own, ev.by.name);
      if (ev.cargo.escort && escort) s.finishContract(false, "a caravana escoltada foi saqueada");
      if (ev.by.kind === "GOBLIN" && ev.cargo.qty > 0) s.caravanStolen({ bandId: ev.by.id, bandName: ev.by.name, good: ev.cargo.good, qty: ev.cargo.qty, townId: ev.cargo.from });
      useGameStore.getState().markBattlefield(ev.band.anchor.x, ev.band.anchor.y);
      return news;
    }
    if (ev.type !== "DESTROYED") return news;
    const band = ev.band;
    // Goblins com carga roubada abatidos pelo bando: a carga volta
    if (band.loot && band.materialized && nearArmy(band.anchor)) {
      const text = s.recoverCargo(band.id);
      if (text) news.push({ text, tone: "good" });
      return news;
    }
    if (band.kind !== "CARAVAN" || !band.cargo) return news;
    const cargo = band.cargo;
    if (band.provoked) {
      // O bando do jogador destruiu a caravana: a carga é dele (o que couber)
      const text = s.robCaravan({ name: band.name, ownerId: band.ownerId, good: cargo.good, qty: cargo.qty, from: cargo.from });
      news.push({ text, tone: "info" });
      if (cargo.escort && escort) s.finishContract(false, "o próprio bando atacou a caravana");
      return news;
    }
    // Caiu lutando contra goblins na bolha: a carga fica com o bando goblin mais perto
    const raider = this.warbands.bands.find((b) => (b.kind === "GOBLIN" || b.kind === "HORDE") && bandSize(b) > 0 && distance(b.anchor, band.anchor) < 900);
    if (raider?.kind === "GOBLIN" && cargo.qty > 0) {
      raider.loot = { good: cargo.good, qty: cargo.qty, townId: cargo.from };
      s.caravanStolen({ bandId: raider.id, bandName: raider.name, good: cargo.good, qty: cargo.qty, townId: cargo.from });
    }
    news.push({ text: `${band.name} caiu na estrada${raider ? ` diante do ${raider.name}` : ""}.`, tone: cargo.own || cargo.escort ? "bad" : "info" });
    if (cargo.own) s.ownCaravanLost(cargo.own, raider?.name ?? "salteadores");
    if (cargo.escort && escort) s.finishContract(false, "a caravana escoltada foi destruída");
    return news;
  }

  /** Contrato de escolta abandonado ou vencido: a caravana desiste e volta para a cidade. */
  dropEscort(): void {
    for (const b of this.warbands.bands.filter((x) => x.cargo?.escort)) this.warbands.disband(b);
  }

  /** Caravana própria dispensada: some da estrada. */
  dropOwn(ids: ReadonlySet<string>): void {
    for (const b of this.warbands.bands.filter((x) => x.cargo?.own && !ids.has(x.cargo.own))) this.warbands.disband(b);
  }

  /** O nome do reino dono de uma caravana (para o feed quando o bando ataca). */
  realmOf(band: Warband): string {
    const def = this.world.factions.find((f) => f.id === band.ownerId);
    return def ? ofRealm(def.name) : "livre";
  }

  serialize(): { seq: number; ships: ShipSave[] } {
    return { seq: this.seq, ships: this.ships.map(({ held: _held, ...sh }) => ({ ...sh, path: sh.path.map((p) => ({ ...p })) })) };
  }

  restore(data: { seq: number; ships: ShipSave[] } | undefined): void {
    if (!data) return;
    this.seq = data.seq;
    this.ships = data.ships.map((sh) => ({ ...sh, held: false }));
  }
}

/** Para a caravana própria e a escoltada: o melhor bem mesmo com lucro pequeno (sem lucro nenhum, nada). */
function planAnyway(from: Settlement, to: Settlement, days: number): TradePlan | null {
  return bestTrade(from.econ, to.econ, days, CARAVAN.CAPACITY, 1);
}
