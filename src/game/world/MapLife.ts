import Phaser from "phaser";
import type { Settlement } from "../sim/realm";
import type { TownLayout, Rect } from "./townLayout";
import type { TerrainMap } from "./TerrainMap";
import { COLORS } from "../../utils/constants";
import { distance, type Point } from "../../utils/math";

type WalkerKind = "TOWNSFOLK" | "GUARD" | "PEASANT" | "TRAVELER" | "PILGRIM" | "DEER";

interface Walker {
  kind: WalkerKind;
  x: number;
  y: number;
  /** Pontos a seguir (o primeiro é o próximo). */
  path: Point[];
  speed: number;
  /** Parado até este momento (trabalhando, olhando a praça...). */
  waitUntil: number;
  color: number;
  /** Povoado de origem (moradores, guardas, camponeses). */
  townId: string | null;
  field: Rect | null;
  /** Indo embora (para casa, para dentro dos muros): some ao chegar. */
  leaving: boolean;
  /** Estrada e sentido (viajantes). */
  road: Point[] | null;
  roadIndex: number;
  roadDir: 1 | -1;
  /** Bichos: centro do pasto. */
  home: Point;
}

/** O que o mapa vivo precisa saber do mundo a cada quadro. */
export interface MapLifeContext {
  view: Phaser.Geom.Rectangle;
  hour: number;
  darkness: number;
  towns: { settlement: Settlement; layout: TownLayout }[];
  roads: readonly Point[][];
  /** Visível agora pelo bando (névoa). */
  canSee: (p: Point) => boolean;
  /** Onde há bandos hostis (posição de marcha). */
  threats: readonly Point[];
  /** Onde está o bando do jogador (os bichos fogem). */
  army: readonly Point[];
  factionColor: (owner: string) => number;
  terrain: TerrainMap | null;
  /** Fumaça: povoados saqueados há pouco, em ruínas ou ocupados (força 0–1). */
  smoke: { x: number; y: number; strength: number }[];
  /** Corvos sobre campos de batalha recentes. */
  crows: Point[];
  /** Rastros de marcha recentes (com a idade em dias). */
  tracks: { x: number; y: number; dir: number; age: number }[];
}

const FOLK_COLORS = [0xd8c8a8, 0xa88a6a, 0x8a6a4a, 0xc89a7a, 0x9a8a7a, 0xb8a888];
/** Perigo a esta distância do povoado: camponeses correm para dentro dos muros. */
const DANGER_RADIUS = 2600;
const MAX_WALKERS = 140;

/**
 * Mapa vivo (Marco 12): gente e bichos que só existem perto da câmera (baratos, um desenho só
 * por quadro) e os sinais que contam o que está acontecendo antes de o inimigo aparecer.
 * - Moradores andam pelas ruas e entram nas casas; à noite somem quase todos. Guardas ficam
 *   nos portões (nas cidades, também rondam por dentro da muralha). Mais gente quanto maior e
 *   mais próspero o povoado; uma cidade saqueada fica vazia.
 * - Camponeses trabalham nas lavouras e **correm para dentro dos muros quando há perigo perto**.
 * - Viajantes e peregrinos andam pelas estradas (com lanterna à noite) e dão meia-volta diante
 *   de um bando; cervos pastam e fogem de quem chega perto.
 * - Sinais: **fumaça** sobre povoados saqueados ou em ruínas (acima da névoa, visível de longe),
 *   **corvos** sobre campos de batalha recentes e **rastros** de marcha no chão.
 */
export class MapLife {
  private walkers: Walker[] = [];
  private readonly gfx: Phaser.GameObjects.Graphics;
  private readonly signals: Phaser.GameObjects.Graphics;
  private readonly trackGfx: Phaser.GameObjects.Graphics;
  private lastPlanAt = -Infinity;
  private danger = new Set<string>();

  constructor(scene: Phaser.Scene) {
    this.gfx = scene.add.graphics().setDepth(-0.5);
    this.signals = scene.add.graphics().setDepth(17);
    this.trackGfx = scene.add.graphics().setDepth(-5);
  }

