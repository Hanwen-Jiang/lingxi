# 第 8 章 朋友圈链路

> 本章主题：一条朋友圈从「发布」到好友手机上「实时弹出红点」，再到客户端「增量对账」拉到最新 feed，整条链路是怎么在 InfiniteChat 里流转的。

学完本章你能回答这些问题：

- 发一条朋友圈，文本和多张图片在数据库里到底存成什么样?为什么图片用一个 JSON 字符串而不是另开一张表?
- 朋友圈 id 是怎么生成的?为什么不用数据库自增?
- 删除一条朋友圈时,它的点赞和评论会怎么处理?是真删还是「假删」?
- 点赞 / 评论谁能收到通知?自己给自己点赞会不会给自己发通知?
- 客户端是怎么做到「只拉变化的部分」而不是每次全量刷新整个朋友圈的?这就是所谓的「增量同步」。
- MomentService 不持有 WebSocket 连接,它是怎么把通知推到正确的那台 RTC 机器、再推到正确的那个在线用户的?
- 朋友圈的「可见性」(谁能看到谁的动态)是怎么算出来的?

---

## 8.1 先建立全局视角:一张图看懂整条链路

朋友圈的本质是一个**异步广播 + 增量同步**的系统。和聊天消息不同,朋友圈不要求「实时送达」——你发一条动态,好友晚几秒看到没关系,甚至好友此刻不在线,等他下次打开 App「对账」拉到就行。所以这里的设计取舍是:

- **写入走同步 HTTP**(保证你自己马上看到发布成功),
- **通知走「尽力而为」的异步广播**(推失败了不影响你发布成功,反正客户端还会增量对账兜底),
- **读取走增量同步**(客户端记一个「上次同步到的时间水位」,每次只问服务端「这个水位之后有什么变化」)。

```
                        发朋友圈 (POST /api/v1/moment)
  ┌────────┐  Bearer JWT   ┌─────────┐ X-User-Id  ┌──────────────────────────┐
  │ 客户端 │ ────────────> │ GateWay │ ─────────> │      MomentService       │
  └────────┘               │ 验签+注入│            │  MomentController         │
      ▲                    └─────────┘            │   └ verifyOperator 校验本人│
      │                                            │  MomentServiceImpl        │
      │                                            │   1.Snowflake 生成 momentId│
      │ ②增量对账拉 feed                            │   2.media JSON 序列化入库  │
      │ GET /list/{userId}?time=水位                │   3.getFriendIds 取好友    │
      │                                            │   4.异步广播通知           │
      │                                            └──────────┬───────────────┘
      │                                                       │ ①通知广播
      │                                              SendOkHttpRequest
      │                                       (Nacos 发现「所有」RTC 实例)
      │                                                       │ 逐个 POST,带 X-Internal-Token
      │                          ┌────────────────────────────┼────────────────────────┐
      │                          ▼                            ▼                          ▼
      │                   ┌─────────────┐             ┌─────────────┐            ┌─────────────┐
      │                   │ RTC 实例 A  │             │ RTC 实例 B  │            │ RTC 实例 C  │
      │                   │ /push/moment│             │ /push/moment│            │ /push/moment│
      │                   │ 本地过滤在线 │             │ 本地过滤在线 │            │ 本地过滤在线 │
      │                   └──────┬──────┘             └──────┬──────┘            └─────────────┘
      │                          │ WS 推送                    │ WS 推送
      └──────────────────────────┴── 在 A 上在线的好友 ───────┴── 在 B 上在线的好友
```

请重点理解这张图传达的两个反直觉的点:

1. **MomentService 不知道某个好友连在哪台 RTC 上,所以它干脆「广播给所有 RTC 实例」**,让每台实例自己在本地判断「这个收件人是不是连在我这」。这是一种「我不知道你在哪,那我对着所有房间喊一遍」的朴素但有效的策略。
2. **即使通知一条都没推成功,这条朋友圈也已经发布成功了。** 通知只是「锦上添花」的实时提醒,真正保证「最终一致」的是客户端的增量对账(②号箭头)。

---

## 8.2 关键类与职责

> 源码根:`MomentService/src/main/java/com/lou/momentservice/`

