/** Resolução lógica do jogo (o Phaser escala para caber na janela). */
export const GAME_WIDTH = 1280;
export const GAME_HEIGHT = 720;

/** Tamanho de uma região do continente (px). Marco 12: 1,5× maior, para caber cidades de verdade. */
export const REGION_WIDTH = 4800;
export const REGION_HEIGHT = 3600;

/**
 * Tamanho do continente (Marcos 10–12): regiões de REGION_WIDTH×REGION_HEIGHT, geradas a cada
 * campanha. O tamanho é escolhido na criação do mundo; estes valores acompanham o mundo
 * carregado (`setWorldSize`) e os módulos que os importam veem sempre o valor atual.
 */
export let WORLD_COLS = 10;
export let WORLD_ROWS = 8;
export let WORLD_WIDTH = WORLD_COLS * REGION_WIDTH;
export let WORLD_HEIGHT = WORLD_ROWS * REGION_HEIGHT;

export function setWorldSize(cols: number, rows: number): void {
  WORLD_COLS = cols;
  WORLD_ROWS = rows;
  WORLD_WIDTH = cols * REGION_WIDTH;
  WORLD_HEIGHT = rows * REGION_HEIGHT;
}

/** Opções da criação do mundo (Marco 11). */
export type WorldSizeId = "SMALL" | "MEDIUM" | "LARGE";
export type WorldAgeId = "YOUNG" | "MIDDLE" | "ANCIENT";
export type CalamityRateId = "RARE" | "NORMAL" | "FREQUENT";

export interface WorldOptions {
  size: WorldSizeId;
  age: WorldAgeId;
  calamities: CalamityRateId;
}

export const DEFAULT_WORLD_OPTIONS: WorldOptions = { size: "MEDIUM", age: "MIDDLE", calamities: "NORMAL" };

export const WORLD_SIZES: Record<WorldSizeId, { label: string; cols: number; rows: number }> = {
  SMALL: { label: "Pequeno", cols: 7, rows: 6 },
  MEDIUM: { label: "Médio", cols: 10, rows: 8 },
  LARGE: { label: "Grande", cols: 13, rows: 10 },
};

/** Idade do mundo: anos de história simulada antes da campanha. */
export const WORLD_AGES: Record<WorldAgeId, { label: string; years: number }> = {
  YOUNG: { label: "Jovem", years: 120 },
  MIDDLE: { label: "Média", years: 250 },
  ANCIENT: { label: "Antiga", years: 400 },
};

/** Frequência de calamidades: multiplica o dia da primeira e o intervalo entre elas. */
export const CALAMITY_RATES: Record<CalamityRateId, { label: string; delay: number }> = {
  RARE: { label: "Raras", delay: 1.8 },
  NORMAL: { label: "Normais", delay: 1 },
  FREQUENT: { label: "Frequentes", delay: 0.6 },
};

/** Paleta do greybox: apenas cores sólidas, sem assets. */
export const COLORS = {
  BACKGROUND: 0x1a1a1a,
  GRASS: 0x3a7d2c,
  GRID: 0x2f6a23,
  ALLY: 0x2f6fdf,
  ALLY_ARCHER: 0x5aa8ff,
  ALLY_CAVALRY: 0x1f4fae,
  ALLY_PANIC: 0x9db8e8,
  COMMANDER_OUTLINE: 0xe0b040,
  ENEMY: 0xc0392b,
  ENEMY_ARCHER: 0xe8735f,
  MUTINEER: 0x8e44ad,
  LIEUTENANT: 0xdfe3ee,
  SCOUT: 0x3f8f6b,
  MESSENGER: 0x4a6fa8,
  PENNANT: 0xf1c40f,
  COMMAND_RING: 0xffe9b0,
  FOG: 0x0a0d0a,
  OUTLINE: 0x0b0b0b,
  SHIELD: 0xb8b8b8,
  HP: 0x3ccf4e,
  HP_BG: 0x1b1b1b,
  MORALE: 0xf1c40f,
  PANIC: 0xff4d4d,
  ORDER_MOVE: 0xffffff,
  ORDER_ATTACK: 0xff6b6b,
  SLASH: 0xfff3c4,
  SELECTION: 0x9dff6b,
  ARROW: 0xf5e6c8,
} as const;

// --- Tipos de domínio compartilhados por Phaser e React ---

export type TroopType = "INFANTRY" | "ARCHERS" | "CAVALRY";
export type EnemyKind =
  | "GOBLIN"
  | "GOBLIN_ARCHER"
  | "MUTINEER"
  | "MUTINEER_ARCHER"
  | "MUTINEER_RIDER"
  | "BANDIT"
  | "BANDIT_ARCHER"
  | "SOLDIER"
  | "CROSSBOW"
  | "SKELETON"
  | "NECROMANCER"
  | "ORC"
  | "ORC_WARLORD"
  /** Marco 12: gente que não luta (refugiados) e o mensageiro a cavalo de um reino. */
  | "CIVILIAN"
  | "COURIER";
