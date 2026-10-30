import Phaser from "phaser";
import { Unit } from "./Unit";
import { drawRiderShape } from "./shapes";
import type { Commander } from "./Commander";
import { COLORS, SUPPORT } from "../../utils/constants";
import { centroid, distance, nearest, type Point } from "../../utils/math";
import { messengerProfile, type MessengerData } from "../data/riders";

/** Um destinatário da ordem (batalhão ou batedor). */
export interface MissionStop {
  /** Nome de quem recebe (para o HUD/diário). */
  recipient: string;
  /** Posição atual do destinatário (ele pode estar se movendo). */
  position: () => Point;
  /** O destinatário deixou de existir (dizimado, morto)? */
  gone: () => boolean;
  /** Aplica a ordem a este destinatário. */
  deliver: (messenger: Messenger) => void;
}

/** Uma ordem a caminho: uma só ordem, possivelmente para vários batalhões próximos. */
export interface Mission {
  /** Texto curto da ordem ("Marchar", "Alto"...). */
  order: string;
  stops: MissionStop[];
}

type MessengerState = "IDLE" | "OUTBOUND" | "RETURNING";

/** O que aconteceu com o mensageiro neste quadro (para o feed da batalha). */
export type MessengerEvent =
  | { type: "DELIVERED"; order: string; recipients: string[]; at: Point; remaining: number }
  | { type: "ABORTED"; order: string };

/**
 * Mensageiro a cavalo. Fica junto ao Comandante até receber uma missão; então cavalga
 * em direção ao destinatário mais próximo e, ao chegar ao alcance do próprio sinal
 * (trombeta e bandeira), entrega a ordem a TODOS os destinatários que estiverem nesse
 * alcance de uma vez — tropas próximas recebem o mesmo toque. Depois segue para os
 * restantes (se houver) e volta. Não luta; se for abatido, a ordem se perde.
 */
export class Messenger extends Unit {
  readonly rider: MessengerData;
  readonly authority: number;
  readonly canRally: boolean;
  /** Distância a que entrega a ordem por sinal (trombeta/bandeira), sem encostar na tropa. */
  readonly signalRange: number;
  riderState: MessengerState = "IDLE";
  mission: Mission | null = null;
  /** Sinais dados nesta batalha (cada toque que entregou a ordem a alguém). */
  deliveries = 0;
  /** Indo direto a um destinatário (grupo mais espalhado que o alcance do sinal). */
  private homing: MissionStop | null = null;
  private readonly slot: number;

  constructor(scene: Phaser.Scene, x: number, y: number, data: MessengerData, slot: number) {
    const profile = messengerProfile(data.level);
    super(scene, x, y, "ALLY", { ...SUPPORT.MESSENGER.stats, speed: profile.speed });
    this.rider = data;
    this.slot = slot;
    this.authority = profile.authority;
    this.canRally = profile.canRally;
    this.signalRange = profile.signalRange;
    this.autoAttack = false;
    this.role = "COURIER";
    this.canCharge = true; // terreno afeta como cavalaria
    this.evasion = profile.evasion;
    this.drawBody();
  }

  protected drawBody(): void {
    drawRiderShape(this.bodyGfx, COLORS.MESSENGER, this.radius, COLORS.PENNANT);
  }

  get available(): boolean {
    return this.isAlive && this.riderState === "IDLE";
  }

  send(mission: Mission): void {
    this.mission = mission;
    this.riderState = "OUTBOUND";
  }

  /** Acrescenta destinatários à rota de uma missão que está saindo (mesma ordem). */
  addStops(stops: MissionStop[]): void {
    this.mission?.stops.push(...stops);
  }

  /** Destinatários próximos uns dos outros a partir do mais próximo do mensageiro (um toque para todos). */
  private nearestGroup(stops: MissionStop[]): MissionStop[] {
    const first = this.currentStop();
    if (!first) return stops;
    const p = first.position();
    return stops.filter((s) => distance(s.position(), p) <= SUPPORT.MESSENGER.GROUP_RADIUS);
  }

  /** Destinatário mais próximo dos que faltam. */
  currentStop(): MissionStop | null {
    if (!this.mission) return null;
    const positions = this.mission.stops.map((s) => ({ ...s.position(), stop: s }));
    return nearest(positions, this)?.stop ?? null;
  }

  think(dt: number, commander: Commander): MessengerEvent | null {
    if (!this.isAlive) return null;
    this.target = null;

    if (this.riderState === "OUTBOUND" && this.mission) {
      const mission = this.mission;
      mission.stops = mission.stops.filter((s) => !s.gone());
      if (mission.stops.length === 0) {
        this.mission = null;
        this.riderState = "RETURNING";
        return { type: "ABORTED", order: mission.order };
      }

      // Vai ao centro do grupo mais próximo para que UM toque alcance todos ao mesmo tempo
      const group = this.nearestGroup(mission.stops);
      const center = centroid(group.map((s) => s.position()));
      const atCenter = distance(this, center) <= 12;
      const inRange = group.filter((s) => distance(this, s.position()) <= this.signalRange);
      // Toca quando todos do grupo ouvem — ou, já no centro de um grupo espalhado, para quem ouvir
      if (inRange.length > 0 && (inRange.length === group.length || atCenter)) {
        this.homing = null;
        for (const s of inRange) s.deliver(this);
        this.deliveries++;
        mission.stops = mission.stops.filter((s) => !inRange.includes(s));
        const remaining = mission.stops.length;
        if (remaining === 0) {
          this.mission = null;
          this.riderState = "RETURNING";
        }
        return {
          type: "DELIVERED",
          order: mission.order,
          recipients: inRange.map((s) => s.recipient),
          at: { x: this.x, y: this.y },
          remaining,
        };
      }

      // No centro sem ninguém ao alcance (grupo mais espalhado que o sinal): vai ao mais próximo
      if (atCenter && inRange.length === 0) this.homing = this.currentStop();
      const goal = this.homing && mission.stops.includes(this.homing) ? this.homing.position() : center;
      this.moveTowards(goal.x, goal.y, dt);
      this.unitState = "MOVING";
      return null;
    }

    // Escolta: perto do Comandante, um ao lado do outro
    const home = {
      x: commander.x - Math.cos(commander.facing) * 36 + (this.slot - 1) * 24,
      y: commander.y - Math.sin(commander.facing) * 36 + 30,
    };
    const arrived = this.moveTowards(home.x, home.y, dt, this.riderState === "RETURNING" ? 1 : 0.9);
    if (this.riderState === "RETURNING" && distance(this, commander) < 60) this.riderState = "IDLE";
    this.unitState = arrived ? "IDLE" : "MOVING";
    return null;
  }
}
