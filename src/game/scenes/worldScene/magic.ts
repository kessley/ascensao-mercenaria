import { Unit } from "../../entities/Unit";
import type { Battalion } from "../../entities/Battalion";
import { sheetKey } from "../../art/atlas";
import { BLAST_CELL, BLAST_FRAMES, BLAST_RADIUS, blastSheet, fireballSheet, FIREBALL_CELL, FIREBALL_FRAMES, mendSheet, MEND_CELL, MEND_FRAMES, RING_FRAMES, ringSheet } from "../../art/magicArt";
import { arcaneMax, blastDamage, castProblem, mendAmount, MARK_TEXT, spellDef, SPELL_KEY_LABEL, SPELL_KEYS, type SpellId } from "../../sim/magic";
import type { Light } from "../../world/NightLayer";
import { sfx } from "../../../audio/sounds";
import { useGameStore, type MagicHud } from "../../../store/useGameStore";
import { BALANCE, ENEMIES, MAGIC } from "../../../utils/constants";
import { angleTo, distance, type Point } from "../../../utils/math";
import type { WorldScene } from "../WorldScene";

const FIREBALL_KEY = "magic:fireball";
const MEND_KEY = "magic:mend";
const BLAST_KEY = "magic:blast";
/** A cada quanto o fogo no chão queima quem está dentro (s). */
const BURN_TICK = 0.5;

/** A cor de cada magia: a mira, o anel e o nome que sobe do Comandante. */
const SPELL_COLOR: Record<SpellId, number> = {
  FIREBALL: 0xf07a1a,
  MEND: 0x9ccc5a,
  FREEZE: 0x9fd8ff,
  MIST: 0xc8ccd4,
  DOUSE: 0xa89478,
  TERROR: 0xb070e0,
};
const css = (c: number) => `#${c.toString(16).padStart(6, "0")}`;

/** O efeito do G6 que cada magia do mundo liga, por quanto tempo, e o aviso. */
const PLACE_SPELL = {
  FREEZE: { kind: "FREEZE", seconds: MAGIC.WORLD.FREEZE_SECONDS, feed: "Congelar: a água vira gelo, que se atravessa a pé até derreter." },
  MIST: { kind: "FOG", seconds: MAGIC.WORLD.MIST_SECONDS, feed: "Nevoeiro: quem está lá dentro enxerga pouco e só é visto de perto." },
  DOUSE: { kind: "DOUSE", seconds: MAGIC.WORLD.DOUSE_SECONDS, feed: "O fogo se apaga: tochas, fogueiras e chamas. À noite, quem está ali fica no escuro." },
} as const;
type PlaceSpell = keyof typeof PLACE_SPELL;
const isPlaceSpell = (s: SpellId): s is PlaceSpell => s in PLACE_SPELL;

/** Um clarão passageiro na noite (a bola no ar, a explosão). */
export interface MagicFlash {
  light: Light;
  until: number;
  /** O raio some até o fim (a explosão); sem isso, fica igual (a bola no ar). */
  fade: number;
}

/**
 * Uma animação da magia no relógio da cena (a bola no ar, as faíscas da cura): para na pausa e
 * anda com a câmera lenta, como as flechas. `tick` recebe o progresso de 0 a 1.
 */
export interface MagicAnim {
  start: number;
  duration: number;
  tick: (p: number) => void;
  done: () => void;
}

/** A tropa de quem foi pego (para a moral cair uma vez por tropa). */
function groupOf(u: Unit): object | null {
  const g = (u as unknown as { squad?: object | null; battalion?: object | null }).squad ?? (u as unknown as { battalion?: object | null }).battalion;
  return g ?? null;
}

/**
 * A magia do Comandante em campo (Marco 19): as teclas 5 a 0 armam a mira de uma magia, o clique
 * esquerdo lança, e o direito (ou o Esc) desiste. A bola de fogo voa em arco e explode onde cai; a
 * cura fecha as feridas do batalhão mais perto do ponto (parte 1). Congelar, nevoeiro e apagar o
 * fogo ligam os efeitos do G6 no ponto; o pavor quebra a moral de quem pega (parte 2).
 */
