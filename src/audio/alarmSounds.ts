/**
 * Os sons dos alarmes e dos sinais (S1): as receitas. Cada perigo tem um som que se reconhece de
 * olhos fechados: a corneta do acampamento, o sino da aldeia, o tambor do herói, as trombetas da
 * guerra, o sino fundo da calamidade. Tudo feito no código (osciladores e ruído), nada copiado.
 * Quem decide quando tocam é `alarmRules.ts`.
 */
import type { SoundRecipe } from "./AudioEngine";
import type { AlarmKind } from "./alarmRules";
import { bell, brass, drum, noiseBurst, tone } from "./synth";

/** A corneta de chifre: grave, redonda, com o eco do vale atrás. */
function hornCall(ctx: BaseAudioContext, out: AudioNode, delay: number, gain: number): void {
  const call: [number, number][] = [
    [196, 0.26],
    [196, 0.26],
    [294, 0.78],
  ];
  brass(ctx, out, call, gain, 1300, delay);
  brass(ctx, out, call, gain * 0.28, 800, delay + 0.32);
}

/** O metal da lâmina que sai da bainha: o chiado e o anel. */
function bladeDrawn(ctx: BaseAudioContext, out: AudioNode, noise: AudioBuffer, gain: number, delay: number, pitch = 1): void {
  noiseBurst(ctx, out, noise, { filter: "highpass", freq: 2600 * pitch, freqEnd: 6500 * pitch, dur: 0.34, attack: 0.08, gain: gain * 0.5, delay });
  for (const [mult, amp] of [
    [1, 1],
    [1.51, 0.6],
    [2.09, 0.35],
  ] as const) {
    tone(ctx, out, { type: "sine", freq: 2050 * pitch * mult, dur: 0.7, attack: 0.004, gain: gain * 0.22 * amp, delay: delay + 0.3 });
  }
}

/** O rangido do eixo da carroça. */
function creak(ctx: BaseAudioContext, out: AudioNode, gain: number, delay: number): void {
  const t = ctx.currentTime + delay;
  const o = ctx.createOscillator();
  o.type = "sawtooth";
  o.frequency.setValueAtTime(150, t);
  o.frequency.linearRampToValueAtTime(230, t + 0.14);
  o.frequency.linearRampToValueAtTime(170, t + 0.32);
  const f = ctx.createBiquadFilter();
  f.type = "bandpass";
  f.frequency.value = 1100;
  f.Q.value = 3;
  const g = ctx.createGain();
  g.gain.value = 0.0001;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + 0.05);
  g.gain.setValueAtTime(gain, t + 0.24);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.34);
  o.connect(f).connect(g).connect(out);
  o.start(t);
  o.stop(t + 0.38);
}

/** O assobio de quem vem a cavalo: sobe, e no fim sobe mais. */
function whistle(ctx: BaseAudioContext, out: AudioNode, from: number, to: number, dur: number, gain: number, delay: number): void {
  const t = ctx.currentTime + delay;
  const o = ctx.createOscillator();
  o.type = "sine";
  o.frequency.setValueAtTime(from, t);
  o.frequency.exponentialRampToValueAtTime(to, t + dur * 0.8);
  const lfo = ctx.createOscillator();
  lfo.frequency.value = 7;
  const depth = ctx.createGain();
  depth.gain.value = 25;
  lfo.connect(depth).connect(o.frequency);
  const g = ctx.createGain();
  g.gain.value = 0.0001;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + 0.03);
  g.gain.setValueAtTime(gain, t + dur * 0.75);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(out);
  o.start(t);
  lfo.start(t);
  o.stop(t + dur + 0.05);
  lfo.stop(t + dur + 0.05);
}

/**
 * O resmungo de muita gente: cada um numa nota, com as sílabas soltas de quem reclama baixo.
 * Abafado, como conversa atrás da lona.
 */
