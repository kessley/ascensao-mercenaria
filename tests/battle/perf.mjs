import { chromium } from "playwright-core";

/**
 * Rodada de desempenho: `node tests/battle/perf.mjs` (com `npm run dev` rodando). Abre o Edge com
 * janela (`--headless` para sem janela: o desenho deixa de valer) e mede, em passos manuais de
 * 1/30 s, o tempo de JavaScript da simulação (`update`) e do desenho (`render`) por passo:
 * mediana e 1% pior.
 *
 * - **Batalhas:** 8 batalhões de infantaria contra o mesmo número de goblins, já engalfinhados.
 * - **Acampamento:** a paliçada grande com o catálogo inteiro do Marco 22 e soldados vivendo nele;
 *   e o custo de redesenhar a planta (uma construção posta) e de um dia de obra (só o andamento).
 * - **Mapa:** o Comandante andando longe do acampamento.
 *
 * Só parte: `node tests/battle/perf.mjs batalhas` (ou `acampamento`, `mapa`).
 */
const headless = process.argv.includes("--headless");
/** `--perfil`: na maior batalha, as funções que mais gastam (tempo próprio), pelo perfilador do Edge. */
const profile = process.argv.includes("--perfil");
const chosen = process.argv.slice(2).filter((a) => !a.startsWith("--"));
const want = (name) => chosen.length === 0 || chosen.includes(name);

const browser = await chromium.launch({ channel: "msedge", headless });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
await page.goto("http://localhost:1420");
await page.waitForSelector("text=Batalha personalizada");

/** Roda na página: mede `steps` passos de 1/30 s (simulação e desenho em separado). */
function measureInPage(steps) {
  const w = window.__world;
  const g = w.sys.game;
  g.loop.stop();
  let t = w.time.now;
  const upd = [];
  const rnd = [];
  for (let i = 0; i < steps; i++) {
    t += 1000 / 30;
    w.time.now = t;
    const a = performance.now();
    w.sys.step(t, 1000 / 30);
    const b = performance.now();
    g.renderer.preRender();
    g.scene.render(g.renderer);
    g.renderer.postRender();
    // Espera a placa de vídeo terminar: o tempo de desenho conta o que ela fez
    g.renderer.gl?.finish();
    const c = performance.now();
    upd.push(b - a);
    rnd.push(c - b);
  }
  g.loop.start(g.step.bind(g));
  const q = (arr, p) => {
    const s = [...arr].sort((x, y) => x - y);
    return Math.round(s[Math.floor(p * (s.length - 1))] * 10) / 10;
  };
  return { update: [q(upd, 0.5), q(upd, 0.99)], render: [q(rnd, 0.5), q(rnd, 0.99)] };
}

/** As funções com mais tempo próprio no perfil (e o arquivo de cada uma). */
function printProfile(prof) {
  const self = new Map();
  const byId = new Map(prof.nodes.map((n) => [n.id, n]));
  const dt = new Map();
  for (let i = 0; i < prof.samples.length; i++) dt.set(prof.samples[i], (dt.get(prof.samples[i]) ?? 0) + (prof.timeDeltas[i] ?? 0));
  let total = 0;
  for (const [id, us] of dt) {
    const n = byId.get(id);
    const f = n.callFrame;
    const key = `${f.functionName || "(anônima)"}  ${f.url.split("/").slice(-2).join("/").replace(/\?.*$/, "")}:${f.lineNumber + 1}`;
    self.set(key, (self.get(key) ?? 0) + us);
    total += us;
  }
  console.log("  perfil (tempo próprio):");
  const top = [...self].sort((a, b) => b[1] - a[1]).slice(0, 28);
  for (const [k, us] of top) console.log(`  ${((us / total) * 100).toFixed(1).padStart(5)}%  ${k}`);
  // Quem chama as cinco mais caras (fora o "(program)"): o tempo delas por quem as chamou
  const parent = new Map();
  for (const n of prof.nodes) for (const c of n.children ?? []) parent.set(c, n);
  const label = (n) => `${n.callFrame.functionName || "(anônima)"}  ${n.callFrame.url.split("/").slice(-2).join("/").replace(/[?].*$/, "")}:${n.callFrame.lineNumber + 1}`;
  for (const [k] of top.filter(([k]) => !k.startsWith("(")).slice(0, 5)) {
    const by = new Map();
    for (const [id, us] of dt) {
      const n = byId.get(id);
      if (label(n) !== k) continue;
      let p = parent.get(n.id);
      const chain = [];
      for (let d = 0; p && d < 3; d++, p = parent.get(p.id)) chain.push(label(p).split("  ")[0] + " " + label(p).split("  ")[1].split("/").pop());
      const key = chain.join(" < ");
      by.set(key, (by.get(key) ?? 0) + us);
    }
    console.log(`  ${k} — chamada por:`);
    for (const [c, us] of [...by].sort((a, b) => b[1] - a[1]).slice(0, 3)) console.log(`      ${((us / total) * 100).toFixed(1).padStart(5)}%  ${c}`);
  }
}

