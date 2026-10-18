# AGENTS.md

Guia para agentes de IA neste repositório. As regras são as mesmas do
[`CONTRIBUTING.md`](CONTRIBUTING.md), que é a versão para pessoas. Leia também
[`docs/architecture.md`](docs/architecture.md) antes de mudar código.

## Processo

- Não há framework de planejamento obrigatório. Use o fluxo que fizer sentido
  para a tarefa (plano curto, TDD, spec, direto ao código) e não crie
  diretórios de processo no repositório (`openspec/`, `docs/superpowers/`,
  `docs/plans/` e similares).
- Mudança que altera um princípio ou uma decisão de
  [`docs/architecture.md`](docs/architecture.md) atualiza esse documento no
  mesmo PR. Mudança que entrega ou muda o escopo de uma etapa atualiza
  [`docs/roadmap.md`](docs/roadmap.md).
- `docs/history/` é registro histórico: consulte, não edite.
- Só colaborador convidado abre PR: o repositório é público e aceita issue de
  qualquer pessoa, mas um PR de fora é fechado automaticamente por
  `.github/workflows/collaborator-prs.yml`. Sem convite, o caminho é a issue —
  veja `CONTRIBUTING.md`.

## Regras do projeto

- O cliente nunca é fonte de verdade: rolagens, permissões e visibilidade são
  calculados e autorizados no servidor. Quem não é membro de uma campanha
  recebe 404, não 403.
- Lógica 5e pura vive em `shared/`, com teste unitário. Rota nova no
  `server/` vem com teste de integração de RBAC ("jogador não consegue X").
- Backend roda TypeScript direto no Node (type stripping): só sintaxe
  apagável (sem `enum`, `namespace`, parameter properties) e imports com
  extensão `.ts`.
- Mudou `db/src/schema.ts`: rode `npm run db:generate` e versione a migração.
  Não edite migrações já existentes.
- Idioma: código em inglês (identificadores, arquivos, rotas, campos JSON,
  colunas, comentários, descrições de teste); texto visível ao usuário e
  documentação em pt-BR. Erros da API: campo `error`, texto em português.

## Frontend: Storybook primeiro

- A fonte de verdade da interface é o Storybook (`client/src/stories/`).
- Componente novo nasce como story, passa `npm run test:design` (axe, IDs
  duplicados, overflow em 320/390/768/1280 px, temas claro e escuro,
  movimento reduzido) e só depois é integrado a `client/src/screens/`.
- `client/src/components/` é presentacional (props, sem fetch); `screens/`
  liga com a API via TanStack Query.
- Tokens em `client/src/styles/index.css` e `components.css`; decisões em
  [`docs/design-system.md`](docs/design-system.md). O lint proíbe cor crua e
  a paleta padrão do Tailwind.

## Skills do projeto

Ficam em `.claude/skills/` (lidas pelo Claude Code e pelo opencode):

| Skill | Use quando |
| --- | --- |
| `frontend-design` | Direção visual de uma tela ou componente novo |
| `emil-design-eng` | Acabamento: animação, interação, detalhes de polimento |
| `react-doctor` | Ao terminar uma mudança em código React |

As skills de design trabalham **dentro** do design system: proponha direção
com os tokens existentes; mudar token ou tema é decisão a registrar em
`docs/design-system.md`, não efeito colateral de um componente.

## Verificação

Antes de dar uma tarefa por concluída (o merge na `master` exige o
equivalente disso verde no CI):

```sh
npm test             # unitários (shared) e integração (server)
npm run typecheck    # shared, db, server
npm run lint         # client, inclui a regra que proíbe cor crua
npm run build        # build do SPA
npm run doctor       # React Doctor: zero achados, saúde 100
```

Conforme a área: `npm run test:design` (componentes e stories),
`npm run verify:app <cookie>` e `npm run verify:group` (exigem o app rodando
com seed). Não suprima achado do React Doctor sem um comentário com o porquê.

## Commits

Conventional Commits em português, no presente: `feat(client): ...`,
`fix(server): ...`. Sem trailers de coautoria de agente.
