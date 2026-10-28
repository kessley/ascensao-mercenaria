import { TIME } from "./constants";

/**
 * Horas do dia (Marco 10). O relógio do mundo guarda só a fração do dia (dayProgress);
 * o dia vira na aurora (DAY_START_HOUR), então dayProgress 0 = 6h da manhã.
 */

export type DayPhase = "DAWN" | "DAY" | "DUSK" | "NIGHT";

export const PHASE_LABEL: Record<DayPhase, string> = {
  DAWN: "Aurora",
  DAY: "Dia",
  DUSK: "Crepúsculo",
  NIGHT: "Noite",
};

/** Hora do dia (0–24) para a fração do dia. */
export function hourOf(progress: number): number {
  return (TIME.DAY_START_HOUR + progress * 24) % 24;
}

export function phaseOf(progress: number): DayPhase {
  const h = hourOf(progress);
  if (h >= TIME.DAWN[0] && h < TIME.DAWN[1]) return "DAWN";
  if (h >= TIME.DAWN[1] && h < TIME.DUSK[0]) return "DAY";
  if (h >= TIME.DUSK[0] && h < TIME.DUSK[1]) return "DUSK";
  return "NIGHT";
}

/** Escuridão de 0 (dia claro) a 1 (noite fechada), com rampas na aurora e no crepúsculo. */
export function darknessAt(progress: number): number {
  const h = hourOf(progress);
  const [d0, d1] = TIME.DAWN;
  const [k0, k1] = TIME.DUSK;
  if (h >= d1 && h < k0) return 0;
  if (h >= k0 && h < k1) return (h - k0) / (k1 - k0);
  if (h >= d0 && h < d1) return 1 - (h - d0) / (d1 - d0);
  return 1;
}

/** Fração de dia que falta até a próxima vez que o relógio marcar `hour`. */
export function daysUntilHour(progress: number, hour: number): number {
  const now = hourOf(progress);
  const hours = (hour - now + 24) % 24;
  return (hours === 0 ? 24 : hours) / 24;
}

export function formatHour(progress: number): string {
  const h = hourOf(progress);
  return `${String(Math.floor(h)).padStart(2, "0")}h${String(Math.floor((h % 1) * 60)).padStart(2, "0")}`;
}
