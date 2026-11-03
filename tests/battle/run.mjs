import { ai } from "./ai.mjs";
import { archery } from "./archery.mjs";
import { openLab, scoreboard } from "./lab.mjs";
import { matchups } from "./matchups.mjs";
import { legacy } from "./legacy.mjs";
import { mechanics } from "./mechanics.mjs";
import { missions } from "./missions.mjs";
import { sea } from "./sea.mjs";
import { sieges } from "./sieges.mjs";

/**
 * Batalhas de verdade, medidas no jogo: `npm run test:battle` (com `npm run dev` rodando).
 * Para rodar só parte: `npm run test:battle -- arquearia`.
 */
const SUITES = { mecanica: mechanics, arquearia: archery, confrontos: matchups, ia: ai, missoes: missions, cercos: sieges, mar: sea, lendas: legacy };

const chosen = process.argv.slice(2);
const names = chosen.length > 0 ? chosen : Object.keys(SUITES);
const lab = await openLab();
const board = scoreboard();
try {
  for (const name of names) {
    console.log(`\n== ${name}`);
    await SUITES[name](lab, board);
  }
} catch (e) {
  board.check("a suíte terminou", false, e.message);
}
board.check("sem erros no console", lab.errors.length === 0, lab.errors.slice(0, 4).join(" || "));
const ok = board.results.filter((r) => r.ok).length;
console.log(`\n${ok}/${board.results.length} verificações OK`);
await lab.browser.close();
process.exit(ok === board.results.length ? 0 : 1);
