import { useGameStore } from "../../../store/useGameStore";
import { bondOf, relationLabel } from "../../../game/sim/campEvents";
import { fullName, opinionOn, PASSIVES, TRAITS, type LieutenantData } from "../../../game/data/lieutenants";
import type { Contract } from "../../../game/data/contracts";
import { LIEUTENANTS } from "../../../utils/constants";

const sectionTitle = "text-sm font-bold uppercase tracking-wider text-neutral-400";

function LoyaltyBar({ value }: { value: number }) {
  const tone = value <= 30 ? "bg-red-500" : value <= 50 ? "bg-yellow-500" : "bg-emerald-500";
  return (
    <div className="flex items-center gap-2 text-xs text-neutral-400">
      <span>Lealdade</span>
      <div className="h-1.5 flex-1 overflow-hidden rounded bg-neutral-700">
        <div className={`h-full ${tone}`} style={{ width: `${value}%` }} />
      </div>
      <span className="font-mono">{value}</span>
    </div>
  );
}

function Traits({ l }: { l: LieutenantData }) {
  return (
    <div className="flex flex-wrap gap-1 text-xs">
      {l.traits.map((t) => (
        <span key={t} title={TRAITS[t].description} className="rounded bg-neutral-700 px-2 py-0.5 text-neutral-200">
          {TRAITS[t].label}
        </span>
      ))}
      <span title={PASSIVES[l.passive].description} className="rounded bg-sky-900/70 px-2 py-0.5 text-sky-200">
        ★ {PASSIVES[l.passive].label}
      </span>
    </div>
  );
}

/** Ficha completa de um tenente: história, personalidade, lealdade, crônica e comando. */
/** Amizades e rivalidades do tenente com os outros (Marco 12). */
function Relations({ l }: { l: LieutenantData }) {
  const lieutenants = useGameStore((s) => s.lieutenants);
  const bonds = useGameStore((s) => s.bonds);
  const others = lieutenants.filter((x) => x.id !== l.id);
  if (others.length === 0) return null;
  return (
    <section className="flex flex-col gap-1">
      <h3 className={sectionTitle}>Relações</h3>
      {others.map((o) => {
        const v = bondOf(bonds, l.id, o.id);
        const r = relationLabel(v);
        return (
          <div key={o.id} className="flex justify-between text-xs">
            <span>{fullName(o)}</span>
            <span className={r.tone}>
              {r.text} ({v > 0 ? "+" : ""}
              {v})
            </span>
          </div>
        );
      })}
      <p className="text-[11px] text-neutral-500">Os traços aproximam ou afastam os tenentes a cada dia; vitórias lado a lado unem. Rivais brigam; amigos se visitam no acampamento.</p>
    </section>
  );
}

export function LieutenantSheet({ lieutenant: l }: { lieutenant: LieutenantData }) {
  const battalions = useGameStore((s) => s.battalions);
  const lieutenants = useGameStore((s) => s.lieutenants);
  const assignLieutenant = useGameStore((s) => s.assignLieutenant);
  const dismissLieutenant = useGameStore((s) => s.dismissLieutenant);
  const commanded = battalions.find((b) => b.id === l.battalionId);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-2 rounded bg-neutral-800 p-3 text-sm">
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-base font-bold">{fullName(l)}</span>
          <span className="font-mono text-xs text-neutral-400">
            {l.wage}/sem. · {l.kills} abates
          </span>
        </div>
        <p className="text-xs italic text-neutral-300">{l.backstory}</p>
        <Traits l={l} />
        <p className="text-xs text-neutral-400">{PASSIVES[l.passive].description}</p>
        <LoyaltyBar value={l.loyalty} />
        {l.loyalty <= 30 && (
          <p className="text-xs text-red-400">
            Lealdade perigosamente baixa: a {LIEUTENANTS.LOYALTY_DESERT_AT} ou menos, abandona o bando.
          </p>
        )}
      </div>

      <Relations l={l} />

      <section className="flex flex-col gap-2">
        <h3 className={sectionTitle}>Comando</h3>
        <div className="flex flex-wrap gap-2 text-xs">
          {battalions.map((b) => {
            const current = b.id === l.battalionId;
            const other = lieutenants.find((x) => x.battalionId === b.id && x.id !== l.id);
            return (
              <button
                key={b.id}
                type="button"
                disabled={current}
                onClick={() => assignLieutenant(l.id, b.id)}
                title={other ? `Substitui ${fullName(other)}` : undefined}
                className={`rounded border px-2 py-1 ${current ? "border-sky-400 text-sky-200" : "border-neutral-600 hover:border-sky-400"}`}
              >
                {current ? "● " : ""}
                {b.name}
                {other ? ` (de ${other.name})` : ""}
              </button>
            );
          })}
          {commanded && (
            <button
              type="button"
              onClick={() => assignLieutenant(l.id, null)}
              className="rounded border border-neutral-600 px-2 py-1 text-neutral-400 hover:border-neutral-400"
            >
              Tirar do comando
            </button>
          )}
        </div>
        {!commanded && l.traits.includes("AMBITIOUS") && (
          <p className="text-xs text-yellow-400">Ambicioso sem batalhão: perde lealdade a cada semana.</p>
        )}
      </section>

      <section className="flex flex-col gap-1">
        <h3 className={sectionTitle}>Crônica</h3>
        <ol className="flex flex-col gap-0.5 rounded bg-neutral-800 p-2 text-xs text-neutral-300">
          {[...l.history].reverse().map((line, i) => (
            <li key={i}>{line}</li>
          ))}
        </ol>
      </section>

      <button
        type="button"
        onClick={() => dismissLieutenant(l.id)}
        className="self-start text-xs text-red-400 underline-offset-2 hover:underline"
      >
        Dispensar do bando
      </button>
    </div>
  );
}

