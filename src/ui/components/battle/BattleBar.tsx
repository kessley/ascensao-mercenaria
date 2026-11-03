import { useState, type ReactNode } from "react";
import { useGameStore, type BattalionStatus, type BattleHud, type CommandReach, type TrumpetCall } from "../../../store/useGameStore";
import { SICKNESS_LABEL } from "../../../game/sim/logistics";
import { COMBAT, FATIGUE, FORMATIONS, TERRAIN, TROOPS, type Formation } from "../../../utils/constants";
import { troopFacts } from "../../../game/data/troopFacts";
import { CommandIcon, FormationIcon, TroopIcon, type CommandIconId } from "./BattleIcons";

const STATUS_LABEL: Record<BattalionStatus, string> = {
  READY: "Em posição",
  MOVING: "Marchando",
  ENGAGED: "Em combate",
  FLEEING: "EM PÂNICO",
  DESTROYED: "Dizimado",
};

/** Por qual meio as ordens chegam a cada batalhão sem mensageiro. */
const REACH: Record<CommandReach, { text: string; dot: string }> = {
  VOICE: { text: "Ao alcance da voz: qualquer ordem", dot: "bg-emerald-400" },
  TRUMPET: { text: "Trombeta: só toques básicos", dot: "bg-amber-300" },
  BANNER: { text: "Estandarte: só sinais (formação, reunir)", dot: "bg-sky-300" },
  NONE: { text: "Só por mensageiro", dot: "bg-neutral-500" },
};

const FORMATION_LIST: Formation[] = ["LINE", "SHIELD_WALL", "WEDGE", "LOOSE"];

const TRUMPET_ORDERS: { call: TrumpetCall; icon: CommandIconId; label: string; hint: string; keyName?: string }[] = [
  { call: "ADVANCE", icon: "ADVANCE", label: "Avançar", hint: "Marcha em frente, mantendo a forma" },
  { call: "HALT", icon: "HALT", label: "Alto", hint: "Para e segura a posição" },
  { call: "CHARGE", icon: "CHARGE", label: "Investir", hint: "Ataca o inimigo à vista mais próximo" },
  { call: "RETREAT", icon: "RETREAT", label: "Recuar", hint: "Corre para trás do Comandante" },
  { call: "RALLY", icon: "RALLY", label: "Reunir", hint: "Volta a seguir o Comandante", keyName: "F" },
];

const HELP_LINES = [
  "WASD move o Comandante · Espaço golpeia",
  "Clique ou arraste: seleciona (Shift soma) · Q os próximos · Ctrl+A todos · Esc limpa",
  "Botão direito: marcha ou ataca · dois cliques: corre · sobre a tropa: menu",
  "Arraste com o botão direito para posicionar: risco longo, linha fina; risco curto, funda",
  "Da esquerda para a direita, a frente olha para cima",
  "C prende a câmera · setas, borda ou botão do meio movem · roda dá zoom · H centraliza",
  "B cessa o fogo · N investida em ciclo · T tochas · M som · E interage · Tab mapa · J missões",
];

interface CommandProps {
  icon: ReactNode;
  label: string;
  hint?: string;
  keyName?: string;
  active?: boolean;
  disabled?: boolean;
  /** Texto por cima do ícone (segundos de espera). */
  badge?: string;
  /** 0 a 1: parte do botão coberta (recarga). */
  fill?: number;
  tone?: string;
  onClick: () => void;
}

