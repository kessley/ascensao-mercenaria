import { useState } from "react";
import { useGameStore } from "../../../store/useGameStore";
import { castellanHome, garrisonOf, landCtxOf } from "../../../store/fortressSlice";
import { CAMP_BUILDINGS, CARGO_PER_WAGON, PALISADE, STONE_WALL, costText, growProblem, readyOf, shortOf, type CampKind } from "../../../game/data/campGrid";
import {
  FIELD_KIT_MAX,
  LAND,
  LAND_PATHS,
  kitCargo,
  kitChoices,
  landProblem,
  seatDefense,
  siegeHost,
  standardCost,
  type LandPath,
} from "../../../game/sim/fortress";
import { fullName } from "../../../game/data/lieutenants";
import { Button } from "../Button";

function useStock() {
  const gold = useGameStore((s) => s.gold);
  const wood = useGameStore((s) => s.depot.WOOD ?? 0);
  const iron = useGameStore((s) => s.iron);
  return { gold, wood, iron };
}

/**
 * Fincar o estandarte (Marco 22, parte 3): da paliçada grande, a fortaleza. O que falta, o terreno
 * e os três caminhos da terra, cada um com o preço e o que ainda não deixa.
 */
export function StandardPanel() {
  const plan = useGameStore((s) => s.campPlan);
  const fame = useGameStore((s) => s.fame);
  const battalions = useGameStore((s) => s.battalions.length);
  const fit = useGameStore((s) => s.battleHud?.standardBlocked ?? null);
  const plant = useGameStore((s) => s.plantStandard);
  // A terra muda com o dia, as relações e os moradores das ruínas: o painel relê tudo quando eles mudam
  useGameStore((s) => s.day);
  useGameStore((s) => s.factions);
  useGameStore((s) => s.siteLife);
  const land = landCtxOf(useGameStore.getState());
  const stock = useStock();
  const [msg, setMsg] = useState<string | null>(null);
  const step = PALISADE[34];
  const need = growProblem(plan, { fame, battalions });
  return (
    <div className="flex flex-col gap-2 text-sm">
      <span className="text-neutral-200">
        Fincar o estandarte: a fortaleza (34×34)
        <span className="block text-xs text-neutral-400">
          fama {step.fame} · {step.battalions} batalhões · {step.needs.map(([k]) => CAMP_BUILDINGS[k].label.toLowerCase()).join(", ")}. A sede não anda mais: em campanha, o bando leva o acampamento de campo.
        </span>
        {need && <span className="block text-xs text-red-300">{need}</span>}
        {fit && <span className="block text-xs text-red-300">{fit}</span>}
      </span>
      {LAND_PATHS.map((path: LandPath) => {
        const cost = standardCost(path);
        const why = need ?? fit ?? landProblem(path, land) ?? shortOf(cost, stock);
        return (
          <div key={path} className="flex items-center justify-between gap-2 rounded border border-neutral-800 bg-neutral-800/50 px-2 py-1">
            <span className="text-neutral-200">
              {LAND[path].label}
              <span className="block text-xs text-neutral-400">{LAND[path].text}</span>
              {path === "CHARTER" && land.lord && <span className="block text-xs text-neutral-500">Senhor da terra: {land.lord.name} (relação {Math.round(land.lord.relation)})</span>}
              {path === "RUINS" && land.ruins && <span className="block text-xs text-neutral-500">{land.ruins.name}: {Math.round(land.ruins.fill * 100)}% de moradores</span>}
              {!need && !fit && landProblem(path, land) && <span className="block text-xs text-red-300">{landProblem(path, land)}</span>}
            </span>
            <Button className="shrink-0 px-2 py-1 text-xs" disabled={!!why} onClick={() => setMsg(plant(path, fit))}>
              {costText(cost)}
            </Button>
          </div>
        );
      })}
      {msg && <p className="text-xs text-red-300">{msg}</p>}
    </div>
  );
}

