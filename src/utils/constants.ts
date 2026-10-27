/** Resolução lógica do jogo (o Phaser escala para caber na janela). */
export const GAME_WIDTH = 1280;
export const GAME_HEIGHT = 720;

/** Tamanho do campo de batalha (maior que a tela; a câmera segue o Comandante). */
export const WORLD_WIDTH = 3200;
export const WORLD_HEIGHT = 2400;

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
export type EnemyKind = "GOBLIN" | "GOBLIN_ARCHER" | "MUTINEER" | "MUTINEER_ARCHER" | "MUTINEER_RIDER";
export type Formation = "LINE" | "SHIELD_WALL" | "WEDGE" | "LOOSE";
export type TerrainType = "GRASS" | "HILL" | "MUD" | "SWAMP" | "FOREST";
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
};

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
  SOLDIERS_PER_RATION: 4,
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
  /** Dias de volta ao acampamento após uma batalha. */
  RETURN_DAYS: 1,
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
}

export const TERRAIN: Record<TerrainType, TerrainDef> = {
  GRASS: { label: "Campo", speed: 1, cavalrySpeed: 1, breaksCharge: false },
  HILL: { label: "Colina", speed: 0.9, cavalrySpeed: 0.85, breaksCharge: false },
  MUD: { label: "Lama", speed: 0.6, cavalrySpeed: 0.45, breaksCharge: true },
  SWAMP: { label: "Pântano", speed: 0.45, cavalrySpeed: 0.35, breaksCharge: true },
  FOREST: { label: "Floresta", speed: 0.75, cavalrySpeed: 0.55, breaksCharge: true },
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
