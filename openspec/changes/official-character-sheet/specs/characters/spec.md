## ADDED Requirements

### Requirement: Identidade conforme a ficha oficial
O sistema SHALL registrar na ficha, além de nome, espécie, classe e nível, o antecedente, a subclasse, os pontos de experiência, o alinhamento e o tamanho do personagem.

#### Scenario: Criação com a identidade completa
- **WHEN** um membro cria um personagem informando antecedente, subclasse, XP, alinhamento e tamanho
- **THEN** a ficha é criada com esses valores e os exibe na consulta

#### Scenario: Identidade parcial
- **WHEN** um membro cria um personagem sem antecedente, subclasse ou alinhamento
- **THEN** a ficha é aceita com esses campos vazios, XP zero e tamanho Médio

#### Scenario: XP fora dos limites
- **WHEN** a ficha informa XP negativo ou acima do máximo aceito
- **THEN** o sistema recusa a ficha com mensagem de erro

### Requirement: Pontos de vida atual, temporário e máximo
O sistema SHALL registrar PV máximo, PV atual e PV temporários, mantendo o PV atual entre zero e o máximo.

#### Scenario: Criação começa com vida cheia
- **WHEN** um membro cria um personagem com PV máximo informado
- **THEN** o PV atual começa igual ao máximo e os PV temporários começam em zero

#### Scenario: Máximo reduzido abaixo do atual
- **WHEN** o dono edita a ficha e informa um PV máximo menor que o PV atual
- **THEN** o PV atual passa a ser igual ao novo máximo

#### Scenario: Resumo com vida atual
- **WHEN** um membro abre a lista de personagens da campanha
- **THEN** cada linha exibe o PV atual sobre o PV máximo e a CA

### Requirement: Estado de sessão alterado só pelo dono
O sistema SHALL permitir que apenas o dono altere o estado de sessão do personagem (PV atual e temporários, dados de vida gastos, salvaguardas contra morte, inspiração heroica, espaços de magia gastos e moedas) sem reenviar a ficha completa.

#### Scenario: Dono registra dano
- **WHEN** o dono informa um novo PV atual dentro dos limites
- **THEN** o estado é salvo e os demais campos da ficha permanecem inalterados

#### Scenario: Outro membro tenta alterar o estado
- **WHEN** outro membro, incluindo o mestre, tenta alterar o estado de sessão do personagem
- **THEN** o sistema recusa a operação e nada é alterado

#### Scenario: Estado fora dos limites
- **WHEN** o estado informa PV atual acima do máximo, dados de vida gastos acima do nível, mais de três sucessos ou falhas contra a morte, espaços gastos acima do total ou moedas negativas
- **THEN** o sistema recusa a alteração com mensagem de erro

### Requirement: Dados de vida e salvaguardas contra morte
O sistema SHALL registrar o tipo do dado de vida do personagem, com máximo igual ao nível, os dados gastos, e até três sucessos e três falhas nas salvaguardas contra morte.

#### Scenario: Dados de vida disponíveis
- **WHEN** um personagem de nível 4 com d12 como dado de vida gastou 1 dado
- **THEN** a ficha exibe 1 dado gasto de 4 dados d12

#### Scenario: Tipo de dado inválido
- **WHEN** a ficha informa um dado de vida diferente de d6, d8, d10 ou d12
- **THEN** o sistema recusa a ficha com mensagem de erro

### Requirement: Valores derivados com ajuste opcional
O sistema SHALL calcular a iniciativa como o modificador de Destreza mais um ajuste, e a percepção passiva como 10 mais o bônus de Percepção mais um ajuste, recalculando ambos quando atributos, nível ou perícias mudam.

#### Scenario: Iniciativa derivada
- **WHEN** um personagem tem Destreza 14 e ajuste de iniciativa zero
- **THEN** a ficha exibe iniciativa +2

#### Scenario: Ajuste de talento
- **WHEN** o dono informa ajuste de iniciativa +4 para um personagem com Destreza 14
- **THEN** a ficha exibe iniciativa +6

#### Scenario: Percepção passiva derivada
- **WHEN** um personagem tem Sabedoria 12, não é proficiente em Percepção e não tem ajuste
- **THEN** a ficha exibe percepção passiva 11

