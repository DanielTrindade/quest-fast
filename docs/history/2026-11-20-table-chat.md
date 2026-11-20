# Chat da mesa

Spec aprovada em 2026-11-20, a partir da
[#138](https://github.com/DanielTrindade/quest-fast/issues/138) (levantada na
conversa de 2026-11-19 sobre o painel da Mesa). O texto abaixo é o da issue;
o fim registra as decisões que ela deixou para quem implementasse e o plano de
entrega.

Spec de design, levantada na conversa de 2026-11-19 sobre o painel da Mesa (Ações, Dados e Feed). Protótipo navegável, com a Mesa inteira e a tela cheia: https://claude.ai/artifact/X7bu6YeQgmZqkWuuGYfwqc

## Área

Mesa · Painel da Mesa · Campo de batalha (VTT) em tela cheia

## Por quê

A mesa joga com chat de voz. A conversa de jogo acontece no áudio, mas falta um lugar para a interação escrita: comentar o que está rolando, mandar uma piada, zoar o 1 natural, avisar "cheguei". O painel da Mesa hoje só tem coisas de jogo (Ações, Dados, Feed). A referência é o chat da Twitch: uma coluna viva, densa e informal.

O chat **não influencia o jogo**: não rola dado, não aplica dano, não muda ficha nem combate. O que acontece no jogo continua no Feed, e nada do Feed entra no chat.

## Objetivos

- Uma aba **Chat** no painel da Mesa, ao lado de Ações, Dados e Feed.
- Mensagens de texto da mesa inteira, em tempo real, com menção, resposta, reações rápidas e remoção.
- O chat também existe com o **mapa em tela cheia**, num painel recolhível (opção C abaixo).

## Fora do escopo

- **Sussurro** ou mensagem privada para o mestre: o chat é aberto para a mesa toda (confirmado).
- **Aviso de menção fora da Mesa** (no item do menu lateral, na barra do celular ou notificação): fica para uma issue própria, porque aumenta o escopo.
- Eventos do jogo no chat, comandos (`/r 1d20`), rolagem pelo chat.
- Markdown, links clicáveis, imagens, edição de mensagem, emotes próprios.

## Antiobjetivos (falhou mesmo se funcionar)

- O chat chamar mais atenção que o jogo: o aviso de "sua vez" e o dano pendente em Ações continuam mais fortes que o contador do chat. Nada pisca.
- O Feed virar um chat ou o chat virar um Feed: os dois não se misturam.
- Uma terceira interface só para a tela cheia: o painel é o mesmo nos dois modos.

## Interface

### Aba Chat no painel (`ActionPanel`)

- Abas: **Ações · Dados · Feed · Chat**. Sem mapa aberto, o Feed vai para o centro (como hoje) e o painel fica com Ações, Dados e Chat.
- Quatro abas cabem em 300 a 340 px. Abaixo de ~330 px de painel, as abas mostram só o ícone (com o nome acessível e a dica).
- Com a aba Chat aberta, o chat ocupa a altura que sobra no painel: a lista rola por dentro e o campo fica preso no rodapé. O painel não rola junto. No celular (painel depois do mapa), a aba tem altura própria, por volta de 70% da tela.
- Como os outros painéis, o Chat fica montado quando escondido: rascunho e posição de leitura sobrevivem à troca de aba.

### Mensagem

