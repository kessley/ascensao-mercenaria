import Phaser from "phaser";
import { bitmapKey } from "../art/atlas";
import { FLAMES, type FlameKind } from "../art/fire";
import { icePatch, PATCH_MAX_RADIUS, scorchPatch } from "../art/placeArt";
import { fogBank, FOG_BANK } from "../art/weatherArt";
import { PLACES, WEATHER, type TerrainType } from "../../utils/constants";
import type { Point } from "../../utils/math";
import { combatFx } from "./CombatEffects";
import { flameSprite, placedFlames } from "./flames";
import type { Light } from "./NightLayer";

/**
 * O que a magia mexe num lugar (G6, parte 4), ligado e desligado pelo Marco 19:
 * - **FOG**, o nevoeiro: bancos de névoa presos ao chão; quem está dentro enxerga e é visto como no nevoeiro;
 * - **DOUSE**, o fogo apagado: as tochas, as fogueiras e as luzes se apagam (soltam fumaça), e quem está dentro conta como sem tocha;
 * - **FREEZE**, a água congelada: o rio e o lago viram gelo, que se atravessa a pé;
 * - **FIRE**, o fogo: chamas no chão que acendem a noite e soltam fumaça, e deixam o chão queimado.
 */
export type PlaceKind = "FOG" | "DOUSE" | "FREEZE" | "FIRE";
export const PLACE_KINDS: readonly PlaceKind[] = ["FOG", "DOUSE", "FREEZE", "FIRE"];

/** O que a magia pede: o quê, onde, de que tamanho e por quantos segundos (sem `seconds`, até tirar). */
export interface PlaceSpec {
  kind: PlaceKind;
  x: number;
  y: number;
  r: number;
  seconds?: number;
}

/** O que os inimigos perguntam (para não importar a cena): quem está no escuro e quanto o nevoeiro esconde. */
export interface PlaceRules {
  doused(p: Point): boolean;
  /** De 0 a 1: quanto sobra da visão entre `a` e `b` (o nevoeiro de qualquer um dos dois vale). */
  sight(a: Point, b: Point): number;
}

interface Bank {
  img: Phaser.GameObjects.Image;
  ox: number;
  oy: number;
  orbit: number;
  phase: number;
  spin: number;
  alpha: number;
}

interface Flame {
  sprite: Phaser.GameObjects.Sprite;
  /** Em que ponto da subida do fogo (0 a 1) a chama acende; na descida, apaga na ordem contrária. */
  at: number;
  kind: FlameKind;
}

interface Place {
  id: number;
  kind: PlaceKind;
  x: number;
  y: number;
  r: number;
  /** Relógio dos lugares (s): quando acaba (Infinity = até tirar). */
  ends: number;
  /** 0 a 1: o efeito entra e sai devagar. */
  level: number;
  closing: boolean;
  banks: Bank[];
  flames: Flame[];
  nextSmoke: number;
  /** A textura feita para este lugar (o gelo; a mancha queimada fica com `scorch`). */
  key: string | null;
  overlay: Phaser.GameObjects.Image | null;
  scorch: Scorch | null;
}

interface Scorch {
  img: Phaser.GameObjects.Image;
  key: string;
  /** Quando começa a sumir (relógio dos lugares, s); Infinity enquanto o fogo queima. */
  fadeAt: number;
  born: number;
}

const rand = (a: number, b: number) => a + Math.random() * (b - a);
const inside = (p: Point, q: Place) => (p.x - q.x) ** 2 + (p.y - q.y) ** 2 <= q.r * q.r;
const isWater = (t: TerrainType) => t === "WATER" || t === "SHALLOW";

/** Profundidades: o gelo e o queimado no chão (abaixo das poças e da neve), o nevoeiro com o do tempo. */
const DEPTH = { ICE: -9.78, SCORCH: -9.77, FOG: 14.52 } as const;

