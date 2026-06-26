# InfiniteChat 项目审计与快速上手说明

审计日期：2026-06-11  

审计范围：`agent/` 与 `chat/` 两个项目目录  

目标读者：想快速理解项目、能本地跑起来、知道先改哪里的人

## 1. 先看结论

当前仓库包含两个独立 Git 项目：

- `agent/`：一个 Spring Boot 3 + LangChain4j 的 AI Agent 服务，负责普通聊天、流式聊天、RAG、Adaptive RAG、长期记忆、工具治理、输入护轨和可观测性。
- `chat/`：一个 Spring Boot 2.6 + Spring Cloud Alibaba/Nacos 的 IM 微服务后端，包含认证、网关、实时通信、消息、离线消息、联系人和朋友圈服务。

当前最影响上手的不是业务复杂度，而是构建和配置：

1. `agent` 当前不能编译。源码大量使用 Lombok 注解，但 `agent/pom.xml` 没有声明 Lombok 依赖，`sh mvnw test` 在编译阶段失败。
2. `chat` 当前也不能在本机 JDK 25 下编译。各子模块声明了 Lombok，但版本由老 Spring Boot 依赖管理推导，和当前 JDK/annotation processing 组合不兼容，表现为 `@Data`/`@Accessors` 没有生成 getter/setter。
3. `chat` 的配置文件和部分 Java 工具类中硬编码了数据库、Redis、Nacos、Kafka、邮箱、MinIO 等连接信息和凭据，必须先迁移到环境变量或外部配置中心。
4. `chat` 的鉴权链路不完整：JWT 拦截器只检查 `Authorization` 是否非空，没有验签；多数业务服务没有鉴权；服务直连端口暴露时可绕过网关。
5. `agent` 暴露了 RAG 文档入库接口，允许按请求里的本地路径读取文件；当前没有认证/授权边界，部署前必须限制路径和权限。

建议先把“能编译、能本地启动”修好，再进入业务学习。否则很多调试会被 Lombok/JDK/外部中间件问题干扰。

## 2. 本次验证结果

本机环境：

- `java -version`：OpenJDK 25.0.1。
- 全局 `mvn` 不存在。
- 已通过 `agent/mvnw` 下载 Maven Wrapper 使用的 Maven 3.9.14。

实际验证：

- `agent`：执行 `sh mvnw test`，失败在编译阶段。关键错误是 `builder()`、getter/setter、`log` 等符号不存在；对应源码使用了 Lombok，但 `agent/pom.xml:32-129` 的依赖列表没有 Lombok。
- `chat`：使用 Wrapper 下载出的 Maven 执行 `mvn -DskipTests package`，失败在 `AuthenticationService` 编译阶段。关键错误是 `User#getUserId()`、`Result#setCode()`、请求 DTO getter 等不存在，说明 Lombok 注解没有生效。

这两个验证都没有进入真正的单元测试或 Spring 上下文启动阶段。

## 3. 项目结构总览

### 3.1 `agent/`

核心目录：

```text
agent/
├── pom.xml
├── README.md
├── docs/
├── scripts/bge_rerank_server.py
└── src/main/
    ├── java/com/lou/infinitechatagent/
    │   ├── agent/        # ReAct Agent 编排、规划、工具、治理
    │   ├── ai/           # LangChain4j AiServices 普通聊天入口
    │   ├── config/       # DashScope、PgVector、Redis、MCP、CORS 等配置
    │   ├── controller/   # HTTP API
    │   ├── guardrail/    # 输入安全检查
    │   ├── memory/       # 会话摘要、长期记忆、反思记忆
    │   ├── monitor/      # Micrometer 监控上下文
    │   ├── rag/          # 文档入库、向量/关键词/混合检索、重排、引用
    │   └── tool/         # Time、Email、RAG 等工具
    └── resources/
        ├── application.yml
        ├── docs/
        ├── front/gpt.html
        └── system-prompt/chat-bot.txt
```

规模：`src/main/java` 下约 120 个 Java 文件。已有测试主要覆盖输入护轨、Markdown/PDF chunk 元数据、长期记忆去重合并。

### 3.2 `chat/`

