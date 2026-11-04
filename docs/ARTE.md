# Arte: o que existe e o que falta

Inventário de tudo o que aparece na tela, com o estado de cada coisa: **pixel art** (já convertido) ou **greybox** (formas de código, como era). Por que pixel art, perspectiva e etapas: [PLANO_GRAFICO.md](PLANO_GRAFICO.md). Etapas no roadmap: [Fase 3](ROADMAP_FASE_3.md).

**Resumo:** etapas G0 (prova), G1 (figuras em campo), G2 (chão) e G3 (construções) ✅ OK. Já são pixel art:
- todo soldado, inimigo e bicho que luta;
- o chão, em todos os degraus do zoom, com água que se mexe, pontes, vaus, balsas e picos;
- as matas: árvores, moitas e pedras;
- as construções: povoados, muralhas e acampamento do bando nas 4 culturas, os locais de contrato e os covis das calamidades.

Interiores, interface e efeitos ainda são greybox.

## Como a arte é feita
- **Por código, em camadas** (`src/game/art/`). Nenhuma imagem é carregada: as folhas são desenhadas na primeira vez que alguém veste aquele visual e guardadas como textura.
  - `pixel.ts`: grade de cores, retângulos, linhas, elipses, contorno automático de 1 px, sombra no chão e a ampliação dos chefes (Scale2x com luz na borda).
  - `figures.ts`: monta a figura a partir de um `Look` (corpo, cabeça, armadura, arma, escudo, montaria, cor da tropa, friso, capa e escala).
  - `looks.ts`: o `Look` de cada tropa do jogador, de cada inimigo, do Comandante, do batedor e do mensageiro.
  - `atlas.ts`: cria as texturas (filtro "mais próximo" em cada uma) e escolhe o nível de detalhe pelo zoom.
  - `corpses.ts`: os corpos que ficam no chão.
  - `ground.ts`: o filtro que passa o chão pintado para pixel art (roda num worker: `groundWorker.ts`).
  - `terrainArt.ts`: as peças do chão que vão nítidas por cima do filtro (picos, pontes, vaus e balsas).
  - `canvasTexture.ts`: põe um canvas como textura sem o `addCanvas` do Phaser, que lê a imagem de volta da placa de vídeo e trava o quadro.
  - `buildings.ts`: as construções em vista 3/4 (casas, templos, castelos, muralhas, torres, portões, tendas, cercas e o acampamento), com o estilo de cada cultura.
  - `../world/TownArt.ts`: põe as peças de cada povoado e do acampamento em folhas de textura, montadas aos poucos perto da câmera.
- **Trocar a origem depois:** se um artista ou um pacote substituir a arte, basta entregar folhas no mesmo formato. O motor não muda.

### Formato das figuras
| | A pé | Montado ou bicho |
| --- | --- | --- |
| Figura | 16×24 | cerca de 24×30 |
| Célula da folha | 32×38, pés em (16, 34) | 46×44, pés em (23, 40) |
| Mini-sprite (zoom 50%) | 10×14, 2 quadros | 16×13, 2 quadros |
| Bloquinho (zoom 25%) | 4×6 | 6×5 |

- **Folha:** 3 linhas (de frente, de lado, de costas; o outro lado é espelhado) × 12 quadros: parado (0–1), andando (2–5), atacando (6–8) e caindo (9–11).
- **Cor da tropa:** tabardo, capuz, escudo e caparazão. Chefes levam friso dourado, capitães prateado.
- **Chefes:** desenhados como figura comum e ampliados para o dobro (Scale2x), com luz na borda de cima, brilho na ponta do cajado e contorno de 1 px por fora. A arte já sai no dobro: o sprite não é esticado.
- **Zoom em degraus:** 25%, 50%, 100% e 200%. Em escala quebrada os pixels tremem.
- **Escala inteira da tela** (`src/game/screen.ts`): o jogo desenha na resolução do monitor dividida por um número inteiro e amplia sem suavizar. Em 1080p fica em 1920×1080 (1×), em 1440p em 1280×720 (2×) e em 4K em 1280×720 (3×). Acompanha a janela quando ela muda de tamanho.

