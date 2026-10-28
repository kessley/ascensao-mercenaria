# Roadmap — Ascensão Mercenária

Desenvolvimento em **greybox**: só primitivas gráficas (círculos = aliados, quadrados = inimigos), UI em React + Tailwind. Cada marco precisa ser jogável de ponta a ponta antes de seguir para o próximo. Referência de design: [GDD.md](GDD.md); as propostas da Fase 2 estão na seção 8 do GDD.

## Visão geral

| Fase | Marco | Tema | Estado |
| --- | --- | --- | --- |
| 1 — O bando | 1 | Combate básico | ✅ |
| | 2 | Formações e terreno | ✅ |
| | 3 | Tenda e economia | ✅ |
| | 4 | Progressão RPG dos batalhões | ✅ |
| | 5 | Tenentes | ✅ |
| | 6 | Mensageiros e névoa de guerra | ✅ |
| | 7 / 7.1 | Mapa contínuo, Mapa Múndi e mundo procedural | ✅ |
| | 9 | Reino e calamidades | ✅ |
| 2 — O mundo que respira | 10 | Fundações do mundo grande (save, simulação em camadas, dia e noite) | ✅ |
| | 11 | Geografia real: relevo, rios e mares | ⏭ próximo |
| | 12 | Mundo vivo: gente andando | |
| | 13 | Estações, clima e logística | |
| | 14 | Economia e comércio | |
| | 15 | Reinos vivos | |
| | 16 | Guerra de verdade: cercos e prisioneiros | |
| | 17 | Mares e continentes (o novo Mapa Múndi) | |
| | 18 | Legado e Lendas | |
| 3 — O arcano | 19 | Magia do Comandante (era o Marco 8) | por último |

**Regras para todos os marcos novos** (detalhes no GDD, seção 8.1):
- toda mecânica cria uma decisão com custo e conta uma história no diário;
- o estado do mundo aparece no mapa antes de aparecer na interface;
- a IA segue as mesmas regras do jogador;
- perdas parciais são preferíveis ao tudo-ou-nada;
- o jogo alterna tensão e respiro.

---

# Fase 1 — O bando (concluída)

## Marco 1 — Combate Básico ✅ concluído (greybox)
**Objetivo:** provar o núcleo híbrido de ação + RTS.
- Comandante controlável (WASD, ataque com Espaço) com câmera seguindo-o em um mapa maior que a tela.
- 1 batalhão aliado recebendo ordens (mover, atacar, seguir) em formação de bloco.
- Inimigos (goblins) com IA de aggro/perseguição/ataque.
- HP por soldado + **Moral por batalhão**: perdas e flanqueamento reduzem a moral; moral baixa → pânico (ignora ordens e foge), com recuperação longe do perigo.
- Vitória/derrota, recompensa em ouro e **permadeath** de batalhões dizimados.

**Pronto quando:** dá para vencer ou perder uma batalha completa, e o resultado (ouro, baixas) aparece na Tenda.

## Marco 2 — Formações e Terreno ✅ concluído (greybox)
- Formações Parede de Escudos e Cunha vs. combate disperso, com bônus e penalidades.
- Tipos de tropa: infantaria, arqueiros, cavalaria.
- Terreno: colina (+alcance para arqueiros), lama/pântano (lentidão, quebra a investida), floresta (ocultação).

**Pronto quando:** a escolha de formação e de posição no terreno muda o resultado de uma batalha.

**Implementado:**
- Formações (teclas 1–4 ou menu do batalhão): Linha, Parede de Escudos (só infantaria; −50% corpo a corpo e −75% flechas *pela frente*, lenta, não quebra a fileira), Cunha (+30% dano, recebe +15%), Disperso (−50% flechas, mais frágil no corpo a corpo).
- Tropas: Infantaria (60 ouro), Arqueiros (70; flechas com tempo de voo, dá para desviar), Cavalaria (100; investida após 140 px de corrida = dano 2,5x + empurrão).
- Terreno: Colina (+40% alcance de arqueiros, +15% dano de quem luta de cima), Lama/Pântano (lentidão forte, pior para cavalaria, zera a investida), Floresta (lenta; oculta tropas — emboscadas só aparecem a 140 px; flechas contra quem está nela causam −40%).
- Inimigos novos: goblins arqueiros numa colina e uma emboscada escondida na floresta.
- Números de balanceamento em `src/utils/constants.ts` (`TROOPS`, `FORMATIONS`, `TERRAIN`, `BALANCE`).

