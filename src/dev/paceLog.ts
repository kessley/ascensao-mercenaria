/**
 * O diário de ritmo ao vivo (Fase 4, etapa 2; só no modo de desenvolvimento). Olha o jogo quatro
 * vezes por segundo e conta em que estado o jogador está, escuta o store para as decisões e as
 * missões, e recebe da `Unit` cada inimigo que cai. As contas ficam em `paceRules.ts`.
 *
 * No console: `__pace.report()` (o resumo), `__pace.reset()` (começa de novo). No jogo: F9 abre o
 * painel.
 */
import { useGameStore } from "../store/useGameStore";
import { Unit } from "../game/entities/Unit";
import { Enemy } from "../game/entities/Enemy";
import type { WorldScene } from "../game/scenes/WorldScene";
import { PaceLog, paceState, type PaceReport } from "./paceRules";

const TICK_MS = 250;
/** Quem andou mais que isto desde a última olhada está andando (px). */
const STEP_PX = 3;

let log = new PaceLog();

const world = (): WorldScene | null => (window as unknown as { __world?: WorldScene }).__world ?? null;

export interface PaceApi {
  report: () => PaceReport;
  reset: () => void;
  log: () => PaceLog;
}

export function installPaceLog(): void {
  let last = performance.now();
  let watched: WorldScene | null = null;
  let wasInCamp = true;
  const seen = new Map<object, { x: number; y: number }>();

  window.setInterval(() => {
    const now = performance.now();
    const dt = Math.min(1000, now - last);
    last = now;
    const s = useGameStore.getState();
    const w = world();
    if (document.hidden || s.phase === "NEW_GAME" || s.scenario || !w?.sys?.game) return;
    // Jogo novo ou carregado: outra cena, outra porta do acampamento
    if (w !== watched) {
      watched = w;
      wasInCamp = w.inCamp;
      seen.clear();
    }
    const scenes = w.sys.game.scene;
    const inside = scenes.isActive("InteriorScene") || scenes.isActive("CapitalScene");
    const duel = scenes.isActive("DuelScene");
    let moving = false;
    if (!inside && !duel) {
      const walkers: { key: object; x: number; y: number }[] = [{ key: w.commander, x: w.commander.x, y: w.commander.y }];
      for (const b of w.battalions) if (!b.isDestroyed) walkers.push({ key: b, ...b.center });
      for (const p of walkers) {
        const was = seen.get(p.key);
        if (was && Math.hypot(p.x - was.x, p.y - was.y) > STEP_PX) moving = true;
        seen.set(p.key, { x: p.x, y: p.y });
      }
    }
    const panel = !!(s.campPanel || s.battleReport || s.campEvent || s.dialog);
    log.tick(paceState({ map: s.worldMapOpen, panel, inside, fighting: duel || w.engagement !== null || w.fieldDuel !== null, moving }), dt);
    if (w.inCamp !== wasInCamp) {
      if (w.inCamp) log.backInCamp();
      else log.leftCamp();
      wasInCamp = w.inCamp;
    }
  }, TICK_MS);

  // Cada inimigo que cai: do primeiro golpe à queda, em tempo de jogo (vale também no laboratório)
  Unit.onFall = (u, firstHitAt) => {
    if (u instanceof Enemy && Number.isFinite(firstHitAt)) log.fell(u.kind, u.scene.time.now - firstHitAt);
  };

  // As decisões com custo e as missões, pelo store
  const recruits = new Set(useGameStore.getState().battalions.map((b) => b.id));
  useGameStore.subscribe((next, prev) => {
    if (next.loadNonce !== prev.loadNonce || next.phase === "NEW_GAME") {
      // Jogo carregado (ou novo): quem já estava não foi recrutado agora
      recruits.clear();
      for (const b of next.battalions) recruits.add(b.id);
      return;
    }
    if (next.scenario) return;
    const a = next.activeContract?.contract;
    const b = prev.activeContract?.contract;
    if (a && a.id !== b?.id) {
      log.decide("CONTRACT");
      log.accepted(a.id, a.title);
    }
    if (b && b.id !== a?.id) log.finished(b.id);
    if (next.campPlan !== prev.campPlan && next.campPlan.buildings.length > prev.campPlan.buildings.length) log.decide("BUILD");
    if (next.battalions !== prev.battalions) {
      // A escolta que volta e a expedição que chega já eram do bando, e o bando do começo não foi
      // comprado: recrutar é gente nova paga com ouro
      const fresh = next.battalions.filter((x) => !recruits.has(x.id));
      for (const x of fresh) recruits.add(x.id);
      if (fresh.length > 0 && next.gold < prev.gold) log.decide("RECRUIT");
    }
    if (prev.campEvent && !next.campEvent) log.decide("EVENT");
  });

  const api: PaceApi = {
    report: () => log.report(),
    reset: () => {
      log = new PaceLog();
    },
    log: () => log,
  };
  (window as unknown as { __pace?: PaceApi }).__pace = api;
}
