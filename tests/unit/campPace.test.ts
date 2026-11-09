import { describe, expect, it } from "vitest";
import {
  CAMP_BUILDINGS,
  FIRE_COOKS,
  PALISADE,
  RAW_FOOD,
  VOLUNTEERS,
  VOLUNTEER_COST,
  buildProblem,
  freeSpot,
  growProblem,
  grown,
  newWork,
  ready,
  shortOf,
  startingPlan,
  volunteerRate,
  type CampKind,
  type CampPlan,
} from "../../src/game/data/campGrid";
import { DIFFICULTY } from "../../src/game/data/contracts";
import { BALANCE, ECONOMY, GOODS, REPUTE, SUPPLY, SUPPORT, TROOPS, WORLD } from "../../src/utils/constants";
import { goblinBandSize } from "../../src/game/systems/Warbands";
import { LABOR, advanceWorks } from "../../src/game/sim/campDays";

/**
 * Marco 22, parte 1: o balanceamento dos primeiros 30 dias (GDD 9.9). Um jogador cuidadoso faz
 * contratos um atrás do outro (3 dias cada, com a volta: fáceis com um batalhão, médios com
 * dois), compra rações no vivandeiro e a madeira da paliçada no mercado (o que a carroça leva),
 * guarda o ouro para a paliçada antes de crescer mais e constrói pela ordem da GDD. As regras da planta são
 * as de verdade (campGrid); o resto é o modelo mais simples que dá o ritmo.
 */
interface Pace {
  mast: number;
  /** Primeiro dia em que dá para pagar a 2ª barraca OU o estande de tiro. */
  choice: number;
  battalion2: number;
  palisade: number;
  goldDay30: number;
  minGold: number;
  log: string[];
}

const RATION_PRICE = ECONOMY.RATION_PACK_PRICE / ECONOMY.RATION_PACK_SIZE;
/** Contrato fácil: dias de ida, luta e volta. */
const CONTRACT_DAYS = 3;
/** Cada viagem a um povoado traz o que a carroça leva de madeira. */
const WOOD_PER_TRIP = Math.floor(SUPPLY.WAGON_CAPACITY / GOODS.WOOD.weight);

