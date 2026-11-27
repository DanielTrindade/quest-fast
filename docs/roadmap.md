# Roadmap

O que já existe, o que vem a seguir e o que está em aberto. Atualize este
arquivo no PR que entrega ou muda o escopo de uma etapa.

Atualizado em 2026-11-27.

## Entregue

- **Design system:** tokens, temas claro e escuro, componentes base e a
  auditoria de `npm run test:design`.
  ([histórico](history/2026-09-04-design-system-foundation.md))
- **Fase 0 — mesa:** login pelo Discord, campanhas, código de convite,
  entrada, membros, saída e remoção; Docker de processo único.
- **Fase 1 — personagens, dados e feed:** ficha 5e, upload de avatar,
  rolagem livre e pela ficha, vantagem e desvantagem, rolagem secreta do
  mestre, feed ao vivo por WebSocket com reconexão.
  ([histórico](history/2026-09-04-mvp-campaign-management.md))
- **Qualidade de vida da sessão:** atalhos de dados, repetir rolagem,
  perícias roláveis, feed paginado com acompanhamento ao vivo, navegação por
  seção. ([histórico](history/2026-09-10-session-qol-foundations.md))
- **Ficha oficial (D&D 2024):** identidade, combate, especialização,
  conjuração, inventário, personalidade e estado de sessão editável sem abrir
  o editor. ([histórico](history/2026-09-13-official-character-sheet.md))
- **Importação da ficha em PDF:** na criação de personagem, o PDF preenchido
  da ficha oficial em português pré-preenche o editor. A leitura acontece no
  navegador, nada é salvo antes da revisão, e o que não dá para ler com
  segurança vira aviso para o jogador conferir. Só esse modelo de PDF é
  reconhecido. O mestre usa o mesmo PDF para criar uma criatura do bestiário
  a partir de um NPC.
- **Bônus de ataque ou CD:** cada linha de "Armas e truques de dano" é uma
  rolagem de ataque (bônus contra a CA) ou um teste de resistência do alvo
  (CD e atributo). Pela ficha, o ataque rola o acerto e oferece o dano no
  feed; o de resistência rola só o dano.
- **Convite por link:** o mestre compartilha `/invite/<código>` (cópia ou
  WhatsApp) e quem abre vê uma prévia pública (nome da mesa, mestre e número
  de jogadores), com cartão de imagem para a prévia do WhatsApp e do Discord.
  Sem sessão, o login devolve à página do convite e a entrada é automática.
  O mestre troca o link (o antigo para de valer) e, ao remover um jogador, ele
  fica bloqueado até ser liberado na lista de bloqueados.

### Fase 2 — combate e bestiário

O mestre roda um combate inteiro sem redigitar monstros e sem planilha ao
lado; os jogadores acompanham e agem no próprio combatente, inclusive no
celular. Spec aprovada em
[`history/2026-10-22-combat-and-bestiary.md`](history/2026-10-22-combat-and-bestiary.md),
que substitui a seção `combat-tracker` do MVP. Quatro entregas, cada uma
usável na mesa:

1. **Base e bestiário — entregue.** Regras puras do combate em `shared/`,
   schema de encontros e combatentes, e o bestiário da campanha (statblock com
   atributos, fórmula de PV e ataques), só para o mestre, na seção "Combate".
   Uma criatura nova pode vir de um NPC escrito na ficha oficial em PDF, pelo
   mesmo leitor da importação de personagem.
2. **Encontro e turnos — entregue.** O mestre prepara encontros invisíveis aos
   jogadores (personagens, cópias do bestiário com PV médio ou rolado e
   combatentes manuais), rola ou atribui a iniciativa e conduz turnos e rounds;
   cada jogador rola a própria iniciativa uma vez e encerra o próprio turno.
   Reforços, empates (Antes/Depois), combatentes escondidos e encerramento com
   resumo no feed. Tudo chega ao vivo por `combat.updated`, projetado por papel:
   o jogador vê aliados por inteiro e monstros só pela faixa de saúde.
