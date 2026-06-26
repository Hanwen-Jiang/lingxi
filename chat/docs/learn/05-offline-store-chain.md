# 第 5 章 离线存储与历史拉取

> 本章主题：**消息发出去之后，如何被"另一条链路"持久化成历史，并在用户重连后按时间水位补齐漏收的消息。**

这是发送链（第 3 章）的"下游分叉"。在第 3 章里，消息走 Kafka 被实时推给在线用户；本章讲的是同一条 Kafka 消息被 `OfflineDataStoreService` 消费、**幂等落库**到 `message` 表，以及客户端重连后通过 `GET /api/v1/offline/message` 把历史拉回来。

**学完你能回答这些问题：**

- 为什么要单独搞一个"离线存储服务"，而不是发送时顺手写库？
- Kafka 消费者为什么**必须**幂等？不幂等会发生什么（毒消息循环）？
- `OfflineDataStoreService` 是怎么做幂等的（`selectById` 预判 + `DuplicateKeyException` 兜底），两道防线各挡什么？
- 重连后客户端怎么知道"我漏了哪些消息"？"客户端水位（时间戳）"这个设计的取舍是什么？
- 一次历史拉取背后做了几次查询、join 了哪几张表？

---

## 1. 为什么要这么设计：发送与存储解耦

先回到第 3 章的发送链。`MessagingService` 收到一条聊天消息后，并**不是**自己直接落历史库，而是把消息写进自己的 **Outbox（发件箱）表**，再由定时任务投递到 Kafka topic `thousands_word_message`：

```java
// MessagingService/src/main/java/com/lou/messagingservice/service/impl/KafkaOutboxServiceImpl.java:89
private void sendOutboxMessage(MessageOutbox outbox) {
    markPending(outbox);
    kafkaTemplate.send(outbox.getTopic(), outbox.getMessageKey(), outbox.getPayload())
            .addCallback(result -> markSent(outbox.getId()),
                         ex -> markFailed(outbox.getId(), ex));
}
```

谁来消费这条 Kafka 消息、落成历史？就是本章的主角 `OfflineDataStoreService`。这样拆分有几个好处：

| 设计选择 | 解决的问题 |
| --- | --- |
| 发送服务只管"投递到 Kafka"，不管存历史 | 发送链路更快、更轻；落库慢/库抖动不拖累实时推送 |
| 独立服务订阅同一条 topic | 想加"消息搜索""数据分析"等其他消费者，只要再加一个消费组即可，不改发送方 |
| 历史持久化异步化 | 即使存储服务短暂宕机，消息还躺在 Kafka 里，恢复后从 offset 续上 |

但"异步 + Kafka"带来一个绕不开的代价：**Kafka 是 at-least-once（至少一次）投递**。也就是说，同一条消息**可能被投递多次**。证据就在生产端：`KafkaOutboxServiceImpl.retryUnsentMessages()`（`:61`）是一个 `@Scheduled` 定时任务，会把 `PENDING` 超时（默认 30s 没收到 ack）的 Outbox 记录**重新发一遍**。网络抖动、broker 重平衡、消费者重启没提交 offset……任何一种都会让同一条消息再来一次。

> 一句话：**生产端会重发，消费端就必须能"重复消费而不出错"。这就是幂等的由来。**

---

## 2. 整体时序图

```
 发送方(第3章)                Kafka                  OfflineDataStoreService              MySQL
 ───────────                ─────                  ──────────────────────              ─────
 Outbox.saveAndSend ──────► topic:                                                     
                            thousands_word_message                                     
                                  │                                                    
                                  │  poll (group:                                      
                                  │  thousands_word_message_all)                       
                                  ├──────────────────► MessageConsumer.listen(json)    
                                  │                          │                         
                                  │                          ▼                         
                                  │                  saveOfflineMessage(json)          
                                  │                          │                         
                                  │              ① selectById(messageId) 已存在? ──Y──► 跳过, return
                                  │                          │ N                       
                                  │                          ▼                         
                                  │              ② insert(msg) ─────────────────────► message 表
                                  │                          │   DuplicateKeyException?
                                  │                          └── catch 并忽略(并发兜底)
                                  │                          │                         
                                  ◄──────────────── offset 正常提交                     


 === 用户重连后补历史 ===

 客户端          GateWay(10010)        OfflineDataStoreService              MySQL
 ──────          ─────────────        ──────────────────────              ─────
 GET /api/v1/offline/message
   ?userId=U&time=T  ──────► 验签, 注入 X-User-Id ──► MessageController
                                                          │ UserContext 校验 U 是本人
                                                          ▼
                                              getOfflineMessage(req)
                                                          │
                                              ① 查 user_session: U 属于哪些 sessionId
                                                          │
                                              ② MPJ join: message ⋈ red_packet ⋈ user
                                                  where session_id in(...) and created_at >= T
                                                          ▼
                                              按 session 分组 ──► Result<OfflineMsgResponse>
```

