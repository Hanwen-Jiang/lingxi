# S1 · agent-backend 工作计划

> 本文是 **S1 / agent-backend 流**(`agent/` 目录,Spring Boot 3.5 + LangChain4j AI 服务)的权威工作计划。**仅规划,不含代码。**
>
> 契约级出处是 `00-master-plan.md`(决策 D1–D9、端口表、路线图 P0–P3、提交约定),本文不得与之冲突;改进项明细见 `01-improvement-audit.md`,F 项原始证据见 `agent/docs/IMPROVEMENTS.md`,API 面证据见 `.artifacts/wf_extract.txt`。状态同步走 `STATUS.md` 的 **S1** 小节。

---

## 1. 角色与现状

**agent-backend = InfiniteChat 的一等公民 AI 助手服务。** 独立 `pom.xml`、独立运行栈:LangChain4j AI Service + ReAct 编排 + 工具治理 + 混合检索 RAG + 长期记忆 + 守护轨(guardrail)。与 chat 微服务**分库、无跨栈外键**(D6),终端体验上是"消息 + 助手"一个产品,代码层是清晰的第二后端。

### 1.1 S1 已完成(DONE,见 `STATUS.md` S1 小节)

| 项 | 内容 | 状态 |
| --- | --- | --- |
| 文档体系重建 | 删旧文档地图,重写 `agent/docs/README.md` + `01..10-*.md` 共 12 份学习文档,15 张 mermaid,交叉链接无断链 | ✅ 已提交(分支 `docs/agent-backend-learning`) |
| 审计沉淀 | `agent/docs/IMPROVEMENTS.md`(F01–F22,对抗式复核,22 条全部确认真实) | ✅ |
| Postman | 保留迁移到 `agent/docs/postman/` | ✅ |

> 结论:**文档不是阻断项**,本计划聚焦代码侧改造。

### 1.2 构建 / 健康事实

| 维度 | 现状 |
| --- | --- |
| 编译 | 已声明 Lombok + `annotationProcessorPaths`,可编译(早期审计"不可编译"已过期) |
| 构建命令 | `mvnw test`(独立 maven wrapper) |
| 运行态 | 当前在 **WSL 原生** 跑,监听 **10011**(探测实况) |
| prod 目标端口 | **18080**(内网,经网关;D1) |
| 鉴权 | **无 Spring Security / SecurityFilterChain**,唯一 filter 是全开放 CORS |
| DDL | **零 Flyway / 零 DDL**(元数据/记忆/审计/PgVector 表均无版本化) |
| 数据库 | 目标独立 `agent` 库(D6) |
| 健康端点 | `/api/actuator/{health,info,prometheus}`(context-path 为 `/api`) |

### 1.3 头号真实阻断(本计划要解决的)

1. **整体无鉴权 + CORS 通配带凭据 + 不在网关之后**(B1 / M1 / M17 / F02 / F03)——IDOR/SSRF 面。
2. **未鉴权即可运行时改全局模型配置**(B3 / G09)——SSRF + apiKey 外泄。
3. **userId 类型 / 响应包络 / 错误模型不一致**(M13 / G02-G04),阻断单一前端同时对接两后端。
4. **流式仅部分增量、无版本**(M14 / G05)。
5. **RAG 用 SHA-256 哈希伪向量 + 阈值不匹配 → 向量召回近乎为 0**(M15 / F06 / F07)。

---

## 2. 必须遵守的契约级决策(D1–D9)

> 决策唯一出处是 `00-master-plan.md §5`;本表只列 **S1 适用项**及 S1 的落地动作。不在此拍板,任何分歧写 `STATUS.md` 的"待中枢确认"。

