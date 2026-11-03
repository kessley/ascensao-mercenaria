/** Diário de missões, contrato passo a passo e expedições, jogando uma campanha de verdade. */
export async function missions({ page, ev }, { check }) {
  await ev(() => localStorage.clear());
  await page.reload();
  await page.waitForSelector("nav >> text=Nova campanha");
  await page.click("nav >> text=Nova campanha");
  await page.waitForSelector("text=Começar campanha");
  await page.click("text=Começar campanha");
  await page.waitForFunction(() => window.__world && !window.__world.run && window.__store.getState().battleHud);
  await page.waitForTimeout(900);

  // Uma escolta de verdade na mesa, com saída e chegada
  const setup = await ev(() => {
    const st = window.__store;
    const s = st.getState();
    st.setState({ gold: 900, rations: 900, nextEventDay: 99999, nextCalamityDay: 99999 });
    const towns = s.settlements.filter((t) => t.owner !== "RUINED");
    const graph = (a, b) => a.id !== b.id && Math.hypot(a.x - b.x, a.y - b.y) < 9000;
    const from = towns[0];
    const to = towns.find((t) => graph(from, t)) ?? towns[1];
    const offer = {
      id: "teste-escolta",
      kind: "ESCORT",
      title: `Escoltar a caravana até ${to.name}`,
      client: `Guilda dos Mercadores de ${from.name}`,
      clientId: from.id,
      description: "Teste.",
      siteId: "",
      difficulty: 1,
      travelDays: 2,
      advance: 25,
      reward: 150,
      fromId: from.id,
      targetId: to.id,
    };
    st.setState({ contracts: [offer, ...s.contracts.filter((c) => c.kind !== "ESCORT")] });
    return { from: from.name, to: to.name };
  });

  // A mesa de contratos mostra de onde sai e para onde vai
  await ev(() => window.__store.getState().setCampPanel({ kind: "TENT" }));
  await page.waitForSelector("text=Mesa estratégica");
  const card = page.locator("article", { hasText: setup.to }).first();
  const text = await card.innerText();
  check("a oferta diz de onde a caravana sai", text.includes(`Vá ao portão de ${setup.from}`), text.slice(0, 160));
  check("a oferta diz para onde ela vai", text.includes(`até ${setup.to}`));
  check("a oferta tem minimapa da rota", (await card.locator("canvas").count()) === 1);
  check("a oferta oferece Enviar tropas", (await card.locator("button:has-text('Enviar tropas')").count()) === 1);
  await page.screenshot({ path: "tests/battle/.shots-mesa.png" });

  // Enviar tropas
  await card.locator("button:has-text('Enviar tropas')").click();
  await page.waitForSelector("text=Quem vai?");
  check("sem ninguém marcado, não dá para enviar", await card.locator("button:has-text('Enviar tropas')").isDisabled());
  await card.locator("input[type=checkbox]").first().check();
  await page.waitForSelector("text=Chance de cumprir");
  await page.screenshot({ path: "tests/battle/.shots-envio.png" });
  const before = await ev(() => {
    const s = window.__store.getState();
    return { gold: s.gold, rations: s.rations, battalions: s.battalions.length };
  });
  await card.locator("button:has-text('Enviar tropas')").click();
  await page.waitForTimeout(200);
  // Com o painel aberto o mundo está parado: o campo acerta as contas ao fechar
  await ev(() => window.__store.getState().setCampPanel(null));
  await page.waitForTimeout(500);
  const sent = await ev(() => {
    const s = window.__store.getState();
    return { gold: s.gold, rations: s.rations, battalions: s.battalions.length, away: s.expeditions.length, returnDay: s.expeditions[0]?.returnDay, field: window.__world.battalions.length, offered: s.contracts.some((c) => c.id === "teste-escolta") };
  });
  check("as tropas saem do campo", sent.battalions === before.battalions - 1 && sent.field === sent.battalions && sent.away === 1, JSON.stringify(sent));
  check("paga o adiantamento e gasta rações", sent.gold === before.gold + 25 && sent.rations < before.rations, JSON.stringify(sent));
  check("o contrato sai da mesa", !sent.offered);

  // Sair de verdade: a coluna marcha de onde a tropa estava, com o tempo correndo mesmo no acampamento
  const march = await ev(async () => {
    const w = window.__world;
    const s = window.__store.getState();
    const e = s.expeditions[0];
    const entry = w.parties.get(e.id);
    const at = entry ? { x: entry.party.x, y: entry.party.y } : null;
    const clock = s.day + s.dayProgress;
    await new Promise((r) => setTimeout(r, 2500));
    const n = window.__store.getState();
    return { path: e.path?.length ?? 0, meet: e.meet, from: e.path?.[0], at, then: entry ? { x: entry.party.x, y: entry.party.y } : null, camp: w.inCamp, clock, later: n.day + n.dayProgress };
  });
  console.log("   coluna:", JSON.stringify(march));
  check("a tropa vira uma coluna em campo", !!march.at, JSON.stringify(march));
  check("a rota sai de onde a tropa estava e passa pela saída da caravana", march.path >= 2 && march.meet >= 1, JSON.stringify(march));
  check("o relógio corre com a tropa fora", march.later > march.clock, JSON.stringify(march));
  check("a coluna anda", march.at && Math.hypot(march.then.x - march.at.x, march.then.y - march.at.y) > 5, JSON.stringify(march));
  const away = await page.locator("button", { hasText: "volta em" }).first().innerText();
  check("o HUD mostra quem saiu e o que está fazendo", away.includes("a caminho de") || away.includes("escoltando"), away);
  await page.screenshot({ path: "tests/battle/.shots-coluna.png" });

  // Diário
  await page.mouse.move(640, 200);
  await page.keyboard.press("j");
  await page.waitForSelector("text=Tropas em missão");
  check("J abre o diário de missões", true);
  check("o diário mostra quem está fora e quando volta", (await page.locator("li >> text=/volta em \\d+ dia/").count()) === 1);
  check("o diário mostra a tropa no mapa da rota", (await page.locator("li canvas").count()) === 1);
  await page.keyboard.press("j");
  await page.waitForTimeout(200);
  await page.keyboard.press("Tab");
  await page.waitForSelector("text=tropa em missão");
  check("a legenda do mapa explica a tropa em missão", true);
  await page.keyboard.press("Tab");
  await page.waitForTimeout(200);
  await page.keyboard.press("j");
  await page.waitForSelector("text=Tropas em missão");
  await page.screenshot({ path: "tests/battle/.shots-diario.png" });
  await page.keyboard.press("j");
  await page.waitForTimeout(200);

  // O tempo passa: voltam e prestam contas
  await ev((day) => window.__world.passTime(day), sent.returnDay + 1 - (await ev(() => window.__store.getState().day)));
  await page.waitForTimeout(500);
  const back = await ev(() => {
    const s = window.__store.getState();
    return { away: s.expeditions.length, reports: s.expeditionReports, battalions: s.battalions.length, field: window.__world.battalions.length };
  });
  const r = back.reports[0];
  check("a expedição volta e presta contas", back.away === 0 && !!r, JSON.stringify(back));
  check("quem sobreviveu volta ao campo", r && (r.lost.length > 0 || (back.battalions === before.battalions && back.field === back.battalions)), JSON.stringify(back));

  // Contrato do Comandante: passos na faixa do HUD
  const accepted = await ev(() => {
    const st = window.__store;
    const s = st.getState();
    const site = s.contracts.find((c) => (c.kind ?? "SITE") === "SITE") ?? null;
    const towns = s.settlements.filter((t) => t.owner !== "RUINED");
    const c = {
      ...(site ?? {}),
      id: "teste-2",
      kind: "ESCORT",
      title: "Escolta do Comandante",
      client: "Guilda",
      clientId: towns[0].id,
      description: "Teste.",
      siteId: "",
      difficulty: 1,
      travelDays: 2,
      advance: 10,
      reward: 90,
      fromId: towns[0].id,
      targetId: towns[1].id,
    };
    st.setState({ contracts: [c, ...s.contracts] });
    st.getState().acceptContract("teste-2");
    return { from: towns[0].name, active: !!st.getState().activeContract };
  });
  await page.waitForTimeout(600);
  check("aceitar o contrato funciona", accepted.active);
  const banner = await page.locator("button", { hasText: "Escolta do Comandante" }).first().innerText();
  check("a faixa do HUD diz o próximo passo e para que lado", banner.includes(`portão de ${accepted.from}`) && /dia\(s\) (a|ao) /.test(banner), banner);
  await page.locator("button", { hasText: "Escolta do Comandante" }).first().click();
  await page.waitForSelector("text=Com o Comandante");
  check("clicar na faixa abre o diário", true);
  await page.screenshot({ path: "tests/battle/.shots-ativo.png" });
  await ev(() => window.__store.getState().setCampPanel(null));

  // Visão: arqueiros enxergam além do próprio alcance
  const sight = await ev(() => {
    const w = window.__world;
    const s = w.visionSources();
    return { max: Math.max(...s.map((x) => x.radius)), range: 230 };
  });
  check("tropa enxerga bem além do alcance do arco", sight.max > sight.range * 1.5, JSON.stringify(sight));
}