核心目录：

```text
chat/
├── pom.xml                # Maven 聚合工程
├── AuthenticationService/ # 注册、登录、验证码、头像、上传 URL
├── GateWay/               # Spring Cloud Gateway + Nacos 路由
├── RealTimeCommunicationService/ # Netty WebSocket 实时通信
├── MessagingService/      # 发消息、红包、Kafka outbox、实时推送
├── OfflineDataStoreService/ # Kafka 消费、离线消息查询
├── ContactService/        # 好友、申请、群聊、群成员
└── MomentService/         # 朋友圈、点赞、评论、通知
```

规模：各服务合计约 357 个 Java 文件。测试基本是 Spring Boot 默认上下文测试，业务测试较少。

## 4. `agent` 快速理解

### 4.1 技术栈

- Java 17。
- Spring Boot 3.5.13。
- LangChain4j 1.1.x。
- DashScope/Qwen：聊天模型、流式模型、Embedding。
- MySQL：RAG 元数据、Memory 表、工具审计表。
- PostgreSQL + PgVector：向量存储。
- Redis：短期聊天记忆。
- BGE rerank：可选本地重排服务，默认 endpoint 为 `http://localhost:8080/rerank`。
- Actuator + Prometheus：指标暴露。

### 4.2 主要入口

默认服务配置：

- 端口：`10010`
- context path：`/api`
- Prometheus：`/api/actuator/prometheus`

接口速查：

| 能力 | 路径 | 关键源码 |
| --- | --- | --- |
| 普通聊天 | `POST /api/chat` | `agent/src/main/java/com/lou/infinitechatagent/controller/AiChatController.java` |
| 流式聊天 | `POST /api/streamChat` | 同上 |
| 基础 RAG | `POST /api/rag/chat` | `RagChatController` + `RagQueryService` |
| Adaptive RAG | `POST /api/rag/adaptive/chat` | `AdaptiveRagController` + `AdaptiveRagOrchestrator` |
| ReAct Agent | `POST /api/agent/chat` | `AgentController` + `ReActAgentOrchestrator` |
| 工具列表 | `GET /api/agent/tools` | `ToolRegistry` |
| 工具审计 | `GET /api/agent/tools/audit` | `ToolGovernanceService` |
| 文档入库 | `POST /api/rag/documents/ingest` | `RagDocumentController` + `DocumentIngestionService` |
| 记忆上下文 | `GET/POST /api/memory/context` | `MemoryController` |
| 写长期记忆 | `POST /api/memory/write` | `LongTermMemoryService` |
| 纠正记忆 | `POST /api/memory/correct` | `LongTermMemoryService` |
| 反思记忆 | `POST /api/memory/reflection` | `ReflectiveMemoryService` |

### 4.3 核心请求链路

普通聊天链路：

```text
AiChatController
  -> AiChat LangChain4j interface
  -> SafeInputGuardrail
  -> ChatModel / StreamingChatModel
  -> RedisChatMemoryStore
  -> TimeTool / RagTool / EmailTool / MCP tools
```

基础 RAG 链路：

```text
RagChatController
  -> RagQueryService
  -> RedisChatMemoryStore 取历史消息
  -> HybridSearchService
       -> VectorSearchService
       -> KeywordSearchService
       -> RRF 融合
  -> RerankService
  -> token budget 截断
  -> ChatModel 生成回答
  -> Citation 输出
```

文档入库链路：

```text
RagDataLoader 启动自动导入 application.yml: rag.docs-path
或 RagDocumentController 手动触发
  -> DocumentIngestionService
  -> 读取 md/txt/pdf/doc/docx
  -> Markdown heading / PDF page / Word paragraph 解析
  -> 分块、计算 hash、写 rag_document / rag_chunk
  -> EmbeddingModel.embedAll
  -> PgVector EmbeddingStore.addAll
```

ReAct Agent 链路：

