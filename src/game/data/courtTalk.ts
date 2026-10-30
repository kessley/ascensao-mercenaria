import { useGameStore, type GameState } from "../../store/useGameStore";
import { COURT, GOODS } from "../../utils/constants";
import { NOBLE_TRAITS, OFFICE_LABEL, PLACE_LABEL, RANSOM_OF, TOPIC_LABEL, isAdult, nobleName, scheduleOf, type Noble, type TalkTopic } from "../sim/nobility";
import { marriageBlock, type NobleQuest } from "../sim/court";
import { ACCESS_LABEL, STANDING_LABEL, addressOf, standingIn, type AccessPlace } from "../sim/reputation";
import { COURT_EVENT_LABEL, planText } from "../sim/kingdoms";
import type { Talk } from "./interiors";
import { theRealm } from "../worldgen/names";

/**
 * As conversas da corte (Marco 15). Cada fala é montada na hora a partir do estado (quem é o
 * Comandante neste reino, o que o nobre lembra dele, que favores estão pendentes), e cada
 * resposta tem um id "court:<verbo>:<argumentos>" tratado por `courtChoice`. O reconhecimento
 * manda em tudo: um forasteiro nem é recebido; um cavaleiro pede título, feudo e casamento.
 */

const bye = { id: "bye", label: "Com licença." };

const realmOf = (s: GameState, id: string) => s.world?.factions.find((f) => f.id === id)?.name ?? "reino";
export const courtName = (s: GameState, n: Noble) => nobleName(n, realmOf(s, n.factionId));

const hourOf = (s: GameState) => (6 + s.dayProgress * 24) % 24;

/** Traços que o Comandante já percebeu (depois de conhecer o nobre). */
export function traitLine(n: Noble): string {
  return n.traits.map((t) => NOBLE_TRAITS[t].label).join(", ");
}

function greeting(s: GameState, n: Noble): string {
  const st = standingIn(s, n.factionId);
  const you = addressOf(st);
  if (n.opinion >= 60) return `Meu amigo! Que bom vê-lo, ${you}.`;
  if (n.opinion >= 25) return `${you[0].toUpperCase()}${you.slice(1)}. Em que posso ajudar?`;
  if (n.opinion <= -40) return "Ainda ousa aparecer diante de mim?";
  if (n.opinion < 0) return `Fale logo, ${you}. Tenho mais o que fazer.`;
  return `Pois não, ${you}?`;
}

