## Why

A ficha da plataforma cobre só o núcleo do 5e (atributos, perícias treinadas,
PV, CA, ataques e características), enquanto a mesa preenche a ficha oficial de
D&D 2024: duas páginas com identidade, combate, especialização, treinamento em
equipamentos, conjuração, inventário e personalidade (exemplo real em
`rpg_docs/Ficha_Hazin_Dan(Daniel).pdf`). O jogador mantém o PDF ao lado da
plataforma, e tudo que só existe no PDF fica fora das rolagens calculadas no
servidor. Alinhar a ficha à oficial faz da plataforma a única fonte da ficha,
no vocabulário que a mesa já usa.

**Por que construir em vez de usar uma ferramenta gratuita:** PDFs preenchíveis
e fichas de sites externos não se conectam às rolagens autorizadas no servidor
nem ao feed da campanha. A ficha precisa ser dado da plataforma para que
iniciativa, perícias com especialização e ataque mágico rolem com os valores
reais do personagem.

## What Changes

- **Identidade:** antecedente, subclasse, XP, alinhamento e tamanho. Na
  interface, "Raça" passa a se chamar "Espécie", como na ficha de 2024.
- **Combate:** PV atual, temporário e máximo; dado de vida (tipo e gastos);
  salvaguardas contra morte; escudo em uso; inspiração heroica; deslocamento.
- **Valores derivados, calculados em `shared/` com ajuste opcional:**
  iniciativa, percepção passiva, CD de magia e ataque mágico. O bônus de
  proficiência continua derivado do nível.
- **Perícias com especialização:** cada perícia pode ser nenhuma, proficiente
  ou especialista (dobro do bônus de proficiência), refletido na rolagem.
- **Treinamento em equipamentos:** armaduras (leve, média, pesada, escudos),
  armas e ferramentas.
- **Ataques** ganham tipo de dano e notas.
- **Traços de espécie e talentos** separados das características de classe.
- **Conjuração:** atributo de conjuração, espaços de magia por círculo (total e
  gastos) e lista de truques e magias preparadas com círculo, tempo de
  conjuração, alcance, concentração/ritual/material e notas.
- **Inventário e personalidade:** aparência, história e personalidade (a
  descrição atual), idiomas, equipamento, até três itens mágicos sintonizados e
  moedas (PC, PP, PE, PO, PL).
- **Estado de sessão sem abrir o editor:** novo
  `PATCH /campaigns/:id/characters/:characterId/state`, só do dono, para PV
  atual e temporário, dados de vida gastos, salvaguardas contra morte,
  inspiração heroica, espaços gastos e moedas.
- **Rolagens linkadas novas:** iniciativa e ataque mágico.
- **Resumo da lista** mostra PV atual sobre o máximo.
- **Storybook-first:** a consulta e o editor passam a seguir a organização da
  ficha oficial, com componentes novos nascendo como story.

Os campos novos são opcionais na entrada da API, com valores padrão
documentados; fichas e clientes existentes continuam válidos. Nenhuma mudança é
**BREAKING**.

## Capabilities

### New Capabilities

Nenhuma: a ficha oficial amplia capacidades que já existem.

### Modified Capabilities

- `characters`: a ficha passa a registrar identidade, combate, estado de
  sessão, especialização, treinamento em equipamentos, conjuração, inventário e
  personalidade da ficha oficial; o estado de sessão ganha alteração própria,
  só do dono.
- `dice-rolling`: iniciativa e ataque mágico passam a ser rolados pela ficha, e
  perícias com especialização somam o dobro da proficiência.
- `design-foundation`: consulta e editor da ficha organizados como a ficha
  oficial, com controles rápidos de estado e componentes novos com stories.

## Impact

- `shared/`: `CharacterSheet`, `CharacterInput`, `CharacterSummary`, `Attack`,
  `LinkedRollRequest` e `RollPayload` ampliados; novo `CharacterStateInput`;
  regras derivadas (iniciativa, percepção passiva, CD e ataque mágico, bônus de
  perícia com especialização) e limites compartilhados, com testes unitários.
- `db/`: novas colunas em `characters`, por migração versionada que preserva as
  fichas existentes (PV atual igual ao máximo).
- `server/`: parser e seleção da ficha, rota de estado com RBAC, rolagens de
  iniciativa e ataque mágico, especialização na perícia; testes de integração.
- `client/`: `CharacterSheetView`, `CharacterSheetDialog`, `CharacterForm`,
  `CharacterRow`, `AttackCard`, `AbilityCard` e componentes novos com stories;
  rótulos em `lib/5e.ts`; seed de desenvolvimento.
- Sem dependência nova.

## Non-goals

- Multiclasse (mais de uma classe e tipos de dado de vida misturados).
- Motor de regras automático: calcular CA pela armadura, PV e espaços de magia
  pela tabela da classe, ou aplicar efeitos de talentos, traços e itens.
- Compêndio de magias, itens ou talentos (busca no SRD).
- Descansos automatizados (curto e longo) e resolução automática das
  salvaguardas contra morte.
- Mestre alterando a ficha ou o estado de sessão de outro personagem.
- Propagar em tempo real para os outros membros a mudança de estado de uma
  ficha; eles veem o valor novo ao reabrir ou atualizar a lista.
- Importar ou exportar a ficha oficial em PDF.
