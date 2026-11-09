import Phaser from "phaser";
import { sheetKey, type Lod } from "../art/atlas";
import {
  chipFrame,
  fxSheet,
  FX_CELL,
  missileDir,
  missileFrame,
  puffFrame,
  PUFF_FRAMES,
  SHADOW_FRAME,
  slashFrame,
  slashSheet,
  SLASH_CELL,
  SLASH_DIRS,
  SLASH_FRAMES,
  stainFrame,
  STAINS,
  stuckFrame,
  type DustKind,
  type Matter,
  type MissileKind,
} from "../art/combatFx";
import type { Unit } from "../entities/Unit";
import { BALANCE, type TerrainType } from "../../utils/constants";
import type { Point } from "../../utils/math";

type Bob = Phaser.GameObjects.Bob;

const FX_KEY = "fx:combat";
const SLASH_KEY = "fx:slash";
const HALF = FX_CELL / 2;

/** Quanto fica de cada coisa de uma vez (o mais antigo sai quando chega mais um). */
const LIMIT = { STUCK: 400, STAINS: 600, PUFFS: 500, CHIPS: 400 };
/** Tempo de jogo até a marca no chão começar a sumir, e quanto leva sumindo. */
const LINGER = { STUCK: 60_000, STAIN: 90_000, FADE: 5000 };
const GRAVITY = 420;
/** Um quadro do golpe do Comandante, em ms. */
const SLASH_MS = 60;

/** Bobs de um `Blitter`, reaproveitados (criar e destruir bob a cada flecha custa). */
class Pool {
  private readonly free: Bob[] = [];
  constructor(readonly blitter: Phaser.GameObjects.Blitter) {}

  take(frame: number, x: number, y: number): Bob {
    const b = this.free.pop();
    if (!b) return this.blitter.create(x, y, frame);
    b.reset(x, y, frame);
    b.setAlpha(1);
    return b;
  }

  give(b: Bob): void {
    b.setVisible(false);
    this.free.push(b);
  }
}

/** Um projétil no ar: anda no relógio do jogo, junto com a queda que decide em quem acerta. */
export interface Flight {
  kind: MissileKind;
  from: Point;
  to: Point;
  height: number;
  flat: boolean;
  timer: Phaser.Time.TimerEvent;
  bob: Bob;
  shadow: Bob;
}

interface Decal {
  bob: Bob;
  at: number;
  linger: number;
}

interface Puff {
  bob: Bob;
  x: number;
  y: number;
  vx: number;
  vy: number;
  age: number;
  life: number;
  dust: DustKind;
  /** Transparência no começo: o rastro do galope é leve; a nuvem do choque, cheia. */
  alpha: number;
}

interface Chip {
  bob: Bob;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  matter: Matter;
  size: 0 | 1;
  life: number;
}

/** Por onde anda quem galopa: a última posição e quando sai a próxima nuvem de poeira. */
interface Hoof {
  x: number;
  y: number;
  next: number;
}

/** O chão com o tempo (do `GroundWeather`): a poeira vira lama no molhado e neve no branco. */
export interface GroundState {
  wetness: number;
  snow: number;
}

const rand = (a: number, b: number) => a + Math.random() * (b - a);

/**
 * Os efeitos de combate (G6, parte 3). Flechas, virotes e dardos voam em arco (com a sombra no
 * chão) e, se não acertam ninguém, ficam fincados. Quem leva um golpe respinga sangue (osso, nos
 * mortos-vivos; lascas, nos carros), que mancha o chão; quem cai deixa uma poça. A cavalaria
 * levanta poeira a galope, e a investida, uma nuvem onde bate. Aço contra aço solta faísca.
 * As marcas no chão somem devagar e só aparecem de perto, como os corpos.
 */
export class CombatEffects {
  /** O que está na tela agora (os testes conferem). */
  stats = { flying: 0, stuck: 0, stains: 0, puffs: 0, chips: 0, impacts: 0, sparks: 0 };
  /** Onde a última investida bateu. */
  lastImpact: Point | null = null;

