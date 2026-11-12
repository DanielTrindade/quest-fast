# combat-attacks-polish

> Registro histórico: spec da entrega 4 da fase 2 (ataques e acabamento), aprovada em 2026-11-11.
> Detalha a seção "Ataques" e a entrega 4 de [`2026-10-22-combat-and-bestiary.md`](2026-10-22-combat-and-bestiary.md);
> onde divergem, vale esta. O estado atual do produto está em [`../roadmap.md`](../roadmap.md).

## Objetivo

O combatente ataca um alvo num clique: o servidor rola o acerto, compara com a
CA do alvo e, se acertar, rola o dano (dados em dobro no crítico). O dano fica
pendente no alvo até o mestre confirmar, podendo ajustar o valor. O feed conta o
golpe conforme o papel de quem lê, e a CA de monstro nunca sai do servidor.
Com isso a fase 2 fecha: seed com bestiário e encontro prontos, e `verify:app` e
`verify:group` percorrendo um combate de ponta a ponta.

**Critério de sucesso:** uma rodada inteira de combate (iniciativa, ataques do
mestre e dos jogadores, dano confirmado, condição, fim do combate) sem dado
físico nem rolagem livre, sem redigitar dano, e sem a CA nem o bônus de ataque
de um monstro chegarem ao cliente do jogador.

**Fora de escopo:** alvo no mapa (fase 4); cobertura e outros modificadores de
CA na hora do ataque (o mestre usa o ataque sem alvo); dano versátil, dano extra
condicional (Ataque Furtivo, Golpe Divino) e resistências automáticas (o mestre
ajusta o valor ao confirmar); ataques com mais de um alvo; magias com dano (a
lista de magias não guarda dano); regra da casa para empate.

## Mudanças em relação à spec original

1. **Há alvo.** A spec original adiava o alvo para a fase 4 e só rolava acerto e
   dano juntos. Rolar dano num ataque que errou polui o feed, e sem alvo o
   servidor não tem CA para comparar. O alvo é escolhido numa lista dos
   combatentes visíveis, não no mapa.
2. **O dano não é aplicado sozinho.** Vira um dano pendente no alvo, que só o
   mestre confirma (com o valor ajustável) ou descarta.

## O que a spec original não cobria

1. **Ataque por CD.** `Attack` tem `kind: 'save'` (o alvo faz a salvaguarda).
   Não há d20 do atacante nem CA: o dano é rolado e fica pendente com a CD e o
   atributo, e o mestre confirma inteiro, pela metade ou descarta.
2. **Vazamento de números de monstro.** O payload de rolagem traz `expression`,
   `dice` e `modifier`; com eles o jogador deduz o bônus de ataque e o dano do
   statblock. E comparar com a CA não pode devolver a CA ao jogador.
3. **Ficha fora do combate.** "Rolar ataque" na ficha rola só o d20; sem
   encontro não há alvo, então o dano vira um segundo passo.
4. **Combatente sem ataques.** Manual não tem `attacks`; personagem lê os da
   ficha, que pode mudar durante o encontro.
5. **Turno.** Ataque de oportunidade e reação acontecem fora da própria vez.
6. **Dano depois de um ataque sem alvo.** O crítico precisa vir do servidor, não
   de um `critical: true` enviado pelo cliente.

## Regra de acerto

Regra oficial do D&D 2024 (D20 Test): acerta se `total >= CA`. O 20 natural
acerta sempre e é crítico; o 1 natural erra sempre. Com vantagem ou
desvantagem, vale o d20 mantido.

## Modelo de dados

Sem migração: `reminders` já é JSON, e `CombatReminder` só ganha um tipo.

```ts
type CombatReminder = { id: string } & (
  | { kind: 'concentration'; dc: number }
  | { kind: 'deathFailure' }
  | {
      kind: 'pendingDamage';
      amount: number;
      damageType: string;
      critical: boolean;
      attackerName: string;
      attackName: string;
      /** Só para ataque por CD: o mestre decide inteiro ou metade. */
      save?: { dc: number; ability: Ability };
      eventId: string;
    }
);
```

