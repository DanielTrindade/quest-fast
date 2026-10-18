# session-qol-foundations

> Registro histórico, escrito originalmente como change do OpenSpec (criado em 2026-09-10).
> Status em 2026-10-18: implementado (falta só a verificação contra o app rodando). O estado atual do produto está em
> [`../roadmap.md`](../roadmap.md) e a arquitetura em [`../architecture.md`](../architecture.md).

## Proposta

### Why

A mesa já joga dentro da plataforma, mas o ritmo de jogo ainda tropeça em três
superfícies que a Fase 2 (campo de batalha/VTT) vai estender: criação e edição
de fichas, rolagem de dados e o feed da sessão. O feed hoje assume que todo
evento é uma rolagem; a Fase 2 adiciona novos tipos de evento no mesmo canal
WebSocket sem alterar o envelope. Este change cobre a qualidade de vida dessas
três superfícies e da gestão da sessão, e deixa o frontend pronto para os novos
tipos de evento — sem tocar em combate, mobs ou VTT.

### What Changes

- **Fichas**: `CharacterForm` extraído do diálogo como componente reutilizável;
  validação por campo junto ao `Field`; HP/CA no resumo da lista de personagens
  (**BREAKING** em `CharacterSummary`).
- **Dados**: atalhos `QuickDice` (d4–d100) e repetir a última rolagem; perícias
  treinadas tornam-se roláveis pela ficha (**BREAKING** em `LinkedRollRequest`);
  rolagens vinculadas aceitam Normal/Vantagem/Desvantagem (**BREAKING** em
  `LinkedRollRequest`).
- **Sessão**: feed com altura controlada e acompanhamento ao vivo; histórico
  paginado (**BREAKING** em `GET /campaigns/:id/feed`); renderizador de evento
  discriminado por tipo, com fallback para tipos futuros.
- **Gestão da sessão**: navegação com seção ativa (substitui o `activeItem`
  fixo do `AppShell`).
- **Storybook-first**: todo componente novo nasce como story e passa
  `npm run test:design` antes de integrar às telas.

### Capabilities

#### New Capabilities

Nenhuma: o trabalho modifica capacidades que já existem como delta do
`mvp-campaign-management` ou como spec principal.

#### Modified Capabilities

- `characters`: o resumo da lista ganha HP e CA; perícias treinadas tornam-se
  roláveis pela ficha do dono.
- `dice-rolling`: rolagens vinculadas passam a aceitar modo
  Normal/Vantagem/Desvantagem.
- `session-feed`: feed ganha acompanhamento ao vivo, paginação e renderização
  discriminada por tipo de evento, com fallback para tipos ainda não
  renderizados.
- `design-foundation`: novos componentes do sistema de design (QuickDice,
  FeedFollow, FeedEventCard, SectionNav, CharacterForm, SkillChip,
  RollModeControl, CharacterRow com HP/CA), todos com stories.

### Impact

- `shared/`: `CharacterSummary` ganha `hp`/`ac`; `LinkedRollRequest` ganha
  `kind: 'skill'` e `mode: RollMode`; `SessionEvent` vira união discriminada;
  resposta do feed ganha cursor de paginação.
- `server/`: listagem de personagens inclui HP/CA; rolagem vinculada de
  perícia e de modos; paginação no `GET /feed`.
- `client/`: novos componentes e stories; integração em `DiceRoller`,
  `SessionFeed`, `AppShell`/`Campaign`, `CharactersSection`,
  `CharacterSheetView` e `CharacterFormDialog`; `useCampaignSocket` passa a
  reagir por tipo de evento.
- Nenhuma dependência nova.

### Non-goals

- Combate, iniciativa, mobs, statblocks e o campo de batalha (VTT) — são a
  Fase 2.
- Chat livre, áudio e vídeo.
- Capa de campanha persistida e barra de HP atual/máxima (o modelo só tem `hp`).
- Iluminação, fog automático e medição.

