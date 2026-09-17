# Guia básico — D&D 5e 100% online e gratuito

> Estudo inicial para montar uma campanha de D&D 5e totalmente online, usando **Discord como central da mesa** e ferramentas gratuitas para voz, fichas, mapas, dados, combate, organização e diário da campanha.
>
> Revisado em: **setembro de 2026**
>
> **Nota histórica:** este estudo foi escrito antes do quest-fast. A direção
> atual do produto vive em `openspec/`: a plataforma **é a mesa** e o Discord
> fica apenas com voz e roleplay, sem integração além do login.

---

## 1. Objetivo

A ideia é substituir boa parte do que normalmente seria concentrado no **D&D Beyond** por um conjunto de ferramentas gratuitas.

O ambiente deve oferecer:

- comunicação por voz;
- chat entre jogadores e mestre;
- calendário das sessões;
- rolagem de dados;
- fichas digitais;
- iniciativa e acompanhamento de combate;
- mapas;
- tokens;
- fog of war;
- iluminação dinâmica, quando possível;
- gerenciamento de NPCs;
- quests;
- lugares;
- lore;
- diário das sessões;
- handouts;
- organização de regras da casa;
- canais privados do mestre;
- acesso simples para os jogadores.

O **Discord será o hub principal**. As demais ferramentas funcionam como serviços auxiliares.

---

# 2. Stack recomendada

## Opção recomendada — modular e praticamente 100% gratuita

```text
                         ┌──────────────────────┐
                         │       DISCORD        │
                         │                      │
                         │ Voz / vídeo / chat   │
                         │ agenda / handouts    │
                         │ organização da mesa  │
                         └──────────┬───────────┘
                                    │
                  ┌─────────────────┼─────────────────┐
                  │                 │                 │
                  ▼                 ▼                 ▼
           ┌────────────┐    ┌─────────────┐   ┌────────────┐
           │   Avrae    │    │   Kanka     │   │  Owlbear   │
           │            │    │             │   │   Rodeo    │
           │ dados      │    │ campanha    │   │            │
           │ iniciativa │    │ NPCs        │   │ mapas      │
           │ combate    │    │ locais      │   │ tokens     │
           │ automação  │    │ lore        │   │ combate    │
           └─────┬──────┘    └─────────────┘   └────────────┘
                 │
                 ▼
           ┌────────────┐
           │ DiceCloud  │
           │            │
           │ fichas     │
           │ D&D 5e     │
           └────────────┘
```

### Ferramentas

| Necessidade | Ferramenta |
|---|---|
| Comunicação | Discord |
| Voz | Discord |
| Vídeo | Discord |
| Compartilhamento de tela | Discord |
| Organização do grupo | Discord |
| Agenda das sessões | Discord Events |
| Dados | Avrae |
| Iniciativa | Avrae |
| Combate automatizado | Avrae |
| Fichas | DiceCloud |
| Mapas | Owlbear Rodeo |
| Tokens | Owlbear Rodeo |
| Fog of War | Owlbear Rodeo |
| Campanha / lore | Kanka |
| NPCs | Kanka |
| Locais | Kanka |
| Quests | Kanka |
| Diário | Kanka + Discord |
| Regras da casa | Discord + Kanka |

---

# 3. Discord como central da campanha

Site:

https://discord.com/

O Discord deve ser o ponto de entrada da campanha.

O jogador não precisa ficar tentando lembrar:

> "Onde estava aquele link mesmo?"

Tudo deve partir do Discord.

Exemplo:

```text
Discord
   |
   ├── Link da ficha
   ├── Link do mapa
   ├── Link da campanha
   ├── Calendário
   ├── Regras
   ├── Diário
   └── Voz
```

O Discord possui canais de voz e também compartilhamento de tela.

Documentação:

https://support.discord.com/hc/pt-br/articles/360040816151-Transmiss%C3%B5es-e-compartilhamento-de-tela

Também possui **Eventos Agendados**, que podem ser utilizados para marcar as sessões.

Documentação:

https://support.discord.com/hc/pt-br/articles/4409494125719-Eventos-Agendados

---

# 4. Estrutura recomendada do servidor Discord

Uma estrutura inicial pode ser:

