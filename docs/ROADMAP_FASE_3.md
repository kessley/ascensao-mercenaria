# Roadmap — Fase 3: O arcano

Objetivo da fase: trocar o greybox por pixel art e, junto, dar ao bando o que faltava: capitães, duelos em campo, um acampamento construído pelo jogador (que vira fortaleza e, em volta dela, cidade), cultura, religião e língua e, por último, a magia do Comandante. As pendências das Fases 1 e 2 e a avaliação das mecânicas ficam no fim deste arquivo.

**Onde estamos (4 de novembro de 2026):**
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
- **Combinado em 4 de novembro, depois de um brainstorm:**
  - o Marco 22 foi refeito (etapa 12 e [GDD, seção 9](GDD.md#9-do-bivaque-à-cidade-o-bando-que-constrói-fase-3-marco-22)): do bivaque ao acampamento, à fortaleza e a uma cidade que nasce sozinha;
  - os locais de missão passam a ter moradores fixos (etapa 10, já feita).
- **A seguir:** o Marco 22 (etapa 12, em quatro partes), pela parte 1: o bivaque e a grade.
  - A campanha nova começa só com a tenda, a fogueira e uma barraca. O jogador monta o resto numa grade quadrada de 40 px, com as primeiras 16 construções.
  - Depois vêm a vida no acampamento, a fortaleza e a cidade que nasce sozinha.

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
| 12 | [Marco 22: do bivaque à cidade](#12-marco-22-do-bivaque-à-cidade) | recurso | Usa as peças do G3 e as carroças e a gente do G4. Refeito em 4 de novembro, em quatro partes | partes 1 e 2 ✅ OK; a seguir, a parte 3 |
| 13 | [G5: interface](#13-g5-interface) | arte | Retratos de capitães e tenentes e ícones das construções; o Marco 23 enche a interface de fé e língua | |
| 14 | [Marco 23: cultura, religião e língua](#14-marco-23-cultura-religião-e-língua) | recurso | | |
| 15 | [G6: atmosfera](#15-g6-atmosfera) | arte | Nevoeiro, tochas, gelo e fogo são o que a magia mexe | |
| 16 | [Marco 19: magia do Comandante](#16-marco-19-magia-do-comandante) | recurso | Por último, como combinado | |
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

## 12. Marco 22: do bivaque à cidade
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

### 12.4. Marco 22, parte 4: a cidade que nasce sozinha
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

## 13. G5: interface
**Objetivo:** a interface em React ganha a mesma cara do jogo.
- **Fonte** em pixel art, também no nome e no estandarte dos batalhões (hoje greybox).
- **Molduras** dos painéis, da tenda e do diário.
- **Ícones** das tropas, dos bens, das construções do Marco 22 e dos botões de batalha.
- **Retratos** do Comandante, dos capitães, dos tenentes e dos nobres, gerados por código como as figuras, com as cicatrizes do Marco 18.

**Pronto quando:** abrir a tenda, o quadro de comando e o diário não mostra mais nenhum painel genérico.

## 14. Marco 23: cultura, religião e língua
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

## 15. G6: atmosfera
**Objetivo:** o clima e a hora do dia ficam visíveis no próprio desenho, e não só num filtro de cor.
- **Noite e tochas:** luz em volta das tochas, das fogueiras e da forja (a chama que ficou do G3).
- **Clima:** chuva, neve, nevoeiro e vento, com o chão molhado e as poças do G2.
- **Efeitos de combate:** flechas, golpes, poeira da investida e sangue.
- **Já pensando na magia:** nevoeiro, tocha apagada, rio congelado e fogo são efeitos que o Marco 19 liga e desliga.

**Pronto quando:** uma batalha à noite, na chuva, se lê pela luz das tochas, e dá para ver de longe onde a investida bateu.

## 16. Marco 19: magia do Comandante
**Objetivo:** magia rara e poderosa, mas cara. GDD 3 e 8.14. Era o Marco 8, deixado por último.
- **Dano em área** e **suporte e controle**, como previsto desde o início.
- **Aprendizado pelo mundo:** grimórios e artefatos em ruínas antigas, magos da corte capturados e mestres de outro continente.
- **Custo:** recurso arcano, reação política (cortes e templos: −Honra, +Temor) e marcas no corpo do Comandante.
- **Magias que mexem nos sistemas:** congelar um rio, chamar nevoeiro, apagar tochas, curar feridos, quebrar a moral de um exército. Os efeitos visuais vêm do G6.
- **Calamidades mágicas** com fraquezas e respostas mágicas.

**Pronto quando:** uma magia bem usada vira uma batalha difícil, mas usá-la tem um preço político e pessoal.

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
- **Magia do Comandante:** etapa 16.

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
