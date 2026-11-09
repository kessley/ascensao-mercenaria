/** Legado e Lendas: o Comandante morre, o bando continua, e no fim a história fica escrita. */
const ready = (page) => page.waitForFunction(() => window.__world && !window.__world.run && window.__store.getState().battleHud && !window.__world.scene.isPaused(), null, { timeout: 60000 });

/** Faz o sorteio de `fn` cair sempre no mesmo número. */
const fixed = `window.__fixed = (n, fn) => { const real = Math.random; Math.random = () => n; try { return fn(); } finally { Math.random = real; } };`;

export async function legacy({ page, ev, labScript }, { check }) {
  await ev(() => {
    localStorage.clear();
  });
  await page.reload();
  await page.waitForSelector("nav >> text=Nova campanha");
  check("sem saga terminada, o menu não mostra Lendas", (await page.locator("nav >> text=Lendas").count()) === 0);
  await page.click("nav >> text=Nova campanha");
  await page.waitForSelector("text=Começar campanha");
  await page.click("text=Começar campanha");
  await ready(page);
  await page.waitForTimeout(800);
  await page.evaluate(labScript);
  await page.evaluate(fixed);

  const first = await ev(() => {
    const st = window.__store;
    st.setState({ gold: 900, rations: 900, nextEventDay: 99999, nextCalamityDay: 99999, fame: 40 });
    // Desde o Marco 22 o bando começa sem tenentes (as vagas vêm da tenda dos oficiais): o teste traz um
    const s0 = st.getState();
    if (s0.lieutenants.length === 0) st.setState({ lieutenants: [{ ...s0.lieutenantCandidates[0], battalionId: s0.battalions[0].id }] });
    const s = st.getState();
    return { name: s.leader.name, age: s.leader.age, lieutenants: s.lieutenants.map((l) => ({ id: l.id, name: l.name, traits: l.traits })), maxHp: window.__world.commander.maxHp };
  });
  console.log("   fundador:", JSON.stringify(first));
  check("o Comandante tem nome e idade", first.name.length > 2 && first.age >= 30);
  check("o HUD mostra quem comanda", (await page.locator(`text=Comandante ${first.name}`).count()) > 0);

  // Livro do Bando pelo teclado
  await page.mouse.move(640, 300);
  await page.keyboard.press("l");
  await page.waitForSelector("text=Livro do Bando");
  await page.locator("li", { hasText: "Vencer três calamidades" }).locator("button:has-text('Jurar')").click();
  await page.locator("li", { hasText: first.lieutenants[0].name }).locator("button:has-text('Nomear')").first().click();
  await page.waitForTimeout(150);
  await page.screenshot({ path: "tests/battle/.shots-livro.png" });
  const sworn = await ev(() => {
    const s = window.__store.getState();
    return { ambitions: s.ambitions, heir: s.heirId };
  });
  check("jurar uma ambição", sworn.ambitions.includes("SLAYER"), JSON.stringify(sworn));
  check("escrever o testamento", sworn.heir === first.lieutenants[0].id, JSON.stringify(sworn));
  await ev(() => window.__store.getState().setCampPanel(null));

  // Sobreviver à queda deixa cicatriz
  const scar = await ev(() => {
    const st = window.__store;
    const before = window.__world.commander.maxHp;
    const died = window.__fixed(0.99, () => st.getState().commanderFell("teste"));
    return { died, wounds: st.getState().leader.wounds, before, after: window.__world.commander.maxHp };
  });
  check("quem sobrevive à queda ganha uma cicatriz", !scar.died && scar.wounds === 1, JSON.stringify(scar));
  check("a cicatriz pesa no corpo", scar.after < scar.before, JSON.stringify(scar));

  // Morte em combate de verdade: o bando segue
  const fall = await ev(() => {
    const st = window.__store;
    const w = window.__world;
    window.__fixed(0, () => w.defeat());
    const s = st.getState();
    return { leader: s.leader, former: s.formerLeaders, fame: s.fame, lieutenants: s.lieutenants.length, succession: s.succession, battles: s.battles.length, hp: w.commander.maxHp, report: !!s.battleReport };
  });
  console.log("   sucessão:", JSON.stringify(fall.succession));
  check("o herdeiro é quem está no testamento", fall.leader.name === first.lieutenants[0].name && fall.leader.generation === 2, JSON.stringify(fall.leader));
  check("o herdeiro traz os traços dele", JSON.stringify(fall.leader.traits) === JSON.stringify(first.lieutenants[0].traits));
  check("o herdeiro leva o rosto que tinha (G5)", fall.leader.face === first.lieutenants[0].id && fall.former[0].wounds === 1, JSON.stringify({ face: fall.leader.face, wounds: fall.former[0]?.wounds }));
  check("o morto entra para a história", fall.former.length === 1 && fall.former[0].name === first.name && /caiu em combate (no|na|nas|em) /.test(fall.former[0].cause) && !/em o /.test(fall.former[0].cause), JSON.stringify(fall.former));
  check("sai da lista de tenentes", fall.lieutenants === first.lieutenants.length - 1);
  check("a fama diminui, sem sumir", fall.fame === 30, String(fall.fame));
  check("a batalha entra no livro", fall.battles === 1);
  await ev(() => window.__store.setState({ battleReport: null }));
  await page.waitForSelector("text=ergueu o estandarte");
  await page.screenshot({ path: "tests/battle/.shots-sucessao.png" });
  await page.click(`button:has-text('Seguir sob')`);
  await page.waitForTimeout(400);
  const going = await ev(() => {
    const w = window.__world;
    const s = window.__store.getState();
    return { paused: w.ended, field: w.battalions.length, store: s.battalions.length, ok: w.commander.isAlive, succession: s.succession };
  });
  check("a campanha continua", !going.paused && going.ok && going.succession === null && going.field === going.store, JSON.stringify(going));
  check("o HUD mostra o novo Comandante", (await page.locator(`text=Comandante ${fall.leader.name}`).count()) > 0);

  // Ninguém para herdar
  const none = await ev(() => {
    const st = window.__store;
    st.setState({ lieutenants: [] });
    st.getState().passStandard("teste sem herdeiro");
    const s = st.getState();
    const r = { name: s.leader.name, gen: s.leader.generation, stranger: s.succession?.stranger };
    st.getState().closeSuccession();
    return r;
  });
  check("sem tenentes, a tropa escolhe um veterano", none.stranger === true && none.gen === 3 && none.name.length > 2, JSON.stringify(none));

  // Velhice
  const old = await ev(() => {
    const st = window.__store;
    const s = st.getState();
    st.setState({ leader: { ...s.leader, since: s.day - 800, age: 40 } });
    const age = Math.floor(40 + (800 / 80) * 3);
    window.__fixed(0, () => st.getState().legacyDay(1));
    const after = st.getState();
    const r = { age, cause: after.formerLeaders.at(-1)?.cause, gen: after.leader.generation };
    st.getState().closeSuccession();
    return r;
  });
  console.log("   velhice:", JSON.stringify(old));
  check("a idade cobra a conta", old.gen === 4 && /velho/.test(old.cause ?? ""), JSON.stringify(old));

  // Ambição cumprida
  const sworn2 = await ev(() => {
    const st = window.__store;
    const gold = st.getState().gold;
    st.setState({ calamitiesSlain: 3 });
    st.getState().legacyDay(0);
    const s = st.getState();
    return { done: s.ambitionsDone, active: s.ambitions, gain: s.gold - gold, log: s.log.at(-1)?.text };
  });
  check("cumprir a ambição paga o prêmio", sworn2.done.includes("SLAYER") && sworn2.gain > 0 && sworn2.active.length === 0, JSON.stringify(sworn2));

  // A crônica não esquece
  const book = await ev(() => {
    const st = window.__store;
    for (let i = 0; i < 400; i++) st.getState().chronicle(`Acontecimento de teste número ${i}.`);
    const s = st.getState();
    return { log: s.log.length, annals: s.annals.length, oldest: s.annals.some((e) => e.text.includes("número 0.")), inLog: s.log.some((e) => e.text.includes("número 0.")), first: s.annals[0].text };
  });
  console.log("   crônica:", JSON.stringify(book));
  check("o diário esquece, a crônica não", book.annals > book.log && book.oldest && !book.inLog, JSON.stringify(book));

  await ev(() => window.__store.getState().setLegendsOpen(true));
  await page.waitForSelector("text=Fechar o livro");
  await page.fill("input[aria-label='Procurar na crônica']", "número 7.");
  check("procurar na crônica", (await page.locator("li", { hasText: "número 7." }).count()) === 1);
  await page.click("nav button:has-text('Pessoas')");
  await page.locator("button", { hasText: first.name }).first().click();
  await page.waitForTimeout(150);
  const page1 = await page.locator("main, div").filter({ hasText: "caiu em combate" }).count();
  check("cada pessoa tem sua página", page1 > 0);
  await page.screenshot({ path: "tests/battle/.shots-lendas.png" });
  await page.click("nav button:has-text('Batalhas')");
  await page.click("nav button:has-text('Povoados')");
  await page.click("nav button:has-text('Reinos')");
  await page.click("nav button:has-text('Antes do bando')");
  check("a história anterior ao bando está no livro", (await page.locator("text=/ano \\d+/").count()) > 0);
  await page.click("button:has-text('Fechar o livro')");

  // Save
  const saved = await ev(() => {
    const st = window.__store;
    const why = st.getState().saveGame("3");
    const size = (localStorage.getItem("ascensao-mercenaria.save.3") ?? "").length;
    const gen = st.getState().leader.generation;
    const load = st.getState().loadGame("3");
    const s = st.getState();
    return { why, size, load, gen, after: s.leader.generation, annals: s.annals.length, former: s.formerLeaders.length };
  });
  console.log("   save:", JSON.stringify(saved));
  check("a saga vai no save", saved.why === null && saved.load === null && saved.after === saved.gen && saved.former === 3, JSON.stringify(saved));
  await page.waitForTimeout(600);
  await ready(page);
  await page.waitForTimeout(400);

  // Fim da saga
  const owned = await ev(() => {
    const st = window.__store;
    const s = st.getState();
    const t = s.settlements.find((x) => x.owner !== "RUINED");
    st.setState({ settlements: s.settlements.map((x) => (x.id === t.id ? { ...x, owner: "PLAYER" } : x)) });
    return { town: t.name, band: s.world.bandName, world: s.world.name, year: s.world.year };
  });
  await page.mouse.move(640, 300);
  await page.keyboard.press("l");
  await page.waitForSelector("button:has-text('Encerrar a saga')");
  await page.click("button:has-text('Encerrar a saga')");
  await page.click("button:has-text('Encerrar a saga de vez')");
  await page.waitForSelector("text=Epílogo");
  await page.screenshot({ path: "tests/battle/.shots-epilogo.png" });
  const text = await page.locator("p.font-serif").allInnerTexts();
  console.log("   epílogo:", JSON.stringify(text));
  check("o epílogo conta o bando e os mortos", text.join(" ").includes(owned.band) && text.join(" ").includes(first.name), text.join(" ").slice(0, 200));
  check("o epílogo traz a ambição cumprida", text.join(" ").includes("estandarte deles"));
  check("o epílogo diz onde a bandeira ficou", text.join(" ").includes(owned.town));
  await page.click("button:has-text('Ler as Lendas')");
  await page.waitForSelector("text=Fechar o livro");
  await page.click("button:has-text('Fechar o livro')");
  await page.click("button:has-text('Menu principal')");
  await page.waitForSelector("nav >> text=Lendas");
  await page.click("nav >> text=Lendas");
  await page.waitForSelector("button:has-text('Ler a saga')");
  await page.screenshot({ path: "tests/battle/.shots-sagas.png" });
  await page.click("button:has-text('Ler a saga')");
  await page.waitForSelector("text=Fechar o livro");
  check("a saga terminada pode ser relida no menu", (await page.locator("li", { hasText: "morreu aos" }).count()) > 0);
  await page.click("nav button:has-text('Pessoas')");
  check("com as pessoas dela", (await page.locator("button", { hasText: first.name }).count()) > 0);
  await page.click("button:has-text('Fechar o livro')");

  // Séculos depois
  await page.click("button:has-text('anos depois')");
  await ready(page);
  await page.waitForTimeout(600);
  const later = await ev(() => {
    const s = window.__store.getState();
    const w = s.world;
    return { name: w.name, year: w.year, era: w.era, history: w.history.slice(-4).map((h) => h.text), tomb: w.sites.map((x) => x.name).filter((n) => n.startsWith("Túmulo")), echo: s.echo?.bandName, annals: s.annals.length, gen: s.leader.generation, town: w.settlements.filter((t) => t.description.includes("governaram")).map((t) => t.name) };
  });
  console.log("   séculos depois:", JSON.stringify(later));
  check("é o mesmo mundo", later.name === owned.world, later.name);
  check("séculos depois", later.year >= owned.year + 180, `${owned.year} → ${later.year}`);
  check("o bando antigo está na história", later.history.join(" ").includes(owned.band) && later.echo === owned.band, JSON.stringify(later.history));
  check("o último chefe tem túmulo", later.tomb.length === 1, JSON.stringify(later.tomb));
  check("o povoado lembra quem governou", later.town.includes(owned.town), JSON.stringify(later.town));
  check("é outra campanha", later.gen === 1, String(later.gen));
  const again = await ev(() => {
    const st = window.__store;
    const why = st.getState().saveGame("3");
    const load = st.getState().loadGame("3");
    const w = st.getState().world;
    return { why, load, year: w?.year, tomb: w?.sites.some((x) => x.name.startsWith("Túmulo")) };
  });
  check("o mundo que lembra sobrevive ao save", again.why === null && again.load === null && again.year === later.year && again.tomb, JSON.stringify(again));
}