```text
📌 INFORMAÇÕES
│
├── #boas-vindas
├── #regras-da-mesa
├── #links-importantes
├── #calendario
└── #avisos

🎲 CAMPANHA
│
├── #geral
├── #roleplay
├── #dados
├── #combate
├── #diario-da-campanha
├── #quests
├── #npc-conhecidos
└── #loot

🧙 PERSONAGENS
│
├── #personagens
├── #backstories
└── #level-up

🗺️ MUNDO
│
├── #mapas
├── #locais
├── #lore
└── #faccoes

🎭 OFF-TOPIC
│
├── #geral-off
├── #memes
└── #outros-jogos

🔊 SESSÃO
│
├── 🔊 Mesa
├── 🔊 Intervalo
└── 🔊 Mestre + Jogador

🔒 MESTRE
│
├── #planejamento
├── #npc-secretos
├── #encontros
├── #loot-secreto
└── #anotacoes
```

---

# 5. Cargos

Sugestão:

```text
👑 Mestre
🎲 Jogador
🧙 Personagem
👁️ Espectador
🤖 Bot
```

O cargo **Mestre** deve ter acesso aos canais privados.

Jogadores não devem enxergar:

```text
🔒 MESTRE
├── planejamento
├── encontros
├── npc-secretos
└── loot-secreto
```

---

# 6. Canal #links-importantes

Esse canal deve funcionar como uma espécie de "homepage" da campanha.

Exemplo:

```text
🎲 MESA

Mapa / VTT:
https://www.owlbear.rodeo/

Campanha:
https://kanka.io/

Ficha:
https://dicecloud.com/

Dados e combate:
Use o Avrae no canal #dados ou #combate.

Calendário:
Veja os Eventos do Discord.
```

Fixar essa mensagem evita confusão.

---

# 7. Avrae

Site:

https://avrae.io/

Comandos:

https://avrae.io/commands

O **Avrae** é um bot do Discord desenvolvido especificamente para D&D.

Ele pode cuidar de:

- dados;
- testes;
- ataques;
- saving throws;
- iniciativa;
- HP;
- AC;
- efeitos;
- resistências;
- combate;
- magias;
- integração com fichas.

Uma das principais vantagens é que ele consegue ler personagens de:

- D&D Beyond;
- DiceCloud;
- Google Sheets.

Isso torna **DiceCloud + Avrae** uma combinação especialmente interessante.

---

# 8. Exemplos básicos do Avrae

## Rolagem simples

```text
!roll 1d20
```

ou:

```text
!r 1d20
```

---

## Rolagem com modificador

```text
!r 1d20+5
```

---

## Dano

```text
!r 2d6+3
```

---

## Vantagem

O Avrae possui suporte a vantagem, desvantagem, críticos e expressões de dados mais complexas.

Documentação:

https://avrae.io/

---

# 9. Combate com Avrae

O Avrae possui um sistema de iniciativa.

Para iniciar:

```text
!init begin
```

Adicionar combatante manualmente:

```text
!init add 2 Goblin
```

Avançar turno:

```text
!init next
```

Encerrar combate:

```text
!init end
```

Documentação:

https://avrae.io/commands

O sistema também pode controlar:

- HP;
- AC;
- condições;
- resistências;
- ataques;
- magias.

---

# 10. Canal exclusivo para combate

Recomendo criar:

```text
#combate
```

E deixar o Avrae trabalhar principalmente nele.

Assim:

```text
#geral
Jogadores conversam.

#roleplay
Interações narrativas.

#dados
Rolagens casuais.

#combate
Avrae + iniciativa + ataques.
```

Isso evita que o chat principal vire uma parede de mensagens de bot.

---

# 11. DiceCloud

Site:

https://dicecloud.com/

Código-fonte:

https://github.com/ThaumRystra/DiceCloud

O DiceCloud é um gerenciador digital de personagens para **D&D 5e**.

O projeto se descreve como uma ficha:

- gratuita;
- auditável;
- em tempo real;
- voltada para D&D 5e.

Ele é open source.

Uma vantagem importante para esta arquitetura é a integração com o **Avrae**.

---

# 12. Fluxo DiceCloud + Avrae

