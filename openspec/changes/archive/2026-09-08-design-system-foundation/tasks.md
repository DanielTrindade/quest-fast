## Verificação do progresso — 2026-09-08

As entregas planejadas estão implementadas e verificadas. A conferência abaixo reflete a execução desta sessão, não apenas a inspeção do código.

- Comandos executados e aprovados: `npm run lint` (ESLint mais `check-design-tokens.mjs`), `npm run test:tokens`, `npm run build` e `npm run test:design`. O build do aplicativo, inconclusivo na sessão anterior, conclui em 3.7s.
- `npm run test:design` aprovou 54 de 54 verificações: 53 stories mais o bloco de cenários interativos. Cada story é carregada nos dois temas, auditada com axe-core (`wcag2a`, `wcag2aa`, `wcag21aa`), conferida quanto a IDs duplicados e a overflow horizontal em 320, 390, 768 e 1280px. Nenhuma violação e nenhuma verificação inconclusiva restaram.
- Contraste (7.3): o cálculo exibido em Foundations aceitava apenas hexadecimais de seis dígitos. O minificador do build estático encurta `#ffffff` para `#fff`, o que deixava o painel em "Calculando" no Storybook construído, embora o axe não acusasse falha. `contrast()` em `Foundations.tsx` passou a normalizar as duas formas e a story `foundations--contraste` agora passa.
- Tela composta (7.2): a revisão nos dois temas revelou que o selo de papel não formava coluna. A linha do mestre não tem ação e o selo escorregava para o lugar do botão. A lista de membros passou a ser a grade e cada linha usa `subgrid`, de modo que papel e ação ocupam colunas compartilhadas; em telas estreitas as linhas continuam empilhando.
- Revisão manual (7.4): capturas dos dois temas em 1280px e 390px conferidas em `test-results/design-system/`. A hierarquia se sustenta, o foco por teclado retorna ao gatilho com anel visível de 2px e nenhum controle visível fica abaixo de 44px de altura.
- Requisitos do spec (7.5): contraste, movimento reduzido, tema único por página e linguagem de conteúdo secreto têm cobertura executável no script, incluindo o portal do diálogo, a tentativa de inversão local por `data-theme` e a troca de preferência em tempo de execução.
- Fontes (1.3–1.4): Space Grotesk para display, Geist e Geist Mono são servidas de `client/public/fonts` com `font-display: swap`. Os `.woff2` são versionados e as licenças acompanham os arquivos. Cabinet Grotesk foi descartada; a decisão está registrada.
- Lint (2.5): a regra cobre hexadecimais, funções de cor, classes de paleta do Tailwind, valores arbitrários e propriedades de cor com valor não semântico. `no-raw-color.test.js` exercita a regra.
- Lifecycle: a implementação está concluída e verificada. Sincronizar os requisitos para as specs principais e arquivar a mudança é a próxima decisão, ainda não tomada nesta sessão.

## 1. Scaffold do cliente

- [x] 1.1 Criar `client/` com Vite + React + TypeScript e ajustar o monorepo
- [x] 1.2 Instalar e configurar Tailwind v4 (plugin do Vite, não o do PostCSS)
- [x] 1.3 Verificar os termos de licença de Cabinet Grotesk e Geist para self-host; trocar por alternativa livre equivalente se algum termo não servir
- [x] 1.4 Versionar os arquivos de fonte e declarar `@font-face` com `font-display: swap`
- [x] 1.5 Instalar Phosphor Icons e Motion

## 2. Camada de tokens

- [x] 2.1 Declarar os tokens semânticos em `@theme` no `src/styles/index.css`, tema escuro
- [x] 2.2 Declarar o tema claro e ligar a alternância a `prefers-color-scheme`
- [x] 2.3 Escala tipográfica, escala de espaço e a regra única de raio
- [x] 2.4 Escala de motion e o wrapper de `prefers-reduced-motion`
- [x] 2.5 Regra de lint que impeça cor crua em componente, forçando o uso dos tokens

## 3. Laboratório

- [x] 3.1 Instalar Storybook com o builder do Vite — versão 10.6 mantida conforme decisão no `design.md`
- [x] 3.2 Importar em `.storybook/preview.ts` o mesmo `src/styles/index.css` do app
- [x] 3.3 Instalar `addon-a11y`
- [x] 3.4 Decorator de tema exibindo escuro e claro lado a lado
- [x] 3.5 Story "Foundations": cor, tipo, espaço e raio nos dois temas
- [x] 3.6 **Ponto de decisão:** julgar a identidade na story Foundations e ajustar tokens antes de construir componente — revisão original preservada; Space Grotesk conferida nos dois temas nesta implementação

## 4. Base do shadcn/ui

- [x] 4.1 Inicializar o shadcn apontando para os tokens do projeto
- [x] 4.2 Reescrever raio, cor, sombra e tipografia dos componentes gerados; nenhum fica em estado default

## 5. Componentes da fase 0

Cada um com story cobrindo os estados que o produto realmente tem, não só o estado feliz.

- [x] 5.1 `Button`: primária, secundária, fantasma, perigo; repouso, hover, ativo, foco, desabilitado, carregando
- [x] 5.2 `Field` e `Input`: rótulo acima, ajuda, erro abaixo; nunca placeholder como rótulo
- [x] 5.3 `Surface`: base, elevada, sobreposta e **secreta** com os três sinais
- [x] 5.4 `Avatar`: com imagem, com iniciais, carregando
- [x] 5.5 `Badge` de papel: mestre e jogador
- [x] 5.6 `Dialog` sobre Radix, com foco preso e retorno de foco ao fechar
- [x] 5.7 `Toast`: sucesso, erro, informação
- [x] 5.8 `EmptyState`: indica como preencher, não só informa vazio
- [x] 5.9 `Skeleton`: reproduz a forma do conteúdo final, sem spinner genérico
- [x] 5.10 `CopyField` para o código de convite, com confirmação de cópia
- [x] 5.11 `AppShell`: barra superior, navegação e seletor de campanha
- [x] 5.12 Colapso mobile explícito em `AppShell` e nas superfícies compostas

## 6. Prova de identidade

- [x] 6.1 `DiceResult`: total tabular, decomposição, dados individuais
- [x] 6.2 Vantagem e desvantagem com o dado descartado riscado e apagado
- [x] 6.3 Tratamento de 20 e 1 naturais
- [x] 6.4 Assentamento com spring, colapsando para estado final sob movimento reduzido

## 7. Antideriva e fechamento

- [x] 7.1 Story "Campanha": tela da fase 0 montada com os componentes reais
- [x] 7.2 Corrigir o que a tela composta revelar (ritmo vertical, densidade, alinhamento)
- [x] 7.3 Rodar `addon-a11y` em todas as stories, nos dois temas, e zerar as violações de contraste
- [x] 7.4 Revisão manual nos dois temas: hierarquia, alvo de toque, estado de foco visível por teclado
- [x] 7.5 Verificar os quatro requisitos do spec `design-foundation` um a um
- [x] 7.6 `openspec validate design-system-foundation` e `openspec status`
