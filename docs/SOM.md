# Som: o que existe e o que falta

Inventário de tudo o que se ouve no jogo, o que dispara cada som e o que ainda falta. Etapa no roadmap: [S1, na Fase 4](ROADMAP_FASE_4.md#1-s1--som-parte-1-a-voz-do-bando--ok). Como o [ARTE.md](ARTE.md), mas para o ouvido.

**Resumo:** a etapa S1 ✅ OK. Todo som é **feito no código**, com a Web Audio API (osciladores e ruído filtrado), na hora em que toca. Não há nenhum arquivo de áudio no jogo. Nada é copiado de outro jogo: o espírito é o de *Age of Empires II* (a tropa responde, o sino avisa, cada prédio tem o seu som), mas os sons e a fala são inventados.

Hoje se ouve:
- a resposta de cada tropa ao ser escolhida e ao receber ordem, numa língua inventada para cada cultura;
- os gritos de pânico, de cansaço e de vitória, e o que o inimigo berra;
- cada botão, painel, livro e mapa, e a assinatura de cada lugar;
- o golpe conforme o que ele acerta, a flecha do tiro à chegada, o cerco;
- o rugido da linha, os cascos e a marcha, que crescem com quanta gente se mexe perto da câmera;
- dez alarmes e sinais, cada um com o seu som e uma seta na borda da tela.

## Como o som é feito
Tudo fica em `src/audio/`. Os arquivos de **regras** não sabem o que é a Web Audio: são testados sem navegador, em `tests/unit/`.

| Arquivo | O que faz | Regras testadas em |
| --- | --- | --- |
| `AudioEngine.ts` | O motor: toca as receitas, os laços, o som posicional, o limitador e a medição de saída. | — |
| `mixer.ts` | A mesa de som: os canais, o que fica guardado, quem abaixa quem e a porteira (quantos sons cabem juntos). | `audioMixer.test.ts` |
| `synth.ts` | Os blocos: envelope, ruído filtrado, nota, metal de sopro, sino e tambor. | — |
| `speech.ts` | A fala: sílabas de cada cultura, timbre de cada tropa e de cada espécie, as falas e quem pode falar. | `speech.test.ts` |
| `voice.ts` | O sintetizador de voz: fonte que vibra, três filtros de vogal e ruído de consoante. | — |
| `uiRules.ts` | Que som cada painel, botão e mudança de estado faz. | `uiSoundRules.test.ts` |
| `uiSounds.ts` | As receitas da interface e dos lugares. | — |
| `storeSounds.ts` | Escuta os cliques e o estado do jogo e toca os sons da interface. | — |
| `hitRules.ts` | Em que material o golpe e a flecha caem, a salva, o chão, e quanto se ouve da batalha. | `hitRules.test.ts` |
| `combatSounds.ts` | As receitas do combate e do cerco. | — |
| `fieldLoops.ts` | Os três laços do campo: rugido da linha, cascos e marcha. | — |
| `alarmRules.ts` | Os alarmes: quem toca, quanto espera, quem passa na frente e onde fica a seta. | `alarmRules.test.ts` |
| `alarmSounds.ts` | As receitas dos dez alarmes e sinais. | — |
| `alarms.ts` | Os alarmes ao vivo: liga as regras ao som e guarda a visão da câmera para a seta. | — |
| `sounds.ts` | Os sons antigos que ainda não mudaram (ver "O que falta") e a fogueira. | — |

Na cena: `game/scenes/worldScene/voices.ts` (quem fala e quem se ouve no campo) e `worldScene/alarms.ts` (o que dispara os alarmes). A seta é desenhada em React: `ui/components/AlarmArrows.tsx`.

### A mesa de som
- **Cinco canais**, cada um com o seu volume (botão "Canais", ao lado do som): interface, vozes, combate, ambiente e música. Os cinco e o mudo ficam guardados no navegador.
- **Prioridade:** o alarme abaixa todos os canais menos a interface (por onde ele sai); a voz abaixa o ambiente e a música; o jogo em pausa (mapa, painel, relatório) cala o combate; a aba escondida suspende tudo.
- **Porteira:** cada som tem um intervalo mínimo e um número de vozes; cada canal tem um teto (interface 6, vozes 3, combate 28, ambiente 10, música 12). Mil golpes juntos não viram ruído.
- **Limitador** no fim da cadeia: 1600 soldados lutando não estouram o som.
- **Posicional:** o volume cai com a distância até o centro da câmera, e o som vem do lado em que acontece. Com o zoom afastado, se ouve mais longe.

## Inventário

### As vozes (canal "vozes")
| Fala | Quando | Quem fala |
| --- | --- | --- |
| Escolhida (3 variações) | Ao selecionar | A primeira tropa escolhida, mesmo de longe |
| Andar, atacar, segurar, recuar | Ao receber a ordem (pela voz ou pelo mensageiro) | Quem recebeu |
| Confusa | A ordem se perdeu na tradução (língua diferente) | Quem recebeu |
| Pânico | O batalhão debandou | O batalhão; também o esquadrão inimigo que debanda |
| Viva | Voltou à luta, venceu o combate, recrutas chegando | O batalhão, o vencedor, os recrutas |
| Cansada | Chegou à exaustão | O batalhão |
| Grito de guerra | A ordem "Grito de guerra" | O Comandante |
| "Eia!" | O mensageiro parte | O mensageiro |
| Provocação | De tempos em tempos, no meio da luta | Um inimigo perto da câmera |

- **Quem fala por um batalhão:** o tenente ou o capitão que o conduz, com voz própria tirada da semente; sem eles, a tropa, com o timbre dela (guarda pesada muito grave, infantaria grave, arqueiros leves, cavalaria firme).
- **A língua:** as sílabas saem da cultura de quem fala. As Ilhas e o Jade têm sotaque próprio (o Jade é tonal).
- **Os inimigos:** o goblin guincha, o orc ruge, o bandido pragueja, o morto-vivo sussurra. Lobos, carroças, aríetes, civis e mercadores não falam.
- **Regras:** uma fala por ordem, no máximo uma a cada 250 ms, a mesma pessoa não repete antes de 0,9 s (menos pânico, viva e grito de guerra), e nunca por cima de um alarme.

### A interface (canal "interface")
| Som | O que dispara |
| --- | --- |
| Clique, confirmar, cancelar, "não pode" | Todo botão; o peso vem do texto do botão (Confirmar, Cancelar...) e do botão desligado |
| Abrir e fechar painel | Qualquer painel |
| Virar página | Diário, crônica e livros |
| Desenrolar e enrolar o mapa | Mapa do Continente |
| Martelo | Uma construção nova |
| Tambor e viva | Recrutar |
| Pena e selo | Aceitar contrato |
| Muitas moedas | Dia de pagamento |
| Moeda que entra, moeda que sai | Ouro que muda com um painel aberto |
| Duas fanfarras curtas | Ambição cumprida; subida de nível |

### A assinatura de cada lugar (canal "interface")
Abrir o painel do lugar, ou entrar nele com E, toca o som dele: a **bigorna** da ferraria, as **canecas** da taverna, o **sino** do templo, o **burburinho** do mercado, o **relincho** do estábulo, os **sacos** da intendência, as **espadas de pau** do campo de treino, a **lona** da tenda, as **gaivotas** do cais, o **eco** do paço, a **madeira pesada** do portão, o **tambor** do acampamento, o **livro-caixa**, o **tilintar** do tesouro, a **carroça**, a **água** do poço e a **porta** das casas.

### O combate (canal "combate")
| Som | O que dispara | Variação |
| --- | --- | --- |
| Golpe | Todo golpe que acerta ou é aparado | Material (aço no aço, escudo, placa, malha, carne, osso, madeira, no ar) × arma (lâmina, machado, ponta, pau, dente) |
| Tiro | Cada flecha, virote e dardo | Arco, besta e dardo |
| Salva | Cinco tiros em menos de 0,2 s | — |
| Assobio | Flecha alta passando perto | — |
| Chegada da flecha | A flecha que cai | Carne, escudo, placa, madeira e chão |
| Queda | Quem morre | Sangue, osso e madeira; o cavalo às vezes relincha |
| Choque | A investida que bate | — |
| Aríete, escada, portão que racha e que cai | O cerco | — |

Os golpes têm variação de tom em cada batida, para não cansar.

### O campo (laços, canal "combate")
- **O rugido da linha:** muita garganta, o chão e o ferro. O volume segue quantos estão lutando perto da câmera: uma escaramuça é quase nada, a batalha cheia enche o ouvido. Numa batalha grande, é ele que se ouve, e não mil golpes soltos.
- **Os cascos:** mais batidas quanto mais cavalos; no galope, em três tempos.
- **A marcha:** o passo de muitos pés, conforme o chão: grama, lama (primavera e chuva), neve, pedra (estrada e rua) e ponte.
- Os três vêm do lado em que a gente está, e se calam na pausa.

### Os alarmes e os sinais (canal "interface")
Cada um tem um som e uma seta: presa na borda da tela, apontando para onde acontece; dentro da tela, uma marca em cima do lugar. Clicar na seta leva a câmera até lá. O som se ouve de qualquer lugar, inteiro, mas do lado de onde vem.

| Alarme | Som | O que dispara | Abaixa os outros |
| --- | --- | --- | --- |
| Acampamento atacado | Corneta de três notas, duas vezes | Inimigo dentro do acampamento; bando vindo contra ele; o saque do acampamento; a sede cercada | Sim |
| Calamidade | Sino fundo, duas vezes, e o chão que ronca | Uma calamidade desperta (a seta aponta a região do rumor; o covil, se já foi visto) | Sim |
| Aldeia atacada | Sino pequeno, tocado depressa | Um bando chega a um povoado: o nosso sempre; o dos outros, se o Comandante está perto | Sim |
| Guerra declarada | Trombetas em duas vozes e tímpano | Um reino declara guerra a outro (a seta aponta a sede de quem declarou) | Sim |
| Herói inimigo | Tambor grave | Um herói inimigo entra na vista | Sim |
| Comboio atacado | Eixo que range e corneta que desce | As carroças apanhando no campo; salteadores no comboio da estrada | Sim |
| Duelo | Duas lâminas saindo da bainha e uma batida | O desafio de um duelo | Não |
| Soldo atrasado | O resmungo abafado de muita gente | Mais uma semana sem pagar o soldo | Não |
| Batedor de volta | O trote e o assobio | O relatório do batedor (a seta aponta o perigo que ele viu) | Não |
| Mensageiro | A corneta de posta | O mensageiro entregou a ordem | Não |

- **Regras:** o mesmo perigo que continua não toca de novo antes do descanso dele (a seta fica e acompanha); duas aldeias juntas dão duas setas e um sino só; um alarme menor que chega durante um maior espera a vez e toca depois, se o perigo ainda vale; no máximo quatro setas, e a de menor peso sai.
- Carregar um jogo, ou voltar de uma casa, não toca nada do que já estava acontecendo.

### Os sons antigos (`sounds.ts`)
Ainda do jeito de antes da S1, todos no canal "combate":
- **No duelo:** espada no aço, golpe no ar, esquiva e baque (`worldScene/duel.ts`).
- **Na magia:** o impacto e o baque (`worldScene/magic.ts`).
- **Nas ordens:** a trombeta de cada ordem, a bandeira e o grito de guerra (`worldScene/orders.ts`).
- **O fim da batalha:** a fanfarra da vitória e a da derrota.
- **O Comandante:** o golpe no ar e a esquiva.
- **A fogueira** do acampamento (laço, canal "ambiente"), que cresce perto dela.

## O que falta
- **Música:** o canal existe, mas não há música. É a etapa [S3](ROADMAP_FASE_4.md#12-s3--som-parte-3-a-música): um tema do bando, um modo por cultura, e o silêncio como estado.
- **Ambiente:** só a fogueira. O fundo de cada chão, a hora e o tempo, a água, os povoados, o acampamento que conta o estado do bando e o acampamento inimigo que se ouve antes de ser visto vêm na [S2](ROADMAP_FASE_4.md#7-s2--som-parte-2-o-mundo-que-se-ouve).
- **Os sons antigos:** passar o duelo e a magia para os golpes por material (`hitRules.ts`), e as trombetas de ordem para o canal certo.
- **Navios e mar:** o casco, as velas e a tempestade não têm som (S2, parte 8).
- **Dentro das casas e na Cidade Alta:** só a porta.

## Como testar
- **De unidade:** `npx vitest run tests/unit/audioMixer.test.ts tests/unit/speech.test.ts tests/unit/uiSoundRules.test.ts tests/unit/hitRules.test.ts tests/unit/alarmRules.test.ts`.
- **No navegador:** `npm run test:battle -- som` (com `npm run dev` rodando). A suíte espia o registro do motor (`window.__audio.log`, só em desenvolvimento), toca as receitas fora do tempo real para conferir que cada uma existe, não estoura e não é muda, e põe 1600 soldados lutando para conferir o teto de vozes e o limitador.
- **Para ouvir:** no jogo, `window.__audio` toca qualquer receita, e `window.__alarms.raise("camp", { at: { x, y } })` dispara um alarme com a seta.
