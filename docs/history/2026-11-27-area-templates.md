# Gabaritos de área no mapa (#113)

Spec da [#113](https://github.com/DanielTrindade/quest-fast/issues/113), aprovada em 2026-11-27. Entrega em quatro PRs empilhados.

## Decisões tomadas (2026-11-27)

1. **Referência ao vivo para a mesa.** Desenhar uma área de referência manda a
   prévia pelo socket, como o arrasto do token (30 Hz, sem banco). Ao soltar,
   ela fica 5 s para todos e some. Não grava nada.
2. **Casas atingidas: meia casa.** A casa conta se a área cobre pelo menos
   metade dela (regra do DMG para grid). A origem fica sempre num cruzamento
   do grid.
3. **Âncora já na primeira entrega.** Uma área persistente pode seguir um
   token (Espírito Guardião): acompanha o arrasto ao vivo e a gravação ao
   soltar.
4. **Fog: como o monstro.** Área do mestre com a origem na área oculta não
   sai do servidor para o jogador. Área criada por jogador aparece sempre,
   como o token de personagem.

## Formas (regra pura em `shared/src/areas.ts`)

Medidas em metros, múltiplos de 1,5 m; a área guarda metros, não pixels, e se
ajusta sozinha quando o grid é recalibrado.

| Forma | Medidas | Origem | Orientação |
| --- | --- | --- | --- |
| Esfera / cilindro | raio | centro, num cruzamento | — |
| Cone | comprimento (largura no fim = comprimento) | vértice, num cruzamento | ângulo livre |
| Linha | comprimento e largura (padrão 1,5 m) | começo, num cruzamento | ângulo livre |
| Cubo | aresta | canto, num cruzamento | alinhado ao grid |

Cilindro é desenhado como esfera (projeção no mapa); o nome muda, a geometria
não. `areaCells(area, grid)` devolve as casas atingidas (≥ 50% cobertas),
recortadas ao mapa, com teste de offset do grid, diagonais e bordas. Sem grid
ligado, a área aparece mas não destaca casas.

Uma área que segue um token tem a origem no centro dele e conta a partir da
borda da criatura, como a emanação de 2024: o Espírito Guardião de 4,5 m num
token médio vai até 4,5 m + meia casa do centro.

Com a regra da meia casa, uma esfera de 3 m num cruzamento pega o bloco de
4 × 4 casas sem os cantos (12 casas), e um cone de 4,5 m em linha reta pega 4
casas: as duas ao lado da ponta ficam só um quarto cobertas.

Limites: 50 áreas por cena, nome de até 40 caracteres, raio/comprimento até
36 m (24 casas), cor de uma paleta fechada de tokens do design system.

## Persistência e permissões

Tabela `scene_areas`: cena, forma, medidas, origem (x, y), ângulo, nome, cor,
criador (da sessão), `hidden`, `anchorTokenId` opcional, `createdAt`.

- **Jogador:** cria, move e remove as próprias áreas; ancora só no próprio
  personagem. Não cria área oculta.
- **Mestre:** cria (inclusive oculta), move e remove qualquer uma; ancora em
  qualquer token.
- Não membro: 404. Cena que não é a aberta, para o jogador: 404.
- Remover o token-âncora remove as áreas ancoradas nele. Trocar o mapa escala
  a origem em cada eixo, como os tokens. Fechar ou excluir a cena leva as
  áreas junto (a cena excluída apaga em cascata).

## Visibilidade (servidor)

O jogador não recebe, em nenhum payload (REST, `scene.updated`, prévia):

- área oculta;
- área ancorada num token que ele não recebe (oculto, combatente escondido,
  sob o fog) — senão a área denunciaria o token;
- área do mestre (não ancorada) com a origem na área oculta do fog.

Regra `isAreaVisible` em `shared/`, ao lado de `isTokenVisible`, e o "ver como
jogador" do mestre usa a mesma função.

## Tempo real

- Persistente: toda mudança sobe a `version` da cena e publica
  `scene.updated`, que já traz as áreas projetadas; quem reconecta recebe o
  mesmo estado.
- Âncora: o cliente desenha a área na posição ao vivo do token
  (`token.moving`), sem mensagem nova; quem não recebe o token não recebe a
  área.
- Referência: `area.preview` do cliente (forma, medidas, origem, ângulo,
  validada como o `token.move`), repassada como `area.previewing` a quem pode
  ver, com a mesma regra de fog. `area.preview` com `done` dispara os 5 s de
  permanência no receptor. Sem trava: cada pessoa tem uma prévia só.

## Fora do escopo

- Pré-selecionar alvos do ataque com vários alvos pela área (#111): fica para
  depois, a área só mostra.
- Dano ou efeito automático em quem entra na área.
- Ligar a área à duração ou à concentração de um efeito (#112).

## PRs (empilhados)

1. **shared:** formas, `areaCells`, limites, validação, `isAreaVisible`,
   tipos da API e das mensagens de socket. Testes unitários.
2. **server, áreas persistentes:** schema + migração, rotas
   `POST/PATCH/DELETE …/scenes/:sceneId/areas`, projeção, cascata da âncora,
   troca de mapa. Testes de RBAC ("jogador não remove área de outro",
   "jogador não cria área oculta", "jogador não recebe área ancorada em token
   oculto", "não membro recebe 404").
3. **server, prévia ao vivo:** `area.preview` → `area.previewing` com o filtro
   de fog e de papel. Testes do socket.
4. **client:** stories primeiro (barra de ferramentas de área, lista acessível
   de áreas com remover, camada do canvas), `test:design`, depois a integração
   em `MapCanvas` e na Mesa (desenho separado de pan e arrasto). Atualiza
   `architecture.md`, `roadmap.md` e `design-system.md` (paleta das áreas).