## Design

### Context

O MVP entregou uma sessão jogável: fichas, rolagem livre e linkada, feed em
tempo real via WebSocket por campanha, RBAC por `CampaignMember` e a abstração
`Asset`. O feed e o canal foram projetados para receber novos tipos de evento
na Fase 2 (VTT: `token.moved`, `fog.updated`), mas o cliente ainda assume que
todo evento do canal é uma rolagem: `SessionEvent.type` é o literal `'roll'`,
`FeedRow` lê `payload` como `RollPayload` e `useCampaignSocket` invalida a
consulta de personagens a cada mensagem. Este change cozinha as três superfícies
que a Fase 2 estende — fichas, dados e feed — e a gestão da sessão, deixando o
canal pronto para os novos tipos sem alterar o envelope.

Fronteiras fixas: o cliente nunca é fonte de verdade; lógica 5e pura vive em
`shared/` com testes; texto visível em pt-BR, código em inglês; componentes
novos nascem no Storybook e só depois integram as telas.

### Goals / Non-Goals

**Goals:**

- Reduzir o atrito das ações mais frequentes da mesa: rolar, criar/editar ficha
  e acompanhar a sessão.
- Preparar o feed para a Fase 2: renderização discriminada por tipo de evento,
  com fallback para tipos ainda não renderizados, sem quebrar a sessão.
- Contrato explícito (shared/server) para os itens que exigem ampliação: HP/CA
  no resumo, perícias roláveis, modos nas rolagens vinculadas e paginação.
- Todo componente novo passa por stories e pelo gate `npm run test:design`.

**Non-Goals:**

- Combate, iniciativa, mobs, statblocks e VTT (Fase 2).
- Chat livre, áudio e vídeo.
- Capa de campanha persistida e HP atual/máximo.
- Mudar o envelope `SocketMessage` ou a infraestrutura do canal.

### Decisions

#### 1. Contrato antes de componente (ordem de execução)

As stories dos componentes do Grupo B compilam contra o tipo alvo; por isso o
contrato (shared + server + testes) vem primeiro, depois os componentes no
Storybook, depois a integração nas telas e a verificação final. Isso evita
reescrever stories contra tipos provisórios e mantém cada story como fonte de
verdade estável.

#### 2. `SessionEvent` como união discriminada com fallback

`SessionEvent.type` deixa de ser o literal `'roll'` e vira uma união de
eventos (`'roll'` hoje; `token.moved`/`fog.updated` na Fase 2). O componente
`FeedEventCard` despacha por `event.type`; tipos desconhecidos caem num
`UnknownEventCard` que não quebra o feed (título genérico + metadados). O
envelope `SocketMessage` permanece `{ type: 'session.event', event }` — a
Fase 2 só estende a união. A estória do feed cobre o caso "tipo desconhecido"
como garantia da preparação.

**Alternativa considerada:** manter `type: 'roll'` e adicionar campos opcionais
no mesmo tipo. Rejeitada: cria payloads ambíguos e o fallback fica impossível
de distinguir de um roll malformado.

#### 3. `useCampaignSocket` consciente do tipo

O merge de eventos no cache do feed continua genérico. A invalidação de
`characters` passa a acontecer só quando `event.type === 'roll'` (a criação de
personagem é seguida por uma rolagem que atualiza a mesa). Assim, quando a
Fase 2 trafegar `token.moved`, nenhuma requisição desnecessária de personagens
dispara. A recuperação após reconexão (refetch do feed) permanece intacta.

#### 4. `LinkedRollRequest`: `kind: 'skill'` e `mode` no lugar de `advantage`

- `LinkedRollRequest` ganha `kind: 'skill'` com `skill?: Skill`, e troca
  `advantage?: boolean` por `mode?: RollMode` (normal/vantagem/desvantagem).
  O servidor continua sendo a única fonte do total: o bônus da perícia é
  `abilityModifier(SKILL_ABILITIES[skill]) + (treinada ? proficiencyBonus(level) : 0)`,
  reutilizando `SKILL_ABILITIES` e `proficiencyBonus` de `shared/`.
