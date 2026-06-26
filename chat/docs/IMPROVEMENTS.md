# InfiniteChat 改进记录与待办（不足文档）

> 本文分两部分：**第一部分**是本轮已经完成的修复（含涉及文件，便于复盘）；**第二部分**是仍然存在、建议后续处理的不足。所有改动均已通过 `mvn compile` / `mvn test-compile` 全模块编译验证（联网构建，7 个模块全绿）。本环境无法启动 MySQL/Redis/Nacos/Kafka，故未做运行期端到端验证——这是验证的上限，请在本地起完整中间件后回归。

---

## 第一部分 · 本轮已修复

### A. 安全 / 鉴权（最严重的一组）

| # | 问题 | 修复 | 涉及文件 |
|---|---|---|---|
| A1 | 网关不做任何鉴权，JWT 仅用于取路由 key，从不验签 | 新增**反应式全局过滤器** `AuthGlobalFilter`：对非白名单请求验签 JWT，失败 401；通过后注入可信 `X-User-Id` 并剥离客户端伪造的同名头。白名单：register/login/loginCode/common·sendMail/common·check/netty/actuator | `GateWay/src/main/java/com/lou/gateway/filter/AuthGlobalFilter.java` |
| A2 | `userUuid` 头优先于验签 subject，可伪造劫持他人 WS 粘连节点 | LB 路由 key 改为**优先使用验签后的 JWT subject**，无有效令牌才回退 `userUuid` | `GateWay/src/main/java/com/lou/gatewaylb/NettyConsistentHashLoadBalancer.java` |
| A3 | 各服务写接口无鉴权、`userId` 取自请求体，可冒充任意用户 | 每个业务服务新增 `UserContext`(ThreadLocal) + `AuthContextInterceptor` + `WebMvcAuthConfig`：命中 `X-Internal-Token` 放行（服务间调用），否则要求 `X-User-Id` 写入 `UserContext`，否则 401 | 6 个服务的 `config/`(或 `conf/`) 包 |
| A4 | 操作人身份可被请求体伪造 | 控制器对"操作人本人"字段用 `UserContext` 校验一致性，不一致 403：Contact 13 处、Messaging 发消息/红包 send·receive、Moment 6 个接口、Offline 离线拉取、Auth 改头像取 `UserContext` | 各服务 `controller/*` |
| A5 | 密码 unsalted MD5 | **硬切 BCrypt**（不兼容旧数据）：注册 `encode`、登录 `matches`，移除全部 MD5 逻辑 | `AuthenticationService/.../service/impl/UserServiceImpl.java`、`pom.xml`(+`spring-security-crypto:5.6.8`) |
| A6 | JWT 有效期 500000 小时（≈57 年） | `TimeOutEnum.JWT_TIME_OUT` 改 168（7 天） | `AuthenticationService/.../constants/config/TimeOutEnum.java` |
| A7 | `updateAvatar` 响应泄漏 password | `UpdateAvatarResponse` 删除 password 字段；`updateAvatar` 当前用户ID取自 `UserContext`（不再自行解析 token） | `AuthenticationService/.../data/user/updateAvatar/UpdateAvatarResponse.java`、`controller/UserController.java` |
| A8 | `SourceHandler` 仅靠静态头 `InfiniteChat-GateWay` 作信任边界，可伪造 | 改由网关统一验签；Auth 不再注册 `SourceHandler`/`JwtHandler`，统一走 `AuthContextInterceptor` | `AuthenticationService/.../conf/Interceptors.java` |
| A9 | 服务间调用（push / Feign）无鉴权 | 引入内部令牌 `X-Internal-Token`（默认 `internal.service.token=infinite-chat-internal-dev-token`）：Messaging/Contact/Moment 出站携带，RTC 的 `/api/v1/message/**` 强制校验 | Messaging `MessageServiceImpl`+`FeignInternalTokenConfig`、Contact `PushServiceImpl`、Moment `SendOkHttpRequest`、RTC `AuthContextInterceptor` |
| A10 | 网关 classpath 带 fastjson 1.2.30（反序列化 CVE，且未使用） | 从网关 `pom.xml` 移除 | `GateWay/pom.xml` |

### B. 正确性 Bug

