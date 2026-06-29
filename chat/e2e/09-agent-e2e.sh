#!/usr/bin/env bash
# J1: 把 SB3 agent 纳入统一网关 E2E 栈 —— 构建(或用现成 jar)+ 隔离启动(setsid 常驻)。
# 隔离:MySQL→H2 降级(连不上 :3399)、Redis→内存降级(连不上 :6399),不碰共享态。
# agent 纯信任网关注入的 X-User-Id(enforce-identity);无 LLM key 时聊天端点返回"模型未配置"
# (集成/鉴权注入路径仍可由 10-agent-smoke.sh 验;填 DASHSCOPE_API_KEY 可验完整流式)。
set -uo pipefail
RUNTIME="${RUNTIME:-$HOME/projecta-runtime}"
REPO_E2E="${REPO_E2E:-/mnt/e/jhw/proj/chat/e2e}"
set -a; . "${CHAT_ENV:-$RUNTIME/chat.env}"; . "${E2E_ENV:-$REPO_E2E/e2e.env}"; set +a
export JAVA_HOME="${JAVA_HOME:-/usr/lib/jvm/java-21-openjdk-amd64}"; export PATH="$JAVA_HOME/bin:$PATH"

AGENT_SRC="${AGENT_SRC:-/mnt/e/jhw/proj/agent}"
E2E_HOME="${E2E_HOME:-$HOME/projecta-e2e}"
AGENT_DST="$E2E_HOME/agent"
PORT="${AGENT_SERVICE_PORT:-18080}"
PIDF="$E2E_HOME/run/agent.pid"; LOG="$E2E_HOME/logs/agent.log"
mkdir -p "$E2E_HOME/run" "$E2E_HOME/logs"

agent_jar() {
  local jar
  jar="$(ls "$AGENT_DST"/target/InfiniteChat-Agent-*.jar 2>/dev/null | grep -vE '(-sources|-javadoc|\\.original)$' | head -1 || true)"
  [ -n "$jar" ] && printf '%s\n' "$jar" || printf '%s\n' "$AGENT_DST/target/InfiniteChat-Agent-*.jar"
}
JAR="$(agent_jar)"

if [ "${AGENT_SKIP_BUILD:-0}" != "1" ]; then
  echo "== sync agent 源码 -> $AGENT_DST =="
  rsync -a --delete --exclude target --exclude .git --exclude .idea "$AGENT_SRC"/ "$AGENT_DST"/
  echo "== 构建 agent(mvn -o,失败转 online) =="
  ( cd "$AGENT_DST" && mvn -o -q -DskipTests package ) 2>/dev/null \
    || ( cd "$AGENT_DST" && mvn -q -DskipTests package ) \
    || { echo "!! agent 构建失败:本 E2E 环境无 maven 镜像网络 + m2 缺 SB3/langchain4j 依赖。"
         echo "!! 解法:有网环境(S1/HUB)构建出 jar 放到 $AGENT_DST/target/,再 AGENT_SKIP_BUILD=1 重跑。"; exit 3; }
fi
[ -f "$JAR" ] || { echo "缺少 agent jar:$JAR(可 AGENT_SKIP_BUILD=1 + 放入现成 jar)"; exit 3; }

if [ -f "$PIDF" ] && kill -0 "$(cat "$PIDF" 2>/dev/null || echo 0)" 2>/dev/null; then
  echo "agent 已在运行(pid $(cat "$PIDF"))"; exit 0
fi

# 隔离环境变量(覆盖 agent application.yml 默认)
export SERVER_PORT="$PORT"
# MySQL 故意指向死端口 → agent 降级 H2 内存(E2E 不需持久 agent 库)
export MYSQL_URL="jdbc:mysql://127.0.0.1:3399/agent_e2e?useSSL=false&allowPublicKeyRetrieval=true&connectTimeout=2000"
# Redis 用 e2e 实例(REDIS_HOST/PORT/PASSWORD 已由 e2e.env 注入)但**独立 db6**(隔离 chat 的 db5):
# readiness 健康检查快(避免可选 Redis 拖垮主 health)+ F01 令牌/限流走 Redis 真路径(P6 GETDEL)。
export REDIS_DATABASE=6
export FLYWAY_ENABLED=false
export AGENT_GATEWAY_ENFORCE_IDENTITY="${AGENT_GATEWAY_ENFORCE_IDENTITY:-true}"
export DASHSCOPE_API_KEY="${DASHSCOPE_API_KEY:-}"

echo "== 起 agent(port=$PORT, enforce=$AGENT_GATEWAY_ENFORCE_IDENTITY, H2+内存降级) =="
PIDFILE="$PIDF" JARF="$JAR" \
  setsid bash -c 'echo $$ > "$PIDFILE"; exec java -Xms128m -Xmx768m -jar "$JARF"' \
  > "$LOG" 2>&1 < /dev/null &

echo "== 等 agent 就绪(/api/actuator/health/readiness) =="
for i in $(seq 1 45); do
  [ "$(curl -s -o /dev/null -w '%{http_code}' --max-time 2 "http://127.0.0.1:$PORT/api/actuator/health/readiness")" = "200" ] && { echo "✅ agent UP on $PORT"; exit 0; }
  sleep 2
done
echo "❌ agent 未在 90s 内就绪,日志尾:"; tail -25 "$LOG"; exit 1
