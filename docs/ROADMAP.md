# Roadmap — Ascensão Mercenária

Desenvolvido em **greybox** (formas de código, UI em React + Tailwind) e agora migrando para **pixel art**, etapa por etapa: as figuras em campo já são sprites, o chão de perto também, e as construções também (G3: povoados, acampamento, locais de contrato e covis); árvores, interiores, interface e o resto ainda são greybox ([ARTE.md](ARTE.md)). Cada marco precisa ser jogável de ponta a ponta antes de seguir para o próximo. Referência de design: [GDD.md](GDD.md); as propostas da Fase 2 estão na seção 8 do GDD.

O roadmap fica dividido por fase, para os arquivos não ficarem longos:
- [Fase 1 — O bando](ROADMAP_FASE_1.md): Marcos 1 a 9 — ✅ OK, fase concluída.
- [Fase 2 — O mundo que respira](ROADMAP_FASE_2.md): Marcos 10 a 18 — ✅ OK, fase concluída.
- [Fase 3 — O arcano](ROADMAP_FASE_3.md): pixel art, rações refeitas, Marcos 19 a 23 (magia, capitães, duelos, acampamento construído, cultura e religião) e as pendências das fases anteriores, numa fila só que alterna arte e recursos. Os marcos estão feitos; em andamento, a etapa 17: terminar as pendências.
- [Fase 4 — título a definir](ROADMAP_FASE_4.md): tornar o jogo divertido, viciante e desafiador. Quem define as etapas é o usuário, jogando. Começa com a campanha inteira que era o fechamento da Fase 3.

**OK** = marco concluído e jogável.