## Marco 3 — Tenda e Economia ✅ concluído (greybox)
- Contratos (adiantamento + bônus na conclusão) como fonte de recursos.
- Rações consumidas por dia; a falta reduz a moral inicial.
- Salários; atrasos geram deserção e, no limite, Motim (batalha contra os próprios soldados).
- Recrutamento de tropas cruas.

**Pronto quando:** existe um loop Tenda → contrato → batalha → pagamento com pressão econômica real.

**Implementado:**
- Tempo em dias. Marchas de contrato (2–4 dias) e a volta ao acampamento (1 dia) consomem rações: 1 a cada 4 soldados, mais o Comandante.
- Fome: cada dia sem rações tira 15 da moral inicial (mínimo 20). Mercado de rações na Intendência.
- Salário semanal (a cada 7 dias) por soldado conforme a tropa. Sem ouro: dívida, atraso e deserção de ~20% de cada batalhão; cada semana de atraso tira 15 da moral inicial.
- Motim após 2 semanas de atraso: contratos bloqueados até pagar os atrasados ou enfrentar o maior batalhão, que vira inimigo (quadrados roxos). Vitória restaura a ordem; derrota faz os amotinados fugirem com metade do ouro.
- Contratos: 3 ofertas em 3 mapas (Ninho goblin, Estrada da floresta, Vau do pântano) e 3 dificuldades; adiantamento ao aceitar, bônus só na vitória; previsão de fome e de pagamento na marcha.
- Reforço de batalhões desfalcados (repor soldados), diário do acampamento e moral inicial visível na Tenda.
- **Acampamento explorável** (`CampScene`): o Comandante anda (WASD ou clique, com desvio de obstáculos) entre a Tenda do Comandante (contratos, exército, diário), a Intendência (rações, atrasados), o Posto de Recrutamento, os alojamentos de cada batalhão (soldados em forma; rebeldes em roxo durante um motim), o Campo de Treino e a Ferraria (estes dois aguardando o Marco 4). Interação com E ou clique.
- Números em `ECONOMY` (`src/utils/constants.ts`), contratos em `src/game/data/contracts.ts`, mapas em `src/game/data/battleMaps.ts`.

## Marco 4 — Progressão RPG dos Batalhões ✅ concluído (greybox)
- Nível/XP, árvore de habilidades e equipamento por batalhão.
- Saque de inimigos, comércio em cidades, crafting com o ferreiro.

**Implementado:**
- Nível 1–5 e XP por batalhão: abates (12), sobreviver (15) e vencer (40); Campo de Treino dá 80 XP em 2 dias (15 ouro por batalhão, consome rações e pode cair um pagamento). Cada nível: +6% de vida e dano, 1 ponto de habilidade e +10% de salário (veteranos custam mais).
- Árvore de habilidades por tropa (2 ramos × 2 níveis, a avançada exige a base), aprendida no alojamento do batalhão. Ex.: Escudos Reforçados → Muralha Viva; Lanças de Carga → Investida Devastadora.
- Equipamento: arma (+12% de dano) e armadura (−10% de dano recebido) com 3 níveis, forjados na Ferraria com ouro e **ferro**.
- Saque em contratos vencidos (ouro e ferro por inimigo) e mercador ambulante de ferro na Intendência. *Comércio em cidades: feito no Marco 7.*
- Abates contados por batalhão (histórico de carreira), nível visível em campo, no HUD, nos alojamentos e no relatório de batalha.
- Números em `PROGRESSION` (`src/utils/constants.ts`), habilidades em `src/game/data/skills.ts`, regras em `src/utils/progression.ts`.

## Marco 5 — Tenentes ✅ concluído (greybox)
- NPCs únicos (nome, história, personalidade) que lideram batalhões e concedem passivas e bônus táticos.