### No jogo
- **Direção:** a figura não gira; olha de frente, de lado ou de costas conforme o movimento, com folga para não trocar a cada passo na diagonal.
- **Animação:** o passo acompanha o chão percorrido, sem patinar. O ataque toca os 3 quadros a cada golpe; quem morre cai e o corpo fica no chão.
- **Corpos:** até 400, por 2 minutos, e depois somem aos poucos. Escurecidos, embaixo de todo mundo, e só no zoom de perto.
- **Profundidade:** quem está mais embaixo na tela passa na frente.
- **Golpe recebido:** a figura pisca branca. Em pânico, fica avermelhada.
- **Sem barra de vida em cima das unidades.** A vida aparece na interface.
- **Marcas no chão:** anel nos pés: dourado no Comandante, prateado nos tenentes, dourado ou prateado nos oficiais inimigos e azul na guarnição do bando. A seleção do batalhão também é um anel nos pés, e o estandarte fica acima da cabeça mais alta.
- **Medido** (navegador sem tela, mesmo combate com cerca de 1500 unidades): o desenho custa de 0 a 12 ms por quadro com figuras, contra 20 a 35 ms em greybox. O gargalo dos combates grandes agora é a simulação (25 a 60 ms), não o desenho.

### Chão em pixel art (G2)
- **Quando:** em todos os degraus do zoom, em três níveis:
  - 400 px de mundo a 100% e 200%, 1 px por px de mundo (a mesma densidade das figuras);
  - 800 px a 50%;
  - 1600 px a 25%.
  - Cada pedaço é uma textura de 400×400 px, então 1 px de textura é 1 px de tela.
- **Como:** o chão comum é pintado na escala do nível e passa pelo filtro de `ground.ts`:
  - cada ponto vira um material pela cor que o chão já pintava: grama, terra, areia, rocha, neve ou água. A borda entre dois materiais sai serrilhada;
  - manchas grandes, mais claras e mais escuras, com a borda pontilhada;
  - o desenho miúdo do material, espalhado sem repetir: tufos e folhas na grama, pedrinhas na terra, ondas na areia, rachas na pedra, reflexos na água;
  - flores em canteiros, só onde a grama é viçosa. Somem no inverno e são poucas no outono;
  - a grama faz sombra na terra logo abaixo dela;
  - na beira da água há barranco de terra (margem de cima), espuma e chão molhado (as outras) ou areia molhada (praia).
- **Sem emenda:** tudo depende só da posição no mundo, então os pedaços vizinhos se encontram sem costura.
- **Fora da linha principal:** o filtro roda num worker (`groundWorker.ts`, `GroundFilter.ts`), com até 3 pedaços ao mesmo tempo. Sem worker, filtra na hora, como antes.
- **Orçamento:** no máximo 6 ms por quadro, contando o chão comum que vem antes, e sempre ao menos um pedaço. Guarda 64 pedaços de perto, 32 a 50% e 24 a 25%. Enquanto um pedaço não fica pronto, aparece o chão comum embaixo.
- **Medido** (navegador escondido, tempos ruidosos, 10 lugares nos 3 degraus):
  - um pedaço custa uns 4 ms na linha principal;
  - o chão enchendo a tela fica abaixo de 14 ms por quadro;
  - um salto da câmera custa de 6 a 12 ms;
  - parado, 0,1 ms.

### Água, travessias e picos (G2)
- **Água que se mexe** (`WaterGlints.ts`): reflexos descem o rio na velocidade da correnteza (16, 11 ou 8 px/s, do rio estreito ao largo), e a espuma da beira vem e vai.
  - Cada célula de 16 px do mundo sorteia o seu ponto, então os pedaços vizinhos não repetem nem perdem um brilho.
  - É um `Blitter` só, e só de perto. O brilho não cai em cima de ponte, cais ou pedra.
