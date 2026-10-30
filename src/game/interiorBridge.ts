/**
 * Ponte entre a cena do interior (Phaser) e a caixa de diálogo (React), Marco 14: a cena
 * registra quem trata a resposta escolhida; o React só chama `chooseDialog`.
 */
let handler: ((id: string) => void) | null = null;

export function registerDialogHandler(fn: ((id: string) => void) | null): void {
  handler = fn;
}

export function chooseDialog(id: string): void {
  handler?.(id);
}
