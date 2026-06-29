# agent 入统一 E2E 栈 + 「灵犀」内助手对接清单(S1 → S3/S4/S2)

> 目的:把 agent-backend(Spring Boot 3.5,`:18080`,context-path `/api`)纳入 chat 的统一网关 E2E 栈(E2E 段网关 `:10110`),让 S4 的 IM 内助手端到端跑通。本清单是 P6 的 J1 交付。

## 1. 网关路由(S3 在 `GateWay/application.yml` 的 E2E 配置加)

agent 提供这些前缀(均在 context-path `/api` 下,**转发须保留 `/api` 前缀**:`/api/agent/**` → agent 的 `/api/agent/**`):

| 网关路径 | 用途 | 鉴权 |
| --- | --- | --- |
| `/api/agent/**` | ReAct 助手(`/api/agent/chat`、`/api/agent/tools`、`/api/agent/tools/audit`) | 验签 + 注入 X-User-Id/Roles |
| `/api/rag/**` | RAG 问答 / 文档入库 | 同上 |
| `/api/memory/**` | 四层记忆读写 | 同上 |
| `/api/chat`、`/api/chat/auto`、`/api/chat/auto/stream` | 直连/自动路由对话(含 SSE) | 同上 |
| `/api/streamChat` | 逐 token 流式对话(SSE) | 同上 |
| `/api/actuator/health` | 健康检查(聚合) | **白名单(免鉴权)** |
| `/api/actuator/health/readiness` | **就绪探针(Redis 无关)** | **白名单(免鉴权)** |
| `/api/actuator/health/liveness` | 存活探针(仅 ping) | **白名单(免鉴权)** |

> P3/P5 已在 main:S3 网关用 `${AGENT_GATEWAY_URI:http://localhost:18080}` 路由到 agent。E2E 只需把 `AGENT_GATEWAY_URI` 指向 E2E 段 agent 端口(见 §2)。
>
> ⚠️ **健康探针选型(P7 实测要点)**:Redis/PgVector/DashScope 均可选(全有降级)。**主 `/api/actuator/health` 在 Redis 降级时返 503**(诚实聚合,redis 指示器 DOWN 可见)——故**就绪门控/LB/k8s 探针请打 `/api/actuator/health/readiness`(降级态仍 200,只看 ping+db)**,否则会把「可服务但 Redis 降级」误判为宕机。09/10 脚本现打主 `/health` 仅查可达性(连得上即过),不受影响;但若加 HTTP-200 断言,请改打 `/health/readiness`。该分组随 P7 jar 内置;若用旧 jar 可临时 env 覆盖 `MANAGEMENT_ENDPOINT_HEALTH_GROUP_READINESS_INCLUDE=ping,db`。

## 2. agent 启动所需 env(S3 加进 `e2e.env` + 起 agent 服务)

**硬依赖极少**——除端口与 enforce 外,其余缺失都优雅降级,不挡 E2E 起服务:

| env | E2E 取值 | 说明 |
| --- | --- | --- |
| `SERVER_PORT` | `18180`(+100 段)或自定 | agent 监听端口;须与 `AGENT_GATEWAY_URI` 一致 |
| `AGENT_GATEWAY_ENFORCE_IDENTITY` | `true` | 置于网关后:无网关注入的 `X-User-Id` 直连一律 401 |
| `SPRING_PROFILES_ACTIVE` | `e2e`(可选) | — |
| `REDIS_HOST`/`PORT`/`PASSWORD`/`DATABASE` | E2E Redis(独立 db) | F01 挑战令牌 + 限流令牌桶用;**缺失则降级**(F01 进程内、限流进程内固定窗口),单实例 E2E 可接受 |
| `DASHSCOPE_API_KEY` | 真 key(可选) | 有则真实 LLM + text-embedding-v4 语义检索;无则聊天走 Unavailable 提示、RAG 嵌入降级哈希 |
| `MYSQL_*` | E2E agent 库(可选) | 缺失降级 H2 内存(`agent.local-fallback.enabled=true`);Flyway 默认 off,SchemaInitializer 自建表 |
| `PGVECTOR_*` | E2E Postgres(可选) | 缺失降级内存向量库 |

> **agent 不持 `JWT_SECRET_KEY`**:它**不自验/不签发 JWT**,只消费网关注入的 `X-User-Id`/`X-User-Roles`(契约 §1/§7)。网关验签后注入即可。

**最小可达**:只设 `SERVER_PORT` + `AGENT_GATEWAY_ENFORCE_IDENTITY=true` 即可起服务并经网关可达(其余全降级)。

## 3. 鉴权 E2E 断言(agent 侧应验)

1. **经网关带 token → 200**:`POST :10110/api/agent/chat`(Authorization: Bearer <jwt>)→ 网关注入 `X-User-Id` → agent 200,记忆/RAG 按该 userId 隔离。
2. **直连无头 → 401**:`POST :18180/api/agent/chat`(无 `X-User-Id`)→ agent `GatewayIdentityFilter` 返 401(`code=40100`)。
3. **伪造头被剥离**:客户端经网关带自造 `X-User-Id` → **网关剥离/覆盖**为 token 真实 userId(此为网关职责,同 chat T11);agent 只信入站头,故 agent:port **必须仅内网可达**、不直接对外。

## 4. SSE §9 事件 schema(S4 内助手解析,已 live)

事件信封 `{v, type, ...}`,SSE `event` 名 = `type`:

