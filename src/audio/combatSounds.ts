/**
 * O som do combate (S1): as receitas. Cada golpe soa conforme o material em que cai (aço no aço,
 * lâmina no escudo, placa, malha, carne, osso, madeira) e conforme a arma (machado pesa, lança
 * espeta, pau bate surdo); as flechas têm o tiro, a salva, o assobio e a chegada; o cerco tem o
 * aríete, a escada e o portão. As regras de qual toca estão em `hitRules.ts`.
 */
import { AudioEngine, type SoundRecipe } from "./AudioEngine";
import { Burst, type ArrowSurface, type Surface, type WeaponClass } from "./hitRules";
import { noiseBurst, tone } from "./synth";

type At = { x: number; y: number };

// --- Os golpes ---

type Layer = (ctx: BaseAudioContext, out: AudioNode, noise: AudioBuffer, p: number) => void;

const SURFACES: Record<Surface, Layer> = {
  // Aço no aço: o estalo e o anel
  steel: (ctx, out, noise, p) => {
    noiseBurst(ctx, out, noise, { filter: "bandpass", freq: 2800 * p, q: 3, dur: 0.07, gain: 0.5 });
    tone(ctx, out, { type: "square", freq: 1750 * p, dur: 0.12, gain: 0.05 });
    tone(ctx, out, { type: "square", freq: 2630 * p, dur: 0.09, gain: 0.035 });
  },
  // Lâmina no escudo: a madeira que segura e o friso de ferro
  shield: (ctx, out, noise, p) => {
    tone(ctx, out, { type: "triangle", freq: 230 * p, freqEnd: 170 * p, dur: 0.07, attack: 0.003, gain: 0.3 });
    noiseBurst(ctx, out, noise, { filter: "lowpass", freq: 700 * p, dur: 0.06, attack: 0.003, gain: 0.4 });
    noiseBurst(ctx, out, noise, { filter: "bandpass", freq: 2500 * p, q: 3, dur: 0.02, attack: 0.002, gain: 0.15 });
  },
  // Placa: o baque que retine
  plate: (ctx, out, noise, p) => {
    noiseBurst(ctx, out, noise, { filter: "bandpass", freq: 1900 * p, q: 3, dur: 0.05, attack: 0.002, gain: 0.4 });
    tone(ctx, out, { type: "sine", freq: 930 * p, dur: 0.14, attack: 0.002, gain: 0.07 });
    tone(ctx, out, { type: "sine", freq: 1370 * p, dur: 0.11, attack: 0.002, gain: 0.05 });
    tone(ctx, out, { type: "sine", freq: 2150 * p, dur: 0.08, attack: 0.002, gain: 0.04 });
  },
  // Malha: o tilintar curto sobre o corpo
  mail: (ctx, out, noise, p) => {
    noiseBurst(ctx, out, noise, { filter: "highpass", freq: 3800 * p, dur: 0.045, attack: 0.002, gain: 0.22 });
    tone(ctx, out, { type: "sine", freq: 3150 * p, dur: 0.05, attack: 0.002, gain: 0.04 });
    noiseBurst(ctx, out, noise, { filter: "lowpass", freq: 400, dur: 0.05, attack: 0.003, gain: 0.2 });
  },
  // Carne: surdo e molhado
  flesh: (ctx, out, noise, p) => {
    noiseBurst(ctx, out, noise, { filter: "lowpass", freq: 320 * p, dur: 0.08, attack: 0.003, gain: 0.5 });
    tone(ctx, out, { type: "sine", freq: 115 * p, freqEnd: 70, dur: 0.09, attack: 0.003, gain: 0.25 });
  },
  // Osso: seco, dois estalos
  bone: (ctx, out, noise, p) => {
    noiseBurst(ctx, out, noise, { filter: "bandpass", freq: 1500 * p, q: 3, dur: 0.03, attack: 0.002, gain: 0.6 });
    noiseBurst(ctx, out, noise, { filter: "bandpass", freq: 1100 * p, q: 3, dur: 0.03, attack: 0.002, gain: 0.45, delay: 0.03 });
    tone(ctx, out, { type: "triangle", freq: 720 * p, freqEnd: 420 * p, dur: 0.05, attack: 0.002, gain: 0.14 });
  },
  // Madeira: a tábua que racha
  wood: (ctx, out, noise, p) => {
    noiseBurst(ctx, out, noise, { filter: "bandpass", freq: 800 * p, q: 3, dur: 0.05, attack: 0.002, gain: 0.4 });
    tone(ctx, out, { type: "triangle", freq: 300 * p, freqEnd: 210 * p, dur: 0.06, attack: 0.003, gain: 0.2 });
  },
  // No ar: só o vento da arma
  miss: (ctx, out, noise, p) => {
    noiseBurst(ctx, out, noise, { filter: "bandpass", freq: 900 * p, freqEnd: 2400 * p, q: 2, dur: 0.12, attack: 0.03, gain: 0.45 });
  },
};

