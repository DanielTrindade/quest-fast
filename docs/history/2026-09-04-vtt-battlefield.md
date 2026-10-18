# vtt-battlefield

> Registro histórico, escrito originalmente como change do OpenSpec (criado em 2026-09-04).
> Status em 2026-10-18: não iniciado. O estado atual do produto está em
> [`../roadmap.md`](../roadmap.md) e a arquitetura em [`../architecture.md`](../architecture.md).

## Resumo

Campo de batalha dentro do `quest-fast`: cenas com mapa, grid, tokens e fog of war em tempo real. Substitui o Owlbear Rodeo no fluxo da mesa.

**Depende de `mvp-campaign-management` estar aplicado e em uso real.** Este change reutiliza o canal em tempo real (`session-feed`), a abstração `Asset` e o RBAC por `CampaignMember` entregues no MVP.

### Why

O destino do produto é a mesa inteira em um lugar só, e hoje a mesa sai da plataforma para olhar o mapa. Este change foi separado do MVP porque concentra o maior risco técnico e a maior parcela do esforço — tirá-lo de lá permitiu entregar uma sessão jogável antes.

### Capabilities

#### New Capabilities

- `battlefield`: cenas com mapa e grid, tokens com posse por papel, fog of war manual e sincronização em tempo real.

#### Modified Capabilities

Nenhuma.

### Atenção antes de implementar

O `tasks.md` começa com um **spike descartável**. Três decisões continuam abertas de propósito — representação do fog, protocolo de movimento e biblioteca de canvas — e devem ser fechadas por medição, não por argumento. Não escreva código de produção antes do grupo 1 terminar.

## Proposta

### Why

O destino do `quest-fast` é substituir também o Owlbear Rodeo: hoje a mesa sai da plataforma para olhar o mapa. Este change traz o campo de batalha para dentro — cena com mapa, grid, tokens e fog of war em tempo real.

Ele foi deliberadamente separado do `mvp-campaign-management` porque concentra o maior risco técnico e a maior parcela do esforço do produto. Tirá-lo do MVP permitiu entregar uma sessão jogável antes; ele só começa depois que `mvp-campaign-management` estiver em uso real.

### What Changes

- Adiciona cenas de campanha com imagem de mapa e grid configurável.
- Adiciona tokens de personagem e de statblock, com movimentação sincronizada e regra de posse.
- Adiciona fog of war manual controlado pelo mestre.
- Reutiliza, sem alterar, o canal em tempo real e a abstração de assets entregues no MVP: os eventos `token.moved` e `fog.updated` passam pelo mesmo canal por campanha do `session-feed`, e mapas são armazenados como `Asset`.
- Substitui o Owlbear Rodeo no fluxo da mesa.

### Capabilities

#### New Capabilities

- `battlefield`: cenas com mapa e grid, tokens com posse por papel, fog of war manual e sincronização em tempo real.

#### Modified Capabilities

Nenhuma. O canal em tempo real do `session-feed` foi projetado no MVP para receber novos tipos de evento sem mudança de requisito.

### Non-Goals

- Iluminação dinâmica, visão por token, paredes e linha de visão.
- Medição de distância, réguas, formas de área e templates de magia.
- Fog of war automático derivado de paredes ou de movimento.
- Camadas de mapa, mapas em múltiplos andares e importação de formatos de outras VTTs.
- Áudio, cenas com música e efeitos visuais.

### Impact

- `client/`: nova superfície de canvas, a parte mais pesada da interface até aqui.
- `server/`: novos tipos de evento no canal WebSocket existente; nenhuma nova infraestrutura.
- `db/`: tabelas `Scene`, `Token` e o armazenamento do estado de fog.
- Uploads passam a lidar com imagens grandes; os limites de tamanho definidos no MVP para avatares precisam ser revistos para mapas.
- Depende de `mvp-campaign-management` estar aplicado: `Campaign`, `CampaignMember`, `Character`, `Statblock`, `Asset` e o canal em tempo real.

## Design

### Context

Change posterior a `mvp-campaign-management`, que já entregou as três costuras de que este depende: o canal WebSocket por campanha (`session-feed`), a abstração `Asset` para imagens e o RBAC por `CampaignMember`.

Este é o item de maior risco técnico do produto e o motivo de ter sido adiado. As decisões abaixo cobrem o que já está determinado pelo MVP; as escolhas genuinamente abertas estão em **Open Questions** e devem ser fechadas por um spike antes de a implementação começar — não por dedução no papel.

### Goals / Non-Goals

**Goals:**

- Substituir o Owlbear Rodeo no fluxo da mesa para o caso de uso comum: mapa, grid, tokens e fog manual.
- Reaproveitar o canal em tempo real existente sem alterar seus requisitos.
- Manter a autoridade no servidor, inclusive para o que o jogador pode ver do mapa.

**Non-Goals:**

