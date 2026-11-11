/**
 * Motor de áudio procedural: todos os sons são sintetizados na hora com a Web Audio API
 * (osciladores e ruído filtrado), sem arquivos de áudio. As receitas ficam em `sounds.ts` e
 * `voice.ts`; as regras da mesa de som, em `mixer.ts`.
 *
 * - Cinco canais (interface, vozes, combate, ambiente e música), cada um com o seu volume.
 * - Prioridade: o alarme abaixa os outros canais; a voz abaixa o ambiente e a música.
 * - Posicional: o volume cai com a distância até o ouvinte (o centro da câmera) e o som vem da
 *   esquerda ou da direita conforme a posição na tela.
 * - Limite por som e por canal, e um limitador no fim: mil golpes não viram ruído nem estouram.
 * - O jogo em pausa cala o combate; a aba escondida suspende tudo.
 * - Os volumes e o mudo ficam guardados no navegador.
 */
import { BUSES, BUS_VOICES, Gate, duckFor, placeSound, readMix, type Bus, type DuckState, type MixSettings } from "./mixer";

const STORAGE_KEY = "ascensao.audio";

export interface PlayOptions {
  /** Posição no mundo (som posicional). Sem posição, o som é de interface: sempre audível. */
  x?: number;
  y?: number;
  /** Multiplicador de volume. */
  volume?: number;
  /** Variação de afinação (1 = original). */
  pitch?: number;
  /** Canal. Sem ele: o som com posição vai para o combate, e o sem posição, para a interface. */
  bus?: Bus;
  /** Alarme: abaixa os outros canais enquanto toca. */
  alarm?: boolean;
  /** Quanto o som dura, em segundos: é o tempo em que ele conta como soando. */
  seconds?: number;
}

export type SoundRecipe = (ctx: BaseAudioContext, out: AudioNode, opts: { pitch: number; noise: AudioBuffer }) => void;

type Listener = () => void;

/** O que o motor anota de cada som que passou (modo de desenvolvimento): os testes leem daqui. */
export interface SoundEvent {
  name: string;
  bus: Bus;
  at: number;
  alarm: boolean;
}

const LOG_MAX = 600;

function makeNoise(ctx: BaseAudioContext): AudioBuffer {
  const buffer = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  return buffer;
}

class AudioEngineImpl {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private buses: Record<Bus, GainNode> | null = null;
  private noise: AudioBuffer | null = null;
  private listener = { x: 0, y: 0, halfWidth: 640, hearing: 1400 };
  private gate = new Gate(BUS_VOICES);
  private settings: MixSettings = readMix(null);
  private subscribers = new Set<Listener>();
  private loops = new Map<string, { stop: () => void; gain?: GainNode }>();
  private alarmUntil = 0;
  private voiceUntil = 0;
  private paused = false;
  private duckTimer: number | null = null;
  /** Os sons que passaram pela porteira (só em desenvolvimento) e o pico de vozes juntas. */
  readonly log: SoundEvent[] = [];
  peakVoices = 0;

  constructor() {
    try {
      this.settings = readMix(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null"));
    } catch {
      // armazenamento indisponível: usa o padrão
    }
  }

  /** O navegador só libera áudio após um gesto do usuário: chame em clique ou tecla. */
  unlock(): void {
    if (!this.ctx) {
      const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctx) return;
      const ctx = new Ctx();
      this.ctx = ctx;
      // O limitador fica no fim da cadeia: segura o pico quando muita coisa soa junta
      const limiter = ctx.createDynamicsCompressor();
      limiter.threshold.value = -12;
      limiter.knee.value = 6;
      limiter.ratio.value = 12;
      limiter.attack.value = 0.003;
      limiter.release.value = 0.2;
      limiter.connect(ctx.destination);
      this.master = ctx.createGain();
      this.master.connect(limiter);
      const buses = {} as Record<Bus, GainNode>;
      for (const b of BUSES) {
        buses[b] = ctx.createGain();
        buses[b].connect(this.master);
      }
      this.buses = buses;
      this.noise = makeNoise(ctx);
      this.applyVolume(0);
    }
    if (this.ctx.state === "suspended" && !document.hidden) void this.ctx.resume();
  }