O lembrete fica no **alvo**, como os outros (pertence ao encontro e sobrevive a
recarregar a tela). Como os lembretes de monstro já são `[]` para o jogador, o
valor pendente num monstro não vaza. Num personagem, o dono vê "Dano pendente
de Goblin 2: 5 cortante — aguardando o mestre".

## Lógica pura (`shared/`, com teste)

- `rollAttackHit(bonus, mode, random)`: `1d20+bônus`, com `natural` e
  `critical`.
- `isHit(roll, ac)`: 20 natural acerta, 1 natural erra, senão `total >= ac`.
- `rollDamage(expression, critical, random)`: no crítico os **dados** rolam em
  dobro, o modificador não (`2d6+3` vira `4d6+3`). Se o dobro passar de
  `DICE_COUNT_LIMIT`, a rolagem é recusada antes de rolar (422), em vez de
  cortar dados.
- `halfDamage(amount)`: arredonda para baixo, como na regra.
- `pendingReminders` passa a manter `pendingDamage` mesmo com o alvo a 0 PV (o
  dano num personagem caído ainda conta para o teste contra a morte).

`RollPayload` ganha:

```ts
damage?: { expression: string; dice: DieResult[]; modifier: number; total: number; damageType: string };
critical?: boolean;
target?: { combatantId: string; name: string; hit: boolean; ac?: number }; // `ac` some na redação
save?: { dc: number; ability: Ability };
attackerSource?: 'character' | 'monster';
/** Ataque sem alvo: o dano pode ser rolado depois, uma vez. */
damageRollable?: boolean;
```

## Rotas

Prefixo `/encounters/:encounterId/combatants/:combatantId`. Exigem encontro
`active` (409 em preparação ou encerrado).

| Rota | Corpo | Mestre | Jogador |
| --- | --- | --- | --- |
| `POST /attack` | `{ attackIndex, targetId?, mode?, secret? }` | qualquer combatente | só o próprio personagem |
| `POST /attack/:eventId/damage` | `{}` | o próprio evento | o próprio evento |
| `POST /reminders/:reminderId/apply` | `{ amount? }` (1 a 999) | sim | 403 |
| `DELETE /reminders/:reminderId` | | qualquer | só o próprio, **exceto** `pendingDamage` (403) |

**`POST /attack`:**

- Ataques: do statblock copiado no combatente; de personagem, lidos da ficha
  **no momento do clique**; manual sem ataques → 422 "Ataque inválido".
- Não exige ser a vez de quem ataca (reação, ataque de oportunidade).
- Atacante derrotado ou personagem a 0 PV: 409 ("Combatente fora de combate").
- Alvo: outro combatente do mesmo encontro, visível para quem ataca (jogador
  mirando um escondido → 404, como se não existisse). Alvo derrotado é aceito
  (o mestre decide). Atacar a si mesmo → 422.
- Com alvo e ataque por bônus: rola o acerto; se acertar, rola o dano e cria o
  `pendingDamage` no alvo; se errar, não rola dano.
- Com alvo e ataque por CD: rola o dano e cria o `pendingDamage` com `save`.
- Sem alvo: rola só o acerto (ou, por CD, só o dano) e marca
  `damageRollable`. O mestre aplica o dano como hoje, pelo `HpAdjuster`.
- Segredo: monstro e manual secretos por padrão, como a iniciativa; o mestre
  alterna. Personagem nunca é secreto. Atacante escondido força secreto.
- Cria lembrete: sobe `version` e publica `combat.updated`; sem alvo, só grava
  e publica o evento.

**`POST /attack/:eventId/damage`:** só para evento de ataque sem alvo, do mesmo
encontro e do mesmo autor, ainda sem dano. O crítico vem do evento gravado.
Grava um segundo evento de dano e marca o primeiro como usado (409 na
repetição). Segue o segredo do ataque.