- O rótulo do evento no feed e na ficha usa a perícia disparada.

**Alternativa considerada:** manter `advantage` e adicionar `disadvantage`.
Rejeitada: dois campos booleanos cobrindo três estados é menos legível que um
`mode` tipado, e a ficha precisa do tri-estado para o seletor.

#### 5. Paginação cursor-based do feed

`GET /campaigns/:id/feed` ganha `?before=<eventId>&limit=N`. A resposta passa a
`{ events, nextCursor: string | null }`. `before` é um cursor opaco (id do
evento mais antigo já carregado); sem `before`, o servidor devolve os `limit`
mais recentes. Ordem cronológica mantida (antiga → nova). O cliente insere
eventos mais antigos no topo com "Ver mais", e continua apendando os eventos
novos via socket. `SessionEvent` e o merge do socket não mudam de formato.

#### 6. Componentes presentacionais Storybook-first

Cada componente novo é presentacional e recebe dados/callbacks por props:

- `QuickDice`: pills `d4/d6/d8/d10/d12/d20/d100` que emitem a expressão, prévia
  formatada, e "Repetir última rolagem". Não interpreta regra; o rolador decide.
- `FeedFollow`: contêiner do feed com altura controlada no desktop (container
  query), seguir ao vivo quando o usuário está no fim, pill "N novos resultados"
  ao ler passado; recebe `events`, `onLoadMore`, `nextCursor`.
- `FeedEventCard`: despacho por `event.type` com `UnknownEventCard`.
- `SectionNav` + hook `useActiveSection`: navegação com seção ativa via
  `IntersectionObserver` (substitui o `activeItem=""` fixo do `AppShell`).
- `CharacterForm`: o formulário da ficha extraído de `CharacterFormDialog` como
  componente puro (novo/edição, avatar subindo, discard-confirmed, erro).
- `SkillChip`: perícia com bônus e ação de rolar (só para o dono).
- `RollModeControl`: o `.qf-segmented` vira componente reutilizável.
- `CharacterRow` ganha chips de HP/CA quando presentes.

Toda interação de rolagem e autorização permanece em `CharacterSheetDialog`/
`DiceRoller`/servidor; os componentes só apresentam.

#### 7. Validação por campo no editor

Validadores de ficha viram lógica pura em `shared/` (`validateCharacterInput`),
testada com unit, e reutilizados pelo cliente junto do `Field error`. A
fronteira é a mesma do servidor: nível inteiro 1–20, HP 1–999, CA 0–40, nome/
raça/classe não vazios e expressões de dano interpretáveis. O servidor continua
validando tudo de novo (cliente nunca é fonte de verdade).

### Risks / Trade-offs

- **Quebra de contrato em `LinkedRollRequest` e `CharacterSummary`** → tipos,
  testes de shared/server e client mudam juntos neste mesmo change; nenhuma
  compatibilidade de API pública fora do produto.
- **Feed com scroll interno no desktop vs. lista natural no celular** → altura
  controlada só por container query (desktop); no celular mantém a lista na
  página com a pill de novos resultados.
- **Fallback de eventos desconhecidos** → hoje é cosmético; se a Fase 2 entrar
  antes do feed renderizar o tipo, o usuário vê uma linha genérica em vez de
  silêncio. Mitigação: story explícita de tipo desconhecido e `UnknownEventCard`
  com metadados úteis (autor, horário, tipo).
- **`IntersectionObserver` para a seção ativa** → custo desprezível; a página é
  uma única coluna rolável e os alvos são os cabeçalhos de seção existentes.

### Migration Plan

- Nenhuma migração de dados: `hp`/`ac` já são colunas da ficha; o resumo passa
  a devolvê-los sem novo schema.
