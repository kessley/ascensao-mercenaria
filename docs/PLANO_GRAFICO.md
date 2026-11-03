# Plano gráfico: pixel art

Proposta para trocar o greybox por pixel art. Os números de tamanho e de frames são estimativas; a Etapa 0 existe para confirmá-los antes de produzir arte em volume.

## Como o jogo desenha hoje
- **Nenhuma textura:** tudo é desenhado por código, com `Graphics`. Não há imagem carregada nem atlas.
- **Soldado:** um contêiner com dois `Graphics`, que gira livremente para onde olha. É parte do que limita os batalhões grandes.
- **Chão:** pedaços de 1600×1600 px pintados por código a partir do bioma. O continente é gerado, então não dá para desenhar mapa à mão.
- **Povoados:** a planta é gerada, e cada povoado é desenhado de uma vez, no chão, sem sprites separados.
- **Câmera:** zoom livre de 25% a 125%, em passos de 10%, numa tela de 1280×720 esticada para caber.
- **Interface:** React, separada do jogo. Pode mudar sem mexer no motor.

## O que a pixel art muda
- **Bom:** sprites saem num atlas, desenhados em lote. Trocar `Graphics` por sprites deve ser o maior ganho para os batalhões grandes, e por isso as duas frentes viram uma só.
- **Girar acaba:** pixel art não gira. O soldado passa a ter direções desenhadas.
- **O zoom precisa de degraus:** com escala quebrada, os pixels tremem. Proposta: 25%, 50%, 100% e 200%.
- **Tela esticada:** em monitor 1080p a escala é 1,5×, que também treme. Precisa de um filtro de escala ou de uma tela interna maior.
- **Quatro culturas multiplicam o trabalho:** por isso a arte precisa ser em camadas, com troca de cores.

## Decisões

### 1. Perspectiva (decide tudo o mais)
| | Vista 3/4, como Stardew Valley | De cima, como é hoje |
| --- | --- | --- |
| Aparência | Personagens de corpo inteiro, muito mais carisma | Topos de cabeça, difícil distinguir tropas |
| Direções | 4 (3 desenhadas e 1 espelhada) | 8 ou mais para parecer fluido |
| Prédios | Mostram a fachada, e soldados passam atrás deles | Só telhados |
| Custo | Alto: povoados e acampamento precisam virar sprites separados, com ordem de profundidade | Baixo: o jogo já funciona assim |

**Decidido: vista 3/4.** A colisão continua sendo o retângulo do chão; o sprite só é mais alto que ele.

### 2. Tamanho do soldado
| Tamanho | Bom para | Problema |
| --- | --- | --- |
| 16×24 | Exércitos grandes, leitura de longe | Pouco detalhe de equipamento |
| 24×32 | Personalidade | Pesa no zoom aberto e dobra o trabalho |
| 32×48 | Personagens | Inviável com 100 soldados por batalhão |

**Recomendação: 16×24 a pé e 24×24 a cavalo.** O tamanho combina com o corpo atual e com batalhões grandes.

Com três níveis de detalhe por zoom:
- **100% ou mais:** sprite animado.
- **50%:** mini-sprite de 8×12, com 2 quadros.
- **25%:** estandarte e bloco na cor da tropa, que resolve o problema de os soldados virarem pontos.

### 3. De onde vem a arte
| Origem | A favor | Contra |
| --- | --- | --- |
| Pacotes prontos | Rápido e barato | Estilos desencontrados; 55 tipos de inimigo não vão existir prontos; checar a licença |
| Artista contratado | Coerência e identidade | É o caminho mais caro |
| Gerada por IA e limpa à mão | Rápido para explorar | Grade de pixels irregular, estilo inconsistente, direitos a verificar |
| Gerada por código | Sem custo, coerente, já funciona agora | Resultado simples: serve de base, não de arte final |

**Recomendação: começar por código** para fechar motor e tamanho, e decidir a arte final com a prova na tela. Os arquivos têm o mesmo formato, então trocar a origem depois não muda o motor.

## Quanta arte é (estimativa)
- **Corpos:** 8 bases (humano a pé, a cavalo, goblin, orc, esqueleto, lobo, carroça, aríete).
- **Animação:** parado, andar, atacar e morrer, cerca de 12 quadros em 3 direções: perto de 290 quadros.
- **Equipamento:** lança, espada, arco, besta, escudo e elmo em camadas sobre o corpo. Assim os 64 tipos de tropa saem de combinações, sem 64 desenhos.
- **Cores:** cor de cada reino por troca de paleta.
- **Terreno:** 11 biomas com 4 a 8 variações cada, mais água, costa, estradas e pontes.
- **Construções:** cerca de 40, mais variações de telhado e cor para as 4 culturas.
- **Outros:** 2 navios para o convés, interiores, retratos e ícones.

**Chão:** autotile completo entre 11 biomas seria caro. Proposta: variações de ladrilho, transição pontilhada entre biomas, enfeites espalhados e autotile só na água. Tudo pintado nos pedaços que já existem.

**Fonte:** precisa ter acentos do português. Conferir antes de escolher.

## Etapas
1. **G0, prova:** uma batalha na grama, com 2 tropas, em 16×24 e 24×32, nos três níveis de zoom. Decide perspectiva e tamanho vendo na tela. Sem isso não vale produzir mais nada.
2. **G1, motor de sprites:** atlas, soldado como sprite, direções, animação pelo estado, ordem de profundidade e níveis de detalhe. Medir 1600 soldados. Daqui saem os batalhões grandes.
3. **G2, chão:** biomas, rios, costa, estradas e estações.
4. **G3, construções:** povoados, muralhas e acampamento como sprites, com as 4 culturas. É a etapa mais trabalhosa.
5. **G4, resto do elenco:** monstros, navios, convés, interiores e a Cidade Alta.
6. **G5, interface:** fonte, molduras, ícones e retratos.
7. **G6, atmosfera:** noite, clima e efeitos.

Cada etapa deixa o jogo inteiro funcionando, com o que falta ainda em greybox.
