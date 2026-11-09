import { BUTTON_STATES, BUTTON_TONES, FRAME_KINDS, buttonArt, frameArt } from "../game/art/frames";
import type { Bitmap } from "../game/art/pixel";

/** Um bitmap da arte vira uma imagem PNG embutida, para o CSS. */
function dataUrl(bm: Bitmap): string {
  const canvas = document.createElement("canvas");
  canvas.width = bm.width;
  canvas.height = bm.height;
  canvas.getContext("2d")?.putImageData(new ImageData(bm.rgba, bm.width, bm.height), 0, 0);
  return canvas.toDataURL("image/png");
}

/**
 * Põe as molduras e os botões (G5, parte 2) como variáveis do CSS na raiz da página:
 * `--art-frame-wood`, `--art-btn-gold-hover`... As classes `frame-*`, `hud-box` e `btn-pixel`
 * do `index.css` usam essas variáveis.
 */
export function installPixelFrames(): void {
  if (typeof document === "undefined") return;
  const root = document.documentElement.style;
  const set = (name: string, bm: Bitmap) => root.setProperty(name, `url("${dataUrl(bm)}")`);
  for (const kind of FRAME_KINDS) set(`--art-frame-${kind.toLowerCase()}`, frameArt(kind));
  for (const tone of BUTTON_TONES) for (const state of BUTTON_STATES) set(`--art-btn-${tone.toLowerCase()}-${state.toLowerCase()}`, buttonArt(tone, state));
}
