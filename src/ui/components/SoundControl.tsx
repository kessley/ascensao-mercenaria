import { useEffect, useSyncExternalStore } from "react";
import { AudioEngine } from "../../audio/AudioEngine";

const subscribe = (fn: () => void) => AudioEngine.subscribe(fn);
const getSnapshot = () => AudioEngine.getSettings();

/** Mudo (tecla M) e volume geral; a preferência fica salva no navegador. */
export function SoundControl() {
  const { volume, muted } = useSyncExternalStore(subscribe, getSnapshot);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === "m" && !(e.target instanceof HTMLInputElement)) AudioEngine.toggleMute();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="pointer-events-auto flex items-center gap-2 rounded bg-black/60 px-2 py-1.5 text-xs text-neutral-200">
      <button
        type="button"
        onClick={() => AudioEngine.toggleMute()}
        title="M: ligar/desligar o som"
        className={`rounded px-1.5 py-0.5 ${muted ? "bg-red-900/70 text-red-200" : "hover:bg-neutral-700"}`}
      >
        {muted ? "Som: mudo" : "Som"}
      </button>
      <input
        type="range"
        min={0}
        max={100}
        value={Math.round(volume * 100)}
        onChange={(e) => AudioEngine.setVolume(Number(e.target.value) / 100)}
        aria-label="Volume"
        className="w-20 accent-amber-500"
      />
    </div>
  );
}
