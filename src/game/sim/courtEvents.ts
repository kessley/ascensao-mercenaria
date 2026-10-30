import type { CourtEvent, CourtEventKind } from "./kingdoms";

/** Há esta festa ou cerimônia nesta capital neste dia? */
export function hasCourtEvent(events: readonly CourtEvent[], townId: string, kind: CourtEventKind, day: number): boolean {
  return events.some((e) => e.townId === townId && e.kind === kind && e.day === day);
}