/** O que cada arma põe no golpe, e a afinação dela (o machado é mais grave, a lança mais fina). */
const WEAPONS: Record<WeaponClass, { pitch: number; layer?: Layer }> = {
  blade: {
    pitch: 1,
    // O fio que corta
    layer: (ctx, out, noise, p) => noiseBurst(ctx, out, noise, { filter: "bandpass", freq: 2600 * p, freqEnd: 900 * p, q: 1.5, dur: 0.07, attack: 0.004, gain: 0.12 }),
  },
  axe: {
    pitch: 0.82,
    // O peso que desce
    layer: (ctx, out, _noise, p) => tone(ctx, out, { type: "sine", freq: 150 * p, freqEnd: 85, dur: 0.1, attack: 0.003, gain: 0.22 }),
  },
  spear: {
    pitch: 1.12,
    // A ponta que espeta
    layer: (ctx, out, noise) => noiseBurst(ctx, out, noise, { filter: "highpass", freq: 3000, dur: 0.03, attack: 0.002, gain: 0.12 }),
  },
  club: {
    pitch: 0.72,
    // O pau que bate surdo
    layer: (ctx, out, _noise, p) => tone(ctx, out, { type: "triangle", freq: 190 * p, freqEnd: 140 * p, dur: 0.07, attack: 0.003, gain: 0.25 }),
  },
  claw: {
    pitch: 0.9,
    // O dente
    layer: (ctx, out, noise) => noiseBurst(ctx, out, noise, { filter: "bandpass", freq: 1100, q: 2, dur: 0.06, attack: 0.004, gain: 0.2 }),
  },
};

const SURFACE_LIST = Object.keys(SURFACES) as Surface[];
const WEAPON_LIST = Object.keys(WEAPONS) as WeaponClass[];

/** As receitas já montadas, uma por material e arma: numa batalha grande pede-se um golpe mil vezes por segundo. */
const HITS = {} as Record<Surface, Record<WeaponClass, SoundRecipe>>;
for (const s of SURFACE_LIST) {
  HITS[s] = {} as Record<WeaponClass, SoundRecipe>;
  for (const w of WEAPON_LIST) {
    const weapon = WEAPONS[w];
    HITS[s][w] = (ctx, out, { pitch, noise }) => {
      SURFACES[s](ctx, out, noise, pitch * weapon.pitch);
      // O golpe no ar não tem o corpo da arma, só o vento
      if (s !== "miss") weapon.layer?.(ctx, out, noise, pitch);
    };
  }
}

export const hitRecipe = (surface: Surface, weapon: WeaponClass): SoundRecipe => HITS[surface][weapon];

const HIT_NAME = {} as Record<Surface, string>;
for (const s of SURFACE_LIST) HIT_NAME[s] = `golpe:${s}`;
/** O volume de cada material: o que estala alto pede menos. */
const HIT_VOLUME: Record<Surface, number> = { steel: 0.55, shield: 0.6, plate: 0.6, mail: 0.65, flesh: 0.6, bone: 0.6, wood: 0.6, miss: 0.5 };

