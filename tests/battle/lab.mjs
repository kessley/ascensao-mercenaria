import { chromium } from "playwright-core";

/**
 * Laboratório de batalhas: abre o jogo real no navegador, monta um combate sob medida e o simula
 * em passos manuais (muito mais rápido que o tempo real). Precisa do servidor de desenvolvimento
 * (`npm run dev`) em http://localhost:1420.
 */

/** Roda dentro da página: `__lab` monta o campo e mede o que aconteceu. */
function labInPage() {
  const w = () => window.__world;
  const store = () => window.__store;
  let clock = 0;
  const lab = {
    /** Avança `secs` de jogo; `each` roda a cada passo e, devolvendo true, para. */
    step(secs, each) {
      const scene = w();
      const n = Math.round(secs * 30);
      for (let i = 0; i < n; i++) {
        clock += 1000 / 30;
        scene.time.now = clock;
        scene.sys.step(clock, 1000 / 30);
        if (each?.(scene) === true) break;
        if (store().getState().scenarioResult) break;
      }
    },
    begin() {
      const scene = w();
      scene.sys.game.loop.stop();
      clock = scene.time.now;
    },
    /** Tira a cabeça da IA: os esquadrões só obedecem às ordens do teste. */
    freezeAI() {
      for (const h of w().hosts.hosts) h.decide = () => {};
    },
    /** Comandante longe de tudo: nem ajuda nem atrapalha. */
    parkCommander() {
      const c = w().commander;
      c.x = 300;
      c.y = 300;
      c.restoreHp(c.maxHp);
      w().hosts.hosts.forEach((h) => h.contacts.delete(c));
    },
    battalion(i = 0) {
      return w().battalions[i];
    },
    band(i = 0) {
      return w().warbands.bands[i];
    },
    squad(band = 0, i = 0) {
      return w().warbands.bands[band]?.host?.squads[i];
    },
    /** Põe um batalhão no lugar, formado e parado. */
    place(b, x, y, facing, width) {
      if (width) b.width = width;
      b.facing = facing;
      b.order = { type: "HOLD", point: { x, y } };
      b.soldiers.forEach((s, i) => {
        const o = b.slotOffset(i, b.soldiers.length);
        s.x = x + Math.cos(facing) * o.depth - Math.sin(facing) * o.lateral;
        s.y = y + Math.sin(facing) * o.depth + Math.cos(facing) * o.lateral;
        s.target = null;
      });
    },
    /** O mesmo para um esquadrão inimigo. */
    placeSquad(sq, x, y, facing) {
      sq.setOrder({ type: "HOLD", point: { x, y }, facing });
      sq.facing = facing;
      const cols = Math.ceil(Math.sqrt(sq.soldiers.length));
      sq.soldiers.forEach((s, i) => {
        s.x = x + ((i % cols) - (cols - 1) / 2) * 26 * -Math.sin(facing) - Math.floor(i / cols) * 26 * Math.cos(facing);
        s.y = y + ((i % cols) - (cols - 1) / 2) * 26 * Math.cos(facing) - Math.floor(i / cols) * 26 * Math.sin(facing);
        s.home = { x: s.x, y: s.y };
        s.dormant = false;
        s.target = null;
      });
      sq.center = { x, y };
    },
    allEnemies() {
      return w().warbands.bands.flatMap((b) => b.members).filter((m) => m.isAlive);
    },
    hp(list) {
      return list.reduce((n, s) => n + (s.isAlive ? s.hp : 0), 0);
    },
    /** Quanto de vida um grupo perdeu em relação ao máximo. */
    hurt(list) {
      return list.reduce((n, s) => n + (s.maxHp - (s.isAlive ? s.hp : 0)), 0);
    },
    /** Todos os batalhões atacam o inimigo mais perto (o que um jogador faria sem pensar). */
    attackNearest() {
      const foes = lab.allEnemies().filter((e) => e.revealed && !e.isOutrider);
      if (foes.length === 0) return;
      for (const b of w().battalions) {
        if (b.isDestroyed || b.panicking || b.order.type === "ATTACK") continue;
        const c = b.center;
        b.orderAttack(foes.reduce((p, e) => (Math.hypot(e.x - c.x, e.y - c.y) < Math.hypot(p.x - c.x, p.y - c.y) ? e : p)));
      }
    },
  };
  window.__lab = lab;
}

export async function openLab() {
  const browser = await chromium.launch({ channel: "msedge", headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  await page.goto("http://localhost:1420");
  await page.waitForSelector("text=Batalha personalizada");
  await page.evaluate(labInPage);
  /** Monta o cenário e entrega o campo pronto, em passos manuais. */
  const battle = async ({ army = [["INFANTRY"]], force = { GOBLIN: 10 }, faction = "GOBLINS", forces, setup, distance = 2400, competence = 3, trait = "BRAVE", stance = "HOLD" }) => {
    await page.evaluate(
      ({ army, force, faction, forces, setup, distance, competence, trait, stance }) => {
        const mod = window.__scenarios;
        const s = mod.blankScenario();
        s.distance = distance;
        s.fog = false;
        s.objective = "ROUT";
        s.army = {
          battalions: army.map(([troop, n = 8, level = 1, gear = 0, formation]) => {
            const b = mod.newBattalionSpec(troop, level, gear, false, n);
            return formation ? { ...b, formation } : b;
          }),
          scouts: 0,
          messengers: 0,
          wagons: 0,
        };
        const list = forces ?? [{ faction, units: force, stance, competence, trait }];
        s.forces = list.map((f) => ({ ...mod.newForce(f.faction ?? faction), ...f }));
        if (setup) new Function("s", "mod", setup)(s, mod);
        window.__store.getState().startScenario(s);
      },
      { army, force, faction, forces: forces ?? null, setup: setup ?? null, distance, competence, trait, stance },
    );
    await page.waitForTimeout(150);
    await page.waitForFunction(() => window.__world?.run && window.__world.run.def === window.__store.getState().scenario && window.__store.getState().battleHud && !window.__world.scene.isPaused(), null, { timeout: 20000 });
    await page.waitForTimeout(350);
    await page.evaluate(() => {
      window.__lab.begin();
      window.__world.updateVision(window.__world.time.now);
    });
  };
  return { browser, page, errors, battle, labScript: labInPage, ev: (fn, arg) => page.evaluate(fn, arg) };
}

/** Placar simples de verificações. */
export function scoreboard() {
  const results = [];
  return {
    check(name, ok, info = "") {
      results.push({ name, ok: !!ok });
      console.log(`${ok ? "OK  " : "FALHOU"} ${name}${info ? ` — ${info}` : ""}`);
    },
    results,
  };
}

export const mean = (list) => list.reduce((n, x) => n + x, 0) / Math.max(1, list.length);
