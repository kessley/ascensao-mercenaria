import {
  useGameStore,
  type BattalionStatus,
  type BattleResult,
  type CommandReach,
  type SiegeAction,
  type TrumpetCall,
} from "../../store/useGameStore";
import type { ScoutMode } from "../../game/entities/Scout";
import type { HarpyState } from "../../game/entities/Harpy";
import { FATIGUE, FORMATIONS, REALM, SEASONS, SIEGE, TERRAIN, TROOPS, WEATHER } from "../../utils/constants";
import { titleFor } from "../../game/sim/realm";
import { NOBLE_TRAITS } from "../../game/sim/nobility";
import { contractGoal } from "../../game/data/contracts";
import { SICKNESS_LABEL } from "../../game/sim/logistics";
import { PHASE_LABEL, darknessAt, formatHour, phaseOf } from "../../utils/time";
import { campaignYear, daysToNextSeason, isFlood, seasonDay, seasonOf } from "../../utils/season";
import { BattalionContextMenu } from "../components/BattalionContextMenu";
import { Button } from "../components/Button";
import { ResourceBar } from "../components/ResourceBar";
import { SoundControl } from "../components/SoundControl";
import { StatBar } from "../components/StatBar";
import { PrisonersPanel } from "../components/tent/PrisonersPanel";
import { ScenarioBanner } from "../components/scenario/ScenarioOverlay";

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

const SCOUT_MODE_TEXT: Record<ScoutMode, string> = {
  VANGUARD: "vanguarda",
  EXPLORE: "de vigia",
  RECALL: "recolhido",
  REGION: "explorando região",
  PATROL: "patrulhando",
  SHADOW: "seguindo um bando",
  RETURN: "voltando",
};

const HARPY_TEXT: Record<HarpyState, string> = {
  PERCHED: "pousada",
  TO_COMMANDER: "voando até o Comandante",
  AT_COMMANDER: "com o Comandante",
  TO_SCOUT: "voltando ao batedor",
};

