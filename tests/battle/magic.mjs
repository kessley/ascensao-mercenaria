/**
 * Marco 19: a magia do Comandante. A parte 1 (o arcano e as primeiras magias): a bola de fogo,
 * que fere todos em volta, assusta e deixa o chão em chamas, e a cura, que fecha as feridas de um
 * batalhão e o tira do pânico. O arcano dá para poucas magias por batalha.
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
  check("o pavor derruba a moral de uma vez, e ela não volta enquanto dura", terror.p === null && terror.first?.struck === 1 && terror.hit <= terror.morale0 - 30 && terror.later <= terror.hit + 1, JSON.stringify(terror));
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
}
