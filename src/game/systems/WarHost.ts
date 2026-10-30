import type Phaser from "phaser";
import type { Enemy } from "../entities/Enemy";
import type { Unit } from "../entities/Unit";
import { EnemySquad, type SquadCommand, type SquadOrder, type SquadRole } from "./EnemySquad";
import { updateMorale } from "./MoraleSystem";
import type { Warband } from "./Warbands";
import type { TerrainType } from "../../utils/constants";
import { SUPPORT, WAR_AI, type EnemyKind, type Formation } from "../../utils/constants";
import { PASSIVES, type PassiveId } from "../data/lieutenants";
import { choosePlan, exposedHero, foeCenter, PLAN_LABEL, type BattleView, type ContactView, type PlanKind } from "../sim/warMind";
import type { NobleTrait } from "../sim/nobility";
import { chiefName, necromancerName } from "../worldgen/names";
import { angleTo, centroid, distance, nearest, type Point } from "../../utils/math";

/** Quem comanda um bando: vai junto com ele para o save e volta igual à bolha. */
export interface StaffData {
  chief: string;
  traits: NobleTrait[];
  competence: number;
  lieutenants: { name: string; passive: PassiveId }[];
}

/** O que a hoste precisa do mundo a cada quadro. */
export interface HostWorld {
  time: number;
  dt: number;
  allies: readonly Unit[];
  rivalsOf: (e: Enemy) => readonly Unit[];
  /** Soma da competência da dificuldade escolhida. */
  bonus: number;
}

/** Ligações da hoste com a cena (terreno, sons, notícias). */
export interface HostLinks {
  scene: Phaser.Scene;
  terrainAt: (p: Point) => TerrainType;
  isOpen: (p: Point) => boolean;
  nearestOpen: (p: Point, radius: number) => Point | null;
  /** Onde o Comandante do jogador está: só para saber quem ouve a trombeta (nunca para decidir). */
  listener: () => Point;
  feed: (text: string) => void;
  horn: (at: Point) => void;
  /** Emboscada disparada: o choque em quem foi pego. */
  ambush: (at: Point, host: WarHost) => void;
  /** Viu o bando do jogador: quantos e onde (vai para a estratégia do reino). */
  sawArmy: (host: WarHost, at: Point, size: number) => void;
  /** Um oficial caiu (nota do combate). */
  officerDown: (host: WarHost, name: string, chief: boolean) => void;
  /** Tira do mapa (fugitivo que sumiu de vista). */
  vanish: (e: Enemy) => void;
  /** O bando largou a luta: procura outro rumo. */
  retreated: (band: Warband) => void;
}

interface Contact {
  unit: Unit;
  x: number;
  y: number;
  at: number;
  kind: ContactView["kind"];
  power: number;
}

/** O que um reino aprendeu a reforçar depois de apanhar do bando. */
export type Doctrine = "RIDERS" | "SHIELDS" | "BOWS";

/** Quem é o quê no bando. */
const CHIEFS: ReadonlySet<EnemyKind> = new Set<EnemyKind>(["GOBLIN_CHIEF", "BANDIT_CHIEF", "SERGEANT", "LORD", "ORC_CHIEF", "ORC_WARLORD", "NECROMANCER"]);
const CAPTAINS: ReadonlySet<EnemyKind> = new Set<EnemyKind>(["GOBLIN_CAPTAIN", "BANDIT_CAPTAIN", "CAPTAIN", "ORC_CAPTAIN", "DEATH_KNIGHT"]);
const EYES_KINDS: ReadonlySet<EnemyKind> = new Set<EnemyKind>(["OUTRIDER", "WOLF_RIDER"]);

const TRAIT_POOL: NobleTrait[] = ["BRAVE", "CRUEL", "COWARD", "CUNNING", "GREEDY", "AMBITIOUS", "HONORABLE"];
const PASSIVE_POOL: PassiveId[] = ["INSPIRING", "STALWART", "TACTICIAN", "MARKSMAN", "BERSERKER"];
const pick = <T>(l: readonly T[]) => l[Math.floor(Math.random() * l.length)];

/** Oficiais de cada tipo de tropa: quem vira chefe e quem vira capitão. */
function officersOf(kinds: readonly EnemyKind[], army: boolean): { base: EnemyKind; chief: EnemyKind; captain: EnemyKind } | null {
  if (kinds.includes("GOBLIN")) return { base: "GOBLIN", chief: "GOBLIN_CHIEF", captain: "GOBLIN_CAPTAIN" };
  if (kinds.includes("BANDIT")) return { base: "BANDIT", chief: "BANDIT_CHIEF", captain: "BANDIT_CAPTAIN" };
  if (kinds.includes("SOLDIER")) return { base: "SOLDIER", chief: army ? "LORD" : "SERGEANT", captain: "CAPTAIN" };
  if (kinds.includes("ORC")) return { base: "ORC", chief: "ORC_CHIEF", captain: "ORC_CAPTAIN" };
  if (kinds.includes("SKELETON")) return { base: "SKELETON", chief: "DEATH_KNIGHT", captain: "DEATH_KNIGHT" };
  return null;
}

/**
 * Promove parte da tropa a oficiais e dá olhos e arautos a quem tem tamanho para isso. O total
 * de gente não muda: é o mesmo bando, com comando. Oficiais vão no fim da lista (morrem por último
 * nas resoluções abstratas).
 */
