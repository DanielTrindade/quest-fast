## ADDED Requirements

### Requirement: Acompanhamento ao vivo do feed
O sistema SHALL manter o feed acompanhando os eventos novos em tempo real quando o usuário está no fim do histórico, e SHALL sinalizar eventos novos quando o usuário está lendo o passado.

#### Scenario: Seguir o fim do feed
- **WHEN** o usuário está no fim do feed e um evento novo chega
- **THEN** o feed avança automaticamente e mostra o evento novo no fim

#### Scenario: Leitura do passado com eventos novos
- **WHEN** o usuário rola para cima para ler eventos antigos e eventos novos chegam
- **THEN** uma indicação visível informa a quantidade de novos resultados e, ao acioná-la, o usuário retorna ao fim do feed

#### Scenario: Altura controlada no desktop
- **WHEN** o feed é exibido em uma largura de desktop
- **THEN** o histórico ocupa uma altura controlada com rolagem própria, sem crescer a página indefinidamente

### Requirement: Histórico paginado
O sistema SHALL permitir carregar eventos mais antigos do que os exibidos, em ordem cronológica, sem depender de socket.

#### Scenario: Carregar mais eventos antigos
- **WHEN** o usuário solicita mais eventos no feed
- **THEN** o sistema devolve os eventos anteriores ao cursor informado e o feed os insere no início do histórico

#### Scenario: Fim do histórico
- **WHEN** o usuário solicita mais eventos e não há eventos mais antigos
- **THEN** o sistema indica que o histórico terminou e não oferece mais a ação de carregar

### Requirement: Renderização por tipo de evento
O sistema SHALL renderizar cada evento do feed conforme o seu tipo, e SHALL exibir uma apresentação genérica para tipos de evento que o cliente ainda não conhece.

#### Scenario: Evento de rolagem
- **WHEN** um evento do tipo rolagem é exibido no feed
- **THEN** ele usa a apresentação de dado (total, decomposição, modo, natural, segredo)

#### Scenario: Tipo de evento desconhecido
- **WHEN** um evento de um tipo que o cliente ainda não renderiza é exibido no feed
- **THEN** ele aparece com autor, horário e a identificação do tipo, sem quebrar o feed nem silenciar a informação

#### Scenario: Secreto preservado
- **WHEN** um evento secreto é exibido ao mestre
- **THEN** a apresentação genérica preserva a linguagem de conteúdo secreto do sistema