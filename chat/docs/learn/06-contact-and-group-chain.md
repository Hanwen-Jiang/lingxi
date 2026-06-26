# 第 6 章 好友与群链路

> 本章主题一句话：**ContactService 负责"人与人/人与群的关系"——从搜人、加好友、建群、邀请、踢人到设管理员，每一次"关系变更"都会落库（friend / apply_friend / session / user_session 四张表），并尝试通过 RTC 实时推送给在线对端。**

学完你能回答这些问题：

- 一次"加好友"从申请到接受，到底写了哪几张表？为什么接受好友要顺手建一个单聊会话？
- "双向 friend" 是什么意思？为什么要插两条而不是一条？
- 群里的"群主 / 管理员 / 成员"这三种角色存在哪？踢人时凭什么判断"管理员不能踢管理员"？
- 关系变更后，对端是怎么"立刻收到通知"的？为什么推送 URL 里要先查 Redis？
- 推送失败（对方不在线 / RTC 挂了）会不会让整个加好友/建群操作回滚？
- 服务间调用（Contact -> RTC）凭什么不被 RTC 的鉴权拦截器拦下来？

---

## 1. 全局视角：四张表 + 一个推送出口

ContactService 这一层的核心数据只有四张表，理解了它们的关系，整章就通了：

| 表 | 含义 | 关键列（来自实体） |
|---|---|---|
| `apply_friend` | 好友**申请**记录（临时态） | `id`、`user_id`(发起者)、`target_id`(接收者)、`msg`、`status`(0未读/1通过/2拒绝/3已读/4过期)、`created_at` |
| `friend` | 好友**关系**（最终态，双向） | `id`、`user_id`、`friend_id`、`status`(1好友/2拉黑/3删除) |
| `session` | **会话**（单聊或群聊的"容器"） | `id`、`name`、`type`(1单聊/2群聊)、`status`(1正常/2删除) |
| `user_session` | 用户 ↔ 会话的**成员关系** | `id`、`user_id`、`session_id`、`role`(1群主/2管理员/3成员)、`status`(1正常/2删除) |

一句话记忆：

- **`apply_friend` 是"敲门"，`friend` 是"进门"。**
- **`session` 是"房间"，`user_session` 是"谁在这个房间里、是什么身份"。**单聊和群聊共用这套 `session + user_session` 模型，区别只在 `session.type` 和成员数量。

所有"关系变了"的事件，最后都走同一个出口——`PushServiceImpl`：先查 Redis 看对方在不在线，在线就带着内部令牌 HTTP 调 RTC 把通知推过去。这个出口贯穿全章，先记住它的位置：`ContactService/src/main/java/com/lou/contactservice/service/impl/PushServiceImpl.java`。

---

## 2. 鉴权：请求是怎么进到 Controller 的

在读业务前先看一眼"门禁"，否则你会困惑：为什么 Controller 里到处是 `isOperatorMismatch(...)`，而 Contact 调 RTC 又能畅通无阻？

两道关：

1. **网关那一关（外部请求）**：客户端带 `Authorization: Bearer <JWT>`，网关 `AuthGlobalFilter` 统一验签，通过后把可信用户 ID 写进下游请求头 `X-User-Id`，并剥掉客户端自己伪造的同名头。所以业务服务收到的 `X-User-Id` 是可信的。
2. **业务服务这一关**：`AuthContextInterceptor` 拦每个请求：

```java
// ContactService/.../config/AuthContextInterceptor.java:24-41
String token = request.getHeader("X-Internal-Token");
if (token != null && token.equals(internalToken)) {
    return true;                       // 服务间调用，直接放行
}
String uid = request.getHeader("X-User-Id");
if (uid != null && !uid.trim().isEmpty()) {
    UserContext.set(Long.valueOf(uid.trim()));  // 写入 ThreadLocal
    return true;
}
writeUnauthorized(response);           // 既没有内部令牌、又没有 X-User-Id -> 401
```

两个要点：

- **`X-Internal-Token`（默认 `infinite-chat-internal-dev-token`）是服务间调用的"工牌"**。Contact 推消息给 RTC 时带的就是它（见后文 §8），所以 RTC 那边的同款拦截器会直接放行，不要求 `X-User-Id`。
- **`UserContext` 是个 ThreadLocal**，存着"当前请求的真实操作人 ID"。Controller 里的 `isOperatorMismatch` 就靠它做"本人校验"：

