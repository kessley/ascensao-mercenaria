import type Phaser from "phaser";

/**
 * Põe um canvas no gerenciador de texturas sem o `addCanvas` do Phaser. Ele guarda uma cópia dos
 * pixels para leitura (um `getImageData` do canvas inteiro), o que faz o navegador esperar a placa
 * de vídeo: no chão do mapa isso travava quadros por 40 a 70 ms. Nenhuma textura do jogo é lida
 * de volta, então basta a textura comum, que sobe o canvas para a placa uma vez.
 */
export function addCanvasTexture(textures: Phaser.Textures.TextureManager, key: string, canvas: HTMLCanvasElement): Phaser.Textures.Texture | null {
  const texture = textures.create(key, canvas, canvas.width, canvas.height);
  texture?.add("__BASE", 0, 0, 0, canvas.width, canvas.height);
  return texture;
}