  private readonly air: Pool;
  private readonly litter: Pool;
  private readonly stainPool: Pool;
  private readonly cloud: Pool;
  private readonly flights = new Set<Flight>();
  private readonly stuck: Decal[] = [];
  private readonly stains: Decal[] = [];
  private readonly puffs: Puff[] = [];
  private readonly chips: Chip[] = [];
  private readonly hooves = new WeakMap<Unit, Hoof>();
  private now = 0;
  private lod: Lod = "FULL";

  constructor(
    readonly scene: Phaser.Scene,
    private readonly ground: () => GroundState,
    private readonly terrainAt: (x: number, y: number) => TerrainType,
  ) {
    const key = sheetKey(scene, FX_KEY, fxSheet, FX_CELL, FX_CELL);
    // Manchas: no chão, abaixo dos corpos. Fincados e sombras: logo acima dos corpos
    this.stainPool = new Pool(scene.add.blitter(0, 0, key).setDepth(-0.75));
    this.litter = new Pool(scene.add.blitter(0, 0, key).setDepth(-0.68));
    // Poeira e gotas: por cima de quem está de pé. Projéteis: bem acima, como antes
    this.cloud = new Pool(scene.add.blitter(0, 0, key).setDepth(0.06));
    this.air = new Pool(scene.add.blitter(0, 0, key).setDepth(6));
  }

  // --- Projéteis ---

  /** Solta um projétil; `timer` é a queda (o mesmo relógio do dano). */
  launch(kind: MissileKind, from: Point, to: Point, flat: boolean, timer: Phaser.Time.TimerEvent): Flight {
    const d = Math.hypot(to.x - from.x, to.y - from.y);
    const height = flat ? Math.min(12, d * 0.03) : Math.min(150, d * 0.3);
    const f: Flight = {
      kind,
      from: { x: from.x, y: from.y },
      to: { x: to.x, y: to.y },
      height,
      flat,
      timer,
      bob: this.air.take(missileFrame(kind, 0), Math.round(from.x - HALF), Math.round(from.y - HALF)),
      shadow: this.litter.take(SHADOW_FRAME, Math.round(from.x - HALF), Math.round(from.y - HALF)),
    };
    f.shadow.setAlpha(0.3);
    this.flights.add(f);
    this.place(f);
    return f;
  }

  /** O projétil chegou: some do ar e, se não pegou ninguém, fica fincado onde caiu. */
  land(f: Flight, inGround: boolean): void {
    if (!this.flights.delete(f)) return;
    this.air.give(f.bob);
    this.litter.give(f.shadow);
    if (!inGround) return;
    const t = this.terrainAt(f.to.x, f.to.y);
    if (t === "WATER" || t === "SHALLOW" || t === "WALL" || t === "BUILDING") return;
    const fromLeft = f.from.x < f.to.x;
    // (O pé do fincado fica 2 px abaixo do pé das manchas na célula)
    this.addDecal(this.stuck, this.litter, LIMIT.STUCK, stuckFrame(f.kind, fromLeft, !f.flat), f.to.x, f.to.y - 2, LINGER.STUCK);
  }

  private place(f: Flight): void {
    const p = Math.max(0, Math.min(1, f.timer.getProgress()));
    const gx = f.from.x + (f.to.x - f.from.x) * p;
    const gy = f.from.y + (f.to.y - f.from.y) * p;
    const h = 4 * f.height * p * (1 - p);
    // A direção do desenho segue a curva: sobe no começo, desce no fim
    const angle = Math.atan2(f.to.y - f.from.y - 4 * f.height * (1 - 2 * p), f.to.x - f.from.x);
    f.bob.setFrame(missileFrame(f.kind, missileDir(angle)));
    f.bob.x = Math.round(gx - HALF);
    f.bob.y = Math.round(gy - h - HALF);
    f.shadow.x = Math.round(gx - HALF);
    f.shadow.y = Math.round(gy - HALF);
  }

  // --- Golpes ---

