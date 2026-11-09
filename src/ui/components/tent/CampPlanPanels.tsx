import { campNeeds, useGameStore } from "../../../store/useGameStore";
import {
  BUILD_ORDER,
  CAMP_BUILDINGS,
  CAMP_SIDES,
  CARGO_PER_WAGON,
  DITCH,
  NEED_LABEL,
  PALISADE,
  TAVERN_HIRE,
  VOLUNTEER_COST,
  buildProblem,
  costText,
  gateProblem,
  growProblem,
  guardOf,
  nextSize,
  packPlan,
  planCargo,
  refundOf,
  shortOf,
  tierOf,
  upgradeCost,
  volunteerRate,
  type CampNeed,
  type CampSide,
} from "../../../game/data/campGrid";
import { CAMP_MOVE, TROOPS } from "../../../utils/constants";
import { Button } from "../Button";
import { LieutenantCandidates } from "./LieutenantPanels";
import { InfirmaryPanel } from "./LogisticsPanels";

const sectionTitle = "text-sm font-bold uppercase tracking-wider text-neutral-400";
const SIDE_LABEL: Record<CampSide, string> = { N: "Norte", E: "Leste", S: "Sul", W: "Oeste" };

/** O que o bando tem para construir (a madeira fica no depósito). */
function useStock() {
  const gold = useGameStore((s) => s.gold);
  const wood = useGameStore((s) => s.depot.WOOD ?? 0);
  const iron = useGameStore((s) => s.iron);
  return { gold, wood, iron };
}

/** As quatro necessidades do acampamento (Marco 22, parte 1): o que há contra o que se precisa. */
export function CampNeedsPanel() {
  const campPlan = useGameStore((s) => s.campPlan);
  const battalions = useGameStore((s) => s.battalions);
  const exposure = useGameStore((s) => s.exposure);
  const training = useGameStore((s) => s.training);
  const campStay = useGameStore((s) => s.campStay);
  const fame = useGameStore((s) => s.fame);
  const needs = campNeeds({ campPlan, battalions, exposure, training, campStay, fame });
  const hint: Record<CampNeed, string> = {
    BEDS: "1 barraca abriga 1 batalhão; quem não tem dorme ao relento.",
    FOOD: "A fogueira cozinha para 2 batalhões e cada cozinha para mais 3. Quem come cru gasta 25% mais rações.",
    CURE: "Leitos da enfermaria. Ferido sem leito sara no ritmo do campo, mais devagar.",
    SECURITY: "Quanto do saque a paliçada, as torres e o fosso seguram. A fama atrai ataques.",
  };
  return (
    <section className="flex flex-col gap-1">
      <h2 className={sectionTitle}>Necessidades</h2>
      {(Object.keys(needs) as CampNeed[]).map((k) => {
        const n = needs[k];
        const pct = k === "SECURITY";
        const short = n.have + 1e-9 < n.need;
        const show = (v: number) => (pct ? `${Math.round(v * 100)}%` : `${v}`);
        return (
          <div key={k} className="flex items-baseline justify-between gap-2 text-sm" title={hint[k]}>
            <span className={short ? "text-red-300" : "text-emerald-300"}>
              {short ? "✗" : "✓"} {NEED_LABEL[k]}
            </span>
            <span className="font-mono text-xs text-neutral-300">
              {show(n.have)} / {show(n.need)}
            </span>
          </div>
        );
      })}
    </section>
  );
}

/**
 * A planta do acampamento (na tenda): construir, a paliçada, o fosso, o portão e levantar
 * acampamento. Escolher uma construção liga o modo construção: a peça fantasma segue o ponteiro.
 */