```java
// ContactController.java:73-76
private boolean isOperatorMismatch(Long operatorId) {
    Long current = UserContext.get();
    return current != null && operatorId != null && !current.equals(operatorId);
}
```

含义：请求体/路径里声称的"操作人 ID"必须等于网关注入的真实 ID，否则 403。这样即使别人知道你的 userId，也没法冒用你的身份去加好友、踢人。`current == null`（内部调用，没设过 UserContext）时跳过校验。

---

## 3. 搜人与好友详情：先把"我和他是什么关系"算清楚

入口：`ContactController.searchUser`（`GET /{userUuid}/user?phone=...`）→ `FriendServiceImpl.getUserDetails`。

逻辑链很直白：按手机号查到目标用户 → 校验对方没被封禁/注销 → 拼出基础资料 → **额外补两个字段**：

```java
// FriendServiceImpl.java:92-93
populateSessionId(Long.valueOf(request.getUserUuid()), user.getUserId(), response);
populateFriendStatus(Long.valueOf(request.getUserUuid()), user.getUserId(), response);
```

- `populateSessionId`：调用 `userSessionMapper.findCommonSingleChatSessionIds(me, him)`，**用一条自连接 SQL 找出"我俩共同所在的那个单聊会话"**。这条 SQL 是单聊模型的关键：

```sql
-- UserSessionMapper.java:50-60 findCommonSingleChatSessionIds
SELECT us1.session_id
FROM user_session us1
INNER JOIN user_session us2 ON us1.session_id = us2.session_id
INNER JOIN session s ON us1.session_id = s.id
WHERE us1.user_id = #{userId1} AND us2.user_id = #{userId2}
  AND s.type = 1 AND s.status = 1
  AND us1.status = 1 AND us2.status = 1
```

  翻译：找一个 `type=1`（单聊）的会话，里面同时有 us1（我）和 us2（他）两条 `user_session`。有就返回 sessionId，前端就能直接打开聊天窗口；没有就 `null`。
- `populateFriendStatus`：查 `friend` 表里 `(user_id=我, friend_id=他)` 的那条，返回它的 `status`（1好友/2拉黑），查不到就返回 `0`（非好友）。

> 一句话：搜人不只返回"这个人是谁"，还返回"我和他现在什么关系、有没有现成的聊天窗"。前端据此决定显示"发消息"还是"加好友"。

---

## 4. 加好友（申请）：写一条 apply_friend + 推一条申请通知

入口：`POST /{userUuid}/friend/{receiveUserUuid}` → `ApplyFriendServiceImpl.addFriend`。

流程：

```
发起人 A                ApplyFriendServiceImpl              Redis        RTC(对端B)
  |  POST .../friend/B       |                                |            |
  |------------------------->|  查 A、B 是否存在               |            |
  |                          |  查 apply_friend 是否已存在     |            |
  |                          |--(不存在则)--插入 apply_friend->|            |
  |                          |  setEx friend_request:{id} 72h |            |
  |                          |  pushNewApply(B, 通知) ---------+----------->| (B在线则收到)
  |<-------- Result.OK(1) ---|                                |            |
```

关键代码（只看主干）：

```java
// ApplyFriendServiceImpl.java:74-80
ApplyFriend existingApplyFriend = findExistingApplyFriend(senderId, receiverId);
if (existingApplyFriend == null) {
    handleNewFriendApplication(senderId, receiverId, request.getMsg(), notification);
}
```

注意两个设计点：

1. **幂等去重**：`findExistingApplyFriend` 按 `(user_id=A, target_id=B)` 查，已存在就什么都不做（不重复插、不重复推）。所以连点两次"加好友"不会产生两条申请。
2. **申请有 72 小时有效期，但用的是 Redis TTL 而不是定时扫库**：

```java
// ApplyFriendServiceImpl.java:224-228
String redisKey = FriendRequestConstants.FRIEND_REQUEST_KEY_PREFIX + applyFriendId; // "friend_request:{id}"
redisTemplate.opsForValue().set(redisKey, "active", 72*60*60, TimeUnit.SECONDS);
```

   `apply_friend.status` 里有个 `4=过期`，但本服务并没有把它改回去的逻辑——过期是靠 Redis key 自动消失来"软表达"的。这是一处可以留意的设计简化（见 §9 常见坑）。

