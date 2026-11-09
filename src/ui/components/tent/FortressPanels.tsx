import { useState } from "react";
import { useShallow } from "zustand/react/shallow";
import { useGameStore } from "../../../store/useGameStore";
import { castellanHome, cityDriversOf, garrisonOf, landCtxOf } from "../../../store/fortressSlice";
import {
  CITY_STAGES,
  DECREE,
  DECREES,
  STAGE,
  TAX,
  VETERAN_FAMILY,
  VETERAN_LEVEL,
  dailyGrowth,
  stageCap,
  stageOf,
  weeklyGold,
  type CityDrivers,
  type CityTax,
} from "../../../game/sim/seatCity";
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
import { BUILDING_ICON } from "../../../game/art/icons";
import { PixelIcon } from "../PixelIcon";

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
            <PixelIcon id={BUILDING_ICON[k]} /> {CAMP_BUILDINGS[k].label}
          </button>
        ))}
      </div>
      {msg && <p className="text-xs text-red-300">{msg}</p>}
    </div>
  );
}

const DRIVER_LABEL: Record<keyof CityDrivers, string> = { security: "Segurança", food: "Comida", commerce: "Comércio", fame: "Fama" };

/**
 * A cidade que nasce em volta da sede (Marco 22, parte 4): o jogador não põe casa nenhuma. Aqui
 * ele vê a etapa, o que faz a gente vir e governa pelos impostos e pelos decretos.
 */
export function SeatCityPanel() {
  const city = useGameStore((s) => s.seatCity);
  const plan = useGameStore((s) => s.campPlan);
  const drivers = useGameStore(useShallow(cityDriversOf));
  const town = useGameStore((s) => (s.seatCity?.settlementId ? s.settlements.find((t) => t.id === s.seatCity?.settlementId) : undefined));
  const battalions = useGameStore((s) => s.battalions);
  const setDecree = useGameStore((s) => s.setDecree);
  const setCityTax = useGameStore((s) => s.setCityTax);
  const retireVeterans = useGameStore((s) => s.retireVeterans);
  const [msg, setMsg] = useState<string | null>(null);
  if (!city) return null;
  const stage = stageOf(city.people);
  const next = CITY_STAGES[CITY_STAGES.indexOf(stage) + 1];
  const capped = next && STAGE[next].from > stageCap(plan);
  const growth = dailyGrowth(city, drivers);
  const gold = weeklyGold(city, drivers);
  const veterans = city.decrees.includes("VETERANS") ? battalions.filter((b) => b.level >= VETERAN_LEVEL && b.soldiers > 1) : [];
  return (
    <div className="flex flex-col gap-2 text-sm">
      <h3 className="text-xs font-bold uppercase tracking-wider text-amber-200/70">
        Cidade da sede · {STAGE[stage].label} · {Math.round(city.people)} moradores
      </h3>
      <p className="text-xs text-neutral-400">
        {STAGE[stage].text}{" "}
        {next
          ? capped
            ? `Sem a muralha de pedra da fortaleza, não passa de ${STAGE[stage].label.toLowerCase()}.`
            : `${STAGE[next].label} com ${STAGE[next].from} moradores.`
          : "A cidade inteira."}{" "}
        {growth >= 0 ? `Chegam uns ${growth.toFixed(1).replace(".", ",")} por dia.` : "Sem segurança, a gente vai embora."}
      </p>
      <div className="grid grid-cols-4 gap-1 text-xs">
        {(Object.keys(DRIVER_LABEL) as (keyof CityDrivers)[]).map((k) => (
          <div key={k} className="flex flex-col gap-0.5">
            <span className="text-neutral-400">{DRIVER_LABEL[k]}</span>
            <div className="h-1.5 rounded bg-neutral-800">
              <div className={`h-1.5 rounded ${drivers[k] < 0.25 ? "bg-red-400" : "bg-emerald-400"}`} style={{ width: `${Math.round(drivers[k] * 100)}%` }} />
            </div>
          </div>
        ))}
      </div>
      <p className="text-xs text-neutral-400">
        {town
          ? `${town.name} é uma vila do bando no reino: os impostos vêm por ela (lealdade ${Math.round(town.loyalty ?? 70)}).`
          : stage === "CAMPTOWN"
            ? "O arraial ainda não paga imposto."
            : "O burgo paga imposto toda semana."}{" "}
        {gold !== 0 && `Esta semana: ${gold > 0 ? "+" : ""}${gold} de ouro${city.decrees.length > 0 ? " (com o custo dos decretos)" : ""}.`}
      </p>
      <label className="flex items-center justify-between gap-2 text-neutral-200">
        Impostos
        <select
          aria-label="Impostos da cidade da sede"
          value={city.tax}
          onChange={(e) => setCityTax(Number(e.target.value) as CityTax)}
          className="rounded bg-neutral-900 px-1 py-0.5 text-xs text-neutral-200"
        >
          {([0, 1, 2] as CityTax[]).map((t) => (
            <option key={t} value={t}>
              {TAX[t].label}
            </option>
          ))}
        </select>
      </label>
      <div className="flex flex-col gap-1">
        {DECREES.map((k) => {
          const on = city.decrees.includes(k);
          return (
            <button
              key={k}
              type="button"
              onClick={() => setMsg(setDecree(k, !on))}
              className={`rounded border px-2 py-1 text-left text-xs ${on ? "border-amber-400 bg-amber-900/40 text-amber-200" : "border-neutral-600 bg-neutral-800 text-neutral-300 hover:border-neutral-400"}`}
            >
              <b>{DECREE[k].label}</b>
              {DECREE[k].upkeep > 0 && <span className="text-neutral-400"> · {DECREE[k].upkeep} ouro/semana</span>}
              <span className="block text-neutral-400">{DECREE[k].text}</span>
            </button>
          );
        })}
      </div>
      {city.decrees.includes("VETERANS") && (
        <div className="flex flex-col gap-1 text-xs">
          <span className="text-neutral-400">
            Milícia: {city.militia} veteranos. Cada um traz {VETERAN_FAMILY - 1} da família.
          </span>
          {veterans.length === 0 && <span className="text-neutral-500">Nenhum batalhão de nível {VETERAN_LEVEL} ou mais.</span>}
          {veterans.map((b) => (
            <div key={b.id} className="flex items-center justify-between gap-2">
              <span className="text-neutral-200">
                {b.name} · Nv {b.level} · {b.soldiers} soldados
              </span>
              <Button className="shrink-0 px-2 py-1 text-xs" onClick={() => setMsg(retireVeterans(b.id, 1))}>
                Aposentar 1
              </Button>
            </div>
          ))}
        </div>
      )}
      {msg && <p className="text-xs text-red-300">{msg}</p>}
    </div>
  );
}
