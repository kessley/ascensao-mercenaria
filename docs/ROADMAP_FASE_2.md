# Roadmap — Fase 2: O mundo que respira

Objetivo da fase: mundos maiores e mais vivos, em que cada sistema (geografia, estações, comércio, reinos) alimenta os outros. Os marcos estão em ordem de dependência.

**Estado:** Marcos 10, 11, 12 e 13 ✅ OK · próximo: Marco 14. **OK** = concluído e jogável em greybox.

Índice e visão geral: [ROADMAP.md](ROADMAP.md) · Fase anterior: [Fase 1 — O bando](ROADMAP_FASE_1.md) · Design: [GDD.md](GDD.md), seção 8 (as regras para os marcos novos estão na 8.1)

---

## Marco 10 — Fundações do mundo grande ✅ OK
**Objetivo:** preparar o motor para mundos muito maiores e campanhas longas, e dar ritmo ao dia. Detalhes no GDD, seções 8.2, 8.5 e 8.15.
- Salvar e carregar, com vários espaços de save e "Continuar" na tela inicial. Autosave diário e ao entrar no acampamento.
- Simulação em níveis: bandos, exércitos e hordas viram agentes abstratos fora da bolha de detalhe.
- Campo em pedaços gerados sob demanda; continente de ≈ 10×8 regiões.
- Horas e ciclo dia/noite, com regras próprias para a noite.
- Desempenho: 60 fps com cerca de 300 entidades na bolha; teste automatizado de salvar e carregar.

**Pronto quando:** um mundo bem maior roda liso; salvar e carregar no meio de uma campanha restaura tudo, inclusive bandos em marcha; e uma emboscada à noite é mais perigosa que de dia.

**Implementado:**
- **Continente 10×8** (32000×19200 px, ≈ 6,7× a área anterior). O gerador cria:
  - 18–24 povoados;
  - 3–4 reinos (capitais a 8000 px umas das outras);
  - 12 locais de contrato (cada tema ao menos 2 vezes);
  - 10 covis e ≈ 550 zonas de terreno.

  Leva menos de 10 ms. Contratos vêm quase sempre dos 6 povoados mais próximos (75%), às vezes de um cliente distante. A calamidade desperta num covil entre 6000 e 14000 px do acampamento, para a ameaça conseguir chegar. Até 6 bandos goblins ao mesmo tempo.
- **Terreno em pedaços** (`TerrainStreamer` em `src/game/world/TerrainMap.ts`):
  - **Carga:** chão e zonas são criados em pedaços de 1600×1600 px quando chegam perto da câmera (1 pedaço de margem) e destruídos além de 2 pedaços. Ficam ≈ 16–21 pedaços em memória.
  - **Desenho:** cada zona tem semente própria e uma camada na ordem da lista, então o desenho é sempre igual e bate com a regra de terreno.
  - **Consulta:** `typeAt` usa um índice em grade (células de 800 px) em vez de testar todas as zonas.
  - **Culling:** estradas, povoados e locais entram no culling da câmera.
- **Bolha de detalhe** (`src/game/systems/Warbands.ts`):
  - **Longe:** fora da bolha o bando é só dados (composição, vida de cada um, posição de marcha, alvo).
  - **Entrada:** a menos de 2400 px de alguém do bando do jogador, vira unidades de verdade com a vida que tinha.
  - **Saída:** além de 3200 px, sem ninguém lutando, volta a ser dados com os sobreviventes.
  - **Abstrato:** saques e defesas continuam valendo para os bandos-dados.

  O terceiro nível (outros continentes, simulação semanal) chega com o Marco 17.
- **Horas e noite** (`src/utils/time.ts`, `TIME` em `constants.ts`). O dia vira na aurora (6h) e a campanha começa às 8h. Fases e regras:
  - **Fases:** aurora 5–7h, dia, crepúsculo 18–20h e noite. A escuridão cresce e diminui em rampas.
  - **Escuridão na tela:** camada escura com luzes (`NightLayer`): tochas do Comandante, dos batalhões e dos mensageiros, a fogueira do acampamento, as janelas dos povoados e o brilho dos covis.
  - **Tochas (tecla T ou botão no relógio):** acesas, a visão cai para 85% e os inimigos percebem o bando de 1,4× mais longe. Apagadas, a visão cai para 60% e os inimigos humanos só percebem o bando a 65% da distância. Goblins e mortos-vivos enxergam no escuro.
  - **Criaturas da noite** (goblins e mortos-vivos): +25% de dano e +10% de velocidade.
  - **Os outros:** andam 15% mais devagar. O cansaço de verdade vem com a fadiga, no Marco 13.
  - **Emboscada noturna:** se o combate começa no escuro com inimigos que apareceram há menos de 4 s, os batalhões pegos de surpresa perdem 20 de moral (nota no relatório).
  - **Descansar até o amanhecer** (botão no relógio, à noite): a noite passa de uma vez, com rações e salários correndo e os bandos marchando. Um bando que chegue a 900 px interrompe o descanso. Não funciona em combate, com motim, com inimigos à vista nem com mensageiros fora.
- **Salvar e carregar** (`src/game/save/saveGame.ts`, botão "Jogo" no HUD e tela inicial):
  - **Espaços:** 3 manuais e 1 automático. O automático grava a cada dia que vira e ao entrar no acampamento, no máximo a cada 15 s.
  - **O que vai no save:** a semente (o mundo é gerado de novo e conferido pelo nome), o estado da campanha e o retrato do campo: Comandante, batalhões, alojamentos, batedores, mensageiros, névoa explorada compactada, bandos e inimigos dos locais com a vida que tinham, e as tochas.
  - **Tamanho:** ≈ 20 KB. Fica no armazenamento local do WebView (no app Tauri, na pasta de dados do app).
  - **Quando não dá para salvar:** em combate ou com mensageiros fora.
  - **Ao carregar:** o Phaser é recriado do zero.
