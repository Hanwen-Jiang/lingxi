#!/usr/bin/env bash
# P9 上线:把 E2E 绿的 main 部署到 WSL 开发运行态(projecta-current,生产端口),替换 pre-P0 无鉴权旧栈。
# 分阶段、可回滚(破坏前先备份)。用法:runtime-deploy.sh <stage|backup|migrate|env|cutover|health|all>
# 约定:chat 服务端口走 application.yml 生产默认(网关 10010 / 8080-8086 / Netty 9000);agent 18080。
set -euo pipefail

SRC="${SRC:-/mnt/e/jhw/proj-chatbe-p9/chat}"
AGENT_JAR_SRC="${AGENT_JAR_SRC:-/mnt/e/jhw/proj/agent/target/InfiniteChat-Agent-0.0.1-SNAPSHOT.jar}"
RUNTIME="$HOME/projecta-runtime"
RELEASE="${RELEASE:-$HOME/projecta-v0.9}"           # 新发布目录(symlink 将指向它)
BACKUP="$RUNTIME/backups"
CHAT_ENV="$RUNTIME/chat.env"
AGENT_ENV="$RUNTIME/agent.env"
STAMP="$(date +%Y%m%d-%H%M%S)"
export JAVA_HOME="${JAVA_HOME:-/usr/lib/jvm/java-21-openjdk-amd64}"; export PATH="$JAVA_HOME/bin:$PATH"
mkdir -p "$BACKUP" "$RUNTIME/run" "$RUNTIME/logs"

dbq() { set -a; . "$CHAT_ENV"; set +a; mysql -h127.0.0.1 -P3307 -u"$MYSQL_USERNAME" -p"$MYSQL_PASSWORD" "$@"; }

phase_stage() {
  echo "== [stage] 构建新 jar 到 $RELEASE =="
  mkdir -p "$RELEASE/chat" "$RELEASE/agent/target"
  rsync -a --delete --exclude target --exclude .git --exclude .idea --exclude 'e2e/e2e.env' "$SRC"/ "$RELEASE/chat"/
  ( cd "$RELEASE/chat" && mvn -o -q -DskipTests clean package || mvn -q -DskipTests clean package )
  cp -f "$AGENT_JAR_SRC" "$RELEASE/agent/target/" && echo "  agent jar: $(ls -la "$RELEASE/agent/target/"*.jar | awk '{print $5}')B"
  echo "  chat jars: $(ls "$RELEASE"/chat/*/target/*.jar 2>/dev/null | wc -l)/7"
}

phase_backup() {
  echo "== [backup] DB 快照 + env + symlink 记录(回滚用) =="
  readlink -f "$HOME/projecta-current" > "$BACKUP/symlink-target-$STAMP.txt"
  cp -f "$CHAT_ENV" "$BACKUP/chat.env.$STAMP" 2>/dev/null || true
  cp -f "$AGENT_ENV" "$BACKUP/agent.env.$STAMP" 2>/dev/null || true
  set -a; . "$CHAT_ENV"; set +a
  mysqldump -h127.0.0.1 -P3307 -u"$MYSQL_USERNAME" -p"$MYSQL_PASSWORD" --single-transaction --no-tablespaces \
    InfiniteChat > "$BACKUP/InfiniteChat-pre-p9-$STAMP.sql" 2>/dev/null \
    && echo "  DB dump: $BACKUP/InfiniteChat-pre-p9-$STAMP.sql ($(wc -l < "$BACKUP/InfiniteChat-pre-p9-$STAMP.sql") lines)" \
    || { echo "  !! DB dump 失败,中止"; exit 1; }
  echo "  symlink 旧指向: $(cat "$BACKUP/symlink-target-$STAMP.txt")"
}

phase_migrate() {
  echo "== [migrate] InfiniteChat 应用 P0→P8 schema(幂等) =="
  dbq InfiniteChat < "$SRC/MessagingService/src/main/resources/sql/message_outbox.sql"
  dbq InfiniteChat < "$SRC/MessagingService/src/main/resources/sql/red_packet_consistency.sql" 2>/dev/null || echo "  (red_packet_consistency 跳过/已存在)"
  dbq InfiniteChat -e "ALTER TABLE user_session ADD COLUMN IF NOT EXISTS last_read_message_id BIGINT NULL;"
  echo -n "  message_outbox 存在: "; dbq InfiniteChat -N -e "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='InfiniteChat' AND table_name='message_outbox';"
  echo -n "  last_read 列存在: ";   dbq InfiniteChat -N -e "SELECT COUNT(*) FROM information_schema.columns WHERE table_schema='InfiniteChat' AND table_name='user_session' AND column_name='last_read_message_id';"
}

