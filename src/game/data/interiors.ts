import type { CampPanel, GameState } from "../../store/useGameStore";
import { fullName } from "./lieutenants";
import { hasFollower } from "../sim/campEvents";
import { isSick, isFactionOwner, inRevolt, type Settlement } from "../sim/realm";
import { freightOf } from "../sim/trade";
import { GOODS, GOOD_LIST, TRADE, TROOPS, type Good, type TroopType } from "../../utils/constants";
import { dailyRations } from "../../utils/economy";
import { createRng, seedFromText } from "../worldgen/rng";
import type { Point } from "../../utils/math";

/**
 * Interiores (Marco 14): cada estrutura do acampamento e dos povoados tem um "lado de dentro",
 * como num mapa de Pokémon. O Comandante entra pela porta e anda numa sala com móveis e gente
 * de verdade, que mostra o estado do bando e da cidade: sacos de comida na Intendência
 * conforme as rações, soldados nos catres conforme o batalhão (feridos enfaixados, doentes),
 * fregueses na taverna conforme a prosperidade, moradores que falam da fome e dos preços.
 * Função pura do estado do jogo: a cena só desenha e trata as escolhas.
 */

export type InteriorStyle = "TENT" | "WOOD" | "STONE" | "TEMPLE";

export type FurnitureKind =
  | "TABLE"
  | "BED"
  | "BARREL"
  | "CRATE"
  | "SACK"
  | "FIRE"
  | "ANVIL"
  | "ALTAR"
  | "RACK"
  | "HORSE"
  | "BENCH"
  | "COUNTER"
  | "CHEST"
  | "BOARD"
  | "HAY"
  | "CARPET"
  | "BANNER"
  | "IRON";

export interface Furniture {
  x: number;
  y: number;
  w: number;
  h: number;
  kind: FurnitureKind;
  color: number;
  /** Bloqueia a passagem. */
  solid: boolean;
}

/** Fala de alguém (ou de um objeto): o texto e as respostas possíveis (ids tratados pela cena). */
export interface Talk {
  text: string;
  options?: { id: string; label: string }[];
}

export interface Npc {
  id: string;
  name: string;
  x: number;
  y: number;
  color: number;
  /** Soldado do bando (desenhado como as tropas) e o tipo dele. */
  troop?: TroopType;
  /** Anda um pouco em volta do lugar dele. */
  wander?: number;
  mark?: "WOUNDED" | "SICK" | "SLEEP";
  talk: Talk;
}

/** Ponto de interação num objeto (mesa de estratégia, quadro de preços, cama...). */
export interface Spot {
  x: number;
  y: number;
  label: string;
  talk: Talk;
}

export interface InteriorDef {
  key: string;
  title: string;
  style: InteriorStyle;
  w: number;
  h: number;
  furniture: Furniture[];
  npcs: Npc[];
  spots: Spot[];
  /** Tapete da porta (sair) e onde o Comandante aparece ao entrar. */
  door: Point;
  spawn: Point;
  settlementId?: string;
}

/** Id de ação que abre um painel. */
export const panelAction = (p: CampPanel) => `panel:${JSON.stringify(p)}`;

const C = {
  WOOD: 0x6b4a2b,
  DARK: 0x3e2a17,
  CANVAS: 0xc9b48a,
  CLOTH: 0x8e2b22,
  STONE: 0x77716a,
  IRON: 0x8fa6b8,
  SACK: 0xc9a86a,
  STRAW: 0xd8c070,
  GOLD: 0xe0b040,
  TOWNSFOLK: [0xc8a070, 0x9a7a5a, 0xb08a68, 0xd0b090, 0x8a6a50],
};

const room = (key: string, title: string, style: InteriorStyle, w: number, h: number, extra?: Partial<InteriorDef>): InteriorDef => ({
  key,
  title,
  style,
  w,
  h,
  furniture: [],
  npcs: [],
  spots: [],
  door: { x: w / 2, y: h - 18 },
  spawn: { x: w / 2, y: h - 70 },
  ...extra,
});

