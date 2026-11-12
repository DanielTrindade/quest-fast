# vtt-battlefield-phase4

> Registro histórico: spec de design da fase 4 (campo de batalha), aprovada em 2026-11-12.
> Status em 2026-11-12: nenhuma entrega implementada. O estado atual do produto está em
> [`../roadmap.md`](../roadmap.md) e a arquitetura em [`../architecture.md`](../architecture.md).
>
> Detalha os requisitos de [`2026-09-04-vtt-battlefield.md`](2026-09-04-vtt-battlefield.md)
> com as decisões do [spike](2026-11-12-vtt-spike.md). Onde divergem, vale esta;
> as divergências estão em [Mudanças em relação ao requisito original](#mudanças-em-relação-ao-requisito-original).

## Objetivo

O mestre mostra o mapa da cena, posiciona personagens e monstros e revela o
mapa aos poucos, e os jogadores movem o próprio token, tudo dentro do Quest
Fast, inclusive no celular. O Owlbear sai da mesa.

**Critério de sucesso:** uma sessão real com pelo menos uma cena usada do
começo ao fim no app (mapa, tokens de personagem e de monstro, fog revelado
durante a exploração e um combate com os tokens no mapa), sem abrir o Owlbear.

### Fora de escopo

- Régua de distância, gabaritos de área, ping e desenho temporário (estão em
  "Ideias levantadas").
- Iluminação, visão por token, paredes e linha de visão.
- Fog automático pelo movimento dos tokens; pincel à mão livre no fog.
- Camadas, andares, várias cenas visíveis ao mesmo tempo, importar de outras VTTs.
- Imagem própria de token (o token usa o avatar do personagem ou iniciais).
- Atacar clicando no token: o alvo continua sendo escolhido na lista do combate.
- Iniciativa ou turno pelo mapa.

## Modelo de dados

### `scenes`

| Coluna | Tipo | Observação |
| --- | --- | --- |
| `id` | text PK | |
| `campaign_id` | FK `campaigns`, cascade | |
| `name` | text | 1–80 caracteres |
| `map_asset_id` | FK `assets`, restrict | o mapa normalizado |
| `map_width`, `map_height` | integer | pixels depois da normalização (≤ 4096) |
| `grid_enabled` | boolean | padrão `true` |
| `grid_cell_size` | real | em pixels do mapa; padrão `map_width / 30` |
| `grid_offset_x`, `grid_offset_y` | real | alinha com o grid desenhado no mapa |
| `snap_to_grid` | boolean | padrão `true`; o token solto vai para o centro da casa |
| `fog_enabled` | boolean | padrão `false` |
| `fog_revealed` | json | multipolígono revelado (`[]` = tudo oculto) |
| `version` | integer | sobe a cada mudança gravada |
| `created_at` | timestamp | |

### Coluna nova em `campaigns`

- `active_scene_id` — text, sem FK (mesmo motivo do `active_combatant_id`:
  evita ciclo); o servidor mantém consistente e zera ao excluir a cena.

### `tokens`

| Coluna | Tipo | Observação |
| --- | --- | --- |
| `id` | text PK | |
| `scene_id` | FK `scenes`, cascade | |
| `kind` | enum `character` \| `combatant` \| `free` | |
| `character_id` | FK `characters`, cascade | só `character`; único por cena |
| `combatant_id` | FK `combatants`, cascade | só `combatant` (monstro ou manual); único por cena |
| `statblock_id` | FK `statblocks`, set null | só `free` vindo do bestiário |
| `label` | text | só `free`; os outros leem o nome da ficha ou do combatente |
| `size` | enum `SIZES` | só `free`; os outros leem da origem |
| `x`, `y` | real | centro do token, em pixels do mapa |
| `hidden` | boolean | escondido pelo mestre |
| `created_at` | timestamp | |

Um personagem num encontro **não** ganha token de combatente: o token dele é
o de personagem, e o combate o encontra pelo `character_id`. Assim nunca há
dois tokens da mesma pessoa.

### Tipos em `shared/`

`SceneView` (a cena projetada para quem recebe), `TokenView`, `FogOperation`
(`{ mode: 'reveal' | 'hide', shape: { kind: 'rect', … } | { kind: 'polygon', points } }`),
`GridSettings` e as mensagens novas do socket (abaixo).

## Lógica pura (`shared/src/battlefield.ts`, com teste unitário)

- `applyFog(revealed, operation)` → novo multipolígono (união ao revelar,
  diferença ao ocultar, coordenadas arredondadas para inteiro). Usa
  `polygon-clipping`, primeira dependência de `shared/`.
- `validateFogOperation` (forma dentro do mapa, 3–200 vértices, sem NaN).
- `isRevealed(revealed, x, y)` → ponto dentro da área revelada.
- `tokenCells(size)` → casas ocupadas (miúdo ½, pequeno e médio 1, grande 2,
  enorme 3, imenso 4); `tokenDiameter(size, cellSize)`.
- `snapToCell(x, y, grid, size)` → centro da casa (ou da junção, para
  tamanhos pares).
- `canGrab(lock, userId, now)` e `LOCK_TTL_MS = 3000`.
- `projectScene(scene, tokens, viewer)` → o que cada papel recebe (abaixo).

## Fluxo

### Cena e mapa

- O mestre cria uma cena com nome e imagem. O servidor normaliza com
  `sharp` (decodifica, aplica a rotação do EXIF, cabe em 4096 px sem ampliar,
  JPEG mozjpeg q82, sem metadados), guarda pelo `AssetStore` e cria o `asset`
  e a `scene`. Entrada: JPEG, PNG ou WebP, até 25 MB e 8192 × 8192 px;
  acima disso, 413/422 com mensagem em português.
- O mestre troca a imagem (mesmo caminho, novo asset), renomeia, configura o
  grid e exclui a cena.
- O mestre **abre** uma cena para a mesa (`active_scene_id`) ou fecha o mapa.
  Os jogadores só enxergam a cena aberta; abrir outra troca a tela de todos.
- **Grid:** o mestre informa quantas casas o mapa tem de largura (o app
  calcula o tamanho da casa) e ajusta o deslocamento para casar com o grid
  desenhado na imagem; ou desliga o grid quando o mapa já tem um.

### Tokens

- O mestre adiciona tokens de:
  - **personagem** da campanha (um por cena);
  - **combatente** do encontro ativo ou em preparação ("colocar o encontro no
    mapa" adiciona de uma vez todos os combatentes que ainda não estão);
  - **bestiário** ou **livre** (nome e tamanho), fora do combate.
- O mestre esconde, revela e remove qualquer token. Remover o combatente do
  encontro (ou excluir o encontro) remove o token dele.
- **Arrasto (protocolo do spike):**
  1. `POST …/tokens/:id/grab` trava o token para quem pediu (validade de 3 s);
     o arrasto começa na tela antes da resposta.
  2. Enquanto arrasta, o cliente manda `token.move` pelo socket a 30 Hz. O
     servidor confere a trava, renova a validade e repassa `token.moving` a
     quem pode ver o token. Nada vai para o banco.
  3. `PATCH …/tokens/:id` com `{ x, y }` grava a posição (com o encaixe no
     grid feito no cliente e conferido no servidor), libera a trava, sobe a
     `version` e publica `scene.updated`.
  - Quem assiste interpola com buffer de intervalo + jitter.
  - Trava de outra pessoa: 409 com quem está movendo; o token volta.
  - O socket fecha: as travas daquele usuário caem e o token fica na última
    posição recebida, gravada.
- **Teclado:** com o token selecionado na lista, as setas movem uma casa
  (`PATCH` direto, sem trava, recusado com 409 se outra pessoa estiver
  arrastando).

### Fog of war

- Por cena, o mestre liga o fog (começa tudo oculto) e usa:
  - revelar ou ocultar um **retângulo**;
  - revelar ou ocultar um **polígono** (clique a clique; fecha no primeiro
    ponto ou com Enter);
  - **revelar tudo** e **ocultar tudo**.
- `POST …/scenes/:id/fog` recebe uma `FogOperation`; o servidor aplica
  `applyFog`, grava `fog_revealed`, sobe a `version` e publica
  `scene.updated`.
- O mestre vê o fog semitransparente e pode alternar "ver como jogador"
  (opaco, só na tela dele).

## Permissões e visibilidade

`projectScene` é usado pela resposta REST e pelo socket. Nada que o jogador
não pode ver sai do servidor.

### O que o jogador vê

| Item | Jogador |
| --- | --- |
| Lista de cenas | não |
| Cena aberta | sim: mapa, grid, fog revelado, tokens visíveis |
| Outra cena | não existe (404) |
| Token `hidden` | ausente, em qualquer payload |
| Token de combatente escondido no encontro | ausente |
| Token que não é de personagem com o centro fora da área revelada (fog ligado) | ausente |
| Tokens de personagem | sempre, mesmo na área oculta |
| `token.moving` | só de tokens que ele vê na posição recebida |

Um monstro que sai da área oculta durante o arrasto aparece quando o mestre
solta (o `scene.updated` o inclui); durante o arrasto ele não é enviado.

### Matriz de ações

| Ação | Mestre | Jogador |
| --- | --- | --- |
| Listar cenas, criar, editar, trocar mapa, excluir | sim | 403 (404 na cena que não está aberta) |
| Abrir e fechar a cena para a mesa | sim | 403 |
| Configurar grid | sim | 403 |
| Adicionar, remover, esconder, revelar token | sim | 403 |
| Pegar, mover e soltar token | qualquer | só o do próprio personagem; 404 se ele não vê o token |
| Operação de fog | sim | 403 |
| `token.move` sem trava | ignorado | ignorado |

Códigos como no combate: **404** para não membro e para o que o jogador não
pode saber que existe; **403** para ação proibida sobre o que ele já vê;
**409** para trava de outra pessoa ou `version` desatualizada.

### Feed

Nenhum evento novo: abrir cena, mover token e revelar área não entram no
feed (seria ruído). O combate continua contando o que conta.

## Tempo real

- **O socket passa a receber mensagens do cliente**, só `token.move`
  (`{ tokenId, x, y }`). Validação: formato, `maxPayload` de 1 KB, no máximo
  40 por segundo por socket (o excedente é descartado), trava do token em nome
  do `userId` da conexão. Tudo o mais continua em REST, com o RBAC testado
  como hoje.
- Mensagens novas do servidor:
  - `scene.updated` com a cena projetada e `version` (o cliente descarta
    versão menor);
  - `scene.closed` quando o mestre fecha o mapa ou exclui a cena aberta;
  - `token.moving` (`{ tokenId, x, y, ts }`), efêmero.
- O hub ganha `publishScene(campaignId, project)`, irmão de `publishCombat`,
  e as travas ficam em memória no servidor (processo único).
- Reconexão: o cliente refaz o fetch da cena, como no feed e no combate.
- Mudanças no combate que mudam um token (combatente escondido, removido,
  derrotado, vez atual) também publicam `scene.updated` da cena aberta.

## Interface

Storybook primeiro, cada componente passando `npm run test:design` antes de
ir para `screens/`. As stories usam um mapa sintético gerado no código, nunca
os mapas da mesa (direitos da imagem).

- **Seção "Mapa"** na página da campanha: para o mestre, a lista de cenas
  (criar, abrir para a mesa, editar, excluir); para o jogador, a cena aberta
  em miniatura ou "O mestre ainda não abriu um mapa". Um botão abre a
  **tela do mapa**.
- **Tela do mapa** (rota própria, tela cheia, inclusive no celular): canvas
  2D com pan, zoom com dois dedos e roda do mouse, grid, tokens e fog. Barra
  do mestre: tokens, grid, ferramentas de fog, "ver como jogador". Lista de
  tokens em DOM, fora do canvas, para leitor de tela e teclado.
- Componentes (presentacionais): `MapCanvas` (desenho e gestos, sem
  dados), `TokenList`, `SceneList`, `SceneForm` (nome, imagem, progresso do
  envio), `GridSettings`, `FogToolbar`, `TokenPicker`.

## Testes

- **`shared/`:** `applyFog` (união, diferença, ocultar parte do revelado,
  revelar tudo/ocultar tudo, coordenadas inteiras), `isRevealed`,
  `tokenCells`, `snapToCell`, `canGrab`, `projectScene` (cada linha da tabela
  "O que o jogador vê").
- **Servidor (integração):**
  - jogador não lista, não cria, não edita e não abre cena; não vê cena
    fechada (404);
  - jogador não move token alheio (403) nem token que não vê (404); a posição
    não muda;
  - payload do jogador (REST e socket) sem token escondido, sem combatente
    escondido e sem monstro na área oculta;
  - jogador não altera o fog;
  - trava: segundo `grab` recebe 409; soltar sem a trava recebe 409; a trava
    cai quando o socket fecha;
  - `token.move` de quem não tem a trava não é repassado;
  - upload: arquivo que não é imagem → 422; acima de 25 MB → 413; acima de
    8192² → 422; o mapa sai com no máximo 4096 px.
- **Design:** stories de cada componente e `test:design`.
- **Fluxo:** `verify:app` e `verify:group` percorrem abrir cena, mover token,
  revelar área e conferir o que o jogador vê.

## Entregas

Cada uma usável na mesa e mergeável sozinha, em PRs empilhados por seção do
plano.

1. **Cena e mapa.** `sharp` e a normalização; schema (`scenes`,
   `active_scene_id`) e migração; rotas de cena com RBAC; abrir e fechar para a
   mesa; grid; `scene.updated`/`scene.closed`; seção "Mapa", tela do mapa com
   `MapCanvas` (pan, zoom, grid). Usável: o mestre mostra o mapa da cena e
   todos veem, no celular também.
2. **Tokens.** Schema `tokens`; adicionar de personagem, encontro e
   bestiário; esconder; arrasto com trava, `token.move` no socket,
   interpolação; teclado e `TokenList`. Usável: substitui o Owlbear para
   posicionar o grupo e os monstros.
3. **Fog of war.** `applyFog` em `shared/`; rota de fog; ferramentas do
   mestre; "ver como jogador"; monstro na área oculta fora do payload do
   jogador. Usável: exploração com o mapa revelado aos poucos.
4. **Acabamento.** Token ligado ao combate (vez atual em destaque, faixa de
   saúde no monstro, derrotado esmaecido); reconexão com o estado completo;
   seed com uma cena de mapa sintético e tokens; `verify:app` e
   `verify:group`; README sem o Owlbear; roadmap com a fase 4 em "Entregue".

A entrega 1 atualiza `architecture.md` (socket ainda só de saída, `sharp`,
`publishScene`) e o roadmap (fase 4 em andamento); a entrega 2 registra o
socket recebendo `token.move`.

## Mudanças em relação ao requisito original

1. **Monstro na área oculta não chega ao jogador.** O original aceitava o fog
   só visual e garantia apenas os tokens marcados como ocultos. Com o fog em
   polígonos no servidor, saber se um ponto está revelado é barato, então o
   servidor também omite tokens que não são de personagem com o centro na área
   oculta. Sem isso, o monstro desenhado embaixo do fog continuaria no payload
   e no devtools.
2. **Encaixe no grid por padrão**, desligável por cena. O original tratava o
   grid só como referência visual; os mapas da mesa têm grid desenhado e o
   Owlbear encaixa.
3. **Tamanho do token pela criatura** (grande ocupa 2 × 2). Estava em "Ideias
   levantadas"; o token precisa de algum tamanho e a regra é uma tabela.
4. **Três origens de token**, não duas: personagem, combatente do encontro
   (ancorado no id estável, como previsto no combate) e livre/bestiário.
5. **Pegar e soltar por REST, mover pelo socket.** O original falava só em
   `token.moved` no canal; o spike mostrou que a trava é necessária, e REST
   mantém o RBAC testado no padrão do projeto.
6. **Nenhum evento no feed** para cena, token e fog.

## Questões em aberto

Nenhuma bloqueante. Para decidir na implementação:

- Mapa com transparência: WebP sem perda ou PNG (nenhum mapa da mesa tem).
- Valor inicial de colunas do grid (30) e o ajuste fino do deslocamento por
  arrasto, em vez de só campos numéricos.
- Se o avatar (#81) passa pelo `sharp` já na entrega 1 ou em PR próprio.
