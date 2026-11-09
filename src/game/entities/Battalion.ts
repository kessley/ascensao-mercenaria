import Phaser from "phaser";
import { Soldier } from "./Soldier";
import type { Unit } from "./Unit";
import type { Commander } from "./Commander";
import { BALANCE, CAPTAINS, COLORS, COMBAT, CULTURE, FATIGUE, LIEUTENANTS, TROOPS, type Formation, type TroopType, type UnitStats } from "../../utils/constants";
import type { CultureId } from "../data/planet";
import { cultureOf } from "../sim/culture";
import type { CaptainData } from "../data/captains";
import { PASSIVES, type LieutenantData, type PassiveDef } from "../data/lieutenants";
import { angleTo, centroid, distance, nearest, type Point } from "../../utils/math";
import type { BattalionData, BattalionStatus } from "../../store/useGameStore";
import { battalionMods, soldierStats, type BattalionMods } from "../../utils/progression";
import { formationOffset, formationSize, frontOf } from "../systems/formation";
import { cycleStep, type CycleState } from "../sim/combatRules";
import { nearestWithin } from "../systems/nearIndex";
import { PIXEL_FONT } from "../art/font";
import { OUTLINE, ramp } from "../art/pixel";

export type BattalionOrder =
  | { type: "HOLD"; point: Point }
  | { type: "MOVE"; point: Point }
  | { type: "ATTACK"; target: Unit; lastKnown: Point }
  | { type: "FOLLOW"; leader: Commander };

/**
 * Grupo de soldados que age como um "personagem" tático: recebe ordens,
 * mantém uma formação e compartilha uma única barra de Moral.
 */
export class Battalion {
  /** Sem inimigo à vista: a tropa viaja no passo normal (a cena atualiza a cada quadro). */
  static calm = false;

  readonly id: string;
  readonly name: string;
  readonly troopType: TroopType;
  readonly startingCount: number;
  readonly level: number;
  /** Nível × habilidades × equipamento (ver src/utils/progression.ts). */
  readonly mods: BattalionMods;
  /** Inimigos abatidos nesta batalha. */
  kills = 0;
  /** Ordem a caminho nas mãos de um mensageiro (texto para o HUD). */
  pendingOrder: string | null = null;

  soldiers: Soldier[];
  formation: Formation;
  morale: number = BALANCE.MORALE.MAX;
  panicking = false;
  order: BattalionOrder;
  /** Direção da frente da formação (rad). Golpes vindos de trás contam como flanco. */
  facing = 0;
  /** Soldados por fileira escolhidos pelo jogador (null = o padrão da formação). */
  width: number | null = null;
  /** Passo acelerado: chega antes e chega cansado. */
  running = false;
  /** Soldados perdidos desde a última leitura do MoraleSystem. */
  pendingDeaths = 0;
  /** Abalos desde a última leitura: investida, flechas, vizinhos fugindo. */
  pendingShock = 0;
  /** Está apanhando pelo lado ou por trás agora. */
  flanked = false;
  flankShockAt = -Infinity;
  /** Arqueiros seguram o tiro (para não acertar os próprios homens no corpo a corpo). */
  holdFire = false;
  /** Investida em ciclo: bate, sai, ganha distância e volta. */
  cycle = false;
  private cycleState: CycleState = { phase: "IN", hitAt: null };
  /** Modo escaramuça: recua sozinho de quem chega perto. */
  kiting: boolean;
  private nextKiteAt = 0;
  selected = false;
  /** Fadiga (Marco 13): 0 descansado, 100 exausto. Lento, fraco e com moral que custa a voltar. */
  fatigue = 0;

  private readonly scene: Phaser.Scene;
  private readonly stats: UnitStats;
  private readonly label: Phaser.GameObjects.Text;
  private readonly bannerGfx: Phaser.GameObjects.Graphics;
  /** Anéis de seleção, desenhados abaixo das unidades. */
  private readonly selectionGfx: Phaser.GameObjects.Graphics;

