## Context

Repositório novo (`quest-fast`), sem código além do guia em Markdown. As decisões de produto estão fechadas: **a plataforma é a mesa** — ficha, dados, combate e mundo acontecem dentro dela, com os jogadores olhando o app durante a sessão. O Discord fica apenas com voz e roleplay. O destino declarado do produto inclui substituir o Owlbear Rodeo, mas o campo de batalha sai deste change por ser o item de maior risco técnico e a maior parcela do esforço.

Escala alvo: uma mesa self-hosted, ordem de 10 usuários e 3 conectados simultâneos por campanha. Isso é o que autoriza SQLite e um único processo — e é o que deixa de valer se o produto virar SaaS.

## Goals / Non-Goals

**Goals:**

- Entregar uma sessão jogável sem VTT: conta → campanha → personagens → rolagem linkada à ficha → combate → mundo.
- Feed da sessão ao vivo, porque o mestre ajustar HP sem ninguém ver não é aceitável.
- Deixar prontas, no MVP, as três costuras de que o change `vtt-battlefield` depende: `SessionEvent`, `Asset` e o canal WebSocket por campanha.
- Rodar com `npm run dev` e um arquivo SQLite — sem Docker, sem serviço externo além do OAuth.

**Non-Goals:**

- Campo de batalha, tokens, grid, fog of war, iluminação e medição (change `vtt-battlefield`).
- Chat livre, voz e vídeo; bot ou webhook do Discord.
- Cadastro por email/senha, recuperação de senha e OAuth de outros provedores.
- Motor de cálculo derivado na ficha (equipamento alterando AC/HP automaticamente).
- SRD, livros oficiais, marketplace, IA e mobile.
- Encerrar/arquivar campanha, timelines, calendários e relações entre entradas do mundo.

## Decisions

### 1. Vite + React (SPA) + Hono, em vez de Next.js

Todo o produto fica atrás de login: zero SEO, zero conteúdo estático, zero necessidade de SSR. Metade do valor futuro é um canvas interativo. Nesse cenário o App Router cobra o imposto de fronteira RSC/client e de semântica de cache sem entregar o que tem de melhor.

O ponto decisivo é o WebSocket: o App Router não hospeda servidor WS, exigindo custom server (que abre mão de otimizações e de deploy serverless) ou um segundo processo. Como o realtime está no MVP e cresce no `vtt-battlefield`, essa fricção seria permanente.

*Alternativas consideradas:* Next.js com o socket num processo separado — mantém a fluência de quem já conhece Next, ao custo de dois processos e do imposto RSC; Remix / React Router 7 — resolve o SSR, não resolve o WS.

### 2. Um processo, um build, um artefato

`server/` (Hono em Node) serve o SPA buildado, as rotas REST e o WebSocket. Um `Dockerfile`, sem orquestração.

```
quest-fast/
  client/   Vite + React + TS + TanStack Router + TanStack Query
  server/   Hono: rotas REST, auth, WS, estaticos
  shared/   tipos + regras 5e puras
  db/       Drizzle + SQLite
```

### 3. `shared/` como fonte única das regras 5e

Parser de expressões de dados e cálculo de modificadores vivem em `shared/`, importados pelos dois lados: o cliente usa para preview e validação de formulário, o servidor usa para valer. Uma implementação, um conjunto de testes.

### 4. O cliente nunca é fonte de verdade

Toda rolagem é calculada no servidor e devolvida pronta; o cliente apenas exibe. Rolagem calculada no cliente é rolagem que o jogador edita no devtools. Vale igualmente para papéis, visibilidade de entradas e estado de combate: a autorização é sempre server-side, a partir de `CampaignMember`.

### 5. SQLite + Drizzle, não Postgres

Para uma instância self-hosted com uma mesa, Postgres é infraestrutura sem contrapartida. SQLite elimina o `docker-compose.yml`, torna backup uma cópia de arquivo e não muda nada no código de aplicação. Drizzle mantém o schema tipado e as migrações versionadas; a troca para Postgres, se um dia o produto for hospedado, é de driver e migrações, não de arquitetura.

*Alternativa considerada:* Postgres desde o início, descartada por antecipar um requisito — concorrência de escrita e múltiplas instâncias — que a escala alvo não tem.

### 6. Discord OAuth como único login

O público inteiro já tem Discord. OAuth é menos código que credenciais (sem hash, sem rate-limit de senha, sem fluxo de recuperação) e traz nome e avatar prontos, o que elimina a necessidade de uma tela de perfil editável.

*Custo aceito:* o app não sobe sem uma aplicação registrada no Discord Developer Portal. Isso vira pré-requisito documentado do self-host e passo da fase 0. *Alternativa considerada:* email/senha, que preservaria autonomia total ao custo de mais código de auth do que todo o resto da fase 0.

### 7. `session-feed` é capability própria, não um detalhe do `dice-rolling`

