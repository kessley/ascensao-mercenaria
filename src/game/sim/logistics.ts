import { HEALTH, SUPPLY } from "../../utils/constants";
import { cargoCapacity, dailyRations } from "../../utils/economy";
import type { BattalionData } from "../../store/useGameStore";
import type { Follower } from "./campEvents";

/**
 * Logística e saúde do bando (Marco 13), em funções puras usadas pela passagem dos dias:
 * quem come de onde (carroças no campo, depósito no acampamento), feridos na enfermaria,
 * doentes e surtos.
 */

/** O que expõe o bando hoje (a cena informa onde o exército está). */
export interface Exposure {
  /** O exército está em campo (fora do acampamento): come das carroças. */
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

/** Quem está no acampamento (treinando) e quem marcha com o Comandante. */
function split(battalions: readonly BattalionData[], training: ReadonlySet<string>, away: boolean) {
  const camp = away ? battalions.filter((b) => training.has(b.id)) : [...battalions];
  const field = away ? battalions.filter((b) => !training.has(b.id)) : [];
  return { camp, field };
}

/**
 * Comida do dia. Em campo, o exército come o que as carroças levam (com o acampamento
 * levantado, o depósito inteiro vai junto); no acampamento ficam os seguidores e quem treina.
 * Devolve o que sobrou e se alguém passou fome.
 */
export function eatDay(
  rations: number,
  cargo: number,
  battalions: readonly BattalionData[],
  followers: readonly Follower[],
  training: ReadonlySet<string>,
  away: boolean,
  packed: boolean,
): { rations: number; cargo: number; hungry: boolean } {
  if (!away) {
    const need = dailyRations(battalions, followers);
    return { rations: Math.max(0, rations - need), cargo, hungry: rations < need };
  }
  const { camp, field } = split(battalions, training, away);
  let fieldNeed = dailyRations(field, []);
  const fromCargo = Math.min(cargo, fieldNeed);
  cargo -= fromCargo;
  fieldNeed -= fromCargo;
  if (packed && fieldNeed > 0) {
    const fromDepot = Math.min(rations, fieldNeed);
    rations -= fromDepot;
    fieldNeed -= fromDepot;
  }
  // No acampamento (sem o Comandante, que come com a tropa): seguidores e quem treina
  const campNeed = packed ? 0 : Math.max(0, dailyRations(camp, followers) - 1);
  const campEat = Math.min(rations, campNeed);
  rations -= campEat;
  return { rations, cargo, hungry: fieldNeed > 0 || campEat < campNeed };
}

/** Rações que as carroças levam ao sair do acampamento (deixando a reserva de quem fica). */
export function loadAmount(
  rations: number,
  cargo: number,
  wagons: number,
  battalions: readonly BattalionData[],
  followers: readonly Follower[],
  training: ReadonlySet<string>,
): number {
  const { camp } = split(battalions, training, true);
  const reserve = Math.max(0, dailyRations(camp, followers) - 1) * SUPPLY.CAMP_RESERVE_DAYS;
  return Math.max(0, Math.min(cargoCapacity(wagons) - cargo, rations - reserve));
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
 * causam surtos.
 */
export function healthDay(
  battalions: readonly BattalionData[],
  training: ReadonlySet<string>,
  exposure: Exposure,
  healer: boolean,
  hungry: boolean,
): { battalions: BattalionData[]; log: Line[] } {
  const H = HEALTH;
  const log: Line[] = [];
  const out = battalions.map((b) => ({ ...b }));
  let back = 0;
  let lost = 0;
  let cured = 0;
  let sickDead = 0;
  const campSoldiers = out.filter((b) => !exposure.away || training.has(b.id)).reduce((n, b) => n + b.soldiers, 0);
  const crowded = campSoldiers > H.CAMP_CROWD;
  const anySick = (where: "CAMP" | "FIELD") => out.some((b) => (b.sick ?? 0) > 0 && placeOf(b) === where);
  const placeOf = (b: BattalionData): "CAMP" | "FIELD" => (!exposure.away || training.has(b.id) ? "CAMP" : "FIELD");
  const sickBefore = { CAMP: anySick("CAMP"), FIELD: anySick("FIELD") };

  for (const b of out) {
    const where = placeOf(b);
    // Feridos: a enfermaria (e a curandeira) faz a diferença
    const wounded = b.wounded ?? 0;
    if (wounded > 0) {
      const recover = H.RECOVER[where] + (healer ? H.HEALER_RECOVER : 0);
      const die = H.DIE[where] * (healer ? H.HEALER_DIE : 1);
      let w = 0;
      for (let i = 0; i < wounded; i++) {
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