export type Formation = "LINE" | "SHIELD_WALL" | "WEDGE" | "LOOSE";
export type TerrainType =
  | "GRASS"
  | "HILL"
  | "MUD"
  | "SWAMP"
  | "FOREST"
  | "SHALLOW"
  | "BRIDGE"
  | "WATER"
  | "MOUNTAIN"
  | "WALL"
  | "BUILDING";
export type AttackKind = "MELEE" | "RANGED";

export interface UnitStats {
  hp: number;
  speed: number; // px/s
  damage: number;
  /** Alcance de ataque medido de borda a borda (px). */
  range: number;
  /** Intervalo entre ataques (ms). */
  cooldown: number;
  /** Raio do círculo ou meia-aresta do quadrado (px). */
  radius: number;
  /** Ataca com flechas (projéteis) em vez de corpo a corpo. */
  ranged?: boolean;
}

export interface TroopDef {
  label: string;
  /** Custo de recrutar um batalhão completo. */
  cost: number;
  /** Salário semanal de cada soldado (ouro). */
  wagePerSoldier: number;
  stats: UnitStats;
  /** Formações que este tipo de tropa sabe executar (a primeira é a padrão). */
  formations: readonly Formation[];
  /** Ganha bônus de investida após correr em linha reta (cavalaria). */
  canCharge: boolean;
}

export const TROOPS: Record<TroopType, TroopDef> = {
  INFANTRY: {
    label: "Infantaria",
    cost: 60,
    wagePerSoldier: 1.5,
    stats: { hp: 60, speed: 125, damage: 8, range: 8, cooldown: 900, radius: 9 },
    formations: ["LINE", "SHIELD_WALL", "WEDGE", "LOOSE"],
    canCharge: false,
  },
  ARCHERS: {
    label: "Arqueiros",
    cost: 70,
    wagePerSoldier: 1.75,
    stats: { hp: 40, speed: 120, damage: 9, range: 210, cooldown: 1500, radius: 8, ranged: true },
    formations: ["LINE", "LOOSE"],
    canCharge: false,
  },
  CAVALRY: {
    label: "Cavalaria",
    cost: 100,
    wagePerSoldier: 2.5,
    stats: { hp: 90, speed: 205, damage: 10, range: 10, cooldown: 900, radius: 11 },
    formations: ["LINE", "WEDGE", "LOOSE"],
    canCharge: true,
  },
};

export interface EnemyDef {
  label: string;
  stats: UnitStats;
  color: number;
  /** Alcance de percepção próprio (amotinados vêm direto para cima). */
  aggroRange?: number;
  /** Líder de uma calamidade: maior, com coroa; a morte dele encerra a calamidade. */
  boss?: boolean;
}

/** Amotinados usam os atributos da tropa de origem, mas aparecem como quadrados roxos. */
const MUTINEER_AGGRO = 2000;

export const ENEMIES: Record<EnemyKind, EnemyDef> = {
  GOBLIN: {
    label: "Goblin",
    color: COLORS.ENEMY,
    stats: { hp: 40, speed: 105, damage: 7, range: 8, cooldown: 1000, radius: 9 },
  },
  GOBLIN_ARCHER: {
    label: "Goblin arqueiro",
    color: COLORS.ENEMY_ARCHER,
    stats: { hp: 30, speed: 100, damage: 6, range: 180, cooldown: 1700, radius: 8, ranged: true },
  },
  MUTINEER: {
    label: "Amotinado",
    color: COLORS.MUTINEER,
    aggroRange: MUTINEER_AGGRO,
    stats: { ...TROOPS.INFANTRY.stats },
  },
  MUTINEER_ARCHER: {
    label: "Amotinado arqueiro",
    color: COLORS.MUTINEER,
    aggroRange: MUTINEER_AGGRO,
    stats: { ...TROOPS.ARCHERS.stats },
  },
  MUTINEER_RIDER: {
    label: "Amotinado montado",
    color: COLORS.MUTINEER,
    aggroRange: MUTINEER_AGGRO,
    stats: { ...TROOPS.CAVALRY.stats },
  },
  BANDIT: {
    label: "Bandido",
    color: 0x8a5a2b,
    stats: { hp: 45, speed: 110, damage: 8, range: 8, cooldown: 950, radius: 9 },
  },
  BANDIT_ARCHER: {
    label: "Bandido arqueiro",
    color: 0xa87a4b,
    stats: { hp: 32, speed: 105, damage: 7, range: 190, cooldown: 1600, radius: 8, ranged: true },
  },
  // Soldados dos reinos: a cor real vem da facção (ver Enemy)
  SOLDIER: {
    label: "Soldado",
    color: 0x7f8c8d,
    stats: { hp: 70, speed: 110, damage: 9, range: 8, cooldown: 900, radius: 10 },
  },
  CROSSBOW: {
    label: "Besteiro",
    color: 0x95a5a6,
    stats: { hp: 45, speed: 100, damage: 12, range: 220, cooldown: 2100, radius: 9, ranged: true },
  },
  SKELETON: {
    label: "Esqueleto",
    color: 0xd8d2c0,
    stats: { hp: 35, speed: 95, damage: 7, range: 8, cooldown: 1000, radius: 9 },
  },
  NECROMANCER: {
    label: "Lorde Necromante",
    color: 0x5b2c6f,
    boss: true,
    aggroRange: 420,
    stats: { hp: 900, speed: 80, damage: 18, range: 230, cooldown: 1400, radius: 16, ranged: true },
  },
  ORC: {
    label: "Orc",
    color: 0x4e6b2a,
    stats: { hp: 85, speed: 110, damage: 11, range: 9, cooldown: 1000, radius: 11 },
  },
  ORC_WARLORD: {
    label: "Senhor da Guerra orc",
    color: 0x2f4a16,
    boss: true,
    aggroRange: 380,
    stats: { hp: 1200, speed: 100, damage: 24, range: 10, cooldown: 1100, radius: 17 },
  },
  CIVILIAN: {
    label: "Refugiado",
    color: 0xc8b48c,
    aggroRange: 0,
    stats: { hp: 20, speed: 75, damage: 0, range: 6, cooldown: 2000, radius: 7 },
  },
  COURIER: {
    label: "Mensageiro real",
    color: 0xe0d27a,
    aggroRange: 0,
    stats: { hp: 55, speed: 230, damage: 4, range: 10, cooldown: 1200, radius: 10 },
  },
};

