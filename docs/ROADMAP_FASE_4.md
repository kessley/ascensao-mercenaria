# Fase 4 — O bando que tem nome

Índice e visão geral: [ROADMAP.md](ROADMAP.md) · Fase anterior: [Fase 3 — O arcano](ROADMAP_FASE_3.md) · De onde vieram as ideias: [FASE_4_BRAINSTORM.md](FASE_4_BRAINSTORM.md) · Design: [GDD.md](GDD.md) · Arte: [ARTE.md](ARTE.md)

## Estado
- **Plano decidido em 10 de novembro.** O usuário jogou, deu as notas dele e deixou a fase por conta do plano: os marcos, a ordem e as pendências da Fase 3, que passam todas para cá.
- **Nenhuma etapa começou.** A primeira é o som.
- O título é uma escolha deste plano. O usuário pode trocar.

## A intenção
Tornar o jogo **divertido, viciante e desafiador**: uma campanha que dá vontade de jogar mais uma e que cobra decisões de verdade.

As três primeiras fases construíram os sistemas. Esta fase olha para a experiência de jogar.

## O que o usuário pediu
Da primeira sessão de jogo:
1. O começo é meio chato.
2. As missões são repetitivas e pouco interessantes.
3. Os inimigos ficam sempre nos mesmos lugares.
4. Os inimigos são muito "tanque", mas as batalhas não devem ficar rápidas.
5. A ideia dele: a diferença de nível muda a chance de acerto, e quem está cercado se defende pior.
6. Alguns moradores das cidades deveriam ser especiais: com vida simulada, família e missões.

Do segundo pedido, com liberdade para decidir o resto:
7. **Som no jogo,** no espírito dos sons de *Age of Empires II*.
8. **O duelo como luta de ação:** esquivar, atacar, usar magia. Vence-se com habilidade, contra tipos diferentes de inimigo, e há decisões que fazem ganhar ou perder.
9. **Combate melhor,** tanto o de um contra um quanto o das batalhas.
10. **Guerras de vez em quando no mapa,** às vezes provocadas pela campanha do bando.
11. **Mais campanha e mais história.**
12. **As pendências das fases anteriores entram na Fase 4.**

## A espinha
**Um bando com nome, num mundo de gente com nome.**

O mundo já é simulado e fundo, mas o jogador encontra balcões, locais e inimigos sem rosto. A promessa da fase: **cada hora de jogo deixa uma história sobre alguém com nome.** Um amigo (o notável), um rival (o outro bando), um inimigo (o nêmesis), um dos seus (o veterano). E o bando deixa o nome dele no mundo: numa guerra, numa canção, num final.

| Tempo de jogo | Hoje | Depois da fase |
| --- | --- | --- |
| **30 segundos** (a luta) | Mandar atacar e esperar a vida do inimigo acabar. O Comandante tem um golpe só | Cercar, flanquear e revezar a linha. O Comandante esquiva, apara e lança magia |
| **5 minutos** (a missão) | Aceitar, marchar, matar todos, voltar | Escolher entre três ofertas, saber antes, chegar a um lugar que mudou, cumprir um objetivo diferente, decidir numa reviravolta |
| **1 hora** (o bando) | Juntar ouro para a próxima construção | Fechar uma ambição curta, subir na tábua dos bandos, ganhar um troféu, ver um veterano ganhar nome |
| **Campanha** | Seis ambições de fim de jogo | Atos com prova, uma Grande Questão que move o mundo, guerras com causa, um nêmesis que volta e finais diferentes |

## Regras desta fase
Somam-se às [regras de todo marco](ROADMAP.md) e às regras de ouro do GDD.
1. **Perto do jogo.** Só entra o que o jogador encontra nas duas primeiras horas, ou em toda sessão.
2. **Medir antes e depois.** A etapa 2 cria a régua; cada marco diz qual número quer mudar.
3. **Cada etapa termina com o usuário jogando** e respondendo a uma pergunta. A resposta decide se a etapa fecha.
4. **A batalha dura pelo que acontece nela,** e não pela vida de cada um.
5. **Cada marco traz o seu som.** Os sons novos entram na mesma etapa que a mecânica.
6. **O gerador de mundo muda uma vez só,** no Marco 27. É a única quebra de saves da fase.
7. **Tudo é feito no código,** como a arte: o som e a música são sintetizados, sem arquivos de fora.

## Decisões já tomadas
O usuário deixou estas escolhas com o plano.