- `advantage` sai do contrato; a API passa a aceitar `mode`. Nenhum deploy
  externo depende da forma antiga (self-hosted, um processo).

### Open Questions

- Frequência/política do "N novos resultados": quantos eventos entram na pill
  antes de o usuário ser levado de volta ao fim? Decisão de produto; default
  proposto: rolagens são entregues por socket e contadas, sem limite rígido,
  com o botão retornando ao fim.

## Requisitos

### characters

#### ADDED Requirements

##### Requirement: Resumo com HP e CA
O sistema SHALL incluir o HP e a CA atuais de cada personagem no resumo da lista de personagens da campanha.

###### Scenario: Lista com vida e armadura
- **WHEN** um membro abre a lista de personagens da campanha
- **THEN** cada linha do resumo exibe o HP e a CA atuais do personagem, sem precisar abrir a ficha

###### Scenario: Resumo de terceiros
- **WHEN** o resumo é exibido a outro membro que não o dono
- **THEN** HP e CA continuam visíveis, pois são informação pública da mesa

##### Requirement: Perícia rolável pela ficha
O sistema SHALL permitir que o dono de um personagem role um teste de perícia a partir da ficha, aplicando o modificador do atributo da perícia e o bônus de proficiência quando a perícia for treinada.

###### Scenario: Teste de perícia treinada
- **WHEN** o dono dispara uma perícia treinada a partir da ficha
- **THEN** o servidor soma o modificador do atributo e o bônus de proficiência do nível, publica o resultado no feed e identifica o personagem e a perícia

###### Scenario: Teste de perícia não treinada
- **WHEN** o dono dispara uma perícia não treinada a partir da ficha
- **THEN** o servidor aplica apenas o modificador do atributo da perícia

###### Scenario: Perícia por outro membro
- **WHEN** outro membro, incluindo o mestre, tenta disparar uma perícia a partir da ficha de um personagem
- **THEN** a ficha se apresenta em consulta e não oferece a ação de rolar a perícia

### design-foundation

#### ADDED Requirements

##### Requirement: Atalhos de rolagem
O sistema SHALL oferecer atalhos de rolagem para os dados comuns (d4, d6, d8, d10, d12, d20 e d100) e a repetição da última rolagem, mantendo o resultado calculado no servidor.

###### Scenario: Atalho preenche a expressão
- **WHEN** o usuário aciona um atalho de dado
- **THEN** a expressão do rolador é preenchida com o atalho (ex.: `1d20`) e fica pronta para edição

###### Scenario: Repetir última rolagem
- **WHEN** o usuário aciona repetir a última rolagem
- **THEN** a expressão da última rolagem válida é restaurada no rolador

###### Scenario: Atalho com modo restrito
- **WHEN** o usuário escolhe vantagem ou desvantagem e aciona um atalho que não é um d20
- **THEN** o rolador informa que o modo vale apenas para um d20 e não envia a rolagem

##### Requirement: Formulário de ficha reutilizável
O sistema SHALL fornecer o formulário de ficha como componente isolado, com validação por campo, que sirva tanto para criação quanto para edição.

###### Scenario: Erro junto ao campo
- **WHEN** o usuário submete uma ficha com um valor inválido (ex.: nível fora de 1–20)
- **THEN** a mensagem de erro aparece junto ao campo correspondente, sem exigir ida ao rodapé

###### Scenario: Reutilização
- **WHEN** o formulário de ficha é usado em criação ou em edição
- **THEN** ele é o mesmo componente, com os mesmos estados de validação e de envio

##### Requirement: Navegação com seção ativa
O sistema SHALL destacar na navegação da campanha a seção visível no momento, tanto no menu desktop quanto no recolhível mobile.

###### Scenario: Seção atual destacada
- **WHEN** o usuário rola a página da campanha
- **THEN** o item da navegação correspondente à seção visível fica marcado como ativo

