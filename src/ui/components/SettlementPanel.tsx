import { useGameStore } from "../../store/useGameStore";
import { SETTLEMENT_KIND_LABEL } from "../../game/data/world";
import {
  garrisonCap,
  isCalamityOwner,
  isFactionOwner,
  ownerLabel,
  settlementDefense,
  townPrices,
  weeklyYield,
  type Settlement,
} from "../../game/sim/realm";
import { BUILDINGS, ECONOMY, REALM, type BuildingId } from "../../utils/constants";
import { Button } from "./Button";

const sectionTitle = "text-sm font-bold uppercase tracking-wider text-neutral-400";

function prosperityLabel(p: number): { text: string; tone: string } {
  if (p >= 80) return { text: "Próspera", tone: "text-green-400" };
  if (p >= 50) return { text: "Abalada", tone: "text-yellow-400" };
  return { text: "Em crise", tone: "text-red-400" };
}

/** Rações e ferro a preços locais (a prosperidade mexe nos preços). */
function Market({ t }: { t: Settlement }) {
  const gold = useGameStore((s) => s.gold);
  const iron = useGameStore((s) => s.iron);
  const buyRationsAt = useGameStore((s) => s.buyRationsAt);
  const tradeIronAt = useGameStore((s) => s.tradeIronAt);
  const prices = townPrices(t);
  return (
    <>
      <section className="flex flex-col gap-2">
        <h3 className={sectionTitle}>Mercado: rações</h3>
        <p className="text-xs text-neutral-400">
          {ECONOMY.RATION_PACK_SIZE} rações por {prices.rationPack} de ouro (Intendência do acampamento: {ECONOMY.RATION_PACK_PRICE}).
        </p>
        <div className="flex flex-wrap gap-2">
          {[1, 3].map((n) => (
            <Button key={n} disabled={gold < n * prices.rationPack} onClick={() => buyRationsAt(t.id, n)}>
              +{n * ECONOMY.RATION_PACK_SIZE} rações ({n * prices.rationPack} ouro)
            </Button>
          ))}
        </div>
      </section>
      <section className="flex flex-col gap-2">
        <h3 className={sectionTitle}>Mercado: ferro</h3>
        <p className="text-xs text-neutral-400">
          Compra a {prices.ironBuy} de ouro, vende a {prices.ironSell}.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button disabled={gold < prices.ironBuy * 3} onClick={() => tradeIronAt(t.id, 3)}>
            Comprar 3 ferro ({prices.ironBuy * 3} ouro)
          </Button>
          <Button variant="danger" disabled={iron < 3} onClick={() => tradeIronAt(t.id, -3)}>
            Vender 3 ferro (+{prices.ironSell * 3} ouro)
          </Button>
        </div>
      </section>
    </>
  );
}

/** Sala de Administração: impostos, construções e milícia de um povoado do jogador. */
function Administration({ t }: { t: Settlement }) {
  const gold = useGameStore((s) => s.gold);
  const iron = useGameStore((s) => s.iron);
  const build = useGameStore((s) => s.build);
  const setTax = useGameStore((s) => s.setTax);
  const armMilitia = useGameStore((s) => s.armMilitia);
  const y = weeklyYield(t);
  const cap = garrisonCap(t);
  return (
    <>
      <section className="flex flex-col gap-2">
        <h3 className={sectionTitle}>Sala de Administração</h3>
        <p className="font-mono text-xs text-neutral-300">
          Renda semanal: <b className="text-yellow-400">{y.gold} ouro</b> · <b className="text-orange-300">{y.rations} rações</b> ·{" "}
          <b className="text-sky-300">{y.iron} ferro</b>
        </p>
        <div className="flex items-center gap-2 text-xs">
          <span className="text-neutral-400">Impostos:</span>
          {REALM.TAX.map((tax, i) => (
            <button
              key={tax.label}
              type="button"
              onClick={() => setTax(t.id, i as 0 | 1 | 2)}
              className={`rounded border px-2 py-0.5 ${t.taxRate === i ? "border-amber-400 bg-amber-700/60" : "border-neutral-600 hover:border-amber-400"}`}
            >
              {tax.label}
            </button>
          ))}
        </div>
        <p className="text-xs text-neutral-500">Baixos: a prosperidade sobe. Altos: mais ouro, mas a cidade empobrece dia a dia.</p>
      </section>

      <section className="flex flex-col gap-2">
        <h3 className={sectionTitle}>Construções</h3>
        {(Object.keys(BUILDINGS) as BuildingId[]).map((id) => {
          const b = BUILDINGS[id];
          const built = t.buildings.includes(id);
          return (
            <div key={id} className="flex items-center justify-between gap-2 rounded bg-neutral-800 px-3 py-2 text-sm">
              <div>
                <div className="font-semibold">{b.label}</div>
                <div className="text-xs text-neutral-400">{b.effect}</div>
              </div>
              {built ? (
                <span className="text-xs font-bold text-green-400">Construído</span>
              ) : (
                <button
                  type="button"
                  disabled={gold < b.gold || iron < b.iron}
                  onClick={() => build(t.id, id)}
                  className="rounded border border-blue-400 bg-blue-600 px-2 py-1 text-xs font-semibold hover:bg-blue-500 disabled:opacity-40"
                >
                  {b.gold} ouro{b.iron ? ` · ${b.iron} ferro` : ""}
                </button>
              )}
            </div>
          );
        })}
      </section>

      <section className="flex flex-col gap-2">
        <h3 className={sectionTitle}>Guarnição</h3>
        <p className="text-xs text-neutral-400">
          {t.garrison}/{cap} milicianos · defesa {settlementDefense(t)}. Sem o exército por perto, é ela que enfrenta bandos, exércitos e hordas.
        </p>
        <Button disabled={gold < REALM.MILITIA.GOLD || t.garrison >= cap} onClick={() => armMilitia(t.id)}>
          Armar milícia (+{REALM.MILITIA.MEN} por {REALM.MILITIA.GOLD} ouro)
        </Button>
      </section>
    </>
  );
}

