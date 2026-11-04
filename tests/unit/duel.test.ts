import { describe, expect, it } from "vitest";
import { seeded } from "../../src/game/art/pixel";
import {
  aiPace,
  aiSpeed,
  duelAi,
  fateOf,
  fightOut,
  makeFighter,
  makeMind,
  opponentOf,
  reachOf,
  startDuel,
  stepDuel,
  windupOf,
  type DuelEventKind,
  type DuelFighter,
  type DuelInput,
  type DuelState,
  type DuelTemper,
  type DuelWeapon,
  type FighterSpec,
} from "../../src/game/sim/duel";
import { DUEL } from "../../src/utils/constants";
import { distance } from "../../src/utils/math";

const DT = 1 / 30;
const STILL: DuelInput = { dx: 0, dy: 0, block: false };

/** Dois de frente, a `gap` um do outro, no meio de uma Liça grande. */
function pair(gap = 60, a: Partial<FighterSpec> = {}, b: Partial<FighterSpec> = {}, seed = 1): DuelState {
  return startDuel(makeFighter({ name: "A", x: -gap / 2, y: 0, ...a }), makeFighter({ name: "B", x: gap / 2, y: 0, ...b }), { center: { x: 0, y: 0 }, radius: 400, rng: seeded(seed) });
}

/** Roda até `until` (ou o fim), com a entrada de cada lado decidida a cada passo; devolve o que aconteceu. */
function run(d: DuelState, seconds: number, ia: (d: DuelState) => DuelInput = () => STILL, ib: (d: DuelState) => DuelInput = () => STILL): DuelEventKind[] {
  const seen: DuelEventKind[] = [];
  const end = d.time + seconds;
  while (d.time < end - 1e-9 && !d.winner && !d.timedOut) {
    stepDuel(d, DT, ia(d), ib(d));
    for (const e of d.events) seen.push(e.kind);
    d.events.length = 0;
  }
  return seen;
}

/** Aperta uma vez no primeiro passo e depois só segura (ou não) a guarda. */
const once = (press: Partial<DuelInput>, block = false) => {
  let used = false;
  return (): DuelInput => {
    if (used) return { ...STILL, block };
    used = true;
    return { ...STILL, block, ...press };
  };
};

/** Ergue a guarda quando faltar `before` segundos para o golpe de B chegar. */
const guardAt = (before: number) => (d: DuelState): DuelInput => ({ ...STILL, block: d.b.stance === "WINDUP" && d.b.timer <= before + 1e-9 });

describe("duelo: golpes", () => {
  it("o golpe leve acerta de perto e erra de longe", () => {
    const near = pair(60);
    expect(run(near, 0.6, once({ light: true }))).toContain("HIT");
    expect(near.b.hp).toBeLessThan(near.b.maxHp);
    const far = pair(120);
    expect(run(far, 0.6, once({ light: true }))).toContain("MISS");
    expect(far.b.hp).toBe(far.b.maxHp);
  });

  it("o golpe avisa antes: o leve demora o ritmo da arma, o pesado bem mais", () => {
    const f = makeFighter({ name: "A", x: 0, y: 0 });
    expect(windupOf(f, "LIGHT")).toBeCloseTo(0.24);
    expect(windupOf(f, "HEAVY")).toBeGreaterThan(windupOf(f, "LIGHT") * 2);
    // A IA fraca avisa bem antes; a melhor, quase no ritmo do Comandante
    expect(aiPace(2)).toBeGreaterThan(aiPace(10));
    expect(aiPace(10)).toBeGreaterThan(1);
  });

  it("três a cinco golpes limpos decidem, e a armadura segura parte deles", () => {
    const hitsToFall = (armor: number) => {
      const d = pair(60, {}, { armor });
      for (let i = 0; i < 20 && !d.winner; i++) {
        // Cada golpe empurra: B volta para perto antes do próximo
        d.b.x = d.a.x + 60;
        d.b.y = d.a.y;
        run(d, 1.2, once({ light: true }));
      }
      return d.a.hits;
    };
    const bare = hitsToFall(0);
    expect(bare).toBeGreaterThanOrEqual(3);
    expect(bare).toBeLessThanOrEqual(5);
    expect(hitsToFall(0.4)).toBeGreaterThan(bare);
  });

  it("ferimentos e cansaço de antes contam", () => {
    const f = makeFighter({ name: "A", x: 0, y: 0, health: 0.5, fatigue: 1 });
    expect(f.hp).toBe(50);
    expect(f.maxStamina).toBe(DUEL.STAMINA / 2);
  });

  it("sem fôlego não há golpe: a tecla espera um pouco e expira", () => {
    const d = pair(60);
    d.a.stamina = 0;
    d.a.maxStamina = 0;
    run(d, 0.6, once({ light: true }));
    expect(d.a.queued).toBeNull();
    expect(d.b.hp).toBe(d.b.maxHp);
  });
});

