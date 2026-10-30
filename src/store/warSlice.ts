import { PRISONERS, type TroopType } from "../utils/constants";
import { nobleDies } from "../game/sim/kingdoms";
import { RANSOM_OF, nobleName, remember } from "../game/sim/nobility";
import type { RealmState } from "../game/sim/realm";
import type { GameState } from "./useGameStore";

/**
 * Prisioneiros e o preço da vitória (Marco 16): quem se rende, oficiais capturados e o Comandante
 * preso. Fica à parte do store principal, como a corte; `set` e `get` são os do mesmo store.
 */

/** Gente que se rendeu num combate. */
export interface CaptiveGroup {
  id: string;
  /** "soldados do Reino de Valel", "goblins"... */
  label: string;
  count: number;
  factionId: string | null;
  day: number;
  /** Quanto vale cada um de resgate (0 = ninguém paga por eles). */
  ransom: number;
  /** No que vira quem aceita lutar pelo bando (null = ninguém aceita). */
  troop: TroopType | null;
}

/** Oficial preso: vale resgate e sabe coisas. */
export interface CaptiveOfficer {
  id: string;
  name: string;
  factionId: string | null;
  /** Nobre de verdade (preso na lista dos nobres, com memória do que acontecer). */
  nobleId: string | null;
  ransom: number;
  day: number;
  questioned: boolean;
}

/** O Comandante nas mãos do inimigo: um tenente leva o bando enquanto isso. */
export interface Captivity {
  by: string;
  factionId: string | null;
  /** Quem está com ele: destruir este bando é soltá-lo à força. */
  bandId: string | null;
  acting: string;
  ransom: number;
  since: number;
}

export interface WarState {
  captives: CaptiveGroup[];
  captiveOfficers: CaptiveOfficer[];
  captivity: Captivity | null;
}

export const INITIAL_WAR: WarState = {
  captives: [],
  captiveOfficers: [],
  captivity: null,
};

export interface WarActions {
  addCaptives: (groups: readonly Omit<CaptiveGroup, "id" | "day">[]) => void;
  addCaptiveOfficer: (o: Omit<CaptiveOfficer, "id" | "day" | "questioned">) => void;
  /** Resgatar, recrutar, libertar ou executar um grupo. */
  captiveChoice: (id: string, choice: "RANSOM" | "RECRUIT" | "FREE" | "EXECUTE") => string;
  /** O mesmo para um oficial; interrogar conta o que ele sabe. */
  officerChoice: (id: string, choice: "RANSOM" | "FREE" | "EXECUTE" | "QUESTION") => string;
  /** Um dia: prisioneiros comem e alguns fogem. */
  captivesDay: () => void;
  /** O lorde de um exército caiu em campo: morre, é preso ou escapa ferido. */
  lordDown: (armyId: string) => string | null;
  beginCaptivity: (c: Omit<Captivity, "since">) => void;
  /** Soltar o Comandante: pelo resgate ou porque o bando que o prendia caiu. */
  endCaptivity: (how: "PAID" | "RESCUED") => string;
}

type Setter = (partial: Partial<GameState> | ((s: GameState) => Partial<GameState>)) => void;

/** Os dados da simulação que as funções de kingdoms.ts mexem (cópias: nada de mutar o store). */
function realmCopy(s: GameState): RealmState {
  return {
    settlements: s.settlements.map((t) => ({ ...t })),
    factions: s.factions.map((f) => ({ ...f })),
    calamities: s.calamities,
    nextCalamityDay: s.nextCalamityDay,
    gold: s.gold,
    rations: s.rations,
    iron: s.iron,
    wars: s.wars.map((w) => ({ ...w })),
    nobles: s.nobles.map((n) => ({ ...n })),
    plots: s.plots.map((p) => ({ ...p })),
    alliances: s.alliances,
    armies: s.armies.map((a) => ({ ...a })),
    courtEvents: s.courtEvents,
    revolts: s.revolts,
    extraFactions: s.extraFactions,
    honor: s.honor,
    fear: s.fear,
    liege: s.liege,
    spouseId: s.spouseId,
    wanted: s.wanted,
  };
}