// --- As flechas ---

export type MissileSound = "ARROW" | "BOLT" | "JAVELIN";

const SHOTS: Record<MissileSound, SoundRecipe> = {
  // A corda do arco e a flecha que sai
  ARROW: (ctx, out, { pitch, noise }) => {
    tone(ctx, out, { type: "triangle", freq: 190 * pitch, freqEnd: 120 * pitch, dur: 0.09, gain: 0.25 });
    noiseBurst(ctx, out, noise, { filter: "highpass", freq: 3200, freqEnd: 1200, dur: 0.14, attack: 0.01, gain: 0.18, delay: 0.02 });
  },
  // A besta: o estalo da noz e a pancada do arco de ferro
  BOLT: (ctx, out, { pitch, noise }) => {
    noiseBurst(ctx, out, noise, { filter: "bandpass", freq: 1700 * pitch, q: 4, dur: 0.03, attack: 0.002, gain: 0.35 });
    tone(ctx, out, { type: "triangle", freq: 320 * pitch, freqEnd: 200 * pitch, dur: 0.06, attack: 0.002, gain: 0.22 });
    noiseBurst(ctx, out, noise, { filter: "highpass", freq: 3600, freqEnd: 1500, dur: 0.09, attack: 0.008, gain: 0.14, delay: 0.02 });
  },
  // O dardo: o braço e o ar
  JAVELIN: (ctx, out, { pitch, noise }) => {
    noiseBurst(ctx, out, noise, { filter: "bandpass", freq: 600 * pitch, freqEnd: 1500 * pitch, q: 1.2, dur: 0.17, attack: 0.05, gain: 0.55 });
  },
};

/** A salva: muitas cordas quase juntas e o ar cheio de flechas. */
const volley: SoundRecipe = (ctx, out, { noise }) => {
  for (let i = 0; i < 7; i++) {
    tone(ctx, out, { type: "triangle", freq: 170 + Math.random() * 60, freqEnd: 115, dur: 0.09, gain: 0.14, delay: Math.random() * 0.13 });
  }
  noiseBurst(ctx, out, noise, { filter: "highpass", freq: 2600, freqEnd: 1100, dur: 0.55, attack: 0.09, gain: 0.2, delay: 0.03 });
};

/** O assobio da flecha que passa. */
const whistle: SoundRecipe = (ctx, out, { pitch, noise }) => {
  tone(ctx, out, { type: "sine", freq: 2700 * pitch, freqEnd: 1700 * pitch, dur: 0.34, attack: 0.08, gain: 0.07 });
  noiseBurst(ctx, out, noise, { filter: "highpass", freq: 5200, dur: 0.3, attack: 0.1, gain: 0.07 });
};

const ARROW_LANDS: Record<ArrowSurface, SoundRecipe> = {
  flesh: (ctx, out, { pitch, noise }) => {
    noiseBurst(ctx, out, noise, { filter: "bandpass", freq: 2500, q: 2, dur: 0.02, attack: 0.002, gain: 0.14 });
    noiseBurst(ctx, out, noise, { filter: "lowpass", freq: 700 * pitch, dur: 0.06, attack: 0.003, gain: 0.4 });
  },
  shield: (ctx, out, { pitch, noise }) => {
    tone(ctx, out, { type: "triangle", freq: 400 * pitch, freqEnd: 300 * pitch, dur: 0.045, attack: 0.002, gain: 0.2 });
    noiseBurst(ctx, out, noise, { filter: "bandpass", freq: 1200 * pitch, q: 3, dur: 0.03, attack: 0.002, gain: 0.3 });
  },
  plate: (ctx, out, { pitch, noise }) => {
    tone(ctx, out, { type: "sine", freq: 3400 * pitch, dur: 0.07, attack: 0.002, gain: 0.06 });
    noiseBurst(ctx, out, noise, { filter: "highpass", freq: 4000, dur: 0.02, attack: 0.002, gain: 0.16 });
  },
  wood: (ctx, out, { pitch, noise }) => {
    tone(ctx, out, { type: "triangle", freq: 260 * pitch, freqEnd: 200 * pitch, dur: 0.05, attack: 0.002, gain: 0.24 });
    noiseBurst(ctx, out, noise, { filter: "bandpass", freq: 700 * pitch, q: 3, dur: 0.035, attack: 0.002, gain: 0.3 });
  },
  ground: (ctx, out, { pitch, noise }) => {
    noiseBurst(ctx, out, noise, { filter: "lowpass", freq: 500 * pitch, dur: 0.045, attack: 0.003, gain: 0.32 });
  },
};

