import type { BattalionData } from "../../store/useGameStore";
import { fullName, type LieutenantData, type TraitId } from "../data/lieutenants";

/**
 * Vida no acampamento (Marco 12), em funções puras usadas pelo store:
 * - **Seguidores do acampamento**: cozinheiro, mascate, curandeira, capelão e famílias —
 *   cada um presta um serviço e come rações.
 * - **Relações entre tenentes**: amizade e rivalidade que crescem dia a dia pelos traços
 *   (e com as vitórias lado a lado).
 * - **Eventos com escolha** (como no RimWorld): pequenos dramas do acampamento com 2 ou 3
 *   respostas, que mexem no humor do acampamento, na lealdade dos tenentes, na honra, no
 *   ouro, nas rações e nos soldados.
 */

// --- Seguidores ---

export type FollowerRole = "COOK" | "PEDDLER" | "HEALER" | "CHAPLAIN" | "FAMILY" | "SMITH";

export const FOLLOWERS: Record<FollowerRole, { label: string; effect: string; rations: number; max: number; pitch: string }> = {
  COOK: { label: "Cozinheiro", effect: "−20% de rações gastas", rations: 0.5, max: 1, pitch: "um cozinheiro de taverna falida" },
  PEDDLER: { label: "Mascate", effect: "+25% no ouro do saque; vende vinho, ataduras e cobertores na banca", rations: 0.5, max: 1, pitch: "um mascate com uma carroça de bugigangas" },
  HEALER: { label: "Curandeira", effect: "mais caídos ficam feridos em vez de mortos, e os feridos saram mais depressa", rations: 0.5, max: 1, pitch: "uma curandeira de ervas e agulha" },
  CHAPLAIN: { label: "Capelão", effect: "+10 na moral com que as tropas saem", rations: 0.5, max: 1, pitch: "um capelão sem paróquia" },
  FAMILY: { label: "Família de soldado", effect: "deserções pela metade", rations: 1, max: 4, pitch: "a família de um dos soldados" },
  SMITH: { label: "Ajudante de ferreiro", effect: "−25% no ouro e no ferro da Ferraria", rations: 0.5, max: 1, pitch: "um ajudante de ferreiro com o próprio martelo" },
};

/**
 * Quantos seguidores o bando atrai: crescem com o tamanho dele (soldados) e com a fama
 * (inimigos abatidos em toda a carreira dos batalhões). Famílias, uma a cada 12 soldados.
 */
export function followerCap(battalions: readonly { soldiers: number; totalKills: number }[]): { total: number; families: number } {
  const soldiers = battalions.reduce((n, b) => n + b.soldiers, 0);
  const fame = battalions.reduce((n, b) => n + b.totalKills, 0);
  return {
    total: Math.min(12, 1 + Math.floor(soldiers / 8) + Math.floor(fame / 30)),
    families: Math.min(FOLLOWERS.FAMILY.max, 1 + Math.floor(soldiers / 12)),
  };
}

export interface Follower {
  id: string;
  role: FollowerRole;
  name: string;
  /** Dia em que se juntou ao bando. */
  since: number;
}

const FOLLOWER_NAMES = ["Ermelinda", "Bento", "Guida", "Tadeu", "Rosalva", "Anselmo", "Filipa", "Crispim", "Joana", "Lourenço", "Marta", "Simão"];

export function newFollower(role: FollowerRole, day: number): Follower {
  return { id: crypto.randomUUID(), role, name: FOLLOWER_NAMES[Math.floor(Math.random() * FOLLOWER_NAMES.length)], since: day };
}

export const hasFollower = (followers: readonly Follower[], role: FollowerRole) => followers.some((f) => f.role === role);

/** Rações que os seguidores comem por dia. */
export function followerRations(followers: readonly Follower[]): number {
  return followers.reduce((sum, f) => sum + FOLLOWERS[f.role].rations, 0);
}

