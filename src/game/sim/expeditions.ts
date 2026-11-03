import { CAPTAINS, EXPEDITION, TROOPS } from "../../utils/constants";
import { battalionMods, gainXp, soldierStats } from "../../utils/progression";
import { dailyRations } from "../../utils/economy";
import type { BattalionData } from "../../store/useGameStore";
import { clamp, pointAlong, routeLength, type Point } from "../../utils/math";
import type { Contract, ContractKind } from "../data/contracts";
import { temperOf, type CaptainData, type Temper } from "../data/captains";

/**
 * Expedição: parte do bando cumpre um contrato sem o Comandante. Desde o Marco 20 quem vai é uma
 * companhia, com o capitão dela: a Tática dele mexe na chance e nas baixas, e é ele quem escreve
 * o relatório. As tropas marcham até o serviço e voltam com o resultado; a posição delas sai do relógio (ver `expeditionStage`), e a luta é
 * resolvida em conta, com risco de verdade: sem o Comandante por perto, o bando não pode corrigir
 * o que der errado.
 */

/** Contratos que dá para mandar alguém fazer: os outros pedem o Comandante em pessoa. */
export const DELEGABLE: readonly ContractKind[] = ["SITE", "ESCORT", "ROUTE"];

export function canDelegate(c: Contract): boolean {
  return DELEGABLE.includes(c.kind ?? "SITE");
}

/** Quanto vale um batalhão em campo: vida atrás da armadura vezes o que ele bate. */
export function battalionStrength(b: BattalionData, led: boolean): number {
  const s = soldierStats(b, battalionMods(b));
  const man = Math.sqrt((s.hp / (1 - (s.armor ?? 0) * 0.8)) * ((s.damage * 1000) / s.cooldown));
  return man * b.soldiers * (led ? EXPEDITION.LEADER_BONUS : 1);
}

export function partyStrength(party: readonly BattalionData[], isLed: (b: BattalionData) => boolean): number {
  return party.reduce((n, b) => n + battalionStrength(b, isLed(b)), 0);
}

/** Quanta gente espera do outro lado. */
export function foeStrength(c: Contract): number {
  return EXPEDITION.FOE[c.difficulty];
}

/** Chance de cumprir o contrato; `tactics` é a Tática do capitão (3 não muda nada). */
export function successChance(own: number, foe: number, tactics = 3): number {
  const edge = Math.log2(Math.max(0.01, own / Math.max(1, foe)));
  const plan = (tactics - 3) * CAPTAINS.TACTICS_CHANCE;
  return clamp(EXPEDITION.CHANCE_EVEN + edge * EXPEDITION.CHANCE_PER_DOUBLE + plan, EXPEDITION.CHANCE_MIN, EXPEDITION.CHANCE_MAX);
}

/** Fração de baixas que se espera, conforme a luta sai bem ou mal (um bom capitão gasta menos gente). */
export function expectedLosses(own: number, foe: number, success: boolean, tactics = 3): number {
  const share = foe / Math.max(1, own + foe);
  const care = 1 - (tactics - 3) * CAPTAINS.TACTICS_LOSSES;
  return clamp(share * (success ? EXPEDITION.LOSS_WIN : EXPEDITION.LOSS_DEFEAT) * care, 0, 1);
}

/** Dias fora: ida até o serviço, o serviço e a volta. */
export function expeditionDays(c: Contract): number {
  return Math.max(EXPEDITION.MIN_DAYS, Math.ceil(c.travelDays * 2 + EXPEDITION.WORK_DAYS));
}

/** O que o relógio precisa saber para dizer onde a tropa está. */
export interface ExpeditionTrip {
  contract: Contract;
  departDay: number;
  /** Momento exato da partida (o dia com a fração). */
  departAt?: number;
  returnDay: number;
  /** Do lugar de onde saiu até o fim do serviço. */
  path?: readonly Point[];
  /** Ponto da linha em que o serviço começa (na escolta, onde a caravana espera). */
  meet?: number;
}

