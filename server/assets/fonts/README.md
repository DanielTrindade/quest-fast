# Fontes do cartão do convite

Arquivos WOFF originais, sem modificação, subconjuntos latino e latino estendido (`latin-ext`, para letras como ś e ł); o texto do cartão é filtrado em `sanitizeCardText` para o que essas fontes desenham. O Satori não lê WOFF2, por isso o servidor usa estes `.woff` (o cliente usa os WOFF2 variáveis de `client/public/fonts/`). Todas as famílias são distribuídas sob OFL-1.1; o texto das licenças está em `OFL.txt`.

| Família | Origem dos binários | SHA-256 |
| --- | --- | --- |
| Space Grotesk 700 | `@fontsource/space-grotesk@5.3.0`, `files/space-grotesk-latin-700-normal.woff` | `145016049aa47932e2d116f70151edc5a53df894cb367514c52ea2d11289bee7` |
| Geist 400 | `@fontsource/geist@5.3.0`, `files/geist-latin-400-normal.woff` | `b3f9725f946d712db8a411a4ec1bbac766ce87baac703d4a8dcb9f38a89b2cfc` |
| Geist 600 | `@fontsource/geist@5.3.0`, `files/geist-latin-600-normal.woff` | `a08b94ffdc16be071cc85ace7ea5884463fc05775346ec2a292be651b3665a25` |
| Space Grotesk 700 (latin-ext) | `@fontsource/space-grotesk@5.3.0`, `files/space-grotesk-latin-ext-700-normal.woff` | `215b0cac2778da21525aab1d204b59b4261099b64afd010864f73ec9613ec5ba` |
| Geist 400 (latin-ext) | `@fontsource/geist@5.3.0`, `files/geist-latin-ext-400-normal.woff` | `4b5402bd7cc384ace038bf652e0b31287403e0bc54f935117ebc94f2129493a7` |
| Geist 600 (latin-ext) | `@fontsource/geist@5.3.0`, `files/geist-latin-ext-600-normal.woff` | `558a2a706b6a7a50979f200c0bf9ecd086a52a886671938657b32bed56d2e865` |

Os pacotes `@fontsource` não são dependências: os arquivos foram copiados de `npm pack` numa versão explícita. Para atualizar, substituir os arquivos, preservar as licenças e atualizar os hashes.
