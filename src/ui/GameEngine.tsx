import { useEffect, useRef } from "react";
import Phaser from "phaser";
import { createGameConfig } from "../game/GameConfig";

/**
 * Hospeda a instância do Phaser.Game dentro do React.
 * O jogo é criado no mount e destruído no unmount (inclusive no double-mount
 * do React.StrictMode em dev), evitando canvas duplicado e vazamento de memória.
 */
export function GameEngine() {
  const containerRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<Phaser.Game | null>(null);

  useEffect(() => {
    if (!containerRef.current || gameRef.current) return;

    gameRef.current = new Phaser.Game(createGameConfig(containerRef.current));

    return () => {
      // true = remove o canvas do DOM
      gameRef.current?.destroy(true);
      gameRef.current = null;
    };
  }, []);

  return <div ref={containerRef} className="absolute inset-0" />;
}
