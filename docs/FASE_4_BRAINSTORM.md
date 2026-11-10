# Fase 4 — Brainstorm em três rodadas

Índice: [ROADMAP.md](ROADMAP.md) · O plano que saiu daqui: [ROADMAP_FASE_4.md](ROADMAP_FASE_4.md) · Design: [GDD.md](GDD.md)

Feito em 10 de novembro, depois da primeira sessão de jogo do usuário. São três rodadas:
1. **Abrir:** juntar o que foi sentido jogando, olhar o que o código faz hoje e listar ideias sem cortar.
2. **Apertar:** passar cada ideia pelas regras do jogo e pelas lentes de design, ver o custo e decidir o que entra.
3. **Fechar:** montar a espinha da fase e a ordem das etapas.

Nada aqui está decidido. É a proposta para o usuário aprovar, cortar ou reordenar.

---

## O que foi sentido jogando
As notas do usuário, na ordem em que vieram:
1. O começo é meio chato.
2. As missões são repetitivas e pouco interessantes.
3. Os inimigos ficam sempre nos mesmos lugares.
4. O duelo podia ser mais legal.
5. Os inimigos são muito "tanque". Mas as batalhas não devem ficar rápidas.
6. **Ideia dele:** em vez de vida alta, a diferença de nível muda a chance de acerto. Quanto mais cercado, menos se consegue defender. Vale mais para Comandante, tenentes, capitães e outros personagens de peso; se for viável, também para os batalhões.
7. Nem toda gente da cidade deve ser sem graça: alguns especiais (o ferreiro e outros), com mais vida simulada, família, e que dão missões.
8. O pedido: overhaul no combate, nas missões e na campanha, com o foco maior na campanha.

## O que o código faz hoje
Conferido no código em 10 de novembro. É daqui que vem cada sensação acima.

| Sensação | O que está por trás |
| --- | --- |
| Inimigo "tanque" | Cada golpe certo tira só 24% do dano (`COMBAT.DAMAGE_PACE`). Um soldado de infantaria acerta um goblin 62% das vezes e tira 1,9 de 40 de vida: cerca de 34 golpes, **30 s para um soldado matar um goblin** |
| Chefe "tanque" | O Senhor da Guerra orc tem 1200 de vida, 20 vezes um soldado. Ele é difícil porque demora, e não porque luta bem |
| Nível que não se sente | Cada nível dá +6% de vida e de dano. O ataque e a defesa, que decidem o acerto, não mudam com o nível |
| Cercar pouco importa | A defesa cai de lado (60%) e pelas costas (20%), mas o número de atacantes não entra na conta |
| Missões repetidas | São 10 tipos de contrato, mas o do começo é sempre "limpar o local". Há 4 temas de local, **cada um com um desenho de arena só**, que apenas gira. O objetivo é sempre matar todos |
| Mesmos lugares | Cerca de 12 locais por continente, fixados quando o mundo nasce. O contrato sorteia entre os 3 mais perto do cliente. Limpo, o local enche de novo no mesmo ponto |
| Começo sem tática | A campanha começa com 1 batalhão de 8. Flanco, reserva e pinça pedem pelo menos 2 peças |
| Gente sem graça | Ferreiro, taverneiro e mestre da guilda são balcões. Só os nobres têm família, opinião e memória (`sim/nobility.ts`) |
| Falta de rumo no começo | As 6 ambições são todas de fim de jogo (ser rei, unir um continente, quarenta vitórias). Nada puxa a primeira hora |
| Duelo | As regras são fundas (leve, pesado, bloqueio, aparar, esquiva, empurrão, postura). O que falta está em volta: quem é o adversário, o que se aposta, o que muda de um duelo para outro |
| Comandante parado | Ele duela e lança magia, mas não evolui por conta própria (nota da própria avaliação da Fase 3) |

O que já existe e pode ser reaproveitado, porque muda o custo de quase tudo abaixo:
- acerto por ataque contra defesa, com lado do golpe (`sim/combatRules.ts`);
- fadiga de batalhão, inclusive lutando (`FATIGUE.COMBAT_PER_SEC`), e feridos que voltam;
- rastros de bandos, batedores, rumores e notícias com idade;
- fogo, noite e tochas, cercos com defesa, escolta, sabotagem e resgate de nobre;
- heróis inimigos com ficha, captura, resgate e recrutamento;
- reputação em três eixos (Fama, Honra, Temor), eventos com escolha, Lendas;
- nobres com família, traços, opinião e memória;
- retratos gerados por semente (G5) e o laboratório de batalha, que mede qualquer confronto.

