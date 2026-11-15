/**
 * A voz (S1): transforma uma fala de `speech.ts` em som. É um sintetizador de formantes simples:
 * uma fonte (a corda vocal: dente-de-serra, ou só ar para o sussurro) passa por três filtros que
 * fazem a vogal, e cada consoante é um estalo ou um chiado de ruído. Não há gravação nenhuma.
 */
import { AudioEngine, type SoundRecipe } from "./AudioEngine";
import { Chatter, FORMANTS, utter, type Bark, type Species, type Timbre, type Utterance } from "./speech";
import { noiseBurst } from "./synth";
import type { TongueId } from "../game/worldgen/names";

/** A boca fechada no "m" e no "n". */
const NASAL: readonly [number, number, number] = [250, 1150, 2300];
const FORMANT_Q = [6, 10, 12];
const FORMANT_GAIN = [1, 0.7, 0.32];
/** O filtro tira muita energia da fonte: isto devolve o volume. */
const MAKE_UP = 1.5;

const ATTACK: Record<string, number> = { none: 0.02, plosive: 0.008, fricative: 0.03, nasal: 0.025, liquid: 0.045 };

/** Uma garganta dizendo a fala. */
function voiceOne(ctx: BaseAudioContext, out: AudioNode, noise: AudioBuffer, u: Utterance, detune: number, delay: number, level: number): void {
  const T = u.timbre;
  const t0 = ctx.currentTime + delay + 0.01;
  const end = t0 + u.seconds + 0.1;

  const mix = ctx.createGain();
  mix.gain.value = level * MAKE_UP * (T.level ?? 1);
  mix.connect(out);

  // A fonte entra aqui, e a amplitude de cada sílaba é desenhada neste ganho
  const excite = ctx.createGain();
  excite.gain.value = 0;
  const formants = [0, 1, 2].map((i) => {
    const f = ctx.createBiquadFilter();
    f.type = "bandpass";
    f.Q.value = FORMANT_Q[i];
    const g = ctx.createGain();
    g.gain.value = FORMANT_GAIN[i];
    excite.connect(f).connect(g).connect(mix);
    return f;
  });

  let osc: OscillatorNode | null = null;
  if (!T.whisper) {
    osc = ctx.createOscillator();
    osc.type = "sawtooth";
    const tilt = ctx.createBiquadFilter();
    tilt.type = "lowpass";
    tilt.frequency.value = 2600 * T.formant;
    tilt.Q.value = 0.5;
    const voiced = ctx.createGain();
    voiced.gain.value = 1 - Math.max(T.breath, u.breath) * 0.5;
    osc.connect(tilt).connect(voiced).connect(excite);
    if (T.rough > 0) {
      // O rosnado: a voz treme de volume, rápido
      const growl = ctx.createOscillator();
      growl.type = "triangle";
      growl.frequency.value = 36 + T.rough * 34;
      const depth = ctx.createGain();
      depth.gain.value = T.rough * 0.6;
      growl.connect(depth).connect(voiced.gain);
      growl.start(t0);
      growl.stop(end);
    }
    if (u.tremor > 0) {
      // O medo: a nota treme
      const vib = ctx.createOscillator();
      vib.frequency.value = 7.5;
      const depth = ctx.createGain();
      depth.gain.value = u.tremor * T.pitch * 2;
      vib.connect(depth).connect(osc.frequency);
      vib.start(t0);
      vib.stop(end);
    }
    osc.start(t0);
    osc.stop(end);
  }

  // O ar: pouco na voz comum, muito na cansada, tudo no sussurro
  const air = ctx.createBufferSource();
  air.buffer = noise;
  air.loop = true;
  const airGain = ctx.createGain();
  airGain.gain.value = T.whisper ? 1.4 : 0.05 + Math.max(T.breath, u.breath) * 0.5;
  air.connect(airGain).connect(excite);
  air.start(t0, Math.random() * 1.5);
  air.stop(end);

  const legato = (p: Utterance["phones"][number] | undefined): boolean => !!p && (p.onset === "none" || p.onset === "liquid" || p.onset === "nasal");
  /** Onde cada filtro ficou no fim da sílaba anterior: a boca vai de uma vogal à outra, não pula. */
  const mouth: number[] = [];

  u.phones.forEach((p, i) => {
    const a = t0 + p.at;
    const e = a + p.dur;
    const first = i === 0;
    const next = u.phones[i + 1];

    if (osc) {
      osc.frequency.setValueAtTime(p.f0 * detune, a);
      osc.frequency.linearRampToValueAtTime(p.f0Mid * detune, a + p.dur * 0.5);
      osc.frequency.linearRampToValueAtTime(p.f0End * detune, e);
    }

    // A vogal: os três filtros vão para o lugar dela; "m" e "n" começam ou acabam de boca fechada
    const vowel = FORMANTS[p.vowel];
    formants.forEach((f, k) => {
      const open = vowel[k] * T.formant;
      const lead = p.onset === "nasal" ? NASAL[k] * T.formant : open;
      if (first) f.frequency.setValueAtTime(lead, t0);
      else {
        f.frequency.setValueAtTime(mouth[k], a - 0.015);
        f.frequency.linearRampToValueAtTime(lead, a + 0.02);
      }
      if (p.onset === "nasal") {
        f.frequency.setValueAtTime(lead, a + p.dur * 0.12);
        f.frequency.linearRampToValueAtTime(open, a + p.dur * 0.34);
      }
      let at = open;
      if (p.glide) {
        at = FORMANTS[p.glide][k] * T.formant;
        f.frequency.setValueAtTime(open, a + p.dur * 0.4);
        f.frequency.linearRampToValueAtTime(at, a + p.dur * 0.8);
      }
      if (p.coda === "nasal") {
        f.frequency.setValueAtTime(at, a + p.dur * 0.82);
        at = NASAL[k] * T.formant;
        f.frequency.linearRampToValueAtTime(at, e - 0.016);
      }
      mouth[k] = at;
    });

    // A amplitude: como a sílaba abre e como fecha
    const offset = Math.min(p.onset === "plosive" ? 0.025 : p.onset === "fricative" ? 0.04 : 0, p.dur * 0.25);
    const attack = Math.min(ATTACK[p.onset], p.dur * 0.3);
    const release = Math.min(p.coda === "plosive" ? 0.02 : 0.05, p.dur * 0.3);
    const start = a + offset;
    // Entre duas sílabas ligadas a voz não se cala; antes de um estalo ou de um chiado, cala
    const from = !first && legato(p) && u.phones[i - 1].coda !== "plosive" ? p.gain * 0.35 : 0.0001;
    const to = legato(next) && p.coda !== "plosive" ? next.gain * 0.35 : 0.0001;
    excite.gain.setValueAtTime(from, start);
    excite.gain.linearRampToValueAtTime(p.gain, start + attack);
    excite.gain.setValueAtTime(p.gain, e - release);
    excite.gain.linearRampToValueAtTime(to, e);

    // A consoante: estalo ou chiado, por fora dos filtros da vogal
    const when = (t: number) => Math.max(0, t - ctx.currentTime);
    if (p.onset === "fricative") {
      noiseBurst(ctx, mix, noise, { filter: "highpass", freq: (p.sharp ? 4200 : 1700) * Math.min(1.2, T.formant), dur: 0.06, attack: 0.015, gain: 0.07 * p.gain, delay: when(a) });
    } else if (p.onset === "plosive") {
      noiseBurst(ctx, mix, noise, { filter: "bandpass", freq: 1600 * T.formant, q: 1, dur: 0.022, attack: 0.002, gain: 0.08 * p.gain, delay: when(start - 0.006) });
    }
    if (p.coda === "fricative") {
      noiseBurst(ctx, mix, noise, { filter: "highpass", freq: 3800 * Math.min(1.2, T.formant), dur: 0.07, attack: 0.02, gain: 0.06 * p.gain, delay: when(e - 0.03) });
    }
  });
}

