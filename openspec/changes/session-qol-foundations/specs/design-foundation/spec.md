## ADDED Requirements

### Requirement: Atalhos de rolagem
O sistema SHALL oferecer atalhos de rolagem para os dados comuns (d4, d6, d8, d10, d12, d20 e d100) e a repetição da última rolagem, mantendo o resultado calculado no servidor.

#### Scenario: Atalho preenche a expressão
- **WHEN** o usuário aciona um atalho de dado
- **THEN** a expressão do rolador é preenchida com o atalho (ex.: `1d20`) e fica pronta para edição

#### Scenario: Repetir última rolagem
- **WHEN** o usuário aciona repetir a última rolagem
- **THEN** a expressão da última rolagem válida é restaurada no rolador

#### Scenario: Atalho com modo restrito
- **WHEN** o usuário escolhe vantagem ou desvantagem e aciona um atalho que não é um d20
- **THEN** o rolador informa que o modo vale apenas para um d20 e não envia a rolagem

### Requirement: Formulário de ficha reutilizável
O sistema SHALL fornecer o formulário de ficha como componente isolado, com validação por campo, que sirva tanto para criação quanto para edição.

#### Scenario: Erro junto ao campo
- **WHEN** o usuário submete uma ficha com um valor inválido (ex.: nível fora de 1–20)
- **THEN** a mensagem de erro aparece junto ao campo correspondente, sem exigir ida ao rodapé

#### Scenario: Reutilização
- **WHEN** o formulário de ficha é usado em criação ou em edição
- **THEN** ele é o mesmo componente, com os mesmos estados de validação e de envio

### Requirement: Navegação com seção ativa
O sistema SHALL destacar na navegação da campanha a seção visível no momento, tanto no menu desktop quanto no recolhível mobile.

#### Scenario: Seção atual destacada
- **WHEN** o usuário rola a página da campanha
- **THEN** o item da navegação correspondente à seção visível fica marcado como ativo

#### Scenario: Navegação por âncora preservada
- **WHEN** o usuário aciona um item da navegação
- **THEN** a página rola até a seção correspondente e o item passa a ser o ativo