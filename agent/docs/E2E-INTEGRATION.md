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
| `/api/actuator/health` | 健康检查 | **白名单(免鉴权)** |

> P3/P5 已在 main:S3 网关用 `${AGENT_GATEWAY_URI:http://localhost:18080}` 路由到 agent。E2E 只需把 `AGENT_GATEWAY_URI` 指向 E2E 段 agent 端口(见 §2)。

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

---
*维护:S1。P6 配套硬化:F01 Redis 原子 GETDEL、限流 Redis 令牌桶(均带进程内降级)。Redis/网关真路径需 S3 在常驻 WSL 会话内实跑确认。*
