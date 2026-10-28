import {
  useGameStore,
  type BattalionStatus,
  type BattleResult,
  type CommandReach,
  type TrumpetCall,
} from "../../store/useGameStore";
import { FORMATIONS, REALM, TERRAIN, TROOPS } from "../../utils/constants";
import { titleFor } from "../../game/sim/realm";
import { PHASE_LABEL, darknessAt, formatHour, phaseOf } from "../../utils/time";
import { BattalionContextMenu } from "../components/BattalionContextMenu";
import { Button } from "../components/Button";
import { ResourceBar } from "../components/ResourceBar";
import { SoundControl } from "../components/SoundControl";
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
  VOICE: {
    text: "Ao alcance da voz: qualquer ordem",
    tone: "text-emerald-400",
  },
  TRUMPET: { text: "♪ Trombeta: só toques básicos", tone: "text-amber-200" },
  BANNER: {
    text: "⚑ Estandarte: só sinais (formação, reunir)",
    tone: "text-sky-300",
  },
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
 * Dia e hora do mundo (o relógio anda com a marcha e para no acampamento e em combate),
 * as tochas do bando e o descanso até o amanhecer.
 */
function WorldClock() {
  const day = useGameStore((s) => s.day);
  const progress = useGameStore((s) => s.dayProgress);
  const hud = useGameStore((s) => s.battleHud);
  const sendBattleCommand = useGameStore((s) => s.sendBattleCommand);
  const paused = hud?.inCamp || hud?.engaged;
  const phase = phaseOf(progress);
  const night = darknessAt(progress) > 0;
  return (
    <div className="flex flex-col gap-1">
      <div
        className="flex w-40 flex-col gap-1 rounded bg-black/60 px-3 py-1.5"
        title="O dia passa com a marcha (fora do acampamento e fora de combate) e vira na aurora"
      >
        <div className="flex justify-between font-mono text-sm">
          <span className="font-bold">Dia {day}</span>
          <span className="text-xs text-neutral-300">
            {formatHour(progress)} {paused ? "⏸" : phase === "NIGHT" ? "☾" : phase === "DAY" ? "☀" : "◐"}
          </span>
        </div>
        <div className="h-1 rounded bg-neutral-700">
          <div className="h-1 rounded bg-amber-300" style={{ width: `${Math.round(progress * 100)}%` }} />
        </div>
        <span className="text-[10px] uppercase tracking-wider text-neutral-400">{PHASE_LABEL[phase]}</span>
      </div>
      {hud && (
        <div className="pointer-events-auto flex gap-1 text-xs">
          <button
            type="button"
            onClick={() => sendBattleCommand({ type: "TORCHES", ids: [] })}
            title="T: tochas acesas enxergam mais à noite, mas o inimigo vê o bando de longe"
            className={`flex-1 rounded border px-1.5 py-0.5 ${hud.torches ? "border-amber-500 text-amber-200" : "border-neutral-600 text-neutral-400"} ${night ? "" : "opacity-60"}`}
          >
            {hud.torches ? "🔥 Tochas" : "Sem tochas"}
          </button>
          {night && (
            <button
              type="button"
              disabled={!!hud.restBlocked}
              onClick={() => sendBattleCommand({ type: "REST", ids: [] })}
              title={hud.restBlocked ?? "Passa a noite de uma vez; um bando que chegue perto interrompe o descanso"}
              className="flex-1 rounded border border-sky-700 px-1.5 py-0.5 text-sky-200 hover:bg-sky-900/50 disabled:cursor-not-allowed disabled:border-neutral-700 disabled:text-neutral-500"
            >
              Descansar
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/** Contrato ativo: onde ir e até quando. */
function ContractBanner() {
  const active = useGameStore((s) => s.activeContract);
  const day = useGameStore((s) => s.day);
  const world = useGameStore((s) => s.world);
  if (!active) return null;
  const site = world?.sites.find((x) => x.id === active.contract.siteId);
  const left = active.deadline - day;
  return (
    <div className="rounded bg-black/60 px-3 py-1.5 text-xs">
      <span className="text-neutral-400">Contrato: </span>
      <b className="text-amber-200">{active.contract.title}</b>
      <span className="text-neutral-400"> · {site?.name} · </span>
      <span className={left <= 1 ? "text-red-400" : "text-neutral-300"}>prazo dia {active.deadline}</span>
    </div>
  );
}

/**
 * HUD do mundo sobre o canvas do Phaser: Comandante, relógio, contrato, batalhões e ordens.
 * O container ignora o mouse (pointer-events-none) para que os cliques cheguem ao jogo;
 * apenas os controles interativos reativam pointer-events.
 */
export function FieldHudView() {
  const hud = useGameStore((s) => s.battleHud);
  const report = useGameStore((s) => s.battleReport);
  const clearReport = useGameStore((s) => s.clearReport);
  const sendBattleCommand = useGameStore((s) => s.sendBattleCommand);
  const setWorldMapOpen = useGameStore((s) => s.setWorldMapOpen);
  const setCampPanel = useGameStore((s) => s.setCampPanel);
  const settlements = useGameStore((s) => s.settlements);
  const seats = settlements.filter((t) => t.owner === "PLAYER");
  const title = titleFor(seats.length) + (seats[0] ? ` de ${seats[0].name}` : "");

  return (
    <div className="pointer-events-none absolute inset-0 flex flex-col justify-between p-4 text-white">
      <BattalionContextMenu />
      {/* Topo: Comandante, recursos e recuo */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex w-72 flex-col gap-2 rounded bg-black/60 p-3">
          {hud && (
            <span className="text-xs uppercase tracking-wider text-neutral-400">
              {hud.region}
              {hud.engaged && <b className="ml-2 text-red-400">· em combate</b>}
            </span>
          )}
          <span className="text-sm font-bold">
            Comandante <span className="font-normal text-blue-300">· {title}</span>
          </span>
          {hud && <StatBar label="Vida" value={hud.commanderHp} max={hud.commanderMaxHp} colorClass="bg-green-500" />}
          {hud && !hud.inCamp && (
            <button
              type="button"
              disabled={!!hud.foundBlocked}
              title={hud.foundBlocked ?? "Funda uma aldeia do bando logo à frente"}
              onClick={() => sendBattleCommand({ type: "FOUND", ids: [] })}
              className="pointer-events-auto rounded border border-blue-700 px-2 py-1 text-left text-xs text-blue-200 hover:bg-blue-900/60 disabled:cursor-not-allowed disabled:border-neutral-700 disabled:text-neutral-500"
            >
              ⚑ Fundar vila aqui ({REALM.FOUND_COST.gold} ouro · {REALM.FOUND_COST.iron} ferro)
              {hud.foundBlocked && <span className="block text-[10px]">{hud.foundBlocked}</span>}
            </button>
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
                onClick={(e) =>
                  sendBattleCommand({
                    type: "SELECT_SCOUT",
                    ids: [s.id],
                    additive: e.shiftKey,
                  })
                }
                className={`pointer-events-auto text-left ${s.alive ? "" : "text-red-400 line-through"}`}
              >
                Batedor {s.name} · {s.alive ? `${s.hp}/${s.maxHp}` : "morto"}
                {s.alive && (
                  <span className="text-neutral-400">
                    {" "}
                    ·{" "}
                    {s.fleeing
                      ? "recuando"
                      : s.mode === "VANGUARD"
                        ? "vanguarda"
                        : s.mode === "EXPLORE"
                          ? "explorando"
                          : "recolhido"}
                  </span>
                )}
              </button>
              {s.alive && (
                <span className="pointer-events-auto flex gap-1">
                  <button
                    type="button"
                    onClick={() =>
                      sendBattleCommand({
                        type: "SCOUT_MODE",
                        ids: [s.id],
                        mode: "VANGUARD",
                      })
                    }
                    className="rounded border border-neutral-600 px-1 hover:border-lime-400"
                  >
                    Vanguarda
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      sendBattleCommand({
                        type: "SCOUT_MODE",
                        ids: [s.id],
                        mode: "RECALL",
                      })
                    }
                    className="rounded border border-neutral-600 px-1 hover:border-lime-400"
                  >
                    Recolher
                  </button>
                </span>
              )}
            </div>
          ))}
        </div>
        <div className="absolute left-1/2 top-[4.5rem] -translate-x-1/2">
          <ContractBanner />
        </div>
        {hud && hud.feed.length > 0 && (
          <ol className="absolute left-1/2 top-[6.75rem] flex w-[30rem] max-w-[40vw] -translate-x-1/2 flex-col gap-0.5 rounded bg-black/55 px-3 py-2 text-xs text-amber-100">
            {hud.feed.map((line, i) => (
              <li key={i} className={i === hud.feed.length - 1 ? "" : "opacity-60"}>
                {line}
              </li>
            ))}
          </ol>
        )}
        {/* Direita: relógio, recursos, som e mapa; abaixo, câmera e inimigos à vista */}
        <div className="flex flex-col items-end gap-2">
          <div className="flex items-start gap-3">
            <WorldClock />
            <ResourceBar />
            <SoundControl />
            <Button className="pointer-events-auto" onClick={() => setWorldMapOpen(true)} title="Tab: Mapa do Continente">
              Mapa
            </Button>
            <Button className="pointer-events-auto" onClick={() => setCampPanel({ kind: "GAME" })} title="Salvar, carregar, novo mundo">
              Jogo
            </Button>
          </div>
          <div className="flex items-center gap-3">
            {hud && hud.enemiesInSight > 0 && (
              <span className="rounded bg-black/60 px-3 py-1.5 font-mono text-sm text-red-300">
                À vista: {hud.enemiesInSight}
              </span>
            )}
            {hud && (
              <div className="pointer-events-auto flex items-center gap-1 rounded bg-black/60 px-2 py-1.5 text-sm">
                <button
                  type="button"
                  onClick={() =>
                    sendBattleCommand({
                      type: "CAMERA",
                      ids: [],
                      action: "TOGGLE",
                    })
                  }
                  title="C: prender/soltar a câmera"
                  className={`rounded px-2 py-0.5 ${hud.camera.locked ? "bg-neutral-700 text-neutral-200" : "bg-amber-600 text-white"}`}
                >
                  {hud.camera.locked ? "Câmera presa" : "Câmera solta"}
                </button>
                <button
                  type="button"
                  onClick={() =>
                    sendBattleCommand({
                      type: "CAMERA",
                      ids: [],
                      action: "CENTER",
                    })
                  }
                  title="H: centralizar no Comandante"
                  className="rounded px-2 py-0.5 text-neutral-300 hover:bg-neutral-700"
                >
                  ⌖
                </button>
                <span className="font-mono text-xs text-neutral-400">{Math.round(hud.camera.zoom * 100)}%</span>
              </div>
            )}
          </div>
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
                onClick={(e) =>
                  sendBattleCommand({
                    type: "SELECT",
                    ids: [b.id],
                    additive: e.shiftKey,
                  })
                }
                className={`pointer-events-auto flex w-72 flex-col gap-2 rounded bg-black/60 p-3 text-left outline-none hover:bg-black/75 ${ring}`}
              >
                <div className="flex justify-between text-sm">
                  <span className="font-bold">
                    <span className="mr-1 rounded bg-amber-700/80 px-1 font-mono text-xs text-amber-100">
                      Nv {b.level}
                    </span>
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
                  <div
                    className={`-mt-1 text-xs ${b.lieutenant.alive ? "text-slate-200" : "text-red-400 line-through"}`}
                  >
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
          <div className="text-sky-200">E interagir · Tab Mapa do Continente (viagem rápida) · T tochas · M som</div>
        </div>
      </div>

      {/* Toques de trombeta (selecionados, ou todo o exército) e grito de guerra */}
      {hud && !report && !hud.inCamp && (
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
              {report.goldEarned > 0 && (
                <li className="text-yellow-400">Bônus do contrato: {report.goldEarned} de ouro</li>
              )}
              {(report.loot.gold > 0 || report.loot.iron > 0) && (
                <li className="text-yellow-300">
                  Saque: {report.loot.gold} de ouro e {report.loot.iron} de ferro
                </li>
              )}
              {report.xpGains.map((g) => (
                <li key={g.name} className={g.newLevel ? "font-semibold text-amber-300" : "text-neutral-300"}>
                  {g.name}: +{g.xp} XP ({g.kills} abate
                  {g.kills === 1 ? "" : "s"}){g.newLevel ? ` — subiu para o nível ${g.newLevel}!` : ""}
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
            <Button onClick={clearReport}>Continuar</Button>
          </div>
        </div>
      )}
    </div>
  );
}
