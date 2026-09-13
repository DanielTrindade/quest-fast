# Auditoria de UI/UX das etapas 0 e 1

Data: 9 de setembro de 2026. Escopo: implementação local, incluindo alterações ainda não commitadas. Auditoria e proposta de evolução; nenhum componente do produto foi alterado.

## Situação (9 de setembro de 2026)

Os problemas prioritários 1 a 7 e as linhas de acabamento que não dependem de contrato foram implementados; o registro está em `docs/design-system.md`. Permanece em aberto o item 4 da ordem sugerida — perícias roláveis, vantagem/desvantagem em rolagem vinculada, histórico paginado, capa de campanha persistida e HP/CA no resumo da lista — porque cada um exige ampliar o contrato ou uma decisão de produto. O texto abaixo é a auditoria original e não foi reescrito.

## Diagnóstico

A fundação tem consistência, mas a composição ainda comunica um gerenciador de cadastros. A experiência de RPG ganha mais com personagens reconhecíveis, consulta rápida da ficha e continuidade entre ação e resultado. A administração da campanha ocupa espaço demais durante o jogo.

Direção: mesa de RPG contemporânea, com fantasia concentrada na identidade da campanha e nos retratos. Preservar neutros frios, azul para ações, cores semânticas, fontes locais e geometria existente. Evitar ornamentação atrás de texto, animação contínua e interfaces que dependam de efeitos para parecerem temáticas.

Aplicação contextual de `design-taste-frontend`: evolução da identidade existente. A própria skill exclui interfaces densas de produto e formulários extensos de seu escopo principal. Regras de hero, limite de seções, imagens obrigatórias e proibição de barras não se aplicam mecanicamente à mesa. Preservar Unicode e pontuação conforme as instruções do projeto.

Leitura dos parâmetros atuais: DESIGN_VARIANCE 3, MOTION_INTENSITY 3, VISUAL_DENSITY 6. Direção proposta: 4 / 3 / 5, com densidade 6 dentro da ficha. A mudança busca hierarquia e fluidez de uso; feedback breve ao rolar ou salvar já é suficiente. Manter React, CSS com tokens/Tailwind, Radix e Phosphor existentes.

## O que está implementado

| Etapa | Frontend encontrado | Limite da constatação |
| --- | --- | --- |
| 0 | Login Discord, listagem, criação e entrada por código; campanha, membros, convite copiável, saída e remoção; estados de espera, erro e vazio | OAuth real não exercitado nesta auditoria |
| 1 | Listagem de personagens, criação/edição com avatar, leitura da ficha, atributos/perícias/resistências/ataques/características; rolagem livre, vantagem/desvantagem, segredo do mestre, rolagens pela ficha e feed via WebSocket | A existência do código não certifica conclusão da fase; há problemas de uso e integração abaixo |

O checklist em `openspec/changes/mvp-campaign-management/tasks.md` ainda deixa 2.9 pendente e diz que a tela falta. Os componentes e `useCampaignSocket` já existem. Atualizar esse registro depois da validação de aceite. Combate, mundo e VTT pertencem a outras fases.

O produto usa `AccountBar` no roteador. O `AppShell` e a campanha do Storybook não são a composição efetivamente usada nas rotas. Aprovação do laboratório não equivale à aprovação desses fluxos.

## Problemas prioritários

### 1. Mobile quebra e afasta as ações principais

Na captura local com a campanha do seed, a página de 320 px apresentou largura de conteúdo de 344 px. O editor apresentou 346 px de conteúdo em 286 px internos, cortando controles. O grid de ataques mantém colunas fixas de 90 e 110 px mais ação; identidade e perícias permanecem em duas colunas sem adaptação específica.

Em 390 px, o painel de dados começou aproximadamente em y=1193, abaixo dos quatro membros. O editor teve cerca de 2668 px de conteúdo em 810 px visíveis. “Salvar alterações” e fechamento não permanecem disponíveis durante a leitura.

**Proposta:** empilhar campos e ataques nas larguras estreitas; permitir quebra no cabeçalho de personagens; manter cabeçalho e ações do editor acessíveis; levar dados e histórico para antes da administração na ordem mobile. Garantir que a ordem de foco acompanhe a ordem visual. Evidência: `client/src/styles/campaign.css`, especialmente `.campaign-section-heading`, `.sheet-form__grid`, `.sheet-form__skills` e `.sheet-form__attack`.

### 2. A interface oferece edição que o mestre não pode salvar

