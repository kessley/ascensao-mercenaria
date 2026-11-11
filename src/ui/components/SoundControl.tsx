import { useEffect, useState, useSyncExternalStore } from "react";
import { AudioEngine } from "../../audio/AudioEngine";
import { BUSES, BUS_LABEL } from "../../audio/mixer";

const subscribe = (fn: () => void) => AudioEngine.subscribe(fn);
const getSnapshot = () => AudioEngine.getSettings();

/**
 * Mudo (tecla M), volume geral e, abrindo a mesa, um volume por canal: interface, vozes, combate,
 * ambiente e música. Tudo fica salvo no navegador.
 */
export function SoundControl() {
  const { volume, muted, buses } = useSyncExternalStore(subscribe, getSnapshot);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === "m" && !(e.target instanceof HTMLInputElement)) AudioEngine.toggleMute();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="pointer-events-auto relative flex items-center gap-2 hud-box px-2 py-1.5 text-xs text-neutral-200">
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
        aria-label="Volume geral"
        className="w-20 accent-amber-500"
      />
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        title="A mesa de som: um volume por canal"
        aria-expanded={open}
        className={`rounded px-1.5 py-0.5 ${open ? "bg-neutral-700" : "hover:bg-neutral-700"}`}
      >
        Canais
      </button>
      {open && (
        <div className="absolute right-0 top-full z-30 mt-1 flex w-56 flex-col gap-1.5 hud-box p-2" data-sound-mixer>
          {BUSES.map((b) => (
            <label key={b} className="flex items-center justify-between gap-2">
              <span className="w-16 shrink-0 text-neutral-300">{BUS_LABEL[b]}</span>
              <input
                type="range"
                min={0}
                max={100}
                value={Math.round(buses[b] * 100)}
                onChange={(e) => AudioEngine.setBusVolume(b, Number(e.target.value) / 100)}
                aria-label={`Volume: ${BUS_LABEL[b]}`}
                className="w-full accent-amber-500"
              />
            </label>
          ))}
        </div>
      )}
    </div>
  );
}