**Implementado:**
- Tenentes gerados proceduralmente: nome, alcunha, história de origem, 2 traços (Ganancioso, Corajoso, Cauteloso, Sanguinário, Honrado, Ambicioso, Leal) e 1 passiva (Inspirador, Inabalável, Instrutor, Tático, Olho de Falcão, Frugal, Fúria). Até 4 contratados; o bando começa com 1; 2 candidatos novos no Posto de Recrutamento a cada volta de contrato.
- Em campo, o tenente marcha com o batalhão (anel prateado, 2,5x de vida, 1,5x de dano). A passiva só vale enquanto vive; a morte é permanente e tira 30 de moral do batalhão.
- Lealdade 0–100 mexida por: opinião sobre o contrato aceito, vitória/derrota/recuo (conforme os traços), salário atrasado (Ganancioso sofre o dobro), batalhão dizimado, falta de comando (Ambicioso). Em 15 ou menos, abandona o bando. Num motim, tenente com lealdade < 50 adere aos rebeldes.
- Conselho na Tenda: cada tenente aprova ou desaprova cada contrato, com o motivo.
- Crônica pessoal de cada tenente (batalhas, abates, mudanças de lealdade, comando), ficha no acampamento (clicando no tenente ou pela lista da Tenda) e designação de comando.
- Dados em `src/game/data/lieutenants.ts`, números em `LIEUTENANTS` (`src/utils/constants.ts`).

## Marco 6 — Mensageiros e Névoa de Guerra ✅ concluído (greybox)
- Ordens para tropas distantes levadas por Mensageiros com atraso físico e risco de interceptação.
- Visão limitada ao campo de visão das tropas.

**Implementado:**
- **Raio de comando** (380 px, círculo pontilhado em volta do Comandante): ordens dentro dele são instantâneas; fora, vão por mensageiro. Vale para tudo — marchar, atacar, seguir, formação, foco, arranjo e ordens a batedores.
- **Mensageiros a cavalo** (começa com 2; até 4 no Estábulo): cavalgam até o destinatário (mesmo em movimento), entregam e voltam; ocupados não levam outra ordem ("Sem mensageiro livre"). Esquivam, mas podem ser interceptados — a ordem se perde e o mensageiro morre de vez. **Nível de comando 1–3** pelas entregas (5 e 12): mais velocidade, esquiva e moral na entrega; nível 2+ **reagrupa batalhões em pânico**.
- **Batedor** (começa com 1; até 2): cavaleiro rápido (260), 60% de esquiva, **nunca luta** (recua de inimigos a 230 px). Modos Vanguarda (à frente do Comandante, padrão), Explorar (botão direito com o batedor selecionado) e Recolher. Visão 460, ×1,35 na colina.
- **Névoa de guerra** em grade (80 px): nunca visto / já explorado / visível; fontes de visão = Comandante, batalhões, batedores e mensageiros (colina amplia, floresta reduz). Inimigos fora de vista somem e deixam um **fantasma** na última posição conhecida (20 s).
- HUD: estado de cada mensageiro (livre / ✉ em missão / ↩ voltando / morto), cards de batedor com Vanguarda/Recolher, "✉ ordem a caminho" ou "fora do raio de comando" em cada batalhão, linha pontilhada da rota do mensageiro e um feed de acontecimentos.
- **Estábulo** no acampamento: cavalos no cercado, contratação e ficha de batedores e mensageiros (salários semanais próprios).
- Números em `SUPPORT` (`src/utils/constants.ts`); unidades em `src/game/entities/{Scout,Messenger}.ts`; névoa em `src/game/systems/FogOfWar.ts`.

## Marco 7 — Mapa Contínuo e Mapa Múndi ✅ concluído (greybox)
- Mundo seamless (exploração, acampamento explorável e combate no mesmo mapa).
- Mapa Múndi para viagem rápida e observação de exércitos.

**Pronto quando:** dá para aceitar um contrato, marchar ou viajar até o local, lutar ali mesmo, voltar ao acampamento andando e ver o mundo mudar sozinho (bandos, saques) sem nenhuma troca de tela.