  /**
   * Posição deste batalhão no cortejo atrás do Comandante, no referencial dele:
   * `lateral` (lado) e `back` (distância para trás). Atribuída pela BattleScene
   * sempre que o conjunto de batalhões seguindo o Comandante muda.
   */
  followSlot: { lateral: number; back: number } = { lateral: 0, back: BALANCE.FOLLOW_DISTANCE };
  /**
   * O Comandante entrou num povoado que barra o exército: quem o segue espera aqui, virado
   * para o portão, até ele sair (a cena define e limpa).
   */
  followHold: { point: Point; facing: number } | null = null;

  /** Tenente no comando (dados persistentes), a unidade dele em campo e o que aconteceu. */
  readonly lieutenant: LieutenantData | null;
  private lieutenantUnit: Soldier | null = null;
  lieutenantDied = false;
  lieutenantKills = 0;
  /** Capitão que marcha com este batalhão (a guarda da companhia), se houver (Marco 20). */
  readonly captain: CaptainData | null;
  private captainUnit: Soldier | null = null;
  captainDied = false;
  captainKills = 0;
  /** Perto do capitão vivo, a moral cai menos (< 1); a cena atualiza a cada quadro. */
  captainAura = 1;
  /** De onde a tropa veio (Marco 23). */
  readonly culture: CultureId;

  constructor(
    scene: Phaser.Scene,
    data: BattalionData,
    x: number,
    y: number,
    leader: Commander,
    lieutenant: LieutenantData | null = null,
    captain: CaptainData | null = null,
  ) {
    this.lieutenant = lieutenant;
    this.captain = captain;
    this.culture = cultureOf(data);
    this.id = data.id;
    this.name = data.name;
    this.troopType = data.troopType;
    this.formation = TROOPS[data.troopType].formations.includes(data.formation)
      ? data.formation
      : TROOPS[data.troopType].formations[0];
    this.startingCount = data.soldiers;
    this.level = data.level;
    this.mods = battalionMods(data);
    this.order = { type: "FOLLOW", leader };

    const stats = soldierStats(data, this.mods);
    this.scene = scene;
    this.stats = stats;
    this.kiting = stats.kite ?? false;
    this.soldiers = [];
    for (let i = 0; i < data.soldiers; i++) {
      const slot = this.slotFor(i, data.soldiers, { x, y });
      this.soldiers.push(new Soldier(scene, slot.x, slot.y, data.troopType, this, stats));
    }

    // O tenente marcha no último lugar da formação (comanda de trás da linha)
    if (lieutenant) {
      const L = LIEUTENANTS;
      const leaderStats = {
        ...stats,
        hp: Math.round(stats.hp * L.HP_MULT),
        damage: stats.damage * L.DAMAGE_MULT,
        radius: stats.radius + L.EXTRA_RADIUS,
      };
      const slot = this.slotFor(data.soldiers, data.soldiers + 1, { x, y });
      this.lieutenantUnit = new Soldier(scene, slot.x, slot.y, data.troopType, this, leaderStats, "LIEUTENANT");
      this.soldiers.push(this.lieutenantUnit);
    }

    // O capitão marcha com a guarda, atrás de tudo (de onde vê a companhia)
    if (captain) {
      const C = CAPTAINS;
      const captainStats = {
        ...stats,
        hp: Math.round(stats.hp * C.HP_MULT),
        damage: stats.damage * C.DAMAGE_MULT,
        radius: stats.radius + C.EXTRA_RADIUS,
      };
      const slot = this.slotFor(this.soldiers.length, this.soldiers.length + 1, { x, y });
      this.captainUnit = new Soldier(scene, slot.x, slot.y, data.troopType, this, captainStats, "CAPTAIN");
      this.soldiers.push(this.captainUnit);
    }

    // ★ = batalhão comandado por um tenente; ⚑ = a guarda do capitão (os nomes aparecem no card do HUD)
    const title = `${captain ? "⚑ " : ""}${data.name} · Nv ${data.level}${lieutenant ? " ★" : ""}`;
    this.label = scene.add
      .text(x, y, title, { fontFamily: PIXEL_FONT, fontSize: "12px", color: "#ffffff", stroke: "#1a1522", strokeThickness: 3 })
      .setOrigin(0.5, 1)
      .setDepth(10);
    this.bannerGfx = scene.add.graphics().setDepth(10);
    this.selectionGfx = scene.add.graphics().setDepth(-5);
  }

