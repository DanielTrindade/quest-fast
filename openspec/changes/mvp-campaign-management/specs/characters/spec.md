## ADDED Requirements

### Requirement: Criar personagem dentro da campanha
O sistema SHALL permitir que um membro crie um personagem D&D 5e dentro de uma campanha da qual participa, tornando-se o seu dono.

#### Scenario: Criação com sucesso
- **WHEN** um membro cria um personagem em uma campanha informando raça, classe, nível, atributos (Força, Destreza, Constituição, Inteligência, Sabedoria, Carisma), HP, AC, perícias, ataques/features e descrição
- **THEN** o personagem é criado já pertencente àquela campanha e ao membro que o criou

#### Scenario: Criação por não-membro
- **WHEN** um usuário que não é membro tenta criar um personagem na campanha
- **THEN** o sistema recusa a operação

### Requirement: Modificadores derivados dos atributos
O sistema SHALL calcular o modificador de cada atributo como `floor((valor - 10) / 2)` e associar cada perícia ao seu atributo correspondente por uma lista fixa.

#### Scenario: Cálculo do modificador
- **WHEN** um atributo da ficha recebe um valor
- **THEN** o sistema exibe o modificador correspondente calculado por `floor((valor - 10) / 2)`

### Requirement: Editar personagem
O sistema SHALL permitir que apenas o dono edite a ficha do seu personagem.

#### Scenario: Atualização pelo dono
- **WHEN** o dono edita qualquer campo da ficha
- **THEN** a ficha é atualizada e as rolagens linkadas passam a usar os novos valores

#### Scenario: Edição por outro membro
- **WHEN** outro membro, incluindo o mestre, tenta editar a ficha
- **THEN** o sistema recusa a operação

### Requirement: Leitura pelos membros
O sistema SHALL exibir os personagens da campanha a todos os seus membros.

#### Scenario: Leitura por mestre e jogadores
- **WHEN** um membro abre a lista de personagens da campanha
- **THEN** ele vê os personagens da campanha e pode abrir cada ficha em modo somente leitura

### Requirement: Avatar do personagem
O sistema SHALL permitir que o dono envie uma imagem de avatar para o personagem, respeitando limites de tipo e tamanho.

#### Scenario: Upload válido
- **WHEN** o dono envia uma imagem dentro dos limites de tipo e tamanho aceitos
- **THEN** a imagem é armazenada como asset da campanha e passa a ilustrar o personagem

#### Scenario: Upload recusado
- **WHEN** o arquivo enviado excede o limite de tamanho ou tem tipo não permitido
- **THEN** o sistema recusa o upload e informa o motivo

### Requirement: Excluir personagem
O sistema SHALL permitir que o dono ou o mestre excluam um personagem da campanha.

#### Scenario: Exclusão
- **WHEN** o dono ou o mestre exclui um personagem
- **THEN** o personagem deixa de aparecer na campanha e os eventos já publicados no feed permanecem inalterados
