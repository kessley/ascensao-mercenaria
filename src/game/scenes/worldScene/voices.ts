import { Battalion } from "../../entities/Battalion";
import type { Enemy } from "../../entities/Enemy";
import type { EnemySquad } from "../../systems/EnemySquad";
import { useGameStore } from "../../../store/useGameStore";
import { FATIGUE } from "../../../utils/constants";
import { hashString } from "../../../utils/hash";
import { cultureOf } from "../../sim/culture";
import { currentTongue, isFemaleName } from "../../worldgen/names";
import { AudioEngine } from "../../../audio/AudioEngine";
import { TROOP_VOICE, enemyVoice, personTimbre, type Bark } from "../../../audio/speech";
import { say, type SayOptions, type Speaker } from "../../../audio/voice";
import type { OrderRecipient } from "./shared";
import type { WorldScene } from "../WorldScene";

/**
 * As vozes do campo (S1): quem responde à seleção e à ordem, quem grita de medo, de cansaço e de
 * vitória, e o que o inimigo berra. Uma parte da `WorldScene`: os métodos entram no protótipo dela.
 */

/** De quanto em quanto tempo a cena olha quem mudou de ânimo (ms). */
const WATCH_MS = 200;
/** O inimigo provoca de tempos em tempos enquanto se luta (ms, mínimo e folga). */
const TAUNT_MS = { MIN: 3200, EXTRA: 3600 };

/** A voz de um batalhão: o tenente ou o capitão que o conduz fala por ele; sem eles, fala a tropa. */
export function battalionSpeaker(b: Battalion): Speaker {
  const base = TROOP_VOICE[b.troopType];
  const person = b.lieutenant && !b.lieutenantDied ? b.lieutenant : b.captain && !b.captainDied ? b.captain : null;
  if (person) {
    return { key: `p:${person.id}`, tongue: cultureOf(person), species: "human", timbre: personTimbre(person.id, isFemaleName(person.name), base) };
  }
  // Dois batalhões da mesma tropa não soam idênticos: uma folga pequena na nota
  const shade = 0.96 + (hashString(b.id) % 9) / 100;
  return { key: `b:${b.id}`, tongue: b.culture, species: "human", timbre: { ...base, pitch: base.pitch * shade } };
}

/** Um cavaleiro de apoio (batedor ou mensageiro): voz própria, leve, de quem vive a cavalo. */
export function riderSpeaker(rider: { id: string; name: string }): Speaker {
  return {
    key: `r:${rider.id}`,
    tongue: cultureOf(useGameStore.getState().leader),
    species: "human",
    timbre: personTimbre(rider.id, isFemaleName(rider.name), TROOP_VOICE.HORSE_ARCHERS),
  };
}

export function commanderSpeaker(): Speaker {
  const leader = useGameStore.getState().leader;
  return {
    key: "comandante",
    tongue: cultureOf(leader),
    species: "human",
    timbre: personTimbre(leader.face ?? leader.name, isFemaleName(leader.name), TROOP_VOICE.KNIGHTS),
  };
}

/** Quem fala por um inimigo (null: bicho, carroça e quem não luta não falam). */
export function enemySpeaker(e: Enemy): Speaker | null {
  const v = enemyVoice(e.kind);
  if (!v) return null;
  // Cada esquadrão tem uma garganta: o mesmo bando não repete a mesma voz
  const group = e.squad ? `s:${hashString(`${e.kind}:${Math.round(e.squad.startingCount)}`) % 7}` : "solto";
  return { key: `e:${e.kind}:${group}`, tongue: v.tongue ?? currentTongue(), species: v.species, timbre: v.timbre };
}

export const voicesMethods = {
  /** A tropa (ou o batedor) diz uma fala, de onde está. */
  troopSays(this: WorldScene, r: OrderRecipient, bark: Bark, opts?: SayOptions): boolean {
    if (r instanceof Battalion) return !r.isDestroyed && say(battalionSpeaker(r), bark, r.center, opts);
    return r.isAlive && say(riderSpeaker(r.rider), bark, r, opts);
  },

  commanderSays(this: WorldScene, bark: Bark): boolean {
    return this.commander.isAlive && say(commanderSpeaker(), bark, this.commander, { floor: 0.6 });
  },

  enemySays(this: WorldScene, e: Enemy, bark: Bark): boolean {
    const who = enemySpeaker(e);
    return !!who && say(who, bark, e);
  },

  /** Quem acabou de ser selecionado responde: só o primeiro, e mesmo de longe se ouve. */
  selectionBark(this: WorldScene, battalions: readonly Battalion[], scouts: readonly OrderRecipient[]): void {
    const first = battalions.find((b) => !b.isDestroyed) ?? scouts[0];
    if (first) this.troopSays(first, "select", { floor: 0.5 });
  },

  /**
   * As falas que ninguém pede: o pânico, o reagrupar, o cansaço e a provocação do inimigo. A cena
   * olha quem mudou de ânimo desde a última vez (assim, carregar um jogo salvo não faz ninguém gritar).
   */
  updateVoices(this: WorldScene, time: number): void {
    if (time - this.voiceWatchAt < WATCH_MS) return;
    this.voiceWatchAt = time;

    for (const b of this.battalions) {
      if (b.isDestroyed) continue;
      const mood = (b.panicking ? 1 : 0) | (b.fatigue >= FATIGUE.EXHAUSTED ? 2 : 0);
      const was = this.voiceMood.get(b);
      this.voiceMood.set(b, mood);
      if (was === undefined || was === mood) continue;
      if (mood & 1 && !(was & 1)) this.troopSays(b, "panic");
      else if (was & 1 && !(mood & 1) && !this.quartered.has(b.id)) this.troopSays(b, "cheer", { volume: 0.7 });
      else if (mood & 2 && !(was & 2)) this.troopSays(b, "tired");
    }

    // Os esquadrões inimigos que se ouvem daqui: quem debandou grita
    const squads = new Set<EnemySquad>();
    for (const e of this.enemies) {
      if (!e.squad || squads.has(e.squad) || !e.revealed) continue;
      squads.add(e.squad);
      const was = this.squadPanic.get(e.squad);
      this.squadPanic.set(e.squad, e.squad.panicking);
      if (was === false && e.squad.panicking) this.enemySays(e, "panic");
    }

    // No meio da luta, de vez em quando um inimigo perto provoca
    if (!this.engagement) {
      this.nextTauntAt = 0;
      return;
    }
    if (this.nextTauntAt === 0) this.nextTauntAt = time + 300;
    if (time < this.nextTauntAt) return;
    this.nextTauntAt = time + TAUNT_MS.MIN + Math.random() * TAUNT_MS.EXTRA;
    const near = [...this.engagement.enemies].filter((e) => e.isAlive && e.revealed && !e.routed && AudioEngine.audibility(e.x, e.y) > 0.15);
    if (near.length > 0) this.enemySays(near[Math.floor(Math.random() * near.length)], "taunt");
  },
};

export type VoicesMethods = typeof voicesMethods;
