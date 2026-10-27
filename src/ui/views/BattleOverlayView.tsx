import {
  useGameStore,
  type BattalionStatus,
  type BattleResult,
  type CommandReach,
  type TrumpetCall,
} from "../../store/useGameStore";
import { FORMATIONS, TERRAIN, TROOPS } from "../../utils/constants";
import { BattalionContextMenu } from "../components/BattalionContextMenu";
import { Button } from "../components/Button";
import { ResourceBar } from "../components/ResourceBar";
import { StatBar } from "../components/StatBar";

const STATUS_LABEL: Record<BattalionStatus, string> = {
  READY: "Em posição",
  MOVING: "Marchando",
  ENGAGED: "Em combate",
  FLEEING: "EM PÂNICO",
  DESTROYED: "Dizimado",
};

/** Por qual meio as ordens chegam a cada batalhão sem mensageiro. */
const REACH: Record<CommandReach, { text: string; tone: string }> = {
  VOICE: { text: "Ao alcance da voz: qualquer ordem", tone: "text-emerald-400" },
  TRUMPET: { text: "♪ Trombeta: só toques básicos", tone: "text-amber-200" },
  BANNER: { text: "⚑ Estandarte: só sinais (formação, reunir)", tone: "text-sky-300" },
  NONE: { text: "Só por mensageiro", tone: "text-neutral-500" },
};

const TRUMPET_CALLS: { call: TrumpetCall; label: string }[] = [
  { call: "ADVANCE", label: "Avançar" },
  { call: "HALT", label: "Alto" },
  { call: "CHARGE", label: "Carregar" },
  { call: "RETREAT", label: "Recuar" },
  { call: "RALLY", label: "Reunir" },
];

const RESULT_TITLE: Record<BattleResult, string> = {
  VICTORY: "Vitória",
  DEFEAT: "Derrota",
  RETREAT: "Recuo",
};

/**
 * HUD transparente sobre o canvas do Phaser.
 * O container ignora o mouse (pointer-events-none) para que os cliques cheguem ao jogo;
 * apenas os controles interativos reativam pointer-events.
 */
