# Fontes do cartão do convite

Arquivos WOFF originais, sem modificação, subconjunto latino. O Satori não lê WOFF2, por isso o servidor usa estes `.woff` (o cliente usa os WOFF2 variáveis de `client/public/fonts/`). Todas as famílias são distribuídas sob OFL-1.1; o texto das licenças está em `OFL.txt`.

| Família | Origem dos binários | SHA-256 |
| --- | --- | --- |
| Space Grotesk 700 | `@fontsource/space-grotesk@5.3.0`, `files/space-grotesk-latin-700-normal.woff` | `145016049aa47932e2d116f70151edc5a53df894cb367514c52ea2d11289bee7` |
| Geist 400 | `@fontsource/geist@5.3.0`, `files/geist-latin-400-normal.woff` | `b3f9725f946d712db8a411a4ec1bbac766ce87baac703d4a8dcb9f38a89b2cfc` |
| Geist 600 | `@fontsource/geist@5.3.0`, `files/geist-latin-600-normal.woff` | `a08b94ffdc16be071cc85ace7ea5884463fc05775346ec2a292be651b3665a25` |

Os pacotes `@fontsource` não são dependências: os arquivos foram copiados de `npm pack` numa versão explícita. Para atualizar, substituir os arquivos, preservar as licenças e atualizar os hashes.
