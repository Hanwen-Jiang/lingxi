# 第 4 章 实时推送与在线状态

> 本章主题:**一条消息要怎么从服务端"实时"地推到正确的那一台 Netty 节点上、再可靠地送进用户的浏览器,以及系统怎么知道"谁在线、在哪台机器上"。**

学完你能回答这些问题:

- WebSocket 长连接是怎么在 Netty(端口 9000)上建立的?握手时怎么鉴权?
- 服务端如何知道"用户 A 的连接在哪个 `Channel` 上"?这个映射存在哪里?
- 在线状态(presence)是怎么记录的?为什么要写进 Redis 而不是只放内存?为什么有 15 分钟 TTL?
- 推送一条消息,服务端怎么保证"至少送达一次"(at-least-once)?ACK 和重传是怎么工作的?
- 心跳(HEARTBEAT)、主动登出(LOGOUT)、客户端确认(ACK)这三种上行消息分别做了什么?
- 集群里有**两套地址来源**——网关的"一致性哈希环"和 Redis 里的"路由表",它们各自解决什么问题、如何配合?

---

## 1. 一张图先看懂全局

整个实时链路有两个方向:**用户上行(建连/心跳/ACK)** 和 **业务下行(把消息推给用户)**。下面这张时序图把两个方向和"两套地址来源"画在一起。

```
                         ┌──────────────────────────────────────────────┐
                         │   集群里有 N 个 RTC 节点,每个都跑着:          │
                         │   - HTTP 8083 (被业务服务内部调用)            │
                         │   - Netty WS 9000 (注册名 NettyService)       │
                         └──────────────────────────────────────────────┘

【上行:用户 A 建立长连接】
  浏览器 A                GateWay(10010)            一致性哈希环          RTC 节点 #2 (Netty 9000)
    │  ws 连 /api/v1/netty   │                          │                        │
    │  带 header: userUuid,token                        │                        │
    ├───────────────────────►│  lb://NettyService       │                        │
    │                        ├─ 用验签后的 JWT subject ─►│ hash(subject)→ #2      │
    │                        │  选中节点 #2,转发握手     │                        │
    │                        ├──────────────────────────┼───────────────────────►│
    │                        │                          │   WebSocketTokenAuthen  │
    │                        │                          │   读 header→channel attr│
    │                        │                          │   HandshakeComplete:    │
    │                        │                          │   validateToken(JWT)    │
    │                        │                          │   ChannelManager 存映射  │
    │◄───────────────────────┼──────────────────────────┼──── 101 Switching ──────┤
    │                        │                          │   Redis SET              │
    │                        │                          │   user:session:A = ip:8083 (TTL 15m)
    │                        │                          │                        │
    │  每隔 N 秒发 HEARTBEAT ─┼──────────────────────────┼───────────────────────►│ refreshRouteTtl → EXPIRE 15m
    │◄── 回 HEARTBEAT ────────┼──────────────────────────┼────────────────────────┤

【下行:用户 B 给 A 发消息,Messaging 要把它实时推给 A】
  MessagingService                    Redis 路由表             RTC 节点 #2 (HTTP 8083)
    │  groupUsersByRoute([A])           │                        │
    ├─ GET user:session:A ─────────────►│ → "ip2:8083"           │
    │◄── ip2:8083 ──────────────────────┤                        │
    │  POST http://ip2:8083/api/v1/message/user  (带 X-Internal-Token)
    ├──────────────────────────────────┼───────────────────────►│ NettyMessageService.sendMessageToUser
    │                                   │                        │   ChannelManager.getChannelByUserId(A)
    │                                   │                        │   channel.writeAndFlush(frame)
    │                                   │                        │   addPending(ackId) ── 等 ACK
    │                                   │                        │         │
    │                                   │       浏览器 A ◄────────┤ 推送帧 │
    │                                   │       浏览器 A ── ACK ─►│ ack(ackId) 移除待确认
```

两个关键点先记住,后面会逐一展开:

1. **网关一致性哈希环** 负责"建连时把同一个用户黏到同一台 Netty 节点";**Redis 路由表** 负责"业务服务下行时找到用户当前黏在哪台节点"。它们是同一件事(用户↔节点的绑定)在**两个不同环节**的两种表达。
2. **在线表有两层**:节点内存里的 `ChannelManager`(userId ↔ Channel,真正能 `writeAndFlush` 的对象),以及 Redis 里的 `user:session:{userId}`(跨节点可见的"用户在哪台机器")。

---

## 2. 关键类与职责