### Requirement: Perícias com especialização
O sistema SHALL permitir marcar cada perícia como não proficiente, proficiente ou especialista, somando ao modificador do atributo nenhum, uma vez ou duas vezes o bônus de proficiência.

#### Scenario: Perícia especialista
- **WHEN** um personagem de nível 3 com Destreza 18 é especialista em Furtividade
- **THEN** a ficha exibe Furtividade +8

#### Scenario: Especialização sem proficiência
- **WHEN** a ficha marca especialização em uma perícia em que o personagem não é proficiente
- **THEN** o sistema recusa a ficha com mensagem de erro

### Requirement: Treinamento em equipamentos
O sistema SHALL registrar o treinamento em armaduras (leve, média, pesada e escudos), as armas e as ferramentas em que o personagem é proficiente, e se o personagem está usando escudo.

#### Scenario: Treinamento registrado
- **WHEN** o dono marca armaduras leve e média e escudos, e informa as armas e ferramentas
- **THEN** a consulta exibe o treinamento exatamente como informado

### Requirement: Ataques com tipo de dano e notas
O sistema SHALL registrar em cada ataque, além de nome, bônus e dano, o tipo de dano e notas livres.

#### Scenario: Ataque completo
- **WHEN** o dono registra um ataque com tipo de dano "Cortante" e nota "Pesada, duas mãos"
- **THEN** a consulta exibe o ataque com o tipo e a nota

#### Scenario: Ataque sem tipo
- **WHEN** o dono registra um ataque sem tipo de dano e sem notas
- **THEN** o ataque é aceito com esses campos vazios

### Requirement: Características de classe, traços de espécie e talentos
O sistema SHALL registrar características de classe, traços de espécie e talentos como listas separadas.

#### Scenario: Listas separadas
- **WHEN** o dono informa características de classe, traços de espécie e talentos
- **THEN** a consulta exibe cada lista na sua seção

### Requirement: Conjuração
O sistema SHALL registrar o atributo de conjuração, os espaços de magia de cada círculo (total e gastos) e a lista de truques e magias preparadas, calculando a CD para evitar a magia como 8 + bônus de proficiência + modificador do atributo + ajuste, e o modificador de ataque mágico como bônus de proficiência + modificador do atributo + ajuste.

#### Scenario: CD e ataque derivados
- **WHEN** um personagem de nível 4 com Sabedoria 16 conjura com Sabedoria e não tem ajuste
- **THEN** a ficha exibe CD 13 e ataque mágico +5

#### Scenario: Personagem que não conjura
- **WHEN** a ficha não tem atributo de conjuração
- **THEN** a ficha não exibe CD nem ataque mágico e não oferece rolar ataque mágico

#### Scenario: Magia registrada
- **WHEN** o dono registra uma magia com círculo, nome, tempo de conjuração, alcance, concentração, ritual, material e notas
- **THEN** a consulta exibe a magia na lista com todos esses dados

#### Scenario: Espaços de magia inválidos
- **WHEN** a ficha informa círculo de magia fora de 0 a 9, total de espaços negativo ou acima do limite do círculo
- **THEN** o sistema recusa a ficha com mensagem de erro

### Requirement: Inventário e personalidade
O sistema SHALL registrar aparência, história e personalidade, idiomas, equipamento, até três itens mágicos sintonizados e moedas (PC, PP, PE, PO e PL).

#### Scenario: Inventário registrado
- **WHEN** o dono informa idiomas, equipamento, dois itens sintonizados e 122 PO
- **THEN** a consulta exibe esses dados

#### Scenario: Sintonização acima do limite
- **WHEN** a ficha informa quatro itens sintonizados
- **THEN** o sistema recusa a ficha com mensagem de erro

### Requirement: Fichas existentes preservadas
O sistema SHALL manter válidas as fichas criadas antes da ficha oficial, preenchendo os campos novos com valores padrão.

#### Scenario: Ficha antiga após a atualização
- **WHEN** um membro abre uma ficha criada antes da ficha oficial
- **THEN** a ficha abre com PV atual igual ao máximo, dado de vida d8, tamanho Médio, campos de texto vazios e sem conjuração