export function CampPlanPanel() {
  const plan = useGameStore((s) => s.campPlan);
  const fame = useGameStore((s) => s.fame);
  const battalions = useGameStore((s) => s.battalions.length);
  const wagons = useGameStore((s) => s.wagons.length);
  const training = useGameStore((s) => s.training.length);
  const setCampBuild = useGameStore((s) => s.setCampBuild);
  const growPalisade = useGameStore((s) => s.growPalisade);
  const digDitch = useGameStore((s) => s.digDitch);
  const setCampGate = useGameStore((s) => s.setCampGate);
  const send = useGameStore((s) => s.sendBattleCommand);
  const stock = useStock();
  const next = nextSize(plan);
  const step = next ? PALISADE[next] : null;
  const growWhy = next ? (growProblem(plan, { fame, battalions }) ?? shortOf(step!.cost, stock)) : null;
  const cargo = planCargo(plan);
  const room = wagons * CARGO_PER_WAGON;
  const left = packPlan(plan, wagons).left.filter((b) => !CAMP_BUILDINGS[b.kind].stays);

  return (
    <>
      <CampNeedsPanel />
      <section className="flex flex-col gap-2">
        <h2 className={sectionTitle}>
          {PALISADE[plan.size].label} <span className="font-normal normal-case text-neutral-500">· {plan.size}×{plan.size} células</span>
        </h2>
        {next && step ? (
          <div className="flex items-center justify-between gap-2 text-sm">
            <span className="text-neutral-200">
              Subir para {step.label.toLowerCase()} ({next}×{next})
              <span className="block text-xs text-neutral-400">
                {costText(step.cost)} · fama {step.fame} · {step.battalions} batalhões
                {step.needs.length > 0 && ` · ${step.needs.map(([k, n]) => (n > 1 ? `${n} × ${CAMP_BUILDINGS[k].label.toLowerCase()}` : CAMP_BUILDINGS[k].label.toLowerCase())).join(", ")}`}
              </span>
              {growWhy && <span className="block text-xs text-red-300">{growWhy}</span>}
            </span>
            <Button disabled={!!growWhy} onClick={() => growPalisade()}>
              Erguer
            </Button>
          </div>
        ) : (
          <p className="text-xs text-neutral-400">A paliçada já é a grande. O próximo passo é a fortaleza (Marco 22, parte 3).</p>
        )}
        {tierOf(plan) >= 1 && !plan.ditch && (
          <div className="flex items-center justify-between gap-2 text-sm">
            <span className="text-neutral-200">
              {DITCH.label} <span className="text-xs text-neutral-400">— {DITCH.effect}</span>
            </span>
            <Button disabled={!!shortOf(DITCH.cost, stock)} onClick={() => digDitch()}>
              {costText(DITCH.cost)}
            </Button>
          </div>
        )}
        <div className="flex flex-wrap items-center gap-1 text-xs text-neutral-300">
          <span className="mr-1">Portão:</span>
          {CAMP_SIDES.map((side) => {
            const why = side === plan.gate ? null : gateProblem(plan, side);
            return (
              <button
                key={side}
                type="button"
                title={why ?? undefined}
                disabled={!!why}
                onClick={() => setCampGate(side)}
                className={`rounded border px-2 py-1 ${side === plan.gate ? "border-amber-400 bg-amber-900/40 text-amber-200" : "border-neutral-600 bg-neutral-800 hover:border-neutral-400"} disabled:opacity-40`}
              >
                {SIDE_LABEL[side]}
              </button>
            );
          })}
        </div>
        <p className="text-xs text-neutral-500">Defesa: o acampamento desguarnecido segura {Math.round(guardOf(plan) * 100)}% do saque.</p>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className={sectionTitle}>
          Construir <span className="font-normal normal-case text-neutral-500">· {stock.gold} ouro · {stock.wood} madeira · {stock.iron} ferro</span>
        </h2>
        <p className="text-xs text-neutral-400">Escolha a construção e clique no acampamento onde ela vai ficar (Shift: várias; botão direito ou Esc: desistir).</p>
        <div className="flex flex-col gap-1">
          {BUILD_ORDER.map((kind) => {
            const def = CAMP_BUILDINGS[kind];
            const why = buildProblem(plan, kind) ?? shortOf(def.cost, stock);
            return (
              <div key={kind} className="flex items-center justify-between gap-2 rounded border border-neutral-800 bg-neutral-800/50 px-2 py-1 text-sm">
                <span className="text-neutral-200">
                  {def.label} <span className="text-xs text-neutral-500">{def.size}×{def.size}</span>
                  <span className="block text-xs text-neutral-400">{def.effect}</span>
                  {why && <span className="block text-xs text-red-300">{why}</span>}
                </span>
                <Button className="shrink-0 px-2 py-1 text-xs" disabled={!!why} onClick={() => setCampBuild({ kind })}>
                  {costText(def.cost)}
                </Button>
              </div>
            );
          })}
        </div>
      </section>

      <section className="flex flex-col gap-2 border-t border-neutral-700 pt-2 text-xs text-neutral-400">
        <span>
          Levantar o acampamento: {CAMP_MOVE.PACK_DAYS} dia(s) de trabalho. A planta vai nas carroças: carga {cargo} de {room} ({wagons} carroça(s) × {CARGO_PER_WAGON}).
          {left.length > 0 ? (
            <span className="text-red-300"> Não cabe e fica para trás: {left.map((b) => CAMP_BUILDINGS[b.kind].label.toLowerCase()).join(", ")}.</span>
          ) : (
            " Tudo cabe."
          )}{" "}
          O poço e o fosso ficam sempre. Monte de novo em terra firme longe de povoados ({CAMP_MOVE.PITCH_DAYS} dia): as árvores de dentro viram madeira.
        </span>
        <Button variant="danger" disabled={training > 0} onClick={() => send({ type: "PACK_CAMP", ids: [] })}>
          Levantar acampamento
        </Button>
      </section>
    </>
  );
}