- **Peças nítidas** (`terrainArt.ts`), desenhadas depois do filtro. Cada ponto vira coordenada local (ao longo do rio e de margem a margem), então a peça sai nítida em qualquer ângulo:
  - pontes de tábua, com guarda-corpo, postes e cabeceiras de pedra; queimadas, sobram os postes e tocos de tábua carbonizados perto das margens;
  - balsas, com cais nas duas margens, jangada e corda;
  - vaus, com água rasa recortada no rio e pedras com espuma, só dentro da água;
  - picos de pedra com neve (maior no inverno), em 48 formas guardadas (6 desenhos em 8 tamanhos).
- **Colinas, lama e brejo:** degraus de terra nas colinas (as curvas de nível) e poças na lama e no brejo.
- **Escondidos pela estação:** sob a cheia e o gelo, o vau some.

### Matas (G2)
- **O quê:** pinheiro, carvalho, moita, pedra e pedra grande (`trees.ts`), cada um com variações pela semente. O pé fica na base da peça, então a profundidade é a mesma das figuras.
- **Onde:** `forestLayout.ts` espalha as peças em cada zona de mata: grade sacudida (de 42 a 58 px, conforme o bioma), mais rala na borda e com 2 ou 3 clareiras. Algumas árvores têm moita no pé. Nada nasce fora do chão de mata, nem a menos de 34 px da estrada.
- **Estação:** a primavera põe flores nos carvalhos, o outono os pinta de amarelo, laranja e vermelho, o inverno deixa só os galhos. Onde neva, há neve nos galhos, nas copas dos pinheiros e nas pedras. O lugar das árvores nunca muda.
- **Chão:** a mata escurece aos poucos (gradiente na última quarta parte da zona) e leva manchas de folha caída por baixo.
- **Custo:** as peças entram nas folhas do `TownArt`. A lista de cada mata só é feita quando a câmera chega perto (`setLazy`), a montagem gasta no máximo 5 ms por quadro e, de longe, a folha é reduzida. Trocar a estação não pisca: a montagem velha fica até a nova acabar.

## Inventário

### Figuras em campo (G1)
| O quê | Onde no código | Estado |
| --- | --- | --- |
| 9 tropas do jogador (infantaria, lanceiros, guarda pesada, arqueiros, besteiros, dardeiros, cavalaria, cavaleiros, arqueiros montados) | `Soldier` | ✅ pixel art |
| Comandante (penacho e capa), batedor e mensageiro | `Commander`, `Scout`, `Messenger` | ✅ pixel art |
| 53 dos 55 tipos de inimigo: goblins, orcs, esqueletos, salteadores, piratas, soldados dos reinos, tropas de ultramar, amotinados, civis, mercadores, arautos, lobos e cavaleiros de lobo | `Enemy` | ✅ pixel art |
| Chefes de calamidade (Necromante, Senhor da Guerra orc) | `Enemy` | ✅ pixel art no dobro do tamanho, ampliada com Scale2x e retocada: Necromante com olhos acesos e friso violeta, Senhor da Guerra com chifres e capa escura |
| Corpos depois do combate | `Corpses` | ✅ ficam no chão |
| Guarnições, patrulhas e alcateias | `Enemy` | ✅ pixel art |
| Tropa dormindo ou sentada no acampamento | `Unit.setPose` | ✅ deita (quadro da queda) ou fica mais baixa |
| Poses do duelo no campo (Marco 21): guarda erguida, pesado armando, esquiva e atordoado | `figures.ts` (colunas 12 a 15 da folha), `Unit.duelPose` | ✅ pixel art; o golpe leve usa as poses de ataque |
| Carroça de mercador e aríete inimigo | `Enemy` (CART, SIEGE_RAM), `vehicles.ts` | ✅ pixel art (G4): mula e toldo listrado na cor da caravana; aríete coberto na cor de quem assalta |
| Carroças do bando | `Wagon`, `vehicles.ts` | ✅ pixel art (G4): carro de bois com lona e carroceiro; as rodas giram e o destroço fica no chão |
| Escadas e aríete do jogador nos cercos | `SiegeWorks`, `ladderPiece` em `buildings.ts`, `vehicles.ts` | ✅ pixel art (G4): a viga do aríete bate no portão; as escadas encostam do lado de fora, nos quatro lados |
| Harpias | `Harpy` | greybox |
| Coluna de tropas em expedição e comboio de suprimentos | `ExpeditionParty` | ✅ pixel art (G4): figuras do G1 em filas de três, o porta-estandarte na frente (dourado com capitão) e os carros de bois atrás |