const f = (kind: FurnitureKind, x: number, y: number, w: number, h: number, color: number, solid = true): Furniture => ({ kind, x, y, w, h, color, solid });
const bye = { id: "bye", label: "Até mais." };
const pick = <T>(r: () => number, list: readonly T[]): T => list[Math.floor(r() * list.length)];

/** Constrói o interior pela chave ("camp:TENT", "camp:Q:<batalhão>", "town:<id>:hall"...). */
export function buildInterior(key: string, s: GameState): InteriorDef | null {
  const parts = key.split(":");
  if (parts[0] === "camp") {
    if (parts[1] === "Q") return quarters(key, s, parts[2]);
    return campSite(key, s, parts[1]);
  }
  if (parts[0] === "town") {
    const t = s.settlements.find((x) => x.id === parts[1]);
    if (!t || t.owner === "RUINED") return null;
    switch (parts[2]) {
      case "hall":
        return hall(key, s, t);
      case "tavern":
        return tavern(key, s, t);
      case "guild":
        return guild(key, s, t);
      case "temple":
        return temple(key, s, t);
      case "house":
        return house(key, s, t, Number(parts[3] ?? 0));
    }
  }
  return null;
}

// --- Acampamento ---

function soldierLine(s: GameState, r: () => number): string {
  const lines: string[] = [];
  if (s.hungryDays > 0) lines.push("Faz dias que a gente só masca couro. Cadê a comida, Comandante?", "Com fome ninguém segura lança.");
  if (s.arrearsWeeks > 0) lines.push("O soldo atrasou de novo. Tem gente falando em ir embora...", "Promessa não enche a bolsa.");
  if (s.campMood >= 10) lines.push("Que farra ontem! Um brinde ao Comandante!", "Assim dá gosto servir.");
  if (s.campMood <= -10) lines.push("Esse acampamento está um velório.", "Tem algo podre no ar, e não é a comida.");
  if (s.lastVictoryDay !== null && s.day - s.lastVictoryDay <= 2) lines.push("Viu como eles correram? Hahaha!", "Mais uma vitória dessas e eu compro uma fazenda.");
  if (s.aleRation) lines.push("A cerveja da semana é o que me segura aqui.");
  if (lines.length === 0) lines.push("Tudo calmo, Comandante.", "Afiando a lâmina, como sempre.", "Dizem que o inverno vai ser duro.", "Quando é a próxima marcha?");
  return pick(r, lines);
}

