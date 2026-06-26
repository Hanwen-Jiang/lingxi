# S4 · chat-frontend 工作计划

> 本文是 **S4 / chat-frontend** 流(`chat-frontend/` 目录,IM Web 客户端)的权威工作计划。仅规划、不含代码。
>
> 契约级决策的唯一出处是 `00-master-plan.md`(D1–D9、端口表、提交约定);本文只在其约束内展开 S4 的技术选型与排期。
> 依赖契约见 `01-improvement-audit.md`(B6/B7/B8/M9/M10/M11)与 `.artifacts/wf_extract.txt` 的 `chat-backend-api` 节(`30-chat-backend-plan.md` 尚未落盘,本文据审计 + wf_extract 推导后端契约)。
> IA 与视觉规范遵循 `infinitechat-web/DESIGN.md`。状态同步见 `STATUS.md` 的 S4 小节。

---

## 1. 角色与现状

- **职责:** 为 chat-backend(IM 微服务后端,微信式人对人通讯)做生产级 Web 客户端;终端体验是"消息 + 助手"一个产品,但代码层与 agent-frontend 保持清晰边界(各自 SPA,共享 `@infinitechat/design-system`)。
- **现状 = 仅脚手架。** `chat-frontend/` 是一份干净的 Vite 5 + React 19 + TS + Tailwind v4 脚手架(包名 `infinitechat-chat-frontend`),`src/` 下只有 `App.tsx / api.ts / types.ts / main.tsx / styles.css`,**没有真实产品页面**。脚手架已自带:Mock 模式 README、`/api` dev proxy 雏形(当前指向 `:8080`,需按 D1 改为网关 10010)、`VITE_API_BASE` 切换约定、`lucide-react` + `motion`。脚手架 README 部分陈述已过期(端口、"house stack" 措辞),以本文为准。
- **前端参考基础 = 已完成。** S4 已建立 HeroUI Pro 参考体系:通读 3 个 skills(heroui-react-pro / native-pro / design-taste 78 原则)、两个 MCP(heroui-pro 135 组件、native-pro 80 组件)、整面 `E:\HeroUI-Pro` 镜像(21-agent 工作流),产出蒸馏索引 `E:\HeroUI-Pro\AGENT-REFERENCE.md`(可 grep)+ memory `heroui-pro-reference.md`。**组件参考不再是阻塞项**,工作流为 `list_components → get_component_docs → get_css/theme → design-taste`。
- **设计来源 = `infinitechat-web/`,已降级。** 它是一份高保真 HeroUI 风格原型(覆盖 messages + assistant),**纯展示、从未对接真实数据**,按 D8 降级为**不发布**的设计参考。其权威产物是 `infinitechat-web/DESIGN.md`(IA + 视觉规范)。
  - ⚠️ **风险标注:** 该原型从未处理过真实数据,其设计系统很可能**缺少真实 IM 必需的状态**:loading / empty / error / optimistic(乐观发送)/ offline(断线)/ reconnecting / send-failed-retry / unread。S4 抽取设计系统时**必须主动补齐这些态**,不能照搬一个"永远成功"的展示原型。

---

## 2. 必须遵守的契约级决策(D1–D9 中适用 S4 的项)

| 决策 | 与 S4 的关系 | S4 的动作 |
| --- | --- | --- |
| **D1 端口** | 网关 `10010` 是唯一对外 API 入口(`/api/v1/**`);E2E 段 +100(网关 10110)。 | API base 走相对 `/api` + `VITE_API_BASE`(默认空 = Mock);Vite dev proxy `/api` → 网关 `http://127.0.0.1:10010`(把脚手架现有的 `:8080` 改正)。**不**把端口硬编码进源码。 |
| **D2 统一身份** | 网关单点验签,下游只信注入的 `X-User-Id`;Auth 签发短期 access JWT(`sub` = string 化 snowflake)+ 刷新令牌;`X-User-Id` 为空一律 401。 | 登录后存 token;每个 REST 请求注入 `Authorization: Bearer <token>`;**不**自己传 `userId`(后端从 X-User-Id 取);access TTL 短 → 实现 401 触发刷新 + 队列重放,刷新失败则登出。 |
| **D4 响应包络** | 全栈统一 `{code,message,data,traceId,timestamp}`,错误映射**真实 HTTP 状态**(401/403/404/422/429/5xx),SSE 事件 schema 版本化。 | 单一 typed HTTP 客户端解包络;按 HTTP status 分流(401→刷新、403→无权、429→退避+Retry-After、5xx→重试/降级);展示 `traceId` 便于排障;助手流 SSE 按版本解析。 |
| **D5 ID 类型** | JSON 内统一 **string 化 snowflake**。 | 所有 id(`userId/sessionId/messageId/redPacketId`)前端类型一律 `string`,**绝不**用 `number`(JS Number 精度会损坏 snowflake);Mock 数据也用 string id。 |
| **D8 设计系统** | `@infinitechat/design-system` 单一来源,**S4 牵头**、S2 消费,`infinitechat-web` 不发布。 | S4 拥有该包的抽取、版本与契约(token + HeroUI Pro 封装 + verify-ui 规则);见 §6。 |
| (协同)**B8 握手** | 后端当前 WS 握手用非标 HTTP 头 `userUuid/token`,浏览器无法连;S3 将改为 `Sec-WebSocket-Protocol` 或 `?token=&userUuid=`。 | WS 客户端策略与 S3 的握手改造**协同设计**(见 §3),在 S3 落地前 WS 走 Mock 推送。 |