  get center(): Point {
    return centroid(this.soldiers);
  }

  /** Soldados (sem tenente e capitão) vivos neste instante (a lista só é podada no próximo `update`). */
  get aliveCount(): number {
    return this.soldiers.filter((s) => s.isAlive && !s.isOfficer).length;
  }

  /** Dizimado: não sobrou nenhum soldado (tenente e capitão sozinhos deixam o campo). */
  get isDestroyed(): boolean {
    return this.soldiers.every((s) => s.isOfficer);
  }

  get captainAlive(): boolean {
    return !!this.captain && !this.captainDied;
  }

  /** O capitão em campo, se vivo (o herói inimigo pode desafiá-lo, Marco 21). */
  get captainSoldier(): Soldier | null {
    return this.captainUnit?.isAlive ? this.captainUnit : null;
  }

  /** Onde o capitão está (null sem capitão vivo em campo). */
  get captainAt(): Point | null {
    return this.captainUnit?.isAlive ? { x: this.captainUnit.x, y: this.captainUnit.y } : null;
  }

  /** Passiva do tenente — só vale enquanto ele estiver vivo em campo. */
  get leaderPassive(): PassiveDef | null {
    return this.lieutenant && !this.lieutenantDied ? PASSIVES[this.lieutenant.passive] : null;
  }

  /** Velocidade conforme a fadiga (mais lento a partir de FATIGUE.SLOW_FROM). */
  get fatigueSpeed(): number {
    const over = Math.max(0, this.fatigue - FATIGUE.SLOW_FROM) / (100 - FATIGUE.SLOW_FROM);
    return 1 - over * FATIGUE.MAX_SLOW;
  }

  get fatigueDamage(): number {
    return 1 - (this.fatigue / 100) * FATIGUE.MAX_DAMAGE_LOSS;
  }

  /** Recuperação de moral conforme a fadiga. */
  get fatigueRecovery(): number {
    return 1 - (this.fatigue / 100) * FATIGUE.MAX_RECOVERY_LOSS;
  }

  get lieutenantAlive(): boolean {
    return !!this.lieutenant && !this.lieutenantDied;
  }

  /** Tenente vivo da mesma gente da tropa: ela perde menos moral (< 1; Marco 23). */
  get kinship(): number {
    return this.lieutenantAlive && cultureOf(this.lieutenant) === this.culture ? CULTURE.KIN_LIEUTENANT : 1;
  }

  /** Fração da velocidade conforme o passo: quem segue o Comandante acompanha o ritmo dele. */
  get stride(): number {
    if (Battalion.calm || this.panicking || this.restDriver || this.order.type === "FOLLOW") return 1;
    if (!this.running) return COMBAT.WALK;
    return TROOPS[this.troopType].family === "CAVALRY" ? COMBAT.GALLOP : COMBAT.RUN;
  }

  /** Bravura da tropa (< 1 = perde menos moral). */
  get steadiness(): number {
    return this.stats.nerve ?? 1;
  }

  /** Tiros que restam, somando todos (null = tropa que não atira). */
  get ammoLeft(): number | null {
    if (!this.stats.ranged) return null;
    return this.soldiers.reduce((n, s) => n + Math.max(0, s.ammo), 0);
  }

  get mayCycle(): boolean {
    return TROOPS[this.troopType].family === "CAVALRY" && !this.stats.ranged;
  }

  /** Bateu de investida: o relógio do ciclo começa a contar. */
  noteImpact(time: number): void {
    if (this.cycleState.phase === "IN" && this.cycleState.hitAt === null) this.cycleState.hitAt = time;
  }

  /** Depois da batalha: aljavas cheias. */
  resupply(): void {
    for (const s of this.soldiers) s.refillAmmo(this.stats);
  }