export class PlaceEffects implements PlaceRules {
  private readonly places = new Map<number, Place>();
  private readonly scorches: Scorch[] = [];
  /** As chamas fixas que um lugar apagou, com a transparência que tinham. */
  private readonly hidden = new Map<Phaser.GameObjects.Sprite, number>();
  private nextId = 1;
  /** Relógio próprio (s): para na pausa, como o tempo. */
  private now = 0;
  private nextScan = 0;
  private dousing = 0;
  private fogs = 0;

  constructor(
    readonly scene: Phaser.Scene,
    /** O terreno sem o gelo da magia (o desenho do gelo procura a água). */
    private readonly baseTerrain: (x: number, y: number) => TerrainType,
    /** O gelo mudou o chão (`areas` = todo o gelo de agora; `changed` = onde mudou): a cena refaz rotas e tira quem ficou na água. */
    private readonly onFrozen: (areas: readonly { x: number; y: number; r: number }[], changed: { x: number; y: number; r: number }) => void,
  ) {}

  // --- Ligar e desligar ---

  /** Liga um efeito num lugar; devolve o número para desligar. */
  add(spec: PlaceSpec): number {
    const id = this.nextId++;
    const r = Math.max(20, Math.min(PLACES.MAX_RADIUS, spec.r));
    const p: Place = {
      id,
      kind: spec.kind,
      x: spec.x,
      y: spec.y,
      r,
      ends: spec.seconds !== undefined ? this.now + spec.seconds : Infinity,
      level: 0,
      closing: false,
      banks: [],
      flames: [],
      nextSmoke: this.now,
      key: null,
      overlay: null,
      scorch: null,
    };
    this.places.set(id, p);
    if (p.kind === "FOG") this.makeFog(p);
    else if (p.kind === "FREEZE") this.makeIce(p);
    else if (p.kind === "FIRE") this.makeFire(p);
    this.count();
    if (p.kind === "FREEZE") this.refreeze(p);
    // O fogo apaga na hora (as chamas fixas soltam fumaça já neste quadro)
    if (p.kind === "DOUSE") this.nextScan = this.now;
    return id;
  }

  /** Desliga um efeito: ele some devagar (o gelo derrete, o fogo apaga e deixa o chão queimado). */
  remove(id: number): boolean {
    const p = this.places.get(id);
    if (!p || p.closing) return false;
    this.close(p);
    return true;
  }

  /** Desliga tudo de uma vez (os testes, a troca de mapa). */
  clear(): void {
    for (const p of [...this.places.values()]) this.drop(p);
    for (const s of this.scorches) this.dropScorch(s);
    this.scorches.length = 0;
    this.restoreAll();
    this.count();
  }

  private close(p: Place): void {
    p.closing = true;
    this.count();
    // As tochas e as fogueiras voltam a acender assim que o lugar se abre
    if (p.kind === "DOUSE") this.nextScan = this.now;
  }

  // --- O que as regras perguntam ---

  /** Ligado agora (os efeitos que estão sumindo já não contam). */
  get active(): boolean {
    return this.dousing > 0 || this.fogs > 0;
  }

  get hasDouse(): boolean {
    return this.dousing > 0;
  }

  /** Aqui o fogo foi apagado? (As tochas não acendem, e quem está aqui conta como no escuro.) */
  doused(p: Point): boolean {
    if (this.dousing === 0) return false;
    for (const q of this.places.values()) if (q.kind === "DOUSE" && !q.closing && inside(p, q)) return true;
    return false;
  }

  /** A mesma pergunta, já presa à instância (para os ganchos estáticos de `Unit`). */
  readonly isDoused = (p: Point): boolean => this.doused(p);

  /** Quanto sobra da visão aqui (1 = nada muda; no nevoeiro, como o do tempo). */
  visionAt(p: Point): number {
    if (this.fogs === 0) return 1;
    let v = 1;
    for (const q of this.places.values()) if (q.kind === "FOG" && inside(p, q)) v *= 1 - (1 - WEATHER.VISION.FOG) * q.level;
    return v;
  }

  sight(a: Point, b: Point): number {
    if (this.fogs === 0) return 1;
    return Math.min(this.visionAt(a), this.visionAt(b));
  }