/** O rodapé de toda construção: nível, subir de nível, mudar de lugar e desmontar. */
export function CampBuildingFooter({ buildingId }: { buildingId: string }) {
  const b = useGameStore((s) => s.campPlan.buildings.find((x) => x.id === buildingId));
  const upgrade = useGameStore((s) => s.upgradeBuilding);
  const dismantle = useGameStore((s) => s.dismantleBuilding);
  const setCampBuild = useGameStore((s) => s.setCampBuild);
  const stock = useStock();
  if (!b) return null;
  const def = CAMP_BUILDINGS[b.kind];
  const up = upgradeCost(b);
  const back = refundOf(b);
  return (
    <section className="flex flex-col gap-2 border-t border-neutral-700 pt-3">
      <h2 className={sectionTitle}>
        {def.label}
        {def.upgrades && <span className="font-normal normal-case text-neutral-500"> · nível {b.level} de {def.upgrades.length + 1}</span>}
      </h2>
      <p className="text-xs text-neutral-400">{def.effect}</p>
      <div className="flex flex-wrap gap-2">
        {up && (
          <Button className="px-3 py-1 text-xs" disabled={!!shortOf(up, stock)} title={shortOf(up, stock) ?? undefined} onClick={() => upgrade(b.id)}>
            Nível {b.level + 1}: {costText(up)}
          </Button>
        )}
        <Button variant="quiet" className="px-3 py-1 text-xs" onClick={() => setCampBuild({ kind: b.kind, moveId: b.id })}>
          Mudar de lugar
        </Button>
        {!def.fixed && (
          <Button variant="danger" className="px-3 py-1 text-xs" onClick={() => dismantle(b.id)}>
            Desmontar (volta {costText({ gold: back.gold, wood: back.wood, iron: back.iron })})
          </Button>
        )}
      </div>
    </section>
  );
}

/** O mastro de recrutamento: os voluntários que esperam e formar um batalhão com eles. */
function VolunteersPanel() {
  const plan = useGameStore((s) => s.campPlan);
  const volunteers = useGameStore((s) => s.volunteers);
  const gold = useGameStore((s) => s.gold);
  const form = useGameStore((s) => s.formVolunteers);
  const rate = volunteerRate(plan);
  const cost = Math.round(TROOPS.INFANTRY.cost * VOLUNTEER_COST);
  return (
    <section className="flex flex-col gap-2">
      <h2 className={sectionTitle}>Voluntários</h2>
      <p className="text-sm text-neutral-200">
        {volunteers} de {rate.cap} esperando · chegam {rate.perDay} por dia enquanto o acampamento está montado.
      </p>
      <Button disabled={volunteers < 8 || gold < cost} onClick={() => form()}>
        Formar um batalhão de infantaria ({cost} ouro de equipamento)
      </Button>
    </section>
  );
}

/** O que cada construção nova mostra (as de antes abrem os painéis de sempre). */
export function CampBuildingContent({ buildingId }: { buildingId: string }) {
  const b = useGameStore((s) => s.campPlan.buildings.find((x) => x.id === buildingId));
  if (!b) return <p className="text-sm text-neutral-400">Esta construção não existe mais.</p>;
  return (
    <>
      {b.kind === "RECRUIT_MAST" && <VolunteersPanel />}
      {b.kind === "OFFICERS_TENT" && <LieutenantCandidates />}
      {b.kind === "INFIRMARY" && <InfirmaryPanel />}
      {(b.kind === "KITCHEN" || b.kind === "BARRACK" || b.kind === "WELL" || b.kind === "TOWER") && <CampNeedsPanel />}
      <CampBuildingFooter buildingId={buildingId} />
    </>
  );
}

/** Taverna de um povoado: um batalhão de infantaria por semana, mais caro que no posto. */
export function TavernHire({ settlementId }: { settlementId: string }) {
  const last = useGameStore((s) => s.tavernHires[settlementId]);
  const day = useGameStore((s) => s.day);
  const gold = useGameStore((s) => s.gold);
  const hire = useGameStore((s) => s.hireAtTavern);
  const cost = Math.round(TROOPS.INFANTRY.cost * TAVERN_HIRE.COST);
  const wait = last === undefined ? 0 : Math.max(0, TAVERN_HIRE.EVERY_DAYS - (day - last));
  return (
    <section className="flex flex-col gap-2">
      <h2 className={sectionTitle}>Gente procurando soldo</h2>
      <p className="text-xs text-neutral-400">
        Uma vez por semana, um grupo de homens da taverna assina com o bando como um batalhão de infantaria.
        {wait > 0 && ` Os de hoje já foram: volte em ${wait} dia(s).`}
      </p>
      <Button disabled={wait > 0 || gold < cost} onClick={() => hire(settlementId)}>
        Contratar um batalhão ({cost} ouro)
      </Button>
    </section>
  );
}