---

## 3. 关键类 / 方法一览

| 类 / 文件 | 职责 |
| --- | --- |
| `consumer/MessageConsumer.java` | `@KafkaListener` 入口，监听 `thousands_word_message`，把 JSON 透传给 service |
| `constants/kafka/KafkaConstants.java` | 常量：topic = `thousands_word_message`，消费组 = `thousands_word_message_all` |
| `service/impl/MessageServiceImpl#saveOfflineMessage` | **幂等落库**：反序列化 → 主键查重 → insert → 捕获 `DuplicateKeyException` |
| `service/impl/MessageServiceImpl#getOfflineMessage` | 历史拉取主流程：查会话 → 查消息 → 按 session 组装 |
| `service/impl/MessageServiceImpl#findOfflineMsgBySessionId` | MPJ 多表 join，按时间水位过滤，拼装每条消息详情 |
| `controller/MessageController.java` | `GET /api/v1/offline/message`，用 `UserContext` 做"操作人本人"校验 |
| `service/impl/UserSessionServiceImpl#findSessionIdByUserId` | 查 `user_session` 表，得到该用户加入的所有会话 ID |
| `config/AuthContextInterceptor.java` | 鉴权拦截：`X-Internal-Token` 放行 / `X-User-Id` 入 `UserContext` / 否则 401 |
| `common/TextMessage.java` + `MessageBody.java` | Kafka 消息的反序列化目标（与生产端的消息结构对齐） |

---

## 4. 关键代码片段精讲

### 4.1 消费入口：只有一行，但语义重要

```java
// consumer/MessageConsumer.java:20
@KafkaListener(topics = KafkaConstants.topic, groupId = KafkaConstants.consumerGroupId)
public void listen(String message) {
    messageService.saveOfflineMessage(message);
}
```

- topic、groupId 都从 `KafkaConstants` 取常量，避免散落的魔法字符串。
- 这里用的是**自动提交 offset**（`application.yml` 没有关 `enable-auto-commit`，也没有手动 `Acknowledgment`）。这意味着：**只要 `listen` 方法正常返回（不抛异常），offset 就会被提交**。
- 反过来：**如果 `saveOfflineMessage` 抛异常，offset 不提交，这条消息会被反复重投——这就是"毒消息循环"**。所以幂等的真正目标，是保证方法**永远能正常返回**，让 offset 顺利前进。

### 4.2 幂等落库的两道防线

```java
// service/impl/MessageServiceImpl.java:47
public void saveOfflineMessage(String message) {
    TextMessage textMessage = JSONUtil.toBean(message, TextMessage.class);
    Message msg = new Message();
    BeanUtils.copyProperties(textMessage, msg);
    msg.setContent(textMessage.getBody().getContent())
            .setReplyId(textMessage.getBody().getReplyId())
            .setSenderId(textMessage.getSendUserId());

    // 第一道防线: 按主键查重
    if (msg.getMessageId() != null && this.baseMapper.selectById(msg.getMessageId()) != null) {
        log.info("离线消息已存在，跳过重复消费, messageId={}", msg.getMessageId());
        return;
    }

    try {
        int insert = this.baseMapper.insert(msg);
        if (insert <= 0) {
            throw new RuntimeException("保存离线消息失败");
        }
    } catch (DuplicateKeyException e) {
        // 第二道防线: 并发竞态兜底
        log.info("离线消息并发重复，忽略, messageId={}", msg.getMessageId());
    }
}
```

