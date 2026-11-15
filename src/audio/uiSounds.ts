/**
 * Os sons da interface e a assinatura de cada lugar (S1): as receitas. Tudo é ruído filtrado e
 * osciladores; nenhum arquivo de áudio. Quem decide quando tocam é `uiRules.ts`.
 */
import { AudioEngine, type SoundRecipe } from "./AudioEngine";
import { bell, brass, drum, noiseBurst, tone } from "./synth";
import type { UiSound } from "./uiRules";

/** Uma nota que escorrega por vários pontos (o relincho, a gaivota): [segundo, Hz]. */
function glide(ctx: BaseAudioContext, out: AudioNode, type: OscillatorType, points: readonly (readonly [number, number])[], gain: number, delay = 0, vibrato = 0, filter = 0): void {
  const t = ctx.currentTime + delay;
  const end = points[points.length - 1][0];
  const o = ctx.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(points[0][1], t);
  for (const [at, hz] of points.slice(1)) o.frequency.linearRampToValueAtTime(hz, t + at);
  if (vibrato > 0) {
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 11;
    const depth = ctx.createGain();
    depth.gain.value = vibrato;
    lfo.connect(depth).connect(o.frequency);
    lfo.start(t);
    lfo.stop(t + end + 0.05);
  }
  const g = ctx.createGain();
  g.gain.value = 0.0001;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + Math.min(0.04, end * 0.2));
  g.gain.setValueAtTime(gain, t + end * 0.7);
  g.gain.exponentialRampToValueAtTime(0.0001, t + end);
  if (filter > 0) {
    const f = ctx.createBiquadFilter();
    f.type = "bandpass";
    f.frequency.value = filter;
    f.Q.value = 1.2;
    o.connect(f).connect(g).connect(out);
  } else o.connect(g).connect(out);
  o.start(t);
  o.stop(t + end + 0.05);
}

/** Batida em madeira: o corpo (nota curta que cai) e o estalo. */
function knock(ctx: BaseAudioContext, out: AudioNode, noise: AudioBuffer, freq: number, gain: number, delay = 0): void {
  tone(ctx, out, { type: "triangle", freq, freqEnd: freq * 0.78, dur: 0.05, attack: 0.002, gain: gain * 0.6, delay });
  noiseBurst(ctx, out, noise, { filter: "bandpass", freq: freq * 2.7, q: 4, dur: 0.028, attack: 0.002, gain, delay });
}

/** Uma moeda: duas notas agudas que tilintam. */
function ting(ctx: BaseAudioContext, out: AudioNode, freq: number, gain: number, delay = 0): void {
  tone(ctx, out, { type: "sine", freq, dur: 0.11, attack: 0.002, gain, delay });
  tone(ctx, out, { type: "sine", freq: freq * 1.49, dur: 0.14, attack: 0.002, gain: gain * 0.7, delay: delay + 0.012 });
}

interface UiDef {
  recipe: SoundRecipe;
  /** Quanto dura, em segundos. */
  seconds: number;
  /** Intervalo mínimo entre dois iguais (ms). */
  every: number;
  volume?: number;
}

