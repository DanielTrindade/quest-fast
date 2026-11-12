# combat-hp-conditions

> Registro histórico: spec da entrega 3 da fase 2 (PV e condições), aprovada em 2026-11-06.
> Detalha a seção "PV" e a matriz de ações de [`2026-10-22-combat-and-bestiary.md`](2026-10-22-combat-and-bestiary.md);
> onde divergem, vale esta. O estado atual do produto está em [`../roadmap.md`](../roadmap.md).

## Objetivo

Durante um combate, o mestre e os jogadores controlam PV, condições,
concentração e testes contra a morte pelo app. Monstros mostram aos jogadores
só a faixa de saúde, e o feed conta o que aconteceu conforme o papel de quem lê.

**Critério de sucesso:** um combate inteiro sem anotar PV ou condições fora do
app, com o jogador no celular agindo no próprio personagem e sem nenhum número
de monstro chegando ao cliente dele.

**Fora de escopo:** ataques, crítico, seed e `verify:*` (entrega 4); dano massivo
e inconsciência automática em 0 PV; restaurar durações ao voltar turno; descanso.

## O que a spec original não cobria

1. **Lembretes precisam sobreviver.** Quem causa o dano pode não ser quem rola
   a salvaguarda, e recarregar a tela não pode apagar o lembrete.
2. **Teste contra a morte sem limite.** Sem guarda no servidor, o jogador
   poderia repetir a rolagem até tirar 20 no mesmo turno.
3. **Modificador de Constituição.** O combatente não guarda esse valor, e o
   statblock pode já ter sido excluído (`statblock_id` vira nulo).
4. **Registrar a falha do lembrete.** O mestre não tem como marcar falha na
   ficha de outra pessoa: a rota `/state` é só do dono.
5. **Vazamento em `projection.ts`.** `concentrating` de monstro vai para o
   jogador, contra a tabela de visibilidade da spec. Ainda sem efeito, porque
   nada liga esse campo hoje; a correção entra aqui.

## Modelo de dados

Uma migração, só colunas novas em `combatants`:

| Coluna | Tipo | Uso |
| --- | --- | --- |
| `reminders` | json `CombatReminder[]`, default `[]` | lembretes pendentes |
| `death_save_round` | integer, nulo | round do último teste rolado |
| `constitution_modifier` | integer, default 0 | copiado do statblock; manual fica em 0 |

```ts
type CombatReminder = { id: string } & (
  | { kind: 'concentration'; dc: number }
  | { kind: 'deathFailure' }
);
```

Lembretes ficam no combatente mesmo para personagem: pertencem ao encontro, não
à ficha, e não ferem a fonte única de verdade de PV e condições.

`CombatantView` ganha `reminders` e `deathSaves` (nulo para quem não é
personagem). `CharacterSheet` passa a expor `conditions` e `concentrating`.

## Lógica pura (`shared/`, com teste)

- `applyTempHp(state, amount)`: fica o maior valor.
- `applyHpChange(state, op, amount, hpMax)`: despacha `damage`, `heal` e `temp`,
  e diz se o combatente caiu ou voltou.
- `damageReminders({ amount, hpCurrentBefore, concentrating, source })`: uma CD
  por dano quando concentrando; falha pendente quando personagem já em 0 PV.
  Dano absorvido por PV temporário ainda conta como dano.
- `pendingReminders(reminders, { hpCurrent, concentrating })`: descarta lembretes
  que perderam o sentido (curou, soltou a concentração), inclusive por mudança
  feita na ficha.
- `deathSaveFailure(saves, count)`: soma falhas e zera sucessos, porque um
  personagem estável que sofre dano volta a rolar.
- `setCondition` e `removeCondition`: uma entrada por condição; repetir atualiza
  nível e duração. Limite de duração em `COMBAT_LIMITS` (1 a 100 rounds).

## Rotas

Prefixo `/encounters/:encounterId/combatants/:combatantId`. Todas passam por
`mutate` (transação, `version`, `combat.updated`) e exigem encontro `active`:
409 em preparação ou encerrado.

