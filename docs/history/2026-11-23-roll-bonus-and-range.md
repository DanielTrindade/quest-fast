# Modificador situacional e alcance dos ataques

Spec das melhorias [#133](https://github.com/DanielTrindade/quest-fast/issues/133)
e [#134](https://github.com/DanielTrindade/quest-fast/issues/134), pedidas
pela mesa depois da sessão de 19 de novembro. Entram antes da fase 3 (mundo).
Áreas (cone, esfera, linha, cubo, parede) não são alcance: ficam com a
[#113](https://github.com/DanielTrindade/quest-fast/issues/113).

## #134 — alcance no ataque

- Campo opcional `range` em cada linha de "Armas e truques de dano", na ficha
  e no bestiário. Texto curto, com o mesmo limite de `Spell.range`
  ("1,5 m", "18 m", "6/18 m").
- Aparece no editor da ficha e no do bestiário (`AttackListEditor`), na linha
  do ataque em Mesa/Ações (`AttackCard`) e no evento do feed, gravado no
  momento do ataque. Editar a ficha depois não muda o histórico.
- Cliente antigo que não manda o campo grava vazio; linha antiga lê vazio
  (`storedAttack`). A cópia do bestiário para o encontro leva o alcance.
- **Sem migração:** os ataques são JSON em `characters`, `statblocks` e
  `combatants`, então o schema físico não muda (a issue previa migração).
- A importação do PDF deixa o campo vazio: a ficha oficial não tem esse dado.

### O alcance no mapa

- Na aba Ações, cada linha com alcance ganha **"Ver alcance"** (alterna). Com
  ele ligado, o mapa desenha em volta do token de quem ataca a área do
  alcance normal e, mais apagada, a do longo. Um alcance por vez: ligar outro,
  trocar de combatente, atacar ou sair da aba Ações apaga o desenho.
- A área é contada em casas de 1,5 m com diagonal valendo uma casa, a mesma
  regra do deslocamento, para o que se vê no mapa bater com o que a mesa
  conta. Desenho distinto da área de movimento (só contorno, outro tom),
  decidido no Storybook e registrado em `docs/design-system.md`.
- O texto vira metros por uma regra pura em `shared/` (`parseRange`, com
  teste): "1,5 m", "18 m", "6/18 m", "9 metros". O que não é número
  ("Toque", "Pessoal", "Visão") só aparece como texto, sem botão.
- Só mostra: não recusa nem marca alvo fora do alcance. Quem ataca sem token
  na cena aberta não tem o botão.
- Fora: recusar ou avisar alvo fora do alcance, linha de visão e cobertura
  (ficam com a #113).

## #133 — modificador situacional

Bênção (+1d4 no ataque e na salvaguarda), Perdição (−1d4), Marca do Caçador
(+1d6 no dano), um +2 qualquer que o mestre conceda.

### O que o jogador vê

- Uma barra **Modificadores** com dois campos: **No d20** (vale para o
  acerto, os testes, as salvaguardas e a iniciativa) e **No dano**. Aceita
  dado e número, com sinal: `+1d4`, `-1d4`, `+2`, `1d4-1`. Vazio é nada.
- Fica no topo da aba Ações da Mesa e na área de rolagem da ficha aberta na
  Mesa, com o mesmo valor nas duas (um estado por campanha, no navegador).
- O valor **fica preenchido** até a pessoa limpar (a Bênção dura vários
  turnos); enquanto houver um modificador, a barra mostra um selo "ativo" e o
  botão de limpar, e cada botão de rolagem afetado diz que soma.
- O mestre tem a mesma barra, que vale para o combatente que ele escolheu.

### Regras (em `shared/`, com teste)

- `parseRollBonus` lê uma soma de termos com sinal, inclusive dado negativo.
  Dado negativo **só no modificador**: a expressão livre da aba Dados não
  muda. Os limites `DICE_*` valem para a rolagem inteira (base + modificador).
- O modificador é rolado à parte e somado: o feed mostra os dados dele
  separados dos da rolagem. Vantagem e desvantagem continuam só no d20
  principal; o natural (1 ou 20) e o crítico vêm só dele.
- O total de um teste pode ficar negativo; o dano continua com piso 0.
- No crítico, os dados do modificador de dano também dobram (regra do 5e
  para todo dado de dano extra); o número fixo não.
- O cliente manda o texto do modificador, nunca o resultado. O servidor
  valida antes de gastar qualquer coisa do turno ou gravar o evento.

### Onde vale

- **Sim:** rolagens da ficha (ataque, ataque mágico, teste, perícia,
  salvaguarda, iniciativa), ataque no combate (acerto e dano), salvaguarda de
  concentração, iniciativa no combate e o "Rolar dano" depois de um ataque
  sem alvo (o dano usa o modificador de quando é rolado).
- **Não, nesta entrega:** teste contra a morte (o resultado depende do d20
  natural); salvaguardas que o servidor rola pelos alvos de uma área (o bônus
  é do alvo, não de quem ataca: fica com a #112); a aba Dados, que já aceita
  qualquer expressão.

### Visibilidade

- O modificador vai no evento como mais uma parcela (`bonus`, com expressão,
  dados e total). Na cópia redigida de um ataque de monstro, ele some junto
  com o resto dos números, como hoje.

## Decisões (aprovadas em 23 de novembro de 2026)

1. **Uma barra com dois campos (d20 e dano)** que vale para toda rolagem,
   em vez de um campo em cada botão. É como a mesa pensa ("estou abençoado"),
   e cobre ataque e salvaguarda com a mesma Bênção. Alternativa: campos de
   acerto e dano dentro de cada ataque, e um em cada teste.
2. **O valor fica até ser limpo**, guardado só no navegador, com selo de
   ativo. Alternativa: some depois de cada rolagem. Guardar no servidor, com
   duração, é a #112.
3. **Dado negativo só no modificador**, total do teste pode ser negativo,
   dano com piso 0, dado do modificador de dano dobra no crítico.
4. **Fora desta entrega:** teste contra a morte e as salvaguardas que o
   servidor rola pelos alvos.
5. **Alcance guardado como texto, sem migração**, visível a todos no feed
   (o nome do ataque do monstro já é); o mapa lê os metros dele.
6. **O alcance no mapa em casas** (diagonal vale uma), como o deslocamento,
   e não em círculo, e aparece só quando quem ataca pede ("Ver alcance").

## PRs

1. `feat/alcance-ataque` — #134 no dado: tipo e validação em `shared/`, editor
   e `AttackCard` com stories, evento do feed, testes. Independente.
2. `feat/alcance-no-mapa` — #134 no mapa: `parseRange`, o desenho no
   `MapCanvas` (story e `test:design`), "Ver alcance" na aba Ações e o estado
   que a aba e o mapa dividem na Mesa. Empilhado no PR 1.
3. `feat/modificador-rolagem-servidor` — #133 no `shared/` e no servidor:
   `parseRollBonus`, rolagem com parcela, todas as rotas da lista acima,
   redação, testes de validação e de RBAC (jogador não soma modificador na
   rolagem de outro).
4. `feat/modificador-rolagem-tela` — #133 na tela: a barra no Storybook
   (`test:design`), ligada à aba Ações e à ficha, e o feed mostrando a
   parcela. Empilhado no PR 3.
