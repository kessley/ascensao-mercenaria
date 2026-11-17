/**
 * O som (S1), no jogo de verdade: as ações principais disparam o som certo (espiando o registro do
 * motor, `window.__audio.log`), cada receita existe, não estoura e acaba, os volumes ficam
 * guardados, o alarme abaixa os outros e põe a seta, e 1600 soldados lutando não passam do teto de
 * vozes nem do limitador. O inventário fica em `docs/SOM.md`.
 */
const ready = (page) => page.waitForFunction(() => window.__world && !window.__world.run && window.__store.getState().battleHud && !window.__world.scene.isPaused(), null, { timeout: 60000 });

export async function sound({ page, ev, battle, labScript }, { check }) {
  await ev(() => localStorage.clear());
  await page.reload();
  await page.waitForSelector("nav >> text=Nova campanha");

  // --- As receitas, tocadas fora do tempo real ---
  const renders = await ev(async () => {
    const A = window.__audio;
    const [alarm, ui, combat, voice, speech] = await Promise.all([
      import("/src/audio/alarmSounds.ts"),
      import("/src/audio/uiSounds.ts"),
      import("/src/audio/combatSounds.ts"),
      import("/src/audio/voice.ts"),
      import("/src/audio/speech.ts"),
    ]);
    const measure = async (name, recipe, seconds, volume = 1) => {
      const buf = await A.render(recipe, seconds + 0.25);
      let peak = 0;
      let bad = false;
      for (let i = 0; i < buf.length; i++) {
        const v = Math.abs(buf[i]);
        if (!Number.isFinite(v)) bad = true;
        else if (v > peak) peak = v;
      }
      return { name, peak: peak * volume, tail: Math.abs(buf[buf.length - 1]), bad };
    };
    const out = [];
    for (const [k, d] of Object.entries(alarm.ALARM_SOUNDS)) out.push(await measure(`alarme:${k}`, d.recipe, d.seconds, d.volume));
    for (const [k, d] of Object.entries(ui.UI_SOUNDS)) out.push(await measure(`ui:${k}`, d.recipe, d.seconds, d.volume ?? 1));
    for (const [k, d] of Object.entries(combat.COMBAT_SOUNDS)) out.push(await measure(k, d.recipe, d.seconds));
    const words = {};
    for (const tongue of ["REALMS", "SANDS", "ISLES", "JADE"]) {
      for (const bark of ["select", "attack", "panic", "cheer"]) {
        const u = speech.utter({ bark, tongue, timbre: speech.TROOP_VOICE.INFANTRY, variant: 0, random: () => 0.5 });
        if (bark === "select") words[tongue] = u.text;
        out.push(await measure(`voz:${tongue}:${bark}`, voice.speakRecipe(u), u.seconds));
      }
    }
    return { out, words };
  });
  const list = renders.out;
  console.log(`   receitas: ${list.length}; maiores picos: ${[...list].sort((a, b) => b.peak - a.peak).slice(0, 4).map((r) => `${r.name} ${r.peak.toFixed(2)}`).join(", ")}`);
  const mute = list.filter((r) => r.peak < 0.005).map((r) => r.name);
  check("toda receita soa (nenhuma muda)", mute.length === 0, mute.join(", ") || `${list.length} receitas`);
  const loud = list.filter((r) => r.bad || r.peak >= 0.95).map((r) => `${r.name} ${r.peak.toFixed(2)}`);
  check("nenhuma estoura sozinha", loud.length === 0, loud.join(", "));
  const tails = list.filter((r) => r.tail > 0.01).map((r) => r.name);
  check("toda receita acaba (nada fica soando)", tails.length === 0, tails.join(", "));
  check("cada cultura responde com outras palavras", new Set(Object.values(renders.words)).size >= 3, JSON.stringify(renders.words));

  // --- Os volumes ficam guardados ---
  await ev(() => {
    window.__audio.setBusVolume("music", 0.33);
    window.__audio.setBusVolume("combat", 0.66);
  });
  await page.reload();
  await page.waitForSelector("nav >> text=Nova campanha");
  const buses = await ev(() => window.__audio.getSettings().buses);
  check("os cinco volumes ficam guardados", Object.keys(buses).length === 5 && Math.abs(buses.music - 0.33) < 1e-6 && Math.abs(buses.combat - 0.66) < 1e-6, JSON.stringify(buses));
  await ev(() => localStorage.clear());
  await page.reload();
  await page.waitForSelector("nav >> text=Nova campanha");

  // --- As ações principais da campanha ---
  await page.click("nav >> text=Nova campanha");
  await page.waitForSelector("text=Começar campanha");
  await page.click("text=Começar campanha");
  await ready(page);
  await page.waitForTimeout(1500);
  const heard = (prefix) => ev((p) => window.__audio.log.filter((e) => e.name.startsWith(p)).map((e) => `${e.name}|${e.bus}`), prefix);
  const clear = () => ev(() => (window.__audio.log.length = 0));

  await clear();
  await ev(() => window.__store.getState().sendBattleCommand({ type: "SELECT", ids: [window.__world.battalions[0].id], additive: false }));
  await page.waitForTimeout(400);
  const picked = await heard("voz:");
  check("a tropa escolhida responde, pela voz", picked.length === 1 && picked[0].startsWith("voz:select:") && picked[0].endsWith("|voice"), JSON.stringify(picked));
  await page.waitForTimeout(1200);
  await clear();
  await ev(() => window.__store.getState().sendBattleCommand({ type: "HOLD", ids: [window.__world.battalions[0].id] }));
  await page.waitForTimeout(500);
  const ordered = await heard("voz:");
  check("a ordem tem resposta", ordered.some((n) => n.startsWith("voz:hold:")), JSON.stringify(ordered));

  await clear();
  await page.click("button:has-text('Canais')");
  await page.waitForTimeout(250);
  await page.click("button:has-text('Canais')");
  const clicks = await heard("ui:click");
  check("o botão responde com um clique", clicks.length >= 1, JSON.stringify(clicks));

  await clear();
  await ev(() => window.__store.getState().setCampPanel({ kind: "CAMP_PLAN" }));
  await page.waitForTimeout(400);
  await ev(() => window.__store.getState().setCampPanel(null));
  await page.waitForTimeout(400);
  await ev(() => window.__store.getState().setWorldMapOpen(true));
  await page.waitForTimeout(400);
  await ev(() => window.__store.getState().setWorldMapOpen(false));
  await page.waitForTimeout(400);
  const panels = await heard("ui:");
  check("a planta abre virando página e fecha", panels.includes("ui:page|ui") && panels.includes("ui:close|ui"), JSON.stringify(panels));
  check("o mapa desenrola e enrola", panels.includes("ui:mapOpen|ui") && panels.includes("ui:mapClose|ui"), JSON.stringify(panels));

  // --- O alarme: inimigo dentro do acampamento ---
  await page.waitForTimeout(800);
  await clear();
  await ev(() => {
    const w = window.__world;
    window.__alarms.reset();
    const c = w.world.camp.center;
    window.__soundOrc = w.spawnEnemy(c.x + 120, c.y + 80, "ORC");
  });
  await page.waitForSelector('[data-alarm="camp"] button', { timeout: 5000 });
  const rang = await ev(() => ({
    log: window.__audio.log.filter((e) => e.name.startsWith("alarme")).map((e) => `${e.name}|${e.alarm}`),
    combat: window.__audio.busLevel("combat"),
    chosen: window.__audio.getSettings().buses.combat,
  }));
  check("inimigo no acampamento toca a corneta, como alarme", rang.log.includes("alarme:camp|true"), JSON.stringify(rang.log));
  check("o alarme abaixa os outros canais", rang.combat < rang.chosen, JSON.stringify(rang));
  await clear();
  await ev(() => window.__store.getState().sendBattleCommand({ type: "SELECT", ids: [window.__world.battalions[0].id], additive: false }));
  await page.waitForTimeout(250);
  const over = await heard("voz:");
  check("ninguém fala por cima do alarme", over.length === 0, JSON.stringify(over));

  // A câmera longe: a seta vai para a borda, do lado do acampamento; clicar leva até lá
  await ev(() => {
    const w = window.__world;
    w.setCameraLocked(false);
    w.cameras.main.centerOn(w.world.camp.center.x + 3000, w.world.camp.center.y);
  });
  await page.waitForTimeout(300);
  const edge = await ev(() => {
    const n = document.querySelector('[data-alarm="camp"]');
    const r = n?.querySelector("button")?.getBoundingClientRect();
    return { inside: n?.dataset.inside ?? null, x: r ? Math.round(r.x) : null, width: window.innerWidth };
  });
  check("fora da tela, a seta fica na borda, do lado de onde vem", edge.inside === "0" && edge.x !== null && edge.x < 100, JSON.stringify(edge));
  await page.click('[data-alarm="camp"] button');
  await page.waitForTimeout(900);
  const went = await ev(() => {
    const v = window.__world.cameras.main.worldView;
    const c = window.__world.world.camp.center;
    return { off: Math.round(Math.hypot(v.centerX - c.x, v.centerY - c.y)), arrows: document.querySelectorAll("[data-alarm]").length };
  });
  check("clicar na seta leva a câmera até lá (e a seta sai)", went.off < 60 && went.arrows === 0, JSON.stringify(went));
  await ev(() => window.__soundOrc?.die?.());

  // --- O combate: golpes, tiros, flechas, quedas e o rugido da linha ---
  // (a página foi recarregada: o laboratório entra de novo)
  await page.evaluate(labScript);
  await battle({ army: [["INFANTRY", 24], ["ARCHERS", 24]], force: { GOBLIN: 40 }, distance: 600, stance: "ATTACK" });
  const fight = await ev(async () => {
    const field = await import("/src/audio/fieldLoops.ts");
    const w = window.__world;
    window.__lab.parkCommander();
    w.setCameraLocked(false);
    window.__audio.log.length = 0;
    let roar = 0;
    let n = 0;
    window.__lab.step(30, (scene) => {
      const c = scene.battalions[0].center;
      scene.cameras.main.centerOn(c.x, c.y - 150);
      if (n++ % 30 === 0) window.__lab.attackNearest();
      roar = Math.max(roar, field.fieldSound.levels().roar);
    });
    const names = window.__audio.log.map((e) => e.name);
    const has = (p) => names.filter((x) => x.startsWith(p)).length;
    return { golpe: has("golpe:"), tiro: has("tiro:"), flecha: has("flecha:"), queda: has("queda:"), salva: has("salva"), roar: Math.round(roar * 100) / 100 };
  });
  console.log("   combate:", JSON.stringify(fight));
  check("os golpes soam", fight.golpe > 5, JSON.stringify(fight));
  check("os arcos atiram e as flechas chegam", fight.tiro > 5 && fight.flecha > 3, JSON.stringify(fight));
  check("quem cai faz barulho", fight.queda > 0, JSON.stringify(fight));
  check("o rugido da linha sobe com a luta", fight.roar > 0.15, JSON.stringify(fight));

  // --- 1600 soldados lutando ---
  await battle({ army: Array.from({ length: 8 }, () => ["INFANTRY", 100]), force: { GOBLIN: 800 }, distance: 500, stance: "ATTACK" });
  const big = await ev(async () => {
    const field = await import("/src/audio/fieldLoops.ts");
    const A = window.__audio;
    const w = window.__world;
    window.__lab.parkCommander();
    w.setCameraLocked(false);
    A.peakVoices = 0;
    let combat = 0;
    let peak = 0;
    let roar = 0;
    let n = 0;
    const running = A.ctx?.state === "running";
    window.__lab.step(15, (scene) => {
      const c = scene.battalions[3].center;
      scene.cameras.main.centerOn(c.x, c.y);
      if (n++ % 30 === 0) window.__lab.attackNearest();
      combat = Math.max(combat, A.gate.playing("combat", performance.now()));
      peak = Math.max(peak, A.outputLevel().peak);
      roar = Math.max(roar, field.fieldSound.levels().roar);
    });
    const alive = w.battalions.reduce((k, b) => k + b.soldiers.filter((s) => s.isAlive).length, 0);
    return { peakVoices: A.peakVoices, combat, peak: Math.round(peak * 1000) / 1000, roar: Math.round(roar * 100) / 100, running, alive };
  });
  console.log("   1600:", JSON.stringify(big));
  check("1600 soldados lutando não passam do teto de vozes", big.peakVoices > 10 && big.peakVoices <= 64 && big.combat <= 28, JSON.stringify(big));
  check("numa batalha grande, o rugido da linha está cheio", big.roar > 0.8, JSON.stringify(big));
  check("o limitador segura o pico da batalha grande", big.running ? big.peak > 0 && big.peak < 0.99 : true, big.running ? `pico ${big.peak}` : "sem áudio no navegador de teste: só as vozes foram medidas");
}
