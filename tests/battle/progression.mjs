/** Habilidades que mudam o jeito de lutar, medidas em batalha, e a tela de escolha. */
const ready = (page) => page.waitForFunction(() => window.__world && !window.__world.run && window.__store.getState().battleHud && !window.__world.scene.isPaused(), null, { timeout: 60000 });

export async function progression({ battle, ev, page, labScript }, { check }) {
  // Tiro em Marcha: passar perto do inimigo atirando, sem parar
  const pass = async (perk) => {
    await battle({ army: [["ARCHERS"]], force: { GOBLIN: 8 }, faction: "GOBLINS", distance: 900, stance: "HOLD", competence: 1 });
    return ev((perk) => {
      const lab = window.__lab;
      lab.freezeAI();
      lab.parkCommander();
      const b = lab.battalion();
      lab.place(b, 3900, 3600, 0, 4);
      lab.placeSquad(lab.squad(), 4050, 3800, Math.PI);
      for (const s of lab.squad().soldiers) s.hostile = true;
      b.mods.moveFire = perk;
      const shots = new Set();
      b.soldiers.forEach((s) => (s.lastAttackAt = -1));
      const from = b.center.x;
      b.orderMove({ x: 4700, y: 3600 }, 0);
      lab.step(6, () => {
        for (const s of b.soldiers) if (s.lastAttackAt > 0) shots.add(`${s.id ?? b.soldiers.indexOf(s)}:${s.lastAttackAt}`);
      });
      return { shots: shots.size, walked: Math.round(b.center.x - from), hurt: Math.round(lab.hurt(lab.squad().soldiers)) };
    }, perk);
  };
  const plain = await pass(false);
  const moving = await pass(true);
  console.log("   passando pelo inimigo:", JSON.stringify({ plain, moving }));
  check("sem a habilidade, arqueiro andando não atira", plain.shots === 0, JSON.stringify(plain));
  check("com Tiro em Marcha, atira andando", moving.shots > 0 && moving.hurt > 0, JSON.stringify(moving));
  check("e não para de andar", moving.walked >= plain.walked * 0.9, `${moving.walked} × ${plain.walked}`);

  // Flechas de Medo: o mesmo tiro abala mais
  const fear = async (mult) => {
    await battle({ army: [["ARCHERS"], ["ARCHERS"]], force: { SOLDIER: 8 }, faction: "KINGDOM", distance: 900, stance: "HOLD", competence: 1 });
    return ev((mult) => {
      const lab = window.__lab;
      lab.freezeAI();
      lab.parkCommander();
      const squad = lab.squad();
      lab.placeSquad(squad, 4080, 3600, Math.PI);
      window.__world.battalions.forEach((b, i) => {
        lab.place(b, 3900, 3500 + i * 200, 0, 4);
        b.soldiers.forEach((s) => (s.arrowShock = mult));
        b.orderAttack(squad.soldiers[0]);
      });
      let morale = 100;
      lab.step(14, () => {
        morale = Math.min(morale, squad.morale);
      });
      return { morale: Math.round(morale), panic: squad.panicking };
    }, mult);
  };
  const calm = await fear(1);
  const scared = await fear(3);
  console.log("   moral sob flechas:", JSON.stringify({ calm, scared }));
  check("Flechas de Medo abalam mais", scared.morale < calm.morale, `${scared.morale} × ${calm.morale}`);

  // Último Reduto: a mesma moral baixa não quebra
  const stand = async (floor) => {
    await battle({ army: [["INFANTRY"]], force: { GOBLIN: 8 }, faction: "GOBLINS", distance: 2400, stance: "HOLD", competence: 1 });
    return ev((floor) => {
      const lab = window.__lab;
      lab.parkCommander();
      const b = lab.battalion();
      b.mods.panicBelow = floor;
      b.morale = 15;
      lab.step(0.2);
      return b.panicking;
    }, floor);
  };
  check("sem a habilidade, moral 15 quebra", (await stand(25)) === true);
  check("com Último Reduto, moral 15 aguenta", (await stand(10)) === false);

  // Pela tela, numa campanha
  await ev(() => localStorage.clear());
  await page.reload();
  await page.waitForSelector("nav >> text=Nova campanha");
  await page.click("nav >> text=Nova campanha");
  await page.waitForSelector("text=Começar campanha");
  await page.click("text=Começar campanha");
  await ready(page);
  await page.waitForTimeout(700);
  await page.evaluate(labScript);
  const id = await ev(() => {
    const st = window.__store;
    const s = st.getState();
    const b = s.battalions[0];
    st.setState({ gold: 2000, iron: 50, nextEventDay: 99999, battalions: s.battalions.map((x) => (x.id === b.id ? { ...x, level: 3, skillPoints: 2 } : x)) });
    st.getState().setCampPanel({ kind: "BATTALION", battalionId: b.id });
    return b.id;
  });
  await page.waitForSelector("text=Cada nível traz uma escolha");
  await page.click("button:has-text('Escudos Reforçados')");
  await page.waitForTimeout(200);
  const lost = await page.locator("button:has-text('Disciplina de Ferro')").isDisabled();
  check("escolher pela tela trava a outra opção", lost);
  await page.screenshot({ path: "tests/battle/.shots-habilidades.png" });

  await page.click("button:has-text('Virar Guarda pesada')");
  await page.waitForTimeout(300);
  await ev(() => window.__store.getState().setCampPanel(null));
  await page.waitForTimeout(500);
  const promoted = await ev((id) => {
    const s = window.__store.getState();
    const d = s.battalions.find((b) => b.id === id);
    const f = window.__world.battalions.find((b) => b.id === id);
    return { store: d.troopType, field: f?.troopType, skills: d.skills, level: d.level, soldiers: f?.aliveCount, gold: s.gold, iron: s.iron };
  }, id);
  console.log("   promovido:", JSON.stringify(promoted));
  check("a promoção muda a tropa no campo", promoted.store === "HEAVY" && promoted.field === "HEAVY", JSON.stringify(promoted));
  check("mesma família mantém habilidades e nível", promoted.skills.length === 1 && promoted.level === 3, JSON.stringify(promoted));
  check("promoção custa ouro e ferro", promoted.gold < 2000 && promoted.iron < 50, JSON.stringify(promoted));

  const family = await ev((id) => {
    const st = window.__store;
    const s = st.getState();
    // O bando começa com um batalhão só (Marco 22): os arqueiros entram aqui
    const archers = { ...s.battalions.find((b) => b.id === id), id: "arqueiros-teste", name: "Arqueiros de Teste", troopType: "ARCHERS", level: 3, skills: ["EAGLE_EYE"], skillPoints: 1 };
    st.setState({ battalions: [...s.battalions, archers] });
    const why = st.getState().promoteBattalion(archers.id, "CROSSBOW");
    const same = st.getState().battalions.find((b) => b.id === archers.id);
    return { why, skills: same.skills, points: same.skillPoints };
  }, id);
  check("promoção na mesma família não tira nada", family.why === null && family.skills.length === 1 && family.points === 1, JSON.stringify(family));

  const train = await ev(() => {
    const st = window.__store;
    const s = st.getState();
    const first = s.battalions[0];
    return { veteran: st.getState().trainBattalions([first.id]), level: first.level };
  });
  check("veterano não aprende mais no Campo de Treino", train.veteran === false, JSON.stringify(train));
}
