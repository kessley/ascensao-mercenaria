# Arte: o que existe e o que falta

Inventário de tudo o que aparece na tela, com o estado de cada coisa: **pixel art** (já convertido) ou **greybox** (formas de código, como era). Por que pixel art, perspectiva e etapas: [PLANO_GRAFICO.md](PLANO_GRAFICO.md). Etapas no roadmap: [Fase 3](ROADMAP_FASE_3.md).

**Resumo:** etapas G0 (prova), G1 (figuras em campo), G2 (chão), G3 (construções), G4 (resto do elenco), G5 (interface) e G6 (atmosfera) ✅ OK. Já são pixel art:
- todo soldado, inimigo e bicho que luta;
- o chão, em todos os degraus do zoom, com água que se mexe, pontes, vaus, balsas e picos;
- as matas: árvores, moitas e pedras;
- as construções: povoados, muralhas e acampamento do bando nas 4 culturas, os locais de contrato e os covis das calamidades;
- as carroças, os aríetes, as escadas, as harpias, os navios e a gente do mapa e do acampamento (G4);
- os interiores das construções, a Cidade Alta das capitais e a Liça dos duelos (G4, parte 5);
- a fonte, as molduras, os ícones e os retratos (G5);
- o fogo, a noite, o clima, os efeitos de combate e o que a magia mexe (G6).

Ainda são greybox: as marcas de ordem, de destino e de seleção (de propósito: são da interface), o estandarte do batalhão e a névoa de guerra.

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
| 53 dos 55 tipos de inimigo: goblins, orcs, esqueletos, salteadores, piratas, soldados dos reinos, tropas de ultramar, amotinados, civis, mercadores, arautos, lobos e cavaleiros de lobo (os outros 2, a carroça e o aríete, vieram no G4) | `Enemy` | ✅ pixel art |
| Cavalo de frente e de costas | `figures.ts` | ✅ pixel art, refeito no G4 (parte 6): de frente, a cara comprida com a lista branca e a barriga dos dois lados; de costas, as duas ancas e o rabo que balança |
| Chefes de calamidade (Necromante, Senhor da Guerra orc) | `Enemy` | ✅ pixel art no dobro do tamanho, ampliada com Scale2x e retocada: Necromante com olhos acesos e friso violeta, Senhor da Guerra com chifres e capa escura |
| Corpos depois do combate | `Corpses` | ✅ ficam no chão |
| Guarnições, patrulhas e alcateias | `Enemy` | ✅ pixel art |
| Tropa dormindo ou sentada no acampamento | `Unit.setPose` | ✅ deita (quadro da queda) ou fica mais baixa |
| Poses do duelo no campo (Marco 21): guarda erguida, pesado armando, esquiva e atordoado | `figures.ts` (colunas 12 a 15 da folha), `Unit.duelPose` | ✅ pixel art; o golpe leve usa as poses de ataque |
| Carroça de mercador e aríete inimigo | `Enemy` (CART, SIEGE_RAM), `vehicles.ts` | ✅ pixel art (G4): mula e toldo listrado na cor da caravana; aríete coberto na cor de quem assalta |
| Carroças do bando | `Wagon`, `vehicles.ts` | ✅ pixel art (G4): carro de bois com lona e carroceiro; as rodas giram e o destroço fica no chão |
| Escadas e aríete do jogador nos cercos | `SiegeWorks`, `ladderPiece` em `buildings.ts`, `vehicles.ts` | ✅ pixel art (G4): a viga do aríete bate no portão; as escadas encostam do lado de fora, nos quatro lados |
| Harpias | `Harpy`, `harpy.ts` | ✅ pixel art (G4): águia de asas largas que bate as asas e plana, com a sombra no chão mostrando a altura |
| Coluna de tropas em expedição e comboio de suprimentos | `ExpeditionParty` | ✅ pixel art (G4): figuras do G1 em filas de três, o porta-estandarte na frente (dourado com capitão) e os carros de bois atrás |