## As lentes usadas
Dez princípios de design, usados na rodada 2 para julgar cada ideia. Somam-se às seis regras de ouro do [GDD, seção 8.1](GDD.md).
1. **Laços encaixados.** O jogo tem quatro tempos: 30 segundos (a luta), 5 minutos (a missão), 1 hora (o bando cresce) e a campanha. Cada um precisa de meta, desafio, recompensa e um gancho para o seguinte.
2. **Decisão interessante.** Risco contra recompensa, sem opção que ganha sempre.
3. **Fluxo.** Desafio um pouco acima da habilidade de quem joga, alternando tensão e respiro.
4. **Três vontades:** escolher (autonomia), ficar bom (competência) e se importar com alguém (vínculo).
5. **Laços abertos.** Sempre duas ou três coisas começadas e não terminadas. É o que faz voltar.
6. **Novidade em conta-gotas.** Na primeira hora, uma coisa nova a cada 5 a 10 minutos.
7. **Recompensa variável e com história.** Um troféu com nome vale mais que 50 de ouro.
8. **Leitura e resposta.** O jogador vê por que ganhou ou perdeu, e cada ação responde na hora.
9. **Sistema antes de conteúdo.** Uma regra que resolve três problemas vale mais que três conteúdos.
10. **Testar com quem joga, cedo.** Cada etapa termina com uma pergunta para o usuário responder jogando.

---

## Rodada 1 — Abrir
Ideias sem filtro, por área. As letras servem para a rodada 2.

### Combate (C)
- **C1. Perícia no lugar de vida.** O nível soma ataque e defesa, e não vida e dano. O veterano não tem mais sangue: ele acerta mais e é acertado menos.
- **C2. Pressão.** Cada atacante além do primeiro tira parte da defesa do alvo.
- **C3. Vida achatada.** A vida vem do tipo de corpo (goblin, homem, orc, brutamontes), e o golpe certo pesa mais. Chefe deixa de ser saco de pancada: perícia alta, guarda pessoal e vida de gente.
- **C4. Ficha única de herói.** Comandante, tenentes, capitães, heróis inimigos e notáveis que lutam usam a mesma ficha: Armas, Guarda, Vigor, Comando e Astúcia.
- **C5. Fôlego em batalha.** Quem luta muito tempo defende pior. Revezar a linha e guardar reserva passam a valer.
- **C6. Mais feridos, menos mortos.** Mais gente cai ferida e volta, para o combate afiado não apagar o bando.
- **C7. Modelo de golpes.** Em vez de pontos de vida, 2 a 6 feridas por corpo, com a armadura como teste.
- **C8. Leitura sem barra de vida.** Aparar com faísca e som, guarda aberta, ferido que manca.
- **C9. Batalhões grandes** (60 a 100) e arcos com alcance perto de 480. Vem da etapa 17 da Fase 3.
- **C10. Dividir o batalhão em destacamentos.** Flanco desde a primeira luta, mesmo com um batalhão só.
- **C11. Batalha em fases.** O reforço que chega, a fuga e a perseguição (com presos e saque), o chefe que desafia.
- **C12. Inimigos que fazem perguntas diferentes:**
  - goblin embosca, foge e volta;
  - morto-vivo não tem moral e só para quando o altar cai;
  - orc quebra a linha na investida;
  - bandido usa refém e arqueiro no alto.
- **C13. Ordens do Comandante.** Uma barra de 3 ou 4: "Segurem!", "Comigo!", "No chefe!", "Recuar em ordem".
- **C14. Guarda pessoal.** Um punhado de veteranos que cobre o Comandante contra a pressão.
- **C15. Escolhas antes da luta.** A hora (noite), o lado de chegada, a conversa, a emboscada.
- **C16. Depois da luta.** Quem se destacou, 1 de 3 saques, presos e feridos, numa tela com decisões.

