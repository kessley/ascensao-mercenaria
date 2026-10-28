import Phaser from "phaser";
import { BALANCE, COLORS, TERRAIN, TIME, type AttackKind, type TerrainType, type UnitStats } from "../../utils/constants";
import { distance } from "../../utils/math";
import { sfx } from "../../audio/sounds";
import type { TerrainMap } from "../world/TerrainMap";

export type Team = "ALLY" | "ENEMY";
export type UnitState = "IDLE" | "MOVING" | "ATTACKING" | "FLEEING" | "DEAD";

/**
 * Base de toda unidade em campo. Desenhada só com primitivas:
 * `bodyGfx` (forma, gira com `facing`) e `barsGfx` (barra de HP, não gira).
 *
 * Subclasses devem chamar `this.drawBody()` ao fim do próprio construtor
 * (depois de inicializar os campos que o desenho usa).
 */
export abstract class Unit extends Phaser.GameObjects.Container {
  /** Terreno da batalha atual (definido pela BattleScene no `create`). */
  static terrain: TerrainMap | null = null;
  /** Escuridão de agora, de 0 (dia) a 1 (noite fechada); a cena atualiza a cada quadro. */
  static darkness = 0;

  readonly team: Team;
  readonly radius: number;
  readonly maxHp: number;
  readonly ranged: boolean;
  hp: number;
  speed: number;
  damage: number;
  range: number;
  cooldown: number;

  unitState: UnitState = "IDLE";
  target: Unit | null = null;
  facing = 0;
  /** false = só ataca por comando explícito (ex.: Comandante). */
  autoAttack = true;
  lastAttackAt = -Infinity;
  lastHitFrom: Unit | null = null;
  lastHitAt = -Infinity;

  /** Cavalaria: acumula distância percorrida para a investida. */
  canCharge = false;
  chargeDistance = 0;
  /** Parâmetros da investida (habilidades da cavalaria alteram). */
  chargeMultiplier: number = BALANCE.CHARGE_MULTIPLIER;
  chargeMinDistance: number = BALANCE.CHARGE_MIN_DISTANCE;
  chargeKnockback: number = BALANCE.CHARGE_KNOCKBACK;
  /** Visível para o lado oposto (floresta oculta). */
  revealed = true;
  /** Chance (0–1) de desviar completamente de um golpe ou flecha (batedores, mensageiros). */
  evasion = 0;
  /** Herói (Comandante): aliados não o empurram — eles é que abrem passagem. */
  isHero = false;

  protected readonly bodyGfx: Phaser.GameObjects.Graphics;
  protected readonly barsGfx: Phaser.GameObjects.Graphics;

  constructor(scene: Phaser.Scene, x: number, y: number, team: Team, stats: UnitStats) {
    super(scene, x, y);
    this.team = team;
    this.radius = stats.radius;
    this.maxHp = stats.hp;
    this.hp = stats.hp;
    this.speed = stats.speed;
    this.damage = stats.damage;
    this.range = stats.range;
    this.cooldown = stats.cooldown;
    this.ranged = stats.ranged ?? false;

    this.bodyGfx = scene.add.graphics();
    this.barsGfx = scene.add.graphics();
    this.add([this.bodyGfx, this.barsGfx]);
    scene.add.existing(this);

    this.redrawBars();
  }

  /** Desenha a forma da unidade em `bodyGfx`, centrada em (0,0) e olhando para +X. */
  protected abstract drawBody(): void;

  get isAlive(): boolean {
    return this.unitState !== "DEAD";
  }

  get terrainType(): TerrainType {
    return Unit.terrain?.typeAt(this.x, this.y) ?? "GRASS";
  }

  get isInForest(): boolean {
    return this.terrainType === "FOREST";
  }

  /** Criatura da noite (goblins, mortos-vivos): enxerga no escuro e fica mais forte nele. */
  get nightCreature(): boolean {
    return false;
  }

  /** No escuro, criaturas da noite aceleram e todos os outros andam mais devagar. */
  private nightSpeed(): number {
    const d = Unit.darkness;
    if (d <= 0) return 1;
    return this.nightCreature ? 1 + d * (TIME.NIGHT_CREATURE_SPEED - 1) : 1 - d * (1 - TIME.NIGHT_SPEED);
  }

  // --- Modificadores (subclasses estendem com formação etc.) ---

  speedMultiplier(): number {
    const t = TERRAIN[this.terrainType];
    return (this.canCharge ? t.cavalrySpeed : t.speed) * this.nightSpeed();
  }

  attackRange(): number {
    return this.ranged && this.terrainType === "HILL" ? this.range * BALANCE.HILL_RANGE_BONUS : this.range;
  }

  get isCharging(): boolean {
    return this.canCharge && this.chargeDistance >= this.chargeMinDistance;
  }

