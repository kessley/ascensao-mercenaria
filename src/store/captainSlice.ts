import { captainName, companyLimit, generateCaptain, promoteLieutenant, promotionBlock, type CaptainData } from "../game/data/captains";
import { CAPTAINS, LIEUTENANTS } from "../utils/constants";
import type { BattalionData, GameState, LogTone } from "./useGameStore";

/**
 * Capitães e companhias (Marco 20): quem conduz um grupo de batalhões abaixo do Comandante. Fica
 * à parte do store principal, como a corte, a guerra, o mar e o legado. O capitão que está fora
 * numa expedição viaja dentro dela (`Expedition.captain`) e não aparece em `captains`.
 */

export interface CaptainState {
  captains: CaptainData[];
  /** Quem se ofereceu no Posto de Recrutamento (renovados como os tenentes). */
  captainCandidates: CaptainData[];
}

export const INITIAL_CAPTAINS: CaptainState = { captains: [], captainCandidates: [] };

export interface CaptainActions {
  hireCaptain: (candidateId: string) => string | null;
  /** O tenente vira capitão e o batalhão dele vira a guarda da companhia. */
  promoteToCaptain: (lieutenantId: string) => string | null;
  /** Põe o batalhão numa companhia (ou tira dela, com null). Um batalhão só pertence a uma. */
  setCompany: (battalionId: string, captainId: string | null) => string | null;
  /** Com que batalhão o capitão marcha (ele vai na frente da guarda). */
  setGuard: (captainId: string, battalionId: string) => void;
  dismissCaptain: (captainId: string) => void;
}

const addHistory = (history: string[], line: string) => [...history, line].slice(-LIEUTENANTS.HISTORY_SIZE);

/** Candidatos novos: um nobre sem terra e um mercenário famoso. */
export const freshCaptains = (day: number): CaptainData[] =>
  Array.from({ length: CAPTAINS.CANDIDATES }, (_, i) => generateCaptain(day, i % 2 === 0 ? "NOBLE" : "TAVERN"));

/** Capitães do bando, inclusive os que estão fora com a companhia. */
export function allCaptains(s: Pick<GameState, "captains" | "expeditions">): CaptainData[] {
  return [...s.captains, ...s.expeditions.flatMap((e) => (e.captain ? [e.captain] : []))];
}

/** A companhia de quem este batalhão é. */
export function companyOf(captains: readonly CaptainData[], battalionId: string): CaptainData | undefined {
  return captains.find((c) => c.battalionIds.includes(battalionId));
}

/** Lealdade do capitão (Leais perdem pela metade); `why` vai para a crônica dele. */
export function shiftLoyalty(c: CaptainData, delta: number, day: number, why: string): CaptainData {
  const d = delta < 0 && c.traits.includes("LOYAL") ? Math.trunc(delta / 2) : delta;
  if (d === 0) return c;
  return { ...c, loyalty: Math.max(0, Math.min(100, c.loyalty + d)), history: addHistory(c.history, `Dia ${day}: ${why} (${d > 0 ? "+" : ""}${d} lealdade).`) };
}

/** Companhia sem os batalhões que deixaram de existir (a guarda passa ao próximo da lista). */
export function pruneCompanies(captains: readonly CaptainData[], exists: (id: string) => boolean): CaptainData[] {
  let changed = false;
  const out = captains.map((c) => {
    const ids = c.battalionIds.filter(exists);
    if (ids.length === c.battalionIds.length) return c;
    changed = true;
    return { ...c, battalionIds: ids };
  });
  return changed ? out : (captains as CaptainData[]);
}

export interface Desertion {
  captains: CaptainData[];
  battalions: BattalionData[];
  log: { text: string; tone: LogTone }[];
}

/**
 * Quem perdeu a fé vai embora e leva a companhia que está no acampamento. Nunca o bando inteiro:
 * o último batalhão fica com o Comandante.
 */
export function desertions(captains: readonly CaptainData[], battalions: readonly BattalionData[]): Desertion {
  let left = [...battalions];
  const kept: CaptainData[] = [];
  const log: Desertion["log"] = [];
  for (const c of captains) {
    if (c.loyalty > CAPTAINS.LOYALTY_DESERT_AT) {
      kept.push(c);
      continue;
    }
    const going = left.filter((b) => c.battalionIds.includes(b.id));
    const taken = going.length >= left.length ? going.slice(0, -1) : going;
    const out = new Set(taken.map((b) => b.id));
    left = left.filter((b) => !out.has(b.id));
    log.push({
      text: taken.length > 0
        ? `${captainName(c)} quer a própria bandeira: abandonou o bando levando ${taken.map((b) => b.name).join(" e ")}.`
        : `${captainName(c)} perdeu a fé no Comandante e foi embora sozinho.`,
      tone: "bad",
    });
  }
  return { captains: kept, battalions: left, log };
}

