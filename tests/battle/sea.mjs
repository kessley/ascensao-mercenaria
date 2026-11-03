/** Mares e continentes: embarcar, atravessar, desembarcar em outra cultura, lucrar e voltar. */
const ready = (page) => page.waitForFunction(() => window.__world && !window.__world.run && window.__store.getState().battleHud && !window.__world.scene.isPaused(), null, { timeout: 60000 });

/** Toda a viagem, um dia por vez; piratas no caminho levam o pedágio. */
function crossing() {
  const st = window.__store;
  for (let i = 0; i < 200 && st.getState().voyage; i++) {
    const s = st.getState();
    if (s.voyage.pirates) s.answerPirates("PAY");
    else s.sailDay();
  }
}

/** Preço do luxo no primeiro porto. */
function luxuryPrice() {
  const s = window.__store.getState();
  const t = s.settlements.find((x) => x.port && x.owner !== "RUINED") ?? s.settlements[0];
  return { name: t.name, price: Math.round(t.econ.price.LUXURY ?? 0), stock: Math.round(t.econ.stock.LUXURY ?? 0), id: t.id };
}

export async function sea({ page, ev, labScript }, { check }) {
  // Todo continente, em vários mundos: tem de nascer com povoados, reinos e porto
  await page.reload();
  await page.waitForSelector("nav >> text=Nova campanha");
  const lands = await ev(async () => {
    const gen = await import("/src/game/worldgen/generateWorld.ts");
    const planetMod = await import("/src/game/data/planet.ts");
    const out = [];
    for (const seed of [11, 222, 3333, 44444]) {
      const planet = planetMod.generatePlanet({ seed, name: "Teste", options: { size: "MEDIUM" } });
      for (const c of planet.continents.filter((x) => !x.home)) {
        const t0 = performance.now();
        const w = gen.continentWorld(c, { size: c.size, age: "MIDDLE", calamities: "NORMAL" });
        out.push({ seed, culture: c.culture, towns: w.settlements.length, ports: w.settlements.filter((t) => t.port).length, realms: w.factions.length, ms: Math.round(performance.now() - t0), biomes: [...new Set(w.geo.biome)].length });
      }
    }
    return out;
  });
  console.log("   continentes:", JSON.stringify(lands.map((l) => `${l.culture}:${l.towns}p/${l.ports}portos/${l.ms}ms`)));
  check("todo continente tem povoados e reinos", lands.every((l) => l.towns >= 6 && l.realms >= 2), JSON.stringify(lands));
  check("todo continente tem porto", lands.every((l) => l.ports >= 1), JSON.stringify(lands.filter((l) => l.ports === 0)));
  check("gerar um continente leva menos de 4 s", lands.every((l) => l.ms < 4000), String(Math.max(...lands.map((l) => l.ms))));
  await ev(() => localStorage.clear());
  await page.reload();
  await page.waitForSelector("nav >> text=Nova campanha");
  await page.click("nav >> text=Nova campanha");
  await page.waitForSelector("text=Começar campanha");
  await page.click("text=Começar campanha");
  await ready(page);
  await page.waitForTimeout(900);
  await page.evaluate(labScript);
  await page.evaluate(`window.__crossing = ${crossing.toString()}; window.__luxury = ${luxuryPrice.toString()};`);

  const home = await ev(() => {
    const st = window.__store;
    const s = st.getState();
    st.setState({ gold: 20000, rations: 900, nextEventDay: 99999, nextCalamityDay: 99999 });
    const port = s.settlements.find((t) => t.port && t.owner !== "RUINED");
    return {
      continents: s.planet.continents.map((c) => ({ id: c.id, name: c.name, culture: c.culture })),
      port: port?.id,
      portName: port?.name,
      name: s.world.name,
      towns: s.settlements.map((t) => t.name),
      ids: s.battalions.map((b) => b.id),
      wagons: s.wagons.length,
      first: s.settlements[0].name,
    };
  });
  console.log("   planeta:", JSON.stringify(home.continents));
  check("o planeta tem de 3 a 5 continentes", home.continents.length >= 3 && home.continents.length <= 5);
  check("há um porto no continente natal", !!home.port);
  const luxHome = await ev(() => window.__luxury());
  console.log("   luxo em casa:", JSON.stringify(luxHome));

  // O cais, pela tela
  await ev((id) => window.__store.getState().setCampPanel({ kind: "TOWN", settlementId: id, at: "MARKET" }), home.port);
  await page.waitForSelector("button:has-text('Ir ao cais do porto')");
  await page.click("button:has-text('Ir ao cais do porto')");
  await page.waitForSelector("text=Quem embarca");
  check("sem carta, a terra não tem nome", (await page.locator("text=Terra sem carta").count()) >= 2);
  check("sem destino não dá para zarpar", await page.locator("button:has-text('Zarpar')").isDisabled());
  await page.locator("button:has-text('Carta náutica')").first().click();
  await page.waitForSelector("button:has-text('Rumar')");
  await page.click("button:has-text('Rumar')");
  await page.screenshot({ path: "tests/battle/.shots-cais.png" });

  // Uma tropa fica no cais: não cabe todo mundo
  const stayId = home.ids[1];
  await page.locator(`label:has(input[type=checkbox]) >> nth=1`).click();
  await page.waitForTimeout(150);
  await page.click("button:has-text('Zarpar')");
  await page.waitForSelector("text=Rumo a");
  await page.waitForTimeout(1400);
  await page.screenshot({ path: "tests/battle/.shots-viagem.png" });
  const sailing = await ev(() => {
    const s = window.__store.getState();
    return { to: s.voyage?.to, day: s.voyage?.day, days: s.voyage?.days, paused: window.__world.ended, field: !!s.voyage?.field, aboard: s.battalions.length, stay: s.voyage?.stay.length, save: s.saveGame("2") };
  });
  console.log("   viagem:", JSON.stringify(sailing));
  check("o bando parte", !!sailing.to && sailing.days >= 3, JSON.stringify(sailing));
  check("os dias passam sozinhos", sailing.day >= 1, JSON.stringify(sailing));
  check("o campo espera em pausa", sailing.paused);
  check("quem não embarcou fica no cais", sailing.stay === 1 && sailing.aboard === home.ids.length - 1, JSON.stringify(sailing));
  check("em alto-mar não se salva", typeof sailing.save === "string");

  const t0 = Date.now();
  await ev(() => window.__crossing());
  await page.waitForTimeout(400);
  await ready(page);
  await page.waitForTimeout(900);
  const landed = await ev(() => {
    const w = window.__world;
    const s = window.__store.getState();
    const near = s.settlements.reduce((m, t) => Math.min(m, Math.hypot(t.x - w.commander.x, t.y - w.commander.y)), Infinity);
    return {
      continent: s.continent,
      culture: w.world.culture,
      name: s.world.name,
      towns: s.settlements.slice(0, 5).map((t) => t.name),
      factions: s.world.factions.map((f) => f.name),
      fame: s.fame,
      camp: s.campPacked,
      near: Math.round(near),
      field: w.battalions.length,
      store: s.battalions.length,
      commanderOpen: !w.commander.constructor.terrain.isBlocked(w.commander.x, w.commander.y),
      parked: Object.keys(s.parked),
      reward: Math.round(s.contracts.reduce((n, c) => n + c.reward, 0) / Math.max(1, s.contracts.length)),
      contracts: s.contracts.length,
    };
  });
  console.log("   desembarque:", JSON.stringify(landed), `(${Date.now() - t0} ms)`);
  check("chegou a outro continente", landed.continent !== "C0" && landed.parked.includes("C0"), JSON.stringify(landed));
  check("outra cultura, outros nomes", landed.culture !== "REALMS" && !home.towns.includes(landed.towns[0]), JSON.stringify(landed.towns));
  check("a fama local começa em zero", landed.fame === 0);
  const nobles = await ev(() => window.__store.getState().nobles.slice(0, 4).map((n) => n.name));
  check("a nobreza daqui tem nomes daqui", nobles.length > 0 && !/Afonso|Sancho|Beatriz|Urraca|Teresa|Leonor|Nuno|Vasco/.test(nobles.join()), nobles.join());
  check("sem acampamento na terra nova", landed.camp === true);
  check("o bando desce perto de um povoado, em terra firme", landed.near < 3000 && landed.commanderOpen, JSON.stringify(landed));
  check("as tropas descem junto", landed.field === landed.store && landed.field > 0, JSON.stringify(landed));
  await page.screenshot({ path: "tests/battle/.shots-terra-nova.png" });

  const troops = await ev(() => {
    const w = window.__world;
    const e = w.spawnEnemy(w.commander.x + 3000, w.commander.y, "SOLDIER");
    const kind = e.kind;
    e.destroy();
    w.enemies = w.enemies.filter((x) => x !== e);
    return kind;
  });
  check("a tropa comum daqui é a tropa típica da terra", troops !== "SOLDIER", troops);

  // Comércio: dias passam para o mercado reagir ao luxo local
  await ev(() => window.__store.getState().advanceTime(30));
  const luxAway = await ev(() => window.__luxury());
  console.log("   luxo aqui:", JSON.stringify(luxAway));
  check("o luxo é barato onde nasce", luxAway.price < luxHome.price * 0.75, `${luxAway.price} contra ${luxHome.price}`);
  const bought = await ev(({ id }) => {
    const st = window.__store;
    const s = st.getState();
    st.setState({ gold: 20000 });
    const gold = st.getState().gold;
    const qty = Math.min(12, Math.floor(s.settlements.find((t) => t.id === id).econ.stock.LUXURY));
    const why = st.getState().tradeGood(id, "LUXURY", qty);
    return { why, qty, cost: gold - st.getState().gold, carried: st.getState().freight.filter((l) => l.good === "LUXURY").reduce((n, l) => n + l.qty, 0) };
  }, luxAway);
  console.log("   compra:", JSON.stringify(bought));
  check("compra luxo para levar", bought.why === null && bought.carried > 0, JSON.stringify(bought));

  // Semanas longe: a terra natal segue vivendo, e as notícias vêm depois
  const far = await ev(() => {
    const st = window.__store;
    const before = st.getState().parked.C0.store.settlements.map((t) => t.prosperity).join();
    const size = JSON.stringify(st.getState().parked).length;
    for (let i = 0; i < 8; i++) st.getState().advanceTime(7);
    const s = st.getState();
    return { changed: s.parked.C0.store.settlements.map((t) => t.prosperity).join() !== before, size, news: s.seaNews.length, log: s.log.filter((l) => l.text.startsWith("Notícias de")).length, day: s.day };
  });
  console.log("   longe:", JSON.stringify(far));
  check("a terra natal muda sem o bando", far.changed, JSON.stringify(far));

  // Segundo acampamento: montado aqui, fica aqui
  const pitched = await ev(() => {
    const st = window.__store;
    const w = window.__world;
    const c = w.commander;
    const spot = w.nav.nearestOpen({ x: c.x, y: c.y + 1400 }, 1200) ?? { x: c.x, y: c.y };
    st.getState().pitchCamp({ x: Math.round(spot.x), y: Math.round(spot.y) }, w.captureField());
    return { campAt: st.getState().campAt, packed: st.getState().campPacked };
  });
  await page.waitForTimeout(500);
  await ready(page);
  await page.waitForTimeout(400);
  check("dá para montar um segundo acampamento em ultramar", !!pitched.campAt && pitched.packed === false, JSON.stringify(pitched));

  // Corsários: a IA também vem pelo mar
  const raid = await ev(() => {
    const w = window.__world;
    const real = Math.random;
    Math.random = () => 0.01;
    const before = w.warbands.bands.length;
    w.maybeCorsairs(12);
    Math.random = real;
    const band = w.warbands.bands[w.warbands.bands.length - 1];
    const nearSea = band && [0, 1, 2, 3, 4, 5, 6, 7].some((i) => !w.nav.isOpen({ x: band.anchor.x + Math.cos((i * Math.PI) / 4) * 500, y: band.anchor.y + Math.sin((i * Math.PI) / 4) * 500 }));
    return { spawned: w.warbands.bands.length - before, name: band?.name, goal: band?.goal.kind, nearSea, log: window.__store.getState().log.at(-1)?.text };
  });
  console.log("   corsários:", JSON.stringify(raid));
  check("corsários desembarcam na praia e marcham para um porto", raid.spawned === 1 && raid.goal === "SETTLEMENT" && raid.nearSea, JSON.stringify(raid));

  // Save e carga longe de casa
  const saved = await ev(() => {
    const s = window.__store.getState();
    const why = s.saveGame("1");
    return { why, size: (localStorage.getItem("ascensao-mercenaria.save.1") ?? "").length };
  });
  console.log("   save:", JSON.stringify(saved));
  check("salva longe de casa", saved.why === null, JSON.stringify(saved));
  const loaded = await ev(() => {
    const st = window.__store;
    const why = st.getState().loadGame("1");
    return { why, continent: st.getState().continent, culture: st.getState().world?.culture };
  });
  await page.waitForTimeout(500);
  await ready(page);
  check("carrega longe de casa", loaded.why === null && loaded.culture === landed.culture, JSON.stringify(loaded));

  // A volta
  await ev(() => {
    const st = window.__store;
    const s = st.getState();
    st.setState({ seaNews: [...s.seaNews, { arrives: s.day + 400, text: "A notícia de teste atravessou o mar.", from: s.planet.continents[0].name }] });
  });
  const back = await ev(async () => {
    const st = window.__store;
    let s = st.getState();
    st.setState({ activeContract: null, gold: 20000, rations: 900 });
    s = st.getState();
    const port = s.settlements.find((t) => t.port && t.owner !== "RUINED") ?? s.settlements[0];
    const why = s.embark({ to: "C0", portId: port.id, battalionIds: s.battalions.map((b) => b.id), wagons: s.wagons.length, ship: "COCA" });
    return { why };
  });
  check("embarca de volta", back.why === null, JSON.stringify(back));
  await ev(() => window.__crossing());
  await page.waitForTimeout(400);
  await ready(page);
  await page.waitForTimeout(900);
  const returned = await ev(() => {
    const w = window.__world;
    const s = window.__store.getState();
    return { continent: s.continent, culture: w.world.culture ?? null, name: s.world.name, first: s.settlements[0].name, battalions: s.battalions.map((b) => b.id), field: w.battalions.length, parked: Object.keys(s.parked), camp: s.campPacked, fame: s.fame, wagons: s.wagons.length, explored: w.fog.isExplored(w.commander) };
  });
  console.log("   volta:", JSON.stringify(returned));
  check("voltou para casa, igual ao que era", returned.continent === "C0" && returned.name === home.name && returned.first === home.first, JSON.stringify(returned));
  const told = await ev(() => window.__store.getState().log.slice(-8).map((l) => l.text));
  console.log("   diário na volta:", JSON.stringify(told));
  check("o porto conta o que mudou", told.some((t) => t.includes("A notícia de teste")) && told.some((t) => /semana\(s\) longe/.test(t)), JSON.stringify(told));
  const sold = await ev(({ qty }) => {
    const st = window.__store;
    const s = st.getState();
    // Quem atravessa o mar com luxo vende no porto que paga melhor, não no primeiro da lista
    const open = s.settlements.filter((x) => x.port && x.owner !== "RUINED" && !s.factions.some((f) => f.id === x.owner && f.atWar));
    const t = open.reduce((a, b) => (b.econ.price.LUXURY > a.econ.price.LUXURY ? b : a));
    const gold = s.gold;
    const n = Math.min(qty, s.freight.filter((l) => l.good === "LUXURY").reduce((m, l) => m + l.qty, 0));
    const why = st.getState().tradeGood(t.id, "LUXURY", -n);
    return { why, n, revenue: st.getState().gold - gold, price: Math.round(t.econ.price.LUXURY) };
  }, bought);
  console.log("   venda:", JSON.stringify(sold), "custou", bought.cost);
  // Por peça: os piratas podem ter levado parte da carga no caminho
  const each = { sold: sold.revenue / Math.max(1, sold.n), paid: bought.cost / Math.max(1, bought.qty) };
  check("vender em casa dá lucro", sold.why === null && each.sold > each.paid * 1.3, `${Math.round(each.sold)} contra ${Math.round(each.paid)} por peça`);
  check("quem ficou no cais volta ao bando", returned.battalions.includes(stayId) && returned.field === returned.battalions.length, JSON.stringify(returned));
  check("a terra que ficou para trás é guardada", returned.parked.includes(landed.continent));

  // Abordagem
  const plan = await ev(() => {
    const st = window.__store;
    const s = st.getState();
    const port = s.settlements.find((t) => t.port && t.owner !== "RUINED");
    const to = s.parked && Object.keys(s.parked)[0];
    const why = s.embark({ to, portId: port.id, battalionIds: s.battalions.map((b) => b.id), wagons: 0, ship: "COCA" });
    st.setState({ voyage: { ...st.getState().voyage, pirates: true } });
    return { why, soldiers: st.getState().battalions.reduce((n, b) => n + b.soldiers, 0), gold: st.getState().gold };
  });
  check("velas negras no caminho", plan.why === null, JSON.stringify(plan));
  await page.waitForSelector("button:has-text('Lutar no convés')");
  await page.screenshot({ path: "tests/battle/.shots-piratas.png" });
  await page.click("button:has-text('Lutar no convés')");
  await page.waitForFunction(() => window.__world?.run?.def.boarding && window.__store.getState().battleHud, null, { timeout: 30000 });
  await page.waitForTimeout(1200);
  await page.screenshot({ path: "tests/battle/.shots-conves.png" });
  // Sair daqui jogaria a campanha fora: a pausa do convés só oferece voltar à luta
  await ev(() => window.__store.getState().setScenarioPaused(true));
  await page.waitForSelector("text=Batalha em pausa");
  const exits = await page.locator("button:has-text('Menu principal'), button:has-text('Voltar aos cenários'), button:has-text('Recomeçar')").count();
  check("a pausa do convés não tem saída para o menu", exits === 0, String(exits));
  await ev(() => window.__store.getState().setScenarioPaused(false));
  const deck = await ev(() => {
    const w = window.__world;
    const lab = window.__lab;
    lab.begin();
    lab.parkCommander = () => {};
    const inShip = (p) => p.x > 3300 && p.x < 6300 && p.y > 3200 && p.y < 4060;
    const start = { ours: w.battalions.flatMap((b) => b.soldiers).filter((s) => s.isAlive).length, foes: lab.allEnemies().length };
    let i = 0;
    let crossed = 0;
    lab.step(280, () => {
      if (i++ % 30 === 0) lab.attackNearest();
      crossed = Math.max(crossed, [...w.battalions.flatMap((b) => b.soldiers), ...lab.allEnemies()].filter((u) => u.isAlive && u.x > 4520 && u.x < 5080).length);
    });
    const everyone = [...lab.allEnemies(), ...w.battalions.flatMap((b) => b.soldiers).filter((s) => s.isAlive)];
    const r = window.__store.getState().scenarioResult;
    return { start, crossed, overboard: everyone.filter((u) => !inShip(u)).length, outcome: r?.outcome, reason: r?.reason, killed: r?.enemyKilled, seconds: Math.round(w.run.seconds), left: r?.battalions.map((b) => b.alive) };
  });
  console.log("   convés:", JSON.stringify(deck));
  check("há gente dos dois lados no convés", deck.start.ours > 0 && deck.start.foes >= 10, JSON.stringify(deck.start));
  check("as pranchas ligam os navios", deck.crossed > 0, JSON.stringify(deck));
  check("ninguém anda sobre o mar", deck.overboard === 0, JSON.stringify(deck));
  check("a abordagem chega a um fim", !!deck.outcome, JSON.stringify(deck));
  await page.waitForSelector("button:has-text('Seguir viagem')");
  await page.click("button:has-text('Seguir viagem')");
  await page.waitForTimeout(600);
  const after = await ev(() => {
    const s = window.__store.getState();
    return { boarding: s.boarding !== null, scenario: s.scenario !== null, voyage: !!s.voyage, pirates: s.voyage?.pirates, soldiers: s.battalions.reduce((n, b) => n + b.soldiers, 0), world: s.world?.name, towns: s.settlements.length, gold: s.gold };
  });
  console.log("   depois:", JSON.stringify(after));
  check("a viagem continua depois da abordagem", after.voyage && !after.boarding && !after.scenario && !after.pirates && after.towns > 0, JSON.stringify(after));
  check("quem morreu no convés não volta", after.soldiers < plan.soldiers, JSON.stringify({ antes: plan.soldiers, depois: after.soldiers }));
  await ev(() => window.__crossing());
  await page.waitForTimeout(500);
  await page.waitForFunction(() => window.__store.getState().voyage === null, null, { timeout: 30000 });
  check("e chega ao destino", (await ev(() => window.__store.getState().continent)) !== "C0");
  await page.waitForTimeout(500);
  await ready(page);
  const again = await ev(() => {
    const s = window.__store.getState();
    const c = s.world.camp.center;
    return { campAt: s.campAt, packed: s.campPacked, center: { x: Math.round(c.x), y: Math.round(c.y) } };
  });
  check("o acampamento de ultramar continua lá na volta", !!again.campAt && again.packed === false, JSON.stringify(again));

  // Mapa Múndi pelo teclado
  await page.mouse.move(640, 300);
  await page.keyboard.down("Shift");
  await page.keyboard.press("Tab");
  await page.keyboard.up("Shift");
  await page.waitForSelector("text=Mapa Múndi");
  check("Shift+Tab abre o Mapa Múndi", true);
  await page.screenshot({ path: "tests/battle/.shots-atlas.png" });
}
