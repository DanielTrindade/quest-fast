# quest-fast

Plataforma para mestrar e jogar D&D 5e. A plataforma **é a mesa**: ficha, dados,
combate e mundo acontecem dentro dela. O Discord fica apenas com voz e roleplay.

Feita para uma mesa própria, **self-hosted**. Não é SaaS.

## Estado atual

A fase 0 do MVP está implementada: login pelo Discord, criação de campanha,
código de convite, entrada, lista de membros, saída e remoção. A fase 1
(personagens, dados e feed ao vivo) está em andamento — o servidor está
completo; a interface emite as fichas, as rolagens e o feed. Combate e mundo
pertencem às fases seguintes; o campo de batalha (VTT) é uma mudança à parte.

## Pré-requisito: aplicação no Discord

O servidor **não sobe** sem credenciais do Discord. Antes de qualquer coisa:

1. Acesse <https://discord.com/developers/applications> e crie uma aplicação.
2. Em **OAuth2**, copie o **Client ID** e gere o **Client Secret**.
3. Ainda em **OAuth2**, cadastre a **Redirect URI**. Em desenvolvimento local:

   ```
   http://localhost:3000/api/auth/discord/callback
   ```

   O Discord recusa o login se houver qualquer diferença entre a URI cadastrada
   e a configurada, inclusive barra final. Em produção, use o seu domínio com
   `https`.

Pedimos apenas o escopo `identify`: nome e avatar. Nada de e-mail, servidores
ou mensagens.

## Executar localmente

```sh
npm ci
cp .env.example .env      # preencha as três variáveis do Discord
npm run db:migrate
```

Os comandos rodam com o diretório de trabalho na raiz do repositório, e o
`.env` é carregado por `--env-file-if-exists`. Por isso `DB_FILE` e `CLIENT_DIR`
são relativos à raiz, e migração, seed e servidor usam o mesmo arquivo.

### Modo A — uma porta só (o mais próximo de produção)

```sh
npm run build
npm run dev               # SPA buildado + API em http://localhost:3000
```

A Redirect URI é `http://localhost:3000/api/auth/discord/callback`. É o modo
para testar o login do Discord de ponta a ponta.

### Modo B — recarga a quente da interface

Em dois terminais:

```sh
npm run dev               # API na porta 3000
npm run dev:client        # SPA na porta 5273, com proxy de /api para a 3000
```

Abra <http://localhost:5273>. Para o login funcionar neste modo, troque
`DISCORD_REDIRECT_URI` para a porta 5273 e cadastre essa URI no Discord também.

A porta 5273 é fixa (`strictPort`), e não a 5173 padrão do Vite: se estiver
ocupada, ele falha em vez de mudar de porta em silêncio, o que quebraria a
Redirect URI cadastrada.

Para ver as telas sem passar pelo Discord, o seed cria uma campanha de exemplo
e imprime um cookie de sessão válido:

```sh
npm run db:seed
```

Copie o valor impresso para um cookie `qf_session` no navegador, em
`localhost`, e abra a aplicação já autenticado como mestre.

## Variáveis de ambiente

| Variável | Obrigatória | Para que serve |
| --- | --- | --- |
| `DISCORD_CLIENT_ID` | sim | Client ID da aplicação no Discord |
| `DISCORD_CLIENT_SECRET` | sim | Client Secret da aplicação |
| `DISCORD_REDIRECT_URI` | sim | Precisa ser idêntica à cadastrada no Discord |
| `PORT` | não | Porta do processo (padrão `3000`) |
| `DB_FILE` | não | Arquivo SQLite, relativo à raiz (padrão `quest-fast.db`) |
| `CLIENT_DIR` | não | Build do SPA, relativo à raiz (padrão `client/dist`) |
| `UPLOADS_DIR` | não | Avatares e uploads em disco, relativo à raiz (padrão `uploads`) |
| `COOKIE_SECURE` | não | `true` atrás de HTTPS; cookies `Secure` não valem em HTTP |

## Self-host com Docker

Um processo, um artefato, sem orquestração.

```sh
docker build -t quest-fast .
docker run -d --name quest-fast \
  -p 3000:3000 \
  -v quest-fast-dados:/dados \
  -e DISCORD_CLIENT_ID=... \
  -e DISCORD_CLIENT_SECRET=... \
  -e DISCORD_REDIRECT_URI=https://seu-dominio/api/auth/discord/callback \
  -e COOKIE_SECURE=true \
  quest-fast
```

As migrações são aplicadas na subida do container. O banco fica em `/dados`,
num volume: **backup é copiar esse arquivo**.

Coloque um proxy reverso com HTTPS à frente. Sem HTTPS, `COOKIE_SECURE=true`
impede o login, e sem `Secure` o cookie de sessão trafega em claro.

## Estrutura

```
client/   Vite + React + TS + TanStack Router + TanStack Query
server/   Hono: rotas REST, auth, WebSocket, estáticos
shared/   tipos e regras 5e puras, usadas pelos dois lados
db/       Drizzle + SQLite, schema e migrações
```

O cliente **nunca** é fonte de verdade: rolagens, papéis e visibilidade são
calculados e autorizados no servidor.

## Verificação

```sh
npm test          # testes unitários de shared/ e de integração do servidor
npm run typecheck # shared, db e server
npm run lint      # client, incluindo a regra que proíbe cor crua
npm run build     # build do SPA
npm run test:design  # auditoria do design system no Storybook
```

O catálogo de componentes abre com `npm run storybook`. As decisões de design
estão em [`docs/design-system.md`](docs/design-system.md); as de produto e
arquitetura, em `openspec/`.
