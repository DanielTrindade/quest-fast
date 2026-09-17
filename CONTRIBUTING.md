# Contribuindo com o quest-fast

Este guia é para pessoas. Agentes de IA seguem o [`AGENTS.md`](AGENTS.md); as
regras são as mesmas, mas o recorte aqui é o do trabalho humano.

## Pré-requisitos

- Node.js **22.18 ou superior** — o projeto executa TypeScript direto com
  `node` e usa `--env-file-if-exists`; o Docker usa `node:22`. O `.nvmrc` fixa
  a linha 22: rode `nvm use` antes de instalar as dependências.
- Git.
- Uma aplicação no Discord para o login, com a Redirect URI cadastrada
  (passo a passo no [`README.md`](README.md)).

`npm ci` na raiz instala todos os workspaces (`shared`, `db`, `server` e
`client`); não rode `npm install` dentro dos workspaces.

## Primeiro setup

Na raiz do repositório:

```sh
npm ci
cp .env.example .env      # preencha as credenciais do Discord
npm run db:migrate
npm run db:seed           # campanha de exemplo + cookie de sessão
```

Detalhes que costumam quebrar o ambiente:

- O diretório de trabalho é sempre a raiz do repositório. `DB_FILE`,
  `CLIENT_DIR` e `UPLOADS_DIR` são relativos a ela, e o mesmo `.env` vale para
  migração, seed e servidor.
- A Redirect URI do Discord precisa ser idêntica à configurada no `.env`,
  inclusive porta e barra final. Os dois modos de desenvolvimento usam portas
  diferentes (3000 e 5273); cadastre as duas.
- O `.env` não é versionado. Nunca coloque segredo em arquivo versionado.
- Fora do Windows, os scripts de verificação usam Chromium: instale com
  `npx playwright install chromium`. No Windows, o Chrome instalado é usado
  quando existe.

## Fluxo de trabalho

1. Combine o que vai ser feito antes de escrever código (issue ou conversa).
2. Crie um branch a partir da `master`, com nome curto: `feat/nome-curto`,
   `fix/nome-curto`, `docs/nome-curto` ou `chore/nome-curto`.
3. Commits pequenos, cada um com uma mudança coerente.
4. Rode a verificação mínima antes de abrir o PR.
5. Abra o PR contra a `master` descrevendo o que muda e por quê; referencie o
   change do OpenSpec quando houver.

`master` não recebe commit direto: tudo entra por branch e PR revisado.

## Mudanças de produto: OpenSpec

Toda mudança de produto — funcionalidade nova, mudança de comportamento,
alteração de contrato — nasce como um *change* em `openspec/changes/`, não
como código solto. O change reúne:

- `proposal.md` — o que e por quê, com **Non-goals** explícitos;
- `design.md` — como, com decisões e alternativas descartadas;
- `specs/` — specs delta da capacidade afetada;
- `tasks.md` — implementação fatiada verticalmente, com tasks de teste para
  lógica pura e RBAC.

O fluxo, com os atalhos do opencode:

| Comando | O que faz |
| --- | --- |
| `/opsx-propose` | Cria o change e gera proposal, design, specs e tasks |
| `/opsx-apply` | Implementa as tasks, marcando cada uma no `tasks.md` |
| `/opsx-sync` | Sincroniza as specs delta com as specs principais em `openspec/specs/` |
| `/opsx-archive` | Move o change concluído para `openspec/changes/archive/` |

Sem opencode, produza os mesmos arquivos à mão seguindo
[`openspec/config.yaml`](openspec/config.yaml); o que importa é o registro da
decisão.

Correções de bug e mudanças de documentação podem seguir direto. O fluxo
completo existe para as decisões de produto ficarem registradas.

## Frontend: Storybook primeiro

A fonte de verdade do frontend é o Storybook (`client/src/stories/`):

1. Todo componente nasce como story.
2. `npm run test:design` audita acessibilidade (axe), IDs duplicados, overflow
   em 320/390/768/1280 px, temas claro/escuro e movimento reduzido.
3. Só depois o componente é integrado a `client/src/screens/` e
   `client/src/components/`.

Tokens e decisões estão em [`docs/design-system.md`](docs/design-system.md).
O lint proíbe cor crua e paleta padrão do Tailwind em componentes; use os
tokens de `client/src/styles/`.

## Regras do projeto

- **O servidor é a fonte de verdade.** Rolagens, permissões e visibilidade são
  calculados e autorizados no servidor; o cliente nunca decide.
- **Lógica 5e pura vive em `shared/`**, com testes unitários. Testes de
  integração ficam no `server/`.
- **Idioma:** código é inglês — identificadores, nomes de arquivo e de
  diretório, rotas, campos e valores de JSON, colunas do banco, comentários e
  descrições de teste. Texto visível ao usuário e documentação são pt-BR.
  Mensagens de erro da API são português dentro do campo `error`.
- **Fatias verticais:** cada entrega deve ser usável numa sessão real, nunca
  "metade de uma camada".
- Uma fatia por PR sempre que possível; PR grande demais custa a revisar.

## Commits

Conventional Commits, com a descrição em português, no presente do indicativo:

```
feat(client): ficha e editor organizados como a ficha oficial
fix(server): limita o tamanho do upload de avatar
docs(design-system): registra a ficha oficial e sua validação
```

Escopos comuns: `client`, `server`, `shared`, `db`, `design-system`, `docs` e
`openspec`. Sem escopo quando a mudança cruza áreas.

## Verificação

Mínima, antes de todo PR:

```sh
npm test          # unitários (shared) e integração (server)
npm run typecheck # shared, db e server
npm run lint      # client, incluindo a regra que proíbe cor crua
npm run build     # build do SPA
```

O CI (`.github/workflows/ci.yml`) roda esse mesmo conjunto, mais
`npm run test:tokens`, em todo PR e push na `master`; resultado vermelho
bloqueia o merge.

`npm run doctor` roda o [React Doctor](https://react.doctor) sobre o projeto,
em modo advisory: reporta achados de qualidade do React sem reprovar. Em cada
PR, o workflow `react-doctor.yml` comenta apenas os achados **novos**
introduzidos pela mudança, também sem bloquear.

Conforme a área tocada:

| Comando | Quando |
| --- | --- |
| `npm run test:design` | Componentes ou stories do cliente |
| `npm run doctor` | Código React do cliente (advisory; o CI comenta no PR) |
| `npm run verify:app <cookie>` | Fluxo de ponta a ponta; exige o app rodando e o cookie impresso pelo seed |
| `npm run verify:group` | Fluxos com vários usuários e WebSocket; exige o app rodando com seed |

`verify:app` e `verify:group` pedem `npm run build && npm run dev` em outro
terminal e `npm run db:seed` antes. `APP_URL` troca o endereço (padrão
`http://localhost:3000`).

## Para onde olhar

- [`README.md`](README.md) — produto, setup, variáveis de ambiente e Docker.
- [`AGENTS.md`](AGENTS.md) — as mesmas regras na versão para agentes.
- [`openspec/`](openspec/) — decisões de produto e arquitetura, specs e changes.
- [`docs/README.md`](docs/README.md) — índice da documentação de design e
  auditorias.
