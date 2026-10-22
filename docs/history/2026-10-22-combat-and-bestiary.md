# combat-and-bestiary

> Registro histórico: spec de design da fase 2 (combate e bestiário), aprovada em 2026-10-22.
> Status em 2026-10-22: entrega 1 (base e bestiário) implementada; entregas 2 a 4 pendentes. O estado
> atual do produto está em [`../roadmap.md`](../roadmap.md) e a arquitetura em
> [`../architecture.md`](../architecture.md).

Substitui e detalha a seção `combat-tracker` de
[`2026-09-04-mvp-campaign-management.md`](2026-09-04-mvp-campaign-management.md). Onde as duas
divergem, vale esta — as divergências estão listadas em
[Mudanças em relação ao requisito original](#mudanças-em-relação-ao-requisito-original).

## Objetivo

O mestre roda um combate inteiro dentro do Quest Fast, sem Avrae, sem
redigitar monstros e sem planilha ao lado. Os jogadores acompanham e agem no
próprio combatente pelo app, inclusive no celular.

Critério de sucesso: uma sessão real da campanha com pelo menos um combate
conduzido do começo ao fim no app, sem recorrer a ferramenta externa para
iniciativa, PV ou condições.

### Contexto da decisão

- A mesa quer usar o app na própria campanha o quanto antes, mas prioriza
  acabamento sobre prazo. Ordem acordada: combate completo → spike do VTT →
  VTT (abordagem sequencial).
- O combate é desenhado para o VTT da fase 4 se apoiar nele sem refazer o
  modelo: o token vai referenciar o `Combatant`.

### Fora de escopo

- Mapa, grid, tokens e fog (fase 4).
- Motor de regras: nada é aplicado sozinho além do que está explícito aqui
  (dano consumindo PV temporário, expiração de duração, teste contra a morte
  rolado). Concentração e dano em personagem caído são **lembretes**.
- SRD: o mestre digita os statblocks.
- Descanso curto/longo e gasto de espaço de magia (ações do jogador, depois
  do VTT).

## Modelo de dados

### `statblocks` (bestiário da campanha)

| Campo | Tipo | Observação |
| --- | --- | --- |
| `id`, `campaignId` | text | cascade na campanha |
| `name` | text | |
| `size` | `Size` | reusa `SIZES` de `shared/src/sheet.ts` |
| `creatureType` | text | livre ("Humanoide (goblinoide)") |
| `challengeRating` | text | "1/4", "2"… |
| `ac` | integer | |
| `hpAverage` | integer | PV fixo |
| `hpFormula` | text | opcional, expressão de dados (`2d8+2`), validada por `parseDiceExpression` |
| `speed` | text | livre ("9 m, escalada 6 m") |
| `initiativeBonus` | integer | somado ao mod. de Destreza |
| `abilityScores` | json `AbilityScores` | os 6 atributos |
| `attacks` | json `Attack[]` | reusa o tipo `Attack` da ficha |
| `traits`, `actions`, `reactions` | text | texto livre |
| `createdAt`, `updatedAt` | timestamp | |

### `encounters`

| Campo | Tipo | Observação |
| --- | --- | --- |
| `id`, `campaignId` | text | |
| `name` | text | "Emboscada na estrada" |
| `status` | `'preparing' \| 'active' \| 'ended'` | |
| `round` | integer | 0 em preparação, 1+ ativo |
| `activeCombatantId` | text, nulo | turno atual por identidade, não por posição |
| `version` | integer | incrementa a cada mudança; ordena mensagens no cliente |
| `startedAt`, `endedAt` | timestamp, nulos | |

Índice único parcial: no máximo um encontro `active` por campanha.
Vários `preparing` podem coexistir (o mestre prepara mais de um).

### `combatants`

| Campo | Tipo | Observação |
| --- | --- | --- |
| `id`, `encounterId` | text | `id` estável — é a âncora do token na fase 4 |
| `source` | `'character' \| 'statblock' \| 'manual'` | |
| `characterId` | text, nulo | obrigatório se `source = 'character'` |
| `statblockId` | text, nulo, `set null` | só referência de origem; valores são copiados |
| `name` | text | numerado na adição em lote ("Goblin 2") |
| `size` | `Size` | |
| `ac` | integer, nulo | nulo para personagem (lê da ficha) |
| `hpMax`, `hpCurrent`, `hpTemp` | integer, nulos | nulos para personagem (lê da ficha) |
| `conditions` | json `ActiveCondition[]`, nulo | nulo para personagem (lê da ficha) |
| `concentrating` | boolean, nulo | nulo para personagem (lê da ficha) |
| `dexModifier` | integer | desempate de iniciativa (personagem: copiado da ficha ao entrar) |
| `initiative` | integer, nulo | nulo até rolar/atribuir |
| `tieOrder` | integer | ordem manual do mestre entre empatados |
| `hidden` | boolean | escondido dos jogadores |
| `attacks` | json `Attack[]` | cópia do statblock; vazio para personagem (lê da ficha) |

**Fonte única de verdade para personagens.** Combatente com
`source = 'character'` não guarda PV, CA, condições nem concentração: lê e
grava na ficha. Assim PV ajustado no combate é o mesmo da ficha, e
condições aplicadas fora do combate continuam valendo nele.

### Colunas novas em `characters`

- `conditions` json `ActiveCondition[]`, default `[]`.
- `concentrating` boolean, default `false`.

A rota de estado de sessão da ficha passa a aceitar os dois campos, para o
dono marcar condições e concentração também fora do combate.

### Tipos em `shared/`

```ts
const CONDITIONS = [
  'blinded', 'charmed', 'deafened', 'exhaustion', 'frightened', 'grappled',
  'incapacitated', 'invisible', 'paralyzed', 'petrified', 'poisoned',
  'prone', 'restrained', 'stunned', 'unconscious',
] as const;

type ActiveCondition = {
  condition: Condition;
  /** Só para `exhaustion`: 1 a 6. */
  level?: number;
  /** Rounds restantes; ausente = sem duração. */
  roundsLeft?: number;
};
```

Rótulos em pt-BR (D&D 2024): Cego, Enfeitiçado, Surdo, Exaustão,
Amedrontado, Agarrado, Incapacitado, Invisível, Paralisado, Petrificado,
Envenenado, Caído, Impedido, Atordoado, Inconsciente.

## Lógica pura (`shared/`, com teste unitário)

- `sortInitiative(combatants)`: iniciativa desc → `dexModifier` desc →
  `tieOrder` asc. Combatentes sem iniciativa ficam fora da fila.
- `nextTurn(order, activeId, round)` e `previousTurn(...)`: devolvem
  `{ activeId, round }`; pulam monstros derrotados (PV 0 e
  `source ≠ 'character'`); personagens em 0 PV **não** são pulados.
  `previousTurn` no primeiro combatente do round 1 é no-op.
- `tickConditions(conditions)`: decrementa `roundsLeft` e separa as que
  expiraram. Aplicada ao fim do turno do combatente afetado.
- `healthBand(hpCurrent, hpMax)`: `unhurt` (cheio) · `wounded` (acima da
  metade) · `bloodied` (metade ou menos, acima de 0) · `defeated` (0).
- `concentrationDc(damage)`: `min(30, max(10, floor(damage / 2)))`.
- `deathSaveOutcome(d20, saves)`: 20 → recupera 1 PV e zera testes;
  1 → duas falhas; ≥ 10 sucesso; < 10 falha; 3 sucessos → estável;
  3 falhas → morto.
- `numberCopies(name, count, existing)`: "Goblin 1…N", continuando a
  numeração se já houver goblins no encontro.
- Dano e cura reusam `applyDamage` e `applyHealing` existentes.

## Fluxo

### Preparação (`preparing`)

1. O mestre cria o encontro com um nome.
2. Adiciona combatentes:
   - **personagem** da campanha (um por personagem por encontro);
   - **statblock** com quantidade N, cada um com PV **médio** ou **rolado**
     pela `hpFormula` (escolha no momento da adição);
   - **manual**: nome, CA, PV, tamanho, opcionalmente iniciativa.
3. Pode marcar combatentes como escondidos, editar, remover.
4. Nada disso é visível para jogadores.

### Iniciativa

1. "Iniciar combate" muda o status para `active` com `round = 0` e
   publica `combat.started` no feed. Falha com 409 se já houver um ativo.
2. O mestre rola a iniciativa dos monstros (todos de uma vez ou um a um),
   **secreta por padrão**, ou digita valores.
3. Cada jogador vê "Rolar iniciativa" no próprio combatente: d20 + bônus da
   ficha, rolado no servidor, **uma vez**. O mestre pode sobrescrever
   (dado físico, correção).
4. A fila mostra quem ainda falta. "Começar round 1" só habilita com todos
   com iniciativa; ao começar, `round = 1` e `activeCombatantId` = primeiro.

### Turnos

- O combatente ativo é destacado para todos.
- **Próximo turno**: mestre a qualquer momento; jogador só quando o ativo é
  o próprio combatente ("Encerrar meu turno"). Ao fim do turno, as
  durações do combatente que encerrou são decrementadas; as que expiram
  saem e vão para o feed. Fim da fila → `round + 1`.
- **Voltar turno** (só mestre): corrige engano; não restaura durações já
  decrementadas (o mestre ajusta à mão — aceito pela simplicidade).
- Todo pedido de avanço/volta leva `expectedActiveCombatantId`; se não
  bater com o atual, 409 com o estado atual. Evita turno pulado duas vezes
  por clique duplo ou mestre e jogador ao mesmo tempo.
- **Reforço** no meio do combate: entra sem iniciativa, rola, e é inserido
  na posição ordenada; o turno atual não muda.
- **Reordenar empates**: o mestre arrasta; grava `tieOrder`.
- Remover o combatente ativo passa a vez para o próximo.
- Revelar combatente escondido (só mestre): `hidden = false`.

### PV

- Operações por **delta**: `damage`, `heal`, `setTemp` (PV temporário
  não acumula: fica o maior, como na regra).
- Monstro/manual em 0 PV: `defeated`, apagado na fila, turno pulado. Cura
  acima de 0 o traz de volta.
- Personagem em 0 PV: no turno dele aparece "Teste contra a morte"
  (rolado no servidor, aplica `deathSaveOutcome` à ficha). Cura acima de
  0 zera os testes contra a morte, como na regra.
- Dano em personagem com 0 PV: **lembrete** de falha no teste contra a
  morte (duas se crítico); não aplicado sozinho.
- Dano em combatente concentrando: **lembrete** "Salvaguarda de
  Constituição, CD X" com botão de rolar (salvaguarda de CON da ficha; no
  statblock, o modificador de Constituição, já que ele não guarda
  proficiência em salvaguardas). Nada é removido sozinho.

