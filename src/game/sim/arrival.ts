import { CULTURES, type CultureId } from "../data/planet";
import { LANGUAGE } from "../../utils/constants";
import { bandMix, cultureOf, mainCulture, peopleOf } from "./culture";
import { FAITHS, PRECEPTS, clash, faithCalendar, faithMix, nativeFaith, type FaithId } from "./faith";
import { TONGUE, barrierOf, interpreterTitle, orderVoice, voiceFor, type VoiceCtx } from "./language";

/**
 * Outra terra (Marco 23, parte 4): ao desembarcar, o bando fica sabendo de uma vez o que muda.
 * A gente, a língua e quem fala por ela, a fé dos templos e o calendário, quem não entende as
 * ordens e quem se alista aqui. Tudo puro: o store guarda o aviso e a interface mostra.
 */

export type ArrivalTopic = "FOLK" | "TONGUE" | "FAITH" | "ORDERS" | "RULE";

export interface ArrivalLine {
  topic: ArrivalTopic;
  text: string;
  tone: "good" | "bad" | "info";
}

export interface ArrivalNotice {
  /** O continente onde o bando desembarcou. */
  name: string;
  land: CultureId;
  /** Volta a uma terra onde já esteve. */
  back: boolean;
  lines: ArrivalLine[];
}

export interface ArrivalInput extends VoiceCtx {
  name: string;
  land: CultureId;
  back: boolean;
  day: number;
  battalions: readonly { id: string; name: string; soldiers: number; culture?: CultureId; faith?: FaithId }[];
  /** O tenente de cada batalhão (para saber quem leva as ordens). */
  lieutenantOf: (battalionId: string) => { culture?: CultureId; tongues?: CultureId[] } | null;
}

const cap = (s: string) => s[0].toUpperCase() + s.slice(1);

/** O que muda ao pisar nesta terra. */
export function arrivalNotice(a: ArrivalInput): ArrivalNotice {
  const lines: ArrivalLine[] = [];
  const def = CULTURES[a.land];
  const band = mainCulture(bandMix(a.battalions));

  // A gente e quem se alista
  lines.push({
    topic: "FOLK",
    text: `Aqui vive a ${peopleOf(a.land)}, terra de ${def.luxury}. Quem se alistar aqui será da ${peopleOf(a.land)}${a.land === band ? ", como a maior parte do bando" : ", e não da gente do bando"}.`,
    tone: "info",
  });

  // A língua e quem fala por ela
  const voice = voiceFor(a.land, a);
  const tongue = TONGUE[a.land].label;
  if (voice.by === "SELF") lines.push({ topic: "TONGUE", text: `Fala-se ${tongue}, que o Comandante fala.`, tone: "good" });
  else if (voice.by === "INTERPRETER") lines.push({ topic: "TONGUE", text: `Fala-se ${tongue}: ${interpreterTitle(voice.who ?? "?")}, fala pelo bando.`, tone: "good" });
  else if (voice.by === "OFFICER") lines.push({ topic: "TONGUE", text: `Fala-se ${tongue}: ${voice.who} fala pelo bando como pode, e o Comandante aprende com ele ao lado.`, tone: "info" });
  else {
    const barrier = barrierOf(voice);
    lines.push({
      topic: "TONGUE",
      text: `Fala-se ${tongue}, e ninguém no bando a fala: preços até ${Math.round(LANGUAGE.PRICE * barrier * 100)}% piores, contratos sem detalhe, boatos truncados e presos calados. Um intérprete se contrata na taverna; o Comandante aprende com o tempo.`,
      tone: "bad",
    });
  }

  // A fé dos templos e o calendário
  const faith = nativeFaith(a.land);
  const f = FAITHS[faith];
  const cal = faithCalendar(faith, a.day);
  const when = [cal.holy !== null ? `o dia santo ${cal.holy === 0 ? "é hoje" : `em ${cal.holy} dia(s)`}` : null, cal.fast !== null ? `o jejum ${cal.fast === 0 ? "é agora" : `em ${cal.fast} dia(s)`}` : null, `a ${f.feast.label} em ${cal.feast} dia(s)`].filter(Boolean);
  const mix = faithMix(a.battalions);
  const rivals = (Object.keys(mix) as FaithId[]).filter((x) => (mix[x] ?? 0) > 0 && clash(x, faith));
  lines.push({
    topic: "FAITH",
    text: `Fé dos templos: ${f.label}, dos ${f.clergy}. Os preceitos: ${f.precepts.map((p) => PRECEPTS[p]).join("; ")}. ${cap(when.join(", "))}.${rivals.length > 0 ? ` Ela briga com fés do bando (${rivals.map((x) => FAITHS[x].label).join(", ")}): quem se alistar aqui pode azedar o acampamento.` : ""}`,
    tone: rivals.length > 0 ? "bad" : "info",
  });

  // Quem não entende as ordens do Comandante
  const lost = a.battalions.filter((b) => !orderVoice(a.leader, cultureOf(b), a.lieutenantOf(b.id)));
  if (lost.length > 0) {
    lines.push({
      topic: "ORDERS",
      text: `${lost.map((b) => b.name).join(", ")} não ${lost.length > 1 ? "entendem" : "entende"} a voz do Comandante: a ordem falada demora, a menos que um tenente fale as duas línguas.`,
      tone: "bad",
    });
  }

  // Quem governa
  if (cultureOf(a.leader) !== a.land) {
    lines.push({ topic: "RULE", text: `Um povoado tomado aqui será governado por gente de fora: a ${peopleOf(a.land)} perde a lealdade mais depressa com um Comandante da ${peopleOf(cultureOf(a.leader))}.`, tone: "info" });
  }

  return { name: a.name, land: a.land, back: a.back, lines };
}
