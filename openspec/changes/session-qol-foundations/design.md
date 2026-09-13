## Context

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

## Goals / Non-Goals

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

## Decisions

### 1. Contrato antes de componente (ordem de execução)

As stories dos componentes do Grupo B compilam contra o tipo alvo; por isso o
contrato (shared + server + testes) vem primeiro, depois os componentes no
Storybook, depois a integração nas telas e a verificação final. Isso evita
reescrever stories contra tipos provisórios e mantém cada story como fonte de
verdade estável.

### 2. `SessionEvent` como união discriminada com fallback

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

### 3. `useCampaignSocket` consciente do tipo

O merge de eventos no cache do feed continua genérico. A invalidação de
`characters` passa a acontecer só quando `event.type === 'roll'` (a criação de
personagem é seguida por uma rolagem que atualiza a mesa). Assim, quando a
Fase 2 trafegar `token.moved`, nenhuma requisição desnecessária de personagens
dispara. A recuperação após reconexão (refetch do feed) permanece intacta.

### 4. `LinkedRollRequest`: `kind: 'skill'` e `mode` no lugar de `advantage`

- `LinkedRollRequest` ganha `kind: 'skill'` com `skill?: Skill`, e troca
  `advantage?: boolean` por `mode?: RollMode` (normal/vantagem/desvantagem).
  O servidor continua sendo a única fonte do total: o bônus da perícia é
  `abilityModifier(SKILL_ABILITIES[skill]) + (treinada ? proficiencyBonus(level) : 0)`,
  reutilizando `SKILL_ABILITIES` e `proficiencyBonus` de `shared/`.
- O rótulo do evento no feed e na ficha usa a perícia disparada.

**Alternativa considerada:** manter `advantage` e adicionar `disadvantage`.
Rejeitada: dois campos booleanos cobrindo três estados é menos legível que um
`mode` tipado, e a ficha precisa do tri-estado para o seletor.

### 5. Paginação cursor-based do feed

`GET /campaigns/:id/feed` ganha `?before=<eventId>&limit=N`. A resposta passa a
`{ events, nextCursor: string | null }`. `before` é um cursor opaco (id do
evento mais antigo já carregado); sem `before`, o servidor devolve os `limit`
mais recentes. Ordem cronológica mantida (antiga → nova). O cliente insere
eventos mais antigos no topo com "Ver mais", e continua apendando os eventos
novos via socket. `SessionEvent` e o merge do socket não mudam de formato.

### 6. Componentes presentacionais Storybook-first

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

### 7. Validação por campo no editor

Validadores de ficha viram lógica pura em `shared/` (`validateCharacterInput`),
testada com unit, e reutilizados pelo cliente junto do `Field error`. A
fronteira é a mesma do servidor: nível inteiro 1–20, HP 1–999, CA 0–40, nome/
raça/classe não vazios e expressões de dano interpretáveis. O servidor continua
validando tudo de novo (cliente nunca é fonte de verdade).

## Risks / Trade-offs

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

## Migration Plan

- Nenhuma migração de dados: `hp`/`ac` já são colunas da ficha; o resumo passa
  a devolvê-los sem novo schema.
- `advantage` sai do contrato; a API passa a aceitar `mode`. Nenhum deploy
  externo depende da forma antiga (self-hosted, um processo).

## Open Questions

- Frequência/política do "N novos resultados": quantos eventos entram na pill
  antes de o usuário ser levado de volta ao fim? Decisão de produto; default
  proposto: rolagens são entregues por socket e contadas, sem limite rígido,
  com o botão retornando ao fim.