`CharacterSheetDialog.tsx:111` define edição para dono **ou** mestre. `server/src/characters/routes.ts:296` permite editar somente ao dono. O mestre consegue preencher um formulário e só descobre a restrição no envio.

**Proposta:** alinhar o botão com a regra atual de propriedade e identificar a ficha como consulta para os demais. Qualquer ampliação de permissão é decisão de produto, não ajuste cosmético.

### 3. Excluir é imediato; fechar o formulário descarta trabalho

`CharacterSheetDialog.tsx:265` chama a exclusão diretamente. Já a remoção de membro possui confirmação. O editor fecha por cancelamento/Escape/ação externa sem tratamento de alterações pendentes.

**Proposta:** confirmação com nome do personagem e consequência da exclusão; ação destrutiva secundária, separada do uso cotidiano. Ao fechar uma ficha alterada, oferecer continuar editando ou descartar. Esse cuidado é especialmente relevante num formulário longo.

### 4. O resultado da ficha tem explicação incompleta

`CharacterSheetDialog.tsx:239` monta a decomposição só com os dados mantidos, omitindo `modifier`. O total vem correto do servidor, mas a conta mostrada não o explica. O resultado fica depois de características e descrição; o clique em um atributo pode gerar feedback fora da área visível. Os botões de rolagem também continuam disponíveis durante o envio.

**Proposta:** apresentação compartilhada de dado + bônus = total entre ficha, rolador e histórico; resultado próximo da ação; estado de envio no controle acionado. A API atual aceita vantagem na rolagem vinculada, mas a ficha não oferece a escolha; desvantagem vinculada exige ampliar o contrato, não apenas adicionar um seletor.

### 5. Leitura e edição empilham modais

Ao clicar em Editar, `CharactersSection` mantém a ficha aberta e abre outro diálogo. A inspeção encontrou duas instâncias de `role="dialog"` no DOM. Isso não prova, isoladamente, falha de foco do Radix, mas cria sobreposição e torna voltar/fechar menos claro.

**Proposta:** uma única área de ficha alternando consulta e edição, preservando posição e contexto. Para desktop, explorar painel amplo integrado à mesa; para mobile, apresentação que use melhor a tela disponível.

### 6. Foco dos controles de rolagem fica invisível

O radio do seletor Normal/Vantagem/Desvantagem recebe `opacity: 0`; não existe tratamento de foco no label. O foco global no input transparente não torna a seleção localizável. O upload usa abordagem semelhante. Botões de atributo têm altura de 36 px, abaixo do padrão de conforto de 44 px adotado pelo projeto; isso não significa automaticamente reprovação de tamanho mínimo WCAG.