**`POST /reminders/:reminderId/apply`:** só mestre. Aplica `amount` (ou o valor
pendente) pelo mesmo caminho do `POST /hp` com `op: 'damage'`: PV temporário,
derrota, lembretes de concentração e de falha no teste contra a morte (duas no
crítico), feed. Consome o lembrete.

**Ficha:** `POST /characters/:characterId/rolls` com `kind: 'attack'` continua
rolando só o acerto (fora do combate não há alvo) e passa a marcar
`damageRollable`; o dano depois sai por
`POST /characters/:characterId/rolls/:eventId/damage`, com as mesmas regras.
Ataque por CD passa a ser aceito e rola só o dano.

## Redação (`redact.ts`)

| Campo do evento de ataque | Mestre | Jogador: atacante personagem | Jogador: atacante monstro/manual público |
| --- | --- | --- | --- |
| acerto: `total`, `natural`, `critical` | sim | sim | sim |
| acerto: `expression`, `dice`, `modifier` | sim | sim | **removidos** |
| `target.name`, `target.hit` | sim | sim | sim |
| `target.ac` de alvo monstro/manual | sim | **removido** | **removido** |
| `target.ac` de alvo personagem | sim | sim | sim |
| dano: `total`, `damageType` | sim | sim | sim |
| dano: `expression`, `dice`, `modifier` | sim | sim | **removidos** |
| `save` | sim | sim | sim (o alvo precisa saber a CD) |

`attackerSource` e `target.combatantId` ficam gravados para a redação não
depender do combatente, que pode ter sido removido. Alvo escondido torna o
evento secreto, como atacante escondido. A remoção acontece no servidor, no feed
e no socket, como na entrega 3.

A confirmação do mestre gera o `combat.damage` (ou `combat.defeated`) que já
existe, com a redação da entrega 3: o jogador vê a faixa de saúde do monstro.

## Feed (`FeedEventCard`)

- Mestre: "Kaelen atacou Goblin 2 com Espada longa: **17** contra CA 15 —
  acertou · **9** cortante (1d8+3)".
- Jogador, mesmo ataque: "… **17** — acertou · **9** cortante (1d8+3)".
- Erro: "Kaelen atacou Goblin 2 com Espada longa: **12** — errou".
- Crítico e erro crítico: etiquetas "Crítico" e "Erro crítico".
- Por CD: "Goblin xamã usou Raio de fogo em Elara: CD 13 de Destreza · **7** de fogo".
- Jogador vendo monstro público: "Goblin 2 atacou Elara com Cimitarra: **15**
  contra CA 14 — acertou · **5** cortante", sem expressão nem dados.
- Sem alvo: "… **17** para acertar", com "Rolar dano" para o autor enquanto
  `damageRollable`.

## Interface (Storybook primeiro)

- **`AttackCard`**: botão "Atacar" (ou "Rolar dano" para ataque por CD sem
  alvo); recebe `mode` do `RollModeControl` e, para o mestre, "Secreta".
- **`TargetPicker`** (novo): ao clicar em "Atacar", lista os combatentes
  visíveis (nome, faixa de saúde ou PV conforme o papel), o atacante fora, e
  "Sem alvo" no fim. Toque adequado a 390 px.
- **`CombatantAttacks`** (novo): lista de `AttackCard` de um combatente dentro
  do painel expansível da `InitiativeList`, ao lado de "PV e condições". Vazio
  para manual ("Sem ataques — use os dados livres").
- **`ReminderList`**: novo item "Dano pendente: 9 cortante (crítico) de Kaelen —
  Espada longa" com o valor editável, "Aplicar" e "Descartar" para o mestre; por
  CD, também "Metade". O dono do personagem vê o item sem ações.
- **`DiceResult`** e **`FeedEventCard`**: acerto, alvo, resultado e dano lado a
  lado; a versão redigida mostra só o que sobrou.