| # | 问题 | 修复 | 涉及文件 |
|---|---|---|---|
| B1 | Contact 推送 URL 双端口 `http://ip:8083:8083/...`，好友申请/新会话/群邀请推送全失败 | 去掉手拼的 `:8083`（Redis 值已含端口），URL 改 `"http://" + nettyServerIP + urlEndpoint + userId`，并加 `X-Internal-Token` | `ContactService/.../service/impl/PushServiceImpl.java` |
| B2 | 删好友时按 `status=2`（已删）筛会话，导致单聊 session/user_session 永久泄漏 | `deleteSessionRecords` 改为 `status=1`（正常） | `ContactService/.../service/impl/FriendServiceImpl.java` |
| B3 | `createUserSessions` `setUserId(...).setUserId(...)` 两次、从不 `setId`，首条 user_session 缺主键 | 改为 `setId(snowflake.nextId()).setUserId(userId)` | 同上 |
| B4 | `getApplyList` 发送方分支取 `getUserId()`（自己），展示昵称/头像错误 | 改为取 `getTargetId()`（对方） | `ContactService/.../service/impl/ApplyFriendServiceImpl.java` |
| B5 | Moment 删动态级联删点赞用 `like_id=momentId` 过滤（恒不成立），点赞从不清理 | 改为按 `moment_id` 过滤 | `MomentService/.../service/impl/MomentServiceImpl.java` |
| B6 | 离线消费者裸 insert 生产者主键，Kafka 重投递→主键冲突→offset 不提交→**毒消息死循环** | `saveOfflineMessage` 幂等：先 `selectById` 预判 + 捕获 `DuplicateKeyException` 兜底并发竞态，保证 offset 正常提交 | `OfflineDataStoreService/.../service/impl/MessageServiceImpl.java` |
| B7 | 离线消费组拼写 `thousnads_word_message_all` | 修正为 `thousands_word_message_all`（与 `KafkaConstants` 一致） | `OfflineDataStoreService/src/main/resources/application.yml` |
| B8 | RTC `PictureMessage.body` 类型错写 `TextMessageBody`（**该分支原本无法编译**） | 改为 `PictureMessageBody` | `RealTimeCommunicationService/.../model/PictureMessage.java` |
| B9 | 群/单聊新会话推送用同一 push code，客户端无法区分 | 新增 `PushTypeEnum.NEW_GROUP_SESSION_NOTIFICATION`，群会话推送改用之 | `RealTimeCommunicationService/.../constants/PushTypeEnum.java`、`service/impl/NettyMessageService.java` |
| B10 | `@PreventDuplicateSubmit` 切面**缺 `@Around` 绑定，实际从未生效** | 补上 `@Around("@annotation(...)")`，并改为 Redis 分布式幂等（见 C1） | `MessagingService/.../config/PreventDuplicateSubmitAspect.java` |

### C. 一致性 / 工程

| # | 问题 | 修复 | 涉及文件 |
|---|---|---|---|
| C1 | 红包防重提交是 JVM 内存 `ConcurrentHashMap`，跨实例失效且永不清理（内存泄漏） | 改为 Redis `setIfAbsent(key,"1",ttl)` 分布式幂等 | `MessagingService/.../config/PreventDuplicateSubmitAspect.java` |
| C2 | `FriendServiceImpl.addFriend` 做 4 处多行写却无事务 | 加 `@Transactional(rollbackFor = Exception.class)` | `ContactService/.../service/impl/FriendServiceImpl.java` |
| C3 | Moment `SendOkHttpRequest` 响应未关闭（连接泄漏）、每次新建 OkHttpClient | `execute()` 改 try-with-resources 关闭；OkHttpClient 复用字段 | `MomentService/.../utils/SendOkHttpRequest.java` |
| C4 | 694 个 macOS `._*` 文件未被忽略，`.gitignore` 缺 `target/`/`.idea/`/`*.iml` | 删除全部 `._*` 与 `.DS_Store`；`.gitignore` 补全 `._*`、`target/`、`.idea/`、`*.iml` 等 | `chat/.gitignore` |

---

## 第二部分 · 仍待改进（建议后续处理）

### 🔴 高优先级（正确性 / 一致性风险）

1. **Snowflake worker/datacenter 固定为 (1,1)**：多副本部署会产生重复 ID。`ConfigEnum` 虽支持环境变量覆盖，但默认值仍是 1/1，且多处各自 `new` 生成器。建议：从环境变量为**每个实例**注入唯一 `workerId/datacenterId`，并收敛为单例生成器。
2. **红包过期退款硬编码监听 Redis db0**（`__keyevent@0__:expired`）：若 `spring.redis.database` 非 0，keyspace 退款失效（仅靠定时兜底）。建议：监听通道随配置的库号动态拼接，并确认 `notify-keyspace-events Ex` 已开启。
3. **通知投递整体"尽力而为"**：除聊天正文有 Kafka outbox 外，WS ACK 重传是单 JVM 内存、Contact/Moment 的 push 失败仅日志，无重试/outbox。建议为关键通知引入持久化 outbox 或离线补偿。
4. **RTC 在线表 / pending-ACK 为单 JVM 内存，非高可用**：节点重启丢失全部 pending 重传与在线映射；而 Redis 路由 TTL(15min) > readerIdle(5min)，异常断开后可能短暂指向死节点，导致推送进黑洞。建议：路由失效与重传状态外置（Redis/集中存储）。