| ID | 决策要点 | 是否管 S1 | S1 必须做什么 |
| --- | --- | --- | --- |
| **D1 端口** | 网关唯一对外;agent 移出 10010 | ✅ | `application.yml` + `.env.example` 默认 `SERVER_PORT=18080`(内网);E2E 段 +100(18180,与中枢端口表零冲突);**不再把 10010 写进任何默认值**。 |
| **D2 统一身份** | 单一签发 + 网关单点验签 + 下游只信头 | ✅ | agent 与网关/全部 chat 服务共用**同一** `JWT_SECRET_KEY`;agent 自身不签发令牌,只消费网关注入的可信 `X-User-Id`;`X-User-Id` 为空一律 **401**(去掉 null 跳过)。 |
| **D3 agent 入网关** | agent 不再裸奔 | ✅ **核心** | 配合 S3 在网关加 `/api/agent\|memory\|rag` 路由并纳入验签;agent 侧加 `GatewayIdentityFilter`(无 `X-User-Id` 直接拒,挡直连)+ `@CurrentUser` 参数解析主体 + **删除请求体里的 `userId`**;`model-config` 需 **admin**。 |
| **D4 响应包络** | 全栈统一 + 真实 HTTP 状态 + SSE 版本化 | ✅ **核心** | 统一为 `{code,message,data,traceId,timestamp}`;**停止"全 200 + 体内 code"**,错误映射真实 HTTP(401/403/404/422/429/5xx);补 `@Valid`/DTO 校验 + OpenAPI 标注 bearer scheme;SSE 事件 schema **显式版本化**。 |
| **D5 ID 类型** | JSON 内统一 string 化 snowflake | ✅ | agent DTO 对外用 **String** id;持久化边界再转内部 Long(走 expand/contract 双写双读,迁移 `memory`/`audit` 列 + DTO);解决 "网关 subject 是 String、agent 期望 Long" 的类型分叉(G02)。 |
| **D6 数据边界** | 分库,仅经网关共享身份 | ✅ | agent 用独立 `agent` 库;**不共享表、无跨栈外键**;Flyway 仅管 agent 自有的元数据/记忆/审计/PgVector。 |
| **D7 E2E 隔离** | 隔离并存,端口 +100 | ⚠️ 弱相关 | agent E2E 端口落 **18180**;库/Redis/Nacos 命名空间随中枢 `60-e2e-test-environment.md` 伞约定;权威可执行实现归 S3 `chat/e2e/`。 |
| **D8 设计系统** | 单一来源,两端共享 | ❌ | 与 S1 无关(S4 牵头、S2 消费)。 |
| **D9 ID 生成** | Snowflake workerId 按实例派生 | ⚠️ 弱相关 | agent 自身若用 snowflake 持久化,workerId 也须按实例派生避免碰撞;主责在 S3。 |

---

## 3. 改进 backlog(S1 所有权,按严重度)

> 每条一行:**标题 · 改动量 · 修复方向 · 来源**。仅列 S1 拥有的项(B1/B3、M1/M4 后端侧/M13/M14/M15/M16 伞/M17/M18 后端侧、L8/L9/L10/L15–L21)。

### 3.1 🔴 阻断项

| # | 标题 | 改动量 | 修复方向 | 来源 |
| --- | --- | --- | --- | --- |
| B1 | 整体无鉴权,userId 取自体/参 → IDOR(可读改任意用户记忆/审计) | 大 | 置于网关后 + `GatewayIdentityFilter` 信任注入的 `X-User-Id`;主体派生 userId,删体内 userId,按主体限权全部记忆/审计端点 | F02 + G01/G10 |
| B3 | 未鉴权即可运行时改全局 LLM provider/baseURL/model/apiKey(SSRF + 密钥外泄) | 中 | `model-config` 需 admin、不收原始 apiKey、审计变更;CORS 收白名单 | G09 |

### 3.2 🟠 主要项

| # | 标题 | 改动量 | 修复方向 | 来源 |
| --- | --- | --- | --- | --- |
| M1 | CORS 通配 origin + allowCredentials,无 profile 门控 | 小 | 显式白名单 origin(profile 化);无 cookie 凭据则关 allowCredentials;收紧暴露头/方法 | F03 |
| M4(后端侧) | 工具确认无状态,confirmedTools 可伪造 | 中(后端部分) | 服务端生成一次性 confirmation challenge(userId/sessionId/动作指纹 + TTL,存 Redis),客户端回传 token 而非工具名,确认须经认证 | F01 |
| M13 | userId 类型 / 响应包络 / 错误模型不一致 | 中 | String 化 subject + 统一包络 `{code,message,data,traceId,timestamp}` + 错误映射真实 HTTP | G02/G03/G04 |
| M14 | 流式契约只部分增量、无文档/版本 | 中 | 文档化并版本化 SSE schema;为 rag/agent 实现真流式或显式标 `buffered` 模式字段 | G05 |
| M15 | RAG 哈希伪向量 + 阈值不匹配,向量召回近乎为 0 | 中 | 真实 `EmbeddingModel`(DashScope `text-embedding-v4` / 本地 `bge-m3`)接 `@Primary`;检索召回阈值与引用展示阈值**解耦**(检索低/无阈值),阈值随真模型标定 | F06 + F07 |
| M16(伞,挂 agent) | 零容器化 / 零 DB 迁移 / 端口冲突 | 大 | agent 侧:Dockerfile + 引入 Flyway(元数据/记忆/审计/PgVector 版本化)+ 端口 18080;**加唯一键前先去重历史脏数据** | ONBOARDING(仍开放) |
| M17 | agent 不在网关之后、与 chat 不共享身份 | 中 | 入网关 + 共享 `JWT_SECRET_KEY`(与 B1 同批) | F02 / G01 |
| M18(后端侧) | 核心编排/治理/检索几乎零单测 | 中 | 为治理决策矩阵、planner 路由、证据评估阈值、RRF 融合补单测(mock `ChatModel`/`JdbcTemplate`) | F21 |

