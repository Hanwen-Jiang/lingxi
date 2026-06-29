#!/usr/bin/env bash
# P9 上线冲烟:对 WSL 运行态 :10010(生产端口、真实 InfiniteChat 库)验证统一鉴权 + IM + 内助手。
# 关键:确认 pre-P0「无鉴权」行为已消失(无 token/garbage → 401)。
set -uo pipefail
RUNTIME="${RUNTIME:-$HOME/projecta-runtime}"
set -a; . "$RUNTIME/chat.env"; set +a

GW="http://127.0.0.1:10010"; AGENT="http://127.0.0.1:18080"
DB(){ mysql -h127.0.0.1 -P3307 -u"$MYSQL_USERNAME" -p"$MYSQL_PASSWORD" InfiniteChat -N -e "$1" 2>/dev/null; }
RKEY(){ redis-cli -n "${REDIS_DATABASE:-0}" ${REDIS_PASSWORD:+-a "$REDIS_PASSWORD"} --no-auth-warning "$@" 2>/dev/null; }
PASS="Test@12345"; CODE="123456"
P=0; F=0
ok(){ echo "  ✅ $1"; P=$((P+1)); }
ng(){ echo "  ❌ $1  (expect=$2 got=$3)"; F=$((F+1)); }
status(){ curl -s -o /dev/null -w '%{http_code}' "$@"; }
jstr(){ grep -oE "\"$1\"[[:space:]]*:[[:space:]]*\"[^\"]*\"" | head -1 | sed -E 's/.*:[[:space:]]*"([^"]*)"/\1/'; }
jnum(){ grep -oE "\"$1\"[[:space:]]*:[[:space:]]*-?[0-9]+" | head -1 | grep -oE -- '-?[0-9]+$'; }
jwt_sub(){ local p m; p=$(printf '%s' "$1"|cut -d. -f2); m=$(( ${#p}%4 )); [ "$m" = 2 ]&&p="${p}=="; [ "$m" = 3 ]&&p="${p}="; printf '%s' "$p"|tr '_-' '/+'|base64 -d 2>/dev/null|sed -E 's/.*"sub":"?([^",}]*)"?.*/\1/'; }
nollm(){ printf '%s' "$1"|grep -qiE "未配置|not configured|MissingAiModel|Unavailable"; }
signup(){ local e="$1" l t u; RKEY set "verify:email:$e" "$CODE" EX 300 >/dev/null
  curl -s -X POST -H 'Content-Type: application/json' -d "{\"email\":\"$e\",\"password\":\"$PASS\",\"code\":\"$CODE\"}" "$GW/api/v1/user/register" >/dev/null
  l=$(curl -s -X POST -H 'Content-Type: application/json' -d "{\"email\":\"$e\",\"password\":\"$PASS\"}" "$GW/api/v1/user/login")
  t=$(printf '%s' "$l"|jstr token); u=$(printf '%s' "$l"|jstr userId); { [ -z "$u" ]||[ "$u" = "null" ]; }&&u=$(jwt_sub "$t"); echo "$t $u"; }

echo "=== P9 上线冲烟 (runtime :10010, 真实 InfiniteChat) ==="
curl -s -o /dev/null --max-time 4 "$GW/actuator/health" || { echo "网关 :10010 不可达"; exit 1; }

echo "[鉴权已上线:旧栈无鉴权行为应消失]"
ck=$(status "$GW/api/v1/contact/1/applyCount"); [ "$ck" = "401" ] && ok "R1 无 token 受保护接口 → 401(非旧栈放行)" || ng "R1 无 token" 401 "$ck"
cg=$(status -H 'Authorization: Bearer garbage.token.x' "$GW/api/v1/contact/1/applyCount"); [ "$cg" = "401" ] && ok "R2 garbage token → 401" || ng "R2 garbage" 401 "$cg"

echo "[邮箱登录(真实库)]"
ST=$(date +%H%M%S)
A=( $(signup "live_a_$ST@lingxi.test") ); AT="${A[0]:-}"; AID="${A[1]:-}"
B=( $(signup "live_b_$ST@lingxi.test") ); BT="${B[0]:-}"; BID="${B[1]:-}"
{ [ -n "$AID" ] && [ -n "$BID" ]; } && ok "R3 邮箱注册+登录拿 token (A=$AID B=$BID)" || { ng "R3 登录" "2 tokens" "A=$AID B=$BID"; echo "PASS=$P FAIL=$F"; exit 1; }

echo "[IM 发收(真实库落地)]"
SID="99${ST}"
DB "INSERT INTO session(id,name,type,status) VALUES($SID,'live-im',1,1)" >/dev/null
DB "INSERT INTO user_session(id,user_id,session_id,role,status) VALUES($((SID+1)),$AID,$SID,1,1),($((SID+2)),$BID,$SID,1,1)" >/dev/null
DB "INSERT INTO friend(id,user_id,friend_id,status) VALUES($((SID+3)),$AID,$BID,1),($((SID+4)),$BID,$AID,1)" >/dev/null
snd=$(curl -s -X POST -H "Authorization: Bearer $AT" -H 'Content-Type: application/json' \
  -d "{\"sessionId\":$SID,\"sendUserId\":$AID,\"sessionType\":1,\"type\":1,\"receiveUserId\":$BID,\"body\":{\"content\":\"live-$ST\",\"replyId\":null}}" "$GW/api/v1/chat/session")
[ "$(printf '%s' "$snd"|jnum code)" = "0" ] && ok "R4a 发消息 code=0" || ng "R4a 发消息" code=0 "$snd"
sleep 1
[ "$(DB "SELECT COUNT(*) FROM message WHERE session_id=$SID AND content='live-$ST'")" = "1" ] && ok "R4b 消息落真实库(B4 同事务)" || ng "R4b 落库" 1 "$(DB "SELECT COUNT(*) FROM message WHERE session_id=$SID")"
hist=$(curl -s -H "Authorization: Bearer $BT" "$GW/api/v1/chat/session/$SID/messages?limit=5")
printf '%s' "$hist"|grep -q "live-$ST" && ok "R4c B 拉历史含该消息" || ng "R4c 历史" "含消息" "$hist"

echo "[内助手 SSE 经网关 → agent]"
sse=$(curl -s -N --max-time 20 -H "Authorization: Bearer $AT" -H 'Content-Type: application/json' -d "{\"sessionId\":$SID,\"prompt\":\"你好灵犀\"}" "$GW/api/chat/auto/stream")
if printf '%s' "$sse"|grep -qiE "\"v\"|\"type\"|data:|未配置|Unavailable"; then
  ok "R5 /api/chat/auto/stream 经网关达 agent(SSE)"
  nollm "$sse" && echo "     (无 LLM key:model-unavailable)" || { printf '%s' "$sse"|grep -qE "\"type\"[[:space:]]*:[[:space:]]*\"delta\"" && ok "R5b 真实流式 delta"; }
else ng "R5 SSE" "SSE 事件" "$(printf '%s' "$sse"|head -c 160)"; fi

echo "[F01 工具确认令牌往返]"
f1=$(curl -s -H "Authorization: Bearer $AT" -H 'Content-Type: application/json' -d "{\"sessionId\":$SID,\"prompt\":\"给 test@example.com 发一封主题为live的邮件\"}" "$GW/api/agent/chat")
if nollm "$f1"; then echo "  ⏭ F01 跳过(无 LLM key)"
elif printf '%s' "$f1"|grep -q '"confirmationRequired"[[:space:]]*:[[:space:]]*true'; then
  CT=$(printf '%s' "$f1"|jstr challengeToken); [ -n "$CT" ] && ok "F01-1 confirmationRequired+challengeToken" || ng "F01-1" token "$f1"
  f2=$(curl -s -H "Authorization: Bearer $AT" -H 'Content-Type: application/json' -d "{\"sessionId\":$SID,\"prompt\":\"给 test@example.com 发一封主题为live的邮件\",\"confirmationToken\":\"$CT\"}" "$GW/api/agent/chat")
  printf '%s' "$f2"|grep -q '"confirmationRequired"[[:space:]]*:[[:space:]]*true' && ng "F01-2 应放行" "无 confirmationRequired" "$f2" || ok "F01-2 持令牌重发放行(一次性)"
else echo "  ⏭ F01 未触发高风险工具,响应: $(printf '%s' "$f1"|head -c 140)"; fi

echo "============ PASS=$P FAIL=$F ============"
[ "$F" -eq 0 ] && echo "上线冲烟全绿 ✅" || { echo "存在失败 ❌"; exit 1; }
