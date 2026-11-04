import { Unit } from "../../entities/Unit";
import { useGameStore, type SupportReport } from "../../../store/useGameStore";
import { SUPPORT, TRADE } from "../../../utils/constants";
import { distance } from "../../../utils/math";
import type { WorldScene } from "../WorldScene";

/**
 * O HUD da batalha e o relatório de apoio.
 * Uma parte da `WorldScene`: os métodos entram no protótipo dela (ver o fim de `WorldScene.ts`).
 */
export const hudMethods = {
  // --- HUD e fim de batalha ---

  /** Baixas e entregas ainda não informadas ao store (cada relatório leva só as novas). */
  supportReport(this: WorldScene): SupportReport {
    return {
      deadScoutIds: this.deadScoutIds.filter((id) => !this.reportedDead.has(id)),
      deadMessengerIds: this.deadMessengerIds.filter((id) => !this.reportedDead.has(id)),
      deliveries: Object.fromEntries(this.messengers.map((m) => [m.rider.id, m.deliveries])),
    };
  },

  publishHud(this: WorldScene): void {
    useGameStore.getState().setBattleHud({
      commanderHp: this.commander.hp,
      commanderMaxHp: this.commander.maxHp,
      battalions: this.battalions.map((b) => ({
        id: b.id,
        name: b.name,
        troopType: b.troopType,
        formation: b.formation,
        terrain: Unit.terrain?.typeAt(b.center.x, b.center.y) ?? "GRASS",
        level: b.level,
        kills: b.kills,
        lieutenant: b.lieutenant ? { name: b.lieutenant.name, alive: b.lieutenantAlive, kills: b.lieutenantKills } : null,
        alive: b.aliveCount,
        max: b.startingCount,
        morale: Math.round(b.morale),
        status: b.status,
        running: b.running,
        flanked: b.flanked,
        ammo: b.ammoLeft,
        holdFire: b.holdFire,
        cycle: b.cycle,
        kiting: b.kiting,
        mayCycle: b.mayCycle,
        selected: b.selected,
        inCommand: !b.isDestroyed && this.inCommand(b),
        reach: b.isDestroyed ? "NONE" : (this.reachOf(b, "BASIC_VISUAL") ?? "NONE"),
        seesBanner: !b.isDestroyed && this.seesBanner(b.center),
        pendingOrder: b.pendingOrder,
      })),
      scouts: this.scouts.map((s) => ({
        id: s.rider.id,
        name: s.rider.name,
        hp: Math.ceil(s.hp),
        maxHp: s.maxHp,
        mode: s.mode,
        alive: s.isAlive,
        selected: s.selected,
        fleeing: s.evading,
        contact: s.inContact,
        sneaking: s.sneaking,
        rank: s.rank,
        harpy: s.rider.harpy
          ? { name: s.rider.harpy.name, readyDay: s.rider.harpy.readyDay, state: this.harpyOf(s)?.state ?? null, sheltering: this.harpyOf(s)?.sheltering ?? false, orders: this.harpyOf(s)?.orders.length ?? 0 }
          : null,
      })),
      messengers: this.messengers.map((m) => ({
        id: m.rider.id,
        name: m.rider.name,
        level: m.rider.level,
        state: m.isAlive ? m.riderState : "DEAD",
      })),
      feed: this.feed,
      companies: this.companies.hud(this.battalions),
      foes: this.hosts.hosts
        .filter((h) => h.members.some((m) => m.revealed && m.hostile))
        .map((h) => ({ key: h.key, name: h.name, trait: h.staff.traits[0] ?? null, status: h.status, morale: Math.round(h.morale), count: h.members.filter((m) => m.revealed).length })),
      support: this.supportReport(),
      camera: { locked: this.cameraLocked, zoom: this.cameras.main.zoom },
      tacticalPause: this.tacticalPause,
      position: { x: Math.round(this.commander.x), y: Math.round(this.commander.y) },
      escort: this.escortAt(),
      slow: { left: Math.round(this.slowLeft), wait: Math.round(this.slowWait) },
      duel: this.duelHud(),
      warCryIn: Math.max(0, Math.ceil((SUPPORT.WAR_CRY.COOLDOWN_MS - (this.time.now - this.warCryAt)) / 1000)),
      bannerFaltering: this.commander.hp / this.commander.maxHp < SUPPORT.BANNER_FALTER_HP,
      enemiesInSight: this.visibleEnemies().length,
      engaged: this.engagement !== null,
      inCamp: this.inCamp,
      region: this.placeName(this.commander),
      foundBlocked: this.foundBlocked(),
      torches: this.torches,
      restBlocked: this.restBlocked(),
      weather: this.weather,
      forecast: this.forecast(),
      forced: this.forced,
      forageBlocked: this.forageBlocked(),
      fatigue: Object.fromEntries(this.battalions.map((b) => [b.id, Math.round(b.fatigue)])),
      wagonsAlive: this.wagons.filter((w) => w.isAlive).length,
      pitchBlocked: this.pitchBlocked(),
      // Carroças perto do Comandante: no acampamento elas estão no pátio; em campo, a até um tanto dele
      wagonsNear: this.inCamp || (useGameStore.getState().train !== "ROAD" && this.wagons.some((w) => w.isAlive && distance(w, this.commander) < TRADE.WAGON_REACH)),
    });
  },
};

export type HudMethods = typeof hudMethods;