/** Fala de um nobre: o que dá para fazer com ele agora. */
export function nobleTalk(n: Noble, s: GameState): Talk {
  if (n.captiveOf) {
    return {
      text: `${n.name} está acorrentado à parede. "Comandante... diga à minha casa que ainda respiro."`,
      options: [
        { id: `court:ransom:${n.id}`, label: `Pagar o resgate (${RANSOM_OF(n)} de ouro)` },
        ...(s.quests.some((q) => q.kind === "RESCUE" && q.targetId === n.id && !q.ready) || s.activeContract?.contract.nobleId === n.id ? [{ id: `court:breakout:${n.id}`, label: "Arrombar a grade (a coroa daqui vai saber)" }] : []),
        bye,
      ],
    };
  }
  if (!n.met) {
    // Quem é o Comandante aqui decide quem fala com ele
    const st = standingIn(s, n.factionId);
    const royal = n.rank === "RULER" || n.rank === "CONSORT" || n.rank === "HEIR";
    const curious = n.traits.some((t) => t === "GENEROUS" || t === "ROMANTIC" || t === "SCHOLAR" || t === "CUNNING");
    const letter = s.passLetters.includes(n.factionId);
    if (st < 0) return { text: "Um criado fecha o caminho, olhando para os guardas: \"O senhor não devia estar aqui.\"" };
    if (st < 1 && royal && !letter) return { text: "A escolta cruza as lanças: ninguém fala com a família real sem ser Conhecido no reino." };
    if (st < 1 && !curious && !letter) return { text: "O criado nem levanta os olhos: \"Sua Senhoria não recebe forasteiros. Faça o seu nome, ou traga uma carta.\"" };
    return {
      text: `Um criado sussurra: "${courtName(s, n)}. ${n.age < 16 ? "Ainda é uma criança." : "Curve-se e fale primeiro."}"`,
      options: [{ id: `court:meet:${n.id}`, label: "Apresentar-se" }, bye],
    };
  }
  const options: { id: string; label: string }[] = [];
  const mine = s.quests.filter((q) => q.giverId === n.id);
  const forHim = s.quests.filter((q) => q.targetId === n.id);
  for (const q of mine) {
    if (q.ready || q.kind === "GIFT") options.push({ id: `court:claim:${q.id}`, label: q.kind === "GIFT" ? `Entregar: ${q.title}` : `Contar que está feito: ${q.title}` });
  }
  for (const q of forHim) {
    if (q.ready) continue;
    if (q.kind === "LETTER") options.push({ id: `court:deliver:${q.id}`, label: "Entregar a carta" });
    if (q.kind === "DUEL") options.push({ id: `court:challenge:${n.id}:${q.id}`, label: "Desafiar para um duelo na Liça" });
    if (q.kind === "POISON") options.push({ id: `court:poison:${n.id}`, label: "Pôr o frasco no cálice (assassinato)" });
  }
  if (isAdult(n)) {
    options.push({ id: `court:chat:${n.id}`, label: "Conversar" });
    options.push({ id: `court:gift:${n.id}`, label: `Dar um presente (gosta de ${GOODS[n.likes].label.toLowerCase()})` });
    if (mine.length === 0 && n.opinion >= COURT.OPINION_FAVOR) options.push({ id: `court:favor:${n.id}`, label: "Perguntar se precisa de algum favor" });
    if (n.opinion >= COURT.OPINION_FAVOR + 10 && !s.passLetters.includes(n.factionId)) options.push({ id: `court:letter:${n.id}`, label: "Pedir uma carta de apresentação" });
    if (n.opinion >= COURT.OPINION_SECRET) options.push({ id: `court:secret:${n.id}`, label: "Perguntar o que se passa de verdade na corte" });
    if (!marriageBlock(n, { spouseId: s.spouseId, standing: standingIn(s, n.factionId), gold: s.gold }) && n.opinion >= COURT.OPINION_MARRY - 15) options.push({ id: `court:propose:${n.id}`, label: "Pedir a mão em casamento" });
  }
  // Quem manda e os oficiais têm assuntos próprios
  if (n.rank === "RULER") options.push({ id: `court:royal:${n.id}`, label: "Falar dos assuntos do reino" });
  if (n.office === "CHAMBERLAIN") options.push({ id: `court:chamber:${n.id}`, label: "Pedir audiência e tratar de resgates" });
  if (n.office === "SPYMASTER") options.push({ id: `court:spy:${n.id}`, label: "Saber o que os espiões andam dizendo" });
  if (n.office === "MARSHAL") options.push({ id: `court:marshal:${n.id}`, label: "Perguntar pela guerra" });
  if (isAdult(n)) options.push({ id: `court:insult:${n.id}`, label: "Insultar" });
  options.push(bye);
  const job = n.office ? ` ${OFFICE_LABEL[n.office][n.female ? 1 : 0]} do reino.` : "";
  return { text: `${greeting(s, n)}${job} (${traitLine(n)} · opinião ${n.opinion})`, options };
}

