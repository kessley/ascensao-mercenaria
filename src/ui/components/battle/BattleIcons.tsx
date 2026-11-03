import type { ReactNode } from "react";
import type { Formation, TroopType } from "../../../utils/constants";

/** Ícones do combate em greybox: só traços e pontos, na cor do texto do botão. */
function Svg({ size = 22, children }: { size?: number; children: ReactNode }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      {children}
    </svg>
  );
}

const Dots = ({ at }: { at: readonly (readonly [number, number])[] }) => (
  <>
    {at.map(([x, y]) => (
      <circle key={`${x}-${y}`} cx={x} cy={y} r={2.1} fill="currentColor" stroke="none" />
    ))}
  </>
);

export type CommandIconId = "ADVANCE" | "HALT" | "CHARGE" | "RETREAT" | "RALLY" | "RUN" | "CRY" | "PAUSE" | "SLOW" | "FORCED" | "FORAGE" | "HELP" | "CYCLE" | "HOLD_FIRE" | "KITE" | "WAGON";

const COMMAND_PATHS: Record<CommandIconId, ReactNode> = {
  ADVANCE: <path d="M12 20V5M6 11l6-6 6 6" />,
  HALT: <path d="M8 3h8l5 5v8l-5 5H8l-5-5V8zM8 12h8" />,
  CHARGE: <path d="M6 12l6-6 6 6M6 19l6-6 6 6" />,
  RETREAT: <path d="M12 4v15M6 13l6 6 6-6" />,
  RALLY: <path d="M6 21V4M6 5h12l-3 4 3 4H6" />,
  RUN: <path d="M5 6l6 6-6 6M12 6l6 6-6 6" />,
  CRY: <path d="M4 10v4h3l9 5V5l-9 5H4zM19 9c1.2 2 1.2 4 0 6" />,
  PAUSE: <path d="M9 5v14M15 5v14" />,
  SLOW: <path d="M7 3h10M7 21h10M8 3c0 5 8 6 8 9s-8 4-8 9M16 3c0 5-8 6-8 9s8 4 8 9" />,
  FORCED: <path d="M3 7l5 5-5 5M9.5 7l5 5-5 5M16 7l5 5-5 5" />,
  FORAGE: <path d="M12 21V8M12 8c-3 0-4-2-4-4 3 0 4 2 4 4zM12 8c3 0 4-2 4-4-3 0-4 2-4 4zM12 14c-3 0-4-2-4-4 3 0 4 2 4 4zM12 14c3 0 4-2 4-4-3 0-4 2-4 4z" />,
  HELP: <path d="M9 9a3 3 0 1 1 4.5 2.6c-1 .6-1.5 1.3-1.5 2.4M12 18v.01" />,
  CYCLE: <path d="M4 12a8 8 0 0 1 14-5.3L20 9M20 4v5h-5M20 12a8 8 0 0 1-14 5.3L4 15M4 20v-5h5" />,
  HOLD_FIRE: <path d="M4 20L18 6M13 6h5v5M5 5l14 14" />,
  KITE: <path d="M12 4v11M7 10l5-6 5 6M6 20h12" />,
  WAGON: <path d="M3 8h12v7H3zM15 10h3l3 3v2h-6M7 18.5a1.5 1.5 0 1 0 0-.01M17 18.5a1.5 1.5 0 1 0 0-.01" />,
};

export function CommandIcon({ id }: { id: CommandIconId }) {
  return <Svg>{COMMAND_PATHS[id]}</Svg>;
}

/** Desenho da formação vista de cima, com a frente para cima. */
export function FormationIcon({ formation }: { formation: Formation }) {
  switch (formation) {
    case "SHIELD_WALL":
      return (
        <Svg>
          {[2.5, 8, 13.5, 19].map((x) => (
            <rect key={x} x={x} y={7} width={3.5} height={10} rx={1} fill="currentColor" stroke="none" />
          ))}
        </Svg>
      );
    case "WEDGE":
      return (
        <Svg>
          <Dots at={[[12, 5], [8, 11.5], [16, 11.5], [4, 18], [12, 18], [20, 18]]} />
        </Svg>
      );
    case "LOOSE":
      return (
        <Svg>
          <Dots at={[[4, 6], [13, 4.5], [20, 9], [8.5, 12.5], [17, 15], [4, 19], [12.5, 20]]} />
        </Svg>
      );
    default:
      return (
        <Svg>
          <Dots at={[[4.5, 9], [9.5, 9], [14.5, 9], [19.5, 9], [4.5, 15.5], [9.5, 15.5], [14.5, 15.5], [19.5, 15.5]]} />
        </Svg>
      );
  }
}

const TROOP_PATHS: Record<TroopType, ReactNode> = {
  INFANTRY: <path d="M12 3l7 3v6c0 4-3 7-7 9-4-2-7-5-7-9V6z" />,
  SPEARMEN: <path d="M12 21V8M12 3l3 5H9zM8 14h8" />,
  HEAVY: <path d="M12 3l7 3v6c0 4-3 7-7 9-4-2-7-5-7-9V6zM12 3v18M5 11h14" />,
  ARCHERS: <path d="M7 3c9 3 9 15 0 18M7 3v18M4 12h15M16 9l3 3-3 3" />,
  CROSSBOW: <path d="M12 21V6M4 9c4-4 12-4 16 0M4 9l8 5 8-5M9 4l3-2 3 2" />,
  JAVELINS: <path d="M5 20L19 6M15 6h4v4M9 20L21 8" />,
  CAVALRY: <path d="M7 20c-4-8-3-16 5-16s9 8 5 16M5 20h4M15 20h4" />,
  KNIGHTS: <path d="M7 20c-4-8-3-16 5-16s9 8 5 16M5 20h4M15 20h4M12 4V1M9 11h6" />,
  HORSE_ARCHERS: <path d="M6 20c-3-7-2-13 3-14M6 20H3M14 3c7 3 7 15 0 18M14 3v18M9 12h11" />,
};

export function TroopIcon({ troop, size = 16 }: { troop: TroopType; size?: number }) {
  return <Svg size={size}>{TROOP_PATHS[troop]}</Svg>;
}
