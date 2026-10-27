import { useGameStore } from "../../../store/useGameStore";
import { messengerProfile } from "../../../game/data/riders";
import { SUPPORT } from "../../../utils/constants";
import { Button } from "../Button";

const sectionTitle = "text-sm font-bold uppercase tracking-wider text-neutral-400";
const pct = (x: number) => `${Math.round(x * 100)}%`;

/** Estábulo: batedores (visão, nunca lutam) e mensageiros (levam ordens fora do raio de comando). */
export function StablePanel() {
  const scouts = useGameStore((s) => s.scouts);
  const messengers = useGameStore((s) => s.messengers);
  const gold = useGameStore((s) => s.gold);
  const hireScout = useGameStore((s) => s.hireScout);
  const hireMessenger = useGameStore((s) => s.hireMessenger);
  const M = SUPPORT.MESSENGER;

  return (
    <>
      <section className="flex flex-col gap-2">
        <h2 className={sectionTitle}>
          Batedores <span className="font-normal normal-case text-neutral-500">· {scouts.length}/{SUPPORT.SCOUT.MAX}</span>
        </h2>
        <p className="text-xs text-neutral-400">
          Cavaleiros rápidos ({pct(SUPPORT.SCOUT.evasion)} de esquiva) que nunca entram em combate: recuam diante do
          inimigo. Ampliam a visão do Comandante (raio {SUPPORT.VISION.SCOUT}; mais numa colina). Por padrão seguem à
          frente do Comandante; selecione e use o botão direito para mandar explorar um ponto.
        </p>
        {scouts.map((s) => (
          <div key={s.id} className="flex justify-between rounded bg-neutral-800 px-3 py-2 text-sm">
            <span className="font-semibold">{s.name}</span>
            <span className="text-xs text-neutral-400">{s.missions} batalha(s)</span>
          </div>
        ))}
        <Button
          disabled={gold < SUPPORT.SCOUT.COST || scouts.length >= SUPPORT.SCOUT.MAX}
          onClick={hireScout}
        >
          Contratar batedor ({SUPPORT.SCOUT.COST} ouro · {SUPPORT.SCOUT.WAGE}/sem.)
        </Button>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className={sectionTitle}>
          Mensageiros <span className="font-normal normal-case text-neutral-500">· {messengers.length}/{M.MAX}</span>
        </h2>
        <p className="text-xs text-neutral-400">
          Ordens para tropas fora do raio de comando ({SUPPORT.COMMAND_RADIUS}) viajam com um mensageiro a cavalo. Se for
          interceptado, a ordem se perde. A autoridade cresce com as entregas: mais velocidade, esquiva e moral na entrega;
          a partir do nível {M.RALLY_FROM_LEVEL}, reagrupa batalhões em pânico.
        </p>
        {messengers.map((m) => {
          const p = messengerProfile(m.level);
          const next = M.LEVEL_AT[m.level];
          return (
            <div key={m.id} className="flex flex-col gap-1 rounded bg-neutral-800 px-3 py-2 text-sm">
              <div className="flex justify-between">
                <span className="font-semibold">
                  <span className="mr-1 rounded bg-amber-700/80 px-1 font-mono text-xs text-amber-100">Cmd {m.level}</span>
                  {m.name}
                </span>
                <span className="text-xs text-neutral-400">
                  {m.deliveries} entrega(s){next !== undefined ? ` · próximo nível em ${next}` : " · nível máximo"}
                </span>
              </div>
              <div className="text-xs text-neutral-400">
                Esquiva {pct(p.evasion)} · velocidade {Math.round(p.speed)} · +{p.authority} de moral na entrega
                {p.canRally ? " · reagrupa em pânico" : ""}
              </div>
            </div>
          );
        })}
        <Button disabled={gold < M.COST || messengers.length >= M.MAX} onClick={hireMessenger}>
          Contratar mensageiro ({M.COST} ouro · {M.WAGE}/sem.)
        </Button>
      </section>
    </>
  );
}
