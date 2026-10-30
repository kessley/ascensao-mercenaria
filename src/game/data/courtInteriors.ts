import type { GameState } from "../../store/useGameStore";
import { COURT, TRADE } from "../../utils/constants";
import { COURT_EVENT_LABEL } from "../sim/kingdoms";
import { hasCourtEvent } from "../sim/courtEvents";
import { nobleName, scheduleOf, type CourtPlace, type Noble } from "../sim/nobility";
import type { Settlement } from "../sim/realm";
import { STANDING_LABEL, standingIn } from "../sim/reputation";
import { createRng, seedFromText } from "../worldgen/rng";
import { furniture as f, makeRoom, panelAction, townGossip, type InteriorDef, type Npc } from "./interiors";

/**
 * Interiores da capital (Marco 15). O que se vê lá dentro é a corte de verdade: quem está em cada
 * sala sai da rotina de cada nobre (a hora importa), e a Masmorra guarda quem está preso.
 */

const bye = { id: "bye", label: "Com licença." };
const GOLD = 0xe0b040;
const WOOD = 0x6b4a2b;
const DARK = 0x3e2a17;

const hourOf = (s: GameState) => (6 + s.dayProgress * 24) % 24;

/** Quem está numa sala a esta hora. */
export function nobleAtPlace(s: GameState, townId: string, place: CourtPlace): Noble[] {
  const feast = hasCourtEvent(s.courtEvents, townId, "FEAST", s.day);
  return s.nobles.filter((n) => n.alive && n.at === townId && !n.armyId && scheduleOf(n, hourOf(s), s.day, feast) === place);
}

/** Um nobre como figura na sala (a conversa é montada na hora: ver courtTalk). */
function nobleNpc(s: GameState, n: Noble, x: number, y: number, wander = 0): Npc {
  const realm = s.world?.factions.find((r) => r.id === n.factionId)?.name ?? "reino";
  return { id: `noble-${n.id}`, name: nobleName(n, realm), x, y, color: n.female ? 0xd080b0 : 0x8080d0, wander, nobleId: n.id, crown: n.rank === "RULER" || n.rank === "CONSORT", talk: { text: "..." } };
}

function guards(d: InteriorDef, ...at: [number, number][]): void {
  at.forEach(([x, y], i) => d.npcs.push({ id: `guarda${i}`, name: "Guarda real", x, y, color: 0x7f8c8d, talk: { text: i % 2 ? "..." : "Mão longe da espada, por favor." } }));
}

/** Tenda de guerra: o lorde em campanha recebe quem vem em paz (Marco 15). */
export function fieldTent(key: string, s: GameState, nobleId: string): InteriorDef | null {
  const n = s.nobles.find((x) => x.id === nobleId && x.alive);
  if (!n) return null;
  const d = makeRoom(key, `Tenda de guerra · ${n.house}`, "TENT", 560, 400);
  d.furniture.push(f("TABLE", 190, 110, 180, 90, WOOD), f("BED", 440, 40, 80, 120, 0x7a2a22), f("RACK", 40, 40, 30, 120, DARK), f("BANNER", 260, 30, 40, 26, GOLD, false));
  d.npcs.push(nobleNpc(s, n, 280, 240));
  guards(d, [120, 340], [440, 340]);
  return d;
}

export function courtInterior(key: string, s: GameState, t: Settlement, what: string, arg?: string): InteriorDef | null {
  switch (what) {
    case "throne":
      return throne(key, s, t);
    case "council":
      return council(key, s, t);
    case "greathall":
      return greatHall(key, s, t);
    case "royal":
      return royal(key, s, t);
    case "chapel":
      return chapel(key, s, t);
    case "library":
      return library(key, s, t);
    case "armory":
      return armory(key, t);
    case "dungeon":
      return dungeon(key, s, t);
    case "cathedral":
      return cathedral(key, s, t);
    case "arena":
      return arena(key, s, t);
    case "thieves":
      return thieves(key, s, t);
    case "inn":
      return inn(key, s, t);
    case "sewer":
      return sewer(key, t);
    case "palace":
      return palace(key, s, t, Number(arg ?? 0));
  }
  return null;
}

