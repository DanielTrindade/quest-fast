# Plano: melhorias de UI/UX das etapas 0 e 1

Origem: `docs/ui-ux-etapas-0-1.md`. Executa os **problemas prioritários 1–7** e as linhas da
tabela de acabamento que não dependem de mudança de contrato.

Já resolvido na etapa anterior (`2026-09-09-componentes-rpg.md`), não repetir: decomposição com
modificador, foco visível no segmentado e no upload, altura mínima de 44 px nos botões, retratos
de personagem, hierarquia de atributos e resultados, hover por superfície.

**Fora de escopo** (item 4 da ordem sugerida — exige contrato/servidor e decisão de produto):
perícias roláveis, vantagem/desvantagem em rolagem vinculada, histórico paginado, capa de campanha
persistida, HP/CA no resumo da lista.

## Tarefas

- [x] **1. Permissão de edição alinhada à API.** `CharacterSheetDialog`: `canEdit` passa a ser só o
      dono (`server/src/characters/routes.ts:296` permite apenas o dono no PATCH). Para os demais, a
      ficha se identifica como consulta. `canDelete` continua dono ou mestre, como no DELETE.
      Verificação: mestre não vê "Editar" na ficha de outro; dono vê.

- [x] **2. Exclusão com confirmação.** Passo de confirmação nomeando o personagem e dizendo a
      consequência, no mesmo padrão de `RemoveMember`. Verificação: excluir exige dois passos;
      cancelar não chama a API.

- [x] **3. Saída de edição previsível.** `CharacterFormDialog` compara o estado atual com o inicial
      e, havendo alteração, oferece continuar editando ou descartar ao fechar por Cancelar, Escape
      ou clique fora. Verificação: formulário intocado fecha direto; alterado pede confirmação.

- [x] **4. Uma única área de ficha.** `CharactersSection` alterna consulta e edição no mesmo
      diálogo, sem empilhar `role="dialog"`. Verificação: abrir ficha → Editar → só um diálogo no
      DOM; voltar retorna à consulta.

- [x] **5. Resultado junto da ação.** Na ficha, o resultado da rolagem sobe para logo abaixo dos
      atributos/ataques, com `aria-live`. Os botões de ataque recebem estado de envio como os de
      atributo. Verificação: rolar por atributo e por ataque mostra o resultado sem rolagem de tela;
      controles ficam inertes durante o envio.

- [x] **6. Mobile sem corte e com o jogo primeiro.** Em 320/390 px: cabeçalhos quebram, o roster não
      força colunas, o editor mantém cabeçalho e ações alcançáveis, e dados/histórico vêm antes da
      administração. Verificação: nenhum corte em 320/390/768/1280 px; ordem de foco acompanha a
      ordem visual.

- [x] **7. Administração compacta.** Membros e convite passam a uma área recolhível, com destaque
      maior enquanto a mesa está vazia. Verificação: recolher/expandir por teclado; estado inicial
      expandido quando só há o mestre.

- [x] **8. Acabamento restante.** Rótulo "Descrição pública" no editor; grupos de perícia vazios
      omitidos; descrição curta e superfície inteira clicável na lista de campanhas; retorno
      nomeado às campanhas no cabeçalho; "tentar novamente" nos erros recuperáveis.

- [x] **9. Verificação.** `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`,
      `npm run test:design`. Stories novas dos estados que a auditoria pede (ficha longa, nome
      extenso, muitos ataques, consulta sem permissão, confirmação de descarte).
