import { useShallow } from "zustand/react/shallow";
import { campNeeds, campStaffing, inCampOf, shiftOf, useGameStore } from "../../../store/useGameStore";
import {
  BUILD_GROUPS,
  CAMP_BUILDINGS,
  CAMP_NEEDS,
  NEED_SHORT,
  isBuilt,
  workOf,
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
import { CARPENTRY, LABOR, SHIFTS, SHIFT_EFFECT, SHIFT_LABEL, carpentryProblem, daysLeft, upkeepOf, worksOf, type CarpentryItem } from "../../../game/sim/campDays";
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

/** O que o painel do acampamento olha (os batalhões, os seguidores, os turnos e a planta). */
function useCampView() {
  return useGameStore(
    useShallow((s) => ({
      campPlan: s.campPlan,
      battalions: s.battalions,
      exposure: s.exposure,
      training: s.training,
      campStay: s.campStay,
      fame: s.fame,
      followers: s.followers,
      shifts: s.shifts,
      campPacked: s.campPacked,
    })),
  );
}

const HINT: Record<CampNeed, string> = {
  BEDS: "1 barraca abriga 1 batalhão (o barracão, 2).",
  FOOD: "A fogueira cozinha para 2 batalhões, cada cozinha para mais 3 (o refeitório, 5).",
  SALUBRITY: "Soldados no acampamento contra o que ele aguenta: o poço e a latrina somam 30 cada.",
  CURE: "Leitos da enfermaria (o hospital tem 16) contra feridos e doentes no acampamento.",
  MORALE: "A moral das construções (taverna, dados, estandarte, altar...) contra os batalhões no acampamento.",
  SECURITY: "Quanto do saque a defesa e a guarda seguram. A fama atrai ataques.",
  CRAFT: "Oficinas funcionando (ferraria, carpintaria, selaria, alfaiataria, arsenal): uma a cada 3 batalhões.",
};

/** As sete necessidades do acampamento (GDD 9.3): o que há contra o que se precisa. */
export function CampNeedsPanel() {
  const view = useCampView();
  const needs = campNeeds(view);
  return (
    <section className="flex flex-col gap-1">
      <h2 className={sectionTitle}>Necessidades</h2>
      {CAMP_NEEDS.map((k) => {
        const n = needs[k];
        const pct = k === "SECURITY";
        const short = n.have + 1e-9 < n.need;
        const show = (v: number) => (pct ? `${Math.round(v * 100)}%` : `${v}`);
        return (
          <div key={k} className="flex items-baseline justify-between gap-2 text-sm" title={HINT[k]}>
            <span className={short ? "text-red-300" : "text-emerald-300"}>
              {short ? "✗" : "✓"} {NEED_LABEL[k]}
              {short && <span className="ml-1 text-xs text-red-300/70">— {NEED_SHORT[k]}</span>}
            </span>
            <span className="shrink-0 font-mono text-xs text-neutral-300">
              {show(n.have)} / {show(n.need)}
            </span>
          </div>
        );
      })}
    </section>
  );
}

/** Turnos dos batalhões, gente nos postos e as obras (GDD 9.4). */
export function CampLifePanel() {
  const view = useCampView();
  const setShift = useGameStore((s) => s.setShift);
  const inCamp = inCampOf(view);
  const staffing = campStaffing(view);
  const works = worksOf(view.campPlan);
  const upkeep = upkeepOf(view.campPlan);
  const posts = view.campPlan.buildings.filter((b) => CAMP_BUILDINGS[b.kind].post && isBuilt(b));
  return (
    <>
      <section className="flex flex-col gap-2">
        <h2 className={sectionTitle}>Turnos</h2>
        {inCamp.length === 0 && <p className="text-xs text-neutral-400">Nenhum batalhão no acampamento.</p>}
        {inCamp.map((b) => {
          const cur = shiftOf(view, b.id);
          const locked = view.training.some((t) => t.battalionId === b.id);
          return (
            <div key={b.id} className="flex flex-wrap items-center justify-between gap-1 text-sm">
              <span className="text-neutral-200">{b.name}</span>
              <span className="flex gap-1">
                {SHIFTS.map((sh) => (
                  <button
                    key={sh}
                    type="button"
                    title={SHIFT_EFFECT[sh]}
                    disabled={locked}
                    onClick={() => setShift(b.id, sh)}
                    className={`rounded border px-2 py-0.5 text-xs ${cur === sh ? "border-amber-400 bg-amber-900/40 text-amber-200" : "border-neutral-600 bg-neutral-800 hover:border-neutral-400"} disabled:opacity-50`}
                  >
                    {SHIFT_LABEL[sh]}
                  </button>
                ))}
              </span>
            </div>
          );
        })}
        <p className="text-xs text-neutral-500">
          Treino dá experiência todo dia; obra dá {LABOR.BATTALION} de trabalho; guarda segura o saque. Quem está no Campo de Treino pago fica no treino.
        </p>
      </section>

      <section className="flex flex-col gap-1">
        <h2 className={sectionTitle}>
          Postos <span className="font-normal normal-case text-neutral-500">· {view.followers.length} seguidor(es)</span>
        </h2>
        {posts.length === 0 && <p className="text-xs text-neutral-400">Nenhuma construção com posto ainda (cozinha, enfermaria, oficinas...).</p>}
        {posts.map((b) => (
          <div key={b.id} className="flex items-baseline justify-between gap-2 text-sm">
            <span className="text-neutral-200">{CAMP_BUILDINGS[b.kind].label}</span>
            <span className={`text-xs ${b.off ? "text-neutral-500" : staffing.staff.has(b.id) ? "text-emerald-300" : "text-red-300"}`}>
              {b.off ? "fechado" : staffing.staff.get(b.id) ?? "parado: sem ninguém"}
            </span>
          </div>
        ))}
        {staffing.idle.length > 0 && <p className="text-xs text-red-300/80">Ponha um batalhão no turno de obra para cobrir os postos sem ninguém.</p>}
      </section>

      <section className="flex flex-col gap-1">
        <h2 className={sectionTitle}>
          Obras <span className="font-normal normal-case text-neutral-500">· {staffing.labor} de trabalho por dia</span>
        </h2>
        {works.length === 0 && <p className="text-xs text-neutral-400">Nenhuma obra em andamento.</p>}
        {works.map((b) => {
          const total = workOf(b.kind);
          const done = b.built ?? 0;
          const days = daysLeft(view.campPlan, b.id, staffing.labor);
          return (
            <div key={b.id} className="flex flex-col gap-0.5 text-sm">
              <div className="flex justify-between gap-2">
                <span className="text-neutral-200">{CAMP_BUILDINGS[b.kind].label}</span>
                <span className="text-xs text-neutral-400">
                  {done} de {total} · {Number.isFinite(days) ? `${days} dia(s)` : "parada"}
                </span>
              </div>
              <div className="h-1.5 rounded bg-neutral-800">
                <div className="h-1.5 rounded bg-amber-500" style={{ width: `${Math.round((done / total) * 100)}%` }} />
              </div>
            </div>
          );
        })}
        <p className="text-xs text-neutral-500">
          Constroem o estado-maior ({LABOR.BASE} por dia), os seguidores livres ({LABOR.FOLLOWER} cada) e os batalhões no turno de obra. Manutenção: {upkeep} de ouro por semana, no dia do pagamento.
        </p>
      </section>
    </>
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
      <CampLifePanel />
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
        {BUILD_GROUPS.map((group) => (
          <div key={group.label} className="flex flex-col gap-1">
            <h3 className="text-xs font-bold uppercase tracking-wider text-amber-200/70">{group.label}</h3>
            {group.kinds.map((kind) => {
              const def = CAMP_BUILDINGS[kind];
              const why = buildProblem(plan, kind) ?? shortOf(def.cost, stock);
              return (
                <div key={kind} className="flex items-center justify-between gap-2 rounded border border-neutral-800 bg-neutral-800/50 px-2 py-1 text-sm">
                  <span className="text-neutral-200">
                    {def.label}{" "}
                    <span className="text-xs text-neutral-500">
                      {def.size}×{def.size} · {workOf(kind)} de trabalho{def.post ? " · posto" : ""}
                      {def.upkeep ? ` · ${def.upkeep} ouro/semana` : ""}
                    </span>
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
        ))}
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
  const togglePost = useGameStore((s) => s.togglePost);
  const view = useCampView();
  const setCampBuild = useGameStore((s) => s.setCampBuild);
  const stock = useStock();
  if (!b) return null;
  const def = CAMP_BUILDINGS[b.kind];
  const built = isBuilt(b);
  const up = built ? upgradeCost(b) : null;
  const back = b.built === 0 ? { gold: def.cost.gold, wood: def.cost.wood ?? 0, iron: def.cost.iron ?? 0 } : refundOf(b);
  const who = def.post && built ? (b.off ? "fechado" : campStaffing(view).staff.get(b.id) ?? "parado: sem ninguém") : null;
  return (
    <section className="flex flex-col gap-2 border-t border-neutral-700 pt-3">
      <h2 className={sectionTitle}>
        {def.label}
        {def.upgrades && <span className="font-normal normal-case text-neutral-500"> · nível {b.level} de {def.upgrades.length + 1}</span>}
      </h2>
      <p className="text-xs text-neutral-400">{def.effect}</p>
      {!built && (
        <p className="text-sm text-amber-200">
          Em obra: {b.built ?? 0} de {workOf(b.kind)} de trabalho. Só faz efeito quando ficar pronta.
        </p>
      )}
      {who && (
        <p className="text-sm text-neutral-300">
          No posto: <span className={staffing(who)}>{who}</span>
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        {def.post && built && (
          <Button variant="quiet" className="px-3 py-1 text-xs" onClick={() => togglePost(b.id)}>
            {b.off ? "Abrir o posto" : "Fechar o posto"}
          </Button>
        )}
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

const staffing = (who: string) => (who === "fechado" ? "text-neutral-500" : who.startsWith("parado") ? "text-red-300" : "text-emerald-300");

/** A carpintaria: carroças, escadas e o aríete para o próximo cerco. */
function CarpentryPanel() {
  const view = useCampView();
  const kit = useGameStore((s) => s.siegeKit);
  const wagons = useGameStore((s) => s.wagons.length);
  const make = useGameStore((s) => s.carpentry);
  const stock = useStock();
  const working = campStaffing(view).working;
  return (
    <section className="flex flex-col gap-2">
      <h2 className={sectionTitle}>
        Encomendas <span className="font-normal normal-case text-neutral-500">· prontas: {kit.ladders} escada(s), {kit.rams} aríete</span>
      </h2>
      {(Object.keys(CARPENTRY) as CarpentryItem[]).map((item) => {
        const def = CARPENTRY[item];
        const why = carpentryProblem(view.campPlan, working, item, kit, wagons) ?? shortOf(def.cost, stock);
        return (
          <div key={item} className="flex items-center justify-between gap-2 text-sm">
            <span className="text-neutral-200">
              {def.label}
              <span className="block text-xs text-neutral-400">{def.effect}</span>
              {why && <span className="block text-xs text-red-300">{why}</span>}
            </span>
            <Button className="shrink-0 px-2 py-1 text-xs" disabled={!!why} onClick={() => make(item)}>
              {costText(def.cost)}
            </Button>
          </div>
        );
      })}
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
      {b.kind === "CARPENTRY" && <CarpentryPanel />}
      {b.kind === "BARRACK" && <CampLifePanel />}
      {CAMP_BUILDINGS[b.kind].need && <CampNeedsPanel />}
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
