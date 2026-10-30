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
  | "COURIER"
  /** Bicho do mato: alcateias atacam quem anda sozinho. */
  | "WOLF"
  /** Marco 14: caravana de mercadores (o mercador, os guardas e a carroça de carga). */
  | "MERCHANT"
  | "CARAVAN_GUARD"
  | "CART";
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
  | "BUILDING"
  /** Rio ou lago congelado no inverno (Marco 13): atravessa em qualquer ponto. */
  | "ICE";
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
  WOLF: {
    label: "Lobo",
    color: 0x7a7468,
    aggroRange: 480,
    stats: { hp: 38, speed: 190, damage: 7, range: 8, cooldown: 800, radius: 9 },
  },
  MERCHANT: {
    label: "Mercador",
    color: 0xd9b25f,
    aggroRange: 0,
    stats: { hp: 30, speed: 95, damage: 0, range: 6, cooldown: 2000, radius: 8 },
  },
  CARAVAN_GUARD: {
    label: "Guarda de caravana",
    color: 0x9a7b4f,
    stats: { hp: 55, speed: 100, damage: 8, range: 8, cooldown: 950, radius: 9 },
  },
  CART: {
    label: "Carroça de mercador",
    color: 0x8a6a3a,
    aggroRange: 0,
    stats: { hp: 160, speed: 90, damage: 0, range: 0, cooldown: 1e9, radius: 15 },
  },
};

/**
 * Lobos (Marco 12): alcateias nas matas e na tundra, longe dos povoados. Atacam quem anda
 * sozinho (até 1 companheiro a ESCORT_RADIUS) e fogem de grupos de GROUP_SIZE ou mais.
 */
export const WOLF = {
  PACK: [3, 5] as const,
  MAX_PACKS: 2,
  /** A cada tantos ms, uma chance de surgir uma alcateia perto de alguém do bando. */
  SPAWN_EVERY_MS: 15000,
  SPAWN_CHANCE: { DAY: 0.25, NIGHT: 0.6 },
  /** Distância de quem está sozinho em que a alcateia aparece (fora de vista). */
  SPAWN_DISTANCE: [1100, 1700] as const,
  ESCORT_RADIUS: 280,
  GROUP_RADIUS: 320,
  GROUP_SIZE: 3,
  SCARED_MS: 6000,
  LEASH: 2400,
  /** Alcateia longe de todos (ou assustada e fora de vista) some. */
  DESPAWN_DISTANCE: 3200,
  /** Pele de cada lobo abatido (ouro). */
  PELT_GOLD: 4,
} as const;

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
  SKIRMISH_WEIGHT: { GOBLIN: 1, HORDE: 1.5, FACTION: 1.2, PATROL: 1.3, COURIER: 0.5, REFUGEES: 0.1, CARAVAN: 1.1 } as Record<string, number>,
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
  /**
   * No acampamento o relógio fica parado — menos enquanto alguém treina: aí um dia passa em
   * tantos segundos (dá para assistir ao treino; ou esperar o fim de uma vez no Campo de Treino).
   */
  TRAINING_CAMP_DAY_SECONDS: 90,
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
  ICE: { label: "Gelo", speed: 0.8, cavalrySpeed: 0.6, breaksCharge: true },
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
  /** Balsas nos rios grandes (onde não há ponte): uma a cada tantos px de rio; preço e tempo da travessia. */
  FERRY_EVERY: 6500,
  FERRY_GOLD: 15,
  FERRY_DAYS: 0.1,
} as const;

/** Renda semanal de cada recurso da terra para o dono do povoado (Marco 12). */
export const RESOURCE_YIELD: Record<string, { gold?: number; rations?: number; iron?: number }> = {
  GRAIN: { rations: 8 },
  FISH: { rations: 6 },
  WOOD: { gold: 8 },
  STONE: { gold: 6 },
  IRON: { iron: 3 },
  SALT: { gold: 10 },
  FURS: { gold: 8 },
  HORSES: { gold: 8 },
  HERBS: { gold: 5 },
};

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
  NIGHT_CREATURES: ["GOBLIN", "GOBLIN_ARCHER", "SKELETON", "NECROMANCER", "WOLF"] as readonly EnemyKind[],
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
  VERSION: 7,
  /** Espaços manuais (além do automático). */
  SLOTS: 3,
} as const;

