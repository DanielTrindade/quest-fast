# Ações e alvos

Spec aprovada em 2026-11-18. Detalha a
[#111](https://github.com/DanielTrindade/quest-fast/issues/111), levantada na
primeira sessão real com o MVP (2026-11-13).

## Objetivo

Fechar o fluxo "escolher o ataque → escolher os alvos → aplicar o resultado"
sem conta à mão: cada linha de ataque gasta o que deve gastar no turno, uma
magia ou habilidade em área resolve todos os alvos de uma vez (com a
salvaguarda de cada um rolada no servidor) e o PV das criaturas do mapa se
ajusta pelo próprio token.

## Fora de escopo

- **Gabaritos de área** ([#113](https://github.com/DanielTrindade/quest-fast/issues/113)):
  quando existirem, pré-selecionam os alvos. Aqui os alvos vêm de uma lista.
- **Escolher os alvos clicando nos tokens:** fica para a #113, que já desenha
  a área no mapa.
- **Vários alvos num ataque com rolagem de acerto** (raios da Rajada
  Mística, Ataque Extra em alvos diferentes): cada ataque continua com um
  alvo e é rolado à parte. Vários alvos são só para efeitos em área, que usam
  salvaguarda.
- **Resistência, imunidade e vulnerabilidade automáticas:** o mestre continua
  ajustando o dano pendente antes de aplicar ([#112](https://github.com/DanielTrindade/quest-fast/issues/112)
  trata efeitos temporários).
- **Condição automática ao falhar** (Graxa → Caído): o mestre aplica, como
  hoje.
- **Vantagem na salvaguarda por característica do alvo** (Resistência à
  Magia, Esquiva Sobrenatural): o mestre ajusta o pendente.
- **PV próprio em token livre:** o token livre entra no combate (item 4).

## 1. Custo por linha de ataque

Hoje toda linha gasta `attack` no turno (`shared/src/turn.ts`): consome um
ataque do Ataque Extra ou começa uma ação Atacar. Uma magia (Bola de Fogo,
Raio de Fogo) ganha o Ataque Extra indevidamente, e a arma secundária ou a
Arma Espiritual não gastam a ação bônus.

**Regra:** `Attack` e `AttackInput` ganham `cost`:

| Valor | Rótulo | Gasta no turno |
| --- | --- | --- |
| `attack` | Ação Atacar | Um ataque da ação Atacar (o primeiro gasta a ação; o Ataque Extra dá os seguintes) |
| `action` | Ação | A ação inteira; encerra uma ação Atacar em curso |
| `bonusAction` | Ação bônus | A ação bônus |
| `reaction` | Reação | A reação |

- **O custo é sempre de quem usa a linha.** Rolar uma salvaguarda é
  gratuito: o alvo não gasta ação, ação bônus nem reação, dentro ou fora da
  vez dele.
- **Padrão** (campo ausente, JSON antigo, PDF importado, linha nova):
  `attack` para `kind: 'attack'` e `action` para `kind: 'save'` (o efeito que
  pede salvaguarda, como Bola de Fogo, gasta a ação de quem conjura). Magia não
  dá Ataque Extra: um truque com rolagem de acerto (Raio de Fogo) é marcado
  como Ação pelo jogador.
- **Fora da vez**, qualquer linha gasta a reação (ataque de oportunidade,
  como hoje). Antes da rodada 1, nada é contado.
- A regra é uma função pura em `shared/src/turn.ts` (`spendForAttack(budget,
  cost, ownTurn, attacksPerAction)`), usada pelo combate e pela rolagem pela
  ficha (`spendSheetAttack`).
- O normalizador lê a linha antiga sem `cost` com o padrão; nada é migrado no
  banco (as linhas são JSON).
- Editor de ataques (ficha e bestiário): um campo "Custo" por linha. O
  `AttackCard` mostra o custo ao lado do nome, e o botão fica desabilitado com
  o motivo quando o turno não tem o que a linha gasta.

**Testes:** `shared/` (cada custo, Ataque Extra só em `attack`, fora da vez,
JSON antigo). Integração: ação bônus gasta pela linha; a mesma linha recusada
na segunda vez; a ficha gasta o mesmo que o combate.

## 2. Salvaguarda rolada no servidor

Hoje o ataque por salvaguarda rola o dano e deixa um pendente com a CD, e o
mestre decide se aplica tudo ou a metade. O alvo não rola nada no app, e a
cópia do monstro no encontro não guarda os modificadores de salvaguarda.

**Dados:**
- O statblock ganha `saveBonuses: Partial<Record<Ability, number>>`: as
  salvaguardas em que a criatura é proficiente, com o bônus do livro
  ("Salvaguardas Des +4, Sab +2"). Ausentes usam o modificador do atributo.
- O combatente ganha `save_modifiers` (JSON, os seis atributos), copiados ao
  entrar no encontro, como a CA e os ataques. Combatente manual: zeros,
  editáveis pelo mestre no `CombatantPatch`. Personagem: lido da ficha na hora
  (`saveBonus` em `shared/src/sheet.ts`).
- A importação do PDF de NPC preenche `saveBonuses` pelas proficiências da
  ficha.
- A linha de salvaguarda com dano ganha `onSave: 'half' | 'none'`, com padrão
  `half`: o caso comum é passar e levar a metade. `none` serve aos truques que
  não causam nada a quem passa (Chama Sagrada).

**Rolagem:** com alvo, o servidor rola 1d20 + modificador do alvo contra a
CD, na mesma transação do ataque, para monstros e personagens. A mesa não
espera ninguém rolar, e o turno do alvo não muda.

- **Com dano:** falhou, pendente com o dano inteiro; passou, pendente com a
  metade (arredondada para baixo) ou nenhum pendente (`onSave: 'none'`). O
  pendente guarda o resultado (`save: { dc, ability, success }`), e o mestre
  ainda ajusta antes de aplicar.
- **Sem dano** (Graxa): passou, nada fica no alvo; falhou, um `pendingSave`
  marcado como falho ("Goblin 1 falhou: aplicar o efeito") para o mestre.

**O que o jogador vê:** de um monstro, só "passou" ou "falhou" e o dano que
ele recebe. Nunca o d20, o total nem o modificador: com a CD, eles entregam o
bônus. De um personagem, tudo.

**Testes:** `shared/` (metade arredondada, `none`, modificador ausente).
Integração: o jogador não recebe d20 nem total da salvaguarda de um monstro
(REST, feed e socket); o pendente sai com a metade quando o alvo passa.

## 3. Vários alvos em área

Só a linha de salvaguarda aceita vários alvos: magias e habilidades em área
(Bola de Fogo, Sopro do Dragão). `AttackRequest.targetId` vira `targetIds:
string[]` (o `targetId` antigo é lido como lista de um). Uma linha com
rolagem de acerto que receba mais de um alvo é recusada.

- Um uso: quem usa gasta o custo uma vez e o dano é rolado uma vez. Os alvos
  não gastam nada.
- Cada alvo rola a própria salvaguarda (item 2) e recebe o próprio pendente,
  inteiro ou pela metade.
- Alvos repetidos são recusados; o limite é de 20 alvos por uso.

**Atomicidade:** todos os alvos são validados antes de gastar o turno ou
rolar qualquer dado; um alvo inválido recusa o uso inteiro.

**Evento:** um evento de rolagem por uso, com `targets: AttackTarget[]` no
lugar de `target` (cada entrada com o resultado da salvaguarda e o dano que
fica pendente). O feed e o `redact.ts` leem os dois formatos; eventos antigos
não são reescritos.

**Sigilo:** o atacante oculto ou o monstro (por padrão) continuam deixando o
evento secreto. Um alvo oculto não torna mais o evento inteiro secreto: ele
sai da lista que o jogador recebe, e um evento cujos alvos visíveis acabam
vazios fica secreto para o jogador.

**Interface:** numa linha de salvaguarda, o `TargetPicker` vira uma lista de
seleção múltipla (caixas de seleção). Numa linha de ataque, continua com um
alvo. O resultado mostra uma linha por alvo: "Goblin 1 falhou · 24",
"Goblin 2 passou · 12".

**Testes:** integração: alvo inválido sem gasto nem pendente; linha de ataque
com dois alvos recusada; alvo oculto fora do payload do jogador; não membro
recebe 404.

## 4. PV pelo token

Hoje o PV só se ajusta pela fila de iniciativa, e um token do bestiário
colocado como livre não tem PV.

**PV dos monstros visível para todos:** o jogador passa a receber o PV atual
e o máximo dos monstros que vê (na fila, no token e no feed), não só a faixa
de saúde. A CA, os ataques, os modificadores e os números das rolagens do
monstro continuam do mestre. Muda a regra de redação descrita em
`docs/architecture.md`, que é atualizado no mesmo PR.

**Token de combatente ou de personagem:** selecionar o token no mapa abre, no
painel ao lado, o PV e o `HpAdjuster` do combatente, com as mesmas mutações e
o mesmo cache do encontro. Todos veem os números; o jogador só ajusta o
próprio personagem, como na fila, e o mestre ajusta todos.

**Token livre do bestiário:** "Entrar no combate", um clique do mestre, cria
o combatente a partir do statblock (PV médio ou rolado, como na fila) no
encontro em preparação ou em andamento e transforma o token em `kind:
'combatant'`, na mesma posição. O PV fica com uma só fonte, e isso já entrega
a parte "token ligado ao combate" da entrega 5 do VTT. Sem encontro aberto, o
botão diz que é preciso criar um.

**Testes:** integração: o jogador recebe o PV de um monstro visível e não o
de um oculto; o jogador não ajusta o PV de um token que não é o dele; não
promove token livre; não membro recebe 404.

## Entrega

PRs empilhados, porque 2 e 3 mexem no mesmo contrato e 2 tem migração:

1. Custo por linha (sem migração).
2. Salvaguarda no servidor: `saveBonuses`, `save_modifiers` (migração),
   `onSave`, alvo único.
3. Vários alvos em área: contrato, evento `targets`, redação, seletor.
4. PV pelo token, PV dos monstros visível e promoção do token livre —
   independente, sai de `master` em paralelo (sem migração).

O primeiro PR versiona esta spec e registra a #111 no roadmap. Diferenças na
entrega ficam no `docs/roadmap.md`, não aqui.