  outgoingDamage(target: Unit): number {
    let dmg = this.damage;
    if (this.terrainType === "HILL" && target.terrainType !== "HILL") dmg *= BALANCE.HILL_DAMAGE_BONUS;
    if (this.isCharging) dmg *= this.chargeMultiplier;
    if (this.nightCreature) dmg *= 1 + Unit.darkness * (TIME.NIGHT_CREATURE_DAMAGE - 1);
    return dmg;
  }

  /** Chamado quando esta unidade abate outra (soldados creditam o batalhão). */
  onKill(): void {}

  incomingMultiplier(_source: Unit, kind: AttackKind): number {
    return kind === "RANGED" && this.isInForest ? BALANCE.FOREST_RANGED_TAKEN : 1;
  }

  // --- Movimento e combate ---

  setFacing(angle: number): void {
    this.facing = angle;
    this.bodyGfx.rotation = angle;
  }

  /** Move em direção ao ponto. Retorna true se já chegou. */
  moveTowards(tx: number, ty: number, dt: number, extraMultiplier = 1): boolean {
    const dx = tx - this.x;
    const dy = ty - this.y;
    const d = Math.hypot(dx, dy);
    if (d <= 2) return true;
    const step = Math.min(d, this.speed * this.speedMultiplier() * extraMultiplier * dt);
    this.x += (dx / d) * step;
    this.y += (dy / d) * step;
    this.setFacing(Math.atan2(dy, dx));

    if (this.canCharge) {
      this.chargeDistance = TERRAIN[this.terrainType].breaksCharge ? 0 : this.chargeDistance + step;
    }
    return false;
  }

  /** Distância de borda a borda até outra unidade. */
  edgeDistanceTo(other: Unit): number {
    return distance(this, other) - this.radius - other.radius;
  }

  inRange(other: Unit): boolean {
    return this.edgeDistanceTo(other) <= this.attackRange();
  }

  canAttack(time: number): boolean {
    return time - this.lastAttackAt >= this.cooldown;
  }

  takeDamage(amount: number, source: Unit, time: number, kind: AttackKind = "MELEE"): void {
    if (!this.isAlive) return;
    if (this.evasion > 0 && Math.random() < this.evasion) {
      this.floatText("esquiva", "#c6ff8a");
      sfx.dodge(this);
      return;
    }
    this.hp = Math.max(0, this.hp - amount * this.incomingMultiplier(source, kind));
    this.lastHitFrom = source;
    this.lastHitAt = time;
    // Revida quem bateu se não estiver ocupado com outro alvo
    if (source.isAlive && (!this.target || !this.target.isAlive)) this.target = source;

    this.redrawBars();
    this.scene.tweens.add({ targets: this.bodyGfx, alpha: 0.35, duration: 60, yoyo: true });

    if (this.hp <= 0) {
      source.onKill();
      this.die();
    }
  }

  /** Vida vinda de dados (bando que volta à bolha, jogo carregado). */
  restoreHp(hp: number): void {
    this.hp = Math.max(1, Math.min(this.maxHp, hp));
    this.redrawBars();
  }

  /** Texto curto que sobe e some acima da unidade (ex.: "esquiva"). */
  floatText(text: string, color: string): void {
    const t = this.scene.add
      .text(this.x, this.y - this.radius - 14, text, {
        fontFamily: "monospace",
        fontSize: "11px",
        color,
        stroke: "#000000",
        strokeThickness: 3,
      })
      .setOrigin(0.5)
      .setDepth(25);
    this.scene.tweens.add({ targets: t, y: t.y - 18, alpha: 0, duration: 650, onComplete: () => t.destroy() });
  }

  /** Pequena estocada visual em direção ao alvo. */
  playAttack(target: Unit): void {
    const a = Math.atan2(target.y - this.y, target.x - this.x);
    this.setFacing(a);
    this.scene.tweens.add({
      targets: this.bodyGfx,
      x: Math.cos(a) * 5,
      y: Math.sin(a) * 5,
      duration: 70,
      yoyo: true,
    });
  }

  protected die(): void {
    sfx.death(this);
    this.unitState = "DEAD";
    this.target = null;
    this.scene.tweens.killTweensOf(this.bodyGfx);
    this.scene.tweens.add({
      targets: this,
      alpha: 0,
      duration: 350,
      onComplete: () => this.destroy(),
    });
  }

  protected redrawBars(): void {
    const g = this.barsGfx;
    g.clear();
    if (!this.isAlive) return;
    const w = this.radius * 2 + 6;
    const y = -this.radius - 8;
    g.fillStyle(COLORS.HP_BG, 0.85);
    g.fillRect(-w / 2, y, w, 3);
    g.fillStyle(COLORS.HP, 1);
    g.fillRect(-w / 2, y, w * (this.hp / this.maxHp), 3);
  }
}
