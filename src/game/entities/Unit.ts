import Phaser from "phaser";
import { BALANCE, COLORS, COMBAT, GEO, SIEGE, TERRAIN, TIME, WEATHER, type AttackKind, type TerrainType, type UnitStats, type Weather } from "../../utils/constants";
import { distance, type Point } from "../../utils/math";
import { approachOf, armorFactor, sideDamage, type Approach } from "../sim/combatRules";
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
  /** Flecha caiu sobre gente do próprio lado (a cena conta e avisa). */
  static onFriendlyFire: ((victim: Unit, shooter: Unit) => void) | null = null;

  readonly team: Team;
  readonly radius: number;
  maxHp: number;
  /** Atira de longe; acabou a munição, passa a lutar de perto. */
  ranged: boolean;
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
  /** No alto da muralha: alcança mais, bate mais forte, apanha menos de flecha. */
  onWall = false;
  /** Perícia, defesa, armadura e escudo (ver `UnitStats`). */
  readonly attack: number;
  readonly defense: number;
  readonly armor: number;
  readonly shieldBlock: number;
  readonly pierce: number;
  readonly antiCavalry: number;
  readonly canBrace: boolean;
  readonly mass: number;
  readonly nerve: number;
  readonly mounted: boolean;
  readonly chargePower: number;
  readonly spread: number;
  readonly volley: number;
  readonly flatShot: boolean;
  readonly kite: boolean;
  /** Tiros que restam (Infinity = quem não conta munição). */
  ammo: number;
  readonly maxAmmo: number;
  /** Derrubado ou desequilibrado: não ataca nem apara até este momento. */
  stunnedUntil = -Infinity;
  /** Embalo depois do choque: segue em frente mais um pouco, sem parar para lutar. */
  private through: { angle: number; until: number } | null = null;
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
  /** Olho do inimigo a cavalo (ver WarHost): anda solto, não vale a pena ir atrás. */
  isOutrider = false;
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
    this.attack = stats.attack ?? 40;
    this.defense = stats.defense ?? 40;
    this.armor = stats.armor ?? 0;
    this.shieldBlock = stats.shield ?? 0;
    this.pierce = stats.pierce ?? 0;
    this.antiCavalry = stats.antiCavalry ?? 1;
    this.canBrace = stats.brace ?? false;
    this.mass = stats.mass ?? 1;
    this.nerve = stats.nerve ?? 1;
    this.mounted = stats.mounted ?? false;
    this.chargePower = stats.charge ?? 1;
    this.spread = stats.spread ?? 1;
    this.volley = stats.volley ?? 1;
    this.flatShot = stats.flat ?? false;
    this.kite = stats.kite ?? false;
    this.maxAmmo = stats.ammo ?? Infinity;
    this.ammo = this.maxAmmo;
    this.canCharge = this.mounted && !this.ranged;

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
    const climbing = Unit.terrain?.onLadder(this.x, this.y) ? SIEGE.LADDER_CLIMB : 1;
    return (this.canCharge || this.mounted ? t.cavalrySpeed : t.speed) * this.nightSpeed() * this.groundFactor() * climbing;
  }

  attackRange(): number {
    const range = (this.ranged && this.terrainType === "HILL" ? this.range * BALANCE.HILL_RANGE_BONUS : this.range) * (this.onWall && this.ranged ? SIEGE.WALL_RANGE : 1);
    if (!this.ranged) return range;
    return Unit.weather === "RAIN" ? range * WEATHER.RAIN_RANGE : Unit.weather === "STORM" ? range * WEATHER.STORM_RANGE : range;
  }

  get isCharging(): boolean {
    return this.canCharge && this.chargeDistance >= this.chargeMinDistance;
  }

  /** Direção da frente da formação em que luta (null = sem formação: não tem lado fraco). */
  get frontFacing(): number | null {
    return null;
  }

  /** De que lado `source` chega nesta unidade. */
  approachOf(source: Point): Approach {
    const front = this.frontFacing;
    return front === null ? "FRONT" : approachOf(front, this, source);
  }

  /** Perícia de ataque agora. */
  meleeSkill(): number {
    return this.attack;
  }

  /** Defesa agora: derrubado, não apara nada. */
  defenseSkill(time: number): number {
    return time < this.stunnedUntil ? 0 : this.defense;
  }

  /** Lanças firmes: parado, de frente para quem carrega. */
  braces(attacker: Unit): boolean {
    return this.canBrace && this.unitState !== "MOVING" && this.unitState !== "FLEEING" && this.approachOf(attacker) === "FRONT";
  }

  /** A tropa dele sente o golpe (a moral é do batalhão ou do esquadrão). */
  shock(_amount: number): void {}

  /** Empurrão de um golpe: anda sem cair na água nem atravessar muralha. */
  shove(angle: number, amount: number): void {
    this.stepBy(Math.cos(angle) * amount, Math.sin(angle) * amount);
  }

  /** A investida chegou (ou quebrou em lanças): a tropa fica sabendo. */
  noteCharge(_time: number): void {}

  /** Bateu e segue em frente com o embalo. */
  rideThrough(angle: number, time: number): void {
    this.through = { angle, until: time + COMBAT.CHARGE_THROUGH_MS };
    this.noteCharge(time);
  }

  get ridingThrough(): boolean {
    return this.through !== null;
  }

  /** Dá um passo de embalo; devolve true enquanto ele durar (a tropa não comanda este soldado). */
  carryMomentum(dt: number, time: number): boolean {
    const t = this.through;
    if (!t) return false;
    if (time >= t.until) {
      this.through = null;
      return false;
    }
    const step = this.speed * this.speedMultiplier() * dt;
    this.stepBy(Math.cos(t.angle) * step, Math.sin(t.angle) * step);
    this.setFacing(t.angle);
    this.unitState = "MOVING";
    return true;
  }

  /** Quantos atiram junto com ele: unidade grande cobre mais área (ver `volleySpread`). */
  get volleySize(): number {
    return 1;
  }

  /** Pode levar uma flecha que não era para ele. */
  get strayTarget(): boolean {
    return true;
  }

  /** Um tiro a menos; o último deixa de mãos vazias, e aí é lutar de perto. Do alto da muralha, o paiol não acaba. */
  spendAmmo(): void {
    if (this.onWall) return;
    this.ammo--;
    if (this.ammo > 0) return;
    this.ranged = false;
    this.range = BALANCE.OUT_OF_AMMO.range;
    this.cooldown = BALANCE.OUT_OF_AMMO.cooldown;
  }

  /** Reabastecido depois da batalha. */
  refillAmmo(stats: { range: number; cooldown: number; ranged?: boolean }): void {
    this.ammo = this.maxAmmo;
    this.ranged = stats.ranged ?? false;
    this.range = stats.range;
    this.cooldown = stats.cooldown;
  }

  outgoingDamage(target: Unit): number {
    let dmg = this.damage;
    if (this.terrainType === "HILL" && target.terrainType !== "HILL") dmg *= BALANCE.HILL_DAMAGE_BONUS;
    if (target.mounted) dmg *= this.antiCavalry;
    dmg *= this.isCharging ? this.chargeMultiplier * this.chargePower * COMBAT.CHARGE_PACE : this.ranged ? COMBAT.ARROW_PACE : COMBAT.DAMAGE_PACE;
    if (this.nightCreature) dmg *= 1 + Unit.darkness * (TIME.NIGHT_CREATURE_DAMAGE - 1);
    if (this.inShallows) dmg *= GEO.SHALLOW_DAMAGE_DEALT;
    if (this.onWall) dmg *= SIEGE.WALL_DAMAGE;
    return dmg;
  }

  /** Chamado quando esta unidade abate outra (soldados creditam o batalhão). */
  onKill(): void {}

  incomingMultiplier(source: Unit, kind: AttackKind): number {
    const water = this.inShallows ? GEO.SHALLOW_DAMAGE_TAKEN : 1;
    const side = sideDamage(this.approachOf(source), kind === "RANGED");
    const wall = this.onWall && kind === "RANGED" ? SIEGE.WALL_ARROW_TAKEN : 1;
    return (kind === "RANGED" && this.isInForest ? BALANCE.FOREST_RANGED_TAKEN : 1) * water * side * wall * armorFactor(this.armor, source.pierce);
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
    return time >= this.stunnedUntil && time - this.lastAttackAt >= this.cooldown;
  }

  takeDamage(amount: number, source: Unit, time: number, kind: AttackKind = "MELEE"): void {
    if (!this.isAlive) return;
    if (this.evasion > 0 && Math.random() < this.evasion) {
      this.floatText("esquiva", "#c6ff8a");
      sfx.dodge(this);
      return;
    }
    const friendly = source !== this && source.team === this.team && kind === "RANGED";
    // Escudo de frente para a chuva de flechas (quem vem de lado ou por trás não tem o que parar)
    if (kind === "RANGED" && this.shieldBlock > 0 && this.approachOf(source) === "FRONT" && Math.random() < this.shieldBlock) return;
    this.hp = Math.max(0, this.hp - amount * this.incomingMultiplier(source, kind));
    if (friendly) Unit.onFriendlyFire?.(this, source);
    else {
      this.lastHitFrom = source;
      this.lastHitAt = time;
      // Revida quem bateu se não estiver ocupado com outro alvo
      if (source.isAlive && (!this.target || !this.target.isAlive)) this.target = source;
    }
    if (kind === "RANGED") this.shock(COMBAT.ARROW_SHOCK);

    this.redrawBars();
    this.scene.tweens.add({ targets: this.bodyGfx, alpha: 0.35, duration: 60, yoyo: true });

    if (this.hp <= 0) {
      if (!friendly) source.onKill();
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