/** Agentes do mundo vivo (Marco 12): patrulhas, mensageiros dos reinos e refugiados. */
export const AGENTS = {
  /** Patrulha de um reino: soldados e besteiros que caçam bandos perto das terras do reino. */
  PATROL_SIZE: { SOLDIER: 6, CROSSBOW: 3 },
  /** Uma patrulha a cada tantos povoados do reino (no máximo 2). */
  PATROL_PER_SETTLEMENTS: 4,
  PATROL_MAX: 2,
  /** A patrulha vai atrás de bandos a esta distância. */
  HUNT_RADIUS: 4200,
  /** Dois bandos a esta distância se enfrentam (resolvido no abstrato). */
  SKIRMISH_RADIUS: 420,
  /** Força de cada tipo de bando numa escaramuça. */
  SKIRMISH_WEIGHT: { GOBLIN: 1, HORDE: 1.5, FACTION: 1.2, PATROL: 1.3, COURIER: 0.5, REFUGEES: 0.1 } as Record<string, number>,
  /** O mensageiro real cavalga 3× mais rápido que um bando. */
  COURIER_SPEED: 3,
  /** Interceptar um mensageiro: ouro dos despachos e a relação que se perde se o reino não estiver em guerra. */
  COURIER_GOLD: 25,
  COURIER_RELATION: -8,
  /** Atacar uma patrulha (ou mensageiro) de um reino em paz. */
  PROVOKE_RELATION: -15,
  /** Atacar refugiados custa honra. */
  REFUGEE_HONOR: -6,
} as const;

/** Tipo de amotinado que cada tropa vira ao se rebelar. */
export const MUTINEER_OF: Record<TroopType, EnemyKind> = {
  INFANTRY: "MUTINEER",
  ARCHERS: "MUTINEER_ARCHER",
  CAVALRY: "MUTINEER_RIDER",
};

/** Progressão RPG dos batalhões (Marco 4). */
export const PROGRESSION = {
  MAX_LEVEL: 5,
  /** XP para sair do nível N = XP_PER_LEVEL × N. */
  XP_PER_LEVEL: 100,
  XP_PER_KILL: 12,
  /** XP por sobreviver à batalha; vitória soma o bônus. */
  XP_PARTICIPATION: 15,
  XP_VICTORY: 40,
  /** Bônus de vida e dano por nível acima do 1. */
  LEVEL_STAT_BONUS: 0.06,
  /** Veteranos cobram mais: salário +10% por nível acima do 1. */
  LEVEL_WAGE_BONUS: 0.1,

  TRAINING_DAYS: 2,
  TRAINING_XP: 80,
  TRAINING_COST: 15,

  MAX_EQUIPMENT_TIER: 3,
  WEAPON_DAMAGE_PER_TIER: 0.12,
  ARMOR_REDUCTION_PER_TIER: 0.1,
  /** Custo para subir do tier T para T+1: ouro × (T+1) e ferro × (T+1). */
  FORGE_GOLD: 30,
  FORGE_IRON: 3,

  /** Saque por inimigo derrotado num contrato vencido. */
  LOOT_GOLD_PER_ENEMY: 2,
  LOOT_IRON_PER_ENEMY: 0.4,
  /** Mercador ambulante da Intendência. */
  IRON_BUY_PRICE: 8,
  IRON_SELL_PRICE: 4,
  START_IRON: 3,
} as const;

/** Câmera da batalha: presa no Comandante ou solta para comandar a distância. */
export const CAMERA = {
  /** Velocidade de rolagem com setas/borda da tela (px de mundo por segundo, em zoom 1). */
  PAN_SPEED: 900,
  /** Distância da borda da tela (px) que faz a câmera rolar quando solta. */
  EDGE_PX: 14,
  MIN_ZOOM: 0.5,
  MAX_ZOOM: 1.25,
  ZOOM_STEP: 0.1,
} as const;