### Missões (M)
- **M1. Gramática de missão.** Toda missão é objetivo × lugar × quem × reviravolta × pagamento. Poucas peças, muitas combinações.
- **M2. Objetivos novos:**
  - caçar um chefe com nome, que foge se estiver perdendo;
  - resgatar alguém vivo;
  - emboscar um comboio, escolhendo o ponto da estrada;
  - defender a aldeia até o socorro chegar;
  - seguir rastros até um bando que anda;
  - roubar a carga e sair, sem precisar matar todos;
  - queimar à noite, antes de a corneta tocar;
  - escoltar, com escolha de rota;
  - duelo de campeões;
  - expulsar pela conversa ou pelo medo;
  - investigar quem está por trás.
- **M3. Reviravoltas tiradas da simulação:**
  - o cliente mentiu;
  - o alvo oferece mais para o bando mudar de lado;
  - um terceiro chega no meio da luta;
  - os "goblins" são refugiados com fome;
  - o refém não quer voltar;
  - o cliente não tem como pagar;
  - um bando rival chegou antes;
  - o chefe inimigo é parente de alguém do bando;
  - o serviço era isca para uma emboscada;
  - o que foi roubado não é o que disseram.
- **M4. Negociar o contrato.** Adiantamento, bônus, parte do saque e condições.
- **M5. Saber antes.** O batedor revela a força do inimigo e pistas da reviravolta. A informação tem idade.
- **M6. Cadeias.** De 3 a 5 contratos com um vilão que cresce.
- **M7. Três ofertas de perfis diferentes:** a segura, a arriscada e a estranha. Elas expiram ou vão para um rival.
- **M8. Pagamento que não é ouro.** Terra, favor, arma, recruta, mapa, desconto para sempre.
- **M9. Encontros na estrada.** De 20 a 30, com escolha.
- **M10. Rumores que viram pistas.** Missões, achados e avisos. Alguns são falsos.
- **M11. Fracasso que continua.** O cliente que cobra, o refém que morre, a dívida.
- **M12. Missões de tenente.** Um arco pessoal que muda a passiva dele.
- **M13. Missões grandes de reino.** A batalha campal como companhia contratada, ao lado de um exército.

### Lugares (L)
- **L1. Mais lugares.** De 30 a 40 por continente, de 10 a 12 tipos, com 2 ou 3 arenas cada.
- **L2. Ocupantes que mudam.** Quem mora em cada lugar sai das regras do mundo, e não da geração.
- **L3. Bando ignorado cresce.** Acampamento, paliçada, forte. No fim, vira o flagelo da região.
- **L4. Truques de lugar.** Sentinela com corneta, armadilhas, refém, altar do necromante, canil de lobos, saída dos fundos.
- **L5. Achados.** Lugares vazios guardam esconderijo, santuário, eremita, campo de batalha antigo, mapa de tesouro.
- **L6. Estado da região.** Em paz, assolada, em guerra, com fome ou em festa: mudam as ofertas, os preços e o que se vê.
- **L7. Sobreviventes fogem para outro lugar.** O ninho limpo reaparece mais longe, menor e com raiva.

### Gente (G)
- **G1. Notáveis.** De 3 a 6 por povoado, com ficha e retrato.
- **G2. Família espalhada pelo mundo.** No seu bando, no bando inimigo, em outra cidade.
- **G3. Vida simulada.** Pelas mesmas regras da nobreza, e o mundo bate neles.
- **G4. Rotina no mundo.** Na oficina de dia, na taverna à noite.
- **G5. O serviço depende da pessoa.** Um ferreiro mestre forja arma com nome.
- **G6. Missões pessoais.** Nascem de problema + família + acontecimento.
- **G7. Vínculo.** Opinião, memória, presentes, avisos, casamento com um oficial, herdeiro do ofício.
- **G8. Livro de gente.** Quem eu conheço, quem me deve e quem me odeia.
- **G9. Notáveis entram no bando** como seguidores, ou viram inimigos.
- **G10. Veteranos com nome.** Feito em batalha dá nome a um soldado; ele pode virar sargento e depois oficial.
- **G11. Gênero guardado para todos.** Liga com a pendência das Lendas.

### Rivais (R)
- **R1. Bandos rivais.** Com capitão, estandarte, estilo e fama, andando no mapa.
- **R2. Eles disputam.** Pegam contratos, chegam antes, propõem sociedade e levam seus homens quando o soldo atrasa.
- **R3. A tábua dos bandos.** O ranking de fama, nas tavernas.
- **R4. Nêmesis.** O herói que escapou lembra, cresce, se adapta e volta chamando pelo nome.
- **R5. O flagelo da região.** Um vilão com rosto, que cresce se for ignorado.
- **R6. Contratar ou absorver um rival.** Ou decidir no duelo de capitães.