- Iluminação dinâmica, paredes, linha de visão e visão por token.
- Medição, templates de área e automação de magias.
- Fog automático derivado de movimento ou de geometria.
- Camadas, múltiplos andares e importação de outras VTTs.

### Decisions

#### 1. Reutilizar o canal do `session-feed`

`token.moved` e `fog.updated` entram como novos tipos de evento no canal por campanha que já existe. Sem segundo socket, sem segundo servidor, sem novo modelo de autorização — a validação de papel no handshake já é a mesma.

#### 2. O servidor decide o que cada cliente vê

Fog of war aplicado só no cliente é decorativo: quem abre o devtools vê o mapa inteiro. A imagem do mapa, na prática, será baixada por completo — isso é aceito. O que **não** é aceito é vazar posição e existência de tokens que o mestre escondeu: esses não podem ser enviados ao cliente do jogador, em nenhum payload.

Ou seja, a garantia real do fog é sobre **tokens ocultos**, não sobre pixels do mapa. Isso precisa estar explícito para não gerar falsa sensação de segurança.

#### 3. Posse de token

O mestre controla qualquer token. Um jogador move apenas o token vinculado ao seu próprio personagem. A verificação é server-side, a cada movimento, contra `CampaignMember` e a posse do `Character`.

#### 4. Grid como referência visual

O grid define alinhamento e leitura de distância a olho, sem lógica de pathfinding, snap obrigatório ou cálculo de alcance. Medição está fora de escopo.

### Risks / Trade-offs

- **Sincronização de movimento é o problema difícil.** Arrasto contínuo gera muitos eventos por segundo e edições concorrentes no mesmo token. → Mitigação a definir no spike: throttle no cliente, último-a-escrever-vence no servidor e posse exclusiva durante o arrasto.
- **Fog of war não tem representação óbvia.** Bitmap é simples de aplicar e caro de trafegar; polígonos são leves e mais difíceis de compor e apagar. → Decidir por spike, não por argumento.
- **Mapas são imagens grandes.** Os limites de upload definidos para avatares no MVP não servem. → Revisar limites e considerar redimensionamento no servidor.
- **Canvas é a maior superfície de interface do produto.** → Manter o escopo travado nos Non-Goals; iluminação e medição são o caminho conhecido para o escopo escapar.

### Open Questions

Fechar por spike antes de escrever as tasks de implementação:

- Representação do fog: máscara bitmap versus lista de polígonos revelados.
- Protocolo de movimento: frequência de eventos, throttle e resolução de conflito.
- Biblioteca de canvas versus canvas 2D direto.
- Se o estado de fog vive em coluna da `Scene` ou em tabela própria — decorre da representação escolhida.

## Requisitos

### battlefield

#### ADDED Requirements

##### Requirement: Criar cena com mapa
O sistema SHALL permitir que apenas o mestre crie uma cena da campanha com nome e imagem de mapa, exibida como canvas para os membros.

###### Scenario: Criação da cena
- **WHEN** o mestre cria uma cena com nome e envia uma imagem de mapa dentro dos limites aceitos
- **THEN** a cena é criada, o mapa é armazenado como asset da campanha e a cena fica disponível para os membros

###### Scenario: Criação tentada por jogador
- **WHEN** um jogador tenta criar, editar ou excluir uma cena
- **THEN** o sistema recusa a operação

##### Requirement: Cena ativa da campanha
O sistema SHALL permitir que o mestre defina qual cena está ativa, e SHALL exibir aos jogadores apenas a cena ativa.

###### Scenario: Troca de cena
- **WHEN** o mestre define outra cena como ativa
- **THEN** os jogadores conectados passam a ver a nova cena

###### Scenario: Cena inativa
- **WHEN** um jogador requisita uma cena que não é a ativa
- **THEN** o sistema recusa a operação

##### Requirement: Grid configurável
O sistema SHALL permitir que o mestre ative o grid e defina o tamanho da célula como referência visual de posicionamento.

###### Scenario: Configuração do grid
- **WHEN** o mestre ativa o grid e define o tamanho da célula
- **THEN** o grid é sobreposto ao mapa para todos os membros que veem a cena

##### Requirement: Adicionar e remover tokens
O sistema SHALL permitir que apenas o mestre adicione e remova tokens na cena, a partir dos personagens da campanha ou dos statblocks do bestiário.

###### Scenario: Adicionar token
- **WHEN** o mestre adiciona um token a partir de um personagem da campanha ou de um statblock
- **THEN** o token aparece sobre o mapa na posição escolhida

###### Scenario: Adição tentada por jogador
- **WHEN** um jogador tenta adicionar ou remover um token
- **THEN** o sistema recusa a operação

##### Requirement: Movimentação por posse
O sistema SHALL permitir que o mestre mova qualquer token e que um jogador mova apenas o token vinculado ao seu próprio personagem, validando a posse no servidor a cada movimento.