**Implementado:**
- **Uma única cena** (`WorldScene`) com acampamento, povoados, locais de contrato e ermos no mesmo mapa (a geografia passou a ser gerada a cada campanha no Marco 7.1). A antiga `CampScene` virou `CampArea`, desenhada dentro do mundo.
- **Acampamento no mapa:** paliçada com portão a oeste; dentro, o relógio para e as tropas vão para os alojamentos; saindo, voltam a seguir o Comandante. Recrutar, reforçar, subir de nível, forjar ou trocar de tenente recria o batalhão em campo na hora (fora de combate).
- **Contratos no mapa:** aceitar marca o local (★ no Mapa Múndi) e o prazo (marcha estimada + 4 dias); os inimigos surgem lá. Matar todos paga o bônus. Dá para abandonar; vencido o prazo, o contrato some.
- **Combate em qualquer lugar:** começa quando inimigos perseguem alguém do bando ou estão à vista perto de uma tropa, e termina após 3 s de calma. O relatório traz baixas, XP só para quem lutou, saque por inimigo abatido (na vitória) e o contrato cumprido. **Derrota:** o Comandante é levado ferido ao acampamento com o exército (passa 1 dia).
- **Relógio:** 1 dia a cada 3200 px de marcha (ou 240 s parado no campo); para no acampamento e em combate. HUD com o dia e o progresso.
- **Bandos errantes:** a partir do dia 3, um bando novo a cada 3 dias (máx. 3), saindo de um covil fora de vista; tamanho 5 + 2 por semana de campanha, 30% arqueiros, com nome. Marcham até uma cidade (saque: −30 de prosperidade), até o acampamento (sem guarda: −40% das rações e −15% do ouro) ou pelos ermos. O primeiro avistamento, os saques e a destruição entram no diário.
- **Cidades:** mercado com preços locais de rações e ferro, que pioram com a prosperidade baixa (recupera 4 por dia).
- **Mapa Múndi (Tab):** pausa o mundo; névoa (nunca visto / explorado / à vista), exército, bandos à vista com o rumo ou na última posição conhecida (com o dia) e a lista de exércitos avistados. Clique num destino (acampamento, cidade, local ou área explorada) → dias de marcha, rações e aviso de bando perto da rota. A viagem rápida anda em passos de 0,05 dia com os bandos marchando junto e para se um deles chegar a 450 px (interceptação). Bloqueada em combate, com inimigos à vista, com mensageiros fora ou durante um motim.
- **Desempenho:** inimigos a mais de 1800 px de qualquer aliado "dormem" (não pensam nem lutam; bandos adormecidos só se deslocam); terreno e chão em pedaços com culling pela câmera; a névoa só é desenhada perto da câmera.
- **Motim no acampamento:** o batalhão rebelado vira inimigo ali mesmo, diante dos alojamentos.
- Números em `WORLD` (`src/utils/constants.ts`); geografia em `src/game/data/world.ts`; bandos em `src/game/systems/Warbands.ts`; acampamento e cidades em `src/game/world/{CampArea,Settlements}.ts`; Mapa Múndi em `src/ui/views/WorldMapView.tsx`.

### Marco 7.1 — Mundo procedural ✅ concluído (greybox)
- **Cada campanha é um mundo novo** gerado de uma semente (`src/game/worldgen/`): 4×3 regiões (mundo de 12800×7200) com bioma e nome; acampamento numa região interna; 6–8 povoados com nomes gerados (sílabas), tipo, população, guarnição e mercado; 2–3 reinos (capital, governante, cor, temperamento) — os outros povoados juram fidelidade à capital mais próxima, algumas aldeias ficam livres; 5 locais de contrato com tema e layout próprios (ninho goblin, covil de bandidos, ruínas assombradas, vau do pântano), girados ao acaso; 4 covis; terreno por bioma; estradas por árvore geradora mínima.
- **Crônica gerada:** fundações, proclamação dos reinos, coroações, guerras que trocaram povoados, uma calamidade antiga (origem das ruínas), saques e a fundação do bando.
- **Tela de criação** (`NewWorldView`): semente digitável (texto ou número) ou "Outro mundo", prévia do mapa com regiões, reinos e crônica. "Novo mundo…" na Tenda abandona a campanha.
- Contratos vêm dos povoados reais (cliente conforme o tipo: "Senhor de…", "Guilda dos Mercadores de…") e somem de reinos em guerra com o bando. Inimigos novos: bandidos e esqueletos.
- Os mapas fixos (`BATTLE_MAPS`) deixaram de existir; dados do mundo em `WorldDef` (`src/game/data/world.ts`).

