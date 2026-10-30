import { useState } from "react";
import { useGameStore } from "../../../store/useGameStore";
import { quote } from "../../../game/sim/market";
import { freightOf, freightWeight, isContraband } from "../../../game/sim/trade";
import type { Settlement } from "../../../game/sim/realm";
import { GOODS, GOOD_LIST, MARKET, TRADE, type Good } from "../../../utils/constants";
import { cargoCapacity } from "../../../utils/economy";
import { Sparkline, priceTint } from "./Sparkline";

const sectionTitle = "text-sm font-bold uppercase tracking-wider text-neutral-400";
const small = "rounded border px-1.5 py-0.5 text-[11px] font-semibold disabled:opacity-30";

/**
 * Mercado de bens de um povoado (Marco 14): preço de compra e de venda de cada bem (com a
 * margem do mercador; a feitoria do bando melhora), o estoque da praça, o que o bando leva e
 * a linha dos últimos preços. Comprar encarece o próximo; vender barateia — o mercado sente.
 */
export function GoodsMarket({ t }: { t: Settlement }) {
  const gold = useGameStore((s) => s.gold);
  const freight = useGameStore((s) => s.freight);
  const wagons = useGameStore((s) => s.wagons.length);
  const cargo = useGameStore((s) => (s.exposure.away && !s.campPacked ? s.cargo : 0));
  const near = useGameStore((s) => s.battleHud?.wagonsNear ?? true);
  const post = useGameStore((s) => s.posts.includes(t.id));
  const wars = useGameStore((s) => s.wars);
  const tradeGood = useGameStore((s) => s.tradeGood);
  const [msg, setMsg] = useState<string | null>(null);
  const margin = post ? TRADE.POST_MARGIN : 0;
  const cap = near ? cargoCapacity(wagons) : TRADE.PURSE_CAPACITY;
  const used = cargo + freightWeight(freight);
  const room = Math.max(0, cap - used);
  const act = (g: Good, qty: number) => setMsg(tradeGood(t.id, g, qty));
  const short = GOOD_LIST.filter((g) => t.econ.price[g] >= GOODS[g].base * 1.8);

  return (
    <section className="flex flex-col gap-2">
      <h3 className={sectionTitle}>Mercado de {t.name}</h3>
      <p className="text-xs text-neutral-400">
        Nível de vida <b className={t.econ.sol >= 60 ? "text-green-400" : t.econ.sol >= 40 ? "text-yellow-300" : "text-red-400"}>{t.econ.sol}/100</b>
        {t.econ.famine && <b className="text-red-400"> · FOME</b>}
        {short.length > 0 && <> · falta {short.map((g) => GOODS[g].label.toLowerCase()).join(", ")}</>}
        {post && <span className="text-violet-300"> · feitoria do bando (margem melhor)</span>}
      </p>
      <p className="text-xs text-neutral-400">
        {near ? "Carroças" : "Sem as carroças por perto: só a bolsa do Comandante"} — carga {used}/{cap} (cabe mais {room} de peso).
        Comprar encarece o próximo; vender barateia.
      </p>
      <div className="grid grid-cols-[1fr_auto_auto_auto_auto] items-center gap-x-2 gap-y-1 text-xs">
        <span className="text-[10px] uppercase text-neutral-500">Bem</span>
        <span className="text-[10px] uppercase text-neutral-500">Preço</span>
        <span className="text-[10px] uppercase text-neutral-500" title="Compra / venda por unidade">Compra · venda</span>
        <span className="text-[10px] uppercase text-neutral-500" title="Na praça · com o bando">Praça · bando</span>
        <span />
        {GOOD_LIST.map((g) => {
          const d = GOODS[g];
          const buy = quote(t.econ, g, 1, "BUY", margin).total;
          const sell = quote(t.econ, g, 1, "SELL", margin).total;
          const have = freightOf(freight, g);
          const stock = Math.floor(t.econ.stock[g]);
          const ratio = t.econ.price[g] / d.base;
          const fits = d.weight === 0 ? 99 : Math.floor(room / d.weight);
          const contraband = freight.some((l) => l.good === g && isContraband(l, t, wars));
          return (
            <div key={g} className="contents">
              <span className="truncate" title={`${d.label}: preço base ${d.base}, peso ${d.weight} por unidade`}>
                {d.icon} {d.label}
                {contraband && <span className="ml-1 text-[10px] text-amber-400" title="Carga de um reino em guerra com este: contrabando (paga mais, mas os guardas podem confiscar)">⚠ contrabando</span>}
              </span>
              <span className="flex items-center gap-1">
                <Sparkline values={t.econ.history[g] ?? []} base={d.base} label={d.label} width={56} height={18} />
                <span className="rounded px-1 font-mono text-neutral-100" style={{ background: priceTint(ratio) }} title={`${Math.round(ratio * 100)}% do preço base`}>
                  {Math.round(t.econ.price[g])}
                </span>
              </span>
              <span className="font-mono text-neutral-300">
                {buy} · {sell}
              </span>
              <span className="font-mono text-neutral-300">
                {stock} · <b className="text-violet-300">{have}</b>
              </span>
              <span className="flex gap-0.5">
                <button type="button" className={`${small} border-blue-400 bg-blue-700`} disabled={stock < 1 || gold < buy || fits < 1} onClick={() => act(g, 1)}>
                  +1
                </button>
                <button type="button" className={`${small} border-blue-400 bg-blue-700`} disabled={stock < 5 || fits < 5} onClick={() => act(g, 5)}>
                  +5
                </button>
                <button type="button" className={`${small} border-amber-400 bg-amber-800`} disabled={have < 1} onClick={() => act(g, -1)}>
                  −1
                </button>
                <button type="button" className={`${small} border-amber-400 bg-amber-800`} disabled={have < 1} onClick={() => act(g, -have)} title="Vender tudo o que o bando leva">
                  tudo
                </button>
              </span>
            </div>
          );
        })}
      </div>
      <p className="text-[10px] text-neutral-500">
        Cor do preço: azul = barato, vermelho = caro (em relação ao preço base); a linha mostra os últimos {MARKET.HISTORY} registros, tracejado = preço base.
      </p>
      {msg && <p className="text-xs text-amber-300">{msg}</p>}
    </section>
  );
}

