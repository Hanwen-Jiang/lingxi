# S3 · chat-backend 工作计划(权威)

> 本文是 **S3 / chat-backend** 工作流(`chat/` 目录:Spring Boot 2.6 + Spring Cloud Alibaba/Nacos,7 个微服务)的权威工作计划。**只产规划,不写代码。**
> 契约级取值一律以 `00-master-plan.md` 决策登记(D1–D9)为准;本文只落 S3 的执行动作与排期。改进明细见 `01-improvement-audit.md`(S3 owns:B4–B8、M5–M12、L1–L7、L22),状态同步走 `STATUS.md` S3 小节。
> 数据/契约事实来源:`.artifacts/wf_extract.txt` 的 `chat-backend-api` + `chat-backend-quality` 两节(已逐条核对)。
>
> **重要校准(请勿与之矛盾):** Onboarding 文档已过期——网关鉴权**现已为真**(`AuthGlobalFilter` 验签 JWT、剥离客户端伪造 `X-User-Id` 并注入可信头、带白名单);密钥已外置。这些**不再列为开放项**。

---

## 1. 角色与现状

### 1.1 七服务与端口(prod)

| 服务 | 目录 | 端口 | 角色 | 对外? |
| --- | --- | ---: | --- | --- |
| GateWay | `chat/GateWay` | **10010** | 唯一对外 REST 入口;`AuthGlobalFilter`(order -100)验签 + 注入 `X-User-Id` + 白名单 + 一致性哈希 LB | 对外 |
| AuthenticationService | `chat/AuthenticationService` | 8082 | 注册/登录/验证码/头像/COS 预签名 URL,JWT 签发 | 经网关 |
| ContactService | `chat/ContactService` | 8080 | 好友申请箱/增删拉黑、群增邀踢退/管理员、会话成员、用户查找 | 经网关 |
| MessagingService | `chat/MessagingService` | 8081 | 发消息(单/群)、红包发/领/详情;事务 outbox + Kafka + 在线推送 | 经网关 |
| RealTimeCommunicationService | `chat/RealTimeCommunicationService` | 8083 / **Netty 9000** | 服务间扇出推送(`/api/v1/message/**`)+ Netty WS 长连接(推送/ACK/心跳) | WS 对外·HTTP 对内 |
| OfflineDataStoreService | `chat/OfflineDataStoreService` | 8085 | Kafka 消费者落库 + 离线拉取(`/api/v1/offline/message`) | 经网关 |
| MomentService | `chat/MomentService` | 8086 | 朋友圈发/赞/评 + 增量 delta 列表 | 经网关 |

> Netty 服务名 `NettyService`,固定 `DEFAULT_GROUP`(3 参 `registerInstance`)——这是 D7 用**命名空间**而非 group 隔离 E2E 的根因。

### 1.2 网关鉴权(已为真,勿当开放项)

- `AuthGlobalFilter` 从 `Authorization`(Bearer 或裸)或 `token` 头取令牌,`GatewayJwtUtil` HMAC 验签(读 `JWT_SECRET_KEY`),把验证后的 subject 注入下游 `X-User-Id`,剥离客户端伪造头。
- 下游服务经 `AuthContextInterceptor` 读 `X-User-Id` 入 `UserContext`(ThreadLocal)。
- 白名单(免鉴权):`/api/v1/user/{register,login,loginCode,common/sendMail,common/check}`、`/api/v1/netty`、`/actuator`。
- **缺陷(S3 待修,非已解决):** 下游在 `UserContext.get()==null` 时跳过越权校验(M12),信任 body 里的 userId;各服务 JWT secret 仍可能不一致(D2);令牌寿命 ~500000h、无刷新(L7)。

### 1.3 S3 已完成(per STATUS,2026-06-26)

- **隔离式 E2E(脚本 + 文档,未执行)**:`chat/docs/E2E-TESTING.md` + `chat/e2e/`(`e2e.env.example`、`01-setup-infra.sh`…`04-smoke-test.sh`、`99-stop.sh`)。隔离维度:库 `InfiniteChat_e2e`、Redis db5、Nacos 命名空间 `e2e`、独立 Kafka `:9192`、端口 +100(网关 10110、业务 8180–8186、Netty 9100)。命名空间隔离(非 group)的理由见 1.1。
- **回归修复(已落代码):** 给 5 个服务加 `excludePathPatterns("/actuator/**","/error")`——拦截器挂 `/**` 会 401 掉健康检查;全量重编 exit 0。
- **静态验证:** 5 脚本 `bash -n` 过、`e2e.env.example` source 过(修了 `MYSQL_URL`/`JAVA_OPTS` 引号 bug)、JSON 提取器实测、LF 换行。**01~04 未执行**(等用户审 `E2E-TESTING.md` §9)。

