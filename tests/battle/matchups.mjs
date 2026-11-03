/**
 * Tropa contra tropa: oito (ou doze) de cada lado, sem Comandante por perto, com a IA ligada. É aqui
 * que se vê se cada tropa tem um papel: quem ganha de quem, e por quê.
 */
const RUNS = 6;

async function duel({ battle, ev }, troop, force, faction, n = 8, hold = false) {
  await battle({ army: [[troop, n]], force, faction, distance: 900, stance: "ATTACK", competence: 2, trait: "BRAVE" });
  return ev((hold) => {
    const lab = window.__lab;
    lab.parkCommander();
    const w = window.__world;
    const men = [...lab.battalion().soldiers];
    w.hosts.hosts.forEach((h) => h.contacts.delete(w.commander));
    let i = 0;
    lab.step(150, () => {
      if (i++ % 30 === 0) {
        lab.parkCommander();
        if (!hold) lab.attackNearest();
        // Quem segura com lança vira a frente para quem vem, como o jogador faria
        else if (!lab.battalion().isDestroyed) {
          const c = lab.battalion().center;
          const foe = lab.allEnemies().reduce((p, e) => (!p || Math.hypot(e.x - c.x, e.y - c.y) < Math.hypot(p.x - c.x, p.y - c.y) ? e : p), null);
          if (foe) lab.battalion().facing = Math.atan2(foe.y - c.y, foe.x - c.x);
        }
      }
    });
    const res = window.__store.getState().scenarioResult;
    const foes = lab.allEnemies();
    return { outcome: res?.outcome ?? null, seconds: Math.round(w.run.seconds), own: men.filter((m) => m.isAlive).length / men.length, foe: foes.length, hurt: lab.hurt(men) };
  }, hold);
}

/** Vitórias do jogador em RUNS lutas. */
async function record(ctx, troop, force, faction, n, hold) {
  let wins = 0;
  const rows = [];
  for (let i = 0; i < RUNS; i++) {
    const r = await duel(ctx, troop, force, faction, n, hold);
    rows.push(r);
    if (r.outcome === "VICTORY") wins++;
  }
  console.log(`   ${troop} contra ${Object.entries(force).map(([k, v]) => `${v} ${k}`).join(" + ")}: ${wins}/${RUNS} (${rows.map((r) => `${r.outcome?.[0] ?? "?"}${r.seconds}s`).join(" ")})`);
  return wins;
}

export async function matchups(ctx, { check }) {
  // Lança não ataca cavalo: fica firme e deixa ele vir
  const spearVsCav = await record(ctx, "SPEARMEN", { LANCER: 6 }, "KINGDOM", 8, true);
  const swordVsCav = await record(ctx, "INFANTRY", { LANCER: 6 }, "KINGDOM", 8, true);
  check("lanças vencem cavalaria do mesmo custo", spearVsCav >= 4, `${spearVsCav}/${RUNS}`);
  check("lanças se saem melhor contra cavalo que espadas", spearVsCav > swordVsCav, `${spearVsCav} × ${swordVsCav}`);

  const cavVsBow = await record(ctx, "CAVALRY", { LONGBOW: 8 }, "KINGDOM");
  check("cavalaria vence arqueiros", cavVsBow >= 4, `${cavVsBow}/${RUNS}`);

  // O exército traz um lorde: oito soldados valem bem mais que oito
  const heavyVsSoldier = await record(ctx, "HEAVY", { SOLDIER: 8 }, "KINGDOM");
  const swordVsSoldier = await record(ctx, "INFANTRY", { SOLDIER: 8 }, "KINGDOM");
  check("guarda pesada vence o que a infantaria não vence", heavyVsSoldier > swordVsSoldier, `${heavyVsSoldier} × ${swordVsSoldier}`);

  const swordVsGoblins = await record(ctx, "INFANTRY", { GOBLIN: 8 }, "GOBLINS");
  check("infantaria vence goblins em igual número", swordVsGoblins >= 4, `${swordVsGoblins}/${RUNS}`);

  const knightVsLancer = await record(ctx, "KNIGHTS", { LANCER: 12 }, "KINGDOM");
  check("cavaleiros vencem mais lanceiros montados", knightVsLancer >= 4, `${knightVsLancer}/${RUNS}`);

  const orcVsSoldier = await record(ctx, "INFANTRY", { ORC: 8 }, "ORCS");
  const brute = await record(ctx, "HEAVY", { ORC_BRUTE: 4 }, "ORCS");
  check("orcs dão trabalho à infantaria", orcVsSoldier <= 3, `${orcVsSoldier}/${RUNS}`);
  check("a guarda pesada aguenta brutamontes", brute >= 2, `${brute}/${RUNS}`);
}