const clamp100 = (v: number) => Math.max(0, Math.min(100, v));
const relate = (s: GameState, id: string | null, delta: number) => s.factions.map((f) => (f.id === id ? { ...f, relation: Math.max(-100, Math.min(100, f.relation + delta)) } : f));

/** Tenentes reagem ao que o Comandante faz com quem se rendeu (ao gosto de cada um). */
function lieutenantsReact(s: GameState, deed: "EXECUTE" | "FREE"): GameState["lieutenants"] {
  return s.lieutenants.map((l) => {
    let d = 0;
    if (deed === "EXECUTE") {
      if (l.traits.includes("HONORABLE")) d = -PRISONERS.EXECUTE_LOYALTY;
      if (l.traits.includes("BLOODTHIRSTY")) d = PRISONERS.EXECUTE_LOYALTY_CRUEL;
    } else {
      if (l.traits.includes("HONORABLE")) d = PRISONERS.FREE_LOYALTY;
      if (l.traits.includes("GREEDY")) d = -PRISONERS.FREE_LOYALTY;
    }
    return d === 0 ? l : { ...l, loyalty: clamp100(l.loyalty + d) };
  });
}

export function warSlice(set: Setter, get: () => GameState): WarActions {
  const note = (text: string, tone: "info" | "good" | "bad" = "info") => get().chronicle(text, tone);
  return {
    addCaptives: (groups) =>
      set((s) => ({
        captives: [...s.captives, ...groups.filter((g) => g.count > 0).map((g) => ({ ...g, id: crypto.randomUUID(), day: s.day }))],
      })),

    addCaptiveOfficer: (o) =>
      set((s) => ({
        captiveOfficers: [...s.captiveOfficers, { ...o, id: crypto.randomUUID(), day: s.day, questioned: false }],
      })),

    captiveChoice: (id, choice) => {
      const s = get();
      const g = s.captives.find((x) => x.id === id);
      if (!g) return "Esse grupo não está mais aqui.";
      const left = s.captives.filter((x) => x !== g);
      const P = PRISONERS;
      if (choice === "RANSOM") {
        if (g.ransom <= 0) return "Ninguém paga por eles.";
        const gold = g.ransom * g.count;
        set({ captives: left, gold: s.gold + gold, factions: relate(s, g.factionId, P.RANSOM_RELATION) });
        note(`${g.count} ${g.label} foram devolvidos a troco de ${gold} de ouro.`, "info");
        return `Resgate pago: +${gold} de ouro.`;
      }
      if (choice === "RECRUIT") {
        if (!g.troop) return "Esses aí não servem a ninguém.";
        const n = s.recruitCaptives(g.troop, g.count, g.label);
        set({ captives: get().captives.filter((x) => x !== g) });
        note(`${n} ${g.label} juraram servir ao bando. Ninguém confia neles ainda.`, "info");
        return `${n} entraram para o bando, de olho na porta.`;
      }
      if (choice === "FREE") {
        set({ captives: left, honor: clamp100(s.honor + P.FREE_HONOR), factions: relate(s, g.factionId, P.FREE_RELATION), lieutenants: lieutenantsReact(s, "FREE") });
        note(`${g.count} ${g.label} foram soltos. A notícia corre.`, "good");
        return `Soltos. Honra +${P.FREE_HONOR}.`;
      }
      set({
        captives: left,
        honor: clamp100(s.honor - P.EXECUTE_HONOR),
        fear: clamp100(s.fear + P.EXECUTE_FEAR),
        factions: relate(s, g.factionId, -P.EXECUTE_RELATION),
        lieutenants: lieutenantsReact(s, "EXECUTE"),
      });
      note(`${g.count} ${g.label} foram executados por ordem do Comandante.`, "bad");
      return `Executados. Temor +${P.EXECUTE_FEAR}, honra −${P.EXECUTE_HONOR}.`;
    },

    officerChoice: (id, choice) => {
      const s = get();
      const o = s.captiveOfficers.find((x) => x.id === id);
      if (!o) return "Esse preso não está mais aqui.";
      const left = s.captiveOfficers.filter((x) => x !== o);
      const P = PRISONERS;
      const noble = o.nobleId ? s.nobles.find((n) => n.id === o.nobleId) : undefined;
      if (choice === "QUESTION") {
        if (o.questioned) return `${o.name} já contou o que sabia.`;
        const f = s.factions.find((x) => x.id === o.factionId);
        const towns = s.settlements.filter((t) => t.owner === o.factionId);
        const garrison = towns.reduce((n, t) => n + t.garrison, 0);
        const text = f ? `${towns.length} povoado(s), ${garrison} homens de guarnição${f.plan ? `; o plano do reino: ${f.plan.reason}` : ""}. Os exércitos dele estão marcados no mapa.` : "um covil, meia dúzia de nomes e nada que valha a pena.";
        set({
          captiveOfficers: get().captiveOfficers.map((x) => (x === o ? { ...x, questioned: true } : x)),
          // A senha dos portões vale como uma carta de apresentação
          passLetters: o.factionId && !s.passLetters.includes(o.factionId) ? [...s.passLetters, o.factionId] : s.passLetters,
        });
        return `${o.name} falou: ${text}`;
      }
      if (choice === "RANSOM") {
        const gold = noble ? RANSOM_OF(noble) : o.ransom;
        set({
          captiveOfficers: left,
          gold: s.gold + gold,
          nobles: noble ? s.nobles.map((n) => (n === noble ? { ...remember(n, s.day, "foi devolvido por resgate", -5), captiveOf: undefined, at: n.fiefs[0] ?? n.at } : n)) : s.nobles,
        });
        note(`${o.name} foi devolvido por ${gold} de ouro.`, "info");
        return `Resgate pago: +${gold} de ouro.`;
      }
      if (choice === "FREE") {
        set({
          captiveOfficers: left,
          honor: clamp100(s.honor + P.FREE_OFFICER_HONOR),
          factions: relate(s, o.factionId, P.FREE_OFFICER_RELATION),
          lieutenants: lieutenantsReact(s, "FREE"),
          nobles: noble ? s.nobles.map((n) => (n === noble ? { ...remember(n, s.day, "foi solto de graça pelo Comandante", P.FREE_NOBLE_OPINION), captiveOf: undefined, at: n.fiefs[0] ?? n.at } : n)) : s.nobles,
        });
        note(`${o.name} foi solto sem resgate. Vai lembrar disso.`, "good");
        return `${o.name} foi embora de cabeça erguida. Honra +${P.FREE_OFFICER_HONOR}.`;
      }
      const base: Partial<GameState> = {
        captiveOfficers: left,
        honor: clamp100(s.honor - P.EXECUTE_OFFICER_HONOR),
        fear: clamp100(s.fear + P.EXECUTE_OFFICER_FEAR),
        factions: relate(s, o.factionId, -P.EXECUTE_OFFICER_RELATION),
        lieutenants: lieutenantsReact(s, "EXECUTE"),
      };
      if (noble && s.world) {
        const r = realmCopy(s);
        const n = r.nobles.find((x) => x.id === noble.id);
        if (n) nobleDies(r, s.world, n, s.day, "foi executado pelo Comandante");
        // Toda a casa lembra
        set({ ...base, nobles: r.nobles.map((x) => (x.factionId === noble.factionId && x.alive ? remember(x, s.day, `viu ${noble.name} ser executado`, -P.EXECUTE_NOBLE_OPINION) : x)), spouseId: r.spouseId });
      } else {
        set(base);
      }
      note(`${o.name} foi executado por ordem do Comandante.`, "bad");
      return `${o.name} não vai mais a lugar nenhum. Temor +${P.EXECUTE_OFFICER_FEAR}, honra −${P.EXECUTE_OFFICER_HONOR}.`;
    },

    captivesDay: () => {
      const s = get();
      // O Comandante às vezes acha sozinho o caminho de casa
      const c = s.captivity;
      if (c && s.day - c.since >= PRISONERS.ESCAPE_AFTER_DAYS && Math.random() < PRISONERS.COMMANDER_ESCAPE) {
        get().endCaptivity("RESCUED");
        note("O Comandante fugiu sozinho e voltou para o bando.", "good");
      }
      const total = s.captives.reduce((n, g) => n + g.count, 0);
      if (total === 0) return;
      const eat = Math.ceil(total * PRISONERS.RATIONS);
      const away = s.exposure.away && !s.campPacked;
      const captives = s.captives
        .map((g) => {
          let n = g.count;
          for (let i = 0; i < g.count; i++) if (Math.random() < PRISONERS.ESCAPE_PER_DAY) n--;
          return { ...g, count: n };
        })
        .filter((g) => g.count > 0);
      set({ captives, cargo: away ? Math.max(0, s.cargo - eat) : s.cargo, rations: away ? s.rations : Math.max(0, s.rations - eat) });
    },

    lordDown: (armyId) => {
      const s = get();
      const a = s.armies.find((x) => x.id === armyId);
      const lord = a?.lordId ? s.nobles.find((n) => n.id === a.lordId) : undefined;
      if (!a || !lord || !s.world) return null;
      const realm = s.world.factions.find((f) => f.id === lord.factionId)?.name ?? "reino";
      const name = nobleName(lord, realm);
      const roll = Math.random();
      if (roll < PRISONERS.LORD_CAPTURE) {
        set({
          armies: s.armies.map((x) => (x === a ? { ...x, lordId: null } : x)),
          nobles: s.nobles.map((n) => (n === lord ? { ...remember(n, s.day, "foi capturado pelo Comandante em batalha", -25), captiveOf: "PLAYER", armyId: undefined } : n)),
        });
        get().addCaptiveOfficer({ name, factionId: lord.factionId, nobleId: lord.id, ransom: RANSOM_OF(lord) });
        return `${name} se rendeu ferido: é prisioneiro do bando.`;
      }
      if (roll < PRISONERS.LORD_CAPTURE + PRISONERS.LORD_DEATH) {
        const r = realmCopy(s);
        const n = r.nobles.find((x) => x.id === lord.id);
        if (n) nobleDies(r, s.world, n, s.day, "caiu em batalha contra o bando");
        const army = r.armies.find((x) => x.id === armyId);
        if (army) army.lordId = null;
        set({ nobles: r.nobles, armies: r.armies, factions: r.factions, settlements: r.settlements });
        return `${name} morreu em combate.`;
      }
      return `${name} foi carregado ferido do campo.`;
    },

    beginCaptivity: (c) =>
      set((s) => ({
        captivity: { ...c, since: s.day },
        campMood: Math.max(-30, s.campMood - 12),
      })),

    endCaptivity: (how) => {
      const s = get();
      const c = s.captivity;
      if (!c) return "";
      if (how === "PAID") {
        if (s.gold < c.ransom) return `Faltam ${c.ransom - s.gold} de ouro para o resgate.`;
        set({ captivity: null, gold: s.gold - c.ransom, honor: clamp100(s.honor - 2) });
        note(`O bando pagou ${c.ransom} de ouro pelo Comandante.`, "info");
        return `O Comandante está de volta. O resgate custou ${c.ransom} de ouro.`;
      }
      set({ captivity: null, fame: clamp100(s.fame + PRISONERS.RESCUE_FAME), campMood: Math.min(30, s.campMood + 12) });
      note(`O bando tomou o Comandante de volta à força.`, "good");
      return "O Comandante foi resgatado à força!";
    },
  };
}
