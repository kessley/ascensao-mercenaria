/** Batalhas de cerco de verdade: muralha, escadas, aríete, e os dois lados dela. */
const siege = (role, town, ladders = 3, rams = 1) => `Object.assign(s, mod.withSiege(s, { role: "${role}", town: "${town}", ladders: ${ladders}, rams: ${rams} }));`;

/** Lê o campo: onde cada um está em relação à muralha. */
function survey() {
  const w = window.__world;
  const l = w.run.siege.layout;
  const inTown = (p) => p.x >= l.bounds.x && p.x <= l.bounds.x + l.bounds.w && p.y >= l.bounds.y && p.y <= l.bounds.y + l.bounds.h;
  const foes = window.__lab.allEnemies().filter((e) => e.kind !== "SIEGE_RAM");
  const ours = w.battalions.flatMap((b) => b.soldiers).filter((s) => s.isAlive);
  return {
    foes: foes.length,
    foesIn: foes.filter(inTown).length,
    onWall: foes.filter((e) => e.onWall).length,
    ours: ours.length,
    oursIn: ours.filter(inTown).length,
    oursOnWall: ours.filter((s) => s.onWall).length,
    gates: w.works.gates.filter((g) => !g.broken).length,
    ladders: w.works.ladders.length,
    open: w.works.open,
    seconds: Math.round(w.run.seconds),
  };
}

const command = (action) => window.__store.getState().sendBattleCommand({ type: "SIEGE", ids: [], action });

/** Um jogador comum no assalto: aríete, infantaria ao pé da muralha, arcos atrás, escadas e para dentro. */
function assaultBot() {
  const w = window.__world;
  const lab = window.__lab;
  const l = w.run.siege.layout;
  const alive = (ranged) => w.battalions.filter((b) => !b.isDestroyed && !b.panicking && !!b.soldiers[0]?.ranged === ranged);
  let sent = false;
  let i = 0;
  lab.step(600, () => {
    if (i++ % 30 !== 0) return;
    lab.parkCommander();
    const store = window.__store.getState();
    const hud = store.scenarioHud?.siege;
    if (!sent) {
      sent = true;
      window.__siegeCommand("SEND_RAM");
      alive(false).forEach((b, k) => b.orderMove({ x: l.bounds.x - 130, y: l.cy - 240 + k * 160 }, 0));
      alive(true).forEach((b, k) => b.orderMove({ x: l.bounds.x - 250, y: l.cy - 160 + k * 160 }, 0));
    }
    if (hud?.atWall && store.siege?.ladders > 0) window.__siegeCommand("PLANT_LADDER");
    if (!w.works.open) return;
    const foes = lab.allEnemies().filter((e) => e.kind !== "SIEGE_RAM" && !e.routed);
    for (const b of [...alive(false), ...alive(true)]) {
      if (b.order.type === "ATTACK" && b.order.target.isAlive) continue;
      const c = b.center;
      const prey = foes.reduce((p, e) => (!p || Math.hypot(e.x - c.x, e.y - c.y) < Math.hypot(p.x - c.x, p.y - c.y) ? e : p), null);
      if (prey) b.orderAttack(prey);
    }
  });
  const r = window.__store.getState().scenarioResult;
  return { outcome: r?.outcome ?? "?", killed: r?.enemyKilled, of: r?.enemyTotal, seconds: Math.round(w.run.seconds), left: w.battalions.reduce((n, b) => n + b.aliveCount, 0), reason: r?.reason };
}

