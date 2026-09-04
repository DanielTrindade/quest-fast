## 1. Spike (descartável) — fechar as Open Questions do design

Não escrever código de produção antes deste grupo terminar. A saída é uma decisão registrada no `design.md`, não código mantido.

- [ ] 1.1 Protótipo de fog: máscara bitmap versus polígonos revelados — medir tamanho do payload e custo de compor e apagar áreas
- [ ] 1.2 Protótipo de arrasto de token: medir frequência de eventos, testar throttle e resolução de conflito
- [ ] 1.3 Avaliar biblioteca de canvas versus canvas 2D direto para pan, zoom e hit-testing
- [ ] 1.4 Registrar as decisões no `design.md` e remover a seção Open Questions

## 2. Cenas e mapa

- [ ] 2.1 Tabela `Scene` e CRUD restrito ao mestre
- [ ] 2.2 Upload de mapa reutilizando `Asset`, com limites revistos para imagens grandes
- [ ] 2.3 Cena ativa da campanha e regra de acesso do jogador apenas à cena ativa
- [ ] 2.4 Canvas no cliente: renderizar o mapa com pan e zoom
- [ ] 2.5 Grid configurável (ativar/desativar e tamanho de célula)

## 3. Tokens

- [ ] 3.1 Tabela `Token` (origem personagem ou statblock, posição, flag de oculto)
- [ ] 3.2 Mestre adiciona e remove tokens a partir de personagens e do bestiário
- [ ] 3.3 Renderização e arrasto de tokens no canvas
- [ ] 3.4 Validação de posse no servidor a cada movimento
- [ ] 3.5 Evento `token.moved` no canal em tempo real existente
- [ ] 3.6 Tokens ocultos filtrados no servidor, fora do payload dos jogadores
- [ ] 3.7 Testes de integração: jogador não move token alheio; payload do jogador não contém token oculto

## 4. Fog of war

- [ ] 4.1 Persistir o estado de fog no formato decidido no spike
- [ ] 4.2 Mestre revela e reoculta áreas
- [ ] 4.3 Composição do fog sobre o mapa no canvas do jogador
- [ ] 4.4 Evento `fog.updated` no canal em tempo real
- [ ] 4.5 Teste de integração: jogador não consegue alterar o fog

## 5. Fechamento

- [ ] 5.1 Recarregar estado completo da cena na reconexão
- [ ] 5.2 Estender o seed da campanha de exemplo com cena, mapa e tokens
- [ ] 5.3 Atualizar o README retirando o Owlbear Rodeo do fluxo da mesa
- [ ] 5.4 `openspec validate vtt-battlefield` e `openspec status`
