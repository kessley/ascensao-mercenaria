/**
 * Os sons contínuos do campo (S1): o rugido da linha, que cresce com quanta gente luta perto da
 * câmera; os cascos da cavalaria em movimento; e a coluna em marcha, que soa conforme o chão
 * (grama, lama, neve, pedra, ponte). A cena conta quem se ouve (`census`, em `hitRules.ts`) e
 * entrega aqui algumas vezes por segundo.
 */
import { AudioEngine } from "./AudioEngine";
import { hoovesLevel, marchLevel, roarLevel, type Census, type Ground } from "./hitRules";
import { noiseBurst, tone } from "./synth";

const state = {
  roar: 0,
  hooves: 0,
  gallop: 0,
  march: 0,
  ground: "grass" as Ground,
};

/** De que lado vem cada som (os nós só existem com o áudio liberado). */
const panners: { roar: StereoPannerNode | null; hooves: StereoPannerNode | null; march: StereoPannerNode | null } = { roar: null, hooves: null, march: null };

function pan(node: StereoPannerNode | null, x: number, y: number): void {
  if (!node) return;
  node.pan.setTargetAtTime(AudioEngine.panOf(x, y), node.context.currentTime, 0.25);
}

/** Um pé (ou cem) no chão: cada chão responde de um jeito. */
export function stepSound(ctx: BaseAudioContext, out: AudioNode, noise: AudioBuffer, ground: Ground, gain: number, delay = 0): void {
  switch (ground) {
    case "grass":
      noiseBurst(ctx, out, noise, { filter: "lowpass", freq: 900, dur: 0.13, attack: 0.02, gain: gain * 0.35, delay });
      break;
    case "mud":
      noiseBurst(ctx, out, noise, { filter: "bandpass", freq: 420, freqEnd: 200, q: 1.5, dur: 0.18, attack: 0.02, gain: gain * 0.7, delay });
      noiseBurst(ctx, out, noise, { filter: "lowpass", freq: 200, dur: 0.08, attack: 0.01, gain: gain * 0.45, delay });
      break;
    case "snow":
      noiseBurst(ctx, out, noise, { filter: "highpass", freq: 2600, dur: 0.1, attack: 0.01, gain: gain * 0.2, delay });
      noiseBurst(ctx, out, noise, { filter: "bandpass", freq: 1300, q: 1, dur: 0.08, attack: 0.01, gain: gain * 0.2, delay });
      break;
    case "stone":
      noiseBurst(ctx, out, noise, { filter: "bandpass", freq: 1900, q: 2, dur: 0.04, attack: 0.003, gain: gain * 0.4, delay });
      noiseBurst(ctx, out, noise, { filter: "lowpass", freq: 300, dur: 0.05, attack: 0.003, gain: gain * 0.3, delay });
      break;
    case "bridge":
      tone(ctx, out, { type: "triangle", freq: 150, freqEnd: 110, dur: 0.09, attack: 0.004, gain: gain * 0.3, delay });
      noiseBurst(ctx, out, noise, { filter: "bandpass", freq: 240, q: 4, dur: 0.13, attack: 0.004, gain: gain * 0.5, delay });
      break;
  }
}

/** Um casco no chão: o baque e o estalo (mais claro na pedra e na ponte). */
export function hoofSound(ctx: BaseAudioContext, out: AudioNode, noise: AudioBuffer, ground: Ground, gain: number, delay = 0): void {
  const hard = ground === "stone" || ground === "bridge";
  noiseBurst(ctx, out, noise, { filter: "lowpass", freq: 200 + Math.random() * 110, dur: 0.05, attack: 0.003, gain: gain * 0.5, delay });
  noiseBurst(ctx, out, noise, { filter: "bandpass", freq: hard ? 1800 : 900, q: 2, dur: 0.02, attack: 0.002, gain: gain * (hard ? 0.3 : 0.12), delay });
}

