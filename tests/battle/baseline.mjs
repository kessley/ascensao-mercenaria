/**
 * A linha de base (Marco 24, parte 0): como o combate está antes de mudar qualquer número. Mede e
 * imprime; as verificações só dizem que a medida saiu. Os números vão para a tabela da etapa 2 do
 * ROADMAP_FASE_4.md (coluna "Hoje"), para comparar depois.
 */

const median = (xs) => {
  const s = [...xs].sort((a, b) => a - b);
  if (s.length === 0) return null;
  const m = s.length / 2;
  return s.length % 2 ? s[Math.floor(m)] : (s[m - 1] + s[m]) / 2;
};
const round = (x) => (x === null ? null : Math.round(x * 10) / 10);

/** Um contra um: o soldado do bando e um inimigo lado a lado, cada um no outro, até um cair ou fugir. */
function oneOnOne() {
  const lab = window.__lab;
  const w = window.__world;
  lab.freezeAI();
  lab.parkCommander();
  const b = lab.battalion();
  const s = b.soldiers[0];
  const e = lab.allEnemies()[0];
  lab.place(b, 4000, 3500, 0);
  e.x = 4040;
  e.y = 3500;
  e.home = { x: e.x, y: e.y };
  e.dormant = false;
  b.orderAttack(e);
  e.target = s;
  let first = null;
  lab.step(240, () => {
    if (first === null && (s.lastHitAt > -Infinity || e.lastHitAt > -Infinity) && (Number.isFinite(e.firstHitAt) || Number.isFinite(s.firstHitAt))) first = w.time.now;
    return !s.isAlive || !e.isAlive || e.unitState === "FLEEING" || s.unitState === "FLEEING";
  });
  const lost = (u) => !u.isAlive || u.unitState === "FLEEING";
  return { seconds: first === null ? null : (w.time.now - first) / 1000, won: lost(e) ? "nosso" : lost(s) ? "inimigo" : "ninguém", fled: (e.isAlive && lost(e)) || (s.isAlive && lost(s)) };
}

/** Batalha sem pensar: todos atacam o mais perto; mede do primeiro golpe ao fim. */
function brawl() {
  const lab = window.__lab;
  const w = window.__world;
  const st = window.__store;
  lab.parkCommander();
  let contact = null;
  let i = 0;
  lab.step(900, () => {
    if (i++ % 15 === 0) {
      lab.parkCommander();
      lab.attackNearest();
    }
    if (contact === null && w.battalions.some((b) => b.soldiers.some((s) => s.isAlive && s.target?.isAlive && s.inRange(s.target)))) contact = w.run.seconds;
  });
  const r = st.getState().scenarioResult;
  return { outcome: r?.outcome ?? null, total: Math.round(r?.seconds ?? w.run.seconds), fight: contact === null ? null : Math.round((r?.seconds ?? w.run.seconds) - contact), lost: r ? r.battalions.reduce((n, b) => n + b.start - b.alive, 0) : null };
}

/** O Comandante sozinho no meio de `n` goblins: quantos golpes ele apara e quanto aguenta. */
function surrounded(n, immortal) {
  const lab = window.__lab;
  const w = window.__world;
  lab.freezeAI();
  const c = w.commander;
  c.restoreHp(c.maxHp);
  for (const b of w.battalions) lab.place(b, 600, 600, 0);
  c.x = 4000;
  c.y = 3500;
  const goblins = lab.allEnemies().slice(0, n);
  for (const e of lab.allEnemies().slice(n)) {
    e.x = 7000;
    e.y = 6000;
    e.home = { x: e.x, y: e.y };
  }
  let blows = 0;
  let hits = 0;
  const take = c.takeDamage.bind(c);
  c.takeDamage = (amount, source, time, kind) => {
    if (goblins.includes(source) && kind !== "RANGED") hits++;
    take(amount, source, time, kind);
  };
  goblins.forEach((e, i) => {
    const a = (i / n) * Math.PI * 2;
    e.x = c.x + Math.cos(a) * 34;
    e.y = c.y + Math.sin(a) * 34;
    e.home = { x: e.x, y: e.y };
    e.dormant = false;
    e.target = c;
    if (immortal) {
      e.maxHp = 1e6;
      e.restoreHp(1e6);
    }
    const play = e.playAttack.bind(e);
    e.playAttack = (t) => {
      if (t === c) blows++;
      play(t);
    };
  });
  const t0 = w.time.now;
  lab.step(60, () => !c.isAlive || goblins.every((e) => !e.isAlive));
  return { blows, hits, parried: blows > 0 ? Math.round(((blows - hits) / blows) * 100) : null, fell: c.isAlive ? null : Math.round((w.time.now - t0) / 100) / 10, alive: goblins.filter((e) => e.isAlive).length };
}

/** Um batalhão inteiro em cima de um só inimigo grande: quanto ele aguenta e quantos leva junto. */
function gangUp() {
  const lab = window.__lab;
  const w = window.__world;
  lab.freezeAI();
  lab.parkCommander();
  const b = lab.battalion();
  const e = lab.allEnemies()[0];
  lab.place(b, 4000, 3500, 0);
  e.x = 4090;
  e.y = 3500;
  e.home = { x: e.x, y: e.y };
  e.dormant = false;
  b.orderAttack(e);
  e.target = b.soldiers[0];
  const start = b.aliveCount;
  lab.step(300, () => !e.isAlive || e.unitState === "FLEEING" || b.aliveCount === 0);
  const t = Number.isFinite(e.firstHitAt) ? (w.time.now - e.firstHitAt) / 1000 : null;
  return { kind: e.kind, maxHp: e.maxHp, seconds: t === null ? null : Math.round(t * 10) / 10, down: !e.isAlive, fled: e.isAlive && e.unitState === "FLEEING", lost: start - b.aliveCount };
}

