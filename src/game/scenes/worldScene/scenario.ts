import { Unit } from "../../entities/Unit";
import { layoutGroup } from "../../systems/GroupLayout";
import { bandSize, type Warband } from "../../systems/Warbands";
import { SiegeWorks } from "../../systems/SiegeWorks";
import type { WallPlan } from "../../systems/WarHost";
import { insideTown, nearestGate, wallOutward, wallPosts, type TownLayout } from "../../world/townLayout";
import { ENEMY_FACTIONS, SCENARIO_TOWN, SIEGE_TOWNS, armyStart, forceSize, forceStance, forceStart, scenarioEnemyTotal, type BattleScenario, type ScenarioForce, type ScenarioSiegeHud } from "../../data/scenarios";
import { useGameStore } from "../../../store/useGameStore";
import { TROOPS, SIEGE, WAR_AI, type EnemyKind } from "../../../utils/constants";
import { sfx } from "../../../audio/sounds";
import { distance, nearest, type Point } from "../../../utils/math";
import { SIDE_WORD, isFighter, wallSide, type SiegeRun, type ScenarioRun, rectDistance } from "./shared";
import type { WorldScene } from "../WorldScene";

/**
 * A batalha personalizada: o campo, o cerco do cenário, o relógio e o fim.
 * Uma parte da `WorldScene`: os métodos entram no protótipo dela (ver o fim de `WorldScene.ts`).
 */
