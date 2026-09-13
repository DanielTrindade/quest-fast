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


## Acabamento de RPG no catálogo (9 de setembro de 2026)

Direção: peças de mesa foscas e precisas. Preservamos as fontes, os neutros frios e o azul de ação. Botões têm luz superior e uma base curta; campos são levemente rebaixados. A moldura interna une ficha, token e resultado. Não há texturas sobre texto, fontes medievais nem movimento decorativo contínuo.

- Avatar mantém o padrão de usuário e acrescenta variant=character, com moldura de token. Tamanhos sm (40 px), md (56 px) e lg (80 px). Carregamento e fallback preservam as dimensões.
- AbilityCard recebe rótulo, abreviação, valor, modificador e bônus de resistência. Apresenta consulta ou ações por callbacks; não calcula regras nem envia pedidos. Usa-se o mesmo componente na ficha do produto e nas stories.
- Surface acrescenta a variante sheet, com moldura dupla discreta. A variante secreta mantém texto, ícone e borda tracejada; aparência não substitui autorização.
- DiceResult distingue lados, valor individual, descarte, total e conta completa. O rótulo de 1/20 natural não afirma automaticamente sucesso ou falha. Movimento reduzido é preservado.
- Insígnias de papel usam raio de controle (6 px); avatares/tokens continuam circulares. Painéis, diálogos e atributos usam 10 px. O pequeno losango de carregamento é um símbolo, não um novo formato de controle.
- EmptyState aceita ícone contextual da família Phosphor; o padrão continua sendo Notebook.

A composição **Composições / Peças da mesa** permite comparar os componentes juntos. As rolagens são exemplos locais com dado fixo em 14, explicitamente identificado. Inclui nome longo e interação que verifica ataque e modificador negativo. O retrato foi gerado para a demonstração; a origem está em client/public/portraits/README.md. Não é aplicado aos personagens reais.

Os tokens edge-light, edge-shadow, action-light e action-shadow controlam o acabamento. Estados de hover escurecem ações primárias e alteram a superfície das secundárias; foco por teclado permanece independente do hover. Os campos e seletores especiais da ficha receberam tratamento compatível.

