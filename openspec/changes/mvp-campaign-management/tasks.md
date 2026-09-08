## Estado da implementação — 2026-09-08

Fase 0 concluída, com uma pendência humana. O produto entrega o ciclo login → campanha → convite → membros e sobe em container.

- Entregue e verificado: monorepo com `shared/`, `db/`, `server/` e `client/`; Hono servindo API e SPA no mesmo processo; Drizzle sobre SQLite; OAuth do Discord com `state` contra CSRF; sessão em cookie HttpOnly invalidada no servidor; campanhas, convite, entrada, membros, saída e remoção; `requireAuth` e `requireCampaignRole`; TanStack Router com guarda que consulta a API; telas de login, listagem e campanha.
- Verificação desta sessão: `npm test` com 50 testes aprovados (10 em `shared/`, 40 em `server/`), `npm run typecheck` limpo nos três workspaces, `npm run lint` sem avisos e `npm run build` do SPA. A imagem Docker foi construída e exercitada: migra na subida, responde `/api/health`, recusa rota de dados sem sessão, serve o SPA, preserva o banco no volume entre reinícios e roda como `node`, não root.
- Defeitos encontrados na verificação e corrigidos: ordem instável dos membros quando várias entradas caem no mesmo segundo; as container queries de `campanha.css` não valiam fora do `AppShell`, por falta de contexto de container; e o limiar de duas colunas era inalcançável na largura da página. Os dois primeiros ganharam teste; o terceiro é afirmado por medição na verificação de interface.
- Decisões registradas no `design.md`: driver `better-sqlite3` em vez do `node:sqlite` experimental.
- **Bloqueio humano na 1.5:** as variáveis estão documentadas em `.env.example` e no README, mas registrar a aplicação no Discord Developer Portal exige uma conta Discord e não pode ser feito pelo agente. Até lá o login não roda de ponta a ponta contra o Discord real — a suíte cobre o fluxo com um provedor falso, e `npm run db:seed` abre a interface sem passar pelo Discord.
- `db/src/seed.ts` antecipa parte da tarefa 5.2; a campanha de exemplo completa, com personagens e statblock, continua pendente para o fechamento do MVP.

## 1. Fase 0 — Fundação e primeira fatia vertical (entregável)

Meta: um usuário loga com o Discord, cria uma campanha, convida alguém e vê a lista de membros. Ao fim desta fase o produto sobe em produção.

- [x] 1.1 `git init`, `.gitignore` e estrutura do monorepo (`client/`, `server/`, `shared/`, `db/`)
- [x] 1.2 Scaffold `client/` com Vite + React + TypeScript + TanStack Router
- [x] 1.3 Scaffold `server/` com Hono em Node, servindo o build do `client/` e um `/api/health`
- [x] 1.4 Drizzle + SQLite: conexão, script de migração e primeira migração vazia
- [ ] 1.5 Registrar a aplicação no Discord Developer Portal e documentar as variáveis de ambiente (`DISCORD_CLIENT_ID`, `DISCORD_CLIENT_SECRET`, `DISCORD_REDIRECT_URI`)
- [x] 1.6 Fluxo Discord OAuth: rotas de início e callback, criação/atualização de `User` a partir do perfil do Discord
- [x] 1.7 Sessão em cookie HttpOnly, middleware `requireAuth` e rota de logout
- [x] 1.8 Tabelas `Campaign` e `CampaignMember`; criar campanha (criador vira mestre) e listar as campanhas do usuário
- [x] 1.9 Código de convite único e fluxo de entrada na campanha
- [x] 1.10 Página de membros: listar com nome, papel e data de entrada
- [x] 1.11 Sair da campanha (jogador) e remover membro (mestre)
- [x] 1.12 Middleware `requireCampaignRole` — resolve o papel a partir de `CampaignMember` em toda rota de campanha
- [x] 1.13 Testes de integração de RBAC: jogador não remove membro, não-membro não lê a campanha
- [x] 1.14 `Dockerfile` de processo único e README com os passos de self-host

