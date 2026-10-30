import { useState } from "react";
import {
  ENEMY_FACTIONS,
  PRESET_SCENARIOS,
  SCENARIO_HOURS,
  SCENARIO_MAPS,
  SCENARIO_OBJECTIVES,
  blankScenario,
  forceSize,
  loadRecords,
  loadScenarios,
  scenarioArmyTotal,
  scenarioEnemyTotal,
  scenarioProblem,
  storeScenarios,
  type BattleScenario,
} from "../../game/data/scenarios";
import { useGameStore } from "../../store/useGameStore";
import { SEASONS, WAR_AI, WEATHER } from "../../utils/constants";
import { Button } from "../components/Button";
import { ScenarioEditor } from "../components/scenario/ScenarioEditor";
import { ScenarioMap } from "../components/scenario/ScenarioMap";

const clock = (seconds: number) => `${Math.floor(seconds / 60)}:${String(Math.round(seconds) % 60).padStart(2, "0")}`;

function ScenarioRow({ s, selected, onPick }: { s: BattleScenario; selected: boolean; onPick: () => void }) {
  return (
    <button
      type="button"
      onClick={onPick}
      className={`flex flex-col rounded border px-3 py-2 text-left ${selected ? "border-amber-400 bg-amber-500/10" : "border-transparent hover:border-neutral-600 hover:bg-neutral-900"}`}
    >
      <span className={`font-serif ${selected ? "text-amber-100" : "text-neutral-200"}`}>{s.name}</span>
      <span className="text-xs text-neutral-500">
        {SCENARIO_MAPS[s.map].label} · {scenarioArmyTotal(s)} contra {scenarioEnemyTotal(s)}
      </span>
    </button>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-neutral-500">{label}</dt>
      <dd className="text-sm text-neutral-200">{value}</dd>
    </div>
  );
}

/** Ficha do cenário escolhido: o que vai acontecer e o histórico dele. */
function ScenarioSheet({ s }: { s: BattleScenario }) {
  const record = loadRecords()[s.id];
  const troops = s.army.battalions.length;
  return (
    <div className="flex flex-col gap-4">
      <header>
        <h2 className="font-serif text-3xl text-amber-50">{s.name}</h2>
        {s.description && <p className="mt-1 max-w-2xl text-neutral-300">{s.description}</p>}
      </header>
      <dl className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-4">
        <Fact label="Objetivo" value={s.objective === "SURVIVE" ? `Resistir ${s.surviveMinutes} min` : SCENARIO_OBJECTIVES[s.objective].label} />
        <Fact label="Hora" value={SCENARIO_HOURS[s.hour].label} />
        <Fact label="Estação e tempo" value={`${SEASONS.LABEL[s.season]} · ${WEATHER.LABEL[s.weather]}`} />
        <Fact label="Dificuldade" value={WAR_AI.DIFFICULTY[s.difficulty].label} />
        <Fact label="Seu exército" value={`${troops} batalh${troops === 1 ? "ão" : "ões"} · ${scenarioArmyTotal(s)} soldados`} />
        <Fact label="Inimigo" value={`${scenarioEnemyTotal(s)} combatentes`} />
        <Fact label="Névoa de guerra" value={s.fog ? "Ligada" : "Desligada"} />
        <Fact label="Recorde" value={record ? `${record.wins}/${record.plays} vitórias${record.best !== null ? ` · ${clock(record.best)}` : ""}` : "Ainda não jogado"} />
      </dl>
      <ul className="flex flex-col gap-1 text-sm text-neutral-300">
        {s.forces
          .filter((f) => forceSize(f) > 0)
          .map((f) => (
            <li key={f.id}>
              <span className="text-red-300">{ENEMY_FACTIONS[f.faction].label}</span> · {forceSize(f)} · {f.delay > 0 ? `chegam depois de ${clock(f.delay)}` : "em campo desde o início"}
            </li>
          ))}
      </ul>
    </div>
  );
}

