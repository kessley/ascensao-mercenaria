import { useState } from "react";
import { useGameStore } from "../../../store/useGameStore";
import { CAPTAINS, PRISONERS } from "../../../utils/constants";
import { heroWords, joinChance } from "../../../game/data/heroes";
import { barrierOf, losesDetail, voiceFor } from "../../../game/sim/language";

const sectionTitle = "text-sm font-bold uppercase tracking-wider text-neutral-400";

/**
 * Prisioneiros (Marco 16): o que se faz com quem se rendeu muda como o mundo trata o bando.
 * Aparece no relatório do combate e na Tenda.
 */
export function PrisonersPanel() {
  const groups = useGameStore((s) => s.captives);
  const officers = useGameStore((s) => s.captiveOfficers);
  const captiveChoice = useGameStore((s) => s.captiveChoice);
  const officerChoice = useGameStore((s) => s.officerChoice);
  const send = useGameStore((s) => s.sendBattleCommand);
  // Sem quem fale a língua dos presos, o interrogatório rende menos (Marco 23)
  const lost = useGameStore((s) => losesDetail(barrierOf(voiceFor(s.world?.culture ?? "REALMS", s))));
  const fame = useGameStore((s) => s.fame);
  const full = useGameStore((s) => s.captains.length >= CAPTAINS.MAX_HIRED);
  const [message, setMessage] = useState<string | null>(null);
  if (groups.length === 0 && officers.length === 0) return message ? <p className="text-xs text-amber-200">{message}</p> : null;

  const button = "rounded border border-neutral-600 px-1.5 py-0.5 hover:border-amber-400 disabled:cursor-not-allowed disabled:text-neutral-600";
  return (
    <section className="flex flex-col gap-2">
      <h3 className={sectionTitle}>Prisioneiros</h3>
      {groups.map((g) => (
        <div key={g.id} className="flex flex-col gap-1 rounded bg-neutral-800 px-2 py-1 text-xs text-neutral-200">
          <span>
            {g.count} {g.label}
          </span>
          <span className="flex flex-wrap gap-1">
            <button type="button" className={button} disabled={g.ransom <= 0} title="Volta para o reino dele" onClick={() => setMessage(captiveChoice(g.id, "RANSOM"))}>
              Resgatar{g.ransom > 0 ? ` (+${g.ransom * g.count})` : ""}
            </button>
            <button type="button" className={button} disabled={!g.troop} title="Lealdade baixa no começo" onClick={() => setMessage(captiveChoice(g.id, "RECRUIT"))}>
              Recrutar
            </button>
            <button type="button" className={button} title={`Honra +${PRISONERS.FREE_HONOR}`} onClick={() => setMessage(captiveChoice(g.id, "FREE"))}>
              Libertar
            </button>
            <button type="button" className={`${button} text-red-300`} title={`Temor +${PRISONERS.EXECUTE_FEAR}, honra −${PRISONERS.EXECUTE_HONOR}; tenentes honrados não perdoam`} onClick={() => setMessage(captiveChoice(g.id, "EXECUTE"))}>
              Executar
            </button>
          </span>
        </div>
      ))}
      {officers.map((o) => (
        <div key={o.id} className="flex flex-col gap-1 rounded bg-neutral-800 px-2 py-1 text-xs text-amber-100">
          <span>
            {o.name}
            {o.hero && <span className="text-neutral-400"> · {heroWords(o.hero)}</span>}
          </span>
          <span className="flex flex-wrap gap-1">
            <button type="button" className={button} disabled={o.questioned} title="Rotas, planos, quem marcha" onClick={() => {
                setMessage(officerChoice(o.id, "QUESTION"));
                // Quem não foi entendido não marca os exércitos no mapa (Marco 23)
                if (o.factionId && !lost) send({ type: "REVEAL", ids: [o.factionId] });
              }}>
              Interrogar
            </button>
            <button type="button" className={button} onClick={() => setMessage(officerChoice(o.id, "RANSOM"))}>
              Resgatar (+{o.ransom})
            </button>
            {!o.nobleId && (
              <button
                type="button"
                className={button}
                disabled={o.refused || full}
                title={o.refused ? "Já recusou" : full ? "O bando já tem todos os capitães" : `Vira capitão do bando, com lealdade baixa; chance de aceitar: ${Math.round(joinChance(o.hero, fame) * 100)}%`}
                onClick={() => setMessage(officerChoice(o.id, "RECRUIT"))}
              >
                Recrutar como capitão
              </button>
            )}
            <button type="button" className={button} title="Nobres lembram" onClick={() => setMessage(officerChoice(o.id, "FREE"))}>
              Libertar
            </button>
            <button type="button" className={`${button} text-red-300`} title="Toda a casa dele vai lembrar" onClick={() => setMessage(officerChoice(o.id, "EXECUTE"))}>
              Executar
            </button>
          </span>
        </div>
      ))}
      {message && <p className="text-xs text-amber-200">{message}</p>}
    </section>
  );
}
