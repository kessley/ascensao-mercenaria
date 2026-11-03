# Arte: o que existe e o que falta

Inventário de tudo o que aparece na tela, com o estado de cada coisa: **pixel art** (já convertido) ou **greybox** (formas de código, como era). Por que pixel art, perspectiva e etapas: [PLANO_GRAFICO.md](PLANO_GRAFICO.md). Etapas no roadmap: [Fase 3](ROADMAP_FASE_3.md).

**Resumo:** etapas G0 (prova), G1 (figuras em campo) e G3 (construções) ✅ OK; G2 (chão) em andamento. Todo soldado, inimigo e bicho que luta já é pixel art; de perto (zoom de 100% e 200%) o chão também; as construções também: povoados, muralhas e acampamento do bando nas 4 culturas, os locais de contrato e os covis das calamidades. Árvores, interiores, interface e efeitos ainda são greybox.

## Como a arte é feita
- **Por código, em camadas** (`src/game/art/`). Nenhuma imagem é carregada: as folhas são desenhadas na primeira vez que alguém veste aquele visual e guardadas como textura.
  - `pixel.ts`: grade de cores, retângulos, linhas, elipses, contorno automático de 1 px, sombra no chão e a ampliação dos chefes (Scale2x com luz na borda).
  - `figures.ts`: monta a figura a partir de um `Look` (corpo, cabeça, armadura, arma, escudo, montaria, cor da tropa, friso, capa e escala).
  - `looks.ts`: o `Look` de cada tropa do jogador, de cada inimigo, do Comandante, do batedor e do mensageiro.
  - `atlas.ts`: cria as texturas (filtro "mais próximo" em cada uma) e escolhe o nível de detalhe pelo zoom.
  - `corpses.ts`: os corpos que ficam no chão.
  - `ground.ts`: o filtro que passa o chão pintado para pixel art.
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

### Chão de perto (G2)
- **Quando:** no zoom de 100% e 200%. De longe (25% e 50%) o chão é o de antes, sem custo novo.
- **Como:** o chão é repintado em pedaços de 400×400 px, 1 px por px de mundo (a mesma densidade das figuras), e passa pelo filtro de `ground.ts`:
  - cada ponto vira um material pela cor que o chão já pintava: grama, terra, areia, rocha, neve ou água. A borda entre dois materiais sai serrilhada;
  - manchas grandes, mais claras e mais escuras, com a borda pontilhada;
  - o desenho miúdo do material, espalhado sem repetir: tufos e folhas na grama, pedrinhas na terra, ondas na areia, rachas na pedra, reflexos na água;
  - flores em canteiros, só onde a grama é viçosa. Somem no inverno e são poucas no outono;
  - a grama faz sombra na terra logo abaixo dela, e a água escurece embaixo da margem.
- **Sem emenda:** tudo depende só da posição no mundo, então os pedaços vizinhos se encontram sem costura.
- **Medido** (navegador sem tela, 1920×1080): cerca de 12 ms por pedaço. Pinta no máximo 6 ms por quadro (sempre ao menos um) e guarda 64 pedaços; a tela enche em menos de 30 quadros. Enquanto um pedaço não fica pronto, aparece o chão de longe embaixo.

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
| Carroça de mercador e aríete inimigo | `Enemy` (CART, SIEGE_RAM) | greybox |
| Carroças do bando | `Wagon` | greybox |
| Escadas e aríete do jogador nos cercos | `SiegeWorks` | greybox |
| Harpias | `Harpy` | greybox |
| Coluna de tropas em expedição | `ExpeditionParty` | greybox |

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
| Névoa de guerra | `FogOfWar` | greybox |
| Noite e tochas | `NightLayer` | greybox |
| Chuva, neve e nevoeiro | `WeatherLayer` | greybox |

### Chão (G2)
| O quê | Onde no código | Estado |
| --- | --- | --- |
| 11 biomas | `TerrainMap`, `ground.ts` | de perto, ✅ pixel art (filtro); de longe, greybox |
| Rios, mar e costa | `TerrainMap`, `ground.ts` | de perto, ✅ água com reflexos e margem serrilhada; falta a margem desenhada |
| Vaus e pontes | `TerrainMap` | greybox (formas por cima do chão) |
| Estradas | `TerrainMap` | de perto, ✅ terra com o desenho do filtro |
| Florestas, colinas, pântanos e lama | `TerrainMap` | de perto, o chão das zonas já tem textura; árvores, poças e curvas de nível ainda são formas de greybox |
| Picos das montanhas | `TerrainMap` | greybox |
| Estações (lama, neve, outono) | `TerrainMap`, `ground.ts` | de perto, ✅ a neve vira material próprio e as flores seguem a estação |
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
| Carroças, aríetes, escadas e harpias (ver acima) | greybox |
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
2. **G2, chão (em andamento; feito o filtro de perto).** Falta:
   - árvores, moitas e pedras como sprites, com profundidade (o soldado passa atrás da árvore), no lugar dos círculos das florestas;
   - margem de rio e costa desenhada (autotile só na água) e água que se mexe;
   - vaus, pontes, poças, curvas de nível das colinas e picos em pixel art;
   - o chão de longe (25% e 50%) com o mesmo ar, sem custar mais;
   - medir no mapa inteiro, no acampamento e nos cercos.
3. **G3, construções ✅ OK.** Ficou para depois:
   - as peças das construções novas do Marco 22, quando ele vier;
   - a chama da fogueira e o brilho da forja (G6, com o fogo e a noite).
4. **G4, resto do elenco:** carroças, aríetes, escadas, harpias, navios, convés, interiores e Cidade Alta. Gente do mapa e do acampamento com as figuras do G1.
   - As carroças primeiro: com as rações refeitas, elas saem num comboio pelo mapa (hoje desenhado com a coluna das expedições), e o Marco 22 carrega as construções nelas.
   - A coluna das expedições e do comboio, com o estandarte do capitão à frente (Marco 20).
   - A ordem entre as etapas de arte e os marcos está na [fila da Fase 3](ROADMAP_FASE_3.md#a-fila).
5. **G5, interface:** fonte, molduras, ícones e retratos.
6. **G6, atmosfera:** noite, tochas, clima e efeitos (flechas, golpes, poeira da investida, sangue).