  /** Fileiras atrás da primeira seguram quem está na frente. */
  get rankSupport(): number {
    if (this.formation === "WEDGE") return 1;
    const count = this.soldiers.length;
    const ranks = Math.ceil(count / frontOf(this.formation, count, this.width));
    return 1 - Math.min(ranks - 1, COMBAT.MAX_SUPPORT_RANKS) * COMBAT.RANK_SUPPORT * this.mods.rankSupport;
  }

  get panicFloor(): number {
    return this.mods.panicBelow;
  }

  /** true se o ponto cai sobre algum soldado (com folga de `pad` px). */
  containsPoint(p: Point, pad = 14): boolean {
    return this.soldiers.some((s) => s.isAlive && distance(s, p) <= s.radius + pad);
  }

  /** true se algum soldado está dentro do retângulo (coordenadas do mundo). */
  intersectsRect(rect: Phaser.Geom.Rectangle): boolean {
    return this.soldiers.some((s) => s.isAlive && rect.contains(s.x, s.y));
  }

  get status(): BattalionStatus {
    if (this.isDestroyed) return "DESTROYED";
    if (this.panicking) return "FLEEING";
    if (this.soldiers.some((s) => s.target)) return "ENGAGED";
    if (this.soldiers.some((s) => s.unitState === "MOVING")) return "MOVING";
    return "READY";
  }

  // --- Ordens (ignoradas em pânico) ---

  /**
   * `facing` opcional: numa marcha em grupo todos olham para a mesma direção.
   * `width`: soldados por fileira na chegada; `run`: passo acelerado.
   */
  orderMove(point: Point, facing = angleTo(this.center, point), { width, run = false }: { width?: number; run?: boolean } = {}): boolean {
    if (this.panicking || this.isDestroyed) return false;
    this.facing = facing;
    if (width !== undefined) this.width = width;
    this.running = run;
    this.order = { type: "MOVE", point };
    for (const s of this.soldiers) s.target = null;
    this.assignRanks();
    return true;
  }

  /** Cada soldado fica com o lugar mais perto na forma nova: ninguém atravessa o batalhão ao girar. */
  private assignRanks(): void {
    if (this.formation === "WEDGE") return;
    const fx = Math.cos(this.facing);
    const fy = Math.sin(this.facing);
    const troops = this.soldiers.filter((s) => !s.isOfficer).sort((a, b) => b.x * fx + b.y * fy - (a.x * fx + a.y * fy));
    const cols = frontOf(this.formation, this.soldiers.length, this.width);
    const ordered: Soldier[] = [];
    for (let i = 0; i < troops.length; i += cols) {
      ordered.push(...troops.slice(i, i + cols).sort((a, b) => -a.x * fy + a.y * fx - (-b.x * fy + b.y * fx)));
    }
    this.soldiers = [...ordered, ...this.soldiers.filter((s) => s.isOfficer)];
  }

  orderAttack(target: Unit): boolean {
    if (this.panicking || this.isDestroyed) return false;
    this.facing = angleTo(this.center, target);
    this.running = true;
    this.holdFire = false;
    this.order = { type: "ATTACK", target, lastKnown: { x: target.x, y: target.y } };
    return true;
  }

  orderFollow(leader: Commander): boolean {
    if (this.panicking || this.isDestroyed) return false;
    this.order = { type: "FOLLOW", leader };
    return true;
  }

  /**
   * Vida no acampamento (Marco 12): enquanto o batalhão descansa, quem cuida de cada soldado
   * é a rotina do acampamento (true = cuidou). Inimigo por perto: a rotina é largada e luta-se.
   */
  restDriver: ((s: Soldier, i: number, dt: number) => boolean) | null = null;

  /** Descansar no alojamento: segura a posição ali (e a rotina do acampamento assume). */
  restAt(slot: Point): void {
    if (this.isDestroyed) return;
    if (this.panicking) this.rally();
    // De frente para a barraca: as fileiras se estendem para longe dela (a barraca é sólida)
    this.facing = -Math.PI / 2;
    this.running = false;
    this.order = { type: "HOLD", point: slot };
    for (const s of this.soldiers) s.target = null;
  }

