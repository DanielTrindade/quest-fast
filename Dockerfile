# Processo único: o mesmo container serve SPA, API e (nas próximas fases) o
# WebSocket. Sem orquestração, conforme a decisão 2 do design.

FROM node:22-bookworm-slim AS build
WORKDIR /app

# `better-sqlite3` usa binário pré-compilado quando existe para a plataforma;
# as ferramentas de build cobrem o caso em que não existe.
RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ ca-certificates \
  && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
COPY client/package.json ./client/
COPY server/package.json ./server/
COPY shared/package.json ./shared/
COPY db/package.json ./db/
RUN npm ci

COPY . .
RUN npm run build

# Descarta as dependências de desenvolvimento do artefato final.
RUN npm prune --omit=dev


FROM node:22-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production

# O banco e os uploads vivem em volume: o container é descartável, os dados não.
ENV DB_FILE=/dados/quest-fast.db
ENV UPLOADS_DIR=/dados/uploads
# Relativo ao WORKDIR: serveStatic resolve a partir do cwd do processo.
ENV CLIENT_DIR=./client/dist
ENV PORT=3000

COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/shared ./shared
COPY --from=build /app/db ./db
COPY --from=build /app/server ./server
COPY --from=build /app/client/dist ./client/dist

RUN mkdir -p /dados/uploads && chown -R node:node /dados
VOLUME ["/dados"]
USER node
EXPOSE 3000

# As migrações são aplicadas na subida: o self-host não tem passo separado.
CMD ["sh", "-c", "node db/src/migrate.ts && node server/src/index.ts"]
