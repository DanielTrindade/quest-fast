## ADDED Requirements

### Requirement: Resumo com HP e CA
O sistema SHALL incluir o HP e a CA atuais de cada personagem no resumo da lista de personagens da campanha.

#### Scenario: Lista com vida e armadura
- **WHEN** um membro abre a lista de personagens da campanha
- **THEN** cada linha do resumo exibe o HP e a CA atuais do personagem, sem precisar abrir a ficha

#### Scenario: Resumo de terceiros
- **WHEN** o resumo é exibido a outro membro que não o dono
- **THEN** HP e CA continuam visíveis, pois são informação pública da mesa

### Requirement: Perícia rolável pela ficha
O sistema SHALL permitir que o dono de um personagem role um teste de perícia a partir da ficha, aplicando o modificador do atributo da perícia e o bônus de proficiência quando a perícia for treinada.

#### Scenario: Teste de perícia treinada
- **WHEN** o dono dispara uma perícia treinada a partir da ficha
- **THEN** o servidor soma o modificador do atributo e o bônus de proficiência do nível, publica o resultado no feed e identifica o personagem e a perícia

#### Scenario: Teste de perícia não treinada
- **WHEN** o dono dispara uma perícia não treinada a partir da ficha
- **THEN** o servidor aplica apenas o modificador do atributo da perícia

#### Scenario: Perícia por outro membro
- **WHEN** outro membro, incluindo o mestre, tenta disparar uma perícia a partir da ficha de um personagem
- **THEN** a ficha se apresenta em consulta e não oferece a ação de rolar a perícia