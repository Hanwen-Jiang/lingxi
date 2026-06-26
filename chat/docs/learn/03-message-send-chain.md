# 第 3 章 发消息核心链路

> 本章主题：一句话——**一条聊天消息从 `POST /api/v1/chat/session` 进来后，MessagingService 如何做权限校验、生成全局唯一 ID、用「事务性 Outbox」保证消息不丢，再通过 Redis 路由把消息实时推给在线节点；而聊天正文的最终落库并不在这里。**

学完你能回答这些问题：

- 发一条消息要经过哪些步骤？谁负责校验"你是不是有权发"？
- `messageId` 是怎么来的？为什么用 Snowflake 而不是数据库自增？
- 什么是"事务性 Outbox 模式"？它到底解决了"消息丢失"中的哪一种？
- `message_outbox` 表里的 `uk_message_id`、`status`、`retry_count` 各自起什么作用？
- Kafka 发送失败了会怎样？`@Scheduled` 重试是怎么补偿的？
- MessagingService 怎么知道接收者在哪台 RTC 机器上？找不到(离线)怎么办？
- 为什么说"MessagingService 自己不写 `message` 表"？正文最后存到哪了？

---

## 1. 全景时序图

```
客户端                网关(10010)          MessagingService(8081)                        Redis        Kafka      RTC(8083)
  │ POST /api/v1/chat/session                                                            │            │           │
  │  Authorization: Bearer JWT                                                           │            │           │
  ├───────────────────►│ AuthGlobalFilter 验签                                          │            │           │
  │                     │ 注入 X-User-Id，剥离伪造头                                      │            │           │
  │                     ├──────────────────►│ AuthContextInterceptor                     │            │           │
  │                     │                    │  X-User-Id → UserContext(ThreadLocal)      │            │           │
  │                     │                    │ SendMsgController.sendMsg()                │            │           │
  │                     │                    │  ① UserContext==sendUserId? 否→403         │            │           │
  │                     │                    │ MessageServiceImpl.sendMessage()           │            │           │
  │                     │                    │  ② validateSender 发送者存在/正常          │            │           │
  │                     │                    │  ③ 取接收者(单聊=好友; 群聊=群成员)         │            │           │
  │                     │                    │  ④ buildAppMessage 组装消息体              │            │           │
  │                     │                    │  ⑤ generateMessageId (Snowflake)          │            │           │
  │                     │                    │ KafkaOutboxServiceImpl.saveAndSend()       │            │           │
  │                     │                    │  ⑥ INSERT message_outbox (status=INIT) ────┼──(本地库)──┤           │
  │                     │                    │  ⑦ kafkaTemplate.send() ───────────────────┼────────────►│          │
  │                     │                    │     回调: 成功→SENT / 失败→FAILED            │            │  (第5章消费)│
  │                     │                    │ RealtimeRouteService.groupUsersByRoute()   │            │           │
  │                     │                    │  ⑧ 读 user:session:{uid} 找在线节点 ────────►│           │           │
  │                     │                    │  ⑨ OkHttp + X-Internal-Token ──────────────┼────────────┼──────────►│ 推送
  │                     │◄───────────────────┤ Result.ok(SendMsgResponse)                 │            │           │
  │◄────────────────────┤                    │                                            │            │           │
  │                                          │  ⏰ @Scheduled 每 10s 扫 outbox 补偿未发成功的 ─────────────►│          │
```

一句话概括这张图的两条腿：

- **左腿(可靠落库 → Kafka → 第 5 章离线存储)**：保证"消息一定不丢"。
- **右腿(Redis 路由 → RTC 实时推送)**：保证"在线的人立刻收到"。两条腿互不阻塞，右腿失败也不影响消息可靠性。

---

## 2. 关键类 / 方法表