- **Linha corrida, como na Twitch:** `[hora] [token] [Mestre] Nome: texto`, sem card por mensagem.
- **Nome é o da pessoa** (conta do Discord), porque é conversa fora do personagem. O token ao lado é o do personagem ativo dela (o `TokenDisc` em ~20 px, com aro de metal e faixa em `accent`); o mestre leva a insígnia **Mestre** (fundo `accent`) e o nome em `accent-text`. O leitor de tela ouve "Nome (joga com Personagem)".
- **Sem nome colorido por pessoa:** o sistema não tem paleta para isso e o lint proíbe cor crua. Se um dia quisermos, é decisão de token registrada em `docs/design-system.md`.
- **Hora** só aparece ao passar o mouse ou focar a linha; o `<time>` está sempre no DOM para o leitor de tela. Usa `formatEventTime` (outro dia mostra "ontem, 18:47").
- **Mensagem só de emoji** (até ~6 emoji) aparece grande, como um emote.
- **Menção** `@Nome` aparece em `accent-text` semibold. A linha que menciona quem lê ganha fundo `accent` fraco e filete à esquerda em `accent-text`.
- **Resposta:** uma citação de uma linha acima da mensagem (`↳ Nome texto…`, cortada com reticências). Não abre conversa em fio.
- **Removida:** fica "Mensagem removida" em itálico, `text-muted`, no lugar do texto.
- Ações da linha (aparecem ao passar o mouse ou focar; sempre visíveis em tela de toque): **Responder**; **Remover** para o autor e para o mestre.
- Nomes longos sem espaço (32 caracteres do Discord) quebram em qualquer ponto (`overflow-wrap:anywhere`), sem vazar da coluna.

### Campo de mensagem

- Reações rápidas acima do campo: 😂 💀 🎲 👀 🔥 🫡. Um toque envia o emoji como mensagem.
- `textarea` de uma linha que cresce até ~4 linhas. **Enter envia, Shift+Enter quebra a linha**, Esc cancela a resposta.
- `@` abre a lista de membros da campanha (combobox: setas, Enter ou Tab escolhem, Esc fecha), com nome e personagem.
- Limite de **300 caracteres**; o contador aparece a partir de 240 e fica em `danger-text` a partir de 290.
- "Respondendo a Nome: texto" acima do campo, com botão para cancelar.
- Envio recusado (limite de frequência, sem conexão): o texto continua no campo e o motivo aparece abaixo dele, em português.

### Seguir o fim e não lidas

- Reaproveitar o comportamento do `FeedFollow`: no fim, a lista desce sozinha; com a lista rolada para cima, aparece a pill **"N novas mensagens"**. A própria mensagem enviada sempre leva ao fim.
- Em outra aba, o Chat mostra o número de não lidas em mono, `text-secondary`. Com menção a quem lê, o número fica em `accent-text`. O texto para leitor de tela vai em `sr-only` ("3 mensagens novas, com menção a você").
- Não lidas são estado local da sessão do navegador (não há "lido" no servidor).

### Estados

- **Vazio:** "A mesa ainda não falou nada. O que você mandar aqui aparece para todos da campanha. Rolagens ficam no Feed."
- **Carregando:** skeleton de linhas.
- **Sem conexão:** o status do socket (como "ao vivo" do Feed) e o campo desabilitado com "Sem conexão com a mesa".
- **Erro ao carregar:** mensagem e "Tentar novamente".

### Tela cheia (opção C)

Hoje a tela cheia (`SceneStage`, `stageLayout`) mostra o mapa e uma coluna de 18rem com, nesta ordem: as ferramentas do mestre abertas pela `MasterBar` (`GridPanel`, `TokenPickerPanel`), o token selecionado (`TokenVitalsPanel`), o turno do token selecionado (`FightTurn`: gastar, devolver e conceder) e a `TokenList` (seleção e movimento por teclado e leitor de tela; esconder e remover para o mestre). O painel da Mesa não vai junto, então em tela cheia não há Ações, Dados, Feed nem Chat.