```text
AgentController
  -> ReActAgentOrchestrator
  -> AgentContextManager 准备历史与记忆上下文
  -> RuleBasedAgentPlanner 或 LlmAgentPlanner
  -> ToolGovernanceService 检查工具风险和 prompt injection
  -> 根据 action 调用：
       HYBRID_SEARCH / CURRENT_TIME / MEMORY_WRITE / MEMORY_SEARCH
       EMAIL_SEND / WEB_SEARCH / NO_RETRIEVAL_ANSWER
  -> AgentResponse 返回 answer、citations、reactTrace、memoryTrace、cost
```

Memory 链路：

```text
SessionSummaryService       # Redis 历史消息压缩摘要
LongTermMemoryService       # agent_memory 写入、去重、纠错、禁用
MemoryRetrievalService      # 根据 prompt 选择相关长期记忆
MemoryContextBuilder        # 拼装摘要 + 长期记忆上下文
ReflectiveMemoryService     # RAG 失败/低置信/用户纠错后的反思记忆
MemoryAgent                 # 统一 memory read/write/reflect 决策
```

### 4.4 `agent` 上手顺序

建议按这个顺序读：

1. `agent/README.md`：先理解作者定义的能力边界。
2. `agent/src/main/resources/application.yml`：看所有外部依赖、默认端口、RAG/Memory/Agent 参数。
3. `AiChatController` + `AiChatService` + `AiChat`：理解最简单聊天入口。
4. `DocumentIngestionService` + `RagQueryService`：理解知识库如何入库、如何召回、如何引用。
5. `AdaptiveRagOrchestrator`：理解 planner、rewrite、evidence evaluator、多轮补检。
6. `MemoryController` + `LongTermMemoryService` + `MemoryContextBuilder`：理解记忆表和上下文注入。
7. `ReActAgentOrchestrator` + `ToolGovernanceService` + `ToolRegistry`：理解工具调用、风险确认和审计。
8. `docs/` 下对应专题文档：按 RAG、ReAct、Adaptive RAG、Memory、Tool Governance、Guardrail 阅读。

### 4.5 `agent` 本地启动前置条件

先修构建：

- 给 `agent/pom.xml` 增加 Lombok 依赖，并按当前 JDK 配置 annotation processor。
- 推荐使用 JDK 17 运行 `agent`，不要用 JDK 25 作为第一上手环境。

准备依赖：

- MySQL：默认库名 `agent`。
- PostgreSQL + PgVector：默认库名 `dp`，默认表 `dp_embedding`。
- Redis。
- DashScope API key。
- 可选：BGE rerank 服务。

推荐环境变量：

```bash
MYSQL_URL=jdbc:mysql://localhost:3306/agent?useUnicode=true&characterEncoding=utf8&serverTimezone=Asia/Shanghai&useSSL=false&allowPublicKeyRetrieval=true
MYSQL_USERNAME=root
MYSQL_PASSWORD=...
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
PGVECTOR_HOST=localhost
PGVECTOR_PORT=5432
PGVECTOR_DATABASE=dp
PGVECTOR_USER=postgres
PGVECTOR_PASSWORD=...
DASHSCOPE_API_KEY=...
```

启动命令：

```bash
cd agent
sh mvnw spring-boot:run
```

## 5. `chat` 快速理解

### 5.1 技术栈

- Java 8 源码级别，实际建议用 JDK 8/11/17 验证，不建议直接用 JDK 25。
- Spring Boot 2.6.13。
- Spring Cloud Gateway。
- Spring Cloud Alibaba Nacos discovery。
- MyBatis-Plus / MyBatis-Plus-Join。
- MySQL。
- Redis / Redisson。
- Kafka。
- Netty WebSocket。
- MinIO。
- OkHttp。

### 5.2 服务与端口

| 服务 | 默认端口 | 职责 |
| --- | ---: | --- |
| GateWay | 10010 | 对外统一入口，基于 Nacos 路由到各服务 |
| ContactService | 8080 | 好友、申请、群聊、群成员、管理员 |
| MessagingService | 8081 | 发送消息、红包、Kafka outbox、实时推送 |
| AuthenticationService | 8082 | 注册、登录、验证码、头像、上传 URL |
| RealTimeCommunicationService | 8083 | HTTP 推送接口、Netty WebSocket 服务 |
| NettyService | 9000 | WebSocket 长连接端口 |
| OfflineDataStoreService | 8085 | 消费 Kafka 保存离线消息，查询离线消息 |
| MomentService | 8086 | 朋友圈、点赞、评论、通知 |

