## ADDED Requirements

### Requirement: Criar cena com mapa
O sistema SHALL permitir que apenas o mestre crie uma cena da campanha com nome e imagem de mapa, exibida como canvas para os membros.

#### Scenario: Criação da cena
- **WHEN** o mestre cria uma cena com nome e envia uma imagem de mapa dentro dos limites aceitos
- **THEN** a cena é criada, o mapa é armazenado como asset da campanha e a cena fica disponível para os membros

#### Scenario: Criação tentada por jogador
- **WHEN** um jogador tenta criar, editar ou excluir uma cena
- **THEN** o sistema recusa a operação

### Requirement: Cena ativa da campanha
O sistema SHALL permitir que o mestre defina qual cena está ativa, e SHALL exibir aos jogadores apenas a cena ativa.

#### Scenario: Troca de cena
- **WHEN** o mestre define outra cena como ativa
- **THEN** os jogadores conectados passam a ver a nova cena

#### Scenario: Cena inativa
- **WHEN** um jogador requisita uma cena que não é a ativa
- **THEN** o sistema recusa a operação

### Requirement: Grid configurável
O sistema SHALL permitir que o mestre ative o grid e defina o tamanho da célula como referência visual de posicionamento.

#### Scenario: Configuração do grid
- **WHEN** o mestre ativa o grid e define o tamanho da célula
- **THEN** o grid é sobreposto ao mapa para todos os membros que veem a cena

### Requirement: Adicionar e remover tokens
O sistema SHALL permitir que apenas o mestre adicione e remova tokens na cena, a partir dos personagens da campanha ou dos statblocks do bestiário.

#### Scenario: Adicionar token
- **WHEN** o mestre adiciona um token a partir de um personagem da campanha ou de um statblock
- **THEN** o token aparece sobre o mapa na posição escolhida

#### Scenario: Adição tentada por jogador
- **WHEN** um jogador tenta adicionar ou remover um token
- **THEN** o sistema recusa a operação

### Requirement: Movimentação por posse
O sistema SHALL permitir que o mestre mova qualquer token e que um jogador mova apenas o token vinculado ao seu próprio personagem, validando a posse no servidor a cada movimento.

#### Scenario: Movimento pelo dono
- **WHEN** um jogador move o token vinculado ao seu personagem
- **THEN** a nova posição é persistida e propagada aos demais membros que veem a cena

#### Scenario: Movimento de token alheio
- **WHEN** um jogador tenta mover um token que não é o do seu personagem
- **THEN** o sistema recusa a operação e a posição do token permanece inalterada

### Requirement: Fog of war manual
O sistema SHALL permitir que apenas o mestre revele e volte a ocultar áreas do mapa, exibindo aos jogadores apenas as áreas reveladas.

#### Scenario: Revelar área
- **WHEN** o mestre revela uma área do mapa
- **THEN** os jogadores conectados passam a enxergar aquela área

#### Scenario: Reocultar área
- **WHEN** o mestre volta a ocultar uma área previamente revelada
- **THEN** os jogadores deixam de enxergar aquela área

#### Scenario: Controle restrito ao mestre
- **WHEN** um jogador tenta revelar ou ocultar qualquer área
- **THEN** o sistema recusa a operação

### Requirement: Tokens ocultos não são enviados aos jogadores
O sistema SHALL omitir do payload enviado aos jogadores os tokens marcados como ocultos, de modo que sua existência e posição não sejam obteníveis pelo cliente.

#### Scenario: Token oculto pelo mestre
- **WHEN** o mestre marca um token como oculto
- **THEN** nenhum dado desse token é incluído no que é enviado aos clientes dos jogadores

#### Scenario: Revelação do token
- **WHEN** o mestre deixa de marcar o token como oculto
- **THEN** o token passa a ser enviado aos jogadores e aparece sobre o mapa

### Requirement: Sincronização em tempo real
O sistema SHALL propagar alterações de tokens, grid e fog of war pelo canal em tempo real da campanha, aos membros que veem a cena.

#### Scenario: Propagação de alteração
- **WHEN** o mestre ou um jogador altera a posição de um token, o grid ou o fog of war
- **THEN** a alteração é propagada em tempo real aos membros conectados que veem a cena

#### Scenario: Reconexão
- **WHEN** um membro perde a conexão e reconecta
- **THEN** ele recarrega o estado atual da cena — tokens visíveis, grid e fog — a partir do servidor
