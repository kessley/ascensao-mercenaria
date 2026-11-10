import { marchingIds, templeFaith, townTongue, useGameStore, voiceIn, wagonsWithArmy } from "../../store/useGameStore";
import { TONGUE, barrierOf, fluencyOf, interpreterTitle } from "../../game/sim/language";
import { LANGUAGE } from "../../utils/constants";
import { FAITHS, favorText } from "../../game/sim/faith";
import { packCapacity, packOf } from "../../game/sim/logistics";
import { RESOURCE_LABEL, SETTLEMENT_KIND_LABEL } from "../../game/data/world";
import {
  garrisonCap,
  isCalamityOwner,
  isFactionOwner,
  isSick,
  ownerLabel,
  settlementDefense,
  townPrices,
  weeklyYield,
  type Settlement,
} from "../../game/sim/realm";
import { BUILDINGS, ECONOMY, GOODS, KINGDOM, REALM, TRADE, type BuildingId } from "../../utils/constants";
import { nobleName } from "../../game/sim/nobility";
import { Button } from "./Button";
import { cargoCapacity } from "../../utils/economy";
import { seasonOf } from "../../utils/season";
import { foodGood } from "../../game/sim/market";
import { canHost, freightWeight } from "../../game/sim/trade";
import { ContractDelivery, GoodsMarket } from "./trade/GoodsMarket";
import { BAND_HOME, cultureOf, folkOf, foreignRule, mixText, rulerCulture } from "../../game/sim/culture";
import { useState } from "react";
import { MASTER_SPELLS, masterOffers, spellDef } from "../../game/sim/magic";
import { MAGIC } from "../../utils/constants";

const sectionTitle = "text-sm font-bold uppercase tracking-wider text-neutral-400";

function prosperityLabel(p: number): { text: string; tone: string } {
  if (p >= 80) return { text: "Próspera", tone: "text-green-400" };
  if (p >= 50) return { text: "Abalada", tone: "text-yellow-400" };
  return { text: "Em crise", tone: "text-red-400" };
}

/**
 * Rações (pacotes de comida da praça: tiram grão ou carne do estoque) e o mercado de bens
 * (Marco 14). A colheita, a guerra, os saques e as caravanas mexem nos preços sozinhos.
 */
function Market({ t }: { t: Settlement }) {
  const gold = useGameStore((s) => s.gold);
  const buyRationsAt = useGameStore((s) => s.buyRationsAt);
  const day = useGameStore((s) => s.day);
  const away = useGameStore((s) => s.exposure.away && !s.campPacked);
  const cargo = useGameStore((s) => s.cargo);
  const wagons = useGameStore((s) => wagonsWithArmy(s));
  const goods = useGameStore((s) => freightWeight(s.freight));
  // Em campo, o que se compra enche as mochilas e o resto vai na bolsa ou nas carroças
  const packRoom = useGameStore((s) => {
    const going = marchingIds(s);
    return s.battalions.filter((b) => going.has(b.id)).reduce((n, b) => n + Math.max(0, packCapacity(b) - packOf(b)), 0);
  });
  const prices = townPrices(t, day);
  const room = away ? packRoom + cargoCapacity(wagons) - cargo - goods : Infinity;
  const food = foodGood(t.econ);
  const packs = Math.floor(t.econ.stock[food]);
  return (
    <>
      <ContractDelivery t={t} />
      {t.port && (
        <section className="flex flex-col gap-2">
          <h3 className={sectionTitle}>Cais</h3>
          <Button variant="quiet" onClick={() => useGameStore.getState().setCampPanel({ kind: "DOCK", settlementId: t.id })}>
            Ir ao cais do porto
          </Button>
        </section>
      )}
      <section className="flex flex-col gap-2">
        <h3 className={sectionTitle}>Rações</h3>
        <p className="text-xs text-neutral-400">
          {ECONOMY.RATION_PACK_SIZE} rações por {prices.rationPack} de ouro: {GOODS[food].label.toLowerCase()} da praça, moído e ensacado ({packs} pacote(s) à venda)
          {seasonOf(day) === "AUTUMN" ? " — colheita: os celeiros enchem" : ""}
          {isSick(t, day) ? " — febre na cidade: comida cara" : ""}.
          {away && ` Vai nas carroças: cabem mais ${room}.`}
        </p>
        <div className="flex flex-wrap gap-2">
          {[1, 3].map((n) => (
            <Button key={n} disabled={gold < n * prices.rationPack || n * ECONOMY.RATION_PACK_SIZE > room || packs < n} onClick={() => buyRationsAt(t.id, n)}>
              +{n * ECONOMY.RATION_PACK_SIZE} rações ({n * prices.rationPack} ouro)
            </Button>
          ))}
        </div>
      </section>
      <GoodsMarket t={t} />
    </>
  );
}