### Ataques

- Botão por ataque: rola acerto (d20 + bônus, com vantagem/desvantagem)
  e dano juntos, num único evento. Crítico (d20 natural 20) dobra os
  dados de dano, não o modificador.
- Mestre: ataques do statblock; secretos por padrão, com alternância.
- Jogador: ataques da própria ficha.
- A rolagem não aplica dano no alvo: o mestre aplica (não há alvo
  selecionado até a fase 4).

### Encerramento

- "Encerrar combate" (só mestre): `status = 'ended'`, `endedAt`,
  `activeCombatantId = null`. O feed recebe o resumo: rounds e derrotados.
- Encontro encerrado fica legível por todos os membros (pela mesma visão
  por papel), sem edição.
- PV e condições dos personagens ficam na ficha como estão; `roundsLeft`
  é descartado (a condição permanece até alguém remover).

## Permissões e visibilidade

O servidor monta uma **visão por papel** (`projectEncounter(encounter,
viewer)`) usada pela resposta REST e pelo broadcast. Nada que o jogador não
pode ver sai do servidor.

### O que o jogador vê

| Item | Jogador |
| --- | --- |
| Encontro `preparing` | não existe (fora da listagem; detalhe 404) |
| Encontro `active` / `ended` | sim |
| Aliados (personagens) | PV, CA, condições, concentração |
| Monstros/manuais visíveis | nome, tamanho, posição na fila, condições, `healthBand` |
| PV, CA, iniciativa, ataques de monstro | não |
| Combatente `hidden` | ausente; na vez dele: "vez de outro combatente" |
| Bestiário | não |

