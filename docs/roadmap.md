# Roadmap

O que já existe, o que vem a seguir e o que está em aberto. Atualize este
arquivo no PR que entrega ou muda o escopo de uma etapa.

Atualizado em 2026-10-21.

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
  reconhecido.

Pendência dessas entregas: rodar `verify:app` e `verify:group` contra o app
rodando para fechar a qualidade de vida da sessão e a ficha oficial.

## Próximas etapas

### Fase 2 — combate e bestiário

O mestre roda um combate inteiro sem redigitar monstros e sem planilha ao
lado.

- Bestiário da campanha (`Statblock`: nome, PV, CA, ataques).
- Encontros com combatentes vindos de personagens, de statblocks ou
  manuais.
- Iniciativa (atribuída ou rolada), turnos e rounds.
- PV ajustado pelo mestre em qualquer combatente e pelo jogador só no
  próprio, publicado no feed.
- Condições, encerramento do encontro com histórico preservado.
- Evento `combat.updated` no mesmo canal WebSocket.
- Testes de RBAC: jogador não avança turno, não altera PV alheio, não edita
  statblock.

Requisitos detalhados em
[`history/2026-09-04-mvp-campaign-management.md`](history/2026-09-04-mvp-campaign-management.md),
seção `combat-tracker`.

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
- Seed completo: mestre, jogador, personagens, statblock, NPC e quest.

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

## Questões em aberto

- **Campanha criada por engano não tem saída.** O mestre não pode sair da
  própria campanha e não há arquivamento. Quando entrar, a semântica
  escolhida é arquivamento reversível (`campaigns.archived_at`), não exclusão
  em cascata.
- **Condições no combate:** lista livre ou enum fixo das condições 5e.
  Decidir com a tela da fase 2.
- **Retenção do feed:** histórico completo ou últimos N eventos. Decidir
  quando houver volume real.

## Fora de escopo

Chat, voz e vídeo (ficam no Discord); bot do Discord; login por e-mail e
senha; motor de regras automático (CA por armadura, espaços de magia pela
tabela); compêndio SRD; multiclasse; iluminação dinâmica e linha de visão no
VTT; app mobile.