### 3.3 🟡 轻微项(打磨 / 已知取舍 / 技术债)

| # | 标题 | 改动量 | 修复方向 | 来源 |
| --- | --- | --- | --- | --- |
| L8 | OpenAPI 未鉴权暴露;列表端点无分页元数据;DTO 无校验(`@Valid` 死代码) | 中 | Swagger 加 bearer scheme + prod 收口;`Page{items,total,nextCursor}` 包装;`spring-boot-starter-validation` + DTO 注解 + `@Valid` | G11/G06/G07 |
| L9 | LLM 计费端点无限流/配额 | 中 | 按主体限流(键 = 认证 userId),429 + Retry-After | G08 |
| L10 | 响应 DTO null 策略不一、toolTrace 为裸 Object | 小 | 全项目统一 `JsonInclude` 策略;`Object toolTrace` 换 typed `ToolTrace` DTO | G12 |
| L15 | 工具审计同步阻塞在请求主链路 | 中 | 审计改异步(`@Async`/事件/写队列批量),写失败只告警 | F04 |
| L16 | 关键词检索 `LIKE %term%` 全表扫 + 中文不分词 | 中 | MySQL 全文索引(ngram)或外部引擎(ES/PGroonga);中文接分词;避免前导通配 LIKE | F08 |
| L17 | 文档入库跨 MySQL/向量库无事务无补偿(含已插未嵌入永久跳过) | 中 | "先写状态再异步建向量" outbox/对账;单文档失败清理;入库状态 + 重建任务 | F09 |
| L18 | 证据评估 `topScore` 混用四种量纲取 max | 小 | 按来源归一化或统一单一可比口径,阈值绑定该口径并文档化 | F11 |
| L19 | ReAct 实为单步分发,非真多步 TAO 循环 | 中 | 真迭代循环:observation 回喂 planner 直到 `FINAL_ANSWER`/步数上限;`reactTrace` 记多步 | F13 |
| L20 | 注入检测仅固定子串黑名单,易绕过 | 小 | 规范化 + 模糊匹配/分类模型/LLM 审查;注入检测与业务关键词解耦降误杀 | F14 |
| L21 | 一组已知设计/可维护取舍 | 中 | F05(重排冷却换 Resilience4j 半开)/F10(降级重建+维度单配置)/F12(提高 max-rounds/接 LLM 改写)/F15(`InputSafetyService` 注册为 Bean)/F16(去重走库侧匹配)/F17(嵌入相似度去重+中文分词)/F18(`EmailTool` 返回结构化结果)/F19(`ObjectMapper` 序列化)/F20(各阶段不可变副本)/F22(窗口/魔法值统一配置注入) | IMPROVEMENTS 同号 |

---

## 4. 分阶段计划 P0 → P3

> 与 `00-master-plan.md §7` 路线图对齐。`[并行]` = 无前置可即开;`[串行依赖 Sx/契约]` = 需等某流或某契约定稿。破坏性变更一律 **expand/contract**(双写双读/版本化)。交接落 `STATUS.md`。

### P0 — 可构建 · 可本地一键起 · 止住明显滥用