### 1.4 数据模型摘要(由 MyBatis-Plus `@TableName` 反推,无迁移,需对实库核对)

| 表 | 关键列 | 备注 |
| --- | --- | --- |
| `user` | userId(PK,Long)、userName、password(MD5)、email、phone、avatar、status(1 正常/2 封禁/3 注销) | `user_balance` 存钱包 |
| `friend` | id、userId、friendId、status(1 好友/2 拉黑/3 删除) | **有向行**,无唯一键 |
| `apply_friend` | id、userId(发)、targetId(收)、msg、status(0 未读…4 过期) | 好友申请箱 |
| `session` | id(PK)、name、type(1 单/2 群)、status | 单群共用模型 |
| `user_session` | id、userId、sessionId、role(1 主/2 管/3 员)、status | 成员/join 表;**无 last_read 指针**,无唯一键 |
| `message` | messageId(PK,Long)、senderId、sessionId、type(1 文/2 图/3 文件/4 视频/5 红包/6 表情)、content、replyId、sessionType | **唯一写者=离线消费者**(B4) |
| `message_outbox` | message_id(UNIQUE)、status、retry_count | 事务 outbox → Kafka |
| `red_packet` / `red_packet_receive` / `balance_log` | 状态机 UNCLAIMED→REFUNDING→EXPIRED | Lua 领取 + 条件 UPDATE + 唯一键 |
| `moment` / `moment_like` / `moment_comment` | momentId、userId、mediaUrl、逻辑删除 | delta/watermark 同步 |
| Redis(非 MySQL) | `USER_SESSION:{userId}`→`{ip}:{port}`(15min TTL)、`verify:email:{email}`、红包预拆 list | 路由/验证码/在途红包 |

### 1.5 WS 契约摘要(权威帧目录,详见第 5 节)

- **握手:** `ws://<网关>/api/v1/netty` → lb 到 `NettyService` 9000;`WebSocketTokenAuthenHeader` 读 **HTTP 握手头** `userUuid` + `token`(裸 token,无 Bearer;**头、非 query、非子协议**);`subject==userUuid` 否则关连。成功写 `USER_SESSION:{userUuid}`(15min TTL);同用户重连踢旧通道;读空闲 5min 关连(必须心跳)。
- **入站(client→server)** `MessageDTO{type,msgUuid,data}`,仅:`1 ACK` / `2 LOG_OUT` / `5 HEART_BEAT`(服务器回 type5 + 刷 TTL);其余抛 "unsupported message type"。
- **出站(server→client)** 同包络,`PushTypeEnum`:`1 NEW_SESSION` / `2 MESSAGE`(文/图/红包) / `3 MOMENT` / `4 FRIEND_APPLICATION` / `5 NEW_GROUP_SESSION`;`msgUuid={pushCode}:{userUuid}:{businessId}`;未 ACK 由 `AckMessageManager` 重投。
- **关键:** 客户端**不能经 WS 发消息**——发送只走 HTTP `POST /api/v1/chat/session`;socket 纯推送/ACK/心跳。

---

## 2. 必须遵守的契约级决策(D1–D9 → S3 动作)

