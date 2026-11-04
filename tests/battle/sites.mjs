/** Locais de missão sempre habitados (Fase 3, etapa 10), numa campanha de verdade. */
export async function sites({ page, ev }, { check }) {
  await ev(() => localStorage.clear());
  await page.reload();
  await page.waitForSelector("nav >> text=Nova campanha");
  await page.click("nav >> text=Nova campanha");
  await page.waitForSelector("text=Começar campanha");
  await page.click("text=Começar campanha");
  await page.waitForFunction(() => window.__world && !window.__world.run && window.__store.getState().battleHud);
  await page.waitForTimeout(900);

  // Um local com contrato na mesa: primeiro sem aceitar, depois aceitando
  const setup = await ev(() => {
    const st = window.__store;
    const w = window.__world;
    st.setState({ nextEventDay: 99999, nextCalamityDay: 99999 });
    const offer = st.getState().contracts.find((c) => (c.kind ?? "SITE") === "SITE" && c.siteId);
    const site = w.world.sites.find((s) => s.id === offer?.siteId);
    const full = site ? site.groups.reduce((n, g) => n + g.units.reduce((m, [, k]) => m + k, 0), 0) : 0;
    const atStart = w.enemies.filter((e) => e.isAlive && e.owner?.kind === "SITE").length;
    return { offerId: offer?.id ?? null, siteId: site?.id ?? null, name: site?.name ?? "", center: site?.center ?? null, full, atStart };
  });
  check("há um contrato de local na mesa", !!setup.offerId && !!setup.siteId, JSON.stringify(setup));
  if (!setup.siteId) return;
  check("no acampamento, longe de tudo, nenhum morador no mapa", setup.atStart === 0, JSON.stringify(setup));

  /** Leva o Comandante (sozinho) para perto do local, sem acordar os moradores. */
  const goNear = (dx) =>
    ev(
      ({ c, dx }) => {
        const w = window.__world;
        w.commander.x = c.x + dx;
        w.commander.y = c.y;
        for (const b of w.battalions) b.teleportTo({ x: w.world.camp.center.x, y: w.world.camp.center.y });
      },
      { c: setup.center, dx },
    );
  const residents = () =>
    ev((id) => {
      const w = window.__world;
      const list = w.siteResidents.members(id);
      return { n: list.length, kinds: [...new Set(list.map((e) => e.kind))], fill: window.__store.getState().siteLife[id]?.fill ?? null };
    }, setup.siteId);

  await goNear(2200);
  await page.waitForTimeout(400);
  const first = await residents();
  check("sem contrato, o local tem moradores", first.n > 0, JSON.stringify(first));
  check("os moradores são menos que a força do contrato", first.n < setup.full, `${first.n} de ${setup.full}`);
  check("os moradores não têm chefe (o chefe vem com o contrato)", !first.kinds.some((k) => k.includes("CHIEF")), first.kinds.join(","));
  const saved = await ev(() => {
    const f = window.__world.captureField();
    return typeof f === "string" ? f : f.enemies.filter((e) => e.owner?.kind === "SITE").length;
  });
  check("os moradores não vão no save (o store guarda quantos são)", saved === 0, String(saved));

  // Cai um: o número baixa
  await ev((id) => {
    const w = window.__world;
    const [e] = w.siteResidents.members(id);
    e.takeDamage(e.hp + 999, w.commander, w.time.now);
  }, setup.siteId);
  await page.waitForTimeout(300);
  const one = await residents();
  check("cada morador que cai baixa o número do local", one.fill !== null && one.fill < 1 && one.n === first.n - 1, JSON.stringify(one));

  // Caem todos: o local fica limpo
  await ev((id) => {
    const w = window.__world;
    for (const e of w.siteResidents.members(id)) e.takeDamage(e.hp + 999, w.commander, w.time.now);
  }, setup.siteId);
  await page.waitForTimeout(1500);
  const clean = await ev((id) => {
    const s = window.__store.getState();
    return { life: s.siteLife[id], logged: s.log.some((l) => l.text.includes("está limpo")) };
  }, setup.siteId);
  check("limpo, o local fica vazio e o diário anota", clean.life?.fill === 0 && clean.logged, JSON.stringify(clean));

  // Vai embora e volta logo: ninguém
  await goNear(9000);
  await page.waitForTimeout(400);
  await goNear(2200);
  await page.waitForTimeout(400);
  const soon = await residents();
  check("voltando logo, o local continua vazio", soon.n === 0, JSON.stringify(soon));

  // Dias depois, voltou a encher
  await goNear(9000);
  await ev(() => {
    const st = window.__store;
    st.setState({ day: st.getState().day + 20 });
  });
  await page.waitForTimeout(400);
  await goNear(2200);
  await page.waitForTimeout(400);
  const back = await residents();
  check("dias depois, o local voltou a ter gente", back.n === first.n, `${back.n} de ${first.n}`);

  // Com o contrato: a força inteira e o chefe, no lugar dos moradores
  const taken = await ev((id) => window.__store.getState().acceptContract(id), setup.offerId);
  await page.waitForTimeout(500);
  const contract = await ev((id) => {
    const w = window.__world;
    const units = w.contractEnemies.filter((e) => e.isAlive);
    return { residents: w.siteResidents.members(id).length, n: units.length, chief: units.some((e) => e.kind.includes("CHIEF") || e.kind === "DEATH_KNIGHT" || e.kind === "SERGEANT") };
  }, setup.siteId);
  check("com contrato, os moradores saem do mapa", taken && contract.residents === 0, JSON.stringify(contract));
  check("com contrato, o local vem mais forte e com o chefe", contract.n > first.n && contract.chief, JSON.stringify(contract));
}