/** Guarda de um portão: quem é você neste reino e o que dá para tentar. */
export function gateTalk(place: AccessPlace, townId: string, s: GameState): Talk {
  const c = s.access(place, townId);
  const t = s.settlements.find((x) => x.id === townId);
  const st = standingIn(s, t?.owner ?? "");
  const options: { id: string; label: string }[] = [];
  if (c.bribe > 0) options.push({ id: `gate:${place}:BRIBE`, label: `Molhar a mão do guarda (${c.bribe} de ouro; pode dar errado)` });
  if (c.letter) options.push({ id: `gate:${place}:LETTER`, label: "Mostrar a carta de apresentação" });
  if (c.intimidate) options.push({ id: `gate:${place}:INTIMIDATE`, label: `Lembrar quem é o Comandante (Temor ${Math.round(s.fear)})` });
  if (c.disguise && s.disguiseUntil > s.day + s.dayProgress) options.push({ id: `gate:${place}:DISGUISE`, label: "Passar de cabeça baixa, de libré" });
  options.push({ id: "bye", label: "Voltar" });
  return { text: `${ACCESS_LABEL[place]}. O senhor aqui é ${STANDING_LABEL[st]}. ${c.why}`, options };
}

/** Resultado de uma resposta: outra fala, ou algo que a cena precisa fazer. */
export interface ChoiceOutcome {
  /** Outra fala (mesmo quem falava, ou outro). */
  talk?: Talk;
  speaker?: string;
  /** A cena abre um duelo, sai do prédio, leva o Comandante a algum lugar... */
  scene?: "DUEL" | "OPEN_GATE" | "LEAVE_INTERIOR";
  gate?: AccessPlace;
}

const say = (text: string, options?: Talk["options"]): ChoiceOutcome => ({ talk: { text, options } });

function afterChat(n: Noble | undefined, text: string): ChoiceOutcome {
  const s = useGameStore.getState();
  const fresh = n ? s.nobles.find((x) => x.id === n.id) : undefined;
  return say(text, fresh ? [{ id: `court:back:${fresh.id}`, label: "Continuar" }, bye] : undefined);
}