```text
DiceCloud
    │
    │ ficha
    ▼
Avrae
    │
    ├── ataque
    ├── atributo
    ├── save
    ├── magia
    └── combate
```

O jogador mantém sua ficha no DiceCloud.

Durante a sessão, usa o Discord.

Por exemplo:

```text
Discord
   ↓
Avrae
   ↓
DiceCloud
```

Isso reduz bastante a necessidade de ficar abrindo a ficha para cada teste.

---

# 13. Owlbear Rodeo

Site:

https://www.owlbear.rodeo/

Documentação:

https://docs.owlbear.rodeo/

O **Owlbear Rodeo** é uma VTT — Virtual Tabletop.

Ele é focado em ser simples.

É especialmente interessante para mesas que não querem perder muito tempo configurando automações.

Pode ser utilizado para:

- mapas;
- tokens;
- grid;
- cenas;
- fog of war;
- medição;
- extensões;
- organização visual do combate.

Jogadores podem entrar em uma sala utilizando o link enviado pelo mestre.

O Owlbear também suporta usuários anônimos para entrar em uma sala, portanto um jogador não necessariamente precisa criar conta apenas para participar.

Documentação:

https://docs.owlbear.rodeo/docs/rooms/

---

# 14. Limitação do plano gratuito do Owlbear

O plano gratuito possui armazenamento em nuvem limitado.

A documentação atual indica um nível gratuito com aproximadamente:

```text
200 MB de armazenamento
```

Para uma campanha normal isso pode ser suficiente se o mestre:

- otimizar mapas;
- apagar mapas que não serão reutilizados;
- utilizar WEBP/JPEG;
- evitar imagens gigantes.

---

# 15. Como usar Owlbear + Discord

O Discord continua sendo a sala da sessão.

O Owlbear funciona apenas como tabuleiro.

```text
Discord
│
│ voz
│ vídeo
│ chat
│ dados
│
└──── Owlbear
       │
       ├── mapa
       ├── tokens
       ├── grid
       ├── fog
       └── combate visual
```

Isso é melhor do que tentar substituir o Discord pela VTT.

---

# 16. Kanka

Site:

https://kanka.io/pt-BR

Preços:

https://kanka.io/pt-BR/pricing

Funcionalidades:

https://kanka.io/features

O Kanka funciona como a **Wiki da campanha**.

É onde o mestre pode organizar o mundo.

Exemplo:

```text
Campanha
│
├── Personagens
│
├── NPCs
│
├── Locais
│   ├── cidades
│   ├── reinos
│   └── masmorras
│
├── Organizações
│
├── Facções
│
├── Quests
│
├── Itens
│
├── Calendário
│
├── Eventos
│
└── Diário
```

O plano gratuito atualmente oferece:

- campanhas ilimitadas;
- entradas ilimitadas;
- principais funcionalidades;
- controle de acesso;
- campanhas privadas.

O plano gratuito não é apresentado como trial.

---

# 17. Kanka como fonte oficial da campanha

Uma regra interessante é considerar o Kanka como:

> **fonte oficial de informações do mundo**

Por exemplo:

```text
Discord
"Ouvi falar daquele NPC."

        ↓

Kanka
"Edgar, ferreiro de Neverwinter"

        ↓

Informações públicas
- profissão
- aparência
- local
- relação com o grupo
```

Enquanto o mestre possui informações adicionais ocultas.

---

# 18. Quest Portal

Site:

https://www.questportal.com/

Preços:

https://www.questportal.com/pricing

O Quest Portal é outra opção interessante porque tenta concentrar várias funções em uma plataforma.

O plano gratuito atualmente oferece:

- campanhas ilimitadas;
- personagens ilimitados;
- mapas;
- tokens;
- fog of war;
- cenas com música;
- iluminação dinâmica;
- notas colaborativas.

O plano gratuito é anunciado como:

```text
Free forever
```

Sem necessidade de cartão.

---

# 19. Quest Portal como alternativa ao Owlbear

Uma arquitetura mais simples pode ser:

```text
Discord
   │
   ├── voz
   ├── vídeo
   ├── chat
   ├── agenda
   └── Avrae
          │
          │
Quest Portal
   │
   ├── mapa
   ├── tokens
   ├── personagens
   ├── notas
   └── cenas
```