function campSite(key: string, s: GameState, kind: string): InteriorDef | null {
  const r = createRng(seedFromText(`${key}:${s.day}`)).next;
  switch (kind) {
    case "TENT": {
      const d = room(key, "Tenda do Comandante", "TENT", 620, 440);
      d.furniture.push(
        f("CARPET", 150, 110, 320, 210, 0x7a2a22, false),
        f("TABLE", 220, 160, 180, 100, C.WOOD),
        f("BED", 470, 70, 110, 60, 0x8a6a4a),
        f("CHEST", 40, 60, 70, 46, C.DARK),
        f("TABLE", 40, 250, 80, 60, C.WOOD),
        f("BANNER", 290, 30, 40, 26, C.GOLD, false),
      );
      d.spots.push(
        { x: 310, y: 280, label: "Mesa de estratégia", talk: { text: "O mapa do continente, os contratos oferecidos e os relatórios dos reinos estão sobre a mesa.", options: [{ id: panelAction({ kind: "TENT" }), label: "Estudar a mesa (contratos, diplomacia, exército)" }, bye] } },
        { x: 80, y: 340, label: "Livro de Preços", talk: { text: "O livro onde o escrivão anota os preços de cada mercado — e de quando é cada notícia.", options: [{ id: panelAction({ kind: "PRICE_BOOK" }), label: "Abrir o Livro de Preços" }, bye] } },
        { x: 525, y: 160, label: "Catre do Comandante", talk: { text: "Uma noite de sono faz bem a todos.", options: [{ id: "rest", label: "Descansar até o amanhecer" }, bye] } },
        { x: 75, y: 130, label: "Baú", talk: { text: "Os papéis do bando: crônicas, contas e mapas antigos.", options: [{ id: panelAction({ kind: "GAME" }), label: "Salvar ou carregar a campanha" }, bye] } },
      );
      // Os tenentes em volta da mesa
      s.lieutenants.slice(0, 4).forEach((l, i) => {
        const b = s.battalions.find((x) => x.id === l.battalionId);
        const mood = l.loyalty >= 70 ? "Conte comigo, Comandante." : l.loyalty >= 40 ? "Estou aqui. Por enquanto." : "Precisamos conversar sobre os rumos deste bando.";
        d.npcs.push({
          id: `lt-${l.id}`,
          name: fullName(l),
          x: 190 + (i % 2) * 240,
          y: 140 + Math.floor(i / 2) * 150,
          color: 0xdfe3ee,
          troop: "INFANTRY",
          wander: 12,
          talk: { text: `${mood}${b ? ` (${b.name})` : " Ainda sem batalhão."}`, options: [{ id: panelAction({ kind: "LIEUTENANT", lieutenantId: l.id }), label: "Ver a ficha" }, bye] },
        });
      });
      return d;
    }
    case "QUARTERMASTER": {
      const d = room(key, "Intendência", "TENT", 640, 420);
      d.furniture.push(f("COUNTER", 200, 250, 240, 36, C.WOOD));
      // Sacos de comida conforme as rações; barris de cerveja; caixotes de mercadoria
      const sacks = Math.min(24, Math.ceil(s.rations / 15));
      for (let i = 0; i < sacks; i++) d.furniture.push(f("SACK", 40 + (i % 8) * 34, 40 + Math.floor(i / 8) * 40, 28, 32, C.SACK));
      const ale = Math.min(6, s.depot.ALE ?? 0);
      for (let i = 0; i < ale; i++) d.furniture.push(f("BARREL", 380 + (i % 3) * 40, 40 + Math.floor(i / 3) * 42, 32, 32, 0x7a4a24));
      const goods = GOOD_LIST.filter((g) => g !== "ALE" && g !== "HORSES" && (s.depot[g] ?? 0) > 0).slice(0, 6);
      goods.forEach((g, i) => d.furniture.push(f("CRATE", 520 + (i % 2) * 44, 40 + Math.floor(i / 2) * 44, 38, 38, parseInt(GOODS[g].color.slice(1), 16))));
      const need = dailyRations(s.battalions, s.followers);
      const days = need > 0 ? Math.floor(s.rations / need) : 99;
      d.npcs.push({
        id: "qm",
        name: "Intendente",
        x: 320,
        y: 225,
        color: 0xa0784a,
        troop: "INFANTRY",
        talk: {
          text:
            days <= 2
              ? `Comandante, o depósito está no fim: ${s.rations} rações, comida para ${days} dia(s). Ou compramos, ou a tropa vai passar fome.`
              : `Temos ${s.rations} rações no depósito — ${days} dias de comida para o bando inteiro. ${s.cargo > 0 ? `As carroças levam mais ${s.cargo}.` : ""}`,
          options: [{ id: panelAction({ kind: "QUARTERMASTER" }), label: "Rações, carroças e mercadorias" }, bye],
        },
      });
      if (s.hungryDays > 0 || days <= 1) {
        for (let i = 0; i < 3; i++) d.npcs.push({ id: `q${i}`, name: "Soldado na fila", x: 280 + i * 30, y: 330 + (i % 2) * 14, color: 0x2f6fdf, troop: "INFANTRY", talk: { text: "Na fila desde cedo. Dizem que não tem pão." } });
      }
      return d;
    }
    case "RECRUIT": {
      const d = room(key, "Posto de Recrutamento", "TENT", 560, 400);
      d.furniture.push(f("TABLE", 200, 120, 160, 60, C.WOOD), f("RACK", 40, 40, 30, 120, C.DARK), f("BANNER", 260, 30, 40, 26, C.GOLD, false));
      d.npcs.push({ id: "sgt", name: "Sargento recrutador", x: 280, y: 100, color: 0x2f6fdf, troop: "INFANTRY", talk: { text: "Gente querendo soldo não falta. Ouro é que falta, às vezes.", options: [{ id: panelAction({ kind: "RECRUIT" }), label: "Recrutar e contratar tenentes" }, bye] } });
      s.lieutenantCandidates.forEach((l, i) =>
        d.npcs.push({ id: `cand-${l.id}`, name: fullName(l), x: 140 + i * 280, y: 250, color: 0xdfe3ee, troop: "INFANTRY", wander: 20, talk: { text: `${l.backstory} Peço ${l.hireCost} de ouro e ${l.wage} por semana.`, options: [{ id: panelAction({ kind: "RECRUIT" }), label: "Ver os candidatos" }, bye] } }),
      );
      for (let i = 0; i < 3; i++) d.npcs.push({ id: `rec${i}`, name: "Rapaz da aldeia", x: 120 + i * 50, y: 320, color: C.TOWNSFOLK[i], wander: 30, talk: { text: pick(r, ["Dizem que aqui se come todo dia.", "Meu pai foi soldado. Morreu soldado.", "Quanto paga?"]) } });
      return d;
    }
    case "FORGE": {
      const d = room(key, "Ferraria", "WOOD", 560, 400);
      d.furniture.push(f("FIRE", 60, 50, 90, 70, 0xb0401a), f("ANVIL", 230, 150, 60, 34, 0x444444), f("RACK", 460, 40, 40, 160, C.DARK), f("BARREL", 120, 260, 36, 36, 0x4a5a6a));
      const bars = Math.min(16, Math.ceil(s.iron / 2));
      for (let i = 0; i < bars; i++) d.furniture.push(f("IRON", 330 + (i % 4) * 26, 250 + Math.floor(i / 4) * 16, 22, 10, C.IRON, false));
      d.spots.push({ x: 380, y: 330, label: "Barras de ferro", talk: { text: `${s.iron} de ferro na pilha. Cada peça boa de armadura come ferro que nem soldado come pão.` } });
      d.npcs.push({ id: "smith", name: "Ferreiro do bando", x: 260, y: 120, color: 0x5a4a3a, troop: "INFANTRY", talk: { text: s.iron >= 3 ? "Tenho ferro para trabalhar. O que vamos forjar?" : "Sem ferro, Comandante, eu só conserto o que já existe.", options: [{ id: panelAction({ kind: "FORGE" }), label: "Forjar equipamento" }, bye] } });
      if (hasFollower(s.followers, "SMITH")) d.npcs.push({ id: "helper", name: "Ajudante de ferreiro", x: 140, y: 150, color: 0x8a6a4a, wander: 20, talk: { text: "Com dois martelos, sai mais barato. O mestre que o diga." } });
      return d;
    }
    case "STABLE": {
      const d = room(key, "Estábulo", "WOOD", 640, 400);
      const horses = (s.depot.HORSES ?? 0) + s.scouts.length + s.messengers.length;
      for (let i = 0; i < 8; i++) {
        d.furniture.push(f("HAY", 30 + i * 74, 40, 64, 80, C.STRAW, false));
        if (i < horses) d.furniture.push(f("HORSE", 42 + i * 74, 55, 40, 50, 0x7a5030));
      }
      d.npcs.push({
        id: "groom",
        name: "Cavalariço",
        x: 320,
        y: 240,
        color: 0x8a6a40,
        troop: "INFANTRY",
        talk: { text: `${s.depot.HORSES ?? 0} cavalos de reserva no estábulo${(s.depot.HORSES ?? 0) === 0 ? " — para montar cavalaria, vai ter de comprar cavalos (as estepes vendem barato)" : ""}. Batedores e mensageiros: ${s.scouts.length + s.messengers.length}.`, options: [{ id: panelAction({ kind: "STABLE" }), label: "Batedores e mensageiros" }, bye] },
      });
      return d;
    }
  }
  return null;
}

