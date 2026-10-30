# Documento de Game Design (GDD) — Ascensão Mercenária

| Parâmetro | Detalhe |
| --- | --- |
| Gênero | RTS / RPG Tático / Ação 2D (Top-Down/Isométrico) |
| Ambientação | Fantasia Sombria / Low Fantasy |
| Público-Alvo | Fãs de estratégia tática, RPGs de gestão e combate tático imersivo |

## 0. Pilares de Design

1. **Gerador de histórias (inspirado em RimWorld).** O jogo não conta uma história roteirizada: ele *gera* histórias. Sistemas interligados — economia, fome, salários, moral, permadeath, Tenentes com personalidade, eventos e Calamidades — produzem narrativas emergentes diferentes a cada campanha. O fracasso deve ser tão interessante quanto o sucesso (um motim, uma deserção em massa, um batalhão veterano perdido). O diário do acampamento é a crônica dessa história.
   - Personagens (Comandante, Tenentes, batalhões) acumulam histórico, traços e relações que mudam como reagem aos acontecimentos.
   - Eventos têm consequências duradouras e se encadeiam (ex.: fome → moral baixa → derrota → atraso de salário → motim).
2. **Combate de campo de batalha (inspirado em Total War).** Batalhões são unidades com moral, formação e posição: flanquear, segurar uma colina, quebrar uma investida na lama ou fazer o inimigo fugir em pânico decide a batalha mais do que números brutos.
3. **Controle e gestão em tempo real (inspirado em Age of Empires).** Leitura clara do campo e comando direto: seleção por clique ou caixa, ordens com o botão direito, grupos e arranjos de tropas; recursos (ouro, rações) que sustentam o exército.
4. **Mundo físico e vivo.** O jogador habita o mundo: anda pelo acampamento (tendas, intendência, campo de treino, ferraria, alojamentos), vê suas tropas e interage com os locais, em vez de navegar só por menus.
5. **Mundo que não espera (inspirado em Dwarf Fortress).** O mundo continua vivendo longe do jogador: reinos guerreiam, caravanas viajam, calamidades crescem, povoados prosperam ou morrem. Perto do bando tudo é simulado em detalhe; longe, de forma abstrata, mas sempre pelas mesmas regras. A IA joga com as regras do jogador: reinos pagam soldados, passam fome e sofrem com o inverno.
6. **Toda informação tem idade.** O jogador só sabe o que viu ou ouviu. Exércitos fora de vista viram fantasmas, preços conhecidos envelhecem e notícias chegam com o atraso dos viajantes. Explorar, mandar batedores e ouvir rumores fazem parte do jogo.

## 1. Visão Geral do Jogo

O jogador inicia como o líder de um pequeno bando de mercenários e deve ascender através de contratos militares, saques e gestão inteligente. Com uma mistura de combates de ação em 2D, ordens táticas de RTS em tempo real e progressão de RPG, o objetivo final é expandir a influência do bando até se tornar uma força capaz de fundar vilas e, eventualmente, um reino independente.

## 2. O Mundo e a Ambientação

- **Low Fantasy:** A magia existe, mas é escassa e altamente elitizada. Apenas monarcas de alto nível e magos da corte possuem acesso. O jogador, ao longo de sua ascensão, aprenderá a dominar essas artes arcanas perdidas.
- **Ameaças Variadas:** O mundo é povoado por reinos humanos rivais e criaturas fantásticas brutais, como Goblins e Orcs. Os contratos mercenários variam de defesas locais contra ninhos de monstros a lutar na linha de frente em guerras políticas.
- **Mapa Contínuo (Seamless):** A exploração, a gestão e o combate ocorrem no mesmo mapa contínuo em tempo real. Existe uma opção de "Mapa Múndi" (visão distanciada) utilizada exclusivamente para Viagem Rápida e para observar movimentações de exércitos ou pontos de interesse dentro do campo de visão das suas tropas.
  - **Mundo procedural (como Dwarf Fortress):** cada campanha nasce num mundo novo, gerado de uma semente que o jogador pode digitar ou sortear (a mesma semente gera sempre o mesmo mundo). O gerador cria regiões com bioma (campos, florestas, colinas, pântanos) e nome próprio, a posição do acampamento, povoados com nomes gerados (aldeias, cidades, fortalezas), dois ou três reinos rivais com capital e governante, locais de contrato com layout próprio (ninho goblin, covil de bandidos, ruínas assombradas, vau do pântano), covis de monstros e estradas ligando tudo.
  - **História do mundo:** antes do jogo começar, o mundo já tem séculos de crônica gerada: quem fundou cada povoado, quando os reinos foram proclamados, guerras que trocaram povoados de mãos, uma calamidade antiga que deixou ruínas, os saques recentes e a fundação do bando do jogador. A crônica fica na tela de criação e na Tenda do Comandante.
  - **Sem telas de batalha:** o combate começa quando tropas e inimigos se encontram, em qualquer ponto do mapa, e termina sozinho quando ninguém mais está lutando, com um relatório (baixas, XP de quem lutou, saque, contrato). Recuar é simplesmente sair dali.
  - **O tempo é a marcha:** o dia avança com a distância percorrida pelo exército — 3 regiões por dia (≈ 1,5 min de marcha; a noite dura ≈ 30 s) — e devagar com o tempo parado (6 min por dia). Dentro das muralhas de um povoado só corre o relógio de quem está parado: andar pelas ruas não é marcha. Dentro do acampamento e durante um combate o relógio para. Rações, salários, prazos e o surgimento de ameaças correm nesse relógio.
  - **Estações e clima:** o ano tem 4 estações de 20 dias.
    - **Primavera:** lama e cheia que fecha os vaus.
    - **Verão:** campanha.
    - **Outono:** colheita e feiras.
    - **Inverno:** neve no norte e nas montanhas, rios congelados e reinos nos quartéis de inverno.

    Cada região tem o seu tempo do dia: chuva encurta os arcos, nevoeiro esconde todos e neve pesa no passo.
  - **Dia e noite:** o dia tem horas e vira na aurora. À noite o mundo escurece e só tochas, fogueiras e janelas iluminam.
    - O bando escolhe entre marchar com tochas acesas (enxerga mais, mas é visto de longe) ou no escuro (se esconde dos homens, mas não de goblins e mortos-vivos, que enxergam e lutam melhor à noite).
    - Quem surge do escuro e ataca de imediato pega o inimigo de surpresa: é a emboscada noturna, que tira moral.
    - À noite dá para descansar até o amanhecer, se nenhum bando chegar perto.
  - **Um continente grande:** o mapa é um continente (pequeno, médio ou grande, à escolha) de regiões de 4800×3600 px, com uns 20 povoados e de 3 a 6 reinos. Perto do bando tudo é simulado em detalhe; longe, os bandos e exércitos marcham como dados e só viram tropas de verdade quando alguém do bando se aproxima.
  - **Geografia de verdade:**
    - **Forma do continente:** mar em volta, montanhas, lagos e rios que nascem nas terras chuvosas e descem até o mar. Os biomas seguem o clima: o norte é frio, e há deserto na sombra de chuva das montanhas.
    - **Bloqueios:** água funda e montanha bloqueiam a passagem. Rios só se cruzam em **vaus** (rasos: lentos, sem formação, mais vulneráveis e mais fracos na água) e **pontes**. As estradas abrem **passos** nas montanhas.
    - **Gargalos:** quem segura a saída de um vau segura um exército inteiro.
    - **Pontes:** podem ser queimadas (corta a rota de exércitos e hordas, mas irrita o dono) e reconstruídas. Quem controla a ponte cobra pedágio.
  - **História simulada:** a crônica não é sorteada. O mundo roda séculos de história antes da campanha (reinos que nascem, guerreiam e caem, reis que morrem, calamidades que deixam ruínas), e o mapa inicial é o resultado. A idade do mundo é uma opção da criação.
  - **Salvar e carregar:** a campanha pode ser salva fora de combate (3 espaços e um automático, gravado a cada dia). O save guarda a semente do mundo, não o mapa.
  - **Mapa Múndi:** pausa o mundo. Mostra o que já foi explorado, o exército e os exércitos inimigos à vista (com o rumo da marcha) ou a última posição conhecida. Viagem Rápida só para lugares já explorados, nunca com inimigos à vista ou mensageiros fora; os dias da marcha passam de verdade e um bando inimigo que cruze o caminho intercepta o exército.
  - **Mundo vivo (gerador de histórias):** bandos errantes saem dos covis com o passar dos dias, crescem conforme a campanha avança, ganham nome (ex.: "Bando de Grukk Dente-Podre") e marcham até cidades ou até o acampamento. Uma cidade saqueada perde prosperidade (os preços sobem até ela se recuperar); um acampamento deixado sem guarda perde rações e ouro. Avistamentos, saques e bandos destruídos entram no diário.
