import {
  arcaneAfter,
  arcaneMax,
  artifactDef,
  magicPrice,
  marksFor,
  markWeight,
  MARK_TEXT,
  masterOffers,
  nextArtifact,
  nextGrimoire,
  spellDef,
  type ArtifactId,
  type SpellId,
} from "../game/sim/magic";
import { MAGIC } from "../utils/constants";
import type { GameState } from "./useGameStore";

/**
 * A magia do Comandante (Marco 19): as magias que ele sabe e o arcano. Fica à parte do store
 * principal, como a corte, a guerra e o legado. O arcano vai para o save; o tempo de recarga de
 * cada magia é da batalha e fica na cena.
 */
export interface MagicState {
  /** As magias que o Comandante sabe. Começa sem nenhuma: a magia se aprende pelo mundo. */
  spells: SpellId[];
  /** O arcano de agora, de 0 a `MAGIC.ARCANE_MAX`. */
  arcane: number;
  /** Grimórios achados e ainda não estudados (parte 3). Ficam com o bando, mesmo se o Comandante morrer. */
  grimoires: SpellId[];
  /** As ruínas que já deram o seu grimório (ou o seu artefato). */
  searchedRuins: string[];
  /** Os artefatos do bando (parte 4). Ficam com o bando, mesmo se o Comandante morrer. */
  artifacts: ArtifactId[];
  /** O arcano que o Comandante de agora já gastou (o que conta para as marcas no corpo). */
  arcaneSpent: number;
  /** O último dia em que a magia foi assunto nas cortes e nos templos (para a crônica falar uma vez por dia). */
  magicTalkDay: number;
}

/** O que umas ruínas dão: um grimório ou, sem grimório a achar, um artefato. */
export type RuinFind = { spell: SpellId } | { artifact: ArtifactId };

export interface MagicActions {
  /** Gasta o arcano de uma magia; false = não sabe ou não tem arcano. */
  spendArcane: (spell: SpellId) => boolean;
  /** O Comandante aprende uma magia. */
  learnSpell: (spell: SpellId) => void;
  /** O arcano volta com os dias (o relógio do mundo chama). */
  restoreArcane: (days: number) => void;
  /** Ruínas assombradas limpas: um grimório ou um artefato (null = essas ruínas já deram o seu, ou não há o que achar). */
  searchRuins: (siteId: string) => RuinFind | null;
  /** O bando ganha um artefato (o do Lorde Necromante vencido, por exemplo): o próximo que não tem. */
  gainArtifact: (from: string) => ArtifactId | null;
  /** Depois de lançar: as cortes e os templos cobram, e o corpo marca. Devolve a marca nova (1 a 4) ou 0. */
  payForMagic: (spell: SpellId) => number;
  /** Estudar um grimório: leva dias. Devolve o motivo se não deu. */
  studyGrimoire: (spell: SpellId) => string | null;
  /** Arrancar a magia de um mago da corte preso: leva dias, e ele some depois (sem resgate). */
  learnFromCaptive: (officerId: string) => string | null;
  /** Pagar um mestre de outra terra: ouro e dias. */
  learnFromMaster: (townId: string, spell: SpellId) => string | null;
}

export const INITIAL_MAGIC: MagicState = { spells: [], arcane: 0, grimoires: [], searchedRuins: [], artifacts: [], arcaneSpent: 0, magicTalkDay: -1 };

type Setter = (partial: Partial<GameState>) => void;

