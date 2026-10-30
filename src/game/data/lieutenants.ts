import type { Contract } from "./contracts";

export type TraitId = "GREEDY" | "BRAVE" | "CAUTIOUS" | "BLOODTHIRSTY" | "HONORABLE" | "AMBITIOUS" | "LOYAL";
export type PassiveId = "INSPIRING" | "STALWART" | "DRILLMASTER" | "TACTICIAN" | "MARKSMAN" | "FRUGAL" | "BERSERKER";

export const TRAITS: Record<TraitId, { label: string; description: string }> = {
  GREEDY: { label: "Ganancioso", description: "Gosta de contratos que pagam bem; salário atrasado irrita em dobro." },
  BRAVE: { label: "Corajoso", description: "Quer as lutas difíceis; vitórias animam mais." },
  CAUTIOUS: { label: "Cauteloso", description: "Prefere trabalhos seguros; aprova um recuo sensato. Lê o céu: prevê o tempo de amanhã." },
  BLOODTHIRSTY: { label: "Sanguinário", description: "Vive para a batalha; fica feliz com qualquer luta que não seja fácil." },
  HONORABLE: { label: "Honrado", description: "Gosta de proteger os fracos; despreza recuos e nobres gananciosos." },
  AMBITIOUS: { label: "Ambicioso", description: "Quer comandar e brilhar; ficar sem batalhão corrói a lealdade." },
  LOYAL: { label: "Leal", description: "Fiel ao Comandante: perde lealdade pela metade." },
};

/**
 * Bônus que o tenente dá ao batalhão que comanda — só enquanto estiver vivo em campo
 * (exceto XP e salário, aplicados no acampamento).
 */
export interface PassiveDef {
  label: string;
  description: string;
  damage?: number;
  speed?: number;
  range?: number;
  /** Multiplica o dano recebido. */
  taken?: number;
  moraleLoss?: number;
  /** Multiplica a recuperação de moral. */
  recovery?: number;
  /** Limite de pânico próprio (padrão: BALANCE.MORALE.PANIC_BELOW). */
  panicBelow?: number;
  xp?: number;
  wage?: number;
}

export const PASSIVES: Record<PassiveId, PassiveDef> = {
  INSPIRING: {
    label: "Inspirador",
    description: "Recuperação de moral em dobro; o batalhão só entra em pânico abaixo de 15.",
    recovery: 2,
    panicBelow: 15,
  },
  STALWART: { label: "Inabalável", description: "−40% de perda de moral.", moraleLoss: 0.6 },
  DRILLMASTER: { label: "Instrutor", description: "+30% de XP para o batalhão (batalhas e treino).", xp: 1.3 },
  TACTICIAN: { label: "Tático", description: "+10% de dano e +10% de velocidade.", damage: 1.1, speed: 1.1 },
  MARKSMAN: { label: "Olho de Falcão", description: "+15% de alcance (arqueiros) e +10% de dano.", range: 1.15, damage: 1.1 },
  FRUGAL: { label: "Frugal", description: "−25% no salário do batalhão.", wage: 0.75 },
  BERSERKER: { label: "Fúria", description: "+20% de dano, mas +15% de dano recebido.", damage: 1.2, taken: 1.15 },
};

const NAMES = ["Bran", "Ysolde", "Tomas", "Mirela", "Garrick", "Oda", "Rurik", "Selene", "Aldo", "Hedda", "Corvin", "Liesel", "Ivo", "Maren", "Dagny", "Erwan"];
const EPITHETS = ["Mão-de-Ferro", "Meia-Orelha", "Corvo", "Cicatriz", "Sem-Medo", "Pé-Leve", "Sete-Vidas", "Lâmina-Torta", "Cinza", "Lobo", "Faísca", "Pedra"];
const ORIGINS = [
  "Serviu como sargento na guarda de Pedralva",
  "Cresceu na forja de um ferreiro de Vaurocha",
  "Viveu de caçar recompensas nas estradas do norte",
  "Desertou de um exército real",
  "Trocou o hábito da Abadia do Monte Velado pela espada",
  "Liderou um bando de salteadores antes de se arrepender",
  "Carregou o escudo de um cavaleiro caído em desgraça",
];
const EVENTS = [
  "e foi a única pessoa a sobreviver a uma emboscada orc.",
  "até perder a família numa incursão goblin.",
  "e jurou vingança contra o Barão de Cinzafria.",
  "até sofrer a traição do antigo capitão.",
  "e venceu um duelo contra três homens numa noite só.",
  "e carrega uma dívida que nunca conseguiu pagar.",
  "e ainda acorda gritando com o que viu numa batalha antiga.",
];

