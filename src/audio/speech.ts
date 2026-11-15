/**
 * A fala inventada (S1), só as regras: que palavra cada gente diz, com que voz e em que melodia.
 * As tropas não falam nenhuma língua de verdade: as palavras saem das mesmas sílabas que dão nome
 * aos lugares de cada cultura, e cada fala (selecionado, marchar, atacar...) tem a sua palavra fixa,
 * que o ouvido aprende. Quem transforma isto em som é `voice.ts`.
 *
 * Não sabe o que é a Web Audio, então dá para testar sem navegador.
 */
import { wordIn, type TongueId } from "../game/worldgen/names";
import type { EnemyKind, TroopType } from "../utils/constants";
import { hashString } from "../utils/hash";

/** O que se diz. */
export type Bark =
  | "select"
  | "move"
  | "attack"
  | "hold"
  | "retreat"
  | "panic"
  | "tired"
  | "cheer"
  | "confused"
  | "taunt"
  | "warcry"
  | "hup";

/** Que garganta fala. */
export type Species = "human" | "goblin" | "orc" | "undead";

export type Vowel = "a" | "e" | "i" | "o" | "u";
export type Onset = "none" | "plosive" | "fricative" | "nasal" | "liquid";
export type Coda = "none" | "plosive" | "fricative" | "nasal";

/** Os três primeiros formantes de cada vogal (voz de homem adulto), em Hz. */
export const FORMANTS: Record<Vowel, readonly [number, number, number]> = {
  a: [730, 1090, 2440],
  e: [530, 1840, 2480],
  i: [270, 2290, 3010],
  o: [570, 840, 2410],
  u: [300, 870, 2240],
};

const VOWEL_OF: Record<string, Vowel> = {
  a: "a", á: "a", à: "a", â: "a", ã: "a",
  e: "e", é: "e", ê: "e",
  i: "i", í: "i", y: "i",
  o: "o", ó: "o", ô: "o", õ: "o",
  u: "u", ú: "u", ü: "u",
};

const isVowel = (c: string): boolean => c in VOWEL_OF;
/** Duas letras, um som só: não se separam entre sílabas. */
const DIGRAPHS = new Set(["sh", "zh", "ch", "kh", "th", "lh", "nh", "qu", "hr"]);
/** Consoante + r ou l: começam a sílaba juntas ("dra", "bla"). */
const CLUSTER = /^[bcdfgkptv][rl]$/;

/** Separa uma palavra em sílabas, do jeito que a boca separa (não é gramática: é para cantar). */
export function syllabify(word: string): string[] {
  const w = [...word.toLowerCase()].filter((c) => isVowel(c) || /[a-zç]/.test(c)).join("");
  const out: string[] = [];
  let i = 0;
  while (i < w.length) {
    let onset = "";
    while (i < w.length && !isVowel(w[i])) onset += w[i++];
    if (i >= w.length) {
      // Consoantes no fim: fecham a última sílaba
      if (out.length > 0) out[out.length - 1] += onset;
      break;
    }
    let nucleus = w[i++];
    if (i < w.length && isVowel(w[i])) nucleus += w[i++];
    // Encontro de consoantes no meio da palavra: as primeiras fecham a sílaba anterior
    while (out.length > 0 && onset.length >= 2 && !(onset.length === 2 && (DIGRAPHS.has(onset) || CLUSTER.test(onset)))) {
      out[out.length - 1] += onset[0];
      onset = onset.slice(1);
    }
    out.push(onset + nucleus);
  }
  return out;
}

/** Uma sílaba como a boca a faz: como abre, que vogal, para onde escorrega e como fecha. */
export interface Phone {
  text: string;
  onset: Onset;
  /** Chiado agudo (s, z, x, ch) em vez de sopro (f, h). */
  sharp: boolean;
  vowel: Vowel;
  /** Ditongo: a vogal escorrega para esta. */
  glide: Vowel | null;
  coda: Coda;
}