- **Próxima fase (proposta):** o mapa ganha três escalas (Campo, Mapa do Continente e um Mapa Múndi com vários continentes), relevo, rios, oceano, estações, comércio por oferta e procura e reinos com nobres e planos próprios. Ver a seção 8.

## 3. O Comandante e os Tenentes

- **Câmera e Controle:** O jogo possui uma perspectiva gráfica em 2D (estilo top-down ou isométrica) para otimizar o desenvolvimento. A câmera foca no Comandante, que participa ativamente do combate corpo a corpo de forma fluida.
- **Tenentes (Personagens Únicos):** Além do Comandante, o jogador pode recrutar Tenentes. São NPCs únicos com nomes, histórias e personalidades próprias. Eles lideram Batalhões, acompanham o jogador nas reuniões da Tenda e oferecem diferentes habilidades passivas e bônus táticos para suas tropas.
  - **Personalidade e Lealdade:** Cada Tenente tem traços (ex.: Ganancioso, Corajoso, Cauteloso, Honrado, Ambicioso, Leal) que definem como reage aos acontecimentos: opina sobre os contratos no conselho da Tenda e ganha ou perde lealdade com vitórias, recuos, salários atrasados, a perda do seu batalhão ou a falta de comando. Com lealdade baixa, abandona o bando; num motim, escolhe um lado conforme a lealdade.
  - **Amizades e rivalidades:** os tenentes convivem no acampamento. Os traços os aproximam ou afastam dia a dia, e vitórias lado a lado unem. Amigos se visitam e rendem noites de histórias na fogueira (moral e lealdade); rivais acabam no braço, e o Comandante decide quem punir.
  - **Presença em campo e morte permanente:** O Tenente luta junto ao batalhão que comanda; sua passiva só vale enquanto estiver vivo, e sua morte é definitiva e abala a moral das tropas. Cada Tenente guarda uma crônica pessoal do que viveu ao lado do Comandante.
- **Evolução e Magia:** No início, o Comandante é um exímio guerreiro físico. Conforme o late-game se aproxima, ele adquire habilidades mágicas que alteram o rumo da batalha.
- **Tipos de Magia:**
  - **Dano em Área (AoE):** Feitiços de impacto concentrado, funcionando como granadas ou artilharia.
  - **Suporte e Controle de Grupo:** Feitiços que alteram o campo de batalha, fortalecendo aliados, curando ou prejudicando o movimento inimigo.

## 4. O Exército e os Batalhões (Progressão de RPG)

- **Gestão de Tropas:** O exército é gerido em "Batalhões", que funcionam como Personagens de RPG (possuem Nível, Árvore de Habilidades e Equipamentos customizáveis).
- **Morte Permanente (Permadeath):** O risco é real. Se um Batalhão de alto nível for completamente dizimado em combate, ele é perdido para sempre. O jogador precisará recrutar e equipar tropas cruas do zero.
- **Moral de Batalha:** Além da Vida (HP), os batalhões possuem uma barra de Moral. Ser flanqueado, tomar dano de magias brutais ou enfrentar monstros aterrorizantes pode quebrar o moral da tropa, fazendo-os ignorar ordens e fugir do campo de batalha em pânico.

## 5. Sistema de Combate Híbrido e Terreno