function throne(key: string, s: GameState, t: Settlement): InteriorDef {
  const own = t.owner === "PLAYER";
  const d = makeRoom(key, `Sala do Trono de ${t.name}`, "STONE", 960, 780, { settlementId: t.id });
  d.furniture.push(f("CARPET", 420, 130, 120, 620, 0x7a2a22, false), f("CARPET", 330, 26, 300, 100, 0x4a2a7a, false), f("TABLE", 448, 40, 64, 62, GOLD), f("BANNER", 200, 30, 50, 34, GOLD, false), f("BANNER", 710, 30, 50, 34, GOLD, false));
  for (let i = 0; i < 4; i++) d.furniture.push(f("TABLE", 280, 170 + i * 150, 44, 44, 0x77716a), f("TABLE", 636, 170 + i * 150, 44, 44, 0x77716a));
  guards(d, [330, 110], [630, 110], [350, 720], [610, 720]);
  const here = nobleAtPlace(s, t.id, "THRONE");
  const ruler = here.find((n) => n.rank === "RULER");
  if (ruler) d.npcs.push(nobleNpc(s, ruler, 480, 150));
  const consort = here.find((n) => n.rank === "CONSORT");
  if (consort) d.npcs.push(nobleNpc(s, consort, 560, 150));
  here.filter((n) => n !== ruler && n !== consort).slice(0, 8).forEach((n, i) => d.npcs.push(nobleNpc(s, n, i % 2 ? 730 : 230, 220 + Math.floor(i / 2) * 110, 26)));
  if (own) {
    d.spots.push({ x: 480, y: 150, label: "Trono", talk: { text: "O trono é do Comandante agora. O reino espera ordens.", options: [{ id: panelAction({ kind: "TOWN", settlementId: t.id, at: "HALL" }), label: "Governar a cidade" }, bye] } });
  } else if (!ruler) {
    d.spots.push({ x: 480, y: 150, label: "Trono vazio", talk: { text: "Depois do meio-dia, a coroa vai ao conselho e aos jardins. Só os guardas ficam aqui." } });
  }
  return d;
}

function council(key: string, s: GameState, t: Settlement): InteriorDef {
  const d = makeRoom(key, `Sala do Conselho de ${t.name}`, "STONE", 720, 520, { settlementId: t.id });
  d.furniture.push(f("TABLE", 200, 150, 320, 150, WOOD), f("BOARD", 280, 26, 160, 30, 0x4a3a22, false));
  const here = nobleAtPlace(s, t.id, "COUNCIL");
  here.slice(0, 6).forEach((n, i) => d.npcs.push(nobleNpc(s, n, 180 + (i % 3) * 180, i < 3 ? 120 : 340)));
  const f0 = s.factions.find((x) => x.id === t.owner);
  const st = standingIn(s, t.owner);
  d.spots.push({
    x: 360,
    y: 330,
    label: "Mapa de guerra",
    talk: { text: st >= 3 && f0?.plan ? `Peças de madeira sobre o mapa. Plano do reino: ${f0.plan.reason}.` : "Assim que o Comandante chega perto, um escrivão cobre o mapa com um pano." },
  });
  return d;
}

