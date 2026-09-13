## Context

A ficha atual (`CharacterSheet`) guarda nome, raça, classe, nível, atributos,
`hp`, `ac`, perícias treinadas, salvaguardas proficientes, ataques
(`name`/`bonus`/`damage`), características e descrição. As rolagens linkadas
(ataque, teste, salvaguarda e perícia) são calculadas no servidor a partir
desses valores. A mesa usa a ficha oficial de D&D 2024 (duas páginas; exemplo em
`rpg_docs/Ficha_Hazin_Dan(Daniel).pdf`), que cobre identidade, combate, estado de
sessão, especialização, treinamento em equipamentos, conjuração, inventário e
personalidade.

Decisões de produto já tomadas com o usuário:

- Conjuração entra neste change.
- Estado de sessão fica na ficha e só o dono altera, por controles rápidos na
  consulta.
- Valores derivados são calculados, com ajuste opcional para talentos e itens.
- Perícias suportam especialização.

Fronteiras fixas do projeto: o cliente nunca é fonte de verdade; lógica 5e pura
vive em `shared/` com testes; texto visível em pt-BR e código em inglês;
componentes nascem no Storybook antes de integrar às telas; sem dependência
nova.

## Goals / Non-Goals

**Goals:**

- Cobrir todos os campos da ficha oficial de 2024, no vocabulário da ficha.
- Manter as rolagens linkadas coerentes com a ficha: especialização, iniciativa
  e ataque mágico calculados no servidor pelas mesmas regras exibidas.
- Permitir o acompanhamento da sessão (PV, dados de vida, salvaguardas contra
  morte, inspiração, espaços gastos, moedas) sem abrir o editor.
- Preservar as fichas existentes sem intervenção manual.

**Non-Goals:**

- Multiclasse, motor de regras automático (CA pela armadura, PV e espaços pela
  tabela da classe, efeitos de talentos/traços/itens), compêndio SRD,
  descansos automatizados, resolução automática das salvaguardas contra morte,
  mestre alterando fichas alheias, propagação em tempo real do estado da ficha e
  importação/exportação de PDF.

## Decisions

### 1. Contrato plano e aditivo, com padrões documentados

`CharacterSheet` e `CharacterInput` ganham campos no mesmo nível dos atuais, em
vez de um objeto aninhado por página. Os campos novos são **opcionais em
`CharacterInput`** e o parser do servidor aplica padrões quando ausentes; o
editor sempre envia todos. Assim clientes, testes e o seed atuais continuam
válidos e o change não é BREAKING.

Campos novos (nomes em inglês, rótulos em pt-BR no cliente):

| Área | Campo | Tipo e limites | Padrão |
|---|---|---|---|
| Identidade | `subclass`, `background`, `alignment` | texto até 60 | `''` |
| | `experience` | inteiro 0–355000 | `0` |
| | `size` | `tiny`/`small`/`medium`/`large`/`huge`/`gargantuan` | `medium` |
| Combate | `speed` | metros, 0–60, uma casa decimal | `9` |
| | `shield` | booleano | `false` |
| | `hitDie` | `6`/`8`/`10`/`12` | `8` |
| | `initiativeBonus`, `passivePerceptionBonus` | inteiro −10–10 | `0` |
| Perícias | `expertise` | `Skill[]`, subconjunto de `skills` | `[]` |
| Treinamento | `armorTraining` | subconjunto de `light`/`medium`/`heavy`/`shields` | `[]` |
| | `weaponProficiencies`, `toolProficiencies` | texto até 200 | `''` |
| Ataques | `Attack.damageType` | texto até 30 | `''` |
| | `Attack.notes` | texto até 120 | `''` |
| Características | `speciesTraits`, `feats` | até 30 itens de até 200 | `[]` |
| Conjuração | `spellcastingAbility` | `Ability` ou `null` | `null` |
| | `spellBonus` | inteiro −10–10 | `0` |
| | `spellSlotTotals` | 9 inteiros, teto por círculo 4,3,3,3,3,2,2,1,1 | zeros |
| | `spells` | até 60 `{ level 0–9, name ≤80, castingTime ≤30, range ≤30, concentration, ritual, material, notes ≤120 }` | `[]` |
| Inventário | `appearance` | texto até 1000 | `''` |
| | `languages` | texto até 200 | `''` |
| | `equipment` | texto até 2000 | `''` |
| | `attunedItems` | até 3 textos de até 80 | `[]` |
| | `coins` | `{ cp, sp, ep, gp, pp }` inteiros 0–999999 | zeros |