export type Season = "SPRING" | "SUMMER" | "AUTUMN" | "WINTER";
/** STORM: tempestade na costa e no mar (fechamento do Marco 13): os navios não saem do porto. */
export type Weather = "CLEAR" | "RAIN" | "FOG" | "SNOW" | "STORM";

/** Calendário e estações (Marco 13). */
export const SEASONS = {
  ORDER: ["SPRING", "SUMMER", "AUTUMN", "WINTER"] as readonly Season[],
  LABEL: { SPRING: "Primavera", SUMMER: "Verão", AUTUMN: "Outono", WINTER: "Inverno" } as Record<Season, string>,
  /** Dias de cada estação (o ano tem 4 × DAYS). */
  DAYS: 20,
  /** A campanha começa no 11º dia da primavera (a cheia já passou). */
  START_OFFSET: 10,
  /** Primavera: lama fora das estradas. */
  SPRING_MUD: 0.8,
  /** Cheia: nos primeiros dias da primavera os vaus dos rios (não os riachos) ficam fundos. */
  FLOOD_DAYS: 6,
  /** Inverno: neve onde a temperatura é baixa (norte e montanhas): lenta fora da estrada. */
  SNOW_BELOW: 0.46,
  SNOW_SPEED: 0.6,
  SNOW_ROAD_SPEED: 0.85,
  /** Inverno: rios e lagos congelam abaixo desta temperatura; perto do limite o gelo é fino. */
  FREEZE_BELOW: 0.4,
  THIN_ICE: 0.05,
  /** Gelo fino: chance por segundo de um cavaleiro ou carroça afundar (e o dano, fração da vida). */
  THIN_ICE_CHANCE: 0.04,
  THIN_ICE_DAMAGE: 0.6,
  /** Outono: colheita (comida barata, renda de rações maior, impostos rurais) e feiras. */
  HARVEST_RATION_PRICE: 0.7,
  HARVEST_RATIONS: 1.5,
  HARVEST_GOLD: 1.2,
  FAIR_PROSPERITY: 6,
  /** Verão: temporada de campanha (exércitos saem mais vezes, um contrato a mais na mesa). */
  SUMMER_ARMY_EVERY: 0.6,
  /** Inverno: goblins saem menos dos covis; orcs se arrastam; os reinos param. */
  WINTER_GOBLIN_EVERY: 2,
  WINTER_HORDE_EVERY: 1.5,
} as const;

/** Clima diário por região (Marco 13). */
export const WEATHER = {
  LABEL: { CLEAR: "Céu limpo", RAIN: "Chuva", FOG: "Nevoeiro", SNOW: "Neve", STORM: "Tempestade" } as Record<Weather, string>,
  ICON: { CLEAR: "☀", RAIN: "☔", FOG: "🌫", SNOW: "❄", STORM: "⛈" } as Record<Weather, string>,
  /** Cada célula de clima tem este tamanho (2×2 regiões): o tempo muda de lugar para lugar. */
  CELL_REGIONS: 2,
  /** Chance de chuva (ou neve, no frio do inverno) e de nevoeiro por estação. */
  CHANCE: {
    SPRING: { wet: 0.35, fog: 0.15 },
    SUMMER: { wet: 0.15, fog: 0.05 },
    AUTUMN: { wet: 0.3, fog: 0.22 },
    WINTER: { wet: 0.35, fog: 0.15 },
  } as Record<Season, { wet: number; fog: number }>,
  /** Chuva: arqueiros e bestas com menos alcance; o chão fora da estrada vira lama. */
  RAIN_RANGE: 0.75,
  RAIN_MUD: 0.9,
  /** Tempestade (costa e mar, no outono e no inverno): arcos quase inúteis, vento e mar bravo. */
  STORM_RANGE: 0.6,
  /** Dos dias de chuva na costa e no mar, quantos viram tempestade no outono e no inverno. */
  STORM_SHARE: 0.45,
  /** Até onde a tempestade entra terra adentro (px do mar). */
  STORM_REACH: 2600,
  /** Visão do bando (e percepção dos inimigos) conforme o tempo. */
  VISION: { CLEAR: 1, RAIN: 0.85, FOG: 0.5, SNOW: 0.75, STORM: 0.6 } as Record<Weather, number>,
} as const;