/** O rugido da linha: muita garganta junta, o chão que treme e o ferro que não para. */
function startRoar(): void {
  AudioEngine.startLoop(
    "linha",
    (ctx, out, noise) => {
      const p = ctx.createStereoPanner();
      p.connect(out);
      panners.roar = p;
      const src = ctx.createBufferSource();
      src.buffer = noise;
      src.loop = true;
      const band = (type: BiquadFilterType, freq: number, q: number, gain: number): GainNode => {
        const f = ctx.createBiquadFilter();
        f.type = type;
        f.frequency.value = freq;
        f.Q.value = q;
        const g = ctx.createGain();
        g.gain.value = gain;
        src.connect(f).connect(g).connect(p);
        return g;
      };
      const crowd = band("bandpass", 620, 0.7, 0.55);
      band("bandpass", 1400, 1.2, 0.22);
      band("lowpass", 150, 0.7, 0.6);
      const metal = band("bandpass", 3600, 2, 0.07);
      // A gritaria sobe e desce devagar; o ferro treme depressa
      const swell = ctx.createOscillator();
      swell.frequency.value = 0.27;
      const swellDepth = ctx.createGain();
      swellDepth.gain.value = 0.16;
      swell.connect(swellDepth).connect(crowd.gain);
      const shake = ctx.createOscillator();
      shake.frequency.value = 9;
      const shakeDepth = ctx.createGain();
      shakeDepth.gain.value = 0.05;
      shake.connect(shakeDepth).connect(metal.gain);
      src.start();
      swell.start();
      shake.start();
      return () => {
        src.stop();
        swell.stop();
        shake.stop();
        p.disconnect();
        panners.roar = null;
      };
    },
    "combat",
  );
  AudioEngine.setLoopVolume("linha", 0);
}

/** Os cascos: quanto mais cavalo e mais galope, mais batidas por segundo. */
function startHooves(): void {
  AudioEngine.startLoop(
    "cascos",
    (ctx, out, noise) => {
      const p = ctx.createStereoPanner();
      p.connect(out);
      panners.hooves = p;
      const timer = window.setInterval(() => {
        if (state.hooves <= 0 || ctx.state !== "running") return;
        const perSecond = (4 + state.hooves * 18) * (0.6 + state.gallop * 0.6);
        if (Math.random() >= perSecond * 0.04) return;
        const gain = (0.3 + state.hooves * 0.5) * (0.6 + Math.random() * 0.4);
        hoofSound(ctx, p, noise, state.ground, gain);
        // O galope é em três tempos: outro casco logo atrás
        if (state.gallop > 0.4) hoofSound(ctx, p, noise, state.ground, gain * 0.8, 0.07);
      }, 40);
      return () => {
        window.clearInterval(timer);
        p.disconnect();
        panners.hooves = null;
      };
    },
    "combat",
  );
}

/** A coluna em marcha: o passo cadenciado de muitos pés, um pouco fora de tempo uns dos outros. */
function startMarch(): void {
  AudioEngine.startLoop(
    "marcha",
    (ctx, out, noise) => {
      const p = ctx.createStereoPanner();
      p.connect(out);
      panners.march = p;
      let next = 0;
      const timer = window.setInterval(() => {
        if (state.march <= 0 || ctx.state !== "running") return;
        const now = performance.now();
        if (now < next) return;
        next = now + 470;
        const gain = 0.25 + state.march * 0.6;
        const feet = 1 + Math.round(state.march * 3);
        for (let i = 0; i < feet; i++) stepSound(ctx, p, noise, state.ground, gain * (0.7 + Math.random() * 0.3), Math.random() * 0.06);
      }, 50);
      return () => {
        window.clearInterval(timer);
        p.disconnect();
        panners.march = null;
      };
    },
    "combat",
  );
}

const EMPTY: Census = { fighting: { n: 0, x: 0, y: 0 }, hooves: { n: 0, x: 0, y: 0 }, marching: { n: 0, x: 0, y: 0 }, gallop: 0 };

export const fieldSound = {
  /** Liga os três sons (em silêncio, até a cena contar alguém). */
  start(): void {
    startRoar();
    startHooves();
    startMarch();
  },

  /** O que se ouve agora: quem luta, quem cavalga e quem marcha, e em que chão. */
  update(c: Census, ground: Ground): void {
    state.roar = roarLevel(c.fighting.n);
    state.hooves = hoovesLevel(c.hooves.n);
    state.gallop = c.gallop;
    state.march = marchLevel(c.marching.n);
    state.ground = ground;
    // O rugido não cresce em linha reta: uma escaramuça é quase nada, a batalha cheia enche o ouvido
    AudioEngine.setLoopVolume("linha", state.roar ** 1.3 * 0.5);
    if (c.fighting.n > 0) pan(panners.roar, c.fighting.x, c.fighting.y);
    if (c.hooves.n > 0) pan(panners.hooves, c.hooves.x, c.hooves.y);
    if (c.marching.n > 0) pan(panners.march, c.marching.x, c.marching.y);
  },

  /** Ninguém se mexe (pausa tática, a cena dormindo): os três se calam. */
  quiet(): void {
    this.update(EMPTY, state.ground);
  },

  stop(): void {
    this.quiet();
    for (const name of ["linha", "cascos", "marcha"]) AudioEngine.stopLoop(name);
  },

  /** Como está agora (os testes leem daqui). */
  levels(): Readonly<typeof state> {
    return state;
  },
};