/** Alojamento de um batalhão: um catre por soldado (feridos e doentes nos deles). */
function quarters(key: string, s: GameState, battalionId: string): InteriorDef | null {
  const b = s.battalions.find((x) => x.id === battalionId);
  if (!b) return null;
  const r = createRng(seedFromText(`${key}:${s.day}`)).next;
  const d = room(key, `Alojamento · ${b.name}`, "TENT", 600, 420);
  d.furniture.push(f("BANNER", 280, 30, 40, 26, C.GOLD, false), f("RACK", 30, 40, 24, 120, C.DARK));
  const total = b.soldiers + (b.wounded ?? 0) + (b.sick ?? 0);
  const hour = (6 + s.dayProgress * 24) % 24;
  const night = hour >= 20 || hour < 5;
  for (let i = 0; i < Math.min(12, total); i++) {
    const x = 90 + (i % 6) * 80;
    const y = 90 + Math.floor(i / 6) * 150;
    d.furniture.push(f("BED", x - 22, y - 30, 44, 70, 0x8a7a5a, true));
    const wounded = i >= b.soldiers && i < b.soldiers + (b.wounded ?? 0);
    const sick = i >= b.soldiers + (b.wounded ?? 0);
    if (wounded || sick || night || r() < 0.3) {
      d.npcs.push({
        id: `s${i}`,
        name: wounded ? "Ferido" : sick ? "Doente" : "Soldado",
        x,
        y: y + 50,
        color: 0x2f6fdf,
        troop: b.troopType,
        mark: wounded ? "WOUNDED" : sick ? "SICK" : night ? "SLEEP" : undefined,
        talk: { text: wounded ? "Uma flecha na coxa. A curandeira disse que eu volto em uns dias." : sick ? "Febre... não chegue perto, Comandante." : night ? "Zzz..." : soldierLine(s, r) },
      });
    } else {
      d.npcs.push({ id: `s${i}`, name: "Soldado", x: x + (r() - 0.5) * 60, y: 340 + r() * 30, color: 0x2f6fdf, troop: b.troopType, wander: 30, talk: { text: soldierLine(s, r) } });
    }
  }
  d.spots.push({ x: 300, y: 80, label: `Estandarte · ${b.name}`, talk: { text: `${TROOPS[b.troopType].label}, nível ${b.level}. ${b.soldiers}/${b.maxSoldiers} de pé${b.wounded ? `, ${b.wounded} ferido(s)` : ""}${b.sick ? `, ${b.sick} doente(s)` : ""}.`, options: [{ id: panelAction({ kind: "BATTALION", battalionId: b.id }), label: "Ver o batalhão" }, bye] } });
  const l = s.lieutenants.find((x) => x.battalionId === b.id);
  if (l) d.npcs.push({ id: `lt-${l.id}`, name: fullName(l), x: 380, y: 360, color: 0xdfe3ee, troop: "INFANTRY", wander: 16, talk: { text: `Os ${b.name} estão comigo, Comandante.`, options: [{ id: panelAction({ kind: "LIEUTENANT", lieutenantId: l.id }), label: "Ver a ficha" }, bye] } });
  return d;
}

