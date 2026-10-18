# official-character-sheet

> Registro histórico, escrito originalmente como change do OpenSpec (criado em 2026-09-13).
> Status em 2026-10-18: implementado (falta só a verificação contra o app rodando). O estado atual do produto está em
> [`../roadmap.md`](../roadmap.md) e a arquitetura em [`../architecture.md`](../architecture.md).

## Proposta

### Why

A ficha da plataforma cobre só o núcleo do 5e (atributos, perícias treinadas,
PV, CA, ataques e características), enquanto a mesa preenche a ficha oficial de
D&D 2024: duas páginas com identidade, combate, especialização, treinamento em
equipamentos, conjuração, inventário e personalidade (exemplo real em
`rpg_docs/Ficha_Hazin_Dan(Daniel).pdf`). O jogador mantém o PDF ao lado da
plataforma, e tudo que só existe no PDF fica fora das rolagens calculadas no
servidor. Alinhar a ficha à oficial faz da plataforma a única fonte da ficha,
no vocabulário que a mesa já usa.

**Por que construir em vez de usar uma ferramenta gratuita:** PDFs preenchíveis
e fichas de sites externos não se conectam às rolagens autorizadas no servidor
nem ao feed da campanha. A ficha precisa ser dado da plataforma para que
iniciativa, perícias com especialização e ataque mágico rolem com os valores
reais do personagem.

### What Changes

- **Identidade:** antecedente, subclasse, XP, alinhamento e tamanho. Na
  interface, "Raça" passa a se chamar "Espécie", como na ficha de 2024.
- **Combate:** PV atual, temporário e máximo; dado de vida (tipo e gastos);
  salvaguardas contra morte; escudo em uso; inspiração heroica; deslocamento.
- **Valores derivados, calculados em `shared/` com ajuste opcional:**
  iniciativa, percepção passiva, CD de magia e ataque mágico. O bônus de
  proficiência continua derivado do nível.
- **Perícias com especialização:** cada perícia pode ser nenhuma, proficiente
  ou especialista (dobro do bônus de proficiência), refletido na rolagem.
- **Treinamento em equipamentos:** armaduras (leve, média, pesada, escudos),
  armas e ferramentas.
- **Ataques** ganham tipo de dano e notas.
- **Traços de espécie e talentos** separados das características de classe.
- **Conjuração:** atributo de conjuração, espaços de magia por círculo (total e
  gastos) e lista de truques e magias preparadas com círculo, tempo de
  conjuração, alcance, concentração/ritual/material e notas.
- **Inventário e personalidade:** aparência, história e personalidade (a
  descrição atual), idiomas, equipamento, até três itens mágicos sintonizados e
  moedas (PC, PP, PE, PO, PL).
- **Estado de sessão sem abrir o editor:** novo
  `PATCH /campaigns/:id/characters/:characterId/state`, só do dono, para PV
  atual e temporário, dados de vida gastos, salvaguardas contra morte,
  inspiração heroica, espaços gastos e moedas.
- **Rolagens linkadas novas:** iniciativa e ataque mágico.
- **Resumo da lista** mostra PV atual sobre o máximo.
- **Storybook-first:** a consulta e o editor passam a seguir a organização da
  ficha oficial, com componentes novos nascendo como story.

Os campos novos são opcionais na entrada da API, com valores padrão
documentados; fichas e clientes existentes continuam válidos. Nenhuma mudança é
**BREAKING**.

### Capabilities

#### New Capabilities

Nenhuma: a ficha oficial amplia capacidades que já existem.

#### Modified Capabilities

- `characters`: a ficha passa a registrar identidade, combate, estado de
  sessão, especialização, treinamento em equipamentos, conjuração, inventário e
  personalidade da ficha oficial; o estado de sessão ganha alteração própria,
  só do dono.
- `dice-rolling`: iniciativa e ataque mágico passam a ser rolados pela ficha, e
  perícias com especialização somam o dobro da proficiência.
- `design-foundation`: consulta e editor da ficha organizados como a ficha
  oficial, com controles rápidos de estado e componentes novos com stories.

### Impact

- `shared/`: `CharacterSheet`, `CharacterInput`, `CharacterSummary`, `Attack`,
  `LinkedRollRequest` e `RollPayload` ampliados; novo `CharacterStateInput`;
  regras derivadas (iniciativa, percepção passiva, CD e ataque mágico, bônus de
  perícia com especialização) e limites compartilhados, com testes unitários.