| 工作项 | 标签 | 来源 | 出口判据 |
| --- | --- | --- | --- |
| 端口 10010 → 18080(`application.yml` + `.env.example`),E2E 段 18180 | `[并行]`(与 S2 改 api base 协同) | D1 / M16 | 无端口冲突;agent 不再占 10010 |
| 引入 Flyway + 基线 DDL(元数据/记忆/审计/PgVector) | `[并行]` | D6 / M16 / F09 | Flyway 可确定性建 `agent` 库 |
| **止损 1**:`model-config` 加 admin 校验 + 不收原始 apiKey | `[并行]` | B3 / G09 | 无未鉴权端点可改全局模型/baseURL/key |
| **止损 2**:CORS 收白名单(profile 化),按需关 allowCredentials | `[并行]` | M1 / F03 | 通配带凭据组合消除 |
| **止损 3**:`/memory/item\|disable` 按主体先做最小限权(过渡,等 B1 闭环) | `[并行]` | B1 / G10 | 猜 memoryId 越权读改被堵住 |
| 加 Dockerfile;jetbrains:annotations 钉死版本 | `[并行]` | M16 | `docker-compose up` 能拉起 agent |
| CI:`mvnw test` 跑起来(为 M18 铺路) | `[并行,HUB 牵头]` | M18 | CI 绿 |

**P0 出口**:agent 可容器化一键起、端口无冲突;无未鉴权端点可改模型/读改他人记忆;Flyway 可确定性建库。

### P1 — 统一鉴权 + 统一契约(破坏性,走 expand/contract)

| 工作项 | 标签 | 来源 | 交接 / 解锁 |
| --- | --- | --- | --- |
| 网关加 agent 路由并纳入验签 + 统一 `JWT_SECRET_KEY`(**双密钥过渡窗**) | `[串行依赖 S3 网关 + D2 契约]` | M17 / D2 | S3 改网关,S1 验证拒直连 |
| `GatewayIdentityFilter`(无 `X-User-Id` 拒)+ `@CurrentUser` + **删体内 userId** | `[串行依赖 上一项]` | B1 / D3 / F02 | **IDOR 闭环** |
| D4 包络统一 + 真实 HTTP 状态(**版本化 API**,前端按版本切) | `[并行,与 S3 拉齐 shape]` | M13 / D4 / G03/G04 | ⟶ **解锁 S2** typed 客户端 |
| D5 ID 全栈 string 化(**双写双读迁移** memory/audit 列 + DTO) | `[串行依赖 D5]` | M13 / D5 / G02 | ⟶ **解锁 S2** id 处理 |
| SSE schema 版本化 + 文档化(`event`/`version`/fatal-vs-recoverable) | `[并行]` | M14 / G05 | ⟶ **解锁 S2** 流式 UI |
| 补 `@Valid`/DTO 校验 + OpenAPI bearer scheme | `[并行]` | L8 / G06/G07/G11 | 字段级错误返回 |
| LLM 计费端点按主体限流(429 + Retry-After) | `[并行]` | L9 / G08 | 计费端点防滥用 |
| Actuator/Micrometer + OTel 链路 + 结构化日志(调试集成缝) | `[并行]` | M18 周边 | 集成缝可观测 |

**P1 出口**:agent 仅经网关可达、**拒直连**;一次登录的 JWT 同时认证 chat + agent;无端点信任客户端 userId(IDOR 闭环);单一 typed 前端可消费统一包络 + 版本化 SSE。

### P2 — 功能补全(RAG 真嵌入 + 工具确认后端)

| 工作项 | 标签 | 来源 | 出口 |
| --- | --- | --- | --- |
| **RAG 真嵌入**:真实 `EmbeddingModel` 接 `@Primary`;检索/展示阈值解耦并按真模型标定 | `[并行]` | M15 / F06/F07 | 向量召回不再近乎为 0;"混合检索"名副其实 |
| 工具确认后端闸:一次性 challenge token(Redis,带 TTL/指纹) | `[串行依赖 P1 鉴权]` | M4 / F01 | confirmedTools 不可伪造 ⟶ 配合 S2 确认 UX |
| 关键词检索改全文索引 + 中文分词 | `[并行]` | L16 / F08 | 语料增大不线性劣化 |
| 文档入库 outbox/对账 + 失败清理 | `[并行]` | L17 / F09 | 无悬空 chunk / 孤儿行 |
| 工具审计异步化 | `[并行]` | L15 / F04 | 审计不计入用户时延 |
| 核心逻辑补单测(治理/planner/证据/RRF) | `[并行]` | M18 / F21 | 关键纯逻辑有回归保护 |