// --- Povoados ---

/** O que se ouve da gente de um povoado (fome, preços, guerra, febre, impostos...). */
function townGossip(s: GameState, t: Settlement, r: () => number): string[] {
  const out: string[] = [];
  const name = (id: string) => s.world?.factions.find((f) => f.id === id)?.name ?? "reino";
  if (t.econ.famine) out.push("Os celeiros estão vazios. Meu filho chora de fome à noite.", "O pão custa uma fortuna. Comemos sopa de casca.");
  for (const g of GOOD_LIST) {
    const ratio = t.econ.price[g] / GOODS[g].base;
    if (ratio >= 2) out.push(`${GOODS[g].label} está pela hora da morte: ${Math.round(t.econ.price[g])} moedas! Quem trouxer, fica rico.`);
    else if (ratio <= 0.45) out.push(`Sobra ${GOODS[g].label.toLowerCase()} por aqui; ninguém quer comprar.`);
  }
  if (isSick(t, s.day)) out.push("A febre levou a vizinha. Não chegue muito perto.");
  if (t.lastRaidDay !== null && s.day - t.lastRaidDay <= 5) out.push("Os saqueadores levaram tudo do armazém. Tudo!");
  const war = s.wars.find((w) => w.peace === undefined && (w.a === t.owner || w.b === t.owner));
  if (war) out.push(`Estamos em guerra com o ${name(war.a === t.owner ? war.b : war.a)}. Levaram meu irmão para o exército e as armas sumiram do mercado.`);
  if (t.owner === "PLAYER") {
    if (inRevolt(t, s.day)) out.push("Não pagamos mais nada! Que o senhor venha cobrar, se tiver coragem.");
    else if (t.econ.unrest > 50) out.push("Se o senhor não fizer algo pela carestia, vai ter revolta.");
    else if (t.taxRate === 2) out.push("Os impostos estão comendo a gente viva.");
    else out.push("Desde que o bando chegou, ninguém mexe com a gente.");
  }
  if (t.econ.sol >= 80 && !t.econ.famine) out.push("Ano bom! O mercado está cheio e a cerveja é barata.");
  if (out.length < 2) out.push("A estrada para o norte anda perigosa.", "Dizem que os goblins atacam as caravanas.", "Quem é o senhor? Mercenário? Hum.");
  return [...out].sort(() => r() - 0.5);
}

