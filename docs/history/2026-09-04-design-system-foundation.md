# design-system-foundation

> Registro histórico, escrito originalmente como change do OpenSpec (criado em 2026-09-04).
> Status em 2026-10-18: concluído. O estado atual do produto está em
> [`../roadmap.md`](../roadmap.md) e a arquitetura em [`../architecture.md`](../architecture.md).

## Resumo

Direção visual do `quest-fast` e o laboratório onde ela vive. Tokens, os 12 componentes da fase 0 e o Storybook. Sem telas, sem servidor.

**Precede a fase 0 do `mvp-campaign-management`.** As telas de login, campanha e membros consomem estes componentes em vez de inventá-los.

### Why

Definir a direção visual depois de meia dúzia de telas prontas significa retrabalhar todas elas. Trocar um token agora custa nada.

Há também uma decisão contraintuitiva a registrar: **a interface não parece material de marketing de D&D.** O app fica aberto três a quatro horas, à noite, num segundo monitor. Textura de pergaminho atrás de um número de HP não é identidade, é custo de leitura. E o argumento decisivo é orçamento de cor: num tracker de combate, vermelho é dano e verde é cura; se o cromo inteiro já é dourado, não sobra cor para significar nada.

A identidade mora no resultado do dado, nos numerais tabulares, numa display type com caráter, e no conteúdo da campanha. Não no cromo.

### Capabilities

#### New Capabilities

- `design-foundation`: as quatro garantias transversais que apodrecem em silêncio se ninguém as travar. Contraste WCAG AA nos dois temas, colapso sob movimento reduzido, tema único por página e a linguagem de conteúdo secreto.

#### Modified Capabilities

Nenhuma.

### Ordem de construção

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

### Duas armadilhas que o plano evita de propósito

**Deriva.** Sistema construído só em isolamento fica bom componente a componente e desmorona quando composto. Por isso a story "Campanha" é obrigatória antes de fechar o change.

**Divergência entre lab e produto.** O `.storybook/preview.ts` importa o mesmo `src/styles/index.css` do app. Storybook com config de Tailwind própria é a receita conhecida para os dois divergirem em silêncio.

## Proposta

### Why

O `mvp-campaign-management` descreve o que o produto faz, mas não com que cara. Definir a direção visual depois de meia dúzia de telas prontas significa retrabalhar todas elas, e trocar um token custa nada agora e custa caro depois.

Há também uma decisão de identidade a registrar, porque ela é contraintuitiva e vai ser questionada depois: **a interface não parece material de marketing de D&D.** Sem pergaminho, sem tipografia medieval, sem couro, sem dourado sobre marrom. O app fica aberto três a quatro horas, à noite, num segundo monitor, enquanto a pessoa fala no Discord. Nesse contexto, textura atrás de um número de HP não é identidade, é custo de leitura.

O argumento decisivo é orçamento de cor. Num tracker de combate, cor precisa significar algo: vermelho é dano, verde é cura, o acento marca turno ativo e ação primária. Se o cromo inteiro já é âmbar-dourado, o orçamento foi gasto na decoração e não sobra nada para semântica. Base neutra não é ausência de identidade, é o que torna a identidade legível.

A identidade de D&D mora em quatro lugares, nenhum deles no cromo: o resultado do dado, os numerais tabulares, uma display type com caráter, e o conteúdo da própria campanha (retratos, mapas, arte).

### What Changes

- Cria o `client/` do monorepo: Vite + React + TypeScript, ainda sem telas.
- Estabelece a camada de tokens semânticos em Tailwind v4, nos temas escuro e claro.
- Instala o Storybook como laboratório do sistema, compartilhando a mesma entrada CSS do app.
- Entrega os 12 componentes de que a fase 0 do MVP precisa, cada um com seus estados.
- Entrega o `DiceResult` fora da ordem de fases, de propósito: é a prova de que a direção funciona.
- Registra em spec os quatro requisitos que apodrecem em silêncio se ninguém os travar.

### Capabilities

#### New Capabilities

