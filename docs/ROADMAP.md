# Roadmap — Ascensão Mercenária

Desenvolvimento em **greybox**: só primitivas gráficas (círculos = aliados, quadrados = inimigos), UI em React + Tailwind. Cada marco precisa ser jogável de ponta a ponta antes de seguir para o próximo. Referência de design: [GDD.md](GDD.md).

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
- Saque em contratos vencidos (ouro e ferro por inimigo) e mercador ambulante de ferro na Intendência. *Comércio em cidades fica para o Marco 7 (mapa-múndi).*
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

## Marco 7 — Mapa Contínuo e Mapa Múndi
- Mundo seamless (exploração, acampamento explorável e combate no mesmo mapa).
- Mapa Múndi para viagem rápida e observação de exércitos.

## Marco 8 — Magia do Comandante
- Magias de dano em área (AoE) e de suporte/controle de grupo, liberadas no late-game.

## Marco 9 — Reino e Calamidades
- Fundar/conquistar vilas, Sala de Administração, gestão de províncias e economia macro.
- Calamidades geradas dinamicamente (necromante, horda orc...) num mundo sandbox.