3. **推送是"尽力而为"**，包了 try-catch，推失败只打 warn，不影响申请落库：

```java
// ApplyFriendServiceImpl.java:230-236
try {
    pushService.pushNewApply(receiverId, notification);
} catch (Exception e) {
    log.warn(FriendRequestConstants.PUSH_FAILURE_LOG, e.getMessage());
}
```

### 未读数与申请列表

- `GET /{userUuid}/applyCount` → `getUnreadApply`：`count(target_id=我 AND status=0)`，就是红点上的数字。
- `GET /{userUuid}/apply` → `getApplyList`：分页查 `user_id=我 OR target_id=我` 的所有申请，并通过 `isReceiver` 标记"这条是别人申请加我（=1）还是我申请加别人（=0）"，前端据此显示"接受/拒绝"还是"等待对方"。

---

## 5. 处理申请（接受/已读）：一次接受连环写 5 条记录

入口：`POST /{userUuid}/application/{status}` → `ApplyFriendServiceImpl.modifyApply`。这个方法**只允许改成 ACCEPTED(1) 或 READ(3)**，拒绝/过期会直接抛异常：

```java
// ApplyFriendServiceImpl.java:160-169
switch (newStatus) {
    case ACCEPTED: return handleAcceptStatus(...);
    case READ:     return handleReadStatus(...);
    case REJECTED:
    case EXPIRED:
    default: throw new ServiceException("不允许修改为该状态值");
}
```

整个 `modifyApply` 标了 `@Transactional`。重点看 **ACCEPTED（接受好友）** 这条链，它是本章最"重"的一次写操作：

```java
// ApplyFriendServiceImpl.java:265-273 handleAcceptStatus
applyFriendMapper.update(new ApplyFriend().setStatus(ACCEPTED.getCode()), ...); // ① 申请记录置为已通过
return friendService.addFriend(userId, receiveUserId);                          // ② 进入"建立关系"
```

第②步 `FriendServiceImpl.addFriend` 才是真正干活的地方，它在**一个事务**里依次做四件事（`@Transactional(rollbackFor = Exception.class)`）：

```java
// FriendServiceImpl.java:131-141
createFriendRelations(userId, friendId);        // ② 写两条 friend（双向）
Long sessionId = createSession(userId, friendId);// ③ 建一个单聊 session
createUserSessions(userId, friendId, sessionId); // ④ 写两条 user_session
sendPushNotification(user, friendId, sessionId); // ⑤ 推"新会话"给对方
```

逐个拆解为什么这么做：

**为什么 friend 要插两条（双向）？**

```java
// FriendServiceImpl.java:242-256
friend1: user_id=A, friend_id=B, status=1
friend2: user_id=B, friend_id=A, status=1
```

因为 `friend` 表是"以我为视角"的——`(user_id=我, friend_id=对方)`。我想查"我有哪些好友"就 `WHERE user_id=我`。如果只存一行，B 查自己的好友列表时就查不到 A。**双向插入让两边各自的好友列表都对称、查询都简单**，代价是删除/拉黑时要记得处理两行（§6 会看到）。

**为什么接受好友要顺手建单聊会话？**

`createSession` 建一个 `type=SINGLE(1)`、`name=""` 的会话，再 `createUserSessions` 给 A、B 各插一条 `user_session`（`role=3` 普通用户）。这样**刚成为好友的瞬间，聊天窗口（session）就已经备好了**，前端拿到返回里的 `sessionId` 就能直接开聊，不用再单独发"创建会话"的请求。这正好和 §3 里 `findCommonSingleChatSessionIds` 形成闭环——以后搜人就能查到这个 session。

**接受后给谁推什么？**

```java
// FriendServiceImpl.java:301-309 sendPushNotification
notification.setSessionId(sessionId).setSessionType(SINGLE)...;
pushService.pushNewSession(friendId, notification);  // 推给"原申请发起者"
```