### Matriz de ações

| Ação | Mestre | Jogador |
| --- | --- | --- |
| CRUD do bestiário | sim | 403 |
| Criar, preparar, iniciar, encerrar encontro | sim | 403 (404 se `preparing`) |
| Adicionar, remover, esconder, revelar, reordenar | sim | 403 |
| Rolar/atribuir iniciativa | qualquer | só a própria, uma vez |
| Próximo turno | sim | só no próprio turno |
| Voltar turno | sim | 403 |
| Dano, cura, PV temporário | qualquer | só o próprio |
| Condições e concentração | qualquer | só o próprio |
| Teste contra a morte | qualquer personagem | só o próprio |
| Ataques | statblocks | própria ficha |

Códigos: **404** para não membro (regra do projeto) e para o que o jogador
não pode saber que existe (encontro em preparação, combatente escondido).
**403** para ação proibida sobre recurso que ele já vê. **409** para
conflito de estado (turno desatualizado, segundo encontro ativo).

### Feed

Eventos gravados completos; **redação na leitura** por papel, tanto em
`readFeed` quanto no envio ao vivo. Mestre: "Goblin 2 sofreu 7 de dano
(3/10)". Jogador: "Goblin 2 está muito ferido". Eventos de combatente
escondido não chegam ao jogador.

