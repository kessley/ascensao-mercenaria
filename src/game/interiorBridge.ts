/**
 * Ponte entre as cenas com diálogo (Phaser) e a caixa de diálogo (React), Marco 14: a cena
 * registra quem trata a resposta escolhida; o React só chama `chooseDialog`. É uma pilha
 * (Marco 15): um prédio aberto a partir da Cidade Alta trata as respostas enquanto está aberto
 * e, ao fechar, a cidade volta a tratá-las.
 */
const handlers: ((id: string) => void)[] = [];

/** Registra quem trata as respostas; devolve a função que tira esse registro. */
export function registerDialogHandler(fn: (id: string) => void): () => void {
  handlers.push(fn);
  return () => {
    const i = handlers.lastIndexOf(fn);
    if (i >= 0) handlers.splice(i, 1);
  };
}

export function chooseDialog(id: string): void {
  handlers[handlers.length - 1]?.(id);
}