| 类 / 文件 | 职责 |
| --- | --- |
| `controller/SendMsgController` | HTTP 入口 `POST /api/v1/chat/session`；用 `UserContext` 校验"发送者必须是登录本人"，否则 403。 |
| `service/impl/MessageServiceImpl` | 编排整条链路：校验发送者/接收者、组装 `AppMessage`、生成 Snowflake `messageId`、调 Outbox、调实时路由推送。 |
| `service/impl/KafkaOutboxServiceImpl` | 事务性 Outbox 的核心：先 `INSERT message_outbox` 再发 Kafka；`@Scheduled` 定时补偿未成功的消息。 |
| `route/RealtimeRouteService` | 读 Redis `user:session:{userId}` 求出每个接收者所在的 RTC 节点，并按节点分组；清理失效路由。 |
| `constants/MessageOutboxStatus` | Outbox 状态机常量：`INIT(0)/PENDING(1)/SENT(2)/FAILED(3)`。 |
| `data/sendMsg/SendMsgRequest` | 入参：`sessionId / sendUserId / sessionType / type / receiveUserId / body`。 |
| `data/sendMsg/AppMessage` | 推送给 RTC 的消息载体：含 `messageId / receiveUserIds / userName / avatar / body / created` 等。 |
| `data/sendMsg/KafkaMsgVO` | 写入 Kafka 的消息载体(由 `SendMsgRequest` 拷贝 + `messageId/createAt`)。 |
| `config/AuthContextInterceptor` | `X-Internal-Token` 内部放行；否则要求 `X-User-Id` 并写入 `UserContext`。 |
| `resources/sql/message_outbox.sql` | Outbox 表 DDL，含 `uk_message_id` 去重唯一键。 |

---

## 3. 入口：谁能发、能不能代别人发

`SendMsgController.sendMsg()` 做的第一件事，是确认"你正在以自己的身份发消息"：

```java
// controller/SendMsgController.java:33-42
@PostMapping("/v1/chat/session")
public Result<SendMsgResponse> sendMsg(@RequestBody SendMsgRequest request) throws Exception {
    Long currentUserId = UserContext.get();
    if (currentUserId != null && !currentUserId.equals(request.getSendUserId())) {
        throw new ResponseStatusException(HttpStatus.FORBIDDEN, "无权代表他人发送消息");
    }
    SendMsgResponse response = messageService.sendMessage(request);
    return Result.ok(response);
}
```

这里 `UserContext.get()` 的值不是客户端传的，而是**网关验签后注入的可信 `X-User-Id`**，再由 `AuthContextInterceptor` 写入 ThreadLocal（见第 1/2 章的鉴权链）。所以即使请求体里把 `sendUserId` 改成别人，也会被这一行拦下来——客户端伪造不了 `UserContext`。

> 注意：`currentUserId != null` 这个写法意味着——如果是**内部服务调用**（命中 `X-Internal-Token`，拦截器没设 `UserContext`），这一步会被跳过。普通客户端请求一定经过网关注入，所以总能拿到 `currentUserId`。

---

## 4. 编排：sendMessage 的五步

`MessageServiceImpl.sendMessage()` 是整章的主干，只有短短二十行，把活儿全分派出去了：

```java
// service/impl/MessageServiceImpl.java:103-125
public SendMsgResponse sendMessage(SendMsgRequest request) {
    // 1.校验用户是否存在
    validateSender(request.getSendUserId());

    // 2.判断单聊还是群聊，群聊去获取用户名单
    List<Long> receiveUserIds = getReceiveUserIds(request);
    validateReceiveUserIds(receiveUserIds);

    // 3.构建消息
    AppMessage appMessage = buildAppMessage(request, receiveUserIds);
    Long messageId = generateMessageId();
    Date createdAt = new Date();
    appMessage.setMessageId(messageId).setCreated(formatDate(createdAt));

    // 写入本地outbox后异步发送Kafka，失败时由定时任务补偿
    sendKafkaMessage(request, request.getSendUserId(), messageId, createdAt);

    // 4.Redis保存真实在线路由；缺失说明当前没有长连接，实时推送跳过，离线消息由存储链路兜底
    sendRealTimeMessage(request, appMessage);

    return buildAppMessage(appMessage);
}
```

### 4.1 校验发送者与接收者

- **发送者**：`validateSender` 查 `user` 表，要求存在且 `status == 1`（active），否则抛 `ServiceException("发送者状态异常")`。
- **接收者**取决于会话类型（`SessionType`：`SINGLE(1) / GROUP(2)`）：
  - **单聊**：接收者就是 `receiveUserId`。`validateSingleSession` 额外校验两点——接收者也得是 active，且**两人必须是好友**（`friendMapper.selectFriendship` 查到 `status==1` 的好友关系），否则报"不是好友关系"。
  - **群聊**：`userSessionService.getUserIdsBySessionId(sessionId)` 取出全部群成员，**移除发送者自己**。如果发送者根本不在成员列表里（`remove` 返回 false），抛 `ServiceException("发送者不在群聊内")`——这同时起到了"非群成员不能往群里发"的鉴权作用。