> 不直接约束 S4 的:D3(agent 入网关,S1/S3)、D6(分库,S3)、D7(E2E 隔离,S3/HUB)、D9(Snowflake 派生,S3)。但 D6/D9 的修复是 S4 真实联调的隐含前提(避免 messageId 碰撞导致去重误删,见 §4)。

---

## 3. 技术栈 ADR(决策与理由)

### 3.1 框架基线(对齐 house stack)
- **决策:** React 19 + Vite 5 + TypeScript(strict) + Tailwind v4 + HeroUI Pro,沿用 agent-frontend 已验证的同一套构建工具与设计令牌。
- **理由:** 两个 SPA 共享 `@infinitechat/design-system`,栈不一致会让封装层裂成两份;agent-frontend 已证明该栈能干净 `tsc -b`、令牌已对齐 DESIGN.md(`--accent #006FEE`、纯黑暗色、无渐变)。脚手架已是这套栈,零迁移成本。
- **复用 agent-frontend 构建工具:** 复用其 tsconfig 严格档、ESLint/Prettier 配置、Vite proxy 模式、CI typecheck+lint+build 流水线模板;**不**复用其 `App.tsx` 巨石结构(那是 M2 反面教材)——S4 一开始就按 feature 目录分文件。

### 3.2 路由 / 状态管理
- **路由:** 采用 `react-router`(数据路由)。理由:DESIGN.md 的 IA 是多目的地产品(home/messages/contacts/discover/assistant/settings/auth),需要真实 URL、深链、`aria-current`(DESIGN.md §4 要求)、按路由码分割;agent-frontend 无路由库是其已知缺陷,S4 不重蹈。
- **服务端状态:** 采用 `@tanstack/react-query` 管会话列表/历史/好友/未读等远端数据(缓存、分页 `useInfiniteQuery`、失效、乐观更新、重试退避开箱即用),正好对上 IM 的 loading/error/optimistic 需求。
- **客户端状态:** 轻量 `zustand`(或 Context)管会话选择、草稿、连接态、未读角标、主题。**不**引重型 Redux。
- **理由综述:** react-query 的 `useInfiniteQuery` 直接服务 B6 历史分页(cursor+limit);乐观写入直接服务"发送中→已发/失败重试"气泡;这是 IM 真实态的天然载体,自研会重复造轮子。

### 3.3 WebSocket 客户端策略(本流最非平凡的工程,须与 S3 协同)

后端 WS(`.artifacts/wf_extract.txt` chat-backend-api 节确证)的关键约束:
- **接收专用通道:** WS 仅 push/ack/heartbeat;**发消息走 HTTP** `POST /api/v1/chat/session`(WS 不能发聊天内容)。
- **入站帧**(client→server)`MessageDTO{type,msgUuid,data}` 仅支持 `type=1 ACK` / `type=2 LOG_OUT` / `type=5 HEART_BEAT`;其他类型后端抛错。
- **出站帧**(server→client)`PushTypeEnum`:`1 NEW_SESSION` / `2 MESSAGE`(文本/图片/红包)/ `3 MOMENT` / `4 FRIEND_APPLICATION` / `5 NEW_GROUP_SESSION`;`msgUuid = {pushCode}:{userUuid}:{businessId}`。
- **可靠性基座:** 服务端按 `PendingAckMessage` 重投直到客户端 ACK(at-least-once);Reader-idle 5 分钟不心跳即断连;Redis 路由 TTL 15 分钟靠心跳续期;同用户重复连接会挤掉旧 channel。
- **阻塞点 B8:** 当前握手用 HTTP 头 `userUuid/token`,**浏览器 WebSocket API 设不了自定义握手头** → Web 端根本连不上。S3 将改为 `Sec-WebSocket-Protocol` 子协议或 `?token=&userUuid=` query(仍验 `subject==userUuid`)。

