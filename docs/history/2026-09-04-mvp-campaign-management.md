# mvp-campaign-management

> Registro histórico, escrito originalmente como change do OpenSpec (criado em 2026-09-04).
> Status em 2026-10-18: em andamento (fases 0 e 1 entregues; combate e mundo pendentes). O estado atual do produto está em
> [`../roadmap.md`](../roadmap.md) e a arquitetura em [`../architecture.md`](../architecture.md).

## Resumo

MVP do `quest-fast`: a mesa de D&D 5e inteira em uma plataforma — ficha, dados, combate e mundo. Sem VTT (change `vtt-battlefield`) e sem comunicação (Discord).

### Why

Rodar D&D 5e online hoje exige costurar cinco serviços (Discord + Avrae + DiceCloud + Owlbear Rodeo + Kanka), cada um com sua conta e seu link. Este projeto constrói **a mesa inteira em um só lugar**. O Discord permanece apenas para voz e roleplay.

A escolha de construir em vez de adotar o Quest Portal — gratuito e hoje mais completo — é consciente e se apoia em três razões: self-hosted (os dados da campanha são do mestre), opinado para uma mesa específica em vez de genérico, e PT-BR de ponta a ponta.

### What Changes

- Produto web novo, do zero.
- Ciclo de valor completo de uma sessão **sem VTT**: conta → campanha → personagens → rolagem linkada à ficha → combate com bestiário → mundo, com feed ao vivo.
- Login exclusivamente por Discord OAuth.
- Campo de batalha fica no change `vtt-battlefield`; até lá o Owlbear Rodeo cobre os mapas.

### Capabilities

#### New Capabilities

- `user-auth`: login via Discord OAuth, sessão em cookie e perfil derivado do Discord.
- `campaigns`: criação, convite, entrada, saída, remoção de membros e papéis.
- `characters`: fichas D&D 5e criadas dentro da campanha.
- `session-feed`: canal em tempo real da campanha (eventos de rolagem e combate).
- `dice-rolling`: expressões, vantagem/desvantagem, rolagens linkadas à ficha, rolagem secreta.
- `combat-tracker`: encontros, iniciativa, turnos, HP, condições e bestiário reutilizável.
- `world-entries`: NPCs, locais, quests e diários com visibilidade público/privado.

#### Modified Capabilities

Nenhuma — repositório novo.

### Impact

- Monorepo leve: `client/` (Vite + React), `server/` (Hono), `shared/` (regras 5e puras), `db/` (Drizzle + SQLite).
- Um processo, um build, um `Dockerfile`. Sem Postgres e sem Docker Compose.
- Depende de `design-system-foundation`, que entrega o `client/`, os tokens e os componentes da fase 0.
- Pré-requisito: aplicação registrada no Discord Developer Portal.

### Fases

```
Fase 0  login Discord -> criar campanha -> convite -> membros   [deployavel]
Fase 1  personagens + rolagem linkada a ficha + feed ao vivo
Fase 2  combate + bestiario
Fase 3  mundo (NPC / local / quest / diario)
------- fim do MVP -------
Fase 4  vtt-battlefield (change separado)
```

## Proposta

### Why

Rodar D&D 5e online hoje exige costurar cinco serviços (Discord + Avrae + DiceCloud + Owlbear Rodeo + Kanka), cada um com sua conta, seu link e seu modelo mental. O `quest-fast` constrói **a mesa inteira em um só lugar**: ficha, dados, combate, mundo e — em change posterior — o campo de batalha. O Discord permanece **apenas para voz e roleplay**.

**Por que construir em vez de usar o Quest Portal (gratuito e mais completo hoje).** Esta é uma decisão consciente, não um descuido. O Quest Portal já entrega mapas, tokens, fog of war, iluminação dinâmica e notas de graça. Construímos assim mesmo porque: (a) a mesa é **self-hosted** — os dados da campanha ficam no servidor do mestre, sem depender da sobrevivência ou do modelo de negócio de um terceiro; (b) o produto pode ser **opinado para uma mesa específica** em vez de genérico para todas; (c) é PT-BR de ponta a ponta. Se essas três razões deixarem de valer, o projeto perde sua justificativa.

### What Changes

- Produto web novo, do zero (o repositório hoje contém apenas o guia em Markdown).
- Entrega o ciclo de valor completo de uma sessão **sem VTT**: conta → campanha → personagens → rolagem linkada à ficha → combate com bestiário → conteúdo do mundo, com feed da sessão ao vivo.
- Login exclusivamente por **Discord OAuth**; não há cadastro por email/senha no MVP.
- **Campo de batalha (VTT) fica fora deste change** e é tratado em `vtt-battlefield`. Até lá, mapas continuam no Owlbear Rodeo.
- Nenhuma integração com Discord além do OAuth: sem bot, sem webhook, sem sincronização de canais.

### Capabilities

#### New Capabilities

- `user-auth`: login via Discord OAuth, sessão persistente em cookie e perfil derivado do Discord.
- `campaigns`: criação de campanha, código de convite, entrada, saída, remoção de membros e papéis (mestre/jogador).
- `characters`: fichas D&D 5e criadas dentro de uma campanha, editáveis pelo dono e legíveis pelos membros.
- `session-feed`: o canal em tempo real da campanha — registra e propaga eventos (rolagens, combate) para os membros conectados.
- `dice-rolling`: rolagem de expressões, vantagem/desvantagem, rolagens linkadas à ficha e rolagem secreta do mestre.
- `combat-tracker`: encontros, iniciativa, turnos, HP, condições e bestiário reutilizável da campanha.
- `world-entries`: NPCs, locais, quests e diários de sessão com visibilidade público/privado.

#### Modified Capabilities

Nenhuma — repositório novo, sem capacidades existentes.

### Non-Goals