Isso diminui a quantidade de serviços utilizados.

---

# 20. Quest Portal vs Owlbear

| Característica | Quest Portal | Owlbear |
|---|---:|---:|
| Mapas | ✅ | ✅ |
| Tokens | ✅ | ✅ |
| Fog of War | ✅ | ✅ |
| Iluminação dinâmica | ✅ | ✅ |
| Personagens | ✅ | ⚠️ não é o foco |
| Notas | ✅ | ⚠️ |
| Campanha | ✅ | ❌ |
| Interface simples | ✅ | ✅✅ |
| VTT dedicada | ✅ | ✅✅ |
| Integração direta DiceCloud + Avrae | ❌ | independente |

### Escolha sugerida

Se quiser **simplicidade no mapa**:

```text
Owlbear Rodeo
```

Se quiser **concentrar mais coisas na VTT**:

```text
Quest Portal
```

---

# 21. Roll20

Site:

https://roll20.net/

Comparação de funcionalidades:

https://help.roll20.net/hc/en-us/articles/360037774633-Feature-Breakdown

O Roll20 também pode assumir o papel de VTT.

O plano gratuito oferece recursos como:

- jogos;
- jogadores;
- mapas;
- fichas;
- armazenamento limitado;
- fog of war;
- suporte a muitos sistemas.

É uma solução mais tradicional e possui um ecossistema enorme.

---

# 22. Por que não colocaria Roll20 como primeira opção

Não significa que o Roll20 seja ruim.

Ele é bastante completo.

Porém, para uma mesa usando Discord como central:

```text
Discord + Owlbear + Avrae
```

costuma deixar cada ferramenta fazendo uma coisa específica.

Roll20 pode acabar duplicando:

- chat;
- ficha;
- dados;
- comunicação;
- gerenciamento de personagens.

Além de possuir uma interface mais carregada.

---

# 23. Comparação resumida

| Ferramenta | Campanha | Ficha | Mapas | Dados | Combate | Voz |
|---|---:|---:|---:|---:|---:|---:|
| Discord | ⚠️ | ❌ | ❌ | ⚠️ | ⚠️ | ✅ |
| Avrae | ❌ | integração | ❌ | ✅✅ | ✅✅ | ❌ |
| DiceCloud | ❌ | ✅✅ | ❌ | ⚠️ | ⚠️ | ❌ |
| Owlbear | ❌ | ❌ | ✅✅ | ⚠️ | ✅ visual | ❌ |
| Kanka | ✅✅ | ⚠️ | ⚠️ | ❌ | ❌ | ❌ |
| Quest Portal | ✅ | ✅ | ✅✅ | ✅ | ✅ | ❌ |
| Roll20 | ✅ | ✅ | ✅ | ✅ | ✅ | ⚠️ |

---

# 24. Melhor arquitetura para a campanha

Minha recomendação principal seria:

```text
┌───────────────────────────────┐
│            DISCORD            │
│                               │
│ comunicação                   │
│ voz                           │
│ vídeo                         │
│ calendário                    │
│ avisos                        │
│ roleplay                      │
│ handouts                      │
└──────────────┬────────────────┘
               │
               │
        ┌──────┴───────┐
        │    AVRAE     │
        │              │
        │ dados        │
        │ iniciativa   │
        │ ataques      │
        │ combate      │
        └──────┬───────┘
               │
               │
        ┌──────▼───────┐
        │  DICECLOUD   │
        │              │
        │ fichas 5e    │
        └──────────────┘


        ┌──────────────┐
        │   OWLBEAR    │
        │              │
        │ mapas        │
        │ tokens       │
        │ fog          │
        └──────────────┘


        ┌──────────────┐
        │    KANKA     │
        │              │
        │ campanha     │
        │ NPCs         │
        │ locais       │
        │ quests       │
        │ lore         │
        └──────────────┘
```

---

# 25. Responsabilidade de cada ferramenta

Uma regra importante:

> Cada ferramenta deve ter uma responsabilidade clara.

### Discord

```text
O que está acontecendo agora?
```