**S4 的 WS 客户端必须实现(与 S3 握手改造协同):**

1. **握手适配层:** 抽象 `connect()`,握手参数实现两种形态可切(`Sec-WebSocket-Protocol` 携带 token / `?token=&userUuid=` 携带 query),最终取决于 S3 选哪种;在 S3 定稿前用接口隔离,联调时一行切换。
2. **心跳:** 客户端定时(< 5 分钟,建议 30–60s)发 `type=5 HEART_BEAT`,处理服务端回声;心跳即续 Redis 路由 TTL,不可缺。
3. **重连 + 指数退避:** 断线后指数退避重连(base→cap,带 jitter,封顶如 30s),区分"主动登出不重连"与"网络抖动需重连";重连成功后**回填空窗期消息**(用 §3.4 的 since-cursor 历史拉取补齐,不能只靠 WS 续推)。
4. **ACK:** 每收到一个 `type=2 MESSAGE`(及其他需 ack 的 push)按 `msgUuid` 回 `type=1 ACK`,关闭服务端重投;ACK 要在"消息已落入本地状态/IndexedDB"之后发,避免 ack 了却没存。
5. **离线发件缓冲(send queue):** 发送走 HTTP;断线/请求失败时把待发消息入本地队列(草稿态 `messageId=clientTempId`),恢复后按序重发;气泡呈现"发送中 / 已发送 / 失败可重试"。
6. **按 messageId 去重 + 会话内有序:** 后端是 **at-least-once + 按 sessionId 分区保序**(`00-master-plan.md` §8 投递语义),客户端**必须**按 `messageId` 去重(WS 推送、重连回填、离线拉取三路会重叠)、按会话维度排序(以 `messageId`/`createdAt` 单调键);乐观气泡的 `clientTempId` 在收到真 `messageId` 后做协调替换。
   - ⚠️ **隐含依赖 D9/M6:** 当前后端 Snowflake workerId 全为 1,多实例会生成碰撞 `messageId`,客户端按主键去重会**静默丢他人消息**。S4 的去重正确性依赖 S3 修 D9;在此之前 Mock/单实例不触发,但要在代码注释与联调清单中标明此前提。
7. **多设备游标(延后):** 多设备/每设备游标是 `00-master-plan.md` §10.5 待拍板项;P2 默认每用户游标,接口预留 deviceId 维度,P3 视主计划决策再做。

> WS 客户端要写成**与 react-query 缓存协作**的副作用层:push 到达 → 更新对应 session 的消息缓存 + 未读 + 会话列表末条,而不是各自维护一份状态。

### 3.4 后端契约消费映射(S4 将要对接的端点)

| 前端能力 | 依赖的后端契约 | 现状 |
| --- | --- | --- |
| 发消息 | `POST /api/v1/chat/session`(已存在) | ✅ 可用 |
| 会话/收件箱列表(末条+未读+名+头像) | `GET /api/v1/chat/sessions`(B7) | ❌ 待 S3 |
| 会话历史分页 | `GET /api/v1/chat/session/{id}/messages?cursor=&limit=`(B6) | ❌ 待 S3 |
| 好友/联系人列表 | `GET /api/v1/contact/.../friends`(M9) | ❌ 待 S3(现仅有查找/申请箱) |
| 未读计数 + 已读指针 | session-list 带 `unreadCount` + `POST .../sessions/{id}/read`(M10) | ❌ 待 S3 |
| 媒体上传(聊天图片/文件/语音) | 预签名 URL + content-type/size 校验 + CDN 下载 URL + 元数据(M11) | ❌ 待 S3(现仅头像式单 COS URL) |
| 浏览器 WS 接收 | 浏览器可用握手(B8) | ❌ 待 S3 |
| 好友申请箱 / 申请未读 | `GET .../apply`、`GET .../applyCount`(已存在) | ✅ 可用 |
| 登录 / 注册 / 邮箱验证码 | `POST /api/v1/user/{login,register,loginCode,common/sendMail,common/check}`(已存在) | ✅ 可用 |
| 助手流式 | `POST /api/agent/chat`(agent-backend,经网关,S1/S3) | 复用 S2 组件 |