| 类 | 职责 |
| --- | --- |
| `controller/MomentController` | 7 个 REST 端点的入口;每个写操作先调 `verifyOperator` 校验「请求体里的操作人 userId == 网关注入的可信用户ID」 |
| `service/impl/MomentServiceImpl` | 发布(Snowflake id + media JSON 序列化)、软删(级联清理点赞/评论)、增量 feed 组装(`getMomentList`) |
| `service/impl/MomentLikeServiceImpl` | 点赞(insert)、取消点赞(软删 `is_delete=1`)、点赞后给作者发互动通知 |
| `service/impl/MomentCommentServiceImpl` | 评论(支持 `parentCommentId` 父子回复)、删评论(先软删子评论再软删本评论)、评论后给作者发互动通知 |
| `service/impl/MomentNotificationServiceImpl` | 把「发布通知」「互动通知」包装成 `MomentRTCVO`,交给 `SendOkHttpRequest` 发出 |
| `service/impl/FriendServiceImpl` | `getFriendIds(userId)`:查 `friend` 表得到好友 id 列表(可见性的来源) |
| `utils/SendOkHttpRequest` | 通过 Nacos `DiscoveryClient` 发现所有 RTC 实例,用线程池并发 POST `/api/v1/message/push/moment`,带 `X-Internal-Token` |
| `config/AuthContextInterceptor` | 命中 `X-Internal-Token` 直接放行;否则要求 `X-User-Id` 写入 `UserContext` 否则 401 |

---

## 8.3 发布一条朋友圈

### 8.3.1 要解决什么问题

一条朋友圈有两类「天然麻烦」的数据:

1. **id 怎么生成?** 朋友圈是分库分表友好的业务,而且 id 还要回传给客户端做后续点赞/评论的引用。用数据库自增 id 有两个毛病:跨库不唯一、暴露「你是第几条朋友圈」这种业务量信息。所以这里用 **Snowflake(雪花算法)** 在应用层生成一个 64 位、趋势递增、全局唯一的 Long。
2. **多张图片 / 视频 URL 怎么存?** 一条朋友圈可以带 0~N 个媒体 URL。最「规范」的做法是另开一张 `moment_media` 表一对多。但这套系统选择了更轻量的做法:**把 URL 列表序列化成一个 JSON 字符串,塞进 `moment.media_url` 一个列里**。代价是没法对单张图片做 SQL 查询,好处是读写朋友圈只碰一张表、零 JOIN。对「朋友圈」这种「整条一起读、几乎不单独查图片」的场景,这是合理的取舍。

### 8.3.2 怎么实现

入口在 `MomentController.createMoment`,先校验操作人本人,再交给 service:

```java
// controller/MomentController.java:54
@PostMapping("")
public Result<CreateMomentResponse> createMoment(@Valid @RequestBody CreateMomentRequest request) throws Exception {
    verifyOperator(request.getUserId());          // 防止「替别人发朋友圈」
    CreateMomentResponse response = momentService.createMoment(request);
    return Result.OK(response);
}
```

`verifyOperator` 是这套系统鉴权模型的「最后一道闸」:网关已经验过 JWT 并把可信用户 id 注入到 `X-User-Id`,拦截器把它放进了 `UserContext`(ThreadLocal)。控制器在这里再比对一次「你请求体里声称的操作人,是不是你本人」:

```java
// controller/MomentController.java:143
private void verifyOperator(String operatorUserId) {
    Long trusted = UserContext.get();
    if (trusted == null) { return; }               // 内部调用/无上下文,跳过
    // ... 解析失败或不等于可信 id => 403 "无权代表他人操作"
    if (!trusted.equals(Long.valueOf(operatorUserId.trim()))) {
        throw new ResponseStatusException(HttpStatus.FORBIDDEN, "无权代表他人操作");
    }
}
```

> 注意这里有两个重载:`createMoment` 的 `userId` 是 `String`(走 String 版),其余请求的 `userId` 是 `Long`(走 Long 版)。差别只是「先 parse 再比」还是「直接比」。

真正的落库逻辑在 `MomentServiceImpl.saveMoment` —— 媒体 URL 列表在这里被 Gson 序列化成字符串:

```java
// service/impl/MomentServiceImpl.java:142
@Transactional
public MomentVO saveMoment(Long userId, String text, List<String> urls) {
    String mediaUrls = gson.toJson(urls);          // ① List<String> -> JSON 字符串
    Moment moment = createMomentEntity(userId, text, mediaUrls);
    if (!this.save(moment)) { throw new DatabaseException(...); }
    return convertToMomentVO(moment, urls);
}

// service/impl/MomentServiceImpl.java:160
private Moment createMomentEntity(Long userId, String text, String mediaUrls) {
    Snowflake snowflake = createSnowflake();       // ② Snowflake 生成 momentId
    Moment moment = new Moment();
    moment.setUserId(userId).setText(text)
          .setMediaUrl(mediaUrls)
          .setMomentId(snowflake.nextId());
    return moment;
}
```

