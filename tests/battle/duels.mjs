/** Duelos no campo (Marco 21): o herói puxa o Comandante, o anel fica vazio, a moral reage e a batalha segue. */

/** Bandidos com um chefe bravo de Duelo 4: ele procura o Comandante. */
const HERO = { faction: "BANDITS", units: { BANDIT: 14, BANDIT_ARCHER: 4 }, side: "FRONT", competence: 3, trait: "BRAVE", stance: "HOLD", duel: 4 };

/** O teste não tem dedos: no anel, o Comandante luta com uma cabeça de duelista (a mesma da IA). */
function commanderMind(skill) {
  return { temper: "STEADY", skill, think: 0.8, readAt: -1, readMove: null, guardFrom: -1, guardUntil: -1, dodgeAt: -1, dodgeSide: 1, chain: 0 };
}

export async function duels({ battle, ev }, { check }) {
  await battle({ army: [["INFANTRY"], ["INFANTRY"], ["ARCHERS"]], forces: [HERO], distance: 900 });

  // O herói larga o esquadrão e vai atrás do Comandante que está por perto
  const pulled = await ev(() => {
    const lab = window.__lab;
    const w = window.__world;
    lab.freezeAI();
    const hero = w.enemies.find((e) => e.hero && e.challenge);
    if (!hero) return { hero: false };
    const c = w.commander;
    c.x = hero.x - 380;
    c.y = hero.y;
    c.restoreHp(c.maxHp);
    // A tropa fica atrás do Comandante, fora do caminho
    w.battalions.forEach((b, i) => lab.place(b, c.x - 260, c.y - 160 + i * 160, 0, 4));
    const zoom = w.cameras.main.zoom;
    let sought = false;
    lab.step(30, () => {
      sought ||= w.duelSeekers.has(hero);
      return !!w.fieldDuel;
    });
    const fd = w.fieldDuel;
    window.__duelTest = { hero, zoom };
    return { hero: true, sought, open: !!fd, ours: fd?.ours === c, auto: fd?.auto, zoom: w.cameras.main.zoom, rate: w.tweens.timeScale, gap: fd ? Math.round(Math.hypot(hero.x - c.x, hero.y - c.y)) : null };
  });
  check("há um herói que procura o Comandante", pulled.hero, JSON.stringify(pulled));
  check("ele larga os seus e vai atrás do Comandante", pulled.sought, JSON.stringify(pulled));
  check("a 60 px, o duelo abre sem perguntar", pulled.open && pulled.ours && pulled.auto === false, JSON.stringify(pulled));
  check("fora do anel, a batalha anda na metade do tempo; a câmera vai a 200%", pulled.rate === 0.5 && pulled.zoom === 2, JSON.stringify(pulled));

  // No anel: ninguém entra, nada de fora toca nos dois, e o duelo acaba
  const ring = await ev((mind) => {
    const lab = window.__lab;
    const w = window.__world;
    const { hero } = window.__duelTest;
    const fd = w.fieldDuel;
    if (!fd) return { open: false };
    fd.minds.a = mind;
    const c = w.commander;
    const hp = { hero: hero.hp, ours: c.hp };
    // Os bandidos atacam (os arqueiros também): o anel tem de segurar
    for (const h of w.hosts.hosts) for (const s of h.squads) s.setOrder({ type: "ATTACK", target: c, lastKnown: { x: c.x, y: c.y } });
    for (const b of w.battalions) b.morale = 70;
    for (const h of w.hosts.hosts) for (const s of h.squads) s.morale = 70;
    // Um esquadrão e um batalhão com ordem de ficar dentro do anel: têm de parar na borda
    const at = fd.state.center;
    const squad = w.hosts.hosts[0]?.squads.find((s) => !s.isDestroyed && !s.soldiers.includes(hero));
    if (squad) lab.placeSquad(squad, at.x + 25, at.y + 10, Math.PI);
    lab.place(w.battalions[0], at.x - 25, at.y - 10, 0, 4);
    let closest = Infinity;
    let touched = false;
    let watchers = 0;
    let hud = null;
    let before = null;
    let steps = 0;
    lab.step(100, () => {
      const d = w.fieldDuel;
      if (!d) return true;
      steps++;
      const center = d.state.center;
      for (const u of [...w.allAllies(), ...w.activeEnemies()]) {
        if (u.dueling || !u.isAlive) continue;
        closest = Math.min(closest, Math.hypot(u.x - center.x, u.y - center.y));
      }
      if (hero.hp !== hp.hero || c.hp !== hp.ours) touched = true;
      watchers = Math.max(watchers, d.watchers.size);
      hud ??= window.__store.getState().battleHud?.duel ?? null;
      before = { ours: w.battalions.filter((b) => !b.isDestroyed).map((b) => b.morale), foes: w.hosts.hosts.flatMap((h) => h.squads.filter((s) => !s.isDestroyed).map((s) => s.morale)), state: { a: d.state.a.hp, b: d.state.b.hp, time: d.state.time } };
      return false;
    });
    const after = { ours: w.battalions.filter((b) => !b.isDestroyed).map((b) => b.morale), foes: w.hosts.hosts.flatMap((h) => h.squads.filter((s) => !s.isDestroyed).map((s) => s.morale)) };
    const won = fd.state.winner === fd.state.a ? "OURS" : fd.state.winner === fd.state.b ? "HERO" : "TIME";
    return {
      open: true,
      closed: !w.fieldDuel,
      steps,
      closest: Math.round(closest),
      touched,
      watchers,
      hud: hud && { auto: hud.auto, names: hud.fighters.map((f) => f.name) },
      won,
      duelTime: before && Math.round(before.state.time),
      before: before && { ours: before.ours.map(Math.round), foes: before.foes.map(Math.round) },
      after: { ours: after.ours.map(Math.round), foes: after.foes.map(Math.round) },
      rate: w.tweens.timeScale,
      zoom: w.cameras.main.zoom,
      zoomBefore: window.__duelTest.zoom,
      done: w.duelDone.has(hero),
      heroOnField: hero.isAlive,
      commanderAlive: c.isAlive,
      feed: window.__store.getState().battleHud?.feed?.slice(-3),
    };
  }, commanderMind(10));
  console.log("   duelo:", JSON.stringify({ won: ring.won, duelTime: ring.duelTime, before: ring.before, after: ring.after, feed: ring.feed }));
  check("ninguém entra no anel: quem estava dentro para na borda e fica olhando", ring.open && ring.closest >= 90 && ring.watchers > 0, JSON.stringify({ closest: ring.closest, watchers: ring.watchers }));
  check("golpe e flecha de fora não tocam nos dois", ring.open && !ring.touched, JSON.stringify(ring));
  check("as barras do duelo vão para a interface", ring.hud && ring.hud.auto === false && ring.hud.names.length === 2, JSON.stringify(ring.hud));
  check("o duelo acaba em até 90 s", ring.closed, JSON.stringify({ steps: ring.steps, duelTime: ring.duelTime }));
  check("no fim, o tempo e a câmera voltam", ring.rate === 1 && ring.zoom === ring.zoomBefore, JSON.stringify({ rate: ring.rate, zoom: ring.zoom, before: ring.zoomBefore }));
  check("um duelo por herói", ring.done, JSON.stringify(ring));
  if (ring.won !== "TIME" && ring.before) {
    const sum = (list) => list.reduce((n, x) => n + x, 0) / Math.max(1, list.length);
    const ours = sum(ring.after.ours) - sum(ring.before.ours);
    const foes = sum(ring.after.foes) - sum(ring.before.foes);
    const right = ring.won === "OURS" ? ours >= 5 && (ring.after.foes.length === 0 || foes <= -5) : ours <= -5 && foes >= 5;
    check("a moral reage ao duelo (quem venceu sobe, quem perdeu cai)", right, JSON.stringify({ won: ring.won, ours: Math.round(ours), foes: Math.round(foes) }));
    check("o vencido sai do anel como deve", ring.won === "OURS" ? true : ring.commanderAlive || ring.feed?.some((t) => t.includes("caiu")), JSON.stringify(ring));
  }

  // A batalha não trava: depois do duelo, ela vai até o fim
  const ending = await ev(() => {
    const lab = window.__lab;
    const w = window.__world;
    let i = 0;
    lab.step(180, () => {
      if (i++ % 30 === 0) lab.attackNearest();
      const prey = w.battalions.find((b) => !b.isDestroyed)?.soldiers[0] ?? w.commander;
      for (const h of w.hosts.hosts) for (const s of h.squads) if (s.order.type === "HOLD") s.setOrder({ type: "ATTACK", target: prey, lastKnown: { x: prey.x, y: prey.y } });
    });
    return { result: window.__store.getState().scenarioResult?.outcome ?? window.__store.getState().scenarioResult?.result ?? null, duel: !!w.fieldDuel };
  });
  check("a batalha não trava e chega ao fim", ending.result !== null && !ending.duel, JSON.stringify(ending));

  // Contra um capitão nosso: as duas cabeças lutam sozinhas, sem câmera lenta, e o diário conta
  await battle({ army: [["INFANTRY"], ["INFANTRY"]], forces: [HERO], distance: 900 });
  const captain = await ev(() => {
    const lab = window.__lab;
    const w = window.__world;
    const st = window.__store;
    const [a, b] = w.battalions;
    st.setState({
      captains: [{ id: "cap-duelo", name: "Konrad", epithet: "de Ferro", backstory: "", origin: "NOBLE", traits: ["BRAVE"], command: 3, tactics: 3, duel: 4, ambition: 2, loyalty: 70, hireCost: 100, wage: 20, battalionIds: [a.id, b.id], kills: 0, battles: 0, history: [] }],
    });
    w.armyDirty = true;
    lab.step(0.3);
    lab.freezeAI();
    lab.parkCommander();
    const guard = w.battalions.find((x) => x.captainSoldier);
    const hero = w.enemies.find((e) => e.hero && e.challenge);
    if (!guard || !hero) return { ready: false, guard: !!guard, hero: !!hero };
    const cap = guard.captainSoldier;
    lab.place(guard, hero.x - 140, hero.y, 0, 4);
    const zoom = w.cameras.main.zoom;
    let opened = null;
    lab.step(20, () => {
      lab.parkCommander();
      if (!w.fieldDuel) {
        hero.x = cap.x + 45;
        hero.y = cap.y;
        return false;
      }
      opened = { auto: w.fieldDuel.auto, ours: w.fieldDuel.ours === cap, rate: w.tweens.timeScale, zoom: w.cameras.main.zoom };
      return true;
    });
    let end = false;
    lab.step(100, () => {
      lab.parkCommander();
      end = !w.fieldDuel;
      return end;
    });
    const feed = w.feed;
    return { ready: true, opened, zoomBefore: zoom, end, line: feed.find((t) => t.includes("venceu o duelo") || t.includes("se arrastou")) ?? null };
  });
  check("o herói desafia um capitão nosso", captain.ready && captain.opened?.ours && captain.opened.auto, JSON.stringify(captain));
  check("sem o Comandante, nada de câmera lenta nem zoom", captain.opened?.rate === 1 && captain.opened?.zoom === captain.zoomBefore, JSON.stringify(captain.opened));
  check("as duas cabeças decidem, e o resultado vai para o diário", captain.end && !!captain.line, JSON.stringify(captain));
}
