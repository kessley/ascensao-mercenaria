/**
 * Marco 19: a magia do Comandante. A parte 1 (o arcano e as primeiras magias): a bola de fogo,
 * que fere todos em volta, assusta e deixa o chão em chamas, e a cura, que fecha as feridas de um
 * batalhão e o tira do pânico. O arcano dá para poucas magias por batalha. A parte 2 (as magias
 * que mexem no mundo): congelar, nevoeiro, apagar o fogo e pavor. A parte 3 (aprender pelo mundo):
 * a campanha começa sem magia; grimórios nas ruínas, o mago da corte preso e o mestre de outra terra.
 * As fotos ficam em `tests/battle/.shots-m19-*.png`.
 */
const SHOTS = "tests/battle/.shots-m19";

/** Desenha a cena agora (a câmera e a noite só se atualizam quando a cena desenha). */
const render = () => {
  const g = window.__world.sys.game;
  g.renderer.preRender();
  g.scene.render(g.renderer);
  g.renderer.postRender();
};

export async function magic({ page, ev, battle }, { check }) {
  const drawFresh = async () => {
    await ev(render);
    await ev(() => window.__lab.step(1 / 30));
    await ev(render);
  };

  // --- 16.1: o arcano e as primeiras magias ---
  // Sem magia, o campo não mostra nada dela
  await battle({ army: [["INFANTRY"]], force: { SOLDIER: 6 }, faction: "KINGDOM" });
  const plain = await ev(() => ({
    hud: window.__world.magicHud(),
    buttons: [...document.querySelectorAll("button[aria-label='Bola de fogo']")].length,
  }));
  check("sem magia, o campo não mostra arcano nem magias", plain.hud === null && plain.buttons === 0, JSON.stringify(plain));

  // O Comandante mago contra um esquadrão cerrado
  const setup = async (extra = "") => {
    await battle({ army: [["INFANTRY"]], force: { SOLDIER: 12 }, faction: "KINGDOM", setup: `s.magic = true; ${extra}` });
    await ev(() => {
      const lab = window.__lab;
      const w = window.__world;
      lab.freezeAI();
      // Os heróis do outro lado não vêm desafiar o Comandante para um duelo no meio do teste
      for (const e of w.enemies) w.duelDone.add(e);
      // Sem a passiva do tenente sorteado, que muda quanto o esquadrão aguenta: o teste mede a magia
      for (const sq of w.warbands.bands.flatMap((b) => b.host?.squads ?? [])) sq.passive = null;
      w.commander.x = 3700;
      w.commander.y = 3600;
      lab.place(lab.battalion(), 3640, 3700, 0, 4);
      lab.placeSquad(lab.squad(), 4020, 3600, Math.PI);
      w.cameras.main.stopFollow();
      w.cameras.main.setZoom(1.5);
      w.cameras.main.centerOn(3870, 3620);
    });
  };
  await setup();
  await page.waitForTimeout(250);
  const start = await ev(() => {
    const s = window.__store.getState();
    return {
      spells: s.spells,
      arcane: s.arcane,
      hud: window.__world.magicHud(),
      buttons: ["Bola de fogo", "Cura", "Congelar", "Nevoeiro", "Apagar o fogo", "Pavor"].map((n) => document.querySelectorAll(`button[aria-label='${n}']`).length),
      bar: document.body.innerText.includes("Arcano"),
    };
  });
  console.log("   começo:", JSON.stringify({ spells: start.spells, arcane: start.arcane, buttons: start.buttons, bar: start.bar }));
  check("o Comandante mago entra sabendo as seis magias, com o arcano cheio", start.spells.join() === "FIREBALL,MEND,FREEZE,MIST,DOUSE,TERROR" && start.arcane === 100, JSON.stringify(start.spells));
  check("o campo mostra o arcano e um botão por magia, com a tecla (5 a 0)", start.bar && start.buttons.every((n) => n === 1) && start.hud.spells.map((s) => s.key).join() === "5,6,7,8,9,0", JSON.stringify(start.buttons));

  // A tecla arma a mira; o Esc desiste
  await page.keyboard.press("5");
  await ev(() => window.__lab.step(1 / 30));
  const armed = await ev(() => window.__world.aiming);
  await page.keyboard.press("Escape");
  await ev(() => window.__lab.step(1 / 30));
  const disarmed = await ev(() => window.__world.aiming);
  check("a tecla 5 arma a bola de fogo e o Esc desiste", armed === "FIREBALL" && disarmed === null, `${armed} → ${disarmed}`);

  // Longe demais: recusa, sem gastar
  const far = await ev(() => {
    const w = window.__world;
    const p = w.castAt("FIREBALL", { x: w.commander.x + 900, y: w.commander.y });
    // No duelo, o Comandante só tem olhos para o adversário
    w.inDuel = () => true;
    const duel = w.castAt("FIREBALL", { x: w.commander.x + 200, y: w.commander.y });
    delete w.inDuel;
    return { p, duel, arcane: window.__store.getState().arcane };
  });
  check("longe demais ou no duelo, a magia não sai e o arcano fica", far.p === "Longe demais." && /duelo/.test(far.duel ?? "") && far.arcane === 100, JSON.stringify(far));

  // A bola de fogo lançada com o clique, no meio do esquadrão
  await ev(() => window.__world.cameras.main.centerOn(4020, 3600));
  await ev(render);
  await page.keyboard.press("5");
  await ev(() => window.__lab.step(1 / 30));
  const aim = await ev(() => {
    const w = window.__world;
    const cam = w.cameras.main;
    const sq = window.__lab.squad();
    return { x: (sq.center.x - cam.worldView.x) * cam.zoom, y: (sq.center.y - cam.worldView.y) * cam.zoom, hp: window.__lab.hp(sq.soldiers), morale: sq.morale };
  });
  await page.mouse.click(aim.x, aim.y);
  const flight = await ev(() => {
    const w = window.__world;
    w.cameras.main.centerOn(3870, 3620);
    window.__lab.step(0.25);
    return { arcane: window.__store.getState().arcane, ball: w.magicAnims.length, light: w.magicLights().length, blast: w.lastBlast, readyIn: w.magicHud().spells[0].readyIn };
  });
  await drawFresh();
  await page.screenshot({ path: `${SHOTS}-bola.png` });
  check("o clique lança a bola: custa o arcano e a bola voa (com luz) antes de cair", flight.arcane === 60 && flight.ball >= 1 && flight.light >= 1 && flight.blast === null && flight.readyIn > 0, JSON.stringify(flight));

  const blast = await ev(() => {
    const lab = window.__lab;
    const w = window.__world;
    lab.step(0.3);
    const sq = lab.squad();
    return { blast: w.lastBlast, hp: lab.hp(sq.soldiers), morale: sq.morale, fire: w.places.stats().byKind.FIRE ?? 0, fx: w.combatFx.stats.blasts };
  });
  await drawFresh();
  await page.screenshot({ path: `${SHOTS}-explosao.png` });
  console.log("   explosão:", JSON.stringify(blast));
  check("a explosão pega quase todo o esquadrão cerrado e nenhum dos nossos", blast.blast && blast.blast.wounded >= 9 && blast.blast.ours === 0, JSON.stringify(blast.blast));
  check("a explosão leva mais de um quarto da vida do esquadrão", blast.hp <= aim.hp * 0.75, `${Math.round(aim.hp)} → ${Math.round(blast.hp)}`);
  check("a explosão assusta: a moral cai de uma vez", blast.morale <= aim.morale - 15, `${Math.round(aim.morale)} → ${Math.round(blast.morale)}`);
  check("o chão fica em chamas, com o clarão e a poeira", blast.fire === 1 && blast.fx >= 1, JSON.stringify({ fire: blast.fire, fx: blast.fx }));

  // O fogo no chão segue queimando quem ficou dentro
  const burn = await ev(() => {
    const lab = window.__lab;
    const w = window.__world;
    const sq = lab.squad();
    // O fogo leva 1,5 s para pegar de vez
    lab.step(1);
    const inside = sq.soldiers.filter((s) => s.isAlive && w.places.burningAt(s));
    const before = lab.hp(inside);
    lab.step(2);
    const again = w.castAt("FIREBALL", sq.center);
    return { inside: inside.length, before, after: lab.hp(inside), again, arcane: window.__store.getState().arcane };
  });
  await drawFresh();
  await page.screenshot({ path: `${SHOTS}-fogo.png` });
  check("quem fica no fogo segue se queimando", burn.inside > 0 && burn.after < burn.before - 5, `${burn.inside} dentro: ${Math.round(burn.before)} → ${Math.round(burn.after)}`);
  check("na recarga, a magia espera e o arcano fica", /ainda faltam/.test(burn.again ?? "") && burn.arcane === 60, JSON.stringify({ again: burn.again, arcane: burn.arcane }));

  // A cura: um batalhão moído e em pânico volta a ficar de pé
  const mend = await ev(() => {
    const lab = window.__lab;
    const w = window.__world;
    const b = lab.battalion();
    for (const s of b.soldiers) s.hp = s.maxHp * 0.25;
    b.morale = 15;
    lab.step(0.5);
    const before = { hp: lab.hp(b.soldiers), morale: Math.round(b.morale), panicking: b.panicking };
    const nobody = w.castAt("MEND", { x: w.commander.x + 200, y: w.commander.y - 300 });
    const arcaneNobody = window.__store.getState().arcane;
    const p = w.castAt("MEND", b.center);
    const sparks = w.magicAnims.length;
    lab.step(0.3);
    return { before, nobody, arcaneNobody, p, sparks, after: { hp: lab.hp(b.soldiers), morale: Math.round(b.morale), panicking: b.panicking }, arcane: window.__store.getState().arcane };
  });
  await drawFresh();
  await page.screenshot({ path: `${SHOTS}-cura.png` });
  console.log("   cura:", JSON.stringify(mend));
  check("a cura sem batalhão no ponto não sai e não gasta", /Nenhum batalhão/.test(mend.nobody ?? "") && mend.arcaneNobody === 60, JSON.stringify({ nobody: mend.nobody, arcane: mend.arcaneNobody }));
  check("a cura fecha as feridas e tira o batalhão do pânico", mend.before.panicking && mend.p === null && mend.after.hp > mend.before.hp * 2 && !mend.after.panicking && mend.sparks > 0, JSON.stringify(mend));

  // O arcano acaba: duas ou três magias por batalha, e volta com os dias
  const spent = await ev(() => {
    const w = window.__world;
    w.spellReadyAt = {};
    const third = w.castAt("FIREBALL", window.__lab.squad().center);
    const arcane = window.__store.getState().arcane;
    window.__store.getState().restoreArcane(1);
    return { third, arcane, next: window.__store.getState().arcane, disabled: document.querySelector("button[aria-label='Bola de fogo']")?.disabled ?? null };
  });
  check("depois de bola e cura, o arcano não dá outra bola", /Arcano de menos/.test(spent.third ?? "") && spent.arcane === 30, JSON.stringify(spent));
  check("o arcano volta com os dias", spent.next === 70, JSON.stringify(spent));

  // Fogo amigo: a bola no meio dos nossos fere e assusta os nossos
  await setup();
  const friendly = await ev(() => {
    const lab = window.__lab;
    const w = window.__world;
    const b = lab.battalion();
    const hp = lab.hp(b.soldiers);
    const morale = b.morale;
    const before = w.run.friendlyFire;
    w.castAt("FIREBALL", b.center);
    lab.step(0.6);
    return { blast: w.lastBlast, hp, after: lab.hp(b.soldiers), morale, moraleAfter: b.morale, friendly: w.run.friendlyFire - before };
  });
  check("a bola não escolhe lado: fere e assusta os nossos, e conta como fogo amigo", friendly.blast?.ours >= 6 && friendly.after < friendly.hp * 0.8 && friendly.moraleAfter <= friendly.morale - 10 && friendly.friendly >= 6, JSON.stringify(friendly));

  // À noite, a bola acende o caminho e a explosão clareia em volta
  await setup('s.hour = "NIGHT";');
  const night = await ev(() => {
    const lab = window.__lab;
    const w = window.__world;
    w.castAt("FIREBALL", lab.squad().center);
    lab.step(0.25);
    return { lights: w.magicLights().length };
  });
  await drawFresh();
  await page.screenshot({ path: `${SHOTS}-noite-voo.png` });
  const nightBlast = await ev(() => {
    window.__lab.step(0.3);
    return { lights: window.__world.magicLights().length, fire: window.__world.places.lights().length };
  });
  await drawFresh();
  await page.screenshot({ path: `${SHOTS}-noite.png` });
  check("à noite, a bola e a explosão acendem a escuridão", night.lights >= 1 && nightBlast.lights >= 1, JSON.stringify({ night, nightBlast }));

  // Duas bolas de fogo derrubam um esquadrão antes de ele chegar
  await setup();
  const two = await ev(() => {
    const lab = window.__lab;
    const w = window.__world;
    const sq = lab.squad();
    const hp = lab.hp(sq.soldiers);
    w.castAt("FIREBALL", sq.center);
    lab.step(6.2);
    w.castAt("FIREBALL", sq.center);
    lab.step(3);
    return { hp, after: lab.hp(sq.soldiers), alive: sq.soldiers.filter((s) => s.isAlive).length, morale: Math.round(sq.morale), panicking: sq.panicking };
  });
  console.log("   duas bolas:", JSON.stringify(two));
  check("duas bolas de fogo levam mais da metade da força de um esquadrão", two.after <= two.hp * 0.5, JSON.stringify(two));

  // --- 16.2: as magias que mexem no mundo ---
  // Congelar: no vau, o rio fundo vira caminho
  await battle({ army: [["INFANTRY"]], force: { SOLDIER: 6 }, faction: "KINGDOM", setup: 's.magic = true; s.map = "FORD";' });
  const ice = await ev(() => {
    const lab = window.__lab;
    const w = window.__world;
    const T = w.commander.constructor.terrain;
    lab.freezeAI();
    for (const e of w.enemies) w.duelDone.add(e);
    const b = lab.battalion();
    const c = b.center;
    const river = w.world.geo.rivers[0].points;
    const near = river.reduce((p, q) => (Math.abs(q.y - c.y) < Math.abs(p.y - c.y) ? q : p));
    // As margens: de onde a água acaba, de cada lado
    const wet = (x) => ["WATER", "SHALLOW"].includes(T.unfrozenTypeAt(x, near.y));
    const side = Math.sign(c.x - near.x) || -1;
    let ours = near.x;
    while (wet(ours)) ours += side * 8;
    let far = near.x;
    while (wet(far)) far -= side * 8;
    const from = { x: ours + side * 50, y: near.y };
    const to = { x: far - side * 50, y: near.y };
    w.commander.x = ours + side * 120;
    w.commander.y = near.y;
    window.__ford = { near, from, to, side };
    // Sem gelo, o batalhão não cruza ali
    lab.place(b, from.x, from.y, side > 0 ? Math.PI : 0, 4);
    b.orderMove(to);
    lab.step(6);
    const without = Math.round(Math.abs(b.center.x - to.x));
    const dry = w.castAt("FREEZE", { x: w.commander.x + side * 300, y: near.y });
    const p = w.castAt("FREEZE", near);
    lab.step(2);
    return { width: Math.abs(far - ours), without, dry, p, type: T.typeAt(near.x, near.y), open: w.armyNav.isOpen(near), place: w.lastPlaceSpell?.spell ?? null };
  });
  const crossed = await ev(() => {
    const lab = window.__lab;
    const w = window.__world;
    const { from, to, side, near } = window.__ford;
    const b = lab.battalion();
    lab.place(b, from.x, from.y, side > 0 ? Math.PI : 0, 4);
    b.orderMove(to);
    lab.step(6);
    w.cameras.main.stopFollow();
    w.cameras.main.setZoom(1);
    w.cameras.main.centerOn(near.x, near.y);
    return { left: Math.round(Math.abs(b.center.x - to.x)), alive: b.soldiers.filter((s) => s.isAlive).length };
  });
  await drawFresh();
  await page.screenshot({ path: `${SHOTS}-gelo.png` });
  console.log("   gelo:", JSON.stringify({ ice, crossed }));
  check("congelar só sai onde há água", /Não há água/.test(ice.dry ?? "") && ice.p === null && ice.place === "FREEZE", JSON.stringify(ice));
  check("congelado, o rio fundo vira caminho: o batalhão cruza onde antes não passava", ice.width <= 360 && ice.without > 150 && ice.type === "ICE" && ice.open && crossed.left < 60, JSON.stringify({ ice, crossed }));

  // Nevoeiro e apagar o fogo: à noite, o batalhão some da vista do inimigo
  await battle({ army: [["INFANTRY"]], force: { SOLDIER: 6 }, faction: "KINGDOM", setup: 's.magic = true; s.hour = "NIGHT";' });
  const hide = await ev(() => {
    const lab = window.__lab;
    const w = window.__world;
    lab.freezeAI();
    for (const e of w.enemies) w.duelDone.add(e);
    const b = lab.battalion();
    const c = b.center;
    w.commander.x = c.x - 160;
    w.commander.y = c.y;
    const foe = lab.allEnemies()[0];
    foe.x = c.x + 300;
    foe.y = c.y;
    const s0 = b.soldiers.find((s) => s.hasTorch) ?? b.soldiers[0];
    const vision = () => Math.round(w.visionSources().find((v) => Math.abs(v.x - b.center.x) < 1 && Math.abs(v.y - b.center.y) < 1)?.radius ?? 0);
    const look = () => ({ sight: Math.round(foe.perceptionOf(s0)), vision: vision(), bearers: b.soldiers.filter((s) => s.hasTorch).length });
    const base = look();
    const pMist = w.castAt("MIST", c);
    lab.step(2.5);
    const mist = look();
    // O nevoeiro passa; o fogo se apaga em volta do batalhão
    w.places.remove(w.lastPlaceSpell.id);
    lab.step(3);
    const clear = look();
    w.spellReadyAt = {};
    window.__store.setState({ arcane: 100 });
    const pDouse = w.castAt("DOUSE", c);
    lab.step(1);
    const dark = look();
    w.cameras.main.stopFollow();
    w.cameras.main.setZoom(1.5);
    w.cameras.main.centerOn(c.x + 100, c.y);
    return { base, pMist, mist, clear, pDouse, dark };
  });
  await drawFresh();
  await page.screenshot({ path: `${SHOTS}-escuro.png` });
  console.log("   esconder:", JSON.stringify(hide));
  check("no nevoeiro, o batalhão enxerga pouco e só é visto de perto", hide.pMist === null && hide.mist.sight < hide.base.sight * 0.6 && hide.mist.vision < hide.base.vision * 0.6, JSON.stringify(hide));
  check("com o fogo apagado, à noite, as tochas saem da mão e o inimigo só vê o batalhão de perto", hide.pDouse === null && hide.base.bearers > 0 && hide.dark.bearers === 0 && hide.dark.sight < hide.clear.sight * 0.8, JSON.stringify(hide));

  // Apagar o fogo também apaga o chão em chamas da bola de fogo
  const doused = await ev(() => {
    const lab = window.__lab;
    const w = window.__world;
    // (o fogo apagado de antes ainda vale ali: desliga primeiro, senão a bola já cai apagada)
    w.places.remove(w.lastPlaceSpell.id);
    lab.step(3);
    w.spellReadyAt = {};
    window.__store.setState({ arcane: 100 });
    const sq = lab.squad();
    lab.placeSquad(sq, w.commander.x + 300, w.commander.y, Math.PI);
    const fire = w.castAt("FIREBALL", sq.center);
    lab.step(2);
    const burning = w.places.burningAt(sq.center);
    const douse = w.castAt("DOUSE", sq.center);
    lab.step(0.5);
    return { fire, douse, burning, after: w.places.burningAt(sq.center) };
  });
  check("apagar o fogo apaga o chão em chamas", doused.burning && !doused.after, JSON.stringify(doused));

  // O pavor: a moral cai de uma vez e não se recompõe; quem já vacilava foge
  await setup();
  const terror = await ev(() => {
    const lab = window.__lab;
    const w = window.__world;
    const sq = lab.squad();
    const morale0 = sq.morale;
    const p = w.castAt("TERROR", sq.center);
    lab.step(0.2);
    const hit = sq.morale;
    lab.step(4);
    const later = sq.morale;
    const first = w.lastTerror;
    // Passado o pavor, a tropa volta a se recompor
    lab.step(7);
    const after = sq.morale;
    // Uma tropa já abalada quebra
    w.spellReadyAt = {};
    window.__store.setState({ arcane: 100 });
    // (o líder sorteado pode baixar o limite de pânico da tropa: começa bem abalada)
    sq.morale = 45;
    sq.dreadUntil = 0;
    w.castAt("TERROR", sq.center);
    lab.step(0.5);
    return { p, morale0, hit, later, after, first, broke: sq.panicking, shaken: Math.round(sq.morale) };
  });
  await drawFresh();
  await page.screenshot({ path: `${SHOTS}-pavor.png` });
  console.log("   pavor:", JSON.stringify(terror));
  // (45 de pavor, menos o que o lorde firma, 0,7, e a bandeira à vista, 0,85: uns 27)
  check("o pavor derruba a moral de uma vez, e ela não volta enquanto dura", terror.p === null && terror.first?.struck === 1 && terror.hit <= terror.morale0 - 25 && terror.later <= terror.hit + 1, JSON.stringify(terror));
  check("passado o pavor, a tropa se recompõe; a que já vacilava foge", terror.after > terror.later + 5 && terror.broke, JSON.stringify(terror));

  // O pavor não escolhe lado, e os mortos-vivos não sentem medo
  const sides = await ev(() => {
    const lab = window.__lab;
    const w = window.__world;
    w.spellReadyAt = {};
    window.__store.setState({ arcane: 100 });
    const b = lab.battalion();
    const m0 = b.morale;
    w.castAt("TERROR", b.center);
    lab.step(0.3);
    return { ours: w.lastTerror.ours, m0, m1: b.morale };
  });
  check("o pavor no meio dos nossos assusta os nossos", sides.ours >= 1 && sides.m1 <= sides.m0 - 25, JSON.stringify(sides));
  await battle({ army: [["INFANTRY"]], force: { SKELETON: 8 }, faction: "UNDEAD", setup: "s.magic = true;" });
  const undead = await ev(() => {
    const lab = window.__lab;
    const w = window.__world;
    lab.freezeAI();
    w.commander.x = 3700;
    w.commander.y = 3600;
    lab.place(lab.battalion(), 3400, 3800, 0, 4);
    const sq = lab.squad();
    lab.placeSquad(sq, 4000, 3600, Math.PI);
    const m0 = sq.morale;
    const p = w.castAt("TERROR", sq.center);
    lab.step(0.3);
    return { p, m0, m1: sq.morale, terror: w.lastTerror };
  });
  check("os mortos-vivos não sentem o pavor", undead.p === null && undead.m1 === undead.m0 && undead.terror.fearless >= 1 && undead.terror.struck === 0, JSON.stringify(undead));

  // --- 16.4: o preço, e a calamidade mágica ---
  // Cada magia chega às cortes e aos templos; o arcano gasto marca o corpo
  await setup();
  const price = await ev(() => {
    const st = window.__store;
    const w = window.__world;
    const lab = window.__lab;
    st.setState({ honor: 50, fear: 10, arcaneSpent: 220, magicTalkDay: -1, leader: { ...st.getState().leader, marks: 0 } });
    lab.step(0.1);
    const hp0 = w.commander.maxHp;
    const talk = () => st.getState().log.filter((e) => /Corre a notícia da magia/.test(e.text)).length;
    const p = w.castAt("FIREBALL", lab.squad().center);
    lab.step(1);
    const after = st.getState();
    const first = { honor: after.honor, fear: after.fear, talk: talk() };
    const p2 = w.castAt("MEND", lab.battalion().center);
    lab.step(0.5);
    const s = st.getState();
    return {
      p,
      p2,
      first,
      second: { honor: s.honor, fear: s.fear, talk: talk() },
      spent: s.arcaneSpent,
      marks: s.leader.marks ?? 0,
      hp0,
      hp1: w.commander.maxHp,
      markLog: s.log.some((e) => /marca nova/.test(e.text)),
      markFeed: w.feed.some((l) => /marca nova/.test(l)),
    };
  });
  console.log("   preço:", JSON.stringify(price));
  check("cada magia lançada custa Honra e traz Temor: as cortes e os templos sabem", price.p === null && price.first.honor === 47 && price.first.fear === 13 && price.first.talk === 1, JSON.stringify(price.first));
  check("a cura custa menos, e a crônica fala da magia uma vez por dia", price.p2 === null && price.second.honor === 46 && price.second.fear === 13 && price.second.talk === 1, JSON.stringify(price.second));
  check(
    "o arcano gasto deixa uma marca no corpo, que tira vida do Comandante",
    price.marks === 1 && price.markLog && price.markFeed && price.hp1 < price.hp0 * 0.96,
    JSON.stringify({ marks: price.marks, hp0: price.hp0, hp1: price.hp1, spent: price.spent }),
  );

  // O Lorde Necromante responde com magia: lança o pavor no bando; os mortos dele não sentem, e queimam mais
  await battle({ army: [["INFANTRY"]], force: { NECROMANCER: 1, SKELETON: 6 }, faction: "UNDEAD" });
  const necro = await ev(() => {
    const lab = window.__lab;
    const w = window.__world;
    lab.freezeAI();
    for (const e of w.enemies) w.duelDone.add(e);
    lab.parkCommander();
    const b = lab.battalion();
    lab.place(b, 3600, 3600, 0, 4);
    const squads = w.warbands.bands.flatMap((x) => x.host?.squads ?? []);
    squads.forEach((sq, i) => lab.placeSquad(sq, 3960 + i * 60, 3600 + i * 120, Math.PI));
    const boss = w.enemies.find((e) => e.kind === "NECROMANCER");
    const m0 = b.morale;
    let at = null;
    lab.step(6, (scene) => {
      if (scene.lastTerror?.by && at === null) at = scene.time.now;
      return at !== null;
    });
    const first = { ...w.lastTerror, dread: b.dreadUntil > w.time.now, m1: Math.round(b.morale) };
    lab.step(19);
    const casts = w.feed.filter((l) => /Lorde Necromante lança o pavor/.test(l)).length;
    // O fogo nos mortos e nos vivos
    const sk = w.enemies.find((e) => e.kind === "SKELETON" && e.isAlive);
    const s0 = sk.hp;
    sk.scorch(10, null, null);
    const soldier = b.soldiers.find((s) => s.isAlive);
    const h0 = soldier?.hp ?? 0;
    soldier?.scorch(10, null, null);
    return { boss: !!boss, m0, first, casts, skeleton: s0 - sk.hp, soldier: soldier ? h0 - soldier.hp : null };
  });
  console.log("   necromante:", JSON.stringify(necro));
  check(
    "o Lorde Necromante lança o pavor no bando, e o batalhão não se recompõe",
    necro.boss && necro.first.by === "O Lorde Necromante" && necro.first.ours >= 1 && necro.first.dread && necro.first.m1 < necro.m0,
    JSON.stringify(necro.first),
  );
  check("ele lança de novo depois de um tempo", necro.casts >= 2, String(necro.casts));
  check("os mortos queimam mais: o fogo fere o esqueleto 1,6 vez o que fere um soldado", Math.abs(necro.skeleton - 16) < 0.01 && necro.soldier !== null && Math.abs(necro.soldier - 10) < 0.01, JSON.stringify(necro));

  // O "Pronto quando": oito contra dezesseis salteadores. Sem magia o batalhão cai; com a magia bem usada, eles fogem.
  // (Contra um exército do reino, o lorde firma a tropa, e duas magias não bastam: a magia quebra a ralé, não a disciplina)
  const fight = async (magic) => {
    await battle({ army: [["INFANTRY"]], force: { BANDIT: 16 }, faction: "BANDITS", setup: magic ? "s.magic = true;" : "" });
    return ev((magic) => {
      const lab = window.__lab;
      const w = window.__world;
      const st = window.__store;
      for (const e of w.enemies) w.duelDone.add(e);
      st.setState({ honor: 50, fear: 10 });
      w.commander.x = 3500;
      w.commander.y = 3600;
      lab.place(lab.battalion(), 3640, 3600, 0, 4);
      const squads = w.warbands.bands.flatMap((x) => x.host?.squads ?? []);
      squads.forEach((sq, i) => lab.placeSquad(sq, 4300, 3450 + i * 300, Math.PI));
      // Sem a passiva do tenente sorteado, que muda quanto o esquadrão aguenta: o teste mede a magia
      // (no jogo, um tenente Inabalável pode segurar a tropa)
      for (const sq of squads) sq.passive = null;
      const alive = (sq) => sq.soldiers.filter((s) => s.isAlive).length;
      const casts = [];
      let t = 0;
      while (t < 90 && !st.getState().scenarioResult) {
        lab.attackNearest();
        const b = lab.battalion();
        // O Comandante fica atrás do batalhão
        if (!b.isDestroyed) {
          w.commander.x = b.center.x - 140;
          w.commander.y = b.center.y;
        }
        if (magic) {
          const reach = squads.filter((sq) => alive(sq) > 0 && !sq.panicking && Math.hypot(sq.center.x - w.commander.x, sq.center.y - w.commander.y) < 440);
          const dense = [...reach].sort((a, c) => alive(c) - alive(a))[0];
          // A bola no esquadrão cerrado, antes que ele chegue no batalhão; o pavor logo depois, longe dos nossos
          if (dense && Math.hypot(dense.center.x - b.center.x, dense.center.y - b.center.y) > 130 && !w.castAt("FIREBALL", dense.center)) casts.push("FIREBALL");
          const far = reach.filter((sq) => Math.hypot(sq.center.x - b.center.x, sq.center.y - b.center.y) > 200).sort((a, c) => alive(c) - alive(a))[0];
          if (far && st.getState().arcane >= 45 && !w.castAt("TERROR", far.center)) casts.push("TERROR");
        }
        lab.step(0.25);
        t += 0.25;
      }
      const r = st.getState().scenarioResult;
      const s = st.getState();
      return { outcome: r?.outcome ?? null, t, ours: lab.battalion().soldiers.filter((x) => x.isAlive).length, fled: r?.enemyFled ?? 0, casts, honor: s.honor, fear: s.fear };
    }, magic);
  };
  const plainFight = await fight(false);
  const magicFight = await fight(true);
  console.log("   oito contra dezesseis:", JSON.stringify({ sem: plainFight, com: magicFight }));
  check("sem magia, oito contra dezesseis salteadores é derrota", plainFight.outcome === "DEFEAT", JSON.stringify(plainFight));
  check(
    "com a bola de fogo e o pavor bem usados, o inimigo foge e o batalhão fica de pé",
    magicFight.outcome === "VICTORY" && magicFight.ours >= 6 && magicFight.casts.includes("FIREBALL") && magicFight.casts.includes("TERROR"),
    JSON.stringify(magicFight),
  );
  check("e a vitória custou Honra e trouxe Temor", magicFight.honor <= 50 - 7 && magicFight.fear >= 10 + 7, JSON.stringify({ honor: magicFight.honor, fear: magicFight.fear }));

  // --- 16.3: aprender pelo mundo ---
  await ev(() => localStorage.clear());
  await page.reload();
  await page.waitForSelector("nav >> text=Nova campanha");
  await page.click("nav >> text=Nova campanha");
  await page.waitForSelector("text=Começar campanha");
  await page.click("text=Começar campanha");
  await page.waitForFunction(() => window.__world && !window.__world.run && window.__store.getState().battleHud && !window.__world.scene.isPaused(), null, { timeout: 60000 });
  await page.waitForTimeout(800);
  const fresh = await ev(() => {
    const s = window.__store.getState();
    return { spells: s.spells, arcane: s.arcane, grimoires: s.grimoires, hud: window.__world.magicHud() };
  });
  check("a campanha começa sem magia: sem magias, sem arcano e sem nada no campo", fresh.spells.length === 0 && fresh.arcane === 0 && fresh.grimoires.length === 0 && fresh.hud === null, JSON.stringify(fresh));
  await ev(() => window.__store.getState().setCampPanel({ kind: "TENT" }));
  await page.waitForTimeout(300);
  const hint = await ev(() => document.body.innerText.includes("O Comandante não sabe magia"));
  check("na tenda, o painel da magia diz onde ela se aprende", hint, String(hint));
  await ev(() => window.__store.getState().setCampPanel(null));

  // As ruínas assombradas limpas guardam um grimório, uma vez só
  const ruins = await ev(() => {
    const w = window.__world;
    const st = window.__store;
    const sites = w.world.sites.filter((x) => x.theme === "HAUNTED_RUINS");
    const other = w.world.sites.find((x) => x.theme !== "HAUNTED_RUINS");
    w.siteCleared(sites[0]);
    const first = [...st.getState().grimoires];
    w.siteCleared(sites[0]);
    const again = [...st.getState().grimoires];
    if (other) w.siteCleared(other);
    const afterOther = [...st.getState().grimoires];
    return { ruins: sites.length, first, again, afterOther, feed: w.feed.filter((l) => /grimório/.test(l)) };
  });
  console.log("   ruínas:", JSON.stringify(ruins));
  check(
    "as ruínas assombradas limpas dão um grimório, e as mesmas ruínas não dão outro",
    ruins.ruins >= 1 && ruins.first.join() === "FIREBALL" && ruins.again.join() === "FIREBALL" && ruins.afterOther.join() === "FIREBALL" && ruins.feed.length === 1,
    JSON.stringify(ruins),
  );

  // Estudar o grimório na tenda leva dias
  await ev(() => window.__store.getState().setCampPanel({ kind: "TENT" }));
  await page.waitForSelector("button:has-text('Estudar')");
  const day0 = await ev(() => window.__store.getState().day);
  await page.click("button:has-text('Estudar')");
  await page.waitForTimeout(400);
  const studied = await ev(() => {
    const s = window.__store.getState();
    return { spells: s.spells, grimoires: s.grimoires, day: s.day, arcane: s.arcane, panel: document.body.innerText.includes("Sabe:") };
  });
  check("estudar o grimório ensina a magia e leva 2 dias", studied.spells.join() === "FIREBALL" && studied.grimoires.length === 0 && studied.day - day0 === 2 && studied.panel, JSON.stringify({ ...studied, day0 }));
  check("com a magia aprendida, o arcano começa a voltar com os dias", studied.arcane > 0, JSON.stringify(studied));
  await page.screenshot({ path: `${SHOTS}-tenda.png` });

  // Tomar uma cidade prende o mago da corte, que pode ser forçado a ensinar
  const court = await ev(() => {
    const st = window.__store;
    const s = st.getState();
    const t = s.settlements.find((x) => x.kind === "CITY" && x.owner !== "RUINED" && x.owner !== "PLAYER") ?? s.settlements.find((x) => x.kind === "CAPITAL" && x.owner !== "PLAYER");
    st.getState().conquerSettlement(t.id);
    const mage = st.getState().captiveOfficers.find((o) => o.mage);
    return { town: t.name, mage: mage ? { name: mage.name, spell: mage.mage, ransom: mage.ransom } : null };
  });
  console.log("   corte:", JSON.stringify(court));
  check("ao tomar uma cidade, o mago da corte fica preso com a magia que sabe", !!court.mage && court.mage.spell !== "FIREBALL" && court.mage.ransom === 250, JSON.stringify(court));
  await ev(() => window.__store.getState().setCampPanel(null));
  await ev(() => window.__store.getState().setCampPanel({ kind: "TENT" }));
  await page.waitForSelector("button:has-text('Forçar a ensinar')");
  const day1 = await ev(() => window.__store.getState().day);
  await page.click("button:has-text('Forçar a ensinar')");
  await page.waitForTimeout(400);
  const forced = await ev(() => {
    const s = window.__store.getState();
    return { spells: s.spells, mages: s.captiveOfficers.filter((o) => o.mage).length, day: s.day };
  });
  check(
    "forçado, o mago ensina em 3 dias e some, sem resgate",
    !!court.mage && forced.spells.includes(court.mage.spell) && forced.mages === 0 && forced.day - day1 === 3,
    JSON.stringify({ ...forced, day1 }),
  );
  await ev(() => window.__store.getState().setCampPanel(null));

  // O mestre de outra terra: ouro e dias. Na terra do bando, não há mestre
  const masterTown = await ev(() => {
    const s = window.__store.getState();
    const atWar = new Set(s.factions.filter((f) => f.atWar).map((f) => f.id));
    const t = s.settlements.find((x) => (x.kind === "CITY" || x.kind === "CAPITAL") && x.owner !== "RUINED" && x.owner !== "PLAYER" && !atWar.has(x.owner) && !x.besiegedBy);
    return t ? t.id : null;
  });
  await ev((id) => window.__store.getState().setCampPanel({ kind: "TOWN", settlementId: id }), masterTown);
  await page.waitForTimeout(400);
  const home = await ev(() => document.body.innerText.includes("Mestre de magia"));
  await ev(() => window.__store.getState().setCampPanel(null));
  await ev(() => {
    const st = window.__store;
    st.setState({ world: { ...st.getState().world, culture: "SANDS" }, gold: 900 });
  });
  await ev((id) => window.__store.getState().setCampPanel({ kind: "TOWN", settlementId: id }), masterTown);
  await page.waitForSelector("text=Mestre de magia");
  await ev(() => [...document.querySelectorAll("h3")].find((h) => h.textContent === "Mestre de magia")?.scrollIntoView({ block: "center" }));
  await page.waitForTimeout(200);
  await page.screenshot({ path: `${SHOTS}-mestre.png` });
  const day2 = await ev(() => window.__store.getState().day);
  await page.click("button:has-text('Aprender (800 de ouro')");
  await page.waitForTimeout(400);
  const master = await ev(() => {
    const s = window.__store.getState();
    return { spells: s.spells, gold: s.gold, day: s.day, paid: s.log.some((e) => /um mestre ensinou Pavor ao Comandante, por 800 de ouro/.test(e.text)), hud: window.__world.magicHud()?.spells.map((x) => x.id) ?? null };
  });
  await ev(() => {
    const st = window.__store;
    st.getState().setCampPanel(null);
    st.setState({ world: { ...st.getState().world, culture: "REALMS" } });
  });
  check("na terra do bando, as cidades não têm mestre de magia", masterTown !== null && !home, JSON.stringify({ masterTown, home }));
  check("o mestre de outra terra ensina por 800 de ouro e 4 dias", master.spells.includes("TERROR") && master.paid && master.gold < 900 - 600 && master.day - day2 === 4, JSON.stringify({ ...master, day2 }));
  check("o que o Comandante aprendeu aparece no campo", !!master.hud && master.spells.every((sp) => master.hud.includes(sp)), JSON.stringify(master.hud));

  // O Lorde Necromante vencido deixa um artefato; o tapa-olho, as marcas e os artefatos aparecem
  const relic = await ev(() => {
    const st = window.__store;
    const s = st.getState();
    const lair = s.world.lairs[0];
    const cal = { id: "C-teste", kind: "NECROMANCER", name: "A Noite de Morvan", leader: "Morvan, o Pálido", lair: { x: lair.x, y: lair.y }, region: "o teste", startDay: s.day, power: 1, revealed: true, defeated: false, lastHordeDay: s.day };
    st.setState({ calamities: [...s.calamities, cal] });
    st.getState().defeatCalamity("C-teste");
    const after = st.getState();
    return { artifacts: after.artifacts, line: after.log.some((e) => /Entre as coisas de Morvan, o Pálido, um artefato: Pedra do Arcano/.test(e.text)), hud: window.__world.magicHud()?.max ?? null };
  });
  check("o Lorde Necromante vencido deixa um artefato, e a pedra enche mais o arcano", relic.artifacts.join() === "STONE" && relic.line && relic.hud === 130, JSON.stringify(relic));
  await ev(() => {
    const st = window.__store;
    st.setState({ leader: { ...st.getState().leader, marks: 4 }, arcaneSpent: 990 });
    st.getState().setCampPanel({ kind: "TENT" });
  });
  await page.waitForSelector("[data-magic-marks='4']");
  await ev(() => document.querySelector("[data-magic-marks]")?.scrollIntoView({ block: "center" }));
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${SHOTS}-marcas.png` });
  const marked = await ev(() => document.querySelector("[data-magic-marks]")?.textContent ?? "");
  check("a tenda mostra as marcas no corpo e o que cada uma fez", /4\/4/.test(marked) && /cabelo embranqueceu/.test(marked), marked);
}
