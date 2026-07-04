# 综合改进清单(严重 → 轻微 · 大改 → 小改)

> 跨**三个代码项目**(agent-backend / agent-frontend / chat-backend)的统一改进矩阵。`chat-frontend` 尚为脚手架、`infinitechat-web` 为不发布设计参考,均不在此排名。
>
> 来源合并并去重:`agent/docs/IMPROVEMENTS.md`(F01–F22,对抗式复核)、`PROJECT_AUDIT_ONBOARDING.md`(chat P0–P2,**已纠正过期项**)、本轮 9-agent 深度分析新发现。每条标注 **项目 · 严重度 · 改动量 · 来源**。

> ⚠️ **本清单为 2026-06-26 的快照,已过期。** 权威现状见下方「§现状核对(2026-07-04)」——绝大多数阻断/主要项在 P0→v1.0.0 阶段已闭环。下方 §1–§5 原始表格保留作历史证据,勿据其判断当前是否为问题。

## 现状核对(2026-07-04)

> 直读 v1.0.0(2026-06-30 发行,tag `v1.0.0`)现源码,把本清单逐项对照。方法:三路子代理并行核对身份/持久化/客户端契约三主题,附 file:line 证据。

### 结论一句话
本审计的**阻断项 B1–B8 已全部闭环**,主要项 M1/M6/M8/M9/M10/M12/M13/M17 及多数 L 项亦已闭环或不再适用。**真正仍开放**的只剩:**M5**(实时待确认态持久化,本轮已交付 Redis 化,待全分布式 E2E)、**M11**(媒体缩略图/尺寸强校验)、以及本轮新发现的**单测静默不跑**(已修 3 模块)。

### 已闭环(附证据)
| 项 | 现状 | 证据 |
|---|---|---|
| B1 agent 无鉴权/体内 userId | **闭环** | `agent .../security/GatewayIdentityFilter`(强制网关注入 X-User-Id,直连 401);控制器改 `@CurrentUser principal.requireUserId()` |
| B3 model-config SSRF/密钥外泄 | **闭环** | `ChatHistoryController` model-config `principal.isAdmin()` 门控 + 剥离原始 apiKey |
| M1 agent CORS 通配+凭据 | **闭环** | `agent config/CorsConfig` + `application.yml`:env 白名单,`*` 时强制关 allow-credentials |
| M17 agent 不在网关后 | **闭环** | `GateWay application.yml` 路由覆盖 `/api/agent|memory|rag|chat/**`,注入 X-User-Id/Roles;`enforce-identity` 默认已翻 **true** |
| B4 消息不由生产者落库 | **闭环** | `MessagingService KafkaOutboxServiceImpl.persistMessageAndOutbox` 同事务写 message+outbox;Offline 降幂等投影 |
| B5 Kafka 无 DLQ | **闭环** | `OfflineDataStore KafkaConsumerConfig`:ErrorHandlingDeserializer + DefaultErrorHandler + DeadLetterPublishingRecoverer + `.DLT` + 告警 |
| M6 Snowflake workerId 恒 1 | **闭环** | `chat-common id/SnowflakeIdGenerator`:worker/dc 由 `WORKER_ID`/`DATACENTER_ID` 或主机名散列派生 |
| M8 outbox 事务缺口/retryCount bug | **闭环** | `KafkaOutboxServiceImpl`:提交后 `afterCommit` 发送;首发不自增,`bumpRetryCount` 仅在 `@Scheduled` 补偿路径 |
| B6 历史分页 | **闭环** | `GET /api/v1/chat/session/{id}/messages?cursor=&limit=`(`MessagingService ChatClientController`),按会话成员鉴权 |
| B7 会话/收件箱列表 | **闭环** | `GET /api/v1/chat/sessions`(`SessionListItem` 含 type/name/avatar/lastMessage/unread) |
| B8 浏览器 WS 握手 | **闭环** | `WebSocketTokenAuthenHeader`:接受 `?token=&userUuid=` 查询串,握手前剥离 |
| M9 好友列表 | **闭环** | `GET /api/v1/contact/friends?cursor=&limit=&status=`(`ContactController`) |
| M10 未读/已读指针 | **闭环** | `POST /api/v1/chat/sessions/{id}/read`(推进 last_read),未读随 B7 列表返回 |
| M12 chat 体内 userId 信任 | **不再适用** | `ContactService AuthContextInterceptor` 对外部请求缺/非法 X-User-Id 一律 401(fail-closed);`requireOperator` 的 `current!=null` 跳过分支**仅对可信 X-Internal-Token 内部调用生效**——刻意为之,非漏洞,不改(改为 fail-closed 会破坏无 per-user 身份的内部调用) |

