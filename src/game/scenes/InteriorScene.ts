import Phaser from "phaser";
import { buildInterior, type Furniture, type InteriorDef, type Npc, type Spot, type Talk } from "../data/interiors";
import { drawTroopShape } from "../entities/shapes";
import { registerDialogHandler } from "../interiorBridge";
import { courtChoice, nobleTalk } from "../data/courtTalk";
import { useGameStore, type CampPanel } from "../../store/useGameStore";
import { COLORS, GOODS, GOOD_LIST, WORLD } from "../../utils/constants";
import { distance, type Point } from "../../utils/math";

/** Ao entrar: qual prédio e para onde o Comandante volta ao sair. */
export interface InteriorData {
  key: string;
  title: string;
  settlementId?: string;
  /** Cena para onde volta ao sair (a Cidade Alta, no Marco 15; senão, o mundo). */
  returnTo?: string;
}

interface NpcView {
  npc: Npc;
  home: Point;
  pos: Point;
  target: Point;
  gfx: Phaser.GameObjects.Graphics;
  label: Phaser.GameObjects.Text;
  wait: number;
}

const COMMANDER_SPEED = 200;
const RADIUS = 14;
/** Dá para falar por cima de um balcão. */
const TALK_RADIUS = 82;

const FLOOR: Record<InteriorDef["style"], { floor: number; seam: number; wall: number }> = {
  TENT: { floor: 0xc9b48a, seam: 0xb09a70, wall: 0x9c8660 },
  WOOD: { floor: 0x8a6a45, seam: 0x6e5236, wall: 0x4a321c },
  STONE: { floor: 0x8d877c, seam: 0x77716a, wall: 0x4e4a44 },
  TEMPLE: { floor: 0xd9d2bf, seam: 0xbdb6a2, wall: 0x77716a },
};

/**
 * Interior de uma estrutura (Marco 14), no estilo de um mapa de Pokémon: a cena do mundo dorme
 * (o tempo para), o Comandante anda pela sala com WASD, fala com quem está ali (E) e sai pelo
 * tapete da porta. As conversas abrem os painéis de sempre (Intendência, Ferraria...) ou fazem
 * algo ali mesmo (pagar uma rodada, dar esmola, dar comida a uma família com fome).
 */
export class InteriorScene extends Phaser.Scene {
  private def!: InteriorDef;
  private data0!: InteriorData;
  private commander!: Phaser.GameObjects.Graphics;
  private pos: Point = { x: 0, y: 0 };
  private facing = -Math.PI / 2;
  private npcs: NpcView[] = [];
  private solids: Phaser.Geom.Rectangle[] = [];
  private keys!: Record<"W" | "A" | "S" | "D" | "E" | "ESC" | "ONE" | "TWO" | "THREE" | "FOUR" | "FIVE" | "SIX" | "SEVEN" | "EIGHT" | "NINE" | "UP" | "DOWN" | "LEFT" | "RIGHT", Phaser.Input.Keyboard.Key>;
  private near: { kind: "NPC"; v: NpcView } | { kind: "SPOT"; spot: Spot } | { kind: "DOOR" } | null = null;
  private leaving = false;
  /** O que fazer no mundo ao sair (ex.: descansar até o amanhecer). */
  private after: string | null = null;

  constructor() {
    super("InteriorScene");
  }

  init(data: InteriorData): void {
    this.data0 = data;
    this.npcs = [];
    this.solids = [];
    this.near = null;
    this.leaving = false;
    this.after = null;
  }

