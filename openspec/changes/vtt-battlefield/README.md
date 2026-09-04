# vtt-battlefield

Campo de batalha dentro do `quest-fast`: cenas com mapa, grid, tokens e fog of war em tempo real. Substitui o Owlbear Rodeo no fluxo da mesa.

**Depende de `mvp-campaign-management` estar aplicado e em uso real.** Este change reutiliza o canal em tempo real (`session-feed`), a abstração `Asset` e o RBAC por `CampaignMember` entregues no MVP.

## Why

O destino do produto é a mesa inteira em um lugar só, e hoje a mesa sai da plataforma para olhar o mapa. Este change foi separado do MVP porque concentra o maior risco técnico e a maior parcela do esforço — tirá-lo de lá permitiu entregar uma sessão jogável antes.

## Capabilities

### New Capabilities

- `battlefield`: cenas com mapa e grid, tokens com posse por papel, fog of war manual e sincronização em tempo real.

### Modified Capabilities

Nenhuma.

## Atenção antes de implementar

O `tasks.md` começa com um **spike descartável**. Três decisões continuam abertas de propósito — representação do fog, protocolo de movimento e biblioteca de canvas — e devem ser fechadas por medição, não por argumento. Não escreva código de produção antes do grupo 1 terminar.