| 类 / 文件 | 职责 |
| --- | --- |
| `RealTimeCommunicationService/.../websocket/NettyServer.java` | 启动 Netty WS 服务器(9000),装配 pipeline,并把 `NettyService` 注册到 Nacos |
| `.../websocket/WebSocketTokenAuthenHeader.java` | 握手前的 HTTP 阶段拦截器:把 `userUuid` / `token` 请求头读出来,存进 channel 的 attribute,然后把自己从 pipeline 摘除 |
| `.../websocket/MessageInboundHandler.java` | 长连接核心 handler:处理握手完成事件(鉴权+写在线表)、上行 ACK/LOGOUT/HEARTBEAT、空闲超时、断开下线 |
| `.../websocket/ChannelManager.java` | 节点内存在线表:`userId → Channel` 与 `Channel → userId` 双向映射(`ConcurrentHashMap`) |
| `.../websocket/AckMessageManager.java` | "至少一次"投递的待确认表 + 定时扫描重传(超时阈值、最大次数) |
| `.../websocket/NettyUtils.java` | channel attribute 工具(`TOKEN`、`UID` 两个 `AttributeKey`) |
| `.../service/impl/NettyMessageService.java` | 下行推送的统一入口:封装 `MessageDTO`、查 `ChannelManager`、发帧、登记待 ACK |
| `.../controller/PushController.java` / `RcvMsgController.java` | 内部 HTTP 接口 `/api/v1/message/**`,被 Messaging/Contact/Moment 直接调用 |
| `.../config/AuthContextInterceptor.java` | 给 `/api/v1/message/**` 做内部令牌(`X-Internal-Token`)校验 |
| `.../constants/MessageTypeEnum.java` | **上行**消息类型:ACK(1)、LOG_OUT(2)、HEART_BEAT(5)、ILLEGAL(99) |
| `.../constants/PushTypeEnum.java` | **下行**推送类型:新会话(1)、消息(2)、朋友圈(3)、好友申请(4)、新群会话(5) |
| `GateWay/.../gatewaylb/NettyConsistentHashLoadBalancer.java` | 网关侧自定义负载均衡:按用户把 WS 连接路由到固定 Netty 节点 |
| `GateWay/.../gatewaylb/ConsistentHashRing.java` | 一致性哈希环(MD5 + 160 个虚拟节点) |
| `MessagingService/.../route/RealtimeRouteService.java` | 下行侧:读 Redis 路由表,把一批接收者按"在哪台节点"分组 |

---

## 3. 建连与握手鉴权:WebSocket 是怎么"立"起来的

### 3.1 要解决什么问题

HTTP 是一问一答的请求/响应,服务端没法主动给浏览器推数据。即时通讯需要"服务端随时能推",所以用 **WebSocket** ——它先用一个 HTTP 请求做"协议升级握手",成功后这条 TCP 连接就升级成全双工的长连接,双方都能随时发帧。

但长连接一旦建立就持续占用资源,而且谁都能连。所以我们必须在**握手阶段**完成鉴权:只有带着合法 JWT 的连接才允许升级,非法的直接关掉。

### 3.2 pipeline 是怎么装配的

Netty 用一条 **pipeline(处理器链)** 来逐层处理字节流。`NettyServer` 里装配了这几个 handler(顺序很重要):

```java
// NettyServer.java:88-95
pipeline.addLast(new IdleStateHandler(5 * 60, 0, 0));          // 读空闲 5 分钟 → 触发超时事件
pipeline.addLast(new HttpServerCodec());                       // HTTP 编解码(握手阶段是 HTTP)
pipeline.addLast(new ChunkedWriteHandler());
pipeline.addLast(new HttpObjectAggregator(8192));              // 把 HTTP 分片聚合成完整请求
pipeline.addLast(new WebSocketTokenAuthenHeader());            // 读握手请求头里的 userUuid/token
pipeline.addLast(new WebSocketServerProtocolHandler("/api/v1/netty")); // Netty 自带的 WS 升级处理器
pipeline.addLast(new MessageInboundHandler(redisTemplate, ackMessageManager, serverPort)); // 业务核心
```

理解顺序的关键:握手时这条连接上跑的还是 **HTTP**,所以前面要有 HTTP 编解码器;`WebSocketTokenAuthenHeader` 趁这个时候把鉴权用的请求头捞出来;等 `WebSocketServerProtocolHandler` 完成协议升级后,后续帧才会进入 `MessageInboundHandler`。

### 3.3 第一步:握手请求头落到 channel 上

客户端连 `ws://.../api/v1/netty` 时,在 HTTP 握手请求里带两个自定义头 `userUuid` 和 `token`。`WebSocketTokenAuthenHeader` 在协议升级**之前**把它们读出来,存进这条 channel 的 attribute,然后把自己从 pipeline 里摘掉(因为只需要在握手时跑一次):

```java
// WebSocketTokenAuthenHeader.java:25-35
if (msg instanceof FullHttpRequest) {
    FullHttpRequest request = (FullHttpRequest) msg;
    String userUuid = Optional.ofNullable(request.headers().get("userUuid")).map(...).orElse("");
    String token    = Optional.ofNullable(request.headers().get("token")).map(...).orElse("");
    NettyUtils.setAttr(ctx.channel(), NettyUtils.TOKEN, token);   // 存进 channel 属性
    NettyUtils.setAttr(ctx.channel(), NettyUtils.UID, userUuid);
    ctx.pipeline().remove(this);          // 用完即走
    ctx.fireChannelRead(request);         // 把请求继续往后传给 WS 升级处理器
}
```

