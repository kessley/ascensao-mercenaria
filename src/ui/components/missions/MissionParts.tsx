import { useMemo, useState } from "react";
import { missionPlan, wayTo, type MissionPlan, type MissionProgress } from "../../../game/data/missionGuide";
import type { Contract } from "../../../game/data/contracts";
import { canDelegate, expectedLosses, expeditionDays, expeditionLine, expeditionRations, expeditionStage, foeStrength, partyStrength, successChance } from "../../../game/sim/expeditions";
import { useGameStore, type BattalionData, type Expedition } from "../../../store/useGameStore";
import { freightOf } from "../../../game/sim/trade";
import { TROOPS } from "../../../utils/constants";
import { captainName, temperOf, TEMPER_LABEL, type CaptainData } from "../../../game/data/captains";
import type { Point } from "../../../utils/math";

/** Onde o bando está agora (no acampamento, antes de o HUD publicar, é o próprio acampamento). */
export function useArmyAt(): Point | null {
  const hud = useGameStore((s) => s.battleHud?.position ?? null);
  const camp = useGameStore((s) => s.world?.camp.center ?? null);
  return hud ?? camp;
}

/** Onde uma tropa em expedição está e o que ela faz agora. */
export function useExpeditionNow(e: Expedition): { at: Point; line: string } {
  const now = useGameStore((s) => s.day + s.dayProgress);
  const plan = useMissionPlan(e.contract);
  const army = useArmyAt();
  const stage = expeditionStage(e, now, army ?? { x: 0, y: 0 });
  return { at: stage.at, line: expeditionLine(e.contract, stage, plan?.from?.name, plan?.to?.name) };
}

/** O plano do contrato ativo (ou de uma oferta) com o que já foi feito. */
export function useMissionPlan(c: Contract | null, state: MissionProgress = {}): MissionPlan | null {
  const world = useGameStore((s) => s.world);
  const settlements = useGameStore((s) => s.settlements);
  const escort = useGameStore((s) => s.battleHud?.escort ?? null);
  const cargo = useGameStore((s) => (c?.good ? freightOf(s.freight, c.good) : 0));
  const { progress, recovered } = state;
  return useMemo(() => (c && world ? missionPlan(c, { world, settlements }, { progress, recovered, escort, cargo }) : null), [c, world, settlements, progress, recovered, escort, cargo]);
}