- Campo de batalha, tokens, grid e fog of war (change `vtt-battlefield`).
- Chat livre, voz e vídeo — permanecem no Discord.
- Bot do Discord, webhooks ou qualquer sincronização de conteúdo com o Discord.
- Motor de cálculo derivado na ficha (equipamento alterando AC/HP automaticamente).
- Conteúdo SRD ou livros oficiais; o mestre digita ataques, features e statblocks.
- Multi-tenancy, billing, aplicativo mobile e IA.
- Cadastro por email/senha e recuperação de senha.

### Impact

- Repositório `quest-fast`, hoje apenas Markdown, passa a hospedar um monorepo leve: `client/`, `server/`, `shared/`, `db/`.
- Stack nova: Vite + React + TypeScript (SPA), Hono em Node (REST + WebSocket + estáticos), Drizzle ORM + SQLite, Discord OAuth.
- Um único processo em produção; um `Dockerfile`; sem Docker Compose e sem Postgres no MVP.
- **Pré-requisito operacional:** o app não inicia sem uma aplicação registrada no Discord Developer Portal (client id, client secret e redirect URI).
- **Depende de `design-system-foundation`:** o `client/`, a camada de tokens e os componentes que as telas da fase 0 consomem são entregues lá, não aqui.
- Uploads de imagem gravados em disco local atrás de uma abstração `Asset`, já preparada para o volume de mapas do change `vtt-battlefield`.

## Design

### Context

Repositório novo (`quest-fast`), sem código além do guia em Markdown. As decisões de produto estão fechadas: **a plataforma é a mesa** — ficha, dados, combate e mundo acontecem dentro dela, com os jogadores olhando o app durante a sessão. O Discord fica apenas com voz e roleplay. O destino declarado do produto inclui substituir o Owlbear Rodeo, mas o campo de batalha sai deste change por ser o item de maior risco técnico e a maior parcela do esforço.

Escala alvo: uma mesa self-hosted, ordem de 10 usuários e 3 conectados simultâneos por campanha. Isso é o que autoriza SQLite e um único processo — e é o que deixa de valer se o produto virar SaaS.

### Goals / Non-Goals

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

### Decisions

#### 1. Vite + React (SPA) + Hono, em vez de Next.js

Todo o produto fica atrás de login: zero SEO, zero conteúdo estático, zero necessidade de SSR. Metade do valor futuro é um canvas interativo. Nesse cenário o App Router cobra o imposto de fronteira RSC/client e de semântica de cache sem entregar o que tem de melhor.

O ponto decisivo é o WebSocket: o App Router não hospeda servidor WS, exigindo custom server (que abre mão de otimizações e de deploy serverless) ou um segundo processo. Como o realtime está no MVP e cresce no `vtt-battlefield`, essa fricção seria permanente.

*Alternativas consideradas:* Next.js com o socket num processo separado — mantém a fluência de quem já conhece Next, ao custo de dois processos e do imposto RSC; Remix / React Router 7 — resolve o SSR, não resolve o WS.

#### 2. Um processo, um build, um artefato

`server/` (Hono em Node) serve o SPA buildado, as rotas REST e o WebSocket. Um `Dockerfile`, sem orquestração.

```
quest-fast/
  client/   Vite + React + TS + TanStack Router + TanStack Query
  server/   Hono: rotas REST, auth, WS, estaticos
  shared/   tipos + regras 5e puras
  db/       Drizzle + SQLite
```

#### 3. `shared/` como fonte única das regras 5e

Parser de expressões de dados e cálculo de modificadores vivem em `shared/`, importados pelos dois lados: o cliente usa para preview e validação de formulário, o servidor usa para valer. Uma implementação, um conjunto de testes.

#### 4. O cliente nunca é fonte de verdade

Toda rolagem é calculada no servidor e devolvida pronta; o cliente apenas exibe. Rolagem calculada no cliente é rolagem que o jogador edita no devtools. Vale igualmente para papéis, visibilidade de entradas e estado de combate: a autorização é sempre server-side, a partir de `CampaignMember`.

#### 5. SQLite + Drizzle, não Postgres

Para uma instância self-hosted com uma mesa, Postgres é infraestrutura sem contrapartida. SQLite elimina o `docker-compose.yml`, torna backup uma cópia de arquivo e não muda nada no código de aplicação. Drizzle mantém o schema tipado e as migrações versionadas; a troca para Postgres, se um dia o produto for hospedado, é de driver e migrações, não de arquitetura.

*Alternativa considerada:* Postgres desde o início, descartada por antecipar um requisito — concorrência de escrita e múltiplas instâncias — que a escala alvo não tem.

**Driver (decidido na fase 0):** `better-sqlite3` com `drizzle-orm/better-sqlite3`. É o caminho principal do Drizzle para SQLite e tem API estável. O módulo é nativo, mas instala por binário pré-compilado — verificado nesta máquina em 11s, sem toolchain de build — e a imagem do `Dockerfile` o compila quando não houver binário para a plataforma.

*Alternativa considerada:* `node:sqlite`, embutido no Node 22, que dispensaria o módulo nativo por completo e é suportado por `drizzle-orm/node-sqlite`. Descartada porque ainda emite `ExperimentalWarning` e sua API pode mudar sem aviso, o que é caro num produto self-hosted de vida longa. A troca entre os dois é de import do cliente e do migrator, não de schema nem de consulta.

#### 6. Discord OAuth como único login

O público inteiro já tem Discord. OAuth é menos código que credenciais (sem hash, sem rate-limit de senha, sem fluxo de recuperação) e traz nome e avatar prontos, o que elimina a necessidade de uma tela de perfil editável.

*Custo aceito:* o app não sobe sem uma aplicação registrada no Discord Developer Portal. Isso vira pré-requisito documentado do self-host e passo da fase 0. *Alternativa considerada:* email/senha, que preservaria autonomia total ao custo de mais código de auth do que todo o resto da fase 0.

#### 7. `session-feed` é capability própria, não um detalhe do `dice-rolling`

O feed é o canal compartilhado por onde passam rolagens hoje, combate em seguida e movimento de token/fog no `vtt-battlefield`. Modelado dentro do `dice-rolling`, a fase 4 começaria por uma refatoração. Modelado como capability, `dice-rolling` e `combat-tracker` viram apenas produtores de evento.

