import Phaser from "phaser";
import { buildInterior, type Furniture, type InteriorDef, type Npc, type Spot, type Talk } from "../data/interiors";
import { registerDialogHandler } from "../interiorBridge";
import { courtChoice, nobleTalk } from "../data/courtTalk";
import { useGameStore, type CampPanel } from "../../store/useGameStore";
import { GOODS, GOOD_LIST, WORLD } from "../../utils/constants";
import { distance, type Point } from "../../utils/math";
import { Extra } from "../entities/Extra";
import { Unit } from "../entities/Unit";
import { bitmapKey } from "../art/atlas";
import { gridBitmap } from "../art/pixel";
import { BACK_FACE, FLAT_FURNITURE, ROOM_WALL, furniturePiece, roomGrid } from "../art/interiors";
import { commanderLook, folkLook, nobleLook, troopLook } from "../art/looks";
import type { Look } from "../art/figures";
import { seedFromText } from "../worldgen/rng";
import { PIXEL_FONT } from "../art/font";

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
  fig: Extra;
  label: Phaser.GameObjects.Text;
  wait: number;
  /** Deitado no catre (ferido, doente, dormindo): não anda nem vira. */
  lying: boolean;
  /** Onde fica o nome (de quem deita, na cabeceira do catre); null = em cima da cabeça. */
  labelAt: Point | null;
}

const COMMANDER_SPEED = 200;
const RADIUS = 14;
/** Dá para falar por cima de um balcão. */
const TALK_RADIUS = 82;
/** Pelagens dos cavalos do estábulo, um de cada. */
const HORSE_COATS = [0x7a5030, 0x5a3a22, 0x3a2a20, 0x9a8a7a, 0xb08a5a, 0x6a4a2a];
/** Onde fica o canto da grade de cada móvel em relação ao pé (a textura é feita uma vez só). */
const OFFSETS = new Map<string, { dx: number; dy: number }>();

/** A roupa de quem está na sala: pelo ofício, se a sala diz; senão, nobre, tropa ou morador. */
function npcLook(n: Npc): Look {
  if (n.folk) {
    const own = n.folk === "TOWNSFOLK" || n.folk === "FAMILY" || n.folk === "CLERK" || n.folk === "MERCHANT";
    return folkLook(n.folk, own ? n.color : undefined);
  }
  if (n.nobleId || n.crown) return nobleLook(n.color, !!n.crown);
  if (n.troop) return n.color === 0xdfe3ee ? { ...troopLook("INFANTRY"), trim: 0xdfe3ee } : troopLook(n.troop);
  return folkLook("TOWNSFOLK", n.color);
}

/**
 * Interior de uma estrutura (Marco 14), no estilo de um mapa de Pokémon: a cena do mundo dorme
 * (o tempo para), o Comandante anda pela sala com WASD, fala com quem está ali (E) e sai pelo
 * tapete da porta. As conversas abrem os painéis de sempre (Intendência, Ferraria...) ou fazem
 * algo ali mesmo (pagar uma rodada, dar esmola, dar comida a uma família com fome).
 *
 * Em pixel art (G4): a sala é uma imagem só (chão, paredes, porta), cada móvel uma peça com a
 * profundidade do pé, e a gente são figuras do G1. A câmera fica em 200% e segue o Comandante
 * quando a sala não cabe na tela.
 */