function greatHall(key: string, s: GameState, t: Settlement): InteriorDef {
  const d = makeRoom(key, `Grande Salão de ${t.name}`, "WOOD", 1000, 620, { settlementId: t.id });
  d.furniture.push(f("TABLE", 330, 50, 340, 60, WOOD), f("FIRE", 880, 40, 80, 60, 0xb0401a), f("FIRE", 40, 40, 80, 60, 0xb0401a));
  for (let i = 0; i < 2; i++) d.furniture.push(f("TABLE", 200 + i * 400, 200, 200, 300, WOOD));
  const here = nobleAtPlace(s, t.id, "GREAT_HALL");
  here.slice(0, 12).forEach((n, i) => d.npcs.push(nobleNpc(s, n, i < 4 ? 380 + i * 80 : 170 + ((i - 4) % 4) * 200, i < 4 ? 130 : 180 + ((i - 4) % 2) * 340)));
  const ev = s.courtEvents.find((e) => e.townId === t.id && e.day === s.day && e.kind !== "TOURNAMENT");
  if (ev) d.spots.push({ x: 500, y: 560, label: "Lugar à mesa", talk: { text: `${COURT_EVENT_LABEL[ev.kind]}! O lugar diz quem o senhor é aqui: ${STANDING_LABEL[standingIn(s, t.owner)]}.`, options: [{ id: `court:attend:${ev.id}`, label: "Tomar o seu lugar e prestar homenagem" }, bye] } });
  else if (here.length === 0) d.spots.push({ x: 500, y: 560, label: "Mesas vazias", talk: { text: "Os criados varrem o salão. O almoço da corte é ao meio-dia." } });
  return d;
}

function royal(key: string, s: GameState, t: Settlement): InteriorDef {
  const d = makeRoom(key, `Aposentos Reais de ${t.name}`, "STONE", 760, 540, { settlementId: t.id });
  d.furniture.push(f("CARPET", 200, 120, 360, 280, 0x2a4a7a, false), f("BED", 560, 60, 150, 110, 0x7a2a22), f("CHEST", 60, 60, 80, 50, DARK), f("TABLE", 280, 200, 200, 90, WOOD));
  const here = nobleAtPlace(s, t.id, "ROYAL");
  here.slice(0, 7).forEach((n, i) => d.npcs.push(nobleNpc(s, n, 200 + (i % 4) * 130, 380 + Math.floor(i / 4) * 60, 20)));
  guards(d, [120, 470], [640, 470]);
  return d;
}

function chapel(key: string, s: GameState, t: Settlement): InteriorDef {
  const d = makeRoom(key, `Capela Real de ${t.name}`, "TEMPLE", 460, 520, { settlementId: t.id });
  d.furniture.push(f("ALTAR", 180, 40, 100, 44, 0xd9d2bf), f("CARPET", 205, 90, 50, 340, 0x7a2a22, false));
  for (let i = 0; i < 3; i++) d.furniture.push(f("BENCH", 60, 170 + i * 80, 120, 22, WOOD), f("BENCH", 280, 170 + i * 80, 120, 22, WOOD));
  nobleAtPlace(s, t.id, "CHAPEL").slice(0, 4).forEach((n, i) => d.npcs.push(nobleNpc(s, n, 120 + (i % 2) * 220, 140 + Math.floor(i / 2) * 90)));
  return d;
}

function library(key: string, s: GameState, t: Settlement): InteriorDef {
  const d = makeRoom(key, `Biblioteca Real de ${t.name}`, "WOOD", 680, 500, { settlementId: t.id });
  for (let i = 0; i < 5; i++) d.furniture.push(f("RACK", 40 + i * 130, 40, 100, 30, DARK));
  d.furniture.push(f("TABLE", 240, 240, 200, 80, WOOD));
  const history = s.world?.history ?? [];
  const pick = history.slice(-4).map((h) => `Ano ${h.year}: ${h.text}`).join(" ");
  d.spots.push({ x: 340, y: 340, label: "Crônica do reino", talk: { text: pick || "Páginas em branco." } });
  const fam = s.nobles.filter((n) => n.alive && n.factionId === t.owner && (n.rank === "RULER" || n.rank === "HEIR" || n.rank === "CHILD"));
  d.spots.push({ x: 120, y: 100, label: "Genealogia da casa real", talk: { text: fam.map((n) => `${nobleName(n, "Reino")} (${n.age} anos)`).join("; ") || "A árvore da família acaba aqui." } });
  nobleAtPlace(s, t.id, "LIBRARY").slice(0, 3).forEach((n, i) => d.npcs.push(nobleNpc(s, n, 150 + i * 190, 200)));
  return d;
}