Tipos novos: `combat.started`, `combat.ended` (com resumo),
`combat.damage`, `combat.heal`, `combat.condition` (aplicada, removida,
expirada), `combat.defeated`, `combat.deathSave`, `combat.attack`. Trocas
de turno **não** entram no feed.

## Tempo real

- Nova mensagem no mesmo socket: `{ type: 'combat.updated', encounter }`,
  com o **estado completo projetado** para quem recebe, e `version`.
- O hub passa a guardar `userId` por conexão e ganha
  `publishCombat(campaignId, project)`, que chama `project(connection)`
  para cada socket.
- Cliente descarta mensagens com `version` menor que a conhecida.
  Reconexão refaz o fetch (como o feed).
- Mudanças na ficha (PV, condições, concentração pela tela da ficha) de um
  personagem em encontro ativo também disparam `combat.updated`.
- Toda mutação roda numa transação SQLite: lê, aplica a lógica de
  `shared/`, incrementa `version`, grava, publica.

## Interface

Storybook primeiro (`client/src/stories/`), cada componente passando
`npm run test:design` antes de ir para `screens/`.

### Componentes (presentacionais)

- `InitiativeList` — a fila; item ativo destacado; empates arrastáveis.
- `CombatantCard` — PV ou faixa, CA, condições, concentração, ações.
- `HealthBand` — faixa de saúde para o jogador.
- `HpAdjuster` — campo numérico + Dano / Cura / Temporário.
- `ConditionPicker` — as 15 condições, nível de exaustão, duração opcional.
- `TurnBar` — "Round N", Voltar turno, Próximo turno / Encerrar meu turno.
- `StatblockForm` e `StatblockCard` — bestiário.
- `EncounterSetup` — adição de combatentes (personagens, statblock com
  quantidade e PV médio/rolado, manual).

Stories por estado: mestre e jogador; aguardando iniciativa; ativo; aliado;
monstro em cada faixa; escondido (visão do mestre); derrotado; personagem
em 0 PV com testes contra a morte; concentrando com lembrete; encerrado.

### Tela

- Seção **Combate** na navegação da campanha. Mestre: sempre (encontros e
  bestiário). Jogador: só com encontro ativo ou encerrado.
- Mestre: `TurnBar` fixa no topo, fila de `CombatantCard` abaixo.
- Jogador: faixa "É a sua vez" com "Encerrar meu turno"; o próprio card
  fixo e expandido; em 390 px a fila é vertical.
- Troca de turno anunciada em região `aria-live`; destaque respeita
  `prefers-reduced-motion`.
- PV com atualização otimista e rollback se o servidor recusar; turno
  espera a confirmação.

## Testes

- **Unitários (`shared/`)**: todas as funções da seção de lógica pura,
  incluindo empates, pular derrotados, wrap de round, expiração no limite,
  `healthBand` nos limites, CD de concentração nos extremos, os cinco casos
  do teste contra a morte, numeração continuada.
- **Integração RBAC (`server/`)**, um "jogador não consegue X" por linha
  proibida da matriz, mais:
  - não membro recebe 404 em todas as rotas;
  - jogador recebe 404 em encontro `preparing` e combatente escondido;
  - **vazamento**: resposta e broadcast para jogador não contêm PV/CA de
    monstro, combatente escondido, encontro em preparação nem eventos
    de feed desses;
  - 409 em avanço com `expectedActiveCombatantId` desatualizado e em
    segundo encontro ativo;
  - deltas concorrentes de mestre e jogador somam.