  /** Povoados com perigo perto agora (para o HUD e os testes). */
  get endangered(): ReadonlySet<string> {
    return this.danger;
  }

  get count(): number {
    return this.walkers.length;
  }

  destroy(): void {
    this.gfx.destroy();
    this.signals.destroy();
    this.trackGfx.destroy();
    this.walkers = [];
  }

  /** Lanternas à noite (viajantes, guardas, camponeses voltando). */
  lanterns(): Point[] {
    return this.walkers.filter((w) => w.kind === "GUARD" || w.kind === "TRAVELER" || w.kind === "PILGRIM").map((w) => ({ x: w.x, y: w.y }));
  }

  update(time: number, dt: number, ctx: MapLifeContext): void {
    if (time - this.lastPlanAt > 600) {
      this.lastPlanAt = time;
      this.plan(time, ctx);
    }
    this.move(time, dt, ctx);
    this.draw(time, ctx);
  }

  // --- Quem existe perto da câmera ---

  private plan(time: number, ctx: MapLifeContext): void {
    const v = ctx.view;
    const near = new Phaser.Geom.Rectangle(v.x - 900, v.y - 900, v.width + 1800, v.height + 1800);
    const far = new Phaser.Geom.Rectangle(v.x - 2200, v.y - 2200, v.width + 4400, v.height + 4400);
    // Longe da câmera: some (nada é simulado fora da vista)
    this.walkers = this.walkers.filter((w) => far.contains(w.x, w.y));

    const night = ctx.darkness > 0.6;
    this.danger = new Set(ctx.towns.filter((t) => ctx.threats.some((p) => distance(p, t.settlement) < DANGER_RADIUS)).map((t) => t.settlement.id));

    for (const { settlement: t, layout } of ctx.towns) {
      const b = layout.bounds;
      if (!Phaser.Geom.Rectangle.Overlaps(near, new Phaser.Geom.Rectangle(b.x - 900, b.y - 900, b.w + 1800, b.h + 1800))) continue;
      const mine = this.walkers.filter((w) => w.townId === t.id);
      const ruined = t.owner === "RUINED";
      const danger = this.danger.has(t.id);
      // Perigo: quem está fora corre para dentro; moradores entram em casa
      if (danger) {
        for (const w of mine) {
          if (w.kind === "PEASANT" && !w.leaving) this.sendInside(w, layout, true);
          if (w.kind === "TOWNSFOLK" && !w.leaving) this.sendHome(w, layout, true);
        }
      }
      if (ruined || this.walkers.length >= MAX_WALKERS) continue;
      // Moradores: mais gente em cidade grande e próspera; de noite quase ninguém
      const folk = Math.round(Math.min(26, t.population / 32) * (t.prosperity / 100) * (night ? 0.12 : danger ? 0 : 1));
      const haveFolk = mine.filter((w) => w.kind === "TOWNSFOLK" && !w.leaving).length;
      for (let k = haveFolk; k < folk; k++) this.walkers.push(this.townsfolk(t, layout, time));
      for (const w of mine.filter((x) => x.kind === "TOWNSFOLK" && !x.leaving).slice(folk)) this.sendHome(w, layout, false);
      // Guardas: dois por portão, e dois rondando a muralha nas cidades de pedra
      const guards = layout.gates.length * 2 + (layout.wallKind === "STONE" ? 2 : 0);
      for (let k = mine.filter((w) => w.kind === "GUARD").length; k < guards; k++) this.walkers.push(this.guard(t, layout, k, ctx));
      // Camponeses nas lavouras (de dia, sem perigo)
      const peasants = night || danger ? 0 : layout.fields.length * 2;
      const havePeasants = mine.filter((w) => w.kind === "PEASANT" && !w.leaving).length;
      for (let k = havePeasants; k < peasants; k++) {
        const f = layout.fields[k % layout.fields.length];
        if (!f || !ctx.terrain || ctx.terrain.isBlocked(f.x + f.w / 2, f.y + f.h / 2)) continue;
        this.walkers.push(this.peasant(t, f));
      }
      if (night) for (const w of mine.filter((x) => x.kind === "PEASANT" && !x.leaving)) this.sendInside(w, layout, false);
    }

    // Viajantes nas estradas que passam perto da câmera (menos à noite)
    const travelers = this.walkers.filter((w) => w.kind === "TRAVELER" || w.kind === "PILGRIM").length;
    const wantTravelers = night ? 1 : 5;
    for (let k = travelers; k < wantTravelers && this.walkers.length < MAX_WALKERS; k++) {
      const w = this.traveler(near, ctx);
      if (w) this.walkers.push(w);
    }
    // Cervos (de dia), longe do exército e dos povoados
    const deer = this.walkers.filter((w) => w.kind === "DEER").length;
    if (!night && deer < 6 && this.walkers.length < MAX_WALKERS) this.walkers.push(...this.herd(near, ctx));
  }

