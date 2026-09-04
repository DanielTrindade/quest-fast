## ADDED Requirements

### Requirement: Bestiário da campanha
O sistema SHALL permitir que o mestre salve statblocks reutilizáveis na campanha, com nome, HP, AC e ataques, para não redigitá-los a cada encontro.

#### Scenario: Criação de statblock
- **WHEN** o mestre cria um statblock com nome, HP, AC e ataques
- **THEN** ele é salvo no bestiário da campanha e fica disponível para encontros futuros

#### Scenario: Bestiário restrito ao mestre
- **WHEN** um jogador tenta criar, editar, excluir ou listar o bestiário da campanha
- **THEN** o sistema recusa a operação

### Requirement: Criar encontro
O sistema SHALL permitir que apenas o mestre crie um encontro na campanha.

#### Scenario: Início de encontro
- **WHEN** o mestre cria um encontro na campanha
- **THEN** o encontro é criado no round 1, sem combatentes, e o início é registrado no feed da sessão

### Requirement: Adicionar combatentes
O sistema SHALL permitir que o mestre adicione combatentes a partir dos personagens da campanha, de um statblock do bestiário ou manualmente.

#### Scenario: Combatente a partir de personagem
- **WHEN** o mestre adiciona um personagem da campanha ao encontro
- **THEN** o combatente é criado com os valores de HP e AC da ficha e permanece vinculado ao personagem

#### Scenario: Combatente a partir do bestiário
- **WHEN** o mestre adiciona um statblock salvo ao encontro
- **THEN** o combatente é criado com os valores do statblock, e alterações no combatente não modificam o statblock original

#### Scenario: Combatente manual
- **WHEN** o mestre adiciona um combatente informando nome, HP, AC e iniciativa
- **THEN** o combatente é criado apenas para aquele encontro

### Requirement: Ordem de iniciativa
O sistema SHALL ordenar os combatentes da maior para a menor iniciativa.

#### Scenario: Ordenação da fila
- **WHEN** o mestre atribui ou rola a iniciativa dos combatentes
- **THEN** os combatentes são ordenados da maior para a menor iniciativa

### Requirement: Avançar turno
O sistema SHALL permitir que apenas o mestre avance o turno, passando ao próximo combatente da ordem e iniciando novo round ao fim da fila.

#### Scenario: Próximo turno
- **WHEN** o mestre aciona "próximo turno"
- **THEN** o combate avança para o próximo combatente da ordem e o combatente ativo é destacado para todos os membros

#### Scenario: Novo round
- **WHEN** a fila de combatentes termina
- **THEN** o combate volta ao primeiro combatente e o contador de round é incrementado

#### Scenario: Jogador tenta avançar
- **WHEN** um jogador tenta avançar o turno
- **THEN** o sistema recusa a operação

### Requirement: Controle de HP
O sistema SHALL permitir que o mestre ajuste o HP de qualquer combatente e que um jogador ajuste apenas o do seu próprio personagem, registrando a alteração no feed.

#### Scenario: Ajuste pelo mestre
- **WHEN** o mestre ajusta o HP de qualquer combatente
- **THEN** o novo valor é propagado aos membros conectados e a alteração é registrada no feed

#### Scenario: Ajuste pelo jogador
- **WHEN** um jogador ajusta o HP do combatente vinculado ao seu próprio personagem
- **THEN** o valor é atualizado, propagado e registrado no feed

#### Scenario: Ajuste em combatente alheio
- **WHEN** um jogador tenta ajustar o HP de um combatente que não é o seu personagem
- **THEN** o sistema recusa a operação

### Requirement: Condições
O sistema SHALL permitir que apenas o mestre aplique e remova condições nos combatentes, exibindo-as no tracker para todos os membros.

#### Scenario: Aplicar condição
- **WHEN** o mestre aplica ou remove uma condição em um combatente
- **THEN** a condição passa a ser exibida junto ao combatente para todos os membros

### Requirement: Encerrar encontro
O sistema SHALL permitir que o mestre encerre o encontro, preservando o registro do encontro encerrado.

#### Scenario: Fim de combate
- **WHEN** o mestre encerra o encontro
- **THEN** o encontro é marcado como encerrado, deixa de ser o encontro ativo da campanha e o fim é registrado no feed

### Requirement: Estado do combate em tempo real
O sistema SHALL propagar alterações do encontro aos membros conectados à campanha.

#### Scenario: Propagação
- **WHEN** iniciativa, turno, HP, condições ou o conjunto de combatentes mudam
- **THEN** o estado atualizado é propagado em tempo real aos membros conectados
