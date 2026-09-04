## 1. Scaffold do cliente

- [ ] 1.1 Criar `client/` com Vite + React + TypeScript e ajustar o monorepo
- [ ] 1.2 Instalar e configurar Tailwind v4 (plugin do Vite, não o do PostCSS)
- [ ] 1.3 Verificar os termos de licença de Cabinet Grotesk e Geist para self-host; trocar por alternativa livre equivalente se algum termo não servir
- [ ] 1.4 Versionar os arquivos de fonte e declarar `@font-face` com `font-display: swap`
- [ ] 1.5 Instalar Phosphor Icons e Motion

## 2. Camada de tokens

- [ ] 2.1 Declarar os tokens semânticos em `@theme` no `src/styles/index.css`, tema escuro
- [ ] 2.2 Declarar o tema claro e ligar a alternância a `prefers-color-scheme`
- [ ] 2.3 Escala tipográfica, escala de espaço e a regra única de raio
- [ ] 2.4 Escala de motion e o wrapper de `prefers-reduced-motion`
- [ ] 2.5 Regra de lint que impeça cor crua em componente, forçando o uso dos tokens

## 3. Laboratório

- [ ] 3.1 Instalar Storybook 9 com o builder do Vite
- [ ] 3.2 Importar em `.storybook/preview.ts` o mesmo `src/styles/index.css` do app
- [ ] 3.3 Instalar `addon-a11y`
- [ ] 3.4 Decorator de tema exibindo escuro e claro lado a lado
- [ ] 3.5 Story "Foundations": cor, tipo, espaço e raio nos dois temas
- [ ] 3.6 **Ponto de decisão:** julgar a identidade na story Foundations e ajustar tokens antes de construir componente

## 4. Base do shadcn/ui

- [ ] 4.1 Inicializar o shadcn apontando para os tokens do projeto
- [ ] 4.2 Reescrever raio, cor, sombra e tipografia dos componentes gerados; nenhum fica em estado default

## 5. Componentes da fase 0

Cada um com story cobrindo os estados que o produto realmente tem, não só o estado feliz.

- [ ] 5.1 `Button`: primária, secundária, fantasma, perigo; repouso, hover, ativo, foco, desabilitado, carregando
- [ ] 5.2 `Field` e `Input`: rótulo acima, ajuda, erro abaixo; nunca placeholder como rótulo
- [ ] 5.3 `Surface`: base, elevada, sobreposta e **secreta** com os três sinais
- [ ] 5.4 `Avatar`: com imagem, com iniciais, carregando
- [ ] 5.5 `Badge` de papel: mestre e jogador
- [ ] 5.6 `Dialog` sobre Radix, com foco preso e retorno de foco ao fechar
- [ ] 5.7 `Toast`: sucesso, erro, informação
- [ ] 5.8 `EmptyState`: indica como preencher, não só informa vazio
- [ ] 5.9 `Skeleton`: reproduz a forma do conteúdo final, sem spinner genérico
- [ ] 5.10 `CopyField` para o código de convite, com confirmação de cópia
- [ ] 5.11 `AppShell`: barra superior, navegação e seletor de campanha
- [ ] 5.12 Colapso mobile explícito em `AppShell` e nas superfícies compostas

## 6. Prova de identidade

- [ ] 6.1 `DiceResult`: total tabular, decomposição, dados individuais
- [ ] 6.2 Vantagem e desvantagem com o dado descartado riscado e apagado
- [ ] 6.3 Tratamento de 20 e 1 naturais
- [ ] 6.4 Assentamento com spring, colapsando para estado final sob movimento reduzido

## 7. Antideriva e fechamento

- [ ] 7.1 Story "Campanha": tela da fase 0 montada com os componentes reais
- [ ] 7.2 Corrigir o que a tela composta revelar (ritmo vertical, densidade, alinhamento)
- [ ] 7.3 Rodar `addon-a11y` em todas as stories, nos dois temas, e zerar as violações de contraste
- [ ] 7.4 Revisão manual nos dois temas: hierarquia, alvo de toque, estado de foco visível por teclado
- [ ] 7.5 Verificar os quatro requisitos do spec `design-foundation` um a um
- [ ] 7.6 `openspec validate design-system-foundation` e `openspec status`
