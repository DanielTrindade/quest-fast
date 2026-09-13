## Why

A mesa já joga dentro da plataforma, mas o ritmo de jogo ainda tropeça em três
superfícies que a Fase 2 (campo de batalha/VTT) vai estender: criação e edição
de fichas, rolagem de dados e o feed da sessão. O feed hoje assume que todo
evento é uma rolagem; a Fase 2 adiciona novos tipos de evento no mesmo canal
WebSocket sem alterar o envelope. Este change cobre a qualidade de vida dessas
três superfícies e da gestão da sessão, e deixa o frontend pronto para os novos
tipos de evento — sem tocar em combate, mobs ou VTT.

## What Changes

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

## Capabilities

### New Capabilities

Nenhuma: o trabalho modifica capacidades que já existem como delta do
`mvp-campaign-management` ou como spec principal.

### Modified Capabilities

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

## Impact

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

## Non-goals

- Combate, iniciativa, mobs, statblocks e o campo de batalha (VTT) — são a
  Fase 2.
- Chat livre, áudio e vídeo.
- Capa de campanha persistida e barra de HP atual/máxima (o modelo só tem `hp`).
- Iluminação, fog automático e medição.