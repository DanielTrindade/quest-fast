## ADDED Requirements

### Requirement: Contraste acessível nos dois temas
O sistema SHALL garantir que texto, rótulos de botão, campos de formulário, placeholders, textos de ajuda e mensagens de erro atinjam no mínimo o contraste WCAG AA contra a superfície em que aparecem, tanto no tema escuro quanto no claro.

#### Scenario: Texto de corpo
- **WHEN** um texto de corpo é renderizado sobre qualquer superfície do sistema, em qualquer um dos dois temas
- **THEN** a razão de contraste é de no mínimo 4.5:1

#### Scenario: Rótulo de botão
- **WHEN** um botão de qualquer variante é renderizado, em qualquer um dos dois temas
- **THEN** o rótulo atinge no mínimo 4.5:1 contra o preenchimento do próprio botão, incluindo variantes fantasma e sobre superfícies elevadas

#### Scenario: Campo de formulário
- **WHEN** um campo é renderizado com rótulo, texto de ajuda, placeholder e mensagem de erro
- **THEN** todos esses textos atingem no mínimo 4.5:1 contra a superfície do campo, e o anel de foco é distinguível da borda em repouso

### Requirement: Colapso sob movimento reduzido
O sistema SHALL desativar transições, animações de entrada e a animação do resultado de dado quando o usuário sinaliza `prefers-reduced-motion: reduce`, apresentando o estado final imediatamente.

#### Scenario: Transição de componente
- **WHEN** um diálogo, toast, aba ou popover é aberto com movimento reduzido ativo
- **THEN** ele aparece diretamente no estado final, sem transição

#### Scenario: Resultado de dado
- **WHEN** um resultado de rolagem é exibido com movimento reduzido ativo
- **THEN** o número final e a decomposição aparecem prontos, sem animação de assentamento

#### Scenario: Indicador de carregamento
- **WHEN** um esqueleto de carregamento é exibido com movimento reduzido ativo
- **THEN** ele é apresentado sem animação de brilho ou pulso, mantendo a forma que reserva o espaço

### Requirement: Tema único por página
O sistema SHALL aplicar um único tema a toda a superfície visível das páginas do produto, e SHALL impedir que um componente ou seção force o tema oposto ao da página. A comparação de temas lado a lado pertence exclusivamente ao laboratório Storybook.

#### Scenario: Tema aplicado na raiz
- **WHEN** o tema é definido na raiz da aplicação
- **THEN** todos os componentes derivam suas cores dos tokens desse tema, sem invertê-lo localmente

#### Scenario: Preferência do sistema
- **WHEN** o usuário não escolheu tema manualmente
- **THEN** o sistema adota o tema indicado por `prefers-color-scheme` e o mantém em toda a página

#### Scenario: Portal de diálogo
- **WHEN** um diálogo é aberto em uma página com tema definido
- **THEN** seu conteúdo herda os tokens do tema da página, mesmo sendo renderizado em um portal

#### Scenario: Tentativa de inversão local
- **WHEN** uma seção recebe `data-theme` com o tema oposto ao da raiz
- **THEN** suas cores continuam derivando do tema da raiz

### Requirement: Linguagem de conteúdo secreto
O sistema SHALL identificar conteúdo visível apenas ao mestre por três sinais simultâneos e redundantes: superfície recuada com borda tracejada, ícone e rótulo textual. A identificação SHALL NOT depender apenas de cor.

#### Scenario: Conteúdo secreto exibido ao mestre
- **WHEN** um conteúdo restrito ao mestre é renderizado
- **THEN** ele aparece sobre a superfície recuada com borda tracejada, acompanhado do ícone e do rótulo que declaram a restrição

#### Scenario: Percepção sem cor
- **WHEN** a página é observada sem distinção de cor, por daltonismo ou monitor mal calibrado
- **THEN** a borda tracejada, o ícone e o rótulo continuam identificando o conteúdo como restrito

#### Scenario: Consistência entre superfícies
- **WHEN** conteúdo restrito ao mestre aparece em qualquer parte do produto
- **THEN** ele usa exatamente a mesma linguagem visual, sem variação por tela
