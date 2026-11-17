/**
 * Os alarmes ao vivo (S1): a cena pede, o quadro decide, o som toca do lado de onde vem e a seta
 * aparece na borda da tela. A seta é desenhada em React (`ui/components/AlarmArrows.tsx`), que lê
 * daqui as setas e a visão da câmera.
 */
import { AudioEngine } from "./AudioEngine";
import { ALARMS, AlarmBoard, type AlarmKind, type Signal } from "./alarmRules";
import { ALARM_SOUNDS } from "./alarmSounds";
import type { Point } from "../utils/math";

type Listener = () => void;

const board = new AlarmBoard();
const listeners = new Set<Listener>();

/** O pedaço do mundo que a câmera mostra agora (atualizado pela cena a cada quadro). */
const view = { x: 0, y: 0, width: 1, height: 1, live: false };

function changed(): void {
  for (const fn of listeners) fn();
}

export interface RaiseOptions {
  /** O mesmo alarme em lugares diferentes (duas aldeias) toca para cada um. */
  key?: string;
  /** Para onde a seta aponta; pode ser alguém andando (a seta segue). */
  at?: Point | null;
  /** A notícia por extenso. */
  text?: string;
}

/** O som de um alarme, inteiro de qualquer lugar; só o lado diz de onde vem. */
function play(kind: AlarmKind, at: Point | null): boolean {
  const sound = ALARM_SOUNDS[kind];
  const pan = at ? AudioEngine.panOf(at.x, at.y) * 0.7 : 0;
  return AudioEngine.play(`alarme:${kind}`, sound.recipe, { bus: "ui", alarm: ALARMS[kind].ducks, seconds: sound.seconds, volume: sound.volume, pan }, 0, 1);
}

/** Um alarme menor que chegou durante um maior espera a vez (enquanto a seta dele valer). */
function waitTurn(kind: AlarmKind, signal: Signal, waitMs: number): void {
  window.setTimeout(() => {
    const now = performance.now();
    if (!board.showing(signal.id, now)) return;
    const turn = board.ring(kind, now, ALARM_SOUNDS[kind].seconds);
    if (turn.sound) play(kind, signal.at);
    else if (turn.waitMs > 0) waitTurn(kind, signal, turn.waitMs);
  }, waitMs + 150);
}

export const alarms = {
  /** Um alarme ou sinal: devolve se o som tocou agora. */
  raise(kind: AlarmKind, opts: RaiseOptions = {}): boolean {
    const r = board.raise(kind, performance.now(), { ...opts, seconds: ALARM_SOUNDS[kind].seconds });
    if (r.signal) changed();
    if (r.signal && r.waitMs > 0) waitTurn(kind, r.signal, r.waitMs);
    return r.sound && play(kind, opts.at ?? null);
  },

  active(): Signal[] {
    return board.active(performance.now());
  },

  dismiss(id: number): void {
    board.dismiss(id);
    changed();
  },

  /**
   * A cena saiu (entrou numa casa, voltou ao menu): nenhuma seta fica para trás. O descanso de
   * cada alarme fica: sair da casa ao lado do herói não toca o tambor de novo.
   */
  clear(): void {
    board.signals = [];
    view.live = false;
    changed();
  },

  /** Esquece tudo, até o descanso (os testes começam limpos). */
  reset(): void {
    board.clear();
    changed();
  },

  setView(x: number, y: number, width: number, height: number): void {
    view.x = x;
    view.y = y;
    view.width = width;
    view.height = height;
    view.live = true;
  },

  view(): Readonly<typeof view> {
    return view;
  },

  subscribe(fn: Listener): () => void {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },
};

// Acesso para os testes automatizados (somente em desenvolvimento)
if (import.meta.env.DEV) (window as unknown as { __alarms?: typeof alarms }).__alarms = alarms;