> 为什么用 channel attribute?因为此刻还没真正"认识"这个用户,只是先把声称的身份暂存在连接上,等握手真正完成后再验证。attribute 是 Netty 给每条连接挂的"便利贴"。

### 3.4 第二步:握手完成时才真正鉴权 + 落在线表

协议升级成功后,`WebSocketServerProtocolHandler` 会抛出一个 `HandshakeComplete` 事件,`MessageInboundHandler.userEventTriggered` 捕获它,这才是鉴权和"上线"的真正时刻:

```java
// MessageInboundHandler.java:135-164
if (evt instanceof WebSocketServerProtocolHandler.HandshakeComplete) {
    String token   = NettyUtils.getAttr(ctx.channel(), NettyUtils.TOKEN);
    String userUuid = NettyUtils.getAttr(ctx.channel(), NettyUtils.UID);

    if (!validateToken(userUuid, token)) {   // ① 验签,且 subject 必须等于声称的 userUuid
        log.info("token invalid");
        ctx.close();                          // 不合法直接关连接
        return;
    }

    // ② 写 Redis 在线路由:user:session:{userId} = "本机IP:8083",TTL 15 分钟
    String currentRoute = InetAddress.getLocalHost().getHostAddress() + ":" + serverPort;
    redisTemplate.opsForValue().set(UserConstants.USER_SESSION + userUuid, currentRoute,
                                    ROUTE_TTL_MINUTES, TimeUnit.MINUTES);  // ROUTE_TTL_MINUTES = 15

    // ③ 同一用户旧连接顶号:先关旧 channel,再登记新 channel
    Channel channel = ChannelManager.getChannelByUserId(userUuid);
    if (channel != null) {
        ChannelManager.removeUserChannel(userUuid);
        ChannelManager.removeChannelUser(channel);
        channel.close();
    }
    ChannelManager.addUserChannel(userUuid, ctx.channel());
    ChannelManager.addChannelUser(userUuid, ctx.channel());
}
```

`validateToken` 做了一件很重要的事——**不只验签,还要求 JWT 里的 `subject` 等于客户端声称的 `userUuid`**,防止"拿 A 的 token 冒充 B 上线":

```java
// MessageInboundHandler.java:200-205
private boolean validateToken(String userUuid, String token) {
    Claims claims = JwtUtil.parse(token);
    String userId = claims.getSubject();
    return userId != null && userId.equals(userUuid);  // 身份必须自洽
}
```

> 注意端口细节:写进 Redis 的路由是 `ip:serverPort`(**HTTP 8083**,不是 Netty 9000)。因为这条路由是给**业务服务做 HTTP 内部调用**用的目标地址,不是给浏览器连 WS 用的。这点是理解"两套地址"的关键,见第 7 节。

---

## 4. 在线表的两层结构:ChannelManager(内存) vs Redis

| | `ChannelManager` | Redis `user:session:{userId}` |
| --- | --- | --- |
| 存什么 | `userId ↔ Channel` 对象 | `userId → "ip:8083"` 字符串 |
| 可见范围 | **仅本节点**(内存) | **全集群**(共享 Redis) |
| 作用 | 真正能 `writeAndFlush` 发帧的句柄 | 让别的服务知道"这个用户当前黏在哪台机器" |
| 生命周期 | 连接存活期间 | 写入即 15 分钟 TTL,靠心跳续期 |
| 谁来读 | 本节点的 `NettyMessageService` / `AckMessageManager` | Messaging/Contact 等下行服务 |

为什么要两层?因为 `Channel` 是个**进程内的 Java 对象**,根本没法序列化跨网络传递。别的服务不可能直接拿到"A 的 channel",它们只能先问 Redis "A 在哪台机器",再用 HTTP 调过去,让那台机器在**自己内存**里找到 A 的 channel 来发帧。

`ChannelManager` 的实现很朴素——两个 `ConcurrentHashMap` 做双向索引:

```java
// ChannelManager.java:16-18
private static final ConcurrentHashMap<String, Channel> USER_CHANNEL_MAP = new ConcurrentHashMap<>();
private static final ConcurrentHashMap<Channel, String> CHANNEL_USER_MAP = new ConcurrentHashMap<>();
```

- `USER_CHANNEL_MAP`:推送时用——"给 A 发消息,A 的 channel 是哪个"。
- `CHANNEL_USER_MAP`:断连时用——"这条 channel 断了,它对应哪个用户"(下线清理要靠它反查 userId)。

---

## 5. 下行推送 + "至少一次"投递

### 5.1 入口:NettyMessageService.sendPush

所有下行推送都汇到 `sendPush(pushType, data, receiveUserUuid)`。它的流程是"封装 → 查内存在线表 → 发帧 → 发成功后登记待 ACK":