  holdPosition(): boolean {
    if (this.panicking || this.isDestroyed) return false;
    this.running = false;
    this.order = { type: "HOLD", point: this.center };
    return true;
  }

  /** Investida: ataca o inimigo mais próximo do batalhão, onde quer que esteja. */
  orderCharge(enemies: readonly Unit[]): boolean {
    const target = nearest(enemies, this.center);
    return target ? this.orderAttack(target) : false;
  }

  canUseFormation(formation: Formation): boolean {
    return TROOPS[this.troopType].formations.includes(formation);
  }

  setFormation(formation: Formation): boolean {
    if (this.panicking || this.isDestroyed || !this.canUseFormation(formation)) return false;
    this.formation = formation;
    for (const s of this.soldiers) s.refresh();
    return true;
  }

  rally(): void {
    this.panicking = false;
    this.order = { type: "HOLD", point: this.center };
    for (const s of this.soldiers) s.setPanicked(false);
  }

  panic(): void {
    this.panicking = true;
    for (const s of this.soldiers) {
      s.setPanicked(true);
      s.target = null;
    }
  }

  // --- Simulação ---

  /** `enemies` = só os inimigos visíveis (os ocultos na floresta não podem ser alvejados). */
  update(dt: number, enemies: readonly Unit[]): void {
    const before = this.soldiers.filter((s) => !s.isOfficer).length;
    this.soldiers = this.soldiers.filter((s) => s.isAlive);
    this.pendingDeaths += before - this.aliveCount;

    // Tenente tombou: a passiva some e o batalhão sente o golpe
    if (this.lieutenantUnit && !this.lieutenantUnit.isAlive && !this.lieutenantDied) {
      this.lieutenantDied = true;
      this.lieutenantUnit = null;
      this.morale = Math.max(0, this.morale - LIEUTENANTS.DEATH_MORALE_HIT);
    }
    // Capitão tombou: o golpe na companhia inteira é da cena (ver Companies)
    if (this.captainUnit && !this.captainUnit.isAlive && !this.captainDied) {
      this.captainDied = true;
      this.captainUnit = null;
    }

    if (this.isDestroyed) {
      // Sem soldados, os oficiais sobreviventes deixam o campo
      for (const officer of [this.lieutenantUnit, this.captainUnit]) {
        if (!officer) continue;
        officer.unitState = "DEAD"; // sai dos alvos inimigos
        officer.destroy();
      }
      if (this.lieutenantUnit || this.captainUnit) this.soldiers = [];
      this.lieutenantUnit = null;
      this.captainUnit = null;
      this.selected = false;
      this.label.setVisible(false);
      this.bannerGfx.clear();
      this.selectionGfx.clear();
      return;
    }

    if (this.panicking) this.updateFleeing(dt, enemies);
    else this.updateOrdered(dt, enemies);

    this.drawBanner();
  }

  private updateFleeing(dt: number, enemies: readonly Unit[]): void {
    const center = this.center;
    const threats = enemies.filter((e) => distance(e, center) < BALANCE.MORALE.THREAT_RADIUS * 1.5);
    if (threats.length === 0) {
      for (const s of this.soldiers) s.unitState = "IDLE";
      return;
    }
    const danger = centroid(threats);
    const away = angleTo(danger, center);
    for (const s of this.soldiers) {
      s.target = null;
      s.moveTowards(s.x + Math.cos(away) * 100, s.y + Math.sin(away) * 100, dt, 1.15);
      s.unitState = "FLEEING";
    }
  }

