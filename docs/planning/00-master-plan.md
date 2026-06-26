# InfiniteChat 总体规划(Master Plan)

> 面向生产落地的总体规划。本文是契约级决策的唯一出处:端口、统一鉴权、响应包络、ID 类型、数据边界、提交约定都以此为准。各工作流(S1–S4)的具体计划见 `10/20/30/40-*.md`,状态同步见 `STATUS.md`。
>
> 编写依据:`agent/docs/IMPROVEMENTS.md`、`PROJECT_AUDIT_ONBOARDING.md`、`infinitechat-web/DESIGN.md`,以及本轮 9-agent 跨项目深度分析(归档 `.artifacts/wf_extract.txt`)与对 WSL 运行态的只读探测。

> **产品名:灵犀(Lingxi)**(2026-06-26 拍板,取代旧名 InfiniteChat;"InfiniteChat" 保留为内部代号)。品牌细则见 `02-branding.md`。

## 1. 一句话愿景

**灵犀(Lingxi)= 一个 AI 原生的社交沟通产品**:单体大仓、两套后端运行栈(Spring Cloud IM 平台 + LangChain4j Agent 服务)、统一网关 + 统一身份 + 统一设计系统;终端用户体验为"消息 + 助手"一个产品(助手人格即"灵犀"),代码层保持两个前端两套后端清晰边界。Slogan:**懂你的,不只是消息。**

## 2. 组成与当前命名状态(2026-06-26 磁盘实况)

| 子项目 | 目录(现状) | 拟定名 | 角色 | 备注 |
| --- | --- | --- | --- | --- |
| AI Agent 服务 | `agent/` | **agent-backend** | Spring Boot 3.5 + LangChain4j | 更名未执行;见 `agent/docs/RENAME-NOTICE.md` |
| IM 微服务后端 | `chat/` | **chat-backend** | Spring Boot 2.6 + Spring Cloud Alibaba,7 服务 | 更名未执行;自带独立 git;见 `chat/docs/RENAME-NOTICE.md` |
| Agent 前端 | `agent-frontend/` | **agent-frontend** | React19+Vite+TS+HeroUI Pro | **更名已完成**;旧 `frontend/` 现为空壳(待删) |
| IM 前端 | `chat-frontend/` | **chat-frontend** | 绿地脚手架(Vite+React+TS) | 已脚手架,尚无真实页面 |
| 设计原型 | `infinitechat-web/` | (不改名,降级) | 高保真 HeroUI 风格原型(messages+assistant) | **降级为不发布的设计系统参考** |

## 3. 协调模型(中枢 + 四流)

- **HUB(本目录)** 维护契约级决策、综合规划、冲突仲裁;只产文档。
- **S1 agent-backend / S2 agent-frontend / S3 chat-backend / S4 chat-frontend** 各拥有自己的目录、各自写代码。
- **同步点 = `STATUS.md`**:开工前读、收工后写(模板见该文件)。跨流改动写"交接";需中枢拍板的写"待中枢确认"。
- **依赖方向(谁挡谁):** S1/S3 的契约与 API ⟶ 解锁 S2/S4。详见 §7 路线图的并行/串行标注。

## 4. 目标架构

```text
        Edge:单一反向代理(nginx/Ingress)—— TLS + 静态 SPA + /api/** 转发
                                   │
                    chat Spring Cloud Gateway(唯一对外 API 入口, :10010)
        AuthGlobalFilter:验签一次 → 注入可信 X-User-Id(剥离客户端伪造)→ 下游只信任该头
          ├── /api/v1/**            → chat 6 微服务(Auth/Contact/Messaging/RealTime/Offline/Moment)
          ├── /api/v1/netty (WS)    → NettyService(:9000,推送/ACK/心跳)
          └── /api/agent|memory|rag → agent-backend(:18080,内网)  ← 新增路由,纳入同一鉴权
                                   │
   共享中间件:MySQL(分库:InfiniteChat / agent)· Redis · Nacos(注册+配置)· Kafka(outbox+DLQ)· Postgres+PgVector(RAG)· 对象存储(COS/MinIO)
   可观测:7 chat 服务 + agent 全量 Actuator/Micrometer/Prometheus + OTel 链路追踪 + 集中日志
   前端:agent-frontend、chat-frontend 两个独立 SPA,共享 @infinitechat/design-system
```