function armory(key: string, t: Settlement): InteriorDef {
  const d = makeRoom(key, `Arsenal Real de ${t.name}`, "STONE", 620, 460, { settlementId: t.id });
  for (let i = 0; i < 4; i++) d.furniture.push(f("RACK", 40 + i * 150, 50, 100, 34, DARK));
  d.npcs.push({ id: "armeiro", name: "Armeiro real", x: 310, y: 200, color: 0x5a4a3a, talk: { text: "Vassalos da coroa têm direito a ferro do arsenal, uma vez por estação.", options: [{ id: `court:armory:${t.owner}`, label: "Levar a cota de ferro" }, bye] } });
  return d;
}

/** Masmorra: os presos de verdade, em celas. Entra-se pela porta do castelo ou pelos esgotos. */
function dungeon(key: string, s: GameState, t: Settlement): InteriorDef {
  const d = makeRoom(key, `Masmorra de ${t.name}`, "STONE", 820, 520, { settlementId: t.id });
  for (let i = 0; i < 5; i++) d.furniture.push(f("TABLE", 40 + i * 155, 40, 12, 150, 0x444444), f("TABLE", 40 + i * 155, 190, 110, 12, 0x444444));
  const prisoners = s.nobles.filter((n) => n.alive && n.captiveOf && n.at === t.id);
  prisoners.slice(0, 5).forEach((n, i) => d.npcs.push(nobleNpc(s, n, 100 + i * 155, 110)));
  d.npcs.push({ id: "carcereiro", name: "Carcereiro", x: 410, y: 300, color: 0x4a4a3a, talk: { text: prisoners.length > 0 ? "Quer pagar o resgate? Fale com o preso, e ele fala com quem paga." : "Celas vazias. O reino anda calmo, ou anda matando em vez de prender." } });
  d.spots.push({ x: 60, y: 460, label: "Bueiro", talk: { text: "Uma grade solta. Dá para os esgotos e, de lá, para o Bairro Baixo.", options: [{ id: "cityleave:SEWER", label: "Descer pelo bueiro" }, bye] } });
  return d;
}

function cathedral(key: string, s: GameState, t: Settlement): InteriorDef {
  const d = makeRoom(key, `Catedral de ${t.name}`, "TEMPLE", 900, 760, { settlementId: t.id });
  d.furniture.push(f("ALTAR", 390, 50, 120, 54, 0xd9d2bf), f("CARPET", 420, 110, 60, 590, 0x7a2a22, false));
  for (let i = 0; i < 7; i++) d.furniture.push(f("BENCH", 120, 170 + i * 76, 260, 24, WOOD), f("BENCH", 520, 170 + i * 76, 260, 24, WOOD));
  const here = nobleAtPlace(s, t.id, "CATHEDRAL");
  here.slice(0, 8).forEach((n, i) => d.npcs.push(nobleNpc(s, n, n.office === "PRIEST" ? 450 : 80 + (i % 2) * 740, n.office === "PRIEST" ? 130 : 200 + i * 60)));
  const rite = s.courtEvents.find((e) => e.townId === t.id && e.day === s.day && e.kind !== "TOURNAMENT" && e.kind !== "FEAST");
  if (rite) d.spots.push({ x: 450, y: 660, label: COURT_EVENT_LABEL[rite.kind], talk: { text: "A cerimônia enche a nave: incenso, sinos e todas as casas do reino.", options: [{ id: `court:attend:${rite.id}`, label: "Assistir e prestar homenagem" }, bye] } });
  d.spots.push({ x: 450, y: 740, label: "Caixa de esmolas", talk: { text: "Moedas caem com um som que todo mundo escuta.", options: [{ id: `court:pray:20`, label: "Dar 20 de ouro" }, { id: `court:pray:60`, label: "Dar 60 de ouro" }, bye] } });
  return d;
}