- comunicação;
- sessão;
- agenda;
- conversa;
- roleplay;
- avisos.

### Kanka

```text
O que existe no mundo?
```

- NPCs;
- cidades;
- facções;
- história;
- quests;
- lore.

### DiceCloud

```text
Quem é meu personagem?
```

- atributos;
- habilidades;
- equipamentos;
- recursos;
- ficha.

### Avrae

```text
O que aconteceu mecanicamente?
```

- dados;
- testes;
- ataques;
- iniciativa;
- combate.

### Owlbear

```text
Onde estamos?
```

- mapa;
- posição;
- tokens;
- áreas;
- distâncias.

---

# 26. Fluxo de uma sessão

## Antes da sessão

O mestre:

```text
1. Prepara o encontro.
2. Adiciona NPCs ao Kanka.
3. Prepara mapa no Owlbear.
4. Cria evento no Discord.
5. Publica resumo da sessão anterior.
```

---

## Começo da sessão

Jogadores entram em:

```text
Discord → canal de voz Mesa
```

O mestre publica:

```text
#sessao

Mapa:
[link Owlbear]

Campanha:
[link Kanka]
```

---

## Durante exploração

Usar:

```text
Discord → voz
Kanka → informações
Owlbear → mapa, se necessário
```

---

## Durante testes

Usar:

```text
Discord
   ↓
Avrae
```

Exemplo:

```text
!r 1d20+5
```

---

## Durante combate

```text
Discord
│
├── voz
│
├── Avrae
│      ├── iniciativa
│      ├── ataques
│      └── HP
│
└── Owlbear
       ├── mapa
       ├── tokens
       └── posições
```

---

## Depois da sessão

Criar no Discord:

```text
#diario-da-campanha

Sessão 05 — A Torre Abandonada

- grupo chegou à torre;
- encontrou o mago;
- descobriu o símbolo;
- derrotou os goblins;
- encontrou a chave.
```

Depois transformar as informações importantes em entradas permanentes no Kanka.

---

# 27. Organização do diário

Uma estrutura boa:

```text
Sessão 01 — título
Data:

Participantes:

Resumo:

NPCs encontrados:

Locais descobertos:

Itens encontrados:

Quests iniciadas:

Quests concluídas:

Decisões importantes:

Gancho para próxima sessão:
```

---

# 28. Roleplay fora da sessão

Uma vantagem interessante do Discord é permitir roleplay assíncrono.

Criar:

```text
#roleplay
```

Exemplo:

```text
Jogador:
Thorin procura o ferreiro depois que o restante do grupo vai dormir.

Mestre:
Ao entrar na oficina você percebe que o fogo ainda está aceso...
```

Isso permite continuar pequenas interações entre sessões.

---

# 29. Fóruns do Discord

Outra possibilidade é habilitar **Community** no servidor e utilizar canais de fórum.

Documentação:

https://support.discord.com/hc/en-us/articles/6208479917079-Forum-Channels-FAQ

Eles podem ser interessantes para:

```text
🧙 personagens
📝 quests
📖 diário
🗺️ locais
```

Cada tópico vira uma postagem independente.

Por exemplo:

```text
#quests

[ATIVA] O desaparecimento do ferreiro

[CONCLUÍDA] As ruínas do norte

[FALHOU] O comboio perdido
```

---

# 30. Calendário de sessões

Usar o sistema de eventos do próprio Discord.

Exemplo:

```text
🎲 D&D — Sessão 07
Sábado
20:00
Canal: 🔊 Mesa
```

Jogadores podem marcar interesse e receber aviso quando o evento começar.

Documentação:

https://support.discord.com/hc/pt-br/articles/4409494125719-Eventos-Agendados

---

# 31. Estrutura para personagens

No canal:

```text
#personagens
```

cada jogador pode publicar:

```text
## Thorin Ironforge

Jogador: Daniel

Raça: Anão
Classe: Guerreiro
Nível: 3

Ficha:
https://dicecloud.com/...

Retrato:
[imagem]

História:
[resumo]

Objetivo:
Encontrar seu irmão desaparecido.
```

---

# 32. Handouts

Criar:

```text
#handouts
```

Pode conter:

