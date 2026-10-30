import type { ReactNode } from "react";
import {
  ENEMY_FACTIONS,
  FORCE_SIDES,
  FORCE_STANCES,
  FORCE_TRAITS,
  SCENARIO_HOURS,
  SCENARIO_LIMITS,
  SCENARIO_MAPS,
  SCENARIO_OBJECTIVES,
  forceSize,
  newBattalionSpec,
  newForce,
  scenarioEnemyTotal,
  type BattleScenario,
  type EnemyFactionId,
  type ForceSide,
  type ForceStance,
  type ScenarioArmy,
  type ScenarioBattalion,
  type ScenarioForce,
  type ScenarioHour,
  type ScenarioMapId,
  type ScenarioObjective,
} from "../../../game/data/scenarios";
import { NOBLE_TRAITS, type NobleTrait } from "../../../game/sim/nobility";
import { ENEMIES, FORMATIONS, PROGRESSION, SEASONS, TROOPS, WAR_AI, WEATHER, type Formation, type Season, type TroopType, type WarDifficulty, type Weather } from "../../../utils/constants";

const inputClass = "w-full rounded border border-neutral-600 bg-neutral-900 px-2 py-1.5 text-sm text-white outline-none focus:border-amber-400";
const COMPETENCE = ["Novato", "Experiente", "Capaz", "Veterano", "Grande capitão"];

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex min-w-0 flex-col gap-1 text-xs text-neutral-400">
      {label}
      {children}
    </label>
  );
}

function Pick<T extends string>({ label, value, options, onChange }: { label: string; value: T; options: [T, string][]; onChange: (v: T) => void }) {
  return (
    <Field label={label}>
      <select value={value} onChange={(e) => onChange(e.target.value as T)} className={inputClass}>
        {options.map(([id, text]) => (
          <option key={id} value={id}>
            {text}
          </option>
        ))}
      </select>
    </Field>
  );
}

/** Número com botões: cabe no mouse e aceita digitar. */
function Count({ label, value, min, max, step = 1, onChange }: { label: string; value: number; min: number; max: number; step?: number; onChange: (v: number) => void }) {
  const set = (v: number) => onChange(Math.max(min, Math.min(max, Number.isFinite(v) ? Math.round(v) : min)));
  const btn = "h-8 w-8 shrink-0 rounded border border-neutral-600 text-neutral-200 hover:border-amber-400 disabled:opacity-40";
  return (
    <Field label={label}>
      <span className="flex items-center gap-1">
        <button type="button" aria-label={`Menos ${label}`} disabled={value <= min} onClick={() => set(value - step)} className={btn}>
          −
        </button>
        <input type="number" min={min} max={max} value={value} aria-label={label} onChange={(e) => set(Number(e.target.value))} className={`${inputClass} text-center [appearance:textfield]`} />
        <button type="button" aria-label={`Mais ${label}`} disabled={value >= max} onClick={() => set(value + step)} className={btn}>
          +
        </button>
      </span>
    </Field>
  );
}

function Section({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3 rounded-lg border border-neutral-800 bg-neutral-900/60 p-4">
      <header className="flex items-baseline justify-between gap-3">
        <h3 className="font-serif text-lg text-amber-100">{title}</h3>
        {hint && <span className="text-xs text-neutral-400">{hint}</span>}
      </header>
      {children}
    </section>
  );
}

const SMALL_BTN = "rounded border border-neutral-600 px-2 py-1 text-xs text-neutral-200 hover:border-amber-400 disabled:cursor-not-allowed disabled:opacity-40";

function BattalionRow({ b, onChange, onRemove }: { b: ScenarioBattalion; onChange: (b: ScenarioBattalion) => void; onRemove: () => void }) {
  const setTroop = (troop: TroopType) => onChange({ ...b, troop, formation: TROOPS[troop].formations[0] });
  return (
    <div className="grid grid-cols-2 gap-2 rounded border border-neutral-800 bg-neutral-950/60 p-2 sm:grid-cols-[1.2fr_1.2fr_1fr_1fr_1fr_auto]">
      <Pick<TroopType> label="Tropa" value={b.troop} options={(Object.keys(TROOPS) as TroopType[]).map((t) => [t, TROOPS[t].label])} onChange={setTroop} />
      <Pick<Formation> label="Formação" value={b.formation} options={TROOPS[b.troop].formations.map((f) => [f, FORMATIONS[f].label])} onChange={(formation) => onChange({ ...b, formation })} />
      <Count label="Soldados" value={b.soldiers} min={SCENARIO_LIMITS.SOLDIERS[0]} max={SCENARIO_LIMITS.SOLDIERS[1]} onChange={(soldiers) => onChange({ ...b, soldiers })} />
      <Count label="Nível" value={b.level} min={1} max={PROGRESSION.MAX_LEVEL} onChange={(level) => onChange({ ...b, level })} />
      <Count label="Equipamento" value={b.gear} min={0} max={PROGRESSION.MAX_EQUIPMENT_TIER} onChange={(gear) => onChange({ ...b, gear })} />
      <div className="col-span-2 flex items-end justify-between gap-2 sm:col-span-1 sm:flex-col sm:items-end">
        <label className="flex items-center gap-1 text-xs text-neutral-300" title="Um tenente sorteado lidera o batalhão">
          <input type="checkbox" checked={b.lieutenant} onChange={(e) => onChange({ ...b, lieutenant: e.target.checked })} className="accent-amber-500" />
          Tenente
        </label>
        <button type="button" onClick={onRemove} className={SMALL_BTN}>
          Remover
        </button>
      </div>
    </div>
  );
}