```java
// service/impl/MessageServiceImpl.java:277-296（节选群聊分支）
receiveUserIds.addAll(userSessionService.getUserIdsBySessionId(sendMsgRequest.getSessionId()));
boolean removed = receiveUserIds.remove(sendMsgRequest.getSendUserId());
if (!removed) {
    throw new ServiceException("发送者不在群聊内");
}
```

### 4.2 生成全局唯一 messageId：为什么用 Snowflake

```java
// service/impl/MessageServiceImpl.java:246-252
private Long generateMessageId() {
    Snowflake snowflake = IdUtil.getSnowflake(
            Integer.parseInt(ConfigEnum.WORKED_ID.getValue()),     // workerId=1
            Integer.parseInt(ConfigEnum.DATACENTER_ID.getValue())  // datacenterId=1
    );
    return snowflake.nextId();
}
```

**为什么不直接用数据库自增 ID？** 因为这条链路是分布式的：消息要进 Kafka、要被多台 RTC 推送、最终在离线服务落库。如果用自增 ID，必须等数据库写完才知道 ID，而我们恰恰希望**在写库之前就拿到 ID**（去重、推送都要靠它）。Snowflake 是本地内存生成的 64 位趋势递增数字，不依赖任何中心，毫秒级生成，天然适合做"消息全局主键 + 去重键"。这个 `messageId` 会一路贯穿：Kafka payload、`message_outbox.message_id`、RTC 推送、最终 `message` 表主键。

> 小坑：`workerId` 和 `datacenterId` 都写死成 `1`（`ConfigEnum.WORKED_ID/DATACENTER_ID`）。单实例没问题，但**多实例部署时若不区分 workerId，理论上有极小概率撞 ID**。这是后续可以改进的点。

---

## 5. 核心中的核心：事务性 Outbox 模式

这是本章最值得吃透的设计。先想清楚它解决什么问题。

### 5.1 要解决什么问题：双写不一致

发消息这件事，本质要同时干两件副作用：

1. 把消息**可靠地交给 Kafka**（下游第 5 章消费后落库）。
2. （本服务里没有写正文表，但概念上）记下"这条消息我处理过了"。

如果直接 `kafkaTemplate.send(...)` 然后不管，会出现经典的**双写问题**：

- 程序刚把消息发给 Kafka，**还没收到确认就宕机/网络抖动** → 你以为发了，其实没发成功 → **消息丢失**。
- 或者你先记了"已处理"，再发 Kafka 失败 → 状态和现实不符。

裸发 Kafka 没有"重试 + 状态追踪"的载体，丢了就是丢了。

### 5.2 怎么解决：先落库，再发，靠状态机兜底

Outbox 模式的思路是：**把"我要发的这条 Kafka 消息"本身，先作为一行记录写进自己的数据库**（`message_outbox` 表），然后再尝试发 Kafka。无论发成功还是失败，数据库里都留着这行"待办"，于是：

- 发成功 → 把这行标记为 `SENT`。
- 发失败 / 进程崩了 → 这行还停在 `INIT`/`PENDING`/`FAILED`，**定时任务会再来捞它重发**。

这样"消息至少被发出去一次"(at-least-once) 就有了可靠保证。

```java
// service/impl/KafkaOutboxServiceImpl.java:43-59
public void saveAndSend(Long messageId, String topic, String messageKey, String payload) {
    Date now = new Date();
    MessageOutbox outbox = new MessageOutbox()
            .setMessageId(messageId)
            .setTopic(topic)
            .setMessageKey(messageKey)
            .setPayload(payload)
            .setStatus(MessageOutboxStatus.INIT)   // 0
            .setRetryCount(0)
            .setNextRetryAt(now)
            .setCreatedAt(now)
            .setUpdatedAt(now);

    messageOutboxMapper.insert(outbox);   // ① 先落库
    sendOutboxMessage(outbox);            // ② 再发 Kafka
}
```

