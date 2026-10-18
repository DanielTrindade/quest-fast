# Arquitetura

Como o quest-fast é organizado, por que é assim e onde mexer para cada tipo de
mudança. Para rodar o projeto, veja o [`README.md`](../README.md); para o
processo de contribuição, o [`CONTRIBUTING.md`](../CONTRIBUTING.md).

## Visão geral

Um único processo Node serve tudo: o SPA buildado, a API REST e o WebSocket.
Os dados ficam num arquivo SQLite e os uploads, em disco.

```mermaid
flowchart LR
  subgraph browser[Navegador]
    spa[SPA React<br/>TanStack Router + Query]
  end
  subgraph node[Processo Node: server/]
    http[Hono<br/>REST /api/*]
    ws[WebSocket<br/>/api/campaigns/:id/ws]
    hub[EventHub<br/>room por campanha]
    static[Estáticos<br/>SPA e /uploads]
  end
  db[(SQLite<br/>Drizzle)]
  disk[(uploads/)]
  discord[Discord OAuth]

  spa -- fetch --> http
  spa <-- eventos --> ws
  http --> db
  http --> hub
  hub --> ws
  http --> disk
  http -- login --> discord
  static --> spa
```

Escala alvo: uma mesa self-hosted, na ordem de 10 usuários e 3 conectados ao
mesmo tempo por campanha. É essa escala que justifica SQLite e um processo
único. Se o produto virar SaaS, essas escolhas precisam ser revistas.

## Workspaces

O repositório é um monorepo de npm workspaces. `npm ci` na raiz instala tudo.

| Workspace | Pacote | Papel | Depende de |
| --- | --- | --- | --- |
| `shared/` | `@quest-fast/shared` | Tipos da API e regras 5e puras | nada |
| `db/` | `@quest-fast/db` | Schema Drizzle, migrações, seed | `shared` |
| `server/` | — | Hono: REST, auth, WebSocket, estáticos | `shared`, `db` |
| `client/` | `@quest-fast/client` | SPA React | `shared` |

Não há etapa de build no backend: o Node 22.18+ executa TypeScript direto
(type stripping). Por isso o código de `shared/`, `db/` e `server/` usa só
sintaxe "apagável" (`erasableSyntaxOnly`): nada de `enum`, `namespace` ou
parameter properties. Os imports levam a extensão `.ts`.

### `shared/` — contrato e regras

- `api.ts`: tipos de request/response e de eventos (`SessionEvent`,
  `SocketMessage`). É o contrato entre cliente e servidor; mudar um tipo aqui
  faz o `typecheck` apontar os dois lados.
- `dice.ts`: parser de expressões (`2d6+3`) e rolador com
  vantagem/desvantagem.
- `modifiers.ts`, `sheet.ts`: modificadores, proficiência, perícias com
  especialização, iniciativa, percepção passiva, CD e ataque mágico, dano e
  cura.
- `validation.ts`: validação da ficha, usada pelo formulário (feedback por
  campo) e pelo servidor (o que vale).
- `invite.ts`, `role.ts`: código de convite e papéis (`master`, `player`).

Tudo aqui é função pura, com teste unitário ao lado (`*.test.ts`, rodando no
`node:test`).

### `db/` — persistência

- `src/schema.ts`: tabelas `users`, `sessions`, `campaigns`,
  `campaign_members`, `assets`, `characters` e `session_events`. Partes
  extensas da ficha (perícias, ataques, magias, inventário) e o `payload` dos
  eventos são colunas JSON.
- `migrations/`: SQL gerado pelo `drizzle-kit`. Mudou o schema: rode
  `npm run db:generate` e versione a migração gerada. Migrações já publicadas
  não são editadas.
- `src/migrate.ts`: aplica as migrações. No Docker, roda na subida do
  container.
- `src/seed.ts`: campanha de exemplo e um cookie de sessão para desenvolver
  sem passar pelo Discord.

O driver é `better-sqlite3` (síncrono). Trocar para Postgres seria troca de
driver e de migrações, não de arquitetura.

### `server/` — autoridade

```
src/
  index.ts        sobe o HTTP server e acopla o WebSocket
  app.ts          monta as rotas (createApp recebe as dependências)
  context.ts      Deps (db, env, discord, hub, assets) e variáveis do Hono
  middleware.ts   requireAuth e requireCampaignRole
  env.ts          leitura e validação das variáveis de ambiente
  auth/           OAuth do Discord e sessão em cookie
  campaigns/      campanhas, convite e membros
  characters/     ficha, estado de sessão e rolagens pela ficha
  dice/           rolagem livre
  feed/           leitura paginada do feed
  assets/         upload de imagens (store em disco ou em memória)
  events/         EventHub, persistência do feed e WebSocket
  testing.ts      helpers dos testes de integração
```