export function promoteRoster(kinds: readonly EnemyKind[], army = false, doctrine?: Doctrine): EnemyKind[] {
  const o = officersOf(kinds, army);
  if (!o || kinds.length < WAR_AI.SQUAD_MIN + 1) return [...kinds];
  const out = [...kinds];
  const take = (k: EnemyKind): boolean => {
    const i = out.lastIndexOf(k);
    if (i < 0) return false;
    out.splice(i, 1);
    return true;
  };
  const officers: EnemyKind[] = [];
  if (take(o.base)) officers.push(o.chief);
  const lieutenants = Math.min(WAR_AI.MAX_LIEUTENANTS, Math.floor(kinds.length / WAR_AI.LIEUTENANT_EVERY));
  for (let i = 0; i < lieutenants; i++) if (take(o.base)) officers.push(o.captain);
  if (o.base === "GOBLIN" && kinds.length >= 8 && take("GOBLIN")) out.push("WOLF_RIDER");
  if (o.base === "SOLDIER" && kinds.length >= 8 && take("SOLDIER")) out.push("OUTRIDER");
  if (o.base === "SOLDIER" && army && kinds.length >= 14) {
    if (take("SOLDIER")) out.push("OUTRIDER");
    if (take("SOLDIER")) out.push("HERALD");
  }
  if (o.base === "SOLDIER" && army) {
    // Quem apanhou de arqueiros traz cavalo; de cavalaria, mais besta; de infantaria, as duas coisas
    const lancers = doctrine === "RIDERS" ? Math.floor(kinds.length / 3) : kinds.length >= WAR_AI.LANCER_FROM ? Math.floor(kinds.length / WAR_AI.LANCER_EVERY) : 0;
    for (let i = 0; i < lancers; i++) if (take("SOLDIER")) out.push("LANCER");
    if (doctrine === "BOWS") for (let i = 0; i < Math.floor(kinds.length / 5); i++) if (take("SOLDIER")) out.push("CROSSBOW");
  }
  return [...out, ...officers];
}

/** Comando de um bando novo. `base`: 1 goblins e camponeses, 2 salteadores e hordas, 3 patrulhas e exércitos. */
export function makeStaff(kinds: readonly EnemyKind[], base: number, chief?: { name: string; traits: readonly NobleTrait[]; martial?: number }): StaffData {
  const undead = kinds.includes("SKELETON");
  const name = chief?.name ?? (undead ? necromancerName() : chiefName());
  const traits = chief ? [...chief.traits] : [pick(TRAIT_POOL)];
  const competence = chief?.martial !== undefined ? Math.max(2, Math.min(5, 1 + Math.round(chief.martial / 2.5))) : base;
  const lieutenants = kinds.filter((k) => CAPTAINS.has(k)).map(() => ({ name: chiefName(), passive: pick(PASSIVE_POOL) }));
  return { chief: name, traits, competence, lieutenants };
}

const unitPower = (u: Unit) => Math.sqrt(Math.max(1, u.hp) * Math.max(0.5, (u.damage * 1000) / Math.max(200, u.cooldown)));

function contactKind(u: Unit): ContactView["kind"] {
  if (u.role === "HERO") return "HERO";
  if (u.role === "SCOUT") return "SCOUT";
  if (u.role === "COURIER") return "COURIER";
  if (u.role === "WAGON") return "WAGON";
  if (u.ranged) return "ARCHER";
  return u.canCharge ? "RIDER" : "TROOP";
}

/**
 * Hoste (Marco 16): o comando de um bando em campo. O comandante é uma unidade de verdade; os
 * tenentes lideram esquadrões; as ordens saem por voz, trombeta ou arauto, e matar quem manda
 * deixa os grupos repetindo a última ordem. Decide só com o que os próprios soldados viram (a
 * posição de quando viram), que é tudo o que `choosePlan` recebe.
 */
export class WarHost implements SquadCommand {
  squads: EnemySquad[] = [];
  members: Enemy[];
  leader: Enemy | null = null;
  alert = 0;
  plan: PlanKind | null = null;
  /** O comando caiu e ninguém assumiu: cada esquadrão por si. */
  headless = false;
  /** Largando a luta agora. */
  private leaving = false;
  /** Quando acabou de sair do campo: o combate que ele deixou para trás conta como vencido. */
  private leftAt = -Infinity;
  /** Tropa treinada espera a ordem (competência 3 ou mais). */
  disciplined: boolean;
  /** Guarda de um covil: luta até o fim (o líder de uma calamidade não foge do próprio covil). */
  standFast = false;
  private riders: Enemy[] = [];
  private heralds: Enemy[] = [];
  private contacts = new Map<Unit, Contact>();
  private pending: { squad: EnemySquad; order: SquadOrder; at: number }[] = [];
  private stage = 0;
  private planAt = 0;
  private nextThink = 0;
  private nextPerceive = 0;
  private lastSeenAt = 0;
  private lastHornAt = -Infinity;
  private successionAt = 0;
  private startCount: number;
  private cover: { forest: Point | null; hill: Point | null; at: number } = { forest: null, hill: null, at: -Infinity };
  private fallback: Point | null = null;
  private exposed = false;
  private introduced = false;
  /** Recuo fingido e emboscada: engana-se uma vez só. */
  private spent: PlanKind[] = [];

  constructor(
    readonly key: string,
    members: Enemy[],
    readonly staff: StaffData,
    private readonly links: HostLinks,
    readonly band: Warband | null,
  ) {
    this.members = members;
    this.startCount = members.length;
    this.alert = band?.alert ?? 0;
    this.disciplined = staff.competence >= 3;
    for (const m of members) m.command = this;
    this.organize();
  }

  /** Nome de quem manda (para o HUD e as notícias). */
  get name(): string {
    return this.staff.chief;
  }

