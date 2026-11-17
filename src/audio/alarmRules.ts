/**
 * Os alarmes e os sinais (S1), só as regras: quem toca, quanto espera para tocar de novo, quem
 * passa na frente de quem e onde fica a seta na borda da tela. Não sabe o que é a Web Audio nem a
 * cena, então dá para testar sem navegador. As receitas ficam em `alarmSounds.ts`; quem dispara,
 * na cena (`worldScene/alarms.ts`).
 */
import type { IconId } from "../game/art/icons";
import type { Point } from "../utils/math";

export type AlarmKind = "camp" | "village" | "hero" | "duel" | "convoy" | "scout" | "messenger" | "wages" | "war" | "calamity";

export const ALARM_KINDS: readonly AlarmKind[] = ["camp", "village", "hero", "duel", "convoy", "scout", "messenger", "wages", "war", "calamity"];

export interface AlarmSpec {
  /** O nome curto na seta. */
  label: string;
  icon: IconId;
  /** Perigo (vermelho) ou notícia (âmbar). */
  tone: "danger" | "news";
  /** Abaixa os outros canais enquanto toca (o perigo); o sinal só soa por cima. */
  ducks: boolean;
  /** Quem passa na frente: um alarme menor não toca por cima de um maior (só ganha a seta). */
  rank: number;
  /** O mesmo alarme, no mesmo lugar, não toca de novo antes disto (ms). */
  cooldownMs: number;
  /** O mesmo tipo, em qualquer lugar, não toca de novo antes disto (ms). */
  kindGapMs: number;
  /** Quanto a seta fica na tela (ms). */
  showMs: number;
}

export const ALARMS: Readonly<Record<AlarmKind, AlarmSpec>> = {
  camp: { label: "Acampamento atacado", icon: "TENT", tone: "danger", ducks: true, rank: 9, cooldownMs: 45_000, kindGapMs: 20_000, showMs: 12_000 },
  calamity: { label: "Calamidade", icon: "SKULL", tone: "danger", ducks: true, rank: 8, cooldownMs: 600_000, kindGapMs: 60_000, showMs: 15_000 },
  village: { label: "Aldeia atacada", icon: "FIRE", tone: "danger", ducks: true, rank: 7, cooldownMs: 60_000, kindGapMs: 15_000, showMs: 12_000 },
  war: { label: "Guerra declarada", icon: "BANNER", tone: "danger", ducks: true, rank: 6, cooldownMs: 600_000, kindGapMs: 20_000, showMs: 12_000 },
  hero: { label: "Herói inimigo", icon: "CROWN", tone: "danger", ducks: true, rank: 5, cooldownMs: 120_000, kindGapMs: 8_000, showMs: 10_000 },
  convoy: { label: "Comboio atacado", icon: "WAGON", tone: "danger", ducks: true, rank: 5, cooldownMs: 40_000, kindGapMs: 15_000, showMs: 10_000 },
  duel: { label: "Duelo", icon: "SWORD", tone: "news", ducks: false, rank: 4, cooldownMs: 20_000, kindGapMs: 5_000, showMs: 8_000 },
  wages: { label: "Soldo atrasado", icon: "GOLD", tone: "news", ducks: false, rank: 3, cooldownMs: 120_000, kindGapMs: 60_000, showMs: 10_000 },
  scout: { label: "Batedor de volta", icon: "EYE", tone: "news", ducks: false, rank: 2, cooldownMs: 6_000, kindGapMs: 4_000, showMs: 9_000 },
  messenger: { label: "Mensageiro", icon: "LETTER", tone: "news", ducks: false, rank: 1, cooldownMs: 1_500, kindGapMs: 1_500, showMs: 6_000 },
};

/** Uma seta na tela: aponta para `at`, que pode ser alguém andando (lido a cada quadro). */
export interface Signal {
  id: number;
  kind: AlarmKind;
  key: string;
  /** Para onde a seta aponta (null: só o som). */
  at: Point | null;
  /** A notícia por extenso (o título da seta). */
  text: string;
  born: number;
  until: number;
}

export interface Raised {
  /** Toca o som agora. */
  sound: boolean;
  /** A seta (nova ou a que já estava, renovada); null quando o alarme está no descanso. */
  signal: Signal | null;
  /** Um alarme maior está tocando: daqui a quanto este pode tocar (ms; 0 = não espera). */
  waitMs: number;
}

/** Quantas setas cabem na tela juntas. */
export const MAX_SIGNALS = 4;

/**
 * O quadro dos alarmes: lembra quando cada um tocou, decide se toca de novo e guarda as setas.
 * O mesmo perigo que continua (o acampamento ainda sob ataque) não toca outra vez antes do
 * descanso, mas a seta dele fica e segue o lugar.
 */
export class AlarmBoard {
  private lastKey = new Map<string, number>();
  private lastKind = new Map<AlarmKind, number>();
  private soundingUntil = -Infinity;
  private soundingRank = 0;
  private nextId = 1;
  signals: Signal[] = [];

