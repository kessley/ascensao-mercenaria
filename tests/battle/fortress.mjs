/** A fortaleza (Marco 22, parte 3): fincar o estandarte, a muralha, o acampamento de campo e os dois cercos da sede. */
const ready = (page) => page.waitForFunction(() => window.__world && !window.__world.run && window.__store.getState().battleHud && !window.__world.scene.isPaused(), null, { timeout: 60000 });

export async function fortress({ page, ev }, { check }) {
  await ev(() => localStorage.clear());
  await page.reload();
  await page.waitForSelector("nav >> text=Nova campanha");
  await page.click("nav >> text=Nova campanha");
  await page.waitForSelector("text=Começar campanha");
  await page.click("text=Começar campanha");
  await ready(page);
  await page.waitForTimeout(800);

  // A paliçada grande com o que a fortaleza pede, cinco batalhões e fama
  const setup = await ev(() => {
    const S = window.__store;
    const st = () => S.getState();
    S.setState({ gold: 99999, iron: 999, rations: 999, fame: 60, nextEventDay: 99999, nextCalamityDay: 99999, depot: { ...st().depot, WOOD: 999 }, campPlan: { ...st().campPlan, size: 28 } });
    for (let i = 0; i < 6 && st().battalions.length < 5; i++) st().formVolunteers?.();
    const base = st().battalions[0];
    let n = st().battalions.length;
    const extra = [];
    while (n < 5) extra.push({ ...base, id: `${base.id}-f${n}`, name: `Lança ${n++}` });
    if (extra.length > 0) S.setState({ battalions: [...st().battalions, ...extra] });
    const placed = [];
    for (const k of ["KITCHEN", "OFFICERS_TENT", "WELL", "TOWER", "BARRACK", "INFIRMARY", "FORGE"]) {
      outer: for (let y = -13; y <= 11; y++) for (let x = -13; x <= 11; x++) if (st().placeBuilding(k, x, y) === null) { placed.push(k); break outer; }
    }
    S.setState({ campPlan: { ...st().campPlan, buildings: st().campPlan.buildings.map(({ built, ...r }) => r) } });
    return { placed, battalions: st().battalions.length, size: st().campPlan.size };
  });
  console.log("   preparo:", JSON.stringify(setup));
  check("a paliçada grande está de pé, com o que a fortaleza pede", setup.size === 28 && setup.placed.length >= 4 && setup.battalions >= 5, JSON.stringify(setup));

  // Pela planta do acampamento: os três caminhos da terra
  await page.waitForTimeout(600);
  await ev(() => window.__store.getState().setCampPanel({ kind: "CAMP_PLAN" }));
  await page.waitForSelector("text=Fincar o estandarte");
  const paths = await page.locator("text=Terra de ninguém").count();
  check("o painel mostra os caminhos da terra", paths > 0 && (await page.locator("text=Carta de terra").count()) > 0 && (await page.locator("text=Reerguer as ruínas").count()) > 0);
  await page.screenshot({ path: "tests/battle/.shots-estandarte.png" });
  const blocked = await ev(() => window.__store.getState().battleHud?.standardBlocked ?? null);
  check("a muralha cabe em volta do acampamento", blocked === null, String(blocked));
  await page.locator("div.rounded", { hasText: "Terra de ninguém" }).locator("button").click();
  await page.waitForTimeout(800);
  const planted = await ev(() => {
    const s = window.__store.getState();
    return { size: s.campPlan.size, wall: s.campPlan.wall, fortress: s.fortress, fear: s.fear };
  });
  console.log("   estandarte:", JSON.stringify(planted));
  check("o acampamento vira fortaleza", planted.size === 34 && planted.wall === "WOOD" && planted.fortress?.land === "WILD", JSON.stringify(planted));
  check("o painel agora é o da sede", (await page.locator("text=Muralha de madeira").count()) > 0);
  check("a fortaleza não se levanta", (await page.locator("button:has-text('Levantar acampamento')").count()) === 0);

  // Construções da fortaleza e a muralha de pedra
  const built = await ev(() => {
    const S = window.__store;
    const st = () => S.getState();
    const placed = [];
    for (const k of ["KEEP", "CISTERN", "DOVECOTE", "TREASURY", "DUNGEON", "GREAT_HALL"]) {
      outer: for (let y = -16; y <= 14; y++) for (let x = -16; x <= 14; x++) if (st().placeBuilding(k, x, y) === null) { placed.push(k); break outer; }
    }
    S.setState({ campPlan: { ...st().campPlan, buildings: st().campPlan.buildings.map(({ built, ...r }) => r) } });
    return placed;
  });
  check("as construções da fortaleza cabem na planta", built.length === 6, built.join(","));
  await page.locator("button", { hasText: "450" }).first().click();
  await page.waitForTimeout(300);
  check("a muralha vira de pedra", (await ev(() => window.__store.getState().campPlan.wall)) === "STONE");
  // O kit do acampamento de campo, pelos botões
  await page.locator("button[type=button]", { hasText: "Barraca de soldados" }).first().click().catch(() => {});
  await page.locator("button[type=button]", { hasText: "Enfermaria" }).first().click().catch(() => {});
  await page.waitForTimeout(200);
  const kit = await ev(() => window.__store.getState().fortress.kit);
  check("o kit de campo é escolhido no painel", kit.length >= 1, JSON.stringify(kit));
  await ev(() => window.__store.getState().setCampPanel(null));
  // A câmera no portão: a muralha desenhada
  await ev(() => {
    const w = window.__world;
    const c = w.world.camp.center;
    w.commander.x = c.x;
    w.commander.y = c.y + 17 * 40 + 60;
  });
  await page.waitForTimeout(900);
  await page.screenshot({ path: "tests/battle/.shots-fortaleza.png" });

  // Longe da sede: o acampamento de campo
  const field = await ev(() => {
    const w = window.__world;
    const c = w.world.camp.center;
    const geo = w.world;
    window.__store.setState({ train: "ARMY" });
    let spot = null;
    for (const [dx, dy] of [[3600, 0], [-3600, 0], [0, 3600], [0, -3600], [3000, 3000], [-3000, 3000], [3000, -3000], [-3000, -3000]]) {
      w.commander.x = c.x + dx;
      w.commander.y = c.y + dy;
      for (const b of w.battalions) b.teleportTo({ x: w.commander.x - 100, y: w.commander.y });
      if (w.fieldBlocked() === null) { spot = { dx, dy }; break; }
    }
    if (!spot) return { spot, why: w.fieldBlocked() };
    w.toggleFieldCamp();
    return { spot, at: window.__store.getState().fieldCamp };
  });
  console.log("   campo:", JSON.stringify(field));
  check("o acampamento de campo se monta longe da sede", !!field.at, JSON.stringify(field));
  await page.waitForTimeout(1200);
  const shelter = await ev(() => window.__store.getState().exposure);
  check("quem dorme nele fica abrigado", shelter.away && shelter.field, JSON.stringify(shelter));
  await page.screenshot({ path: "tests/battle/.shots-campo.png" });

  // O cerco sem o bando: a guarnição sozinha
  const away = await ev(() => {
    const S = window.__store;
    const s = S.getState();
    const before = { gold: s.gold, sieges: s.fortress.sieges, buildings: s.campPlan.buildings.length };
    S.setState({ fortress: { ...s.fortress, nextSiege: s.day + 1 } });
    s.fortressDays(s.day, s.day + 1);
    const a = S.getState();
    return { before, sieges: a.fortress.sieges, next: a.fortress.nextSiege, day: a.day, alarm: a.seatAlarm, last: a.log.slice(-2).map((e) => e.text) };
  });
  console.log("   cerco sem o bando:", JSON.stringify(away));
  check("longe, o cerco se resolve sozinho", away.alarm === null && away.next > away.day && /sede|cerco/i.test(away.last.join(" ")), JSON.stringify(away));

  // Em casa: o alarme e a batalha nas muralhas
  await ev(() => {
    const w = window.__world;
    const c = w.world.camp.center;
    w.commander.x = c.x;
    w.commander.y = c.y;
    for (const b of w.battalions) b.teleportTo({ x: c.x, y: c.y + 100 });
  });
  await page.waitForTimeout(1200);
  const home = await ev(() => {
    const S = window.__store;
    const s = S.getState();
    S.setState({ fortress: { ...s.fortress, nextSiege: s.day + 1 } });
    s.fortressDays(s.day, s.day + 1);
    return { exposure: S.getState().exposure, alarm: S.getState().seatAlarm, field: S.getState().fieldCamp, sieges: S.getState().fortress.sieges };
  });
  console.log("   em casa:", JSON.stringify(home));
  check("em casa, o cerco toca o alarme", !home.exposure.away && !!home.alarm, JSON.stringify(home));
  check("entrar na sede recolhe o acampamento de campo", home.field === null, JSON.stringify(home.field));
  await page.waitForSelector("button:has-text('Às muralhas')");
  await page.click("button:has-text('Às muralhas')");
  await page.waitForFunction(() => window.__world?.run?.def.seat && window.__store.getState().battleHud, null, { timeout: 30000 });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: "tests/battle/.shots-muralhas.png" });
  const battle = await ev(() => {
    const w = window.__world;
    const run = w.run;
    const foes = w.scenarioFoes(run);
    w.endScenario(run, "VICTORY", "teste");
    return { foes, siege: run.def.siege, result: window.__store.getState().scenarioResult?.outcome };
  });
  console.log("   muralhas:", JSON.stringify(battle));
  check("a batalha é a defesa da sede", battle.siege?.role === "DEFEND" && battle.result === "VICTORY", JSON.stringify(battle));
  await page.waitForSelector("button:has-text('Voltar à fortaleza')");
  await page.click("button:has-text('Voltar à fortaleza')");
  await ready(page);
  await page.waitForTimeout(800);
  const back = await ev(() => {
    const s = window.__store.getState();
    return { scenario: s.scenario, seatBattle: s.seatBattle, fortress: s.fortress, size: s.campPlan.size, wall: s.campPlan.wall, towns: s.settlements.length, inCamp: window.__world.inCamp };
  });
  console.log("   de volta:", JSON.stringify({ ...back, fortress: { sieges: back.fortress?.sieges, next: back.fortress?.nextSiege } }));
  check("de volta à campanha, com a fortaleza de pé", !back.scenario && !back.seatBattle && back.size === 34 && back.wall === "STONE" && back.towns > 0, JSON.stringify(back));
  check("o cerco repelido conta", back.fortress?.sieges === home.sieges + 1, JSON.stringify(back.fortress));
  await page.screenshot({ path: "tests/battle/.shots-sede-volta.png" });
}
