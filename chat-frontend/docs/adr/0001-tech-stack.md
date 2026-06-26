# ADR 0001 — chat-frontend 技术栈

- 状态: Accepted (2026-06-26)
- 流: S4 / chat-frontend
- 约束出处: `docs/planning/00-master-plan.md`(D1/D2/D4/D5/D8）、`docs/planning/40-chat-frontend-plan.md` §3、`infinitechat-web/DESIGN.md`

## 背景

chat-frontend 是灵犀(Lingxi)IM 平台的生产级 Web 客户端,需要消费一个多目的地的消费级产品 IA(home/messages/contacts/discover/assistant/settings/auth),并最终对接 chat-backend 的真实数据 + 浏览器 WebSocket。真实数据联调阻塞于 S3(B6/B7/B8/M9/M10/M11),交付前一律 Mock。本 ADR 锁定栈与理由,使 S3 就绪后只需替换 `src/api` 的集成缝、不动 UI。

## 决策

### 框架基线
**React 19 + Vite 5 + TypeScript(strict) + Tailwind v4 + HeroUI Pro。** 与 agent-frontend(S2)同栈,因为两个 SPA 共享 `@infinitechat/design-system`(D8);栈分叉会让封装层裂成两份。agent-frontend 已证明该栈能干净 `tsc -b`,且已把 HeroUI Pro 令牌校准到 DESIGN.md(`--accent #006FEE`、纯黑暗色、无渐变、Inter)。

- **复用** agent-frontend 的:tsconfig 严格档、Vite + `@tailwindcss/vite` + `@vitejs/plugin-react` 配置、主题预涂脚本(localStorage `lingxi-theme`,避免闪烁)、HeroUI Pro CSS 变量体系(`--accent/--background/--surface/--foreground/--muted/--separator/--focus/--chart-1..5`)。
- **不复用** 它的 `App.tsx` 巨石(2647 行,M2 反面教材)。S4 一开始就按 feature 目录分文件。

### 路由 — `react-router`(数据路由,v7)
DESIGN.md 的 IA 是多目的地产品,需要真实 URL、深链、`aria-current`(§4)、按路由码分割。agent-frontend 无路由库是其已知缺陷,S4 不重蹈。

### 服务端状态 — `@tanstack/react-query`(v5)
管会话列表/历史/好友/未读等远端数据:缓存、`useInfiniteQuery`(直接服务 B6 cursor+limit 分页)、失效、乐观更新、重试退避开箱即用,天然对上 IM 的 loading/error/optimistic 需求。WS 客户端作为副作用层写入同一份 query 缓存(push→更新 session 消息缓存+未读+会话列表末条),不另维护一份状态。

### 客户端状态 — `zustand`(v5)
轻量管会话选择、草稿、连接态、未读角标、主题。不引重型 Redux。

### 样式与组件
Tailwind v4 + HeroUI Pro(`@heroui/react` + `@heroui-pro/react` + `@heroui/styles`)。组件参考体系已建好(`E:\HeroUI-Pro\AGENT-REFERENCE.md`),工作流 `list_components → get_component_docs → get_css/theme → design-taste`。`cn()` = `clsx` + `tailwind-merge`;变体用 `tailwind-variants`。

### 设计系统包(D8,S4 牵头)
`@infinitechat/design-system` 落在 `chat-frontend/packages/design-system/`,当前经 Vite alias + tsconfig paths 引用(`@infinitechat/design-system`),保持可被抽出为独立包的边界(自带 package.json/exports)。S2 后续消费时由中枢决定是否上提为根级 monorepo 包(跨目录,走 STATUS 交接)。理由:在"只改 chat-frontend/"约束下,alias 比 npm workspaces 更低风险(免重排 lock/免 EPERM 缓存折腾),且与上提后的解析语义一致。

### 契约消费(D1/D2/D4/D5)
- **API base**:相对 `/api` + `VITE_API_BASE`(默认空 = Mock);Vite dev proxy `/api` → 网关 `http://127.0.0.1:10010`。端口不硬编码进源码。
- **身份**:登录存 token;每个 REST 注入 `Authorization: Bearer`,**绝不**自传 `userId`(后端取网关注入的 `X-User-Id`);access 短 TTL → 401 触发刷新 + 队列重放,失败登出。
- **包络**:单一 typed HTTP 客户端解 `{code,message,data,traceId,timestamp}`;按真实 HTTP status 分流(401 刷新 / 403 无权 / 429 退避+Retry-After / 5xx 重试降级);展示 `traceId`。
- **ID**:`userId/sessionId/messageId/redPacketId` 前端类型一律 `string`(JS Number 会损坏 snowflake 精度);Mock 数据也用 string id。

## 备选与权衡

| 选项 | 取舍 |
| --- | --- |
| Next.js | 否。HeroUI Pro 模板用 Next,但本项目是 SPA + 独立网关,无需 SSR/RSC;Vite SPA 与 agent-frontend 一致、零迁移。 |
| Redux Toolkit | 否。服务端状态交给 react-query;客户端态量小,zustand 足够,Redux 样板过重。 |
| 自研 fetch 缓存 | 否。IM 的分页/乐观/重试/失效全是 react-query 的主场,自研重复造轮子。 |
| npm workspaces 装设计系统 | 暂否(alias 替代,见上)。S2 消费时再由中枢上提。 |

## 影响
- S3 就绪后,真实联调 = 替换 `src/api` Mock 分支 + 一行 WS 握手选择,UI 不动。
- WS 客户端工程见 [ADR 0002](./0002-websocket-client.md)。
