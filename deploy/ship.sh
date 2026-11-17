#!/bin/sh
# Builda a imagem nesta máquina (ou no runner do CI) e a sobe na VM: a e2-micro
# não tem memória para o npm ci e o build do client.
set -eu

cd "$(dirname "$0")/.."
# Vazio usa a configuração ativa do gcloud, como no CI.
config=${GCLOUD_CONFIG-quest-fast}
vm=${VM:-quest-fast}
image=quest-fast-image.tar.gz

trap 'rm -f "$image"' EXIT

# Cada deploy do CI registra uma chave SSH nova na conta de serviço; a validade
# curta evita que elas se acumulem no perfil do OS Login.
vm_gcloud() {
  gcloud ${config:+--configuration="$config"} compute "$@" --tunnel-through-iap --ssh-key-expire-after=30m
}

docker build --platform linux/amd64 -t quest-fast:latest .
docker save quest-fast:latest | gzip > "$image"

vm_gcloud scp "$image" deploy/compose.yaml deploy/Caddyfile deploy/backup.sh deploy/install.sh "$vm:/tmp/"
vm_gcloud ssh "$vm" --command "sudo sh /tmp/install.sh $image"
