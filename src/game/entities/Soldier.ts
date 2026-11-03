import Phaser from "phaser";
import { Unit } from "./Unit";
import type { Battalion } from "./Battalion";
import { drawTroopShape } from "./shapes";
import { troopLook } from "../art/looks";
import { BALANCE, COLORS, COMBAT, FORMATIONS, type AttackKind, type TroopType, type UnitStats } from "../../utils/constants";
import { angleDiff, angleTo, distance } from "../../utils/math";

/**
 * Soldado de um batalhão aliado. Forma por tipo:
 * infantaria = círculo, arqueiro = círculo claro com arco, cavalaria = elipse alongada.
 * Recebe do batalhão os atributos (nível, habilidades, equipamento) e os efeitos da formação.
 */
export class Soldier extends Unit {
  readonly troopType: TroopType;
  readonly battalion: Battalion;
  /** Tenente que comanda o batalhão (anel prateado, mais forte, morte permanente). */
  readonly isLieutenant: boolean;
  /** Capitão da companhia, que marcha com a guarda (anel dourado; Marco 20). */
  readonly isCaptain: boolean;
  private panicked = false;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    troopType: TroopType,
    battalion: Battalion,
    stats: UnitStats,
    officer: "LIEUTENANT" | "CAPTAIN" | null = null,
  ) {
    super(scene, x, y, "ALLY", stats);
    this.townAccess = "ARMY";
    this.troopType = troopType;
    this.battalion = battalion;
    this.isLieutenant = officer === "LIEUTENANT";
    this.isCaptain = officer === "CAPTAIN";
    const m = battalion.mods;
    this.chargeMultiplier = BALANCE.CHARGE_MULTIPLIER + m.chargeBonus;
    this.chargeMinDistance = BALANCE.CHARGE_MIN_DISTANCE * m.chargeDistance;
    this.chargeKnockback = BALANCE.CHARGE_KNOCKBACK * m.knockback;
    this.arrowShock = m.arrowShock;
    this.chargeShock = m.chargeShock;
    this.meleeShock = m.meleeShock;
    this.breakThrough = m.breakThrough;
    this.wear(troopLook(troopType));
    this.drawBody();
  }

  protected drawBody(): void {
    if (this.sprite) {
      // A figura já diz a tropa; no chão fica só o anel do tenente
      const g = this.bodyGfx;
      g.clear();
      if (this.isOfficer) {
        g.lineStyle(2, this.isCaptain ? COLORS.CAPTAIN : COLORS.LIEUTENANT, 1);
        g.strokeEllipse(0, this.feetY, this.radius * 2 + 8, this.radius + 4);
      }
      this.restoreTint();
      return;
    }
    drawTroopShape(this.bodyGfx, this.troopType, this.radius, {
      panicked: this.panicked,
      shieldWall: this.battalion.formation === "SHIELD_WALL",
    });
    if (this.isOfficer) {
      this.bodyGfx.lineStyle(3, this.isCaptain ? COLORS.CAPTAIN : COLORS.LIEUTENANT, 1);
      this.bodyGfx.strokeCircle(0, 0, this.radius + 5);
    }
  }

  /** Tenente ou capitão: não conta como soldado do batalhão. */
  get isOfficer(): boolean {
    return this.isLieutenant || this.isCaptain;
  }

  /** Redesenha o corpo (após mudar formação ou estado de pânico). */
  refresh(): void {
    this.drawBody();
  }

  setPanicked(panicked: boolean): void {
    if (this.panicked === panicked) return;
    this.panicked = panicked;
    this.drawBody();
  }

  /** Em pânico, a figura fica avermelhada. */
  protected override restoreTint(): void {
    super.restoreTint();
    if (this.panicked) this.sprite?.setTint(COLORS.PANIC_TINT);
  }

  /** Abate conta para o batalhão (vira XP no fim da batalha). */
  override onKill(): void {
    this.battalion.kills++;
    if (this.isLieutenant) this.battalion.lieutenantKills++;
    if (this.isCaptain) this.battalion.captainKills++;
  }

  override speedMultiplier(): number {
    const f = this.battalion.formation;
    const formationSpeed = f === "SHIELD_WALL" ? this.battalion.mods.shieldWallSpeed : FORMATIONS[f].speed;
    // Cansaço pesa nas pernas; a marcha forçada apressa quem não está lutando
    const pace = this.target ? 1 : Unit.pace;
    // Perto do alvo é a toda; fora disso, no passo do batalhão
    const stride = this.target && distance(this, this.target) <= COMBAT.CHARGE_RANGE ? 1 : this.battalion.stride;
    return super.speedMultiplier() * formationSpeed * (this.battalion.leaderPassive?.speed ?? 1) * this.battalion.fatigueSpeed * pace * stride;
  }

  override attackRange(): number {
    return super.attackRange() * (this.battalion.leaderPassive?.range ?? 1);
  }

  override get frontFacing(): number {
    return this.battalion.facing;
  }

  override shock(amount: number): void {
    this.battalion.pendingShock += amount;
  }

  override get volleySize(): number {
    return this.battalion.soldiers.length;
  }

  override meleeSkill(): number {
    return this.attack + FORMATIONS[this.battalion.formation].attackBonus;
  }

  override defenseSkill(time: number): number {
    const base = super.defenseSkill(time);
    return base > 0 ? base + FORMATIONS[this.battalion.formation].defenseBonus : 0;
  }

  override noteCharge(time: number): void {
    this.battalion.noteImpact(time);
  }

  /** Soldado da formação: a Dispersa não segura lança. */
  override braces(attacker: Unit): boolean {
    return this.battalion.formation !== "LOOSE" && super.braces(attacker);
  }

  override outgoingDamage(target: Unit): number {
    // Na água a formação se desfaz: a Cunha não empurra
    const formation = this.inShallows ? 1 : FORMATIONS[this.battalion.formation].damageDealt;
    const m = this.battalion.mods;
    const flank = m.flankDamage !== 1 && target.approachOf(this) !== "FRONT" ? m.flankDamage : 1;
    const hunt = m.huntDamage !== 1 && (target.ranged || target.unitState === "FLEEING") ? m.huntDamage : 1;
    return super.outgoingDamage(target) * formation * (this.battalion.leaderPassive?.damage ?? 1) * this.battalion.fatigueDamage * flank * hunt;
  }

  override incomingMultiplier(source: Unit, kind: AttackKind): number {
    const m = this.battalion.mods;
    // Armadura, habilidades e o tenente (Fúria) valem sempre
    const base =
      super.incomingMultiplier(source, kind) *
      (kind === "RANGED" ? m.rangedTaken : m.meleeTaken) *
      (this.battalion.leaderPassive?.taken ?? 1);
    // Na água (vau, riacho) não há Parede de Escudos nem fileira: só a armadura vale
    if (this.inShallows) return base;
    const f = FORMATIONS[this.battalion.formation];
    // Parede de Escudos: proteção só para golpes vindos da frente (arco maior com Muralha Viva)
    if (f.frontArc !== undefined) {
      const arc = m.shieldWallArc;
      if (angleDiff(this.battalion.facing, angleTo(this, source)) > arc) return base;
    }
    return base * (kind === "RANGED" ? f.rangedTaken : f.meleeTaken);
  }
}