export const scenarioMethods = {
  /** Põe as tropas no campo: o bando em linha, de frente para o leste, e as forças inimigas. */
  startScenarioField(this: WorldScene, def: BattleScenario): void {
    const start = new Map(useGameStore.getState().battalions.map((b) => [b.id, b.soldiers]));
    this.run = { def, siege: null, nextSweep: 0, seconds: 0, pending: [...def.forces].filter((f) => forceSize(f) > 0), bands: [], left: [], fled: 0, officers: [], nextCourse: 0, clearSince: null, prey: null, chiefDown: false, start, friendlyFire: 0 };
    this.warbands.allied = true;
    if (def.map === "DECK") this.buildDeck();
    const layout = def.siege ? this.settlementLayer.layoutOf(SCENARIO_TOWN) : undefined;
    if (layout && def.siege) {
      this.run.siege = { layout, ladders: def.siege.role === "DEFEND" ? def.siege.ladders : 0, rams: def.siege.role === "DEFEND" ? def.siege.rams : 0, footSince: null, nextLook: 0, seated: new Set() };
      this.fog.revealExplored({ x: layout.cx, y: layout.cy }, Math.max(layout.bounds.w, layout.bounds.h) / 2 + 200);
    }
    const ground = armyStart(def);
    const at = this.armyNav.nearestOpen(ground, 900) ?? ground;
    this.placeArmy(at, 0);
    if (this.run.siege && def.siege?.role === "DEFEND") this.deployOnWalls(this.run.siege.layout, def);
    else this.deployArmy(at);
    for (const f of this.run.pending.filter((x) => x.delay === 0)) this.enterForce(this.run, f);
    this.run.pending = this.run.pending.filter((x) => x.delay > 0);
    this.updateVision(this.time.now);
    this.pushFeed(`${def.name}: ${def.description || "as tropas estão em posição."}`);
  },

  /** Linha de batalha: infantaria à frente, arqueiros atrás, cavalaria nas pontas. */
  deployArmy(this: WorldScene, at: Point): void {
    const slots = layoutGroup(this.battalions, "CAVALRY_FLANKS", 0, at);
    const front = at.x + 300;
    for (const s of slots) {
      const p = this.armyNav.nearestOpen({ x: front - s.back, y: at.y + s.lateral }, 500) ?? at;
      s.battalion.teleportTo(p);
      s.battalion.facing = 0;
      s.battalion.order = { type: "HOLD", point: p };
    }
    this.followKey = "";
  },

  /** Defesa: quem atira na muralha, de frente para o inimigo; o resto de reserva logo atrás deles. */
  deployOnWalls(this: WorldScene, layout: TownLayout, def: BattleScenario): void {
    const foe = forceStart(def, def.forces.find((f) => forceSize(f) > 0) ?? def.forces[0]);
    const posts = [...wallPosts(layout)].sort((a, b) => distance(a, foe) - distance(b, foe));
    const out = wallOutward(layout, posts[0]);
    let shots = 0;
    let line = 0;
    for (const b of this.battalions) {
      const shoots = TROOPS[b.troopType].stats.ranged;
      const post = posts[(shoots ? shots++ : line++) % posts.length];
      const spot = shoots ? post : { x: post.x - Math.cos(out) * SIEGE.RESERVE_DEPTH, y: post.y - Math.sin(out) * SIEGE.RESERVE_DEPTH };
      const p = this.armyNav.nearestOpen(spot, 500) ?? spot;
      b.teleportTo(p);
      b.facing = out;
      b.order = { type: "HOLD", point: p };
    }
    this.followKey = "";
  },

  enterForce(this: WorldScene, run: ScenarioRun, force: ScenarioForce): void {
    const faction = ENEMY_FACTIONS[force.faction];
    const origin = forceStart(run.def, force);
    const band = this.warbands.spawnBand({
      name: force.chief ? `Hoste de ${force.chief}` : faction.name,
      kind: faction.band,
      units: Object.entries(force.units).map(([kind, n]) => [kind as EnemyKind, n ?? 0]),
      origin: this.nav.nearestOpen(origin, 2400) ?? origin,
      ownerId: null,
      chief: force.chief ? { name: force.chief, traits: [force.trait] } : undefined,
    });
    if (band.staff) band.staff = { ...band.staff, competence: force.competence, traits: [force.trait] };
    const stance = forceStance(run.def, force);
    if (stance === "HOLD") this.warbands.holdGround(band);
    else run.nextCourse = 0;
    if (run.siege && force.side === "WALLS") band.walls = this.wallPlan(run.siege.layout, run.def);
    band.storming = run.def.siege?.role === "DEFEND";
    band.pitched = true;
    run.bands.push(band);
    if (force === run.def.forces[0]) run.prey = band;
    this.scenarioStance.set(band, stance);
    if (force.delay > 0 && run.def.objective !== "SURVIVE") this.pushFeed("Os batedores ouvem mais gente chegando.");
  },

  /** O que a tropa atrás dos muros sabe deles. */
  wallPlan(this: WorldScene, layout: TownLayout, def: BattleScenario): WallPlan {
    return {
      posts: wallPosts(layout),
      gates: layout.gates.map((g) => g.inside),
      gaps: () => this.works?.gaps ?? [],
      inside: (p) => insideTown(layout, p),
      outward: (p) => wallOutward(layout, p),
      front: armyStart(def),
    };
  },

  /**
   * Batalha de cerco, quatro vezes por segundo: quem nasceu dentro de uma casa sai dela, quem
   * atira e está junto da muralha sobe nela e, se é o inimigo quem ataca, ele trabalha nos muros.
   */
  siegeBattleTick(this: WorldScene, run: ScenarioRun, siege: SiegeRun): void {
    const w = this.works;
    if (!w || run.seconds < siege.nextLook) return;
    siege.nextLook = run.seconds + 0.25;
    for (const band of run.bands) {
      if (!band.materialized || siege.seated.has(band)) continue;
      siege.seated.add(band);
      for (const m of band.members) {
        if (!Unit.terrain?.isBlocked(m.x, m.y)) continue;
        const open = this.nav.nearestOpen(m, 400);
        if (open) {
          m.x = open.x;
          m.y = open.y;
        }
      }
    }
    for (const u of [...this.enemies, ...this.allAllies()]) u.onWall = u.ranged && w.onRamparts(u);
    if (run.def.siege?.role === "DEFEND") this.stormWalls(run, siege, w);
  },

  /** O inimigo ao pé da muralha: machado nos portões, escadas e o aríete, um de cada vez. */
  stormWalls(this: WorldScene, run: ScenarioRun, siege: SiegeRun, w: SiegeWorks): void {
    const troops = run.bands.flatMap((b) => b.members).filter((m) => m.isAlive && !m.routed && !m.ranged);
    for (const g of w.gates) {
      if (g.broken) continue;
      const at = troops.filter((m) => distance(m, g.gate.outside) <= SIEGE.CHOP_REACH).length;
      if (at > 0) w.batter(g, at * SIEGE.CHOP_DPS * 0.25);
    }
    const foot = troops.find((m) => rectDistance(siege.layout.bounds, m) <= SIEGE.WALL_FOOT);
    if (siege.ladders > 0 && foot) {
      siege.footSince ??= run.seconds;
      if (run.seconds - siege.footSince >= SIEGE.LADDER_RAISE_S && w.addLadder(foot)) {
        siege.ladders--;
        siege.footSince = null;
        run.nextCourse = 0;
        this.pushFeed(`Uma escada encosta na muralha ${SIDE_WORD[wallSide(wallOutward(siege.layout, foot))]}!`);
      }
    } else if (!foot) {
      siege.footSince = null;
    }
    const leader = troops[0];
    if (siege.rams > 0 && leader && !w.ram?.isAlive && w.nearestGate(leader)) {
      siege.rams--;
      const ram = this.spawnEnemy(leader.x, leader.y, "SIEGE_RAM");
      ram.hostile = true;
      ram.autoAttack = false;
      ram.driver = () => {};
      w.takeRam(ram);
      this.pushFeed("Eles trazem um aríete!");
    }
  },

  /**
   * Para onde a força vai: atrás do bando, se há como chegar nele. Com a muralha inteira, quem tem
   * escada vai ao pé do trecho à sua frente; quem não tem, ao portão.
   */
  courseOf(this: WorldScene, run: ScenarioRun, band: Warband, army: Point): Point {
    const siege = run.siege;
    if (!siege || this.works?.open || !insideTown(siege.layout, army)) return army;
    if (siege.ladders === 0) return nearestGate(siege.layout, band.anchor).outside;
    const b = siege.layout.bounds;
    const wall = { x: Math.max(b.x, Math.min(b.x + b.w, band.anchor.x)), y: Math.max(b.y, Math.min(b.y + b.h, band.anchor.y)) };
    const out = wallOutward(siege.layout, wall);
    return { x: wall.x + Math.cos(out) * SIEGE.WALL_FOOT * 0.7, y: wall.y + Math.sin(out) * SIEGE.WALL_FOOT * 0.7 };
  },

  /**
   * Sobra de uma força não pode segurar a batalha: quem esperava em posição e já apanhou vem
   * terminar a luta, e quem foi vencido e ninguém mais enfrenta deixa o campo.
   */
  sweepField(this: WorldScene, run: ScenarioRun): void {
    const ours: Point[] = [this.commander, ...this.battalions.filter((b) => !b.isDestroyed).map((b) => b.center)];
    for (const band of run.bands) {
      const host = band.host;
      if (!host || band.walls || run.left.includes(band) || host.retreating) continue;
      const alive = band.members.filter((m) => m.isAlive && isFighter(m));
      const busy = alive.some((m) => m.target?.isAlive) || alive.some((m) => ours.some((p) => distance(p, m) < WAR_AI.BROKEN_ALONE));
      if (busy) continue;
      if (host.beaten) {
        host.abandon();
      } else if (host.bloodied && this.scenarioStance.get(band) === "HOLD") {
        this.scenarioStance.set(band, "ATTACK");
        band.rest = 0;
        run.nextCourse = 0;
      }
    }
  },

  /** Quem ainda luta do outro lado. */
  scenarioFoes(this: WorldScene, run: ScenarioRun): number {
    let n = 0;
    for (const band of run.bands) {
      if (run.left.includes(band)) continue;
      if (!band.materialized) {
        n += band.roster.length;
        continue;
      }
      const standing = band.members.filter((m) => m.isAlive && !m.routed);
      // Batedor e arauto rondam e fogem de quem chega perto: sozinhos, não seguram o campo
      if (standing.some(isFighter)) n += standing.length;
    }
    return n;
  },

  scenarioTick(this: WorldScene, run: ScenarioRun, dt: number): void {
    run.seconds += dt;
    for (const f of run.pending.filter((x) => run.seconds >= x.delay)) this.enterForce(run, f);
    run.pending = run.pending.filter((x) => run.seconds < x.delay);
    // Quem deixou o campo em ordem não volta: a batalha é aqui
    for (const band of run.left) {
      if (!this.warbands.bands.includes(band)) continue;
      run.fled += bandSize(band);
      this.warbands.disband(band);
    }
    // Quem vem atacar sabe onde a batalha está; o que fazer ao chegar sai do que os soldados veem
    if (run.seconds >= run.nextCourse) {
      run.nextCourse = run.seconds + 12;
      // Cada um vai na tropa mais perto: o meio do caminho entre duas tropas é um lugar vazio
      const standing = this.battalions.filter((b) => !b.isDestroyed).map((b) => b.center);
      for (const band of run.bands) {
        const army = nearest(standing, band.anchor) ?? this.commander;
        if (this.scenarioStance.get(band) === "ATTACK" && !run.left.includes(band) && this.warbands.bands.includes(band)) this.warbands.marchOn(band, this.courseOf(run, band, army));
      }
    }
    if (run.siege) this.siegeBattleTick(run, run.siege);
    if (run.seconds >= run.nextSweep) {
      run.nextSweep = run.seconds + 1;
      this.sweepField(run);
    }
    const foes = this.scenarioFoes(run);
    useGameStore.setState({ scenarioHud: { seconds: run.seconds, enemies: foes, enemyTotal: scenarioEnemyTotal(run.def), waiting: run.pending.length > 0, siege: this.siegeHud(run) } });

    if (run.def.objective === "SLAY_CHIEF" && run.chiefDown) return this.endScenario(run, "VICTORY", "O chefe caiu e o inimigo perdeu a cabeça.");
    if (run.def.objective === "SURVIVE" && run.seconds >= run.def.surviveMinutes * 60) return this.endScenario(run, "VICTORY", "O bando resistiu até o fim.");
    if (this.battalions.every((b) => b.isDestroyed)) return this.endScenario(run, "DEFEAT", "Todos os batalhões foram dizimados.");
    if (foes > 0 || run.pending.length > 0) {
      run.clearSince = null;
      return;
    }
    run.clearSince ??= run.seconds;
    const taken = run.def.boarding ? "os piratas foram vencidos." : run.def.siege?.role === "ATTACK" ? `${SIEGE_TOWNS[run.def.siege.town].name} caiu.` : run.def.siege ? "O assalto foi repelido." : "O inimigo foi expulso do campo.";
    // Morto não volta; quem fugiu ainda pode se reagrupar antes de o campo ser dado como vencido
    const fleeing = run.bands.some((b) => !run.left.includes(b) && b.members.some((m) => m.isAlive && m.routed));
    if (run.seconds - run.clearSince >= (fleeing ? WAR_AI.RALLY_WAIT_S : 2.5)) this.endScenario(run, "VICTORY", taken.charAt(0).toUpperCase() + taken.slice(1));
  },

  siegeHud(this: WorldScene, run: ScenarioRun): ScenarioSiegeHud | undefined {
    const w = this.works;
    if (!run.siege || !w) return undefined;
    const up = w.gates.filter((g) => !g.broken);
    return {
      gatesUp: up.length,
      gates: w.gates.length,
      weakest: up.reduce((n, g) => Math.min(n, g.hp / g.maxHp), 1),
      ladders: w.ladders.length,
      atWall: !!this.troopAtWall(run.siege.layout),
      ramOut: !!w.ram?.isAlive,
    };
  },

  endScenario(this: WorldScene, run: ScenarioRun, outcome: "VICTORY" | "DEFEAT", reason: string): void {
    const store = useGameStore.getState();
    if (store.scenarioResult) return;
    const total = scenarioEnemyTotal(run.def) - run.pending.reduce((n, f) => n + forceSize(f), 0);
    const standing = this.scenarioFoes(run);
    // Quem corria, ou só rondava, quando a batalha acabou também saiu vivo
    let afield = 0;
    for (const band of run.bands) if (!run.left.includes(band)) afield += band.materialized ? band.members.filter((m) => m.isAlive).length : band.roster.length;
    const fled = run.fled + afield - standing;
    if (outcome === "VICTORY") sfx.victory();
    else sfx.defeat();
    store.finishScenario({
      outcome,
      reason,
      seconds: run.seconds,
      enemyTotal: total,
      enemyKilled: Math.max(0, total - standing - fled),
      enemyFled: fled,
      battalions: this.battalions.map((b) => ({ id: b.id, name: b.name, troop: b.troopType, start: run.start.get(b.id) ?? b.aliveCount, alive: b.aliveCount, kills: b.kills })),
      commanderHp: Math.max(0, Math.round(this.commander.hp)),
      commanderMaxHp: this.commander.maxHp,
      officers: run.officers,
      friendlyFire: run.friendlyFire,
    });
  },
};

export type ScenarioMethods = typeof scenarioMethods;
