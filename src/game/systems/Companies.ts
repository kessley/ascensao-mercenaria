import { CAPTAINS, CULTURE, TROOPS, WAR_AI } from "../../utils/constants";
import { cultureOf } from "../sim/culture";
import { distance, type Point } from "../../utils/math";
import type { CaptainData } from "../data/captains";
import type { Battalion } from "../entities/Battalion";
import type { Commander } from "../entities/Commander";
import type { Unit } from "../entities/Unit";
import { companyIntents, companyView, engageRadius, ONE_SHOT, roleOf, STANCE_LABEL, type CompanyHud, type CompanyStance } from "../sim/companies";
import { choosePlan, PLAN_LABEL, type ContactView, type PlanKind } from "../sim/warMind";
import { contactKind, unitPower } from "./WarHost";

/** Ordem direta do Comandante a um batalhão da companhia: o capitão não mexe nele por este tempo. */
const DIRECT_ORDER_MS = 15000;
/** Segurando o terreno: quem se afastou mais que isto do seu lugar volta para ele. */
const HOLD_SLACK = 90;

interface CompanyState {
  captain: CaptainData;
  ids: string[];
  stance: CompanyStance;
  holdAt: Point | null;
  holdOffsets: Map<string, Point>;
  plan: PlanKind | null;
  planAt: number;
  spent: PlanKind[];
  nextThink: number;
  /** O capitão caiu: o tenente mais antigo da companhia assume, pior (ou ninguém). */
  fallen: boolean;
  acting: { name: string; battalionId: string } | null;
  /** O que o capitão mandou cada batalhão fazer, para não repetir a ordem a cada pensada. */
  issued: Map<string, Unit | "HOLD" | "BACK">;
}

export interface CompanyLinks {
  commander: () => Commander;
  feed(text: string): void;
  /** A voz do Comandante alcança este ponto (ordens na hora, sem mensageiro). */
  inVoice(p: Point): boolean;
}

/**
 * Companhias em campo (Marco 20): a aura do capitão, o abalo quando ele cai e a cabeça dele.
 * Ele decide com a mesma escolha de plano dos comandantes inimigos (`choosePlan`), vendo só
 * os inimigos que o bando enxerga perto da companhia, e age quando a postura manda (segurar,
 * perseguir) ou quando a voz do Comandante não chega até ele.
 */
export class Companies {
  private list: CompanyState[] = [];
  private source: readonly CaptainData[] | null = null;
  private orderedAt = new Map<string, number>();

  constructor(private readonly links: CompanyLinks) {}

  /** Refaz a lista quando os capitães do store mudam, guardando postura e plano de quem continua. */
  private sync(captains: readonly CaptainData[]): void {
    if (captains === this.source) return;
    this.source = captains;
    const kept = new Map(this.list.map((c) => [c.captain.id, c]));
    this.list = captains
      .filter((c) => c.battalionIds.length > 0)
      .map((captain) => {
        const old = kept.get(captain.id);
        if (old) return { ...old, captain, ids: [...captain.battalionIds] };
        return {
          captain,
          ids: [...captain.battalionIds],
          stance: "FREE",
          holdAt: null,
          holdOffsets: new Map(),
          plan: null,
          planAt: 0,
          spent: [],
          nextThink: 0,
          fallen: false,
          acting: null,
          issued: new Map(),
        };
      });
  }

  /** Ordem direta do jogador a um batalhão: vale mais que a do capitão por um tempo. */
  playerOrdered(b: Battalion, time: number): void {
    this.orderedAt.set(b.id, time);
    // Depois do prazo, o capitão só retoma quem ficou parado: a ordem do Comandante não é desfeita
    for (const c of this.list) c.issued.delete(b.id);
  }

  private members(c: CompanyState, field: readonly Battalion[]): Battalion[] {
    return field.filter((b) => c.ids.includes(b.id) && !b.isDestroyed);
  }

  /** A guarda do capitão está em campo (sem ela, ele ficou no acampamento ou saiu do campo). */
  private present(c: CompanyState, field: readonly Battalion[]): boolean {
    const guard = field.find((b) => b.id === c.ids[0]);
    return !!guard && (c.fallen ? !!c.acting && field.some((b) => b.id === c.acting?.battalionId && !b.isDestroyed) : !guard.isDestroyed && guard.captainAlive);
  }

  private leaderName(c: CompanyState): string {
    return c.fallen ? (c.acting?.name ?? c.captain.name) : c.captain.name;
  }

  /** Onde está quem manda na companhia agora. */
  private leaderAt(c: CompanyState, field: readonly Battalion[]): Point | null {
    if (!c.fallen) return field.find((b) => b.id === c.ids[0])?.captainAt ?? null;
    return field.find((b) => b.id === c.acting?.battalionId && !b.isDestroyed)?.center ?? null;
  }