---

## 4. 依赖与阻塞(Mock-until-S3 的硬约束)

**核心事实:真实数据联调阻塞于 S3。** chat-backend 当前**缺**前端渲染核心屏所需的全部读 API 与浏览器可用 WS:

| 阻塞项 | 含义 | 没有它前端做不了什么 |
| --- | --- | --- |
| **B6** 历史分页 | 无 `session/{id}/messages?cursor=&limit=` | 无法滚动/回填会话线程("加载更早") |
| **B7** 会话列表 | 无 `GET /chat/sessions` | 无法构建收件箱主屏 |
| **B8** 浏览器 WS 握手 | 握手用非标 HTTP 头 | Web 端连不上实时推送 |
| **M9** 好友列表 | 仅查找/申请箱,无"我的好友" | 通讯录、好友选择器渲染不出 |
| **M10** 未读/已读 | 无 last_read 指针、无 markRead | 无角标、无已读态 |
| **M11** 媒体上传 | 仅头像式单 COS URL | 发图片/文件/语音不可能 |

> 结论:**在 S3 补齐 B6/B7/B8/M9/M10/M11 之前,S4 一律用 Mock。** 这不是借口,而是结构性事实——审计 §5「只做最少」第 3 组明确"否则 chat-frontend 根本做不出来"。

**因此 S4 的策略:** 先做**与后端无关的全部工作**(设计系统、IA 壳、静态页、Mock 数据层、WS 客户端骨架),把 `src/api.ts` 设计成**唯一集成缝**——Mock 分支与真实分支同一签名,S3 就绪后逐端点替换、不动 UI。Mock 必须模拟真实态(延迟、失败、断线、乐观、空、未读),否则"永远成功"的 Mock 会把真实态的活儿留到联调期爆雷(这正是 infinitechat-web 原型的教训)。

**其它隐含依赖:** D9/M6(Snowflake 碰撞→去重正确性,§3.3.6)、D4 包络与真实 HTTP 状态(S1/S3 P1)、刷新令牌 `POST /api/v1/user/refresh`(S3,审计 L7);这些在 P1 阶段由 S3 交付,P2 联调前需 ready。

---

## 5. 分阶段计划(P0 → P3)

> 标注:`[并行不阻塞]` = 不依赖 S3 后端进度,现在即可做;`[串行依赖 S3]` = 必须等 S3 对应契约落地。

### P0 — 设计系统 + 壳 + Mock 地基 `[并行不阻塞]`
1. **抽 `@infinitechat/design-system`(S4 牵头,见 §6):** 从 DESIGN.md 提 token(色板/字号/圆角/间距/阴影/暗色规则)→ CSS 变量 + Tailwind v4 主题;封装 HeroUI Pro 基元为品牌组件;落地 verify-ui 规则(DESIGN.md §9 的禁用模式 + 溢出断言)。**首要补齐 IM 真实态原语**:`loading`(骨架)/`empty`/`error`(可重试)/`optimistic`/`offline`/`reconnecting` 的统一组件与令牌——这是原型缺失、真实 IM 必需的。
2. **按 DESIGN.md IA 搭壳:** 路由 + 布局骨架覆盖 `home / messages / contacts / discover / assistant / settings / auth` 七个目的地;桌面四栏工作区(rail · 会话列表 · 主聊天 · 助手面板)、平板两栏、手机单列 + 底部 dock(DESIGN.md §5/§8 响应式)。
3. **静态页:** 各目的地的静态高保真页(用设计系统组件,含全部真实态的视觉),不接数据。
4. **Mock 数据层:** `src/api.ts` 作为唯一集成缝,Mock 分支与真实分支同签名;Mock 覆盖会话列表/历史分页/好友/未读/发送/媒体/WS 推送,并**注入延迟、随机失败、断线/重连、乐观回执、空态**。
5. **基建:** Vite `/api` proxy → 网关 `127.0.0.1:10010`(改正脚手架的 `:8080`);`VITE_API_BASE` 切真实/Mock;ESLint/Prettier/Vitest/ErrorBoundary/`prefers-reduced-motion`;按 feature 分文件(不重蹈 agent-frontend 巨石)。

