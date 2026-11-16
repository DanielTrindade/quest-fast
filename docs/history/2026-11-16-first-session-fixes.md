# Ajustes da primeira sessão

Spec aprovada em 2026-11-16. Detalha a
[#110](https://github.com/DanielTrindade/quest-fast/issues/110), levantada na
primeira sessão real com o MVP (2026-11-13).

## Objetivo

Seis ajustes pequenos e independentes que resolvem o que mais atrapalhou na
mesa: magia de salvaguarda sem dano, espaços de magia à mão, criatura
derrotada visível no mapa, imagem no bestiário, tamanho do token e opacidade
do grid.

## Fora de escopo

- **Rolar a salvaguarda do alvo no servidor** e salvaguarda em vários alvos:
  ficam na [#111](https://github.com/DanielTrindade/quest-fast/issues/111).
  Aqui, como já acontece com o dano, quem resolve passou/falhou é a mesa.
- **Custo de ação por linha de ataque** (Ação, Ação Bônus): também na #111.
  Até lá, usar uma linha de salvaguarda continua gastando o ataque, como hoje.
- **Condição automática ao falhar** (Graxa → Caído): o mestre aplica pela lista
  de condições.
- **Espaços pela tabela de classe e nível:** continua fora de escopo do
  projeto. O total de espaços é o da ficha.
- **PV de token livre:** fica na #111. Token livre nunca fica caído nem
  derrotado.

## 1. Salvaguarda sem dano

Hoje toda linha de "Armas e truques de dano" exige uma expressão de dado
(`shared/src/validation.ts:68`).

**Regra:**
- Em `kind: 'save'`, `damage` pode ser vazio. O tipo de dano vazio segue
  junto. Em `kind: 'attack'`, nada muda: o dano continua obrigatório.
- A importação do PDF aceita uma linha com CD e sem dano, sem aviso.
- O formulário de ataques (ficha e statblock) marca o dano como opcional
  quando "Salvaguarda" está escolhida.

**Usar a linha:**
- Continua sendo um evento de rolagem de ataque (`rollKind: 'attack'`) com
  `save`, só que sem `damage` e com a rolagem vazia (`noRoll()` em `shared/`):
  nada é rolado. O feed mostra "Lyra usou Graxa em Goblin 1 · CD 13 de
  Destreza, sem dano", e o resultado na ficha e na aba Ações mostra a CD em
  vez de um total 0. Reaproveitar o evento de ataque mantém a resposta das
  rotas de rolagem, a redação por papel e o sigilo como estão.
- **Com alvo** (no combate): o alvo recebe um lembrete novo, `pendingSave`
  (`dc`, `ability`, `attackerName`, `attackName`, `notes`, `eventId`,
  `secret`). Ele aparece para o mestre e, se o alvo for um personagem, para o
  dono dele, que rola a própria salvaguarda. Quem age sobre o alvo marca
  "Resolvido" (dispensa). O efeito de uma falha, o mestre aplica pela lista de
  condições, como hoje.
- **Sigilo:** as mesmas regras do ataque. A linha de um monstro é secreta por
  padrão, e um atacante ou alvo oculto torna o evento secreto. O jogador nunca
  recebe um `pendingSave` secreto.
- No `AttackCard`, uma linha sem dano mostra "Sem dano", e o botão diz "Pedir
  salvaguarda".

**Testes:** validação e importação em `shared/`. Integração: a ficha aceita a
salvaguarda sem dano e recusa um ataque sem dano; o `pendingSave` secreto não
chega ao jogador, o aberto chega ao dono, que o dispensa, e outro jogador não.

## 2. Espaços de magia e conjuração

Hoje os espaços só aparecem na ficha (`SpellSlots` em `CharacterSheetView`).

**Na aba Ações do jogador**, uma seção "Magia" aparece quando a ficha tem
espaços ou magias de 1º círculo ou mais:
- Os espaços com o mesmo `SpellSlots` editável da ficha: tocar num ponto gasta
  ou recupera (ajuste manual, sem feed), por `spellSlotsSpent`, que já existe.
- A lista de magias de 1º círculo ou mais, cada uma com **Conjurar**, que abre
  uma confirmação com os círculos possíveis (do círculo da magia até o 9º, só
  os que têm espaço livre, começando pelo mais baixo) e "Como ritual" (sem
  espaço) quando a magia for ritual.
- Se a magia for de concentração, a confirmação avisa que o personagem passa a
  se concentrar e, se ele já estiver concentrado, que a concentração anterior
  termina.
- Sem espaço livre no círculo da magia ou acima (e sem ritual), o botão fica
  desativado com o motivo ("Sem espaços do 3º círculo ou acima").

**Servidor:** `POST /campaigns/:id/characters/:characterId/cast` com
`{ spellIndex, circle }` ou `{ spellIndex, ritual: true }`. Numa só transação o
servidor confere a magia e o círculo (não abaixo do da magia, com espaço livre;
ritual só em magia ritual; truque recusado), gasta o espaço, marca
`concentrating` numa magia de concentração e grava o evento `spell.cast` no
feed: "Ana conjura Bola de Fogo no 3º círculo" (ou "como ritual"). O evento
leva `characterId`, `characterName`, `spellName`, `circle` ou `ritual` e
`concentration`. Só o dono do personagem e o mestre conjuram (outro jogador:
404 se não for membro, 403 se for). O ajuste manual dos pontos continua pelo
estado da ficha.

**Na entrega:** só o dono conjura; o mestre recebe 403, como nas rotas de
rolagem e de estado da ficha, que também são só do dono. O corpo recebe também
`spellName`, para recusar a conjuração se a lista mudou, e conjurar outra magia
de concentração descarta os lembretes de salvaguarda da anterior.

**Testes:** regras do círculo em `shared/`. Integração: o jogador não conjura
pelo personagem de outro; círculo abaixo da magia, sem espaço ou ritual numa
magia que não é ritual são recusados; a conjuração gasta o espaço e marca a
concentração.

## 3. Token caído ou derrotado

Hoje o token não sabe nada do PV de quem representa.

**Regra:** `TokenView` ganha `vitality: 'up' | 'down' | 'defeated'`.
- `defeated`: token ligado a um combatente que não é personagem, com 0 PV (a
  regra de `isDefeated` em `shared/`).
- `down`: token de personagem com 0 PV na ficha, dentro ou fora do combate
  (ainda faz testes contra a morte).
- `up`: todo o resto, inclusive token livre, que não tem PV (#111).
- O jogador recebe o estado de todo token visível. Para uma criatura, é a mesma
  informação que a faixa de saúde "derrotado" já dá; o PV continua sem chegar
  a ele.
- Mudança de PV no combate ou na ficha republica as cenas que mostram o token.

**No mapa:**
- **Derrotado:** avatar em tons de cinza, opacidade menor e um X por cima, nas
  cores dos tokens do tema; desenhado por baixo dos tokens vivos, para não
  roubar o clique.
- **Caído:** avatar com opacidade menor e o anel na cor de perigo, sem o X e
  sem descer de camada: continua sendo alguém a socorrer.
- Os dois continuam podendo ser movidos e removidos por quem já podia.
- A lista de tokens mostra o selo "Caído" ou "Derrotado", e o resumo acessível
  do mapa conta quantos estão em cada estado.

**Testes:** projeção (`defeated` para criatura a 0 PV, `down` para personagem a
0 PV, `up` para token livre); a ficha a 0 PV republica a cena. Stories do
`TokenDisc` e do `MapCanvas` com os três estados.

## 4. Imagem nas criaturas do bestiário

**Dados:** `statblocks.image_asset_id`, chave estrangeira para `assets` com
`on delete set null`, e migração. Upload pela mesma rota de imagem do avatar
(`POST /assets`, normalizada com `sharp`). O servidor confere que o asset é da
campanha, como em `checkAvatar`.

**Interface:**
- O `StatblockForm` ganha o campo de imagem com o mesmo controle do avatar da
  ficha (enviar, trocar, remover). O `StatblockCard` mostra a imagem.
- A leitura do NPC em PDF não traz imagem.

**Token:** `avatarUrl` passa a vir também do statblock: no token de um
combatente com `statblockId` e no token livre copiado do bestiário. A ordem é
avatar do personagem, depois imagem do statblock, depois as iniciais.
Trocar a imagem atualiza os tokens que já estão no mapa.

**Visibilidade:** a imagem só chega ao jogador pelo token visível. O
bestiário continua só do mestre.

**Antes de produção:** vale a [#30](https://github.com/DanielTrindade/quest-fast/issues/30).

**Testes:** integração (o jogador não envia nem troca imagem de statblock e
recebe 404 no bestiário, e um asset de outra campanha é recusado).

## 5. Tamanho do token

Uma criatura Média ocupa uma casa do grid configurado (`tokenDiameter`), mas o
desenho deixa a borda e o anel por dentro, e a cena abre mostrando o mapa
inteiro. Na mesa, o token cobria a casa e mesmo assim parecia pequeno.

**Decisão:**
- O token ocupa a casa inteira, até a borda: o anel passa a ser desenhado sobre
  a borda da casa, não por dentro dela. A área de clique acompanha.
- A cena abre com um zoom que mostra cerca de 15 casas na largura (sem passar
  do mapa inteiro, se ele for menor), centrado no centro do mapa; o encaixe na
  tela continua a um gesto.

## 6. Opacidade do grid, por cena

Hoje a opacidade está fixa: o contorno a 30% e a linha a 60%
(`client/src/lib/map-draw.ts:51-55`).

**Regra:**
- `scenes.grid_opacity` (real, de 0 a 1, padrão 0,6, que é o visual de hoje),
  com migração. O contorno acompanha a linha, na metade da opacidade dela.
- `GridSettings` (o tipo do contrato) ganha `opacity`, e o limite fica em
  `SCENE_LIMITS`.
- 0% esconde as linhas, mas o grid continua valendo para encaixe, alcance e
  custo do movimento. Isso é diferente de desligar o grid.
- É decisão do mestre e igual para todos. Chega aos jogadores por
  `scene.updated`.

**Interface:** no painel de grid, uma barra "Opacidade das linhas" de 0 a
100%, em passos de 5, com o valor ao lado e prévia ao vivo no mapa enquanto
arrasta, como os outros campos. Ela vira um primitivo shadcn novo
(`components/ui/slider.tsx`, com `@radix-ui/react-slider`, dependência nova),
operável pelo teclado.

**Testes:** validação em `shared/`. Integração: o jogador não muda a
opacidade. Story do `GridSettings` com a barra (que passa no
`test:design`).

## Entrega

Os itens não dependem uns dos outros, então são PRs paralelos a partir da
`master`, não empilhados. Cada um traz o próprio teste e a própria story:

1. Salvaguarda sem dano (item 1).
2. Espaços de magia e conjuração no feed (item 2).
3. Bestiário com imagem e token caído ou derrotado (itens 3 e 4, que mexem no mesmo
   desenho e na mesma projeção do token).
4. Grid: opacidade e tamanho do token (itens 5 e 6).

O roadmap ganha a entrada desta entrega no primeiro PR, e esta spec vai para
`docs/history/` nele também.