###### Scenario: Navegação por âncora preservada
- **WHEN** o usuário aciona um item da navegação
- **THEN** a página rola até a seção correspondente e o item passa a ser o ativo

### dice-rolling

#### ADDED Requirements

##### Requirement: Modos em rolagens linkadas
O sistema SHALL aceitar rolagens linkadas à ficha com modo normal, vantagem ou desvantagem, mantendo o servidor como única fonte do resultado.

###### Scenario: Ataque com vantagem
- **WHEN** o dono dispara um ataque com vantagem a partir da ficha
- **THEN** o servidor lança dois d20, considera o maior, aplica o bônus do ataque e publica o resultado no feed

###### Scenario: Teste de habilidade com desvantagem
- **WHEN** o dono dispara um teste de habilidade com desvantagem a partir da ficha
- **THEN** o servidor lança dois d20, considera o menor, aplica o modificador e publica o resultado no feed

###### Scenario: Modo inválido para rolagem linkada
- **WHEN** uma rolagem linkada solicita vantagem ou desvantagem para uma rolagem que não é um d20
- **THEN** o sistema recusa a rolagem com mensagem de erro e nada é publicado no feed

### session-feed

#### ADDED Requirements

##### Requirement: Acompanhamento ao vivo do feed
O sistema SHALL manter o feed acompanhando os eventos novos em tempo real quando o usuário está no fim do histórico, e SHALL sinalizar eventos novos quando o usuário está lendo o passado.

###### Scenario: Seguir o fim do feed
- **WHEN** o usuário está no fim do feed e um evento novo chega
- **THEN** o feed avança automaticamente e mostra o evento novo no fim

###### Scenario: Leitura do passado com eventos novos
- **WHEN** o usuário rola para cima para ler eventos antigos e eventos novos chegam
- **THEN** uma indicação visível informa a quantidade de novos resultados e, ao acioná-la, o usuário retorna ao fim do feed

###### Scenario: Altura controlada no desktop
- **WHEN** o feed é exibido em uma largura de desktop
- **THEN** o histórico ocupa uma altura controlada com rolagem própria, sem crescer a página indefinidamente

##### Requirement: Histórico paginado
O sistema SHALL permitir carregar eventos mais antigos do que os exibidos, em ordem cronológica, sem depender de socket.

###### Scenario: Carregar mais eventos antigos
- **WHEN** o usuário solicita mais eventos no feed
- **THEN** o sistema devolve os eventos anteriores ao cursor informado e o feed os insere no início do histórico

###### Scenario: Fim do histórico
- **WHEN** o usuário solicita mais eventos e não há eventos mais antigos
- **THEN** o sistema indica que o histórico terminou e não oferece mais a ação de carregar

##### Requirement: Renderização por tipo de evento
O sistema SHALL renderizar cada evento do feed conforme o seu tipo, e SHALL exibir uma apresentação genérica para tipos de evento que o cliente ainda não conhece.

###### Scenario: Evento de rolagem
- **WHEN** um evento do tipo rolagem é exibido no feed
- **THEN** ele usa a apresentação de dado (total, decomposição, modo, natural, segredo)

###### Scenario: Tipo de evento desconhecido
- **WHEN** um evento de um tipo que o cliente ainda não renderiza é exibido no feed
- **THEN** ele aparece com autor, horário e a identificação do tipo, sem quebrar o feed nem silenciar a informação

###### Scenario: Secreto preservado
- **WHEN** um evento secreto é exibido ao mestre
- **THEN** a apresentação genérica preserva a linguagem de conteúdo secreto do sistema

## Tarefas

## Tasks — session-qol-foundations

As fases seguem a decisão de design: o contrato (shared + server) vem primeiro
para as stories compilarem contra o tipo alvo; cada grupo do frontend entrega
valor usável numa sessão e é verificado no Storybook antes de integrar.