  /** Divide a tropa em esquadrões, cada oficial no seu lugar. */
  private organize(): void {
    const scene = this.links.scene;
    const chiefs = this.members.filter((m) => CHIEFS.has(m.kind));
    const captains = this.members.filter((m) => CAPTAINS.has(m.kind));
    this.riders = this.members.filter((m) => EYES_KINDS.has(m.kind));
    this.heralds = this.members.filter((m) => m.kind === "HERALD");
    const soldiers = this.members.filter((m) => !chiefs.includes(m) && !captains.includes(m) && !this.riders.includes(m) && !this.heralds.includes(m));
    const chunk = (list: Enemy[], role: SquadRole) => {
      const n = Math.max(1, Math.min(Math.round(list.length / WAR_AI.SQUAD_SIZE), Math.floor(list.length / WAR_AI.SQUAD_MIN)));
      const parts: Enemy[][] = Array.from({ length: n }, () => []);
      list.forEach((m, i) => parts[i % n].push(m));
      for (const p of parts) if (p.length > 0) this.squads.push(new EnemySquad(scene, role, p, this));
    };
    const lancers = soldiers.filter((m) => m.kind === "LANCER");
    const melee = soldiers.filter((m) => !m.ranged && m.kind !== "LANCER");
    const ranged = soldiers.filter((m) => m.ranged);
    chunk(melee, "MELEE");
    if (lancers.length >= WAR_AI.SQUAD_MIN) this.squads.push(new EnemySquad(scene, "RIDERS", lancers, this));
    else if (this.squads[0]) for (const m of lancers) this.squads[0].add(m);
    if (ranged.length >= WAR_AI.SQUAD_MIN || melee.length === 0) chunk(ranged, "RANGED");
    else if (this.squads[0]) for (const m of ranged) this.squads[0].add(m);
    if (this.squads.length === 0 && (chiefs.length > 0 || captains.length > 0)) this.squads.push(new EnemySquad(scene, "MELEE", [], this));

    // Tenentes: um por esquadrão, dos maiores para os menores
    const bySize = [...this.squads].sort((a, b) => b.alive - a.alive);
    captains.forEach((c, i) => {
      const squad = bySize[i % Math.max(1, bySize.length)];
      if (!squad) return;
      squad.add(c);
      if (squad.lieutenant) return;
      const data = this.staff.lieutenants[i];
      squad.lieutenant = c;
      squad.lieutenantName = data?.name ?? null;
      squad.passive = data ? PASSIVES[data.passive] : null;
      c.setTitle(data?.name ?? null);
    });
    // O comandante fica no maior esquadrão; sem chefe, o primeiro capitão manda (mortos-vivos)
    this.leader = chiefs[0] ?? captains[0] ?? null;
    if (this.leader) {
      if (this.leader.squad !== bySize[0]) bySize[0]?.add(this.leader);
      this.leader.setTitle(this.staff.chief);
    } else {
      this.headless = true;
    }
    for (const m of chiefs.slice(1)) bySize[0]?.add(m);
    for (const r of this.riders) r.driver = (dt) => this.driveRider(r, dt);
    for (const h of this.heralds) h.driver = (dt) => this.driveHerald(h, dt);
  }

  /** Largou a luta (ou acabou de largar): no fim do combate, conta como quem fugiu. */
  get retreating(): boolean {
    return this.leaving || this.links.scene.time.now - this.leftAt < 20000;
  }

  /** Está segurando a marcha do bando: formou, emboscou, luta ou recua. */
  get holding(): boolean {
    return this.plan !== null;
  }

  get alive(): boolean {
    return this.members.some((m) => m.isAlive);
  }

  // --- O que os soldados contam ---

  private note(u: Unit, now: number): void {
    const c = this.contacts.get(u);
    if (c) {
      c.x = u.x;
      c.y = u.y;
      c.at = now;
      c.power = unitPower(u);
      return;
    }
    this.contacts.set(u, { unit: u, x: u.x, y: u.y, at: now, kind: contactKind(u), power: unitPower(u) });
  }

  report(u: Unit, by: Enemy): void {
    this.note(u, by.scene.time.now);
  }

  spotted(s: Enemy, u: Unit): void {
    s.spotScout(u);
    this.raiseAlert(2);
  }

  raiseAlert(level: number): void {
    if (level <= this.alert) return;
    this.alert = level;
    if (this.band) this.band.alert = level;
    this.lastSeenAt = this.links.scene.time.now;
  }

  private foes(w: HostWorld): Unit[] {
    const lead = this.leader?.isAlive ? this.leader : this.members.find((m) => m.isAlive);
    if (!lead) return [];
    const fights = (lead.hostile || lead.provoked) && !lead.friendly;
    return [...(fights ? w.allies : []), ...w.rivalsOf(lead)];
  }

  /** Sentinelas: quem olha em volta. Em alerta, enxergam mais longe. */
  private perceive(w: HostWorld): void {
    const sight = this.alert >= 2 ? WAR_AI.ALERT_SIGHT : WAR_AI.SENTRY_SIGHT;
    const eyes: Enemy[] = [];
    if (this.leader?.isAlive) eyes.push(this.leader);
    for (const r of this.riders) if (r.isAlive) eyes.push(r);
    for (const s of this.squads) {
      const step = Math.max(1, Math.floor(s.alive / 3));
      for (let i = 0; i < s.alive && eyes.length < WAR_AI.EYES; i += step) eyes.push(s.soldiers[i]);
    }
    for (const u of this.foes(w)) {
      if (!u.isAlive) continue;
      for (const e of eyes) {
        if (distance(e, u) <= e.perceptionOf(u) * sight) {
          this.note(u, w.time);
          break;
        }
      }
    }
    for (const [u, c] of this.contacts) {
      // Quem morreu na frente de alguém sai da lista; o resto envelhece
      if (w.time - c.at > WAR_AI.MEMORY_MS || (!u.isAlive && eyes.some((e) => distance(e, c) < 500))) this.contacts.delete(u);
    }
  }

  // --- Ciclo de decisão ---

  update(w: HostWorld): void {
    this.members = this.members.filter((m) => m.isAlive);
    for (const s of this.squads) s.refresh();
    this.squads = this.squads.filter((s) => {
      if (!s.isDestroyed) return true;
      s.destroy();
      return false;
    });
    this.riders = this.riders.filter((r) => r.isAlive);
    this.heralds = this.heralds.filter((h) => h.isAlive);
    if (this.members.length === 0) return;
    if (!this.headless && this.leader && !this.leader.isAlive) this.onLeaderDown(w);
    if (!this.leader && this.successionAt > 0 && w.time >= this.successionAt) this.succession();
    for (const p of this.pending) if (p.at <= w.time) p.squad.setOrder(p.order);
    this.pending = this.pending.filter((p) => p.at > w.time);
    for (const s of this.squads) s.draw();

    // Fora da bolha ativa, ninguém pensa (e o bando volta a marchar)
    if (this.members.every((m) => m.dormant)) {
      if (this.plan) this.standDown();
      return;
    }
    if (!this.introduced && this.leader?.revealed && this.leader.hostile && !this.headless) {
      this.introduced = true;
      const trait = this.staff.traits[0];
      this.links.feed(`Reconhecemos ${this.staff.chief}${trait ? ` (${TRAIT_WORD[trait] ?? ""})` : ""}.`);
    }
    if (w.time >= this.nextPerceive) {
      this.nextPerceive = w.time + WAR_AI.PERCEIVE_MS;
      this.perceive(w);
    }
    if (w.time < this.nextThink) return;
    const competence = this.competence(w);
    this.nextThink = w.time + WAR_AI.THINK_MS[competence - 1] * (0.85 + Math.random() * 0.3);
    if (!this.headless && this.leader) this.decide(w, competence);
    else if (this.leaving) this.keepRetreating(w);
  }

