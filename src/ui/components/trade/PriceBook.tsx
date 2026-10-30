import { useMemo, useState } from "react";
import { useGameStore } from "../../../store/useGameStore";
import { NOTE_SOURCE_LABEL, latestNote, type PriceNote } from "../../../game/sim/trade";
import { GOODS, GOOD_LIST, type Good } from "../../../utils/constants";
import { Sparkline, VIZ, priceTint } from "./Sparkline";

const sectionTitle = "text-sm font-bold uppercase tracking-wider text-neutral-400";

const age = (day: number, note: PriceNote) => {
  const d = day - note.day;
  return d <= 0 ? "hoje" : d === 1 ? "ontem" : `há ${d} dias`;
};

/**
 * Livro de Preços (Marco 14): o que o bando sabe de cada mercado e de quando é a notícia.
 * A tabela pinta cada preço de azul (barato) a vermelho (caro) em relação ao preço base; ao
 * escolher um mercado, as linhas mostram como os preços andaram nas anotações. Em cima, os
 * melhores negócios que o livro sugere — lembrando que a informação pode estar velha.
 */
export function PriceBook() {
  const book = useGameStore((s) => s.priceBook);
  const settlements = useGameStore((s) => s.settlements);
  const day = useGameStore((s) => s.day);
  const posts = useGameStore((s) => s.posts);
  const [selected, setSelected] = useState<string | null>(null);
  const known = useMemo(
    () =>
      Object.keys(book)
        .map((id) => ({ id, name: settlements.find((t) => t.id === id)?.name ?? "?", note: latestNote(book, id) }))
        .filter((x): x is { id: string; name: string; note: PriceNote } => x.note !== null)
        .sort((a, b) => b.note.day - a.note.day),
    [book, settlements],
  );

  // Melhores negócios entre os mercados conhecidos (compra num, venda no outro)
  const deals = useMemo(() => {
    const out: { g: Good; from: string; to: string; buy: number; sell: number; old: number }[] = [];
    for (const g of GOOD_LIST) {
      let lo: (typeof known)[number] | null = null;
      let hi: (typeof known)[number] | null = null;
      for (const k of known) {
        if (k.note.stock[g] >= 3 && (!lo || k.note.prices[g] < lo.note.prices[g])) lo = k;
        if (!hi || k.note.prices[g] > hi.note.prices[g]) hi = k;
      }
      if (!lo || !hi || lo === hi) continue;
      const gain = hi.note.prices[g] * 0.92 - lo.note.prices[g] * 1.08;
      if (gain >= GOODS[g].base * 0.4) out.push({ g, from: lo.name, to: hi.name, buy: lo.note.prices[g], sell: hi.note.prices[g], old: Math.max(day - lo.note.day, day - hi.note.day) });
    }
    return out.sort((a, b) => (b.sell - b.buy) / GOODS[b.g].weight - (a.sell - a.buy) / GOODS[a.g].weight).slice(0, 4);
  }, [known, day]);

  if (known.length === 0) return <p className="text-sm text-neutral-400">O livro está em branco: visite mercados, pague rodadas nas tavernas ou abra feitorias.</p>;
  const sel = selected ? known.find((k) => k.id === selected) : null;

  return (
    <>
      <section className="flex flex-col gap-1">
        <h3 className={sectionTitle}>Negócios que o livro sugere</h3>
        {deals.length === 0 && <p className="text-xs text-neutral-500">Nenhuma diferença grande entre os mercados conhecidos.</p>}
        {deals.map((d) => (
          <p key={d.g} className="text-xs text-neutral-300">
            {GOODS[d.g].icon} <b>{GOODS[d.g].label}</b>: comprar em {d.from} (~{Math.round(d.buy)}) e vender em {d.to} (~{Math.round(d.sell)})
            <span className={d.old >= 5 ? "text-amber-400" : "text-neutral-500"}> · notícia de até {d.old} dia(s)</span>
          </p>
        ))}
      </section>

      <section className="flex flex-col gap-1">
        <h3 className={sectionTitle}>Preços conhecidos</h3>
        <div className="overflow-x-auto">
          <table className="w-full border-separate border-spacing-[2px] text-[11px]">
            <thead>
              <tr>
                <th className="text-left font-normal text-neutral-500">Mercado</th>
                {GOOD_LIST.map((g) => (
                  <th key={g} className="font-normal" title={`${GOODS[g].label} (base ${GOODS[g].base})`}>
                    {GOODS[g].icon}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {known.map((k) => (
                <tr key={k.id} onClick={() => setSelected(k.id === selected ? null : k.id)} className={`cursor-pointer ${k.id === selected ? "outline outline-1 outline-amber-400" : ""}`}>
                  <td className="whitespace-nowrap pr-1 text-neutral-200" title={NOTE_SOURCE_LABEL[k.note.source]}>
                    {k.name}
                    {posts.includes(k.id) && <span className="text-violet-300"> ✦</span>}
                    <span className={`ml-1 ${day - k.note.day >= 6 ? "text-amber-400" : "text-neutral-500"}`}>{age(day, k.note)}</span>
                  </td>
                  {GOOD_LIST.map((g) => (
                    <td
                      key={g}
                      className="rounded px-0.5 text-center font-mono text-neutral-100"
                      style={{ background: priceTint(k.note.prices[g] / GOODS[g].base) }}
                      title={`${GOODS[g].label} em ${k.name}: ${k.note.prices[g]} (base ${GOODS[g].base}) · estoque ~${k.note.stock[g]} · ${age(day, k.note)}`}
                    >
                      {Math.round(k.note.prices[g])}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="flex items-center gap-2 text-[10px] text-neutral-500">
          <span className="inline-block h-2 w-6 rounded" style={{ background: priceTint(0.4) }} /> barato
          <span className="inline-block h-2 w-6 rounded" style={{ background: VIZ.neutral }} /> preço base
          <span className="inline-block h-2 w-6 rounded" style={{ background: priceTint(2.5) }} /> caro · ✦ feitoria do bando · clique num mercado para ver o histórico
        </p>
      </section>

      {sel && (
        <section className="flex flex-col gap-1">
          <h3 className={sectionTitle}>
            {sel.name}: as anotações ({book[sel.id].length})
          </h3>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
            {GOOD_LIST.map((g) => {
              const values = book[sel.id].map((n) => n.prices[g]);
              return (
                <div key={g} className="flex items-center justify-between gap-2">
                  <span className="truncate text-neutral-300">
                    {GOODS[g].icon} {GOODS[g].label}
                  </span>
                  <span className="flex items-center gap-1">
                    <Sparkline values={values} base={GOODS[g].base} label={`${GOODS[g].label} em ${sel.name}`} />
                    <span className="w-8 text-right font-mono text-neutral-100">{Math.round(values[values.length - 1])}</span>
                  </span>
                </div>
              );
            })}
          </div>
          <p className="text-[10px] text-neutral-500">
            De {age(day, book[sel.id][0])} até {age(day, sel.note)} · última notícia: {NOTE_SOURCE_LABEL[sel.note.source]}.
          </p>
        </section>
      )}
    </>
  );
}