  private updateOrdered(dt: number, enemies: readonly Unit[]): void {
    const now = this.scene.time.now;
    if (this.cycle && this.mayCycle) this.stepCycle(now, enemies);
    if (this.kiting) this.stepKite(now, enemies);
    const anchor = this.resolveAnchor();
    const engaging = this.order.type !== "MOVE";
    const attacking = this.order.type === "ATTACK";
    const holding = this.order.type === "HOLD";
    const count = this.soldiers.length;

    this.soldiers.forEach((s, i) => {
      if (s.carryMomentum(dt, now)) return;
      const slot = this.slotFor(i, count, anchor);
      // Tiro em Marcha: quem atira segue andando, e o alvo é só para quem está ao alcance
      const shootsOnTheMove = !engaging && this.mods.moveFire && s.ranged;
      if (engaging || shootsOnTheMove) this.pickTarget(s, anchor, slot, enemies);
      else s.target = null;
      if (this.restDriver && !s.target && this.restDriver(s, i, dt)) return;

      if (engaging && s.target && s.inRange(s.target)) {
        s.unitState = "ATTACKING";
        s.setFacing(angleTo(s, s.target));
        return;
      }
      // A caminho do alvo a tropa anda em forma: só perto dele cada um corre para o golpe
      const formed = attacking && !!s.target && distance(s, s.target) > COMBAT.CHARGE_RANGE;
      // Parede de Escudos não quebra a fileira para perseguir: espera o inimigo chegar
      const planted = holding && s.canBrace;
      if (engaging && s.target && !formed && !planted && this.formation !== "SHIELD_WALL") {
        s.moveTowards(s.target.x, s.target.y, dt);
        s.unitState = "MOVING";
        return;
      }

      // Dentro da folga do lugar ninguém se mexe: a fileira assenta, em vez de tremer com cada empurrão
      const settled = holding && Math.hypot(slot.x - s.x, slot.y - s.y) <= COMBAT.SLOT_SLACK;
      s.unitState = settled || s.moveTowards(slot.x, slot.y, dt) ? "IDLE" : "MOVING";
      if (s.unitState === "IDLE") {
        s.setFacing(this.facing);
        s.chargeDistance = 0; // parado não acumula investida
      }
    });

    // Marcha concluída → segura a posição
    if (this.order.type === "MOVE" && this.soldiers.every((s) => s.unitState === "IDLE")) {
      this.order = { type: "HOLD", point: this.order.point };
      this.running = false;
    }
  }

  /** Investida em ciclo: depois do choque, sai correndo, ganha distância e volta à carga. */
  private stepCycle(now: number, enemies: readonly Unit[]): void {
    const step = cycleStep(this.cycleState, now, this.order.type !== "MOVE", COMBAT.CYCLE_HIT_MS * this.mods.cycleHit);
    const idle = this.cycleState.phase === "IN" && this.order.type === "HOLD";
    if (step === "WITHDRAW") {
      const c = this.center;
      const near = enemies.filter((e) => distance(e, c) < COMBAT.CYCLE_DISTANCE);
      const away = near.length > 0 ? angleTo(centroid(near), c) : this.facing + Math.PI;
      const point = { x: c.x + Math.cos(away) * COMBAT.CYCLE_DISTANCE, y: c.y + Math.sin(away) * COMBAT.CYCLE_DISTANCE };
      this.orderMove(point, away + Math.PI, { run: true });
      this.cycleState = { phase: "OUT", hitAt: null };
    } else if (step === "CHARGE" || idle) {
      // Vai na tropa que está lutando, não atrás de um batedor que corre tanto quanto ela
      const foe = nearest(enemies.filter((e) => !e.isOutrider), this.center, COMBAT.CYCLE_SEEK) ?? nearest(enemies, this.center, COMBAT.CYCLE_SEEK);
      if (!foe) return;
      this.orderAttack(foe);
      this.cycleState = { phase: "IN", hitAt: null };
    }
  }

  /** Modo escaramuça: quem chega perto faz a tropa recuar, sem deixar de virar a frente para ele. */
  private stepKite(now: number, enemies: readonly Unit[]): void {
    if (now < this.nextKiteAt || this.order.type === "MOVE" || !this.soldiers.some((s) => s.ranged)) return;
    const c = this.center;
    const threat = nearest(enemies.filter((e) => !e.ranged), c, COMBAT.KITE_RANGE);
    if (!threat) return;
    this.nextKiteAt = now + COMBAT.KITE_EVERY_MS;
    const away = angleTo(threat, c);
    this.orderMove({ x: c.x + Math.cos(away) * COMBAT.KITE_DISTANCE, y: c.y + Math.sin(away) * COMBAT.KITE_DISTANCE }, away + Math.PI, { run: true });
  }