function hall(key: string, s: GameState, t: Settlement): InteriorDef {
  const own = t.owner === "PLAYER";
  const title = own ? `Sala de Administração de ${t.name}` : t.kind === "VILLAGE" ? `Casa do Conselho de ${t.name}` : `Paço de ${t.name}`;
  const d = room(key, title, "STONE", 640, 460, { settlementId: t.id });
  d.furniture.push(f("CARPET", 270, 60, 100, 330, 0x7a2a22, false), f("TABLE", 250, 70, 140, 44, C.WOOD), f("BANNER", 120, 30, 40, 28, own ? 0x2f6fdf : C.GOLD, false), f("BANNER", 480, 30, 40, 28, own ? 0x2f6fdf : C.GOLD, false));
  for (let i = 0; i < 3; i++) {
    d.furniture.push(f("BENCH", 60, 150 + i * 80, 140, 26, C.WOOD), f("BENCH", 440, 150 + i * 80, 140, 26, C.WOOD));
  }
  const ruler = isFactionOwner(t.owner) ? s.factions.find((x) => x.id === t.owner)?.ruler : undefined;
  d.npcs.push({
    id: "steward",
    name: own ? "Administrador" : ruler ? `Intendente de ${ruler}` : "Conselheiro",
    x: 320,
    y: 140,
    color: 0xb08ad0,
    talk: {
      text: own
        ? `Senhor, a renda, as obras e a guarnição de ${t.name} aguardam as suas ordens. Nível de vida: ${t.econ.sol}/100${t.econ.unrest > 30 ? `; a agitação está em ${Math.round(t.econ.unrest)}` : ""}.`
        : `O senhor de ${t.name} não recebe mercenários sem aviso. Fale comigo.`,
      options: [{ id: panelAction({ kind: "TOWN", settlementId: t.id, at: "HALL" }), label: own ? "Administrar o povoado" : "Tratar dos assuntos do povoado" }, bye],
    },
  });
  d.npcs.push({ id: "g1", name: "Guarda", x: 230, y: 380, color: 0x7f8c8d, talk: { text: "Mantenha a espada na bainha aqui dentro." } }, { id: "g2", name: "Guarda", x: 410, y: 380, color: 0x7f8c8d, talk: { text: "..." } });
  return d;
}