这两道防线缺一不可，分工如下：

| 防线 | 挡的是什么 | 为什么单靠它不够 |
| --- | --- | --- |
| ① `selectById` 预判 | **顺序重投递**：消息 A 落库成功 → 几秒后又被投一次。这次查得到，直接 `return` | 在并发下有"check-then-act"竞态：两条相同消息几乎同时进来，都查不到，都去 insert |
| ② catch `DuplicateKeyException` | **并发竞态**：两个消费线程/分区同时 insert 同一主键，数据库主键约束只让一个成功，另一个抛异常被忽略 | 单靠它也能保证正确，但每次重复都白跑一次 insert 并触发异常，开销大、日志脏；① 把绝大多数重复挡在前面 |

关键前提：**`messageId` 是生产端用 Snowflake 生成的主键，不是数据库自增**。所以同一条业务消息无论投递多少次，`messageId` 都一样，才能靠主键去重。如果是自增主键，重投递就会变成两条不同 ID 的"假新消息"，幂等无从谈起。

> 心智模型：① 是"快路径"（绝大多数重复在这里被廉价拦下），② 是"安全网"（极小概率的并发漏网由数据库唯一约束兜底）。两者合起来保证 `saveOfflineMessage` **总能正常返回**，offset 永远能提交，毒消息循环不会发生。

### 4.3 历史拉取：先定位会话，再按时间水位查消息

```java
// service/impl/MessageServiceImpl.java:77
public OfflineMsgResponse getOfflineMessage(OfflineMsgRequest request) {
    Set<Long> sessionIds = userSessionService.findSessionIdByUserId(request.getUserId());
    if (sessionIds.isEmpty()) {
        return offlineMsgResponse;   // 一个会话都没有，直接空返回
    }
    HashMap<Long, List<OfflineMsgDetail>> details =
            this.findOfflineMsgBySessionId(sessionIds, request.getTime());
    // ... 按 session 分组组装 ...
}
```

核心过滤条件在 `findOfflineMsgBySessionId`（`:116`），用 MyBatis-Plus-Join（MPJ）一次 join 三张表：

```java
// service/impl/MessageServiceImpl.java:122
MPJLambdaWrapper<Message> wrapper = new MPJLambdaWrapper<Message>()
        .selectAll(Message.class)
        .selectAll(RedPacket.class)
        .selectAll(User.class)
        .selectAssociation(RedPacket.class, Message::getRedPacket)
        .selectAssociation(User.class, Message::getUser)
        .in("t.session_id", sessionId)              // 我所在的全部会话
        .ge("t.created_at", dateTime)               // ★ 时间水位: 只要 >= time 的
        .leftJoin(RedPacket.class, RedPacket::getRedPacketId, Message::getContent)
        .leftJoin(User.class, User::getUserId, Message::getSenderId);
```

这里 `.ge("t.created_at", dateTime)` 就是**客户端水位（client high-water mark）** 的落地：客户端在请求里带上"我上次收到消息的时间点 `time`"，服务端只返回**这个时间之后**的消息。

### 4.4 红包消息的特殊封装

普通文本消息的 body 是 `OfflineMsgBody`；红包消息（`type == 5`，见 `ConfigEnum.MESSAGE_TYPE`）会换成带封面文案的子类：

```java
// service/impl/MessageServiceImpl.java:153
if (message.getType().equals(Integer.valueOf(ConfigEnum.MESSAGE_TYPE.getValue()))) {
    OfflineRedPacketMsgBody body =
            new OfflineRedPacketMsgBody(message.getRedPacket().getRedPacketWrapperText());
    BeanUtils.copyProperties(offlineMsgBody, body);
    offlineMsgDetail.setOfflineMsgBody(body);
}
```

这解释了为什么前面要 `leftJoin(RedPacket ...)`：红包消息的 `content` 存的是 `red_packet_id`，join 出红包记录才能拿到封面文案 `redPacketWrapperText`。

---

## 5. 数据落点（表 / topic / 字段）

**Kafka：**

