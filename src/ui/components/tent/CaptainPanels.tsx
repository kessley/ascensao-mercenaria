import { useState, type DragEvent } from "react";
import { useGameStore, type BattalionData } from "../../../store/useGameStore";
import { allCaptains } from "../../../store/captainSlice";
import { captainName, companyLimit, ORIGIN_LABEL, temperOf, TEMPER_LABEL, type CaptainData } from "../../../game/data/captains";
import { fullName, TRAITS } from "../../../game/data/lieutenants";
import { CAPTAINS, TROOPS } from "../../../utils/constants";
import { LoyaltyBar } from "./LieutenantPanels";

const sectionTitle = "text-sm font-bold uppercase tracking-wider text-neutral-400";

/** Os quatro números do capitão, de 1 a 5. */
function Stats({ c }: { c: CaptainData }) {
  const rows: [string, number, string][] = [
    ["Comando", c.command, `conduz até ${companyLimit(c)} batalhões; perto dele, a moral cai menos`],
    ["Tática", c.tactics, "como ele luta sozinho e cumpre as missões"],
    ["Duelo", c.duel, "a mão dele num um contra um"],
    ["Ambição", c.ambition, "quanto ele quer mais (com companhia grande, perde lealdade)"],
  ];
  return (
    <div className="grid grid-cols-[auto_auto_1fr] items-center gap-x-2 gap-y-0.5 text-xs">
      {rows.map(([label, v, hint]) => (
        <div key={label} className="contents" title={hint}>
          <span className="text-neutral-400">{label}</span>
          <span className="font-mono tracking-widest text-amber-300">{"●".repeat(v)}<span className="text-neutral-600">{"●".repeat(5 - v)}</span></span>
          <span className="text-[11px] text-neutral-500">{hint}</span>
        </div>
      ))}
    </div>
  );
}

function CaptainTraits({ c }: { c: CaptainData }) {
  return (
    <div className="flex flex-wrap gap-1 text-xs">
      {c.traits.map((t) => (
        <span key={t} title={TRAITS[t].description} className="rounded bg-neutral-700 px-2 py-0.5 text-neutral-200">
          {TRAITS[t].label}
        </span>
      ))}
      <span className="rounded bg-amber-900/60 px-2 py-0.5 text-amber-200">{TEMPER_LABEL[temperOf(c)]}</span>
    </div>
  );
}

/** Ficha do capitão: quem ele é, os números, a companhia e a crônica. */
export function CaptainSheet({ captain: c }: { captain: CaptainData }) {
  const battalions = useGameStore((s) => s.battalions);
  const heirId = useGameStore((s) => s.heirId);
  const setHeir = useGameStore((s) => s.setHeir);
  const setGuard = useGameStore((s) => s.setGuard);
  const setCompany = useGameStore((s) => s.setCompany);
  const dismiss = useGameStore((s) => s.dismissCaptain);
  const company = c.battalionIds.map((id) => battalions.find((b) => b.id === id)).filter((b): b is BattalionData => !!b);

  return (
    <div className="flex flex-col gap-3">
      <button type="button" onClick={() => setHeir(c.id === heirId ? null : c.id)} className={`self-start rounded border px-2 py-1 text-xs ${c.id === heirId ? "border-amber-400 text-amber-200" : "border-neutral-600 text-neutral-200"}`}>
        {c.id === heirId ? "Herdeiro no testamento" : "Nomear herdeiro no testamento"}
      </button>
      <div className="flex flex-col gap-2 rounded bg-neutral-800 p-3 text-sm">
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-base font-bold">{captainName(c)}</span>
          <span className="font-mono text-xs text-neutral-400">
            {c.wage}/sem. · {c.kills} abates · {c.battles} batalha(s)
          </span>
        </div>
        <p className="text-xs text-neutral-400">{ORIGIN_LABEL[c.origin]}</p>
        <p className="text-xs italic text-neutral-300">{c.backstory}</p>
        <CaptainTraits c={c} />
        <Stats c={c} />
        <LoyaltyBar value={c.loyalty} />
        {c.loyalty <= 30 && <p className="text-xs text-red-400">Lealdade perigosamente baixa: a {CAPTAINS.LOYALTY_DESERT_AT} ou menos, ele vai embora e leva a companhia.</p>}
      </div>

      <section className="flex flex-col gap-2">
        <h3 className={sectionTitle}>
          Companhia <span className="font-normal normal-case text-neutral-500">· {company.length}/{companyLimit(c)}</span>
        </h3>
        {company.length === 0 && <p className="text-xs text-neutral-500">Sem batalhões. Monte a companhia no quadro de comando, na Tenda.</p>}
        {company.map((b, i) => (
          <div key={b.id} className="flex items-center justify-between gap-2 rounded bg-neutral-800 px-2 py-1 text-xs">
            <span>
              {i === 0 ? "⚑ " : ""}
              <b>{b.name}</b> · {TROOPS[b.troopType].label} · {b.soldiers} soldados
              {i === 0 && <span className="text-amber-200"> · guarda (ele marcha com ela)</span>}
            </span>
            <span className="flex gap-1">
              {i > 0 && (
                <button type="button" onClick={() => setGuard(c.id, b.id)} className="rounded border border-neutral-600 px-1.5 hover:border-amber-400">
                  Guarda
                </button>
              )}
              <button type="button" onClick={() => setCompany(b.id, null)} className="rounded border border-neutral-600 px-1.5 text-neutral-400 hover:border-neutral-400">
                Tirar
              </button>
            </span>
          </div>
        ))}
        {c.ambition >= 4 && company.length >= 3 && <p className="text-xs text-yellow-400">Ambicioso com companhia grande: perde lealdade a cada semana.</p>}
      </section>

      <section className="flex flex-col gap-1">
        <h3 className={sectionTitle}>Crônica</h3>
        <ol className="flex flex-col gap-0.5 rounded bg-neutral-800 p-2 text-xs text-neutral-300">
          {[...c.history].reverse().map((line, i) => (
            <li key={i}>{line}</li>
          ))}
        </ol>
      </section>

      <button type="button" onClick={() => dismiss(c.id)} className="self-start text-xs text-red-400 underline-offset-2 hover:underline">
        Dispensar do bando
      </button>
    </div>
  );
}