// --- A queda ---

export type FallSound = "BLOOD" | "BONE" | "WOOD";

const FALLS: Record<FallSound, SoundRecipe> = {
  BLOOD: (ctx, out, { pitch, noise }) => {
    tone(ctx, out, { type: "sine", freq: 150 * pitch, freqEnd: 55, dur: 0.28, gain: 0.35 });
    noiseBurst(ctx, out, noise, { filter: "lowpass", freq: 380, dur: 0.18, gain: 0.3 });
  },
  // O morto-vivo desmonta: ossos que caem
  BONE: (ctx, out, { pitch, noise }) => {
    for (let i = 0; i < 5; i++) {
      noiseBurst(ctx, out, noise, { filter: "bandpass", freq: (1100 + Math.random() * 900) * pitch, q: 2.5, dur: 0.03, attack: 0.002, gain: 0.7, delay: i * 0.045 + Math.random() * 0.02 });
    }
    noiseBurst(ctx, out, noise, { filter: "lowpass", freq: 300, dur: 0.1, attack: 0.004, gain: 0.4, delay: 0.12 });
  },
  // A carroça que se parte
  WOOD: (ctx, out, { pitch, noise }) => {
    noiseBurst(ctx, out, noise, { filter: "lowpass", freq: 900, dur: 0.32, attack: 0.004, gain: 0.5 });
    noiseBurst(ctx, out, noise, { filter: "bandpass", freq: 600 * pitch, q: 3, dur: 0.12, attack: 0.003, gain: 0.35 });
    tone(ctx, out, { type: "triangle", freq: 200 * pitch, freqEnd: 90, dur: 0.22, attack: 0.004, gain: 0.3 });
  },
};

/** O cavalo que cai ou que leva o choque: um relincho curto e aflito. */
const neigh: SoundRecipe = (ctx, out, { pitch }) => {
  const t = ctx.currentTime;
  const o = ctx.createOscillator();
  o.type = "sawtooth";
  o.frequency.setValueAtTime(1000 * pitch, t);
  o.frequency.linearRampToValueAtTime(1500 * pitch, t + 0.08);
  o.frequency.linearRampToValueAtTime(620 * pitch, t + 0.5);
  const lfo = ctx.createOscillator();
  lfo.frequency.value = 13;
  const depth = ctx.createGain();
  depth.gain.value = 80;
  lfo.connect(depth).connect(o.frequency);
  const f = ctx.createBiquadFilter();
  f.type = "bandpass";
  f.frequency.value = 1500;
  f.Q.value = 1.2;
  const g = ctx.createGain();
  g.gain.value = 0.0001;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.5, t + 0.04);
  g.gain.setValueAtTime(0.5, t + 0.32);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.5);
  o.connect(f).connect(g).connect(out);
  o.start(t);
  lfo.start(t);
  o.stop(t + 0.55);
  lfo.stop(t + 0.55);
};

// --- O choque e o cerco ---

/** O choque da investida: o estrondo grave. */
const chargeImpact: SoundRecipe = (ctx, out, { noise }) => {
  noiseBurst(ctx, out, noise, { filter: "lowpass", freq: 260, dur: 0.45, attack: 0.02, gain: 0.6 });
  tone(ctx, out, { type: "sine", freq: 90, freqEnd: 45, dur: 0.3, gain: 0.4 });
};