#### 8. WebSocket no mesmo processo, uma room por campanha

O servidor é autoritativo: recebe intenções, valida papel, persiste e faz broadcast. Eventos no MVP: `session.event` (feed) e `combat.updated`. O `vtt-battlefield` acrescenta `token.moved` e `fog.updated` **no mesmo canal**.

Reconexão refaz o fetch do estado atual — sem replay nem event sourcing. *Alternativa considerada:* SSE descendo e POST subindo, suficiente para o MVP e mais simples, descartada porque o arrasto de token da fase 4 exige latência de WebSocket e não valeria trocar de transporte no meio do caminho. O argumento de que SSE "não é bidirecional" é falso e não foi o motivo da escolha.

#### 9. Personagem nasce dentro da campanha

Não existe lista global de personagens, vínculo posterior nem regra de desvinculação: `Character` recebe `campaignId` na criação. Isso elimina três requisitos e a pergunta sem resposta boa de "o que acontece com o histórico de rolagens quando um personagem troca de campanha".

#### 10. Bestiário: `Statblock` reutilizável por campanha

Um encontro adiciona combatentes a partir dos personagens da campanha **ou de um statblock salvo**. Sem isso o mestre redigita cada goblin toda sessão, o que é a dor mais concreta do papel e barata de resolver (nome, HP, AC, ataques como texto estruturado).

#### 11. `Asset` desde o MVP

Uploads gravam em disco local atrás de uma tabela `Asset` (campanha, caminho, mime, tamanho) com limites de tipo e tamanho. Avatares de personagem já precisam disso, e é o que impede o `vtt-battlefield` — que vive de imagens grandes — de virar migração.

#### 12. Modelo de dados

`User` (discordId, nome, avatarUrl) · `Campaign` · `CampaignMember` (papel) · `Character` · `Statblock` · `WorldEntry` (tipo, visibilidade, status de quest, data de sessão) · `Encounter` (status, round, turno atual) · `Combatant` (origem personagem ou statblock, HP, AC, iniciativa, condições) · `SessionEvent` (tipo, payload, autor, secreto) · `Asset`.

#### 13. Modificadores 5e simples

`mod = floor((score - 10) / 2)`. Perícias com lista fixa atrelada ao atributo correspondente. Ataques e features salvos como texto estruturado (nome, bônus, dano). Sem derivação automática.

#### 14. Estratégia de testes

- `shared/` — parser de dados e modificadores 5e: testes unitários escritos **antes** da implementação. É função pura, é onde bug passa despercebido e contamina todo o resto.
- RBAC — teste de integração por rota, no formato "jogador não consegue X". A tabela de permissões é onde erro vira vazamento de conteúdo do mestre.
- Demais fluxos: verificação manual no MVP.

#### 15. Fatiamento vertical

Cada fase termina em algo usável numa sessão real, em vez de uma camada completa sem produto:

```
Fase 0  login -> campanha -> convite -> membros        [deployavel]
Fase 1  personagens + dados + feed ao vivo
Fase 2  combate + bestiario
Fase 3  mundo
```

### Risks / Trade-offs

- **O `vtt-battlefield` continua sendo o risco maior do produto e foi adiado, não resolvido.** → Mitigação: `SessionEvent`, `Asset` e o canal WS entregues no MVP; a fase 4 começa com a infraestrutura pronta e ataca só o problema de canvas e fog.
- **Fog of war não tem modelo de dados definido e vaza por natureza** — mapa enviado ao cliente é mapa visível no devtools. → Tratar no change `vtt-battlefield`, com decisão explícita sobre tokens ocultos, que são o vazamento que de fato estraga a surpresa.
- **Dependência dura do Discord para autenticar.** Discord fora do ar é app inacessível. → Aceito na escala alvo; adicionar credenciais depois não quebra o modelo de dados.
- **SQLite não suporta múltiplas instâncias.** → Aceito; a escala alvo é uma instância. Drizzle limita o custo da troca.
- **Upload em disco local não escala e não sobrevive a container efêmero.** → Aceito no MVP; `Asset` isola a decisão.
- **Sem SRD, o mestre digita statblocks e features à mão.** → Esperado; o bestiário reutilizável reduz a repetição ao mínimo.

### Open Questions

- Formato de armazenamento de condições no `Combatant`: lista de strings livres ou enum fixo das condições 5e. Decidir na fase 2, quando a tela existir.
- **Campanha criada por engano não tem saída, e isso não estava previsto.** O mestre não pode sair da própria campanha, para que a mesa não fique sem mestre, e encerrar/arquivar está nos Non-Goals. As duas regras isoladas são corretas; juntas, tornam a campanha permanente e irremovível para quem a criou. Mantido fora do MVP por decisão explícita — a limpeza, se precisar, é no SQLite. Quando entrar, a semântica escolhida é **arquivamento reversível** (`campaigns.archived_at`, filtrado por padrão na listagem), não exclusão em cascata: preserva o histórico da mesa e admite volta atrás.
- Se o feed deve ter retenção limitada (últimos N eventos) ou histórico completo por campanha. Sem impacto de arquitetura; decidir quando o volume real aparecer.

## Requisitos

### campaigns

#### ADDED Requirements

##### Requirement: Criar campanha
O sistema SHALL permitir que um usuário autenticado crie uma campanha com nome e descrição, tornando o criador o seu mestre.

###### Scenario: Criação com sucesso
- **WHEN** um usuário autenticado cria uma campanha com nome e descrição
- **THEN** a campanha é criada e o criador passa a ser membro com papel `mestre`

##### Requirement: Código de convite
O sistema SHALL gerar um código de convite único para cada campanha criada, visível apenas ao mestre.

###### Scenario: Geração do código
- **WHEN** uma campanha é criada
- **THEN** ela recebe um código de convite único, exibido ao mestre para compartilhamento