- **Mensageiros e Ordens:** Ordens para tropas distantes no Mapa de Batalha são entregues por Mensageiros NPCs em tempo real, criando um atraso tático e o risco da ordem ser interceptada.
  - **Comunicação em camadas (como na Idade Média):** No barulho e na poeira da batalha, palavras não chegam longe. Cada ordem viaja pelo meio que a época permitia:
    - **Voz** (perto do Comandante): qualquer ordem, na hora.
    - **Trombetas, clarins e tambores** (alcance maior): só *toques básicos combinados de antemão* — Avançar, Alto, Carregar, Recuar e Reunir ao estandarte. Uma tropa engalfinhada no corpo a corpo pode não ouvir o toque.
    - **Estandarte e bandeiras** (sinal visual, alcance ainda maior): troca de formação e "seguir o estandarte", desde que haja linha de visão (florestas bloqueiam).
    - **Mensageiros a cavalo:** levam as ordens *complexas* — marchar até um ponto, atacar um alvo específico, concentrar o ataque, reorganizar o grupo — e qualquer ordem que nenhum outro meio alcance.
  - **Mensageiros a cavalo:** São poucos e persistentes. Levam trombeta e bandeira próprias: não precisam encostar na tropa — cavalgam até ficar ao alcance do seu sinal (maior conforme a experiência), sinalizam a ordem e voltam ao Comandante; enquanto estão fora, não podem levar outra. Se forem abatidos no caminho (arqueiros, emboscadas), a ordem se perde e o Mensageiro morre de vez.
  - **Estandarte do Comandante:** As tropas seguem e protegem a bandeira do seu senhor. Enxergá-la dá coesão (perdem menos moral e se recuperam mais rápido); se o estandarte vacila — o Comandante gravemente ferido —, o pânico se espalha entre quem o vê.
  - **Grito de Guerra:** O Comandante, que luta na linha de frente, pode bradar o nome do bando: as tropas próximas recobram o ânimo e as que estão em pânico bem perto dele se reagrupam. Depois de iniciado o choque, influenciar a batalha passa a depender muito mais da presença do líder e de enviar reservas aonde a linha cede do que de ordens detalhadas.
  - **Habilidade de Comando:** Cada Mensageiro ganha autoridade com as entregas. Autoridade maior significa cavalgar mais rápido, esquivar mais e, na entrega, levantar a moral da tropa; os mais experientes conseguem até reagrupar um batalhão em pânico — algo que uma ordem comum não faz.
- **Batedores (Reconhecimento):** Cavaleiros leves, muito rápidos e esquivos, que nunca entram em combate: diante do inimigo, recuam mantendo distância. Ampliam a visão do Comandante conforme a posição — à frente da marcha (vanguarda), num ponto mandado explorar ou numa colina, de onde enxergam mais longe. Também morrem de vez.
- **Névoa de Guerra:** O jogador só vê o que suas tropas veem (Comandante, batalhões, batedores e mensageiros). O terreno já explorado fica conhecido, mas inimigos fora de vista desaparecem, deixando apenas a última posição conhecida ("fantasma"). Colinas ampliam a visão; florestas a reduzem e escondem tropas.
- **Dinamismo Estratégico:** Alternância livre entre formações militares rígidas (Parede de Escudos, Cunha) e combate disperso orgânico.
- **Armas Combinadas (Arranjos de Grupo):** Além da formação interna de cada Batalhão, o jogador define como vários Batalhões se dispõem entre si ao marchar juntos ou acompanhar o Comandante: Linha única, Arqueiros atrás (protegidos pela linha de frente), Cavalaria nos flancos (infantaria no centro, cavalaria nas pontas para flanquear, arqueiros atrás) ou Coluna (estreita, para atravessar lama e floresta). Grupos também podem receber ordens coordenadas, como concentrar todo o ataque em um único alvo (Foco no alvo).
- **Influência do Terreno:** O cenário é uma arma. Arqueiros ganham bônus de alcance em colinas; lama e pântanos quebram a investida e desaceleram a cavalaria; florestas densas ocultam a movimentação de tropas e mensageiros inimigos.

## 6. O Acampamento, Gestão e Economia

- **Exploração e UI:** O acampamento militar é um lugar do próprio mapa, cercado por uma paliçada com portão. O Comandante entra caminhando; ao entrar, as tropas que o seguiam vão viver a rotina do acampamento (dormir, comer, treinar, jogar dados, tarefas — ver seção 8.7), e ao sair elas voltam a segui-lo.
  - **O acampamento mostra o estado do bando antes da interface:** fila na Intendência quando falta comida, rodinhas cochichando quando o soldo atrasa, o batalhão rebelado reunido diante da tenda antes do motim, festa na fogueira depois de uma vitória.
  - **Seguidores, humor, honra e eventos:**
    - **Seguidores:** cozinheiro, mascate, curandeira, capelão e famílias seguem o bando, prestam serviços e comem rações.
    - **Humor do acampamento:** soma na moral com que as tropas saem.
    - **Honra:** cresce com a palavra cumprida e a clemência.
    - **Eventos com escolha:** pequenos dramas que pedem uma decisão do Comandante. A gestão fina (contratos, loadouts, treinamentos) ocorre na Tenda do Comandante através de uma mesa estratégica. Com um painel aberto o mundo fica em pausa.
- **Aquisição de Equipamentos:** Feita através de Saque de inimigos mortos, Comércio em cidades e Crafting pelos ferreiros do acampamento.
- **Cidades:** cada cidade tem um mercado com preços próprios (a aldeia vende comida barata, a cidade mineira tem ferro barato, a fortaleza paga bem pelo ferro). A prosperidade cai com saques e se recupera com os dias.
  - **Povoados de verdade:** cada povoado tem planta própria.
    - **Muralha:** paliçada nas aldeias, pedra com torres nas cidades e fortalezas; só se entra pelos portões.
    - **Dentro:** ruas em grade com quarteirões de casas, a praça do mercado com barracas e poço, o paço ou castelo onde fica a Sala de Administração, o templo nas cidades.
    - **Fora:** lavouras em volta dos muros. Por dentro de cada portão fica o acampamento da guarnição.
  - **Guarnição:** os soldados do povoado existem de verdade no mapa.
    - **Onde ficam:** sentinelas do lado de fora dos portões; rondas pelas ruas; o resto nos acampamentos, onde treina, dorme e forma atrás do portão quando há perigo.
    - **Lutam de verdade:** contra goblins e hordas que chegam (as patrulhas dos reinos também).
    - **Força:** quantos são se vê pelo acampamento cheio ou vazio. Os reinos repõem a guarnição devagar.
  - **Recursos da terra:** madeira, pedra, ferro, grão, peixe, sal, peles, cavalos e ervas, conforme os biomas em volta. Barateiam o mercado local e rendem para o dono.
  - **Portões:** um povoado não deixa um exército estrangeiro entrar.
    - **Exército do bando:** só entra nos povoados do bando e nas ruínas; nos outros, espera diante do portão.
    - **Comandante:** entra sozinho para negociar e comerciar.
    - **Guerra, calamidade ou cerco:** os portões fecham para todo o bando.
  - **Atacar:** um povoado é atacado pelo portão, do lado de fora.
    - **Defesa:** os próprios soldados saem dali para lutar.
    - **Em guerra:** chegar perto dos muros já faz a guarnição sair.
    - **Baixas:** os mortos de um ataque que fracassa ficam fazendo falta.
  - **Gente:** moradores e camponeses dão vida às ruas e aos campos; mais gente quanto maior e mais próspero o povoado. À noite as janelas se acendem. Em ruínas, os muros têm brechas e as casas viram entulho.