Proposta:
- A coluna da tela cheia vira o **mesmo painel da Mesa** (`ActionPanel` com turno no topo), com um botão **Recolher painel** no topo e **cinco abas: Mapa · Ações · Dados · Feed · Chat**.
- **A aba Mapa existe só na tela cheia** e guarda exatamente o que a coluna tem hoje, na mesma ordem: ferramentas do mestre, token selecionado, `FightTurn` e `TokenList`. Nada da tela cheia de hoje se perde. Abrir grid ou "Pôr tokens" pela `MasterBar` leva o painel para a aba Mapa (e o expande, se estiver recolhido). Selecionar um token no mapa não troca de aba sozinho.
- Fora da tela cheia, nada muda no `SceneStage`: a coluna ao lado do mapa continua com esse conteúdo e o painel da Mesa continua com quatro abas.
- Cinco abas não cabem com nome em ~340 px: na tela cheia, as abas mostram só o ícone, com o nome na dica (`Tooltip`) e no nome acessível.
- **Recolhido**, vira um **trilho** de ícones (Mapa, Ações, Dados, Feed, Chat e Expandir) de ~52 px. Ações mantém o ponto de vez/dano; Chat mostra o número de não lidas (fundo `accent` com menção). Clicar num ícone expande o painel naquela aba.
- **Com o painel recolhido, as mensagens novas do chat aparecem sobre o mapa**, no canto inferior esquerdo: até 3 de cada vez, em fundo `surface-secret` quase opaco (contraste sobre qualquer mapa), e cada uma some depois de ~8 s. Clicar numa delas, ou em "Abrir o chat", expande o painel no Chat com o foco no campo. Essas mensagens sobre o mapa são `aria-hidden`: quem usa leitor de tela recebe o anúncio pela região `aria-live` da lista, que continua montada.
- Mensagens da própria pessoa não aparecem sobre o mapa.
- No celular (abaixo de 760 px), o painel fica embaixo do mapa (como a coluna de hoje, ~46% da altura) e o trilho recolhido vira uma barra horizontal.
- Recolhido ou aberto é uma preferência guardada no navegador (`useStoredFlag`), como o menu lateral.
- **Estado que atravessa a troca de modo:** a tela cheia torna o resto da página `inert` (`useFullscreenView`), então o painel da tela cheia é montado dentro do palco. Mensagens (cache do TanStack Query), rascunho, resposta em andamento e não lidas do chat ficam no nível da tela da campanha (contexto ou cache), não dentro do componente do painel, para entrar e sair da tela cheia não perder nada. A expressão do Dados pode seguir a mesma regra.

### Movimento (Emil Kowalski)

- Mensagem nova entra com opacidade e 4 px em `--duration-settle` (`@starting-style` ou `animate-in`), só com `motion-safe`. A pill "N novas mensagens" entra de baixo, como no Feed.
- Mensagem sobre o mapa: entra como a da lista; sai com fade de ~300 ms. Com movimento reduzido, só aparece e some.
- Trocar de aba e recolher/expandir o painel não animam (navegação frequente). Botões encolhem para 0,97 ao pressionar, como no resto.

## Servidor

- **Tabela própria `chat_messages`**, não `session_events`: o Feed paginado continua só com o jogo, e o chat tem retenção própria. Colunas: `id`, `campaign_id` (cascade), `user_id`, `body` (texto puro), `reply_to_id` (nullable, mesma campanha), `removed_at` (nullable), `removed_by` (nullable), `created_at`; índice `(campaign_id, created_at)`. Migração gerada com `npm run db:generate`.
- **Retenção: as últimas 500 mensagens por campanha.** Ao inserir, o servidor apaga as mais antigas além disso.
- **Rotas** (todas 404 para quem não é membro):
  - `GET /api/campaigns/:id/chat?cursor=` — página das mais recentes (mesmo esquema de cursor do feed).
  - `POST /api/campaigns/:id/chat` — `{ body, replyToId? }`. Valida: texto aparado de 1 a 300 caracteres; `replyToId` da mesma campanha.
  - `DELETE /api/campaigns/:id/chat/:messageId` — autor ou mestre; outro jogador recebe 403 (ele é membro e vê a mensagem). Marca `removed_at` e apaga o texto.
- **Limite de frequência** por pessoa e campanha (por exemplo, 5 mensagens a cada 5 s), com 429 e `error` em português ("Calma: espere um instante antes da próxima mensagem."). Pode reaproveitar o desenho do `createAttemptLimiter` de `invites/`.
- **Tempo real:** `SocketMessage` ganha `{ type: 'chat.message'; message: ChatMessageView }` e `{ type: 'chat.removed'; messageId: string }`, enviados a todos os membros conectados. O texto removido nunca é reenviado.
- **Menções** são resolvidas no servidor **no envio**, contra os membros daquele momento, e guardadas como ids (`mentions: userId[]` na view). O texto guarda só o `@Nome`. Trocar de nome no Discord depois não muda o destaque; dois membros com o mesmo nome são mencionados juntos; com nomes em que um é prefixo do outro, vence o mais longo.
- Tipos e validação compartilhados em `shared/` (com teste unitário): `ChatMessageView`, limite de 300, detecção de menção.