  /**
   * Para o mensageiro (Marco 6): quem recebe as ordens de um batalhão da companhia. Perto do
   * capitão (ou de quem assumiu), basta levar a ordem até ele.
   */
  leaderFor(b: Battalion, field: readonly Battalion[]): { id: string; name: string; at: () => Point } | null {
    const c = this.list.find((x) => x.ids.includes(b.id));
    if (!c || !this.present(c, field)) return null;
    const at = this.leaderAt(c, field);
    if (!at || distance(at, b.center) > CAPTAINS.RELAY_RADIUS) return null;
    return { id: c.captain.id, name: this.leaderName(c), at: () => this.leaderAt(c, field) ?? b.center };
  }

  /** O batalhão onde está quem manda: é para ele que vai a ordem larga. */
  leaderBattalion(captainId: string, field: readonly Battalion[]): Battalion | null {
    const c = this.list.find((x) => x.captain.id === captainId);
    if (!c || !this.present(c, field)) return null;
    const id = c.fallen ? c.acting?.battalionId : c.ids[0];
    return field.find((b) => b.id === id && !b.isDestroyed) ?? null;
  }

  /** Ordem larga do Comandante: a postura da companhia. Segurar guarda o lugar de cada um. */
  setStance(captainId: string, stance: CompanyStance, field: readonly Battalion[]): void {
    const c = this.list.find((x) => x.captain.id === captainId);
    if (!c) return;
    const members = this.members(c, field);
    c.stance = stance;
    c.plan = null;
    c.issued.clear();
    c.nextThink = 0;
    for (const b of members) this.orderedAt.delete(b.id);
    c.holdOffsets.clear();
    c.holdAt = null;
    if (stance === "HOLD" && members.length > 0) {
      const at = centerOf(members);
      c.holdAt = at;
      for (const b of members) c.holdOffsets.set(b.id, { x: b.center.x - at.x, y: b.center.y - at.y });
    }
    this.links.feed(`⚑ ${this.leaderName(c)}: "${STANCE_LABEL[stance]}".`);
  }

  update(time: number, captains: readonly CaptainData[], field: readonly Battalion[], foes: readonly Unit[]): void {
    this.sync(captains);
    for (const b of field) b.captainAura = 1;
    for (const c of this.list) {
      const members = this.members(c, field);
      if (members.length === 0) continue;
      const guard = field.find((b) => b.id === c.ids[0]);
      if (guard?.captainDied && !c.fallen) this.fall(c, members);
      if (!this.present(c, field)) continue;
      // Perto dele, a companhia aguenta mais (só o capitão; quem assumiu não tem essa mão)
      const at = c.fallen ? null : guard?.captainAt;
      if (at) {
        const aura = 1 - c.captain.command * CAPTAINS.AURA_PER_COMMAND;
        // O capitão da mesma gente da tropa segura mais (Marco 23)
        const kin = cultureOf(c.captain);
        for (const b of members) if (distance(b.center, at) <= CAPTAINS.AURA_RADIUS) b.captainAura = aura * (b.culture === kin ? CULTURE.KIN_CAPTAIN : 1);
      }
      if (time >= c.nextThink) {
        c.nextThink = time + CAPTAINS.THINK_MS;
        this.think(c, members, foes, time);
      }
    }
  }

  /** O capitão caiu: abalo em toda a companhia, e o tenente mais antigo assume. */
  private fall(c: CompanyState, members: readonly Battalion[]): void {
    c.fallen = true;
    c.plan = null;
    c.issued.clear();
    for (const b of members) b.morale = Math.max(0, b.morale - CAPTAINS.DEATH_MORALE_HIT);
    // O mais antigo é o primeiro da companhia que ainda tem tenente de pé
    const next = c.ids.map((id) => members.find((b) => b.id === id)).find((b) => b?.lieutenant && b.lieutenantAlive);
    c.acting = next?.lieutenant ? { name: next.lieutenant.name, battalionId: next.id } : null;
    // Sem ninguém para assumir, os batalhões ficam com o Comandante
    if (!c.acting) c.stance = "FREE";
    this.links.feed(
      `⚑ O capitão ${c.captain.name} caiu! A companhia vacila${c.acting ? `; o tenente ${c.acting.name} assume.` : " e fica sem comando: os batalhões esperam as ordens do Comandante."}`,
    );
  }