/** Lista dos passos, com a distância de cada lugar. */
export function MissionSteps({ plan, army }: { plan: MissionPlan; army: Point | null }) {
  const current = plan.steps.findIndex((s) => !s.done);
  return (
    <ol className="flex flex-col gap-1 text-sm">
      {plan.steps.map((step, i) => (
        <li key={step.text} className={`flex gap-2 ${step.done ? "text-neutral-500 line-through" : i === current ? "text-white" : "text-neutral-300"}`}>
          <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs font-bold ${step.done ? "bg-emerald-800 text-emerald-100" : i === current ? "bg-amber-500 text-black" : "bg-neutral-700"}`}>{step.done ? "✓" : i + 1}</span>
          <span>
            {step.text}
            {step.at && army && !step.done && <span className="block text-xs text-amber-200">{wayTo(army, step.at)}</span>}
          </span>
        </li>
      ))}
    </ol>
  );
}

function percent(v: number): string {
  return `${Math.round(v * 100)}%`;
}

/** Escolher o capitão que leva a companhia dele para cumprir o contrato no lugar do Comandante. */
export function ExpeditionPicker({ contract, onClose }: { contract: Contract; onClose: () => void }) {
  const battalions = useGameStore((s) => s.battalions);
  const lieutenants = useGameStore((s) => s.lieutenants);
  const captains = useGameStore((s) => s.captains);
  const training = useGameStore((s) => s.training);
  const rations = useGameStore((s) => s.rations);
  const send = useGameStore((s) => s.sendExpedition);
  const [picked, setPicked] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const led = (b: BattalionData) => lieutenants.some((l) => l.battalionId === b.id);
  const busy = (b: BattalionData) => training.some((t) => t.battalionId === b.id);
  const companyOf = (c: CaptainData) => battalions.filter((b) => c.battalionIds.includes(b.id) && !busy(b));
  const captain = captains.find((c) => c.id === picked) ?? null;
  const party = captain ? companyOf(captain) : [];
  const days = expeditionDays(contract);
  const food = expeditionRations(party, days);
  const own = partyStrength(party, led);
  const foe = foeStrength(contract);
  const tactics = captain?.tactics ?? 3;
  const chance = successChance(own, foe, tactics);

  return (
    <div className="flex flex-col gap-2 rounded border border-sky-700 bg-sky-950/40 p-2 text-sm">
      <h4 className="font-semibold text-sky-200">Quem leva a companhia?</h4>
      {captains.length === 0 && <p className="text-xs text-amber-200">Sem capitães no acampamento. Promova um tenente veterano na Tenda ou contrate um no Posto de Recrutamento.</p>}
      <div className="flex flex-col gap-1">
        {captains.map((c) => {
          const company = companyOf(c);
          return (
            <label key={c.id} className={`flex items-start gap-2 text-xs ${company.length === 0 ? "text-neutral-500" : "text-neutral-200"}`}>
              <input type="radio" name="captain" disabled={company.length === 0} checked={picked === c.id} onChange={() => setPicked(c.id)} className="mt-0.5 accent-sky-400" />
              <span>
                <b>{captainName(c)}</b> · tática {c.tactics} · {TEMPER_LABEL[temperOf(c)].split(":")[0]}
                <span className="block text-neutral-400">
                  {company.length > 0 ? company.map((b) => `${b.name} (${TROOPS[b.troopType].label}, ${b.soldiers}${led(b) ? ", com tenente" : ""})`).join(" · ") : "companhia vazia ou em treino"}
                </span>
              </span>
            </label>
          );
        })}
      </div>
      {party.length > 0 && (
        <p className="text-xs text-neutral-200">
          Chance de cumprir: <b className={chance >= 0.6 ? "text-emerald-300" : "text-red-300"}>{percent(chance)}</b> · baixas: cerca de {percent(expectedLosses(own, foe, true, tactics))} se der certo, {percent(expectedLosses(own, foe, false, tactics))} se der errado · fora por {days} dia(s) ·{" "}
          <span className={food > rations ? "text-red-300" : ""}>{food} rações</span>
        </p>
      )}
      <p className="text-xs text-neutral-400">Longe do Comandante, o capitão decide sozinho: você só fica sabendo no que deu, pelo relatório dele.</p>
      {problem && <p className="text-xs text-red-300">{problem}</p>}
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onClose} className="rounded border border-neutral-600 px-2 py-1 text-xs hover:border-neutral-400">
          Cancelar
        </button>
        <button
          type="button"
          disabled={party.length === 0}
          onClick={() => {
            const why = picked ? send(contract.id, picked) : "Escolha um capitão.";
            if (why) setProblem(why);
            else onClose();
          }}
          className="rounded border border-sky-400 bg-sky-700 px-2 py-1 text-xs font-semibold text-white hover:bg-sky-600 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Enviar a companhia
        </button>
      </div>
    </div>
  );
}

/** Enviar tropas: botão e seletor, quando o contrato permite. */
export function DelegateButton({ contract }: { contract: Contract }) {
  const [open, setOpen] = useState(false);
  if (!canDelegate(contract)) return <span className="text-xs text-neutral-500">Este serviço pede o Comandante em pessoa.</span>;
  if (open) return <ExpeditionPicker contract={contract} onClose={() => setOpen(false)} />;
  return (
    <button type="button" onClick={() => setOpen(true)} className="rounded border border-sky-500 px-3 py-1 text-sm text-sky-200 hover:bg-sky-900/50">
      Enviar tropas
    </button>
  );
}
