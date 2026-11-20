#!/bin/sh
# Roda na VM, como root, chamado pelo ship.sh: instala a imagem e os arquivos
# que ele copiou para /tmp e sobe o app.
set -eu

image=$1

# O /tmp tem sticky bit: uma sobra de outro usuário bloquearia o próximo scp.
trap 'rm -f "/tmp/$image" /tmp/compose.yaml /tmp/Caddyfile /tmp/backup.sh /tmp/install.sh' EXIT

# Sem swap, a e2-micro (1 GB) que esgota a memória fica horas relendo o disco
# em vez de acionar o OOM killer, e trava o SSH junto. Fica antes do docker
# load, que é o pico de memória do deploy.
if [ ! -f /swapfile ]; then
  fallocate -l 1G /swapfile
  chmod 600 /swapfile
  mkswap /swapfile
  echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi
grep -q '^/swapfile ' /proc/swaps || swapon /swapfile

install -m 644 /tmp/compose.yaml /tmp/Caddyfile /srv/quest-fast/
install -m 700 /tmp/backup.sh /srv/quest-fast/
gunzip -c "/tmp/$image" | docker load

cd /srv/quest-fast

# As migrações rodam na subida do app e não têm volta, então o backup vem antes.
# Só a primeira instalação, ainda sem banco, sobe sem ele.
if [ -f dados/quest-fast.db ]; then
  ./backup.sh
fi

docker compose up -d
docker image prune -f

for _ in $(seq 30); do
  if docker compose exec -T app node -e "fetch('http://localhost:3000/api/health').then((r) => process.exit(r.ok ? 0 : 1), () => process.exit(1))" 2>/dev/null; then
    echo "app no ar"
    exit 0
  fi
  sleep 2
done

echo "o app não respondeu em /api/health" >&2
docker compose logs --tail 50 app >&2
exit 1