### Duelo (D)
- **D1. A cena do desafio.** Com a história entre os dois e quatro respostas: aceitar, mandar um campeão, recusar, jogar sujo.
- **D2. Desafiar para decidir a batalha.**
- **D3. Estilos e técnicas.** Aprendidas com mestres pelo mundo; o Comandante leva 3.
- **D4. Golpe de assinatura.** Um por herói.
- **D5. O anel vivo.** A torcida, a moral que anda golpe a golpe, o chão do anel.
- **D6. Fim com escolha.** Poupar, pedir resgate, executar, tomar a arma, humilhar.
- **D7. Feridas com efeito.**
- **D8. Torneios de aldeia.** Cedo, com apostas.
- **D9. Peso.** Parada no golpe, câmera lenta ao aparar, som.
- **D10. Perícia e pressão no duelo.** Quem chega ferido ou cansado luta pior.

### Campanha (K)
- **K1. Atos pelo nome do bando.** Cada um com prova e cerimônia.
- **K2. Ambições curtas e médias.** Sortear 3, escolher até 2.
- **K3. O soldo como coração da semana.** Contagem regressiva e caixa projetado.
- **K4. O Cronista.** Um diretor de ritmo, com 3 temperamentos.
- **K5. Mais de 60 eventos.** De acampamento, estrada e cidade, em cadeia.
- **K6. Troféus e relíquias com história.** Poucos espaços de equipamento para os heróis.
- **K7. Caminhos e finais.** Honra, Temor, Ouro, Coroa e Fama.
- **K8. Alcunha do bando.** Ganha por feitos, e as tavernas cantam.
- **K9. Heráldica.** O estandarte escolhido no começo.
- **K10. Quartel de inverno.** Treino, festa, torneio, casamento, planos.
- **K11. Queda e volta.** O bando disperso, a dívida com o agiota, o recomeço.
- **K12. Origens.** Começos diferentes.
- **K13. Legado que destrava.** Uma origem nova ao fechar uma saga.
- **K14. O Comandante cresce por feitos,** e não por pontos de experiência.

### Primeira hora (P)
- **P1. Começar no meio de uma luta.**
- **P2. Um arco de 4 missões contra o primeiro vilão,** cada uma ensinando uma coisa.
- **P3. Uma novidade a cada 5 minutos.**
- **P4. Primeira luta em até 2 minutos.**
- **P5. Três peças táticas desde o início.**
- **P6. Um amigo com nome e um inimigo com nome** nos primeiros 20 minutos.

### Jogar sem cansar (Q)
- **Q1. Régua de ritmo.** Registrar quanto tempo se passa marchando, lutando, em painel e parado.
- **Q2. "Marchar até".** A marcha segue sozinha e só para quando algo acontece.
- **Q3. Resolver sozinho** a luta ganha de antemão.
- **Q4. "O que fazer agora".** Sempre 3 metas à vista.

---

## Rodada 2 — Apertar
Cada ideia passou por quatro perguntas:
- **Ataca qual nota do usuário?** Se não ataca nenhuma, espera.
- **Passa nas regras de ouro e nas lentes?**
- **O que reaproveita?**
- **Quanto custa?** P (dias), M (uma etapa pequena), G (uma etapa em partes).

### As críticas mais duras
Antes das tabelas, o que esta rodada mudou no conjunto.

1. **Mais sistema não é mais diversão.** A avaliação da Fase 3 já dizia: os sistemas mais fundos (corte, reino, mar) são os mais longe do que o jogador faz no dia a dia. Regra para a Fase 4: **só entra o que o jogador encontra nas duas primeiras horas, ou em toda sessão.**
2. **A batalha deve durar pelo que acontece nela, e não pela vida de cada um.** É assim que as duas notas do usuário cabem juntas ("inimigo tanque" e "não quero batalha rápida"):
   - entre desiguais, a luta resolve depressa, porque a perícia decide;
   - entre iguais, os golpes são aparados, e a linha só cede por flanco, cerco, cansaço ou moral.