# 幂等地把 KEY=VAL 写入 env(已存在则不动,保持稳定密钥)
ensure_kv() { local f="$1" k="$2" v="$3"; grep -qE "^${k}=" "$f" 2>/dev/null || { printf '%s=%s\n' "$k" "$v" >> "$f"; echo "  + $f: $k"; }; }

phase_env() {
  echo "== [env] 注入统一鉴权/CORS 运行期变量(幂等,首次生成稳定密钥) =="
  local jwt itk
  jwt="$(head -c 48 /dev/urandom | base64 | tr -d '/+=' | head -c 64)"
  itk="lingxi-internal-$(head -c 12 /dev/urandom | base64 | tr -d '/+=' )"
  ensure_kv "$CHAT_ENV" JWT_SECRET_KEY "$jwt"
  ensure_kv "$CHAT_ENV" INTERNAL_SERVICE_TOKEN "$itk"
  ensure_kv "$CHAT_ENV" AGENT_GATEWAY_URI "http://localhost:18080"
  ensure_kv "$CHAT_ENV" 'GATEWAY_CORS_ALLOWED_ORIGIN_PATTERNS' 'http://localhost:[*]'
  ensure_kv "$AGENT_ENV" AGENT_GATEWAY_ENFORCE_IDENTITY "true"
  echo "  chat.env JWT/内部令牌/agent-uri/CORS 就绪;agent.env enforce=true"
}

phase_cutover() {
  echo "== [cutover] 停旧栈 → 切 symlink → 起新栈(chat 生产端口 + agent 18080) =="
  bash "$RUNTIME/stop-apps.sh" all || true
  sleep 3
  ln -sfn "$RELEASE" "$HOME/projecta-current"
  echo "  projecta-current → $(readlink -f "$HOME/projecta-current")"
  bash "$RUNTIME/start-apps.sh" chat
  # agent 单独起在 18080(enforce=true),setsid 抗会话退出
  local apid="$RUNTIME/run/agent-app.pid" alog="$RUNTIME/logs/agent-app.log"
  [ -f "$apid" ] && kill "$(cat "$apid" 2>/dev/null || echo 0)" 2>/dev/null || true
  ( cd "$RELEASE/agent"; set -a; . "$AGENT_ENV"; set +a
    PIDF="$apid" JARF="$RELEASE/agent/target/InfiniteChat-Agent-0.0.1-SNAPSHOT.jar" \
    setsid bash -c 'echo $$ > "$PIDF"; exec java ${JAVA_OPTS:-} -jar "$JARF" --server.port=18080' > "$alog" 2>&1 < /dev/null & )
  echo "  agent 起于 18080,log=$alog"
}

phase_health() {
  echo "== [health] 等服务就绪 =="
  local ok=0
  for i in $(seq 1 60); do
    if curl -s -o /dev/null --max-time 2 "http://127.0.0.1:10010/actuator/health" 2>/dev/null \
       || curl -s -o /dev/null --max-time 2 "http://127.0.0.1:8082/actuator/health" 2>/dev/null; then ok=1; break; fi
    sleep 2
  done
  for p in 10010 8082 8080 8081 8083 8085 8086 9000 18080; do
    (timeout 2 bash -c "echo > /dev/tcp/127.0.0.1/$p" 2>/dev/null && echo "  :$p UP") || echo "  :$p DOWN"
  done
  [ "$ok" = 1 ] && echo "  网关/Auth 就绪" || echo "  !! 未在时限内就绪,查 $RUNTIME/logs"
}

case "${1:-}" in
  stage) phase_stage ;;
  backup) phase_backup ;;
  migrate) phase_migrate ;;
  env) phase_env ;;
  cutover) phase_cutover ;;
  health) phase_health ;;
  all) phase_stage; phase_backup; phase_migrate; phase_env; phase_cutover; phase_health ;;
  *) echo "用法: $0 <stage|backup|migrate|env|cutover|health|all>"; exit 2 ;;
esac
echo "[done] $1"