/** Conversa, presentes, favores e tudo o que se pode dizer a um nobre. */
export function courtChoice(id: string, townId: string): ChoiceOutcome {
  const store = useGameStore.getState();
  const [, verb, a, b] = id.split(":");
  const n = store.nobles.find((x) => x.id === a);
  const realm = (fid: string) => realmOf(store, fid);
  switch (verb) {
    case "back":
      return n ? { talk: nobleTalk(n, store) } : {};
    case "meet":
      return afterChat(n, store.meetNoble(a));
    case "chat": {
      if (!n) return {};
      const topics = Object.keys(TOPIC_LABEL) as TalkTopic[];
      return say("Sobre o que o senhor quer falar?", [...topics.map((t) => ({ id: `court:topic:${a}:${t}`, label: TOPIC_LABEL[t] })), { id: `court:back:${a}`, label: "Deixe para lá" }]);
    }
    case "topic":
      return afterChat(n, store.talkNoble(a, b as TalkTopic));
    case "gift":
      return afterChat(n, store.giftNoble(a));
    case "favor": {
      if (!n) return {};
      const q = store.newQuest(a);
      if (!q) return afterChat(n, "Por ora, nada que precise de mercenários.");
      PENDING.set(q.id, q);
      return say(`${q.text} (${q.rewardGold} de ouro)`, [
        { id: `court:take:${q.id}`, label: `Aceitar: ${q.title}` },
        { id: `court:back:${a}`, label: "Recusar" },
      ]);
    }
    case "take": {
      const q = PENDING.get(a);
      if (!q) return {};
      PENDING.delete(a);
      store.acceptQuest(q);
      return say("Conto com o senhor. E, Comandante: discrição.");
    }
    case "claim":
      return say(store.claimQuest(a));
    case "deliver": {
      const text = store.deliverLetter(a);
      return say(`${text} Falta contar a quem o mandou.`);
    }
    case "read":
      return say(store.readLetter(a));
    case "copy":
      return say(store.copyLetters(a));
    case "letter":
      return afterChat(n, store.askLetter(a));
    case "secret": {
      if (!n) return {};
      const plot = store.plots.find((p) => p.factionId === n.factionId && (p.members.includes(n.id) || p.leaderId === n.id || (n.opinion >= 45 && p.strength > 30)));
      if (plot) {
        useGameStore.setState({ plots: useGameStore.getState().plots.map((p) => (p.id === plot.id ? { ...p, known: true } : p)) });
        const leader = store.nobles.find((x) => x.id === plot.leaderId);
        return say(
          plot.leaderId === n.id
            ? "A coroa está podre, Comandante, e há quem queira trocá-la. O senhor está conosco?"
            : `Fale baixo. ${leader ? courtName(store, leader) : "Alguém"} anda reunindo gente contra a coroa. Dizem que falta pouco.`,
          [
            { id: `court:joinplot:${plot.id}`, label: "Entrar na conspiração" },
            { id: `court:expose:${plot.id}`, label: "Contar tudo à coroa" },
            { id: `court:blackmail:${plot.id}`, label: "Cobrar pelo silêncio" },
            bye,
          ],
        );
      }
      const f = store.factions.find((x) => x.id === n.factionId);
      return afterChat(n, f ? `O conselho anda ocupado com ${store.world ? planText(f, store.world) : "muita coisa"}. No mais, a corte é a de sempre.` : "Nada de novo.");
    }
    case "joinplot":
      return say(store.joinPlot(a));
    case "expose":
      return say(store.exposePlot(a));
    case "blackmail":
      return say(store.blackmailPlot(a));
    case "propose":
      return afterChat(n, store.marryNoble(a));
    case "insult": {
      if (!n) return {};
      const line = store.insultNoble(a);
      const proud = n.traits.some((t) => t === "BRAVE" || t === "CRUEL" || t === "HONORABLE");
      return proud ? say(line, [{ id: `court:challenge:${a}:`, label: "Aceitar o duelo" }, { id: "bye", label: "Dar as costas" }]) : afterChat(n, line);
    }
    case "poison":
      return say(store.poisonNoble(a));
    case "challenge": {
      if (!n) return {};
      store.setDuel({ opponent: courtName(store, n), skill: n.martial, aggressive: n.traits.includes("BRAVE") || n.traits.includes("CRUEL"), nobleId: n.id, questId: b, from: store.city ? "CapitalScene" : "WorldScene" });
      return { scene: "DUEL" };
    }
    case "ransom":
      return say(store.ransomNoble(a));
    case "breakout":
      return say(store.breakOut(a));
    case "royal":
      return royalTalk(a, townId);
    case "knight":
      return say(store.knightMe(a));
    case "fealty":
      return say(store.swearFealty(a));
    case "renounce":
      return say(store.renounceFealty());
    case "pardon":
      return say(store.askPardon(a));
    case "tribute":
      return say(store.payTribute(a) ? "O tesoureiro conta o tributo. Por ora, o reino esquece." : "Isso não basta.");
    case "chamber":
      return chamberlain(n);
    case "audience":
      return say(store.askAudience(a));
    case "spy": {
      if (!n) return {};
      const known = store.plots.filter((p) => p.factionId === n.factionId && p.known);
      const cost = 40;
      return say("Segredos custam, Comandante. O que quer saber?", [
        { id: `court:spyfor:${n.factionId}`, label: `Os planos dos reinos vizinhos (${cost} de ouro)` },
        ...known.map((p) => ({ id: `court:expose:${p.id}`, label: "Denunciar a conspiração que descobri" })),
        { id: `court:back:${a}`, label: "Nada" },
      ]);
    }
    case "spyfor": {
      if (store.gold < 40 || !store.world) return say("Sem ouro, sem segredo.");
      useGameStore.setState({ gold: store.gold - 40 });
      const world = store.world;
      const lines = store.factions.filter((f) => f.id !== a && !f.fallen).map((f) => `${world.factions.find((x) => x.id === f.id)?.name}: ${planText(f, world)}.`);
      return say(lines.join(" ") || "Nada digno de nota.");
    }
    case "marshal": {
      const f = store.factions.find((x) => x.id === n?.factionId);
      const wars = store.wars.filter((w) => w.peace === undefined && (w.a === f?.id || w.b === f?.id));
      if (!f) return {};
      if (wars.length === 0) return afterChat(n, "Paz, por enquanto. Os lordes treinam e reclamam.");
      const foe = wars[0].a === f.id ? wars[0].b : wars[0].a;
      const armies = store.armies.filter((x) => x.factionId === f.id);
      return afterChat(n, `Guerra contra ${theRealm(realm(foe))}. ${armies.length} exército(s) em campo. Cansaço de guerra: ${Math.round(f.weariness ?? 0)}/100. Se quiser trabalho, olhe a mesa da sua tenda: os contratos saem daqui.`);
    }
    case "armory": {
      const key = `armory:${a}`;
      if ((store.passes[key] ?? -99) > store.day - 20) return say("Já levou a sua parte esta estação.");
      useGameStore.setState({ iron: store.iron + 10, passes: { ...store.passes, [key]: store.day } });
      return say("O armeiro empilha 10 de ferro no carrinho do bando: privilégio de vassalo.");
    }
    case "attend": {
      const ev = store.courtEvents.find((e) => e.id === a);
      if (!ev) return say("A cerimônia já acabou.");
      const key = `ev:${ev.id}`;
      if (store.passes[key] !== undefined) return say("O senhor já prestou as suas homenagens.");
      const t = store.settlements.find((x) => x.id === ev.townId);
      useGameStore.setState({
        passes: { ...store.passes, [key]: store.day },
        fame: Math.min(100, store.fame + 1),
        factions: store.factions.map((f) => (f.id === t?.owner ? { ...f, relation: Math.min(100, f.relation + 4) } : f)),
        nobles: store.nobles.map((n) => (n.at === ev.townId && n.alive ? { ...n, opinion: Math.min(100, n.opinion + 2) } : n)),
      });
      return say(`O Comandante toma o seu lugar na cerimônia. Quem importa nota quem veio. (${COURT_EVENT_LABEL[ev.kind]}: relação +4, opinião da corte +2)`);
    }
    case "bet": {
      const ev = store.courtEvents.find((e) => e.id === a);
      return startTournament(ev?.id ?? "", Number(b));
    }
    case "harpy":
      return say(store.harpyBuy(a));
    case "pray": {
      const gold = Number(a);
      return say(store.donateTemple(townId, gold) ? "Os sinos tocam. A honra do bando cresce nas conversas da cidade." : "Promessa de esmola não enche o tesouro dos deuses.");
    }
    case "disguise":
      return say(store.buyDisguise() ? `"Libré de criado da corte. Vale por algumas horas: ande de cabeça baixa." (${COURT.DISGUISE_GOLD} de ouro)` : "Volte com ouro.");
    case "forge": {
      const t = store.settlements.find((x) => x.id === townId);
      return say(t && store.buyForgedLetter(t.owner) ? `"Selo perfeito, ninguém nota." (${COURT.FORGED_LETTER_GOLD} de ouro, honra −2)` : "Sem ouro, sem selo.");
    }
    default:
      return {};
  }
}

