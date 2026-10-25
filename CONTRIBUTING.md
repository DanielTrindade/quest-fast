# Contribuindo com o quest-fast

Este guia é para pessoas. Agentes de IA seguem o [`AGENTS.md`](AGENTS.md); as
regras são as mesmas, mas o recorte aqui é o do trabalho humano.

Antes de mexer em código, leia a [arquitetura](docs/architecture.md): ela
explica como as peças se encaixam e tem uma tabela de "onde mexer" para os
tipos de mudança mais comuns. O que está em andamento e o que vem a seguir
estão no [roadmap](docs/roadmap.md).

## Quem pode contribuir

O repositório é público e [MIT](LICENSE): qualquer pessoa pode ler o código,
fazer fork e rodar a própria instância.

| Caminho | Quem pode |
| --- | --- |
| Abrir issue | qualquer pessoa, pelos [formulários de issue](https://github.com/DanielTrindade/quest-fast/issues/new/choose) |
| Reportar falha de segurança | qualquer pessoa, pelo [canal privado](SECURITY.md) |
| Abrir PR | só colaborador convidado |
| Fazer fork e manter a própria versão | qualquer pessoa |

**Código entra só por colaborador convidado.** Um PR de quem não foi convidado
é fechado automaticamente por
[`.github/workflows/collaborator-prs.yml`](.github/workflows/collaborator-prs.yml),
com uma mensagem explicando — não é recusa da ideia. O convite sai quando uma
issue mostra que vale a pena, e a partir daí o fluxo é o normal deste guia.

O motivo da regra é o tamanho do projeto: um mantenedor só, um banco, uma
mesa. Revisar código de fora com o cuidado que este guia pede não escala, e
issue bem descrita rende mais do que PR sem contexto — inclusive porque a
implementação pode ser feita por quem já tem o ambiente montado.

Falha de segurança não passa por issue pública: use o
[`SECURITY.md`](SECURITY.md).

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

1. Combine o que vai ser feito antes de escrever código. Colaborador
   convidado pode usar issue ou conversa; quem ainda não é colaborador
   precisa da issue aceita antes, porque um PR sem convite é fechado.
2. Crie um branch a partir da `master`, com nome curto: `feat/nome-curto`,
   `fix/nome-curto`, `docs/nome-curto` ou `chore/nome-curto`.
3. Commits pequenos, cada um com uma mudança coerente.
4. Rode a verificação mínima antes de abrir o PR.
5. Abra o PR contra a `master`. O
   [template do PR](.github/PULL_REQUEST_TEMPLATE.md) já pede o que muda, por
   quê, o que ficou de fora e o checklist de verificação — preenchido, ele
   evita que o revisor tenha de deduzir a intenção do diff.

`master` é protegida: não aceita push direto nem force-push, e o merge só
acontece por PR com os checks obrigatórios verdes (veja
[Verificação](#verificação)).

## Mudanças maiores

Não há framework de planejamento obrigatório: escreva um plano, uma spec, faça
TDD ou vá direto ao código, como preferir. O que o projeto pede é que a
decisão fique registrada onde as próximas pessoas vão procurar:

- **Descrição do PR:** o template pede o que muda, por quê e o que ficou de
  fora. Para mudanças grandes, abra uma issue ou um PR de rascunho antes para
  alinhar o escopo.
- **[`docs/architecture.md`](docs/architecture.md):** atualize no mesmo PR
  se a mudança altera um princípio, uma decisão registrada ou a forma de uma
  peça (novo workspace, novo canal, nova dependência estrutural).
- **[`docs/roadmap.md`](docs/roadmap.md):** atualize se a mudança entrega ou
  muda o escopo de uma etapa.

Correções de bug e ajustes pequenos não precisam de nada além do PR.

O raciocínio das etapas anteriores, com alternativas descartadas, está em
[`docs/history/`](docs/history/). Vale a leitura antes de propor algo que
mexa nessas áreas.

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

Escopos comuns: `client`, `server`, `shared`, `db`, `design-system` e `docs`.
Sem escopo quando a mudança cruza áreas.

## Verificação

Mínima, antes de todo PR:

```sh
npm test          # unitários (shared) e integração (server)
npm run typecheck # shared, db e server
npm run lint      # client, incluindo a regra que proíbe cor crua
npm run build     # build do SPA
npm run doctor    # React Doctor: precisa terminar sem achados (saúde 100)
```

Dois checks são obrigatórios para o merge na `master`:

| Check | Workflow | O que reprova |
| --- | --- | --- |
| Testes, tipos, lint e build | `ci.yml` | Teste falhando, erro de tipo, lint (inclui cor crua e `test:tokens`) ou build do SPA quebrado |
| react-doctor | `react-doctor.yml` | Qualquer achado do [React Doctor](https://react.doctor) no projeto inteiro, ou saúde abaixo de 100 |

O React Doctor também comenta no PR e marca as linhas com achados. Quando um
achado for falso positivo, suprima na linha com
`// react-doctor-disable-next-line <regra>` e um comentário dizendo por quê;
o revisor decide se a justificativa vale.

Conforme a área tocada:

| Comando | Quando |
| --- | --- |
| `npm run test:design` | Componentes ou stories do cliente |
| `npm run verify:app <cookie>` | Fluxo de ponta a ponta; exige o app rodando e o cookie impresso pelo seed |
| `npm run verify:group` | Fluxos com vários usuários e WebSocket; exige o app rodando com seed |

`verify:app` e `verify:group` pedem `npm run build && npm run dev` em outro
terminal e `npm run db:seed` antes. `APP_URL` troca o endereço (padrão
`http://localhost:3000`).

## Agentes de IA

Usar agentes é bem-vindo, e nenhum é obrigatório. O [`AGENTS.md`](AGENTS.md)
(importado pelo `CLAUDE.md`) dá o contexto do projeto a qualquer agente.
Algumas skills ficam versionadas em `.claude/skills/`, lidas pelo Claude Code
e pelo opencode:

- `frontend-design`: direção visual de telas e componentes novos;
- `emil-design-eng`: acabamento de interação e animação;
- `react-doctor`: checagem de regressões ao terminar código React.

São cópias das skills públicas
([anthropics/skills](https://github.com/anthropics/skills),
[emilkowalski/skills](https://github.com/emilkowalski/skills) e
[millionco/react-doctor](https://github.com/millionco/react-doctor)). Para
atualizar, substitua a pasta pela versão nova num PR próprio. Antes de
adicionar outra skill, pergunte se ela cobre algo que o projeto faz com
frequência e que as regras deste guia ainda não cobrem.

Código feito com agente segue as mesmas regras e a mesma revisão de qualquer
outro PR. Quem abre o PR responde pelo código.

## Revisão automática

Todo PR recebe um review automático do [Pullfrog](docs/pullfrog.md): um
primeiro parecer do DeepSeek, validado e publicado pelo Codex GPT-6.1 Sol (ou
pelo Claude Opus, se o Codex estiver sem cota). Em mudanças de frontend ele sobe o
Storybook e confere telas no Chrome headless. Ele também corrige o PR quando
um review pede mudança, quando o CI quebra ou quando alguém comenta
`@pullfrog <pedido>`.

PR simples (documentação, testes, stories, componente presentacional,
atualização minor/patch do Dependabot) pode ser aprovado e mesclado pelo bot.
Tudo que toca um caminho de [`.github/CODEOWNERS`](.github/CODEOWNERS) —
servidor, regras 5e, banco, telas, CI — precisa de merge humano. A política
completa e o setup estão em [`docs/pullfrog.md`](docs/pullfrog.md).

## Para onde olhar

- [`README.md`](README.md): produto, setup, variáveis de ambiente e Docker.
- [`docs/architecture.md`](docs/architecture.md): como o sistema é montado e
  por quê.
- [`docs/roadmap.md`](docs/roadmap.md): entregue, próximo e em aberto.
- [`docs/design-system.md`](docs/design-system.md): tokens e componentes.
- [`docs/README.md`](docs/README.md): índice de toda a documentação.
- [`AGENTS.md`](AGENTS.md): as mesmas regras na versão para agentes.