3. **O cerco pode virar bola de neve.** Se quem tem mais gente ganha cada vez mais rápido, a batalha se decide no primeiro minuto. Por isso a pressão tem teto, e a formação limita quantos chegam em cada soldado (a parede de escudos é isso). A moral dá ao lado menor a chance de recuar.
4. **Errar muito também cansa.** Trocar "muita vida" por "muito golpe no vazio" não resolve. O golpe aparado precisa ser um acontecimento que se vê e se ouve, e quem apara sob pressão se cansa.
5. **Um reequilíbrio, e não dois.** Os batalhões grandes (etapa 17, parte 13) e a perícia mexem nos mesmos números. Fazer os dois juntos evita calibrar tudo duas vezes.
6. **O começo com 1 batalhão de 8 não tem tática.** Flanco pede duas peças. Dá para manter o começo humilde em recursos e ainda assim ter peças: batalhão grande que se divide em destacamentos.
7. **Notáveis não podem virar a corte de novo.** Ficam perto do jogo: estão nos povoados que o jogador visita, vendem, forjam e curam, e as missões deles são o começo da campanha. Poucos por povoado, e a vida deles roda de forma abstrata longe do bando.
8. **Reviravolta e evento pedem texto.** São cerca de 10 reviravoltas, 60 eventos e 30 encontros. Para não repetirem, cada um nasce de um dado da simulação (quem, onde, por quê), e não de um texto fixo.
9. **Lugares novos mudam o gerador de mundo.** Saves antigos deixam de carregar nesse ponto. Vale mais uma quebra só, avisada, do que várias.
10. **O duelo não precisa de mais regra, precisa de motivo.** Ele ganha mais com um adversário que tem história, uma aposta e um fim com escolha do que com mais botões.
11. **A fase é do tamanho da Fase 3.** Por isso a ordem é "a maior dor primeiro", e cada etapa termina jogável, com o usuário jogando. Dá para parar ou trocar a ordem depois de qualquer uma.

### Combate
| Ideia | Ataca | Reaproveita | Custo | Veredito |
| --- | --- | --- | --- | --- |
| C1 Perícia | 5, 6 | A conta de acerto já existe | P | **Entra** (etapa 2) |
| C2 Pressão | 5, 6 | Lado do golpe já existe | M | **Entra**, com teto e limite por formação |
| C3 Vida achatada | 5 | Tabelas de tropas e inimigos | M | **Entra**; pede medir tudo de novo no laboratório |
| C4 Ficha de herói | 6 | Duelo e Tática dos capitães, `martial` dos nobres | M | **Entra**, em 3 atributos de luta primeiro (Armas, Guarda, Vigor) |
| C5 Fôlego | 5 | Fadiga de batalhão | P | **Entra**: a fadiga passa a tirar defesa |
| C6 Mais feridos | 5 | Feridos e enfermaria | P | **Entra**: é o que deixa o golpe pesar sem apagar o bando |
| C7 Modelo de golpes | 5 | — | G | **Espera.** C1 a C6 dão quase tudo por uma fração do custo. Volta se não bastar |
| C8 Leitura | 5 | Poses de golpe e bloqueio do G1 | M | **Entra**: sem isso, aparar vira "errar" |
| C9 Batalhões grandes | 1, 5 | O motor já aguenta 1600 | G | **Entra na etapa 2**, se o usuário confirmar o plano |
| C10 Destacamentos | 1 | Ordens por batalhão | M | **Entra**: dá tática ao começo |
| C11 Fases | 5 | Reforço e fuga existem em parte | M | **Entra aos poucos**, com as missões (etapa 3) |
| C12 Inimigos diferentes | 2, 5 | 8 planos da IA; o morto-vivo já sofre mais com fogo | M | **Entra** com os lugares (etapa 4) |
| C13 Ordens | 1 | Grito de guerra | M | **Entra** (etapa 7), com o Comandante que cresce |
| C14 Guarda pessoal | 6 | Guarda do capitão | P | **Entra**: a pressão pede |
| C15 Antes da luta | 2 | Noite, tochas, terreno | P | **Entra** com as missões |
| C16 Depois da luta | 1 | Resultado da batalha | M | **Entra** (etapa 8) |