- `db/`: novas colunas em `characters`, por migração versionada que preserva as
  fichas existentes (PV atual igual ao máximo).
- `server/`: parser e seleção da ficha, rota de estado com RBAC, rolagens de
  iniciativa e ataque mágico, especialização na perícia; testes de integração.
- `client/`: `CharacterSheetView`, `CharacterSheetDialog`, `CharacterForm`,
  `CharacterRow`, `AttackCard`, `AbilityCard` e componentes novos com stories;
  rótulos em `lib/5e.ts`; seed de desenvolvimento.
- Sem dependência nova.

### Non-goals

- Multiclasse (mais de uma classe e tipos de dado de vida misturados).
- Motor de regras automático: calcular CA pela armadura, PV e espaços de magia
  pela tabela da classe, ou aplicar efeitos de talentos, traços e itens.
- Compêndio de magias, itens ou talentos (busca no SRD).
- Descansos automatizados (curto e longo) e resolução automática das
  salvaguardas contra morte.
- Mestre alterando a ficha ou o estado de sessão de outro personagem.
- Propagar em tempo real para os outros membros a mudança de estado de uma
  ficha; eles veem o valor novo ao reabrir ou atualizar a lista.
- Importar ou exportar a ficha oficial em PDF.

## Design

### Context

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

### Goals / Non-Goals

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

### Decisions

#### 1. Contrato plano e aditivo, com padrões documentados

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

#### 2. Estado de sessão por rota própria

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

#### 3. Regras derivadas e limites em `shared/`

Novo módulo puro com testes unitários: `skillBonus` (nenhuma, proficiente ou
especialista), `saveBonus`, `initiative`, `passivePerception`, `spellSaveDc`,
`spellAttackBonus`, `applyDamage` e `applyHealing`. O servidor usa as mesmas
funções nas rolagens e o cliente na exibição, eliminando o cálculo duplicado
hoje em `CharacterSheetView` e `parseLinkedRoll`.

Os limites numéricos e de tamanho viram constantes exportadas
(`CHARACTER_LIMITS`), usadas pelo parser do servidor e por
`validateCharacterInput`, para que as duas validações não divirjam.

#### 4. Armazenamento: colunas escalares e JSON para listas

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

#### 5. Rolagens: iniciativa e ataque mágico

`LinkedRollRequest.kind` ganha `initiative` e `spellAttack`, e
`RollPayload.rollKind` ganha os mesmos valores. Iniciativa usa `initiative()`;
ataque mágico usa `spellAttackBonus()` e é recusado sem atributo de conjuração.
A perícia passa a usar `skillBonus()`, o que aplica a especialização. Os modos
normal, vantagem e desvantagem valem para as duas rolagens novas (sempre um
d20). O envelope do socket não muda; o `FeedEventCard` só ganha os rótulos.

#### 6. Interface organizada como a ficha oficial

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

### Risks / Trade-offs

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

### Migration Plan

1. Uma migração (`npm run db:generate`) com todas as colunas, revisada à mão para
   precisa preencher dados existentes.
2. `npm run db:migrate` aplica em ordem; o servidor não exige passo extra.
3. Rollback: as colunas novas são aditivas; voltar o código mantém o banco
   legível pelo código anterior, que ignora colunas desconhecidas.

### Open Questions

- Deslocamento em metros (como a ficha em português) atende a mesa, ou é preciso
  mostrar também em pés? Padrão proposto: só metros.

## Requisitos

### characters

#### ADDED Requirements

##### Requirement: Identidade conforme a ficha oficial
O sistema SHALL registrar na ficha, além de nome, espécie, classe e nível, o antecedente, a subclasse, os pontos de experiência, o alinhamento e o tamanho do personagem.

###### Scenario: Criação com a identidade completa
- **WHEN** um membro cria um personagem informando antecedente, subclasse, XP, alinhamento e tamanho
- **THEN** a ficha é criada com esses valores e os exibe na consulta

###### Scenario: Identidade parcial
- **WHEN** um membro cria um personagem sem antecedente, subclasse ou alinhamento
- **THEN** a ficha é aceita com esses campos vazios, XP zero e tamanho Médio

###### Scenario: XP fora dos limites
- **WHEN** a ficha informa XP negativo ou acima do máximo aceito
- **THEN** o sistema recusa a ficha com mensagem de erro

##### Requirement: Pontos de vida atual, temporário e máximo
O sistema SHALL registrar PV máximo, PV atual e PV temporários, mantendo o PV atual entre zero e o máximo.