- **Teste automatizado:** 37 verificações. Cobrem o gerador, os pedaços, a bolha, a noite, o descanso e salvar/carregar (ouro, dia, hora, contrato, inimigos feridos, bandos, povoados, posição, névoa).
- **Desempenho medido** (Edge headless):
  - 110–127 fps no acampamento;
  - ≈ 108 fps com 320 inimigos na bolha;
  - ≈ 79 fps em combate com ≈ 300 inimigos ativos;
  - a câmera saltando pelo continente custa até 60 ms em 2 quadros.

## Marco 11 — Geografia real: relevo, rios e mares ✅ OK
**Objetivo:** um terreno que faz sentido e cria decisões táticas e estratégicas. GDD 8.3 e 8.4.
- **Gerador v2:**
  - altitude e clima (temperatura e chuva com sombra de chuva);
  - 11 biomas (montanha, estepe, deserto e tundra são novos);
  - rios por drenagem (riacho, rio, rio grande) e lagos;
  - costa e oceano em volta do continente;
  - recursos por bioma.
- **Montanhas** só se atravessam pelos passos. **Estradas** seguem o menor custo, com pontes e vaus. **Povoados** procuram água, várzea, cruzamentos e foz; os portos ficam inativos até o Marco 17.
- **Regras de rio no Campo:**
  - riacho: atravessa em qualquer ponto;
  - rio: só por vau ou ponte; quem está na água recebe +25% de dano, não usa Parede de Escudos e a cavalaria perde a investida;
  - rio grande: só ponte ou balsa.
- **Pontes** podem ser queimadas e reconstruídas com madeira; o dono cobra pedágio.
- **História simulada:** a crônica passa a sair da própria simulação (`sim/realm.ts`), rodada em passos grossos por 100 a 400 anos. As fronteiras, ruínas e dinastias vêm desse resultado.
- **Novas opções de criação:** tamanho do mundo, idade (jovem, média, antiga) e frequência de calamidades.
- **Mapa do Continente** (antigo Mapa Múndi, no Tab) com relevo sombreado, rios, costa e legenda.

**Pronto quando:** dá para segurar um vau com poucos homens contra muitos; as estradas e povoados fazem sentido no relevo; e a crônica explica as fronteiras e ruínas que aparecem no mapa.

**Implementado:**
- **Geografia** (`src/game/worldgen/geography.ts`, células de 400 px):
  - **Relevo:** ruído fractal com uma máscara de continente deformada e cristas de montanha. A borda é sempre mar (≈ 36% do mapa); 6% da terra é montanha.
  - **Clima:** a temperatura vem da latitude (norte frio) e da altitude. A umidade chega com o vento de oeste e cai ao subir montanhas, deixando sombra de chuva a leste delas.
  - **Biomas:** 11 — mar, costa, campos, floresta, floresta densa, colinas, montanhas, pântano, estepe, deserto e tundra.
  - **Águas:** o enchimento das depressões a partir do mar transforma as fundas em lagos e dá a cada célula o caminho até o mar. A chuva acumulada nesse caminho faz os rios: riacho (até 50 px, raso), rio (≈ 90 px) e rio grande (≈ 160 px). São traçados com meandros e nome próprio, e os afluentes terminam no rio principal.
- **Terreno de jogo** (`TerrainMap` + `src/game/worldgen/geoMap.ts`): quatro tipos novos.
  - **Água funda** (mar, lago, rio) e **montanha** bloqueiam a passagem.
  - **Vau/riacho:**
    - lento e sem investida de cavalaria;
    - quem está na água recebe +25% de dano e causa −20%;
    - sem Parede de Escudos e sem bônus de formação.
  - **Ponte:** a travessia de um rio por cima; quem está nela anda e luta como em terra.

  Os **passos** abertos pelas estradas nas montanhas contam como colina.
- **Navegação** (`src/game/systems/NavGrid.ts`): grade de 80 px com A*. As células são avaliadas só quando alguém precisa delas, e uma célula bloqueia se qualquer das 9 amostras bloquear, então nenhum rio passa entre as amostras. Lama, vau e pântano custam mais; estradas custam menos.
  - **Unidades:** toda unidade segue uma rota quando a linha reta cruza água ou montanha, e na margem desliza em vez de entrar na água. Vale para soldados, inimigos, batedores, mensageiros e o Comandante (clique ou WASD).
  - **Bandos e viagem rápida:** bandos abstratos, exércitos e hordas marcham por rotas em terra. A viagem rápida segue a rota (os dias contam o caminho de verdade) e recusa destinos sem caminho.
- **Gerador v2** (`generateWorld.ts`):
  - **Acampamento:** em terra temperada, perto do meio do continente.
  - **Povoados:** na maior massa de terra, com área livre de água e rio, preferindo terra fértil, beira de rio e costa. Cidades fora das capitais, portos (⚓, ainda sem uso até o Marco 17) e povoados ribeirinhos ganham descrição própria.
  - **Locais e covis:** o vau do pântano procura um rio; os covis, colinas e matas.
  - **Zonas de superfície:** seguem o bioma do lugar.
  - **Estradas:** A* de menor custo (rio caro, montanha muito cara, mar proibido, estrada já aberta mais barata), em curvas suaves. Onde cruzam um rio nasce uma **ponte** (em estradas secundárias, às vezes um **vau**); onde cruzam montanha nasce um **passo**. Há **vaus naturais** ao longo dos rios médios a cada ≈ 3200 px; os rios grandes só se atravessam por ponte.
- **Pontes**:
  - **Interação:** são lugares do mapa (E). Queimar a ponte faz dela água, refaz as rotas de todos e tira 15 de relação com o reino que a controla (o dono do povoado mais próximo, até 4000 px). Reconstruir custa 150 de ouro em madeira.
  - **Pedágio:** cruzar a ponte de outro custa 6 de ouro (sem ouro, o bando passa à força e o dono não gosta); não há cobrança em guerra. Cada ponte do bando rende 12 de ouro por semana.
- **História simulada** (`src/game/worldgen/history.ts`): séculos de mundo em passos de 5 anos, com regras próprias e simplificadas (não as do `sim/realm.ts`).
  - Povoados são fundados e reinos juram aldeias livres por perto.
  - Há guerras de fronteira: o mais forte toma o povoado mais próximo, e a capital cai por último, levando o reino junto.
  - Reis morrem e são sucedidos.
  - Calamidades antigas arrasam regiões; algumas ruínas são reerguidas.

  Os reinos sobreviventes viram as facções da campanha. As fronteiras, as ruínas e os nomes dos reinos extintos na crônica saem desse resultado.
