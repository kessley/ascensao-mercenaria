import Phaser from "phaser";
import { Battalion } from "../../entities/Battalion";
import { Enemy } from "../../entities/Enemy";
import { Unit } from "../../entities/Unit";
import { CAMP_BUILDINGS, CELL, WOOD_PER_FOREST_CELL, buildProblem, cooksOf, placeProblem, ready, shortOf, sickBedsOf } from "../../data/campGrid";
import type { Light } from "../../world/NightLayer";
import type { Interactable } from "../../world/CampArea";
import { insideTown, specialHouses } from "../../world/townLayout";
import { nobleName } from "../../sim/nobility";
import { FIELD_MIN_DISTANCE, FIELD_RADIUS } from "../../sim/fortress";
import type { CampState } from "../../world/CampLife";
import { FRIEND_AT, bondOf } from "../../sim/campEvents";
import { geoOf } from "../../worldgen/geoMap";
import { isFactionOwner } from "../../sim/realm";
import { campStaffing, inCampOf, mutinyLeader, useGameStore, type GameState } from "../../../store/useGameStore";
import { TIME, TROOPS, WORLD, CAMP_MOVE, ECONOMY, SUPPLY, WAR_AI } from "../../../utils/constants";
import { campMoraleBonus, dailyRations, startingMorale } from "../../../utils/economy";
import { darknessAt, hourOf } from "../../../utils/time";
import { distance, type Point } from "../../../utils/math";
import { isFactionFriend } from "./shared";
import type { WorldScene } from "../WorldScene";

/**
 * O acampamento, as cidades e a caminhada; forragear, o acampamento móvel, a vida no acampamento e a noite.
 * Uma parte da `WorldScene`: os métodos entram no protótipo dela (ver o fim de `WorldScene.ts`).
 */
/** As faltas que aparecem no acampamento antes do painel (Marco 22, parte 2). */
function campShortages(s: GameState): Pick<CampState, "raw" | "sickGround" | "noStable" | "shifts"> {
  if (s.campPacked) return {};
  const working = campStaffing(s).working;
  const home = inCampOf(s);
  const patients = home.reduce((n, b) => n + (b.wounded ?? 0) + (b.sick ?? 0), 0);
  return {
    raw: home.slice(cooksOf(s.campPlan, working)).map((b) => b.id),
    sickGround: patients > sickBedsOf(s.campPlan, working),
    noStable: !s.campPlan.legacy && !ready(s.campPlan, "STABLE"),
    shifts: s.shifts,
  };
}