###### Scenario: Código oculto para jogador
- **WHEN** um jogador membro abre a página da campanha
- **THEN** o código de convite não é exibido nem retornado pela API

##### Requirement: Entrar na campanha
O sistema SHALL permitir que um usuário autenticado entre em uma campanha por meio do código de convite.

###### Scenario: Entrada válida
- **WHEN** um usuário autenticado informa um código de convite válido
- **THEN** ele entra como membro com papel `jogador` e passa a ver o conteúdo público da campanha

###### Scenario: Código inválido
- **WHEN** o código informado não corresponde a nenhuma campanha
- **THEN** o sistema exibe um erro e não altera a participação do usuário

###### Scenario: Usuário já é membro
- **WHEN** um usuário que já é membro informa o código da mesma campanha
- **THEN** o sistema não cria uma participação duplicada e o leva para a campanha

##### Requirement: Listar campanhas do usuário
O sistema SHALL listar as campanhas das quais o usuário autenticado é membro, indicando o seu papel em cada uma.

###### Scenario: Listagem
- **WHEN** um usuário autenticado abre a tela inicial
- **THEN** ele vê apenas as campanhas das quais é membro, cada uma com o seu papel

##### Requirement: Listar membros
O sistema SHALL exibir aos membros da campanha a lista de participantes com nome, papel e data de entrada.

###### Scenario: Visualização da lista
- **WHEN** um membro abre a página de membros da campanha
- **THEN** ele vê nome, papel (mestre/jogador) e data de entrada de cada membro

##### Requirement: Sair da campanha
O sistema SHALL permitir que um jogador saia de uma campanha, e SHALL impedir que o mestre saia da sua própria campanha.

###### Scenario: Saída do jogador
- **WHEN** um jogador membro sai de uma campanha
- **THEN** ele é removido dos membros e perde o acesso ao conteúdo da campanha

###### Scenario: Mestre tenta sair
- **WHEN** o mestre tenta sair da própria campanha
- **THEN** o sistema recusa a operação, para que a campanha não fique sem mestre

##### Requirement: Remover membro
O sistema SHALL permitir que apenas o mestre remova um jogador da campanha.

###### Scenario: Remoção pelo mestre
- **WHEN** o mestre remove um jogador da campanha
- **THEN** o jogador é removido dos membros e perde o acesso ao conteúdo da campanha

###### Scenario: Remoção tentada por jogador
- **WHEN** um jogador tenta remover outro membro
- **THEN** o sistema recusa a operação

##### Requirement: Isolamento entre campanhas
O sistema SHALL recusar, no servidor, qualquer leitura ou escrita de conteúdo de uma campanha por quem não é seu membro.

###### Scenario: Acesso por não-membro
- **WHEN** um usuário autenticado que não é membro requisita conteúdo de uma campanha
- **THEN** o sistema recusa a operação e não expõe nenhum dado da campanha

### characters

#### ADDED Requirements

##### Requirement: Criar personagem dentro da campanha
O sistema SHALL permitir que um membro crie um personagem D&D 5e dentro de uma campanha da qual participa, tornando-se o seu dono.

###### Scenario: Criação com sucesso
- **WHEN** um membro cria um personagem em uma campanha informando raça, classe, nível, atributos (Força, Destreza, Constituição, Inteligência, Sabedoria, Carisma), HP, AC, perícias, ataques/features e descrição
- **THEN** o personagem é criado já pertencente àquela campanha e ao membro que o criou

###### Scenario: Criação por não-membro
- **WHEN** um usuário que não é membro tenta criar um personagem na campanha
- **THEN** o sistema recusa a operação

##### Requirement: Modificadores derivados dos atributos
O sistema SHALL calcular o modificador de cada atributo como `floor((valor - 10) / 2)` e associar cada perícia ao seu atributo correspondente por uma lista fixa.

###### Scenario: Cálculo do modificador
- **WHEN** um atributo da ficha recebe um valor
- **THEN** o sistema exibe o modificador correspondente calculado por `floor((valor - 10) / 2)`

##### Requirement: Editar personagem
O sistema SHALL permitir que apenas o dono edite a ficha do seu personagem.

###### Scenario: Atualização pelo dono
- **WHEN** o dono edita qualquer campo da ficha
- **THEN** a ficha é atualizada e as rolagens linkadas passam a usar os novos valores

###### Scenario: Edição por outro membro
- **WHEN** outro membro, incluindo o mestre, tenta editar a ficha
- **THEN** o sistema recusa a operação

##### Requirement: Leitura pelos membros
O sistema SHALL exibir os personagens da campanha a todos os seus membros.

###### Scenario: Leitura por mestre e jogadores
- **WHEN** um membro abre a lista de personagens da campanha
- **THEN** ele vê os personagens da campanha e pode abrir cada ficha em modo somente leitura

##### Requirement: Avatar do personagem
O sistema SHALL permitir que o dono envie uma imagem de avatar para o personagem, respeitando limites de tipo e tamanho.

###### Scenario: Upload válido
- **WHEN** o dono envia uma imagem dentro dos limites de tipo e tamanho aceitos
- **THEN** a imagem é armazenada como asset da campanha e passa a ilustrar o personagem

###### Scenario: Upload recusado
- **WHEN** o arquivo enviado excede o limite de tamanho ou tem tipo não permitido
- **THEN** o sistema recusa o upload e informa o motivo

##### Requirement: Excluir personagem
O sistema SHALL permitir que o dono ou o mestre excluam um personagem da campanha.

###### Scenario: Exclusão
- **WHEN** o dono ou o mestre exclui um personagem
- **THEN** o personagem deixa de aparecer na campanha e os eventos já publicados no feed permanecem inalterados

### combat-tracker

#### ADDED Requirements

##### Requirement: Bestiário da campanha
O sistema SHALL permitir que o mestre salve statblocks reutilizáveis na campanha, com nome, HP, AC e ataques, para não redigitá-los a cada encontro.