| Pergunta | Decisão |
| --- | --- |
| O que faltava no duelo? | Ação e escolha: os verbos de luta valem em todo lugar, entra a magia, há 8 tipos de adversário e decisões antes, durante e depois (Marco 25) |
| Batalhões grandes | Entram no Marco 24, junto com a perícia, para o combate ser equilibrado uma vez só |
| Saves | Os da Fase 3 deixam de carregar no Marco 27. Dali em diante, cada marco carrega os saves do anterior |
| Pendências da Fase 3 | Todas entram aqui. A tabela está [no fim](#as-pendências-da-fase-3-dentro-da-fase-4) |
| Quanto dura uma batalha | Escaramuça de 1 a 2 minutos, batalha média de 3 a 6, batalha campal de 8 a 12 |
| A ordem | O som primeiro, porque foi pedido para já e melhora tudo o que vem depois. Em seguida o combate, porque todo minuto de jogo tem luta |

## A fila

| # | Etapa | Tipo | Por que aqui | Estado |
| --- | --- | --- | --- | --- |
| 1 | [S1 — Som, parte 1: a voz do bando](#1-s1--som-parte-1-a-voz-do-bando) | som | Pedido para já; não mexe no equilíbrio | a fazer |
| 2 | [A régua e a bancada](#2-a-régua-e-a-bancada) | ferramenta e dívida | Medir antes de mudar o combate | a fazer |
| 3 | [Marco 24 — Batalha: perícia em vez de vida](#3-marco-24--batalha-perícia-em-vez-de-vida) | recurso | Todo minuto de jogo tem luta | a fazer |
| 4 | [Marco 25 — O Comandante em campo e o duelo de ação](#4-marco-25--o-comandante-em-campo-e-o-duelo-de-ação) | recurso e arte | Usa a perícia e a pressão do Marco 24 | a fazer |
| 5 | [Marco 26 — Missões com história](#5-marco-26--missões-com-história) | recurso | A segunda maior dor do começo | a fazer |
| 6 | [Marco 27 — O mundo refeito: lugares vivos](#6-marco-27--o-mundo-refeito-lugares-vivos) | recurso e arte | A única mudança no gerador; os marcos seguintes moram nele | a fazer |
| 7 | [S2 — Som, parte 2: o mundo que se ouve](#7-s2--som-parte-2-o-mundo-que-se-ouve) | som | Os lugares novos já existem | a fazer |
| 8 | [Marco 28 — Gente com nome](#8-marco-28--gente-com-nome) | recurso | Dá rosto às missões | a fazer |
| 9 | [Marco 29 — Rivais e nêmesis](#9-marco-29--rivais-e-nêmesis) | recurso | Precisa de heróis com ficha e de gente com memória | a fazer |
| 10 | [Marco 30 — Guerras com causa](#10-marco-30--guerras-com-causa) | recurso | Precisa dos aliados da IA, dos batalhões grandes e dos rivais | a fazer |
| 11 | [Marco 31 — A Grande Questão e as calamidades](#11-marco-31--a-grande-questão-e-as-calamidades) | recurso | Amarra guerras, gente e rivais numa trama | a fazer |
| 12 | [S3 — Som, parte 3: a música](#12-s3--som-parte-3-a-música) | som | Já há o que a música acompanhar | a fazer |
| 13 | [Marco 32 — A escada da campanha](#13-marco-32--a-escada-da-campanha) | recurso | Junta tudo em atos e finais | a fazer |
| 14 | [G7 — Arte: o mar e o acabamento](#14-g7--arte-o-mar-e-o-acabamento) | arte | Logo antes do marco do mar | a fazer |
| 15 | [Marco 33 — O mar de verdade](#15-marco-33--o-mar-de-verdade) | recurso | Pendência grande, e o caminho das invasões | a fazer |
| 16 | [Marco 34 — A primeira hora](#16-marco-34--a-primeira-hora) | recurso | É montada com as peças de todos os outros | a fazer |
| 17 | [Marco 35 — Jogar a campanha inteira](#17-marco-35--jogar-a-campanha-inteira) | fechamento | O fechamento que veio da Fase 3 | a fazer |

**Como a fila anda:**
- Marco grande se divide em partes, cada uma com o seu commit e o seu "pronto quando".
- Cada etapa termina jogável.
- A primeira hora fica no fim porque usa tudo. Mas os Marcos 24, 25 e 26 já mudam o começo sozinhos.

---

## 1. S1 — Som, parte 1: a voz do bando
**Objetivo:** toda ação responde com um som, e dá para saber o que acontece sem olhar.

**O espírito:** em *Age of Empires II*, a tropa responde quando é escolhida e quando recebe ordem, cada prédio tem um som próprio, o sino avisa do ataque antes de a tela mostrar, e subir de era tem fanfarra. É isso que se quer aqui. **Nada é copiado de lá:** os sons são feitos no código do jogo, e a fala das tropas é inventada.

**Como é hoje** (`src/audio/`):
- o motor sintetiza tudo na hora, com a Web Audio API, sem arquivos;
- são 16 sons (golpe, flecha, morte, investida, cornetas de ordem, moeda, clique, vitória e derrota) e uma fogueira em laço;
- o som é posicional, com limite por tipo, e há um controle de volume só.

**Em partes:**
1. **A mesa de som** (`AudioEngine.ts`).
   - Cinco canais com volume próprio: interface, vozes, combate, ambiente e música.
   - Prioridade: o alarme abaixa todos os outros; a voz abaixa o ambiente.
   - Um limitador no fim, para 1600 soldados não estourarem o som.
   - O jogo pausado silencia o combate, e a aba escondida suspende tudo.
   - O `SoundControl` ganha um volume por canal, e os cinco ficam guardados.
2. **A fala inventada** (`audio/voice.ts`, novo).
   - Um sintetizador de voz simples: uma fonte que vibra, três filtros que fazem a vogal e ruído para a consoante.
   - As sílabas saem da língua de cada cultura (`sim/language.ts`). O soldado das Ilhas não soa como o dos Reinos.
   - Cada tropa tem um timbre: infantaria grave, arqueiros leves, cavalaria firme, guarda pesada muito grave.
   - As falas: ao ser escolhida (3 variações), ao andar, ao atacar, ao segurar, ao recuar, em pânico, cansada, e o grito de muitos na vitória.
   - Regras: uma fala por ordem (responde a primeira tropa escolhida), no máximo uma a cada 250 ms, e nunca por cima de um alarme.
   - O Comandante, os tenentes e os capitães têm voz própria, tirada da semente do retrato.
   - Os inimigos também falam: o goblin guincha, o orc ruge, o bandido xinga, o morto-vivo sussurra.
3. **A interface.**
   - Cliques de pesos diferentes: leve, confirmar, cancelar e "não pode".
   - Abrir e fechar painel, virar página do diário, desenrolar o mapa.
   - Construir (martelo), recrutar (tambor e viva), aceitar contrato (selo e pena), pagar o soldo (muitas moedas).
   - Ambição cumprida e subida de nível, cada uma com a sua fanfarra curta.
4. **A assinatura de cada lugar.** Abrir ou entrar toca o som dele: a bigorna da ferraria, as canecas da taverna, o sino do templo, o burburinho do mercado, o relincho do estábulo, os sacos da intendência, as espadas de pau do campo de treino, a lona da tenda, as gaivotas do cais, o eco do paço, a madeira pesada do portão.
5. **O combate inteiro.**
   - O golpe muda com o que acerta: aço no aço, lâmina no escudo, na armadura e na carne. Lança, machado e clava soam diferente.
   - Flechas: a salva de muitos arcos, o assobio de quem passa perto, o acerto na madeira, no escudo e na carne.
   - Cavalaria: os cascos em laço, mais fortes quanto mais cavalos.
   - Cerco: o aríete no portão, a escada batendo no muro, o portão que racha e cai.
   - **O rugido da linha:** um laço de multidão cujo volume segue quantos estão lutando por perto. Numa batalha grande, é ele que se ouve, e não mil golpes soltos.
   - A coluna em marcha: os passos em laço, com som de capim, lama, neve, pedra ou ponte.
   - Moral: os gritos da debandada e o viva de quem volta à luta.
6. **Alarmes e sinais.** Cada um tem som próprio e uma seta no mapa:
   - o acampamento atacado (corneta de três notas);
   - a aldeia atacada (sino);
   - o herói inimigo à vista (tambor grave);
   - o duelo que começa, o comboio atacado, o batedor que volta, o mensageiro que chega;
   - o murmúrio do soldo atrasado;
   - a guerra declarada (trombetas) e a calamidade (sino fundo).
7. **O inventário** (`docs/SOM.md`, novo). Como o `ARTE.md`: todo som, o que o dispara e o que falta.

**Testes:**
- de unidade: o agendador (limite por som, prioridade, volume por canal) e as sílabas da voz por cultura;
- no navegador, suíte nova `som`: as ações principais disparam o som certo (espiando o `AudioEngine.play`), e 1600 soldados lutando não passam do limite de vozes.

**Pronto quando:**
- em 10 minutos de jogo, todo clique, toda ordem e todo golpe têm resposta;
- de olhos fechados dá para dizer que tropa foi escolhida, que o acampamento está sendo atacado e que uma linha debandou;
- nenhum som irrita depois de 20 repetições (há variação de tom e de tempo);
- os cinco volumes ficam guardados.

**A pergunta para o usuário:** com o som ligado, ficou mais gostoso de mexer? Algum som cansa?

## 2. A régua e a bancada
**Objetivo:** medir o começo de hoje e deixar a bancada de testes inteira antes de mexer no combate.

**Em partes:**
1. **O diário de ritmo** (`src/dev/paceLog.ts`, só no modo de desenvolvimento). Por sessão, ele guarda:
   - o tempo em cada estado: marchando, lutando, em painel, dentro de casa, no mapa e parado;
   - o minuto da primeira luta;
   - o tempo entre uma decisão e a seguinte (aceitar contrato, construir, recrutar, responder a um evento);
   - quanto dura cada missão, da porta à porta;
   - quanto cada tipo de inimigo leva para cair, do primeiro golpe à queda.
   - Sai num painel e em `window.__pace.report()`.
2. **A bancada de batalha.** É a parte 9 da etapa 17: na batalha personalizada, **aliados controlados pela IA** e **capitães**.
   - Uma força aliada usa o mesmo `WarHost` dos inimigos, do lado do jogador.
   - Serve para medir lutas de linha sem ninguém jogando, e é a base da batalha campal do Marco 30.
3. **A suíte `cercos`.** Achar por que o navegador de teste perde o WebGL depois dos assaltos ao Forte da Fronteira, e fechar a bateria em 450 de 450.
4. **A linha de base.** O laboratório joga o primeiro contrato 10 vezes, e a tabela abaixo ganha a coluna "Hoje".

| O quê | Hoje | Alvo |
| --- | --- | --- |
| Primeira luta da campanha | a medir | até o minuto 2 |
| Uma decisão com custo | a medir | a cada 2 ou 3 minutos |
| Missão curta, da porta à porta | a medir | de 4 a 8 minutos |
| Um soldado mata um goblin sozinho | cerca de 30 s | menos de 10 s |
| Dois soldados iguais, um contra o outro | a medir | de 12 a 20 s |
| Escaramuça de um batalhão | de 30 a 150 s | de 1 a 2 minutos |
| Batalha média | a medir | de 3 a 6 minutos |
| Batalha campal | não existe | de 8 a 12 minutos |

**Pronto quando:**
- a coluna "Hoje" está preenchida com números medidos;
- a bateria passa inteira;
- uma batalha personalizada com um aliado da IA acaba sozinha, sem o jogador.

## 3. Marco 24 — Batalha: perícia em vez de vida
**Objetivo:** o inimigo forte é forte porque luta bem, e não porque demora a morrer. É a ideia do usuário, levada para todo o combate, junto com os batalhões grandes.

**Como é hoje** (conferido no código):
- cada golpe certo tira só 24% do dano (`COMBAT.DAMAGE_PACE`). Um soldado leva cerca de 30 s para matar um goblin, e no nível 5 leva 24 s;
- o nível dá +6% de vida e de dano (`PROGRESSION.LEVEL_STAT_BONUS`). A chance de acerto não muda;
- a defesa cai de lado e pelas costas, mas o número de atacantes não conta;
- o Senhor da Guerra orc tem 1200 de vida: de frente, são vários minutos de pancada;
- o batalhão tem 8 soldados, e o arco alcança 230.

**Em partes:**
1. **Perícia** (`utils/progression.ts`, `sim/combatRules.ts`).
   - O nível soma ataque e defesa: +5 de cada por nível. Deixa de somar vida e dano.
   - Os inimigos também têm nível: a horda veterana acerta mais, e não aguenta mais.
   - As habilidades que mexem em vida e dano continuam como estão.
2. **Pressão** (`entities/Unit.ts`, `systems/CombatSystem.ts`).
   - Cada unidade lembra quem a atacou nos últimos 1,5 s.
   - Cada atacante além do primeiro tira 20% da defesa, até 60%. O lado do golpe continua valendo, por cima.
   - Na parede de escudos, só dois contam pela frente.
   - A cavalaria em investida conta por dois.
   - A IA aprende as duas coisas: fechar o cerco em quem está isolado, e não deixar os seus isolados.
3. **Fôlego.** A fadiga de lutar já existe (`FATIGUE.COMBAT_PER_SEC`). Agora ela tira defesa: nada até 40, e 30% a menos com 100.
   - Uma linha se cansa em cerca de 2 minutos de luta seguida, e descansa fora dela.
   - **Ordem nova, "Revezar":** o batalhão da frente passa por dentro do de trás, que assume a linha, sem ninguém se desorganizar.
4. **Vida e golpe.**
   - A vida vem do corpo, e a armadura é o que faz a tropa pesada aguentar.

     | Corpo | Vida hoje | Vida nova |
     | --- | --- | --- |
     | Goblin | 40 | 24 |
     | Homem (soldado, bandido, infantaria) | 45 a 70 | 40 a 50 |
     | Orc | 85 | 60 |
     | Brutamontes | 140 | 100 |
     | Senhor da Guerra | 1200 | 160, com guarda pessoal |

   - Cada golpe certo passa a tirar 50% do dano. As flechas e a investida sobem na mesma medida.
   - Dos que caem, voltam feridos 55% (hoje 40%), ou 70% com curandeira (hoje 55%).
   - Chefe não é mais saco de pancada: perícia alta, guarda pessoal de 6 e um golpe de assinatura.
5. **A ficha de quem tem nome.** Comandante, tenentes, capitães e heróis inimigos usam a mesma ficha de luta, de 1 a 10:
   - **Armas** dá o ataque, **Guarda** dá a defesa, **Vigor** dá a vida e o fôlego.
   - O Duelo dos capitães e a habilidade dos nobres (`martial`) viram essa ficha.
   - **A guarda do Comandante:** 4 veteranos que andam com ele. Cada um por perto tira um atacante da conta da pressão.
6. **Leitura.**
   - O golpe aparado mostra a pose de bloqueio, a faísca e o som.
   - Quem está com três ou mais em cima mostra a guarda aberta.
   - O ferido anda mais devagar e muda de cor.
   - Continua sem barra de vida.
7. **Batalhões grandes.** É a parte 13 da etapa 17. Na ordem combinada, sempre primeiro na batalha personalizada:
   1. **O alcance dos arcos:** de 230 para perto de 480, com flecha que leva tempo para chegar.
   2. **O tamanho por tropa:**

      | Tropa | Soldados |
      | --- | --- |
      | Milícia e lanceiros | 60 |
      | Infantaria | 48 |
      | Arqueiros | 40 |
      | Cavalaria e guarda pesada | 24 |
      | Cavaleiros e elite | 16 |

   3. **O estandarte** de cada batalhão, visível de longe, e o do capitão à frente da coluna no mapa (da parte 10 da etapa 17).
   4. **Destacamentos:** a ordem "Dividir" parte o batalhão em 2 ou 3, cada um com a sua posição e a sua ordem. "Reunir" junta de novo. É o que dá flanco à primeira luta da campanha.
   5. **A companhia em marcha** com a cavalaria nos flancos (`companyArrangement`, que existe e não está ligado).
   6. **A campanha:** soldo, rações, recrutamento, pagamento dos contratos e tamanho dos grupos inimigos, tudo na nova escala.
   7. **Os saves:** um save de antes carrega, e cada batalhão ganha o tamanho novo na mesma proporção de baixas que tinha.
8. **Medir e reequilibrar.** O laboratório mede todos os confrontos de novo, e as suítes `confrontos`, `ia` e `cercos` ganham limites novos. O teste de desempenho segura 1600 soldados.

**Os primeiros números,** para medir e corrigir:

| Caso | Hoje | Depois |
| --- | --- | --- |
| Infantaria nível 1 contra goblin | acerta 62%; 30 s para matar | acerta 62%; cerca de 9 s |
| Infantaria nível 5 contra goblin | acerta 62%; 24 s | acerta 82%; cerca de 7 s |
| Goblin contra infantaria nível 5, de frente | acerta 32% | acerta 15% |
| O mesmo veterano cercado por 4 goblins | o da frente acerta 32% | o da frente acerta 53% |
| Senhor da Guerra, de frente | um soldado acerta 36% | um soldado acerta 15% |
| Senhor da Guerra, cercado por 4 | só o lado do golpe muda | os soldados acertam 60% ou mais, e ele cai em menos de meio minuto |

**Som do marco:** o aparar, a guarda que abre, a ordem "Revezar", "Dividir" e "Reunir".

**Riscos:**
- **Bola de neve:** o lado com mais gente ganhar cada vez mais rápido. O teto da pressão, a formação e a moral são os freios.
- **Golpe no vazio:** errar muito cansa tanto quanto vida demais. Depende da parte 6.
- **Tudo muda de valor:** as verificações de batalha foram calibradas com os números de hoje.

**Pronto quando:**
- um batalhão veterano vence dois de novatos do mesmo tipo em 7 de 10 lutas, com a mesma vida deles;
- o Comandante cai em menos de 10 s cercado por 5, sem a guarda, e aguenta com ela;
- o Senhor da Guerra cai por manobra, e não por minutos de pancada de frente;
- revezar a linha a tempo vence uma luta que, sem revezar, se perde;
- os tempos da tabela da etapa 2 ficam dentro dos alvos;
- 1600 soldados continuam a 60 quadros por segundo.

**A pergunta para o usuário:** os inimigos ainda parecem esponjas? Alguma luta acabou rápido demais?

## 4. Marco 25 — O Comandante em campo e o duelo de ação
**Objetivo:** lutar com o Comandante é um jogo de habilidade, no meio da batalha e no duelo. Vence quem lê o adversário e decide bem.

**Como é hoje:**
- em campo, o Comandante tem um golpe só (Espaço), que sempre acerta quem está no arco;
- no duelo, as regras são fundas: golpe leve, pesado, bloqueio, aparar, esquiva, empurrão, postura e fôlego (`sim/duel.ts`);
- os adversários têm 4 temperamentos e 4 armas, mas lutam todos do mesmo jeito;
- a magia (6 feitiços) não entra no duelo;
- o fim é sempre o mesmo, e nada se decide antes.

**Em partes:**
1. **Uma língua de luta só.** O Comandante luta em campo com os verbos do duelo, nas mesmas teclas:
   - Espaço, golpe leve; Q, golpe pesado; Shift, bloquear (na hora certa, apara); F, esquiva; E, empurrão.
   - O fôlego aparece junto da vida dele.
   - Contra a tropa comum, o leve corta em arco, como hoje, e o pesado derruba escudo.
   - Com a pressão do Marco 24, mergulhar sozinho em seis inimigos mata. A esquiva tira dali.
2. **Oito tipos de adversário.** Cada um pede uma resposta diferente, tem um aviso próprio, um ponto fraco e uma segunda fase com metade da vida.

   | Tipo | Quem é | O que faz | Como se vence |
   | --- | --- | --- | --- |
   | **O Bruto** | chefe orc, brutamontes | Golpes lentos que não se bloqueiam; golpe leve não o interrompe | Esquivar, e bater na folga depois do erro |
   | **O Esgrimista** | capitão de reino, capitão de bando rival | Rápido; finge o pesado e solta o leve; responde a quem ataca sempre igual | Aparar: a postura dele quebra fácil |
   | **O Escudeiro** | sargento, guarda de ossos | Fica atrás do escudo e bate com ele | Empurrão, golpe pesado ou machado |
   | **O Lanceiro** | chefe goblin, cavaleiro a pé | Mantém a distância com estocadas e recua | Esquivar para dentro da estocada: de perto ele não tem defesa |
   | **O Traiçoeiro** | chefe bandido | Joga areia, esconde a adaga, finge que se rende, chama um arqueiro | Pressão: tem pouco vigor e erra quando apertado |
   | **O Feiticeiro** | necromante, xamã | Fica longe, marca o chão antes do feitiço, chama dois esqueletos, some e reaparece | Bater durante o feitiço, que o interrompe; a contra-magia |
   | **A Fera** | lobo alfa, harpia | Sem arma: bote, mordida e salto, em sequências de três; não cai na névoa | Bater depois do terceiro bote |
   | **O Campeão** | cavaleiro da morte, chefe de calamidade | Junta dois tipos e muda na segunda fase | Ler os dois |

   - O tipo sai da espécie e do traço (a ficha do herói ganha `style`). O nível dá ritmo e precisão, como hoje.
   - Cada herói tem ainda **um golpe de assinatura,** com aviso só dele.
3. **A magia no duelo.** Os 6 feitiços ganham uma forma de duelo. Lançar leva tempo, e **apanhar no meio perde o feitiço e desequilibra.**

   | Feitiço | No duelo | Preparo |
   | --- | --- | --- |
   | Bola de fogo | Labareda curta em cone: quebra a guarda e queima | 0,5 s |
   | Gelo | Os golpes dele ficam 40% mais lentos por 4 s: aparar fica fácil | 0,4 s |
   | Névoa | O Comandante some por 1,5 s; o golpe seguinte, pelas costas, é certo | 0,3 s |
   | Remendo | Devolve um pouco de vida | 1,2 s: só com distância |
   | Apagar | Contra-magia: na hora certa, desfaz o feitiço dele | na hora |
   | Pavor | Tira postura; o bravo ignora, o covarde pode se render | 0,6 s |

   - **A escolha:** num duelo de honra (a Liça, o duelo de campeões, um adversário honrado), usar magia custa Honra e faz os seus vaiarem. Contra feiticeiro, fera ou quem usou primeiro, não custa.
   - O arcano, o preço em Honra e Temor e as marcas no corpo continuam valendo.
4. **Decisões que fazem ganhar ou perder.**
   - **Antes:** a arma, 3 técnicas, 2 feitiços e 1 item (atadura, óleo na lâmina, um punhado de areia). Quem sabe o tipo do adversário, por batedor, rumor ou por já ter lutado com ele, prepara-se certo.
   - **O desafio:** antes do duelo, o herói fala, e a fala vem da história entre os dois. Quatro respostas: aceitar, mandar um campeão, recusar (custa Honra e moral) ou jogar sujo (custa Honra, dá Temor).
   - **Desafiar para decidir:** o jogador propõe o duelo de campeões no lugar da batalha, com aposta combinada: a retirada, o resgate ou a rendição do bando dele. O chefe orgulhoso aceita, o covarde não.
   - **Durante, os momentos.** Em pontos do duelo aparece uma escolha, com 1,5 s para responder:
     - ele pede trégua: aceitar acaba ali, mas o Traiçoeiro pode trair;
     - ele caiu: acabar agora ou deixar levantar (Honra contra risco);
     - a espada prendeu no escudo: largar ou puxar;
     - o Comandante está por um fio: render-se (preso, com resgate) ou tudo ou nada (bate mais, defende menos).
   - **Depois:** poupar (ele passa a dever), pedir resgate, executar (Temor), tomar a arma (troféu com nome) ou humilhar (nasce um nêmesis, no Marco 29).
5. **Doze técnicas,** aprendidas com mestres pelo mundo, com heróis vencidos e em torneios: riposta, finta, desarme, passo lateral, golpe baixo, investida de escudo, meia-espada, quebra-guarda, fôlego de ferro, contra-magia sem arcano, olho do caçador e último suspiro. O Comandante leva três.
6. **O anel vivo e o peso do golpe.**
   - A torcida do bando devolve fôlego a quem acerta, e a moral dos dois lados anda golpe a golpe.
   - A parada no golpe, a câmera lenta ao aparar, o som.
   - Na Liça, a arquibancada torce (da parte 12 da etapa 17).
7. **Feridas com efeito,** dos dois lados, que saram em semanas:
   - o olho: os avisos de um lado aparecem mais tarde;
   - a mão: o golpe pesado fica mais lento;
   - a perna: a esquiva fica mais curta;
   - a costela: menos fôlego.
   - Duelar ferido é uma decisão. O nêmesis volta com a ferida que levou.
8. **Onde se duela.**
   - No anel, no meio da batalha, como hoje.
   - No duelo de campeões.
   - Na Liça e nos **torneios de aldeia,** que não pedem fama e têm aposta.
   - Na **briga de taverna:** sem arma e sem morte, só soco, esquiva e empurrão. É onde se aprende a lutar no começo da campanha.
9. **O que faltava dos capitães** (parte 10 da etapa 17):
   - o capitão do bando que perde um duelo pode ser preso;
   - os capitães inimigos que caem também;
   - a figura do herói leva a arma da ficha;
   - o resgate pedido depende da ficha dele.

**Som e arte do marco:** as poses novas (feitiço, bote da fera, areia), o chão marcado do Feiticeiro, a arquibancada que torce, a harpia que pousa; o som de cada golpe de assinatura, a torcida e o silêncio antes do desafio.

**Testes:**
- de unidade: as regras de cada tipo, a magia interrompida, os momentos;
- no navegador (`duelos`): dois robôs enfrentam cada tipo.
  - O robô que só ataca perde de todos os tipos de nível 3 para cima.
  - O robô que lê os avisos vence todos.

**Pronto quando:**
- os dois robôs dão o resultado acima: a habilidade decide;
- o feitiço na hora errada perde o duelo, e o certo vira a luta;
- o mesmo herói, enfrentado duas vezes, luta diferente (a ferida, a segunda fase);
- em campo, o Comandante esquiva, bloqueia e apara;
- em 5 duelos aparecem pelo menos 3 momentos de escolha;
- uma batalha foi evitada por um duelo de campeões.

**A pergunta para o usuário:** você venceu por habilidade? Algum tipo pareceu injusto ou bobo?

## 5. Marco 26 — Missões com história
**Objetivo:** nenhuma missão igual à anterior, e sempre uma escolha no meio.

**Como é hoje** (`data/contracts.ts`): o contrato do começo é sempre "limpar o local". São 4 temas de local, cada um com uma arena só. O cliente é um nome numa lista.

**Em partes:**
1. **A gramática.** Toda missão é objetivo × lugar × quem × reviravolta × pagamento.
   - O `Contract` ganha o objetivo, a reviravolta, o que se sabe, os termos, o prazo e o perfil.
   - As regras ficam em módulos puros: `sim/objectives.ts` e `sim/twists.ts`.
   - O cartão do contrato diz quem pede, por quê, o que se sabe e o que não se sabe.
2. **Seis objetivos novos.**

   | Objetivo | A regra | Como se perde |
   | --- | --- | --- |
   | **Caçar o chefe** | Ele tem nome. Com a moral dele abaixo de 30, foge com a guarda para o lugar mais perto | Se some de vista, paga metade, e ele volta (Marco 29) |
   | **Resgatar vivo** | O refém está preso no local. Solto, segue o Comandante até em casa | Se a corneta toca, um guarda vai até ele em 20 s. Morto, não há paga |
   | **Emboscar o comboio** | O comboio inimigo passa numa estrada num dia sabido. O jogador escolhe onde. Da mata, o primeiro choque pega o inimigo desarrumado | Se o comboio chega ao destino |
   | **Defender até o socorro** | Duas ou três levas em 4 a 6 minutos, numa aldeia. O socorro vem de uma patrulha | A paga cai com as casas queimadas e os moradores perdidos |
   | **Seguir os rastros** | O bando anda, e os rastros envelhecem. À noite, acampado, é pego de surpresa; no vau, é pego dividido | Se o rastro esfria |
   | **Roubar e sair** | Pegar a carga, o preso ou o documento e deixar o local. Não precisa matar. A carroça é lenta | Se a carga é retomada |

   - "Limpar o local" continua existindo, como um entre sete.
   - Ficam para os marcos que os usam: queimar à noite e escoltar com rota (Marco 30), duelo de campeões (Marco 25), investigar (Marco 28).
3. **Dez reviravoltas.** Cada uma é uma escolha. Aparece em cerca de 1 contrato a cada 3, e nunca no primeiro.

   | Reviravolta | Quando | As saídas |
   | --- | --- | --- |
   | O cliente mentiu | ao chegar | Cumprir mesmo assim (paga, custa Honra); recusar; cobrar mais para calar |
   | A contraproposta | antes da luta | Trocar de lado por mais ouro (custa Honra, dá Temor); recusar; fingir que aceita |
   | O terceiro | no meio | Chega outra força: aliar-se, enfrentar as duas ou recuar |
   | Refugiados | ao chegar | Os "goblins" são gente com fome: expulsar, deixar ficar ou levar a outro lugar |
   | O refém não quer voltar | ao soltar | Levar à força, deixar ir ou mentir ao cliente |
   | Sem dinheiro | na volta | Aceitar fiado, tomar à força (Temor) ou aceitar outra coisa: terra, recruta, arma |
   | Chegaram antes | ao chegar | Dividir com quem chegou, tomar deles ou seguir o rastro |
   | Parente | no meio | O chefe inimigo é irmão ou filho de alguém do bando: poupar, prender ou matar. A lealdade muda |
   | Isca | ao chegar | Era emboscada: lutar cercado ou romper e fugir. Quem armou vira rancor |
   | Não é o que disseram | ao recuperar | A carga é outra coisa (gente presa, uma relíquia, cartas de um nobre): entregar, ficar ou vender a outro |

4. **Negociar.**
   - Três alavancas: o adiantamento, o bônus e a parte do saque. Cada uma vai de −25% a +25%.
   - Uma condição dá mais paga: sem saque, sem magia ou prazo curto.
   - A margem vem da necessidade do cliente (fome, ameaça perto) e da Fama.
   - Pedir demais ofende: a oferta some por 3 dias.
5. **Três ofertas, com prazo.** A segura, a arriscada e a estranha. Duram de 4 a 6 dias. A que não for aceita some (no Marco 29, vai para um rival).
6. **Saber antes.** Três graus de informação, e a idade dela:
   - o rumor diz que tipo de inimigo há;
   - o batedor diz quantos (com 20% de erro), o tipo do chefe e o truque do lugar;
   - quem conhece o lugar dá a pista da reviravolta.
   - Ir sem saber é uma aposta: o cartão mostra "?".
7. **Ambições curtas e metas à vista.**
   - Sorteiam-se 3, e o jogador fica com até 2. O prêmio não é só ouro: recrutas, desconto, uma técnica, um troféu.
   - As 12 do começo, entre elas: o segundo batalhão; um contrato sem baixas; a alcunha (3 contratos cumpridos); o primeiro chefe vencido; dois soldos pagos em dia; um torneio de aldeia ganho; três lugares achados pelo batedor; a paliçada.
   - O diário mostra sempre três metas de tamanhos diferentes.
8. **Fracasso que continua.** O refém que morre tem família. O cliente enganado conta para os outros. O chefe que escapou volta.
9. **Os cinco primeiros contratos** de toda campanha seguem uma regra:
   - o primeiro é simples e fica a 1 ou 2 minutos de marcha;
   - o segundo traz um objetivo novo, e o terceiro, a primeira reviravolta;
   - nenhum repete o objetivo do anterior.

**Som do marco:** a corneta do alarme, o selo do contrato, o "não" do cliente ofendido, a carroça da carga.

**Testes:**
- de unidade: a máquina de estados de cada objetivo e a condição de cada reviravolta;
- no navegador (`missoes`): um robô cumpre e perde cada objetivo; 10 contratos gerados em seguida têm a variedade pedida.

**Pronto quando:**
- em 10 contratos seguidos do começo aparecem pelo menos 5 objetivos diferentes e 3 reviravoltas;
- não há dois contratos seguidos com o mesmo objetivo no mesmo lugar;
- o jogador recusou ou renegociou pelo menos uma oferta;
- há sempre três metas na tela.

**A pergunta para o usuário:** qual missão você contaria para alguém?

## 6. Marco 27 — O mundo refeito: lugares vivos
**Objetivo:** o mapa surpreende. Quem mora em cada lugar muda com o mundo.

**Como é hoje:** cerca de 12 locais por continente, fixados quando o mundo nasce (`generateWorld.ts`). Limpo, o local enche de novo no mesmo ponto (`sim/siteLife.ts`).

**Em partes:**
1. **O gerador muda uma vez só.** Tudo o que os marcos seguintes precisam do mapa entra aqui:
   - de 30 a 40 lugares por continente;
   - as ilhas pequenas no Mapa Múndi (da parte 4 da etapa 17);
   - em cada povoado, o ponto da oficina e da casa de cada notável (Marco 28);
   - o pátio onde um bando rival passa o inverno (Marco 29);
   - os campos abertos perto das fronteiras, para as batalhas campais (Marco 30).
   - **Os saves mudam de versão.** Um save da Fase 3 mostra um aviso claro e não carrega. A suíte `saves` ganha saves novos.
2. **Doze tipos de lugar,** com 2 ou 3 arenas cada, montadas com peças: ruína, vau, caverna, moinho abandonado, torre velha, fazenda queimada, pedreira, santuário, clareira, forte velho, cemitério e campo de batalha antigo.
   - As peças: paliçada, torre, jaula, carroça de saque e saída dos fundos.
3. **Quem mora muda** (`sim/places.ts`, novo). Uma vez por semana:
   - **os sobreviventes fogem:** se 30% do bando escapa, ele vai para um lugar vazio a mais de 4000 de distância, chega em 2 a 4 dias e guarda rancor;
   - **os bandidos seguem o comércio:** escolhem lugares a até 3000 de uma rota com movimento, e mudam quando as caravanas somem;
   - **os desertores** aparecem perto de um campo de batalha, vindos do exército que perdeu;
   - **os mortos se levantam** onde houve muita morte nos últimos 30 dias, se há necromante vivo no continente;
   - **os goblins** saem dos covis cheios e ocupam o lugar vazio ao lado;
   - **as feras** tomam os lugares afastados no inverno.
4. **Quem é ignorado cresce.**

   | Estágio | Quando | O que muda |
   | --- | --- | --- |
   | Acampamento | ao chegar | Saques a até 3000 |
   | Paliçada | 10 dias sem ser incomodado, com 20 ou mais | Saques a até 5000; a fumaça se vê de longe |
   | Forte | 25 dias, com 40 ou mais | Saques a até 8000; estandarte próprio. Com um chefe de nome, vira o flagelo da região (Marco 29) |

5. **Quatro truques de lugar.**
   - **A sentinela e a corneta:** ela vê a 400 de dia e a 200 à noite. Se toca, o acampamento acorda em 10 s, e o lugar vizinho manda reforço em 3 minutos.
   - **As armadilhas:** covas e estrepes, que atrasam e ferem, mais ainda a cavalaria. O batedor mostra onde estão.
   - **O refém,** que muda como se ataca.
   - **O altar do necromante:** os mortos se levantam de novo a cada 20 s, até o altar cair. O fogo o derruba mais depressa.
6. **Inimigos com jeito próprio** (planos novos no `WarHost`):
   - **goblin:** embosca da mata, bate e foge, larga a luta com metade do bando e volta à noite;
   - **morto-vivo:** não tem moral, anda devagar e não para;
   - **orc:** investe em cunha no ponto mais fraco, com os brutamontes na frente;
   - **bandido:** põe os arqueiros no alto e foge com o saque quando está perdendo.
7. **Achados.** Um lugar vazio pode guardar um, e só um: esconderijo, santuário, eremita (ensina uma técnica ou um feitiço), campo de batalha antigo (armas, com risco de mortos) ou mapa de tesouro, que leva a outro lugar.
8. **Rumores viram pistas.** O rumor da taverna aponta para um lugar, um achado ou um perigo, com idade. Três em cada dez são falsos.
9. **O que faltava dos locais** (parte 11 da etapa 17): os moradores andam pela região e saem para caçar, e o contrato não aponta para um lugar recém-limpo.

**Som e arte do marco:** as peças dos 12 tipos de lugar, o altar, a jaula, a fumaça dos três estágios; a corneta da sentinela e o tambor do acampamento goblin, que se ouve antes de se ver.

**Testes:**
- de unidade (`places.test.ts`): cada regra de ocupação e de crescimento;
- simulação de 60 dias em 20 mundos: a mistura de ocupantes e quantos lugares cresceram;
- no navegador (`locais`): a fuga dos sobreviventes, a corneta e o altar.

**Pronto quando:**
- duas campanhas na mesma semente, no dia 30, têm inimigos em lugares diferentes;
- limpar um ninho faz os sobreviventes aparecerem em outro lugar;
- um bando ignorado por 25 dias levantou um forte, e isso se vê de longe;
- matar a sentinela antes da corneta muda a luta;
- os mortos param de se levantar quando o altar cai.

**A pergunta para o usuário:** o mapa te surpreendeu alguma vez?

## 7. S2 — Som, parte 2: o mundo que se ouve
**Objetivo:** de olhos fechados, dá para saber onde se está, que horas são e se há perigo perto.

**Em partes:**
1. **O ambiente de cada chão.** Mata (pássaros, vento nas folhas), campo (vento, insetos), pântano (sapos), colina (vento forte), neve (vento abafado) e costa (ondas, gaivotas).
2. **A hora e o tempo.** Pássaros de dia, grilos ao anoitecer, corujas e lobos ao longe à noite, o galo de madrugada. Chuva leve e forte, trovão, rajadas, o silêncio da neve.
3. **A água.** O rio e o mar ficam mais altos de perto. A ponte de madeira e o vau têm passo próprio.
4. **Os povoados.**
   - O burburinho cresce com a população e a prosperidade. A cidade saqueada tem silêncio e corvos.
   - Os pregões do mercado, na fala inventada de cada cultura.
   - O martelo do ferreiro ao longe, o sino do templo na hora e no dia santo, os cachorros.
5. **O acampamento conta o estado do bando.** É a regra "aparece no mundo antes da interface", agora para o ouvido:
   - com fome, resmungos; com a moral baixa, pouco som; com o soldo atrasado, cochichos;
   - depois da vitória, cantoria e riso;
   - nas obras, serrote e martelo; à noite, a fogueira e o grito da sentinela.
6. **Os lugares e os inimigos.** Cada tipo de lugar tem o seu fundo (a goteira da caverna, o vento na ruína, o moinho que range). O acampamento inimigo se ouve antes de ser visto: o tambor goblin, a risada dos bandidos, o sussurro dos mortos.
7. **O som do que não se vê.** O que está fora da vista chega abafado, mas com direção. Ouvir vira um jeito de explorar.
8. **O mar.** O casco que range, as velas, a tempestade.

**Testes:** de unidade, a escolha das camadas por chão, hora e tempo; no navegador, o fundo muda ao atravessar da mata para a costa e ao anoitecer.

**Pronto quando:**
- em 30 s de olhos fechados dá para dizer o chão, a hora, o tempo e se o povoado ao lado é rico ou está arruinado;
- um acampamento inimigo se ouve antes de aparecer na tela;
- o acampamento do bando soa diferente com fome e depois de uma vitória.

**A pergunta para o usuário:** o mundo parece mais vivo? Você já achou alguma coisa pelo som?

## 8. Marco 28 — Gente com nome
**Objetivo:** as cidades têm gente de quem o jogador lembra o nome, e é ela que pede as missões.

**Como é hoje:** ferreiro, taverneiro e mestre da guilda são balcões. Só os nobres têm família, opinião e memória (`sim/nobility.ts`).

**Em partes:**
1. **O miolo comum** (`sim/people.ts`, novo). O que os nobres já têm vira uma base para toda gente com nome: idade, gênero, traços, família, opinião e memória.
   - **O gênero passa a ser guardado** para o Comandante, os tenentes e os capitães (da parte 3 da etapa 17). O título de quem herda sai certo.
2. **Os notáveis.** Três por aldeia, quatro ou cinco por cidade, de seis a oito na capital.
   - A ficha: nome, idade, gênero, ofício, perícia de 1 a 5, dois traços, bens, um problema, o que acha do bando e o que lembra dele.
   - O retrato sai do gerador que já existe.
3. **A família.** Seis em cada dez são casados, com até 3 filhos. Três em cada dez têm um parente longe:
   - em outra cidade;
   - no bando: ao recrutar numa aldeia, alguns soldados são filhos de notáveis de lá;
   - num bando inimigo;
   - a serviço de um nobre.
4. **A vida** (uma vez por mês, pelas regras da nobreza): casar, ter filho, adoecer, morrer, falir, enriquecer, brigar com outro notável, mudar de cidade.
   - O mundo bate neles: num saque, cada um pode morrer ou perder os bens; no cerco, passam fome; com preço alto, enriquecem.
   - Quando um morre, o filho ou o aprendiz assume o ofício.
   - Longe do bando, tudo roda de forma abstrata.
5. **No mundo, e não no menu.**
   - Cada um tem três pontos: o trabalho de dia, a taverna ou o templo à noite, e a casa.
   - A figura mostra o nome ao passar o cursor, e a conversa mostra o retrato.
   - Ele cumprimenta conforme a opinião, conta as novidades desde a última visita, oferece o serviço e faz o pedido, se tiver um.
6. **O serviço depende da pessoa.**

   | Ofício | O que a perícia muda |
   | --- | --- |
   | Ferreiro | Com 5, forja uma arma com nome |
   | Taverneira | Rumores mais certos |
   | Curandeira | Mais feridos voltam, para quem luta perto dali |
   | Caçador | Guia pela mata: o bando não é emboscado na região e pega o inimigo de surpresa |
   | Mestre de armas | Ensina uma técnica de duelo |
   | Agiota | O empréstimo ganha rosto, e cobradores |
   | Bardo | Canta os feitos do bando (Fama), ou debocha |
   | Contrabandista | Mercado da noite e salvo-condutos |
   | Sacerdote | A fé do povoado e as bênçãos |
   | Mestre de guilda | Contratos de comércio |
   | Capitão da guarda | Recompensas por cabeça e notícias das patrulhas |
   | Moleiro | O preço das rações |

7. **Doze moldes de missão pessoal.** Nascem de problema + família + acontecimento, na gramática do Marco 26.

   | Molde | O que é |
   | --- | --- |
   | O filho fugido | Ele está no meio do bando inimigo e luta contra o bando. É para voltar vivo |
   | Vingança | Caçar o chefe que matou alguém da família |
   | A noiva | Escoltar; o pretendente recusado embosca |
   | O rival do ofício | Investigar a sabotagem: falar com três pessoas, achar os rastros, e então denunciar ou cobrar pelo silêncio |
   | A dívida | O agiota vai tomar a oficina: pagar, intimidar ou roubar a promissória |
   | O ferro | Levar a matéria-prima a uma cidade cercada |
   | O irmão preso | Tirar da masmorra de um nobre: suborno, favor ou assalto |
   | A relíquia | Recuperar a do templo. Pode não ser o que disseram |
   | A fera | Caçar o lobo ou a harpia que mata o gado: um duelo contra a Fera |
   | O herdeiro inútil | Levar o filho para o bando e fazer dele gente |
   | A carta | Entregar em outra cidade. Dá para abrir |
   | O último desejo | Levar um moribundo ao campo onde lutou, ou ao parente brigado |

   - O pagamento pode não ser ouro: desconto para sempre, uma arma, um recruta, um mapa, um favor.
8. **Vínculo e o Livro de gente.**
   - Opinião 40 ou mais: desconto, avisos (um ataque a caminho, um rival na cidade), presentes.
   - Opinião 70 ou mais: entra no bando como seguidor, esconde o Comandante, empresta sem juros.
   - Opinião −40 ou menos: porta fechada, e pode pagar um rival contra o bando.
   - O **Livro de gente** guarda quem se conhece, as famílias, quem deve e quem odeia.

**Som e arte do marco:** as crianças numa figura menor (da parte 12 da etapa 17), a placa de cada oficina; a voz de cada notável, tirada da semente dele.

**Testes:**
- de unidade (`people.test.ts`, `notables.test.ts`): a geração, a família, a vida mensal, a herança do ofício;
- simulação de 2 anos em 20 mundos: todo povoado mantém os seus ofícios, e ninguém vive 200 anos;
- no navegador (`gente`): a conversa, o serviço que muda com a opinião e uma missão pessoal do começo ao fim.

**Pronto quando:**
- os 5 primeiros contratos de uma campanha vêm de gente com rosto;
- a vida de um notável muda sem o jogador, e a taverna conta;
- um favor feito volta como ajuda que ninguém pediu;
- depois de uma hora, o usuário lembra três nomes.

**A pergunta para o usuário:** de quem você lembra o nome? De quem gostou, de quem teve raiva?

## 9. Marco 29 — Rivais e nêmesis
**Objetivo:** a campanha ganha adversários com rosto e uma medida de quanto o bando subiu.

**Em partes:**
1. **Bandos rivais** (`sim/rivals.ts`, novo). De 3 a 5 por continente.
   - Cada um tem nome, estandarte, capitão (com ficha e tipo de duelo), estilo, fama, tamanho e o que acha do bando.
   - Quatro estilos: o honrado, o carniceiro, o barato e o de elite.
   - Andam no mapa como os outros bandos, lutam nas guerras e passam o inverno numa cidade, onde o capitão está na taverna.
   - Longe do bando, os serviços deles se resolvem pela conta das expedições.
2. **A disputa.** Toda semana, um rival pode:
   - aceitar uma das três ofertas, que some com a notícia de quem levou;
   - chegar antes ao lugar (a reviravolta "chegaram antes" passa a ter nome);
   - propor sociedade num serviço grande, dividindo a paga;
   - provocar na taverna, o que pode acabar em briga ou em duelo;
   - chamar os homens do bando quando o soldo atrasa.
   - O jogador sempre tem três respostas: correr na frente, dividir, ou sabotar e desafiar.
3. **Contratar um rival.** Ele luta ao lado do bando, como aliado da IA, por uma parte da paga. O carniceiro saqueia o que não devia; o de opinião baixa pode mudar de lado no meio.
4. **A tábua dos bandos.** O ranking de fama, na taverna, na guilda e no Livro do Bando: a posição do bando, quem está logo acima e o que cada um fez por último. Passar um rival é notícia.
5. **Nêmesis** (`sim/nemesis.ts`, novo). O herói inimigo que escapou, foi poupado, humilhado ou resgatado guarda um rancor:
   - sobe de nível e ganha a ferida que levou;
   - **muda de tropa contra o que o venceu:** perdeu para a cavalaria, volta com lanças;
   - volta no comando de um bando, como campeão de um exército ou pago por um inimigo do bando;
   - fala do passado ao desafiar.
   - No máximo dois de cada vez. O poupado também pode voltar como aliado.
6. **O flagelo da região.** O bando que chegou a forte (Marco 27) ganha um chefe com nome e vira uma calamidade pequena:
   - os saques crescem, as aldeias pedem socorro, os notáveis fogem;
   - uma cadeia de 3 a 5 contratos, de clientes diferentes, que termina no assalto ao forte dele.
   - É o primeiro vilão de toda campanha (Marco 34).

**Som do marco:** um motivo curto para cada rival e para cada nêmesis, que toca quando ele aparece (ganha corpo no S3).

**Testes:**
- de unidade: a semana dos rivais, o rancor e a mudança de tropa;
- simulação de 120 dias em 20 mundos: a tábua anda, nenhum rival some, e nenhum toma todos os contratos;
- no navegador (`rivais`): uma oferta levada, o rival no lugar, a sociedade e o nêmesis que volta.

**Pronto quando:**
- em 30 dias, um rival toma um contrato do jogador, e ele consegue responder dos três jeitos;
- um chefe que fugiu volta mais forte, com outra tropa, e chama o bando pelo nome;
- o jogador sabe a posição dele na tábua e quem está logo acima;
- o flagelo cai no fim de uma cadeia, e a região muda depois.

**A pergunta para o usuário:** você quis derrubar alguém?

## 10. Marco 30 — Guerras com causa
**Objetivo:** de vez em quando há guerra no mapa. Ela tem um motivo de verdade, se vê, e às vezes foi o bando que a provocou.

**Como é hoje** (`sim/kingdoms.ts`):
- os reinos já entram em guerra, levantam exércitos, sitiam e fazem paz;
- a guerra nasce de um sorteio semanal, e o motivo é uma frase tirada de uma lista ("uma velha disputa de fronteira");
- o que o bando faz não provoca guerra entre reinos;
- o cerco de um reino a outro é uma conta: não há escadas nem aríetes à vista;
- o comboio e as expedições do bando também são contas.

**Em partes:**
1. **A tensão entre reinos.** Cada par de reinos tem uma tensão de 0 a 100, que cai 2 por semana.

   | O que aconteceu | Tensão |
   | --- | --- |
   | Saque de fronteira por uma patrulha | +5 |
   | Caravana queimada | +8 |
   | Ponte queimada | +12 |
   | Noivado desfeito, pedágio disputado | +10 |
   | Povoado disputado (era de um, está com o outro) | +3 por semana |
   | Nobre preso | +15 |
   | Nobre morto | +25 |
   | Aliança ou casamento | −20 |

   - **O que o bando faz a serviço de um reino conta como ato desse reino.**
   - Com 70 ou mais, o rei decide: pesa a força, o tesouro, a estação e o próprio temperamento.
   - A guerra é declarada com **a causa de verdade** na crônica, e ganha nome por ela: "a Guerra da Ponte Queimada".
   - O sorteio de hoje vira um empurrão pequeno, para haver guerra mesmo sem o jogador.
   - **O ritmo:** de 1 a 3 guerras a cada 120 dias por continente, e nunca mais de duas ao mesmo tempo, fora as civis.
2. **A guerra se anuncia.** Antes de aparecer num painel, aparece no mundo:
   - o arauto lê a declaração na praça, com trombetas;
   - o recrutamento acampa fora das cidades;
   - os refugiados tomam as estradas, e os preços mexem;
   - **os dois lados disputam o bando,** com ofertas que sobem.
3. **O bando na guerra.** Três jeitos de entrar:
   - **assinar com um lado** pela estação: soldo de guerra por semana, direito de saque e uma lista de objetivos;
   - **ficar solto,** serviço por serviço;
   - **servir aos dois.** Paga mais, e se descobrem, os dois viram inimigos.
   - Os serviços de guerra: cortar o suprimento (emboscar o comboio), segurar um vau ou uma ponte, achar o exército inimigo, queimar à noite, escoltar com escolha de rota, prender um nobre, subir primeiro na muralha.
4. **A batalha campal.** Quando dois exércitos se encontram perto do bando, ou por contrato, há uma batalha grande, com aliados da IA.
   - O bando é uma ala, sob o comando de um lorde.
   - **Antes, o conselho:** o lorde mostra o plano, e o jogador pode propor outro. A Tática dos capitães pesa.
   - **Durante, a ordem:** "segurem a colina", "ataquem o flanco direito". Obedecer ou não é do jogador: desobedecer pode ganhar a batalha ou perder o contrato.
   - **Depois:** o saque se divide pelo que cada um fez.
5. **Os cercos da IA à vista** (parte 7 da etapa 17). Perto do bando, o cerco de um reino a outro tem acampamento, escadas, aríetes e surtidas. Dá para romper o cerco, entrar nele, furar o bloqueio com comida ou só assistir.
6. **O comboio e as expedições no mapa** (parte 8 da etapa 17).
   - A coluna do comboio anda de verdade e pode ser atacada.
   - A luta dela, e a de uma expedição, vira batalha, e não uma conta.
   - A suíte de navegador do comboio.
7. **Guerras que o bando provoca.**
   - **Sem querer:** todo ato a serviço de um reino soma tensão. Dois ou três serviços contra o mesmo vizinho bastam.
   - **De propósito, o incidente:** um nobre que quer a guerra paga por um ataque com as cores do outro lado. Custa muita Honra, e pode ser descoberto.
   - **Pela ambição:** o bando que toma um povoado, ou defende um povoado livre da anexação, entra na guerra por conta própria.
   - **E para evitar:** levar a carta de paz, escoltar a noiva, desmascarar o incidente de outro.
8. **A paz e as marcas.**
   - O tratado tem termos: terra, tributo, reféns e casamento.
   - A região fica marcada: fazendas queimadas (lugares do Marco 27), desertores que viram bandidos, veteranos sem emprego para contratar.
   - Os nobres lembram de que lado o bando esteve.

**Som do marco:** as trombetas do arauto, o acampamento de recrutamento, o rugido de duas linhas grandes, o conselho antes da batalha.

**Testes:**
- de unidade: a soma da tensão, a decisão do rei, o nome da guerra;
- simulação de 400 dias em 20 mundos: o número de guerras no ritmo pedido, e toda guerra com uma causa na crônica;
- simulação com atos do bando: queimar a ponte e prender um nobre levam à guerra na maioria dos mundos;
- no navegador (`guerras`): a batalha campal acaba, o cerco da IA se vê, o comboio atacado vira batalha.

**Pronto quando:**
- em 120 dias sem o jogador há de 1 a 3 guerras por continente, cada uma com a causa na crônica;
- dois ou três atos do bando levam dois reinos à guerra, e a crônica dá o nome do bando;
- o jogador luta uma batalha campal como ala de um exército, e pode desobedecer;
- um cerco da IA tem escadas e aríetes, e dá para rompê-lo;
- o comboio atacado vira uma batalha.

**A pergunta para o usuário:** a guerra pareceu sua? Você sentiu que a causou, ou que podia ter evitado?

## 11. Marco 31 — A Grande Questão e as calamidades
**Objetivo:** a campanha tem uma trama, sem roteiro. Cada mundo nasce com uma crise lenta que anda sozinha, e o bando pode ignorar, aproveitar ou decidir.

É o pilar "gerador de histórias" do GDD com uma espinha: a história continua nascendo da simulação, mas agora tem começo, meio e fim.

**Em partes:**
1. **A Grande Questão** (`sim/question.ts`, novo). Cada mundo sorteia uma, entre seis moldes, e a preenche com a gente dele: os nobres, os notáveis, os rivais e a história gerada.

   | Molde | O que acontece | O que o bando pode ser |
   | --- | --- | --- |
   | **A Coroa Partida** | O rei morre sem herdeiro claro, e os pretendentes se armam | Fazedor de reis, ou pretendente |
   | **A Fé em Chamas** | Um profeta racha uma fé, e vem a guerra santa | Escudo dos perseguidos, braço da cruzada, ou quem lucra com os dois |
   | **O Inverno dos Mortos** | Os mortos se levantam nos campos de batalha: quanto mais guerra, mais mortos | Quem acha o nome verdadeiro do necromante, ou quem alimenta a guerra |
   | **A Maré de Ferro** | Uma frota desembarca, e a costa cai | Quem une os reinos, ou quem se vende ao invasor |
   | **O Rei Mercenário** | O capitão de um bando rival toma terra e se faz rei | Quem o serve, quem o detém, ou quem chega lá antes |
   | **A Fome Longa** | Colheitas ruins, revoltas e reinos que desmoronam | Quem alimenta, ou quem saqueia |

2. **Três atos, num relógio.**
   - **Ato 1, os sinais** (até o dia 30): rumores, um presságio, uma notícia de longe.
   - **Ato 2, a crise** (entre os dias 120 e 200): a Questão vira guerra, fome ou invasão, e os contratos passam a girar em volta dela.
   - **Ato 3, o desfecho** (entre os dias 300 e 450): uma grande cena final. A coroação disputada, a cidadela do necromante, a batalha na praia, o cerco ao rei mercenário, o comboio de grão para a capital faminta.
   - **Anda sozinha.** Sem o jogador, ela chega ao fim e tem um vencedor.
   - Cada passagem de ato é um acontecimento no mundo, e vira um capítulo nas Lendas.
3. **As missões da Questão.** De 3 a 4 cadeias por ato, na gramática do Marco 26, com escolhas que ficam marcadas e mudam o desfecho.
4. **A Questão move o resto.** Ela soma tensão entre os reinos (Marco 30), bate nos notáveis (Marco 28), levanta ou derruba rivais (Marco 29) e enche os lugares (Marco 27).
5. **As calamidades de cada continente** (parte 6 da etapa 17). Hoje são duas, o necromante e a horda orc. Cada cultura ganha a sua:

   | Continente | Calamidade | Fraqueza |
   | --- | --- | --- |
   | Reinos | O necromante; a horda orc | O fogo; a morte do Senhor da Guerra |
   | Ilhas | Os Corsários do Rei do Mar, com base numa ilha | A frota ancorada: queimar os navios |
   | Areias | O Profeta do Sol, que converte povoado por povoado | A fé: ganhar os sacerdotes, desmascarar os milagres |
   | Jade | **A Corte de Cinzas** (mágica): queima as colheitas e levanta soldados de cinza | **A água:** a chuva, o inverno e o feitiço Apagar |

6. **O fim.** O desfecho da Questão, junto com o caminho do bando (Marco 32), dá o epílogo.

**Som do marco:** o presságio, a passagem de ato, o tema de cada calamidade (S3).

**Testes:**
- de unidade: os três atos de cada molde e as marcas que mudam o desfecho;
- simulação de 600 dias em 20 mundos: toda Questão chega ao ato 2 e ao ato 3 nas janelas pedidas, sem o jogador, e termina;
- no navegador: uma cadeia de cada molde, e a calamidade nova de cada continente com a sua fraqueza.

**Pronto quando:**
- todo mundo novo mostra os sinais da Questão nos primeiros 30 dias, por rumor e não por menu;
- ela anda e termina sem o jogador;
- o jogador muda o desfecho de cada molde de pelo menos dois jeitos;
- cada continente tem a sua calamidade, e a Corte de Cinzas cai pela água.

**A pergunta para o usuário:** você quis saber como a história do mundo ia acabar?

## 12. S3 — Som, parte 3: a música
**Objetivo:** música própria, feita no código, que acompanha o que acontece e dá um tema ao bando.

**Em partes:**
1. **Os instrumentos,** sintetizados: alaúde (corda pinçada), flauta, viela de roda (o bordão), tambor, pandeiro, sinos e um coro de vogais.
2. **Um modo por cultura.** Reinos, Ilhas, Areias e Jade usam escalas diferentes. Atravessar o mar muda a música.
3. **O tema do bando.** Cada campanha gera uma melodia de 8 compassos, a partir da semente. Ela volta na fanfarra da vitória, na cerimônia de ato, e na taverna, quando o bardo canta os feitos do bando.
4. **Os estados,** em camadas que entram e saem no compasso:

   | Estado | A música |
   | --- | --- |
   | Exploração | Calma e rala: alaúde e flauta |
   | Acampamento | Quente e lenta |
   | Cidade e taverna | Uma dança |
   | Tensão (inimigo perto) | Bordão e pulso de tambor |
   | Batalha | Tambores e viela; cresce com o tamanho da luta |
   | Duelo | Um tambor só, que acelera quando a postura cai |
   | Luto, cerimônia, calamidade | Cada um com o seu |
   | Mar | Canto de trabalho |

5. **O silêncio é um estado.** Depois de uma música, um tempo sem nenhuma.
6. **Os motivos.** Cada rival, cada nêmesis e cada calamidade tem um motivo curto, que avisa a chegada.

**Testes:** de unidade, o gerador de melodia (dentro do modo, sem saltos feios) e a troca de estado no compasso.

**Pronto quando:**
- em uma hora de jogo a mesma música não toca duas vezes seguidas;
- entrar e sair da batalha muda a música em até 2 compassos;
- o tema do bando se reconhece em 3 lugares diferentes.

**A pergunta para o usuário:** você assobiaria o tema do bando? A música cansa?

## 13. Marco 32 — A escada da campanha
**Objetivo:** a campanha tem capítulos, rumo a toda hora e finais diferentes.

**Como é hoje:** as 6 ambições são de fim de jogo. O bando cresce no acampamento, mas o que se faz no dia a dia não muda.

**Em partes:**
1. **Cinco atos, pelo nome do bando.** Cada um pede fama, tamanho e base (a escada do acampamento do GDD 9.1), tem uma prova e uma cerimônia, e muda o que se faz.

   | Ato | Base | A prova | O que abre |
   | --- | --- | --- | --- |
   | I. Desconhecidos | bivaque | Derrubar o flagelo da região | A alcunha e os contratos das cidades |
   | II. Companhia com nome | acampamento | Vencer um bando rival: num serviço disputado, num torneio ou em campo | A carta de companhia: contratos de lordes |
   | III. Companhia de guerra | paliçada grande | Lutar uma batalha campal numa guerra | O soldo de guerra e a terra prometida |
   | IV. Senhores de terra | fortaleza | Defender a sede de um cerco | O título, a corte e os vassalos |
   | V. Coroa ou lenda | cidade | O desfecho da Grande Questão | O fim da saga |

   - **A cerimônia:** o estandarte novo, a alcunha ganha pelos feitos ("os Quebra-Cercos", "os Sem-Palavra") e o tema do bando.
2. **O soldo como coração da semana.** Os dias até o pagamento e o caixa projetado ficam à vista. As quatro primeiras semanas são apertadas, mas justas.
3. **O Cronista** (`sim/chronicler.ts`, novo). Um diretor de ritmo, que escolhe o próximo acontecimento por uma curva de tensão, e não por sorteio puro.
   - Depois de uma derrota dura, um respiro e uma chance de volta. Depois de uma sequência fácil, um desafio.
   - Três temperamentos, escolhidos ao criar o mundo: o calmo, o clássico e o cruel.
   - Ele escolhe entre o que a simulação oferece. Não inventa o que não existe.
4. **Eventos.** De 11 para mais de 60, nascidos do estado do bando e em cadeia: a decisão de hoje volta depois.
   - **De acampamento:** a fogueira de noite, a briga, o desertor, a doença, a festa.
   - **De estrada** (de 20 a 30): a carroça quebrada, os peregrinos, o pedágio, o cavaleiro ferido, o bando rival que propõe uma aposta.
   - **De cidade:** o julgamento, a feira, o casamento de um notável, o incêndio.
   - **Cartas:** os notáveis, as famílias e o nêmesis escrevem, e o mensageiro traz.
5. **Veteranos com nome.**
   - Um feito em batalha dá nome a um soldado: matou o chefe, ficou de pé sozinho, salvou o estandarte.
   - No máximo três por batalhão, cada um com uma pequena vantagem.
   - Pode virar sargento, e depois tenente ou capitão. A morte dele é notícia, e pesa na moral.
6. **Depois da batalha.** Uma tela com decisões: quem se destacou, 1 de 3 saques, os presos, os feridos.
7. **Troféus e relíquias.** Coisas com história: a arma do chefe vencido, o estandarte tomado, a relíquia achada.
   - Ficam à vista no mastro de troféus, que já existe.
   - Quatro espaços para o Comandante e os oficiais: arma, armadura, amuleto e montaria.
8. **Tenentes com arco.** Cada um tem uma questão pessoal: uma dívida, um irmão perdido, um juramento. Resolvê-la muda a passiva dele, que hoje é sorteada e fixa.
9. **O Comandante cresce por feitos,** e não por pontos: o primeiro duelo ganho, a primeira batalha campal, o primeiro cerco. Cada feito dá uma marca, que abre uma ordem de batalha: "Segurem!", "Comigo!", "No chefe!", "Recuar em ordem".
10. **Cinco caminhos, cinco finais.** O caminho sai do que o bando fez, e não de um menu.

    | Caminho | Como se chega | O fim |
    | --- | --- | --- |
    | **Honra** | Palavra cumprida, povo defendido | O herói do povo |
    | **Temor** | Saque, execuções, jogo sujo | O flagelo |
    | **Ouro** | Comércio, feitorias, empréstimos | O príncipe mercador |
    | **Coroa** | Terra, corte e guerra | O rei, ou o fazedor de reis |
    | **Fama** | O topo da tábua dos bandos | A maior companhia que já houve |

    - O epílogo junta o caminho com o desfecho da Grande Questão.
11. **As Lendas** (o resto da parte 3 da etapa 17).
    - **Nomes iguais** não confundem mais as páginas: cada linha da crônica guarda de quem fala, e a página sai disso, e não do texto.
    - **Mundos que lembram** guardam também as vilas fundadas pelo bando, o mapa político do fim, os nomes das guerras e o desfecho da Questão.

**Som do marco:** a cerimônia de ato, o soldo pago e o soldo atrasado, a fogueira, a carta que chega.

**Testes:**
- de unidade: as provas, o Cronista (a curva de tensão), os feitos, os caminhos;
- simulação: o Cronista cruel dá mais apuros que o calmo, e nenhum dos três deixa 10 dias sem nada acontecer;
- no navegador (`campanha`): a subida do ato I para o II, um veterano que ganha nome e dois finais.

**Pronto quando:**
- a qualquer hora, o diário responde "o que eu quero fazer agora?" com três metas de tamanhos diferentes;
- subir de ato é um acontecimento: prova, cerimônia e coisas novas para fazer;
- o jogador sabe quantos dias faltam para o soldo e se o caixa fecha;
- ao fim de uma batalha, alguém do bando ganhou nome;
- dá para chegar a dois finais diferentes.

**A pergunta para o usuário:** o que te fez querer jogar mais um dia?

## 14. G7 — Arte: o mar e o acabamento
**Objetivo:** fechar o acabamento que ficou da Fase 3, logo antes do marco que mais usa o mar.

O que vem da parte 12 da etapa 17:
- a água que se mexe também de longe, e a onda que corre na praia;
- o mar que se mexe até longe dos navios;
- o mastro de pé no convés;
- o zoom na Cidade Alta;
- menos telhado liso nos prédios grandes.

Três itens da mesma lista foram para os marcos que os usam: a arquibancada que torce e a harpia que pousa (Marco 25) e as crianças menores (Marco 28).

**Pronto quando:** o [ARTE.md](ARTE.md) não tem mais nenhum desses itens em aberto.

## 15. Marco 33 — O mar de verdade
**Objetivo:** o mar deixa de ser uma tela de espera. É o resto das partes 4 e 5 da etapa 17.

**Como é hoje:** a viagem são segundos assistindo, com 3 eventos. O navio é só capacidade. As ilhas pequenas entram no gerador no Marco 27.

**Em partes:**
1. **As ilhas pequenas.** Com porto, esconderijo de piratas e contratos próprios.
2. **A carga própria.** Despachar mercadoria por barcaça ou navio, sem o bando ir junto, com risco de pirata e de tempestade.
3. **As tropas de ultramar.** Recrutar as tropas típicas de cada continente.
4. **O navio é mais que capacidade:** velocidade, casco e tripulação. O casco danificado se conserta no porto, e custa.
5. **A batalha entre navios,** em três tempos:
   - **a aproximação:** fugir, se o navio for mais rápido, ou trocar flechas;
   - **a abordagem:** a luta no convés, que já existe;
   - **o depois:** o dano no casco. **A frota pode afundar.**
6. **A viagem com escolhas.** De 3 eventos para mais de 10: a calmaria, o motim, o náufrago, a ilha sem carta, a vela desconhecida.
7. **Reinos que invadem pelo mar.** Uma guerra (Marco 30) pode vir de navio, e a Maré de Ferro (Marco 31) é isso em grande escala. Os Corsários do Rei do Mar têm a base numa ilha.

**Som do marco:** a batalha naval, o casco que cede, o porto.

**Testes:** de unidade, o casco, a fuga e o afundamento; no navegador (`mar`), a batalha entre navios do começo ao fim, uma carga despachada que chega e uma invasão que desembarca.

**Pronto quando:**
- uma batalha entre navios pode acabar com um navio no fundo;
- uma carga despachada chega, ou se perde com notícia;
- um reino desembarca um exército na costa do outro;
- numa viagem longa, o jogador decide alguma coisa pelo menos 3 vezes.

**A pergunta para o usuário:** a viagem deixou de ser espera?

## 16. Marco 34 — A primeira hora
**Objetivo:** o começo prende. É a prova de que os outros marcos funcionam juntos.

**Em partes:**
1. **Começar no meio de uma luta.** O primeiro minuto é uma escaramuça pequena, que ensina a andar, mandar, dividir o batalhão e flanquear. Quem o bando salva ali vira o primeiro notável amigo.
2. **O arco do primeiro vilão.** Quatro missões geradas contra o flagelo da região, cada uma ensinando uma coisa:
   - as ordens e o flanco;
   - a reviravolta e a escolha;
   - o batedor e o ataque à noite, antes da corneta;
   - o assalto à paliçada dele, com o primeiro duelo.
3. **Uma novidade a cada 5 minutos.**

   | Minuto | O que acontece |
   | --- | --- |
   | 0 a 2 | A primeira luta |
   | 5 | O primeiro amigo com nome, e o bivaque |
   | 10 | A primeira escolha com custo: três ofertas |
   | 15 | O primeiro recruta e a primeira ambição curta |
   | 20 | O primeiro inimigo com nome; uma briga de taverna |
   | 30 | A primeira reviravolta |
   | 40 | O primeiro rival na taverna, e a tábua dos bandos |
   | 50 | O primeiro duelo |
   | 60 | O primeiro troféu, o primeiro soldo pago e o primeiro sinal da Grande Questão |

4. **Três origens.** Mudam os recursos e o primeiro arco, e cada uma tem um fio pessoal de três passos, amarrado à Grande Questão.
   - **Desertores:** começam caçados, com um nêmesis no primeiro dia.
   - **Guarda de um nobre caído:** começam com uma dívida de honra e um inimigo na corte.
   - **Milícia de aldeia:** começam com uma aldeia de notáveis que são família.
5. **Heráldica.** As cores e o símbolo do estandarte, escolhidos ao criar o bando. Aparecem nas tropas, no acampamento e no mapa.

**Pronto quando:** numa campanha nova, quem nunca jogou
- luta nos 2 primeiros minutos;
- faz uma escolha com custo até o minuto 10;
- conhece um amigo e um inimigo com nome até o minuto 20;
- chega ao minuto 60 com uma ambição escolhida, um duelo lutado e um troféu.

**A pergunta para o usuário:** em que minuto você se entediou?

## 17. Marco 35 — Jogar a campanha inteira
Era o fechamento da Fase 3. Fica por último.
- **Objetivo:** fechar jogando, e não só simulando.
- Jogar uma campanha do começo a um dos finais, anotando o que quebra e o que cansa.
- Ajustar o equilíbrio jogando. O que foi calibrado só por simulação:
  - os Marcos 14 a 23;
  - a progressão dos batalhões, as rações e a magia;
  - tudo o que esta fase mudou.
- **Pronto quando:** uma campanha vai do primeiro contrato a um dos cinco finais sem um erro que obrigue a recomeçar.

As notas "falta jogar" da [avaliação das mecânicas](ROADMAP_FASE_3.md#avaliação-das-mecânicas) da Fase 3 continuam sendo o primeiro lugar para olhar.

---

## As pendências da Fase 3 dentro da Fase 4
A etapa 17 da Fase 3 fechou as partes 1 e 2. As outras onze, a dívida de teste e o fechamento entram aqui.

| Pendência | Onde entra |
| --- | --- |
| Parte 3. Lendas e herdeiros | O gênero guardado, no Marco 28; os nomes iguais e os mundos que lembram, no Marco 32 |
| Parte 4. Mar: ilhas, carga própria, tropas de ultramar | As ilhas no gerador, no Marco 27; o resto, no Marco 33 |
| Parte 5. Mar: batalha entre navios, invasões pelo mar | Marco 33 |
| Parte 6. Calamidades de cada continente | Marco 31 |
| Parte 7. Cercos da IA à vista | Marco 30 |
| Parte 8. Comboio e expedições no mapa | Marco 30 |
| Parte 9. Batalha personalizada com aliados da IA e capitães | Etapa 2 |
| Parte 10. Capitães e duelos | A companhia em marcha e o estandarte do capitão, no Marco 24; o resto, no Marco 25 |
| Parte 11. Locais de missão | Marco 27 |
| Parte 12. Acabamento da arte | G7; a arquibancada e a harpia, no Marco 25; as crianças, no Marco 28 |
| Parte 13. Batalhões grandes e o alcance dos arcos | Marco 24 |
| Dívida: a suíte `cercos` sem WebGL | Etapa 2 |
| Fechamento: jogar uma campanha inteira | Marco 35 |

## O que ficou de fora
As ideias cortadas e o motivo de cada uma estão no [brainstorm](FASE_4_BRAINSTORM.md#o-que-ficou-de-fora-e-por-quê). As principais:
- **o modelo de golpes** no lugar dos pontos de vida: a perícia dá quase tudo por uma fração do custo;
- **o reino mais fundo:** governar continua raso. Volta depois desta fase, se o ato IV pedir;
- **a justa a cavalo:** custo de arte alto para pouco uso;
- **casamento de oficiais, quartel de inverno, absorver um bando rival:** boas, mas nenhuma ataca o que cansou. Voltam se o jogo pedir.

