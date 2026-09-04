## ADDED Requirements

### Requirement: Feed da campanha
O sistema SHALL manter um feed cronológico de eventos por campanha, sem chat livre, registrando quem originou cada evento e quando.

#### Scenario: Registro de evento
- **WHEN** uma capability da campanha produz um evento (rolagem, alteração de HP, início ou fim de combate)
- **THEN** o evento é persistido no feed daquela campanha com autor e horário

#### Scenario: Leitura do feed
- **WHEN** um membro abre a campanha
- **THEN** ele recebe os eventos recentes do feed que tem permissão de ver, em ordem cronológica

### Requirement: Canal em tempo real por campanha
O sistema SHALL propagar novos eventos aos membros conectados àquela campanha, sem que precisem recarregar a página.

#### Scenario: Propagação de evento
- **WHEN** um evento é registrado no feed de uma campanha
- **THEN** ele é entregue em tempo real aos membros conectados àquela campanha

#### Scenario: Membro não conectado
- **WHEN** um membro abre a campanha depois de o evento ter ocorrido
- **THEN** ele vê o evento na leitura inicial do feed

### Requirement: Autorização do canal no servidor
O sistema SHALL validar sessão e participação na campanha antes de aceitar uma conexão no canal, e SHALL recusar conexões de quem não é membro.

#### Scenario: Conexão de membro
- **WHEN** um membro autenticado conecta ao canal de uma campanha da qual participa
- **THEN** a conexão é aceita e ele passa a receber os eventos daquela campanha

#### Scenario: Conexão de não-membro
- **WHEN** um usuário que não é membro tenta conectar ao canal da campanha
- **THEN** o sistema recusa a conexão e nenhum evento é entregue

#### Scenario: Isolamento entre campanhas
- **WHEN** um evento é registrado em uma campanha
- **THEN** ele não é entregue a conexões de outras campanhas

### Requirement: Filtragem de eventos secretos
O sistema SHALL decidir no servidor quais eventos cada destinatário recebe, e SHALL nunca enviar o conteúdo de um evento secreto a quem não é o mestre.

#### Scenario: Evento secreto
- **WHEN** um evento marcado como secreto é registrado
- **THEN** ele é entregue apenas ao mestre e não aparece, em nenhuma forma, no que é enviado aos jogadores

### Requirement: Recuperação após queda de conexão
O sistema SHALL permitir que um cliente reconecte e obtenha o estado atual do feed sem depender de eventos perdidos.

#### Scenario: Reconexão
- **WHEN** um cliente perde a conexão e reconecta
- **THEN** ele recarrega o feed a partir do servidor e volta a receber eventos novos, sem lacunas visíveis para o usuário
