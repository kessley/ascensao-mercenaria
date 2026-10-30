import Phaser from "phaser";
import { Unit } from "./Unit";
import { BALANCE, COLORS, ENEMIES, FORMATIONS, SIEGE, TIME, WOLF, type AttackKind, type EnemyKind } from "../../utils/constants";
import { angleDiff, angleTo, distance, type Point } from "../../utils/math";
import type { EnemySquad, SquadCommand, SquadOrder } from "../systems/EnemySquad";

/**
 * Goblin: quadrado vermelho. IA simples de aggro → perseguição → ataque, com coleira.
 * Arqueiros param assim que o alvo entra no alcance e atiram de longe.
 */
export class Enemy extends Unit {
  /**
   * Alcance de percepção dos inimigos em relação ao normal: à noite, tochas denunciam o bando
   * de longe e o escuro o esconde (a cena atualiza a cada quadro).
   */
  static perception = 1;
  /** O mesmo para quem anda sem tocha (batedores): vale o escuro, com o bando de tochas acesas ou não. */
  static darkPerception = 1;
  /** O tempo (nevoeiro, neve, chuva) encurta de quão longe todos percebem o bando. */
  static weatherSight = 1;
  /** Alguém avistou um batedor: a cena decide quem vai atrás dele (o bando inteiro, não). */
  static onSpot: ((e: Enemy, scout: Unit) => void) | null = null;

  readonly kind: EnemyKind;
  /** Para onde volta sem alvo. Num bando errante, acompanha a marcha do bando. */
  home: Point;
  /** De quem é este inimigo no mundo: contrato ativo, bando errante ou motim. */
  owner:
    | { kind: "CONTRACT"; contractId: string }
    | { kind: "WARBAND"; id: string }
    | { kind: "MUTINY" }
    /** Soldado da guarnição de um povoado (ou morador armado num cerco: `militia`). */
    | { kind: "GARRISON"; settlementId: string; militia?: boolean }
    | { kind: "CALAMITY"; id: string }
    /** Bichos do mundo (alcateias de lobos). */
    | { kind: "WILDLIFE"; pack: number }
    | null = null;
  /**
   * Lado no mundo: os do povoado (guarnições, patrulhas, exércitos dos reinos) e os selvagens
   * (goblins, hordas, ocupantes de calamidade) lutam entre si de verdade quando se encontram.
   */
  side: "WILD" | "TOWN" | null = null;
  /** O que fazer sem alvo (guarda no posto, ronda pelas ruas...); null = voltar para casa. */
  routine: ((dt: number) => void) | null = null;
  /** Guarnição de um povoado do bando: aliada (círculo), nunca hostil nem provocável. */
  friendly = false;
  /** Lobo assustado por um grupo: foge até este momento (tempo da cena). */
  private scaredUntil = 0;
  /** Cor do corpo (soldados dos reinos usam a cor da facção). */
  readonly bodyColor: number;
  /** Longe de todos os aliados: não pensa nem luta (economia de processamento). */
  dormant = false;
  /**
   * Hostil ao bando do jogador? Patrulhas e mensageiros de um reino em paz e refugiados não
   * são (Marco 12): não atacam, não entram no combate nem nos alvos automáticos das tropas.
   */
  hostile = true;
  /** Alguém do bando atacou este não-hostil: ele (e o bando dele) passa a lutar, e o dono fica sabendo. */
  provoked = false;
  /** Escolhido para ir atrás de um batedor visto (os outros ficam com o bando). */
  huntsScouts = false;
  /** Defensor no alto da muralha (Marco 16): alcança mais, bate mais forte, apanha menos de flecha. */
  onWall = false;
  /** Cerco: o defensor não sai por aí atrás de quem está do lado de fora dos muros. */
  keepInside: { x: number; y: number; w: number; h: number } | null = null;
  /** Reino de quem marcha em exército ou patrulha: reinos em guerra lutam de verdade na bolha. */
  factionId: string | null = null;
  /** Marco 16: o esquadrão em que este soldado luta (null = cada um por si, à moda antiga). */
  squad: EnemySquad | null = null;
  /** Quem manda nele (também vale para batedores e arautos, que andam fora dos esquadrões). */
  command: SquadCommand | null = null;
  /** Lugar na formação do esquadrão. */
  slot = 0;
  /** Próxima olhada em volta: ninguém procura alvo a cada quadro. */
  nextLookAt = 0;
  /** De quem foge (lido de tempos em tempos) e até quando continua na lista dos que fogem. */
  fleeFrom: Point | null = null;
  routedAt = 0;
  /** Quem manda neste soldado por fora do esquadrão: batedores e arautos do inimigo. */
  driver: ((dt: number) => void) | null = null;
  /** Arauto levando uma ordem. */
  mission: { squad: EnemySquad; order: SquadOrder } | null = null;
  /** Para onde o batedor inimigo está indo e quem ele quer interceptar. */
  wanderGoal: Point | null = null;
  intercept: Unit | null = null;
  private titleText: Phaser.GameObjects.Text | null = null;

