## Context

Change posterior a `mvp-campaign-management`, que já entregou as três costuras de que este depende: o canal WebSocket por campanha (`session-feed`), a abstração `Asset` para imagens e o RBAC por `CampaignMember`.

Este é o item de maior risco técnico do produto e o motivo de ter sido adiado. As decisões abaixo cobrem o que já está determinado pelo MVP; as escolhas genuinamente abertas estão em **Open Questions** e devem ser fechadas por um spike antes de a implementação começar — não por dedução no papel.

## Goals / Non-Goals

**Goals:**

- Substituir o Owlbear Rodeo no fluxo da mesa para o caso de uso comum: mapa, grid, tokens e fog manual.
- Reaproveitar o canal em tempo real existente sem alterar seus requisitos.
- Manter a autoridade no servidor, inclusive para o que o jogador pode ver do mapa.

**Non-Goals:**

- Iluminação dinâmica, paredes, linha de visão e visão por token.
- Medição, templates de área e automação de magias.
- Fog automático derivado de movimento ou de geometria.
- Camadas, múltiplos andares e importação de outras VTTs.

## Decisions

### 1. Reutilizar o canal do `session-feed`

`token.moved` e `fog.updated` entram como novos tipos de evento no canal por campanha que já existe. Sem segundo socket, sem segundo servidor, sem novo modelo de autorização — a validação de papel no handshake já é a mesma.

### 2. O servidor decide o que cada cliente vê

Fog of war aplicado só no cliente é decorativo: quem abre o devtools vê o mapa inteiro. A imagem do mapa, na prática, será baixada por completo — isso é aceito. O que **não** é aceito é vazar posição e existência de tokens que o mestre escondeu: esses não podem ser enviados ao cliente do jogador, em nenhum payload.

Ou seja, a garantia real do fog é sobre **tokens ocultos**, não sobre pixels do mapa. Isso precisa estar explícito para não gerar falsa sensação de segurança.

### 3. Posse de token

O mestre controla qualquer token. Um jogador move apenas o token vinculado ao seu próprio personagem. A verificação é server-side, a cada movimento, contra `CampaignMember` e a posse do `Character`.

### 4. Grid como referência visual

O grid define alinhamento e leitura de distância a olho, sem lógica de pathfinding, snap obrigatório ou cálculo de alcance. Medição está fora de escopo.

## Risks / Trade-offs

- **Sincronização de movimento é o problema difícil.** Arrasto contínuo gera muitos eventos por segundo e edições concorrentes no mesmo token. → Mitigação a definir no spike: throttle no cliente, último-a-escrever-vence no servidor e posse exclusiva durante o arrasto.
- **Fog of war não tem representação óbvia.** Bitmap é simples de aplicar e caro de trafegar; polígonos são leves e mais difíceis de compor e apagar. → Decidir por spike, não por argumento.
- **Mapas são imagens grandes.** Os limites de upload definidos para avatares no MVP não servem. → Revisar limites e considerar redimensionamento no servidor.
- **Canvas é a maior superfície de interface do produto.** → Manter o escopo travado nos Non-Goals; iluminação e medição são o caminho conhecido para o escopo escapar.

## Open Questions

Fechar por spike antes de escrever as tasks de implementação:

- Representação do fog: máscara bitmap versus lista de polígonos revelados.
- Protocolo de movimento: frequência de eventos, throttle e resolução de conflito.
- Biblioteca de canvas versus canvas 2D direto.
- Se o estado de fog vive em coluna da `Scene` ou em tabela própria — decorre da representação escolhida.
