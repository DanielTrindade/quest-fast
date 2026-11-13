#!/bin/sh
# Prepara uma VM Debian 12 para o quest-fast. Roda como root e pode ser repetido.
set -eu

apt-get update
apt-get install -y --no-install-recommends ca-certificates curl gnupg unattended-upgrades

install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/debian/gpg -o /etc/apt/keyrings/docker.asc
chmod a+r /etc/apt/keyrings/docker.asc
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/debian $(. /etc/os-release && echo "$VERSION_CODENAME") stable" \
  > /etc/apt/sources.list.d/docker.list
apt-get update
apt-get install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin

# O driver "local" rotaciona os logs; o padrão cresceria até encher o disco.
echo '{ "log-driver": "local" }' > /etc/docker/daemon.json
systemctl restart docker

cat > /etc/apt/apt.conf.d/20auto-upgrades <<'EOF'
APT::Periodic::Update-Package-Lists "1";
APT::Periodic::Unattended-Upgrade "1";
EOF

# O container roda como o usuário node (uid 1000); mais ninguém na VM lê os dados.
mkdir -p /srv/quest-fast/dados/uploads
chown -R 1000:1000 /srv/quest-fast/dados
chmod 700 /srv/quest-fast/dados

cat > /etc/systemd/system/quest-fast-backup.service <<'EOF'
[Unit]
Description=Backup do quest-fast para o R2
After=docker.service

[Service]
Type=oneshot
ExecStart=/srv/quest-fast/backup.sh
EOF

cat > /etc/systemd/system/quest-fast-backup.timer <<'EOF'
[Unit]
Description=Backup diário do quest-fast

[Timer]
OnCalendar=*-*-* 06:00:00 UTC
RandomizedDelaySec=15m
Persistent=true

[Install]
WantedBy=timers.target
EOF

systemctl daemon-reload
systemctl enable --now quest-fast-backup.timer