  private competence(w: HostWorld): number {
    return Math.max(1, Math.min(5, this.staff.competence + w.bonus));
  }

  private mainContacts(): Contact[] {
    return [...this.contacts.values()].filter((c) => c.kind !== "SCOUT" && c.kind !== "COURIER");
  }

  private ownCenter(): Point {
    return centroid(this.members);
  }

  /** O que cabe ao comandante saber: é tudo o que a escolha do plano enxerga. */
  private view(w: HostWorld, competence: number): BattleView {
    const contacts: ContactView[] = [...this.contacts.values()].map((c) => ({ x: c.x, y: c.y, kind: c.kind, power: c.power }));
    const engaged = this.members.some((m) => m.target?.isAlive && !m.target.isScout && distance(m, m.target) < 260);
    if (engaged) this.exposed = true;
    const center = this.ownCenter();
    if (w.time - this.cover.at > 5000) this.findCover(center);
    const morale = this.squads.length > 0 ? this.squads.reduce((n, s) => n + s.morale * s.alive, 0) / Math.max(1, this.squads.reduce((n, s) => n + s.alive, 0)) : 0;
    return {
      competence,
      traits: this.staff.traits,
      current: this.plan,
      spent: this.spent,
      center,
      ownPower: this.members.reduce((n, m) => n + unitPower(m), 0),
      ownMorale: morale,
      strength: this.members.length / Math.max(1, this.startCount),
      squads: this.squads.map((s) => ({ role: s.role, size: s.alive, morale: s.morale, power: s.soldiers.reduce((n, m) => n + unitPower(m), 0), center: s.center })),
      contacts,
      engaged,
      exposed: this.exposed,
      cover: this.cover,
    };
  }

  /** Terreno bom por perto: colina para resistir, mata para esconder. */
  private findCover(from: Point): void {
    let forest: Point | null = null;
    let hill: Point | null = null;
    for (const r of [260, 520, WAR_AI.COVER_RADIUS]) {
      for (let i = 0; i < 12; i++) {
        const p = { x: from.x + Math.cos((i * Math.PI) / 6) * r, y: from.y + Math.sin((i * Math.PI) / 6) * r };
        const t = this.links.terrainAt(p);
        if (t === "FOREST" && !forest) forest = p;
        if (t === "HILL" && !hill) hill = p;
      }
      if (forest && hill) break;
    }
    this.cover = { forest, hill, at: this.links.scene.time.now };
  }

  private decide(w: HostWorld, competence: number): void {
    const main = this.mainContacts();
    if (main.length === 0) {
      if (this.plan === "RETREAT") return this.keepRetreating(w);
      if (this.plan === "AMBUSH") return this.runAmbush(w);
      if (this.plan && w.time - this.lastSeenAt > WAR_AI.CALM_MS / 3) this.standDown();
      if (this.alert > 0 && w.time - this.lastSeenAt > WAR_AI.CALM_MS) {
        this.alert--;
        if (this.band) this.band.alert = this.alert;
        this.lastSeenAt = w.time;
      }
      return;
    }
    this.lastSeenAt = w.time;
    if (this.alert < 3) this.raiseAlert(3);
    // Emboscada armada não se troca por outro plano: ela dispara ou passa do tempo
    if (this.plan === "AMBUSH") return this.runAmbush(w);
    const seen = main.filter((c) => c.unit.team === "ALLY" && c.kind !== "WAGON");
    if (seen.length > 0) this.links.sawArmy(this, centroid(seen), seen.length);
    const view = this.view(w, competence);
    let next = choosePlan(view, WAR_AI.EXPOSED_RADIUS);
    if (this.standFast && next === "RETREAT") next = "ASSAULT";
    const locked = this.plan !== null && (this.plan === "FEINT" || w.time - this.planAt < WAR_AI.PLAN_LOCK_MS) && next !== "RETREAT" && (next !== "DECAPITATE" || this.plan === "FEINT");
    if (next !== this.plan && !locked) this.setPlan(next, w);
    this.runPlan(w, main);
    if (competence >= 3 && this.plan !== "RETREAT") this.huntCouriers(w);
  }

  private setPlan(plan: PlanKind, w: HostWorld): void {
    const was = this.plan;
    this.plan = plan;
    this.stage = 0;
    this.planAt = w.time;
    this.leaving = plan === "RETREAT";
    if (plan === "RETREAT") this.fallback = null;
    if (plan === "FEINT" || plan === "AMBUSH") this.spent.push(plan);
    if (was !== plan) this.sound(w);
    for (const s of this.squads) s.setFormation(this.formationFor(s));
  }

  /** Forma para o que vem pela frente: as regras são as do jogador, e cada uma tem preço. */
  private formationFor(s: EnemySquad): Formation {
    if (s.role === "RIDERS") return "WEDGE";
    const foes = [...this.contacts.values()].filter((c) => c.kind !== "SCOUT" && c.kind !== "COURIER");
    const archers = foes.filter((c) => c.kind === "ARCHER").length;
    const shower = archers > 0 && archers >= foes.length * 0.4;
    if (s.role === "RANGED") return shower ? "LOOSE" : "LINE";
    const drilled = s.soldiers.some((m) => m.kind === "SOLDIER");
    if (this.plan === "HOLD") return drilled ? "SHIELD_WALL" : "LINE";
    if (this.plan === "DECAPITATE") return "WEDGE";
    if (shower) return "LOOSE";
    // Quem sabe o que faz entra de cunha: bate mais forte, apanha mais
    return this.staff.competence >= 2 && this.plan !== "RETREAT" ? "WEDGE" : "LINE";
  }

  /** Ordem saindo: voz, trombeta ou arauto. Longe de tudo isso, ela não chega. */
  private order(squad: EnemySquad, order: SquadOrder, w: HostWorld): void {
    if (this.pending.some((p) => p.squad === squad && p.order.type === order.type)) return;
    const lead = this.leader;
    if (!lead) return;
    const d = distance(lead, squad.center);
    if (d <= SUPPORT.COMMAND_RADIUS) return squad.setOrder(order);
    if (d <= SUPPORT.TRUMPET_RADIUS) {
      this.pending.push({ squad, order, at: w.time + WAR_AI.HORN_DELAY_MS });
      this.sound(w);
      return;
    }
    const herald = this.heralds.find((h) => !h.mission);
    if (herald) herald.mission = { squad, order };
  }

