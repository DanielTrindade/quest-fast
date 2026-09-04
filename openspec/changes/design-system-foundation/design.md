## Context

Primeiro código do repositório. O `mvp-campaign-management` definiu comportamento e stack (Vite + React + TypeScript no cliente, Hono no servidor, Drizzle + SQLite); este change define a linguagem visual e entrega o laboratório onde ela vive.

O contexto de uso manda em tudo o que vem abaixo: o app fica aberto três a quatro horas seguidas, à noite, num segundo monitor, enquanto a pessoa conversa no Discord. Não é uma página que se visita, é uma ferramenta que se opera durante uma sessão.

Duas perguntas precisam ser respondidas em menos de um segundo, em qualquer tela: **quem está jogando agora** e **quem pode ver isto**. A segunda é a mais séria, porque o modo de falha do produto é o mestre revelar conteúdo privado sem querer.

## Goals / Non-Goals

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

## Decisions

### 1. Direção de identidade: ferramenta silenciosa

Disciplina de ferramenta de trabalho, não de material promocional. Base neutra fria, um acento só, semântica de cor preservada para significado. A interface recua e a campanha aparece.

O default do gênero (pergaminho, Cinzel ou Uncial, couro, filigrana, d20 como logo, gradiente dourado) foi descartado por três razões: é o que todo produto do gênero faz, prejudica leitura em sessão longa e consome o orçamento de cor que a semântica precisa.

*Alternativas consideradas:* "mesa à luz de vela", com acento ember quente e grão sutil, descartada porque laranja vive perto de vermelho e aperta a separação entre acento e perigo; "grimório moderno", com influência editorial e ar generoso, descartada porque densidade e ar puxam para lados opostos no tracker de combate.

*Risco assumido:* a direção neutra pode terminar genérica. A mitigação está nas decisões 2 e 6, não na sorte.

### 2. Tipografia

| Papel | Fonte | Razão |
|---|---|---|
| Display | Cabinet Grotesk | Geométrica, levemente condensada, terminais afiados. É onde mora a personalidade. |
| UI e corpo | Geist | x-height alto, legível a 14px sob densidade 6. |
| Numerais | Geist Mono, `tabular-nums` | HP, CA, iniciativa e dados. Funcional e temático ao mesmo tempo, porque o jogo é números. |

Auto-hospedadas com `@font-face` e `font-display: swap`. Sem `<link>` para CDN de fontes em produção.

Sem serifa. "Plataforma de RPG" não é justificativa editorial, e serifa por default é o tell mais comum deste tipo de projeto.

### 3. Tokens semânticos, nunca cor crua no componente

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

### 4. Conteúdo secreto: três sinais redundantes, nenhuma matiz nova

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

### 5. Escala, forma e elevação

```
TIPO                        ESPACO      RAIO (regra unica documentada)
display  32/36  Cabinet     4 8 12      6px   input, botao, chip
h1       24/28  Cabinet     16 24 32    10px  card, painel, dialog
h2       18/24  Geist       48 64       full  avatar, badge-pill
body     14/20  Geist
small    13/18  Geist
micro    11/16  Geist  uppercase, com parcimonia
numero          Geist Mono  tabular-nums
```

Corpo a 14px, não 16: densidade 6 é product UI, e 16px desperdiça linha no tracker de combate.

Raio segue uma regra única e documentada, aplicada em toda parte. Botão redondo em layout quadrado é design quebrado.

Elevação em tema escuro vem de contraste de borda e de superfície, não de `box-shadow`, porque sombra quase não funciona sobre fundo escuro. Quando houver sombra, ela é tingida com o matiz do fundo, nunca preto puro.

### 6. Motion contido, com uma exceção deliberada

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

### 7. shadcn/ui sobre Radix, customizado desde o primeiro componente

Radix resolve teclado, foco e ARIA de dialog, tabs e popover, que é trabalho caro de refazer e fácil de errar. shadcn entrega o código para dentro do repositório, então não há biblioteca opinando sobre estética.

Regra que vem junto: nunca em estado default. Raio, cor, sombra e tipografia são reescritos para os tokens acima antes de qualquer componente ser considerado pronto.

Ícones Phosphor, uma família só, `weight` padronizado. Sem SVG desenhado à mão.

### 8. Storybook compartilha a entrada CSS do app

`.storybook/preview.ts` importa o mesmo `src/styles/index.css` que o app importa. Storybook com configuração de Tailwind própria é a receita conhecida para o laboratório e o produto divergirem em silêncio.

Add-ons obrigatórios: `addon-a11y`, porque contraste é requisito e não opinião, e um decorator de tema que mostre escuro e claro lado a lado, porque tema testado num modo só é tema não testado.

### 9. Story de tela composta como antídoto à deriva

Sistema construído inteiro em isolamento deriva: os componentes ficam bons sozinhos e desmoronam quando compostos. Além das stories isoladas, uma story monta a tela de campanha da fase 0 com os componentes reais. É ela que revela desalinhamento, ritmo vertical quebrado e densidade errada.

### 10. Ordem de construção

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

## Risks / Trade-offs

- **A direção neutra pode terminar genérica.** É o risco central desta escolha. → Mitigação: Cabinet Grotesk carregando os títulos, numerais tabulares em toda parte e o `DiceResult` entregue neste change justamente para provar a identidade antes de o sistema crescer.
- **Sistema construído em isolamento deriva.** → Mitigação: a story de tela composta (decisão 9), obrigatória antes de declarar o change pronto.
- **Segundo build a manter.** O Storybook tem sua própria configuração e pode divergir do app. → Mitigação: entrada CSS única compartilhada (decisão 8).
- **Licença das fontes.** Cabinet Grotesk vem do Fontshare e Geist é OFL. → Verificar os termos de cada uma antes de versionar os arquivos no repositório, e trocar por alternativa livre equivalente se algum termo não servir para self-host.
- **Componentes prontos antes das telas correm risco de sobrar ou faltar.** → Mitigação: a lista de 12 saiu das tasks da fase 0 do MVP, não de um catálogo genérico; o que as fases 1 a 3 pedirem será feito quando as telas existirem.
- **`addon-a11y` verifica contraste, não julgamento.** Ele não pega hierarquia quebrada nem alvo de toque pequeno demais. → Revisão manual nos dois temas antes de fechar o change.

## Open Questions

- Marca e logo ficam fora deste change. Decidir depois se o produto precisa de um símbolo próprio ou se o wordmark em Cabinet Grotesk basta.
