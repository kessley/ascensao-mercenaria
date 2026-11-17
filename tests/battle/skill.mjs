/** Marco 24: perícia em vez de vida. A pressão de ter vários em cima, a fileira e o Comandante cercado. */
import { oneOnOne, surrounded } from "./baseline.mjs";

const median = (xs) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length === 0 ? null : s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2;
};

/** O Senhor da Guerra contra os soldados do batalhão (que não caem): quanto acertam nele, quanto ele dura, quantos giros. */
function warlord() {
  const lab = window.__lab;
  const w = window.__world;
  lab.freezeAI();
  lab.parkCommander();
  const b = lab.battalion();
  lab.place(b, 4000, 3500, 0);
  const boss = w.spawnEnemy(4080, 3500, "ORC_WARLORD");
  boss.dormant = false;
  boss.hostile = true;
  boss.setVisible(true);
  boss.home = { x: boss.x, y: boss.y };
  boss.target = b.soldiers[0];
  let swings = 0;
  let hits = 0;
  let spins = 0;
  for (const s of b.soldiers) {
    s.maxHp = 1e6;
    s.restoreHp(1e6);
    const play = s.playAttack.bind(s);
    s.playAttack = (t) => {
      if (t === boss) swings++;
      play(t);
    };
  }
  const take = boss.takeDamage.bind(boss);
  boss.takeDamage = (amount, source, time, kind) => {
    if (b.soldiers.includes(source) && kind !== "RANGED") hits++;
    take(amount, source, time, kind);
  };
  const say = boss.floatText.bind(boss);
  boss.floatText = (text, color) => {
    if (text === "giro!") spins++;
    say(text, color);
  };
  b.orderAttack(boss);
  const t0 = w.time.now;
  lab.step(90, () => {
    b.morale = 100;
    b.panicking = false;
    return !boss.isAlive;
  });
  return { hp: boss.maxHp, swings, hits, rate: swings > 0 ? Math.round((hits / swings) * 100) : null, fell: boss.isAlive ? null : Math.round((w.time.now - t0) / 100) / 10, spins };
}

/** A perícia em campo: o que o nível deu ao soldado e ao goblin. */
function skills() {
  const w = window.__world;
  const s = w.battalions[0].soldiers[0];
  const e = window.__lab.allEnemies()[0];
  return { soldier: { attack: s.attack, defense: s.defense, hp: s.maxHp }, goblin: { level: e.level, attack: e.attack, defense: e.defense, hp: e.maxHp } };
}

/** Um contra um, muitos golpes: quanto o soldado acerta o goblin (os dois não caem). */
function hitRate() {
  const lab = window.__lab;
  lab.freezeAI();
  lab.parkCommander();
  const b = lab.battalion();
  const s = b.soldiers[0];
  const e = lab.allEnemies()[0];
  lab.place(b, 4000, 3500, 0);
  e.x = 4040;
  e.y = 3500;
  e.home = { x: e.x, y: e.y };
  e.dormant = false;
  for (const u of [s, e]) {
    u.maxHp = 1e6;
    u.restoreHp(1e6);
  }
  let swings = 0;
  let hits = 0;
  const play = s.playAttack.bind(s);
  s.playAttack = (t) => {
    if (t === e) swings++;
    play(t);
  };
  const take = e.takeDamage.bind(e);
  e.takeDamage = (amount, source, time, kind) => {
    if (source === s && kind !== "RANGED") hits++;
    take(amount, source, time, kind);
  };
  b.orderAttack(e);
  e.target = s;
  lab.step(120, () => {
    b.morale = 100;
    // Os dois de frente um para o outro (o esquadrão do goblin olha para o leste: o soldado viria pelas costas)
    if (e.squad) {
      e.squad.facing = Math.PI;
      e.squad.morale = 100;
      e.squad.panicking = false;
    }
    if (e.unitState === "FLEEING") e.unitState = "ATTACKING";
  });
  return { swings, hits, rate: swings > 0 ? Math.round((hits / swings) * 100) : null, side: e.approachOf(s), state: e.unitState };
}

