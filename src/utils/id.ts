/**
 * Identificador único. `crypto.randomUUID` só existe em contexto seguro (https ou localhost): o
 * jogo aberto pelo IP da máquina, na rede local, precisa da alternativa.
 */
export function newId(): string {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}
