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
- Aprova e faz auto-merge de todo PR sem achado bloqueante; sugestões menores
  vão no review sem segurar o merge. PR com defeito ou que muda as regras do
  próprio bot fica para merge humano (ver [Política de merge](#política-de-merge)).
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
  e monta um prompt próprio.
- O passo 1 só roda nos gatilhos do primeiro review (`event.trigger` do
  payload): PR aberto, pronto para review ou com review pedido ao bot, e
  comentário com "review"/"revis" no texto. Push novo não passa por ele: o
  re-review incremental leva poucos minutos, e o primeiro parecer custava 11 a
  14 min a cada push. O limite dele é de 8 min. A lista é fechada no workflow,
  porque o modelo não recusa sozinho uma tarefa que não é dele, e usa o
  gatilho em vez de `type`, que é vocabulário interno do servidor
  (`pr-created`, `pr-re-review`, `autofix`...). Ele devolve os achados em JSON, que o
  workflow grava em `.pullfrog/primeiro-parecer.md` (fora do git). O passo 2
  lê esse arquivo e valida cada achado antes de publicar: o review publicado é
  um só, do Codex ou do Opus.
- O passo 3 entra quando o passo do Codex termina com erro: cota da
  assinatura esgotada, credencial recusada ou timeout.
- Tarefas que não são review (CI quebrado, review a aplicar, menção sem
  "review") pulam o passo 1 e seguem o mesmo fallback Codex → Claude.
- **O valor do passo 1 é medido.** O review publicado termina com um
  comentário HTML oculto, `<!-- primeiro-parecer: C/T -->`, com quantos dos T
  achados do DeepSeek o revisor confirmou. Se, depois de uns dez PRs, ele
  quase nunca acrescentar achado confirmado, remova o passo.
- **O check `pullfrog-approval` fica desligado** (`review.approval-check
  false`). Quando o bot não aprovava, ele ficava vermelho, e a opção **Fix CI
  failures → PRs revisados** tratava isso como CI quebrado: foram 59 execuções
  de "Fix CI" que só encerravam dizendo que não havia o que corrigir. O
  auto-merge depende da aprovação no review, não desse check, que nunca foi
  obrigatório no ruleset.

Isso depende do console estar com o modelo em **Custom (set in workflow)**:
modelo escolhido no console vence o `model:` do workflow e desfaz a cadeia. A
flag `--model` numa menção vale para aquela execução inteira.

## Política de merge

Duas travas, uma de julgamento e uma determinística:

1. **Política de review (abaixo):** o bot aprova todo PR sem achado
   bloqueante, com o CI verde. Aprovação do Pullfrog liga o auto-merge nativo
   do GitHub (`auto-merge true` no console), que ainda espera os checks
   obrigatórios. A aprovação também substitui o "pedir mudanças" que o próprio
   bot deixou numa rodada anterior. O ruleset descarta aprovação a cada push
   novo, então um commit que chega depois da aprovação só entra depois de
   outro review.
2. **CODEOWNERS + ruleset:** [`.github/CODEOWNERS`](../.github/CODEOWNERS)
   marca só o que define as regras do bot e o que decide se o CI fica verde:
   `.github/`, instruções de agente, esta página, `Dockerfile`, os dois
   validadores de `scripts/` (`check-design-tokens.mjs`, que roda no lint, e
   `verify-design-system.mjs`, o `test:design`), a config e as regras do
   ESLint, os `tsconfig` e o loader de testes do cliente.
   O ruleset da `master` exige revisão de code owner, então um PR que muda as
   regras não é aprovado pelo bot que elas julgam, mesmo que ele erre o
   julgamento. Esse merge fica com o mantenedor, que usa o bypass de admin
   quando o PR é dele mesmo (o GitHub não deixa aprovar o próprio PR).

Servidor, regras 5e, banco e telas entram por auto-merge quando o review não
encontra defeito. A rede de segurança deles é o CI (testes de integração de
RBAC, typecheck, lint, React Doctor) e o review; se um caminho voltar a
precisar de merge humano, devolva-o ao CODEOWNERS.

Três travas são de julgamento, porque o CODEOWNERS não as expressa sem
segurar quase todo PR:

- **`docs/architecture.md`:** o AGENTS.md manda atualizá-lo quando uma decisão
  muda, então ele aparecia em 14 dos 18 PRs que ficaram para merge humano, e
  só um deles tinha defeito. O bot aprova quando o diff registra o que o PR
  faz e trava quando remove ou relaxa um princípio.
- **Ferramentas de `scripts/`:** `verify-app`, `verify-group`,
  `simulate-encounter` e `inspect-storybook` não rodam no CI e entram por
  auto-merge; os validadores continuam no CODEOWNERS.
- **`scripts` dos `package.json`:** os `package.json` ficam fora do
  CODEOWNERS para o Dependabot continuar entrando sozinho. Script novo pode
  entrar; mudar ou remover `test`, `test:*`, `typecheck`, `lint`, `build` ou
  `doctor` trava o merge, porque trocar um deles por um comando que só sai com
  sucesso deixaria o CI verde sem verificar nada.

## Política de review

O campo **Custom instructions** do console só manda o agente ler esta seção na
`master`. Assim a política é versionada, e um PR não consegue mudar as regras
que vão julgá-lo.

```text
Ao revisar:
1. Se existir .pullfrog/primeiro-parecer.md, é o parecer do primeiro revisor
   (DeepSeek). Valide cada achado no código: publique só o que se confirmar e
   descarte falso positivo sem mencioná-lo. Termine o corpo do review com
   `<!-- primeiro-parecer: C/T -->`, em que T é o número de achados do
   arquivo e C quantos você confirmou.
2. Procure defeitos reais e desvios de AGENTS.md: autorização no servidor
   (não membro recebe 404), lógica 5e fora de shared/, rota sem teste de RBAC,
   migração editada, sintaxe TypeScript não apagável no backend, texto de UI
   fora do pt-BR, cor crua no client.
3. Classifique cada achado:
   - bloqueante (P0 a P2): comportamento errado, falha de autorização ou de
     segurança, perda ou vazamento de dado, regra 5e errada, condição de
     corrida, teste que não verifica o que diz, desvio de AGENTS.md;
   - sugestão (P3): nome, estilo, legibilidade, refatoração, cobertura extra
     opcional, melhoria que o PR não precisa para estar correto.
   Marque o nível no início de cada comentário ([P1], [P3]...). Sugestão não
   segura o merge: publique-a no mesmo review que aprova.
4. Se o PR muda docs/architecture.md, leia o diff desse arquivo. Registrar o
   que o PR faz (peça nova, decisão nova, descrição atualizada) é esperado e
   não trava. Remover ou relaxar um princípio ou uma decisão registrada (por
   exemplo, o cliente passar a ser fonte de verdade, ou quem não é membro
   receber algo diferente de 404) trava: é merge humano. Ao aprovar, cite em
   uma linha o que mudou na arquitetura.
5. Aprove o PR quando cumprir todos os itens, qualquer que seja o tamanho
   ou a área (servidor, shared/, banco, telas e scripts/ inclusive):
   - não sobra achado bloqueante seu em aberto, nem de rodada anterior;
   - o CI está verde;
   - não toca caminho listado em .github/CODEOWNERS;
   - não adiciona dependência nova (atualização do Dependabot pode);
   - não muda nem remove `test`, `test:*`, `typecheck`, `lint`, `build` ou
     `doctor` no campo `scripts` de nenhum package.json (script novo pode);
   - o item 4 não travou.
   Sem achado bloqueante, aprove: terminar só com comentário deixa o PR
   travado.
6. Qualquer outro caso: não aprove; peça mudanças se houver achado
   bloqueante, ou publique como comentário, e termine com "Precisa de merge
   humano:" seguido do motivo em uma linha.
7. Escreva o review em português.

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

Ao corrigir CI: se o único check com falha é do próprio Pullfrog
(`pullfrog-approval`), não há o que corrigir. Encerre informando isso em uma
linha, sem checkout nem testes.
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
     approved PRs** ligado (só admin, pede para digitar `MERGE`); **Approval
     check** desligado; cole em **Custom instructions**:

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
     Owners**; ligue **Dismiss stale pull request approvals when new commits
     are pushed**; adicione o papel **Repository admin** em bypass com modo
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
npx pullfrog config set review.approval-check false
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
  CODEOWNERS são a rede de segurança; "sem achados" é julgamento do modelo,
  e um defeito que ele não vê entra na `master` sem passar por uma pessoa.
- A cadeia de três passos usa recursos documentados do Pullfrog (vários passos
  da action no mesmo job, `output_schema`, `model:` por passo), mas o fallback
  supõe que a falta de cota faz o passo falhar. Confira nos primeiros PRs; se
  algo sair errado, remova os passos 1 e 3 e escolha um modelo no console.
- Para PR delicado, peça um segundo parecer com
  `@pullfrog --model=anthropic/claude-opus-5-5 --effort=high`.
- Re-review em todo push consome a cota das assinaturas rápido; por isso o
  agente itera com o PR em rascunho e marca como pronto uma vez (ver
  AGENTS.md). Se a cota do ChatGPT acabar no meio do mês, o Claude assume até
  ela renovar.
- O auto-merge do Pullfrog depende do plano ("entitlement"). Se um PR
  aprovado não ganhar o evento de auto-merge, confira
  `npx pullfrog config get auto-merge` e o plano no console.
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
