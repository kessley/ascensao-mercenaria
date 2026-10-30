import { useState } from "react";
import { useGameStore } from "../../../store/useGameStore";
import { courtName, nobleWhere, traitLine } from "../../../game/data/courtTalk";
import { PLAN_LABEL } from "../../../game/sim/kingdoms";
import { STANDING_LABEL, standingIn } from "../../../game/sim/reputation";
import { COURT } from "../../../utils/constants";
import { ReputationBar } from "./ReputationBar";

const sectionTitle = "text-sm font-bold uppercase tracking-wider text-neutral-400";
const hex = (c: number) => `#${c.toString(16).padStart(6, "0")}`;
const RANK_ORDER = { RULER: 0, CONSORT: 1, HEIR: 2, CHILD: 3, COURTIER: 4, LORD: 5, KIN: 6 } as const;

function opinionTone(v: number): string {
  if (v >= 30) return "text-green-400";
  if (v <= -20) return "text-red-400";
  return "text-neutral-300";
}

/** Favores em aberto: o que pediram, de quem é e a carta que dá para abrir. */
function Quests() {
  const quests = useGameStore((s) => s.quests);
  const nobles = useGameStore((s) => s.nobles);
  const day = useGameStore((s) => s.day);
  const readLetter = useGameStore((s) => s.readLetter);
  const [opened, setOpened] = useState<string | null>(null);
  if (quests.length === 0) return <p className="text-xs text-neutral-500">Nenhum favor em aberto. Fale com os nobres que gostam do Comandante.</p>;
  return (
    <>
      {quests.map((q) => {
        const giver = nobles.find((n) => n.id === q.giverId);
        return (
          <div key={q.id} className="rounded border border-amber-700/60 bg-amber-950/30 p-2 text-xs">
            <div className="font-semibold text-amber-200">{q.title}</div>
            <div className="text-neutral-300">
              Para {giver?.name ?? "?"} · {q.rewardGold} de ouro · até o dia {q.deadline}
              {day > q.deadline ? " (atrasado)" : ""}
              {q.ready ? " · pronto: volte a quem pediu" : ""}
            </div>
            {q.kind === "LETTER" && !q.read && !q.ready && (
              <button type="button" onClick={() => setOpened(readLetter(q.id))} className="mt-1 rounded border border-neutral-600 px-2 py-0.5 hover:border-amber-300">
                Abrir a carta (honra −2)
              </button>
            )}
          </div>
        );
      })}
      {opened && <p className="rounded bg-neutral-800 p-2 text-xs text-neutral-100">{opened}</p>}
    </>
  );
}

/**
 * Livro da Nobreza (Marco 15): quem manda em cada reino, o que o bando sabe de cada nobre, onde
 * ele costuma estar, o lugar do Comandante em cada corte e as conspirações descobertas.
 */
