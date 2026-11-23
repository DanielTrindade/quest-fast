# Fase 4, entrega 5 — acabamento do VTT

Spec da última entrega da fase 4
([`2026-11-12-vtt-battlefield-phase4.md`](2026-11-12-vtt-battlefield-phase4.md)).
Fecha a fase: depois dela, o roadmap move a fase 4 para "Entregue".

## O que já existe (não entra)

- Derrotado esmaecido e personagem caído no token (#110, parte 3).
- Token livre do bestiário entrando no combate e PV pelo token (#111, PR 4).
- Reconexão do socket já invalida cenas, encontros, fichas, feed e chat;
  o servidor solta as travas de quem fechou o socket.
- Vitrine (`db:seed:showcase`) com cenas e tokens.
- O README já não cita o Owlbear.

## O que falta

### 1. Token ligado ao combate (cliente)

- **Vez atual em destaque:** o token do combatente da vez ganha um anel em
  `accent-text` e um entalhe acima da peça, parados. A lista de tokens marca
  "Vez atual", como a fila de iniciativa.
- **Faixa de saúde no token:** um arco em volta da peça, na cor da faixa
  (`unhurt`, `wounded`, `bloodied`), só para tokens de combatente do
  encontro em andamento e de personagem nele. Fora de combate, nada muda.
- O resumo acessível do mapa diz de quem é a vez.
- De onde vem: o cliente cruza `TokenView.combatantId`/`characterId` com o
  encontro em andamento que já está no cache (`activeCombatantId` e a faixa
  de saúde, já projetados por papel no servidor). Sem mudança de contrato:
  o jogador só vê o que a fila de iniciativa já mostra a ele. Combatente da
  vez oculto (`activeHidden`) não destaca nada para o jogador.

### 2. Reconexão com o estado completo (cliente, teste)

A invalidação já existe; falta o que fica preso no meio:

- arrasto meu em curso quando o socket cai: a trava se perde no servidor;
  o token volta para a posição salva e um aviso diz que a conexão caiu;
- token que outra pessoa movia quando ela (ou eu) caiu: a interpolação
  para e o token fica onde a cena recarregada diz;
- movimento esperando confirmação (custo do turno): descartado se a cena
  recarregada mudou a posição.
- Teste em `client/test` (lógica pura de `token-motion`/`token-drag`) e uma
  story que simula a queda.

### 3. Seed, verificações e documentação

- `db:seed` ganha uma cena "Estrada da emboscada" com mapa sintético (SVG
  rasterizado pelo mesmo `normaliseMap`), aberta para a mesa, com os
  personagens e os combatentes da "Emboscada na estrada" como tokens e um
  goblin na área oculta do fog.
- `verify:app`: a Mesa mostra o mapa com os tokens, sem erro de console.
- `verify:group`: o mestre arrasta um token e o jogador vê a posição nova;
  o goblin no fog não chega ao jogador; revelar a área o traz pelo socket;
  no combate, o destaque da vez acompanha o turno.
- README: o fog sai de "próximas etapas" e entra na lista do VTT.
- Roadmap: fase 4 em "Entregue", com as diferenças desta spec.
- `architecture.md`, se o seed passar a depender de `sharp` pelo `db`.

## Decisões (aprovadas em 2026-11-23)

1. **Destaque e saúde derivados no cliente** a partir do cache do encontro,
   sem campo novo em `TokenView`. Alternativa: o servidor manda
   `turn`/`band` no token (contrato maior, um `scene.updated` a cada dano).
2. **Arco de saúde também nos personagens**, não só nos monstros (o jogador
   já vê o PV dos aliados). Alternativa: só monstros.
3. **Seed de cena no `db:seed`** (o que `verify:*` usa), reaproveitando o
   `normaliseMap` do servidor: o script do seed passa a importar do
   `server/` ou o mapa sintético vai como PNG pronto em `db/`.
   Escolhido: PNG pequeno versionado em `db/src/seed-assets/`, sem `sharp`
   no `db`.
4. **#109 (arrasto que não pega depois de outro arrasto) entra no PR 2**,
   junto do resto do arrasto. Alternativa: fica na issue.

## PRs (independentes, todos da `master`)

1. `feat/vtt-token-combate` — destaque da vez e arco de saúde: `token-draw`,
   `MapCanvas` (prop do combate), `TokenList`, stories, seção no
   `design-system.md`.
2. `fix/vtt-reconexao` — estados presos na queda (+ #109, se aprovado).
3. `feat/vtt-seed-verify` — seed, `verify:app`, `verify:group`, README e
   roadmap (fase 4 entregue). Vai por último, porque o `verify:group` cobre
   o destaque do PR 1.