- **Opções de criação:**
  - **Tamanho:** pequeno 7×6, médio 10×8 ou grande 13×10 regiões; o número de povoados, locais e covis acompanha a área.
  - **Idade:** jovem (120 anos), média (250) ou antiga (400). Mais idade traz mais reinos no começo da história, mais guerras e uma segunda calamidade antiga.
  - **Calamidades:** raras (×1,8 no tempo de espera), normais ou frequentes (×0,6).

  O save guarda as opções (formato versão 2: saves do Marco 10 não carregam).
- **Chão e mapa:**
  - **No campo:** cada pedaço do chão é uma textura de canvas com a cor do bioma (misturada entre células), relevo sombreado, praia, rocha e neve, mar com profundidade, rios com margem, vaus com pedras, pontes de tábuas (ou os pilares queimados), estradas, picos nas montanhas e as zonas de superfície.
  - **Mapa do Continente** (antigo Mapa Múndi, no Tab): o mesmo relevo em miniatura, com rios, estradas, pontes, vaus e portos.
  - **Na tela de criação:** um resumo da geografia (biomas, rios, pontes, vaus, portos e ruínas).
- **Segurar o vau** (teste): 16 soldados na saída de um vau derrotaram 24 goblins perdendo 6. Em campo aberto, a mesma tropa foi aniquilada depois de abater 14.
- **Desempenho:**
  - mundo gerado em 16–57 ms;
  - 144–159 fps no acampamento;
  - 126–140 fps com 300 inimigos;
  - a câmera saltando pelo continente custa até ≈ 65 ms em 2 quadros.

  Teste automatizado com 22 verificações; os testes dos Marcos 9 e 10 continuam passando.
- **Ficou de fora (resolvido no fechamento do Marco 12):**
  - **Balsas nos rios grandes:** uma a cada ≈ 6500 px de rio, longe das pontes, com cais nas duas margens.
    - **Interação:** "Balsa do X". O barqueiro leva o exército inteiro ao outro cais por 15 de ouro e 0,1 dia.
    - **Uso:** bandos e a viagem rápida não usam balsas.
    - **Mapa:** aparecem no chão e no Mapa do Continente.
  - **Recursos por bioma** (`src/game/worldgen/resources.ts`): até três por povoado, pelo que há em volta.
    - **De onde vêm:** grão, peixe, madeira, pedra, ferro, sal, peles, cavalos, ervas.
    - **Mercado:** barateiam o mercado local (comida farta, ferro de mina).
    - **Renda:** rendem por semana para o dono (ex.: ferro +3, grão +8 rações, sal +10 ouro).
    - **Onde aparecem:** no painel do povoado e na tela de criação. Os bens e as cadeias de produção continuam no Marco 14.

## Marco 12 — Mundo vivo: gente andando ✅ OK
**Objetivo:** o jogador entende o estado do bando e do mundo só de olhar. GDD 8.7.
- **Soldados com rotina** no acampamento (dormir, comer, treinar, jogar dados, fila do pagamento, cuidar dos cavalos). O comportamento mostra fome, moral baixa, salário atrasado (**o motim dá sinais antes de estourar**) e a festa depois de uma vitória.
- **Seguidores do acampamento** (cozinheiro, mascate, curandeira, capelão, famílias): têm serviços, consomem rações e correm risco quando o acampamento fica sem guarda.
- **Tenentes andando pelo acampamento**, com relações entre eles (amizade e rivalidade) e eventos de briga e camaradagem.
- **Eventos com escolha** no acampamento (2 ou 3 respostas, efeito na moral, na lealdade e na honra).
- **Gente de passagem**, só nos pedaços visíveis e com objetos reaproveitados: camponeses, viajantes, peregrinos, caçadores e animais. Moradores e guardas nos povoados, em número conforme a prosperidade.
- **Agentes reais:** patrulhas dos reinos (caçam bandos de verdade), mensageiros dos reinos (interceptáveis) e refugiados fugindo das calamidades.
- **Sinais:** camponeses fugindo, fumaça de saque visível de longe, rastros de exército e corvos sobre campos de batalha.

**Pronto quando:** dá para perceber fome, moral baixa e motim chegando só olhando o acampamento; e os sinais no mapa revelam onde está o perigo antes de o inimigo aparecer.

**Pedido junto com o marco:** cidades e vilas maiores, com espaço para a vida e muros de verdade; um mapa ainda maior para comportá-las; e o relógio rebalanceado para o mapa maior.

**Implementado:**
- **Mapa 1,5× maior:**
  - As regiões passaram de 3200×2400 para 4800×3600 px; o continente médio tem 48000×28800 px, ≈ 2,25× a área. A geografia usa células de 600 px, então o mesmo relevo fica maior.
  - Distâncias mínimas do gerador escaladas: povoados a ≥ 4200 px, locais a ≥ 2900 px dos povoados, covis a ≥ 3000 px. As zonas de superfície ficaram maiores.
- **Relógio rebalanceado** (`WORLD` em `constants.ts`). Ver o GDD, seção 2.
  - **Marcha:** 14400 px por dia, ou seja, 3 regiões (antes era 1). No passo da infantaria, o dia dura ≈ 1,5 min e a noite ≈ 30 s (antes, 15 s de dia). Parado no campo, o dia dura 6 min.
  - **Dentro das muralhas** só corre o relógio de quem está parado: passear numa cidade grande não queima o dia.
  - **Ritmo do mundo:** com dias mais longos em tempo real, os ritmos ficaram mais rápidos.
    - goblins a cada 2 dias;
    - exércitos a cada 5;
    - hordas a cada 3;
    - calamidade entre os dias 8 e 12 e força +1 a cada 2 dias;
    - prazo de contrato com 3 dias de folga.
  - **Rações:** 1 a cada 3 soldados por dia (antes, a cada 4), para a economia seguir apertada.