### 1. Contrato (shared + server)

- [x] 1.1 Ampliar `CharacterSummary` com `hp` e `ac`; atualizar a listagem de personagens no servidor para devolvê-los
- [x] 1.2 `LinkedRollRequest`: adicionar `kind: 'skill'` e `skill?: Skill`; implementar a rolagem de perícia no servidor (bônus = modificador do atributo + proficiência quando treinada)
- [x] 1.3 `LinkedRollRequest`: substituir `advantage?: boolean` por `mode?: RollMode`; implementar normal/vantagem/desvantagem nas rolagens linkadas no servidor
- [x] 1.4 Tornar `SessionEvent.type` uma união discriminada começando por `'roll'`; adicionar paginação em `FeedResponse` (`events` + `nextCursor`)
- [x] 1.5 Implementar `?before=<eventId>&limit=N` no `GET /campaigns/:id/feed`, mantendo ordem cronológica antiga → nova
- [x] 1.6 Criar `validateCharacterInput` em shared (nível 1–20, HP 1–999, CA 0–40, campos obrigatórios, expressões de dano) com testes unitários
- [x] 1.7 Testes: perícia só do dono (RBAC), modo inválido para não-d20 recusado, paginação com e sem `before`, `CharacterSummary` com HP/CA
- [x] 1.8 `npm run typecheck` e `npm test` verdes

### 2. Componentes no Storybook (fonte de verdade)

- [x] 2.1 `QuickDice` (pills d4–d100, prévia, repetir última) + story com estados vazio/preenchido/desabilitado
- [x] 2.2 `RollModeControl` (segmented Normal/Vantagem/Desvantagem) + story
- [x] 2.3 `SkillChip` (perícia, bônus, ação de rolar, só dono) + story
- [x] 2.4 `CharacterRow` com chips de HP/CA + story (dono, consulta, sem HP)
- [x] 2.5 `FeedEventCard` com `UnknownEventCard` (tipo desconhecido) + story de rolagem e de tipo desconhecido
- [x] 2.6 `FeedFollow` (altura controlada, seguir ao vivo, pill de novos, ver mais) + story curta/longa/pill
- [x] 2.7 `SectionNav` + hook `useActiveSection` (IntersectionObserver) + story desktop/mobile
- [x] 2.8 `CharacterForm` extraído de `CharacterFormDialog` (novo/edição, avatar, discard, erro) + story
- [x] 2.9 Gate por componente: `npm run lint` e `npm run test:design` verdes para cada story nova

### 3. Integração nas telas

- [x] 3.1 `DiceRoller`: integrar `QuickDice` e `RollModeControl`; manter restrição de modo para d20; restaurar última rolagem
- [x] 3.2 `CharacterSheetView`: integrar `SkillChip` nas perícias e `RollModeControl` nas ações de rolagem linkadas
- [x] 3.3 `CharactersSection`: usar `CharacterRow` com HP/CA no resumo
- [x] 3.4 `SessionFeed`: usar `FeedEventCard` e `FeedFollow` (altura no desktop, seguir ao vivo, pill de novos, "ver mais" com cursor)
- [x] 3.5 `useCampaignSocket`: invalidar `characters` apenas para eventos de rolagem
- [x] 3.6 `AppShell`/`Campaign`: integrar `SectionNav`/`useActiveSection`, substituindo o `activeItem` fixo
- [x] 3.7 `CharacterFormDialog`: usar `CharacterForm` com validação por campo via `validateCharacterInput`

### 4. Verificação final

- [x] 4.1 `npm run lint`, `npm run typecheck`, `npm test` e `npm run build` verdes
- [x] 4.2 `npm run test:design` com todas as stories novas aprovadas nos temas e larguras
- [ ] 4.3 `verify:app` e `verify:group` contra o app rodando
- [x] 4.4 Atualizar `docs/design-system.md` com os novos componentes e a contagem de verificações
