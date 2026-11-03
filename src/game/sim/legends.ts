import { AMBITIONS, type AmbitionId } from "./ambitions";
import type { FormerLeader } from "./legacy";

/**
 * Lendas (Marco 18): a crônica inteira do mundo e do bando. Tudo vira uma lista de acontecimentos
 * e, a partir dela, as páginas: quem é citado onde sai do próprio texto da crônica.
 */

export interface AnnalEntry {
  id: number;
  day: number;
  text: string;
  tone: "info" | "good" | "bad";
  /** Em que terra aconteceu. */
  land: string;
}

export interface BattleRecord {
  day: number;
  title: string;
  won: boolean;
  casualties: number;
  lost: string[];
  land: string;
}

export interface LegendSubject {
  name: string;
  /** "Comandante", "Tenente", "Rei", "Cidade em Marca de Alva"... */
  role: string;
  /** O que dizer antes da crônica. */
  note?: string;
}

/** O livro de uma saga: serve para a campanha em andamento e para as que já terminaram. */
export interface LegendBook {
  title: string;
  annals: AnnalEntry[];
  battles: BattleRecord[];
  people: LegendSubject[];
  realms: LegendSubject[];
  towns: LegendSubject[];
  /** A história do mundo antes do bando. */
  before: { year: number; text: string }[];
}

/** Tudo o que a crônica diz de alguém ou de algum lugar. */
export function entriesAbout(annals: readonly AnnalEntry[], name: string): AnnalEntry[] {
  return annals.filter((e) => e.text.includes(name));
}

/** Só quem aparece na crônica ganha página: o resto é figurante. */
export function mentioned(subjects: readonly LegendSubject[], annals: readonly AnnalEntry[], keep: (s: LegendSubject) => boolean = () => false): LegendSubject[] {
  const text = annals.map((e) => e.text).join("\n");
  const seen = new Set<string>();
  return subjects.filter((s) => {
    if (seen.has(s.name) || !(keep(s) || text.includes(s.name))) return false;
    seen.add(s.name);
    return true;
  });
}

/** A crônica cresce sem parar: o que sai primeiro é o miúdo, nunca vitória ou desastre. */
export function trimAnnals(annals: readonly AnnalEntry[], max: number): AnnalEntry[] {
  if (annals.length <= max) return [...annals];
  let extra = annals.length - max;
  const out = annals.filter((e) => {
    if (extra > 0 && e.tone === "info") {
      extra--;
      return false;
    }
    return true;
  });
  return out.slice(Math.max(0, out.length - max));
}

export interface EpilogueView {
  bandName: string;
  days: number;
  leaders: readonly { name: string }[];
  fallen: readonly FormerLeader[];
  ambitions: readonly AmbitionId[];
  victories: number;
  defeats: number;
  towns: readonly string[];
  /** Por que acabou. */
  reason: string;
}

/** O fim da saga, em parágrafos. */
export function epilogueOf(v: EpilogueView): string[] {
  const years = Math.max(1, Math.round(v.days / 80));
  const out = [`Os ${v.bandName} marcharam por ${years} ano(s), sob ${v.leaders.length} comandante(s). ${v.reason}`];
  out.push(`Venceram ${v.victories} batalha(s) e perderam ${v.defeats}.`);
  if (v.fallen.length > 0) out.push(`Caíram pelo caminho: ${v.fallen.map((f) => `${f.name} (${f.cause})`).join("; ")}.`);
  for (const id of v.ambitions) out.push(AMBITIONS[id].epilogue);
  if (v.towns.length > 0) out.push(`Deixaram a bandeira em ${v.towns.join(", ")}.`);
  else out.push("Não deixaram terras nem coroas: só o nome, e quem ainda se lembra dele.");
  return out;
}