  private townsfolk(t: Settlement, layout: TownLayout, time: number): Walker {
    const start = layout.houses.length > 0 ? layout.houses[Math.floor(Math.random() * layout.houses.length)].door : layout.market;
    const w = this.walker("TOWNSFOLK", start, 38 + Math.random() * 18, FOLK_COLORS[Math.floor(Math.random() * FOLK_COLORS.length)]);
    w.townId = t.id;
    w.path = this.streetPath(layout, start, this.randomNode(layout));
    w.waitUntil = time + Math.random() * 1500;
    return w;
  }

  private guard(t: Settlement, layout: TownLayout, k: number, ctx: MapLifeContext): Walker {
    const gates = layout.gates;
    const g = gates[Math.floor(k / 2) % gates.length];
    const post = k < gates.length * 2 ? (k % 2 === 0 ? g.outside : g.inside) : layout.nodes[Math.floor(Math.random() * layout.nodes.length)];
    const w = this.walker("GUARD", { x: post.x + (k % 2 ? 40 : -40), y: post.y }, 30, ctx.factionColor(t.owner));
    w.townId = t.id;
    w.home = { x: w.x, y: w.y };
    // Os da muralha fazem a ronda pela rua de dentro
    if (k >= gates.length * 2) w.path = this.streetPath(layout, w, this.randomNode(layout));
    return w;
  }

  private peasant(t: Settlement, f: Rect): Walker {
    const p = { x: f.x + 30 + Math.random() * (f.w - 60), y: f.y + 30 + Math.random() * (f.h - 60) };
    const w = this.walker("PEASANT", p, 34, 0xd8c48a);
    w.townId = t.id;
    w.field = f;
    return w;
  }

  private traveler(area: Phaser.Geom.Rectangle, ctx: MapLifeContext): Walker | null {
    const roads = ctx.roads.filter((r) => r.some((p) => area.contains(p.x, p.y)));
    if (roads.length === 0) return null;
    for (let tries = 0; tries < 6; tries++) {
      const road = roads[Math.floor(Math.random() * roads.length)];
      const i = Math.floor(Math.random() * road.length);
      const p = road[i];
      // Aparece onde ninguém está vendo (nada surge do nada na frente do jogador)
      if (!area.contains(p.x, p.y) || ctx.canSee(p)) continue;
      const pilgrim = Math.random() < 0.25;
      const w = this.walker(pilgrim ? "PILGRIM" : "TRAVELER", p, pilgrim ? 34 : 46, pilgrim ? 0xe8e6dc : 0x8a7a5a);
      w.road = road;
      w.roadIndex = i;
      w.roadDir = Math.random() < 0.5 ? 1 : -1;
      return w;
    }
    return null;
  }

