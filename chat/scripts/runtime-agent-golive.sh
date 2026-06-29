#!/usr/bin/env bash
# P10 agent go-live: bake S1-built current-source agent jar into the Docker
# production image, tag the previous image for rollback, then recreate only
# the agent container with the committed auth/gateway override.
set -euo pipefail

DEPLOY="${DEPLOY:-/mnt/d/InfiniteChatDeploy/projecta/deploy}"
BASE="${BASE:-$DEPLOY/docker-compose.yml}"
DOCKERFILE="${DOCKERFILE:-$DEPLOY/dockerfiles/java-app.Dockerfile}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
OVERRIDE="${OVERRIDE:-$SCRIPT_DIR/deploy/docker-golive.override.yml}"
ENV_FILE="${ENV_FILE:-$HOME/p9-deploy/.env}"

AGENT_SOURCE_TREE="${AGENT_SOURCE_TREE:-/mnt/e/jhw/proj}"
STAGE="${STAGE:-$HOME/p10-agent-docker-context}"
STAMP="$(date +%Y%m%d%H%M%S)"

[ -f "$BASE" ] || { echo "missing compose: $BASE"; exit 1; }
[ -f "$DOCKERFILE" ] || { echo "missing Dockerfile: $DOCKERFILE"; exit 1; }
[ -f "$OVERRIDE" ] || { echo "missing override: $OVERRIDE"; exit 1; }
[ -f "$ENV_FILE" ] || { echo "missing env file: $ENV_FILE"; exit 1; }
set -a; . "$ENV_FILE"; set +a

agent_jar() {
  local jar
  jar="$(ls "$AGENT_SOURCE_TREE"/agent/target/InfiniteChat-Agent-*.jar 2>/dev/null | grep -vE '(-sources|-javadoc|\\.original)$' | head -1 || true)"
  [ -n "$jar" ] || { echo "missing agent jar under: $AGENT_SOURCE_TREE/agent/target"; exit 1; }
  printf '%s\n' "$jar"
}
AGENT_JAR="${AGENT_JAR:-$(agent_jar)}"

echo "== backup current infinitechat/agent:local -> :pre-p10-$STAMP =="
if docker image inspect infinitechat/agent:local >/dev/null 2>&1; then
  docker tag infinitechat/agent:local "infinitechat/agent:pre-p10-$STAMP"
fi

echo "== stage agent jar =="
rm -rf "$STAGE"
mkdir -p "$STAGE/agent/target"
AGENT_JAR_BASENAME="$(basename "$AGENT_JAR")"
cp -f "$AGENT_JAR" "$STAGE/agent/target/$AGENT_JAR_BASENAME"

echo "== build infinitechat/agent:local from $AGENT_JAR =="
docker build -f "$DOCKERFILE" \
  --build-arg JAR_FILE="agent/target/$AGENT_JAR_BASENAME" \
  -t infinitechat/agent:local "$STAGE"

echo "== recreate agent container with committed override =="
docker compose -f "$BASE" -f "$OVERRIDE" --env-file "$ENV_FILE" up -d --no-build agent

echo "== wait for agent readiness =="
READY_URL="${AGENT_READY_URL:-http://127.0.0.1:${AGENT_SERVICE_PORT:-10011}/api/actuator/health/readiness}"
for _ in $(seq 1 60); do
  if [ "$(curl -s -o /dev/null -w '%{http_code}' --max-time 2 "$READY_URL" 2>/dev/null)" = "200" ]; then
    echo "agent readiness is 200: $READY_URL"
    docker ps --filter name=infinitechat-agent --format '  {{.Names}} {{.Image}} {{.Status}}'
    exit 0
  fi
  sleep 2
done

echo "agent readiness did not become 200: $READY_URL; log tail:"
docker logs --tail 80 infinitechat-agent 2>&1 || true
exit 1