## Marco 9 — Reino e Calamidades ✅ concluído (greybox)
- Fundar/conquistar vilas, Sala de Administração, gestão de províncias e economia macro.
- Calamidades geradas dinamicamente (necromante, horda orc...) num mundo sandbox.

**Implementado:**
- **Povoados vivos** (`Settlement` no store, regras em `src/game/sim/realm.ts`): dono (reino, livre, bando, ruínas ou calamidade), prosperidade, população, guarnição, construções e impostos. Bandeira e nome no mapa mudam com o dono.
- **Fundar vila** (botão no painel do Comandante, fora do acampamento, a 1600 px de outros povoados: 250 ouro + 10 ferro). **Conquistar:** "Atacar" no painel do povoado → a guarnição (até 18 soldados e besteiros na cor do reino) sai para lutar; vencer entrega o povoado ao bando. Atacar um reino = guerra; aldeia livre = −10 de relação com todos. **Reconstruir** ruínas (180 ouro + 15 ferro).
- **Sala de Administração** (povoados do bando): impostos baixos/normais/altos (renda ×0,6/1/1,5; prosperidade +1/0/−5 por dia), construções (Fazendas +12 rações/sem., Mina +5 ferro, Mercado +40% de impostos, Muralhas = defesa ×2, Quartel = +3 milicianos/sem. e guarnição até 30), armar milícia (+5 por 40 ouro). Renda semanal entra antes do pagamento de salários; a população cresce com a prosperidade.
- **Títulos:** Capitão mercenário → Senhor (1 povoado) → Barão (2) → Rei (4).
- **Reinos rivais:** relação −100..100 (contrato cumprido +10, calamidade derrotada +25, atacar −80); reinos belicosos ou com relação ≤ −50 declaram guerra e mandam um exército a cada 6 dias (6 + 2 por povoado do reino) contra os povoados do bando ou o acampamento. Tributo (150 ouro, +45) sela a paz. Diplomacia na Tenda.
- **Mundo vivo (semanal):** reinos tomam aldeias uns dos outros, governantes morrem e são substituídos, feiras e febres mexem na prosperidade.
- **Combate abstrato** quando o exército não está perto: força do bando (goblins ×1, exércitos ×1,2, hordas ×1,5) contra a defesa (guarnição × muralhas + base do tipo). Resultado: resistiu (o bando perde metade), saqueado, tomado ou arruinado.
- **Calamidades** (a primeira entre os dias 10 e 16; outra 25–35 dias depois de vencida): Lorde Necromante ou Horda Orc com líder de nome gerado, covil desenhado no mapa (descoberto ao ser visto), guarda e um **chefe** (900/1200 de vida, com coroa). Força +1 a cada 3 dias e +2 por povoado que cai; hordas a cada 4 dias (6 + 2×força) saindo do covil ou de cidades ocupadas. Necromante arruína cidades; orcs as ocupam (dá para libertar). Matar o líder: +400 de ouro, +25 com todos os reinos, cidades ocupadas ficam livres.
- Números em `REALM` e `BUILDINGS` (`src/utils/constants.ts`); UI em `SettlementPanel`, `RealmPanels` (diplomacia e crônica) e no Mapa Múndi (povoados na cor do dono, covis ☠).

---

# Fase 2 — O mundo que respira

Objetivo da fase: mundos maiores e mais vivos, em que cada sistema (geografia, estações, comércio, reinos) alimenta os outros. Os marcos estão em ordem de dependência.

## Marco 10 — Fundações do mundo grande ✅ concluído (greybox)
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

## Marco 11 — Geografia real: relevo, rios e mares
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