export type ExpeditionLeg = "OUT" | "WORK" | "BACK";

export interface ExpeditionStage {
  leg: ExpeditionLeg;
  at: Point;
  /** Para onde a coluna olha. */
  facing: number;
  /** Próximo ponto da viagem (o mapa traça a linha até lá). */
  heading: Point;
  /** Escolta: a caravana já anda com a tropa. */
  escorting: boolean;
}

/** Fração do tempo fora gasta na ida (a volta é igual; o resto é o serviço). */
function outShare(c: Contract): number {
  return clamp(c.travelDays / expeditionDays(c), 0.2, 0.45);
}

function walk(path: readonly Point[], share: number): { at: Point; facing: number; walked: number } {
  const walked = routeLength(path) * share;
  const at = pointAlong(path, walked);
  const ahead = pointAlong(path, walked + 80);
  return { at, facing: Math.atan2(ahead.y - at.y, ahead.x - at.x), walked };
}

/** Onde a tropa está agora. `home` é o Comandante: é para ele que ela volta. */
export function expeditionStage(e: ExpeditionTrip, now: number, home: Point): ExpeditionStage {
  const start = e.departAt ?? e.departDay;
  const t = clamp((now - start) / Math.max(0.01, e.returnDay - start), 0, 1);
  const out = outShare(e.contract);
  const path = e.path && e.path.length > 0 ? e.path : [home];
  const end = path[path.length - 1];
  const escort = (e.contract.kind ?? "SITE") === "ESCORT";
  if (t < out) {
    const { at, facing, walked } = walk(path, t / out);
    const meetAt = routeLength(path.slice(0, (e.meet ?? 0) + 1));
    return { leg: "OUT", at, facing, heading: end, escorting: escort && walked >= meetAt };
  }
  if (t < 1 - out) return { leg: "WORK", at: end, facing: 0, heading: end, escorting: escort };
  const { at, facing } = walk([...path].reverse().concat(home), (t - (1 - out)) / out);
  return { leg: "BACK", at, facing, heading: home, escorting: false };
}

/** O que a tropa está fazendo, em palavras. */
export function expeditionLine(c: Contract, stage: ExpeditionStage, from?: string, to?: string): string {
  if (stage.leg === "BACK") return "voltando ao bando";
  const kind = c.kind ?? "SITE";
  if (kind === "ESCORT") {
    if (stage.leg === "WORK") return `entregando a caravana em ${to ?? "seu destino"}`;
    return stage.escorting ? `escoltando a caravana até ${to ?? "seu destino"}` : `a caminho de ${from ?? "a caravana"}, onde a caravana espera`;
  }
  if (stage.leg === "WORK") return kind === "ROUTE" ? "limpando a estrada" : `lutando em ${to ?? "o local"}`;
  return `a caminho de ${to ?? "o serviço"}`;
}

/** Comida que a tropa leva. */
export function expeditionRations(party: readonly BattalionData[], days: number): number {
  return Math.ceil(dailyRations([...party]) * days);
}

export interface ExpeditionOutcome {
  success: boolean;
  /** Como cada batalhão voltou. */
  battalions: BattalionData[];
  /** Quem não voltou. */
  lost: string[];
  casualties: number;
}

/** Decide no que deu. `random` entra de fora para os testes; `tactics`, do capitão. */
export function resolveExpedition(party: readonly BattalionData[], c: Contract, isLed: (b: BattalionData) => boolean, random: () => number = Math.random, tactics = 3): ExpeditionOutcome {
  const own = partyStrength(party, isLed);
  const foe = foeStrength(c);
  const success = random() < successChance(own, foe, tactics);
  const share = expectedLosses(own, foe, success, tactics);
  const back: BattalionData[] = [];
  const lost: string[] = [];
  let casualties = 0;
  for (const b of party) {
    const dead = Math.min(b.soldiers, Math.round(b.soldiers * share * (0.7 + random() * 0.6)));
    casualties += dead;
    if (dead >= b.soldiers) {
      lost.push(b.name);
      continue;
    }
    const after = { ...b, soldiers: b.soldiers - dead };
    back.push(success ? gainXp(after, EXPEDITION.XP * c.difficulty).battalion : after);
  }
  return { success, battalions: back, lost, casualties };
}