**P2 出口**:IM 内置可用助手(按真实用户隔离记忆/RAG);RAG 语义召回可用;高风险工具确认是可信服务端闸。

### P3 — 生产硬化

| 工作项 | 标签 | 来源 |
| --- | --- | --- |
| 证据评估量纲归一(F11)、ReAct 真多步循环(F13)、注入检测升级(F14) | `[并行]` | L18/L19/L20 |
| L21 一揽子取舍清理(F05/F10/F12/F15/F16/F17/F18/F19/F20/F22) | `[并行]` | L21 |
| LLM 成本治理:按用户/租户 token 预算配额、按模型分级路由、成本指标进 Prometheus、kill-switch | `[并行]` | 00-master §8 |
| Swagger prod 收口、actuator 鉴权、密钥轮换 | `[并行]` | L8 / 00-master §7 P3 |
| 响应 DTO 统一 `JsonInclude` + typed `ToolTrace` | `[并行]` | L10 / G12 |

**P3 出口**:全链路 trace/metrics;计费端点配额可控;每条可靠性出口绑定命名测试。

---

## 5. 对外契约要点(权威端点清单)

> **context-path = `/api`**,经网关后对外前缀为 `/api/agent|memory|rag|chat`(D3)。所有端点最终落于网关之后,**裸连一律 401**。"鉴权"列:`认证` = 需有效 JWT(网关注入 `X-User-Id`);`admin` = 需 admin 角色。

### 5.1 对话 / 助手

| 方法 + 路径 | 说明 | 流式 | 鉴权 |
| --- | --- | --- | --- |
| `POST /api/chat` | 直接对话 | 否 | 认证 |
| `POST /api/chat/auto` | 自动路由对话 | 否 | 认证 |
| `POST /api/chat/auto/stream` | 自动路由 + SSE | **是(direct 真流式)** | 认证 |
| `POST /api/streamChat` | 直接对话 SSE | **是** | 认证 |
| `POST /api/agent/chat` | ReAct 助手,接 `confirmedTools[]` | rag/agent 整段一帧(M14,待真流式) | 认证 |
| `GET /api/agent/tools` | 列工具 | 否 | 认证 |
| `GET /api/agent/tools/audit` | 工具审计记录 | 否 | 认证(按主体限权,B1) |

### 5.2 RAG

| 方法 + 路径 | 说明 | 流式 | 鉴权 |
| --- | --- | --- | --- |
| `POST /api/rag/chat` | RAG 对话 | 整段一帧(M14) | 认证 |
| `POST /api/rag/adaptive/chat` | 自适应 RAG | 整段一帧(M14) | 认证 |
| `POST /api/rag/documents/text` | 文本入库 | 否 | 认证 |
| `POST /api/rag/documents/local-ingest` | 本地路径入库(已限根目录) | 否 | 认证(建议 admin) |
| `POST /api/rag/documents/upload` | 多文件上传(multipart) | 否 | 认证 |
| `GET /api/rag/documents/jobs/{id}` | 入库任务状态 | 否 | 认证 |

### 5.3 记忆

| 方法 + 路径 | 说明 | 鉴权 |
| --- | --- | --- |
| `GET/POST /api/memory/context`、`/api/memory/agent/context` | 取记忆上下文 | 认证(主体派生 userId,B1) |
| `POST /api/memory/write` | 写记忆 | 认证 |
| `GET /api/memory/user/{userId}` | 列用户记忆 | 认证(校验主体 == 目标) |
| `POST /api/memory/correct` | 纠错(先停用同类型活跃记忆再覆盖) | 认证(高危,严格限权) |
| `POST /api/memory/reflection` | 反思 | 认证 |
| `POST /api/memory/item\|disable` | 单条/停用 | 认证(**按主体限权,B1/G10**) |

### 5.4 会话 / 模型配置