const row = (label, m, extra = "") =>
  console.log(`${label.padEnd(34)} simulação ${String(m.update[0]).padStart(5)} / ${String(m.update[1]).padStart(5)} ms   desenho ${String(m.render[0]).padStart(5)} / ${String(m.render[1]).padStart(5)} ms${extra}`);

if (want("batalhas")) {
  console.log("\n== batalhas (mediana / 1% pior, por passo de 1/30 s)");
  for (const [n, zoom] of profile ? [[100, 1]] : [[40, 1], [80, 1], [100, 1], [100, 0.25]]) {
    await page.evaluate((n) => {
      const mod = window.__scenarios;
      const s = mod.blankScenario();
      s.distance = 500;
      s.fog = false;
      s.objective = "ROUT";
      s.army = { battalions: Array.from({ length: 8 }, () => mod.newBattalionSpec("INFANTRY", 1, 0, false, n)), scouts: 0, messengers: 0, wagons: 0 };
      s.forces = [{ ...mod.newForce("GOBLINS"), units: { GOBLIN: 8 * n }, stance: "ATTACK", competence: 3, trait: "BRAVE" }];
      window.__store.getState().startScenario(s);
    }, n);
    await page.waitForTimeout(150);
    await page.waitForFunction(() => window.__world?.run && window.__world.run.def === window.__store.getState().scenario && window.__store.getState().battleHud && !window.__world.scene.isPaused(), null, { timeout: 60000 });
    await page.waitForTimeout(500);
    // Oito segundos de jogo para as linhas se encontrarem, em passos manuais
    await page.evaluate((zoom) => {
      const w = window.__world;
      w.cameras.main.setZoom(zoom);
      const g = w.sys.game;
      g.loop.stop();
      let t = w.time.now;
      for (let k = 0; k < 240; k++) {
        t += 1000 / 30;
        w.time.now = t;
        w.sys.step(t, 1000 / 30);
      }
      g.loop.start(g.step.bind(g));
      const c = w.battalions[0].center;
      w.cameras.main.centerOn(c.x + 200, c.y);
    }, zoom);
    const cdp = profile ? await page.context().newCDPSession(page) : null;
    if (cdp) {
      await cdp.send("Profiler.enable");
      await cdp.send("Profiler.setSamplingInterval", { interval: 200 });
      await cdp.send("Profiler.start");
    }
    const m = await page.evaluate(measureInPage, 150);
    if (cdp) printProfile((await cdp.send("Profiler.stop")).profile);
    const state = await page.evaluate(() => {
      const w = window.__world;
      const ours = w.battalions.flatMap((b) => b.soldiers).filter((s) => s.isAlive);
      const melee = ours.filter((s) => s.target && Math.hypot(s.target.x - s.x, s.target.y - s.y) < 70).length;
      const foes = w.warbands.bands.flatMap((b) => b.members).filter((u) => u.isAlive).length;
      return { alive: ours.length + foes, melee: Math.round((melee / Math.max(1, ours.length)) * 100), paused: w.scene.isPaused() || !!window.__store.getState().scenarioResult };
    });
    const contact = state.melee;
    row(`${16 * n} soldados${zoom !== 1 ? `, zoom ${zoom * 100}%` : ""}`, m, `   (${contact}% dos nossos no corpo a corpo; ${state.alive} vivos${state.paused ? "; ACABOU" : ""})`);
  }
}

if (want("acampamento") || want("mapa")) {
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.waitForSelector("nav >> text=Nova campanha");
  await page.click("nav >> text=Nova campanha");
  await page.waitForSelector("text=Começar campanha");
  await page.click("text=Começar campanha");
  await page.waitForFunction(() => window.__world && !window.__world.run && window.__store.getState().battleHud, null, { timeout: 60000 });
  await page.waitForTimeout(1500);
  await page.evaluate(() => window.__store.setState({ nextEventDay: 99999, nextCalamityDay: 99999, dayProgress: 0.55 }));
}