/** Um jogador comum na defesa: arcos seguem o inimigo pela muralha, a infantaria vai em quem entrou. */
function defenseBot() {
  const w = window.__world;
  const lab = window.__lab;
  const l = w.run.siege.layout;
  const b = l.bounds;
  const within = (p) => p.x > b.x && p.x < b.x + b.w && p.y > b.y && p.y < b.y + b.h;
  let i = 0;
  lab.step(600, () => {
    if (i++ % 45 !== 0) return;
    lab.parkCommander();
    const foes = lab.allEnemies().filter((e) => e.kind !== "SIEGE_RAM" && !e.routed);
    if (foes.length === 0) return;
    const inside = foes.filter(within);
    const outside = foes.filter((e) => !within(e));
    const seen = outside.length > 0 ? outside : foes;
    const c = { x: seen.reduce((n, e) => n + e.x, 0) / seen.length, y: seen.reduce((n, e) => n + e.y, 0) / seen.length };
    for (const t of w.battalions) {
      if (t.isDestroyed || t.panicking) continue;
      const at = t.center;
      const closest = (list) => list.reduce((p, e) => (!p || Math.hypot(e.x - at.x, e.y - at.y) < Math.hypot(p.x - at.x, p.y - at.y) ? e : p), null);
      if (t.soldiers[0]?.ranged) {
        // Com inimigo ao alcance, fica e atira; sem ninguém perto, vai para o trecho de muralha ameaçado
        const near = closest(foes);
        if (outside.length === 0 || (near && Math.hypot(near.x - at.x, near.y - at.y) < 320)) continue;
        const post = { x: Math.max(b.x + 100, Math.min(b.x + b.w - 100, c.x)), y: Math.max(b.y + 100, Math.min(b.y + b.h - 100, c.y)) };
        if (Math.hypot(post.x - at.x, post.y - at.y) > 320) t.orderMove(post, Math.atan2(c.y - post.y, c.x - post.x));
        continue;
      }
      const prey = closest(inside);
      if (prey && t.order.type !== "ATTACK") t.orderAttack(prey);
    }
  });
  const r = window.__store.getState().scenarioResult;
  return { outcome: r?.outcome ?? "?", killed: r?.enemyKilled, of: r?.enemyTotal, seconds: Math.round(w.run.seconds), left: w.battalions.reduce((n, x) => n + x.aliveCount, 0), reason: r?.reason };
}

