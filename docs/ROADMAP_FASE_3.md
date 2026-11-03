# Roadmap — Fase 3: O arcano

Objetivo da fase: trocar o greybox por pixel art e, junto, dar ao bando o que faltava: capitães, duelos em campo, um acampamento construído pelo jogador, cultura, religião e língua e, por último, a magia do Comandante. As pendências das Fases 1 e 2 e a avaliação das mecânicas ficam no fim deste arquivo.

**Onde estamos (3 de novembro de 2026):**
- **Feito:** a progressão dos batalhões, a pixel art das figuras (G0 e G1) e das construções (G3), as rações refeitas (mochilas e comboio) e os capitães no acampamento (Marco 20, parte 1).
- **Próximo:** os capitães na batalha (Marco 20, parte 2).
- **Em andamento, sem pressa:** o chão (G2).

Índice e visão geral: [ROADMAP.md](ROADMAP.md) · Fase anterior: [Fase 2 — O mundo que respira](ROADMAP_FASE_2.md) · Design: [GDD.md](GDD.md), seção 8 · Arte: [PLANO_GRAFICO.md](PLANO_GRAFICO.md) (por quê e como) e [ARTE.md](ARTE.md) (o que existe e o que falta).

---

## Como esta fase anda
- **Uma fila só.** Arte e recursos vêm intercalados: cada etapa de arte entra logo antes do recurso que mais precisa dela, e cada recurso já nasce com a arte pronta da etapa anterior.
- **Cada etapa termina jogável.** O que ainda não virou pixel art continua em greybox, funcionando.
- **A ordem dos recursos é a combinada:** 20 (capitães) → 21 (duelos) → 22 (acampamento construído) → 23 (cultura, religião e língua), com a magia (19) por último.
  - O 21 vem depois do 20 porque quem duela são os capitães e os chefes.
  - O 23 mexe em quase tudo (recrutamento, comércio, corte, acampamento), então fica para quando o resto estiver firme.
- **Marco grande se divide em partes,** e cada parte tem o seu "Pronto quando".
- As regras que valem para todo marco novo estão no [ROADMAP.md](ROADMAP.md).

## A fila

