import { AMBITIONS, AMBITION_SLOTS, ambitionDone, type AmbitionId, type AmbitionView } from "../game/sim/ambitions";
import { chooseHeir, fallDeathChance, griefOf, leaderAge, oldAgeChance, type FormerLeader, type Leader } from "../game/sim/legacy";
import { epilogueOf, mentioned, trimAnnals, type AnnalEntry, type BattleRecord, type LegendBook, type LegendSubject } from "../game/sim/legends";
import { storeSaga, yearsLater, type SagaEcho } from "../game/data/sagas";
import { SETTLEMENT_KIND_LABEL } from "../game/data/world";
import { nobleName } from "../game/sim/nobility";
import type { CultureId } from "../game/data/planet";
import { bandMix, cultureOf, mainCulture } from "../game/sim/culture";
import { officerTongues } from "../game/sim/language";
import { LEGACY } from "../utils/constants";
import { newId } from "../utils/id";
import type { GameState, LogTone } from "./useGameStore";

/**
 * Legado e Lendas (Marco 18): quem comanda o bando, a sucessão, as ambições e a crônica que nunca
 * se perde. Fica à parte do store principal, como a corte, a guerra e o mar.
 */

/** A notícia que para o jogo: alguém morreu, e o bando precisa de um novo chefe. */
export interface Succession {
  dead: string;
  cause: string;
  heir: string;
  origin: string;
  /** O bando ficou sem ninguém para herdar. */
  stranger: boolean;
}

export interface Epilogue {
  lines: string[];
  sagaId: string;
}

/** Quem já comandou tropas pelo bando (a crônica guarda o nome depois que ele se vai). */
export interface RollEntry {
  name: string;
  history: string[];
}

export interface LegacyState {
  leader: Leader;
  formerLeaders: FormerLeader[];
  /** Tenente escolhido em testamento. */
  heirId: string | null;
  annals: AnnalEntry[];
  battles: BattleRecord[];
  roll: Record<string, RollEntry>;
  calamitiesSlain: number;
  saltSold: number;
  ambitions: AmbitionId[];
  ambitionsDone: AmbitionId[];
  succession: Succession | null;
  epilogue: Epilogue | null;
  legendsOpen: boolean;
  /** Mundo que lembra de uma saga antiga. */
  echo: SagaEcho | null;
}

export const FOUNDER: Leader = { name: "", age: 35, since: 1, generation: 1, traits: [], wounds: 0, origin: "fundou o bando" };

export const INITIAL_LEGACY: LegacyState = {
  leader: FOUNDER,
  formerLeaders: [],
  heirId: null,
  annals: [],
  battles: [],
  roll: {},
  calamitiesSlain: 0,
  saltSold: 0,
  ambitions: [],
  ambitionsDone: [],
  succession: null,
  epilogue: null,
  legendsOpen: false,
  echo: null,
};

export interface LegacyActions {
  setHeir: (id: string | null) => void;
  pickAmbition: (id: AmbitionId) => string | null;
  dropAmbition: (id: AmbitionId) => void;
  /** O Comandante caiu em combate: as cicatrizes ficam, e às vezes ele não levanta. Devolve true se morreu. */
  commanderFell: (cause: string) => boolean;
  /** Ferido sem cair (um duelo perdido, Marco 21): mais uma cicatriz. */
  commanderScarred: (cause: string) => void;
  /** O bando passa ao herdeiro. */
  passStandard: (cause: string) => void;
  closeSuccession: () => void;
  /** O relógio do corpo e as ambições, uma vez por dia. */
  legacyDay: (days: number) => void;
  ambitionView: () => AmbitionView;
  setLegendsOpen: (open: boolean) => void;
  /** O livro da campanha em andamento. */
  legendBook: () => LegendBook;
  /** Encerra a campanha: guarda a saga e mostra o epílogo. */
  endSaga: (reason: string) => void;
}

type Setter = (partial: Partial<GameState> | ((s: GameState) => Partial<GameState>)) => void;