| Rota | Corpo | Mestre | Jogador |
| --- | --- | --- | --- |
| `POST /hp` | `{ op, amount }` (1 a 999) | qualquer | só o próprio |
| `PUT /conditions/:condition` | `{ level?, roundsLeft? }` | qualquer | só o próprio |
| `DELETE /conditions/:condition` | | qualquer | só o próprio |
| `PUT /concentration` | `{ concentrating }` | qualquer | só o próprio |
| `POST /death-save` | `{}` rola; `{ failures: 1 \| 2, reminderId? }` registra | qualquer personagem | só o próprio |
| `POST /concentration-save` | `{ reminderId, mode?, secret? }` | qualquer | só o próprio |
| `DELETE /reminders/:reminderId` | | qualquer | só o próprio |

Códigos: 404 para não membro e combatente escondido; 403 para combatente de
outro jogador; 409 para estado inválido; 422 para corpo inválido.

**Teste contra a morte rolado:** exige personagem em 0 PV, sem 3 sucessos nem 3
falhas. Jogador: só na própria vez e uma vez por round, por `death_save_round`.
O mestre pode repetir para corrigir.

**Salvaguarda de concentração:** usa `saveBonus` da ficha, ou
`constitution_modifier` no caso de monstro. Consome o lembrete e registra a CD no
evento. Falhar **não** tira a concentração: o card oferece "Encerrar concentração".
Rolagem de monstro é secreta por padrão, como a iniciativa.

**Sem efeito:** cura com PV cheio responde 409, para não subir `version` à toa.

**Dano no monstro ativo:** ele fica com a vez até alguém passar o turno; nada
avança sozinho.

**`PATCH /characters/:id/state`** passa a aceitar `conditions` e `concentrating`
(durações são descartadas fora de combate) e zera os testes contra a morte quando
o PV sobe de 0 sem que o pedido os informe.

## Projeção

| Campo | Personagem | Monstro/manual (jogador) |
| --- | --- | --- |
| `concentrating` | sim | **sempre `false`** (corrige o vazamento) |
| `reminders` | sim | **`[]`**: a CD revelaria o dano |
| `deathSaves` | sim | nulo |

## Feed

`recordCombatEvent` passa a aceitar `secret`. Combatente escondido gera evento
secreto, que continua secreto mesmo depois de revelado.

| Tipo | Mestre | Jogador, se for monstro |
| --- | --- | --- |
| `combat.damage` | "Goblin 2 sofreu 7 de dano (3/10)" | "Goblin 2 está muito ferido" |
| `combat.heal` | "Goblin 2 recuperou 4 PV (7/10)" | faixa de saúde |
| `combat.defeated` | "Goblin 2 sofreu 7 de dano e foi derrotado" | "Goblin 2 foi derrotado" |
| `combat.condition` | aplicada, removida ou expirada | igual |
| `combat.deathSave` | d20, resultado e contagem | igual (só personagem) |

- A redação em `redactEvent` **remove** `amount` e `hp*` do payload do jogador; não
  basta o cliente deixar de mostrar.
- `combat.defeated` substitui o `combat.damage` daquele golpe, para não contar a
  mesma coisa duas vezes. Em personagem, os números ficam abertos.
- PV temporário não entra no feed.
- `changeTurn` passa a publicar as condições expiradas (hoje só as descarta).
- A rolagem de concentração continua `roll`, com `concentrationDc` em `RollPayload`.

## Interface (Storybook primeiro)

- **`HealthBand`**: extrai a faixa hoje embutida em `Vitals`.
- **`HpAdjuster`**: número + Dano, Cura e Temporários; área de toque adequada a 390 px.
- **`ConditionPicker`**: as 15 condições, nível de exaustão e duração opcional.
- **`ReminderList`**: "Salvaguarda de Constituição, CD 12" com Rolar e Dispensar;
  "Sofreu dano caído" com Uma falha, Duas (crítico) e Dispensar.
- **`DeathSaveTracker`**: reutiliza `DeathSaves` da ficha, com "Teste contra a morte".
- **`InitiativeList`**: a linha ganha essas ações num painel expansível. Não crio
  `CombatantCard` separado: `InitiativeRow` já cumpre esse papel, e o card próprio
  do jogador fica expandido por padrão.