### Gente que não luta
| O quê | Onde no código | Estado |
| --- | --- | --- |
| Moradores, camponeses, viajantes, peregrinos, caçadores e cervos no mapa | `MapLife`, `Extra` | ✅ pixel art (G4): figuras do G1; o camponês trabalha a terra com a enxada e o caçador volta com o cervo nas costas |
| Seguidores do acampamento e cargas | `CampLife`, `campProps.ts` | ✅ pixel art (G4): figuras do G1 com a roupa do ofício, os lugares de trabalho (caldeirão, banca, enfermaria, púlpito, bigorna, varal) e a carga de ferro; as crianças ficaram para depois |
| Tenentes sentados na fogueira | `CampArea`, `Extra` | ✅ pixel art (G4): sentados, virados para o fogo, com o anel prateado |
| Gente dos interiores | `InteriorScene`, `Extra` | ✅ pixel art (G4): guardas, nobres (quem reina, de coroa), escrivães, sacerdotes, ladrões e o rato dos esgotos; quem dorme deita no catre |
| Cidade Alta das capitais | `CapitalScene`, `Extra` | ✅ pixel art (G4): o povo, os criados, os guardas e os nobres; disfarçado, o Comandante usa capuz |
| Duelos da Liça | `DuelScene`, `Extra` | ✅ pixel art (G4): os dois lutadores no dobro do tamanho, com as poses do duelo, e a arquibancada cheia |

