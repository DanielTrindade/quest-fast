#!/bin/sh
# Copia consistente do SQLite e dos uploads para o bucket privado de backup no R2.
set -eu

cd /srv/quest-fast
. ./backup.env

stamp=$(date -u +%Y%m%dT%H%M%SZ)
archive=$(mktemp --suffix=.tar.gz)
trap 'rm -f "$archive" dados/backup.db' EXIT

# A API de backup do SQLite copia o banco em uso sem travar o app; copiar o
# arquivo direto poderia pegar uma escrita pela metade.
docker compose exec -T app node -e "
const Database = require('better-sqlite3');
new Database(process.env.DB_FILE, { readonly: true }).backup('/dados/backup.db')
  .catch((error) => { console.error(error); process.exit(1); });
"

tar -czf "$archive" -C dados backup.db uploads

# O rclone do Debian 12 (1.60) recebe 501 do R2 na primeira tentativa; a
# imagem oficial numa versão fixa não depende do pacote da distro.
# O token só enxerga o próprio bucket: não pode listar nem criar buckets.
docker run --rm --network host \
  -v "$archive:/backup.tar.gz:ro" \
  -e RCLONE_CONFIG_R2_TYPE=s3 \
  -e RCLONE_CONFIG_R2_PROVIDER=Cloudflare \
  -e RCLONE_CONFIG_R2_ACCESS_KEY_ID="$R2_ACCESS_KEY_ID" \
  -e RCLONE_CONFIG_R2_SECRET_ACCESS_KEY="$R2_SECRET_ACCESS_KEY" \
  -e RCLONE_CONFIG_R2_ENDPOINT="https://$R2_ACCOUNT_ID.r2.cloudflarestorage.com" \
  -e RCLONE_CONFIG_R2_NO_CHECK_BUCKET=true \
  rclone/rclone:1.71 copyto /backup.tar.gz "r2:$R2_BACKUP_BUCKET/quest-fast-$stamp.tar.gz"
echo "backup enviado: quest-fast-$stamp.tar.gz"