Snowflake 的机器位 / 数据中心位来自 `ConfigEnum.WORKED_ID` / `DATACENTER_ID`,当前都硬编码为 `"1"`:

```java
// service/impl/MomentServiceImpl.java:171
private Snowflake createSnowflake() {
    return IdUtil.getSnowflake(
        Integer.parseInt(ConfigEnum.WORKED_ID.getValue()),       // "1"
        Integer.parseInt(ConfigEnum.DATACENTER_ID.getValue()));  // "1"
}
```

> 坑提示:多实例部署时,所有 MomentService 实例的 `WORKED_ID`/`DATACENTER_ID` 都是 `"1"`,理论上有 id 撞车风险。Snowflake 靠「机器位不同」来保证不同机器生成的 id 不冲突,真要水平扩容得让每个实例拿到不同的 workerId。这是单机/小规模够用、要扩容需注意的点。

发布成功后紧接着触发通知广播(见 8.6):

```java
// service/impl/MomentServiceImpl.java:124
private MomentVO createMomentWithNotification(Long userId, String text, List<String> mediaUrls) throws Exception {
    MomentVO momentVO = saveMoment(userId, text, mediaUrls);
    User user = userService.getById(userId);
    String avatar = user != null ? user.getAvatar() : null;
    List<Long> friendIds = friendService.getFriendIds(userId);          // 取好友列表
    momentNotificationService.sendMomentCreationNotification(userId, avatar, momentVO.getMomentId(), friendIds);
    return momentVO;
}
```

### 8.3.3 数据落点

| 落点 | 内容 |
| --- | --- |
| 表 `moment` | 一行:`moment_id`(Snowflake)、`user_id`、`text`、`media_url`(JSON 字符串,如 `["http://.../1.jpg","http://.../2.jpg"]`)、`create_time`、`update_time`、`delete_time`(NULL 表示未删) |
| RTC 实例 | 收到 `noticeType=1`(创建朋友圈)的通知 POST |

---

## 8.4 删除一条朋友圈:软删 + 级联清理

### 8.4.1 要解决什么问题

朋友圈不能「物理删除」,原因是 **8.5 的增量同步要靠它**:客户端只问「水位之后有什么变化」,如果你把记录 `DELETE` 掉了,服务端就没法告诉客户端「这条被删了,你本地也删掉」。所以删除必须是**软删**——给记录打个「删除标记 + 删除时间」,记录还在表里,只是状态变了。

`moment` 表的软删用 `delete_time`(时间戳,NULL=未删);`moment_like` / `moment_comment` 用 `is_delete`(0=未删,1=已删)。

第二个问题是**级联**:删一条朋友圈,它下面的点赞和评论就没意义了,得一起清掉。

### 8.4.2 怎么实现

```java
// service/impl/MomentServiceImpl.java:77
@Override
@Transactional(rollbackFor = Exception.class)
public DeleteMomentResponse deleteMoment(DeleteMomentRequest request) {
    Moment moment = validateMomentOwnership(request.getMomentId(), request.getUserId());  // ① 校验「是你的朋友圈」
    deleteAssociatedData(request.getMomentId());                                          // ② 级联清点赞/评论
    moment.setDeleteTime(new Date()).setUpdateTime(new Date());                           // ③ 打软删标记
    boolean update = this.update(moment, createMomentOwnerQuery(...));
    if (!update) { throw new DatabaseException(...); }
    return new DeleteMomentResponse().setMessage(MomentConstants.DELETE_MOMENT_SUCCESS_MSG);
}
```

三步都在**一个事务**里:校验归属 → 级联清理 → 打软删标记。任何一步炸了整体回滚,不会出现「点赞删了但朋友圈还在」的脏状态。

级联清理这里有一个**已修复的关键点** —— 必须按 `moment_id` 过滤,只删这条朋友圈名下的点赞/评论:

```java
// service/impl/MomentServiceImpl.java:192
private void deleteAssociatedLikes(Long momentId) {
    QueryWrapper<MomentLike> queryWrapper = new QueryWrapper<>();
    queryWrapper.eq(MomentConstants.FIELD_MOMENT_ID, momentId);   // 只删本 moment 的点赞!
    momentLikeService.remove(queryWrapper);
}
```