/** Favores à espera de resposta (ainda não aceitos). */
const PENDING = new Map<string, NobleQuest>();

/** Assuntos do reino: títulos, vassalagem, perdão e tributo (sempre diante de quem governa). */
function royalTalk(rulerId: string, _townId: string): ChoiceOutcome {
  const s = useGameStore.getState();
  const n = s.nobles.find((x) => x.id === rulerId);
  if (!n) return {};
  const fid = n.factionId;
  const f = s.factions.find((x) => x.id === fid);
  const st = standingIn(s, fid);
  const options: { id: string; label: string }[] = [];
  if (!s.knights.includes(fid)) options.push({ id: `court:knight:${fid}`, label: `Pedir para ser sagrado cavaleiro (Fama ${COURT.KNIGHT.FAME}, relação ${COURT.KNIGHT.RELATION}, ${COURT.KNIGHT.GOLD} de ouro)` });
  else if (s.liege !== fid) options.push({ id: `court:fealty:${fid}`, label: `Jurar fidelidade em troca de um feudo (relação ${COURT.VASSAL.RELATION})` });
  if (s.liege === fid) options.push({ id: `court:renounce:${fid}`, label: "Renegar o juramento" });
  if (s.wanted[fid]) options.push({ id: `court:pardon:${fid}`, label: "Pedir perdão real (250 de ouro)" });
  if ((f?.relation ?? 0) < 0) options.push({ id: `court:tribute:${fid}`, label: "Oferecer um tributo pela boa vontade do reino" });
  options.push({ id: `court:back:${rulerId}`, label: "Nada mais" });
  return say(`O salão fica em silêncio. Aqui o senhor é ${STANDING_LABEL[st]}. Fale.`, options);
}