###### Scenario: Criação começa com vida cheia
- **WHEN** um membro cria um personagem com PV máximo informado
- **THEN** o PV atual começa igual ao máximo e os PV temporários começam em zero

###### Scenario: Máximo reduzido abaixo do atual
- **WHEN** o dono edita a ficha e informa um PV máximo menor que o PV atual
- **THEN** o PV atual passa a ser igual ao novo máximo

###### Scenario: Resumo com vida atual
- **WHEN** um membro abre a lista de personagens da campanha
- **THEN** cada linha exibe o PV atual sobre o PV máximo e a CA

##### Requirement: Estado de sessão alterado só pelo dono
O sistema SHALL permitir que apenas o dono altere o estado de sessão do personagem (PV atual e temporários, dados de vida gastos, salvaguardas contra morte, inspiração heroica, espaços de magia gastos e moedas) sem reenviar a ficha completa.

###### Scenario: Dono registra dano
- **WHEN** o dono informa um novo PV atual dentro dos limites
- **THEN** o estado é salvo e os demais campos da ficha permanecem inalterados

###### Scenario: Outro membro tenta alterar o estado
- **WHEN** outro membro, incluindo o mestre, tenta alterar o estado de sessão do personagem
- **THEN** o sistema recusa a operação e nada é alterado

###### Scenario: Estado fora dos limites
- **WHEN** o estado informa PV atual acima do máximo, dados de vida gastos acima do nível, mais de três sucessos ou falhas contra a morte, espaços gastos acima do total ou moedas negativas
- **THEN** o sistema recusa a alteração com mensagem de erro

##### Requirement: Dados de vida e salvaguardas contra morte
O sistema SHALL registrar o tipo do dado de vida do personagem, com máximo igual ao nível, os dados gastos, e até três sucessos e três falhas nas salvaguardas contra morte.

###### Scenario: Dados de vida disponíveis
- **WHEN** um personagem de nível 4 com d12 como dado de vida gastou 1 dado
- **THEN** a ficha exibe 1 dado gasto de 4 dados d12

###### Scenario: Tipo de dado inválido
- **WHEN** a ficha informa um dado de vida diferente de d6, d8, d10 ou d12
- **THEN** o sistema recusa a ficha com mensagem de erro

##### Requirement: Valores derivados com ajuste opcional
O sistema SHALL calcular a iniciativa como o modificador de Destreza mais um ajuste, e a percepção passiva como 10 mais o bônus de Percepção mais um ajuste, recalculando ambos quando atributos, nível ou perícias mudam.

###### Scenario: Iniciativa derivada
- **WHEN** um personagem tem Destreza 14 e ajuste de iniciativa zero
- **THEN** a ficha exibe iniciativa +2

###### Scenario: Ajuste de talento
- **WHEN** o dono informa ajuste de iniciativa +4 para um personagem com Destreza 14
- **THEN** a ficha exibe iniciativa +6

###### Scenario: Percepção passiva derivada
- **WHEN** um personagem tem Sabedoria 12, não é proficiente em Percepção e não tem ajuste
- **THEN** a ficha exibe percepção passiva 11

##### Requirement: Perícias com especialização
O sistema SHALL permitir marcar cada perícia como não proficiente, proficiente ou especialista, somando ao modificador do atributo nenhum, uma vez ou duas vezes o bônus de proficiência.

###### Scenario: Perícia especialista
- **WHEN** um personagem de nível 3 com Destreza 18 é especialista em Furtividade
- **THEN** a ficha exibe Furtividade +8

###### Scenario: Especialização sem proficiência
- **WHEN** a ficha marca especialização em uma perícia em que o personagem não é proficiente
- **THEN** o sistema recusa a ficha com mensagem de erro

##### Requirement: Treinamento em equipamentos
O sistema SHALL registrar o treinamento em armaduras (leve, média, pesada e escudos), as armas e as ferramentas em que o personagem é proficiente, e se o personagem está usando escudo.

###### Scenario: Treinamento registrado
- **WHEN** o dono marca armaduras leve e média e escudos, e informa as armas e ferramentas
- **THEN** a consulta exibe o treinamento exatamente como informado

##### Requirement: Ataques com tipo de dano e notas
O sistema SHALL registrar em cada ataque, além de nome, bônus e dano, o tipo de dano e notas livres.

###### Scenario: Ataque completo
- **WHEN** o dono registra um ataque com tipo de dano "Cortante" e nota "Pesada, duas mãos"
- **THEN** a consulta exibe o ataque com o tipo e a nota