O que ficou de fora e a avaliação das mecânicas: [Fase 3, seção "Pendências das Fases 1 e 2"](ROADMAP_FASE_3.md#pendências-das-fases-1-e-2). Gráficos: [PLANO_GRAFICO.md](PLANO_GRAFICO.md) (por quê e como) e [ARTE.md](ARTE.md) (o que já é pixel art e o que falta).

## Visão geral

| Fase | Marco | Tema | Estado |
| --- | --- | --- | --- |
| [1 — O bando](ROADMAP_FASE_1.md) | 1 | Combate básico | ✅ OK |
| | 2 | Formações e terreno | ✅ OK |
| | 3 | Tenda e economia | ✅ OK |
| | 4 | Progressão RPG dos batalhões | ✅ OK |
| | 5 | Tenentes | ✅ OK |
| | 6 | Mensageiros e névoa de guerra | ✅ OK |
| | 7 / 7.1 | Mapa contínuo, Mapa Múndi e mundo procedural | ✅ OK |
| | 9 | Reino e calamidades | ✅ OK |
| [2 — O mundo que respira](ROADMAP_FASE_2.md) | 10 | Fundações do mundo grande (save, simulação em camadas, dia e noite) | ✅ OK |
| | 11 | Geografia real: relevo, rios e mares | ✅ OK |
| | 12 | Mundo vivo: gente andando (e cidades de verdade num mapa maior) | ✅ OK |
| | 13 | Estações, clima e logística | ✅ OK |
| | 14 | Economia e comércio (e interiores das estruturas) | ✅ OK |
| | 15 | Reinos vivos (e a Cidade Alta das capitais) | ✅ OK |
| | 16 | Guerra de verdade: inimigos que pensam, cercos e prisioneiros | ✅ OK |
| | 17 | Mares e continentes (o novo Mapa Múndi) | ✅ OK |
| | 18 | Legado e Lendas | ✅ OK |
| [3 — O arcano](ROADMAP_FASE_3.md) | — | Progressão de batalhões refeita | ✅ OK |
| | G0 / G1 | Pixel art: prova e figuras em campo | ✅ OK |
| | G3 | Pixel art: construções (povoados, muralhas, acampamento, locais e covis) | ✅ OK |
| | — | Rações refeitas: mochilas por batalhão e comboio de carroças | feito, falta jogar uma campanha |
| | 20 | Capitães: a cadeia de comando | ✅ OK |
| | G2 | Pixel art: chão | ✅ OK |
| | 21 | Duelos no meio da batalha | ✅ OK |
| | — | Locais de missão sempre habitados | ✅ OK |
| | G4 | Pixel art: resto do elenco (carroças, aríetes, navios, gente) | ✅ OK |
| | 22 | Do bivaque à cidade: acampamento e fortaleza construídos pelo bando, e a cidade que nasce sozinha | ✅ OK |
| | G5 | Pixel art: interface (fonte, molduras, ícones e retratos) | ✅ OK |
| | 23 | Cultura, religião e língua | ✅ OK |
| | G6 | Pixel art: atmosfera | ✅ OK |
| | 19 | Magia do Comandante (era o Marco 8, continua por último) | ✅ OK |
| | — | As pendências das fases anteriores (etapa 17, em 13 partes) | em andamento |
| [4 — a definir](ROADMAP_FASE_4.md) | — | Jogar uma campanha inteira; o resto, o usuário define jogando | |

**Regras para todos os marcos novos** (detalhes no GDD, seção 8.1):
- toda mecânica cria uma decisão com custo e conta uma história no diário;
- o estado do mundo aparece no mapa antes de aparecer na interface;
- a IA segue as mesmas regras do jogador;
- perdas parciais são preferíveis ao tudo-ou-nada;
- o jogo alterna tensão e respiro.

---

## Fora dos marcos

### Menu inicial e Batalha personalizada ✅ OK
**Objetivo:** abrir o jogo num menu de verdade e poder treinar o combate sem campanha.
- **Menu inicial:** Continuar (último save), Nova campanha, Batalha personalizada, Carregar jogo, Como jogar e Opções, com navegação por teclado.
- **Cenários:** 8 prontos, e o jogador cria os seus do zero ou copiando um pronto. Ficam no armazenamento local, junto com vitórias e melhor tempo; não entram nos saves da campanha.
- **O que se configura:** mapa (campo aberto, clareira, colina, vau, ponte, pântano, desfiladeiro, dunas), hora, estação, tempo, objetivo (expulsar, resistir ou matar o chefe), distância inicial, névoa de guerra e dificuldade.
- **Seu exército:** até 8 batalhões (tropa, formação, soldados, nível, equipamento e tenente), batedores, mensageiros e carroças.
- **Inimigo:** até 4 forças (quem são, de onde vêm, se atacam ou esperam, quando chegam, quantos de cada tipo, nome, competência e personalidade do comandante).
- **Motor:** a batalha roda na cena do mundo, com as mesmas tropas, ordens e IA do Marco 16, num mapa pequeno gerado do cenário (`src/game/data/scenarios.ts`). O relógio fica parado e não há economia, eventos nem save.
- **Medido:** 46 fps com 283 inimigos e 128 soldados em combate. O equilíbrio dos cenários prontos foi visto só com o exército parado, sem partida jogada de verdade.
- **Ficou de fora:** batalhas com aliados controlados pela IA.

### Batalha personalizada de cerco ✅ OK
**Objetivo:** atacar ou defender uma fortaleza nas batalhas personalizadas, com as mesmas muralhas, portões, escadas e aríete do cerco da campanha.
- **O que se configura:** ligar o cerco no editor, escolher o lado (atacar ou defender), a fortaleza (aldeia com paliçada, forte de pedra ou cidade murada) e quantas escadas e aríetes tem quem ataca. A fortaleza fica no centro do mapa; mapas com rio ou desfiladeiro não valem. Três cenários prontos: A Paliçada, O Forte da Fronteira e O Último Portão.
- **Atacando:** as forças marcadas "Atrás dos muros" guardam a fortaleza; as outras vêm de fora, como socorro. A tropa a até 240 px da muralha ergue a escada; o aríete sai de perto da tropa e leva tempo até o portão.
- **Defendendo:** arcos na muralha virada para o inimigo, reserva logo atrás. O inimigo vem até o pé da muralha, ergue uma escada a cada 18 s, bate nos portões e traz o aríete.
- **Muralha:** quem atira de cima alcança 40% mais, bate 15% mais forte, leva 40% menos flechas e não gasta munição, dos dois lados. Na escada se anda a 15% da velocidade, e atrás dos muros a moral cede 30% mais devagar.
- **IA:** a guarnição reparte os atiradores pelos postos voltados para o inimigo e leva a infantaria para onde ele pode entrar; quando ele entra, vai para cima.
- **Rotas:** passagem mais estreita que a célula de navegação agora entra nas rotas. Antes, a tropa só passava por uma escada se ela estivesse em linha reta (vale também para o cerco da campanha).

### Quem desiste, e quando a batalha acaba ✅ OK
**Objetivo:** o inimigo não larga a luta só por ver que é menor, e a batalha personalizada não fica presa em quem sobrou.
- **Medido antes:** contra um exército maior, a força largava a luta aos 6 s, sem nenhuma baixa, e a batalha acabava em 8 s; sob um covarde, 21 de 22 saíam depois de perder 1 soldado.
- **Agora:** quem já está na luta só sai depois de perder 45% da tropa (30% o covarde, 50% o bravo e o cruel). Numa batalha personalizada ninguém sai antes de lutar. Na campanha, um bando ainda pode evitar a luta enquanto não foi visto de perto.
- **Fim da batalha:** a força vencida (55% de baixas, ou baixas sem ninguém no comando) que está sem lutar e a mais de 700 px de todos deixa o campo e conta como fugitiva. Quem esperava em posição e já apanhou vem terminar a luta. Cada força marcha para a tropa mais próxima dela; antes ia para o meio do exército, um ponto vazio quando as tropas estavam espalhadas.
- **Quem não luta:** batedor e arauto rondam e fogem de quem chega perto; sozinhos, não seguram mais a batalha. Quem decidiu largar uma batalha personalizada não volta atrás ao perder o inimigo de vista.
- **Reagrupar:** com fugitivos no campo, a vitória espera 12 s: quem se recompõe nesse tempo volta à luta.
- **Medido depois:** contra o mais fraco, a batalha dura de 26 s a 52 s, com 3 a 9 mortos de 14 (antes, 8 s com 0 a 2); sob um covarde, de 34 s a 140 s, com 5 a 16 mortos de 22 (antes, 12 s com 1). Nenhuma batalha sem fim em 36, mas o caso que travou nunca foi capturado por inteiro: o teste agora mostra quem sobrou, se acontecer de novo.
- **Equilíbrio:** só com jogador simulado. Mesma força, contra a muralha 3 vitórias em 4, em campo aberto 0 em 4; Paliçada 3/3, Forte da Fronteira 3/3, O Último Portão 2/3.

### Tropas em missão à vista ✅ OK
**Objetivo:** ver as tropas enviadas saírem, andarem e voltarem, em vez de sumirem do campo.
- **No campo:** quem é enviado vira uma coluna que parte de onde estava e segue a rota até o serviço. Numa escolta, vai até a cidade de saída e continua pela estrada com a carroça. A coluna enxerga como um batalhão e volta até o Comandante.
- **Onde acompanhar:** faixa no HUD com o que cada tropa está fazendo, diário com a tropa no mapa da rota, e marcador com o destino no Mapa do Continente.
- **Relógio:** com tropas fora, o tempo corre no acampamento (1 dia a cada 90 s, como no treino). Antes, ficar no acampamento deixava a tropa fora para sempre.
- **Ficou de fora:** a coluna é só desenho. A luta continua resolvida em conta, então ninguém a ataca pelo caminho e ela não enfrenta o que encontra.

### Zoom mais aberto ✅ OK
**Objetivo:** ver a batalha inteira de longe.
- A roda do mouse vai até 25% (antes, 50%), na campanha e nas batalhas, sem perda de desempenho (154 fps na campanha, sem buracos no mapa). De tão longe, os soldados viram pontos e os nomes não se leem.

### Combate em ritmo de batalha campal ✅ OK
**Objetivo:** batalhas mais longas e fáceis de comandar, no estilo Total War, sem mudar as regras de quem vence.
- **Ritmo:** cada golpe ou flecha causa 12% do dano antigo; a investida da cavalaria, 40%. A tropa anda a 45% da velocidade e corre a 72%; só o último trecho até o alvo é a toda. Na campanha, sem inimigo à vista, marcha-se no passo normal.
- **Linha de batalha:** arrastar com o botão direito mostra, antes de soltar, onde cada soldado vai ficar. Risco longo deixa a linha fina; risco curto, funda. Da esquerda para a direita, a frente olha para cima. Esc cancela.
- **Fileiras:** quem segura a posição não sai correndo atrás do inimigo; quem cai é substituído pela fileira de trás, e cada fileira extra amortece a perda de moral (8% por fileira, até 3).
- **Passo:** dois cliques com o botão direito ou a tecla X fazem correr, e correr cansa. A tropa só sai da forma perto do alvo.
- **Alvo que some:** a tropa vai até onde o viu por último e segura a posição, em vez de adivinhar para onde ele foi.
- **Barra de comandos:** embaixo, com ícones de formação e de ordens, cartões dos batalhões e a lista de teclas no botão "?".
- **Câmera lenta:** 4 segundos a 1/4 da velocidade, com 10 segundos de espera depois (botão ou Z). O tempo do jogo inteiro desacelera junto (`src/game/gameClock.ts`).
- **Pausa tática:** P para o mundo e deixa dar ordens.
- **Ordens diretas:** nas batalhas personalizadas, todo o exército ouve as ordens na hora (pode ser desligado no cenário); na campanha continuam valendo voz, trombeta e mensageiros.
- **Medido:** 24 contra 24 dura de cerca de 1 a 3 minutos, contra uns 20 segundos antes. Os valores ficam no bloco `COMBAT` de `src/utils/constants.ts`. O equilíbrio ainda não foi visto em partida jogada de verdade.

### Combate com profundidade ✅ OK
**Objetivo:** cada tropa ter um papel, e posição e manobra decidirem a batalha, no espírito de um Total War.
- **Atributos:** ataque, defesa, armadura, escudo, perfuração, bônus contra cavalo, peso, firmeza, investida, dispersão e munição (`UnitStats`). As regras são funções puras em `src/game/sim/combatRules.ts`, as mesmas para os dois lados.
- **Tropas novas do jogador:** Lanceiros, Guarda pesada, Besteiros, Dardeiros, Cavaleiros e Arqueiros montados. Inimigos novos: lanceiro goblin, dardeiro e salteador montado, piqueiro, homem de armas, arqueiro de guerra, cavaleiro, brutamontes orc, esqueleto arqueiro e guarda de ossos.
- **Flanco:** todo golpe tem lado. De lado ou por trás a defesa cai, o dano sobe e a moral sofre mais; a tropa percebe, avisa no feed e no cartão, e o medo passa para quem vê um vizinho fugir.
- **Empurra-empurra:** quem está plantado na fileira ou lutando não é jogado longe; quem carrega abre caminho. A fileira assenta, sem tremer.
- **Flechas em área:** cada salva cai numa elipse que cresce com a distância e com o tamanho da unidade que atira. Tropa fechada sofre mais que dispersa, e o que cai no corpo a corpo acerta os dois lados (fogo amigo). Escudo para flecha de frente; munição acaba e aí é lutar de perto.
- **Investida:** empurra, derruba, abala a moral e segue em frente. Lança parada e de frente quebra a carga e devolve o golpe. A cavalaria sai do combate e volta; a investida em ciclo faz isso sozinha.
- **Posturas:** cessar fogo, investida em ciclo e escaramuça (recuar de quem chega perto).
- **IA:** cada tipo de tropa no próprio esquadrão; a cavalaria espera as linhas se prenderem, escolhe em quem bater, evita lança e entra em ciclo; lanças firmam quando o cavalo vem; arqueiros treinados seguram o tiro em cima dos seus; quem é pego de lado vira a frente; grande capitão guarda reserva.
- **Testes:** `npm test` (regras, sem abrir o jogo) e `npm run test:battle` (batalhas de verdade, com `npm run dev` rodando).
- **Medido:** ver o resultado de cada confronto em `tests/battle`. O equilíbrio ainda não foi visto em partida jogada de verdade.

### Missões e expedições ✅ OK
**Objetivo:** saber sempre de onde um serviço sai, para onde vai e o que falta, e poder mandar as tropas cumpri-lo.
- **Passos:** cada contrato vira uma lista de passos com o lugar, a distância e a direção, e um minimapa com a rota (`src/game/data/missionGuide.ts`). A faixa do HUD mostra o passo atual.
- **Diário de missões (J):** contrato do Comandante, tropas fora, favores da corte e as últimas notícias.
- **Expedições:** "Enviar tropas" manda batalhões cumprirem limpezas de local, escoltas e estradas. Eles saem do campo, levam rações, recebem salário e voltam com o resultado, resolvido em conta pela força contra a dificuldade (`src/game/sim/expeditions.ts`). Quem morre não volta.
- **Visão:** batalhões enxergam 420 px, os que atiram 620 px e o Comandante 520 px, com o alcance de percepção de quem atira do lado inimigo acompanhando.

### Desempenho: batalhas quatro vezes mais leves ✅ OK
**Objetivo:** abrir espaço para os batalhões grandes, que esperavam o motor aguentar 1500 soldados de perto.
- **Medido** (Edge com janela, 8 batalhões contra uma força igual, um passo de 1/30 s por vez; tempo de JavaScript por passo, mediana e 1% pior):
  | Soldados | Simulação antes | Simulação agora | Desenho |
  | --- | --- | --- | --- |
  | 640 | 5,6 ms / 9,3 ms | 2,2 ms / 6,8 ms | 2,2 ms |
  | 1280 | 22,7 ms / 28,4 ms | 6,5 ms / 10,9 ms | 3,8 ms |
  | 1600 | 31,4 ms / 42,7 ms | 7,6 ms / 15,5 ms | 3,8 ms |
  | 1600, zoom 25% | 30,8 ms / 43,1 ms | 7,1 ms / 18,7 ms | 3,5 ms |
  - Com 1600 soldados o quadro inteiro caiu de 35 para 11 ms: passa a caber em 60 fps.
  - No mapa (acampamento, passeio de 25% a 100%, capital e cidade) o jogo já ia no limite da tela (160 a 165 fps), com passo de 2,5 a 3 ms, e continua assim.
- **O que mudou** (nenhuma regra):
  - **Empurra-empurra:** `separateUnits` testava todos os pares (820 mil por quadro com 1280 soldados). Agora uma grade só junta vizinhos (`src/game/systems/nearPairs.ts`, com teste contra a conta de todos os pares). Caiu de 33% para 8% do tempo.
  - **Distância:** `distance` usa `Math.sqrt` em vez de `Math.hypot`, que é bem mais lento.
  - **Olhar do inimigo:** quem está além do máximo que o soldado enxerga sai antes da conta inteira da percepção (`Enemy.farthestSight`).
  - **Moral:** a contagem de ameaças não cria listas nem tira raiz.
  - **Figuras:** a troca de quadro usa o quadro já guardado da folha (`sheetOf` em `atlas.ts`), e não o `setFrame` do Phaser, 14 vezes mais caro. A profundidade só muda quando a figura se mexe.
  - **Nomes dos batalhões e falas do acampamento:** a cor era trocada a cada quadro, e cada troca redesenhava o texto e o mandava de novo para a placa de vídeo.
  - **Névoa de guerra:** um pixel por célula numa textura pequena, ampliada sem suavizar, no lugar de um retângulo por célula (33 mil comandos de desenho por quadro a 25%). Comparada lado a lado com a antiga: igual a 100%; de mais longe, só as bordas entre células claras e escuras andam um pixel.
  - **HUD:** a cena publica dez vezes por segundo; se nada mudou, a interface não se redesenha.
- **Testes:** os 247 de regras passam. As suítes de batalha passam como antes (215 a 216 de 218), e as falhas são as verificações de sorte já listadas na [Dívida](ROADMAP_FASE_3.md#dívida). Cada uma foi repetida com o código antigo e com o novo, e os dois dão o mesmo.
- **Ficou de fora:**
  - **No mapa:** o anel de comando (88 arcos pontilhados) ainda é `Graphics`, que o Phaser refaz a cada quadro. As carroças, que também eram, viraram figuras no G4.
  - **Na cena:** a cena inteira é reordenada por profundidade a cada quadro em que alguém anda (0,3 ms no mapa); chão e construções podiam ir para camadas próprias.
  - **Na batalha,** o que sobra no perfil com 1280 soldados: a IA dos esquadrões (16% do tempo), o empurra-empurra (8%), a animação (8%) e o desenho dos contêineres do Phaser (3,8 ms por quadro).

### Desempenho, segunda rodada: a busca de alvo e o acampamento do Marco 22 ✅ OK
**Objetivo:** medir de novo depois da 12.2, que pôs no acampamento gente trabalhando, obras com placa e 22 construções novas. As rodadas ficaram num script: `node tests/battle/perf.mjs [batalhas|acampamento|mapa] [--perfil]`, com `npm run dev` rodando.
- **Medido** (o mesmo método da rodada anterior: Edge com janela, passos de 1/30 s, mediana / 1% pior):
  | Caso | Simulação antes | Simulação agora | Desenho |
  | --- | --- | --- | --- |
  | Batalha, 640 soldados | 4,0 ms | 2,9 ms / 5,7 ms | 2,4 ms |
  | Batalha, 1280 soldados | 9,0 ms | 5,5 ms / 15,1 ms | 3,4 ms |
  | Batalha, 1600 soldados | 12,2 ms | 5,0 ms / 14,4 ms | 4,2 ms |
  | Batalha, 1600, zoom 25% | — | 4,6 ms / 15,8 ms | 3,7 ms |
  | Bivaque do começo | — | 0,9 ms / 1,9 ms | 1,7 ms |
  | Paliçada com 37 construções | — | 1,1 ms / 2,0 ms | 1,6 ms |
  | Mapa, longe do acampamento | — | 1,4 ms / 4,0 ms | 1,8 ms |
  - A batalha tinha voltado a pesar (12 ms com 1600) desde a rodada anterior. Agora cabe com folga em 60 fps.
  - O acampamento cheio não pesa mais que o mapa.
- **O que mudou** (nenhuma regra):
  - **Busca de alvo:** cada soldado sem alvo filtrava a lista inteira de inimigos e depois procurava o mais perto. Agora uma grade montada uma vez por quadro dá só os vizinhos (`src/game/systems/nearIndex.ts`). O resultado é o mesmo, inclusive no empate, e há teste contra a conta da lista inteira.
  - **Um dia de obra:** antes, cada dia redesenhava o acampamento inteiro. Agora só troca o texto das placas de obra (`CampArea.updateProgress`). Caiu de uns 9 ms na hora, mais uns 16 quadros de 12 ms, para 1,3 ms na hora e 29 ms espalhados. Uma construção posta ainda redesenha tudo: 8 ms na hora e 128 ms espalhados.
- **Uma pista falsa:** o perfilador do Edge põe 10 a 13% do tempo no `setFrame` do Phaser, chamado pela animação das figuras. Medido direto, a animação inteira de 1600 figuras gasta 0,34 ms por passo e o `setFrame` roda umas 2 vezes por passo: é erro de atribuição do perfilador, e não há o que ganhar ali.
- **Testes:** os 372 de regras passam. As suítes de batalha passam. Na rodada inteira só a `mar` falhava, por causa do começo humilde da 12.1: com um batalhão só, não havia quem deixar no cais. Agora ela dá um segundo batalhão ao bando, e passa (45 de 45).
- **Ficou de fora:** o que sobra na batalha é o empurra-empurra (5%) e o desenho dos contêineres do Phaser.

---

## Banco de ideias (ainda sem marco)
- **Religiões e templos:** fé por cultura, peregrinações, cruzadas contra calamidades e heresias.
- **Armas e armaduras com nome e história**, que passam de batalhão em batalhão.
- **Espionagem:** espiões nas cortes, sabotagem e roubo de planos de campanha (o Marco 15 trouxe o básico: favores de espionagem, cartas e esgotos).
- **Monstros lendários únicos** (raros, por ser low fantasy), com covil e lenda na crônica.