###### Scenario: Criação de statblock
- **WHEN** o mestre cria um statblock com nome, HP, AC e ataques
- **THEN** ele é salvo no bestiário da campanha e fica disponível para encontros futuros

###### Scenario: Bestiário restrito ao mestre
- **WHEN** um jogador tenta criar, editar, excluir ou listar o bestiário da campanha
- **THEN** o sistema recusa a operação

##### Requirement: Criar encontro
O sistema SHALL permitir que apenas o mestre crie um encontro na campanha.

###### Scenario: Início de encontro
- **WHEN** o mestre cria um encontro na campanha
- **THEN** o encontro é criado no round 1, sem combatentes, e o início é registrado no feed da sessão

##### Requirement: Adicionar combatentes
O sistema SHALL permitir que o mestre adicione combatentes a partir dos personagens da campanha, de um statblock do bestiário ou manualmente.

###### Scenario: Combatente a partir de personagem
- **WHEN** o mestre adiciona um personagem da campanha ao encontro
- **THEN** o combatente é criado com os valores de HP e AC da ficha e permanece vinculado ao personagem

###### Scenario: Combatente a partir do bestiário
- **WHEN** o mestre adiciona um statblock salvo ao encontro
- **THEN** o combatente é criado com os valores do statblock, e alterações no combatente não modificam o statblock original

###### Scenario: Combatente manual
- **WHEN** o mestre adiciona um combatente informando nome, HP, AC e iniciativa
- **THEN** o combatente é criado apenas para aquele encontro

##### Requirement: Ordem de iniciativa
O sistema SHALL ordenar os combatentes da maior para a menor iniciativa.

###### Scenario: Ordenação da fila
- **WHEN** o mestre atribui ou rola a iniciativa dos combatentes
- **THEN** os combatentes são ordenados da maior para a menor iniciativa

##### Requirement: Avançar turno
O sistema SHALL permitir que apenas o mestre avance o turno, passando ao próximo combatente da ordem e iniciando novo round ao fim da fila.

###### Scenario: Próximo turno
- **WHEN** o mestre aciona "próximo turno"
- **THEN** o combate avança para o próximo combatente da ordem e o combatente ativo é destacado para todos os membros

###### Scenario: Novo round
- **WHEN** a fila de combatentes termina
- **THEN** o combate volta ao primeiro combatente e o contador de round é incrementado

###### Scenario: Jogador tenta avançar
- **WHEN** um jogador tenta avançar o turno
- **THEN** o sistema recusa a operação

##### Requirement: Controle de HP
O sistema SHALL permitir que o mestre ajuste o HP de qualquer combatente e que um jogador ajuste apenas o do seu próprio personagem, registrando a alteração no feed.

###### Scenario: Ajuste pelo mestre
- **WHEN** o mestre ajusta o HP de qualquer combatente
- **THEN** o novo valor é propagado aos membros conectados e a alteração é registrada no feed

###### Scenario: Ajuste pelo jogador
- **WHEN** um jogador ajusta o HP do combatente vinculado ao seu próprio personagem
- **THEN** o valor é atualizado, propagado e registrado no feed

###### Scenario: Ajuste em combatente alheio
- **WHEN** um jogador tenta ajustar o HP de um combatente que não é o seu personagem
- **THEN** o sistema recusa a operação

##### Requirement: Condições
O sistema SHALL permitir que apenas o mestre aplique e remova condições nos combatentes, exibindo-as no tracker para todos os membros.

###### Scenario: Aplicar condição
- **WHEN** o mestre aplica ou remove uma condição em um combatente
- **THEN** a condição passa a ser exibida junto ao combatente para todos os membros

##### Requirement: Encerrar encontro
O sistema SHALL permitir que o mestre encerre o encontro, preservando o registro do encontro encerrado.

###### Scenario: Fim de combate
- **WHEN** o mestre encerra o encontro
- **THEN** o encontro é marcado como encerrado, deixa de ser o encontro ativo da campanha e o fim é registrado no feed

##### Requirement: Estado do combate em tempo real
O sistema SHALL propagar alterações do encontro aos membros conectados à campanha.

###### Scenario: Propagação
- **WHEN** iniciativa, turno, HP, condições ou o conjunto de combatentes mudam
- **THEN** o estado atualizado é propagado em tempo real aos membros conectados

### dice-rolling

#### ADDED Requirements

##### Requirement: Rolagem calculada no servidor
O sistema SHALL calcular todo resultado de rolagem no servidor, e SHALL ignorar qualquer resultado enviado pelo cliente.

###### Scenario: Resultado autoritativo
- **WHEN** um membro solicita uma rolagem
- **THEN** o servidor sorteia os dados, calcula o total e devolve o resultado ao cliente, que apenas o exibe

##### Requirement: Rolagem livre
O sistema SHALL interpretar expressões no formato `NdM` com modificador opcional, publicando o resultado no feed da campanha.

###### Scenario: Rolagem com modificador
- **WHEN** um membro rola uma expressão como `1d20+5` ou `2d6+3`
- **THEN** o sistema exibe os dados individuais, o modificador e o total, e publica o evento no feed da campanha

###### Scenario: Expressão inválida
- **WHEN** um membro envia uma expressão que não pode ser interpretada
- **THEN** o sistema recusa a rolagem com uma mensagem de erro e nada é publicado no feed

##### Requirement: Vantagem e desvantagem
O sistema SHALL suportar rolagem de d20 com vantagem (maior de dois) e desvantagem (menor de dois), exibindo os dois dados.

###### Scenario: Rolagem com vantagem
- **WHEN** um membro rola um d20 com vantagem
- **THEN** o sistema lança dois d20, exibe ambos os resultados e considera o maior

###### Scenario: Rolagem com desvantagem
- **WHEN** um membro rola um d20 com desvantagem
- **THEN** o sistema lança dois d20, exibe ambos os resultados e considera o menor

##### Requirement: Rolagem linkada à ficha
O sistema SHALL usar os modificadores salvos na ficha em rolagens de ataque, teste de habilidade e saving throw disparadas a partir dela.

