import { TROOPS, type TroopType } from "../../utils/constants";

const pct = (v: number) => `${Math.round(v * 100)}%`;

/** Os atributos que diferenciam uma tropa, em poucas palavras. */
export function troopFacts(type: TroopType): string[] {
  const s = TROOPS[type].stats;
  const facts = [`Vida ${s.hp}`, `Velocidade ${s.speed}`, `Ataque ${s.attack ?? 40}`, `Defesa ${s.defense ?? 40}`];
  if (s.armor) facts.push(`Armadura ${pct(s.armor)}`);
  if (s.shield) facts.push(`Escudo ${pct(s.shield)}`);
  if (s.pierce) facts.push(`Perfura ${pct(s.pierce)}`);
  if (s.ranged) facts.push(`Alcance ${s.range}`, `${s.ammo} tiros`);
  if (s.brace) facts.push(`${String(s.antiCavalry).replace(".", ",")}× contra cavalo`);
  if (s.charge) facts.push(`Investida ${String(s.charge).replace(".", ",")}×`);
  return facts;
}
