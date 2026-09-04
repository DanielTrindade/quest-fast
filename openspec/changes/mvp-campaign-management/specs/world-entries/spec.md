## ADDED Requirements

### Requirement: Criar entrada do mundo
O sistema SHALL permitir que apenas o mestre crie entradas dos tipos NPC, Local, Quest e Diário de sessão, com descrição em markdown e visibilidade pública ou privada.

#### Scenario: Criação pelo mestre
- **WHEN** o mestre cria uma entrada escolhendo tipo, título, descrição em markdown e visibilidade
- **THEN** a entrada é salva na campanha com a visibilidade escolhida

#### Scenario: Criação tentada por jogador
- **WHEN** um jogador tenta criar uma entrada do mundo
- **THEN** o sistema recusa a operação

### Requirement: Visibilidade público/privado
O sistema SHALL aplicar o filtro de visibilidade no servidor: entradas públicas são legíveis por todos os membros e entradas privadas apenas pelo mestre.

#### Scenario: Entrada pública
- **WHEN** uma entrada marcada como pública existe na campanha
- **THEN** todos os membros da campanha podem lê-la

#### Scenario: Entrada privada na listagem
- **WHEN** um jogador lista as entradas da campanha
- **THEN** as entradas privadas não são incluídas na resposta enviada ao cliente

#### Scenario: Acesso direto a entrada privada
- **WHEN** um jogador requisita diretamente uma entrada privada pelo seu identificador
- **THEN** o sistema recusa a operação e não expõe nenhum conteúdo da entrada

### Requirement: Editar e excluir
O sistema SHALL permitir que apenas o mestre edite ou exclua entradas do mundo.

#### Scenario: Alteração pelo mestre
- **WHEN** o mestre edita ou exclui uma entrada
- **THEN** a alteração passa a valer para todos os membros conforme a visibilidade da entrada

### Requirement: Status de quest
O sistema SHALL manter um status (ativa, concluída, falha) nas entradas do tipo Quest, atualizável pelo mestre.

#### Scenario: Atualização de status
- **WHEN** o mestre altera o status de uma entrada do tipo Quest
- **THEN** o novo status é exibido na listagem e no detalhe da quest

### Requirement: Diário de sessão
O sistema SHALL listar entradas do tipo Diário em ordem cronológica pela data da sessão.

#### Scenario: Criação de diário
- **WHEN** o mestre cria uma entrada do tipo Diário com data da sessão e resumo
- **THEN** ela é listada cronologicamente pela data da sessão e segue a regra de visibilidade das demais entradas

### Requirement: Renderização segura de markdown
O sistema SHALL renderizar o markdown das entradas sem permitir execução de conteúdo ativo.

#### Scenario: Conteúdo com HTML malicioso
- **WHEN** uma entrada contém markdown com HTML ou script embutido
- **THEN** o conteúdo é sanitizado na renderização e nenhum script é executado