| 项 | 值 | 来源 |
| --- | --- | --- |
| topic | `thousands_word_message` | `KafkaConstants.topic` |
| 消费组 | `thousands_word_message_all` | `KafkaConstants.consumerGroupId` / `application.yml` |
| `auto-offset-reset` | `earliest`（新消费组从最早消息开始消费） | `application.yml:46` |
| 序列化 | key/value 均 String | `application.yml` |

**MySQL（库 `InfiniteChat`）：**

| 表 | 在本章的角色 | 关键列 |
| --- | --- | --- |
| `message` | 历史消息主表，幂等落库的目标 | `message_id`(主键, Snowflake)、`sender_id`、`session_id`、`type`、`content`、`reply_id`、`session_type`、`created_at`（时间水位过滤列） |
| `user_session` | 用户 ↔ 会话关系，定位"我属于哪些会话" | `user_id`、`session_id` |
| `session` | 会话元信息（群名/类型） | `id`、`type`、`name` |
| `red_packet` | 红包封面文案 | `red_packet_id`、`red_packet_wrapper_text` |
| `user` | 发送人头像/昵称 | `user_id`、`user_name`、`avatar` |

> 注意：本章这条链路**不直接读写 Redis**。在线状态 `user:session:{userId}` 是 RTC 服务（第 4 章）维护的；离线存储服务只关心"消息有没有进 `message` 表"。

---

## 6. 失败与边界处理

| 场景 | 现在的行为 | 说明 |
| --- | --- | --- |
| 同一条消息被 Kafka 重投 | `selectById` 命中 → 跳过 → offset 照常提交 | 不会出现重复历史，也不会卡住消费 |
| 并发同时 insert 同主键 | 一条成功，另一条 `DuplicateKeyException` 被忽略 | 数据库唯一约束是最终裁判 |
| JSON 反序列化失败 / NPE | **会抛异常 → offset 不提交 → 反复重投（毒消息）** | 这是当前实现的**真实边界**：幂等只覆盖"主键冲突"，不覆盖"消息格式损坏"。生产上通常要补死信队列（DLQ）或 try-catch 兜底 |
| 拉历史时用户没有任何会话 | `sessionIds.isEmpty()` → 返回空 `OfflineMsgResponse` | 不会去 join 消息表 |
| 某会话在水位之后无新消息 | `messageMap.get(sessionId)` 为 null → 该 session 不加入结果 | 见 `MessageServiceImpl.java:104-110` |
| 请求 `userId` / `time` 为空 | `@Valid` 校验拦截（`OfflineMsgRequest` 上的 `@NotNull` / `@NotEmpty`） | 参数非法直接 400 |
| `time` 格式不是 `yyyy-MM-dd HH:mm:ss` | `LocalDateTime.parse` 抛异常 | 客户端必须按此格式传水位 |
| 拉别人的离线消息 | `UserContext` 校验不一致 → **403** | 见下方鉴权 |

**鉴权（与本套系统一致的 v1 模型）：**

请求经 GateWay（10010）验签后注入可信头 `X-User-Id`；服务内 `AuthContextInterceptor` 把它写入 `UserContext`（ThreadLocal）。控制器再校验"请求体里的 `userId` 必须等于可信用户 ID"：

```java
// controller/MessageController.java:28
Long currentUserId = UserContext.get();
if (currentUserId != null && !Objects.equals(currentUserId, request.getUserId())) {
    httpResponse.setStatus(403);
    return Result.UserError(403, "无权访问他人离线消息");
}
```

服务间调用（带 `X-Internal-Token`，默认 `infinite-chat-internal-dev-token`）则被 `AuthContextInterceptor` 直接放行，此时 `UserContext.get()` 为 null，跳过上面的本人校验。

---

## 7. 动手实践

### 7.1 验证"幂等落库"

**目标：让同一条消息被消费两次，确认 `message` 表只多一行。**

1. 先确认 topic 和消费组：
   ```bash
   kafka-topics.sh --bootstrap-server localhost:9092 --describe --topic thousands_word_message
   kafka-consumer-groups.sh --bootstrap-server localhost:9092 --describe --group thousands_word_message_all
   ```