/** Fadiga por batalhão (Marco 13): 0 descansado, 100 exausto. */
export const FATIGUE = {
  /** Um dia inteiro de marcha (DAY_DISTANCE) cansa isto. */
  MARCH_PER_DAY: 28,
  /** Multiplicadores: marcha noturna, terreno ruim (lama, pântano, floresta, vau, neve) e marcha forçada. */
  NIGHT: 2,
  ROUGH: 1.5,
  FORCED: 2.5,
  /** Lutando: por segundo, para cada batalhão com gente em combate. */
  COMBAT_PER_SEC: 0.5,
  /** Parado: recupera por dia de relógio (ao relento) e por segundo de verdade nos alojamentos. */
  REST_PER_DAY: 60,
  CAMP_PER_SEC: 2,
  /** Descansar até o amanhecer. */
  NIGHT_REST: { FIELD: 45, CAMP: 100 },
  /** A partir daqui fica mais lento, e o efeito cresce até 100. */
  SLOW_FROM: 40,
  MAX_SLOW: 0.3,
  MAX_DAMAGE_LOSS: 0.25,
  MAX_RECOVERY_LOSS: 0.6,
  EXHAUSTED: 80,
  /** Marcha forçada: o dia rende mais caminho e as tropas andam mais depressa. */
  FORCED_DAY: 1.35,
  FORCED_SPEED: 1.2,
} as const;

/** Trem de carroças e forragem (Marco 13). */
export const SUPPLY = {
  /** Mochilas: o que a tropa carrega sem carroças; cada carroça leva mais isto. */
  PACK_CAPACITY: 20,
  WAGON_CAPACITY: 60,
  START_WAGONS: 2,
  MAX_WAGONS: 6,
  WAGON_COST: 60,
  /** Ao sair do acampamento as carroças carregam, mas deixam rações para tantos dias de quem fica. */
  CAMP_RESERVE_DAYS: 3,
  WAGON: { hp: 140, speed: 115, damage: 0, range: 0, cooldown: 1e9, radius: 16 } satisfies UnitStats,
  /** Terreno ruim (lama, pântano, floresta, neve): carroças andam muito mais devagar. */
  WAGON_ROUGH: 0.55,
  /** Goblins e bandidos preferem as carroças (a distância delas "conta" menos). */
  WAGON_LURE: 0.55,
  /** Forragear: rações por soldado, tempo gasto, esgotamento da região e quanto volta por dia. */
  FORAGE_PER_SOLDIER: 0.6,
  FORAGE_DAYS: 0.25,
  FORAGE_DEPLETION: 0.4,
  FORAGE_REGROW_PER_DAY: 0.03,
  FORAGE_SEASON: { SPRING: 0.6, SUMMER: 1, AUTUMN: 1.3, WINTER: 0.2 } as Record<Season, number>,
  FORAGE_BIOME: { DESERT: 0.2, TUNDRA: 0.3, MOUNTAINS: 0.2, MARSH: 0.6, STEPPE: 0.7, PLAINS: 1.1, FOREST: 0.9, DEEP_FOREST: 0.8, HILLS: 0.8, COAST: 0.9, OCEAN: 0 } as Record<string, number>,
  /** Forragear nas terras de um reino irrita o dono. */
  FORAGE_RELATION: -4,
  FORAGE_OWNER_RADIUS: 5000,
} as const;

