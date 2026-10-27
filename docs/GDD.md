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

## 1. Visão Geral do Jogo

O jogador inicia como o líder de um pequeno bando de mercenários e deve ascender através de contratos militares, saques e gestão inteligente. Com uma mistura de combates de ação em 2D, ordens táticas de RTS em tempo real e progressão de RPG, o objetivo final é expandir a influência do bando até se tornar uma força capaz de fundar vilas e, eventualmente, um reino independente.

## 2. O Mundo e a Ambientação

- **Low Fantasy:** A magia existe, mas é escassa e altamente elitizada. Apenas monarcas de alto nível e magos da corte possuem acesso. O jogador, ao longo de sua ascensão, aprenderá a dominar essas artes arcanas perdidas.
- **Ameaças Variadas:** O mundo é povoado por reinos humanos rivais e criaturas fantásticas brutais, como Goblins e Orcs. Os contratos mercenários variam de defesas locais contra ninhos de monstros a lutar na linha de frente em guerras políticas.
- **Mapa Contínuo (Seamless):** A exploração, a gestão e o combate ocorrem no mesmo mapa contínuo em tempo real. Existe uma opção de "Mapa Múndi" (visão distanciada) utilizada exclusivamente para Viagem Rápida e para observar movimentações de exércitos ou pontos de interesse dentro do campo de visão das suas tropas.

## 3. O Comandante e os Tenentes

- **Câmera e Controle:** O jogo possui uma perspectiva gráfica em 2D (estilo top-down ou isométrica) para otimizar o desenvolvimento. A câmera foca no Comandante, que participa ativamente do combate corpo a corpo de forma fluida.
- **Tenentes (Personagens Únicos):** Além do Comandante, o jogador pode recrutar Tenentes. São NPCs únicos com nomes, histórias e personalidades próprias. Eles lideram Batalhões, acompanham o jogador nas reuniões da Tenda e oferecem diferentes habilidades passivas e bônus táticos para suas tropas.
  - **Personalidade e Lealdade:** Cada Tenente tem traços (ex.: Ganancioso, Corajoso, Cauteloso, Honrado, Ambicioso, Leal) que definem como reage aos acontecimentos: opina sobre os contratos no conselho da Tenda e ganha ou perde lealdade com vitórias, recuos, salários atrasados, a perda do seu batalhão ou a falta de comando. Com lealdade baixa, abandona o bando; num motim, escolhe um lado conforme a lealdade.
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

- **Exploração e UI:** O acampamento militar é um ambiente 2D explorável. A gestão fina (contratos, loadouts, treinamentos) ocorre na Tenda do Comandante através de uma mesa estratégica.
- **Aquisição de Equipamentos:** Feita através de Saque de inimigos mortos, Comércio em cidades e Crafting pelos ferreiros do acampamento.
- **Economia de Suprimentos:** O exército exige gestão constante de estoque.
  - **Rações (Comida):** Consumida diariamente. A falta de comida diminui drasticamente o Moral inicial das tropas antes mesmo da batalha começar.
  - **Salários (Ouro):** Tropas exigem pagamento regular. Atrasar salários leva à perda de tropas por deserção e pode culminar em um Motim, forçando o Comandante a combater seus próprios soldados rebelados.
  - **Contratos:** São a principal fonte de injeção de recursos, pagando um adiantamento logístico e um bônus gordo na conclusão.

## 7. A Transição para o Reino e Estrutura de Campanha

- **De Acampamento para Reino:** O late-game muda o paradigma da gestão. Ao fundar/conquistar uma vila, o jogador ganha acesso a uma nova interface na Sala de Administração do castelo/fortaleza. O mapa top-down será usado para gerenciar as províncias, desenvolvimento da vila e a economia macro, complementando as mecânicas de mercenário.
- **Mundo Sandbox com Eventos de Calamidade:** A estrutura principal é livre e Sandbox. O jogador decide quem atacar e com quem aliar. Contudo, para dar propósito narrativo, haverá um sistema de "Calamidades".
- **Calamidades:** Eventos em grande escala gerados dinamicamente no mundo (ex: um lorde necromante se ergue no leste, uma horda gigantesca de orcs se une sob um novo líder, etc). O jogador, com seu exército e reino, decide se vai combater essas ameaças ou se aproveitar do caos que elas causam nas facções rivais.
