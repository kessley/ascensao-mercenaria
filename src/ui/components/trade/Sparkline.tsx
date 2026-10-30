/** Cores dos gráficos do comércio (superfície escura do jogo). */
export const VIZ = {
  ink: "#c3c2b7",
  muted: "#7a7970",
  grid: "#383835",
  cheap: "#3987e5",
  dear: "#e66767",
  neutral: "#383835",
};

/**
 * Linha de preço de um bem (Marco 14): uma série só, traço de 2 px, ponto no último valor e
 * a linha tracejada do preço base como referência. Passar o mouse mostra os valores.
 */
export function Sparkline({ values, base, width = 72, height = 22, label }: { values: readonly number[]; base: number; width?: number; height?: number; label: string }) {
  if (values.length < 2) return <span className="inline-block text-[10px] text-neutral-500" style={{ width }}>—</span>;
  const lo = Math.min(base, ...values);
  const hi = Math.max(base, ...values);
  const span = hi - lo || 1;
  const pad = 4;
  const x = (i: number) => pad + (i / (values.length - 1)) * (width - pad * 2);
  const y = (v: number) => height - pad - ((v - lo) / span) * (height - pad * 2);
  const points = values.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
  const last = values[values.length - 1];
  return (
    <svg width={width} height={height} role="img" aria-label={`${label}: de ${values[0]} a ${last}`} className="inline-block align-middle">
      <title>{`${label} — últimos preços: ${values.map((v) => Math.round(v)).join(" → ")} (base ${base})`}</title>
      <line x1={pad} x2={width - pad} y1={y(base)} y2={y(base)} stroke={VIZ.muted} strokeWidth={1} strokeDasharray="2 3" />
      <polyline points={points} fill="none" stroke={VIZ.ink} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={x(values.length - 1)} cy={y(last)} r={3} fill={VIZ.ink} stroke="#171717" strokeWidth={1.5} />
    </svg>
  );
}

/** Fundo de uma célula de preço: azul se barato, vermelho se caro, cinza perto do preço base. */
export function priceTint(ratio: number): string {
  const t = Math.max(-1, Math.min(1, Math.log(ratio) / Math.log(2.5)));
  if (Math.abs(t) < 0.12) return VIZ.neutral;
  const alpha = 0.2 + Math.abs(t) * 0.55;
  const hex = t < 0 ? VIZ.cheap : VIZ.dear;
  const a = Math.round(alpha * 255)
    .toString(16)
    .padStart(2, "0");
  return `${hex}${a}`;
}