## Testes esperados

- **Integração de RBAC:** quem não é membro recebe 404 em listar, enviar e remover; jogador não remove mensagem de outro jogador; mestre remove qualquer uma; mensagem removida não devolve o texto em `GET` nem no socket.
- Validação: vazio, só espaços, 301 caracteres, `replyToId` de outra campanha.
- Retenção: a 501ª mensagem apaga a mais antiga.
- Limite de frequência: a mensagem acima do limite recebe 429 e a seguinte, depois da janela, passa.
- `shared/`: menção com nome de 32 caracteres sem espaço, nome com emoji e acento, dois membros em que um nome é prefixo do outro ("Ana" e "Ana Clara").
- **Storybook primeiro:** `ChatPanel` (presentacional) com stories de lista cheia, vazio, menção, resposta, removida, pior caso de nomes, sem conexão, e o painel em tela cheia aberto (com a aba Mapa, para mestre e jogador) e recolhido com mensagens sobre o mapa. `npm run test:design` verde. Dados extremos: a Mesa com chat.
- Regressão da tela cheia: a `TokenList` continua movendo token pelo teclado na aba Mapa, e grid e "Pôr tokens" do mestre continuam funcionando.

## Decisões registradas

- Chat só de interação; eventos do jogo ficam no Feed (2026-11-19).
- Histórico: as últimas 500 mensagens por campanha.
- Sem sussurro; aviso de menção fora da Mesa em issue separada.
- Tela cheia: opção C (painel recolhível + mensagens sobre o mapa quando recolhido), com a aba Mapa só na tela cheia para não perder a coluna atual.
- Sem nome colorido por pessoa; identidade pelo token e pela insígnia Mestre.

## Para o implementador

Decisões menores deixadas em aberto, sem mudar o que é construído:
- Formato exato do cursor e tamanho da página.
- Se a citação de uma resposta guarda uma cópia curta do texto citado (sobrevive à retenção e à remoção) ou faz junção com a mensagem original. Se citar uma mensagem removida, a citação mostra "Mensagem removida".
- Limite exato de frequência.
- Ordem das stories e nome dos componentes.

## Ordem sugerida

1. `shared/`: tipos, validação e menção, com teste.
2. `db` + `server`: tabela, rotas, socket, retenção e limite, com testes de RBAC.
3. `ChatPanel` no Storybook e a aba no `ActionPanel`.
4. Tela cheia: painel com a aba Mapa, recolhível, trilho e mensagens sobre o mapa.
5. `docs/design-system.md` (seção do Chat e da tela cheia) e `docs/roadmap.md`.



## Decisões de implementação (2026-11-20)

- **Citação de resposta:** junção com a mensagem original na leitura, sem
  cópia do texto. `reply_to_id` vira `null` quando a retenção apaga a
  original, e a citação some; citar uma mensagem removida mostra "Mensagem
  removida".
- **Menções na view:** além dos ids, o servidor guarda onde cada menção está
  no texto (`mentions: { userId, start, end }[]`). O destaque segue o que foi
  resolvido no envio, mesmo depois de alguém trocar de nome.
- **Limite de frequência:** 5 mensagens aceitas a cada 5 s, por pessoa e
  campanha.
- **Cursor e página:** o mesmo esquema do Feed (id da mensagem, desempate por
  `rowid`), 50 mensagens por página.
- **Token ao lado do nome:** o do personagem ativo da pessoa na hora da
  leitura.
- **Tamanho da mensagem:** contado em caracteres como a pessoa conta (um
  emoji ou uma letra acentuada é um).

## Entrega

1. `shared/`: tipos, validação, menção e emote, com teste.
2. `db` + `server`: tabela, rotas, socket, retenção e limite, com testes de RBAC.
3. Componentes: `ChatPanel` no Storybook e a aba no `ActionPanel`.
4. Telas: cache, socket e a aba Chat na Mesa, com o estado no nível da campanha.
5. Tela cheia: painel com a aba Mapa, recolhível, trilho e mensagens sobre o mapa; `docs/design-system.md` e `docs/roadmap.md`.
