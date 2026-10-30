import { COURT, GOODS, KINGDOM, REALM, REPUTE } from "../utils/constants";
import { distance, type Point } from "../utils/math";
import type { FactionDef } from "../game/data/world";
import type { RealmLog, RealmState } from "../game/sim/realm";
import {
  armyBattle,
  armyLost,
  beginSiege,
  nameOf,
  nobleDies,
  reliefArmy,
  type Alliance,
  type CourtEvent,
  type FieldArmy,
} from "../game/sim/kingdoms";
import { inRealm, ofRealm } from "../game/worldgen/names";
import { RANSOM_OF, nobleName, remember, type Noble, type Plot, type TalkTopic } from "../game/sim/nobility";
import { DOWRY, firstImpression, letterSecret, marriageBlock, questFor, topicReaction, type CourtCtx, type NobleQuest } from "../game/sim/court";
import { accessCheck, standingIn, type AccessCheck, type AccessPlace } from "../game/sim/reputation";
import type { Rumor } from "../game/sim/rumors";
import { freightOf, takeLots } from "../game/sim/trade";
import type { GameState } from "./useGameStore";

/**
 * Estado e ações da corte (Marco 15): reputação, nobres, favores, títulos, vassalagem, casamento,
 * intriga, portões da Cidade Alta e o registro dos exércitos dos reinos. Fica à parte do store
 * principal, que já é grande; `set` e `get` são os do mesmo store.
 */

/** Convocação do suserano: reunir o bando na capital até o prazo. */
export interface Summons {
  factionId: string;
  townId: string;
  deadline: number;
  why: string;
}

/** Duelo em andamento: contra quem, por quê e o que acontece depois. */
export interface DuelSpec {
  opponent: string;
  /** 1–10. */
  skill: number;
  aggressive: boolean;
  /** Nobre desafiado de verdade (a opinião e a memória dele mudam). */
  nobleId?: string;
  questId?: string;
  /** Torneio: rodada (1, 2, 3) e a bolsa. */
  tournament?: { townId: string; round: number; purse: number; bet: number };
  /** Volta para esta cena ao acabar. */
  from: "CapitalScene" | "WorldScene";
}

export interface CityRef {
  townId: string;
  name: string;
  factionId: string;
  /** Bairro onde o Comandante está e a posição dele (para o mapa). */
  district: string;
  x: number;
  y: number;
}

export interface CourtState {
  /** Fama e Temor (a Honra já existe desde o Marco 12). */
  fame: number;
  fear: number;
  nobles: Noble[];
  plots: Plot[];
  alliances: Alliance[];
  armies: FieldArmy[];
  courtEvents: CourtEvent[];
  revolts: string[];
  extraFactions: FactionDef[];
  /** Notícias na estrada, a caminho do bando. */
  rumors: Rumor[];
  rumorSeq: number;
  /** Onde o Comandante estava da última vez (as notícias o alcançam ali). */
  commanderAt: Point | null;
  /** Reinos em que o Comandante foi sagrado cavaleiro. */
  knights: string[];
  liege: string | null;
  spouseId: string | null;
  /** Mandado de prisão por reino. */
  wanted: Record<string, number>;
  /** Cartas de apresentação por reino (cada uma abre um portão uma vez). */
  passLetters: string[];
  /** Portões abertos: "<povoado>:<lugar>" → até que dia vale. */
  passes: Record<string, number>;
  disguiseUntil: number;
  /** Audiência marcada na sala do trono: reino → dia. */
  audiences: Record<string, number>;
  quests: NobleQuest[];
  summons: Summons | null;
  /** Em que capital o Comandante está (null = no mundo) e o duelo em andamento. */
  city: CityRef | null;
  duel: DuelSpec | null;
}

export const INITIAL_COURT: CourtState = {
  fame: 5,
  fear: 0,
  nobles: [],
  plots: [],
  alliances: [],
  armies: [],
  courtEvents: [],
  revolts: [],
  extraFactions: [],
  rumors: [],
  rumorSeq: 0,
  commanderAt: null,
  knights: [],
  liege: null,
  spouseId: null,
  wanted: {},
  passLetters: [],
  passes: {},
  disguiseUntil: 0,
  audiences: {},
  quests: [],
  summons: null,
  city: null,
  duel: null,
};