2. 用控制台生产者**手动投两条一模一样**的消息（注意 `messageId` 必须相同，模拟重投）：
   ```bash
   kafka-console-producer.sh --bootstrap-server localhost:9092 --topic thousands_word_message
   > {"sendUserId":1001,"receiveUserId":1002,"sessionId":2001,"messageId":9000000000001,"type":1,"sessionType":1,"body":{"content":"hello idempotent","replyId":null}}
   > {"sendUserId":1001,"receiveUserId":1002,"sessionId":2001,"messageId":9000000000001,"type":1,"sessionType":1,"body":{"content":"hello idempotent","replyId":null}}
   ```

3. 看 `OfflineDataStoreService` 日志，第二条应打印：
   ```
   离线消息已存在，跳过重复消费, messageId=9000000000001
   ```

4. 查库确认只有一行：
   ```sql
   SELECT message_id, content, created_at FROM message WHERE message_id = 9000000000001;
   ```

> 真正的端到端做法是走第 3 章发一条聊天消息（让生产端走 Outbox），但手动投递能更直观地复现"重投递"这一关键场景。

### 7.2 验证"历史拉取（时间水位）"

```bash
# JWT 见第 1 章登录拿到；userId 必须是 JWT 对应的本人
curl -G 'http://localhost:10010/api/v1/offline/message' \
  -H 'Authorization: Bearer <你的JWT>' \
  --data-urlencode 'userId=1002' \
  --data-urlencode 'time=2026-06-26 00:00:00'
```

- 把 `time` 调到**更早**，应看到更多历史；调到**更晚**（如此刻之后），应返回空 `offlineMsg`。这直接验证了 `.ge("created_at", time)` 这条水位过滤。
- 把 `userId` 改成**别人的 ID**（但 JWT 还是你自己的），应返回 **403 无权访问他人离线消息**——验证 `UserContext` 本人校验。

返回结构（`Result<OfflineMsgResponse>`）：

```json
{
  "code": 200, "msg": "success",
  "data": {
    "offlineMsg": [
      { "sessionId": "2001", "sessionType": 1, "total": 1,
        "offlineMsgDetails": [
          { "messageId": "9000000000001", "sendUserId": "1001",
            "type": 1, "userName": "Alice", "avatar": "...",
            "offlineMsgBody": { "content": "hello idempotent",
                                "createdAt": "2026-06-26 10:00:00", "replyId": null } }
        ] }
    ]
  }
}
```

---

## 8. 小结 + 下一步

**本章要点回顾：**

- 发送（第 3 章）与历史存储（本章）**解耦**：发送方只投 Kafka，存储服务订阅 `thousands_word_message` 单独落库。
- Kafka 是 at-least-once，生产端 Outbox 还会**定时重投**，所以消费者**必须幂等**。
- 幂等用**两道防线**：`selectById` 快路径挡顺序重投 + `DuplicateKeyException` 安全网兜并发竞态；目标是让 `saveOfflineMessage` 永远正常返回、offset 永远前进，**杜绝毒消息循环**。前提是 `messageId` 为生产端 Snowflake 主键。
- 历史拉取靠**客户端时间水位** `time`：客户端报告"我看到哪儿了"，服务端用 `created_at >= time` 补差，并一次 MPJ join 出消息+红包+发送人。
- 这条链路不碰 Redis，只读写 MySQL（`message` / `user_session` / `session` / `red_packet` / `user`）。

**关键取舍提醒（客户端水位的代价）：** 水位是"按时间"而非"按消息 offset"，实现简单、跨设备直观，但有两个隐患——① 客户端钟与服务端钟若不一致，水位会偏；② 同一时间点（秒级）多条消息可能在边界上被重复拉或漏拉。更稳的做法是用"最后已读 `messageId`"或服务端游标，但当前实现选择了更轻量的时间水位。

**下一步读哪篇：**

- 回头看 **第 3 章 发送链**：理解 `MessageOutbox` 为什么先落库再投 Kafka（本地事务 + 投递的一致性），以及消息是怎么被组装成 `thousands_word_message` 的 payload 的——那正是本章 `TextMessage` 反序列化的"另一端"。
- 看 **第 4 章 实时通信 / 在线状态**：在线用户走 WebSocket 实时收，离线用户才靠本章重连补历史；两条路径合起来才是完整的"消息必达"。