- **Cidades de verdade** (`src/game/world/townLayout.ts`, planta pura e determinística):
  - **Tamanhos:**
    - aldeia: 1400×1100, com paliçada e portões norte e sul;
    - cidade: 2600×2100, com muralha de pedra, torres a cada ≈ 640 px e portões nos quatro lados;
    - fortaleza: 1800×1600, com muralha grossa e torres maiores.
  - **Dentro:** rua de ronda junto ao muro, ruas em grade e quarteirões de casas em duas fileiras, com as portas voltadas para a rua. No centro, a praça do mercado com barracas e poço; há também paço, castelo ou Casa do Conselho, templo nas cidades e lavouras fora dos muros.
  - **Colisão:** muralha e construções bloqueiam (tipos `WALL` e `BUILDING`); só se entra pelos portões. Tropas, bandos e a viagem rápida chegam por eles, e as estradas do gerador terminam no portão voltado para o destino.
  - **Ruínas:** muros com brechas e 60% das casas em entulho. Reconstruir fecha as brechas.
  - **Interações:** o Mercado (praça), a Sala de Administração / Paço / Casa do Conselho (porta do paço) e a Guarnição (um acampamento por portão).
  - **À noite:** luz na praça, nos portões e em algumas janelas.
  - **Fundar aldeia:** a planta inteira precisa caber em terra firme, à frente do Comandante. Quem estiver dentro de uma parede nova é posto na rua.
- **Guarnições e portões** (pedidos junto com o marco: os soldados das cidades existem nelas, de verdade, e o exército do bando não entra):
  - **Acampamentos da guarnição dentro das cidades:**
    - **Onde ficam:** no quarteirão ao lado da rua de cada portão, por dentro dos muros (no lado sem paço, templo ou praça; as casas daquele canto dão lugar a ele).
    - **O que tem:**
      - pátio de terra batida com cerca de estacas aberta para a rua;
      - barracas listradas com cordas e espeques;
      - fogueira com lenha, armeiro com lanças e escudos;
      - bonecos de treino, barris e a bandeira do dono.
  - **Soldados de verdade** (`src/game/world/Garrisons.ts`): perto do bando, cada homem da guarnição é uma unidade do mundo (até 30 por povoado). Longe, volta a ser um número.
    - **Papéis:**
      - sentinelas do lado de fora dos portões;
      - um vigia na fogueira;
      - **rondas pelas ruas**, de cruzamento em cruzamento, também à noite, com tocha;
      - o resto no acampamento: treino de manhã, conversa no pátio e sono diante das barracas à noite.
    - **Perigo perto:** a tropa forma atrás do portão.
    - **Mortes e reforço:** cada soldado que morre sai da guarnição; reforço novo sai de uma barraca.
    - **Aparência:** a guarnição do bando é aliada, desenhada em círculos azuis.
  - **Lados do mundo:** guarnições, patrulhas e exércitos dos reinos (o povoado) lutam de verdade contra goblins e hordas (os selvagens) quando se encontram.
    - **A guarnição do bando:** também enfrenta quem for hostil ao bando.
    - **Em paz:** os guardas não atacam o bando. Bater num deles é atacar o povoado: guerra e cerco.
  - **Reposição:** os reinos e as aldeias livres repõem 1 homem por semana até a guarnição de origem (aldeia 6, cidade 14, fortaleza 20).
  - **O exército do bando não entra em povoado alheio:** só nos do bando e nas ruínas.
    - **No passo:** o soldado para no vão do portão.
    - **Nas rotas:** as tropas usam uma grade de navegação própria, em que esses povoados são muro.
    - **Ordem de marcha para dentro:** vira "esperar no portão", com aviso.
    - **Comandante dentro:** se ele entra, quem o segue espera diante do portão até ele sair.
    - **Viagem rápida:** termina diante do portão.
  - **O Comandante entra sozinho:** também os batedores e mensageiros. Em guerra, sob calamidade ou durante um cerco, os portões fecham para todo o bando.
  - **Atacar:** é feito pelo portão ("E — Portão de X"), do lado de fora, onde o exército está.
    - **Defensores:** a própria guarnição. Abaixo de 5 homens, moradores armados completam a defesa.
    - **Em guerra:** chegar a menos de 800 px dos muros já começa o cerco.
    - **Cerco levantado:** afastar-se mais de 2600 px levanta o cerco. Os mortos fazem falta na guarnição.
- **Vida no acampamento** (`src/game/world/CampLife.ts`):
  - **Colisão:** a paliçada, as barracas, a fogueira e as estruturas bloqueiam todo mundo (soldados, inimigos, cavaleiros), não só o Comandante.
  - **Enfeites:** torres de vigia no portão, poço, lenha, barris, feno, tochas nos caminhos (acesas à noite), estandartes e o chão com manchas e capim.
  - **Treino de verdade:** o Campo de Treino manda batalhões treinar por 2 dias.
    - **No campo:** eles vão até lá e treinam (fileiras diante dos bonecos, duelos de pares).
    - **Ficam no acampamento:** não saem com o Comandante.
    - **Tempo:** enquanto alguém treina, o tempo corre no acampamento, um dia a cada 90 s. Dá para "esperar o treino terminar" de uma vez ou interromper.
    - **Recompensa:** o XP vem no fim.
  - **Rotina:** os soldados de verdade dos batalhões que descansam deixam a formação. Dormem na barraca à noite, comem na fogueira na hora das refeições, treinam, jogam dados, fazem tarefas, cuidam dos cavalos (cavalaria) e passeiam; um faz sentinela no portão, com tocha à noite.
  - **O estado do bando aparece no próprio acampamento:**
    - fome: fila na Intendência e gente sentada;
    - moral baixa: rodas caladas;
    - salário atrasado: rodinhas cochichando;
    - motim prestes a estourar: o batalhão rebelado em meia-lua diante da tenda do Comandante, gritando "SOLDO!";
    - vitória recente: roda de dança em volta da fogueira.
  - **Balões** sobre as cabeças: "fome!", "e o soldo?", "!!", "♪", "z".
  - **Reação:** uma mudança de estado faz todos largarem o que faziam em até 1,5 s. Inimigo perto: largam tudo e lutam.