- **Tela:** ataque e confirmação esperam a resposta (rolagem não tem
  otimismo); o PV muda na confirmação pelo caminho otimista que já existe.
- **Ficha:** a aba de ataques usa o mesmo `AttackCard`, sem alvo.

Stories: acerto, erro, crítico, erro crítico, por CD, vantagem, desvantagem, sem
alvo com "Rolar dano", mestre com "Secreta", redigido para o jogador, dano
pendente (mestre e dono), combatente sem ataques; temas claro e escuro; 320 a
1280 px.

## Seed

O seed passa a deixar a campanha pronta para um combate:

- Bestiário: Goblin (Cimitarra, Arco curto), Lobo (Mordida) e Goblin xamã
  (um ataque por CD), statblocks completos.
- Um encontro em preparação, "Emboscada na estrada", com Elara e Bram (os
  personagens do seed), dois Goblins e um Lobo, com PV médio.
- As fichas do seed ganham um ataque por CD para cobrir o caso.

## Verificação no navegador

**`verify:app`** (mestre sozinho): abre a seção "Combate", o bestiário e o
diálogo de novo statblock sem erro; abre o encontro do seed; sem overflow em
320/390/768/1280 com o painel do combatente e o `TargetPicker` abertos.

**`verify:group`** (mestre, Rafael, Ana, não-membro):

1. O encontro em preparação não aparece para os jogadores; o não-membro recebe 404.
2. O mestre adiciona Kaelen (a ficha que Rafael cria no começo do run) e
   inicia; os jogadores rolam a própria iniciativa; todos veem a fila ao vivo.
3. O mestre ataca com um Goblin em segredo: nada chega aos jogadores.
4. O mestre ataca Kaelen em público: os jogadores veem totais e "acertou" ou
   "errou", e o DOM deles não tem o bônus nem a expressão do Goblin.
5. Rafael ataca um Goblin com Kaelen: o feed dos jogadores não mostra a CA do
   Goblin; num acerto, o dano pendente aparece só para o mestre.
6. O mestre confirma o dano: os jogadores veem só a faixa de saúde.
7. Rafael encerra o próprio turno; Ana não consegue atacar com Kaelen (403).
8. O mestre encerra o combate; o resumo chega ao feed de todos.

## Testes

- **Unitários:** `isHit` com empate (acerta), 20 natural contra CA alta, 1
  natural contra CA baixa, vantagem com o d20 descartado sendo 20 (não é
  crítico); `rollDamage` no crítico (dados dobrados, modificador não) e acima do
  limite; `halfDamage`; `pendingReminders` mantendo dano pendente.
- **RBAC:** jogador não ataca com combatente alheio (403), monstro (403) nem
  escondido (404); não mira escondido (404); não aplica nem descarta dano
  pendente (403); não rola dano do evento de outro (403); não membro 404;
  encontro em preparação ou encerrado 409; atacante derrotado 409; jogador não
  consegue `secret: true`.
- **Vazamento:** feed, socket e projeção do jogador sem CA de monstro, sem
  `expression`/`dice`/`modifier` de ataque público de monstro, sem dano
  pendente em monstro; ataque secreto não chega; alvo ou atacante escondido
  continua secreto depois de revelado.
- **Conflitos:** dano rolado duas vezes do mesmo evento (409); aplicar lembrete
  já consumido (404); deltas concorrentes somam.
- **Ficha:** `/rolls` de ataque marca `damageRollable`; ataque por CD aceito.
- **Design:** `npm run test:design` nos componentes novos e alterados.

## Entregas (PRs empilhados)

1. **Regras e schema:** `rollAttackHit`, `isHit`, `rollDamage`, `halfDamage`,
   lembrete `pendingDamage`, tipos em `RollPayload`, testes unitários.
