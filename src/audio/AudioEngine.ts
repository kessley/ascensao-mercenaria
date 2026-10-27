/**
 * Motor de áudio procedural (greybox sonoro): todos os sons são sintetizados na hora
 * com a Web Audio API — osciladores e ruído filtrado, sem arquivos de áudio.
 * Quando houver assets de verdade, basta trocar as receitas em `sounds.ts`.
 *
 * - Posicional: volume cai com a distância até o ouvinte (centro da câmera) e o som
 *   vem da esquerda/direita conforme a posição na tela.
 * - Limite por som (evita centenas de "clangs" no mesmo instante numa batalha grande).
 * - Volume e mudo persistem no navegador.
 */

const STORAGE_KEY = "ascensao.audio";

export interface PlayOptions {
  /** Posição no mundo (som posicional). Sem posição = som de interface, sempre audível. */
  x?: number;
  y?: number;
  /** Multiplicador de volume. */
  volume?: number;
  /** Variação de afinação (1 = original). */
  pitch?: number;
}

export type SoundRecipe = (ctx: AudioContext, out: AudioNode, opts: { pitch: number; noise: AudioBuffer }) => void;

interface AudioSettings {
  volume: number;
  muted: boolean;
}

type Listener = () => void;

class AudioEngineImpl {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  private listener = { x: 0, y: 0, halfWidth: 640, hearing: 1400 };
  private lastPlayed = new Map<string, number>();
  private playingNow = new Map<string, number>();
  private settings: AudioSettings = { volume: 0.7, muted: false };
  private subscribers = new Set<Listener>();
  private loops = new Map<string, { stop: () => void }>();

  constructor() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null") as AudioSettings | null;
      if (saved && typeof saved.volume === "number") this.settings = { volume: saved.volume, muted: !!saved.muted };
    } catch {
      // armazenamento indisponível: usa o padrão
    }
  }

  /** O navegador só libera áudio após um gesto do usuário: chame em clique/tecla. */
  unlock(): void {
    if (!this.ctx) {
      const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctx) return;
      this.ctx = new Ctx();
      this.master = this.ctx.createGain();
      this.master.connect(this.ctx.destination);
      this.noise = this.makeNoise(this.ctx);
      this.applyVolume();
    }
    if (this.ctx.state === "suspended") void this.ctx.resume();
  }

  /** Atualizado pela cena a cada quadro: centro da câmera e quanto da tela está visível. */
  setListener(x: number, y: number, viewWidth: number): void {
    this.listener.x = x;
    this.listener.y = y;
    this.listener.halfWidth = viewWidth / 2;
    // Com zoom afastado se ouve mais longe (a visão abrange mais do campo)
    this.listener.hearing = Math.max(1000, viewWidth * 1.1);
  }

  /**
   * Toca um som. `throttleMs` evita repetições no mesmo intervalo; `maxVoices` limita
   * quantos podem soar juntos (a batalha não vira ruído branco).
   */
  play(name: string, recipe: SoundRecipe, opts: PlayOptions = {}, throttleMs = 0, maxVoices = 6): void {
    const ctx = this.ctx;
    if (!ctx || !this.master || !this.noise || this.settings.muted || ctx.state !== "running") return;
    const now = performance.now();
    if (throttleMs > 0 && now - (this.lastPlayed.get(name) ?? -Infinity) < throttleMs) return;
    if ((this.playingNow.get(name) ?? 0) >= maxVoices) return;

    let gain = opts.volume ?? 1;
    let pan = 0;
    if (opts.x !== undefined && opts.y !== undefined) {
      const dx = opts.x - this.listener.x;
      const dy = opts.y - this.listener.y;
      const d = Math.hypot(dx, dy);
      const falloff = 1 - d / this.listener.hearing;
      if (falloff <= 0.02) return; // longe demais para ouvir
      gain *= falloff * falloff;
      pan = Math.max(-1, Math.min(1, dx / (this.listener.halfWidth * 1.4)));
    }

    this.lastPlayed.set(name, now);
    this.playingNow.set(name, (this.playingNow.get(name) ?? 0) + 1);
    setTimeout(() => this.playingNow.set(name, Math.max(0, (this.playingNow.get(name) ?? 1) - 1)), 400);

    const out = ctx.createGain();
    out.gain.value = gain;
    const panner = ctx.createStereoPanner();
    panner.pan.value = pan;
    out.connect(panner).connect(this.master);
    recipe(ctx, out, { pitch: opts.pitch ?? 1, noise: this.noise });
  }

  /** Som ambiente contínuo (ex.: fogueira). Idempotente por nome. */
  startLoop(name: string, start: (ctx: AudioContext, out: AudioNode, noise: AudioBuffer) => () => void): void {
    if (this.loops.has(name)) return;
    const ctx = this.ctx;
    if (!ctx || !this.master || !this.noise) {
      // Ainda bloqueado: tenta de novo quando o áudio for liberado
      const retry = () => {
        window.removeEventListener("pointerdown", retry);
        window.removeEventListener("keydown", retry);
        setTimeout(() => this.startLoop(name, start), 50);
      };
      window.addEventListener("pointerdown", retry);
      window.addEventListener("keydown", retry);
      this.loops.set(name, { stop: () => {
        window.removeEventListener("pointerdown", retry);
        window.removeEventListener("keydown", retry);
      } });
      return;
    }
    const out = ctx.createGain();
    out.connect(this.master);
    const stop = start(ctx, out, this.noise);
    this.loops.set(name, {
      stop: () => {
        stop();
        out.disconnect();
      },
    });
  }

  stopLoop(name: string): void {
    this.loops.get(name)?.stop();
    this.loops.delete(name);
  }

  // --- Configuração (volume/mudo) ---

  getSettings(): AudioSettings {
    return this.settings;
  }

  setVolume(volume: number): void {
    this.settings = { ...this.settings, volume: Math.max(0, Math.min(1, volume)) };
    this.persist();
  }

  toggleMute(): void {
    this.settings = { ...this.settings, muted: !this.settings.muted };
    this.persist();
  }

  subscribe(fn: Listener): () => void {
    this.subscribers.add(fn);
    return () => this.subscribers.delete(fn);
  }

  private persist(): void {
    this.applyVolume();
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.settings));
    } catch {
      // sem armazenamento: vale só nesta sessão
    }
    for (const fn of this.subscribers) fn();
  }

  private applyVolume(): void {
    if (!this.master || !this.ctx) return;
    const v = this.settings.muted ? 0 : this.settings.volume;
    this.master.gain.setTargetAtTime(v * 0.8, this.ctx.currentTime, 0.02);
  }

  private makeNoise(ctx: AudioContext): AudioBuffer {
    const buffer = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    return buffer;
  }
}

export const AudioEngine = new AudioEngineImpl();

// Libera o áudio no primeiro gesto do usuário (regra de autoplay dos navegadores)
const unlockOnce = () => AudioEngine.unlock();
window.addEventListener("pointerdown", unlockOnce);
window.addEventListener("keydown", unlockOnce);

// Acesso para depuração/testes automatizados (somente em dev)
if (import.meta.env.DEV) (window as unknown as { __audio?: AudioEngineImpl }).__audio = AudioEngine;