  private herd(area: Phaser.Geom.Rectangle, ctx: MapLifeContext): Walker[] {
    for (let tries = 0; tries < 8; tries++) {
      const p = { x: area.x + Math.random() * area.width, y: area.y + Math.random() * area.height };
      const t = ctx.terrain?.typeAt(p.x, p.y);
      if (t !== "FOREST" && t !== "GRASS" && t !== "HILL") continue;
      if (ctx.canSee(p) || ctx.army.some((a) => distance(a, p) < 900) || ctx.towns.some((x) => distance(x.settlement, p) < 2200)) continue;
      return Array.from({ length: 3 + Math.floor(Math.random() * 3) }, () => {
        const w = this.walker("DEER", { x: p.x + (Math.random() - 0.5) * 120, y: p.y + (Math.random() - 0.5) * 120 }, 40, 0x8b5a2b);
        w.home = p;
        return w;
      });
    }
    return [];
  }

  private walker(kind: WalkerKind, p: Point, speed: number, color: number): Walker {
    return {
      kind,
      x: p.x,
      y: p.y,
      path: [],
      speed,
      waitUntil: 0,
      color,
      townId: null,
      field: null,
      leaving: false,
      road: null,
      roadIndex: 0,
      roadDir: 1,
      home: { x: p.x, y: p.y },
    };
  }

  private sendHome(w: Walker, layout: TownLayout, hurry: boolean): void {
    const door = layout.houses.length > 0 ? layout.houses[Math.floor(Math.random() * layout.houses.length)].door : layout.hall;
    w.path = [...this.streetPath(layout, w, door), door];
    w.leaving = true;
    w.waitUntil = 0;
    if (hurry) w.speed *= 1.9;
  }

  private sendInside(w: Walker, layout: TownLayout, hurry: boolean): void {
    const gate = layout.gates.reduce((best, g) => (distance(g.outside, w) < distance(best.outside, w) ? g : best), layout.gates[0]);
    w.path = [gate.outside, gate.inside];
    w.leaving = true;
    w.waitUntil = 0;
    w.field = null;
    if (hurry) w.speed *= 2.4;
  }

  // --- Ruas: caminho pela grade de ruas da planta ---

  private randomNode(layout: TownLayout): Point {
    return layout.nodes[Math.floor(Math.random() * layout.nodes.length)];
  }

  /** Caminho de `from` até `to` pelas ruas (BFS na grade de cruzamentos da planta). */
  private streetPath(layout: TownLayout, from: Point, to: Point): Point[] {
    const nearestNode = (p: Point) => layout.nodes.reduce((best, n, k) => (distance(n, p) < distance(layout.nodes[best], p) ? k : best), 0);
    const a = nearestNode(from);
    const b = nearestNode(to);
    const prev = new Map<number, number>([[a, -1]]);
    const queue = [a];
    while (queue.length) {
      const u = queue.shift() as number;
      if (u === b) break;
      for (const [x, y] of layout.edges) {
        const v = x === u ? y : y === u ? x : -1;
        if (v < 0 || prev.has(v)) continue;
        prev.set(v, u);
        queue.push(v);
      }
    }
    const path: Point[] = [];
    for (let v = b; v !== -1 && prev.has(v); v = prev.get(v) as number) path.unshift(layout.nodes[v]);
    return path;
  }

  // --- Movimento ---