const DEFS: Record<UiSound, UiDef> = {
  // --- Os botões ---
  click: {
    seconds: 0.06,
    every: 40,
    recipe: (ctx, out, { noise }) => {
      noiseBurst(ctx, out, noise, { filter: "bandpass", freq: 2300, q: 2, dur: 0.028, attack: 0.002, gain: 0.1 });
      tone(ctx, out, { type: "triangle", freq: 880, freqEnd: 700, dur: 0.04, attack: 0.002, gain: 0.05 });
    },
  },
  confirm: {
    seconds: 0.2,
    every: 60,
    recipe: (ctx, out, { noise }) => {
      noiseBurst(ctx, out, noise, { filter: "bandpass", freq: 2000, q: 2, dur: 0.025, attack: 0.002, gain: 0.08 });
      tone(ctx, out, { type: "triangle", freq: 523, dur: 0.07, attack: 0.004, gain: 0.09 });
      tone(ctx, out, { type: "triangle", freq: 784, dur: 0.12, attack: 0.004, gain: 0.09, delay: 0.065 });
    },
  },
  cancel: {
    seconds: 0.2,
    every: 60,
    recipe: (ctx, out, { noise }) => {
      noiseBurst(ctx, out, noise, { filter: "bandpass", freq: 1500, q: 2, dur: 0.025, attack: 0.002, gain: 0.07 });
      tone(ctx, out, { type: "triangle", freq: 523, dur: 0.07, attack: 0.004, gain: 0.08 });
      tone(ctx, out, { type: "triangle", freq: 392, dur: 0.12, attack: 0.004, gain: 0.08, delay: 0.065 });
    },
  },
  // "Não pode": duas batidas surdas
  deny: {
    seconds: 0.28,
    every: 150,
    recipe: (ctx, out, { noise }) => {
      for (const delay of [0, 0.11]) {
        tone(ctx, out, { type: "sine", freq: 150, freqEnd: 105, dur: 0.09, attack: 0.004, gain: 0.22, delay });
        noiseBurst(ctx, out, noise, { filter: "lowpass", freq: 320, dur: 0.06, attack: 0.004, gain: 0.14, delay });
      }
    },
  },

  // --- Os painéis, os livros e o mapa ---
  open: {
    seconds: 0.18,
    every: 80,
    recipe: (ctx, out, { noise }) => {
      noiseBurst(ctx, out, noise, { filter: "bandpass", freq: 500, freqEnd: 1300, q: 1, dur: 0.13, attack: 0.03, gain: 0.12 });
      tone(ctx, out, { type: "sine", freq: 330, freqEnd: 440, dur: 0.1, attack: 0.01, gain: 0.05 });
    },
  },
  close: {
    seconds: 0.16,
    every: 80,
    recipe: (ctx, out, { noise }) => {
      noiseBurst(ctx, out, noise, { filter: "bandpass", freq: 1100, freqEnd: 420, q: 1, dur: 0.11, attack: 0.02, gain: 0.1 });
      tone(ctx, out, { type: "sine", freq: 392, freqEnd: 294, dur: 0.09, attack: 0.01, gain: 0.045 });
    },
  },
  // A página do diário
  page: {
    seconds: 0.26,
    every: 120,
    recipe: (ctx, out, { noise }) => {
      noiseBurst(ctx, out, noise, { filter: "highpass", freq: 2400, freqEnd: 5200, dur: 0.17, attack: 0.06, gain: 0.09 });
      noiseBurst(ctx, out, noise, { filter: "bandpass", freq: 1800, q: 1.5, dur: 0.06, attack: 0.005, gain: 0.08, delay: 0.14 });
    },
  },
  // O mapa desenrola
  mapOpen: {
    seconds: 0.6,
    every: 300,
    recipe: (ctx, out, { noise }) => {
      noiseBurst(ctx, out, noise, { filter: "bandpass", freq: 900, freqEnd: 2700, q: 0.8, dur: 0.46, attack: 0.2, gain: 0.13 });
      for (let i = 0; i < 6; i++) {
        noiseBurst(ctx, out, noise, { filter: "highpass", freq: 3000 + Math.random() * 2500, dur: 0.02, attack: 0.002, gain: 0.05 + Math.random() * 0.04, delay: 0.05 + Math.random() * 0.36 });
      }
      tone(ctx, out, { type: "sine", freq: 130, freqEnd: 90, dur: 0.09, attack: 0.004, gain: 0.14, delay: 0.44 });
    },
  },
  mapClose: {
    seconds: 0.4,
    every: 300,
    recipe: (ctx, out, { noise }) => {
      noiseBurst(ctx, out, noise, { filter: "bandpass", freq: 2500, freqEnd: 800, q: 0.8, dur: 0.3, attack: 0.05, gain: 0.11 });
      knock(ctx, out, noise, 300, 0.12, 0.28);
    },
  },

  // --- O que se faz no acampamento ---
  // Construir: o martelo
  build: {
    seconds: 0.6,
    every: 400,
    recipe: (ctx, out, { noise }) => {
      [0, 0.17, 0.34].forEach((delay, i) => {
        knock(ctx, out, noise, 210 - i * 12, 0.3, delay);
        tone(ctx, out, { type: "sine", freq: 2900, dur: 0.035, attack: 0.002, gain: 0.035, delay });
      });
    },
  },
  // Recrutar: o tambor (o grito de quem chega é a voz, tocada junto)
  recruit: {
    seconds: 0.8,
    every: 600,
    recipe: (ctx, out, { noise }) => {
      [0, 0.09, 0.17, 0.24, 0.3].forEach((delay, i) => drum(ctx, out, noise, 170, 0.12 + i * 0.03, delay, 0.14));
      drum(ctx, out, noise, 120, 0.4, 0.42, 0.4);
    },
  },
  // Aceitar contrato: a pena e o selo
  contract: {
    seconds: 0.8,
    every: 600,
    recipe: (ctx, out, { noise }) => {
      [0, 0.09, 0.2, 0.3].forEach((delay, i) => {
        noiseBurst(ctx, out, noise, { filter: "bandpass", freq: 3200 + i * 350, freqEnd: 4300 - i * 200, q: 4, dur: 0.075, attack: 0.01, gain: 0.07, delay });
      });
      tone(ctx, out, { type: "sine", freq: 140, freqEnd: 80, dur: 0.15, attack: 0.004, gain: 0.3, delay: 0.5 });
      noiseBurst(ctx, out, noise, { filter: "lowpass", freq: 520, dur: 0.07, attack: 0.004, gain: 0.2, delay: 0.5 });
    },
  },
  // Pagar o soldo: muitas moedas
  wages: {
    seconds: 1,
    every: 800,
    recipe: (ctx, out) => {
      for (let i = 0; i < 11; i++) ting(ctx, out, 1900 + Math.random() * 1400, 0.045 + Math.random() * 0.03, i * 0.065 + Math.random() * 0.03);
    },
  },
  coinGain: { seconds: 0.2, every: 80, recipe: (ctx, out) => ting(ctx, out, 2400, 0.1) },
  coinLoss: { seconds: 0.2, every: 80, recipe: (ctx, out) => ting(ctx, out, 1800, 0.09) },
  // Ambição cumprida: a fanfarra grande, com sino
  ambition: {
    seconds: 2.2,
    every: 3000,
    recipe: (ctx, out, { noise }) => {
      brass(ctx, out, [[523, 0.12], [523, 0.12], [784, 0.3], [659, 0.12], [784, 0.12], [1047, 0.75]], 0.18);
      drum(ctx, out, noise, 110, 0.3, 0);
      drum(ctx, out, noise, 110, 0.35, 0.72);
      bell(ctx, out, 1047, 1.4, 0.07, 0.72);
    },
  },
  // Batalhão sobe de nível: quatro notas claras que sobem
  levelUp: {
    seconds: 0.9,
    every: 1500,
    recipe: (ctx, out) => {
      [523, 659, 784, 1047].forEach((freq, i) => tone(ctx, out, { type: "triangle", freq, dur: 0.16, attack: 0.005, gain: 0.11, delay: i * 0.085 }));
      bell(ctx, out, 2093, 0.6, 0.04, 0.34);
    },
  },

  // --- A assinatura de cada lugar ---
  // Ferraria: o martelo na bigorna
  anvil: {
    seconds: 0.8,
    every: 500,
    recipe: (ctx, out, { noise }) => {
      [0, 0.24].forEach((delay, i) => {
        const g = i === 0 ? 1 : 0.7;
        tone(ctx, out, { type: "sine", freq: 1960, dur: 0.5, attack: 0.002, gain: 0.09 * g, delay });
        tone(ctx, out, { type: "sine", freq: 2745, dur: 0.38, attack: 0.002, gain: 0.07 * g, delay });
        tone(ctx, out, { type: "sine", freq: 4120, dur: 0.24, attack: 0.002, gain: 0.05 * g, delay });
        tone(ctx, out, { type: "sine", freq: 5310, dur: 0.16, attack: 0.002, gain: 0.03 * g, delay });
        noiseBurst(ctx, out, noise, { filter: "bandpass", freq: 5000, q: 1, dur: 0.02, attack: 0.002, gain: 0.14 * g, delay });
      });
    },
  },
  // Taverna: canecas que batem e a conversa
  mugs: {
    seconds: 0.7,
    every: 500,
    recipe: (ctx, out, { noise }) => {
      knock(ctx, out, noise, 430, 0.2, 0);
      knock(ctx, out, noise, 490, 0.17, 0.13);
      noiseBurst(ctx, out, noise, { filter: "bandpass", freq: 420, q: 1, dur: 0.55, attack: 0.2, gain: 0.05 });
    },
  },
  templeBell: { seconds: 2, every: 800, recipe: (ctx, out) => bell(ctx, out, 392, 2.2, 0.15) },
  // Praça do mercado: o burburinho e uma moeda
  market: {
    seconds: 1,
    every: 600,
    recipe: (ctx, out, { noise }) => {
      for (let i = 0; i < 8; i++) {
        noiseBurst(ctx, out, noise, { filter: "bandpass", freq: 320 + Math.random() * 700, q: 1.6, dur: 0.11 + Math.random() * 0.1, attack: 0.03, gain: 0.05 + Math.random() * 0.03, delay: Math.random() * 0.75 });
      }
      ting(ctx, out, 2300, 0.04, 0.5);
    },
  },
  // Estábulo: o relincho e o bufo
  whinny: {
    seconds: 1.1,
    every: 800,
    recipe: (ctx, out, { noise }) => {
      glide(ctx, out, "sawtooth", [[0, 900], [0.12, 1400], [0.45, 1150], [0.8, 520]], 0.1, 0, 70, 1500);
      noiseBurst(ctx, out, noise, { filter: "lowpass", freq: 620, dur: 0.16, attack: 0.02, gain: 0.14, delay: 0.84 });
    },
  },
  // Intendência: os sacos que caem
  sacks: {
    seconds: 0.5,
    every: 500,
    recipe: (ctx, out, { noise }) => {
      for (const delay of [0, 0.21]) {
        noiseBurst(ctx, out, noise, { filter: "lowpass", freq: 260, dur: 0.15, attack: 0.006, gain: 0.32, delay });
        noiseBurst(ctx, out, noise, { filter: "bandpass", freq: 1500, q: 0.7, dur: 0.1, attack: 0.02, gain: 0.05, delay });
      }
    },
  },
  // Campo de treino: espadas de madeira
  woodSwords: {
    seconds: 0.5,
    every: 500,
    recipe: (ctx, out, { noise }) => {
      knock(ctx, out, noise, 760, 0.24, 0);
      knock(ctx, out, noise, 690, 0.2, 0.14);
      knock(ctx, out, noise, 820, 0.26, 0.33);
    },
  },
  // Tenda: a lona
  canvas: {
    seconds: 0.4,
    every: 500,
    recipe: (ctx, out, { noise }) => {
      [0, 0.1, 0.22].forEach((delay, i) => noiseBurst(ctx, out, noise, { filter: "bandpass", freq: 300 + i * 40, q: 1, dur: 0.12, attack: 0.03, gain: 0.18, delay }));
    },
  },
  // Cais: gaivotas e a água
  gulls: {
    seconds: 1,
    every: 800,
    recipe: (ctx, out, { noise }) => {
      [0, 0.3, 0.55].forEach((delay, i) => glide(ctx, out, "triangle", [[0, 1250 + i * 60], [0.07, 1750 + i * 60], [0.24, 1150]], 0.05, delay, 25));
      noiseBurst(ctx, out, noise, { filter: "lowpass", freq: 520, dur: 0.85, attack: 0.4, gain: 0.06 });
    },
  },
  // Paço: o passo que ecoa
  hall: {
    seconds: 0.8,
    every: 600,
    recipe: (ctx, out, { noise }) => {
      for (let i = 0; i < 4; i++) {
        const g = 0.5 ** i;
        tone(ctx, out, { type: "sine", freq: 180, freqEnd: 120, dur: 0.07, attack: 0.003, gain: 0.2 * g, delay: i * 0.16 });
        noiseBurst(ctx, out, noise, { filter: "bandpass", freq: 900, q: 1, dur: 0.035, attack: 0.003, gain: 0.15 * g, delay: i * 0.16 });
      }
    },
  },
  // Portão: a madeira pesada que range e bate
  gate: {
    seconds: 0.9,
    every: 600,
    recipe: (ctx, out, { noise }) => {
      noiseBurst(ctx, out, noise, { filter: "bandpass", freq: 300, freqEnd: 420, q: 7, dur: 0.45, attack: 0.1, gain: 0.3 });
      tone(ctx, out, { type: "sawtooth", freq: 92, freqEnd: 70, dur: 0.45, attack: 0.08, gain: 0.05 });
      tone(ctx, out, { type: "sine", freq: 80, freqEnd: 42, dur: 0.26, attack: 0.004, gain: 0.4, delay: 0.5 });
      noiseBurst(ctx, out, noise, { filter: "lowpass", freq: 220, dur: 0.12, attack: 0.004, gain: 0.3, delay: 0.5 });
    },
  },
  // Recrutamento e o acampamento da guarnição: o toque de caixa
  drumTap: {
    seconds: 0.6,
    every: 500,
    recipe: (ctx, out, { noise }) => {
      [0, 0.1, 0.2].forEach((delay) => drum(ctx, out, noise, 200, 0.16, delay, 0.12));
      drum(ctx, out, noise, 150, 0.3, 0.34, 0.24);
    },
  },
  // Casa dos Mercadores: o ábaco e o livro que fecha
  ledger: {
    seconds: 0.6,
    every: 500,
    recipe: (ctx, out, { noise }) => {
      [0, 0.07, 0.13, 0.22].forEach((delay, i) => tone(ctx, out, { type: "triangle", freq: 1500 + i * 90, dur: 0.025, attack: 0.002, gain: 0.07, delay }));
      noiseBurst(ctx, out, noise, { filter: "lowpass", freq: 400, dur: 0.1, attack: 0.004, gain: 0.25, delay: 0.36 });
    },
  },
  // O mascate: os guizos
  jingle: {
    seconds: 0.6,
    every: 500,
    recipe: (ctx, out) => {
      [2637, 3136, 2794, 3520].forEach((freq, i) => tone(ctx, out, { type: "sine", freq, dur: 0.16, attack: 0.002, gain: 0.05, delay: i * 0.08 }));
    },
  },
  // Suprimentos: a carroça que range
  wagon: {
    seconds: 0.6,
    every: 500,
    recipe: (ctx, out, { noise }) => {
      noiseBurst(ctx, out, noise, { filter: "bandpass", freq: 720, freqEnd: 520, q: 8, dur: 0.3, attack: 0.06, gain: 0.26 });
      knock(ctx, out, noise, 160, 0.22, 0.34);
    },
  },
  // Ponte e balsa: a água
  water: {
    seconds: 0.9,
    every: 600,
    recipe: (ctx, out, { noise }) => {
      noiseBurst(ctx, out, noise, { filter: "lowpass", freq: 700, dur: 0.5, attack: 0.2, gain: 0.1 });
      noiseBurst(ctx, out, noise, { filter: "bandpass", freq: 1100, q: 0.8, dur: 0.4, attack: 0.15, gain: 0.05, delay: 0.35 });
    },
  },
  // Porta de casa: a batida e o rangido
  door: {
    seconds: 0.4,
    every: 400,
    recipe: (ctx, out, { noise }) => {
      knock(ctx, out, noise, 170, 0.22, 0);
      noiseBurst(ctx, out, noise, { filter: "bandpass", freq: 520, freqEnd: 800, q: 6, dur: 0.2, attack: 0.05, gain: 0.16, delay: 0.06 });
    },
  },
};