Referências: [Avatar do Radix](https://www.radix-ui.com/primitives/docs/components/avatar) e [stories do Storybook](https://storybook.js.org/docs/writing-stories). Context7 MCP indisponível nesta sessão; tipos dos pacotes instalados e documentação oficial conferidos.

Validação: lint e build do aplicativo aprovados; suíte completa do Storybook com 67/67 verificações aprovadas (66 stories e cenários adicionais). Verificação automatizada nos temas claro/escuro e larguras 320, 390, 768 e 1280 px; cenários de foco modal, teclado, clipboard e movimento reduzido preservados. Capturas de ficha composta, resultado, diálogo e campos revisadas visualmente em `test-results/rpg-components/`. Resultados completos preservados em `test-results/design-system/rpg-full-results.json`. Após o ajuste final de alinhamento e largura das stories, os exemplos de atributos, composição e dados foram conferidos novamente no servidor do Storybook: 13/13 verificações aprovadas.

O build mantém o aviso de chunk JavaScript acima de 500 kB. Esta alteração não certifica Core Web Vitals nem modifica o carregamento das rotas.

## Confiabilidade e fluxo de jogo (9 de setembro de 2026)

Execução do backlog de `ui-ux-etapas-0-1.md`, itens 1 a 3 da ordem sugerida. As extensões de produto (item 4) continuam fora: perícias roláveis, vantagem/desvantagem em rolagem vinculada, histórico paginado, capa de campanha e HP/CA no resumo dependem de mudança de contrato ou de decisão de produto.

- **A interface só oferece o que a API aceita.** `PATCH /characters/:id` é do dono, então a ficha mostra "Editar" apenas para ele e identifica-se como consulta para os demais. Excluir continua com dono ou mestre, como no `DELETE`.
- **Ações destrutivas e saídas são de dois passos.** Excluir personagem confirma nomeando a ficha e dizendo a consequência; a confirmação fica dentro da própria ficha, sem empilhar outra camada. Fechar um editor alterado — por Cancelar, Escape ou clique fora — oferece continuar editando ou descartar.
- **Consulta e edição ocupam uma camada só.** `CharactersSection` alterna entre `CharacterSheetDialog` e `CharacterFormDialog`; fechar o editor volta para a consulta. Nunca há dois `role="dialog"` no DOM.
- **A resposta chega onde a ação aconteceu.** O resultado da rolagem fica preso ao rodapé da ficha (`.sheet-roll`, sticky, `aria-live`), venha de um atributo ou de um ataque. As ações de ataque recebem o mesmo estado de envio dos atributos. O rodapé do editor (`.sheet-form__footer`) usa a mesma técnica para manter Salvar alcançável.
- **A ordem serve o jogo antes da administração.** `.campaign-layout` usa `grid-template-areas`: no celular vem personagens, mesa (dados e histórico) e por fim a administração; no desktop a administração volta para a coluna da esquerda. A ordem do DOM acompanha a ordem visual, então o foco por teclado segue junto.
- **Membros e convite ficam recolhíveis** em um `<details>` que abre sozinho enquanto a mesa está vazia, porque até alguém entrar o convite é o assunto.
- **Acabamento.** Ataques ganharam colunas nomeadas (Acerto, Dano); HP e CA viraram blocos legíveis; a lista de personagens marca "Seu personagem"; a lista de campanhas virou cartão inteiro clicável com descrição curta; o cabeçalho tem retorno nomeado às campanhas; erros recuperáveis oferecem "Tentar novamente"; a descrição do editor se chama "Descrição pública"; grupos de perícia sem itens (Constituição) não aparecem mais.

`CharacterSheetView` separa a apresentação da ficha das consultas e mutações, então cada estado — consulta, confirmação de exclusão, rolando, resultado, erro — é alcançável de uma story em vez de reproduzido à mão no laboratório.

Validação: lint, typecheck, 80 testes de unidade e build aprovados. Storybook com **75/75** verificações (8 stories novas de ficha, nos dois temas e em 320/390/768/1280 px). Contra o aplicativo em execução: `verify:app` 9/9 e `verify:group` **15/15**, incluindo seis critérios de aceite novos — permissão alinhada, confirmação de exclusão, camada única de diálogo, descarte confirmado, ausência de corte nas quatro larguras com a ficha aberta, e dados antes da administração em 390 px.

O aviso de chunk acima de 500 kB permanece. Nada aqui certifica OAuth real, Core Web Vitals ou todos os fluxos de erro.

## Qualidade de vida da sessão (12 de setembro de 2026)

Change OpenSpec `session-qol-foundations`. Componentes novos, todos com story em `client/src/stories/`:

- **`QuickDice`** preenche a expressão do rolador (não rola): pills d4 a d100 e "Repetir" mostrando a última expressão. A restrição de vantagem/desvantagem a um d20 continua no `DiceRoller`.
- **`RollModeControl`** é o segmentado Normal/Vantagem/Desvantagem, compartilhado pelo rolador e pela ficha.
- **`SkillChip`** mostra perícia e bônus; vira botão de rolar só para o dono. Treino aparece na borda e na cor do bônus, e por extenso para leitores de tela. Na ficha, as perícias treinadas vêm primeiro e as demais ficam em um `<details>` "Demais perícias", roláveis só com o modificador.
- **`CharacterRow`** traz HP e CA públicos no resumo; **`CharacterStats`** e **`AttackCard`** saíram do laboratório para a ficha real.
- **`FeedEventCard`** despacha por `event.type`; tipos desconhecidos mostram autor, horário e o tipo, sem quebrar o feed. No histórico, o `DiceResult compact` omite "Rolagem normal" e o bloco de um dado só, que a decomposição já diz.
- **`FeedFollow`** limita a altura do feed no desktop (container query) e mantém a lista na página no celular. "No fim" é medido por um marcador observado com `IntersectionObserver`, então vale nos dois casos; a pill "N novos resultados" é sticky. Eventos novos se distinguem de páginas antigas pelo id do mais recente: "Ver mais" nunca conta como novidade e preserva a posição de leitura. O fim do histórico é indicado por "Início do histórico".
- **`SectionNav`** + `useActiveSection` marcam a seção visível com `aria-current="location"` (são seções de uma página, não páginas). O hook observa os cabeçalhos que aparecem depois das consultas, mantém o destaque entre dois cabeçalhos e responde a clique em âncora na hora.
- **`CharacterForm`** é o editor extraído do diálogo; valida por campo com `validateCharacterInput` (em `shared/`) e, num envio recusado, leva o foco ao primeiro campo inválido.

Validação: lint, typecheck e build aprovados; 36 testes de unidade (shared) e 113 de integração (server), incluindo perícia só do dono, paginação terminando exatamente no limite da página e cursor de outra campanha. Storybook com **114/114** verificações. `verify:app` e `verify:group` não foram executados nesta rodada (exigem o app rodando com seed).
