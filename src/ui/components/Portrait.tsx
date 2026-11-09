import type { Culture } from "../../game/art/buildings";
import { PORTRAIT_SIZE, portraitBitmap, portraitKey, type PortraitSpec } from "../../game/art/portraits";
import { captainPortrait, commanderPortrait, lieutenantPortrait, noblePortrait } from "../../game/art/portraitSpecs";
import type { CaptainData } from "../../game/data/captains";
import type { LieutenantData } from "../../game/data/lieutenants";
import { leaderAge, type FormerLeader } from "../../game/sim/legacy";
import type { Noble } from "../../game/sim/nobility";
import { useGameStore } from "../../store/useGameStore";

const urls = new Map<string, string>();

/** O retrato como imagem PNG embutida, feita uma vez para cada rosto, idade e cicatriz. */
function portraitUrl(spec: PortraitSpec): string {
  const key = portraitKey(spec);
  const hit = urls.get(key);
  if (hit) return hit;
  const bm = portraitBitmap(spec);
  const canvas = document.createElement("canvas");
  canvas.width = bm.width;
  canvas.height = bm.height;
  canvas.getContext("2d")?.putImageData(new ImageData(bm.rgba, bm.width, bm.height), 0, 0);
  const url = canvas.toDataURL("image/png");
  urls.set(key, url);
  return url;
}

/** A cultura da terra onde o bando está (a dos nobres, e a de metade de quem entra no bando). */
export function useWorldCulture(): Culture {
  return useGameStore((s) => s.world?.culture ?? "REALMS");
}

interface PortraitProps {
  spec: PortraitSpec;
  /** 1 = 32 px, nas listas; 2 = 64 px, no cabeçalho de uma ficha. */
  scale?: 1 | 2 | 3;
  title?: string;
  className?: string;
}

/** O busto de um personagem (G5, parte 4), numa moldura de bronze, sem suavizar. */
export function Portrait({ spec, scale = 2, title, className = "" }: PortraitProps) {
  const size = PORTRAIT_SIZE * scale;
  return (
    <img
      src={portraitUrl(spec)}
      width={size}
      height={size}
      alt={title ?? ""}
      title={title}
      aria-hidden={title ? undefined : true}
      draggable={false}
      data-portrait={spec.role}
      className={`portrait ${className}`}
    />
  );
}

type Size = Pick<PortraitProps, "scale" | "className">;

/** O Comandante de agora, com a idade e as cicatrizes de hoje. */
export function CommanderPortrait(props: Size) {
  const leader = useGameStore((s) => s.leader);
  const day = useGameStore((s) => s.day);
  return <Portrait spec={commanderPortrait(leader, leaderAge(leader, day))} title={leader.name} {...props} />;
}

/** Um Comandante que já se foi, como era ao morrer. */
export function FormerPortrait({ former, ...props }: Size & { former: FormerLeader }) {
  return <Portrait spec={commanderPortrait({ ...former, wounds: former.wounds ?? 0 }, former.age)} title={former.name} {...props} />;
}

export function CaptainPortrait({ captain, ...props }: Size & { captain: Pick<CaptainData, "id" | "name" | "origin" | "battles" | "culture"> }) {
  const culture = useWorldCulture();
  return <Portrait spec={captainPortrait(captain, culture)} title={captain.name} {...props} />;
}

export function LieutenantPortrait({ lieutenant, ...props }: Size & { lieutenant: Pick<LieutenantData, "id" | "name" | "kills" | "culture"> }) {
  return <Portrait spec={lieutenantPortrait(lieutenant)} title={lieutenant.name} {...props} />;
}

/** O nobre, na cor do reino dele. */
export function NoblePortrait({ noble, ...props }: Size & { noble: Pick<Noble, "id" | "name" | "female" | "age" | "rank" | "martial" | "factionId"> }) {
  const culture = useWorldCulture();
  const color = useGameStore((s) => s.world?.factions.find((f) => f.id === noble.factionId)?.color ?? 0x8a6a3a);
  return <Portrait spec={noblePortrait(noble, color, culture)} title={noble.name} {...props} />;
}