| 决策 | 取值(出处:master-plan) | S3 动作 |
| --- | --- | --- |
| **D1 端口** | 网关唯一对外 10010;Netty 9000;业务 8080–8086;E2E 段一律 +100(网关 10110) | 已采纳;Dockerfile/compose 与 E2E 脚本沿用本表 |
| **D2 统一身份** | 单一 `JWT_SECRET_KEY` 全栈一致;短期 access JWT(HS256,sub=string snowflake,roles)+ 刷新令牌;`X-User-Id` 为空一律 **401**(去 null 跳过) | P1:抽 `chat-common` 统一 JwtUtil/secret;去 M12 null-skip;加 `POST /api/v1/user/refresh` + 缩短 TTL |
| **D3 agent 入网关** | agent 加 `/api/agent\|memory\|rag` 路由并纳入验签 | 主要 S1;S3 只需保证网关 `JWT_SECRET_KEY` 与 agent 一致(共享身份) |
| **D4 响应包络** | 全栈 `{code,message,data,traceId,timestamp}`;错误映射**真实 HTTP 状态**(401/403/404/422/429/5xx),停"全 200+体内 code" | P1:`chat-common` 单一 `Result<T>` + 错误码;改 `/user/common/check` 等裸 String/裸 200 端点;走版本化避免一次性全断 |
| **D5 ID 类型** | JSON 内统一 **string 化 snowflake** | P1:list/详情 DTO 的 Long id 序列化为 String(双写双读迁移);前端按版本切 |
| **D6 数据边界** | chat 用 `InfiniteChat` 库,不与 agent 共享表/外键 | 已符合;Flyway 只管 `InfiniteChat` 全表 |
| **D7 E2E 隔离** | 库 `*_e2e`·Redis 独立 db·Nacos 命名空间 `e2e`·独立 Kafka·端口 +100;**命名空间非 group** | **S3 已实现**(`chat/e2e/`);为 chat 专项 E2E 权威实现,待用户审 §9 后执行 |
| **D9 ID 生成** | Snowflake workerId/datacenterId **按实例**从 env/hostname/Nacos 实例 id 派生(现全=1) | P1:在 `chat-common` 的 ID 生成器里按实例派生 worker/datacenter 位 |

> L2(`00-master-plan` P1)= 抽 `chat-common`(单 Result/JwtUtil/错误码/按实例 Snowflake/共享消息 DTO),是 D2/D4/D5/D9 的共同载体,P1 首件。

---

## 3. 改进 backlog(S3 owns;按严重度)

> 格式:`标题 · 改动量 · 修复方向 · 来源`。

### 🔴 阻断(B)

| # | 标题 | 改动量 | 修复方向 | 来源 |
| --- | --- | --- | --- | --- |
| **B4** | 消息只由 Kafka 消费者落库(生产者从不写 `message`) | 中 | 生产者在 outbox **同本地事务**写 `message`;Offline 降为幂等投影 | MSG-PERSIST-OWNER |
| **B5** | Kafka 消费者无 ErrorHandler/DLQ,毒消息阻塞分区→全站停止落库 | 中 | `DefaultErrorHandler`+`DeadLetterPublishingRecoverer`+`ErrorHandlingDeserializer`+并发 + DLQ 深度告警 | KAFKA-NO-DLQ |
| **B6** | 无历史分页 API,前端无法回滚会话线程 | 大 | `GET /api/v1/chat/session/{id}/messages?cursor=&limit=`,按 `user_session` 成员鉴权 | chat-api G1 |
| **B7** | 无会话/收件箱列表 API,IM 主屏无法构建 | 大 | `GET /api/v1/chat/sessions` 返回 type/name/avatar/lastMessage/lastTime/unread | chat-api G2 |
| **B8** | WS 握手用非标 `userUuid/token` HTTP 头 → 浏览器无法连 | 中 | 接受 `Sec-WebSocket-Protocol` 或 `?token=&userUuid=`(仍验 subject==userUuid),保留头给原生端 | chat-api G5 |

### 🟠 主要(M)

| # | 标题 | 改动量 | 修复方向 | 来源 |
| --- | --- | --- | --- | --- |
| **M5** | 实时态(pending-ACK + channel 映射)纯进程内存,节点崩溃静默丢未投递 | 大 | pending-ACK 移 Redis(按节点 zset/list);重连按读游标对账 durable store;优雅下线清 `USER_SESSION`;守空 userUuid 删除 | RT-INMEM-STATE |
| **M6** | Snowflake workerId/datacenterId 全=1 → 横向扩容主键碰撞 | 中 | = D9,按实例派生(消费者按主键去重会静默丢他人消息,故先于多副本) | SNOWFLAKE |
| **M7** | 离线拉用墙钟时间戳,重复已在线投递且无每设备游标 | 中 | 引入 `(user,device)` 读游标(last messageId),按 `messageId > cursor` 分页;`created_at` 统一时区;返回服务端游标 | OFFLINE-CURSOR-DUP |
| **M8** | outbox 插入+Kafka 发送与建消息非事务;retryCount 计数 bug;误报发送失败 | 中 | 建消息+outbox 同事务(提交后再发);retryCount 仅在定时重试路径自增;best-effort 在线推送失败**不**抛请求错误 | OUTBOX-TX-GAP |
| **M9** | 无好友/联系人列表 API | 中 | `GET /api/v1/contact/friends` 返回 friendId/nickname/avatar/signature/status,带过滤分页 | chat-api G3 |
| **M10** | 无未读计数/已读指针 | 中 | `(userId,sessionId)` 加 `last_read_message_id` + `POST .../sessions/{id}/read`;会话列表回 unreadCount | chat-api G4 |
| **M11** | 无可用聊天媒体上传契约(仅头像式单 COS URL) | 中 | 文档化上传流(请求预签名 URL 带 content-type/size → CDN 下载 URL + 元数据);按 type 标准化 body | chat-api G6 |
| **M12** | 身份在 path/body 冗余传递,`UserContext` 为 null 时跨校验被跳过 | 中 | actor 只取 `X-User-Id`,删 body/path 的 userId(或仅作 target);内部令牌调用须显式建 acting-user 上下文,不再跳过 | chat-api G8 × F02 |