function tavern(key: string, s: GameState, t: Settlement): InteriorDef {
  const r = createRng(seedFromText(`${key}:${s.day}`)).next;
  const d = room(key, `Taverna de ${t.name}`, "WOOD", 680, 460, { settlementId: t.id });
  d.furniture.push(f("COUNTER", 60, 60, 260, 40, C.WOOD), f("FIRE", 560, 40, 80, 60, 0xb0401a));
  for (let i = 0; i < 3; i++) d.furniture.push(f("BARREL", 70 + i * 44, 20, 34, 34, 0x7a4a24));
  const tables = [
    { x: 120, y: 200 },
    { x: 300, y: 220 },
    { x: 480, y: 200 },
    { x: 200, y: 340 },
    { x: 420, y: 340 },
  ];
  for (const tb of tables) d.furniture.push(f("TABLE", tb.x - 40, tb.y - 22, 80, 44, C.WOOD));
  d.npcs.push({
    id: "keeper",
    name: "Taverneiro",
    x: 190,
    y: 120,
    color: 0xb08a68,
    talk: {
      text: `Bem-vindo à taverna de ${t.name}! Viajantes de todo canto bebem aqui — e falam demais depois da segunda caneca.`,
      options: [{ id: `round:${t.id}`, label: `Pagar uma rodada (${TRADE.TAVERN_ROUND} de ouro): notícias e preços de longe` }, bye],
    },
  });
  // Fregueses conforme a prosperidade (cidade em crise: taverna vazia)
  const gossip = townGossip(s, t, r);
  const patrons = Math.max(1, Math.round((t.prosperity / 100) * (t.kind === "VILLAGE" ? 5 : 8)));
  for (let i = 0; i < patrons; i++) {
    const tb = tables[i % tables.length];
    const a = (i / patrons) * Math.PI * 2;
    d.npcs.push({ id: `p${i}`, name: i === 0 ? "Mercador de passagem" : "Freguês", x: tb.x + Math.cos(a) * 58, y: tb.y + Math.sin(a) * 40, color: pick(r, C.TOWNSFOLK), talk: i === 0 ? { text: "Venho de longe. Quer saber como estão os preços na estrada?", options: [{ id: `hear:${t.id}`, label: "Ouvir o mercador" }, bye] } : { text: gossip[i % gossip.length] } });
  }
  return d;
}

function guild(key: string, s: GameState, t: Settlement): InteriorDef {
  const d = room(key, `Casa dos Mercadores de ${t.name}`, "STONE", 640, 440, { settlementId: t.id });
  d.furniture.push(f("COUNTER", 60, 120, 200, 36, C.WOOD), f("COUNTER", 380, 120, 200, 36, C.WOOD), f("BOARD", 250, 26, 140, 30, 0x2a2a2a, false));
  for (let i = 0; i < 4; i++) d.furniture.push(f("CRATE", 40 + i * 46, 320, 40, 40, parseInt(GOODS[GOOD_LIST[(i * 3) % 10]].color.slice(1), 16)));
  for (let i = 0; i < 3; i++) d.furniture.push(f("CHEST", 460 + i * 48, 320, 40, 34, C.DARK));
  d.spots.push({ x: 320, y: 80, label: "Quadro de preços", talk: { text: "O quadro de giz com os preços de hoje na praça.", options: [{ id: panelAction({ kind: "TOWN", settlementId: t.id, at: "MARKET" }), label: "Negociar mercadorias" }, bye] } });
  const post = s.posts.includes(t.id);
  d.npcs.push({
    id: "master",
    name: "Mestre da guilda",
    x: 160,
    y: 100,
    color: 0x6a4a8a,
    talk: {
      text: post ? "A feitoria do bando vai bem. As cartas com os preços saem todo dia." : "Feitorias, participações nas oficinas, caravanas próprias... a guilda trata de tudo, por um preço.",
      options: [{ id: panelAction({ kind: "GUILD", settlementId: t.id }), label: "Feitoria, guildas e caravanas" }, bye],
    },
  });
  d.npcs.push({
    id: "banker",
    name: "Cambista",
    x: 480,
    y: 100,
    color: 0x4a6a4a,
    talk: {
      text: t.kind === "VILLAGE" ? "Aqui só troco moedas. Empréstimo, só nas cidades." : `Ouro emprestado a ${Math.round(TRADE.LOAN_INTEREST * 100)}% por semana. Quem não paga... bem, a guilda tem memória longa.`,
      options: [{ id: panelAction({ kind: "GUILD", settlementId: t.id }), label: "Câmbio e empréstimos" }, bye],
    },
  });
  return d;
}

