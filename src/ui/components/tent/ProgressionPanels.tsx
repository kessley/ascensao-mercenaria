import { useState } from "react";
import { useGameStore, type BattalionData } from "../../../store/useGameStore";
import { SKILL_TREE, SKILLS } from "../../../game/data/skills";
import { PROGRESSION, TROOPS } from "../../../utils/constants";
import { canLearn, describeMods, forgeCost, type EquipmentSlot } from "../../../utils/progression";
import { Button } from "../Button";
import { BattalionCard } from "./ArmyPanel";

const sectionTitle = "text-sm font-bold uppercase tracking-wider text-neutral-400";

/** Árvore de habilidades do batalhão: dois ramos, a habilidade avançada exige a base. */
export function SkillTree({ battalion: b }: { battalion: BattalionData }) {
  const learnSkill = useGameStore((s) => s.learnSkill);

  return (
    <section className="flex flex-col gap-2">
      <h3 className={sectionTitle}>
        Habilidades <span className="font-normal normal-case text-neutral-500">· {b.skillPoints} ponto(s)</span>
      </h3>
      <div className="grid grid-cols-2 gap-2">
        {SKILL_TREE[b.troopType].map((branch) => (
          <div key={branch[0]} className="flex flex-col items-stretch gap-1">
            {branch.map((id, tier) => {
              const skill = SKILLS[id];
              const learned = b.skills.includes(id);
              const blocked = canLearn(b, id);
              return (
                <div key={id} className="flex flex-col items-stretch">
                  {tier > 0 && <div className="mx-auto h-3 w-0.5 bg-neutral-600" />}
                  <button
                    type="button"
                    disabled={learned || blocked !== null}
                    onClick={() => learnSkill(b.id, id)}
                    title={blocked && !learned ? blocked : undefined}
                    className={`flex flex-col gap-0.5 rounded border p-2 text-left text-xs ${
                      learned
                        ? "border-lime-500 bg-lime-900/40"
                        : blocked
                          ? "cursor-not-allowed border-neutral-700 bg-neutral-800 opacity-60"
                          : "border-amber-400 bg-neutral-800 hover:bg-neutral-700"
                    }`}
                  >
                    <span className="font-semibold text-neutral-100">
                      {learned ? "✓ " : ""}
                      {skill.label}
                    </span>
                    <span className="text-neutral-400">{skill.description}</span>
                    {!learned && blocked === null && <span className="text-amber-300">Aprender (1 ponto)</span>}
                  </button>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </section>
  );
}

/** Painel do alojamento: ficha do batalhão, bônus atuais e árvore de habilidades. */
export function BattalionDetail({ battalion: b }: { battalion: BattalionData }) {
  const bonuses = describeMods(b);
  return (
    <>
      <BattalionCard battalion={b} />
      {bonuses.length > 0 && (
        <section className="flex flex-col gap-1">
          <h3 className={sectionTitle}>Bônus em campo</h3>
          <ul className="flex flex-wrap gap-1 text-xs">
            {bonuses.map((line) => (
              <li key={line} className="rounded bg-neutral-800 px-2 py-0.5 text-neutral-300">
                {line}
              </li>
            ))}
          </ul>
        </section>
      )}
      <SkillTree battalion={b} />
      <p className="text-xs text-neutral-500">
        Equipamento é forjado na Ferraria; experiência vem de batalhas e do Campo de Treino.
      </p>
    </>
  );
}

/** Campo de Treino: gasta dias e ouro para dar experiência aos batalhões escolhidos. */
export function TrainingPanel() {
  const battalions = useGameStore((s) => s.battalions);
  const gold = useGameStore((s) => s.gold);
  const pendingMutiny = useGameStore((s) => s.pendingMutiny);
  const trainBattalions = useGameStore((s) => s.trainBattalions);
  const eligible = battalions.filter((b) => b.level < PROGRESSION.MAX_LEVEL);
  const [chosen, setChosen] = useState<string[]>([]);
  const picked = chosen.filter((id) => eligible.some((b) => b.id === id));
  const cost = picked.length * PROGRESSION.TRAINING_COST;

  const toggle = (id: string) => setChosen((c) => (c.includes(id) ? c.filter((x) => x !== id) : [...c, id]));

  return (
    <section className="flex flex-col gap-3">
      <p className="text-sm text-neutral-300">
        Cada batalhão treinado ganha <b>{PROGRESSION.TRAINING_XP} XP</b>. O treino dura{" "}
        <b>{PROGRESSION.TRAINING_DAYS} dias</b> (o acampamento consome rações e pode cair um dia de pagamento) e custa{" "}
        <b>{PROGRESSION.TRAINING_COST} de ouro</b> por batalhão.
      </p>
      {eligible.length === 0 && <p className="text-sm text-neutral-500">Nenhum batalhão pode treinar.</p>}
      <div className="flex flex-col gap-2">
        {eligible.map((b) => (
          <label key={b.id} className="flex cursor-pointer items-center gap-3 rounded bg-neutral-800 px-3 py-2 text-sm">
            <input type="checkbox" checked={picked.includes(b.id)} onChange={() => toggle(b.id)} />
            <span className="flex-1">
              <span className="font-semibold">{b.name}</span>{" "}
              <span className="text-xs text-neutral-400">
                {TROOPS[b.troopType].label} · Nv {b.level}
              </span>
            </span>
          </label>
        ))}
      </div>
      <Button
        disabled={picked.length === 0 || gold < cost || pendingMutiny}
        onClick={() => {
          if (trainBattalions(picked)) setChosen([]);
        }}
      >
        Treinar {picked.length} batalhão(ões) por {PROGRESSION.TRAINING_DAYS} dias ({cost} ouro)
      </Button>
      {pendingMutiny && <p className="text-xs text-red-400">Ninguém treina durante um motim.</p>}
    </section>
  );
}

const SLOT_LABEL: Record<EquipmentSlot, { name: string; effect: string }> = {
  weapon: { name: "Armas", effect: `+${PROGRESSION.WEAPON_DAMAGE_PER_TIER * 100}% de dano por nível` },
  armor: { name: "Armaduras", effect: `−${PROGRESSION.ARMOR_REDUCTION_PER_TIER * 100}% de dano recebido por nível` },
};

/** Ferraria: forja o próximo nível de arma ou armadura de cada batalhão (ouro + ferro). */
export function ForgePanel() {
  const battalions = useGameStore((s) => s.battalions);
  const gold = useGameStore((s) => s.gold);
  const iron = useGameStore((s) => s.iron);
  const forgeEquipment = useGameStore((s) => s.forgeEquipment);

  return (
    <section className="flex flex-col gap-3">
      <p className="text-sm text-neutral-300">
        Ferro em estoque: <b className="text-sky-300">{iron}</b>. Ferro vem do saque de batalhas vencidas e do mercador da
        Intendência.
      </p>
      {battalions.length === 0 && <p className="text-sm text-neutral-500">Nenhum batalhão para equipar.</p>}
      {battalions.map((b) => (
        <div key={b.id} className="flex flex-col gap-2 rounded bg-neutral-800 p-3 text-sm">
          <div className="font-semibold">
            {b.name} <span className="text-xs font-normal text-neutral-400">{TROOPS[b.troopType].label}</span>
          </div>
          {(Object.keys(SLOT_LABEL) as EquipmentSlot[]).map((slot) => {
            const tier = b.equipment[slot];
            const maxed = tier >= PROGRESSION.MAX_EQUIPMENT_TIER;
            const cost = forgeCost(tier);
            return (
              <div key={slot} className="flex items-center justify-between gap-2 text-xs">
                <span>
                  {SLOT_LABEL[slot].name}{" "}
                  <span className="font-mono text-amber-300">
                    {"■".repeat(tier)}
                    {"□".repeat(PROGRESSION.MAX_EQUIPMENT_TIER - tier)}
                  </span>{" "}
                  <span className="text-neutral-500">{SLOT_LABEL[slot].effect}</span>
                </span>
                {maxed ? (
                  <span className="text-neutral-500">máximo</span>
                ) : (
                  <button
                    type="button"
                    disabled={gold < cost.gold || iron < cost.iron}
                    onClick={() => forgeEquipment(b.id, slot)}
                    className="shrink-0 rounded border border-amber-500 px-2 py-0.5 text-amber-200 hover:bg-amber-900/40 disabled:cursor-not-allowed disabled:border-neutral-600 disabled:text-neutral-500"
                  >
                    Forjar nv {tier + 1} ({cost.gold} ouro, {cost.iron} ferro)
                  </button>
                )}
              </div>
            );
          })}
        </div>
      ))}
    </section>
  );
}

/** Mercador ambulante: compra e venda de ferro (comércio nas cidades chega com o mapa-múndi). */
export function IronTrader() {
  const gold = useGameStore((s) => s.gold);
  const iron = useGameStore((s) => s.iron);
  const tradeIron = useGameStore((s) => s.tradeIron);
  return (
    <section className="flex flex-col gap-2">
      <h2 className={sectionTitle}>Mercador ambulante</h2>
      <p className="text-xs text-neutral-400">
        Ferro: <b className="text-sky-300">{iron}</b> · compra a {PROGRESSION.IRON_BUY_PRICE} de ouro, vende a{" "}
        {PROGRESSION.IRON_SELL_PRICE}.
      </p>
      <div className="flex flex-wrap gap-2">
        <Button disabled={gold < PROGRESSION.IRON_BUY_PRICE * 3} onClick={() => tradeIron(3)}>
          Comprar 3 ferro ({PROGRESSION.IRON_BUY_PRICE * 3} ouro)
        </Button>
        <Button variant="danger" disabled={iron < 3} onClick={() => tradeIron(-3)}>
          Vender 3 ferro (+{PROGRESSION.IRON_SELL_PRICE * 3} ouro)
        </Button>
      </div>
    </section>
  );
}
