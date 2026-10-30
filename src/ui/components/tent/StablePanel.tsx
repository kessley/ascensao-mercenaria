import { useGameStore } from "../../../store/useGameStore";
import { messengerProfile, scoutRank } from "../../../game/data/riders";
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
  const chicks = useGameStore((s) => s.harpyChicks);
  const adopt = useGameStore((s) => s.harpyAdopt);
  const day = useGameStore((s) => s.day);
  const M = SUPPORT.MESSENGER;
  const S = SUPPORT.SCOUT;

  return (
    <>
      <section className="flex flex-col gap-2">
        <h2 className={sectionTitle}>
          Batedores <span className="font-normal normal-case text-neutral-500">· {scouts.length}/{SUPPORT.SCOUT.MAX}</span>
        </h2>
        <p className="text-xs text-neutral-400">
          Cavaleiros rápidos ({pct(S.evasion)} de esquiva) que nunca entram em combate: enxergam longe (raio {SUPPORT.VISION.SCOUT}; mais
          numa colina) e contornam o inimigo antes de serem notados. Selecione e use o botão direito para mandar vigiar um
          ponto; no Mapa do Continente, explorar uma região, patrulhar ou seguir um bando. A mais de {S.LIVE_RANGE} do
          Comandante ficam fora de contato: o que veem só chega quando voltarem ou pela harpia.
        </p>
        <p className="text-xs text-neutral-400">
          Harpia: águia treinada que leva relatórios e traz ordens simples a até um dia de marcha. Uma viagem por vez, de dia e
          sem tempestade; arqueiros podem abatê-la. O falcoeiro da Cidade Alta vende aves; ninhos ficam nas montanhas.
        </p>
        {scouts.map((s) => (
          <div key={s.id} className="flex flex-col gap-1 rounded bg-neutral-800 px-3 py-2 text-sm">
            <div className="flex justify-between">
              <span className="font-semibold">{s.name}</span>
              <span className="text-xs text-neutral-400">
                {S.RANK_LABEL[scoutRank(s.missions)]} · {s.missions} missão(ões)
              </span>
            </div>
            {s.harpy ? (
              <div className="text-xs text-sky-300">Harpia {s.harpy.name}{s.harpy.readyDay > day ? ` · em treino (${s.harpy.readyDay - day} dia(s))` : ""}</div>
            ) : (
              chicks > 0 && (
                <Button onClick={() => adopt(s.id)}>Criar um filhote de harpia ({chicks} no ninho · {SUPPORT.HARPY.TRAIN_DAYS * 2} dias)</Button>
              )
            )}
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
