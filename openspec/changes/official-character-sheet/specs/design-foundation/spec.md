## ADDED Requirements

### Requirement: Ficha organizada como a ficha oficial
O sistema SHALL apresentar a consulta da ficha na organização da ficha oficial de D&D 2024: identidade e combate no topo, cada atributo com a sua salvaguarda e as suas perícias, ataques, características, e uma área separada para conjuração e outra para inventário e personalidade.

#### Scenario: Perícias sob o atributo
- **WHEN** um membro abre a ficha de um personagem
- **THEN** cada atributo exibe valor, modificador, salvaguarda e as perícias que dependem dele, com a marcação de proficiência ou especialização

#### Scenario: Áreas da segunda página
- **WHEN** um membro navega para conjuração ou para inventário e personalidade
- **THEN** a ficha exibe essa área sem perder a identificação do personagem

### Requirement: Controles rápidos de estado na consulta
O sistema SHALL oferecer ao dono, na consulta da ficha, controles para registrar dano, cura e PV temporários, dados de vida gastos, salvaguardas contra morte, inspiração heroica, espaços de magia gastos e moedas, sem abrir o editor; aos demais membros esses valores aparecem apenas para leitura.

#### Scenario: Dano registrado na consulta
- **WHEN** o dono registra 7 de dano em um personagem com 5 PV temporários e 30 PV atuais
- **THEN** os PV temporários vão a zero, o PV atual vai a 28 e a ficha mostra os novos valores

#### Scenario: Consulta por outro membro
- **WHEN** outro membro abre a ficha
- **THEN** ele vê os valores de estado sem controles para alterá-los

### Requirement: Editor da ficha por seções
O sistema SHALL organizar o editor da ficha nas mesmas seções da ficha oficial, sinalizando a seção que contém erro de validação e levando o foco ao primeiro campo inválido.

#### Scenario: Erro em seção não visível
- **WHEN** o usuário salva a ficha com um erro em uma seção diferente da que está aberta
- **THEN** a seção com erro é sinalizada, passa a ser exibida e o foco vai para o primeiro campo inválido

#### Scenario: Mesma organização na criação e na edição
- **WHEN** o editor é aberto para criar ou para editar um personagem
- **THEN** ele apresenta as mesmas seções, na mesma ordem