> 这就是任务里强调的「已修复:级联删点赞按 moment_id 过滤」。如果漏了这个 `eq(moment_id, ...)` 条件,`remove` 会变成「删全表点赞」的灾难性操作。务必记住:**MyBatis-Plus 的 `remove(wrapper)` 一旦 wrapper 是空条件,就是清空整张表**。

注意一个细节:级联清点赞/评论用的是 `remove`(物理删除),而朋友圈本身是软删(`delete_time`)。这是合理的——朋友圈本体需要保留以便增量同步告知客户端「这条没了」;但点赞/评论可以物理删,因为客户端拿到「朋友圈被删」这一条信号后,会把整条朋友圈连同它的点赞评论一起从本地清掉,不需要服务端再逐条告知「这个赞也没了」。

### 8.4.3 数据落点与边界

| 场景 | 结果 |
| --- | --- |
| 正常删除 | `moment.delete_time` 被设为当前时间;该 moment 名下 `moment_like` / `moment_comment` 行被物理删除 |
| 朋友圈不存在 / 不是你的 | `validateMomentOwnership` 查不到 → 抛 `MomentException("删除失败, 朋友圈不存在")` |
| update 返回 false | 抛 `DatabaseException`,事务回滚 |

---

## 8.5 点赞与评论

### 8.5.1 点赞:insert 一行,取消是软删

点赞是「加一行」,取消点赞是「把那行 `is_delete` 置 1」——不是物理删,同样是为了增量同步能告诉别人「这个赞撤了」。

```java
// service/impl/MomentLikeServiceImpl.java:56
@Transactional(rollbackFor = Exception.class)
public Long createLikeWithNotification(Long momentId, Long userId) throws Exception {
    Long likeId = createLike(momentId, userId);                  // insert moment_like
    Long momentOwnerId = momentService.getMomentOwnerId(momentId);
    List<Long> receiverIds = new ArrayList<>();
    if (momentOwnerId != null && !momentOwnerId.equals(userId)) { // 自己赞自己不通知
        receiverIds.add(momentOwnerId);
        notificationService.sendInteractionNotification(userId, momentId, receiverIds);
    }
    return likeId;
}
```

请注意这条**「自己点赞自己的朋友圈不发通知」**的判断(`!momentOwnerId.equals(userId)`)。同样的逻辑也出现在评论里。这是一个很小但很贴心的细节:你给自己的动态点赞,系统不会傻乎乎地给你自己弹一个「有人赞了你」。

取消点赞:

```java
// service/impl/MomentLikeServiceImpl.java:105
public DeleteLikeResponse deleteLikeMoment(DeleteLikeRequest request) {
    // 按 (moment_id, like_id, user_id) 三元组定位,查不到 => UserException("取消点赞失败, 点赞不存在")
    like.setIsDelete(MomentConstants.DELETED);   // is_delete = 1
    like.setUpdateTime(new Date());              // 更新水位,让增量同步能拉到
    // update ...
}
```

> 划重点:软删时**同时更新了 `update_time`**。这一步是增量同步的命脉——客户端是按 `update_time >= 水位` 来判断「有没有变化」的,如果删除时不刷新 `update_time`,这次删除就「悄悄发生」,客户端永远拉不到「这个赞撤了」的信号。

### 8.5.2 评论:支持父子回复

评论比点赞多一个维度——**可以回复别人的评论**,形成「评论→回复」的两层结构,靠 `parent_comment_id` 串起来:

```java
// service/impl/MomentCommentServiceImpl.java:91
public MomentComment createMomentComment(Long momentId, MomentCommentDTO momentCommentDTO) {
    // ... Snowflake 生成 commentId, 设 comment / momentId / userId / is_delete=0
    if (momentCommentDTO.getParentCommentId() != null) {       // 是「回复某条评论」
        momentComment.setParentCommentId(momentCommentDTO.getParentCommentId());
    }
    return momentComment;
}
```

删评论时,**先软删它的所有子评论,再软删它本身**,避免出现「父评论没了但回复还挂着」的孤儿数据:

```java
// service/impl/MomentCommentServiceImpl.java:148
private void deleteComment(Long momentId, Long commentId, Long userId) {
    deleteChildComments(momentId, commentId);   // 先把 parent_comment_id = commentId 的子评论批量软删
    deleteCurrentComment(momentId, commentId, userId);  // 再软删本评论(校验是本人)
}
```

`deleteChildComments` 用 `parent_comment_id = commentId` 批量更新 `is_delete=1`;`deleteCurrentComment` 则要求 `(moment_id, comment_id, user_id)` 都匹配(只能删自己发的评论),否则抛 `UserException`。