type Drag = { kind: "BATTALION"; id: string } | { kind: "LIEUTENANT"; id: string };
const DRAG_TYPE = "application/x-comando";

function readDrag(e: DragEvent): Drag | null {
  try {
    return JSON.parse(e.dataTransfer.getData(DRAG_TYPE)) as Drag;
  } catch {
    return null;
  }
}

/** Cartão de um batalhão no quadro: arrasta para outra companhia; recebe um tenente arrastado. */
function BattalionCard({ b, guard, onDrop }: { b: BattalionData; guard: boolean; onDrop: (d: Drag, battalionId: string) => void }) {
  const lieutenant = useGameStore((s) => s.lieutenants.find((l) => l.battalionId === b.id));
  const captains = useGameStore((s) => s.captains);
  const setCompany = useGameStore((s) => s.setCompany);
  const [problem, setProblem] = useState<string | null>(null);
  const current = captains.find((c) => c.battalionIds.includes(b.id));
  return (
    <div
      draggable
      data-battalion={b.id}
      onDragStart={(e) => e.dataTransfer.setData(DRAG_TYPE, JSON.stringify({ kind: "BATTALION", id: b.id } satisfies Drag))}
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        const d = readDrag(e);
        if (d?.kind !== "LIEUTENANT") return;
        e.stopPropagation();
        onDrop(d, b.id);
      }}
      className="flex cursor-grab flex-col gap-1 rounded border border-neutral-700 bg-neutral-800 px-2 py-1 text-xs active:cursor-grabbing"
    >
      <div className="flex justify-between gap-2">
        <span>
          {guard ? "⚑ " : ""}
          <b>{b.name}</b> <span className="text-neutral-400">{TROOPS[b.troopType].label} · {b.soldiers} · nv {b.level}</span>
        </span>
      </div>
      <span className={lieutenant ? "text-sky-300" : "text-neutral-500"}>{lieutenant ? `tenente ${fullName(lieutenant)}` : "sem tenente (arraste um para cá)"}</span>
      <label className="flex items-center gap-1 text-neutral-400">
        Companhia
        <select
          aria-label={`Companhia de ${b.name}`}
          value={current?.id ?? ""}
          onChange={(e) => setProblem(setCompany(b.id, e.target.value || null))}
          className="rounded bg-neutral-900 px-1 py-0.5 text-neutral-200"
        >
          <option value="">do Comandante</option>
          {captains.map((c) => (
            <option key={c.id} value={c.id}>
              {captainName(c)}
            </option>
          ))}
        </select>
      </label>
      {problem && <span className="text-red-300">{problem}</span>}
    </div>
  );
}

/**
 * Quadro de comando (Tenda): uma coluna para os batalhões que ficam com o Comandante e uma para
 * cada companhia. Arraste batalhões entre as colunas e tenentes para os batalhões.
 */