### 仍开放 / 本轮处理
| 项 | 状态 | 说明 |
|---|---|---|
| **M5** 实时待确认态仅进程内存 | **本轮已交付,待全 E2E** | `AckMessageManager` 改 Redis 写穿(`user:pending:{userId}` 哈希)+ 重连补投(`redeliverPending`,`MessageInboundHandler` 握手完成时触发);flag `ack.durable.enabled` 默认 **false**(关闭时与 v1.0.0 逐字节等价)。新增 `AckMessageManagerTest` 9 项(WSL surefire 3.5.5 全绿)。**结构性残留**:Netty `Channel` 天然节点本地无法入 Redis;打开 durable 后单节点崩溃/重连不再静默丢未确认消息,但**跨节点崩溃补投的完整分布式 E2E 需带 Redis+多 RT 节点+网关的 WSL 全栈验证**(本机不可跑),留 HUB 会话验收后再翻默认值。 |
| **M11** 媒体上传契约 | **部分** | `POST /api/v1/user/media/upload-url` 已有预签名 URL + MIME 白名单 + 分类型尺寸上限,但尺寸上限为**建议值**(预签名 PUT 无法强制)、无服务端缩略图。富媒体 IM 需客户端自生成预览。 |
| **单测静默 0 跑**(新发现) | **本轮已修 3 模块** | chat 各模块**未继承 spring-boot-starter-parent**,surefire 回退到无法驱动 JUnit5 的旧版 → `mvn test` 静默跑 **0** 个,既有单测(Auth `JwtHandlerTest`/`UserServiceImplTest`、Moment `MomentServiceImplTest`)从未真跑,被流水线 `-DskipTests` 掩盖。已在 RTC/Auth/Moment 三个**有真实单测**的模块钉 `maven-surefire-plugin:3.5.5` + 排除需中间件的 `*ApplicationTests`;`mvn test` 现真跑 **14/14 绿**,`mvn -o -DskipTests clean package` 全 8 模块仍 BUILD SUCCESS。**残留**:其余模块将来新增单测时需同样钉版,或按 L2 提取共享父 POM 统一(根治)。 |


## 0. 先读:早期审计的过期项纠正

`PROJECT_AUDIT_ONBOARDING.md`(2026-06-11)约两周前,直读现源码确认以下 P0/P1 **已修复**,本清单**不再列为问题**:agent 已补 Lombok(可编译)、chat 配置已全外置(yml 无硬编码密钥)、chat 网关已有真实 JWT 验签 + 注入可信 X-User-Id、agent RAG 入库路径穿越已修。**仅保留仍开放项**:容器化/迁移/CI、端口冲突、agent 无鉴权、CORS、统一身份、RELEASE 钉版、根 .gitignore、chat 缺 Maven wrapper。

## 1. 🔴 阻断项(任何生产暴露前必修)