- **Seguidores do acampamento** (`src/game/sim/campEvents.ts`). Chegam pedindo para seguir o bando (evento no portão), andam pelo acampamento e cada um come rações:
  - cozinheiro: −20% de rações;
  - mascate: +25% no ouro do saque;
  - curandeira: salva 1 em cada 3 caídos depois do combate;
  - capelão: +10 na moral inicial;
  - famílias: deserções pela metade.

  Vão embora com 2 dias de fome; num ataque ao acampamento sem guarda, um deles pode morrer. Painel na Tenda, com "Dispensar".
- **Relações entre tenentes:**
  - **Convivência:** a cada dia os traços aproximam ou afastam cada par (ex.: Honrado × Sanguinário −3/dia; Corajoso × Sanguinário +2/dia), com um pouco de acaso. Vitória lado a lado dá +4.
  - **Limiares:** amizade a partir de +40, rivalidade a partir de −40.
  - **No acampamento:** amigos se visitam.
  - **Na ficha do tenente:** uma lista de relações.
- **Eventos com escolha** (janela que pausa o mundo). Podem acontecer ao entrar no acampamento ou ao descansar nele, no máximo 1 a cada 2 dias. São 10 tipos que reagem ao estado:
  - ladrão de rações;
  - disputa pela barraca;
  - desertor arrependido;
  - briga de tenentes rivais;
  - histórias de tenentes amigos;
  - festa da vitória;
  - seguidor no portão;
  - peregrinos;
  - rodinhas do soldo (o aviso de motim, com 3 saídas);
  - barrigas vazias.

  As escolhas mexem no **humor do acampamento** (−30..+30, soma na moral inicial e volta devagar ao normal), na **honra** (0–100, que ganha peso no Marco 15), na lealdade, no ouro, nas rações, na dívida e nos soldados.
- **Mapa vivo** (`src/game/world/MapLife.ts`, só perto da câmera, um desenho por quadro, até 140 figuras):
  - **Moradores:** andam pelas ruas, vão à praça e entram em casa. A quantidade segue a população e a prosperidade; à noite quase ninguém; povoado saqueado ou em ruínas, ninguém.
  - **Caçadores** saem do povoado mais perto atrás de um cervo, abatem um (a manada dispara) e voltam com a caça nas costas.
  - **Camponeses** trabalham nas lavouras.
  - **Viajantes e peregrinos** andam pelas estradas, com lanterna à noite, e dão meia-volta diante de um bando.
  - **Cervos** pastam e fogem.
  - Nada surge diante dos olhos do jogador: as figuras aparecem onde a névoa não deixa ver.
- **Sinais:**
  - **Perigo:** com um bando hostil a menos de 2600 px, camponeses correm para dentro dos muros e moradores entram em casa.
  - **Fumaça:** sobre povoados saqueados (2 dias), ocupados ou em ruínas, desenhada acima da névoa. Se o povoado estiver fora da tela mas a até 7000 px, a fumaça aparece na borda, na direção dele.
  - **Corvos** circulando sobre campos de batalha recentes e povoados saqueados.
  - **Rastros:** pegadas da marcha de cada bando, que se apagam em 1,5 dia.
- **Agentes reais** (em `Warbands`):
  - **Patrulhas dos reinos:** 1 a cada 4 povoados, no máximo 2 por reino. Andam entre os povoados do reino e **caçam bandos** goblins e hordas a até 4200 px. O encontro é resolvido pela força (o vencedor perde gente na proporção da força do outro), com notícia e corvos.
  - **Mensageiros reais:** cavalgam 3× mais rápido entre os povoados do reino. **Interceptar** um rende 25 de ouro e os despachos: povoados, guarnição, data do próximo exército e os exércitos do reino no mapa. Se o reino estiver em paz, custa −8 de relação.
  - **Refugiados:** fogem de um povoado saqueado, ocupado ou arruinado até o povoado de pé mais perto. Um bando hostil que os alcance os massacra.
  - **Neutros:** patrulhas e mensageiros de reinos em paz e refugiados não atacam e não entram em combate nem nos alvos automáticos. Dá para atacá-los clicando neles, mas **provocar** uma patrulha ou um mensageiro custa −15 de relação (pode virar guerra), e atacar refugiados custa −6 de honra.
  - **No Mapa do Continente:** neutros em cinza-azulado, refugiados em bege.
- **Save:**
  - **Versão 3:** porque o mundo mudou de escala. Guarda honra, humor, seguidores, relações, campos de batalha e quem foi provocado.
  - **Versão 4:** com os acampamentos da guarnição, as estradas mudaram.
  - **Versão 5:** acampamentos dentro das cidades, balsas e recursos mudam o mundo gerado. Treinos em andamento vão no save; guarnições e lobos não (reaparecem quando o bando chega perto).
- **Teste automatizado:**
  - 25 verificações do marco;
  - 23 das guarnições e dos portões;
  - um teste do fechamento: guarnição real, rondas, guardas × goblins, patrulha × goblins, colisão do acampamento, treino, seguidores, lobos, balsa e recursos;
  - os testes dos Marcos 9, 10 e 11 continuam passando, com as expectativas de escala atualizadas.
- **Desempenho:**
  - ≈ 150 fps no acampamento com a rotina;
  - ≈ 165 fps dentro de uma cidade com ≈ 50 figuras;
  - todas as praças alcançáveis pelos portões em ≈ 0,2 s.
- **Ficou de fora → resolvido no fechamento:**
  - **Lobos** (`src/game/world/Wildlife.ts`): alcateias de 3 a 5 aparecem fora de vista no mato, na tundra e nas colinas, longe de povoados, perto de quem anda sozinho (mais de noite).
    - **Ataque:** atacam batedores, mensageiros ou o Comandante sem escolta.
    - **Fuga:** diante de 3 do bando, fogem e somem.
    - **Peles:** cada lobo abatido rende 4 de ouro.
  - **Caçadores:** ver "Mapa vivo".
  - **Seguidores trabalham de verdade:** cada um tem a sua estação.
    - **Cozinheiro:** caldeirão com trempe. Mexe a panela nas refeições, quando os soldados fazem fila, e busca lenha no resto do dia.
    - **Mascate:** banca com toldo, onde os soldados vão olhar.
    - **Curandeira:** enfermaria. Depois de um combate, os feridos ficam deitados nas esteiras e ela passa de um em um.
    - **Capelão:** púlpito. Faz o sermão às 9h e às 17h, com a meia-lua de soldados.
    - **Famílias:** varal com roupa estendida.
  - **Patrulhas à vista lutam de verdade:** quando patrulha e bando estão os dois no mapa, a luta é soldado contra soldado; a resolução abstrata fica só para quando estão longe.