| 方法 + 路径 | 说明 | 鉴权 |
| --- | --- | --- |
| `GET /api/chat/sessions?limit=` | 列会话(分页元数据待补,L8) | 认证(主体派生,不再收 body userId) |
| `GET /api/chat/sessions/{id}` | 取会话 | 认证 |
| `POST /api/chat/sessions` | 建会话 | 认证 |
| `POST /api/chat/sessions/{id}/summarize` | 会话摘要 | 认证 |
| `GET /api/chat/model-status`、`GET /api/chat/models` | 模型状态/列表 | 认证 |
| `POST /api/chat/model-config` | 运行时改 provider/baseURL/model/apiKey | **admin(B3/D3),不收原始 apiKey,审计变更** |

### 5.5 SSE 事件 schema(待版本化,D4 / M14 / G05)

- 包络版本字段:每个 SSE 流声明 `version`(如 `v1`),前端按版本切换解析。
- 事件类型至少区分:`delta`(增量 token)、`citation`/`tool`(结构化中间态)、`done`(`[DONE]` 哨兵)、`error`(**显式区分 fatal vs recoverable**)。
- 非增量路由(rag/adaptive/agent)在转为真流式前,**显式标 `buffered` 模式字段**,避免前端 token-by-token UI 假死后整段冒出。

### 5.6 统一包络(D4)

```
{ "code": <业务码>, "message": <文案>, "data": <载荷|null>, "traceId": <链路id>, "timestamp": <ms> }
```
错误**映射真实 HTTP 状态**(401/403/404/422/429/5xx),停止"全 200 + 体内 code";`code` 与 HTTP 状态一致;`data` null 策略全项目统一(L10)。

---

## 6. 给其他流的交接与依赖

| 方向 | 内容 | 关联 |
| --- | --- | --- |
| **S1 ⟶ S2** | P1 的**身份契约**(`X-User-Id` 注入 + 网关后只发 JWT)+ **统一包络** + **版本化 SSE schema** 定稿后,解锁 S2 的登录 UI、typed 客户端、流式渲染。S2 auth UI **串行依赖** 本契约。 | 00-master P1;STATUS 中枢下达 S2 |
| **S1 ⟶ S2** | **稳定的 api base behind gateway**:agent 端口 18080 内网,前端走相对 `/api`(S2 已记 bug:`api.ts` 默认指向了 10010 chat 网关)。 | D1;STATUS S2 |
| **S1 ⟶ S2** | **D5 id string 化** 定稿后,S2 才能定 id 处理(避免 Long 精度丢失)。 | D5 / G02 |
| **S1 ⟵ S3** | 网关加 `/api/agent\|memory\|rag` 路由并验签 + 统一 `JWT_SECRET_KEY` 是 S1 入网关的**前置**,需 S3 改网关。S1 入网关 **串行依赖 S3 网关改造**。 | D3;STATUS S3 |
| **S1 ⟷ S3** | 包络 / 错误 shape / 分页约定与 chat 拉齐(避免单一前端两套分支);共用 `chat-common`(Result/JwtUtil/错误码)由 S3 牵头抽取。 | 00-master P1;M13/L4 |
| **S1 ⟵ HUB** | E2E 端口 18180、库/命名空间随 `60-e2e-test-environment.md` 伞约定;chat 专项可执行实现归 S3。 | D7;C1 |

> 跨流改他流目录前,先在 `STATUS.md` 写"交接"。本流默认只动 `agent/`。

---

## 7. 完成约定

- 每完成一个工作单元,在 `docs/planning/STATUS.md` 的 **S1 · agent 后端** 小节**顶部追加**一条记录(最新在上),用文件内模板:`完成 / 产出物 / 关键决策 / 阻塞 / 交接 / 待中枢确认`。**不改他流记录。**
- 契约级问题(端口/鉴权/包络/ID/数据边界)**不在本文或 STATUS 拍板**,写"待中枢确认",由中枢落 `00-master-plan.md` 决策登记。
- 提交遵循 `00-master-plan.md §9`:分支 `feat/agent-backend-<topic>` / `fix/agent-backend-...` / `docs/agent-backend-...`;纯文档/隔离改动可提交,跨契约破坏性改动等中枢拉齐;默认不合并 main、不强推;信息结尾附仓库惯例署名。
- 破坏性变更(D4 包络、D5 id、统一密钥)走 **expand/contract**:双写双读 / 版本化 / 双密钥过渡 + 回滚预案;**加唯一键前先去重历史脏数据**。

---
*维护者:S1。本文遵从 `00-master-plan.md` 契约级决策,更新需同步 `STATUS.md` 的 S1 小节。*
