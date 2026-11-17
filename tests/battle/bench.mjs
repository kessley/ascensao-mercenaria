/**
 * A bancada de batalha (Fase 4, etapa 2): forças aliadas da IA e capitães na batalha
 * personalizada. A força aliada usa o mesmo comando dos inimigos (`WarHost`), do lado do bando;
 * com ela, uma batalha de linha anda e acaba sem ninguém jogando.
 */

/** O bando fica parado bem atrás; quem luta é o aliado. */
const ALLY = { faction: "KINGDOM", units: { SOLDIER: 22, LONGBOW: 8 }, stance: "ATTACK", competence: 3, trait: "HONORABLE", allied: true, side: "REAR" };
const FOE = { faction: "GOBLINS", units: { GOBLIN: 16, GOBLIN_ARCHER: 4 }, stance: "HOLD", competence: 2, trait: "BRAVE" };

export async function bench({ battle, ev }, { check }) {
  await battle({ army: [["INFANTRY", 8]], forces: [ALLY, FOE], distance: 1600 });

  const start = await ev(() => {
    const w = window.__world;
    const run = w.run;
    window.__lab.parkCommander();
    window.__lab.step(1);
    const ally = run.friends[0];
    const foe = run.bands[0];
    const hud = window.__store.getState().scenarioHud;
    return {
      friends: run.friends.length,
      foes: run.bands.length,
      allyFriendly: ally.members.every((m) => m.friendly && !m.hostile && m.allegiance === "ALLY"),
      foeHostile: foe.members.every((m) => m.hostile && !m.friendly && m.allegiance === "ENEMY"),
      host: !!ally.host,
      enemies: hud.enemies,
      allies: hud.allies,
    };
  });
  check("a força aliada entra do nosso lado, com comando próprio", start.friends === 1 && start.allyFriendly && start.host, JSON.stringify(start));
  check("e o inimigo continua inimigo", start.foes === 1 && start.foeHostile, JSON.stringify(start));
  check("o placar conta o aliado à parte", start.enemies === 20 && start.allies === 30, JSON.stringify(start));

  // Ninguém joga: o bando segura a posição e o aliado vai atrás do inimigo que espera
  const end = await ev(() => {
    const lab = window.__lab;
    const w = window.__world;
    const st = window.__store;
    let engagedAt = null;
    for (let t = 0; t < 900 && !st.getState().scenarioResult; t += 5) {
      lab.step(5);
      if (engagedAt === null && w.run.friends[0].members.some((m) => m.isAlive && m.target?.isAlive && m.target.hostile)) engagedAt = w.run.seconds;
    }
    const r = st.getState().scenarioResult;
    return r
      ? { outcome: r.outcome, seconds: Math.round(r.seconds), engagedAt: engagedAt && Math.round(engagedAt), allies: r.allies, ours: r.battalions[0].kills, killed: r.enemyKilled, fled: r.enemyFled, friendlyFire: r.friendlyFire }
      : { outcome: null, seconds: Math.round(w.run.seconds), engagedAt };
  });
  check("a batalha com um aliado da IA acaba sozinha, sem o jogador", end.outcome === "VICTORY", JSON.stringify(end));
  check("quem derrubou o inimigo foi o aliado", (end.allies?.[0]?.kills ?? 0) > 0 && (end.allies?.[0]?.kills ?? 0) > end.ours, JSON.stringify(end.allies));
  check("a flecha do aliado no inimigo não conta como fogo amigo", end.friendlyFire === 0, `fogo amigo ${end.friendlyFire}`);

  // Linha contra linha, as duas da IA: é a medida das lutas de linha sem ninguém jogando
  await battle({
    army: [["INFANTRY", 8]],
    forces: [
      { faction: "KINGDOM", units: { SOLDIER: 20 }, stance: "ATTACK", competence: 3, trait: "HONORABLE", allied: true, side: "FRONT" },
      { faction: "KINGDOM", units: { SOLDIER: 20 }, stance: "ATTACK", competence: 3, trait: "BRAVE" },
    ],
    distance: 1400,
  });
  const line = await ev(() => {
    const lab = window.__lab;
    const w = window.__world;
    const st = window.__store;
    lab.parkCommander();
    const ally = () => w.run.friends[0];
    const foe = () => w.run.bands[0];
    let contact = null;
    let decided = null;
    for (let t = 0; t < 900 && !st.getState().scenarioResult; t += 2) {
      lab.step(2);
      if (contact === null && ally().members.some((m) => m.isAlive && m.target?.isAlive && m.target.hostile && m.inRange(m.target))) contact = w.run.seconds;
      // Uma das linhas quebrou (de pé, só 30% dos 20 que vieram): a luta de linha acabou, o resto é perseguição
      const broken = (b) => b.members.filter((m) => m.isAlive && !m.routed).length <= 20 * 0.3;
      if (contact !== null && decided === null && (broken(ally()) || broken(foe()))) decided = w.run.seconds;
    }
    const r = st.getState().scenarioResult;
    return { outcome: r?.outcome ?? null, seconds: Math.round(r?.seconds ?? w.run.seconds), contact: contact && Math.round(contact), line: contact !== null && decided !== null ? Math.round(decided - contact) : null, ally: r?.allies?.[0] };
  });
  check("duas linhas iguais da IA lutam até o fim, sem jogador", line.outcome !== null && line.line !== null, JSON.stringify(line));

  // Capitães do cenário: a ficha vem do cenário e a companhia começa na postura pedida
  await battle({
    army: [["INFANTRY"], ["INFANTRY"], ["ARCHERS"]],
    force: { GOBLIN: 6 },
    setup: "const [a, b] = s.army.battalions; s.army.captains = [{ ...mod.newCaptainSpec([a.id, b.id]), name: 'Petra', command: 5, tactics: 4, stance: 'HOLD' }];",
  });
  const cap = await ev(() => {
    const w = window.__world;
    const c = window.__store.getState().captains[0];
    const company = w.companies.list[0];
    const guard = w.battalions.find((b) => b.id === c?.battalionIds[0]);
    return { name: c?.name, command: c?.command, tactics: c?.tactics, ids: c?.battalionIds.length, stance: company?.stance, guard: !!guard?.captainAlive };
  });
  check("o capitão do cenário entra em campo com a companhia", cap.name === "Petra" && cap.command === 5 && cap.tactics === 4 && cap.ids === 2 && cap.guard, JSON.stringify(cap));
  check("e começa segurando o terreno", cap.stance === "HOLD", JSON.stringify(cap));
}
