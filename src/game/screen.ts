import Phaser from "phaser";
import { GAME_HEIGHT, GAME_WIDTH } from "../utils/constants";

/**
 * Tamanho da tela do jogo em escala inteira: cada pixel do jogo vira 1, 2 ou 3 pixels do
 * monitor, nunca 1,5 (em escala quebrada os pixels da arte saem desiguais). O jogo desenha na
 * resolução real do monitor dividida por essa escala, então mostra um pouco mais ou um pouco
 * menos do mundo conforme a tela: 1920×1080 mostra 1920×1080; 2560×1440 e 4K mostram 1280×720
 * em dobro e em triplo.
 */
export interface ScreenFit {
  width: number;
  height: number;
  /** Pixels do monitor por pixel do jogo (inteiro). */
  base: number;
  /** Para o Phaser: tamanho no CSS = tamanho do jogo × zoom. */
  zoom: number;
}

export function screenFit(cssWidth: number, cssHeight: number, dpr: number): ScreenFit {
  const w = Math.max(1, Math.round(cssWidth * dpr));
  const h = Math.max(1, Math.round(cssHeight * dpr));
  // Só amplia quando sobra tela: 1080 linhas ainda é escala 1, 1440 já é 2
  const base = Math.max(1, Math.min(Math.floor(h / GAME_HEIGHT + 0.25), Math.floor(w / GAME_WIDTH + 0.25)));
  return { width: Math.floor(w / base), height: Math.floor(h / base), base, zoom: base / dpr };
}

/** Acompanha o tamanho do contêiner (e a densidade de pixels) e refaz a tela do jogo. */
export function fitScreen(game: Phaser.Game, parent: HTMLElement): () => void {
  const canvas = game.canvas;
  canvas.style.imageRendering = "pixelated";
  let last = "";
  const apply = () => {
    const fit = screenFit(parent.clientWidth, parent.clientHeight, window.devicePixelRatio || 1);
    const key = `${fit.width}x${fit.height}@${fit.zoom}`;
    if (key === last) return;
    last = key;
    game.scale.resize(fit.width, fit.height);
    game.scale.setZoom(fit.zoom);
  };
  apply();
  const observer = new ResizeObserver(apply);
  observer.observe(parent);
  // Arrastar a janela para outro monitor muda a densidade sem mudar o tamanho do contêiner
  window.addEventListener("resize", apply);
  return () => {
    observer.disconnect();
    window.removeEventListener("resize", apply);
  };
}