function ArmyEditor({ army, onChange }: { army: ScenarioArmy; onChange: (a: ScenarioArmy) => void }) {
  const setBattalion = (i: number, next: ScenarioBattalion) => onChange({ ...army, battalions: army.battalions.map((b, k) => (k === i ? next : b)) });
  const add = (troop: TroopType) => onChange({ ...army, battalions: [...army.battalions, newBattalionSpec(troop)] });
  const full = army.battalions.length >= SCENARIO_LIMITS.BATTALIONS;
  const total = army.battalions.reduce((n, b) => n + b.soldiers, 0);
  return (
    <Section title="Seu exército" hint={`${army.battalions.length}/${SCENARIO_LIMITS.BATTALIONS} batalhões · ${total} soldados`}>
      {army.battalions.map((b, i) => (
        <BattalionRow key={b.id} b={b} onChange={(next) => setBattalion(i, next)} onRemove={() => onChange({ ...army, battalions: army.battalions.filter((x) => x !== b) })} />
      ))}
      <div className="flex flex-wrap gap-2">
        {(Object.keys(TROOPS) as TroopType[]).map((t) => (
          <button key={t} type="button" disabled={full} onClick={() => add(t)} className={SMALL_BTN}>
            + {TROOPS[t].label}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-3 gap-3">
        <Count label="Batedores" value={army.scouts} min={0} max={SCENARIO_LIMITS.SCOUTS} onChange={(scouts) => onChange({ ...army, scouts })} />
        <Count label="Mensageiros" value={army.messengers} min={0} max={SCENARIO_LIMITS.MESSENGERS} onChange={(messengers) => onChange({ ...army, messengers })} />
        <Count label="Carroças" value={army.wagons} min={0} max={SCENARIO_LIMITS.WAGONS} onChange={(wagons) => onChange({ ...army, wagons })} />
      </div>
    </Section>
  );
}

function ForceEditor({ force, index, onChange, onRemove }: { force: ScenarioForce; index: number; onChange: (f: ScenarioForce) => void; onRemove: () => void }) {
  const faction = ENEMY_FACTIONS[force.faction];
  const setFaction = (id: EnemyFactionId) => onChange({ ...newForce(id), id: force.id, side: force.side, stance: force.stance, delay: force.delay, competence: force.competence, trait: force.trait, chief: force.chief });
  return (
    <div className="flex flex-col gap-3 rounded border border-neutral-800 bg-neutral-950/60 p-3">
      <div className="flex items-center justify-between gap-2">
        <h4 className="text-sm font-semibold text-red-200">
          Força {index + 1} <span className="font-normal text-neutral-400">· {forceSize(force)} combatentes</span>
        </h4>
        <button type="button" onClick={onRemove} className={SMALL_BTN}>
          Remover
        </button>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Pick<EnemyFactionId> label="Quem são" value={force.faction} options={(Object.keys(ENEMY_FACTIONS) as EnemyFactionId[]).map((id) => [id, ENEMY_FACTIONS[id].label])} onChange={setFaction} />
        <Pick<ForceSide> label="De onde vêm" value={force.side} options={Object.entries(FORCE_SIDES) as [ForceSide, string][]} onChange={(side) => onChange({ ...force, side })} />
        <Pick<ForceStance> label="O que fazem" value={force.stance} options={Object.entries(FORCE_STANCES) as [ForceStance, string][]} onChange={(stance) => onChange({ ...force, stance })} />
        <Count label="Chegam em (segundos)" value={force.delay} min={0} max={SCENARIO_LIMITS.DELAY} step={15} onChange={(delay) => onChange({ ...force, delay })} />
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {faction.units.map((kind) => (
          <Count key={kind} label={ENEMIES[kind].label} value={force.units[kind] ?? 0} min={0} max={SCENARIO_LIMITS.UNITS} step={2} onChange={(n) => onChange({ ...force, units: { ...force.units, [kind]: n } })} />
        ))}
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        <Field label="Comandante (vazio = sorteado)">
          <input value={force.chief} maxLength={40} onChange={(e) => onChange({ ...force, chief: e.target.value })} className={inputClass} />
        </Field>
        <Pick<string> label="Competência" value={String(force.competence)} options={COMPETENCE.map((text, i) => [String(i + 1), `${i + 1} · ${text}`])} onChange={(v) => onChange({ ...force, competence: Number(v) })} />
        <Pick<NobleTrait> label="Personalidade" value={force.trait} options={FORCE_TRAITS.map((t) => [t, NOBLE_TRAITS[t].label])} onChange={(trait) => onChange({ ...force, trait })} />
      </div>
      {force.stance === "HOLD" && force.delay > 0 && <p className="text-xs text-neutral-400">Quem chega depois e espera em posição só luta se você for até lá.</p>}
    </div>
  );
}

/** Formulário do cenário: cada mudança sobe na hora, e a miniatura acompanha. */
export function ScenarioEditor({ scenario, onChange }: { scenario: BattleScenario; onChange: (s: BattleScenario) => void }) {
  const set = (patch: Partial<BattleScenario>) => onChange({ ...scenario, ...patch });
  const setForce = (i: number, next: ScenarioForce) => set({ forces: scenario.forces.map((f, k) => (k === i ? next : f)) });
  const total = scenarioEnemyTotal(scenario);
  return (
    <div className="flex flex-col gap-4">
      <Section title="O cenário">
        <div className="grid gap-2 sm:grid-cols-[1fr_2fr]">
          <Field label="Nome">
            <input value={scenario.name} maxLength={40} onChange={(e) => set({ name: e.target.value })} className={inputClass} />
          </Field>
          <Field label="Descrição">
            <input value={scenario.description} maxLength={160} onChange={(e) => set({ description: e.target.value })} className={inputClass} />
          </Field>
        </div>
      </Section>

      <Section title="O campo" hint={SCENARIO_MAPS[scenario.map].description}>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Pick<ScenarioMapId> label="Mapa" value={scenario.map} options={(Object.keys(SCENARIO_MAPS) as ScenarioMapId[]).map((id) => [id, SCENARIO_MAPS[id].label])} onChange={(map) => set({ map })} />
          <Pick<ScenarioHour> label="Hora" value={scenario.hour} options={(Object.keys(SCENARIO_HOURS) as ScenarioHour[]).map((id) => [id, SCENARIO_HOURS[id].label])} onChange={(hour) => set({ hour })} />
          <Pick<Season> label="Estação" value={scenario.season} options={SEASONS.ORDER.map((id) => [id, SEASONS.LABEL[id]])} onChange={(season) => set({ season })} />
          <Pick<Weather> label="Tempo" value={scenario.weather} options={(Object.keys(WEATHER.LABEL) as Weather[]).map((id) => [id, WEATHER.LABEL[id]])} onChange={(weather) => set({ weather })} />
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Pick<ScenarioObjective> label="Objetivo" value={scenario.objective} options={(Object.keys(SCENARIO_OBJECTIVES) as ScenarioObjective[]).map((id) => [id, SCENARIO_OBJECTIVES[id].label])} onChange={(objective) => set({ objective })} />
          {scenario.objective === "SURVIVE" && <Count label="Minutos" value={scenario.surviveMinutes} min={SCENARIO_LIMITS.SURVIVE[0]} max={SCENARIO_LIMITS.SURVIVE[1]} onChange={(surviveMinutes) => set({ surviveMinutes })} />}
          <Count label="Distância inicial" value={scenario.distance} min={SCENARIO_LIMITS.DISTANCE[0]} max={SCENARIO_LIMITS.DISTANCE[1]} step={100} onChange={(distance) => set({ distance })} />
          <Pick<WarDifficulty> label="Dificuldade" value={scenario.difficulty} options={(Object.keys(WAR_AI.DIFFICULTY) as WarDifficulty[]).map((id) => [id, WAR_AI.DIFFICULTY[id].label])} onChange={(difficulty) => set({ difficulty })} />
          <label className="flex items-end gap-2 pb-2 text-sm text-neutral-200">
            <input type="checkbox" checked={scenario.fog} onChange={(e) => set({ fog: e.target.checked })} className="accent-amber-500" />
            Névoa de guerra
          </label>
        </div>
        <p className="text-xs text-neutral-400">
          {SCENARIO_OBJECTIVES[scenario.objective].description} {WAR_AI.DIFFICULTY[scenario.difficulty].description}
        </p>
      </Section>

      <ArmyEditor army={scenario.army} onChange={(army) => set({ army })} />

      <Section title="O inimigo" hint={`${scenario.forces.length}/${SCENARIO_LIMITS.FORCES} forças · ${total} combatentes`}>
        {scenario.forces.map((f, i) => (
          <ForceEditor key={f.id} force={f} index={i} onChange={(next) => setForce(i, next)} onRemove={() => set({ forces: scenario.forces.filter((x) => x !== f) })} />
        ))}
        <div>
          <button type="button" disabled={scenario.forces.length >= SCENARIO_LIMITS.FORCES} onClick={() => set({ forces: [...scenario.forces, newForce()] })} className={SMALL_BTN}>
            + Força inimiga
          </button>
        </div>
        {total > SCENARIO_LIMITS.SAFE_TOTAL && <p className="text-xs text-amber-300">Mais de {SCENARIO_LIMITS.SAFE_TOTAL} inimigos em campo pode deixar o jogo lento.</p>}
      </Section>
    </div>
  );
}