/**
 * O volume de cada um, medido com o som renderizado fora do tempo real: o ruído filtrado sai
 * muito mais baixo que a nota pura, e sem isto o clique sumia e o portão estourava. Os botões
 * ficam com pico perto de 0,15, os lugares perto de 0,25 e as fanfarras perto de 0,45.
 */
const LEVEL: Partial<Record<UiSound, number>> = {
  click: 2,
  confirm: 1.8,
  cancel: 1.8,
  open: 3,
  close: 2.5,
  page: 1.5,
  mapOpen: 2,
  mapClose: 2,
  build: 1.6,
  wages: 2.5,
  coinGain: 1.5,
  coinLoss: 1.5,
  levelUp: 2.2,
  anvil: 1.4,
  mugs: 2,
  market: 4.5,
  whinny: 4,
  sacks: 2.5,
  woodSwords: 1.4,
  canvas: 4,
  gulls: 3.5,
  hall: 1.3,
  gate: 0.8,
  ledger: 3,
  jingle: 4,
  wagon: 2.2,
  water: 4.5,
  door: 2.5,
};
for (const [name, level] of Object.entries(LEVEL)) DEFS[name as UiSound].volume = level;

/** Todos os sons de interface, com a receita e a duração (o inventário e os testes leem daqui). */
export const UI_SOUNDS: Readonly<Record<UiSound, UiDef>> = DEFS;

/** Toca um som de interface. `delay` (s) atrasa o começo: a fanfarra que espera a outra acabar. */
export function playUi(name: UiSound, delay = 0): boolean {
  const def = DEFS[name];
  if (delay > 0) {
    window.setTimeout(() => playUi(name), delay * 1000);
    return true;
  }
  return AudioEngine.play(`ui:${name}`, def.recipe, { bus: "ui", seconds: def.seconds, volume: def.volume ?? 1 }, def.every, 2);
}