### 🟡 轻微(L)

| # | 标题 | 改动量 | 修复方向 | 来源 |
| --- | --- | --- | --- | --- |
| **L1** | 红包发送在 DB `@Transactional` 内写 Redis 且提交前入队消息 | 小 | Redis 初始化 + 消息发送移到 `afterCommit`;`@Transactional` 内只留 DB 写 | REDPACKET-REDIS-IN-TX |
| **L2** | 无共享 common(6×Result、2×JwtUtil、各自 ConfigEnum、消息 DTO 复制) | 大 | 抽 `chat-common` Maven 模块(P1 首件,承载 D2/D4/D5/D9) | NO-SHARED-COMMON |
| **L3** | 5/7 服务无 Actuator/指标/追踪;热路径 println/StdOut SQL(泄消息内容) | 中 | 全服务 Actuator+Micrometer(Prometheus)+ OTel + 结构化日志;去 println;springdoc OpenAPI | OBS-GAPS |
| **L4** | ID/包络/分页约定不一致(Long/String、Result.ok/OK、裸 String、三种分页) | 中 | 收敛到 D5 string id + D4 单 Result + cursor+limit 单分页约定 | chat-api G9 |
| **L5** | 单聊推送只取首路由;群扇出 CallerRuns 阻塞请求线程 | 小 | 按节点批量(API 已接受 receiveUserIds 列表)、全异步 + 有界背压 + 指标,去请求路径 CallerRuns | REALTIME-N1-PUSH |
| **L6** | 群/好友成员写 read-then-write 无锁无唯一约束(TOCTOU) | 中 | DB 唯一键 `(user_id,session_id)`、`friend(user_id,friend_id)`;insert-ignore/CAS;friend-accept 幂等(仅 UNREAD/READ 推进) | GROUP-MEMBERSHIP-RACE |
| **L7** | 无在线状态查询/事件;无令牌刷新契约(token ~500000h) | 中 | presence 批量查询端点 + presence-change 推送事件;`POST /api/v1/user/refresh`(并入 D2) | chat-api G7+G10 |
| **L22** | jetbrains:annotations 钉 `RELEASE`(不可复现);跟踪运行期产物;无根 .gitignore;chat 无 Maven wrapper | 小 | 钉死 annotations 版本;补 `mvnw`;根 .gitignore(根级归 HUB,chat 内部分归 S3) | ONBOARDING |

---

## 4. 分阶段计划 P0 → P3

> **排序原则(吸收完整性评审):数据丢失级(B4/B5/M5/M8)前置;client-facing API(B6/B7/B8/M9/M10/M11)解锁 S4 真实联调;破坏性变更(D4/D5/D2)走 expand/contract(双写双读 + 版本化)。** `[并行]`/`[串行]` 标协调关系。

### P0 — 可构建 · 可一键起 · E2E 落地