O feed é o canal compartilhado por onde passam rolagens hoje, combate em seguida e movimento de token/fog no `vtt-battlefield`. Modelado dentro do `dice-rolling`, a fase 4 começaria por uma refatoração. Modelado como capability, `dice-rolling` e `combat-tracker` viram apenas produtores de evento.

### 8. WebSocket no mesmo processo, uma room por campanha

O servidor é autoritativo: recebe intenções, valida papel, persiste e faz broadcast. Eventos no MVP: `session.event` (feed) e `combat.updated`. O `vtt-battlefield` acrescenta `token.moved` e `fog.updated` **no mesmo canal**.

Reconexão refaz o fetch do estado atual — sem replay nem event sourcing. *Alternativa considerada:* SSE descendo e POST subindo, suficiente para o MVP e mais simples, descartada porque o arrasto de token da fase 4 exige latência de WebSocket e não valeria trocar de transporte no meio do caminho. O argumento de que SSE "não é bidirecional" é falso e não foi o motivo da escolha.

### 9. Personagem nasce dentro da campanha

Não existe lista global de personagens, vínculo posterior nem regra de desvinculação: `Character` recebe `campaignId` na criação. Isso elimina três requisitos e a pergunta sem resposta boa de "o que acontece com o histórico de rolagens quando um personagem troca de campanha".

### 10. Bestiário: `Statblock` reutilizável por campanha

Um encontro adiciona combatentes a partir dos personagens da campanha **ou de um statblock salvo**. Sem isso o mestre redigita cada goblin toda sessão, o que é a dor mais concreta do papel e barata de resolver (nome, HP, AC, ataques como texto estruturado).

### 11. `Asset` desde o MVP

Uploads gravam em disco local atrás de uma tabela `Asset` (campanha, caminho, mime, tamanho) com limites de tipo e tamanho. Avatares de personagem já precisam disso, e é o que impede o `vtt-battlefield` — que vive de imagens grandes — de virar migração.

### 12. Modelo de dados

`User` (discordId, nome, avatarUrl) · `Campaign` · `CampaignMember` (papel) · `Character` · `Statblock` · `WorldEntry` (tipo, visibilidade, status de quest, data de sessão) · `Encounter` (status, round, turno atual) · `Combatant` (origem personagem ou statblock, HP, AC, iniciativa, condições) · `SessionEvent` (tipo, payload, autor, secreto) · `Asset`.

### 13. Modificadores 5e simples

`mod = floor((score - 10) / 2)`. Perícias com lista fixa atrelada ao atributo correspondente. Ataques e features salvos como texto estruturado (nome, bônus, dano). Sem derivação automática.

### 14. Estratégia de testes

- `shared/` — parser de dados e modificadores 5e: testes unitários escritos **antes** da implementação. É função pura, é onde bug passa despercebido e contamina todo o resto.
- RBAC — teste de integração por rota, no formato "jogador não consegue X". A tabela de permissões é onde erro vira vazamento de conteúdo do mestre.
- Demais fluxos: verificação manual no MVP.

### 15. Fatiamento vertical

Cada fase termina em algo usável numa sessão real, em vez de uma camada completa sem produto:

```
Fase 0  login -> campanha -> convite -> membros        [deployavel]
Fase 1  personagens + dados + feed ao vivo
Fase 2  combate + bestiario
Fase 3  mundo
```

## Risks / Trade-offs

- **O `vtt-battlefield` continua sendo o risco maior do produto e foi adiado, não resolvido.** → Mitigação: `SessionEvent`, `Asset` e o canal WS entregues no MVP; a fase 4 começa com a infraestrutura pronta e ataca só o problema de canvas e fog.
- **Fog of war não tem modelo de dados definido e vaza por natureza** — mapa enviado ao cliente é mapa visível no devtools. → Tratar no change `vtt-battlefield`, com decisão explícita sobre tokens ocultos, que são o vazamento que de fato estraga a surpresa.
- **Dependência dura do Discord para autenticar.** Discord fora do ar é app inacessível. → Aceito na escala alvo; adicionar credenciais depois não quebra o modelo de dados.
- **SQLite não suporta múltiplas instâncias.** → Aceito; a escala alvo é uma instância. Drizzle limita o custo da troca.
- **Upload em disco local não escala e não sobrevive a container efêmero.** → Aceito no MVP; `Asset` isola a decisão.
- **Sem SRD, o mestre digita statblocks e features à mão.** → Esperado; o bestiário reutilizável reduz a repetição ao mínimo.

## Open Questions

- Formato de armazenamento de condições no `Combatant`: lista de strings livres ou enum fixo das condições 5e. Decidir na fase 2, quando a tela existir.
- Se o feed deve ter retenção limitada (últimos N eventos) ou histórico completo por campanha. Sem impacto de arquitetura; decidir quando o volume real aparecer.
