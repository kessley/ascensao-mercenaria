import type { DuelHud, DuelistHud } from "../../../store/useGameStore";
import { PixelIcon } from "../PixelIcon";

function Bar({ value, color, tall }: { value: number; color: string; tall?: boolean }) {
  const pct = Math.max(0, Math.min(100, value * 100));
  return (
    <span className={`block w-full overflow-hidden rounded bg-neutral-800 ${tall ? "h-2.5" : "h-1.5"}`}>
      <span className={`block h-full transition-[width] duration-100 ${color}`} style={{ width: `${pct}%` }} />
    </span>
  );
}

/** Vida, fôlego e postura de um duelista (a postura cheia quebra a guarda). */
function Duelist({ f, right }: { f: DuelistHud; right?: boolean }) {
  return (
    <div className={`flex w-48 flex-col gap-1 ${right ? "items-end text-right" : ""}`}>
      <span className={`truncate text-sm font-bold ${f.ally ? "text-sky-200" : "text-red-200"}`}>{f.name}</span>
      <Bar value={f.hp} color={f.ally ? "bg-green-500" : "bg-red-500"} tall />
      <Bar value={f.stamina} color="bg-yellow-400" />
      <Bar value={f.posture} color={f.posture > 0.75 ? "bg-orange-500" : "bg-neutral-300"} />
    </div>
  );
}

/** O duelo no campo (Marco 21): as barras dos dois, em cima. */
export function DuelPanel({ duel }: { duel: DuelHud }) {
  const [ours, foe] = duel.fighters;
  return (
    <div className="flex w-full flex-col items-center gap-1 hud-box px-3 py-2">
      <span className="text-xs font-bold uppercase tracking-wider text-amber-200">
        <PixelIcon id="ARMS" /> Duelo{duel.auto ? " · os dois lutam sozinhos" : ""} · {duel.left} s
      </span>
      <div className="flex w-full items-start justify-between gap-4">
        <Duelist f={ours} />
        <Duelist f={foe} right />
      </div>
      <span className="text-[10px] text-neutral-400">vida · fôlego · postura (cheia, a guarda quebra)</span>
    </div>
  );
}

/** Com o Comandante no anel, os controles ficam embaixo, no lugar da barra de ordens (quem duela não comanda). */
export function DuelControls() {
  return (
    <div className="absolute inset-x-0 bottom-3 flex justify-center">
      <div className="max-w-3xl hud-box px-3 py-1.5 text-center font-mono text-xs leading-5 text-neutral-200">
        WASD anda · Espaço ou clique: golpe leve · Q ou botão direito: pesado · Shift: bloquear (na hora certa, apara)
        <br />F: esquiva · E: empurrão · o arco vermelho avisa o golpe; o largo e escuro é o pesado
      </div>
    </div>
  );
}
