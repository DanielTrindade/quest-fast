## O que muda

<!-- O que este PR entrega, em uma ou duas frases. -->

## Por quê

<!-- O problema ou a necessidade. Link da issue, se houver: "Fecha #12". -->

## O que ficou de fora

<!-- O que este PR deliberadamente não faz, para o revisor não cobrar o que não é escopo. -->

## Como verificar

<!-- Passos para o revisor ver a mudança funcionando, não só o código. -->

## Checklist

- [ ] Rodei `npm test`, `npm run typecheck`, `npm run lint`, `npm run build` e `npm run doctor` (saúde 100).
- [ ] Rodei `npm run test:design` se mexi em componente ou story.
- [ ] Rodei `npm run verify:app` / `npm run verify:group` se mexi em fluxo de ponta a ponta.
- [ ] Atualizei `docs/architecture.md` se a mudança altera um princípio, uma decisão ou a forma de uma peça.
- [ ] Atualizei `docs/roadmap.md` se a mudança entrega ou muda o escopo de uma etapa.
- [ ] Atualizei `docs/design-system.md` se mexi em token ou tema.
- [ ] Componente novo ou alterado nasceu/foi revisado no Storybook antes de entrar em `client/src/screens/`.
- [ ] Não deixei segredo, dado de mesa real nem artefato local (banco, `uploads/`, `test-results/`) no diff.
