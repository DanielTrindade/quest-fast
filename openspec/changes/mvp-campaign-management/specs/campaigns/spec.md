## ADDED Requirements

### Requirement: Criar campanha
O sistema SHALL permitir que um usuário autenticado crie uma campanha com nome e descrição, tornando o criador o seu mestre.

#### Scenario: Criação com sucesso
- **WHEN** um usuário autenticado cria uma campanha com nome e descrição
- **THEN** a campanha é criada e o criador passa a ser membro com papel `mestre`

### Requirement: Código de convite
O sistema SHALL gerar um código de convite único para cada campanha criada, visível apenas ao mestre.

#### Scenario: Geração do código
- **WHEN** uma campanha é criada
- **THEN** ela recebe um código de convite único, exibido ao mestre para compartilhamento

#### Scenario: Código oculto para jogador
- **WHEN** um jogador membro abre a página da campanha
- **THEN** o código de convite não é exibido nem retornado pela API

### Requirement: Entrar na campanha
O sistema SHALL permitir que um usuário autenticado entre em uma campanha por meio do código de convite.

#### Scenario: Entrada válida
- **WHEN** um usuário autenticado informa um código de convite válido
- **THEN** ele entra como membro com papel `jogador` e passa a ver o conteúdo público da campanha

#### Scenario: Código inválido
- **WHEN** o código informado não corresponde a nenhuma campanha
- **THEN** o sistema exibe um erro e não altera a participação do usuário

#### Scenario: Usuário já é membro
- **WHEN** um usuário que já é membro informa o código da mesma campanha
- **THEN** o sistema não cria uma participação duplicada e o leva para a campanha

### Requirement: Listar campanhas do usuário
O sistema SHALL listar as campanhas das quais o usuário autenticado é membro, indicando o seu papel em cada uma.

#### Scenario: Listagem
- **WHEN** um usuário autenticado abre a tela inicial
- **THEN** ele vê apenas as campanhas das quais é membro, cada uma com o seu papel

### Requirement: Listar membros
O sistema SHALL exibir aos membros da campanha a lista de participantes com nome, papel e data de entrada.

#### Scenario: Visualização da lista
- **WHEN** um membro abre a página de membros da campanha
- **THEN** ele vê nome, papel (mestre/jogador) e data de entrada de cada membro

### Requirement: Sair da campanha
O sistema SHALL permitir que um jogador saia de uma campanha, e SHALL impedir que o mestre saia da sua própria campanha.

#### Scenario: Saída do jogador
- **WHEN** um jogador membro sai de uma campanha
- **THEN** ele é removido dos membros e perde o acesso ao conteúdo da campanha

#### Scenario: Mestre tenta sair
- **WHEN** o mestre tenta sair da própria campanha
- **THEN** o sistema recusa a operação, para que a campanha não fique sem mestre

### Requirement: Remover membro
O sistema SHALL permitir que apenas o mestre remova um jogador da campanha.

#### Scenario: Remoção pelo mestre
- **WHEN** o mestre remove um jogador da campanha
- **THEN** o jogador é removido dos membros e perde o acesso ao conteúdo da campanha

#### Scenario: Remoção tentada por jogador
- **WHEN** um jogador tenta remover outro membro
- **THEN** o sistema recusa a operação

### Requirement: Isolamento entre campanhas
O sistema SHALL recusar, no servidor, qualquer leitura ou escrita de conteúdo de uma campanha por quem não é seu membro.

#### Scenario: Acesso por não-membro
- **WHEN** um usuário autenticado que não é membro requisita conteúdo de uma campanha
- **THEN** o sistema recusa a operação e não expõe nenhum dado da campanha
