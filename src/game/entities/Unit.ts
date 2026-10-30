import Phaser from "phaser";
import { BALANCE, COLORS, GEO, TERRAIN, TIME, WEATHER, type AttackKind, type TerrainType, type UnitStats, type Weather } from "../../utils/constants";
import { distance, type Point } from "../../utils/math";
import { sfx } from "../../audio/sounds";
import type { TerrainMap } from "../world/TerrainMap";
import type { NavGrid } from "../systems/NavGrid";

export type Team = "ALLY" | "ENEMY";
/** Quem passa pelos portões: todos (inimigos, gente do mundo), tropa do bando ou gente avulsa do bando. */
export type TownAccess = "ANY" | "ARMY" | "VISITOR";
export type UnitState = "IDLE" | "MOVING" | "ATTACKING" | "FLEEING" | "DEAD";
/** O que a unidade é para quem a vê de longe (a IA do inimigo pensa nestes termos). */
export type UnitRole = "TROOP" | "HERO" | "SCOUT" | "COURIER" | "WAGON";

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
  /** Grade de navegação do mundo (rotas em volta de rios, mar e montanhas). */
  static nav: NavGrid | null = null;
  /** A mesma grade para as tropas do bando: povoados que não deixam o exército entrar contam como muro. */
  static armyNav: NavGrid | null = null;
  /**
   * Povoado fechado para quem tem esse acesso neste ponto? (Marco 12: os portões barram o
   * exército do bando nos povoados alheios, e todo o bando nos povoados em guerra com ele.)
   */
  static closedTown: ((access: TownAccess, x: number, y: number) => boolean) | null = null;
  /** Tempo de agora onde a ação acontece (Marco 13): chuva encurta o alcance dos arqueiros. */
  static weather: Weather = "CLEAR";
  /** Chão da estação num ponto (lama da primavera e da chuva, neve): multiplicador de velocidade. */
  static ground: ((x: number, y: number, t: TerrainType) => number) | null = null;
  /** Muda quando a estação ou o tempo mudam (o chão guardado de cada unidade é refeito). */
  static groundStamp = 0;
  /** Marcha forçada (a cena liga): o Comandante e os soldados fora de combate andam mais depressa. */
  static pace = 1;

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
  /** Por quais portões passa (ver `Unit.closedTown`). */
  townAccess: TownAccess = "ANY";
  /** Quão apetitoso é como alvo: < 1 = os saqueadores preferem (carroças). */
  lure = 1;
  /** Fração da distância normal a que é percebido (batedor furtivo). */
  stealth = 1;
  /** Sem tocha: à noite não se denuncia, mesmo com o bando de tochas acesas. */
  unlit = false;
  /** Batedor: avistá-lo não arrasta o bando inteiro (ver Enemy.onSpot). */
  isScout = false;
  role: UnitRole = "TROOP";

  /** Última posição em terra firme (empurrões não jogam ninguém no rio). */
  safeX = NaN;
  safeY = NaN;
  /** Rota atual quando a linha reta até o destino está bloqueada. */
  private route: { goal: Point; at: number; path: Point[] | null } | null = null;
  private terrainCache = { x: NaN, y: NaN, type: "GRASS" as TerrainType };
  private groundCache = { x: NaN, y: NaN, value: 1, stamp: -1 };
  /** De pé, sentado ou dormindo (vida no acampamento). */
  private pose: "STAND" | "SIT" | "SLEEP" = "STAND";

  protected readonly bodyGfx: Phaser.GameObjects.Graphics;
  protected readonly barsGfx: Phaser.GameObjects.Graphics;

  constructor(scene: Phaser.Scene, x: number, y: number, team: Team, stats: UnitStats) {
    super(scene, x, y);
    this.team = team;
    // Gente do bando entra nos povoados como visitante; a tropa dos batalhões (Soldier) fica no portão
    if (team === "ALLY") this.townAccess = "VISITOR";
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

  /** Terreno sob a unidade (guardado enquanto ela não se mexe: é consultado muitas vezes por quadro). */
  get terrainType(): TerrainType {
    const c = this.terrainCache;
    if (c.x !== this.x || c.y !== this.y) {
      c.x = this.x;
      c.y = this.y;
      c.type = Unit.terrain?.typeAt(this.x, this.y) ?? "GRASS";
    }
    return c.type;
  }

  /** Com água pela cintura (vau, riacho): formação desfeita e mais vulnerável. */
  get inShallows(): boolean {
    return this.terrainType === "SHALLOW";
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

  /** Lama da primavera e da chuva, neve do inverno (vale para todos: bando, inimigos, bandos). */
  groundFactor(): number {
    const ground = Unit.ground;
    if (!ground) return 1;
    const c = this.groundCache;
    if (c.x !== this.x || c.y !== this.y || c.stamp !== Unit.groundStamp) {
      c.x = this.x;
      c.y = this.y;
      c.stamp = Unit.groundStamp;
      c.value = ground(this.x, this.y, this.terrainType);
    }
    return c.value;
  }

  speedMultiplier(): number {
    const t = TERRAIN[this.terrainType];
    return (this.canCharge ? t.cavalrySpeed : t.speed) * this.nightSpeed() * this.groundFactor();
  }

  attackRange(): number {
    const range = this.ranged && this.terrainType === "HILL" ? this.range * BALANCE.HILL_RANGE_BONUS : this.range;
    if (!this.ranged) return range;
    return Unit.weather === "RAIN" ? range * WEATHER.RAIN_RANGE : Unit.weather === "STORM" ? range * WEATHER.STORM_RANGE : range;
  }

  get isCharging(): boolean {
    return this.canCharge && this.chargeDistance >= this.chargeMinDistance;
  }

  outgoingDamage(target: Unit): number {
    let dmg = this.damage;
    if (this.terrainType === "HILL" && target.terrainType !== "HILL") dmg *= BALANCE.HILL_DAMAGE_BONUS;
    if (this.isCharging) dmg *= this.chargeMultiplier;
    if (this.nightCreature) dmg *= 1 + Unit.darkness * (TIME.NIGHT_CREATURE_DAMAGE - 1);
    if (this.inShallows) dmg *= GEO.SHALLOW_DAMAGE_DEALT;
    return dmg;
  }

  /** Chamado quando esta unidade abate outra (soldados creditam o batalhão). */
  onKill(): void {}

  incomingMultiplier(_source: Unit, kind: AttackKind): number {
    const water = this.inShallows ? GEO.SHALLOW_DAMAGE_TAKEN : 1;
    return (kind === "RANGED" && this.isInForest ? BALANCE.FOREST_RANGED_TAKEN : 1) * water;
  }

  // --- Movimento e combate ---

  setFacing(angle: number): void {
    this.facing = angle;
    this.bodyGfx.rotation = angle;
  }

  /**
   * Move em direção ao ponto. Retorna true se já chegou (ou chegou o mais perto possível de
   * um destino na água). Se a linha reta cruza rio, mar ou montanha, segue uma rota.
   */
  moveTowards(tx: number, ty: number, dt: number, extraMultiplier = 1): boolean {
    const d = Math.hypot(tx - this.x, ty - this.y);
    if (d <= 2) return true;
    let gx = tx;
    let gy = ty;
    if (d > 60) {
      const wp = this.waypoint(tx, ty);
      if (wp) {
        // Destino na água: a rota termina na margem
        if (wp.final && Math.hypot(wp.x - this.x, wp.y - this.y) <= 6) return true;
        gx = wp.x;
        gy = wp.y;
      }
    }
    const dx = gx - this.x;
    const dy = gy - this.y;
    const dd = Math.hypot(dx, dy) || 1;
    const step = Math.min(dd, this.speed * this.speedMultiplier() * extraMultiplier * dt);
    this.stepBy((dx / dd) * step, (dy / dd) * step);
    this.setFacing(Math.atan2(dy, dx));

    if (this.canCharge) {
      this.chargeDistance = TERRAIN[this.terrainType].breaksCharge ? 0 : this.chargeDistance + step;
    }
    return false;
  }

  /**
   * Anda sem entrar em água funda nem em montanha (na margem, desliza ao longo dela) e sem
   * passar por um portão fechado para ele. Quem já está dentro sempre pode sair.
   */
  protected stepBy(dx: number, dy: number): void {
    const t = Unit.terrain;
    const gate = this.townAccess !== "ANY" ? Unit.closedTown : null;
    const shut = !!gate && !gate(this.townAccess, this.x, this.y);
    const blocked = (x: number, y: number) => !!t?.isBlocked(x, y) || (shut && !!gate?.(this.townAccess, x, y));
    if (!blocked(this.x + dx, this.y + dy)) {
      this.x += dx;
      this.y += dy;
    } else if (dx && !blocked(this.x + dx, this.y)) {
      this.x += dx;
    } else if (dy && !blocked(this.x, this.y + dy)) {
      this.y += dy;
    }
  }

  /** Foi empurrado para dentro de um povoado fechado para ele (estava fora antes)? */
  pushedThroughGate(fromX: number, fromY: number): boolean {
    const gate = Unit.closedTown;
    if (!gate || this.townAccess === "ANY") return false;
    return gate(this.townAccess, this.x, this.y) && !gate(this.townAccess, fromX, fromY);
  }

  /** Próximo ponto da rota até (tx, ty), ou null se a linha reta serve. Refeita a cada 1,5 s. */
  private waypoint(tx: number, ty: number): (Point & { final: boolean }) | null {
    const nav = this.townAccess === "ARMY" ? (Unit.armyNav ?? Unit.nav) : Unit.nav;
    if (!nav) return null;
    const now = this.scene.time.now;
    let r = this.route;
    if (!r || (r.goal.x - tx) ** 2 + (r.goal.y - ty) ** 2 > 120 * 120 || now - r.at > 1500) {
      const goal = { x: tx, y: ty };
      // Atraso aleatório: o exército inteiro não recalcula no mesmo quadro
      r = this.route = { goal, at: now + Math.random() * 300, path: nav.lineClear(this, goal) ? null : nav.findPath(this, goal, 6000) };
    }
    const path = r.path;
    if (!path || path.length === 0) return null;
    while (path.length > 1 && (path[0].x - this.x) ** 2 + (path[0].y - this.y) ** 2 < 50 * 50) path.shift();
    return { x: path[0].x, y: path[0].y, final: path.length === 1 };
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

  /** Postura (só visual): sentado fica menor; dormindo, quase apagado e sem a barra de vida. */
  setPose(pose: "STAND" | "SIT" | "SLEEP"): void {
    if (this.pose === pose) return;
    this.pose = pose;
    this.bodyGfx.setScale(pose === "STAND" ? 1 : pose === "SIT" ? 0.8 : 0.7);
    this.bodyGfx.setAlpha(pose === "SLEEP" ? 0.4 : 1);
    this.barsGfx.setVisible(pose === "STAND");
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