| 项 | 说明 | 并行性 |
| --- | --- | --- |
| Maven wrapper | chat 聚合补 `mvnw`/`mvnw.cmd`(L22);用系统 mvn 兼容(WSL 198.18 代理坑) | `[并行]` |
| Dockerfiles + 入 compose | 7 服务各自 Dockerfile;`depends_on: service_healthy`;健康检查走 `/actuator/health`(网关用业务探活路由,它无 `/actuator/health`) | `[串行 依赖 jetbrains 钉版]` |
| Flyway 全表 DDL | `InfiniteChat` 全表版本化(从 `@TableName` 反推 + 对实库核对);现仅 2 个 ad-hoc SQL(`message_outbox.sql`/`red_packet_consistency.sql`)。**加唯一键 `(user_id,session_id)`/`friend(user_id,friend_id)` 前先去重历史脏数据**(并发已产生重复) | `[串行 先于 L6]` |
| jetbrains annotations 钉版 | 去 `RELEASE`,钉具体版本(L22,可复现构建前置) | `[并行]` |
| E2E 执行 | **待用户审 `E2E-TESTING.md` §9 后**执行 01~04;并按 §9 决定是否把"发消息→离线落库"深度场景脚本化进 `04` | `[串行 依赖用户审核]` |

- **handoff:** Dockerfile/compose 的中间件部分与 HUB/S1 的根 compose 对齐(MySQL/Redis/Nacos/Kafka/MinIO)。
- **出口:** `docker-compose up` 起 chat 全栈无端口冲突;Flyway 确定性建库;E2E 01~04 跑通(冒烟 T1–T11 绿)。

### P1 — chat-common + 统一鉴权/包络(破坏性,走 expand/contract)

| 项 | 说明 | 并行性 |
| --- | --- | --- |
| **chat-common 模块**(L2) | 单 `Result<T>`/错误码/`JwtUtil`/按实例 Snowflake(D9)/共享消息 DTO;全 6 服务依赖它 | `[串行 P1 首件,后续都依赖]` |
| D4 包络统一 | `{code,message,data,traceId,timestamp}` + 真实 HTTP 状态;改裸 String/裸 200 端点(如 `/user/common/check`);**版本化** API,前端按版本切 | `[串行 依赖 chat-common]` |
| D2 身份硬化 | 去 M12 null-skip(`X-User-Id` 空一律 401);actor 只取 `X-User-Id`,删 body userId;内部令牌调用显式建上下文 | `[串行 依赖 chat-common]` |
| 刷新令牌(L7/D2) | `POST /api/v1/user/refresh` + 缩短 access TTL + 刷新令牌轮换 | `[并行]` |
| D9 Snowflake(M6) | worker/datacenter 位按实例从 env/hostname/Nacos 实例 id 派生 | `[并行]`(在 chat-common 内) |
| pending-ACK → Redis(M5 起步) | 把 pending-ACK + channel 路由态移 Redis(为多节点铺路);优雅下线清 `USER_SESSION` | `[并行]` |
| 全服务 Actuator/OTel(L3) | Actuator+Micrometer(Prometheus)+ OTel + 结构化日志 + Kafka lag/DLQ 指标(为调试集成缝) | `[并行]` |
| 基础限流 | 对发消息/好友申请按主体限流(429+Retry-After);补 `@Valid`/DTO 校验 | `[并行]` |

- **handoff:** `JWT_SECRET_KEY` 须与 S1(agent)、网关三方一致——见第 6 节;统一密钥走**双密钥过渡窗**避免一刀切登出。
- **出口:** 无端点信任客户端 userId(IDOR 闭环);单一 typed 客户端可消费统一包络;任两实例无主键碰撞;一次登录 JWT 同认 chat+agent。

### P2 — 数据丢失级修复 + 客户端契约(解锁 S4 真实联调)