### 8.5.3 数据落点

| 操作 | 表 | 变化 |
| --- | --- | --- |
| 点赞 | `moment_like` | insert 一行,`is_delete=0` |
| 取消点赞 | `moment_like` | `is_delete=1` + 刷新 `update_time` |
| 评论 | `moment_comment` | insert 一行,`is_delete=0`,顶级评论 `parent_comment_id` 为 NULL,回复则填父评论 id |
| 删评论 | `moment_comment` | 子评论 + 本评论 `is_delete=1` + 刷新 `update_time` |
| 点赞/评论(非自赞自评) | RTC | 触发 `noticeType=2`(互动通知)POST |

---

## 8.6 通知广播:MomentService 怎么把消息推到正确的人

### 8.6.1 要解决什么问题

MomentService 是个无状态的 HTTP 业务服务,它**不持有任何 WebSocket 长连接**——真正握着用户长连接的是 `RealTimeCommunicationService`(RTC),而且 RTC 是**多实例**的:用户 A 可能连在 RTC 实例 1,用户 B 连在实例 2。

那 MomentService 想给「A 的好友们」推「A 发了新朋友圈」的通知,它面临一个经典分布式难题:**它不知道每个好友连在哪台 RTC 上**。

这套系统的解法非常直接:**广播给所有 RTC 实例,每台实例自己在本地判断「这个收件人是不是连在我这」**。这就是 8.1 图里说的「对着所有房间喊一遍」。

### 8.6.2 怎么实现

第一步,通知被包装成 `MomentRTCVO`(带 `receiveUserIds` 收件人列表 + `noticeType` 类型 + 可选 `avatar`):

```java
// service/impl/MomentNotificationServiceImpl.java:35
public void sendMomentCreationNotification(Long senderUserId, String avatar, Long momentId, List<Long> receiverUserIds) throws Exception {
    MomentRTCVO momentRTCVO = new MomentRTCVO();
    momentRTCVO.setNoticeType(NoticeMomentEnum.CREATE_MOMENT_NOTICE.getValue());   // 1
    momentRTCVO.setAvatar(avatar);
    momentRTCVO.setReceiveUserIds(receiverUserIds);                                // 收件人=好友们
    sendOkHttpRequest.sendNotification(momentRTCVO, senderUserId, ..., momentId);
}
```

第二步,`SendOkHttpRequest` 通过 Nacos 把**所有** RTC 实例查出来,并发逐个 POST:

```java
// utils/SendOkHttpRequest.java:97
private List<ServiceInstance> getServiceInstances() throws ServiceUnavailableException {
    List<ServiceInstance> instances = discoveryClient.getInstances("RealTimeCommunicationService");
    if (instances.isEmpty()) { throw new ServiceUnavailableException(); }
    return instances;          // 拿到「所有」RTC 实例,而不是负载均衡选一台!
}

// utils/SendOkHttpRequest.java:114
private void sendRequestsToServices(List<ServiceInstance> instances, String requestBodyJson) {
    ExecutorService executorService = Executors.newFixedThreadPool(DEFAULT_THREAD_POOL_SIZE);
    // ...
    for (ServiceInstance instance : instances) {
        executorService.submit(() -> sendRequestToInstance(instance, client, requestBody, requestBodyJson));
    }
    executorService.shutdown();
}
```

第三步,POST 到每个实例的 `/api/v1/message/push/moment`,**带上 `X-Internal-Token`** 表明这是可信的服务间调用(这样 RTC 那边的 `AuthContextInterceptor` 会直接放行,不需要 `X-User-Id`):

```java
// utils/SendOkHttpRequest.java:141
String url = instance.getUri().toString() + ConfigEnum.NOTICE_URL.getValue();  // .../api/v1/message/push/moment
Request request = new Request.Builder()
        .url(url).post(requestBody)
        .addHeader("X-Internal-Token", internalToken)     // 服务间调用凭证
        .build();
// 关键修复:try-with-resources 确保 Response 被关闭,避免连接泄漏
try (Response response = client.newCall(request).execute()) {
    log.info("成功向实例 {} 发送通知, 响应码: {}", instance.getUri(), response.code());
}
```

> 这就是任务里强调的「已修复响应未关闭泄漏」。OkHttp 的 `Response` 持有底层连接,如果不 `close()`(或用 try-with-resources),连接不会归还连接池,高频发通知时会把连接池耗尽。`try (Response response = ...)` 保证无论成功失败都关闭。

