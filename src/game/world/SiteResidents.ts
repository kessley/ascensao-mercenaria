import type { Enemy } from "../entities/Enemy";
import type { EnemyGroupDef } from "../data/battleMaps";
import type { SiteDef } from "../data/world";
import { residentGroups, siteFill, type SiteLife } from "../sim/siteLife";
import { SITE_LIFE } from "../../utils/constants";
import { distance, type Point } from "../../utils/math";

/** O que os moradores precisam saber do mundo. */
export interface SiteContext {
  sites: readonly SiteDef[];
  /** Onde o bando está (quem traz os moradores para o mapa). */
  presence: readonly Point[];
  /** O relógio do jogo: o dia com a fração. */
  now: number;
  lifeOf: (id: string) => SiteLife | undefined;
  /** Local de um contrato ativo: ali quem manda é o contrato, com a força inteira e o chefe. */
  contractSite: string | null;
  /** Há um combate em curso: ninguém some do mapa no meio dele. */
  fighting: boolean;
  /** Mudou quantos moradores sobraram (o store guarda isso, e vai no save). */
  onChange: (id: string, life: SiteLife) => void;
  /** Caiu o último morador. */
  onCleared: (site: SiteDef) => void;
}

interface Camp {
  members: Enemy[];
  /** Quantos vieram e o quanto o local estava cheio quando vieram. */
  spawned: number;
  fill: number;
  alive: number;
}

/**
 * Moradores dos locais de missão (Fase 3, etapa 10), como as guarnições dos povoados: longe do
 * bando são só um número no store; perto, viram inimigos no mapa, dormentes até alguém chegar.
 * Cada morador que cai baixa o número; o último a cair deixa o local vazio.
 */
export class SiteResidents {
  private camps = new Map<string, Camp>();

  constructor(
    private readonly spawnGroup: (site: SiteDef, group: EnemyGroupDef, index: number) => Enemy[],
    private readonly despawn: (e: Enemy) => void,
  ) {}

  /** Moradores no mapa agora (de um local, ou de todos). */
  members(siteId?: string): Enemy[] {
    const camps = siteId ? [this.camps.get(siteId)] : [...this.camps.values()];
    return camps.flatMap((c) => (c ? c.members.filter((m) => m.isAlive) : []));
  }

  update(ctx: SiteContext): void {
    for (const site of ctx.sites) {
      const camp = this.camps.get(site.id);
      if (site.id === ctx.contractSite) {
        if (camp) this.handOver(site.id, camp);
        continue;
      }
      if (camp) {
        this.follow(site, camp, ctx);
        continue;
      }
      if (!ctx.presence.some((p) => distance(p, site.center) < SITE_LIFE.SPAWN_RADIUS)) continue;
      const stored = ctx.lifeOf(site.id);
      const fill = siteFill(stored, ctx.now);
      const groups = residentGroups(site.groups, fill);
      if (groups.length === 0) continue;
      const members = groups.flatMap((g, i) => this.spawnGroup(site, g, i));
      this.camps.set(site.id, { members, spawned: members.length, fill, alive: members.length });
      // O quanto encheu até agora fica valendo: dali em diante, conta quem cair
      if (stored && stored.fill < 1) ctx.onChange(site.id, { fill, since: ctx.now });
    }
  }

  /** Quem caiu baixa o número; longe de todos e sem luta, os que sobraram voltam a ser número. */
  private follow(site: SiteDef, camp: Camp, ctx: SiteContext): void {
    const alive = camp.members.filter((m) => m.isAlive);
    if (alive.length !== camp.alive) {
      camp.alive = alive.length;
      ctx.onChange(site.id, { fill: camp.spawned > 0 ? (camp.fill * alive.length) / camp.spawned : 0, since: ctx.now });
      if (alive.length === 0) {
        this.camps.delete(site.id);
        ctx.onCleared(site);
        return;
      }
    }
    const far = ctx.presence.every((p) => distance(p, site.center) > SITE_LIFE.DESPAWN_RADIUS);
    if (!far || ctx.fighting || alive.some((m) => m.target?.isAlive)) return;
    for (const m of alive) this.despawn(m);
    this.camps.delete(site.id);
  }

  /**
   * Contrato aceito para o local: ele traz a força inteira e o chefe. Os moradores fora de vista
   * saem; quem está à vista não some do nada e fica como inimigo sem dono. O número não muda:
   * se o contrato cair, eles voltam.
   */
  private handOver(id: string, camp: Camp): void {
    for (const m of camp.members) {
      if (!m.isAlive) continue;
      if (m.revealed) m.owner = null;
      else this.despawn(m);
    }
    this.camps.delete(id);
  }

  /** O campo foi refeito (carregar um jogo): os inimigos já saíram, então só se esquece deles. */
  forget(): void {
    this.camps.clear();
  }

  clearAll(): void {
    for (const c of this.camps.values()) for (const m of c.members) if (m.isAlive) this.despawn(m);
    this.camps.clear();
  }
}