/** Névoa de guerra, raio de comando, mensageiros e batedores (Marco 6). */
export const SUPPORT = {
  /** Alcance da VOZ do Comandante: qualquer ordem é instantânea. */
  COMMAND_RADIUS: 380,
  /**
   * TROMBETA: só toques básicos combinados de antemão (Avançar, Alto, Carregar, Recuar, Reunir).
   * No meio do corpo a corpo o batalhão pode não ouvir o toque (barulho, poeira).
   */
  TRUMPET_RADIUS: 900,
  TRUMPET_MISS_IN_MELEE: 0.5,
  /** ESTANDARTE/BANDEIRAS: sinais visuais (formações, seguir o estandarte); exige linha de visão (sem floresta). */
  BANNER_RADIUS: 1100,
  /** Estandarte à vista: coesão (menos perda e mais recuperação de moral). */
  BANNER_MORALE_LOSS: 0.85,
  BANNER_RECOVERY_PER_SEC: 2,
  /** Estandarte vacilando (Comandante abaixo desta fração de vida): quem o vê perde moral. */
  BANNER_FALTER_HP: 0.3,
  BANNER_FALTER_PER_SEC: 3,
  /** Grito de guerra do Comandante (tecla R). */
  WAR_CRY: { RADIUS: 450, MORALE: 15, RALLY_RADIUS: 300, COOLDOWN_MS: 30000 },
  /** Avançar: distância à frente da formação; Recuar: volta para junto do Comandante. */
  ADVANCE_DISTANCE: 300,
  VISION: { COMMANDER: 320, BATTALION: 240, SCOUT: 460, MESSENGER: 160 },
  /** Quem está na colina enxerga mais longe; na floresta, menos. */
  VISION_HILL_BONUS: 1.35,
  VISION_FOREST_PENALTY: 0.7,
  FOG_CELL: 80,
  FOG_UPDATE_MS: 150,
  FOG_UNEXPLORED_ALPHA: 0.82,
  FOG_EXPLORED_ALPHA: 0.45,
  /** Por quanto tempo o "fantasma" de um inimigo fica no último lugar em que foi visto (ms). */
  GHOST_MS: 20000,

  SCOUT: {
    stats: { hp: 60, speed: 260, damage: 0, range: 0, cooldown: 1e9, radius: 10 } satisfies UnitStats,
    evasion: 0.6,
    /** Inimigos a esta distância fazem o batedor recuar (nunca entra em combate). */
    DANGER_RADIUS: 230,
    VANGUARD_DISTANCE: 380,
    COST: 50,
    WAGE: 6,
    MAX: 2,
  },
  MESSENGER: {
    stats: { hp: 45, speed: 240, damage: 0, range: 0, cooldown: 1e9, radius: 9 } satisfies UnitStats,
    evasion: 0.35,
    /** Por nível acima do 1. */
    EVASION_PER_LEVEL: 0.1,
    SPEED_PER_LEVEL: 0.1,
    /** Moral dada ao batalhão na entrega, por nível (autoridade). */
    AUTHORITY_MORALE_PER_LEVEL: 5,
    /** A partir deste nível o mensageiro consegue reagrupar um batalhão em pânico. */
    RALLY_FROM_LEVEL: 2,
    /**
     * Alcance do sinal do mensageiro (trombeta e bandeira próprias) por nível:
     * ele não precisa encostar na tropa — basta chegar a essa distância.
     */
    SIGNAL_RANGE: [180, 240, 300],
    /**
     * Ordem para vários batalhões: os que estão a até esta distância uns dos outros
     * vão com UM mensageiro (uma rota, um toque para os que estiverem juntos).
     */
    GROUP_RADIUS: 500,
    /** Entregas necessárias para cada nível (índice = nível − 1). */
    LEVEL_AT: [0, 5, 12],
    COST: 40,
    WAGE: 5,
    MAX: 4,
  },
  START_SCOUTS: 1,
  START_MESSENGERS: 2,
} as const;

/** Tenentes (Marco 5). */
export const LIEUTENANTS = {
  MAX_HIRED: 4,
  CANDIDATES: 2,
  /** Atributos do tenente em campo em relação a um soldado do batalhão. */
  HP_MULT: 2.5,
  DAMAGE_MULT: 1.5,
  EXTRA_RADIUS: 3,
  /** Golpe de moral no batalhão quando o tenente morre. */
  DEATH_MORALE_HIT: 30,
  LOYALTY_DESERT_AT: 15,
  LOYALTY: {
    CONTRACT_APPROVED: 3,
    CONTRACT_DISAPPROVED: -4,
    VICTORY: 4,
    VICTORY_BRAVE: 3,
    DEFEAT: -4,
    RETREAT: -4,
    RETREAT_HONORABLE: -6,
    RETREAT_CAUTIOUS: 2,
    PAYDAY_MISSED: -10,
    PAYDAY_MISSED_GREEDY: -10,
    BATTALION_LOST: -15,
    UNASSIGNED_AMBITIOUS: -8,
  },
  HISTORY_SIZE: 12,
} as const;