  constructor(scene: Phaser.Scene, x: number, y: number, kind: EnemyKind = "GOBLIN", color?: number) {
    super(scene, x, y, "ENEMY", ENEMIES[kind].stats);
    this.kind = kind;
    this.bodyColor = color ?? ENEMIES[kind].color;
    this.canCharge = kind === "MUTINEER_RIDER" || kind === "OUTRIDER" || kind === "WOLF_RIDER" || kind === "LANCER";
    this.home = { x, y };
    this.drawBody();
  }

  /** Oficial: o nome aparece sobre ele (o jogador tem de saber em quem mirar). */
  setTitle(title: string | null): void {
    this.titleText?.destroy();
    this.titleText = null;
    if (!title) return;
    this.titleText = this.scene.add.text(0, -this.radius - 20, title, { fontFamily: "monospace", fontSize: "11px", color: "#ffe0a0", stroke: "#000000", strokeThickness: 3 }).setOrigin(0.5);
    this.add(this.titleText);
  }

  /** Mostra o escudo na Parede de Escudos. */
  showShield(on: boolean): void {
    if (this.shielded === on) return;
    this.shielded = on;
    this.drawBody();
  }

  private shielded = false;

  /** Passa a decisão à cena: quem vai atrás do batedor avistado. */
  spotScout(u: Unit): void {
    Enemy.onSpot?.(this, u);
  }

  /** Fugindo ou deixando o campo: no fim do combate conta como derrotado. */
  get routed(): boolean {
    return !!this.squad?.panicking || !!this.command?.retreating;
  }

  /** Sumiu do mapa fugindo: não conta como abate. */
  fled = false;

  override speedMultiplier(): number {
    const sq = this.squad;
    if (!sq) return super.speedMultiplier();
    return super.speedMultiplier() * FORMATIONS[sq.formation].speed * (sq.leaderPassive?.speed ?? 1);
  }

  override attackRange(): number {
    return super.attackRange() * (this.squad?.leaderPassive?.range ?? 1) * (this.onWall && this.ranged ? SIEGE.WALL_RANGE : 1);
  }

  override outgoingDamage(target: Unit): number {
    const sq = this.squad;
    if (!sq) return super.outgoingDamage(target) * (this.onWall ? SIEGE.WALL_DAMAGE : 1);
    // Na água a formação se desfaz, como para o bando do jogador
    const formation = this.inShallows ? 1 : FORMATIONS[sq.formation].damageDealt;
    return super.outgoingDamage(target) * formation * (sq.leaderPassive?.damage ?? 1);
  }

  override incomingMultiplier(source: Unit, kind: AttackKind): number {
    const base = super.incomingMultiplier(source, kind) * (this.onWall && kind === "RANGED" ? SIEGE.WALL_ARROW_TAKEN : 1);
    const sq = this.squad;
    if (!sq) return base;
    const withPassive = base * (sq.leaderPassive?.taken ?? 1);
    if (this.inShallows) return withPassive;
    const f = FORMATIONS[sq.formation];
    if (f.frontArc !== undefined && angleDiff(sq.facing, angleTo(this, source)) > f.frontArc) return withPassive;
    return withPassive * (kind === "RANGED" ? f.rangedTaken : f.meleeTaken);
  }

