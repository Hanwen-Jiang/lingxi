# InfiniteChat（千言）后端学习文档

InfiniteChat 是一套**仿微信的即时通讯后端**：单聊 / 群聊、红包、朋友圈、离线消息，用 Spring Cloud 微服务 + Netty 长连接 + Kafka + Redis 实现。

这套文档**按"逻辑链"组织**，而不是按文件目录罗列——每一篇带你走完一条完整业务链路（一个请求从进入系统到落库/推送/返回的全过程），先讲"要解决什么问题、为什么这么设计"，再讲"怎么实现"，最后给"动手实践"。适合想系统学习 IM 后端的同学。

> 旧的 `docs/project-structure/` 与 `docs/project-structure-v2/`（逐文件的"文档地图"）已删除并由本套文档取代。生成旧地图的 `scripts/generate_project_structure_docs.py` 已**弃用**（保留未删，你可自行决定是否移除）。

---

## 📖 学习路线（建议按顺序读）

| 顺序 | 文档 | 你会学到 |
|---|---|---|
| 1 | [第 1 章 · 总览与架构基础](learn/01-architecture-and-bootstrap.md) | 全局心智模型：7 个服务的职责、端口/路由表、MySQL/Redis/Kafka/Nacos/Netty 各扮演什么角色、如何本地起步 |
| 2 | [第 2 章 · 鉴权与网关链路](learn/02-auth-and-gateway-chain.md) | 注册(BCrypt)→登录(JWT)→网关统一验签注入 `X-User-Id`→服务信任模型（`X-User-Id` / `X-Internal-Token`） |
| 3 | [第 3 章 · 发消息核心链路](learn/03-message-send-chain.md) | 发消息全链路 + **事务性 Outbox 模式**：为什么消息先写库再发 Kafka 才不丢 |
| 4 | [第 4 章 · 实时推送与在线状态](learn/04-realtime-and-presence-chain.md) | Netty WebSocket、在线状态如何存 Redis、一致性哈希把用户黏到同一节点、ACK 重传 |
| 5 | [第 5 章 · 离线存储与历史拉取](learn/05-offline-store-chain.md) | Kafka 消费**幂等落库**（为什么消费者必须幂等）、重连后按时间水位拉历史 |
| 6 | [第 6 章 · 好友与群链路](learn/06-contact-and-group-chain.md) | 好友申请流、单聊会话创建、群生命周期与角色、状态变更如何推送 |
| 7 | [第 7 章 · 红包链路（钱与一致性）](learn/07-redpacket-chain.md) | 发/抢/退红包，Redis Lua 原子操作 + DB 事务如何兜住"钱"的双写一致性 |
| 8 | [第 8 章 · 朋友圈链路](learn/08-moment-chain.md) | 发布/点赞/评论、增量同步 feed、通知广播 |

读完这 8 章，你应能独立画出整套系统的时序图，并解释每条链路的一致性与失败处理。

---

## 🗺️ 速查：服务与路由

| 服务 | 端口 | 网关路由前缀 | 职责一句话 |
|---|---|---|---|
| GateWay | 10010 | — | 边缘网关、统一鉴权、WS 一致性哈希负载均衡 |
| ContactService | 8080 | `/api/v1/contact/**` | 好友、群、会话生命周期 + 推送 |
| MessagingService | 8081 | `/api/v1/chat/**` | 消息发送、红包、Kafka Outbox、在线路由 |
| AuthenticationService | 8082 | `/api/v1/user/**` | 注册/登录、JWT、邮件验证码、COS 预签名 |
| RealTimeCommunicationService | 8083 + WS 9000 | `/api/v1/message/**`、`/api/v1/netty` | Netty 长连接推送 + ACK 重传 |
| OfflineDataStoreService | 8085 | `/api/v1/offline/**` | 消费 Kafka 落库 + 离线消息拉取 |
| MomentService | 8086 | `/api/v1/moment/**` | 朋友圈动态/点赞/评论 + 广播通知 |

- 服务发现：Nacos `:8848`（服务名 = `spring.application.name`；RTC 另注册 `NettyService` = WS 9000）。
- 统一返回：`Result<T>` = `{code, msg, data}`。
- 在线状态 Redis key：`user:session:{userId}` = `"ip:8083"`（TTL 15 分钟）。
- Kafka topic：`thousands_word_message`。

---

## 🔧 维护与改进

- [改进记录与待办（不足文档）](IMPROVEMENTS.md) —— 本轮已修复的安全/正确性/一致性问题清单，以及仍待改进的事项与**部署注意事项**。
- [端到端测试环境（E2E-TESTING）](E2E-TESTING.md) —— 与 WSL 现有运行栈隔离、从修复后源码构建的 E2E 环境 + 冒烟测试，逐条验证修复。配套脚本见 `e2e/`。

> ⚠️ 近期对鉴权做了一次较大改造（网关统一验签 + 服务信任 `X-User-Id`/`X-Internal-Token`，密码切 BCrypt，JWT 改 7 天）。本文中各章描述的是**改造后的当前实现**。运行约定（必须经网关、内部令牌、BCrypt 不兼容旧密码等）见不足文档第三部分。

---

## ✍️ 文档约定

- 所有链路描述基于**当前真实代码**，引用形如 `MessagingService/src/main/java/.../MessageServiceImpl.java`，可点击跳转。
- 每章末尾的"动手实践"给出可复现的验证方式（curl / wscat / 查表 / 看 Redis key / 看 Kafka）。
- 术语：**链路** = 一个请求的完整处理路径；**落点** = 数据最终写到的表 / Redis key / topic。