### Efeitos
| O quê | Onde no código | Estado |
| --- | --- | --- |
| Flechas, virotes e dardos | `combatFx.ts`, `CombatEffects`, `ProjectileSystem` | ✅ G6, parte 3. Pixel art em 16 direções, que voam em arco (o desenho vira para cima na subida e para baixo na descida) com a sombra no chão; o virote voa quase reto. O que não acerta ninguém fica fincado no chão, inclinado para o lado de onde veio, por um minuto |
| Golpe do Comandante | `slashSprite` em `CombatEffects`, `Commander` | ✅ G6, parte 3. A meia-lua da lâmina em 3 quadros (o golpe, o rastro e o rastro se desfazendo), em 16 direções |
| Sangue, poças, ossos, lascas e faíscas | `CombatEffects`, `Unit.matter` | ✅ G6, parte 3. Quem leva o golpe respinga para o lado contrário de quem bateu, e as gotas mancham o chão; quem cai deixa uma poça debaixo do corpo. Os esqueletos soltam osso, e os carros, lascas de madeira. O golpe aparado solta faísca. As marcas somem depois de um minuto e meio e só aparecem de perto, como os corpos |
| Poeira da cavalaria e da investida | `CombatEffects` | ✅ G6, parte 3. A galope, um rastro leve atrás dos cascos (mais na investida); onde a investida bate, uma nuvem que se vê de longe. Vira lama no chão molhado e borrifo branco na neve e na água |
| O que a magia mexe num lugar: nevoeiro, fogo apagado, gelo e fogo | `PlaceEffects`, `placeArt.ts` | ✅ G6, parte 4. O nevoeiro são bancos de névoa presos ao chão, que escurecem com a noite. Onde o fogo é apagado, as tochas saem da mão e as fogueiras e os postes se apagam, soltando fumaça. O gelo cobre só a água: geada na margem, manchas claras e rachaduras, e a borda pontilhada. O fogo são labaredas no meio e chamas pequenas e brasas na borda, com fumaça; o chão fica queimado por dois minutos depois dele |
| Fumaça | `CombatEffects.smoke` | ✅ G6, parte 4. Rolos cinza que sobem e se desfazem (a chama que apagou, o fogo de um lugar) |
| Bola de fogo e explosão | `magicArt.ts`, `worldScene/magic.ts` | ✅ Marco 19, parte 1. A bola de 16 px em 4 quadros, com línguas de fogo que giram, voa em arco com rastro de fumaça. A explosão tem 6 quadros: o miolo branco de calor que vira fumaça e o anel de fogo que corre até a borda da área e se quebra. Depois, o fogo do chão (G6). Quem queima no chão fica cor de brasa por um instante |
| Brilho da cura | `magicArt.ts` | ✅ Marco 19, parte 1. Cruzes de luz verde e dourada, 2 por soldado, que sobem, abrem as pontas e se apagam |
| Anel das magias | `magicArt.ts` (`ringSheet`) | ✅ Marco 19, parte 2. Ao lançar congelar, nevoeiro, apagar o fogo e pavor, um anel em 4 quadros corre do ponto até a borda da área, afina e se desfaz em pontos. É branco e cinza, tingido com a cor de cada magia, e desenhado para cada raio, sem ampliar o pixel |
| Mira das magias | `worldScene/magic.ts` | greybox (de propósito: é da interface). O alcance em volta do Comandante e a área no ponto, na cor da magia; cinza fora do alcance |
| Textos que sobem ("esquiva", "flanqueados!") | `Unit.floatText` | texto |
| Ordens, destinos, linha de batalha e seleção | `WorldScene`, `Battalion` | greybox (de propósito: são da interface) |
| Estandarte e nome do batalhão | `Battalion.drawBanner` | greybox |
| Anel do duelo e aviso dos golpes no campo (Marco 21) | `worldScene/duel.ts` | greybox (de propósito: são da interface) |
| Estandarte do desafio (herói inimigo que procura duelo, Marco 21) | `duelBannerSprite` em `figures.ts`, `Enemy.makeHero` | ✅ pixel art: flâmula vermelha de duas pontas com espadas cruzadas |
| Névoa de guerra | `FogOfWar` | greybox |
| Noite e tochas | `NightLayer`, `worldScene/camp.ts` (`carryTorches`), `Unit.setTorch` | ✅ G6, parte 1. A escuridão tem buracos de luz que tremulam, e por cima vai o halo quente das chamas, que deixa a noite alaranjada perto do fogo. Levam a tocha na mão: o Comandante, os mensageiros, um em cada seis de quem marcha (até 5 por batalhão), a guarda do acampamento e as sentinelas dos povoados |
| Chuva, neve e nevoeiro | `WeatherLayer`, `weatherArt.ts` | ✅ G6, parte 2. Gotas de pixel inclinadas pelo vento, que respingam onde batem; flocos que o vento leva; bancos de nevoeiro pontilhados que passam com o vento. O pixel do tempo tem o tamanho do pixel da arte em qualquer zoom |
| Chão molhado, poças e neve no chão | `GroundWeather`, `weatherArt.ts` | ✅ G6, parte 2. A chuva escurece o chão aos poucos e abre poças (primeiro na lama e no brejo), com o círculo das gotas. A neve cobre o chão em manchas que crescem até fechar, e cobre as poças. Parado o tempo, o chão seca e a neve derrete devagar |

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
| Cidade Alta vista de fora | `TownArt` | ✅ pixel art (por dentro também: G4, parte 5) |
| Acampamento do bando (paliçada, torres, pavilhão, intendência, recrutamento, estábulo, ferraria, treino, poço, tendas dos batalhões) | `CampArea` | ✅ pixel art |
| Cidade da sede (Marco 22, parte 4): arraial, burgo, vila e cidade em volta da fortaleza | `seatLayout` em `townLayout.ts`, `TownArt`, `Settlements` | ✅ pixel art: as mesmas peças dos povoados, sem peça nova |
| Bandeiras dos povoados (paço, portões, guarnição), na cor do dono | `Settlements`, `flags.ts`, `FlagSprite` | ✅ pixel art ao vento (G6, parte 2): caídas no mastro na calmaria, tremulando com vento (mais depressa quanto mais forte), viradas para onde ele sopra. As do acampamento e do acampamento de campo também. Na Cidade Alta e nos locais de contrato, ainda paradas |
| Locais de contrato: barracas de bandidos, choupanas goblins, ruínas assombradas, vau do pântano | `wildLayout.ts`, `wilds.ts` | ✅ pixel art, com o chão pisado pintado no chão |
| Covis das calamidades: torre negra do necromante com sepulturas; acampamento de guerra orc com barracas de couro, totens e cavalos-de-frisa | `wildLayout.ts`, `wilds.ts` | ✅ pixel art, com o chão do covil |
| Chama da fogueira, brasa da forja e tochas dos postes | `fire.ts`, `world/flames.ts`, `CampArea`, `FieldCampArt` | ✅ pixel art animada (G6, parte 1), sem contorno escuro, porque o fogo brilha. A fogueira tem 6 quadros; a tocha, a tocha da mão e a brasa têm 4 cada. Cada chama começa num quadro, e as tochas de uma rua não piscam juntas |