  /** Aqui tem fogo queimando? (O Marco 19 decide o que o fogo faz com quem está dentro.) */
  burningAt(p: Point): boolean {
    for (const q of this.places.values()) if (q.kind === "FIRE" && !q.closing && q.level > 0.2 && inside(p, q)) return true;
    return false;
  }

  /** O fogo que queima perto do ponto (até `margin` além da borda): para a IA sair de dentro dele. */
  fireAt(p: Point, margin = 0): { x: number; y: number; r: number } | null {
    for (const q of this.places.values()) {
      if (q.kind !== "FIRE" || q.closing) continue;
      if ((p.x - q.x) ** 2 + (p.y - q.y) ** 2 <= (q.r + margin) ** 2) return { x: q.x, y: q.y, r: q.r };
    }
    return null;
  }

  /** A água daqui está congelada pela magia? */
  frozenAt(p: Point): boolean {
    for (const q of this.places.values()) if (q.kind === "FREEZE" && inside(p, q)) return isWater(this.baseTerrain(p.x, p.y));
    return false;
  }

  /** As luzes do fogo, para a noite. */
  lights(): Light[] {
    const out: Light[] = [];
    for (const q of this.places.values()) {
      if (q.kind !== "FIRE" || q.level <= 0.01) continue;
      out.push({ x: q.x, y: q.y, radius: (q.r + PLACES.FIRE_LIGHT) * (0.35 + 0.65 * q.level), glow: 1, flicker: 0.07 });
    }
    return out;
  }

  /** O que está ligado agora (os testes conferem). */
  stats(): { places: number; byKind: Record<PlaceKind, number>; banks: number; flames: number; hidden: number; iced: number; scorches: number } {
    const byKind: Record<PlaceKind, number> = { FOG: 0, DOUSE: 0, FREEZE: 0, FIRE: 0 };
    let banks = 0;
    let flames = 0;
    let iced = 0;
    for (const q of this.places.values()) {
      byKind[q.kind]++;
      banks += q.banks.filter((b) => b.img.visible && b.img.alpha > 0.02).length;
      flames += q.flames.filter((f) => f.sprite.visible).length;
      if (q.overlay && q.overlay.alpha > 0.02) iced++;
    }
    return { places: this.places.size, byKind, banks, flames, hidden: this.hidden.size, iced, scorches: this.scorches.length };
  }

  // --- A cada quadro ---

  /** `dt` em segundos de tela (0 na pausa); `darkness` de 0 a 1 (o nevoeiro escurece com a noite). */
  update(dt: number, darkness: number): void {
    this.now += dt;
    for (const p of [...this.places.values()]) {
      if (!p.closing && this.now >= p.ends) this.close(p);
      // O fogo apagado por cima do fogo: ele se apaga
      if (p.kind === "FIRE" && !p.closing && this.doused(p)) this.close(p);
      const target = p.closing ? 0 : 1;
      const rate = dt / (p.closing ? PLACES.FADE_OUT : PLACES.FADE_IN);
      p.level = target > p.level ? Math.min(1, p.level + rate) : Math.max(0, p.level - rate);
      if (p.closing && p.level <= 0) {
        this.drop(p);
        continue;
      }
      if (p.kind === "FOG") this.updateFog(p, darkness);
      else if (p.kind === "FREEZE") p.overlay?.setAlpha(p.level);
      else if (p.kind === "FIRE") this.updateFire(p);
    }
    this.updateScorches();
    if (this.now >= this.nextScan && (this.dousing > 0 || this.hidden.size > 0)) {
      this.nextScan = this.now + PLACES.DOUSE_SCAN;
      this.scanFlames();
    }
  }

  // --- Nevoeiro ---

