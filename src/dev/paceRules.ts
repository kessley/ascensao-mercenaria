/**
 * O diário de ritmo (Fase 4, etapa 2), só as contas: em que estado o jogador passa o tempo, quando
 * veio a primeira luta, de quanto em quanto tempo há uma decisão com custo, quanto dura cada
 * missão da porta à porta e quanto cada inimigo leva para cair. Quem olha o jogo e alimenta isto é
 * `paceLog.ts` (só no modo de desenvolvimento). Não sabe o que é a cena: dá para testar sem
 * navegador.
 */

export type PaceState = "MAP" | "PANEL" | "INSIDE" | "FIGHTING" | "MARCHING" | "IDLE";

export const PACE_STATES: readonly PaceState[] = ["FIGHTING", "MARCHING", "PANEL", "INSIDE", "MAP", "IDLE"];

export const PACE_LABEL: Record<PaceState, string> = {
  FIGHTING: "Lutando",
  MARCHING: "Marchando",
  PANEL: "Em painel",
  INSIDE: "Dentro de casa",
  MAP: "No mapa",
  IDLE: "Parado",
};

/** O que se vê do jogo num instante. */
export interface PaceView {
  map: boolean;
  panel: boolean;
  inside: boolean;
  fighting: boolean;
  moving: boolean;
}

/**
 * O estado do momento. O mapa e o painel pausam o jogo, então vêm antes da luta; dentro de casa o
 * campo dorme; lutando conta mesmo andando; parado é o que sobra.
 */
export function paceState(v: PaceView): PaceState {
  if (v.map) return "MAP";
  if (v.panel) return "PANEL";
  if (v.inside) return "INSIDE";
  if (v.fighting) return "FIGHTING";
  if (v.moving) return "MARCHING";
  return "IDLE";
}

export type Decision = "CONTRACT" | "BUILD" | "RECRUIT" | "EVENT";

export const DECISION_LABEL: Record<Decision, string> = {
  CONTRACT: "aceitar contrato",
  BUILD: "construir",
  RECRUIT: "recrutar",
  EVENT: "responder a um evento",
};

/** Uma missão: aceita, saída do acampamento, cumprida (ou largada) e a volta. Tempos em ms de jogo. */
export interface PaceMission {
  id: string;
  title: string;
  accepted: number;
  left: number | null;
  done: number | null;
  back: number | null;
}

export interface Stat {
  n: number;
  /** Segundos. */
  median: number;
  mean: number;
  max: number;
}

export function stat(values: readonly number[]): Stat {
  if (values.length === 0) return { n: 0, median: 0, mean: 0, max: 0 };
  const s = [...values].sort((a, b) => a - b);
  const mid = s.length / 2;
  const median = s.length % 2 === 1 ? s[Math.floor(mid)] : (s[mid - 1] + s[mid]) / 2;
  const round = (x: number) => Math.round(x * 10) / 10;
  return { n: s.length, median: round(median), mean: round(s.reduce((a, b) => a + b, 0) / s.length), max: round(s[s.length - 1]) };
}

export interface PaceReport {
  /** Minutos de jogo medidos (só com a aba à vista, numa campanha). */
  minutes: number;
  /** Minutos e parte do tempo em cada estado. */
  states: { state: PaceState; label: string; minutes: number; share: number }[];
  /** O minuto da primeira luta (null: ainda não houve). */
  firstFight: number | null;
  decisions: { total: number; byKind: Partial<Record<Decision, number>>; gap: Stat };
  /** Cada missão terminada: da porta à porta e do aceite ao fim, em minutos. */
  missions: { title: string; doorToDoor: number | null; acceptToDone: number }[];
  /** Quanto cada tipo de inimigo leva para cair, do primeiro golpe à queda (segundos de jogo). */
  falls: { kind: string; stat: Stat }[];
}

const minutes = (ms: number) => Math.round((ms / 60000) * 10) / 10;

export class PaceLog {
  /** Tempo de jogo medido (ms). */
  clock = 0;
  readonly time: Record<PaceState, number> = { MAP: 0, PANEL: 0, INSIDE: 0, FIGHTING: 0, MARCHING: 0, IDLE: 0 };
  firstFight: number | null = null;
  readonly decisions: { kind: Decision; at: number }[] = [];
  readonly missions: PaceMission[] = [];
  readonly falls = new Map<string, number[]>();

  /** Passou `dtMs` neste estado. */
  tick(state: PaceState, dtMs: number): void {
    if (dtMs <= 0) return;
    this.clock += dtMs;
    this.time[state] += dtMs;
    if (state === "FIGHTING" && this.firstFight === null) this.firstFight = this.clock - dtMs;
  }

  decide(kind: Decision): void {
    this.decisions.push({ kind, at: this.clock });
  }

  /** Um contrato aceito: uma missão começa. */
  accepted(id: string, title: string): void {
    if (this.missions.some((m) => m.id === id)) return;
    this.missions.push({ id, title, accepted: this.clock, left: null, done: null, back: null });
  }

  /** O exército saiu do acampamento: as missões aceitas e ainda não começadas começam a andar. */
  leftCamp(): void {
    for (const m of this.missions) if (m.left === null && m.back === null) m.left = this.clock;
  }

  /** O contrato acabou (cumprido, largado ou perdido). */
  finished(id: string): void {
    const m = this.missions.find((x) => x.id === id && x.done === null);
    if (m) m.done = this.clock;
  }

  /** De volta ao acampamento: as missões terminadas fecham a porta. */
  backInCamp(): void {
    for (const m of this.missions) if (m.done !== null && m.left !== null && m.back === null) m.back = this.clock;
  }

  /** Um inimigo caiu `ms` (de jogo) depois do primeiro golpe que levou. */
  fell(kind: string, ms: number): void {
    const list = this.falls.get(kind) ?? [];
    list.push(ms);
    this.falls.set(kind, list);
  }

  report(): PaceReport {
    const total = Math.max(1, this.clock);
    const gaps: number[] = [];
    for (let i = 1; i < this.decisions.length; i++) gaps.push((this.decisions[i].at - this.decisions[i - 1].at) / 1000);
    const byKind: Partial<Record<Decision, number>> = {};
    for (const d of this.decisions) byKind[d.kind] = (byKind[d.kind] ?? 0) + 1;
    return {
      minutes: minutes(this.clock),
      states: PACE_STATES.map((state) => ({ state, label: PACE_LABEL[state], minutes: minutes(this.time[state]), share: Math.round((this.time[state] / total) * 100) })),
      firstFight: this.firstFight === null ? null : minutes(this.firstFight),
      decisions: { total: this.decisions.length, byKind, gap: stat(gaps) },
      missions: this.missions
        .filter((m) => m.done !== null)
        .map((m) => ({ title: m.title, doorToDoor: m.left !== null && m.back !== null ? minutes(m.back - m.left) : null, acceptToDone: minutes((m.done as number) - m.accepted) })),
      falls: [...this.falls].map(([kind, ms]) => ({ kind, stat: stat(ms.map((x) => x / 1000)) })).sort((a, b) => b.stat.n - a.stat.n),
    };
  }
}
