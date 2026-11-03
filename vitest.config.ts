import { defineConfig } from "vitest/config";

// Testes das regras puras (sem Phaser). As batalhas de verdade estão em tests/battle.
export default defineConfig({
  test: { include: ["tests/unit/**/*.test.ts"] },
});
