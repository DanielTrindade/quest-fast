# Roadmap

O que já existe, o que vem a seguir e o que está em aberto. Atualize este
arquivo no PR que entrega ou muda o escopo de uma etapa.

Atualizado em 2026-10-23.

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
  (CD e atributo), sem botão de rolar ataque. Rolagem de dano pela ficha e
  dano composto (`1d8+3+1d6`, issue #8) seguem em aberto.

Pendência dessas entregas: rodar `verify:app` e `verify:group` contra o app
rodando para fechar a qualidade de vida da sessão e a ficha oficial.

## Próximas etapas

Em ordem. O combate e o mapa vêm antes do mundo porque substituem as
ferramentas que mais pesam na mesa hoje (Avrae e Owlbear); NPCs, locais e
diários continuam no Kanka até a fase 3.

### Fase 2 — combate e bestiário (em andamento)

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
2. **Encontro e turnos.** Preparação invisível aos jogadores, iniciativa
   (rolada no servidor ou atribuída), turnos e rounds, reforços, combatentes
   escondidos, encerramento com resumo; `combat.updated` com visão por papel.
3. **PV e condições.** Dano e cura por delta, faixa de saúde dos monstros para
   os jogadores, teste contra a morte, as 15 condições com duração e
   concentração com lembrete.
4. **Ataques e acabamento.** Ataque e dano num clique com crítico, resumo no
   feed, seed com statblock e encontro, `verify:app` e `verify:group`.

### Fase 4 — campo de batalha (VTT)

Cenas com mapa, grid, tokens e fog of war em tempo real, substituindo o
Owlbear Rodeo. É o item de maior risco técnico.

Começa por um **spike descartável** que decide, por medição:

- representação do fog (máscara bitmap ou polígonos revelados);
- protocolo de movimento (frequência, throttle, resolução de conflito);
- biblioteca de canvas ou canvas 2D direto.

A garantia de segurança do fog é sobre **tokens ocultos**: eles nunca chegam
ao cliente do jogador. A imagem do mapa, essa sim, é baixada inteira.

Requisitos e spike em
[`history/2026-09-04-vtt-battlefield.md`](history/2026-09-04-vtt-battlefield.md).

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
  (statblock e encontro entram na entrega 4 da fase 2).

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