export function CommandBoard() {
  const battalions = useGameStore((s) => s.battalions);
  const captains = useGameStore((s) => s.captains);
  const expeditions = useGameStore((s) => s.expeditions);
  const lieutenants = useGameStore((s) => s.lieutenants);
  const setCompany = useGameStore((s) => s.setCompany);
  const assign = useGameStore((s) => s.assignLieutenant);
  const setCampPanel = useGameStore((s) => s.setCampPanel);
  const [problem, setProblem] = useState<string | null>(null);
  const away = expeditions.filter((e) => e.captain);
  const own = battalions.filter((b) => !captains.some((c) => c.battalionIds.includes(b.id)));
  const drop = (d: Drag, battalionId: string) => {
    if (d.kind === "LIEUTENANT") assign(d.id, battalionId);
  };
  const column = (captainId: string | null) => ({
    onDragOver: (e: DragEvent) => e.preventDefault(),
    onDrop: (e: DragEvent) => {
      const d = readDrag(e);
      if (d?.kind === "BATTALION") setProblem(setCompany(d.id, captainId));
    },
  });

  return (
    <section className="flex flex-col gap-2">
      <h2 className={sectionTitle}>Quadro de comando</h2>
      <div className="flex flex-wrap gap-1 text-xs">
        {lieutenants.map((l) => (
          <span
            key={l.id}
            draggable
            onDragStart={(e) => e.dataTransfer.setData(DRAG_TYPE, JSON.stringify({ kind: "LIEUTENANT", id: l.id } satisfies Drag))}
            className={`cursor-grab rounded border px-2 py-0.5 ${l.battalionId ? "border-sky-800 text-sky-300" : "border-sky-500 text-sky-100"}`}
            title="Arraste para um batalhão"
          >
            {fullName(l)}
          </span>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div {...column(null)} className="flex flex-col gap-1 rounded border border-dashed border-neutral-600 p-2">
          <h3 className="text-xs font-semibold text-neutral-300">Com o Comandante</h3>
          {own.length === 0 && <p className="text-[11px] text-neutral-500">Todos os batalhões estão em companhias.</p>}
          {own.map((b) => (
            <BattalionCard key={b.id} b={b} guard={false} onDrop={drop} />
          ))}
        </div>
        {captains.map((c) => {
          const company = c.battalionIds.map((id) => battalions.find((b) => b.id === id)).filter((b): b is BattalionData => !!b);
          return (
            <div key={c.id} {...column(c.id)} data-company={c.id} className="flex flex-col gap-1 rounded border border-dashed border-amber-700/70 p-2">
              <button type="button" onClick={() => setCampPanel({ kind: "CAPTAIN", captainId: c.id })} className="text-left text-xs font-semibold text-amber-200 hover:underline">
                Capitão {captainName(c)} <span className="font-normal text-neutral-400">· {company.length}/{companyLimit(c)}</span>
              </button>
              {company.length === 0 && <p className="text-[11px] text-neutral-500">Arraste batalhões para cá.</p>}
              {company.map((b, i) => (
                <BattalionCard key={b.id} b={b} guard={i === 0} onDrop={drop} />
              ))}
            </div>
          );
        })}
        {away.map((e) => (
          <div key={e.id} className="flex flex-col gap-1 rounded border border-dashed border-sky-800 p-2 text-xs text-neutral-400">
            <span className="font-semibold text-sky-300">Capitão {e.captain && captainName(e.captain)}</span>
            fora, em “{e.contract.title}” (volta no dia {e.returnDay})
          </div>
        ))}
      </div>
      {problem && <p className="text-xs text-red-300">{problem}</p>}
      <p className="text-[11px] text-neutral-500">
        Na batalha, a ordem dada a um batalhão de uma companhia vai para o capitão, que a passa aos outros: um mensageiro por companhia. Missões só saem com um capitão. Promova tenentes veteranos pela ficha deles ou contrate capitães no Posto de Recrutamento.
      </p>
    </section>
  );
}

/** Capitães que se oferecem no Posto de Recrutamento. */
export function CaptainCandidates() {
  const candidates = useGameStore((s) => s.captainCandidates);
  const hired = useGameStore((s) => allCaptains(s).length);
  const gold = useGameStore((s) => s.gold);
  const hire = useGameStore((s) => s.hireCaptain);
  const [problem, setProblem] = useState<string | null>(null);
  const full = hired >= CAPTAINS.MAX_HIRED;
  return (
    <section className="flex flex-col gap-2">
      <h2 className={sectionTitle}>
        Capitães à procura de bandeira <span className="font-normal normal-case text-neutral-500">· {hired}/{CAPTAINS.MAX_HIRED}</span>
      </h2>
      {candidates.length === 0 && <p className="text-sm text-neutral-500">Ninguém por agora. A notícia de um contrato cumprido traz gente nova.</p>}
      {candidates.map((c) => (
        <div key={c.id} className="flex flex-col gap-2 rounded border border-amber-800/70 bg-neutral-800 p-3 text-sm">
          <div className="flex items-baseline justify-between gap-2">
            <span className="font-semibold">{captainName(c)}</span>
            <span className="font-mono text-xs text-yellow-400">
              {c.hireCost} ouro · {c.wage}/sem.
            </span>
          </div>
          <p className="text-xs text-neutral-400">{ORIGIN_LABEL[c.origin]}</p>
          <p className="text-xs italic text-neutral-300">{c.backstory}</p>
          <CaptainTraits c={c} />
          <Stats c={c} />
          <button
            type="button"
            disabled={full || gold < c.hireCost}
            onClick={() => setProblem(hire(c.id))}
            className="self-end rounded border border-amber-400 bg-amber-700 px-3 py-1 font-semibold text-white hover:bg-amber-600 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Contratar capitão
          </button>
        </div>
      ))}
      {problem && <p className="text-xs text-red-300">{problem}</p>}
      {full && <p className="text-xs text-neutral-500">Limite de capitães atingido.</p>}
    </section>
  );
}