### 🟠 中优先级（鉴权改造遗留 / 错误语义）

5. ~~服务拦截器未排除 `/actuator/**` 与 `/error`~~ → **已修复**：5 个带 `/**` 拦截的服务(Auth/Contact/Messaging/Offline/Moment)现已 `excludePathPatterns("/actuator/**","/error")`，`check-apps.sh` 的健康探针恢复正常(RTC 仅拦 `/api/v1/message/**`，不受影响)。
6. **`X-Internal-Token` 默认值是开发占位符**：生产必须用环境变量 `INTERNAL_SERVICE_TOKEN` 覆盖（各服务一致），建议加入 `.env.example`。当前为对称共享密钥，更强方案是 mTLS 或签名令牌。
7. **错误语义不统一**：很多 4xx 业务错误（如"群不存在""不在群中"）被抛成 `ServiceException` → 500；Contact `GroupException(int,message)` 未 `super(message)` 导致 `getMessage()` 为 null。建议统一异常→状态码映射。
8. **Contact 中 String 型 `userUuid` 非数字会 `NumberFormatException` → 500**（而非干净 403）。建议在鉴权校验处做安全解析。
9. **网关 CORS 默认源仍是 `http://localhost:10010`**：生产需按真实前端域用 `GATEWAY_CORS_ALLOWED_ORIGIN` 覆盖；`allowedHeaders:"*"` + `allowCredentials:true` 在严格浏览器下不合规。

### 🟡 低优先级（功能 / 代码质量）

10. **fastjson 业务服务仍为 1.2.30 / 1.2.76**（本轮仅网关移除）：建议升级到 fastjson2，或至少 1.2.83（本机缓存已有 1.2.79 可先升）。本轮为避免改动序列化行为未升级。
11. **Auth 历史问题**（不在本轮范围）：验证码用后不删除（5 分钟内可重放）；`checkCode` 读取从不写入的 `verify:email:*` key（死功能）；`@Async` 无 `@EnableAsync`（发信同步阻塞请求线程）；SMS 未实现；`isRegister` 计数后再 save 非原子（并发注册竞态，依赖 DB 唯一约束）。
12. **Moment feed**：好友可见性基于单向 `friend` 表 + 内存 `containsKey` 过滤，单向好友会漏/错可见；`getMomentList` 无分页（全量扫描）；`MomentsVO.likes/comments` 从未挂载（三列表平铺返回）。
13. **红包极端一致性边角**：补偿依赖 catch 一定执行；若 JVM 在 Lua `rpop` 与 DB 提交之间崩溃，会少退已弹出未记录的那一份（过期按 `remaining` 退款无法覆盖）。可引入"领取中"中间态 + 对账。
14. **`demos/web` 脚手架死代码**（网关）、各服务 `static/index.html` 调试页、`System.out.println` 调试语句：建议清理。
15. **测试**：`UserServiceImplTest` mock 的是 `getOne` 而实现调用 `getOnly`（既有问题）；BCrypt 改造后相关断言可能需更新；建议补集成测试覆盖发消息/红包/离线幂等等关键链路。

---

## 第三部分 · 运行与部署注意事项（本轮改造带来的约定变化）

- **所有业务请求必须经网关**并携带有效 `Authorization: Bearer <JWT>`，否则 401；服务被直连时需带 `X-Internal-Token`。
- **服务间内部密钥** `internal.service.token` 默认 `infinite-chat-internal-dev-token`，生产用环境变量 `INTERNAL_SERVICE_TOKEN` 统一覆盖。
- **密码已切 BCrypt 且不兼容旧 MD5**：库里旧用户密码失效，需重置或重新注册。
- **`JWT_SECRET_KEY` 必须配置**，且网关与签发/验签各方一致（HS512），长度建议 ≥ 32 字节。
- **RTC 的 HTTP `/api/v1/message/**` 仅供内部**（需 `X-Internal-Token`）；客户端实时通信走 WebSocket（`/api/v1/netty`，握手时校验 JWT），不要经网关直调 RTC 的 HTTP 推送端点。
- **构建需联网**（alimaven 镜像）首次拉取 `spring-security-crypto:5.6.8` 等；本机已验证 `mvn compile` 与 `mvn test-compile` 全模块通过。
- **端到端验证**：见 [E2E-TESTING.md](E2E-TESTING.md) —— 一套与 WSL 现有运行栈完全隔离(独立库/Redis 索引/Nacos 命名空间/Kafka broker/端口段)、从修复后源码构建的 E2E 环境与冒烟测试，逐条验证上述修复。