/** A sede: a muralha, o castelão, a guarnição, o próximo cerco e o kit do acampamento de campo. */
export function FortressPanel() {
  const fortress = useGameStore((s) => s.fortress);
  const plan = useGameStore((s) => s.campPlan);
  const lieutenants = useGameStore((s) => s.lieutenants);
  const battalions = useGameStore((s) => s.battalions);
  const campStay = useGameStore((s) => s.campStay);
  const exposure = useGameStore((s) => s.exposure);
  const fame = useGameStore((s) => s.fame);
  const wagons = useGameStore((s) => s.wagons.length);
  const factions = useGameStore((s) => s.world?.factions);
  const stoneWall = useGameStore((s) => s.buildStoneWall);
  const setCastellan = useGameStore((s) => s.setCastellan);
  const setFieldKit = useGameStore((s) => s.setFieldKit);
  const stock = useStock();
  const [msg, setMsg] = useState<string | null>(null);
  if (!fortress) return null;
  const lord = fortress.lord ? factions?.find((f) => f.id === fortress.lord)?.name : null;
  // A guarnição de quando o bando sair: quem fica no acampamento (escolhido na saída)
  const stay = garrisonOf({ battalions, campStay, exposure: { ...exposure, away: true } });
  const soldiers = stay.reduce((n, b) => n + b.soldiers, 0);
  const home = castellanHome({ fortress, lieutenants, campStay, exposure: { ...exposure, away: true } });
  const defense = Math.round(seatDefense(plan, soldiers, home));
  const host = siegeHost(fame, fortress.sieges);
  const dovecote = readyOf(plan, "DOVECOTE").length > 0;
  const choices = kitChoices(plan);
  const toggle = (k: CampKind) => setMsg(setFieldKit(fortress.kit.includes(k) ? fortress.kit.filter((x) => x !== k) : [...fortress.kit, k]));
  return (
    <div className="flex flex-col gap-2 text-sm">
      <p className="text-xs text-neutral-400">
        Terra: {LAND[fortress.land].label.toLowerCase()}
        {lord ? ` de ${lord} (o bando é vassalo)` : ""}. Estandarte fincado no dia {fortress.founded}.
      </p>
      <div className="flex items-center justify-between gap-2">
        <span className="text-neutral-200">
          Muralha de {plan.wall === "STONE" ? "pedra" : "madeira"}
          <span className="block text-xs text-neutral-400">
            {plan.wall === "STONE" ? "A mais forte: cada defensor vale por dois e meio." : `De pedra, segura ${Math.round(STONE_WALL.guard * 100)}% a mais do saque e a guarnição vale muito mais.`}
          </span>
        </span>
        {plan.wall !== "STONE" && (
          <Button className="shrink-0 px-2 py-1 text-xs" disabled={!!shortOf(STONE_WALL.cost, stock)} onClick={() => setMsg(stoneWall())}>
            {costText(STONE_WALL.cost)}
          </Button>
        )}
      </div>
      <label className="flex items-center justify-between gap-2 text-neutral-200">
        Castelão
        <select
          aria-label="Castelão da fortaleza"
          value={fortress.castellan ?? ""}
          onChange={(e) => setCastellan(e.target.value || null)}
          className="rounded bg-neutral-900 px-1 py-0.5 text-xs text-neutral-200"
        >
          <option value="">ninguém</option>
          {lieutenants.map((l) => (
            <option key={l.id} value={l.id}>
              {fullName(l)}
            </option>
          ))}
        </select>
      </label>
      <p className="text-xs text-neutral-400">
        Guarnição quando o bando sair: {stay.length > 0 ? `${stay.map((b) => b.name).join(", ")} (${soldiers} soldados)` : "ninguém (escolha quem fica na saída do acampamento)"}.
        {fortress.castellan && !home && " O castelão só fica se o batalhão dele ficar (ou se não comandar nenhum)."}
      </p>
      <p className={`text-xs ${defense >= host ? "text-emerald-300" : "text-red-300"}`}>
        Sem o bando, a sede se defende com força {defense} contra uns {host} cercadores.{" "}
        {dovecote ? `Próximo cerco por volta do dia ${fortress.nextSiege}.` : "Sem pombal, o aviso do cerco chega na véspera."}
      </p>
      <h3 className="text-xs font-bold uppercase tracking-wider text-amber-200/70">
        Acampamento de campo · {fortress.kit.length} de {FIELD_KIT_MAX} · carga {kitCargo(fortress.kit)} de {wagons * CARGO_PER_WAGON}
      </h3>
      <p className="text-xs text-neutral-400">Longe da fortaleza, o bando monta a tenda, a fogueira e o kit: barracas tiram o relento, a enfermaria cuida dos feridos.</p>
      <div className="flex flex-wrap gap-1">
        {choices.length === 0 && <span className="text-xs text-neutral-500">Nada na fortaleza que ande nas carroças.</span>}
        {choices.map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => toggle(k)}
            className={`rounded border px-2 py-1 text-xs ${fortress.kit.includes(k) ? "border-amber-400 bg-amber-900/40 text-amber-200" : "border-neutral-600 bg-neutral-800 text-neutral-300 hover:border-neutral-400"}`}
          >
            {CAMP_BUILDINGS[k].label}
          </button>
        ))}
      </div>
      {msg && <p className="text-xs text-red-300">{msg}</p>}
    </div>
  );
}
