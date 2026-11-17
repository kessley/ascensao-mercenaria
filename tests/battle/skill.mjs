/** Marco 24: perícia em vez de vida. A pressão de ter vários em cima, a fileira e o Comandante cercado. */
import { surrounded } from "./baseline.mjs";

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

export async function skill({ battle, ev }, { check }) {
  await battle({ army: [["INFANTRY", 2]], force: { GOBLIN: 6 }, faction: "GOBLINS", distance: 2400 });
  const six = await ev(surrounded, 6, true);
  check("cercado por 6, o Comandante sozinho apara menos de 2 golpes em 10", six.parried !== null && six.parried < 20, JSON.stringify(six));
  check("e cai em menos de um minuto", six.fell !== null, JSON.stringify(six));

  await battle({ army: [["INFANTRY", 2]], force: { GOBLIN: 1 }, faction: "GOBLINS", distance: 2400 });
  const one = await ev(surrounded, 1, true);
  check("contra um só, ele continua aparando a maioria", one.parried !== null && one.parried >= 65, JSON.stringify(one));

  await battle({ army: [["INFANTRY", 8]], force: { GOBLIN: 4 }, faction: "GOBLINS", distance: 2400 });
  const rank = await ev(pressedSoldier, false);
  await battle({ army: [["INFANTRY", 1]], force: { GOBLIN: 4 }, faction: "GOBLINS", distance: 2400 });
  const alone = await ev(pressedSoldier, true);
  check("na fileira, o soldado com 4 em cima apara mais que o isolado", rank.inRank && !alone.inRank && rank.parried > alone.parried + 8, JSON.stringify({ rank, alone }));
}