- **Economia de Suprimentos:** O exército exige gestão constante de estoque.
  - **Rações (Comida):** Consumida diariamente. A falta de comida diminui drasticamente o Moral inicial das tropas antes mesmo da batalha começar.
    - **Onde fica:** o estoque fica no depósito do acampamento; em campo, o exército come só o que o **trem de carroças** leva.
    - **Alcance:** a capacidade das carroças limita o alcance da campanha.
    - **Risco:** as carroças são o alvo preferido dos saqueadores.
    - **Forragem:** forragear completa a comida, mas esgota a região.
  - **Fadiga, feridos e doenças:** marchar e lutar cansam cada batalhão; marcha forçada troca cansaço por caminho. Parte dos que caem fica ferida e volta da enfermaria. Pântano, fome, frio e acampamento lotado espalham doenças.
  - **Acampamento móvel:** pode ser levantado e montado em outro lugar. Paliçada reforçada, torres e fosso protegem o acampamento fixo e se perdem na mudança.
  - **Salários (Ouro):** Tropas exigem pagamento regular. Atrasar salários leva à perda de tropas por deserção e pode culminar em um Motim, forçando o Comandante a combater seus próprios soldados rebelados.
  - **Contratos:** São a principal fonte de injeção de recursos, pagando um adiantamento logístico e um bônus gordo na conclusão. Aceito na tenda, o contrato marca um local no mapa e um prazo; o bônus sai quando todos os inimigos do local caem. Vencido o prazo, o cliente contrata outro bando.
  - **Motim:** acontece dentro do acampamento: o batalhão rebelado pega em armas ali mesmo, diante dos alojamentos.

## 7. A Transição para o Reino e Estrutura de Campanha

- **De Acampamento para Reino:** O late-game muda o paradigma da gestão. Ao fundar/conquistar uma vila, o jogador ganha acesso a uma nova interface na Sala de Administração do castelo/fortaleza. O mapa top-down será usado para gerenciar as províncias, desenvolvimento da vila e a economia macro, complementando as mecânicas de mercenário.
  - **Fundar:** com ouro e ferro, o Comandante funda uma aldeia em qualquer lugar do campo longe de outros povoados. **Conquistar:** atacar um povoado faz a guarnição sair para lutar; vencê-la entrega o povoado ao bando (atacar um reino é declarar guerra; tomar aldeias livres assusta todas as coroas). Ruínas podem ser reconstruídas.
  - **Sala de Administração:** impostos (baixos fazem a cidade prosperar; altos rendem mais e a empobrecem), construções (fazendas, mina, mercado, muralhas, quartel) e milícia. Toda semana os povoados do bando pagam ouro, rações e ferro, crescem em população e treinam guarnição. Sem o exército por perto, é a guarnição (dobrada pelas muralhas) que enfrenta bandos, exércitos e hordas.
  - **Títulos:** o Comandante sobe de Capitão mercenário a Senhor, Barão e Rei conforme os povoados que governa.
- **Reinos rivais:** cada reino tem governante, temperamento (belicoso, mercantil, devoto) e uma relação com o bando: sobe com contratos cumpridos e calamidades derrotadas, cai com ataques. Reinos com rancor declaram guerra e mandam exércitos (com a cor do reino) contra os povoados do jogador. Tributo compra a paz. Toda semana o mundo se mexe sozinho: reinos tomam aldeias uns dos outros, governantes morrem e são substituídos, feiras e febres mudam a prosperidade.
- **Mundo Sandbox com Eventos de Calamidade:** A estrutura principal é livre e Sandbox. O jogador decide quem atacar e com quem aliar. Contudo, para dar propósito narrativo, haverá um sistema de "Calamidades".
- **Calamidades:** Eventos em grande escala gerados dinamicamente no mundo (ex: um lorde necromante se ergue no leste, uma horda gigantesca de orcs se une sob um novo líder, etc). O jogador, com seu exército e reino, decide se vai combater essas ameaças ou se aproveitar do caos que elas causam nas facções rivais.
  - Começam como **rumor** numa região; o covil só aparece no mapa quando alguém do bando o encontra. A calamidade fica mais forte com o tempo e a cada povoado que cai, e lança hordas cada vez maiores contra qualquer povoado, do jogador ou dos reinos. Os mortos do necromante deixam cidades em **ruínas**; a horda orc **ocupa** as cidades (o jogador pode libertá-las).
  - Matar o líder (um chefe com coroa, muito mais forte que os soldados) encerra a calamidade: recompensa em ouro, gratidão de todas as coroas e as cidades ocupadas ficam livres. Algum tempo depois, outra calamidade desperta.

## 8. Próxima Fase — Propostas de Design (Marcos 10 a 19)

> Esta seção descreve sistemas **planejados, ainda não implementados**. Os números são pontos de partida para o balanceamento. A ordem de implementação está no [ROADMAP](ROADMAP.md).

