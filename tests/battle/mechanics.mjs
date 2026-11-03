import { mean } from "./lab.mjs";

/** Cada regra do combate medida numa luta de verdade. */
export async function mechanics({ battle, ev }, { check }) {
  // --- Flanco ---
  // Mesmos soldados, mesmos atacantes: muda só o lado por onde chegam
  const flank = async (angle) => {
    await battle({ army: [["INFANTRY"]], force: { SOLDIER: 8 }, faction: "KINGDOM", setup: `s.forces[0].stance = "HOLD";` });
    return ev((angle) => {
      const lab = window.__lab;
      lab.freezeAI();
      lab.parkCommander();
      const b = lab.battalion();
      lab.place(b, 4000, 3600, 0, 4);
      const sq = lab.squad();
      const at = { x: 4000 + Math.cos(angle) * 220, y: 3600 + Math.sin(angle) * 220 };
      lab.placeSquad(sq, at.x, at.y, angle + Math.PI);
      sq.setOrder({ type: "ATTACK", target: b.soldiers[0], lastKnown: { x: 4000, y: 3600 } });
      const men = [...b.soldiers];
      let sawFlanked = false;
      let contact = null;
      let held = 0;
      lab.step(40, () => {
        if (b.flanked) sawFlanked = true;
        if (contact === null && men.some((s) => s.hp < s.maxHp)) contact = window.__world.run.seconds;
        if (contact !== null) held = window.__world.run.seconds - contact;
        return b.panicking;
      });
      return { hurt: lab.hurt(men), rate: lab.hurt(men) / Math.max(1, held), held, sawFlanked };
    }, angle);
  };
  const front = [];
  const side = [];
  const rear = [];
  for (let i = 0; i < 3; i++) {
    front.push(await flank(0));
    side.push(await flank(Math.PI / 2));
    rear.push(await flank(Math.PI));
  }
  const sum = (l, k) => mean(l.map((r) => r[k]));
  const rate = (k) => k.toFixed(1);
  check("pego por trás, morre muito mais depressa que de frente", sum(rear, "rate") > sum(front, "rate") * 1.5, `${rate(sum(front, "rate"))} de vida por segundo de frente, ${rate(sum(side, "rate"))} de lado, ${rate(sum(rear, "rate"))} por trás`);
  check("pego de lado, morre mais depressa que de frente", sum(side, "rate") > sum(front, "rate") * 1.15);
  check("pego por trás, quebra bem antes", sum(rear, "held") < sum(front, "held") * 0.7, `aguentou ${rate(sum(front, "held"))} s de frente, ${rate(sum(side, "held"))} s de lado, ${rate(sum(rear, "held"))} s por trás`);
  check("o batalhão percebe que foi flanqueado", rear.every((r) => r.sawFlanked) && side.every((r) => r.sawFlanked));
  check("de frente, ninguém se diz flanqueado na maioria das vezes", front.filter((r) => r.sawFlanked).length <= rear.filter((r) => r.sawFlanked).length);

  // --- Medo pega ---
  await battle({ army: [["INFANTRY"], ["INFANTRY"]], force: { SOLDIER: 6 }, faction: "KINGDOM" });
  const contagion = await ev(() => {
    const lab = window.__lab;
    lab.freezeAI();
    lab.parkCommander();
    const [a, b] = [lab.battalion(0), lab.battalion(1)];
    lab.place(a, 4000, 3500, 0);
    lab.place(b, 4000, 3700, 0);
    const before = b.morale;
    a.morale = 10;
    lab.step(0.5);
    return { a: a.panicking, drop: before - b.morale };
  });
  check("ver o vizinho fugir abala a tropa", contagion.a && contagion.drop > 3, JSON.stringify(contagion));

  // --- Empurra-empurra ---
  await battle({ army: [["INFANTRY", 12]], force: { SOLDIER: 16 }, faction: "KINGDOM" });
  const shove = await ev(() => {
    const lab = window.__lab;
    lab.freezeAI();
    lab.parkCommander();
    const b = lab.battalion();
    lab.place(b, 4000, 3600, 0, 6);
    const sq = lab.squad();
    lab.placeSquad(sq, 4200, 3600, Math.PI);
    sq.setOrder({ type: "ATTACK", target: b.soldiers[0], lastKnown: { x: 4000, y: 3600 } });
    const start = b.center;
    let path = 0;
    let frames = 0;
    let last = new Map(b.soldiers.map((s) => [s, { x: s.x, y: s.y }]));
    lab.step(16, () => {
      if (b.panicking) return true;
      for (const s of b.soldiers) {
        const p = last.get(s);
        if (p && s.unitState === "ATTACKING") {
          path += Math.hypot(s.x - p.x, s.y - p.y);
          frames++;
        }
        last.set(s, { x: s.x, y: s.y });
      }
    });
    const c = b.center;
    return { drift: Math.hypot(c.x - start.x, c.y - start.y), perSecond: frames > 0 ? (path / frames) * 30 : 0, frames };
  });
  check("linha em combate não é jogada para trás", shove.drift < 70, `andou ${Math.round(shove.drift)} px em 16 s`);
  check("quem está lutando quase não é empurrado", shove.perSecond < 26, `${shove.perSecond.toFixed(1)} px/s por soldado lutando`);

  // --- Investida ---
  const charge = async (defender, formation, { faceAway = false, moving = false } = {}) => {
    await battle({ army: [["CAVALRY"]], force: defender, faction: "KINGDOM", competence: 2 });
    return ev(
      ({ formation, faceAway, moving }) => {
        const lab = window.__lab;
        lab.freezeAI();
        lab.parkCommander();
        const b = lab.battalion();
        lab.place(b, 3700, 3600, 0, 4);
        const sq = lab.squad();
        lab.placeSquad(sq, 4300, 3600, faceAway ? 0 : Math.PI);
        if (formation) sq.setFormation(formation);
        if (moving) sq.setOrder({ type: "MOVE", point: { x: 4300, y: 3100 }, facing: Math.PI });
        const foes = [...sq.soldiers];
        const start = new Map(foes.map((s) => [s, s.x]));
        const riders = [...b.soldiers];
        b.orderAttack(foes[0]);
        let hits = 0;
        const before = sq.morale;
        let impactAt = null;
        let pushed = 0;
        let snapshot = null;
        // Mede o choque: do primeiro contato até dois segundos depois
        lab.step(12, () => {
          hits = Math.max(hits, foes.filter((s) => s.stunnedUntil > window.__world.time.now).length);
          pushed = Math.max(pushed, ...foes.filter((s) => s.isAlive).map((s) => Math.abs(s.x - (start.get(s) ?? s.x))));
          const now = window.__world.run.seconds;
          if (impactAt === null && (lab.hurt(foes) > 0 || lab.hurt(riders) > 0)) impactAt = now;
          if (impactAt !== null && now - impactAt >= 2) {
            snapshot = {
              dealt: lab.hurt(foes),
              taken: lab.hurt(riders),
              pushed,
              stunned: hits,
              moraleDrop: before - sq.morale,
            };
            return true;
          }
        });
        return snapshot;
      },
      { formation: formation ?? null, faceAway, moving },
    );
  };
  const onSoldiers = await charge({ SOLDIER: 8 });
  const onSpears = await charge({ PIKEMAN: 8 });
  const onSpearBacks = await charge({ PIKEMAN: 8 }, null, { faceAway: true });
  const onLoose = await charge({ PIKEMAN: 8 }, "LOOSE");
  console.log("   investida:", JSON.stringify({ onSoldiers, onSpears, onSpearBacks, onLoose }));
  check("investida empurra e derruba", onSoldiers.pushed > 12 && onSoldiers.stunned >= 1, JSON.stringify(onSoldiers));
  check("investida abala a moral sem quebrar a tropa de uma vez", onSoldiers.moraleDrop > 10 && onSoldiers.moraleDrop < 60, String(Math.round(onSoldiers.moraleDrop)));
  check("cavalo contra lança firme apanha mais do que bate", onSpears.taken > onSpears.dealt, JSON.stringify(onSpears));
  check("lança firme recebe muito menos que soldado comum", onSpears.dealt < onSoldiers.dealt * 0.6);
  check("cavalaria sofre muito mais contra lança firme", onSpears.taken > onSoldiers.taken * 1.5);
  check("lança de costas não segura nada", onSpearBacks.dealt > onSpears.dealt * 1.5, `${Math.round(onSpearBacks.dealt)} × ${Math.round(onSpears.dealt)}`);
  check("lança em ordem dispersa não segura nada", onLoose.dealt > onSpears.dealt * 1.3, `${Math.round(onLoose.dealt)} × ${Math.round(onSpears.dealt)}`);

  // --- Sair do combate e voltar ---
  await battle({ army: [["CAVALRY"]], force: { SOLDIER: 10 }, faction: "KINGDOM" });
  const leave = await ev(() => {
    const lab = window.__lab;
    lab.freezeAI();
    lab.parkCommander();
    const b = lab.battalion();
    lab.place(b, 3900, 3600, 0, 4);
    const sq = lab.squad();
    lab.placeSquad(sq, 4150, 3600, Math.PI);
    b.orderAttack(sq.soldiers[0]);
    sq.setOrder({ type: "ATTACK", target: b.soldiers[0], lastKnown: { x: 3900, y: 3600 } });
    lab.step(6);
    const engaged = b.soldiers.filter((s) => s.target).length;
    // Recua para longe do inimigo: depois da carga, ela pode ter parado do outro lado da linha dele
    const at = b.center;
    const foes = sq.center;
    const back = Math.atan2(at.y - foes.y, at.x - foes.x);
    b.orderMove({ x: at.x + Math.cos(back) * 700, y: at.y + Math.sin(back) * 700 }, back + Math.PI, { run: true });
    lab.step(6);
    const away = Math.hypot(b.center.x - sq.center.x, b.center.y - sq.center.y);
    const charged = (() => {
      const foe = sq.soldiers.find((s) => s.isAlive);
      b.orderAttack(foe);
      let impact = false;
      lab.step(10, () => {
        if (b.soldiers.some((s) => s.ridingThrough)) impact = true;
      });
      return impact;
    })();
    return { engaged, away, charged };
  });
  check("cavalaria sai do combate quando manda", leave.engaged > 0 && leave.away > 150, JSON.stringify(leave));
  check("depois de sair, volta com investida de verdade", leave.charged);

  const fight = async (cycle) => {
    await battle({ army: [["CAVALRY"]], force: { SOLDIER: 16 }, faction: "KINGDOM" });
    return ev((cycle) => {
      const lab = window.__lab;
      lab.freezeAI();
      lab.parkCommander();
      const b = lab.battalion();
      lab.place(b, 3600, 3600, 0, 4);
      const sq = lab.squad();
      lab.placeSquad(sq, 4300, 3600, Math.PI);
      b.cycle = cycle;
      const foes = [...sq.soldiers];
      const men = [...b.soldiers];
      b.orderAttack(foes[0]);
      let impacts = 0;
      let was = false;
      lab.step(45, () => {
        const now = men.some((s) => s.isAlive && s.ridingThrough);
        if (now && !was) impacts++;
        was = now;
      });
      return { dealt: lab.hurt(foes), taken: lab.hurt(men), impacts, ratio: lab.hurt(foes) / Math.max(1, lab.hurt(men)) };
    }, cycle);
  };
  const stay = [await fight(false), await fight(false), await fight(false)];
  const cycling = [await fight(true), await fight(true), await fight(true)];
  console.log("   ciclo:", JSON.stringify({ stay, cycling }));
  check("investida em ciclo bate várias vezes", mean(cycling.map((r) => r.impacts)) >= 2.5, String(cycling.map((r) => r.impacts)));
  check("em ciclo a cavalaria troca melhor do que plantada", mean(cycling.map((r) => r.ratio)) > mean(stay.map((r) => r.ratio)) * 1.2, `${mean(cycling.map((r) => r.ratio)).toFixed(2)} × ${mean(stay.map((r) => r.ratio)).toFixed(2)}`);
}
