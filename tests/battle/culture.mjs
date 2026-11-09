/**
 * Marco 23: cultura, religião e língua. A parte 1 (a gente de cada lugar): de onde vem cada um
 * no bando, quem se alista, o povoado governado por gente de fora e o que a interface mostra.
 * As fotos ficam em `tests/battle/.shots-m23-*.png`.
 */
const ready = (page) => page.waitForFunction(() => window.__world && !window.__world.run && window.__store.getState().battleHud && !window.__world.scene.isPaused(), null, { timeout: 60000 });

export async function culture({ page, ev }, { check }) {
  await ev(() => localStorage.clear());
  await page.reload();
  await page.waitForSelector("nav >> text=Nova campanha");
  await page.click("nav >> text=Nova campanha");
  await page.waitForSelector("text=Começar campanha");
  await page.click("text=Começar campanha");
  await ready(page);
  await page.waitForTimeout(800);

  // --- 14.1: a gente de cada lugar ---
  const start = await ev(() => {
    const s = window.__store.getState();
    return {
      land: s.world.culture ?? "REALMS",
      band: s.battalions.map((b) => b.culture ?? "REALMS"),
      leader: s.leader.culture ?? "REALMS",
      officers: [...s.lieutenantCandidates, ...s.captainCandidates].map((o) => o.culture ?? null),
    };
  });
  console.log("   começo:", JSON.stringify(start));
  check("o bando começa todo da terra natal", start.band.every((c) => c === "REALMS") && start.leader === "REALMS", JSON.stringify(start));
  check("cada candidato a oficial tem a origem guardada", start.officers.length > 0 && start.officers.every((c) => typeof c === "string"), JSON.stringify(start.officers));

  // Na taverna de um porto, quem assina é da gente de lá
  const hire = await ev(() => {
    const st = window.__store;
    const s = st.getState();
    const t = s.settlements.find((x) => x.port && x.owner !== "RUINED") ?? s.settlements.find((x) => x.owner !== "RUINED");
    st.setState({ gold: 5000 });
    const problem = st.getState().hireAtTavern(t.id);
    const b = st.getState().battalions.at(-1);
    return { town: t.name, problem, culture: b.culture ?? null };
  });
  console.log("   taverna:", JSON.stringify(hire));
  check("quem se alista guarda de onde veio", !hire.problem && typeof hire.culture === "string", JSON.stringify(hire));

  // Um povoado do bando, e um Comandante de outra terra
  const rule = await ev(() => {
    const st = window.__store;
    const s = st.getState();
    const t = s.settlements.find((x) => x.owner !== "RUINED" && x.owner !== "PLAYER" && x.kind === "CITY") ?? s.settlements.find((x) => x.owner !== "RUINED");
    st.setState({ settlements: s.settlements.map((x) => (x.id === t.id ? { ...x, owner: "PLAYER", loyalty: 70 } : x)) });
    const day = (culture) => {
      const before = st.getState();
      st.setState({ leader: { ...before.leader, culture }, settlements: before.settlements.map((x) => (x.id === t.id ? { ...x, loyalty: 70 } : x)) });
      st.getState().advanceTime(1);
      return st.getState().settlements.find((x) => x.id === t.id).loyalty;
    };
    const home = day("REALMS");
    const stranger = day("JADE");
    return { id: t.id, home, stranger };
  });
  console.log("   lealdade:", JSON.stringify(rule));
  check("povoado governado por gente de fora perde lealdade", rule.stranger < rule.home, JSON.stringify(rule));
  await ev((id) => window.__store.getState().setCampPanel({ kind: "TOWN", settlementId: id }), rule.id);
  await page.waitForTimeout(500);
  const folk = await ev(() => document.querySelector("[data-folk]")?.textContent ?? null);
  check("o painel do povoado mostra a gente e o descontento", !!folk && /gente dos reinos/.test(folk) && /governada por gente de fora/.test(folk), folk);
  await page.screenshot({ path: "tests/battle/.shots-m23-povoado.png" });

  // A tenda mostra de onde vem cada batalhão
  await ev(() => {
    const st = window.__store;
    st.setState({ leader: { ...st.getState().leader, culture: "REALMS" } });
    st.getState().setCampPanel({ kind: "TENT" });
  });
  await page.waitForTimeout(500);
  const origins = await ev(() => [...document.querySelectorAll("[data-origin]")].map((e) => e.dataset.origin));
  check("a tenda mostra a origem de cada batalhão", origins.length >= 2, JSON.stringify(origins));
  await ev(() => document.querySelector("[data-origin]")?.scrollIntoView({ block: "center" }));
  await page.waitForTimeout(300);
  await page.screenshot({ path: "tests/battle/.shots-m23-tenda.png" });
  await ev(() => window.__store.getState().setCampPanel(null));

  // --- 14.2: as fés ---
  const hiredFaith = await ev(() => window.__store.getState().battalions.at(-1).faith ?? null);
  check("quem se alista guarda a fé", typeof hiredFaith === "string", String(hiredFaith));

  // Um combate no dia santo da Chama, com mortos no campo
  const holy = await ev(() => {
    const st = window.__store;
    const s = st.getState();
    const b = s.battalions[0];
    st.setState({ day: 17, faithFavor: {}, unburied: null, battleReport: null, battalions: s.battalions.map((x) => ({ ...x, culture: "REALMS", faith: "FLAME", soldiers: 8 })) });
    const c = window.__world.commander;
    st.getState().resolveEngagement("VICTORY", [{ id: b.id, survivors: 2 }], { deadScoutIds: [], deadMessengerIds: [], deliveries: {} }, { title: "Teste das fés", enemiesKilled: 2, contractDone: false, mutinyOver: false, notes: [], at: { x: c.x, y: c.y } });
    const after = st.getState();
    return { favor: after.faithFavor.FLAME ?? 0, unburied: after.unburied, notes: after.battleReport?.notes ?? [] };
  });
  console.log("   dia santo:", JSON.stringify(holy));
  check("lutar no dia santo custa o favor do templo", holy.favor < 0 && holy.notes.some((n) => /dia santo/.test(n)), JSON.stringify(holy));
  check("os mortos ficam esperando enterro", !!holy.unburied && holy.unburied.dead > 0 && holy.unburied.faiths.includes("FLAME"), JSON.stringify(holy.unburied));
  await page.waitForSelector("text=Enterrar os mortos e seguir");
  const hudHoly = await ev(() => document.querySelector("[data-faith-today]")?.textContent ?? null);
  check("o HUD avisa do dia santo", !!hudHoly && /Dia santo da Chama/.test(hudHoly), String(hudHoly));
  await page.screenshot({ path: "tests/battle/.shots-m23-fes-relatorio.png" });
  const clock = await ev(() => window.__store.getState().day + window.__store.getState().dayProgress);
  await page.click("text=Enterrar os mortos e seguir");
  await page.waitForTimeout(300);
  const buried = await ev(() => {
    const s = window.__store.getState();
    return { unburied: s.unburied, favor: s.faithFavor.FLAME ?? 0, clock: s.day + s.dayProgress, report: !!s.battleReport };
  });
  check("enterrar os mortos leva horas e o templo agradece", !buried.unburied && !buried.report && buried.favor > holy.favor && buried.clock > clock + 0.2, JSON.stringify({ ...buried, before: clock }));

  // O jejum das Estrelas: um batalhão do Véu, e as fés que brigam
  await ev(() => {
    const st = window.__store;
    const s = st.getState();
    st.setState({ day: 16, battalions: s.battalions.map((x, i) => (i === 0 ? { ...x, culture: "SANDS", faith: "VEIL", soldiers: 8 } : { ...x, soldiers: 8 })) });
    st.getState().setCampPanel({ kind: "TENT" });
  });
  await page.waitForSelector("[data-faith-panel]");
  await ev(() => document.querySelector("[data-faith-panel]")?.scrollIntoView({ block: "start" }));
  await page.waitForTimeout(300);
  const panel = await ev(() => ({
    faiths: [...document.querySelectorAll("[data-faith-mix] [data-faith]")].map((e) => e.dataset.faith),
    breakFast: !!document.querySelector('[data-break-fast="VEIL"]'),
    friction: document.querySelector("[data-friction]")?.textContent ?? null,
  }));
  console.log("   painel:", JSON.stringify(panel));
  check("a tenda mostra as fés do bando e o jejum", panel.faiths.includes("VEIL") && panel.faiths.includes("FLAME") && panel.breakFast, JSON.stringify(panel));
  check("a tenda avisa das fés que brigam", !!panel.friction && /Chama Eterna e Véu das Estrelas/.test(panel.friction), String(panel.friction));
  await page.screenshot({ path: "tests/battle/.shots-m23-fes-tenda.png" });
  await page.click('[data-break-fast="VEIL"]');
  await page.waitForTimeout(200);
  const broke = await ev(() => {
    const s = window.__store.getState();
    return { broken: s.fastBroken, favor: s.faithFavor.VEIL ?? 0, button: !!document.querySelector('[data-break-fast="VEIL"]') };
  });
  check("quebrar o jejum custa o favor do templo", broke.broken.length === 1 && broke.favor < 0 && !broke.button, JSON.stringify(broke));

  // A festa do Véu, no dia seguinte ao jejum
  const feast = await ev(() => {
    const st = window.__store;
    st.setState({ day: 19, rations: 500 });
    const before = st.getState().log.length;
    st.getState().advanceTime(1);
    const s = st.getState();
    return { day: s.day, lines: s.log.slice(before - s.log.length).map((l) => l.text).filter((t) => /Noite das Estrelas/.test(t)) };
  });
  check("a festa de cada fé", feast.lines.length === 1 && /comem e bebem/.test(feast.lines[0]), JSON.stringify(feast));

  // O templo de cada povoado, e a esmola que o templo lembra
  const temple = await ev(() => {
    const st = window.__store;
    const s = st.getState();
    const t = s.settlements.find((x) => x.owner !== "RUINED" && x.owner !== "PLAYER");
    st.getState().setCampPanel({ kind: "TOWN", settlementId: t.id });
    return { id: t.id };
  });
  await page.waitForTimeout(300);
  const templeFaith = await ev(() => document.querySelector("[data-temple]")?.dataset.temple ?? null);
  const gave = await ev(
    ({ id, faith }) => {
      const st = window.__store;
      const before = st.getState().faithFavor[faith] ?? 0;
      st.setState({ gold: 1000 });
      st.getState().donateTemple(id, 100);
      return { before, after: st.getState().faithFavor[faith] ?? 0 };
    },
    { id: temple.id, faith: templeFaith },
  );
  check("cada povoado tem templo, e a esmola fica na memória dele", !!templeFaith && gave.after > gave.before, JSON.stringify({ templeFaith, ...gave }));
  await ev(() => window.__store.getState().setCampPanel(null));

  // O exército marcha para longe dos mortos sem enterrá-los
  await page.waitForTimeout(400);
  await ev(() => {
    const st = window.__store;
    const c = window.__world.commander;
    st.setState({ unburied: { x: c.x + 6000, y: c.y, day: st.getState().day, dead: 3, faiths: ["FLAME"] }, battleReport: null });
  });
  const left = await page
    .waitForFunction(() => window.__store.getState().unburied === null, null, { timeout: 10000 })
    .then(() => true)
    .catch(() => false);
  const leftLine = await ev(() => window.__store.getState().log.at(-1)?.text ?? "");
  check("quem marcha sem enterrar os mortos paga com o humor", left && /sem enterro/.test(leftLine), leftLine);
}