  raise(kind: AlarmKind, now: number, opts: { key?: string; at?: Point | null; text?: string; seconds?: number } = {}): Raised {
    const spec = ALARMS[kind];
    const key = `${kind}:${opts.key ?? ""}`;
    const at = opts.at ?? null;
    const shown = this.signals.find((s) => s.kind === kind && s.key === key);
    if (now - (this.lastKey.get(key) ?? -Infinity) < spec.cooldownMs) {
      // No descanso: não toca, mas a seta que já estava fica e acompanha
      if (shown) {
        shown.until = Math.max(shown.until, now + spec.showMs);
        if (at) shown.at = at;
        if (opts.text) shown.text = opts.text;
      }
      return { sound: false, signal: shown ?? null, waitMs: 0 };
    }
    this.lastKey.set(key, now);
    const signal: Signal = { id: this.nextId++, kind, key, at, text: opts.text ?? spec.label, born: now, until: now + spec.showMs };
    this.signals = [...this.signals.filter((s) => s !== shown), signal];
    // Setas demais: some a de menor peso (e, no empate, a mais velha)
    while (this.signals.length > MAX_SIGNALS) {
      const weakest = this.signals.reduce((w, s) => (ALARMS[s.kind].rank < ALARMS[w.kind].rank || (ALARMS[s.kind].rank === ALARMS[w.kind].rank && s.born < w.born) ? s : w));
      this.signals = this.signals.filter((s) => s !== weakest);
    }
    return { ...this.ring(kind, now, opts.seconds ?? 2), signal };
  }

  /**
   * Toca agora, se pode: o mesmo tipo não repete antes do intervalo, e um menor não toca por cima
   * de um maior. Quando só o maior atrapalha, diz quanto falta para ele acabar (a vez chega).
   */
  ring(kind: AlarmKind, now: number, seconds: number): { sound: boolean; waitMs: number } {
    const spec = ALARMS[kind];
    const gapOk = now - (this.lastKind.get(kind) ?? -Infinity) >= spec.kindGapMs;
    const outranked = now < this.soundingUntil && spec.rank < this.soundingRank;
    if (!gapOk || outranked) return { sound: false, waitMs: gapOk ? this.soundingUntil - now : 0 };
    this.lastKind.set(kind, now);
    this.soundingUntil = now + seconds * 1000;
    this.soundingRank = spec.rank;
    return { sound: true, waitMs: 0 };
  }

  /** A seta ainda está na tela? (quem espera a vez só toca se o perigo ainda vale) */
  showing(id: number, now: number): boolean {
    return this.signals.some((s) => s.id === id && s.until > now);
  }

  /** As setas que ainda valem (as vencidas saem). */
  active(now: number): Signal[] {
    if (this.signals.some((s) => s.until <= now)) this.signals = this.signals.filter((s) => s.until > now);
    return this.signals;
  }

  /** O jogador clicou na seta: ela some (e o alarme continua no descanso). */
  dismiss(id: number): void {
    this.signals = this.signals.filter((s) => s.id !== id);
  }

  clear(): void {
    this.signals = [];
    this.lastKey.clear();
    this.lastKind.clear();
    this.soundingUntil = -Infinity;
    this.soundingRank = 0;
  }
}

/** Onde a seta fica: dentro da tela (`inside`), ou presa na borda, apontando para fora. */
export interface EdgeMark {
  x: number;
  y: number;
  /** Para onde aponta, em radianos (0 = direita, π/2 = baixo). */
  angle: number;
  inside: boolean;
}

/**
 * Um ponto da tela (sx, sy) numa tela w × h: se ele está dentro (com a margem), a marca fica em
 * cima dele; se está fora, a seta vai para a borda, na linha que sai do centro até ele.
 */
export function edgeMark(sx: number, sy: number, w: number, h: number, margin: number): EdgeMark {
  const cx = w / 2;
  const cy = h / 2;
  const angle = Math.atan2(sy - cy, sx - cx);
  if (sx >= margin && sx <= w - margin && sy >= margin && sy <= h - margin) return { x: sx, y: sy, angle, inside: true };
  const dx = sx - cx;
  const dy = sy - cy;
  const halfW = Math.max(1, cx - margin);
  const halfH = Math.max(1, cy - margin);
  // Quanto andar do centro até bater na borda de dentro (a margem)
  const t = Math.min(dx !== 0 ? halfW / Math.abs(dx) : Infinity, dy !== 0 ? halfH / Math.abs(dy) : Infinity);
  return { x: cx + dx * t, y: cy + dy * t, angle, inside: false };
}

/** O que a cena olha no reino para os alarmes de longe: guerras, calamidades, soldo e a sede. */
export interface RealmWatch {
  /** As guerras em curso ("a|b|desde"). */
  wars: readonly string[];
  /** As calamidades de pé (ids). */
  calamities: readonly string[];
  /** Semanas de soldo atrasado. */
  arrears: number;
  /** Inimigos às muralhas da sede. */
  seatAlarm: boolean;
}

export interface RealmNews {
  wars: string[];
  calamities: string[];
  arrears: boolean;
  seat: boolean;
}

/**
 * O que mudou desde a última olhada. Sem a anterior (a cena acabou de abrir, o jogo foi
 * carregado), nada é notícia: só se toma nota.
 */
export function realmNews(prev: RealmWatch | null, next: RealmWatch): RealmNews {
  if (!prev) return { wars: [], calamities: [], arrears: false, seat: false };
  return {
    wars: next.wars.filter((w) => !prev.wars.includes(w)),
    calamities: next.calamities.filter((c) => !prev.calamities.includes(c)),
    arrears: next.arrears > prev.arrears,
    seat: next.seatAlarm && !prev.seatAlarm,
  };
}