## Marco 12 — Mundo vivo: gente andando
**Objetivo:** o jogador entende o estado do bando e do mundo só de olhar. GDD 8.7.
- **Soldados com rotina** no acampamento (dormir, comer, treinar, jogar dados, fila do pagamento, cuidar dos cavalos). O comportamento mostra fome, moral baixa, salário atrasado (**o motim dá sinais antes de estourar**) e a festa depois de uma vitória.
- **Seguidores do acampamento** (cozinheiro, mascate, curandeira, capelão, famílias): têm serviços, consomem rações e correm risco quando o acampamento fica sem guarda.
- **Tenentes andando pelo acampamento**, com relações entre eles (amizade e rivalidade) e eventos de briga e camaradagem.
- **Eventos com escolha** no acampamento (2 ou 3 respostas, efeito na moral, na lealdade e na honra).
- **Gente de passagem**, só nos pedaços visíveis e com objetos reaproveitados: camponeses, viajantes, peregrinos, caçadores e animais. Moradores e guardas nos povoados, em número conforme a prosperidade.
- **Agentes reais:** patrulhas dos reinos (caçam bandos de verdade), mensageiros dos reinos (interceptáveis) e refugiados fugindo das calamidades.
- **Sinais:** camponeses fugindo, fumaça de saque visível de longe, rastros de exército e corvos sobre campos de batalha.

**Pronto quando:** dá para perceber fome, moral baixa e motim chegando só olhando o acampamento; e os sinais no mapa revelam onde está o perigo antes de o inimigo aparecer.

## Marco 13 — Estações, clima e logística
**Objetivo:** o tempo e o abastecimento passam a pesar no plano de campanha. GDD 8.5 e 8.6.
- **Calendário** de 4 estações (ex.: 20 dias cada): lama e cheias na primavera, temporada de campanha no verão, colheita e feiras no outono, neve, frio e rios congelados no inverno.
- **Clima diário por região:** chuva (arqueiros −25% de alcance), nevoeiro (visão −50%) e neve.
- **Fadiga por batalhão** e marcha forçada.
- **Trem de carroças físico**, com capacidade; carroças são alvo de bandos. **Forragear**, com esgotamento da região.
- **Feridos em vez de só mortos** (Enfermaria, curandeira) e **doenças** que se espalham.
- **Acampamento móvel:** levantar e remontar o acampamento em outro lugar. Fortificações para o acampamento fixo.
- **A IA obedece às estações:** os reinos vão para os quartéis de inverno; os mortos-vivos não.

**Pronto quando:** o inverno muda o plano do jogador (parar, se preparar ou aproveitar a guerra parada), e perder as carroças numa emboscada vira uma crise de verdade.

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

---

# Fase 3 — O arcano

## Marco 19 — Magia do Comandante (era o Marco 8, deixado por último)
**Objetivo:** magia rara e poderosa, mas cara. GDD 3 e 8.14.
- **Dano em área (AoE)** e **suporte/controle**, como previsto desde o início.
- **Aprendizado pelo mundo:** grimórios e artefatos em ruínas antigas, magos da corte capturados e mestres de outro continente.
- **Custo:** recurso arcano, reação política (cortes e templos: −Honra, +Temor) e marcas no corpo do Comandante.
- **Magias que mexem nos sistemas:** congelar um rio, chamar nevoeiro, apagar tochas, curar feridos, quebrar a moral de um exército.
- **Calamidades mágicas** com fraquezas e respostas mágicas.

**Pronto quando:** uma magia bem usada vira uma batalha difícil, mas usá-la tem um preço político e pessoal.

---

## Banco de ideias (ainda sem marco)
- **Religiões e templos:** fé por cultura, peregrinações, cruzadas contra calamidades e heresias.
- **Armas e armaduras com nome e história**, que passam de batalhão em batalhão.
- **Espionagem:** espiões nas cortes, sabotagem e roubo de planos de campanha.
- **Torneios e duelos** nas capitais (fama e ouro, risco ao Comandante).
- **Monstros lendários únicos** (raros, por ser low fantasy), com covil e lenda na crônica.
