/** Capitães em batalha (Marco 20): aura, um mensageiro por companhia, a cabeça do capitão e a morte dele. */

/** Uma companhia de dois batalhões de infantaria (o terceiro, de arqueiros, fica com o Comandante). */
const SETUP = "s.directOrders = false; s.army.messengers = 2;";

function joinCompany(traits) {
  const st = window.__store;
  const w = window.__world;
  const [a, b] = w.battalions;
  const captain = {
    id: "cap-teste",
    name: "Konrad",
    epithet: "de Ferro",
    backstory: "",
    origin: "NOBLE",
    traits,
    command: 4,
    tactics: 3,
    duel: 3,
    ambition: 2,
    loyalty: 70,
    hireCost: 100,
    wage: 20,
    battalionIds: [a.id, b.id],
    kills: 0,
    battles: 0,
    history: [],
  };
  st.setState({ captains: [captain] });
  w.armyDirty = true;
  window.__lab.step(0.3);
  const guard = w.battalions.find((x) => x.id === a.id);
  return { guard: guard.captainAlive, title: guard.name, ids: captain.battalionIds };
}

export async function companies({ battle, ev }, { check }) {
  await battle({ army: [["INFANTRY"], ["INFANTRY"], ["ARCHERS"]], force: { GOBLIN: 8 }, faction: "GOBLINS", distance: 2400, stance: "HOLD", competence: 1, setup: SETUP });
  const joined = await ev(joinCompany, []);
  check("o capitão entra em campo com a guarda", joined.guard, JSON.stringify(joined));

  // Aura: perto dele a companhia perde menos moral; quem não é da companhia, não
  const aura = await ev(() => {
    const lab = window.__lab;
    const w = window.__world;
    lab.freezeAI();
    lab.parkCommander();
    const [a, b, c] = w.battalions;
    lab.place(a, 3900, 3500, 0, 4);
    lab.place(b, 3900, 3700, 0, 4);
    lab.place(c, 3900, 3900, 0, 4);
    lab.step(0.2);
    return { a: a.captainAura, b: b.captainAura, c: c.captainAura };
  });
  check("a aura vale para a companhia perto do capitão", aura.a < 1 && aura.b < 1, JSON.stringify(aura));
  check("e não para quem é do Comandante", aura.c === 1, JSON.stringify(aura));

  // Um mensageiro por companhia: a ordem para os dois vai ao capitão, numa parada só
  const relay = await ev(() => {
    const w = window.__world;
    const [a, b] = w.battalions;
    w.withOrderBatch(() => {
      for (const x of [a, b]) w.dispatch(x, "Avançar", () => x.orderMove({ x: x.center.x + 150, y: x.center.y }));
    });
    const out = w.messengers.filter((m) => m.mission);
    return { messengers: out.length, stops: out.flatMap((m) => m.mission.stops.map((s) => s.recipient)), pending: [a.pendingOrder, b.pendingOrder] };
  });
  check("a ordem para a companhia sai com um mensageiro só", relay.messengers === 1 && relay.stops.length === 1, JSON.stringify(relay));
  check("a parada é o capitão", relay.stops[0]?.startsWith("companhia de"), JSON.stringify(relay));
  const delivered = await ev(() => {
    const lab = window.__lab;
    const w = window.__world;
    const [a, b] = w.battalions;
    lab.step(25, () => w.messengers.every((m) => !m.mission || m.riderState !== "OUTBOUND"));
    return { a: a.order.type, b: b.order.type, pending: [a.pendingOrder, b.pendingOrder] };
  });
  check("entregue ao capitão, os dois batalhões recebem a ordem", delivered.pending.every((p) => p === null) && delivered.a !== "FOLLOW", JSON.stringify(delivered));

  // Livre e longe da voz do Comandante: o capitão decide sozinho quando o inimigo chega
  const alone = await ev(() => {
    const lab = window.__lab;
    const w = window.__world;
    const [a, b] = w.battalions;
    lab.place(a, 3900, 3500, 0, 4);
    lab.place(b, 3900, 3700, 0, 4);
    // A ordem que acabou de chegar pelo mensageiro ainda vale: passa o prazo dela
    for (const x of [a, b]) w.companies.playerOrdered(x, -100000);
    for (const s of lab.squad().soldiers) s.hostile = true;
    lab.placeSquad(lab.squad(), 4250, 3600, Math.PI);
    w.updateVision(w.time.now);
    lab.step(3);
    const hud = w.companies.hud(w.battalions)[0];
    return { a: a.order.type, b: b.order.type, plan: hud?.plan ?? null, feed: w.feed.filter((f) => f.startsWith("⚑")).slice(-2) };
  });
  check("longe do Comandante, o capitão escolhe um plano", !!alone.plan, JSON.stringify(alone));
  check("e a companhia vai para cima (ou segura) sem ordem do Comandante", alone.a !== "HOLD" || alone.b !== "HOLD" || alone.plan === "resistir no terreno", JSON.stringify(alone));

  // Perto do Comandante e livre: quem decide é o jogador
  await battle({ army: [["INFANTRY"], ["INFANTRY"], ["ARCHERS"]], force: { GOBLIN: 8 }, faction: "GOBLINS", distance: 2400, stance: "HOLD", competence: 1, setup: SETUP });
  await ev(joinCompany, []);
  const near = await ev(() => {
    const lab = window.__lab;
    const w = window.__world;
    lab.freezeAI();
    const [a, b] = w.battalions;
    lab.place(a, 3900, 3500, 0, 4);
    lab.place(b, 3900, 3700, 0, 4);
    w.commander.x = 3850;
    w.commander.y = 3600;
    for (const s of lab.squad().soldiers) s.hostile = true;
    lab.placeSquad(lab.squad(), 4250, 3600, Math.PI);
    w.updateVision(w.time.now);
    lab.step(2);
    return { plan: w.companies.hud(w.battalions)[0]?.plan ?? null };
  });
  check("ao alcance da voz, o capitão livre não decide nada", near.plan === null, JSON.stringify(near));

  // Segurar o terreno: a ordem larga vai pela interface e o capitão defende o lugar
  const held = await ev(() => {
    const lab = window.__lab;
    const w = window.__world;
    const st = window.__store;
    const [a, b] = w.battalions;
    st.getState().sendBattleCommand({ type: "COMPANY", ids: ["cap-teste"], stance: "HOLD" });
    lab.step(0.3);
    const stance = w.companies.hud(w.battalions)[0]?.stance;
    // Afasta o inimigo e tira a companhia do lugar: ela volta
    lab.placeSquad(lab.squad(), 6000, 3600, Math.PI);
    w.updateVision(w.time.now);
    a.orderMove({ x: 3500, y: 3500 });
    b.orderMove({ x: 3500, y: 3700 });
    lab.step(3);
    w.companies.playerOrdered(a, -100000);
    w.companies.playerOrdered(b, -100000);
    lab.step(8);
    return { stance, a: Math.round(Math.hypot(a.center.x - 3900, a.center.y - 3500)), b: Math.round(Math.hypot(b.center.x - 3900, b.center.y - 3700)) };
  });
  check("a postura chega ao capitão pela interface", held.stance === "HOLD", JSON.stringify(held));
  check("segurando, a companhia volta ao lugar", held.a < 140 && held.b < 140, JSON.stringify(held));

  // O capitão cai: abalo em toda a companhia
  const fall = await ev(() => {
    const lab = window.__lab;
    const w = window.__world;
    const [a, b, c] = w.battalions;
    for (const x of [a, b, c]) x.morale = 80;
    const captain = a.soldiers.find((s) => s.isCaptain);
    const foe = lab.squad().soldiers[0];
    captain.takeDamage(99999, foe, w.time.now);
    lab.step(0.2);
    return { a: Math.round(a.morale), b: Math.round(b.morale), c: Math.round(c.morale), alive: a.captainAlive, feed: w.feed.filter((f) => f.includes("caiu")).slice(-1) };
  });
  check("o capitão morto abala a companhia", fall.a <= 60 && fall.b <= 60 && !fall.alive, JSON.stringify(fall));
  check("mas não quem é do Comandante", fall.c >= 75, JSON.stringify(fall));
  check("o diário de batalha conta a queda", fall.feed.length === 1, JSON.stringify(fall));
}