注意顺序：**先 `insert` 再 `send`**。即使第 ② 步整个 JVM 崩了，第 ① 步那行 `INIT` 记录也已经在库里了，补偿任务捞得到。这就是 Outbox 的精髓——**用一次本地 DB 写入，把"易丢的网络发送"变成"可恢复的待办事项"**。

### 5.3 真正发送 + 状态流转

```java
// service/impl/KafkaOutboxServiceImpl.java:89-98
private void sendOutboxMessage(MessageOutbox outbox) {
    markPending(outbox);   // 状态→PENDING，retryCount+1，nextRetryAt 推后
    try {
        kafkaTemplate.send(outbox.getTopic(), outbox.getMessageKey(), outbox.getPayload())
                .addCallback(result -> markSent(outbox.getId()),         // 成功→SENT
                             ex -> markFailed(outbox.getId(), ex));       // 失败→FAILED
    } catch (Exception ex) {
        markFailed(outbox.getId(), ex);
    }
}
```

状态机一图流：

```
INIT(0) ──markPending──► PENDING(1) ──send成功回调──► SENT(2)   ← 终态
   ▲                         │
   │                         └──send失败回调────────► FAILED(3)
   └───────────── @Scheduled 定时任务重新捞起 INIT/PENDING/FAILED ────────────┘
```

- `markPending`：发送前先置 `PENDING` 并 `retryCount+1`，把 `nextRetryAt` 推到 `now + pendingTimeoutMillis`（30s）。**这一步很关键**——如果发送回调一直没回来（比如进程卡死），这行会卡在 `PENDING`，但因为 `updatedAt` 过久，补偿任务能识别出"超时的 PENDING"重新发。
- `markSent`：成功，置 `SENT`（终态），清掉 `lastError`。
- `markFailed`：失败，置 `FAILED`，记录截断后的错误信息（最多 500 字符），把 `nextRetryAt` 推后 `retryDelayMillis`（10s）等下次重试。它还有一个保护：如果发现这行已经是 `SENT`，就**不再回退状态**（避免成功回调和失败回调竞态导致状态被覆盖）。

### 5.4 定时补偿：@Scheduled 重试

```java
// service/impl/KafkaOutboxServiceImpl.java:61-87
@Scheduled(fixedDelayString = "${message.outbox.retry-fixed-delay:10000}")  // 每 10s
public void retryUnsentMessages() {
    Date now = new Date();
    Date pendingExpiredAt = new Date(now.getTime() - pendingTimeoutMillis);

    LambdaQueryWrapper<MessageOutbox> wrapper = new LambdaQueryWrapper<MessageOutbox>()
            .in(MessageOutbox::getStatus, Arrays.asList(INIT, FAILED, PENDING))
            .lt(MessageOutbox::getRetryCount, maxRetryCount)               // 没超最大重试次数
            .and(query -> query
                    .le(MessageOutbox::getNextRetryAt, now)                 // 到了重试时间
                    .or()
                    .and(pending -> pending                                 // 或者是"超时卡死的 PENDING"
                            .eq(MessageOutbox::getStatus, PENDING)
                            .le(MessageOutbox::getUpdatedAt, pendingExpiredAt)))
            .orderByAsc(MessageOutbox::getCreatedAt)
            .last("limit " + retryBatchSize);                              // 一批最多 100 条

    List<MessageOutbox> outboxMessages = messageOutboxMapper.selectList(wrapper);
    for (MessageOutbox outboxMessage : outboxMessages) {
        sendOutboxMessage(outboxMessage);   // 复用同一套发送逻辑
    }
}
```

捞取条件读懂这三点就够了：

1. **只捞没发成功的**：状态在 `INIT/FAILED/PENDING`（`SENT` 永远不会被捞）。
2. **不无限重试**：`retryCount < maxRetryCount`（默认 10 次）。超过 10 次的会留在库里不再自动重试，相当于进了"死信"，等人工排查。
3. **两种"该重试"的情形**：要么 `nextRetryAt` 到点了；要么是"卡死的 PENDING"——状态是 `PENDING` 且 `updatedAt` 早于 `now - 30s`，说明上次发送大概率丢了回调。

### 5.5 `uk_message_id` 去重——为什么不会重复落库

Outbox 模式是 **at-least-once**：补偿重试 + Kafka 本身的重试，都可能让**同一条消息被发多次**。那下游岂不是要重复存？靠的就是这张表的唯一键：