function arena(key: string, s: GameState, t: Settlement): InteriorDef {
  const d = makeRoom(key, `Liça de ${t.name}`, "TENT", 760, 520, { settlementId: t.id });
  d.furniture.push(f("HAY", 100, 90, 560, 300, 0xd8c070, false), f("BENCH", 100, 40, 560, 30, WOOD));
  const ev = s.courtEvents.find((e) => e.townId === t.id && e.kind === "TOURNAMENT" && e.day === s.day);
  const next = s.courtEvents.find((e) => e.townId === t.id && e.kind === "TOURNAMENT" && e.day >= s.day);
  const options: { id: string; label: string }[] = [];
  if (ev && s.fame >= COURT.TOURNAMENT_FAME_MIN) {
    options.push({ id: `court:bet:${ev.id}:0`, label: `Entrar no torneio (bolsa de ${ev.purse ?? 0} de ouro)` }, { id: `court:bet:${ev.id}:50`, label: "Entrar e apostar 50 de ouro em si mesmo (paga 3 para 1)" });
  }
  options.push(bye);
  d.npcs.push({
    id: "mestre",
    name: "Mestre da Liça",
    x: 380,
    y: 440,
    color: 0xc0a040,
    talk: {
      text: ev
        ? s.fame >= COURT.TOURNAMENT_FAME_MIN
          ? `Hoje é dia de torneio! Três rodadas: quem cair, sai. (Fama ${Math.round(s.fame)})`
          : "Torneio é para quem tem nome. Volte quando alguém souber quem é o senhor."
        : next
          ? `O próximo torneio é no dia ${next.day}. Treine até lá.`
          : "Sem torneio à vista. Os arautos anunciam com dias de antecedência.",
      options,
    },
  });
  nobleAtPlace(s, t.id, "ARENA").slice(0, 5).forEach((n, i) => d.npcs.push(nobleNpc(s, n, 160 + i * 110, 60)));
  return d;
}

/** Casa do Rato: disfarce, carta falsa e o caminho dos esgotos (a saída de quem não tem nome). */
function thieves(key: string, s: GameState, t: Settlement): InteriorDef {
  const r = createRng(seedFromText(`${key}:${s.day}`)).next;
  const d = makeRoom(key, "Casa do Rato", "WOOD", 560, 420, { settlementId: t.id });
  d.furniture.push(f("TABLE", 200, 150, 160, 70, DARK), f("CRATE", 40, 40, 50, 50, 0x7a5a3a), f("CRATE", 96, 40, 50, 50, 0x6a4a2a), f("CHEST", 460, 60, 60, 40, DARK));
  d.npcs.push({
    id: "rato",
    name: "A Ratazana",
    x: 280,
    y: 120,
    color: 0x6a5a4a,
    talk: {
      text: "Quem tem nome entra pela porta da frente. Quem não tem, fala comigo. Tudo aqui custa, e nada aqui existe.",
      options: [
        { id: "court:disguise", label: `Libré de criado da corte (${COURT.DISGUISE_GOLD} de ouro): passa por portões e guardas por algumas horas` },
        { id: "court:forge", label: `Carta de apresentação falsa (${COURT.FORGED_LETTER_GOLD} de ouro)` },
        bye,
      ],
    },
  });
  d.npcs.push({ id: "ladrao", name: "Ladrão", x: 120, y: 280, color: 0x5a4a3a, wander: 24, talk: { text: r() < 0.5 ? "À noite, a guarda do Bairro Nobre dorme em pé. Os esgotos dão no jardim." : "Os bueiros do Bairro Baixo vão dar na masmorra. Ninguém volta contando, mas é verdade." } });
  return d;
}

/** Estalagem: dormir (o tempo passa e a corte muda de lugar) e ouvir o que se diz na cidade. */
function inn(key: string, s: GameState, t: Settlement): InteriorDef {
  const r = createRng(seedFromText(`${key}:${s.day}`)).next;
  const d = makeRoom(key, "Estalagem do Portão Velho", "WOOD", 640, 460, { settlementId: t.id });
  d.furniture.push(f("COUNTER", 60, 80, 220, 36, WOOD), f("FIRE", 520, 40, 80, 60, 0xb0401a));
  for (let i = 0; i < 3; i++) d.furniture.push(f("TABLE", 90 + i * 170, 240, 90, 50, WOOD));
  d.npcs.push({
    id: "dona",
    name: "Estalajadeira",
    x: 170,
    y: 56,
    color: 0xb08a68,
    talk: {
      text: `Quarto limpo por 5 de ouro. Quer ouvir as notícias de longe? Uma rodada abre a boca de todo mundo.`,
      options: [
        { id: "cityrest", label: "Alugar um quarto e dormir até o amanhecer (5 de ouro)" },
        { id: `round:${t.id}`, label: `Pagar uma rodada (${TRADE.TAVERN_ROUND} de ouro): notícias e preços` },
        bye,
      ],
    },
  });
  const gossip = townGossip(s, t, r);
  for (let i = 0; i < 3; i++) d.npcs.push({ id: `h${i}`, name: "Viajante", x: 130 + i * 170, y: 330, color: 0xa88a6a, wander: 18, talk: { text: gossip[i % gossip.length] } });
  return d;
}