  /** Quem leva ordens não chega: cavalaria e batedores inimigos vão atrás de todo mensageiro à vista. */
  private huntCouriers(w: HostWorld): void {
    const couriers = [...this.contacts.values()].filter((c) => c.kind === "COURIER" && c.unit.isAlive && w.time - c.at < 2500);
    if (couriers.length === 0) return;
    for (const r of this.riders) {
      if (r.intercept?.isAlive) continue;
      r.intercept = nearest(couriers, r, 900)?.unit ?? null;
    }
    const lancers = this.squads.find((s) => s.role === "RIDERS");
    const prey = lancers ? nearest(couriers, lancers.center, 900) : null;
    // Quem já está num golpe (retaguarda, Comandante) não larga o golpe por um mensageiro
    if (lancers && prey && this.plan !== "DECAPITATE" && this.plan !== "REAR_STRIKE") this.order(lancers, attackOrder(prey), w);
  }

  /** Trombeta inimiga: o jogador ouve de onde vem (é a pista de que alguma coisa mudou). */
  private sound(w: HostWorld): void {
    const lead = this.leader;
    if (!lead?.isAlive || w.time - this.lastHornAt < WAR_AI.HORN_FEED_MS) return;
    const ear = this.links.listener();
    if (distance(lead, ear) > WAR_AI.HORN_HEARD) return;
    this.lastHornAt = w.time;
    this.links.horn(lead);
    this.links.feed(`Trombetas inimigas ${directionWord(ear, lead)}.`);
  }

  private runPlan(w: HostWorld, main: Contact[]): void {
    switch (this.plan) {
      case "FLANK":
        return this.runFlank(w, main);
      case "AMBUSH":
        return this.runAmbush(w);
      case "REAR_STRIKE":
        return this.runRearStrike(w, main);
      case "DECAPITATE":
        return this.runDecapitate(w, main);
      case "FEINT":
        return this.runFeint(w, main);
      case "HOLD":
        return this.runHold(w, main);
      case "RETREAT":
        return this.keepRetreating(w);
      default:
        return this.runAssault(w, main, this.squads);
    }
  }

  /**
   * Melee vai em cima de quem está mais perto; arqueiros ficam ao alcance, atrás da linha. Com
   * o inimigo ainda longe, quem sabe o que faz forma primeiro: sai junto com os arqueiros, em
   * vez de chegar sozinho na frente deles.
   */
  private runAssault(w: HostWorld, main: readonly Contact[], squads: readonly EnemySquad[]): void {
    const forming = this.staff.competence >= 2 && w.time - this.planAt < WAR_AI.FORM_UP_MS && this.squads.some((s) => s.role === "RANGED");
    for (const s of squads) {
      const target = nearest(main, s.center);
      if (!target) continue;
      if (s.role === "RANGED") this.order(s, this.rangeOrder(s, target), w);
      else if (forming && distance(s.center, target) > WAR_AI.FORM_UP_DISTANCE) this.order(s, { type: "HOLD", point: { ...s.center }, facing: angleTo(s.center, target) }, w);
      else this.order(s, attackOrder(target), w);
    }
  }

  private rangeOrder(s: EnemySquad, target: Point): SquadOrder {
    const range = (s.soldiers.find((m) => m.ranged)?.range ?? 180) * 0.85;
    const d = distance(s.center, target) || 1;
    if (d <= range) return { type: "HOLD", point: { ...s.center }, facing: angleTo(s.center, target) };
    return { type: "ADVANCE", point: { x: target.x + ((s.center.x - target.x) / d) * range, y: target.y + ((s.center.y - target.y) / d) * range } };
  }

  /** Linha e flanco: o maior segura a frente, os outros contornam e chegam pelo lado. */
  private runFlank(w: HostWorld, main: readonly Contact[]): void {
    const melee = this.squads.filter((s) => s.role !== "RANGED").sort((a, b) => b.alive - a.alive);
    const foe = foeCenter(main.map(asView));
    if (!foe || melee.length < 2) return this.runAssault(w, main, this.squads);
    const [front, ...wings] = melee;
    const center = this.ownCenter();
    const dir = angleTo(center, foe);
    this.runAssault(w, main, [front, ...this.squads.filter((s) => s.role === "RANGED")]);
    if (this.stage === 0) {
      wings.forEach((wing, i) => {
        const side = i % 2 === 0 ? 1 : -1;
        const p = this.flankPoint(foe, dir, side);
        this.order(wing, { type: "MOVE", point: p, facing: angleTo(p, foe) }, w);
      });
      this.stage = 1;
      return;
    }
    if (this.stage === 1 && (wings.every((s) => s.settled) || w.time - this.planAt > WAR_AI.FLANK_MS)) this.stage = 2;
    if (this.stage === 2) this.runAssault(w, main, wings);
  }

  private flankPoint(foe: Point, dir: number, side: number): Point {
    const R = WAR_AI.FLANK_RADIUS;
    for (const s of [side, -side]) {
      const a = dir + (s * Math.PI) / 2;
      const p = { x: foe.x + Math.cos(a) * R + Math.cos(dir) * 60, y: foe.y + Math.sin(a) * R + Math.sin(dir) * 60 };
      if (this.links.isOpen(p)) return p;
    }
    return foe;
  }