export function legacySlice(set: Setter, get: () => GameState, links: { note: (text: string, tone?: LogTone) => void; heirName: () => string; heirAge: () => number }): LegacyActions {
  return {
    setHeir: (id) => {
      const s = get();
      set({ heirId: id });
      const l = s.captains.find((x) => x.id === id) ?? s.lieutenants.find((x) => x.id === id);
      if (l) links.note(`${s.leader.name} escreveu o testamento: ${l.name} herdará o estandarte.`);
    },

    pickAmbition: (id) => {
      const s = get();
      if (s.ambitions.includes(id) || s.ambitionsDone.includes(id)) return "Essa ambição já está no livro.";
      if (s.ambitions.length >= AMBITION_SLOTS) return `Só ${AMBITION_SLOTS} ambições de cada vez.`;
      set({ ambitions: [...s.ambitions, id] });
      links.note(`${s.leader.name} jurou diante do bando: ${AMBITIONS[id].label.toLowerCase()}.`);
      return null;
    },

    dropAmbition: (id) => set((s) => ({ ambitions: s.ambitions.filter((x) => x !== id) })),

    commanderFell: (cause) => {
      const s = get();
      const age = leaderAge(s.leader, s.day);
      if (Math.random() < fallDeathChance(age, s.leader.wounds)) {
        get().passStandard(cause);
        return true;
      }
      set({ leader: { ...s.leader, wounds: s.leader.wounds + 1 } });
      links.note(`${s.leader.name} sobreviveu, mas a queda deixou mais uma cicatriz.`, "bad");
      return false;
    },

    commanderScarred: (cause) => {
      const s = get();
      set({ leader: { ...s.leader, wounds: s.leader.wounds + 1 } });
      links.note(`${s.leader.name} ${cause}: mais uma cicatriz.`, "bad");
    },

    passStandard: (cause) => {
      const s = get();
      const old = s.leader;
      const age = leaderAge(old, s.day);
      const former: FormerLeader = { name: old.name, generation: old.generation, from: old.since, to: s.day, age, cause, origin: old.origin, face: old.face, wounds: old.wounds, culture: old.culture };
      // Capitães (Marco 20) entram na sucessão como os tenentes: sem testamento, herda o mais leal
      const heir = chooseHeir<{ id: string; loyalty: number; name: string; traits: Leader["traits"]; culture?: CultureId; tongues?: CultureId[] }>([...s.captains, ...s.lieutenants], s.heirId);
      const captain = heir ? s.captains.find((c) => c.id === heir.id) : undefined;
      const unitId = captain ? captain.battalionIds[0] : s.lieutenants.find((l) => l.id === heir?.id)?.battalionId;
      const unit = unitId ? s.battalions.find((b) => b.id === unitId) : undefined;
      const rank = captain ? "capitão" : "tenente";
      const origin = heir ? (unit ? `${rank} de ${unit.name}` : `${rank} do bando`) : "veterano escolhido pela tropa";
      const leader: Leader = {
        name: heir ? heir.name : links.heirName(),
        age: links.heirAge(),
        since: s.day,
        generation: old.generation + 1,
        traits: heir ? heir.traits : [],
        wounds: 0,
        origin,
        face: heir?.id,
        // O herdeiro leva a terra dele; o veterano escolhido pela tropa é da gente que mais tem no bando (Marco 23)
        culture: heir ? cultureOf(heir) : mainCulture(bandMix(s.battalions)),
        // As línguas que o oficial já falava, ele fala de pai e mãe
        ...(heir ? { tongues: Object.fromEntries(officerTongues(heir).map((t) => [t, 100])) } : {}),
      };
      set({
        leader,
        formerLeaders: [...s.formerLeaders, former],
        heirId: null,
        lieutenants: s.lieutenants.filter((l) => l.id !== heir?.id).map((l) => ({ ...l, loyalty: Math.max(0, l.loyalty - griefOf(l.traits)) })),
        captains: s.captains.filter((c) => c.id !== heir?.id).map((c) => ({ ...c, loyalty: Math.max(0, c.loyalty - griefOf(c.traits)) })),
        fame: Math.round(s.fame * LEGACY.FAME_KEPT),
        honor: Math.round(s.honor + (50 - s.honor) * LEGACY.HONOR_FADE),
        campMood: Math.max(-100, s.campMood - LEGACY.MOURNING),
        succession: { dead: old.name, cause, heir: leader.name, origin, stranger: !heir },
        // A magia morre com quem a sabia; os grimórios ficam com o bando (Marco 19)
        spells: [],
        arcane: 0,
        arcaneSpent: 0,
      });
      links.note(`${old.name} morreu aos ${age} anos: ${cause}. ${leader.name} ergueu o estandarte.`, "bad");
    },

    closeSuccession: () => set({ succession: null }),

    legacyDay: (days) => {
      for (let i = 0; i < days; i++) {
        const s = get();
        if (s.succession || s.epilogue) break;
        if (Math.random() < oldAgeChance(leaderAge(s.leader, s.day))) {
          get().passStandard("de velho, na própria cama");
          break;
        }
      }
      const s = get();
      // O jogo só acaba quando o bando acaba
      if (!s.epilogue && !s.scenario && s.battalions.length === 0 && s.lieutenants.length === 0 && s.captains.length === 0 && s.expeditions.length === 0 && s.gold < LEGACY.BROKE) {
        return get().endSaga("O bando acabou: sem tropas, sem tenentes e sem ouro para recrutar.");
      }
      if (s.ambitions.length === 0) return;
      const view = get().ambitionView();
      const done = s.ambitions.filter((id) => ambitionDone(id, view));
      if (done.length === 0) return;
      const gold = done.reduce((n, id) => n + AMBITIONS[id].reward.gold, 0);
      const fame = done.reduce((n, id) => n + AMBITIONS[id].reward.fame, 0);
      set({ ambitions: s.ambitions.filter((id) => !done.includes(id)), ambitionsDone: [...s.ambitionsDone, ...done], gold: s.gold + gold, fame: Math.min(100, s.fame + fame) });
      for (const id of done) links.note(`Ambição cumprida: ${AMBITIONS[id].label.toLowerCase()} (+${AMBITIONS[id].reward.gold} de ouro).`, "good");
    },

    ambitionView: () => {
      const s = get();
      return {
        owned: s.settlements.filter((t) => t.owner === "PLAYER").length,
        towns: s.settlements.filter((t) => t.owner !== "RUINED").length,
        calamities: s.calamitiesSlain,
        saltSold: s.saltSold,
        victories: s.battles.filter((b) => b.won).length,
        visited: 1 + Object.keys(s.parked).length,
        continents: s.planet?.continents.length ?? 1,
        ships: s.fleet.length,
      };
    },

    setLegendsOpen: (open) => set({ legendsOpen: open }),

    legendBook: () => {
      const s = get();
      const people: LegendSubject[] = [
        { name: s.leader.name, role: `${s.leader.generation}º Comandante`, note: `Assumiu no dia ${s.leader.since}: ${s.leader.origin}.` },
        ...s.formerLeaders.map((f) => ({ name: f.name, role: `${f.generation}º Comandante`, note: `Do dia ${f.from} ao dia ${f.to}. Morreu aos ${f.age} anos: ${f.cause}.` })),
        ...Object.values(s.roll).map((r) => ({ name: r.name, role: "Tenente", note: r.history.join(" ") })),
      ];
      const parked = Object.values(s.parked);
      const realmName = (id: string) => s.world?.factions.find((f) => f.id === id)?.name ?? s.extraFactions.find((f) => f.id === id)?.name ?? "o reino";
      const nobles: LegendSubject[] = s.nobles.filter((n) => n.rank === "RULER" || n.fiefs.length > 0).map((n) => ({ name: nobleName(n, realmName(n.factionId)), role: n.house }));
      const realms: LegendSubject[] = [...(s.world?.factions ?? []), ...s.extraFactions].map((f) => ({ name: f.name, role: "Reino" }));
      for (const land of parked) for (const name of Object.values(land.realmNames)) realms.push({ name, role: "Reino de além-mar" });
      const towns: LegendSubject[] = [...s.settlements, ...parked.flatMap((l) => l.store.settlements)].map((t) => ({ name: t.name, role: SETTLEMENT_KIND_LABEL[t.kind] }));
      const leaders = (p: LegendSubject) => p.role.endsWith("Comandante");
      return {
        title: `A saga dos ${s.world?.bandName ?? "mercenários"}`,
        annals: s.annals,
        battles: s.battles,
        people: mentioned([...people, ...nobles], s.annals, leaders),
        realms: mentioned(realms, s.annals),
        towns: mentioned(towns, s.annals),
        before: s.world?.history ?? [],
      };
    },

    endSaga: (reason) => {
      const s = get();
      if (!s.world) return;
      const leaders = [...s.formerLeaders.map((f) => ({ name: f.name })), { name: s.leader.name }];
      const towns = s.settlements.filter((t) => t.owner === "PLAYER").map((t) => t.name);
      const lines = epilogueOf({
        bandName: s.world.bandName,
        days: s.day,
        leaders,
        fallen: s.formerLeaders,
        ambitions: s.ambitionsDone,
        victories: s.battles.filter((b) => b.won).length,
        defeats: s.battles.filter((b) => !b.won).length,
        towns,
        reason,
      });
      const home = s.planet?.continents.find((c) => c.home);
      const seed = home?.seed ?? s.world.seed;
      const book = get().legendBook();
      const id = newId();
      const echo: SagaEcho = {
        bandName: s.world.bandName,
        worldName: home?.name ?? s.world.name,
        leaders: leaders.map((l) => l.name),
        towns,
        deed: lines[lines.length - 1],
        centuries: yearsLater(seed, s.world.bandName),
      };
      storeSaga({ id, endedAt: new Date().toISOString(), seed, options: s.world.options, epilogue: lines, echo, book: { ...book, annals: trimAnnals(book.annals, LEGACY.SAGA_ANNALS) } });
      set({ epilogue: { lines, sagaId: id }, campPanel: null, succession: null });
      links.note(`Fim da saga. ${reason}`, "good");
    },
  };
}