| 项 | 说明 | 并行性 |
| --- | --- | --- |
| **B4 持久化所有权** | 生产者与 outbox 同事务写 `message`;Offline 降为幂等投影/读模型;解耦"消息存在"与"kafka 已消费" | `[串行 数据安全最高优先]` |
| **B5 DLQ** | `DefaultErrorHandler`+`DeadLetterPublishingRecoverer`+`ErrorHandlingDeserializer`+并发 + DLQ 告警 | `[并行 与 B4 同批]` |
| M8 outbox 事务 | 建消息+outbox 同事务(提交后再发);retryCount 修计数 bug;在线推送失败不抛请求错误 | `[并行 与 B4 同批]` |
| **B6 历史分页** | `GET /api/v1/chat/session/{id}/messages?cursor=&limit=`,成员鉴权 | `[并行]` ⟶ 解锁 S4 |
| **B7 会话列表** | `GET /api/v1/chat/sessions`(末条 + 未读 + 名 + 头像) | `[并行]` ⟶ 解锁 S4 |
| **M9 好友列表** | `GET /api/v1/contact/friends`(过滤 + 分页) | `[并行]` ⟶ 解锁 S4 |
| **M10 未读指针** | `(userId,sessionId)` last_read + `POST .../sessions/{id}/read`;会话列表回 unread | `[串行 与 B7 协同]` ⟶ 解锁 S4 |
| M7 离线游标 | `(user,device)` 读游标,按 `messageId>cursor` 分页;`created_at` 统一时区 | `[并行]` |
| **B8 浏览器 WS 握手** | `Sec-WebSocket-Protocol` 或 `?token=&userUuid=`(仍验 subject);保留头给原生端 | `[并行]` ⟶ 解锁 S4 WS 客户端 |
| **M11 媒体上传契约** | 预签名 URL(content-type/size)+ CDN 下载 URL + 元数据;按 type 标准化 body | `[并行]` ⟶ 解锁 S4 |
| L6 唯一键/幂等 | `(user_id,session_id)`、`friend(user_id,friend_id)` 唯一键 + insert-ignore/CAS;friend-accept 幂等 | `[串行 依赖 P0 去重]` |

- **handoff:** 第 5 节端点 + WS 帧目录是 S4 真实联调依据;**在 P2 这批交付前 S4 用 Mock**(STATUS 已记)。`last_read_message_id` 回填策略需明确(默认指向最新?影响首发未读)。
- **出口:** 消息历史能扛 Kafka 消费中断、毒消息进 DLQ 不阻塞;前端能渲染收件箱/回滚历史/未读角标/浏览器连 WS/发媒体。

### P3 — 实时规模化 + 红包正确性 + 可观测补全

| 项 | 说明 |
| --- | --- |
| 实时规模化(M5 完结/L5) | 跨节点补投(重连按读游标对账 durable store)、优雅下线清路由、批量扇出去 CallerRuns + 有界背压 + 指标 |
| 红包正确性(L1) | 红包 Redis 初始化 + 消息发送移 `afterCommit`;`retryCount` 计数修正;`REFUNDING`(超时)纳入退款扫描(崩溃安全);随机拆分用 `ThreadLocalRandom` |
| presence(L7) | 在线状态批量查询 + presence-change 推送事件 + last-seen |
| 可观测补全 | trace/metrics 全链路;Kafka lag/DLQ 告警;actuator 鉴权;swagger 加 bearer 且 prod 收口 |

- **出口:** 实时节点重启不丢已确认未投递;每条规模/可靠性出口绑定**量化 SLO + 命名测试**(吞吐、p99、最大消费 lag、恢复时间、故障注入下消息丢失=0)。

---

## 5. 客户端契约(给 S4)

> S4 真实联调依赖此节。以下端点在 **P2** 交付,交付前 S4 用 Mock。所有端点经网关 `:10010`,actor 取网关注入的 `X-User-Id`(客户端**只发 JWT,绝不回传身份**)。id 在 JSON 内为 string(D5),包络为 `{code,message,data,traceId,timestamp}`(D4)。

### 5.1 待新增/补齐端点清单

| 用途 | 方法 + 路径 | 关键参数 / 返回 | 来源 |
| --- | --- | --- | --- |
| **会话列表**(收件箱) | `GET /api/v1/chat/sessions` | 每会话:type/name/avatar/lastMessage/lastMessageTime/unreadCount | B7 |
| **历史分页** | `GET /api/v1/chat/session/{sessionId}/messages?cursor=&limit=` | 按 id/createdAt 排序 + 稳定 cursor;成员鉴权 | B6 |
| **好友列表** | `GET /api/v1/contact/friends` | friendId/nickname/avatar/signature/status;状态过滤 + 分页 | M9 |
| **标记已读** | `POST /api/v1/chat/sessions/{id}/read` | 推进 `(userId,sessionId)` 的 last_read_message_id | M10 |
| **未读计数** | (随会话列表返回 unreadCount;可加全局聚合端点) | per-session 角标 + 全局未读 | M10 |
| **媒体上传** | `POST` 取预签名 URL(content-type/size)→ 返回上传 URL + CDN 下载 URL + 元数据 | 按 message type(图/文件/视频)标准化 body | M11 |
| **浏览器 WS 握手** | `ws://<网关>/api/v1/netty?token=<jwt>&userUuid=<uid>`(或 `Sec-WebSocket-Protocol`) | 仍验 `subject==userUuid`;原生端保留 HTTP 头方式 | B8 |
| **令牌刷新** | `POST /api/v1/user/refresh` | 短期 access + 刷新令牌轮换 | L7/D2 |
| presence(P3) | `GET` 批量在线状态 + presence-change 推送事件 | 由 `USER_SESSION` 支撑 | L7 |