接受方（处理申请的人）是同步收到 HTTP 响应里的 `ModifyApplyResponse`（含 sessionId）；而**原来发申请、当时还不知道结果的那一方**，靠这条 `pushNewSession` 实时得知"对方同意了，会话已建好"。

> 小结这一节：接受 1 个好友 = `apply_friend` 改 1 行 + `friend` 插 2 行 + `session` 插 1 行 + `user_session` 插 2 行，全在一个事务里，任何一步抛异常整体回滚（推送失败除外，推送在事务内但只是 HTTP 调用，其异常会被上抛从而回滚——这点见 §9）。

**READ（已读）** 则轻得多：把"别人发给我、还未读"的申请批量置为 3：

```java
// ApplyFriendServiceImpl.java:275-283 handleReadStatus
UpdateWrapper: set status=READ
  where target_id=我 and user_id in(发起者们) and status=UNREAD
```

> 代码细节提醒：`handleAcceptStatus` 里 SQL 写的是 `user_id=userId AND target_id=receiveUserId`，即把 `userUuid` 当作**申请的发起者**、`receiveUserUuids[0]` 当作被接受的目标来更新申请行。理解参数语义时以这段 SQL 为准。

---

## 6. 删除与拉黑：对称地清理 / 软标记

**删除好友** `DELETE /{userUuid}/friend/{receiveUserUuid}` → `FriendServiceImpl.deleteFriend`，`@Transactional`，三步全清：

```java
// FriendServiceImpl.java:104-106
deleteApplyFriendRecords(userId, friendId); // 删两个方向的 apply_friend
deleteFriendRecords(userId, friendId);      // 删两条 friend（双向都删）
deleteSessionRecords(userId, friendId);     // 删他俩的单聊 session + user_session
```

注意它用了 `nested(...).or().nested(...)` 把两个方向都覆盖——因为 friend/apply 都是双向存的，删一边会留下脏数据。`deleteSessionRecords` 用 MyBatis-Plus-Join 自连接找出"两人共有的单聊 session"，连 `user_session` 一起物理删除。**删除是真删（物理 delete）。**

**拉黑** `POST /{userUuid}/block/{receiveUserUuid}` → `blockFriend`，则是**软标记**：只把 `(user_id=我, friend_id=他)` 那行的 `status` 改成 `2`（FRIEND_STATUS_BLOCKED），不动会话、不删数据。注意它只改"我这一侧"的那行，是单向拉黑。

| 操作 | 影响表 | 方式 | 对称性 |
|---|---|---|---|
| 删除好友 | apply_friend、friend、session、user_session | 物理删除 | 双向都删 |
| 拉黑好友 | friend | 改 status=2 | 仅改我这一侧 |

---

## 7. 群生命周期：建群 / 邀请 / 踢人 / 退群 / 成员 / 设管理员

群聊复用 `session(type=2) + user_session(role=1/2/3)` 这套模型。角色定义在 `constants/UserRole.java`：`GROUP_OWNER(1)`、`GROUP_ADMIN(2)`、`GROUP_MEMBER(3)`。

### 7.1 建群 `POST /groups` → `SessionServiceImpl.createGroup`

`@Transactional`，链路：

```
校验创建者状态正常 -> 生成 sessionId(雪花)
-> 自动拼群名(创建者+成员的昵称、最长16字, 见 generateGroupName)
-> insert session(type=2)
-> insert user_session(创建者, role=群主1)
-> 批量 insert user_session(其他成员, role=成员3)  [saveBatch]
-> 逐个 pushGroupNewSession(...) 推"新群会话"通知
```

两个细节：

- **创建者是群主（role=1），被拉进来的成员是普通成员（role=3）。** 群名自动生成、截断到 16 字符（`SessionServiceImpl.java:141-168`）。
- **成员入库用批量 `saveBatch`，但推送是逐个 try-catch**：某个成员推送失败只把他记进 `failedMemberIds` 返回，不影响其他人，也不回滚入库（`SessionServiceImpl.java:253-260`）。

### 7.2 邀请进群 `POST /group/invite` → `GroupServiceImpl.inviteGroup`

`@Transactional`，比建群多了一圈**权限和资格校验**：