if (want("acampamento")) {
  console.log("\n== acampamento (mediana / 1% pior, por passo de 1/30 s)");
  row("bivaque do começo", await page.evaluate(measureInPage, 150));
  // A paliçada grande com o catálogo inteiro, três batalhões e as obras andando
  const built = await page.evaluate(() => {
    const S = window.__store;
    const st = () => S.getState();
    S.setState({ gold: 99999, iron: 999, rations: 999, depot: { ...st().depot, WOOD: 999 }, campPlan: { ...st().campPlan, size: 28 } });
    for (let i = 0; i < 2; i++) st().formVolunteers?.();
    const kinds = ["KITCHEN", "DICE", "CARPENTRY", "LATRINE", "STANDARD", "OVEN", "SMOKEHOUSE", "HERBALIST", "CAPTAIN_TENT", "CAMP_TAVERN", "TROPHY", "CEMETERY", "STORY_FIRE", "ALTAR", "SADDLERY", "TAILOR", "LUMBER", "GARDEN", "RIDING", "ARSENAL", "PEN", "MAP_TENT", "CALTROPS", "SENTRY", "INFIRMARY", "WELL", "TOWER", "TRAINING", "ARCHERY", "STABLE", "FORGE", "QUARTERMASTER", "RECRUIT_POST", "OFFICERS_TENT", "BARRACK", "BARRACK", "RECRUIT_MAST"];
    let n = 0;
    for (const k of kinds) {
      outer: for (let y = -14; y <= 12; y++) for (let x = -14; x <= 12; x++) if (st().placeBuilding(k, x, y) === null) { n++; break outer; }
    }
    // Quatro em cada cinco ficam prontas; o resto continua em obra
    S.setState({ campPlan: { ...st().campPlan, buildings: st().campPlan.buildings.map((b, i) => (i % 5 === 0 ? b : (({ built, ...r }) => r)(b))) } });
    const b = st().battalions;
    if (b[0]) st().setShift(b[0].id, "WORK");
    if (b[1]) st().setShift(b[1].id, "GUARD");
    return n;
  });
  await page.waitForTimeout(4000);
  row(`paliçada grande, ${built} construções`, await page.evaluate(measureInPage, 300));
  // O custo de mudar a planta: uma construção posta (redesenho inteiro) e um dia de obra (só o andamento)
  const costs = await page.evaluate(async () => {
    const S = window.__store;
    const w = window.__world;
    const frames = async (ms) => {
      const list = [];
      const o = w.sys.step.bind(w.sys);
      w.sys.step = function (t, d) {
        const a = performance.now();
        o(t, d);
        list.push(performance.now() - a);
      };
      await new Promise((r) => setTimeout(r, ms));
      w.sys.step = o;
      return list;
    };
    const extra = (list, base) => Math.round(list.reduce((n, v) => n + Math.max(0, v - base), 0));
    // A base é o quadro mediano em repouso: com o mais rápido, o vaivém normal dos quadros somava centenas de ms
    const calm = (await frames(1500)).sort((a, b) => a - b);
    const base = calm[Math.floor(calm.length / 2)] ?? 0;
    let a = performance.now();
    const plan = S.getState().campPlan;
    S.setState({ campPlan: { ...plan, buildings: plan.buildings.map((b) => (b.built !== undefined ? { ...b, built: b.built + 1 } : b)) } });
    const progressSync = performance.now() - a;
    const progress = extra(await frames(3000), base);
    a = performance.now();
    S.setState({ campPlan: { ...S.getState().campPlan, gate: S.getState().campPlan.gate === "W" ? "E" : "W" } });
    const redrawSync = performance.now() - a;
    const redraw = extra(await frames(4000), base);
    return { progressSync: Math.round(progressSync * 10) / 10, progress, redrawSync: Math.round(redrawSync * 10) / 10, redraw };
  });
  console.log(`um dia de obra (só o andamento)         ${costs.progressSync} ms na hora + ${costs.progress} ms nos quadros seguintes`);
  console.log(`a planta muda (redesenho inteiro)       ${costs.redrawSync} ms na hora + ${costs.redraw} ms nos quadros seguintes`);
}

if (want("mapa")) {
  console.log("\n== mapa (mediana / 1% pior, por passo de 1/30 s)");
  for (const zoom of [1, 0.25]) {
    await page.evaluate((zoom) => {
      const w = window.__world;
      const c = w.world.camp.center;
      w.commander.setPosition(c.x + 4000, c.y + 2500);
      w.cameras.main.setZoom(zoom);
    }, zoom);
    await page.waitForTimeout(2500);
    row(`longe do acampamento, zoom ${zoom * 100}%`, await page.evaluate(measureInPage, 200));
  }
}

console.log(errors.length > 0 ? `\nErros no console: ${errors.slice(0, 4).join(" || ")}` : "\nSem erros no console.");
await browser.close();