```java
// NettyMessageService.java:42-80(节选)
MessageDTO messageDTO = new MessageDTO();
String ackId = buildAckId(pushType, data, receiveUserUuid);          // 业务幂等 id
messageDTO.setType(pushType.getCode()).setMsgUuid(ackId).setData(data);

Channel channel = ChannelManager.getChannelByUserId(receiveUserUuid);
if (channel != null && channel.isActive()) {                          // 本节点内存里真有这条活连接
    String frameText = JSONUtil.toJsonStr(messageDTO);
    channel.writeAndFlush(new TextWebSocketFrame(frameText)).addListener(future -> {
        if (future.isSuccess()) {
            ackMessageManager.addPending(new PendingAckMessage()       // 发成功 → 进待确认表
                .setAckId(ackId).setReceiveUserId(receiveUserUuid)
                .setFrameText(frameText).setRetryCount(0)
                .setLastSendTime(System.currentTimeMillis()));
        }
    });
}
```

`ackId` 的构造保证了**可重传时帧内容一致、且业务可去重**:

```java
// NettyMessageService.java:83-92
// 形如:  pushType:receiveUserUuid:businessId
// 文本/图片/红包等消息用真实 messageId 当 businessId;没有就生成 UUID 兜底
return pushType.getCode() + ":" + receiveUserUuid + ":" + businessId;
```

> 一个边界细节:`sendMessageToUser` 在群发文本/图片/红包时,会先把 `receiveUserIds` 字段**置空再发给前端**(`textMessage.setReceiveUserIds(null)`),避免把"这条消息的全部接收人名单"泄露给每个收件人。

### 5.2 为什么需要 ACK + 重传:解决"消息丢了怎么办"

`writeAndFlush` 成功只代表"帧写进了 TCP 发送缓冲区",**不代表浏览器真的收到并处理了**。网络抖动、客户端崩溃、TCP 缓冲区里的数据还没发出去连接就断了……都会丢消息。

所以这里用了 IM 里经典的 **"应用层 ACK + 超时重传"**,目标是 **at-least-once(至少送达一次)**:

1. 服务端发帧后,把它登记进 `pendingAckMap`(key 是 `ackId`)。
2. 客户端处理完这条消息,回一个 `type=1`(ACK) 的上行帧,带上 `msgUuid`。
3. 服务端收到 ACK,从 `pendingAckMap` 移除 → 这条算"确认送达"。
4. 一个定时任务每 5 秒扫一遍:超时还没被 ACK 的,重发;超过最大次数还没确认的,放弃。

```java
// AckMessageManager.java:51-86(节选)
@Scheduled(fixedDelayString = "${ack.retry.scan-interval-ms:5000}")
public void retryTimeoutMessages() {
    long now = System.currentTimeMillis();
    for (PendingAckMessage pending : pendingAckMap.values()) {
        if (now - pending.getLastSendTime() < ackTimeoutMs) continue;       // 还没到超时阈值(默认 5s)

        if (pending.getRetryCount() >= maxRetryCount) {                     // 重试到顶(默认 3 次)
            pendingAckMap.remove(pending.getAckId());                       // 放弃,等离线消息兜底
            continue;
        }
        Channel channel = ChannelManager.getChannelByUserId(pending.getReceiveUserId());
        if (channel == null || !channel.isActive()) {                       // 用户掉线了
            pending.setRetryCount(pending.getRetryCount() + 1);
            pending.setLastSendTime(now);                                   // 不发,但计数+1,保留待确认
            continue;
        }
        pending.setRetryCount(pending.getRetryCount() + 1);
        pending.setLastSendTime(now);
        channel.writeAndFlush(new TextWebSocketFrame(pending.getFrameText())); // 原样重投
    }
}
```

收到 ACK 时的移除逻辑在 `MessageInboundHandler.processACK`,并兼容两种格式(`msgUuid` 直接给,或包在 `data` 里的 `AckData`):

```java
// MessageInboundHandler.java:66-75
String ackId = msg.getMsgUuid();
if (ackId == null && msg.getData() != null) {
    AckData ackData = JSONUtil.toBean(msg.getData().toString(), AckData.class);
    ackId = ackData.getMsgUuid();
}
boolean acked = ackMessageManager.ack(ackId);   // pendingAckMap.remove(ackId) != null
```

> **at-least-once 的代价是"可能重复"**:如果客户端收到了消息、ACK 在回程中丢了,服务端会重发,客户端就会收到第二遍。所以 `ackId` 里带了业务 `messageId`,客户端要**按它去重**。这是有意的取舍:宁可重复,不可丢失。

### 5.3 重传的边界设计要点

| 情况 | 行为 | 设计意图 |
| --- | --- | --- |
| 用户在线、超时未 ACK | 原样重发,`retryCount++` | 对抗偶发丢帧 |
| 用户已掉线(channel 不活跃) | **不发**,但 `retryCount++` 并刷新时间 | 不浪费,但也不无限留存——次数照样会耗尽 |
| 超过 `max-count`(默认 3) | 从 `pendingAckMap` 移除,记 warn 日志 | 放弃实时投递,交给"离线消息"机制兜底(见第 5/6 章) |
| 用户主动登出 | `removeByUserId` 批量清掉他的全部待确认 | 人都走了,没必要再重传 |