```jsonc
{ "v": "1", "type": "start|delta|usage|done|error",
  "sessionId": "<string id>", "text": "<增量或整段>",
  "buffered": true,            // 非真增量路由(整段一次性 delta)显式 true;逐 token 路由省略
  "citations": [ ... ],        // 一般在 done(RAG/agent 路由)
  "route": "...", "code": 0, "message": "..." }
```

- `v` **必带**(当前 `"1"`);前端按版本兼容、**未知 type 须容忍**(`usage` 当前保留未发)。
- **`POST /api/chat/auto/stream`**:自动路由;**agent/RAG 工具路由 = `buffered:true`** 整段一次性;direct 路由逐 token(省略 buffered)。
- **`POST /api/streamChat`**:逐 token 真增量(buffered 省略)。
- **隔离**:记忆(四层)/RAG 全程按网关 `X-User-Id`,无 body userId 残留(P3 已收敛)。

## 5. F01 工具确认挑战令牌形状(S2 的 M4,已 live)

命中高风险工具(如 `email_send`)未确认时,`/api/agent/chat` 或 `/api/chat/auto` 返回:

```jsonc
"data": { "toolGovernance": {
    "confirmationRequired": true,
    "challengeToken": "<服务端一次性 token>",
    "challengeExpiresInSec": 300 } }
```

- 客户端确认后**原 prompt 重发并带 `confirmationToken=<challengeToken>`**(`AgentRequest.confirmationToken`,**不要再传工具名**)。
- token **一次性 + TTL + 绑定 (userId,sessionId,工具指纹)**;过期/失败需重新触发拿新 token。
- 存储:Redis(P6 改原子 GETDEL 消费,多实例安全);无 Redis 降级进程内(单实例)。`confirmedTools` 已废弃(challenge 启用时忽略)。

## 6. 运行态部署(P9 实测,真实库)— 给 S3 烘进 09/e2e.env

P9 已把 agent 部署到 **WSL 运行态 `:18080`,接真实库**并经网关跑通 A1–A4(`PASS=5`)。真实库连接参数(已实测可用):

| env | 实测值 | 说明 |
| --- | --- | --- |
| `MYSQL_URL` | `jdbc:mysql://127.0.0.1:3308/agent?...&serverTimezone=Asia/Shanghai&useSSL=false&allowPublicKeyRetrieval=true` | **真实 agent 库**(P9 已 `CREATE DATABASE agent`);`MYSQL_USERNAME/PASSWORD=e2e/e2e`;SchemaInitializer/MemorySchemaInitializer 自建表 |
| `REDIS_HOST/PORT/PASSWORD` | `127.0.0.1:6379` + e2e 密码;`REDIS_DATABASE=6` | 真实 Redis(F01/限流令牌桶/短期记忆);实测 `agent_ratelimit_decisions{backend=redis}` 证令牌桶走 Redis |
| `AGENT_GATEWAY_ENFORCE_IDENTITY` | `true` | 直连无头 401、经网关 200 |
| `PGVECTOR_HOST/PORT` | 显式指向不可达(如 `:5499`)| **无可用凭据 → 显式降级内存向量库**(readiness 仍 200) |
| `DASHSCOPE_API_KEY` | 空 | 无 key → LLM/嵌入降级;填真 key 验真实 delta + `ai_model_*` 指标 |

> ⚠️ **运行态已被 P9 替换**:原 `:18080` 是 S3 `09` 的 pre-P7 降级实例(`db=H2`、无 readiness 分组),P9 已停它并起 **当前 main 的真实库实例**(setsid 常驻,jar 在 `/mnt/e/jhw/proj-agent-p9/agent/target/`)。S3 重启时请把上表 env 烘进 `09-agent-e2e.sh`/`e2e.env`(替换原硬编码 `MYSQL_URL→:3399`/`REDIS→:6399` 降级值)。
>
> **可观测**:`/api/actuator/prometheus` 导出 `ai_model_*`(低基数:model_name+status,P9 去 user/session 高基数)、`agent_ratelimit_decisions_total{result,backend}`、`agent_rag_query_duration_seconds{result}`、`agent_memory_op_duration_seconds{op,result}`。
>
> **actuator 姿态(P9 task3)**:暴露面最小(仅 `health,info,prometheus`,无 `env/heapdump/threaddump/loggers`);`/actuator/**` 在网关身份白名单内(供内网 prometheus 抓取),依赖 **agent:port 仅内网可达**(契约 §1)。未加 actuator Basic 鉴权——在不对外路由的内网口上加鉴权只增摩擦(且会断 prometheus 抓取/S3 health);若 agent:port 将来外露,建议改用 localhost 绑定的独立 `management.server.port`。

---
*维护:S1。P6 配套硬化:F01 Redis 原子 GETDEL、限流 Redis 令牌桶(均带进程内降级)。Redis/网关真路径需 S3 在常驻 WSL 会话内实跑确认。*
*P7 本机实测(`java -jar` 降级态 MySQL→H2/Redis→:6399/PgVector→:5499/enforce=true/无 DASHSCOPE):agent 正常起;`db=H2 UP`;A2 直连无头 `/api/agent/tools`→**401**;带 `X-User-Id`→**200**(返 `code:0` 工具列表,身份消费+包络双证);新增就绪分组 `/health/readiness`→**200**、`/health/liveness`→**200**、主 `/health`→**503**(诚实)。网关侧 A3/A4(经网关注入/SSE 真流式)仍需 S3 在 WSL 栈实跑。*