/** Botão quadrado com ícone: nome e explicação aparecem ao passar o mouse. */
function Command({ icon, label, hint, keyName, active, disabled, badge, fill, tone = "border-neutral-600 text-neutral-100 hover:border-amber-300", onClick }: CommandProps) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className={`group relative flex h-11 w-11 items-center justify-center rounded border bg-neutral-900/80 outline-none focus-visible:ring-2 focus-visible:ring-amber-300 disabled:cursor-not-allowed disabled:border-neutral-800 disabled:text-neutral-600 ${
        active ? "border-amber-400 bg-amber-800/60 text-amber-100" : tone
      }`}
    >
      {fill !== undefined && fill > 0 && <span className="absolute inset-x-0 bottom-0 rounded-b bg-sky-500/35" style={{ height: `${Math.round(fill * 100)}%` }} />}
      <span className="relative">{icon}</span>
      {badge && <span className="absolute inset-0 flex items-center justify-center font-mono text-sm font-bold text-white [text-shadow:0_0_4px_#000]">{badge}</span>}
      {keyName && <span className="absolute bottom-0 right-0.5 font-mono text-[9px] text-neutral-400">{keyName}</span>}
      <span className="pointer-events-none absolute bottom-full left-1/2 z-30 mb-1.5 hidden w-max max-w-56 -translate-x-1/2 rounded bg-black/95 px-2 py-1 text-left text-xs text-white group-hover:block group-focus-visible:block">
        <b>{label}</b>
        {keyName && <span className="ml-1 font-mono text-neutral-400">({keyName})</span>}
        {hint && <span className="block font-normal text-neutral-300">{hint}</span>}
      </span>
    </button>
  );
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="px-0.5 text-[10px] uppercase tracking-wider text-neutral-400">{title}</span>
      <div className="flex gap-1">{children}</div>
    </div>
  );
}

function Bar({ value, tone, thin }: { value: number; tone: string; thin?: boolean }) {
  return (
    <span className={`block overflow-hidden rounded bg-neutral-800 ${thin ? "h-1" : "h-1.5"}`}>
      <span className={`block h-full transition-[width] duration-100 ${tone}`} style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
    </span>
  );
}

type HudBattalion = BattleHud["battalions"][number];

