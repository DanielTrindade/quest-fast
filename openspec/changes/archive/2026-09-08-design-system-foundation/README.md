# design-system-foundation

Direção visual do `quest-fast` e o laboratório onde ela vive. Tokens, os 12 componentes da fase 0 e o Storybook. Sem telas, sem servidor.

**Precede a fase 0 do `mvp-campaign-management`.** As telas de login, campanha e membros consomem estes componentes em vez de inventá-los.

## Why

Definir a direção visual depois de meia dúzia de telas prontas significa retrabalhar todas elas. Trocar um token agora custa nada.

Há também uma decisão contraintuitiva a registrar: **a interface não parece material de marketing de D&D.** O app fica aberto três a quatro horas, à noite, num segundo monitor. Textura de pergaminho atrás de um número de HP não é identidade, é custo de leitura. E o argumento decisivo é orçamento de cor: num tracker de combate, vermelho é dano e verde é cura; se o cromo inteiro já é dourado, não sobra cor para significar nada.

A identidade mora no resultado do dado, nos numerais tabulares, numa display type com caráter, e no conteúdo da campanha. Não no cromo.

## Capabilities

### New Capabilities

- `design-foundation`: as quatro garantias transversais que apodrecem em silêncio se ninguém as travar. Contraste WCAG AA nos dois temas, colapso sob movimento reduzido, tema único por página e a linguagem de conteúdo secreto.

### Modified Capabilities

Nenhuma.

## Ordem de construção

```
1. Vite + React + TS
2. Tailwind v4  ->  tokens em @theme  +  fontes auto-hospedadas
3. Storybook  +  addon-a11y  +  decorator de tema
4. Story "Foundations"   <- julga a identidade antes de existir componente
5. Os 12 componentes da fase 0, com seus estados
6. DiceResult             <- prova de que a direcao funciona
7. Story "Campanha"       <- tela composta, pega a deriva
```

O passo 4 é o de maior retorno: dá para julgar a direção antes de escrever qualquer código de UI, quando ajustar token ainda é gratuito. É um ponto de decisão explícito no `tasks.md`, não uma formalidade.

## Duas armadilhas que o plano evita de propósito

**Deriva.** Sistema construído só em isolamento fica bom componente a componente e desmorona quando composto. Por isso a story "Campanha" é obrigatória antes de fechar o change.

**Divergência entre lab e produto.** O `.storybook/preview.ts` importa o mesmo `src/styles/index.css` do app. Storybook com config de Tailwind própria é a receita conhecida para os dois divergirem em silêncio.
