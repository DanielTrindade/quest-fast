# AGENTS.md — memória do projeto

Guia para qualquer LLM/agente que trabalhar neste repositório. Leia antes de
qualquer mudança.

## Desenvolvimento: OpenSpec como framework único

- Todo trabalho de produto passa pelo fluxo OpenSpec. Não criar planos fora
  dele.
- Comandos (skills em `.opencode/skills/`, atalhos em `.opencode/commands/`):
  - `/opsx-propose` — cria um change (proposal.md, design.md, specs/, tasks.md)
  - `/opsx-apply` — implementa as tasks de um change
  - `/opsx-sync` — sincroniza specs delta com as specs principais
  - `/opsx-archive` — arquiva um change concluído
  - `/opsx-explore` — modo exploração de ideias e requisitos
- Changes vivem em `openspec/changes/`. Contexto, regras de arquitetura e de
  escrita de proposal/tasks estão em `openspec/config.yaml`.

## Superpowers: removido

- O framework "superpowers" foi removido deste repositório. NÃO recriar
  `docs/superpowers/` nem arquivos de plano nesse formato.
- Planejamento e registro de decisões são sempre artefatos OpenSpec
  (proposal/design/specs/tasks).

## Frontend: Storybook-first

- A fonte de verdade do frontend é o Storybook (`client/src/stories/`).
- Todo componente novo nasce como story, passa `npm run test:design`
  (acessibilidade axe, IDs duplicados, overflow em 320/390/768/1280 px,
  temas claro/escuro, movimento reduzido) e só depois é integrado às telas
  (`client/src/screens/`, `client/src/components/`).
- Tokens e sistema de design: `client/src/styles/index.css` e
  `components.css`; decisões em `docs/design-system.md`. O lint proíbe cor
  crua e paleta padrão do Tailwind em componentes.

## Verificação

```sh
npm test             # testes unitários (shared) e de integração (server)
npm run typecheck    # shared, db, server
npm run lint         # client (inclui regra que proíbe cor crua)
npm run build        # build do SPA
npm run test:design  # auditoria do design system no Storybook
npm run verify:app   # fluxo real contra o app rodando
npm run verify:group # grupo de verificações de integração
```

## Regras gerais (fonte: openspec/config.yaml)

- Cliente nunca é fonte de verdade: rolagens, permissões e visibilidade são
  calculados e autorizados no servidor.
- Lógica 5e pura vive em `shared/` com testes unitários.
- Textos visíveis ao usuário em português (pt-BR); código, identificadores,
  rotas, campos JSON e comentários em inglês, sem exceção.