- **Tela:** PV otimista com rollback (`onMutate` no cache, reverte por refetch); o
  resto espera a confirmação. Etiquetas "Estável" e "Morto" derivadas dos testes.
- **Ficha:** condições e concentração editáveis pelo dono com o mesmo `ConditionPicker`.

Stories: mestre e jogador; cada faixa; derrotado; 0 PV com testes; estável; morto;
concentrando com lembrete; exaustão com nível; encerrado.

## Testes

- **Unitários:** cada função acima, com limites (temporário maior e menor, CD por
  dano absorvido, estável que sofre dano, descarte de lembretes).
- **RBAC, uma linha por rota:** jogador não altera combatente alheio (403) nem
  escondido (404); não membro recebe 404.
- **Vazamento:** resposta, socket e feed do jogador sem PV, dano, CD, concentração
  nem lembretes de monstro; evento de escondido não chega nem depois de revelado.
- **Conflitos:** segundo teste no mesmo round (409), teste fora da vez (409), deltas
  de mestre e jogador somam, encontro encerrado ou em preparação (409).
- **Design:** `npm run test:design` em todos os componentes novos.

## Entregas (PRs empilhados)

1. **Regras e schema:** funções puras, tipos, migração, cópia de `constitution_modifier`.
2. **Rotas e projeção:** rotas, `/state`, correção do vazamento e testes RBAC.
3. **Feed:** eventos, redação, expiração no `changeTurn` e `FeedEventCard`.
4. **Componentes:** stories e `test:design`, sem ligar à tela.
5. **Integração:** `EncounterPanel`, ficha, otimismo, `roadmap.md` e registro em `docs/history/`.

## Limite aceito

O `HitPointsTracker` da ficha continua gravando valor absoluto: um ajuste feito
ali ao mesmo tempo que um dano do mestre pode sobrescrevê-lo, e não gera feed nem
lembrete. Dentro do combate tudo é delta. Tratar isso depois, se aparecer na mesa.

## Andamento

### Entrega 3 — PV e condições (2026-11-11)

Implementada em cinco PRs, um por parte do plano:

1. Regras puras em `shared/`, migração `20261107000058_hesitant_scorpion`
   (`reminders`, `death_save_round`, `constitution_modifier`) e a ficha aberta
   que acompanha o combate (#55).
2. Rotas de PV, condições, concentração, teste contra a morte, salvaguarda de
   concentração e lembretes, e a rota de estado da ficha com condições e
   concentração (#71).
3. Eventos no feed, redigidos por papel no servidor (#73).
4. `HealthBand`, `HpAdjuster`, `ConditionPicker`, `ReminderList` e
   `DeathSaveTracker` no Storybook, e o painel "PV e condições" na
   `InitiativeList` (#72).
5. A tela do encontro ligada às ações, com PV otimista, e condições e
   concentração na ficha.

Diferenças em relação ao texto acima, decididas na implementação ou na revisão:

- `deathSaveFailure` zera a contagem só de quem está estável; quem ainda está
  morrendo mantém os sucessos, como na regra.
- A rota de estado da ficha não define duração, mas mantém a que o combate já
  conta; descartá-la apagaria a duração aplicada pelo mestre.
- Lembretes que uma mudança na ficha tornou sem sentido são apagados de vez,
  não só filtrados na leitura: religar a concentração ou cair de novo traria
  um lembrete antigo de volta.
- A rota de estado da ficha lê, decide e grava numa única transação, depois de
  receber o corpo do pedido.
- Uma mudança na ficha feita pelo combate publica também os outros encontros
  abertos do personagem.
- O evento de dano grava `fell` no golpe que derruba um personagem; o feed não
  deduz a queda pelos PV finais.
- Personagem a 0 PV aparece como "Morrendo", "Estável" ou "Morto": "Caído" já
  é a condição *prone*.
- Não há `CombatantCard` separado: a linha da `InitiativeList` cumpre esse
  papel, e o card do próprio jogador abre expandido.
- As condições ficam sempre no card, removíveis por quem age; o painel "PV e
  condições" só traz o formulário de aplicar. Dentro do painel fechado, o
  mestre não as via de relance (achado no percurso pelo app).
- O cliente ganhou testes com `node:test` (`client/test/`), incluídos em
  `npm test`.
