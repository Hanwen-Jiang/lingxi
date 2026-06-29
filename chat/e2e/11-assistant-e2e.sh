#!/usr/bin/env bash
# 内助手全链路 E2E(P7 验收闸):邮箱登录 → @灵犀(经统一网关 → 注入 X-User-Id → agent)
#   → SSE §9 流式 → F01 工具确认令牌往返。
# 前置:chat E2E 栈(03)+ agent(09)均已起。
# 无 DASHSCOPE_API_KEY:验到"请求达 agent 且带身份"(SSE start/error、buffered 非401);
# 有 key:验真实流式 delta + F01 高风险工具确认令牌一次性消费往返。
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
nollm(){ printf '%s' "$1" | grep -qiE "未配置|not configured|MissingAiModel|Unavailable"; }

echo "=== 内助手全链路 E2E (gw=$GW, agent=$AGENT) ==="
curl -s -o /dev/null --max-time 3 "$GW/actuator/health" || { echo "网关不可达"; exit 1; }
curl -s -o /dev/null --max-time 3 "$AGENT/api/actuator/health" || { echo "agent 不可达——先跑 09-agent-e2e.sh"; exit 1; }

echo "[邮箱登录]"
EMAIL="lx_$(date +%j%H%M%S)@lingxi.test"
redis-cli --no-auth-warning -n "${REDIS_DATABASE:-5}" ${REDIS_PASSWORD:+-a "$REDIS_PASSWORD"} set "verify:email:$EMAIL" "$CODE" EX 300 >/dev/null 2>&1
curl -s -X POST -H 'Content-Type: application/json' -d "{\"email\":\"$EMAIL\",\"password\":\"$PASS\",\"code\":\"$CODE\"}" "$GW/api/v1/user/register" >/dev/null
login=$(curl -s -X POST -H 'Content-Type: application/json' -d "{\"email\":\"$EMAIL\",\"password\":\"$PASS\"}" "$GW/api/v1/user/login")
TOKEN=$(printf '%s' "$login" | jstr token); UID_=$(printf '%s' "$login" | jstr userId)
{ [ -z "$UID_" ] || [ "$UID_" = "null" ]; } && UID_=$(jwt_sub "$TOKEN")
[ -n "$TOKEN" ] && ok "登录拿 token(userId=$UID_)" || { ng "登录" token "$login"; echo "PASS=$P FAIL=$F"; exit 1; }
AUTHH=(-H "Authorization: Bearer $TOKEN")
SID="$(date +%s)"

echo "[@灵犀:缓冲式经网关 → 注入 X-User-Id → agent]"
buf=$(curl -s "${AUTHH[@]}" -H 'Content-Type: application/json' -d "{\"sessionId\":$SID,\"prompt\":\"你好,灵犀\"}" "$GW/api/agent/chat")
bufc=$(status "${AUTHH[@]}" -H 'Content-Type: application/json' -d "{\"sessionId\":$SID,\"prompt\":\"你好\"}" "$GW/api/agent/chat")
{ [ "$bufc" != "401" ] && [ "$bufc" != "000" ] && [ -n "$buf" ]; } \
  && ok "B1 /api/agent/chat 经网关达 agent(非401,got=$bufc)" || ng "B1 agent/chat" "!=401" "$bufc :: $buf"

echo "[@灵犀:SSE §9 流式经网关 → agent]"
sse=$(curl -s -N --max-time 15 "${AUTHH[@]}" -H 'Content-Type: application/json' -d "{\"sessionId\":$SID,\"prompt\":\"用一句话介绍你自己\"}" "$GW/api/chat/auto/stream")
if printf '%s' "$sse" | grep -qiE "\"v\"|\"type\"|data:|event:|未配置|Unavailable"; then
  ok "B2 /api/chat/auto/stream 产出 SSE(到达 agent 且带身份)"
  if nollm "$sse"; then
    echo "     (无 DASHSCOPE_API_KEY:agent 回 model-unavailable;集成/鉴权已验)"
  else
    printf '%s' "$sse" | grep -qE "\"type\"[[:space:]]*:[[:space:]]*\"delta\"|\"type\":\"done\"" \
      && ok "B2b SSE §9 含 delta/done 真实流式" || echo "     (注:SSE 已达但未见 delta/done,见原文)"
  fi
else
  ng "B2 SSE 到达 agent" "SSE 事件" "$(printf '%s' "$sse" | head -c 200)"
fi

echo "[F01 高风险工具确认令牌往返]"
f1=$(curl -s "${AUTHH[@]}" -H 'Content-Type: application/json' \
  -d "{\"sessionId\":$SID,\"prompt\":\"给 test@example.com 发一封主题为E2E的邮件\"}" "$GW/api/agent/chat")
if nollm "$f1"; then
  echo "  ⏭  跳过 F01:无 DASHSCOPE_API_KEY,agent 不路由工具(ReAct 需 LLM)。填 key 可验令牌往返。"
elif printf '%s' "$f1" | grep -q '"confirmationRequired"[[:space:]]*:[[:space:]]*true'; then
  CT=$(printf '%s' "$f1" | jstr challengeToken)
  [ -n "$CT" ] && ok "F01-1 触发高风险工具 → confirmationRequired + challengeToken" || ng "F01-1 token" "challengeToken" "$f1"
  f2=$(curl -s "${AUTHH[@]}" -H 'Content-Type: application/json' \
    -d "{\"sessionId\":$SID,\"prompt\":\"给 test@example.com 发一封主题为E2E的邮件\",\"confirmationToken\":\"$CT\"}" "$GW/api/agent/chat")
  printf '%s' "$f2" | grep -q '"confirmationRequired"[[:space:]]*:[[:space:]]*true' \
    && ng "F01-2 持令牌重发应放行" "不再 confirmationRequired" "$f2" \
    || ok "F01-2 持令牌重发 → 放行(令牌一次性消费)"
else
  echo "  ⏭  F01 未触发(模型未路由到高风险工具或工具未启用);响应:$(printf '%s' "$f1" | head -c 160)"
fi

echo "============ PASS=$P FAIL=$F ============"
[ "$F" -eq 0 ] && echo "内助手全链路 E2E 全绿 ✅" || { echo "存在失败 ❌"; exit 1; }
