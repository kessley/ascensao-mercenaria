/** A IA usando as tropas para o que elas servem. */
export async function ai({ battle, ev }, { check }) {
  // Cavalaria inimiga: vai nos arqueiros, foge de lança, entra e sai
  const prey = async (army) => {
    await battle({ army, force: { SOLDIER: 12, LANCER: 8 }, faction: "KINGDOM", distance: 900, stance: "ATTACK", competence: 4, trait: "AMBITIOUS" });
    return ev(() => {
      const lab = window.__lab;
      const w = window.__world;
      lab.parkCommander();
      const riders = () => w.warbands.bands[0]?.host?.squads.find((s) => s.role === "RIDERS");
      const hits = {};
      let i = 0;
      let cycles = 0;
      let wasOut = false;
      lab.step(70, () => {
        if (i++ % 10 === 0) lab.parkCommander();
        const r = riders();
        if (!r) return;
        const t = r.order.target;
        // Enquanto houver arqueiros para escolher: depois deles, só sobra lança
        const archers = w.battalions.some((x) => x.troopType === "ARCHERS" && !x.isDestroyed);
        if (archers && r.order.type === "ATTACK" && t?.battalion) hits[t.troopType] = (hits[t.troopType] ?? 0) + 1;
        const out = r.cycle.phase === "OUT";
        if (out && !wasOut) cycles++;
        wasOut = out;
      });
      return { hits, cycles };
    });
  };
  const mixed = await prey([["SPEARMEN"], ["SPEARMEN"], ["ARCHERS"]]);
  console.log("   alvo da cavalaria:", JSON.stringify(mixed));
  const onBows = mixed.hits.ARCHERS ?? 0;
  const onSpears = mixed.hits.SPEARMEN ?? 0;
  check("cavalaria inimiga prefere arqueiros a lanças", onBows > onSpears, JSON.stringify(mixed.hits));
  check("cavalaria inimiga sai do choque e volta", mixed.cycles >= 1, String(mixed.cycles));

  // Lanças inimigas firmam quando a cavalaria vem
  await battle({ army: [["CAVALRY"]], force: { PIKEMAN: 10 }, faction: "KINGDOM", distance: 900, stance: "ATTACK", competence: 4 });
  const brace = await ev(() => {
    const lab = window.__lab;
    const w = window.__world;
    lab.parkCommander();
    const b = lab.battalion();
    let held = false;
    let i = 0;
    lab.step(15, () => {
      if (i++ % 10 === 0) lab.parkCommander();
      const sq = w.warbands.bands[0]?.host?.squads.find((s) => s.soldiers.some((m) => m.canBrace));
      if (!sq) return;
      const d = Math.hypot(sq.center.x - b.center.x, sq.center.y - b.center.y);
      if (d < 420 && sq.order.type === "HOLD") held = true;
    });
    return held;
  });
  check("lanças inimigas param e firmam quando o cavalo vem", brace);

  // Arqueiros inimigos não atiram em cima dos seus (quem tem competência)
  const discipline = async (competence) => {
    await battle({ army: [["INFANTRY"], ["INFANTRY"]], force: { SOLDIER: 12, CROSSBOW: 8 }, faction: "KINGDOM", distance: 900, stance: "ATTACK", competence, setup: `s.forces[0].units = { SOLDIER: 12, LONGBOW: 12 };` });
    return ev(() => {
      const lab = window.__lab;
      const w = window.__world;
      lab.parkCommander();
      let i = 0;
      lab.step(60, () => {
        if (i++ % 10 === 0) {
          lab.parkCommander();
          lab.attackNearest();
        }
      });
      return w.run.friendlyFire;
    });
  };
  const trained = await discipline(5);
  const green = await discipline(1);
  console.log("   fogo amigo do inimigo:", JSON.stringify({ trained, green }));
  check("arqueiros treinados acertam menos os próprios homens que os novatos", trained <= green, JSON.stringify({ trained, green }));

  // Quem é pego de lado vira a frente (competência 3 ou mais)
  await battle({ army: [["INFANTRY"]], force: { SOLDIER: 10 }, faction: "KINGDOM", competence: 4 });
  const turn = await ev(() => {
    const lab = window.__lab;
    lab.parkCommander();
    const b = lab.battalion();
    const sq = lab.squad();
    lab.placeSquad(sq, 4200, 3600, 0);
    lab.place(b, 4200, 3440, Math.PI / 2, 4);
    const host = sq.command;
    host.decide = () => {};
    b.orderAttack(sq.soldiers[0]);
    const before = sq.facing;
    lab.step(8);
    return { before, after: sq.facing };
  });
  check("esquadrão pego de lado vira a frente", Math.abs(turn.after - turn.before) > 0.3, JSON.stringify(turn));

  // A batalha toda: a IA luta, sem travar
  await battle({ army: [["HEAVY"], ["SPEARMEN"], ["ARCHERS"], ["CAVALRY"]], force: {}, distance: 1400, setup: `s.forces = [Object.assign(mod.newForce("KINGDOM"), { units: { SOLDIER: 16, PIKEMAN: 6, MAN_AT_ARMS: 4, LONGBOW: 8, LANCER: 6, OUTRIDER: 2 }, competence: 4, trait: "CUNNING" })];` });
  const whole = await ev(() => {
    const lab = window.__lab;
    const w = window.__world;
    let i = 0;
    const plans = new Set();
    lab.step(240, () => {
      if (i++ % 30 === 0) {
        lab.parkCommander();
        lab.attackNearest();
      }
      const p = w.warbands.bands[0]?.host?.planLabel;
      if (p) plans.add(p);
    });
    const res = window.__store.getState().scenarioResult;
    return { outcome: res?.outcome ?? null, seconds: Math.round(w.run.seconds), plans: [...plans] };
  });
  console.log("   batalha completa:", JSON.stringify(whole));
  check("batalha completa chega ao fim sem erro", whole.outcome !== null || whole.seconds >= 200, JSON.stringify(whole));
  check("batalha grande dura pelo menos um minuto", whole.seconds >= 60, String(whole.seconds));

  // Quem desiste: batalha nenhuma acaba em segundos porque o inimigo viu que é menor
  const quit = async (forces) => {
    const runs = [];
    for (let i = 0; i < 3; i++) {
      await battle({ army: [["INFANTRY"], ["INFANTRY"], ["ARCHERS"]], forces, distance: 1100 });
      runs.push(
        await ev(() => {
          const lab = window.__lab;
          let i = 0;
          lab.step(240, () => {
            if (i++ % 30 === 0) {
              lab.parkCommander();
              lab.attackNearest();
            }
          });
          const r = window.__store.getState().scenarioResult;
          return {
            outcome: r?.outcome ?? "SEM FIM",
            seconds: Math.round(r?.seconds ?? 0),
            killed: r?.enemyKilled ?? 0,
            fled: r?.enemyFled ?? 0,
            total: r?.enemyTotal ?? 0,
            sobrou: r ? undefined : lab.allEnemies().slice(0, 8).map((e) => `${e.kind}${e.isOutrider ? "*" : ""}:${e.squad?.order.type ?? "-"}/${e.unitState}${e.routed ? "/saindo" : ""}`),
          };
        }),
      );
    }
    return runs;
  };
  const weak = await quit([{ faction: "GOBLINS", units: { GOBLIN: 10, GOBLIN_ARCHER: 4 }, competence: 3, trait: "AMBITIOUS", stance: "ATTACK" }]);
  console.log("   mais fraco:", JSON.stringify(weak));
  check("o mais fraco luta antes de fugir", weak.every((r) => r.killed >= 3 && r.seconds >= 15), JSON.stringify(weak));
  check("a batalha contra o mais fraco termina", weak.every((r) => r.outcome !== "SEM FIM"), JSON.stringify(weak));
  const coward = await quit([{ faction: "BANDITS", units: { BANDIT: 16, BANDIT_ARCHER: 6 }, competence: 3, trait: "COWARD", stance: "ATTACK" }]);
  console.log("   covarde:", JSON.stringify(coward));
  check("nem o covarde larga a luta com a primeira baixa", coward.every((r) => r.killed >= 4), JSON.stringify(coward));
  const held = await quit([{ faction: "BANDITS", units: { BANDIT: 10, BANDIT_ARCHER: 4 }, competence: 3, trait: "GREEDY", stance: "HOLD" }]);
  console.log("   em posição:", JSON.stringify(held));
  check("força em posição também termina", held.every((r) => r.outcome !== "SEM FIM"), JSON.stringify(held));

  // Só batedores sobrando: eles rondam e fogem de quem chega perto, ninguém os alcança
  await battle({ army: [["INFANTRY"]], forces: [{ faction: "KINGDOM", units: { SOLDIER: 12, OUTRIDER: 2 }, competence: 3, trait: "BRAVE", stance: "ATTACK" }], distance: 1100 });
  const eyes = await ev(() => {
    const w = window.__world;
    const lab = window.__lab;
    lab.parkCommander();
    lab.step(2);
    const band = w.run.bands[0];
    const had = band.members.filter((m) => m.isAlive && m.isOutrider).length;
    band.members.filter((m) => m.isAlive && !m.isOutrider).forEach((m) => m.takeDamage(1e6, w.battalions[0].soldiers[0], w.time.now));
    lab.step(8);
    const r = window.__store.getState().scenarioResult;
    return { had, outcome: r?.outcome, fled: r?.enemyFled, left: band.members.filter((m) => m.isAlive).length };
  });
  check("batedores sozinhos não seguram a batalha", eyes.had > 0 && eyes.outcome === "VICTORY", JSON.stringify(eyes));

  // Força vencida, longe de todos: a batalha não fica esperando por ela
  await battle({ army: [["ARCHERS"]], forces: [{ faction: "BANDITS", units: { BANDIT: 20 }, competence: 3, trait: "BRAVE", stance: "HOLD" }], distance: 1800 });
  const remnant = await ev(() => {
    const w = window.__world;
    const lab = window.__lab;
    lab.parkCommander();
    lab.step(2);
    const band = w.run.bands[0];
    band.members.filter((m) => m.isAlive).slice(0, 14).forEach((m) => m.takeDamage(1e6, w.battalions[0].soldiers[0], w.time.now));
    lab.step(30);
    const r = window.__store.getState().scenarioResult;
    return { outcome: r?.outcome, reason: r?.reason, left: band.members.filter((m) => m.isAlive).length };
  });
  check("o que sobrou de uma força vencida deixa o campo", remnant.outcome === "VICTORY", JSON.stringify(remnant));
}
