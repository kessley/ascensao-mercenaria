# Roadmap — Fase 3: O arcano

Objetivo da fase: trocar o greybox por pixel art e, junto, dar ao bando o que faltava: capitães, duelos em campo, um acampamento construído pelo jogador (que vira fortaleza e, em volta dela, cidade), cultura, religião e língua e, por último, a magia do Comandante. As pendências das Fases 1 e 2 e a avaliação das mecânicas ficam no fim deste arquivo.

**Onde estamos (9 de novembro de 2026):**
- **Feito:**
  - a progressão dos batalhões;
  - a pixel art das figuras (G0 e G1), do chão (G2) e das construções (G3);
  - as rações refeitas (mochilas e comboio);
  - os capitães (Marco 20 ✅ OK, no acampamento e na batalha);
  - a `WorldScene` dividida em partes (etapa 8);
  - os duelos no meio da batalha (Marco 21 ✅ OK: as regras, os heróis do outro lado e o duelo no campo);
  - uma rodada de desempenho, fora da fila: a simulação da batalha ficou 4 vezes mais leve, e 1600 soldados de perto cabem em 60 fps ([ROADMAP.md](ROADMAP.md#desempenho-batalhas-quatro-vezes-mais-leves--ok)).
  - fora da fila, pedido em 4 de novembro: entrar em casas e prédios só com E ou com um clique. Andar de encontro à porta entrava sem querer;
  - os locais de missão sempre habitados (etapa 10 ✅ OK);
  - o G4 inteiro (etapa 11 ✅ OK): carroças, aríetes e escadas; a coluna das expedições e do comboio; harpias, navios e convés; a gente do mapa e do acampamento; os interiores, a Cidade Alta e a Liça; e o cavalo de frente e de costas.
  - o Marco 22 inteiro (etapa 12 ✅ OK): o bivaque e a grade, a vida no acampamento, a fortaleza e a cidade que nasce sozinha em volta dela.
  - o G5 inteiro (etapa 13 ✅ OK): a fonte de pixel, as molduras e os botões, os ícones e os retratos.
  - o Marco 23 inteiro (etapa 14 ✅ OK):
    - a gente de cada lugar;
    - as fés, com os preceitos que obrigam a decidir;
    - as línguas, com o intérprete;
    - a chegada a outra terra, que avisa o que muda.
  - o G6 inteiro (etapa 15 ✅ OK): a noite e o fogo, o clima, os efeitos de combate e o que a magia mexe.
- **Combinado em 4 de novembro, depois de um brainstorm:**
  - o Marco 22 foi refeito (etapa 12 e [GDD, seção 9](GDD.md#9-do-bivaque-à-cidade-o-bando-que-constrói-fase-3-marco-22)): do bivaque ao acampamento, à fortaleza e a uma cidade que nasce sozinha;
  - os locais de missão passam a ter moradores fixos (etapa 10, já feita).
- **Em andamento:** o Marco 19 (etapa 16), a magia do Comandante. Estão feitas a parte 1 (o arcano e as primeiras magias) e a 2 (as magias que mexem no mundo).
- **A seguir:** a parte 3 do Marco 19: aprender pelo mundo.

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
| 5 | [Marco 20, parte 1: capitães no acampamento](#5-marco-20-parte-1-capitães-no-acampamento) | recurso | | ✅ OK |
| 6 | [Marco 20, parte 2: capitães na batalha](#6-marco-20-parte-2-capitães-na-batalha) | recurso | | ✅ OK; falta jogar uma campanha |
| 7 | [G2: o resto do chão](#7-g2-o-resto-do-chão--ok) | arte | Árvores, margens e pontes mudam o campo onde as companhias manobram, e o duelo põe a câmera a 200% em cima do chão | ✅ OK |
| 8 | [Arrumação: dividir a `WorldScene`](#8-arrumação-dividir-a-worldscene--ok) | dívida | Os Marcos 21 e 22 mexem muito nela | ✅ OK |
| 9 | [Marco 21: duelos no meio da batalha](#9-marco-21-duelos-no-meio-da-batalha--ok) | recurso e arte | Traz as poses de golpe das figuras | ✅ OK |
| 10 | [Locais de missão sempre habitados](#10-locais-de-missão-sempre-habitados--ok) | recurso | Pedido jogando: sem contrato, o acampamento goblin estava vazio. É pequeno e entra antes de o G4 continuar | ✅ OK |
| 11 | [G4: resto do elenco](#11-g4-resto-do-elenco--ok) | arte | Carroças de verdade para o comboio e para as obras; gente no acampamento para quem vai construir | ✅ OK |
| 12 | [Marco 22: do bivaque à cidade](#12-marco-22-do-bivaque-à-cidade--ok) | recurso | Usa as peças do G3 e as carroças e a gente do G4. Refeito em 4 de novembro, em quatro partes | ✅ OK; falta jogar uma campanha |
| 13 | [G5: interface](#13-g5-interface--ok) | arte | Retratos de capitães e tenentes e ícones das construções; o Marco 23 enche a interface de fé e língua | ✅ OK |
| 14 | [Marco 23: cultura, religião e língua](#14-marco-23-cultura-religião-e-língua--ok) | recurso | | ✅ OK; falta jogar uma campanha |
| 15 | [G6: atmosfera](#15-g6-atmosfera--ok) | arte | Nevoeiro, tochas, gelo e fogo são o que a magia mexe | ✅ OK |
| 16 | [Marco 19: magia do Comandante](#16-marco-19-magia-do-comandante) | recurso | Por último, como combinado | partes 1 e 2 de 4 |
| 17 | [Fechamento: jogar uma campanha inteira](#17-fechamento-jogar-uma-campanha-inteira) | dívida | Equilíbrio, saves antigos e o que aparecer | |

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
  - as 9 tropas do jogador, o Comandante, batedores, mensageiros e 53 dos 55 tipos de inimigo (os outros 2, a carroça de mercador e o aríete, vieram no G4);
  - 3 direções e uma espelhada, com as poses parado, andando, atacando e caindo;
  - zoom em degraus (25%, 50%, 100% e 200%), com 3 níveis de detalhe;
  - chefes no dobro do tamanho, corpos que ficam no chão e escala inteira da tela;
  - a barra de vida saiu de cima das unidades.
- **Medido:** o desenho de cerca de 1500 unidades caiu de 20 a 35 ms por quadro para 0 a 12 ms. O gargalo agora é a simulação, de 25 a 60 ms.
- **O que ficou para depois:** o cavalo de frente e de costas, a pose mais fraca. Ele foi refeito no G4, parte 6, e as poses de duelo entraram com o Marco 21. Detalhes em [ARTE.md](ARTE.md).

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

## Marco 20 — Capitães: a cadeia de comando ✅ OK
**Objetivo:** o bando passa do tamanho que o Comandante consegue conduzir sozinho. Um capitão comanda uma **companhia** de batalhões; abaixo dele, cada tenente comanda um batalhão. Missões só se delegam a capitães.

- **Hierarquia:** Comandante → capitães → tenentes → batalhões.
- **A decisão:** controlar tudo (lento, com um mensageiro para cada batalhão) ou confiar no capitão (rápido, mas ele decide do jeito dele).
- O marco foi dividido em duas partes: o acampamento e a batalha.

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
**Feito:**
1. **Companhias na cena** (`src/game/systems/Companies.ts`):
   - **aura:** batalhão a até 420 px do capitão perde 6% menos moral por ponto de Comando (com Comando 4, 24% menos);
   - **capitão morto:** cada batalhão da companhia perde 25 de moral. O tenente mais antigo (o primeiro da companhia com tenente de pé) assume, com 2 pontos a menos de Tática e sem a aura. Sem tenente, os batalhões voltam a esperar as ordens do Comandante.
2. **Um mensageiro por companhia:** ordens para dois ou mais batalhões da mesma companhia, a até 650 px do capitão, viram uma parada só do mensageiro, no capitão, que passa a ordem adiante na hora. Interceptado o mensageiro, a ordem se perde para todos.
3. **Ordens largas:** o grupo **Companhias** da barra de batalha tem uma caixa por companhia, com quem manda e o plano do momento.
   - **Livre:** obedece as suas ordens; longe da sua voz, o capitão decide sozinho.
   - **Segurar:** a companhia guarda o lugar onde estava quando a ordem chegou, briga num raio de 380 px e depois volta para ele.
   - **Perseguir:** vai atrás de quem estiver a até 900 px, inclusive de quem foge.
   - A postura é uma ordem: perto do Comandante vai pela voz; longe, por mensageiro até o capitão. Clicar no nome seleciona os batalhões da companhia.
4. **O capitão pensa sozinho** (a cada 0,9 s), com os mesmos planos da IA inimiga (`choosePlan`), vendo só os inimigos que o bando enxerga perto da companhia:
   - **ataque:** cada batalhão no inimigo mais perto, e a cavalaria escolhe a presa (arqueiros e carroças primeiro);
   - **linha e flanco:** quem está mais perto segura a frente, e os outros entram pelas pontas;
   - **golpe na retaguarda:** a cavalaria (ou o segundo corpo a corpo) vai nos arqueiros;
   - **resistir:** todos seguram o lugar;
   - **retirada:** a companhia volta para junto do Comandante (segurando, volta ao ponto que guarda).
   - O temperamento diz até onde ele procura briga quando livre: o agressivo a 750 px, o firme a 480 e o paciente a 300.
   - **Quem manda é o jogador:** livre, o capitão só decide fora do alcance da voz e só com quem está parado ou seguindo. Uma ordem direta a um batalhão da companhia vale 15 s antes de o capitão voltar a mexer nele.
5. **Testes:**
   - 13 de regras (`tests/unit/captains.test.ts`): tamanho da companhia, temperamento, promoção, lealdade, deserção e a tradução dos planos em ordens;
   - a suíte de batalha `companhias` (`npm run test:battle -- companhias`), com 15 verificações: a aura, o mensageiro único, o capitão decidindo longe do Comandante e calado perto dele, a postura pela interface, a companhia voltando ao lugar e o abalo da morte dele;
   - a suíte `missoes` atualizada para o seletor de capitão (28 verificações).

**Ficou de fora:**
- capitães inimigos com nome e nível, capturar, pedir resgate e recrutar quem muda de lado: foram para o Marco 21, que precisa deles para duelar;
- a companhia marchando com a cavalaria nos flancos (`companyArrangement` existe, mas não está ligado);
- o estandarte do capitão à frente da coluna no mapa (G4);
- emboscada e recuo fingido: o capitão não usa (sem terreno marcado, e o recuo fingido vira ataque);
- capitães nas batalhas personalizadas;
- jogado só nos testes, não numa campanha.

**Pronto quando** (as duas coisas valem agora):
- uma companhia sai para um contrato só com o capitão, aparece no mapa e volta com um relatório;
- em batalha, as ordens por companhia funcionam, e o capitão age sozinho quando o mensageiro não chega.

---

## 7. G2: o resto do chão ✅ OK
**Objetivo:** chão em pixel art na mesma densidade das figuras, sem desenhar mapa à mão (o continente é gerado).

**Feito, o filtro** (`src/game/art/ground.ts`):
- o chão é repintado em pedaços de 400×400 px de textura;
- cada ponto vira um material pela cor (grama, terra, areia, rocha, neve, água), com manchas, desenho miúdo e flores que seguem a estação;
- no máximo 6 ms por quadro, contando o chão comum que vem antes.

**Feito, as matas** (`src/game/art/trees.ts`, `src/game/world/ForestArt.ts` e `forestLayout.ts`):
- cada zona de mata vira pinheiros, carvalhos, moitas e pedras em pixel art, no lugar dos círculos;
- a profundidade sai do pé, como nas figuras e nas construções: o soldado passa atrás da árvore;
- o lugar de cada árvore sai da semente da zona: grade sacudida, mais rala na borda, com 2 ou 3 clareiras, e nunca na água, nas casas, no acampamento ou a menos de 34 px da estrada;
- o bioma muda a mistura: quase só pinheiro na tundra e na serra, quase só folha no brejo;
- a estação muda só o desenho: flor na primavera, cor no outono, galho pelado no inverno e neve no frio;
- o chão da mata não tem mais borda dura: escurece aos poucos, junto com as árvores, que rareiam;
- as peças vão para as mesmas folhas do `TownArt`, feitas só quando a câmera chega perto e reduzidas de longe;
- **medido** (navegador escondido, tempos ruidosos): 4677 árvores no mapa, em 53 matas; no trecho mais cheio, 12 matas e 1383 peças custam cerca de 0,5 ms por quadro a 100% e 0,8 ms a 25%; cada mata ocupa uma folha de cerca de 2048×200 px (1,6 MB);
- 7 testes de regras (`tests/unit/forest.test.ts`).

**Feito, a água** (`ground.ts` e `src/game/world/WaterGlints.ts`):
- **margem desenhada**, em rio, lago e mar:
  - barranco de terra na margem de cima;
  - espuma e chão molhado nas outras;
  - na praia, areia molhada no lugar do barranco;
- **a água se mexe:** reflexos descem o rio na velocidade da correnteza (mais depressa no rio estreito), e a espuma vem e vai na beira;
- tudo num `Blitter` só, e só de perto. O brilho não cai em cima da ponte nem das pedras do vau.

**Feito, as peças nítidas** (`src/game/art/terrainArt.ts`), por cima do filtro. Cada ponto é desenhado no sentido do rio, então a peça sai nítida em qualquer ângulo:
- **pontes:** tábuas, guarda-corpo, postes e cabeceiras de pedra, e a versão queimada;
- **balsas:** cais nas duas margens, jangada e corda;
- **vaus:** água rasa recortada no rio e pedras só dentro dele, com espuma;
- **picos:** com neve maior no inverno;
- **chão das zonas:** degraus de terra nas colinas (as curvas de nível) e poças na lama e no brejo.

**Feito, o chão de longe:** os mesmos pedaços em pixel art em três níveis:
- 400 px de mundo a 100% (e 200%), 800 px a 50% e 1600 px a 25%;
- cada pedaço é uma textura de 400×400 px, então 1 px de textura é 1 px de tela em todos os degraus do zoom;
- de longe há menos flores, e a água fica parada.

**Feito, o custo:**
- **o filtro roda num worker** (`groundWorker.ts` e `GroundFilter.ts`). A linha principal só pinta o chão comum e sobe a textura. O pedaço que volta do worker espera a vez dentro do orçamento do quadro;
- **as texturas de canvas não usam mais o `addCanvas` do Phaser** (`canvasTexture.ts`). Ele lia a imagem inteira de volta da placa de vídeo e travava quadros por 40 a 70 ms. A troca vale para o chão, as construções, as matas e as figuras;
- **os picos são 48 formas guardadas** (6 desenhos em 8 tamanhos), em vez de um desenho por pico. Um pedaço de serra tem uns 200 picos;
- **medido** com o navegador escondido (tempos ruidosos), em 10 lugares (acampamento, forte, capital, cidade e 6 pontos sorteados) e nos 3 degraus do zoom:
  | O quê | Agora | Antes |
  | --- | --- | --- |
  | Pedaço em pixel art, na linha principal | uns 4 ms | uns 19 ms |
  | Pedaço do chão comum | 1,5 ms na mediana, 16 ms no pior | 8 ms na mediana, até 70 ms nas serras |
  | Salto da câmera | 6 a 12 ms | 18 a 146 ms |
  | Chão enchendo a tela | até 14 ms por quadro (um único de 22 ms em 375) | |
  | Chão parado | 0,1 ms | |
  | Matas e construções juntas, montando | até 6 ms por quadro | |
- **nos cercos** o chão é o mesmo do povoado (forte, capital e cidade foram medidos), e as suítes de batalha passam;
- **testes:** 10 de regras (`tests/unit/terrainArt.test.ts`), cobrindo os picos, as pontes, os vaus e os brilhos da água.

**Ficou de fora:**
- a água só se mexe de perto (100% e 200%);
- onda na praia: a espuma da beira vem e vai, mas não há onda que corre;
- o chão comum de baixo (o que aparece enquanto o pedaço em pixel art não fica pronto) ainda é pintado na linha principal. Com a correção do `addCanvas` e dos picos, ficou barato.

**Pronto quando** (as duas coisas valem agora):
- de perto, nenhum pedaço do campo de batalha é mais greybox;
- a floresta esconde quem está dentro dela. Na tela, a árvore cobre quem passa atrás, pela profundidade do pé; na regra, quem está na mata só é visto de perto (`FOREST_DETECT_RANGE`).

## 8. Arrumação: dividir a `WorldScene` ✅ OK
**Objetivo:** `WorldScene.ts` passava de 6000 linhas, e os Marcos 21 e 22 vão mexer muito nela.

**Feito:**
- **`WorldScene.ts` caiu de 6226 para 942 linhas.** Ficaram nela os campos, o `create`, o `update`, as estações e o clima.
- **O resto foi para 13 partes em `src/game/scenes/worldScene/`:**
  | Parte | O quê | Linhas |
  | --- | --- | --- |
  | `army.ts` | exército em campo, líder, carroças, fadiga e cortejo | 452 |
  | `camp.ts` | acampamento, cidades, caminhada, forragear, acampamento móvel e noite | 582 |
  | `sea.ts` | corsários, desembarque e o convés | 104 |
  | `scenario.ts` | batalha personalizada | 301 |
  | `combat.ts` | inimigos em campo, encontro, prisioneiros, objetivos, fim do combate, derrota e visão | 563 |
  | `siege.ts` | cerco, portões e guarnições | 364 |
  | `realm.ts` | calamidades, exércitos dos reinos, revoltas, relógio, eventos dos bandos, viagem e pontes | 724 |
  | `agents.ts` | agentes do mundo, comboio, expedições e descanso | 321 |
  | `save.ts` | salvar, carregar e o retrato do mapa | 293 |
  | `orders.ts` | raio de comando, sinais e mensageiros | 418 |
  | `input.ts` | teclado, mouse, ordens da interface, seleção e câmera | 806 |
  | `scouts.ts` | batedores e harpias | 306 |
  | `hud.ts` | HUD da batalha | 108 |
  | `shared.ts` | constantes, tipos e ajudantes que as partes dividem | 188 |
- **Como:** cada parte é um objeto de métodos com `this: WorldScene`, posto no protótipo da cena no fim de `WorldScene.ts`. Uma interface com o nome da classe diz ao TypeScript que os métodos são dela.
  - As chamadas (`this.publishHud()`) e o corpo dos métodos não mudaram: a divisão foi feita por um roteiro, com a árvore do TypeScript, copiando cada método inteiro, com os comentários.
  - Os membros da cena deixaram de ser `private`, porque as partes os usam de fora da classe.
- **Nenhuma regra mudou:** as 10 suítes de batalha passam como antes (217 de 218 verificações, o mesmo placar de antes; a que falha é um dos confrontos que oscilam por sorteio), assim como os 242 testes de regras.

**Ficou de fora:** as partes ainda usam o estado da cena inteira por `this`. Separar o estado de cada parte (o cerco guardar o próprio, por exemplo) fica para quando um marco pedir.

**Pronto quando** (vale agora): nenhum arquivo da cena passa de 2000 linhas (o maior, `WorldScene.ts`, tem 942), e as suítes passam.

## 9. Marco 21: duelos no meio da batalha ✅ OK
**Objetivo:** quando um herói inimigo de nível alto chega ao Comandante, a batalha em volta para e os dois lutam sozinhos, como nos duelos de *Total War: Three Kingdoms*. A diferença: **ninguém aceita nem recusa, o Comandante é puxado**. É uma luta de ação no chão, com esquiva e bloqueio, curta e perigosa, sem nada de fantasia.

- **Antes, os capitães do outro lado** (vieram do Marco 20): os exércitos dos reinos ganham capitães com nome, nível e Duelo, e não só o chefe da força. Dá para capturar, pedir resgate e recrutar quem muda de lado.
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

O marco foi dividido em três partes: as regras (que a Liça já usa), os heróis do outro lado e o duelo no campo.

### 9.1. Marco 21, parte 1: as regras do duelo ✅ OK
**Feito:**
- **As regras saíram da Liça** para um módulo puro, `src/game/sim/duel.ts`, e a Liça (`DuelScene`) passou a usá-lo. O duelo no campo (parte 3) usa o mesmo.
- **Golpes** (no ritmo do Comandante; todos avisam antes com o arco vermelho, e o do pesado é largo e escuro):
  - **leve:** avisa em 0,24 s e tira 30 de vida;
  - **pesado:** avisa em 0,56 s, tira 50 e enche a postura de quem bloqueia duas vezes mais;
  - **empurrão:** curto e sem dano; abre a guarda de quem só bloqueia.
- **Defesa:**
  - **bloquear:** de frente, segura quase todo o dano, mas cada golpe aparado gasta fôlego e enche a postura;
  - **aparar:** a guarda erguida até 0,18 s antes de o golpe chegar atordoa quem atacou por 0,8 s. Martelar a tecla não apara: quem solta e ergue de novo em menos de 0,35 s só bloqueia;
  - **esquiva:** um passo curto, com 0,2 s em que nada acerta; gasta fôlego.
  - **Postura cheia** (ou o fôlego zerado bloqueando): a guarda quebra, 1,3 s atordoado, e o próximo golpe entra.
- **Pé no chão:**
  - 100 de vida: 4 ou 5 golpes limpos decidem;
  - a armadura segura parte do dano;
  - ferimentos e cansaço de antes entram como vida e fôlego menores.
- **Armas:** a espada é rápida; a lança alcança mais e avisa mais devagar; o machado bate mais e quebra a guarda; espada e escudo bloqueia melhor e esquiva pior.
- **A IA luta pelo temperamento:**
  - o agressivo emenda golpes;
  - o firme alterna;
  - o paciente guarda distância, espera o erro e castiga;
  - o traiçoeiro finge o pesado, que vira leve no meio do aviso.
  - A mão (1 a 10) dá o ritmo (a mais fraca avisa 1,9 vez mais devagar que o Comandante; a melhor, 1,3), a leitura do aviso e a precisão da distância.
- **Fim:**
  - 90 s sem vencedor separam os dois;
  - quem cai se rende, sai ferido ou, raramente, morre (bem mais com vencedor cruel ou ferida de antes). A parte 3 usa isso.
- **A Liça com os controles novos:**
  - WASD anda;
  - Espaço ou clique: golpe leve;
  - Q ou botão direito: golpe pesado;
  - Shift segura a guarda (na hora certa, apara);
  - F esquiva, e E empurra.
  - A barra de postura fica embaixo da de fôlego.
- **Testes:** 23 de regras (`tests/unit/duel.test.ts`):
  - cada golpe, o bloqueio, aparar, a esquiva, o empurrão, a postura, as armas e o fim por tempo;
  - IA contra IA: a mão melhor vence quase sempre (8 contra 4, mais de 80%), mãos iguais ficam perto da metade, e os duelos acabam em 5 a 10 s;
  - alguém nas teclas que lê o aviso com 0,25 s de reação (e deixa passar 1 em 5) vence um herói de mão 10 em mais de 60% das vezes; quem quase não lê perde para um de mão 8.

**Ficou para depois:** a Liça segue em greybox (círculos), porque as poses das figuras vêm com a parte 3.

### 9.2. Marco 21, parte 2: os heróis do outro lado ✅ OK
**Feito:**
- **Ficha de herói** (`src/game/data/heroes.ts`): cada chefe e capitão das forças inimigas tem nome, Duelo (1 a 5), um traço e uma arma. A ficha vai no save junto com o comando do bando.
  - **A mão sai do tipo de bando:** goblins 1 a 2, salteadores e hordas 2 a 3, patrulhas e exércitos 3 a 4. Os capitães ficam um ponto abaixo do chefe, e orcs e cavaleiros mortos um acima. Um nobre de verdade traz a dele (o marcial dividido por 2).
  - **A arma é a do povo:** orcs e chefes salteadores no machado, sargentos e capitães dos reinos com espada e escudo, o chefe goblin na lança, e o resto na espada.
  - **O traço dá o jeito de lutar:** o bravo, o cruel e o ambicioso emendam golpes; o astuto e o invejoso fingem o pesado; o covarde e o estudioso esperam o erro; os outros são firmes.
- **Quem procura duelo** (Duelo 3 ou mais, e bravo, cruel ou ambicioso, que faz as vezes do orgulhoso):
  - leva o estandarte do desafio: uma flâmula vermelha de duas pontas, com espadas cruzadas, acima do nome;
  - na primeira vez que alguém do bando o vê, o diário avisa, por exemplo: "Avistamos Ruzbag Come-Ratos (Duelo 4, de machado, bravo): ele procura o Comandante para um duelo."
  - O Senhor da Guerra orc, chefe de calamidade que luta de perto, procura sempre (Duelo 5, machado, cruel). O Lorde Necromante, que ataca de longe, não procura.
- **Capturar e recrutar:**
  - o chefe que se rende ferido guarda a ficha, e a lista de prisioneiros mostra a mão, a arma e o traço;
  - o botão novo "Recrutar como capitão" oferece um lugar no bando. A chance de aceitar começa em 30% e sobe com a Fama (até mais 40%). O ganancioso, o ambicioso e o covarde ouvem mais (mais 20%); o honrado e o pio, menos (menos 25%);
  - quem recusa não muda de ideia, um nobre de verdade nunca aceita, e o limite de 3 capitães continua valendo;
  - quem aceita vira capitão de origem "inimigo que mudou de lado": a mão que mostrou em campo, o traço convertido, sem companhia, sem custo de contratação e com lealdade 30.
- **Batalha personalizada:** cada força ganhou o campo "Duelo do comandante" (pela competência, ou de 1 a 5).
- **Testes:**
  - 10 de regras (`tests/unit/heroes.test.ts`): a mão por tipo de bando, a arma, o temperamento, quem procura duelo, a chance de aceitar e o capitão que sai do prisioneiro;
  - conferido em batalha de verdade: a ficha, o estandarte e o aviso. Recrutar foi conferido pela loja do jogo, com um ganancioso que aceita e um honrado que recusa;
  - as suítes `ia` e `companhias` continuam passando (28 de 28).

**Ficou para depois:**
- só o chefe que cai pode virar prisioneiro, como antes; os capitães inimigos, não. Na parte 3, o herói que se rende num duelo vira prisioneiro;
- o resgate pedido não depende da mão do herói.

### 9.3. Marco 21, parte 3: o duelo no campo ✅ OK
**Feito:**
- **O herói vai atrás do Comandante:** quem procura duelo e tem o Comandante a até 600 px larga o esquadrão e vai até ele, derrubando quem estiver no caminho. Com o Comandante longe demais, ou com outro duelo no campo, volta para os seus. É assim que dá para fugir dele.
- **A 60 px, o duelo abre sem perguntar.** É um modo da cena do mundo, numa parte nova (`src/game/scenes/worldScene/duel.ts`):
  - **o anel tem 90 px.** Quem estava dentro recua até a borda. Quem está a até 150 px do centro para de lutar e fica olhando para os dois;
  - golpe e flecha de fora não tocam nos dois, e ninguém escolhe os dois como alvo;
  - **o tempo:** fora do anel, a batalha anda na metade do tempo; o duelo anda no tempo de verdade;
  - **a câmera** vai a 200% em cima dos dois. A barra de ordens dá lugar aos controles do duelo, e as notícias esperam o fim;
  - **o comando:** a voz do Comandante não chega à tropa, e os capitães decidem sozinhos (parte 2 do Marco 20).
- **As regras e os controles da Liça,** com as distâncias do campo (60% das da Liça). O herói luta com a vida da ficha (80, mais 5 por ponto de mão) e com o jeito do temperamento dele.
- **As poses novas das figuras:**
  - guarda erguida: o escudo vem para a frente do peito e a lâmina fica de pé;
  - pesado armando, esquiva e atordoado;
  - o golpe leve usa as poses de ataque que já existiam;
  - são 4 colunas novas na folha de cada figura.
- **As barras na interface:** vida, fôlego e postura dos dois, e o tempo que falta.
- **O fim:**
  - **O Comandante vence:** o herói se rende (vai para a lista de prisioneiros, com a ficha), sai ferido ou morre.
    - A moral da tropa sobe 12, e o dobro para quem estava a até 320 px do anel. A dos esquadrões do herói cai 20, também em dobro perto do anel.
    - A Fama sobe 3. Executar o herói rendido depois custa Honra, como qualquer oficial preso.
  - **O herói vence:** o Comandante cede ou cai ferido (ferido, leva mais uma cicatriz). A guarda o arrasta 260 px para trás, com 30% da vida (ferido, com 15%).
    - A moral da tropa cai, a do inimigo sobe, e a Fama cai 1.
    - Se ele morre, vale a regra do herdeiro (Marco 18).
  - **90 s sem vencedor:** os homens de cada um separam os dois.
  - **Limites:** um duelo por herói em cada batalha, e 15 s entre um duelo e outro.
- **O herói contra um capitão nosso:** quando ele encosta num capitão e não no Comandante, as duas cabeças lutam no anel, sem câmera lenta nem zoom, e o resultado vai para o diário.
  - O capitão vencido é levado para trás, ferido.
  - Se ele morre, é a morte de capitão de sempre.
- **Testes:**
  - **1 de regras novo:** nas distâncias do campo, quem lê os avisos vence um herói de Duelo 5 em mais de 60% das vezes (de 73% a 100%, conforme o temperamento), e quem não lê perde para um de Duelo 4;
  - **a suíte de batalha `duelos`** (`npm run test:battle -- duelos`, 17 verificações):
    - o herói larga os seus e puxa o Comandante, e o duelo abre a 60 px;
    - tempo pela metade e câmera a 200%;
    - um esquadrão e um batalhão mandados para dentro do anel param na borda: o mais perto ficou a 98 px do centro, e 18 a 25 soldados ficaram olhando;
    - nada de fora toca nos dois, e as barras vão para a interface;
    - no fim, o tempo e a câmera voltam;
    - a moral reage para os dois lados: com o Comandante vencendo, a nossa subiu 14 e a deles caiu 40; com o herói vencendo, a nossa caiu 33;
    - a batalha vai até o fim depois do duelo, e o duelo contra um capitão acaba no diário;
  - **as outras suítes de batalha** passam todas (218 de 218), inclusive as verificações de sorte da [Dívida](#dívida) nesta rodada.

**Pronto quando**, os três itens do marco:
- o duelo abre sem perguntar e o anel para: conferido pela suíte `duelos`;
- quem lê os avisos vence um herói melhor, na Liça e no campo: conferido pelos testes de regras;
- perder custa moral, Fama, vida e às vezes uma cicatriz, e só mata pela regra do herdeiro.

**Ficou para depois:**
- a Liça continua em greybox: as poses existem, mas a `DuelScene` ainda desenha círculos;
- o capitão nosso que perde não é preso pelo inimigo, só levado para trás;
- a figura do herói mostra a arma do tipo dele, que nem sempre é a da ficha: o chefe salteador luta de machado no duelo, mas aparece de espada.

## 10. Locais de missão sempre habitados ✅ OK
**Objetivo:** um local de missão tem gente mesmo sem contrato. Pedido em 4 de novembro, jogando: no acampamento goblin não havia nenhum goblin para matar.

**A causa:** os inimigos de um local só apareciam enquanto havia um contrato aceito para ele (`worldScene/army.ts`). Sem contrato, o local era só cenário.

**Feito** (GDD, seção 6, "Contratos"):
- **Moradores fixos** (`src/game/world/SiteResidents.ts`, com as contas puras em `src/game/sim/siteLife.ts`): cada local tem metade da força de um contrato médio, sem o chefe. Um contrato fácil traz 70% e o chefe.
  - Funcionam como as guarnições dos povoados: longe do bando, os moradores são só um número no store (`siteLife`).
  - Com alguém do bando a 2600 px, viram inimigos no mapa, dormentes até alguém chegar mais perto.
  - Com todos a mais de 3400 px e ninguém lutando, voltam a ser número sem perder ninguém.
- **Cada morador que cai baixa o número.** Os que fogem de um combate perdido também não voltam.
- **Limpo,** o local fica vazio 5 dias e depois enche 15% por dia, até ficar cheio em uns 7 dias. O diário anota.
- **Sem contrato:** o saque de quem cai e a experiência, como em todo combate, mas sem paga.
- **Com contrato:** no lugar dos moradores, vem a força do contrato (de 70% a 140% da força inteira) e o chefe.
  - Os moradores fora de vista saem; quem está à vista fica no mapa, sem dono.
  - Cumprido o contrato, o local fica limpo, como quando caem os moradores.
  - Se o contrato cair, os moradores voltam com o número que tinham.
- **Covis quietos:** os covis a até 6000 px de um local com menos da metade da gente não mandam bando goblin.
- **Saves:** os moradores não vão no save; o store guarda quantos são. Num save antigo, todos os locais começam cheios.
- **Testes:**
  - 9 de regras novos: as contas e o gerente dos moradores.
  - Uma suíte de batalha nova, `locais`, com 13 de 13, numa campanha de verdade: sem contrato o local tem moradores, sem chefe; ele fica vazio quando eles caem e volta a encher dias depois; com contrato, vem mais forte e com o chefe.
  - As suítes `missoes` (40 de 40) e `mar` (45 de 45) continuam passando.

**Ficou para depois:**
- os moradores ficam no local: não andam pela região nem saem para caçar;
- um contrato oferecido para um local que acabou de ser limpo continua aparecendo, e o local vem com a força do contrato.

**Pronto quando:**
- chegar a um acampamento goblin sem contrato acha goblins;
- limpo, ele fica vazio por uns dias e depois volta a ter gente;
- com contrato, o mesmo local vem mais forte e com o chefe.

## 11. G4: resto do elenco ✅ OK
**Objetivo:** o que ainda é greybox no campo e no mapa vira pixel art, com as figuras do G1 como base.

**Pronto quando:** numa marcha com comboio, num cerco e numa viagem por mar, nada em campo é mais círculo nem retângulo.

São seis partes, uma por vez, como no Marco 21.

### 11.1. Carroças, aríetes e escadas ✅ OK
As carroças vieram primeiro: o comboio (etapa 4) e as obras do Marco 22 dependem delas.

**Feito:**
- **Uma folha de veículo** com o jeito da folha das figuras: 3 direções e as mesmas 16 colunas, num arquivo novo (`src/game/art/vehicles.ts`). A `Unit` cuida do veículo como cuida das figuras:
  - andando, as rodas giram (um quarto de volta em quatro quadros) e os bichos dão o passo;
  - parado, o bicho baixa a cabeça de vez em quando;
  - a 50% e a 25% de zoom, entram as versões menores, como as das figuras;
  - destruído, o veículo tomba, levanta poeira e vira destroço, que fica no chão como os corpos.
- **O carro de bois do trem de suprimentos** (`Wagon`): lona em arco sobre o leito de tábuas, quatro rodas, uma junta de bois com canga e o carroceiro sentado na frente, de camisa azul do bando.
  - De frente, os dois bois puxando.
  - De costas, a boca da lona com os sacos dentro.
- **A carroça do mercador** (`Enemy`, CART): duas rodas, uma mula nos varais e, no leito, caixote, barril e saco, debaixo de um toldo listrado na cor da caravana.
- **O aríete coberto,** o nosso (`SiegeRam`) e o do inimigo (`Enemy`, SIEGE_RAM):
  - telhado de duas águas, coberto de couro remendado, sobre quatro rodas;
  - a tripulação empurra lá embaixo, na sombra, com as pernas no passo, e a cabeça de ferro sai pela frente;
  - **o golpe:** encostado no portão, a viga recua e bate a cada 1,4 s, com som e uma faísca. É só a figura: o dano continua correndo por segundo, como antes;
  - a flâmula e a tripulação vestem a cor de quem leva o aríete: azul no nosso, a cor de quem assalta no do inimigo.
- **As escadas de assalto** (`SiegeWorks`): duas em cada brecha, de madeira recém-cortada, encostadas do lado de fora. Servem na pedra e na paliçada.
  - Ao sul, sobem pela face que se vê, do chão até passar do alto.
  - Ao norte, a muralha as esconde: só as pontas aparecem, acima das ameias ou das estacas.
  - A leste e a oeste, sobem na diagonal até a beira do alto.
- **Testes:** 8 de regras novos: a folha, as rodas e o passo, o golpe só no aríete, o destroço sem sombra, a cor, e as escadas nos quatro lados. Conferido também na tela, num cerco ao forte de pedra e noutro à aldeia de paliçada.

**Ficou para depois:** o carroceiro e a tripulação do aríete são gente pequena desenhada no veículo, não figuras do G1: não lutam e não fogem sozinhos.

### 11.2. A coluna das expedições e do comboio ✅ OK
**Feito:**
- **A coluna em figuras** (`ExpeditionParty`): cada soldado é uma figura do G1 com a tropa do batalhão. Acima de 36, vão 36, na mesma proporção de cada tropa.
  - As figuras são `Unit`s de enfeite: andam, viram para onde a coluna vai e trocam de tamanho com o zoom como todo mundo, mas não lutam e ninguém as ataca. A luta da expedição continua resolvida em conta.
  - Em filas de três, um tico fora do alinhamento; com cavalo, as filas abrem mais.
- **O porta-estandarte vai na frente,** com o estandarte da tropa: dourado com capitão (Marco 20), azul sem ele, e o desenho da tropa da frente (espada, lança, arco ou cavalo).
- **O comboio:** os carros de bois da parte 1, atrás da escolta, um para cada carroça do bando (até 4). Sem escolta, vão só as carroças. A expedição que escolta uma caravana leva uma.
- **Conserto no caminho:** a cena esquecia o comboio quando recomeçava (ao voltar de uma batalha, ao carregar o jogo), e ele sumia até sair outro. Agora o comboio é desenhado de novo.
- **Testes:** a suíte `missoes` manda a companhia de um capitão para uma escolta e confere que a coluna marcha (28 de 28). Conferido também na tela.

### 11.3. Harpias, navios e convés ✅ OK
**Feito:**
- **A harpia** (`art/harpy.ts`, `Harpy`): uma águia de asas largas e cabeça clara, vista de cima em três direções. O oeste é o leste espelhado.
  - Bate as asas em 4 quadros por pouco mais de um segundo e depois plana. Vira para onde voa, com folga na diagonal, como as figuras.
  - A sombra vai no chão, 34 px abaixo da ave: é ela que mostra a altura. Ave e sombra crescem com o zoom, como as figuras.
- **Barcaças e navios de comércio** (`art/ships.ts`, `TradeRoutes`): o casco visto do alto e um pouco de lado, com o costado, o convés de tábuas e a espuma na linha d'água.
  - A barcaça leva caixotes e uma vela. O navio tem castelo de popa, gurupés, dois mastros, velas com faixa e flâmula.
  - Viram para onde vão (de frente, de lado, de costas). A espuma se mexe e o barco balança um pixel.
  - Na tempestade, parado no porto, o barco recolhe a vela e o rastro some.
- **O convés da abordagem** (`art/deck.ts`, `buildDeck`): os dois navios a 1 px por px de mundo, como o chão.
  - A proa fica em ponta, para fora. A popa é reta, com a amurada aberta onde as pranchas apoiam e um cunho de ferro de cada lado.
  - No convés: tábuas ao comprido em três tons, com emendas e pregos, escotilhas com grade, a base do mastro, cabos enrolados e a sombra da vela atravessando tudo. Embaixo, o costado e a espuma.
  - O navio deles é o nosso espelhado, em madeira mais escura e com a cinta vermelha (a nossa é azul).
  - As pranchas têm travessas e corrimão de corda. O mar é um ladrilho que corre devagar.
  - As paredes da cena não mudaram: a arte cobre as mesmas amuradas.
- **Testes:**
  - 11 de regras novos: o polígono da grade, as folhas da harpia e dos barcos, e o convés.
  - A suíte `mar` continua passando (45 de 45), com a abordagem no convés. Conferido também na tela.

**Ficou para depois:**
- o mastro do convés é só a base: em pé, ele taparia quem luta atrás;
- o mar que se mexe cobre uma área em volta dos navios; mais longe, é a cor lisa;
- a harpia some ao chegar, sem pousar no braço de ninguém.

### 11.4. Gente do mapa e do acampamento ✅ OK
**Feito:**
- **A figura de enfeite** (`entities/Extra.ts`): uma `Unit` que não luta. Ganha de graça a animação, a direção e o zoom das figuras do G1. A coluna da parte 2 passou a usar a mesma.
- **Gente nova nas figuras** (`folkLook` em `art/looks.ts`):
  - duas ferramentas: o cajado de caminhante (o do mago, sem a pedra e sem o brilho) e a enxada, que sobe e desce nos quadros do golpe;
  - o cervo, sobre o desenho do cavalo: mais claro, com galhada e rabo branco, nas três direções.
- **O mapa vivo** (`MapLife`): moradores com roupas de seis cores, camponeses de boné e enxada, viajantes de capa e cajado, peregrinos de branco, caçadores de arco e as manadas de cervos.
  - Parado na lavoura, o camponês trabalha a terra, cada um no seu tempo.
  - A flechada no cervo toca o tiro do arco. O caçador volta com o cervo nas costas, como uma capa da cor do bicho.
  - Na névoa, ninguém aparece, como antes. As caravanas já eram pixel art: são bandos de verdade, com a carroça do mercador.
- **Os seguidores do acampamento** (`CampLife`): cada um com a roupa do ofício. O cozinheiro vai de branco, o mascate de capa e cajado, a curandeira de verde, o capelão de preto, o ajudante de ferreiro com o martelo, e as famílias em quatro cores.
  - Trabalham com os quadros do golpe: o cozinheiro mexe o caldeirão, a curandeira cuida dos feridos, o ajudante martela a bigorna.
  - De noite, dormem onde estão.
  - Os lugares de trabalho viraram peças (`art/campProps.ts`): o caldeirão na trempe, com o fogo e a lenha; a banca de toldo listrado; a enfermaria com a cruz e dez esteiras; o púlpito de caixotes com o estandarte; a bigorna no toco, com o balde e o ferro; e o varal.
  - A carga de ferro nas costas de quem a leva para a Ferraria (soldados e o ajudante) é uma peça pequena.
- **Os tenentes sem comando** sentam na roda da fogueira, virados para o fogo, com o anel prateado.
- **Testes:**
  - 8 de regras novos: as folhas de toda a gente, a enxada, o cajado sem brilho, o cervo, as cores e as peças dos seguidores.
  - As suítes `missoes` (28/28) e `companhias` (15/15) continuam passando. Conferido também na tela, no acampamento e num povoado.

**Ficou para depois:**
- as crianças das famílias (o greybox desenhava uma): a figura ainda não tem um tamanho menor;
- quem trabalha nos postos do Marco 22 entra com ele. A figura de enfeite e as ferramentas já servem.

### 11.5. Interiores e a Cidade Alta ✅ OK
**Feito:**
- **Os interiores** (`art/interiors.ts`, `InteriorScene`): a sala inteira é uma imagem só.
  - O chão de cada estilo: tábuas, lajes, mármore em xadrez, ou terra com palha na tenda.
  - A parede do fundo tem janelas, tochas, vitrais ou a lona; na porta, as ombreiras e o capacho.
  - Os móveis viraram peças, cada uma com a sua altura:
    - mesa (de banquete, de mapa ou de taverna), catre, banco, balcão, baú, estante de livros e quadro de avisos;
    - barril, caixote, saco, feno, tapete e estandarte;
    - lareira com a coifa, bigorna, ferro e armeiro;
    - altar, trono, pilar e o poleiro com os falcões;
    - o canal do esgoto e as celas da masmorra (grades finas na frente, parede de pedra entre uma e outra).
  - Os cavalos do estábulo são figuras, em pelagens diferentes.
  - Toda a gente das salas é figura:
    - guardas de elmo e lança, nobres de capa (quem reina, de coroa), escrivães, mercadores e sacerdotes;
    - ladrões, trabalhadores, o ferreiro e o taverneiro;
    - o rato enorme dos esgotos.
  - Quem dorme ou está ferido deita no catre.
  - O zoom é 2 nas telas grandes, com o pixel inteiro. Só aparece o nome de quem está mais perto.
- **A Cidade Alta** (`art/cityArt.ts`, `world/capitalArt.ts`, `world/capitalPaint.ts`):
  - O chão vem em pedaços de 600 px, com 1 px de textura por px de mundo, em duas camadas.
    - A base é terra, grama, a água do fosso e a areia da Liça. Ela passa pelo filtro do chão do G2, no worker.
    - Por cima vem o calçamento:
      - pedra nas ruas, com a Avenida Real mais larga e lajes claras no Bairro Nobre;
      - lajes na Praça Real, no Grande Mercado e no pátio do castelo;
      - a ponte de tábuas;
      - a arquibancada da Liça, com o povo sentado e a barreira da justa.
  - Os prédios saem das peças do G3: casas, oficinas, barracos, tavernas com placa, a catedral, as muralhas, as torres e o Portão Velho.
  - Também há peças novas:
    - a torre de menagem: o telhado fica escondido atrás das ameias, com os torreões e a torre do meio, que leva o estandarte;
    - os paços de pedra do castelo;
    - os palácios do Bairro Nobre, com o jardim na frente;
    - o chafariz, o lampião e a lápide.
  - A TownArt monta só os grupos de peças que estão perto da câmera.
  - Os portões do Bairro Nobre e do castelo abrem e fecham na tela.
  - O Comandante, o povo, os criados, os guardas e os nobres são figuras. Disfarçado, o Comandante usa capuz e cajado. O zoom é 1.
- **A Liça dos duelos** (`DuelScene`):
  - a areia e a arquibancada cheia;
  - os dois lutadores no dobro do tamanho, com as poses do duelo em campo: armar, golpear, guarda, esquiva e tropeço;
  - o aviso do golpe continua no chão.
- Nas casas grandes, a chaminé agora tem no máximo 16 px. Antes ela parecia um poste.
- **Testes:**
  - 12 testes de regras novos. São 8 dos interiores e 4 da Cidade Alta: as peças novas, os calçamentos e se todo prédio vira peça.
  - A suíte `duelos` continua passando (17/17).
  - Conferido na tela: as salas, os bairros da Cidade Alta, os portões e o duelo. Na Cidade Alta, cada quadro leva 12 ms.

**Ficou para depois:**
- a Cidade Alta não tem zoom: fica sempre em 100%;
- os prédios muito grandes, como a estalagem e a Casa dos Mercadores, ainda têm muito telhado liso;
- o povo da arquibancada faz parte do chão: não se mexe nem torce.

### 11.6. Acabamento do G1 ✅ OK
**Feito:**
- **Os 2 tipos de inimigo que faltavam** eram a carroça de mercador e o aríete. Eles entraram na parte 1, e agora os 55 tipos têm figura.
- **O cavalo de frente e de costas** (`art/figures.ts`), que era a pose mais fraca do G1:
  - **De frente:**
    - o corpo foge para trás do cavaleiro, e a barriga sobra dos dois lados;
    - o peito é largo, e as patas de perto são mais grossas que as de trás;
    - a cara é comprida e desce até entre as patas da frente, com orelhas, topete, olhos dos lados, a lista branca na testa e o focinho escuro;
    - um traço escuro separa a cara do peito, que é do mesmo pelo;
    - o rabo escapa de um lado, lá atrás.
  - **De costas:**
    - a garupa tem duas ancas, cada uma com a luz em cima;
    - o rabo cheio desce entre elas e balança no passo;
    - as coxas são grossas e as canelas, finas.
  - **O cavalo de barda** leva a testeira de ferro no lugar da lista. A coberta na cor da tropa vai no peito, no pescoço, no lombo e na garupa.
  - **Sem ninguém em cima,** como os cavalos do estábulo: de frente, a cabeça fica no alto; de costas, o pescoço e as orelhas aparecem lá na frente.
  - O cavalo agora fica simétrico com o cavaleiro.
  - O cervo usa o mesmo desenho, com a galhada e o traseiro branco.
- **Testes:**
  - 4 testes de regras novos: o cavalo é mais largo que o cavaleiro, a lista e a testeira, a cabeça no alto sem cavaleiro, e o rabo, que balança no passo;
  - conferido na tela, numa batalha com cavalaria, cavaleiros e arqueiros montados, a 200% e a 400%.

## 12. Marco 22: do bivaque à cidade ✅ OK
**Objetivo:** o bando começa com quase nada e constrói a própria casa. A tenda vira acampamento, o acampamento vira fortaleza e, em volta da fortaleza, uma cidade nasce sozinha. O design inteiro, com o catálogo e os números, está na [GDD, seção 9](GDD.md#9-do-bivaque-à-cidade-o-bando-que-constrói-fase-3-marco-22).

**O que mudou no plano** (combinado em 4 de novembro, depois de um brainstorm):
- **Não se constrói cidade à mão,** nem nas vilas fundadas pelo bando. Uma cidade montada peça por peça não ficaria parecida com as do gerador e quebraria os cercos.
  - O jogador constrói só dentro do que é do bando: o bivaque, o acampamento e a fortaleza.
  - A cidade nasce sozinha, desenhada pelo gerador.
  - As vilas fundadas (Marco 9) continuam geridas pela Sala de Administração.
- **A área é quadrada,** com grade de 40 px, em vez da paliçada oval de hoje.
- **O começo é humilde** e sem tenente: o tenente vem com a tenda dos oficiais.
- **Sete necessidades** justificam construir: Leitos, Comida, Salubridade, Cura, Moral, Segurança e Ofício.

São quatro partes, uma por vez, como no Marco 21. Cada uma termina jogável. Se a quarta ficar grande demais, vai para a Fase 4.

**Arte:** as peças do G3 (casas, tendas, cercas, ferraria, poço, torres) e as carroças do G4 servem a muitas construções. Cada construção nova precisa da sua peça, feita junto com a parte que a usa. Os ícones das construções ficam para o G5.

### 12.1. Marco 22, parte 1: o bivaque e a grade ✅ OK
**A fazer:**
- **O começo novo** (GDD 9.9): o Comandante, 1 batalhão de infantaria, 1 batedor, 1 mensageiro, 1 carroça, cerca de 80 de ouro e 20 rações. Só a tenda, a fogueira e uma barraca, e nenhum tenente.
- **A grade quadrada** (GDD 9.2):
  - células de 40 px, com a peça fantasma verde ou vermelha e o custo ao lado;
  - mover e desmontar;
  - o portão no lado que o jogador escolher.
- **Os patamares 0 e 1:** o bivaque de 10×10 células e a paliçada em três tamanhos (16×16, 22×22 e 28×28), crescendo por igual nos quatro lados.
- **Quatro das sete necessidades no painel:** Leitos, Comida, Cura e Segurança.
- **As primeiras construções,** cerca de 16:
  - as 6 de hoje, viradas peças: intendência, posto de recrutamento, campo de treino, estábulo, ferraria e barraca (o alojamento de hoje);
  - as novas: mastro de recrutamento, tenda dos oficiais, cozinha, enfermaria, poço e estande de tiro;
  - a defesa: a paliçada nos três tamanhos, as torres e o fosso. As obras de hoje (`CAMP_WORKS`) viram peças.
- **As tropas e o tenente liberados por construção** (GDD 9.6).
- **Levantar e montar com a planta:**
  - a planta viaja nas carroças, e cada construção ocupa carga;
  - ao montar, o quadrado precisa caber: as árvores de dentro viram madeira, e água ou rocha impedem;
  - o que não coube fica para trás.
- **Balanceamento:**
  - uma simulação dos primeiros 30 dias, com as metas de ritmo da GDD 9.9;
  - a ameaça cresce com a fama, e não com o dia.
- **Saves antigos:** o acampamento de hoje vira peças na grade, com tudo o que já tinha.

**Pronto quando:**
- uma campanha nova começa com três peças, e nos dias 3 a 5 o jogador faz a primeira escolha de verdade (a 2ª barraca ou o estande de tiro?);
- o 2º batalhão chega por volta do dia 10, e a paliçada pequena entre os dias 15 e 20;
- levantar e montar em outro lugar mantém a planta e o que coube nas carroças;
- um save antigo abre com o acampamento dele.

**Feito** (8 de novembro):
- **As regras puras** estão em `src/game/data/campGrid.ts`: a grade, os patamares, o catálogo, as necessidades, a carga nas carroças, a conversão dos saves antigos e a geometria em pixels (o quadrado, o portão e a cerca). Testes em `campGrid.test.ts`, `campStore.test.ts` e `campPace.test.ts`.
- **A planta no store** (`campPlan`):
  - construir, mover, desmontar (devolve metade), melhorar, trocar o portão, crescer a paliçada e cavar o fosso;
  - os voluntários do mastro e a taverna, que aluga um batalhão por semana em cada povoado;
  - as obras antigas (`CAMP_WORKS`) saíram.
- **No acampamento,** o `CampArea` foi reescrito sobre a grade: a cerca de estacas do bivaque, a paliçada com torres no portão e uma peça para cada construção. Ainda no acampamento:
  - a peça fantasma verde ou vermelha segue o mouse, com o custo ou o motivo. Shift continua pondo, e o botão direito ou ESC cancela;
  - cada batalhão dorme na porta da sua barraca; quem sobra fica ao relento perto da fogueira.
- **Necessidades com efeito:**
  - Comida: quem passa da fogueira e da cozinha come cru, e custa mais ração;
  - Cura: só os leitos da enfermaria saram no ritmo do acampamento; o resto sara no do campo;
  - Salubridade: o poço sobe o limite de lotação;
  - Segurança: entra nos ataques ao acampamento.
  - Os Leitos só aparecem no painel por enquanto; o efeito vem na parte 2.
- **Os números:**
  - a madeira ficou mais barata do que a GDD sugeria, porque uma carroça leva só 4 de madeira: a paliçada custa 8, 16 e 24, o campo de treino 4, o estábulo 6 e a torre 4;
  - ao montar, cada célula de floresta dentro do quadrado rende 0,2 de madeira;
  - o bando goblin cresce 2 a cada 3 de fama (`goblinBandSize`), e não com o dia.
- **A simulação dos 30 dias:** o mastro sai no dia 1, a primeira escolha vem no dia 3, o 2º batalhão no dia 9 e a paliçada pequena no dia 15.
- **Falta:**
  - as estradas ainda chegam pelo oeste, mesmo com o portão em outro lado;
  - o desempenho com a planta cheia não foi medido: espera o sinal do usuário.

### 12.2. Marco 22, parte 2: a vida no acampamento ✅ OK
**A fazer:**
- **As sete necessidades completas no painel:** entram Salubridade, Moral e Ofício (GDD 9.3).
- **A falta aparece no acampamento:** soldados dormindo ao relento, fila na fogueira, doentes no chão, cavalos amarrados na paliçada.
- **Turnos dos batalhões** (descanso, treino, obra e guarda) e **gente nos postos** (os seguidores do Marco 12, ou soldados), como na GDD 9.4.
- **Obras que levam dias:** quem constrói são os seguidores e os batalhões no turno de obra. Cada construção gasta um pouco por dia.
- **O resto do catálogo do acampamento** (GDD 9.5):
  - **vida:** barracão, refeitório, forno, defumadouro, latrina, hospital, herbário e tenda do capitão;
  - **moral:** taverna, mesa de dados, estandarte, mastro de troféus, cemitério, fogueira das histórias e altar;
  - **ofício:** carpintaria (carroças, aríetes e escadas), selaria, alfaiataria (uniforme na cor do bando), lenhador, horta e curral;
  - **militar:** picadeiro, arsenal, cercado de cativos, tenda de mapas, estrepes e posto de sentinela.

**Pronto quando:**
- cada uma das sete necessidades em falta se vê no acampamento antes do painel;
- pôr um batalhão na obra em vez do treino é uma decisão que pesa;
- a carpintaria faz o aríete e as escadas de um cerco.

**Feito** (8 de novembro):
- **As regras puras** estão em `src/game/sim/campDays.ts`: turnos, postos, obras, humor, produção, manutenção e a carpintaria. O catálogo cresceu em `campGrid.ts`: são 22 construções novas e 3 níveis novos (barracão, refeitório e hospital de campanha). Os testes estão em `campDays.test.ts`.
- **Turnos** (no painel da planta e na barraca): descanso, treino, obra e guarda.
  - O treino dá 6 XP por dia com o pátio da tropa (campo de treino, estande ou picadeiro) e 2 sem ele.
  - A obra dá 4 de trabalho por dia.
  - A guarda segura 15% do saque e faz a ronda por dentro da cerca.
  - Sem guarda e sem posto de sentinela, um bando que chega ao acampamento com gente dentro pega todos de surpresa: leva metade do que levaria.
- **Gente nos postos:** cozinha, enfermaria, ferraria, forno, defumadouro, herbário, taverna, as oficinas, o lenhador e a horta só funcionam com alguém. Os seguidores do papel certo vão primeiro, depois qualquer seguidor e, por último, os soldados de um batalhão na obra (1 de trabalho por posto). O jogador pode fechar um posto.
- **Obras levam dias:** construção pequena pede 3 de trabalho, média 6 e grande 10. Trabalham o estado-maior (2 por dia), os seguidores livres (1 cada) e os batalhões na obra. Só a construção pronta faz efeito e libera tropa. Melhorar de nível ainda é na hora.
- **Manutenção:** algumas construções custam ouro por semana (torre, altar, arsenal, picadeiro, tenda de mapas e tenda do capitão), pago junto com os salários.
- **As sete necessidades:**
  - Salubridade: o poço e a latrina somam 30 cada ao limite de lotação, e a latrina corta 30% dos surtos;
  - Moral: o humor do acampamento anda para a moral das construções menos os batalhões, e cai mais com quem dorme ao relento. Antes, ele sempre voltava a 0;
  - Ofício: uma oficina a cada 3 batalhões. Para cada oficina que falta, há 30% de chance por semana de um batalhão perder um nível de equipamento.
  - Quem dorme ao relento também adoece mais. O herbário faz os doentes sararem mais depressa.
- **Na cena:**
  - quem come cru faz fila na fogueira na hora da refeição;
  - feridos sem leito ficam deitados no chão diante da barraca;
  - sem estábulo, a cavalaria segura os cavalos amarrados na paliçada;
  - os soldados da obra martelam nas obras, que aparecem com um andaime.
- **Os outros efeitos:**
  - o forno economiza 10% das rações do acampamento, e o defumadouro, 15% das gastas em campo;
  - a horta dá 3 rações por dia, e o lenhador dá madeira se houver floresta em volta;
  - os troféus e o bardo dão um pouco de fama por dia;
  - a tenda do capitão dá lealdade toda semana;
  - o cercado de cativos faz fugirem pela metade;
  - a tenda de mapas aumenta em 30% a região que os batedores exploram;
  - o picadeiro libera os arqueiros montados.
- **Carpintaria:** faz carroças, escadas e o aríete com madeira. O que ela fez vai com o exército e entra no próximo cerco.
- **Falta:**
  - Segurança e Ofício em falta só aparecem no diário e no painel, não na cena;
  - a cor do uniforme (alfaiataria) fica para o G5;
  - o equilíbrio dos números só se vê jogando uma campanha.

### 12.3. Marco 22, parte 3: a fortaleza ✅ OK
**A fazer** (GDD 9.7):
- **Fincar o estandarte,** com os requisitos de fama, soldados e construções.
- **A terra por um de três caminhos:** carta de terra de um reino (vassalagem), ruínas reerguidas (antes, limpá-las) ou terra de ninguém (temor).
- **A muralha do gerador** no contorno do quadrado de 34×34: madeira e depois pedra, com os portões e as torres dos fortes do mundo. Por dentro, a grade é livre.
- **As construções da fortaleza:** torre de menagem, quartel, salão do Comandante, masmorra, cisterna, armazém fortificado, escola de oficiais, tesouraria, oficina de cerco, feira do castelo, pombal e templo.
- **O castelão e a guarnição** ficam; o bando sai com o **acampamento de campo**, um kit de até 6 construções nas carroças.
- **O cerco da sede:** reinos e calamidades atacam a fortaleza, também com o bando longe. Usa o modo "Você defende os muros".

**Pronto quando:**
- entre os dias 60 e 90 de uma campanha dá para fincar o estandarte por qualquer um dos três caminhos;
- o bando sai em campanha com o acampamento de campo enquanto a fortaleza fica com o castelão;
- a fortaleza aguenta (ou não) um cerco sem o bando.

**Feito:**
- **As regras** ficam em `src/game/sim/fortress.ts` (puras, com 20 testes). O estado e as ações ficam em `src/store/fortressSlice.ts`.
- **Fincar o estandarte:** é o passo de 28 para 34 na planta. Pede fama 45, 5 batalhões, cozinha, tenda dos oficiais, poço e torre de vigia, e que a muralha caiba em volta, sem água, rocha nem povoado. A fortaleza não se levanta mais.
- **Os três caminhos da terra,** no painel da planta:
  - carta de terra: +120 de ouro e um reino com relação 25 a até 3200 de distância. O bando vira vassalo, e os inimigos do suserano passam a ser os dele;
  - ruínas reerguidas: um local a até 1600, com no máximo 25% dos moradores. Fica 200 de ouro e 15 de madeira mais barato, e os moradores não voltam;
  - terra de ninguém: +10 de temor, e o cerco vem mais cedo.
- **A muralha:** de madeira, e depois de pedra (450 de ouro e 12 de ferro). É desenhada com as mesmas peças dos fortes do mundo (`wallJobs`), com torres nos cantos, no meio dos lados e no portão.
- **As 12 construções da fortaleza:**
  - torre de menagem, cisterna, armazém e castelão: somam na defesa;
  - quartel: leitos;
  - salão do Comandante: fama por dia;
  - masmorra: ninguém foge;
  - escola de oficiais: mais tenentes;
  - tesouraria: o saque não leva ouro;
  - oficina de cerco: escadas pela metade da madeira e dois aríetes;
  - feira do castelo: ouro por semana;
  - pombal: o aviso do cerco chega uma semana antes;
  - templo.
- **O castelão e a guarnição:** o castelão é um tenente escolhido no painel. A guarnição são os batalhões que ficam na saída. O painel mostra a força da defesa contra o tamanho do próximo cerco.
- **O acampamento de campo:** um kit de até 6 construções que andam nas carroças.
  - É montado pelo botão do HUD, longe da sede e com as carroças junto, e leva meio dia.
  - As barracas abrigam do frio e do pântano, e quem está ferido e tem leito sara no ritmo do acampamento.
  - Entrar na sede recolhe o acampamento.
- **O cerco da sede:** a cada 45 dias, mais cedo com fama e em terra de ninguém. Vem um reino em guerra com o bando, os orcs (com fama 60) ou salteadores, e o cerco cresce a cada vez.
  - Com o bando longe, o cerco se resolve sozinho. Se a sede cair, ela é saqueada: ouro, metade das rações e do depósito, e um terço das construções volta a ser obra.
  - Com o bando em casa, toca o alarme ("Às muralhas!"). A batalha é "Você defende os muros" (a sede como forte de pedra ou vila de madeira), e o bando volta à fortaleza depois dela.
- **Testes:** os 392 de regras e a suíte `fortaleza` (18 verificações) passam, junto com as de cercos e do mar.
- **Falta:**
  - a batalha nas muralhas usa o mapa genérico de cerco, não a planta da fortaleza;
  - o acampamento de campo dá abrigo, enfermaria e cozinha, mas não os outros efeitos das construções;
  - o equilíbrio dos números (custos, cadência e tamanho dos cercos) só se vê jogando.

### 12.4. Marco 22, parte 4: a cidade que nasce sozinha ✅ OK
**A fazer** (GDD 9.8):
- **A população cresce** com seguidores, famílias, refugiados e mercadores, e com segurança, comida, comércio e fama.
- **As etapas:** arraial, burgo, vila e cidade.
- **O desenho:** o gerador de povoados monta a cidade do tamanho máximo, e as casas aparecem do portão para fora.
- **A fortaleza vira um mapa à parte:** a partir do burgo, ela é entrada como a Cidade Alta das capitais (`CapitalScene`).
  - No mapa da região, a fortaleza é a muralha interna, com o portão.
  - Lá dentro fica tudo o que o bando construiu.
- **Os decretos:** artesãos, feira, refugiados, impostos e terra para veteranos.
- **A vila entra no reino** (Marco 9): impostos, recrutas, bens, guarnição e lealdade.

**Pronto quando:**
- depois do dia 120, o arraial vira burgo sem o jogador pôr nenhuma casa;
- a cidade do bando se parece com as do mundo;
- entrar pelo portão interno leva à fortaleza que o jogador construiu;
- a cidade paga impostos e é cercada como as outras.

**Dividida em três:** 4a (as regras), 4b (a cidade no mapa e no reino) e 4c (a fortaleza num mapa à parte).

**Feito na 4a, as regras** (`src/game/sim/seatCity.ts`, puras, com testes):
- **A gente:** a cidade nasce no dia em que o estandarte é fincado, com parte dos seguidores.
- **O crescimento de cada dia** vem do que a sede oferece, de 0 a 1:
  - segurança: muralha, guarnição e milícia, torres e torre de menagem;
  - comida: horta, armazém, cisterna e rações guardadas;
  - comércio: feira do castelo, intendente, taverna e o decreto da feira;
  - fama.
- **Sem segurança** (abaixo de 0,25), a gente vai embora em vez de chegar.
- **As etapas:** arraial (0), burgo (120), vila (300) e cidade (700 a 1200). Sem a muralha de pedra, a vila para logo antes de virar cidade.
- **Os decretos,** no painel da fortaleza:
  - artesãos: o ferro do intendente sai 20% mais barato, por 25 de ouro por semana;
  - feira semanal: mais comércio, por 15;
  - refugiados: mais gente por dia, mas a febre vem mais (25% por semana, levando 8%);
  - terra para veteranos: soldados de batalhões de nível 3 ou mais se aposentam, viram milícia e trazem a família.
- **Os impostos** (baixos, normais ou altos) trocam ouro por crescimento.
- **O saque da sede** leva também um quinto da cidade.

**Feito na 4b, a cidade no mapa e no reino:**
- **O desenho** vem de `seatLayout` (em `world/townLayout.ts`): o mesmo gerador dos povoados, com a mesma muralha, as mesmas casas e as mesmas ruas, montado de uma vez em volta da fortaleza com 760 de folga.
  - As casas aparecem do portão da fortaleza para fora e não mudam de lugar quando a cidade cresce.
  - Água e montanha ficam sem casa.
- **Cada etapa no mapa:**
  - arraial: a praça com as barracas, diante do portão;
  - burgo: casas e roças, sem muralha;
  - vila: paliçada de fora com quatro portões e guarnição, Casa do Conselho e templo;
  - cidade: muralha de pedra.
- **A vila entra no reino:** vira um povoado do bando (`seat: true`), com impostos ("Renda do reino"), guarnição, lealdade e cercos como os outros. Mercado, Sala de Administração e portões funcionam com E, e a taxa do painel vale para o reino. Daí em diante, o ouro da cidade vem pelo reino, e o painel da fortaleza cobra só os decretos.
- **O painel "Cidade da sede"** (na planta, junto da fortaleza) mostra a etapa, a gente, o crescimento e os quatro motivos dele, os impostos, os decretos e os veteranos.
- **Saves antigos** com fortaleza ganham a cidade ao carregar.
- **Testes:** os 412 de regras (8 novos, de `seatLayout`) e a suíte `fortaleza`, com 27 verificações. Ela leva o arraial ao burgo, à vila no reino e à cidade de pedra, e confere a renda do reino.

**Feito na 4c, a fortaleza num mapa à parte:**
- **Do burgo em diante, a fortaleza fica selada:** o Comandante só entra e sai pelo portão, com E ou com um clique, como nas casas. A pé, a muralha não deixa passar nem pelo vão do portão.
  - De fora, o aviso é "E — Entrar: Fortaleza do bando". De dentro, "E — Sair para" o burgo, ou para o nome da vila.
  - A tela escurece e o Comandante aparece do outro lado.
- **Lá dentro, a fortaleza é o mapa:** a câmera fica presa nela e a cidade em volta escurece. Fora, a câmera volta a correr o mundo.
- **O mesmo lugar do mundo:** a fortaleza continua onde sempre esteve, no meio da cidade, e não numa cena à parte como a Cidade Alta.
  - Assim os alojamentos, as obras, a gente do acampamento, o modo construção e os cercos continuam funcionando sem mudança.
  - As tropas, as carroças e os mensageiros passam pelo portão a pé: entrando, vão para os alojamentos; saindo, vêm atrás do Comandante.
- **Testes:** a suíte `fortaleza` com 34 verificações. Ela confere que a pé não se entra, o aviso do portão, a câmera presa e o escuro em volta, a saída e as tropas passando pelo portão.

**Falta:**
- a fortaleza não é maior por dentro do que parece no mapa (ela é o mesmo lugar);
- a floresta debaixo das casas da cidade não é limpa;
- o equilíbrio do crescimento, dos decretos e dos impostos só se vê jogando uma campanha.

## 13. G5: interface ✅ OK
**Objetivo:** a interface em React ganha a mesma cara do jogo.
- **Fonte** em pixel art, também no nome e no estandarte dos batalhões (hoje greybox).
- **Molduras** dos painéis, da tenda e do diário.
- **Ícones** das tropas, dos bens, das construções do Marco 22 e dos botões de batalha.
- **Retratos** do Comandante, dos capitães, dos tenentes e dos nobres, gerados por código como as figuras, com as cicatrizes do Marco 18.

**Pronto quando:** abrir a tenda, o quadro de comando e o diário não mostra mais nenhum painel genérico.

**Em quatro partes,** cada uma com o seu commit. Tudo é feito por código, como as figuras, sem fonte nem pacote baixado de fora:
1. **A fonte:** uma fonte de pixel desenhada letra a letra, com todos os acentos do português, montada em TrueType no próprio jogo. Vale para títulos, rótulos, botões e números do HUD, e para o nome e o estandarte dos batalhões no mapa. O texto corrido dos painéis fica numa fonte comum, para ler sem cansar.
2. **As molduras e os botões:** bordas de madeira, ferro e pergaminho em pixel art, para os painéis, a tenda, o diário e os botões.
3. **Os ícones:** as tropas, os bens, as construções do Marco 22 e os botões de batalha, no lugar dos ícones de linha.
4. **Os retratos:** o Comandante, os capitães, os tenentes e os nobres, com a cultura, a idade e as cicatrizes do Marco 18.

**Feito na parte 1, a fonte:**
- **A fonte "Mercenaria Pixel"** fica em `src/game/art/font.ts`. Cada letra é desenhada numa grade de 12 linhas: as maiúsculas têm 7 de altura, as minúsculas 5, as pernas 2, e os acentos vêm em cima, sem encostar.
  - Tem o alfabeto, os algarismos (todos da mesma largura), a pontuação, todas as letras acentuadas do português e os sinais que os textos usam (· — … × ★ ✓ ✗ ⚑ ▲ ▼ →).
  - O que ela não tem (os emojis) cai na fonte seguinte, até os ícones da parte 3.
- **O TrueType é montado no próprio jogo:** cada pixel vira um quadrado do contorno. O negrito engrossa as hastes sem fechar os vãos de 1 pixel, como as pernas do m.
  - `ui/pixelFont.ts` registra as duas faces antes de o jogo abrir.
- **Onde ela entra:**
  - os títulos (`font-serif`), os números (`font-mono`), os rótulos de seção (h1 a h4) e os botões do componente `Button`;
  - os textos do mapa: nomes dos batalhões, das construções e da gente, e os da Liça, dos interiores e da Cidade Alta.
- **Os tamanhos:** a fonte só fica nítida em 12 px e nos múltiplos, e o CSS encaixa cada tamanho no degrau mais perto (12, 18, 24 ou 36). O texto corrido dos painéis continua na fonte comum.
- **O estandarte dos batalhões:** o nome tem contorno escuro, e a barra da moral tem moldura de pixel, com luz em cima e sombra embaixo.
- **Testes:** 6 de regras (`tests/unit/pixelFont.test.ts`): as tabelas e as somas do arquivo, a cobertura do português, os contornos e o negrito. A suíte de navegador `interface` confere que o navegador aceita as duas faces e onde a fonte aparece, e tira as fotos `.shots-g5-*.png`.

**Feito na parte 2, as molduras e os botões:**
- **As peças** ficam em `src/game/art/frames.ts`, desenhadas na grade de pixel das figuras:
  - madeira, com tábuas, veio, a linha funda e cantoneiras de ferro com rebite;
  - ferro, com trilho de 3 pixels e rebites nos cantos, e o meio deixando ver o mundo;
  - pergaminho, com a borda queimada;
  - botões de 9 pixels em cinco tons (madeira, ouro, vermelho, azul e ferro), cada um em cima, com o mouse e apertado.
- **No CSS:** `ui/pixelFrames.ts` transforma cada peça em imagem e a põe como variável da raiz. As classes `frame-wood`, `frame-iron`, `frame-parchment`, `hud-box`, `hud-card` e `btn-pixel` usam essas imagens no `border-image`, sem suavizar: cada pixel vale 2 px nos painéis e 1 px no HUD.
- **Onde entram:**
  - madeira: o painel do lado (tenda, quadro de comando, construções e povoados) e as caixas do menu. Dentro dela, os cinzas da interface viram tons de madeira e couro só pela troca das variáveis de cor, e os cartões ficam entalhados;
  - ferro: as caixas do HUD (Comandante, dia, recursos, som, câmera, o aviso do E), a barra de comando e os cartões dos batalhões;
  - pergaminho: o diário, com tinta escura;
  - os botões do componente `Button` e os botões de ordem da barra de comando (ferro; o ativo, ouro).
- **Conserto:** o diário da tenda encolhia até sumir no painel (a seção podia encolher dentro da coluna que rola). Agora ele fica do tamanho dele.
- **Testes:** 4 de regras (`tests/unit/frames.test.ts`) e 4 verificações novas na suíte `interface` (9 no total).

**Feito na parte 3, os ícones:**
- **Os desenhos** ficam em `src/game/art/iconArt.ts`: 103 desenhos de 10×10 (111 ícones, contando os derivados), uma letra por cor, com o contorno escuro posto depois (o ícone pronto tem 12×12, a altura da fonte). `art/icons.ts` tem a paleta, os derivados (a retirada é o avanço de cabeça para baixo; o cavaleiro é o cavalo de ferro) e as tabelas:
  - as 9 tropas (espada, lança, elmo, arco, besta, dardos, cavalo, cavalo com barda, cavalo com flecha);
  - os 10 bens, o ouro, as rações, a mochila, a carroça, a fama, a honra e o temor;
  - as 50 construções do Marco 22, cada uma pelo que faz (a cozinha é um caldeirão, a ferraria uma bigorna, o estábulo uma ferradura...), e as 7 necessidades;
  - os 16 botões de ordem e as 4 formações da barra de comando;
  - o tempo, a hora do dia e os sinais do texto (⚑, ★, ☠, ♛, ⚔, ⚓, ✉, ✓...).
- **Na interface:** o componente `PixelIcon` mostra o ícone em 12 px (na linha do texto) ou 24 px (botões e listas), sem suavizar; `IconText` troca os sinais de um texto pelos ícones, e assim as notícias do campo, o diário e os rótulos que vêm do jogo não mostram mais emoji. No mapa do continente, os rótulos desenham os ícones no canvas, e o tempo de cada região também é ícone.
- **Onde entram:** a barra de comando inteira, o cartão de cada batalhão, o HUD de recursos (ouro, rações, ferro e o nome do bando viram ícone com número), o relógio e o tempo, a planta do acampamento (cada construção, cada posto, cada obra e cada necessidade), o quadro de comando, o exército da tenda, o comércio e o Livro de Preços.
- **Junto:** as caixas pretas que sobravam no HUD de batalha (dicas dos botões, ajuda, duelo, pausa, câmera lenta, notícias, cenário) viraram ferro, e os botões do campo (tochas, descansar, fundar vila, montar acampamento, às muralhas) viraram botões de pixel. O relógio desceu para a coluna da direita: numa tela de 1280, as notícias o cobriam. Os emojis dos bens e do tempo saíram de `constants.ts`, e a fonte ganhou ♪, ♫ e ☺ para as falas do acampamento.
- **Testes:** 5 de regras (`tests/unit/icons.test.ts`: o tamanho e as cores de cada desenho, o contorno, um ícone para cada tropa, bem e construção, os derivados e o corte do texto) e 6 verificações novas na suíte `interface` (15 no total), entre elas a de que nenhum emoji sobra no HUD, na planta, na tenda, no quadro de comando e no diário.

**Feito na parte 4, os retratos:**
- **O busto** sai de `src/game/art/portraits.ts`, em 32×32, na grade de pixel das figuras (com o mesmo contorno escuro). O rosto vem de uma semente: o mesmo personagem tem sempre a mesma pele, o mesmo cabelo e o mesmo penteado. O resto vem do que o jogo sabe dele:
  - **o sexo:** o queixo, as sobrancelhas, os lábios, os penteados, a barba;
  - **a idade:** o cabelo começa a branquear aos 40 e fica branco perto dos 70; aparecem rugas, e depois dos 45 o homem pode ficar calvo. Os sorteios saem todos de uma vez, então envelhecer muda o cabelo, mas não troca o rosto;
  - **a cultura:** quatro paletas de pele e de cabelo, que se cruzam. Nas Areias há o turbante, no Jade o coque e o topete, nas Ilhas as tranças e o cabelo comprido;
  - **as cicatrizes do Marco 18:** a primeira corta a bochecha, a segunda a sobrancelha, a terceira o lábio; a quarta põe o tapa-olho, e a quinta marca a testa;
  - **o papel:** o Comandante de couraça, com ombreiras e a capa do bando; o capitão de cota de malha, com a faixa do bando de través; o tenente de gibão, com o lenço; o nobre na cor do reino, com gola de ouro. O rei leva coroa e manto de arminho; o consorte e o herdeiro, um diadema. O fundo é da cor do papel, ou do reino.
- **De quem é cada retrato** (`art/portraitSpecs.ts`): o bando veio dos Reinos, então o fundador é de lá. Quem entra no bando vem de toda parte: metade da terra natal, a maior parte do resto da terra onde o bando está, e um ou outro de mais longe. O nobre sem terra e o inimigo que mudou de lado são da terra, como os nobres.
  - Os capitães ganham idade e cicatrizes com as batalhas, e os tenentes com os abates.
  - O tenente promovido a capitão continua com o mesmo rosto. O herdeiro que era capitão ou tenente leva o rosto para o estandarte: o Comandante ganhou o campo `face`, e os que já se foram guardam o rosto e as cicatrizes.
  - As listas de nomes dos capitães e dos tenentes marcam os nomes de mulher.
- **Onde entram:** o cartão do Comandante no HUD; a ficha do capitão e a do tenente; os candidatos do Posto de Recrutamento; o quadro de comando (cada companhia e cada tenente no batalhão dele); a lista de tenentes e as relações entre eles; o Livro do Bando (o Comandante, os herdeiros possíveis e, em cinza, os que vieram antes); o Livro da Nobreza, com cada nobre da corte (em cinza quem o Comandante ainda não conheceu); e a caixa de diálogo, quando quem fala é um nobre.
- **Junto:** as caixas de diálogo dos interiores e da Cidade Alta eram duas cópias, e viraram um componente só (`DialogBox`), em moldura de madeira. A suíte `lendas` estava quebrada desde o Marco 22, parte 1b, porque o bando passou a começar sem tenentes: agora ela traz um dos candidatos.
- **Testes:** 5 de regras (`tests/unit/portraits.test.ts`: cada cultura, papel e sexo dá um busto cheio; o mesmo rosto para a mesma semente, também ao envelhecer; a idade no cabelo; cada cicatriz uma marca, e o tapa-olho na quarta; de quem é cada retrato), 6 verificações novas na suíte `interface` (21 no total) e uma na `lendas`: o herdeiro leva o rosto que tinha.

## 14. Marco 23: cultura, religião e língua ✅ OK
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

**Em quatro partes,** cada uma com o seu commit:
1. **14.1, a gente de cada lugar:** a mistura de culturas de cada povoado (mais estrangeiros nos portos e nas cidades), a origem de cada batalhão, tenente, capitão e Comandante, guardada desde a contratação. Quem se alista vem da gente do lugar. O povoado governado por gente de fora fica descontente, e o tenente e o capitão da cultura da tropa seguram mais a moral. O painel do povoado, a tenda e as fichas mostram de onde cada um vem.
2. **14.2, as fés:** quatro fés, uma de cada cultura, e uma quinta, de pregadores, que corre entre elas. Cada uma tem templo, clero, calendário e preceitos (o dia santo, enterrar os mortos antes de marchar, o jejum, não tocar em magia). No bando: a fé de cada batalhão, o altar e o templo do acampamento, o capelão, o atrito entre fés e as festas de cada cultura. Na política: a voz dos templos na corte e a guerra santa.
3. **14.3, as línguas:** o Comandante aprende a língua do lugar com o tempo passado ali, e o intérprete (um seguidor novo), o tenente e o capitão falam por ele. Sem quem fale a língua, os preços pioram, os contratos vêm com menos detalhe, os boatos chegam truncados, os prisioneiros dizem menos e as falas aparecem com palavras da língua de lá. Na batalha, a ordem a um batalhão estrangeiro passa pelo tenente, que precisa falar as duas línguas.
4. **14.4, outra terra:** cruzar o mar junta tudo de uma vez (a chegada avisa o que muda), e o fechamento: uma viagem de teste a cada continente confere os três "Pronto quando".

**Feito na parte 1, a gente de cada lugar:**
- **As regras** ficam em `src/game/sim/culture.ts`, sem nada do Phaser nem da loja.
- **A gente de cada povoado** sai do id dele, então é sempre a mesma e não ocupa o save. Quase toda é da terra; o resto vem de fora:
  - a aldeia tem 4% de gente de fora, o forte 8%, a cidade 12% e a capital 18%;
  - o porto ganha mais 12%;
  - a vila da sede do bando é quase metade gente do bando.
- **A origem fica guardada** (o campo `culture`) em cada batalhão, tenente, capitão e Comandante, desde a contratação. Quem é de save antigo é dos Reinos, a terra natal do bando.
  - **Os soldados:** quem se alista no Posto de Recrutamento ou se apresenta como voluntário é sorteado da gente do povoado mais perto do acampamento; na taverna, da gente daquele povoado. Os prisioneiros que mudam de lado são da terra.
  - **Os oficiais:** fora de casa, 30% vêm da terra natal e o resto da terra onde o bando está; em casa, 90% são da terra natal. O nobre sem terra é da terra. O oficial estrangeiro tem nome na língua dele e diz na história de onde veio.
  - **O Comandante:** o herdeiro leva a origem dele para o estandarte. O veterano escolhido pela tropa é da gente que mais tem no bando.
- **O povoado governado por gente de fora** perde até 16 pontos na lealdade que busca, conforme o peso da gente principal dele. O povoado do bando é governado pela gente do Comandante; o de um reino, pela gente da terra.
- **Na batalha:**
  - o tenente da mesma gente da tropa faz o batalhão perder 12% menos moral;
  - o capitão da mesma gente reforça a aura dele em 6%.
- **Na tela:**
  - o painel do povoado mostra a gente dele e avisa quando está "governada por gente de fora";
  - cada batalhão da tenda diz de onde vem, e marca o "tenente da terra";
  - as fichas e os candidatos a tenente e a capitão mostram a origem;
  - o Livro do Bando mostra a do Comandante.
  - Os retratos do G5 passam a usar a origem guardada, no lugar do sorteio pela terra onde o bando está.
- **Junto:** a suíte `progressao` estava quebrada desde o Marco 22, porque o bando passou a começar com um batalhão só. Agora ela traz os arqueiros que testa.
- **Testes:**
  - 6 de regras em `tests/unit/culture.test.ts`: a gente de cada povoado, o sorteio, a lealdade, a origem dos oficiais, a moral com o tenente da mesma gente e a mistura do bando;
  - a suíte nova `cultura`, com 7 verificações.

**Feito na parte 2, as fés:**
- **As regras** ficam em `src/game/sim/faith.ts`. São cinco fés, cada uma com clero, cor, preceitos e calendário:

  | Fé | Terra | Preceitos | Calendário |
  |---|---|---|---|
  | Chama Eterna | Reinos | o dia santo; enterrar os mortos | Festa das Colheitas |
  | Véu das Estrelas | Areias | o jejum; o dia santo | Jejum das Estrelas; Noite das Estrelas |
  | Deuses do Mar | Ilhas | enterrar os mortos; não tocar em magia | Festa da Primeira Vela |
  | Caminho dos Ancestrais | Jade | o jejum; enterrar os mortos | Jejum dos Ancestrais; Festa das Lanternas |
  | Palavra Nova | sem terra (os pregadores) | não tocar em magia; o dia santo | Dia da Aurora |

  - Quem guarda o dia santo tem um a cada 10 dias, cada fé no seu dia.
  - O jejum dura 5 dias por ano. A festa é uma por ano.
  - A Palavra Nova briga com todas as outras, e a Chama briga com o Véu.
- **No bando:** cada batalhão guarda a sua fé (o campo `faith`).
  - Quem se alista segue a fé da sua terra, ou a Palavra Nova: 6% dos recrutas em toda parte, 46% onde o rei se converteu.
  - Quem é de save antigo segue a fé da sua terra.
- **Os preceitos que obrigam a decidir:**
  - **O dia santo:**
    - quem luta no dia santo da sua fé perde moral 25% mais depressa;
    - depois do combate, o templo perde 5 de favor e o acampamento 3 de humor;
    - o HUD avisa no dia.
  - **Enterrar os mortos:** depois de um combate com mortos, os fiéis da Chama, do Mar e do Caminho não querem marchar antes de enterrá-los.
    - O relatório e o HUD dão o botão de enterrar: 6 horas no relógio, e +2 de favor e de humor.
    - Se o exército se afasta mais de 1500 px, ou se passa um dia inteiro, o templo perde 4 de favor e o humor cai 6.
  - **O jejum:** por 5 dias, os fiéis comem a metade (a mochila dura mais) e batem 10% mais fraco.
    - Cumprido, dá +3 de favor.
    - Dá para quebrá-lo na tenda, por −6 de favor e −4 de humor.
  - **Não tocar em magia:** está no calendário e nas fichas, mas só vale quando a magia chegar (Marco 19).
- **As festas:** no dia da festa de uma fé, os fiéis comem um dia de rações a mais, e o humor sobe 5. Sem comida para a festa, o humor cai 3.
- **O atrito:**
  - fés que brigam, cada uma com 15% do bando ou mais, puxam o humor do acampamento 4 pontos para baixo por par;
  - o altar do acampamento acalma metade da briga, e o templo acalma tudo;
  - um evento novo do acampamento, a briga de fé, pede uma decisão, e o capelão pode acalmar os dois lados.
- **O capelão** é da fé de mais gente no bando quando chega.
  - Ele dá +10 de moral aos da fé dele, +4 aos de outras fés e nada aos das fés rivais.
  - Toda semana ele soma favor ao templo dele, e mais ainda com o templo do acampamento.
- **Os templos e a corte:** cada fé guarda o que pensa do bando, de −100 a 100.
  - O favor sobe com as esmolas nos templos das cidades (1 ponto a cada 20 de ouro), as festas, os jejuns cumpridos e os mortos enterrados. Com o tempo, volta devagar a zero.
  - A relação de cada reino com o bando tende ao favor da fé do rei vezes 0,25: é o sacerdote falando na corte.
  - Uma coroa pode abraçar a Palavra Nova (as devotas e as letradas, com mais chance), mas nunca mais da metade dos reinos.
  - Reinos de fés que brigam podem ir à guerra santa (os reinos devotos, com o dobro da chance). Na guerra santa, a paz leva o dobro do tempo para chegar.
- **Na tela:**
  - a tenda ganhou o painel das fés do bando: a parte de cada fé, os preceitos, o calendário, o jejum com o botão de quebrar, as fés que brigam, o capelão, os mortos por enterrar e o favor de cada templo e de cada corte;
  - o cartão de cada batalhão diz a fé dele;
  - o painel do povoado mostra o templo da cidade;
  - o capelão mostra a fé dele.
- **Junto:** o aviso "E — Entrar" não cobre mais os botões do relatório do combate.
- **Testes:**
  - 8 de regras em `tests/unit/faith.test.ts`;
  - 11 verificações novas na suíte `cultura`, que fica com 18.

**Feito na parte 3, as línguas:**
- **As regras** ficam em `src/game/sim/language.ts`. São quatro línguas, uma por cultura: a dos reinos, a das areias, a dos fiordes e a de jade.
- **O que cada um fala:**
  - o Comandante fala a língua da terra dele inteira, e as outras de 0 a 100. Com 30, entende o básico; com 60, fala sem ajuda;
  - cada tenente e cada capitão fala a língua dele. Quem é de fora já pegou a língua da terra onde vive, e 35% rodaram o mundo e sabem mais uma (de preferência a dos reinos);
  - o tenente promovido a capitão leva as línguas dele, e o herdeiro fala de nascença as línguas que já falava;
  - quem é de save antigo fala só a língua da terra dele.
- **A língua de cada lugar** é a da gente de mais gente no povoado mais perto (até 2600 px); mais longe, a da terra.
- **Quem fala pelo bando**, nesta ordem:
  - o Comandante, se já fala a língua;
  - o intérprete dela, que traduz tudo;
  - um tenente ou um capitão que fale a língua de lá e uma que o Comandante fale. Ele se vira, mas não traduz tudo (85%);
  - ninguém: o que o Comandante já aprendeu vale em parte.
- **O intérprete** é um seguidor novo, contratado na taverna por 80 de ouro, da língua de mais gente ali que o Comandante ainda não fala. O bando leva até 2 e cada um come meia ração por dia. Ele não aparece pedindo no portão.
- **O Comandante aprende:**
  - por dia, 1 ponto da língua do lugar, ou 1,5 com o intérprete ou um oficial dela ao lado;
  - cada intérprete ensina a língua dele aos poucos (meio ponto por dia), onde quer que o bando esteja;
  - o relato avisa quando ele entende o básico e quando passa a falar sem ajuda.
- **Sem quem fale a língua:**
  - **os preços:** a margem do mercador piora até 12%;
  - **os contratos:** vêm sem o perigo, sem o caminho e com a descrição truncada;
  - **os boatos:** o que chega ao Comandante vem com palavras de lá. O que chega aos povoados do bando e às feitorias vem inteiro, porque são gente de lá;
  - **os presos:** dizem só quantos povoados o reino tem. Não dão os planos nem a senha dos portões, e o mapa não marca os exércitos;
  - **as falas:** nos interiores dos povoados e na Cidade Alta, parte das palavras sai na língua de lá (as sílabas do gerador de nomes). Os números ficam. A caixa diz em que língua veio e quem traduziu.
- **Na batalha:** a ordem falada (de viva voz ou pelo mensageiro) a um batalhão que não fala a língua do Comandante passa pelo tenente, que precisa falar as duas.
  - Sem ele, a tropa demora 1,5 s a entender, e o relato avisa.
  - A trombeta e as bandeiras não precisam de língua.
- **Na tela:**
  - o painel do povoado diz a língua de lá e quem fala pelo bando;
  - o mercado avisa quanto o mercador cobra a mais;
  - a taverna oferece o intérprete;
  - as fichas dos oficiais dizem as línguas de cada um;
  - o cartão do batalhão avisa quando a tropa não entende a voz do Comandante;
  - o Livro do Bando mostra as línguas do Comandante;
  - o seguidor intérprete diz a língua dele.
- **Testes:**
  - 8 de regras em `tests/unit/language.test.ts`;
  - 15 verificações novas na suíte `cultura`, que fica com 33.

**Feito na parte 4, outra terra:**
- **A chegada:** ao desembarcar, um cartão diz de uma vez o que muda. As regras ficam em `src/game/sim/arrival.ts`. O cartão traz:
  - **a gente:** quem vive ali, o luxo da terra e de onde vão ser os recrutas;
  - **a língua:** quem fala pelo bando e, sem ninguém, o que se perde e como resolver;
  - **a fé:** a fé dos templos, os preceitos, quando vêm o dia santo, o jejum e a festa, e se ela briga com fés do bando;
  - **as ordens:** os batalhões que não entendem a voz do Comandante;
  - **o governo:** povoados tomados ali vão ter gente de fora no comando.
- A volta à terra natal também tem o cartão. A língua e a fé também vão para o relato.
- **Junto, dois consertos da viagem:**
  - o intérprete embarca com o Comandante. Os outros seguidores continuam ficando no acampamento da terra;
  - a memória da taverna ("volte em N dias") passou a ser de cada terra. Os ids dos povoados se repetem entre continentes, e uma contratação em casa travava a taverna de mesmo id do outro lado do mar.
- **O fechamento:** a suíte `cultura` viaja a cada continente e confere os três "Pronto quando":
  - **conversa, negocia e recruta:** a língua do povoado, que ninguém no bando fala; o luxo mais caro sem intérprete; e os recrutas de lá, com a fé de lá;
  - **um preceito obriga a decidir:**
    - onde a fé enterra os mortos, o combate deixa os mortos esperando, e o relatório pede "enterrar ou seguir";
    - nas areias, o jejum do Véu dá o botão de quebrar;
  - **a mistura pesa na moral:** o tenente da terra segura a tropa. Nas areias, o Véu e a Chama brigam no acampamento.
- **Testes:**
  - 5 de regras em `tests/unit/arrival.test.ts`;
  - 14 verificações novas na suíte `cultura`, que fica com 47: 4 por continente, mais a volta para casa.

## 15. G6: atmosfera ✅ OK
**Objetivo:** o clima e a hora do dia ficam visíveis no próprio desenho, e não só num filtro de cor.
- **Noite e tochas:** luz em volta das tochas, das fogueiras e da forja (a chama que ficou do G3).
- **Clima:** chuva, neve, nevoeiro e vento, com o chão molhado e as poças do G2.
- **Efeitos de combate:** flechas, golpes, poeira da investida e sangue.
- **Já pensando na magia:** nevoeiro, tocha apagada, rio congelado e fogo são efeitos que o Marco 19 liga e desliga.

**Pronto quando:** uma batalha à noite, na chuva, se lê pela luz das tochas, e dá para ver de longe onde a investida bateu.

**Em quatro partes,** cada uma com o seu commit. Tudo feito por código, como as figuras, e sem barra de vida em cima de ninguém:
1. **A noite e o fogo:** a chama da fogueira, a brasa da forja e as tochas viram pixel art animada. As luzes ganham um halo quente que tremula e, perto das chamas, a escuridão fica alaranjada. O Comandante e os batalhões de tocha acesa levam a chama na mão.
2. **O clima:** a chuva cai em gotas de pixel que respingam no chão, e com ela o chão escurece e as poças aparecem. A neve cobre o chão aos poucos, o nevoeiro passa em bancos e o vento entorta a chuva e as bandeiras.
3. **Os efeitos de combate:** flechas, virotes e dardos de pixel, que voam em arco e ficam fincados no chão; o golpe em meia-lua; a poeira da investida; e o sangue, que respinga e mancha o chão.
4. **O que a magia mexe, e o fechamento:** nevoeiro, tocha apagada, rio congelado e fogo viram efeitos que se ligam e se desligam num lugar, prontos para o Marco 19. Uma batalha de teste à noite, na chuva, confere o "Pronto quando".

**Feito na parte 1, a noite e o fogo:**
- **As chamas em pixel art:** as folhas saem de `src/game/art/fire.ts`, e não têm contorno escuro, porque o fogo brilha.
  - Cada chama é feita de línguas de fogo, largas no pé e finas na ponta. A ponta balança mais que o pé.
  - O miolo claro fica embaixo e a ponta é vermelha. Faíscas e pedaços de chama se soltam e sobem.
  - Os quadros dão a volta sem emenda.
  - São quatro folhas: a fogueira (6 quadros), a tocha do poste, a tocha da mão (com o cabo e o pano enrolado) e a brasa da forja (4 quadros cada).
- **No acampamento** (`src/game/world/flames.ts`):
  - a chama animada fica por cima da lenha da fogueira, da fogueira das histórias e da fogueira do acampamento de campo;
  - a brasa fica na boca do fogão da forja;
  - a chama fica no pano das tochas dos postes (portas das construções grandes, sentinela, masmorra). O poste perdeu a chama parada que tinha.
  - Cada chama começa num quadro, e as tochas de uma rua não piscam juntas.
- **O halo quente** (`NightLayer`): por cima da escuridão vai uma segunda camada, somada à cena.
  - O halo passa um pouco da borda do buraco de luz, e ali a noite fica alaranjada.
  - Cada luz tem a sua força de halo e o seu tremor (`TIME.FIRE`). A fogueira e as tochas tremulam; as janelas quase não tremem; o covil tem halo roxo.
  - A praça dos povoados só clareia: o halo dela cobriria a vila inteira.
  - Os postes do acampamento, a forja e o acampamento de campo passaram a acender a noite. Antes, só a fogueira acendia.
- **A tocha na mão** (`Unit.setTorch`, `carryTorches`): com a noite escura e as tochas acesas, levam a chama:
  - o Comandante e os mensageiros;
  - um em cada seis de quem marcha, até 5 por batalhão;
  - no acampamento, só quem está de guarda;
  - nos povoados, as sentinelas e as rondas.
  - A tocha vai do lado para onde a figura olha. Ela some com a figura sentada, deitada, no duelo e de longe (no bloquinho).
- **Testes:**
  - 5 de regras em `tests/unit/fire.test.ts`;
  - a suíte nova `atmosfera`, com 9 verificações. Ela confere que as chamas mexem, que as tochas não piscam juntas, que o halo deixa a cor mais quente perto da fogueira (o mesmo chão, com e sem halo) e que a tocha vai para a mão e sai dela com as tochas, a hora e a saída do acampamento. As fotos ficam em `tests/battle/.shots-g6-*.png`.

**Feito na parte 2, o clima:**
- **O vento** (`windAt` em `src/utils/season.ts`): cada dia, em cada célula de clima, sorteia o lado (leste ou oeste) e a força.
  - A força cabe numa faixa por tempo (`WEATHER.WIND`): o nevoeiro é calmaria, a tempestade é vento forte.
  - Abaixo de `WEATHER.CALM`, as bandeiras caem no mastro.
- **O céu em pixel art** (`src/game/art/weatherArt.ts`, `WeatherLayer`):
  - as gotas de chuva têm 7 inclinações, e as da tempestade são mais compridas;
  - cada gota cai até um ponto da tela e ali deixa um respingo de 3 quadros;
  - os flocos de neve são de 3 tamanhos e descem devagar, levados pelo vento;
  - os bancos de nevoeiro são manchas de névoa em degraus, pontilhadas só de um degrau ao vizinho (sem xadrez), e passam com o vento.
  - Por cima vai o véu de antes: o céu escuro da chuva, o clarão do relâmpago e o branco do nevoeiro.
  - O pixel do tempo tem o tamanho do pixel da arte e nunca é menor que um pixel da tela. Tudo é um `Blitter` só, de 180 gotas.
- **O chão com o tempo** (`GroundWeather`), abaixo de tudo o que anda:
  - a chuva molha o chão aos poucos (`WEATHER.GROUND`): ele escurece, e as poças aparecem, primeiro na lama e no brejo, depois na grama e na mata. Na chuva, cada poça ganha de tempos em tempos o círculo de uma gota;
  - parada a chuva, o chão seca devagar;
  - a neve cobre o chão em 4 níveis de manchas que crescem até fechar (um ladrilho de 128 px, preso ao mundo), e cobre as poças;
  - parada a neve, ela derrete devagar, e mais depressa na chuva.
- **As bandeiras ao vento** (`src/game/art/flags.ts`, `FlagSprite`): o pano retangular e a flâmula de duas pontas.
  - Na calmaria, o pano cai junto do mastro, em dobras. Com vento, tremula em 4 quadros, mais depressa quanto mais forte, virado para onde o vento sopra.
  - Colunas vizinhas do pano nunca se afastam mais de 1 px, e o pano não se parte, nem na ponta fina da flâmula.
  - Viraram bandeiras ao vento: as do acampamento (pavilhão, quartéis, portões e cantos), as dos povoados (paço, portões e guarnição) e a do acampamento de campo.
- **Testes:**
  - 11 de regras em `tests/unit/weather.test.ts` (o vento, as gotas, as poças, a neve no chão, o nevoeiro e as bandeiras);
  - a suíte `atmosfera` passou a 17 verificações: na chuva, as gotas respingam e se inclinam com o vento, as bandeiras tremulam viradas para ele, o chão molha e aparecem as poças; na neve, os flocos não respingam e a neve cobre o chão; no nevoeiro, os bancos passam e as bandeiras caem; com tempo aberto, a neve derrete e o chão seca. Fotos novas: `.shots-g6-chuva.png`, `.shots-g6-neve.png` e `.shots-g6-nevoeiro.png`.

**Feito na parte 3, os efeitos de combate:**
- **A folha dos efeitos** (`src/game/art/combatFx.ts`): células de 16 px numa folha só, para cada camada ser um `Blitter` só.
  - Flechas, virotes e dardos em 16 direções. As penas fazem um ">" atrás do rabo, e a ponta é de aço escuro.
  - Os mesmos projéteis fincados no chão, inclinados para a esquerda ou para a direita.
  - A poeira em 5 quadros (cresce e se desfaz em pontilhado), em três cores: terra, lama e neve.
  - Gotas de sangue, lascas de osso e de madeira e faíscas; manchas de sangue (4 respingos e 2 poças), de osso e de madeira.
  - O golpe em meia-lua tem folha própria: 16 direções, 3 quadros.
- **Os efeitos no campo** (`CombatEffects`, ligado à cena do mapa por `setCombatFx`):
  - O projétil anda no mesmo relógio da queda que decide o dano (`TimerEvent.getProgress`): chega quando o dano chega, e pausa e câmera lenta valem para ele. Sobe em arco, e o desenho vira com a curva. A sombra fica no chão.
  - O que não acerta ninguém fica fincado por um minuto (na água, na muralha e nos telhados, não).
  - Quem leva o golpe respinga para o lado contrário de quem bateu (`Unit.matter`: sangue, osso nos esqueletos, lasca nos carros). As gotas caem perto e deixam pingos; quem cai deixa a poça debaixo do corpo.
  - O golpe aparado solta faísca entre os dois.
  - A cavalaria a galope levanta um rastro leve de poeira atrás dos cascos, mais cheio na investida. Onde a investida bate (e onde ela para nas lanças), sobe uma nuvem que fica pairando.
  - A poeira vira lama no chão molhado e borrifo branco na neve e na água.
  - Bobs reaproveitados e limites (400 fincados, 600 manchas, 500 nuvens, 400 gotas). Gotas e poeira só saem perto da câmera; as marcas no chão só aparecem de perto, como os corpos.
- **O golpe do Comandante** (`slashSprite`) é a meia-lua da lâmina, em qualquer cena.
- **Testes:**
  - 7 de regras em `tests/unit/combatFx.test.ts` (a folha, a direção dos projéteis, as penas, os fincados, a poeira, as manchas e o golpe);
  - a suíte `atmosfera` passou a 24 verificações:
    - flechas em arco, virotes quase retos e dardos com desenho próprio;
    - flechas fincadas e respingos;
    - a poeira do galope e a nuvem da investida;
    - manchas e faíscas no corpo a corpo;
    - osso nos esqueletos;
    - a meia-lua do golpe.
  - Fotos novas: `.shots-g6-flechas.png`, `.shots-g6-investida.png`, `.shots-g6-investida-longe.png` e `.shots-g6-sangue.png`.

**Feito na parte 4, o que a magia mexe, e o fechamento:**
- **Os efeitos num lugar** (`src/game/world/PlaceEffects.ts`, em `WorldScene.places`): `add({ kind, x, y, r, seconds })` liga um efeito num círculo e devolve o número dele; `remove(id)` desliga. Sem `seconds`, fica até ser desligado.
  - Cada efeito entra em 1,5 s e sai em 2,5 s (`PLACES`). O relógio para na pausa, como o tempo.
  - **Nevoeiro (`FOG`):**
    - bancos de névoa presos ao chão, que rodam devagar e escurecem com a noite;
    - quem está dentro enxerga como no nevoeiro (metade), e é visto assim pelos inimigos. Vale o nevoeiro de qualquer um dos dois.
  - **Fogo apagado (`DOUSE`):**
    - as tochas saem da mão (`Unit.doused`), soltando fumaça;
    - as fogueiras, os postes e a forja se apagam, e as luzes de dentro somem da noite;
    - quem está dentro conta como sem tocha, para enxergar e para ser visto (`Enemy.places`);
    - desligado, tudo acende de novo. Por cima de um fogo, apaga o fogo.
  - **Gelo (`FREEZE`):**
    - a água e o raso dentro do círculo viram gelo (`TerrainMap.setFrozen`), que se atravessa a pé, e as rotas em volta são refeitas;
    - o gelo é pixel art só por cima da água (`placeArt.ts`): geada na margem, manchas claras, riscos de brilho, rachaduras e a borda pontilhada;
    - no degelo, a água volta, e quem ficou em cima sai para a margem.
  - **Fogo (`FIRE`):**
    - labaredas no meio e chamas pequenas e brasas na borda, que acendem uma a uma e apagam na ordem contrária, soltando fumaça;
    - o fogo acende a noite em volta;
    - o chão vai queimando, e a mancha queimada fica dois minutos depois do fogo;
    - `burningAt` diz onde arde. O que o fogo faz com quem está dentro fica para o Marco 19.
- **A fumaça** (`CombatEffects.smoke`): a quarta cor da poeira, cinza, que sobe e não para no ar.
- **Testes:**
  - 3 de regras em `tests/unit/placeArt.test.ts` (o gelo só na água, a borda pontilhada e o chão queimado);
  - a suíte `atmosfera` passou a 34 verificações:
    - no vau, à noite e na chuva, cada efeito ligado e desligado: o nevoeiro, o fogo apagado, o fogo (e o fogo apagado por cima dele, e o de tempo marcado) e o rio congelado, com o degelo;
    - o fechamento, que confere o "Pronto quando": uma investida à noite, na chuva. A batalha se lê pela luz das tochas, e a nuvem da investida bate na luz delas e se vê de longe.
  - Fotos novas: `.shots-g6-magia-nevoeiro.png`, `.shots-g6-magia-fogo.png`, `.shots-g6-magia-gelo.png`, `.shots-g6-pronto.png` (de longe) e `.shots-g6-pronto-perto.png`.

## 16. Marco 19: magia do Comandante
**Objetivo:** magia rara e poderosa, mas cara. GDD 3 e 8.14. Era o Marco 8, deixado por último.
- **Dano em área** e **suporte e controle**, como previsto desde o início.
- **Aprendizado pelo mundo:** grimórios e artefatos em ruínas antigas, magos da corte capturados e mestres de outro continente.
- **Custo:** recurso arcano, reação política (cortes e templos: −Honra, +Temor) e marcas no corpo do Comandante.
- **Magias que mexem nos sistemas:** congelar um rio, chamar nevoeiro, apagar tochas, curar feridos, quebrar a moral de um exército. Os efeitos visuais vêm do G6.
- **Calamidades mágicas** com fraquezas e respostas mágicas.

**Pronto quando:** uma magia bem usada vira uma batalha difícil, mas usá-la tem um preço político e pessoal.

**Em quatro partes,** cada uma com o seu commit:
1. **O arcano e as primeiras magias:** o recurso arcano, a mira em campo e duas magias, uma de dano em área (a bola de fogo) e uma de suporte (a cura).
   - **Pronta quando:** a bola de fogo no meio de uma tropa cerrada fere quase todos, assusta e deixa o chão em chamas, sem escolher lado; a cura tira um batalhão do pânico; o arcano dá para duas ou três magias por batalha.
2. **As magias que mexem no mundo:** congelar um rio, chamar nevoeiro, apagar as tochas e quebrar a moral de um exército, usando os efeitos do G6 (parte 4).
   - **Pronta quando:** cada uma muda o que as tropas podem fazer (atravessar, enxergar, ser vistas, aguentar firme), e não só o desenho.
3. **Aprender pelo mundo:** grimórios e artefatos nas ruínas antigas, magos da corte capturados e mestres de outro continente. O Comandante começa sem magia nenhuma.
   - **Pronta quando:** cada magia tem pelo menos um caminho no mundo para ser aprendida, e nenhum deles é de graça.
4. **O preço, e as calamidades mágicas:** a reação das cortes e dos templos (−Honra, +Temor), as marcas no corpo do Comandante e as calamidades mágicas, com fraquezas e respostas mágicas. Uma batalha de teste confere o "Pronto quando".

**Feito na parte 1, o arcano e as primeiras magias:**
- **O arcano** (`src/store/magicSlice.ts`): as magias que o Comandante sabe e o arcano de agora, de 0 a 100. Os dois vão para o save.
  - Gastar: `spendArcane(magia)` só gasta de quem sabe a magia e tem o bastante.
  - Volta 40 por dia, pelo relógio do mundo (`advanceTime`), e só para quem sabe alguma magia.
  - Cheio, dá para duas bolas de fogo, ou uma bola e uma cura: o Comandante escolhe a hora.
- **As regras** (`src/game/sim/magic.ts`, sem Phaser):
  - `castProblem` diz por que a magia não sai: não sabe, na recarga, arcano de menos ou longe demais;
  - `blastDamage`: cheio no meio da explosão e 35% na borda;
  - `mendAmount`: até 60% da vida de cada ferido.
- **Em campo** (`src/game/scenes/worldScene/magic.ts`):
  - as teclas 5 a 9 (uma por magia que o Comandante sabe) ou o botão da magia armam a mira. A mira mostra o alcance em volta do Comandante e a área no ponto; fora do alcance, fica cinza;
  - o clique esquerdo lança; o direito ou o Esc desistem;
  - no duelo, não há magia;
  - cada magia tem a sua recarga, de 6 a 10 s.
- **A bola de fogo** (40 de arcano, alcance 460, área de 90 px):
  - sai da mão do Comandante e voa em arco por meio segundo, com rastro de fumaça e luz na noite;
  - onde cai, explode: fere todos na área, os do bando também, sem esquiva nem escudo. O sopro empurra para fora;
  - cada tropa pega perde 30 de moral de uma vez;
  - o chão fica em chamas por 7 s (o fogo do G6), e quem fica dentro segue se queimando;
  - quem é do bando conta como fogo amigo.
- **A cura** (30 de arcano, alcance 380): o batalhão mais perto do ponto fecha as feridas (até 60% da vida de cada um) e ganha 25 de moral. Em pânico, se a moral passa de 40, ele se reagrupa. Sem batalhão no ponto, a cura não sai e o arcano fica.
- **O fogo da magia nas figuras** (`Unit.scorch`): sem esquiva, escudo nem revide. A explosão pisca a figura e respinga; o fogo do chão a deixa cor de brasa por um instante. O inimigo neutro que leva o fogo vira inimigo.
- **A interface:**
  - o grupo "Magia" na barra de ordens, com um botão por magia, a tecla, a recarga e a dica do custo;
  - a barra de Arcano, roxa, embaixo da Vida;
  - na batalha personalizada, "Comandante mago" no editor dá as duas magias e o arcano cheio.
- **A arte** (`src/game/art/magicArt.ts`): a bola de fogo (4 quadros), o clarão da explosão (6 quadros: o miolo de calor que vira fumaça e o anel de fogo que corre até a borda da área) e as faíscas da cura. Os ícones das duas magias estão em `iconArt.ts`.
- **O laboratório de testes:**
  - o Phaser só desfaz um jogo no passo seguinte do laço, que o laboratório para. Agora o laboratório desfaz o jogo da batalha anterior: antes, ele ficava vivo, segurava as teclas e deslocava o clique;
  - a fila de teclas é esvaziada a cada passo, como faz o laço do jogo;
  - isso mostrou um erro que valia também no jogo: quando a cena velha morria depois de a nova nascer, ela largava os efeitos de combate da nova (o sangue, a poeira e a fumaça sumiam). Agora ela só larga os seus.
- **Testes:**
  - 10 de regras em `tests/unit/magic.test.ts`: a recusa, a mira, o dano da explosão, a cura, o arcano e a arte;
  - a suíte nova `magia` (`npm run test:battle -- magia`), com 20 verificações:
    - a tecla e o clique;
    - a recusa longe demais, no duelo e na recarga;
    - a explosão num esquadrão cerrado, o fogo no chão e o fogo amigo;
    - a cura de um batalhão em pânico;
    - o arcano que acaba e volta;
    - a noite.
  - Fotos: `.shots-m19-bola.png`, `.shots-m19-explosao.png`, `.shots-m19-fogo.png`, `.shots-m19-cura.png`, `.shots-m19-noite-voo.png` e `.shots-m19-noite.png`.
- **Ficou para depois:** a IA não sai do chão em chamas. Parada dentro dele, uma tropa perde muito mais do que para a explosão.

**Feito na parte 2, as magias que mexem no mundo:**
- **Quatro magias novas**, nas teclas 7, 8, 9 e 0. As três primeiras ligam no ponto um efeito do G6 (parte 4), por um tempo:
  - **Congelar** (35 de arcano, área de 200 px, 90 s): a água vira gelo, que se atravessa a pé. Sem água na área, a magia não sai e o arcano fica. No degelo, quem estava em cima sai para a margem.
  - **Nevoeiro** (25 de arcano, área de 260 px, 75 s): quem está dentro enxerga metade e só é visto de perto, dos dois lados.
  - **Apagar o fogo** (20 de arcano, área de 260 px, 60 s): as tochas saem da mão, as fogueiras se apagam e o chão em chamas da bola de fogo também. À noite, quem está ali conta como sem tocha: o inimigo só o vê de perto.
- **Pavor** (45 de arcano, área de 170 px), a mais cara: uma onda de medo que não escolhe lado.
  - Cada tropa pega perde 45 de moral de uma vez, e por 8 s nada devolve a moral dela: nem a calma, nem a bandeira, nem o Comandante (`dreadUntil`, em `MoraleSystem`).
  - As tropas perto da borda (até o dobro do raio) perdem 15.
  - Uma tropa descansada aguenta, mas uma que já vacilava foge.
  - Os mortos-vivos não sentem medo.
- **O anel da magia** (`ringSheet` em `magicArt.ts`): ao lançar, um anel na cor da magia corre do ponto até a borda da área e se desfaz. Ele é desenhado para cada raio, sem ampliar o pixel, e clareia a noite por um instante.
- **Os ícones novos:** o floco de gelo sobre a água, o nevoeiro com a faísca, a tocha apagada soltando fumaça e a caveira roxa do pavor.
- **Testes:**
  - 4 de regras novos em `tests/unit/magic.test.ts`: as teclas e os custos, o pavor na moral (ele segura a moral, e depois a moral volta) e o anel;
  - a suíte `magia` passou a 29 verificações:
    - no vau, o batalhão cruza pelo gelo onde antes não passava, e congelar recusa onde não há água;
    - à noite, no nevoeiro e sem as tochas, o inimigo só vê o batalhão de perto;
    - apagar o fogo apaga o chão em chamas;
    - o pavor derruba a moral e a segura, e a tropa abalada foge;
    - o pavor também pega os nossos, e não pega os mortos-vivos.
  - Fotos novas: `.shots-m19-gelo.png`, `.shots-m19-escuro.png` e `.shots-m19-pavor.png`.

## 17. Fechamento: jogar uma campanha inteira
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
- **Batalhões grandes:** 60 a 100 na milícia, poucos na elite. Com as figuras do G1 o desenho deixou de ser o limite, e com a rodada de desempenho a simulação também: 1600 soldados de perto custam 7,6 ms de simulação e 3,8 ms de desenho por quadro (antes, 31 ms de simulação). Espera o seu sinal; o melhor lugar na fila é depois da etapa 6.
- **Alcance dos arcos:** subir de 230 para perto de 480. Hoje a infantaria correndo atravessa o alcance em menos de 3 s. Anda junto com os batalhões grandes.
- **Magia do Comandante:** etapa 16, em andamento.

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
  - O mesmo vale para "nem o covarde larga a luta com a primeira baixa" (suíte `ia`): 3 lutas, cada uma com pelo menos 4 baixas. Numa rodada do G2, uma luta teve 3; sozinha, a suíte passou.
  - E para "arqueiros treinados acertam menos os próprios homens que os novatos" (suíte `ia`): é uma batalha de cada lado. Repetida 6 vezes, os treinados acertam menos em todas, no código antigo e no novo (médias de 52 e 55 contra 98 e 84), mas uma batalha sozinha varia de 12 a 96. Numa rodada da etapa de desempenho deu 91 contra 84.
  - "A guarda pesada aguenta brutamontes" (suíte `confrontos`) também passa ou falha por sorte.
- **Assalto sem fim:** em 2 de 16 assaltos à Paliçada com jogador simulado, a batalha passou de 10 minutos com poucos sobreviventes dos dois lados. Não voltou a acontecer nas repetições, e a causa não foi encontrada. Numa partida, o menu de pausa permite sair.
- **Defesa que demora a acabar:** defendendo o forte, os 2 ou 3 últimos arqueiros às vezes ficam parados na muralha e os orcs, já dentro, levam minutos para chegar neles. Em 5 repetições a batalha acabou entre 113 e 230 s; na suíte completa, 2 vezes não acabou nos 276 s do teste. Não vem das figuras: a mesma demora aparece sem elas.
  - Na rodada de desempenho: 8 defesas sozinhas com cada código, contando da entrada dos orcs. O antigo levou de 69 a 273 s (1 passou dos 240 s do teste), e o novo, de 59 a 176 s. Na suíte, o novo passou do limite 2 vezes em 8.
- **Muralha que não ajuda:** com 8 lutas de cada lado, defender o forte com o robô de teste rendeu menos que lutar em campo aberto (167 com a regra antiga da torre do portão, 135 com a nova, contra 182). Não foi o G3 que criou o problema. Vale rever a IA dos defensores e medir com mais lutas.
  - Por isso a verificação "com muralha vai melhor que em campo aberto" (suíte `cercos`, 4 lutas de cada lado) falha muitas vezes: na rodada de desempenho, falhou em 1 de 3 rodadas com o código antigo e em 6 de 8 com o novo. Medida com 12 defesas de cada código, a diferença é sorte: 16 pontos por luta no antigo e 20 no novo, e cada luta vai de 4 (cai) a 43 (repele).
- **`WorldScene.ts`:** passava de 6000 linhas. Virou a etapa 8 ✅ OK: agora são 942 linhas e 13 partes em `src/game/scenes/worldScene/`.

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
| Capitães | **Bom no papel** | Companhia, um mensageiro por companhia, posturas e um capitão que decide com os planos da IA. A decisão de delegar existe; falta jogar para saber se ela pesa |
| Expedições | **Médio** | Agora vão com um capitão: a Tática, o temperamento e a lealdade dele pesam, e ele escreve o relatório. A luta ainda é um cálculo |
| Corte e nobreza | **Amplo, sem prova** | 6 tipos de favor, tramas e duelos. É o sistema mais longe do que o jogador faz no dia a dia |
| Reino | **Raso** | 11 construções são uma lista de efeitos. Rei com 4 povoados é cedo, e governar é abrir um menu |
| Mar | **Raso** | Primeira versão: uma viagem são segundos assistindo, com 3 eventos, e navio é só capacidade |
| **Comandante em si** | **Raso, o pior caso agora** | Anda, bate e grita. Não evolui. Os duelos (etapa 9) e a magia (etapa 16) são o que está planejado para ele |

### O que eu faria, em ordem de retorno
1. ~~**Progressão:** escolha exclusiva, habilidades que mudam comportamento e promoção de tropa.~~ ✅ Feito nesta fase.
2. **Jogar uma campanha inteira** e corrigir o que aparecer: nenhum teste substitui isso (etapa 17, mas vale antes, aos poucos).
3. **Comandante:** habilidades ativas ligadas aos traços, antes mesmo da magia.
4. **Contratos em cadeia:** o que você fez para um cliente abre ou fecha o próximo.
5. **Reino com decisão:** eventos de governo, com escolha e custo, em vez de só construções.