/** Feridos, enfermaria e doenças (Marco 13). */
export const HEALTH = {
  /** Fração dos que caem em combate que fica ferida (e não morta); com curandeira, mais. */
  WOUNDED_SHARE: 0.4,
  WOUNDED_SHARE_HEALER: 0.55,
  /** Por dia: chance de cada ferido voltar ou morrer, na enfermaria (acampamento) ou no campo. */
  RECOVER: { CAMP: 0.3, FIELD: 0.12 },
  DIE: { CAMP: 0.02, FIELD: 0.08 },
  HEALER_RECOVER: 0.1,
  HEALER_DIE: 0.5,
  /** Doentes: chance por dia de sarar ou morrer, e de passar a doença a um companheiro. */
  SICK_RECOVER: { CAMP: 0.25, FIELD: 0.12 },
  SICK_DIE: { CAMP: 0.03, FIELD: 0.07 },
  SPREAD: 0.06,
  /** Surto: chance por batalhão e por dia conforme o que expõe a tropa. */
  OUTBREAK: { SWAMP: 0.08, HUNGER: 0.1, COLD: 0.08, CROWDED: 0.06, SICK_TOWN: 0.12 },
  /** Acampamento lotado: soldados acima disto. */
  CAMP_CROWD: 60,
  /** Povoado com febre: dias que dura; chance semanal de passar ao vizinho pela estrada. */
  TOWN_SICK_DAYS: 10,
  TOWN_SPREAD: 0.35,
  TOWN_SPREAD_RADIUS: 9000,
} as const;

/** Acampamento móvel e fortificações (Marco 13). */
export const CAMP_MOVE = {
  /** Levantar e montar o acampamento (dias de trabalho). */
  PACK_DAYS: 1.5,
  PITCH_DAYS: 1,
  /** Distância mínima de povoados e locais para montar. */
  MIN_TOWN_DISTANCE: 3000,
  /** Acampamento levantado: as carroças levam tudo, mas a coluna é mais lenta. */
  PACKED_SPEED: 0.85,
} as const;

export type CampWork = "PALISADE" | "TOWERS" | "DITCH";
/** Melhorias de um acampamento fixo (perdidas ao levantar o acampamento). */
export const CAMP_WORKS: Record<CampWork, { label: string; gold: number; iron: number; effect: string }> = {
  PALISADE: { label: "Paliçada reforçada", gold: 120, iron: 6, effect: "Um ataque ao acampamento desguarnecido leva 35% menos." },
  TOWERS: { label: "Torres de vigia", gold: 90, iron: 4, effect: "Vigias enxergam longe em volta do acampamento; ataques levam 25% menos." },
  DITCH: { label: "Fosso", gold: 70, iron: 0, effect: "Lama funda em volta da paliçada (só o portão é firme); ataques levam 25% menos." },
};
/** Quanto cada obra reduz o saque ao acampamento desguarnecido. */
export const CAMP_WORK_RAID: Record<CampWork, number> = { PALISADE: 0.35, TOWERS: 0.25, DITCH: 0.25 };

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
  /**
   * Guarnição de cada tipo de povoado no começo da campanha. Os reinos repõem 1 homem por
   * semana até esse número (os povoados do bando crescem até o teto, acima).
   */
  BASE_GARRISON: { VILLAGE: 6, CITY: 14, FORT: 20 },
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
  /**
   * Cerco (Marco 12: a guarnição mora nos acampamentos dos portões e sai de lá para lutar).
   * Máximo em campo; abaixo do mínimo, moradores armados (milícia) completam a defesa.
   */
  SIEGE_MAX_DEFENDERS: 30,
  SIEGE_MIN_DEFENDERS: 5,
  /** Em guerra, o exército a esta distância dos muros faz a guarnição sair para lutar. */
  SALLY_RADIUS: 800,
  /** O bando se afastou tanto dos muros (sem combate): o cerco é levantado. */
  SIEGE_LEAVE_RADIUS: 2600,
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

export type BuildingId =
  | "FARM"
  | "MINE"
  | "MARKET"
  | "WALLS"
  | "BARRACKS"
  /** Marco 14: construções ligadas às cadeias de produção. */
  | "SAWMILL"
  | "SALTWORKS"
  | "WEAVERY"
  | "PASTURE"
  | "MILL"
  | "PORT";

/**
 * Construções da Sala de Administração de um povoado do jogador (os povoados dos reinos
 * também as têm, conforme a terra). `needs`: só onde há o recurso, o rio ou o mar.
 */