注意：`chat/GateWay` 和 `agent` 都默认占用 `10010`，不能同时按默认配置启动。

### 5.3 网关路由

`chat/GateWay/src/main/resources/application.yml` 中配置了这些路由：

| 网关路径 | 目标服务 |
| --- | --- |
| `/api/v1/user/**` | `AuthenticationService` |
| `/api/v1/message/**` | `RealTimeCommunicationService` |
| `/api/v1/netty` | `NettyService` WebSocket |
| `/api/v1/chat/**` | `MessagingService` |
| `/api/v1/offline/**` | `OfflineDataStoreService` |
| `/api/v1/moment/**` | `MomentService` |
| `/api/v1/contact/**` | `ContactService` |

### 5.4 业务链路

注册/登录：

```text
CommonController.sendMailCode
  -> CommonServiceImpl 生成验证码，写 Redis，发邮件
UserController.register/login/loginCode
  -> UserServiceImpl
  -> MySQL user / user_balance
  -> JwtUtil.generate
```

WebSocket 上线：

```text
客户端连接 ws://gateway/api/v1/netty
  headers: userUuid, token
Gateway -> lb:ws://NettyService
RealTimeCommunicationService.NettyServer
  -> WebSocketTokenAuthenHeader 提取 userUuid/token
  -> MessageInboundHandler.validateToken
  -> Redis 写入 USER_SESSION:{userId} = 实时通信节点地址
  -> ChannelManager 维护本机 user-channel 映射
```

发消息：

```text
MessagingService.SendMsgController
  -> MessageServiceImpl.validateSender
  -> 单聊校验好友关系 / 群聊校验群成员
  -> 构造 AppMessage
  -> KafkaOutboxServiceImpl.saveAndSend
       -> message_outbox 表
       -> Kafka
       -> 定时补偿重试
  -> RealtimeRouteService 从 Redis 找在线路由
  -> OkHttp 调 RealTimeCommunicationService 推送在线消息
  -> OfflineDataStoreService 消费 Kafka 保存离线消息
```

红包：

```text
RedPacketController
  -> RedPacketServiceImpl.sendRedPacket
  -> 扣减 user_balance
  -> 写 red_packet / balance_log
  -> 预拆金额写 Redis list
  -> 发送红包消息
  -> 定时扫描过期红包退款
```

朋友圈：

```text
MomentController
  -> MomentServiceImpl
  -> 保存 moment
  -> 查询好友列表
  -> MomentNotificationService 推送给好友
  -> 点赞/评论独立服务处理
```

### 5.5 `chat` 上手顺序

建议按业务闭环读：

1. `chat/pom.xml`：确认聚合模块和构建顺序。
2. 每个 `*/src/main/resources/application.yml`：确认端口和中间件依赖。
3. `GateWay`：先看 gateway route，知道请求如何进入系统。
4. `AuthenticationService`：看用户、验证码、JWT、上传 URL。
5. `RealTimeCommunicationService`：看 Netty WebSocket 握手、鉴权、Redis 路由。
6. `MessagingService`：看发送消息、Kafka outbox、实时推送、红包。
7. `OfflineDataStoreService`：看 Kafka 消费和离线消息查询。
8. `ContactService`：看好友、申请、群聊和群权限。
9. `MomentService`：看朋友圈创建、增量拉取、点赞评论。

### 5.6 `chat` 本地启动前置条件

先修构建：

- 安装 Maven，或给 `chat` 增加自己的 Maven Wrapper。
- 使用 JDK 8/11/17 重新验证。
- 给所有子模块显式指定兼容 JDK 的 Lombok 版本，必要时在 `maven-compiler-plugin` 配置 annotation processor。

准备依赖：

- MySQL：需要 `InfiniteChat` 库和对应业务表。
- Redis。
- Nacos。
- Kafka。
- MinIO。
- 邮箱 SMTP。

推荐启动顺序：