  /** Quem levou o golpe respinga, do lado contrário de quem bateu. */
  wound(unit: Unit, source: Unit, amount: number, ranged: boolean): void {
    const m = unit.matter;
    const foot = unit.foot;
    if (!this.near(foot)) return;
    const away = source === unit ? Math.random() * Math.PI * 2 : Math.atan2(unit.y - source.y, unit.x - source.x);
    const n = ranged ? 1 + Math.floor(Math.random() * 2) : Math.max(2, Math.min(6, Math.round(amount / 8) + 1));
    // Respingo curto: as gotas caem a um passo de quem levou o golpe
    for (let i = 0; i < n; i++) this.chip(m, foot.x, foot.y, 9 + Math.random() * 5, away + rand(-0.7, 0.7), rand(18, 50), rand(30, 80), Math.random() < 0.4 ? 1 : 0);
    if (m === "BLOOD" && Math.random() < 0.35) {
      const r = rand(2, 7);
      this.stain(m, Math.floor(Math.random() * 4), foot.x + Math.cos(away) * r, foot.y + Math.sin(away) * r * 0.5);
    }
  }

  /** Quem caiu deixa a poça (ou os ossos, ou as lascas) no chão. */
  fall(unit: Unit): void {
    const m = unit.matter;
    const foot = unit.foot;
    if (this.near(foot)) for (let i = 0; i < 4; i++) this.chip(m, foot.x, foot.y, 6, Math.random() * Math.PI * 2, rand(12, 35), rand(30, 70), 1);
    // A poça vai para baixo do corpo, onde ele para depois do empurrão (a queda leva 0,4 s)
    const v = m === "BLOOD" ? 4 + Math.floor(Math.random() * 2) : 1;
    this.scene.time.delayedCall(380, () => {
      const at = unit.active ? unit.foot : foot;
      this.stain(m, v, at.x + rand(-2, 2), at.y + 1);
    });
  }

  /** Aço no aço: o golpe aparado solta faísca entre os dois. */
  spark(a: Unit, b: Unit): void {
    const x = (a.x * 0.35 + b.x * 0.65);
    const y = (a.foot.y * 0.35 + b.foot.y * 0.65);
    if (!this.near({ x, y })) return;
    this.stats.sparks++;
    const n = 2 + Math.floor(Math.random() * 2);
    for (let i = 0; i < n; i++) this.chip("SPARK", x, y, 12 + Math.random() * 4, Math.random() * Math.PI * 2, rand(30, 80), rand(30, 80), i === 0 ? 1 : 0, 0.28);
  }

  /** A investida bateu: uma nuvem de poeira que se vê de longe. `power` 1 = carga cheia. */
  impact(x: number, y: number, angle: number, power = 1): void {
    this.stats.impacts++;
    this.lastImpact = { x, y };
    if (!this.near({ x, y }, 600)) return;
    const dust = this.dustAt(x, y);
    const n = Math.round(6 + 6 * Math.min(1.5, power));
    for (let i = 0; i < n; i++) {
      const a = angle + rand(-1.6, 1.6);
      const r = rand(0, 16) * Math.sqrt(power);
      const out = rand(14, 40);
      this.puff(x + Math.cos(a) * r, y + Math.sin(a) * r * 0.6, Math.cos(a) * out, Math.sin(a) * out * 0.5 - 4, rand(1100, 1900), dust, -rand(0, 180), 0.85);
    }
  }

  // --- A cada quadro ---

  update(time: number, dt: number, units: readonly Unit[], lod: Lod): void {
    this.now = time;
    if (lod !== this.lod) {
      this.lod = lod;
      const near = lod === "FULL";
      this.stainPool.blitter.setVisible(near);
      this.litter.blitter.setVisible(near);
    }
    for (const f of this.flights) this.place(f);
    this.gallop(time, dt, units);
    this.updatePuffs(dt);
    this.updateChips(dt);
    this.fade(this.stuck, this.litter);
    this.fade(this.stains, this.stainPool);
    this.stats.flying = this.flights.size;
    this.stats.stuck = this.stuck.length;
    this.stats.stains = this.stains.length;
    this.stats.puffs = this.puffs.length;
    this.stats.chips = this.chips.length;
  }