/** O aríete: a viga que bate, a madeira que estala e o portão que range depois. */
const ram: SoundRecipe = (ctx, out, { noise }) => {
  tone(ctx, out, { type: "sine", freq: 70, freqEnd: 38, dur: 0.5, attack: 0.004, gain: 0.6 });
  noiseBurst(ctx, out, noise, { filter: "lowpass", freq: 180, dur: 0.3, attack: 0.004, gain: 0.5 });
  noiseBurst(ctx, out, noise, { filter: "bandpass", freq: 700, q: 3, dur: 0.08, attack: 0.003, gain: 0.3 });
  noiseBurst(ctx, out, noise, { filter: "bandpass", freq: 350, freqEnd: 450, q: 8, dur: 0.3, attack: 0.08, gain: 0.18, delay: 0.15 });
};

/** A escada que encosta na muralha: madeira contra pedra. */
const ladder: SoundRecipe = (ctx, out, { noise }) => {
  [0, 0.07, 0.16].forEach((delay, i) => {
    tone(ctx, out, { type: "triangle", freq: 340 - i * 30, freqEnd: 250, dur: 0.05, attack: 0.002, gain: 0.22, delay });
    noiseBurst(ctx, out, noise, { filter: "bandpass", freq: 900, q: 3, dur: 0.03, attack: 0.002, gain: 0.3, delay });
  });
  noiseBurst(ctx, out, noise, { filter: "bandpass", freq: 900, freqEnd: 600, q: 2, dur: 0.22, attack: 0.05, gain: 0.12, delay: 0.05 });
};

/** O portão que racha: ainda de pé, mas avisando. */
const gateCrack: SoundRecipe = (ctx, out, { noise }) => {
  noiseBurst(ctx, out, noise, { filter: "bandpass", freq: 900, q: 4, dur: 0.06, attack: 0.002, gain: 0.5 });
  noiseBurst(ctx, out, noise, { filter: "bandpass", freq: 650, q: 4, dur: 0.07, attack: 0.002, gain: 0.4, delay: 0.09 });
  tone(ctx, out, { type: "triangle", freq: 240, freqEnd: 120, dur: 0.22, attack: 0.004, gain: 0.3 });
};

/** O portão que cai: o estrondo e os pedaços. */
const gateFall: SoundRecipe = (ctx, out, { noise }) => {
  noiseBurst(ctx, out, noise, { filter: "lowpass", freq: 600, dur: 0.9, attack: 0.01, gain: 0.7 });
  tone(ctx, out, { type: "sine", freq: 62, freqEnd: 30, dur: 0.8, attack: 0.006, gain: 0.6 });
  for (let i = 0; i < 9; i++) {
    noiseBurst(ctx, out, noise, { filter: "bandpass", freq: 500 + Math.random() * 1000, q: 3, dur: 0.05, attack: 0.002, gain: 0.25, delay: 0.1 + Math.random() * 0.75 });
  }
};

/** Todas as receitas do combate, pelo nome com que tocam (o inventário e os testes leem daqui). */
export const COMBAT_SOUNDS: Readonly<Record<string, { recipe: SoundRecipe; seconds: number }>> = {
  ...Object.fromEntries(SURFACE_LIST.flatMap((s) => WEAPON_LIST.map((w) => [`golpe:${s}:${w}`, { recipe: HITS[s][w], seconds: 0.3 }]))),
  "tiro:ARROW": { recipe: SHOTS.ARROW, seconds: 0.25 },
  "tiro:BOLT": { recipe: SHOTS.BOLT, seconds: 0.2 },
  "tiro:JAVELIN": { recipe: SHOTS.JAVELIN, seconds: 0.25 },
  salva: { recipe: volley, seconds: 0.7 },
  assobio: { recipe: whistle, seconds: 0.4 },
  ...Object.fromEntries((Object.keys(ARROW_LANDS) as ArrowSurface[]).map((s) => [`flecha:${s}`, { recipe: ARROW_LANDS[s], seconds: 0.15 }])),
  "queda:BLOOD": { recipe: FALLS.BLOOD, seconds: 0.35 },
  "queda:BONE": { recipe: FALLS.BONE, seconds: 0.35 },
  "queda:WOOD": { recipe: FALLS.WOOD, seconds: 0.4 },
  relincho: { recipe: neigh, seconds: 0.6 },
  choque: { recipe: chargeImpact, seconds: 0.5 },
  ariete: { recipe: ram, seconds: 0.7 },
  escada: { recipe: ladder, seconds: 0.4 },
  "portao:racha": { recipe: gateCrack, seconds: 0.4 },
  "portao:cai": { recipe: gateFall, seconds: 1.1 },
};