1. MySQL、Redis、Nacos、Kafka、MinIO。
2. `AuthenticationService`。
3. `ContactService`。
4. `RealTimeCommunicationService`。
5. `MessagingService`。
6. `OfflineDataStoreService`。
7. `MomentService`。
8. `GateWay`。

开发阶段可以只启动某条链路。例如只调登录就启动 `AuthenticationService` + `GateWay`；只调发消息链路需要 `AuthenticationService`、`ContactService`、`RealTimeCommunicationService`、`MessagingService`、`OfflineDataStoreService`、Redis、Kafka、MySQL、Nacos。

## 6. 审计发现

### P0：构建阻塞

1. `agent` 缺少 Lombok 依赖。
   - 证据：`agent/pom.xml:32-129` 无 Lombok；源码大量使用 `@Data`、`@Builder`、`@Slf4j`。
   - 影响：无法编译，所有功能无法验证。
   - 建议：添加 `org.projectlombok:lombok`，并配置 Maven compiler annotation processor；用 JDK 17 重新跑 `sh mvnw test`。

2. `chat` 在当前 JDK 25 下 Lombok 未生效。
   - 证据：`chat/AuthenticationService/pom.xml:26-30` 声明 Lombok，但编译时 `User#getUserId()`、`Result#setCode()` 等生成方法不存在；`User` 依赖 `@Data` 和 `@Accessors(chain = true)`，见 `chat/AuthenticationService/src/main/java/com/lou/authenticationservice/model/User.java:14-15`。
   - 影响：聚合工程第一模块即失败，无法进入后续模块编译。
   - 建议：优先切到 JDK 8/11/17 验证；显式升级 Lombok；必要时在所有子模块统一 compiler plugin 配置。

### P0：敏感配置硬编码

`chat` 多个配置文件硬编码了外部地址、用户名、密码、邮箱授权码、MinIO key、Redis 密码等。敏感位置包括：

- `chat/AuthenticationService/src/main/resources/application.yml:9-11,35-37,41,45-46,98,114-115`
- `chat/ContactService/src/main/resources/application.yml:7-9,33-35,39,41`
- `chat/MessagingService/src/main/resources/application.yml:7-9,33-35,39,41`
- `chat/MomentService/src/main/resources/application.yml:6-8,32-34,38`
- `chat/OfflineDataStoreService/src/main/resources/application.yml:6-8,32-34,38,41`
- `chat/RealTimeCommunicationService/src/main/resources/application.yml:7,10-12`
- `chat/AuthenticationService/src/main/java/com/lou/authenticationservice/utils/SendMailUtil.java:25-29`

建议：

- 立即轮换已经提交过的真实凭据。
- 改成 `${ENV_VAR:default}` 形式或接入 Nacos 配置中心。
- 本地只保留 `application-local.yml.example`，真实配置加入 `.gitignore`。
- CI 增加 secret scanning。

### P0：`chat` 鉴权实际不可用

关键问题：

- `JwtHandler` 只检查 `Authorization` 是否为空，没有调用 `JwtUtil.parse()` 验签，见 `chat/AuthenticationService/src/main/java/com/lou/authenticationservice/conf/JwtHandler.java:20-27`。
- JWT 拦截器只挂到了 `/api/v1/user/avatar`，其他用户接口和业务服务没有统一鉴权，见 `Interceptors.java:29-33`。
- `SourceHandler` 只检查 `X-Request-Source` 字符串，服务端口直连时该 header 可伪造。
- `ContactController`、`SendMsgController`、`MomentController` 等业务接口大量直接信任路径或 body 中传入的 userId，没有从可信 token 派生当前用户。

建议：

- 在 Gateway 层增加全局认证过滤器，验签后写入可信用户上下文 header。
- 下游服务只信任网关签名过的内部 header，不信任客户端传入的 userId。
- 业务服务也保留必要的服务间鉴权，避免直连绕过。
- `JwtHandler` 必须实际 parse token、处理异常、校验过期。

### P1：JWT 密钥弱且不一致

证据：