export const campMethods = {
  // --- Acampamento, cidades e caminhada ---

  /** Entrar na paliçada: as tropas que seguiam vão descansar nos alojamentos; sair: voltam a seguir. */
  updateCampPresence(this: WorldScene): void {
    const inside = this.campArea.contains(this.commander);
    if (inside === this.inCamp) {
      // Batalhão recriado (ou que voltou a seguir) já dentro da paliçada: vai para o alojamento
      if (inside) this.quarterStragglers();
      return;
    }
    this.inCamp = inside;
    const store = useGameStore.getState();
    if (inside) {
      store.battalions.forEach((data, i) => {
        const b = this.battalions.find((x) => x.id === data.id);
        const slot = this.campArea.quarterSlot(i);
        if (!b || !slot || b.isDestroyed || !b.isFollowing) return;
        this.quarter(b, i, slot);
      });
      // As carroças descarregam no depósito e vão para o conserto
      this.storeWagonHp();
      store.unloadWagons();
      for (const w of this.wagons) w.restoreHp(w.maxHp);
      this.pushFeed("De volta ao acampamento: as tropas descansam nos alojamentos e as carroças descarregam.");
      this.autosave();
      // Às vezes o acampamento tem algo para o Comandante resolver
      store.campTick("ENTER");
      // Em casa, o acampamento de campo volta para as carroças (Marco 22, parte 3)
      if (store.fieldCamp) store.strikeFieldCamp();
    } else {
      const training = new Set(store.training.map((t) => t.battalionId));
      // Marco 14: quem o Comandante escolheu deixar fica de guarda no acampamento
      const guard = new Set(store.campStay.filter((id) => store.battalions.some((b) => b.id === id)));
      const stay = new Set([...training, ...guard]);
      for (const b of this.battalions) {
        if (!this.quartered.has(b.id) || b.isDestroyed || stay.has(b.id)) continue;
        this.unquarter(b);
        b.orderFollow(this.commander);
      }
      for (const id of [...this.quartered]) if (!stay.has(id)) this.quartered.delete(id);
      // As carroças carregam o que cabe (deixando a reserva de quem fica)
      store.loadWagons();
      const after = useGameStore.getState();
      const marching = store.battalions.filter((b) => !stay.has(b.id));
      const names = (ids: ReadonlySet<string>) => store.battalions.filter((b) => ids.has(b.id)).map((b) => b.name).join(", ");
      // Rações refeitas: sem carroças junto, cada batalhão leva a comida na mochila
      const food = after.train === "ARMY" ? ` As carroças vão junto, com ${after.cargo} rações.` : " Cada batalhão leva a comida na mochila; as carroças ficam no acampamento.";
      this.pushFeed(
        marching.length === 0
          ? "O Comandante saiu sozinho: os batalhões ficam guardando o acampamento (e as carroças com eles)."
          : `O bando deixou o acampamento${guard.size > 0 ? ` (ficam de guarda: ${names(guard)})` : ""}${training.size > 0 ? " — quem está no Campo de Treino fica" : ""}.${food}`,
      );
    }
    this.campArea.buildQuarters(store, this.awayBattalions());
  },

  /**
   * A planta mudou (Marco 22): o acampamento é redesenhado no lugar, sem recriar o mundo. O chão
   * e o fosso são repintados, os seguidores vão para os lugares novos e quem descansava vai para
   * o alojamento novo.
   */
  applyCampPlan(this: WorldScene): void {
    const store = useGameStore.getState();
    this.campArea.setPlan(store.campPlan, store, this.awayBattalions());
    const terrain = Unit.terrain;
    if (terrain) {
      terrain.campGround = this.campArea.ground;
      terrain.setDitch(store.campPlan.ditch ? this.campArea.palisade : null);
      const p = this.campArea.palisade;
      this.terrainStreamer.invalidate({ x: p.cx, y: p.cy }, p.half + 160);
    }
    this.campLife.relayout();
    this.campLife.setFollowers(store.followers);
    store.battalions.forEach((data, i) => {
      const b = this.battalions.find((x) => x.id === data.id);
      const slot = this.campArea.quarterSlot(i);
      if (b && slot && this.quartered.has(b.id)) this.quarter(b, i, slot);
    });
  },

  /** Modo construção: a peça fantasma segue o ponteiro, verde onde cabe e vermelha onde não cabe. */
  updateCampBuild(this: WorldScene): void {
    const store = useGameStore.getState();
    const build = store.campBuild;
    if (!build) return this.campArea.hideGhost();
    if (this.campArea.packed || !this.inCamp || this.engagement) {
      this.campArea.hideGhost();
      store.setCampBuild(null);
      return;
    }
    const p = this.input.activePointer;
    const at = this.cameras.main.getWorldPoint(p.x, p.y);
    const [x, y] = this.campArea.cellUnder(at, build.kind);
    this.campArea.showGhost(build.kind, x, y, this.campBuildProblem(x, y), !build.moveId);
  },

  /** Por que a peça do modo construção não fica ali (null = fica). */
  campBuildProblem(this: WorldScene, x: number, y: number): string | null {
    const s = useGameStore.getState();
    const build = s.campBuild;
    if (!build) return null;
    if (build.moveId) return placeProblem(s.campPlan, build.kind, x, y, build.moveId);
    return buildProblem(s.campPlan, build.kind) ?? placeProblem(s.campPlan, build.kind, x, y) ?? shortOf(CAMP_BUILDINGS[build.kind].cost, { gold: s.gold, wood: s.depot.WOOD ?? 0, iron: s.iron });
  },

  /** Clique no modo construção: ergue (ou muda de lugar) a peça. Com Shift, continua construindo. */
  placeCampBuild(this: WorldScene, pointer: Phaser.Input.Pointer, keep: boolean): void {
    const store = useGameStore.getState();
    const build = store.campBuild;
    if (!build) return;
    const [x, y] = this.campArea.cellUnder({ x: pointer.worldX, y: pointer.worldY }, build.kind);
    const why = build.moveId ? store.moveBuilding(build.moveId, x, y) : store.placeBuilding(build.kind, x, y);
    if (why) return this.pushFeed(why);
    const label = CAMP_BUILDINGS[build.kind].label;
    this.pushFeed(build.moveId ? `${label}: mudada de lugar.` : `${label}: construída.`);
    if (!keep || build.moveId) store.setCampBuild(null);
  },

  /** Passado o combate, quem ficou parado ou seguindo dentro da paliçada (ex.: se recompôs do pânico) vai descansar. */
  quarterStragglers(this: WorldScene): void {
    if (this.engagement) return;
    const store = useGameStore.getState();
    let changed = false;
    store.battalions.forEach((data, i) => {
      const b = this.battalions.find((x) => x.id === data.id);
      const slot = this.campArea.quarterSlot(i);
      if (!b || !slot || b.isDestroyed || b.panicking || this.quartered.has(b.id) || !this.campArea.contains(b.center)) return;
      if (b.order.type !== "FOLLOW" && b.order.type !== "HOLD") return;
      this.quarter(b, i, slot);
      changed = true;
    });
    if (changed) this.campArea.buildQuarters(store, this.awayBattalions());
  },

  /**
   * Guardas do acampamento chamados por uma ordem (mensageiro, trombeta, voz): largam o
   * alojamento e saem para encontrar o Comandante (Marco 14).
   */
  updateGuards(this: WorldScene): void {
    if (this.inCamp || this.quartered.size === 0) return;
    const store = useGameStore.getState();
    const training = new Set(store.training.map((t) => t.battalionId));
    for (const b of this.battalions) {
      if (!this.quartered.has(b.id) || training.has(b.id) || b.isDestroyed || b.order.type === "HOLD") continue;
      this.unquarter(b);
      this.quartered.delete(b.id);
      store.setCampStay(store.campStay.filter((id) => id !== b.id));
      this.pushFeed(`${b.name} deixou o acampamento atendendo à ordem do Comandante.`);
      this.campArea.buildQuarters(useGameStore.getState(), this.awayBattalions());
    }
  },

  /** Mercado, paço e tavernas; numa batalha, o povoado está de portas fechadas. */
  townSpots(this: WorldScene): Interactable[] {
    return this.run ? [] : this.settlementLayer.interactables;
  },

  spots(this: WorldScene): Interactable[] {
    return [...this.campArea.interactables, ...this.seatGateSpots(), ...this.townSpots(), ...this.bridgeSpots, ...this.followerSpots(), ...this.houseSpots(), ...this.armySpots(), ...this.spoilSpots()];
  },

  /** Exércitos à vista, em paz com o bando: dá para ir à tenda do lorde (Marco 15). */
  armySpots(this: WorldScene): Interactable[] {
    const s = useGameStore.getState();
    const out: Interactable[] = [];
    for (const b of this.warbands.bands) {
      if (!b.armyId || !b.materialized || this.bandHostile(b)) continue;
      const lordId = s.armies.find((a) => a.id === b.armyId)?.lordId;
      const lord = lordId ? s.nobles.find((n) => n.id === lordId && n.alive) : undefined;
      if (!lord) continue;
      const realm = this.world.factions.find((f) => f.id === lord.factionId)?.name ?? "reino";
      const c = b.anchor;
      out.push({ label: `Tenda de ${nobleName(lord, realm)}`, door: { x: c.x, y: c.y }, panel: { kind: "GAME" }, bounds: new Phaser.Geom.Rectangle(c.x - 60, c.y - 60, 120, 120), radius: 170, enter: `field:${lord.id}` });
    }
    return out;
  },

  /** Do que é feito o bando do jogador (o que um reino derrotado viu). */
  armyShares(this: WorldScene): { infantry: number; archers: number; cavalry: number } {
    const count = (t: string) => this.battalions.filter((b) => TROOPS[b.troopType].family === t).reduce((n, b) => n + b.aliveCount, 0);
    const total = Math.max(1, this.battalions.reduce((n, b) => n + b.aliveCount, 0));
    return { infantry: count("INFANTRY") / total, archers: count("ARCHERS") / total, cavalry: count("CAVALRY") / total };
  },

  /** Campos de batalha com o que os mortos deixaram: o primeiro a chegar leva (Marco 16). */
  spoilSpots(this: WorldScene): Interactable[] {
    const s = useGameStore.getState();
    return s.battlefields
      .filter((b) => (b.spoils ?? 0) > 0 && s.day - b.day <= WAR_AI.SPOILS_DAYS)
      .map((b) => ({ label: `Saquear o campo de batalha (${b.spoils} mortos)`, door: { x: b.x, y: b.y }, panel: { kind: "GAME" } as const, bounds: new Phaser.Geom.Rectangle(b.x - 80, b.y - 80, 160, 160), radius: 200, enter: `spoils:${b.x}:${b.y}` }));
  },

  /** Banca do mascate (quando ele segue o bando). */
  followerSpots(this: WorldScene): Interactable[] {
    const stall = this.campArea.packed ? null : this.campLife.peddlerStall();
    if (!stall) return [];
    return [{ label: "Banca do mascate", door: { x: stall.x, y: stall.y + 36 }, panel: { kind: "PEDDLER" }, bounds: new Phaser.Geom.Rectangle(stall.x - 40, stall.y - 20, 80, 50), radius: 70, enter: "camp:PEDDLER" }];
  },

  updatePrompt(this: WorldScene): void {
    this.nearestSpot = this.campArea.nearestInteractable(this.commander, [...this.seatGateSpots(), ...this.townSpots(), ...this.bridgeSpots, ...this.followerSpots(), ...this.houseSpots(), ...this.armySpots(), ...this.spoilSpots()]);
    const store = useGameStore.getState();
    const spot = this.nearestSpot;
    const verb = spot?.enter && spot.enter !== "seat:out" ? "Entrar: " : "";
    // Com o relatório do combate aberto, o aviso cobriria os botões dele
    store.setCampPrompt(spot && !store.campPanel && !store.battleReport ? `E — ${verb}${spot.label}` : null);
  },

  houseSpots(this: WorldScene): Interactable[] {
    if (this.run) return [];
    const s = useGameStore.getState();
    const t = s.settlements.find((x) => {
      const l = this.settlementLayer.layoutOf(x.id);
      return l && x.owner !== "RUINED" && insideTown(l, this.commander);
    });
    if (!t) return [];
    if (this.houseCache?.townId === t.id) return this.houseCache.spots;
    const layout = this.settlementLayer.layoutOf(t.id);
    if (!layout) return [];
    const special = specialHouses(layout);
    const spots: Interactable[] = layout.houses
      .map((h, i) => ({ h, i }))
      .filter(({ i }) => i !== special.tavern && i !== special.guild)
      .map(({ h, i }) => ({
        label: "Casa de moradores",
        door: h.door,
        panel: { kind: "TOWN", settlementId: t.id, at: "MARKET" } as const,
        bounds: new Phaser.Geom.Rectangle(h.rect.x, h.rect.y, h.rect.w, h.rect.h),
        radius: 40,
        enter: `town:${t.id}:house:${i}`,
      }));
    this.houseCache = { townId: t.id, spots };
    return spots;
  },

  noteVisit(this: WorldScene, time: number): void {
    if (time - this.lastVisitNoteAt < 2000) return;
    this.lastVisitNoteAt = time;
    const s = useGameStore.getState();
    const t = s.settlements.find((x) => {
      const l = this.settlementLayer.layoutOf(x.id);
      return l && x.owner !== "RUINED" && insideTown(l, this.commander);
    });
    if (!t) return;
    const book = s.priceBook[t.id];
    if (book && book[book.length - 1].day >= s.day) return;
    s.notePrices(t.id, "VISIT");
  },

  /**
   * Entra numa estrutura (Marco 14): o mundo escurece e dorme (o tempo para) e a cena do
   * interior assume. Com inimigos por perto, não dá. Só com E ou com um clique: andar de
   * encontro à porta não entra mais (entrava sem querer).
   */
  enterBuilding(this: WorldScene, spot: Interactable): void {
    if (!spot.enter || this.interiorReturn) return;
    const store = useGameStore.getState();
    // Espólio: não há interior, é só recolher (Marco 16)
    if (spot.enter.startsWith("spoils:")) {
      const [, x, y] = spot.enter.split(":");
      this.pushFeed(store.lootBattlefield(Number(x), Number(y)));
      return;
    }
    // A fortaleza selada (Marco 22, parte 4): o portão leva de um lado ao outro, mesmo com inimigos
    if (spot.enter.startsWith("seat:")) return this.crossSeatGate(spot.enter === "seat:in");
    if (this.engagement || this.enemies.some((e) => e.isAlive && e.hostile && distance(e, this.commander) < 900)) {
      this.pushFeed("Inimigos por perto: não é hora de entrar em lugar nenhum.");
      return;
    }
    // Marco 15: o portão da muralha interna leva à Cidade Alta, que é outro mapa
    const capital = spot.enter.startsWith("capital:") ? spot.enter.slice(8) : null;
    if (capital && !this.cityGate(capital)) return;
    store.setCampPanel(null);
    this.walkPath = null;
    // Volta de costas para o prédio
    this.interiorReturn = { x: spot.door.x, y: spot.door.y, facing: Math.atan2(spot.door.y - spot.bounds.centerY, spot.door.x - spot.bounds.centerX) };
    const cam = this.cameras.main;
    cam.fadeOut(160, 0, 0, 0);
    cam.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      if (capital) this.scene.launch("CapitalScene", { townId: capital });
      else this.scene.launch("InteriorScene", { key: spot.enter, title: spot.label });
      this.scene.sleep();
    });
  },

  /**
   * Portão da muralha interna: em guerra ou com mandado, só de disfarce; quem ninguém conhece
   * paga a portagem. Os guardas falam pelo HUD (o resto dos portões fica lá dentro).
   */
  cityGate(this: WorldScene, townId: string): boolean {
    const store = useGameStore.getState();
    const t = store.settlements.find((x) => x.id === townId);
    if (!t) return false;
    const check = store.access("CITY", townId);
    const disguised = store.disguiseUntil > store.day + store.dayProgress;
    if (!check.open && !disguised) {
      this.pushFeed(`Guardas de ${t.name}: "${check.why}"`);
      return false;
    }
    if (check.open && store.fame < 15 && !isFactionFriend(store, t.owner)) {
      const paid = store.passGate(townId, "CITY", "TOLL");
      this.pushFeed(`Portão da Cidade Alta: ${paid.text}`);
      return paid.ok;
    }
    return true;
  },

  /** Tempo corrido na Cidade Alta: o mundo dorme na tela, mas não para (Marco 15). */
  advanceAbroad(this: WorldScene, days: number): void {
    this.handleWarbandEvents(this.warbands.advance(days));
    this.tradeNews(this.trade.advance(days));
    this.advanceScouts(days);
    this.passTime(days);
  },

  /** Saiu do prédio: o Comandante aparece diante da porta, de costas para ela. */
  onWake(this: WorldScene, data?: { after?: string | null; text?: string }): void {
    const r = this.interiorReturn;
    this.interiorReturn = null;
    // Quem entrou segurando uma tecla soltou lá dentro: aqui ela ficaria "apertada" para sempre
    this.input.keyboard?.resetKeys();
    const cam = this.cameras.main;
    cam.fadeIn(200, 0, 0, 0);
    if (r) {
      this.commander.x = r.x;
      this.commander.y = r.y;
      this.commander.setFacing(r.facing);
      this.lastCommanderPos = { x: r.x, y: r.y };
    }
    this.houseCache = null;
    this.lastHudAt = 0;
    if (data?.after === "rest") this.restUntilDawn();
    // Duelo pedido no paço de um lorde (Marco 15): a Liça improvisada no pátio
    if (data?.after === "duel") {
      this.scene.launch("DuelScene");
      this.scene.sleep();
    }
    if (data?.after === "duelover" && data.text) this.pushFeed(data.text);
  },

  walkTo(this: WorldScene, spot: Interactable | null, point: Point): void {
    const goal = spot ? spot.door : point;
    const shut = this.closedRule("VISITOR", goal);
    if (shut && !this.closedRule("VISITOR", this.commander)) {
      this.pushFeed(`Os portões de ${shut.name} estão fechados para o bando.`);
      return;
    }
    const path = this.campArea.contains(this.commander) && this.campArea.contains(goal) ? this.campArea.findPath(this.commander, goal, this.commander.radius) : [goal];
    this.walkPath = { path, open: spot?.panel, enter: spot?.enter ? spot : undefined };
  },

  followWalkPath(this: WorldScene, dt: number): void {
    const w = this.walkPath;
    if (!w || !this.commander.isAlive) return;
    if (this.commander.moveTowards(w.path[0].x, w.path[0].y, dt)) {
      w.path.shift();
      if (w.path.length === 0) {
        this.walkPath = null;
        if (w.enter) this.enterBuilding(w.enter);
        else if (w.open) useGameStore.getState().setCampPanel(w.open);
      }
    } else {
      this.commander.unitState = "MOVING";
    }
  },

  allAllies(this: WorldScene): Unit[] {
    const allies: Unit[] = [];
    if (this.commander.isAlive) allies.push(this.commander);
    if (this.works?.ram?.isAlive && this.works.ram.team === "ALLY") allies.push(this.works.ram);
    for (const b of this.battalions) for (const s of b.soldiers) if (s.isAlive) allies.push(s);
    for (const s of this.scouts) if (s.isAlive) allies.push(s);
    for (const m of this.messengers) if (m.isAlive) allies.push(m);
    if (useGameStore.getState().train !== "ROAD") for (const w of this.wagons) if (w.isAlive) allies.push(w);
    return allies;
  },

  // --- Forragear e acampamento móvel (Marco 13) ---

  forageBlocked(this: WorldScene): string | null {
    const s = useGameStore.getState();
    if (this.run) return "Só na campanha";
    if (this.inCamp) return "Saia do acampamento";
    if (this.engagement) return "Em combate";
    if (s.mutiny) return "Motim no acampamento";
    if (this.visibleEnemies().some((e) => distance(e, this.commander) < WORLD.TRAVEL_BLOCK_RADIUS)) return "Inimigos à vista";
    if (this.messengers.some((m) => m.isAlive && !m.available)) return "Mensageiros fora";
    if (this.settlementLayer.layouts.some((l) => insideTown(l, this.commander, 300))) return "Dentro de um povoado";
    return null;
  },

  /** Forragear: passa um quarto de dia (bandos podem chegar), rende conforme estação, bioma e esgotamento. */
  forage(this: WorldScene): void {
    const why = this.forageBlocked();
    if (why) return this.pushFeed(`Não dá para forragear agora: ${why.toLowerCase()}.`);
    const s = useGameStore.getState();
    const c = { x: this.commander.x, y: this.commander.y };
    const r = this.simulateMarch([c], SUPPLY.FORAGE_DAYS, WORLD.WARBAND.CAMP_GUARD_RADIUS);
    this.passTime(r.elapsed);
    if (r.interceptedBy) return this.pushFeed(`Forragem interrompida: o ${r.interceptedBy} chegou perto!`);
    const region = `${Math.floor(c.x / WORLD.REGION_WIDTH)},${Math.floor(c.y / WORLD.REGION_HEIGHT)}`;
    const owner = [...s.settlements]
      .filter((t) => isFactionOwner(t.owner) && distance(t, c) < SUPPLY.FORAGE_OWNER_RADIUS && !s.factions.some((f) => f.id === t.owner && f.atWar))
      .sort((a, b) => distance(a, c) - distance(b, c))[0];
    const def = owner ? this.world.factions.find((f) => f.id === owner.owner) : undefined;
    const text = useGameStore.getState().forageAt(region, geoOf(this.world.geo).biomeAt(c.x, c.y), def ? { id: def.id, name: def.name } : null);
    this.pushFeed(text);
    this.updateVision(this.time.now);
  },

  /** Onde nasce o acampamento montado aqui: a leste do Comandante, com o quadrado da planta logo depois dele. */
  pitchSite(this: WorldScene): Point {
    const half = (useGameStore.getState().campPlan.size / 2) * CELL;
    return { x: Math.round(this.commander.x + half + 260), y: Math.round(this.commander.y) };
  },

  /**
   * Madeira das árvores de dentro do quadrado (Marco 22): cada célula de floresta cortada vira
   * um pouco de madeira. Amostra o quadrado numa grade de 10×10.
   */
  pitchWood(this: WorldScene, site: Point): number {
    const size = useGameStore.getState().campPlan.size;
    const half = (size / 2) * CELL;
    const terrain = Unit.terrain;
    if (!terrain) return 0;
    let forest = 0;
    for (let j = 0; j < 10; j++) {
      for (let i = 0; i < 10; i++) {
        const p = { x: site.x - half + ((i + 0.5) * 2 * half) / 10, y: site.y - half + ((j + 0.5) * 2 * half) / 10 };
        if (terrain.typeAt(p.x, p.y) === "FOREST") forest++;
      }
    }
    return Math.round((forest / 100) * size * size * WOOD_PER_FOREST_CELL);
  },

  /** Quanto da volta do acampamento (até duas vezes o lado da paliçada grande) é floresta: o lenhador tira dela. */
  forestAround(this: WorldScene, site: Point): number {
    const terrain = Unit.terrain;
    if (!terrain) return 0;
    const reach = 28 * CELL;
    let forest = 0;
    let n = 0;
    for (let j = 0; j < 12; j++) {
      for (let i = 0; i < 12; i++) {
        const p = { x: site.x - reach + ((i + 0.5) * 2 * reach) / 12, y: site.y - reach + ((j + 0.5) * 2 * reach) / 12 };
        n++;
        if (terrain.typeAt(p.x, p.y) === "FOREST") forest++;
      }
    }
    return Math.round((forest / n) * 100) / 100;
  },

  /**
   * O quadrado da fortaleza (34×34, com a muralha) cabe em volta do acampamento? Só a faixa de
   * fora da paliçada grande é conferida: dentro, já é do bando (Marco 22, parte 3).
   */
  standardBlocked(this: WorldScene): string | null {
    const s = useGameStore.getState();
    if (this.run) return "Só na campanha";
    if (s.campPacked || s.campPlan.size !== 28 || s.fortress) return null;
    const geo = geoOf(this.world.geo);
    const c = this.world.camp.center;
    const inner = 14 * CELL + 20;
    const outer = 17 * CELL + 60;
    for (let j = 0; j <= 12; j++) {
      for (let i = 0; i <= 12; i++) {
        const p = { x: c.x - outer + (2 * outer * i) / 12, y: c.y - outer + (2 * outer * j) / 12 };
        if (Math.abs(p.x - c.x) < inner && Math.abs(p.y - c.y) < inner) continue;
        if (!geo.isOpenLand(p, 30)) return "A muralha da fortaleza não cabe aqui: água, rio ou rocha em volta da paliçada";
        if (this.settlementLayer.layouts.some((l) => insideTown(l, p, -40))) return "A muralha da fortaleza encostaria num povoado";
      }
    }
    return null;
  },

  /** Onde nasce o acampamento de campo: logo a leste do Comandante. */
  fieldSite(this: WorldScene): Point {
    return { x: Math.round(this.commander.x + 220), y: Math.round(this.commander.y) };
  },

  fieldBlocked(this: WorldScene): string | null {
    const s = useGameStore.getState();
    if (this.run || !s.fortress) return "Só com a fortaleza";
    if (s.fieldCamp) return null;
    if (this.inCamp) return "Na fortaleza, o bando dorme nela";
    if (this.engagement) return "Em combate";
    if (this.visibleEnemies().some((e) => distance(e, this.commander) < WORLD.TRAVEL_BLOCK_RADIUS)) return "Inimigos à vista";
    if (s.train !== "ARMY") return "O kit vai nas carroças: elas precisam estar com o exército";
    const site = this.fieldSite();
    if (distance(site, this.world.camp.center) < FIELD_MIN_DISTANCE) return "Perto demais da fortaleza";
    const geo = geoOf(this.world.geo);
    for (const [dx, dy] of [[0, 0], [-160, 0], [160, 0], [0, -140], [0, 140]]) {
      const p = { x: site.x + dx, y: site.y + dy };
      if (!geo.isOpenLand(p, 30) || Unit.terrain?.isBlocked(p.x, p.y)) return "Não há chão livre aqui";
    }
    return null;
  },

  /** Monta o acampamento de campo (meio dia de trabalho) ou o recolhe, se já estiver montado. */
  toggleFieldCamp(this: WorldScene): void {
    const s = useGameStore.getState();
    if (s.fieldCamp) {
      if (distance(this.commander, s.fieldCamp) > FIELD_RADIUS * 2) return this.pushFeed("O acampamento de campo só se recolhe de perto.");
      this.passTime(0.25);
      s.strikeFieldCamp();
      return;
    }
    const why = this.fieldBlocked();
    if (why) return this.pushFeed(`Não dá para montar o acampamento de campo: ${why.toLowerCase()}.`);
    this.passTime(0.5);
    const out = useGameStore.getState().pitchFieldCamp(this.fieldSite());
    if (out) this.pushFeed(out);
  },

  pitchBlocked(this: WorldScene): string | null {
    const s = useGameStore.getState();
    if (this.run) return "Só na campanha";
    if (!s.campPacked) return "O acampamento está montado";
    if (this.engagement) return "Em combate";
    if (this.visibleEnemies().some((e) => distance(e, this.commander) < WORLD.TRAVEL_BLOCK_RADIUS)) return "Inimigos à vista";
    if (this.messengers.some((m) => m.isAlive && !m.available)) return "Mensageiros fora";
    const site = this.pitchSite();
    const near = [...s.settlements, ...this.world.sites.map((x) => x.center)].some((t) => distance(t, site) < CAMP_MOVE.MIN_TOWN_DISTANCE);
    if (near) return "Perto demais de um povoado ou de um local";
    // O quadrado da planta precisa caber: água e rocha impedem (as árvores viram madeira)
    const geo = geoOf(this.world.geo);
    const w = s.campPlan.size * CELL + 160;
    for (let j = 0; j <= 6; j++) {
      for (let i = 0; i <= 6; i++) {
        const p = { x: site.x - w / 2 + (w * i) / 6, y: site.y - w / 2 + (w * j) / 6 };
        if (!geo.isOpenLand(p, 40) || Unit.terrain?.isBlocked(p.x, p.y)) return `O quadrado de ${s.campPlan.size}×${s.campPlan.size} não cabe: água, rio, rocha ou construções`;
      }
    }
    return null;
  },

  /** Levantar o acampamento: um dia e meio de trabalho; o bando sai com tudo nas carroças. */
  packCamp(this: WorldScene): void {
    const s = useGameStore.getState();
    if (!this.inCamp) return this.pushFeed("O acampamento só se levanta de dentro dele.");
    if (this.engagement || this.messengers.some((m) => m.isAlive && !m.available)) return this.pushFeed("Agora não dá para levantar o acampamento.");
    if (s.training.length > 0) return this.pushFeed("Há batalhões no Campo de Treino: espere o treino terminar.");
    this.passTime(CAMP_MOVE.PACK_DAYS);
    const why = useGameStore.getState().packCamp();
    if (why) return this.pushFeed(`Não dá para levantar o acampamento: ${why.toLowerCase()}`);
    const gate = this.world.camp.gate;
    this.placeArmy({ x: gate.x - 260, y: gate.y }, Math.PI);
    useGameStore.getState().loadWagons();
    this.restBy(-10);
    this.reloadWorld();
  },

  /** Montar o acampamento aqui: um dia de trabalho; o mundo é refeito com ele no lugar novo. */
  pitchCamp(this: WorldScene): void {
    const why = this.pitchBlocked();
    if (why) return this.pushFeed(`Não dá para montar o acampamento aqui: ${why.toLowerCase()}.`);
    const site = this.pitchSite();
    const wood = this.pitchWood(site);
    this.passTime(CAMP_MOVE.PITCH_DAYS);
    const field = this.captureField();
    if (typeof field === "string") return this.pushFeed(field);
    useGameStore.getState().pitchCamp(site, field, wood, this.forestAround(site));
  },

  /** Recria o mundo com o campo como está (acampamento redesenhado, levantado ou montado). */
  reloadWorld(this: WorldScene): boolean {
    const field = this.captureField();
    if (typeof field === "string") {
      this.pushFeed(field);
      return false;
    }
    useGameStore.setState((s) => ({ pendingField: field, loadNonce: s.loadNonce + 1 }));
    return true;
  },

  // --- Vida no acampamento ---

  /** O batalhão descansa no alojamento: segura a posição e a rotina do acampamento assume. */
  quarter(this: WorldScene, b: Battalion, index: number, slot: Point): void {
    b.restAt(slot);
    b.restDriver = this.campLife.driverFor(b, index);
    this.quartered.add(b.id);
  },

  /** O batalhão deixa de descansar (sai com o Comandante, viaja, foi derrotado). */
  unquarter(this: WorldScene, b: Battalion): void {
    if (!b.restDriver) return;
    b.restDriver = null;
    this.campLife.release(b);
  },

  /** O que o acampamento está vivendo (para a rotina dos soldados): lido do store 2 vezes por segundo. */
  updateCampLife(this: WorldScene, time: number, dt: number): void {
    if (time - this.lastCampStateAt > 500) {
      this.lastCampStateAt = time;
      const s = useGameStore.getState();
      const morale = startingMorale(s.hungryDays, s.arrearsWeeks, campMoraleBonus(s.campMood, s.followers)).value;
      const assigned = s.lieutenants.filter((l) => l.battalionId);
      const friends: [string, string][] = [];
      for (let i = 0; i < assigned.length; i++) {
        for (let j = i + 1; j < assigned.length; j++) {
          if (bondOf(s.bonds, assigned[i].id, assigned[j].id) >= FRIEND_AT) friends.push([assigned[i].id, assigned[j].id]);
        }
      }
      const state: CampState = {
        hour: hourOf(s.dayProgress),
        hungry: s.hungryDays > 0 || s.rations < dailyRations(s.battalions, s.followers),
        lowMorale: morale < 60,
        arrears: s.arrearsWeeks > 0,
        rebelId: s.pendingMutiny ? (mutinyLeader(s.battalions)?.id ?? null) : null,
        party: s.lastVictoryDay !== null && s.day - s.lastVictoryDay <= 1 && s.hungryDays === 0,
        friends,
        training: s.training.map((t) => t.battalionId).filter((id) => this.quartered.has(id)),
        // Feridos e doentes na enfermaria (Marco 13), ou um combate de ontem
        wounded: s.day + s.dayProgress - this.lastCombatDay < 1 || s.battalions.some((b) => (b.wounded ?? 0) + (b.sick ?? 0) > 0),
        // Dia do soldo (pago em dia): de manhã, fila diante da tenda do Comandante
        payday: s.day % ECONOMY.PAYDAY_INTERVAL === 0 && s.arrearsWeeks === 0 && hourOf(s.dayProgress) >= 8 && hourOf(s.dayProgress) < 13,
        iron: s.iron > 0,
        ...campShortages(s),
      };
      this.campLife.setState(state);
      // Treino: o que falta, sobre o Campo de Treino; terminado, o XP entra
      const done = s.finishTraining();
      if (done.length > 0) this.pushFeed(`Treino concluído: ${done.map((id) => s.battalions.find((b) => b.id === id)?.name ?? id).join(", ")}.`);
      const now = s.day + s.dayProgress;
      this.campLife.setTrainingText(
        s.training
          .map((t) => `${s.battalions.find((b) => b.id === t.battalionId)?.name ?? "?"}: ${Math.max(0, t.until - now).toFixed(1).replace(".", ",")} dia`)
          .join(" · ")
          .replace(/^(.+)$/, "Treino — $1"),
      );
    }
    const view = this.cameras.main.worldView;
    const near = distance({ x: view.centerX, y: view.centerY }, this.campArea.campfire) < 1800;
    this.campLife.update(time, dt, near);
  },

  // --- Noite ---

  /** Escuridão, regras da noite (visão, percepção dos inimigos) e as luzes do mundo. */
  updateNight(this: WorldScene, progress: number): void {
    const d = darknessAt(progress);
    Unit.darkness = d;
    // Tochas denunciam o bando de longe; no escuro ele passa despercebido
    Enemy.perception = 1 + d * ((this.torches ? TIME.NIGHT_AGGRO_TORCHES : TIME.NIGHT_AGGRO_DARK) - 1);
    Enemy.darkPerception = 1 + d * (TIME.NIGHT_AGGRO_DARK - 1);
    this.night.update(this.cameras.main, d, d > 0.01 ? this.nightLights() : []);
  },

  /** Raio de visão do bando em relação ao dia (tochas ajudam a enxergar no escuro). */
  nightVision(this: WorldScene): number {
    return 1 - Unit.darkness * (1 - (this.torches ? TIME.TORCH_VISION : TIME.NIGHT_VISION));
  },

  nightLights(this: WorldScene): Light[] {
    const L = TIME.LIGHT;
    const out: Light[] = [{ x: this.campArea.campfire.x, y: this.campArea.campfire.y, radius: L.CAMPFIRE }];
    if (this.torches) {
      if (this.commander.isAlive) out.push({ x: this.commander.x, y: this.commander.y, radius: L.TORCH });
      for (const b of this.battalions) if (!b.isDestroyed) out.push({ ...b.center, radius: L.BATTALION });
      for (const m of this.messengers) if (m.isAlive) out.push({ x: m.x, y: m.y, radius: L.TORCH * 0.6 });
    }
    const store = useGameStore.getState();
    out.push(...this.settlementLayer.lights);
    for (const p of this.campLife.lights()) out.push({ x: p.x, y: p.y, radius: L.TORCH });
    for (const p of this.mapLife.lanterns()) out.push({ x: p.x, y: p.y, radius: 140 });
    for (const p of this.garrisons.lights()) out.push({ x: p.x, y: p.y, radius: L.TORCH });
    for (const c of store.calamities) if (!c.defeated) out.push({ ...c.lair, radius: L.LAIR });
    return out;
  },

  setForced(this: WorldScene, on: boolean): void {
    this.forced = on;
    this.pushFeed(
      on
        ? "Marcha forçada: o dia rende mais caminho, mas a tropa cansa muito mais depressa."
        : "Passo normal de marcha.",
    );
    this.publishHud();
  },

  setTorches(this: WorldScene, on: boolean): void {
    this.torches = on;
    this.pushFeed(
      on
        ? "Tochas acesas: o bando enxerga mais longe no escuro, mas é visto de longe."
        : "Tochas apagadas: o bando se esconde na noite (goblins e mortos-vivos enxergam no escuro).",
    );
    this.updateVision(this.time.now);
    this.publishHud();
  },

  /** Emboscada noturna: inimigos que surgem do escuro e já atacam abalam quem é pego de surpresa. */
  checkNightAmbush(this: WorldScene, hot: readonly Enemy[], time: number): void {
    const eng = this.engagement;
    if (!eng || Unit.darkness < 0.5) return;
    const sudden = hot.filter((e) => {
      const seen = this.firstSeenAt.get(e);
      return seen === undefined || time - seen < TIME.AMBUSH_WINDOW_MS;
    });
    if (sudden.length === 0 || sudden.length < hot.length / 2) return;
    const caught = this.battalions.filter((b) => !b.isDestroyed && sudden.some((e) => distance(e, b.center) <= WORLD.ENGAGE_RADIUS * 1.5));
    if (caught.length === 0) return;
    for (const b of caught) b.morale = Math.max(0, b.morale - TIME.AMBUSH_MORALE);
    eng.notes.push("Emboscada noturna: o inimigo surgiu do escuro.");
    this.pushFeed(`Emboscada noturna! ${caught.map((b) => b.name).join(", ")} foram pegos de surpresa.`);
  },
};

export type CampMethods = typeof campMethods;