/** Economia do acampamento (Marco 3). */
export const ECONOMY = {
  START_GOLD: 120,
  START_RATIONS: 30,
  /** Rações por dia: 1 para cada N soldados (arredondado para cima), mais 1 do Comandante. */
  SOLDIERS_PER_RATION: 3,
  RATION_PACK_SIZE: 10,
  RATION_PACK_PRICE: 15,
  /** Dias entre pagamentos de salário. */
  PAYDAY_INTERVAL: 7,
  /** Fração de cada batalhão que deserta quando o salário atrasa. */
  DESERTION_RATE: 0.2,
  /** Semanas de atraso que fazem estourar um motim. */
  MUTINY_AFTER_WEEKS: 2,
  /** Moral inicial perdida por dia de fome e por semana de salário atrasado. */
  HUNGER_MORALE_PER_DAY: 15,
  ARREARS_MORALE_PER_WEEK: 15,
  MIN_STARTING_MORALE: 20,
  /** Repor um soldado custa esta fração do preço "por soldado" do recrutamento. */
  REINFORCE_COST_FACTOR: 1.2,
  CONTRACTS_OFFERED: 3,
  /** Derrota contra amotinados: eles fogem levando esta fração do ouro. */
  MUTINY_GOLD_LOSS: 0.5,
  LOG_SIZE: 40,
} as const;

export interface FormationDef {
  label: string;
  /** Tecla de atalho (1–4). */
  key: string;
  spacing: number;
  speed: number;
  damageDealt: number;
  meleeTaken: number;
  rangedTaken: number;
  /** Se definido, as reduções de dano só valem para golpes vindos da frente (Parede de Escudos). */
  frontArc?: number;
  description: string;
}

export const FORMATIONS: Record<Formation, FormationDef> = {
  LINE: {
    label: "Linha",
    key: "1",
    spacing: 26,
    speed: 1,
    damageDealt: 1,
    meleeTaken: 1,
    rangedTaken: 1,
    description: "Equilibrada.",
  },
  SHIELD_WALL: {
    label: "Parede de Escudos",
    key: "2",
    spacing: 20,
    speed: 0.55,
    damageDealt: 0.8,
    meleeTaken: 0.5,
    rangedTaken: 0.25,
    frontArc: Math.PI / 3,
    description: "Lenta. Bloqueia golpes e flechas vindos da frente; flancos expostos.",
  },
  WEDGE: {
    label: "Cunha",
    key: "3",
    spacing: 24,
    speed: 1.1,
    damageDealt: 1.3,
    meleeTaken: 1.15,
    rangedTaken: 1.1,
    description: "Ofensiva: +30% de dano, recebe mais dano.",
  },
  LOOSE: {
    label: "Disperso",
    key: "4",
    spacing: 46,
    speed: 1.15,
    damageDealt: 0.9,
    meleeTaken: 1.1,
    rangedTaken: 0.5,
    description: "Espalhado: metade do dano de flechas, mais frágil no corpo a corpo.",
  },
};

export interface TerrainDef {
  label: string;
  speed: number;
  /** Multiplicador de velocidade para cavalaria (sofre mais em lama/pântano/floresta). */
  cavalrySpeed: number;
  /** Anula o acúmulo de investida da cavalaria. */
  breaksCharge: boolean;
  /** Ninguém passa (água funda, rocha). */
  blocked?: boolean;
}

export const TERRAIN: Record<TerrainType, TerrainDef> = {
  GRASS: { label: "Campo", speed: 1, cavalrySpeed: 1, breaksCharge: false },
  HILL: { label: "Colina", speed: 0.9, cavalrySpeed: 0.85, breaksCharge: false },
  MUD: { label: "Lama", speed: 0.6, cavalrySpeed: 0.45, breaksCharge: true },
  SWAMP: { label: "Pântano", speed: 0.45, cavalrySpeed: 0.35, breaksCharge: true },
  FOREST: { label: "Floresta", speed: 0.75, cavalrySpeed: 0.55, breaksCharge: true },
  /** Vau ou riacho: água pela cintura (Marco 11). */
  SHALLOW: { label: "Vau", speed: 0.55, cavalrySpeed: 0.45, breaksCharge: true },
  BRIDGE: { label: "Ponte", speed: 1, cavalrySpeed: 1, breaksCharge: false },
  WATER: { label: "Água funda", speed: 0, cavalrySpeed: 0, breaksCharge: true, blocked: true },
  MOUNTAIN: { label: "Montanha", speed: 0, cavalrySpeed: 0, breaksCharge: true, blocked: true },
  /** Muralhas, torres e construções dos povoados (Marco 12). */
  WALL: { label: "Muralha", speed: 0, cavalrySpeed: 0, breaksCharge: true, blocked: true },
  BUILDING: { label: "Construção", speed: 0, cavalrySpeed: 0, breaksCharge: true, blocked: true },
};

