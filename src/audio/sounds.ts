import { AudioEngine, type PlayOptions, type SoundRecipe } from "./AudioEngine";

/*
 * Receitas sonoras (greybox): cada som é feito de ruído filtrado e osciladores.
 * Notas usadas nos toques: G4=392, C5=523, E5=659, G5=784, C6=1047.
 */

// --- Blocos básicos ---

function envelope(ctx: AudioContext, g: GainNode, start: number, attack: number, dur: number, peak: number): void {
  g.gain.setValueAtTime(0.0001, start);
  g.gain.exponentialRampToValueAtTime(peak, start + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
}

interface NoiseSpec {
  filter: BiquadFilterType;
  freq: number;
  freqEnd?: number;
  q?: number;
  dur: number;
  attack?: number;
  gain: number;
  delay?: number;
}

function noiseBurst(ctx: AudioContext, out: AudioNode, noise: AudioBuffer, s: NoiseSpec): void {
  const t = ctx.currentTime + (s.delay ?? 0);
  const src = ctx.createBufferSource();
  src.buffer = noise;
  const f = ctx.createBiquadFilter();
  f.type = s.filter;
  f.Q.value = s.q ?? 1;
  f.frequency.setValueAtTime(s.freq, t);
  if (s.freqEnd) f.frequency.exponentialRampToValueAtTime(s.freqEnd, t + s.dur);
  const g = ctx.createGain();
  envelope(ctx, g, t, s.attack ?? 0.005, s.dur, s.gain);
  src.connect(f).connect(g).connect(out);
  src.start(t, Math.random() * 1.5);
  src.stop(t + s.dur + 0.05);
}

interface ToneSpec {
  type: OscillatorType;
  freq: number;
  freqEnd?: number;
  dur: number;
  attack?: number;
  gain: number;
  delay?: number;
}

function tone(ctx: AudioContext, out: AudioNode, s: ToneSpec): void {
  const t = ctx.currentTime + (s.delay ?? 0);
  const o = ctx.createOscillator();
  o.type = s.type;
  o.frequency.setValueAtTime(s.freq, t);
  if (s.freqEnd) o.frequency.exponentialRampToValueAtTime(s.freqEnd, t + s.dur);
  const g = ctx.createGain();
  envelope(ctx, g, t, s.attack ?? 0.005, s.dur, s.gain);
  o.connect(g).connect(out);
  o.start(t);
  o.stop(t + s.dur + 0.05);
}

/** Metal de sopro: dente-de-serra filtrado com leve vibrato — trombetas e cornetas. */
function brass(ctx: AudioContext, out: AudioNode, notes: [number, number][], gain: number, brightness = 2200): void {
  let t = ctx.currentTime;
  for (const [freq, dur] of notes) {
    const o = ctx.createOscillator();
    o.type = "sawtooth";
    o.frequency.setValueAtTime(freq * 0.97, t);
    o.frequency.linearRampToValueAtTime(freq, t + 0.03); // "ataque" do lábio no bocal
    const vib = ctx.createOscillator();
    vib.frequency.value = 5.5;
    const vibAmt = ctx.createGain();
    vibAmt.gain.value = freq * 0.006;
    vib.connect(vibAmt).connect(o.frequency);
    const f = ctx.createBiquadFilter();
    f.type = "lowpass";
    f.frequency.value = brightness;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.03);
    g.gain.setValueAtTime(gain, t + dur * 0.75);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(f).connect(g).connect(out);
    o.start(t);
    vib.start(t);
    o.stop(t + dur + 0.02);
    vib.stop(t + dur + 0.02);
    t += dur * 0.95;
  }
}

// --- Receitas ---

const clash: SoundRecipe = (ctx, out, { pitch, noise }) => {
  noiseBurst(ctx, out, noise, { filter: "bandpass", freq: 2800 * pitch, q: 3, dur: 0.07, gain: 0.5 });
  tone(ctx, out, { type: "square", freq: 1750 * pitch, dur: 0.12, gain: 0.05 });
  tone(ctx, out, { type: "square", freq: 2630 * pitch, dur: 0.09, gain: 0.035 });
};

