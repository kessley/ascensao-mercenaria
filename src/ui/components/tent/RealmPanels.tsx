import { useState } from "react";
import { useGameStore } from "../../../store/useGameStore";
import { titleFor } from "../../../game/sim/realm";
import { REALM } from "../../../utils/constants";

const sectionTitle = "text-sm font-bold uppercase tracking-wider text-neutral-400";
const hex = (c: number) => `#${c.toString(16).padStart(6, "0")}`;

/** O reino do Comandante, os reinos rivais (relação, guerra, tributo) e as calamidades conhecidas. */
export function DiplomacyPanel() {
  const world = useGameStore((s) => s.world);
  const factions = useGameStore((s) => s.factions);
  const settlements = useGameStore((s) => s.settlements);
  const calamities = useGameStore((s) => s.calamities);
  const gold = useGameStore((s) => s.gold);
  const payTribute = useGameStore((s) => s.payTribute);
  if (!world) return null;

  const mine = settlements.filter((t) => t.owner === "PLAYER");
  const active = calamities.filter((c) => !c.defeated);

  return (
    <section className="flex flex-col gap-2">
      <h2 className={sectionTitle}>Reinos e diplomacia</h2>
      <div className="rounded border border-blue-700/60 bg-blue-950/30 p-3 text-sm">
        <div className="font-semibold text-blue-200">
          {titleFor(mine.length)}
          {mine[0] ? ` de ${mine[0].name}` : ""} · {world.bandName}
        </div>
        <div className="text-xs text-neutral-400">
          {mine.length === 0
            ? "Nenhum povoado. Funde uma vila no campo (botão no HUD) ou tome um povoado."
            : `Povoados: ${mine.map((t) => t.name).join(", ")}.`}
        </div>
      </div>

      {factions.map((f) => {
        const def = world.factions.find((x) => x.id === f.id);
        const owned = settlements.filter((t) => t.owner === f.id).length;
        return (
          <div key={f.id} className="flex flex-col gap-1 rounded border border-neutral-700 bg-neutral-800 p-3 text-sm">
            <div className="flex items-center justify-between gap-2">
              <span className="font-semibold">
                <span className="mr-1 inline-block h-3 w-3 rounded-sm align-middle" style={{ background: hex(def?.color ?? 0xffffff) }} />
                {def?.name}
              </span>
              <span className={`text-xs font-bold ${f.atWar ? "text-red-400" : f.relation >= 20 ? "text-green-400" : f.relation <= -20 ? "text-yellow-400" : "text-neutral-300"}`}>
                {f.atWar ? "EM GUERRA" : `relação ${Math.round(f.relation)}`}
              </span>
            </div>
            <div className="text-xs text-neutral-400">
              {f.ruler} · {owned} povoado(s){owned === 0 ? " — reino caído" : ""} ·{" "}
              {def?.temperament === "BELLIGERENT" ? "belicoso" : def?.temperament === "MERCANTILE" ? "mercantil" : "devoto"}
            </div>
            {(f.atWar || f.relation < 0) && owned > 0 && (
              <button
                type="button"
                disabled={gold < REALM.TRIBUTE.GOLD}
                onClick={() => payTribute(f.id)}
                className="self-end rounded border border-amber-500 px-2 py-0.5 text-xs text-amber-100 hover:bg-amber-900/40 disabled:opacity-40"
              >
                {f.atWar ? "Propor paz" : "Enviar presentes"} ({REALM.TRIBUTE.GOLD} ouro)
              </button>
            )}
          </div>
        );
      })}

      {active.map((c) => (
        <div key={c.id} className="rounded border border-red-700 bg-red-950/40 p-3 text-sm">
          <div className="font-semibold text-red-300">☠ {c.name}</div>
          <div className="text-xs text-neutral-300">
            {c.revealed ? `Covil em ${c.region} (marcado no Mapa do Continente).` : `Rumores vindos de ${c.region}. O covil ainda não foi encontrado.`} Força {c.power}:
            as hordas crescem a cada {REALM.CALAMITY_POWER_EVERY_DAYS} dias e a cada povoado que cai. Mate {c.leader} para acabar com isso.
          </div>
        </div>
      ))}
    </section>
  );
}

/** Crônica do mundo gerado (história anterior à campanha) e o botão de novo mundo. */
export function WorldChronicle() {
  const world = useGameStore((s) => s.world);
  const newGame = useGameStore((s) => s.newGame);
  const [confirm, setConfirm] = useState(false);
  if (!world) return null;
  return (
    <section className="flex flex-col gap-2">
      <h2 className={sectionTitle}>
        Crônica de {world.name} · semente {world.seed}
      </h2>
      <ol className="flex max-h-56 flex-col gap-1 overflow-y-auto rounded bg-neutral-800 p-3 text-xs text-neutral-300">
        {world.history.map((h, i) => (
          <li key={i}>
            <span className="font-mono text-amber-300/80">Ano {h.year}</span> — {h.text}
          </li>
        ))}
      </ol>
      {confirm ? (
        <div className="flex items-center gap-2 text-xs">
          <span className="text-red-300">Abandonar esta campanha e gerar outro mundo?</span>
          <button type="button" onClick={newGame} className="rounded border border-red-500 px-2 py-0.5 text-red-200 hover:bg-red-900/50">
            Sim
          </button>
          <button type="button" onClick={() => setConfirm(false)} className="rounded border border-neutral-600 px-2 py-0.5">
            Não
          </button>
        </div>
      ) : (
        <button type="button" onClick={() => setConfirm(true)} className="self-start text-xs text-neutral-500 underline hover:text-neutral-300">
          Novo mundo…
        </button>
      )}
    </section>
  );
}
