#!/usr/bin/env bash
# P9 切换补救:旧 prod 栈被 stop-apps 漏杀(陈旧 pidfile)仍占生产端口,导致新栈 bind 失败。
# 用 fuser 按端口强制释放生产端口(不动 18080 agent / +100 E2E 段),再起新 prod chat 栈。
set -uo pipefail
RUNTIME="$HOME/projecta-runtime"
PORTS="10010 8080 8081 8082 8083 8085 8086 9000"

echo "== 释放生产端口(杀占用者) =="
for port in $PORTS; do
  if fuser -k -TERM "${port}/tcp" >/dev/null 2>&1; then echo "  freed :$port"; fi
done
sleep 5
# 二次确认释放(SIGKILL 兜底)
for port in $PORTS; do
  fuser -k -KILL "${port}/tcp" >/dev/null 2>&1 || true
done
sleep 2

echo "== 清陈旧 chat pidfile =="
rm -f "$RUNTIME"/run/chat-*.pid

echo "== 起新 prod chat 栈(生产端口) =="
bash "$RUNTIME/start-apps.sh" chat

echo "== 等就绪 =="
for i in $(seq 1 50); do
  curl -s -o /dev/null --max-time 2 "http://127.0.0.1:10010/actuator/health" 2>/dev/null && break
  sleep 2
done
for port in 10010 8082 8080 8081 8083 8085 8086 9000 18080; do
  (timeout 2 bash -c "echo > /dev/tcp/127.0.0.1/$port" 2>/dev/null && echo "  :$port UP") || echo "  :$port DOWN"
done