| # | 项目 | 标题 | 改动量 | 影响 | 修复方向 | 来源 |
| --- | --- | --- | --- | --- | --- | --- |
| B1 | agent-backend | 整体无鉴权,userId 取自请求体/参数 → IDOR(可读改任意用户记忆/工具审计) | 大 | agent 无 Spring Security/SecurityFilterChain;`/memory/item|disable` 仅凭 memoryId,任填 userId 即越权;网关不覆盖 agent 前缀,可直连利用 | 置于网关之后或加过滤器信任注入的 X-User-Id;主体派生 userId,删除体内 userId,按主体限权所有记忆/审计 | IMPROVEMENTS F02 + 新 G01/G10 |
| B2 | agent-frontend | 无登录,userId 写死 1,全部调用共享用户 1 数据 | 大 | 所有访客读写同一用户的会话/记忆,无法多用户上线 | 登录页 + 令牌存储 + Authorization 注入 + 真实 userId 贯通;与 B1 协同 | 新(no-auth)× F02 |
| B3 | agent-frontend / agent-backend | 未鉴权即可运行时改全局 LLM provider/baseURL/model/apiKey(SSRF+密钥外泄) | 中 | `/chat/model-config` 无鉴权 + CORS 通配带凭据,任意来源可把全实例模型指向攻击者 baseURL 或注入/窃取 key | model-config 需 admin、不收原始 apiKey;CORS 收白名单;设为 admin-only 屏 | 新 × agent-backend G09 |
| B4 | chat-backend | 消息从不由生产者落库,Kafka 消费者是 message 表唯一写者 | 中 | `MessagingService` 只写 outbox+Kafka 不写 message;唯一写者是 `OfflineDataStoreService` 消费者 → 消费中断/滞后即丢历史(在线方看到了但历史/离线拉为空) | 生产者与 outbox **同本地事务**写 message;Offline 降为幂等投影;解耦"消息存在"与"kafka 已投递" | 新(MSG-PERSIST-OWNER) |
| B5 | chat-backend | Kafka 消费者无 ErrorHandler/DLQ,毒消息永久阻塞分区、全站停止落库 | 中 | 单条异常记录(畸形 JSON/NPE)offset 不提交→无限重投→整 topic 停滞→因 B4 全站新消息不再落库 | `DefaultErrorHandler`+`DeadLetterPublishingRecoverer`+`ErrorHandlingDeserializer`+并发 + DLQ 深度告警 | 新(KAFKA-NO-DLQ) |
| B6 | chat-backend | 无历史分页 API,前端无法渲染/回滚会话线程 | 大 | 唯一历史读是 `GET /offline/message?userId=&time=`(一次性、按墙钟、整用户非按会话) | `GET /api/v1/chat/session/{id}/messages?cursor=&limit=`,按 user_session 成员鉴权 | 新(chat-api G1) |
| B7 | chat-backend | 无会话/收件箱列表 API,IM 主屏无法构建 | 大 | user_session 有成员关系但无返回"我的会话(末条/未读/名/头像)"的端点 | `GET /api/v1/chat/sessions` 返回每会话 type/name/avatar/lastMessage/lastTime/unread | 新(chat-api G2) |
| B8 | chat-backend | WS 握手要求非标 `userUuid/token` HTTP 头 → 浏览器无法连 | 中 | 浏览器 WebSocket API 不能设自定义握手头,而 WS 是**唯一**接收通道(发送走 HTTP) | 接受 `Sec-WebSocket-Protocol` 或 `?token=&userUuid=`(仍验 subject==userUuid),保留头给原生端 | 新(chat-api G5) |

## 2. 🟠 主要(投产前/硬化早期修)

