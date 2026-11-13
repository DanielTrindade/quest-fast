# Roadmap

O que já existe, o que vem a seguir e o que está em aberto. Atualize este
arquivo no PR que entrega ou muda o escopo de uma etapa.

Atualizado em 2026-11-12.

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

## Próximas etapas

Em ordem. O mapa vem antes do mundo porque substitui o Owlbear, a ferramenta
que mais pesa na mesa hoje depois que o combate substituiu o Avrae; NPCs,
locais e diários continuam no Kanka até a fase 3.

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
3. **Mesa.** Painel com Ações, Dados e Feed, ações por papel, convite em
   destaque em Jogadores.

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

**Em andamento.** Spec aprovada em
[`history/2026-11-12-vtt-battlefield-phase4.md`](history/2026-11-12-vtt-battlefield-phase4.md),
que detalha os requisitos de
[`history/2026-09-04-vtt-battlefield.md`](history/2026-09-04-vtt-battlefield.md)
com as decisões do spike. Quatro entregas, cada uma usável na mesa:

1. **Cena e mapa — em andamento.** O mestre cria cenas, envia o mapa
   (normalizado no servidor), abre uma cena para a mesa e configura o grid; os
   jogadores veem a cena aberta com pan e zoom, inclusive no celular. Já
   prontos: regras do grid e limites do mapa em `shared/`, contrato da API,
   schema das cenas e o servidor (normalização do mapa com `sharp`, rotas com
   RBAC, cena aberta para a mesa e `scene.updated`/`scene.closed` no socket)
   e os componentes no Storybook (`MapCanvas` com pan, zoom e grid,
   `SceneList`, `SceneForm` e `GridSettings`).
2. **Tokens.** Tokens de personagem, de combatente (ancorados no id estável do
   combatente) e do bestiário ou livres, com tamanho pela criatura, arrasto ao
   vivo com trava, posse por papel, tokens ocultos fora do payload do jogador
   e movimento por teclado.
3. **Fog of war.** Revelar e ocultar com retângulo e polígono, regra em
   `shared/` e estado calculado no servidor; monstro na área oculta fora do
   payload do jogador.
4. **Acabamento.** Token ligado ao combate, reconexão com o estado completo da
   cena, seed com cena, `verify:app` e o Owlbear fora do README.

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
  gabaritos de área (cone, esfera, linha, cubo); tamanho de criatura ocupando
  as casas certas; ping e desenho temporário no mapa.

## Questões em aberto

- **Campanha criada por engano não tem saída.** O mestre não pode sair da
  própria campanha e não há arquivamento. Quando entrar, a semântica
  escolhida é arquivamento reversível (`campaigns.archived_at`), não exclusão
  em cascata.
- **Retenção do feed:** histórico completo ou últimos N eventos. Decidir
  quando houver volume real.

## Fora de escopo

Chat, voz e vídeo (ficam no Discord); bot do Discord; login por e-mail e
senha; motor de regras automático (CA por armadura, espaços de magia pela
tabela); compêndio SRD; multiclasse; iluminação dinâmica e linha de visão no
VTT; app mobile.