  /** A aba escondida suspende tudo; de volta, o som retoma. */
  setHidden(hidden: boolean): void {
    if (!this.ctx) return;
    if (hidden) void this.ctx.suspend();
    else void this.ctx.resume();
  }

  /** Pausa tática (mapa, painel, relatório): o combate se cala, o resto continua. */
  setPaused(paused: boolean): void {
    if (this.paused === paused) return;
    this.paused = paused;
    this.applyVolume();
  }

  /** Atualizado pela cena a cada quadro: o centro da câmera e quanto da tela está visível. */
  setListener(x: number, y: number, viewWidth: number): void {
    this.listener.x = x;
    this.listener.y = y;
    this.listener.halfWidth = viewWidth / 2;
    // Com o zoom afastado se ouve mais longe (a visão abrange mais do campo)
    this.listener.hearing = Math.max(1000, viewWidth * 1.1);
  }

  /** Quanto se ouve, de 0 a 1, um som nesta posição do mundo (0 = longe demais). */
  audibility(x: number, y: number): number {
    return placeSound(x - this.listener.x, y - this.listener.y, this.listener.hearing, this.listener.halfWidth)?.gain ?? 0;
  }

  /** Um alarme está tocando agora? (as vozes esperam) */
  get alarmOn(): boolean {
    return performance.now() < this.alarmUntil;
  }

  /**
   * Toca um som. `throttleMs` evita repetições no mesmo intervalo; `maxVoices` limita quantos
   * iguais soam juntos. Devolve se o som passou pela porteira (mesmo com o áudio ainda bloqueado).
   */
  play(name: string, recipe: SoundRecipe, opts: PlayOptions = {}, throttleMs = 0, maxVoices = 6): boolean {
    const positional = opts.x !== undefined && opts.y !== undefined;
    const bus: Bus = opts.bus ?? (positional ? "combat" : "ui");
    const now = performance.now();
    if (bus === "combat" && this.paused) return false;
    // A voz nunca fala por cima de um alarme
    if (bus === "voice" && now < this.alarmUntil) return false;

    let gain = opts.volume ?? 1;
    let pan = 0;
    if (positional) {
      const placed = placeSound((opts.x as number) - this.listener.x, (opts.y as number) - this.listener.y, this.listener.hearing, this.listener.halfWidth);
      if (!placed) return false; // longe demais para ouvir
      gain *= placed.gain;
      pan = placed.pan;
    }
    const seconds = opts.seconds ?? 0.4;
    if (!this.gate.allow(name, bus, now, throttleMs, maxVoices, seconds * 1000)) return false;
    this.note(name, bus, now, !!opts.alarm);
    if (opts.alarm) this.duck("alarm", now + seconds * 1000);
    else if (bus === "voice") this.duck("voice", now + seconds * 1000);

    const ctx = this.ctx;
    if (!ctx || !this.buses || !this.noise || this.settings.muted || ctx.state !== "running") return true;
    const out = ctx.createGain();
    out.gain.value = gain;
    const panner = ctx.createStereoPanner();
    panner.pan.value = pan;
    out.connect(panner).connect(this.buses[bus]);
    recipe(ctx, out, { pitch: opts.pitch ?? 1, noise: this.noise });
    return true;
  }

  private note(name: string, bus: Bus, now: number, alarm: boolean): void {
    this.peakVoices = Math.max(this.peakVoices, this.gate.total(now));
    if (!import.meta.env.DEV) return;
    this.log.push({ name, bus, at: now, alarm });
    if (this.log.length > LOG_MAX) this.log.splice(0, this.log.length - LOG_MAX);
  }

  /** Quantos sons estão soando agora, em todos os canais. */
  voicesNow(): number {
    return this.gate.total(performance.now());
  }

  private duck(kind: "alarm" | "voice", until: number): void {
    if (kind === "alarm") this.alarmUntil = Math.max(this.alarmUntil, until);
    else this.voiceUntil = Math.max(this.voiceUntil, until);
    this.applyVolume();
    // Quando o alarme ou a voz acaba, os canais voltam
    if (this.duckTimer !== null) window.clearTimeout(this.duckTimer);
    const next = Math.max(this.alarmUntil, this.voiceUntil) - performance.now();
    this.duckTimer = window.setTimeout(() => {
      this.duckTimer = null;
      this.applyVolume(0.25);
    }, Math.max(30, next + 20));
  }