### Resto do elenco (G4)
| O quê | Estado |
| --- | --- |
| Carroças, aríetes e escadas (ver acima) | ✅ pixel art (G4, parte 1) |
| Harpias (ver acima) | ✅ pixel art (G4, parte 3) |
| Barcaças e navios de comércio | ✅ pixel art (G4, parte 3), `ships.ts`: casco, velas e espuma; vela recolhida no porto durante a tempestade |
| Convés da abordagem | ✅ pixel art (G4, parte 3), `deck.ts`: os dois navios, as pranchas e o mar que corre |
| Gente do mapa e do acampamento (ver acima) | ✅ pixel art (G4, parte 4) |
| Interiores das construções | ✅ pixel art (G4, parte 5), `interiors.ts`: a sala numa imagem só e os móveis como peças, cada um com a sua altura |
| Cidade Alta das capitais | ✅ pixel art (G4, parte 5), `cityArt.ts` e `capitalArt.ts`: o chão com o filtro do G2 e o calçamento; os prédios do G3 e os novos (torre de menagem, paços, palácios com jardim, chafariz) |

### Interface (G5)
| O quê | Estado |
| --- | --- |
| Fonte com acentos do português | ✅ pixel art (G5, parte 1): `art/font.ts`, desenhada por código e montada em TrueType no jogo; títulos, números, rótulos, botões e os nomes do mapa |
| Molduras, botões e painéis (React) | ✅ pixel art (G5, parte 2): `art/frames.ts`; madeira nos painéis e no menu, ferro no HUD, pergaminho no diário, botões em cinco tons |
| Ícones (tropas, bens, construções, ordens, formações, tempo e sinais do texto) | ✅ pixel art (G5, parte 3): `art/iconArt.ts` e `art/icons.ts`; 12 px na linha do texto, 24 px nos botões e nas listas |
| Retratos do Comandante, dos capitães, dos tenentes e dos nobres | ✅ pixel art (G5, parte 4): `art/portraits.ts` e `art/portraitSpecs.ts`; busto de 32×32 com a cultura, a idade, as cicatrizes e o papel; 32 px nas listas, 64 px nas fichas e no HUD |
| Mapa do Continente e Mapa Múndi | greybox |

## O que falta, por etapa
1. **G1, acabamento ✅ OK** (chefes no dobro, corpos no chão, escala inteira da tela e, no G4, o cavalo de frente e de costas). Ficou para depois: o estandarte e o nome do batalhão ainda são greybox (ficam para o G5, com a fonte).
2. **G2, chão ✅ OK.** Ficou para depois:
   - a água só se mexe de perto (100% e 200%), e não há onda que corre na praia;
   - o chão comum de baixo ainda é pintado na linha principal (barato agora: 1,5 ms por pedaço na mediana).
3. **G3, construções ✅ OK.** Ficou para depois:
   - as peças das construções novas do Marco 22 (cerca de 50, no catálogo da [GDD, seção 9.5](GDD.md#95-o-catálogo)), feitas junto com cada parte dele. A muralha da fortaleza e a cidade do bando saem das peças que já existem;
   - a chama da fogueira e o brilho da forja: feitos no G6, parte 1.
4. **G4, resto do elenco ✅ OK,** em seis partes: carroças, aríetes e escadas; a coluna das expedições e do comboio; harpias, navios e convés; a gente do mapa e do acampamento; os interiores e a Cidade Alta; e o acabamento do G1 (o cavalo de frente e de costas).
   - As carroças vieram primeiro: com as rações refeitas, elas saem num comboio pelo mapa, e o Marco 22 carrega as construções nelas.
   - A ordem entre as etapas de arte e os marcos está na [fila da Fase 3](ROADMAP_FASE_3.md#a-fila).
5. **G5, interface ✅ OK,** em quatro partes: a fonte, as molduras e os botões, os ícones e os retratos.
6. **G6, atmosfera:** noite, tochas, clima e efeitos (flechas, golpes, poeira da investida, sangue). Em quatro partes:
   - a parte 1, a noite e o fogo, está feita;
   - a parte 2, o clima, está feita;
   - a parte 3, os efeitos de combate, está feita;
   - a parte 4, o que a magia mexe, está feita: nevoeiro, fogo apagado, gelo e fogo ligam e desligam num lugar ✅ OK.