3. **PV e condições — entregue.** Dano, cura e PV temporário por delta, com o
   PV mudando na tela antes da resposta; o jogador vê de um monstro só a faixa
   de saúde. As 15 condições com nível de exaustão e duração, que expira no fim
   do turno. Concentração com lembrete da salvaguarda de Constituição e teste
   contra a morte rolado no servidor, uma vez por round na vez do jogador. O
   feed conta dano, cura, derrota, condições e testes contra a morte, redigido
   por papel no servidor. Condições e concentração também na ficha, fora do
   combate. Spec e diferenças em
   [`history/2026-11-06-combat-hp-conditions.md`](history/2026-11-06-combat-hp-conditions.md).
4. **Ataques e acabamento — entregue.** O ataque escolhe um alvo entre os
   combatentes visíveis; o servidor compara com a CA (empate acerta, 20 natural
   sempre acerta, 1 natural sempre erra) e, num acerto, rola o dano com os
   dados dobrados no crítico. O dano fica pendente no alvo até o mestre
   aplicar (como rolado, ajustado ou pela metade numa salvaguarda) ou
   descartar. Sem alvo, quem atacou rola o dano depois, pelo feed. O jogador
   nunca recebe a CA de um monstro nem os números do ataque dele: só acerto,
   crítico e dano. Seed com bestiário e o encontro "Emboscada na estrada";
   `verify:app` e `verify:group` percorrem um combate inteiro. Spec e
   diferenças em
   [`history/2026-11-11-combat-attacks-polish.md`](history/2026-11-11-combat-attacks-polish.md).

### Fase 4 — campo de batalha (VTT)

Cenas com mapa, grid, tokens e fog of war em tempo real, substituindo o
Owlbear Rodeo. É o item de maior risco técnico.

**Spike — entregue (2026-11-12).** Medido com os mapas reais da mesa, fechou
as questões abertas: canvas 2D direto; fog como multipolígono calculado no
servidor e guardado numa coluna da `Scene`; token com trava no início do
arrasto, envio a 30 Hz só pelo socket, interpolação em quem assiste e gravação
ao soltar; mapas normalizados no servidor com `sharp` (até 4096 px, entrada
até 25 MB). Números e alternativas em
[`history/2026-11-12-vtt-spike.md`](history/2026-11-12-vtt-spike.md).

A garantia de segurança do fog é sobre **tokens ocultos**: eles nunca chegam
ao cliente do jogador. A imagem do mapa, essa sim, é baixada inteira.

**Entregue (2026-11-23).** Spec aprovada em
[`history/2026-11-12-vtt-battlefield-phase4.md`](history/2026-11-12-vtt-battlefield-phase4.md),
que detalha os requisitos de
[`history/2026-09-04-vtt-battlefield.md`](history/2026-09-04-vtt-battlefield.md)
com as decisões do spike. Cinco entregas, cada uma usável na mesa:

1. **Cena e mapa — entregue.** O mestre cria cenas no Preparo, envia o mapa
   (normalizado no servidor com `sharp`, com progresso do envio), confere a
   cena num diálogo, abre uma para a mesa e ajusta o grid; os jogadores veem a
   cena aberta no centro da Mesa, com pan e zoom, inclusive no celular, e a
   miniatura na Visão geral. Fechar o mapa o tira de todas as telas na hora.
   Regras do grid e limites do mapa em `shared/`, rotas com RBAC,
   `scene.updated`/`scene.closed` no socket e os componentes no Storybook
   (`MapCanvas`, `SceneList`, `SceneForm`, `GridSettings` e `OpenScene`).
2. **Tokens — entregue.** O mestre põe no mapa personagens, combatentes de um
   encontro (um a um ou todos em fileira), criaturas do bestiário e tokens
   livres, no centro da área que está vendo; esconde, revela e remove pela
   lista ao lado do mapa (abaixo no celular). O tamanho vem da criatura. O
   arrasto pega a trava no servidor, mostra o token se movendo ao vivo para a
   mesa (30 Hz pelo socket, com interpolação em quem assiste) e grava ao
   soltar; se outra pessoa já está movendo, o token volta e o aviso diz quem.
   O jogador move só o próprio personagem, pelo mapa ou pelas setas da lista,
   e nunca recebe um token oculto.