function temple(key: string, s: GameState, t: Settlement): InteriorDef {
  const d = room(key, `Templo de ${t.name}`, "TEMPLE", 520, 520, { settlementId: t.id });
  d.furniture.push(f("ALTAR", 210, 50, 100, 46, 0xd9d2bf), f("CARPET", 235, 100, 50, 330, 0x7a2a22, false));
  for (let i = 0; i < 4; i++) d.furniture.push(f("BENCH", 70, 150 + i * 70, 140, 24, C.WOOD), f("BENCH", 310, 150 + i * 70, 140, 24, C.WOOD));
  const sick = isSick(t, s.day);
  d.npcs.push({
    id: "priest",
    name: "Sacerdote",
    x: 260,
    y: 120,
    color: 0xe8e0c8,
    talk: {
      text: sick ? "A febre enche o templo de doentes. Toda esmola compra ervas e lençóis." : "Que os deuses guardem o bando. Uma esmola aos pobres honra o seu nome.",
      options: [{ id: `donate:${t.id}:20`, label: "Dar 20 de ouro" }, { id: `donate:${t.id}:60`, label: "Dar 60 de ouro" }, bye],
    },
  });
  if (sick) for (let i = 0; i < 4; i++) d.npcs.push({ id: `sick${i}`, name: "Febril", x: 100 + i * 100, y: 460, color: 0xa0b080, mark: "SICK", talk: { text: "Água... por favor..." } });
  return d;
}

/** Casa de moradores: a família conta o que se passa; com fome, aceita comida das carroças. */
function house(key: string, s: GameState, t: Settlement, index: number): InteriorDef {
  const r = createRng(seedFromText(`${key}:${s.day}`)).next;
  const d = room(key, `Casa em ${t.name}`, "WOOD", 420, 320, { settlementId: t.id });
  d.furniture.push(f("FIRE", 30, 30, 60, 44, 0xb0401a), f("TABLE", 160, 110, 100, 56, C.WOOD), f("BED", 320, 40, 70, 90, 0x8a6a4a), f("CHEST", 320, 200, 60, 36, C.DARK));
  const gossip = townGossip(s, t, r);
  const n = 1 + Math.floor(r() * 3);
  const names = ["Dona da casa", "Velho", "Lavrador", "Tecelã", "Menino"];
  const food = (["GRAIN", "MEAT"] as Good[]).find((g) => freightOf(s.freight, g) > 0);
  for (let i = 0; i < n; i++) {
    const hungry = t.econ.famine && i === 0;
    d.npcs.push({
      id: `h${index}-${i}`,
      name: pick(r, names),
      x: 120 + i * 90,
      y: 220 + (i % 2) * 30,
      color: pick(r, C.TOWNSFOLK),
      wander: 20,
      talk: hungry && food
        ? { text: `${gossip[0]} O senhor tem comida nas carroças... poderia nos dar um saco?`, options: [{ id: `charity:${t.id}`, label: `Dar 1 de ${GOODS[food].label.toLowerCase()} (honra)` }, bye] }
        : { text: gossip[i % gossip.length] },
    });
  }
  return d;
}