/** Fôlego: uma linha luta 2 minutos seguidos, e depois descansa 70 s longe da luta. */
function windedLine() {
  // Goblins que não caem na frente do batalhão (a frente olha para o leste), cada um num soldado
  const wallOfGoblins = (b, goblins) => {
    const front = Math.max(...b.soldiers.map((x) => x.x));
    const rank = b.soldiers.filter((x) => x.x > front - 8).sort((p, q) => p.y - q.y);
    goblins.forEach((e, i) => {
      const s = rank[i % rank.length];
      e.x = front + 26;
      e.y = s.y + (i >= rank.length ? 8 : 0);
      e.home = { x: e.x, y: e.y };
      e.dormant = false;
      e.target = s;
      e.maxHp = 1e6;
      e.restoreHp(1e6);
    });
    for (const s of b.soldiers) {
      s.maxHp = 1e6;
      s.restoreHp(1e6);
    }
  };
  const lab = window.__lab;
  const w = window.__world;
  lab.freezeAI();
  lab.parkCommander();
  const b = lab.battalion();
  lab.place(b, 4000, 3500, 0);
  const goblins = lab.allEnemies();
  wallOfGoblins(b, goblins);
  const hold = () => {
    b.morale = 100;
    b.panicking = false;
    for (const e of goblins) if (e.squad) {
      e.squad.morale = 100;
      e.squad.panicking = false;
    }
  };
  lab.step(120, hold);
  const fought = { tiredness: Math.round(b.tiredness), winded: Math.round(b.winded), fatigue: Math.round(b.fatigue), defense: Math.round(b.fatigueDefense * 100) };
  for (const e of goblins) {
    e.x = 7000;
    e.y = 6000;
    e.home = { x: e.x, y: e.y };
    e.target = null;
  }
  // Longe de verdade: o esquadrão deles voltaria andando para o ponto que segurava
  lab.step(70, () => {
    hold();
    for (const e of goblins) {
      e.x = 7000;
      e.y = 6000;
    }
  });
  return { fought, rested: { tiredness: Math.round(b.tiredness), winded: Math.round(b.winded) } };
}

/** Revezar: a linha da frente luta; o toque troca ela com o batalhão logo atrás. */
function relief() {
  // Goblins que não caem na frente do batalhão (a frente olha para o leste), cada um num soldado
  const wallOfGoblins = (b, goblins) => {
    const front = Math.max(...b.soldiers.map((x) => x.x));
    const rank = b.soldiers.filter((x) => x.x > front - 8).sort((p, q) => p.y - q.y);
    goblins.forEach((e, i) => {
      const s = rank[i % rank.length];
      e.x = front + 26;
      e.y = s.y + (i >= rank.length ? 8 : 0);
      e.home = { x: e.x, y: e.y };
      e.dormant = false;
      e.target = s;
      e.maxHp = 1e6;
      e.restoreHp(1e6);
    });
    for (const s of b.soldiers) {
      s.maxHp = 1e6;
      s.restoreHp(1e6);
    }
  };
  const lab = window.__lab;
  const w = window.__world;
  lab.freezeAI();
  lab.parkCommander();
  const [a, r] = w.battalions;
  lab.place(a, 4000, 3500, 0);
  lab.place(r, 3870, 3500, 0);
  // O Comandante perto, de viva voz (sem o acaso da trombeta no meio da luta)
  w.commander.x = 3780;
  w.commander.y = 3500;
  const goblins = lab.allEnemies();
  wallOfGoblins(a, goblins);
  for (const s of r.soldiers) {
    s.maxHp = 1e6;
    s.restoreHp(1e6);
  }
  const hold = () => {
    for (const b of [a, r]) {
      b.morale = 100;
      b.panicking = false;
    }
    for (const e of goblins) if (e.squad) {
      e.squad.morale = 100;
      e.squad.panicking = false;
      e.squad.facing = Math.PI;
    }
  };
  lab.step(4, hold);
  const before = { a: Math.round(a.center.x), r: Math.round(r.center.x), a0: a.status, r0: r.status };
  for (const b of w.battalions) b.selected = false;
  w.relieveLine();
  lab.step(15, hold);
  return { ...before, aAfter: Math.round(a.center.x), rAfter: Math.round(r.center.x), aStatus: a.status, rStatus: r.status, feed: w.feed.filter((t) => t.startsWith("Revezar") || t.startsWith("Ninguém para revezar")).slice(-2) };
}

