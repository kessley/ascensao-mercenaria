import type Phaser from "phaser";

/**
 * Ritmo do tempo do jogo (1 = normal). Todo o tempo do Phaser passa por aqui: cenas, relógios,
 * animações e flechas desaceleram juntos, sem cada sistema precisar saber da câmera lenta.
 */
let rate = 1;

export const timeRate = (): number => rate;

export function setTimeRate(value: number): void {
  rate = value;
}

/** Faz o Phaser receber o tempo já no ritmo escolhido (chamar antes de o jogo começar a rodar). */
export function installGameClock(game: Phaser.Game): void {
  const step = game.step.bind(game);
  let now: number | null = null;
  game.step = (time: number, delta: number) => {
    const scaled = delta * rate;
    now = (now ?? time) + scaled;
    step(now, scaled);
  };
}
