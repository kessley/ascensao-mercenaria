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
}
