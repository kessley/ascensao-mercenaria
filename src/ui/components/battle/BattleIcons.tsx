import { FORMATION_ICON, TROOP_ICON } from "../../../game/art/icons";
import type { Formation, TroopType } from "../../../utils/constants";
import { PixelIcon } from "../PixelIcon";

/** Os ícones do combate (G5, parte 3): pixel art feita por código, em `game/art/iconArt.ts`. */
export type CommandIconId = "ADVANCE" | "HALT" | "CHARGE" | "RETREAT" | "RALLY" | "RUN" | "CRY" | "PAUSE" | "SLOW" | "FORCED" | "FORAGE" | "HELP" | "CYCLE" | "HOLD_FIRE" | "KITE" | "WAGON";

export function CommandIcon({ id }: { id: CommandIconId }) {
  return <PixelIcon id={id} scale={2} />;
}

/** A formação vista de cima, com a frente para cima. */
export function FormationIcon({ formation }: { formation: Formation }) {
  return <PixelIcon id={FORMATION_ICON[formation]} scale={2} />;
}

/** O ícone da tropa: 12 px na linha do texto, 24 px nas listas. */
export function TroopIcon({ troop, scale = 1 }: { troop: TroopType; scale?: 1 | 2 }) {
  return <PixelIcon id={TROOP_ICON[troop]} scale={scale} />;
}
