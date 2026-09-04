## ADDED Requirements

### Requirement: Rolagem calculada no servidor
O sistema SHALL calcular todo resultado de rolagem no servidor, e SHALL ignorar qualquer resultado enviado pelo cliente.

#### Scenario: Resultado autoritativo
- **WHEN** um membro solicita uma rolagem
- **THEN** o servidor sorteia os dados, calcula o total e devolve o resultado ao cliente, que apenas o exibe

### Requirement: Rolagem livre
O sistema SHALL interpretar expressões no formato `NdM` com modificador opcional, publicando o resultado no feed da campanha.

#### Scenario: Rolagem com modificador
- **WHEN** um membro rola uma expressão como `1d20+5` ou `2d6+3`
- **THEN** o sistema exibe os dados individuais, o modificador e o total, e publica o evento no feed da campanha

#### Scenario: Expressão inválida
- **WHEN** um membro envia uma expressão que não pode ser interpretada
- **THEN** o sistema recusa a rolagem com uma mensagem de erro e nada é publicado no feed

### Requirement: Vantagem e desvantagem
O sistema SHALL suportar rolagem de d20 com vantagem (maior de dois) e desvantagem (menor de dois), exibindo os dois dados.

#### Scenario: Rolagem com vantagem
- **WHEN** um membro rola um d20 com vantagem
- **THEN** o sistema lança dois d20, exibe ambos os resultados e considera o maior

#### Scenario: Rolagem com desvantagem
- **WHEN** um membro rola um d20 com desvantagem
- **THEN** o sistema lança dois d20, exibe ambos os resultados e considera o menor

### Requirement: Rolagem linkada à ficha
O sistema SHALL usar os modificadores salvos na ficha em rolagens de ataque, teste de habilidade e saving throw disparadas a partir dela.

#### Scenario: Rolagem a partir da ficha
- **WHEN** o dono de um personagem dispara um ataque, um teste de habilidade ou um saving throw a partir da ficha
- **THEN** o sistema aplica automaticamente o modificador correspondente e publica o resultado no feed identificando o personagem

#### Scenario: Ficha alterada
- **WHEN** o dono altera um atributo e dispara a mesma rolagem novamente
- **THEN** o sistema usa o modificador atualizado

### Requirement: Rolagem secreta do mestre
O sistema SHALL permitir que o mestre marque uma rolagem como secreta, mantendo o resultado invisível para os jogadores.

#### Scenario: Rolagem secreta
- **WHEN** o mestre rola dados marcando a opção "secreta"
- **THEN** o evento é registrado como secreto e o resultado é entregue apenas ao mestre

#### Scenario: Jogador não vê rastro
- **WHEN** um jogador carrega o feed durante uma sessão com rolagens secretas
- **THEN** nada indicativo dessas rolagens é entregue ao cliente do jogador