```java
// GroupServiceImpl.java:60-76
validateParameters(session, inviterId, inviteeIds);   // 群存在&是群聊；邀请人在群内且是群主/管理员
Set<Long> nonFriendIds   = getNonFriendIds(inviterId, inviteeIds);    // 必须是邀请人的好友
Set<Long> alreadyInGroupIds = getAlreadyInGroupIds(sessionId, inviteeIds); // 已在群里的跳过
processInvitees(...);  // 过滤后批量 saveBatch + 逐个推送
```

规则提炼：

- 只有**群主或管理员**能邀请（`isInviterHasPermission` 判 role==1 || role==2，`GroupServiceImpl.java:142-144`）。
- 被邀请人**必须是邀请人的好友**且账号状态正常，否则进 `failedIds`。
- 已在群里的人跳过。最终返回 `successIds / failedIds` 两个清单。

### 7.3 踢人 `POST /group/kick` → `KickGroupServiceImpl.kickGroupMembers`

`@Transactional`。核心是**基于角色的踢人权限矩阵**：

```java
// KickGroupServiceImpl.java:186-196 validateAndCollectMembers
if (role == ROLE_OWNER) throw KICKED_IS_OWNER;           // 谁都不能踢群主
if (isAdmin && role == ROLE_ADMIN) throw KICKED_IS_ADMIN; // 管理员不能踢管理员
```

| 操作者\被踢者 | 群主(1) | 管理员(2) | 成员(3) |
|---|---|---|---|
| 群主(1) | ✗(不能踢群主) | ✓ | ✓ |
| 管理员(2) | ✗ | ✗(不能踢同级) | ✓ |

校验通过后 `performKick` 用 `deleteBatchIds` **物理删除** 这些人的 `user_session` 行，返回成功被踢的 userId 列表。注意：被踢成员是否被推送通知，本方法未触发推送（仅删库 + 返回列表）。

### 7.4 退群 `POST /group/exit` → `ExitGroupServiceImpl.exitGroup`

`@Transactional`。校验用户存在、会话是群聊、用户确实在群里，然后删掉自己那条 `user_session`。删 1 行算成功，删 0 行抛"退群失败"。**注意：这里没有"群主退群要先转让"的逻辑**——群主一样能退，退完群可能没有群主（设计上的简化）。

### 7.5 群成员列表 `GET /group/{sessionId}/members` → `GetGroupMembersServiceImpl`

校验 session 存在且 `type=2`，查 `user_session(status=1)` 拿到 userId 列表，再回表 `user` 拿昵称头像，组装成 `GroupMemberDTO` 列表返回。这是个纯读接口，**没有 `isOperatorMismatch` 校验**（任何登录用户都能查某群成员）。

### 7.6 设/撤管理员 `POST /group/setAdmin` → `GroupAdminServiceImpl.setGroupAdmin`

权限比邀请更严——**只有群主能设管理员**：

```java
// GroupAdminServiceImpl.java:61-63
if (!Objects.equals(operator.getRole(), UserRole.GROUP_OWNER.getValue())) {
    throw new ServiceException("无权限设置管理员");
}
```

校验群存在、操作人是群主、目标在群里，然后把目标的 `user_session.role` 改成 `2`（设为管理员）或 `3`（取消，回退成员）。`isAdmin=true` 设、`false` 撤。

---

## 8. 状态变更后的推送出口：PushServiceImpl

前面所有"建会话/进群"都调到了 `pushService.pushXxx(...)`，它们最终汇聚到一个私有方法 `pushNotification`。这是本章最该理解的"分布式细节"：

```java
// PushServiceImpl.java:57-84 (节选)
String nettyServerIP = redisTemplate.opsForValue().get("user:session:" + userId); // ①查在线状态
if (nettyServerIP != null) {                                                       // ②在线才推
    String json = JSON.toJSONString(notification);
    Request request = new Request.Builder()
        .url("http://" + nettyServerIP + urlEndpoint + userId)                     // ③URL直接拼Redis里的ip:port
        .post(requestBody)
        .addHeader("X-Internal-Token", internalToken)                              // ④带内部令牌
        .build();
    client.newCall(request).execute();
} else {
    log.info(offlineLogMsg);                                                        // ⑤离线就只打日志
}
```

四个关键点，逐条理解：

