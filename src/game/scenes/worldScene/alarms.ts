import type { Enemy } from "../../entities/Enemy";
import { useGameStore } from "../../../store/useGameStore";
import { WORLD } from "../../../utils/constants";
import { distance, type Point } from "../../../utils/math";
import { alarms, type RaiseOptions } from "../../../audio/alarms";
import { realmNews, type AlarmKind, type RealmWatch } from "../../../audio/alarmRules";
import { regionAt } from "../../data/world";
import type { WorldScene } from "../WorldScene";

/**
 * Os alarmes e os sinais do campo (S1): a cena olha o que mudou (o acampamento sob ataque, o herói
 * inimigo que aparece, as carroças que apanham, a guerra, a calamidade, o soldo) e pede o alarme,
 * que toca o som dele e põe uma seta na borda da tela. Uma parte da `WorldScene`: os métodos entram
 * no protótipo dela.
 */

/** De quanto em quanto tempo a cena olha (ms). */
const WATCH_MS = 500;
/** Quem levou golpe há menos que isto está sendo atacado (ms). */
const HIT_MS = 1500;
/** Aldeia que não é nossa só toca o sino se o Comandante está a menos disto. */
export const VILLAGE_EARSHOT = 5000;
/** Quem não ataca ninguém: chegar perto do acampamento não é ataque. */
const HARMLESS = new Set(["CIVILIAN", "MERCHANT", "CART"]);

/** O meio da região (os rumores dizem a região, não o lugar). */
function regionCenter(scene: WorldScene, p: Point): Point {
  const r = regionAt(scene.world, p);
  return { x: (r.col + 0.5) * WORLD.REGION_WIDTH, y: (r.row + 0.5) * WORLD.REGION_HEIGHT };
}

export const alarmsMethods = {
  raiseAlarm(this: WorldScene, kind: AlarmKind, opts: RaiseOptions = {}): boolean {
    return alarms.raise(kind, opts);
  },

  /** O sino de uma aldeia atacada: a nossa sempre; a dos outros, só se o Comandante está perto. */
  villageBell(this: WorldScene, t: Point & { id: string; name: string }, wasOurs: boolean, text: string): void {
    if (!wasOurs && distance(this.commander, t) > VILLAGE_EARSHOT) return;
    this.raiseAlarm("village", { key: t.id, at: { x: t.x, y: t.y }, text });
  },

  updateAlarms(this: WorldScene, time: number): void {
    if (time - this.alarmWatchAt < WATCH_MS) return;
    this.alarmWatchAt = time;
    const store = useGameStore.getState();

    // O herói inimigo que entra na vista: o tambor grave
    for (const e of this.enemies) {
      if (!e.hero || !e.isAlive || !e.revealed || this.heroesSeen.has(e) || !this.fog.canSee(e)) continue;
      this.heroesSeen.add(e);
      this.raiseAlarm("hero", { key: e.hero.name, at: e, text: `${e.hero.name} à vista!` });
    }

    // As carroças apanhando no campo
    const wagon = this.wagons.find((w) => w.isAlive && time - w.lastHitAt < HIT_MS);
    if (wagon) this.raiseAlarm("convoy", { key: "carroças", at: wagon, text: "As carroças estão sendo atacadas!" });

    if (store.scenario) return;

    // O acampamento: inimigo dentro dele, ou um bando vindo contra ele
    if (!this.campArea.packed) {
      const camp = this.world.camp.center;
      const radius = WORLD.WARBAND.CAMP_GUARD_RADIUS;
      const inside = this.enemies.find((e: Enemy) => e.isAlive && e.revealed && !e.routed && !HARMLESS.has(e.kind) && distance(e, camp) < radius * 0.8);
      if (inside) this.raiseAlarm("camp", { at: camp, text: "O acampamento está sendo atacado!" });
      else {
        const coming = this.warbands.bands.find((b) => b.goal.kind === "CAMP" && this.bandHostile(b) && distance(b.anchor, camp) < radius * 1.6);
        if (coming) this.raiseAlarm("camp", { at: camp, text: `${coming.name} vem contra o acampamento!` });
      }
    }

    // O reino: guerras, calamidades, o soldo e a sede cercada
    const watch: RealmWatch = {
      wars: store.wars.filter((w) => w.peace === undefined).map((w) => `${w.a}|${w.b}|${w.since}`),
      calamities: store.calamities.filter((c) => !c.defeated).map((c) => c.id),
      arrears: store.arrearsWeeks,
      seatAlarm: !!store.seatAlarm,
    };
    const news = realmNews(this.realmWatch, watch);
    this.realmWatch = watch;
    const realm = (id: string) => this.world.factions.find((f) => f.id === id)?.name ?? "um reino";
    for (const key of news.wars) {
      const [a, b] = key.split("|");
      const seatId = store.factions.find((f) => f.id === a)?.seatId;
      const seat = store.settlements.find((t) => t.id === seatId);
      this.raiseAlarm("war", { key, at: seat ? { x: seat.x, y: seat.y } : null, text: `Guerra! ${realm(a)} contra ${realm(b)}` });
    }
    for (const id of news.calamities) {
      const c = store.calamities.find((x) => x.id === id);
      if (c) this.raiseAlarm("calamity", { key: id, at: c.revealed ? c.lair : regionCenter(this, c.lair), text: `${c.name}, em ${c.region}` });
    }
    if (news.arrears) {
      const weeks = store.arrearsWeeks;
      this.raiseAlarm("wages", { at: this.world.camp.center, text: `Soldo atrasado há ${weeks} semana${weeks > 1 ? "s" : ""}: os homens resmungam` });
    }
    if (news.seat && store.seatAlarm) {
      this.raiseAlarm("camp", { key: "sede", at: this.world.camp.center, text: `Às muralhas! ${store.seatAlarm.attackers} inimigos cercam a sede` });
    }
  },
};

export type AlarmsMethods = typeof alarmsMethods;
