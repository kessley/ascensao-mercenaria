interface StatBarProps {
  label: string;
  value: number;
  max: number;
  /** Classe Tailwind de cor de fundo do preenchimento, ex. "bg-green-500". */
  colorClass: string;
}

export function StatBar({ label, value, max, colorClass }: StatBarProps) {
  const pct = max > 0 ? Math.max(0, Math.min(100, (value / max) * 100)) : 0;

  return (
    <div className="w-full">
      <div className="mb-0.5 flex justify-between font-mono text-xs text-neutral-200">
        <span>{label}</span>
        <span>
          {Math.ceil(value)}/{max}
        </span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded bg-neutral-800">
        <div className={`h-full transition-[width] duration-100 ${colorClass}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