  /** Som contínuo (a fogueira, o rugido da linha). Idempotente por nome. */
  startLoop(name: string, start: (ctx: AudioContext, out: AudioNode, noise: AudioBuffer) => () => void, bus: Bus = "ambience"): void {
    if (this.loops.has(name)) return;
    const ctx = this.ctx;
    if (!ctx || !this.buses || !this.noise) {
      // Ainda bloqueado: tenta de novo quando o áudio for liberado
      const retry = () => {
        window.removeEventListener("pointerdown", retry);
        window.removeEventListener("keydown", retry);
        // Tira o marcador de espera antes de tentar de novo (senão a nova tentativa acha que já toca)
        this.loops.delete(name);
        setTimeout(() => this.startLoop(name, start, bus), 50);
      };
      window.addEventListener("pointerdown", retry);
      window.addEventListener("keydown", retry);
      this.loops.set(name, {
        stop: () => {
          window.removeEventListener("pointerdown", retry);
          window.removeEventListener("keydown", retry);
        },
      });
      return;
    }
    const out = ctx.createGain();
    out.connect(this.buses[bus]);
    const stop = start(ctx, out, this.noise);
    this.loops.set(name, {
      gain: out,
      stop: () => {
        stop();
        out.disconnect();
      },
    });
  }

  /** Volume de um som contínuo (0 a 1), como a fogueira mais alta de perto. */
  setLoopVolume(name: string, volume: number): void {
    const gain = this.loops.get(name)?.gain;
    if (gain && this.ctx) gain.gain.setTargetAtTime(volume, this.ctx.currentTime, 0.1);
  }

  hasLoop(name: string): boolean {
    return this.loops.has(name);
  }

  stopLoop(name: string): void {
    this.loops.get(name)?.stop();
    this.loops.delete(name);
  }

  /**
   * Toca uma receita fora do tempo real e devolve as amostras: é como os testes conferem que um
   * som existe, não estoura e soa diferente de outro.
   */
  async render(recipe: SoundRecipe, seconds: number, pitch = 1): Promise<Float32Array> {
    const rate = 22050;
    const ctx = new OfflineAudioContext(1, Math.ceil(rate * seconds), rate);
    recipe(ctx, ctx.destination, { pitch, noise: makeNoise(ctx) });
    return (await ctx.startRendering()).getChannelData(0);
  }

  // --- Configuração (volumes e mudo) ---

  getSettings(): MixSettings {
    return this.settings;
  }

  setVolume(volume: number): void {
    this.settings = { ...this.settings, volume: Math.max(0, Math.min(1, volume)) };
    this.persist();
  }

  setBusVolume(bus: Bus, volume: number): void {
    this.settings = { ...this.settings, buses: { ...this.settings.buses, [bus]: Math.max(0, Math.min(1, volume)) } };
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

  /** O que cada canal toca agora: o volume escolhido vezes o que a prioridade deixa passar. */
  busLevel(bus: Bus): number {
    const now = performance.now();
    const state: DuckState = { alarm: now < this.alarmUntil, voice: now < this.voiceUntil, paused: this.paused };
    return this.settings.buses[bus] * duckFor(bus, state);
  }

  private applyVolume(ramp = 0.04): void {
    if (!this.master || !this.buses || !this.ctx) return;
    const t = this.ctx.currentTime;
    const v = this.settings.muted ? 0 : this.settings.volume;
    this.master.gain.setTargetAtTime(v * 0.8, t, 0.02);
    for (const b of BUSES) {
      if (ramp <= 0) this.buses[b].gain.value = this.busLevel(b);
      else this.buses[b].gain.setTargetAtTime(this.busLevel(b), t, ramp);
    }
  }
}

export const AudioEngine = new AudioEngineImpl();

// Libera o áudio no primeiro gesto do usuário (regra de autoplay dos navegadores)
const unlockOnce = () => AudioEngine.unlock();
window.addEventListener("pointerdown", unlockOnce);
window.addEventListener("keydown", unlockOnce);
document.addEventListener("visibilitychange", () => AudioEngine.setHidden(document.hidden));

// Acesso para depuração e para os testes automatizados (somente em desenvolvimento)
if (import.meta.env.DEV) (window as unknown as { __audio?: AudioEngineImpl }).__audio = AudioEngine;