  create(): void {
    const store = useGameStore.getState();
    const def = buildInterior(this.data0.key, store);
    if (!def) {
      this.exit();
      return;
    }
    this.def = def;
    this.cameras.main.setBackgroundColor(0x0d0d0d);
    this.drawRoom();
    for (const n of def.npcs) this.addNpc(n);
    this.pos = { ...def.spawn };
    this.commander = this.add.graphics().setDepth(5);
    this.drawCommander();

    const cam = this.cameras.main;
    const zoom = Math.min(1.35, (cam.width - 80) / def.w, (cam.height - 140) / def.h);
    cam.setZoom(zoom);
    cam.centerOn(def.w / 2, def.h / 2 + 20 / zoom);
    cam.fadeIn(220, 0, 0, 0);

    const keyboard = this.input.keyboard;
    if (!keyboard) throw new Error("Teclado indisponível");
    this.keys = keyboard.addKeys("W,A,S,D,E,ESC,ONE,TWO,THREE,FOUR,FIVE,SIX,SEVEN,EIGHT,NINE,UP,DOWN,LEFT,RIGHT") as typeof this.keys;
    this.keys.E.on("down", () => this.interact());
    this.keys.ESC.on("down", () => {
      const s = useGameStore.getState();
      if (s.dialog) s.setDialog(null);
      else if (s.campPanel) s.setCampPanel(null);
    });
    const choose = (i: number) => {
      const d = useGameStore.getState().dialog;
      if (d && d.options[i]) this.onChoice(d.options[i].id);
    };
    this.keys.ONE.on("down", () => choose(0));
    this.keys.TWO.on("down", () => choose(1));
    this.keys.THREE.on("down", () => choose(2));
    this.keys.FOUR.on("down", () => choose(3));
    this.keys.FIVE.on("down", () => choose(4));
    this.keys.SIX.on("down", () => choose(5));
    this.keys.SEVEN.on("down", () => choose(6));
    this.keys.EIGHT.on("down", () => choose(7));
    this.keys.NINE.on("down", () => choose(8));
    const unregister = registerDialogHandler((id) => this.onChoice(id));
    store.enterInterior({ key: def.key, title: def.title, settlementId: def.settlementId });
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, unregister);
  }

  update(_time: number, delta: number): void {
    if (!this.def || this.leaving) return;
    const dt = Math.min(delta, 50) / 1000;
    const s = useGameStore.getState();
    const busy = s.dialog !== null || s.campPanel !== null || s.campEvent !== null;
    if (!busy) this.move(dt);
    for (const v of this.npcs) this.updateNpc(v, dt, busy);
    this.updateNear();
  }

  // --- Desenho ---

  private drawRoom(): void {
    const d = this.def;
    const st = FLOOR[d.style];
    const g = this.add.graphics().setDepth(0);
    const wall = 22;
    g.fillStyle(st.floor, 1);
    g.fillRect(0, 0, d.w, d.h);
    g.lineStyle(1, st.seam, 0.7);
    if (d.style === "WOOD") for (let y = 26; y < d.h; y += 26) g.lineBetween(0, y, d.w, y);
    else if (d.style === "TENT") for (let x = 60; x < d.w; x += 90) g.lineBetween(x, 0, x, d.h);
    else {
      for (let y = 40; y < d.h; y += 40) g.lineBetween(0, y, d.w, y);
      for (let x = 40; x < d.w; x += 40) g.lineBetween(x, 0, x, d.h);
    }
    g.fillStyle(st.wall, 1);
    g.fillRect(-wall, -wall, d.w + wall * 2, wall);
    g.fillRect(-wall, 0, wall, d.h);
    g.fillRect(d.w, 0, wall, d.h);
    g.fillRect(-wall, d.h, d.w / 2 - 34 + wall, wall);
    g.fillRect(d.w / 2 + 34, d.h, d.w / 2 - 34 + wall, wall);
    g.lineStyle(3, COLORS.OUTLINE, 1);
    g.strokeRect(-wall, -wall, d.w + wall * 2, d.h + wall * 2);
    // Tapete da porta (por onde se sai)
    g.fillStyle(0x7a2a22, 1);
    g.fillRect(d.door.x - 34, d.h - 14, 68, 28);
    g.lineStyle(2, 0xe0b040, 0.9);
    g.strokeRect(d.door.x - 34, d.h - 14, 68, 28);
    // Paredes contam como sólidas
    this.solids.push(
      new Phaser.Geom.Rectangle(-wall, -wall, d.w + wall * 2, wall),
      new Phaser.Geom.Rectangle(-wall, 0, wall, d.h),
      new Phaser.Geom.Rectangle(d.w, 0, wall, d.h),
      new Phaser.Geom.Rectangle(-wall, d.h, d.w / 2 - 34 + wall, wall),
      new Phaser.Geom.Rectangle(d.w / 2 + 34, d.h, d.w / 2 - 34 + wall, wall),
    );
    const items = this.add.graphics().setDepth(1);
    for (const fu of [...d.furniture].sort((a, b) => Number(b.kind === "CARPET" || b.kind === "HAY") - Number(a.kind === "CARPET" || a.kind === "HAY"))) {
      this.drawFurniture(items, fu);
      if (fu.solid) this.solids.push(new Phaser.Geom.Rectangle(fu.x, fu.y, fu.w, fu.h));
    }
    for (const sp of d.spots) {
      items.fillStyle(0xffe066, 0.5);
      items.fillCircle(sp.x, sp.y, 5);
    }
  }

  private drawFurniture(g: Phaser.GameObjects.Graphics, fu: Furniture): void {
    const { x, y, w, h, color } = fu;
    const outline = () => {
      g.lineStyle(2, COLORS.OUTLINE, 0.9);
      g.strokeRect(x, y, w, h);
    };
    switch (fu.kind) {
      case "CARPET":
        g.fillStyle(color, 0.85);
        g.fillRect(x, y, w, h);
        g.lineStyle(3, 0xe0b040, 0.6);
        g.strokeRect(x + 6, y + 6, w - 12, h - 12);
        return;
      case "HAY":
        g.fillStyle(color, 0.8);
        g.fillRect(x, y, w, h);
        g.lineStyle(1, 0xa89040, 0.8);
        for (let k = 6; k < h; k += 8) g.lineBetween(x + 4, y + k, x + w - 4, y + k - 3);
        return;
      case "BED":
        g.fillStyle(color, 1);
        g.fillRect(x, y, w, h);
        g.fillStyle(0xe8e0d0, 1);
        if (h > w) g.fillRect(x + 4, y + 4, w - 8, h * 0.22);
        else g.fillRect(x + 4, y + 4, w * 0.22, h - 8);
        outline();
        return;
      case "BARREL":
        g.fillStyle(color, 1);
        g.fillCircle(x + w / 2, y + h / 2, w / 2);
        g.lineStyle(2, 0x2a1a0a, 1);
        g.strokeCircle(x + w / 2, y + h / 2, w / 2);
        g.strokeCircle(x + w / 2, y + h / 2, w / 3);
        return;
      case "SACK":
        g.fillStyle(color, 1);
        g.fillEllipse(x + w / 2, y + h / 2, w, h);
        g.lineStyle(2, 0x6a5030, 1);
        g.strokeEllipse(x + w / 2, y + h / 2, w, h);
        g.lineBetween(x + w / 2 - 4, y + 4, x + w / 2 + 4, y + 4);
        return;
      case "CRATE":
        g.fillStyle(color, 1);
        g.fillRect(x, y, w, h);
        g.lineStyle(2, 0x3a2a14, 1);
        g.lineBetween(x, y, x + w, y + h);
        g.lineBetween(x + w, y, x, y + h);
        outline();
        return;
      case "FIRE":
        g.fillStyle(0x3a2a20, 1);
        g.fillRect(x, y, w, h);
        g.fillStyle(0xff8c1a, 1);
        g.fillCircle(x + w / 2, y + h / 2 + 4, Math.min(w, h) * 0.3);
        g.fillStyle(0xffe066, 1);
        g.fillCircle(x + w / 2, y + h / 2 + 6, Math.min(w, h) * 0.16);
        outline();
        return;
      case "ANVIL":
        g.fillStyle(color, 1);
        g.fillRect(x, y + h * 0.3, w, h * 0.4);
        g.fillRect(x + w * 0.3, y, w * 0.4, h);
        return;
      case "IRON":
        g.fillStyle(color, 1);
        g.fillRect(x, y, w, h);
        g.lineStyle(1, 0x4a5a6a, 1);
        g.strokeRect(x, y, w, h);
        return;
      case "HORSE":
        g.fillStyle(color, 1);
        g.fillEllipse(x + w / 2, y + h / 2 + 6, w, h * 0.7);
        g.fillEllipse(x + w / 2, y + 8, w * 0.4, h * 0.36);
        g.lineStyle(2, COLORS.OUTLINE, 0.8);
        g.strokeEllipse(x + w / 2, y + h / 2 + 6, w, h * 0.7);
        return;
      case "RACK":
        g.fillStyle(color, 1);
        g.fillRect(x, y, w, h);
        g.lineStyle(2, 0xb8b8b8, 1);
        for (let k = 10; k < h; k += 18) g.lineBetween(x + 4, y + k, x + w - 4, y + k - 8);
        return;
      case "ALTAR":
        g.fillStyle(color, 1);
        g.fillRect(x, y, w, h);
        g.fillStyle(0xffe066, 1);
        for (const cx of [x + 14, x + w - 14]) g.fillCircle(cx, y + 10, 4);
        outline();
        return;
      case "BOARD":
        g.fillStyle(color, 1);
        g.fillRect(x, y, w, h);
        g.lineStyle(1, 0xe8e8e8, 0.7);
        for (let k = 6; k < h; k += 7) g.lineBetween(x + 8, y + k, x + w - 8 - ((k * 13) % 30), y + k);
        outline();
        return;
      case "BANNER":
        g.lineStyle(3, 0x3a2a14, 1);
        g.lineBetween(x + w / 2, y - 10, x + w / 2, y + h + 14);
        g.fillStyle(color, 1);
        g.fillRect(x, y, w, h);
        return;
      case "CHEST":
        g.fillStyle(color, 1);
        g.fillRect(x, y, w, h);
        g.fillStyle(0xe0b040, 1);
        g.fillRect(x, y + h * 0.4, w, 4);
        outline();
        return;
      default:
        g.fillStyle(color, 1);
        g.fillRect(x, y, w, h);
        if (fu.kind === "COUNTER") {
          g.fillStyle(0x000000, 0.2);
          g.fillRect(x, y + h - 8, w, 8);
        }
        outline();
    }
  }

  private addNpc(npc: Npc): void {
    const gfx = this.add.graphics().setDepth(4);
    if (npc.troop) {
      drawTroopShape(gfx, npc.troop, 11);
      if (npc.color !== 0x2f6fdf) {
        gfx.fillStyle(npc.color, 1);
        gfx.fillCircle(0, 0, 8);
      }
    } else {
      gfx.fillStyle(npc.color, 1);
      gfx.fillCircle(0, 0, 11);
      gfx.lineStyle(2, COLORS.OUTLINE, 1);
      gfx.strokeCircle(0, 0, 11);
      gfx.fillStyle(0x3a2a1a, 1);
      gfx.fillCircle(0, -4, 5);
    }
    if (npc.crown) {
      gfx.fillStyle(0xe0b040, 1);
      gfx.fillTriangle(-9, -11, -3, -18, 0, -11);
      gfx.fillTriangle(9, -11, 3, -18, 0, -11);
    }
    if (npc.mark === "WOUNDED") {
      gfx.fillStyle(0xffffff, 1);
      gfx.fillRect(-7, -2, 14, 4);
      gfx.fillStyle(0xd02020, 1);
      gfx.fillRect(-2, -6, 4, 12);
    } else if (npc.mark === "SICK") {
      gfx.fillStyle(0x80c050, 0.6);
      gfx.fillCircle(0, 0, 12);
    }
    const label = this.add
      .text(npc.x, npc.y - 22, npc.mark === "SLEEP" ? "z z z" : npc.name, { fontFamily: "monospace", fontSize: "11px", color: "#ffe9b0", stroke: "#000000", strokeThickness: 3 })
      .setOrigin(0.5)
      .setDepth(6)
      .setAlpha(npc.mark === "SLEEP" ? 0.8 : 0);
    gfx.setPosition(npc.x, npc.y);
    this.npcs.push({ npc, home: { x: npc.x, y: npc.y }, pos: { x: npc.x, y: npc.y }, target: { x: npc.x, y: npc.y }, gfx, label, wait: Math.random() * 2 });
  }

  private drawCommander(): void {
    const g = this.commander;
    g.clear();
    g.fillStyle(COLORS.ALLY, 1);
    g.fillCircle(0, 0, RADIUS);
    g.lineStyle(3, COLORS.COMMANDER_OUTLINE, 1);
    g.strokeCircle(0, 0, RADIUS);
    g.fillStyle(COLORS.COMMANDER_OUTLINE, 1);
    g.fillTriangle(RADIUS + 6, 0, RADIUS - 2, -5, RADIUS - 2, 5);
    g.setPosition(this.pos.x, this.pos.y);
    g.setRotation(this.facing);
  }

  // --- Movimento ---

  private blocked(p: Point, r: number): boolean {
    return this.solids.some((s) => p.x + r > s.x && p.x - r < s.right && p.y + r > s.y && p.y - r < s.bottom);
  }

  private move(dt: number): void {
    const k = this.keys;
    let vx = 0;
    let vy = 0;
    if (k.A.isDown || k.LEFT.isDown) vx -= 1;
    if (k.D.isDown || k.RIGHT.isDown) vx += 1;
    if (k.W.isDown || k.UP.isDown) vy -= 1;
    if (k.S.isDown || k.DOWN.isDown) vy += 1;
    if (vx === 0 && vy === 0) return;
    const len = Math.hypot(vx, vy);
    const step = COMMANDER_SPEED * dt;
    const nx = { x: this.pos.x + (vx / len) * step, y: this.pos.y };
    if (!this.blocked(nx, RADIUS)) this.pos.x = nx.x;
    const ny = { x: this.pos.x, y: this.pos.y + (vy / len) * step };
    if (!this.blocked(ny, RADIUS)) this.pos.y = ny.y;
    this.facing = Math.atan2(vy, vx);
    this.commander.setPosition(this.pos.x, this.pos.y);
    this.commander.setRotation(this.facing);
    // Pisou no tapete da porta andando para fora: sai
    if (vy > 0 && Math.abs(this.pos.x - this.def.door.x) < 34 && this.pos.y > this.def.h - 30) this.exit();
  }

  private updateNpc(v: NpcView, dt: number, busy: boolean): void {
    const w = v.npc.wander ?? 0;
    if (w > 0 && !busy && v.npc.mark !== "SLEEP") {
      if (distance(v.pos, v.target) < 3) {
        v.wait -= dt;
        if (v.wait <= 0) {
          const a = Math.random() * Math.PI * 2;
          const t = { x: v.home.x + Math.cos(a) * w * Math.random(), y: v.home.y + Math.sin(a) * w * Math.random() };
          if (!this.blocked(t, 10)) v.target = t;
          v.wait = 1 + Math.random() * 3;
        }
      } else {
        const d = distance(v.pos, v.target);
        const s = Math.min(d, 40 * dt);
        v.pos = { x: v.pos.x + ((v.target.x - v.pos.x) / d) * s, y: v.pos.y + ((v.target.y - v.pos.y) / d) * s };
      }
    }
    v.gfx.setPosition(v.pos.x, v.pos.y);
    v.label.setPosition(v.pos.x, v.pos.y - 22);
    if (v.npc.mark !== "SLEEP") v.label.setAlpha(distance(v.pos, this.pos) < 110 ? 1 : 0);
  }

  // --- Interação ---

  private updateNear(): void {
    let best: typeof this.near = null;
    let bd = TALK_RADIUS;
    for (const v of this.npcs) {
      const d = distance(v.pos, this.pos);
      if (d < bd) {
        bd = d;
        best = { kind: "NPC", v };
      }
    }
    for (const spot of this.def.spots) {
      const d = distance(spot, this.pos);
      if (d < bd) {
        bd = d;
        best = { kind: "SPOT", spot };
      }
    }
    if (!best && distance(this.def.door, this.pos) < 50) best = { kind: "DOOR" };
    this.near = best;
    const prompt = !best ? null : best.kind === "NPC" ? `E — Falar com ${best.v.npc.name}` : best.kind === "SPOT" ? `E — ${best.spot.label}` : "E — Sair";
    const store = useGameStore.getState();
    if (store.campPrompt !== prompt) store.setCampPrompt(prompt);
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
    if (n.kind === "DOOR") return this.exit();
    if (n.kind === "NPC") {
      // Nobres falam conforme o momento (Marco 15): a fala é montada na hora
      const noble = n.v.npc.nobleId ? s.nobles.find((x) => x.id === n.v.npc.nobleId) : undefined;
      this.say(n.v.npc.name, noble ? nobleTalk(noble, s) : n.v.npc.talk);
      return;
    }
    this.say(n.spot.label, n.spot.talk);
  }

  private say(speaker: string, talk: Talk): void {
    useGameStore.getState().setDialog({ speaker, text: talk.text, options: talk.options ?? [{ id: "bye", label: "Continuar" }] });
  }

  /** Resposta escolhida na caixa de diálogo. */
  private onChoice(id: string): void {
    const store = useGameStore.getState();
    const speaker = store.dialog?.speaker ?? "";
    store.setDialog(null);
    if (id === "bye") return;
    if (id.startsWith("panel:")) {
      store.setCampPanel(JSON.parse(id.slice(6)) as CampPanel);
      return;
    }
    if (id === "rest") {
      this.after = "rest";
      this.exit();
      return;
    }
    // Marco 15: a corte (nobres, títulos, favores) e o que a Cidade Alta faz ao sair do prédio
    if (id === "cityrest") {
      if (store.gold < 5) {
        this.say(speaker, { text: "Sem 5 de ouro, sem quarto." });
        return;
      }
      useGameStore.setState({ gold: store.gold - 5 });
      this.after = "cityrest";
      this.exit();
      return;
    }
    if (id.startsWith("cityleave:") || id.startsWith("cityenter:")) {
      this.after = id;
      this.exit();
      return;
    }
    if (id.startsWith("court:")) {
      const out = courtChoice(id, this.def.settlementId ?? "");
      if (out.scene === "DUEL") {
        this.after = "duel";
        this.exit();
        return;
      }
      if (out.talk) this.say(out.speaker ?? speaker, out.talk);
      return;
    }
    const [kind, townId, arg] = id.split(":");
    if (kind === "round") {
      const text = store.buyRound(townId);
      // Depois da segunda caneca, as notícias de longe chegam antes (Marco 15)
      const t = store.settlements.find((x) => x.id === townId);
      const heard = t ? store.hearNews(t, `em ${t.name}`, WORLD.DAY_DISTANCE) : 0;
      this.say(speaker, { text: heard > 0 ? `${text} (${heard} notícia(s) nova(s) no diário.)` : text });
      return;
    }
    if (kind === "donate") {
      const ok = store.donateTemple(townId, Number(arg));
      this.say(speaker, { text: ok ? "Os deuses e os pobres agradecem, Comandante." : "Promessa de esmola não alimenta ninguém. Volte quando tiver o ouro." });
      return;
    }
    if (kind === "charity") {
      const ok = store.giveFood(townId);
      this.say(speaker, { text: ok ? "Que os deuses o abençoem! Meus filhos vão comer hoje." : "Ah... não tem mais? Tudo bem." });
      return;
    }
    if (kind === "hear") {
      this.say(speaker, { text: this.travelerNews(townId) });
    }
  }

  /** O mercador da taverna conta os preços de um mercado distante (uma notícia com dias de atraso). */
  private travelerNews(townId: string): string {
    const s = useGameStore.getState();
    const here = s.settlements.find((t) => t.id === townId);
    if (!here) return "...";
    const far = s.settlements
      .filter((t) => t.id !== townId && t.owner !== "RUINED" && distance(t, here) > WORLD.DAY_DISTANCE * 1.2 && distance(t, here) < WORLD.DAY_DISTANCE * 5)
      .sort(() => Math.random() - 0.5)[0];
    if (!far) return "Não venho de longe, não. Só da aldeia vizinha.";
    const age = Math.max(1, Math.round(distance(far, here) / WORLD.DAY_DISTANCE));
    s.notePrices(far.id, "TRAVELER", age);
    const notable = GOOD_LIST.map((g) => ({ g, r: far.econ.price[g] / GOODS[g].base }))
      .sort((a, b) => Math.abs(Math.log(b.r)) - Math.abs(Math.log(a.r)))
      .slice(0, 3)
      .map(({ g, r }) => `${GOODS[g].label.toLowerCase()} ${r >= 1.4 ? "caro" : r <= 0.7 ? "barato" : "no preço"} (${Math.round(far.econ.price[g])})`);
    return `Saí de ${far.name} faz uns ${age} dia(s). Lá estava: ${notable.join(", ")}. Anote no seu livro, Comandante.`;
  }

  /** Sai pela porta: a tela escurece e o mundo acorda com o Comandante diante da porta. */
  private exit(): void {
    if (this.leaving) return;
    this.leaving = true;
    const store = useGameStore.getState();
    store.setCampPrompt(null);
    const finish = () => {
      useGameStore.getState().leaveInterior();
      const after = this.after;
      this.scene.wake(this.data0?.returnTo ?? "WorldScene", { from: this.data0?.key, after });
      this.scene.stop();
    };
    if (!this.def) return finish();
    this.cameras.main.fadeOut(180, 0, 0, 0);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, finish);
  }
}
