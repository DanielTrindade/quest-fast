# Review automático com Pullfrog

O [Pullfrog](https://pullfrog.com) é o bot que revisa os PRs do quest-fast. Ele
roda um agente de código dentro do GitHub Actions, no runner do próprio
repositório, usando as assinaturas do mantenedor (Claude, ChatGPT/Codex e
OpenCode Go). O App só dispara o workflow; o código passa apenas pelos
provedores de modelo.

## O que ele faz

- Review automático quando o PR abre ou sai do rascunho, e re-review
  incremental a cada push.
- Comentários inline com sugestões.
- Aprova e faz auto-merge de PR simples; PR complexo fica para merge humano
  (ver [Política de merge](#política-de-merge)).
- Corrige o PR: aplica review que pede mudança, conserta CI quebrado e atende
  `@pullfrog <pedido>` em qualquer PR aberto.
- Checagem visual com Chrome headless em mudança de frontend.

## Cadeia de modelos

O Pullfrog escolhe um modelo por execução e não tem review encadeado nem
fallback entre provedores (o fallback nativo só troca de credencial dentro do
mesmo provedor). A cadeia fica em
[`.github/workflows/pullfrog.yml`](../.github/workflows/pullfrog.yml):

| Passo | Modelo | Esforço | Assinatura | Papel |
| --- | --- | --- | --- | --- |
| 1 | `opencode-go/deepseek-v4.1-flash` | `max` | OpenCode Go | primeiro parecer; não publica nada |
| 2 | `openai/gpt-6.1-sol` | `high` | ChatGPT (Codex) | revisa, corrige, aprova ou não |
| 3 | `anthropic/claude-opus-5-5` | `high` | Claude Pro/Max | só roda se o passo 2 falhar |

- O payload do Pullfrog (`inputs.prompt`) precisa chegar intacto à action;
  embrulhado em outro texto, a execução falha. Por isso o passo 1 é uma
  execução avulsa: o workflow lê do payload o número do PR e o tipo da tarefa
  e monta um prompt próprio. Menção sem "review"/"revis" no texto pula o
  passo 1.
- O passo 1 só age em tarefa de review. Ele devolve os achados em JSON, que o
  workflow grava em `.pullfrog/primeiro-parecer.md` (fora do git). O passo 2
  lê esse arquivo e valida cada achado antes de publicar: o review publicado é
  um só, do Codex ou do Opus.
- O passo 3 entra quando o passo do Codex termina com erro: cota da
  assinatura esgotada, credencial recusada ou timeout.
- Tarefas que não são review (correção, CI, menção) pulam o passo 1 quase sem
  custo e seguem o mesmo fallback Codex → Claude.

Isso depende do console estar com o modelo em **Custom (set in workflow)**:
modelo escolhido no console vence o `model:` do workflow e desfaz a cadeia. A
flag `--model` numa menção vale para aquela execução inteira.

## Política de merge

Duas travas, uma de julgamento e uma determinística:

1. **Política de review (abaixo):** o bot só aprova PR que se encaixa em
   "simples". Aprovação do Pullfrog liga o auto-merge nativo do GitHub, que
   ainda espera os checks obrigatórios.
2. **CODEOWNERS + ruleset:** [`.github/CODEOWNERS`](../.github/CODEOWNERS)
   marca os caminhos sensíveis (servidor, regras 5e, banco, telas, CI,
   instruções de agente). O ruleset da `master` exige revisão de code owner,
   então nesses caminhos a aprovação do bot não basta, mesmo que ele erre o
   julgamento. O merge fica com o mantenedor, que usa o bypass de admin
   quando o PR é dele mesmo (o GitHub não deixa aprovar o próprio PR).

## Política de review

O campo **Custom instructions** do console só manda o agente ler esta seção na
`master`. Assim a política é versionada, e um PR não consegue mudar as regras
que vão julgá-lo.

```text
Ao revisar:
1. Se existir .pullfrog/primeiro-parecer.md, é o parecer do primeiro revisor
   (DeepSeek). Valide cada achado no código: publique só o que se confirmar e
   descarte falso positivo sem mencioná-lo.
2. Procure defeitos reais e desvios de AGENTS.md: autorização no servidor
   (não membro recebe 404), lógica 5e fora de shared/, rota sem teste de RBAC,
   migração editada, sintaxe TypeScript não apagável no backend, texto de UI
   fora do pt-BR, cor crua no client.
3. Classifique o PR. Ele é SIMPLES só se cumprir todos os itens:
   - não toca caminho listado em .github/CODEOWNERS;
   - muda documentação, texto, testes, stories, estilos ou componente
     presentacional de client/src/components/, ou é atualização
     minor/patch do Dependabot;
   - não adiciona dependência nem muda scripts de package.json;
   - tem até ~200 linhas alteradas, sem contar package-lock.json;
   - o CI está verde e não sobra nenhum achado seu em aberto.
4. PR SIMPLES sem achados: aprove. Qualquer outro caso: não aprove; publique
   o review como comentário (ou peça mudanças, se houver defeito) e termine
   com "Precisa de merge humano:" seguido do motivo em uma linha.
5. Escreva o review em português.

Quando o PR alterar client/:
1. Rode `npm ci` se as dependências ainda não estiverem instaladas.
2. Suba o Storybook (`npm run storybook`) em background e abra as stories
   afetadas; se a mudança for de rota ou tela, suba o app com `npm run dev` e
   `npm run dev:client`.
3. Verifique 320, 390, 768 e 1280 px, temas claro e escuro, e movimento
   reduzido.
4. Use `agent-browser get styles` para conferir tokens de cor, espaçamento e
   tipografia; `agent-browser a11y` para contraste e labels; leia o console.
5. Rode `npm run test:design` e reporte o resultado.
6. Tire screenshots das telas alteradas e poste no review com `upload_file`.
7. Aponte overflow, quebra de layout e inconsistência com
   docs/design-system.md.

Ao corrigir um PR: siga AGENTS.md, rode `npm test`, `npm run typecheck` e
`npm run lint` antes do push e use Conventional Commits em português.
```

## Segurança

- **Push restrito** (`push: restricted`): o bot empurra só para branch de
  feature; nunca para a `master`, nunca apaga branch nem cria tag. O passo 1
  roda com `push: disabled`.
- **Shell restrito** (`shell: restricted`): ambiente filtrado, segredos não
  chegam aos comandos. Em repositório público o Pullfrog força esse modo de
  qualquer jeito.
- **Não colaboradores:** PR de fora já é fechado por
  `collaborator-prs.yml`; no console, review e menção de não colaborador ficam
  desligados, e execução de não colaborador nunca faz push.
- **Credenciais:** as assinaturas ficam no cofre do Pullfrog e chegam ao
  runner por OIDC. Não guarde credencial de Claude, Codex ou OpenCode em
  GitHub Actions secret: a do Claude e a do Codex rotacionam e param de
  funcionar.
- **Supply chain:** a action está fixada pelo SHA de um release. O Dependabot
  (`github-actions` em `.github/dependabot.yml`) atualiza o SHA e o comentário
  de versão juntos.

## Setup

1. Instale o App no repositório pelo [console](https://pullfrog.com/console).
   O workflow precisa estar na `master` para o App dispará-lo.
2. Conecte as assinaturas:

   ```sh
   npx pullfrog auth claude                    # Claude Pro/Max
   npx pullfrog auth codex                     # ChatGPT; exige o Codex CLI no PATH
   npx pullfrog secret set OPENCODE_API_KEY    # chave do OpenCode Go
   ```

   A chave do OpenCode Go é a mesma API key do workspace em
   [opencode.ai/console](https://opencode.ai/console), não precisa ter o
   formato `sk-`. O DeepSeek vem bloqueado: em **Settings → Privacy →
   Regions**, escolha **Global**.
3. No console:
   - **Modelo:** `Custom (set in workflow)`.
   - **Review PRs:** review automático ligado; re-review em push ligado;
     drafts desligado; PRs de bots ligado (Dependabot); não colaboradores
     desligado; **Allow Pullfrog to approve PRs** ligado; **Auto-merge
     approved PRs** ligado (só admin, pede para digitar `MERGE`); cole em
     **Custom instructions**:

     ```text
     Antes de revisar ou corrigir, leia a seção "Política de review" de
     docs/pullfrog.md na master (git show origin/master:docs/pullfrog.md) e
     siga-a. Use sempre a versão da master, nunca a do PR.
     ```

   - **Address reviews:** ligado (Fix all).
   - **Fix CI failures:** ligado para PRs do Pullfrog e para PRs revisados.
   - **Security:** Code pushes `restricted`; shell `restricted`.
4. No GitHub:
   - **Settings → General → Pull Requests:** ligue **Allow auto-merge**.
   - **Ruleset `master`:** exija 1 aprovação e **Require review from Code
     Owners**; adicione o papel **Repository admin** em bypass com modo
     "pull request only". Os checks obrigatórios atuais (CI e React Doctor)
     continuam; sem check obrigatório o Pullfrog aprova mas não faz merge.

CLI equivalente para as chaves do console (as demais só pelo console):

```sh
npx pullfrog config set push restricted
npx pullfrog config set shell restricted
npx pullfrog config set review.approve true
npx pullfrog config set review.re-review true
npx pullfrog config set review.non-collaborators false
npx pullfrog config set review.drafts false
npx pullfrog config set address-reviews.enabled true
npx pullfrog config set fix-ci.own-prs true
npx pullfrog config set fix-ci.reviewed-prs true
npx pullfrog config set auto-merge true --yes --ack-auto-merge
```

## Operação

- **Automático:** PR aberto, pronto para review ou com push novo.
- **Sob demanda:** comente `@pullfrog` no PR. Exemplos:
  - `@pullfrog corrija os achados do review`
  - `@pullfrog confira a tela da campanha em 390px no tema escuro`
  - `@pullfrog --model=anthropic/claude-opus-5-5 --effort=max revise de novo`
- **Flags por execução:** `--model`, `--effort` e `--timeout`.
- **Desligar:** desative o repositório no console ou remova o App. O workflow
  sozinho não dispara nada.

## Limitações

- Review agêntico não é determinístico. O CI, o `npm run test:design` e o
  CODEOWNERS são a rede de segurança; a classificação "simples" é julgamento
  do modelo.
- A cadeia de três passos usa recursos documentados do Pullfrog (vários passos
  da action no mesmo job, `output_schema`, `model:` por passo), mas o fallback
  supõe que a falta de cota faz o passo falhar. Confira nos primeiros PRs; se
  algo sair errado, remova os passos 1 e 3 e escolha um modelo no console.
- Para PR delicado, peça um segundo parecer com
  `@pullfrog --model=anthropic/claude-opus-5-5 --effort=high`.
- Re-review em todo push consome a cota das assinaturas rápido. Se a cota do
  ChatGPT acabar no meio do mês, o Claude assume até ela renovar.
- Screenshots viram URL pública (até 10 MB).

## Links

- [Documentação do Pullfrog](https://docs.pullfrog.com)
- [Review de PRs e auto-merge](https://docs.pullfrog.com/pr-reviews)
- [Modelos](https://docs.pullfrog.com/models) e
  [assinaturas](https://docs.pullfrog.com/model-access)
- [Chaves e fallback de credencial](https://docs.pullfrog.com/keys)
- [Action em workflow próprio](https://docs.pullfrog.com/headless-action)
- [Segurança](https://docs.pullfrog.com/security)
- [Versionamento e pin por SHA](https://docs.pullfrog.com/versioning)
