# Pendências e avaliação das mecânicas

Levantamento feito depois do Marco 18. Vale o que está aqui, e não as listas "Ficou de fora" de cada marco: várias delas já foram resolvidas por marcos seguintes.

As notas de mecânica vêm das regras e dos números do código e de batalhas simuladas. **Ninguém jogou uma campanha inteira.** Elas dizem onde há decisão de verdade, não onde o jogo é divertido.

## O que ficou de fora

### Combinado e não feito
- **Batalhões grandes:** 60 a 100 na milícia, poucos na elite. Depende do motor, porque 1600 soldados dão 16 fps de perto.
- **Alcance dos arcos:** subir de 230 para perto de 480. Hoje a infantaria correndo atravessa o alcance em menos de 3 s.
- **Magia do Comandante:** Marco 19, o último do roadmap.

### Sistemas incompletos
| De onde veio | O que falta |
| --- | --- |
| Marco 14 | Despachar carga própria por barcaça ou navio, sem o bando ir junto |
| Marco 16 | Cercos da IA são só simulação: o jogador não vê escadas e aríetes inimigos nos muros de uma cidade alheia |
| Marco 17 | Calamidades próprias de cada continente |
| Marco 17 | Invasões de reinos pelo mar (só há corsários) |
| Marco 17 | Ilhas pequenas no Mapa Múndi |
| Marco 17 | Batalha entre navios e dano no casco: a frota não afunda |
| Marco 17 | Recrutar as tropas típicas de ultramar: só o inimigo as usa |
| Marco 18 | Mundos que lembram: as vilas fundadas pelo bando e o mapa político não mudam, só a história, os textos e os nomes |
| Marco 18 | Título no feminino para tenentes herdeiros, cujo gênero o jogo não guarda |
| Marco 18 | Nomes iguais confundem as páginas das Lendas |
| Batalha personalizada | Aliados controlados pela IA |
| Expedições | A coluna é só desenho: ninguém a ataca, e a luta é um cálculo |

### Dívida
- **Equilíbrio:** nada foi ajustado jogando. Os Marcos 14, 15, 16, 17 e 18 foram calibrados só por simulação.
- **Saves antigos:** não foram testados com os Marcos 16, 17 e 18.
- **Testes de confronto:** usam 6 lutas por caso, pouco para um resultado aleatório. Passam ou falham por sorte perto do limite ("cavaleiros vencem mais lanceiros montados" ficou em 2 a 4 de 6). Precisam de mais amostras ou de limites mais largos.
- **Assalto sem fim:** em 2 de 16 assaltos à Paliçada com jogador simulado, a batalha passou de 10 minutos com poucos sobreviventes dos dois lados. Não voltou a acontecer nas repetições, e a causa não foi encontrada. Numa partida, o menu de pausa permite sair.
- **Commit:** nada foi salvo no Git desde o Marco 16. Mais de 70 arquivos estão só nesta máquina.
- **`WorldScene.ts`:** tem quase 6000 linhas. Vai pesar na troca dos gráficos.

## Avaliação das mecânicas

| Mecânica | Nota | Por quê |
| --- | --- | --- |
| Combate tático | **Fundo** | Flanco, moral, investida, flechas em área, fogo amigo e fileiras geram decisões reais. O limite é o tamanho: fileiras e flancos mal aparecem com 8 soldados |
| IA inimiga | **Fundo** | 8 planos, personalidade, uso das tropas e dos muros |
| Moral | **Fundo** | Baixas, flanco, pânico contagioso e estandarte |
| Logística | **Bom** | Rações, carroças, fadiga, doença e estações disputam a mesma carga |
| Cerco de campanha | **Bom** | Fome ou assalto, madeira, portão fraco e socorro |
| Comércio | **Bom no modelo** | Oferta, procura e rotas existem; o Marco 14 anotou que a fome está rara e o nível de vida, alto |
| Legado | **Promissor** | Novo: testamento, traços e cicatrizes criam decisão, mas falta tempo de jogo para saber |
| Contratos | **Médio** | 10 tipos, mas cada um é um serviço solto. Quase nada encadeia um contrato no outro |
| Tenentes | **Médio** | Têm história, mas a passiva é sorteada e não muda. Nada nasce de decisão do jogador |
| Corte e nobreza | **Amplo, sem prova** | 6 tipos de favor, tramas e duelos. É o sistema mais longe do que o jogador faz no dia a dia |
| Reino | **Raso** | 11 construções são uma lista de efeitos. Rei com 4 povoados é cedo, e governar é abrir um menu |
| Mar | **Raso** | Primeira versão: uma viagem são segundos assistindo, com 3 eventos, e navio é só capacidade |
| Expedições | **Raso** | Um cálculo com uma coluna em cima |
| **Progressão de batalhões** | **Raso, o pior caso** | Ver abaixo |
| **Comandante em si** | **Raso** | Anda, bate e grita. Não evolui. A magia do Marco 19 é a única coisa planejada para ele |

### O maior problema: progressão de batalhões
- **Não há escolha.** Cada árvore tem 4 habilidades, e o nível máximo 5 dá exatamente 4 pontos. Todo veterano termina igual; a decisão é só a ordem.
- **É só multiplicador.** Quase todas as habilidades são +15% ou +20% de alguma coisa, e nada muda o jeito de lutar.
- **São só 3 árvores** para 9 tropas: lanceiro e guarda pesada têm as mesmas opções.
- **Acaba cedo.** Do 1 ao 5 são 1000 de XP, cerca de 7 batalhas, e o treino dá 80 de XP por 15 de ouro: uns 190 de ouro bastam sem lutar.
- **Tropa não muda de tipo.** Não existe promoção de infantaria para guarda pesada.

### O que eu faria, em ordem de retorno
1. **Progressão:** escolher 2 de 4 habilidades, exclusivas, que mudem comportamento (por exemplo, formar parede mais depressa ou atirar correndo), mais promoção de tropa.
2. **Jogar uma campanha inteira** e corrigir o que aparecer: nenhum teste substitui isso.
3. **Comandante:** habilidades ativas ligadas aos traços, antes mesmo da magia.
4. **Contratos em cadeia:** o que você fez para um cliente abre ou fecha o próximo.
5. **Reino com decisão:** eventos de governo, com escolha e custo, em vez de só construções.