  private move(time: number, dt: number, ctx: MapLifeContext): void {
    const night = ctx.darkness > 0.6;
    const out: Walker[] = [];
    for (const w of this.walkers) {
      let keep = true;
      if (w.kind === "DEER") {
        // Foge de quem chega perto; senão pasta em volta do ponto
        const threat = [...ctx.army, ...ctx.threats].find((p) => distance(p, w) < 380);
        if (threat) {
          const a = Math.atan2(w.y - threat.y, w.x - threat.x);
          w.path = [{ x: w.x + Math.cos(a) * 260, y: w.y + Math.sin(a) * 260 }];
          w.speed = 170;
        } else if (w.path.length === 0 && time > w.waitUntil) {
          w.speed = 40;
          w.path = [{ x: w.home.x + (Math.random() - 0.5) * 500, y: w.home.y + (Math.random() - 0.5) * 400 }];
          w.waitUntil = time + 2000 + Math.random() * 5000;
        }
      } else if (w.kind === "TRAVELER" || w.kind === "PILGRIM") {
        // Bando hostil adiante: dá meia-volta
        if (ctx.threats.some((p) => distance(p, w) < 900)) w.roadDir = (w.roadDir * -1) as 1 | -1;
        if (w.path.length === 0 && w.road) {
          const next = w.roadIndex + w.roadDir;
          if (next < 0 || next >= w.road.length) keep = false;
          else {
            w.roadIndex = next;
            w.path = [w.road[next]];
          }
        }
      } else if (w.kind === "PEASANT" && !w.leaving && w.field && w.path.length === 0 && time > w.waitUntil) {
        const f = w.field;
        w.path = [{ x: f.x + 30 + Math.random() * (f.w - 60), y: f.y + 30 + Math.random() * (f.h - 60) }];
        w.waitUntil = time + 3000 + Math.random() * 4000;
      } else if (w.kind === "TOWNSFOLK" && !w.leaving && w.path.length === 0 && time > w.waitUntil) {
        const t = ctx.towns.find((x) => x.settlement.id === w.townId);
        if (t) {
          // Volta e meia, alguém vai à praça do mercado
          const to = Math.random() < 0.35 ? t.layout.market : this.randomNode(t.layout);
          w.path = this.streetPath(t.layout, w, to);
          if (to === t.layout.market) w.path.push({ x: to.x + (Math.random() - 0.5) * 200, y: to.y + (Math.random() - 0.5) * 160 });
          w.waitUntil = time + 1500 + Math.random() * 4000;
        }
      } else if (w.kind === "GUARD" && w.path.length === 0 && time > w.waitUntil) {
        const t = ctx.towns.find((x) => x.settlement.id === w.townId);
        if (t && distance(w, w.home) > 200) {
          // Ronda: de cruzamento em cruzamento
          w.path = this.streetPath(t.layout, w, this.randomNode(t.layout));
        }
        w.waitUntil = time + 4000 + Math.random() * 4000;
      }
      // Anda até o próximo ponto
      const target = w.path[0];
      if (target) {
        const d = distance(w, target);
        const speed = w.speed * (night ? 0.8 : 1);
        if (d <= speed * dt + 1) {
          w.x = target.x;
          w.y = target.y;
          w.path.shift();
          if (w.path.length === 0 && w.leaving) keep = false;
        } else {
          w.x += ((target.x - w.x) / d) * speed * dt;
          w.y += ((target.y - w.y) / d) * speed * dt;
        }
      }
      if (keep) out.push(w);
    }
    this.walkers = out;
  }

  // --- Desenho ---

  private draw(time: number, ctx: MapLifeContext): void {
    const g = this.gfx;
    g.clear();
    for (const w of this.walkers) {
      if (!ctx.canSee(w)) continue;
      switch (w.kind) {
        case "GUARD":
          g.fillStyle(w.color, 1);
          g.fillRect(w.x - 5, w.y - 5, 10, 10);
          g.lineStyle(2, COLORS.OUTLINE, 1);
          g.strokeRect(w.x - 5, w.y - 5, 10, 10);
          g.lineStyle(2, 0xd8d8d8, 1);
          g.lineBetween(w.x + 6, w.y - 9, w.x + 6, w.y + 7); // lança
          break;
        case "DEER":
          g.fillStyle(w.color, 1);
          g.fillEllipse(w.x, w.y, 16, 9);
          g.fillCircle(w.x + 8, w.y - 3, 3.5);
          break;
        default: {
          const r = w.kind === "TRAVELER" ? 6 : 5;
          g.fillStyle(w.color, 1);
          g.fillCircle(w.x, w.y, r);
          g.lineStyle(1.5, COLORS.OUTLINE, 0.9);
          g.strokeCircle(w.x, w.y, r);
          if (w.kind === "TRAVELER" || w.kind === "PILGRIM") {
            g.lineStyle(2, 0x5a3d1e, 1);
            g.lineBetween(w.x + 6, w.y - 8, w.x + 6, w.y + 6); // cajado
          } else if (w.kind === "PEASANT" && w.path.length === 0) {
            g.lineStyle(2, 0x5a3d1e, 1);
            const swing = Math.sin(time / 260 + w.x) * 4;
            g.lineBetween(w.x, w.y, w.x + 7, w.y + 6 + swing); // enxada
          }
        }
      }
    }
    this.drawSignals(time, ctx);
  }

