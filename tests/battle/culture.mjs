/**
 * Marco 23: cultura, religião e língua. A parte 1 (a gente de cada lugar): de onde vem cada um
 * no bando, quem se alista, o povoado governado por gente de fora e o que a interface mostra.
 * A parte 2 (as fés): os preceitos, o atrito e os templos. A parte 3 (as línguas): quem fala pelo
 * bando, o preço, os boatos, os contratos, os presos, o intérprete, o aprendizado e as ordens.
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

  // --- 14.3: as línguas ---
  const tongues = await ev(() => {
    const s = window.__store.getState();
    return [...s.lieutenantCandidates, ...s.captainCandidates].map((o) => o.tongues ?? null);
  });
  check("cada candidato a oficial sabe as línguas que fala", tongues.length > 0 && tongues.every((t) => Array.isArray(t) && t.length >= 1), JSON.stringify(tongues));

  // Um Comandante de Jade nos reinos: ninguém no bando fala a língua daqui
  const town = await ev(() => {
    const st = window.__store;
    const s = st.getState();
    const t = s.settlements.find((x) => x.owner !== "RUINED" && x.owner !== "PLAYER" && !s.factions.some((f) => f.id === x.owner && f.atWar) && x.econ);
    const only = (o) => ({ ...o, culture: "REALMS", tongues: ["REALMS"] });
    st.setState({ leader: { ...s.leader, culture: "JADE", tongues: {} }, followers: s.followers.filter((f) => f.role !== "INTERPRETER"), lieutenants: s.lieutenants.map(only), captains: s.captains.map(only) });
    return { id: t.id, name: t.name };
  });
  await ev((id) => window.__store.getState().setCampPanel({ kind: "TOWN", settlementId: id }), town.id);
  await page.waitForSelector("[data-tongue]");
  const deaf = await ev(() => {
    const e = document.querySelector("[data-tongue]");
    return { tongue: e?.dataset.tongue, voice: e?.dataset.voice, text: e?.textContent ?? "", market: document.querySelector("[data-market-barrier]")?.dataset.marketBarrier ?? null };
  });
  console.log("   sem a língua:", JSON.stringify(deaf));
  check("o povoado diz a língua de lá e que ninguém no bando a fala", deaf.tongue === "REALMS" && deaf.voice === "NONE" && /ninguém no bando fala/.test(deaf.text), JSON.stringify(deaf));
  await page.screenshot({ path: "tests/battle/.shots-m23-lingua-povoado.png" });

  // O preço: a mesma compra, com e sem quem fale a língua
  const prices = await ev((id) => {
    const st = window.__store;
    const buy = (culture) => {
      const s = st.getState();
      const t = s.settlements.find((x) => x.id === id);
      const good = ["LUXURY", "ARMS", "CLOTH", "IRON"].find((g) => t.econ.stock[g] >= 1) ?? "IRON";
      st.setState({ gold: 5000, leader: { ...s.leader, culture } });
      const econ = t.econ;
      const freight = s.freight;
      const problem = st.getState().tradeGood(id, good, 1);
      const paid = 5000 - st.getState().gold;
      st.setState({ freight, settlements: st.getState().settlements.map((x) => (x.id === id ? { ...x, econ } : x)) });
      return { good, problem, paid };
    };
    const home = buy("REALMS");
    const lost = buy("JADE");
    return { home, lost };
  }, town.id);
  console.log("   preços:", JSON.stringify(prices));
  check("sem a língua, o mercador cobra mais", !prices.home.problem && !prices.lost.problem && prices.lost.paid > prices.home.paid, JSON.stringify({ ...prices, market: deaf.market }));

  // Os boatos chegam truncados ao Comandante que não entende a língua
  const rumor = await ev(() => {
    const st = window.__store;
    const s = st.getState();
    const c = window.__world.commander;
    const text = "Os mercadores dizem que o rio vai transbordar na semana que vem e levar as pontes.";
    st.setState({ commanderAt: { x: Math.round(c.x), y: Math.round(c.y) }, rumors: [...s.rumors, { id: 987654, day: s.day, x: Math.round(c.x), y: Math.round(c.y), text, tone: "info" }] });
    const before = st.getState().log.length;
    st.getState().advanceTime(1);
    const after = st.getState().log;
    const line = after.slice(before - after.length).map((l) => l.text).find((t) => /^Chegou/.test(t) && /pontes|transbordar|\w+/.test(t) && t.length > 40 && !/Comércio/.test(t)) ?? null;
    return { text, line, heard: after.slice(before - after.length).map((l) => l.text).filter((t) => /^Chegou/.test(t)) };
  });
  console.log("   boato:", JSON.stringify(rumor.heard));
  const garbled = rumor.heard.find((t) => /mercadores|rio|semana|pontes/.test(t) || t.length > 60) ?? null;
  check("sem a língua, o boato chega truncado", !!garbled && !garbled.includes(rumor.text), JSON.stringify(rumor.heard));

  // Os contratos vêm sem detalhe
  await ev(() => window.__store.getState().setCampPanel({ kind: "TENT" }));
  await page.waitForTimeout(400);
  const vague = await ev(() => ({ contracts: window.__store.getState().contracts.length, vague: document.querySelectorAll("[data-contract-vague]").length }));
  check("sem a língua, os contratos vêm com menos detalhe", vague.contracts === 0 || vague.vague > 0, JSON.stringify(vague));
  if (vague.vague > 0) {
    await ev(() => document.querySelector("[data-contract-vague]")?.scrollIntoView({ block: "center" }));
    await page.waitForTimeout(200);
    await page.screenshot({ path: "tests/battle/.shots-m23-lingua-contrato.png" });
  }

  // O preso que ninguém entende diz menos
  const question = await ev(() => {
    const st = window.__store;
    const s = st.getState();
    const f = s.factions.find((x) => !s.passLetters.includes(x.id));
    const officer = (id) => ({ id, name: "Rodrigo o Calvo", factionId: f.id, nobleId: null, ransom: 50, day: s.day, questioned: false });
    st.setState({ captiveOfficers: [...s.captiveOfficers, officer("preso-1"), officer("preso-2")] });
    const deafAnswer = st.getState().officerChoice("preso-1", "QUESTION");
    const lettersAfterDeaf = st.getState().passLetters.includes(f.id);
    return { faction: f.id, deafAnswer, lettersAfterDeaf };
  });
  check("o preso que ninguém entende diz menos (sem a senha dos portões)", /ninguém no bando sabe/.test(question.deafAnswer) && !question.lettersAfterDeaf, JSON.stringify(question));

  // O intérprete, contratado na taverna
  await ev((id) => window.__store.getState().setCampPanel({ kind: "TAVERN", settlementId: id }), town.id);
  await page.waitForSelector("[data-hire-interpreter]");
  const offered = await ev(() => document.querySelector("[data-hire-interpreter]")?.dataset.hireInterpreter ?? null);
  await page.screenshot({ path: "tests/battle/.shots-m23-lingua-taverna.png" });
  await page.click("[data-hire-interpreter]");
  await page.waitForTimeout(300);
  const hired = await ev(() => {
    const s = window.__store.getState();
    const f = s.followers.find((x) => x.role === "INTERPRETER");
    return f ? { name: f.name, tongue: f.tongue } : null;
  });
  check("a taverna oferece um intérprete da língua de lá", offered === "REALMS" && hired?.tongue === "REALMS", JSON.stringify({ offered, hired }));
  await ev((id) => window.__store.getState().setCampPanel({ kind: "TOWN", settlementId: id }), town.id);
  await page.waitForSelector("[data-tongue]");
  const helped = await ev(() => {
    const e = document.querySelector("[data-tongue]");
    return { voice: e?.dataset.voice, text: e?.textContent ?? "", market: !!document.querySelector("[data-market-barrier]") };
  });
  check("com o intérprete, ele fala pelo bando e o preço volta", helped.voice === "INTERPRETER" && helped.text.includes(hired?.name ?? "?") && !helped.market, JSON.stringify(helped));
  const fluent = await ev(() => {
    const st = window.__store;
    const answer = st.getState().officerChoice("preso-2", "QUESTION");
    return { answer };
  });
  check("com o intérprete, o preso conta tudo", /falou:/.test(fluent.answer) && (await ev((f) => window.__store.getState().passLetters.includes(f), question.faction)), JSON.stringify(fluent));

  // O Comandante aprende a língua com o tempo (mais depressa com o intérprete ao lado)
  const learn = await ev(() => {
    const st = window.__store;
    const before = st.getState().log.length;
    st.getState().languageDay(25);
    const s = st.getState();
    return { realms: s.leader.tongues?.REALMS ?? 0, lines: s.log.slice(before - s.log.length).map((l) => l.text) };
  });
  check("o Comandante aprende a língua do lugar com o tempo", learn.realms >= 30 && learn.lines.some((t) => /entende o básico/.test(t)), JSON.stringify(learn));
  await ev(() => window.__store.getState().setCampPanel({ kind: "SAGA" }));
  await page.waitForSelector("[data-leader-tongues]");
  const saga = await ev(() => document.querySelector("[data-leader-tongues]")?.textContent ?? "");
  check("a saga mostra as línguas do Comandante", /jade \(a dele\)/.test(saga) && /reinos \(o básico/.test(saga), saga);
  await ev(() => window.__store.getState().setCampPanel(null));

  // As falas de um povoado: o intérprete traduz; sem ele, chegam palavras de lá
  const said = "Os caminhos do norte andam cheios de salteadores, mercenário. Cuidado com a ponte velha.";
  const talk = await ev(async ({ id, said }) => {
    const w = window.__world;
    w.scene.launch("InteriorScene", { key: `town:${id}:tavern`, title: "Taverna" });
    await new Promise((r) => setTimeout(r, 1500));
    const scene = w.scene.get("InteriorScene");
    const read = () => ({ text: document.querySelector("[data-dialog] p")?.textContent ?? null, tongue: document.querySelector("[data-dialog-tongue]")?.textContent ?? null });
    scene.say("Taberneiro", { text: said });
    await new Promise((r) => setTimeout(r, 300));
    const helped = read();
    const st = window.__store;
    const keep = st.getState().followers;
    st.setState({ followers: keep.filter((f) => f.role !== "INTERPRETER") });
    scene.say("Taberneiro", { text: said });
    await new Promise((r) => setTimeout(r, 300));
    const alone = read();
    st.setState({ followers: keep });
    return { helped, alone };
  }, { id: town.id, said });
  console.log("   falas:", JSON.stringify(talk));
  check("com o intérprete, a fala chega inteira e diz quem traduz", talk.helped.text === said && /[ao] intérprete, traduz/.test(talk.helped.tongue ?? ""), JSON.stringify(talk.helped));
  check("sem ninguém que fale a língua, a fala chega com palavras de lá", !!talk.alone.text && talk.alone.text !== said && /pega uma parte|quase não entende/.test(talk.alone.tongue ?? ""), JSON.stringify(talk.alone));
  await page.screenshot({ path: "tests/battle/.shots-m23-lingua-fala.png" });
  await ev(() => {
    const w = window.__world;
    w.scene.stop("InteriorScene");
    const s = window.__store.getState();
    s.leaveInterior();
    s.setDialog(null);
  });
  await page.waitForTimeout(500);

  // Na batalha: a ordem falada a um batalhão que não entende demora; com o tenente das duas línguas, não
  await ev(() => {
    const st = window.__store;
    st.setState({ leader: { ...st.getState().leader, culture: "REALMS", tongues: {} } });
  });
  await page.waitForTimeout(300);
  const order = await ev(async () => {
    const w = window.__world;
    const c = w.commander;
    const b = w.battalions.filter((x) => !x.isDestroyed).sort((p, q) => Math.hypot(p.center.x - c.x, p.center.y - c.y) - Math.hypot(q.center.x - c.x, q.center.y - c.y))[0];
    // Ao alcance da voz
    c.x = b.center.x + 40;
    c.y = b.center.y;
    const wasCulture = b.culture;
    const wasLieutenant = b.lieutenant;
    b.culture = "SANDS";
    b.lieutenant = null;
    const run = async () => {
      let done = false;
      w.dispatch(b, "Teste de língua", () => (done = true));
      const now = done;
      await new Promise((r) => setTimeout(r, 2200));
      return { now, later: done };
    };
    const lost = await run();
    b.lieutenant = { ...(wasLieutenant ?? { id: "lt-teste", name: "Harun", epithet: "o Teste", backstory: "", traits: [], passive: "INSPIRING", loyalty: 60, battalionId: b.id, hireCost: 0, wage: 0, kills: 0, history: [] }), culture: "SANDS", tongues: ["SANDS", "REALMS"] };
    const relayed = await run();
    b.culture = wasCulture;
    b.lieutenant = wasLieutenant;
    return { lost, relayed, feed: w.feed.filter((l) => /não entende de primeira/.test(l)) };
  });
  console.log("   ordem:", JSON.stringify(order));
  check("a ordem falada a um batalhão estrangeiro demora a ser entendida", !order.lost.now && order.lost.later && order.feed.length > 0, JSON.stringify(order));
  check("o tenente que fala as duas línguas leva a ordem na hora", order.relayed.now, JSON.stringify(order.relayed));

  // --- 14.4: outra terra. Uma viagem a cada continente confere os três "Pronto quando" ---
  const lands = await ev(() => {
    const st = window.__store;
    const s = st.getState();
    st.setState({
      leader: { ...s.leader, culture: "REALMS", tongues: {} },
      followers: s.followers.filter((f) => f.role !== "INTERPRETER"),
      charts: s.planet.continents.map((c) => c.id),
      activeContract: null,
      unburied: null,
      battleReport: null,
      fastBroken: [],
    });
    return s.planet.continents.filter((c) => c.id !== s.continent).map((c) => ({ id: c.id, name: c.name, culture: c.culture }));
  });
  console.log("   continentes:", JSON.stringify(lands));
  // O preceito de cada fé que mais obriga a decidir: enterrar os mortos, ou o jejum
  const PRECEPT = { FLAME: "BURY", VEIL: "FAST", TIDE: "BURY", PATH: "BURY" };
  const FAITH_OF = { REALMS: "FLAME", SANDS: "VEIL", ISLES: "TIDE", JADE: "PATH" };
  for (const land of lands) {
    const tag = `${land.name} (${land.culture})`;
    const sail = await ev((to) => {
      const st = window.__store;
      // Os oficiais do bando só falam a língua dos reinos (o que um oficial já fala muda a conversa)
      const before = st.getState();
      const only = (o) => ({ ...o, culture: "REALMS", tongues: ["REALMS"] });
      st.setState({
        gold: 50000,
        rations: 3000,
        activeContract: null,
        battleReport: null,
        unburied: null,
        campEvent: null,
        lieutenants: before.lieutenants.filter((l) => !l.id.startsWith("lt-")).map(only),
        captains: before.captains.map(only),
      });
      const s = st.getState();
      const port = s.settlements.find((t) => t.port && t.owner !== "RUINED") ?? s.settlements.find((t) => t.owner !== "RUINED");
      // Só os primeiros batalhões embarcam (o navio não leva o bando inteiro que foi crescendo)
      const why = s.embark({ to, portId: port.id, battalionIds: s.battalions.slice(0, 3).map((b) => b.id), wagons: 0, ship: "COCA" });
      for (let i = 0; i < 200 && st.getState().voyage; i++) {
        const v = st.getState();
        if (v.voyage.pirates) v.answerPirates("PAY");
        else v.sailDay();
      }
      return { why, continent: st.getState().continent };
    }, land.id);
    await page.waitForTimeout(400);
    await ready(page);
    await page.waitForTimeout(900);
    const card = await ev(() => ({
      land: document.querySelector("[data-arrival]")?.dataset.arrival ?? null,
      topics: [...document.querySelectorAll("[data-arrival-topic]")].map((e) => e.dataset.arrivalTopic),
      tongue: document.querySelector('[data-arrival-topic="TONGUE"]')?.textContent ?? "",
    }));
    console.log(`   chegada a ${tag}:`, JSON.stringify({ ...sail, ...card }));
    check(`${tag}: a chegada avisa o que muda (a gente, a língua e a fé)`, sail.why === null && sail.continent === land.id && card.land === land.culture && ["FOLK", "TONGUE", "FAITH"].every((t) => card.topics.includes(t)), JSON.stringify({ ...sail, ...card }));
    if (land === lands[0]) await page.screenshot({ path: "tests/battle/.shots-m23-outra-terra.png" });
    await page.click("text=Pisar em terra");
    await page.waitForTimeout(200);

    // 1. Conversa, negocia e recruta de outro jeito
    const town = await ev(() => {
      const s = window.__store.getState();
      const open = s.settlements.filter((t) => t.owner !== "RUINED" && t.owner !== "PLAYER" && !s.factions.some((f) => f.id === t.owner && f.atWar));
      const t = open.find((x) => (x.econ.stock.LUXURY ?? 0) >= 1) ?? open[0];
      return { id: t.id };
    });
    await ev((id) => window.__store.getState().setCampPanel({ kind: "TOWN", settlementId: id }), town.id);
    await page.waitForSelector("[data-tongue]");
    const talk = await ev(() => ({ tongue: document.querySelector("[data-tongue]")?.dataset.tongue, voice: document.querySelector("[data-tongue]")?.dataset.voice }));
    await ev(() => window.__store.getState().setCampPanel(null));
    const deal = await ev(
      ({ id, culture }) => {
        const st = window.__store;
        const buy = (interpreter) => {
          const s = st.getState();
          const t = s.settlements.find((x) => x.id === id);
          const keep = { econ: t.econ, freight: s.freight, followers: s.followers };
          st.setState({ gold: 50000, followers: interpreter ? [...s.followers, { id: "int-teste", role: "INTERPRETER", name: "Teste", since: s.day, tongue: culture }] : s.followers });
          const problem = st.getState().tradeGood(id, "LUXURY", 1);
          const paid = 50000 - st.getState().gold;
          st.setState({ freight: keep.freight, followers: keep.followers, settlements: st.getState().settlements.map((x) => (x.id === id ? { ...x, econ: keep.econ } : x)) });
          return { problem, paid };
        };
        return { alone: buy(false), helped: buy(true) };
      },
      { id: town.id, culture: land.culture },
    );
    const recruits = await ev(() => {
      const st = window.__store;
      const s = st.getState();
      // Aldeias primeiro (quase só gente da terra); o porto e a cidade têm mais estrangeiros
      const towns = s.settlements.filter((t) => t.owner !== "RUINED").sort((a, b) => Number(!!a.port) - Number(!!b.port) || (a.kind === "VILLAGE" ? -1 : 0) - (b.kind === "VILLAGE" ? -1 : 0));
      const out = [];
      const why = [];
      for (const t of towns) {
        if (out.length >= 3) break;
        st.setState({ gold: 50000 });
        const problem = st.getState().hireAtTavern(t.id);
        if (problem) why.push(`${t.kind}: ${problem}`);
        else out.push({ culture: st.getState().battalions.at(-1).culture, faith: st.getState().battalions.at(-1).faith, id: st.getState().battalions.at(-1).id, kind: t.kind });
      }
      if (out.length < 3) console.log("taverna recusou:", JSON.stringify(why.slice(0, 4)));
      return out;
    });
    console.log(`   ${tag}:`, JSON.stringify({ talk, deal, recruits }));
    const foreign = land.culture !== "REALMS";
    const local = recruits.filter((r) => r.culture === land.culture).length;
    check(
      `${tag}: muda como o bando conversa, negocia e recruta`,
      talk.tongue === land.culture &&
        (foreign ? talk.voice === "NONE" && deal.alone.paid > deal.helped.paid : talk.voice === "SELF") &&
        !deal.alone.problem &&
        recruits.length >= 2 &&
        local >= recruits.length - 1,
      JSON.stringify({ talk, deal, recruits }),
    );

    // 2. Um preceito da fé daqui obriga a decidir
    const faith = FAITH_OF[land.culture];
    const recruit = recruits.find((r) => r.faith === faith) ?? recruits[0];
    if (PRECEPT[faith] === "BURY") {
      const fight = await ev(
        ({ id, faith }) => {
          const st = window.__store;
          const s = st.getState();
          st.setState({ unburied: null, battleReport: null, battalions: s.battalions.map((b) => (b.id === id ? { ...b, faith, soldiers: 8 } : b)) });
          const c = window.__world.commander;
          st.getState().resolveEngagement("VICTORY", [{ id, survivors: 3 }], { deadScoutIds: [], deadMessengerIds: [], deliveries: {} }, { title: "Teste da outra terra", enemiesKilled: 3, contractDone: false, mutinyOver: false, notes: [], at: { x: c.x, y: c.y } });
          return { unburied: st.getState().unburied };
        },
        { id: recruit.id, faith },
      );
      const button = await page
        .waitForSelector("text=Enterrar os mortos e seguir", { timeout: 5000 })
        .then(() => true)
        .catch(() => false);
      check(`${tag}: os fiéis daqui não marcham sem enterrar os mortos (enterrar ou seguir)`, !!fight.unburied?.faiths.includes(faith) && button, JSON.stringify(fight));
      if (button) await page.click("text=Enterrar os mortos e seguir");
      await page.waitForTimeout(300);
    } else {
      await ev(
        ({ id, faith }) => {
          const st = window.__store;
          const s = st.getState();
          st.setState({ day: 16, fastBroken: [], battalions: s.battalions.map((b) => (b.id === id ? { ...b, faith } : b)) });
          st.getState().setCampPanel({ kind: "TENT" });
        },
        { id: recruit.id, faith },
      );
      const fast = await page
        .waitForSelector(`[data-break-fast="${faith}"]`, { timeout: 5000 })
        .then(() => true)
        .catch(() => false);
      check(`${tag}: o jejum dos fiéis daqui obriga a decidir (cumprir ou quebrar)`, fast, faith);
      await ev(() => window.__store.getState().setCampPanel(null));
    }

    // 3. A mistura de culturas e de fés pesa na moral
    const mix = await ev(
      ({ id, culture }) => {
        const st = window.__store;
        const s = st.getState();
        const cand = s.lieutenantCandidates.find((l) => l.culture === culture) ?? s.lieutenantCandidates[0];
        const lieutenant = { ...cand, id: `lt-${culture}`, culture, tongues: [culture], battalionId: id };
        // Metade do bando da fé daqui, metade da Chama: o atrito aparece se as duas brigam
        const recruit = s.battalions.find((b) => b.id === id);
        const flame = s.battalions.find((b) => b.id !== id && (b.faith ?? "FLAME") === "FLAME" && (b.culture ?? "REALMS") === "REALMS") ?? { ...recruit, id: "chama-teste", name: "Chama de Teste", culture: "REALMS", faith: "FLAME" };
        window.__keptBand = s.battalions;
        st.setState({
          battalions: [{ ...recruit, soldiers: 20, maxSoldiers: Math.max(20, recruit.maxSoldiers) }, { ...flame, soldiers: 20, maxSoldiers: Math.max(20, flame.maxSoldiers) }],
          lieutenants: [...s.lieutenants.filter((l) => l.battalionId !== id && l.id !== lieutenant.id), lieutenant],
        });
        st.getState().setCampPanel({ kind: "TENT" });
        return { lieutenant: lieutenant.name };
      },
      { id: recruit.id, culture: land.culture },
    );
    await page.waitForSelector("[data-faith-panel]");
    await page.waitForTimeout(300);
    const morale = await ev((id) => {
      const card = [...document.querySelectorAll("[data-origin]")].map((e) => e.textContent);
      const out = { kin: card.some((t) => /tenente da terra/.test(t)), friction: document.querySelector("[data-friction]")?.textContent ?? null, id };
      window.__store.setState({ battalions: window.__keptBand });
      return out;
    }, recruit.id);
    const clashes = faith === "VEIL";
    console.log(`   moral em ${tag}:`, JSON.stringify({ ...mix, ...morale }));
    check(`${tag}: a mistura do bando pesa na moral (tenente da terra${clashes ? ", fés que brigam" : ""})`, morale.kin && (!clashes || /Véu das Estrelas/.test(morale.friction ?? "")), JSON.stringify(morale));
    await ev(() => window.__store.getState().setCampPanel(null));
  }

  // De volta para casa: o intérprete embarca com o Comandante, e a chegada diz que a terra é dele
  const home = await ev(() => {
    const st = window.__store;
    const s = st.getState();
    const tongue = s.world.culture;
    st.setState({ gold: 50000, rations: 3000, activeContract: null, battleReport: null, unburied: null, followers: [...s.followers, { id: "int-volta", role: "INTERPRETER", name: "Mei", since: s.day, tongue }] });
    const port = st.getState().settlements.find((t) => t.port && t.owner !== "RUINED") ?? st.getState().settlements[0];
    const why = st.getState().embark({ to: "C0", portId: port.id, battalionIds: st.getState().battalions.slice(0, 3).map((b) => b.id), wagons: 0, ship: "COCA" });
    for (let i = 0; i < 200 && st.getState().voyage; i++) {
      const v = st.getState();
      if (v.voyage.pirates) v.answerPirates("PAY");
      else v.sailDay();
    }
    const after = st.getState();
    return {
      why,
      tongue,
      continent: after.continent,
      interpreter: after.followers.find((f) => f.id === "int-volta") ?? null,
      leftBehind: Object.values(after.parked).some((p) => p.store.followers.some((f) => f.id === "int-volta")),
      arrival: after.arrival ? { back: after.arrival.back, tongue: after.arrival.lines.find((l) => l.topic === "TONGUE")?.text } : null,
    };
  });
  console.log("   volta:", JSON.stringify(home));
  check("o intérprete embarca com o Comandante", home.why === null && home.continent === "C0" && !!home.interpreter && !home.leftBehind, JSON.stringify(home));
  check("de volta à terra natal, a chegada diz que a língua é a do Comandante", !!home.arrival?.back && /que o Comandante fala/.test(home.arrival.tongue ?? ""), JSON.stringify(home.arrival));
  await page.waitForTimeout(600);
  await ready(page);
  await page.waitForTimeout(600);
  await ev(() => window.__store.getState().dismissArrival());
}