// --- Relações entre tenentes ---

export const bondKey = (a: string, b: string) => (a < b ? `${a}|${b}` : `${b}|${a}`);
export const bondOf = (bonds: Readonly<Record<string, number>>, a: string, b: string) => bonds[bondKey(a, b)] ?? 0;

/** Traços que se dão bem (+) ou mal (−) quando dividem o mesmo acampamento. */
const AFFINITY: [TraitId, TraitId, number][] = [
  ["HONORABLE", "BLOODTHIRSTY", -3],
  ["CAUTIOUS", "BRAVE", -2],
  ["GREEDY", "HONORABLE", -2],
  ["LOYAL", "AMBITIOUS", -2],
  ["AMBITIOUS", "AMBITIOUS", -2],
  ["CAUTIOUS", "BLOODTHIRSTY", -1],
  ["BRAVE", "BLOODTHIRSTY", 2],
  ["LOYAL", "HONORABLE", 2],
  ["BRAVE", "BRAVE", 1],
  ["CAUTIOUS", "LOYAL", 1],
  ["GREEDY", "GREEDY", 1],
  ["HONORABLE", "HONORABLE", 1],
];

export function affinity(a: LieutenantData, b: LieutenantData): number {
  let v = 0;
  for (const [x, y, k] of AFFINITY) {
    if ((a.traits.includes(x) && b.traits.includes(y)) || (a.traits.includes(y) && b.traits.includes(x))) v += k;
  }
  return v;
}

export const FRIEND_AT = 40;
export const RIVAL_AT = -40;

export function relationLabel(v: number): { text: string; tone: string } {
  if (v >= FRIEND_AT) return { text: "amizade", tone: "text-emerald-300" };
  if (v <= RIVAL_AT) return { text: "rivalidade", tone: "text-red-300" };
  if (v >= 15) return { text: "simpatia", tone: "text-emerald-200/70" };
  if (v <= -15) return { text: "atrito", tone: "text-red-200/70" };
  return { text: "neutros", tone: "text-neutral-400" };
}