- `design-foundation`: as garantias transversais do sistema visual, verificáveis e sujeitas a regressão silenciosa. Acessibilidade de contraste nos dois temas, colapso sob movimento reduzido, tema único por página e a linguagem de conteúdo secreto.

#### Modified Capabilities

Nenhuma.

### Non-Goals

- Telas reais e rotas do aplicativo. Este change entrega peças e o laboratório, não produto.
- Componentes das fases 1 a 3 do MVP (AbilityScore, InitiativeList, ConditionChip, VisibilityToggle, Prose). Serão feitos quando as telas existirem.
- Qualquer código de servidor, banco ou autenticação.
- Logo, marca, ilustração e arte de campanha.
- Documentar em spec a existência de cada componente. É para isso que serve o Storybook.

### Impact

- Cria `client/` e a configuração de Storybook. Nada do que o MVP já planejou muda.
- A fase 0 do `mvp-campaign-management` passa a depender deste change: as telas de login, campanha e membros consomem estes componentes em vez de inventá-los.
- Novas dependências: Tailwind v4, shadcn/ui sobre Radix, Storybook 10.6 com `addon-a11y`, Phosphor Icons, Motion. A decisão de manter a versão instalada está registrada no `design.md`.
- Fontes auto-hospedadas no repositório (Space Grotesk, Geist, Geist Mono), todas sob OFL-1.1. Space Grotesk substitui Cabinet Grotesk para permitir redistribuição. Sem requisição a CDN de fontes em produção.
- Um segundo build a manter (o do Storybook). Custo aceito porque aqui o sistema é o entregável, não um acessório.

## Design

### Context

Primeiro código do repositório. O `mvp-campaign-management` definiu comportamento e stack (Vite + React + TypeScript no cliente, Hono no servidor, Drizzle + SQLite); este change define a linguagem visual e entrega o laboratório onde ela vive.

O contexto de uso manda em tudo o que vem abaixo: o app fica aberto três a quatro horas seguidas, à noite, num segundo monitor, enquanto a pessoa conversa no Discord. Não é uma página que se visita, é uma ferramenta que se opera durante uma sessão.

Duas perguntas precisam ser respondidas em menos de um segundo, em qualquer tela: **quem está jogando agora** e **quem pode ver isto**. A segunda é a mais séria, porque o modo de falha do produto é o mestre revelar conteúdo privado sem querer.

### Goals / Non-Goals

**Goals:**

- Fixar a direção visual antes de existir tela, quando trocar um token ainda é barato.
- Entregar um laboratório onde a identidade possa ser julgada e ajustada sem app.
- Entregar os componentes que a fase 0 do MVP consome, com os estados que o produto realmente tem.
- Travar em spec as garantias transversais que apodrecem em silêncio.

**Non-Goals:**

- Telas, rotas e qualquer código de servidor.
- Componentes das fases 1 a 3 do MVP.
- Logo, marca e ilustração.
- Especificar em requisito a existência de cada componente.

### Decisions

#### Atualização de implementação — 2026-09-08