describe("duelo: defesa", () => {
  it("bloquear de frente segura quase todo o dano, mas gasta fôlego e enche a postura", () => {
    const d = pair(60);
    run(d, 0.2, () => STILL, () => ({ ...STILL, block: true }));
    const hp = d.b.hp;
    const stamina = d.b.stamina;
    expect(run(d, 0.6, once({ light: true }), () => ({ ...STILL, block: true }))).toContain("BLOCK");
    expect(hp - d.b.hp).toBeLessThan(DUEL.LIGHT.DAMAGE * 0.15);
    expect(d.b.stamina).toBeLessThan(stamina);
    expect(d.b.posture).toBeGreaterThan(0);
  });

  it("erguer a guarda no instante certo apara e atordoa quem atacou", () => {
    const d = pair(60);
    const seen = run(d, 0.6, guardAt(0.1), once({ light: true }));
    expect(seen).toContain("PARRY");
    expect(d.b.stance).toBe("STAGGER");
    expect(d.a.hp).toBe(d.a.maxHp);
  });

  it("guarda erguida cedo demais só bloqueia; martelar a tecla não apara", () => {
    const early = pair(60);
    expect(run(early, 0.6, guardAt(0.4), once({ light: true }))).toContain("BLOCK");
    const spam = pair(60);
    // Solta e ergue de novo a cada dois quadros
    let n = 0;
    const seen = run(spam, 0.6, () => ({ ...STILL, block: n++ % 4 < 2 }), once({ light: true }));
    expect(seen).not.toContain("PARRY");
  });

  it("o pesado bloqueado enche a postura bem mais que o leve; o machado, mais ainda", () => {
    const posture = (weapon: DuelWeapon, heavy: boolean) => {
      const d = pair(60, { weapon }, {});
      run(d, 0.2, () => STILL, () => ({ ...STILL, block: true }));
      run(d, 1, once(heavy ? { heavy: true } : { light: true }), () => ({ ...STILL, block: true }));
      return d.b.posture;
    };
    expect(posture("SWORD", true)).toBeGreaterThan(posture("SWORD", false) * 1.5);
    expect(posture("AXE", true)).toBeGreaterThan(posture("SWORD", true));
  });

  it("o escudo bloqueia melhor", () => {
    const chip = (weapon: DuelWeapon) => {
      const d = pair(60, {}, { weapon });
      run(d, 0.2, () => STILL, () => ({ ...STILL, block: true }));
      run(d, 1, once({ heavy: true }), () => ({ ...STILL, block: true }));
      return d.b.posture;
    };
    expect(chip("SHIELD")).toBeLessThan(chip("SWORD"));
  });

  it("postura cheia quebra a guarda e o próximo golpe entra", () => {
    const d = pair(60);
    d.b.posture = 90;
    run(d, 0.2, () => STILL, () => ({ ...STILL, block: true }));
    expect(run(d, 1, once({ heavy: true }), () => ({ ...STILL, block: true }))).toContain("BREAK");
    expect(d.b.stance).toBe("STAGGER");
    expect(d.b.timer).toBeGreaterThan(windupOf(d.a, "LIGHT"));
    const hp = d.b.hp;
    run(d, 0.6, once({ light: true }), () => ({ ...STILL, block: true }));
    expect(d.b.hp).toBeLessThan(hp - DUEL.LIGHT.DAMAGE * 0.5);
  });

  it("o empurrão abre quem só bloqueia", () => {
    const d = pair(50);
    run(d, 0.2, () => STILL, () => ({ ...STILL, block: true }));
    const gap = distance(d.a, d.b);
    expect(run(d, 0.5, once({ shove: true }), () => ({ ...STILL, block: true }))).toContain("SHOVE");
    expect(distance(d.a, d.b)).toBeGreaterThan(gap);
    expect(d.b.posture).toBeGreaterThanOrEqual(DUEL.POSTURE.SHOVE * 0.8);
  });
});

