## Why

O destino do `quest-fast` é substituir também o Owlbear Rodeo: hoje a mesa sai da plataforma para olhar o mapa. Este change traz o campo de batalha para dentro — cena com mapa, grid, tokens e fog of war em tempo real.

Ele foi deliberadamente separado do `mvp-campaign-management` porque concentra o maior risco técnico e a maior parcela do esforço do produto. Tirá-lo do MVP permitiu entregar uma sessão jogável antes; ele só começa depois que `mvp-campaign-management` estiver em uso real.

## What Changes

- Adiciona cenas de campanha com imagem de mapa e grid configurável.
- Adiciona tokens de personagem e de statblock, com movimentação sincronizada e regra de posse.
- Adiciona fog of war manual controlado pelo mestre.
- Reutiliza, sem alterar, o canal em tempo real e a abstração de assets entregues no MVP: os eventos `token.moved` e `fog.updated` passam pelo mesmo canal por campanha do `session-feed`, e mapas são armazenados como `Asset`.
- Substitui o Owlbear Rodeo no fluxo da mesa.

## Capabilities

### New Capabilities

- `battlefield`: cenas com mapa e grid, tokens com posse por papel, fog of war manual e sincronização em tempo real.

### Modified Capabilities

Nenhuma. O canal em tempo real do `session-feed` foi projetado no MVP para receber novos tipos de evento sem mudança de requisito.

## Non-Goals

- Iluminação dinâmica, visão por token, paredes e linha de visão.
- Medição de distância, réguas, formas de área e templates de magia.
- Fog of war automático derivado de paredes ou de movimento.
- Camadas de mapa, mapas em múltiplos andares e importação de formatos de outras VTTs.
- Áudio, cenas com música e efeitos visuais.

## Impact

- `client/`: nova superfície de canvas, a parte mais pesada da interface até aqui.
- `server/`: novos tipos de evento no canal WebSocket existente; nenhuma nova infraestrutura.
- `db/`: tabelas `Scene`, `Token` e o armazenamento do estado de fog.
- Uploads passam a lidar com imagens grandes; os limites de tamanho definidos no MVP para avatares precisam ser revistos para mapas.
- Depende de `mvp-campaign-management` estar aplicado: `Campaign`, `CampaignMember`, `Character`, `Statblock`, `Asset` e o canal em tempo real.