###### Scenario: Ataque sem tipo
- **WHEN** o dono registra um ataque sem tipo de dano e sem notas
- **THEN** o ataque é aceito com esses campos vazios

##### Requirement: Características de classe, traços de espécie e talentos
O sistema SHALL registrar características de classe, traços de espécie e talentos como listas separadas.

###### Scenario: Listas separadas
- **WHEN** o dono informa características de classe, traços de espécie e talentos
- **THEN** a consulta exibe cada lista na sua seção

##### Requirement: Conjuração
O sistema SHALL registrar o atributo de conjuração, os espaços de magia de cada círculo (total e gastos) e a lista de truques e magias preparadas, calculando a CD para evitar a magia como 8 + bônus de proficiência + modificador do atributo + ajuste, e o modificador de ataque mágico como bônus de proficiência + modificador do atributo + ajuste.

###### Scenario: CD e ataque derivados
- **WHEN** um personagem de nível 4 com Sabedoria 16 conjura com Sabedoria e não tem ajuste
- **THEN** a ficha exibe CD 13 e ataque mágico +5

###### Scenario: Personagem que não conjura
- **WHEN** a ficha não tem atributo de conjuração
- **THEN** a ficha não exibe CD nem ataque mágico e não oferece rolar ataque mágico

###### Scenario: Magia registrada
- **WHEN** o dono registra uma magia com círculo, nome, tempo de conjuração, alcance, concentração, ritual, material e notas
- **THEN** a consulta exibe a magia na lista com todos esses dados

###### Scenario: Espaços de magia inválidos
- **WHEN** a ficha informa círculo de magia fora de 0 a 9, total de espaços negativo ou acima do limite do círculo
- **THEN** o sistema recusa a ficha com mensagem de erro

##### Requirement: Inventário e personalidade
O sistema SHALL registrar aparência, história e personalidade, idiomas, equipamento, até três itens mágicos sintonizados e moedas (PC, PP, PE, PO e PL).

###### Scenario: Inventário registrado
- **WHEN** o dono informa idiomas, equipamento, dois itens sintonizados e 122 PO
- **THEN** a consulta exibe esses dados

###### Scenario: Sintonização acima do limite
- **WHEN** a ficha informa quatro itens sintonizados
- **THEN** o sistema recusa a ficha com mensagem de erro

##### Requirement: Fichas existentes preservadas
O sistema SHALL manter válidas as fichas criadas antes da ficha oficial, preenchendo os campos novos com valores padrão.

###### Scenario: Ficha antiga após a atualização
- **WHEN** um membro abre uma ficha criada antes da ficha oficial
- **THEN** a ficha abre com PV atual igual ao máximo, dado de vida d8, tamanho Médio, campos de texto vazios e sem conjuração

### design-foundation

#### ADDED Requirements

##### Requirement: Ficha organizada como a ficha oficial
O sistema SHALL apresentar a consulta da ficha na organização da ficha oficial de D&D 2024: identidade e combate no topo, cada atributo com a sua salvaguarda e as suas perícias, ataques, características, e uma área separada para conjuração e outra para inventário e personalidade.

###### Scenario: Perícias sob o atributo
- **WHEN** um membro abre a ficha de um personagem
- **THEN** cada atributo exibe valor, modificador, salvaguarda e as perícias que dependem dele, com a marcação de proficiência ou especialização

###### Scenario: Áreas da segunda página
- **WHEN** um membro navega para conjuração ou para inventário e personalidade
- **THEN** a ficha exibe essa área sem perder a identificação do personagem

##### Requirement: Controles rápidos de estado na consulta
O sistema SHALL oferecer ao dono, na consulta da ficha, controles para registrar dano, cura e PV temporários, dados de vida gastos, salvaguardas contra morte, inspiração heroica, espaços de magia gastos e moedas, sem abrir o editor; aos demais membros esses valores aparecem apenas para leitura.

###### Scenario: Dano registrado na consulta
- **WHEN** o dono registra 7 de dano em um personagem com 5 PV temporários e 30 PV atuais
- **THEN** os PV temporários vão a zero, o PV atual vai a 28 e a ficha mostra os novos valores

###### Scenario: Consulta por outro membro
- **WHEN** outro membro abre a ficha
- **THEN** ele vê os valores de estado sem controles para alterá-los

##### Requirement: Editor da ficha por seções
O sistema SHALL organizar o editor da ficha nas mesmas seções da ficha oficial, sinalizando a seção que contém erro de validação e levando o foco ao primeiro campo inválido.