describe("duelo: esquiva", () => {
  it("a esquiva no instante certo deixa o golpe passar, e gasta fôlego", () => {
    const d = pair(60);
    const dodge = (s: DuelState): DuelInput => ({ ...STILL, dy: 1, dodge: s.b.stance === "WINDUP" && s.b.timer <= 0.12 && s.a.stance === "IDLE" });
    const seen = run(d, 0.6, dodge, once({ light: true }));
    expect(seen).toContain("DODGE");
    expect(seen.some((k) => k === "EVADE" || k === "MISS")).toBe(true);
    expect(d.a.hp).toBe(d.a.maxHp);
    expect(d.a.stamina).toBeLessThan(d.a.maxStamina);
  });

  it("com escudo, a esquiva custa mais e vai menos longe", () => {
    const step = (weapon: DuelWeapon) => {
      const d = pair(60, { weapon });
      const x = d.a.x;
      run(d, 0.4, once({ dodge: true }));
      return { moved: Math.abs(d.a.x - x), spent: d.a.maxStamina - d.a.stamina };
    };
    const sword = step("SWORD");
    const shield = step("SHIELD");
    expect(shield.moved).toBeLessThan(sword.moved);
    expect(shield.spent).toBeGreaterThan(sword.spent);
  });
});

describe("duelo: fim", () => {
  it("90 segundos sem vencedor: os dois são separados", () => {
    const d = pair(200);
    run(d, 100);
    expect(d.timedOut).toBe(true);
    expect(d.winner).toBeNull();
  });

  it("ninguém sai do anel nem atravessa o outro", () => {
    const d = startDuel(makeFighter({ name: "A", x: -20, y: 0 }), makeFighter({ name: "B", x: 20, y: 0 }), { center: { x: 0, y: 0 }, radius: 80, scale: 0.4, rng: seeded(3) });
    run(d, 3, () => ({ ...STILL, dx: 1 }), () => ({ ...STILL, dx: 1 }));
    for (const f of [d.a, d.b]) expect(distance(f, d.center)).toBeLessThanOrEqual(80 + 1e-6);
    expect(distance(d.a, d.b)).toBeGreaterThanOrEqual(DUEL.BODY * 2 * 0.4 - 1e-6);
  });

  it("quem cai quase sempre se rende ou sai ferido; morrer é raro, e mais com crueldade ou ferida de antes", () => {
    const count = (wounded: boolean, cruel: boolean) => {
      const fates = { SURRENDER: 0, WOUNDED: 0, DEAD: 0 };
      for (let i = 0; i < 100; i++) fates[fateOf({ woundedBefore: wounded }, cruel, (i + 0.5) / 100)]++;
      return fates;
    };
    const plain = count(false, false);
    expect(plain.DEAD).toBeLessThanOrEqual(6);
    expect(plain.SURRENDER).toBeGreaterThan(plain.WOUNDED);
    expect(count(true, true).DEAD).toBeGreaterThan(plain.DEAD * 4);
  });
});

/** Um herói da IA, com o ritmo e o passo da mão dele. */
const hero = (name: string, skill: number, x: number): DuelFighter => makeFighter({ name, x, y: 0, armor: 0.1, pace: aiPace(skill), speed: aiSpeed(skill) });

function aiVsAi(sa: number, ta: DuelTemper, sb: number, tb: DuelTemper, seed: number): DuelState {
  const d = startDuel(hero("A", sa, -60), hero("B", sb, 60), { center: { x: 0, y: 0 }, radius: 276, rng: seeded(seed) });
  return fightOut(d, makeMind(ta, sa), makeMind(tb, sb));
}