- cartas;
- mapas;
- documentos;
- símbolos;
- imagens;
- pistas;
- mensagens encontradas.

O mestre pode compartilhar a imagem diretamente no Discord.

---

# 33. Música

Existem várias possibilidades:

```text
Discord
Quest Portal
Owlbear + extensões
```

Como bots de música podem mudar bastante ao longo do tempo devido às regras das plataformas, o ideal é escolher um bot mantido ativamente quando a campanha for configurada.

O Quest Portal já inclui suporte a cenas com música no plano gratuito atualmente.

---

# 34. O que realmente precisa ser criado

Para começar não é necessário configurar tudo.

## MVP da mesa

Instalar/configurar apenas:

```text
Discord
Avrae
Owlbear
DiceCloud
```

Depois adicionar:

```text
Kanka
```

quando o mundo começar a crescer.

---

# 35. Configuração inicial — checklist

## Discord

- [ ] criar servidor;
- [ ] criar cargo Mestre;
- [ ] criar cargo Jogador;
- [ ] criar canais;
- [ ] criar canal privado do mestre;
- [ ] criar canal de voz Mesa;
- [ ] criar eventos;
- [ ] fixar links importantes.

## Avrae

- [ ] adicionar bot;
- [ ] testar `!roll 1d20`;
- [ ] criar canal `#dados`;
- [ ] criar canal `#combate`;
- [ ] testar iniciativa.

## DiceCloud

- [ ] jogadores criam conta;
- [ ] cada jogador cria personagem;
- [ ] configurar ficha;
- [ ] integrar personagem ao Avrae;
- [ ] testar ataque;
- [ ] testar saving throw.

## Owlbear

- [ ] mestre cria conta;
- [ ] criar room;
- [ ] adicionar mapa;
- [ ] configurar grid;
- [ ] criar tokens;
- [ ] testar fog;
- [ ] enviar link aos jogadores.

## Kanka

- [ ] criar campanha;
- [ ] adicionar jogadores;
- [ ] criar locais principais;
- [ ] criar NPCs principais;
- [ ] cadastrar quests;
- [ ] registrar sessão zero.

---

# 36. Preparação da Sessão Zero

A Sessão Zero deve definir:

```text
Sistema:
D&D 5e

Plataforma:
Discord

Mapa:
Owlbear Rodeo

Ficha:
DiceCloud

Dados:
Avrae

Campanha:
Kanka
```

Também combinar:

- frequência;
- horário;
- duração;
- faltas;
- regras da casa;
- criação de personagens;
- PvP;
- metagaming;
- conteúdo sensível;
- comportamento na mesa;
- forma de level up;
- uso de homebrew.

---

# 37. Regra de ouro para links

O jogador nunca deveria precisar procurar um link antigo no histórico.

Criar:

```text
#links-importantes
```

e fixar:

```text
🎲 CAMPANHA

🌐 Kanka
[link]

🗺️ Mesa
[link Owlbear]

🧙 Fichas
[links DiceCloud]

📅 Próxima sessão
[Evento Discord]

🎲 Dados
#dados

⚔️ Combate
#combate
```

---

# 38. Alternativa mais simples

Se cinco ferramentas parecerem demais:

```text
Discord
+
Quest Portal
+
Avrae
```

Pode ser suficiente.

### Discord

- comunicação;
- calendário;
- voz;
- organização.

### Quest Portal

- mapas;
- personagens;
- tokens;
- notas;
- cenas;
- fog;
- iluminação.

### Avrae

- dados;
- iniciativa;
- combate.

---

# 39. Alternativa mais organizada

Se a campanha tiver bastante lore:

```text
Discord
+
Quest Portal
+
Kanka
+
Avrae
```

Ou:

```text
Discord
+
Owlbear
+
DiceCloud
+
Kanka
+
Avrae
```

---

# 40. Minha recomendação

Para uma campanha de **D&D 5e full online**, eu começaria com:

```text
Discord
   +
Avrae
   +
DiceCloud
   +
Owlbear Rodeo
   +
Kanka
```

### Motivo

Cada ferramenta possui uma responsabilidade clara.

```text
Discord   → comunicação
Avrae     → mecânica
DiceCloud → personagem
Owlbear   → tabuleiro
Kanka     → mundo
```