3. **Turno no mapa — entregue.** Em combate, o servidor conta a ação, a ação
   bônus, a reação e os ataques do Ataque Extra (pela classe e nível, ou pelo
   valor da ficha) e o deslocamento em casas de 1,5 m, diagonais inclusive;
   ataque fora da vez gasta a reação. Ao lado do mapa, o painel do turno
   gasta e mostra o que resta, e o mestre devolve, concede ação e ajusta o
   deslocamento e os ataques por ação da criatura só naquele encontro (o
   valor padrão de Ataques Múltiplos fica no bestiário, editado no Preparo;
   #108). Clicar num token mostra toda a área que ele
   ainda alcança; o arrasto mostra o caminho e o custo, e o movimento só é
   gasto quando quem move confirma a posição (pelo mapa ou pelas setas). O
   jogador só move o próprio token na vez dele. Entrou antes do fog e mudou o
   escopo do VTT, que deixava medição de fora.
   ([spec](history/2026-11-13-turn-and-movement.md))
   Depois, o token virou peça de mesa (silhueta pela origem, mola ao soltar)
   e o arrasto ganhou alcance em ladrilhos, caminho casa a casa, custo fora
   do canvas, corte no limite para o jogador e borda elástica, sem regra
   nova no servidor. Colisão, paredes e terreno difícil ficam para depois
   ([design system](design-system.md#alcance-caminho-e-limites-18-de-novembro-de-2026)).
4. **Fog of war — entregue.** Na Mesa, o mestre abre "Fog of war", liga o fog
   (a cena começa toda oculta) e revela ou oculta com retângulo, que encaixa
   no grid, ou polígono clique a clique, além de revelar e ocultar tudo; vê o
   fog translúcido, com os tokens que a mesa não vê esmaecidos e marcados
   "Na área oculta" na lista, e pode "ver como jogador". O jogador vê o fog
   opaco e não recebe monstro nem token livre na área oculta, em nenhum
   payload; revelar traz o monstro na hora, pelo socket. Personagens aparecem
   sempre. Regra em `shared/` e estado calculado no servidor. O fog é só do
   mapa: o combate continua seguindo o "escondido no encontro".
   ([spec](history/2026-11-19-fog-of-war.md))
   Diferenças da spec: na troca de mapa, o fog acompanha os tokens (cada eixo
   pela própria razão), não o grid, que segue só a largura; e uma forma que
   não fecha em coordenadas inteiras é recusada em vez de gravada.
5. **Acabamento — entregue.** Spec em
   [`history/2026-11-23-vtt-finishing.md`](history/2026-11-23-vtt-finishing.md),
   em três PRs independentes. Token ligado ao combate (o token livre do
   bestiário já entra no combate pela #111): o token da vez ganha anel e
   entalhe, e cada combatente um arco com a saúde que resta, tirados do
   encontro que o cliente já recebe. Na queda da conexão, o arrasto em curso
   ou o movimento esperando confirmação é desfeito com um aviso (o servidor já
   soltou a trava) e os arrastos de outras pessoas param onde a cena diz. Um
   toque que não pega o token por um motivo passageiro (último movimento ainda
   salvando, combate ainda carregando) avisa em vez de virar pan em silêncio
   (#109). Diferença da spec: sem story da queda, porque nada muda nos
   componentes; a lógica tem teste em `client/test`. O `db:seed` abre para a
   mesa a cena "Estrada da emboscada" (mapa versionado em
   `db/src/seed-assets/`, já no formato que o servidor grava, sem `sharp` no
   `db`), com o lobo na mata sob o fog; `verify:app` confere o mapa na Mesa e
   `verify:group`, o arrasto ao vivo, o fog que esconde e revela o lobo e a
   vez no token acompanhando o turno. Diferenças da spec: quem fica sob o fog
   é o lobo, não um goblin, porque os goblins são os alvos do combate do
   `verify:group`; e o `verify:group` voltou a passar no combate, que já não
   cabia no orçamento do turno (dois ataques seguidos do mesmo goblin) nem na
   saúde dos monstros aberta à mesa pela #111.

## Próximas etapas

Em ordem. Com o mapa entregue (fase 4), o Owlbear saiu da mesa; NPCs, locais
e diários continuam no Kanka até a fase 3.

### Ajustes da primeira sessão

A primeira sessão real com o MVP (2026-11-13) levantou ajustes que entram
antes do fog of war: [#110](https://github.com/DanielTrindade/quest-fast/issues/110)
e depois [#111](https://github.com/DanielTrindade/quest-fast/issues/111). O
resto do que a mesa pediu ficou em issues próprias: efeitos temporários
([#112](https://github.com/DanielTrindade/quest-fast/issues/112)), gabaritos
de área depois do fog ([#113](https://github.com/DanielTrindade/quest-fast/issues/113))
e invocações ([#114](https://github.com/DanielTrindade/quest-fast/issues/114)).
Spec da #110 em
[`history/2026-11-16-first-session-fixes.md`](history/2026-11-16-first-session-fixes.md),
em quatro PRs independentes:

1. **Salvaguarda sem dano — entregue.** Uma linha de salvaguarda pode ficar
   sem dano (Graxa, Fogo das Fadas): usá-la não rola nada, o feed mostra a CD
   e o alvo recebe um lembrete para rolar, que quem age sobre ele marca como
   resolvido. O PDF importado aceita a linha sem dano.
2. **Espaços de magia e conjuração — entregue.** A aba Ações mostra os espaços
   (ajuste à mão) e, em cada magia de 1º círculo ou mais, "Conjurar", que
   confirma o círculo ou o ritual. O servidor gasta o espaço, encerra a
   concentração anterior e marca a nova, e o feed registra a magia. Só o dono
   do personagem conjura.
3. **Imagem no bestiário e token caído ou derrotado — entregue.** O mestre
   envia a imagem da criatura, que os tokens dela passam a mostrar. No mapa, o
   personagem a 0 PV aparece caído (anel de perigo, apagado) e a criatura a 0
   PV, derrotada (cinza, com um X, por baixo dos vivos). A lista de tokens mostra
   quem caiu, e o resumo acessível do mapa conta quantos estão em cada estado.
4. **Grid e tamanho do token — entregue.** O mestre ajusta a opacidade das
   linhas por cena (de 0%, linhas escondidas com o grid ainda valendo, a
   100%), e a cena abre mostrando cerca de 15 casas na largura, com os tokens
   no tamanho da mesa; "Enquadrar o mapa" continua mostrando o mapa inteiro.
   Diferenças da spec: o desenho já pintava o token até a borda da casa, então
   o que mudou foi só a abertura da cena; a barra é o controle deslizante
   nativo, sem a dependência `@radix-ui/react-slider`.

Spec da #111 (ações e alvos) em
[`history/2026-11-18-actions-and-targets.md`](history/2026-11-18-actions-and-targets.md),
em quatro PRs (os três primeiros empilhados):

1. **Custo por linha de ataque — entregue.** Cada linha da ficha e do
   bestiário diz o que gasta no turno de quem a usa: Ação Atacar (com Ataque
   Extra), Ação, Ação bônus ou Reação. Linha sem custo (salva antes, ou vinda
   do PDF) lê Ação Atacar num ataque e Ação numa salvaguarda, então magia não
   ganha Ataque Extra. Fora da vez, qualquer linha gasta a reação. A rolagem
   pela ficha gasta o mesmo, e a aba Ações desabilita a linha que o turno não
   paga, dizendo por quê.
2. **Salvaguarda rolada no servidor — entregue.** Com alvo, o servidor rola a
   salvaguarda dele contra a CD, para monstros e personagens, sem gastar nada
   do turno do alvo. Quem falha fica com o dano inteiro pendente; quem passa,
   com a metade, ou nada se a linha diz "Nenhum dano". Numa linha sem dano,
   quem falha fica com o efeito pendente para o mestre, e quem passa não fica
   com nada. Paralisado, Petrificado, Atordoado, Inconsciente ou a 0 PV falha
   em Força e Destreza sem rolar; Exaustão tira 2 por nível, e Impedido rola
   Destreza com desvantagem. O bestiário guarda as salvaguardas
   proficientes com o bônus do livro (o PDF de NPC as preenche), e a cópia do
   encontro rola com elas, inclusive na concentração. O jogador lê só "Passou"
   ou "Falhou" de um monstro. Diferença da spec: o combatente avulso rola com
   +0 e o mestre ainda não edita os modificadores dele.
3. **Vários alvos em área — entregue.** Só uma linha de salvaguarda aceita
   mais de um alvo (até 20, sem repetir): o custo é pago uma vez, o dano é
   rolado uma vez, e cada alvo rola a própria salvaguarda e fica com o
   próprio pendente. Um ataque com rolagem de acerto continua com um alvo. Um
   alvo inválido recusa o uso inteiro, sem gastar nada. A aba Ações marca os
   alvos numa lista, e o feed mostra uma linha por alvo. Um alvo oculto sai da
   cópia do jogador, em vez de deixar o evento inteiro secreto.
4. **PV pelo token — entregue.** Selecionar um token mostra, ao lado do mapa,
   o PV do combatente dele, com o ajuste para quem pode mudá-lo (o mestre, ou
   o dono do personagem). O PV dos monstros visíveis passa a ser da mesa: o
   jogador o lê na fila, no token e no feed, e continua sem ver CA, ataques e
   iniciativa. O mestre põe um token livre do bestiário no encontro em
   andamento (ou no em preparação) com um clique, com PV médio ou rolado; o
   token passa a ser do combatente, no mesmo lugar.

### Retorno da segunda sessão

O modificador situacional nas rolagens
([#133](https://github.com/DanielTrindade/quest-fast/issues/133)) e o alcance
nos ataques ([#134](https://github.com/DanielTrindade/quest-fast/issues/134))
entram antes da fase 3. Spec em
[`history/2026-11-23-roll-bonus-and-range.md`](history/2026-11-23-roll-bonus-and-range.md),
em quatro PRs:

1. **Alcance no ataque — entregue.** Cada linha de ataque da ficha e do
   bestiário ganha "Alcance" em texto ("1,5 m", "6/18 m"), mostrado em
   Mesa/Ações e gravado no evento do feed como era na hora do ataque. Sem
   migração: os ataques já são JSON. A importação do PDF deixa o campo vazio.
2. **Alcance no mapa — entregue.** "Ver alcance" na aba Ações desenha,
   em casas de 1,5 m, o alcance normal (contorno firme) e o longo (contorno
   leve) em volta do token de quem ataca, no tom de perigo. O texto vira
   metros por `parseRange` em `shared/` ("6/18 m", "30 ft"); o que não é
   distância fica só como texto. Só mostra: não recusa alvo.
3. **Modificador no servidor — entregue.** As rolagens da ficha, o
   ataque e a iniciativa no combate, a salvaguarda de concentração e o dano
   rolado depois aceitam `bonus: { roll, damage }`: dado e número com sinal,
   dado negativo inclusive (`+1d4`, `-1d4`, `+2`). O servidor lê antes de
   gastar o turno, confere os limites da rolagem inteira, rola à parte e
   soma; no crítico, os dados do modificador de dano dobram. O evento guarda
   a parcela (`bonus`), que sai da cópia do jogador num ataque de monstro.
4. **Modificador na tela — em andamento.** A barra "Modificadores" (No d20,
   No dano) no topo da aba Ações e na ficha aberta na Mesa, guardada na aba
   do navegador até ser limpa, com selo "Ativo". Toda rolagem da Mesa leva o
   texto: ficha, ataque, iniciativa, concentração e o "Rolar dano" do feed. O
   resultado mostra a parcela à parte, e o dado subtraído em `danger`. O
   alcance passa a aceitar a escrita da mesa, metros com quadrados
   ("36m/24q"). Diferença da spec: os botões de rolagem não dizem, um a um,
   que somam; a barra diz onde vale e mostra o selo.

### Efeitos temporários

Escudo da Fé, Auxílio, Lentidão e Proteção contra Energia no combate
([#112](https://github.com/DanielTrindade/quest-fast/issues/112)). Spec em
[`history/2026-11-25-temporary-effects.md`](history/2026-11-25-temporary-effects.md),
em quatro PRs empilhados:

1. **Regras em `shared/` — entregue.** Tipos de dano lidos do texto do
   ataque, durações, queda pela concentração e os valores efetivos.
2. **Efeito no combatente — entregue.** Coluna nova, rotas com RBAC
   (quem conjurou também põe e tira), expiração no turno, fim do encontro e
   projeção: de um monstro, o jogador vê só o nome.
3. **Números do combate — entregue.** CA e deslocamento efetivos, dano
   pendente com a sugestão de resistência e ficha que respeita o Auxílio.
4. **Na tela — entregue.** Chips de efeito nos cartões, formulário "Efeito
   de…" em "PV e condições" e no painel da Mesa, motivo da sugestão no dano
   pendente e eventos no feed. Fora desta entrega: modelos prontos das magias
   mais comuns.

### Gabaritos de área

Onde a Bola de Fogo pega, e o que fica no terreno (Teia, Névoa Obscurecente,
Espírito Guardião) ([#113](https://github.com/DanielTrindade/quest-fast/issues/113)).
Spec em [`history/2026-11-27-area-templates.md`](history/2026-11-27-area-templates.md),
em quatro PRs empilhados:

1. **Regras em `shared/` — entregue.** Esfera, cilindro, cone, linha e cubo
   em casas de 1,5 m, casas atingidas pela regra da meia casa, origem no
   cruzamento do grid e visibilidade por papel e fog.
2. **Áreas persistentes — entregue.** Tabela `scene_areas` e rotas com RBAC:
   o jogador cria, move e remove as próprias e ancora só no próprio
   personagem; só o mestre oculta. A área do mestre sob o fog e a ancorada
   num token que o jogador não vê não chegam a ele.
3. **Prévia ao vivo — entregue.** A área de referência vai pelo socket
   enquanto é desenhada, com a mesma regra de fog, e fica 5 s depois de
   soltar.
4. **Na tela — entregue.** "Marcar área" ao lado do mapa, para todos: a
   barra com a forma, a medida e o tipo, a lista acessível das áreas da cena
   e o desenho no `MapCanvas`, sob os tokens. A área ancorada acompanha o
   arrasto ao vivo. Fora desta entrega: pré-selecionar os alvos do ataque
   com vários alvos pela área.

### Invocações

Invocar Construto, Invocar Besta, Encontrar Familiar e Animar Mortos: a
criatura que o jogador controla no combate
([#114](https://github.com/DanielTrindade/quest-fast/issues/114)). Spec em
[`history/2026-11-27-summons.md`](history/2026-11-27-summons.md), em quatro
PRs empilhados:

1. **Regras em `shared/` — entregue.** A invocação que age junto vem logo
   depois de quem a invocou, com a mesma contagem; a ficha simples do
   jogador, o vínculo com quem invocou (concentração e duração em rounds) e a
   regra de quem é aliado aberto à mesa.
2. **Combate no servidor — em revisão.** Controlador no combatente (um
   jogador da campanha, nunca oculto), criação pelo mestre e pelo jogador
   (ficha simples, a partir do próprio personagem), RBAC pelo controlador,
   projeção e feed como aliado, iniciativa "junto" sem rolagem própria e a
   saída de quem invocou. Quem sai da campanha devolve as criaturas ao mestre.
3. **Mapa e ciclo de vida.** Token do controlador e saída pela concentração,
   pela duração e no fim do combate.
4. **Na tela.** "Invocar" na Mesa, os campos do mestre e "Agir com".

### Telas da campanha

A campanha deixa de ser uma página única com âncoras. Na conta, **Meus
personagens** reúne os personagens do jogador, cada um vinculado a uma
campanha, com um personagem ativo por campanha (se ele morrer, o jogador ativa
outro). Na campanha, cada tela tem rota própria: Visão geral, Mesa (onde se
joga, e onde o mapa da fase 4 entra), Preparo do mestre e Jogadores. Spec e
mockups na [#88](https://github.com/DanielTrindade/quest-fast/issues/88).

1. **Rotas e reorganização — entregue.** Layout com uma rota por tela, as
   seções de antes movidas sem redesenho, menu por rota e socket no layout.
2. **Meus personagens — entregue.** `GET /api/me/characters`, um personagem
   ativo por jogador e campanha (índice único parcial), galeria em
   `/characters` (seleção com destaque no desktop, cartas no celular), criação
   escolhendo a campanha, a ficha no modal atual sem rolagem e o grupo em
   medalhões na Visão geral. A Mesa mostra só os ativos e não edita fichas.
3. **Mesa — entregue.** Painel lateral com o turno no topo e as abas Ações,
   Dados e Feed; Ações por papel (o jogador com o personagem ativo, o mestre
   com o dano pendente e o combatente escolhido), reaproveitando as regras e
   as requisições da fila de iniciativa. Sem mapa aberto, o feed ocupa o
   centro. Convite em destaque em Jogadores, com o código em peças para ditar
   e o cartão da prévia do link.
4. **Chat da mesa — entregue.** A conversa escrita da mesa, fora do jogo
   ([#138](https://github.com/DanielTrindade/quest-fast/issues/138), spec em
   [`history/2026-11-20-table-chat.md`](history/2026-11-20-table-chat.md)):
   quarta aba do painel, em linha corrida, com menção, resposta, reações
   rápidas e remoção pelo autor ou pelo mestre. O servidor guarda as últimas
   500 mensagens por campanha e limita a 5 mensagens a cada 5 s por pessoa.
   Em tela cheia, o painel da Mesa vai junto, com a aba Mapa (a coluna que o
   palco tinha), e recolhe num trilho de ícones; recolhido, as mensagens
   novas aparecem sobre o mapa. Entregue em cinco PRs (#143 a #147).
   Diferenças da spec: a view guarda o trecho de cada menção
   (`{ userId, start, end }`), não só os ids; o limite de 300 caracteres conta
   grafemas; as mensagens sobre o mapa ficam em fundo opaco, para o contraste
   ser medido; a citação de uma resposta não leva o nome em negrito, para
   caber numa linha cortada com reticências. Aviso de menção fora da Mesa fica
   para uma issue própria.

### Fase 3 — mundo

NPCs, locais, quests e diários no mesmo lugar da mesa.

- `WorldEntry` com corpo em markdown (renderização sanitizada).
- Tipos NPC, Local, Quest e Diário; status de quest e data da sessão.
- Visibilidade pública ou privada, filtrada no servidor.
- Teste: entrada privada não aparece para jogador nem na listagem nem no
  detalhe.

Requisitos em
[`history/2026-09-04-mvp-campaign-management.md`](history/2026-09-04-mvp-campaign-management.md),
seção `world-entries`.

### Fechamento do MVP

- Validação de formulários e tratamento de erros de ponta a ponta.
- Seed completo: mestre, jogador, personagens, statblock, NPC e quest
  (statblock e encontro já estão no seed; faltam NPC e quest, da fase 3).

## Ideias levantadas (sem prioridade)

Lacunas apontadas no brainstorm de 2026-10-22. Não são compromisso de
entrega: entram no roadmap quando ganharem prioridade e escopo.

- **Mestre:** painel do grupo (CA, PV, percepção passiva, condições e
  inspiração de todos); handouts revelados a todos ou a alguns jogadores, com
  visibilidade no servidor; preparação e resumo de sessão (próxima data, notas,
  resumo a partir do feed); tabelas aleatórias da campanha roladas no feed;
  distribuição de XP ou marcos e de tesouro.
- **Jogadores:** gastar espaço de magia ao conjurar; descanso curto e longo
  assistido, com confirmação a cada passo (sem virar motor de regras); notas
  privadas do personagem; inventário do grupo.
- **Campo de batalha (além da fase 4):** régua de distância no padrão 5e;
  tamanho de criatura ocupando as casas certas; ping e desenho temporário no
  mapa; a área pré-selecionar os alvos do ataque com vários alvos.
  (Gabaritos de área entraram pela #113.)

## Questões em aberto

- **Campanha criada por engano não tem saída.** O mestre não pode sair da
  própria campanha e não há arquivamento. Quando entrar, a semântica
  escolhida é arquivamento reversível (`campaigns.archived_at`), não exclusão
  em cascata.
- **Retenção do feed:** histórico completo ou últimos N eventos. Decidir
  quando houver volume real.

## Fora de escopo

Voz e vídeo (ficam no Discord; o chat escrito da mesa entrou com a #138); bot do Discord; login por e-mail e
senha; motor de regras automático (CA por armadura, espaços de magia pela
tabela); compêndio SRD; multiclasse; iluminação dinâmica e linha de visão no
VTT; app mobile.