function murmur(ctx: BaseAudioContext, out: AudioNode, gain: number, seconds: number): void {
  const t0 = ctx.currentTime;
  const muffle = ctx.createBiquadFilter();
  muffle.type = "lowpass";
  muffle.frequency.value = 1500;
  muffle.connect(out);
  const voices = [98, 112, 124, 139, 106];
  voices.forEach((f0, v) => {
    const o = ctx.createOscillator();
    o.type = "sawtooth";
    o.frequency.setValueAtTime(f0, t0);
    const formant = ctx.createBiquadFilter();
    formant.type = "bandpass";
    formant.Q.value = 2.5;
    formant.frequency.setValueAtTime(600, t0);
    const g = ctx.createGain();
    g.gain.value = 0.0001;
    g.gain.setValueAtTime(0.0001, t0);
    // Sílabas: cada voz começa num tempo, fala umas tantas e para
    let t = t0 + 0.05 + v * 0.17;
    while (t < t0 + seconds - 0.35) {
      const syl = 0.1 + ((v * 7 + Math.floor(t * 31)) % 5) * 0.025;
      const vowel = [420, 650, 820, 560, 380][Math.floor(t * 13 + v) % 5];
      formant.frequency.linearRampToValueAtTime(vowel, t + syl * 0.5);
      o.frequency.linearRampToValueAtTime(f0 * (0.94 + ((v + Math.floor(t * 17)) % 4) * 0.03), t + syl);
      g.gain.linearRampToValueAtTime(gain, t + syl * 0.3);
      g.gain.linearRampToValueAtTime(gain * 0.25, t + syl);
      t += syl + (((v * 3 + Math.floor(t * 23)) % 4) * 0.05 + 0.03);
    }
    g.gain.linearRampToValueAtTime(0.0001, t0 + seconds - 0.2);
    o.connect(formant).connect(g).connect(muffle);
    o.start(t0);
    o.stop(t0 + seconds);
  });
}

/** O ronco do chão que acompanha o sino da calamidade. */
function rumble(ctx: BaseAudioContext, out: AudioNode, noise: AudioBuffer, gain: number, seconds: number): void {
  const t = ctx.currentTime;
  const src = ctx.createBufferSource();
  src.buffer = noise;
  src.loop = true;
  const f = ctx.createBiquadFilter();
  f.type = "lowpass";
  f.frequency.value = 90;
  const g = ctx.createGain();
  g.gain.value = 0.0001;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(gain, t + 1.4);
  g.gain.linearRampToValueAtTime(gain * 0.6, t + seconds * 0.6);
  g.gain.linearRampToValueAtTime(0.0001, t + seconds);
  src.connect(f).connect(g).connect(out);
  src.start(t);
  src.stop(t + seconds + 0.05);
}

export interface AlarmSound {
  recipe: SoundRecipe;
  /** Quanto dura, em segundos (é o tempo em que ele abaixa os outros canais). */
  seconds: number;
  volume: number;
}