  /** Esconde na mata e espera; dispara quando alguém chega perto. */
  private runAmbush(w: HostWorld): void {
    const forest = this.cover.forest;
    if (!forest) return this.setPlan("ASSAULT", w);
    const near = [...this.contacts.values()].filter((c) => c.kind !== "SCOUT" && w.time - c.at < 3000);
    const close = near.some((c) => this.squads.some((s) => distance(s.center, c) < WAR_AI.AMBUSH_TRIGGER));
    const late = w.time - this.planAt > WAR_AI.AMBUSH_MAX_MS;
    if (this.stage === 0) {
      for (const s of this.squads) this.order(s, { type: "MOVE", point: forest, facing: this.leader ? this.leader.facing : 0 }, w);
      this.stage = 1;
      return;
    }
    if (this.stage === 1 && this.squads.every((s) => s.settled)) {
      const foe = foeCenter(near.map(asView)) ?? this.ownCenter();
      for (const s of this.squads) this.order(s, { type: "HIDE", point: s.center, facing: angleTo(s.center, foe) }, w);
      this.stage = 2;
      return;
    }
    if (this.stage >= 1 && (close || late)) {
      this.exposed = true;
      if (close) {
        this.links.ambush(this.ownCenter(), this);
        this.links.feed(`Emboscada! ${this.staff.chief} saiu da mata!`);
      }
      this.setPlan("ASSAULT", w);
      if (near.length > 0) this.runAssault(w, near, this.squads);
    }
  }

  /** Um grupo prende a frente; o mais rápido vai nas carroças e nos arqueiros. */
  private runRearStrike(w: HostWorld, main: readonly Contact[]): void {
    const soft = main.filter((c) => c.kind === "WAGON" || c.kind === "ARCHER").sort((a, b) => (a.kind === "WAGON" ? -1 : 1) - (b.kind === "WAGON" ? -1 : 1));
    const melee = this.squads.filter((s) => s.role !== "RANGED").sort((a, b) => a.alive - b.alive);
    const strike = melee.find((s) => s.role === "RIDERS") ?? melee[0];
    if (!strike || soft.length === 0) return this.runAssault(w, main, this.squads);
    this.order(strike, attackOrder(nearest(soft, strike.center) ?? soft[0]), w);
    this.runAssault(w, main, this.squads.filter((s) => s !== strike));
  }

  /** Todo mundo no Comandante enquanto ele estiver sozinho. */
  private runDecapitate(w: HostWorld, main: readonly Contact[]): void {
    const hero = exposedHero(main.map(asView), WAR_AI.EXPOSED_RADIUS);
    const contact = hero ? main.find((c) => c.kind === "HERO") : null;
    if (!contact) return this.setPlan("ASSAULT", w);
    for (const s of this.squads) {
      if (s.role === "RANGED") this.order(s, this.rangeOrder(s, contact), w);
      else this.order(s, attackOrder(contact), w);
    }
  }

  /** Recua de propósito até os arqueiros e vira quando a tropa do jogador vier atrás. */
  private runFeint(w: HostWorld, main: readonly Contact[]): void {
    const melee = this.squads.filter((s) => s.role !== "RANGED").sort((a, b) => b.alive - a.alive);
    const archers = this.squads.filter((s) => s.role === "RANGED");
    const foe = foeCenter(main.map(asView));
    if (!foe || melee.length === 0 || archers.length === 0) return this.setPlan("ASSAULT", w);
    const bait = melee[0];
    const rear = archers[0].center;
    const dir = angleTo(foe, rear);
    if (this.stage === 0) {
      const p = { x: rear.x + Math.cos(dir) * 40, y: rear.y + Math.sin(dir) * 40 };
      const point = distance(p, bait.center) < WAR_AI.FEINT_DISTANCE ? { x: bait.center.x + Math.cos(dir) * WAR_AI.FEINT_DISTANCE, y: bait.center.y + Math.sin(dir) * WAR_AI.FEINT_DISTANCE } : p;
      this.order(bait, { type: "MOVE", point: this.links.nearestOpen(point, 300) ?? point, facing: dir + Math.PI }, w);
      for (const s of archers) this.order(s, { type: "HOLD", point: { ...s.center }, facing: dir + Math.PI }, w);
      this.stage = 1;
      return;
    }
    const closing = main.some((c) => distance(c, bait.center) < 200);
    if (this.stage === 1 && (bait.settled || w.time - this.planAt > WAR_AI.FEINT_MS || (closing && w.time - this.planAt > 2500))) {
      this.stage = 2;
      this.sound(w);
    }
    if (this.stage === 2) {
      this.setPlan("ASSAULT", w);
      this.runAssault(w, main, this.squads);
    }
  }

  /** Perdeu o campo: larga a luta de vez (quem estava em pânico não volta para a mesma briga). */
  giveUp(): void {
    if (this.leaving || this.headless || !this.leader || this.standFast) return;
    this.plan = "RETREAT";
    this.leaving = true;
    this.fallback = null;
    this.planAt = this.links.scene.time.now;
  }

  /** Sobe a colina, fecha escudos e deixa o inimigo vir. */
  private runHold(w: HostWorld, main: readonly Contact[]): void {
    const hill = this.cover.hill;
    const foe = foeCenter(main.map(asView));
    if (!hill || !foe) return this.setPlan("ASSAULT", w);
    const facing = angleTo(hill, foe);
    const fx = Math.cos(facing);
    const fy = Math.sin(facing);
    const lines = this.squads.filter((s) => s.role !== "RANGED");
    lines.forEach((s, i) => {
      const lateral = (i - (lines.length - 1) / 2) * 180;
      const p = { x: hill.x - fy * lateral, y: hill.y + fx * lateral };
      this.order(s, distance(s.center, p) > 90 ? { type: "MOVE", point: p, facing } : { type: "HOLD", point: p, facing }, w);
    });
    for (const s of this.squads.filter((x) => x.role === "RANGED")) {
      const p = { x: hill.x - fx * 110, y: hill.y - fy * 110 };
      this.order(s, distance(s.center, p) > 90 ? { type: "MOVE", point: p, facing } : { type: "HOLD", point: p, facing }, w);
    }
  }

