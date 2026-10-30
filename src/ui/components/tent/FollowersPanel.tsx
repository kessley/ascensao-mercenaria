import { useGameStore } from "../../../store/useGameStore";
import { FOLLOWERS, followerCap } from "../../../game/sim/campEvents";

const sectionTitle = "text-sm font-bold uppercase tracking-wider text-neutral-400";

/**
 * Seguidores do acampamento (Marco 12): quem segue o bando, o serviço que presta e quanto come.
 * Chegam pedindo para seguir o bando (evento no portão); vão embora com fome; morrem se o
 * acampamento for atacado sem guarda.
 */
export function FollowersPanel() {
  const followers = useGameStore((s) => s.followers);
  const dismiss = useGameStore((s) => s.dismissFollower);
  const battalions = useGameStore((s) => s.battalions);
  const cap = followerCap(battalions);
  return (
    <section className="flex flex-col gap-2">
      <h2 className={sectionTitle}>Seguidores do acampamento</h2>
      <p className="text-xs text-neutral-400">
        O bando atrai até <b>{cap.total}</b> seguidores ({cap.families} família(s)): o número cresce com o tamanho do bando e com a fama dos batalhões.
      </p>
      {followers.length === 0 ? (
        <p className="text-xs text-neutral-500">
          Ninguém segue o bando ainda. Com o bando maior, cozinheiros, mascates, curandeiras, capelães, ajudantes de ferreiro e famílias aparecem no portão pedindo para vir junto.
        </p>
      ) : (
        <ul className="flex flex-col gap-1">
          {followers.map((f) => (
            <li key={f.id} className="flex items-center justify-between gap-2 rounded bg-neutral-800 px-3 py-1.5 text-xs">
              <span>
                <b>{f.name}</b> · {FOLLOWERS[f.role].label}
                <span className="block text-neutral-400">
                  {FOLLOWERS[f.role].effect} · come {FOLLOWERS[f.role].rations} ração/dia · desde o dia {f.since}
                </span>
              </span>
              <button type="button" onClick={() => dismiss(f.id)} className="rounded border border-neutral-600 px-2 py-0.5 text-neutral-300 hover:border-red-400">
                Dispensar
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
