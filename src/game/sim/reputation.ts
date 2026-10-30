import { COURT } from "../../utils/constants";
import type { Noble } from "./nobility";

/**
 * Fama, Honra, Temor e o lugar do Comandante em cada reino (Marco 15). A Cidade Alta é coesa
 * porque cada portão pergunta a mesma coisa: quem é você neste reino? A resposta sai daqui, e
 * cada recusa tem saídas que custam alguma coisa: suborno (honra), carta de apresentação (um
 * favor), intimidação (temor), disfarce (risco) ou os esgotos (crime).
 */

export type Standing = -1 | 0 | 1 | 2 | 3 | 4 | 5;

export const STANDING_LABEL: Record<Standing, string> = {
  [-1]: "Inimigo da coroa",
  0: "Forasteiro",
  1: "Conhecido",
  2: "Respeitado",
  3: "Cavaleiro",
  4: "Vassalo",
  5: "Da família real",
};

/** Do que depende o lugar do bando num reino. */
export interface RepCtx {
  fame: number;
  honor: number;
  fear: number;
  factions: readonly { id: string; relation: number; atWar: boolean }[];
  knights: readonly string[];
  liege: string | null;
  spouseId: string | null;
  nobles: readonly Noble[];
  wanted: Record<string, number>;
}

export function standingIn(s: RepCtx, factionId: string): Standing {
  const f = s.factions.find((x) => x.id === factionId);
  if (!f) return 0;
  if (f.atWar || (s.wanted[factionId] ?? 0) > 0) return -1;
  const spouse = s.spouseId ? s.nobles.find((n) => n.id === s.spouseId) : undefined;
  if (spouse && spouse.factionId === factionId && (spouse.rank === "RULER" || spouse.rank === "HEIR" || spouse.rank === "CHILD" || spouse.rank === "CONSORT")) return 5;
  if (s.liege === factionId) return 4;
  if (s.knights.includes(factionId)) return 3;
  if ((s.fame >= 35 && f.relation >= 5) || f.relation >= 40) return 2;
  if (s.fame >= 15 || f.relation >= 15) return 1;
  return 0;
}

/** Como o reino chama o Comandante (guardas e nobres falam de acordo). */
export function addressOf(st: Standing): string {
  if (st >= 3) return "sor";
  if (st >= 1) return "Capitão";
  return "mercenário";
}

/** Portões e salas que perguntam quem é você. */
export type AccessPlace = "CITY" | "NOBLE" | "CASTLE" | "THRONE" | "ROYAL" | "ARMORY";

export const ACCESS_LABEL: Record<AccessPlace, string> = {
  CITY: "Portão da Cidade Alta",
  NOBLE: "Portão do Bairro Nobre",
  CASTLE: "Ponte do Castelo",
  THRONE: "Sala do Trono",
  ROYAL: "Aposentos Reais",
  ARMORY: "Arsenal Real",
};

/** Lugar mínimo pedido em cada porta (sem contar as saídas por fora). */
export const ACCESS_MIN: Record<AccessPlace, Standing> = { CITY: 0, NOBLE: 1, CASTLE: 2, THRONE: 3, ROYAL: 4, ARMORY: 4 };

/** Resposta do guarda: passa, ou por que não, e o que dá para tentar. */
export interface AccessCheck {
  open: boolean;
  why: string;
  /** Saídas: ouro do suborno, intimidar, mostrar uma carta de apresentação, disfarçar-se. */
  bribe: number;
  intimidate: boolean;
  letter: boolean;
  disguise: boolean;
}

/** Quem é o Comandante diante de uma porta do reino `factionId`. */
export function accessCheck(s: RepCtx & { passLetters: readonly string[]; disguised: boolean; playerOwned: boolean }, place: AccessPlace, factionId: string): AccessCheck {
  const closed = (why: string, extra: Partial<AccessCheck> = {}): AccessCheck => ({ open: false, why, bribe: 0, intimidate: false, letter: false, disguise: false, ...extra });
  const pass: AccessCheck = { open: true, why: "", bribe: 0, intimidate: false, letter: false, disguise: false };
  if (s.playerOwned) return pass;
  const st = standingIn(s, factionId);
  const min = ACCESS_MIN[place];
  if (st === -1) return closed((s.wanted[factionId] ?? 0) > 0 ? "Há um mandado com o nome do Comandante em todo portão do reino." : "Em guerra, ninguém do bando passa.", { disguise: place === "CITY" });
  if (st >= min) {
    // Honra muito baixa fecha a porta até de quem tem nome
    if (s.honor < 20 && place === "THRONE" && st < 4) return closed("Os camareiros dizem que homens sem palavra não pisam no tapete real.", { bribe: COURT.BRIBE.CASTLE * 2 });
    return pass;
  }
  const letter = s.passLetters.includes(factionId);
  switch (place) {
    case "NOBLE":
      return closed(s.fame < 15 ? "Forasteiros armados não passam deste portão. Faça o seu nome primeiro." : "Precisa ter alguma relação com a coroa para passar.", { bribe: COURT.BRIBE.NOBLE, intimidate: s.fear >= 30, letter, disguise: true });
    case "CASTLE":
      return closed("A ponte do castelo só desce para quem é Respeitado neste reino ou tem convite.", { bribe: COURT.BRIBE.CASTLE, intimidate: s.fear >= 55, letter, disguise: true });
    case "THRONE":
      return closed("A Sala do Trono é para quem tem audiência: fale com o Camareiro-mor no pátio.");
    default:
      return closed("Só a família e os vassalos passam daqui.", { letter: false });
  }
}