  private makeFog(p: Place): void {
    for (let k = 0; k < FOG_BANK.kinds; k++) bitmapKey(this.scene, `weather:fog:${k}`, () => fogBank(k));
    const [lo, hi] = PLACES.FOG_BANKS;
    const n = Math.max(lo, Math.min(hi, Math.round(p.r / PLACES.FOG_BANK_EVERY)));
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const d = Math.sqrt(Math.random()) * p.r * 0.6;
      const img = this.scene.add
        .image(p.x, p.y, `weather:fog:${i % FOG_BANK.kinds}`)
        .setDepth(DEPTH.FOG + i * 1e-4)
        .setScale(2)
        .setAlpha(0)
        .setFlipX(Math.random() < 0.5);
      p.banks.push({ img, ox: Math.cos(a) * d, oy: Math.sin(a) * d * 0.7, orbit: rand(10, 30), phase: Math.random() * Math.PI * 2, spin: rand(0.05, 0.14) * (Math.random() < 0.5 ? 1 : -1), alpha: rand(0.4, 0.55) });
    }
  }

  private updateFog(p: Place, darkness: number): void {
    // À noite, a névoa não brilha: escurece junto com o resto
    const v = Math.round(255 * (1 - 0.7 * darkness));
    const tint = (v << 16) | (v << 8) | v;
    for (const b of p.banks) {
      const a = b.phase + this.now * b.spin;
      b.img
        .setPosition(Math.round(p.x + b.ox + Math.cos(a) * b.orbit), Math.round(p.y + b.oy + Math.sin(a) * b.orbit * 0.5))
        .setAlpha(b.alpha * p.level)
        .setTint(tint);
    }
  }

  // --- Gelo ---

  private makeIce(p: Place): void {
    const key = `place:ice:${p.id}`;
    const seed = Math.floor(p.x * 7 + p.y * 13) % 997;
    bitmapKey(this.scene, key, () => icePatch(p.r, (dx, dy) => isWater(this.baseTerrain(p.x + dx, p.y + dy)), seed));
    const half = Math.min(PATCH_MAX_RADIUS, Math.round(Math.max(8, p.r)));
    p.key = key;
    p.overlay = this.scene.add.image(Math.round(p.x) - half, Math.round(p.y) - half, key).setOrigin(0, 0).setDepth(DEPTH.ICE).setAlpha(0);
  }

  /** O terreno ganha (ou perde) o gelo: a cena refaz as rotas em volta. */
  private refreeze(changed: Place): void {
    const areas = [...this.places.values()].filter((q) => q.kind === "FREEZE").map((q) => ({ x: q.x, y: q.y, r: q.r }));
    this.onFrozen(areas, { x: changed.x, y: changed.y, r: changed.r });
  }

  // --- Fogo ---

  private makeFire(p: Place): void {
    const [lo, hi] = PLACES.FIRE_FLAMES;
    const want = Math.max(lo, Math.min(hi, Math.round((Math.PI * p.r * p.r) / PLACES.FIRE_AREA)));
    // Na água não pega fogo: procura chão firme dentro do círculo
    for (let tries = 0; p.flames.length < want && tries < want * 6; tries++) {
      const a = Math.random() * Math.PI * 2;
      const d = Math.sqrt(Math.random()) * p.r * 0.92;
      const x = p.x + Math.cos(a) * d;
      const y = p.y + Math.sin(a) * d * 0.8;
      const t = this.baseTerrain(x, y);
      if (isWater(t) || t === "ICE" || t === "WALL" || t === "BUILDING") continue;
      // As labaredas no meio; na borda, chamas pequenas e brasas (o fogo se espalhando)
      const kind: FlameKind = d < p.r * 0.6 && Math.random() < 0.7 ? "BONFIRE" : Math.random() < 0.5 ? "EMBER" : "TORCH";
      const sprite = flameSprite(this.scene, kind, x, y, y * 1e-6 + 1e-7).setVisible(false);
      p.flames.push({ sprite, kind, at: Math.min(0.9, (d / p.r) * 0.8 + Math.random() * 0.15) });
    }
    const key = `place:scorch:${p.id}`;
    const seed = Math.floor(p.x * 11 + p.y * 3) % 991;
    bitmapKey(this.scene, key, () => scorchPatch(p.r * 0.95, seed));
    const half = Math.min(PATCH_MAX_RADIUS, Math.round(Math.max(8, p.r * 0.95)));
    const img = this.scene.add.image(Math.round(p.x) - half, Math.round(p.y) - half, key).setOrigin(0, 0).setDepth(DEPTH.SCORCH).setAlpha(0);
    p.scorch = { img, key, fadeAt: Infinity, born: this.now };
  }

  private updateFire(p: Place): void {
    let lit = 0;
    for (const f of p.flames) {
      const on = p.level > f.at;
      // A chama que apaga solta um fio de fumaça
      if (!on && f.sprite.visible && p.closing) combatFx(this.scene)?.smoke(f.sprite.x, f.sprite.y - FLAMES[f.kind].footY * 0.6);
      f.sprite.setVisible(on);
      if (on) lit++;
    }
    // O chão vai queimando enquanto o fogo arde
    if (p.scorch) p.scorch.img.setAlpha(Math.min(1, (this.now - p.scorch.born) / 6));
    if (lit === 0 || this.now < p.nextSmoke) return;
    p.nextSmoke = this.now + PLACES.SMOKE_EVERY * Math.min(2, 6 / lit);
    const lights = p.flames.filter((f) => f.sprite.visible);
    const f = lights[Math.floor(Math.random() * lights.length)];
    combatFx(this.scene)?.smoke(f.sprite.x + rand(-2, 2), f.sprite.y - FLAMES[f.kind].h * 0.7, f.kind === "BONFIRE" ? 1 : 0.5);
  }

  private updateScorches(): void {
    for (let i = this.scorches.length - 1; i >= 0; i--) {
      const s = this.scorches[i];
      const k = (this.now - s.fadeAt) / PLACES.SCORCH_FADE;
      if (k >= 1) {
        this.dropScorch(s);
        this.scorches.splice(i, 1);
      } else if (k > 0) s.img.setAlpha(1 - k);
    }
  }

  // --- Fogo apagado ---

  /** Apaga as chamas fixas dentro de onde o fogo foi apagado (e acende de volta as de fora). */
  private scanFlames(): void {
    const fx = combatFx(this.scene);
    for (const s of placedFlames()) {
      if (s.scene !== this.scene) continue;
      const out = this.doused(s);
      if (out && !this.hidden.has(s)) {
        this.hidden.set(s, s.alpha);
        s.setAlpha(0);
        if (s.visible) fx?.smoke(s.x, s.y - 8, 1.5);
      } else if (!out && this.hidden.has(s)) {
        s.setAlpha(this.hidden.get(s) ?? 1);
        this.hidden.delete(s);
      }
    }
    for (const s of this.hidden.keys()) if (!s.active) this.hidden.delete(s);
  }

  private restoreAll(): void {
    for (const [s, alpha] of this.hidden) if (s.active) s.setAlpha(alpha);
    this.hidden.clear();
  }

  // --- Fim ---

  private drop(p: Place): void {
    this.places.delete(p.id);
    for (const b of p.banks) b.img.destroy();
    for (const f of p.flames) f.sprite.destroy();
    p.overlay?.destroy();
    if (p.key && this.scene.textures.exists(p.key)) this.scene.textures.remove(p.key);
    // O chão queimado fica um tempo depois do fogo
    if (p.scorch) {
      p.scorch.fadeAt = this.now + PLACES.SCORCH_LINGER;
      this.scorches.push(p.scorch);
    }
    this.count();
    if (p.kind === "FREEZE") this.refreeze(p);
  }

  private dropScorch(s: Scorch): void {
    s.img.destroy();
    if (this.scene.textures.exists(s.key)) this.scene.textures.remove(s.key);
  }

  private count(): void {
    let dousing = 0;
    let fogs = 0;
    for (const q of this.places.values()) {
      if (q.kind === "DOUSE" && !q.closing) dousing++;
      if (q.kind === "FOG") fogs++;
    }
    this.dousing = dousing;
    this.fogs = fogs;
  }

  destroy(): void {
    this.clear();
  }
}
