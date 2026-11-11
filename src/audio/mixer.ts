/**
 * A mesa de som (S1), só as regras: os canais, o que fica guardado, quem abaixa quem e quantos
 * sons cabem juntos. Não sabe o que é a Web Audio, então dá para testar sem navegador.
 */

/** Os cinco canais, cada um com o seu volume. */
export type Bus = "ui" | "voice" | "combat" | "ambience" | "music";

export const BUSES: readonly Bus[] = ["ui", "voice", "combat", "ambience", "music"];

export const BUS_LABEL: Record<Bus, string> = {
  ui: "Interface",
  voice: "Vozes",
  combat: "Combate",
  ambience: "Ambiente",
  music: "Música",
};

export interface MixSettings {
  /** Volume geral, de 0 a 1. */
  volume: number;
  muted: boolean;
  buses: Record<Bus, number>;
}

export const DEFAULT_MIX: MixSettings = {
  volume: 0.7,
  muted: false,
  buses: { ui: 0.8, voice: 0.9, combat: 1, ambience: 0.7, music: 0.6 },
};

const unit = (v: unknown, fallback: number): number => (typeof v === "number" && Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : fallback);

/** Lê o que estava guardado. O formato antigo tinha só volume e mudo: os canais nascem no padrão. */
export function readMix(raw: unknown): MixSettings {
  const r = raw && typeof raw === "object" ? (raw as Partial<MixSettings>) : {};
  const saved = r.buses && typeof r.buses === "object" ? (r.buses as Partial<Record<Bus, unknown>>) : {};
  const buses = { ...DEFAULT_MIX.buses };
  for (const b of BUSES) buses[b] = unit(saved[b], DEFAULT_MIX.buses[b]);
  return { volume: unit(r.volume, DEFAULT_MIX.volume), muted: r.muted === true, buses };
}

/** Quantos sons de cada canal podem soar ao mesmo tempo. */
export const BUS_VOICES: Record<Bus, number> = { ui: 6, voice: 3, combat: 28, ambience: 10, music: 12 };

export interface DuckState {
  /** Um alarme está tocando. */
  alarm: boolean;
  /** Alguém está falando. */
  voice: boolean;
  /** O jogo está em pausa (mapa, painel, relatório). */
  paused: boolean;
}

/**
 * Quanto cada canal toca agora, de 0 a 1 (fora o volume que o jogador escolheu):
 * - o alarme abaixa todos os outros, menos a interface, que é por onde ele sai;
 * - a voz abaixa o ambiente e a música;
 * - o jogo em pausa cala o combate.
 */
export function duckFor(bus: Bus, s: DuckState): number {
  if (bus === "ui") return 1;
  if (bus === "combat" && s.paused) return 0;
  let level = 1;
  if (s.alarm) level *= bus === "voice" ? 0.5 : 0.35;
  if (s.voice && (bus === "ambience" || bus === "music")) level *= 0.6;
  return level;
}

/**
 * A porteira: decide se um pedido de som toca. Cada som tem um intervalo mínimo e um número de
 * vozes; cada canal tem um teto. É o que impede mil golpes de virarem ruído numa batalha grande.
 */
export class Gate {
  private last = new Map<string, number>();
  private ends = new Map<string, number[]>();
  private busEnds: Record<Bus, number[]> = { ui: [], voice: [], combat: [], ambience: [], music: [] };

  constructor(private readonly limits: Record<Bus, number> = BUS_VOICES) {}

  private alive(list: number[], now: number): number[] {
    return list.length > 0 && list[0] <= now ? list.filter((t) => t > now) : list;
  }

  /** Quantos sons do canal estão soando. */
  playing(bus: Bus, now: number): number {
    return (this.busEnds[bus] = this.alive(this.busEnds[bus], now)).length;
  }

  /**
   * Pede passagem. `throttleMs`: intervalo mínimo entre dois iguais. `maxVoices`: quantos iguais
   * juntos. `holdMs`: por quanto tempo este conta como soando.
   */
  allow(name: string, bus: Bus, now: number, throttleMs: number, maxVoices: number, holdMs: number): boolean {
    if (throttleMs > 0 && now - (this.last.get(name) ?? -Infinity) < throttleMs) return false;
    const mine = this.alive(this.ends.get(name) ?? [], now);
    if (mine.length >= maxVoices) return false;
    if (this.playing(bus, now) >= this.limits[bus]) return false;
    this.last.set(name, now);
    mine.push(now + holdMs);
    this.ends.set(name, mine);
    this.busEnds[bus].push(now + holdMs);
    return true;
  }

  /** O pico de vozes juntas, para os testes de batalha grande. */
  total(now: number): number {
    return BUSES.reduce((n, b) => n + this.playing(b, now), 0);
  }
}

/** Quanto um som a esta distância se ouve (0 a 1) e de que lado vem (−1 esquerda, 1 direita). */
export function placeSound(dx: number, dy: number, hearing: number, halfWidth: number): { gain: number; pan: number } | null {
  const falloff = 1 - Math.hypot(dx, dy) / hearing;
  if (falloff <= 0.02) return null;
  return { gain: falloff * falloff, pan: Math.max(-1, Math.min(1, dx / (halfWidth * 1.4))) };
}
