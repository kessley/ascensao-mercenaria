import { Battalion } from "../../entities/Battalion";
import { Messenger, type MissionStop } from "../../entities/Messenger";
import { Unit } from "../../entities/Unit";
import { useGameStore, type TrumpetCall } from "../../../store/useGameStore";
import { BALANCE, COLORS, SUPPORT } from "../../../utils/constants";
import { sfx } from "../../../audio/sounds";
import { distance, type Point } from "../../../utils/math";
import { FEED_SIZE, type OrderRecipient, type OrderChannel, type Reach, type PendingDelivery, TRUMPET_LABEL } from "./shared";
import type { WorldScene } from "../WorldScene";

/**
 * O raio de comando, os sinais (voz, trombeta, estandarte) e os mensageiros.
 * Uma parte da `WorldScene`: os métodos entram no protótipo dela (ver o fim de `WorldScene.ts`).
 */
export const ordersMethods = {
  // --- Raio de comando e mensageiros ---

  /** Dois anéis pontilhados: alcance da voz (forte) e da trombeta (fraco). */
  drawCommandRing(this: WorldScene): void {
    const g = this.commandRing;
    g.clear();
    const ring = (r: number, alpha: number, dashes: number) => {
      g.lineStyle(2, COLORS.COMMAND_RING, alpha);
      for (let i = 0; i < dashes; i += 2) {
        g.beginPath();
        g.arc(0, 0, r, (i / dashes) * Math.PI * 2, ((i + 1) / dashes) * Math.PI * 2);
        g.strokePath();
      }
    };
    ring(SUPPORT.COMMAND_RADIUS, 0.28, 56);
    ring(SUPPORT.TRUMPET_RADIUS, 0.12, 120);
  },

  /** Onda que se expande a partir de quem sinaliza (trombeta, bandeira, grito de guerra). */
  signalWave(this: WorldScene, x: number, y: number, color: number, radius: number): void {
    // Redesenha o anel a cada quadro (escalar engrossaria a linha)
    const g = this.add.graphics({ x, y }).setDepth(13);
    const wave = { r: 20, a: 0.9 };
    this.tweens.add({
      targets: wave,
      r: radius,
      a: 0,
      duration: 700,
      ease: "Cubic.easeOut",
      onUpdate: () => {
        g.clear();
        g.lineStyle(3, color, wave.a);
        g.strokeCircle(0, 0, wave.r);
      },
      onComplete: () => g.destroy(),
    });
  },

  /** O batalhão enxerga o estandarte do Comandante? (alcance e sem floresta no caminho de nenhum dos dois) */
  seesBanner(this: WorldScene, p: Point): boolean {
    if (!this.commander.isAlive || this.commander.isInForest) return false;
    if ((Unit.terrain?.typeAt(p.x, p.y) ?? "GRASS") === "FOREST") return false;
    return distance(p, this.commander) <= SUPPORT.BANNER_RADIUS;
  },

  /** Por qual meio uma ordem deste tipo chega ao destinatário sem mensageiro (ou null). */
  reachOf(this: WorldScene, r: OrderRecipient, channel: OrderChannel): Reach | null {
    // Batalha personalizada com ordens diretas: todo o exército ouve
    if (this.run?.def.directOrders) return "VOICE";
    const p = this.recipientPosition(r);
    const d = distance(p, this.commander);
    if (d <= SUPPORT.COMMAND_RADIUS) return "VOICE";
    if ((channel === "BASIC" || channel === "BASIC_VISUAL") && d <= SUPPORT.TRUMPET_RADIUS) return "TRUMPET";
    if ((channel === "VISUAL" || channel === "BASIC_VISUAL") && this.seesBanner(p)) return "BANNER";
    return null;
  },

  recipientPosition(this: WorldScene, r: OrderRecipient): Point {
    return r instanceof Battalion ? r.center : { x: r.x, y: r.y };
  },

  recipientName(this: WorldScene, r: OrderRecipient): string {
    return r instanceof Battalion ? r.name : `batedor ${r.rider.name}`;
  },

  /** Dentro do alcance da voz qualquer ordem é instantânea. */
  inCommand(this: WorldScene, r: OrderRecipient): boolean {
    return !!this.run?.def.directOrders || distance(this.recipientPosition(r), this.commander) <= SUPPORT.COMMAND_RADIUS;
  },

  /** Toque de trombeta: onda visual + a melodia daquela ordem (uma vez por ordem em grupo). */
  trumpetFx(this: WorldScene, order: string): void {
    if (this.time.now - this.lastTrumpetFx < 300) return;
    this.lastTrumpetFx = this.time.now;
    this.signalWave(this.commander.x, this.commander.y, COLORS.PENNANT, 260);
    sfx.trumpet(order, this.commander);
  },

  bannerFx(this: WorldScene): void {
    if (this.time.now - this.lastBannerFx < 300) return;
    this.lastBannerFx = this.time.now;
    this.signalWave(this.commander.x, this.commander.y, COLORS.LIEUTENANT, 160);
    this.commander.floatText("⚑ sinal", "#dfe3ee");
    sfx.banner(this.commander);
  },

  /**
   * Grito de guerra: o nome do bando ecoa. Batalhões próximos ganham moral;
   * os em pânico bem perto do Comandante se reagrupam. Recarga de 30 s.
   */
  warCry(this: WorldScene): void {
    const W = SUPPORT.WAR_CRY;
    if (this.ended || !this.commander.isAlive || this.time.now - this.warCryAt < W.COOLDOWN_MS) return;
    this.warCryAt = this.time.now;
    this.signalWave(this.commander.x, this.commander.y, COLORS.PANIC, W.RADIUS);
    this.commander.floatText("Pela Ascensão!", "#ffb4a8");
    sfx.warCry(this.commander);
    const heard: string[] = [];
    for (const b of this.battalions) {
      if (b.isDestroyed) continue;
      const d = distance(b.center, this.commander);
      if (d > W.RADIUS) continue;
      b.morale = Math.min(BALANCE.MORALE.MAX, b.morale + W.MORALE);
      if (b.panicking && d <= W.RALLY_RADIUS) b.rally();
      heard.push(b.name);
    }
    this.pushFeed(heard.length ? `Grito de guerra! ${heard.join(", ")} recobram o ânimo.` : "Grito de guerra! Ninguém perto o bastante para ouvir.");
    this.publishHud();
  },

  /** Toques de trombeta pré-combinados, para os selecionados (ou todos). */
  trumpetCall(this: WorldScene, call: TrumpetCall, targets: readonly Battalion[]): void {
    // O trombeteiro do Comandante sempre toca (mesmo que todos estejam ao alcance da voz)
    this.trumpetFx(TRUMPET_LABEL[call]);
    this.withOrderBatch(() => this.soundTrumpetCall(call, targets));
  },

  soundTrumpetCall(this: WorldScene, call: TrumpetCall, targets: readonly Battalion[]): void {
    const label = TRUMPET_LABEL[call];
    for (const b of targets) {
      if (b.isDestroyed) continue;
      const apply = (): void => {
        switch (call) {
          case "ADVANCE": {
            const p = { x: b.center.x + Math.cos(b.facing) * SUPPORT.ADVANCE_DISTANCE, y: b.center.y + Math.sin(b.facing) * SUPPORT.ADVANCE_DISTANCE };
            b.orderMove(p, b.facing);
            break;
          }
          case "HALT":
            b.holdPosition();
            break;
          case "CHARGE":
            b.orderCharge(this.visibleEnemies());
            break;
          case "RETREAT": {
            const c = this.commander;
            b.orderMove({ x: c.x - Math.cos(c.facing) * 120, y: c.y - Math.sin(c.facing) * 120 }, c.facing, { run: true });
            break;
          }
          case "RALLY":
            b.orderFollow(this.commander);
            break;
        }
      };
      this.dispatch(b, label, apply, call === "RALLY" ? "BASIC_VISUAL" : "BASIC");
    }
  },

  /**
   * Envia uma ordem pelo meio que a época permitiria:
   * - VOZ (raio de comando): qualquer ordem, na hora;
   * - TROMBETA: só toques básicos combinados (Avançar, Alto, Carregar, Recuar, Reunir);
   *   no meio do corpo a corpo o batalhão pode não ouvir;
   * - ESTANDARTE/BANDEIRAS: sinais visuais (formações, seguir), com linha de visão;
   * - MENSAGEIRO: ordens complexas (ponto, alvo, foco, arranjo) ou quando nada mais alcança.
   *   Ele cavalga até ficar ao alcance do próprio sinal — não precisa encostar na tropa.
   */
  dispatch(this: WorldScene, recipient: OrderRecipient, order: string, apply: () => void, channel: OrderChannel = "COMPLEX", direct = true): boolean {
    // Ordem direta a um batalhão de companhia (Marco 20): por um tempo, vale mais que a do capitão
    if (direct && recipient instanceof Battalion) {
      const inner = apply;
      apply = () => {
        inner();
        this.companies.playerOrdered(recipient, this.time.now);
      };
    }
    const name = this.recipientName(recipient);
    const reach = this.reachOf(recipient, channel);
    // Batalhão destacado muito longe: a harpia leva a ordem ao batedor que está perto dele
    const relay = !reach && recipient instanceof Battalion ? this.relayFor(recipient) : null;
    if (relay && recipient instanceof Battalion) {
      recipient.pendingOrder = order;
      relay.orders.push({
        label: order,
        relay: {
          to: () => (recipient.isDestroyed ? null : recipient.center),
          apply: () => {
            recipient.pendingOrder = null;
            apply();
            this.pushFeed(`${relay.scout.rider.name} levou "${order}" a ${name}.`);
          },
        },
      });
      this.pushFeed(`"${order}" para ${name} vai na harpia de ${relay.scout.rider.name}.`);
      return true;
    }
    if (reach === "VOICE") {
      apply();
      return true;
    }
    if (reach === "TRUMPET") {
      this.trumpetFx(order);
      if (recipient instanceof Battalion && recipient.status === "ENGAGED" && Math.random() < SUPPORT.TRUMPET_MISS_IN_MELEE) {
        this.pushFeed(`${name} não ouviu o toque "${order}" no meio do combate.`);
        return false;
      }
      apply();
      this.pushFeed(`Trombeta: "${order}" — ${name} obedece.`);
      return true;
    }
    if (reach === "BANNER") {
      this.bannerFx();
      apply();
      this.pushFeed(`Bandeiras: "${order}" — ${name} viu o sinal.`);
      return true;
    }

    // Precisa de mensageiro: numa ordem em grupo, entra no lote (um mensageiro por grupo próximo)
    if (recipient instanceof Battalion) recipient.pendingOrder = order;
    const stop = this.missionStop(recipient, apply);
    if (this.pendingBatch) {
      this.pendingBatch.push({ order, stop, recipient });
      return true;
    }
    return this.sendMessengers(order, [{ order, stop, recipient }]);
  },

  /** Destinatário de uma missão: na entrega, a autoridade do mensageiro age antes da ordem. */
  missionStop(this: WorldScene, recipient: OrderRecipient, apply: () => void): MissionStop {
    return {
      recipient: this.recipientName(recipient),
      position: () => this.recipientPosition(recipient),
      gone: () => (recipient instanceof Battalion ? recipient.isDestroyed : !recipient.isAlive),
      deliver: (m) => {
        if (recipient instanceof Battalion) {
          recipient.pendingOrder = null;
          if (recipient.panicking && m.canRally) {
            recipient.rally();
            this.pushFeed(`${m.rider.name} reagrupou ${recipient.name} em pânico!`);
          }
          recipient.morale = Math.min(BALANCE.MORALE.MAX, recipient.morale + m.authority);
        }
        apply();
      },
    };
  },

  /**
   * Executa `fn` agrupando as entregas por mensageiro: uma ordem dada a vários batalhões
   * sai com UM mensageiro para cada grupo de batalhões próximos (não um por batalhão).
   */
  withOrderBatch<T>(this: WorldScene, fn: () => T): T {
    if (this.pendingBatch) return fn(); // já dentro de um lote
    this.pendingBatch = [];
    try {
      return fn();
    } finally {
      const batch = this.pendingBatch;
      this.pendingBatch = null;
      const byOrder = new Map<string, PendingDelivery[]>();
      for (const p of batch) byOrder.set(p.order, [...(byOrder.get(p.order) ?? []), p]);
      for (const [order, deliveries] of byOrder) this.sendMessengers(order, deliveries);
    }
  },

  /**
   * Agrupa os destinatários por proximidade e manda um mensageiro por grupo.
   * Faltando mensageiros, os grupos que sobram entram na rota de quem já está saindo
   * com essa ordem; sem nenhum mensageiro livre, a ordem não sai.
   */
  sendMessengers(this: WorldScene, order: string, deliveries: PendingDelivery[]): boolean {
    deliveries = this.relayThroughCaptains(order, deliveries);
    const groups: PendingDelivery[][] = [];
    for (const d of deliveries) {
      const p = d.stop.position();
      const group = groups.find((g) => g.some((x) => distance(x.stop.position(), p) <= SUPPORT.MESSENGER.GROUP_RADIUS));
      if (group) group.push(d);
      else groups.push([d]);
    }

    const used: Messenger[] = [];
    let sent = false;
    for (const group of groups) {
      const names = group.map((d) => d.stop.recipient).join(", ");
      const messenger = this.messengers.find((m) => m.available);
      if (messenger) {
        messenger.send({ order, stops: group.map((d) => d.stop) });
        used.push(messenger);
        sent = true;
        this.pushFeed(`${messenger.rider.name} partiu com "${order}" para ${names}.`);
      } else if (used.length > 0) {
        const carrier = used[used.length - 1];
        carrier.addStops(group.map((d) => d.stop));
        sent = true;
        this.pushFeed(`Sem outro mensageiro: ${carrier.rider.name} também levará "${order}" a ${names}.`);
      } else {
        for (const d of group) {
          if (d.recipient instanceof Battalion) d.recipient.pendingOrder = null;
          for (const b of this.relayStops.get(d.stop) ?? []) b.pendingOrder = null;
        }
        this.pushFeed(`Sem mensageiro livre: "${order}" não chegou a ${names}.`);
      }
    }
    return sent;
  },

  /**
   * Marco 20: ordens para dois ou mais batalhões da mesma companhia, perto do capitão, viram
   * UMA parada do mensageiro, no capitão, que passa a ordem adiante na hora. É a vantagem de delegar.
   */
  relayThroughCaptains(this: WorldScene, order: string, deliveries: PendingDelivery[]): PendingDelivery[] {
    const byCompany = new Map<string, { lead: { id: string; name: string; at: () => Point }; list: PendingDelivery[] }>();
    const out: PendingDelivery[] = [];
    for (const d of deliveries) {
      const lead = d.recipient instanceof Battalion ? this.companies.leaderFor(d.recipient, this.battalions) : null;
      if (!lead) {
        out.push(d);
        continue;
      }
      const entry = byCompany.get(lead.id) ?? { lead, list: [] };
      entry.list.push(d);
      byCompany.set(lead.id, entry);
    }
    for (const { lead, list } of byCompany.values()) {
      if (list.length < 2) {
        out.push(...list);
        continue;
      }
      const names = list.map((d) => d.stop.recipient).join(", ");
      const covered = list.flatMap((d) => (d.recipient instanceof Battalion ? [d.recipient] : []));
      const stop: MissionStop = {
        recipient: `companhia de ${lead.name}`,
        position: lead.at,
        gone: () => list.every((d) => d.stop.gone()),
        deliver: (m) => {
          for (const d of list) if (!d.stop.gone()) d.stop.deliver(m);
          this.pushFeed(`⚑ ${lead.name} passou "${order}" a ${names}.`);
        },
      };
      this.relayStops.set(stop, covered);
      out.push({ order, stop, recipient: list[0].recipient });
    }
    return out;
  },

  updateMessengers(this: WorldScene, dt: number): void {
    for (const m of this.messengers) {
      const event = m.think(dt, this.commander);
      if (event?.type === "DELIVERED") {
        // O mensageiro sinaliza de longe: trombeta e bandeira até onde a tropa vê e ouve
        this.signalWave(event.at.x, event.at.y, COLORS.PENNANT, m.signalRange);
        sfx.messengerHorn(event.at);
        const more = event.remaining > 0 ? ` Segue para mais ${event.remaining}.` : "";
        this.pushFeed(`${m.rider.name} sinalizou "${event.order}" a ${event.recipients.join(" e ")}.${more}`);
      }
      if (event?.type === "ABORTED") this.pushFeed(`${m.rider.name} voltou: os destinatários de "${event.order}" não existem mais.`);
    }
  },

  /** Registra batedores e mensageiros abatidos (ordens em mãos se perdem). */
  collectSupportLosses(this: WorldScene): void {
    for (const m of this.messengers) {
      if (m.isAlive || this.deadMessengerIds.includes(m.rider.id)) continue;
      this.deadMessengerIds.push(m.rider.id);
      if (m.mission) {
        const names = m.mission.stops.map((s) => s.recipient);
        this.pushFeed(`${m.rider.name} foi interceptado! A ordem "${m.mission.order}" para ${names.join(", ")} se perdeu.`);
        for (const b of this.battalions) if (names.includes(b.name)) b.pendingOrder = null;
        for (const s of m.mission.stops) for (const b of this.relayStops.get(s) ?? []) b.pendingOrder = null;
        m.mission = null;
      } else {
        this.pushFeed(`O mensageiro ${m.rider.name} caiu.`);
      }
    }
    for (const s of this.scouts) {
      if (s.isAlive || this.deadScoutIds.includes(s.rider.id)) continue;
      this.deadScoutIds.push(s.rider.id);
      this.pushFeed(`O batedor ${s.rider.name} foi abatido.`);
      // Longe de qualquer combate, a notícia entra direto (no combate, vai no relatório)
      if (!this.engagement) {
        this.reportedDead.add(s.rider.id);
        useGameStore.getState().scoutLost(s.rider.id);
      }
    }
  },

  /** Linha pontilhada de cada mensageiro em missão até cada destinatário que falta. */
  drawMissions(this: WorldScene): void {
    const g = this.missionGfx;
    g.clear();
    for (const m of this.messengers) {
      if (!m.isAlive || m.riderState !== "OUTBOUND" || !m.mission) continue;
      const current = m.currentStop();
      for (const stop of m.mission.stops) {
        const p = stop.position();
        const d = distance(m, p);
        const steps = Math.floor(d / 18);
        // Destino atual em destaque; os seguintes, mais fracos
        g.fillStyle(COLORS.PENNANT, stop === current ? 0.8 : 0.35);
        for (let i = 1; i < steps; i++) {
          const t = i / steps;
          g.fillCircle(m.x + (p.x - m.x) * t, m.y + (p.y - m.y) * t, 2);
        }
      }
    }
  },

  pushFeed(this: WorldScene, line: string): void {
    this.feed = [...this.feed, line].slice(-FEED_SIZE);
  },
};

export type OrdersMethods = typeof ordersMethods;
