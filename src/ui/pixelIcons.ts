import { iconBitmap, type IconId } from "../game/art/icons";

const canvases = new Map<IconId, HTMLCanvasElement>();
const urls = new Map<IconId, string>();

/** O ícone num canvas de 12×12 (para desenhar com `drawImage`, como no mapa do mundo). */
export function iconCanvas(id: IconId): HTMLCanvasElement {
  const hit = canvases.get(id);
  if (hit) return hit;
  const bm = iconBitmap(id);
  const canvas = document.createElement("canvas");
  canvas.width = bm.width;
  canvas.height = bm.height;
  canvas.getContext("2d")?.putImageData(new ImageData(bm.rgba, bm.width, bm.height), 0, 0);
  canvases.set(id, canvas);
  return canvas;
}

/** O ícone como imagem PNG embutida, feita uma vez só. */
export function iconUrl(id: IconId): string {
  const hit = urls.get(id);
  if (hit) return hit;
  const url = iconCanvas(id).toDataURL("image/png");
  urls.set(id, url);
  return url;
}
