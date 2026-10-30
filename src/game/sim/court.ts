import { COURT, GOODS, type Good } from "../../utils/constants";
import { NOBLE_TRAITS, isAdult, nobleName, type Noble, type Plot, type TalkTopic } from "./nobility";

/**
 * A vida na corte (Marco 15), em funções puras: primeira impressão, conversas, presentes e os
 * favores que um nobre pede. Os favores mexem em gente de verdade: carta para outro nobre (que
 * pode ser lida), duelo contra um rival, espionar um palácio à noite, tirar um parente da
 * masmorra, ou o pior deles, envenenar alguém.
 */

export type QuestKind = "LETTER" | "GIFT" | "DUEL" | "SPY" | "RESCUE" | "POISON";

export interface NobleQuest {
  id: string;
  kind: QuestKind;
  giverId: string;
  /** Outro nobre envolvido (destinatário, rival, parente preso, vítima). */
  targetId?: string;
  good?: Good;
  qty?: number;
  title: string;
  text: string;
  rewardGold: number;
  rewardOpinion: number;
  deadline: number;
  /** Feito: falta voltar a quem pediu. */
  ready?: boolean;
  /** Carta aberta pelo Comandante. */
  read?: boolean;
}

/** Só o que os favores precisam saber do estado. */
export interface CourtCtx {
  day: number;
  nobles: readonly Noble[];
  plots: readonly Plot[];
  realm: (factionId: string) => string;
}

export function firstImpression(n: Noble, rep: { fame: number; honor: number; fear: number }): { delta: number; line: string } {
  const has = (t: Noble["traits"][number]) => n.traits.includes(t);
  let delta = rep.fame * 0.15 + (rep.honor - 50) * (has("HONORABLE") || has("PIOUS") ? 0.35 : 0.1);
  delta -= rep.fear * (has("PIOUS") || has("COWARD") || has("HONORABLE") ? 0.3 : 0.1);
  if (has("CRUEL") || has("AMBITIOUS")) delta += rep.fear * 0.15;
  delta = Math.round(delta);
  const line =
    rep.fear >= 50 && (has("COWARD") || has("PIOUS"))
      ? "Dizem coisas terríveis do seu bando. Fique onde está."
      : rep.fame >= 40
        ? "Então o senhor é o Comandante de quem todos falam. Sente-se."
        : rep.honor < 30
          ? "Conheço a sua fama. Não é boa. O que quer aqui?"
          : rep.fame >= 15
            ? "Ouvi falar do seu bando. Fale, mas seja breve."
            : "Quem deixou um mercenário entrar aqui? Bem, já que veio, fale.";
  return { delta, line };
}

const LIKED: Record<TalkTopic, string[]> = {
  WAR: ["Fale-me dessa batalha! Quantos eram? Como foi a carga?", "Ah, enfim alguém que entende o que é uma linha de lanças."],
  TRADE: ["Ouro não dorme, Comandante. Vejo que sabe disso.", "Os preços do ferro... sim, sim, conte-me mais."],
  FAITH: ["Poucos soldados falam dos deuses com respeito. Isso me agrada.", "Que os deuses o guardem. Rezarei pelo seu bando."],
  FAMILY: ["Que gentileza perguntar. Nossa casa vai bem, obrigado.", "Poucos aqui se lembram de que somos gente antes de sermos títulos."],
  GOSSIP: ["Hehe. Isso não saiu de mim, entendeu? Mas é verdade...", "Interessante. Muito interessante. Conte-me o que mais ouviu."],
};
const HATED: Record<TalkTopic, string[]> = {
  WAR: ["Chega de sangue à minha mesa, por favor.", "A guerra é coisa de brutos. Mudemos de assunto."],
  TRADE: ["Fala como um mercador. Pensei que fosse um soldado.", "Não trato de moedas, Comandante. Tenho gente para isso."],
  FAITH: ["Poupe-me dos sermões.", "Reze no seu acampamento."],
  FAMILY: ["A minha casa não é assunto seu.", "Por que tanto interesse? Quem o mandou perguntar?"],
  GOSSIP: ["Isso é conversa de taverna, e não a admito aqui.", "Fofoca. Esperava mais do senhor."],
};
const NEUTRAL = ["Hum. Pode ser.", "Certo. E então?", "Já ouvi coisa parecida na corte."];

/** Reação a um assunto: os traços decidem. */
export function topicReaction(n: Noble, topic: TalkTopic): { delta: number; line: string } {
  const pick = (l: readonly string[]) => l[Math.floor(Math.random() * l.length)];
  if (n.traits.some((t) => NOBLE_TRAITS[t].hates.includes(topic))) return { delta: -COURT.TALK_OPINION, line: pick(HATED[topic]) };
  if (n.traits.some((t) => NOBLE_TRAITS[t].likes.includes(topic))) return { delta: COURT.TALK_OPINION, line: pick(LIKED[topic]) };
  return { delta: 1, line: pick(NEUTRAL) };
}

const rivalsOf = (n: Noble, ctx: CourtCtx) => ctx.nobles.filter((o) => o.alive && o.id !== n.id && o.factionId === n.factionId && isAdult(o) && !o.captiveOf && (o.rank === "LORD" || o.rank === "COURTIER" || o.rank === "HEIR"));

/**
 * O favor que este nobre pede agora, pelo jeito dele e pelo que acontece na corte. Nenhum favor
 * é de graça: quem pede usa o bando contra alguém de verdade, e esse alguém fica sabendo.
 */
