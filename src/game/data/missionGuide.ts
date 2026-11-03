import { GOODS } from "../../utils/constants";
import type { Point } from "../../utils/math";
import { roadGraphOf } from "../sim/roadGraph";
import type { Contract } from "./contracts";
import { travelDaysBetween, type WorldDef } from "./world";

/**
 * O que fazer num contrato, passo a passo: de onde sai, para onde vai e o que falta. É a mesma
 * conta para a mesa de contratos, o diário de missões, a faixa do HUD e o mapa.
 */

export interface MissionPoint extends Point {
  name: string;
}

export interface MissionStep {
  text: string;
  /** Onde isso acontece (sem ponto: o passo não tem lugar fixo). */
  at?: MissionPoint;
  done: boolean;
}

export interface MissionPlan {
  steps: MissionStep[];
  /** Linha a desenhar no mapa, do começo ao fim do serviço. */
  route: Point[];
  /** Partida e chegada, quando o contrato tem as duas. */
  from?: MissionPoint;
  to?: MissionPoint;
}

/** O que muda enquanto o contrato anda. */
export interface MissionProgress {
  /** Caravanas abatidas (sabotagem). */
  progress?: number;
  /** Carga recuperada (já nas carroças). */
  recovered?: boolean;
  /** A caravana escoltada, onde está e se ainda espera no portão. */
  escort?: (Point & { waiting: boolean }) | null;
  /** Quanto do bem pedido já vai nas carroças. */
  cargo?: number;
}

export interface MissionWorld {
  world: WorldDef;
  settlements: readonly { id: string; name: string; x: number; y: number }[];
}

export function missionPlan(c: Contract, { world, settlements }: MissionWorld, state: MissionProgress = {}): MissionPlan {
  const town = (id?: string): MissionPoint | undefined => {
    const t = settlements.find((x) => x.id === id);
    return t ? { x: t.x, y: t.y, name: t.name } : undefined;
  };
  const from = town(c.fromId);
  const to = town(c.targetId);
  const label = c.good ? GOODS[c.good].label.toLowerCase() : "mercadoria";
  const road = c.fromId && c.targetId ? roadGraphOf(world).route(c.fromId, c.targetId) : null;
  const line = road?.points ?? (from && to ? [from, to] : []);

  switch (c.kind) {
    case "ESCORT": {
      const moving = !!state.escort && !state.escort.waiting;
      return {
        from,
        to,
        route: line,
        steps: [
          { text: `Vá ao portão de ${from?.name ?? "?"}: a caravana só parte com o bando por perto`, at: from, done: moving },
          { text: `Acompanhe a caravana até ${to?.name ?? "?"} e proteja a carga no caminho`, at: to, done: false },
        ],
      };
    }
    case "ROUTE":
      return {
        from,
        to,
        route: line,
        steps: [
          { text: `Vá à estrada entre ${from?.name ?? "?"} e ${to?.name ?? "?"}`, at: road ? { ...road.points[Math.floor(road.points.length / 2)], name: `estrada de ${to?.name ?? "?"}` } : to, done: false },
          { text: "Acabe com os salteadores que fecham a passagem", done: false },
        ],
      };
    case "DELIVERY": {
      const has = (state.cargo ?? 0) >= (c.qty ?? 0);
      return {
        to,
        route: [],
        steps: [
          { text: `Compre ${c.qty} de ${label} onde estiver barato (Livro de Preços)`, done: has },
          { text: `Entregue no mercado de ${to?.name ?? "?"}`, at: to, done: false },
        ],
      };
    }
    case "RECOVER":
      return {
        to,
        route: [],
        steps: [
          { text: "Ache e destrua o bando que levou a carga (marcado no mapa, se alguém o viu)", done: !!state.recovered },
          { text: `Devolva ${c.qty} de ${label} ao mercado de ${to?.name ?? "?"}`, at: to, done: false },
        ],
      };
    case "SABOTAGE":
      return { route: [], steps: [{ text: `Saqueie ${c.need ?? 1} caravana(s) do inimigo do cliente (${state.progress ?? 0} até agora)`, done: false }] };
    case "RELIEF":
    case "CIVIL":
      return { to, route: [], steps: [{ text: `Vá até ${to?.name ?? "?"}`, at: to, done: false }, { text: "Destrua o exército inimigo que está lá", done: false }] };
    case "BURN": {
      const bridge = world.geo.crossings.find((x) => x.id === c.crossingId);
      const at = bridge ? { x: bridge.x, y: bridge.y, name: "a ponte" } : undefined;
      return { to: at, route: [], steps: [{ text: "Vá até a ponte marcada no mapa", at, done: false }, { text: "Fale com a ponte (E) e toque fogo nela", done: false }] };
    }
    case "RANSOM":
      return { to, route: [], steps: [{ text: `Vá à Cidade Alta de ${to?.name ?? "?"}`, at: to, done: false }, { text: "Pague o resgate na corte ou tire o preso pelos esgotos", done: false }] };
    default: {
      const site = world.sites.find((x) => x.id === c.siteId);
      const at = site ? { x: site.center.x, y: site.center.y, name: site.name } : undefined;
      return { to: at, route: [], steps: [{ text: `Vá até ${at?.name ?? "o local marcado"}`, at, done: false }, { text: "Elimine todos os inimigos do local", done: false }] };
    }
  }
}

/** O primeiro passo que falta. */
export function nextStep(plan: MissionPlan): MissionStep | null {
  return plan.steps.find((s) => !s.done) ?? null;
}

const COMPASS = ["a leste", "a sudeste", "ao sul", "a sudoeste", "a oeste", "a noroeste", "ao norte", "a nordeste"];

/** Para que lado fica `to`, em palavras. */
export function compassWord(from: Point, to: Point): string {
  const a = Math.atan2(to.y - from.y, to.x - from.x);
  return COMPASS[(Math.round(a / (Math.PI / 4)) + 8) % 8];
}

/** "1,4 dia(s) a nordeste": onde fica um lugar a partir de um ponto. */
export function wayTo(from: Point, to: Point): string {
  const days = travelDaysBetween(from, to);
  if (days < 0.15) return "aqui perto";
  return `${days.toFixed(1).replace(".", ",")} dia(s) ${compassWord(from, to)}`;
}