export interface CourtActions {
  addFame: (n: number) => void;
  addFear: (n: number) => void;
  setCity: (city: CityRef | null) => void;
  setDuel: (duel: DuelSpec | null) => void;
  /** Como o Comandante é visto neste reino. */
  access: (place: AccessPlace, townId: string) => AccessCheck;
  hasPass: (townId: string, place: AccessPlace) => boolean;
  /** Tenta passar por um portão: devolve o que o guarda disse e se abriu. */
  passGate: (townId: string, place: AccessPlace, how: "RANK" | "TOLL" | "BRIBE" | "LETTER" | "INTIMIDATE" | "DISGUISE") => { ok: boolean; text: string };
  meetNoble: (id: string) => string;
  talkNoble: (id: string, topic: TalkTopic) => string;
  giftNoble: (id: string) => string;
  newQuest: (id: string) => NobleQuest | null;
  acceptQuest: (q: NobleQuest) => void;
  /** Volta a quem pediu: paga e lembra. */
  claimQuest: (id: string) => string;
  deliverLetter: (id: string) => string;
  readLetter: (id: string) => string;
  /** Copiar as cartas da escrivaninha de um palácio (favor de espionagem). */
  copyLetters: (nobleId: string) => string;
  /** Tira um nobre preso da masmorra: resgate pago ou pelos esgotos. */
  ransomNoble: (id: string) => string;
  breakOut: (id: string) => string;
  poisonNoble: (id: string) => string;
  insultNoble: (id: string) => string;
  /** Fim de um duelo (`won`: o Comandante venceu). */
  duelOver: (won: boolean) => string;
  /** Marcar audiência com o Camareiro. */
  askAudience: (factionId: string) => string;
  knightMe: (factionId: string) => string;
  swearFealty: (factionId: string) => string;
  renounceFealty: () => string;
  askPardon: (factionId: string) => string;
  askLetter: (nobleId: string) => string;
  marryNoble: (id: string) => string;
  joinPlot: (id: string) => string;
  exposePlot: (id: string) => string;
  blackmailPlot: (id: string) => string;
  buyDisguise: () => boolean;
  buyForgedLetter: (factionId: string) => boolean;
  arrest: (factionId: string, why: string) => string;
  /** Exércitos dos reinos (a cena avisa o que acontece no mapa). */
  armySpawned: (id: string, bandId: string) => void;
  armyArrived: (id: string) => void;
  armyDestroyed: (id: string, byPlayer: boolean, at: Point) => void;
  armyDone: (id: string, size?: number) => void;
  armiesClash: (winnerId: string | null, loserId: string | null, at: Point) => void;
  /** Cidade cercada pede socorro: o reino manda um exército (Marco 16). */
  callRelief: (townId: string) => void;
  revoltHandled: (id: string) => void;
  /** Notícias de longe mais perto (taverna, arauto, mensageiro): chegam agora. `where`: "em Valelos". */
  hearNews: (at: Point, where: string, radius: number) => number;
}

type Setter = (partial: Partial<GameState>) => void;

const clamp100 = (v: number) => Math.max(0, Math.min(100, v));