  /** Guarnição de um povoado do bando: aliada, desenhada como as tropas do bando (círculo). */
  setFriendly(friendly: boolean): void {
    this.friendly = friendly;
    if (friendly) this.hostile = false;
    this.drawBody();
  }

  protected drawBody(): void {
    const g = this.bodyGfx;
    const s = this.radius;
    g.clear();
    if (this.friendly) {
      g.fillStyle(this.bodyColor, 1);
      g.fillCircle(0, 0, s);
      g.lineStyle(2, COLORS.OUTLINE, 1);
      g.strokeCircle(0, 0, s);
      g.fillStyle(COLORS.OUTLINE, 1);
      g.fillRect(s - 4, -2, 4, 4);
      return;
    }
    if (this.kind === "CART") {
      // Carroça de mercador: caixa de madeira com toldo e rodas (olhando para +X)
      g.fillStyle(0x2a1c10, 1);
      for (const [wx, wy] of [[-s * 0.7, -s * 0.75], [s * 0.7, -s * 0.75], [-s * 0.7, s * 0.75], [s * 0.7, s * 0.75]]) g.fillCircle(wx, wy, s * 0.32);
      g.fillStyle(this.bodyColor, 1);
      g.fillRect(-s * 1.2, -s * 0.65, s * 2.4, s * 1.3);
      g.fillStyle(0xe8dcc0, 1);
      g.fillRect(-s * 1.0, -s * 0.55, s * 1.6, s * 1.1);
      g.lineStyle(2, COLORS.OUTLINE, 1);
      g.strokeRect(-s * 1.2, -s * 0.65, s * 2.4, s * 1.3);
      g.lineBetween(s * 1.2, 0, s * 1.7, 0);
      return;
    }
    if (this.kind === "WOLF") {
      // Lobo: corpo alongado, focinho e orelhas
      g.fillStyle(this.bodyColor, 1);
      g.fillEllipse(0, 0, s * 2.6, s * 1.4);
      g.fillTriangle(s * 1.1, -s * 0.5, s * 1.9, 0, s * 1.1, s * 0.5);
      g.fillStyle(0x3b3b3b, 1);
      g.fillTriangle(s * 0.7, -s * 0.7, s * 1.0, -s * 1.1, s * 1.1, -s * 0.5);
      g.fillTriangle(s * 0.7, s * 0.7, s * 1.0, s * 1.1, s * 1.1, s * 0.5);
      g.lineStyle(2, COLORS.OUTLINE, 1);
      g.strokeEllipse(0, 0, s * 2.6, s * 1.4);
      return;
    }
    g.fillStyle(this.bodyColor, 1);
    g.fillRect(-s, -s, s * 2, s * 2);
    g.lineStyle(2, COLORS.OUTLINE, 1);
    g.strokeRect(-s, -s, s * 2, s * 2);
    // Quem manda se vê de longe: anel dourado no chefe, prateado no capitão (como os tenentes do jogador)
    if (ENEMIES[this.kind].officer) {
      g.lineStyle(3, ENEMIES[this.kind].officer === "CHIEF" ? 0xf1c40f : COLORS.LIEUTENANT, 1);
      g.strokeRect(-s - 3, -s - 3, s * 2 + 6, s * 2 + 6);
    }
    if (this.shielded) {
      g.fillStyle(COLORS.SHIELD, 1);
      g.fillRect(s - 1, -s, 4, s * 2);
    }
    g.fillStyle(COLORS.OUTLINE, 1);
    if (this.ranged) {
      g.fillRect(-s / 2, -s / 2, s, s);
      g.fillRect(s - 2, -1, 6, 2);
    } else {
      g.fillRect(s - 4, -2, 4, 4);
    }
    if (this.isBoss) {
      // Coroa: o líder de uma calamidade
      g.fillStyle(0xf1c40f, 1);
      g.fillTriangle(-s, -s - 2, -s / 2, -s - 12, 0, -s - 2);
      g.fillTriangle(0, -s - 2, s / 2, -s - 12, s, -s - 2);
      g.lineStyle(3, 0xf1c40f, 1);
      g.strokeRect(-s - 3, -s - 3, s * 2 + 6, s * 2 + 6);
    }
  }

  get isBoss(): boolean {
    return !!ENEMIES[this.kind].boss;
  }

