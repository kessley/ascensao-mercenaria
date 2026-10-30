import { KINGDOM } from "../../utils/constants";
import { distance, type Point } from "../../utils/math";

/**
 * Notícias e rumores (Marco 15): o que acontece no mundo não chega na hora. Cada acontecimento
 * nasce num lugar e se espalha na velocidade dos viajantes; o bando só sabe quando a notícia
 * alcança alguém dele: o Comandante, uma feitoria ou um povoado do bando. O diário registra quando
 * e onde o bando soube. Mensageiros interceptados e tavernas adiantam as notícias.
 */
export interface Rumor {
  id: number;
  /** Dia do acontecimento. */
  day: number;
  x: number;
  y: number;
  text: string;
  tone: "info" | "good" | "bad";
}

/** Quem escuta pelo bando (vai para o diário: "Chegou a Valelos..."). */
export interface Ear extends Point {
  /** Como entra na frase do diário: "a Valelos", "ao bando, na estrada". */
  to: string;
}

/** Até onde a notícia chegou depois de tantos dias. */
export const newsReach = (ageDays: number) => ageDays * KINGDOM.NEWS_SPEED;

/**
 * Entrega do dia: devolve as notícias que alcançaram alguém do bando e as que seguem na estrada
 * (as muito velhas somem: nem todo rumor chega a todo lugar).
 */
export function hearRumors(rumors: readonly Rumor[], day: number, ears: readonly Ear[]): { heard: { rumor: Rumor; ear: Ear; age: number }[]; left: Rumor[] } {
  const heard: { rumor: Rumor; ear: Ear; age: number }[] = [];
  const left: Rumor[] = [];
  for (const r of rumors) {
    const age = day - r.day;
    const reach = newsReach(age + 0.5);
    const ear = ears.reduce<Ear | null>((best, e) => {
      const d = distance(e, r);
      return d <= reach && (!best || d < distance(best, r)) ? e : best;
    }, null);
    if (ear) heard.push({ rumor: r, ear, age });
    else if (age < KINGDOM.NEWS_MAX_AGE) left.push(r);
  }
  return { heard, left };
}

/** A frase do diário: quando e onde o bando soube. */
export function rumorLine(h: { rumor: Rumor; ear: Ear; age: number }): string {
  if (h.age <= 0) return `Chegou ${h.ear.to}: ${h.rumor.text}`;
  return `Chegou ${h.ear.to} (de ${h.age} dia${h.age > 1 ? "s" : ""} atrás): ${h.rumor.text}`;
}
