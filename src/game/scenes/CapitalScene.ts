import Phaser from "phaser";
import { courtChoice, courtName, gateTalk, nobleTalk } from "../data/courtTalk";
import { townGossip, type Talk } from "../data/interiors";
import { registerDialogHandler } from "../interiorBridge";
import { hasCourtEvent } from "../sim/courtEvents";
import { COURT_EVENT_LABEL } from "../sim/kingdoms";
import { scheduleOf, type CourtPlace } from "../sim/nobility";
import { STANDING_LABEL, standingIn, type AccessPlace } from "../sim/reputation";
import { useGameStore, type CampPanel, type GameState } from "../../store/useGameStore";
import { COLORS, COURT, TIME, WORLD } from "../../utils/constants";
import { darknessAt, daysUntilHour, hourOf } from "../../utils/time";
import { distance, type Point } from "../../utils/math";
import { NightLayer, type Light } from "../world/NightLayer";
import { CAPITAL_H, CAPITAL_W, capitalLayout, cityPath, districtAt, zoneAt, type CapitalLayout, type CityDoor, type CityGate, type CityZone } from "../world/capitalLayout";
import { paintCapitalChunk } from "../world/capitalPaint";
import { createRng, seedFromText } from "../worldgen/rng";
import type { WorldScene } from "./WorldScene";

export interface CapitalData {
  townId: string;
}

interface Walker {
  x: number;
  y: number;
  path: Point[];
  speed: number;
  color: number;
  zone: CityZone;
  wait: number;
  /** Cada um anda no seu lado da rua. */
  lane: Point;
}

interface Guard extends Walker {
  /** Posto fixo num portão (senão faz ronda pelas ruas). */
  post: boolean;
}

interface NobleView {
  id: string;
  name: string;
  x: number;
  y: number;
  tx: number;
  ty: number;
  gfx: Phaser.GameObjects.Graphics;
  label: Phaser.GameObjects.Text;
}

type Near = { kind: "NOBLE"; v: NobleView } | { kind: "DOOR"; door: CityDoor } | { kind: "GATE"; gate: CityGate } | { kind: "FOLK"; w: Walker } | null;

const CHUNK = 1200;
const TEX = 900;
const RADIUS = 14;
const WALK = 230;
const RUN = 340;
const CELL = 300;
const FOLK = [0xd8c8a8, 0xa88a6a, 0x8a6a4a, 0xc89a7a, 0x9a8a7a, 0xb8a888, 0x8a7a9a, 0x7a9a8a];

/** O que o sargento diz a quem chega pela primeira vez: o lugar do Comandante e os portões. */
function firstVisit(s: GameState, townId: string): string {
  const t = s.settlements.find((x) => x.id === townId);
  if (t?.owner === "PLAYER") return "Bem-vindo, senhor. A cidade é sua: todas as portas estão abertas.";
  const st = standingIn(s, t?.owner ?? "");
  const noble = s.access("NOBLE", townId).open;
  const castle = s.access("CASTLE", townId).open;
  const next = noble ? (castle ? "O Camareiro-mor marca audiência no pátio do castelo." : "O castelo só baixa a ponte para quem é Respeitado (Fama 35 ou relação 40).") : "O Bairro Nobre só abre para quem é Conhecido (Fama 15 ou relação 15).";
  return `Bem-vindo a ${t?.name}. Aqui o senhor é ${STANDING_LABEL[st]}. ${next} Quem não tem nome, tem ouro, ou amigos, ou coragem. Mas a guarda não dorme.`;
}

/**
 * A Cidade Alta (Marco 15): um mapa inteiro atrás da muralha interna de uma capital. O mundo lá
 * fora dorme na tela, mas o tempo corre: a corte tem rotina, os nobres mudam de lugar conforme a
 * hora e o Comandante precisa de nome (ou de ouro, ou de coragem) para passar de cada portão.
 */
export class CapitalScene extends Phaser.Scene {
  private layout!: CapitalLayout;
  private townId = "";
  private owner = "";
  private pos: Point = { x: 0, y: 0 };
  private facing = -Math.PI / 2;
  private commander!: Phaser.GameObjects.Graphics;
  private crowd!: Phaser.GameObjects.Graphics;
  private gateGfx!: Phaser.GameObjects.Graphics;
  private night!: NightLayer;
  private keys!: Record<string, Phaser.Input.Keyboard.Key>;
  private cells = new Map<number, Phaser.Geom.Rectangle[]>();
  private doorCells = new Map<number, CityDoor[]>();
  private doors: CityDoor[] = [];
  private loaded = new Map<number, { image: Phaser.GameObjects.Image; key: string }>();
  private readonly prefix = `cidade-${Math.random().toString(36).slice(2, 8)}`;
  private walkers: Walker[] = [];
  private guards: Guard[] = [];
  private nobles = new Map<string, NobleView>();
  private near: Near = null;
  private leaving = false;
  private clock = 0;
  private lastFlush = 0;
  private lastSlow = 0;
  private push = 0;
  /** Guardas no encalço (até este momento). */
  private chaseUntil = 0;
  /** Depois de um "Alto!", os guardas dão um tempo. */
  private graceUntil = 0;
  private openGates = new Set<AccessPlace>();

