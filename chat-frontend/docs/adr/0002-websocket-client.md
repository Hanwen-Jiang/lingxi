# ADR 0002 — WebSocket 客户端策略

- 状态: Accepted (2026-06-26),握手形态待与 S3 B8 敲定
- 流: S4 / chat-frontend
- 约束出处: `docs/planning/40-chat-frontend-plan.md` §3.3、`docs/planning/30-chat-backend-plan.md` §5.2、`docs/planning/00-master-plan.md` §8(投递语义)

## 背景:后端 WS 的硬约束(权威帧目录)

- **接收专用通道**:WS 仅 push/ack/heartbeat;**发消息走 HTTP** `POST /api/v1/chat/session`(WS 不能发聊天内容)。
- **出站 `PushTypeEnum`**(server→client,`MessageDTO{type,msgUuid,data}`):`1 NEW_SESSION` · `2 MESSAGE`(文/图/红包)· `3 MOMENT` · `4 FRIEND_APPLICATION` · `5 NEW_GROUP_SESSION`;`msgUuid = {pushCode}:{userUuid}:{businessId}`,收到须回 ACK。
- **入站 `MessageTypeEnum`**(client→server):`1 ACK`(按 `msgUuid` 确认)· `2 LOG_OUT`(`data=LogOutData{userUuid}`)· `5 HEART_BEAT`(服务器回 type5 + 刷 TTL)。**其余 type 抛错。**
- **可靠性基座**:服务端按 `PendingAckMessage` 重投直到 ACK(at-least-once);Reader-idle 5 分钟无心跳即断;Redis 路由 TTL 15 分钟靠心跳续期;同用户重连踢旧通道。
- **阻塞点 B8**:当前握手用非标 HTTP 头 `userUuid/token`,浏览器 WebSocket API **设不了自定义握手头** → Web 端连不上。S3 将改为 `Sec-WebSocket-Protocol` 子协议或 `?token=&userUuid=` query(仍验 `subject==userUuid`)。

## 决策:WS 客户端必须实现的 7 件事

1. **握手适配层** — 抽象 `connect()`,握手参数实现两种形态可切(`Sec-WebSocket-Protocol` 携带 token / `?token=&userUuid=` 携带 query),最终取决于 S3 选型;在 S3 定稿前用接口隔离,联调时一行切换。
2. **心跳** — 客户端定时(30–60s,< 5min)发 `type=5 HEART_BEAT`,处理服务端回声;心跳即续 Redis 路由 TTL,不可缺。
3. **重连 + 指数退避** — 断线后指数退避(base→cap,带 jitter,封顶 ~30s);区分"主动登出不重连" vs "网络抖动需重连";重连成功后**回填空窗期消息**(用 since-cursor 历史拉取补齐,不只靠 WS 续推)。
4. **ACK** — 每收到 `type=2 MESSAGE`(及其他需 ack 的 push)按 `msgUuid` 回 `type=1 ACK`,关闭服务端重投;ACK 必须在"消息已落入本地状态/IndexedDB"**之后**发,避免 ack 了却没存。
5. **离线发件缓冲(send queue)** — 发送走 HTTP;断线/请求失败时把待发消息入本地队列(草稿态 `messageId=clientTempId`),恢复后按序重发;气泡呈现"发送中 / 已发送 / 失败可重试"。
6. **按 messageId 去重 + 会话内有序** — 后端是 at-least-once + 按 sessionId 分区保序;客户端**必须**按 `messageId` 去重(WS push、重连回填、历史分页三路会重叠)、按会话维度以单调键(`messageId`/`createdAt`)排序;乐观气泡的 `clientTempId` 在收到真 `messageId` 后做协调替换。
7. **多设备游标(延后,D11)** — 首版每用户游标(`last_read_message_id` per (user,session));接口预留 deviceId 维度,P3 视主计划决策再做。

## 隐含依赖(联调清单须标明)

- **D9 / Snowflake 碰撞**:当前后端 workerId 全为 1,多实例会生成碰撞 `messageId`,客户端按主键去重会**静默丢他人消息**。去重正确性依赖 S3 修 D9;Mock/单实例不触发,但代码注释与联调清单必须标明此前提。
- **D4 包络 + 真实 HTTP 状态、刷新令牌 `POST /api/v1/user/refresh`**:P1 由 S3/S1 交付,P2 联调前 ready。

## 架构:WS 是 react-query 缓存的副作用层

```
WS push ──▶ dispatch by PushType
              ├─ 2 MESSAGE          → upsert(messageId) 进 session 消息缓存(去重+排序)
              │                       → 更新会话列表末条 + 未读角标
              │                       → 回 ACK(落库后)
              ├─ 1 NEW_SESSION / 5 NEW_GROUP_SESSION → 失效会话列表
              ├─ 4 FRIEND_APPLICATION → 失效申请箱 + applyCount
              └─ 3 MOMENT            → 失效动态流
```

连接态(`connecting/online/offline/reconnecting`)进 zustand,驱动 `ConnectionBanner` 原语(设计系统)。发送链路:乐观 upsert(`clientTempId`)→ HTTP POST → 成功用真 `messageId` 协调替换 / 失败入重试队列。

## 阶段

- **P0/P1(Mock)**:对 Mock 推送实现全部 7 点并测通(重连/退避/心跳/ACK/去重/有序/离线重发);握手层接口隔离。
- **P2(真实)**:握手适配层切到 S3 实际选型;端到端验证心跳续 TTL、push 更新缓存、ACK 关重投、断线回填。
