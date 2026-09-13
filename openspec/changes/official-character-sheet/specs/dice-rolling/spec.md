## ADDED Requirements

### Requirement: Iniciativa rolada pela ficha
O sistema SHALL permitir que o dono role a iniciativa a partir da ficha, somando ao d20 a iniciativa derivada do personagem, com modo normal, vantagem ou desvantagem, e publicando o resultado no feed.

#### Scenario: Iniciativa com vantagem
- **WHEN** o dono rola iniciativa com vantagem para um personagem com iniciativa +2
- **THEN** o servidor lança dois d20, considera o maior, soma 2 e publica o resultado identificando o personagem e a iniciativa

#### Scenario: Iniciativa por outro membro
- **WHEN** outro membro, incluindo o mestre, tenta rolar a iniciativa de um personagem
- **THEN** o sistema recusa a rolagem e nada é publicado no feed

### Requirement: Ataque mágico rolado pela ficha
O sistema SHALL permitir que o dono role um ataque mágico a partir da ficha, somando ao d20 o modificador de ataque mágico derivado, apenas para personagens com atributo de conjuração.

#### Scenario: Ataque mágico
- **WHEN** o dono rola um ataque mágico para um personagem com ataque mágico +5
- **THEN** o servidor soma 5 ao d20 e publica o resultado identificando o personagem e o ataque mágico

#### Scenario: Personagem sem conjuração
- **WHEN** o dono tenta rolar um ataque mágico para um personagem sem atributo de conjuração
- **THEN** o sistema recusa a rolagem com mensagem de erro e nada é publicado no feed

### Requirement: Especialização aplicada à rolagem de perícia
O sistema SHALL somar duas vezes o bônus de proficiência ao rolar uma perícia em que o personagem é especialista.

#### Scenario: Perícia especialista rolada
- **WHEN** o dono rola Furtividade para um personagem de nível 3 com Destreza 18 especialista em Furtividade
- **THEN** o servidor rola 1d20+8 e publica o resultado no feed