  /** Ponto em volta do qual a formação se organiza e os soldados engajam. */
  private resolveAnchor(): Point {
    switch (this.order.type) {
      case "HOLD":
      case "MOVE":
        return this.order.point;
      case "FOLLOW": {
        const leader = this.order.leader;
        const hold = this.followHold;
        if (hold) this.facing = hold.facing;
        else if (leader.unitState === "MOVING") this.facing = leader.facing;
        const at = hold ? hold.point : leader;
        const fx = Math.cos(this.facing);
        const fy = Math.sin(this.facing);
        return {
          x: at.x - fx * this.followSlot.back - fy * this.followSlot.lateral,
          y: at.y - fy * this.followSlot.back + fx * this.followSlot.lateral,
        };
      }
      case "ATTACK": {
        const order = this.order;
        // Sumiu de vista: a tropa vai até onde o viu por último, não adivinha para onde ele foi
        if (order.target.isAlive && order.target.revealed) {
          order.lastKnown = { x: order.target.x, y: order.target.y };
          // A frente acompanha o alvo até o choque
          if (distance(this.center, order.lastKnown) > COMBAT.CHARGE_RANGE) this.facing = angleTo(this.center, order.lastKnown);
        }
        return order.lastKnown;
      }
    }
  }

  private pickTarget(s: Soldier, anchorPoint: Point, slot: Point, enemies: readonly Unit[]): void {
    if (s.ranged && this.holdFire) {
      s.target = null;
      return;
    }
    // Segurando a posição, cada um cuida do que está diante do próprio lugar na fileira
    const holding = this.order.type === "HOLD" && !this.restDriver;
    // Descansando no acampamento, cada um reage ao inimigo perto de si (e não do alojamento)
    // Em marcha o ponto da ordem é o destino: quem atira andando olha em volta de si
    const anchor = this.restDriver || this.order.type === "MOVE" ? s : holding ? slot : anchorPoint;
    // Arqueiros engajam até o próprio alcance além do raio padrão
    const radius = Math.max(holding ? COMBAT.HOLD_LEASH : BALANCE.ENGAGE_RADIUS * (this.restDriver ? 1.6 : 1), s.attackRange() + 40);
    if (this.order.type === "ATTACK" && this.order.target.isAlive && this.order.target.revealed && !s.target) {
      s.target = this.order.target;
    }
    // Quem apanha no caminho vira e luta: não vai morrer de costas atrás do alvo da ordem
    const hit = s.lastHitFrom;
    if (hit?.isAlive && !hit.ranged && hit !== s.target && !s.ranged && (!s.target || !s.inRange(s.target)) && s.scene.time.now - s.lastHitAt < BALANCE.MORALE.HIT_MEMORY_MS) {
      s.target = hit;
      return;
    }
    // Quem está colado num inimigo não larga a briga para correr atrás do alvo da ordem
    const fighting = !!s.target?.isAlive && s.inRange(s.target);
    if (s.target && s.target.isAlive && s.target.revealed && (fighting || distance(s.target, anchor) <= radius * 1.2)) return;
    // Os inimigos não andam enquanto os batalhões escolhem alvo: uma grade só os de perto (nearIndex.ts)
    const frame = this.scene.time.now;
    if (this.order.type === "ATTACK" && !s.ranged) {
      const close = nearestWithin(enemies, frame, s, COMBAT.HOLD_LEASH, s);
      if (close) {
        s.target = close;
        return;
      }
    }

    s.target = nearestWithin(enemies, frame, anchor, radius, s);

    // Alvo da ordem morreu ou sumiu de vista e não há mais ninguém por perto → segura a posição
    if (!s.target && this.order.type === "ATTACK" && (!this.order.target.isAlive || (!this.order.target.revealed && distance(s, anchorPoint) < BALANCE.ENGAGE_RADIUS / 2))) {
      this.order = { type: "HOLD", point: anchorPoint };
      this.running = false;
    }
  }