- **Design**: `npm run test:design` em todos os componentes novos.

## Entregas

Cada uma usável na mesa e mergeável sozinha.

1. **Base e bestiário**: tipos e lógica pura em `shared/`; schema
   (`statblocks`, `encounters`, `combatants`, colunas em `characters`) e
   migração; CRUD do bestiário com RBAC; `StatblockForm`/`StatblockCard`.
2. **Encontro e turnos**: preparação, iniciativa, turnos, reforços,
   reordenação, esconder/revelar, encerramento; `combat.updated` e
   `projectEncounter`; `InitiativeList`, `TurnBar`, `EncounterSetup`.
3. **PV e condições**: deltas, faixa de saúde, derrotado, teste contra a
   morte, condições com duração, concentração com lembrete; redação do
   feed por papel; `HpAdjuster`, `ConditionPicker`, `HealthBand`.
4. **Ataques e acabamento**: ataque + dano com crítico, resumo no feed,
   seed com statblock e encontro, `verify:app`/`verify:group`.

A entrega 1 atualiza `roadmap.md` (fase 2 em andamento) e
`architecture.md` (fonte única de verdade de PV/condições, visão por
papel no hub). A entrega 4 move a fase 2 para "Entregue".

## Mudanças em relação ao requisito original

1. **Status `preparing`**: o encontro não nasce ativo; o mestre prepara
   antes. O feed registra o início ao **iniciar**, não ao criar.
2. **Jogador encerra o próprio turno.** O original dizia que jogador não
   avança turno; agora ele avança só quando é a vez dele.
3. **Jogador aplica e remove condições no próprio personagem.** O original
   reservava condições ao mestre.
4. **Condições como enum fixo** das 15 da 5e (2024), com nível de exaustão
   e duração opcional — fecha a questão em aberto do roadmap.
5. **PV de personagem não é copiado** para o combatente: o original dizia
   "criado com os valores de HP e AC da ficha"; agora lê e grava a ficha.
6. **Jogador vê faixa de saúde, não PV, de monstros**, e combatentes podem
   ser escondidos.

## Questões em aberto

Nenhuma bloqueante. A decidir na implementação, sem impacto no design:

- Texto exato dos rótulos e das mensagens do feed.
- Se "Voltar turno" deve restaurar durações decrementadas (hoje: não).

## Andamento

### Entrega 1 — base e bestiário (2026-10-22)

Implementada em PRs empilhados, um por parte do plano:

1. Regras puras em `shared/src/combat.ts` e schema (`statblocks`, `encounters`,
   `combatants`, condições e concentração em `characters`), migração `0003`.
2. Rotas do bestiário (`/api/campaigns/:campaignId/statblocks`), só para o mestre.
3. `StatblockCard`, `StatblockForm` e `BestiaryList` no Storybook; o editor de
   ataques, o rodapé do editor, `SelectField` e `AbilityInput` saíram do
   `CharacterForm` para serem compartilhados.
4. Seção "Combate" na campanha com o bestiário, visível só para o mestre.

Diferenças em relação ao texto acima, decididas na implementação:

- `nextTurn` sem combatente ativo (inclusive quando ele foi removido) entrega o
  turno ao primeiro de pé do round atual. O servidor passa o turno **antes** de
  remover o combatente ativo, então a posição dele nunca precisa ser
  reconstruída.
- `deathSaveOutcome` com três sucessos devolve `stable` e mantém a contagem; se
  ela é zerada fica para a rota do teste contra a morte (entrega 3).
- `numberCopies` com uma cópia só mantém o nome sem número ("Goblin"); a
  próxima vira "Goblin 2", e o nome sem número conta como o 1.
- `encounters.active_combatant_id` não tem chave estrangeira, para não criar
  ciclo entre encontro e combatente; o servidor mantém a consistência.
- A CA de statblock aceita de 1 a 40, como a da ficha.

Verificação: 78 testes em `shared` e 148 em `server` (25 unitários, 6 de schema
e 16 de integração do bestiário novos); `test:design` 172/172; React Doctor
100/100; fluxo do bestiário percorrido no app rodando com seed.
