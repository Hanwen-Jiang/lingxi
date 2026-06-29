#!/usr/bin/env bash
# J1 验收:登录(chat)→经统一网关→X-User-Id 注入→agent 处理。
# 前置:chat E2E 栈(03)+ agent(09)均已起。无 LLM key 时 A4 验到"请求达 agent 且带身份"
# (SSE start/error 事件,非 401);填 DASHSCOPE_API_KEY 后 A4 可见真实 delta 流。
set -uo pipefail
RUNTIME="${RUNTIME:-$HOME/projecta-runtime}"
REPO_E2E="${REPO_E2E:-/mnt/e/jhw/proj/chat/e2e}"
set -a; . "${CHAT_ENV:-$RUNTIME/chat.env}"; . "${E2E_ENV:-$REPO_E2E/e2e.env}"; set +a

GW="http://127.0.0.1:${GATEWAY_PORT:-10110}"
AGENT="http://127.0.0.1:${AGENT_SERVICE_PORT:-18080}"
PASS="${E2E_PASSWORD:-Test@12345}"; CODE="123456"
P=0; F=0
ok(){ echo "  ✅ $1"; P=$((P+1)); }
ng(){ echo "  ❌ $1  (expect=$2 got=$3)"; F=$((F+1)); }
status(){ curl -s -o /dev/null -w '%{http_code}' "$@"; }
jstr(){ grep -oE "\"$1\"[[:space:]]*:[[:space:]]*\"[^\"]*\"" | head -1 | sed -E 's/.*:[[:space:]]*"([^"]*)"/\1/'; }
jwt_sub(){ local p m; p=$(printf '%s' "$1" | cut -d. -f2); m=$(( ${#p} % 4 )); [ "$m" = 2 ] && p="${p}=="; [ "$m" = 3 ] && p="${p}="; printf '%s' "$p" | tr '_-' '/+' | base64 -d 2>/dev/null | sed -E 's/.*"sub":"?([^",}]*)"?.*/\1/'; }
redis_cmd(){ redis-cli --no-auth-warning -h "${REDIS_HOST:-127.0.0.1}" -p "${REDIS_PORT:-6379}" -n "${REDIS_DATABASE:-5}" ${REDIS_PASSWORD:+-a "$REDIS_PASSWORD"} "$@"; }

echo "=== J1 agent 入网关 E2E (gw=$GW, agent=$AGENT) ==="
ready=$(status "$GW/api/v1/contact/1/applyCount")
[ "$ready" = "401" ] || { echo "网关不可达或鉴权未就绪(got=$ready)"; exit 1; }
ah=$(status "$AGENT/api/actuator/health/readiness")
[ "$ah" = "200" ] || { echo "agent readiness 非 200(got=$ah,$AGENT)——先跑 09-agent-e2e.sh"; exit 1; }
ok "A1 agent /api/actuator/health/readiness 直连 200"

echo "[enforce-identity:直连缺 X-User-Id 被拒]"
d=$(status "$AGENT/api/agent/tools")
[ "$d" = "401" ] && ok "A2 直连 agent /api/agent/tools 无 X-User-Id → 401" || ng "A2 enforce 直连" 401 "$d"

echo "[登录(chat)→经网关→X-User-Id 注入→agent]"
EMAIL="agt_$(date +%j%H%M%S)@lingxi.test"
redis_cmd set "verify:email:$EMAIL" "$CODE" EX 300 >/dev/null 2>&1
curl -s -X POST -H 'Content-Type: application/json' -d "{\"email\":\"$EMAIL\",\"password\":\"$PASS\",\"code\":\"$CODE\"}" "$GW/api/v1/user/register" >/dev/null
login=$(curl -s -X POST -H 'Content-Type: application/json' -d "{\"email\":\"$EMAIL\",\"password\":\"$PASS\"}" "$GW/api/v1/user/login")
TOKEN=$(printf '%s' "$login" | jstr token); UID_=$(printf '%s' "$login" | jstr userId)
{ [ -z "$UID_" ] || [ "$UID_" = "null" ]; } && UID_=$(jwt_sub "$TOKEN")
[ -n "$TOKEN" ] && ok "登录拿 token(userId=$UID_)" || { ng "登录" token "$login"; echo "PASS=$P FAIL=$F"; exit 1; }

t=$(status -H "Authorization: Bearer $TOKEN" "$GW/api/agent/tools")
{ [ "$t" != "401" ] && [ "$t" != "000" ] && [ "$t" != "503" ]; } \
  && ok "A3 经网关带 token 访问 /api/agent/tools → 非401(got=$t):登录→网关→X-User-Id→agent 打通" \
  || ng "A3 网关→agent 注入身份" "!=401/503/000" "$t"

echo "[流式端点经网关到达 agent(SSE)]"
sse=$(curl -s -N --max-time 10 -X POST -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"sessionId":"9007199254740993","prompt":"你好"}' "$GW/api/chat/auto/stream")
if printf '%s' "$sse" | grep -qiE "data:|event:|\"type\"|模型未配置|model"; then
  ok "A4 /api/chat/auto/stream 经网关到达 agent 并产出 SSE(start/delta/error)"
  printf '%s' "$sse" | grep -qiE "模型未配置|未配置|not configured|MissingAiModel" \
    && echo "     (注:无 LLM key,agent 回 model-not-configured;集成/鉴权已验,填 DASHSCOPE_API_KEY 可见真实 delta)"
else
  ng "A4 SSE 到达 agent" "SSE 事件" "$(printf '%s' "$sse" | head -c 200)"
fi

echo "============ PASS=$P FAIL=$F ============"
[ "$F" -eq 0 ] && echo "J1 agent 入网关 E2E 全绿 ✅" || { echo "存在失败 ❌"; exit 1; }
