# Revisão do Storybook

## Direção preservada

Ferramenta para sessões longas de RPG. Neutros frios, azul lápis para ações,
vermelho para dano e verde para cura. Variação 3, movimento 3, densidade 6.
Evolução da fundação existente, com React, Tailwind v4 e Phosphor.
Sem mudanças de marca, rotas ou arquitetura de informação do produto.

## Auditoria inicial

- Existia uma única story, Foundations, sem componentes ou estados interativos.
- O decorator não aplicava a classe `theme-frame`: o rótulo do tema claro ficava
  sobre o fundo escuro, com contraste incorreto.
- O mínimo de 340px no grid, somado ao padding, excedia viewports pequenos.
- Breakpoints de viewport subdividiam os exemplos mesmo quando cada painel
  tinha pouco espaço. Nomes de tokens eram truncados.
- As duas instâncias compartilhavam IDs como `fund-paleta`.
- Cabinet Grotesk, Geist e Geist Mono eram declaradas, mas nenhum arquivo de fonte era carregado.
- Textos visíveis tinham perdido acentos.
- O lint falhava pelo retorno `any` em `.storybook/main.ts`.
- O CSS de enquadramento do laboratório também era enviado ao app.

## Escopo da evolução

Comparação de temas corrigida, modos individuais e preferência do sistema;
seções por assunto; tokens organizados por função; exemplos de controles e
superfície secreta compartilhados com o produto; fontes Geist locais;
associação de rótulo, ajuda e erro; IDs únicos; layout por largura do container.

As regras de landing page da skill design-taste-frontend não se aplicam ao
catálogo: sem hero promocional, imagens decorativas ou animações de entrada.
Pontuação Unicode existente é preservada conforme as instruções do projeto.

## Pendências fora desta revisão

- Cabinet Grotesk permanece como opção de display pendente da verificação e
  inclusão dos arquivos. O fallback explícito passa a ser Geist, já carregada.
- Dialog, Toast, Avatar, CopyField, AppShell, DiceResult e tela composta de
  campanha continuam no plano original. Esta revisão não conclui a fase 0.
- Os futuros componentes compostos devem seguir a base Radix/shadcn prevista
  no design. Os controles desta revisão usam semântica nativa de HTML.

## Referências

Consultados os tipos locais e a
[documentação de toolbars do Storybook](https://storybook.js.org/docs/essentials/toolbars-and-globals),
além da [instalação oficial do Fontsource](https://fontsource.org/fonts/geist/install).

## Verificação realizada

- `npm run lint`: aprovado.
- `npm run build`: aprovado, com fontes locais e licenças no diretório público.
- `npm run build-storybook`: aprovado.
- 19 stories auditadas com axe-core, nos dois temas, sem violações WCAG A/AA
  detectadas nem verificações inconclusivas.
- Todas as stories verificadas em 320, 390, 768 e 1280px, sem overflow horizontal
  ou IDs duplicados. A auditoria axe foi executada em 390px.
- Story Estados: teste de interação aprovado no painel Interactions, cobrindo
  preenchimento, descrições acessíveis, confirmação, cancelamento e desabilitados.
- Modo Sistema verificado alternando a preferência do navegador entre claro e escuro.
- Movimento reduzido emulado: todos os esqueletos e indicadores de carregamento
  resultaram em `animation-name: none`.
- Menor contraste do botão primário: 4,63:1. Bordas dos campos: 3,41:1 no claro
  e 3,97:1 no escuro, considerando as quatro superfícies.

O build do Storybook mantém um aviso de chunks acima de 500kB, associado ao
laboratório e seus addons. O build do app não apresentou esse aviso. Core Web
Vitals de uma tela real de campanha ainda não foram medidos.

Para repetir a inspeção com o Storybook em `localhost:6006`, abra uma aba no
navegador integrado e execute `node scripts/inspect-storybook.mjs <browserPageId> --matrix`.
O script também aceita o ID de uma story como filtro após `--matrix`.
As licenças de Geist e Geist Mono acompanham os dois builds em `/licenses/`.
