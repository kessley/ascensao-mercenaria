import { useEffect, useState } from "react";
import { DECISION_LABEL, type Decision, type PaceReport } from "./paceRules";
import type { PaceApi } from "./paceLog";

const pace = (): PaceApi | null => (window as unknown as { __pace?: PaceApi }).__pace ?? null;

/**
 * O painel do diário de ritmo (só no modo de desenvolvimento): F9 abre e fecha. Mostra o tempo em
 * cada estado, a primeira luta, as decisões, as missões e quanto cada inimigo leva para cair.
 */
export default function PacePanel() {
  const [open, setOpen] = useState(false);
  const [report, setReport] = useState<PaceReport | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "F9") {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (!open) return;
    const read = () => setReport(pace()?.report() ?? null);
    read();
    const timer = window.setInterval(read, 1000);
    return () => window.clearInterval(timer);
  }, [open]);

  if (!open) return null;
  return (
    <div className="pointer-events-auto absolute bottom-24 left-4 z-40 w-80 hud-box p-3 text-xs text-neutral-100" data-pace-panel>
      <div className="mb-1 flex justify-between font-bold text-amber-200">
        <span>Diário de ritmo</span>
        <button type="button" className="text-neutral-400 hover:text-white" onClick={() => pace()?.reset()} title="Começa a contar de novo">
          zerar
        </button>
      </div>
      {!report ? (
        <p>Sem dados ainda.</p>
      ) : (
        <div className="flex flex-col gap-2">
          <p>
            {report.minutes} min de jogo · primeira luta: {report.firstFight === null ? "ainda não" : `minuto ${report.firstFight}`}
          </p>
          <table className="w-full">
            <tbody>
              {report.states.map((s) => (
                <tr key={s.state}>
                  <td>{s.label}</td>
                  <td className="text-right font-mono">{s.minutes} min</td>
                  <td className="w-10 text-right font-mono">{s.share}%</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p>
            Decisões: {report.decisions.total}
            {report.decisions.gap.n > 0 && ` · uma a cada ${Math.round(report.decisions.gap.median)} s (mediana)`}
            <br />
            <span className="text-neutral-400">
              {(Object.entries(report.decisions.byKind) as [Decision, number][]).map(([k, n]) => `${DECISION_LABEL[k]} ${n}`).join(" · ") || "nenhuma"}
            </span>
          </p>
          {report.missions.length > 0 && (
            <div>
              <p className="font-bold">Missões</p>
              {report.missions.map((m, i) => (
                <p key={i}>
                  {m.title}: {m.doorToDoor === null ? "sem volta ainda" : `${m.doorToDoor} min da porta à porta`} · {m.acceptToDone} min do aceite ao fim
                </p>
              ))}
            </div>
          )}
          {report.falls.length > 0 && (
            <div>
              <p className="font-bold">Quanto cada inimigo leva para cair</p>
              {report.falls.slice(0, 8).map((f) => (
                <p key={f.kind}>
                  {f.kind}: {f.stat.median} s (mediana de {f.stat.n}, máx. {f.stat.max} s)
                </p>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
