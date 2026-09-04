## Why

Rodar D&D 5e online hoje exige costurar cinco serviços (Discord + Avrae + DiceCloud + Owlbear Rodeo + Kanka), cada um com sua conta, seu link e seu modelo mental. O `quest-fast` constrói **a mesa inteira em um só lugar**: ficha, dados, combate, mundo e — em change posterior — o campo de batalha. O Discord permanece **apenas para voz e roleplay**.

**Por que construir em vez de usar o Quest Portal (gratuito e mais completo hoje).** Esta é uma decisão consciente, não um descuido. O Quest Portal já entrega mapas, tokens, fog of war, iluminação dinâmica e notas de graça. Construímos assim mesmo porque: (a) a mesa é **self-hosted** — os dados da campanha ficam no servidor do mestre, sem depender da sobrevivência ou do modelo de negócio de um terceiro; (b) o produto pode ser **opinado para uma mesa específica** em vez de genérico para todas; (c) é PT-BR de ponta a ponta. Se essas três razões deixarem de valer, o projeto perde sua justificativa.

## What Changes

- Produto web novo, do zero (o repositório hoje contém apenas o guia em Markdown).
- Entrega o ciclo de valor completo de uma sessão **sem VTT**: conta → campanha → personagens → rolagem linkada à ficha → combate com bestiário → conteúdo do mundo, com feed da sessão ao vivo.
- Login exclusivamente por **Discord OAuth**; não há cadastro por email/senha no MVP.
- **Campo de batalha (VTT) fica fora deste change** e é tratado em `vtt-battlefield`. Até lá, mapas continuam no Owlbear Rodeo.
- Nenhuma integração com Discord além do OAuth: sem bot, sem webhook, sem sincronização de canais.

## Capabilities

### New Capabilities

- `user-auth`: login via Discord OAuth, sessão persistente em cookie e perfil derivado do Discord.
- `campaigns`: criação de campanha, código de convite, entrada, saída, remoção de membros e papéis (mestre/jogador).
- `characters`: fichas D&D 5e criadas dentro de uma campanha, editáveis pelo dono e legíveis pelos membros.
- `session-feed`: o canal em tempo real da campanha — registra e propaga eventos (rolagens, combate) para os membros conectados.
- `dice-rolling`: rolagem de expressões, vantagem/desvantagem, rolagens linkadas à ficha e rolagem secreta do mestre.
- `combat-tracker`: encontros, iniciativa, turnos, HP, condições e bestiário reutilizável da campanha.
- `world-entries`: NPCs, locais, quests e diários de sessão com visibilidade público/privado.

### Modified Capabilities

Nenhuma — repositório novo, sem capacidades existentes.

## Non-Goals

- Campo de batalha, tokens, grid e fog of war (change `vtt-battlefield`).
- Chat livre, voz e vídeo — permanecem no Discord.
- Bot do Discord, webhooks ou qualquer sincronização de conteúdo com o Discord.
- Motor de cálculo derivado na ficha (equipamento alterando AC/HP automaticamente).
- Conteúdo SRD ou livros oficiais; o mestre digita ataques, features e statblocks.
- Multi-tenancy, billing, aplicativo mobile e IA.
- Cadastro por email/senha e recuperação de senha.

## Impact

- Repositório `quest-fast`, hoje apenas Markdown, passa a hospedar um monorepo leve: `client/`, `server/`, `shared/`, `db/`.
- Stack nova: Vite + React + TypeScript (SPA), Hono em Node (REST + WebSocket + estáticos), Drizzle ORM + SQLite, Discord OAuth.
- Um único processo em produção; um `Dockerfile`; sem Docker Compose e sem Postgres no MVP.
- **Pré-requisito operacional:** o app não inicia sem uma aplicação registrada no Discord Developer Portal (client id, client secret e redirect URI).
- Uploads de imagem gravados em disco local atrás de uma abstração `Asset`, já preparada para o volume de mapas do change `vtt-battlefield`.