Mantidos com novo papel: `race` continua o campo, com rótulo "Espécie";
`hp` continua sendo o PV máximo; `features` são as características de classe;
`description` é "História e personalidade".

Estado de sessão, exposto em `CharacterSheet` e alterado por rota própria:
`hpCurrent` (0–`hp`), `hpTemp` (0–999), `hitDiceSpent` (0–`level`),
`deathSaves: { successes 0–3, failures 0–3 }`, `heroicInspiration`,
`spellSlots: { total, spent }[9]` (gastos 0–total) e `coins`.

**Alternativa considerada:** renomear `race` para `species` e `hp` para
`hpMax`. Rejeitada: o ganho é só de nome, e a troca passa por banco, contrato,
servidor, cliente, testes e seed sem mudar comportamento. O vocabulário de 2024
fica na interface.

### 2. Estado de sessão por rota própria

`PATCH /campaigns/:id/characters/:characterId/state` recebe
`CharacterStateInput` parcial (`hpCurrent`, `hpTemp`, `hitDiceSpent`,
`deathSaves`, `heroicInspiration`, `spellSlotsSpent`, `coins`), só do dono, e
valida contra os máximos atuais da ficha. A edição completa não recebe estado:
na criação o PV atual começa no máximo e o resto em zero; na edição o servidor
ajusta o estado aos novos máximos (PV atual ≤ `hp`, dados gastos ≤ `level`,
espaços gastos ≤ total). Moedas são a exceção: entram na criação e na edição
(ouro inicial) e também no estado.

O cliente calcula dano e cura com funções puras de `shared/` (PV temporários
absorvem dano primeiro; cura não passa do máximo) e envia os valores
absolutos resultantes; o servidor só valida os limites.

**Alternativas consideradas:** (a) reenviar a ficha completa a cada dano:
rejeitada, porque um controle rápido não deve depender do formulário inteiro
nem sobrescrever uma edição em outra aba; (b) enviar deltas ("−7 PV"):
rejeitada por ora, porque o estado não é autoridade de jogo (não há combate no
servidor) e valores absolutos tornam a operação idempotente.

### 3. Regras derivadas e limites em `shared/`

Novo módulo puro com testes unitários: `skillBonus` (nenhuma, proficiente ou
especialista), `saveBonus`, `initiative`, `passivePerception`, `spellSaveDc`,
`spellAttackBonus`, `applyDamage` e `applyHealing`. O servidor usa as mesmas
funções nas rolagens e o cliente na exibição, eliminando o cálculo duplicado
hoje em `CharacterSheetView` e `parseLinkedRoll`.

Os limites numéricos e de tamanho viram constantes exportadas
(`CHARACTER_LIMITS`), usadas pelo parser do servidor e por
`validateCharacterInput`, para que as duas validações não divirjam.

### 4. Armazenamento: colunas escalares e JSON para listas

Escalares ganham colunas próprias em `characters` (como `hp` e `ac` hoje);
listas e estruturas (`expertise`, `armor_training`, `species_traits`, `feats`,
`spell_slots`, `spells`, `attuned_items`, `coins`, `death_saves`) usam colunas
JSON, como `skills` e `attacks`. Toda coluna nova é `NOT NULL` com `DEFAULT`, o
que o SQLite aceita em `ALTER TABLE ADD COLUMN`.

Uma única migração, gerada pelo `drizzle-kit`, com todas as colunas (a implementação cobre as fases de uma vez, então migrações por fase só adicionariam passos). Ela
recebe à mão `UPDATE characters SET hp_current = hp`, porque um `DEFAULT` não
pode referenciar outra coluna; é o que garante "fichas existentes com vida
cheia".

**Alternativa considerada:** uma única coluna JSON `details` com tudo o que é
novo. Rejeitada: foge do padrão da tabela e esconde do banco valores que o
resumo lê (PV atual).

### 5. Rolagens: iniciativa e ataque mágico