  private think(c: CompanyState, members: readonly Battalion[], foes: readonly Unit[], time: number): void {
    const center = centerOf(members);
    // Por conta própria, ele só decide onde a voz do Comandante não chega
    if (c.stance === "FREE" && this.links.inVoice(center)) {
      c.plan = null;
      return;
    }
    const free = members.filter((b) => !b.panicking && time - (this.orderedAt.get(b.id) ?? -Infinity) > DIRECT_ORDER_MS);
    // Livre, ele não tira ninguém de uma ordem em andamento (marcha ou ataque do Comandante)
    const able = c.stance === "FREE" ? free.filter((b) => b.order.type === "HOLD" || b.order.type === "FOLLOW" || c.issued.has(b.id)) : free;
    if (able.length === 0) return;
    const anchor = c.stance === "HOLD" && c.holdAt ? c.holdAt : center;
    const radius = engageRadius(c.captain, c.stance);
    // Só quem a perseguição manda caçar conta quem já está fugindo
    const near = foes.filter((e) => e.isAlive && distance(e, anchor) <= radius && (c.stance === "PURSUE" || !isRouted(e)));
    if (near.length === 0) {
      if (c.plan) c.plan = null;
      if (c.stance === "HOLD") for (const b of able) this.holdPlace(c, b);
      return;
    }
    const tactics = c.fallen ? Math.max(1, c.captain.tactics - 2) : c.captain.tactics;
    const contacts: ContactView[] = near.map((e) => ({ x: e.x, y: e.y, kind: contactKind(e), power: unitPower(e) }));
    const view = companyView({
      tactics,
      traits: c.captain.traits,
      current: c.plan,
      spent: c.spent,
      center,
      ownPower: members.reduce((n, b) => n + b.soldiers.reduce((m, s) => m + (s.isAlive ? unitPower(s) : 0), 0), 0),
      ownMorale: members.reduce((n, b) => n + b.morale, 0) / members.length,
      strength: members.reduce((n, b) => n + b.aliveCount, 0) / Math.max(1, members.reduce((n, b) => n + b.startingCount, 0)),
      squads: members.map((b) => ({
        role: roleOf(TROOPS[b.troopType].family),
        size: b.aliveCount,
        morale: b.morale,
        power: b.soldiers.reduce((m, s) => m + (s.isAlive ? unitPower(s) : 0), 0),
        center: b.center,
      })),
      contacts,
      engaged: members.some((b) => b.status === "ENGAGED"),
    });
    let next = choosePlan(view, WAR_AI.EXPOSED_RADIUS);
    // Quem tem plano não muda à toa (a retirada sempre pode)
    if (c.plan && next !== c.plan && next !== "RETREAT" && time - c.planAt < WAR_AI.PLAN_LOCK_MS) next = c.plan;
    if (next !== c.plan) {
      c.plan = next;
      c.planAt = time;
      if (ONE_SHOT.includes(next)) c.spent.push(next);
      this.links.feed(`⚑ ${this.leaderName(c)} decide: ${PLAN_LABEL[next]}.`);
    }
    const intents = companyIntents(
      next,
      able.map((b) => ({ role: roleOf(TROOPS[b.troopType].family), center: b.center })),
      contacts,
      tactics,
    );
    able.forEach((b, i) => {
      const intent = intents[i];
      if (intent.kind === "ATTACK") {
        const target = near[intent.foe];
        if (!target) return;
        if (b.order.type === "ATTACK" && b.order.target === target) return;
        if (b.orderAttack(target)) c.issued.set(b.id, target);
        return;
      }
      if (intent.kind === "FALL_BACK" && c.stance !== "HOLD") {
        if (c.issued.get(b.id) !== "BACK" && b.orderFollow(this.links.commander())) c.issued.set(b.id, "BACK");
        return;
      }
      // Resistir, ou recuar para o ponto que a companhia guarda
      if (c.stance === "HOLD") this.holdPlace(c, b);
      else if (c.issued.get(b.id) !== "HOLD" && b.holdPosition()) c.issued.set(b.id, "HOLD");
    });
  }

  /** Segurando o terreno: cada batalhão volta ao lugar que tinha quando a ordem chegou. */
  private holdPlace(c: CompanyState, b: Battalion): void {
    if (!c.holdAt) return;
    const off = c.holdOffsets.get(b.id) ?? { x: 0, y: 0 };
    const spot = { x: c.holdAt.x + off.x, y: c.holdAt.y + off.y };
    if (distance(b.center, spot) > HOLD_SLACK) {
      if (b.order.type !== "MOVE" || distance(b.order.point, spot) > 40) b.orderMove(spot);
    } else if (b.order.type !== "HOLD" && b.order.type !== "MOVE") {
      b.holdPosition();
    }
    c.issued.set(b.id, "HOLD");
  }

  hud(field: readonly Battalion[]): CompanyHud[] {
    return this.list
      .filter((c) => this.members(c, field).length > 0 && this.present(c, field))
      .map((c) => ({
        id: c.captain.id,
        leader: this.leaderName(c),
        captain: c.captain.name,
        fallen: c.fallen,
        stance: c.stance,
        plan: c.plan ? PLAN_LABEL[c.plan] : null,
        battalionIds: this.members(c, field).map((b) => b.id),
      }));
  }
}

function centerOf(list: readonly Battalion[]): Point {
  return { x: list.reduce((n, b) => n + b.center.x, 0) / list.length, y: list.reduce((n, b) => n + b.center.y, 0) / list.length };
}

/** Inimigo que já largou a luta (só a perseguição vai atrás). */
function isRouted(u: Unit): boolean {
  return "routed" in u && !!(u as { routed?: boolean }).routed;
}