export function BattleOverlayView() {
  const hud = useGameStore((s) => s.battleHud);
  const report = useGameStore((s) => s.battleReport);
  const retreat = useGameStore((s) => s.retreat);
  const returnToCamp = useGameStore((s) => s.returnToCamp);
  const sendBattleCommand = useGameStore((s) => s.sendBattleCommand);
  const battleName = useGameStore((s) =>
    s.currentBattle?.kind === "CONTRACT" ? s.currentBattle.contract.title : s.currentBattle?.setup.name,
  );

  return (
    <div className="pointer-events-none absolute inset-0 flex flex-col justify-between p-4 text-white">
      <BattalionContextMenu />
      {/* Topo: Comandante, recursos e recuo */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex w-72 flex-col gap-2 rounded bg-black/60 p-3">
          {battleName && <span className="text-xs uppercase tracking-wider text-neutral-400">{battleName}</span>}
          <span className="text-sm font-bold">Comandante</span>
          {hud && (
            <StatBar label="Vida" value={hud.commanderHp} max={hud.commanderMaxHp} colorClass="bg-green-500" />
          )}
          {hud && hud.messengers.length > 0 && (
            <div className="flex flex-wrap items-center gap-1 text-xs text-neutral-300">
              <span>Mensageiros:</span>
              {hud.messengers.map((m) => (
                <span
                  key={m.id}
                  title={`${m.name} (comando ${m.level})`}
                  className={`rounded px-1.5 ${
                    m.state === "IDLE"
                      ? "bg-emerald-800 text-emerald-100"
                      : m.state === "DEAD"
                        ? "bg-red-900 text-red-300 line-through"
                        : "bg-amber-800 text-amber-100"
                  }`}
                >
                  {m.name}
                  {m.state === "OUTBOUND" ? " ✉" : m.state === "RETURNING" ? " ↩" : ""}
                </span>
              ))}
            </div>
          )}
          {hud?.scouts.map((s) => (
            <div
              key={s.id}
              className={`flex items-center justify-between gap-2 rounded bg-black/40 px-2 py-1 text-xs ${s.selected ? "ring-1 ring-lime-400" : ""}`}
            >
              <button
                type="button"
                disabled={!s.alive}
                onClick={(e) => sendBattleCommand({ type: "SELECT_SCOUT", ids: [s.id], additive: e.shiftKey })}
                className={`pointer-events-auto text-left ${s.alive ? "" : "text-red-400 line-through"}`}
              >
                Batedor {s.name} · {s.alive ? `${s.hp}/${s.maxHp}` : "morto"}
                {s.alive && (
                  <span className="text-neutral-400">
                    {" "}
                    · {s.fleeing ? "recuando" : s.mode === "VANGUARD" ? "vanguarda" : s.mode === "EXPLORE" ? "explorando" : "recolhido"}
                  </span>
                )}
              </button>
              {s.alive && (
                <span className="pointer-events-auto flex gap-1">
                  <button
                    type="button"
                    onClick={() => sendBattleCommand({ type: "SCOUT_MODE", ids: [s.id], mode: "VANGUARD" })}
                    className="rounded border border-neutral-600 px-1 hover:border-lime-400"
                  >
                    Vanguarda
                  </button>
                  <button
                    type="button"
                    onClick={() => sendBattleCommand({ type: "SCOUT_MODE", ids: [s.id], mode: "RECALL" })}
                    className="rounded border border-neutral-600 px-1 hover:border-lime-400"
                  >
                    Recolher
                  </button>
                </span>
              )}
            </div>
          ))}
        </div>
        {hud && hud.feed.length > 0 && (
          <ol className="absolute left-1/2 top-20 flex w-[30rem] max-w-[40vw] -translate-x-1/2 flex-col gap-0.5 rounded bg-black/55 px-3 py-2 text-xs text-amber-100">
            {hud.feed.map((line, i) => (
              <li key={i} className={i === hud.feed.length - 1 ? "" : "opacity-60"}>
                {line}
              </li>
            ))}
          </ol>
        )}
        <div className="flex items-center gap-3">
          {hud && (
            <div className="pointer-events-auto flex items-center gap-1 rounded bg-black/60 px-2 py-1.5 text-sm">
              <button
                type="button"
                onClick={() => sendBattleCommand({ type: "CAMERA", ids: [], action: "TOGGLE" })}
                title="C: prender/soltar a câmera"
                className={`rounded px-2 py-0.5 ${hud.camera.locked ? "bg-neutral-700 text-neutral-200" : "bg-amber-600 text-white"}`}
              >
                {hud.camera.locked ? "Câmera presa" : "Câmera solta"}
              </button>
              <button
                type="button"
                onClick={() => sendBattleCommand({ type: "CAMERA", ids: [], action: "CENTER" })}
                title="H: centralizar no Comandante"
                className="rounded px-2 py-0.5 text-neutral-300 hover:bg-neutral-700"
              >
                ⌖
              </button>
              <span className="font-mono text-xs text-neutral-400">{Math.round(hud.camera.zoom * 100)}%</span>
            </div>
          )}
          {hud && (
            <span className="rounded bg-black/60 px-3 py-2 font-mono text-sm text-red-300">
              Inimigos: {hud.enemiesAlive}/{hud.enemiesTotal}
            </span>
          )}
          <ResourceBar />
          {!report && (
            <Button variant="danger" className="pointer-events-auto" onClick={retreat}>
              Recuar
            </Button>
          )}
        </div>
      </div>

      {/* Base: batalhões e controles */}
      <div className="flex items-end justify-between gap-4">
        <div className="flex flex-col gap-2">
          {hud?.battalions.map((b) => {
            const panic = b.status === "FLEEING";
            const ring = panic ? "ring-2 ring-red-500" : b.selected ? "ring-2 ring-lime-400" : "";
            return (
              <button
                key={b.id}
                type="button"
                disabled={b.status === "DESTROYED"}
                onClick={(e) => sendBattleCommand({ type: "SELECT", ids: [b.id], additive: e.shiftKey })}
                className={`pointer-events-auto flex w-72 flex-col gap-2 rounded bg-black/60 p-3 text-left outline-none hover:bg-black/75 ${ring}`}
              >
                <div className="flex justify-between text-sm">
                  <span className="font-bold">
                    <span className="mr-1 rounded bg-amber-700/80 px-1 font-mono text-xs text-amber-100">Nv {b.level}</span>
                    {b.name}
                  </span>
                  <span className={panic || b.status === "DESTROYED" ? "font-bold text-red-400" : "text-neutral-300"}>
                    {STATUS_LABEL[b.status]}
                  </span>
                </div>
                <div className="-mt-1 flex justify-between text-xs text-neutral-400">
                  <span>
                    {TROOPS[b.troopType].label} · <span className="text-sky-300">{FORMATIONS[b.formation].label}</span>
                  </span>
                  <span className={b.terrain === "GRASS" ? "" : "text-lime-300"}>{TERRAIN[b.terrain].label}</span>
                </div>
                {b.status !== "DESTROYED" && (
                  <div className={`-mt-1 text-xs ${b.pendingOrder ? "text-amber-300" : REACH[b.reach].tone}`}>
                    {b.pendingOrder ? `✉ Ordem a caminho: ${b.pendingOrder}` : REACH[b.reach].text}
                    {b.seesBanner && !b.pendingOrder && (
                      <span className={hud?.bannerFaltering ? "text-red-400" : "text-sky-300"}>
                        {hud?.bannerFaltering ? " · estandarte vacila!" : " · vê o estandarte"}
                      </span>
                    )}
                  </div>
                )}
                {b.lieutenant && (
                  <div className={`-mt-1 text-xs ${b.lieutenant.alive ? "text-slate-200" : "text-red-400 line-through"}`}>
                    Tenente {b.lieutenant.name}
                    {b.lieutenant.alive ? "" : " (morto)"}
                  </div>
                )}
                <StatBar label="Soldados" value={b.alive} max={b.max} colorClass="bg-blue-500" />
                <StatBar label="Moral" value={b.morale} max={100} colorClass={panic ? "bg-red-500" : "bg-yellow-400"} />
              </button>
            );
          })}
        </div>
        <div className="rounded bg-black/60 p-3 font-mono text-xs leading-5 text-neutral-300">
          <div>WASD mover · Espaço golpe · R grito de guerra</div>
          <div>Clique/arrastar selecionar (Shift soma) · Q próximos · Esc limpar</div>
          <div>Botão dir.: marchar/atacar · num batalhão: menu</div>
          <div>F reunir · 1 Linha 2 Parede 3 Cunha 4 Disperso</div>
          <div className="text-amber-200">Anel forte: voz · fraco: trombeta · além: bandeira/mensageiro</div>
          <div>C câmera presa/solta · setas/borda/botão do meio · H centralizar · roda zoom</div>
        </div>
      </div>

      {/* Toques de trombeta (selecionados, ou todo o exército) e grito de guerra */}
      {hud && !report && (
        <div className="pointer-events-auto absolute bottom-4 left-[19rem] flex flex-col items-center gap-1 rounded bg-black/65 px-3 py-2">
          <span className="text-[10px] uppercase tracking-wider text-neutral-400">
            Trombeta · {hud.battalions.some((b) => b.selected) ? "selecionados" : "todo o exército"}
          </span>
          <div className="flex gap-1">
            {TRUMPET_CALLS.map(({ call, label }) => (
              <button
                key={call}
                type="button"
                onClick={() =>
                  sendBattleCommand({
                    type: "TRUMPET",
                    ids: hud.battalions.filter((b) => b.selected).map((b) => b.id),
                    call,
                  })
                }
                className="rounded border border-amber-600/70 px-1.5 py-0.5 text-xs text-amber-100 hover:bg-amber-900/50"
              >
                ♪ {label}
              </button>
            ))}
            <button
              type="button"
              disabled={hud.warCryIn > 0}
              onClick={() => sendBattleCommand({ type: "WAR_CRY", ids: [] })}
              title="R: o nome do bando ecoa — moral para quem está perto; reagrupa os em pânico bem perto"
              className="rounded border border-red-500 bg-red-900/60 px-2 py-0.5 text-xs font-semibold text-red-100 hover:bg-red-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {hud.warCryIn > 0 ? `Grito (${hud.warCryIn}s)` : "Grito de guerra!"}
            </button>
          </div>
        </div>
      )}

      {report && (
        <div className="pointer-events-auto absolute inset-0 flex items-center justify-center bg-black/60">
          <div className="flex w-96 flex-col gap-4 rounded-lg border border-neutral-600 bg-neutral-900 p-6">
            <h2
              className={`text-3xl font-bold ${report.result === "VICTORY" ? "text-yellow-400" : report.result === "DEFEAT" ? "text-red-500" : "text-neutral-200"}`}
            >
              {RESULT_TITLE[report.result]}
            </h2>
            <div className="-mt-3 text-sm text-neutral-400">{report.title}</div>
            <ul className="flex flex-col gap-1 text-sm text-neutral-300">
              {report.goldEarned > 0 && <li className="text-yellow-400">Bônus do contrato: {report.goldEarned} de ouro</li>}
              {(report.loot.gold > 0 || report.loot.iron > 0) && (
                <li className="text-yellow-300">
                  Saque: {report.loot.gold} de ouro e {report.loot.iron} de ferro
                </li>
              )}
              {report.xpGains.map((g) => (
                <li key={g.name} className={g.newLevel ? "font-semibold text-amber-300" : "text-neutral-300"}>
                  {g.name}: +{g.xp} XP ({g.kills} abate{g.kills === 1 ? "" : "s"})
                  {g.newLevel ? ` — subiu para o nível ${g.newLevel}!` : ""}
                </li>
              ))}
              <li>Baixas: {report.casualties}</li>
              {report.lostBattalions.map((name) => (
                <li key={name} className="text-red-400">
                  {name} foi dizimado e está perdido para sempre.
                </li>
              ))}
              {report.notes.map((note) => (
                <li key={note} className="text-neutral-400">
                  {note}
                </li>
              ))}
            </ul>
            <Button onClick={returnToCamp}>Voltar ao acampamento</Button>
          </div>
        </div>
      )}
    </div>
  );
}
