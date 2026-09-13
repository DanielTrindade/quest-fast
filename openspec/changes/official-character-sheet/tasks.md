# Tasks — official-character-sheet

Cada fase entrega uma parte da ficha oficial usável numa sessão real, de ponta a
ponta: regra em `shared/`, migração, servidor com testes, componentes no
Storybook e integração na consulta e no editor.

## 1. Fundação: abas e limites compartilhados

- [x] 1.1 Extrair `CHARACTER_LIMITS` para `shared/` e usá-lo no parser do servidor e em `validateCharacterInput`, sem mudar comportamento (testes atuais verdes)
- [x] 1.2 Criar módulo de regras derivadas em `shared/` (`skillBonus`, `saveBonus`) com testes unitários e usá-lo em `parseLinkedRoll` e em `CharacterSheetView`
- [x] 1.3 `SheetTabs` (padrão WAI-ARIA, setas do teclado, marcação de erro por aba) + story
- [x] 1.4 Reorganizar consulta (Personagem, Magias, Inventário e história) e editor (cinco seções) em abas com os campos atuais; primeira aba com erro aberta num envio recusado
- [x] 1.5 Trocar o rótulo "Raça" por "Espécie" no cliente e no `verify-group`
- [x] 1.6 Gate: `npm test`, `npm run lint` e `npm run test:design` verdes

## 2. Identidade e combate

- [x] 2.1 `shared/`: tipos de identidade, combate e estado (`subclass`, `background`, `alignment`, `experience`, `size`, `speed`, `shield`, `hitDie`, `initiativeBonus`, `passivePerceptionBonus`, `hpCurrent`, `hpTemp`, `hitDiceSpent`, `deathSaves`, `heroicInspiration`), `CharacterStateInput`, `initiative`, `passivePerception`, `applyDamage`, `applyHealing` e validação, com testes unitários
- [x] 2.2 Migração única com todas as colunas da ficha oficial (fases 2 a 6) e `UPDATE characters SET hp_current = hp`
- [x] 2.3 Servidor: parser com padrões, criação com PV cheio, edição ajustando o estado aos máximos, `PATCH .../state` só do dono, resumo com `hpCurrent`/`hpTemp`, rolagem `initiative`
- [x] 2.4 Testes de integração: estado alterado pelo dono, estado recusado ao mestre e a outro jogador (RBAC), limites do estado, ficha antiga após a migração, edição reduzindo o PV máximo, iniciativa só do dono
- [x] 2.5 Stories: `SheetIdentity`, `HitPointsTracker`, `HitDiceTracker`, `DeathSaves`, `HeroicInspiration`, `DerivedStats` (dono, consulta, zerado, valores extremos)
- [x] 2.6 Integração: cabeçalho e faixa de combate na consulta com mutação de estado em `CharacterSheetDialog`; campos na aba Identidade e combate do editor; `CharacterRow` com PV atual/máximo; rótulo de iniciativa no feed
- [x] 2.7 Gate: `npm test`, `npm run typecheck`, `npm run lint` e `npm run test:design` verdes

## 3. Atributos, perícias e treinamento

- [x] 3.1 `shared/`: `expertise` (subconjunto de `skills`), `armorTraining`, `weaponProficiencies`, `toolProficiencies`; `skillBonus` com especialização e validação, com testes unitários
- [x] 3.2 Colunas incluídas na migração única da tarefa 2.2
- [x] 3.3 Servidor: parser (especialização sem proficiência recusada) e rolagem de perícia com especialização; testes de integração
- [x] 3.4 Stories: `AbilityBlock` (perícias sob o atributo, proficiente e especialista, rolável e consulta), `ProficiencyToggle`, `EquipmentTraining`
- [x] 3.5 Integração: atributos da consulta com `AbilityBlock`; aba Atributos e perícias do editor com `ProficiencyToggle` e treinamento
- [x] 3.6 Gate: `npm test`, `npm run lint` e `npm run test:design` verdes

## 4. Ataques e características

- [x] 4.1 `shared/`: `Attack.damageType`, `Attack.notes`, `speciesTraits`, `feats` e validação, com testes unitários
- [x] 4.2 Colunas incluídas na migração única da tarefa 2.2
- [x] 4.3 Servidor: parser com padrões para ataques antigos; testes de integração
- [x] 4.4 Stories: `AttackCard` com tipo e notas, `TraitList` (vazia, longa)
- [x] 4.5 Integração: aba Ataques e características do editor e seções da consulta
- [x] 4.6 Gate: `npm test`, `npm run lint` e `npm run test:design` verdes

## 5. Conjuração

- [x] 5.1 `shared/`: `spellcastingAbility`, `spellBonus`, `spellSlotTotals`/`spellSlots`, `spells`, `spellSaveDc`, `spellAttackBonus` e validação (círculos, tetos, gastos ≤ total), com testes unitários
- [x] 5.2 Colunas incluídas na migração única da tarefa 2.2
- [x] 5.3 Servidor: parser, espaços gastos no `PATCH .../state`, edição ajustando gastos ao total, rolagem `spellAttack` recusada sem atributo; testes de integração (incluindo RBAC da rolagem)
- [x] 5.4 Stories: `SpellcastingHeader`, `SpellSlots` (dono gastando, consulta), `SpellList` (vazia, longa, C/R/M)
- [x] 5.5 Integração: aba Magias da consulta e do editor; rótulo de ataque mágico no feed
- [x] 5.6 Gate: `npm test`, `npm run lint` e `npm run test:design` verdes

## 6. Inventário e história

- [x] 6.1 `shared/`: `appearance`, `languages`, `equipment`, `attunedItems` (até 3), `coins` e validação, com testes unitários
- [x] 6.2 Colunas incluídas na migração única da tarefa 2.2
- [x] 6.3 Servidor: parser, moedas no `PATCH .../state`; testes de integração (quatro itens sintonizados recusados, moedas negativas recusadas)
- [x] 6.4 Stories: `CoinPurse` (dono, consulta), `AttunedItems`
- [x] 6.5 Integração: aba Inventário e história da consulta e do editor
- [x] 6.6 Gate: `npm test`, `npm run lint` e `npm run test:design` verdes

## 7. Verificação final

- [x] 7.1 Story de composição com o personagem do PDF (Hazin Dan) nas três abas, dono e consulta, comparada à ficha oficial
- [x] 7.2 Atualizar o seed com os campos novos
- [x] 7.3 `npm run lint`, `npm run typecheck`, `npm test`, `npm run build` e `npm run test:design` verdes
- [ ] 7.4 `verify:app` e `verify:group` contra o app rodando
- [x] 7.5 Atualizar `docs/design-system.md` com os componentes novos e a contagem de verificações