- `AuthenticationService` 和 `RealTimeCommunicationService` 的 `JwtUtil` 使用 `ConfigEnum.TOKEN_SECRET_KEY.getText()` 作为签名密钥，见 `JwtUtil.java:31-35` 和实时通信服务同名文件。
- `ConfigEnum` 中枚举值同时存在 `text` 和 `value`，`TOKEN_SECRET_KEY("tokenSecretKey","lou")` 容易误用，见 `chat/AuthenticationService/src/main/java/com/lou/authenticationservice/constants/config/ConfigEnum.java:15-31`。
- `GateWay` 的 `GatewayJwtUtil` 直接写死另一个密钥字符串，见 `chat/GateWay/src/main/java/com/lou/gatewaylb/GatewayJwtUtil.java:12-24`。
- token 超时时间为 `500000` 小时，见 `TimeOutEnum.java:7-9`。

影响：

- Gateway 做 Netty 一致性路由时可能解析不到 subject，退化为随机节点。
- token 生命周期过长，泄露后风险窗口极大。
- 密钥不可轮换，不适合生产。

建议：

- 改为 `JWT_SECRET` 环境变量或配置中心。
- 统一所有服务使用同一配置来源。
- access token 缩短到小时级，配 refresh token。
- 加入 key rotation 方案。

### P1：密码和验证码安全不足

证据：

- 用户密码使用 `DigestUtils.md5DigestAsHex`，见 `UserServiceImpl.java:69-70`。
- 登录/注册验证码存在基础 TTL，但未看到频率限制、错误次数限制、IP/手机号/邮箱维度限流，见 `CommonServiceImpl.java:80-89`。
- 邮件工具类中另有硬编码授权信息，见 `SendMailUtil.java:25-29`。

建议：

- 密码改为 BCrypt/Argon2/PBKDF2。
- 验证码增加发送频率限制、错误次数限制、用途隔离、成功后删除。
- 邮件发送失败不要只打印异常，应返回可观测错误并打结构化日志。

### P1：`agent` 文档入库接口缺少路径边界

证据：`RagDocumentController` 直接把请求中的 `path` 规范化后读取，只检查存在性，见 `agent/src/main/java/com/lou/infinitechatagent/controller/RagDocumentController.java:29-39`。

影响：如果接口暴露，调用方可以让服务读取任意服务进程有权限访问的本地文件并写入知识库。

建议：

- 只允许读取配置的知识库根目录之下的路径。
- 增加鉴权和管理员权限。
- 限制文件大小、扩展名、递归深度、总 chunk 数。
- 对入库任务加审计记录。

### P1：CORS 配置过宽

证据：`agent` 允许任意 origin pattern，且允许 credentials，见 `agent/src/main/java/com/lou/infinitechatagent/config/CorsConfig.java:16-23`。

建议：

- 本地开发和生产拆 profile。
- 生产只允许可信前端域名。
- 尽量避免 `allowCredentials(true)` 搭配通配 origin。

### P2：直接业务缺陷

1. 头像更新返回 `null`。
   - 证据：`chat/AuthenticationService/src/main/java/com/lou/authenticationservice/service/impl/UserServiceImpl.java:161-163` 创建了 response 并 copy，但最后 `return null`。
   - 影响：接口成功更新数据库后仍返回空数据。
   - 建议：返回 `response`。

2. 朋友圈创建返回错误的 momentId。
   - 证据：`chat/MomentService/src/main/java/com/lou/momentservice/service/impl/MomentServiceImpl.java:67-72` 调用了 `setMomentId(createMomentResponse.getMomentId())`，应来自 `momentVO.getMomentId()`。
   - 影响：创建朋友圈响应拿不到新记录 ID。

3. 网关 POM 使用 `RELEASE` 版本。
   - 证据：构建警告指出 `org.jetbrains:annotations` 使用 `RELEASE`。
   - 影响：构建不可复现，未来 Maven 可能不支持。
   - 建议：锁定明确版本。

### P2：测试覆盖不足

`agent` 有少量针对 RAG chunk、输入护轨、Memory 去重的单元测试，但因当前不能编译未能执行。`chat` 基本只有默认 Spring Boot 上下文测试，缺少关键业务测试。

建议优先补这些测试：

