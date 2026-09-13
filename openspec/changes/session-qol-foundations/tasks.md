# Tasks — session-qol-foundations

As fases seguem a decisão de design: o contrato (shared + server) vem primeiro
para as stories compilarem contra o tipo alvo; cada grupo do frontend entrega
valor usável numa sessão e é verificado no Storybook antes de integrar.

## 1. Contrato (shared + server)

- [x] 1.1 Ampliar `CharacterSummary` com `hp` e `ac`; atualizar a listagem de personagens no servidor para devolvê-los
- [x] 1.2 `LinkedRollRequest`: adicionar `kind: 'skill'` e `skill?: Skill`; implementar a rolagem de perícia no servidor (bônus = modificador do atributo + proficiência quando treinada)
- [x] 1.3 `LinkedRollRequest`: substituir `advantage?: boolean` por `mode?: RollMode`; implementar normal/vantagem/desvantagem nas rolagens linkadas no servidor
- [x] 1.4 Tornar `SessionEvent.type` uma união discriminada começando por `'roll'`; adicionar paginação em `FeedResponse` (`events` + `nextCursor`)
- [x] 1.5 Implementar `?before=<eventId>&limit=N` no `GET /campaigns/:id/feed`, mantendo ordem cronológica antiga → nova
- [x] 1.6 Criar `validateCharacterInput` em shared (nível 1–20, HP 1–999, CA 0–40, campos obrigatórios, expressões de dano) com testes unitários
- [x] 1.7 Testes: perícia só do dono (RBAC), modo inválido para não-d20 recusado, paginação com e sem `before`, `CharacterSummary` com HP/CA
- [x] 1.8 `npm run typecheck` e `npm test` verdes

## 2. Componentes no Storybook (fonte de verdade)

- [x] 2.1 `QuickDice` (pills d4–d100, prévia, repetir última) + story com estados vazio/preenchido/desabilitado
- [x] 2.2 `RollModeControl` (segmented Normal/Vantagem/Desvantagem) + story
- [x] 2.3 `SkillChip` (perícia, bônus, ação de rolar, só dono) + story
- [x] 2.4 `CharacterRow` com chips de HP/CA + story (dono, consulta, sem HP)
- [x] 2.5 `FeedEventCard` com `UnknownEventCard` (tipo desconhecido) + story de rolagem e de tipo desconhecido
- [x] 2.6 `FeedFollow` (altura controlada, seguir ao vivo, pill de novos, ver mais) + story curta/longa/pill
- [x] 2.7 `SectionNav` + hook `useActiveSection` (IntersectionObserver) + story desktop/mobile
- [x] 2.8 `CharacterForm` extraído de `CharacterFormDialog` (novo/edição, avatar, discard, erro) + story
- [x] 2.9 Gate por componente: `npm run lint` e `npm run test:design` verdes para cada story nova

## 3. Integração nas telas

- [x] 3.1 `DiceRoller`: integrar `QuickDice` e `RollModeControl`; manter restrição de modo para d20; restaurar última rolagem
- [x] 3.2 `CharacterSheetView`: integrar `SkillChip` nas perícias e `RollModeControl` nas ações de rolagem linkadas
- [x] 3.3 `CharactersSection`: usar `CharacterRow` com HP/CA no resumo
- [x] 3.4 `SessionFeed`: usar `FeedEventCard` e `FeedFollow` (altura no desktop, seguir ao vivo, pill de novos, "ver mais" com cursor)
- [x] 3.5 `useCampaignSocket`: invalidar `characters` apenas para eventos de rolagem
- [x] 3.6 `AppShell`/`Campaign`: integrar `SectionNav`/`useActiveSection`, substituindo o `activeItem` fixo
- [x] 3.7 `CharacterFormDialog`: usar `CharacterForm` com validação por campo via `validateCharacterInput`

## 4. Verificação final

- [x] 4.1 `npm run lint`, `npm run typecheck`, `npm test` e `npm run build` verdes
- [x] 4.2 `npm run test:design` com todas as stories novas aprovadas nos temas e larguras
- [ ] 4.3 `verify:app` e `verify:group` contra o app rodando
- [x] 4.4 Atualizar `docs/design-system.md` com os novos componentes e a contagem de verificações