  override takeDamage(amount: number, source: Unit, time: number, kind: AttackKind = "MELEE"): void {
    if (source.team === "ALLY" && !this.hostile && !this.friendly) this.provoked = true;
    super.takeDamage(amount, source, time, kind);
  }

  /** Gente que não luta (refugiados, mensageiros, mercadores): foge de quem chegar perto. */
  private get timid(): boolean {
    return this.kind === "CIVILIAN" || this.kind === "COURIER" || this.kind === "MERCHANT";
  }

  override get nightCreature(): boolean {
    return TIME.NIGHT_CREATURES.includes(this.kind);
  }

  /** De quão longe este inimigo percebe `ally` (o batedor usa a mesma conta para ficar fora dela). */
  perceptionOf(ally: Unit): number {
    const night = ally.unlit ? Enemy.darkPerception : Enemy.perception;
    // Criaturas da noite enxergam no escuro: apagar as tochas não as engana
    const perception = this.nightCreature ? Math.max(1, night) : night;
    // Nevoeiro, neve e chuva escondem o bando de todos (Marco 13)
    const aggro = (ENEMIES[this.kind].aggroRange ?? BALANCE.GOBLIN_AGGRO_RANGE) * perception * Enemy.weatherSight;
    return (ally.isInForest ? Math.min(aggro, BALANCE.FOREST_DETECT_RANGE) : aggro) * ally.stealth;
  }

  /** Aliado está ao alcance da percepção? Na floresta, só bem de perto. */
  private canPerceive(ally: Unit): boolean {
    return distance(ally, this) <= this.perceptionOf(ally);
  }

  /**
   * `allies` = o bando do jogador; `rivals` = os do outro lado no mundo (selvagens para quem é
   * do povoado e vice-versa), que este inimigo combate mesmo em paz com o jogador.
   */
  think(dt: number, allies: readonly Unit[], rivals: readonly Unit[] = []): void {
    if (!this.isAlive) return;
    if (this.kind === "WOLF") return this.thinkWolf(dt, allies);
    if (this.driver) return this.driver(dt);
    if (this.squad) return this.squad.drive(this, dt, allies, rivals);

    // Quem não luta foge do bando do jogador
    if (this.timid) {
      this.target = null;
      const fear = this.kind === "COURIER" ? 420 : 300;
      let threat: Unit | null = null;
      let best = fear;
      for (const a of allies) {
        const d = distance(a, this);
        if (d < best) {
          best = d;
          threat = a;
        }
      }
      if (threat) {
        const away = Math.atan2(this.y - threat.y, this.x - threat.x);
        this.moveTowards(this.x + Math.cos(away) * 120, this.y + Math.sin(away) * 120, dt, 1.1);
        this.unitState = "FLEEING";
        return;
      }
      const arrived = this.moveTowards(this.home.x, this.home.y, dt, 0.8);
      this.unitState = arrived ? "IDLE" : "MOVING";
      return;
    }

    // Contra o bando do jogador só se hostil ou provocado; contra rivais, sempre
    const fightsBand = (this.hostile || this.provoked) && !this.friendly;
    const leash = ENEMIES[this.kind].aggroRange ?? BALANCE.GOBLIN_LEASH_RANGE;
    const t = this.target;
    // Atrás dos muros: larga quem saiu do alcance (ninguém persegue por cima da muralha)
    const k = this.keepInside;
    const walled = !!k && !!t && !this.inRange(t) && (t.x < k.x || t.x > k.x + k.w || t.y < k.y || t.y > k.y + k.h);
    if (t && (walled || !t.isAlive || distance(this.home, this) > Math.max(leash, BALANCE.GOBLIN_LEASH_RANGE) || (t.team === "ALLY" && !fightsBand))) {
      this.target = null;
      this.huntsScouts = false;
    }
    if (!this.target) {
      let best: Unit | null = null;
      let bestDist = Infinity;
      const consider = (u: Unit) => {
        if (!u.isAlive || !this.canPerceive(u)) return;
        // Atrás dos muros: besteiro atira por cima; quem luta de perto espera a muralha ser vencida
        const k = this.keepInside;
        if (k && !this.ranged && (u.x < k.x || u.x > k.x + k.w || u.y < k.y || u.y > k.y + k.h)) return;
        // Batedor à vista não arrasta o bando: um ou dois vão atrás dele (ver onSpot)
        if (u.isScout && !this.huntsScouts) {
          Enemy.onSpot?.(this, u);
          if (!this.huntsScouts) return;
        }
        // Carroças atraem saqueadores: a comida do bando vale mais que um soldado
        const d = distance(u, this) * u.lure;
        if (d < bestDist) {
          best = u;
          bestDist = d;
        }
      };
      if (fightsBand) for (const a of allies) consider(a);
      for (const r of rivals) consider(r);
      this.target = best;
    }

    if (this.target) {
      if (this.inRange(this.target)) {
        this.unitState = "ATTACKING";
      } else {
        this.moveTowards(this.target.x, this.target.y, dt);
        this.unitState = "MOVING";
      }
      return;
    }

    if (this.routine) {
      this.routine(dt);
      return;
    }
    const arrived = this.moveTowards(this.home.x, this.home.y, dt, fightsBand ? 0.7 : 0.8);
    this.unitState = arrived ? "IDLE" : "MOVING";
  }

