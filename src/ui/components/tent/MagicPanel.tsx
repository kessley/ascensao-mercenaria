import { useState } from "react";
import { useGameStore } from "../../../store/useGameStore";
import { spellDef, SPELL_IDS, waysToLearn } from "../../../game/sim/magic";
import { MAGIC } from "../../../utils/constants";
import { Button } from "../Button";

const sectionTitle = "text-sm font-bold uppercase tracking-wider text-neutral-400";

const WAY_LABEL = {
  RUINS: "grimório nas ruínas assombradas",
  COURT: "mago da corte de uma cidade tomada",
  MASTER: "mestre de outra terra",
} as const;

/**
 * A magia do Comandante na tenda (Marco 19, parte 3): o que ele sabe e o arcano, os grimórios
 * achados para estudar, os magos da corte presos que podem ser forçados a ensinar e onde se acha
 * o que falta.
 */
export function MagicPanel() {
  const spells = useGameStore((s) => s.spells);
  const arcane = useGameStore((s) => s.arcane);
  const grimoires = useGameStore((s) => s.grimoires);
  const officers = useGameStore((s) => s.captiveOfficers);
  const study = useGameStore((s) => s.studyGrimoire);
  const force = useGameStore((s) => s.learnFromCaptive);
  const [note, setNote] = useState<string | null>(null);
  const mages = officers.flatMap((o) => (o.mage ? [{ id: o.id, name: o.name, ransom: o.ransom, mage: o.mage }] : []));
  const missing = SPELL_IDS.filter((s) => !spells.includes(s));
  const L = MAGIC.LEARN;
  return (
    <section className="flex flex-col gap-2">
      <h3 className={sectionTitle}>Magia</h3>
      {spells.length === 0 ? (
        <p className="text-xs text-neutral-400">
          O Comandante não sabe magia. Ela se aprende pelo mundo: grimórios nas ruínas assombradas, magos da corte presos ao tomar uma cidade e mestres de outras
          terras, do outro lado do mar.
        </p>
      ) : (
        <p className="text-sm text-neutral-300">
          Sabe: <b className="text-violet-300">{spells.map((s) => spellDef(s).name).join(", ")}</b> · arcano {Math.floor(arcane)}/{MAGIC.ARCANE_MAX} (volta{" "}
          {MAGIC.ARCANE_PER_DAY} por dia)
        </p>
      )}
      {grimoires.map((g, i) => (
        <div key={`${g}-${i}`} className="flex items-center justify-between gap-2 text-sm">
          <span>
            Grimório: <b className="text-violet-300">{spellDef(g).name}</b>
          </span>
          <Button onClick={() => setNote(study(g) ?? `O Comandante aprendeu ${spellDef(g).name}.`)}>Estudar ({L.GRIMOIRE_DAYS} dias)</Button>
        </div>
      ))}
      {mages.map((m) => (
        <div key={m.id} className="flex items-center justify-between gap-2 text-sm">
          <span>
            Preso: {m.name}, que sabe <b className="text-violet-300">{spellDef(m.mage).name}</b>
          </span>
          <Button disabled={spells.includes(m.mage)} onClick={() => setNote(force(m.id) ?? `O Comandante aprendeu ${spellDef(m.mage).name}.`)}>
            Forçar a ensinar ({L.COURT_DAYS} dias, perde o resgate de {m.ransom})
          </Button>
        </div>
      ))}
      {spells.length > 0 && missing.length > 0 && (
        <ul className="text-xs text-neutral-500">
          {missing.map((s) => (
            <li key={s}>
              {spellDef(s).name}: {waysToLearn(s).map((w) => WAY_LABEL[w]).join(" ou ")}
            </li>
          ))}
        </ul>
      )}
      {note && <p className="text-xs text-amber-300">{note}</p>}
    </section>
  );
}