function simulate(days = 30): Pace {
  let plan: CampPlan = startingPlan();
  let gold: number = ECONOMY.START_GOLD;
  let rations: number = ECONOMY.START_RATIONS;
  let wood = 0;
  let fame = 0;
  let battalions = 1;
  let volunteers = 0;
  let contractEnds = CONTRACT_DAYS;
  const out: Pace = { mast: Infinity, choice: Infinity, battalion2: Infinity, palisade: Infinity, goldDay30: 0, minGold: Infinity, log: [] };
  const build = (kind: CampKind, day: number): boolean => {
    const def = CAMP_BUILDINGS[kind];
    if (buildProblem(plan, kind) || shortOf(def.cost, { gold, wood, iron: 0 })) return false;
    const spot = freeSpot(plan, kind);
    if (!spot) return false;
    gold -= def.cost.gold;
    wood -= def.cost.wood ?? 0;
    // Obras levam dias (parte 2): com os batalhões em contrato, só o estado-maior trabalha
    plan = { ...plan, buildings: [...plan.buildings, newWork(kind, spot.x, spot.y)] };
    out.log.push(`dia ${day}: obra de ${def.label.toLowerCase()} (${gold} de ouro)`);
    return true;
  };
  const barracks = () => plan.buildings.filter((b) => b.kind === "BARRACK").length;

  for (let day = 1; day <= days; day++) {
    // Comida: 1 ração a cada 3 soldados e a do Comandante; quem passa da fogueira come cru
    const soldiers = battalions * BALANCE.BATTALION_SIZE;
    const raw = Math.max(0, battalions - FIRE_COOKS);
    const need = Math.ceil(1 + Math.ceil(soldiers / ECONOMY.SOLDIERS_PER_RATION) * (1 + (raw / battalions) * (RAW_FOOD - 1)));
    if (rations < need) {
      const packs = Math.ceil((need * 4 - rations) / ECONOMY.RATION_PACK_SIZE);
      gold -= packs * ECONOMY.RATION_PACK_PRICE;
      rations += packs * ECONOMY.RATION_PACK_SIZE;
    }
    rations -= need;
    // O mastro atrai voluntários
    const rate = volunteerRate(plan);
    volunteers = Math.min(rate.cap, volunteers + rate.perDay);
    // Contrato fácil acabado: o pagamento (com a fama) e a madeira comprada no caminho
    if (day === contractEnds) {
      gold += Math.round(DIFFICULTY[battalions >= 2 ? 2 : 1].reward * (1 + fame * REPUTE.CONTRACT_FAME_BONUS));
      fame += REPUTE.FAME.CONTRACT + REPUTE.FAME.VICTORY;
      const wanted = out.palisade === Infinity ? Math.max(0, (PALISADE[16].cost.wood ?? 0) - wood) : 0;
      const buy = Math.min(WOOD_PER_TRIP, wanted, Math.max(0, Math.floor((gold - 60) / GOODS.WOOD.base)));
      wood += buy;
      gold -= buy * GOODS.WOOD.base;
      contractEnds = day + CONTRACT_DAYS;
    }
    // Pagamento da semana
    if (day % ECONOMY.PAYDAY_INTERVAL === 0) {
      gold -= battalions * Math.ceil(BALANCE.BATTALION_SIZE * TROOPS.INFANTRY.wagePerSoldier);
      gold -= SUPPORT.MESSENGER.WAGE * SUPPORT.START_MESSENGERS + 5 * SUPPORT.START_SCOUTS;
    }
    // A primeira escolha de verdade: dá para pagar a 2ª barraca ou o estande?
    if (out.choice === Infinity && day > out.mast && (gold >= CAMP_BUILDINGS.BARRACK.cost.gold || !shortOf(CAMP_BUILDINGS.ARCHERY.cost, { gold, wood, iron: 0 }))) out.choice = day;
    // As construções, na ordem da GDD
    if (!plan.buildings.some((b) => b.kind === "RECRUIT_MAST")) build("RECRUIT_MAST", day);
    // Com dois batalhões, o ouro vai para a paliçada antes do terceiro
    const saving = battalions >= 2 && out.palisade === Infinity;
    if (!saving && volunteers >= VOLUNTEERS.CAP && gold >= TROOPS.INFANTRY.cost * VOLUNTEER_COST + 40) {
      volunteers -= VOLUNTEERS.CAP;
      gold -= TROOPS.INFANTRY.cost * VOLUNTEER_COST;
      battalions++;
      if (battalions === 2) out.battalion2 = day;
      out.log.push(`dia ${day}: batalhão ${battalions} dos voluntários`);
    }
    if (barracks() < Math.max(2, battalions)) build("BARRACK", day);
    if (out.palisade === Infinity && !growProblem(plan, { fame, battalions }) && !shortOf(PALISADE[16].cost, { gold, wood, iron: 0 })) {
      gold -= PALISADE[16].cost.gold;
      wood -= PALISADE[16].cost.wood ?? 0;
      plan = grown(plan);
      out.palisade = day;
      out.log.push(`dia ${day}: paliçada pequena (${gold} de ouro)`);
    }
    // O trabalho do dia nas obras
    const works = advanceWorks(plan, LABOR.BASE);
    plan = works.plan;
    for (const b of works.finished) out.log.push(`dia ${day}: pronta: ${CAMP_BUILDINGS[b.kind].label.toLowerCase()}`);
    if (out.mast === Infinity && ready(plan, "RECRUIT_MAST")) out.mast = day;
    if (gold < out.minGold) out.minGold = gold;
    out.log.push(`  fim do dia ${day}: ${gold} ouro, ${wood} madeira, fama ${fame}, ${battalions} batalhão(ões), ${volunteers} voluntários`);
  }
  out.goldDay30 = gold;
  return out;
}

describe("o ritmo dos primeiros 30 dias (GDD 9.9)", () => {
  const pace = simulate();

  it("o ouro nunca falta (o bando paga soldo e comida)", () => {
    expect(pace.minGold, pace.log.join("\n")).toBeGreaterThanOrEqual(0);
  });

  it("o mastro de recrutamento fica pronto nos dias 1 a 3", () => {
    expect(pace.mast, pace.log.join("\n")).toBeLessThanOrEqual(3);
  });

  it("nos dias 3 a 5 vem a primeira escolha de verdade (2ª barraca ou estande de tiro)", () => {
    expect(pace.choice, pace.log.join("\n")).toBeGreaterThanOrEqual(3);
    expect(pace.choice, pace.log.join("\n")).toBeLessThanOrEqual(5);
  });

  it("o 2º batalhão chega por volta do dia 10", () => {
    expect(pace.battalion2, pace.log.join("\n")).toBeGreaterThanOrEqual(8);
    expect(pace.battalion2, pace.log.join("\n")).toBeLessThanOrEqual(12);
  });

  it("a paliçada pequena sobe entre os dias 15 e 20", () => {
    expect(pace.palisade, pace.log.join("\n")).toBeGreaterThanOrEqual(15);
    expect(pace.palisade, pace.log.join("\n")).toBeLessThanOrEqual(20);
  });

  it("a ameaça cresce com a fama, e não com o dia", () => {
    expect(goblinBandSize(0)).toBe(WORLD.WARBAND.BASE_SIZE);
    expect(goblinBandSize(30)).toBeGreaterThan(goblinBandSize(6));
    // Um bando sem fama no dia 60 ainda encontra os goblins do começo
    expect(goblinBandSize(0)).toBe(goblinBandSize(0.5));
  });
});
