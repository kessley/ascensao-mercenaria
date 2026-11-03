import type { FactionState, Settlement } from "./realm";

/**
 * O continente onde o bando não está (Marco 17): a terceira camada da simulação. Em vez do dia a
 * dia, uma semana em passos grossos: prosperidade, guerras na fronteira, tronos e revoltas. Quem
 * volta encontra o resultado, e as notícias atravessam o mar com semanas de atraso.
 */

export interface FarRealm {
  settlements: Settlement[];
  factions: FactionState[];
}

export interface FarLinks {
  factionName: (id: string) => string;
  /** Nome de quem sobe ao trono. */
  heir: () => string;
}

const WAR_CHANCE = 0.14;
const THRONE_CHANCE = 0.02;
const REVOLT_CHANCE = 0.05;
const DRIFT = 4;

const between = (random: () => number, n: number) => Math.floor(random() * n);

/** Uma semana sem o bando por perto. */
export function farWeek(realm: FarRealm, links: FarLinks, random: () => number = Math.random): { realm: FarRealm; news: string[] } {
  const news: string[] = [];
  let settlements = realm.settlements.map((t) => (t.owner === "RUINED" ? t : { ...t, prosperity: Math.max(20, Math.min(140, t.prosperity + (random() - 0.48) * DRIFT)) }));
  let factions = realm.factions;
  const alive = factions.filter((f) => !f.fallen && settlements.some((t) => t.owner === f.id));

  // Guerra de fronteira: uma cidade muda de mãos
  if (alive.length >= 2 && random() < WAR_CHANCE) {
    const a = alive[between(random, alive.length)];
    const others = alive.filter((f) => f !== a);
    const b = others[between(random, others.length)];
    const towns = settlements.filter((t) => t.owner === b.id && t.id !== b.seatId);
    if (towns.length > 0) {
      const taken = towns[between(random, towns.length)];
      settlements = settlements.map((t) => (t.id === taken.id ? { ...t, owner: a.id, prosperity: Math.max(20, t.prosperity - 15), lastRaidDay: null } : t));
      news.push(`${links.factionName(a.id)} tomou ${taken.name} de ${links.factionName(b.id)}.`);
    }
  }

  // Trono vago
  if (alive.length > 0 && random() < THRONE_CHANCE) {
    const f = alive[between(random, alive.length)];
    const ruler = links.heir();
    factions = factions.map((x) => (x.id === f.id ? { ...x, ruler } : x));
    news.push(`${f.ruler} morreu; ${ruler} subiu ao trono de ${links.factionName(f.id)}.`);
  }

  // Povoado do bando sem o bando por perto
  const own = settlements.filter((t) => t.owner === "PLAYER");
  if (own.length > 0 && alive.length > 0 && random() < REVOLT_CHANCE) {
    const t = own[between(random, own.length)];
    const f = alive[between(random, alive.length)];
    settlements = settlements.map((x) => (x.id === t.id ? { ...x, owner: f.id, garrison: x.garrison + 6 } : x));
    news.push(`${t.name} se cansou de esperar pelo bando e abriu as portas para ${links.factionName(f.id)}.`);
  }

  return { realm: { settlements, factions }, news };
}