  /** Sai do campo em ordem; com cabeça, deixa uma retaguarda segurando. */
  private keepRetreating(w: HostWorld): void {
    if (!this.fallback) {
      const center = this.ownCenter();
      const foe = foeCenter(this.mainContacts().map(asView));
      const dir = foe ? angleTo(foe, center) : Math.random() * Math.PI * 2;
      const goal = { x: center.x + Math.cos(dir) * WAR_AI.RETREAT_DISTANCE, y: center.y + Math.sin(dir) * WAR_AI.RETREAT_DISTANCE };
      this.fallback = this.links.nearestOpen(goal, 1200) ?? goal;
    }
    const point = this.fallback;
    const clear = this.mainContacts().every((c) => w.time - c.at > 4000 || distance(c, this.ownCenter()) > 900);
    if (clear && (this.squads.every((s) => s.settled) || w.time - this.planAt > 12000)) {
      this.leaving = false;
      this.leftAt = w.time;
      this.plan = null;
      this.contacts.clear();
      for (const s of this.squads) s.setOrder({ type: "MARCH" });
      if (this.band) this.links.retreated(this.band);
      // Grupo de um local: quem lutou some; quem só viu de longe volta para o posto
      else if (this.exposed) for (const m of this.members) this.links.vanish(m);
      return;
    }
    const melee = this.squads.filter((s) => s.role !== "RANGED").sort((a, b) => a.alive - b.alive);
    const rear = this.staff.competence >= 3 && this.squads.length >= 2 && w.time - this.planAt < WAR_AI.REARGUARD_MS ? melee[0] : null;
    for (const s of this.squads) {
      if (s === rear) {
        const foe = foeCenter(this.mainContacts().map(asView));
        if (foe) this.order(s, { type: "HOLD", point: { ...s.center }, facing: angleTo(s.center, foe) }, w);
      } else if (!this.headless) {
        this.order(s, { type: "MOVE", point }, w);
      } else {
        s.setOrder({ type: "MOVE", point });
      }
    }
  }

  private standDown(): void {
    this.plan = null;
    this.stage = 0;
    this.exposed = false;
    this.leaving = false;
    this.spent = [];
    for (const s of this.squads) {
      s.setFormation(s.role === "RIDERS" ? "WEDGE" : "LINE");
      s.setOrder({ type: "MARCH" });
    }
  }

  // --- Quem manda caiu ---

  private onLeaderDown(w: HostWorld): void {
    const name = this.staff.chief;
    const seen = this.leader?.revealed;
    this.leader = null;
    for (const s of this.squads) s.morale = Math.max(0, s.morale - WAR_AI.LEADER_DEATH_MORALE);
    this.links.officerDown(this, name, true);
    if (seen) this.links.feed(`${name} caiu! O inimigo vacila.`);
    this.successionAt = w.time + WAR_AI.SUCCESSION_MS;
  }

  /** Um tenente assume, sabendo menos; sem ninguém, cada esquadrão por si. */
  private succession(): void {
    this.successionAt = 0;
    const heir = this.squads.map((s) => s.lieutenant).find((l) => l?.isAlive) ?? null;
    if (!heir) {
      // Ninguém manda: cada esquadrão larga a manobra e luta como dá
      this.headless = true;
      this.plan = null;
      this.leaving = false;
      for (const s of this.squads) s.setOrder({ type: "MARCH" });
      return;
    }
    const i = this.squads.findIndex((s) => s.lieutenant === heir);
    const name = this.squads[i].lieutenantName ?? "um capitão";
    this.leader = heir;
    this.staff.chief = name;
    this.staff.competence = Math.max(1, this.staff.competence - 1);
    this.staff.lieutenants = this.staff.lieutenants.filter((l) => l.name !== name);
    this.squads[i].lieutenant = null;
    if (heir.revealed) this.links.feed(`${name} assumiu o comando.`);
  }

  // --- Olhos e mensageiros do inimigo ---

  /** Batedor inimigo: ronda à frente, enxerga de longe e não fica para lutar. */
  private driveRider(r: Enemy, dt: number): void {
    const now = r.scene.time.now;
    const prey = r.intercept;
    if (prey?.isAlive && distance(prey, r) < 1000) {
      r.target = prey;
      if (r.inRange(prey)) r.unitState = "ATTACKING";
      else {
        r.moveTowards(prey.x, prey.y, dt);
        r.unitState = "MOVING";
      }
      return;
    }
    r.intercept = null;
    r.target = null;
    const danger = [...this.contacts.values()].filter((c) => now - c.at < 1500 && c.kind !== "WAGON" && distance(c, r) < 300);
    if (danger.length > 0) {
      const c = centroid(danger);
      const a = angleTo(c, r);
      r.moveTowards(r.x + Math.cos(a) * 120, r.y + Math.sin(a) * 120, dt);
      r.unitState = "FLEEING";
      return;
    }
    if (now >= r.nextLookAt || !r.wanderGoal) {
      r.nextLookAt = now + 5000 + Math.random() * 3000;
      const c = this.ownCenter();
      const foe = foeCenter(this.mainContacts().map(asView));
      const base = foe ?? (this.band ? this.band.goalPoint : c);
      const dir = angleTo(c, base) + (Math.random() - 0.5) * 1.6;
      const reach = foe ? Math.min(760, distance(c, foe)) : 640;
      r.wanderGoal = this.links.nearestOpen({ x: c.x + Math.cos(dir) * reach, y: c.y + Math.sin(dir) * reach }, 400);
    }
    const g = r.wanderGoal;
    if (!g) return;
    r.unitState = r.moveTowards(g.x, g.y, dt, 0.8) ? "IDLE" : "MOVING";
  }

  private driveHerald(h: Enemy, dt: number): void {
    h.target = null;
    const m = h.mission;
    const lead = this.leader ?? this.ownCenter();
    if (!m) {
      h.unitState = h.moveTowards(lead.x, lead.y + 40, dt, 0.8) ? "IDLE" : "MOVING";
      return;
    }
    if (m.squad.isDestroyed) {
      h.mission = null;
      return;
    }
    h.moveTowards(m.squad.center.x, m.squad.center.y, dt);
    h.unitState = "MOVING";
    if (distance(h, m.squad.center) < 180) {
      m.squad.setOrder(m.order);
      h.mission = null;
    }
  }

  /** Passa a outro comando amigo por perto o que este aqui viu. */
  shareWith(other: WarHost): void {
    const a = this.leader ?? this.members[0];
    const b = other.leader ?? other.members[0];
    if (!a || !b || a.side !== b.side || (this.band?.ownerId ?? null) !== (other.band?.ownerId ?? null)) return;
    if (distance(a, b) > WAR_AI.SHARE_RADIUS) return;
    for (const [u, c] of this.contacts) if ((other.contacts.get(u)?.at ?? -Infinity) < c.at) other.contacts.set(u, { ...c });
    for (const [u, c] of other.contacts) if ((this.contacts.get(u)?.at ?? -Infinity) < c.at) this.contacts.set(u, { ...c });
    if (this.alert >= 2 || other.alert >= 2) {
      this.raiseAlert(2);
      other.raiseAlert(2);
    }
  }