- **Ficou de fora → resolvido depois do Marco 13** (itens da seção 8.7 do GDD que faltavam):
  - **Fila do pagamento:** no dia do soldo, com o pagamento em dia, das 8h às 13h, os soldados fazem fila diante da tenda do Comandante, com o balão "soldo!".
  - **Ferro para a Ferraria:** com ferro no depósito, soldados vão à Intendência, pegam barras de ferro (visíveis nas costas) e as levam até a Ferraria.
  - **Ajudante de ferreiro** (seguidor novo): a Ferraria gasta 25% menos ouro e ferro.
    - **No acampamento:** tem uma bigorna perto da Ferraria, martela nela e às vezes busca ferro na Intendência.
  - **Seguidores crescem com o bando:** o limite sobe com o número de soldados e com a fama (inimigos abatidos pelos batalhões), até 12 seguidores. As famílias vão até 4, uma a cada 12 soldados.
    - **Mais procura:** quanto mais vaga, mais seguidores aparecem no portão.
    - **Na Tenda:** o painel de seguidores mostra o limite.
  - **O mascate vende** na banca dele ("E — Banca do mascate"):
    - barril de vinho: humor +8;
    - ataduras: 3 feridos voltam na hora;
    - cobertores de lã: por 20 dias o frio do inverno não adoece a tropa.
  - **Guardas na muralha:** em metade dos portões, o 3º soldado da guarnição anda o caminho de ronda junto ao muro, de canto a canto, olhando para fora, com tocha à noite.
  - **Rastros na lama e na neve:** na primavera, no inverno e na chuva, onde o chão é mole, as pegadas dos bandos duram o dobro.
  - **Teste automatizado:** 10 verificações.
  - **Para outros marcos:** caravanas (Marco 14) e exércitos de lordes (Marco 15), que o GDD lista entre os agentes do mundo vivo.

## Marco 13 — Estações, clima e logística ✅ OK
**Objetivo:** o tempo e o abastecimento passam a pesar no plano de campanha. GDD 8.5 e 8.6.
- **Calendário** de 4 estações (ex.: 20 dias cada): lama e cheias na primavera, temporada de campanha no verão, colheita e feiras no outono, neve, frio e rios congelados no inverno.
- **Clima diário por região:** chuva (arqueiros −25% de alcance), nevoeiro (visão −50%) e neve.
- **Fadiga por batalhão** e marcha forçada.
- **Trem de carroças físico**, com capacidade; carroças são alvo de bandos. **Forragear**, com esgotamento da região.
- **Feridos em vez de só mortos** (Enfermaria, curandeira) e **doenças** que se espalham.
- **Acampamento móvel:** levantar e remontar o acampamento em outro lugar. Fortificações para o acampamento fixo.
- **A IA obedece às estações:** os reinos vão para os quartéis de inverno; os mortos-vivos não.

**Pronto quando:** o inverno muda o plano do jogador (parar, se preparar ou aproveitar a guerra parada), e perder as carroças numa emboscada vira uma crise de verdade.

**Implementado:**
- **Calendário** (`src/utils/season.ts`, `SEASONS` em `constants.ts`): 4 estações de 20 dias (o ano tem 80). A campanha começa no 11º dia da primavera, com a cheia já passada. O relógio mostra a estação e o dia dela (passar o mouse mostra o ano e quantos dias faltam).
  - **Primavera:**
    - fora das estradas, o chão vira lama (−20% de velocidade);
    - **cheia** nos 6 primeiros dias: os vaus dos rios ficam fundos e o rio só se cruza por ponte (os riachos continuam rasos).
  - **Verão:** temporada de campanha. Os reinos em guerra mandam exércitos com mais frequência (intervalo ×0,6) e a mesa da Tenda tem um contrato a mais.
  - **Outono:**
    - **colheita:** a comida custa 30% menos nos mercados;
    - renda semanal dos povoados do bando com +50% de rações e +20% de ouro (impostos rurais);
    - **feiras:** toda semana a prosperidade de todo povoado sobe.
  - **Inverno:**
    - **neve** onde é frio (norte e montanhas): −40% de velocidade fora da estrada, −15% nela;
    - **rios e lagos do frio congelam** e viram gelo, que se atravessa em qualquer ponto;
    - **gelo fino:** perto do limite do frio, cavaleiros e carroças às vezes afundam ("o gelo cedeu!", 60% da vida);
    - um contrato a menos na mesa.
  - **No chão:** o desenho muda com a estação: neve por cima do norte e das montanhas, rios e lagos congelados em azul-claro, vaus afogados na cheia, matas e campos amarelados no outono. A troca de estação redesenha o chão, refaz as rotas e tira de dentro da água quem estava no gelo no degelo.
  - **Simetria:** lama e neve valem para todos, inimigos e bandos em marcha no mapa inclusive.
- **Clima diário por região:** céu limpo, chuva, nevoeiro ou neve, sorteado por célula de 2×2 regiões a partir da semente e do dia.
  - **Por lugar:** o mesmo lugar no mesmo dia tem sempre o mesmo tempo, então ele não vai no save. Lugares diferentes têm tempos diferentes.
  - **Por estação e bioma:** a primavera e o outono são mais chuvosos; o deserto e a estepe quase não têm chuva; pântano e costa têm mais nevoeiro; no frio do inverno chove neve.
  - **Chuva:** arcos e bestas alcançam −25% e o chão fora da estrada fica mais lento (−10%).
  - **Nevoeiro:** a visão do bando cai pela metade e os inimigos também percebem o bando pela metade da distância (bom para emboscadas).
  - **Neve:** visão −25%.
  - **Na tela:** riscos de chuva, flocos de neve, véu de nevoeiro. O Mapa do Continente mostra o tempo de cada região já vista.
  - **Previsão:** um tenente **Cauteloso** prevê o tempo de amanhã (ícone ao lado do de hoje).
