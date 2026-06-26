#!/usr/bin/env bash
# 停止所有 E2E 服务与 E2E Kafka(只动 ~/projecta-e2e/run 下的 pid，不影响线上)。
set -euo pipefail
E2E_HOME="${E2E_HOME:-$HOME/projecta-e2e}"

shopt -s nullglob
for f in "$E2E_HOME"/run/*.pid; do
  pid=$(cat "$f" 2>/dev/null || true)
  name=$(basename "$f" .pid)
  if [ -n "${pid:-}" ] && kill -0 "$pid" 2>/dev/null; then
    kill "$pid" && echo "stopped $name (pid=$pid)"
  else
    echo "$name 未运行"
  fi
  rm -f "$f"
done
echo "== E2E 已停止 (kafka-data 保留在 $E2E_HOME/kafka-data，下次复用) =="