/** Um dia de convivência: cada par de tenentes se aproxima ou se afasta conforme os traços. */
export function driftBonds(bonds: Readonly<Record<string, number>>, lieutenants: readonly LieutenantData[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (let i = 0; i < lieutenants.length; i++) {
    for (let j = i + 1; j < lieutenants.length; j++) {
      const a = lieutenants[i];
      const b = lieutenants[j];
      const key = bondKey(a.id, b.id);
      const noise = Math.round((Math.random() - 0.5) * 2);
      out[key] = Math.max(-100, Math.min(100, (bonds[key] ?? 0) + affinity(a, b) + noise));
    }
  }
  return out;
}

/** Vitória lado a lado aproxima os tenentes que lutaram juntos. */
export function shareVictory(bonds: Readonly<Record<string, number>>, ids: readonly string[], amount = 4): Record<string, number> {
  const out = { ...bonds };
  for (let i = 0; i < ids.length; i++) {
    for (let j = i + 1; j < ids.length; j++) {
      const key = bondKey(ids[i], ids[j]);
      out[key] = Math.min(100, (out[key] ?? 0) + amount);
    }
  }
  return out;
}

// --- Eventos com escolha ---

export type CampEventKind =
  | "THIEF"
  | "TENT_DISPUTE"
  | "DESERTER_RETURNS"
  | "BRAWL"
  | "CAMARADERIE"
  | "VICTORY_FEAST"
  | "FOLLOWER"
  | "PILGRIMS"
  | "ARREARS_GRUMBLE"
  | "HUNGER_GRUMBLE";

export interface CampEventOption {
  label: string;
  /** O que a escolha faz, em poucas palavras. */
  hint: string;
  /** Escolha indisponível (ex.: sem ouro). */
  disabled?: boolean;
}

export interface CampEvent {
  id: string;
  kind: CampEventKind;
  title: string;
  text: string;
  options: CampEventOption[];
  /** Quem está envolvido (ids de batalhão, tenente, papel do seguidor...). */
  data: Record<string, string>;
}

/** O que o evento olha e muda. */
export interface CampContext {
  day: number;
  gold: number;
  rations: number;
  debt: number;
  battalions: BattalionData[];
  lieutenants: LieutenantData[];
  followers: Follower[];
  honor: number;
  campMood: number;
  bonds: Record<string, number>;
  arrearsWeeks: number;
  hungryDays: number;
  pendingMutiny: boolean;
  lastVictoryDay: number | null;
  bandName: string;
}

export interface CampEventResult {
  ctx: CampContext;
  /** Mudanças de lealdade (o store aplica, com deserção e crônica pessoal). */
  loyalty: { id: string; delta: number }[];
  log: { text: string; tone: "info" | "good" | "bad" }[];
}

const pick = <T>(list: readonly T[]): T => list[Math.floor(Math.random() * list.length)];
const clampMood = (v: number) => Math.max(-30, Math.min(30, v));
const clampHonor = (v: number) => Math.max(0, Math.min(100, v));

/** Eventos possíveis agora (com pesos): o acampamento reage ao que está acontecendo. */
export function pickCampEvent(ctx: CampContext): CampEvent | null {
  const options: { w: number; make: () => CampEvent | null }[] = [];
  const bats = ctx.battalions;
  const soldiers = bats.reduce((n, b) => n + b.soldiers, 0);
  if (ctx.arrearsWeeks > 0 && !ctx.pendingMutiny) options.push({ w: 6, make: () => arrearsGrumble(ctx) });
  if (ctx.hungryDays > 0) options.push({ w: 6, make: () => hungerGrumble(ctx) });
  if (ctx.lastVictoryDay !== null && ctx.day - ctx.lastVictoryDay <= 1) options.push({ w: 4, make: () => victoryFeast(ctx) });
  if (ctx.rations >= 6 && bats.length > 0) options.push({ w: 2, make: () => thief(ctx) });
  if (bats.length >= 2) options.push({ w: 2, make: () => tentDispute(ctx) });
  if (bats.some((b) => b.soldiers < b.maxSoldiers)) options.push({ w: 2, make: () => deserterReturns(ctx) });
  if (ctx.rations >= 8) options.push({ w: 1, make: () => pilgrims(ctx) });
  // Bando maior e mais famoso atrai mais gente (e com mais frequência, quando há vaga sobrando)
  const room = followerCap(bats).total - ctx.followers.length;
  if (soldiers >= 12 && room > 0) options.push({ w: 2 + Math.min(4, room), make: () => followerOffer(ctx) });
  const pairs = lieutenantPairs(ctx);
  if (pairs.rivals.length > 0) options.push({ w: 4, make: () => brawl(ctx, pick(pairs.rivals)) });
  if (pairs.friends.length > 0) options.push({ w: 3, make: () => camaraderie(ctx, pick(pairs.friends)) });
  const total = options.reduce((n, o) => n + o.w, 0);
  let r = Math.random() * total;
  for (const o of options) {
    r -= o.w;
    if (r <= 0) return o.make();
  }
  return null;
}

function lieutenantPairs(ctx: CampContext): { rivals: [LieutenantData, LieutenantData][]; friends: [LieutenantData, LieutenantData][] } {
  const rivals: [LieutenantData, LieutenantData][] = [];
  const friends: [LieutenantData, LieutenantData][] = [];
  const ls = ctx.lieutenants;
  for (let i = 0; i < ls.length; i++) {
    for (let j = i + 1; j < ls.length; j++) {
      const v = bondOf(ctx.bonds, ls[i].id, ls[j].id);
      if (v <= RIVAL_AT) rivals.push([ls[i], ls[j]]);
      else if (v >= FRIEND_AT) friends.push([ls[i], ls[j]]);
    }
  }
  return { rivals, friends };
}

const ev = (kind: CampEventKind, title: string, text: string, options: CampEventOption[], data: Record<string, string> = {}): CampEvent => ({
  id: crypto.randomUUID(),
  kind,
  title,
  text,
  options,
  data,
});

function thief(ctx: CampContext): CampEvent {
  const b = pick(ctx.battalions);
  return ev(
    "THIEF",
    "Ladrão na Intendência",
    `Um soldado das ${b.name} foi pego enchendo o alforje com rações da Intendência. O acampamento inteiro espera para ver o que o Comandante vai fazer.`,
    [
      { label: "Açoitar em público", hint: "ninguém mais rouba; o clima pesa (humor −4)" },
      { label: "Perdoar e advertir", hint: "−5 rações; humor +2, honra +1" },
      { label: "Expulsar do bando", hint: `−1 soldado nas ${b.name}; honra +2` },
    ],
    { battalionId: b.id },
  );
}

function tentDispute(ctx: CampContext): CampEvent {
  const [a, b] = [...ctx.battalions].sort(() => Math.random() - 0.5);
  const vet = a.level >= b.level ? a : b;
  return ev(
    "TENT_DISPUTE",
    "A barraca mais seca",
    `As ${a.name} e as ${b.name} disputam a única barraca que não goteja. Já houve empurrões.`,
    [
      { label: `Dar aos veteranos (${vet.name})`, hint: "o tenente dos veteranos gosta; o outro, não" },
      { label: "Tirar na sorte", hint: "humor +1" },
      { label: "Comprar lona para outra (20 ouro)", hint: "humor +4", disabled: ctx.gold < 20 },
    ],
    { a: a.id, b: b.id, vet: vet.id },
  );
}

function deserterReturns(ctx: CampContext): CampEvent {
  const b = pick(ctx.battalions.filter((x) => x.soldiers < x.maxSoldiers));
  return ev(
    "DESERTER_RETURNS",
    "O desertor arrependido",
    `Um homem que desertou das ${b.name} voltou de cabeça baixa, magro e sem botas, pedindo para servir de novo.`,
    [
      { label: "Aceitar de volta", hint: `+1 soldado; humor +1, honra +1` },
      { label: "Aceitar, mas açoitado", hint: "+1 soldado; humor −2" },
      { label: "Mandar embora", hint: "nada muda" },
    ],
    { battalionId: b.id },
  );
}

function brawl(_ctx: CampContext, [a, b]: [LieutenantData, LieutenantData]): CampEvent {
  return ev(
    "BRAWL",
    "Briga de tenentes",
    `${fullName(a)} e ${fullName(b)} saíram no braço perto da fogueira. Os soldados fazem roda e apostam em quem ganha.`,
    [
      { label: `Punir ${a.name}`, hint: `${a.name} −10 de lealdade, ${b.name} +5` },
      { label: `Punir ${b.name}`, hint: `${b.name} −10 de lealdade, ${a.name} +5` },
      { label: "Deixar resolverem", hint: "humor +3 (o espetáculo); a rivalidade piora" },
    ],
    { a: a.id, b: b.id },
  );
}

function camaraderie(ctx: CampContext, [a, b]: [LieutenantData, LieutenantData]): CampEvent {
  return ev(
    "CAMARADERIE",
    "Histórias na fogueira",
    `${fullName(a)} e ${fullName(b)} contam histórias de batalha a noite toda; os soldados se juntam em volta para ouvir.`,
    [
      { label: "Pagar uma rodada (15 ouro)", hint: "humor +4; os dois +5 de lealdade", disabled: ctx.gold < 15 },
      { label: "Sentar com eles", hint: "humor +2; os dois +3 de lealdade" },
    ],
    { a: a.id, b: b.id },
  );
}

function victoryFeast(ctx: CampContext): CampEvent {
  return ev(
    "VICTORY_FEAST",
    "Festa da vitória",
    "A vitória ainda está fresca e os soldados cantam em volta da fogueira. Um sargento pede um barril de vinho para comemorar.",
    [
      { label: "Pagar o barril (25 ouro)", hint: "humor +8", disabled: ctx.gold < 25 },
      { label: "Negar", hint: "humor −4" },
    ],
  );
}

function followerOffer(ctx: CampContext): CampEvent | null {
  const cap = followerCap(ctx.battalions);
  const roles = (Object.keys(FOLLOWERS) as FollowerRole[]).filter(
    (r) => ctx.followers.filter((f) => f.role === r).length < (r === "FAMILY" ? cap.families : FOLLOWERS[r].max),
  );
  if (roles.length === 0) return null;
  const role = pick(roles);
  const def = FOLLOWERS[role];
  return ev(
    "FOLLOWER",
    `${def.label} no portão`,
    `Chegou ao portão ${def.pitch}, pedindo para seguir os ${ctx.bandName} em troca de comida e proteção.`,
    [
      { label: "Aceitar", hint: `${def.effect}; come ${def.rations} ração/dia` },
      { label: "Recusar", hint: "nada muda" },
    ],
    { role },
  );
}

function pilgrims(ctx: CampContext): CampEvent {
  return ev(
    "PILGRIMS",
    "Peregrinos",
    "Um grupo de peregrinos a caminho de um santuário pede abrigo e comida por uma noite. Estão exaustos e assustados com os bandos na estrada.",
    [
      { label: "Abrigar (−6 rações)", hint: "honra +4, humor +1", disabled: ctx.rations < 6 },
      { label: "Mandar seguirem caminho", hint: "honra −2" },
    ],
  );
}

function arrearsGrumble(ctx: CampContext): CampEvent {
  const biggest = [...ctx.battalions].sort((a, b) => b.soldiers - a.soldiers)[0];
  const part = Math.min(ctx.gold, Math.ceil(ctx.debt / 2));
  return ev(
    "ARREARS_GRUMBLE",
    "Rodinhas cochichando",
    `O soldo atrasou e os soldados cochicham em rodinhas entre as barracas. Nas ${biggest?.name ?? "fileiras"} já há quem fale em pegar o que é seu.`,
    [
      { label: "Prometer pagar com juros", hint: "humor +3 por ora; honra −1" },
      { label: `Pagar uma parte agora (${part} ouro)`, hint: "humor +6; a dívida cai", disabled: part <= 0 },
      { label: "Enforcar o agitador", hint: "−1 soldado; humor −6, honra −4 — o motim esfria pelo medo" },
    ],
    { battalionId: biggest?.id ?? "", part: String(part) },
  );
}

function hungerGrumble(ctx: CampContext): CampEvent {
  return ev(
    "HUNGER_GRUMBLE",
    "Barrigas vazias",
    "A tropa passa fome e a fila na Intendência não anda. Um sargento pede licença para caçar e forragear nos arredores.",
    [
      { label: "Mandar caçar", hint: "4–12 rações; às vezes um caçador não volta" },
      { label: "Racionar o que resta", hint: "humor −3" },
      { label: "Comprar de um mascate de passagem (30 ouro)", hint: "+12 rações", disabled: ctx.gold < 30 },
    ],
  );
}

/** Aplica a escolha `option` do evento. */
export function applyCampEvent(ctx0: CampContext, e: CampEvent, option: number): CampEventResult {
  const ctx: CampContext = { ...ctx0, battalions: ctx0.battalions.map((b) => ({ ...b })), followers: [...ctx0.followers], bonds: { ...ctx0.bonds } };
  const loyalty: { id: string; delta: number }[] = [];
  const log: CampEventResult["log"] = [];
  const mood = (d: number) => (ctx.campMood = clampMood(ctx.campMood + d));
  const honor = (d: number) => (ctx.honor = clampHonor(ctx.honor + d));
  const battalion = (id: string) => ctx.battalions.find((b) => b.id === id);
  const lt = (id: string) => ctx.lieutenants.find((l) => l.id === id);
  const leaderOf = (battalionId: string) => ctx.lieutenants.find((l) => l.battalionId === battalionId);

  switch (e.kind) {
    case "THIEF": {
      const b = battalion(e.data.battalionId);
      if (option === 0) {
        mood(-4);
        log.push({ text: "O ladrão foi açoitado diante de todos. Ninguém mais toca nas rações.", tone: "info" });
      } else if (option === 1) {
        ctx.rations = Math.max(0, ctx.rations - 5);
        mood(2);
        honor(1);
        log.push({ text: "O Comandante perdoou o ladrão de rações; os soldados comentam a clemência.", tone: "good" });
      } else if (b) {
        b.soldiers = Math.max(0, b.soldiers - 1);
        honor(2);
        log.push({ text: `O ladrão foi expulso das ${b.name}.`, tone: "info" });
      }
      break;
    }
    case "TENT_DISPUTE": {
      if (option === 0) {
        const vet = e.data.vet;
        const other = vet === e.data.a ? e.data.b : e.data.a;
        const lv = leaderOf(vet);
        const lo = leaderOf(other);
        if (lv) loyalty.push({ id: lv.id, delta: 5 });
        if (lo) loyalty.push({ id: lo.id, delta: -5 });
        log.push({ text: `A barraca seca ficou com os veteranos (${battalion(vet)?.name ?? "?"}).`, tone: "info" });
      } else if (option === 1) {
        mood(1);
        log.push({ text: "A disputa da barraca foi decidida na sorte; todo mundo riu.", tone: "info" });
      } else {
        ctx.gold -= 20;
        mood(4);
        log.push({ text: "O Comandante comprou lona nova: barraca seca para todos (−20 de ouro).", tone: "good" });
      }
      break;
    }
    case "DESERTER_RETURNS": {
      const b = battalion(e.data.battalionId);
      if (option <= 1 && b) {
        b.soldiers = Math.min(b.maxSoldiers, b.soldiers + 1);
        if (option === 0) {
          mood(1);
          honor(1);
        } else mood(-2);
        log.push({ text: `O desertor arrependido voltou às ${b.name}${option === 1 ? ", com as costas marcadas" : ""}.`, tone: "info" });
      } else {
        log.push({ text: "O desertor foi mandado embora pela estrada.", tone: "info" });
      }
      break;
    }
    case "BRAWL": {
      const a = lt(e.data.a);
      const b = lt(e.data.b);
      const key = bondKey(e.data.a, e.data.b);
      if (option === 0 || option === 1) {
        const [punished, other] = option === 0 ? [a, b] : [b, a];
        if (punished) loyalty.push({ id: punished.id, delta: -10 });
        if (other) loyalty.push({ id: other.id, delta: 5 });
        ctx.bonds[key] = Math.max(-100, (ctx.bonds[key] ?? 0) - 5);
        log.push({ text: `${punished?.name ?? "?"} foi punido pela briga com ${other?.name ?? "?"}.`, tone: "bad" });
      } else {
        mood(3);
        ctx.bonds[key] = Math.max(-100, (ctx.bonds[key] ?? 0) - 10);
        const loser = Math.random() < 0.5 ? a : b;
        if (loser) loyalty.push({ id: loser.id, delta: -5 });
        log.push({ text: `${a?.name ?? "?"} e ${b?.name ?? "?"} resolveram no braço; ${loser?.name ?? "?"} levou a pior.`, tone: "bad" });
      }
      break;
    }
    case "CAMARADERIE": {
      const gain = option === 0 ? 5 : 3;
      if (option === 0) ctx.gold -= 15;
      mood(option === 0 ? 4 : 2);
      for (const id of [e.data.a, e.data.b]) loyalty.push({ id, delta: gain });
      ctx.bonds[bondKey(e.data.a, e.data.b)] = Math.min(100, (ctx.bonds[bondKey(e.data.a, e.data.b)] ?? 0) + 5);
      log.push({ text: `Uma noite de histórias com ${lt(e.data.a)?.name ?? "?"} e ${lt(e.data.b)?.name ?? "?"} na fogueira.`, tone: "good" });
      break;
    }
    case "VICTORY_FEAST": {
      if (option === 0) {
        ctx.gold -= 25;
        mood(8);
        log.push({ text: "Um barril de vinho para comemorar a vitória: a festa foi até tarde.", tone: "good" });
      } else {
        mood(-4);
        log.push({ text: "O Comandante negou o vinho da vitória; a tropa resmunga.", tone: "bad" });
      }
      break;
    }
    case "FOLLOWER": {
      const role = e.data.role as FollowerRole;
      if (option === 0 && FOLLOWERS[role]) {
        const f = newFollower(role, ctx.day);
        ctx.followers.push(f);
        log.push({ text: `${f.name} (${FOLLOWERS[role].label.toLowerCase()}) agora segue o bando.`, tone: "good" });
      } else {
        log.push({ text: "O pedido para seguir o bando foi recusado.", tone: "info" });
      }
      break;
    }
    case "PILGRIMS": {
      if (option === 0) {
        ctx.rations = Math.max(0, ctx.rations - 6);
        honor(4);
        mood(1);
        log.push({ text: "Os peregrinos dormiram no acampamento e partiram abençoando o bando.", tone: "good" });
      } else {
        honor(-2);
        log.push({ text: "Os peregrinos foram mandados de volta para a estrada.", tone: "info" });
      }
      break;
    }
    case "ARREARS_GRUMBLE": {
      if (option === 0) {
        mood(3);
        honor(-1);
        log.push({ text: "O Comandante prometeu pagar os atrasados com juros. Por ora, as rodinhas se desfazem.", tone: "info" });
      } else if (option === 1) {
        const part = Math.min(ctx.gold, Number(e.data.part) || 0);
        ctx.gold -= part;
        ctx.debt = Math.max(0, ctx.debt - part);
        mood(6);
        log.push({ text: `Parte dos atrasados foi paga na hora (${part} de ouro).`, tone: "good" });
      } else {
        const b = battalion(e.data.battalionId);
        if (b) b.soldiers = Math.max(0, b.soldiers - 1);
        mood(-6);
        honor(-4);
        log.push({ text: `O agitador das ${b?.name ?? "fileiras"} foi enforcado. Ninguém mais fala em motim — em voz alta.`, tone: "bad" });
      }
      break;
    }
    case "HUNGER_GRUMBLE": {
      if (option === 0) {
        const got = 4 + Math.floor(Math.random() * 9);
        ctx.rations += got;
        if (Math.random() < 0.25) {
          const b = pick(ctx.battalions.filter((x) => x.soldiers > 1));
          if (b) b.soldiers -= 1;
          log.push({ text: `Os caçadores trouxeram ${got} rações, mas um deles não voltou${b ? ` (${b.name})` : ""}.`, tone: "bad" });
        } else {
          log.push({ text: `Os caçadores trouxeram ${got} rações.`, tone: "good" });
        }
      } else if (option === 1) {
        mood(-3);
        log.push({ text: "As rações foram racionadas: meia tigela por homem.", tone: "bad" });
      } else {
        ctx.gold -= 30;
        ctx.rations += 12;
        log.push({ text: "Um mascate de passagem vendeu 12 rações por 30 de ouro.", tone: "info" });
      }
      break;
    }
  }
  ctx.battalions = ctx.battalions.filter((b) => b.soldiers > 0);
  return { ctx, loyalty, log };
}