###### Scenario: Erro em seção não visível
- **WHEN** o usuário salva a ficha com um erro em uma seção diferente da que está aberta
- **THEN** a seção com erro é sinalizada, passa a ser exibida e o foco vai para o primeiro campo inválido

###### Scenario: Mesma organização na criação e na edição
- **WHEN** o editor é aberto para criar ou para editar um personagem
- **THEN** ele apresenta as mesmas seções, na mesma ordem

### dice-rolling

#### ADDED Requirements

##### Requirement: Iniciativa rolada pela ficha
O sistema SHALL permitir que o dono role a iniciativa a partir da ficha, somando ao d20 a iniciativa derivada do personagem, com modo normal, vantagem ou desvantagem, e publicando o resultado no feed.

###### Scenario: Iniciativa com vantagem
- **WHEN** o dono rola iniciativa com vantagem para um personagem com iniciativa +2
- **THEN** o servidor lança dois d20, considera o maior, soma 2 e publica o resultado identificando o personagem e a iniciativa

###### Scenario: Iniciativa por outro membro
- **WHEN** outro membro, incluindo o mestre, tenta rolar a iniciativa de um personagem
- **THEN** o sistema recusa a rolagem e nada é publicado no feed

##### Requirement: Ataque mágico rolado pela ficha
O sistema SHALL permitir que o dono role um ataque mágico a partir da ficha, somando ao d20 o modificador de ataque mágico derivado, apenas para personagens com atributo de conjuração.

###### Scenario: Ataque mágico
- **WHEN** o dono rola um ataque mágico para um personagem com ataque mágico +5
- **THEN** o servidor soma 5 ao d20 e publica o resultado identificando o personagem e o ataque mágico

###### Scenario: Personagem sem conjuração
- **WHEN** o dono tenta rolar um ataque mágico para um personagem sem atributo de conjuração
- **THEN** o sistema recusa a rolagem com mensagem de erro e nada é publicado no feed

##### Requirement: Especialização aplicada à rolagem de perícia
O sistema SHALL somar duas vezes o bônus de proficiência ao rolar uma perícia em que o personagem é especialista.

###### Scenario: Perícia especialista rolada
- **WHEN** o dono rola Furtividade para um personagem de nível 3 com Destreza 18 especialista em Furtividade
- **THEN** o servidor rola 1d20+8 e publica o resultado no feed

## Tarefas

## Tasks — official-character-sheet

Cada fase entrega uma parte da ficha oficial usável numa sessão real, de ponta a
ponta: regra em `shared/`, migração, servidor com testes, componentes no
Storybook e integração na consulta e no editor.

### 1. Fundação: abas e limites compartilhados

- [x] 1.1 Extrair `CHARACTER_LIMITS` para `shared/` e usá-lo no parser do servidor e em `validateCharacterInput`, sem mudar comportamento (testes atuais verdes)
- [x] 1.2 Criar módulo de regras derivadas em `shared/` (`skillBonus`, `saveBonus`) com testes unitários e usá-lo em `parseLinkedRoll` e em `CharacterSheetView`
- [x] 1.3 `SheetTabs` (padrão WAI-ARIA, setas do teclado, marcação de erro por aba) + story
- [x] 1.4 Reorganizar consulta (Personagem, Magias, Inventário e história) e editor (cinco seções) em abas com os campos atuais; primeira aba com erro aberta num envio recusado
- [x] 1.5 Trocar o rótulo "Raça" por "Espécie" no cliente e no `verify-group`
- [x] 1.6 Gate: `npm test`, `npm run lint` e `npm run test:design` verdes

### 2. Identidade e combate

- [x] 2.1 `shared/`: tipos de identidade, combate e estado (`subclass`, `background`, `alignment`, `experience`, `size`, `speed`, `shield`, `hitDie`, `initiativeBonus`, `passivePerceptionBonus`, `hpCurrent`, `hpTemp`, `hitDiceSpent`, `deathSaves`, `heroicInspiration`), `CharacterStateInput`, `initiative`, `passivePerception`, `applyDamage`, `applyHealing` e validação, com testes unitários
- [x] 2.2 Migração única com todas as colunas da ficha oficial (fases 2 a 6) e `UPDATE characters SET hp_current = hp`
- [x] 2.3 Servidor: parser com padrões, criação com PV cheio, edição ajustando o estado aos máximos, `PATCH .../state` só do dono, resumo com `hpCurrent`/`hpTemp`, rolagem `initiative`
- [x] 2.4 Testes de integração: estado alterado pelo dono, estado recusado ao mestre e a outro jogador (RBAC), limites do estado, ficha antiga após a migração, edição reduzindo o PV máximo, iniciativa só do dono
- [x] 2.5 Stories: `SheetIdentity`, `HitPointsTracker`, `HitDiceTracker`, `DeathSaves`, `HeroicInspiration`, `DerivedStats` (dono, consulta, zerado, valores extremos)
- [x] 2.6 Integração: cabeçalho e faixa de combate na consulta com mutação de estado em `CharacterSheetDialog`; campos na aba Identidade e combate do editor; `CharacterRow` com PV atual/máximo; rótulo de iniciativa no feed
- [x] 2.7 Gate: `npm test`, `npm run typecheck`, `npm run lint` e `npm run test:design` verdes