  constructor() {
    super("CapitalScene");
  }

  init(data: CapitalData): void {
    this.townId = data.townId;
    this.walkers = [];
    this.guards = [];
    this.nobles = new Map();
    this.near = null;
    this.leaving = false;
    this.clock = 0;
    this.push = 0;
    this.chaseUntil = 0;
    this.graceUntil = 0;
    this.openGates = new Set();
    this.loaded = new Map();
    this.cells = new Map();
    this.doorCells = new Map();
  }

  create(): void {
    const store = useGameStore.getState();
    const t = store.settlements.find((x) => x.id === this.townId);
    if (!t) {
      this.leave();
      return;
    }
    this.owner = t.owner;
    this.layout = capitalLayout(this.townId);
    const l = this.layout;
    this.cameras.main.setBackgroundColor(0x1a1a14).setBounds(0, 0, CAPITAL_W, CAPITAL_H);
    for (const s of l.solids) this.addSolid(new Phaser.Geom.Rectangle(s.x, s.y, s.w, s.h));
    this.doors = [...l.doors, ...this.palaceDoors()];
    for (const d of this.doors) this.addDoor(d);
    this.pos = { ...l.spawn };
    this.crowd = this.add.graphics().setDepth(4);
    this.gateGfx = this.add.graphics().setDepth(3);
    this.commander = this.add.graphics().setDepth(6);
    this.drawCommander();
    this.night = new NightLayer(this);
    this.spawnGuards();
    this.updateGates(true);
    this.refreshNobles();

    const cam = this.cameras.main;
    cam.setZoom(0.85);
    cam.startFollow(this.commander, true, 0.14, 0.14);
    cam.centerOn(this.pos.x, this.pos.y);
    cam.fadeIn(260, 0, 0, 0);

    const keyboard = this.input.keyboard;
    if (!keyboard) throw new Error("Teclado indisponível");
    this.keys = keyboard.addKeys("W,A,S,D,E,ESC,SHIFT,ONE,TWO,THREE,FOUR,FIVE,SIX,SEVEN,EIGHT,NINE,UP,DOWN,LEFT,RIGHT") as Record<string, Phaser.Input.Keyboard.Key>;
    this.keys.E.on("down", () => this.interact());
    this.keys.ESC.on("down", () => {
      const s = useGameStore.getState();
      if (s.dialog) s.setDialog(null);
      else if (s.campPanel) s.setCampPanel(null);
    });
    ["ONE", "TWO", "THREE", "FOUR", "FIVE", "SIX", "SEVEN", "EIGHT", "NINE"].forEach((k, i) => this.keys[k].on("down", () => this.chooseKey(i)));
    const unregister = registerDialogHandler((id) => this.onChoice(id));
    store.setCity({ townId: this.townId, name: t.name, factionId: t.owner, district: districtAt(l, this.pos).name, x: this.pos.x, y: this.pos.y });
    store.notePrices(this.townId, "VISIT");
    // Na primeira vez, o sargento do portão explica quem manda aqui (e o que o Comandante é)
    const seen = `seen:${this.townId}`;
    if (store.passes[seen] === undefined) {
      useGameStore.setState({ passes: { ...store.passes, [seen]: store.day } });
      this.say("Sargento do Portão Velho", { text: firstVisit(store, this.townId) });
    }
    this.events.on(Phaser.Scenes.Events.WAKE, this.onWake, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.events.off(Phaser.Scenes.Events.WAKE, this.onWake, this);
      unregister();
      for (const [i, c] of this.loaded) this.unload(i, c);
      this.night.destroy();
      useGameStore.getState().setCity(null);
    });
    if (import.meta.env.DEV) (window as unknown as { __capital?: CapitalScene }).__capital = this;
  }

  private chooseKey(i: number): void {
    const d = useGameStore.getState().dialog;
    if (d && d.options[i]) this.onChoice(d.options[i].id);
  }

  /** Portas dos palácios: cada lorde do reino tem o seu (na ordem da lista de palácios). */
  private palaceDoors(): CityDoor[] {
    const s = useGameStore.getState();
    const lords = s.nobles.filter((n) => n.alive && n.rank === "LORD" && (n.factionId === this.owner || n.at === this.townId));
    return this.layout.palaces.map((b, i) => ({ x: b.door.x, y: b.door.y, label: lords[i] ? `Palácio da ${lords[i].house}` : "Palácio fechado", enter: `palace:${i}`, radius: 70 }));
  }

  private cellKey = (cx: number, cy: number) => cy * 1000 + cx;

  private addSolid(r: Phaser.Geom.Rectangle): void {
    for (let cy = Math.floor(r.y / CELL); cy <= Math.floor(r.bottom / CELL); cy++) {
      for (let cx = Math.floor(r.x / CELL); cx <= Math.floor(r.right / CELL); cx++) {
        const k = this.cellKey(cx, cy);
        const list = this.cells.get(k) ?? [];
        list.push(r);
        this.cells.set(k, list);
      }
    }
  }

  private addDoor(d: CityDoor): void {
    const k = this.cellKey(Math.floor(d.x / CELL), Math.floor(d.y / CELL));
    const list = this.doorCells.get(k) ?? [];
    list.push(d);
    this.doorCells.set(k, list);
  }

  private blocked(p: Point, r: number): boolean {
    const cx = Math.floor(p.x / CELL);
    const cy = Math.floor(p.y / CELL);
    for (let y = cy - 1; y <= cy + 1; y++) {
      for (let x = cx - 1; x <= cx + 1; x++) {
        for (const s of this.cells.get(this.cellKey(x, y)) ?? []) if (p.x + r > s.x && p.x - r < s.right && p.y + r > s.y && p.y - r < s.bottom) return true;
      }
    }
    for (const g of this.layout.gates) {
      if (this.openGates.has(g.place)) continue;
      const q = g.rect;
      if (p.x + r > q.x && p.x - r < q.x + q.w && p.y + r > q.y && p.y - r < q.y + q.h) return true;
    }
    return false;
  }

  // --- Quadro a quadro ---

  update(time: number, delta: number): void {
    if (!this.layout || this.leaving) return;
    const dt = Math.min(delta, 50) / 1000;
    const s = useGameStore.getState();
    this.streamChunks();
    const busy = s.dialog !== null || s.campPanel !== null || s.campEvent !== null || s.duel !== null;
    if (!busy) {
      this.move(dt);
      this.clock += dt / WORLD.DAY_SECONDS;
    }
    this.updateFolk(dt, busy);
    this.updateGuards(dt, time, busy);
    this.updateNobleViews(dt);
    this.updateNear();
    this.drawCrowd();
    this.night.update(this.cameras.main, darknessAt(s.dayProgress), this.nightLights());
    if (time - this.lastSlow > 500) {
      this.lastSlow = time;
      this.updateGates(false);
      this.refreshNobles();
      this.spawnFolk();
      const name = districtAt(this.layout, this.pos).name;
      if (s.city) s.setCity({ ...s.city, district: name, x: this.pos.x, y: this.pos.y });
      this.checkWelcome(s.day);
    }
    if (this.clock > 0 && time - this.lastFlush > 500) {
      this.lastFlush = time;
      this.world().advanceAbroad(this.clock);
      this.clock = 0;
    }
  }

  private world(): WorldScene {
    return this.scene.get("WorldScene") as WorldScene;
  }

  /** Guerra declarada ou mandado novo: os guardas põem o Comandante para fora. */
  private checkWelcome(_day: number): void {
    const s = useGameStore.getState();
    const c = s.access("CITY", this.townId);
    if (c.open || s.disguiseUntil > s.day + s.dayProgress || s.dialog) return;
    this.say("Sargento da guarda", { text: `${c.why} O senhor será escoltado até o portão, e agradeça por sair com a cabeça.`, options: [{ id: "cityout", label: "Sair" }] });
  }

  private streamChunks(): void {
    const v = this.cameras.main.worldView;
    const cols = Math.ceil(CAPITAL_W / CHUNK);
    const rows = Math.ceil(CAPITAL_H / CHUNK);
    const c0 = Math.max(0, Math.floor(v.x / CHUNK) - 1);
    const c1 = Math.min(cols - 1, Math.floor(v.right / CHUNK) + 1);
    const r0 = Math.max(0, Math.floor(v.y / CHUNK) - 1);
    const r1 = Math.min(rows - 1, Math.floor(v.bottom / CHUNK) + 1);
    let budget = 2;
    for (let r = r0; r <= r1; r++) {
      for (let c = c0; c <= c1; c++) {
        const i = r * cols + c;
        if (this.loaded.has(i)) continue;
        const visible = c * CHUNK < v.right && (c + 1) * CHUNK > v.x && r * CHUNK < v.bottom && (r + 1) * CHUNK > v.y;
        if (!visible && budget <= 0) continue;
        if (!visible) budget--;
        this.loadChunk(c, r, i);
      }
    }
    for (const [i, ch] of this.loaded) {
      const c = i % cols;
      const r = Math.floor(i / cols);
      if (c < c0 - 1 || c > c1 + 1 || r < r0 - 1 || r > r1 + 1) this.unload(i, ch);
    }
  }

  private loadChunk(c: number, r: number, index: number): void {
    const canvas = document.createElement("canvas");
    canvas.width = TEX;
    canvas.height = TEX;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const def = useGameStore.getState().world?.factions.find((f) => f.id === this.owner);
    paintCapitalChunk(ctx, this.layout, c * CHUNK, r * CHUNK, CHUNK, TEX, this.owner === "PLAYER" ? COLORS.ALLY : (def?.color ?? 0xc0a040));
    const key = `${this.prefix}-${c}-${r}`;
    if (this.textures.exists(key)) this.textures.remove(key);
    this.textures.addCanvas(key, canvas);
    const image = this.add.image(c * CHUNK, r * CHUNK, key).setOrigin(0, 0).setScale(CHUNK / TEX).setDepth(0);
    this.loaded.set(index, { image, key });
  }

  private unload(index: number, ch: { image: Phaser.GameObjects.Image; key: string }): void {
    ch.image.destroy();
    if (this.textures.exists(ch.key)) this.textures.remove(ch.key);
    this.loaded.delete(index);
  }

  private drawCommander(): void {
    const g = this.commander;
    g.clear();
    const disguised = useGameStore.getState().disguiseUntil > useGameStore.getState().day + useGameStore.getState().dayProgress;
    g.fillStyle(disguised ? 0x8a7a6a : COLORS.ALLY, 1);
    g.fillCircle(0, 0, RADIUS);
    g.lineStyle(3, disguised ? 0x4a3a2a : COLORS.COMMANDER_OUTLINE, 1);
    g.strokeCircle(0, 0, RADIUS);
    g.fillStyle(COLORS.COMMANDER_OUTLINE, 1);
    g.fillTriangle(RADIUS + 6, 0, RADIUS - 2, -5, RADIUS - 2, 5);
    g.setPosition(this.pos.x, this.pos.y);
    g.setRotation(this.facing);
  }

  private move(dt: number): void {
    const k = this.keys;
    let vx = 0;
    let vy = 0;
    if (k.A.isDown || k.LEFT.isDown) vx -= 1;
    if (k.D.isDown || k.RIGHT.isDown) vx += 1;
    if (k.W.isDown || k.UP.isDown) vy -= 1;
    if (k.S.isDown || k.DOWN.isDown) vy += 1;
    if (vx === 0 && vy === 0) {
      this.push = 0;
      return;
    }
    const len = Math.hypot(vx, vy);
    const step = (k.SHIFT.isDown ? RUN : WALK) * dt;
    const nx = { x: this.pos.x + (vx / len) * step, y: this.pos.y };
    const bx = this.blocked(nx, RADIUS);
    if (!bx) this.pos.x = nx.x;
    const ny = { x: this.pos.x, y: this.pos.y + (vy / len) * step };
    const by = this.blocked(ny, RADIUS);
    if (!by) this.pos.y = ny.y;
    this.facing = Math.atan2(vy, vx);
    this.commander.setPosition(this.pos.x, this.pos.y).setRotation(this.facing);
    // Pisou no Portão Velho: sai da Cidade Alta
    if (this.pos.y > CAPITAL_H - 60) {
      this.leave();
      return;
    }
    // Andar de encontro a uma porta entra; a um portão fechado, chama o guarda
    if ((bx || by) && this.near) {
      this.push += dt;
      if (this.push > 0.25) {
        this.push = 0;
        if (this.near.kind === "GATE" || (this.near.kind === "DOOR" && this.near.door.enter)) this.interact();
      }
    } else this.push = 0;
  }

  // --- Gente ---

  private spawnGuards(): void {
    const l = this.layout;
    for (const g of l.gates) {
      for (const dx of [-70, 70]) this.guards.push({ x: g.post.x + dx, y: g.post.y, path: [], speed: 0, color: 0x7f8c8d, zone: "COMMON", wait: 0, post: true, lane: { x: 0, y: 0 } });
    }
    const zones: [CityZone, number][] = [["COMMON", 8], ["NOBLE", 3], ["CASTLE", 4]];
    for (const [zone, n] of zones) {
      const nodes = l.nodes.filter((p) => p.zone === zone);
      for (let i = 0; i < n && nodes.length > 0; i++) {
        const p = nodes[Math.floor(Math.random() * nodes.length)];
        this.guards.push({ x: p.x, y: p.y, path: [], speed: 90, color: 0x95a5a6, zone, wait: 0, post: false, lane: { x: (Math.random() - 0.5) * 80, y: (Math.random() - 0.5) * 80 } });
      }
    }
  }

  private spawnFolk(): void {
    const s = useGameStore.getState();
    const t = s.settlements.find((x) => x.id === this.townId);
    const h = hourOf(s.dayProgress);
    const hours = h >= 7 && h < 19 ? 1 : h >= 19 && h < 22 ? 0.4 : 0.08;
    const party = hasCourtEvent(s.courtEvents, this.townId, "TOURNAMENT", s.day) || hasCourtEvent(s.courtEvents, this.townId, "WEDDING", s.day) ? 1.3 : 1;
    const want = Math.round(100 * ((t?.prosperity ?? 50) / 100) * hours * party);
    this.walkers = this.walkers.filter((w) => distance(w, this.pos) < 1900);
    // Ao chegar a rua já está cheia; depois, gente nova só aparece fora da vista
    const v = this.cameras.main.worldView;
    const first = this.walkers.length === 0;
    const near = this.layout.nodes.filter((p) => p.zone === "COMMON" && distance(p, this.pos) < 1500 && (first || !Phaser.Geom.Rectangle.Contains(v, p.x, p.y)));
    const count = this.walkers.length;
    for (let i = count; i < want && near.length > 0 && i < count + (first ? want : 8); i++) {
      const p = near[Math.floor(Math.random() * near.length)];
      const lane = { x: (Math.random() - 0.5) * 110, y: (Math.random() - 0.5) * 110 };
      this.walkers.push({ x: p.x + lane.x, y: p.y + lane.y, path: [], speed: 45 + Math.random() * 35, color: FOLK[Math.floor(Math.random() * FOLK.length)], zone: "COMMON", wait: Math.random() * 3, lane });
    }
  }

  private walk(w: Walker, dt: number): void {
    if (w.path.length === 0) {
      w.wait -= dt;
      if (w.wait > 0) return;
      const nodes = this.layout.nodes.filter((p) => p.zone === w.zone);
      const to = nodes[Math.floor(Math.random() * nodes.length)];
      if (!to) return;
      w.path = cityPath(this.layout, w, to, w.zone)
        .slice(0, 8)
        .map((p) => ({ x: p.x + w.lane.x, y: p.y + w.lane.y }));
      w.wait = 1 + Math.random() * 4;
      return;
    }
    const p = w.path[0];
    const d = distance(w, p);
    const step = w.speed * dt;
    if (d <= step) {
      w.x = p.x;
      w.y = p.y;
      w.path.shift();
    } else {
      w.x += ((p.x - w.x) / d) * step;
      w.y += ((p.y - w.y) / d) * step;
    }
  }

  private updateFolk(dt: number, busy: boolean): void {
    if (busy) return;
    for (const w of this.walkers) this.walk(w, dt);
  }

  /** Está num lugar que não devia? (Bairro Nobre ou castelo sem o portão aberto) */
  private trespassing(): boolean {
    const zone = zoneAt(this.layout, this.pos);
    if (zone === "COMMON") return false;
    return !this.openGates.has(zone === "NOBLE" ? "NOBLE" : "CASTLE");
  }

  private updateGuards(dt: number, time: number, busy: boolean): void {
    if (busy) return;
    const s = useGameStore.getState();
    const dark = darknessAt(s.dayProgress);
    const disguised = s.disguiseUntil > s.day + s.dayProgress;
    const sneaking = this.trespassing();
    const sight = (dark > 0.5 ? 150 : 300) * (disguised ? 0.5 : 1);
    for (const g of this.guards) {
      if (time < this.chaseUntil && !g.post) {
        const d = distance(g, this.pos);
        if (d < 40) {
          this.chaseUntil = 0;
          this.seized("foi pego fugindo da guarda");
          return;
        }
        if (d < 900) {
          g.x += ((this.pos.x - g.x) / d) * 270 * dt;
          g.y += ((this.pos.y - g.y) / d) * 270 * dt;
          continue;
        }
      }
      if (!g.post) this.walk(g, dt);
      if (sneaking && time > this.graceUntil && time > this.chaseUntil && distance(g, this.pos) < sight) {
        this.halt();
        return;
      }
    }
  }

  /** "Alto!": pego onde não devia. Dá para pagar, se entregar ou correr. */
  private halt(): void {
    this.graceUntil = this.time.now + 12000;
    const s = useGameStore.getState();
    this.say("Guarda", {
      text: "Alto lá! O que o senhor faz aqui sem licença?",
      options: [
        ...(s.gold >= 60 ? [{ id: "caught:BRIBE", label: "Pagar para ele olhar para o outro lado (60 de ouro)" }] : []),
        { id: "caught:RUN", label: "Sair correndo (Shift corre mais)" },
        { id: "caught:GIVEUP", label: "Entregar-se" },
      ],
    });
  }

  private seized(why: string): void {
    const s = useGameStore.getState();
    const text = s.arrest(this.owner, why);
    this.world().advanceAbroad(COURT.JAIL_DAYS);
    this.pos = { ...this.layout.spawn };
    this.commander.setPosition(this.pos.x, this.pos.y);
    this.cameras.main.centerOn(this.pos.x, this.pos.y);
    this.updateGates(true);
    this.say("Sargento da guarda", { text: `${text} Solto na manhã do terceiro dia, diante do Portão Velho.` });
  }

  private refreshNobles(): void {
    const s = useGameStore.getState();
    const h = hourOf(s.dayProgress);
    const feast = hasCourtEvent(s.courtEvents, this.townId, "FEAST", s.day);
    const wanted = new Map<string, Point>();
    for (const n of s.nobles) {
      if (!n.alive || n.at !== this.townId || n.armyId || n.captiveOf) continue;
      const place = scheduleOf(n, h, s.day, feast) as CourtPlace;
      const spot = this.layout.hotspots[place];
      if (!spot) continue;
      const r = createRng(seedFromText(n.id));
      wanted.set(n.id, { x: spot.x + r.range(-120, 120), y: spot.y + r.range(-40, 90) });
    }
    for (const [id, v] of this.nobles) {
      if (wanted.has(id)) continue;
      v.gfx.destroy();
      v.label.destroy();
      this.nobles.delete(id);
    }
    for (const [id, p] of wanted) {
      const v = this.nobles.get(id);
      if (v) {
        v.tx = p.x;
        v.ty = p.y;
        continue;
      }
      const n = s.nobles.find((x) => x.id === id);
      if (!n) continue;
      const gfx = this.add.graphics().setDepth(5);
      gfx.fillStyle(n.female ? 0xd080b0 : 0x8080d0, 1);
      gfx.fillCircle(0, 0, 12);
      gfx.lineStyle(2, 0xe0b040, 1);
      gfx.strokeCircle(0, 0, 12);
      if (n.rank === "RULER" || n.rank === "CONSORT") {
        gfx.fillStyle(0xe0b040, 1);
        gfx.fillTriangle(-9, -13, -3, -20, 0, -13);
        gfx.fillTriangle(9, -13, 3, -20, 0, -13);
      }
      gfx.setPosition(p.x, p.y);
      const name = courtName(s, n);
      const label = this.add.text(p.x, p.y - 26, name, { fontFamily: "monospace", fontSize: "12px", color: "#ffe9b0", stroke: "#000000", strokeThickness: 3 }).setOrigin(0.5).setDepth(8);
      this.nobles.set(id, { id, name, x: p.x, y: p.y, tx: p.x, ty: p.y, gfx, label });
    }
  }

  private updateNobleViews(dt: number): void {
    for (const v of this.nobles.values()) {
      const d = distance(v, { x: v.tx, y: v.ty });
      if (d > 1) {
        const step = Math.min(d, 60 * dt);
        v.x += ((v.tx - v.x) / d) * step;
        v.y += ((v.ty - v.y) / d) * step;
      }
      v.gfx.setPosition(v.x, v.y);
      v.label.setPosition(v.x, v.y - 26).setAlpha(distance(v, this.pos) < 340 ? 1 : 0);
    }
  }

  private drawCrowd(): void {
    const g = this.crowd;
    g.clear();
    const v = this.cameras.main.worldView;
    const inView = (p: Point) => p.x > v.x - 20 && p.x < v.right + 20 && p.y > v.y - 20 && p.y < v.bottom + 20;
    for (const w of this.walkers) {
      if (!inView(w)) continue;
      g.fillStyle(w.color, 1);
      g.fillCircle(w.x, w.y, 9);
      g.lineStyle(1.5, COLORS.OUTLINE, 0.8);
      g.strokeCircle(w.x, w.y, 9);
    }
    for (const w of this.guards) {
      if (!inView(w)) continue;
      g.fillStyle(w.color, 1);
      g.fillCircle(w.x, w.y, 11);
      g.lineStyle(2, COLORS.OUTLINE, 1);
      g.strokeCircle(w.x, w.y, 11);
      g.lineStyle(2, 0xd8d8d8, 1);
      g.lineBetween(w.x + 12, w.y - 16, w.x + 12, w.y + 12);
    }
    // Portões fechados
    const gg = this.gateGfx;
    gg.clear();
    for (const q of this.layout.gates) {
      if (this.openGates.has(q.place)) continue;
      gg.fillStyle(0x3a2412, 1);
      gg.fillRect(q.rect.x, q.rect.y, q.rect.w, q.rect.h);
      gg.lineStyle(4, 0x8fa6b8, 1);
      for (let d = 16; d < q.rect.w; d += 26) gg.lineBetween(q.rect.x + d, q.rect.y, q.rect.x + d, q.rect.y + q.rect.h);
      gg.lineStyle(3, 0xe0b040, 1);
      gg.strokeRect(q.rect.x, q.rect.y, q.rect.w, q.rect.h);
    }
  }

  private nightLights(): Light[] {
    const v = this.cameras.main.worldView;
    const out: Light[] = [{ x: this.pos.x, y: this.pos.y, radius: TIME.LIGHT.TORCH * 1.2 }];
    for (const p of this.layout.lamps) if (p.x > v.x - 300 && p.x < v.right + 300 && p.y > v.y - 300 && p.y < v.bottom + 300) out.push({ x: p.x, y: p.y, radius: 230 });
    for (const g of this.guards) if (g.x > v.x - 200 && g.x < v.right + 200 && g.y > v.y - 200 && g.y < v.bottom + 200) out.push({ x: g.x, y: g.y, radius: 130 });
    return out;
  }

  // --- Interação ---

  private updateGates(first: boolean): void {
    const s = useGameStore.getState();
    const before = this.openGates.size;
    const open = new Set<AccessPlace>();
    for (const g of this.layout.gates) if (s.access(g.place, this.townId).open || s.hasPass(this.townId, g.place)) open.add(g.place);
    this.openGates = open;
    if (!first && open.size !== before) this.drawCommander();
  }

  private updateNear(): void {
    const s = useGameStore.getState();
    let best: Near = null;
    let bd = Infinity;
    for (const v of this.nobles.values()) {
      const d = distance(v, this.pos);
      if (d < 80 && d < bd) {
        bd = d;
        best = { kind: "NOBLE", v };
      }
    }
    for (const g of this.layout.gates) {
      if (this.openGates.has(g.place)) continue;
      const d = distance(g.post, this.pos);
      if (d < 130 && d < bd) {
        bd = d;
        best = { kind: "GATE", gate: g };
      }
    }
    const cx = Math.floor(this.pos.x / CELL);
    const cy = Math.floor(this.pos.y / CELL);
    for (let y = cy - 1; y <= cy + 1; y++) {
      for (let x = cx - 1; x <= cx + 1; x++) {
        for (const door of this.doorCells.get(this.cellKey(x, y)) ?? []) {
          const d = distance(door, this.pos);
          if (d < door.radius && d < bd) {
            bd = d;
            best = { kind: "DOOR", door };
          }
        }
      }
    }
    if (!best) {
      for (const w of this.walkers) {
        const d = distance(w, this.pos);
        if (d < 50 && d < bd) {
          bd = d;
          best = { kind: "FOLK", w };
        }
      }
    }
    this.near = best;
    const prompt = !best ? null : best.kind === "NOBLE" ? `E — Falar com ${best.v.name}` : best.kind === "GATE" ? "E — Falar com o guarda do portão" : best.kind === "DOOR" ? `E — ${best.door.enter ? "Entrar: " : ""}${best.door.label}` : "E — Falar com o morador";
    if (s.campPrompt !== prompt) s.setCampPrompt(prompt);
  }

  private say(speaker: string, talk: Talk): void {
    useGameStore.getState().setDialog({ speaker, text: talk.text, options: talk.options ?? [{ id: "bye", label: "Continuar" }] });
  }

  private interact(): void {
    const s = useGameStore.getState();
    if (this.leaving || s.campEvent) return;
    if (s.campPanel) {
      s.setCampPanel(null);
      return;
    }
    if (s.dialog) {
      s.setDialog(null);
      return;
    }
    const n = this.near;
    if (!n) return;
    if (n.kind === "NOBLE") {
      const noble = s.nobles.find((x) => x.id === n.v.id);
      if (noble) this.say(n.v.name, nobleTalk(noble, s));
      return;
    }
    if (n.kind === "GATE") {
      this.say("Guarda do portão", gateTalk(n.gate.place, this.townId, s));
      return;
    }
    if (n.kind === "FOLK") {
      const t = s.settlements.find((x) => x.id === this.townId);
      const lines = t ? townGossip(s, t, Math.random) : ["..."];
      this.say("Morador", { text: lines[0] });
      return;
    }
    this.useDoor(n.door);
  }

  private useDoor(door: CityDoor): void {
    const s = useGameStore.getState();
    if (door.action === "leave") return this.leave();
    if (door.action === "market") return s.setCampPanel({ kind: "TOWN", settlementId: this.townId, at: "MARKET" } as CampPanel);
    if (door.action === "herald") return this.herald();
    if (door.action === "litter") return this.litter();
    if (door.action === "sewer") return this.enter("sewer", "Esgotos");
    if (door.action === "dungeon") {
      if (this.trespassing() || s.access("CASTLE", this.townId).open) return this.enter("dungeon", "Masmorra");
      this.say("Carcereiro", { text: "Sem ordem do Camareiro-mor, ninguém desce." });
      return;
    }
    if (!door.enter) return;
    if (door.access) {
      const ok = s.access(door.access, this.townId).open || (door.access === "THRONE" && s.audiences[this.owner] !== undefined && s.audiences[this.owner] <= s.day);
      if (!ok) {
        this.say("Guarda real", { text: s.access(door.access, this.townId).why });
        return;
      }
    }
    this.enter(door.enter, door.label);
  }

  private enter(key: string, title: string): void {
    const s = useGameStore.getState();
    s.setCampPrompt(null);
    this.cameras.main.fadeOut(160, 0, 0, 0);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      this.scene.launch("InteriorScene", { key: `town:${this.townId}:${key}`, title, returnTo: "CapitalScene" });
      this.scene.sleep();
    });
  }

  /** Arauto da Praça Real: festas marcadas, e as notícias de longe chegam aqui antes. */
  private herald(): void {
    const s = useGameStore.getState();
    const t = s.settlements.find((x) => x.id === this.townId);
    const heard = t ? s.hearNews(t, `na Praça Real de ${t.name}`, WORLD.DAY_DISTANCE * 1.2) : 0;
    const agenda = s.courtEvents.filter((e) => e.townId === this.townId && e.day >= s.day).map((e) => `${COURT_EVENT_LABEL[e.kind]} no dia ${e.day}`);
    this.say("Arauto", { text: `Ouçam, ouçam! ${agenda.length > 0 ? `Na agenda da corte: ${agenda.join("; ")}.` : "Nenhuma festa anunciada."} ${heard > 0 ? `Chegaram ${heard} notícia(s) de longe (no diário).` : "Nada de novo das estradas."}` });
  }

  private litter(): void {
    const s = useGameStore.getState();
    const options = this.layout.districts.filter((d) => d.id !== "NOBLE" && d.id !== "CASTLE").map((d) => ({ id: `litter:${d.id}`, label: `${d.name} (${COURT.LITTER_GOLD} de ouro)` }));
    this.say("Liteireiros", { text: s.gold >= COURT.LITTER_GOLD ? "Para onde, senhor?" : "Sem moeda, senhor, é a pé.", options: [...options, { id: "bye", label: "Fico por aqui" }] });
  }

  private onWake(_sys: unknown, data?: { after?: string | null; text?: string }): void {
    this.input.keyboard?.resetKeys();
    this.cameras.main.fadeIn(200, 0, 0, 0);
    this.drawCommander();
    this.updateGates(true);
    this.refreshNobles();
    const after = data?.after;
    if (after === "cityrest") {
      const s = useGameStore.getState();
      const days = daysUntilHour(s.dayProgress, 7);
      this.world().advanceAbroad(days);
      this.say("Estalajadeira", { text: "Bom dia, Comandante. A cidade já acordou." });
    } else if (after === "duel") {
      this.scene.launch("DuelScene");
      this.scene.sleep();
    } else if (after === "duelover" && data?.text) {
      this.say("Mestre da Liça", { text: data.text });
    } else if (after === "cityenter:dungeon") {
      this.enter("dungeon", "Masmorra");
    } else if (after?.startsWith("cityleave:")) {
      // Saída dos esgotos: um jardim do Bairro Nobre, ou a boca do Bairro Baixo
      const to = after.slice(10);
      const p = to === "NOBLE" ? this.layout.palaces[0]?.door : this.layout.doors.find((d) => d.action === "sewer");
      if (p) {
        this.pos = { x: p.x, y: p.y + 40 };
        while (this.blocked(this.pos, RADIUS) && this.pos.y < CAPITAL_H - 100) this.pos.y += 20;
        this.commander.setPosition(this.pos.x, this.pos.y);
        this.cameras.main.centerOn(this.pos.x, this.pos.y);
      }
    }
  }

  private onChoice(id: string): void {
    const store = useGameStore.getState();
    const speaker = store.dialog?.speaker ?? "";
    store.setDialog(null);
    if (id === "bye") return;
    if (id === "cityout") return this.leave();
    if (id.startsWith("panel:")) {
      store.setCampPanel(JSON.parse(id.slice(6)) as CampPanel);
      return;
    }
    if (id.startsWith("litter:")) {
      const d = this.layout.districts.find((x) => x.id === id.slice(7));
      if (!d || store.gold < COURT.LITTER_GOLD) return;
      useGameStore.setState({ gold: store.gold - COURT.LITTER_GOLD });
      this.world().advanceAbroad(COURT.LITTER_DAYS);
      this.pos = { ...d.stand };
      this.commander.setPosition(this.pos.x, this.pos.y);
      this.cameras.main.centerOn(this.pos.x, this.pos.y);
      return;
    }
    if (id.startsWith("caught:")) {
      const how = id.slice(7);
      if (how === "GIVEUP") return this.seized("foi pego onde não devia");
      if (how === "RUN") {
        this.chaseUntil = this.time.now + 9000;
        return;
      }
      if (Math.random() < 0.6) {
        useGameStore.setState({ gold: store.gold - 60, honor: Math.max(0, store.honor - 1) });
        this.say("Guarda", { text: "Eu não vi nada. Mas ande logo." });
      } else this.seized("tentou subornar a guarda");
      return;
    }
    if (id.startsWith("gate:")) {
      const [, place, how] = id.split(":");
      const r = store.passGate(this.townId, place as AccessPlace, how as "BRIBE");
      this.updateGates(false);
      this.say("Guarda do portão", { text: r.text });
      return;
    }
    if (id.startsWith("court:")) {
      const out = courtChoice(id, this.townId);
      if (out.scene === "DUEL") {
        this.scene.launch("DuelScene");
        this.scene.sleep();
        return;
      }
      if (out.talk) this.say(out.speaker ?? speaker, out.talk);
      return;
    }
  }

  /** Volta ao mundo, diante da muralha interna. */
  private leave(): void {
    if (this.leaving) return;
    this.leaving = true;
    const s = useGameStore.getState();
    s.setCampPrompt(null);
    s.setDialog(null);
    const finish = () => {
      if (this.clock > 0) this.world().advanceAbroad(this.clock);
      useGameStore.getState().setCity(null);
      this.scene.wake("WorldScene", { from: this.townId });
      this.scene.stop();
    };
    if (!this.layout) return finish();
    this.cameras.main.fadeOut(200, 0, 0, 0);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, finish);
  }
}