/** Cartão de um batalhão: clicar seleciona; os detalhes aparecem ao passar o mouse. */
function UnitCard({ b, fatigue, faltering }: { b: HudBattalion; fatigue: number; faltering: boolean }) {
  const send = useGameStore((s) => s.sendBattleCommand);
  const data = useGameStore((s) => s.battalions.find((x) => x.id === b.id));
  const panic = b.status === "FLEEING";
  const gone = b.status === "DESTROYED";
  const ring = panic ? "ring-2 ring-red-500" : b.flanked ? "ring-2 ring-orange-400" : b.selected ? "ring-2 ring-lime-400" : "";
  const status = b.flanked && !panic ? "FLANQUEADO" : b.pendingOrder ? "✉ Ordem a caminho" : b.running && b.status === "MOVING" ? "Correndo" : STATUS_LABEL[b.status];
  const wounded = data?.wounded ?? 0;
  const sick = data?.sick ?? 0;
  return (
    <button
      type="button"
      disabled={gone}
      aria-label={`${b.name}: ${status}, ${b.alive} de ${b.max} soldados, moral ${b.morale}`}
      aria-pressed={b.selected}
      onClick={(e) => send({ type: "SELECT", ids: [b.id], additive: e.shiftKey })}
      className={`group pointer-events-auto relative flex min-w-0 max-w-44 flex-1 flex-col gap-0.5 rounded bg-black/75 px-1.5 py-1 text-left outline-none hover:bg-black/90 focus-visible:ring-2 focus-visible:ring-amber-300 disabled:opacity-50 ${ring}`}
    >
      <span className="flex items-center gap-1 text-xs">
        <span className={`shrink-0 ${panic ? "text-red-400" : "text-sky-300"}`}>
          <TroopIcon troop={b.troopType} />
        </span>
        <span className="min-w-0 flex-1 truncate font-bold">{b.name}</span>
        <span className="shrink-0 font-mono text-[10px] text-amber-200">{b.level}</span>
        {!gone && <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${REACH[b.reach].dot}`} />}
      </span>
      <span className={`truncate text-[10px] ${panic || gone ? "font-bold text-red-400" : b.flanked ? "font-bold text-orange-300" : b.pendingOrder ? "text-amber-300" : "text-neutral-300"}`}>
        {status} · {b.alive}/{b.max}
        {b.ammo !== null ? ` · ${b.ammo} tiros` : ""}
      </span>
      <Bar value={b.max > 0 ? (b.alive / b.max) * 100 : 0} tone="bg-blue-500" />
      <Bar value={b.morale} tone={panic ? "bg-red-500" : "bg-yellow-400"} />
      <Bar value={fatigue} thin tone={fatigue >= FATIGUE.EXHAUSTED ? "bg-red-400" : "bg-slate-400"} />
      <span className="pointer-events-none absolute bottom-full left-0 z-30 mb-1.5 hidden w-60 rounded bg-black/95 px-2 py-1.5 text-xs font-normal text-neutral-200 group-hover:block">
        <b className="block text-white">{b.name}</b>
        {TROOPS[b.troopType].label} · nível {b.level} · {FORMATIONS[b.formation].label}
        <span className="block text-neutral-400">{troopFacts(b.troopType).join(" · ")}</span>
        <span className="block">
          Moral {b.morale} · fadiga {Math.round(fatigue)}
          {fatigue >= FATIGUE.EXHAUSTED ? " (exausto!)" : ""} · {TERRAIN[b.terrain].label}
        </span>
        {!gone && <span className="block">{REACH[b.reach].text}</span>}
        {b.seesBanner && <span className={`block ${faltering ? "text-red-400" : "text-sky-300"}`}>{faltering ? "O estandarte vacila!" : "Vê o estandarte"}</span>}
        {b.lieutenant && <span className={`block ${b.lieutenant.alive ? "" : "text-red-400"}`}>Tenente {b.lieutenant.name}{b.lieutenant.alive ? "" : " (morto)"}</span>}
        {(wounded > 0 || sick > 0) && (
          <span className="block text-rose-300">
            {wounded > 0 ? `${wounded} ferido(s)` : ""}
            {wounded > 0 && sick > 0 ? " · " : ""}
            {sick > 0 ? `${sick} doente(s)${data?.sickness ? ` (${SICKNESS_LABEL[data.sickness]})` : ""}` : ""}
          </span>
        )}
      </span>
    </button>
  );
}

/** Botão da câmera lenta: mostra os segundos que faltam e a recarga. */
function SlowButton({ hud }: { hud: BattleHud }) {
  const send = useGameStore((s) => s.sendBattleCommand);
  const { left, wait } = hud.slow;
  const active = left > 0;
  return (
    <Command
      icon={<CommandIcon id="SLOW" />}
      label="Câmera lenta"
      hint={`${COMBAT.SLOW_MS / 1000} s para decidir; depois, ${COMBAT.SLOW_WAIT_MS / 1000} s de espera`}
      keyName="Z"
      active={active}
      disabled={!active && wait > 0}
      badge={active ? String(Math.ceil(left / 1000)) : wait > 0 ? String(Math.ceil(wait / 1000)) : undefined}
      fill={active ? left / COMBAT.SLOW_MS : wait / COMBAT.SLOW_WAIT_MS}
      onClick={() => send({ type: "SLOW_MOTION", ids: [] })}
    />
  );
}

/** Painel de baixo: comandos com ícones e os cartões dos batalhões, ao estilo dos jogos de batalha. */
export function BattleBar({ hidden }: { hidden: boolean }) {
  const hud = useGameStore((s) => s.battleHud);
  const send = useGameStore((s) => s.sendBattleCommand);
  const scenario = useGameStore((s) => s.scenario !== null);
  const [help, setHelp] = useState(false);
  if (!hud) return null;

  const standing = hud.battalions.filter((b) => b.status !== "DESTROYED");
  const picked = standing.filter((b) => b.selected);
  const targets = picked.length > 0 ? picked : standing;
  const ids = targets.map((b) => b.id);
  const riders = targets.filter((b) => b.mayCycle);
  const shooters = targets.filter((b) => b.ammo !== null);
  const who = picked.length > 0 ? `${picked.length} selecionado${picked.length > 1 ? "s" : ""}` : "todo o exército";

  return (
    <div className="absolute inset-x-0 bottom-0 flex flex-col items-center gap-1 p-2">
      {help && (
        <div className="max-w-2xl rounded bg-black/90 px-3 py-2 font-mono text-xs leading-5 text-neutral-200">
          {HELP_LINES.map((line) => (
            <div key={line}>{line}</div>
          ))}
        </div>
      )}
      {!hidden && !hud.inCamp && (
        <div className="pointer-events-auto flex flex-wrap items-end justify-center gap-x-3 gap-y-1 rounded-lg bg-black/75 px-2 py-1">
          <Group title={`Formação · ${who}`}>
            {FORMATION_LIST.map((f) => {
              const able = targets.filter((b) => TROOPS[b.troopType].formations.includes(f));
              return (
                <Command
                  key={f}
                  icon={<FormationIcon formation={f} />}
                  label={FORMATIONS[f].label}
                  hint={FORMATIONS[f].description}
                  keyName={FORMATIONS[f].key}
                  active={able.length > 0 && able.every((b) => b.formation === f)}
                  disabled={able.length === 0}
                  onClick={() => send({ type: "FORMATION", ids, formation: f })}
                />
              );
            })}
          </Group>
          <Group title="Ordens">
            {TRUMPET_ORDERS.map((o) => (
              <Command key={o.call} icon={<CommandIcon id={o.icon} />} label={o.label} hint={o.hint} keyName={o.keyName} disabled={targets.length === 0} onClick={() => send({ type: "TRUMPET", ids: picked.map((b) => b.id), call: o.call })} />
            ))}
            <Command
              icon={<CommandIcon id="RUN" />}
              label="Correr"
              hint="Chega antes e chega cansado"
              keyName="X"
              active={targets.length > 0 && targets.every((b) => b.running)}
              disabled={targets.length === 0}
              onClick={() => send({ type: "RUN", ids: [] })}
            />
            <Command
              icon={<CommandIcon id="CRY" />}
              label="Grito de guerra"
              hint="Levanta a moral de quem está perto e reagrupa os em pânico bem perto"
              keyName="R"
              disabled={hud.warCryIn > 0}
              badge={hud.warCryIn > 0 ? String(hud.warCryIn) : undefined}
              tone="border-red-700 text-red-200 hover:border-red-400"
              onClick={() => send({ type: "WAR_CRY", ids: [] })}
            />
          </Group>
          {(shooters.length > 0 || riders.length > 0) && (
            <Group title="Postura">
              {riders.length > 0 && (
                <Command
                  icon={<CommandIcon id="CYCLE" />}
                  label="Investida em ciclo"
                  hint="Bate, sai, ganha distância e carrega de novo"
                  keyName="N"
                  active={riders.every((b) => b.cycle)}
                  onClick={() => send({ type: "CYCLE", ids: [] })}
                />
              )}
              {shooters.length > 0 && (
                <Command
                  icon={<CommandIcon id="HOLD_FIRE" />}
                  label="Cessar fogo"
                  hint="Flechas caem em área: no corpo a corpo, acertam os seus homens"
                  keyName="B"
                  active={shooters.every((b) => b.holdFire)}
                  onClick={() => send({ type: "HOLD_FIRE", ids: [] })}
                />
              )}
              {shooters.length > 0 && <Command icon={<CommandIcon id="KITE" />} label="Escaramuça" hint="Recua sozinho de quem chega perto, sem parar de atirar" active={shooters.every((b) => b.kiting)} onClick={() => send({ type: "KITE", ids: [] })} />}
            </Group>
          )}
          {!scenario && (
            <Group title={`Marcha · 🛒 ${hud.wagonsAlive}`}>
              <Command icon={<CommandIcon id="FORCED" />} label="Marcha forçada" hint="O dia rende mais caminho e a tropa anda mais depressa, mas cansa muito mais" keyName="V" active={hud.forced} onClick={() => send({ type: "FORCED_MARCH", ids: [] })} />
              <Command icon={<CommandIcon id="FORAGE" />} label="Forragear" hint={hud.forageBlocked ?? "Um quarto de dia coletando comida da região"} keyName="G" disabled={!!hud.forageBlocked} onClick={() => send({ type: "FORAGE", ids: [] })} />
            </Group>
          )}
          <Group title="Tempo">
            <Command icon={<CommandIcon id="PAUSE" />} label="Pausa tática" hint="Para o mundo para dar ordens com calma" keyName="P" active={hud.tacticalPause} onClick={() => send({ type: "TACTICAL_PAUSE", ids: [] })} />
            <SlowButton hud={hud} />
            <Command icon={<CommandIcon id="HELP" />} label="Controles" hint="Mostra ou esconde a lista de teclas" active={help} onClick={() => setHelp(!help)} />
          </Group>
        </div>
      )}
      {!hidden && (
        <div className="flex w-full justify-center gap-1">
          {hud.battalions.map((b) => (
            <UnitCard key={b.id} b={b} fatigue={hud.fatigue[b.id] ?? 0} faltering={hud.bannerFaltering} />
          ))}
        </div>
      )}
    </div>
  );
}
