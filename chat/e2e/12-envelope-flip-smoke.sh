#!/usr/bin/env bash
# item3 包络翻转回归(P8):Contact/Offline/Moment 翻 chat-common 后,成功 code=0 + 错误真实 HTTP。
set -uo pipefail
RUNTIME="${RUNTIME:-$HOME/projecta-runtime}"
REPO_E2E="${REPO_E2E:-/mnt/e/jhw/proj/chat/e2e}"
set -a; . "${CHAT_ENV:-$RUNTIME/chat.env}"; . "${E2E_ENV:-$REPO_E2E/e2e.env}"; set +a
GW="http://127.0.0.1:${GATEWAY_PORT:-10110}"
PASS="${E2E_PASSWORD:-Test@12345}"; CODE="123456"
P=0; F=0
ok(){ echo "  ✅ $1"; P=$((P+1)); }
ng(){ echo "  ❌ $1  (expect=$2 got=$3)"; F=$((F+1)); }
status(){ curl -s -o /dev/null -w '%{http_code}' "$@"; }
jstr(){ grep -oE "\"$1\"[[:space:]]*:[[:space:]]*\"[^\"]*\"" | head -1 | sed -E 's/.*:[[:space:]]*"([^"]*)"/\1/'; }
jnum(){ grep -oE "\"$1\"[[:space:]]*:[[:space:]]*-?[0-9]+" | head -1 | grep -oE -- '-?[0-9]+$'; }
jwt_sub(){ local p m; p=$(printf '%s' "$1"|cut -d. -f2); m=$(( ${#p} % 4 )); [ "$m" = 2 ]&&p="${p}=="; [ "$m" = 3 ]&&p="${p}="; printf '%s' "$p"|tr '_-' '/+'|base64 -d 2>/dev/null|sed -E 's/.*"sub":"?([^",}]*)"?.*/\1/'; }
redis_cmd(){ redis-cli --no-auth-warning -h "${REDIS_HOST:-127.0.0.1}" -p "${REDIS_PORT:-6379}" -n "${REDIS_DATABASE:-5}" ${REDIS_PASSWORD:+-a "$REDIS_PASSWORD"} "$@"; }

echo "=== item3 包络翻转回归 (gw=$GW) ==="
curl -s -o /dev/null --max-time 3 "$GW/actuator/health" || { echo "网关不可达"; exit 1; }
EMAIL="flip_$(date +%j%H%M%S)@lingxi.test"
redis_cmd set "verify:email:$EMAIL" "$CODE" EX 300 >/dev/null 2>&1
curl -s -X POST -H 'Content-Type: application/json' -d "{\"email\":\"$EMAIL\",\"password\":\"$PASS\",\"code\":\"$CODE\"}" "$GW/api/v1/user/register" >/dev/null
login=$(curl -s -X POST -H 'Content-Type: application/json' -d "{\"email\":\"$EMAIL\",\"password\":\"$PASS\"}" "$GW/api/v1/user/login")
T=$(printf '%s' "$login"|jstr token); U=$(printf '%s' "$login"|jstr userId); { [ -z "$U" ]||[ "$U" = "null" ]; }&&U=$(jwt_sub "$T")
[ -n "$T" ] && ok "登录(userId=$U)" || { ng "登录" token "$login"; echo "PASS=$P FAIL=$F"; exit 1; }
A=(-H "Authorization: Bearer $T")

echo "[Contact 翻 code=0]"
c=$(curl -s "${A[@]}" "$GW/api/v1/contact/$U/applyCount")
[ "$(printf '%s' "$c"|jnum code)" = "0" ] && ok "GET /contact/{uid}/applyCount → code=0" || ng "contact applyCount" code=0 "$c"

echo "[Offline 翻 code=0 + 越权真实 403]"
o=$(curl -s "${A[@]}" "$GW/api/v1/offline/message?userId=$U&time=2020-01-01%2000:00:00")
[ "$(printf '%s' "$o"|jnum code)" = "0" ] && ok "GET /offline/message(自己) → code=0" || ng "offline self" code=0 "$o"
o403=$(status "${A[@]}" "$GW/api/v1/offline/message?userId=1&time=2020-01-01%2000:00:00")
[ "$o403" = "403" ] && ok "GET /offline/message(他人) → 真实 403(非 200)" || ng "offline 越权真实HTTP" 403 "$o403"

echo "[Moment 翻 code=0]"
m=$(curl -s "${A[@]}" "$GW/api/v1/moment/list/$U?time=2020-01-01%2000:00:00")
[ "$(printf '%s' "$m"|jnum code)" = "0" ] && ok "GET /moment/list/{uid} → code=0" || ng "moment list" code=0 "$m"

echo "[无 token → 网关 401]"
n=$(status "$GW/api/v1/contact/$U/applyCount")
[ "$n" = "401" ] && ok "无 token /contact → 401" || ng "no-token" 401 "$n"

echo "============ PASS=$P FAIL=$F ============"
[ "$F" -eq 0 ] && echo "item3 翻转回归全绿 ✅" || { echo "存在失败 ❌"; exit 1; }