const swing: SoundRecipe = (ctx, out, { pitch, noise }) => {
  noiseBurst(ctx, out, noise, { filter: "bandpass", freq: 700 * pitch, freqEnd: 2200 * pitch, q: 2, dur: 0.18, attack: 0.04, gain: 0.45 });
};

const bowShot: SoundRecipe = (ctx, out, { pitch, noise }) => {
  tone(ctx, out, { type: "triangle", freq: 190 * pitch, freqEnd: 120 * pitch, dur: 0.09, gain: 0.25 });
  noiseBurst(ctx, out, noise, { filter: "highpass", freq: 3200, freqEnd: 1200, dur: 0.14, attack: 0.01, gain: 0.18, delay: 0.02 });
};

const arrowHit: SoundRecipe = (ctx, out, { pitch, noise }) => {
  noiseBurst(ctx, out, noise, { filter: "lowpass", freq: 700 * pitch, dur: 0.06, gain: 0.4 });
};

const death: SoundRecipe = (ctx, out, { pitch, noise }) => {
  tone(ctx, out, { type: "sine", freq: 150 * pitch, freqEnd: 55, dur: 0.28, gain: 0.35 });
  noiseBurst(ctx, out, noise, { filter: "lowpass", freq: 380, dur: 0.18, gain: 0.3 });
};

const dodge: SoundRecipe = (ctx, out, { noise }) => {
  noiseBurst(ctx, out, noise, { filter: "bandpass", freq: 1400, freqEnd: 3200, q: 2, dur: 0.11, attack: 0.02, gain: 0.18 });
};

const chargeImpact: SoundRecipe = (ctx, out, { noise }) => {
  noiseBurst(ctx, out, noise, { filter: "lowpass", freq: 260, dur: 0.45, attack: 0.02, gain: 0.6 });
  tone(ctx, out, { type: "sine", freq: 90, freqEnd: 45, dur: 0.3, gain: 0.4 });
};

const bannerFlap: SoundRecipe = (ctx, out, { noise }) => {
  for (let i = 0; i < 4; i++) {
    noiseBurst(ctx, out, noise, { filter: "bandpass", freq: 450 + i * 40, q: 1.5, dur: 0.09, attack: 0.02, gain: 0.22, delay: i * 0.08 });
  }
};

const warCry: SoundRecipe = (ctx, out, { noise }) => {
  // Coro de vozes: várias "gargantas" desafinadas passando por um formante de "Ah!"
  const formant = ctx.createBiquadFilter();
  formant.type = "bandpass";
  formant.frequency.value = 750;
  formant.Q.value = 1.2;
  formant.connect(out);
  for (let i = 0; i < 7; i++) {
    const base = 150 + Math.random() * 110;
    tone(ctx, formant, { type: "sawtooth", freq: base, freqEnd: base * 0.82, dur: 1.1 + Math.random() * 0.3, attack: 0.08 + Math.random() * 0.1, gain: 0.12 });
  }
  noiseBurst(ctx, out, noise, { filter: "bandpass", freq: 900, q: 0.8, dur: 1.0, attack: 0.1, gain: 0.12 });
};

/** Toques de trombeta combinados: cada ordem tem uma melodia reconhecível. */
const TRUMPET_TUNES: Record<string, [number, number][]> = {
  Avançar: [[392, 0.13], [523, 0.13], [659, 0.13], [784, 0.38]],
  Alto: [[392, 0.9]],
  Carregar: [[392, 0.09], [392, 0.09], [392, 0.09], [523, 0.2], [392, 0.09], [392, 0.09], [392, 0.09], [523, 0.35]],
  Recuar: [[784, 0.2], [659, 0.2], [523, 0.2], [392, 0.55]],
  "Reunir ao estandarte": [[523, 0.22], [659, 0.22], [784, 0.5]],
};

const trumpetFor =
  (order: string): SoundRecipe =>
  (ctx, out) =>
    brass(ctx, out, TRUMPET_TUNES[order] ?? [[523, 0.3]], 0.22);

const messengerHorn: SoundRecipe = (ctx, out) => brass(ctx, out, [[659, 0.12], [784, 0.24]], 0.16, 3200);

const victory: SoundRecipe = (ctx, out) =>
  brass(ctx, out, [[523, 0.18], [659, 0.18], [784, 0.18], [1047, 0.7]], 0.22);