> P0 出口:`pnpm build` 绿;七个目的地壳 + 静态页可导航;三端(桌面/平板/手机)× 亮暗双色截图无横向溢出;设计系统含真实态原语;Mock 模式能跑通"选会话→看历史→发消息→收到回执"的全交互(DESIGN.md §9 验证项)。

### P1 — 静态页填充 + 交互骨架 `[并行不阻塞]`(与 P0 重叠推进)
1. 各页接 Mock 数据,跑通完整交互流:收件箱→打开会话→分页回滚→发文本/图片(Mock)→乐观气泡→已读角标→好友申请→登录/验证码流。
2. WS 客户端**骨架**:重连/退避/心跳/ACK/去重/离线队列全部对 Mock 推送实现并测通(§3.3),握手层用接口隔离待 S3 定形。
3. a11y 基线:`aria-current` 导航、`aria-pressed` 开关、键盘可达的登录/composer、对话框 intent(DESIGN.md §4)。
4. 登录态/令牌存储/`Authorization` 注入 + 401 刷新重放骨架(对 Mock 验证),真实刷新端点待 S3。

> P1 出口:纯 Mock 下产品**功能完整可演示**;WS 客户端在 Mock 推送下证明重连/去重/有序/离线重发;集成缝清晰,切真实只需替换 `api.ts` 分支与一行握手选择。

### P2 — 接真实数据 + 真实 WS + 助手入 IM `[串行依赖 S3]`
1. **接真实读 API**(逐端点替换 Mock,UI 不动):会话列表(B7)、历史分页(B6)、好友列表(M9)、未读+markRead(M10)、媒体上传(M11)。
2. **浏览器 WS 接 S3 新握手**(B8):把握手适配层切到 S3 实际选型(`Sec-WebSocket-Protocol` 或 `?token=&userUuid=`);端到端验证心跳续 TTL、push 到达更新缓存、ACK 关重投、断线回填。
3. **去重/有序对真实流:** 三路(WS push / 重连回填 / 历史分页)按 `messageId` 去重 + 会话内有序;乐观 `clientTempId`→真 `messageId` 协调(§3.3.6);确认 S3 已修 D9 避免碰撞。
4. **令牌刷新对真实端点:** 接 `POST /api/v1/user/refresh`,短 TTL access 的 401→刷新→重放→失败登出闭环。
5. **助手入 IM:** 在 IM 内保留一个 `assistant` 会话,接 agent-backend 流式 `POST /api/agent/chat`(经网关,统一 JWT);**复用 S2 的 trace/citation/工具确认组件**(出自共享设计系统),SSE 按 D4 版本化 schema 解析;助手会话与人对人会话在同一收件箱模型里并存(DESIGN.md "消息 + 助手一个产品")。

> P2 出口(对齐 master plan P2):能渲染收件箱 / 回滚历史 / 未读角标 / 浏览器连 WS / 发媒体;消息按 messageId 去重且会话内有序;IM 内置可用助手(按真实用户隔离);全部出自共享设计系统。

### P3 — 生产硬化 `[部分串行]`
1. **多设备**(若 `00-master-plan.md` §10.5 决定 P2 之后纳入):每设备游标对齐,跨设备已读同步。
2. **离线队列加固:** 持久化待发队列与已收消息到 IndexedDB,冷启动恢复;弱网/飞行模式可用。
3. **a11y 完整:** WCAG 2.1 AA 审计(对比度/键盘/焦点/触达 ≥40px,DESIGN.md §4)、屏幕阅读器走查。
4. **性能:** 长会话虚拟列表、路由级码分割、图片懒加载/缩略图、首屏预算。
5. **e2e:** 关键链路(登录→选会话→分页→发→收 push→已读→断线重连→助手流式)Playwright 化,绑定 master plan §8 测试策略;DESIGN.md §9 真实交互审计自动化。

---

## 6. 设计系统包契约(S4 产出 · S2 消费)

`@infinitechat/design-system` 由 S4 拥有(D8),`infinitechat-web` 不发布,S2 作为消费方。导出方向(随实现细化,先定**方向与边界**):

**1) 设计令牌(token,单一来源):**
- 来自 DESIGN.md §2 色板(`--neutral-50/100/200`、`--blue-500 #006FEE`/`--blue-600`、亮暗 `--surface/--text/--bg`)、§3 字体(Inter 栈、负字距标题)、卡片圆角 `18–32px`、间距/阴影/暗色纯黑规则。
- 形态:CSS 自定义属性 + Tailwind v4 `@theme`;亮/暗双主题(暗色强制纯黑、无 ambient wash);**禁渐变、禁紫调、禁蓝调浅背景**(DESIGN.md 硬约束)。

