# Roadmap — Fase 1: O bando ✅ OK

Fase concluída: todos os marcos estão **OK** (concluídos e jogáveis em greybox). O Marco 8 (magia) foi deixado para o fim e virou o Marco 19, na Fase 3.

Índice e visão geral: [ROADMAP.md](ROADMAP.md) · Próxima fase: [Fase 2 — O mundo que respira](ROADMAP_FASE_2.md) · Design: [GDD.md](GDD.md)

---

## Marco 1 — Combate Básico ✅ OK
**Objetivo:** provar o núcleo híbrido de ação + RTS.
- Comandante controlável (WASD, ataque com Espaço) com câmera seguindo-o em um mapa maior que a tela.
- 1 batalhão aliado recebendo ordens (mover, atacar, seguir) em formação de bloco.
- Inimigos (goblins) com IA de aggro/perseguição/ataque.
- HP por soldado + **Moral por batalhão**: perdas e flanqueamento reduzem a moral; moral baixa → pânico (ignora ordens e foge), com recuperação longe do perigo.
- Vitória/derrota, recompensa em ouro e **permadeath** de batalhões dizimados.

**Pronto quando:** dá para vencer ou perder uma batalha completa, e o resultado (ouro, baixas) aparece na Tenda.

## Marco 2 — Formações e Terreno ✅ OK
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

## Marco 3 — Tenda e Economia ✅ OK
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

## Marco 4 — Progressão RPG dos Batalhões ✅ OK
- Nível/XP, árvore de habilidades e equipamento por batalhão.
- Saque de inimigos, comércio em cidades, crafting com o ferreiro.

**Implementado:**
- Nível 1–5 e XP por batalhão: abates (12), sobreviver (15) e vencer (40); Campo de Treino dá 80 XP em 2 dias (15 ouro por batalhão, consome rações e pode cair um pagamento). Cada nível: +6% de vida e dano, 1 ponto de habilidade e +10% de salário (veteranos custam mais).
- Árvore de habilidades por tropa (2 ramos × 2 níveis, a avançada exige a base), aprendida no alojamento do batalhão. Ex.: Escudos Reforçados → Muralha Viva; Lanças de Carga → Investida Devastadora.
- Equipamento: arma (+12% de dano) e armadura (−10% de dano recebido) com 3 níveis, forjados na Ferraria com ouro e **ferro**.
- Saque em contratos vencidos (ouro e ferro por inimigo) e mercador ambulante de ferro na Intendência. *Comércio em cidades: feito no Marco 7.*
- Abates contados por batalhão (histórico de carreira), nível visível em campo, no HUD, nos alojamentos e no relatório de batalha.
- Números em `PROGRESSION` (`src/utils/constants.ts`), habilidades em `src/game/data/skills.ts`, regras em `src/utils/progression.ts`.

## Marco 5 — Tenentes ✅ OK
- NPCs únicos (nome, história, personalidade) que lideram batalhões e concedem passivas e bônus táticos.

**Implementado:**
- Tenentes gerados proceduralmente: nome, alcunha, história de origem, 2 traços (Ganancioso, Corajoso, Cauteloso, Sanguinário, Honrado, Ambicioso, Leal) e 1 passiva (Inspirador, Inabalável, Instrutor, Tático, Olho de Falcão, Frugal, Fúria). Até 4 contratados; o bando começa com 1; 2 candidatos novos no Posto de Recrutamento a cada volta de contrato.
- Em campo, o tenente marcha com o batalhão (anel prateado, 2,5x de vida, 1,5x de dano). A passiva só vale enquanto vive; a morte é permanente e tira 30 de moral do batalhão.
- Lealdade 0–100 mexida por: opinião sobre o contrato aceito, vitória/derrota/recuo (conforme os traços), salário atrasado (Ganancioso sofre o dobro), batalhão dizimado, falta de comando (Ambicioso). Em 15 ou menos, abandona o bando. Num motim, tenente com lealdade < 50 adere aos rebeldes.
- Conselho na Tenda: cada tenente aprova ou desaprova cada contrato, com o motivo.
- Crônica pessoal de cada tenente (batalhas, abates, mudanças de lealdade, comando), ficha no acampamento (clicando no tenente ou pela lista da Tenda) e designação de comando.
- Dados em `src/game/data/lieutenants.ts`, números em `LIEUTENANTS` (`src/utils/constants.ts`).

## Marco 6 — Mensageiros e Névoa de Guerra ✅ OK
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

## Marco 7 — Mapa Contínuo e Mapa Múndi ✅ OK
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

### Marco 7.1 — Mundo procedural ✅ OK
- **Cada campanha é um mundo novo** gerado de uma semente (`src/game/worldgen/`): 4×3 regiões (mundo de 12800×7200) com bioma e nome; acampamento numa região interna; 6–8 povoados com nomes gerados (sílabas), tipo, população, guarnição e mercado; 2–3 reinos (capital, governante, cor, temperamento) — os outros povoados juram fidelidade à capital mais próxima, algumas aldeias ficam livres; 5 locais de contrato com tema e layout próprios (ninho goblin, covil de bandidos, ruínas assombradas, vau do pântano), girados ao acaso; 4 covis; terreno por bioma; estradas por árvore geradora mínima.
- **Crônica gerada:** fundações, proclamação dos reinos, coroações, guerras que trocaram povoados, uma calamidade antiga (origem das ruínas), saques e a fundação do bando.
- **Tela de criação** (`NewWorldView`): semente digitável (texto ou número) ou "Outro mundo", prévia do mapa com regiões, reinos e crônica. "Novo mundo…" na Tenda abandona a campanha.
- Contratos vêm dos povoados reais (cliente conforme o tipo: "Senhor de…", "Guilda dos Mercadores de…") e somem de reinos em guerra com o bando. Inimigos novos: bandidos e esqueletos.
- Os mapas fixos (`BATTLE_MAPS`) deixaram de existir; dados do mundo em `WorldDef` (`src/game/data/world.ts`).

## Marco 9 — Reino e Calamidades ✅ OK
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
