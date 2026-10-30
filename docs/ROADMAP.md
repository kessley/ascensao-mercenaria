# Roadmap — Ascensão Mercenária

Desenvolvimento em **greybox**: só primitivas gráficas (círculos = aliados, quadrados = inimigos), UI em React + Tailwind. Cada marco precisa ser jogável de ponta a ponta antes de seguir para o próximo. Referência de design: [GDD.md](GDD.md); as propostas da Fase 2 estão na seção 8 do GDD.

O roadmap fica dividido por fase, para os arquivos não ficarem longos:
- [Fase 1 — O bando](ROADMAP_FASE_1.md): Marcos 1 a 9 — ✅ OK, fase concluída.
- [Fase 2 — O mundo que respira](ROADMAP_FASE_2.md): Marcos 10 a 18 — em andamento.
- Fase 3 — O arcano: Marco 19, neste arquivo (abaixo), até a fase começar.

**OK** = marco concluído e jogável em greybox.

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
| | 17 | Mares e continentes (o novo Mapa Múndi) | ⏭ próximo |
| | 18 | Legado e Lendas | |
| 3 — O arcano (abaixo) | 19 | Magia do Comandante (era o Marco 8) | por último |

**Regras para todos os marcos novos** (detalhes no GDD, seção 8.1):
- toda mecânica cria uma decisão com custo e conta uma história no diário;
- o estado do mundo aparece no mapa antes de aparecer na interface;
- a IA segue as mesmas regras do jogador;
- perdas parciais são preferíveis ao tudo-ou-nada;
- o jogo alterna tensão e respiro.

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
- **Ficou de fora:** cercos a cidades muradas e batalhas com aliados controlados pela IA.

---

## Banco de ideias (ainda sem marco)
- **Religiões e templos:** fé por cultura, peregrinações, cruzadas contra calamidades e heresias.
- **Armas e armaduras com nome e história**, que passam de batalhão em batalhão.
- **Espionagem:** espiões nas cortes, sabotagem e roubo de planos de campanha (o Marco 15 trouxe o básico: favores de espionagem, cartas e esgotos).
- **Monstros lendários únicos** (raros, por ser low fantasy), com covil e lenda na crônica.