- **Fontes:** Space Grotesk substitui Cabinet Grotesk nos títulos. A seção 02 da [licença ITF FFL](https://www.fontshare.com/licenses/itf-ffl) restringe redistribuição, incompatível com distribuir os binários no repositório self-hosted. Space Grotesk, Geist e Geist Mono usam OFL-1.1; arquivos latinos originais, incluindo os caracteres de pt-BR, ficam em `client/public/fonts`, com licenças em `client/public/licenses` e `font-display: swap`. As referências a Cabinet abaixo registram a proposta original; a escolha vigente é Space Grotesk.
- **Laboratório:** manter Storybook 10.6, já instalado e validado neste repositório, em vez de rebaixá-lo para a versão 9 citada originalmente. Builder Vite, CSS compartilhado, addon-a11y e comparação de temas continuam obrigatórios.
- **shadcn/Radix:** instalação manual, com `components.json`, alias `@`, utilitário `cn` e composição de Dialog baseada em shadcn/Radix. Preservar os controles HTML existentes. Cores, raio, tipografia e elevação vêm exclusivamente dos tokens do projeto; ícones continuam Phosphor.
- **Portais:** Dialog herda o tema do destino via `PortalScope`; no aplicativo o destino padrão é o body, que herda o tema da raiz. O laboratório fornece um destino dentro de cada painel, sem adicionar tema próprio ao componente.
- **Execução:** concluir fontes e antideriva, validar Foundations, entregar componentes com stories interativas, montar Campanha e verificar todos os cenários do spec. Atualizar `tasks.md` conforme cada entrega for comprovada.

#### 1. Direção de identidade: ferramenta silenciosa

Disciplina de ferramenta de trabalho, não de material promocional. Base neutra fria, um acento só, semântica de cor preservada para significado. A interface recua e a campanha aparece.

O default do gênero (pergaminho, Cinzel ou Uncial, couro, filigrana, d20 como logo, gradiente dourado) foi descartado por três razões: é o que todo produto do gênero faz, prejudica leitura em sessão longa e consome o orçamento de cor que a semântica precisa.

*Alternativas consideradas:* "mesa à luz de vela", com acento ember quente e grão sutil, descartada porque laranja vive perto de vermelho e aperta a separação entre acento e perigo; "grimório moderno", com influência editorial e ar generoso, descartada porque densidade e ar puxam para lados opostos no tracker de combate.

*Risco assumido:* a direção neutra pode terminar genérica. A mitigação está nas decisões 2 e 6, não na sorte.

#### 2. Tipografia

| Papel | Fonte | Razão |
|---|---|---|
| Display | Space Grotesk | Geométrica, com detalhes derivados de uma família monoespaçada. Dá caráter aos títulos e permite redistribuir os arquivos sob OFL. |
| UI e corpo | Geist | x-height alto, legível a 14px sob densidade 6. |
| Numerais | Geist Mono, `tabular-nums` | HP, CA, iniciativa e dados. Funcional e temático ao mesmo tempo, porque o jogo é números. |

Auto-hospedadas com `@font-face` e `font-display: swap`. Sem `<link>` para CDN de fontes em produção.

Sem serifa. "Plataforma de RPG" não é justificativa editorial, e serifa por default é o tell mais comum deste tipo de projeto.

#### 3. Tokens semânticos, nunca cor crua no componente

```
SUPERFICIE          TEXTO              ACAO / ESTADO
--surface           --text-primary     --accent        #3B6FE0
--surface-raised    --text-secondary   --accent-fg
--surface-overlay   --text-muted       --danger        #E5484D
--surface-secret                       --success       #30A46C
--border-subtle                        --focus-ring
--border-strong
```

Declarados em `@theme` do Tailwind v4. Escuro é o padrão e respeita `prefers-color-scheme`; claro é obrigatório, porque preparação de campanha acontece de dia.

O acento é lapis (`#3B6FE0`) por separação semântica máxima: não é vermelho, não é verde, então sobra para turno ativo e ação primária sem ambiguidade.

#### 4. Conteúdo secreto: três sinais redundantes, nenhuma matiz nova

A solução não introduz cor própria. Isso preservaria o argumento de orçamento de cor, mas seria frágil e hostil a daltônicos.

```
  +- - - - - - - - - - - - - - - - - - -+
  :  [olho cortado]  SO VOCE VE ISTO    :
  :                                     :
  :  Edgar trai o grupo no capitulo 3.  :
  +- - - - - - - - - - - - - - - - - - -+
     borda tracejada + icone + rotulo
     superficie recuada, sem matiz nova
```

Superfície recuada (`--surface-secret`), borda tracejada, ícone de olho cortado e rótulo textual. Três sinais redundantes, para que a informação sobreviva a daltonismo, a monitor mal calibrado e a um relance de meio segundo.

#### 5. Escala, forma e elevação

```
TIPO                        ESPACO      RAIO (regra unica documentada)
display  32/36  Space       4 8 12      6px   input, botao, chip
h1       24/28  Space       16 24 32    10px  card, painel, dialog
h2       18/24  Geist       48 64       full  avatar, badge-pill
body     14/20  Geist
small    13/18  Geist
micro    11/16  Geist  uppercase, com parcimonia
numero          Geist Mono  tabular-nums
```

Corpo a 14px, não 16: densidade 6 é product UI, e 16px desperdiça linha no tracker de combate.

Raio segue uma regra única e documentada, aplicada em toda parte. Botão redondo em layout quadrado é design quebrado.

Elevação em tema escuro vem de contraste de borda e de superfície, não de `box-shadow`, porque sombra quase não funciona sobre fundo escuro. Quando houver sombra, ela é tingida com o matiz do fundo, nunca preto puro.

#### 6. Motion contido, com uma exceção deliberada

```
instant  80ms    hover, active
quick   140ms    toggle, tab, popover
settle  220ms    dialog, toast, sheet
easing  cubic-bezier(0.16, 1, 0.3, 1)
```

Cada animação é justificável em uma frase: feedback, transição de estado ou hierarquia. Nada de loop infinito decorativo.

A exceção é o resultado do dado, que sobe para cerca de 700ms com spring. É o único momento do produto com peso narrativo, e é onde a identidade se prova.

```
  vantagem, d20+7

    [16]  [09]           <- descartado riscado e apagado
     ^^

        23               <- Geist Mono, 48px, numeral tabular
        16 + 7           <- decomposicao em 13px

  natural 20  ->  numeral em acento, escala assenta
  natural 1   ->  numeral em danger, queda breve
```

Sob movimento reduzido o resultado aparece pronto, sem tombo. Sem confete, que seria exatamente o tell que esta direção evita.

#### 7. shadcn/ui sobre Radix, customizado desde o primeiro componente

Radix resolve teclado, foco e ARIA de dialog, tabs e popover, que é trabalho caro de refazer e fácil de errar. shadcn entrega o código para dentro do repositório, então não há biblioteca opinando sobre estética.

Regra que vem junto: nunca em estado default. Raio, cor, sombra e tipografia são reescritos para os tokens acima antes de qualquer componente ser considerado pronto.

Ícones Phosphor, uma família só, `weight` padronizado. Sem SVG desenhado à mão.

#### 8. Storybook compartilha a entrada CSS do app

`.storybook/preview.ts` importa o mesmo `src/styles/index.css` que o app importa. Storybook com configuração de Tailwind própria é a receita conhecida para o laboratório e o produto divergirem em silêncio.

Add-ons obrigatórios: `addon-a11y`, porque contraste é requisito e não opinião, e um decorator de tema que mostre escuro e claro lado a lado, porque tema testado num modo só é tema não testado.

#### 9. Story de tela composta como antídoto à deriva

Sistema construído inteiro em isolamento deriva: os componentes ficam bons sozinhos e desmoronam quando compostos. Além das stories isoladas, uma story monta a tela de campanha da fase 0 com os componentes reais. É ela que revela desalinhamento, ritmo vertical quebrado e densidade errada.

#### 10. Ordem de construção

```
1. Vite + React + TS
2. Tailwind v4  ->  tokens em @theme  +  fontes auto-hospedadas
3. Storybook  +  addon-a11y  +  decorator de tema
4. Story "Foundations"   <- julga a identidade antes de existir componente
5. Os 12 componentes da fase 0, com seus estados
6. DiceResult
7. Story "Campanha"      <- tela composta
```

O passo 4 é o que dá o retorno maior: uma story que só exibe cor, tipo, espaço e raio nos dois temas permite julgar a direção antes de escrever qualquer código de UI, quando ajustar token ainda é gratuito.

### Risks / Trade-offs

- **A direção neutra pode terminar genérica.** É o risco central desta escolha. → Mitigação: Space Grotesk carregando os títulos, numerais tabulares em toda parte e o `DiceResult` entregue neste change justamente para provar a identidade antes de o sistema crescer.
- **Sistema construído em isolamento deriva.** → Mitigação: a story de tela composta (decisão 9), obrigatória antes de declarar o change pronto.
- **Segundo build a manter.** O Storybook tem sua própria configuração e pode divergir do app. → Mitigação: entrada CSS única compartilhada (decisão 8).
- **Licença das fontes.** Cabinet Grotesk foi substituída por Space Grotesk após a verificação de redistribuição. → As três famílias entregues usam OFL-1.1; suas licenças acompanham os binários.
- **Componentes prontos antes das telas correm risco de sobrar ou faltar.** → Mitigação: a lista de 12 saiu das tasks da fase 0 do MVP, não de um catálogo genérico; o que as fases 1 a 3 pedirem será feito quando as telas existirem.
- **`addon-a11y` verifica contraste, não julgamento.** Ele não pega hierarquia quebrada nem alvo de toque pequeno demais. → Revisão manual nos dois temas antes de fechar o change.

### Open Questions

- Marca e logo ficam fora deste change. Decidir depois se o produto precisa de um símbolo próprio ou se o wordmark em Space Grotesk basta.

## Requisitos

### design-foundation

#### ADDED Requirements

##### Requirement: Contraste acessível nos dois temas
O sistema SHALL garantir que texto, rótulos de botão, campos de formulário, placeholders, textos de ajuda e mensagens de erro atinjam no mínimo o contraste WCAG AA contra a superfície em que aparecem, tanto no tema escuro quanto no claro.

###### Scenario: Texto de corpo
- **WHEN** um texto de corpo é renderizado sobre qualquer superfície do sistema, em qualquer um dos dois temas
- **THEN** a razão de contraste é de no mínimo 4.5:1

###### Scenario: Rótulo de botão
- **WHEN** um botão de qualquer variante é renderizado, em qualquer um dos dois temas
- **THEN** o rótulo atinge no mínimo 4.5:1 contra o preenchimento do próprio botão, incluindo variantes fantasma e sobre superfícies elevadas

###### Scenario: Campo de formulário
- **WHEN** um campo é renderizado com rótulo, texto de ajuda, placeholder e mensagem de erro
- **THEN** todos esses textos atingem no mínimo 4.5:1 contra a superfície do campo, e o anel de foco é distinguível da borda em repouso

##### Requirement: Colapso sob movimento reduzido
O sistema SHALL desativar transições, animações de entrada e a animação do resultado de dado quando o usuário sinaliza `prefers-reduced-motion: reduce`, apresentando o estado final imediatamente.

###### Scenario: Transição de componente
- **WHEN** um diálogo, toast, aba ou popover é aberto com movimento reduzido ativo
- **THEN** ele aparece diretamente no estado final, sem transição

###### Scenario: Resultado de dado
- **WHEN** um resultado de rolagem é exibido com movimento reduzido ativo
- **THEN** o número final e a decomposição aparecem prontos, sem animação de assentamento

###### Scenario: Indicador de carregamento
- **WHEN** um esqueleto de carregamento é exibido com movimento reduzido ativo
- **THEN** ele é apresentado sem animação de brilho ou pulso, mantendo a forma que reserva o espaço

##### Requirement: Tema único por página
O sistema SHALL aplicar um único tema a toda a superfície visível das páginas do produto, e SHALL impedir que um componente ou seção force o tema oposto ao da página. A comparação de temas lado a lado pertence exclusivamente ao laboratório Storybook.

###### Scenario: Tema aplicado na raiz
- **WHEN** o tema é definido na raiz da aplicação
- **THEN** todos os componentes derivam suas cores dos tokens desse tema, sem invertê-lo localmente

###### Scenario: Preferência do sistema
- **WHEN** o usuário não escolheu tema manualmente
- **THEN** o sistema adota o tema indicado por `prefers-color-scheme` e o mantém em toda a página

###### Scenario: Portal de diálogo
- **WHEN** um diálogo é aberto em uma página com tema definido
- **THEN** seu conteúdo herda os tokens do tema da página, mesmo sendo renderizado em um portal

###### Scenario: Tentativa de inversão local
- **WHEN** uma seção recebe `data-theme` com o tema oposto ao da raiz
- **THEN** suas cores continuam derivando do tema da raiz

##### Requirement: Linguagem de conteúdo secreto
O sistema SHALL identificar conteúdo visível apenas ao mestre por três sinais simultâneos e redundantes: superfície recuada com borda tracejada, ícone e rótulo textual. A identificação SHALL NOT depender apenas de cor.

###### Scenario: Conteúdo secreto exibido ao mestre
- **WHEN** um conteúdo restrito ao mestre é renderizado
- **THEN** ele aparece sobre a superfície recuada com borda tracejada, acompanhado do ícone e do rótulo que declaram a restrição

###### Scenario: Percepção sem cor
- **WHEN** a página é observada sem distinção de cor, por daltonismo ou monitor mal calibrado
- **THEN** a borda tracejada, o ícone e o rótulo continuam identificando o conteúdo como restrito

###### Scenario: Consistência entre superfícies
- **WHEN** conteúdo restrito ao mestre aparece em qualquer parte do produto
- **THEN** ele usa exatamente a mesma linguagem visual, sem variação por tela

## Tarefas

### Verificação do progresso — 2026-09-08

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

### 1. Scaffold do cliente

- [x] 1.1 Criar `client/` com Vite + React + TypeScript e ajustar o monorepo
- [x] 1.2 Instalar e configurar Tailwind v4 (plugin do Vite, não o do PostCSS)
- [x] 1.3 Verificar os termos de licença de Cabinet Grotesk e Geist para self-host; trocar por alternativa livre equivalente se algum termo não servir
- [x] 1.4 Versionar os arquivos de fonte e declarar `@font-face` com `font-display: swap`
- [x] 1.5 Instalar Phosphor Icons e Motion

### 2. Camada de tokens

- [x] 2.1 Declarar os tokens semânticos em `@theme` no `src/styles/index.css`, tema escuro
- [x] 2.2 Declarar o tema claro e ligar a alternância a `prefers-color-scheme`
- [x] 2.3 Escala tipográfica, escala de espaço e a regra única de raio
- [x] 2.4 Escala de motion e o wrapper de `prefers-reduced-motion`
- [x] 2.5 Regra de lint que impeça cor crua em componente, forçando o uso dos tokens

### 3. Laboratório

- [x] 3.1 Instalar Storybook com o builder do Vite — versão 10.6 mantida conforme decisão no `design.md`
- [x] 3.2 Importar em `.storybook/preview.ts` o mesmo `src/styles/index.css` do app
- [x] 3.3 Instalar `addon-a11y`
- [x] 3.4 Decorator de tema exibindo escuro e claro lado a lado
- [x] 3.5 Story "Foundations": cor, tipo, espaço e raio nos dois temas
- [x] 3.6 **Ponto de decisão:** julgar a identidade na story Foundations e ajustar tokens antes de construir componente — revisão original preservada; Space Grotesk conferida nos dois temas nesta implementação

### 4. Base do shadcn/ui

- [x] 4.1 Inicializar o shadcn apontando para os tokens do projeto
- [x] 4.2 Reescrever raio, cor, sombra e tipografia dos componentes gerados; nenhum fica em estado default

### 5. Componentes da fase 0

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

### 6. Prova de identidade

- [x] 6.1 `DiceResult`: total tabular, decomposição, dados individuais
- [x] 6.2 Vantagem e desvantagem com o dado descartado riscado e apagado
- [x] 6.3 Tratamento de 20 e 1 naturais
- [x] 6.4 Assentamento com spring, colapsando para estado final sob movimento reduzido

### 7. Antideriva e fechamento

- [x] 7.1 Story "Campanha": tela da fase 0 montada com os componentes reais
- [x] 7.2 Corrigir o que a tela composta revelar (ritmo vertical, densidade, alinhamento)
- [x] 7.3 Rodar `addon-a11y` em todas as stories, nos dois temas, e zerar as violações de contraste
- [x] 7.4 Revisão manual nos dois temas: hierarquia, alvo de toque, estado de foco visível por teclado
- [x] 7.5 Verificar os quatro requisitos do spec `design-foundation` um a um
- [x] 7.6 `openspec validate design-system-foundation` e `openspec status`
