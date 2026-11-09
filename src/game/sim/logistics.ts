import { ECONOMY, HEALTH, SUPPLY, WORLD } from "../../utils/constants";
import { cargoCapacity, dailyRations } from "../../utils/economy";
import type { BattalionData } from "../../store/useGameStore";
import { hasFollower, type Follower } from "./campEvents";

/**
 * Logística e saúde do bando (Marco 13, rações refeitas na Fase 3), em funções puras usadas pela
 * passagem dos dias: quem come de onde (a mochila de cada batalhão no campo, as carroças quando
 * andam com o exército, o depósito no acampamento), o comboio de suprimentos, feridos na
 * enfermaria, doentes e surtos.
 */

/** O que expõe o bando hoje (a cena informa onde o exército está). */
export interface Exposure {
  /** O exército está em campo (fora do acampamento): come das mochilas. */
  away: boolean;
  /** Acampado no pântano. */
  swamp: boolean;
  /** Frio do inverno ao relento. */
  cold: boolean;
  /** Perto de um povoado com febre. */
  sickTown: boolean;
}

export const NO_EXPOSURE: Exposure = { away: false, swamp: false, cold: false, sickTown: false };

export type Sickness = "DISENTERIA" | "FEBRE";
export const SICKNESS_LABEL: Record<Sickness, string> = { DISENTERIA: "disenteria", FEBRE: "febre" };

export interface Line {
  text: string;
  tone: "info" | "good" | "bad";
}

/** Quem está no acampamento (treinando, de guarda) e quem marcha com o Comandante. */
function split(battalions: readonly BattalionData[], home: ReadonlySet<string>, away: boolean) {
  const camp = away ? battalions.filter((b) => home.has(b.id)) : [...battalions];
  const field = away ? battalions.filter((b) => !home.has(b.id)) : [];
  return { camp, field };
}

/** Bocas de um batalhão: feridos e doentes também comem. */
const mouths = (b: BattalionData) => b.soldiers + (b.wounded ?? 0) + (b.sick ?? 0);

/** Rações por dia de um batalhão (o cozinheiro aproveita melhor). */
export function battalionRations(b: BattalionData, cook = false): number {
  return (mouths(b) / ECONOMY.SOLDIERS_PER_RATION) * (cook ? 0.8 : 1);
}

/** Quanto cabe nas mochilas de um batalhão: PACK_DAYS dias da comida dele. */
export function packCapacity(b: BattalionData): number {
  return Math.ceil((mouths(b) / ECONOMY.SOLDIERS_PER_RATION) * SUPPLY.PACK_DAYS);
}

export const packOf = (b: BattalionData): number => b.pack ?? 0;

/** Comida nas mochilas de todos. */
export function packsTotal(battalions: readonly BattalionData[]): number {
  return battalions.reduce((n, b) => n + packOf(b), 0);
}

/**
 * Enche as mochilas tirando de `stock` (o depósito, as carroças, uma compra). Quem tem menos
 * comida enche primeiro. Devolve os batalhões e quanto saiu do estoque.
 */
export function fillPacks(battalions: readonly BattalionData[], stock: number, who: (b: BattalionData) => boolean = () => true): { battalions: BattalionData[]; used: number } {
  let left = Math.max(0, stock);
  const order = battalions
    .map((b, i) => ({ b, i }))
    .filter(({ b }) => who(b))
    .sort((x, y) => packOf(x.b) / Math.max(1, packCapacity(x.b)) - packOf(y.b) / Math.max(1, packCapacity(y.b)));
  const out = [...battalions];
  for (const { b, i } of order) {
    const room = Math.max(0, packCapacity(b) - packOf(b));
    const put = Math.min(room, left);
    if (put <= 0) continue;
    left -= put;
    out[i] = { ...b, pack: packOf(b) + put };
  }
  return { battalions: out, used: Math.max(0, stock) - left };
}

/**
 * Tira `amount` rações da comida que marcha com o exército: primeiro as carroças e a bolsa do
 * Comandante (`cargo`), depois as mochilas (de quem tem mais). Devolve o que não deu para tirar.
 */
