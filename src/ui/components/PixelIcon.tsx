import { ICON_SIZE, splitIcons, type IconId } from "../../game/art/icons";
import { iconUrl } from "../pixelIcons";

interface PixelIconProps {
  id: IconId;
  /** 1 = 12 px, na altura do texto; 2 = 24 px, nos botões e nas listas. */
  scale?: 1 | 2 | 3;
  title?: string;
  className?: string;
}

/** Um ícone de pixel (G5, parte 3), sem suavizar. */
export function PixelIcon({ id, scale = 1, title, className = "" }: PixelIconProps) {
  const size = ICON_SIZE * scale;
  return (
    <img
      src={iconUrl(id)}
      width={size}
      height={size}
      alt={title ?? ""}
      title={title}
      aria-hidden={title ? undefined : true}
      draggable={false}
      data-icon={id}
      className={`pixel-icon ${scale > 1 ? "pixel-icon-big" : ""} ${className}`}
    />
  );
}

/** Um texto com os sinais (⚑, ★, ☠, ✉...) trocados pelos ícones de pixel. */
export function IconText({ text }: { text: string }) {
  const parts = splitIcons(text);
  if (parts.length === 1 && !parts[0].icon) return <>{text}</>;
  return (
    <>
      {parts.map((p, i) => (p.icon ? <PixelIcon key={i} id={p.icon} /> : <span key={i}>{p.text}</span>))}
    </>
  );
}