/** Esgotos: um túnel que junta o Bairro Baixo, o jardim do Bairro Nobre e a masmorra do castelo. */
function sewer(key: string, t: Settlement): InteriorDef {
  const d = makeRoom(key, `Esgotos de ${t.name}`, "STONE", 900, 380, { settlementId: t.id });
  d.furniture.push(f("CARPET", 20, 150, 860, 90, 0x2a4a3a, false));
  d.spots.push(
    { x: 120, y: 120, label: "Grade do Bairro Nobre", talk: { text: "Uma escada de ferro sobe até um jardim que cheira a rosas.", options: [{ id: "cityleave:NOBLE", label: "Subir" }, bye] } },
    { x: 760, y: 120, label: "Grade da masmorra", talk: { text: "Ferrugem, escuridão e um gemido lá em cima.", options: [{ id: "cityenter:dungeon", label: "Subir" }, bye] } },
  );
  d.npcs.push({ id: "rato", name: "Rato enorme", x: 460, y: 200, color: 0x4a3a2a, wander: 60, talk: { text: "..." } });
  return d;
}

/** Palácio de uma casa: o lorde, a família, o mordomo e a escrivaninha. */
function palace(key: string, s: GameState, t: Settlement, index: number): InteriorDef {
  const lords = s.nobles.filter((n) => n.alive && n.rank === "LORD" && (n.factionId === t.owner || n.at === t.id));
  const lord = lords[index];
  const house = lord?.house ?? "Casa vazia";
  const d = makeRoom(key, lord ? `Palácio da ${house}` : "Palácio fechado", "STONE", 760, 520, { settlementId: t.id });
  d.furniture.push(f("CARPET", 300, 100, 160, 330, 0x4a2a7a, false), f("TABLE", 80, 80, 150, 70, WOOD), f("BED", 560, 60, 130, 90, 0x7a2a22), f("BANNER", 360, 30, 40, 28, GOLD, false));
  if (!lord) {
    d.spots.push({ x: 380, y: 300, label: "Lençóis sobre os móveis", talk: { text: "A casa está vazia. A família deve ter caído em desgraça." } });
    return d;
  }
  const hour = hourOf(s);
  const feast = hasCourtEvent(s.courtEvents, t.id, "FEAST", s.day);
  const family = s.nobles.filter((n) => n.alive && n.house === lord.house && n.at === t.id);
  const home = family.filter((n) => scheduleOf(n, hour, s.day, feast) === "PALACE");
  home.slice(0, 5).forEach((n, i) => d.npcs.push(nobleNpc(s, n, 300 + i * 80, 240 + (i % 2) * 60, 16)));
  const has = s.quests.some((q) => q.kind === "SPY" && q.targetId === lord.id && !q.ready);
  d.npcs.push({ id: "mordomo", name: "Mordomo", x: 240, y: 440, color: 0x7a6a5a, talk: { text: home.length > 0 ? "A família está em casa. Não toque nas pratas." : "A família saiu. Só a criadagem está em casa." } });
  d.spots.push({
    x: 155,
    y: 170,
    label: "Escrivaninha",
    talk: { text: "Pilhas de cartas com o selo da casa.", options: has || lord.opinion < 0 ? [{ id: `court:copy:${lord.id}`, label: "Ler e copiar as cartas" }, bye] : [bye] },
  });
  return d;
}