export function takeFieldFood(battalions: readonly BattalionData[], cargo: number, amount: number, who: (b: BattalionData) => boolean = () => true): { battalions: BattalionData[]; cargo: number; short: number } {
  let need = Math.max(0, amount);
  const fromCargo = Math.min(cargo, need);
  cargo -= fromCargo;
  need -= fromCargo;
  const out = battalions.map((b) => ({ ...b }));
  for (const b of [...out].filter(who).sort((x, y) => packOf(y) - packOf(x))) {
    if (need <= 0) break;
    const take = Math.min(packOf(b), need);
    b.pack = packOf(b) - take;
    need -= take;
  }
  return { battalions: out, cargo, short: need };
}

export interface Meal {
  rations: number;
  cargo: number;
  battalions: BattalionData[];
  hungry: boolean;
  /** Batalhões em campo que ficaram sem comer hoje. */
  starving: string[];
}

/**
 * Comida do dia (rework das rações: cada batalhão leva a própria). Em campo, cada batalhão come
 * da mochila; faltando, das carroças que andam com o exército (`cargo`, com a bolsa do
 * Comandante) e, com o acampamento levantado, do depósito que vai junto. No acampamento, todos
 * comem do depósito e deixam a mochila pronta para sair (sem passar da reserva de quem fica).
 */
export function eatDay(
  rations: number,
  cargo: number,
  battalions: readonly BattalionData[],
  followers: readonly Follower[],
  home: ReadonlySet<string>,
  away: boolean,
  packed: boolean,
): Meal {
  const cook = hasFollower(followers, "COOK");
  const { camp, field } = split(battalions, home, away);
  const out = battalions.map((b) => ({ ...b }));
  const starving: string[] = [];
  let fieldShort = 0;
  if (away) {
    const fieldIds = new Set(field.map((b) => b.id));
    for (const b of out) {
      if (!fieldIds.has(b.id)) continue;
      let need = battalionRations(b, cook);
      const fromPack = Math.min(packOf(b), need);
      b.pack = packOf(b) - fromPack;
      need -= fromPack;
      const fromCargo = Math.min(cargo, need);
      cargo -= fromCargo;
      need -= fromCargo;
      if (packed && need > 0) {
        const fromDepot = Math.min(rations, need);
        rations -= fromDepot;
        need -= fromDepot;
      }
      if (need > 1e-6) starving.push(b.name);
    }
    // O Comandante come da bolsa dele, ou divide a mochila de quem tem mais
    const meal = takeFieldFood(out, cargo, 1, (b) => fieldIds.has(b.id));
    cargo = meal.cargo;
    out.splice(0, out.length, ...meal.battalions);
    if (packed && meal.short > 0) rations = Math.max(0, rations - meal.short);
    else fieldShort = meal.short;
  }
  // No acampamento (sem o Comandante, se ele saiu): seguidores, quem treina e quem ficou de guarda
  const campNeed = packed ? 0 : away ? Math.max(0, dailyRations(camp, followers) - 1) : dailyRations(battalions, followers);
  const campEat = Math.min(rations, campNeed);
  rations -= campEat;
  // Quem está no acampamento enche a mochila do depósito, sem tirar a reserva de quem fica
  if (!packed) {
    const reserve = campNeed * SUPPLY.CAMP_RESERVE_DAYS;
    const campIds = new Set(camp.map((b) => b.id));
    const filled = fillPacks(out, Math.max(0, rations - reserve), (b) => campIds.has(b.id));
    rations -= filled.used;
    out.splice(0, out.length, ...filled.battalions);
  }
  return { rations, cargo, battalions: out, hungry: starving.length > 0 || fieldShort > 0 || campEat < campNeed, starving };
}

/** Rações que as carroças levam ao sair do acampamento (deixando a reserva de quem fica). */
export function loadAmount(
  rations: number,
  cargo: number,
  wagons: number,
  battalions: readonly BattalionData[],
  followers: readonly Follower[],
  home: ReadonlySet<string>,
): number {
  const { camp } = split(battalions, home, true);
  const reserve = Math.max(0, dailyRations(camp, followers) - 1) * SUPPLY.CAMP_RESERVE_DAYS;
  return Math.max(0, Math.min(cargoCapacity(wagons) - cargo, rations - reserve));
}