###### Scenario: Movimento pelo dono
- **WHEN** um jogador move o token vinculado ao seu personagem
- **THEN** a nova posição é persistida e propagada aos demais membros que veem a cena

###### Scenario: Movimento de token alheio
- **WHEN** um jogador tenta mover um token que não é o do seu personagem
- **THEN** o sistema recusa a operação e a posição do token permanece inalterada

##### Requirement: Fog of war manual
O sistema SHALL permitir que apenas o mestre revele e volte a ocultar áreas do mapa, exibindo aos jogadores apenas as áreas reveladas.

###### Scenario: Revelar área
- **WHEN** o mestre revela uma área do mapa
- **THEN** os jogadores conectados passam a enxergar aquela área

###### Scenario: Reocultar área
- **WHEN** o mestre volta a ocultar uma área previamente revelada
- **THEN** os jogadores deixam de enxergar aquela área

###### Scenario: Controle restrito ao mestre
- **WHEN** um jogador tenta revelar ou ocultar qualquer área
- **THEN** o sistema recusa a operação

##### Requirement: Tokens ocultos não são enviados aos jogadores
O sistema SHALL omitir do payload enviado aos jogadores os tokens marcados como ocultos, de modo que sua existência e posição não sejam obteníveis pelo cliente.

###### Scenario: Token oculto pelo mestre
- **WHEN** o mestre marca um token como oculto
- **THEN** nenhum dado desse token é incluído no que é enviado aos clientes dos jogadores

###### Scenario: Revelação do token
- **WHEN** o mestre deixa de marcar o token como oculto
- **THEN** o token passa a ser enviado aos jogadores e aparece sobre o mapa

##### Requirement: Sincronização em tempo real
O sistema SHALL propagar alterações de tokens, grid e fog of war pelo canal em tempo real da campanha, aos membros que veem a cena.

###### Scenario: Propagação de alteração
- **WHEN** o mestre ou um jogador altera a posição de um token, o grid ou o fog of war
- **THEN** a alteração é propagada em tempo real aos membros conectados que veem a cena

###### Scenario: Reconexão
- **WHEN** um membro perde a conexão e reconecta
- **THEN** ele recarrega o estado atual da cena — tokens visíveis, grid e fog — a partir do servidor

## Tarefas

### 1. Spike (descartável) — fechar as Open Questions do design

Não escrever código de produção antes deste grupo terminar. A saída é uma decisão registrada no `design.md`, não código mantido.

- [ ] 1.1 Protótipo de fog: máscara bitmap versus polígonos revelados — medir tamanho do payload e custo de compor e apagar áreas
- [ ] 1.2 Protótipo de arrasto de token: medir frequência de eventos, testar throttle e resolução de conflito
- [ ] 1.3 Avaliar biblioteca de canvas versus canvas 2D direto para pan, zoom e hit-testing
- [ ] 1.4 Registrar as decisões no `design.md` e remover a seção Open Questions

### 2. Cenas e mapa

- [ ] 2.1 Tabela `Scene` e CRUD restrito ao mestre
- [ ] 2.2 Upload de mapa reutilizando `Asset`, com limites revistos para imagens grandes
- [ ] 2.3 Cena ativa da campanha e regra de acesso do jogador apenas à cena ativa
- [ ] 2.4 Canvas no cliente: renderizar o mapa com pan e zoom
- [ ] 2.5 Grid configurável (ativar/desativar e tamanho de célula)

### 3. Tokens

- [ ] 3.1 Tabela `Token` (origem personagem ou statblock, posição, flag de oculto)
- [ ] 3.2 Mestre adiciona e remove tokens a partir de personagens e do bestiário
- [ ] 3.3 Renderização e arrasto de tokens no canvas
- [ ] 3.4 Validação de posse no servidor a cada movimento
- [ ] 3.5 Evento `token.moved` no canal em tempo real existente
- [ ] 3.6 Tokens ocultos filtrados no servidor, fora do payload dos jogadores
- [ ] 3.7 Testes de integração: jogador não move token alheio; payload do jogador não contém token oculto

### 4. Fog of war

- [ ] 4.1 Persistir o estado de fog no formato decidido no spike
- [ ] 4.2 Mestre revela e reoculta áreas
- [ ] 4.3 Composição do fog sobre o mapa no canvas do jogador
- [ ] 4.4 Evento `fog.updated` no canal em tempo real
- [ ] 4.5 Teste de integração: jogador não consegue alterar o fog

### 5. Fechamento

- [ ] 5.1 Recarregar estado completo da cena na reconexão
- [ ] 5.2 Estender o seed da campanha de exemplo com cena, mapa e tokens
- [ ] 5.3 Atualizar o README retirando o Owlbear Rodeo do fluxo da mesa
- [ ] 5.4 `openspec validate vtt-battlefield` e `openspec status`
