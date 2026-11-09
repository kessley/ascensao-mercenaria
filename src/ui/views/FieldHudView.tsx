import { useGameStore, type BattleResult, type Expedition, type SiegeAction } from "../../store/useGameStore";
import type { ScoutMode } from "../../game/entities/Scout";
import type { HarpyState } from "../../game/entities/Harpy";
import { REALM, SEASONS, SIEGE, WEATHER } from "../../utils/constants";
import { WEATHER_ICON } from "../../game/art/icons";
import { IconText, PixelIcon } from "../components/PixelIcon";
import { CommanderPortrait } from "../components/Portrait";
import { titleFor } from "../../game/sim/realm";
import { isFemaleName } from "../../game/worldgen/names";
import { NOBLE_TRAITS } from "../../game/sim/nobility";
import { nextStep, wayTo } from "../../game/data/missionGuide";
import { useArmyAt, useExpeditionNow, useMissionPlan } from "../components/missions/MissionParts";
import { PHASE_LABEL, darknessAt, formatHour, phaseOf } from "../../utils/time";
import { campaignYear, daysToNextSeason, isFlood, seasonDay, seasonOf } from "../../utils/season";
import { BattalionContextMenu } from "../components/BattalionContextMenu";
import { Button } from "../components/Button";
import { ResourceBar } from "../components/ResourceBar";
import { SoundControl } from "../components/SoundControl";
import { StatBar } from "../components/StatBar";
import { PrisonersPanel } from "../components/tent/PrisonersPanel";
import { ScenarioBanner } from "../components/scenario/ScenarioOverlay";
import { BattleBar } from "../components/battle/BattleBar";
import { DuelControls, DuelPanel } from "../components/battle/DuelPanel";

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
        className="flex w-40 flex-col gap-1 hud-box px-3 py-1.5"
        title="O dia passa com a marcha (fora do acampamento e fora de combate) e vira na aurora"
      >
        <div className="flex justify-between font-mono text-sm">
          <span className="font-bold">{scenario ? "Batalha" : `Dia ${day}`}</span>
          <span className="text-xs text-neutral-300">
            {formatHour(progress)} <PixelIcon id={paused ? "PAUSE" : phase === "NIGHT" ? "MOON" : phase === "DAY" ? "SUN" : "DUSK"} />
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
            {flood && (
              <>
                {" "}
                <PixelIcon id="DROP" />
              </>
            )}
          </span>
          {hud && (
            <span
              className="text-neutral-200"
              title={`${WEATHER.LABEL[hud.weather]}. Chuva: arcos alcançam menos e o chão vira lama · Nevoeiro: visão pela metade · Neve: visão e passo menores${
                hud.forecast ? ` · Amanhã (previsão do tenente Cauteloso): ${WEATHER.LABEL[hud.forecast]}` : ""
              }`}
            >
              <PixelIcon id={WEATHER_ICON[hud.weather]} />
              {hud.forecast && (
                <span className="text-neutral-400">
                  {" "}
                  → <PixelIcon id={WEATHER_ICON[hud.forecast]} />
                </span>
              )}
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
            className={`btn-pixel flex-1 px-1.5 py-0.5 ${hud.torches ? "btn-gold" : "btn-iron text-neutral-300"} ${night ? "" : "opacity-60"}`}
          >
            {hud.torches ? (
              <>
                <PixelIcon id="FIRE" /> Tochas
              </>
            ) : (
              "Sem tochas"
            )}
          </button>
          {night && !scenario && (
            <button
              type="button"
              disabled={!!hud.restBlocked}
              onClick={() => sendBattleCommand({ type: "REST", ids: [] })}
              title={hud.restBlocked ?? "Passa a noite de uma vez; um bando que chegue perto interrompe o descanso"}
              className="btn-pixel btn-blue flex-1 px-1.5 py-0.5 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Descansar
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/** Convocação do suserano (Marco 15): faltar custa honra e relação. */
function SummonsBanner() {
  const summons = useGameStore((s) => s.summons);
  const town = useGameStore((s) => s.settlements.find((t) => t.id === s.summons?.townId)?.name);
  if (!summons) return null;
  return (
    <div className="hud-box px-3 py-1.5 text-xs">
      <span className="text-neutral-400">Convocação: </span>
      <b className="text-amber-200">reunir o bando em {town}</b>
      <span className="text-neutral-400"> · prazo dia {summons.deadline}</span>
    </div>
  );
}

function ExpeditionLine({ e }: { e: Expedition }) {
  const day = useGameStore((s) => s.day);
  const { line } = useExpeditionNow(e);
  const left = e.returnDay - day;
  return (
    <span className="block">
      <b className="text-sky-200">{e.battalions.map((b) => b.name).join(", ")}</b>: {line} · {left > 0 ? `volta em ${left} dia(s)` : "volta hoje"}
    </span>
  );
}

/** Quem está fora, e fazendo o quê. Clicar abre o diário. */
function ExpeditionBanner() {
  const list = useGameStore((s) => s.expeditions);
  const setCampPanel = useGameStore((s) => s.setCampPanel);
  if (list.length === 0) return null;
  return (
    <button type="button" onClick={() => setCampPanel({ kind: "MISSIONS" })} title="J: diário de missões" className="pointer-events-auto w-full rounded bg-black/70 px-3 py-1.5 text-left text-xs text-neutral-100 hover:bg-black/80">
      {list.map((e) => (
        <ExpeditionLine key={e.id} e={e} />
      ))}
    </button>
  );
}

/** Contrato ativo: o próximo passo, para que lado e até quando. Clicar abre o diário. */
function ContractBanner() {
  const active = useGameStore((s) => s.activeContract);
  const day = useGameStore((s) => s.day);
  const setCampPanel = useGameStore((s) => s.setCampPanel);
  const army = useArmyAt();
  const plan = useMissionPlan(active?.contract ?? null, { progress: active?.progress, recovered: active?.recovered });
  if (!active || !plan) return null;
  const step = nextStep(plan);
  const left = active.deadline - day;
  return (
    <button type="button" onClick={() => setCampPanel({ kind: "MISSIONS" })} title="J: diário de missões" className="pointer-events-auto w-full rounded bg-black/70 px-3 py-1.5 text-left text-xs hover:bg-black/85">
      <b className="text-amber-200">{active.contract.title}</b>
      <span className={left <= 1 ? "text-red-400" : "text-neutral-300"}> · prazo dia {active.deadline}</span>
      {step && (
        <span className="block text-neutral-100">
          Agora: {step.text}
          {step.at && army && <b className="text-amber-300"> ({wayTo(army, step.at)})</b>}
        </span>
      )}
    </button>
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
  const scenario = useGameStore((s) => s.scenario);
  if (!siege?.walled || !town || scenario) return null;
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
    <div className="flex w-full flex-col gap-1 hud-box px-3 py-1.5 text-xs text-amber-100">
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
  const hasFortress = useGameStore((s) => s.fortress !== null);
  const fieldCamp = useGameStore((s) => s.fieldCamp !== null);
  const seatAlarm = useGameStore((s) => s.seatAlarm);
  const startSeatSiege = useGameStore((s) => s.startSeatSiege);
  const setScenarioPaused = useGameStore((s) => s.setScenarioPaused);
  const seats = settlements.filter((t) => t.owner === "PLAYER");
  const leaderName = useGameStore((s) => s.leader.name);
  const title = titleFor(seats.length, isFemaleName(leaderName)) + (seats[0] ? ` de ${seats[0].name}` : "");

  return (
    <div className="pointer-events-none absolute inset-0 flex flex-col justify-between p-4 text-white">
      {hud && hud.slow.left > 0 && <div className="absolute inset-0 shadow-[inset_0_0_140px_rgba(56,189,248,0.4)]" />}
      <BattalionContextMenu />
      {/* Topo: Comandante, recursos e recuo */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex w-72 flex-col gap-2 hud-box p-3">
          {hud && (
            <span className="text-xs uppercase tracking-wider text-neutral-400">
              {hud.region}
              {hud.engaged && <b className="ml-2 text-red-400">· em combate</b>}
            </span>
          )}
          <div className="flex items-center gap-3">
            {!scenario && <CommanderPortrait />}
            <div className="flex min-w-0 flex-1 flex-col gap-2">
              <span className="text-sm font-bold">
                {scenario ? "Comandante" : `Comandante ${leaderName}`} {!scenario && <span className="font-normal text-blue-300">· {title}</span>}
              </span>
              {hud && <StatBar label="Vida" value={hud.commanderHp} max={hud.commanderMaxHp} colorClass="bg-green-500" />}
            </div>
          </div>
          {hud && !hud.inCamp && !scenario && (
            <button
              type="button"
              disabled={!!hud.foundBlocked}
              title={hud.foundBlocked ?? "Funda uma aldeia do bando logo à frente"}
              onClick={() => sendBattleCommand({ type: "FOUND", ids: [] })}
              className="btn-pixel btn-blue pointer-events-auto px-2 py-1 text-left text-xs disabled:cursor-not-allowed disabled:opacity-50"
            >
              <PixelIcon id="BANNER" /> Fundar vila aqui ({REALM.FOUND_COST.gold} ouro · {REALM.FOUND_COST.iron} ferro)
              {hud.foundBlocked && <span className="block text-[10px]">{hud.foundBlocked}</span>}
            </button>
          )}
          {hud && campPacked && !scenario && (
            <button
              type="button"
              disabled={!!hud.pitchBlocked}
              onClick={() => sendBattleCommand({ type: "PITCH_CAMP", ids: [] })}
              title={hud.pitchBlocked ?? "Um dia de trabalho: o acampamento nasce logo a leste, com o portão virado para o Comandante"}
              className="btn-pixel btn-wood pointer-events-auto px-2 py-1 text-left text-xs disabled:cursor-not-allowed disabled:opacity-50"
            >
              <PixelIcon id="TENT" /> Montar acampamento aqui (acampamento levantado)
              {hud.pitchBlocked && <span className="block text-[10px]">{hud.pitchBlocked}</span>}
            </button>
          )}
          {hud && seatAlarm && !scenario && (
            <button
              type="button"
              onClick={startSeatSiege}
              title="O inimigo está ao pé da muralha: a batalha começa com o exército que estiver em casa"
              className="btn-pixel btn-red pointer-events-auto animate-pulse px-2 py-1 text-left text-xs font-bold"
            >
              <PixelIcon id="ARMS" /> Às muralhas! {seatAlarm.attackers} inimigos cercam a sede
            </button>
          )}
          {hud && hasFortress && !hud.inCamp && !scenario && (
            <button
              type="button"
              disabled={!fieldCamp && !!hud.fieldBlocked}
              onClick={() => sendBattleCommand({ type: "FIELD_CAMP", ids: [] })}
              title={fieldCamp ? "Recolhe o acampamento de campo para as carroças" : (hud.fieldBlocked ?? "Meio dia de trabalho: o kit do acampamento de campo é montado logo a leste")}
              className="btn-pixel btn-wood pointer-events-auto px-2 py-1 text-left text-xs disabled:cursor-not-allowed disabled:opacity-50"
            >
              <PixelIcon id="TENT" /> {fieldCamp ? "Recolher o acampamento de campo" : "Montar o acampamento de campo"}
              {!fieldCamp && hud.fieldBlocked && <span className="block text-[10px]">{hud.fieldBlocked}</span>}
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
                  {m.state === "OUTBOUND" ? (
                    <>
                      {" "}
                      <PixelIcon id="LETTER" />
                    </>
                  ) : m.state === "RETURNING" ? (
                    <>
                      {" "}
                      <PixelIcon id="RETURN" />
                    </>
                  ) : null}
                </span>
              ))}
            </div>
          )}
          {hud?.scouts.map((s) => (
            <div
              key={s.id}
              className={`flex items-center justify-between gap-2 hud-card px-2 py-1 text-xs ${s.selected ? "ring-1 ring-lime-400" : ""}`}
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
          {hud?.duel && <DuelPanel duel={hud.duel} />}
          {hud && hud.slow.left > 0 && <div className="w-full hud-box px-3 py-1.5 text-center text-sm font-bold text-sky-200">Câmera lenta: {Math.ceil(hud.slow.left / 1000)} s para decidir</div>}
          {hud?.tacticalPause && <div className="w-full hud-box px-3 py-1.5 text-center text-sm font-bold text-amber-200"><PixelIcon id="PAUSE" /> Pausa tática: dê as ordens e aperte P para continuar</div>}
          <ScenarioBanner />
          <ContractBanner />
          <ExpeditionBanner />
          <SummonsBanner />
          <SiegeBanner />
          <CaptivityBanner />
          {/* No anel, o Comandante só vê o duelo: as notícias esperam */}
          {hud && hud.feed.length > 0 && !(hud.duel && !hud.duel.auto) && (
            <ol className="flex w-full flex-col gap-0.5 hud-box px-3 py-2 text-xs text-amber-100">
              {hud.feed.map((line, i) => (
                <li key={i} className={i === hud.feed.length - 1 ? "" : "opacity-60"}>
                  <IconText text={line} />
                </li>
              ))}
            </ol>
          )}
        </div>
        {/* Direita: relógio, recursos, som e mapa; abaixo, câmera e inimigos à vista */}
        <div className="flex flex-col items-end gap-2">
          <div className="flex items-start gap-3">
            {!scenario && <ResourceBar />}
            <SoundControl />
            {scenario ? (
              <Button className="pointer-events-auto" onClick={() => setScenarioPaused(true)} title="Esc: recomeçar ou sair da batalha">
                Menu
              </Button>
            ) : (
              <>
                <Button className="pointer-events-auto" onClick={() => setWorldMapOpen(true)} title="Tab: Mapa do Continente">
                  Mapa
                </Button>
                <Button className="pointer-events-auto" onClick={() => setCampPanel({ kind: "MISSIONS" })} title="J: contrato em andamento, tropas fora e favores">
                  Missões
                </Button>
                <Button className="pointer-events-auto" onClick={() => setCampPanel({ kind: "GAME" })} title="Salvar, carregar, novo mundo">
                  Jogo
                </Button>
              </>
            )}
          </div>
          <div className="flex flex-col items-end gap-2">
            <WorldClock />
            {hud && hud.enemiesInSight > 0 && (
              <span className="hud-box px-3 py-1.5 font-mono text-sm text-red-300">
                À vista: {hud.enemiesInSight}
              </span>
            )}
            {hud && hud.foes.length > 0 && (
              <div className="flex flex-col gap-0.5 hud-box px-2 py-1 text-xs text-red-200">
                {hud.foes.slice(0, 3).map((f) => (
                  <span key={f.key} title={f.trait ? `Dizem que é ${NOBLE_TRAITS[f.trait].label.toLowerCase()}` : undefined}>
                    {f.name} · {f.status} · moral {f.morale}
                  </span>
                ))}
              </div>
            )}
            {hud && (
              <div className="pointer-events-auto flex items-center gap-1 hud-box px-2 py-1.5 text-sm">
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
                  className="btn-pixel btn-iron px-1 py-0"
                  aria-label="Centralizar no Comandante"
                >
                  <PixelIcon id="CENTER" />
                </button>
                <span className="font-mono text-xs text-neutral-400">{Math.round(hud.camera.zoom * 100)}%</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Base: comandos com ícones e cartões dos batalhões */}
      <BattleBar hidden={!!report || (!!hud?.duel && !hud.duel.auto)} />
      {hud?.duel && !hud.duel.auto && !report && <DuelControls />}

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