Cada módulo de domínio expõe uma função `xxxRoutes()` que devolve um `Hono`
montado em `app.ts`:

| Prefixo | Módulo |
| --- | --- |
| `/api/auth` | `auth/` |
| `/api/campaigns` | `campaigns/` |
| `/api/campaigns/:campaignId/characters` | `characters/` |
| `/api/campaigns/:campaignId/assets` | `assets/` |
| `/api/campaigns/:campaignId/rolls` | `dice/` |
| `/api/campaigns/:campaignId/feed` | `feed/` |
| `/api/campaigns/:campaignId/ws` | `events/ws.ts` (upgrade) |

As dependências chegam por injeção (`createApp(deps)`), não por import de
singleton. É isso que deixa os testes de integração trocarem o Discord por um
provedor falso e o disco por um store em memória.

### `client/` — interface

```
src/
  main.tsx         QueryClient + RouterProvider
  router.tsx       rotas; o guard de autenticação consulta /api/auth/me
  screens/         telas e seções que buscam dados (Login, Campaigns, Campaign...)
  components/      componentes presentacionais do design system
  hooks/           useCampaignSocket, useActiveSection
  lib/             cliente da API, cache do feed, rótulos 5e, formatação
  styles/          tokens (index.css), componentes (components.css), telas
  stories/         Storybook: catálogo e fonte de verdade da interface
```

- **Dados:** TanStack Query para todo estado vindo do servidor. O cliente da
  API (`lib/api.ts`) só transporta e traduz erros; não calcula papel nem
  visibilidade.
- **Tempo real:** `useCampaignSocket` abre o socket da campanha, reconecta com
  backoff e, ao reconectar, refaz o fetch do feed. Eventos novos entram no
  cache do Query via `lib/feed-cache.ts`.
- **Componentes:** `components/` não busca dados; recebe props e é coberto por
  story. `screens/` compõe componentes e liga com a API.
- **Estilo:** Tailwind 4 com tokens CSS próprios. Cor crua e paleta padrão do
  Tailwind são proibidas pelo lint; o porquê está em
  [`design-system.md`](design-system.md).

## Fluxos principais

### Autenticação

1. `GET /api/auth/discord` gera um `state` (contra CSRF) e redireciona ao
   Discord, pedindo só o escopo `identify`.
2. O callback troca o código, cria ou atualiza o `User` e abre uma sessão na
   tabela `sessions`.
3. O cookie `qf_session` é HttpOnly; a sessão é invalidada no servidor no
   logout.

### Autorização

- `requireAuth` resolve o usuário pelo cookie. Sem sessão: 401.
- `requireCampaignRole(...roles)` resolve o papel em `campaign_members`. Quem
  não é membro recebe **404**, não 403: confirmar que a campanha existe já
  seria um vazamento.
- Regras finas (dono da ficha edita, mestre exclui, etc.) ficam na rota, com
  teste de integração no formato "jogador não consegue X".

### Rolagem e feed ao vivo

```mermaid
sequenceDiagram
  participant J as Jogador (cliente)
  participant S as Servidor
  participant DB as SQLite
  participant H as EventHub
  participant M as Mesa (sockets)

  J->>S: POST /characters/:id/rolls { kind, mode }
  S->>S: valida papel e posse da ficha
  S->>S: calcula bônus e rola (shared/)
  S->>DB: grava session_event
  S->>H: publish(campaignId, event)
  H->>M: session.event (secreto só para o mestre)
  S-->>J: resultado
```

O cliente nunca rola: envia a intenção, o servidor calcula com os valores
salvos da ficha e devolve o resultado pronto. Rolagens secretas do mestre são
filtradas tanto na leitura do feed (no SQL) quanto no broadcast do socket.

O WebSocket autoriza **antes** do upgrade (sessão e papel); um socket nunca
troca de campanha. Não há replay de eventos: ao reconectar, o cliente refaz o
fetch. Novos tipos de evento (combate, tokens) entram no mesmo canal, e o
cliente tem fallback para tipos que ainda não sabe renderizar.

## Princípios

São as regras que não mudam de uma feature para outra:

1. **O servidor é a fonte de verdade.** Rolagens, permissões, visibilidade e
   estado de jogo são calculados e autorizados no servidor.
2. **Regra 5e pura vive em `shared/`**, com teste unitário. Cliente usa para
   preview e validação; servidor usa para valer.
3. **Um processo, um artefato.** Nada de serviço extra sem uma razão que a
   escala alvo justifique.
4. **Fatias verticais.** Cada entrega precisa ser usável numa sessão real.
5. **Idioma:** código em inglês (identificadores, arquivos, rotas, campos
   JSON, colunas, comentários, descrições de teste); texto visível ao usuário e
   documentação em pt-BR. Mensagens de erro da API são texto visível: campo
   `error`, conteúdo em português.

## Decisões registradas

O raciocínio completo, com alternativas descartadas, está em
[`history/`](history/). Resumo:

| Decisão | Por quê | Onde |
| --- | --- | --- |
| Vite + React SPA + Hono, não Next.js | Tudo atrás de login (sem SEO/SSR) e o WebSocket precisa morar no mesmo processo | [MVP, decisão 1](history/2026-09-04-mvp-campaign-management.md) |
| SQLite + Drizzle, não Postgres | Uma mesa por instância; backup é copiar um arquivo | [MVP, decisão 5](history/2026-09-04-mvp-campaign-management.md) |
| `better-sqlite3`, não `node:sqlite` | `node:sqlite` ainda é experimental | [MVP, decisão 5](history/2026-09-04-mvp-campaign-management.md) |
| Discord OAuth como único login | O público já tem Discord; menos código que senha | [MVP, decisão 6](history/2026-09-04-mvp-campaign-management.md) |
| WebSocket, não SSE | O arrasto de tokens do VTT vai exigir latência baixa nos dois sentidos | [MVP, decisão 8](history/2026-09-04-mvp-campaign-management.md) |
| Personagem nasce dentro da campanha | Elimina vínculo e desvínculo e a questão do histórico | [MVP, decisão 9](history/2026-09-04-mvp-campaign-management.md) |
| Tabela `Asset` desde o MVP | Avatares hoje, mapas grandes no VTT | [MVP, decisão 11](history/2026-09-04-mvp-campaign-management.md) |
| `SessionEvent` como união discriminada, com fallback | Combate e VTT adicionam tipos sem quebrar o cliente | [session-qol](history/2026-09-10-session-qol-foundations.md) |
| Ficha oficial 2024, sem motor de regras | Valores derivados com ajuste manual; sem calcular CA por armadura | [ficha oficial](history/2026-09-13-official-character-sheet.md) |
| Tokens próprios + Storybook como fonte da interface | Consistência e auditoria automática de a11y/overflow | [design system](history/2026-09-04-design-system-foundation.md) |

Decisão nova que mude um desses pontos, ou um dos princípios acima, deve ser
registrada: atualize este documento no mesmo PR e explique o porquê na
descrição do PR.

## Onde mexer

| Quero... | Arquivos |
| --- | --- |
| Mudar uma regra 5e | `shared/src/sheet.ts` ou `modifiers.ts` + teste em `shared/` |
| Adicionar campo à ficha | `shared/src/api.ts` → `db/src/schema.ts` + `npm run db:generate` → `server/src/characters/` → `client/` (story antes da tela) |
| Criar uma rota | módulo em `server/src/<domínio>/routes.ts`, montado em `app.ts`, com teste de RBAC |
| Emitir um novo tipo de evento | tipo em `shared/src/api.ts`, gravação em `server/src/events/`, renderização em `FeedEventCard` |
| Criar um componente | story em `client/src/stories/`, componente em `client/src/components/`, `npm run test:design` |
| Ajustar cor, tipografia ou espaçamento | tokens em `client/src/styles/index.css` e [`design-system.md`](design-system.md) |

## Testes

| Camada | Ferramenta | Onde |
| --- | --- | --- |
| Regras puras | `node:test` | `shared/src/*.test.ts` |
| API, RBAC e WebSocket | `node:test` com app e SQLite em memória; o WebSocket sobe um servidor real em porta efêmera | `server/src/**/*.test.ts` |
| Design system | Storybook + Playwright + axe | `npm run test:design` |
| Fluxo real | Playwright contra o app rodando | `npm run verify:app`, `verify:group` |
| Qualidade React | React Doctor, saúde 100 obrigatória no CI | `npm run doctor` |