### Gente que não luta
| O quê | Onde no código | Estado |
| --- | --- | --- |
| Viajantes, caravanas e barcos no mapa | `MapLife` | greybox (círculos) |
| Seguidores do acampamento (cozinheira, ferreiro, crianças) e cargas | `CampLife` | greybox |
| Tenentes sentados na fogueira | `CampArea` | greybox |
| Gente dos interiores | `InteriorScene` | greybox |
| Cidade Alta das capitais | `CapitalScene` | greybox |
| Duelos da Liça | `DuelScene` | greybox |

### Efeitos
| O quê | Onde no código | Estado |
| --- | --- | --- |
| Flechas, virotes e dardos | `ProjectileSystem` | greybox (traço) |
| Golpe do Comandante | `Commander.drawSlash` | greybox (arco) |
| Textos que sobem ("esquiva", "flanqueados!") | `Unit.floatText` | texto |
| Ordens, destinos, linha de batalha e seleção | `WorldScene`, `Battalion` | greybox (de propósito: são da interface) |
| Estandarte e nome do batalhão | `Battalion.drawBanner` | greybox |
| Anel do duelo e aviso dos golpes no campo (Marco 21) | `worldScene/duel.ts` | greybox (de propósito: são da interface) |
| Estandarte do desafio (herói inimigo que procura duelo, Marco 21) | `duelBannerSprite` em `figures.ts`, `Enemy.makeHero` | ✅ pixel art: flâmula vermelha de duas pontas com espadas cruzadas |
| Névoa de guerra | `FogOfWar` | greybox |
| Noite e tochas | `NightLayer` | greybox |
| Chuva, neve e nevoeiro | `WeatherLayer` | greybox |

### Chão (G2)
| O quê | Onde no código | Estado |
| --- | --- | --- |
| 11 biomas | `TerrainMap`, `ground.ts` | ✅ pixel art (filtro) nos 3 níveis de zoom |
| Rios, mar e costa | `TerrainMap`, `ground.ts`, `WaterGlints` | ✅ margem desenhada (barranco, espuma, areia molhada) e, de perto, água que se mexe |
| Vaus, pontes e balsas | `terrainArt.ts` | ✅ pixel art nítida, com a ponte queimada e o vau que some na cheia e no gelo |
| Estradas | `TerrainMap` | de perto, ✅ terra com o desenho do filtro |
| Árvores, moitas e pedras das matas | `ForestArt`, `trees.ts`, `forestLayout.ts` | ✅ pixel art, com profundidade, nas 4 estações e com neve |
| Colinas, pântanos e lama | `TerrainMap` | ✅ degraus de terra nas colinas e poças na lama e no brejo |
| Picos das montanhas | `terrainArt.ts` | ✅ pixel art nítida, com neve |
| Estações (lama, neve, outono) | `TerrainMap`, `ground.ts` | ✅ a neve vira material próprio e as flores seguem a estação |
| Mapas das batalhas personalizadas | `battleMaps.ts` | usam o mesmo chão |