### 8.1 Regras de ouro do design
Toda mecânica nova passa por estes filtros:
1. **Cria uma decisão.** Nada de bônus grátis: cada sistema oferece escolhas com custo. Exemplo: marchar pela ponte, que é segura e longa, ou pelo vau, que é rápido e exposto?
2. **Conta uma história.** Todo acontecimento relevante vira uma linha no diário ou na crônica e, quando possível, uma consequência que volta depois (o lorde humilhado lembra).
3. **Aparece no mundo antes da interface.** Fome, moral, perigo e riqueza aparecem no mapa: soldados cabisbaixos, fumaça no horizonte, camponeses fugindo, mercados cheios.
4. **Simetria.** Reinos, calamidades e bandos obedecem às mesmas regras do jogador (comida, salário, moral, estações, terreno). Isso deixa a IA previsível o bastante para ser explorada.
5. **Perder pela metade.** Perdas parciais e recuperáveis (feridos, prisioneiros, carga roubada, cidade saqueada) são preferíveis ao tudo-ou-nada. O permadeath continua, mas raramente sem aviso.
6. **Tensão e respiro.** Inverno, tréguas e viagens criam pausas naturais para a gestão; campanhas, cercos e calamidades criam os picos.

### 8.2 Três escalas de mapa

| Escala | O que é | Para que serve |
| --- | --- | --- |
| **Campo** (mapa local contínuo) | O terreno onde o Comandante anda e luta, em tempo real | Exploração, combate, acampamento, povoados |
| **Mapa do Continente** (Tab; é o atual Mapa Múndi) | Visão estratégica do continente onde o bando está | Viagem rápida por terra, rio e costa; exércitos avistados; rotas; preços conhecidos |
| **Mapa Múndi** (novo; no porto ou com Shift+Tab) | O planeta: 3 a 5 continentes, ilhas e oceanos | Viagens marítimas, comércio entre continentes, notícias e calamidades do outro lado do mar |

- **Mapas maiores:** o continente inicial passa de 4×3 para cerca de 10×8 regiões (≈ 32000×19200 px, umas 10 jornadas de leste a oeste). Os outros continentes vão de ilhas pequenas a terras maiores que a inicial.
- **Geração em pedaços:** o Campo é gerado em pedaços (ex.: 1600×1600 px) sob demanda, sempre igual para a mesma semente e a mesma célula do Mapa Múndi. Só os pedaços perto da câmera e do exército ficam em memória. Um continente nunca visitado existe apenas como dados grossos (relevo, biomas, povoados, reinos) até o bando desembarcar nele.
- **Névoa nas três escalas:** um continente nunca visitado aparece só pelo contorno das cartas náuticas compradas ou pelo relato de marinheiros.

### 8.3 Geração do mundo v2: relevo, rios, mares e história simulada
> Implementado no Marco 11 (detalhes no Roadmap); os recursos por bioma chegaram no fechamento do Marco 12. Ainda não: os bens e as cadeias de produção (Marco 14).
Todas as etapas usam a semente:
1. **Relevo:** um mapa de altitude do planeta (ruído + máscaras de continentes) e o nível do mar definem oceanos, mares interiores, continentes e ilhas.
2. **Clima:** a temperatura vem da latitude e da altitude; a chuva vem dos ventos dominantes, com sombra de chuva atrás das montanhas.
3. **Biomas:** oceano, costa/praia, campos, floresta, floresta densa, colinas, montanhas (só atravessáveis pelos passos), pântano, estepe, deserto e tundra/neve.
4. **Rios e lagos:** a água nasce onde chove muito e desce pelo relevo até o mar ou um lago. O volume acumulado define o tipo: riacho, rio ou rio grande. Os lagos ficam nas depressões.
5. **Recursos:** ferro e pedra nas colinas e montanhas, madeira nas florestas, sal na costa e nos desertos, cavalos nas estepes, grãos nas várzeas. Os luxos (especiarias, seda, vinho fino, âmbar) só existem em certos continentes.
6. **Povos:** cada continente recebe uma **cultura**, com gerador de nomes próprio, tropas típicas, bens preferidos e temperamento. Os povoados nascem onde há água, terra fértil, cruzamento de rios ou foz (que vira porto).
7. **Estradas e rotas:** as estradas seguem o caminho de menor custo, com pontes onde cruzam rios e passos nas montanhas. Rotas marítimas ligam os portos.
8. **História simulada:** em vez de sortear a crônica, o gerador **roda a própria simulação de reinos** (seção 8.9) em passos grossos por 100 a 400 anos. Povoados crescem e caem, reinos se unem e se partem, dinastias mudam e calamidades antigas deixam ruínas e lendas. O mundo que o jogador recebe é o resultado. Na tela de criação ele escolhe o tamanho do mundo, o número de continentes, a idade do mundo (jovem, média ou antiga) e a frequência das calamidades.

### 8.4 Rios e oceano no Campo
> Implementado no Marco 11: riachos rasos, vaus, rios fundos, pontes queimáveis com pedágio, passos nas montanhas e as regras da água (+25% de dano recebido, −20% causado, sem formação nem investida). A balsa chegou no fechamento do Marco 12; a cheia da primavera e os rios congelados do inverno (com gelo fino), no Marco 13. Ainda não: as barcaças (Marco 14) e os portos em uso (Marco 17).
- **Riacho:** dá para atravessar a vau em qualquer ponto, com −40% de velocidade e a formação desfeita.
- **Rio:** só se atravessa nos **vaus** (marcados no mapa) ou nas **pontes**. Dentro do vau o movimento fica muito lento, quem está na água recebe +25% de dano, não dá para usar a Parede de Escudos e a cavalaria perde a investida. Defender a saída de um vau é a manobra clássica.
- **Rio grande:** só por ponte, balsa (paga e demorada) ou barco.
- **Pontes:** são gargalos estratégicos. Podem ser **queimadas** (atrasa o inimigo e irrita o dono) e **reconstruídas** com madeira. Quem controla a ponte cobra **pedágio**.
- **Rios nas estações:** a cheia da primavera fecha os vaus por alguns dias. No inverno os rios congelam e podem ser atravessados em qualquer ponto, mas o gelo fino pode romper sob tropas pesadas.
- **Rios dão vida:** as várzeas produzem mais grão, moinhos melhoram as fazendas e as **barcaças** levam carga rio abaixo por muito menos do que as carroças.
- **Costa e mar:** praias permitem desembarque; portos têm cais, estaleiro e farol. Piratas e saqueadores vindos do mar atacam aldeias costeiras.