```sql
-- resources/sql/message_outbox.sql
CREATE TABLE IF NOT EXISTS message_outbox (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    message_id BIGINT NOT NULL,
    topic VARCHAR(128) NOT NULL,
    message_key VARCHAR(128) NOT NULL,
    payload TEXT NOT NULL,
    status TINYINT NOT NULL COMMENT '0 INIT, 1 PENDING, 2 SENT, 3 FAILED',
    retry_count INT NOT NULL DEFAULT 0,
    next_retry_at DATETIME NOT NULL,
    last_error VARCHAR(500) NULL,
    created_at DATETIME NOT NULL,
    updated_at DATETIME NOT NULL,
    UNIQUE KEY uk_message_id (message_id),          -- 同一条消息只会有一行 outbox
    KEY idx_status_next_retry (status, next_retry_at),  -- 补偿扫描走索引
    KEY idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

- `uk_message_id`：保证**同一个 Snowflake `messageId` 在本表只占一行**——重复 `saveAndSend` 会被唯一键挡掉，不会产生第二张待办。
- 而下游（第 5 章离线存储服务）消费 Kafka 时，同样以 `messageId` 作为幂等键去重落库。整条链路靠这个全局 ID 实现"发多次、存一次"的最终一致。

> 关于 Kafka 分区有序：`saveAndSend` 传的 `messageKey` 是 `sessionId.toString()`（见 `MessageServiceImpl.sendKafkaMessage`）。**同一会话的消息用相同 key → 落到同一分区 → 天然按发送顺序消费**，这对聊天"消息不乱序"很重要。

---

## 6. 右腿：实时路由与推送

可靠性那条腿走完后，`sendRealTimeMessage` 负责"让在线的人立刻看到"。

### 6.1 在哪台机器上？读 Redis 路由

用户每次通过 Netty 建立长连接时，RTC 会在 Redis 写一个键 `user:session:{userId} = "ip:8083"`（TTL 15 分钟，见第 4 章）。MessagingService 反过来读这个键就知道接收者挂在哪台 RTC 上：

```java
// route/RealtimeRouteService.java:30-45
public Map<String, List<Long>> groupUsersByRoute(List<Long> userIds) {
    Map<String, List<Long>> routeMap = new LinkedHashMap<>();
    for (Long userId : userIds) {
        String route = getActualRoute(userId);   // GET user:session:{userId}
        if (route == null || route.trim().isEmpty()) {
            log.info("用户{}无Redis在线路由，判定为离线，不进行实时推送", userId);
            continue;   // 离线：跳过推送，正文由 Kafka→离线存储兜底
        }
        routeMap.computeIfAbsent(normalizeRoute(route), key -> new ArrayList<>()).add(userId);
    }
    return routeMap;
}
```

两个设计点：

- **按节点分组**：群聊里 100 个成员可能分散在多台 RTC 上。这里把"同一节点上的接收者"聚成一组（`{ "http://ip:8083" -> [uid1, uid2...] }`），后面一台机器只发一次 HTTP，节点内部再分发，省请求。
- **离线即跳过**：拿不到 Redis 路由就认定离线，**直接不推**。注意——消息**不会因此丢**，因为左腿已经把它送进 Kafka，第 5 章会把它存成离线消息，等用户上线再拉。

### 6.2 带内部令牌调 RTC

分组后，对每个节点用 OkHttp 发一次 POST，URL 是 `route + /api/v1/message/user/`（`ConfigEnum.MSG_URL`），并带上服务间互信的 `X-Internal-Token`：

```java
// service/impl/MessageServiceImpl.java:201-211
private Request buildRealtimeRequest(String route, AppMessage appMessage) {
    RequestBody requestBody = RequestBody.create(
            MediaType.parse(ConfigEnum.MEDIA_TYPE.getValue()),
            JSON.toJSONString(appMessage));
    return new Request.Builder()
            .url(route + ConfigEnum.MSG_URL.getValue())   // http://ip:8083/api/v1/message/user/
            .header("X-Internal-Token", internalToken)     // RTC 的拦截器据此放行
            .post(requestBody)
            .build();
}
```

RTC 侧的 `AuthContextInterceptor` 看到合法 `X-Internal-Token` 就直接放行（不需要 `X-User-Id`），因为这是可信的服务间调用。

- **单聊**(`sendSingleMessage`)：只有一个接收者，同步发；失败时清理失效路由并抛 `ServiceException`。
- **群聊**(`sendGroupMessage`)：多个节点用线程池 `groupMessageExecutor`（core 5 / max 10 / 队列 100 / `CallerRunsPolicy`）并发推送；**某个节点失败只清理它自己的路由并记日志，不影响其他节点，也不让整个请求失败**。

### 6.3 推送失败 → 清理"脏路由"

如果对某节点的 HTTP 调用失败（连接拒绝/超时等），很可能是那台 RTC 挂了或用户其实已断连，但 Redis 键还没过期。此时调 `removeRouteIfMatch` 把对应用户的 `user:session:{uid}` 删掉（仅当当前值还等于这个失效路由时才删，避免误删用户刚切换到的新节点）：

```java
// route/RealtimeRouteService.java:47-57
public void removeRouteIfMatch(Long userId, String route) {
    String key = UserConstants.USER_SESSION + userId;            // user:session:{uid}
    String currentRoute = redisTemplate.opsForValue().get(key);
    if (currentRoute != null && normalizeRoute(currentRoute).equals(normalizeRoute(route))) {
        redisTemplate.delete(key);
    }
}
```

---

## 7. 关键认知：MessagingService 不写 `message` 表

这是初学者最容易误解的一点。请记住：

> **MessagingService 在发消息链路里，从头到尾没有 INSERT 聊天正文到 `message` 表。**

它只做了三件持久化动作：

1. 写 `message_outbox`（一行"待发 Kafka 的待办"，不是聊天记录本身）。
2. 把消息塞进 Kafka topic `thousands_word_message`。
3. 调 Redis（读路由 + 失败时删路由）。

**聊天正文真正落库发生在 OfflineDataStoreService（第 5 章）**：它消费 `thousands_word_message`，以 `messageId` 幂等去重，把正文写进 `message` 表 / 离线信箱。这样设计的好处是：发消息接口**不被写库 I/O 阻塞**，吞吐更高；落库慢/抖动也不影响"消息已可靠收下"这个事实——因为 Kafka 已经替我们扛住了。

> 旁证：`MessageServiceImpl` 虽然 `extends ServiceImpl<MessageMapper, Message>`，但通读 `sendMessage` 链路并没有调用 `this.save(message)` 之类写 `message` 表的动作。它继承 Mapper 更多是历史/便利原因，发送链路并不依赖它落库。

---

## 8. 数据落点速查表

| 类型 | 落点 | 说明 |
| --- | --- | --- |
| MySQL 表 | `message_outbox` | 唯一会写的表。`status`(INIT/PENDING/SENT/FAILED)、`retry_count`、`next_retry_at`、`uk_message_id` 去重。 |
| MySQL 表 | `user` / `friend` / `session` / `user_session` | **只读**：校验发送者、好友关系、会话信息、群成员名单。 |
| Redis key | `user:session:{userId}` = `"ip:8083"` | **只读 + 失败时删**：求接收者在线节点，TTL 15min（由 RTC 维护，见第 4 章）。 |
| Kafka topic | `thousands_word_message` | 写入 `KafkaMsgVO` 的 JSON；分区 key = `sessionId`，保证同会话有序；第 5 章消费落库。 |
| HTTP 出站 | `http://{ip}:8083/api/v1/message/user/` | 带 `X-Internal-Token` 推送 `AppMessage` 给 RTC。 |