## 2. Fase 1 — Personagens, dados e feed ao vivo

Meta: um jogador cria a ficha e rola um ataque a partir dela; a mesa inteira vê o resultado na hora.

- [ ] 2.1 Testes unitários do parser de expressões de dados em `shared/` (`1d20+5`, `2d6+3`, entradas inválidas) — antes da implementação
- [ ] 2.2 Implementar o parser até os testes passarem
- [ ] 2.3 Testes unitários e implementação de `mod = floor((score - 10) / 2)` e do mapa fixo perícia → atributo em `shared/`
- [ ] 2.4 Tabela `Asset` + upload em disco local com limite de tipo e tamanho
- [ ] 2.5 Tabela `Character` (com `campaignId`) e CRUD da ficha 5e: raça, classe, nível, atributos, HP, AC, perícias, ataques/features, descrição, avatar
- [ ] 2.6 Permissões da ficha: dono edita, membros da campanha leem
- [ ] 2.7 Tabela `SessionEvent` e endpoint de leitura do feed da campanha
- [ ] 2.8 Canal WebSocket no servidor Hono: room por campanha, autorização no handshake, broadcast de `session.event`
- [ ] 2.9 Cliente conecta ao WS, renderiza o feed e refaz o fetch do estado ao reconectar
- [ ] 2.10 Rolagem livre server-side, publicada no feed
- [ ] 2.11 Vantagem e desvantagem (dois d20, ambos exibidos)
- [ ] 2.12 Rolagens linkadas à ficha: ataque, teste de habilidade e saving throw usando os modificadores salvos
- [ ] 2.13 Rolagem secreta do mestre — filtrada no servidor, nunca enviada aos jogadores
- [ ] 2.14 Teste de integração: o payload do feed recebido por um jogador não contém rolagem secreta

## 3. Fase 2 — Combate e bestiário

Meta: o mestre roda um combate inteiro sem redigitar monstros e sem planilha ao lado.

- [ ] 3.1 Tabela `Statblock` e CRUD do bestiário da campanha (nome, HP, AC, ataques)
- [ ] 3.2 Tabelas `Encounter` e `Combatant`; criar encontro na campanha
- [ ] 3.3 Adicionar combatentes a partir dos personagens da campanha, de um statblock salvo ou manualmente
- [ ] 3.4 Iniciativa: atribuir ou rolar, com ordenação decrescente
- [ ] 3.5 Avanço de turno e contagem de round
- [ ] 3.6 Ajuste de HP com regra de papel (mestre em qualquer combatente, jogador só no próprio) publicando no feed
- [ ] 3.7 Aplicar e remover condições
- [ ] 3.8 Encerrar encontro marcando como encerrado, preservando o histórico
- [ ] 3.9 Broadcast de `combat.updated` no mesmo canal WS
- [ ] 3.10 Testes de integração de RBAC do combate: jogador não avança turno, não altera HP alheio, não edita statblock

## 4. Fase 3 — Mundo

Meta: o mestre guarda NPCs, locais, quests e diários no mesmo lugar da mesa.

- [ ] 4.1 Tabela `WorldEntry` e CRUD de entradas com corpo em markdown
- [ ] 4.2 Tipos NPC, Local, Quest e Diário; status de quest e data de sessão
- [ ] 4.3 Visibilidade público/privado, com o filtro aplicado no servidor
- [ ] 4.4 Listagem e página de detalhe, com renderização de markdown sanitizada
- [ ] 4.5 Diários listados cronologicamente pela data da sessão
- [ ] 4.6 Teste de integração: entrada privada não aparece na listagem nem no detalhe para jogador

## 5. Fechamento do MVP

- [ ] 5.1 Validação de formulários e tratamento de erros de ponta a ponta
- [ ] 5.2 Seed com campanha de exemplo (mestre, jogador, personagens, statblock, NPC, quest)
- [ ] 5.3 README final: pré-requisito do Discord Developer Portal, variáveis de ambiente, execução local e self-host
- [ ] 5.4 `openspec validate mvp-campaign-management` e `openspec status`