1. **先查 Redis `user:session:{userId}`**：这是 RTC 在用户上线时写入的"该用户连在哪台 Netty 机器上"，值形如 `192.168.1.10:8083`，TTL 15 分钟。这是"找人"的唯一依据。
2. **URL 直接用 Redis 里的 `ip:port`**——`"http://" + nettyServerIP + urlEndpoint + userId`。**不再手拼端口号**：用户连在哪台机器、哪个端口，Redis 里存的就是哪个，避免了"硬编码端口、多实例时推错机器"的老问题。
3. **带 `X-Internal-Token`**：这就是 §2 说的"工牌"。RTC 侧的 `AuthContextInterceptor` 见到合法内部令牌直接放行，不会因为缺 `X-User-Id` 而把这次服务间推送拦成 401。
4. **离线（Redis 查不到）就只记一条 info 日志，不报错**。离线消息的补偿由 OfflineDataStoreService 等环节负责，不是 Contact 的责任。

三种通知对应的 RTC 端点（`constants/UrlEnum.java`）：

| 方法 | 触发场景 | RTC 端点（拼在 ip:port 后） |
|---|---|---|
| `pushNewApply` | 有人申请加你好友 | `/api/v1/message/push/friendApplication/{userId}` |
| `pushNewSession` | 对方接受了你的好友申请（单聊会话已建） | `/api/v1/message/push/newSession/{userId}` |
| `pushGroupNewSession` | 你被建群/邀请进了某个群 | `/api/v1/message/push/newGroupSession/{userId}` |

---

## 9. 失败与边界处理

| 场景 | 行为 | 代码依据 |
|---|---|---|
| 重复加好友 | 幂等，已有申请则不再插、不再推 | `addFriend` 先 `findExistingApplyFriend` |
| 推送失败（对端 RTC 报错） | 加好友/接受好友的推送被 try-catch 吞掉，只 warn，**不回滚** | `ApplyFriendServiceImpl.pushNotification`、建群里逐个 try-catch |
| 接受好友时建表中途失败 | `addFriend` 标 `@Transactional(rollbackFor=Exception.class)`，friend/session/user_session 全部回滚 | `FriendServiceImpl.addFriend` |
| 申请过期 | 仅靠 Redis key `friend_request:{id}` 72h TTL 表达，**status 字段不会自动改为 4** | `setFriendRequestExpiration` |
| 非本人操作 | Controller 层 `isOperatorMismatch` 返回 403 | `ContactController` 各方法开头 |
| 踢群主 / 管理员踢管理员 | 抛 `KICKED_IS_OWNER` / `KICKED_IS_ADMIN` | `validateAndCollectMembers` |
| 非群主设管理员 | 抛"无权限设置管理员" | `GroupAdminServiceImpl` |
| 邀请非好友 / 已在群 | 不入库，进 `failedIds` 返回 | `processInvitees` |

**值得注意的两处不一致（学习时留心，不是"标准答案"）**：

- 加好友/接受好友的推送异常被吞（不回滚），而**建群、邀请里的 `sendPushNotification` 写法**虽然单个成员推送也 try-catch，但 `FriendServiceImpl.addFriend` 的 `sendPushNotification` 抛出的 `Exception` 是直接 `throws` 上去的——它在事务方法内，如果 RTC 报错可能导致已建好的好友关系回滚。两条路径对"推送失败是否影响主流程"的处理并不完全统一。
- 群主可以直接退群/被无人接管，apply_friend 的"过期态(4)"没有落库回写。这些都是真实代码里的简化点。

---

## 10. 动手实践

> 前置：所有请求都经网关（`http://<gateway>:10010`），需带 `Authorization: Bearer <你的JWT>`，网关验签后注入 `X-User-Id`。下面 `:10010/api/v1/contact/...` 即对应 Contact 服务。假设你的 userId 是 `1001`，对方是 `1002`。

**1) 加好友（写 apply_friend + 推申请）**

```bash
curl -X POST "http://<gw>:10010/api/v1/contact/1001/friend/1002" \
  -H "Authorization: Bearer <JWT-of-1001>" \
  -H "Content-Type: application/json" \
  -d '{"msg":"我是隔壁老王"}'
```