/** Os dados da simulação que as funções de kingdoms.ts mexem (cópias: nada de mutar o store). */
function realmOf(s: GameState): RealmState {
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

function commitRealm(set: Setter, get: () => GameState, r: RealmState, logs: readonly RealmLog[]): void {
  const s = get();
  let rumors = s.rumors;
  let seq = s.rumorSeq;
  set({
    settlements: r.settlements,
    factions: r.factions,
    wars: r.wars,
    nobles: r.nobles,
    plots: r.plots,
    alliances: r.alliances,
    armies: r.armies,
    courtEvents: r.courtEvents,
    revolts: r.revolts,
    extraFactions: r.extraFactions,
    spouseId: r.spouseId,
    wanted: r.wanted,
  });
  for (const l of logs) {
    if (l.where) rumors = [...rumors, { id: ++seq, day: s.day, x: l.where.x, y: l.where.y, text: l.text, tone: l.tone }];
    else s.chronicle(l.text, l.tone);
  }
  set({ rumors, rumorSeq: seq });
}

const ctxOf = (s: GameState): CourtCtx => ({
  day: s.day,
  nobles: s.nobles,
  plots: s.plots,
  realm: (id) => s.world?.factions.find((f) => f.id === id)?.name ?? "reino",
});

const realmName = (s: GameState, id: string) => s.world?.factions.find((f) => f.id === id)?.name ?? "reino";
const nameOfNoble = (s: GameState, n: Noble) => nobleName(n, realmName(s, n.factionId));
const repCtx = (s: GameState) => s;

/** Muda um nobre e guarda a lembrança. */
function touch(s: GameState, id: string, text: string, delta: number): Noble[] {
  return s.nobles.map((n) => (n.id === id ? remember(n, s.day, text, delta) : n));
}

const relate = (s: GameState, id: string, delta: number) => s.factions.map((f) => (f.id === id ? { ...f, relation: Math.max(-100, Math.min(100, f.relation + delta)) } : f));

export function courtSlice(set: Setter, get: () => GameState): CourtActions {
  return {
    addFame: (n) => set({ fame: clamp100(get().fame + n) }),
    addFear: (n) => set({ fear: clamp100(get().fear + n) }),
    setCity: (city) => set({ city }),
    setDuel: (duel) => set({ duel }),

    access: (place, townId) => {
      const s = get();
      const t = s.settlements.find((x) => x.id === townId);
      const fid = t?.owner ?? "";
      const now = s.day + s.dayProgress;
      return accessCheck({ ...repCtx(s), passLetters: s.passLetters, disguised: s.disguiseUntil > now, playerOwned: fid === "PLAYER" }, place, fid);
    },

    hasPass: (townId, place) => (get().passes[`${townId}:${place}`] ?? -1) >= get().day,

    passGate: (townId, place, how) => {
      const s = get();
      const t = s.settlements.find((x) => x.id === townId);
      const fid = t?.owner ?? "";
      const grant = (extra: Partial<GameState> = {}) => set({ passes: { ...get().passes, [`${townId}:${place}`]: s.day }, ...extra });
      switch (how) {
        case "RANK":
          grant();
          return { ok: true, text: "Pode passar." };
        case "TOLL": {
          if (s.gold < COURT.TOLL) return { ok: false, text: `São ${COURT.TOLL} de ouro de portagem. Quem não paga, volta.` };
          grant({ gold: s.gold - COURT.TOLL });
          return { ok: true, text: `Portagem paga (${COURT.TOLL} de ouro). Ande na linha lá dentro.` };
        }
        case "BRIBE": {
          const cost = COURT.BRIBE[place] ?? COURT.BRIBE.NOBLE;
          if (s.gold < cost) return { ok: false, text: "Isso aí não compra nem meia hora do meu tempo." };
          if (Math.random() < COURT.BRIBE_CHANCE) {
            grant({ gold: s.gold - cost, honor: clamp100(s.honor - 1) });
            return { ok: true, text: `O guarda olha para o outro lado e guarda as ${cost} moedas. "Hoje eu não vi ninguém."` };
          }
          set({ gold: s.gold - Math.round(cost / 2), factions: relate(s, fid, -3) });
          return { ok: false, text: `O guarda embolsa ${Math.round(cost / 2)} de ouro e ainda ri: "Agradeço a doação. Agora suma, antes que eu chame o sargento."` };
        }
        case "LETTER": {
          if (!s.passLetters.includes(fid)) return { ok: false, text: "Que carta?" };
          const i = s.passLetters.indexOf(fid);
          grant({ passLetters: s.passLetters.filter((_, k) => k !== i) });
          return { ok: true, text: "O sargento lê o selo e endireita as costas. \"Perdão, sor. Passe.\"" };
        }
        case "INTIMIDATE":
          grant({ fear: clamp100(s.fear + REPUTE.FEAR.INTIMIDATE), honor: clamp100(s.honor - 1), factions: relate(s, fid, -3) });
          return { ok: true, text: "O guarda engole em seco e abre caminho. A história vai correr." };
        case "DISGUISE": {
          if (s.disguiseUntil <= s.day + s.dayProgress) return { ok: false, text: "Com essa cara de soldado? Nem tente." };
          if (Math.random() < 0.8) {
            grant();
            return { ok: true, text: "Na libré de criado, ninguém olha para o Comandante duas vezes." };
          }
          return { ok: false, text: get().arrest(fid, "foi desmascarado num portão") };
        }
      }
    },

    meetNoble: (id) => {
      const s = get();
      const n = s.nobles.find((x) => x.id === id);
      if (!n) return "...";
      const first = firstImpression(n, s);
      set({ nobles: s.nobles.map((x) => (x.id === id ? { ...remember(x, s.day, "conheceu o Comandante", first.delta), met: true } : x)) });
      return first.line;
    },

    talkNoble: (id, topic) => {
      const s = get();
      const n = s.nobles.find((x) => x.id === id);
      if (!n) return "...";
      if (n.lastTalk === s.day) return "Por hoje já falamos o bastante, Comandante.";
      const r = topicReaction(n, topic);
      set({ nobles: s.nobles.map((x) => (x.id === id ? { ...x, opinion: clamp(x.opinion + r.delta), lastTalk: s.day } : x)) });
      return `${r.line} (opinião ${r.delta > 0 ? "+" : ""}${r.delta})`;
    },

    giftNoble: (id) => {
      const s = get();
      const n = s.nobles.find((x) => x.id === id);
      if (!n) return "...";
      if (n.lastGift !== undefined && s.day - n.lastGift < COURT.GIFT_COOLDOWN) return "Ainda agradeço o último presente. Não exagere, ou vão dizer que me comprou.";
      const good = n.likes;
      const label = GOODS[good].label.toLowerCase();
      const fromFreight = freightOf(s.freight, good) > 0;
      const fromDepot = (s.depot[good] ?? 0) > 0;
      if (!fromFreight && !fromDepot) {
        // Sem o que ele gosta: ouro resolve, mas vale menos
        if (s.gold < 40) return `Quem gosta de ${label} percebe quando alguém chega de mãos vazias.`;
        set({ gold: s.gold - 40, nobles: s.nobles.map((x) => (x.id === id ? { ...remember(x, s.day, "recebeu um presente em ouro", Math.round(COURT.GIFT_OPINION / 2)), lastGift: s.day } : x)) });
        return `Ouro... prático. Da próxima vez, traga ${label}. (40 de ouro, opinião +${Math.round(COURT.GIFT_OPINION / 2)})`;
      }
      set({
        freight: fromFreight ? takeLots(s.freight, good, 1).lots : s.freight,
        depot: fromFreight ? s.depot : { ...s.depot, [good]: (s.depot[good] ?? 0) - 1 },
        nobles: s.nobles.map((x) => (x.id === id ? { ...remember(x, s.day, `recebeu ${label} de presente`, COURT.GIFT_OPINION), lastGift: s.day } : x)),
      });
      return `${GOODS[good].label}! Como soube? Este é um presente de quem entende. (opinião +${COURT.GIFT_OPINION})`;
    },

    newQuest: (id) => {
      const s = get();
      const n = s.nobles.find((x) => x.id === id);
      if (!n) return null;
      return questFor(n, ctxOf(s), 1 + s.fame / 100);
    },

    acceptQuest: (q) => {
      const s = get();
      set({ quests: [...s.quests, q] });
      s.chronicle(`Favor aceito: ${q.title}.`);
    },

    claimQuest: (id) => {
      const s = get();
      const q = s.quests.find((x) => x.id === id);
      if (!q) return "...";
      if (q.kind === "GIFT" && q.good && q.qty) {
        const have = freightOf(s.freight, q.good) + (s.depot[q.good] ?? 0);
        if (have < q.qty) return `Faltam ${GOODS[q.good].label.toLowerCase()}: eu pedi ${q.qty}.`;
        const fromFreight = Math.min(q.qty, freightOf(s.freight, q.good));
        set({ freight: takeLots(s.freight, q.good, fromFreight).lots, depot: { ...s.depot, [q.good]: (s.depot[q.good] ?? 0) - (q.qty - fromFreight) } });
      } else if (!q.ready) return "Ainda não está feito, Comandante.";
      const after = get();
      set({
        gold: after.gold + q.rewardGold,
        quests: after.quests.filter((x) => x.id !== id),
        nobles: touch(after, q.giverId, `cumpriu um favor: ${q.title}`, q.rewardOpinion),
      });
      after.chronicle(`Favor cumprido: ${q.title} (+${q.rewardGold} de ouro).`, "good");
      return `Muito bem. Aqui está o que combinamos: ${q.rewardGold} de ouro. Não me esquecerei. (opinião +${q.rewardOpinion})`;
    },

    deliverLetter: (id) => {
      const s = get();
      const q = s.quests.find((x) => x.id === id);
      if (!q) return "...";
      set({ quests: s.quests.map((x) => (x.id === id ? { ...x, ready: true } : x)) });
      const target = s.nobles.find((n) => n.id === q.targetId);
      return q.read ? `${target?.name ?? "O destinatário"} olha o lacre refeito e fica um instante calado. "Isso foi aberto?"` : `${target?.name ?? "O destinatário"} quebra o lacre, lê e dobra o papel. "Diga a quem o mandou que recebi."`;
    },

    readLetter: (id) => {
      const s = get();
      const q = s.quests.find((x) => x.id === id);
      if (!q) return "...";
      const secret = letterSecret(q, ctxOf(s));
      set({
        honor: clamp100(s.honor - 2),
        quests: s.quests.map((x) => (x.id === id ? { ...x, read: true } : x)),
        plots: s.plots.map((p) => (p.id === secret.plot?.id ? { ...p, known: true } : p)),
      });
      if (secret.plot) s.chronicle(`O Comandante descobriu uma conspiração ${inRealm(realmName(s, secret.plot.factionId))}.`, "good");
      return `${secret.text} (honra −2)`;
    },

    copyLetters: (nobleId) => {
      const s = get();
      const q = s.quests.find((x) => x.kind === "SPY" && x.targetId === nobleId);
      const plot = s.plots.find((p) => p.leaderId === nobleId || p.members.includes(nobleId));
      set({
        quests: s.quests.map((x) => (x === q ? { ...x, ready: true } : x)),
        plots: s.plots.map((p) => (p === plot ? { ...p, known: true } : p)),
      });
      if (plot) return "Entre as contas e as cartas da família, uma lista de nomes e uma data: há uma conspiração contra a coroa!";
      return q ? "As cartas falam de dívidas, de uma amante e de quanto ele odeia quem o mandou vigiar. Serve." : "Papéis de família. Nada que interesse.";
    },

    ransomNoble: (id) => {
      const s = get();
      const n = s.nobles.find((x) => x.id === id);
      if (!n?.captiveOf) return "Quem?";
      const cost = RANSOM_OF(n);
      if (s.gold < cost) return `O resgate é de ${cost} de ouro. Volte com ele.`;
      const home = s.factions.find((f) => f.id === n.factionId);
      set({
        gold: s.gold - cost,
        nobles: s.nobles.map((x) => (x.id === id ? { ...remember(x, s.day, "foi resgatado pelo Comandante", 45), captiveOf: undefined, at: x.fiefs[0] ?? home?.seatId ?? x.at } : x)),
        factions: relate(s, n.factionId, 20),
      });
      const c = get().activeContract?.contract;
      if (c?.kind === "RANSOM" && c.nobleId === id) get().finishContract(true, `${n.name} está livre`);
      s.chronicle(`${nameOfNoble(s, n)} foi libertado: o Comandante pagou o resgate de ${cost} de ouro.`, "good");
      return `O carcereiro conta as moedas e abre a cela. ${n.name} sai para a luz.`;
    },

    breakOut: (id) => {
      const s = get();
      const n = s.nobles.find((x) => x.id === id);
      if (!n?.captiveOf) return "...";
      const captor = n.captiveOf;
      const home = s.factions.find((f) => f.id === n.factionId);
      set({
        nobles: s.nobles.map((x) => (x.id === id ? { ...remember(x, s.day, "foi tirado da masmorra pelo Comandante", 50), captiveOf: undefined, at: x.fiefs[0] ?? home?.seatId ?? x.at } : x)),
        quests: s.quests.map((q) => (q.kind === "RESCUE" && q.targetId === id ? { ...q, ready: true } : q)),
        factions: relate(s, captor, -15).map((f) => (f.id === n.factionId ? { ...f, relation: Math.min(100, f.relation + 15) } : f)),
      });
      const c = get().activeContract?.contract;
      if (c?.kind === "RANSOM" && c.nobleId === id) get().finishContract(true, `${n.name} fugiu da masmorra`);
      s.chronicle(`O Comandante tirou ${nameOfNoble(s, n)} da masmorra.`, "good");
      return `A grade cede. ${n.name} desaparece pelos esgotos, jurando nunca esquecer.`;
    },

    poisonNoble: (id) => {
      const s = get();
      const n = s.nobles.find((x) => x.id === id);
      if (!n?.alive || !s.world) return "...";
      const r = realmOf(s);
      const target = r.nobles.find((x) => x.id === id) as Noble;
      const logs = nobleDies(r, s.world, target, s.day, "morreu de repente, com a boca roxa");
      const q = s.quests.find((x) => x.kind === "POISON" && x.targetId === id);
      const found = Math.random() < 0.3;
      if (found) r.wanted = { ...r.wanted, [n.factionId]: 100 };
      commitRealm(set, get, r, logs);
      const after = get();
      set({
        honor: clamp100(after.honor - 25),
        fear: clamp100(after.fear + REPUTE.FEAR.ASSASSINATE),
        quests: after.quests.map((x) => (x === q ? { ...x, ready: true } : x)),
        factions: found ? relate(after, n.factionId, -40) : after.factions,
      });
      if (found) after.chronicle(`Um criado viu o Comandante perto do cálice de ${nameOf(n, s.world)}: há um mandado de prisão no ${realmName(s, n.factionId)}.`, "bad");
      return found ? "O frasco funciona. Mas um copeiro viu tudo e sai correndo pelo corredor." : "Ninguém viu nada. O frasco afunda no bolso, leve demais para o que fez. (honra −25)";
    },

    insultNoble: (id) => {
      const s = get();
      const n = s.nobles.find((x) => x.id === id);
      if (!n) return "...";
      const proud = n.traits.includes("BRAVE") || n.traits.includes("CRUEL") || n.traits.includes("HONORABLE");
      set({ nobles: touch(s, id, "foi insultado pelo Comandante diante da corte", -25), fear: clamp100(s.fear + 1) });
      return proud ? "Como ousa?! Isto se resolve na Liça, com aço!" : "Guardas! ...Não. Lembrarei disto, Comandante.";
    },

    duelOver: (won) => {
      const s = get();
      const d = s.duel;
      if (!d) return "";
      let text = won ? `${d.opponent} cai de joelhos na areia. A multidão grita o nome do bando.` : `A lâmina de ${d.opponent} para na garganta do Comandante. A multidão vaia.`;
      const patch: Partial<GameState> = { fame: clamp100(s.fame + (won ? REPUTE.FAME.DUEL : -1)) };
      if (d.nobleId) patch.nobles = touch(s, d.nobleId, won ? "perdeu um duelo para o Comandante" : "venceu o Comandante em duelo", won ? -15 : 10);
      if (d.questId && won) patch.quests = s.quests.map((q) => (q.id === d.questId ? { ...q, ready: true } : q));
      if (d.tournament) {
        const t = d.tournament;
        if (!won) {
          text = `${text} O torneio acabou para o Comandante na ${t.round}ª rodada.${t.bet > 0 ? ` A aposta de ${t.bet} de ouro foi perdida.` : ""}`;
        } else if (t.round >= 3) {
          const prize = t.purse + t.bet * 3;
          patch.gold = s.gold + prize;
          patch.fame = clamp100(s.fame + REPUTE.FAME.TOURNAMENT);
          text = `CAMPEÃO! ${d.opponent} se rende e o Comandante ergue a coroa de louros: ${prize} de ouro${t.bet > 0 ? " (bolsa e aposta)" : ""}.`;
          s.chronicle(`O Comandante venceu o torneio de ${s.settlements.find((x) => x.id === t.townId)?.name}: +${prize} de ouro.`, "good");
          patch.factions = relate(s, s.settlements.find((x) => x.id === t.townId)?.owner ?? "", 8);
        }
      }
      set(patch);
      return text;
    },

    askAudience: (factionId) => {
      const s = get();
      const st = standingIn(s, factionId);
      if (st < 1) return "Audiência? Para um forasteiro? Faça o seu nome no reino e volte.";
      if (s.honor < 20 && st < 4) return "A Sala do Trono não recebe quem não cumpre a palavra.";
      // Quem é conhecido espera até amanhã; quem é respeitado entra hoje
      const when = st >= 2 ? s.day : s.day + 1;
      set({ audiences: { ...s.audiences, [factionId]: when } });
      return when === s.day ? "Sua Majestade recebe até o meio-dia. A porta da Torre de Menagem está aberta para o senhor hoje." : "Amanhã de manhã, então. Venha limpo e não toque em nada.";
    },

    knightMe: (factionId) => {
      const s = get();
      const f = s.factions.find((x) => x.id === factionId);
      if (!f) return "...";
      if (s.knights.includes(factionId)) return "O senhor já é cavaleiro deste reino.";
      const K = COURT.KNIGHT;
      if (s.fame < K.FAME) return `Ainda não ouvi falar o bastante dos seus feitos (Fama ${K.FAME}).`;
      if (f.relation < K.RELATION) return `Faça mais pelo reino antes de pedir isso (relação ${K.RELATION}).`;
      if (s.honor < K.HONOR) return `A espada do reino não toca ombro de quem não tem honra (Honra ${K.HONOR}).`;
      if (s.gold < K.GOLD) return `A cerimônia custa ${K.GOLD} de ouro. Volte com ele.`;
      set({ gold: s.gold - K.GOLD, knights: [...s.knights, factionId], fame: clamp100(s.fame + 4), factions: relate(s, factionId, 5) });
      s.chronicle(`O Comandante foi sagrado cavaleiro ${ofRealm(realmName(s, factionId))}.`, "good");
      return "A espada toca os dois ombros. \"Levante-se, sor. De hoje em diante, a Ponte do Castelo desce para o senhor.\"";
    },

    swearFealty: (factionId) => {
      const s = get();
      const f = s.factions.find((x) => x.id === factionId);
      if (!f) return "...";
      if (s.liege) return "O senhor já jurou fidelidade a outra coroa.";
      if (!s.knights.includes(factionId)) return "Só um cavaleiro do reino pode jurar como vassalo.";
      const V = COURT.VASSAL;
      if (f.relation < V.RELATION || s.fame < V.FAME) return `Ainda não confio no senhor o bastante (relação ${V.RELATION}, Fama ${V.FAME}).`;
      // O feudo: a aldeia da coroa mais perto da capital
      const seat = s.settlements.find((t) => t.id === f.seatId);
      const fief = s.settlements.filter((t) => t.owner === factionId && t.kind === "VILLAGE" && t.id !== f.seatId).sort((a, b) => (seat ? distance(a, seat) - distance(b, seat) : 0))[0];
      const enemies = s.wars.filter((w) => w.peace === undefined && (w.a === factionId || w.b === factionId)).map((w) => (w.a === factionId ? w.b : w.a));
      set({
        liege: factionId,
        settlements: fief ? s.settlements.map((t) => (t.id === fief.id ? { ...t, owner: "PLAYER", taxRate: 1 as const } : t)) : s.settlements,
        nobles: fief ? s.nobles.map((n) => ({ ...n, fiefs: n.fiefs.filter((id) => id !== fief.id) })) : s.nobles,
        factions: s.factions.map((x) => (x.id === factionId ? { ...x, relation: Math.min(100, x.relation + 15), atWar: false } : enemies.includes(x.id) ? { ...x, atWar: true, relation: Math.min(x.relation, REALM.WAR_BELOW) } : x)),
      });
      s.chronicle(`O Comandante jurou fidelidade ao ${realmName(s, factionId)}${fief ? ` e recebeu ${fief.name} em feudo` : ""}. Os inimigos do reino agora são os dele.`, "good");
      return `De joelhos, com as mãos entre as da coroa. "${fief ? `${fief.name} é sua. ` : ""}Quando eu chamar, venha com a sua gente."`;
    },

    renounceFealty: () => {
      const s = get();
      if (!s.liege) return "...";
      const fid = s.liege;
      set({ liege: null, honor: clamp100(s.honor - 15), factions: relate(s, fid, -40), summons: null });
      s.chronicle(`O Comandante renegou o juramento ao ${realmName(s, fid)}.`, "bad");
      return "Palavras pesadas ecoam na sala. Ninguém acompanha o Comandante até a porta.";
    },

    askPardon: (factionId) => {
      const s = get();
      const cost = 250;
      if (s.gold < cost) return `Um perdão real custa ${cost} de ouro.`;
      if (!s.wanted[factionId]) return "Não há nada a perdoar. Por enquanto.";
      const wanted = { ...s.wanted };
      delete wanted[factionId];
      set({ gold: s.gold - cost, wanted });
      return "O escrivão risca o nome do Comandante. Cuidado: o reino só perdoa uma vez cada coisa.";
    },

    askLetter: (nobleId) => {
      const s = get();
      const n = s.nobles.find((x) => x.id === nobleId);
      if (!n) return "...";
      if (n.opinion < COURT.OPINION_FAVOR + 10) return "Pôr o meu selo no seu nome? Ainda não, Comandante.";
      if (s.passLetters.includes(n.factionId)) return "O senhor já tem uma carta minha. Use-a.";
      set({ passLetters: [...s.passLetters, n.factionId] });
      return "Tome: uma carta de apresentação com o meu selo. Abre um portão da Cidade Alta, uma vez.";
    },

    marryNoble: (id) => {
      const s = get();
      const n = s.nobles.find((x) => x.id === id);
      if (!n) return "...";
      const block = marriageBlock(n, { spouseId: s.spouseId, standing: standingIn(s, n.factionId), gold: s.gold });
      if (block) return block;
      if (n.opinion < COURT.OPINION_MARRY) return "O senhor é gentil. Mas ainda não o conheço o bastante para isso.";
      if (s.gold < DOWRY) return `A família pede ${DOWRY} de ouro de dote.`;
      set({
        gold: s.gold - DOWRY,
        spouseId: id,
        nobles: s.nobles.map((x) => (x.id === id ? { ...remember(x, s.day, "casou com o Comandante", 40), spouseId: "PLAYER" } : x)),
        factions: relate(s, n.factionId, 20),
      });
      s.chronicle(`O Comandante casou com ${nameOfNoble(s, n)}.`, "good");
      return `Na catedral, diante dos deuses e da corte, ${n.name} diz sim. As casas agora são uma só.`;
    },

    joinPlot: (id) => {
      const s = get();
      const p = s.plots.find((x) => x.id === id);
      if (!p) return "...";
      set({ plots: s.plots.map((x) => (x.id === id ? { ...x, joined: true, strength: x.strength + 15 } : x)), nobles: touch(s, p.leaderId, "entrou na conspiração", 20), honor: clamp100(s.honor - 8) });
      s.chronicle(`O Comandante entrou numa conspiração contra a coroa ${ofRealm(realmName(s, p.factionId))}.`, "bad");
      return "Bem-vindo, Comandante. Quando chegar a hora, ninguém vai se esquecer de quem esteve do lado certo.";
    },

    exposePlot: (id) => {
      const s = get();
      const p = s.plots.find((x) => x.id === id);
      if (!p) return "...";
      const leader = s.nobles.find((n) => n.id === p.leaderId);
      const ruler = s.nobles.find((n) => n.alive && n.factionId === p.factionId && n.rank === "RULER");
      set({
        plots: s.plots.filter((x) => x.id !== id),
        nobles: s.nobles.map((n) => {
          if (n.id === p.leaderId) return { ...remember(n, s.day, "foi denunciado pelo Comandante", -60), captiveOf: p.factionId, loyalty: 0, at: s.factions.find((f) => f.id === p.factionId)?.seatId ?? n.at };
          if (p.members.includes(n.id)) return { ...remember(n, s.day, "teve o nome entregue pelo Comandante", -40), loyalty: Math.min(n.loyalty, 30) };
          if (n.id === ruler?.id) return remember(n, s.day, "salvou o trono de uma conspiração", 40);
          return n;
        }),
        factions: relate(s, p.factionId, 30),
        gold: s.gold + 200,
        fame: clamp100(s.fame + 5),
      });
      s.chronicle(`O Comandante denunciou ${leader ? nameOfNoble(s, leader) : "um traidor"}: a conspiração ${inRealm(realmName(s, p.factionId))} acabou na masmorra.`, "good");
      return "A guarda sai antes do fim da tarde. Na manhã seguinte, a coroa manda 200 de ouro e um olhar de gratidão.";
    },

    blackmailPlot: (id) => {
      const s = get();
      const p = s.plots.find((x) => x.id === id);
      if (!p) return "...";
      set({ gold: s.gold + 150, honor: clamp100(s.honor - 5), nobles: touch(s, p.leaderId, "foi chantageado pelo Comandante", -30) });
      return "Sem uma palavra, a bolsa de 150 de ouro desliza pela mesa. O olhar diz o resto: isto não acaba aqui.";
    },

    buyDisguise: () => {
      const s = get();
      if (s.gold < COURT.DISGUISE_GOLD) return false;
      set({ gold: s.gold - COURT.DISGUISE_GOLD, disguiseUntil: s.day + s.dayProgress + COURT.DISGUISE_DAYS });
      return true;
    },

    buyForgedLetter: (factionId) => {
      const s = get();
      if (s.gold < COURT.FORGED_LETTER_GOLD) return false;
      set({ gold: s.gold - COURT.FORGED_LETTER_GOLD, passLetters: [...s.passLetters, factionId], honor: clamp100(s.honor - 2) });
      return true;
    },

    arrest: (factionId, why) => {
      const s = get();
      const fine = Math.min(s.gold, COURT.FINE);
      set({ gold: s.gold - fine, factions: relate(s, factionId, -8), honor: clamp100(s.honor - 3), disguiseUntil: 0, passes: {} });
      s.chronicle(`O Comandante ${why} e foi preso em ${s.city?.name ?? "a capital"}: ${fine} de ouro de multa e ${COURT.JAIL_DAYS} dias de masmorra.`, "bad");
      return `Mãos pesadas agarram o Comandante. ${fine} de ouro de multa e ${COURT.JAIL_DAYS} dias a pão e água.`;
    },

    armySpawned: (id, bandId) => set({ armies: get().armies.map((a) => (a.id === id ? { ...a, bandId } : a)) }),

    armyArrived: (id) => {
      const s = get();
      if (!s.world) return;
      const r = realmOf(s);
      const a = r.armies.find((x) => x.id === id);
      if (!a) return;
      commitRealm(set, get, r, beginSiege(r, s.world, a, s.day));
    },

    armyDestroyed: (id, byPlayer, at) => {
      const s = get();
      if (!s.world) return;
      const r = realmOf(s);
      const a = r.armies.find((x) => x.id === id);
      if (!a) return;
      const lord = s.nobles.find((n) => n.id === a.lordId);
      // O lorde que caiu em campo já teve o destino resolvido (ver lordDown)
      const logs = armyLost(r, s.world, a, byPlayer ? "PLAYER" : null, s.day, at);
      if (byPlayer && lord) {
        const i = r.nobles.findIndex((n) => n.id === lord.id);
        if (i >= 0) r.nobles[i] = remember(r.nobles[i], s.day, "teve o exército destruído pelo Comandante", -35);
      }
      commitRealm(set, get, r, logs);
      // Lorde capturado pelo bando: entra na lista dos prisioneiros
      const taken = lord ? get().nobles.find((n) => n.id === lord.id && n.captiveOf === "PLAYER") : undefined;
      if (taken && !get().captiveOfficers.some((o) => o.nobleId === taken.id)) {
        get().addCaptiveOfficer({ name: nameOfNoble(get(), taken), factionId: taken.factionId, nobleId: taken.id, ransom: RANSOM_OF(taken) });
      }
      const c = get().activeContract?.contract;
      if (c?.armyId === id) get().finishContract(true, "o exército inimigo não existe mais");
    },

    armyDone: (id, size) => {
      const s = get();
      const a = s.armies.find((x) => x.id === id);
      if (!a) return;
      const lord = a.lordId ? s.nobles.find((n) => n.id === a.lordId) : undefined;
      const f = s.factions.find((x) => x.id === a.factionId);
      set({
        armies: s.armies.filter((x) => x.id !== id),
        nobles: lord ? s.nobles.map((n) => (n.id === lord.id ? { ...n, armyId: undefined, at: n.fiefs[0] ?? f?.seatId ?? n.at } : n)) : s.nobles,
        settlements: s.settlements.map((t) => (t.id === a.fromId && t.owner === a.factionId && size ? { ...t, garrison: Math.min(REALM.BASE_GARRISON[t.kind] * 2, t.garrison + Math.round(size / 3)) } : t)),
      });
      const c = get().activeContract?.contract;
      if (c?.armyId === id) get().finishContract(a.outcome !== "TOOK", a.outcome === "TOOK" ? "a cidade caiu" : "o exército recuou");
    },

    callRelief: (townId) => {
      const s = get();
      if (!s.world) return;
      const r = realmOf(s);
      commitRealm(set, get, r, reliefArmy(r, s.world, s.day, townId));
    },

    armiesClash: (winnerId, loserId, at) => {
      const s = get();
      if (!s.world) return;
      const r = realmOf(s);
      const w = r.armies.find((x) => x.id === winnerId) ?? null;
      const l = r.armies.find((x) => x.id === loserId) ?? null;
      commitRealm(set, get, r, armyBattle(r, s.world, w, l, s.day, at));
      // Outro exército fez o serviço do contrato: o cliente paga do mesmo jeito (o inimigo não existe mais)
      const c = get().activeContract?.contract;
      if (loserId && c?.armyId === loserId) get().finishContract(true, "o exército inimigo foi destroçado em batalha");
    },

    revoltHandled: (id) =>
      set({
        revolts: get().revolts.filter((x) => x !== id),
        settlements: get().settlements.map((t) => (t.id === id ? { ...t, loyalty: Math.max(t.loyalty ?? 0, KINGDOM.LOYALTY_REVOLT + 12) } : t)),
      }),

    hearNews: (at, where, radius) => {
      const s = get();
      const near = s.rumors.filter((r) => distance(r, at) <= radius);
      if (near.length === 0) return 0;
      for (const r of near) s.chronicle(`Ouvido ${where}${s.day > r.day ? ` (de ${s.day - r.day} dia(s) atrás)` : ""}: ${r.text}`, r.tone);
      set({ rumors: get().rumors.filter((r) => !near.includes(r)) });
      return near.length;
    },
  };
}

const clamp = (v: number) => Math.max(-100, Math.min(100, v));
