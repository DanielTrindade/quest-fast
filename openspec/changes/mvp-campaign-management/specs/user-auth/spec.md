## ADDED Requirements

### Requirement: Login via Discord
O sistema SHALL autenticar usuários exclusivamente pelo fluxo OAuth do Discord, criando a conta no primeiro acesso.

#### Scenario: Primeiro acesso
- **WHEN** um visitante autoriza o aplicativo no Discord e retorna ao callback
- **THEN** o sistema cria a conta a partir do perfil do Discord, inicia a sessão e redireciona para a listagem de campanhas

#### Scenario: Acesso subsequente
- **WHEN** um usuário já cadastrado autoriza o aplicativo no Discord
- **THEN** o sistema reconhece a conta existente pelo identificador do Discord e inicia a sessão sem duplicar o usuário

#### Scenario: Autorização recusada
- **WHEN** o usuário recusa a autorização no Discord ou o callback retorna erro
- **THEN** o sistema exibe uma mensagem de falha de login e nenhuma sessão é criada

### Requirement: Perfil derivado do Discord
O sistema SHALL usar nome de exibição e avatar do Discord como perfil do usuário, atualizando-os a cada login.

#### Scenario: Exibição do perfil
- **WHEN** um usuário autenticado aparece para outros membros de uma campanha
- **THEN** ele é exibido com o nome e o avatar vindos do Discord

#### Scenario: Perfil alterado no Discord
- **WHEN** um usuário altera nome ou avatar no Discord e faz login novamente
- **THEN** o sistema atualiza os dados locais com os valores mais recentes

### Requirement: Sessão persistente
O sistema SHALL manter a sessão do usuário em cookie ao longo de visitas no mesmo navegador.

#### Scenario: Reabrir o aplicativo
- **WHEN** um usuário autenticado reabre o aplicativo no mesmo navegador antes da expiração da sessão
- **THEN** ele permanece autenticado sem repetir o fluxo do Discord

### Requirement: Logout
O sistema SHALL permitir encerrar a sessão.

#### Scenario: Encerramento da sessão
- **WHEN** um usuário autenticado aciona logout
- **THEN** a sessão é invalidada no servidor, o cookie é removido e o usuário retorna à tela de login

### Requirement: Proteção de rotas
O sistema SHALL recusar acesso a qualquer rota de dados sem sessão válida.

#### Scenario: Requisição sem sessão
- **WHEN** uma requisição sem sessão válida atinge uma rota de dados
- **THEN** o sistema responde com erro de não autenticado e não expõe nenhum dado