### Construções (G3)
| O quê | Onde no código | Estado |
| --- | --- | --- |
| Casas, Casa do Conselho, castelo, templo, barracas do mercado, poço e entulho, nas 4 culturas | `TownArt`, `buildings.ts` | ✅ pixel art |
| Muralhas, paliçadas, torres e portões; o portão fechado e o arrombado no cerco | `TownArt`, `SiegeWorks` | ✅ pixel art |
| Pátios da guarnição (tendas, cerca, fogueira, armeiro, bonecos) | `TownArt` | ✅ pixel art |
| Chão dos povoados (lavouras, ruas, praça, pátios) | `TerrainMap` | ✅ pintado no chão, com o filtro do G2 de perto |
| Cidade Alta vista de fora | `TownArt` | ✅ pixel art (por dentro é G4) |
| Acampamento do bando (paliçada, torres, pavilhão, intendência, recrutamento, estábulo, ferraria, treino, poço, tendas dos batalhões) | `CampArea` | ✅ pixel art |
| Bandeiras dos povoados (paço, portões, guarnição), na cor do dono | `Settlements`, `TownArt` | ✅ pixel art |
| Locais de contrato: barracas de bandidos, choupanas goblins, ruínas assombradas, vau do pântano | `wildLayout.ts`, `wilds.ts` | ✅ pixel art, com o chão pisado pintado no chão |
| Covis das calamidades: torre negra do necromante com sepulturas; acampamento de guerra orc com barracas de couro, totens e cavalos-de-frisa | `wildLayout.ts`, `wilds.ts` | ✅ pixel art, com o chão do covil |
| Chama da fogueira e brilho da forja | `CampArea` | greybox (G6) |

### Resto do elenco (G4)
| O quê | Estado |
| --- | --- |
| Carroças, aríetes e escadas (ver acima) | ✅ pixel art (G4, parte 1) |
| Harpias (ver acima) | greybox |
| Navios e convés | greybox |
| Interiores das construções | greybox |
| Cidade Alta das capitais | greybox |

### Interface (G5)
| O quê | Estado |
| --- | --- |
| Fonte com acentos do português | pendente: escolher |
| Molduras, botões e painéis (React) | estilo atual, sem pixel art |
| Ícones das ordens e formações | ícones de linha atuais |
| Retratos do Comandante e dos tenentes | não existem |
| Mapa do Continente e Mapa Múndi | greybox |

## O que falta, por etapa
1. **G1, acabamento** (feito: chefes no dobro, corpos no chão, escala inteira da tela). Continua fraco:
   - cavalo de frente e de costas: lê como cavalo, mas ainda é a pose mais fraca;
   - estandarte e nome do batalhão ainda são greybox (ficam para o G5, com a fonte).
2. **G2, chão ✅ OK.** Ficou para depois:
   - a água só se mexe de perto (100% e 200%), e não há onda que corre na praia;
   - o chão comum de baixo ainda é pintado na linha principal (barato agora: 1,5 ms por pedaço na mediana).
3. **G3, construções ✅ OK.** Ficou para depois:
   - as peças das construções novas do Marco 22, quando ele vier;
   - a chama da fogueira e o brilho da forja (G6, com o fogo e a noite).
4. **G4, resto do elenco,** em seis partes. As duas primeiras estão feitas: carroças, aríetes e escadas; a coluna das expedições e do comboio. Falta: harpias, navios, convés, interiores e Cidade Alta, e a gente do mapa e do acampamento com as figuras do G1.
   - As carroças vieram primeiro: com as rações refeitas, elas saem num comboio pelo mapa, e o Marco 22 carrega as construções nelas.
   - A ordem entre as etapas de arte e os marcos está na [fila da Fase 3](ROADMAP_FASE_3.md#a-fila).
5. **G5, interface:** fonte, molduras, ícones e retratos.
6. **G6, atmosfera:** noite, tochas, clima e efeitos (flechas, golpes, poeira da investida, sangue).
