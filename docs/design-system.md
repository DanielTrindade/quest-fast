# Sistema de design do quest-fast

O cliente compartilha tokens e componentes com o Storybook. A tela “Campanha” é uma composição com dados locais para revisão; autenticação, permissões e persistência pertencem ao MVP.

## Executar e verificar

Na raiz do repositório:

```sh
npm ci
npm run storybook
```

O laboratório fica em `http://localhost:6006`. A barra de ferramentas permite comparar os temas ou escolher escuro, claro e preferência do sistema.

```sh
npm run lint
npm run test:tokens
npm run build
npm run test:design
```

`test:design` constrói o Storybook, serve o resultado localmente na porta 6007 e executa Playwright com axe-core. O Chrome instalado no Windows é usado quando disponível; em outros ambientes, instale Chromium com `npx playwright install chromium`. É possível selecionar um canal instalado com `PLAYWRIGHT_CHANNEL`.

Para auditar um Storybook já aberto, defina `STORYBOOK_URL` e execute `node scripts/verify-design-system.mjs`. Um argumento opcional filtra o ID da story. O argumento `--specs` executa apenas os cenários adicionais de teclado, clipboard, temas e movimento. Resultados e capturas ficam em `test-results/design-system/`, fora do versionamento.

## Composição

- `Button`, `Field` e `Input`: ações e campos com rótulos, descrições e estados de erro.
- `Surface`: base, elevada, sobreposta e secreta. A variante secreta inclui borda tracejada, EyeSlash e rótulo; o consumidor continua responsável pela autorização dos dados.
- `Avatar`, `Badge`, `Skeleton` e `EmptyState`: identidade, papel, espera e orientação para preencher uma tela vazia.
- `Dialog`: título e descrição obrigatórios, foco modal e retorno ao gatilho; composição shadcn/ui sobre Radix.
- `ToastProvider` e `Toast`: notificações de sucesso, erro e informação, com fechamento manual e pausa do tempo ao interagir.
- `CopyField`: usa o clipboard do navegador, confirma a cópia e orienta a seleção manual quando ela falha.
- `AppShell`: cabeçalho, seletor de campanha, navegação desktop e navegação recolhível em telas estreitas. Os callbacks e destinos de navegação são fornecidos pelo consumidor.
- `DiceResult`: apresenta total, decomposição, dados descartados e naturais recebidos. Não rola dados nem calcula regras 5e.

## Tokens e temas

`client/src/styles/index.css` é a entrada única do aplicativo e do laboratório. Cores são semânticas; o lint rejeita hexadecimais, funções de cor, cores nomeadas em propriedades e classes de paleta. A paleta padrão do Tailwind é desativada. Os estilos adicionais dos componentes ficam em `components.css`.

O tema manual usa `data-theme="dark"` ou `data-theme="light"` no elemento `html`. Sem escolha manual, vale `prefers-color-scheme`. Atributos `data-theme` em seções não invertem cores. `data-preview-theme` é exclusivo de `.storybook`, com uso proibido pelo lint no código de produto.

Portais herdam o tema do destino. O app pode usar o destino padrão no `body`; o laboratório usa `PortalScope` para manter os diálogos no painel correto. Não passe cores ou tema diretamente ao diálogo.

Space Grotesk, Geist e Geist Mono são servidas de `public/fonts`, com `font-display: swap`; licenças e origens acompanham os arquivos. A licença de shadcn também está preservada em `public/licenses`.

## Garantias verificadas pelo script

O script carrega todas as stories, aguarda sua execução e verifica acessibilidade, IDs duplicados e overflow em 320, 390, 768 e 1280px. Os cenários adicionais cobrem:

- Foco preso no diálogo, Escape, retorno ao gatilho e foco visível.
- Contraste do diálogo aberto e herança de tema no portal.
- Cópia real do convite para o clipboard.
- Navegação mobile, troca de campanha e alvos de toque de pelo menos 44px.
- Tema manual, preferência do sistema e resistência à inversão local.
- Movimento reduzido para carregamento e resultados de dados, incluindo a troca de preferência em tempo de execução.

As stories interativas cobrem também falha de cópia, fechamento de notificações e cancelamento/confirmação de remoção de membro. Revisão visual de hierarquia e densidade complementa a automação.

## Referências de implementação

Context7 MCP não estava disponível na sessão. Foram consultados os tipos instalados e as fontes oficiais: [instalação manual do shadcn/ui](https://ui.shadcn.com/docs/installation/manual), [Dialog do Radix](https://www.radix-ui.com/primitives/docs/components/dialog), [acessibilidade no Motion](https://motion.dev/docs/react-accessibility) e [API do Playwright](https://playwright.dev/docs/api/class-page).