/** Dias que o comboio leva do acampamento até o exército. */
export function convoyDays(distance: number): number {
  return Math.max(SUPPLY.CONVOY.MIN_DAYS, distance / (WORLD.DAY_DISTANCE * SUPPLY.CONVOY.SPEED));
}

/** Chance de o comboio cair numa emboscada no caminho, conforme os dias de estrada e a escolta. */
export function convoyRisk(days: number, escortSoldiers: number): number {
  const C = SUPPLY.CONVOY;
  const guard = Math.min(C.ESCORT_MAX, escortSoldiers * C.ESCORT_PER_SOLDIER);
  return Math.min(0.95, 1 - Math.pow(1 - C.RAID_PER_DAY, days)) * (1 - guard);
}

export interface ConvoyFate {
  raided: boolean;
  /** Rações que chegaram. */
  load: number;
  /** Carroças perdidas no ataque. */
  wagonsLost: number;
  /** A escolta como voltou (baixas de quem repeliu o ataque). */
  escort: BattalionData[];
  escortLost: number;
}

/**
 * No que deu a viagem: sem ataque, tudo chega. Num ataque, a escolta segura (perde gente, a
 * carga quase toda chega) ou não há escolta (perde parte da carga e talvez uma carroça).
 */
export function convoyFate(load: number, wagons: number, escort: readonly BattalionData[], days: number, random: () => number = Math.random): ConvoyFate {
  const C = SUPPLY.CONVOY;
  const soldiers = escort.reduce((n, b) => n + b.soldiers, 0);
  // A chance já desconta a escolta: o que sobra é o ataque que acontece mesmo assim
  if (random() >= convoyRisk(days, soldiers)) return { raided: false, load, wagonsLost: 0, escort: [...escort], escortLost: 0 };
  if (soldiers > 0) {
    let escortLost = 0;
    const back = escort.map((b) => {
      const dead = Math.min(b.soldiers - 1, Math.round(b.soldiers * C.ESCORT_LOSSES * (0.5 + random())));
      escortLost += Math.max(0, dead);
      return { ...b, soldiers: b.soldiers - Math.max(0, dead) };
    });
    return { raided: true, load: Math.round(load * (1 - C.RAID_LOSS[0] / 2)), wagonsLost: 0, escort: back, escortLost };
  }
  const share = C.RAID_LOSS[0] + random() * (C.RAID_LOSS[1] - C.RAID_LOSS[0]);
  return { raided: true, load: Math.round(load * (1 - share)), wagonsLost: wagons > 1 && random() < 0.5 ? 1 : 0, escort: [], escortLost: 0 };
}

const roll = (p: number) => Math.random() < p;
function binomial(n: number, p: number): number {
  let k = 0;
  for (let i = 0; i < n; i++) if (roll(p)) k++;
  return k;
}

/**
 * Um dia de enfermaria e doença: feridos voltam (ou morrem), doentes saram (ou morrem) e
 * passam a doença; o pântano, a fome, o frio, um povoado com febre e o acampamento lotado
 * causam surtos. `camp` (Marco 22): os leitos da enfermaria (quem não cabe sara no ritmo do campo)
 * e quantos soldados o acampamento aguenta antes de lotar.
 */