/** Lista compacta dos tenentes (Tenda do Comandante). */
export function LieutenantRoster() {
  const lieutenants = useGameStore((s) => s.lieutenants);
  const battalions = useGameStore((s) => s.battalions);
  const setCampPanel = useGameStore((s) => s.setCampPanel);
  return (
    <section className="flex flex-col gap-2">
      <h2 className={sectionTitle}>Tenentes</h2>
      {lieutenants.length === 0 && (
        <p className="text-sm text-neutral-500">Nenhum tenente. Procure candidatos no Posto de Recrutamento.</p>
      )}
      {lieutenants.map((l) => (
        <button
          key={l.id}
          type="button"
          onClick={() => setCampPanel({ kind: "LIEUTENANT", lieutenantId: l.id })}
          className="flex flex-col gap-1 rounded bg-neutral-800 px-3 py-2 text-left text-sm hover:bg-neutral-700"
        >
          <div className="flex justify-between gap-2">
            <span className="font-semibold">{fullName(l)}</span>
            <span className="text-xs text-neutral-400">
              {battalions.find((b) => b.id === l.battalionId)?.name ?? "sem comando"}
            </span>
          </div>
          <LoyaltyBar value={l.loyalty} />
        </button>
      ))}
    </section>
  );
}

/** Candidatos a tenente no Posto de Recrutamento. */
export function LieutenantCandidates() {
  const candidates = useGameStore((s) => s.lieutenantCandidates);
  const hired = useGameStore((s) => s.lieutenants.length);
  const gold = useGameStore((s) => s.gold);
  const hireLieutenant = useGameStore((s) => s.hireLieutenant);
  const full = hired >= LIEUTENANTS.MAX_HIRED;

  return (
    <section className="flex flex-col gap-2">
      <h2 className={sectionTitle}>
        Candidatos a tenente <span className="font-normal normal-case text-neutral-500">· {hired}/{LIEUTENANTS.MAX_HIRED}</span>
      </h2>
      {candidates.length === 0 && (
        <p className="text-sm text-neutral-500">Ninguém procurando trabalho. Novos candidatos chegam após cada contrato.</p>
      )}
      {candidates.map((c) => (
        <div key={c.id} className="flex flex-col gap-2 rounded border border-neutral-700 bg-neutral-800 p-3 text-sm">
          <div className="flex items-baseline justify-between gap-2">
            <span className="font-semibold">{fullName(c)}</span>
            <span className="font-mono text-xs text-yellow-400">
              {c.hireCost} ouro · {c.wage}/sem.
            </span>
          </div>
          <p className="text-xs italic text-neutral-300">{c.backstory}</p>
          <Traits l={c} />
          <button
            type="button"
            disabled={full || gold < c.hireCost}
            onClick={() => hireLieutenant(c.id)}
            className="self-end rounded border border-blue-400 bg-blue-600 px-3 py-1 font-semibold text-white hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Contratar
          </button>
        </div>
      ))}
      {full && <p className="text-xs text-neutral-500">Limite de tenentes atingido.</p>}
    </section>
  );
}

/** Opiniões do conselho sobre um contrato (mostradas na mesa estratégica). */
export function CouncilOpinions({ contract }: { contract: Contract }) {
  const lieutenants = useGameStore((s) => s.lieutenants);
  const opinions = lieutenants
    .map((l) => ({ l, o: opinionOn(l, contract) }))
    .filter((x): x is { l: LieutenantData; o: NonNullable<ReturnType<typeof opinionOn>> } => x.o !== null);
  if (opinions.length === 0) return null;
  return (
    <div className="flex flex-col gap-0.5 text-xs">
      {opinions.map(({ l, o }) => (
        <span key={l.id} className={o.stance === "APPROVE" ? "text-emerald-400" : "text-orange-400"}>
          {o.stance === "APPROVE" ? "▲" : "▼"} {l.name} {o.stance === "APPROVE" ? "aprova" : "desaprova"}: “{o.reason}”
        </span>
      ))}
    </div>
  );
}
