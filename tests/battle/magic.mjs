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
      buttons: ["Bola de fogo", "Cura"].map((n) => document.querySelectorAll(`button[aria-label='${n}']`).length),
      bar: document.body.innerText.includes("Arcano"),
    };
  });
  console.log("   começo:", JSON.stringify({ spells: start.spells, arcane: start.arcane, buttons: start.buttons, bar: start.bar }));
  check("o Comandante mago entra sabendo a bola de fogo e a cura, com o arcano cheio", start.spells.join() === "FIREBALL,MEND" && start.arcane === 100, JSON.stringify(start.spells));
  check("o campo mostra o arcano e um botão por magia, com a tecla", start.bar && start.buttons.every((n) => n === 1) && start.hud.spells.map((s) => s.key).join() === "5,6", JSON.stringify(start.buttons));

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
}
