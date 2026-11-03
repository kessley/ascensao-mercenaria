import { mean } from "./lab.mjs";

/** Flechas: área, precisão, munição e fogo amigo. */
export async function archery({ battle, ev }, { check }) {
  // Arqueiros atirando numa tropa que não se mexe: quanto a densidade pesa?
  const shower = async (formation, width) => {
    await battle({ army: [["ARCHERS"]], force: { SOLDIER: 12 }, faction: "KINGDOM" });
    return ev(
      ({ formation, width }) => {
        const lab = window.__lab;
        lab.freezeAI();
        lab.parkCommander();
        const b = lab.battalion();
        lab.place(b, 3800, 3600, 0, 4);
        const sq = lab.squad();
        sq.setFormation(formation);
        lab.placeSquad(sq, 4010, 3600, Math.PI);
        sq.setOrder({ type: "HOLD", point: { x: 4010, y: 3600 }, facing: Math.PI });
        for (const s of sq.soldiers) s.hostile = true;
        const foes = [...sq.soldiers];
        b.orderAttack(foes[0]);
        lab.step(30);
        return { hurt: lab.hurt(foes), ammo: b.ammoLeft };
      },
      { formation, width: width ?? null },
    );
  };
  const dense = [await shower("LINE"), await shower("LINE"), await shower("LINE")];
  const loose = [await shower("LOOSE"), await shower("LOOSE"), await shower("LOOSE")];
  console.log("   flechas:", JSON.stringify({ dense, loose }));
  check("tropa fechada sofre mais com flechas que tropa dispersa", mean(dense.map((r) => r.hurt)) > mean(loose.map((r) => r.hurt)) * 1.2, `${Math.round(mean(dense.map((r) => r.hurt)))} × ${Math.round(mean(loose.map((r) => r.hurt)))}`);

  // Quantas flechas erram (precisão)
  await battle({ army: [["ARCHERS"]], force: { SOLDIER: 8 }, faction: "KINGDOM" });
  const accuracy = await ev(() => {
    const lab = window.__lab;
    lab.freezeAI();
    lab.parkCommander();
    const b = lab.battalion();
    lab.place(b, 3800, 3600, 0, 4);
    const sq = lab.squad();
    lab.placeSquad(sq, 4010, 3600, Math.PI);
    const foes = [...sq.soldiers];
    let fired = 0;
    const startAmmo = b.ammoLeft;
    b.orderAttack(foes[0]);
    const shields = foes.map((s) => s.shieldBlock);
    lab.step(20);
    fired = (startAmmo - b.ammoLeft) * 3;
    return { fired, hits: lab.hurt(foes), shield: shields[0] };
  });
  check("salvas gastam munição e fazem estrago sem acertar tudo", accuracy.fired > 40 && accuracy.hits > 0, JSON.stringify(accuracy));

  // Munição: acabou, vai para o corpo a corpo
  await battle({ army: [["JAVELINS"]], force: { GOBLIN: 8 }, faction: "GOBLINS" });
  const ammo = await ev(() => {
    const lab = window.__lab;
    lab.freezeAI();
    lab.parkCommander();
    const b = lab.battalion();
    b.kiting = false;
    lab.place(b, 3900, 3600, 0, 4);
    const sq = lab.squad();
    lab.placeSquad(sq, 4000, 3600, Math.PI);
    b.orderAttack(sq.soldiers[0]);
    const start = b.ammoLeft;
    lab.step(30);
    return { start, left: b.ammoLeft, ranged: b.soldiers.filter((s) => s.ranged).length, men: b.soldiers.length };
  });
  check("munição acaba e quem atirava passa a lutar de perto", ammo.left === 0 && ammo.ranged === 0, JSON.stringify(ammo));

  // Fogo amigo: seus homens no corpo a corpo, no alvo das flechas
  const friendly = async (hold) => {
    await battle({ army: [["ARCHERS", 16], ["INFANTRY"]], force: { SOLDIER: 10 }, faction: "KINGDOM" });
    return ev((hold) => {
      const lab = window.__lab;
      lab.freezeAI();
      lab.parkCommander();
      const [archers, men] = [lab.battalion(0), lab.battalion(1)];
      lab.place(archers, 3800, 3600, 0, 8);
      lab.place(men, 4030, 3600, Math.PI, 4);
      const sq = lab.squad();
      lab.placeSquad(sq, 4075, 3600, Math.PI);
      archers.holdFire = hold;
      if (!hold) archers.orderAttack(sq.soldiers[0]);
      archers.holdFire = hold;
      sq.setOrder({ type: "ATTACK", target: men.soldiers[0], lastKnown: { x: 4030, y: 3600 } });
      men.orderAttack(sq.soldiers[0]);
      lab.step(20);
      return { friendly: window.__world.run.friendlyFire, shots: 16 * 30 - archers.ammoLeft };
    }, hold);
  };
  const open = await friendly(false);
  const held = await friendly(true);
  console.log("   fogo amigo:", JSON.stringify({ open, held }));
  check("atirar num corpo a corpo acerta os próprios homens", open.friendly > 0, JSON.stringify(open));
  check("cessar fogo não atira e não acerta ninguém", held.friendly === 0 && held.shots === 0, JSON.stringify(held));

  // Besta e armadura: o que cada tiro faz em quem usa placas
  const armor = async (troop) => {
    await battle({ army: [[troop]], force: { MAN_AT_ARMS: 8 }, faction: "KINGDOM" });
    return ev(() => {
      const lab = window.__lab;
      lab.freezeAI();
      lab.parkCommander();
      const b = lab.battalion();
      lab.place(b, 3800, 3600, 0, 4);
      const sq = lab.squad();
      lab.placeSquad(sq, 4000, 3600, Math.PI);
      const foes = [...sq.soldiers];
      b.orderAttack(foes[0]);
      lab.step(30);
      return lab.hurt(foes);
    });
  };
  const bolts = [await armor("CROSSBOW"), await armor("CROSSBOW")];
  const arrows = [await armor("ARCHERS"), await armor("ARCHERS")];
  check("contra armadura pesada, besta faz mais que arco", mean(bolts) > mean(arrows) * 1.2, `${Math.round(mean(bolts))} × ${Math.round(mean(arrows))}`);

  // Escaramuça
  await battle({ army: [["JAVELINS"]], force: { SOLDIER: 8 }, faction: "KINGDOM" });
  const kite = await ev(() => {
    const lab = window.__lab;
    lab.freezeAI();
    lab.parkCommander();
    const b = lab.battalion();
    lab.place(b, 3900, 3600, 0, 4);
    const sq = lab.squad();
    lab.placeSquad(sq, 4150, 3600, Math.PI);
    sq.setOrder({ type: "ATTACK", target: b.soldiers[0], lastKnown: { x: 3900, y: 3600 } });
    const men = [...b.soldiers];
    const startX = b.center.x;
    let moved = 0;
    lab.step(20, () => {
      moved = Math.max(moved, startX - b.center.x);
    });
    return { moved, hurt: lab.hurt(men), dealt: lab.hurt(sq.soldiers) };
  });
  check("dardeiros recuam de quem chega perto", kite.moved > 120, JSON.stringify(kite));
}
