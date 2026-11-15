/**
 * O som do combate (S1), só as regras: com que arma se bate, em que material o golpe cai, quando
 * muitos tiros viram uma salva e quanto se ouve da linha, dos cascos e da marcha. As receitas ficam
 * em `combatSounds.ts` e os sons contínuos em `fieldLoops.ts`.
 *
 * Não sabe o que é a Web Audio, então dá para testar sem navegador.
 */

/** Com o que se bate: lâmina, machado, ponta (lança, dardo), pau (cajado, enxada, mão) ou dente. */
export type WeaponClass = "blade" | "axe" | "spear" | "club" | "claw";

/** Onde o golpe cai. `miss` é o golpe no ar. */
export type Surface = "steel" | "shield" | "plate" | "mail" | "flesh" | "bone" | "wood" | "miss";

/** Onde a flecha cai. */
export type ArrowSurface = "flesh" | "shield" | "plate" | "wood" | "ground";

/** O que o som precisa saber de uma figura: a arma, o escudo, a armadura e do que ela é feita. */
export interface StrikeLook {
  weapon: string;
  shield: boolean;
  /** 0 = pano ou couro, 1 = malha, 2 = placas. */
  armor: number;
  skeleton: boolean;
  vehicle: boolean;
  beast: boolean;
}

export const BARE: StrikeLook = { weapon: "NONE", shield: false, armor: 0, skeleton: false, vehicle: false, beast: false };

export function weaponClass(l: StrikeLook): WeaponClass {
  if (l.beast) return "claw";
  switch (l.weapon) {
    case "SWORD":
      return "blade";
    case "AXE":
      return "axe";
    case "SPEAR":
    case "LANCE":
    case "JAVELIN":
      return "spear";
    default:
      return "club";
  }
}

const METAL: ReadonlySet<WeaponClass> = new Set(["blade", "axe", "spear"]);

/**
 * O golpe que não entrou. De frente contra escudo, bate no escudo; arma de metal contra arma de
 * metal é aço no aço; contra carroça é madeira; pau e dente que erram cortam o ar.
 */
export function parrySurface(striker: StrikeLook, target: StrikeLook, front: boolean): Surface {
  if (target.vehicle) return "wood";
  if (front && target.shield) return "shield";
  const weapon = weaponClass(striker);
  if (!METAL.has(weapon)) return "miss";
  return METAL.has(weaponClass(target)) ? "steel" : "miss";
}

/** O golpe que entrou: lasca na carroça, osso no morto-vivo, placa, malha ou carne. */
export function woundSurface(target: StrikeLook): Surface {
  if (target.vehicle) return "wood";
  if (target.skeleton) return "bone";
  if (target.armor >= 2) return "plate";
  if (target.armor === 1) return "mail";
  return "flesh";
}

/** Onde a flecha caiu: no chão, na madeira, no escudo que a parou, na placa ou em alguém. */
export function arrowSurface(target: StrikeLook | null, stopped: boolean): ArrowSurface {
  if (!target) return "ground";
  if (target.vehicle) return "wood";
  if (stopped && target.shield) return "shield";
  if (target.armor >= 2 && !target.skeleton) return "plate";
  return "flesh";
}

/**
 * Muitos tiros juntos viram uma salva: conta os eventos de uma janela de tempo e avisa, uma vez,
 * quando chegam ao limiar.
 */
export class Burst {
  private times: number[] = [];

  constructor(
    readonly windowMs: number,
    readonly threshold: number,
  ) {}

  hit(now: number): boolean {
    if (this.times.length > 0 && now - this.times[0] >= this.windowMs) this.times = this.times.filter((t) => now - t < this.windowMs);
    this.times.push(now);
    return this.times.length === this.threshold;
  }
}

// --- O campo: quanto se ouve da linha, dos cascos e da marcha ---

/** O chão debaixo da coluna: cada um soa de um jeito. */
export type Ground = "grass" | "mud" | "snow" | "stone" | "bridge";

/** O chão de um ponto: a ponte ganha de tudo, depois a neve, a lama, e a pedra das estradas e ruas. */
export function groundKind(terrain: string, o: { snow: boolean; muddy: boolean; paved: boolean }): Ground {
  if (terrain === "BRIDGE") return "bridge";
  if (o.paved) return "stone";
  if (terrain === "ICE" || o.snow) return "snow";
  if (terrain === "MUD" || terrain === "SWAMP" || terrain === "SHALLOW" || o.muddy) return "mud";
  return "grass";
}

export interface FieldUnit {
  x: number;
  y: number;
  /** Andando ou fugindo. */
  moving: boolean;
  mounted: boolean;
  /** Trocou golpes agora há pouco. */
  fighting: boolean;
  /** A galope: em investida ou em fuga. */
  fast: boolean;
}

/** Um grupo que se ouve: quantos são (pesados pela distância) e de onde vem o som. */
export interface Heard {
  n: number;
  x: number;
  y: number;
}

export interface Census {
  /** Quem troca golpes. */
  fighting: Heard;
  /** Cavalos em movimento. */
  hooves: Heard;
  /** Gente a pé em movimento. */
  marching: Heard;
  /** Dos cavalos que se ouvem, que parte vai a galope (0 a 1). */
  gallop: number;
}

/**
 * Conta quem se ouve daqui. `hear` devolve quanto se ouve um ponto (0 a 1): cada um entra na conta
 * com esse peso, e o lugar do som é a média pesada de onde eles estão.
 */
export function census(units: Iterable<FieldUnit>, hear: (x: number, y: number) => number): Census {
  const fighting = { n: 0, x: 0, y: 0 };
  const hooves = { n: 0, x: 0, y: 0 };
  const marching = { n: 0, x: 0, y: 0 };
  let fast = 0;
  const add = (h: Heard, u: FieldUnit, w: number): void => {
    h.n += w;
    h.x += u.x * w;
    h.y += u.y * w;
  };
  for (const u of units) {
    if (!u.fighting && !u.moving) continue;
    const w = hear(u.x, u.y);
    if (w <= 0) continue;
    if (u.fighting) add(fighting, u, w);
    if (u.moving) {
      if (u.mounted) {
        add(hooves, u, w);
        if (u.fast) fast += w;
      } else add(marching, u, w);
    }
  }
  const gallop = hooves.n > 0 ? fast / hooves.n : 0;
  for (const h of [fighting, hooves, marching]) {
    if (h.n > 0) {
      h.x /= h.n;
      h.y /= h.n;
    }
  }
  return { fighting, hooves, marching, gallop };
}

/** De quantos (`from`) até quantos (`full`) o som cresce, do silêncio ao volume cheio: dobrar a tropa soma sempre o mesmo. */
function level(n: number, from: number, full: number): number {
  if (n < from) return 0;
  return Math.max(0, Math.min(1, Math.log2(1 + n - from) / Math.log2(1 + full - from)));
}

/** O rugido da linha: dois brigando não fazem rugido; cento e vinte perto da câmera, o rugido inteiro. */
export const roarLevel = (fighting: number): number => level(fighting, 3, 120);
/** Os cascos: um cavalo já se ouve; quarenta, o estrondo. */
export const hoovesLevel = (riders: number): number => level(riders, 0.5, 40);
/** A marcha: meia dúzia de pés não é coluna; cento e cinquenta, a coluna inteira. */
export const marchLevel = (walkers: number): number => level(walkers, 4, 150);