export const BUILDINGS: Record<
  BuildingId,
  { label: string; gold: number; iron: number; effect: string; needs?: "RIVER" | "PORT" | "SALT" | "WOOD" }
> = {
  FARM: { label: "Fazendas", gold: 80, iron: 0, effect: "lavouras maiores: muito mais grão" },
  MINE: { label: "Mina", gold: 100, iron: 0, effect: "ferro (o dobro onde a terra dá ferro)" },
  MARKET: { label: "Mercado", gold: 120, iron: 5, effect: "+40% de impostos e da taxa de mercado" },
  WALLS: { label: "Muralhas", gold: 150, iron: 15, effect: "defesa da guarnição em dobro" },
  BARRACKS: { label: "Quartel", gold: 120, iron: 10, effect: "+3 milicianos por semana, guarnição até 30; a armaria faz mais armas" },
  SAWMILL: { label: "Serraria", gold: 90, iron: 4, effect: "madeira", needs: "WOOD" },
  SALTWORKS: { label: "Salina", gold: 90, iron: 2, effect: "sal", needs: "SALT" },
  WEAVERY: { label: "Tecelagem", gold: 110, iron: 3, effect: "tecido (gasta um pouco de carne: lã e couro)" },
  PASTURE: { label: "Pastagem", gold: 70, iron: 0, effect: "carne; cavalos onde a terra dá cavalos" },
  MILL: { label: "Moinho", gold: 100, iron: 4, effect: "+25% de grão e mais cerveja", needs: "RIVER" },
  PORT: { label: "Porto", gold: 160, iron: 8, effect: "navios trazem luxos e sal; mais caravanas pelo mar", needs: "PORT" },
};

// --- Economia e comércio (Marco 14) ---

export type Good = "GRAIN" | "MEAT" | "SALT" | "WOOD" | "IRON" | "CLOTH" | "ALE" | "ARMS" | "HORSES" | "LUXURY";
export const GOOD_LIST: readonly Good[] = ["GRAIN", "MEAT", "SALT", "WOOD", "IRON", "CLOTH", "ALE", "ARMS", "HORSES", "LUXURY"];

/**
 * Bens: preço base (ouro por unidade) e peso nas carroças (cada carroça leva 60; uma ração
 * pesa 1). Cavalos andam sozinhos (peso 0). Uma unidade de grão ou de carne vira 10 rações.
 */
export const GOODS: Record<Good, { label: string; icon: string; base: number; weight: number; color: string }> = {
  GRAIN: { label: "Grão", icon: "🌾", base: 10, weight: 10, color: "#d9b44a" },
  MEAT: { label: "Carne", icon: "🥩", base: 14, weight: 10, color: "#c0584a" },
  SALT: { label: "Sal", icon: "🧂", base: 16, weight: 5, color: "#e8e4dc" },
  WOOD: { label: "Madeira", icon: "🪵", base: 6, weight: 15, color: "#a0784a" },
  IRON: { label: "Ferro", icon: "⛓", base: 8, weight: 2, color: "#8fa6b8" },
  CLOTH: { label: "Tecido", icon: "🧵", base: 20, weight: 4, color: "#b07ac0" },
  ALE: { label: "Cerveja e vinho", icon: "🍺", base: 12, weight: 6, color: "#e0a040" },
  ARMS: { label: "Armas e armaduras", icon: "⚔", base: 45, weight: 6, color: "#a0a8b0" },
  HORSES: { label: "Cavalos", icon: "🐎", base: 55, weight: 0, color: "#c08a50" },
  LUXURY: { label: "Luxos", icon: "💎", base: 80, weight: 1, color: "#e07ac0" },
};

/** Necessidade (o que a gente consome): os bens e a comida (grão ou carne). */
export type Need = Good | "FOOD";