参数都来自 `application.yml`,可热调:

```yaml
# RealTimeCommunicationService/src/main/resources/application.yml:20-24
ack:
  retry:
    timeout-ms: 5000        # 多久没 ACK 算超时
    scan-interval-ms: 5000  # 扫描重传的间隔
    max-count: 3            # 最大重传次数
```

---

## 6. 三种上行消息:ACK / LOGOUT / HEARTBEAT

客户端发上来的帧,统一进 `MessageInboundHandler.channelRead0`,按 `MessageTypeEnum` 分发:

```java
// MessageInboundHandler.java:50-63
MessageTypeEnum messageType = MessageTypeEnum.of(messageDTO.getType());
switch (messageType) {
    case ACK:        processACK(messageDTO);          break;  // type=1
    case LOG_OUT:    processLogOut(ctx, messageDTO);  break;  // type=2
    case HEART_BEAT: processHeartBeat(ctx, messageDTO); break; // type=5
    default:         processIllegal(messageDTO);              // 其它 → 抛 MessageTypeException
}
```

### 6.1 HEARTBEAT(type=5):保活 + 续期在线状态

心跳有两个作用。其一是**保活**:`IdleStateHandler(5*60, 0, 0)` 设了 5 分钟读空闲,5 分钟没收到任何帧就触发 `READER_IDLE`,服务端主动下线这条连接。所以客户端必须周期性发心跳,否则会被判死。其二是**给 Redis 在线状态续期**:

```java
// MessageInboundHandler.java:89-96 + 168-176
private void processHeartBeat(ChannelHandlerContext ctx, MessageDTO msg) {
    refreshRouteTtl(ctx);                                  // EXPIRE user:session:{uid} 15m
    // 原样回一个 HEART_BEAT 帧,客户端据此判断"服务端还活着"
    ctx.channel().writeAndFlush(new TextWebSocketFrame(JSONUtil.toJsonStr(heartBeatDto)));
}
private void refreshRouteTtl(ChannelHandlerContext ctx) {
    String userUuid = ChannelManager.getUserByChannel(ctx.channel());     // 先从内存反查
    if (userUuid == null) userUuid = NettyUtils.getAttr(ctx.channel(), NettyUtils.UID); // 兜底用握手 attr
    if (userUuid != null) redisTemplate.expire(UserConstants.USER_SESSION + userUuid, 15, MINUTES);
}
```

> **为什么 Redis key 要带 TTL + 靠心跳续期?** 因为节点可能宕机、进程可能被 kill,这时 `channelInactive`/`offline` 不一定有机会执行,Redis 里就会残留"假在线"的脏路由。给 15 分钟 TTL,即使没人清理,过期后也会自动消失;只要连接还活着,心跳就会不断把它续到 15 分钟之后。这是一种"自愈"设计:宁可让脏数据自然过期,也不依赖"一定能优雅关闭"。

### 6.2 LOGOUT(type=2):主动登出

```java
// MessageInboundHandler.java:78-87
LogOutData logOutData = JSONUtil.toBean(msg.getData().toString(), LogOutData.class);
Integer userUuid = logOutData.getUserUuid();
int removed = ackMessageManager.removeByUserId(userUuid == null ? null : userUuid.toString()); // 清待 ACK
offline(ctx);  // 下线:清内存映射 + 关 channel + 删 Redis key
```

### 6.3 ACK(type=1):确认送达

见 5.2,本质就是 `pendingAckMap.remove(ackId)`。

### 6.4 下线的收尾:offline()

无论是主动登出、读空闲超时、`channelInactive`(TCP 断开)还是 `exceptionCaught`,最终都走同一个 `offline`:

```java
// MessageInboundHandler.java:179-198(节选)
String userUuid = ChannelManager.getUserByChannel(ctx.channel());   // 用 channel 反查 userId
ChannelManager.removeChannelUser(ctx.channel());
if (userUuid != null) ChannelManager.removeUserChannel(userUuid);   // 清两张内存表
...
ctx.channel().close();                                              // 关连接
redisTemplate.opsForValue().getAndDelete(UserConstants.USER_SESSION + userUuid); // 删 Redis 路由
```

> 注意 `offline` 必须靠 `CHANNEL_USER_MAP` 反查 userId——因为触发下线的事件(比如 TCP RST)只给得到 `Channel`,拿不到 userId。这正是 `ChannelManager` 要维护**双向**映射的原因。

---

## 7. 两套地址来源:一致性哈希环 vs Redis 路由表

这是本章最容易绕晕、也最值得弄懂的地方。集群里有多台 RTC 节点,"用户 A 到底和哪台节点打交道"这件事,在**两个环节**各被回答了一次:

### 7.1 建连环节 —— 网关的一致性哈希环(把用户黏到固定节点)

浏览器连 WS 时走网关路由 `/api/v1/netty → lb:ws://NettyService`。如果网关随便选一台节点,会出大问题:WebSocket 是**有状态长连接**,A 的 channel 只存在于它连上的那一台节点的内存里。如果同一个 A 重连时被分到了另一台,旧连接和新连接就散在不同机器,顶号、推送都会乱。

所以网关用了**自定义负载均衡** `NettyConsistentHashLoadBalancer`:用"用户标识"做 key,在一致性哈希环上选节点,保证**同一个用户总是落到同一台 Netty 节点**。

路由 key 的选取(`extractRouteKey`)有明确的安全考量——**优先用验签后的 JWT subject,而不是客户端自报的 `userUuid` 头**:

```java
// NettyConsistentHashLoadBalancer.java:93-107(节选)
String token = headers.getFirst("token");
if (token == null || token.isEmpty()) token = headers.getFirst(HttpHeaders.AUTHORIZATION);
String subject = GatewayJwtUtil.parseSubject(token);
if (subject != null && !subject.isEmpty()) return subject;   // ① 首选:验签后的 subject
String userUuid = headers.getFirst("userUuid");
if (userUuid != null && !userUuid.isEmpty()) return userUuid; // ② 退化:无令牌客户端才用自报头
return null;                                                  // ③ 都没有 → 退化为随机节点
```

> 为什么不能直接信 `userUuid` 头?因为那是客户端自己填的,可以伪造。如果用它当哈希 key,攻击者就能**主动把自己黏到和受害者同一台节点**上,做针对性攻击。用验签后的 subject,key 就锁死在"令牌证明的真实身份"上。

哈希环本身(`ConsistentHashRing`)用 MD5 + 每个物理节点 160 个虚拟节点,保证节点增减时只有少量用户被重新分配:

```java
// ConsistentHashRing.java:28-44(节选)
public T get(String key) {
    long hash = hash(key);
    Map.Entry<Long, T> entry = ring.ceilingEntry(hash);   // 顺时针找第一个节点
    if (entry == null) entry = ring.firstEntry();         // 环回绕
    return entry.getValue();
}
// 每个节点放 160 个虚拟节点,均衡分布,减少"加/减一台机器导致大面积重新黏连"
```

> 这里的 MD5 只是哈希环里**取散列值**用,和"密码"无关——密码早已改用 BCrypt。两者不要混淆。

### 7.2 下行环节 —— Redis 路由表(找到用户当前在哪台节点)

业务服务(Messaging/Contact/Moment)要把消息推给 A 时,它**不经过网关、也不连 WS**,而是直接发 HTTP 内部调用到 A 所在节点的 8083 端口。它怎么知道 8083 在哪台机器?查 Redis 路由表。

Messaging 侧的 `RealtimeRouteService` 把一批接收者按"在哪台节点"分组,**离线的直接跳过**:

```java
// MessagingService/.../route/RealtimeRouteService.java:30-45(节选)
for (Long userId : userIds) {
    String route = getActualRoute(userId);            // GET user:session:{userId} → "ip:8083"
    if (route == null || route.trim().isEmpty()) {
        log.info("用户{}无Redis在线路由,判定为离线,不进行实时推送", userId);
        continue;                                     // 离线 → 不推,交给离线消息存储
    }
    routeMap.computeIfAbsent(normalizeRoute(route), k -> new ArrayList<>()).add(userId);
}
```

分组后,Messaging 对每个 `ip:8083` 发一次 `POST http://ip:8083/api/v1/message/user`(带 `X-Internal-Token`),落到那台节点的 `RcvMsgController` → `NettyMessageService.sendMessageToUser`,在**那台节点的内存**里找到 A 的 channel 发帧。

### 7.3 两者如何配合:一条线串起来

```
建连时:                        网关一致性哈希环  hash(subject=A) ──► 选定节点 #2
                                                    │
                               #2 在 HandshakeComplete 里:
                               写 Redis  user:session:A = "ip2:8083"  ◄── 把"选定结果"落到全集群可见的路由表
                                                    │
下行时:    Messaging  GET user:session:A ──► "ip2:8083" ──► POST 到 #2 ──► #2 内存里发帧给 A
```

- **一致性哈希环**是"**怎么选**节点"的算法,只在网关、只在建连时起作用,结果是 A 永远黏 #2。
- **Redis 路由表**是"**选的结果存哪**",让任何服务在任何时候都能查到"A 现在在 #2 的 8083"。
- 两者必须一致才不会出错:正因为哈希环保证 A 总黏 #2,Redis 里写的也总是 #2,下行时查到 #2、推到 #2,A 的 channel 确实就在 #2 上——闭环成立。

