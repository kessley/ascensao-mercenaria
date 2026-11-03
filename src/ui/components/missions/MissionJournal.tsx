import { useGameStore, type Expedition } from "../../../store/useGameStore";
import { MissionMap } from "./MissionMap";
import { MissionSteps, useArmyAt, useExpeditionNow, useMissionPlan } from "./MissionParts";
import { TROOPS } from "../../../utils/constants";

const title = "text-sm font-bold uppercase tracking-wider text-neutral-400";

/** O contrato que o Comandante está cumprindo. */
function ActiveMission() {
  const active = useGameStore((s) => s.activeContract);
  const day = useGameStore((s) => s.day);
  const world = useGameStore((s) => s.world);
  const abandon = useGameStore((s) => s.abandonContract);
  const army = useArmyAt();
  const plan = useMissionPlan(active?.contract ?? null, { progress: active?.progress, recovered: active?.recovered });
  if (!active || !plan || !world) return <p className="text-sm text-neutral-500">O Comandante não tem contrato em andamento. As ofertas ficam na mesa da Tenda.</p>;
  const c = active.contract;
  const left = active.deadline - day;
  return (
    <article className="flex flex-col gap-2 rounded border border-amber-500/70 bg-amber-950/30 p-3">
      <header className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="font-semibold text-amber-200">{c.title}</h3>
        <span className={`text-xs ${left <= 1 ? "font-bold text-red-400" : "text-neutral-300"}`}>
          {left > 0 ? `Faltam ${left} dia(s)` : "Último dia"} · prazo dia {active.deadline}
        </span>
      </header>
      <p className="text-xs text-neutral-400">
        Para {c.client} · pagamento na entrega: {c.reward} de ouro
      </p>
      <div className="flex flex-col gap-2">
        <MissionSteps plan={plan} army={army} />
        <MissionMap world={world} plan={plan} army={army} />
      </div>
      <button type="button" onClick={abandon} className="self-end rounded border border-red-500 px-2 py-1 text-xs text-red-200 hover:bg-red-900/50">
        Abandonar contrato
      </button>
    </article>
  );
}

function ExpeditionRow({ e }: { e: Expedition }) {
  const day = useGameStore((s) => s.day);
  const left = Math.max(0, e.returnDay - day);
  const span = Math.max(1, e.returnDay - e.departDay);
  const world = useGameStore((s) => s.world);
  const plan = useMissionPlan(e.contract);
  const { at, line } = useExpeditionNow(e);
  return (
    <li className="flex flex-col gap-1 rounded bg-neutral-800 p-2 text-sm">
      <div className="flex justify-between gap-2">
        <b>{e.contract.title}</b>
        <span className="text-xs text-sky-200">{left > 0 ? `volta em ${left} dia(s)` : "volta hoje"}</span>
      </div>
      <div className="text-xs text-neutral-400">{e.battalions.map((b) => `${b.name} (${TROOPS[b.troopType].label})`).join(", ")}</div>
      <div className="text-xs text-sky-200 first-letter:uppercase">{line}</div>
      {plan && world && <MissionMap world={world} plan={plan} army={at} who="A tropa" />}
      <div className="h-1 overflow-hidden rounded bg-neutral-700">
        <div className="h-1 bg-sky-400" style={{ width: `${Math.round(((span - left) / span) * 100)}%` }} />
      </div>
    </li>
  );
}

/** Diário: tudo o que o bando prometeu, quem está fora e no que deu. */
export function MissionJournal() {
  const expeditions = useGameStore((s) => s.expeditions);
  const reports = useGameStore((s) => s.expeditionReports);
  const quests = useGameStore((s) => s.quests);
  const summons = useGameStore((s) => s.summons);
  const summonsTown = useGameStore((s) => s.settlements.find((t) => t.id === s.summons?.townId)?.name);
  const day = useGameStore((s) => s.day);
  return (
    <>
      <section className="flex flex-col gap-2">
        <h2 className={title}>Com o Comandante</h2>
        <ActiveMission />
      </section>
      <section className="flex flex-col gap-2">
        <h2 className={title}>Tropas em missão</h2>
        {expeditions.length === 0 ? (
          <p className="text-sm text-neutral-500">Ninguém fora. Na mesa de contratos, "Enviar tropas" manda batalhões cumprirem um serviço sem você.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {expeditions.map((e) => (
              <ExpeditionRow key={e.id} e={e} />
            ))}
          </ul>
        )}
      </section>
      {(quests.length > 0 || summons) && (
        <section className="flex flex-col gap-2">
          <h2 className={title}>Corte</h2>
          <ul className="flex flex-col gap-1 text-sm">
            {summons && (
              <li className="rounded bg-neutral-800 p-2">
                <b>Convocação:</b> reunir o bando em {summonsTown} até o dia {summons.deadline}.
              </li>
            )}
            {quests.map((q) => (
              <li key={q.id} className="rounded bg-neutral-800 p-2">
                <b>{q.title}</b> <span className="text-xs text-neutral-400">· faltam {Math.max(0, q.deadline - day)} dia(s)</span>
                <span className="block text-xs text-neutral-300">{q.text}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
      {reports.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className={title}>Últimas notícias das tropas</h2>
          <ul className="flex flex-col gap-1 text-sm">
            {reports.map((r) => (
              <li key={r.id} className={`rounded p-2 ${r.success ? "bg-emerald-950/50" : "bg-red-950/50"}`}>
                <b>{r.success ? "Cumprido" : "Fracassou"}:</b> {r.title} <span className="text-xs text-neutral-400">· dia {r.day}</span>
                <span className="block text-xs text-neutral-300">
                  {r.success ? `${r.gold} de ouro · ` : ""}
                  {r.casualties} baixa(s){r.lost.length > 0 ? ` · perdidos: ${r.lost.join(", ")}` : ""}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