/**
 * Painel de um povoado: mercado; Sala de Administração se ele for do bando; reconstruir se
 * estiver em ruínas; e atacar (conquista) ou libertar (ocupado por uma calamidade).
 */
export function SettlementPanel({ settlementId }: { settlementId: string }) {
  const t = useGameStore((s) => s.settlements.find((x) => x.id === settlementId));
  const world = useGameStore((s) => s.world);
  const calamities = useGameStore((s) => s.calamities);
  const factions = useGameStore((s) => s.factions);
  const gold = useGameStore((s) => s.gold);
  const iron = useGameStore((s) => s.iron);
  const day = useGameStore((s) => s.day);
  const siege = useGameStore((s) => s.siege);
  const mutiny = useGameStore((s) => s.mutiny);
  const besiege = useGameStore((s) => s.besiege);
  const rebuild = useGameStore((s) => s.rebuildSettlement);
  if (!t || !world) return <p className="text-sm text-neutral-400">Este povoado não existe mais.</p>;

  const prosperity = prosperityLabel(t.prosperity);
  const faction = isFactionOwner(t.owner) ? factions.find((f) => f.id === t.owner) : null;
  const factionDef = faction ? world.factions.find((f) => f.id === faction.id) : null;
  const occupied = isCalamityOwner(t.owner);

  return (
    <>
      <section className="flex flex-col gap-1 text-sm">
        <p className="text-neutral-300">{t.description}</p>
        <p className="text-xs text-neutral-400">
          {SETTLEMENT_KIND_LABEL[t.kind]} · <b>{ownerLabel(world, calamities, t.owner)}</b> · {t.population} habitantes · guarnição {t.garrison}
        </p>
        {t.owner !== "RUINED" && (
          <p className="text-xs text-neutral-400">
            Prosperidade: <b className={prosperity.tone}>{prosperity.text}</b> ({Math.round(t.prosperity)}/100)
            {t.lastRaidDay !== null && ` · atacada no dia ${t.lastRaidDay}${t.lastRaidDay >= day - 3 ? " (recente!)" : ""}`}
          </p>
        )}
        {faction && factionDef && (
          <p className="text-xs text-neutral-400">
            Governo: {faction.ruler} · relação com o bando{" "}
            <b className={faction.atWar ? "text-red-400" : faction.relation >= 0 ? "text-green-400" : "text-yellow-400"}>
              {faction.atWar ? "em guerra" : Math.round(faction.relation)}
            </b>
          </p>
        )}
      </section>

      {t.owner === "PLAYER" && <Administration t={t} />}
      {t.owner !== "RUINED" && !occupied && !faction?.atWar && <Market t={t} />}

      {t.owner === "RUINED" && (
        <section className="flex flex-col gap-2">
          <h3 className={sectionTitle}>Ruínas</h3>
          <p className="text-xs text-neutral-400">Os sobreviventes aceitariam a proteção do bando se alguém pagasse a reconstrução.</p>
          <Button disabled={gold < REALM.REBUILD_COST.gold || iron < REALM.REBUILD_COST.iron} onClick={() => rebuild(t.id)}>
            Reconstruir ({REALM.REBUILD_COST.gold} ouro · {REALM.REBUILD_COST.iron} ferro)
          </Button>
        </section>
      )}

      {t.owner !== "PLAYER" && t.owner !== "RUINED" && (
        <section className="flex flex-col gap-2 rounded border border-red-800/70 bg-red-950/30 p-3">
          <h3 className={sectionTitle}>{occupied ? "Libertar" : "Conquistar"}</h3>
          <p className="text-xs text-neutral-300">
            {occupied
              ? `A guarnição de ${ownerLabel(world, calamities, t.owner)} sai para lutar. Vença e o povoado passa ao bando — e todas as coroas ficam gratas.`
              : faction
                ? `Atacar ${t.name} é declarar guerra ao ${factionDef?.name}. O reino mandará exércitos contra os seus povoados.`
                : `${t.name} é livre. Tomá-la pela espada assusta todos os reinos.`}
          </p>
          <Button variant="danger" disabled={!!siege || !!mutiny} onClick={() => besiege(t.id)}>
            {siege ? "Já há um cerco em andamento" : occupied ? `Libertar ${t.name}` : `Atacar ${t.name} (${Math.min(REALM.SIEGE_MAX_DEFENDERS, Math.max(5, t.garrison))} defensores)`}
          </Button>
        </section>
      )}
    </>
  );
}
