import { useState } from "react";
import { useGameStore } from "../../../store/useGameStore";
import { GUILD_BUILDINGS, canHost, stakeDividend } from "../../../game/sim/trade";
import { roadGraphOf } from "../../../game/sim/roadGraph";
import { BUILDINGS, TRADE } from "../../../utils/constants";
import { Button } from "../Button";

const sectionTitle = "text-sm font-bold uppercase tracking-wider text-neutral-400";

/**
 * Casa dos Mercadores (Marco 14): feitoria do bando, participação nas oficinas da guilda
 * (dividendos semanais), câmbio e empréstimos (nas cidades) e caravanas próprias.
 */
export function GuildPanel({ settlementId }: { settlementId: string }) {
  const t = useGameStore((s) => s.settlements.find((x) => x.id === settlementId));
  const settlements = useGameStore((s) => s.settlements);
  const world = useGameStore((s) => s.world);
  const gold = useGameStore((s) => s.gold);
  const posts = useGameStore((s) => s.posts);
  const stakes = useGameStore((s) => s.stakes);
  const loans = useGameStore((s) => s.loans);
  const own = useGameStore((s) => s.ownCaravans);
  const day = useGameStore((s) => s.day);
  const buyPost = useGameStore((s) => s.buyPost);
  const investGuild = useGameStore((s) => s.investGuild);
  const takeLoan = useGameStore((s) => s.takeLoan);
  const repayLoan = useGameStore((s) => s.repayLoan);
  const hire = useGameStore((s) => s.hireOwnCaravan);
  const dismiss = useGameStore((s) => s.dismissOwnCaravan);
  const [dest, setDest] = useState<string>("");
  if (!t || !world) return <p className="text-sm text-neutral-400">Este povoado não existe mais.</p>;
  const name = (id: string) => settlements.find((x) => x.id === id)?.name ?? "?";
  const reach = roadGraphOf(world)
    .reachable(t.id, 4)
    .filter((r) => settlements.some((x) => x.id === r.id && x.owner !== "RUINED"));
  const options = GUILD_BUILDINGS.filter((b) => !t.buildings.includes(b) && canHost(t, b));
  const here = stakes.filter((s) => s.settlementId === t.id);
  const loanHere = loans.find((l) => l.from === t.id);
  const alive = own.filter((c) => !c.lost);

  return (
    <>
      <section className="flex flex-col gap-2">
        <h3 className={sectionTitle}>Feitoria</h3>
        {posts.includes(t.id) ? (
          <p className="text-xs text-violet-300">
            O bando tem feitoria aqui: os preços de {t.name} chegam todo dia ao Livro de Preços e os negócios têm margem melhor ({TRADE.POST_UPKEEP} de ouro por semana).
          </p>
        ) : (
          <>
            <p className="text-xs text-neutral-400">Um agente do bando morando aqui: preços frescos todo dia no Livro, margem melhor no mercado. Manutenção de {TRADE.POST_UPKEEP} por semana.</p>
            <Button disabled={gold < TRADE.POST_COST || t.owner === "PLAYER"} onClick={() => buyPost(t.id)}>
              Abrir feitoria ({TRADE.POST_COST} ouro)
            </Button>
          </>
        )}
      </section>

      {t.owner !== "PLAYER" && (
        <section className="flex flex-col gap-2">
          <h3 className={sectionTitle}>Investir nas oficinas</h3>
          <p className="text-xs text-neutral-400">
            O bando paga a obra ({TRADE.GUILD_COST} de ouro) e fica com {Math.round(TRADE.GUILD_SHARE * 100)}% do lucro dela, toda semana. Se o povoado virar inimigo ou cair, a parte se perde.
          </p>
          {here.map((s) => (
            <p key={s.building} className="text-xs text-green-300">
              {BUILDINGS[s.building].label}: o bando é sócio desde o dia {s.since} · rende ~{stakeDividend(t, s)}/semana (já pagou {s.paid}).
            </p>
          ))}
          {options.length === 0 && <p className="text-xs text-neutral-500">Nada a construir aqui.</p>}
          {options.map((b) => {
            const est = stakeDividend({ ...t, buildings: [...t.buildings, b] }, { settlementId: t.id, building: b, invested: 0, since: day, paid: 0 });
            return (
              <div key={b} className="flex items-center justify-between gap-2 rounded bg-neutral-800 px-3 py-1.5 text-xs">
                <span>
                  <b>{BUILDINGS[b].label}</b> <span className="text-neutral-400">— {BUILDINGS[b].effect} · rende ~{est}/semana aos preços de hoje</span>
                </span>
                <button
                  type="button"
                  disabled={gold < TRADE.GUILD_COST}
                  onClick={() => investGuild(t.id, b)}
                  className="whitespace-nowrap rounded border border-blue-400 bg-blue-600 px-2 py-1 font-semibold hover:bg-blue-500 disabled:opacity-40"
                >
                  Investir
                </button>
              </div>
            );
          })}
        </section>
      )}

      <section className="flex flex-col gap-2">
        <h3 className={sectionTitle}>Câmbio e empréstimos</h3>
        {t.kind === "VILLAGE" ? (
          <p className="text-xs text-neutral-500">Aldeia não tem casa de câmbio: empréstimos só nas cidades e fortalezas.</p>
        ) : loanHere ? (
          <div className="flex items-center justify-between gap-2 text-xs">
            <span className={loanHere.missed > 0 ? "text-red-400" : "text-neutral-300"}>
              Dívida: {loanHere.principal} de ouro · juros de {loanHere.interest}/semana · vence no dia {loanHere.dueDay}
              {loanHere.missed > 0 && ` · ${loanHere.missed} semana(s) sem pagar juros`}
            </span>
            <button type="button" disabled={gold < loanHere.principal} onClick={() => repayLoan(loanHere.id)} className="rounded border border-amber-400 bg-amber-700 px-2 py-1 font-semibold disabled:opacity-40">
              Quitar
            </button>
          </div>
        ) : (
          <>
            <p className="text-xs text-neutral-400">
              {Math.round(TRADE.LOAN_INTEREST * 100)}% de juros por semana, prazo de {TRADE.LOAN_WEEKS} semanas. Calote: honra e relação com o reino despencam.
            </p>
            <div className="flex gap-2">
              {TRADE.LOAN_SIZES.map((a) => (
                <Button key={a} onClick={() => takeLoan(t.id, a)}>
                  Pegar {a}
                </Button>
              ))}
            </div>
          </>
        )}
      </section>

      <section className="flex flex-col gap-2">
        <h3 className={sectionTitle}>Caravanas do bando</h3>
        <p className="text-xs text-neutral-400">
          Carroça, caravaneiro e guardas por {TRADE.OWN_CARAVAN_COST} de ouro ({TRADE.OWN_CARAVAN_WAGE}/semana). Vai e volta entre dois mercados levando o bem que mais der lucro (o bando paga a compra). Goblins adoram caravanas.
        </p>
        {alive.map((c) => (
          <div key={c.id} className="flex items-center justify-between gap-2 rounded bg-neutral-800 px-3 py-1.5 text-xs">
            <span>
              <b>{c.name}</b>: {name(c.a)} ↔ {name(c.b)} · {c.trips} viagem(ns) · <span className={c.profit >= 0 ? "text-green-400" : "text-red-400"}>lucro {c.profit}</span>
            </span>
            <button type="button" onClick={() => dismiss(c.id)} className="rounded border border-red-500 bg-red-800 px-2 py-0.5">
              Dispensar
            </button>
          </div>
        ))}
        {own.filter((c) => c.lost).map((c) => (
          <p key={c.id} className="text-xs text-red-400">
            {c.name} foi destruída no dia {c.lost}.
          </p>
        ))}
        {alive.length < TRADE.OWN_CARAVAN_MAX && (
          <div className="flex items-center gap-2 text-xs">
            <select value={dest} onChange={(e) => setDest(e.target.value)} className="flex-1 rounded border border-neutral-600 bg-neutral-800 px-2 py-1">
              <option value="">Rota de {t.name} até…</option>
              {reach.map((r) => (
                <option key={r.id} value={r.id}>
                  {name(r.id)} ({r.days.toFixed(1)} dia(s) de estrada)
                </option>
              ))}
            </select>
            <button
              type="button"
              disabled={!dest || gold < TRADE.OWN_CARAVAN_COST}
              onClick={() => hire(t.id, dest) && setDest("")}
              className="rounded border border-blue-400 bg-blue-600 px-2 py-1 font-semibold disabled:opacity-40"
            >
              Montar caravana
            </button>
          </div>
        )}
      </section>
    </>
  );
}
