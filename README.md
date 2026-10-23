# quest-fast

Plataforma self-hosted para mestrar e jogar D&D 5e. A plataforma **é a mesa**:
ficha, dados, combate e mundo acontecem dentro dela. O Discord fica só com voz
e roleplay; a única integração é o login.

Feita para uma mesa própria: um processo, um arquivo SQLite, sem serviço
externo além do OAuth do Discord.

## O que já funciona

- **Mesa:** login pelo Discord, campanhas, convite por código, membros com
  papel de mestre ou jogador.
- **Ficha oficial de D&D 2024:** identidade, atributos, perícias com
  especialização, combate, conjuração, inventário e personalidade. PV, dados
  de vida, salvaguardas contra morte e moedas são atualizados durante a sessão
  sem abrir o editor.
- **Dados:** rolagem livre e pela ficha (atributo, perícia, salvaguarda,
  ataque, iniciativa, ataque mágico), vantagem e desvantagem, rolagem secreta
  do mestre. Toda rolagem é feita no servidor.
- **Feed ao vivo:** a mesa vê cada rolagem na hora, por WebSocket, com
  histórico paginado.

Combate com bestiário, mundo (NPCs, locais, quests, diários) e o campo de
batalha (VTT) são as próximas etapas: veja o [roadmap](docs/roadmap.md).

## Stack

| Parte | Tecnologia |
| --- | --- |
| Interface | Vite, React 19, TanStack Router e Query, Tailwind 4, Radix, Storybook |
| Servidor | Node 22 executando TypeScript direto, Hono, WebSocket (`ws`) |
| Dados | SQLite com Drizzle ORM (`better-sqlite3`) |
| Regras 5e | Pacote `shared/` com funções puras, usado pelos dois lados |
| Login | Discord OAuth (escopo `identify`), sessão em cookie HttpOnly |

```
client/   SPA React, design system e Storybook
server/   Hono: API REST, auth, WebSocket e arquivos estáticos
shared/   tipos da API e regras 5e puras
db/       schema Drizzle, migrações e seed
docs/     arquitetura, roadmap, design system e histórico
scripts/  verificações (tokens de cor, Storybook, fluxos contra o app)
```

Como as peças se encaixam e por quê:
[`docs/architecture.md`](docs/architecture.md).

## Início rápido

Pré-requisitos: Node.js **22.18 ou superior** (o `.nvmrc` fixa a linha 22;
rode `nvm use`) e Git.

```sh
npm ci
cp .env.example .env      # preencha as três variáveis do Discord
npm run db:migrate
npm run db:seed           # campanha de exemplo + cookie de sessão
npm run build
npm run dev               # http://localhost:3000
```

Sem uma aplicação no Discord, o servidor não sobe. Para ver as telas sem
fazer login de verdade, copie o valor impresso pelo `db:seed` para um cookie
`qf_session` em `localhost`: você entra como mestre da campanha de exemplo.

Os comandos rodam com o diretório de trabalho na raiz do repositório. O `.env`
é carregado por `--env-file-if-exists`, e `DB_FILE`, `CLIENT_DIR` e
`UPLOADS_DIR` são relativos à raiz, então migração, seed e servidor usam o
mesmo banco.

## Aplicação no Discord

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

## Modos de desenvolvimento

**Uma porta só**, o mais próximo de produção e o modo para testar o login de
ponta a ponta:

```sh
npm run build
npm run dev               # SPA buildado + API em http://localhost:3000
```

**Recarga a quente da interface**, em dois terminais:

```sh
npm run dev               # API na porta 3000
npm run dev:client        # SPA em http://localhost:5273, com proxy de /api e /uploads
```

Para o login funcionar nesse modo, aponte `DISCORD_REDIRECT_URI` para a porta
5273 e cadastre essa URI no Discord também. A porta é fixa (`strictPort`): se
estiver ocupada, o Vite falha em vez de trocar de porta em silêncio e quebrar
a Redirect URI.

