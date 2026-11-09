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

export async function atmosphere({ page, ev }, { check }) {
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
}
