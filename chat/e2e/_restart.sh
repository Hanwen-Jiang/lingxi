#!/usr/bin/env bash
# 仅重启 7 个 E2E 服务(不动私有 MariaDB / E2E Kafka),用于换新 jar。
set -uo pipefail
E2E_HOME="$HOME/projecta-e2e"
for s in AuthenticationService ContactService MessagingService RealTimeCommunicationService OfflineDataStoreService MomentService GateWay; do
  f="$E2E_HOME/run/$s.pid"
  if [ -f "$f" ]; then pid=$(cat "$f" 2>/dev/null || true); [ -n "${pid:-}" ] && kill "$pid" 2>/dev/null && echo "stopped $s ($pid)"; rm -f "$f"; fi
done
sleep 4
# 用与本脚本同目录的 03-start(保证 LF;避免误用别处 CRLF 版本静默失败)
bash "$(dirname "$0")/03-start-apps.sh"