**Storybook**, o catálogo de componentes: `npm run storybook`
(<http://localhost:6006>).

## Variáveis de ambiente

| Variável | Obrigatória | Para que serve |
| --- | --- | --- |
| `DISCORD_CLIENT_ID` | sim | Client ID da aplicação no Discord |
| `DISCORD_CLIENT_SECRET` | sim | Client Secret da aplicação |
| `DISCORD_REDIRECT_URI` | sim | Precisa ser idêntica à cadastrada no Discord |
| `PORT` | não | Porta do processo (padrão `3000`) |
| `DB_FILE` | não | Arquivo SQLite, relativo à raiz (padrão `quest-fast.db`) |
| `CLIENT_DIR` | não | Build do SPA, relativo à raiz (padrão `client/dist`) |
| `UPLOADS_DIR` | não | Avatares e uploads em disco, caminho absoluto ou relativo à raiz (padrão `uploads`) |
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

As migrações são aplicadas na subida do container. O banco e os uploads ficam
em `/dados`, num volume: **backup é copiar esse diretório**.

Coloque um proxy reverso com HTTPS na frente. Sem HTTPS, `COOKIE_SECURE=true`
impede o login; sem `Secure`, o cookie de sessão trafega em claro.

## Verificação

```sh
npm test              # unitários (shared) e integração (server)
npm run typecheck     # shared, db e server
npm run lint          # client, incluindo a regra que proíbe cor crua
npm run build         # build do SPA
npm run test:tokens   # testes da regra que proíbe cor crua
npm run test:design   # constrói o Storybook e audita com Playwright + axe
npm run doctor        # React Doctor; o merge exige saúde 100
npm run verify:app <cookie>  # fluxo real contra o app rodando
npm run verify:group         # fluxos de grupo e WebSocket contra o app rodando
```

Os `verify:` exigem `npm run build && npm run dev` em outro terminal e
`npm run db:seed` antes; `verify:app` recebe o cookie impresso pelo seed. Fora
do Windows, `test:design` e os `verify:` usam Chromium
(`npx playwright install chromium`); no Windows, usam o Chrome instalado
quando existe.

O CI roda testes, tipos, lint, tokens, build e React Doctor em todo PR; os
dois checks são obrigatórios para o merge na `master`.

## Documentação

- [`docs/architecture.md`](docs/architecture.md): arquitetura, fluxos,
  princípios e decisões.
- [`docs/roadmap.md`](docs/roadmap.md): entregue, próximo e em aberto.
- [`docs/design-system.md`](docs/design-system.md): tokens, temas e
  componentes.
- [`docs/README.md`](docs/README.md): índice completo, incluindo o histórico.

## Contribuindo

Issue é bem-vinda de qualquer pessoa: os
[formulários](https://github.com/DanielTrindade/quest-fast/issues/new/choose)
já aplicam a label certa e pedem o commit afetado e os passos de reprodução.

Código entra só por colaborador convidado — um PR de quem não foi convidado é
fechado automaticamente e a conversa continua na issue. O convite sai quando a
issue mostra que vale a pena. Fork para manter a própria versão é livre.

O [`CONTRIBUTING.md`](CONTRIBUTING.md) cobre setup, fluxo de branch e PR,
Storybook primeiro no frontend, convenções de código e o uso (opcional) de
agentes de IA, que leem o [`AGENTS.md`](AGENTS.md).

## Segurança

Falha de segurança não vai em issue pública: reporte pelo
[canal privado](https://github.com/DanielTrindade/quest-fast/security/advisories/new).
O escopo, as áreas sensíveis e os prazos estão no
[`SECURITY.md`](SECURITY.md).

## Licença

[MIT](LICENSE): use, modifique e rode a sua própria mesa como quiser, mantendo
o aviso de copyright.

A licença cobre o código deste repositório. D&D e os nomes de produto da
Wizards of the Coast são marcas dela; o projeto implementa as regras e não
redistribui material de regra. Quando o compêndio SRD do
[`docs/roadmap.md`](docs/roadmap.md) entrar, ele vem com a atribuição que a
licença do SRD exigir.