要点:**agent 置于 chat 网关之后**,两栈共用一个 JWT、一个 CORS、一个 origin;`userId` 全栈不再由客户端提供,只来自网关注入的 `X-User-Id`。

## 5. 决策登记(契约级,各流必须遵守)

| ID | 决策 | 取值 | 影响流 |
| --- | --- | --- | --- |
| **D1 端口** | 网关唯一对外;agent 移出 10010 | 网关 `10010`;agent `SERVER_PORT=18080`(内网,经网关);chat 内部服务 8080-8086/Netty 9000;**E2E 段一律 +100**(网关 10110…),与线上零冲突 | S1,S2,S3,S4 |
| **D2 统一身份** | 单一签发 + 网关单点验签 + 下游只信头 | Auth 签发短期 access JWT(HS256,sub=string 化 snowflake,roles 声明)+ 刷新令牌;`JWT_SECRET_KEY` 在网关/全部 chat 服务/agent **完全一致**;网关把 agent 前缀纳入验签;下游 `X-User-Id` 为空一律 401(去掉 null 跳过)。 | S1,S3 |
| **D3 agent 入网关** | agent 不再裸奔 | 网关加 `/api/agent|memory|rag` 路由并验签;agent 加 `GatewayIdentityFilter`:无 `X-User-Id` 直接拒(挡直连),`@CurrentUser` 解析主体,删除请求体里的 `userId`;`model-config` 需 admin。 | S1,S3 |
| **D4 响应包络** | 全栈统一 | `{code,message,data,traceId,timestamp}`;错误映射真实 HTTP 状态(401/403/404/422/429/5xx),**停止"全 200+体内 code"**;SSE 事件 schema 显式版本化。 | S1,S3,S2,S4 |
| **D5 ID 类型** | JSON 内统一 string 化 snowflake | 避免 Long 精度/类型分叉;agent 在持久化边界再转内部 Long(需迁移列/DTO,走 expand/contract)。 | S1,S3 |
| **D6 数据边界** | **分库,仅经网关共享身份** | chat 用 `InfiniteChat` 库、agent 用 `agent` 库,**不共享表、无跨栈外键**;两栈只在网关相遇(同一 userId 空间)。简化 Flyway 布局、备份与爆炸半径。 | S1,S3 |
| **D7 E2E 隔离** | 隔离并存,不停线上 | 库 `*_e2e` · Redis 独立 db · Nacos 命名空间 `e2e` · 独立 Kafka · 端口 +100;**Nacos 用命名空间(非 group)**,因 NettyServer 固定 DEFAULT_GROUP。权威实现见 `chat/e2e/`。 | S3,HUB |
| **D8 设计系统** | 单一来源,两端共享 | `@infinitechat/design-system`(token 来自 DESIGN.md + HeroUI Pro 封装 + verify-ui),**S4 牵头**、S2 消费;infinitechat-web 不发布。 | S2,S4 |
| **D9 ID 生成** | 多实例安全 | Snowflake workerId/datacenterId **按实例**从 env/hostname/Nacos 实例 id 派生(现全为 1,横向扩容会主键碰撞)。 | S3 |
| **D10 agent-frontend 定位** | **面向终端用户的产品**(2026-06-26 拍板) | 需完整消费级 IA(参 DESIGN.md)、按产品标准锁紧;`model-config` 等管理能力收为 **admin-only 屏**,普通用户不可见;不可把内部/实现术语暴露给 UI。 | S2 |
| **D11 多设备** | **延后**(2026-06-26 拍板) | 首版单设备;已读指针用 **每用户游标**(`last_read_message_id` per (user,session)),不做每设备游标/跨设备同步;WS 仍单通道(新登录覆盖旧通道)。后续再扩。 | S3,S4 |
| **D12 产品名** | **灵犀 / Lingxi**(2026-06-26 拍板) | 对外品牌=灵犀(中)/Lingxi(英),助手人格名"灵犀",Slogan"懂你的,不只是消息";旧名 InfiniteChat 降为内部代号。**用户可见层即刻采用,包名/artifactId/projecta 代号先不动**。细则见 `02-branding.md`。 | 全体 |
| **D13 仓库形态** | **保持单一 monorepo**(2026-06-27 拍板) | 四子项目 + `packages/*`(共享设计系统)+ `docs/planning` 同处一个 git 仓库(`github.com/Hanwen-Jiang/lingxi`,private),**不拆分子仓**。npm 根 workspace 含 `packages/*` + 两个前端;Java 子项目独立 Maven 构建但同仓。跨子项目改动经 `STATUS.md` 协调 + 中枢集成检查点合 main。 | 全体 |

