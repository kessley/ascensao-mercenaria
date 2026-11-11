/**
 * Os blocos de que todo som é feito: ruído filtrado, osciladores e o metal de sopro. As receitas
 * (`sounds.ts`, `voice.ts`) montam os sons com eles. Servem tanto ao som ao vivo quanto ao
 * renderizado fora do tempo real, que os testes usam.
 */

export function envelope(g: GainNode, start: number, attack: number, dur: number, peak: number): void {
  g.gain.setValueAtTime(0.0001, start);
  g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), start + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
}

export interface NoiseSpec {
  filter: BiquadFilterType;
  freq: number;
  freqEnd?: number;
  q?: number;
  dur: number;
  attack?: number;
  gain: number;
  delay?: number;
}

export function noiseBurst(ctx: BaseAudioContext, out: AudioNode, noise: AudioBuffer, s: NoiseSpec): void {
  const t = ctx.currentTime + (s.delay ?? 0);
  const src = ctx.createBufferSource();
  src.buffer = noise;
  const f = ctx.createBiquadFilter();
  f.type = s.filter;
  f.Q.value = s.q ?? 1;
  f.frequency.setValueAtTime(s.freq, t);
  if (s.freqEnd) f.frequency.exponentialRampToValueAtTime(s.freqEnd, t + s.dur);
  const g = ctx.createGain();
  envelope(g, t, s.attack ?? 0.005, s.dur, s.gain);
  src.connect(f).connect(g).connect(out);
  src.start(t, Math.random() * 1.5);
  src.stop(t + s.dur + 0.05);
}

export interface ToneSpec {
  type: OscillatorType;
  freq: number;
  freqEnd?: number;
  dur: number;
  attack?: number;
  gain: number;
  delay?: number;
}

export function tone(ctx: BaseAudioContext, out: AudioNode, s: ToneSpec): void {
  const t = ctx.currentTime + (s.delay ?? 0);
  const o = ctx.createOscillator();
  o.type = s.type;
  o.frequency.setValueAtTime(s.freq, t);
  if (s.freqEnd) o.frequency.exponentialRampToValueAtTime(s.freqEnd, t + s.dur);
  const g = ctx.createGain();
  envelope(g, t, s.attack ?? 0.005, s.dur, s.gain);
  o.connect(g).connect(out);
  o.start(t);
  o.stop(t + s.dur + 0.05);
}

/** Metal de sopro: dente-de-serra filtrado com leve vibrato. Trombetas e cornetas. */
export function brass(ctx: BaseAudioContext, out: AudioNode, notes: readonly (readonly [number, number])[], gain: number, brightness = 2200, delay = 0): void {
  let t = ctx.currentTime + delay;
  for (const [freq, dur] of notes) {
    const o = ctx.createOscillator();
    o.type = "sawtooth";
    o.frequency.setValueAtTime(freq * 0.97, t);
    o.frequency.linearRampToValueAtTime(freq, t + 0.03); // o "ataque" do lábio no bocal
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

/** Sino: parciais desafinados que morrem devagar. `size` maior = sino maior e mais grave. */
export function bell(ctx: BaseAudioContext, out: AudioNode, freq: number, dur: number, gain: number, delay = 0): void {
  const partials: [number, number][] = [
    [1, 1],
    [2.01, 0.6],
    [2.76, 0.42],
    [5.4, 0.25],
    [8.9, 0.12],
  ];
  for (const [mult, amp] of partials) {
    tone(ctx, out, { type: "sine", freq: freq * mult, dur: dur / Math.sqrt(mult), attack: 0.004, gain: gain * amp, delay });
  }
}

/** Tambor: o couro (seno que cai) e a batida (ruído curto). */
export function drum(ctx: BaseAudioContext, out: AudioNode, noise: AudioBuffer, freq: number, gain: number, delay = 0, dur = 0.32): void {
  tone(ctx, out, { type: "sine", freq, freqEnd: freq * 0.5, dur, attack: 0.003, gain, delay });
  noiseBurst(ctx, out, noise, { filter: "lowpass", freq: freq * 4, dur: 0.05, gain: gain * 0.5, delay });
}
