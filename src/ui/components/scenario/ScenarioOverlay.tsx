import { SCENARIO_OBJECTIVES, SIEGE_TOWNS } from "../../../game/data/scenarios";
import { useGameStore } from "../../../store/useGameStore";
import { SIEGE, TROOPS } from "../../../utils/constants";
import { Button } from "../Button";

const clock = (seconds: number) => {
  const s = Math.max(0, Math.round(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};

/** Estado dos muros e, para quem ataca, as escadas e o aríete. */
function SiegeBar() {
  const siege = useGameStore((s) => s.scenario?.siege);
  const hud = useGameStore((s) => s.scenarioHud?.siege);
  const ladders = useGameStore((s) => s.siege?.ladders ?? 0);
  const rams = useGameStore((s) => s.siege?.ram ?? 0);
  const send = useGameStore((s) => s.sendBattleCommand);
  if (!siege || !hud) return null;
  const button = "pointer-events-auto rounded border border-amber-700 px-2 py-0.5 hover:border-amber-300 disabled:cursor-not-allowed disabled:border-neutral-700 disabled:text-neutral-500";
  return (
    <div className="flex w-full flex-wrap items-center justify-between gap-x-3 gap-y-1 rounded bg-black/70 px-3 py-1.5 text-xs text-amber-100">
      <span className="capitalize-first">
        {SIEGE_TOWNS[siege.town].label}: portões {hud.gatesUp}/{hud.gates}
        {hud.gatesUp > 0 && hud.weakest < 1 ? ` (o mais batido a ${Math.round(hud.weakest * 100)}%)` : ""} · escadas nos muros {hud.ladders}
      </span>
      {siege.role === "ATTACK" && (
        <span className="flex gap-1">
          <button
            type="button"
            className={button}
            disabled={ladders === 0 || !hud.atWall}
            title={hud.atWall ? "A tropa escolhida ergue a escada na muralha mais perto" : `Leve uma tropa a até ${SIEGE.LADDER_REACH} passos da muralha`}
            onClick={() => send({ type: "SIEGE", ids: [], action: "PLANT_LADDER" })}
          >
            Erguer escada ({ladders})
          </button>
          <button type="button" className={button} disabled={rams === 0 || hud.ramOut} title="O aríete sai de perto da tropa escolhida para o portão mais próximo" onClick={() => send({ type: "SIEGE", ids: [], action: "SEND_RAM" })}>
            Mandar aríete ({rams})
          </button>
        </span>
      )}
    </div>
  );
}

/** Objetivo, tempo e quantos inimigos restam, no alto do HUD. */
export function ScenarioBanner() {
  const scenario = useGameStore((s) => s.scenario);
  const hud = useGameStore((s) => s.scenarioHud);
  if (!scenario) return null;
  const left = scenario.surviveMinutes * 60 - (hud?.seconds ?? 0);
  return (
    <>
      <div className="flex w-full flex-wrap items-center justify-between gap-x-3 rounded bg-black/70 px-3 py-1.5 text-xs text-neutral-200">
        <b className="text-amber-200">{SCENARIO_OBJECTIVES[scenario.objective].label}</b>
        <span className="font-mono">{scenario.objective === "SURVIVE" ? `faltam ${clock(left)}` : clock(hud?.seconds ?? 0)}</span>
        <span>
          Inimigos: <b className="text-red-300">{hud?.enemies ?? 0}</b>
          {hud?.waiting ? " · mais a caminho" : ""}
        </span>
      </div>
      <SiegeBar />
    </>
  );
}

function Modal({ children }: { children: React.ReactNode }) {
  return (
    <div className="pointer-events-auto absolute inset-0 z-20 flex items-center justify-center bg-black/65 text-white">
      <div className="flex max-h-[90vh] w-[28rem] max-w-[calc(100vw-2rem)] flex-col gap-4 overflow-y-auto rounded-lg border border-neutral-600 bg-neutral-900 p-6">{children}</div>
    </div>
  );
}

/** Pausa e fim da batalha personalizada. */
export function ScenarioOverlay() {
  const scenario = useGameStore((s) => s.scenario);
  const paused = useGameStore((s) => s.scenarioPaused);
  const result = useGameStore((s) => s.scenarioResult);
  const setPaused = useGameStore((s) => s.setScenarioPaused);
  const startScenario = useGameStore((s) => s.startScenario);
  const leave = useGameStore((s) => s.leaveScenario);
  const endBoarding = useGameStore((s) => s.endBoarding);
  const endSeatSiege = useGameStore((s) => s.endSeatSiege);
  if (!scenario || (!paused && !result)) return null;

  if (result) {
    const won = result.outcome === "VICTORY";
    const lost = result.battalions.reduce((n, b) => n + b.start - b.alive, 0);
    return (
      <Modal>
        <header>
          <h2 className={`font-serif text-3xl ${won ? "text-yellow-400" : "text-red-500"}`}>{won ? "Vitória" : "Derrota"}</h2>
          <p className="text-sm text-neutral-300">{result.reason}</p>
          <p className="text-xs text-neutral-500">
            {scenario.name} · {clock(result.seconds)}
          </p>
        </header>
        <dl className="grid grid-cols-3 gap-2 text-center">
          <div className="rounded bg-neutral-800 p-2">
            <dt className="text-xs text-neutral-400">Inimigos mortos</dt>
            <dd className="text-xl font-bold text-red-300">{result.enemyKilled}</dd>
          </div>
          <div className="rounded bg-neutral-800 p-2">
            <dt className="text-xs text-neutral-400">Fugiram</dt>
            <dd className="text-xl font-bold text-amber-200">{result.enemyFled}</dd>
          </div>
          <div className="rounded bg-neutral-800 p-2">
            <dt className="text-xs text-neutral-400">Suas baixas</dt>
            <dd className="text-xl font-bold text-sky-200">{lost}</dd>
          </div>
        </dl>
        <table className="text-sm">
          <thead>
            <tr className="text-left text-xs text-neutral-400">
              <th className="font-normal">Batalhão</th>
              <th className="text-right font-normal">Vivos</th>
              <th className="text-right font-normal">Abates</th>
            </tr>
          </thead>
          <tbody>
            {result.battalions.map((b) => (
              <tr key={b.name} className={b.alive === 0 ? "text-red-400" : "text-neutral-200"}>
                <td>
                  {b.name} <span className="text-xs text-neutral-500">{TROOPS[b.troop].label}</span>
                </td>
                <td className="text-right font-mono">
                  {b.alive}/{b.start}
                </td>
                <td className="text-right font-mono">{b.kills}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {result.officers.length > 0 && <p className="text-xs text-neutral-400">Oficiais inimigos abatidos: {result.officers.join(", ")}.</p>}
        {result.friendlyFire > 0 && <p className="text-xs text-rose-300">Fogo amigo: {result.friendlyFire} flecha{result.friendlyFire > 1 ? "s" : ""} acertou os seus homens.</p>}
        {scenario.boarding ? (
          <Button variant="gold" onClick={endBoarding}>
            Seguir viagem
          </Button>
        ) : scenario.seat ? (
          <Button variant="gold" onClick={endSeatSiege}>
            {won ? "Voltar à fortaleza" : "Ver o que sobrou da sede"}
          </Button>
        ) : (
          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="quiet" onClick={() => leave(null)}>
              Menu
            </Button>
            <Button variant="quiet" onClick={() => leave(scenario.id)}>
              Ajustar cenário
            </Button>
            <Button variant="gold" onClick={() => startScenario(scenario)}>
              Jogar de novo
            </Button>
          </div>
        )}
      </Modal>
    );
  }

  return (
    <Modal>
      <h2 className="font-serif text-2xl text-amber-100">Batalha em pausa</h2>
      <p className="text-sm text-neutral-300">{SCENARIO_OBJECTIVES[scenario.objective].description}</p>
      <div className="flex flex-col gap-2">
        <Button variant="gold" onClick={() => setPaused(false)}>
          Continuar
        </Button>
        {!scenario.boarding && !scenario.seat && (
          <>
            <Button variant="quiet" onClick={() => startScenario(scenario)}>
              Recomeçar
            </Button>
            <Button variant="quiet" onClick={() => leave(scenario.id)}>
              Voltar aos cenários
            </Button>
            <Button variant="quiet" onClick={() => leave(null)}>
              Menu principal
            </Button>
          </>
        )}
      </div>
    </Modal>
  );
}
