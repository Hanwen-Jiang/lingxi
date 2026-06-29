#!/usr/bin/env bash
# P9 docker go-live(无 sudo,仅 docker 组):用本地 P8 jar 自建 chat 镜像 + override 注入统一鉴权 env
# + 重建 chat/agent 容器。非侵入 D: 只读部署配置(-f 叠加 + --env-file)。镜像备份 :pre-p9 可回滚。
set -uo pipefail
DEPLOY=/mnt/d/InfiniteChatDeploy/projecta/deploy
BASE="$DEPLOY/docker-compose.yml"
DOCKERFILE="$DEPLOY/dockerfiles/java-app.Dockerfile"
OVERRIDE="/mnt/e/jhw/proj-chatbe-p9/chat/scripts/deploy/docker-golive.override.yml"
V09="$HOME/projecta-v0.9"
STAGE="$HOME/p9-deploy"; mkdir -p "$STAGE"
AUG="$STAGE/.env"

echo "== 生成 augmented env(原 .env + 鉴权键) =="
cp -f "$DEPLOY/.env" "$AUG"
chmod u+w "$AUG"   # 从 DrvFs(只读)copy 来会继承 r-x,必须加写权否则下面 heredoc 静默失败
sed -i '/^JWT_SECRET_KEY=/d;/^INTERNAL_SERVICE_TOKEN=/d;/^AGENT_GATEWAY_URI=/d;/^AGENT_GATEWAY_ENFORCE_IDENTITY=/d;/^GATEWAY_CORS_ALLOWED_ORIGIN_PATTERNS=/d' "$AUG"
cat >> "$AUG" <<'EOF'
JWT_SECRET_KEY=lingxiProdHS512Secret_2026_aB7kQ9zR3xT1vN6mYpE4wD8cF0jL5hG2
INTERNAL_SERVICE_TOKEN=lingxi-internal-prod-7f3a9c2e5b1d4068
AGENT_GATEWAY_URI=http://agent:10011
AGENT_GATEWAY_ENFORCE_IDENTITY=true
GATEWAY_CORS_ALLOWED_ORIGIN_PATTERNS=http://127.0.0.1:[*]
EOF

echo "== 备份当前 chat 镜像 → :pre-p9 =="
for s in gateway auth contact messaging realtime offline moment; do
  docker image inspect "infinitechat/$s:local" >/dev/null 2>&1 && docker tag "infinitechat/$s:local" "infinitechat/$s:pre-p9" && echo "  $s:pre-p9"
done

echo "== 自建 chat 镜像(P8 jar from $V09) =="
build_img() {
  docker build -q -f "$DOCKERFILE" --build-arg JAR_FILE="chat/$2/target/$2-0.0.1-SNAPSHOT.jar" \
    -t "infinitechat/$1:local" "$V09" >/dev/null && echo "  built $1" || { echo "  !! build $1 失败"; exit 1; }
}
build_img gateway GateWay
build_img auth AuthenticationService
build_img contact ContactService
build_img messaging MessagingService
build_img realtime RealTimeCommunicationService
build_img offline OfflineDataStoreService
build_img moment MomentService

echo "== docker mysql 迁移(message_outbox / last_read / user.status 默认值) =="
set -a; . "$AUG"; set +a
DBX() { mysql -h127.0.0.1 -P"${MYSQL_PORT:-13307}" -u"$MYSQL_USERNAME" -p"$MYSQL_PASSWORD" "$CHAT_MYSQL_DATABASE" -e "$1" 2>&1 | grep -iv "warning"; }
DBX "CREATE TABLE IF NOT EXISTS message_outbox (id BIGINT PRIMARY KEY AUTO_INCREMENT, message_id BIGINT NOT NULL, topic VARCHAR(128) NOT NULL, message_key VARCHAR(128) NOT NULL, payload TEXT NOT NULL, status TINYINT NOT NULL, retry_count INT NOT NULL DEFAULT 0, next_retry_at DATETIME NOT NULL, last_error VARCHAR(500) NULL, created_at DATETIME NOT NULL, updated_at DATETIME NOT NULL, UNIQUE KEY uk_message_id (message_id), KEY idx_status_next_retry (status, next_retry_at)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;" >/dev/null 2>&1 || true
# 部署 schema(init-chat-schema.sql)与 chat 仓库权威 schema 不一致处,运行期补:
DBX "ALTER TABLE user_session ADD COLUMN last_read_message_id BIGINT NULL;" >/dev/null 2>&1 || true   # M10
DBX "ALTER TABLE user MODIFY status int DEFAULT 1; UPDATE user SET status=1 WHERE status=0;" >/dev/null 2>&1 || true   # status 默认应为 1(active),否则注册即非活跃→发消息 500
echo -n "  message_outbox: "; mysql -h127.0.0.1 -P"${MYSQL_PORT:-13307}" -u"$MYSQL_USERNAME" -p"$MYSQL_PASSWORD" -N -e "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='$CHAT_MYSQL_DATABASE' AND table_name='message_outbox';" 2>/dev/null
echo -n "  last_read col: ";  mysql -h127.0.0.1 -P"${MYSQL_PORT:-13307}" -u"$MYSQL_USERNAME" -p"$MYSQL_PASSWORD" -N -e "SELECT COUNT(*) FROM information_schema.columns WHERE table_schema='$CHAT_MYSQL_DATABASE' AND table_name='user_session' AND column_name='last_read_message_id';" 2>/dev/null

echo "== 重建 chat + agent 容器(注入鉴权 env,用自建镜像) =="
docker compose -f "$BASE" -f "$OVERRIDE" --env-file "$AUG" up -d --no-build \
  auth contact messaging realtime offline moment gateway agent

echo "== 等就绪 =="
for i in $(seq 1 50); do curl -s -o /dev/null --max-time 2 "http://127.0.0.1:10010/actuator/health" 2>/dev/null && break; sleep 2; done
for p in 10010 8082 8080 8081 8083 8085 8086 9000 10011; do
  (timeout 2 bash -c "echo > /dev/tcp/127.0.0.1/$p" 2>/dev/null && echo "  :$p UP") || echo "  :$p DOWN"
done
echo "[done] docker go-live"
