/**
 * A fortaleza (Marco 22, parte 3): fincar o estandarte, a muralha, o acampamento de campo e os dois
 * cercos da sede. E a cidade que nasce em volta dela (parte 4): o arraial, o burgo e a vila no reino.
 */
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

  // --- A cidade que nasce sozinha (Marco 22, parte 4) ---
  const seatOf = () => {
    const l = window.__world.settlementLayer.layouts.find((x) => x.seat);
    return l ? { houses: l.houses.length, stalls: l.stalls.length, walls: l.walls.length, gates: l.gates.length, temple: !!l.temple, wall: l.wallKind, bounds: l.bounds } : null;
  };
  const camptown = await ev((fn) => {
    const s = window.__store.getState();
    return { city: s.seatCity, seat: new Function(`return (${fn})()`)() };
  }, seatOf.toString());
  console.log("   arraial:", JSON.stringify(camptown));
  check("o estandarte traz o arraial", !!camptown.city && camptown.city.people > 0 && camptown.city.people < 120 && camptown.city.settlementId === null, JSON.stringify(camptown.city));
  check("o arraial é a praça diante do portão da fortaleza", !!camptown.seat && camptown.seat.houses === 0 && camptown.seat.stalls > 0, JSON.stringify(camptown.seat));

  // O burgo: casas que o jogador não pôs, e o imposto da semana
  const burg = await ev((fn) => {
    const S = window.__store;
    const s = S.getState();
    const day = Math.ceil((s.day + 2) / 7) * 7;
    S.setState({ seatCity: { ...s.seatCity, people: 200 }, day: day - 1, gold: 1000, fortress: { ...s.fortress, nextSiege: day + 30 } });
    S.getState().fortressDays(day - 1, day);
    const a = S.getState();
    return { people: a.seatCity.people, gold: a.gold, seat: new Function(`return (${fn})()`)(), log: a.log.slice(-3).map((e) => e.text) };
  }, seatOf.toString());
  console.log("   burgo:", JSON.stringify(burg));
  check("o arraial vira burgo sem o jogador pôr nenhuma casa", burg.people >= 120 && burg.seat?.houses > 5 && burg.seat?.walls === 0, JSON.stringify(burg.seat));
  check("o burgo paga imposto", burg.gold > 1000 && burg.log.some((t) => /pagou .* de ouro/.test(t)), JSON.stringify(burg.log));
  // A câmera diante do portão da fortaleza: a praça e as primeiras casas
  await ev(() => {
    const w = window.__world;
    const s = window.__store.getState();
    const c = w.world.camp.center;
    const out = { N: [0, -1], S: [0, 1], W: [-1, 0], E: [1, 0] }[s.campPlan.gate];
    w.commander.x = c.x + out[0] * (17 * 40 + 360);
    w.commander.y = c.y + out[1] * (17 * 40 + 360);
  });
  await page.waitForTimeout(1800);
  await page.screenshot({ path: "tests/battle/.shots-burgo.png" });

  // A fortaleza vira um mapa à parte (parte 4c): do burgo em diante, só se passa pelo portão com E
  const sealed = await ev(() => {
    const w = window.__world;
    const s = w.campArea.palisade;
    const dir = { N: [0, -1], S: [0, 1], W: [-1, 0], E: [1, 0] }[s.gate];
    const out = { x: s.cx + dir[0] * (s.half + 12), y: s.cy + dir[1] * (s.half + 12) };
    const keep = { x: w.commander.x, y: w.commander.y };
    // Um passo pelo vão do portão, de fora para dentro
    w.commander.x = s.cx + dir[0] * (s.half - 12);
    w.commander.y = s.cy + dir[1] * (s.half - 12);
    w.campArea.collide(w.commander, out);
    const bounced = Math.abs(w.commander.x - out.x) < 1 && Math.abs(w.commander.y - out.y) < 1;
    w.commander.x = keep.x;
    w.commander.y = keep.y;
    return { sealed: w.seatSealed && w.campArea.sealed, bounced, spots: w.seatGateSpots().map((p) => [p.label, p.enter]) };
  });
  console.log("   portão:", JSON.stringify(sealed));
  check("do burgo em diante, a pé não se entra na fortaleza", sealed.sealed && sealed.bounced, JSON.stringify(sealed));
  await ev(() => {
    const w = window.__world;
    const spot = w.seatGateSpots().find((p) => p.enter === "seat:in");
    w.commander.x = spot.door.x;
    w.commander.y = spot.door.y;
  });
  await page.waitForTimeout(600);
  const prompt = await ev(() => window.__store.getState().campPrompt);
  check("o portão da fortaleza pede E", prompt === "E — Entrar: Fortaleza do bando", prompt);
  const view = () => {
    const w = window.__world;
    const b = w.cameras.main.getBounds();
    return { inFort: w.inSeatFort(), inCamp: w.inCamp, bounds: Math.round(b.width), veil: !!w.seatVeil?.visible, quartered: w.quartered.size, x: Math.round(w.commander.x), y: Math.round(w.commander.y) };
  };
  await page.keyboard.press("e");
  await page.waitForTimeout(2500);
  const inside = await ev((fn) => new Function(`return (${fn})()`)(), view.toString());
  console.log("   dentro:", JSON.stringify(inside));
  check("com E, o portão leva para dentro da fortaleza", inside.inFort && inside.inCamp, JSON.stringify(inside));
  check("lá dentro, a câmera fica na fortaleza e a cidade escurece", inside.bounds < 3000 && inside.veil, JSON.stringify(inside));
  await page.screenshot({ path: "tests/battle/.shots-fortaleza-dentro.png" });
  // De dentro: E — Sair para o burgo
  await ev(() => {
    const w = window.__world;
    const spot = w.seatGateSpots().find((p) => p.enter === "seat:out");
    w.commander.x = spot.door.x;
    w.commander.y = spot.door.y;
  });
  await page.waitForTimeout(600);
  const out = await ev(() => window.__store.getState().campPrompt);
  check("de dentro, o portão leva de volta ao burgo", out === "E — Sair para o burgo", out);
  await page.keyboard.press("e");
  await page.waitForTimeout(2500);
  const outside = await ev((fn) => new Function(`return (${fn})()`)(), view.toString());
  console.log("   fora:", JSON.stringify(outside));
  check("fora, a câmera corre o mundo de novo e o bando sai atrás", !outside.inFort && !outside.inCamp && !outside.veil && outside.bounds > inside.bounds * 3 && outside.quartered === 0, JSON.stringify(outside));
  // O Comandante anda para a praça, e quem o segue vem atrás
  await ev(() => {
    const w = window.__world;
    const s = w.campArea.palisade;
    const dir = { N: [0, -1], S: [0, 1], W: [-1, 0], E: [1, 0] }[s.gate];
    w.commander.x += dir[0] * 450;
    w.commander.y += dir[1] * 450;
  });
  await page.waitForTimeout(5000);
  const marched = await ev(() => {
    const w = window.__world;
    return w.battalions.filter((b) => !b.isDestroyed).map((b) => !w.inSeatFort(b.center));
  });
  check("as tropas passam pelo portão a pé", marched.length > 0 && marched.some((x) => x), JSON.stringify(marched));

  // A vila: paliçada de fora, templo, e um povoado do bando no reino
  const town = await ev((fn) => {
    const S = window.__store;
    const s = S.getState();
    S.setState({ seatCity: { ...s.seatCity, people: 330 } });
    S.getState().fortressDays(s.day, s.day + 1);
    const a = S.getState();
    const t = a.settlements.find((x) => x.seat);
    const spots = window.__world.settlementLayer.interactables.map((i) => i.label);
    return { id: a.seatCity.settlementId, town: t ? { id: t.id, owner: t.owner, kind: t.kind, population: t.population, x: t.x, y: t.y } : null, seat: new Function(`return (${fn})()`)(), spots: spots.filter((l) => t && l.includes(t.name)) };
  }, seatOf.toString());
  console.log("   vila:", JSON.stringify(town));
  check("a vila entra no reino como povoado do bando", !!town.town && town.town.owner === "PLAYER" && town.id === town.town.id, JSON.stringify(town.town));
  check("a vila tem paliçada, portões e templo", town.seat?.walls > 0 && town.seat?.gates === 4 && town.seat?.temple && town.seat?.wall === "PALISADE", JSON.stringify(town.seat));
  check("a vila tem praça, Sala de Administração e portões, como as outras", town.spots.some((l) => l.startsWith("Mercado")) && town.spots.some((l) => l.startsWith("Sala de Administração")) && town.spots.some((l) => l.startsWith("Portão")), JSON.stringify(town.spots));
  // Os impostos da vila vêm pelo reino (Marco 9)
  const realm = await ev(() => {
    const S = window.__store;
    const s = S.getState();
    const day = Math.ceil((s.day + 2) / 7) * 7;
    S.setState({ day: day - 1, gold: 5000 });
    const seen = new Set(S.getState().log.map((e) => e.id));
    S.getState().advanceTime(1);
    const a = S.getState();
    return { day: a.day, log: a.log.filter((e) => !seen.has(e.id)).map((e) => e.text).filter((t) => /Renda do reino|cidade da sede pagou/.test(t)) };
  });
  console.log("   reino:", JSON.stringify(realm));
  check("a vila paga pelo reino, e não mais pela cidade", realm.log.some((t) => t.startsWith("Renda do reino")) && !realm.log.some((t) => /cidade da sede pagou/.test(t)), JSON.stringify(realm));
  // A cidade de pedra
  const city = await ev((fn) => {
    const S = window.__store;
    const s = S.getState();
    S.setState({ seatCity: { ...s.seatCity, people: 720 } });
    S.getState().fortressDays(s.day, s.day + 1);
    const a = S.getState();
    return { kind: a.settlements.find((x) => x.seat)?.kind, seat: new Function(`return (${fn})()`)() };
  }, seatOf.toString());
  console.log("   cidade:", JSON.stringify(city));
  check("com a muralha de pedra da fortaleza, a vila vira cidade", city.kind === "CITY" && city.seat?.wall === "STONE", JSON.stringify(city));
  await ev(() => {
    const w = window.__world;
    const l = w.settlementLayer.layouts.find((x) => x.seat);
    w.commander.x = l.gates[1].inside.x;
    w.commander.y = l.gates[1].inside.y - 200;
  });
  await page.waitForTimeout(1800);
  await page.screenshot({ path: "tests/battle/.shots-cidade-sede.png" });
}