  /** A cavalaria a galope levanta poeira atrás dos cascos (mais na investida). */
  private gallop(time: number, dt: number, units: readonly Unit[]): void {
    if (dt <= 0) return;
    const v = this.scene.cameras.main.worldView;
    for (const u of units) {
      if (!u.mounted || !u.isAlive) continue;
      let h = this.hooves.get(u);
      if (!h) {
        this.hooves.set(u, { x: u.x, y: u.y, next: time + Math.random() * 150 });
        continue;
      }
      const dx = u.x - h.x;
      const dy = u.y - h.y;
      h.x = u.x;
      h.y = u.y;
      const speed = Math.hypot(dx, dy) / dt;
      if (speed < Math.max(70, u.speed * 0.6) || time < h.next) continue;
      if (u.x < v.x - 60 || u.x > v.right + 60 || u.y < v.y - 60 || u.y > v.bottom + 60) continue;
      const charging = u.chargeDistance > 0;
      h.next = time + (charging ? rand(110, 170) : rand(180, 300));
      const a = Math.atan2(dy, dx);
      const foot = u.foot;
      this.puff(foot.x - Math.cos(a) * 9 + rand(-3, 3), foot.y - Math.sin(a) * 4 + rand(-1, 2), -Math.cos(a) * 18, -Math.sin(a) * 9 - 3, charging ? rand(600, 850) : rand(400, 600), this.dustAt(foot.x, foot.y), 0, charging ? 0.55 : 0.4);
    }
  }

  private dustAt(x: number, y: number): DustKind {
    const g = this.ground();
    const t = this.terrainAt(x, y);
    if (g.snow > 0.45 || t === "WATER" || t === "SHALLOW" || t === "ICE") return "SNOW";
    if (t === "MUD" || t === "SWAMP" || g.wetness > 0.5) return "MUD";
    return "DRY";
  }

  private puff(x: number, y: number, vx: number, vy: number, life: number, dust: DustKind, age: number, alpha: number): void {
    if (this.puffs.length >= LIMIT.PUFFS) this.cloud.give(this.puffs.shift()!.bob);
    const bob = this.cloud.take(puffFrame(dust, 0), Math.round(x - HALF), Math.round(y - HALF - 2));
    bob.setVisible(age >= 0).setAlpha(alpha);
    this.puffs.push({ bob, x, y, vx, vy, age, life, dust, alpha });
  }

  private updatePuffs(dt: number): void {
    const ms = dt * 1000;
    let w = 0;
    for (const p of this.puffs) {
      p.age += ms;
      if (p.age >= p.life) {
        this.cloud.give(p.bob);
        continue;
      }
      this.puffs[w++] = p;
      if (p.age < 0) continue;
      // Sai depressa e para: a poeira fica pairando onde a investida bateu
      const slow = Math.max(0, 1 - p.age / (p.life * 0.6));
      p.x += p.vx * dt * slow;
      p.y += p.vy * dt * slow;
      const k = p.age / p.life;
      p.bob.setVisible(true);
      p.bob.setFrame(puffFrame(p.dust, Math.floor(k * PUFF_FRAMES)));
      p.bob.setAlpha(p.alpha * (1 - k * 0.45));
      p.bob.x = Math.round(p.x - HALF);
      p.bob.y = Math.round(p.y - HALF - 2);
    }
    this.puffs.length = w;
  }

  private chip(m: Matter, x: number, y: number, z: number, angle: number, speed: number, up: number, size: 0 | 1, life = 1.2): void {
    if (this.chips.length >= LIMIT.CHIPS) this.cloud.give(this.chips.shift()!.bob);
    const bob = this.cloud.take(chipFrame(m, size), Math.round(x - HALF), Math.round(y - z - HALF));
    this.chips.push({ bob, x, y, z, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed * 0.5, vz: up, matter: m, size, life });
  }