收件人「谁在线」的判断**不在 MomentService 做**——MomentService 把整个收件人列表发给每台 RTC,**每台 RTC 实例在本地用自己的在线表过滤出「连在我这」的人**(回顾事实基线:在线状态记在 Redis `user:session:{userId} = "ip:8083"`,RTC 据此判断该用户是否在本实例)。

### 8.6.3 失败与边界

| 场景 | 行为 |
| --- | --- |
| 没有任何 RTC 实例注册到 Nacos | `getServiceInstances` 抛 `ServiceUnavailableException` |
| 互动通知收件人列表为空 | `sendInteractionNotification` 直接 return,不发(见 `MomentNotificationServiceImpl:71`) |
| 自己赞/评自己的朋友圈 | 收件人列表为空,不发通知 |
| 某台 RTC POST 失败 | 该线程抛 `MessageSendFailureException`,但**不影响主流程**(已经在子线程里);朋友圈/点赞/评论本身已落库成功 |

最后一行特别重要:**通知是「尽力而为」,推失败了发布照样成功**。漏推的通知由 8.7 的增量对账兜底。

---

## 8.7 增量同步:客户端怎么「只拉变化的」

### 8.7.1 要解决什么问题

朋友圈 feed 如果每次都全量返回「你和所有好友的所有动态 + 所有点赞 + 所有评论」,数据量会随时间无限膨胀,既费流量又费数据库。

业界标准解法是**增量同步(基于时间水位的对账)**:客户端本地存一个「上次同步到哪个时间点」的水位 `time`,每次只问服务端「**这个水位之后,有什么新增、有什么被删**」,然后在本地把这些 delta 应用上去。

### 8.7.2 怎么实现:六个列表

`getMomentList` 返回的 `GetMomentListResponse` 有**六个列表**,正好是「3 类对象 × {新增, 删除}」:

```java
// data/getMomentList/GetMomentListResponse.java
private List<MomentsVO>       createMoment;   // 新增/变化的朋友圈
private List<MomentLikeVO>    createLike;     // 新增的点赞
private List<MomentCommentVO> createComment;  // 新增的评论
private List<Long>            deleteMoment;    // 被删朋友圈的 id 列表
private List<Long>            deleteLike;      // 被删点赞的 id 列表
private List<Long>            deleteComment;   // 被删评论的 id 列表
```

服务端的核心逻辑:**用 `update_time >= time`(水位)圈出「自上次以来动过的记录」,再按删除标记拆进「新增」或「删除」桶**:

```java
// service/impl/MomentServiceImpl.java:205
public GetMomentListResponse getMomentList(GetMomentListRequest request) {
    List<Long> friendIds = friendService.getFriendIds(request.getUserId());  // 可见性:好友
    friendIds.add(request.getUserId());                                      // 加上自己

    // 朋友圈:本人 + 好友,且 update_time >= 水位
    momentQueryWrapper.in("user_id", friendIds).ge("update_time", request.getTime());
    // 点赞 / 评论:moment_id 在上面查到的朋友圈里,且 update_time >= 水位
    momentLikeQueryWrapper.in("moment_id", momentIds).ge("update_time", request.getTime());
    momentCommentQueryWrapper.in("moment_id", momentIds).ge("update_time", request.getTime());
    // ... 遍历分桶
}
```

分桶逻辑就是「看删除标记往哪个篮子里扔」:

```java
// service/impl/MomentServiceImpl.java:243  朋友圈
if (moment.getDeleteTime() != null) {        // delete_time 非空 = 已删
    deleteMoment.add(moment.getMomentId());  // 扔进「删除」桶,只回 id
    continue;
}
// 否则组装完整 MomentsVO 扔进 createMoment

// service/impl/MomentServiceImpl.java:277  评论
if (momentComment.getIsDelete() != 0) {      // is_delete=1
    deleteComment.add(momentComment.getCommentId());
    continue;
}
// 点赞同理 (is_delete != 0 -> deleteLike)
```

客户端拿到六个列表后:把 `createXxx` 里的东西插入/更新本地库,把 `deleteXxx` 里的 id 从本地库删掉,然后把水位 `time` 更新成「这次返回里最大的 update_time」。下次再带新水位来问。**这就是「对账」**——双方不传全量,只传 diff,最终达成一致。

> 为什么删除的桶只回 id 而不回完整对象?因为客户端本地已经有这条记录了,它只需要知道「哪个 id 没了」就能删本地,不需要服务端再把已删对象的内容传一遍,省流量。

