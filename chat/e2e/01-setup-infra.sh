#!/usr/bin/env bash
# 准备 E2E 隔离基础设施：独立库 + Nacos 命名空间 + 独立 Kafka broker。
# 不触碰线上的 InfiniteChat 库、线上 Nacos 服务、线上 Kafka(9092)。
set -euo pipefail

RUNTIME="${RUNTIME:-$HOME/projecta-runtime}"
E2E_HOME="${E2E_HOME:-$HOME/projecta-e2e}"
REPO_E2E="${REPO_E2E:-/mnt/e/jhw/proj/chat/e2e}"
CHAT_ENV="${CHAT_ENV:-$RUNTIME/chat.env}"
E2E_ENV="${E2E_ENV:-$REPO_E2E/e2e.env}"
SCHEMA="${SCHEMA:-$RUNTIME/chat-schema-bootstrap.sql}"
KAFKA_HOME="${KAFKA_HOME:-$HOME/.local/opt/kafka}"

[ -f "$E2E_ENV" ] || { echo "缺少 $E2E_ENV：请先 'cp $REPO_E2E/e2e.env.example $REPO_E2E/e2e.env' 并按需修改"; exit 1; }
[ -f "$SCHEMA" ]  || { echo "缺少 schema：$SCHEMA"; exit 1; }
set -a; . "$CHAT_ENV"; . "$E2E_ENV"; set +a

mkdir -p "$E2E_HOME"/logs "$E2E_HOME"/run "$E2E_HOME"/kafka-data

echo "== 1) 创建 E2E 数据库 InfiniteChat_e2e 并导入 schema(幂等) =="
mariadb -h127.0.0.1 -P3307 -u"$MYSQL_USERNAME" -p"$MYSQL_PASSWORD" \
  -e "CREATE DATABASE IF NOT EXISTS InfiniteChat_e2e DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
mariadb -h127.0.0.1 -P3307 -u"$MYSQL_USERNAME" -p"$MYSQL_PASSWORD" InfiniteChat_e2e < "$SCHEMA"
echo -n "   表数量: "
mariadb -h127.0.0.1 -P3307 -u"$MYSQL_USERNAME" -p"$MYSQL_PASSWORD" -N \
  -e "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='InfiniteChat_e2e';"

echo "== 2) 创建 Nacos 命名空间 (id=${SPRING_CLOUD_NACOS_DISCOVERY_NAMESPACE:-e2e}) =="
NS="${SPRING_CLOUD_NACOS_DISCOVERY_NAMESPACE:-e2e}"
code=$(curl -s -o /tmp/e2e_ns.out -w '%{http_code}' -X POST "http://127.0.0.1:8848/nacos/v1/console/namespaces" \
  --data-urlencode "customNamespaceId=$NS" --data-urlencode "namespaceName=$NS" \
  --data-urlencode "namespaceDesc=InfiniteChat E2E" || true)
echo "   HTTP $code  body=$(cat /tmp/e2e_ns.out 2>/dev/null)"
echo "   (返回 true=已建；false/already exist=已存在，均可继续。若 Nacos 开了鉴权，请到控制台手动新建命名空间 id=$NS)"

echo "== 3) 启动独立 E2E Kafka broker 127.0.0.1:9192 (与线上 9092 隔离) =="
if timeout 2 nc -z 127.0.0.1 9192 >/dev/null 2>&1; then
  echo "   9192 已监听，跳过"
else
  CFG="$E2E_HOME/kafka-e2e.properties"; DATA="$E2E_HOME/kafka-data"
  cat > "$CFG" <<EOF
process.roles=broker,controller
node.id=1
controller.quorum.voters=1@localhost:9193
listeners=PLAINTEXT://127.0.0.1:9192,CONTROLLER://127.0.0.1:9193
advertised.listeners=PLAINTEXT://localhost:9192
controller.listener.names=CONTROLLER
listener.security.protocol.map=CONTROLLER:PLAINTEXT,PLAINTEXT:PLAINTEXT
log.dirs=$DATA
num.partitions=3
default.replication.factor=1
offsets.topic.replication.factor=1
transaction.state.log.replication.factor=1
transaction.state.log.min.isr=1
group.initial.rebalance.delay.ms=0
auto.create.topics.enable=true
EOF
  if [ ! -f "$DATA/meta.properties" ]; then
    CID=$("$KAFKA_HOME/bin/kafka-storage.sh" random-uuid)
    "$KAFKA_HOME/bin/kafka-storage.sh" format -t "$CID" -c "$CFG"
  fi
  KAFKA_HEAP_OPTS="-Xms256m -Xmx512m" nohup "$KAFKA_HOME/bin/kafka-server-start.sh" "$CFG" \
    > "$E2E_HOME/logs/kafka-e2e.log" 2>&1 &
  echo $! > "$E2E_HOME/run/kafka-e2e.pid"
  echo "   启动中，日志 $E2E_HOME/logs/kafka-e2e.log"
fi

echo "== 基础设施就绪 =="