| # | Etapa | Tipo | Por que aqui | Estado |
| --- | --- | --- | --- | --- |
| 1 | [Progressão de batalhões refeita](#1-progressão-de-batalhões-refeita--ok) | recurso | Era o pior caso da avaliação das mecânicas | ✅ OK |
| 2 | [G0 e G1: prova e figuras em campo](#2-g0-e-g1-prova-e-figuras-em-campo--ok) | arte | Tudo o mais desenha em cima das figuras | ✅ OK |
| 3 | [G3: construções](#3-g3-construções--ok) | arte | As peças servem depois ao Marco 22 | ✅ OK |
| 4 | [Rações refeitas: mochilas e comboio](#4-rações-refeitas-mochilas-e-comboio) | recurso | Pedido no meio do Marco 20: a carroça de ração em toda marcha não ficou boa | feito; falta jogar uma campanha com ele |
| 5 | [Marco 20, parte 1: capitães no acampamento](#5-marco-20-parte-1-capitães-no-acampamento) | recurso | | feito |
| 6 | [Marco 20, parte 2: capitães na batalha](#6-marco-20-parte-2-capitães-na-batalha) | recurso | | **próximo** |
| 7 | [G2: o resto do chão](#7-g2-o-resto-do-chão) | arte | Árvores, margens e pontes mudam o campo onde as companhias manobram, e o duelo põe a câmera a 200% em cima do chão | em andamento |
| 8 | [Arrumação: dividir a `WorldScene`](#8-arrumação-dividir-a-worldscene) | dívida | Os Marcos 21 e 22 mexem muito nela | |
| 9 | [Marco 21: duelos no meio da batalha](#9-marco-21-duelos-no-meio-da-batalha) | recurso e arte | Traz as poses de golpe das figuras | |
| 10 | [G4: resto do elenco](#10-g4-resto-do-elenco) | arte | Carroças de verdade para o comboio e para as obras; gente no acampamento para quem vai construir | |
| 11 | [Marco 22: acampamento construído](#11-marco-22-acampamento-construído-pelo-bando-e-construir-nas-vilas) | recurso | Usa as peças do G3 e a gente do G4 | |
| 12 | [G5: interface](#12-g5-interface) | arte | Retratos de capitães e tenentes e ícones das construções; o Marco 23 enche a interface de fé e língua | |
| 13 | [Marco 23: cultura, religião e língua](#13-marco-23-cultura-religião-e-língua) | recurso | | |
| 14 | [G6: atmosfera](#14-g6-atmosfera) | arte | Nevoeiro, tochas, gelo e fogo são o que a magia mexe | |
| 15 | [Marco 19: magia do Comandante](#15-marco-19-magia-do-comandante) | recurso | Por último, como combinado | |
| 16 | [Fechamento: jogar uma campanha inteira](#16-fechamento-jogar-uma-campanha-inteira) | dívida | Equilíbrio, saves antigos e o que aparecer | |

**Fora da fila, esperando o seu sinal:** batalhões grandes (60 a 100 na milícia) e o alcance dos arcos. O melhor lugar é logo depois da etapa 6, porque com companhias um exército grande fica controlável. Ver [Pendências](#pendências-das-fases-1-e-2).

---

## 1. Progressão de batalhões refeita ✅ OK
**Objetivo:** todo veterano terminava igual, as habilidades eram só multiplicadores e a progressão acabava cedo.
- **Escolha:** cada família (infantaria, arqueiros, cavalaria) tem 4 linhas de 2 habilidades. Nos níveis 2 a 5 o batalhão escolhe uma de cada linha, e a outra se perde. Dá 16 combinações por família.
- **12 habilidades que mudam o jeito de lutar:**
  - **Infantaria:** Fileiras Cerradas, Caçadores de Flanco, Último Reduto, Tropa de Choque.
  - **Arqueiros:** Salva Cerrada, Tiro em Marcha, Flechas de Medo, Aljavas Fundas.
  - **Cavalaria:** Atravessar a Linha, Meia-Volta, Terror, Caçar Fugitivos.
- **Promoção:** a partir do nível 3 a tropa muda de ofício (infantaria vira guarda pesada ou lanceiros; arqueiros viram besteiros ou arqueiros montados; cavalaria vira cavaleiros ou arqueiros montados).
  - Custa 1,5 vez a diferença de preço das tropas (mínimo de 60 de ouro), mais 8 de ferro e os cavalos de quem passa a montar.
  - Na mesma família, mantém nível e habilidades; noutra família, os pontos voltam para a escolha.
- **Ritmo:** do nível 1 ao 5 são 1500 de XP, cerca de 10 batalhas. O treino só vai até o nível 3; daí em diante, só a guerra ensina.
- **Testes:** 25 de regras (`tests/unit/progression.test.ts`) e 13 verificações em batalha de verdade (`npm run test:battle -- progressao`).
- **Ficou de fora:** equilíbrio jogado. Ninguém levou um batalhão do 1 ao 5 numa campanha.

## 2. G0 e G1: prova e figuras em campo ✅ OK
- **G0, decidido:** vista 3/4, soldado de 16×24 e arte gerada por código, depois de uma prova com até 6400 soldados nos três níveis de zoom.
- **G1, feito** (`src/game/art/`):
  - figuras em camadas: 4 corpos, 7 cabeças, 3 armaduras, 8 armas, 2 escudos e 3 montarias, na cor da tropa;
  - as 9 tropas do jogador, o Comandante, batedores, mensageiros e 53 dos 55 tipos de inimigo;
  - 3 direções e uma espelhada, com as poses parado, andando, atacando e caindo;
  - zoom em degraus (25%, 50%, 100% e 200%), com 3 níveis de detalhe;
  - chefes no dobro do tamanho, corpos que ficam no chão e escala inteira da tela;
  - a barra de vida saiu de cima das unidades.
- **Medido:** o desenho de cerca de 1500 unidades caiu de 20 a 35 ms por quadro para 0 a 12 ms. O gargalo agora é a simulação, de 25 a 60 ms.
- **O que ficou para depois:** o cavalo de frente e de costas (a pose mais fraca) e as poses de duelo, que entram com o Marco 21. Detalhes em [ARTE.md](ARTE.md).

## 3. G3: construções ✅ OK
- **Povoados** (`src/game/art/buildings.ts`, `src/game/world/TownArt.ts`): casas, Casa do Conselho, castelo, templo, muralhas, paliçadas, portões, mercado, poço, pátios da guarnição, ruínas e a Cidade Alta vista de fora, nas 4 culturas:
  - **Reinos:** enxaimel e telhado de duas águas.
  - **Areias:** adobe, terraço e cúpula.
  - **Ilhas:** madeira escura e telhado íngreme.
  - **Jade:** telhado curvo, pagode e portas vermelhas.
- **Acampamento do bando:** paliçada de troncos, torres, pavilhão do Comandante, intendência, alistamento, estábulo, ferraria, campo de treino e uma tenda por batalhão.
- **Ermos** (`src/game/art/wilds.ts`, `src/game/world/wildLayout.ts`): os 4 tipos de local de contrato e os covis do necromante e da horda orc.
- **Cercos:** portão com folhas de madeira e ferro na cor da cultura, e tábuas no chão quando o aríete o derruba.
- **Profundidade:** quem passa ao norte de uma casa some atrás do telhado, e quem passa pelo portão some debaixo do arco.
- **Como fica leve:** as peças de um povoado são montadas em folhas de textura aos poucos (5 ms por quadro) quando ele chega perto da câmera, e jogadas fora longe dele.
- **O que ficou para depois:** as peças das construções novas (Marco 22) e o fogo da fogueira e da forja (G6).

---

## 4. Rações refeitas: mochilas e comboio
**Objetivo:** a carroça de ração colada em toda marcha não ficou boa. Agora cada batalhão leva a própria comida, e as carroças viram um recurso para quando ela aperta: ficam no acampamento e saem num comboio, com escolta ou sem.

- **A mochila:**
  - cada batalhão leva 5 dias da própria comida (1 ração por dia para cada 3 soldados);
  - ela sai cheia do acampamento, desde que o depósito tenha comida além dos 3 dias de reserva de quem fica;
  - quem fica no acampamento tem a mochila reabastecida pelo depósito, também sem mexer nessa reserva;
  - comprar comida num povoado e forragear enchem as mochilas primeiro;
  - o Comandante leva uma bolsa de 8 rações (era uma carga de 20).
- **Quem come o quê:**
  - **No acampamento,** todo mundo come do depósito, como antes.
  - **Em campo,** cada batalhão come da própria mochila. Quem esvaziou come das carroças, se elas estiverem junto. Sem nada, o batalhão passa fome, e o diário diz quais estão com fome e pede para mandar buscar comida.
  - Presos e harpias comem da bolsa do Comandante, depois das mochilas mais cheias.
- **As carroças ficam no acampamento:**
  - No Portão, a opção **"Levar as carroças com o exército"** faz o que era o normal antes: a coluna anda no passo delas e as carroças atraem saqueadores. A escolha de quanta ração carregar só aparece com ela marcada.
  - Levantar o acampamento leva tudo nas carroças, como antes.
- **O comboio:**
  - O botão **Suprimentos**, no grupo Marcha da barra de batalha, mostra quantos dias de comida o exército tem (em vermelho com 1,5 dia ou menos) e abre o painel com a mochila de cada batalhão.
  - Com o exército fora e as carroças no acampamento, **"Mandar um comboio"** leva o depósito, menos a reserva de quem ficou (até 60 por carroça).
  - O comboio anda a 80% do passo de marcha, leva no mínimo 6 horas e procura o exército onde ele estiver.
  - **A escolta:** batalhões de guarda no acampamento podem ir junto. Saem de mochila cheia e ficam com o exército quando chegam.
  - **O risco:** sem escolta, 14% de chance de salteadores por dia de estrada. Cada soldado de escolta tira 7% disso, até 90%.
    - Atacado sem escolta, o comboio perde de 30% a 60% da carga e, às vezes, uma carroça.
    - Com escolta, perde menos, mas a escolta tem cerca de 15% de baixas.
  - **Ao chegar,** o comboio enche as mochilas de quem marcha, e o resto fica nas carroças, que passam a andar com o exército.
  - **"Mandar as carroças de volta"** leva para o depósito o que sobrou nelas.
- **No mapa:** o comboio é uma coluna com carroça, com o nome "Comboio escoltado", "Comboio sem escolta" ou "Carroças voltando". Na interface, 🎒 é a comida em campo, e 🛒 só aparece com as carroças junto.
- **Saves antigos:** sem o campo novo, as carroças ficam com o exército se ele estava fora, e no acampamento se não estava.
- **Código:** as regras ficam em `src/game/sim/logistics.ts`; a cena desenha o comboio e o painel fica em `src/ui/components/SupplyPanel.tsx`.
- **Testes:**
  - 9 de regras (`tests/unit/supply.test.ts`), sobre mochila, refeição, tempo do comboio, risco e o que sobra depois de um ataque. As 212 de unidade passam;
  - no navegador, numa campanha nova: sair do acampamento (14 rações em cada mochila e as carroças paradas), um dia de marcha (as mochilas caem e o depósito fica igual), um comboio sem escolta e um com escolta chegando ao exército e as carroças mandadas de volta.
- **Ficou de fora:**
  - a emboscada só foi vista nas regras, não no navegador;
  - ainda não há suíte de batalha (`tests/battle`) para o comboio;
  - o comboio é uma conta no relógio, como as expedições: ninguém o ataca de verdade no mapa, e a emboscada é sorteada na chegada;
  - nas batalhas personalizadas as carroças continuam com o exército, como antes;
  - quando o G4 chegar, o comboio ganha carroças de verdade no lugar da coluna das expedições.

**Pronto quando:**
- sair sem carroças e ver as mochilas esvaziarem ao longo da marcha;
- com a comida acabando, mandar um comboio escoltado e vê-lo chegar no exército;
- mandar as carroças de volta e ver o depósito subir.

---

## Marco 20 — Capitães: a cadeia de comando
**Objetivo:** o bando passa do tamanho que o Comandante consegue conduzir sozinho. Um capitão comanda uma **companhia** de batalhões; abaixo dele, cada tenente comanda um batalhão. Missões só se delegam a capitães.

- **Hierarquia:** Comandante → capitães → tenentes → batalhões.
- **A decisão:** controlar tudo (lento, com um mensageiro para cada batalhão) ou confiar no capitão (rápido, mas ele decide do jeito dele).
- O marco foi dividido em duas partes: o acampamento (feito) e a batalha (próximo).

### 5. Marco 20, parte 1: capitães no acampamento
**Feito:**
- **O capitão é uma pessoa** (`src/game/data/captains.ts`, `src/store/captainSlice.ts`), como o tenente: traços, lealdade, salário e crônica, com 4 números de 1 a 5:
  - **Comando:** quantos batalhões ele conduz (2 a 4) e quanto a moral deles aguenta perto dele.
  - **Tática:** como ele luta sozinho e quanto ajuda nas missões.
  - **Duelo:** a mão dele no um contra um (Marco 21).
  - **Ambição:** quanto ele quer mais.
- **De onde vêm, por enquanto:**
  - no posto de recrutamento há 2 candidatos, um nobre sem terra e um mercenário da taverna, renovados a cada contrato cumprido;
  - um tenente pode ser promovido quando o batalhão dele chega ao nível 3 ou ele tem 15 abates. Ele guarda a história e passa a ganhar 1,8 vez o salário;
  - o bando tem no máximo 3 capitães.
- **Companhia:**
  - o primeiro batalhão é a guarda dele, e ele marcha com ela;
  - o **quadro de comando**, na tenda, tem uma coluna para o Comandante e uma para cada capitão. Arrastam-se batalhões para as companhias e tenentes para os batalhões.
- **Missões só com capitão:**
  - escolhe-se o capitão, e vai a companhia dele que estiver no acampamento e sem treino;
  - cada ponto de Tática acima de 3 soma 5% na chance e tira 8% das baixas (e abaixo de 3, o contrário);
  - a coluna leva o estandarte dourado dele no mapa;
  - o relatório no diário vem assinado por ele, com as decisões que tomou conforme o temperamento.
- **Lealdade:**
  - salário atrasado custa 12 (24 no ganancioso);
  - Ambição 4 ou 5 com companhia de 3 ou mais custa 3 por semana, porque ele quer a própria bandeira;
  - vitória dá 3, missão cumprida dá 4 e missão falhada tira 3;
  - com lealdade 15 ou menos ele deserta e leva a companhia que estiver no acampamento, mas nunca o último batalhão do bando.
- **Legado (Marco 18):** os capitães entram no testamento e podem herdar o estandarte.
- **Na batalha, o começo:** o capitão anda com a guarda dele, com 3,5 vezes a vida e 1,8 vez o dano de um soldado, anel dourado nos pés e ⚑ no nome do batalhão. A morte e os abates dele vão para o relatório e a crônica.

**Ficou para depois:**
- inimigo capturado que muda de lado e vira capitão: vem com o Marco 21, que captura heróis;
- o estandarte do capitão à frente da coluna no mapa;
- a companhia acampando junta em volta da tenda do capitão: vem com o Marco 22;
- testes de unidade só dos capitães (lealdade, deserção, promoção).

### 6. Marco 20, parte 2: capitães na batalha
**O que falta fazer, em ordem:**
1. **Companhias na cena** (`src/game/systems/Companies.ts`, novo):
   - **aura:** batalhão a até 420 px do capitão perde 6% menos moral por ponto de Comando (a regra já está em `MoraleSystem`; falta quem a ligue a cada quadro);
   - **capitão morto:** cada batalhão da companhia perde 25 de moral, e o tenente mais antigo assume, pior.
2. **Um mensageiro por companhia:** ordens para vários batalhões da mesma companhia vão num só mensageiro até o capitão, que as passa na hora para quem está a até 650 px dele. É a vantagem de delegar.
3. **Ordens largas:** cada companhia tem uma postura, escolhida num chip da interface de batalha:
   - **livre:** obedece a última ordem;
   - **segurar:** defende um ponto, num raio de 380 px;
   - **perseguir:** vai atrás de quem fugir, até 900 px.
4. **O capitão pensa sozinho** quando o mensageiro não chega ou a postura manda:
   - usa os mesmos 8 planos da IA inimiga (Marco 16), vendo só o que a companhia vê (`src/game/sim/companies.ts` já monta essa visão);
   - pensa a cada 0,9 s, e o temperamento diz até onde ele procura briga: o agressivo a 750 px, o firme a 480 e o paciente a 300;
   - com Tática 3 ou mais, a companhia anda com a cavalaria nos flancos.
5. **Do outro lado:** os exércitos dos reinos ganham capitães com nome e nível, e não só o chefe da força. Dá para capturar e pedir resgate. É o que o Marco 21 precisa para duelar.
6. **Testes:**
   - atualizar `tests/battle/missions.mjs`: o seletor de missão agora pede um capitão, e o botão virou "Enviar a companhia";
   - em batalha de verdade: a ordem para uma companhia sai com um mensageiro só; o capitão age sozinho fora do alcance; a morte dele abala a companhia.

**Pronto quando:**
- uma companhia sai para um contrato só com o capitão, aparece no mapa e volta com um relatório (feito na parte 1);
- em batalha, as ordens por companhia funcionam, e o capitão age sozinho quando o mensageiro não chega.

---

## 7. G2: o resto do chão
**Objetivo:** chão em pixel art na mesma densidade das figuras, sem desenhar mapa à mão (o continente é gerado).

**Feito, o filtro de perto** (`src/game/art/ground.ts`):
- no zoom de 100% e 200%, o chão é repintado em pedaços de 400×400 px;
- cada ponto vira um material pela cor (grama, terra, areia, rocha, neve, água), com manchas, desenho miúdo e flores que seguem a estação;
- cerca de 12 ms por pedaço, com no máximo 6 ms por quadro; a tela de 1080p enche em menos de 30 quadros.

**Falta, em ordem:**
1. Árvores, moitas e pedras como sprites, com profundidade (o soldado passa atrás da árvore), no lugar dos círculos das florestas.
2. Margem de rio e costa desenhadas, e água que se mexe.
3. Vaus, pontes, poças, curvas de nível das colinas e picos.
4. O chão de longe (25% e 50%) com o mesmo ar, sem custar mais.
5. Medir no mapa inteiro, no acampamento e nos cercos.

**Pronto quando:** de perto, nenhum pedaço do campo de batalha é mais greybox, e a floresta esconde quem está dentro dela.

## 8. Arrumação: dividir a `WorldScene`
**Objetivo:** `WorldScene.ts` passa de 6000 linhas, e os Marcos 21 e 22 vão mexer muito nela.
- Separar em módulos pelo que já existe: comboio e expedições, carroças, cercos, mar, acampamento e a interface de batalha (HUD).
- Nenhuma regra muda. As suítes de batalha (`npm run test:battle`) têm de passar iguais antes e depois.

**Pronto quando:** nenhum arquivo da cena passa de 2000 linhas, e as suítes passam.

## 9. Marco 21: duelos no meio da batalha
**Objetivo:** quando um herói inimigo de nível alto chega ao Comandante, a batalha em volta para e os dois lutam sozinhos, como nos duelos de *Total War: Three Kingdoms*. A diferença: **ninguém aceita nem recusa, o Comandante é puxado**. É uma luta de ação no chão, com esquiva e bloqueio, curta e perigosa, sem nada de fantasia.

- **Quem puxa para o duelo:**
  - capitães e chefes inimigos de nível alto (Duelo 3 ou mais);
  - temperamento que procura briga (bravo, orgulhoso, cruel);
  - chefes de calamidade que lutam de perto.
- **Quando acontece:** o herói chega a uns 60 px do Comandante, os dois de pé e fora de fuga.
  - No máximo um duelo por herói em cada batalha, com intervalo entre um duelo e outro.
  - O herói inimigo também pode puxar um capitão nosso. Esse duelo é resolvido pelos números, com o anel no campo e o resultado no diário.
- **Dá para fugir dele, não do duelo:**
  - O herói que procura o Comandante aparece no campo antes de chegar: estandarte próprio e um aviso quando os batedores o veem. Isso cumpre a regra "o estado aparece no mapa antes da interface".
  - **A decisão:** levar o Comandante para a frente (a aura de liderança ajuda a linha, mas há risco de duelo) ou mantê-lo atrás, protegido, onde a linha sente a falta dele.
- **O anel:**
  - Os soldados perto dos dois recuam até a borda de um círculo de uns 90 px e param de lutar. Ficam olhando.
  - Flechas não entram no anel.
  - Fora do anel a batalha continua em câmera lenta (metade da velocidade), com os capitães agindo sozinhos (parte 2 do Marco 20). Duelar tem o custo de não comandar.
  - A câmera vai para 200% em cima dos dois.
- **Controles:** como na Liça (Marco 15), mas mais fundo.
  - **Golpe leve:** rápido, pouco dano.
  - **Golpe pesado:** lento, avisa mais cedo e quebra a guarda.
  - **Bloqueio:** segurar; cada golpe aparado gasta fôlego.
  - **Aparar:** bloquear no instante certo. O atacante fica atordoado e abre um contra-ataque.
  - **Esquiva:** passo curto para trás ou para o lado. Tem um instante de folga e gasta fôlego.
  - **Empurrão:** quebra a defesa de quem só bloqueia.
- **Postura:** a barra de equilíbrio, além da vida e do fôlego. Cada golpe bloqueado enche a postura; postura quebrada dá um golpe garantido. Quem só se defende acaba perdendo.
- **Pé no chão:**
  - três ou quatro golpes limpos decidem;
  - a armadura segura parte deles;
  - a arma muda o ritmo: lança alcança mais, machado quebra escudo, espada é rápida, escudo bloqueia melhor mas esquiva pior;
  - cansaço e ferimentos de antes da batalha contam.
- **O herói inimigo luta pelo temperamento:**
  - o agressivo emenda golpes;
  - o paciente espera o erro;
  - o traiçoeiro finge o golpe pesado.
  - O nível dá ritmo e precisão. Todo golpe avisa antes, como na Liça.
- **Como acaba:**
  - **Quem cai:** pode render-se (capturado: resgate ou recrutado como capitão depois), ser ferido (sai da batalha, com cicatriz) ou, mais raro, morrer (já estava ferido, ou o vencedor é cruel).
  - **O Comandante derrotado:** a guarda o arrasta para fora do campo e o exército sente o golpe. A morte do Comandante segue a regra do herdeiro (Marco 18).
  - **Duelo longo demais (90 s):** os dois são separados pelos seus homens, exaustos.
- **Efeito na batalha:**
  - O lado vencedor ganha moral. O lado do herói vencido sente o abalo, como a morte de um chefe, mais forte em quem estava no anel.
  - Ganhar dá Fama. Matar um herói rendido custa Honra.
- **Arte (parte do marco):** as figuras do G1 ganham as poses de golpe leve, golpe pesado, bloqueio, esquiva e atordoado.
- **Técnico:**
  - as regras do duelo saem da `DuelScene` para um módulo puro (`sim/duel.ts`), que a Liça e o campo usam;
  - o duelo em campo é um modo da cena do mundo, e não outra cena, porque a batalha precisa continuar.
- **Testes:** regras do duelo em unidade. Em batalha de verdade:
  - o herói puxa o Comandante;
  - ninguém entra no anel;
  - a moral reage;
  - a batalha não trava.

**Pronto quando:**
- um capitão inimigo de nível alto que chega ao Comandante abre o duelo sem perguntar, e os soldados abrem o anel e param;
- lendo os avisos, esquivando e aparando, dá para vencer um herói melhor;
- perder custa caro, mas não acaba a campanha.

## 10. G4: resto do elenco
**Objetivo:** o que ainda é greybox no campo e no mapa vira pixel art, com as figuras do G1 como base.
- **Carroças, aríetes e escadas.** As carroças primeiro: o comboio (etapa 4) e as obras do Marco 22 dependem delas.
- **A coluna das expedições e do comboio,** com o estandarte do capitão à frente (Marco 20).
- **Harpias, navios e convés.**
- **Gente do mapa e do acampamento:** viajantes, caravanas, seguidores e quem trabalha nos postos. O Marco 22 põe essa gente para construir.
- **Interiores e a Cidade Alta.**
- **Acabamento do G1:** os 2 tipos de inimigo que faltam e o cavalo de frente e de costas.

**Pronto quando:** numa marcha com comboio, num cerco e numa viagem por mar, nada em campo é mais círculo nem retângulo.

## 11. Marco 22: acampamento construído pelo bando (e construir nas vilas)
**Objetivo:** o acampamento deixa de ser um layout fixo e passa a ser construído pelo jogador, peça por peça, como em *Cult of the Lamb*. As mesmas regras valem nas vilas que o bando funda.

- **O começo:** só a tenda do Comandante, a fogueira e uma paliçada pequena. O resto o jogador põe onde quiser, dentro da paliçada.
  - Encaixe numa grade de 20 px.
  - Só o terreno firme serve: nada na água nem na rocha.
  - A peça fantasma fica verde ou vermelha, com o custo ao lado.
- **Construções do acampamento**, simples e de campanha:
  - **as de hoje:** intendência, posto de recrutamento, campo de treino, estábulo, ferraria, alojamentos (1 por batalhão), torres, paliçada reforçada e fosso;
  - **novas:**
    - cozinha (as rações rendem mais);
    - enfermaria (feridos voltam mais cedo);
    - depósito (mais carga e mais reserva para os comboios);
    - taverna de campanha (moral e boatos);
    - tenda do capitão (a companhia acampa junta);
    - capela ou altar (Marco 23);
    - curral;
    - horta;
    - poço;
    - latrina (menos doença);
    - estandarte e tochas.
  - **A paliçada cresce em degraus:** pequena, média e grande. Paliçada maior cabe mais coisas, mas custa mais e é mais difícil de guarnecer.
- **Custo:** ouro e os bens do Marco 14 (madeira, tecido, ferro).
  - Quem constrói são os seguidores (Marco 12) e os soldados de folga, em dias.
  - Soldado trabalhando não treina nem descansa. Essa é a decisão.
  - Os seguidores podem ficar fixos num posto: cozinheiro, ferreiro, curandeiro, como os seguidores de *Cult of the Lamb*.
- **Levantar e montar (Marco 13):**
  - Ao levantar o acampamento, as construções vão para as carroças. Cada uma ocupa carga: a ferraria pesa e a tenda não.
  - A planta fica guardada. Ao montar em outro lugar, o jogo repõe as peças na mesma disposição, contornando a água e a rocha.
  - O que não coube nas carroças fica para trás e precisa ser refeito.
- **Nas vilas fundadas pelo bando (Marco 9):**
  - As construções da Sala de Administração (fazendas, mina, mercado, muralhas, quartel, serraria, moinho, porto…) ganham lugar no mapa: o jogador escolhe o terreno dentro da planta da vila.
  - As casas crescem sozinhas em volta, conforme a população.
  - A muralha começa como paliçada e vira pedra.
  - Os reinos constroem nas cidades deles pelas mesmas regras.
- **Arte (parte do marco):** as peças do G3 (casas, tendas, cercas, ferraria, poço, torres) já servem. Cada construção nova precisa da sua peça.

**Pronto quando:**
- uma campanha nova começa com o acampamento quase vazio, e nos primeiros dias o jogador escolhe o que construir primeiro (enfermaria ou ferraria?);
- levantar e montar o acampamento em outro lugar mantém o que coube nas carroças;
- dá para pôr construções numa vila fundada pelo bando.

## 12. G5: interface
**Objetivo:** a interface em React ganha a mesma cara do jogo.
- **Fonte** em pixel art, também no nome e no estandarte dos batalhões (hoje greybox).
- **Molduras** dos painéis, da tenda e do diário.
- **Ícones** das tropas, dos bens, das construções do Marco 22 e dos botões de batalha.
- **Retratos** do Comandante, dos capitães, dos tenentes e dos nobres, gerados por código como as figuras, com as cicatrizes do Marco 18.

**Pronto quando:** abrir a tenda, o quadro de comando e o diário não mostra mais nenhum painel genérico.

## 13. Marco 23: cultura, religião e língua
**Objetivo:** as 4 culturas deixam de ser só nomes, tropas e arquitetura. Cada povo tem fé e língua, e isso muda como o bando recruta, negocia, conversa e mantém a moral.

- **Cultura, por povoado e não só por continente:**
  - cada povoado tem a mistura de gente dele;
  - a cultura dá as tropas típicas, o que se compra e se vende (Marco 14), a arquitetura (G3) e as festas;
  - povoado governado por outra cultura fica descontente;
  - o bando também tem mistura: a origem de cada batalhão. Tenente e capitão da mesma cultura da tropa seguram mais a moral.
- **Religião, de 3 a 5 fés no planeta,** cada uma com templo (as peças de templo do G3 por cultura), clero e calendário.
  - **Preceitos que criam decisão:**
    - não lutar no dia santo;
    - enterrar os mortos antes de marchar (os corpos do G1 no campo);
    - não tocar em magia (liga com o Marco 19: os templos reagem a ela);
    - jejum que corta rações (e esvazia as mochilas mais devagar).
  - **No bando:** soldados de fés diferentes. A capela do acampamento (Marco 22) e um capelão seguidor ajudam a moral; fés em conflito no mesmo bando geram atrito.
  - **Na política:** os templos têm voz na corte, e um reino pode declarar guerra santa.
- **Língua, uma por cultura** (o gerador de nomes já tem as 4):
  - **Conversar fora de casa:**
    - sem intérprete, ou sem um tenente ou capitão que fale a língua, os preços pioram;
    - os contratos vêm com menos detalhe;
    - os boatos da taverna chegam truncados;
    - interrogar prisioneiros rende menos.
  - **O Comandante aprende** com o tempo passado numa região. Até lá, as falas dos estrangeiros aparecem com palavras da língua deles, geradas pelo mesmo gerador de nomes.
  - **Tropa recrutada fora** fala a língua dela. A ordem chega pelo tenente, que precisa falar as duas.
- **Mundos de outros continentes (Marco 17):** cruzar o mar muda tudo isso de uma vez. É a sensação de chegar a outra terra.

**Pronto quando:**
- chegar a outro continente muda como o bando conversa, negocia e recruta;
- um dia santo ou um preceito obriga o jogador a decidir;
- a mistura de culturas e de fés do bando pesa na moral.

## 14. G6: atmosfera
**Objetivo:** o clima e a hora do dia ficam visíveis no próprio desenho, e não só num filtro de cor.
- **Noite e tochas:** luz em volta das tochas, das fogueiras e da forja (a chama que ficou do G3).
- **Clima:** chuva, neve, nevoeiro e vento, com o chão molhado e as poças do G2.
- **Efeitos de combate:** flechas, golpes, poeira da investida e sangue.
- **Já pensando na magia:** nevoeiro, tocha apagada, rio congelado e fogo são efeitos que o Marco 19 liga e desliga.

**Pronto quando:** uma batalha à noite, na chuva, se lê pela luz das tochas, e dá para ver de longe onde a investida bateu.

## 15. Marco 19: magia do Comandante
**Objetivo:** magia rara e poderosa, mas cara. GDD 3 e 8.14. Era o Marco 8, deixado por último.
- **Dano em área** e **suporte e controle**, como previsto desde o início.
- **Aprendizado pelo mundo:** grimórios e artefatos em ruínas antigas, magos da corte capturados e mestres de outro continente.
- **Custo:** recurso arcano, reação política (cortes e templos: −Honra, +Temor) e marcas no corpo do Comandante.
- **Magias que mexem nos sistemas:** congelar um rio, chamar nevoeiro, apagar tochas, curar feridos, quebrar a moral de um exército. Os efeitos visuais vêm do G6.
- **Calamidades mágicas** com fraquezas e respostas mágicas.

**Pronto quando:** uma magia bem usada vira uma batalha difícil, mas usá-la tem um preço político e pessoal.

## 16. Fechamento: jogar uma campanha inteira
**Objetivo:** fechar a fase jogando, e não só simulando.
- Uma campanha do começo ao fim, anotando o que quebra e o que cansa.
- Ajustar o equilíbrio dos Marcos 14 a 23, da progressão e das rações.
- Testar saves antigos com tudo o que mudou nesta fase.

**Pronto quando:** uma campanha vai do primeiro contrato ao herdeiro sem um erro que obrigue a recomeçar.

---

## Pendências das Fases 1 e 2
Levantamento feito depois do Marco 18 e atualizado nesta fase. Vale o que está aqui, e não as listas "Ficou de fora" de cada marco: várias delas já foram resolvidas por marcos seguintes.

As notas de mecânica vêm das regras e dos números do código e de batalhas simuladas. **Ninguém jogou uma campanha inteira.** Elas dizem onde há decisão de verdade, não onde o jogo é divertido.

### Combinado e não feito
- **Batalhões grandes:** 60 a 100 na milícia, poucos na elite. Com as figuras do G1 o desenho deixou de ser o limite; o que pesa agora é a simulação (combate, moral e empurra-empurra), de 25 a 60 ms por quadro com cerca de 1500 unidades. Espera o seu sinal; o melhor lugar na fila é depois da etapa 6.
- **Alcance dos arcos:** subir de 230 para perto de 480. Hoje a infantaria correndo atravessa o alcance em menos de 3 s. Anda junto com os batalhões grandes.
- **Magia do Comandante:** etapa 15.

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
| Expedições e comboio | A coluna é só desenho: ninguém a ataca no mapa, e a luta é um cálculo |

### Dívida
- **Equilíbrio:** nada foi ajustado jogando. Os Marcos 14 a 18, a nova progressão e as rações foram calibrados só por simulação.
- **Saves antigos:** não foram testados com os Marcos 16, 17 e 18, com a nova progressão nem com as mochilas e os capitães.
- **Testes de confronto:** usam 6 lutas por caso, pouco para um resultado aleatório. Passam ou falham por sorte perto do limite ("cavaleiros vencem mais lanceiros montados" ficou em 2 a 4 de 6). Precisam de mais amostras ou de limites mais largos.
- **Assalto sem fim:** em 2 de 16 assaltos à Paliçada com jogador simulado, a batalha passou de 10 minutos com poucos sobreviventes dos dois lados. Não voltou a acontecer nas repetições, e a causa não foi encontrada. Numa partida, o menu de pausa permite sair.
- **Defesa que demora a acabar:** defendendo o forte, os 2 ou 3 últimos arqueiros às vezes ficam parados na muralha e os orcs, já dentro, levam minutos para chegar neles. Em 5 repetições a batalha acabou entre 113 e 230 s; na suíte completa, 2 vezes não acabou nos 276 s do teste. Não vem das figuras: a mesma demora aparece sem elas.
- **Muralha que não ajuda:** com 8 lutas de cada lado, defender o forte com o robô de teste rendeu menos que lutar em campo aberto (167 com a regra antiga da torre do portão, 135 com a nova, contra 182). Não foi o G3 que criou o problema. Vale rever a IA dos defensores e medir com mais lutas.
- **`WorldScene.ts`:** passa de 6000 linhas. Virou a etapa 8.

### Avaliação das mecânicas
| Mecânica | Nota | Por quê |
| --- | --- | --- |
| Combate tático | **Fundo** | Flanco, moral, investida, flechas em área, fogo amigo e fileiras geram decisões reais. O limite é o tamanho: fileiras e flancos mal aparecem com 8 soldados |
| IA inimiga | **Fundo** | 8 planos, personalidade, uso das tropas e dos muros |
| Moral | **Fundo** | Baixas, flanco, pânico contagioso e estandarte |
| Logística | **Bom, refeita** | Cada batalhão leva a própria comida; as carroças ficam no acampamento e saem num comboio com risco e escolta. Disputa com fadiga, doença e estações. Falta jogar |
| Cerco de campanha | **Bom** | Fome ou assalto, madeira, portão fraco e socorro |
| Comércio | **Bom no modelo** | Oferta, procura e rotas existem; o Marco 14 anotou que a fome está rara e o nível de vida, alto |
| Progressão de batalhões | **Bom no papel** | Escolha exclusiva, habilidades que mudam o jeito de lutar e promoção. Falta jogar |
| Legado | **Promissor** | Testamento, traços e cicatrizes criam decisão, mas falta tempo de jogo para saber |
| Contratos | **Médio** | 10 tipos, mas cada um é um serviço solto. Quase nada encadeia um contrato no outro |
| Tenentes | **Médio** | Têm história, mas a passiva é sorteada e não muda. Agora podem virar capitães |
| Expedições | **Médio** | Agora vão com um capitão: a Tática, o temperamento e a lealdade dele pesam, e ele escreve o relatório. A luta ainda é um cálculo |
| Corte e nobreza | **Amplo, sem prova** | 6 tipos de favor, tramas e duelos. É o sistema mais longe do que o jogador faz no dia a dia |
| Reino | **Raso** | 11 construções são uma lista de efeitos. Rei com 4 povoados é cedo, e governar é abrir um menu |
| Mar | **Raso** | Primeira versão: uma viagem são segundos assistindo, com 3 eventos, e navio é só capacidade |
| **Comandante em si** | **Raso, o pior caso agora** | Anda, bate e grita. Não evolui. Os duelos (etapa 9) e a magia (etapa 15) são o que está planejado para ele |

### O que eu faria, em ordem de retorno
1. ~~**Progressão:** escolha exclusiva, habilidades que mudam comportamento e promoção de tropa.~~ ✅ Feito nesta fase.
2. **Jogar uma campanha inteira** e corrigir o que aparecer: nenhum teste substitui isso (etapa 16, mas vale antes, aos poucos).
3. **Comandante:** habilidades ativas ligadas aos traços, antes mesmo da magia.
4. **Contratos em cadeia:** o que você fez para um cliente abre ou fecha o próximo.
5. **Reino com decisão:** eventos de governo, com escolha e custo, em vez de só construções.
