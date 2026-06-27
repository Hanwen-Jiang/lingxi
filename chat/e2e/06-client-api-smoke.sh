#!/usr/bin/env bash
# 客户端 API 冒烟(P4 item1,解锁 S4):会话列表 / 好友列表 / 历史分页成员鉴权 / markRead。
# 前置:01/02/03 已执行,服务就绪;邮箱登录闭环可用。
set -uo pipefail
RUNTIME="${RUNTIME:-$HOME/projecta-runtime}"
REPO_E2E="${REPO_E2E:-/mnt/e/jhw/proj/chat/e2e}"
set -a; . "${CHAT_ENV:-$RUNTIME/chat.env}"; . "${E2E_ENV:-$REPO_E2E/e2e.env}"; set +a

GW="http://127.0.0.1:${GATEWAY_PORT:-10110}"
EMAIL="${E2E_EMAIL:-c2_$(date +%j%H%M%S)@lingxi.test}"; PASS="${E2E_PASSWORD:-Test@12345}"; CODE="123456"
P=0; F=0
ok(){ echo "  ✅ $1"; P=$((P+1)); }
ng(){ echo "  ❌ $1  (expect=$2 got=$3)"; F=$((F+1)); }
status(){ curl -s -o /dev/null -w '%{http_code}' "$@"; }
jstr(){ grep -oE "\"$1\"[[:space:]]*:[[:space:]]*\"[^\"]*\"" | head -1 | sed -E 's/.*:[[:space:]]*"([^"]*)"/\1/'; }
jnum(){ grep -oE "\"$1\"[[:space:]]*:[[:space:]]*-?[0-9]+" | head -1 | grep -oE -- '-?[0-9]+$'; }
has(){ printf '%s' "$1" | grep -q "$2"; }

echo "=== 客户端 API 冒烟 (gw=$GW, email=$EMAIL) ==="
curl -s -o /dev/null --max-time 3 "$GW/actuator/health" || { echo "网关不可达"; exit 1; }
redis-cli --no-auth-warning -n "${REDIS_DATABASE:-5}" ${REDIS_PASSWORD:+-a "$REDIS_PASSWORD"} set "verify:email:$EMAIL" "$CODE" EX 300 >/dev/null 2>&1
curl -s -X POST -H 'Content-Type: application/json' -d "{\"email\":\"$EMAIL\",\"password\":\"$PASS\",\"code\":\"$CODE\"}" "$GW/api/v1/user/register" >/dev/null
login=$(curl -s -X POST -H 'Content-Type: application/json' -d "{\"email\":\"$EMAIL\",\"password\":\"$PASS\"}" "$GW/api/v1/user/login")
TOKEN=$(printf '%s' "$login" | jstr token)
[ -n "$TOKEN" ] && ok "登录拿到 token" || { ng "登录" token empty; echo "PASS=$P FAIL=$F"; exit 1; }
AUTH=(-H "Authorization: Bearer $TOKEN")

echo "[会话/收件箱列表]"
s=$(curl -s "${AUTH[@]}" "$GW/api/v1/chat/sessions")
{ [ "$(printf '%s' "$s" | jnum code)" = "0" ] && has "$s" '"data"'; } && ok "C1 GET /chat/sessions → code=0(新用户空列表)" || ng "C1 sessions" "code=0" "$s"
ck401=$(status "$GW/api/v1/chat/sessions"); [ "$ck401" = "401" ] && ok "C2 无 token /chat/sessions → 401" || ng "C2 no-token sessions" 401 "$ck401"

echo "[好友列表]"
f=$(curl -s "${AUTH[@]}" "$GW/api/v1/contact/friends")
{ [ "$(printf '%s' "$f" | jnum code)" = "0" ] && has "$f" '"data"'; } && ok "C3 GET /contact/friends → code=0(空列表)" || ng "C3 friends" "code=0" "$f"
f2=$(curl -s "${AUTH[@]}" "$GW/api/v1/contact/friends?limit=10")
has "$f2" '"hasMore"' && ok "C4 friends 返回 PageResult{items,nextCursor,hasMore}" || ng "C4 friends page shape" hasMore "$f2"

echo "[历史分页 + markRead 成员鉴权(非成员→403)]"
m=$(status "${AUTH[@]}" "$GW/api/v1/chat/session/9999999/messages?limit=5")
[ "$m" = "403" ] && ok "C5 非成员拉历史 → 403(真实 HTTP)" || ng "C5 history member-auth" 403 "$m"
r=$(status -X POST "${AUTH[@]}" -H 'Content-Type: application/json' -d '{}' "$GW/api/v1/chat/sessions/9999999/read")
[ "$r" = "403" ] && ok "C6 非成员 markRead → 403" || ng "C6 markRead member-auth" 403 "$r"

echo "============ PASS=$P FAIL=$F ============"
[ "$F" -eq 0 ] && echo "客户端 API 冒烟全绿 ✅" || { echo "存在失败 ❌"; exit 1; }
