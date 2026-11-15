/**
 * Que som a interface faz e quando (S1), só as regras: o clique certo para cada botão, a assinatura
 * de cada lugar e o que muda no estado do jogo que merece um som. As receitas ficam em `uiSounds.ts`.
 *
 * Não sabe o que é a Web Audio nem o navegador, então dá para testar sem eles.
 */

/** A assinatura de cada lugar: o som que diz onde se entrou. */
export type PlaceSound =
  | "anvil"
  | "mugs"
  | "templeBell"
  | "market"
  | "whinny"
  | "sacks"
  | "woodSwords"
  | "canvas"
  | "gulls"
  | "hall"
  | "gate"
  | "drumTap"
  | "ledger"
  | "jingle"
  | "wagon"
  | "water"
  | "door";

export type UiSound =
  | "click"
  | "confirm"
  | "cancel"
  | "deny"
  | "open"
  | "close"
  | "page"
  | "mapOpen"
  | "mapClose"
  | "build"
  | "recruit"
  | "contract"
  | "wages"
  | "ambition"
  | "levelUp"
  | "coinGain"
  | "coinLoss"
  | PlaceSound;

/** Um painel aberto, só o que importa para o som. */
export interface PanelView {
  kind: string;
  at?: string;
}

const PLACE_OF: Record<string, UiSound> = {
  FORGE: "anvil",
  TAVERN: "mugs",
  TEMPLE: "templeBell",
  STABLE: "whinny",
  QUARTERMASTER: "sacks",
  TRAINING: "woodSwords",
  TENT: "canvas",
  DOCK: "gulls",
  GUILD: "ledger",
  PEDDLER: "jingle",
  SUPPLY: "wagon",
  BRIDGE: "water",
  FERRY: "water",
  RECRUIT: "drumTap",
  CAMP_BUILDING: "door",
  // Os livros e a planta são papel: a página que vira
  MISSIONS: "page",
  SAGA: "page",
  PRICE_BOOK: "page",
  NOBILITY: "page",
  CAMP_PLAN: "page",
};

const TOWN_AT: Record<string, UiSound> = { MARKET: "market", HALL: "hall", GATE: "gate", CAMP: "drumTap" };

/** O som de abrir um painel: a assinatura do lugar, ou o som comum de painel. */
export function panelSound(panel: PanelView): UiSound {
  if (panel.kind === "TOWN") return TOWN_AT[panel.at ?? "MARKET"] ?? "market";
  return PLACE_OF[panel.kind] ?? "open";
}

const CANCEL = /^(cancelar|voltar|fechar|não\b|nao\b|sair|desistir|recusar|dispensar|agora não|x$|×|✕)/i;
const CONFIRM = /^(confirmar|aceitar|contratar|recrutar|construir|comprar|vender|pagar|começar|partir|salvar|carregar|sim\b|ok\b|continuar|forjar|treinar|atacar|levantar|fincar|assinar|enviar|promover|nomear)/i;

/**
 * O som de um botão: quem não pode ser apertado responde "não pode", quem cancela desce, quem
 * confirma sobe, e o resto é um clique leve. `hint` (o atributo `data-sound`) manda em tudo;
 * "none" cala o botão.
 */
export function clickSound(el: { disabled: boolean; text: string; hint?: string | null }): UiSound | null {
  if (el.hint === "none") return null;
  if (el.disabled) return "deny";
  if (el.hint === "confirm" || el.hint === "cancel" || el.hint === "click" || el.hint === "deny") return el.hint;
  const text = el.text.trim();
  if (CANCEL.test(text)) return "cancel";
  if (CONFIRM.test(text)) return "confirm";
  return "click";
}

/** O que o som olha no estado do jogo. */
export interface SoundState {
  loadNonce: number;
  campPanel: PanelView | null;
  worldMapOpen: boolean;
  gold: number;
  battalions: readonly { id: string; level: number }[];
  campPlan: { buildings: readonly unknown[] };
  activeContract: unknown | null;
  log: readonly { id: number; text: string }[];
}

/** As entradas novas do diário (o diário só cresce no fim, e corta o começo quando fica grande). */
export function newLogLines(prev: SoundState["log"], next: SoundState["log"]): string[] {
  if (prev === next || next.length === 0) return [];
  const last = prev.length > 0 ? prev[prev.length - 1].id : -Infinity;
  const out: string[] = [];
  for (let i = next.length - 1; i >= 0 && next[i].id > last; i--) out.unshift(next[i].text);
  return out;
}

/**
 * Os sons que uma mudança de estado pede. Carregar um jogo ou começar uma campanha muda tudo de
 * uma vez e não faz som nenhum.
 */
export function stateSounds(prev: SoundState, next: SoundState): UiSound[] {
  if (prev.loadNonce !== next.loadNonce) return [];
  const out: UiSound[] = [];

  if (next.campPanel !== prev.campPanel) {
    if (!next.campPanel) out.push("close");
    else if (!prev.campPanel || prev.campPanel.kind !== next.campPanel.kind || prev.campPanel.at !== next.campPanel.at) out.push(panelSound(next.campPanel));
  }
  if (next.worldMapOpen !== prev.worldMapOpen) out.push(next.worldMapOpen ? "mapOpen" : "mapClose");

  const lines = newLogLines(prev.log, next.log);
  const payday = lines.some((l) => l.startsWith("Dia de pagamento"));
  if (payday) out.push("wages");
  else if (next.gold !== prev.gold && next.campPanel && prev.campPanel) out.push(next.gold > prev.gold ? "coinGain" : "coinLoss");

  if (next.campPlan !== prev.campPlan && next.campPlan.buildings.length > prev.campPlan.buildings.length) out.push("build");
  if (next.battalions !== prev.battalions) {
    if (next.battalions.length > prev.battalions.length && next.campPanel) out.push("recruit");
    const before = new Map(prev.battalions.map((b) => [b.id, b.level]));
    if (next.battalions.some((b) => b.level > (before.get(b.id) ?? Infinity))) out.push("levelUp");
  }
  if (next.activeContract && !prev.activeContract) out.push("contract");
  if (lines.some((l) => l.startsWith("Ambição cumprida"))) out.push("ambition");
  return out;
}