/** Quatro goblins que não caem em cima de um soldado: no meio da linha do batalhão, ou sozinho. */
function pressedSoldier(alone) {
  const lab = window.__lab;
  const w = window.__world;
  lab.freezeAI();
  lab.parkCommander();
  const b = lab.battalion();
  lab.place(b, 4000, 3500, 0);
  // Na primeira fileira e no meio dela (a frente é o leste)
  const front = Math.max(...b.soldiers.map((x) => x.x));
  const s = alone ? b.soldiers[0] : b.soldiers.filter((x) => x.x > front - 8).sort((p, q) => Math.abs(p.y - 3500) - Math.abs(q.y - 3500))[0];
  const goblins = lab.allEnemies().slice(0, 4);
  let blows = 0;
  let hits = 0;
  const take = s.takeDamage.bind(s);
  s.takeDamage = (amount, source, time, kind) => {
    if (goblins.includes(source) && kind !== "RANGED") hits++;
    take(Math.min(amount, 0.01), source, time, kind);
  };
  // Pela frente, os quatro (no meio da linha, o da frente e os vizinhos do lado não deixam passar mais)
  goblins.forEach((e, i) => {
    const a = (i - 1.5) * 0.35;
    e.x = s.x + Math.cos(a) * 30;
    e.y = s.y + Math.sin(a) * 30;
    e.home = { x: e.x, y: e.y };
    e.dormant = false;
    e.target = s;
    e.maxHp = 1e6;
    e.restoreHp(1e6);
    const play = e.playAttack.bind(e);
    e.playAttack = (t) => {
      if (t === s) blows++;
      play(t);
    };
  });
  // A moral fica de pé: aqui se mede a fileira, não o pânico
  let ranked = 0;
  let looks = 0;
  lab.step(40, () => {
    b.morale = 100;
    b.panicking = false;
    looks++;
    if (s.inRank(w.time.now)) ranked++;
  });
  return { blows, hits, parried: blows > 0 ? Math.round(((blows - hits) / blows) * 100) : null, inRank: ranked > looks / 2 };
}

/** A guarda pessoal: dois brutamontes longe do chefe voltam e batem em quem está em cima dele. */
function bossGuard() {
  const lab = window.__lab;
  const w = window.__world;
  lab.freezeAI();
  lab.parkCommander();
  const b = lab.battalion();
  lab.place(b, 4000, 3500, 0);
  const boss = w.spawnEnemy(4080, 3500, "ORC_WARLORD");
  const guards = [w.spawnEnemy(4300, 3300, "ORC_BRUTE"), w.spawnEnemy(4300, 3700, "ORC_BRUTE")];
  for (const e of [boss, ...guards]) {
    e.dormant = false;
    e.hostile = true;
    e.setVisible(true);
    e.home = { x: e.x, y: e.y };
  }
  for (const g of guards) g.guardOf(boss, () => w.bossFoes());
  boss.target = b.soldiers[0];
  let guardHits = 0;
  for (const s of b.soldiers) {
    s.maxHp = 1e6;
    s.restoreHp(1e6);
    const take = s.takeDamage.bind(s);
    s.takeDamage = (amount, source, time, kind) => {
      if (guards.includes(source)) guardHits++;
      take(amount, source, time, kind);
    };
  }
  boss.maxHp = 1e6;
  boss.restoreHp(1e6);
  b.orderAttack(boss);
  lab.step(20, () => {
    b.morale = 100;
    b.panicking = false;
  });
  const near = guards.map((g) => Math.round(Math.hypot(g.x - boss.x, g.y - boss.y)));
  return { guardHits, near };
}