### 8.7.3 可见性:`getFriendIds`

「我能看到谁的朋友圈」= 我自己 + 我的好友。好友来源是 `friend` 表:

```java
// service/impl/FriendServiceImpl.java:21
public List<Long> getFriendIds(Long userId) {
    QueryWrapper<Friend> queryWrapper = new QueryWrapper<>();
    queryWrapper.eq("user_id", userId);
    return this.list(queryWrapper).stream().map(Friend::getFriendId).collect(Collectors.toList());
}
```

`getMomentList` 里还有一层「双保险」过滤:即使 SQL 查出来一条记录,如果它的 `userId` 不在 `userInfoMap`(本人+好友)里,也会被 `continue` 掉(见 `MomentServiceImpl:245`)。

### 8.7.4 数据落点

| 涉及 | 内容 |
| --- | --- |
| 表 `friend` | `user_id` -> `friend_id` 映射,决定可见性 |
| 表 `moment` / `moment_like` / `moment_comment` | 全部按 `update_time >= time` 增量查询;`delete_time`(moment)/ `is_delete`(like/comment)决定分到「新增」还是「删除」桶 |
| 返回 `Result<GetMomentListResponse>` | 六个列表的 delta |

---

## 8.8 动手实践

> 前置:服务都已起好(GateWay 10010、MomentService 8086、RTC 8083+9000、Nacos 8848),并已登录拿到一个 JWT(记为 `$JWT`),你的用户 id 记为 `$UID`。所有请求都打到网关 10010,网关验签后注入 `X-User-Id`。

### 1) 发一条带图朋友圈

```bash
curl -X POST "http://localhost:10010/api/v1/moment" \
  -H "Authorization: Bearer $JWT" \
  -H "Content-Type: application/json" \
  -d '{
        "userId": "'"$UID"'",
        "text": "今天天气不错",
        "mediaUrls": ["http://cdn.example.com/a.jpg", "http://cdn.example.com/b.jpg"]
      }'
```

**验证落点:**
- 数据库:`SELECT moment_id, media_url, delete_time FROM moment WHERE user_id = $UID ORDER BY create_time DESC LIMIT 1;` —— 你会看到 `media_url` 是一个 JSON 字符串 `["http://...a.jpg","http://...b.jpg"]`,`delete_time` 为 NULL。
- RTC 日志:每台 RTC 实例应打印 `成功向实例 ... 发送通知, 响应码: 200`。
- 在线好友的 wscat:如果好友此刻连着 WS(`wscat -c "ws://localhost:10010/api/v1/netty?..."`),会收到一条 `noticeType=1` 的推送。

### 2) 点赞 + 看「自赞不通知」

```bash
# 好友 B 给你这条朋友圈点赞(用 B 的 JWT)
curl -X POST "http://localhost:10010/api/v1/moment/like/<momentId>" \
  -H "Authorization: Bearer $JWT_B" -H "Content-Type: application/json" \
  -d '{"userId": <B_UID>}'
```
返回 `data.likeId`。此时**你**(作者)应收到 `noticeType=2` 互动通知。若改成你自己给自己点赞,RTC 不会收到任何 POST(收件人列表为空)。

验证:`SELECT like_id, is_delete, update_time FROM moment_like WHERE moment_id = <momentId>;`

### 3) 评论 + 回复(父子)

```bash
# 顶级评论
curl -X POST "http://localhost:10010/api/v1/moment/comment/<momentId>" \
  -H "Authorization: Bearer $JWT_B" -H "Content-Type: application/json" \
  -d '{"userId": <B_UID>, "comment": "好看!"}'

# 回复上面那条评论(带 parentCommentId)
curl -X POST "http://localhost:10010/api/v1/moment/comment/<momentId>" \
  -H "Authorization: Bearer $JWT" -H "Content-Type: application/json" \
  -d '{"userId": '"$UID"', "comment": "谢谢", "parentCommentId": <上一步的commentId>}'
```

验证:`SELECT comment_id, parent_comment_id, is_delete FROM moment_comment WHERE moment_id = <momentId>;` —— 回复那行的 `parent_comment_id` 非空。

### 4) 增量同步:看六个列表

```bash
# time 用一个「过去的时间水位」,如 2025-01-01 00:00:00,会拉到这之后所有变化
curl "http://localhost:10010/api/v1/moment/list/$UID?time=2025-01-01%2000:00:00" \
  -H "Authorization: Bearer $JWT"
```
观察返回的 `createMoment / createLike / createComment / deleteMoment / deleteLike / deleteComment` 六个数组。把 `time` 换成「刚才那次操作之后的时间」,你会看到返回明显变小——这就是增量的效果。