###### Scenario: Rolagem a partir da ficha
- **WHEN** o dono de um personagem dispara um ataque, um teste de habilidade ou um saving throw a partir da ficha
- **THEN** o sistema aplica automaticamente o modificador correspondente e publica o resultado no feed identificando o personagem

###### Scenario: Ficha alterada
- **WHEN** o dono altera um atributo e dispara a mesma rolagem novamente
- **THEN** o sistema usa o modificador atualizado

##### Requirement: Rolagem secreta do mestre
O sistema SHALL permitir que o mestre marque uma rolagem como secreta, mantendo o resultado invisível para os jogadores.

###### Scenario: Rolagem secreta
- **WHEN** o mestre rola dados marcando a opção "secreta"
- **THEN** o evento é registrado como secreto e o resultado é entregue apenas ao mestre

###### Scenario: Jogador não vê rastro
- **WHEN** um jogador carrega o feed durante uma sessão com rolagens secretas
- **THEN** nada indicativo dessas rolagens é entregue ao cliente do jogador

### session-feed

#### ADDED Requirements

##### Requirement: Feed da campanha
O sistema SHALL manter um feed cronológico de eventos por campanha, sem chat livre, registrando quem originou cada evento e quando.

###### Scenario: Registro de evento
- **WHEN** uma capability da campanha produz um evento (rolagem, alteração de HP, início ou fim de combate)
- **THEN** o evento é persistido no feed daquela campanha com autor e horário

###### Scenario: Leitura do feed
- **WHEN** um membro abre a campanha
- **THEN** ele recebe os eventos recentes do feed que tem permissão de ver, em ordem cronológica

##### Requirement: Canal em tempo real por campanha
O sistema SHALL propagar novos eventos aos membros conectados àquela campanha, sem que precisem recarregar a página.

###### Scenario: Propagação de evento
- **WHEN** um evento é registrado no feed de uma campanha
- **THEN** ele é entregue em tempo real aos membros conectados àquela campanha

###### Scenario: Membro não conectado
- **WHEN** um membro abre a campanha depois de o evento ter ocorrido
- **THEN** ele vê o evento na leitura inicial do feed

##### Requirement: Autorização do canal no servidor
O sistema SHALL validar sessão e participação na campanha antes de aceitar uma conexão no canal, e SHALL recusar conexões de quem não é membro.

###### Scenario: Conexão de membro
- **WHEN** um membro autenticado conecta ao canal de uma campanha da qual participa
- **THEN** a conexão é aceita e ele passa a receber os eventos daquela campanha

###### Scenario: Conexão de não-membro
- **WHEN** um usuário que não é membro tenta conectar ao canal da campanha
- **THEN** o sistema recusa a conexão e nenhum evento é entregue

###### Scenario: Isolamento entre campanhas
- **WHEN** um evento é registrado em uma campanha
- **THEN** ele não é entregue a conexões de outras campanhas

##### Requirement: Filtragem de eventos secretos
O sistema SHALL decidir no servidor quais eventos cada destinatário recebe, e SHALL nunca enviar o conteúdo de um evento secreto a quem não é o mestre.

###### Scenario: Evento secreto
- **WHEN** um evento marcado como secreto é registrado
- **THEN** ele é entregue apenas ao mestre e não aparece, em nenhuma forma, no que é enviado aos jogadores

##### Requirement: Recuperação após queda de conexão
O sistema SHALL permitir que um cliente reconecte e obtenha o estado atual do feed sem depender de eventos perdidos.

###### Scenario: Reconexão
- **WHEN** um cliente perde a conexão e reconecta
- **THEN** ele recarrega o feed a partir do servidor e volta a receber eventos novos, sem lacunas visíveis para o usuário

### user-auth

#### ADDED Requirements

##### Requirement: Login via Discord
O sistema SHALL autenticar usuários exclusivamente pelo fluxo OAuth do Discord, criando a conta no primeiro acesso.

###### Scenario: Primeiro acesso
- **WHEN** um visitante autoriza o aplicativo no Discord e retorna ao callback
- **THEN** o sistema cria a conta a partir do perfil do Discord, inicia a sessão e redireciona para a listagem de campanhas

###### Scenario: Acesso subsequente
- **WHEN** um usuário já cadastrado autoriza o aplicativo no Discord
- **THEN** o sistema reconhece a conta existente pelo identificador do Discord e inicia a sessão sem duplicar o usuário

###### Scenario: Autorização recusada
- **WHEN** o usuário recusa a autorização no Discord ou o callback retorna erro
- **THEN** o sistema exibe uma mensagem de falha de login e nenhuma sessão é criada

##### Requirement: Perfil derivado do Discord
O sistema SHALL usar nome de exibição e avatar do Discord como perfil do usuário, atualizando-os a cada login.

###### Scenario: Exibição do perfil
- **WHEN** um usuário autenticado aparece para outros membros de uma campanha
- **THEN** ele é exibido com o nome e o avatar vindos do Discord

###### Scenario: Perfil alterado no Discord
- **WHEN** um usuário altera nome ou avatar no Discord e faz login novamente
- **THEN** o sistema atualiza os dados locais com os valores mais recentes

##### Requirement: Sessão persistente
O sistema SHALL manter a sessão do usuário em cookie ao longo de visitas no mesmo navegador.

###### Scenario: Reabrir o aplicativo
- **WHEN** um usuário autenticado reabre o aplicativo no mesmo navegador antes da expiração da sessão
- **THEN** ele permanece autenticado sem repetir o fluxo do Discord

##### Requirement: Logout
O sistema SHALL permitir encerrar a sessão.

###### Scenario: Encerramento da sessão
- **WHEN** um usuário autenticado aciona logout
- **THEN** a sessão é invalidada no servidor, o cookie é removido e o usuário retorna à tela de login

##### Requirement: Proteção de rotas
O sistema SHALL recusar acesso a qualquer rota de dados sem sessão válida.

