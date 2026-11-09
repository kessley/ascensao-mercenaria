import Phaser from "phaser";
import { Battalion } from "../../entities/Battalion";
import { Scout } from "../../entities/Scout";
import { Unit } from "../../entities/Unit";
import { lodOf } from "../../art/atlas";
import { layoutGroup, planLine, type LinePlan } from "../../systems/GroupLayout";
import { formationOffset } from "../../systems/formation";
import { setTimeRate, timeRate } from "../../gameClock";
import { STANCE_LABEL } from "../../sim/companies";
import { useGameStore, type BattleCommand } from "../../../store/useGameStore";
import { BALANCE, CAMERA, COLORS, COMBAT, FORMATIONS } from "../../../utils/constants";
import { angleTo, centroid, distance, nearest, type Point } from "../../../utils/math";
import { type BattleKeys, FORMATION_KEYS, COMBAT_RUN_COLOR, DRAG_THRESHOLD, isShiftHeld } from "./shared";
import type { WorldScene } from "../WorldScene";

/**
 * A entrada: teclado, mouse, as ordens da interface, a seleção e a câmera.
 * Uma parte da `WorldScene`: os métodos entram no protótipo dela (ver o fim de `WorldScene.ts`).
 */
export const inputMethods = {
  // --- Câmera ---

  /** Presa: segue o Comandante. Solta: fica onde está e rola com setas, borda da tela ou botão do meio. */
  setCameraLocked(this: WorldScene, locked: boolean): void {
    if (this.cameraLocked === locked) return;
    this.cameraLocked = locked;
    const cam = this.cameras.main;
    if (locked) cam.startFollow(this.commander, true, 0.1, 0.1);
    else cam.stopFollow();
    this.publishHud();
  },

  /** Leva a visão até o Comandante sem prender a câmera. */
  centerOnCommander(this: WorldScene): void {
    this.cameras.main.centerOn(this.commander.x, this.commander.y);
  },

  updateFreeCamera(this: WorldScene, dt: number): void {
    if (this.cameraLocked || this.panDrag) return;
    const cam = this.cameras.main;
    const k = this.keys;
    let vx = (k.RIGHT.isDown ? 1 : 0) - (k.LEFT.isDown ? 1 : 0);
    let vy = (k.DOWN.isDown ? 1 : 0) - (k.UP.isDown ? 1 : 0);

    // Mouse encostado na borda da tela rola a visão (só com o mouse de fato dentro do jogo)
    const p = this.input.activePointer;
    if (this.pointerInGame) {
      if (p.x <= CAMERA.EDGE_PX) vx -= 1;
      else if (p.x >= this.scale.width - CAMERA.EDGE_PX) vx += 1;
      if (p.y <= CAMERA.EDGE_PX) vy -= 1;
      else if (p.y >= this.scale.height - CAMERA.EDGE_PX) vy += 1;
    }
    if (vx === 0 && vy === 0) return;
    const speed = (CAMERA.PAN_SPEED / cam.zoom) * dt;
    cam.setScroll(cam.scrollX + Math.sign(vx) * speed, cam.scrollY + Math.sign(vy) * speed);
  },

  // --- Entrada ---

  setupInput(this: WorldScene): void {
    const keyboard = this.input.keyboard;
    if (!keyboard) throw new Error("Teclado indisponível");
    this.keys = keyboard.addKeys("W,A,S,D,SPACE,SHIFT,F,Q,ESC,ONE,TWO,THREE,FOUR,C,H,UP,DOWN,LEFT,RIGHT,R,E,TAB,T,V,G,P,X,Z,B,N,J,L") as BattleKeys;
    // No duelo (Marco 21), Espaço é o golpe leve; fora dele, o golpe do Comandante é lido a cada quadro
    this.keys.SPACE.on("down", () => {
      if (this.inDuel()) this.duelPress("light");
    });

    // V: marcha forçada; G: forragear (Marco 13)
    this.keys.V.on("down", () => {
      if (!this.ended && !this.inDuel()) this.setForced(!this.forced);
    });
    this.keys.G.on("down", () => {
      if (!this.ended && !this.inDuel()) this.forage();
    });
    // P: pausa tática; X: selecionados correm ou voltam ao passo; Ctrl+A: seleciona todo o exército
    this.keys.P.on("down", () => {
      if (!this.ended) this.setTacticalPause(!this.tacticalPause);
    });
    this.keys.X.on("down", () => {
      if (!this.ended && !this.inDuel()) this.toggleRun();
    });
    this.keys.Z.on("down", () => this.startSlowMotion());
    // J: diário de missões
    this.keys.J.on("down", () => {
      const store = useGameStore.getState();
      if (this.run || store.worldMapOpen || store.interior || this.inDuel()) return;
      store.setCampPanel(store.campPanel?.kind === "MISSIONS" ? null : { kind: "MISSIONS" });
    });
    // B: cessar fogo; N: investida em ciclo
    this.keys.B.on("down", () => {
      if (!this.ended && !this.inDuel()) this.toggleHoldFire();
    });
    this.keys.N.on("down", () => {
      if (!this.ended && !this.inDuel()) this.toggleCycle();
    });
    keyboard.on("keydown-A", (e: KeyboardEvent) => {
      if (!e.ctrlKey || this.ended || this.inDuel()) return;
      e.preventDefault();
      this.select(this.battalions.filter((b) => !b.isDestroyed), [], false);
      this.publishHud();
    });

    // E: interagir com o local mais próximo (tenda, alojamento, mercado de uma cidade...);
    // estruturas com lado de dentro (Marco 14): entrar
    this.keys.E.on("down", () => {
      if (this.inDuel()) return this.duelPress("shove");
      const store = useGameStore.getState();
      if (store.worldMapOpen || store.battleReport || store.interior) return;
      if (store.campPanel) store.setCampPanel(null);
      else if (this.nearestSpot?.enter) this.enterBuilding(this.nearestSpot);
      else if (this.nearestSpot) store.setCampPanel(this.nearestSpot.panel);
    });
    // Tab: Mapa do Continente (viagem rápida e observação de exércitos)
    this.keys.TAB.on("down", (e: Phaser.Input.Keyboard.Key) => {
      const store = useGameStore.getState();
      if (store.battleReport || this.run || this.inDuel()) return;
      store.setCampPanel(null);
      // Shift+Tab: o Mapa Múndi, com os outros continentes (Marco 17)
      if (e.shiftKey) {
        store.setWorldMapOpen(false);
        store.setAtlasOpen(!store.atlasOpen);
      } else {
        store.setAtlasOpen(false);
        store.setWorldMapOpen(!store.worldMapOpen);
      }
    });

    // L: Livro do Bando (Marco 18)
    this.keys.L.on("down", () => {
      const store = useGameStore.getState();
      if (this.run || store.voyage || store.battleReport || this.inDuel()) return;
      store.setCampPanel(store.campPanel?.kind === "SAGA" ? null : { kind: "SAGA" });
    });

    // T: acender ou apagar as tochas do bando
    this.keys.T.on("down", () => {
      if (!this.ended && !this.inDuel()) this.setTorches(!this.torches);
    });

    this.input.mouse?.disableContextMenu();
    this.selectionBox = this.add.graphics().setDepth(20);
    this.linePreview = this.add.graphics().setDepth(19);
    this.destinationGfx = this.add.graphics().setDepth(-4);
    this.lineLabel = this.add
      .text(0, 0, "", { fontFamily: "monospace", fontSize: "13px", color: "#ffffff", stroke: "#000000", strokeThickness: 3 })
      .setOrigin(0.5, 1)
      .setDepth(21)
      .setVisible(false);

    // --- Câmera: C prende/solta, H centraliza, roda = zoom, botão do meio arrasta ---
    // No duelo, a câmera é dos dois
    this.keys.C.on("down", () => {
      if (!this.inDuel()) this.setCameraLocked(!this.cameraLocked);
    });
    this.keys.H.on("down", () => {
      if (!this.inDuel()) this.centerOnCommander();
    });
    this.input.on("wheel", (_p: Phaser.Input.Pointer, _o: unknown, _dx: number, dy: number) => {
      if (this.inDuel()) return;
      // Pixel art só fica firme em degraus inteiros: a roda pula de um degrau para o vizinho
      const cam = this.cameras.main;
      const steps = CAMERA.ZOOM_STEPS;
      let at = 0;
      for (let i = 1; i < steps.length; i++) if (Math.abs(steps[i] - cam.zoom) < Math.abs(steps[at] - cam.zoom)) at = i;
      const zoom = steps[Phaser.Math.Clamp(at - Math.sign(dy), 0, steps.length - 1)];
      cam.setZoom(zoom);
      Unit.setLod(lodOf(zoom));
      this.publishHud();
    });

    this.input.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
      if (this.ended) return;
      // No duelo: clique é o golpe leve, o botão direito, o pesado
      if (this.inDuel()) {
        if (pointer.rightButtonDown()) this.duelPress("heavy");
        else if (pointer.leftButtonDown()) this.duelPress("light");
        return;
      }
      useGameStore.getState().setContextMenu(null);
      // Modo construção (Marco 22): o clique põe a peça; o botão direito desiste
      if (useGameStore.getState().campBuild && !pointer.middleButtonDown()) {
        if (pointer.rightButtonDown()) useGameStore.getState().setCampBuild(null);
        else if (pointer.leftButtonDown()) this.placeCampBuild(pointer, isShiftHeld(pointer));
        return;
      }

      if (pointer.middleButtonDown()) {
        // Arrastar a visão solta a câmera
        this.setCameraLocked(false);
        const cam = this.cameras.main;
        this.panDrag = { x: pointer.x, y: pointer.y, scrollX: cam.scrollX, scrollY: cam.scrollY };
      } else if (pointer.rightButtonDown()) {
        // Só ao soltar se sabe se foi clique ou linha de batalha
        const run = performance.now() - this.lastRightClickAt < COMBAT.DOUBLE_CLICK_MS;
        this.lineDrag = { from: { x: pointer.worldX, y: pointer.worldY }, screen: { x: pointer.x, y: pointer.y }, run, active: false };
      } else if (pointer.leftButtonDown()) {
        this.dragStart = { x: pointer.worldX, y: pointer.worldY };
      }
    });

    this.input.on("gameout", () => {
      this.pointerInGame = false;
    });
    this.input.on("pointermove", (pointer: Phaser.Input.Pointer) => {
      this.pointerInGame = true;
      if (this.panDrag && pointer.middleButtonDown()) {
        const cam = this.cameras.main;
        cam.setScroll(
          this.panDrag.scrollX - (pointer.x - this.panDrag.x) / cam.zoom,
          this.panDrag.scrollY - (pointer.y - this.panDrag.y) / cam.zoom,
        );
        return;
      }
      if (this.lineDrag && pointer.rightButtonDown()) {
        const drag = this.lineDrag;
        drag.active ||= this.lineGroup().length > 0 && Math.hypot(pointer.x - drag.screen.x, pointer.y - drag.screen.y) >= COMBAT.LINE_DRAG_MIN;
        if (drag.active) {
          this.lineEnd = { x: pointer.worldX, y: pointer.worldY };
          this.drawLinePreview(drag, this.lineEnd);
        }
        return;
      }
      if (!this.dragStart || !pointer.leftButtonDown()) return;
      this.drawSelectionBox(this.selectionRect(pointer));
    });

    // Soltar o botão em cima do HUD conta como soltar no último ponto do campo
    this.input.on("pointerupoutside", (pointer: Phaser.Input.Pointer) => {
      if (pointer.button === 2) this.releaseRight(pointer);
    });

    this.input.on("pointerup", (pointer: Phaser.Input.Pointer) => {
      if (pointer.button === 1) this.panDrag = null;
      if (pointer.button === 2) return this.releaseRight(pointer);
      if (!this.dragStart || pointer.button !== 0) return;
      const rect = this.selectionRect(pointer);
      const additive = isShiftHeld(pointer);
      this.dragStart = null;
      this.selectionBox.clear();
      if (this.ended) return;

      if (rect.width < DRAG_THRESHOLD && rect.height < DRAG_THRESHOLD) {
        const scout = this.scoutAt(pointer.worldX, pointer.worldY);
        const hit = scout ? null : this.battalionAt(pointer.worldX, pointer.worldY);
        const point = { x: pointer.worldX, y: pointer.worldY };
        // Clique num local (tenda, alojamento, praça de uma cidade): o Comandante vai até lá e abre
        const spot = scout || hit ? null : this.spots().find((it) => it.bounds.contains(point.x, point.y));
        if (spot || (!scout && !hit && this.inCamp && this.campArea.contains(point))) {
          this.walkTo(spot ?? null, point);
          if (!additive) this.select([], [], false);
        } else if (additive && (scout || hit)) {
          if (scout) scout.selected = !scout.selected;
          if (hit) hit.selected = !hit.selected;
        } else {
          this.select(hit ? [hit] : [], scout ? [scout] : [], additive);
        }
      } else {
        this.select(
          this.battalions.filter((b) => b.intersectsRect(rect)),
          this.scouts.filter((s) => s.isAlive && rect.contains(s.x, s.y)),
          additive,
        );
      }
      this.publishHud();
    });

    this.keys.F.on("down", () => {
      if (this.inDuel()) return this.duelPress("dodge");
      if (this.ended) return;
      this.withOrderBatch(() => {
        for (const b of this.commandTargets()) this.dispatch(b, "Reunir ao estandarte", () => b.orderFollow(this.commander), "BASIC_VISUAL");
      });
    });

    this.keys.Q.on("down", () => {
      if (this.inDuel()) return this.duelPress("heavy");
      if (this.ended) return;
      const near = this.battalions.filter(
        (b) => !b.isDestroyed && distance(b.center, this.commander) <= BALANCE.NEARBY_SELECT_RADIUS,
      );
      this.select(near, [], false);
      this.publishHud();
    });

    this.keys.ESC.on("down", () => {
      // Soltar a linha de batalha sem dar a ordem
      if (this.lineDrag) return this.cancelLine();
      const store = useGameStore.getState();
      if (store.campBuild) return store.setCampBuild(null);
      // Batalha personalizada: com nada selecionado, Esc abre (ou fecha) a pausa
      if (this.run && !store.scenarioResult && (store.scenarioPaused || !this.battalions.some((b) => b.selected))) {
        store.setScenarioPaused(!store.scenarioPaused);
        return;
      }
      if (store.worldMapOpen) store.setWorldMapOpen(false);
      if (store.campPanel) store.setCampPanel(null);
      store.setContextMenu(null);
      this.select([], [], false);
      this.publishHud();
    });

    this.keys.R.on("down", () => {
      if (!this.inDuel()) this.warCry();
    });

    // 1–4: formação dos selecionados (cada tipo de tropa ignora as que não sabe fazer)
    for (const [key, formation] of FORMATION_KEYS) {
      this.keys[key].on("down", () => {
        if (this.ended || this.inDuel()) return;
        this.withOrderBatch(() => {
          for (const b of this.commandTargets()) {
            if (b.canUseFormation(formation)) {
              this.dispatch(b, `Formação: ${FORMATIONS[formation].label}`, () => b.setFormation(formation), "VISUAL");
            }
          }
        });
        this.publishHud();
      });
    }
  },

  /** Quem entra numa linha de batalha riscada agora. */
  lineGroup(this: WorldScene): Battalion[] {
    return this.battalions.filter((b) => b.selected && !b.isDestroyed && !b.panicking);
  },

  linePlan(this: WorldScene, drag: { from: Point }, to: Point): LinePlan[] {
    return planLine(this.lineGroup(), drag.from, to, useGameStore.getState().groupArrangement);
  },

  /** Botão direito solto: linha de batalha, se arrastou; clique, se não. */
  releaseRight(this: WorldScene, pointer: Phaser.Input.Pointer): void {
    const drag = this.lineDrag;
    const to = this.lineEnd;
    this.cancelLine();
    if (!drag || this.ended) return;
    if (drag.active) {
      this.withOrderBatch(() => this.commitLine(drag, to ?? { x: pointer.worldX, y: pointer.worldY }, pointer));
    } else if (pointer.event.target === this.sys.game.canvas) {
      this.lastRightClickAt = performance.now();
      this.withOrderBatch(() => this.handleRightClick(pointer, drag.run));
    }
    this.publishHud();
  },

  cancelLine(this: WorldScene): void {
    this.lineDrag = null;
    this.lineEnd = null;
    this.linePreview.clear();
    this.lineLabel.setVisible(false);
  },

  /** Mostra, antes de soltar o botão, onde cada soldado vai ficar e para onde vai olhar. */
  drawLinePreview(this: WorldScene, drag: { from: Point; run: boolean }, to: Point): void {
    const plans = this.linePlan(drag, to);
    const g = this.linePreview;
    g.clear();
    const color = drag.run ? COMBAT_RUN_COLOR : COLORS.ORDER_MOVE;
    g.lineStyle(2, color, 0.5);
    g.lineBetween(drag.from.x, drag.from.y, to.x, to.y);
    for (const p of plans) {
      const b = p.battalion;
      const count = b.soldiers.length;
      const fx = Math.cos(p.facing);
      const fy = Math.sin(p.facing);
      for (let i = 0; i < count; i++) {
        const o = formationOffset(b.formation, i, count, p.width);
        const x = p.point.x + fx * o.depth - fy * o.lateral;
        const y = p.point.y + fy * o.depth + fx * o.lateral;
        const blocked = !!Unit.terrain?.isBlocked(x, y);
        g.fillStyle(blocked ? COLORS.ORDER_ATTACK : color, 0.55);
        g.fillCircle(x, y, b.soldiers[i]?.radius ?? 9);
      }
      // Seta da frente de cada batalhão
      const tip = { x: p.point.x + fx * 44, y: p.point.y + fy * 44 };
      g.lineStyle(3, color, 0.95);
      g.lineBetween(p.point.x + fx * 16, p.point.y + fy * 16, tip.x, tip.y);
      g.fillStyle(color, 0.95);
      g.fillTriangle(tip.x + fx * 12, tip.y + fy * 12, tip.x - fy * 8, tip.y + fx * 8, tip.x + fy * 8, tip.y - fx * 8);
      const c = b.center;
      g.lineStyle(1, color, 0.25);
      g.lineBetween(c.x, c.y, p.point.x, p.point.y);
    }
    const front = plans.filter((p) => p.row === 0).reduce((n, p) => n + p.width, 0);
    const ranks = Math.max(...plans.map((p) => Math.ceil(p.battalion.soldiers.length / p.width)));
    const rankText = `${ranks} fileira${ranks > 1 ? "s" : ""}`;
    this.lineLabel.setText(`${front} de frente · ${rankText}${drag.run ? " · correndo" : ""}`).setPosition((drag.from.x + to.x) / 2, Math.min(drag.from.y, to.y) - 16).setVisible(true);
  },

  /** Soltou o botão: cada batalhão vai para o lugar que a prévia mostrou. */
  commitLine(this: WorldScene, drag: { from: Point; run: boolean }, to: Point, pointer: Phaser.Input.Pointer): void {
    const mid = { x: (drag.from.x + to.x) / 2, y: (drag.from.y + to.y) / 2 };
    // Povoado que barra o exército: vale a regra do clique (esperar no portão)
    if (this.closedRule("ARMY", mid)) return this.handleRightClick(pointer, drag.run);
    let accepted = false;
    for (const { battalion, point, facing, width } of this.linePlan(drag, to)) {
      accepted = this.dispatch(battalion, "Posicionar", () => battalion.orderMove(point, facing, { width, run: drag.run })) || accepted;
    }
    for (const s of this.scouts) if (s.selected && s.isAlive) accepted = this.orderScout(s, { kind: "WATCH", point: mid }) || accepted;
    if (accepted) this.showOrderMarker(mid.x, mid.y, COLORS.ORDER_MOVE);
  },

  /** Linha até o destino de quem está selecionado e marchando. */
  drawDestinations(this: WorldScene): void {
    const g = this.destinationGfx;
    g.clear();
    for (const b of this.battalions) {
      if (!b.selected || b.isDestroyed || b.order.type !== "MOVE") continue;
      const p = b.order.point;
      const half = b.frontWidth() / 2;
      const nx = -Math.sin(b.facing);
      const ny = Math.cos(b.facing);
      const c = b.center;
      const color = b.running ? COMBAT_RUN_COLOR : COLORS.ORDER_MOVE;
      g.lineStyle(1, color, 0.35);
      g.lineBetween(c.x, c.y, p.x, p.y);
      g.lineStyle(3, color, 0.6);
      g.lineBetween(p.x - nx * half, p.y - ny * half, p.x + nx * half, p.y + ny * half);
    }
  },

  /** Para o mundo para pensar; dá para selecionar, mover a câmera e dar ordens. */
  setTacticalPause(this: WorldScene, on: boolean): void {
    this.tacticalPause = on;
    if (on) this.tweens.pauseAll();
    else this.tweens.resumeAll();
    this.time.paused = on;
    this.publishHud();
  },

  /** Câmera lenta: alguns segundos para decidir, depois uma espera até poder usar de novo. */
  startSlowMotion(this: WorldScene): void {
    if (this.ended || this.tacticalPause || this.inDuel() || this.slowLeft > 0 || this.slowWait > 0) return;
    this.slowLeft = COMBAT.SLOW_MS;
    this.setRate(COMBAT.SLOW_RATE);
    this.publishHud();
  },

  /** Conta em tempo de verdade: `delta` já vem no ritmo da câmera lenta. */
  updateSlowMotion(this: WorldScene, delta: number): void {
    const real = delta / timeRate();
    if (this.slowLeft > 0) {
      this.slowLeft -= real;
      if (this.slowLeft > 0) return;
      this.slowLeft = 0;
      this.slowWait = COMBAT.SLOW_WAIT_MS;
      this.setRate(1);
    } else if (this.slowWait > 0) {
      this.slowWait = Math.max(0, this.slowWait - real);
    }
  },

  /** Saiu do campo (prédio, duelo): o tempo volta ao normal para as outras cenas. */
  stopSlowMotion(this: WorldScene): void {
    this.slowLeft = 0;
    this.setRate(1);
  },

  /** As animações têm relógio próprio: precisam ser avisadas do ritmo. */
  setRate(this: WorldScene, rate: number): void {
    setTimeRate(rate);
    this.tweens.timeScale = rate;
  },

  /** Quem atira segura o tiro (ou volta a atirar). */
  toggleHoldFire(this: WorldScene): void {
    const group = this.commandTargets().filter((b) => !b.isDestroyed && b.ammoLeft !== null);
    if (group.length === 0) return;
    const hold = !group.every((b) => b.holdFire);
    this.withOrderBatch(() => {
      for (const b of group) this.dispatch(b, hold ? "Cessar fogo" : "Atirar à vontade", () => (b.holdFire = hold), "BASIC");
    });
    this.publishHud();
  },

  /** Cavalaria entra ou sai da investida em ciclo. */
  toggleCycle(this: WorldScene): void {
    const group = this.commandTargets().filter((b) => !b.isDestroyed && b.mayCycle);
    if (group.length === 0) return;
    const on = !group.every((b) => b.cycle);
    this.withOrderBatch(() => {
      for (const b of group) this.dispatch(b, on ? "Investida em ciclo" : "Fim do ciclo", () => (b.cycle = on), "BASIC");
    });
    this.publishHud();
  },

  /** Quem atira e foge liga ou desliga o modo escaramuça. */
  toggleKite(this: WorldScene): void {
    const group = this.commandTargets().filter((b) => !b.isDestroyed && b.ammoLeft !== null);
    if (group.length === 0) return;
    const on = !group.every((b) => b.kiting);
    this.withOrderBatch(() => {
      for (const b of group) this.dispatch(b, on ? "Escaramuçar" : "Fim da escaramuça", () => (b.kiting = on), "BASIC");
    });
    this.publishHud();
  },

  /** A caravana que o bando escolta: onde está e se ainda espera no portão. */
  escortAt(this: WorldScene): { x: number; y: number; waiting: boolean } | null {
    const band = this.warbands.bands.find((b) => b.cargo?.escort);
    return band ? { x: Math.round(band.anchor.x), y: Math.round(band.anchor.y), waiting: !!band.waiting } : null;
  },

  /** Selecionados correm (ou voltam ao passo, se todos já correm). */
  toggleRun(this: WorldScene): void {
    const group = this.commandTargets().filter((b) => !b.isDestroyed);
    if (group.length === 0) return;
    const run = !group.every((b) => b.running);
    this.withOrderBatch(() => {
      for (const b of group) this.dispatch(b, run ? "Correr" : "Passo normal", () => (b.running = run), "BASIC");
    });
    this.publishHud();
  },

  /**
   * Botão direito:
   * - sobre um batalhão aliado → abre o menu de contexto (React);
   * - sobre um inimigo → batalhões selecionados atacam;
   * - no chão → batalhões selecionados marcham (segundo clique: correm) e batedores selecionados exploram o ponto.
   * Ordens para quem está fora do raio de comando vão por mensageiro.
   */
  handleRightClick(this: WorldScene, pointer: Phaser.Input.Pointer, run = false): void {
    const { worldX: x, worldY: y } = pointer;

    const selected = this.battalions.filter((b) => b.selected);
    const selectedScouts = this.scouts.filter((s) => s.selected && s.isAlive);

    // Sobre um batalhão: menu do grupo selecionado (se ele faz parte de uma seleção múltipla) ou só dele
    const own = this.battalionAt(x, y);
    if (own) {
      const ev = pointer.event as MouseEvent;
      const ids = own.selected && selected.length > 1 ? selected.map((b) => b.id) : [own.id];
      useGameStore.getState().setContextMenu({ battalionIds: ids, x: ev.clientX, y: ev.clientY });
      return;
    }

    if (selected.length === 0 && selectedScouts.length === 0) return;

    const point = { x, y };
    let accepted = false;
    for (const s of selectedScouts) {
      accepted = this.orderScout(s, { kind: "WATCH", point }) || accepted;
    }

    const enemy = nearest(
      this.enemies.filter((e) => e.isAlive && e.revealed && !e.friendly),
      point,
      40,
    );
    let marker = point;
    if (enemy) {
      for (const b of selected) accepted = this.dispatch(b, "Atacar", () => b.orderAttack(enemy)) || accepted;
    } else if (selected.length > 0) {
      // Povoado que barra o exército: a tropa vai até o portão e espera ali
      const shut = this.closedRule("ARMY", point);
      if (shut) {
        const wait = this.gateWait(shut.id, point);
        marker = wait.point;
        this.pushFeed(this.run ? "Portões fechados: é preciso escada ou aríete para entrar." : `Os guardas de ${shut.name} não deixam o exército entrar: os batalhões esperam no portão.`);
        accepted = this.groupMove(selected, wait.point, wait.facing, run) || accepted;
      } else {
        accepted = this.groupMove(selected, point, undefined, run) || accepted;
      }
    }
    if (accepted) this.showOrderMarker(marker.x, marker.y, enemy ? COLORS.ORDER_ATTACK : run ? COMBAT_RUN_COLOR : COLORS.ORDER_MOVE);
  },

  /**
   * Marcha em grupo: os batalhões se dispõem conforme o arranjo escolhido
   * (fileira da frente centrada no ponto clicado, demais fileiras atrás),
   * todos virados para a mesma direção e sem cruzar o caminho um do outro.
   */
  groupMove(this: WorldScene, group: readonly Battalion[], target: Point, facing?: number, run = false): boolean {
    const movable = group.filter((b) => !b.isDestroyed);
    if (movable.length === 0) return false;
    const origin = centroid(movable.map((b) => b.center));
    const dir = facing ?? angleTo(origin, target);
    if (movable.length === 1) {
      const b = movable[0];
      return this.dispatch(b, run ? "Correr" : "Marchar", () => b.orderMove(target, dir, { run }));
    }

    const fx = Math.cos(dir);
    const fy = Math.sin(dir);
    const arrangement = useGameStore.getState().groupArrangement;
    let sent = false;
    for (const { battalion, lateral, back } of layoutGroup(movable, arrangement, dir, origin)) {
      const p = { x: target.x - fx * back - fy * lateral, y: target.y - fy * back + fx * lateral };
      sent = this.dispatch(battalion, run ? "Correr" : "Marchar", () => battalion.orderMove(p, dir, { run })) || sent;
    }
    return sent;
  },

  /** Reorganiza o grupo no lugar onde já está (após trocar o arranjo), mantendo a direção da frente. */
  regroupInPlace(this: WorldScene, group: readonly Battalion[]): void {
    const movable = group.filter((b) => !b.panicking && !b.isDestroyed && !b.isFollowing);
    if (movable.length < 2) return;
    // Direção média das frentes atuais
    const sx = movable.reduce((s, b) => s + Math.cos(b.facing), 0);
    const sy = movable.reduce((s, b) => s + Math.sin(b.facing), 0);
    const dir = Math.atan2(sy, sx);
    const origin = centroid(movable.map((b) => b.center));
    // Centraliza o grupo inteiro (não só a fileira da frente) onde ele já está
    const slots = layoutGroup(movable, useGameStore.getState().groupArrangement, dir, origin);
    const meanBack = slots.reduce((s, x) => s + x.back, 0) / slots.length;
    this.groupMove(movable, { x: origin.x + Math.cos(dir) * meanBack, y: origin.y + Math.sin(dir) * meanBack }, dir);
  },

  /** Aplica os comandos enviados pela UI React (menu de contexto, cards do HUD). */
  processUiCommands(this: WorldScene): void {
    const commands = useGameStore.getState().drainBattleCommands();
    if (commands.length === 0) return;
    // Cada comando da UI é UMA ordem: batalhões próximos dividem o mesmo mensageiro
    for (const cmd of commands) this.withOrderBatch(() => this.applyUiCommand(cmd));
    this.publishHud();
  },

  applyUiCommand(this: WorldScene, cmd: BattleCommand): void {
    {
      const picked = this.battalions.filter((b) => cmd.ids.includes(b.id) && !b.isDestroyed);

      switch (cmd.type) {
        case "SELECT":
          if (cmd.additive && picked.every((b) => b.selected)) for (const b of picked) b.selected = false;
          else this.select(picked, [], cmd.additive);
          break;
        case "SELECT_SCOUT": {
          const scouts = this.scouts.filter((s) => cmd.ids.includes(s.rider.id) && s.isAlive);
          if (cmd.additive && scouts.every((s) => s.selected)) for (const s of scouts) s.selected = false;
          else this.select([], scouts, cmd.additive);
          break;
        }
        case "CAMERA":
          if (cmd.action === "TOGGLE") this.setCameraLocked(!this.cameraLocked);
          else this.centerOnCommander();
          break;
        case "COMPANY": {
          const id = cmd.ids[0];
          const lead = id ? this.companies.leaderBattalion(id, this.battalions) : null;
          if (!lead) break;
          const stance = cmd.stance;
          // A ordem é larga, mas é uma ordem: perto, vai pela voz; longe, por mensageiro
          this.dispatch(lead, `Postura: ${STANCE_LABEL[stance]}`, () => this.companies.setStance(id, stance, this.battalions), "COMPLEX", false);
          break;
        }
        case "TRUMPET": {
          // Sem seleção, o toque vale para todo o exército
          const targets = picked.length > 0 ? picked : this.battalions.filter((b) => !b.isDestroyed);
          this.trumpetCall(cmd.call, targets);
          break;
        }
        case "WAR_CRY":
          this.warCry();
          break;
        case "TRAVEL":
          this.fastTravel({ x: cmd.x, y: cmd.y });
          break;
        case "TORCHES":
          this.setTorches(!this.torches);
          break;
        case "REST":
          this.restUntilDawn();
          break;
        case "SIEGE":
          this.siegeCommand(cmd.action);
          break;
        case "REVEAL":
          for (const id of cmd.ids) this.revealArmiesOf(id);
          break;
        case "FORCED_MARCH":
          this.setForced(!this.forced);
          break;
        case "TACTICAL_PAUSE":
          this.setTacticalPause(!this.tacticalPause);
          break;
        case "SLOW_MOTION":
          this.startSlowMotion();
          break;
        case "HOLD_FIRE":
          this.toggleHoldFire();
          break;
        case "CYCLE":
          this.toggleCycle();
          break;
        case "KITE":
          this.toggleKite();
          break;
        case "RUN":
          this.toggleRun();
          break;
        case "FORAGE":
          this.forage();
          break;
        case "PACK_CAMP":
          this.packCamp();
          break;
        case "PITCH_CAMP":
          this.pitchCamp();
          break;
        case "FERRY":
          this.crossFerry(cmd.ferryId);
          break;
        case "WAIT_TRAINING": {
          const s = useGameStore.getState();
          const left = Math.max(0, ...s.training.map((t) => t.until - (s.day + s.dayProgress)));
          if (this.engagement || s.mutiny || left <= 0) break;
          this.passTime(left + 0.001);
          const done = useGameStore.getState().finishTraining();
          if (done.length > 0) this.pushFeed(`Treino concluído após ${left.toFixed(1).replace(".", ",")} dia(s).`);
          break;
        }
        case "FOUND": {
          const why = this.foundBlocked();
          if (why) this.pushFeed(`Não dá para fundar uma vila aqui: ${why.toLowerCase()}.`);
          else if (useGameStore.getState().foundSettlement(this.foundSite().x, this.foundSite().y)) {
            this.pushFeed("Uma nova aldeia nasce sob a bandeira do bando!");
          }
          break;
        }
        case "SCOUT_MODE":
          for (const s of this.scouts.filter((x) => cmd.ids.includes(x.rider.id) && x.isAlive)) this.orderScout(s, { kind: cmd.mode });
          break;
        case "SCOUT_ORDER":
          for (const s of this.scouts.filter((x) => cmd.ids.includes(x.rider.id) && x.isAlive)) this.orderScout(s, cmd.order);
          break;
        case "SCOUT_STEALTH":
          for (const s of this.scouts.filter((x) => cmd.ids.includes(x.rider.id) && x.isAlive)) {
            if (s.inContact) s.setSneaking(!s.sneaking);
            else this.pushFeed(`${s.rider.name} está fora de contato.`);
          }
          break;
        case "HARPY_SEND":
          for (const h of this.harpies.filter((x) => cmd.ids.includes(x.scout.rider.id))) this.sendHarpy(h, true);
          break;
        case "FOLLOW":
          for (const b of picked) this.dispatch(b, "Reunir ao estandarte", () => b.orderFollow(this.commander), "BASIC_VISUAL");
          break;
        case "HOLD":
          for (const b of picked) this.dispatch(b, "Alto", () => b.holdPosition(), "BASIC");
          break;
        case "FORMATION":
          for (const b of picked) {
            if (b.canUseFormation(cmd.formation)) {
              this.dispatch(b, `Formação: ${FORMATIONS[cmd.formation].label}`, () => b.setFormation(cmd.formation), "VISUAL");
            }
          }
          break;
        case "CHARGE":
          for (const b of picked) {
            this.dispatch(
              b,
              "Carregar",
              () => {
                if (b.orderCharge(this.visibleEnemies()) && b.order.type === "ATTACK") {
                  this.showOrderMarker(b.order.target.x, b.order.target.y, COLORS.ORDER_ATTACK);
                }
              },
              "BASIC",
            );
          }
          break;
        case "FOCUS": {
          // Todos no mesmo alvo: o inimigo visível mais próximo do centro do grupo
          const target = nearest(this.visibleEnemies(), centroid(picked.map((b) => b.center)));
          if (!target) break;
          let accepted = false;
          for (const b of picked) accepted = this.dispatch(b, "Foco no alvo", () => b.orderAttack(target)) || accepted;
          if (accepted) this.showOrderMarker(target.x, target.y, COLORS.ORDER_ATTACK);
          break;
        }
        case "ARRANGEMENT":
          useGameStore.getState().setGroupArrangement(cmd.arrangement);
          this.regroupInPlace(picked); // quem segue o Comandante se reorganiza via assignFollowSlots
          break;
      }
    }
  },

  select(this: WorldScene, battalions: readonly Battalion[], scouts: readonly Scout[], additive: boolean): void {
    if (!additive) {
      for (const b of this.battalions) b.selected = false;
      for (const s of this.scouts) s.selected = false;
    }
    for (const b of battalions) if (!b.isDestroyed) b.selected = true;
    for (const s of scouts) if (s.isAlive) s.selected = true;
  },

  /** Selecionados; sem seleção, todos (atalho de teclado). */
  commandTargets(this: WorldScene): Battalion[] {
    const selected = this.battalions.filter((b) => b.selected);
    return selected.length > 0 ? selected : this.battalions;
  },

  battalionAt(this: WorldScene, x: number, y: number): Battalion | null {
    return this.battalions.find((b) => !b.isDestroyed && b.containsPoint({ x, y })) ?? null;
  },

  selectionRect(this: WorldScene, pointer: Phaser.Input.Pointer): Phaser.Geom.Rectangle {
    const start = this.dragStart ?? { x: pointer.worldX, y: pointer.worldY };
    return new Phaser.Geom.Rectangle(
      Math.min(start.x, pointer.worldX),
      Math.min(start.y, pointer.worldY),
      Math.abs(pointer.worldX - start.x),
      Math.abs(pointer.worldY - start.y),
    );
  },

  drawSelectionBox(this: WorldScene, rect: Phaser.Geom.Rectangle): void {
    const g = this.selectionBox;
    g.clear();
    g.fillStyle(COLORS.SELECTION, 0.12);
    g.fillRectShape(rect);
    g.lineStyle(1, COLORS.SELECTION, 0.9);
    g.strokeRectShape(rect);
  },

  showOrderMarker(this: WorldScene, x: number, y: number, color: number): void {
    const marker = this.add.graphics({ x, y }).setDepth(4);
    marker.lineStyle(2, color, 1);
    marker.strokeCircle(0, 0, 14);
    marker.lineBetween(-6, 0, 6, 0);
    marker.lineBetween(0, -6, 0, 6);
    this.tweens.add({
      targets: marker,
      alpha: 0,
      scale: 1.6,
      duration: 450,
      onComplete: () => marker.destroy(),
    });
  },
};

export type InputMethods = typeof inputMethods;
