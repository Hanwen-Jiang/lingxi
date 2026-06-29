#!/usr/bin/env bash
# IM 实时闭环 E2E(P5 item2):B 经浏览器式 WS 握手(?token=&userUuid=,B8)连上 →
# A 发消息 → B 的 WS **实时收到** MESSAGE_NOTIFICATION 帧。依赖 websocat。
set -uo pipefail
RUNTIME="${RUNTIME:-$HOME/projecta-runtime}"
REPO_E2E="${REPO_E2E:-/mnt/e/jhw/proj/chat/e2e}"
set -a; . "${CHAT_ENV:-$RUNTIME/chat.env}"; . "${E2E_ENV:-$REPO_E2E/e2e.env}"; set +a

GW="http://127.0.0.1:${GATEWAY_PORT:-10110}"
NETTY="${NETTY_SERVICE_PORT:-9100}"
DB_SOCK="${E2E_DB_SOCK:-/home/hanwen/projecta-e2e/mysqld-e2e.sock}"
DB="mariadb --no-defaults -S $DB_SOCK -uroot InfiniteChat_e2e -N -e"
PASS="${E2E_PASSWORD:-Test@12345}"; CODE="123456"
P=0; F=0
ok(){ echo "  ✅ $1"; P=$((P+1)); }
ng(){ echo "  ❌ $1  (expect=$2 got=$3)"; F=$((F+1)); }
jstr(){ grep -oE "\"$1\"[[:space:]]*:[[:space:]]*\"[^\"]*\"" | head -1 | sed -E 's/.*:[[:space:]]*"([^"]*)"/\1/'; }
jwt_sub(){ local p m; p=$(printf '%s' "$1" | cut -d. -f2); m=$(( ${#p} % 4 )); [ "$m" = 2 ] && p="${p}=="; [ "$m" = 3 ] && p="${p}="; printf '%s' "$p" | tr '_-' '/+' | base64 -d 2>/dev/null | sed -E 's/.*"sub":"?([^",}]*)"?.*/\1/'; }
sql(){ $DB "$1" 2>/dev/null; }
redis_cmd(){ redis-cli --no-auth-warning -h "${REDIS_HOST:-127.0.0.1}" -p "${REDIS_PORT:-6379}" -n "${REDIS_DATABASE:-5}" ${REDIS_PASSWORD:+-a "$REDIS_PASSWORD"} "$@"; }
signup(){ local email="$1" login tok uid
  redis_cmd set "verify:email:$email" "$CODE" EX 300 >/dev/null 2>&1
  curl -s -X POST -H 'Content-Type: application/json' -d "{\"email\":\"$email\",\"password\":\"$PASS\",\"code\":\"$CODE\"}" "$GW/api/v1/user/register" >/dev/null
  login=$(curl -s -X POST -H 'Content-Type: application/json' -d "{\"email\":\"$email\",\"password\":\"$PASS\"}" "$GW/api/v1/user/login")
  tok=$(printf '%s' "$login" | jstr token); uid=$(printf '%s' "$login" | jstr userId)
  { [ -z "$uid" ] || [ "$uid" = "null" ]; } && uid=$(jwt_sub "$tok"); echo "$tok $uid"; }

WSCLIENT="${REPO_E2E}/_ws_recv.py"; [ -f "$WSCLIENT" ] || WSCLIENT="$(dirname "$0")/_ws_recv.py"
command -v python3 >/dev/null || { echo "需要 python3"; exit 1; }
echo "=== IM 实时 WS 闭环 E2E (netty=$NETTY) ==="
curl -s -o /dev/null --max-time 3 "$GW/actuator/health" || { echo "网关不可达"; exit 1; }

STAMP=$(date +%H%M%S)
A=( $(signup "rtA_$STAMP@lingxi.test") ); AT="${A[0]}"; AID="${A[1]}"
B=( $(signup "rtB_$STAMP@lingxi.test") ); BT="${B[0]}"; BID="${B[1]}"
SID="77${STAMP}"
sql "INSERT INTO session(id,name,type,status) VALUES($SID,'e2e-rt',1,1)"
sql "INSERT INTO user_session(id,user_id,session_id,role,status) VALUES($((SID+1)),$AID,$SID,1,1),($((SID+2)),$BID,$SID,1,1)"
sql "INSERT INTO friend(id,user_id,friend_id,status) VALUES($((SID+3)),$AID,$BID,1),($((SID+4)),$BID,$AID,1)"
ok "种子:A=$AID B=$BID 会话=$SID"

echo "[B 浏览器式 WS 握手 ?token=&userUuid= (B8)]"
WSOUT=$(mktemp)
# 纯 stdlib WS 客户端后台连接 ~18s,持续打印收到的文本帧
python3 "$WSCLIENT" 127.0.0.1 "$NETTY" "/api/v1/netty?token=$BT&userUuid=$BID" 18 > "$WSOUT" 2>>"$WSOUT" &
WSPID=$!
sleep 4
route=$(redis_cmd get "user:session:$BID" 2>/dev/null)
[ -n "$route" ] && ok "握手成功 + 路由注册 user:session:$BID=$route(B8 query 鉴权通过)" || ng "WS 握手/路由" "non-empty" "empty(WS: $(head -c 200 "$WSOUT"))"

echo "[A 发消息 → B 实时收到]"
MSG="ws-rt-$STAMP"
curl -s -X POST -H "Authorization: Bearer $AT" -H 'Content-Type: application/json' \
  -d "{\"sessionId\":$SID,\"sendUserId\":$AID,\"sessionType\":1,\"type\":1,\"receiveUserId\":$BID,\"body\":{\"content\":\"$MSG\",\"replyId\":null}}" \
  "$GW/api/v1/chat/session" >/dev/null
# 等推送到达 WS
for i in 1 2 3 4 5 6; do grep -q "$MSG" "$WSOUT" && break; sleep 1; done
if grep -q "$MSG" "$WSOUT"; then
  ok "B 的 WS 实时收到该消息(内容匹配)"
  grep -qE '"type"[[:space:]]*:[[:space:]]*2' "$WSOUT" && ok "推送帧 type=2 MESSAGE_NOTIFICATION" || ng "推送帧类型" "type=2" "$(head -c 200 "$WSOUT")"
else
  ng "B 实时收消息" "含 $MSG" "$(head -c 300 "$WSOUT")"
fi

kill "$WSPID" 2>/dev/null; wait "$WSPID" 2>/dev/null
rm -f "$WSOUT"
echo "============ PASS=$P FAIL=$F ============"
[ "$F" -eq 0 ] && echo "IM 实时 WS 闭环全绿 ✅" || { echo "存在失败 ❌"; exit 1; }