### 8.5 Tempo: horas, dia e noite, estações e clima
> Horas, dia e noite, tochas, criaturas da noite, emboscada noturna e descanso: implementados no Marco 10 (seção 2). Estações, clima diário por região e a previsão do tenente Cauteloso: Marco 13 (detalhes e números no Roadmap). A noite cansa o dobro pela fadiga. Ainda não: a tempestade no mar (Marco 17).
- **Horas do dia:** o dia ganha fases (aurora, dia, crepúsculo e noite) e continua avançando com a marcha. **À noite:**
  - a visão cai 40% (tochas ajudam, mas denunciam a posição);
  - goblins e mortos-vivos ganham bônus;
  - marchar cansa o dobro;
  - uma emboscada noturna tira moral de quem é surpreendido.
- **Calendário:** o ano tem 4 estações (ex.: 20 dias cada).
  - *Primavera:* lama fora das estradas (−20% de velocidade), cheias e semeadura.
  - *Verão:* temporada de campanha, com mais contratos e exércitos em marcha.
  - *Outono:* colheita (grão barato, entram os impostos rurais) e feiras.
  - *Inverno:* neve no norte e nas montanhas (−40% de velocidade; o frio causa atrito em quem está sem abrigo) e rios congelados. Os reinos recolhem os exércitos aos **quartéis de inverno**, mas os mortos-vivos não sentem frio.
- **Clima diário por região:**
  - claro;
  - chuva: arqueiros com −25% de alcance, mais lama;
  - nevoeiro: visão −50%, ótimo para emboscadas;
  - neve;
  - tempestade, no mar.

  Um tenente com o traço certo prevê o tempo do dia seguinte.

### 8.6 Logística, fadiga e saúde
> Implementado no Marco 13: fadiga e marcha forçada, trem de carroças com depósito no acampamento e carga em campo, forragem com esgotamento, feridos e enfermaria, doenças (também nos povoados), acampamento móvel e obras do acampamento fixo. Ainda não: ferro, saque e carga comercial nas carroças (Marco 14).
- **Fadiga** por batalhão (0–100): sobe com marcha forçada, marcha noturna, terreno ruim e combate; desce com descanso. Com fadiga alta o batalhão fica mais lento, causa menos dano e recupera a moral mais devagar. É a escolha clássica entre chegar antes e chegar inteiro.
- **Trem de carroças:** rações, ferro, saque e carga comercial viajam em **carroças** de verdade que seguem o exército. Elas são lentas na lama e, em terreno difícil, ficam presas às estradas. A capacidade das carroças limita o alcance da campanha. São o alvo preferido dos bandos: perdê-las é perder a comida.
- **Forragear:** no campo, o exército pode coletar comida da região. Rende pouco no inverno e no deserto, esgota a região por semanas e irrita o dono das terras.
- **Feridos em vez de mortos:** parte dos soldados que caem fica **ferida** (ex.: 40%, mais com uma curandeira). Os feridos voltam depois de alguns dias na **Enfermaria**; sem cuidados, alguns morrem. As vitórias ficam menos amargas e as derrotas ainda doem.
- **Doenças:** pântano, fome, inverno sem abrigo e acampamento lotado espalham doenças (disenteria, febre). Elas passam entre batalhões e chegam aos povoados pelas rotas comerciais.
- **Acampamento móvel:** o bando pode **levantar o acampamento** (1 a 2 dias de desmontagem, tudo nas carroças) e montá-lo em outro lugar: perto da frente de guerra, de uma rota rica ou em outro continente. Paliçada, torres e fosso são melhorias de um acampamento fixo.

### 8.7 Mundo vivo: gente andando
> Implementado no Marco 12:
> - **Acampamento:** a rotina e os sinais do acampamento, com a fila do pagamento no dia do soldo e o ferro levado à Ferraria.
> - **Seguidores:** com o ajudante de ferreiro; o número de seguidores cresce com o tamanho e a fama do bando; o mascate tem banca.
> - **Relações e eventos:** as relações entre tenentes e os eventos com escolha.
> - **Gente e bichos:** moradores, guardas nas portas, nas ruas e na muralha, camponeses, viajantes, peregrinos, caçadores, cervos e lobos.
> - **Agentes:** as patrulhas, os mensageiros e os refugiados.
> - **Sinais:** a fumaça, os corvos e os rastros (mais fundos e duradouros na lama e na neve).
>
> Ficam para depois: as caravanas (Marco 14) e os exércitos de lordes (Marco 15).
**No acampamento** (o estado do bando aparece no próprio acampamento):
- Cada soldado é um bonequinho com rotina: dorme na barraca à noite, come na fogueira, treina, joga dados, faz fila no pagamento, cuida dos cavalos e leva ferro para a ferraria.
- **O comportamento mostra o estado do bando:**
  - com fome, há filas na Intendência e reclamações;
  - com moral baixa, gente sentada e cabisbaixa;
  - com salário atrasado, rodinhas cochichando: o **motim dá sinais antes de estourar**;
  - depois de uma vitória, festa em volta da fogueira.
- **Seguidores do acampamento:** cozinheiros, mascates, curandeira, capelão, ajudantes de ferreiro e famílias.
  - Crescem com a fama e o tamanho do bando, e consomem rações.
  - Prestam serviços: a curandeira cuida dos feridos, o capelão dá moral, o mascate vende itens.
  - Num acampamento sem guarda, são eles que correm risco.
- **Tenentes** andam entre as tendas, conversam e criam **relações entre si** (amizade ou rivalidade). Uma briga entre tenentes rivais é um evento.
- **Eventos com escolha (como no RimWorld):** um soldado pego roubando, dois batalhões disputando a melhor barraca, um desertor arrependido que volta. Cada evento tem 2 ou 3 respostas, com efeitos na moral, na lealdade dos tenentes e na honra.

**No mapa:**
- **Gente de passagem**, que só existe nos pedaços visíveis e custa pouco: camponeses nos campos, viajantes, peregrinos, caçadores e animais (cervos; lobos que atacam batedores sozinhos).
- **Agentes de verdade**, simulados sempre, mesmo fora da tela:
  - caravanas;
  - patrulhas dos reinos, que caçam bandidos de verdade;
  - exércitos de lordes;
  - mensageiros dos reinos (interceptar um revela planos);
  - refugiados fugindo das calamidades.