| 维度 | 一致性哈希环 | Redis 路由表 `user:session:{userId}` |
| --- | --- | --- |
| 在哪 | 网关 `gatewaylb` | 共享 Redis |
| 何时用 | 浏览器**建连**时选 Netty 节点 | 业务服务**下行推送**时找目标节点 |
| key | 验签 JWT subject(退化 userUuid) | userId |
| 值 | 选中的 `ServiceInstance`(WS 9000) | `"ip:8083"`(HTTP) |
| 协议 | `lb:ws://NettyService` | HTTP `/api/v1/message/**` |
| 谁写谁读 | 网关算、网关用 | RTC 握手时写,Messaging/Contact 读 |

---

## 8. 内部接口的鉴权:为什么 `/api/v1/message/**` 只验内部令牌

下行 HTTP 接口 `/api/v1/message/**` 是**纯服务间调用**,不该被外部用户直接打。它的鉴权和"用户态"接口不同——不要求 `X-User-Id`,只校验 `X-Internal-Token`:

```java
// AuthContextInterceptor.java:22-28
String token = request.getHeader("X-Internal-Token");
if (token != null && token.equals(internalToken)) {   // 默认 infinite-chat-internal-dev-token
    return true;
}
return unauthorized(response);   // 否则 401 {"code":40101,...}
```

拦截器**只挂在 `/api/v1/message/**`**(见 `AuthWebMvcConfig`),而 Netty WS 握手鉴权是另一条独立路径(第 3 节),不受这个 MVC 拦截器影响——两者职责分明。

---

## 9. 数据落点速查

| 类型 | 标识 | 写入方 / 读取方 | 说明 |
| --- | --- | --- | --- |
| Redis key | `user:session:{userId}` = `"ip:8083"` | RTC 握手写、心跳续期、断开删;Messaging/Contact 读 | 在线路由表,TTL 15 分钟 |
| 内存表 | `ChannelManager` 双向 Map | RTC 节点本进程 | userId ↔ Channel,仅本节点可见 |
| 内存表 | `AckMessageManager.pendingAckMap` | RTC 节点本进程 | 待 ACK 的消息,key=`ackId` |
| HTTP 端口 | `8083` | 业务服务 → RTC 内部调用目标 | `/api/v1/message/**` |
| Netty WS 端口 | `9000`,Nacos 名 `NettyService` | 浏览器经网关 `lb:ws://NettyService` 建连 | 长连接 |
| 上行帧类型 | `MessageTypeEnum`:1 ACK / 2 LOG_OUT / 5 HEART_BEAT / 99 ILLEGAL | 客户端 → 服务端 | `channelRead0` 分发 |
| 下行帧类型 | `PushTypeEnum`:1 新会话 / 2 消息 / 3 朋友圈 / 4 好友申请 / 5 新群会话 | 服务端 → 客户端 | `MessageDTO.type` |
| 帧结构 | `MessageDTO = {type, msgUuid, data}` | 双向 | `msgUuid` 即 `ackId` |

> Kafka topic `thousands_word_message`、消息持久化/离线存储等不在本章 RTC 范围内,见消息链路与离线存储章节。

---

## 10. 失败与边界处理一览

| 场景 | 系统行为 |
| --- | --- |
| 握手时 token 非法 / subject≠userUuid | `validateToken` 返回 false,`ctx.close()` 直接关连接 |
| 同一用户重复登录 | 握手时先关旧 channel、清旧映射,再登记新 channel(顶号) |
| 5 分钟没收到任何帧(含心跳) | `READER_IDLE` 触发 → `offline()` 主动下线 |
| TCP 异常断开 / handler 抛异常 | `channelInactive` / `exceptionCaught` → `offline()` 兜底清理 |
| 推送时用户不在本节点内存 | `ChannelManager.getChannelByUserId` 返回 null,`sendPush` 直接跳过(不发) |
| 推送时用户离线(Redis 无路由) | Messaging 侧 `groupUsersByRoute` 跳过该用户,转走离线存储 |
| 帧发出去但客户端没 ACK | 定时任务超时重传,最多 `max-count`(3) 次,之后放弃 |
| ACK 重传时用户已掉线 | 不发,但仍 `retryCount++`,次数耗尽即放弃 |
| 节点宕机来不及清理 Redis | 路由 key 15 分钟 TTL 自动过期,避免永久"假在线" |
| 上行帧类型非法 | 抛 `MessageTypeException`(由全局异常处理) |
| 内部接口缺/错 `X-Internal-Token` | 401,`{"code":40101,"msg":"未认证或非法请求来源"}` |

---

## 11. 动手实践

> 前置:Nacos(8848)、Redis(6379)、网关(10010)、RTC(HTTP 8083 / WS 9000)均已启动,并已通过 `/api/v1/user/login` 拿到一个 JWT(假设是用户 `1001`,token 记为 `$JWT`)。

### 11.1 用 wscat 建立长连接并观察上线

```bash
# 经网关连 WS;一致性哈希环会按验签 subject 把你黏到某台 Netty 节点
wscat -c "ws://localhost:10010/api/v1/netty" \
      -H "userUuid: 1001" \
      -H "token: $JWT"
```