export function phoneOf(syllable: string): Phone {
  const s = syllable.toLowerCase();
  const first = [...s].findIndex(isVowel);
  const head = first < 0 ? s : s.slice(0, first);
  let last = s.length;
  while (last > 0 && !isVowel(s[last - 1])) last--;
  const tail = s.slice(last);
  const nucleus = first < 0 ? "" : s.slice(first, last);

  let onset: Onset = "none";
  let sharp = false;
  const h = head[0] ?? "";
  if (/^(sh|zh|ch|th|kh)/.test(head)) {
    onset = "fricative";
    sharp = !/^(th|kh)/.test(head);
  } else if ("pbtdkgcq".includes(h) && h) onset = "plosive";
  else if ("fvszxjhç".includes(h) && h) {
    onset = "fricative";
    sharp = "szxjç".includes(h);
  } else if ("mn".includes(h) && h) onset = "nasal";
  else if (h) onset = "liquid";

  let coda: Coda = "none";
  const t = tail[tail.length - 1] ?? "";
  if (/(n|m|ng)$/.test(tail)) coda = "nasal";
  else if (t && "szxfh".includes(t)) coda = "fricative";
  else if (t && "pbtdkgc".includes(t)) coda = "plosive";

  return {
    text: s,
    onset,
    sharp,
    vowel: VOWEL_OF[nucleus[0]] ?? "a",
    glide: nucleus.length > 1 && VOWEL_OF[nucleus[1]] !== VOWEL_OF[nucleus[0]] ? VOWEL_OF[nucleus[1]] : null,
    coda,
  };
}

// --- A voz de cada um ---

export interface Timbre {
  /** A nota da voz, em Hz. */
  pitch: number;
  /** O tamanho da garganta: abaixo de 1, maior e mais escura; acima, menor e mais clara. */
  formant: number;
  /** Aspereza (0 a 1): o rosnado na voz. */
  rough: number;
  /** Sopro (0 a 1): ar junto com a voz. */
  breath: number;
  /** Só sopro, sem voz (os mortos). */
  whisper: boolean;
  /** Multiplica a duração de cada sílaba. */
  tempo: number;
  /** Volume desta garganta (sem valor, 1): a voz aguda soa mais alto e precisa de menos. */
  level?: number;
}

const timbre = (pitch: number, formant: number, rough = 0, tempo = 1, breath = 0.05): Timbre => ({ pitch, formant, rough, breath, whisper: false, tempo });

/**
 * A voz de cada tropa: a infantaria é grave, os arqueiros são leves, a cavalaria é firme e seca,
 * e a guarda pesada é a mais grave de todas. De olhos fechados dá para saber quem respondeu.
 */
export const TROOP_VOICE: Record<TroopType, Timbre> = {
  INFANTRY: timbre(112, 1, 0.08),
  SPEARMEN: timbre(121, 1.02, 0.05),
  HEAVY: timbre(84, 0.9, 0.22, 1.15),
  ARCHERS: timbre(154, 1.07, 0),
  CROSSBOW: timbre(139, 1.04, 0.04),
  JAVELINS: timbre(166, 1.1, 0, 0.9),
  CAVALRY: timbre(129, 0.98, 0.12, 0.9),
  KNIGHTS: timbre(98, 0.93, 0.18, 1.05),
  HORSE_ARCHERS: timbre(145, 1.05, 0.03, 0.9),
};