/** Entrega de um contrato (mercadoria em falta ou carga recuperada) no povoado do cliente. */
export function ContractDelivery({ t }: { t: Settlement }) {
  const active = useGameStore((s) => s.activeContract);
  const freight = useGameStore((s) => s.freight);
  const deliver = useGameStore((s) => s.deliverContract);
  const [msg, setMsg] = useState<string | null>(null);
  const c = active?.contract;
  if (!active || !c || !c.good || !c.qty || (c.targetId ?? c.clientId) !== t.id || (c.kind !== "DELIVERY" && c.kind !== "RECOVER")) return null;
  const have = freightOf(freight, c.good);
  const ready = have >= c.qty && (c.kind === "DELIVERY" || active.recovered);
  return (
    <section className="flex flex-col gap-2 rounded border border-amber-700/70 bg-amber-950/30 p-3">
      <h3 className={sectionTitle}>Contrato: {c.title}</h3>
      <p className="text-xs text-neutral-300">
        Pede {c.qty} de {GOODS[c.good].label.toLowerCase()} — o bando leva {have}. Recompensa: {c.reward} de ouro.
        {c.kind === "RECOVER" && !active.recovered && " A carga ainda está com o bando que a roubou."}
      </p>
      <button
        type="button"
        disabled={!ready}
        onClick={() => setMsg(deliver())}
        className="rounded border border-amber-400 bg-amber-700 px-3 py-1 text-sm font-semibold hover:bg-amber-600 disabled:opacity-40"
      >
        Entregar a carga
      </button>
      {msg && <p className="text-xs text-amber-300">{msg}</p>}
    </section>
  );
}