/** Rios, vaus, pontes e montanhas (Marco 11). */
export const GEO = {
  /** Célula do relevo e do clima (px de mundo): 8×6 células por região. */
  CELL: 600,
  /** Fração do mapa coberta pelo mar e fração da terra que é montanha. */
  OCEAN_SHARE: 0.36,
  MOUNTAIN_SHARE: 0.06,
  HILL_SHARE: 0.16,
  /** Largura dos rios por tipo (px). */
  RIVER_WIDTH: { STREAM: 40, RIVER: 90, GREAT: 160 },
  /** Comprimento (ao longo do rio) do tabuleiro da ponte e da faixa rasa do vau. */
  BRIDGE_LENGTH: 240,
  FORD_LENGTH: 240,
  /** Passos nas montanhas: raio de cada trecho escavado pela estrada. */
  PASS_RADIUS: 320,
  /** Vaus extras ao longo dos rios, um a cada tantos px de rio. */
  FORD_EVERY: 4200,
  /** Na água: dano recebido a mais (vau, riacho). */
  SHALLOW_DAMAGE_TAKEN: 1.25,
  /** Na água: quem luta sem apoio firme bate mais fraco. */
  SHALLOW_DAMAGE_DEALT: 0.8,
  /** Ponte: reconstruir (madeira comprada) e pedágio semanal de cada ponte do bando. */
  BRIDGE_REBUILD_GOLD: 150,
  BRIDGE_TOLL: 12,
  /** Queimar a ponte de um reino. */
  BRIDGE_BURN_RELATION: -15,
  /** Quem controla a ponte: dono do povoado mais próximo a até esta distância. */
  BRIDGE_CONTROL_RADIUS: 4000,
  /** Grade de navegação (px por célula). */
  NAV_CELL: 80,
} as const;

/** Como vários batalhões se dispõem entre si ao marchar juntos ou seguir o Comandante. */
export type GroupArrangement = "LINE" | "ARCHERS_BACK" | "CAVALRY_FLANKS" | "COLUMN";

export const ARRANGEMENTS: Record<GroupArrangement, { label: string; description: string }> = {
  LINE: { label: "Linha única", description: "Todos lado a lado." },
  ARCHERS_BACK: {
    label: "Arqueiros atrás",
    description: "Infantaria e cavalaria na frente; arqueiros numa fileira protegida atrás.",
  },
  CAVALRY_FLANKS: {
    label: "Cavalaria nos flancos",
    description: "Infantaria no centro, cavalaria nas pontas para flanquear, arqueiros atrás.",
  },
  COLUMN: {
    label: "Coluna",
    description: "Um atrás do outro (infantaria, cavalaria, arqueiros): estreito para lama e floresta.",
  },
};

/** Números de balanceamento: ajuste aqui, não espalhados pelo código. */
export const BALANCE = {
  COMMANDER: { hp: 220, speed: 210, damage: 22, range: 34, cooldown: 550, radius: 16 } satisfies UnitStats,
  /** Ângulo (rad) do golpe em arco do Comandante, para cada lado da direção em que ele olha. */
  COMMANDER_SWING_ARC: 1.0,
  GOBLIN_AGGRO_RANGE: 260,
  /** Distância da posição inicial a partir da qual o goblin desiste e volta. */
  GOBLIN_LEASH_RANGE: 650,

  BATTALION_SIZE: 8,
  /** Raio, em volta do ponto de ancoragem do batalhão, no qual os soldados engajam inimigos sozinhos. */
  ENGAGE_RADIUS: 220,
  /** Distância entre o Comandante e a primeira fileira de quem o segue. */
  FOLLOW_DISTANCE: 70,
  /** Máximo de batalhões lado a lado numa fileira do grupo antes de abrir outra atrás. */
  GROUP_ROW_MAX: 3,
  /** Espaço lateral entre batalhões lado a lado (marcha em grupo ou seguindo o Comandante). */
  GROUP_GAP: 30,
  /** Espaço entre uma fileira de batalhões e a de trás (folga para nomes e cavalaria comprida). */
  GROUP_ROW_GAP: 60,
  /** Raio em volta do Comandante usado pela tecla Q (selecionar batalhões próximos). */
  NEARBY_SELECT_RADIUS: 400,

  // Terreno
  /** Arqueiro na colina: multiplicador de alcance. */
  HILL_RANGE_BONUS: 1.4,
  /** Quem ataca de cima da colina contra alguém fora dela causa mais dano. */
  HILL_DAMAGE_BONUS: 1.15,
  /** Flechas contra alvos dentro da floresta (galhos atrapalham). */
  FOREST_RANGED_TAKEN: 0.6,
  /** Unidade na floresta só é percebida pelo inimigo a esta distância. */
  FOREST_DETECT_RANGE: 90,
  /** Inimigo na floresta só aparece para o jogador se houver um aliado a esta distância. */
  FOREST_REVEAL_RANGE: 140,
  /** Quem ataca de dentro da floresta fica visível por este tempo (ms). */
  REVEAL_AFTER_ATTACK_MS: 1500,

  // Investida da cavalaria
  CHARGE_MIN_DISTANCE: 140,
  CHARGE_MULTIPLIER: 2.5,
  CHARGE_KNOCKBACK: 16,

  // Flechas
  ARROW_SPEED: 650,
  /** O alvo precisa estar a esta distância do ponto de impacto (dá para desviar correndo). */
  ARROW_HIT_RADIUS: 22,

  MORALE: {
    MAX: 100,
    PANIC_BELOW: 25,
    RALLY_ABOVE: 50,
    LOSS_PER_DEATH: 12,
    /** Perda por segundo para cada soldado atacado pelo flanco/retaguarda. */
    FLANKED_PER_SOLDIER_PER_SEC: 2,
    /** Perda por segundo quando há 2x mais inimigos que soldados por perto. */
    OUTNUMBERED_PER_SEC: 4,
    RECOVERY_PER_SEC: 6,
    COMMANDER_AURA_PER_SEC: 2,
    COMMANDER_AURA_RADIUS: 180,
    THREAT_RADIUS: 200,
    /** Janela (ms) em que um golpe recebido ainda conta para detectar flanco. */
    HIT_MEMORY_MS: 1000,
  },

  HUD_UPDATE_MS: 100,
} as const;