export async function skill({ battle, ev }, { check }) {
  await battle({ army: [["INFANTRY", 4]], force: { ORC: 1 }, faction: "ORCS", distance: 2400 });
  const guard = await ev(bossGuard);
  check("a guarda pessoal volta para o chefe e bate em quem está em cima dele", guard.guardHits > 0 && guard.near.every((d) => d < 150), JSON.stringify(guard));
  // Parte 4: a vida vem do corpo, e o golpe sai da medida
  const times = [];
  for (let i = 0; i < 6; i++) {
    await battle({ army: [["INFANTRY", 1]], force: { GOBLIN: 1 }, faction: "GOBLINS", distance: 2400 });
    const r = await ev(oneOnOne);
    if (r.won === "nosso" && r.seconds !== null) times.push(Math.round(r.seconds * 10) / 10);
  }
  const mid = median(times);
  check("um soldado derruba um goblin em 7 a 9 s", mid !== null && mid >= 6.5 && mid <= 10, JSON.stringify({ mediana: mid, tempos: times }));
  await battle({ army: [["INFANTRY", 1]], force: { ORC: 1 }, faction: "ORCS", distance: 2400 });
  const front = await ev(warlord);
  check("o Senhor da Guerra tem 160 de vida e, de frente, um soldado quase não acerta nele", front.hp === 160 && front.rate !== null && front.rate <= 25, JSON.stringify(front));
  await battle({ army: [["INFANTRY", 4]], force: { ORC: 1 }, faction: "ORCS", distance: 2400 });
  const four = await ev(warlord);
  check("cercado por 4, os soldados acertam 60% ou mais nele, e ele cai em menos de meio minuto", four.rate !== null && four.rate >= 60 && four.fell !== null && four.fell < 30, JSON.stringify(four));
  check("e ele gira a arma de tempos em tempos", four.spins >= 2, JSON.stringify(four));
  console.log("   Senhor da Guerra cercado por 4:", JSON.stringify(four));

  // Parte 3: o fôlego e o revezamento
  await battle({ army: [["INFANTRY", 8]], force: { GOBLIN: 6 }, faction: "GOBLINS", distance: 2400 });
  const breath = await ev(windedLine);
  check("uma linha fica sem fôlego em cerca de 2 minutos de luta, e defende menos", breath.fought.tiredness >= 65 && breath.fought.defense <= 90, JSON.stringify(breath));
  check("e recupera o fôlego em pouco mais de 1 minuto fora da luta", breath.rested.winded <= 10, JSON.stringify(breath));
  await battle({ army: [["INFANTRY", 8], ["INFANTRY", 8]], force: { GOBLIN: 6 }, faction: "GOBLINS", distance: 2400 });
  const swap = await ev(relief);
  check("revezar: o batalhão de trás assume a linha, e o da frente passa para trás", swap.a0 === "ENGAGED" && swap.rAfter > swap.aAfter + 40, JSON.stringify(swap));
  check("e quem assumiu está lutando, sem ninguém em pânico", swap.rStatus === "ENGAGED" && swap.aStatus !== "FLEEING", JSON.stringify(swap));

  // Parte 1: o nível vira perícia, para o bando e para o inimigo
  await battle({ army: [["INFANTRY", 1, 5]], forces: [{ faction: "GOBLINS", units: { GOBLIN: 2 }, level: 3 }], distance: 2400 });
  const vet = await ev(skills);
  await battle({ army: [["INFANTRY", 1, 1]], forces: [{ faction: "GOBLINS", units: { GOBLIN: 2 } }], distance: 2400 });
  const green = await ev(skills);
  check("o nível 5 soma 20 de ataque e de defesa, e nada de vida", vet.soldier.attack === green.soldier.attack + 20 && vet.soldier.defense === green.soldier.defense + 20 && vet.soldier.hp === green.soldier.hp, JSON.stringify({ vet: vet.soldier, green: green.soldier }));
  check("o goblin de nível 3 da batalha personalizada luta melhor, e não aguenta mais", vet.goblin.level === 3 && vet.goblin.attack === green.goblin.attack + 10 && vet.goblin.hp === green.goblin.hp, JSON.stringify({ vet: vet.goblin, green: green.goblin }));

  await battle({ army: [["INFANTRY", 1, 5]], force: { GOBLIN: 1 }, faction: "GOBLINS", distance: 2400 });
  const fiveHits = await ev(hitRate);
  await battle({ army: [["INFANTRY", 1, 1]], force: { GOBLIN: 1 }, faction: "GOBLINS", distance: 2400 });
  const oneHits = await ev(hitRate);
  check("o veterano acerta o goblin bem mais que o novato (82% contra 62%)", fiveHits.rate !== null && oneHits.rate !== null && fiveHits.rate > oneHits.rate + 8, JSON.stringify({ five: fiveHits, one: oneHits }));

  await battle({ army: [["INFANTRY", 2]], force: { GOBLIN: 6 }, faction: "GOBLINS", distance: 2400 });
  // Duro (não cai): centenas de golpes para contar o aparo; depois, de verdade, quanto ele aguenta
  const six = await ev(surrounded, { n: 6, immortal: true, tough: true });
  check("cercado por 6, o Comandante sozinho apara menos de 2 golpes em 10", six.parried !== null && six.parried < 20, JSON.stringify(six));
  await battle({ army: [["INFANTRY", 2]], force: { GOBLIN: 6 }, faction: "GOBLINS", distance: 2400 });
  const fall = await ev(surrounded, { n: 6, immortal: true });
  check("e cai em menos de um minuto", fall.fell !== null, JSON.stringify(fall));

  await battle({ army: [["INFANTRY", 2]], force: { GOBLIN: 1 }, faction: "GOBLINS", distance: 2400 });
  const one = await ev(surrounded, { n: 1, immortal: true });
  check("contra um só, ele continua aparando a maioria", one.parried !== null && one.parried >= 65, JSON.stringify(one));

  await battle({ army: [["INFANTRY", 8]], force: { GOBLIN: 4 }, faction: "GOBLINS", distance: 2400 });
  const rank = await ev(pressedSoldier, false);
  await battle({ army: [["INFANTRY", 1]], force: { GOBLIN: 4 }, faction: "GOBLINS", distance: 2400 });
  const alone = await ev(pressedSoldier, true);
  check("na fileira, o soldado com 4 em cima apara mais que o isolado", rank.inRank && !alone.inRank && rank.parried > alone.parried + 8, JSON.stringify({ rank, alone }));
}
