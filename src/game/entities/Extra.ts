import Phaser from "phaser";
import { Unit } from "./Unit";
import type { Look } from "../art/figures";

/**
 * Figura só de enfeite (G4): a gente do mapa e do acampamento, a coluna das expedições, o
 * cervo no pasto. É uma `Unit` para ganhar de graça a animação, a direção e a troca de zoom
 * das figuras do G1, mas não luta, não entra em nenhuma lista de combate e ninguém a ataca.
 */
export class Extra extends Unit {
  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    look: Look,
    radius = 8,
    /** Anel no chão, nos pés (o prateado do tenente); null = sem anel. */
    private readonly ring: number | null = null,
  ) {
    super(scene, x, y, "ALLY", { hp: 1, speed: 0, damage: 0, range: 0, cooldown: 1e9, radius });
    this.autoAttack = false;
    this.wear(look);
    this.drawBody();
  }

  protected drawBody(): void {
    const g = this.bodyGfx;
    g.clear();
    if (this.ring === null) return;
    g.lineStyle(2, this.ring, 1);
    g.strokeEllipse(0, this.feetY, this.radius * 2 + 8, this.radius + 4);
  }

  /** Troca a roupa (o caçador que volta com o cervo nas costas). */
  dress(look: Look): void {
    this.wear(look);
  }

  /** Vai para o ponto e vira para onde andou (a animação do passo sai do chão percorrido). */
  walkTo(x: number, y: number): void {
    const dx = x - this.x;
    const dy = y - this.y;
    if (dx * dx + dy * dy > 0.04) this.setFacing(Math.atan2(dy, dx));
    this.x = x;
    this.y = y;
  }

  /** Um golpe de trabalho (a enxada, o martelo, a flechada no cervo): toca os quadros do ataque. */
  work(now: number): void {
    this.lastAttackAt = now;
  }
}
