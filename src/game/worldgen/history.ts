import type { FactionDef, HistoryEntry, SettlementSeed, Temperament } from "../data/world";
import { distance } from "../../utils/math";
import type { Rng } from "./rng";
import * as names from "./names";

const TEMPERAMENTS: Temperament[] = ["BELLIGERENT", "MERCANTILE", "PIOUS"];
const ANCIENT_CALAMITIES = ["a Praga Cinzenta", "a Noite dos Mil Ossos", "a Fome Vermelha", "o Despertar do Rei-Lich", "a Maré de Orcs", "o Inverno Sem Fim"];
/** Força de cada povoado numa guerra da história. */
const WEIGHT = { VILLAGE: 1, CITY: 3, FORT: 4 } as const;

interface Kingdom {
  key: string;
  name: string;
  ruler: string;
  rulerAge: number;
  rulerSpan: number;
  temperament: Temperament;
  capitalId: string;
  alive: boolean;
}

export interface HistoryResult {
  /** Dono de cada povoado no início da campanha (id da facção final, "FREE" ou "RUINED"). */
  owners: Map<string, string>;
  factions: FactionDef[];
  entries: HistoryEntry[];
}

/**
 * História simulada (Marco 11): em vez de sortear a crônica, o gerador roda séculos de
 * mundo em passos de 5 anos com regras simples — povoados são fundados, reinos juram
 * aldeias livres, guerreiam pelas fronteiras (o mais forte toma o povoado mais próximo;
 * a capital cai por último e leva o reino junto), reis morrem e são sucedidos, calamidades
 * antigas arrasam regiões e algumas ruínas são reerguidas. O mapa do início da campanha
 * (fronteiras, ruínas, reinos sobreviventes) é o resultado, e a crônica conta como se chegou
 * a ele. `capitals` = quantos reinos nascem; `survivors` = quantos podem sobrar no mínimo.
 */