/** Mercado dos povoados (Marco 14): estoque, oferta e procura, nível de vida. */
export const MARKET = {
  /** Preço = base × (procura de tantos dias ÷ estoque), entre os limites. */
  DEMAND_DAYS: 12,
  MIN_PRICE: 0.3,
  MAX_PRICE: 4,
  /** O preço anda esta fração por dia rumo ao novo valor (compras e vendas mexem na hora). */
  PRICE_SMOOTHING: 0.35,
  /** Margem do mercador: o bando compra mais caro e vende mais barato. */
  BUY_MARKUP: 1.08,
  SELL_MARKDOWN: 0.92,
  /** Estoque inicial (dias de procura) e teto (dias de procura e de produção, mais uma folga). */
  START_DAYS: 10,
  CAP_DAYS: 40,
  CAP_BASE: 25,
  CAP_PRODUCTION_DAYS: 15,
  /** Perda diária: comida estraga (com sal no mercado, a carne dura mais). */
  DECAY: { GRAIN: 0.005, MEAT: 0.03, ALE: 0.005 } as Partial<Record<Good, number>>,
  SALTED_MEAT_DECAY: 0.01,
  /** Gente por camada social, por tipo de povoado. */
  STRATA: {
    VILLAGE: { peasants: 0.92, burghers: 0.07, nobles: 0.01 },
    CITY: { peasants: 0.55, burghers: 0.38, nobles: 0.07 },
    FORT: { peasants: 0.6, burghers: 0.25, nobles: 0.15 },
  },
  /** Necessidades por 100 pessoas por dia (comida = grão ou carne, o mais barato primeiro). */
  NEEDS: {
    peasants: { FOOD: 1, SALT: 0.1, CLOTH: 0.08, ALE: 0.15, WOOD: 0.3 },
    burghers: { FOOD: 1.1, SALT: 0.15, CLOTH: 0.3, ALE: 0.4, WOOD: 0.4, IRON: 0.2, LUXURY: 0.03, ARMS: 0.02 },
    nobles: { FOOD: 1.5, CLOTH: 1, ALE: 1, LUXURY: 0.5, HORSES: 0.05, ARMS: 0.1 },
  } as Record<"peasants" | "burghers" | "nobles", Partial<Record<Need, number>>>,
  /** Guarnição: por soldado por dia. */
  GARRISON: { FOOD: 0.03, ARMS: 0.004, HORSES: 0.0015 } as Partial<Record<Need, number>>,
  /** Reino em guerra (com o bando ou com outro reino): armas e cavalos muito procurados. */
  WAR_DEMAND: { ARMS: 3, HORSES: 3, FOOD: 1.3 } as Partial<Record<Need, number>>,
  /** Calamidade por perto: a gente estoca comida. */
  HOARD_RADIUS: 9000,
  HOARD_FOOD: 1.25,
  /** Inverno: lenha em dobro. */
  WINTER_WOOD: 2,
  /** Peso de cada necessidade no nível de vida (0–100). */
  SOL_WEIGHT: { FOOD: 0.5, SALT: 0.08, CLOTH: 0.12, ALE: 0.12, WOOD: 0.1, LUXURY: 0.08 } as Partial<Record<Need, number>>,
  /** Lavouras por estação (a colheita do outono enche os celeiros; o inverno os esvazia). */
  HARVEST: { SPRING: 0.85, SUMMER: 1, AUTUMN: 1.7, WINTER: 0.45 } as Record<Season, number>,
  /** Fome: comida abaixo desta fração da necessidade (gente morre, a prosperidade despenca). */
  FAMINE_BELOW: 0.5,
  /** Prosperidade por dia: base + (nível de vida − 60) ÷ 25. */
  PROSPERITY_BASE: 1.5,
  /** Agitação (povoados do bando): sobe com nível de vida baixo; em 100, revolta. */
  UNREST_BELOW_SOL: 40,
  REVOLT_DAYS: 14,
  /** Comércio miúdo entre vizinhos: fração do estoque que passa por dia (e até que distância). */
  DIFFUSION: 0.02,
  /** Produção conforme o preço do que se faz (barato: menos gente trabalha nisso; caro: mais). */
  ELASTIC: [0.45, 1.25] as const,
  DIFFUSION_RADIUS: 18000,
  /** Amostras do histórico de preços (uma a cada 2 dias). */
  HISTORY: 20,
} as const;