/** Mundo contínuo, relógio, bandos errantes e viagem rápida (Marcos 7 e 12). */
export const WORLD = {
  REGION_WIDTH,
  REGION_HEIGHT,
  /** O chão e o terreno são criados em pedaços deste tamanho, só perto da câmera. */
  CHUNK_SIZE: 1600,
  /**
   * Bolha de detalhe: bandos a menos disto de alguém do bando viram unidades de verdade;
   * além de BUBBLE_EXIT_RADIUS (e sem ninguém lutando) voltam a ser só dados que marcham.
   */
  BUBBLE_RADIUS: 2400,
  BUBBLE_EXIT_RADIUS: 3200,
  /**
   * Relógio (Marco 12, rebalanceado para o mapa maior): o dia corre com a marcha — DAY_DISTANCE
   * px de marcha por dia (3 regiões; vale para andar e para a viagem rápida) — e também parado,
   * mais devagar: 1 dia a cada DAY_SECONDS segundos. Marchando no passo da infantaria, um dia
   * dura ≈ 1,5 min e a noite ≈ 30 s; parado, 6 min. Dentro das muralhas de um povoado só o
   * relógio "parado" corre (passear numa cidade grande não queima o dia).
   */
  DAY_DISTANCE: 14400,
  DAY_SECONDS: 360,
  /** Inimigos mais longe que isto de qualquer aliado ficam "adormecidos" (não pensam nem lutam). */
  ACTIVE_RADIUS: 1800,
  /** Combate: inimigo perseguindo um aliado ou a esta distância de uma tropa visível. */
  ENGAGE_RADIUS: 500,
  /** Sem inimigos ativos por este tempo, o combate acaba e sai o relatório. */
  ENGAGE_END_MS: 3000,
  /** Viagem rápida: proibida com inimigos à vista a menos disto do Comandante. */
  TRAVEL_BLOCK_RADIUS: 1000,
  /** Um bando cruza a rota a esta distância: a viagem é interrompida (interceptação). */
  INTERCEPT_RADIUS: 450,
  /** Prazo do contrato além da marcha estimada. */
  CONTRACT_GRACE_DAYS: 3,
  /** Exploração já conhecida no início (raio em volta de cidades e do acampamento). */
  KNOWN_RADIUS: 1500,
  WARBAND: {
    FIRST_DAY: 2,
    EVERY_DAYS: 2,
    MAX: 6,
    BASE_SIZE: 5,
    /** Bandos crescem com o tempo: +N goblins por semana de campanha. */
    GROWTH_PER_WEEK: 2,
    ARCHER_SHARE: 0.3,
    /** Velocidade de marcha do bando no mapa (px/s) e por dia de viagem rápida (≈ 1/3 do exército). */
    SPEED: 45,
    DAY_DISTANCE: 5000,
    /** Chegou a esta distância do centro do alvo (já dentro dos muros): saqueia. */
    RAID_RADIUS: 700,
    /** Saque a uma cidade: prosperidade perdida. */
    TOWN_RAID_PROSPERITY: 30,
    /** Saque ao acampamento vazio: fração das rações e do ouro levada. */
    CAMP_RAID_RATIONS: 0.4,
    CAMP_RAID_GOLD: 0.15,
    /** O acampamento está guardado se houver tropas a esta distância. */
    CAMP_GUARD_RADIUS: 900,
  },
  /** Prosperidade das cidades (0–100): recupera com o tempo; baixa = preços altos. */
  TOWN_PROSPERITY_REGEN: 4,
} as const;

