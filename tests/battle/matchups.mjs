/**
 * Tropa contra tropa: oito (ou doze) de cada lado, sem Comandante por perto, com a IA ligada. É aqui
 * que se vê se cada tropa tem um papel: quem ganha de quem, e por quê.
 *
 * Cada luta é sorteada. Os casos perto do limite lutam 10 vezes, e os limites ficam onde a taxa
 * medida (20 lutas por caso, em 10 de novembro) quase nunca falha por azar: lanças contra cavalo
 * vencem 90%, cavaleiros contra lanceiros 85%, guarda pesada contra soldados 50%, contra
 * brutamontes 60% (e 35% sem fim). Os casos de 0% ou 100% lutam 6 vezes.
 */
const RUNS = 6;
const CLOSE = 10;

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

/** Vitórias do jogador em `runs` lutas (e quantas ele não perdeu: vitória ou luta sem fim). */
async function record(ctx, troop, force, faction, n = 8, hold = false, runs = RUNS) {
  let wins = 0;
  let held = 0;
  const rows = [];
  for (let i = 0; i < runs; i++) {
    const r = await duel(ctx, troop, force, faction, n, hold);
    rows.push(r);
    if (r.outcome === "VICTORY") wins++;
    if (r.outcome !== "DEFEAT") held++;
  }
  console.log(`   ${troop} contra ${Object.entries(force).map(([k, v]) => `${v} ${k}`).join(" + ")}: ${wins}/${runs} (${rows.map((r) => `${r.outcome?.[0] ?? "?"}${r.seconds}s`).join(" ")})`);
  return { wins, held, runs };
}

export async function matchups(ctx, { check }) {
  const share = (r) => `${r.wins}/${r.runs}`;
  // Lança não ataca cavalo: fica firme e deixa ele vir
  const spearVsCav = await record(ctx, "SPEARMEN", { LANCER: 6 }, "KINGDOM", 8, true, CLOSE);
  const swordVsCav = await record(ctx, "INFANTRY", { LANCER: 6 }, "KINGDOM", 8, true);
  check("lanças vencem cavalaria do mesmo custo", spearVsCav.wins >= 6, share(spearVsCav));
  check("lanças se saem melhor contra cavalo que espadas", spearVsCav.wins / spearVsCav.runs > swordVsCav.wins / swordVsCav.runs, `${share(spearVsCav)} × ${share(swordVsCav)}`);

  const cavVsBow = await record(ctx, "CAVALRY", { LONGBOW: 8 }, "KINGDOM");
  check("cavalaria vence arqueiros", cavVsBow.wins >= 4, share(cavVsBow));

  // O exército traz um lorde: oito soldados valem bem mais que oito
  const heavyVsSoldier = await record(ctx, "HEAVY", { SOLDIER: 8 }, "KINGDOM", 8, false, CLOSE);
  const swordVsSoldier = await record(ctx, "INFANTRY", { SOLDIER: 8 }, "KINGDOM");
  check("guarda pesada vence o que a infantaria não vence", heavyVsSoldier.wins / heavyVsSoldier.runs > swordVsSoldier.wins / swordVsSoldier.runs, `${share(heavyVsSoldier)} × ${share(swordVsSoldier)}`);

  const swordVsGoblins = await record(ctx, "INFANTRY", { GOBLIN: 8 }, "GOBLINS");
  check("infantaria vence goblins em igual número", swordVsGoblins.wins >= 4, share(swordVsGoblins));

  const knightVsLancer = await record(ctx, "KNIGHTS", { LANCER: 12 }, "KINGDOM", 8, false, CLOSE);
  check("cavaleiros vencem mais lanceiros montados", knightVsLancer.wins >= 5, share(knightVsLancer));

  const orcVsSoldier = await record(ctx, "INFANTRY", { ORC: 8 }, "ORCS");
  // Aguentar é não cair: contra brutamontes, a luta muitas vezes não acaba nos 150 s
  const brute = await record(ctx, "HEAVY", { ORC_BRUTE: 4 }, "ORCS", 8, false, CLOSE);
  check("orcs dão trabalho à infantaria", orcVsSoldier.wins <= 3, share(orcVsSoldier));
  check("a guarda pesada aguenta brutamontes", brute.held >= 6 && brute.wins >= 1, `${brute.wins} vitórias e ${brute.held - brute.wins} sem fim em ${brute.runs}`);
}