| # | 项目 | 标题 | 改动量 | 摘要 | 来源 |
| --- | --- | --- | --- | --- | --- |
| M1 | agent-backend | CORS 通配 origin + allowCredentials,无 profile 门控 | 小 | OWASP 危险组合;叠加 B1 放大跨域外泄面 | IMPROVEMENTS F03 |
| M2 | agent-frontend | `App.tsx` 2647 行/98KB 巨石(~40 内联组件 + 整数据层) | 大 | 难评审/测试/懒加载,挡住几乎所有其他前端改进 | 新(monolith) |
| M3 | agent-frontend | 仅实现 DESIGN.md 约 2/7 产品面;agent/RAG/分模式端点是死代码 | 大 | 只调 `/chat/auto/stream`,其余 per-mode/agent/tools 均不可达 | 新(design-coverage + endpoints-dead) |
| M4 | agent-frontend / agent-backend | 无工具确认 UX(后端 confirmedTools 形同虚设,可伪造) | 大 | agent 安全闸:第一次拿 confirmationRequired,第二次塞 confirmedTools 即放行 | 新 × IMPROVEMENTS F01 |
| M5 | chat-backend | 实时投递态(pending-ACK + channel 映射)纯进程内存,节点崩溃静默丢未投递 | 大 | 重启丢 pending-ACK/通道映射,Redis 路由指向死节点至 TTL,无跨节点补投 | 新(RT-INMEM-STATE) |
| M6 | chat-backend | Snowflake workerId/datacenterId 全为 1 → 横向扩容主键碰撞 | 中 | 多实例生成碰撞 messageId/redPacketId/sessionId,消费者按主键去重会静默丢他人消息 | 新(SNOWFLAKE) |
| M7 | chat-backend | 离线拉用墙钟时间戳,重复已在线投递的消息且无每设备游标 | 中 | 客户端收重复(须按 messageId 去重);时区不一致(生产 Asia/Shanghai vs DB UTC) | 新(OFFLINE-CURSOR-DUP) |
| M8 | chat-backend | outbox 插入+Kafka 发送与建消息非事务;retryCount 计数 bug;误报发送失败 | 中 | 无原子"建消息+入队";首次成功也 retryCount+1;单聊推送失败在写库后抛错误导致误判 | 新(OUTBOX-TX-GAP) |
| M9 | chat-backend | 无好友/联系人列表 API | 中 | 仅单用户查找/申请箱/增删拉黑/群操作,无"我的好友",通讯录与好友选择器无法渲染 | 新(chat-api G3) |
| M10 | chat-backend | 无未读计数/已读指针 | 中 | UnreadApply 仅算好友申请;user_session 无 last_read,无 markRead,无角标 | 新(chat-api G4) |
| M11 | chat-backend | 无可用聊天媒体上传契约(仅头像式单 COS URL) | 中 | 消息 type 3/4 有体无上传流;无大小/类型校验/缩略图;语音视频不可能 | 新(chat-api G6) |
| M12 | chat-backend | 身份在 path/body 冗余传递,UserContext 为 null 时跨校验被跳过 | 中 | 直连/内部调用时体内 userId 被信任,身份权威模糊 | 新(chat-api G8)× F02 |
| M13 | agent-backend | userId 类型/响应包络/错误模型不一致,阻断单一前端同时对接两后端 | 中 | 网关 subject 是 String 但 agent DTO 是 Long;agent `{code,data,message}` vs chat `{code,msg,data}`;agent 全错误伪装成 200 | 新 agent G02/G03/G04 |
| M14 | agent-backend | 流式契约只部分增量且无文档/版本 | 中 | 仅 direct 真流式;rag/adaptive/agent 整段一帧推送,token-by-token UI 假死后整段冒出 | 新 agent G05 |
| M15 | agent-backend | RAG 基于 SHA-256 哈希伪向量 + 阈值不匹配,向量召回近乎为 0 | 中 | @Primary 是 HashEmbeddingModel,真嵌入被排除;min-score 0.75 稀疏向量几乎不达标 → "混合检索"静默退化为关键词 LIKE | IMPROVEMENTS F06+F07 |
| M16 | 全仓(挂 agent) | 零容器化/零 DB 迁移/零 CI-CD + 10010 端口冲突 | 大 | 无 Dockerfile/compose;无 Flyway(agent 零 DDL);agent 与网关同 10010 且写死进前端 | ONBOARDING(仍开放项) |
| M17 | agent-backend | agent 不在网关之后、与 chat 不共享身份 | 中 | 暴露则计费 LLM/邮件/入库端点裸奔;两栈无共享用户身份 | ONBOARDING × F02/G01 |
| M18 | agent-backend / agent-frontend | 核心逻辑零测试;前端无测试/lint/CI/ErrorBoundary | 中 | 编排/治理/检索纯逻辑零覆盖(RRF off-by-one 静默劣化);前端单渲染错误白屏 | IMPROVEMENTS F21 + 新 |

## 3. 🟡 轻微(打磨 / 已知取舍 / 技术债)