/** Horas do dia, dia e noite (Marco 10). O dia é contado de aurora a aurora. */
export const TIME = {
  /** Hora em que o contador de dias vira (dayProgress 0 = 6h). */
  DAY_START_HOUR: 6,
  /** Aurora (escuridão diminuindo) e crepúsculo (aumentando), em horas. */
  DAWN: [5, 7] as const,
  DUSK: [18, 20] as const,
  /** Visão à noite: sem tochas e com tochas (multiplicador do raio). */
  NIGHT_VISION: 0.6,
  TORCH_VISION: 0.85,
  /** À noite, de quão longe o inimigo percebe o bando: tochas denunciam, o escuro esconde. */
  NIGHT_AGGRO_TORCHES: 1.4,
  NIGHT_AGGRO_DARK: 0.65,
  /** Marchar no escuro é mais lento (o cansaço de verdade chega com a fadiga, no Marco 13). */
  NIGHT_SPEED: 0.85,
  /** Criaturas da noite (goblins e mortos-vivos) ganham força e velocidade no escuro. */
  NIGHT_CREATURES: ["GOBLIN", "GOBLIN_ARCHER", "SKELETON", "NECROMANCER"] as readonly EnemyKind[],
  NIGHT_CREATURE_DAMAGE: 1.25,
  NIGHT_CREATURE_SPEED: 1.1,
  /** Emboscada noturna: inimigo que surge do escuro e ataca em poucos segundos abala a moral. */
  AMBUSH_MORALE: 20,
  AMBUSH_WINDOW_MS: 4000,
  /** Escuridão máxima da tela e a cor da noite. */
  DARKNESS_ALPHA: 0.74,
  DARKNESS_COLOR: 0x050a1f,
  /** Raio das luzes (px de mundo): tocha, fogueira, janelas dos povoados. */
  LIGHT: { TORCH: 170, BATTALION: 230, CAMPFIRE: 520, TOWN: 380, LAIR: 300 },
} as const;

/** Salvar e carregar (Marco 10). */
export const SAVE = {
  /** Versão do formato; saves de outra versão do gerador não são carregados. */
  VERSION: 3,
  /** Espaços manuais (além do automático). */
  SLOTS: 3,
} as const;

/** Reino do jogador, reinos rivais e calamidades (Marco 9). */
export const REALM = {
  /** Fundar uma vila: custo e distância mínima de outros povoados e do acampamento. */
  FOUND_COST: { gold: 250, iron: 10 },
  FOUND_MIN_DISTANCE: 3600,
  /** Reconstruir um povoado em ruínas. */
  REBUILD_COST: { gold: 180, iron: 15 },
  /** População máxima por tipo de povoado. */
  MAX_POPULATION: { VILLAGE: 300, CITY: 900, FORT: 500 },
  /** Defesa base de cada tipo de povoado (somada à guarnição). */
  BASE_DEFENSE: { VILLAGE: 2, CITY: 6, FORT: 12 },
  /** Guarnição máxima sem e com quartel. */
  GARRISON_CAP: 12,
  GARRISON_CAP_BARRACKS: 30,
  /** Armar milícia: +N homens por X de ouro. */
  MILITIA: { MEN: 5, GOLD: 40 },
  /** Impostos: multiplicador da renda e efeito diário na prosperidade. */
  TAX: [
    { label: "Baixos", income: 0.6, prosperity: 1 },
    { label: "Normais", income: 1, prosperity: 0 },
    { label: "Altos", income: 1.5, prosperity: -5 },
  ],
  /** Renda semanal: ouro por 10 habitantes (antes de impostos e prosperidade). */
  GOLD_PER_10_POP: 1,
  RATIONS_PER_25_POP: 1,
  POP_GROWTH: 0.06,
  /** Relação com reinos: guerra abaixo disto; tributo pela paz. */
  WAR_BELOW: -50,
  TRIBUTE: { GOLD: 150, RELATION: 45 },
  /** Contrato cumprido para um reino. */
  CONTRACT_RELATION: 10,
  /** Reino em guerra manda um exército a cada N dias (tamanho cresce com os povoados dele). */
  ARMY_EVERY_DAYS: 5,
  ARMY_BASE_SIZE: 6,
  /** Guarnição que aparece no cerco (máximo em campo). */
  SIEGE_MAX_DEFENDERS: 18,
  /** Calamidades: primeira entre os dias, intervalo após derrotar uma, hordas e crescimento. */
  CALAMITY_FIRST_DAY: [8, 12] as const,
  CALAMITY_GAP_DAYS: [20, 28] as const,
  HORDE_EVERY_DAYS: 3,
  HORDE_BASE_SIZE: 6,
  CALAMITY_POWER_EVERY_DAYS: 2,
  CALAMITY_REWARD: 400,
  CALAMITY_RELATION: 25,
  /** Títulos do Comandante pelo número de povoados que governa. */
  TITLES: [
    { min: 0, label: "Capitão mercenário" },
    { min: 1, label: "Senhor" },
    { min: 2, label: "Barão" },
    { min: 4, label: "Rei" },
  ],
} as const;

export type BuildingId = "FARM" | "MINE" | "MARKET" | "WALLS" | "BARRACKS";

/** Construções da Sala de Administração de um povoado do jogador. */
export const BUILDINGS: Record<BuildingId, { label: string; gold: number; iron: number; effect: string }> = {
  FARM: { label: "Fazendas", gold: 80, iron: 0, effect: "+12 rações por semana" },
  MINE: { label: "Mina", gold: 100, iron: 0, effect: "+5 ferro por semana" },
  MARKET: { label: "Mercado", gold: 120, iron: 5, effect: "+40% de impostos" },
  WALLS: { label: "Muralhas", gold: 150, iron: 15, effect: "defesa da guarnição em dobro" },
  BARRACKS: { label: "Quartel", gold: 120, iron: 10, effect: "+3 milicianos por semana, guarnição até 30" },
};