const APPROACH: Record<"SITE" | "ESCORT" | "ROUTE", Record<Temper, string>> = {
  SITE: {
    AGGRESSIVE: "Atacamos de frente ao amanhecer, antes que eles tivessem tempo de se juntar.",
    STEADY: "Fechamos as saídas do lugar antes de entrar: ninguém fugiu para avisar os outros.",
    PATIENT: "Esperei dois dias na mata até eles se espalharem atrás de comida.",
  },
  ESCORT: {
    AGGRESSIVE: "Mandei batedores à frente e caçamos quem esperava a caravana na estrada.",
    STEADY: "Pus a caravana no meio da coluna e troquei de estrada no segundo dia.",
    PATIENT: "Fomos devagar, parando antes de cada mata para olhar.",
  },
  ROUTE: {
    AGGRESSIVE: "Varremos a estrada de ponta a ponta, sem parar para descansar.",
    STEADY: "Limpamos a estrada trecho por trecho, deixando vigias para trás.",
    PATIENT: "Armei uma isca de carroça e esperei os bandidos virem até nós.",
  },
};

/** Uma ideia de tática, conforme o que a companhia tinha e o quanto o capitão sabe. */
function tacticLine(party: readonly BattalionData[], tactics: number, random: () => number): string {
  const has = (f: string) => party.some((b) => TROOPS[b.troopType].family === f);
  if (tactics <= 2) return random() < 0.5 ? "Erramos o caminho e chegamos cansados; lutamos assim mesmo." : "Os batalhões entraram um de cada vez, e cada um pagou por isso.";
  if (tactics >= 4) {
    if (has("ARCHERS")) return "Pus os arqueiros no alto e a infantaria embaixo: eles vieram exatamente onde eu queria.";
    if (has("CAVALRY")) return "Segurei a cavalaria atrás da mata e só soltei quando eles viraram as costas.";
    return "Fingi um recuo; quando eles saíram da posição, viramos e fechamos o cerco.";
  }
  return has("ARCHERS") ? "Os arqueiros abriram a luta e a infantaria fechou." : "Cada batalhão no seu lugar, sem nada de extraordinário.";
}

/**
 * Relatório do capitão para o diário: o que ele decidiu e no que deu, na voz dele. Sai do
 * temperamento, da Tática e do tipo de serviço.
 */
export function captainReport(captain: Pick<CaptainData, "traits" | "tactics">, c: Contract, party: readonly BattalionData[], outcome: Pick<ExpeditionOutcome, "success" | "casualties" | "lost">, random: () => number = Math.random): string[] {
  const temper = temperOf(captain);
  const kind = c.kind ?? "SITE";
  const lines = [(kind === "ESCORT" || kind === "ROUTE" ? APPROACH[kind] : APPROACH.SITE)[temper], tacticLine(party, captain.tactics, random)];
  if (outcome.success) lines.push(outcome.casualties > 0 ? `O serviço está feito. ${outcome.casualties} dos nossos não vão receber o pagamento.` : "O serviço está feito, e sem baixas.");
  else if (temper === "AGGRESSIVE") lines.push("Insisti quando devia ter recuado, e paguei por isso.");
  else lines.push("Recuei quando vi que não dava: melhor voltar com a companhia do que não voltar.");
  if (outcome.lost.length > 0) lines.push(`${outcome.lost.join(" e ")} ficou pelo caminho.`);
  return lines;
}
