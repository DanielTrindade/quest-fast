#!/bin/sh
# Cria no Cloud Monitoring a verificação de /api/health e os alertas da VM.
# Pode ser repetido: o que já existe com o mesmo nome é mantido.
#
#   sh deploy/monitoring.sh voce@exemplo.com
set -eu

email=${1:?uso: sh deploy/monitoring.sh <email para os alertas>}
config=${GCLOUD_CONFIG-quest-fast}
host=${HOST:-34-44-15-122.sslip.io}
vm=${VM:-quest-fast}

g() {
  gcloud ${config:+--configuration="$config"} "$@"
}

project=$(g config get-value project 2>/dev/null)
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT

email_channel=$(g beta monitoring channels list \
  --filter="type=\"email\" AND labels.email_address=\"$email\"" --format='value(name)' | head -n 1)
if [ -z "$email_channel" ]; then
  email_channel=$(g beta monitoring channels create --display-name="E-mail $email" \
    --type=email --channel-labels=email_address="$email" --format='value(name)')
fi

# O canal do app do Google Cloud aparece sozinho quando você entra no app com a
# conta do projeto; rode o script de novo depois disso para incluí-lo.
channels="\"$email_channel\""
for c in $(g beta monitoring channels list --filter='type="mobile_push"' --format='value(name)'); do
  channels="$channels, \"$c\""
done

check=$(g monitoring uptime list-configs --filter="displayName=\"quest-fast health\"" --format='value(name)' | head -n 1)
if [ -z "$check" ]; then
  g monitoring uptime create "quest-fast health" \
    --resource-type=uptime-url --resource-labels="host=$host,project_id=$project" \
    --protocol=https --path=/api/health --period=5 --timeout=10 \
    --regions=usa-iowa,usa-virginia,south-america
  check=$(g monitoring uptime list-configs --filter="displayName=\"quest-fast health\"" --format='value(name)' | head -n 1)
fi
check_id=${check##*/}

instance_id=$(g compute instances list --filter="name=$vm" --format='value(id)')

cat > "$tmp/health.json" <<EOF
{
  "displayName": "quest-fast fora do ar",
  "combiner": "OR",
  "conditions": [{
    "displayName": "/api/health falhando em mais de uma região",
    "conditionThreshold": {
      "filter": "metric.type=\"monitoring.googleapis.com/uptime_check/check_passed\" AND resource.type=\"uptime_url\" AND metric.label.check_id=\"$check_id\"",
      "aggregations": [{
        "alignmentPeriod": "600s",
        "perSeriesAligner": "ALIGN_NEXT_OLDER",
        "crossSeriesReducer": "REDUCE_COUNT_FALSE",
        "groupByFields": ["resource.label.host"]
      }],
      "comparison": "COMPARISON_GT",
      "thresholdValue": 1,
      "duration": "300s",
      "trigger": { "count": 1 }
    }
  }],
  "alertStrategy": { "autoClose": "1800s" },
  "notificationChannels": [$channels],
  "documentation": {
    "mimeType": "text/markdown",
    "content": "O site não responde em https://$host/api/health. Veja o console serial da VM; se ela estiver travada, rode \`gcloud compute instances reset $vm\`."
  }
}
EOF

# Picos normais (deploy, backup) chegam a 94% por alguns minutos; o que
# importa é ficar alto por muito tempo.
cat > "$tmp/memory.json" <<EOF
{
  "displayName": "quest-fast sem memória",
  "combiner": "OR",
  "conditions": [{
    "displayName": "RAM acima de 92% por 30 min",
    "conditionPrometheusQueryLanguage": {
      "query": "compute_googleapis_com:instance_memory_balloon_ram_used{monitored_resource=\"gce_instance\",instance_id=\"$instance_id\"} / compute_googleapis_com:instance_memory_balloon_ram_size{monitored_resource=\"gce_instance\",instance_id=\"$instance_id\"} > 0.92",
      "duration": "1800s",
      "evaluationInterval": "60s"
    }
  }],
  "alertStrategy": { "autoClose": "3600s" },
  "notificationChannels": [$channels],
  "documentation": {
    "mimeType": "text/markdown",
    "content": "A VM está quase sem memória. Em 19/11/2026 ela travou assim: veja \`free -m\` e \`docker stats\` antes que o SSH pare de responder."
  }
}
EOF

# A VM sem memória fica relendo o disco: em 19/11/2026 foram 90 a 180 leituras
# por segundo contra ~1 no uso normal. 15 min deixam o pico do deploy de fora.
cat > "$tmp/thrashing.json" <<EOF
{
  "displayName": "quest-fast travando",
  "combiner": "OR",
  "conditions": [{
    "displayName": "Leitura de disco acima de 40/s por 15 min",
    "conditionPrometheusQueryLanguage": {
      "query": "sum by (instance_id) (rate(compute_googleapis_com:instance_disk_read_ops_count{monitored_resource=\"gce_instance\",instance_id=\"$instance_id\"}[5m])) > 40",
      "duration": "900s",
      "evaluationInterval": "60s"
    }
  }],
  "alertStrategy": { "autoClose": "3600s" },
  "notificationChannels": [$channels],
  "documentation": {
    "mimeType": "text/markdown",
    "content": "A VM está relendo o disco sem parar, sinal de memória esgotada. Se o SSH não responder, rode \`gcloud compute instances reset $vm\`."
  }
}
EOF

for policy in health memory thrashing; do
  name=$(sed -n 's/^  "displayName": "\(.*\)",$/\1/p' "$tmp/$policy.json")
  existing=$(g monitoring policies list --filter="displayName=\"$name\"" --format='value(name)' | head -n 1)
  if [ -n "$existing" ]; then
    g monitoring policies update "$existing" --policy-from-file="$tmp/$policy.json"
  else
    g monitoring policies create --policy-from-file="$tmp/$policy.json"
  fi
done
