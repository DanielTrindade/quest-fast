# Política de segurança

O quest-fast é uma aplicação self-hosted que guarda a mesa de quem o instala:
sessões, fichas e o histórico de rolagens. Leve a segurança a sério o bastante
para não colocar credenciais em issue, e reporte o resto por aqui.

## Versões suportadas

Não há releases: o que é suportado é o que está na `master`.

| Versão | Suporte |
| --- | --- |
| `master` (último commit) | sim |
| Qualquer commit anterior, fork ou instalação modificada | não |

Se você roda uma versão antiga, o primeiro passo do relato é verificar se o
problema ainda existe na `master`.

## Como reportar

**Não abra issue pública para uma falha de segurança.**

Use o canal privado do GitHub:
<https://github.com/DanielTrindade/quest-fast/security/advisories/new>

O relato passa a ser um rascunho de advisory visível só para você e para o
mantenedor. Se o canal privado não estiver disponível para você, abra uma
issue pública **sem detalhes** pedindo um canal de contato.

Ajuda muito incluir:

- o commit afetado (`git rev-parse --short HEAD`);
- a configuração relevante (**sem** `DISCORD_CLIENT_SECRET`, cookies de
  sessão, conteúdo do banco ou dados da mesa);
- passos para reproduzir e o impacto que você enxerga;
- uma prova de conceito mínima, se houver.

## Áreas sensíveis

O que é tratado como falha de segurança:

- **Autenticação e sessão** — login por OAuth do Discord, emissão e validação
  do cookie `qf_session`, expiração e revogação, `COOKIE_SECURE`.
- **Autorização** — papel de mestre ou jogador dentro de uma campanha, acesso
  a campanha alheia (o esperado é `404`, nunca conteúdo), código de convite,
  rolagem secreta do mestre e visibilidade do feed.
- **Rolagens** — qualquer forma de prever, forjar ou alterar o resultado de
  uma rolagem, que é sempre resolvida no servidor.
- **Uploads** — avatar e demais arquivos: travessia de caminho, tipo e tamanho
  do arquivo, execução de conteúdo enviado.
- **WebSocket** — assinar o feed de uma campanha sem ser membro dela.
- **Injeção** — SQL, HTML na ficha ou em nome de campanha, e qualquer coisa
  que chegue a `better-sqlite3` sem passar pelo Drizzle.

## O que não é falha de segurança

- Configuração da sua própria instalação: `.env` com segredo commitado por
  você, HTTPS ausente na frente do proxy reverso, banco e `uploads/`
  expostos, Docker rodando como `root` sem necessidade.
- Falta de recurso que ainda não existe (veja o
  [`docs/roadmap.md`](docs/roadmap.md)).
- Dependência desatualizada **sem** caminho de exploração conhecido no uso que
  o projeto faz dela. Nesse caso, um issue normal ou um PR resolve.

## Advisories aceitos

Um caso é conhecido, avaliado e mantido de propósito:

**`esbuild@0.18.20`, via `drizzle-kit` → `@esbuild-kit/esm-loader` →
`@esbuild-kit/core-utils`** — [GHSA-67mh-4wv8-2f99](https://github.com/advisories/GHSA-67mh-4wv8-2f99),
moderado, alerta aberto no Dependabot.

O advisory trata do **servidor de desenvolvimento** do esbuild (`esbuild
serve`), que passa a aceitar requisições de qualquer origem. O `core-utils`
não usa essa API: ele chama só `esbuild.transform()` para carregar o
`db/drizzle.config.ts` — transformação de string, sem abrir porta. `serve`,
`build` e `context` não aparecem no pacote.

Não há correção a aplicar:

- `@esbuild-kit` está **descontinuado** (o npm avisa "Merged into tsx"), e a
  versão mais nova, 3.3.2, continua fixando `esbuild: ~0.18.20`. O
  `drizzle-kit` 0.31.11, o mais novo, ainda depende dele.
- `npm audit fix --force` propõe **rebaixar** o `drizzle-kit` para 0.18.1 —
  trocaria um advisory inalcançável por um gerador de migração cinco versões
  mais velho.
- Um `overrides` forçando `esbuild@0.25` dentro do `core-utils` foi testado e
  não se sustenta: neste arranjo de workspaces o npm não re-resolve a
  subárvore e produz uma árvore inválida, com `ELSPROBLEMS` no `npm ls`.

O risco é de desenvolvimento e não chega ao artefato publicado: `drizzle-kit`
é dependência de desenvolvimento do workspace `db`, que o Docker descarta com
`npm prune --omit=dev`. O alerta no Dependabot continua porque a correção
depende do upstream — se o `drizzle-kit` largar o `@esbuild-kit`, este trecho
sai junto.

## O que esperar

- Confirmação de recebimento em até **3 dias**.
- Avaliação e resposta sobre o impacto em até **10 dias**.
- Correção na `master`, e o advisory publicado com o crédito a quem reportou,
  a menos que você prefira anonimato.
- Pedido de prazo antes de qualquer divulgação pública, para que as
  instalações existentes tenham tempo de atualizar.

Este é um projeto mantido por uma pessoa, sem plantão nem SLA. Se o prazo
acima estourar, cobre na própria thread do advisory.