- 认证：登录成功/失败、token 过期、伪造 token、空 token。
- 网关：无 token 拒绝、有 token 注入用户上下文。
- 好友：非好友不能发单聊。
- 群聊：非群成员不能发消息、群主/管理员权限。
- 消息：Kafka outbox 失败重试、重复 messageId 幂等。
- 红包：并发领取、余额扣减幂等、过期退款幂等。
- 朋友圈：创建响应 momentId、删除权限、增量列表。
- Agent：文档入库路径限制、RAG 无命中、tool governance 高风险确认。

## 7. 推荐修复路线

第一阶段：让项目能编译

1. `agent` 添加 Lombok 依赖和 annotation processor。
2. `chat` 统一 JDK 到 8/11/17，显式指定 Lombok 版本。
3. 给 `chat` 增加 Maven Wrapper。
4. 跑：

```bash
cd agent
sh mvnw test

cd ../chat
mvn -DskipTests package
```

第二阶段：配置隔离

1. 把 `chat` 全部硬编码凭据迁移到环境变量或 Nacos。
2. 提供 `application-local.yml.example`。
3. 轮换已提交凭据。
4. 加 secret scanning。

第三阶段：认证闭环

1. Gateway 全局验签。
2. 下游服务统一读取可信用户上下文。
3. 业务接口不再信任客户端 body/path 中的 userId。
4. 关闭或保护服务直连端口。

第四阶段：核心业务测试

1. 先补认证、消息、红包、RAG 入库路径限制。
2. 再补朋友圈、群聊权限、Memory/Agent 工具治理。

第五阶段：本地开发体验

1. Docker Compose 提供 MySQL、Redis、Nacos、Kafka、MinIO、PgVector。
2. 初始化 SQL 脚本集中管理。
3. README 提供“一条链路最小启动”示例。

## 8. 学习路线

如果你只有半天：

1. 看本文件第 1-6 节。
2. 修 Lombok 构建问题。
3. 跑通 `agent` 的 `InputSafetyServiceTest` 和 `DocumentIngestionServiceTest`。
4. 看 `chat` 的登录和发消息链路。

如果你有 1-2 天：

1. 画出 `chat` 的请求路径：Gateway -> service -> DB/Redis/Kafka。
2. 用 Postman 或 curl 跑登录、发消息、查离线消息。
3. 用 `agent` 入库一份 markdown 文档，然后调用 `/rag/chat` 验证引用。
4. 手动写一条长期记忆，再用 `/agent/chat` 触发 Memory Search。

如果你要接手开发：

1. 先建立本地 Compose。
2. 拆出公共配置和公共 DTO/Result 模块，减少 `chat` 各服务重复代码。
3. 修认证和配置安全。
4. 给消息、红包、朋友圈补事务和幂等测试。
5. 给 `agent` 加路径白名单、工具审计、RAG 入库任务状态。

## 9. 最小接口示例

### 9.1 `agent` 写长期记忆

```http
POST /api/memory/write
Content-Type: application/json
```

```json
{
  "userId": 1001,
  "sessionId": 93001,
  "memoryType": "TECH_STACK",
  "content": "用户的项目使用 Spring Boot、LangChain4j、Redis、MySQL 和 PgVector。",
  "summary": "项目技术栈：Spring Boot、LangChain4j、Redis、MySQL、PgVector。",
  "confidence": 0.95,
  "source": "manual"
}
```

### 9.2 `agent` RAG 问答

```http
POST /api/rag/chat
Content-Type: application/json
```

```json
{
  "userId": 1001,
  "sessionId": 93001,
  "prompt": "请解释这个项目的 Adaptive RAG 流程，并给出引用。"
}
```

### 9.3 `chat` 登录

```http
POST /api/v1/user/login
Content-Type: application/json
```

```json
{
  "phone": "手机号",
  "password": "密码"
}
```

### 9.4 `chat` 发送单聊消息

```http
POST /api/v1/chat/session
Content-Type: application/json
```

```json
{
  "sendUserId": 1001,
  "receiveUserId": 1002,
  "sessionId": 2001,
  "sessionType": 1,
  "type": 1,
  "body": {
    "content": "hello"
  }
}
```

当前安全建议：在鉴权修复前，不要把这些接口暴露到非本地环境。