export function simulateHistory(
  rng: Rng,
  settlements: readonly SettlementSeed[],
  capitals: number,
  survivors: number,
  year: number,
  years: number,
  colors: readonly number[],
): HistoryResult {
  const start = year - years;
  const entries: HistoryEntry[] = [];
  const log = (y: number, text: string) => entries.push({ year: Math.round(y), text });
  const byId = new Map(settlements.map((s) => [s.id, s]));
  const owner = new Map<string, string>();

  // Fundações: as capitais antes da história começar; os outros ao longo dela
  const founded = new Map<string, number>();
  settlements.forEach((s, i) => {
    const y = i < capitals ? start - rng.int(30, 120) : rng.int(start - 40, year - 15);
    founded.set(s.id, y);
    if (i < capitals || s.kind !== "VILLAGE" || rng.chance(0.3)) {
      log(y, `${names.personName(rng)} fundou ${s.name}${i < capitals ? ", que viria a ser uma capital" : ""}.`);
    }
  });

  const kingdoms: Kingdom[] = settlements.slice(0, capitals).map((capital, i) => ({
    key: `K${i}`,
    name: names.factionName(rng),
    ruler: names.personName(rng),
    rulerAge: rng.int(20, 50),
    rulerSpan: rng.int(55, 85),
    temperament: rng.pick(TEMPERAMENTS),
    capitalId: capital.id,
    alive: true,
  }));
  for (const k of kingdoms) {
    owner.set(k.capitalId, k.key);
    log(start + rng.int(0, 20), `${byId.get(k.capitalId)?.name} proclamou o ${k.name}.`);
  }

  const alive = () => kingdoms.filter((k) => k.alive);
  const domain = (k: Kingdom) => settlements.filter((s) => owner.get(s.id) === k.key);
  const strength = (k: Kingdom) =>
    domain(k).reduce((sum, s) => sum + WEIGHT[s.kind], 0) * (k.temperament === "BELLIGERENT" ? 1.2 : 1) * rng.range(0.7, 1.3);

  // Calamidades antigas: quando e onde
  const calamityCount = years >= 350 ? 2 : 1;
  const calamities = Array.from({ length: calamityCount }, (_, i) => ({
    year: start + Math.round(years * rng.range(0.1 + i * 0.35, 0.4 + i * 0.35)),
    name: rng.pick(ANCIENT_CALAMITIES),
  }));
  const ruinedAt = new Map<string, number>();

  for (let y = start; y < year; y += 5) {
    const exists = (s: SettlementSeed) => (founded.get(s.id) ?? 0) <= y;

    // Reinos juram aldeias livres por perto
    for (const k of alive()) {
      if (!rng.chance(0.3)) continue;
      const own = domain(k);
      const free = settlements.filter((s) => exists(s) && !owner.has(s.id));
      const near = free
        .map((s) => ({ s, d: Math.min(...own.map((o) => distance(o, s))) }))
        .filter((x) => x.d < 9000)
        .sort((a, b) => a.d - b.d)[0];
      if (!near) continue;
      owner.set(near.s.id, k.key);
      if (near.s.kind !== "VILLAGE" || rng.chance(0.25)) log(y, `${near.s.name} jurou fidelidade ao ${k.name}.`);
    }

    // Guerras de fronteira
    if (alive().length >= 2 && rng.chance(0.09 + (years > 300 ? 0.03 : 0))) {
      const pool = alive().flatMap((k) => (k.temperament === "BELLIGERENT" ? [k, k] : [k]));
      const a = rng.pick(pool);
      const aOwn = domain(a);
      const others = alive().filter((k) => k !== a);
      const b = others
        .map((k) => ({ k, d: Math.min(...domain(k).map((s) => Math.min(...aOwn.map((o) => distance(o, s))))) }))
        .sort((x, z) => x.d - z.d)[0]?.k;
      if (b) {
        const sa = strength(a);
        const sb = strength(b);
        const [winner, loser] = sa >= sb ? [a, b] : [b, a];
        const wOwn = domain(winner);
        const lOwn = domain(loser);
        const canFall = alive().length > survivors;
        // A capital cai por último (e leva o reino junto, se ainda puder sobrar gente)
        const prizes = lOwn.filter((s) => s.id !== loser.capitalId || (lOwn.length === 1 && canFall));
        const prize = prizes.sort((p, q) => Math.min(...wOwn.map((o) => distance(o, p))) - Math.min(...wOwn.map((o) => distance(o, q))))[0];
        if (prize) {
          owner.set(prize.id, winner.key);
          if (prize.id === loser.capitalId) {
            loser.alive = false;
            log(y, `O ${winner.name} tomou ${prize.name}: o ${loser.name} deixou de existir.`);
          } else {
            log(y, `Guerra entre o ${a.name} e o ${b.name}: ${prize.name} passou ao ${winner.name}.`);
          }
        } else {
          log(y, `Guerra entre o ${a.name} e o ${b.name} terminou sem vencedor, mas com muitas viúvas.`);
        }
      }
    }

    // Reis morrem; os herdeiros sobem ao trono
    for (const k of alive()) {
      k.rulerAge += 5;
      if (k.rulerAge < k.rulerSpan) continue;
      const old = k.ruler;
      k.ruler = names.personName(rng);
      k.rulerAge = rng.int(18, 45);
      k.rulerSpan = rng.int(55, 85);
      if (y > year - 70 || rng.chance(0.25)) log(y, `Morreu ${old}; ${k.ruler} subiu ao trono do ${k.name}.`);
    }

    // Calamidade antiga: arrasa os povoados menores de uma região
    for (const cal of calamities) {
      if (y > cal.year || y + 5 <= cal.year) continue;
      const victims = settlements.filter((s) => exists(s) && !kingdoms.some((k) => k.capitalId === s.id) && !ruinedAt.has(s.id));
      if (victims.length === 0) continue;
      const epicenter = rng.pick(victims);
      const hit = victims.filter((s) => distance(s, epicenter) < 4500).slice(0, rng.int(1, 3));
      for (const s of hit) {
        owner.set(s.id, "RUINED");
        ruinedAt.set(s.id, y);
      }
      log(y, `${cap(cal.name)} se abateu sobre a terra: ${listNames(hit.map((s) => s.name))} ${hit.length > 1 ? "viraram" : "virou"} ruínas.`);
    }

    // Ruínas antigas às vezes são reerguidas por um reino vizinho
    for (const [id, when] of ruinedAt) {
      if (owner.get(id) !== "RUINED" || y - when < 40 || !rng.chance(0.06)) continue;
      const s = byId.get(id);
      if (!s) continue;
      const k = alive()
        .map((k) => ({ k, d: Math.min(...domain(k).map((o) => distance(o, s))) }))
        .sort((p, q) => p.d - q.d)[0]?.k;
      if (!k) continue;
      owner.set(id, k.key);
      log(y, `${s.name} foi reerguida das ruínas pelo ${k.name}.`);
    }
  }

  // Quem ainda não foi fundado até agora nasce livre
  for (const s of settlements) if (!owner.has(s.id)) owner.set(s.id, "FREE");

  // Reinos sobreviventes viram as facções da campanha (ids F0, F1...)
  const finalId = new Map<string, string>();
  const factions: FactionDef[] = alive().map((k, i) => {
    finalId.set(k.key, `F${i}`);
    return { id: `F${i}`, name: k.name, ruler: k.ruler, color: colors[i % colors.length], capitalId: k.capitalId, temperament: k.temperament };
  });
  const owners = new Map<string, string>();
  for (const [id, o] of owner) owners.set(id, finalId.get(o) ?? (o.startsWith("K") ? "FREE" : o));
  return { owners, factions, entries };
}

const cap = (t: string) => t[0].toUpperCase() + t.slice(1);

function listNames(list: readonly string[]): string {
  if (list.length <= 1) return list[0] ?? "";
  return `${list.slice(0, -1).join(", ")} e ${list[list.length - 1]}`;
}
