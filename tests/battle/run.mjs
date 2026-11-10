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
import { atmosphere } from "./atmosphere.mjs";
import { magic } from "./magic.mjs";
import { saves } from "./saves.mjs";

/**
 * Batalhas de verdade, medidas no jogo: `npm run test:battle` (com `npm run dev` rodando).
 * Para rodar só parte: `npm run test:battle -- arquearia`.
 */
const SUITES = { mecanica: mechanics, arquearia: archery, confrontos: matchups, ia: ai, missoes: missions, companhias: companies, duelos: duels, cercos: sieges, mar: sea, lendas: legacy, progressao: progression, locais: sites, fortaleza: fortress, interface: ui, cultura: culture, atmosfera: atmosphere, magia: magic, saves };

const chosen = process.argv.slice(2);
const names = chosen.length > 0 ? chosen : Object.keys(SUITES);
const board = scoreboard();
const errors = [];
for (const name of names) {
  console.log(`\n== ${name}`);
  // Um navegador novo por suíte: cada batalha cria um jogo, e o WebGL de uma suíte não pesa na outra.
  // Uma suíte que quebra não leva as seguintes junto.
  const lab = await openLab();
  try {
    await SUITES[name](lab, board);
  } catch (e) {
    board.check(`${name}: a suíte terminou`, false, e.message);
  }
  errors.push(...lab.errors.map((m) => `${name}: ${m}`));
  await lab.browser.close();
}
board.check("sem erros no console", errors.length === 0, errors.slice(0, 4).join(" || "));
const ok = board.results.filter((r) => r.ok).length;
console.log(`\n${ok}/${board.results.length} verificações OK`);
process.exit(ok === board.results.length ? 0 : 1);