| # | 项目 | 标题 | 改动量 | 来源 |
| --- | --- | --- | --- | --- |
| L1 | chat-backend | 红包发送在 DB @Transactional 内写 Redis 且提交前入队消息 | 小 | 新 REDPACKET-REDIS-IN-TX |
| L2 | chat-backend | 无共享 common 模块(6×Result、2×JwtUtil、各自 ConfigEnum、消息 DTO 复制) | 大 | 新 NO-SHARED-COMMON |
| L3 | chat-backend | 5/7 服务无 Actuator/指标/追踪;热路径 println/StdOut SQL(泄消息内容) | 中 | 新 OBS-GAPS |
| L4 | chat-backend | ID 类型/包络/分页约定不一致(Long/String、Result.ok/OK、raw String、三种分页) | 中 | 新 chat-api G9 × agent G03 |
| L5 | chat-backend | 单聊推送只取首路由;群扇出 CallerRuns 阻塞请求线程 | 小 | 新 REALTIME-N1-PUSH |
| L6 | chat-backend | 群/好友成员写是 read-then-write 无锁无唯一约束(TOCTOU) | 中 | 新 GROUP-MEMBERSHIP-RACE |
| L7 | chat-backend | 无在线状态查询/事件;无令牌刷新契约(token ~500000h) | 中 | 新 chat-api G7+G10 |
| L8 | agent-backend | OpenAPI 未鉴权暴露;列表端点无分页元数据;DTO 无校验(@Valid 死代码) | 中 | 新 agent G11/G06/G07 |
| L9 | agent-backend | LLM 计费端点无限流/配额 | 中 | 新 agent G08 |
| L10 | agent-backend | 响应 DTO null 策略不一、toolTrace 为裸 Object | 小 | 新 agent G12 |
| L11 | agent-frontend | 刷新不持久会话/身份;apiBase、userId 为只读默认 | 中 | 新 no-persistence |
| L12 | agent-frontend | 错误/加载/空态薄:无重试、后端本地化错误串泄漏、无骨架 | 中 | 新 error-ux-thin |
| L13 | agent-frontend | 无 Vite dev proxy,直连 :10010 依赖通配 CORS | 小 | 新 no-vite-proxy |
| L14 | agent-frontend | 自定义动画无 prefers-reduced-motion | 小 | 新 no-reduced-motion |
| L15 | agent-backend | 工具审计同步阻塞在请求主链路 | 中 | IMPROVEMENTS F04 |
| L16 | agent-backend | 关键词检索 `LIKE %term%` 全表扫 + 中文不分词 | 中 | IMPROVEMENTS F08 |
| L17 | agent-backend | 文档入库跨 MySQL/向量库无事务无补偿(含已插未嵌入永久跳过) | 中 | IMPROVEMENTS F09 |
| L18 | agent-backend | 证据评估混用四种量纲取 max | 小 | IMPROVEMENTS F11 |
| L19 | agent-backend | ReAct 实为单步分发,非真多步 TAO 循环 | 中 | IMPROVEMENTS F13 |
| L20 | agent-backend | 注入检测仅固定子串黑名单,易绕过 | 小 | IMPROVEMENTS F14 |
| L21 | agent-backend | 一组已知设计/可维护取舍(F05/F10/F12/F15/F16/F17/F18/F19/F20/F22) | 中 | IMPROVEMENTS 同号 |
| L22 | chat-backend | jetbrains:annotations 钉 `RELEASE`(不可复现);跟踪了运行期产物;无根 .gitignore;chat 无 Maven wrapper | 小 | ONBOARDING(仍开放) |

## 4. 跨项目主题(优先按主题成批解决,而非逐条)

1. **无统一身份面**:agent 零鉴权信体内 userId(B1/M13/M17),agent-frontend 写死 userId=1(B2),chat 在 UserContext null 时跳过校验(M12)。两栈无共享网关/JWT——各自修完也不互通,须共享网关 + 同一 `JWT_SECRET_KEY`。
2. **持久性与投递混为一谈(chat)**:消息存在依赖 Kafka 消费(B4)、唯一消费者无 DLQ(B5)、实时态仅内存(M5)——单条毒消息或一次崩溃可全站丢历史。
3. **客户端/API 契约不全**:chat 缺历史分页/会话列表/好友列表/未读/媒体/浏览器 WS(B6-B8,M9-M11);agent SSE 非增量且列表无分页(M14,L8)——前端无法渲染核心屏。
4. **包络/ID/错误模型不一致**:agent vs chat 两套包络、Long vs String、raw String、三种分页(M13,L4)——单一 typed 前端层无法建立。
5. **运行时模型配置/计费端点裸奔**:agent-frontend 设置面 + agent `/chat/model-config` 构成 SSRF/密钥外泄对(B3),叠加通配 CORS(M1)与无限流(L9)。
6. **全仓无测试/质量工具**:agent 核心零测(M18),前端无测试/lint/CI/ErrorBoundary,chat 业务测试薄。
7. **无容器化/DevOps 基线**:零 Dockerfile/compose、零迁移(agent 零 DDL)、零 CI/CD、10010 冲突写进前端、可观测不均(M16)。
8. **横向扩容隐患**:Snowflake workerId 全为 1(M6)+ 实时态内存(M5)——声称要多副本,但当前不安全。
9. **RAG 默认语义失效**:哈希伪向量 + 阈值不匹配(M15)+ 全表扫关键词无中文分词(L16)——"混合语义检索"静默退化为仅关键词。

## 5. "只做最少"优先级

若资源极有限,先做这三组(覆盖最大风险):
1. **统一身份**(B1+B2+B3+M1+M12+M17):agent 入网关 + 共享 JWT + 前端登录 + 关掉裸奔的 model-config/CORS。
2. **chat 持久性**(B4+B5+M5):生产者同事务落库 + Kafka DLQ + 实时态 Redis 化。
3. **chat 客户端契约**(B6+B7+B8+M9+M10):会话列表/历史分页/好友列表/未读/浏览器 WS——否则 chat-frontend 根本做不出来。

---
*维护者:HUB。明细证据见 `agent/docs/IMPROVEMENTS.md` 与 `.artifacts/wf_extract.txt`。*
