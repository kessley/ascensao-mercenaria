import { useGameStore } from "../../store/useGameStore";
import { TROOPS } from "../../utils/constants";

const sectionTitle = "text-sm font-bold uppercase tracking-wider text-neutral-400";
const LOADS = [
  { share: 1, label: "Cheias de comida" },
  { share: 0.5, label: "Metade" },
  { share: 0.25, label: "Um quarto (mais espaço para carga)" },
];

/**
 * Portão do acampamento (Marco 14): quem sai com o Comandante e quem fica de guarda. Quem
 * fica come do depósito, descansa e defende o acampamento; para chamá-lo depois, basta dar
 * uma ordem ao batalhão (o mensageiro leva).
 */
export function DeparturePanel() {
  const battalions = useGameStore((s) => s.battalions);
  const stay = useGameStore((s) => s.campStay);
  const training = useGameStore((s) => s.training);
  const wagons = useGameStore((s) => s.wagons.length);
  const setCampStay = useGameStore((s) => s.setCampStay);
  const setCampPanel = useGameStore((s) => s.setCampPanel);
  const load = useGameStore((s) => s.rationLoad ?? 1);
  const setRationLoad = useGameStore((s) => s.setRationLoad);
  const busy = new Set(training.map((t) => t.battalionId));
  const toggle = (id: string) => setCampStay(stay.includes(id) ? stay.filter((x) => x !== id) : [...stay, id]);
  const going = battalions.filter((b) => !stay.includes(b.id) && !busy.has(b.id));

  return (
    <section className="flex flex-col gap-3">
      <h3 className={sectionTitle}>Quem sai com o Comandante</h3>
      <p className="text-xs text-neutral-400">
        Quem fica guarda o acampamento (bandos não saqueiam um acampamento defendido), come do depósito e descansa. Para chamá-lo depois, dê uma ordem ao batalhão pelo HUD — um
        mensageiro leva.
      </p>
      <div className="flex flex-col gap-1">
        {battalions.map((b) => {
          const out = !stay.includes(b.id);
          return (
            <label key={b.id} className={`flex items-center justify-between gap-2 rounded px-3 py-1.5 text-sm ${busy.has(b.id) ? "bg-neutral-800/50 text-neutral-500" : "bg-neutral-800"}`}>
              <span>
                <b>{b.name}</b> <span className="text-xs text-neutral-400">{TROOPS[b.troopType].label} · {b.soldiers} soldados</span>
              </span>
              {busy.has(b.id) ? (
                <span className="text-xs">no Campo de Treino</span>
              ) : (
                <span className="flex items-center gap-2 text-xs">
                  <span className={out ? "text-green-400" : "text-amber-300"}>{out ? "vai" : "fica de guarda"}</span>
                  <input type="checkbox" checked={out} onChange={() => toggle(b.id)} />
                </span>
              )}
            </label>
          );
        })}
      </div>
      <p className="text-xs text-neutral-400">
        {going.length === 0
          ? `O Comandante sai sozinho, só com a mochila. As ${wagons} carroças ficam no acampamento.`
          : `Saem ${going.length} batalhão(ões) com as ${wagons} carroças.`}
      </p>
      <div className="flex flex-col gap-1">
        <h3 className={sectionTitle}>Comida nas carroças</h3>
        <p className="text-xs text-neutral-400">Carroças cheias de comida vão mais longe; com espaço livre, dá para comprar mercadoria no caminho.</p>
        <div className="flex gap-2 text-xs">
          {LOADS.map((l) => (
            <button
              key={l.share}
              type="button"
              onClick={() => setRationLoad(l.share)}
              className={`rounded border px-2 py-1 ${load === l.share ? "border-amber-400 bg-amber-700/60" : "border-neutral-600 hover:border-amber-400"}`}
            >
              {l.label}
            </button>
          ))}
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => setCampStay([])} className="rounded border border-blue-400 bg-blue-700 px-3 py-1 text-sm font-semibold hover:bg-blue-600">
          Todos vão
        </button>
        <button type="button" onClick={() => setCampStay(battalions.map((b) => b.id))} className="rounded border border-amber-400 bg-amber-800 px-3 py-1 text-sm font-semibold hover:bg-amber-700">
          Sair sozinho
        </button>
        <button type="button" onClick={() => setCampPanel(null)} className="rounded border border-neutral-500 bg-neutral-700 px-3 py-1 text-sm">
          Pronto
        </button>
      </div>
    </section>
  );
}