const jitter = (): number => 0.9 + Math.random() * 0.2;
/** Cinco tiros em menos de um quinto de segundo já são uma salva. */
const shots = new Burst(180, 5);

/** Os sons do combate, cada um de onde acontece. */
export const battle = {
  /** Um golpe: o material em que caiu e a arma que bateu. */
  melee: (surface: Surface, weapon: WeaponClass, at: At) =>
    AudioEngine.play(HIT_NAME[surface], HITS[surface][weapon], { x: at.x, y: at.y, pitch: jitter(), volume: HIT_VOLUME[surface], seconds: 0.25 }, 35, 5),

  /** Um tiro; muitos juntos, de perto um do outro, viram também a salva. */
  shot: (kind: MissileSound, at: At) => {
    if (shots.hit(performance.now())) AudioEngine.play("salva", volley, { x: at.x, y: at.y, volume: 0.7, seconds: 0.7 }, 500, 2);
    return AudioEngine.play(`tiro:${kind}`, SHOTS[kind], { x: at.x, y: at.y, pitch: jitter(), volume: 0.6, seconds: 0.2 }, 40, 4);
  },

  /** A flecha que passa assobiando. */
  whistle: (at: At) => AudioEngine.play("assobio", whistle, { x: at.x, y: at.y, pitch: jitter(), volume: 0.8, seconds: 0.4 }, 220, 2),

  /** A flecha que chega: na carne, no escudo, na placa, na madeira ou no chão. */
  arrowLand: (surface: ArrowSurface, at: At) =>
    AudioEngine.play(`flecha:${surface}`, ARROW_LANDS[surface], { x: at.x, y: at.y, pitch: jitter(), volume: surface === "ground" ? 0.35 : 0.5, seconds: 0.12 }, surface === "ground" ? 90 : 40, surface === "ground" ? 2 : 4),

  /** Alguém cai: gente, morto-vivo ou carroça; o cavalo de quem ia montado às vezes relincha. */
  fall: (matter: FallSound, mounted: boolean, at: At) => {
    if (mounted && Math.random() < 0.3) AudioEngine.play("relincho", neigh, { x: at.x, y: at.y, pitch: jitter(), volume: 0.35, seconds: 0.6 }, 1500, 1);
    return AudioEngine.play(`queda:${matter}`, FALLS[matter], { x: at.x, y: at.y, pitch: jitter(), volume: 0.7, seconds: 0.3 }, 60, 4);
  },

  /** O choque da investida (e a investida que morre nas lanças). */
  charge: (at: At) => {
    AudioEngine.play("relincho", neigh, { x: at.x, y: at.y, pitch: jitter(), volume: 0.3, seconds: 0.6 }, 1500, 1);
    return AudioEngine.play("choque", chargeImpact, { x: at.x, y: at.y, seconds: 0.5 }, 150, 2);
  },

  ram: (at: At) => AudioEngine.play("ariete", ram, { x: at.x, y: at.y, seconds: 0.7 }, 300, 2),
  ladder: (at: At) => AudioEngine.play("escada", ladder, { x: at.x, y: at.y, volume: 0.8, seconds: 0.4 }, 200, 2),
  gateCrack: (at: At) => AudioEngine.play("portao:racha", gateCrack, { x: at.x, y: at.y, seconds: 0.4 }, 600, 1),
  gateFall: (at: At) => AudioEngine.play("portao:cai", gateFall, { x: at.x, y: at.y, seconds: 1.1, floor: 0.35 }, 800, 1),
};