  /** Largura da frente da formação atual (px), usada para alinhar vários batalhões lado a lado. */
  frontWidth(): number {
    return formationSize(this.formation, this.soldiers.length, this.width).width;
  }

  /** Profundidade da formação atual (px): da primeira à última fileira. */
  formationDepth(): number {
    return formationSize(this.formation, this.soldiers.length, this.width).depth;
  }

  /** O batalhão está, de fato, acompanhando o Comandante? */
  get isFollowing(): boolean {
    return this.order.type === "FOLLOW" && !this.panicking && !this.isDestroyed;
  }

  /** Posição do soldado `i` (de `count`) na formação atual, girada para `facing`. */
  private slotFor(i: number, count: number, anchor: Point): Point {
    const { lateral, depth } = this.slotOffset(i, count);
    const fx = Math.cos(this.facing);
    const fy = Math.sin(this.facing);
    return {
      x: anchor.x + fx * depth - fy * lateral,
      y: anchor.y + fy * depth + fx * lateral,
    };
  }

  /** Deslocamento do soldado `i` no referencial da formação: `lateral` (lado) e `depth` (para trás). */
  private slotOffset(i: number, count: number): { lateral: number; depth: number } {
    return formationOffset(this.formation, i, count, this.width);
  }

  /** Leva o batalhão inteiro (em forma) para outro ponto: viagem rápida, recuo ao acampamento. */
  teleportTo(p: Point): void {
    const c = this.center;
    for (const s of this.soldiers) {
      s.x += p.x - c.x;
      s.y += p.y - c.y;
      s.target = null;
    }
  }

  /** Remove o batalhão do mundo (reforço, deserção, motim: ele é recriado a partir dos dados). */
  destroy(): void {
    for (const s of this.soldiers) s.destroy();
    this.soldiers = [];
    this.label.destroy();
    this.bannerGfx.destroy();
    this.selectionGfx.destroy();
  }

  drawBanner(): void {
    const c = this.center;
    // Acima da cabeça da figura mais alta (muda com o zoom: o mini-sprite é mais baixo)
    const top = Math.min(...this.soldiers.map((s) => s.y + s.headY)) - 8;
    const w = 60;

    // Em pixel inteiro: a fonte de pixel (G5) só fica nítida assim
    this.label.setPosition(Math.round(c.x), Math.round(top - 2));
    // setColor redesenha o texto e o manda de novo para a placa: só quando a cor muda
    const color = this.panicking ? "#ff4d4d" : "#ffffff";
    if (this.label.style.color !== color) this.label.setColor(color);

    // O estandarte (G5): a moral numa moldura de pixel, com a luz na linha de cima
    const g = this.bannerGfx;
    g.clear();
    const x0 = Math.round(c.x - w / 2);
    const y0 = Math.round(top);
    const fill = Math.round(w * Math.max(0, Math.min(1, this.morale / BALANCE.MORALE.MAX)));
    const tone = this.panicking ? COLORS.PANIC : COLORS.MORALE;
    g.fillStyle(OUTLINE, 0.9);
    g.fillRect(x0 - 1, y0 - 1, w + 2, 6);
    g.fillStyle(COLORS.HP_BG, 1);
    g.fillRect(x0, y0, w, 4);
    g.fillStyle(tone, 1);
    g.fillRect(x0, y0, fill, 4);
    g.fillStyle(ramp(tone).light, 1);
    g.fillRect(x0, y0, fill, 1);
    g.fillStyle(ramp(tone).dark, 1);
    g.fillRect(x0, y0 + 3, fill, 1);

    const sel = this.selectionGfx;
    sel.clear();
    if (this.selected) {
      sel.lineStyle(2, COLORS.SELECTION, 0.95);
      for (const s of this.soldiers) {
        // Com figura, o anel fica no chão, nos pés
        if (s.hasFigure) sel.strokeEllipse(s.x, s.y + s.feetY, s.radius * 2 + 8, s.radius + 6);
        else sel.strokeCircle(s.x, s.y, s.radius + 4);
      }
    }
  }
}