  /**
   * Lobo: ataca só quem anda sozinho (batedor, mensageiro, o Comandante sem escolta) e foge de
   * grupos — com três do bando por perto, a alcateia desiste e some no mato.
   */
  private thinkWolf(dt: number, allies: readonly Unit[]): void {
    const now = this.scene.time.now;
    const company = (u: Unit) => allies.filter((a) => a !== u && a.isAlive && distance(a, u) < WOLF.ESCORT_RADIUS).length;
    const crowd = allies.filter((a) => a.isAlive && distance(a, this) < WOLF.GROUP_RADIUS).length;
    if (crowd >= WOLF.GROUP_SIZE || (this.target && company(this.target) >= 2)) this.scaredUntil = now + WOLF.SCARED_MS;
    if (now < this.scaredUntil) {
      this.target = null;
      const threat = allies.reduce<Unit | null>((best, a) => (a.isAlive && (!best || distance(a, this) < distance(best, this)) ? a : best), null);
      const away = threat ? Math.atan2(this.y - threat.y, this.x - threat.x) : Math.atan2(this.y - this.home.y, this.x - this.home.x);
      this.moveTowards(this.x + Math.cos(away) * 140, this.y + Math.sin(away) * 140, dt, 1.15);
      this.unitState = "FLEEING";
      return;
    }
    if (this.target && (!this.target.isAlive || distance(this.home, this) > WOLF.LEASH)) this.target = null;
    if (!this.target) {
      let best: Unit | null = null;
      let bestDist = Infinity;
      for (const a of allies) {
        if (!a.isAlive || !this.canPerceive(a) || company(a) >= 2) continue;
        const d = distance(a, this);
        if (d < bestDist) {
          best = a;
          bestDist = d;
        }
      }
      this.target = best;
    }
    if (this.target) {
      if (this.inRange(this.target)) this.unitState = "ATTACKING";
      else {
        this.moveTowards(this.target.x, this.target.y, dt);
        this.unitState = "MOVING";
      }
      return;
    }
    // Sem presa à vista: segue o rastro de quem anda sozinho por perto da toca
    const stalk = allies.find((a) => a.isAlive && company(a) < 2 && distance(a, this.home) < WOLF.LEASH);
    if (stalk) {
      this.moveTowards(stalk.x, stalk.y, dt, 1);
      this.unitState = "MOVING";
      return;
    }
    // Ninguém: ronda devagar em volta da toca
    if (this.unitState !== "MOVING" || distance(this, this.home) < 8) {
      const a = Math.random() * Math.PI * 2;
      this.wander = { x: this.home.x + Math.cos(a) * 160, y: this.home.y + Math.sin(a) * 120 };
    }
    const arrived = this.moveTowards(this.wander.x, this.wander.y, dt, 0.45);
    this.unitState = arrived ? "IDLE" : "MOVING";
  }

  private wander: Point = { x: 0, y: 0 };

  /** Assustado por um grupo do bando (a alcateia desiste). */
  get scared(): boolean {
    return this.scene.time.now < this.scaredUntil;
  }
}
