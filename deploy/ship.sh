#!/bin/sh
# Builda a imagem nesta máquina e a sobe na VM: a e2-micro não tem memória
# para o npm ci e o build do client.
set -eu

cd "$(dirname "$0")/.."
config=${GCLOUD_CONFIG:-quest-fast}
vm=${VM:-quest-fast}
image=quest-fast-image.tar.gz

trap 'rm -f "$image"' EXIT

docker build --platform linux/amd64 -t quest-fast:latest .
docker save quest-fast:latest | gzip > "$image"

gcloud --configuration="$config" compute scp --tunnel-through-iap \
  "$image" deploy/compose.yaml deploy/Caddyfile deploy/backup.sh "$vm:/tmp/"

gcloud --configuration="$config" compute ssh "$vm" --tunnel-through-iap --command "sudo sh -euc '
  install -m 644 /tmp/compose.yaml /tmp/Caddyfile /srv/quest-fast/
  install -m 700 /tmp/backup.sh /srv/quest-fast/
  gunzip -c /tmp/$image | docker load
  rm -f /tmp/$image /tmp/compose.yaml /tmp/Caddyfile /tmp/backup.sh
  cd /srv/quest-fast
  docker compose up -d
  docker image prune -f
'"
