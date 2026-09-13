## ADDED Requirements

### Requirement: Modos em rolagens linkadas
O sistema SHALL aceitar rolagens linkadas à ficha com modo normal, vantagem ou desvantagem, mantendo o servidor como única fonte do resultado.

#### Scenario: Ataque com vantagem
- **WHEN** o dono dispara um ataque com vantagem a partir da ficha
- **THEN** o servidor lança dois d20, considera o maior, aplica o bônus do ataque e publica o resultado no feed

#### Scenario: Teste de habilidade com desvantagem
- **WHEN** o dono dispara um teste de habilidade com desvantagem a partir da ficha
- **THEN** o servidor lança dois d20, considera o menor, aplica o modificador e publica o resultado no feed

#### Scenario: Modo inválido para rolagem linkada
- **WHEN** uma rolagem linkada solicita vantagem ou desvantagem para uma rolagem que não é um d20
- **THEN** o sistema recusa a rolagem com mensagem de erro e nada é publicado no feed