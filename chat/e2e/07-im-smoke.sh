#!/usr/bin/env bash
# IM 链路 E2E(P5 item1/2/4):B4 持久化所有权 + 历史分页 + 未读/markRead + 离线拉取 + 媒体。
# 不含 WS 实时(见 08-ws-realtime-smoke.sh)。前置:01/02/03 已执行,服务就绪。
set -uo pipefail
RUNTIME="${RUNTIME:-$HOME/projecta-runtime}"
REPO_E2E="${REPO_E2E:-/mnt/e/jhw/proj/chat/e2e}"
set -a; . "${CHAT_ENV:-$RUNTIME/chat.env}"; . "${E2E_ENV:-$REPO_E2E/e2e.env}"; set +a

GW="http://127.0.0.1:${GATEWAY_PORT:-10110}"
DB_SOCK="${E2E_DB_SOCK:-/home/hanwen/projecta-e2e/mysqld-e2e.sock}"
DB="mariadb --no-defaults -S $DB_SOCK -uroot InfiniteChat_e2e -N -e"
PASS="${E2E_PASSWORD:-Test@12345}"; CODE="123456"
P=0; F=0
ok(){ echo "  ✅ $1"; P=$((P+1)); }
ng(){ echo "  ❌ $1  (expect=$2 got=$3)"; F=$((F+1)); }
status(){ curl -s -o /dev/null -w '%{http_code}' "$@"; }
jstr(){ grep -oE "\"$1\"[[:space:]]*:[[:space:]]*\"[^\"]*\"" | head -1 | sed -E 's/.*:[[:space:]]*"([^"]*)"/\1/'; }
jnum(){ grep -oE "\"$1\"[[:space:]]*:[[:space:]]*-?[0-9]+" | head -1 | grep -oE -- '-?[0-9]+$'; }
jwt_sub(){ local p m; p=$(printf '%s' "$1" | cut -d. -f2); m=$(( ${#p} % 4 )); [ "$m" = 2 ] && p="${p}=="; [ "$m" = 3 ] && p="${p}="; printf '%s' "$p" | tr '_-' '/+' | base64 -d 2>/dev/null | sed -E 's/.*"sub":"?([^",}]*)"?.*/\1/'; }
sql(){ $DB "$1" 2>/dev/null; }
redis_cmd(){ redis-cli --no-auth-warning -h "${REDIS_HOST:-127.0.0.1}" -p "${REDIS_PORT:-6379}" -n "${REDIS_DATABASE:-5}" ${REDIS_PASSWORD:+-a "$REDIS_PASSWORD"} "$@"; }

# 注册+登录,回显 "token userId"
signup(){ local email="$1"
  redis_cmd set "verify:email:$email" "$CODE" EX 300 >/dev/null 2>&1
  curl -s -X POST -H 'Content-Type: application/json' -d "{\"email\":\"$email\",\"password\":\"$PASS\",\"code\":\"$CODE\"}" "$GW/api/v1/user/register" >/dev/null
  local login tok uid
  login=$(curl -s -X POST -H 'Content-Type: application/json' -d "{\"email\":\"$email\",\"password\":\"$PASS\"}" "$GW/api/v1/user/login")
  tok=$(printf '%s' "$login" | jstr token); uid=$(printf '%s' "$login" | jstr userId)
  { [ -z "$uid" ] || [ "$uid" = "null" ]; } && uid=$(jwt_sub "$tok")
  echo "$tok $uid"
}

echo "=== IM 链路 E2E (gw=$GW) ==="
curl -s -o /dev/null --max-time 3 "$GW/actuator/health" || { echo "网关不可达"; exit 1; }
sql "SELECT 1" >/dev/null || { echo "E2E 库不可达($DB_SOCK)"; exit 1; }

STAMP=$(date +%H%M%S)
A=( $(signup "imA_$STAMP@lingxi.test") ); AT="${A[0]}"; AID="${A[1]}"
B=( $(signup "imB_$STAMP@lingxi.test") ); BT="${B[0]}"; BID="${B[1]}"
{ [ -n "$AID" ] && [ -n "$BID" ]; } && ok "注册 A=$AID B=$BID" || { ng "注册" "2 ids" "A=$AID B=$BID"; echo "PASS=$P FAIL=$F"; exit 1; }

# 直插好友关系 + 会话 + 成员(单聊发送需 friendship + session 存在)
SID="88${STAMP}"
sql "INSERT INTO session(id,name,type,status) VALUES($SID,'e2e-im',1,1)"
sql "INSERT INTO user_session(id,user_id,session_id,role,status) VALUES($((SID+1)),$AID,$SID,1,1),($((SID+2)),$BID,$SID,1,1)"
sql "INSERT INTO friend(id,user_id,friend_id,status) VALUES($((SID+3)),$AID,$BID,1),($((SID+4)),$BID,$AID,1)"
seeded=$(sql "SELECT COUNT(*) FROM user_session WHERE session_id=$SID")
[ "$seeded" = "2" ] && ok "种子:会话 $SID + 双向好友 + 2 成员" || ng "seed" 2 "$seeded"

echo "[发消息 → B4 同事务持久化所有权]"
send=$(curl -s -X POST -H "Authorization: Bearer $AT" -H 'Content-Type: application/json' \
  -d "{\"sessionId\":$SID,\"sendUserId\":$AID,\"sessionType\":1,\"type\":1,\"receiveUserId\":$BID,\"body\":{\"content\":\"hello-b4-$STAMP\",\"replyId\":null}}" \
  "$GW/api/v1/chat/session")
sc=$(printf '%s' "$send" | jnum code)
[ "$sc" = "0" ] || [ "$sc" = "200" ] && ok "发送成功(code=$sc)" || ng "发送" "0/200" "$send"

# B4 核心断言:消息**立即**存在于 message 表(生产者事务内写,与 Kafka 消费无关)
sleep 1
mrow=$(sql "SELECT COUNT(*) FROM message WHERE session_id=$SID AND content='hello-b4-$STAMP' AND sender_id=$AID")
[ "$mrow" = "1" ] && ok "B4 message 行已由生产者事务写入(content+sender 正确)" || ng "B4 message 持久化" 1 "$mrow"
MID=$(sql "SELECT message_id FROM message WHERE session_id=$SID LIMIT 1")
obrow=$(sql "SELECT COUNT(*) FROM message_outbox WHERE message_id=$MID")
[ "$obrow" = "1" ] && ok "B4 message_outbox 同事务行存在(messageId=$MID)" || ng "B4 outbox 行" 1 "$obrow"
# created_at 非空(B4 生产者显式写,修了消费者 createAt/createdAt 名字不匹配导致的 null)
cnull=$(sql "SELECT COUNT(*) FROM message WHERE message_id=$MID AND created_at IS NOT NULL")
[ "$cnull" = "1" ] && ok "B4 message.created_at 非空(投影名错位已规避)" || ng "created_at" 1 "$cnull"

echo "[历史分页(成员鉴权)]"
hist=$(curl -s -H "Authorization: Bearer $BT" "$GW/api/v1/chat/session/$SID/messages?limit=10")
{ [ "$(printf '%s' "$hist" | jnum code)" = "0" ] && printf '%s' "$hist" | grep -q "hello-b4-$STAMP"; } && ok "B 拉历史含刚发的消息" || ng "history" "含消息" "$hist"

echo "[未读 + markRead]"
unread1=$(curl -s -H "Authorization: Bearer $BT" "$GW/api/v1/chat/sessions" | grep -oE "\"sessionId\"[^}]*" | grep "$SID" | grep -oE "\"unreadCount\"[^,}]*" | grep -oE '[0-9]+$' | head -1)
rd=$(curl -s -X POST -H "Authorization: Bearer $BT" -H 'Content-Type: application/json' -d '{}' "$GW/api/v1/chat/sessions/$SID/read")
[ "$(printf '%s' "$rd" | jnum code)" = "0" ] && ok "B markRead(code=0,unread 前=$unread1)" || ng "markRead" 0 "$rd"
lrm=$(sql "SELECT last_read_message_id FROM user_session WHERE user_id=$BID AND session_id=$SID")
[ "$lrm" = "$MID" ] && ok "last_read_message_id 推进到末条($lrm)" || ng "last_read 推进" "$MID" "$lrm"

echo "[离线拉取(读 message 表)]"
off=$(curl -s -H "Authorization: Bearer $BT" "$GW/api/v1/offline/message?userId=$BID&time=2020-01-01%2000:00:00")
printf '%s' "$off" | grep -q "hello-b4-$STAMP" && ok "离线拉取返回该消息" || ng "offline" "含消息" "$off"

echo "[媒体上传契约]"
mu=$(curl -s -X POST -H "Authorization: Bearer $AT" -H 'Content-Type: application/json' -d '{"fileName":"a.jpg","contentType":"image/jpeg","size":1024}' "$GW/api/v1/user/media/upload-url")
{ [ "$(printf '%s' "$mu" | jnum code)" = "0" ] && printf '%s' "$mu" | grep -q '"objectKey":"chat/'; } && ok "媒体预签名 code=0 + 用户隔离 key" || ng "media" "code=0" "$mu"

echo "[S4 缺口:会话列表带 peerUserId(冷开单聊可发)]"
sess=$(curl -s -H "Authorization: Bearer $BT" "$GW/api/v1/chat/sessions")
printf '%s' "$sess" | grep -oE "\{[^{}]*\"sessionId\":\"$SID\"[^{}]*\}" | grep -q "\"peerUserId\":\"$AID\"" \
  && ok "B 的会话 $SID peerUserId=$AID(对方)" || ng "peerUserId" "$AID" "$(printf '%s' "$sess" | grep -oE "\"peerUserId\":\"[^\"]*\"" | head -1)"

echo "[S4 缺口:图片消息历史持久化(url 落 content,修刷新丢图)]"
IMGURL="https://cdn.lingxi.test/img_$STAMP.jpg"
curl -s -X POST -H "Authorization: Bearer $AT" -H 'Content-Type: application/json' \
  -d "{\"sessionId\":$SID,\"sendUserId\":$AID,\"sessionType\":1,\"type\":2,\"receiveUserId\":$BID,\"body\":{\"url\":\"$IMGURL\",\"size\":2048}}" \
  "$GW/api/v1/chat/session" >/dev/null
sleep 1
imgrow=$(sql "SELECT COUNT(*) FROM message WHERE session_id=$SID AND type=2 AND content='$IMGURL'")
[ "$imgrow" = "1" ] && ok "图片消息 url 已落 message.content(刷新不丢)" || ng "图片 url 持久化" 1 "$imgrow"
imghist=$(curl -s -H "Authorization: Bearer $BT" "$GW/api/v1/chat/session/$SID/messages?limit=10")
printf '%s' "$imghist" | grep -q "$IMGURL" && ok "历史分页回显图片 url" || ng "图片历史回显" "含 url" "$imghist"

echo "============ PASS=$P FAIL=$F ============"
[ "$F" -eq 0 ] && echo "IM 链路 E2E 全绿 ✅" || { echo "存在失败 ❌"; exit 1; }