describe("duelo: a cabeça da IA", () => {
  it("a mão melhor vence quase sempre; mãos iguais, mais ou menos metade", () => {
    const wins = (sa: number, sb: number) => {
      let n = 0;
      for (let i = 0; i < 40; i++) if (aiVsAi(sa, "STEADY", sb, "STEADY", i + 1).winner?.name === "A") n++;
      return n / 40;
    };
    expect(wins(8, 4)).toBeGreaterThan(0.8);
    const even = wins(6, 6);
    expect(even).toBeGreaterThan(0.3);
    expect(even).toBeLessThan(0.7);
  });

  it("os duelos entre IAs acabam curtos, sem chegar ao fim do tempo", () => {
    for (const t of ["AGGRESSIVE", "STEADY", "PATIENT", "TREACHEROUS"] as DuelTemper[]) {
      for (let i = 0; i < 10; i++) {
        const d = aiVsAi(6, t, 6, "STEADY", i + 1);
        expect(d.timedOut).toBe(false);
        expect(d.time).toBeLessThan(40);
      }
    }
  });

  it("o agressivo ataca mais que o paciente; só o traiçoeiro finge o pesado", () => {
    const tally = (t: DuelTemper) => {
      let swings = 0;
      let feints = 0;
      let time = 0;
      for (let i = 0; i < 10; i++) {
        const d = startDuel(hero("A", 6, -60), makeFighter({ name: "B", x: 60, y: 0 }), { center: { x: 0, y: 0 }, radius: 276, rng: seeded(i + 1) });
        const mind = makeMind(t, 6);
        let last = -1;
        // Do outro lado, um boneco que só bloqueia: ninguém cai, e conta-se o que A faz em 6 s
        while (d.time < 6 && !d.winner) {
          stepDuel(d, DT, duelAi(d, d.a, mind, DT), { ...STILL, block: true });
          if (d.a.stance === "WINDUP" && d.a.since !== last) {
            last = d.a.since;
            swings++;
          }
          for (const e of d.events) if (e.kind === "FEINT") feints++;
          d.events.length = 0;
        }
        time += d.time;
      }
      return { swings: swings / time, feints };
    };
    expect(tally("AGGRESSIVE").swings).toBeGreaterThan(tally("PATIENT").swings);
    expect(tally("TREACHEROUS").feints).toBeGreaterThan(0);
    expect(tally("STEADY").feints).toBe(0);
  });

  it("a IA castiga quem fica atordoado", () => {
    const d = startDuel(hero("A", 8, -30), makeFighter({ name: "B", x: 30, y: 0 }), { center: { x: 0, y: 0 }, radius: 276, rng: seeded(5) });
    const mind = makeMind("STEADY", 8);
    d.b.stance = "STAGGER";
    d.b.timer = 1.4;
    const seen: DuelEventKind[] = [];
    while (d.time < 1.4) {
      stepDuel(d, DT, duelAi(d, d.a, mind, DT), STILL);
      seen.push(...d.events.map((e) => e.kind));
      d.events.length = 0;
    }
    expect(seen).toContain("HIT");
  });
});

/** Alguém nas teclas: lê o aviso com reação de gente, às vezes não vê, às vezes erra o instante. */
function reader(o: { reaction: number; miss: number }) {
  const mem = { read: -1, from: -1, until: -1 };
  return (d: DuelState): DuelInput => {
    const me = d.a;
    const foe = opponentOf(d, me);
    const out: DuelInput = { ...STILL };
    const gap = distance(me, foe);
    const reach = reachOf(d, me);
    if (foe.stance === "WINDUP" && foe.move !== "SHOVE" && mem.read !== foe.since && d.time - foe.since >= o.reaction) {
      mem.read = foe.since;
      if (d.rng() >= o.miss) {
        const arrives = d.time + foe.timer;
        mem.from = Math.max(d.time, arrives - 0.09 + (d.rng() + d.rng() + d.rng() - 1.5) * 0.08);
        mem.until = arrives + 0.1;
      }
    }
    out.block = d.time >= mem.from && d.time <= mem.until;
    if (!out.block && gap <= reach && foe.stance === "STAGGER" && d.time - foe.since > o.reaction) {
      if (foe.timer > windupOf(me, "HEAVY") + 0.05) out.heavy = true;
      else out.light = true;
    }
    const keep = foe.stance === "STAGGER" ? reach * 0.7 : reach * 0.95;
    const dir = gap > keep + 6 ? 1 : gap < keep - 12 ? -1 : 0;
    const a = Math.atan2(foe.y - me.y, foe.x - me.x);
    out.dx = Math.cos(a) * dir;
    out.dy = Math.sin(a) * dir;
    return out;
  };
}

describe("duelo: o Comandante nas teclas", () => {
  const record = (o: { reaction: number; miss: number }, skill: number, temper: DuelTemper) => {
    let wins = 0;
    for (let i = 0; i < 30; i++) {
      const d = startDuel(makeFighter({ name: "C", x: -60, y: 0, armor: 0.1 }), hero("H", skill, 60), { center: { x: 0, y: 0 }, radius: 276, rng: seeded(i * 13 + skill) });
      const mind = makeMind(temper, skill);
      const me = reader(o);
      while (!d.winner && !d.timedOut) {
        stepDuel(d, DT, me(d), duelAi(d, d.b, mind, DT));
        d.events.length = 0;
      }
      if (d.winner === d.a) wins++;
    }
    return wins / 30;
  };

  it("lendo os avisos e aparando, dá para vencer um herói melhor", () => {
    for (const t of ["AGGRESSIVE", "PATIENT", "TREACHEROUS"] as DuelTemper[]) expect(record({ reaction: 0.25, miss: 0.2 }, 10, t)).toBeGreaterThan(0.6);
  });

  it("quem não lê o aviso perde para um herói bom", () => {
    expect(record({ reaction: 0.3, miss: 0.6 }, 8, "STEADY")).toBeLessThan(0.3);
  });
});