连上后,**验证在线路由已写入 Redis**(注意值是 `ip:8083`,HTTP 端口):

```bash
redis-cli GET "user:session:1001"        # 期望:形如 192.168.x.x:8083
redis-cli TTL "user:session:1001"        # 期望:接近 900(15 分钟),且随心跳刷新
```

### 11.2 发心跳,看 TTL 被续期

在 wscat 会话里粘贴(type=5 是 HEART_BEAT):

```json
{"type":5}
```

你会收到服务端原样回的 `{"type":5}`;此时再 `redis-cli TTL user:session:1001`,TTL 应被重置回接近 900。**不发心跳等 5 分钟**,连接会被服务端以 `READER_IDLE` 主动断开,Redis key 也会被删除。

### 11.3 触发一次下行推送,观察 ACK 重传

让另一台业务服务推一条,或直接模拟内部调用(带内部令牌):

```bash
curl -X POST "http://localhost:8083/api/v1/message/push/friendApplication/1001" \
     -H "X-Internal-Token: infinite-chat-internal-dev-token" \
     -H "Content-Type: application/json" \
     -d '{"applyUserId":2002,"remark":"加个好友"}'
```

观察现象:

- wscat 会收到一帧 `{"type":4,"msgUuid":"4:1001:xxxx","data":{...}}`(type=4 是好友申请通知)。
- **如果你不回 ACK**:每隔 ~5 秒服务端日志会打印"ACK超时重投",重投 3 次后打印"超过最大重试次数,放弃投递"。
- **回 ACK 即停止重传**——在 wscat 里粘贴(把 `msgUuid` 换成你实际收到的那个):

```json
{"type":1,"msgUuid":"4:1001:xxxx"}
```

服务端日志出现 `acked:true`,`pendingAckMap` 移除该条,重传停止。

### 11.4 验证内部接口的令牌门禁

把上面的 `X-Internal-Token` 去掉或改错,应返回 401:

```bash
curl -i -X POST "http://localhost:8083/api/v1/message/push/friendApplication/1001" \
     -H "Content-Type: application/json" -d '{}'
# 期望:HTTP/1.1 401 ,body:{"code":40101,"msg":"未认证或非法请求来源","data":null}
```

### 11.5 验证一致性哈希的"黏连"(多节点时)

启动两台 RTC(不同 `NETTY_SERVICE_PORT` / `REALTIME_SERVICE_PORT`,都注册到同一 Nacos)。用同一个 `$JWT` 反复断开重连,观察网关日志里 `Netty连接按一致性哈希路由, userId: 1001, node: ...` ——**node 应始终是同一台**;同时 `redis-cli GET user:session:1001` 的值也应稳定指向那台的 8083。换一个用户的 JWT,可能被黏到另一台。

### 常见坑

- **连不上 / 握手即被关**:多半是 `token` 与 `userUuid` 不自洽(`validateToken` 要求 JWT subject == userUuid),或 token 过期/验签失败。
- **Redis 里看不到 `user:session:*`**:确认是经**网关**连的(走了一致性哈希 + 落到真实节点),而不是直连某节点;也确认握手真的 `HandshakeComplete` 了(路径必须是 `/api/v1/netty`)。
- **消息推不到**:先查 `redis-cli GET user:session:{uid}` 是否有值(没值=判离线,根本不会推);有值再确认那台 8083 的内存 `ChannelManager` 里确实有该用户的 channel(顶号、刚断线都可能让内存和 Redis 短暂不一致)。
- **收到重复消息**:这是 at-least-once 的正常代价,客户端要按 `msgUuid`/业务 messageId 去重,别指望服务端精确一次。
- **端口混淆**:浏览器连的是 **9000(WS)**,业务内部调的是 **8083(HTTP)**,Redis 路由里存的是 **8083**。三者别记混。

---

## 12. 小结 & 下一步

本章把"实时"这件事拆成了三块:

1. **建连与鉴权**:Netty pipeline 在握手 HTTP 阶段捞出 `userUuid/token`,升级完成后用 JWT 验签(且 subject 必须等于 userUuid)才放行,并把"用户↔节点"写进两层在线表。
2. **可靠投递**:`NettyMessageService` 发帧 + `AckMessageManager` 的 ACK/超时重传,做到 at-least-once;代价是可能重复,靠 `msgUuid` 去重。
3. **两套地址来源的配合**:网关一致性哈希环负责"建连时把用户黏到固定节点",Redis 路由表负责"下行时找到用户在哪台节点",二者一写一读、互相印证,构成完整闭环。

下一步建议读:

- **消息收发主链路**:消息怎么从发送方进入 Messaging、落库、再触发本章的下行推送(`/api/v1/message/user`),以及 Kafka topic `thousands_word_message` 的角色。
- **离线消息与数据存储**:当本章重传放弃、或用户压根不在线时,消息如何沉淀到 OfflineDataStoreService,等用户上线再拉取——它正是本章"放弃实时投递"之后的兜底。
