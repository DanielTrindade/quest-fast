# Fontes do quest-fast

Arquivos WOFF2 originais, sem modificação, para o subconjunto latino usado em pt-BR. Todas as famílias são distribuídas sob OFL-1.1. As licenças acompanham os builds em `/licenses/`.

| Família | Origem dos binários | SHA-256 |
| --- | --- | --- |
| Space Grotesk | `@fontsource-variable/space-grotesk@5.2.10`, `files/space-grotesk-latin-wght-normal.woff2` | `0640890476fc1198ab4de571fb658de443c4d85b66466ec09534a8737ab1ce9d` |
| Geist | `@fontsource-variable/geist@5.3.0`, `files/geist-latin-wght-normal.woff2` | `19f9c92546aa300c312235e3125af1b81394d8db9a4bc4a425cd5b641d2d54e1` |
| Geist Mono | `@fontsource-variable/geist-mono@5.3.0`, `files/geist-mono-latin-wght-normal.woff2` | `684ad5b531f81d43c1e8c7038262d5db7cdc1f68006e04d6c7769efa8d33c8cc` |

As declarações `@font-face` ficam em `src/styles/index.css`, com `font-display: swap`. Para atualizar, substituir os arquivos a partir de uma versão explícita, preservar as licenças, atualizar os hashes e repetir a revisão de tipografia nos dois temas.

[Space Grotesk e licença](https://github.com/floriankarsten/space-grotesk), [Geist](https://github.com/vercel/geist-font).