/** Dados persistentes de um tenente. */
export interface LieutenantData {
  id: string;
  name: string;
  epithet: string;
  backstory: string;
  traits: TraitId[];
  passive: PassiveId;
  /** 0–100; a deserção acontece em LOYALTY_DESERT_AT ou menos. */
  loyalty: number;
  battalionId: string | null;
  hireCost: number;
  /** Salário semanal próprio. */
  wage: number;
  /** Abates pessoais na carreira. */
  kills: number;
  /** Crônica pessoal (mais recente por último). */
  history: string[];
}

const pick = <T>(list: readonly T[]): T => list[Math.floor(Math.random() * list.length)];

export function generateLieutenant(day: number): LieutenantData {
  const traits = [...(Object.keys(TRAITS) as TraitId[])].sort(() => Math.random() - 0.5).slice(0, 2);
  const name = pick(NAMES);
  return {
    id: crypto.randomUUID(),
    name,
    epithet: pick(EPITHETS),
    backstory: `${pick(ORIGINS)} ${pick(EVENTS)}`,
    traits,
    passive: pick(Object.keys(PASSIVES) as PassiveId[]),
    loyalty: traits.includes("LOYAL") ? 70 : 55,
    battalionId: null,
    hireCost: 60 + Math.floor(Math.random() * 6) * 10,
    wage: 8 + Math.floor(Math.random() * 7),
    kills: 0,
    history: [`Dia ${day}: apareceu no acampamento procurando trabalho.`],
  };
}

export const fullName = (l: Pick<LieutenantData, "name" | "epithet">) => `${l.name} "${l.epithet}"`;

export type Stance = "APPROVE" | "DISAPPROVE";

/** O que o tenente acha de um contrato (pela personalidade). Primeiro traço com opinião vence. */
export function opinionOn(l: LieutenantData, c: Contract): { stance: Stance; reason: string } | null {
  for (const t of l.traits) {
    switch (t) {
      case "GREEDY":
        if (c.reward >= 140) return { stance: "APPROVE", reason: "paga bem" };
        if (c.reward < 90) return { stance: "DISAPPROVE", reason: "paga uma miséria" };
        break;
      case "BRAVE":
        if (c.difficulty === 3) return { stance: "APPROVE", reason: "uma luta de verdade" };
        if (c.difficulty === 1) return { stance: "DISAPPROVE", reason: "trabalho para covardes" };
        break;
      case "CAUTIOUS":
        if (c.difficulty === 1) return { stance: "APPROVE", reason: "risco baixo" };
        if (c.difficulty === 3) return { stance: "DISAPPROVE", reason: "arriscado demais" };
        break;
      case "BLOODTHIRSTY":
        if (c.difficulty >= 2) return { stance: "APPROVE", reason: "vai ter sangue" };
        break;
      case "HONORABLE":
        if (/Aldeia|Abadia|Liga/.test(c.client)) return { stance: "APPROVE", reason: "protege gente simples" };
        if (/Barão|Senhor/.test(c.client)) return { stance: "DISAPPROVE", reason: "servir nobre ganancioso" };
        break;
      case "AMBITIOUS":
        if (c.difficulty === 3 && c.reward >= 120) return { stance: "APPROVE", reason: "glória e ouro" };
        break;
      case "LOYAL":
        break;
    }
  }
  return null;
}