/** Caravanas dos mercadores (Marco 14). */
export const CARAVAN = {
  /** Carga de uma caravana (peso). */
  CAPACITY: 200,
  /** No máximo uma caravana na estrada por tantos povoados. */
  PER_SETTLEMENTS: 1,
  MAX: 24,
  /** Chance diária de um povoado mandar uma caravana. */
  DAILY_CHANCE: 0.3,
  /** Lucro esperado mínimo para valer a viagem; e o custo da viagem por dia de estrada. */
  MIN_PROFIT: 25,
  COST_PER_DAY: 8,
  /** Distância máxima (dias de estrada). */
  MAX_DAYS: 3.5,
  /** Guardas por caravana. */
  GUARDS: [2, 4] as const,
  /** Barcaças (rio) e navios (costa): carga maior; o mar fecha com a tempestade. */
  BARGE_CAPACITY: 200,
  SHIP_CAPACITY: 260,
  /** Dias de rio por dia de estrada: rio abaixo é mais rápido, rio acima mais lento. */
  BARGE_SPEED: { DOWN: 1.5, UP: 0.7 },
  SHIP_SPEED: 1.8,
  /** Navio no mar numa tempestade: chance por dia de afundar com a carga. */
  STORM_SINK: 0.25,
  /** Saquear uma caravana: honra e relação com o reino dono. */
  ROB_HONOR: -8,
  ROB_RELATION: -12,
  /** Prosperidade que uma caravana leva ao destino (e à origem, ao comprar). */
  PROSPERITY: 2,
} as const;

/** Comércio do bando (Marco 14). */
export const TRADE = {
  /** O Comandante sozinho leva pouca coisa (a bolsa: peso). */
  PURSE_CAPACITY: 6,
  /** Carroças até esta distância do Comandante contam para comprar e vender. */
  WAGON_REACH: 2600,
  /** Carga pesada atrasa: as carroças cheias de mercadoria andam até isto mais devagar. */
  LOAD_SLOW: 0.15,
  /** Contrabando (vender num reino em guerra com o de origem da carga): preço e risco. */
  SMUGGLE_BONUS: 1.5,
  SMUGGLE_CATCH: 0.25,
  SMUGGLE_FINE: 0.5,
  SMUGGLE_RELATION: -10,
  /** Feitoria: preço, manutenção semanal, margem melhor e preços sempre frescos. */
  POST_COST: 300,
  POST_UPKEEP: 6,
  POST_MARGIN: 0.05,
  /** Investir numa guilda: constrói a oficina no povoado e paga dividendos semanais. */
  GUILD_COST: 250,
  GUILD_SHARE: 0.35,
  /** Empréstimo da casa de câmbio: juros por semana; atrasar custa honra e relação. */
  LOAN_SIZES: [200, 500] as const,
  LOAN_INTEREST: 0.06,
  LOAN_WEEKS: 6,
  LOAN_DEFAULT_HONOR: -10,
  LOAN_DEFAULT_RELATION: -20,
  /** Caravana própria: carroça, guardas e caravaneiro; salário semanal. */
  OWN_CARAVAN_COST: 220,
  OWN_CARAVAN_WAGE: 18,
  OWN_CARAVAN_MAX: 3,
  /** Taxa de mercado dos povoados do bando (por caravana que chega): baixa, normal e alta. */
  MARKET_TAX: [0.02, 0.05, 0.1] as const,
  /** Uma rodada na taverna: notícias e preços de longe. */
  TAVERN_ROUND: 8,
  /** Ração de cerveja: por semana, cada 20 soldados bebem 1 unidade; humor do acampamento. */
  ALE_PER_20: 1,
  ALE_MOOD: 6,
  /** Cavalaria: um cavalo por cavaleiro (recrutar e repor). */
  HORSES_PER_RIDER: 1,
  /** Livro de Preços: observações guardadas por povoado. */
  BOOK_HISTORY: 10,
  /** Rações por unidade de grão ou carne (a Intendência converte). */
  RATIONS_PER_FOOD: 10,
  /** O vivandeiro do acampamento vende rações a este múltiplo do preço do mercado mais perto. */
  SUTLER_MARKUP: 1.3,
} as const;