### 3. Atributos, perícias e treinamento

- [x] 3.1 `shared/`: `expertise` (subconjunto de `skills`), `armorTraining`, `weaponProficiencies`, `toolProficiencies`; `skillBonus` com especialização e validação, com testes unitários
- [x] 3.2 Colunas incluídas na migração única da tarefa 2.2
- [x] 3.3 Servidor: parser (especialização sem proficiência recusada) e rolagem de perícia com especialização; testes de integração
- [x] 3.4 Stories: `AbilityBlock` (perícias sob o atributo, proficiente e especialista, rolável e consulta), `ProficiencyToggle`, `EquipmentTraining`
- [x] 3.5 Integração: atributos da consulta com `AbilityBlock`; aba Atributos e perícias do editor com `ProficiencyToggle` e treinamento
- [x] 3.6 Gate: `npm test`, `npm run lint` e `npm run test:design` verdes

### 4. Ataques e características

- [x] 4.1 `shared/`: `Attack.damageType`, `Attack.notes`, `speciesTraits`, `feats` e validação, com testes unitários
- [x] 4.2 Colunas incluídas na migração única da tarefa 2.2
- [x] 4.3 Servidor: parser com padrões para ataques antigos; testes de integração
- [x] 4.4 Stories: `AttackCard` com tipo e notas, `TraitList` (vazia, longa)
- [x] 4.5 Integração: aba Ataques e características do editor e seções da consulta
- [x] 4.6 Gate: `npm test`, `npm run lint` e `npm run test:design` verdes

### 5. Conjuração

- [x] 5.1 `shared/`: `spellcastingAbility`, `spellBonus`, `spellSlotTotals`/`spellSlots`, `spells`, `spellSaveDc`, `spellAttackBonus` e validação (círculos, tetos, gastos ≤ total), com testes unitários
- [x] 5.2 Colunas incluídas na migração única da tarefa 2.2
- [x] 5.3 Servidor: parser, espaços gastos no `PATCH .../state`, edição ajustando gastos ao total, rolagem `spellAttack` recusada sem atributo; testes de integração (incluindo RBAC da rolagem)
- [x] 5.4 Stories: `SpellcastingHeader`, `SpellSlots` (dono gastando, consulta), `SpellList` (vazia, longa, C/R/M)
- [x] 5.5 Integração: aba Magias da consulta e do editor; rótulo de ataque mágico no feed
- [x] 5.6 Gate: `npm test`, `npm run lint` e `npm run test:design` verdes

### 6. Inventário e história

- [x] 6.1 `shared/`: `appearance`, `languages`, `equipment`, `attunedItems` (até 3), `coins` e validação, com testes unitários
- [x] 6.2 Colunas incluídas na migração única da tarefa 2.2
- [x] 6.3 Servidor: parser, moedas no `PATCH .../state`; testes de integração (quatro itens sintonizados recusados, moedas negativas recusadas)
- [x] 6.4 Stories: `CoinPurse` (dono, consulta), `AttunedItems`
- [x] 6.5 Integração: aba Inventário e história da consulta e do editor
- [x] 6.6 Gate: `npm test`, `npm run lint` e `npm run test:design` verdes

### 7. Verificação final

- [x] 7.1 Story de composição com o personagem do PDF (Hazin Dan) nas três abas, dono e consulta, comparada à ficha oficial
- [x] 7.2 Atualizar o seed com os campos novos
- [x] 7.3 `npm run lint`, `npm run typecheck`, `npm test`, `npm run build` e `npm run test:design` verdes
- [ ] 7.4 `verify:app` e `verify:group` contra o app rodando
- [x] 7.5 Atualizar `docs/design-system.md` com os componentes novos e a contagem de verificações