**2) HeroUI Pro 封装组件(品牌化基元):**
- 导航:icon rail / 底部 dock / 顶栏(桌面文本 tab + 手机单行工具簇)、`aria-current` 内建。
- 容器:Panel/Card(圆角档)、divider 行、左蓝 accent rail、chip、inline progress(DESIGN.md 反"卡中卡")。
- 表单:Input/Textarea(蓝聚焦边界)、Button(主蓝/次中性,hover/pressed/disabled/focus 四态)、状态 pill(中性 + 小语义点,禁大绿 badge)。
- 聊天专用:消息气泡(自/他/系统)、composer(草稿/禁用空发)、会话行、未读角标、typing/online 指示。

**3) IM 真实态原语(原型缺失、本包补齐——核心增值):**
- `loading`(骨架而非 spinner 优先)、`empty`、`error`(可重试 + 不泄后端本地化错误串)、`optimistic`(发送中/已发/失败重试)、`offline`/`reconnecting`(连接态横幅)、`unread`、空窗回填态。

**4) verify-ui 规则(可执行约束,供两端复用):**
- DESIGN.md §9 的禁用模式扫描(紫调色名 / gradient 声明 / 蓝调浅背景 / emoji 占位 / 内部实现措辞)+ 三端 × 亮暗截图 + `scrollWidth===clientWidth` 溢出断言 + 真实交互审计清单。

> 交付形态建议:monorepo 内包或可被两 SPA 引用的本地包;版本化 + CHANGELOG;S2 升级前 S4 在 STATUS.md 写"交接"。

---

## 7. 给其他流的交接与依赖

**S4 依赖 S3(被挡):** B6 历史分页 · B7 会话列表 · B8 浏览器可用 WS 握手 · M9 好友列表 · M10 未读/markRead · M11 媒体上传契约;另需 D4 包络+真实 HTTP 状态、刷新令牌端点、D9 Snowflake 派生(去重正确性前提)。**S3 落地这些之前 S4 用 Mock。** 请 S3 在 `30-chat-backend-plan.md` §5 定稿端点签名(尤其握手形态:`Sec-WebSocket-Protocol` vs `?token=&userUuid=`、分页 cursor 语义、session-list 字段、媒体上传流程),S4 据此切 `api.ts` 真实分支。

**S4 提供 S2(解锁):** `@infinitechat/design-system`(token + HeroUI Pro 封装 + IM 真实态原语 + verify-ui)。S2 的登录页、错误/加载/空态加固、富引用、工具确认 UX 应消费本包,避免两端令牌分叉。助手组件(trace/citation/工具确认)由 S2 实现、S4 在 IM 内复用——二者需就组件 API 对齐,建议放进设计系统或共享包。

**与 S1:** 助手入 IM 走 `POST /api/agent/chat`(经网关),依赖 S1 的统一包络/string 化 id/版本化 SSE(M13/M14);S4 按 D4 解析。

**协同设计点(WS 握手):** S4 的 WS 客户端握手适配层与 S3 的 B8 改造**同一处契约**,需在 STATUS.md 互相"交接"敲定最终形态后再硬化。

---

## 8. 完成约定

- **分支:** `feat/chat-frontend-<topic>`、`docs/chat-frontend-...`;改动只在 `chat-frontend/`(设计系统包若落在 monorepo 共享位置,跨目录改动先在 STATUS.md 写"交接")。提交信息结尾按仓库惯例附署名;默认不合并 main、不强推(`00-master-plan.md` §9)。
- **纯文档/隔离改动可提交**;跨契约破坏性改动等中枢拉齐。
- **STATUS.md 同步:** 每完成一个工作单元,在 `STATUS.md` 的 **S4 小节顶部追加**一条(完成/产出物/关键决策/阻塞/交接/待中枢确认);契约级问题写"待中枢确认",由中枢落 `00-master-plan.md`。本计划落盘后追加首条:产出 `40-chat-frontend-plan.md`,关键决策 = react-router + react-query + zustand + WS 客户端策略 + 设计系统包契约方向;阻塞 = 真实联调待 S3 的 B6/B7/B8/M9/M10/M11;交接 = 为 S2 提供设计系统、与 S3 协同 WS 握手。

---
*维护者:S4。本文在 `00-master-plan.md` 决策约束内展开;契约级变更以 master plan 为准,进度同步 `STATUS.md`。*