- **Sinais legíveis:** camponeses correndo para a aldeia indicam perigo perto; a fumaça de uma aldeia queimada se vê de longe; exércitos deixam rastros na lama e na neve; corvos rondam um campo de batalha recente.
- **Dentro dos povoados:** moradores, barracas no mercado, guardas na muralha. Uma cidade próspera está cheia; uma saqueada está vazia.

### 8.8 Economia e comércio
- **Bens** (cerca de 10): Grãos, Gado, Sal, Madeira, Ferro, Tecido, Cerveja/Vinho, Armas e Armaduras, Cavalos e Luxos (especiarias, seda e outros, vindos de outros continentes). Para que servem:
  - grão e gado viram rações;
  - o ferro vira equipamento;
  - os cavalos limitam o recrutamento de cavalaria;
  - a madeira constrói pontes, máquinas de cerco e navios.
- **Cadeias simples:** cada povoado produz conforme o bioma, os recursos e as construções, e consome conforme a população: comida para todos, tecido e cerveja para a gente comum, luxos para os nobres. Cada bem tem um estoque.
- **Preço por oferta e procura:** preço = base × (procura dos próximos dias ÷ estoque), limitado entre 0,3× e 4×. Colheitas, guerras, saques e calamidades mexem nos preços sozinhos: a guerra encarece armas e cavalos, a colheita barateia o grão.
- **Caravanas** são agentes reais. Compram onde é barato e vendem onde é caro, entre os mercados que conhecem, por estradas, rios e mar. Podem ser saqueadas por bandidos, ou pelo jogador, ao custo de honra e relação. Uma caravana destruída deixa o destino sem carga: um bando goblin numa estrada pode causar fome numa cidade a três dias dali.
- **Informação tem preço:** o jogador só conhece os preços dos mercados que visitou ou de que ouviu falar, sempre com a data ("Preços de Valelos — há 6 dias"). O Livro de Preços fica na Tenda.
- **O bando comerciante:**
  - leva carga nas carroças (pesa e atrasa a marcha);
  - contrata **caravaneiros próprios**, com rota e escolta;
  - abre **feitorias** em povoados e investe em guildas;
  - cobra pedágio em pontes e estradas do seu território e taxa os mercados dos seus povoados.
- **Contrabando e embargos:** reinos em guerra proíbem o comércio entre si. Contrabandear dá lucro alto, com risco de multa, confisco e perda de relação.
- **Contratos econômicos:** escoltar uma caravana, recuperar carga roubada, abrir uma rota infestada ou sabotar o comércio de um rival.

### 8.9 Reinos vivos
- **Personagens da nobreza:** cada reino tem rei, herdeiros e 2 a 4 lordes vassalos. Cada um tem traços (como os tenentes), idade, ambição, feudos e **memória pessoal do Comandante** (favores e ofensas). Nobres morrem, casam, conspiram e traem.
- **IA de reino por objetivos:** toda semana o reino avalia as suas necessidades (fome, ameaça, oportunidade, vingança, riqueza) e escolhe um **plano**: campanha contra um vizinho, defesa de uma fronteira, cruzada contra a calamidade, expansão para terras livres ou uma rota comercial. Os planos viram **ações visíveis**:
  - convocação de recrutas, que tira braços do campo e baixa a produção;
  - um exército de lorde marchando no mapa;
  - um cerco que dura dias.
- **Guerra cansa:** perdas, fome e duração aumentam o **cansaço de guerra**. Passado um limite, o reino aceita a paz (território, tributo, troca de prisioneiros) e uma trégua de algumas estações.
- **Diplomacia entre as IAs:** alianças defensivas, casamentos, pactos e traições. Uma aliança de reinos pode se formar **contra o jogador** se ele crescer rápido demais ou espalhar terror.
- **Sucessão:** a morte de um rei sem herdeiro claro abre uma crise. Dois pretendentes significam **guerra civil**, e os dois contratam mercenários.
- **Revoltas:** impostos altos, fome ou conquista recente geram revoltas camponesas, que aparecem como um bando rebelde no mapa.
- **Lealdade dos povoados:** cada povoado tem lealdade ao dono. Pesam a cultura diferente, os impostos, a fome, os saques e a guarnição. Com lealdade baixa, o povoado recusa impostos, se revolta ou troca de lado.
- **Contratos emergentes:** todo contrato nasce de uma necessidade real da simulação. Exemplos:
  - o reino em guerra quer tomar Pedralva;
  - uma aldeia está ameaçada por um bando que está a dois dias dali;
  - um nobre capturado precisa de resgate;
  - um rival quer queimar uma ponte.

  Cumprir o contrato muda o mundo, e o lado contrário lembra.
- **Notícias e rumores:** os acontecimentos se espalham de povoado em povoado na velocidade dos viajantes. Por exemplo, uma região por dia; mais rápido por estradas e rios, muito mais lento entre continentes.
  - O jogador ouve rumores nos mercados, de viajantes e de mensageiros interceptados.
  - O diário registra, por exemplo: "Chegou a Valelos a notícia de que…".
- **Vassalagem:** um caminho alternativo à independência. O bando jura fidelidade a um rei em troca de um feudo e de proteção, e passa a dever obediência às **convocações**. Recusar uma convocação custa honra e relação.
- **A corte:** a capital tem uma sala do trono, com audiências para pedir contratos, títulos, casamentos, resgates e paz.

### 8.10 Reputação: Fama, Honra e Temor
Além da relação com cada reino e com cada personagem, o bando tem três reputações globais:
- **Fama:** cresce com vitórias, calamidades vencidas e batalhas famosas. Atrai recrutas, tenentes melhores e mais seguidores, e aumenta o valor dos contratos.
- **Honra:** cresce ao cumprir contratos, poupar prisioneiros e não trair. Honra alta abre contratos de nobres e alianças. Honra baixa atrai clientes desesperados e traiçoeiros, que pagam mais e às vezes não pagam.
- **Temor:** cresce com cidades arrasadas, execuções e saques. Povoados se rendem sem lutar e guarnições inimigas fogem mais cedo. Em troca, os reinos formam coalizões contra o bando e a lealdade dos povoados conquistados cai.