export function healthDay(
  battalions: readonly BattalionData[],
  training: ReadonlySet<string>,
  exposure: Exposure,
  healer: boolean,
  hungry: boolean,
  camp: { beds: number; crowd: number } = { beds: Infinity, crowd: HEALTH.CAMP_CROWD },
): { battalions: BattalionData[]; log: Line[] } {
  const H = HEALTH;
  const log: Line[] = [];
  const out = battalions.map((b) => ({ ...b }));
  let back = 0;
  let lost = 0;
  let cured = 0;
  let sickDead = 0;
  const campSoldiers = out.filter((b) => !exposure.away || training.has(b.id)).reduce((n, b) => n + b.soldiers, 0);
  const crowded = campSoldiers > camp.crowd;
  let beds = camp.beds;
  const anySick = (where: "CAMP" | "FIELD") => out.some((b) => (b.sick ?? 0) > 0 && placeOf(b) === where);
  const placeOf = (b: BattalionData): "CAMP" | "FIELD" => (!exposure.away || training.has(b.id) ? "CAMP" : "FIELD");
  const sickBefore = { CAMP: anySick("CAMP"), FIELD: anySick("FIELD") };

  for (const b of out) {
    const where = placeOf(b);
    // Feridos: a enfermaria (e a curandeira) faz a diferença
    const wounded = b.wounded ?? 0;
    if (wounded > 0) {
      let w = 0;
      for (let i = 0; i < wounded; i++) {
        // No acampamento, só quem tem leito na enfermaria sara no ritmo dela
        const bed = where === "CAMP" && beds > 0;
        if (bed) beds--;
        const at = bed ? "CAMP" : "FIELD";
        const recover = H.RECOVER[at] + (healer ? H.HEALER_RECOVER : 0);
        const die = H.DIE[at] * (healer ? H.HEALER_DIE : 1);
        const r = Math.random();
        if (r < recover) {
          b.soldiers++;
          back++;
        } else if (r < recover + die) lost++;
        else w++;
      }
      b.wounded = w;
    }
    // Doentes: saram, morrem ou passam adiante
    const sick = b.sick ?? 0;
    if (sick > 0) {
      const recover = H.SICK_RECOVER[where] + (healer ? H.HEALER_RECOVER : 0);
      const die = H.SICK_DIE[where] * (healer ? H.HEALER_DIE : 1);
      let s = 0;
      for (let i = 0; i < sick; i++) {
        const r = Math.random();
        if (r < recover) {
          b.soldiers++;
          cured++;
        } else if (r < recover + die) sickDead++;
        else s++;
      }
      const caught = Math.min(Math.max(0, b.soldiers - 1), binomial(b.soldiers, H.SPREAD * Math.min(1, s / 2)));
      b.soldiers -= caught;
      b.sick = s + caught;
      if (b.sick === 0) b.sickness = undefined;
    }
    // Surto: o que expõe o batalhão hoje
    let p = hungry ? H.OUTBREAK.HUNGER : 0;
    let cause: Sickness = "DISENTERIA";
    if (where === "FIELD") {
      if (exposure.swamp) p += H.OUTBREAK.SWAMP;
      if (exposure.cold) {
        p += H.OUTBREAK.COLD;
        cause = "FEBRE";
      }
      if (exposure.sickTown) {
        p += H.OUTBREAK.SICK_TOWN;
        cause = "FEBRE";
      }
    } else if (crowded) p += H.OUTBREAK.CROWDED;
    // Doença no mesmo lugar passa de um batalhão a outro
    if ((b.sick ?? 0) === 0 && sickBefore[where]) p += 0.2;
    if (b.soldiers > 1 && roll(p)) {
      const n = Math.min(b.soldiers - 1, 1 + Math.floor(Math.random() * 3));
      b.soldiers -= n;
      b.sick = (b.sick ?? 0) + n;
      b.sickness = b.sickness ?? (sickBefore[where] ? "FEBRE" : cause);
      log.push({ text: `${SICKNESS_LABEL[b.sickness]} em ${b.name}: ${n} soldado(s) caíram doentes.`.replace(/^./, (c) => c.toUpperCase()), tone: "bad" });
    }
  }
  if (back > 0 || lost > 0) {
    log.push({
      text: `Enfermaria: ${back > 0 ? `${back} ferido(s) voltaram às fileiras` : ""}${back > 0 && lost > 0 ? "; " : ""}${lost > 0 ? `${lost} não resistiram aos ferimentos` : ""}.`,
      tone: lost > back ? "bad" : "good",
    });
  }
  if (cured > 0 || sickDead > 0) {
    log.push({
      text: `Doentes: ${cured > 0 ? `${cured} sararam` : ""}${cured > 0 && sickDead > 0 ? "; " : ""}${sickDead > 0 ? `${sickDead} morreram` : ""}.`,
      tone: sickDead > 0 ? "bad" : "good",
    });
  }
  return { battalions: out, log };
}

/** Quantos dos que caíram em combate ficam feridos (não mortos). */
export function woundedOf(fell: number, healer: boolean): number {
  return binomial(fell, healer ? HEALTH.WOUNDED_SHARE_HEALER : HEALTH.WOUNDED_SHARE);
}