---

## 9. 失败与边界处理小结

| 场景 | 行为 |
| --- | --- |
| 不是本人发（`UserContext != sendUserId`） | `SendMsgController` 抛 403 `无权代表他人发送消息`。 |
| 发送者不存在/被禁用 | `validateSender` 抛 `发送者状态异常`。 |
| 单聊但非好友 / 接收者异常 | `validateSingleSession` 抛 `不是好友关系` / `接收者状态异常`。 |
| 群聊但发送者不在群里 | `getReceiveUserIds` 抛 `发送者不在群聊内`。 |
| 接收者名单为空 | `validateReceiveUserIds` 抛 `接收者列表不能为空`。 |
| Kafka 发送失败 | outbox 行置 `FAILED`，`@Scheduled` 每 10s 捞起重发，最多 `maxRetryCount`(10) 次。 |
| 发送回调丢失（卡死的 PENDING） | 超过 `pendingTimeoutMillis`(30s) 的 PENDING 被补偿任务重新发送。 |
| 接收者离线（无 Redis 路由） | 跳过实时推送，**消息不丢**，由 Kafka→离线存储兜底。 |
| 某 RTC 节点推送失败 | 单聊：抛异常并清失效路由；群聊：仅清该节点路由、记日志，不影响其他节点与整体成功。 |
| 进程在 insert 后、send 前崩溃 | outbox 行停在 `INIT`，重启后被补偿任务捞起，**不丢**。 |

