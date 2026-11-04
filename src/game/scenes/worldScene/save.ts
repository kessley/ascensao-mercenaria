import { Enemy } from "../../entities/Enemy";
import { Scout } from "../../entities/Scout";
import { bandSize } from "../../systems/Warbands";
import { isRaiderKind } from "../../sim/realm";
import { AUTO_SLOT, type EnemySave, type FieldSave } from "../../save/saveGame";
import { useGameStore, type WarbandSighting } from "../../../store/useGameStore";
import { BALANCE, SUPPORT } from "../../../utils/constants";
import { formatHour } from "../../../utils/time";
import { centroid, distance, type Point } from "../../../utils/math";
import type { WorldScene } from "../WorldScene";

/**
 * Salvar e carregar o campo, e o retrato do mapa para a interface.
 * Uma parte da `WorldScene`: os métodos entram no protótipo dela (ver o fim de `WorldScene.ts`).
 */
export const saveMethods = {
  // --- Salvar e carregar ---

  /** Salva no espaço automático (no máximo a cada 15 s, nunca em combate). */
  autosave(this: WorldScene): void {
    if (this.engagement || this.time.now - this.lastAutosaveAt < 15000) return;
    if (useGameStore.getState().saveGame(AUTO_SLOT) === null) this.lastAutosaveAt = this.time.now;
  },

  /** Retrato do campo para o save, ou o motivo de não dar para salvar agora. */
  captureField(this: WorldScene): FieldSave | string {
    if (this.engagement) return "Em combate: não dá para salvar agora.";
    if (this.messengers.some((m) => m.isAlive && !m.available)) return "Aguarde os mensageiros voltarem para salvar.";
    const c = this.commander;
    const enemies: EnemySave[] = this.enemies
      // Guarnições e bichos não vão no save: voltam a aparecer quando o bando chega perto
      .filter((e) => e.isAlive && e.owner?.kind !== "WARBAND" && e.owner?.kind !== "MUTINY" && e.owner?.kind !== "GARRISON" && e.owner?.kind !== "WILDLIFE" && e.owner?.kind !== "SITE")
      .map((e) => ({ kind: e.kind, x: e.x, y: e.y, hp: e.hp, color: e.bodyColor, owner: e.owner }));
    return {
      commander: { x: c.x, y: c.y, hp: c.hp, facing: c.facing },
      quartered: [...this.quartered],
      battalions: this.battalions.filter((b) => !b.isDestroyed).map((b) => ({ id: b.id, ...b.center, morale: b.morale })),
      scouts: this.scouts.filter((s) => s.isAlive).map((s) => this.scoutSave(s)),
      messengers: this.messengers.filter((m) => m.isAlive).map((m) => ({ id: m.rider.id, x: m.x, y: m.y })),
      fog: this.fog.exportExplored(),
      warbands: this.warbands.serialize(),
      enemies,
      torches: this.torches,
      wagons: this.wagons.filter((w) => w.isAlive).map((w) => ({ id: w.wagonId, x: w.x, y: w.y, hp: w.hp })),
      fatigue: Object.fromEntries(this.battalions.map((b) => [b.id, b.fatigue])),
      forced: this.forced,
      trade: this.trade.serialize(),
      siegeWorks: this.works?.serialize(),
    };
  },

  /** Jogo carregado: põe tudo onde estava (o mundo e o exército já foram criados a partir do store). */
  restoreField(this: WorldScene, field: FieldSave | null): void {
    if (!field) return;
    const store = useGameStore.getState();
    const c = this.commander;
    c.x = field.commander.x;
    c.y = field.commander.y;
    c.setFacing(field.commander.facing);
    c.restoreHp(field.commander.hp);
    this.lastCommanderPos = { x: c.x, y: c.y };
    this.inCamp = this.campArea.contains(c);

    // Batalhões: quem descansava continua no alojamento; os outros voltam a seguir o Comandante
    const quartered = new Set(field.quartered);
    for (const b of this.battalions) {
      b.fatigue = field.fatigue?.[b.id] ?? 0;
      this.fatigueById.set(b.id, b.fatigue);
      const saved = field.battalions.find((x) => x.id === b.id);
      if (!saved) continue;
      b.morale = saved.morale;
      if (quartered.has(b.id)) continue;
      this.quartered.delete(b.id);
      this.unquarter(b);
      b.teleportTo(saved);
      b.orderFollow(c);
    }
    this.followKey = "";
    this.campArea.buildQuarters(store, this.awayBattalions());
    for (const s of this.scouts) {
      const saved = field.scouts.find((x) => x.id === s.rider.id);
      if (!saved) continue;
      s.x = saved.x;
      s.y = saved.y;
      s.restoreHp(saved.hp);
      s.restore(saved);
      s.inContact = distance(s, this.commander) <= SUPPORT.SCOUT.LIVE_RANGE;
      s.setVisible(s.inContact);
    }
    for (const m of this.messengers) {
      const saved = field.messengers.find((x) => x.id === m.rider.id);
      if (!saved) continue;
      m.x = saved.x;
      m.y = saved.y;
    }

    this.fog.importExplored(field.fog);
    this.warbands.restore(field.warbands);
    this.trade.restore(field.trade);

    // Inimigos dos locais (contrato, cerco, covis) com a vida que tinham. Os moradores dos locais
    // não vão no save: o store guarda quantos são, e eles voltam quando o bando chegar perto
    this.siteResidents.forget();
    for (const e of this.enemies) {
      if (!e.isAlive || e.owner?.kind === "WARBAND") continue;
      e.unitState = "DEAD";
      e.destroy();
    }
    this.enemies = this.enemies.filter((e) => e.isAlive);
    this.contractEnemies = [];
    for (const saved of field.enemies) {
      const e = this.spawnEnemy(saved.x, saved.y, saved.kind, saved.color);
      e.owner = saved.owner;
      e.restoreHp(saved.hp);
      if (saved.owner?.kind === "CONTRACT") this.contractEnemies.push(e);
      else if (saved.owner?.kind === "CALAMITY" && e.isBoss) {
        const lair = this.calamityObjects.get(saved.owner.id);
        if (lair) lair.boss = e;
      }
    }
    // Comando dos grupos que voltaram (locais de contrato e covis)
    const byOwner = new Map<string, Enemy[]>();
    for (const e of this.enemies) {
      const o = e.owner;
      if (!e.isAlive || (o?.kind !== "CONTRACT" && o?.kind !== "CALAMITY")) continue;
      const key = o.kind === "CONTRACT" ? `contract:${o.contractId}` : `calamity:${o.id}`;
      byOwner.set(key, [...(byOwner.get(key) ?? []), e]);
    }
    for (const [key, units] of byOwner) {
      if (this.hosts.hosts.some((h) => h.key.startsWith(key))) continue;
      this.attachGroup(key, units).standFast = key.startsWith("calamity:");
    }
    // Um líder de calamidade sem registro no save volta inteiro (nunca é dado por morto)
    for (const [id, lair] of this.calamityObjects) {
      if (lair.boss.isAlive) continue;
      const cal = store.calamities.find((x) => x.id === id);
      if (!cal) continue;
      const [boss] = this.spawnEnemyGroup(
        { x: cal.lair.x, y: cal.lair.y, units: [[cal.kind === "NECROMANCER" ? "NECROMANCER" : "ORC_WARLORD", 1]] },
        { kind: "CALAMITY", id },
      );
      lair.boss = boss;
    }

    if (field.siegeWorks) this.works?.restore(field.siegeWorks);
    this.torches = field.torches;
    this.forced = field.forced ?? false;
    // Carroças onde estavam (no acampamento, estacionadas)
    for (const w of this.wagons) {
      const saved = field.wagons?.find((x) => x.id === w.wagonId);
      if (!saved || this.inCamp) {
        const p = this.wagonSlot(this.wagons.indexOf(w));
        w.x = p.x;
        w.y = p.y;
        continue;
      }
      w.x = saved.x;
      w.y = saved.y;
      w.restoreHp(saved.hp);
    }
    if (store.mutiny) this.armyDirty = true;
    this.cameras.main.centerOn(c.x, c.y);
    this.updateVision(this.time.now);
    this.pushFeed(`Jogo carregado: dia ${store.day}, ${formatHour(store.dayProgress)}.`);
  },

  /** Põe o exército inteiro em marcha atrás do Comandante, num ponto novo do mapa. */
  placeArmy(this: WorldScene, at: Point, facing: number): void {
    const c = this.commander;
    c.x = at.x;
    c.y = at.y;
    c.setFacing(facing);
    this.lastCommanderPos = { x: c.x, y: c.y };
    this.walkPath = null;
    // Fora do acampamento por um quadro: se o ponto é dentro dele, a entrada é detectada e a tropa vai aos alojamentos
    // (saindo dele de uma vez — viagem rápida — as carroças carregam antes de partir)
    if (this.inCamp) useGameStore.getState().loadWagons();
    this.inCamp = false;
    const training = new Set(useGameStore.getState().training.map((t) => t.battalionId));
    for (const b of this.battalions) if (!training.has(b.id)) this.unquarter(b);
    for (const id of [...this.quartered]) if (!training.has(id)) this.quartered.delete(id);
    // Comandante dentro de um povoado que barra o exército: a tropa fica no portão
    const shut = this.closedRule("ARMY", c);
    const base = shut ? this.gateWait(shut.id, c) : { point: { x: c.x, y: c.y }, facing };
    const back = (d: number, lateral: number): Point => {
      const o = base.point;
      const f = base.facing;
      const p = { x: o.x - Math.cos(f) * d - Math.sin(f) * lateral, y: o.y - Math.sin(f) * d + Math.cos(f) * lateral };
      return this.armyNav.nearestOpen(p, 600) ?? { x: o.x, y: o.y };
    };
    const alive = this.battalions.filter((b) => !b.isDestroyed && !training.has(b.id));
    alive.forEach((b, i) => {
      if (b.panicking) b.rally();
      b.teleportTo(back(BALANCE.FOLLOW_DISTANCE + Math.floor(i / 2) * 110, (i % 2 === 0 ? -1 : 1) * 70));
      b.orderFollow(c);
    });
    this.followKey = "";
    [...this.scouts, ...this.messengers].forEach((r, i) => {
      // Batedor em missão não anda com o exército
      if (!r.isAlive || (r instanceof Scout && r.onMission)) return;
      const p = back(-60 + i * 25, (i % 2 === 0 ? -1 : 1) * 50);
      r.x = p.x;
      r.y = p.y;
    });
    // As carroças vêm no fim da coluna
    this.wagons.forEach((w, i) => {
      if (!w.isAlive) return;
      const p = back(BALANCE.FOLLOW_DISTANCE + Math.ceil(alive.length / 2) * 110 + 90 + Math.floor(i / 2) * 70, (i % 2 === 0 ? -1 : 1) * 36);
      w.x = p.x;
      w.y = p.y;
    });
    this.cameras.main.centerOn(c.x, c.y);
    this.campArea.buildQuarters(useGameStore.getState(), this.awayBattalions());
  },

  /** Retrato para o Mapa do Continente: névoa, exército e bandos avistados (ou a última posição conhecida). */
  publishSnapshot(this: WorldScene, time: number): void {
    this.lastSnapshotAt = time;
    const day = useGameStore.getState().day;
    const warbands: WarbandSighting[] = [];
    for (const band of this.warbands.bands) {
      const seen = band.members.filter((m) => m.revealed);
      // As caravanas do bando mandam notícia de onde estão
      if (band.ownerId === "PLAYER") band.lastSeen = { x: band.anchor.x, y: band.anchor.y, day };
      if (seen.length > 0) {
        const c = centroid(seen);
        band.lastSeen = { x: c.x, y: c.y, day };
      }
      if (!band.lastSeen) continue;
      warbands.push({
        id: band.id,
        name: band.name,
        x: band.lastSeen.x,
        y: band.lastSeen.y,
        // Só se conta quem está à vista; da última vez, o que foi contado (ou a estimativa)
        count: seen.length > 0 ? seen.length : (band.reportedCount ?? bandSize(band)),
        visible: seen.length > 0,
        seenDay: band.lastSeen.day,
        heading: seen.length > 0 ? band.goalPoint : null,
        kind: band.kind,
        hostile: this.bandHostile(band),
        own: band.ownerId === "PLAYER",
      });
    }
    useGameStore.getState().setWorldSnapshot({
      cols: this.fog.gridCols,
      rows: this.fog.gridRows,
      cell: this.fog.cellSize,
      fog: this.fog.snapshot(),
      commander: { x: this.commander.x, y: this.commander.y },
      battalions: this.battalions.filter((b) => !b.isDestroyed).map((b) => b.center),
      warbands,
      messengersOut: this.messengers.filter((m) => m.isAlive && !m.available).length,
      scouts: this.scouts
        .filter((s) => s.isAlive)
        .map((s) => ({ id: s.rider.id, name: s.rider.name, ...(s.inContact ? { x: s.x, y: s.y } : s.lastContact), live: s.inContact, mode: s.mode })),
      day,
      calamityLairs: useGameStore
        .getState()
        .calamities.filter((c) => c.revealed && !c.defeated)
        .map((c) => ({ id: c.id, x: c.lair.x, y: c.lair.y, name: c.leader })),
      ships: this.trade.positions().filter((p) => this.fog.canSee(p)),
    });
  },

  /** Bandos e covis à vista: o primeiro avistamento vira notícia no diário. */
  noteSightings(this: WorldScene): void {
    const day = useGameStore.getState().day;
    for (const c of useGameStore.getState().calamities) {
      if (c.revealed || c.defeated || !this.fog.canSee(c.lair)) continue;
      useGameStore.getState().revealCalamity(c.id);
      useGameStore.getState().chronicle(`O covil de ${c.leader} foi encontrado em ${c.region}.`, "bad");
      this.pushFeed(`Encontramos o covil de ${c.leader}!`);
    }
    for (const band of this.warbands.bands) {
      const seen = band.members.filter((m) => m.revealed);
      if (seen.length === 0) continue;
      const c = centroid(seen);
      band.lastSeen = { x: c.x, y: c.y, day };
      if (band.spotted) continue;
      band.spotted = true;
      if (!isRaiderKind(band.kind)) {
        // Patrulhas, mensageiros e refugiados: só uma nota (não são ameaça)
        const what = band.kind === "REFUGEES" ? `${band.name} na estrada, fugindo` : `${band.name} passando`;
        this.pushFeed(`${what} perto de ${this.placeName(c)}.`);
        continue;
      }
      const text = `${band.name} avistado perto de ${this.placeName(c)} (cerca de ${bandSize(band)} combatentes).`;
      this.pushFeed(text);
      useGameStore.getState().chronicle(text, "bad");
    }
  },
};

export type SaveMethods = typeof saveMethods;
