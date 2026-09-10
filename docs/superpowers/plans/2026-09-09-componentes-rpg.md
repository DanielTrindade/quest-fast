# Componentes RPG: plano de implementação

**Objetivo:** dar acabamento próprio aos componentes compartilhados e demonstrá-los no Storybook.

**Arquitetura:** manter tokens semânticos, Radix e APIs existentes; acrescentar variantes opcionais e um componente de atributo. Estilos do produto compartilhados com as stories. Execução nesta sessão, já autorizada.

**Stack:** React, TypeScript, CSS/Tailwind, Phosphor, Motion e Storybook instalados.

## Restrições globais

Português e Unicode preservados. Sem dependências novas. Temas existentes preservados. Sem alterações em permissões, rotas ou modelo de dados. Variação 4, movimento 3, densidade 5. Context7 indisponível; APIs conferidas localmente e em documentação oficial.

## Passos

- [x] Acabamento compartilhado em `styles/index.css` e `styles/components.css`: relevo dos botões, campos rebaixados, molduras de painéis/diálogos, insígnias e estados de foco.
- [x] `Avatar`: `variant?: 'user' | 'character'`, `size?: 'sm' | 'md' | 'lg'`; skeleton preserva dimensões. `Surface`: acrescentar variante `sheet`. `EmptyState`: ícone contextual opcional. `DiceResult`: identificar lados, separar total e decomposição, manter semântica e movimento reduzido.
- [x] Criar `AbilityCard({ label, abbreviation, score, modifier, saveBonus?, proficient?, onCheck?, onSave?, disabled? })`, sem regras de cálculo internas. Reutilizar em `CharacterSheetDialog` e no laboratório; usar tokens de personagem nas fichas.
- [x] Stories de variantes e composição interativa com atributos, retrato e resultado de exemplo identificado; conferir controle desabilitado, modo leitura, números negativos e nome longo.
- [x] Executar `npm run lint`, `npm run build` e `npm run test:design`. Revisar capturas da composição, dados, diálogo e campos nos dois temas e no mobile; corrigir falhas antes de concluir.
- [x] Documentar regras de geometria, uso das variantes, fontes das APIs e resultados em `docs/design-system.md`.
