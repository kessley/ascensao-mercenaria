/**
 * A atmosfera (G6): a noite e o fogo, o clima, os efeitos de combate e o que a magia mexe.
 * As fotos ficam em `tests/battle/.shots-g6-*.png`.
 */
const ready = (page) => page.waitForFunction(() => window.__world && !window.__world.run && window.__store.getState().battleHud && !window.__world.scene.isPaused(), null, { timeout: 60000 });

/** As chamas animadas do acampamento: o tipo, o quadro de agora e se a animação está tocando. */
const campFlames = () =>
  window.__world.campArea.planObjects
    .filter((o) => o.active && o.texture?.key?.startsWith("fire:"))
    .map((o) => ({ kind: o.texture.key.slice(5), frame: String(o.frame.name), playing: !!o.anims?.isPlaying }));

/** Quem leva a tocha na mão agora: o Comandante e, por batalhão, quantos soldados. */
const bearers = () => {
  const w = window.__world;
  return {
    commander: w.commander.hasTorch,
    battalions: w.battalions.filter((b) => !b.isDestroyed).map((b) => b.soldiers.filter((s) => s.hasTorch).length),
    quartered: w.quartered.size,
    inCamp: w.inCamp,
  };
};

export async function atmosphere({ page, ev, battle, labScript }, { check }) {
  await ev(() => localStorage.clear());
  await page.reload();
  await page.waitForSelector("nav >> text=Nova campanha");
  await page.click("nav >> text=Nova campanha");
  await page.waitForSelector("text=Começar campanha");
  await page.click("text=Começar campanha");
  await ready(page);
  await page.waitForTimeout(1000);

  // --- Parte 1: a noite e o fogo ---
  // O acampamento com a forja, a fogueira das histórias e a sentinela (as tochas nos postes)
  const placed = await ev(() => {
    const S = window.__store;
    const st = () => S.getState();
    S.setState({ gold: 99999, iron: 999, rations: 999, nextEventDay: 99999, nextCalamityDay: 99999, dayProgress: 0.5, depot: { ...st().depot, WOOD: 999 }, campPlan: { ...st().campPlan, size: 28 } });
    const out = [];
    for (const k of ["FORGE", "STORY_FIRE", "SENTRY", "OFFICERS_TENT"]) {
      outer: for (let y = -13; y <= 11; y++) for (let x = -13; x <= 11; x++) if (st().placeBuilding(k, x, y) === null) { out.push(k); break outer; }
    }
    S.setState({ campPlan: { ...st().campPlan, buildings: st().campPlan.buildings.map(({ built, ...r }) => r) } });
    return out;
  });
  await page.waitForTimeout(1500);
  const samples = [];
  for (let i = 0; i < 6; i++) {
    samples.push(await ev(campFlames));
    await page.waitForTimeout(130);
  }
  const first = samples[0];
  const count = (k) => first.filter((f) => f.kind === k).length;
  // Cada chama passa por mais de um quadro; as tochas de uma vez não estão todas no mesmo
  const moving = first.filter((_, i) => new Set(samples.map((s) => s[i]?.frame)).size >= 2).length;
  const torchFrames = new Set(first.filter((f) => f.kind === "TORCH").map((f) => f.frame));
  const flames = { placed, BONFIRE: count("BONFIRE"), EMBER: count("EMBER"), TORCH: count("TORCH"), playing: first.every((f) => f.playing), moving, of: first.length, torchFrames: torchFrames.size };
  console.log("   chamas:", JSON.stringify(flames));
  check(
    "a fogueira, a brasa da forja e as tochas são chamas de pixel animadas",
    placed.includes("FORGE") && flames.BONFIRE >= 2 && flames.EMBER >= 1 && flames.TORCH >= 2 && flames.playing && moving === first.length,
    JSON.stringify(flames),
  );
  check("as tochas dos postes não piscam juntas", torchFrames.size >= 2, JSON.stringify(flames));

  // De dia não há halo; à noite, cada chama tem o seu
  const day = await ev(() => ({ halos: window.__world.night.halos, torch: window.__world.commander.hasTorch }));
  await ev(() => window.__store.setState({ dayProgress: 0.95 }));
  await page.waitForTimeout(800);
  const night = await ev(() => {
    const w = window.__world;
    const lights = w.nightLights();
    const fire = lights[0];
    return { halos: w.night.halos, warm: lights.filter((l) => (l.glow ?? 0) > 0).length, fire: { glow: fire.glow, flicker: fire.flicker }, posts: w.campArea.torches.length, forges: w.campArea.forges.length };
  });
  console.log("   noite:", JSON.stringify({ day, night }));
  check("de dia, nem halo nem tocha na mão", day.halos === 0 && !day.torch, JSON.stringify(day));
  check(
    "à noite, a fogueira, os postes e a forja têm halo quente, e a fogueira tremula",
    night.halos >= 1 + night.posts && night.forges >= 1 && night.fire.glow > 0 && night.fire.flicker > 0,
    JSON.stringify(night),
  );

  // Perto do fogo, a noite fica alaranjada: o mesmo chão, com e sem o halo
  const warmth = await ev(async () => {
    const w = window.__world;
    const cam = w.cameras.main;
    const c = w.campArea.campfire;
    cam.stopFollow();
    cam.setZoom(1);
    cam.centerOn(c.x, c.y);
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    await wait(400);
    const pixel = (x, y) =>
      new Promise((res) => w.game.renderer.snapshotPixel(Math.round((x - cam.worldView.x) * cam.zoom), Math.round((y - cam.worldView.y) * cam.zoom), (col) => res(col.r - col.b)));
    const ring = async (r) => {
      let sum = 0;
      for (const a of [0.3, 2.4, 4.3]) {
        sum += await pixel(c.x + Math.cos(a) * r * 0.9, c.y + Math.sin(a) * r * 0.45);
        await wait(40);
      }
      return Math.round(sum / 3);
    };
    const on = { near: await ring(200), edge: await ring(560) };
    w.night.halo.setAlpha(0);
    await wait(300);
    const off = { near: await ring(200), edge: await ring(560) };
    w.night.halo.setAlpha(1);
    return { on, off };
  });
  console.log("   calor (vermelho − azul):", JSON.stringify(warmth));
  check("perto da fogueira, a noite fica alaranjada (o halo esquenta a cor)", warmth.on.near > warmth.off.near + 6 && warmth.on.edge > warmth.off.edge + 3, JSON.stringify(warmth));
  await page.screenshot({ path: "tests/battle/.shots-g6-noite.png" });
  await ev(() => {
    const w = window.__world;
    w.cameras.main.setZoom(3);
    w.cameras.main.centerOn(w.campArea.campfire.x, w.campArea.campfire.y - 10);
  });
  await page.waitForTimeout(400);
  await page.screenshot({ path: "tests/battle/.shots-g6-fogueira.png" });

  // O bando sai do acampamento à noite, de tocha acesa
  await ev(() => {
    const w = window.__world;
    w.cameras.main.setZoom(1);
    w.cameras.main.startFollow(w.commander, true, 0.1, 0.1);
    w.commander.x += 1500;
  });
  await page.waitForTimeout(3000);
  // (o relógio andou na marcha: volta para o meio da noite)
  await ev(() => window.__store.setState({ dayProgress: 0.95 }));
  await page.waitForTimeout(300);
  const out = await ev(bearers);
  await ev(() => window.__world.setTorches(false));
  await page.waitForTimeout(300);
  const dark = await ev(bearers);
  await ev(() => window.__world.setTorches(true));
  await page.waitForTimeout(300);
  const relit = await ev(bearers);
  console.log("   tochas na mão:", JSON.stringify({ out, dark, relit }));
  check(
    "à noite, o Comandante e um em cada tanto de cada batalhão levam a tocha na mão",
    !out.inCamp && out.quartered === 0 && out.commander && out.battalions.length > 0 && out.battalions.every((n) => n >= 1 && n <= 5),
    JSON.stringify(out),
  );
  check("tochas apagadas: ninguém leva a chama", !dark.commander && dark.battalions.every((n) => n === 0), JSON.stringify(dark));
  check("acesas de novo, a chama volta à mão", relit.commander && relit.battalions.every((n) => n >= 1), JSON.stringify(relit));
  await ev(() => {
    const w = window.__world;
    window.__store.setState({ dayProgress: 0.95 });
    w.cameras.main.stopFollow();
    w.cameras.main.setZoom(2.5);
    const s = w.battalions[0].soldiers.find((x) => x.hasTorch) ?? w.commander;
    w.cameras.main.centerOn(s.x, s.y - 10);
  });
  await page.waitForTimeout(500);
  await page.screenshot({ path: "tests/battle/.shots-g6-tochas.png" });
  // De manhã, a tocha some da mão
  await ev(() => window.__store.setState({ dayProgress: 0.4 }));
  await page.waitForTimeout(500);
  const morning = await ev(bearers);
  check("de manhã, a tocha some da mão", !morning.commander && morning.battalions.every((n) => n === 0), JSON.stringify(morning));

  // --- Parte 2: o clima ---
  // O tempo e o vento ficam presos pelo teste; a câmera volta para as bandeiras do acampamento
  const weather = (kind, wind) =>
    ev(([kind, wind]) => {
      const w = window.__world;
      w.forcedWeather = kind;
      w.forcedWind = wind;
      w.lastWeatherAt = -Infinity;
    }, [kind, wind]);
  const sky = () => {
    const w = window.__world;
    const flags = w.campArea.planObjects.filter((o) => o.active && o.texture?.key?.startsWith("flag:"));
    const g = w.groundWeather;
    return {
      weather: w.weather,
      ...w.weatherLayer.stats,
      wet: Math.round(g.wetness * 1000) / 1000,
      snow: Math.round(g.snow * 1000) / 1000,
      puddles: g.shownPuddles,
      cover: g.cover.filter((t) => t.visible).length,
      flags: flags.length,
      waving: flags.filter((f) => f.waving >= 1).length,
      west: flags.filter((f) => f.flipX).length,
    };
  };
  await ev(() => {
    const w = window.__world;
    window.__store.setState({ dayProgress: 0.45 });
    const c = w.campArea.campfire;
    w.cameras.main.stopFollow();
    w.cameras.main.setZoom(2);
    w.cameras.main.centerOn(c.x, c.y - 40);
  });
  await weather("CLEAR", { dir: 1, strength: 0.05 });
  await page.waitForTimeout(600);
  const calm = await ev(sky);
  await weather("RAIN", { dir: 1, strength: 0.6 });
  await page.waitForTimeout(1500);
  const rain = await ev(sky);
  await page.screenshot({ path: "tests/battle/.shots-g6-chuva.png" });
  await weather("RAIN", { dir: -1, strength: 0.6 });
  await page.waitForTimeout(800);
  const rainWest = await ev(sky);
  console.log("   chuva:", JSON.stringify({ calm, rain, rainWest }));
  check("na calmaria as bandeiras caem no mastro, e não chove", calm.flags >= 2 && calm.waving === 0 && calm.drops === 0 && calm.cover === 0, JSON.stringify(calm));
  check(
    "na chuva caem gotas que respingam, inclinadas para onde o vento sopra",
    rain.weather === "RAIN" && rain.drops > 100 && rain.splashes > 0 && rain.slant > 0 && rainWest.slant < 0,
    JSON.stringify({ rain, rainWest }),
  );
  check(
    "ao vento as bandeiras tremulam, viradas para onde ele sopra",
    rain.waving === rain.flags && rain.west === 0 && rainWest.waving === rainWest.flags && rainWest.west === rainWest.flags,
    JSON.stringify({ rain, rainWest }),
  );
  // O chão encharca aos poucos; encharcado, aparecem as poças
  await ev(() => (window.__world.groundWeather.wetness = 1));
  await ev(() => window.__world.cameras.main.setZoom(1));
  await page.waitForTimeout(500);
  const soaked = await ev(sky);
  check("a chuva molha o chão aos poucos, e o chão encharcado tem poças", rain.wet > 0 && rainWest.wet > rain.wet && soaked.puddles > 0, JSON.stringify({ rain: rain.wet, rainWest: rainWest.wet, soaked }));

  // A neve cai devagar, sem respingo, e cobre o chão em manchas
  await weather("SNOW", { dir: 1, strength: 0.3 });
  await page.waitForTimeout(1200);
  const snowing = await ev(sky);
  await ev(() => {
    const w = window.__world;
    w.groundWeather.snow = 0.8;
    w.cameras.main.setZoom(2);
  });
  await page.waitForTimeout(500);
  const snowy = await ev(sky);
  await page.screenshot({ path: "tests/battle/.shots-g6-neve.png" });
  console.log("   neve:", JSON.stringify({ snowing, snowy }));
  check(
    "na neve caem flocos sem respingo, e a neve vai cobrindo o chão",
    snowing.drops > 100 && snowing.splashes === 0 && snowing.slant === 0 && snowing.snow > 0 && snowy.cover >= 1,
    JSON.stringify({ snowing, snowy }),
  );

  // O nevoeiro: calmaria e bancos de névoa que passam
  await weather("FOG", { dir: 1, strength: 0.05 });
  await page.waitForTimeout(800);
  const fog = await ev(sky);
  await page.screenshot({ path: "tests/battle/.shots-g6-nevoeiro.png" });
  console.log("   nevoeiro:", JSON.stringify(fog));
  check("no nevoeiro passam bancos de névoa, sem chuva e com as bandeiras caídas", fog.banks >= 5 && fog.drops === 0 && fog.waving === 0, JSON.stringify(fog));

  // Com tempo aberto, a neve derrete e o chão seca
  await weather("CLEAR", { dir: 1, strength: 0.3 });
  await page.waitForTimeout(1200);
  const after = await ev(sky);
  console.log("   depois:", JSON.stringify(after));
  check("com tempo aberto, a neve derrete e o chão seca devagar", after.snow < snowy.snow && after.wet < 1 && after.wet > 0.9 && after.banks === 0, JSON.stringify(after));
  await ev(() => {
    const w = window.__world;
    w.forcedWeather = null;
    w.forcedWind = null;
    w.lastWeatherAt = -Infinity;
  });

  // --- Parte 3: os efeitos de combate ---
  // (a suíte recarregou a página no começo: o laboratório volta para ela)
  await page.evaluate(labScript);
  // No laboratório o relógio para entre os passos: a foto desenha o quadro à mão
  const draw = () =>
    ev(() => {
      const g = window.__world.sys.game;
      g.renderer.preRender();
      g.scene.render(g.renderer);
      g.renderer.postRender();
    });
  /** Uma tropa de tiro contra uma parada; mede os projéteis no ar e o que fica no chão. */
  const volley = async (troop, untilFlying = 0) => {
    await battle({ army: [[troop]], force: { SOLDIER: 12 }, faction: "KINGDOM" });
    return ev((untilFlying) => {
      const lab = window.__lab;
      const w = window.__world;
      const fx = w.combatFx;
      lab.freezeAI();
      lab.parkCommander();
      const b = lab.battalion();
      lab.place(b, 3800, 3600, 0, 4);
      const sq = lab.squad();
      lab.placeSquad(sq, 4010, 3600, Math.PI);
      sq.setOrder({ type: "HOLD", point: { x: 4010, y: 3600 }, facing: Math.PI });
      for (const s of sq.soldiers) s.hostile = true;
      w.cameras.main.stopFollow();
      w.cameras.main.setZoom(2);
      w.cameras.main.centerOn(3905, 3570);
      b.orderAttack(sq.soldiers[0]);
      const kinds = new Set();
      const dirs = new Set();
      let lift = 0;
      let flying = 0;
      let chips = 0;
      lab.step(8, () => {
        for (const f of fx.flights) {
          kinds.add(f.kind);
          const p = f.timer.getProgress();
          lift = Math.max(lift, f.from.y + (f.to.y - f.from.y) * p - (f.bob.y + 8));
          dirs.add(f.bob.frame.name);
        }
        flying = Math.max(flying, fx.stats.flying);
        chips = Math.max(chips, fx.stats.chips);
        // (para a foto: com a salva no meio do caminho, no alto do arco)
        const midway = [...fx.flights].filter((f) => Math.abs(f.timer.getProgress() - 0.5) < 0.15).length;
        return untilFlying > 0 && midway >= untilFlying && w.run.seconds > 2;
      });
      return { kinds: [...kinds], dirs: dirs.size, lift: Math.round(lift), flying, chips, stuck: fx.stats.stuck, hurt: Math.round(lab.hurt(sq.soldiers)) };
    }, untilFlying);
  };
  const arrows = await volley("ARCHERS", 8);
  await draw();
  await page.screenshot({ path: "tests/battle/.shots-g6-flechas.png" });
  const landed = await ev(() => {
    const lab = window.__lab;
    const fx = window.__world.combatFx;
    let chips = 0;
    lab.step(8, () => {
      chips = Math.max(chips, fx.stats.chips);
    });
    return { stuck: fx.stats.stuck, chips, stains: fx.stats.stains, flying: fx.stats.flying };
  });
  const bolts = await volley("CROSSBOW");
  const javelins = await volley("JAVELINS");
  console.log("   projéteis:", JSON.stringify({ arrows, landed, bolts, javelins }));
  check(
    "as flechas voam em arco, viradas para onde vão (sobem e descem)",
    arrows.kinds.join() === "ARROW" && arrows.flying >= 8 && arrows.lift > 25 && arrows.dirs >= 3,
    JSON.stringify(arrows),
  );
  check("o virote voa quase reto; o dardo tem desenho próprio", bolts.kinds.join() === "BOLT" && bolts.lift < 15 && bolts.flying > 0 && javelins.kinds.join() === "JAVELIN", JSON.stringify({ bolts, javelins }));
  check("a flecha que não acerta ninguém fica fincada no chão; a que acerta, respinga", landed.stuck > arrows.stuck && Math.max(arrows.chips, landed.chips) > 0 && landed.stains > 0, JSON.stringify(landed));

  // A investida: poeira a galope, e a nuvem do choque, que se vê de longe
  await battle({ army: [["CAVALRY"]], force: { SOLDIER: 10 }, faction: "KINGDOM", competence: 2 });
  const charge = await ev(() => {
    const lab = window.__lab;
    const w = window.__world;
    const fx = w.combatFx;
    lab.freezeAI();
    lab.parkCommander();
    const b = lab.battalion();
    lab.place(b, 3700, 3600, 0, 4);
    const sq = lab.squad();
    lab.placeSquad(sq, 4300, 3600, Math.PI);
    w.cameras.main.stopFollow();
    w.cameras.main.setZoom(1);
    w.cameras.main.centerOn(4150, 3600);
    b.orderAttack(sq.soldiers[0]);
    let gallop = 0;
    let at = null;
    lab.step(12, () => {
      if (fx.stats.impacts === 0) gallop = Math.max(gallop, fx.stats.puffs);
      else if (at === null) at = w.run.seconds;
      return at !== null && w.run.seconds - at > 0.4;
    });
    const hit = fx.lastImpact;
    if (hit) {
      w.cameras.main.setZoom(2);
      w.cameras.main.centerOn(hit.x - 40, hit.y);
    }
    return { gallop, impacts: fx.stats.impacts, puffs: fx.stats.puffs, at: at === null ? null : Math.round(at * 10) / 10 };
  });
  await draw();
  await page.screenshot({ path: "tests/battle/.shots-g6-investida.png" });
  await ev(() => {
    const w = window.__world;
    w.cameras.main.setZoom(0.5);
    window.__lab.step(0.1);
  });
  await draw();
  await page.screenshot({ path: "tests/battle/.shots-g6-investida-longe.png" });
  const melee = await ev(() => {
    const lab = window.__lab;
    const w = window.__world;
    const fx = w.combatFx;
    w.cameras.main.setZoom(1);
    lab.step(8);
    // De perto, onde a luta foi: as manchas, as poças de quem caiu e os corpos
    const hit = fx.lastImpact;
    if (hit) {
      w.cameras.main.setZoom(3);
      w.cameras.main.centerOn(hit.x, hit.y);
      lab.step(0.05);
    }
    return { stains: fx.stats.stains, sparks: fx.stats.sparks, matter: lab.battalion().soldiers.find((s) => s.isAlive)?.matter };
  });
  await draw();
  await page.screenshot({ path: "tests/battle/.shots-g6-sangue.png" });
  console.log("   investida:", JSON.stringify({ charge, melee }));
  check("a cavalaria a galope levanta poeira, e a investida, uma nuvem onde bate", charge.gallop > 0 && charge.impacts >= 1 && charge.puffs > charge.gallop, JSON.stringify(charge));
  check("o corpo a corpo mancha o chão de sangue e o golpe aparado solta faísca", melee.stains > 0 && melee.sparks > 0 && melee.matter === "BLOOD", JSON.stringify(melee));

  // Os mortos-vivos soltam osso, não sangue; e o golpe do Comandante é a meia-lua da lâmina
  await battle({ army: [["INFANTRY"]], force: { SKELETON: 6 }, faction: "UNDEAD" });
  const bones = await ev(() => {
    const lab = window.__lab;
    const w = window.__world;
    lab.freezeAI();
    const foes = lab.allEnemies();
    const c = w.commander;
    c.x = foes[0].x - 40;
    c.y = foes[0].y;
    c.lastAttackAt = -Infinity;
    c.trySwing(foes, w.time.now);
    const slashes = () => w.children.list.filter((o) => o.texture?.key === "fx:slash").length;
    const swung = slashes();
    lab.step(0.4);
    return { matter: foes[0].matter, swung, after: slashes() };
  });
  console.log("   ossos e golpe:", JSON.stringify(bones));
  check("os esqueletos soltam osso, não sangue", bones.matter === "BONE", JSON.stringify(bones));
  check("o golpe do Comandante é a meia-lua da lâmina, que some logo", bones.swung === 1 && bones.after === 0, JSON.stringify(bones));
}
