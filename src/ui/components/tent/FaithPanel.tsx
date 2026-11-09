import { useGameStore } from "../../../store/useGameStore";
import { readyOf } from "../../../game/data/campGrid";
import { FAITHS, FAITH_IDS, PRECEPTS, chaplainBonus, courtVoice, factionFaith, faithCalendar, faithMix, favorText, friction, keptToday, type FaithId } from "../../../game/sim/faith";
import { ofRealm } from "../../../game/worldgen/names";
import { FAITH } from "../../../utils/constants";

const sectionTitle = "text-sm font-bold uppercase tracking-wider text-neutral-400";

const when = (n: number | null) => (n === null ? "—" : n === 0 ? "hoje" : n === 1 ? "amanhã" : `em ${n} dias`);

/** Uma bolinha na cor da fé. */
function Dot({ faith }: { faith: FaithId }) {
  return <span aria-hidden className="inline-block h-2 w-2 rounded-full" style={{ background: FAITHS[faith].color }} />;
}

/**
 * As fés do bando (Marco 23, parte 2): de que fé é cada parte da tropa, o que cada uma guarda
 * hoje e nos próximos dias, as que brigam entre si, o capelão, os mortos por enterrar e o que
 * cada templo pensa do bando (o sacerdote fala na corte).
 */
export function FaithPanel() {
  const battalions = useGameStore((s) => s.battalions);
  const day = useGameStore((s) => s.day);
  const followers = useGameStore((s) => s.followers);
  const favor = useGameStore((s) => s.faithFavor);
  const unburied = useGameStore((s) => s.unburied);
  const broken = useGameStore((s) => s.fastBroken);
  const plan = useGameStore((s) => s.campPlan);
  const factions = useGameStore((s) => s.factions);
  const extra = useGameStore((s) => s.extraFactions);
  const world = useGameStore((s) => s.world);
  const breakFast = useGameStore((s) => s.breakFast);
  const buryDead = useGameStore((s) => s.buryDead);

  const mix = faithMix(battalions);
  const present = FAITH_IDS.filter((f) => mix[f] > 0).sort((a, b) => mix[b] - mix[a]);
  const today = keptToday(day, broken);
  const worship = { altar: readyOf(plan, "ALTAR").length > 0, temple: readyOf(plan, "TEMPLE").length > 0 };
  const quarrel = friction(mix, worship);
  const chaplain = followers.find((f) => f.role === "CHAPLAIN");
  const chaplainFaith = chaplain ? (chaplain.faith ?? "FLAME") : null;
  const temples = FAITH_IDS.filter((f) => Math.abs(favor[f] ?? 0) >= 1);
  const courts = world ? factions.filter((f) => !f.fallen) : [];

  return (
    <section className="flex flex-col gap-2" data-faith-panel>
      <h2 className={sectionTitle}>Fés do bando</h2>
      {present.length === 0 ? (
        <p className="text-xs text-neutral-500">Sem soldados, sem fé.</p>
      ) : (
        <ul className="flex flex-col gap-1 text-xs" data-faith-mix>
          {present.map((f) => {
            const def = FAITHS[f];
            const cal = faithCalendar(f, day);
            return (
              <li key={f} data-faith={f} className="flex flex-col gap-0.5 rounded bg-neutral-800 px-3 py-1.5">
                <span className="flex items-center gap-2">
                  <Dot faith={f} />
                  <b>{def.label}</b>
                  <span className="text-neutral-400">{Math.round(mix[f] * 100)}% do bando · {def.clergy}</span>
                </span>
                <span className="text-neutral-400">Preceitos: {def.precepts.map((p) => PRECEPTS[p] + (p === "NO_MAGIC" ? " (quando houver magia)" : "")).join("; ")}.</span>
                <span className="text-neutral-400">
                  {cal.holy !== null && <>Dia santo {when(cal.holy)} · </>}
                  {def.fast && cal.fast !== null && <>{def.fast.label} {when(cal.fast)} · </>}
                  {def.feast.label} {when(cal.feast)}
                </span>
                {today.holy.has(f) && <span className="text-amber-300">Hoje é dia santo {def.of}: quem lutar hoje luta de má vontade, e o templo não esquece.</span>}
                {today.fasting.has(f) && (
                  <span className="flex items-center justify-between gap-2 text-sky-200">
                    <span>{def.fast?.label}: os fiéis comem a metade e batem com menos força.</span>
                    <button type="button" data-break-fast={f} onClick={() => breakFast(f)} className="shrink-0 rounded border border-neutral-600 px-2 py-0.5 text-neutral-200 hover:border-red-400">
                      Quebrar o jejum
                    </button>
                  </span>
                )}
                {today.feast.has(f) && <span className="text-emerald-300">Hoje é a {def.feast.label}: os fiéis comem um dia a mais de rações, e o acampamento canta.</span>}
              </li>
            );
          })}
        </ul>
      )}
      {quarrel.pairs.length > 0 && (
        <p className="text-xs text-rose-300" data-friction>
          Fés que brigam no bando: {quarrel.pairs.map(([a, b]) => `${FAITHS[a].label} e ${FAITHS[b].label}`).join("; ")}.{" "}
          {quarrel.mood < 0 ? `O humor do acampamento tende a ${quarrel.mood}.` : "O templo do acampamento acalma a briga."}
          {!worship.temple && <span className="text-neutral-400"> {worship.altar ? "O altar já acalma metade; o templo acabaria com a briga." : "Um altar acalma metade; o templo, de pedra, acaba com a briga."}</span>}
        </p>
      )}
      {chaplainFaith && (
        <p className="text-xs text-neutral-300">
          Capelão {FAITHS[chaplainFaith].of} ({chaplain?.name}): +{chaplainBonus(chaplainFaith, chaplainFaith)} na moral dos fiéis dele, +{FAITH.CHAPLAIN_OTHER} na dos outros, nada na das fés rivais.
        </p>
      )}
      {unburied && (
        <div className="flex items-center justify-between gap-2 rounded bg-neutral-800 px-3 py-1.5 text-xs text-amber-200">
          <span>
            {unburied.dead} morto(s) esperam enterro desde o dia {unburied.day}. Os fiéis {unburied.faiths.map((f) => FAITHS[f].of).join(" e ")} não querem marchar antes.
          </span>
          <button type="button" data-bury onClick={() => buryDead()} className="shrink-0 rounded border border-neutral-600 px-2 py-0.5 text-neutral-200 hover:border-amber-400">
            Enterrar ({Math.round(FAITH.BURY_DAYS * 24)} h)
          </button>
        </div>
      )}
      {(temples.length > 0 || courts.length > 0) && (
        <div className="flex flex-col gap-0.5 text-xs text-neutral-400" data-temples>
          {temples.map((f) => (
            <span key={f} className="flex items-center gap-2">
              <Dot faith={f} /> Templos {FAITHS[f].of}: {(favor[f] ?? 0) > 0 ? "+" : ""}
              {Math.round(favor[f] ?? 0)} ({favorText(favor[f] ?? 0)})
            </span>
          ))}
          {world &&
            courts.map((c) => {
              const f = factionFaith(c, world.culture);
              const voice = courtVoice(favor, f);
              const name = world.factions.find((x) => x.id === c.id)?.name ?? extra.find((x) => x.id === c.id)?.name ?? "reino";
              return (
                <span key={c.id}>
                  Corte {ofRealm(name)}: fé {FAITHS[f].of}
                  {voice !== 0 ? ` · o sacerdote puxa a relação para ${voice > 0 ? "+" : ""}${Math.round(voice)}` : ""}
                </span>
              );
            })}
        </div>
      )}
    </section>
  );
}