### Missões
| Ideia | Ataca | Reaproveita | Custo | Veredito |
| --- | --- | --- | --- | --- |
| M1 Gramática | 2 | Contratos de hoje | M | **Entra**: é a base da etapa 3 |
| M2 Objetivos | 2 | Escolta, sabotagem, cerco em defesa, rastros, presos, fogo, duelo | G | **Entra**, primeiro os 6 que mais reaproveitam |
| M3 Reviravoltas | 2 | Honra, Temor, Fama, memória dos nobres | M | **Entra**: 10 para começar, nunca no primeiro contrato |
| M4 Negociar | 2, 8 | Adiantamento e bônus | P | **Entra** |
| M5 Saber antes | 2 | Batedores, informação com idade | P | **Entra** |
| M6 Cadeias | 2, 8 | — | M | **Entra** junto dos rivais (etapa 6), que dão o vilão |
| M7 Três ofertas | 2 | Lista de contratos | P | **Entra** |
| M8 Outro pagamento | 2 | Favores da corte | P | **Entra** com os notáveis (etapa 5) |
| M9 Estrada | 1, 2 | Eventos com escolha | M | **Entra** (etapa 8) |
| M10 Pistas | 2, 3 | Rumores | P | **Entra** com os lugares |
| M11 Fracasso | 8 | — | P | **Entra** dentro de cada objetivo |
| M12 Tenentes | 8 | Relações entre tenentes | M | **Entra** (etapa 8) |
| M13 Batalha campal | 8 | Exércitos dos reinos | G | **Espera** os atos; é a prova do meio da campanha |

### Lugares
| Ideia | Ataca | Reaproveita | Custo | Veredito |
| --- | --- | --- | --- | --- |
| L1 Mais lugares | 3 | Gerador de locais, peças do G3 | G | **Entra** (etapa 4); quebra os saves |
| L2 Ocupantes | 3 | Bandos e covis, `siteLife` | M | **Entra** |
| L3 Crescer | 3, 8 | Paliçada e forte do cerco | M | **Entra**: dá urgência e alimenta o flagelo |
| L4 Truques | 2, 3 | Fogo, noite, presos | M | **Entra**, 4 para começar |
| L5 Achados | 3 | Ruínas da magia | M | **Entra**, poucos e bons |
| L6 Estado da região | 3 | Economia e guerras | M | **Espera**: a simulação já muda preço e oferta; ver se falta depois de L2 e L3 |
| L7 Sobreviventes | 3 | Bandos | P | **Entra** |

### Gente
| Ideia | Ataca | Reaproveita | Custo | Veredito |
| --- | --- | --- | --- | --- |
| G1 Notáveis | 7 | Retratos, nomes por cultura | M | **Entra** (etapa 5) |
| G2 Família | 7 | Linhagem dos nobres | M | **Entra**: é o que liga o notável à missão |
| G3 Vida | 7 | `sim/nobility.ts` | M | **Entra**, por mês, abstrata longe do bando |
| G4 Rotina | 7 | Moradores e interiores | M | **Entra**, simples: dois lugares por dia |
| G5 Serviço | 7 | Ferraria, taverna, templo | M | **Entra** |
| G6 Missões pessoais | 2, 7 | Gramática da etapa 3 | M | **Entra**: viram a fonte das missões do começo |
| G7 Vínculo | 7 | Opinião e memória | M | **Entra** em parte; casamento com oficial espera |
| G8 Livro | 7 | Livro da Nobreza | P | **Entra** |
| G9 Entrar no bando | 7 | Seguidores | P | **Entra** |
| G10 Veteranos | 8 | História dos batalhões | M | **Entra** (etapa 8) |
| G11 Gênero | — | Pendência da etapa 17 | P | **Entra** junto dos notáveis |

### Rivais
| Ideia | Ataca | Reaproveita | Custo | Veredito |
| --- | --- | --- | --- | --- |
| R1 Bandos rivais | 1, 8 | Bandos no mapa, ficha de capitão | G | **Entra** (etapa 6) |
| R2 Disputa | 2, 8 | Lista de contratos | M | **Entra**: 3 respostas do jogador a cada disputa |
| R3 Tábua | 8 | Fama | P | **Entra**: meta sempre à vista |
| R4 Nêmesis | 4, 8 | Heróis com ficha e captura | M | **Entra** |
| R5 Flagelo | 3, 8 | Calamidades | M | **Entra**: é a calamidade pequena, do começo |
| R6 Absorver | 8 | Recrutar capitão preso | M | **Espera** R1 e R2 jogados |