export async function sieges({ battle, ev, page, labScript }, { check }) {
  const look = () => ev(survey);
  const tools = `window.__siegeCommand = ${command.toString()}; window.__assaultBot = ${assaultBot.toString()}; window.__defenseBot = ${defenseBot.toString()}`;

  // --- Pela tela ---
  await page.reload();
  await page.waitForSelector("text=Batalha personalizada");
  await page.click("text=Batalha personalizada");
  await page.waitForSelector("aside button");
  await page.click("aside button:has-text('A Paliçada')");
  check("o cenário mostra que é um cerco", (await page.locator("text=Você ataca os muros").count()) > 0);
  await page.click("button:has-text('+ Novo cenário')");
  await page.check("label:has-text('Batalha de cerco') input");
  await page.waitForSelector("text=Seu lado");
  check("o editor oferece os dois lados", (await page.locator("option:has-text('Você defende os muros')").count()) === 1);
  check("o mapa do cerco não tem rio", (await page.locator("option:has-text('Vau do rio')").count()) === 0);
  check("a primeira força vai para trás dos muros", (await page.locator("text=Guardam os muros").count()) === 1);
  await page.screenshot({ path: "tests/battle/.shots-cerco-editor.png" });
  await page.click("button:has-text('Voltar')").catch(() => {});
  await page.reload();
  await page.waitForSelector("text=Batalha personalizada");
  await page.click("text=Batalha personalizada");
  await page.click("aside button:has-text('A Paliçada')");
  await page.click("button:text-is('Lutar')");
  await page.waitForFunction(() => window.__world?.run?.siege && window.__store.getState().scenarioHud?.siege, null, { timeout: 30000 });
  await page.waitForSelector("button:has-text('Erguer escada (3)')");
  check("a barra do cerco aparece na batalha", true);
  check("longe da muralha, não dá para erguer a escada", await page.locator("button:has-text('Erguer escada')").isDisabled());
  await page.click("button:has-text('Mandar aríete (1)')");
  await page.waitForSelector("button:has-text('Mandar aríete (0)')");
  check("o botão manda o aríete", await ev(() => !!window.__world.works.ram?.isAlive));
  await page.waitForTimeout(1500);
  await page.screenshot({ path: "tests/battle/.shots-cerco.png" });
  await ev(() => {
    const w = window.__world;
    const l = w.run.siege.layout;
    w.commander.x = l.cx - 500;
    w.commander.y = l.cy;
  });
  await page.waitForTimeout(1200);
  await page.screenshot({ path: "tests/battle/.shots-cerco-muro.png" });
  await page.reload();
  await page.waitForSelector("text=Batalha personalizada");
  await page.evaluate(labScript);
  await page.evaluate(tools);

  // --- Atacando ---
  const garrison = [{ faction: "KINGDOM", units: { SOLDIER: 14, CROSSBOW: 8 }, side: "WALLS", competence: 3 }];
  await battle({ army: [["INFANTRY"], ["INFANTRY"], ["ARCHERS"]], forces: garrison, setup: siege("ATTACK", "FORT"), distance: 1500 });
  const start = await look();
  console.log("   início:", JSON.stringify(start));
  check("a guarnição começa dentro dos muros", start.foesIn === start.foes && start.foes >= 22, JSON.stringify(start));
  check("o bando começa do lado de fora", start.oursIn === 0, JSON.stringify(start));
  check("portões fechados, sem brecha", start.gates === 2 && !start.open, JSON.stringify(start));
  const quiet = await ev(() => ({ guards: window.__world.garrisons.units("scenario-town").length, spots: window.__world.spots().filter((x) => x.panel && x.panel.kind !== undefined && /Mercado|Paço/.test(x.label)).length }));
  check("o povoado não põe gente própria em campo", quiet.guards === 0, JSON.stringify(quiet));
  check("mercado e paço fechados na batalha", quiet.spots === 0, JSON.stringify(quiet));

  await ev(() => window.__lab.step(25));
  const manned = await look();
  console.log("   guarnecido:", JSON.stringify(manned));
  check("quem atira sobe na muralha", manned.onWall >= 6, JSON.stringify(manned));
  const facing = await ev(() => {
    const w = window.__world;
    const l = w.run.siege.layout;
    const shooters = window.__lab.allEnemies().filter((e) => e.onWall);
    return shooters.filter((e) => e.x - l.bounds.x < 260).length / Math.max(1, shooters.length);
  });
  check("do lado de onde o inimigo vem", facing > 0.5, String(facing));

  // Sem escada não se entra
  await ev(() => {
    const w = window.__world;
    const l = w.run.siege.layout;
    w.battalions[0].orderMove({ x: l.bounds.x - 130, y: l.cy }, 0);
    window.__lab.parkCommander();
    window.__lab.step(40, () => window.__store.getState().scenarioHud?.siege?.atWall);
  });
  const atWall = await ev(() => ({ hud: window.__store.getState().scenarioHud.siege, pos: window.__world.battalions[0].center, wall: window.__world.run.siege.layout.bounds.x }));
  console.log("   ao pé da muralha:", JSON.stringify(atWall));
  check("a tropa chega ao pé da muralha", atWall.hud.atWall, JSON.stringify(atWall));
  check("ninguém entra pelo muro fechado", (await look()).oursIn === 0);

  // Escada
  await ev(() => {
    window.__siegeCommand("PLANT_LADDER");
    window.__lab.step(0.5);
  });
  const up = await look();
  check("a escada sobe e abre passagem", up.ladders === 1 && up.open, JSON.stringify(up));
  check("gasta uma escada", (await ev(() => window.__store.getState().siege.ladders)) === 2);
  await ev(() => {
    const w = window.__world;
    const l = w.run.siege.layout;
    w.battalions[0].orderMove({ x: l.bounds.x + 300, y: l.cy }, 0);
    window.__lab.step(14);
  });
  const through = await look();
  console.log("   pela escada:", JSON.stringify(through));
  check("a tropa entra pela escada", through.oursIn > 0, JSON.stringify(through));
  const met = await ev(() => {
    const w = window.__world;
    const b = w.battalions[0];
    return window.__lab.allEnemies().filter((e) => !e.ranged && Math.hypot(e.x - b.center.x, e.y - b.center.y) < 420).length;
  });
  check("a infantaria deles vem fechar a brecha", met > 0, String(met));

  // Aríete
  await battle({ army: [["INFANTRY"], ["ARCHERS"]], forces: garrison, setup: siege("ATTACK", "VILLAGE", 0, 1), distance: 900 });
  const ram = await ev(() => {
    window.__lab.parkCommander();
    window.__siegeCommand("SEND_RAM");
    window.__lab.step(0.2);
    const w = window.__world;
    const out = !!w.works.ram?.isAlive;
    let at = null;
    window.__lab.step(100, () => {
      if (w.works.gates.some((g) => g.broken)) {
        at = w.run.seconds;
        return true;
      }
    });
    return { out, at, left: window.__store.getState().siege.ram, ram: w.works.ram ? { x: w.works.ram.x, y: w.works.ram.y, hp: w.works.ram.hp } : null, gates: w.works.gates.map((g) => g.hp) };
  });
  console.log("   aríete:", JSON.stringify(ram));
  check("o aríete sai e gasta o que havia", ram.out && ram.left === 0, JSON.stringify(ram));
  check("o aríete derruba o portão", ram.at !== null, JSON.stringify(ram));

  // Assalto inteiro
  const assault = await ev(() => {
    const w = window.__world;
    const lab = window.__lab;
    let i = 0;
    lab.step(300, () => {
      if (i++ % 30 === 0) lab.attackNearest();
    });
    return { result: window.__store.getState().scenarioResult, seconds: w.run.seconds };
  });
  console.log("   assalto:", assault.result?.outcome, assault.result?.reason, Math.round(assault.seconds), "s, matou", assault.result?.enemyKilled, "de", assault.result?.enemyTotal);
  check("o assalto chega a um fim", !!assault.result, JSON.stringify(assault.seconds));

  // --- Defendendo ---
  const horde = [{ faction: "ORCS", units: { ORC: 24, GOBLIN_ARCHER: 10 }, side: "FRONT", competence: 3 }];
  await battle({ army: [["INFANTRY"], ["SPEARMEN"], ["ARCHERS"], ["ARCHERS"]], forces: horde, setup: siege("DEFEND", "FORT", 2, 1), distance: 1000 });
  const held = await look();
  console.log("   defesa:", JSON.stringify(held));
  check("o bando começa dentro dos muros", held.oursIn === held.ours, JSON.stringify(held));
  check("o inimigo começa do lado de fora", held.foesIn === 0 && held.foes >= 34, JSON.stringify(held));
  await ev(() => window.__lab.step(1));
  check("nossos arqueiros começam na muralha", (await look()).oursOnWall >= 10, JSON.stringify(await look()));
  const reach = await ev(() => {
    const w = window.__world;
    const archer = w.battalions[2].soldiers.find((s) => s.onWall);
    return { wall: archer?.attackRange(), field: archer?.range };
  });
  check("na muralha o arco alcança mais", reach.wall > reach.field, JSON.stringify(reach));

  const timeline = await ev(() => {
    const w = window.__world;
    const lab = window.__lab;
    const out = { ladder: null, gate: null, ram: null, inside: null };
    lab.parkCommander();
    lab.step(120, () => {
      const t = Math.round(w.run.seconds);
      const l = w.run.siege.layout;
      if (out.ram === null && w.works.ram) out.ram = t;
      if (out.ladder === null && w.works.ladders.length > 0) out.ladder = t;
      if (out.gate === null && w.works.gates.some((g) => g.broken)) out.gate = t;
      if (out.inside === null && lab.allEnemies().some((e) => e.kind !== "SIEGE_RAM" && e.x > l.bounds.x + 80 && e.x < l.bounds.x + l.bounds.w - 80 && e.y > l.bounds.y + 80 && e.y < l.bounds.y + l.bounds.h - 80)) out.inside = t;
      return out.inside !== null;
    });
    return out;
  });
  console.log("   linha do tempo:", JSON.stringify(timeline), JSON.stringify(await look()));
  check("o inimigo traz o aríete", timeline.ram !== null, JSON.stringify(timeline));
  check("o inimigo ergue escadas ou derruba um portão", timeline.ladder !== null || timeline.gate !== null, JSON.stringify(timeline));
  check("o inimigo entra na fortaleza", timeline.inside !== null, JSON.stringify(timeline));

  const defense = await ev(() => {
    const w = window.__world;
    window.__lab.step(240);
    return { result: window.__store.getState().scenarioResult, seconds: w.run.seconds };
  });
  console.log("   defesa:", defense.result?.outcome, defense.result?.reason, Math.round(defense.seconds), "s, matou", defense.result?.enemyKilled, "de", defense.result?.enemyTotal);
  check("a defesa chega a um fim", !!defense.result, JSON.stringify(defense.seconds));

  // A muralha tem de valer alguma coisa: a mesma força, com e sem ela. Conta quem do bando fica de
  // pé: atrás dos muros, o assalto repelido cedo deixa poucos mortos do lado deles, e isso é vitória
  const even = [{ faction: "BANDITS", units: { BANDIT: 24, BANDIT_ARCHER: 8 }, side: "FRONT", competence: 3, trait: "BRAVE" }];
  const defenders = [["INFANTRY"], ["SPEARMEN"], ["ARCHERS"], ["ARCHERS"]];
  const walled = [];
  for (let i = 0; i < 5; i++) {
    await battle({ army: defenders, forces: even, setup: siege("DEFEND", "FORT", 2, 1), distance: 1000 });
    walled.push(await ev(() => window.__defenseBot()));
  }
  console.log("   com muralha:", JSON.stringify(walled));
  const open = [];
  for (let i = 0; i < 5; i++) {
    await battle({ army: defenders, forces: even, distance: 1000 });
    open.push(
      await ev(() => {
        const w = window.__world;
        const lab = window.__lab;
        let i = 0;
        lab.step(300, () => {
          if (i++ % 45 === 0) {
            lab.parkCommander();
            lab.attackNearest();
          }
        });
        const r = window.__store.getState().scenarioResult;
        return { outcome: r?.outcome ?? "?", killed: r?.enemyKilled, seconds: Math.round(w.run.seconds), left: w.battalions.reduce((n, x) => n + x.aliveCount, 0) };
      }),
    );
  }
  console.log("   em campo aberto:", JSON.stringify(open));
  const standing = (list) => list.reduce((n, p) => n + p.left, 0);
  const wins = (list) => list.filter((p) => p.outcome === "VICTORY").length;
  check("com muralha vai melhor que em campo aberto", standing(walled) > standing(open), `de pé: ${standing(walled)} contra ${standing(open)}; vitórias: ${wins(walled)} contra ${wins(open)}`);

  // Os cercos que vêm com o jogo têm de poder ser vencidos por quem joga direito
  for (const id of ["preset-palicada", "preset-forte-da-fronteira"]) {
    const runs = [];
    for (let i = 0; i < 3; i++) {
      await battle({ setup: `Object.assign(s, mod.presets.find((p) => p.id === "${id}"));` });
      runs.push(await ev(() => window.__assaultBot()));
    }
    console.log(`   ${id}:`, JSON.stringify(runs));
    check(`${id}: dá para vencer`, runs.some((r) => r.outcome === "VICTORY"), JSON.stringify(runs));
    check(`${id}: não é de graça`, runs.every((r) => r.outcome !== "VICTORY" || r.seconds > 60), JSON.stringify(runs));
  }

  const gate = [];
  for (let i = 0; i < 3; i++) {
    await battle({ setup: `Object.assign(s, mod.presets.find((p) => p.id === "preset-ultimo-portao"));` });
    gate.push(await ev(() => window.__defenseBot()));
  }
  console.log("   preset-ultimo-portao:", JSON.stringify(gate));
  check("preset-ultimo-portao: dá para vencer", gate.some((r) => r.outcome === "VICTORY"), JSON.stringify(gate));

  // Horda grande na muralha: rota que não existe custa caro
  await battle({ army: [["INFANTRY"], ["ARCHERS"], ["ARCHERS"]], forces: [{ faction: "ORCS", units: { ORC: 120, GOBLIN_ARCHER: 60 }, side: "FRONT", competence: 3 }], setup: siege("DEFEND", "CITY", 0, 0), distance: 900 });
  const cost = await ev(() => {
    const lab = window.__lab;
    lab.parkCommander();
    lab.step(30);
    const near = lab.allEnemies().filter((e) => !e.ranged).length;
    const t0 = performance.now();
    lab.step(10);
    return { ms: (performance.now() - t0) / 300, near, seconds: window.__world.run.seconds };
  });
  console.log("   horda na muralha:", JSON.stringify(cost));
  check("180 inimigos ao pé da muralha cabem num quadro de 60 fps", cost.ms < 16, JSON.stringify(cost));
}