### 8.11 Guerra de verdade: cercos e prisioneiros
- **Exércitos da IA se enfrentam no mapa.** Dentro da bolha de detalhe a batalha é real e o jogador pode assistir, intervir ou saquear os restos. Fora dela, vale a resolução abstrata atual.
- **Cercos físicos:** povoados têm muralhas e portões reais. O sitiante escolhe entre:
  - **assalto**, com escadas e aríete feitos de madeira durante os dias de cerco; os defensores nas muralhas têm bônus de altura;
  - **fome**, porque o povoado tem um estoque de comida. Mas o sitiante também precisa comer, e a doença ronda os dois lados.

  O defensor pode fazer **surtidas** e pedir socorro ao seu reino.
- **Prisioneiros:** depois de uma vitória, os inimigos que se renderam podem ser:
  - **resgatados** por ouro (nobres valem muito);
  - **recrutados**, com lealdade baixa no começo;
  - **libertados**, ganhando honra;
  - **executados**, ganhando temor (alguns tenentes odeiam isso).

  Nobres capturados lembram de como foram tratados.
- **Comandante capturado:** uma derrota grave pode terminar com a captura do Comandante, em vez da volta ao acampamento. O bando, liderado por um tenente, precisa pagar o resgate ou libertá-lo à força.

### 8.12 Mares e continentes
- **Navios:**
  - barca costeira: barata, só perto da costa;
  - coca: carga e tropas em mar aberto;
  - nau: grande e cara, para viagens longas.

  O bando pode **fretar uma passagem** ou **comprar navios** (manutenção semanal e tripulação paga).
- **Capacidade:** cada soldado ocupa 1 lugar, cada cavalo 3 e cada carroça 4. Dá para atravessar com a cavalaria ou com mais infantaria, não com tudo.
- **A viagem** acontece no Mapa Múndi e leva dias, conforme a distância, o vento e a estação. Riscos:
  - tempestade: perde carga ou homens;
  - calmaria: mais dias de viagem, mais rações;
  - **piratas**: um encontro leva a uma batalha de **abordagem**, num mapa pequeno de Campo que é o convés.
- **Outros continentes** têm culturas, nomes, tropas típicas (ex.: arqueiros montados das estepes, infantaria pesada das ilhas), bens e calamidades próprios. Ao desembarcar, o Campo é gerado sob demanda. Lá ninguém conhece o bando: a fama local começa em zero e os primeiros contratos são ruins.
- **Comércio entre continentes:** os luxos de um continente valem fortunas em outro. As notícias e os preços de lá chegam com semanas de atraso.
- **Colônias e feitorias de ultramar:** fundar um porto em outro continente cria uma ligação permanente, com rotas próprias e base para um segundo acampamento.
- **Os reinos da IA também navegam:** invasões pelo mar e piratas profissionais são ameaças reais na costa.

### 8.13 Legado e Lendas
- **O Comandante envelhece e pode morrer.** Quando ele morre, um tenente **herda o bando** (o mais leal ou o escolhido em testamento). A campanha continua com outro protagonista, e os traços dele mudam o rumo. O jogo só acaba quando o bando acaba.
- **Ambições:** objetivos opcionais que o jogador escolhe, como tornar-se rei, vencer três calamidades, dominar o comércio de sal ou unir um continente. Cada uma dá bônus e tem um epílogo próprio.
- **Epílogo e Modo Lendas:** no fim, a crônica completa vira um livro navegável, como as Lendas do Dwarf Fortress: pessoas, batalhas, reinos, povoados e o que o bando fez a cada um.
- **Mundos que lembram (opcional):** um mundo pode ser recarregado com a mesma semente "séculos depois". O bando antigo, os seus feitos e as suas ruínas entram na história gerada.

### 8.14 Magia, por último e ligada ao mundo
A magia (o último marco) aproveita os sistemas anteriores:
- **É rara.** O Comandante a aprende com grimórios e artefatos achados em ruínas antigas (as da história simulada), com magos da corte capturados ou com mestres de outro continente.
- **Tem custo.** Além do recurso arcano, usar magia sem ser nobre ofende cortes e templos (−honra com alguns reinos, +temor). Magias poderosas deixam marcas no corpo do Comandante.
- **Conversa com os outros sistemas.** Além das magias de dano em área e de suporte já previstas, ela pode:
  - congelar um rio para atravessar;
  - chamar um nevoeiro para uma emboscada;
  - apagar as tochas à noite;
  - curar feridos;
  - quebrar a moral de um exército inimigo.
- **Calamidades mágicas** (como o necromante) passam a ter fraquezas e respostas mágicas.

### 8.15 Arquitetura da simulação (técnico)
> Implementado no Marco 10: a bolha e o nível do continente (bandos como dados ou como tropas), o Campo em pedaços, salvar e carregar. O nível do mundo chega com os outros continentes (Marco 17). A aleatoriedade da partida ainda usa o gerador do navegador; ela não é salva.
- **Três níveis de detalhe:**
  1. *Bolha* (perto do Comandante e do exército, cerca de 2 a 3 telas): entidades do Phaser em tempo real.
  2. *Continente* (o resto do continente onde o bando está): agentes abstratos (exércitos, caravanas, patrulhas, mensageiros) andando pelo grafo de estradas e rios, com posição contínua e tick diário (ou frações de dia durante a viagem rápida).
  3. *Mundo* (os outros continentes): simulação estatística semanal; produção, guerras e calamidades são resolvidas por números.
- **Entrada e saída da bolha:** quando um agente abstrato entra na bolha, vira entidade com o mesmo estado (soldados, moral, carga); ao sair, volta a ser dado. Nada aparece ou some do nada.
- **Funções puras:** as regras ficam em funções puras, como em `sim/realm.ts`, testáveis e reaproveitadas pela história simulada da geração do mundo.
- **Dois geradores aleatórios:** a geração do mundo usa a semente; a partida usa outro gerador, salvo junto com o jogo.
- **Salvar e carregar** é obrigatório em campanhas longas. O save guarda a semente, o estado da simulação e o que mudou nos pedaços do Campo (pontes queimadas, vilas fundadas), não o mapa inteiro. Há autosave a cada dia e ao entrar no acampamento.