> 已存在、S4 可直接用(发送/已有读):`POST /api/v1/chat/session`(发消息,`sendUserId` 须==`X-User-Id`)、`POST /api/v1/chat/redPacket/{send,receive}`、`GET /api/v1/offline/message`(过渡,P2 后由 B6 取代)、ContactService 申请箱/增删/群操作、`POST /api/v1/user/common/uploadUrl`(头像式,M11 前的兜底)。

### 5.2 WS 帧目录(S4 WS 客户端按此实现)

- **出站 `PushTypeEnum`(server→client,`MessageDTO{type,msgUuid,data}`):**
  `1 NEW_SESSION_NOTIFICATION` · `2 MESSAGE_NOTIFICATION`(文/图/红包) · `3 MOMENT_NOTIFICATION` · `4 FRIEND_APPLICATION_NOTIFICATION` · `5 NEW_GROUP_SESSION_NOTIFICATION`。`msgUuid={pushCode}:{userUuid}:{businessId}`,客户端收到须回 ACK。
- **入站 `MessageTypeEnum`(client→server):**
  `1 ACK`(按 `msgUuid`/`data.msgUuid` 确认推送) · `2 LOG_OUT`(`data=LogOutData{userUuid}`) · `5 HEART_BEAT`(服务器回 type5 + 刷 TTL)。**其余 type 抛错。**
- **连接规则:** 读空闲 5min 关连 → 客户端必须心跳;同用户重连踢旧通道;**不能经 WS 发聊天消息**(发送走 HTTP)。S4 的 WS 客户端(重连/退避/离线缓冲)须与 B8 握手改造协同(STATUS 已记)。

---

## 6. 给其他流的交接与依赖

| 对象 | 内容 |
| --- | --- |
| **→ S4(chat 前端)** | 依赖第 5 节全部端点 + WS 帧目录(P2 交付前用 Mock)。WS 客户端与 B8 握手(`?token=`/`Sec-WebSocket-Protocol`)协同设计。`last_read_message_id` 回填语义影响首发未读,交付时明确。 |
| **→ S1 / 网关** | **共享 JWT**:`JWT_SECRET_KEY` 在网关 / 全部 chat 服务 / agent **三方完全一致**(D2);统一密钥走**双密钥过渡窗**避免一刀切登出。chat 不负责 agent 路由(D3 归 S1),但须保证密钥一致以便一次登录同认两栈。 |
| **→ HUB** | E2E 分工已裁定(C1):`chat/e2e/` 为 chat 专项权威实现,`60-e2e-test-environment.md` 为系统级伞。根 compose 的中间件部分与 P0 Dockerfile 对齐。 |
| **依赖(挡 S3)** | E2E 01~04 执行**等用户审 `E2E-TESTING.md` §9**;统一密钥/包络/ID 的破坏性变更**等中枢拉齐**后再动(纯文档与隔离的 E2E 脚本可先提交)。 |

---

## 7. 完成约定(STATUS.md S3 小节追加)

每完成一个工作单元,在 `STATUS.md` 的 **S3 小节顶部追加**一条(模板见 STATUS 顶部),要点:
- 契约级取值(端口/鉴权/包络/ID/数据边界)**不在此拍板**,写"待中枢确认",由中枢落 `00-master-plan.md`。
- 改了他流目录(如跨流修复)必须在"交接"写明。
- 提交遵循 `00-master-plan.md` §提交约定:分支 `feat/chat-backend-<topic>` / `fix/chat-backend-...` / `docs/chat-backend-...`;纯文档/隔离 E2E 可提交,破坏性契约变更等中枢拉齐;默认不合并 main、不强推;提交信息结尾附署名。
- 每个 P 阶段出口绑定一个能证明它的自动化测试(单元 → 网关缝契约 → 关键链路 e2e → 故障注入:毒消息 DLQ / 节点崩溃补投 / 消费中断持久性)。

---
*维护者:S3。契约级出处为 `00-master-plan.md`;本文更新需同步 `STATUS.md` S3 小节。*