export function questFor(n: Noble, ctx: CourtCtx, payScale: number): NobleQuest | null {
  const has = (t: Noble["traits"][number]) => n.traits.includes(t);
  const rivals = rivalsOf(n, ctx);
  const rival = rivals[Math.floor(Math.random() * rivals.length)];
  const name = (o: Noble) => nobleName(o, ctx.realm(o.factionId));
  const base = { id: crypto.randomUUID(), giverId: n.id, deadline: ctx.day + 12 };
  const gold = (v: number) => Math.round(v * payScale);
  // Parente preso: o favor mais urgente
  const kin = ctx.nobles.find((o) => o.alive && o.captiveOf && o.captiveOf !== "PLAYER" && (o.parentId === n.id || o.id === n.spouseId || n.parentId === o.id));
  if (kin) {
    return { ...base, kind: "RESCUE", targetId: kin.id, title: `Tirar ${kin.name} da masmorra`, text: `${name(kin)} está preso na masmorra do ${ctx.realm(kin.captiveOf as string)}. Não há resgate que eles aceitem. Dizem que os esgotos da Cidade Alta dão na masmorra... tire-o de lá.`, rewardGold: gold(320), rewardOpinion: 30 };
  }
  const plot = ctx.plots.find((p) => p.leaderId === n.id);
  if (plot) {
    const ally = ctx.nobles.find((o) => plot.members.includes(o.id) && o.alive) ?? rival;
    if (ally) return { ...base, kind: "LETTER", targetId: ally.id, title: `Levar uma carta lacrada a ${ally.name}`, text: `Esta carta vai para as mãos de ${name(ally)}, e só as dele. Não pergunte o que há nela.`, rewardGold: gold(110), rewardOpinion: 12 };
  }
  if ((has("CRUEL") || has("CUNNING")) && rival && n.opinion >= 35 && Math.random() < 0.3) {
    return { ...base, kind: "POISON", targetId: rival.id, title: `Envenenar ${rival.name}`, text: `${name(rival)} está no meu caminho. Um frasco no cálice, e ninguém precisa saber de nada. Pago bem pelo silêncio.`, rewardGold: gold(480), rewardOpinion: 25 };
  }
  if ((has("BRAVE") || has("CRUEL") || has("ENVIOUS")) && rival && Math.random() < 0.5) {
    return { ...base, kind: "DUEL", targetId: rival.id, title: `Derrotar ${rival.name} na Liça`, text: `${name(rival)} me ofendeu diante da corte. Desafie-o na Liça em meu nome e faça-o beijar a areia.`, rewardGold: gold(180), rewardOpinion: 18 };
  }
  if ((has("CUNNING") || has("ENVIOUS") || has("AMBITIOUS")) && rival && Math.random() < 0.6) {
    return { ...base, kind: "SPY", targetId: rival.id, title: `Copiar as cartas de ${rival.name}`, text: `Quero saber o que ${name(rival)} escreve. As cartas ficam na escrivaninha do palácio dele. Entre como puder, de preferência à noite.`, rewardGold: gold(160), rewardOpinion: 15 };
  }
  if (Math.random() < 0.5 || !rival) {
    const good = n.likes;
    const qty = GOODS[good].weight > 3 ? 2 : 4;
    return { ...base, kind: "GIFT", good, qty, title: `Trazer ${qty} de ${GOODS[good].label.toLowerCase()}`, text: `A cidade não tem ${GOODS[good].label.toLowerCase()} que preste. Traga ${qty} do melhor, e pago acima do mercado.`, rewardGold: gold(Math.round(GOODS[good].base * qty * 2.2) + 40), rewardOpinion: 12 };
  }
  return { ...base, kind: "LETTER", targetId: rival.id, title: `Levar uma carta a ${rival.name}`, text: `Entregue esta carta nas mãos de ${name(rival)}. Procure na corte: todo mundo tem a sua rotina.`, rewardGold: gold(70), rewardOpinion: 8 };
}

/** O que há numa carta lacrada: conspiração, se houver; senão, um segredo de família. */
export function letterSecret(q: NobleQuest, ctx: CourtCtx): { text: string; plot?: Plot } {
  const giver = ctx.nobles.find((n) => n.id === q.giverId);
  const plot = ctx.plots.find((p) => p.leaderId === q.giverId || p.members.includes(q.giverId));
  if (plot) {
    const leader = ctx.nobles.find((n) => n.id === plot.leaderId);
    return { text: `A carta fala em "chegada a hora" e em "o trono vazio". ${leader ? `${nobleName(leader, ctx.realm(leader.factionId))} lidera` : "Alguém lidera"} uma conspiração contra a coroa, com ${plot.members.length + 1} casa(s).`, plot };
  }
  return { text: `Nada de grave: ${giver?.name ?? "o remetente"} deve dinheiro ao destinatário e pede mais prazo. Agora o Comandante sabe.` };
}

/** Por que este casamento não pode acontecer (null = pode). */
export function marriageBlock(n: Noble, ctx: { spouseId: string | null; standing: number; gold: number }): string | null {
  if (ctx.spouseId) return "O Comandante já é casado.";
  if (!n.alive || !isAdult(n)) return "Não é possível.";
  if (n.spouseId) return "Essa pessoa já é casada.";
  if (n.rank === "RULER") return ctx.standing >= 4 ? null : "Só um vassalo pode pedir a mão de quem governa.";
  if (n.rank === "HEIR" || n.rank === "CHILD") return ctx.standing >= 3 ? null : "A família real só casa com gente sagrada cavaleiro.";
  if (ctx.standing < 2) return "Um forasteiro não pede a mão de ninguém nesta corte.";
  return null;
}

/** Dote que o Comandante paga pela união. */
export const DOWRY = 200;
