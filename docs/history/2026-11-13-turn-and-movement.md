# Turno no mapa: ações e deslocamento

Spec aprovada em 2026-11-13. Muda o escopo do VTT: a [spec da fase 4](2026-11-12-vtt-battlefield-phase4.md) deixava medição de fora.

## Objetivo

Em combate, o turno passa a ter limites que o servidor confere: quantas ações,
ataques e quanto deslocamento cada combatente ainda tem. No mapa, clicar num
token mostra até onde ele chega, e o movimento só é gasto quando quem move
confirma a posição.

## Fora de escopo

- Paredes, obstáculos, terreno difícil e caminho em volta de algo: a distância
  é a do grid, em linha reta, sem desvio.
- Deslocamentos especiais (voo, natação, escalada): conta o deslocamento a pé.
- Ataque de oportunidade automático, alcance de armas, áreas de magia.
- Recursos por descanso (Surto de Ação, Fúria): o mestre concede uma ação
  extra quando a mesa disser.

## Regras (D&D 2024, casa de 1,5 m)

### Distância

- Cada casa custa 1,5 m, também na diagonal (regra de 2024). A distância entre
  duas posições é o maior entre o número de colunas e de linhas: um movimento
  de 3 casas para o lado e 2 para cima custa 3 casas, 4,5 m.
- O custo vai da posição salva do token até a posição confirmada; um turno pode
  ter vários movimentos, que se somam.
- O alcance cobre **toda** a área até onde o deslocamento chega, não só as
  casas vizinhas: cada casa a até `restante ÷ 1,5` casas do token, em qualquer
  direção, diagonais incluídas, cortada na borda do mapa. Com 9 m, são 6 casas
  para cada lado (um bloco de 13 × 13 casas). No início do turno, o restante é
  o deslocamento completo; depois de mover, a área encolhe para o que sobra.

### Deslocamento de cada um

- **Personagem:** o deslocamento da ficha (metros).
- **Criatura do bestiário:** o primeiro número em metros do texto de
  deslocamento ("9 m, voo 18 m" → 9 m), copiado para o combatente; o mestre
  pode corrigir.
- **Combatente manual:** 9 m por padrão, editável pelo mestre.
- **Condições:** Agarrado e Contido zeram o deslocamento; cada nível de
  Exaustão tira 1,5 m. Caído fica fora (sem regra de rastejar).
- **Disparada:** gasta a ação e soma o deslocamento outra vez no turno.

### Ações

- Por turno: 1 ação e 1 ação bônus. Por rodada: 1 reação, que volta no início
  do turno do próprio combatente.
- **Atacar:** o primeiro ataque gasta a ação e libera os ataques do Ataque
  Extra. Rolar ataque pela ficha ou pelo combate desconta um.
- **Ataques por ação de um personagem**, pela classe e nível da ficha:
  - Guerreiro: 2 no 5º, 3 no 11º, 4 no 20º.
  - Bárbaro, Monge, Paladino, Patrulheiro: 2 no 5º.
  - Bardo (Colégio da Bravura ou das Espadas) e Mago (Cantor da Lâmina): 2 no 6º.
  - A ficha ganha o campo "Ataques por ação" para sobrepor o cálculo (talentos,
    invocações do Bruxo, homebrew, multiclasse).
- **Criatura:** "Ataques por ação" no combatente (Ataques Múltiplos), 1 por
  padrão; o mestre ajusta, e o bestiário guarda o valor para a próxima vez.
- Outras ações (magia, Esquivar, Desengajar, Ajudar…): botão "Usar ação",
  "Usar ação bônus", "Usar reação".
- O mestre pode devolver uma ação gasta e conceder uma ação extra (Surto de
  Ação, Velocidade).

### Quem faz o quê

| | Mestre | Jogador |
| --- | --- | --- |
| Gastar ação, bônus, reação, Disparada | qualquer combatente | o próprio personagem, na vez dele (reação a qualquer momento) |
| Devolver ou conceder ação | sim | 403 |
| Mover token em combate | qualquer um; o do combatente da vez gasta, com "Mover sem gastar" | só o próprio, só na vez dele, até o restante |
| Ver o alcance | de todos | dos personagens; o de criatura nunca chega ao jogador |
| Editar deslocamento e ataques por ação do combatente | sim | 403 |

Fora de combate, nada muda: mover é livre como hoje e o alcance mostra o
deslocamento cheio. Combatente sem token no mapa só usa a parte das ações.

## Confirmar a posição

Em combate, quem move o token do combatente da vez não grava ao soltar:

1. O arrasto mostra o caminho em linha reta, as casas e os metros
   ("3 casas · 4,5 m"), em vermelho além do restante.
2. Ao soltar, o token fica na posição pendente, ainda travado por quem move (a
   mesa vê ele ali, com "movendo"), e aparecem "Confirmar movimento" e
   "Cancelar". Pelo teclado, as setas também deixam pendente.
3. Confirmar grava e desconta; o servidor recalcula o custo e recusa (422) o
   que passar do restante. Cancelar devolve o token.

## Dados

- `combatants`: `speed` (real, metros), `attacks_per_action` (int) e o estado
  do turno: `action_used`, `bonus_action_used`, `reaction_used`,
  `attacks_left`, `extra_actions`, `dashes`, `movement_used` (metros). O custo
  de cada movimento vai da posição salva à confirmada, então o turno não
  guarda onde começou.
- `characters`: `attacks_per_action` (int, nulo = pela classe).
- `statblocks`: `attacks_per_action` (int, padrão 1).
- `CombatantView.turn`: o orçamento do turno (só para quem pode vê-lo: o
  mestre e o dono do personagem).
- `TokenView.reach`: `{ speed, left }` em metros, só quando o leitor pode ver o
  alcance desse token; nulo para o jogador num token de criatura.

## Testes

- `shared/`: distância de Chebyshev, área alcançável, custo de movimento,
  ataques por classe e nível, deslocamento do texto do bestiário, efeito das
  condições, orçamento do turno (gastar, devolver, Disparada, virar o turno).
- Servidor: jogador não move fora da vez, não passa do restante, não gasta
  ação de outro, não devolve ação, não recebe `reach` de criatura; a vez nova
  zera o turno; ataque desconta.
- Storybook: painel do turno, alcance no mapa, barra de confirmar,
  "Ataques por ação" na ficha e no combatente.

## Entrega

Quatro seções, cada uma num PR empilhado:

1. **Regras e contrato:** `shared/src/turn.ts` com teste; colunas e migração;
   `CombatantView.turn`, `TokenView.reach`, "Ataques por ação" na ficha e no
   bestiário.
2. **Servidor:** a vez nova zera o turno; ataque desconta; rotas de gastar,
   devolver e conceder; posição em combate conferida e descontada; `reach`.
3. **Componentes no Storybook:** painel do turno, alcance, caminho e custo no
   arrasto, barra de confirmar, campos novos.
4. **Telas:** a Mesa ligada, conferência no app, documentação.