### 5) 删朋友圈,看软删 + 级联 + 增量信号

```bash
curl -X DELETE "http://localhost:10010/api/v1/moment/<momentId>?userId=$UID" \
  -H "Authorization: Bearer $JWT"
```
验证:
- `SELECT delete_time FROM moment WHERE moment_id = <momentId>;` —— `delete_time` 已被填上,记录**还在**(软删)。
- `SELECT COUNT(*) FROM moment_like WHERE moment_id = <momentId>;` —— 变 0(级联物理删)。
- 再调一次 `/list/{userId}`,这次 `<momentId>` 会出现在 `deleteMoment` 数组里 —— 客户端据此从本地删掉它。

---

## 8.9 常见坑

| 坑 | 说明 |
| --- | --- |
| 级联删点赞忘了 `eq(moment_id, …)` | MyBatis-Plus `remove(空wrapper)` 会清空整张表。本系统已修复:`deleteAssociatedLikes` 显式按 `moment_id` 过滤 |
| 软删时忘了刷 `update_time` | 增量同步靠 `update_time >= 水位` 判变化,不刷新水位 = 这次删除「隐身」,客户端永远拉不到 |
| OkHttp `Response` 不关闭 | 连接不归还连接池,高频发通知耗尽连接池。已修复:`try (Response response = …)` |
| 把通知当成「必达」 | 通知是尽力而为,推失败不回滚业务。最终一致靠客户端增量对账兜底,别在通知上加强一致性假设 |
| Snowflake `workerId` 都是 1 | 多实例水平扩容时有 id 撞车风险,需给每个实例分配不同 `WORKED_ID` |
| 物理删 vs 软删的混用 | 朋友圈本体软删(供增量同步告知「这条没了」),其名下点赞/评论物理删(客户端收到「朋友圈删了」会整条清掉本地,无需逐条告知) |

---

## 8.10 小结 + 下一步

这一章我们走完了朋友圈的完整链路:

- **发布** = Snowflake 生成 id + 媒体 URL 列表 JSON 序列化进单列 + 取好友列表 + 异步广播通知;
- **删除** = 软删(`delete_time`)+ 级联物理清点赞/评论,全程一个事务;
- **点赞/评论** = insert 一行,取消/删除是软删 + 刷 `update_time`,且「自赞自评不通知」、评论支持父子回复;
- **增量同步** = 客户端带时间水位,服务端按 `update_time >= 水位` 返回「新增/删除」六个列表做对账;
- **通知广播** = MomentService 不知道好友连在哪,于是通过 Nacos 把通知 POST 给**所有** RTC 实例,每台自己本地过滤在线收件人,带 `X-Internal-Token` 走服务间可信通道。

贯穿全章的核心思想是:**写操作强一致(同步落库),通知尽力而为(异步广播),读操作最终一致(增量对账)**——这是 IM/社交 feed 系统最经典的一组取舍。

**下一步读哪篇:**
- 想知道 RTC 收到 `/api/v1/message/push/moment` 后,怎么用 Redis `user:session:{userId}` 判断在线、怎么通过 Netty 把通知推到具体那条 WS 连接 —— 去看《实时通信与 WebSocket 推送链路》。
- 想知道好友关系(`friend` 表)是怎么建立、`status` 的 1/2/3 怎么流转的 —— 去看《联系人链路(ContactService)》。
- 想回顾「网关验签 → `X-User-Id` 注入 → `AuthContextInterceptor` → `UserContext`」这条鉴权链的全貌 —— 去看《鉴权与网关链路》。

> 引用源码(相对路径):
> `MomentService/src/main/java/com/lou/momentservice/controller/MomentController.java`、
> `service/impl/MomentServiceImpl.java`、`service/impl/MomentLikeServiceImpl.java`、
> `service/impl/MomentCommentServiceImpl.java`、`service/impl/MomentNotificationServiceImpl.java`、
> `service/impl/FriendServiceImpl.java`、`utils/SendOkHttpRequest.java`、
> `config/AuthContextInterceptor.java`、`model/{Moment,MomentLike,MomentComment,Friend}.java`、
> `model/vo/MomentRTCVO.java`、`constants/{MomentConstants,NoticeMomentEnum,ConfigEnum}.java`、
> `data/getMomentList/{GetMomentListRequest,GetMomentListResponse,MomentsVO}.java`。