- **Fadiga por batalhão** (0–100, `FATIGUE`):
  - **Marcha:** um dia inteiro cansa 28. A marcha noturna cansa o dobro; terreno ruim (lama, pântano, mata, vau, gelo, neve) cansa 1,5×.
  - **Combate:** lutar cansa.
  - **Recuperação:** parado ao relento, 60 por dia de relógio; nos alojamentos, depressa. Descansar até o amanhecer tira 45 ao relento e tudo no acampamento.
  - **Efeitos:** a partir de 40 o batalhão fica mais lento (até −30% aos 100); causa até −25% de dano; a moral volta até 60% mais devagar. Acima de 80, "exausto" no HUD.
  - **Viagem rápida:** a tropa cansada leva mais dias, e a marcha conta na fadiga.
  - **Marcha forçada** (tecla V ou botão na barra de baixo):
    - **Ganho:** o dia rende 35% mais caminho e a tropa anda 20% mais depressa fora de combate.
    - **Custo:** cansa 2,5×.
    - **Viagem rápida:** também vale nela.
- **Trem de carroças** (`src/game/entities/Wagon.ts`):
  - **Começo:** duas carroças. Compram-se mais na Intendência (60 de ouro; até 6).
  - **Capacidade:** cada uma leva 60 rações, mais 20 nas mochilas da tropa.
  - **Depósito × carga:** as rações do bando ficam no depósito do acampamento. Ao sair, as carroças carregam o que cabe, deixando 3 dias de reserva para quem fica (seguidores e quem treina). Ao voltar, descarregam e são consertadas.
  - **Em campo:** o exército come só o que as carroças levam. Carroças vazias significam fome, mesmo com o depósito cheio. O HUD mostra a carga, a capacidade e quantos dias de comida restam.
  - **Compras:** o que se compra num mercado em campo vai para as carroças, até onde couber.
  - **Movimento:** são unidades de verdade no fim da coluna. Atolam na lama, no pântano, na mata, no vau e na neve. Esperam no portão com a tropa e ficam com ela se o Comandante sair sozinho.
  - **Alvo:** goblins e saqueadores preferem atacá-las. Uma carroça destruída leva junto a parte da carga que cabia nela, e isso vai para o relatório e o diário.
- **Forragear** (tecla G ou botão):
  - **Tempo:** um quarto de dia ao relento; um bando que chegue perto interrompe.
  - **Rendimento:** conforme o número de soldados, a estação (inverno ×0,2, outono ×1,3) e o bioma (deserto, tundra e montanha rendem pouco). Vai para as carroças.
  - **Esgotamento:** cada forragem esgota a região (−40%), que se recupera 3% por dia.
  - **Dono:** forragear perto dos povoados de um reino em paz irrita o reino (−4 de relação).
- **Feridos em vez de só mortos** (`src/game/sim/logistics.ts`):
  - **No combate:** dos que caem num batalhão que sobrevive, 40% ficam feridos (55% com a curandeira, que substitui o antigo "salva 1 em 3"). O relatório mostra mortos e feridos. Batalhão dizimado perde os feridos também (permadeath).
  - **Recuperação:** feridos não lutam, mas comem. Por dia, na enfermaria do acampamento, 30% voltam e 2% morrem; em campo, 12% voltam e 8% morrem. A curandeira melhora as duas coisas.
  - **Onde aparecem:** nas esteiras da enfermaria, no cartão do batalhão e na Tenda.
- **Doenças:**
  - **Causas de surto, por batalhão e por dia:**
    - acampar no pântano;
    - fome;
    - frio do inverno ao relento;
    - estar perto de um povoado com febre;
    - acampamento lotado (mais de 60 soldados).
  - **Doentes:** não lutam, saram ou morrem (mais devagar em campo) e passam a doença aos companheiros e aos outros batalhões no mesmo lugar. Há dois tipos, disenteria e febre.
  - **Povoados:** a febre num povoado dura 10 dias. Ali o comércio para e a comida encarece. Toda semana ela pode passar ao vizinho pela estrada (mais no inverno), com notícia no diário.
- **Acampamento móvel** (Tenda → Acampamento):
  - **Levantar** leva 1,5 dia. As obras se perdem, o depósito inteiro vai nas carroças e a coluna marcha 15% mais devagar. Não há mais acampamento para ser saqueado.
  - **Montar aqui** (botão no painel do Comandante) leva 1 dia. Precisa de terra firme longe de povoados e locais; o acampamento nasce a leste do Comandante, com o portão virado para ele. O lugar novo vai no save (`campAt`).
- **Obras do acampamento fixo:**
  - **Paliçada reforçada:** estacas grossas com escora de terra.
  - **Torres de vigia:** três torres que enxergam longe em volta do acampamento.
  - **Fosso:** lama funda em volta da paliçada; só o portão fica firme.

  Cada obra segura parte do saque quando o acampamento é atacado sem guarda (35%, 25% e 25%).
- **A IA obedece às estações:**
  - **Reinos no inverno:** não põem exércitos em marcha. Os exércitos já na estrada voltam ao povoado mais próximo do reino e viram guarnição (**quartéis de inverno**), com notícia no diário.
  - **Também no inverno:** patrulhas novas não saem e as escaramuças de fronteira entre os reinos param.
  - **Goblins:** saem dos covis com metade da frequência.
  - **Hordas:** a dos orcs se arrasta (intervalo ×1,5); os mortos-vivos não sentem frio.