> 仍开放、需用户拍板的项见 §9 与 `STATUS.md`「待用户拍板」。

## 6. 现状校准:哪些早期审计已过期(重要)

本轮直读现源码发现 `PROJECT_AUDIT_ONBOARDING.md` 多处 P0 **已修复**,规划不再把它们当阻断项:

- ✅ agent 已声明 Lombok + annotationProcessorPaths(可编译)。
- ✅ chat 配置已全部外置为 `${ENV:default}`,yml 内无硬编码密钥;两后端均有 `.env.example`。
- ✅ chat 网关已有**真实** JWT 验签(`AuthGlobalFilter`+`GatewayJwtUtil`,读 `JWT_SECRET_KEY`)+ 注入可信 X-User-Id + 白名单;`INTERNAL_SERVICE_TOKEN` 存在。
- ✅ agent `RagDocumentController` 已把入库限制在配置根目录(路径穿越已修)。

**仍真实存在的头号阻断项**(详见 `01-improvement-audit.md`):
1. **agent 整体无鉴权 + CORS 通配带凭据 + 不在网关之后**(IDOR/SSRF 面)。
2. **agent-frontend 无登录、userId 写死 1、未鉴权即可改全局模型/baseURL/apiKey**。
3. **chat 消息仅由 Kafka 消费者落库 + 无 DLQ**(单条毒消息或消费中断→全站历史丢失)。
4. **chat 缺浏览器可用的 WS 握手 + 会话列表/历史分页/好友列表/未读 API**(前端无法渲染核心页面)。
5. **全仓零容器化 / 零 DB 迁移 / 零 CI/CD + 10010 端口冲突**。

## 7. 路线图(已按"先安全先止损"重排序)

> 重排原则(吸收完整性评审):数据丢失级修复前置;基础限流/校验随鉴权落 P1;可观测性提前到 P1/P2 以便调试集成缝;破坏性变更走 expand/contract(双写双读/版本化)。`[并行]`/`[串行依赖X]` 标注协调关系。