### Duelo
| Ideia | Ataca | Reaproveita | Custo | Veredito |
| --- | --- | --- | --- | --- |
| D1 Desafio | 4 | Heróis, memória | P | **Entra** (etapa 7) |
| D2 Decidir a batalha | 4, 2 | Rendição | M | **Entra**: dá ao duelo um uso na campanha |
| D3 Técnicas | 4 | Magia aprendida pelo mundo | M | **Entra**: é como o Comandante cresce |
| D4 Assinatura | 4 | Temperamentos | M | **Entra**, 6 para começar |
| D5 Anel vivo | 4 | Anel e moral | M | **Entra** em parte: torcida e moral; o chão espera |
| D6 Fim com escolha | 4 | Captura e resgate | P | **Entra** |
| D7 Feridas | 4 | Cicatrizes | P | **Entra** |
| D8 Torneios | 1, 4 | Liça | M | **Entra**: mais um jeito de ganhar a vida no começo |
| D9 Peso | 4 | Poses do G1 | M | **Entra** |
| D10 Perícia no duelo | 6 | Etapa 2 | P | **Entra** |

### Campanha, primeira hora e cansaço
| Ideia | Ataca | Reaproveita | Custo | Veredito |
| --- | --- | --- | --- | --- |
| K1 Atos | 8 | A escada do acampamento (GDD 9.1) | M | **Entra** (etapa 8): cada ato muda o que se faz |
| K2 Ambições curtas | 1, 8 | Ambições | P | **Entra cedo** (etapa 3): é barato e dá rumo |
| K3 Soldo | 8 | Salários, fila do pagamento | P | **Entra** |
| K4 Cronista | 8 | Eventos e calamidades | M | **Entra** depois de haver conteúdo para dirigir |
| K5 Eventos | 1, 8 | 11 eventos de acampamento | M | **Entra** |
| K6 Troféus | 8 | Construção Troféus | M | **Entra**, com poucos espaços |
| K7 Caminhos e finais | 8 | Honra, Temor, Lendas | M | **Entra** no fim da etapa 8 |
| K8 Alcunha | 8 | Nome do bando, Lendas | P | **Entra** |
| K9 Heráldica | 8 | Estandartes | M | **Entra** na primeira hora (etapa 9) |
| K10 Inverno | 8 | Estações, Liça | M | **Espera**: ver primeiro se o ritmo pede |
| K11 Queda e volta | 8 | Resgate, empréstimo | M | **Espera** |
| K12 Origens | 1 | — | M | **Entra** na etapa 9, com 3 |
| K13 Destravar | 8 | Sagas guardadas | P | **Espera** as origens |
| K14 Feitos | 8 | — | M | **Entra** com as técnicas |
| P1 a P6 | 1 | Tudo acima | M | **Entra** como etapa 9: é a prova de que o resto funciona |
| Q1 Régua | todas | Laboratório | P | **Entra primeiro** (etapa 1) |
| Q2 Marchar até | 1 | O caminho por clique até os locais do acampamento | P | **Entra** se a régua mostrar marcha demais |
| Q3 Resolver sozinho | 1 | Expedições | M | **Espera** a régua |
| Q4 Metas à vista | 1 | Guia de missão | P | **Entra** com as ambições |

### O que ficou de fora, e por quê
- **Modelo de golpes (C7):** o ganho sobre a perícia é pequeno para o tamanho da reescrita.
- **Estado da região (L6), inverno (K10), queda e volta (K11), absorver rival (R6):** boas, mas nenhuma ataca uma nota de hoje. Voltam se o jogo pedir.
- **Mar e reino mais fundos:** continuam rasos. São pendências da Fase 3, e não o que cansou no começo.
- **Justa a cavalo, duelo montado:** custo de arte alto para pouco uso.

---

## Rodada 3 — Fechar

### A espinha
**Um bando com nome, num mundo de gente com nome.**

Hoje o jogo tem um mundo simulado e fundo, mas o jogador encontra balcões, locais e inimigos sem rosto. A fase inteira serve a uma promessa: **cada hora de jogo deixa uma história sobre alguém com nome.** Um amigo (o notável), um rival (o outro bando), um inimigo (o nêmesis), um dos seus (o veterano).