/** Sala de Administração: impostos, construções e milícia de um povoado do jogador. */
/**
 * O mestre de magia (Marco 19, parte 3): nas cidades de outra terra, um mestre ensina o que sabe,
 * por ouro e dias. Na terra do bando não há mestre: é preciso cruzar o mar.
 */
function MagicMaster({ t }: { t: Settlement }) {
  const land = useGameStore((s) => s.world?.culture);
  const spells = useGameStore((s) => s.spells);
  const gold = useGameStore((s) => s.gold);
  const learn = useGameStore((s) => s.learnFromMaster);
  const [note, setNote] = useState<string | null>(null);
  if ((t.kind !== "CITY" && t.kind !== "CAPITAL") || (MASTER_SPELLS[land ?? BAND_HOME] ?? []).length === 0) return null;
  const offers = masterOffers(land, spells);
  const L = MAGIC.LEARN;
  return (
    <section className="flex flex-col gap-2">
      <h3 className={sectionTitle}>Mestre de magia</h3>
      {offers.length === 0 && <p className="text-xs text-neutral-400">O mestre daqui já ensinou ao Comandante tudo o que sabe.</p>}
      {offers.map((sp) => (
        <div key={sp} className="flex flex-col gap-1 text-sm">
          <span>
            <b className="text-violet-300">{spellDef(sp).name}</b>: <span className="text-xs text-neutral-400">{spellDef(sp).hint}.</span>
          </span>
          <Button disabled={gold < L.MASTER_GOLD} onClick={() => setNote(learn(t.id, sp) ?? `O Comandante aprendeu ${spellDef(sp).name}.`)}>
            Aprender ({L.MASTER_GOLD} de ouro, {L.MASTER_DAYS} dias)
          </Button>
        </div>
      ))}
      {note && <p className="text-xs text-amber-300">{note}</p>}
    </section>
  );
}

