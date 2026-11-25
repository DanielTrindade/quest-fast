# Efeitos temporários no combate (#112)

Spec da [#112](https://github.com/DanielTrindade/quest-fast/issues/112), aprovada em 2026-11-25. Entrega em quatro PRs empilhados.

## Decisões tomadas (2026-11-25)

1. **Permissão:** o mestre gerencia todos. O jogador põe efeito no próprio
   personagem, ou num aliado quando a origem é o personagem dele, e tira os
   que pôs ou os do próprio personagem.
2. **PV máximo:** ao entrar, PV máximo e atuais sobem N. Ao sair, os atuais só
   caem se passarem do novo máximo. A ficha nunca guarda o máximo alterado.
3. **Duração:** até o fim do combate; N rounds (conta no fim do turno de quem
   tem o efeito, como as condições); até o início do próximo turno de quem
   tem o efeito (Escudo); sem prazo. Todos caem quando o encontro termina.
4. **Resistência:** o servidor reconhece o tipo de dano (pt e en), guarda no
   dano pendente o valor sugerido (imunidade 0, resistência metade arredondada
   para baixo, vulnerabilidade dobro) e o motivo. O mestre ainda ajusta. Tipo
   desconhecido fica com o valor cheio.

## Padrões propostos

- **Modelo:** `effects` (JSON) no combatente, também no de personagem.
  `{ id, name, modifiers, duration, roundsLeft?, sourceCombatantId?, concentration, hpGranted }`.
- **Modificadores:**
  - CA: somar ou fixar. Efetiva = maior "fixar" (ou a base), mais a soma dos "somar".
  - Deslocamento: somar, fixar ou metade (Lentidão). Ordem: fixar, somar,
    metade, depois as condições (0 e exaustão) que já existem.
  - PV máximo: somar (só positivo).
  - Danos: resistência, imunidade, vulnerabilidade a uma lista fechada de 13
    tipos. Com resistência e vulnerabilidade ao mesmo tipo, a resistência vem
  primeiro e a vulnerabilidade depois (2024: 25 vira 12, depois 24).
- **Acúmulo:** dois efeitos com o mesmo nome no mesmo combatente não se somam:
  aplicar de novo substitui (como as condições).
- **Concentração:** marcar "concentração" exige origem; quando a concentração da
  origem cai (dano a 0, botão, ficha), os efeitos ligados saem de vez.
- **Uso no servidor:** CA efetiva no acerto; deslocamento efetivo no
  movimento (o já gasto não volta); cura limitada pelo PV máximo efetivo.
- **Visibilidade:** jogador vê efeitos com números nos aliados; num monstro,
  só o nome. Combatente oculto não aparece. REST e WebSocket.
- **Evento no feed:** efeito aplicado, removido e expirado (mesma linha das condições).

## PRs (empilhados)

1. `shared/`: tipos de dano, modelo do efeito, atributos efetivos, sugestão de
   dano, tick de duração, com testes.
2. `server/`: coluna + migração, rotas de efeito com RBAC, expiração no turno,
   queda pela concentração, fim do encontro, projeção.
3. `server/`: CA, deslocamento, PV máximo e sugestão de dano ligados ao ataque,
   movimento, cura e dano pendente.
4. `client/`: stories do editor e da lista de efeitos, depois integração no
   combate e na Mesa. `docs/architecture.md` e `docs/roadmap.md`.