/** A receita de uma fala: uma garganta, ou várias juntas (o grito de muitos). */
export function speakRecipe(u: Utterance): SoundRecipe {
  return (ctx, out, { noise, pitch }) => {
    const n = Math.max(1, u.voices);
    const level = 1 / Math.sqrt(n);
    for (let i = 0; i < n; i++) {
      // No coro, cada um entra num instante e numa nota um pouco diferente
      const spread = n === 1 ? 1 : 0.9 + (i / (n - 1)) * 0.22 + (Math.random() - 0.5) * 0.03;
      voiceOne(ctx, out, noise, u, pitch * spread, n === 1 ? 0 : Math.random() * 0.07, level);
    }
  };
}

/** Quem fala: a chave (para não repetir), a língua, a garganta e a voz. */
export interface Speaker {
  key: string;
  tongue: TongueId;
  species: Species;
  timbre: Timbre;
}

const chatter = new Chatter();

export interface SayOptions {
  volume?: number;
  /** Ouve-se mesmo de longe, com pelo menos este volume (a tropa selecionada fora da tela). */
  floor?: number;
}

/**
 * Alguém diz uma fala, de onde está. Devolve se falou: a vez pode ser de outro, pode haver um
 * alarme tocando, ou a tropa pode estar longe demais para se ouvir.
 */
export function say(who: Speaker, bark: Bark, at?: { x: number; y: number }, opts: SayOptions = {}): boolean {
  if (AudioEngine.alarmOn) return false;
  if (at && !opts.floor && AudioEngine.audibility(at.x, at.y) <= 0) return false;
  if (!chatter.allow(who.key, bark, performance.now())) return false;
  const u = utter({ bark, tongue: who.tongue, species: who.species, timbre: who.timbre, variant: chatter.variant(who.key, bark) });
  const where = at ? { x: at.x, y: at.y } : {};
  return AudioEngine.play(`voz:${bark}:${who.key}`, speakRecipe(u), { ...where, bus: "voice", seconds: u.seconds, volume: opts.volume ?? 1, floor: opts.floor }, 0, 1);
}