export function NobilityBook() {
  const state = useGameStore((s) => s);
  const world = state.world;
  const [open, setOpen] = useState<string | null>(state.city?.factionId ?? null);
  if (!world) return null;
  const known = state.factions.filter((f) => !f.fallen);
  const news = state.log.filter((l) => l.text.startsWith("Chegou") || l.text.startsWith("Ouvido")).slice(-6).reverse();
  return (
    <>
      <section className="flex flex-col gap-2">
        <h2 className={sectionTitle}>Nome do bando</h2>
        <ReputationBar />
        <p className="text-xs text-neutral-400">
          Fama abre os portões (Conhecido 15, Respeitado 35 com alguma relação); Honra sustenta o que a Fama abriu (abaixo de 20 ninguém recebe o Comandante); Temor faz guardas cederem, mas a gente odeia, e acima de 60 os reinos se unem.
        </p>
      </section>
      <section className="flex flex-col gap-1">
        <h2 className={sectionTitle}>Últimas notícias</h2>
        {news.length === 0 && <p className="text-xs text-neutral-500">Nada chegou ainda. As notícias andam na velocidade dos viajantes.</p>}
        {news.map((l) => (
          <p key={l.id} className="text-xs text-neutral-300">
            <span className="font-mono text-neutral-500">Dia {l.day} · </span>
            {l.text}
          </p>
        ))}
      </section>
      <section className="flex flex-col gap-2">
        <h2 className={sectionTitle}>Favores</h2>
        <Quests />
      </section>
      {state.summons && (
        <p className="rounded border border-red-700 bg-red-950/40 p-2 text-xs text-red-200">
          Convocação: o suserano chama o bando a {state.settlements.find((t) => t.id === state.summons?.townId)?.name} até o dia {state.summons.deadline}.
        </p>
      )}
      <section className="flex flex-col gap-2">
        <h2 className={sectionTitle}>Casas e cortes</h2>
        {known.map((f) => {
          const def = world.factions.find((x) => x.id === f.id);
          const nobles = state.nobles.filter((n) => n.alive && n.factionId === f.id).sort((a, b) => RANK_ORDER[a.rank] - RANK_ORDER[b.rank] || b.age - a.age);
          const st = standingIn(state, f.id);
          const plots = state.plots.filter((p) => p.factionId === f.id && p.known);
          const isOpen = open === f.id;
          return (
            <div key={f.id} className="rounded border border-neutral-700 bg-neutral-800 text-sm">
              <button type="button" onClick={() => setOpen(isOpen ? null : f.id)} className="flex w-full items-center justify-between gap-2 p-2 text-left hover:bg-neutral-700">
                <span className="font-semibold">
                  <span className="mr-1 inline-block h-3 w-3 rounded-sm align-middle" style={{ background: hex(def?.color ?? 0xffffff) }} />
                  {def?.name}
                </span>
                <span className="text-xs text-amber-200">{STANDING_LABEL[st]}</span>
              </button>
              {isOpen && (
                <div className="flex flex-col gap-1 border-t border-neutral-700 p-2 text-xs">
                  <div className="text-neutral-400">
                    {f.plan ? `Dizem que o reino está em ${PLAN_LABEL[f.plan.kind]}.` : "Ninguém sabe o que o reino planeja."} Cansaço de guerra {Math.round(f.weariness ?? 0)}/100.
                  </div>
                  {plots.map((p) => (
                    <div key={p.id} className="rounded bg-red-950/40 p-1 text-red-200">
                      Conspiração: {state.nobles.find((n) => n.id === p.leaderId)?.name} e mais {p.members.length}. {p.joined ? "O Comandante está nela." : "A coroa não sabe."}
                    </div>
                  ))}
                  {nobles.map((n) => (
                    <div key={n.id} className="flex flex-col rounded bg-neutral-900/60 px-2 py-1">
                      <div className="flex justify-between gap-2">
                        <span className="font-semibold">{n.met ? courtName(state, n) : `${courtName(state, n)} (ainda não conhece)`}</span>
                        {n.met && <span className={opinionTone(n.opinion)}>opinião {n.opinion}</span>}
                      </div>
                      <div className="text-neutral-400">
                        {n.age} anos · {n.met ? `${traitLine(n)} · ${nobleWhere(n, state)}` : "traços e paradeiro desconhecidos"}
                      </div>
                      {n.met && n.memory.length > 0 && <div className="text-neutral-500">Lembra: {n.memory[n.memory.length - 1].text} (dia {n.memory[n.memory.length - 1].day})</div>}
                    </div>
                  ))}
                  {nobles.length === 0 && <p className="text-neutral-500">Ninguém da corte sobreviveu.</p>}
                </div>
              )}
            </div>
          );
        })}
      </section>
      <p className="text-xs text-neutral-500">Sagrar cavaleiro: Fama {COURT.KNIGHT.FAME}, relação {COURT.KNIGHT.RELATION}, Honra {COURT.KNIGHT.HONOR} e {COURT.KNIGHT.GOLD} de ouro, diante de quem governa.</p>
    </>
  );
}
