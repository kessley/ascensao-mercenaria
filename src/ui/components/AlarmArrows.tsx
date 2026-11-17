import { useEffect, useRef, useState } from "react";
import { alarms } from "../../audio/alarms";
import { ALARMS, edgeMark, type Signal } from "../../audio/alarmRules";
import { useGameStore } from "../../store/useGameStore";
import { PixelIcon } from "./PixelIcon";

/** Quanto a seta fica longe da borda da tela (px). */
const MARGIN = 44;
/** Dentro da tela, a marca fica um pouco acima do lugar, apontando para baixo (px). */
const ABOVE = 46;
/** Meia largura da caixa do ícone (px): a ponta e o nome ficam fora dela. */
const ICON_HALF = 21;
/** Nos últimos instantes a seta vai sumindo (ms). */
const FADE_MS = 1500;

const COLOR = { danger: "#e2483a", news: "#e8b04a" } as const;

/**
 * As setas dos alarmes (S1): presa na borda da tela, apontando para onde o perigo está; dentro da
 * tela, uma marca em cima do lugar. Clicar leva a câmera até lá. A posição muda a cada quadro sem
 * passar pelo React: o quadro lê a câmera em `alarms.view()` e mexe direto no estilo.
 */
export function AlarmArrows() {
  const [signals, setSignals] = useState<Signal[]>(() => [...alarms.active()]);
  const box = useRef<HTMLDivElement>(null);
  const marks = useRef(new Map<number, HTMLDivElement>());
  const sendBattleCommand = useGameStore((s) => s.sendBattleCommand);

  useEffect(() => alarms.subscribe(() => setSignals([...alarms.active()])), []);

  useEffect(() => {
    if (signals.length === 0) return;
    const ids = signals.map((s) => s.id).join();
    let raf = 0;
    const frame = () => {
      const live = alarms.active();
      if (live.map((s) => s.id).join() !== ids) {
        setSignals([...live]);
        return;
      }
      const el = box.current;
      const v = alarms.view();
      const now = performance.now();
      if (el && v.live) {
        const w = el.clientWidth;
        const h = el.clientHeight;
        for (const s of live) {
          const node = marks.current.get(s.id);
          if (!node) continue;
          if (!s.at) {
            node.style.display = "none";
            continue;
          }
          const m = edgeMark(((s.at.x - v.x) / v.width) * w, ((s.at.y - v.y) / v.height) * h, w, h, MARGIN);
          const y = m.inside ? m.y - ABOVE : m.y;
          node.style.display = "";
          node.style.transform = `translate(${Math.round(m.x)}px, ${Math.round(y)}px)`;
          node.style.opacity = String(Math.max(0, Math.min(1, (s.until - now) / FADE_MS)));
          node.dataset.inside = m.inside ? "1" : "0";
          const angle = m.inside ? Math.PI / 2 : m.angle;
          const [pointer, , label] = Array.from(node.children) as HTMLElement[];
          if (pointer) pointer.style.transform = `rotate(${angle}rad)`;
          // O nome vai do lado contrário da ponta, sem cobrir o ícone
          if (label) {
            const lw = label.offsetWidth;
            const lh = label.offsetHeight;
            const dx = -Math.cos(angle) * (ICON_HALF + 4 + lw / 2);
            const dy = -Math.sin(angle) * (ICON_HALF + 4 + lh / 2);
            label.style.transform = `translate(${Math.round(dx - lw / 2)}px, ${Math.round(dy - lh / 2)}px)`;
          }
        }
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [signals]);

  return (
    <div ref={box} className="pointer-events-none absolute inset-0 z-20 overflow-hidden" data-alarm-arrows>
      {signals.map((s) => {
        const spec = ALARMS[s.kind];
        const color = COLOR[spec.tone];
        return (
          <div
            key={s.id}
            ref={(node) => {
              if (node) marks.current.set(s.id, node);
              else marks.current.delete(s.id);
            }}
            className="absolute left-0 top-0"
            style={{ transform: "translate(-200px, -200px)" }}
            data-alarm={s.kind}
          >
            {/* A ponta: gira em volta do lugar da marca */}
            <div className="absolute left-0 top-0" style={{ transformOrigin: "0 0" }}>
              <div
                className={spec.tone === "danger" ? "animate-pulse" : ""}
                style={{
                  position: "absolute",
                  left: ICON_HALF + 4,
                  top: -8,
                  width: 0,
                  height: 0,
                  borderTop: "8px solid transparent",
                  borderBottom: "8px solid transparent",
                  borderLeft: `13px solid ${color}`,
                  filter: "drop-shadow(1px 1px 0 #000)",
                }}
              />
            </div>
            <button
              type="button"
              title={`${s.text} (clique para ir até lá)`}
              onClick={() => {
                if (s.at) sendBattleCommand({ type: "LOOK", ids: [], x: s.at.x, y: s.at.y });
                alarms.dismiss(s.id);
              }}
              className="pointer-events-auto absolute flex h-10 w-10 -translate-x-1/2 -translate-y-1/2 items-center justify-center hud-box p-0"
              style={{ boxShadow: `0 0 0 1px ${color}` }}
            >
              <span className={spec.tone === "danger" ? "animate-pulse" : ""}>
                <PixelIcon id={spec.icon} scale={2} className="max-w-none" />
              </span>
            </button>
            <span className="absolute left-0 top-0 whitespace-nowrap bg-black/70 px-1 py-0.5 text-[10px] leading-none" style={{ color }}>
              {spec.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}