/** Camareiro: agenda de audiências, festas e nobres presos na masmorra. */
function chamberlain(n: Noble | undefined): ChoiceOutcome {
  const s = useGameStore.getState();
  if (!n) return {};
  const fid = n.factionId;
  const prisoners = s.nobles.filter((x) => x.alive && x.captiveOf === fid);
  const events = s.courtEvents.filter((e) => e.townId === n.at && e.day >= s.day);
  const agenda = events.length > 0 ? ` Na agenda: ${events.map((e) => `${COURT_EVENT_LABEL[e.kind]} no dia ${e.day}`).join(", ")}.` : "";
  const options = [
    { id: `court:audience:${fid}`, label: "Pedir audiência na Sala do Trono" },
    ...prisoners.map((p) => ({ id: `court:ransom:${p.id}`, label: `Pagar o resgate de ${p.name} (${RANSOM_OF(p)} de ouro)` })),
    { id: `court:back:${n.id}`, label: "Nada mais" },
  ];
  return say(`O registro está aberto sobre a mesa.${agenda}`, options);
}

/** Inscrição no torneio de hoje: três rodadas contra os melhores da corte. */
export function startTournament(eventId: string, bet: number): ChoiceOutcome {
  const s = useGameStore.getState();
  const ev = s.courtEvents.find((e) => e.id === eventId);
  if (!ev) return say("Não há torneio hoje.");
  if (bet > 0) {
    if (s.gold < bet) return say("Aposta sem ouro é conversa de bêbado.");
    useGameStore.setState({ gold: s.gold - bet });
  }
  const rival = tournamentRival(ev.townId, 1);
  s.setDuel({ opponent: rival.name, skill: rival.skill, aggressive: rival.aggressive, tournament: { townId: ev.townId, round: 1, purse: ev.purse ?? COURT.TOURNAMENT_PURSE, bet }, from: "CapitalScene" });
  return { scene: "DUEL" };
}

/** Quem enfrenta o Comandante em cada rodada: gente da corte, cada vez melhor. */
export function tournamentRival(townId: string, round: number): { name: string; skill: number; aggressive: boolean } {
  const s = useGameStore.getState();
  const t = s.settlements.find((x) => x.id === townId);
  const pool = s.nobles.filter((n) => n.alive && !n.captiveOf && n.factionId === t?.owner && isAdult(n) && n.age < 55).sort((a, b) => a.martial - b.martial);
  const n = pool[Math.min(pool.length - 1, Math.floor((round / 3) * pool.length))];
  if (n) return { name: courtName(s, n), skill: Math.min(10, n.martial + round - 1), aggressive: n.traits.includes("BRAVE") };
  return { name: ["Sor Paio de Monsanto", "Sor Mendo o Lobo", "Dona Urraca a Brava"][round - 1] ?? "Campeão", skill: 3 + round * 2, aggressive: true };
}

/** Rotina de um nobre em palavras, para o Livro da Nobreza. */
export function nobleWhere(n: Noble, s: GameState): string {
  if (n.captiveOf) return "preso numa masmorra";
  if (n.armyId) return "em campanha, com o exército";
  const t = s.settlements.find((x) => x.id === n.at);
  if (!t) return "em lugar incerto";
  if (t.kind !== "CAPITAL") return `em ${t.name}`;
  return `em ${t.name}, ${PLACE_LABEL[scheduleOf(n, hourOf(s), s.day, false)].toLowerCase()}`;
}