**Proposta:** indicador de foco no controle visível, distinguindo foco de seleção, e alvos confortáveis para toque. Referência: [WCAG, foco visível](https://www.w3.org/WAI/WCAG22/Understanding/focus-visible.html).

### 7. O campo público convida a escrever segredos

`CharacterFormDialog.tsx:349` usa “História, aparência, segredos” para uma descrição que todos os membros leem. O texto geral informa visibilidade coletiva, mas o rótulo cria uma expectativa conflitante.

**Proposta:** indicar claramente “Descrição pública”. Notas privadas só devem aparecer quando houver suporte de visibilidade e autorização no produto.

## Melhorias de acabamento por componente

| Componente | Situação atual | Evolução proposta |
| --- | --- | --- |
| Login | Card pequeno e muito espaço sem identidade; menciona combate e mundo ainda futuros | Composição compacta com ambientação discreta e arte real de campanha quando disponível; explicação centrada no que já funciona; manter entrada direta e informação de uso do Discord |
| Lista de campanhas | Nome, data de entrada e papel; pouca diferenciação visual | Descrição curta como informação secundária; superfície inteira claramente clicável; hover/foco de superfície; capa opcional em evolução futura, sem inventar atividade ou próxima sessão |
| Cabeçalho | Marca leva à listagem, mas não há retorno explicitamente nomeado | Retorno claro às campanhas, identidade da mesa e papel atual; seletor quando houver várias campanhas, aproveitando padrões do AppShell sem expor módulos futuros |
| Personagens | Mesma aparência de lista de membros; avatar de 40 px; nome e metadados corridos | Retrato de 56–64 px, nome destacado, classe/nível em linha própria, dono discreto e marcação “Seu personagem”; seleção e abertura evidentes |
| Ficha | Modal de 480 px; atributos competem com botões repetidos; HP e CA pequenos | Área mais larga no desktop; resumo com retrato, HP e CA legíveis; modificador como número principal do atributo, valor base secundário; rótulo visível do bônus de resistência |
| Ataques e perícias | Dano e bônus sem explicação visual; perícias viram chips informativos | Nome, bônus de acerto e fórmula de dano em colunas claras; ação “Rolar ataque”; perícias com bônus legível. Torná-las roláveis exige suporte explícito do contrato |
| Dados | Campo de expressão vazio; ícone de reticências; expressão apagada após cada sucesso | Ícone de dado da família existente, atalhos d4/d6/d8/d10/d12/d20, prévia da expressão e repetição da última rolagem; seletor de modo coeso; segredo com estado textual persistente |
| Resultado e feed | Resultado rico no rolador, histórico em texto compacto; número final pouco destacado | Uma linguagem compartilhada: personagem/autor, ação, total em destaque e conta secundária; 1/20 natural rotulados sem presumir sucesso/falha de toda ação |
| Histórico | Lista sem limite visual; até 50 eventos recebidos, em ordem antiga → nova; sem navegação para anteriores | Área de altura controlada no desktop; seguir novos eventos só quando o usuário já acompanha o fim; indicador de novos resultados ao ler o passado. Histórico anterior exige paginação no servidor |
| Membros e convite | Bloco extenso com data de entrada e remoção; convite depois do histórico | Área administrativa compacta e recolhível; membros identificáveis, detalhes sob demanda; convite junto da gestão de participantes, com mais destaque enquanto a mesa está vazia |
| Botões e superfícies | Hover por sublinhado; controles e painéis semelhantes em peso | Hover por mudança sutil de superfície/borda; foco preservado; um primário por contexto; bordas fortes só em controles, superfícies de agrupamento discretas |
| Vazios e erros | CTAs repetidos no cabeçalho e vazio; erro sem recuperação local | Um ponto focal para criar/convidar; mensagens claras, como “Nenhum personagem ainda”; ação de tentar novamente em falhas recuperáveis |

Para personagens, HP/CA na lista exigem ampliar `CharacterSummary` ou rever a consulta: hoje esses valores só vêm na ficha completa. Evitar uma requisição por personagem apenas para ornamentar o resumo. Capa de campanha também não é um campo existente. Barras de vida atual/máxima devem esperar um modelo que represente ambos; hoje há somente `hp`.

No editor de perícias, Constituição gera um grupo com título e nenhum item. Omitir grupos vazios. As validações do servidor deveriam aparecer junto do campo correspondente; hoje diversos erros ficam no fim do formulário.

## Ordem sugerida

1. **Confiabilidade:** responsividade, permissão de editar, confirmação de exclusão, alterações não salvas, decomposição e foco visível.
2. **Fluxo de jogo:** consulta ampla da ficha, retorno imediato da rolagem, dados/histórico acessíveis e administração compacta.
3. **Identidade:** retratos, hierarquia de atributos e resultados, campanhas reconhecíveis, acabamento de botões e superfícies.
4. **Extensões de produto:** perícias roláveis, modos vinculados completos, histórico paginado e capas persistidas.

Critérios de aceite: nenhum corte em 320/390/768/1280 px; rolagem e resposta próximas; ação de salvar acessível com teclado virtual; saída de edição previsível; nenhuma ação oferecida que o papel não possa concluir; todas as contas explicam o total; foco visível em todos os controles; temas claro/escuro e movimento reduzido preservados. Criar stories dos componentes reais da fase 1, incluindo ficha longa, nome extenso, muitos ataques, vazio, erro e reconexão.

## Evidências e limites

Código de telas, componentes, tokens, API e checklist inspecionado. Capturas locais de login, lista, campanha nos dois temas, ficha e editor; medições em quatro larguras. Dados de exemplo em banco separado em `test-results/ui-audit/audit.db`; processo de inspeção encerrado ao terminar. Capturas e medidas em `test-results/ui-audit/` (artefatos locais, fora do versionamento).

`npm run build` aprovado. Capturas e medições repetidas com o build atualizado, com os mesmos resultados e sem erros de página capturados. O Vite sinalizou um chunk JavaScript de 609,85 kB (192,95 kB gzip); considerar carregamento sob demanda da edição de ficha se medições de uso justificarem. Isso não comprova problema de Core Web Vitals.

Não foram certificados OAuth real, Core Web Vitals, contraste de todos os estados nem todos os fluxos de erro. Context7 MCP não está disponível nesta sessão; a captura segue os scripts locais e a [documentação oficial do Playwright](https://playwright.dev/docs/screenshots).