---

## 10. 动手实践

### 准备：拿到 JWT

先按第 1 章登录拿到 token（`POST /api/v1/user/login`），记为 `$TOKEN`。下面所有请求都走网关 `10010`。

### 发一条单聊消息

```bash
curl -X POST http://localhost:10010/api/v1/chat/session \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "sessionId": 1001,
    "sendUserId": 1,          # 必须等于 token 里的用户，否则 403
    "sessionType": 1,         # 1=单聊
    "type": 1,
    "receiveUserId": 2,       # 必须与发送者是好友
    "body": "hello from chapter 3"
  }'
```

期望返回 `Result.ok`，`data` 里带回 `messageId`、`createdAt`。

### 验证 Outbox 落库与发送状态

```sql
-- 查最新这条 outbox：理想情况下很快变成 status=2(SENT)
SELECT message_id, status, retry_count, next_retry_at, last_error, created_at
FROM message_outbox
ORDER BY created_at DESC
LIMIT 5;
```

- `status=2`：Kafka 发成功了。
- `status=0/1/3` 且 `retry_count` 在涨：Kafka 没起或连不上，正在被 `@Scheduled` 重试——这正是观察 Outbox 补偿的好机会。

### 故意制造失败看补偿

把本地 Kafka 停掉，再发一条消息，然后反复查上面那条 SQL：你会看到 `status` 在 `PENDING/FAILED` 之间、`retry_count` 每约 10s +1、`last_error` 写着连接异常。重新启动 Kafka 后，下一轮补偿会把它推成 `SENT`——**这就是"消息不丢"的现场演示**。

### 验证 Kafka 收到

```bash
# 看 topic 里有没有刚发的消息
kafka-console-consumer.sh --bootstrap-server localhost:9092 \
  --topic thousands_word_message --from-beginning
```

### 验证实时路由

```bash
# 接收者(uid=2)在线时应有此键；删掉它再发消息，观察日志打印"判定为离线，不进行实时推送"
redis-cli GET user:session:2
```

### 验证"正文不在本服务落库"

发完消息后查 `message` 表——你会发现**正文不是 MessagingService 写进去的**（它在第 5 章离线服务消费 Kafka 后才出现）。可以临时停掉离线服务，发消息成功但 `message` 表暂时没有新行，等离线服务恢复消费后补上，借此理解"两条腿解耦"。

---

## 11. 小结 + 下一步

这一章你应该已经建立起这条心智模型：

- **入口鉴权**靠网关注入的 `X-User-Id` + `UserContext`，杜绝冒名发送。
- **messageId** 用 Snowflake 在写库前生成，贯穿全链路做主键与去重键。
- **可靠性**靠事务性 Outbox：先落 `message_outbox` 再发 Kafka，状态机 + `@Scheduled` 补偿保证 at-least-once，`uk_message_id` + 下游幂等保证"发多次存一次"。
- **实时性**靠 Redis 路由 + OkHttp(`X-Internal-Token`) 推 RTC，离线则跳过、由存储链路兜底。
- **职责边界**：MessagingService 只写 outbox、发 Kafka、读路由；**聊天正文的最终落库在第 5 章**。

**下一步读哪篇：**

- **第 4 章 实时长连接与在线状态**：RTC 怎么用 Netty 维护 WebSocket、怎么写/续期 `user:session:{userId}`、收到本章推送的 `/api/v1/message/user/` 后如何投递到具体连接。
- **第 5 章 离线存储与最终落库**：OfflineDataStoreService 怎么消费 `thousands_word_message`、以 `messageId` 幂等写 `message` 表、离线用户上线后如何补拉。
