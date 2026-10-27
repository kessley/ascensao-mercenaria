import { useShallow } from "zustand/react/shallow";
import { useGameStore, type BattleCommand } from "../../store/useGameStore";
import { ARRANGEMENTS, FORMATIONS, TROOPS, type Formation, type GroupArrangement } from "../../utils/constants";

type OrderType = "FOLLOW" | "HOLD" | "CHARGE" | "FOCUS";

const itemClass =
  "flex w-full justify-between gap-2 px-3 py-1.5 text-left hover:bg-neutral-700 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent";

const ALL_FORMATIONS: Formation[] = ["LINE", "SHIELD_WALL", "WEDGE", "LOOSE"];

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border-t border-neutral-700 py-1">
      <div className="px-3 pb-1 pt-1 text-xs font-bold uppercase tracking-wider text-neutral-500">{title}</div>
      {children}
    </div>
  );
}

/**
 * Menu do botão direito sobre batalhões aliados.
 * - Um batalhão: ordens e formações dele.
 * - Grupo (seleção múltipla): ordens em conjunto, formação para todos que a suportam
 *   e o arranjo do grupo (quem vai na frente, atrás, nos flancos).
 */
export function BattalionContextMenu() {
  const menu = useGameStore((s) => s.contextMenu);
  const battalions = useGameStore(
    useShallow((s) => (s.battleHud?.battalions ?? []).filter((b) => s.contextMenu?.battalionIds.includes(b.id))),
  );
  const arrangement = useGameStore((s) => s.groupArrangement);
  const setContextMenu = useGameStore((s) => s.setContextMenu);
  const sendBattleCommand = useGameStore((s) => s.sendBattleCommand);

  if (!menu || battalions.length === 0) return null;

  const ids = battalions.map((b) => b.id);
  const isGroup = battalions.length > 1;
  const panicked = battalions.filter((b) => b.status === "FLEEING").length;
  const allPanicking = panicked === battalions.length;

  const send = (command: BattleCommand) => {
    sendBattleCommand(command);
    setContextMenu(null);
  };

  const orders: { type: OrderType; label: string; hint: string }[] = [
    { type: "FOLLOW", label: "Seguir o Comandante", hint: "F" },
    { type: "HOLD", label: "Manter posição", hint: "" },
    { type: "CHARGE", label: "Investir", hint: isGroup ? "cada um no seu" : "mais próximo" },
    ...(isGroup ? [{ type: "FOCUS" as const, label: "Foco no alvo", hint: "todos no mesmo" }] : []),
  ];

  // Formações: no grupo, mostra quantos batalhões conseguem executar cada uma
  const formationRows = ALL_FORMATIONS.map((f) => {
    const able = battalions.filter((b) => TROOPS[b.troopType].formations.includes(f));
    return { f, able: able.length, current: able.length > 0 && able.every((b) => b.formation === f) };
  }).filter((row) => row.able > 0);

  // Mantém o menu dentro da janela (altura aproximada de cada variante)
  const height = isGroup ? 600 : 360;
  const left = Math.min(menu.x, window.innerWidth - 270);
  const top = Math.max(8, Math.min(menu.y, window.innerHeight - height));

  return (
    <div
      className="pointer-events-auto absolute z-20 max-h-[calc(100vh-16px)] w-64 overflow-y-auto rounded border border-neutral-600 bg-neutral-900/95 text-sm text-white shadow-lg"
      style={{ left, top }}
      onContextMenu={(e) => e.preventDefault()}
    >
      <div className="px-3 py-2">
        {isGroup ? (
          <>
            <div className="font-bold">{battalions.length} batalhões</div>
            <div className="text-xs text-neutral-400">
              {battalions.map((b) => `${b.name} (${TROOPS[b.troopType].label})`).join(", ")}
            </div>
          </>
        ) : (
          <>
            <div className="font-bold">{battalions[0].name}</div>
            <div className="font-mono text-xs text-neutral-400">
              {TROOPS[battalions[0].troopType].label} · {battalions[0].alive}/{battalions[0].max} · moral{" "}
              {battalions[0].morale}
            </div>
          </>
        )}
      </div>
      {panicked > 0 && (
        <div className="px-3 pb-2 text-xs font-bold text-red-400">
          {isGroup ? `${panicked} em pânico: não obedecem ordens` : "EM PÂNICO: não obedece ordens"}
        </div>
      )}

      <Section title="Ordens">
        {!isGroup && (
          <button type="button" className={itemClass} onClick={() => send({ type: "SELECT", ids, additive: false })}>
            <span>Selecionar</span>
            <span className="font-mono text-xs text-neutral-500">Clique esq.</span>
          </button>
        )}
        {orders.map((o) => (
          <button
            key={o.type}
            type="button"
            disabled={allPanicking}
            onClick={() => send({ type: o.type, ids })}
            className={itemClass}
          >
            <span>{o.label}</span>
            <span className="font-mono text-xs text-neutral-500">{o.hint}</span>
          </button>
        ))}
      </Section>

      <Section title={isGroup ? "Formação (de cada batalhão)" : "Formação"}>
        {formationRows.map(({ f, able, current }) => (
          <button
            key={f}
            type="button"
            title={FORMATIONS[f].description}
            disabled={allPanicking || current}
            onClick={() => send({ type: "FORMATION", ids, formation: f })}
            className={`${itemClass} ${current ? "text-sky-300 disabled:opacity-100" : ""}`}
          >
            <span>
              {current ? "● " : ""}
              {FORMATIONS[f].label}
            </span>
            <span className="font-mono text-xs text-neutral-500">
              {isGroup && able < battalions.length ? `${able}/${battalions.length} · ` : ""}
              {FORMATIONS[f].key}
            </span>
          </button>
        ))}
      </Section>

      {isGroup && (
        <Section title="Arranjo do grupo">
          {(Object.keys(ARRANGEMENTS) as GroupArrangement[]).map((a) => {
            const current = a === arrangement;
            return (
              <button
                key={a}
                type="button"
                title={ARRANGEMENTS[a].description}
                disabled={allPanicking}
                onClick={() => send({ type: "ARRANGEMENT", ids, arrangement: a })}
                className={`${itemClass} ${current ? "text-sky-300" : ""}`}
              >
                <span>
                  {current ? "● " : ""}
                  {ARRANGEMENTS[a].label}
                </span>
              </button>
            );
          })}
        </Section>
      )}
    </div>
  );
}