const DEFS: Record<AlarmKind, { recipe: SoundRecipe; seconds: number }> = {
  // A corneta de três notas, duas vezes: "às armas, às armas"
  camp: {
    seconds: 2.9,
    recipe: (ctx, out) => {
      hornCall(ctx, out, 0, 0.24);
      hornCall(ctx, out, 1.45, 0.24);
    },
  },
  // O sino pequeno da aldeia, tocado depressa, em dois tons
  village: {
    seconds: 3.1,
    recipe: (ctx, out) => {
      for (let i = 0; i < 5; i++) bell(ctx, out, i % 2 === 0 ? 660 : 587, 1.4, 0.12, i * 0.42);
    },
  },
  // O tambor grave: três batidas, duas rápidas e a última, maior
  hero: {
    seconds: 2.6,
    recipe: (ctx, out, { noise }) => {
      for (const at of [0, 0.5, 1.0]) drum(ctx, out, noise, 64, 0.5, at, 0.55);
      drum(ctx, out, noise, 70, 0.32, 1.36, 0.3);
      drum(ctx, out, noise, 70, 0.32, 1.52, 0.3);
      drum(ctx, out, noise, 52, 0.62, 1.76, 0.8);
    },
  },
  // Duas lâminas saem da bainha, e uma batida chama o anel
  duel: {
    seconds: 1.7,
    recipe: (ctx, out, { noise }) => {
      bladeDrawn(ctx, out, noise, 0.5, 0);
      bladeDrawn(ctx, out, noise, 0.45, 0.38, 0.86);
      drum(ctx, out, noise, 80, 0.4, 0.95, 0.5);
    },
  },
  // O eixo que range e a corneta curta, que desce: "pegaram as carroças"
  convoy: {
    seconds: 1.5,
    recipe: (ctx, out) => {
      creak(ctx, out, 0.12, 0);
      creak(ctx, out, 0.1, 0.3);
      brass(ctx, out, [
        [330, 0.2],
        [247, 0.55],
      ], 0.2, 1500, 0.62);
    },
  },
  // O trote que chega e o assobio de quem traz notícia
  scout: {
    seconds: 1.3,
    recipe: (ctx, out, { noise }) => {
      for (let i = 0; i < 4; i++) {
        noiseBurst(ctx, out, noise, { filter: "lowpass", freq: 260, dur: 0.05, attack: 0.003, gain: 0.32, delay: i * 0.13 });
        noiseBurst(ctx, out, noise, { filter: "bandpass", freq: 1100, q: 2, dur: 0.02, attack: 0.002, gain: 0.1, delay: i * 0.13 });
      }
      whistle(ctx, out, 1500, 2100, 0.2, 0.13, 0.5);
      whistle(ctx, out, 1500, 2400, 0.34, 0.13, 0.82);
    },
  },
  // A corneta de posta, clara e curta
  messenger: {
    seconds: 0.6,
    recipe: (ctx, out) =>
      brass(ctx, out, [
        [587, 0.1],
        [880, 0.1],
        [880, 0.24],
      ], 0.16, 3400),
  },
  // O resmungo das rodinhas: o soldo não veio
  wages: {
    seconds: 2.6,
    recipe: (ctx, out) => murmur(ctx, out, 0.1, 2.6),
  },
  // As trombetas, em duas vozes, e o tímpano: um reino declarou guerra a outro
  war: {
    seconds: 2.6,
    recipe: (ctx, out, { noise }) => {
      const high: [number, number][] = [
        [392, 0.15],
        [392, 0.15],
        [392, 0.15],
        [523, 0.5],
        [466, 0.2],
        [523, 0.95],
      ];
      brass(ctx, out, high, 0.17, 2600);
      brass(ctx, out, high.map(([f, d]) => [f * 0.667, d] as [number, number]), 0.12, 1800);
      drum(ctx, out, noise, 90, 0.4, 0, 0.4);
      drum(ctx, out, noise, 90, 0.45, 1.05, 0.6);
    },
  },
  // O sino fundo, duas vezes, e o chão que ronca: alguma coisa acordou
  calamity: {
    seconds: 6,
    recipe: (ctx, out, { noise }) => {
      bell(ctx, out, 73, 5.5, 0.24);
      bell(ctx, out, 73, 4, 0.2, 2.3);
      tone(ctx, out, { type: "sine", freq: 103, dur: 4.5, attack: 0.6, gain: 0.05, delay: 0.2 });
      rumble(ctx, out, noise, 0.32, 6);
    },
  },
};

/**
 * O volume de cada um, medido fora do tempo real: sem isto, o sino da aldeia sairia num sussurro e
 * as trombetas, aos gritos. O perigo soa um pouco acima da notícia.
 */
const LEVEL: Record<AlarmKind, number> = {
  camp: 1.15,
  village: 1.8,
  // O tambor é grave: a mesma energia soa mais baixa, então ele fica com um pouco mais que a conta
  hero: 0.8,
  duel: 0.85,
  convoy: 1.2,
  scout: 1.15,
  messenger: 1.1,
  wages: 2.5,
  war: 0.9,
  calamity: 1.05,
};

/** Todos os sons de alarme, com a receita, a duração e o volume (o inventário e os testes leem daqui). */
export const ALARM_SOUNDS: Readonly<Record<AlarmKind, AlarmSound>> = Object.fromEntries(
  (Object.keys(DEFS) as AlarmKind[]).map((k) => [k, { ...DEFS[k], volume: LEVEL[k] }]),
) as Record<AlarmKind, AlarmSound>;