  private drawSignals(time: number, ctx: MapLifeContext): void {
    const s = this.signals;
    s.clear();
    const v = ctx.view;
    // Fumaça: colunas altas acima da névoa. Povoado fora da tela, mas a até HORIZON px: a fumaça
    // aparece na borda da tela, na direção dele (um rolo no horizonte) — vê-se de longe
    const HORIZON = 7000;
    const cx = v.centerX;
    const cy = v.centerY;
    for (const src of ctx.smoke) {
      const inView = src.x > v.x - 300 && src.x < v.right + 300 && src.y > v.y - 300 && src.y < v.bottom + 1800;
      const d = Math.hypot(src.x - cx, src.y - cy);
      if (!inView && d > HORIZON) continue;
      // Fora da tela: a coluna nasce na borda, mais fraca quanto mais longe
      // (a base fica um pouco para dentro da borda de cima: a coluna sobe e precisa caber na tela)
      const base = inView ? src : { x: Math.max(v.x + 60, Math.min(v.right - 60, src.x)), y: Math.max(v.y + v.height * 0.32, Math.min(v.bottom - 30, src.y)) };
      const fade = inView ? 1 : Math.max(0.25, 1 - d / HORIZON);
      const scale = inView ? 1 : 0.6;
      const puffs = 12;
      for (let k = 0; k < puffs; k++) {
        const t = (time / 3200 + k / puffs) % 1;
        const h = t * 1800 * (0.6 + src.strength * 0.4) * scale;
        const drift = Math.sin(time / 1700 + k) * 60 + t * 220 * scale;
        const r = (40 + t * 160) * scale;
        s.fillStyle(0x2a2a2a, (1 - t) * 0.45 * src.strength * fade);
        s.fillCircle(base.x + drift, base.y - h, r);
      }
    }
    // Corvos circulando sobre campos de batalha e povoados destruídos
    for (const p of ctx.crows) {
      if (p.x < v.x - 600 || p.x > v.right + 600 || p.y < v.y - 600 || p.y > v.bottom + 600) continue;
      s.lineStyle(3, 0x0b0b0b, 0.9);
      for (let k = 0; k < 7; k++) {
        const a = time / (1400 + k * 90) + k * 0.9;
        const r = 70 + (k % 3) * 40;
        const cx = p.x + Math.cos(a) * r;
        const cy = p.y - 120 + Math.sin(a) * r * 0.5;
        const flap = Math.sin(time / 120 + k) * 4;
        s.lineBetween(cx - 9, cy - flap, cx, cy + 3);
        s.lineBetween(cx, cy + 3, cx + 9, cy - flap);
      }
    }
    // Rastros de marcha (pegadas que se apagam com o tempo)
    const tg = this.trackGfx;
    tg.clear();
    for (const p of ctx.tracks) {
      if (!v.contains(p.x, p.y)) continue;
      const alpha = Math.max(0, 0.55 * (1 - p.age / 1.5));
      if (alpha <= 0.02) continue;
      tg.fillStyle(0x3b2a17, alpha);
      const cx = Math.cos(p.dir);
      const cy = Math.sin(p.dir);
      for (let k = -2; k <= 2; k++) {
        const along = k * 40;
        for (const side of [-1, 1]) {
          tg.fillEllipse(p.x + cx * along - cy * side * 14, p.y + cy * along + cx * side * 14, 7, 4);
        }
      }
    }
  }
}
