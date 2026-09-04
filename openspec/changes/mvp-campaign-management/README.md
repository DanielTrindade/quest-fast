# mvp-campaign-management

MVP do `quest-fast`: a mesa de D&D 5e inteira em uma plataforma — ficha, dados, combate e mundo. Sem VTT (change `vtt-battlefield`) e sem comunicação (Discord).

## Why

Rodar D&D 5e online hoje exige costurar cinco serviços (Discord + Avrae + DiceCloud + Owlbear Rodeo + Kanka), cada um com sua conta e seu link. Este projeto constrói **a mesa inteira em um só lugar**. O Discord permanece apenas para voz e roleplay.

A escolha de construir em vez de adotar o Quest Portal — gratuito e hoje mais completo — é consciente e se apoia em três razões: self-hosted (os dados da campanha são do mestre), opinado para uma mesa específica em vez de genérico, e PT-BR de ponta a ponta.

## What Changes

- Produto web novo, do zero.
- Ciclo de valor completo de uma sessão **sem VTT**: conta → campanha → personagens → rolagem linkada à ficha → combate com bestiário → mundo, com feed ao vivo.
- Login exclusivamente por Discord OAuth.
- Campo de batalha fica no change `vtt-battlefield`; até lá o Owlbear Rodeo cobre os mapas.

## Capabilities

### New Capabilities

- `user-auth`: login via Discord OAuth, sessão em cookie e perfil derivado do Discord.
- `campaigns`: criação, convite, entrada, saída, remoção de membros e papéis.
- `characters`: fichas D&D 5e criadas dentro da campanha.
- `session-feed`: canal em tempo real da campanha (eventos de rolagem e combate).
- `dice-rolling`: expressões, vantagem/desvantagem, rolagens linkadas à ficha, rolagem secreta.
- `combat-tracker`: encontros, iniciativa, turnos, HP, condições e bestiário reutilizável.
- `world-entries`: NPCs, locais, quests e diários com visibilidade público/privado.

### Modified Capabilities

Nenhuma — repositório novo.

## Impact

- Monorepo leve: `client/` (Vite + React), `server/` (Hono), `shared/` (regras 5e puras), `db/` (Drizzle + SQLite).
- Um processo, um build, um `Dockerfile`. Sem Postgres e sem Docker Compose.
- Depende de `design-system-foundation`, que entrega o `client/`, os tokens e os componentes da fase 0.
- Pré-requisito: aplicação registrada no Discord Developer Portal.

## Fases

```
Fase 0  login Discord -> criar campanha -> convite -> membros   [deployavel]
Fase 1  personagens + rolagem linkada a ficha + feed ao vivo
Fase 2  combate + bestiario
Fase 3  mundo (NPC / local / quest / diario)
------- fim do MVP -------
Fase 4  vtt-battlefield (change separado)
```