export class InteriorScene extends Phaser.Scene {
  private def!: InteriorDef;
  private data0!: InteriorData;
  private commander!: Extra;
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
    // Pixel art só fica firme em escala inteira: 200% quando a tela tem espaço, senão 100%
    const cam = this.cameras.main;
    cam.setZoom(cam.width >= 1000 && cam.height >= 560 ? 2 : 1);
    this.drawRoom();
    for (const n of def.npcs) this.addNpc(n);
    this.pos = { ...def.spawn };
    this.commander = new Extra(this, this.pos.x, this.pos.y, commanderLook(), RADIUS);
    this.commander.setOwnLod("FULL");
    this.commander.setFacing(this.facing);
    this.follow();
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
    if (import.meta.env.DEV) (window as unknown as { __interior?: InteriorScene }).__interior = this;
  }

  update(time: number, delta: number): void {
    if (!this.def || this.leaving) return;
    const dt = Math.min(delta, 50) / 1000;
    const s = useGameStore.getState();
    const busy = s.dialog !== null || s.campPanel !== null || s.campEvent !== null;
    if (!busy) this.move(dt);
    for (const v of this.npcs) this.updateNpc(v, dt, busy);
    this.updateNear();
    this.showNames();
    this.follow();
    Unit.animateAll(time, this.cameras.main.worldView, this);
  }

  /** A sala inteira na tela quando cabe; senão, a câmera acompanha o Comandante até as paredes. */
  private follow(): void {
    const cam = this.cameras.main;
    const d = this.def;
    const vw = cam.width / cam.zoom;
    const vh = cam.height / cam.zoom;
    // Folga em cima para o nome da sala, que fica por cima da tela
    const x0 = -ROOM_WALL;
    const x1 = d.w + ROOM_WALL;
    const y0 = -ROOM_WALL - BACK_FACE - 34 / cam.zoom;
    const y1 = d.h + ROOM_WALL + 6;
    const axis = (p: number, a: number, b: number, v: number) => (b - a <= v ? (a + b) / 2 : Phaser.Math.Clamp(p, a + v / 2, b - v / 2));
    cam.centerOn(Math.round(axis(this.pos.x, x0, x1, vw)), Math.round(axis(this.pos.y, y0, y1, vh)));
  }

  // --- Desenho ---

  private drawRoom(): void {
    const d = this.def;
    const wall = ROOM_WALL;
    // A sala só depende do estilo, do tamanho e da porta: povoados diferentes dividem a textura
    const key = `sala:${d.style}:${d.w}x${d.h}:${Math.round(d.door.x)}`;
    const tex = bitmapKey(this, key, () => gridBitmap(roomGrid(d.style, d.w, d.h, d.door.x, seedFromText(key))));
    this.add.image(-wall, -wall - BACK_FACE, tex).setOrigin(0, 0).setDepth(-2);
    // Paredes contam como sólidas
    this.solids.push(
      new Phaser.Geom.Rectangle(-wall, -wall, d.w + wall * 2, wall),
      new Phaser.Geom.Rectangle(-wall, 0, wall, d.h),
      new Phaser.Geom.Rectangle(d.w, 0, wall, d.h),
      new Phaser.Geom.Rectangle(-wall, d.h, d.w / 2 - 34 + wall, wall),
      new Phaser.Geom.Rectangle(d.w / 2 + 34, d.h, d.w / 2 - 34 + wall, wall),
    );
    d.furniture.forEach((fu, i) => {
      this.placeFurniture(fu, i);
      if (fu.solid) this.solids.push(new Phaser.Geom.Rectangle(fu.x, fu.y, fu.w, fu.h));
    });
    // Onde dá para mexer em alguma coisa: um brilho pequeno no chão
    const marks = this.add.graphics().setDepth(-0.4);
    for (const sp of d.spots) {
      marks.fillStyle(0xffe066, 0.55);
      marks.fillRect(Math.round(sp.x) - 1, Math.round(sp.y) - 3, 2, 6);
      marks.fillRect(Math.round(sp.x) - 3, Math.round(sp.y) - 1, 6, 2);
    }
  }

  private placeFurniture(fu: Furniture, i: number): void {
    if (fu.kind === "HORSE") {
      // O cavalo do estábulo é uma figura: respira parado na baia, de lado
      const look: Look = { beast: "HORSE", body: "HUMAN", head: "BARE", armor: 0, weapon: "NONE", shield: "NONE", mount: "NONE", color: HORSE_COATS[i % HORSE_COATS.length] };
      const horse = new Extra(this, Math.round(fu.x + fu.w / 2), Math.round(fu.y + fu.h * 0.55), look, 10);
      horse.setOwnLod("FULL");
      horse.setFacing(i % 2 ? Math.PI : 0);
      return;
    }
    const x = Math.round(fu.x);
    const y = Math.round(fu.y);
    const w = Math.round(fu.w);
    const h = Math.round(fu.h);
    // As decorações (canecas, livros, armas) variam com o lugar do móvel na sala
    const seed = (x * 31 + y * 17 + w * 7 + h) >>> 0;
    const key = `movel:${fu.kind}:${w}x${h}:${fu.color.toString(16)}:${seed}`;
    let off = OFFSETS.get(key);
    if (!off || !this.textures.exists(key)) {
      const piece = furniturePiece(fu.kind, w, h, fu.color, seed);
      if (!piece) return;
      off = { dx: piece.dx, dy: piece.dy };
      OFFSETS.set(key, off);
      bitmapKey(this, key, () => gridBitmap(piece.grid));
    }
    // Rentes ao chão ficam embaixo de todos; o catre, pela cabeceira (quem deita fica por cima);
    // o resto pela linha de baixo do pé, como as figuras
    const depth = FLAT_FURNITURE.has(fu.kind) ? -1 + y * 1e-6 : fu.kind === "BED" ? y * 1e-6 : (y + h) * 1e-6;
    this.add.image(x + off.dx, y + off.dy, key).setOrigin(0, 0).setDepth(depth);
  }

  private addNpc(npc: Npc): void {
    const fig = new Extra(this, npc.x, npc.y, npcLook(npc), npc.folk === "RAT" ? 10 : 11);
    fig.setOwnLod("FULL");
    let pos = { x: npc.x, y: npc.y };
    let labelAt: Point | null = null;
    const lying = npc.mark === "WOUNDED" || npc.mark === "SICK" || npc.mark === "SLEEP";
    fig.setFacing(Math.PI / 2);
    if (lying) {
      fig.setPose("SLEEP");
      // Deita no catre logo acima, se houver (o alojamento põe cada um na frente do seu), com a
      // cabeça no travesseiro: no quadro caído a cabeça fica à direita, então gira um quarto de volta
      // (de 90 em 90 graus o pixel art não borra) no catre em pé, ou espelha no deitado
      const bed = this.def.furniture.find((f) => f.kind === "BED" && npc.x >= f.x && npc.x <= f.x + f.w && npc.y >= f.y + f.h - 4 && npc.y - (f.y + f.h) < 30);
      if (bed && bed.h > bed.w) {
        fig.rotation = -Math.PI / 2;
        pos = { x: Math.round(bed.x + bed.w / 2 - 3), y: Math.round(bed.y + bed.h * 0.3) };
      } else if (bed) {
        fig.scaleX = -1;
        pos = { x: Math.round(bed.x + bed.w * 0.36), y: Math.round(bed.y + bed.h / 2 - 4) };
      }
      if (bed) labelAt = { x: Math.round(bed.x + bed.w / 2), y: Math.round(bed.y - 10) };
    }
    fig.x = pos.x;
    fig.y = pos.y;
    const zoom = this.cameras.main.zoom;
    const label = this.add
      .text(pos.x, pos.y + fig.headY - 6, npc.mark === "SLEEP" ? "z z z" : npc.name, {
        fontFamily: PIXEL_FONT,
        fontSize: `${12 / zoom}px`,
        color: "#ffe9b0",
        stroke: "#000000",
        strokeThickness: Math.max(2, Math.round(4 / zoom)),
        resolution: zoom,
      })
      .setOrigin(0.5, 1)
      .setDepth(6)
      .setAlpha(npc.mark === "SLEEP" ? 0.8 : 0);
    this.npcs.push({ npc, home: { ...pos }, pos, target: { ...pos }, fig, label, wait: Math.random() * 2, lying, labelAt });
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
    this.commander.setFacing(this.facing);
    this.commander.x = this.pos.x;
    this.commander.y = this.pos.y;
    // Pisou no tapete da porta andando para fora: sai
    if (vy > 0 && Math.abs(this.pos.x - this.def.door.x) < 34 && this.pos.y > this.def.h - 30) this.exit();
  }

  private updateNpc(v: NpcView, dt: number, busy: boolean): void {
    const w = v.npc.wander ?? 0;
    let walking = false;
    if (w > 0 && !busy && !v.lying) {
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
        v.fig.walkTo(v.pos.x, v.pos.y);
        walking = true;
      }
    }
    const near = distance(v.pos, this.pos);
    // Quem está perto olha para o Comandante
    if (!walking && !v.lying && near < TALK_RADIUS + 20) v.fig.setFacing(Math.atan2(this.pos.y - v.pos.y, this.pos.x - v.pos.x));
    if (v.labelAt) v.label.setPosition(v.labelAt.x, v.labelAt.y);
    else v.label.setPosition(Math.round(v.pos.x), Math.round(v.pos.y + v.fig.headY - 4));
  }

  /** O nome só de quem está mais perto (até 110 px): lado a lado, os nomes se atropelavam. Quem dorme mostra o "z z z". */
  private showNames(): void {
    let best: NpcView | null = null;
    let bd = 110;
    for (const v of this.npcs) {
      const d = distance(v.pos, this.pos);
      if (v.npc.mark !== "SLEEP" && d < bd) {
        bd = d;
        best = v;
      }
    }
    for (const v of this.npcs) if (v.npc.mark !== "SLEEP") v.label.setAlpha(v === best ? 1 : 0);
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