/** Batalhas personalizadas: escolher um cenário pronto, criar o seu e lutar. */
export function ScenarioView({ onBack, initialId }: { onBack: () => void; initialId: string | null }) {
  const startScenario = useGameStore((s) => s.startScenario);
  const [mine, setMine] = useState(loadScenarios);
  const [selectedId, setSelectedId] = useState(initialId ?? PRESET_SCENARIOS[0].id);
  const [draft, setDraft] = useState<BattleScenario | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const selected = [...PRESET_SCENARIOS, ...mine].find((s) => s.id === selectedId) ?? PRESET_SCENARIOS[0];
  const shown = draft ?? selected;
  const problem = scenarioProblem(shown);

  const persist = (list: BattleScenario[]) => {
    setMine(list);
    setMessage(storeScenarios(list));
  };
  const pick = (id: string) => {
    setSelectedId(id);
    setDraft(null);
    setConfirmDelete(false);
    setMessage(null);
  };
  /** Copia de um cenário pronto ou edição de um do jogador. */
  const edit = () => {
    setConfirmDelete(false);
    setDraft(selected.builtin ? { ...structuredClone(selected), id: crypto.randomUUID(), builtin: false, name: `${selected.name} (cópia)` } : structuredClone(selected));
  };
  const saveDraft = (): BattleScenario | null => {
    if (!draft) return null;
    const clean = { ...draft, name: draft.name.trim() || "Sem nome" };
    persist(mine.some((s) => s.id === clean.id) ? mine.map((s) => (s.id === clean.id ? clean : s)) : [...mine, clean]);
    setSelectedId(clean.id);
    setDraft(null);
    return clean;
  };
  const remove = () => {
    persist(mine.filter((s) => s.id !== selected.id));
    setSelectedId(PRESET_SCENARIOS[0].id);
    setConfirmDelete(false);
  };
  const fight = () => {
    const s = draft ? saveDraft() : selected;
    if (s) startScenario(s);
  };

  return (
    <div className="flex h-screen w-screen flex-col bg-neutral-950 text-white">
      <header className="flex items-center justify-between gap-4 border-b border-neutral-800 px-6 py-3">
        <div>
          <h1 className="font-serif text-2xl tracking-wide text-amber-100">Batalha personalizada</h1>
          <p className="text-sm text-neutral-400">Mesmas tropas, ordens e inimigos da campanha, sem nada a perder.</p>
        </div>
        <button type="button" onClick={onBack} className="rounded border border-neutral-600 px-3 py-1.5 text-sm text-neutral-200 hover:border-amber-400">
          Voltar ao menu
        </button>
      </header>

      <div className="flex min-h-0 flex-1 flex-col md:flex-row">
        <aside className="flex max-h-56 shrink-0 flex-col gap-1 overflow-y-auto border-b border-neutral-800 p-3 md:max-h-none md:w-72 md:border-b-0 md:border-r">
          <h2 className="px-3 pt-1 text-xs font-bold uppercase tracking-wider text-neutral-500">Prontos</h2>
          {PRESET_SCENARIOS.map((s) => (
            <ScenarioRow key={s.id} s={s} selected={!draft && s.id === selectedId} onPick={() => pick(s.id)} />
          ))}
          <h2 className="mt-3 px-3 text-xs font-bold uppercase tracking-wider text-neutral-500">Meus cenários</h2>
          {mine.length === 0 && <p className="px-3 text-xs text-neutral-500">Nenhum ainda. Crie um do zero ou copie um pronto.</p>}
          {mine.map((s) => (
            <ScenarioRow key={s.id} s={s} selected={!draft && s.id === selectedId} onPick={() => pick(s.id)} />
          ))}
          <button
            type="button"
            onClick={() => {
              setConfirmDelete(false);
              setDraft(blankScenario());
            }}
            className="mt-2 rounded border border-dashed border-neutral-600 px-3 py-2 text-left text-sm text-amber-200 hover:border-amber-400"
          >
            + Novo cenário
          </button>
        </aside>

        <main className="flex min-h-0 min-w-0 flex-1 flex-col">
          <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto p-5 lg:flex-row lg:items-start">
            <div className="min-w-0 flex-1">{draft ? <ScenarioEditor scenario={draft} onChange={setDraft} /> : <ScenarioSheet s={selected} />}</div>
            <div className="flex w-full shrink-0 flex-col gap-1 lg:sticky lg:top-0 lg:w-96">
              <ScenarioMap scenario={shown} />
              <p className="text-xs text-neutral-500">
                {SCENARIO_MAPS[shown.map].label}. Círculo azul: você. Quadrados vermelhos: inimigos (tracejado: chegam depois).
              </p>
            </div>
          </div>

          <footer className="flex flex-wrap items-center justify-end gap-2 border-t border-neutral-800 px-5 py-3">
            {(problem || message) && <span className="mr-auto text-sm text-amber-300">{message ?? problem}</span>}
            {draft ? (
              <>
                <Button variant="quiet" onClick={() => setDraft(null)}>
                  Cancelar
                </Button>
                <Button variant="quiet" onClick={saveDraft}>
                  Salvar
                </Button>
              </>
            ) : (
              <>
                {!selected.builtin &&
                  (confirmDelete ? (
                    <Button variant="danger" onClick={remove}>
                      Confirmar exclusão
                    </Button>
                  ) : (
                    <Button variant="quiet" onClick={() => setConfirmDelete(true)}>
                      Excluir
                    </Button>
                  ))}
                <Button variant="quiet" onClick={edit}>
                  {selected.builtin ? "Copiar e editar" : "Editar"}
                </Button>
              </>
            )}
            <Button variant="gold" disabled={!!problem} onClick={fight}>
              {draft ? "Salvar e lutar" : "Lutar"}
            </Button>
          </footer>
        </main>
      </div>
    </div>
  );
}