  /** Uma linha para o HUD: quem é e como está. */
  get status(): string {
    if (this.headless) return "sem comando";
    if (this.leaving) return "em retirada";
    if (this.squads.some((s) => s.panicking)) return "vacilando";
    if (this.plan) return PLAN_SIGN[this.plan];
    return this.alert >= 2 ? "em alerta" : "desavisado";
  }

  /** Moral média (para o HUD). */
  get morale(): number {
    const n = this.squads.reduce((sum, s) => sum + s.alive, 0);
    return n > 0 ? this.squads.reduce((sum, s) => sum + s.morale * s.alive, 0) / n : 0;
  }

  /** O plano, para os testes. */
  get planLabel(): string {
    return this.plan ? PLAN_LABEL[this.plan] : "—";
  }

  updateMorale(w: HostWorld): void {
    const lead = this.leader?.isAlive ? this.leader : null;
    const foes = this.foes(w);
    for (const s of this.squads) {
      const seen = !!lead && distance(lead, s.center) <= SUPPORT.BANNER_RADIUS;
      updateMorale(s, foes, lead, w.dt, w.time, { seen, faltering: !!lead && lead.hp / lead.maxHp < SUPPORT.BANNER_FALTER_HP });
    }
  }

  /** Quem foge e sumiu de vista, longe de todos, não volta: o bando se desfez. */
  collectRouted(w: HostWorld): void {
    if (this.band || this.standFast) return;
    for (const s of this.squads) {
      if (!s.panicking) continue;
      for (const m of s.soldiers) {
        if (m.revealed || w.allies.some((a) => distance(a, m) < WAR_AI.ROUTED_GONE_RADIUS)) m.routedAt = w.time;
        else if (w.time - m.routedAt > WAR_AI.ROUTED_GONE_MS) this.links.vanish(m);
      }
    }
  }

  /** Tira a hoste (o bando saiu da bolha ou deixou de existir): os soldados voltam a ser dados. */
  dispose(): void {
    if (this.band) {
      this.band.alert = this.alert;
      this.band.host = undefined;
    }
    for (const s of this.squads) s.destroy();
    for (const m of [...this.riders, ...this.heralds]) m.driver = null;
    for (const m of this.members) m.command = null;
    this.squads = [];
  }
}

const TRAIT_WORD: Partial<Record<NobleTrait, string>> = {
  HONORABLE: "dizem que é honrado",
  CRUEL: "dizem que é cruel",
  GREEDY: "dizem que é ganancioso",
  AMBITIOUS: "dizem que é ambicioso",
  PIOUS: "dizem que é devoto",
  CUNNING: "dizem que é astuto",
  BRAVE: "dizem que é bravo",
  COWARD: "dizem que é medroso",
  GENEROUS: "dizem que é generoso",
  ENVIOUS: "dizem que é invejoso",
  ROMANTIC: "dizem que é romântico",
  SCHOLAR: "dizem que é letrado",
};

/** O que dá para ler do campo (o nome do plano fica para quem o descobrir). */
const PLAN_SIGN: Record<PlanKind, string> = {
  ASSAULT: "avançando",
  FLANK: "abrindo as alas",
  AMBUSH: "sumiu de vista",
  REAR_STRIKE: "manobrando",
  DECAPITATE: "avançando",
  FEINT: "recuando",
  HOLD: "de escudos fechados",
  RETREAT: "em retirada",
};

const attackOrder = (c: Contact): SquadOrder => ({ type: "ATTACK", target: c.unit, lastKnown: { x: c.x, y: c.y } });
const asView = (c: Contact): ContactView => ({ x: c.x, y: c.y, kind: c.kind, power: c.power });

function directionWord(from: Point, to: Point): string {
  const a = (Math.atan2(to.y - from.y, to.x - from.x) * 180) / Math.PI;
  if (a > -45 && a <= 45) return "a leste";
  if (a > 45 && a <= 135) return "ao sul";
  if (a > 135 || a <= -135) return "a oeste";
  return "ao norte";
}

/** Todas as hostes em campo. */
export class HostManager {
  hosts: WarHost[] = [];
  private nextShare = 0;

  constructor(private readonly links: HostLinks) {}

  /** Bando entrou na bolha: quem tem comando forma esquadrões. */
  attachBand(band: Warband): void {
    if (band.host || !band.staff) return;
    const host = new WarHost(`band:${band.id}`, band.members.filter((m) => m.isAlive), band.staff, this.links, band);
    band.host = host;
    this.hosts.push(host);
  }

  detachBand(band: Warband): void {
    const host = band.host;
    if (!host) return;
    host.dispose();
    this.hosts = this.hosts.filter((h) => h !== host);
  }

  /** Dois comandos amigos perto um do outro contam o que viram (trombeta e cavaleiro). */
  private share(time: number): void {
    if (time < this.nextShare) return;
    this.nextShare = time + WAR_AI.PERCEIVE_MS * 2;
    for (let i = 0; i < this.hosts.length; i++) {
      for (let j = i + 1; j < this.hosts.length; j++) this.hosts[i].shareWith(this.hosts[j]);
    }
  }

  /** Grupo fixo (local de contrato, covil): a mesma hoste, sem bando. */
  attachGroup(key: string, members: Enemy[], staff: StaffData): WarHost {
    const host = new WarHost(key, members, staff, this.links, null);
    this.hosts.push(host);
    return host;
  }

  update(w: HostWorld): void {
    for (const h of this.hosts) h.update(w);
    this.share(w.time);
    const gone = this.hosts.filter((h) => !h.alive);
    for (const h of gone) h.dispose();
    if (gone.length > 0) this.hosts = this.hosts.filter((h) => h.alive);
  }

  /** Depois dos golpes do quadro: moral e fugitivos. */
  afterCombat(w: HostWorld): void {
    for (const h of this.hosts) {
      h.updateMorale(w);
      h.collectRouted(w);
    }
  }

  clear(): void {
    for (const h of this.hosts) h.dispose();
    this.hosts = [];
  }
}