- **Save versão 6:** guarda carroças, carga, depósito, exposição, forragem, acampamento movido e obras. O campo guarda a posição e a vida das carroças, a fadiga e a marcha forçada.
- **Teste automatizado:** 39 verificações do marco. Os testes dos Marcos 9 a 12 continuam passando. A expectativa da curandeira foi atualizada para a regra dos feridos, e a contagem de goblins mortos no teste do Marco 12 foi corrigida.
- **Desempenho:** ≈ 125 fps no inverno com neve caindo e 140 fps no acampamento.
- **Ficou de fora:** barcaças e portos em uso (Marcos 14 e 17); a carga comercial nas carroças (Marco 14); tempestade no mar (Marco 17).

## Marco 14 — Economia e comércio
**Objetivo:** a economia vira um sistema vivo que o jogador lê, explora e perturba. GDD 8.8.
- **Cerca de 10 bens**, com produção e consumo por povoado (bioma, recursos, construções, população) e estoque.
- **Preço por oferta e procura** (0,3× a 4× da base). Colheita, guerra, saque e calamidade mexem nos preços.
- **Rações e equipamento ligados aos bens:** as rações vêm de grão e gado; o equipamento, do ferro; a cavalaria depende dos cavalos.
- **Caravanas como agentes reais** por estrada, rio (barcaças) e costa. Podem ser saqueadas por bandidos ou pelo jogador.
- **Livro de Preços** com a idade de cada informação. Viajantes e mercadores trazem preços de longe.
- **Comércio do bando:** carga nas carroças, caravaneiros próprios, feitorias, investimento em guildas, pedágios e taxa de mercado.
- **Contrabando e embargos** entre reinos em guerra. Novos contratos: escolta, carga roubada, rota infestada, sabotagem.
- **Construções de povoado ligadas às cadeias:** serraria, salina, tecelagem, pastagem, moinho e porto.

**Pronto quando:** um bando goblin numa estrada encarece a comida numa cidade distante; e o jogador lucra comprando barato num lugar e vendendo caro em outro, sabendo que a informação pode estar velha.

## Marco 15 — Reinos vivos
**Objetivo:** os reinos deixam de ser números e viram personagens com planos. GDD 8.9 e 8.10.
- **Nobreza:** rei, herdeiros e lordes vassalos com traços, idade, ambição, feudos e memória pessoal do Comandante.
- **IA por objetivos:** um plano semanal (campanha, defesa, cruzada, expansão, comércio) vira convocação de recrutas, exércitos de lordes marchando no mapa e cercos.
- **Guerra e paz:** cansaço de guerra, tratados de paz (território, tributo, prisioneiros) e tréguas. Alianças, casamentos e coalizões contra quem cresce demais.
- **Sucessão** com crises e guerra civil, em que os dois lados contratam o bando.
- **Lealdade dos povoados** e revoltas camponesas.
- **Contratos emergentes:** todo contrato nasce de uma necessidade real da simulação e deixa o lado contrário com rancor.
- **Notícias e rumores** que viajam na velocidade dos viajantes; o diário registra quando e onde o bando soube de cada coisa.
- **Reputação global:** Fama, Honra e Temor.
- **Vassalagem e corte:** jurar fidelidade em troca de feudo, atender às convocações e pedir audiências na sala do trono.

**Pronto quando:** sem o jogador fazer nada, em dois anos de jogo os reinos travam guerras visíveis, fazem paz, trocam de rei e oferecem contratos coerentes com o que está acontecendo, e o jogador fica sabendo disso com atraso.

## Marco 16 — Guerra de verdade: cercos e prisioneiros
**Objetivo:** guerras com escolhas de verdade e consequências morais. GDD 8.11.
- **Exércitos da IA lutam entre si:** dentro da bolha, em tempo real (o jogador pode assistir, entrar ou saquear os restos); fora dela, pela resolução abstrata.
- **Cercos físicos:** muralhas e portões no Campo; escadas e aríete construídos com madeira durante o cerco; bônus de altura para os defensores; cerco por fome com estoque de comida dos dois lados; surtidas; pedido de socorro.
- **Prisioneiros:** resgatar, recrutar, libertar ou executar, com efeito na Honra e no Temor e na lealdade dos tenentes. Nobres capturados lembram.
- **Comandante capturado:** um tenente lidera o bando no resgate, pagando ou à força.
- **Convocações de vassalagem** em campanhas da IA.

**Pronto quando:** tomar uma cidade murada exige escolher entre um assalto caro e um cerco longo, e o que o jogador faz com os prisioneiros muda como o mundo o trata.

## Marco 17 — Mares e continentes (o novo Mapa Múndi)
**Objetivo:** a terceira escala de mapa: o planeta, com outros continentes e o oceano entre eles. GDD 8.2 e 8.12.
- **Mapa Múndi do planeta** (3 a 5 continentes, ilhas e rotas marítimas), com névoa e cartas náuticas compráveis.
- **Navios:** barca, coca e nau; fretar passagem ou comprar e manter frota. Capacidade: soldado 1, cavalo 3, carroça 4.
- **Viagens:** dias conforme distância, vento e estação. Tempestade, calmaria e **piratas** (batalha de abordagem num convés).
- **Outros continentes:** cultura, nomes, tropas típicas, bens de luxo e calamidades próprios. O Campo é gerado ao desembarcar; a fama local começa em zero.
- **Comércio entre continentes** e notícias com semanas de atraso.
- **Colônias e feitorias de ultramar** e um segundo acampamento.
- **A IA no mar:** invasões, saques costeiros e piratas profissionais.

**Pronto quando:** o bando embarca num porto, sobrevive à viagem (talvez a piratas), desembarca num continente de outra cultura, lucra com comércio de luxo e, ao voltar, encontra o continente natal mudado pela simulação.

## Marco 18 — Legado e Lendas
**Objetivo:** a campanha vira uma saga que continua além do Comandante. GDD 8.13.
- **Envelhecimento e morte do Comandante**, com herdeiro (tenente leal ou escolhido em testamento).
- **Ambições opcionais**, com bônus e epílogo próprio.
- **Modo Lendas:** a crônica completa navegável (pessoas, batalhas, reinos, povoados).
- **Mundos que lembram (opcional):** recarregar uma semente séculos depois, com o bando antigo na história gerada.

**Pronto quando:** a morte do Comandante não encerra a campanha, e no fim dá para ler a história completa do mundo e do bando.