  private updateChips(dt: number): void {
    let w = 0;
    for (const c of this.chips) {
      c.life -= dt;
      c.vz -= GRAVITY * dt;
      c.z += c.vz * dt;
      c.x += c.vx * dt;
      c.y += c.vy * dt;
      if (c.z <= 0 || c.life <= 0) {
        // A gota que cai deixa um pingo no chão (as faíscas apagam no ar)
        if (c.z <= 0 && c.matter === "BLOOD" && c.size === 1 && Math.random() < 0.3) this.stain("BLOOD", 0, c.x, c.y);
        this.cloud.give(c.bob);
        continue;
      }
      this.chips[w++] = c;
      if (c.matter === "SPARK") c.bob.setAlpha(Math.min(1, c.life * 6));
      c.bob.x = Math.round(c.x - HALF);
      c.bob.y = Math.round(c.y - c.z - HALF);
    }
    this.chips.length = w;
  }

  private stain(m: Matter, v: number, x: number, y: number): void {
    if (STAINS[m] === 0) return;
    this.addDecal(this.stains, this.stainPool, LIMIT.STAINS, stainFrame(m, v), x, y, LINGER.STAIN);
  }

  private addDecal(list: Decal[], pool: Pool, limit: number, frame: number, x: number, y: number, linger: number): void {
    if (list.length >= limit) pool.give(list.shift()!.bob);
    // O pé da marca fica a 10 px do alto da célula (as manchas e os fincados são desenhados assim)
    const bob = pool.take(frame, Math.round(x - HALF), Math.round(y - 10));
    list.push({ bob, at: this.now, linger });
  }

  /** As marcas mais velhas somem aos poucos (em ordem: só as primeiras podem estar sumindo). */
  private fade(list: Decal[], pool: Pool): void {
    const now = this.now;
    while (list.length > 0 && now - list[0].at >= list[0].linger + LINGER.FADE) pool.give(list.shift()!.bob);
    for (const d of list) {
      const age = now - d.at;
      if (age < d.linger) break;
      d.bob.setAlpha(1 - (age - d.linger) / LINGER.FADE);
    }
  }

  /** Perto da câmera (as gotas e a poeira longe da tela não valem o custo). */
  private near(p: Point, margin = 200): boolean {
    const v = this.scene.cameras.main.worldView;
    return p.x > v.x - margin && p.x < v.right + margin && p.y > v.y - margin && p.y < v.bottom + margin;
  }

  destroy(): void {
    for (const p of [this.air, this.litter, this.stainPool, this.cloud]) p.blitter.destroy();
    this.flights.clear();
  }
}

// --- O golpe em meia-lua (vale em qualquer cena) ---

/** O golpe do Comandante: a meia-lua da lâmina, em 3 quadros, virada para onde ele bate. */
export function slashSprite(scene: Phaser.Scene, x: number, y: number, facing: number): Phaser.GameObjects.Image {
  const key = sheetKey(scene, SLASH_KEY, () => slashSheet(BALANCE.COMMANDER_SWING_ARC), SLASH_CELL, SLASH_CELL);
  const dir = ((Math.round((facing / (Math.PI * 2)) * SLASH_DIRS) % SLASH_DIRS) + SLASH_DIRS) % SLASH_DIRS;
  const img = scene.add.image(Math.round(x), Math.round(y), key, slashFrame(dir, 0)).setDepth(5);
  let f = 0;
  scene.time.addEvent({
    delay: SLASH_MS,
    repeat: SLASH_FRAMES - 1,
    callback: () => {
      f++;
      if (f >= SLASH_FRAMES || !img.active) img.destroy();
      else img.setFrame(slashFrame(dir, f));
    },
  });
  return img;
}

// --- A camada da cena de agora ---

let active: CombatEffects | null = null;

/** A cena do mapa liga os efeitos ao criar e desliga ao fechar. */
export function setCombatFx(fx: CombatEffects | null): void {
  active = fx;
}

/** Os efeitos da cena (null fora do mapa: nas outras cenas, nada respinga). */
export function combatFx(scene: Phaser.Scene): CombatEffects | null {
  return active && active.scene === scene ? active : null;
}