/** A semana de cada capitão: ambição com companhia grande e, sem salário, a conta do atraso. */
export function captainsWeek(captains: readonly CaptainData[], paid: boolean, day: number): CaptainData[] {
  return captains.map((c) => {
    let next = c;
    if (c.ambition >= 4 && c.battalionIds.length >= 3) next = shiftLoyalty(next, CAPTAINS.LOYALTY.AMBITION_WEEKLY, day, "mais uma semana sob as ordens de outro");
    if (!paid) next = shiftLoyalty(next, CAPTAINS.LOYALTY.PAYDAY_MISSED + (c.traits.includes("GREEDY") ? CAPTAINS.LOYALTY.PAYDAY_MISSED : 0), day, "salário atrasado");
    return next;
  });
}

type Setter = (partial: Partial<GameState> | ((s: GameState) => Partial<GameState>)) => void;

export function captainSlice(set: Setter, get: () => GameState, links: { note: (text: string, tone?: LogTone) => void }): CaptainActions {
  const full = (s: GameState) => allCaptains(s).length >= CAPTAINS.MAX_HIRED;
  return {
    hireCaptain: (candidateId) => {
      const s = get();
      const c = s.captainCandidates.find((x) => x.id === candidateId);
      if (!c) return "Esse capitão já foi embora.";
      if (full(s)) return `O bando já tem ${CAPTAINS.MAX_HIRED} capitães.`;
      if (s.gold < c.hireCost) return `Faltam ${c.hireCost - s.gold} de ouro.`;
      const hired = { ...c, history: addHistory(c.history, `Dia ${s.day}: entrou para o bando por ${c.hireCost} de ouro.`) };
      set({ gold: s.gold - c.hireCost, captains: [...s.captains, hired], captainCandidates: s.captainCandidates.filter((x) => x.id !== candidateId) });
      links.note(`${captainName(c)} foi contratado(a) como capitão.`, "good");
      return null;
    },

    promoteToCaptain: (lieutenantId) => {
      const s = get();
      const l = s.lieutenants.find((x) => x.id === lieutenantId);
      if (!l) return "Esse tenente não está no bando.";
      if (full(s)) return `O bando já tem ${CAPTAINS.MAX_HIRED} capitães.`;
      const b = l.battalionId ? s.battalions.find((x) => x.id === l.battalionId) : undefined;
      const block = promotionBlock(l, b ? b.level : null);
      if (block || !b) return block ?? "Precisa comandar um batalhão.";
      const captain = promoteLieutenant(l, b.level, s.day);
      set({
        lieutenants: s.lieutenants.filter((x) => x.id !== lieutenantId),
        // O batalhão dele sai da companhia em que estava: agora é a guarda da dele
        captains: [...s.captains.map((c) => ({ ...c, battalionIds: c.battalionIds.filter((id) => id !== b.id) })), captain],
      });
      links.note(`${captainName(captain)} foi promovido a capitão. ${b.name} agora é a guarda dele.`, "good");
      return null;
    },

    setCompany: (battalionId, captainId) => {
      const s = get();
      const b = s.battalions.find((x) => x.id === battalionId);
      if (!b) return "Esse batalhão não está no acampamento.";
      const target = captainId ? s.captains.find((c) => c.id === captainId) : undefined;
      if (captainId && !target) return "Esse capitão não está no acampamento.";
      if (target?.battalionIds.includes(battalionId)) return null;
      if (target && target.battalionIds.length >= companyLimit(target)) return `${captainName(target)} conduz no máximo ${companyLimit(target)} batalhões.`;
      set({
        captains: s.captains.map((c) => {
          const rest = c.battalionIds.filter((id) => id !== battalionId);
          if (c.id !== captainId) return rest.length === c.battalionIds.length ? c : { ...c, battalionIds: rest };
          return { ...c, battalionIds: [...rest, battalionId], history: addHistory(c.history, `Dia ${s.day}: ${b.name} entrou na companhia.`) };
        }),
      });
      return null;
    },

    setGuard: (captainId, battalionId) =>
      set((s) => ({
        captains: s.captains.map((c) => (c.id === captainId && c.battalionIds.includes(battalionId) ? { ...c, battalionIds: [battalionId, ...c.battalionIds.filter((id) => id !== battalionId)] } : c)),
      })),

    dismissCaptain: (captainId) => {
      const s = get();
      const c = s.captains.find((x) => x.id === captainId);
      if (!c) return;
      set({ captains: s.captains.filter((x) => x.id !== captainId), heirId: s.heirId === captainId ? null : s.heirId });
      links.note(`${captainName(c)} foi dispensado(a). Os batalhões dele voltam às ordens do Comandante.`);
    },
  };
}
