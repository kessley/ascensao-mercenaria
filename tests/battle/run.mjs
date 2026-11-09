import { ai } from "./ai.mjs";
import { companies } from "./companies.mjs";
import { duels } from "./duels.mjs";
import { archery } from "./archery.mjs";
import { openLab, scoreboard } from "./lab.mjs";
import { matchups } from "./matchups.mjs";
import { legacy } from "./legacy.mjs";
import { mechanics } from "./mechanics.mjs";
import { missions } from "./missions.mjs";
import { progression } from "./progression.mjs";
import { sea } from "./sea.mjs";
import { sieges } from "./sieges.mjs";
import { sites } from "./sites.mjs";
import { fortress } from "./fortress.mjs";
import { ui } from "./interface.mjs";
import { culture } from "./culture.mjs";

/**
 * Batalhas de verdade, medidas no jogo: `npm run test:battle` (com `npm run dev` rodando).
 * Para rodar só parte: `npm run test:battle -- arquearia`.
 */
const SUITES = { mecanica: mechanics, arquearia: archery, confrontos: matchups, ia: ai, missoes: missions, companhias: companies, duelos: duels, cercos: sieges, mar: sea, lendas: legacy, progressao: progression, locais: sites, fortaleza: fortress, interface: ui, cultura: culture };

const chosen = process.argv.slice(2);
const names = chosen.length > 0 ? chosen : Object.keys(SUITES);
const lab = await openLab();
const board = scoreboard();
try {
  for (const name of names) {
    console.log(`\n== ${name}`);
    // Uma suíte que recarrega a página (a de missões) leva o laboratório junto
    if (!(await lab.page.evaluate(() => Boolean(window.__lab)))) await lab.page.evaluate(lab.labScript);
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