É a mesma ideia do pilar 1 do GDD (gerador de histórias), trazida para perto do que se faz no dia a dia.

### Os quatro laços, depois da fase
| Tempo | Hoje | Depois |
| --- | --- | --- |
| **30 segundos** (a luta) | Mandar atacar e esperar a vida do inimigo acabar | Cercar, flanquear e revezar a linha, porque é a perícia e a pressão que decidem. O golpe pesa e o aparar se vê |
| **5 minutos** (a missão) | Aceitar, marchar, matar todos, voltar | Escolher entre três ofertas, saber antes pelo batedor, chegar a um lugar que mudou, cumprir um objetivo que não é sempre matar, decidir numa reviravolta |
| **1 hora** (o bando) | Juntar ouro para a próxima construção | Fechar uma ambição curta, subir na tábua dos bandos, ganhar um troféu, um veterano ganhar nome, um amigo dever um favor |
| **Campanha** | Seis ambições de fim de jogo | Atos com prova, um nêmesis que volta, caminhos e finais diferentes |

### A ordem
A maior dor primeiro. Cada etapa termina jogável e com uma pergunta para o usuário. Os detalhes estão no [ROADMAP_FASE_4.md](ROADMAP_FASE_4.md).

| # | Etapa | O que resolve | Tamanho |
| --- | --- | --- | --- |
| 1 | A régua | Medir o começo de hoje, para saber se o resto melhorou | P |
| 2 | Combate: perícia em vez de vida | Inimigo "tanque", nível que não se sente, cerco que não importa, começo sem tática | G |
| 3 | Missões com história | Missões repetidas, falta de rumo no começo | G |
| 4 | Lugares vivos | Inimigos sempre nos mesmos lugares | G |
| 5 | Gente com nome | Gente sem graça; missões sem rosto | G |
| 6 | Rivais e nêmesis | Campanha sem adversário nem medida | G |
| 7 | Duelo com motivo e o Comandante que cresce | O duelo que podia ser mais legal | G |
| 8 | A escada da campanha | Campanha sem capítulos nem finais | G |
| 9 | A primeira hora | O começo chato, agora com tudo o que as outras etapas trouxeram | M |
| 10 | Jogar a campanha inteira | O fechamento que veio da Fase 3 | M |

**Por que o combate antes das missões:** todo minuto de jogo tem luta. Se a luta continua cansando, a missão melhor não aparece.

**Por que a primeira hora no fim:** ela é montada com as peças das outras etapas. Mas as etapas 2 e 3 já mudam a primeira hora sozinhas.

### O que acontece com a etapa 17 da Fase 3
Partes 1 e 2 estão feitas. Das 11 que faltam, a proposta é:
- **Entram na Fase 4**, porque mexem no mesmo lugar:
  - parte 13 (batalhões grandes e alcance dos arcos) → etapa 2;
  - parte 9 (batalha personalizada com aliados da IA e capitães) → etapa 2, como ferramenta de medir;
  - parte 11 (locais de missão) → etapa 4;
  - parte 3 (o gênero guardado e as Lendas) → etapas 5 e 8;
  - parte 10 (capitães e duelos) → etapa 7.
- **Continuam como pendências,** para fazer entre uma etapa e outra ou no fim: mar (partes 4 e 5), calamidades de cada continente (6), cercos da IA à vista (7), comboio e expedições no mapa (8) e o acabamento da arte (12).

### O que só o usuário decide
1. **O duelo:** o que faltou? Acontecer mais vezes, o peso dos golpes, o que está em jogo, ou a variedade de um para outro? A etapa 7 aposta em motivo e variedade.
2. **Batalhões grandes dentro da etapa 2:** confirma? O plano dela (tamanho por tropa, alcance, estandarte) ainda precisa do aval combinado.
3. **Quebra de saves:** uma só, na etapa 4, quando o gerador de mundo muda. Pode?
4. **Fase 4 agora ou pendências antes:** a proposta é começar pelas etapas 1 a 3 e deixar o resto da etapa 17 para depois.
5. **Quanto dura uma batalha boa?** Primeiros alvos: de 1 a 2 minutos a escaramuça de um batalhão, de 3 a 6 a batalha média.
6. **O título da fase.** Sugestões: "O bando que tem nome", "Sangue e fama", "Histórias de fogueira".