export const magicMethods = {
  setupMagic(this: WorldScene): void {
    this.aimGfx = this.add.graphics().setDepth(19);
    const keyboard = this.input.keyboard;
    if (!keyboard) return;
    SPELL_KEYS.forEach((name, i) => {
      keyboard.addKey(name).on("down", () => {
        const spell = useGameStore.getState().spells[i];
        if (spell && !this.ended && !this.inDuel()) this.aimSpell(this.aiming === spell ? null : spell);
      });
    });
  },

  /** Segundos até a magia poder ser lançada de novo (0 = pronta). */
  spellReadyIn(this: WorldScene, spell: SpellId): number {
    return Math.max(0, ((this.spellReadyAt[spell] ?? -Infinity) - this.time.now) / 1000);
  },

  /** Arma (ou desarma, com null) a mira de uma magia. Sem arcano ou na recarga, avisa e não arma. */
  aimSpell(this: WorldScene, spell: SpellId | null): void {
    if (spell) {
      const s = useGameStore.getState();
      const problem = castProblem(spell, { known: s.spells, arcane: s.arcane, readyIn: this.spellReadyIn(spell) }, this.commander, this.commander);
      if (problem) {
        this.pushFeed(problem);
        spell = null;
      }
    }
    this.aiming = spell;
    if (!spell) this.aimGfx.clear();
    this.publishHud();
  },

  /** Lança a magia armada no ponto; devolve o motivo se não deu. */
  castAt(this: WorldScene, spell: SpellId, at: Point): string | null {
    const s = useGameStore.getState();
    const c = this.commander;
    if (!c.isAlive) return "O Comandante caiu.";
    if (this.inDuel()) return "No duelo, não há tempo para magia.";
    const problem = castProblem(spell, { known: s.spells, arcane: s.arcane, readyIn: this.spellReadyIn(spell) }, c, at);
    if (problem) return problem;
    // A cura precisa de alguém para curar: sem batalhão ali, o arcano não é gasto
    const patient = spell === "MEND" ? this.mendTarget(at) : null;
    if (spell === "MEND" && !patient) return "Nenhum batalhão ali para curar.";
    if (spell === "FREEZE" && !this.waterNear(at, spellDef(spell).radius)) return "Não há água ali para congelar.";
    if (!s.spendArcane(spell)) return "Arcano de menos.";
    // O preço (parte 4): as cortes e os templos sabem, e o corpo marca
    const mark = s.payForMagic(spell);
    if (mark > 0) {
      c.floatText("uma marca nova", "#c890f0");
      this.pushFeed(`Uma marca nova no corpo do Comandante: ${MARK_TEXT[mark - 1]}.`);
    }
    const def = spellDef(spell);
    this.spellReadyAt[spell] = this.time.now + def.cooldown * 1000;
    this.aiming = null;
    this.aimGfx.clear();
    c.setFacing(angleTo(c, at));
    c.floatText(def.name, css(SPELL_COLOR[spell]));
    if (spell === "FIREBALL") this.throwFireball(at);
    else if (spell === "TERROR") this.terrorAt(at);
    else if (isPlaceSpell(spell)) this.changePlace(spell, at);
    else if (patient) this.mendBattalion(patient);
    this.publishHud();
    return null;
  },

  // --- Bola de fogo ---

  /** A bola sai da mão do Comandante e voa em arco até o ponto; lá, explode. */
  throwFireball(this: WorldScene, to: Point): void {
    const F = MAGIC.FIREBALL;
    const key = sheetKey(this, FIREBALL_KEY, fireballSheet, FIREBALL_CELL, FIREBALL_CELL);
    const from = { x: this.commander.x, y: this.commander.y - 18 };
    const ball = this.add.image(from.x, from.y, key, 0).setDepth(6);
    const flash: MagicFlash = { light: { x: from.x, y: from.y, radius: 110, glow: 0.9, flicker: 0.1 }, until: Infinity, fade: 0 };
    this.magicFlashes.push(flash);
    let lastSmoke = 0;
    this.magicAnims.push({
      start: this.time.now,
      duration: F.FLIGHT_MS,
      tick: (p) => {
        const x = from.x + (to.x - from.x) * p;
        const y = from.y + (to.y - from.y) * p - 4 * F.ARC * p * (1 - p);
        ball.setPosition(Math.round(x), Math.round(y)).setFrame(Math.floor(p * FIREBALL_FRAMES * 3) % FIREBALL_FRAMES);
        flash.light.x = x;
        flash.light.y = y;
        // O rastro de fumaça
        if (p - lastSmoke > 0.12) {
          lastSmoke = p;
          this.combatFx.smoke(x, y + 4, 0.5);
        }
      },
      done: () => {
        ball.destroy();
        flash.until = 0;
        this.explode(to);
      },
    });
  },

  /** A explosão: fere todos em volta (os do bando também), assusta as tropas pegas e deixa fogo. */
  explode(this: WorldScene, at: Point): void {
    const F = MAGIC.FIREBALL;
    const radius = MAGIC.SPELLS.FIREBALL.radius;
    const now = this.time.now;
    const hit = new Set<object>();
    let wounded = 0;
    let ours = 0;
    const units: Unit[] = [...this.allAllies().filter((u) => u !== this.commander), ...this.enemies.filter((e) => e.isAlive && !e.dormant)];
    for (const u of units) {
      const d = distance(u, at);
      const dmg = blastDamage(d, radius);
      if (dmg <= 0 || !u.isAlive) continue;
      u.scorch(dmg, at, this.commander);
      wounded++;
      if (u.team === this.commander.team) ours++;
      const g = groupOf(u);
      if (g && !hit.has(g)) {
        hit.add(g);
        u.shock(F.SHOCK);
      }
      // O sopro empurra para fora
      const push = 16 * (1 - d / radius);
      const a = d > 0.5 ? Math.atan2(u.y - at.y, u.x - at.x) : Math.random() * Math.PI * 2;
      const nx = u.x + Math.cos(a) * push;
      const ny = u.y + Math.sin(a) * push;
      if (!Unit.terrain?.isBlocked(nx, ny)) {
        u.x = nx;
        u.y = ny;
      }
    }
    // O clarão: o miolo de calor e o anel que corre até a borda da área
    const key = sheetKey(this, BLAST_KEY, blastSheet, BLAST_CELL, BLAST_CELL);
    const burst = this.add
      .image(Math.round(at.x), Math.round(at.y), key, 0)
      .setDepth(6)
      .setScale(radius / BLAST_RADIUS)
      .setAngle(90 * Math.floor(Math.random() * 4));
    this.magicAnims.push({
      start: now,
      duration: F.BLAST_MS,
      tick: (p) => {
        burst.setFrame(Math.min(BLAST_FRAMES - 1, Math.floor(p * BLAST_FRAMES)));
        burst.setAlpha(p < 0.75 ? 1 : Math.max(0, (1 - p) * 4));
      },
      done: () => burst.destroy(),
    });
    this.combatFx.blast(at.x, at.y, radius);
    if (ours > 0 && this.run) this.run.friendlyFire += ours;
    this.places.add({ kind: "FIRE", x: at.x, y: at.y, r: radius * 0.8, seconds: F.FIRE_SECONDS });
    this.magicFlashes.push({ light: { x: at.x, y: at.y, radius: radius * 3, glow: 1, flicker: 0.12 }, until: now + 500, fade: 500 });
    this.cameras.main.shake(180, 0.004);
    sfx.charge(at);
    this.lastBlast = { at, wounded, ours, groups: hit.size };
    if (wounded === 0) this.pushFeed("Bola de fogo! A explosão não pegou ninguém.");
    else if (ours > 0) this.pushFeed(`Bola de fogo! ${wounded} pegos pela explosão, ${ours} deles dos nossos.`);
    else this.pushFeed(`Bola de fogo! ${wounded} pegos pela explosão.`);
  },

  // --- Cura ---

  /** O batalhão que a cura pega: o mais perto do ponto, dentro do raio dela. */
  mendTarget(this: WorldScene, at: Point): Battalion | null {
    const radius = MAGIC.SPELLS.MEND.radius;
    let best: Battalion | null = null;
    let bestD = Infinity;
    for (const b of this.battalions) {
      if (b.isDestroyed) continue;
      const near = Math.min(distance(b.center, at), ...b.soldiers.filter((s) => s.isAlive).map((s) => distance(s, at)));
      if (near <= radius && near < bestD) {
        best = b;
        bestD = near;
      }
    }
    return best;
  },

  /** As feridas se fecham e o ânimo volta; quem estava em pânico pode se reagrupar. */
  mendBattalion(this: WorldScene, b: Battalion): void {
    const key = sheetKey(this, MEND_KEY, mendSheet, MEND_CELL, MEND_CELL);
    let healed = 0;
    for (const s of b.soldiers) {
      if (!s.isAlive) continue;
      const add = mendAmount(s.hp, s.maxHp);
      if (add > 0) {
        s.restoreHp(s.hp + add);
        healed += add;
      }
      // Faíscas de luz que sobem de cada um
      for (let k = 0; k < 2; k++) {
        const spark = this.add.image(Math.round(s.x + (Math.random() - 0.5) * 14), Math.round(s.y - 4 - Math.random() * 16), key, 0).setDepth(6);
        const y0 = spark.y;
        spark.setVisible(false);
        this.magicAnims.push({
          start: this.time.now + k * 160 + Math.random() * 120,
          duration: 700,
          tick: (p) => {
            spark.setVisible(p >= 0);
            if (p < 0) return;
            spark.setFrame(Math.min(MEND_FRAMES - 1, Math.floor(p * MEND_FRAMES)));
            spark.y = Math.round(y0 - p * 14);
          },
          done: () => spark.destroy(),
        });
      }
    }
    const M = BALANCE.MORALE;
    b.morale = Math.min(M.MAX, b.morale + MAGIC.MEND.MORALE);
    if (b.panicking && b.morale >= MAGIC.MEND.RALLY_ABOVE) b.rally();
    this.magicFlashes.push({ light: { ...b.center, radius: 200, glow: 0.6, tint: 0xb6f07a, flicker: 0.02 }, until: this.time.now + 900, fade: 900 });
    sfx.banner(b.center);
    this.lastMend = { battalion: b.id, healed: Math.round(healed) };
    this.pushFeed(`Cura: ${b.name} recupera ${Math.round(healed)} de vida e o ânimo.`);
  },

  // --- As magias que mexem no mundo (parte 2) ---

  /** Há água (rio, lago ou raso) dentro do círculo? Procura numa grade, no chão sem o gelo da magia. */
  waterNear(this: WorldScene, at: Point, r: number): boolean {
    const t = Unit.terrain;
    if (!t) return false;
    const step = 16;
    for (let dy = -r; dy <= r; dy += step) {
      for (let dx = -r; dx <= r; dx += step) {
        if (dx * dx + dy * dy > r * r) continue;
        const k = t.unfrozenTypeAt(at.x + dx, at.y + dy);
        if (k === "WATER" || k === "SHALLOW") return true;
      }
    }
    return false;
  },

  /** Congelar, nevoeiro e apagar o fogo: o efeito do G6 ligado no ponto, por um tempo. */
  changePlace(this: WorldScene, spell: PlaceSpell, at: Point): void {
    const def = spellDef(spell);
    const P = PLACE_SPELL[spell];
    const id = this.places.add({ kind: P.kind, x: at.x, y: at.y, r: def.radius, seconds: P.seconds });
    this.castRing(at, def.radius, SPELL_COLOR[spell]);
    sfx.banner(at);
    this.lastPlaceSpell = { spell, id, at: { x: at.x, y: at.y } };
    this.pushFeed(P.feed);
  },

  /**
   * O pavor: uma onda de medo que não escolhe lado. Cada tropa pega perde moral de uma vez e não se
   * recompõe por um tempo; as de perto da borda se abalam. Quem não sente medo (os mortos-vivos) nem pisca.
   */
  terrorAt(this: WorldScene, at: Point, by: string | null = null): void {
    const radius = MAGIC.SPELLS.TERROR.radius;
    const T = MAGIC.TERROR;
    const now = this.time.now;
    // De cada tropa, o soldado mais perto do ponto
    const nearest = new Map<object, { unit: Unit; d: number }>();
    const units: Unit[] = [...this.allAllies().filter((u) => u !== this.commander), ...this.enemies.filter((e) => e.isAlive && !e.dormant)];
    for (const u of units) {
      const g = groupOf(u);
      if (!g || !u.isAlive) continue;
      const d = distance(u, at);
      const cur = nearest.get(g);
      if (!cur || d < cur.d) nearest.set(g, { unit: u, d });
    }
    let struck = 0;
    let shaken = 0;
    let fearless = 0;
    let ours = 0;
    for (const [g, { unit, d }] of nearest) {
      if (d > radius * T.NEAR) continue;
      const group = g as { dreadUntil?: number; mods?: { moraleLoss: number } };
      if (group.mods?.moraleLoss === 0) {
        fearless++;
        unit.floatText("sem medo", "#b8b8b8");
        continue;
      }
      if (unit.team === this.commander.team) ours++;
      if (d <= radius) {
        struck++;
        unit.shock(T.SHOCK);
        group.dreadUntil = now + T.DREAD_MS;
        unit.floatText("pavor!", "#d8a8f0");
      } else {
        shaken++;
        unit.shock(T.NEAR_SHOCK);
      }
    }
    this.castRing(at, radius, SPELL_COLOR.TERROR);
    this.castRing(at, radius * T.NEAR, SPELL_COLOR.TERROR, 0.5);
    this.cameras.main.shake(260, 0.003);
    sfx.thud(at);
    this.lastTerror = { at: { x: at.x, y: at.y }, struck, shaken, fearless, ours, by };
    if (by) this.pushFeed(`${by} lança o pavor: ${ours > 0 ? `${ours} tropas do bando tomadas pelo medo` : "o medo não pegou ninguém do bando"}.`);
    else if (struck + shaken === 0) this.pushFeed(fearless > 0 ? "Pavor! Mas quem estava ali não sente medo." : "Pavor! Mas não havia ninguém ali para sentir.");
    else if (ours > 0) this.pushFeed(`Pavor! ${struck + shaken} tropas tomadas pelo medo, ${ours} delas do bando.`);
    else this.pushFeed(`Pavor! ${struck + shaken} tropas tomadas pelo medo.`);
  },

  /**
   * A resposta mágica da calamidade (parte 4): o Lorde Necromante lança o pavor no batalhão do bando
   * mais cheio ao alcance dele, de tempos em tempos. Os mortos dele não sentem; quem é do bando, sim.
   */
  updateNecromancers(this: WorldScene): void {
    const N = MAGIC.NECRO;
    const now = this.time.now;
    for (const e of this.enemies) {
      if (e.kind !== "NECROMANCER" || !e.isAlive || e.dormant || e.friendly) continue;
      const ready = this.necroReadyAt.get(e);
      const near = this.battalions.filter((b) => !b.isDestroyed && b.soldiers.some((u) => u.isAlive && distance(u, e) <= N.TERROR_RANGE));
      if (near.length === 0) continue;
      // Ao ver o bando pela primeira vez, ele leva um instante para começar
      if (ready === undefined) {
        this.necroReadyAt.set(e, now + N.FIRST_MS);
        continue;
      }
      if (now < ready) continue;
      const target = near.reduce((a, b) => (b.soldiers.filter((u) => u.isAlive).length > a.soldiers.filter((u) => u.isAlive).length ? b : a));
      e.floatText("Pavor", css(SPELL_COLOR.TERROR));
      this.terrorAt(target.center, `O ${ENEMIES.NECROMANCER.label}`);
      this.necroReadyAt.set(e, now + N.TERROR_EVERY * 1000);
    }
  },

  /** O anel da magia: corre do ponto até a borda da área, na cor dela, e se desfaz (com um clarão na noite). */
  castRing(this: WorldScene, at: Point, r: number, color: number, alpha = 1): void {
    const R = Math.round(r);
    const key = sheetKey(this, `magic:ring:${R}`, () => ringSheet(R), R * 2, R * 2);
    const img = this.add.image(Math.round(at.x), Math.round(at.y), key, 0).setDepth(6).setTint(color).setAlpha(alpha);
    this.magicAnims.push({
      start: this.time.now,
      duration: MAGIC.WORLD.RING_MS,
      tick: (p) => {
        img.setFrame(Math.min(RING_FRAMES - 1, Math.floor(p * RING_FRAMES)));
        img.setAlpha(alpha * (p < 0.7 ? 1 : Math.max(0, (1 - p) / 0.3)));
      },
      done: () => img.destroy(),
    });
    this.magicFlashes.push({ light: { x: at.x, y: at.y, radius: r * 1.2, glow: 0.5 * alpha, tint: color, flicker: 0.02 }, until: this.time.now + 700, fade: 700 });
  },

  // --- A cada quadro ---

  /** A mira, o fogo no chão queimando quem está dentro e os clarões passageiros. */
  updateMagic(this: WorldScene, time: number, dt: number, units: readonly Unit[]): void {
    this.drawAim();
    const now = this.time.now;
    if (this.magicAnims.length > 0) {
      const running = this.magicAnims;
      this.magicAnims = [];
      for (const a of running) {
        const p = (now - a.start) / a.duration;
        if (p >= 1) {
          a.tick(1);
          a.done();
        } else {
          a.tick(p);
          this.magicAnims.push(a);
        }
      }
    }
    this.magicFlashes = this.magicFlashes.filter((f) => time < f.until);
    for (const f of this.magicFlashes) if (f.fade > 0) f.light.radius = Math.max(1, f.light.radius * (1 - dt * (1000 / f.fade) * 0.5));
    this.updateNecromancers();
    this.burnClock += dt;
    if (this.burnClock < BURN_TICK) return;
    this.burnClock -= BURN_TICK;
    for (const u of units) {
      if (!u.isAlive || !this.places.burningAt(u)) continue;
      u.scorch(MAGIC.FIREBALL.BURN_PER_SEC * BURN_TICK, null, this.commander);
    }
  },

  drawAim(this: WorldScene): void {
    const g = this.aimGfx;
    const spell = this.aiming;
    g.clear();
    if (!spell || !this.commander.isAlive) return;
    const def = spellDef(spell);
    const c = this.commander;
    const p = this.input.activePointer;
    const at = this.cameras.main.getWorldPoint(p.x, p.y);
    const reach = distance(c, at) <= def.range;
    const color = !reach ? 0x9a9a9a : SPELL_COLOR[spell];
    // O alcance em volta do Comandante e a área no ponto
    g.lineStyle(1, color, 0.35).strokeCircle(c.x, c.y, def.range);
    g.fillStyle(color, reach ? 0.16 : 0.08).fillCircle(at.x, at.y, def.radius);
    g.lineStyle(2, color, reach ? 0.85 : 0.4).strokeCircle(at.x, at.y, def.radius);
    if (spell === "MEND" && reach) {
      const b = this.mendTarget(at);
      if (b) g.lineStyle(2, 0xf8e070, 0.9).strokeCircle(b.center.x, b.center.y, 34);
    }
  },

  /** Os clarões da magia, para a noite. */
  magicLights(this: WorldScene): Light[] {
    return this.magicFlashes.map((f) => f.light);
  },

  /** A magia para o HUD (null = o Comandante não sabe nenhuma). */
  magicHud(this: WorldScene): MagicHud | null {
    const s = useGameStore.getState();
    if (s.spells.length === 0) return null;
    return {
      arcane: Math.floor(s.arcane),
      max: arcaneMax(s.artifacts),
      aiming: this.aiming,
      spells: s.spells.map((id, i) => {
        const def = spellDef(id);
        return { id, name: def.name, hint: def.hint, cost: def.cost, readyIn: Math.ceil(this.spellReadyIn(id)), key: SPELL_KEY_LABEL[i] ?? "" };
      }),
    };
  },
};

export type MagicMethods = typeof magicMethods;