function rngFrom(seed: string): () => number {
  let a = hashString(seed);
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * A voz de uma pessoa (o Comandante, um tenente, um capitão): parte da voz da tropa que ela conduz
 * e muda com a semente dela, sempre a mesma. Mulher fala quase uma oitava acima, com a garganta menor.
 */
export function personTimbre(seed: string, female: boolean, base: Timbre = TROOP_VOICE.INFANTRY): Timbre {
  const r = rngFrom(`voz:${seed}`);
  const pitch = (female ? 205 : 0.5 * base.pitch + 58) * (0.86 + r() * 0.3);
  return {
    pitch,
    formant: (female ? 1.17 : 0.5 + base.formant * 0.5) * (0.95 + r() * 0.1),
    rough: Math.min(0.5, base.rough * 0.6 + r() * 0.18),
    breath: 0.03 + r() * 0.1,
    whisper: false,
    tempo: 0.92 + r() * 0.2,
  };
}

const SPECIES_VOICE: Record<Exclude<Species, "human">, Timbre> = {
  // Guincho: garganta pequena, nota alta, fala corrida
  goblin: { pitch: 335, formant: 1.38, rough: 0.35, breath: 0.1, whisper: false, tempo: 0.8, level: 0.7 },
  // Rugido: garganta enorme, nota muito baixa, rosnado
  orc: { pitch: 68, formant: 0.76, rough: 0.75, breath: 0.15, whisper: false, tempo: 1.25 },
  // Sussurro: só ar, devagar
  undead: { pitch: 90, formant: 0.92, rough: 0, breath: 1, whisper: true, tempo: 1.5 },
};

const SPECIES_SYLLABLES: Record<Exclude<Species, "human">, readonly string[]> = {
  goblin: ["gri", "ska", "nik", "zit", "kra", "yip", "gak", "snik", "rit", "kee", "tik", "skri"],
  orc: ["gor", "dush", "ragh", "mog", "ur", "nak", "bru", "zog", "grah", "dum", "rok", "ghash"],
  undead: ["ssha", "hhu", "ooh", "ssi", "hha", "uuh", "sse", "nnu", "ffa", "hho"],
};

const GOBLINS: ReadonlySet<EnemyKind> = new Set(["GOBLIN", "GOBLIN_ARCHER", "GOBLIN_CHIEF", "GOBLIN_CAPTAIN", "GOBLIN_SPEAR", "WOLF_RIDER"]);
const ORCS: ReadonlySet<EnemyKind> = new Set(["ORC", "ORC_WARLORD", "ORC_CHIEF", "ORC_CAPTAIN", "ORC_BRUTE"]);
const UNDEAD: ReadonlySet<EnemyKind> = new Set(["SKELETON", "NECROMANCER", "DEATH_KNIGHT", "SKELETON_ARCHER", "BONE_GUARD"]);
/** Gente de má vida: voz de gente, áspera, e a fala é praga. */
const ROGUES: ReadonlySet<EnemyKind> = new Set(["BANDIT", "BANDIT_ARCHER", "BANDIT_CHIEF", "BANDIT_CAPTAIN", "BANDIT_JAVELIN", "BANDIT_RIDER", "PIRATE", "PIRATE_BOW", "PIRATE_CAPTAIN", "MUTINEER", "MUTINEER_ARCHER", "MUTINEER_RIDER"]);
/** Quem não fala: bicho, carroça, máquina e quem não luta. */
const MUTE: ReadonlySet<EnemyKind> = new Set(["WOLF", "CART", "SIEGE_RAM", "CIVILIAN", "MERCHANT"]);
const ARCHER_KINDS: ReadonlySet<EnemyKind> = new Set(["BANDIT_ARCHER", "MUTINEER_ARCHER", "CROSSBOW", "LONGBOW", "DUNE_ARCHER", "REPEATER", "PIRATE_BOW", "BANDIT_JAVELIN", "HERALD", "COURIER", "OUTRIDER"]);
const HEAVY_KINDS: ReadonlySet<EnemyKind> = new Set(["MAN_AT_ARMS", "KNIGHT", "LORD", "CAPTAIN", "HOUSECARL", "JADE_GUARD", "MAMELUKE", "BANDIT_CHIEF", "PIRATE_CAPTAIN"]);
/** As tropas de ultramar falam a língua de onde vêm, onde quer que apareçam. */
const KIND_TONGUE: Partial<Record<EnemyKind, TongueId>> = {
  SAND_SPEAR: "SANDS",
  DUNE_ARCHER: "SANDS",
  MAMELUKE: "SANDS",
  AXEMAN: "ISLES",
  HOUSECARL: "ISLES",
  PIKE_LEVY: "JADE",
  REPEATER: "JADE",
  JADE_GUARD: "JADE",
};

export interface EnemyVoice {
  species: Species;
  /** A língua em que fala; sem ela, a da terra onde está. */
  tongue: TongueId | null;
  timbre: Timbre;
}

/** A voz de um inimigo: guincho de goblin, rugido de orc, praga de bandido, sussurro de morto. */
export function enemyVoice(kind: EnemyKind): EnemyVoice | null {
  if (MUTE.has(kind)) return null;
  if (GOBLINS.has(kind)) return { species: "goblin", tongue: null, timbre: SPECIES_VOICE.goblin };
  if (ORCS.has(kind)) return { species: "orc", tongue: null, timbre: SPECIES_VOICE.orc };
  if (UNDEAD.has(kind)) return { species: "undead", tongue: null, timbre: SPECIES_VOICE.undead };
  const base = HEAVY_KINDS.has(kind) ? TROOP_VOICE.HEAVY : ARCHER_KINDS.has(kind) ? TROOP_VOICE.ARCHERS : TROOP_VOICE.INFANTRY;
  const voice = ROGUES.has(kind) ? { ...base, rough: 0.45, tempo: base.tempo * 0.92 } : base;
  return { species: "human", tongue: KIND_TONGUE[kind] ?? null, timbre: voice };
}

// --- A melodia de cada fala ---

interface Shape {
  /** Quantas sílabas (mínimo e máximo). */
  count: readonly [number, number];
  /** A nota ao longo da fala, como múltiplo da nota da voz. */
  contour: readonly number[];
  /** Quanto dura cada sílaba, em segundos. */
  beat: number;
  gain: number;
  /** A última sílaba se estende (o grito). */
  stretchLast?: number;
  /** A voz treme (medo). */
  tremor?: number;
  /** Várias gargantas juntas. */
  voices?: number;
  breath?: number;
}

/** Cada fala tem a sua melodia; as com mais de uma variação não repetem a mesma duas vezes seguidas. */
const SHAPES: Record<Bark, readonly Shape[]> = {
  // "Senhor?", "Pronto.", "Às ordens."
  select: [
    { count: [2, 2], contour: [1, 1.2], beat: 0.17, gain: 0.8 },
    { count: [2, 2], contour: [1.12, 1.04], beat: 0.15, gain: 0.8 },
    { count: [3, 3], contour: [1.1, 1, 0.9], beat: 0.14, gain: 0.8 },
  ],
  move: [
    { count: [2, 3], contour: [1, 1.1, 0.92], beat: 0.15, gain: 0.85 },
    { count: [2, 2], contour: [1.08, 0.95], beat: 0.16, gain: 0.85 },
  ],
  attack: [
    { count: [2, 2], contour: [1.25, 1.45], beat: 0.14, gain: 1, stretchLast: 1.7 },
    { count: [1, 1], contour: [1.3, 1.5, 1.2], beat: 0.32, gain: 1 },
  ],
  hold: [{ count: [1, 2], contour: [0.96, 0.84], beat: 0.2, gain: 0.85 }],
  retreat: [{ count: [3, 3], contour: [1.22, 1.08, 0.9], beat: 0.125, gain: 0.9 }],
  panic: [{ count: [2, 3], contour: [1.5, 1.75, 1.45], beat: 0.13, gain: 0.95, tremor: 0.05, voices: 3 }],
  tired: [{ count: [2, 2], contour: [0.92, 0.76], beat: 0.27, gain: 0.7, breath: 0.5 }],
  cheer: [{ count: [1, 1], contour: [1, 1.32, 1.18], beat: 0.85, gain: 0.9, voices: 5 }],
  // "Hã?": quem não entendeu a ordem
  confused: [{ count: [1, 2], contour: [0.98, 1.32], beat: 0.24, gain: 0.7 }],
  // O desafio do inimigo
  taunt: [
    { count: [2, 3], contour: [1.1, 1.3, 0.88], beat: 0.16, gain: 0.9 },
    { count: [2, 2], contour: [1.3, 0.9], beat: 0.18, gain: 0.9 },
  ],
  // O grito de guerra do Comandante
  warcry: [{ count: [2, 2], contour: [1.15, 1.5], beat: 0.2, gain: 1, stretchLast: 2.2 }],
  // O mensageiro toca o cavalo
  hup: [{ count: [1, 1], contour: [1.2, 1.45], beat: 0.16, gain: 0.8 }],
};

export const variantsOf = (bark: Bark): number => SHAPES[bark].length;

/** O sotaque de cada língua: a nota, o quanto cada sílaba sobe ou desce e se a fala é seca ou arrastada. */
const ACCENT: Record<TongueId, { pitch: number; tonal: number; clip: number }> = {
  REALMS: { pitch: 1, tonal: 0.03, clip: 1 },
  SANDS: { pitch: 1.04, tonal: 0.07, clip: 1.1 },
  ISLES: { pitch: 0.93, tonal: 0.02, clip: 0.9 },
  JADE: { pitch: 1.1, tonal: 0.14, clip: 0.95 },
};

/** As sílabas de uma fala. Cada língua tem a sua palavra para cada fala, sempre a mesma. */
export function barkSyllables(bark: Bark, variant: number, tongue: TongueId, species: Species = "human"): string[] {
  const shape = SHAPES[bark][variant % SHAPES[bark].length];
  const r = rngFrom(`${species === "human" ? tongue : species}:${bark}:${variant % SHAPES[bark].length}`);
  const want = shape.count[0] + Math.floor(r() * (shape.count[1] - shape.count[0] + 1));
  const out: string[] = [];
  let guard = 0;
  while (out.length < want && guard++ < 12) {
    if (species === "human") out.push(...syllabify(wordIn(tongue, r)));
    else out.push(SPECIES_SYLLABLES[species][Math.floor(r() * SPECIES_SYLLABLES[species].length)]);
  }
  return out.slice(0, want);
}

/** A palavra de uma fala, como se escreveria (para a documentação e para os testes). */
export function barkWord(bark: Bark, variant: number, tongue: TongueId, species: Species = "human"): string {
  return barkSyllables(bark, variant, tongue, species).join("");
}

export interface SpokenPhone extends Phone {
  /** Quando começa, em segundos desde o início da fala. */
  at: number;
  dur: number;
  /** A nota no começo, no meio e no fim da sílaba (Hz). */
  f0: number;
  f0Mid: number;
  f0End: number;
  gain: number;
}

export interface Utterance {
  text: string;
  phones: SpokenPhone[];
  seconds: number;
  timbre: Timbre;
  voices: number;
  tremor: number;
  breath: number;
}

const MIN_SYLLABLE = 0.11;

function sample(contour: readonly number[], t: number): number {
  if (contour.length === 1) return contour[0];
  const x = Math.max(0, Math.min(1, t)) * (contour.length - 1);
  const i = Math.min(contour.length - 2, Math.floor(x));
  return contour[i] + (contour[i + 1] - contour[i]) * (x - i);
}

/** Monta uma fala: as sílabas, a nota e a duração de cada uma. */
export function utter(o: { bark: Bark; tongue: TongueId; species?: Species; timbre: Timbre; variant?: number; random?: () => number }): Utterance {
  const species = o.species ?? "human";
  const variant = (o.variant ?? 0) % SHAPES[o.bark].length;
  const shape = SHAPES[o.bark][variant];
  const syllables = barkSyllables(o.bark, variant, o.tongue, species);
  const accent = species === "human" ? ACCENT[o.tongue] : { pitch: 1, tonal: 0.05, clip: 1 };
  const r = o.random ?? Math.random;
  // Ninguém repete a mesma nota: uma folga pequena a cada fala
  const base = o.timbre.pitch * accent.pitch * (0.97 + r() * 0.06);
  const n = syllables.length;
  let at = 0;
  const phones = syllables.map((s, i): SpokenPhone => {
    const p = phoneOf(s);
    const last = i === n - 1;
    const dur = Math.max(MIN_SYLLABLE, shape.beat * o.timbre.tempo * accent.clip * (last ? (shape.stretchLast ?? 1.15) : 1) * (p.glide ? 1.15 : 1));
    // O sotaque: cada sílaba sobe ou desce um pouco, sempre do mesmo jeito para a mesma sílaba
    const tone = (hashString(s) % 2 === 0 ? 1 : -1) * accent.tonal;
    const phone: SpokenPhone = {
      ...p,
      at,
      dur,
      f0: base * sample(shape.contour, i / n),
      f0Mid: base * sample(shape.contour, (i + 0.5) / n) * (1 + tone / 2),
      f0End: base * sample(shape.contour, (i + 1) / n) * (1 + tone),
      gain: shape.gain,
    };
    at += dur;
    return phone;
  });
  return {
    text: syllables.join(""),
    phones,
    seconds: at + 0.08,
    timbre: o.timbre,
    voices: shape.voices ?? 1,
    tremor: shape.tremor ?? 0,
    breath: shape.breath ?? 0,
  };
}

// --- Quem fala e quando ---

/** Falas que não esperam a vez: o pânico, o grito de vitória e o grito de guerra. */
const URGENT: ReadonlySet<Bark> = new Set(["panic", "cheer", "warcry"]);

/**
 * A vez de falar: no máximo uma fala a cada 250 ms (uma ordem dada a cinco batalhões é respondida
 * por um só, o primeiro), e ninguém repete a própria fala em menos de um instante.
 */
export class Chatter {
  private lastAny = -Infinity;
  private last = new Map<string, number>();
  private turn = new Map<string, number>();

  constructor(
    readonly gapMs = 250,
    readonly ownMs = 900,
  ) {}

  allow(speaker: string, bark: Bark, now: number): boolean {
    if (!URGENT.has(bark) && now - this.lastAny < this.gapMs) return false;
    if (now - (this.last.get(speaker) ?? -Infinity) < this.ownMs) return false;
    this.lastAny = now;
    this.last.set(speaker, now);
    return true;
  }

  /** Qual variação desta vez: roda entre elas, nunca a mesma duas vezes seguidas. */
  variant(speaker: string, bark: Bark): number {
    const key = `${speaker}:${bark}`;
    const n = (this.turn.get(key) ?? hashString(key) % variantsOf(bark)) + 1;
    this.turn.set(key, n);
    return n % variantsOf(bark);
  }
}

/** Que fala responde a cada ordem (o texto da ordem é o mesmo que vai ao relato). */
export function barkForOrder(order: string): Bark {
  if (/^(Atacar|Foco|Carregar|Atirar|Investida|Escaramuçar|Perseguir|Seguir de longe)/.test(order)) return "attack";
  if (/^(Alto|Cessar|Fim d|Postura|Vigiar)/.test(order)) return "hold";
  if (/^(Recuar|Voltar|Recolher)/.test(order)) return "retreat";
  return "move";
}