### P0 — 可构建 · 可本地一键起 · 止住明显滥用
- D1 端口落地(agent 18080;agent-frontend api base 改相对 `/api`)。`[S1,S2]`
- 删空壳 `frontend/`(待句柄释放);补根 README + 根 `.gitignore`(.artifacts/*.log/*.png/证书 JSON)。`[HUB,S2]`
- 容器化:docker-compose(MySQL/Redis/Nacos/Kafka KRaft/Postgres+PgVector/MinIO + 各后端);各服务 Dockerfile;chat 补 Maven wrapper;jetbrains annotations 钉死版本。`[S1,S3]`
- DB 迁移:两后端引入 Flyway,全部 chat 表 + agent 元数据/记忆/审计 + PgVector 表版本化;**加唯一键前先去重**(见迁移安全 §8)。`[S1,S3]`
- 止损:agent `model-config` 加 admin 且不收原始 apiKey;CORS 收白名单(profile);`/memory/item|disable` 按主体限权。`[S1]`
- 前端卫生:拆 `App.tsx` 巨石 + hooks;ErrorBoundary/ESLint/Prettier/Vitest;Vite `/api` proxy。`[S2]`
- CI:agent `mvnw test`、chat `mvn verify`、前端 typecheck+lint+build、gitleaks/CVE 扫描。`[HUB 牵头]`
- **出口**:`docker-compose up` 一键起、无端口冲突;无未鉴权端点可改模型/读改他人记忆;CI 绿且能挡构建/密钥失败;Flyway 可确定性建库。

### P1 — 统一鉴权 + 统一契约(破坏性,走 expand/contract)
- 网关加 agent 路由并纳入验签;统一 `JWT_SECRET_KEY`(**双密钥过渡窗**避免一刀切登出);抽 `chat-common`(单 Result/JwtUtil/错误码/按实例 Snowflake/共享消息 DTO)。`[S3,S1]`
- D4 包络统一 + 真实 HTTP 状态(**版本化 API**,前端按版本切换,避免一次性全断)。`[S1,S3]`
- agent 身份强制(GatewayIdentityFilter + @CurrentUser + 删体内 userId);chat 去掉 null-context 跳过;D5 ID 全栈 string 化(**双写双读迁移**)。`[S1,S3]`
- 令牌刷新 `POST /api/v1/user/refresh` + 缩短 access TTL。`[S3]`
- **基础限流提前到此**:对 LLM 计费端点与 chat 发消息/好友申请加按主体限流(429+Retry-After);补 `@Valid`/DTO 校验。`[S1,S3]`
- **可观测性提前**:全服务 Actuator/Micrometer + OTel 链路 + 结构化日志 + Kafka lag/DLQ 指标,用于调试集成缝。`[S1,S3]`
- agent-frontend 接入登录:登录页、令牌存储、Authorization 注入、真实 userId 贯通。`[S2,串行依赖 S1 鉴权契约]`
- D9 Snowflake 按实例派生;把 pending-ACK + channel 状态移到 Redis(为多节点铺路)。`[S3]`
- **出口**:两后端仅经网关可达、agent 拒直连;一次登录的 JWT 同时认证 chat+agent;无端点信任客户端 userId(IDOR 闭环);单一 typed 客户端可消费统一包络;任两实例无主键碰撞。

### P2 — 功能补全 + 助手入 IM
- **数据丢失级修复(本应更早,至少先于读 API):** 生产者与 outbox 同事务写 `message`(解耦"消息存在"与"kafka 已消费"),Offline 降为投影;Kafka 加 `DefaultErrorHandler`+DLQ+`ErrorHandlingDeserializer`+并发。`[S3]`
- 补 chat 客户端契约:会话列表(末条+未读)、历史分页(cursor+limit,按成员鉴权)、好友列表、`(user,session)` 已读指针 + markRead;**浏览器可用 WS 握手**(Sec-WebSocket-Protocol 或 `?token=&userUuid=`)。`[S3]` ⟶ 解锁 `[S4 联调]`
- chat 媒体上传契约(预签名 URL + content-type/size + CDN 下载 URL + 元数据)。`[S3]`
- 抽 `@infinitechat/design-system`;chat-frontend 绿地按 DESIGN.md IA 落地并接真实数据;助手入 IM(保留 `assistant` 会话流式 `/api/agent/chat`)。`[S4,S2]`
- agent-frontend:mode 选择接 `/chat,/rag,/agent`、工具确认 UX(confirmedTools+/agent/tools)、富引用、RAG 文档库、持久化。`[S2]`
- **RAG 真嵌入(别只名义上 RAG):** 把真实 EmbeddingModel 接为 @Primary,检索阈值与展示阈值解耦并按真模型标定(否则助手/RAG 形同失效)。`[S1]`
- **出口**:chat-frontend 能渲染收件箱/回滚历史/未读角标/浏览器连 WS/发媒体;消息历史能扛 Kafka 消费中断、毒消息进 DLQ 不阻塞;IM 内置可用助手(按真实用户隔离记忆/RAG);两端皆出自共享设计系统。

### P3 — 生产硬化 + 规模化
- 可观测性补全(若 P1/P2 未尽)、成本治理(见 §8)、实时规模化(Redis 化 pending-ACK + 跨节点补投 + 优雅下线清路由 + 批量扇出去 CallerRuns)、红包正确性(afterCommit 写 Redis/Kafka、retryCount 计数、REFUNDING 超时纳入退款扫描)、安全(actuator 鉴权、swagger 加 bearer 且 prod 收口、密钥轮换、CD 内 CVE 闸)、CD(分环境镜像构建/发布 + Flyway-on-deploy + 滚动/蓝绿)、负载/混沌测试。
- **出口**:全链路 trace/metrics;实时节点重启不丢已确认未投递;计费/发送端点限流;CD 能 dev→staging→prod 带迁移零停机。每条规模/可靠性出口都要有**量化 SLO + 命名测试**(吞吐、p99、最大消费 lag、恢复时间、注入故障下消息丢失=0)。

## 8. 横切关注(完整性评审补强)

- **迁移安全(expand/contract):** Long→String ID、统一密钥、包络统一、消息持久化所有权迁移都是破坏性变更——一律双写双读/版本化/双密钥过渡 + 回滚预案;**加唯一键 `(user_id,session_id)`/`friend(user_id,friend_id)` 前必须先去重历史脏数据**(已知存在并发产生的重复);`last_read_message_id` 回填策略(默认指向最新?影响首发未读)。
- **种子/系统主体:** 预留 `assistant` 系统会话/主体、首个 admin 引导、默认 model-config 行——都要有 seed 迁移并跨环境一致。
- **备份/容灾:** 给 MySQL/Postgres+PgVector/对象存储定 RPO/RTO 与备份节奏;**Redis 持久化决策(AOF vs 纯缓存)**——pending-ACK 与红包预拆都移到 Redis,若当缓存丢失会丢未投递消息与在途红包;Kafka 副本/保留;恢复演练作为出口。
- **LLM 成本治理:** 不止限流——按用户/租户 token 预算与配额、按模型分级路由(便宜模型做自动分流、贵模型做 agent)、成本指标进 Prometheus、异常告警与 kill-switch。
- **投递语义契约:** 显式声明 at-least-once + 客户端按 messageId 去重 + 会话内有序;**多设备已决延后(D11)**,`last_read_message_id` 用**每用户游标**(per (user,session)),WS 单通道。
- **可扩展量化:** Kafka 按 sessionId 保序与消费者扩容冲突(热会话成吞吐上限)——定分区数与热点策略;keyword LIKE 全表扫描随语料线性劣化(F08)按可扩展项对待。
- **测试策略(分层):** 单元 → 网关缝契约测试(X-User-Id 注入/包络统一/SSE schema)→ 关键链路 e2e(登录→发→投递→离线拉→已读;助手流式)→ 故障注入(毒消息 DLQ、节点崩溃补投、消费中断持久性)。每个 P 阶段出口都绑定一个能证明它的自动化测试。

## 9. 提交与版本约定

- 各流改动**在自己的子目录**,用分支:`feat/<scope>-<topic>`、`fix/<scope>-...`、`docs/<scope>-...`(scope ∈ agent-backend/agent-frontend/chat-backend/chat-frontend/planning)。
- **纯文档/隔离改动可提交**(如 S1 的学习文档、S3 的 E2E 脚本);跨契约的破坏性改动等中枢拉齐决策后再动。
- 默认**不合并 main、不强推**;提交信息结尾按仓库惯例附署名。多人/多会话并发时,先在 `STATUS.md` 写"交接"再动他流目录。

## 10. 决策状态

### 已拍板(2026-06-26)

1. ✅ **数据边界 = 分库**(D6):chat `InfiniteChat` / agent `agent`,不共享表、无跨栈外键,只在网关共享身份。
2. ✅ **ID 类型 = 全栈 string 化 snowflake**(D5):走 expand/contract 迁移 agent 的 Long 列/DTO。
3. ✅ **agent-frontend = 终端用户产品**(D10):完整消费级 IA,model-config 收为 admin-only 屏。
4. ✅ **E2E = 与线上并跑 + 深度场景脚本化 + 现在实跑**(D7 补充):S3 执行 `chat/e2e/` 01→04,并把深度链路场景脚本化;隔离设计保证与旧 jar 零冲突。
5. ✅ **多设备 = 延后**(D11):每用户已读游标,单设备首版。
6. ✅ **仓库形态 = 保持单一 monorepo**(D13):四子项目 + `packages/*` + docs 同仓,不拆子仓。

### 仍开放(非阻塞,可后续定)

- 对象存储 prod:留腾讯 COS 还是转 S3/MinIO 兼容(影响媒体契约与 dev 一致性)。
- 编排目标:compose-on-VM 起步 vs 一上来 k8s(决定 P0/P3 基建深度)。

---
*维护者:HUB。本文为契约级出处,更新需同步 `STATUS.md`。*
