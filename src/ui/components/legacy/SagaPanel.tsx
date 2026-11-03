import { useState } from "react";
import { fullName } from "../../../game/data/lieutenants";
import { captainName } from "../../../game/data/captains";
import { AMBITIONS, AMBITION_IDS, AMBITION_SLOTS } from "../../../game/sim/ambitions";
import { LEADER_TRAITS, fallDeathChance, leaderAge } from "../../../game/sim/legacy";
import { useGameStore } from "../../../store/useGameStore";
import { TRAITS } from "../../../game/data/lieutenants";
import { Button } from "../Button";

const sectionTitle = "text-sm font-bold uppercase tracking-wider text-neutral-400";

/** Livro do Bando: quem manda, quem herda, o que o bando quer e quem veio antes. */
export function SagaPanel() {
  const leader = useGameStore((s) => s.leader);
  const day = useGameStore((s) => s.day);
  const former = useGameStore((s) => s.formerLeaders);
  const lieutenants = useGameStore((s) => s.lieutenants);
  const captains = useGameStore((s) => s.captains);
  const heirId = useGameStore((s) => s.heirId);
  const ambitions = useGameStore((s) => s.ambitions);
  const done = useGameStore((s) => s.ambitionsDone);
  const setHeir = useGameStore((s) => s.setHeir);
  const pickAmbition = useGameStore((s) => s.pickAmbition);
  const dropAmbition = useGameStore((s) => s.dropAmbition);
  const view = useGameStore((s) => s.ambitionView)();
  const openLegends = useGameStore((s) => s.setLegendsOpen);
  const endSaga = useGameStore((s) => s.endSaga);
  const [confirm, setConfirm] = useState(false);
  const age = leaderAge(leader, day);

  return (
    <>
      <section className="flex flex-col gap-1 rounded bg-neutral-800 p-3 text-sm">
        <h3 className="font-serif text-xl text-amber-100">{leader.name}</h3>
        <p className="text-neutral-300">
          {leader.generation}º Comandante · {age} anos · {leader.wounds} cicatriz(es) · {leader.origin}
        </p>
        <p className="text-xs text-neutral-400">Chance de não se levantar se cair em combate: {Math.round(fallDeathChance(age, leader.wounds) * 100)}%.</p>
        {leader.traits.map((t) => (
          <p key={t} className="text-xs text-amber-200">
            {TRAITS[t].label}: {LEADER_TRAITS[t].text}.
          </p>
        ))}
      </section>

      <section className="flex flex-col gap-2">
        <h3 className={sectionTitle}>Testamento</h3>
        {lieutenants.length + captains.length === 0 ? (
          <p className="text-xs text-neutral-400">Sem capitães nem tenentes: se o Comandante cair, a tropa escolhe um veterano.</p>
        ) : (
          <ul className="flex flex-col gap-1 text-sm">
            {[...captains.map((c) => ({ id: c.id, name: `Capitão ${captainName(c)}`, loyalty: c.loyalty })), ...lieutenants.map((l) => ({ id: l.id, name: fullName(l), loyalty: l.loyalty }))].map((l) => (
              <li key={l.id} className="flex items-center justify-between gap-2 rounded bg-neutral-800 px-2 py-1">
                <span>
                  {l.name} <span className="text-xs text-neutral-400">· lealdade {Math.round(l.loyalty)}</span>
                </span>
                <button type="button" onClick={() => setHeir(l.id === heirId ? null : l.id)} className={`rounded border px-2 py-0.5 text-xs ${l.id === heirId ? "border-amber-400 text-amber-200" : "border-neutral-600 text-neutral-200"}`}>
                  {l.id === heirId ? "Herdeiro" : "Nomear"}
                </button>
              </li>
            ))}
          </ul>
        )}
        <p className="text-xs text-neutral-400">Sem testamento, herda o capitão ou tenente mais leal.</p>
      </section>

      <section className="flex flex-col gap-2">
        <h3 className={sectionTitle}>
          Ambições <span className="font-normal normal-case">(até {AMBITION_SLOTS} de cada vez)</span>
        </h3>
        <ul className="flex flex-col gap-1 text-sm">
          {AMBITION_IDS.map((id) => {
            const a = AMBITIONS[id];
            const active = ambitions.includes(id);
            const finished = done.includes(id);
            const p = a.progress(view);
            return (
              <li key={id} className="flex flex-col gap-1 rounded bg-neutral-800 px-2 py-1">
                <div className="flex items-center justify-between gap-2">
                  <span className={finished ? "text-emerald-300" : ""}>
                    {a.label}
                    {finished && " ✓"}
                  </span>
                  {!finished && (
                    <button type="button" disabled={!active && ambitions.length >= AMBITION_SLOTS} onClick={() => (active ? dropAmbition(id) : pickAmbition(id))} className={`rounded border px-2 py-0.5 text-xs disabled:opacity-40 ${active ? "border-amber-400 text-amber-200" : "border-neutral-600 text-neutral-200"}`}>
                      {active ? "Desistir" : "Jurar"}
                    </button>
                  )}
                </div>
                <p className="text-xs text-neutral-400">
                  {a.description} Prêmio: {a.reward.gold} de ouro e {a.reward.fame} de Fama.
                </p>
                {active && <p className="text-xs text-sky-200">{p.text}</p>}
              </li>
            );
          })}
        </ul>
      </section>

      {former.length > 0 && (
        <section className="flex flex-col gap-1 text-sm">
          <h3 className={sectionTitle}>Quem veio antes</h3>
          {former.map((f) => (
            <p key={f.generation} className="text-neutral-300">
              {f.generation}º · {f.name} morreu aos {f.age} anos: {f.cause}.
            </p>
          ))}
        </section>
      )}

      <section className="flex flex-col gap-2">
        <Button variant="gold" onClick={() => openLegends(true)}>
          Abrir as Lendas
        </Button>
        {confirm ? (
          <Button variant="danger" onClick={() => endSaga("Deitaram as armas por vontade própria.")}>
            Encerrar a saga de vez
          </Button>
        ) : (
          <Button variant="quiet" onClick={() => setConfirm(true)}>
            Encerrar a saga
          </Button>
        )}
      </section>
    </>
  );
}