`LinkedRollRequest.kind` ganha `initiative` e `spellAttack`, e
`RollPayload.rollKind` ganha os mesmos valores. Iniciativa usa `initiative()`;
ataque mágico usa `spellAttackBonus()` e é recusado sem atributo de conjuração.
A perícia passa a usar `skillBonus()`, o que aplica a especialização. Os modos
normal, vantagem e desvantagem valem para as duas rolagens novas (sempre um
d20). O envelope do socket não muda; o `FeedEventCard` só ganha os rótulos.

### 6. Interface organizada como a ficha oficial

A consulta (`CharacterSheetView`) ganha abas acessíveis, construídas no projeto
com o padrão WAI-ARIA de tabs (sem dependência nova): **Personagem** (página 1),
**Magias** e **Inventário e história** (página 2). O cabeçalho de identidade e a
faixa de combate ficam fora das abas, sempre visíveis.

Componentes novos, todos Storybook-first e presentacionais:

- `SheetTabs`: abas com setas do teclado, `aria-selected`, e marcação de erro
  por aba no editor.
- `SheetIdentity`: nome, antecedente, espécie, classe, subclasse, nível e XP.
- `CombatStrip`: CA com escudo, `HitPointsTracker` (atual, temporário, máximo;
  dano, cura e temporários para o dono), `HitDiceTracker`, `DeathSaves` e
  `HeroicInspiration`.
- `DerivedStats`: proficiência, iniciativa (rolável), deslocamento, tamanho e
  percepção passiva.
- `AbilityBlock`: substitui o `AbilityCard` na ficha, com valor, modificador,
  salvaguarda e as perícias do atributo (marcador de proficiência ou
  especialização, rolável pelo dono), como na ficha oficial.
- `ProficiencyToggle`: nenhuma, proficiente ou especialista, como grupo de rádio
  compacto, usado no editor.
- `EquipmentTraining`, `TraitList` (características, traços, talentos),
  `AttackCard` ampliado (tipo e notas).
- `SpellcastingHeader` (atributo, modificador, CD e ataque mágico rolável),
  `SpellSlots` (pips de gastos por círculo), `SpellList`.
- `CoinPurse` e `AttunedItems`.

O editor (`CharacterForm`) usa as mesmas abas, na ordem da ficha: **Identidade e
combate**, **Atributos e perícias**, **Ataques e características**, **Magias**,
**Inventário e história**. Num envio recusado, a primeira aba com erro é aberta
e o foco vai ao primeiro campo inválido (o mecanismo atual de foco é mantido).

Os exemplos das stories reproduzem o personagem do PDF (Hazin Dan, Bárbaro
Berserker de nível 4) para a comparação visual com a ficha oficial.

**Alternativa considerada:** manter a ficha como uma coluna única rolável.
Rejeitada: com a página 2, a consulta passaria de dez telas no celular, e a mesa
procura as seções pela organização da ficha em papel.

## Risks / Trade-offs

- **Formulário muito maior** → abas por seção, estado de erro por aba e foco no
  primeiro inválido; o editor continua um componente só para criação e edição.
- **Duas escritas concorrentes na mesma ficha (editor e estado)** → a edição
  completa não envia estado e o servidor ajusta o estado aos máximos; rotas
  separadas não se sobrescrevem.
- **Estado desatualizado para os outros membros** → aceito nos Non-goals; a lista
  e a ficha são consultas do TanStack Query, recarregadas ao reabrir e ao voltar
  o foco à janela.
- **Migrações com `UPDATE` manual** → testes de integração rodam as migrações
  versionadas em banco em memória, e um teste cobre a ficha criada antes das
  colunas novas.
- **`verify-group` preenche o rótulo "Raça"** → o script é atualizado para
  "Espécie" junto da troca do rótulo.
- **Tetos de espaços de magia fixos** → cobrem a tabela padrão; características
  que excedem o teto ficam fora (Non-goal de motor de regras).

## Migration Plan

1. Uma migração (`npm run db:generate`) com todas as colunas, revisada à mão para
   precisa preencher dados existentes.
2. `npm run db:migrate` aplica em ordem; o servidor não exige passo extra.
3. Rollback: as colunas novas são aditivas; voltar o código mantém o banco
   legível pelo código anterior, que ignora colunas desconhecidas.

## Open Questions

- Deslocamento em metros (como a ficha em português) atende a mesa, ou é preciso
  mostrar também em pés? Padrão proposto: só metros.
