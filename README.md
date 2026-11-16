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
| `APP_URL` | não | Endereço público sem barra final, usado nos links absolutos da prévia do convite (padrão: origem de `DISCORD_REDIRECT_URI`) |
| `PORT` | não | Porta do processo (padrão `3000`) |
| `DB_FILE` | não | Arquivo SQLite, relativo à raiz (padrão `quest-fast.db`) |
| `CLIENT_DIR` | não | Build do SPA, relativo à raiz (padrão `client/dist`) |
| `UPLOADS_DIR` | não | Avatares e uploads em disco, caminho absoluto ou relativo à raiz (padrão `uploads`) |
| `ASSET_STORAGE` | não | `disk` (padrão) ou `r2`. Veja [Avatares no Cloudflare R2](#avatares-no-cloudflare-r2-opcional) |
| `R2_ACCOUNT_ID` | com `r2` | ID da conta Cloudflare |
| `R2_ACCESS_KEY_ID` | com `r2` | Chave de acesso do token de API do R2 |
| `R2_SECRET_ACCESS_KEY` | com `r2` | Segredo do token de API do R2 |
| `R2_BUCKET` | com `r2` | Nome do bucket |
| `R2_PUBLIC_URL` | com `r2` | URL pública do bucket, como `https://cdn.seu-dominio` |
| `COOKIE_SECURE` | não | `true` atrás de HTTPS; cookies `Secure` não valem em HTTP |
| `TRUST_PROXY` | não | `true` atrás de proxy reverso: o limite de tentativas do convite lê o visitante em `X-Forwarded-For`. Exige que o app só seja alcançável pelo proxy |

## Testar a prévia do convite com túnel

O WhatsApp e o Discord só leem a prévia de um link público, então `localhost`
não serve. Para testar de ponta a ponta com um túnel do Cloudflare:

1. `npm run build`
2. Instale o [`cloudflared`](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/)
   e, em outro terminal, rode `cloudflared tunnel --url http://localhost:3000`.
   Copie a URL `https://...trycloudflare.com` que ele imprime.
3. No `.env`, aponte `APP_URL` para essa URL e `DISCORD_REDIRECT_URI` para
   `<url do túnel>/api/auth/discord/callback`. Cadastre essa Redirect URI
   também na aplicação do Discord.
4. `npm start`
5. Abra o app pela URL do túnel (não por `localhost`) e entre com o Discord de
   novo: a sessão é por domínio. O link que o botão Copiar entrega usa a origem
   da página aberta, então só sai com o endereço do túnel se o mestre abriu o
   app por ele.
6. Mande o link `<url do túnel>/invite/<código>` de uma mesa no WhatsApp e
   confira título, descrição e imagem.

A URL do túnel muda a cada execução: depois do teste, volte o `.env` e remova
a Redirect URI extra do Discord.

## Self-host com Docker

Um processo, um artefato, sem orquestração.

```sh
docker build -t quest-fast .
docker run -d --name quest-fast \
  -p 127.0.0.1:3000:3000 \
  -v quest-fast-dados:/dados \
  -e DISCORD_CLIENT_ID=... \
  -e DISCORD_CLIENT_SECRET=... \
  -e DISCORD_REDIRECT_URI=https://seu-dominio/api/auth/discord/callback \
  -e COOKIE_SECURE=true \
  -e TRUST_PROXY=true \
  quest-fast
```

As migrações são aplicadas na subida do container. O banco e os uploads ficam
em `/dados`, num volume: **backup é copiar esse diretório**.

Coloque um proxy reverso com HTTPS na frente. Sem HTTPS, `COOKIE_SECURE=true`
impede o login; sem `Secure`, o cookie de sessão trafega em claro. Com o proxy
na frente, mantenha `TRUST_PROXY=true`: sem isso, todo visitante chega com o
endereço do proxy e divide o mesmo limite de tentativas do convite. O proxy
precisa acrescentar o endereço do visitante ao `X-Forwarded-For` (o padrão no
Caddy e no `proxy_add_x_forwarded_for` do nginx).

`TRUST_PROXY=true` só é seguro se o app for alcançável **apenas** pelo proxy:
quem chega direto na porta 3000 escolhe o próprio `X-Forwarded-For` e ganha um
limite novo a cada requisição. Por isso o exemplo publica a porta só em
`127.0.0.1`, para um proxy no mesmo host. Com o proxy em outro container, não
publique a porta: ponha os dois na mesma rede do Docker.

### Numa VM com Caddy e backup no R2

A pasta [`deploy/`](deploy/) monta esse arranjo numa VM Debian 12: o Caddy
termina o HTTPS (certificado automático do Let's Encrypt) e é o único caminho
até o app, que não publica porta. O banco e os uploads ficam em
`/srv/quest-fast/dados`, e um timer do systemd manda um backup diário para um
bucket **privado** do R2.

| Arquivo | Papel |
| --- | --- |
| `compose.yaml`, `Caddyfile` | app e proxy; `SITE_ADDRESS` vem do `.env` ao lado |
| `setup-vm.sh` | Docker, atualizações automáticas, pasta de dados e timer do backup |
| `ship.sh` | builda a imagem na sua máquina e a sobe na VM pelo `gcloud` |
| `backup.sh` | cópia consistente do SQLite (API de backup) e dos uploads para o R2 |
| `app.env.example`, `backup.env.example` | segredos; na VM, `chmod 600`, um arquivo para cada |

O token do backup fica fora do `app.env`, então o app nunca o enxerga.

**Sem domínio**, use o [sslip.io](https://sslip.io): o IP `34.1.2.3` vira
`34-1-2-3.sslip.io`, nome para o qual o Caddy consegue certificado. Reserve um
IP estático para o nome não mudar. Os avatares ficam em disco: o R2 só serve
avatares com domínio próprio (veja a seção seguinte).

No GCP, a `e2-micro` entra no nível gratuito nas regiões `us-central1`,
`us-east1` e `us-west1`, com disco `pd-standard` de até 30 GB. Ela não tem
memória para o build, por isso o `ship.sh` builda localmente. Para a VM não
expor SSH à internet, libere a porta 22 só para o IAP (`35.235.240.0/20`) e
use `--tunnel-through-iap`; para a web, só 80 e 443.

```sh
gcloud compute scp --tunnel-through-iap deploy/setup-vm.sh <vm>:/tmp/
gcloud compute ssh <vm> --tunnel-through-iap --command "sudo sh /tmp/setup-vm.sh"
# na VM: /srv/quest-fast/.env (SITE_ADDRESS), app.env e backup.env
sh deploy/ship.sh          # GCLOUD_CONFIG e VM escolhem a configuração e a VM
```

O bucket de backup não tem acesso público (nem domínio, nem `r2.dev`). Em
**Settings → Object lifecycle rules**, crie uma regra que apaga objetos com
mais de 30 dias, para os backups não acumularem.

Para conferir o backup, rode `sudo systemctl start quest-fast-backup` na VM e
veja `journalctl -u quest-fast-backup`. Para restaurar, pare o app, extraia o
arquivo em `/srv/quest-fast/dados`, renomeie `backup.db` para
`quest-fast.db` (apagando `-wal` e `-shm` antigos), acerte o dono para
`1000:1000` e suba de novo.

### Avatares no Cloudflare R2 (opcional)

Por padrão os avatares ficam em disco, ao lado do banco. Com
`ASSET_STORAGE=r2`, os envios novos vão para um bucket do Cloudflare R2 e o
navegador carrega as imagens direto da rede da Cloudflare, sem passar pelo
servidor. O porquê está em
[`docs/architecture.md`](docs/architecture.md#armazenamento-de-arquivos).

1. No painel da Cloudflare, em **R2**, crie um bucket.
2. Ligue um domínio seu ao bucket (por exemplo `cdn.seu-dominio`), para que ele
   tenha acesso público. O domínio precisa estar na Cloudflare. A URL
   `r2.dev` que o R2 oferece tem limite de requisições e serve só para teste.
3. Crie um token de API do R2 com permissão de leitura e escrita de objetos,
   restrito a esse bucket. Guarde o Access Key ID e o Secret Access Key: o
   segredo só aparece uma vez.
4. Preencha as variáveis `ASSET_STORAGE=r2` e `R2_*` (o Account ID aparece no
   painel do R2) e reinicie o servidor. Na subida, ele mostra qual armazenamento
   está em uso.

**Avatares que já estavam em disco:** a URL de cada avatar é montada a partir
do caminho salvo no banco (`campaigns/<campanha>/<arquivo>`), e no bucket a
chave é o mesmo caminho. Ao ligar o R2, copie o conteúdo de `UPLOADS_DIR` para
o bucket mantendo a estrutura de pastas (por exemplo, com `rclone copy` ou
`aws s3 sync` apontando para o endpoint do R2). Sem essa cópia, os avatares
antigos deixam de aparecer. O servidor continua servindo `/uploads`, então
voltar para `disk` não perde nada que ainda esteja no disco.

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
npm run simulate:encounter   # uma sessão inteira, visível, com mestre e quatro jogadores
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
