#!/usr/bin/env bash
# E2E 冒烟测试：逐条验证本轮鉴权/正确性修复。每条打印 PASS/FAIL。
# 前置：01/02/03 已执行且服务已就绪(等待约 30-60s 让全部注册到 Nacos)。
set -uo pipefail

RUNTIME="${RUNTIME:-$HOME/projecta-runtime}"
REPO_E2E="${REPO_E2E:-/mnt/e/jhw/proj/chat/e2e}"
set -a; . "${CHAT_ENV:-$RUNTIME/chat.env}"; . "${E2E_ENV:-$REPO_E2E/e2e.env}"; set +a

GW="http://127.0.0.1:${GATEWAY_PORT:-10110}"
AUTH="http://127.0.0.1:${AUTH_SERVICE_PORT:-8182}"
CONTACT="http://127.0.0.1:${CONTACT_SERVICE_PORT:-8180}"
RTC="http://127.0.0.1:${REALTIME_SERVICE_PORT:-8183}"
PHONE="${E2E_PHONE:-13$(date +%j%H%M%S)}"
PASSWD="${E2E_PASSWORD:-Test@12345}"
CODE="123456"

P=0; F=0
ok(){ echo "  ✅ PASS  $1"; P=$((P+1)); }
ng(){ echo "  ❌ FAIL  $1  (expected=$2 got=$3)"; F=$((F+1)); }
ck(){ local d="$1" exp="$2" got="$3"; [ "$got" = "$exp" ] && ok "$d" || ng "$d" "$exp" "$got"; }
status(){ curl -s -o /dev/null -w '%{http_code}' "$@"; }
# 轻量 JSON 取值(无 python 依赖)：jstr 取字符串值，jnum 取数字值。
jstr(){ grep -oE "\"$1\"[[:space:]]*:[[:space:]]*\"[^\"]*\"" | head -1 | sed -E 's/.*:[[:space:]]*"([^"]*)"/\1/'; }
jnum(){ grep -oE "\"$1\"[[:space:]]*:[[:space:]]*-?[0-9]+" | head -1 | grep -oE -- '-?[0-9]+$'; }
# 从 JWT 取 sub(登录响应里 userId 当前为 null,真实 id 在 token 的 sub 声明)。
jwt_sub(){ local p m; p=$(printf '%s' "$1" | cut -d. -f2); m=$(( ${#p} % 4 )); [ "$m" = 2 ] && p="${p}=="; [ "$m" = 3 ] && p="${p}="; printf '%s' "$p" | tr '_-' '/+' | base64 -d 2>/dev/null | sed -E 's/.*"sub":"?([^",}]*)"?.*/\1/'; }

echo "=== E2E 冒烟测试  (gateway=$GW) ==="
if ! curl -s -o /dev/null --max-time 3 "$GW/actuator/health"; then
  echo "网关 $GW 不可达。请确认 03-start-apps.sh 已执行且服务已就绪(可 tail 日志)。"; exit 1
fi

echo "[鉴权网关]"
ck "T1 网关挡未带令牌的受保护请求 → 401" 401 "$(status "$GW/api/v1/contact/1/applyCount")"
ck "T2 网关挡无效令牌 → 401"            401 "$(status -H 'Authorization: Bearer garbage.token.x' "$GW/api/v1/contact/1/applyCount")"

echo "[健康检查不被拦截 (actuator 排除修复)]"
ck "T3 直连 Auth /actuator/health → 200" 200 "$(status "$AUTH/actuator/health")"

echo "[服务信任化：直连业务服务无凭证被拒]"
ck "T4 直连 Contact 无 X-User-Id/内部令牌 → 401" 401 "$(status "$CONTACT/api/v1/contact/1/applyCount")"

echo "[RTC HTTP 仅内部令牌]"
ck "T5 直连 RTC 推送接口 无 X-Internal-Token → 401" 401 \
   "$(status -X POST -H 'Content-Type: application/json' -d '{}' "$RTC/api/v1/message/user")"
got=$(status -X POST -H 'Content-Type: application/json' -H "X-Internal-Token: ${INTERNAL_SERVICE_TOKEN}" -d '{}' "$RTC/api/v1/message/user")
[ "$got" != "401" ] && ok "T6 带正确 X-Internal-Token → 非401 (got=$got)" || ng "T6 带内部令牌应放行" "!=401" "$got"

echo "[注册(BCrypt) + 登录(签发JWT)]"
redis-cli --no-auth-warning -n "${REDIS_DATABASE:-5}" ${REDIS_PASSWORD:+-a "$REDIS_PASSWORD"} \
  set "register:code:$PHONE" "$CODE" EX 300 >/dev/null 2>&1 || echo "  (warn: redis-cli 预置验证码失败，检查 REDIS_PASSWORD/REDIS_DATABASE)"
reg=$(curl -s -X POST -H 'Content-Type: application/json' \
  -d "{\"phone\":\"$PHONE\",\"password\":\"$PASSWD\",\"code\":\"$CODE\"}" "$GW/api/v1/user/register")
ck "T7 注册成功 code=200" 200 "$(printf '%s' "$reg" | jnum code)"

login=$(curl -s -X POST -H 'Content-Type: application/json' \
  -d "{\"phone\":\"$PHONE\",\"password\":\"$PASSWD\"}" "$GW/api/v1/user/login")
TOKEN=$(printf '%s' "$login" | jstr token)
UID_=$(jwt_sub "$TOKEN")
[ -n "$TOKEN" ] && ok "T8 登录拿到 token (userId=$UID_)" || ng "T8 登录应返回 token" "non-empty" "empty: $login"

if [ -n "$TOKEN" ] && [ -n "$UID_" ]; then
  echo "[带令牌访问 + 网关注入 X-User-Id]"
  got=$(status -H "Authorization: Bearer $TOKEN" "$GW/api/v1/contact/$UID_/applyCount")
  [ "$got" != "401" ] && ok "T9 带 token 访问受保护接口 → 非401 (got=$got)" || ng "T9 带 token 应放行" "!=401" "$got"

  echo "[操作人收敛：越权被拒]"
  ck "T10 以他人 userId(=1) 发动态但 token 是自己 → 403" 403 \
     "$(status -X POST -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
        -d '{"userId":"1","text":"e2e","mediaUrls":[]}' "$GW/api/v1/moment")"

  echo "[防伪造：网关覆盖客户端伪造的 X-User-Id]"
  got=$(status -H "Authorization: Bearer $TOKEN" -H 'X-User-Id: 999999' "$GW/api/v1/contact/$UID_/applyCount")
  [ "$got" != "401" ] && [ "$got" != "403" ] && ok "T11 伪造 X-User-Id 被剥离，仍按 token 用户处理 (got=$got)" \
     || ng "T11 伪造头应被网关覆盖" "!=401/403" "$got"
else
  echo "  (跳过 T9-T11：未取得 token/userId)"
fi

echo "============================================"
echo "结果：PASS=$P  FAIL=$F"
[ "$F" -eq 0 ] && echo "全部通过 ✅" || { echo "存在失败 ❌"; exit 1; }
