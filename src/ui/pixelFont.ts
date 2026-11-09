import { PIXEL_FAMILY, buildPixelFont } from "../game/art/font";

/**
 * Registra a fonte de pixel (G5, parte 1) na página, regular e negrito, a partir dos bytes
 * montados em `game/art/font.ts`. Vem antes do jogo abrir: o Phaser desenha os nomes com ela.
 * Se o navegador recusar a fonte, o jogo segue com a fonte de reserva do CSS.
 */
export async function loadPixelFont(): Promise<boolean> {
  if (typeof FontFace === "undefined" || typeof document === "undefined") return false;
  try {
    const faces = [
      new FontFace(PIXEL_FAMILY, buildPixelFont(false), { weight: "400" }),
      new FontFace(PIXEL_FAMILY, buildPixelFont(true), { weight: "700" }),
    ];
    await Promise.all(faces.map((f) => f.load()));
    for (const f of faces) document.fonts.add(f);
    return true;
  } catch (err) {
    console.warn("A fonte de pixel não carregou; fica a de reserva.", err);
    return false;
  }
}