Isso evita depender de uma única plataforma.

Também permite trocar uma peça futuramente.

Por exemplo:

```text
Owlbear → Foundry
```

sem precisar reconstruir o Discord ou as fichas.

---

# 41. Evolução futura

Se a campanha crescer, uma possível evolução seria:

```text
ETAPA 1

Discord
Avrae
DiceCloud
Owlbear
Kanka
```

Depois:

```text
ETAPA 2

Discord
Avrae
DiceCloud
Foundry VTT
Kanka
```

O **Foundry VTT** não entra na proposta inicial porque normalmente envolve uma licença paga, embora possa ser hospedado pelo próprio mestre.

Site:

https://foundryvtt.com/

---

# 42. Observação sobre conteúdo oficial de D&D

Uma distinção importante:

As ferramentas gratuitas podem substituir grande parte da **infraestrutura** do D&D Beyond.

Por exemplo:

- ficha;
- dados;
- mapa;
- combate;
- organização;
- comunicação.

Porém isso não significa que todos os livros comerciais de D&D estejam disponíveis gratuitamente.

Conteúdo proprietário publicado pela Wizards of the Coast continua sujeito às respectivas licenças e compras.

Para uma campanha gratuita é possível utilizar:

- conteúdo oficialmente liberado;
- regras abertas disponíveis para uso;
- conteúdo próprio;
- homebrew;
- material que o grupo possua legalmente.

---

# 43. Links

## Discord

Site:

https://discord.com/

Suporte:

https://support.discord.com/

Compartilhamento de tela:

https://support.discord.com/hc/pt-br/articles/360040816151-Transmiss%C3%B5es-e-compartilhamento-de-tela

Eventos:

https://support.discord.com/hc/pt-br/articles/4409494125719-Eventos-Agendados

Fóruns:

https://support.discord.com/hc/en-us/articles/6208479917079-Forum-Channels-FAQ

---

## Avrae

Site:

https://avrae.io/

Comandos:

https://avrae.io/commands

---

## DiceCloud

Site:

https://dicecloud.com/

GitHub:

https://github.com/ThaumRystra/DiceCloud

---

## Owlbear Rodeo

Site:

https://www.owlbear.rodeo/

Documentação:

https://docs.owlbear.rodeo/

Rooms:

https://docs.owlbear.rodeo/docs/rooms/

Planos:

https://www.owlbear.rodeo/pricing

---

## Kanka

Site:

https://kanka.io/pt-BR

Funcionalidades:

https://kanka.io/features

Planos:

https://kanka.io/pt-BR/pricing

---

## Quest Portal

Site:

https://www.questportal.com/

Planos:

https://www.questportal.com/pricing

---

## Roll20

Site:

https://roll20.net/

Funcionalidades e planos:

https://help.roll20.net/hc/en-us/articles/360037774633-Feature-Breakdown

---

## Foundry VTT

Site:

https://foundryvtt.com/

---

# 44. Resumo final

A arquitetura proposta é:

```text
                    INTERNET
                       │
                       ▼
                ┌─────────────┐
                │   DISCORD   │
                └──────┬──────┘
                       │
        ┌──────────────┼──────────────┐
        │              │              │
        ▼              ▼              ▼
     AVRAE          OWLBEAR         KANKA
        │
        ▼
    DICECLOUD
```

Com ela temos:

| Recurso | Solução |
|---|---|
| Voz | Discord |
| Vídeo | Discord |
| Chat | Discord |
| Agenda | Discord Events |
| Roleplay | Discord |
| Dados | Avrae |
| Iniciativa | Avrae |
| Combate | Avrae + Owlbear |
| Ficha | DiceCloud |
| Mapas | Owlbear |
| Tokens | Owlbear |
| Fog | Owlbear |
| NPCs | Kanka |
| Quests | Kanka |
| Lore | Kanka |
| Diário | Discord + Kanka |
| Handouts | Discord |
| Custo inicial | **R$ 0** |

Essa estrutura oferece uma base bastante completa para uma mesa de **D&D 5e totalmente online**, mantendo o Discord como a interface principal para os jogadores e utilizando serviços especializados apenas quando necessário.