function harpyText(h: { name: string; readyDay: number; state: HarpyState | null; sheltering: boolean; orders: number }, day: number): string {
  if (!h.state) return `Harpia ${h.name}: em treino (${Math.max(0, h.readyDay - day)} dia(s))`;
  return `Harpia ${h.name}: ${h.sheltering ? "abrigada" : HARPY_TEXT[h.state]}${h.orders > 0 ? " · ordem à espera" : ""}`;
}

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
  const scenario = useGameStore((s) => s.scenario !== null);
  const paused = scenario || hud?.inCamp || hud?.engaged;
  const phase = phaseOf(progress);
  const season = seasonOf(day);
  const flood = isFlood(day);
  const night = darknessAt(progress) > 0;
  return (
    <div className="flex flex-col gap-1">
      <div
        className="flex w-40 flex-col gap-1 rounded bg-black/60 px-3 py-1.5"
        title="O dia passa com a marcha (fora do acampamento e fora de combate) e vira na aurora"
      >
        <div className="flex justify-between font-mono text-sm">
          <span className="font-bold">{scenario ? "Batalha" : `Dia ${day}`}</span>
          <span className="text-xs text-neutral-300">
            {formatHour(progress)} {paused ? "⏸" : phase === "NIGHT" ? "☾" : phase === "DAY" ? "☀" : "◐"}
          </span>
        </div>
        <div className="h-1 rounded bg-neutral-700">
          <div className="h-1 rounded bg-amber-300" style={{ width: `${Math.round(progress * 100)}%` }} />
        </div>
        <span className="text-[10px] uppercase tracking-wider text-neutral-400">{PHASE_LABEL[phase]}</span>
        <div className="flex justify-between gap-1 text-[11px]">
          <span
            className={flood ? "text-sky-300" : season === "WINTER" ? "text-slate-200" : season === "AUTUMN" ? "text-amber-300" : "text-lime-300"}
            title={`Ano ${campaignYear(day)} · faltam ${daysToNextSeason(day)} dia(s) para a próxima estação${flood ? " · cheia: os vaus dos rios estão fundos" : ""}`}
          >
            {SEASONS.LABEL[season]} {seasonDay(day)}/{SEASONS.DAYS}
            {flood ? " ≋" : ""}
          </span>
          {hud && (
            <span
              className="text-neutral-200"
              title={`${WEATHER.LABEL[hud.weather]}. Chuva: arcos alcançam menos e o chão vira lama · Nevoeiro: visão pela metade · Neve: visão e passo menores${
                hud.forecast ? ` · Amanhã (previsão do tenente Cauteloso): ${WEATHER.LABEL[hud.forecast]}` : ""
              }`}
            >
              {WEATHER.ICON[hud.weather]}
              {hud.forecast && <span className="text-neutral-400"> → {WEATHER.ICON[hud.forecast]}</span>}
            </span>
          )}
        </div>
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
          {night && !scenario && (
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

/** Feridos e doentes do batalhão (fora das fileiras). */
function OutOfRanks({ id }: { id: string }) {
  const b = useGameStore((s) => s.battalions.find((x) => x.id === id));
  if (!b || ((b.wounded ?? 0) === 0 && (b.sick ?? 0) === 0)) return null;
  return (
    <div className="-mt-1 text-xs text-rose-300">
      {(b.wounded ?? 0) > 0 && `${b.wounded} ferido(s)`}
      {(b.wounded ?? 0) > 0 && (b.sick ?? 0) > 0 && " · "}
      {(b.sick ?? 0) > 0 && `${b.sick} doente(s)${b.sickness ? ` (${SICKNESS_LABEL[b.sickness]})` : ""}`}
    </div>
  );
}

/** Convocação do suserano (Marco 15): faltar custa honra e relação. */
function SummonsBanner() {
  const summons = useGameStore((s) => s.summons);
  const town = useGameStore((s) => s.settlements.find((t) => t.id === s.summons?.townId)?.name);
  if (!summons) return null;
  return (
    <div className="rounded bg-black/60 px-3 py-1.5 text-xs">
      <span className="text-neutral-400">Convocação: </span>
      <b className="text-amber-200">reunir o bando em {town}</b>
      <span className="text-neutral-400"> · prazo dia {summons.deadline}</span>
    </div>
  );
}

/** Contrato ativo: onde ir e até quando. */
function ContractBanner() {
  const active = useGameStore((s) => s.activeContract);
  const day = useGameStore((s) => s.day);
  const world = useGameStore((s) => s.world);
  const settlements = useGameStore((s) => s.settlements);
  if (!active) return null;
  const goal = contractGoal(
    active.contract,
    {
      site: (id) => world?.sites.find((x) => x.id === id)?.name ?? "?",
      town: (id) => settlements.find((t) => t.id === id)?.name ?? "?",
      realm: (id) => world?.factions.find((f) => f.id === id)?.name ?? "?",
    },
    active.progress ?? 0,
  ).short;
  const left = active.deadline - day;
  return (
    <div className="rounded bg-black/60 px-3 py-1.5 text-xs">
      <span className="text-neutral-400">Contrato: </span>
      <b className="text-amber-200">{active.contract.title}</b>
      <span className="text-neutral-400"> · {goal} · </span>
      <span className={left <= 1 ? "text-red-400" : "text-neutral-300"}>prazo dia {active.deadline}</span>
    </div>
  );
}

/**
 * HUD do mundo sobre o canvas do Phaser: Comandante, relógio, contrato, batalhões e ordens.
 * O container ignora o mouse (pointer-events-none) para que os cliques cheguem ao jogo;
 * apenas os controles interativos reativam pointer-events.
 */
/** O Comandante nas mãos do inimigo: pagar ou ir buscar (Marco 16). */
function CaptivityBanner() {
  const c = useGameStore((s) => s.captivity);
  const gold = useGameStore((s) => s.gold);
  const pay = useGameStore((s) => s.endCaptivity);
  if (!c) return null;
  return (
    <div className="flex w-full items-center gap-2 rounded bg-red-950/80 px-3 py-1.5 text-xs text-red-100">
      <span>
        O Comandante está preso com {c.by}. {c.acting} leva o bando enquanto isso.{c.bandId ? " Derrote quem o levou (marcado no mapa) para soltá-lo." : ""}
      </span>
      <button type="button" disabled={gold < c.ransom} onClick={() => pay("PAID")} className="pointer-events-auto shrink-0 rounded border border-red-400 px-1.5 hover:bg-red-900 disabled:cursor-not-allowed disabled:border-neutral-600 disabled:text-neutral-500">
        Pagar resgate ({c.ransom})
      </button>
    </div>
  );
}

/** Cerco em curso (Marco 16): quanto a cidade aguenta e o que dá para fazer. */
function SiegeBanner() {
  const siege = useGameStore((s) => s.siege);
  const town = useGameStore((s) => s.settlements.find((t) => t.id === s.siege?.settlementId));
  const day = useGameStore((s) => s.day);
  const send = useGameStore((s) => s.sendBattleCommand);
  if (!siege?.walled || !town) return null;
  const act = (action: SiegeAction, label: string, title: string, disabled = false) => (
    <button
      key={action}
      type="button"
      disabled={disabled}
      title={title}
      onClick={() => send({ type: "SIEGE", ids: [], action })}
      className="pointer-events-auto rounded border border-amber-700 px-1.5 hover:border-amber-300 disabled:cursor-not-allowed disabled:border-neutral-700 disabled:text-neutral-500"
    >
      {label}
    </button>
  );
  const food = siege.food ?? 0;
  const wood = Math.floor(siege.wood ?? 0);
  return (
    <div className="flex w-full flex-col gap-1 rounded bg-black/70 px-3 py-1.5 text-xs text-amber-100">
      <span>
        Cerco de {town.name} · dia {day - (siege.startDay ?? day)} · comida lá dentro: {food > 0 ? `${food} dia(s)` : `fome há ${-food} dia(s)`} · guarnição {town.garrison}
      </span>
      <span>
        Madeira {wood} · escadas {siege.ladders ?? 0} · aríete {siege.ram ?? 0}
        {siege.reliefDay !== undefined ? " · pediram socorro" : ""}
      </span>
      <span className="flex flex-wrap gap-1">
        {act("WAIT", "Esperar um dia", "A fome trabalha; a madeira junta; a tropa come e adoece com o tempo")}
        {act("LADDER", `Escada (${SIEGE.LADDER_WOOD})`, "Madeira para uma escada", wood < SIEGE.LADDER_WOOD)}
        {act("RAM", `Aríete (${SIEGE.RAM_WOOD})`, "Madeira para um aríete", wood < SIEGE.RAM_WOOD)}
        {act("ASSAULT", "Ao assalto!", "Põe escadas nos muros e o aríete no portão")}
        {act("DEMAND", "Exigir rendição", "Depende do Temor e da fome lá dentro")}
        {act("LIFT", "Levantar cerco", "Vai embora")}
      </span>
    </div>
  );
}

export function FieldHudView() {
  const hud = useGameStore((s) => s.battleHud);
  const day = useGameStore((s) => s.day);
  const report = useGameStore((s) => s.battleReport);
  const clearReport = useGameStore((s) => s.clearReport);
  const sendBattleCommand = useGameStore((s) => s.sendBattleCommand);
  const setWorldMapOpen = useGameStore((s) => s.setWorldMapOpen);
  const setCampPanel = useGameStore((s) => s.setCampPanel);
  const settlements = useGameStore((s) => s.settlements);
  const campPacked = useGameStore((s) => s.campPacked);
  const scenario = useGameStore((s) => s.scenario !== null);
  const setScenarioPaused = useGameStore((s) => s.setScenarioPaused);
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
            Comandante {!scenario && <span className="font-normal text-blue-300">· {title}</span>}
          </span>
          {hud && <StatBar label="Vida" value={hud.commanderHp} max={hud.commanderMaxHp} colorClass="bg-green-500" />}
          {hud && !hud.inCamp && !scenario && (
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
          {hud && campPacked && !scenario && (
            <button
              type="button"
              disabled={!!hud.pitchBlocked}
              onClick={() => sendBattleCommand({ type: "PITCH_CAMP", ids: [] })}
              title={hud.pitchBlocked ?? "Um dia de trabalho: o acampamento nasce logo a leste, com o portão virado para o Comandante"}
              className="pointer-events-auto rounded border border-amber-600 bg-amber-900/40 px-2 py-1 text-left text-xs text-amber-100 hover:bg-amber-800/60 disabled:cursor-not-allowed disabled:border-neutral-700 disabled:bg-transparent disabled:text-neutral-500"
            >
              ⛺ Montar acampamento aqui (acampamento levantado)
              {hud.pitchBlocked && <span className="block text-[10px]">{hud.pitchBlocked}</span>}
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
                    · {s.fleeing ? "recuando" : SCOUT_MODE_TEXT[s.mode]}
                    {s.sneaking ? " · furtivo" : ""}
                    {!s.contact && <span className="text-amber-300"> · fora de contato</span>}
                  </span>
                )}
                {s.alive && s.harpy && <span className="block text-[10px] text-sky-300">{harpyText(s.harpy, day)}</span>}
              </button>
              {s.alive && (
                <span className="pointer-events-auto flex gap-1">
                  <button type="button" onClick={() => sendBattleCommand({ type: "SCOUT_MODE", ids: [s.id], mode: "VANGUARD" })} className="rounded border border-neutral-600 px-1 hover:border-lime-400">
                    Vanguarda
                  </button>
                  <button type="button" onClick={() => sendBattleCommand({ type: "SCOUT_MODE", ids: [s.id], mode: "RECALL" })} className="rounded border border-neutral-600 px-1 hover:border-lime-400">
                    Recolher
                  </button>
                  <button
                    type="button"
                    title="Metade da distância em que é percebido, 60% do passo"
                    onClick={() => sendBattleCommand({ type: "SCOUT_STEALTH", ids: [s.id] })}
                    className={`rounded border px-1 hover:border-lime-400 ${s.sneaking ? "border-lime-400 text-lime-300" : "border-neutral-600"}`}
                  >
                    Furtivo
                  </button>
                  {s.harpy?.state === "PERCHED" && !s.contact && (
                    <button type="button" title="Solta a ave com o relatório" onClick={() => sendBattleCommand({ type: "HARPY_SEND", ids: [s.id] })} className="rounded border border-sky-600 px-1 text-sky-200 hover:border-sky-300">
                      Harpia
                    </button>
                  )}
                </span>
              )}
            </div>
          ))}
        </div>
        <div className="absolute left-1/2 top-[4.5rem] flex w-[30rem] max-w-[40vw] -translate-x-1/2 flex-col items-center gap-1">
          <ScenarioBanner />
          <ContractBanner />
          <SummonsBanner />
          <SiegeBanner />
          <CaptivityBanner />
          {hud && hud.feed.length > 0 && (
            <ol className="flex w-full flex-col gap-0.5 rounded bg-black/55 px-3 py-2 text-xs text-amber-100">
              {hud.feed.map((line, i) => (
                <li key={i} className={i === hud.feed.length - 1 ? "" : "opacity-60"}>
                  {line}
                </li>
              ))}
            </ol>
          )}
        </div>
        {/* Direita: relógio, recursos, som e mapa; abaixo, câmera e inimigos à vista */}
        <div className="flex flex-col items-end gap-2">
          <div className="flex items-start gap-3">
            <WorldClock />
            {!scenario && <ResourceBar />}
            <SoundControl />
            {scenario ? (
              <Button className="pointer-events-auto" onClick={() => setScenarioPaused(true)} title="Esc: pausa, recomeçar ou sair">
                Pausa
              </Button>
            ) : (
              <>
                <Button className="pointer-events-auto" onClick={() => setWorldMapOpen(true)} title="Tab: Mapa do Continente">
                  Mapa
                </Button>
                <Button className="pointer-events-auto" onClick={() => setCampPanel({ kind: "GAME" })} title="Salvar, carregar, novo mundo">
                  Jogo
                </Button>
              </>
            )}
          </div>
          <div className="flex items-center gap-3">
            {hud && hud.enemiesInSight > 0 && (
              <span className="rounded bg-black/60 px-3 py-1.5 font-mono text-sm text-red-300">
                À vista: {hud.enemiesInSight}
              </span>
            )}
            {hud && hud.foes.length > 0 && (
              <div className="flex flex-col gap-0.5 rounded bg-black/60 px-2 py-1 text-xs text-red-200">
                {hud.foes.slice(0, 3).map((f) => (
                  <span key={f.key} title={f.trait ? `Dizem que é ${NOBLE_TRAITS[f.trait].label.toLowerCase()}` : undefined}>
                    {f.name} · {f.status} · moral {f.morale}
                  </span>
                ))}
              </div>
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
            // Muitos batalhões: cartões de uma linha, para todos caberem na tela
            if (hud.battalions.length > 3) {
              return (
                <button
                  key={b.id}
                  type="button"
                  disabled={b.status === "DESTROYED"}
                  onClick={(e) => sendBattleCommand({ type: "SELECT", ids: [b.id], additive: e.shiftKey })}
                  title={`${TROOPS[b.troopType].label} · ${FORMATIONS[b.formation].label} · moral ${Math.round(b.morale)}`}
                  className={`pointer-events-auto flex w-72 flex-col gap-1 rounded bg-black/60 px-2 py-1 text-left outline-none hover:bg-black/75 disabled:opacity-60 ${ring}`}
                >
                  <span className="flex justify-between gap-2 text-xs">
                    <span className="truncate font-bold">
                      <span className="mr-1 font-mono text-amber-200">{b.level}</span>
                      {b.name}
                    </span>
                    <span className={`shrink-0 ${panic || b.status === "DESTROYED" ? "font-bold text-red-400" : b.pendingOrder ? "text-amber-300" : "text-neutral-300"}`}>
                      {b.pendingOrder ? "✉ a caminho" : STATUS_LABEL[b.status]}
                    </span>
                  </span>
                  <span className="grid grid-cols-2 gap-1">
                    <span className="h-1.5 overflow-hidden rounded bg-neutral-800">
                      <span className="block h-full bg-blue-500" style={{ width: `${b.max > 0 ? (b.alive / b.max) * 100 : 0}%` }} />
                    </span>
                    <span className="h-1.5 overflow-hidden rounded bg-neutral-800">
                      <span className={`block h-full ${panic ? "bg-red-500" : "bg-yellow-400"}`} style={{ width: `${b.morale}%` }} />
                    </span>
                  </span>
                </button>
              );
            }
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
                <StatBar
                  label={(hud?.fatigue[b.id] ?? 0) >= FATIGUE.EXHAUSTED ? "Fadiga — exausto!" : "Fadiga"}
                  value={hud?.fatigue[b.id] ?? 0}
                  max={100}
                  colorClass={(hud?.fatigue[b.id] ?? 0) >= FATIGUE.EXHAUSTED ? "bg-red-400" : "bg-slate-400"}
                />
                <OutOfRanks id={b.id} />
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
          {scenario ? (
            <div className="text-sky-200">T tochas · M som · V marcha forçada · Esc pausa</div>
          ) : (
            <>
              <div className="text-sky-200">E interagir · Tab Mapa do Continente (viagem rápida) · T tochas · M som</div>
              <div className="text-lime-200">V marcha forçada · G forragear</div>
            </>
          )}
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
          <div className="flex gap-1">
            <button
              type="button"
              onClick={() => sendBattleCommand({ type: "FORCED_MARCH", ids: [] })}
              title="V: o dia rende mais caminho e a tropa anda mais depressa, mas cansa muito mais"
              className={`rounded border px-1.5 py-0.5 text-xs ${hud.forced ? "border-red-500 bg-red-900/50 text-red-100" : "border-neutral-600 text-neutral-300 hover:bg-neutral-800"}`}
            >
              {hud.forced ? "» Marcha forçada" : "Passo normal"}
            </button>
            {!scenario && (
              <button
                type="button"
                disabled={!!hud.forageBlocked}
                onClick={() => sendBattleCommand({ type: "FORAGE", ids: [] })}
                title={hud.forageBlocked ?? "G: um quarto de dia coletando comida da região (rende pouco no inverno e no deserto; esgota a região e irrita o dono)"}
                className="rounded border border-lime-700 px-1.5 py-0.5 text-xs text-lime-200 hover:bg-lime-900/50 disabled:cursor-not-allowed disabled:border-neutral-700 disabled:text-neutral-500"
              >
                Forragear
              </button>
            )}
            <span className="self-center text-[10px] text-neutral-400" title="Carroças do trem de suprimentos em campo">
              🛒 {hud.wagonsAlive}
            </span>
          </div>
        </div>
      )}

      {report && (
        <div className="pointer-events-auto absolute inset-0 flex items-center justify-center bg-black/60">
          <div className="flex max-h-[90vh] w-96 flex-col gap-4 overflow-y-auto rounded-lg border border-neutral-600 bg-neutral-900 p-6">
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
              <li>
                Mortos: {report.casualties}
                {report.wounded > 0 && <span className="text-rose-300"> · feridos: {report.wounded} (enfermaria)</span>}
              </li>
              {report.lostBattalions.map((name) => (
                <li key={name} className="text-red-400">
                  {name} foi dizimado e está perdido para sempre.
                </li>
              ))}
              {report.notes.map((note, i) => (
                <li key={i} className="text-neutral-400">
                  {note}
                </li>
              ))}
            </ul>
            <PrisonersPanel />
            <Button onClick={clearReport}>Continuar</Button>
          </div>
        </div>
      )}
    </div>
  );
}