###### Scenario: Requisição sem sessão
- **WHEN** uma requisição sem sessão válida atinge uma rota de dados
- **THEN** o sistema responde com erro de não autenticado e não expõe nenhum dado

### world-entries

#### ADDED Requirements

##### Requirement: Criar entrada do mundo
O sistema SHALL permitir que apenas o mestre crie entradas dos tipos NPC, Local, Quest e Diário de sessão, com descrição em markdown e visibilidade pública ou privada.

###### Scenario: Criação pelo mestre
- **WHEN** o mestre cria uma entrada escolhendo tipo, título, descrição em markdown e visibilidade
- **THEN** a entrada é salva na campanha com a visibilidade escolhida

###### Scenario: Criação tentada por jogador
- **WHEN** um jogador tenta criar uma entrada do mundo
- **THEN** o sistema recusa a operação

##### Requirement: Visibilidade público/privado
O sistema SHALL aplicar o filtro de visibilidade no servidor: entradas públicas são legíveis por todos os membros e entradas privadas apenas pelo mestre.

###### Scenario: Entrada pública
- **WHEN** uma entrada marcada como pública existe na campanha
- **THEN** todos os membros da campanha podem lê-la

###### Scenario: Entrada privada na listagem
- **WHEN** um jogador lista as entradas da campanha
- **THEN** as entradas privadas não são incluídas na resposta enviada ao cliente

###### Scenario: Acesso direto a entrada privada
- **WHEN** um jogador requisita diretamente uma entrada privada pelo seu identificador
- **THEN** o sistema recusa a operação e não expõe nenhum conteúdo da entrada

##### Requirement: Editar e excluir
O sistema SHALL permitir que apenas o mestre edite ou exclua entradas do mundo.

###### Scenario: Alteração pelo mestre
- **WHEN** o mestre edita ou exclui uma entrada
- **THEN** a alteração passa a valer para todos os membros conforme a visibilidade da entrada

##### Requirement: Status de quest
O sistema SHALL manter um status (ativa, concluída, falha) nas entradas do tipo Quest, atualizável pelo mestre.

###### Scenario: Atualização de status
- **WHEN** o mestre altera o status de uma entrada do tipo Quest
- **THEN** o novo status é exibido na listagem e no detalhe da quest

##### Requirement: Diário de sessão
O sistema SHALL listar entradas do tipo Diário em ordem cronológica pela data da sessão.

###### Scenario: Criação de diário
- **WHEN** o mestre cria uma entrada do tipo Diário com data da sessão e resumo
- **THEN** ela é listada cronologicamente pela data da sessão e segue a regra de visibilidade das demais entradas

##### Requirement: Renderização segura de markdown
O sistema SHALL renderizar o markdown das entradas sem permitir execução de conteúdo ativo.

###### Scenario: Conteúdo com HTML malicioso
- **WHEN** uma entrada contém markdown com HTML ou script embutido
- **THEN** o conteúdo é sanitizado na renderização e nenhum script é executado

## Tarefas

### Estado da implementação — 2026-09-08

Fase 0 concluída, com uma pendência humana. O produto entrega o ciclo login → campanha → convite → membros e sobe em container.

- Entregue e verificado: monorepo com `shared/`, `db/`, `server/` e `client/`; Hono servindo API e SPA no mesmo processo; Drizzle sobre SQLite; OAuth do Discord com `state` contra CSRF; sessão em cookie HttpOnly invalidada no servidor; campanhas, convite, entrada, membros, saída e remoção; `requireAuth` e `requireCampaignRole`; TanStack Router com guarda que consulta a API; telas de login, listagem e campanha.
- Verificação desta sessão: `npm test` com 50 testes aprovados (10 em `shared/`, 40 em `server/`), `npm run typecheck` limpo nos três workspaces, `npm run lint` sem avisos e `npm run build` do SPA. A imagem Docker foi construída e exercitada: migra na subida, responde `/api/health`, recusa rota de dados sem sessão, serve o SPA, preserva o banco no volume entre reinícios e roda como `node`, não root.
- Defeitos encontrados na verificação e corrigidos: ordem instável dos membros quando várias entradas caem no mesmo segundo; as container queries de `campanha.css` não valiam fora do `AppShell`, por falta de contexto de container; e o limiar de duas colunas era inalcançável na largura da página. Os dois primeiros ganharam teste; o terceiro é afirmado por medição na verificação de interface.
- Decisões registradas no `design.md`: driver `better-sqlite3` em vez do `node:sqlite` experimental.
- **Bloqueio humano na 1.5:** as variáveis estão documentadas em `.env.example` e no README, mas registrar a aplicação no Discord Developer Portal exige uma conta Discord e não pode ser feito pelo agente. Até lá o login não roda de ponta a ponta contra o Discord real — a suíte cobre o fluxo com um provedor falso, e `npm run db:seed` abre a interface sem passar pelo Discord.
- `db/src/seed.ts` antecipa parte da tarefa 5.2; a campanha de exemplo completa, com personagens e statblock, continua pendente para o fechamento do MVP.

#### Fase 1 em andamento

O servidor da fase 1 está completo e verde; falta a tela do cliente (2.9), que consome o feed ao vivo e refaz o fetch na reconexão.