export async function baseline({ battle, ev }, { check }) {
  const table = {};

  // Os grandes: um soldado contra um orc, e um batalhão inteiro contra um brutamontes
  for (const [label, army, force, fn] of [
    ["soldado contra orc", [["INFANTRY", 1]], { ORC: 1 }, oneOnOne],
    ["batalhão contra orc", [["INFANTRY", 8]], { ORC: 1 }, gangUp],
    ["batalhão contra brutamontes", [["INFANTRY", 8]], { ORC_BRUTE: 1 }, gangUp],
  ]) {
    const runs = [];
    for (let i = 0; i < 4; i++) {
      await battle({ army, force, faction: "ORCS", distance: 2400 });
      runs.push(await ev(fn));
    }
    table[label] = { mediana: round(median(runs.map((r) => r.seconds).filter((x) => x !== null))), corridas: runs };
    check(`linha: ${label}`, runs.some((r) => r.seconds !== null), JSON.stringify(table[label]));
  }

  // Um soldado do bando contra um goblin, nível 1 e nível 5
  for (const level of [1, 5]) {
    const runs = [];
    for (let i = 0; i < 8; i++) {
      await battle({ army: [["INFANTRY", 1, level]], force: { GOBLIN: 1 }, faction: "GOBLINS", distance: 2400 });
      runs.push(await ev(oneOnOne));
    }
    const times = runs.filter((r) => r.won === "nosso" && r.seconds !== null).map((r) => r.seconds);
    table[`soldado nível ${level} contra goblin`] = { mediana: round(median(times)), vitórias: `${times.length}/${runs.length}`, tempos: times.map(round) };
    check(`linha: soldado nível ${level} contra goblin`, times.length > 0, JSON.stringify(table[`soldado nível ${level} contra goblin`]));
  }

  // Dois soldados iguais: a infantaria do bando contra o soldado de um reino
  {
    const runs = [];
    for (let i = 0; i < 8; i++) {
      await battle({ army: [["INFANTRY", 1]], force: { SOLDIER: 1 }, faction: "KINGDOM", distance: 2400 });
      runs.push(await ev(oneOnOne));
    }
    const times = runs.filter((r) => r.seconds !== null && r.won !== "ninguém").map((r) => r.seconds);
    table["dois soldados iguais"] = { mediana: round(median(times)), nossos: runs.filter((r) => r.won === "nosso").length, deles: runs.filter((r) => r.won === "inimigo").length, tempos: times.map(round) };
    check("linha: dois soldados iguais", times.length > 0, JSON.stringify(table["dois soldados iguais"]));
  }

  // Escaramuça de um batalhão: 8 de infantaria contra 10 goblins
  {
    const runs = [];
    for (let i = 0; i < 4; i++) {
      await battle({ army: [["INFANTRY", 8]], force: { GOBLIN: 8, GOBLIN_ARCHER: 2 }, faction: "GOBLINS", distance: 1200, stance: "ATTACK", competence: 2 });
      runs.push(await ev(brawl));
    }
    table["escaramuça de um batalhão"] = { mediana: median(runs.map((r) => r.fight).filter((x) => x !== null)), corridas: runs };
    check("linha: escaramuça de um batalhão", runs.some((r) => r.outcome), JSON.stringify(table["escaramuça de um batalhão"]));
  }

  // Batalha média: o cenário pronto "Primeiro Sangue" (3 batalhões contra 21 goblins)
  {
    const runs = [];
    for (let i = 0; i < 3; i++) {
      await battle({ setup: "const p = JSON.parse(JSON.stringify(mod.presets[0])); Object.assign(s, p, { id: s.id, fog: false });" });
      runs.push(await ev(brawl));
    }
    table["batalha média"] = { mediana: median(runs.map((r) => r.fight).filter((x) => x !== null)), corridas: runs };
    check("linha: batalha média", runs.some((r) => r.outcome), JSON.stringify(table["batalha média"]));
  }

  // O Comandante sozinho, cercado: com goblins que não caem (para contar os golpes) e com goblins de verdade
  for (const n of [1, 3, 6]) {
    await battle({ army: [["INFANTRY", 2]], force: { GOBLIN: Math.max(n, 1) }, faction: "GOBLINS", distance: 2400 });
    const imm = await ev(surrounded, n, true);
    table[`Comandante cercado por ${n}`] = imm;
    check(`linha: Comandante cercado por ${n}`, imm.blows > 0, JSON.stringify(imm));
  }
  await battle({ army: [["INFANTRY", 2]], force: { GOBLIN: 6 }, faction: "GOBLINS", distance: 2400 });
  const real = await ev(surrounded, 6, false);
  table["Comandante contra 6 goblins de verdade"] = real;
  check("linha: Comandante contra 6 goblins de verdade", real.blows > 0, JSON.stringify(real));

  console.log("\n   LINHA DE BASE:\n" + JSON.stringify(table, null, 2).replace(/^/gm, "   "));
}
