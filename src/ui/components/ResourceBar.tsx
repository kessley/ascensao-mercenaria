import { useGameStore } from "../../store/useGameStore";

export function ResourceBar() {
  const gold = useGameStore((s) => s.gold);
  const rations = useGameStore((s) => s.rations);
  const iron = useGameStore((s) => s.iron);

  return (
    <div className="flex gap-4 whitespace-nowrap rounded bg-black/60 px-4 py-2 text-sm font-mono text-white">
      <span className="text-yellow-400">Ouro: {gold}</span>
      <span className="text-orange-300">Rações: {rations}</span>
      <span className="text-sky-300">Ferro: {iron}</span>
    </div>
  );
}