验证：
- 表 `apply_friend`：应有一行 `user_id=1001, target_id=1002, status=0`。
- Redis：`GET friend_request:{该行id}` 返回 `active`，`TTL` 约 259200 秒（72h）。
- 若 1002 在线：观察 RTC/Netty 日志收到 `/api/v1/message/push/friendApplication/1002`。

**2) 看未读数 / 申请列表（以 1002 视角）**

```bash
curl "http://<gw>:10010/api/v1/contact/1002/applyCount" -H "Authorization: Bearer <JWT-of-1002>"
curl "http://<gw>:10010/api/v1/contact/1002/apply?pageNum=1&pageSize=10" -H "Authorization: Bearer <JWT-of-1002>"
```

`applyCount` 应返回 `count=1`；列表里那条 `isReceiver=1`（别人申请加我）。

**3) 接受好友（连环写 5 条 + 推新会话）**

```bash
curl -X POST "http://<gw>:10010/api/v1/contact/1001/application/1" \
  -H "Authorization: Bearer <JWT-of-...>" \
  -H "Content-Type: application/json" \
  -d '{"userUuid":1001,"status":1,"receiveUserUuids":[1002]}'
```

（`status=1` 即 ACCEPTED；按代码语义 `userUuid` 是申请发起者、`receiveUserUuids` 是被处理目标。）

验证：
- `apply_friend` 对应行 `status=1`。
- `friend` 新增**两行**：`(1001->1002)` 与 `(1002->1001)`，`status=1`。
- `session` 新增一行 `type=1, status=1`。
- `user_session` 新增**两行**指向该 session，`role=3`。
- 响应体 `ModifyApplyResponse` 里能拿到 `sessionId`；对端在线则收到 `/push/newSession/...`。

**4) 建群 / 群成员 / 设管理员**

```bash
# 建群（1001当群主，拉1002、1003进群）
curl -X POST "http://<gw>:10010/api/v1/contact/groups" \
  -H "Authorization: Bearer <JWT-of-1001>" -H "Content-Type: application/json" \
  -d '{"creatorId":1001,"memberIds":[1002,1003]}'

# 查群成员（用上一步返回的 sessionId）
curl "http://<gw>:10010/api/v1/contact/group/<sessionId>/members" -H "Authorization: Bearer <JWT>"

# 群主把 1002 设为管理员
curl -X POST "http://<gw>:10010/api/v1/contact/group/setAdmin" \
  -H "Authorization: Bearer <JWT-of-1001>" -H "Content-Type: application/json" \
  -d '{"sessionId":<sessionId>,"userId":1001,"targetId":1002,"isAdmin":true}'
```

验证：
- `session` 一行 `type=2`；`user_session` 中 1001 的 `role=1`（群主），1002/1003 的 `role=3`。
- 设管理员后，1002 的 `user_session.role` 变为 `2`。
- 用非群主的 JWT 调 setAdmin 会得到"无权限设置管理员"。

**5) 推送链路怎么观察**：在 Redis 里手动看 `user:session:1002` 是否存在（值为 `ip:8083` 形态、TTL≈15min）。存在=在线，Contact 才会真正 HTTP 调 RTC；不存在=离线，Contact 端日志会打"用户已下线…"且不报错。

---

## 11. 小结 & 下一步

这一章你应该建立起这条主线：

> **"关系变更"= 写四张表中的若干行 + 尽力推送。** apply_friend 是敲门、friend 是进门（双向对称）、session 是房间、user_session 是房间里的身份（role 决定群权限）。接受好友会顺手建单聊会话形成闭环；群操作全靠 `user_session.role` 做权限判断。所有变更经由 `PushServiceImpl` 这个出口——先查 Redis `user:session:{userId}` 找到对端连在哪台 RTC、带 `X-Internal-Token` HTTP 推过去，离线则静默。

**下一步读哪篇**：

- 想知道"对端收到推送后，那条 WebSocket 消息是怎么被推到浏览器/客户端的"——去看 RealTimeCommunicationService（Netty WS 9000）那一章：Redis `user:session:{userId}` 是谁写的、`/api/v1/message/push/...` 端点在 RTC 里怎么处理。
- 想知道"用户聊天发消息（不是关系变更）"的主链路——去看 MessagingService + Kafka topic `thousands_word_message` 那一章。
- 想知道"离线时这些通知去哪了"——去看 OfflineDataStoreService 那一章。