export function magicSlice(set: Setter, get: () => GameState): MagicActions {
  return {
    spendArcane: (spell) => {
      const s = get();
      const cost = spellDef(spell).cost;
      if (!s.spells.includes(spell) || s.arcane < cost) return false;
      set({ arcane: s.arcane - cost });
      return true;
    },
    learnSpell: (spell) => {
      const s = get();
      if (s.spells.includes(spell)) return;
      set({ spells: [...s.spells, spell] });
    },
    restoreArcane: (days) => {
      const s = get();
      const max = arcaneMax(s.artifacts);
      if (s.spells.length === 0 || s.arcane >= max) return;
      set({ arcane: arcaneAfter(s.arcane, days, max) });
    },
    searchRuins: (siteId) => {
      const s = get();
      if (s.searchedRuins.includes(siteId)) return null;
      const spell = nextGrimoire(s.spells, s.grimoires);
      if (spell) {
        set({ searchedRuins: [...s.searchedRuins, siteId], grimoires: [...s.grimoires, spell] });
        s.chronicle(`Nas ruínas, entre os ossos, um grimório: ${spellDef(spell).name}.`, "good");
        return { spell };
      }
      set({ searchedRuins: [...s.searchedRuins, siteId] });
      const artifact = get().gainArtifact("Nas ruínas, num nicho selado");
      return artifact ? { artifact } : null;
    },
    gainArtifact: (from) => {
      const s = get();
      const artifact = nextArtifact(s.artifacts);
      if (!artifact) return null;
      set({ artifacts: [...s.artifacts, artifact] });
      const def = artifactDef(artifact);
      s.chronicle(`${from}, um artefato: ${def.name} (${def.hint}).`, "good");
      return artifact;
    },
    payForMagic: (spell) => {
      const s = get();
      const price = magicPrice(spell, s.artifacts);
      const arcaneSpent = s.arcaneSpent + markWeight(spellDef(spell).cost, s.artifacts);
      const before = s.leader.marks ?? 0;
      const marks = Math.max(before, marksFor(arcaneSpent));
      const talk = s.magicTalkDay !== s.day && price.honor + price.fear > 0;
      set({
        honor: Math.max(0, s.honor - price.honor),
        fear: Math.min(100, s.fear + price.fear),
        arcaneSpent,
        ...(talk ? { magicTalkDay: s.day } : {}),
        ...(marks > before ? { leader: { ...s.leader, marks } } : {}),
      });
      if (talk) s.chronicle("Corre a notícia da magia do Comandante: as cortes torcem o nariz, e os templos rezam contra a magia (menos Honra, mais Temor).", "bad");
      if (marks > before) s.chronicle(`Uma marca nova no corpo de ${s.leader.name}: ${MARK_TEXT[marks - 1]}.`, "bad");
      return marks > before ? marks : 0;
    },
    studyGrimoire: (spell) => {
      const s = get();
      if (!s.grimoires.includes(spell)) return "O bando não tem esse grimório.";
      const i = s.grimoires.indexOf(spell);
      set({ grimoires: [...s.grimoires.slice(0, i), ...s.grimoires.slice(i + 1)] });
      if (s.spells.includes(spell)) return null;
      const days = MAGIC.LEARN.GRIMOIRE_DAYS;
      get().learnSpell(spell);
      get().advanceTime(days);
      get().chronicle(`${s.leader.name} passou ${days} dias sobre um grimório e aprendeu ${spellDef(spell).name}.`, "good");
      return null;
    },
    learnFromCaptive: (officerId) => {
      const s = get();
      const o = s.captiveOfficers.find((x) => x.id === officerId);
      if (!o?.mage) return "Esse preso não sabe magia.";
      if (s.spells.includes(o.mage)) return "O Comandante já sabe essa magia.";
      const days = MAGIC.LEARN.COURT_DAYS;
      set({ captiveOfficers: s.captiveOfficers.filter((x) => x.id !== o.id) });
      get().learnSpell(o.mage);
      get().advanceTime(days);
      get().chronicle(`Em ${days} dias, à força, ${o.name} ensinou ${spellDef(o.mage).name} ao Comandante. Depois sumiu na noite, e ninguém pagou resgate.`);
      return null;
    },
    learnFromMaster: (townId, spell) => {
      const s = get();
      const t = s.settlements.find((x) => x.id === townId);
      if (!t || (t.kind !== "CITY" && t.kind !== "CAPITAL") || t.owner === "RUINED") return "Não há mestre de magia aqui.";
      if (!masterOffers(s.world?.culture, s.spells).includes(spell)) return "O mestre daqui não ensina essa magia.";
      const L = MAGIC.LEARN;
      if (s.gold < L.MASTER_GOLD) return `O mestre cobra ${L.MASTER_GOLD} de ouro.`;
      set({ gold: s.gold - L.MASTER_GOLD });
      get().learnSpell(spell);
      get().advanceTime(L.MASTER_DAYS);
      get().chronicle(`Em ${t.name}, um mestre ensinou ${spellDef(spell).name} ao Comandante, por ${L.MASTER_GOLD} de ouro e ${L.MASTER_DAYS} dias.`, "good");
      return null;
    },
  };
}