function Administration({ t }: { t: Settlement }) {
  const gold = useGameStore((s) => s.gold);
  const iron = useGameStore((s) => s.iron);
  const build = useGameStore((s) => s.build);
  const setTax = useGameStore((s) => s.setTax);
  const setMarketTax = useGameStore((s) => s.setMarketTax);
  const armMilitia = useGameStore((s) => s.armMilitia);
  const day = useGameStore((s) => s.day);
  const y = weeklyYield(t, day);
  const cap = garrisonCap(t);
  const revolt = t.econ.revoltUntil > day;
  return (
    <>
      <section className="flex flex-col gap-2">
        <h3 className={sectionTitle}>Sala de Administração</h3>
        <p className="font-mono text-xs text-neutral-300">
          Renda semanal: <b className="text-yellow-400">{y.gold} ouro</b> · <b className="text-orange-300">{y.rations} rações</b> ·{" "}
          <b className="text-sky-300">{y.iron} ferro</b>
        </p>
        <p className="text-xs text-neutral-400">
          As rações e o ferro saem do que sobra no mercado do povoado; com fome na cidade, não sobra nada. Agitação:{" "}
          <b className={t.econ.unrest >= 60 ? "text-red-400" : t.econ.unrest >= 30 ? "text-yellow-300" : "text-green-400"}>{Math.round(t.econ.unrest)}/100</b>
          {revolt && <b className="text-red-400"> · EM REVOLTA até o dia {t.econ.revoltUntil}: nada de impostos</b>}. Nível de vida abaixo de 40 agita a gente; em 100, revolta.
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
        <div className="flex items-center gap-2 text-xs">
          <span className="text-neutral-400">Taxa de mercado:</span>
          {TRADE.MARKET_TAX.map((rate, i) => (
            <button
              key={rate}
              type="button"
              onClick={() => setMarketTax(t.id, i as 0 | 1 | 2)}
              className={`rounded border px-2 py-0.5 ${(t.marketTax ?? 1) === i ? "border-amber-400 bg-amber-700/60" : "border-neutral-600 hover:border-amber-400"}`}
            >
              {Math.round(rate * 100)}%
            </button>
          ))}
        </div>
        <p className="text-xs text-neutral-500">Cada caravana que compra ou vende aqui paga a taxa (somada toda semana).</p>
      </section>

      <section className="flex flex-col gap-2">
        <h3 className={sectionTitle}>Construções</h3>
        {(Object.keys(BUILDINGS) as BuildingId[]).filter((id) => canHost(t, id)).map((id) => {
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
 * estiver em ruínas; e atacar (conquista) ou libertar (ocupado por uma calamidade) — só pelo
 * portão, do lado de fora, onde o exército está.
 */
export function SettlementPanel({ settlementId, at }: { settlementId: string; at?: "MARKET" | "HALL" | "CAMP" | "GATE" }) {
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
  const blockade = useGameStore((s) => s.blockade);
  const intel = useGameStore((s) => s.townIntel[settlementId]);
  const rebuild = useGameStore((s) => s.rebuildSettlement);
  const nobles = useGameStore((s) => s.nobles);
  const leader = useGameStore((s) => s.leader);
  const faithFavor = useGameStore((s) => s.faithFavor);
  const lieutenants = useGameStore((s) => s.lieutenants);
  const captains = useGameStore((s) => s.captains);
  const followers = useGameStore((s) => s.followers);
  if (!t || !world) return <p className="text-sm text-neutral-400">Este povoado não existe mais.</p>;

  const prosperity = prosperityLabel(t.prosperity);
  const faction = isFactionOwner(t.owner) ? factions.find((f) => f.id === t.owner) : null;
  const factionDef = faction ? world.factions.find((f) => f.id === faction.id) : null;
  const occupied = isCalamityOwner(t.owner);
  const lord = nobles.find((n) => n.alive && n.fiefs.includes(t.id));
  // A gente do lugar e quem a governa (Marco 23)
  const land = world.culture ?? BAND_HOME;
  const folk = folkOf(t, land, cultureOf(leader));
  const foreign = foreignRule(folk, rulerCulture(t.owner, land, cultureOf(leader)));
  // O templo da cidade e o que ele pensa do bando (Marco 23)
  const temple = templeFaith({ factions, world }, t);
  const templeFavor = faithFavor[temple] ?? 0;
  // A língua da gente de lá e quem fala pelo bando (Marco 23)
  const tongue = townTongue({ world }, t);
  const voice = voiceIn({ leader, lieutenants, captains, followers }, tongue);
  const barrier = barrierOf(voice);

  return (
    <>
      <section className="flex flex-col gap-1 text-sm">
        <p className="text-neutral-300">{t.description}</p>
        <p className="text-xs text-neutral-400">
          {SETTLEMENT_KIND_LABEL[t.kind]} · <b>{ownerLabel(world, calamities, t.owner)}</b> · {t.population} habitantes · guarnição {t.garrison}
        </p>
        {t.owner !== "RUINED" && (
          <p className="text-xs text-neutral-400" data-folk>
            Gente: {mixText(folk)}
            {foreign > 0 && <b className="text-yellow-300"> · governada por gente de fora: lealdade −{Math.round(foreign)}</b>}
          </p>
        )}
        {t.owner !== "RUINED" && (
          <p className="text-xs text-neutral-400" data-temple={temple}>
            Templo: {FAITHS[temple].label}, dos {FAITHS[temple].clergy} · o templo {favorText(templeFavor)}
          </p>
        )}
        {t.owner !== "RUINED" && (
          <p className="text-xs text-neutral-400" data-tongue={tongue} data-voice={voice.by}>
            Língua: {TONGUE[tongue].label}
            {voice.by === "SELF" && " · o Comandante fala"}
            {voice.by === "INTERPRETER" && ` · ${interpreterTitle(voice.who ?? "?")}, fala pelo bando`}
            {voice.by === "OFFICER" && ` · ${voice.who} fala pelo bando, como pode`}
            {voice.by === "NONE" && (
              <b className="text-yellow-300">
                {" "}
                · ninguém no bando fala (o Comandante sabe {Math.floor(fluencyOf(leader, tongue))} de {LANGUAGE.FLUENT}): preços {Math.round(LANGUAGE.PRICE * barrier * 100)}% piores, contratos com menos detalhe e boatos truncados
              </b>
            )}
          </p>
        )}
        {(at === "CAMP" || at === "GATE") && t.owner !== "RUINED" && (
          <p className="text-xs text-neutral-400">
            {t.garrison > 0
              ? `${t.garrison} soldados vivem nos acampamentos por dentro dos portões: sentinelas nos portões, rondas pelas ruas e o resto nas barracas.`
              : "Os acampamentos estão vazios: ninguém guarda os portões."}
            {t.owner !== "PLAYER" && " Os guardas não deixam o exército do bando entrar; o Comandante entra sozinho (menos em guerra)."}
          </p>
        )}
        {(t.resources ?? []).length > 0 && (
          <p className="text-xs text-neutral-400">
            Recursos da terra: <b className="text-amber-200">{(t.resources ?? []).map((r) => RESOURCE_LABEL[r]).join(", ")}</b>
            {t.owner === "PLAYER" ? " (renda semanal extra)" : ""}
            {(t.resources ?? []).includes("IRON") ? " · ferro barato no mercado" : ""}
            {(t.resources ?? []).some((r) => r === "GRAIN" || r === "FISH") ? " · comida barata" : ""}
          </p>
        )}
        {t.owner !== "RUINED" && (
          <p className="text-xs text-neutral-400">
            Prosperidade: <b className={prosperity.tone}>{prosperity.text}</b> ({Math.round(t.prosperity)}/100)
            {t.lastRaidDay !== null && ` · atacada no dia ${t.lastRaidDay}${t.lastRaidDay >= day - 3 ? " (recente!)" : ""}`}
          </p>
        )}
        {t.owner !== "RUINED" && (
          <p className="text-xs text-neutral-400">
            Lealdade ao dono:{" "}
            <b className={(t.loyalty ?? 70) < KINGDOM.LOYALTY_REVOLT + 10 ? "text-red-400" : (t.loyalty ?? 70) < 55 ? "text-yellow-300" : "text-green-400"}>{Math.round(t.loyalty ?? 70)}/100</b>
            {lord ? ` · senhor: ${nobleName(lord, factionDef?.name ?? "reino")}` : ""}
            {t.besiegedBy ? ` · SOB CERCO do ${world.factions.find((f) => f.id === t.besiegedBy)?.name ?? "inimigo"}` : ""}
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
      {t.owner !== "RUINED" && !occupied && !faction?.atWar && <MagicMaster t={t} />}

      {t.owner === "RUINED" && (
        <section className="flex flex-col gap-2">
          <h3 className={sectionTitle}>Ruínas</h3>
          <p className="text-xs text-neutral-400">Os sobreviventes aceitariam a proteção do bando se alguém pagasse a reconstrução.</p>
          <Button disabled={gold < REALM.REBUILD_COST.gold || iron < REALM.REBUILD_COST.iron} onClick={() => rebuild(t.id)}>
            Reconstruir ({REALM.REBUILD_COST.gold} ouro · {REALM.REBUILD_COST.iron} ferro)
          </Button>
        </section>
      )}

      {t.owner !== "PLAYER" && t.owner !== "RUINED" && at !== "GATE" && (
        <p className="text-xs text-neutral-500">
          {occupied ? "Para libertar" : "Para atacar"} {t.name}, saia dos muros e fale do portão: o exército espera do lado de fora.
        </p>
      )}

      {t.owner !== "PLAYER" && t.owner !== "RUINED" && at === "GATE" && (
        <section className="flex flex-col gap-2 rounded border border-red-800/70 bg-red-950/30 p-3">
          <h3 className={sectionTitle}>{occupied ? "Libertar" : "Conquistar"}</h3>
          <p className="text-xs text-neutral-300">
            {occupied
              ? `A guarnição de ${ownerLabel(world, calamities, t.owner)} sai para lutar. Vença e o povoado passa ao bando — e todas as coroas ficam gratas.`
              : faction
                ? `Atacar ${t.name} é declarar guerra ao ${factionDef?.name}. O reino mandará exércitos contra os seus povoados.`
                : `${t.name} é livre. Tomá-la pela espada assusta todos os reinos.`}
          </p>
          {intel && (
            <p className="text-xs text-sky-300">
              Batedores (dia {intel.day}): cerca de {intel.garrison} na guarnição, comida para uns {intel.food} dias, e o portão {intel.weakGate} está mal cuidado.
            </p>
          )}
          <Button variant="danger" disabled={!!siege || !!mutiny} onClick={() => blockade(t.id)}>
            {siege
              ? "Já há um cerco em andamento"
              : occupied
                ? `Cercar ${t.name}: fechar os muros e libertá-la`
                : `Cercar ${t.name}: fome, escadas e aríete (${Math.min(REALM.SIEGE_MAX_DEFENDERS, Math.max(REALM.SIEGE_MIN_DEFENDERS, t.garrison))} defensores)`}
          </Button>
          <Button variant="danger" disabled={!!siege || !!mutiny} onClick={() => besiege(t.id)}>
            Atacar agora: a guarnição sai e luta do lado de fora
          </Button>
        </section>
      )}
    </>
  );
}
