#!/usr/bin/env bash
# 以隔离配置拉起 7 个 E2E 服务(端口 +100、库 InfiniteChat_e2e、Nacos 命名空间 e2e、Kafka 9192)。
# 环境变量加载顺序：chat.env(真实密钥) -> e2e.env(隔离覆盖)。
set -euo pipefail

RUNTIME="${RUNTIME:-$HOME/projecta-runtime}"
E2E_HOME="${E2E_HOME:-$HOME/projecta-e2e}"
E2E_SRC="${E2E_SRC:-$E2E_HOME/chat}"
REPO_E2E="${REPO_E2E:-/mnt/e/jhw/proj/chat/e2e}"
CHAT_ENV="${CHAT_ENV:-$RUNTIME/chat.env}"
E2E_ENV="${E2E_ENV:-$REPO_E2E/e2e.env}"
export JAVA_HOME="${JAVA_HOME:-/usr/lib/jvm/java-21-openjdk-amd64}"
export PATH="$JAVA_HOME/bin:$PATH"
mkdir -p "$E2E_HOME"/logs "$E2E_HOME"/run

start_jar() {
  local name="$1" jar="$2"
  local pidfile="$E2E_HOME/run/$name.pid" logfile="$E2E_HOME/logs/$name.log"
  if [ -f "$pidfile" ] && kill -0 "$(cat "$pidfile" 2>/dev/null || echo 0)" 2>/dev/null; then
    echo "$name 已在运行"; return 0
  fi
  [ -f "$jar" ] || { echo "缺少 jar：$jar (先执行 02-build.sh)"; return 1; }
  (
    cd "$(dirname "$jar")/.."
    set -a; . "$CHAT_ENV"; . "$E2E_ENV"; set +a
    # setsid 把进程放进新会话,使其在本 wsl 命令退出后不被 SIGTERM(nohup 只挡 SIGHUP)。
    # bash 先把自身 pid($$)写入 pidfile,再 exec 成 java(pid 不变)。
    PIDFILE="$pidfile" JARF="$jar" JOPTS="${JAVA_OPTS:-}" \
      setsid bash -c 'echo $$ > "$PIDFILE"; exec java $JOPTS -jar "$JARF"' \
      > "$logfile" 2>&1 < /dev/null &
  )
  echo "started $name  log=$logfile"
}

jar_of() {
  local jar
  jar="$(ls "$E2E_SRC/$1/target/$1"-*.jar 2>/dev/null | grep -vE '(-sources|-javadoc|\\.original)$' | head -1 || true)"
  [ -n "$jar" ] && echo "$jar" || echo "$E2E_SRC/$1/target/$1-*.jar"
}

for svc in AuthenticationService ContactService MessagingService \
           RealTimeCommunicationService OfflineDataStoreService MomentService GateWay; do
  start_jar "$svc" "$(jar_of "$svc")"
done

set -a; . "$CHAT_ENV"; . "$E2E_ENV"; set +a
echo "== E2E 启动完成。网关 http://127.0.0.1:${GATEWAY_PORT:-10110} =="
echo "   健康检查：curl -s http://127.0.0.1:${AUTH_SERVICE_PORT:-8182}/actuator/health"
echo "   查看日志：tail -f $E2E_HOME/logs/<服务名>.log"