- `shared/` ganhou o parser de expressões (`dice.ts`) e os modificadores 5e (`modifiers.ts`), ambos com testes unitários. O parser aceita `NdM` com modificador assinado, rejeita espaços ao redor do `d`, limita contagem/lados/modificador, e o rolador exclui do total o d20 descartado em vantagem/desvantagem. Ordenação estável do feed dentro do mesmo segundo usa `rowid` como desempate (UUID aleatório não ordena por inserção).
- `db/` ganhou `assets`, `characters` e `session_events` (migração `0001`). `characters` guarda atributos, perícias, saves, ataques e features como JSON; `session_events.payload` também.
- `server/` ganhou: upload de `Asset` (multipart, mime e 5 MB validados, store em disco atrás de abstração com store de memória nos testes); CRUD de ficha com RBAC (dono edita/rola, mestre e dono excluem, membros leem); feed persistido (`recordRollEvent`/`readFeed` com filtro de secreto); canal WebSocket por campanha (`attachWebSocket` validando sessão e papel **antes** do upgrade, `EventHub` com room por campanha); rolagem livre, vantagem/desvantagem, rolagem linkada à ficha (ataque usa bônus salvo, teste de atributo usa o modificador, saving throw soma proficiência quando a ficha é proficiente) e rolagem secreta só do mestre. O servidor HTTP é montado com `getRequestListener` em vez de `serve()` para que o upgrade do WS pertença ao app (o `serve()` registraría o próprio listener de upgrade).
- Testes: 29 em `shared/` e 80 em `server/` (CRUD/RBAC de fichas, upload, rolagens, feed e WebSocket real — a suíte sobe um servidor de verdade em porta efêmera e conecta sockets `ws`).
- Ajuste em `server/src/testing.ts`: `asUser` só força `content-type: application/json` quando o corpo não é `FormData`, para não quebrar o multipart do upload.
- `ws` entrou como dependência direta do `server` (já era transitiva via Hono) e `@types/ws` como dev.

### 1. Fase 0 — Fundação e primeira fatia vertical (entregável)

Meta: um usuário loga com o Discord, cria uma campanha, convida alguém e vê a lista de membros. Ao fim desta fase o produto sobe em produção.

- [x] 1.1 `git init`, `.gitignore` e estrutura do monorepo (`client/`, `server/`, `shared/`, `db/`)
- [x] 1.2 Scaffold `client/` com Vite + React + TypeScript + TanStack Router
- [x] 1.3 Scaffold `server/` com Hono em Node, servindo o build do `client/` e um `/api/health`
- [x] 1.4 Drizzle + SQLite: conexão, script de migração e primeira migração vazia
- [x] 1.5 Registrar a aplicação no Discord Developer Portal e documentar as variáveis de ambiente (`DISCORD_CLIENT_ID`, `DISCORD_CLIENT_SECRET`, `DISCORD_REDIRECT_URI`)
- [x] 1.6 Fluxo Discord OAuth: rotas de início e callback, criação/atualização de `User` a partir do perfil do Discord
- [x] 1.7 Sessão em cookie HttpOnly, middleware `requireAuth` e rota de logout
- [x] 1.8 Tabelas `Campaign` e `CampaignMember`; criar campanha (criador vira mestre) e listar as campanhas do usuário
- [x] 1.9 Código de convite único e fluxo de entrada na campanha
- [x] 1.10 Página de membros: listar com nome, papel e data de entrada
- [x] 1.11 Sair da campanha (jogador) e remover membro (mestre)
- [x] 1.12 Middleware `requireCampaignRole` — resolve o papel a partir de `CampaignMember` em toda rota de campanha
- [x] 1.13 Testes de integração de RBAC: jogador não remove membro, não-membro não lê a campanha
- [x] 1.14 `Dockerfile` de processo único e README com os passos de self-host

### 2. Fase 1 — Personagens, dados e feed ao vivo

Meta: um jogador cria a ficha e rola um ataque a partir dela; a mesa inteira vê o resultado na hora.

- [x] 2.1 Testes unitários do parser de expressões de dados em `shared/` (`1d20+5`, `2d6+3`, entradas inválidas) — antes da implementação
- [x] 2.2 Implementar o parser até os testes passarem
- [x] 2.3 Testes unitários e implementação de `mod = floor((score - 10) / 2)` e do mapa fixo perícia → atributo em `shared/`
- [x] 2.4 Tabela `Asset` + upload em disco local com limite de tipo e tamanho
- [x] 2.5 Tabela `Character` (com `campaignId`) e CRUD da ficha 5e: raça, classe, nível, atributos, HP, AC, perícias, ataques/features, descrição, avatar
- [x] 2.6 Permissões da ficha: dono edita, membros da campanha leem
- [x] 2.7 Tabela `SessionEvent` e endpoint de leitura do feed da campanha
- [x] 2.8 Canal WebSocket no servidor Hono: room por campanha, autorização no handshake, broadcast de `session.event`
- [ ] 2.9 Cliente conecta ao WS, renderiza o feed e refaz o fetch do estado ao reconectar
- [x] 2.10 Rolagem livre server-side, publicada no feed
- [x] 2.11 Vantagem e desvantagem (dois d20, ambos exibidos)
- [x] 2.12 Rolagens linkadas à ficha: ataque, teste de habilidade e saving throw usando os modificadores salvos
- [x] 2.13 Rolagem secreta do mestre — filtrada no servidor, nunca enviada aos jogadores
- [x] 2.14 Teste de integração: o payload do feed recebido por um jogador não contém rolagem secreta

### 3. Fase 2 — Combate e bestiário

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

### 4. Fase 3 — Mundo

Meta: o mestre guarda NPCs, locais, quests e diários no mesmo lugar da mesa.

- [ ] 4.1 Tabela `WorldEntry` e CRUD de entradas com corpo em markdown
- [ ] 4.2 Tipos NPC, Local, Quest e Diário; status de quest e data de sessão
- [ ] 4.3 Visibilidade público/privado, com o filtro aplicado no servidor
- [ ] 4.4 Listagem e página de detalhe, com renderização de markdown sanitizada
- [ ] 4.5 Diários listados cronologicamente pela data da sessão
- [ ] 4.6 Teste de integração: entrada privada não aparece na listagem nem no detalhe para jogador

### 5. Fechamento do MVP

- [ ] 5.1 Validação de formulários e tratamento de erros de ponta a ponta
- [ ] 5.2 Seed com campanha de exemplo (mestre, jogador, personagens, statblock, NPC, quest)
- [ ] 5.3 README final: pré-requisito do Discord Developer Portal, variáveis de ambiente, execução local e self-host
- [ ] 5.4 `openspec validate mvp-campaign-management` e `openspec status`
