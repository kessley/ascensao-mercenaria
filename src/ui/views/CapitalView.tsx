import { useEffect, useState } from "react";
import { useGameStore } from "../../store/useGameStore";
import { chooseDialog } from "../../game/interiorBridge";
import { capitalLayout } from "../../game/world/capitalLayout";
import { STANDING_LABEL, standingIn } from "../../game/sim/reputation";
import { formatHour } from "../../utils/time";
import { ResourceBar } from "../components/ResourceBar";

const DISTRICT_COLOR: Record<string, string> = {
  CASTLE: "#9a9488",
  NOBLE: "#88966a",
  TEMPLE: "#d9d2bf",
  PLAZA: "#b8ad94",
  MARKET: "#c9a23a",
  ARENA: "#d8c070",
  SLUMS: "#5b5046",
  MERCHANTS: "#3a6a8a",
  ARTISANS: "#8e4a2b",
  COMMONS: "#7d6f50",
};

/** Mapa da Cidade Alta (tecla M): os bairros, para não se perder. */
function CityMap({ townId, x, y }: { townId: string; x: number; y: number }) {
  const l = capitalLayout(townId);
  const scale = 0.06;
  return (
    <div className="pointer-events-auto absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-lg border-2 border-amber-200/60 bg-neutral-950/95 p-3">
      <div className="mb-2 text-sm font-bold text-amber-300">Mapa da Cidade Alta (M fecha)</div>
      <svg width={l.w * scale} height={l.h * scale} className="rounded bg-neutral-800" role="img" aria-label="Bairros da Cidade Alta">
        {l.districts.map((d) => (
          <g key={d.id}>
            <rect x={d.rect.x * scale} y={d.rect.y * scale} width={d.rect.w * scale} height={d.rect.h * scale} fill={DISTRICT_COLOR[d.id]} opacity={0.75} stroke="#111" />
            <text x={(d.rect.x + d.rect.w / 2) * scale} y={(d.rect.y + d.rect.h / 2) * scale} textAnchor="middle" fontSize="12" fontWeight="bold" fill="#fff" stroke="#000" strokeWidth="3" paintOrder="stroke">
              {d.name}
            </text>
          </g>
        ))}
        <circle cx={x * scale} cy={y * scale} r="6" fill="#3b82f6" stroke="#fbbf24" strokeWidth="2" />
      </svg>
    </div>
  );
}

/**
 * HUD da Cidade Alta (Marco 15): onde o Comandante está, quem ele é neste reino, as três
 * reputações, a caixa de diálogo e o mapa dos bairros.
 */
export function CapitalView() {
  const city = useGameStore((s) => s.city);
  const dialog = useGameStore((s) => s.dialog);
  const panel = useGameStore((s) => s.campPanel);
  const day = useGameStore((s) => s.day);
  const progress = useGameStore((s) => s.dayProgress);
  const disguised = useGameStore((s) => s.disguiseUntil > s.day + s.dayProgress);
  const standing = useGameStore((s) => (s.city ? standingIn(s, s.city.factionId) : 0));
  const setCampPanel = useGameStore((s) => s.setCampPanel);
  const [map, setMap] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === "m") setMap((v) => !v);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  if (!city) return null;
  return (
    <div className="pointer-events-none absolute inset-0 text-white">
      <div className="absolute left-1/2 top-3 flex -translate-x-1/2 flex-col items-center gap-1">
        <div className="rounded-full border border-amber-300/50 bg-black/75 px-5 py-1.5 text-base font-bold tracking-wide text-amber-200">
          {city.name} · {city.district}
        </div>
        <div className="rounded bg-black/60 px-3 py-0.5 font-mono text-xs text-neutral-200">
          Dia {day}, {formatHour(progress)} · aqui o senhor é <b className={standing < 0 ? "text-red-400" : "text-amber-200"}>{city.factionId === "PLAYER" ? "o dono da cidade" : STANDING_LABEL[standing]}</b>
          {disguised && <span className="text-sky-300"> · de libré</span>}
        </div>
      </div>
      <div className="pointer-events-auto absolute right-3 top-3 flex flex-col items-end gap-1">
        <div className="flex gap-1">
          <button type="button" onClick={() => setCampPanel({ kind: "NOBILITY" })} className="rounded border border-amber-400/70 bg-black/70 px-3 py-1 text-xs text-amber-100 hover:bg-amber-900/50">
            Livro da Nobreza
          </button>
          <button type="button" onClick={() => setCampPanel({ kind: "GAME" })} className="rounded border border-neutral-500 bg-black/70 px-3 py-1 text-xs text-neutral-100 hover:bg-neutral-700">
            Jogo
          </button>
        </div>
      </div>
      <div className="absolute bottom-3 right-3">
        <ResourceBar />
      </div>
      <div className="absolute bottom-3 left-3 rounded bg-black/60 px-3 py-1 font-mono text-[11px] text-neutral-300">
        WASD andar · Shift correr · E falar/entrar · M mapa · Portão Velho sai
      </div>
      {map && <CityMap townId={city.townId} x={city.x} y={city.y} />}
      {dialog && !panel && (
        <div className="pointer-events-auto absolute bottom-16 left-1/2 w-[40rem] max-w-[92vw] -translate-x-1/2 rounded-lg border-2 border-amber-200/60 bg-neutral-950/95 p-4 shadow-2xl">
          <div className="mb-1 text-sm font-bold text-amber-300">{dialog.speaker}</div>
          <p className="text-sm leading-relaxed text-neutral-100">{dialog.text}</p>
          <div className="mt-3 flex max-h-72 flex-col gap-1 overflow-y-auto">
            {dialog.options.map((o, i) => (
              <button key={o.id} type="button" onClick={() => chooseDialog(o.id)} className="rounded border border-neutral-600 bg-neutral-800 px-3 py-1.5 text-left text-sm hover:border-amber-300 hover:bg-neutral-700">
                <span className="mr-2 font-mono text-amber-300">{i + 1}.</span>
                {o.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