2. **Rotas e redação:** ataque com alvo, dano depois, aplicar e descartar dano
   pendente, `/rolls` da ficha, redação, testes RBAC e de vazamento.
3. **Componentes:** `AttackCard`, `TargetPicker`, `CombatantAttacks`,
   `ReminderList`, `DiceResult` e `FeedEventCard` no Storybook, sem ligar à tela.
4. **Integração:** painel do encontro e ficha.
5. **Seed, verificação e documentos:** seed, `verify:app`, `verify:group`,
   `roadmap.md` (fase 2 entregue), `architecture.md` se a redação mudar algum
   princípio, e o registro em `docs/history/`.

## Questões em aberto

- Texto exato das mensagens do feed e dos rótulos.

## Andamento

### Entrega 4 — ataques e acabamento (2026-11-12)

Implementada em cinco PRs, um por parte do plano:

1. Regras puras em `shared/src/attack.ts` (acerto, `isHit`, crítico, dano,
   metade) e o lembrete `pendingDamage` (#75).
2. Ataque com alvo, dano pendente aplicado e descartado pelo mestre, dano
   rolado depois, ficha e redação dos números de monstro (#76).
3. `TargetPicker`, `CombatantAttacks`, painel "Ataques" da `InitiativeList`,
   dano pendente na `ReminderList` e o ataque no `FeedEventCard`, no Storybook
   (#77).
4. A tela do encontro, o feed e a ficha ligados às rotas (#78).
5. Seed com bestiário e encontro, `verify:app` e `verify:group` percorrendo um
   combate, `roadmap.md`, `architecture.md` e este registro.

Diferenças em relação ao texto acima, decididas na implementação ou na revisão:

- Do ataque de um monstro, o jogador também não recebe o total do acerto nem o
  d20 natural: com eles e o crítico, o bônus sai numa subtração. Fica acerto ou
  erro, crítico e o total do dano; o resto vem zerado, com `redacted: true`,
  em vez de removido, para o cliente não depender de campos opcionais.
- O dano pendente guarda se o ataque foi secreto: o jogador não o vê nem no
  próprio personagem.
- "Rolar dano depois" é uma rota só, `POST /rolls/:eventId/damage`, para o
  combate e para a ficha. O evento do ataque guarda a expressão
  (`damageRollable`) e passa a `damageRolled`; o crítico vem dele, não do
  pedido.
- Aplicar sem `amount` aplica o dano rolado inteiro, mesmo acima de 999; o
  limite vale só para o valor digitado pelo mestre, recusado sem consumir o
  lembrete.
- Dano pendente aplicado num personagem a 0 PV cria o lembrete de falha que já
  existia ("Uma falha / Duas falhas"); a falha não é registrada sozinha.
- O ataque sem alvo também incrementa `version` do encontro, por passar pela
  mesma transação das outras ações; não há efeito visível.
- `CombatantView` ganhou `attacks`: o mestre recebe todos; o jogador, só os de
  personagens.
- O `TargetPicker` é um `select` nativo; cada opção traz os PV ou a faixa de
  saúde conforme o papel.
- Na ficha, o ataque por salvaguarda vai sempre como rolagem normal, qualquer
  que seja o modo escolhido na ficha.
- O pedido de ataque leva `secret` sempre: omitido, o ataque de um monstro
  voltaria a ser secreto quando o mestre desmarca o segredo.
- No seed, só Elara ganhou um ataque por salvaguarda (Frasco de ácido); Bram
  fica com o machado. O Goblin xamã do bestiário cobre o caso nos monstros.
- `verify:group` procura a campanha do seed pelo nome (o `verify:app` cria
  campanhas no mesmo banco), e os dois scripts aceitam `PLAYWRIGHT_CHANNEL`.

Verificação: 163 testes em `shared`, 335 em `server` e 25 no cliente;
`test:design` 352/352; React Doctor 100/100; `verify:app` 13/13 e
`verify:group` 24/24 contra o app rodando com o seed, nessa ordem.
