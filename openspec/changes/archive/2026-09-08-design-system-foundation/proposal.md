## Why

O `mvp-campaign-management` descreve o que o produto faz, mas não com que cara. Definir a direção visual depois de meia dúzia de telas prontas significa retrabalhar todas elas, e trocar um token custa nada agora e custa caro depois.

Há também uma decisão de identidade a registrar, porque ela é contraintuitiva e vai ser questionada depois: **a interface não parece material de marketing de D&D.** Sem pergaminho, sem tipografia medieval, sem couro, sem dourado sobre marrom. O app fica aberto três a quatro horas, à noite, num segundo monitor, enquanto a pessoa fala no Discord. Nesse contexto, textura atrás de um número de HP não é identidade, é custo de leitura.

O argumento decisivo é orçamento de cor. Num tracker de combate, cor precisa significar algo: vermelho é dano, verde é cura, o acento marca turno ativo e ação primária. Se o cromo inteiro já é âmbar-dourado, o orçamento foi gasto na decoração e não sobra nada para semântica. Base neutra não é ausência de identidade, é o que torna a identidade legível.

A identidade de D&D mora em quatro lugares, nenhum deles no cromo: o resultado do dado, os numerais tabulares, uma display type com caráter, e o conteúdo da própria campanha (retratos, mapas, arte).

## What Changes

- Cria o `client/` do monorepo: Vite + React + TypeScript, ainda sem telas.
- Estabelece a camada de tokens semânticos em Tailwind v4, nos temas escuro e claro.
- Instala o Storybook como laboratório do sistema, compartilhando a mesma entrada CSS do app.
- Entrega os 12 componentes de que a fase 0 do MVP precisa, cada um com seus estados.
- Entrega o `DiceResult` fora da ordem de fases, de propósito: é a prova de que a direção funciona.
- Registra em spec os quatro requisitos que apodrecem em silêncio se ninguém os travar.

## Capabilities

### New Capabilities

- `design-foundation`: as garantias transversais do sistema visual, verificáveis e sujeitas a regressão silenciosa. Acessibilidade de contraste nos dois temas, colapso sob movimento reduzido, tema único por página e a linguagem de conteúdo secreto.

### Modified Capabilities

Nenhuma.

## Non-Goals

- Telas reais e rotas do aplicativo. Este change entrega peças e o laboratório, não produto.
- Componentes das fases 1 a 3 do MVP (AbilityScore, InitiativeList, ConditionChip, VisibilityToggle, Prose). Serão feitos quando as telas existirem.
- Qualquer código de servidor, banco ou autenticação.
- Logo, marca, ilustração e arte de campanha.
- Documentar em spec a existência de cada componente. É para isso que serve o Storybook.

## Impact

- Cria `client/` e a configuração de Storybook. Nada do que o MVP já planejou muda.
- A fase 0 do `mvp-campaign-management` passa a depender deste change: as telas de login, campanha e membros consomem estes componentes em vez de inventá-los.
- Novas dependências: Tailwind v4, shadcn/ui sobre Radix, Storybook 10.6 com `addon-a11y`, Phosphor Icons, Motion. A decisão de manter a versão instalada está registrada no `design.md`.
- Fontes auto-hospedadas no repositório (Space Grotesk, Geist, Geist Mono), todas sob OFL-1.1. Space Grotesk substitui Cabinet Grotesk para permitir redistribuição. Sem requisição a CDN de fontes em produção.
- Um segundo build a manter (o do Storybook). Custo aceito porque aqui o sistema é o entregável, não um acessório.