const defeat: SoundRecipe = (ctx, out) =>
  brass(ctx, out, [[392, 0.45], [311, 0.45], [262, 1.2]], 0.18, 1200);

const coin: SoundRecipe = (ctx, out, { pitch }) => {
  tone(ctx, out, { type: "sine", freq: 2100 * pitch, dur: 0.12, gain: 0.12 });
  tone(ctx, out, { type: "sine", freq: 2800 * pitch, dur: 0.16, gain: 0.1, delay: 0.06 });
};

const click: SoundRecipe = (ctx, out) => {
  tone(ctx, out, { type: "square", freq: 620, dur: 0.035, gain: 0.06 });
};

const footstepThud: SoundRecipe = (ctx, out, { noise }) => {
  noiseBurst(ctx, out, noise, { filter: "lowpass", freq: 220, dur: 0.07, gain: 0.25 });
};

// --- API do jogo ---

const jitter = () => 0.9 + Math.random() * 0.2;
type Pos = Pick<PlayOptions, "x" | "y">;

export const sfx = {
  clash: (p: Pos) => AudioEngine.play("clash", clash, { ...p, pitch: jitter(), volume: 0.55 }, 35, 6),
  swing: (p: Pos) => AudioEngine.play("swing", swing, { ...p, pitch: jitter() }, 60, 2),
  bowShot: (p: Pos) => AudioEngine.play("bow", bowShot, { ...p, pitch: jitter(), volume: 0.6 }, 40, 5),
  arrowHit: (p: Pos) => AudioEngine.play("arrowHit", arrowHit, { ...p, pitch: jitter(), volume: 0.5 }, 40, 5),
  death: (p: Pos) => AudioEngine.play("death", death, { ...p, pitch: jitter(), volume: 0.7 }, 60, 4),
  dodge: (p: Pos) => AudioEngine.play("dodge", dodge, { ...p }, 120, 2),
  charge: (p: Pos) => AudioEngine.play("charge", chargeImpact, { ...p }, 150, 2),
  banner: (p: Pos) => AudioEngine.play("banner", bannerFlap, { ...p }, 300, 1),
  warCry: (p: Pos) => AudioEngine.play("warCry", warCry, { ...p, volume: 0.9 }, 1000, 1),
  trumpet: (order: string, p: Pos) => AudioEngine.play(`trumpet:${order}`, trumpetFor(order), { ...p }, 400, 1),
  messengerHorn: (p: Pos) => AudioEngine.play("messengerHorn", messengerHorn, { ...p, volume: 0.8 }, 150, 2),
  victory: () => AudioEngine.play("victory", victory, {}, 2000, 1),
  defeat: () => AudioEngine.play("defeat", defeat, {}, 2000, 1),
  coin: (gain: boolean) => AudioEngine.play("coin", coin, { pitch: gain ? 1.15 : 0.85 }, 80, 2),
  click: () => AudioEngine.play("click", click, {}, 40, 2),
  thud: (p: Pos) => AudioEngine.play("thud", footstepThud, { ...p, volume: 0.6 }, 120, 1),
};

/** Fogueira do acampamento: chiado grave contínuo + estalos aleatórios. */
export function startCampfireAmbience(): void {
  AudioEngine.startLoop("campfire", (ctx, master, noise) => {
    const g = ctx.createGain();
    g.gain.value = 0.05;
    const src = ctx.createBufferSource();
    src.buffer = noise;
    src.loop = true;
    const f = ctx.createBiquadFilter();
    f.type = "lowpass";
    f.frequency.value = 500;
    src.connect(f).connect(g).connect(master);
    src.start();
    const timer = window.setInterval(() => {
      if (Math.random() < 0.55) {
        noiseBurst(ctx, master, noise, {
          filter: "highpass",
          freq: 1800 + Math.random() * 2500,
          dur: 0.02 + Math.random() * 0.04,
          gain: 0.06 + Math.random() * 0.1,
        });
      }
    }, 140);
    return () => {
      window.clearInterval(timer);
      src.stop();
    };
  });
}

export function stopCampfireAmbience(): void {
  AudioEngine.stopLoop("campfire");
}
