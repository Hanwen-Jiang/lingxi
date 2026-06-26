# S2 · agent-frontend 工作计划

> 本文是 **S2 / agent-frontend 流**(`agent-frontend/` 目录)的权威工作计划。仅为规划文档,不含代码。
>
> 上游契约级出处:`docs/planning/00-master-plan.md`(决策登记 D1–D9、端口表、路线图、提交约定)。改进项编号见 `docs/planning/01-improvement-audit.md`。状态同步见 `docs/planning/STATUS.md`(S2 小节)。
>
> 子项目定位:`agent-frontend/` = **仅 agent 后端**(`agent/`,LangChain4j AI 服务)的前端 —— 一个流式聊天 + 设置的 AI 助手工作台。IM 部分是独立的 `chat-frontend/`(S4)。定位见 `agent-frontend/RENAME.md`。

---

## 1. 角色与现状

### 1.1 S2 已完成
| 项 | 状态 | 证据 |
| --- | --- | --- |
| 磁盘更名 `frontend/` → `agent-frontend/`(含 node_modules 无损迁移) | ✅ 完成 | `tsc -b` exit 0 |
| 更新引用(`.claude/launch.json` 的 `--prefix`、`package.json`/lock 的 `name`、.codex skills 路径) | ✅ 完成 | STATUS.md S2 记录 |
| 空壳 `frontend/` 处理 | ⏸ 待清理 | 目录监视句柄锁(非文件锁);留有 tombstone `frontend/README.md`;**不反复试删**,待句柄释放后一条 `Remove-Item` 即可 |

### 1.2 当前架构事实(直读源码核实)
高质量但很薄的 SPA:严格 TS、零 `any`/`@ts-ignore`、设计 token 已贴合 DESIGN.md(`--accent #006FEE`、纯黑暗色、无渐变),但**架构与产品面距生产态很远**。

| 维度 | 现状 |
| --- | --- |
| 源码文件 | 仅 5 个 `.ts(x)`:`App.tsx`、`api.ts`、`types.ts`、`main.tsx`、`vite-env.d.ts` |
| `App.tsx` | **2647 行 / ~98KB 巨石**,内含 ~40 个内联组件 + 整个数据层;无路由库、无状态库、无组件分文件 |
| 视图 | 仅 `'chat' \| 'settings'` 两个(`App.tsx:385`);AnimatePresence 切换,无 react-router |
| 鉴权 | **无**。`userId` 写死为 1(`setUserId` 从不调用);无登录、无 token、无 per-user 隔离 |
| 端点接通 | **仅 `/chat/auto/stream`** 真正在用(`sendPrompt → autoStreamChat`);所有 per-mode 端点皆死代码(见 §1.3) |
| 持久化 | 仅主题(`localStorage` key `infinitechat-theme`);`sessionId` 每次加载重置为 `Date.now()`;`apiBase`/`userId` 为只读默认 |
| 设置面风险 | **未鉴权即可改全局 LLM** provider/baseURL/model/apiKey(`POST /chat/model-config`),叠加后端通配 CORS = SSRF + 密钥外泄(B3) |
| 质量工具 | **无** ESLint / Prettier / Vitest / CI / ErrorBoundary;单点渲染错误白屏整页 |
| 设计覆盖 | 仅实现 DESIGN.md ~7 个产品面中的 ~2 个(chat + settings) |
| 构建 | `dev` 在 `127.0.0.1:5173`;`build = tsc -b && vite build`;`typecheck` clean(exit 0) |

### 1.3 api-base bug(P0 第一刀)
`agent-frontend/src/api.ts:22` 的默认 base:

```
const DEFAULT_API_BASE = "http://localhost:10010/api";   // ← BUG
```

`getDefaultApiBase()`(`api.ts:36`)已读 `import.meta.env.VITE_API_BASE_URL ?? DEFAULT_API_BASE` —— **env 注入通道已就绪,坏的只是 fallback 默认值**。`10010` 是 **chat 网关**端口(见 D1 端口表),不是 agent 直连口,也不该写死 host。正确目标:fallback 改为**相对 `/api`**,由网关在同源下把 `/api/agent|memory|rag` 路由到 agent(D1/D3),dev 期靠 Vite proxy 转发。

死端点清单(api.ts 已实现、UI 从不调用):`chat`(POST /chat)、`autoChat`、`ragChat`(/rag/chat)、`adaptiveRagChat`(/rag/adaptive/chat)、`agentChat`(/agent/chat,带 `confirmedTools[]`)、`listAgentTools`(/agent/tools)、`streamChat`(/streamChat)。CHAT_MODES(6 种)与 SLASH_COMMANDS 是装饰性的:slash 命令只把字面量 prepend 到 prompt,不切换端点。

---

## 2. 必须遵守的契约级决策(D1–D9 中与 S2 相关)

| ID | 决策要点 | S2 动作 | 依赖/串行 |
| --- | --- | --- | --- |
| **D1 端口** | 网关 `10010` 唯一对外;agent 移到 `18080`(内网经网关);agent-frontend api base 改相对 `/api` | 删 `http://localhost:10010/api` 硬默认 → 相对 `/api` + `VITE_API_BASE_URL`;Vite dev `/api` proxy | [并行] P0 立即可做 |
| **D2 统一身份** | 单一 JWT 签发 + 网关单点验签 + 下游只信注入头;model-config 需 admin | 登录页、令牌存储、`Authorization: Bearer` 注入 `api.ts request()`、真实 userId 贯通;model-config UI 加 admin 门 | [串行依赖 S1/S3 鉴权契约] P1 |
| **D3 agent 入网关** | agent 不再裸奔,前端经网关访问;请求体内 `userId` 由网关注入头替代 | 调用不再在 body/query 传 `userId`(改由后端从 `X-User-Id` 取);消费 `/api/agent\|memory\|rag` 经网关 | [串行依赖 S1] P1/P2 |
| **D4 响应包络** | 全栈统一 `{code,message,data,traceId,timestamp}`;错误映射真实 HTTP 状态;SSE schema 版本化 | `api.ts` 解包逻辑对齐新包络(现按 `code!==200` throw);消费版本化 SSE event schema;**与 S1 协调切换窗口** | [串行依赖 S1 包络落地;走版本化平滑切换] P1 |
| **D5 ID 类型** | JSON 内统一 string 化 snowflake | `types.ts` 的 id 字段从 `number` → `string`;`api.ts` query 参数停止 `number` 假设 | [串行依赖 S1 切换] P1 |
| **D8 设计系统** | 单一来源 `@infinitechat/design-system`,S4 牵头,S2 消费;infinitechat-web 不发布 | 拆巨石后,把内联 HeroUI 封装替换为 design-system 包导出;token 不再本地复刻 | [串行依赖 S4 出包] P2 |

> D6(数据边界)、D7(E2E)、D9(Snowflake)主要影响 S1/S3,S2 仅被动消费其结果。

---

## 3. 改进 backlog(S2 所有 / 共担项,一行一条)

| # | 严重度 | 标题 | 阶段 |
| --- | --- | --- | --- |
| **B2** | 🔴 阻断 | 无登录,userId 写死 1,全部调用共享用户 1 数据 → 登录 + 令牌 + Authorization + 真实 userId 贯通 | P1 |
| **B3**(前端侧) | 🔴 阻断 | 未鉴权设置面可改全局 model/baseURL/apiKey → model-config 设为 admin-only 屏,隐藏/门控该面 | P1 |
| **M2** | 🟠 主要 | `App.tsx` 2647 行巨石(~40 内联组件 + 数据层)→ 拆 feature 目录 + useChat/useSessions/useModelConfig hooks | P0 |
| **M3** | 🟠 主要 | 仅实现 ~2/7 DESIGN.md 产品面;agent/RAG/per-mode 端点死代码 → 接死端点 + 按需补产品面 | P2 |
| **M4**(前端侧) | 🟠 主要 | 无工具确认 UX → 工具确认面板(列待确认工具 → 勾选 → 带 `confirmedTools` 重调 `/agent/chat`)+ ChainOfThought/ChatTool 渲染 trace | P2 |
| **M18**(前端侧) | 🟠 主要 | 无测试/lint/CI/ErrorBoundary → Vitest + RTL、ESLint + Prettier、CI、顶层 ErrorBoundary | P0 |
| **L11** | 🟡 轻微 | 刷新不持久会话/身份;apiBase、userId 只读默认 → 持久化 lastSessionId/选中模型/apiBase,启动恢复 | P1 |
| **L12** | 🟡 轻微 | 错误/加载/空态薄;无重试;后端本地化错误串泄漏;无骨架 → 重试、内联/toast 错误、骨架、集中错误归一 | P3 |
| **L13** | 🟡 轻微 | 无 Vite dev proxy,直连 :10010 依赖通配 CORS → 加 `/api` proxy + 相对 base | P0 |
| **L14** | 🟡 轻微 | 自定义动画无 `prefers-reduced-motion` → 媒体查询 / `useReducedMotion` 关闭滑动/微光动画 | P3 |

---

## 4. 分阶段计划 P0 → P3

> 标注约定:`[并行]` = 不被他流挡,可立即开工;`[串行依赖 X]` = 必须等 X 的契约/产出落地后才动(避免一次性全断,走版本化/双读平滑切换)。

### P0 — 前端卫生 + 止损(几乎全 `[并行]`,不依赖 S1)
P0 把"几乎挡住所有其他前端改进"的巨石与缺失工具链先解决,且修掉 api-base bug —— 这些都不需要 S1 的鉴权契约。

| 任务 | backlog | 标注 | 出口判据 |
| --- | --- | --- | --- |
| 修 api base:`DEFAULT_API_BASE` `http://localhost:10010/api` → 相对 `/api`;`getDefaultApiBase()` fallback 用相对 base + `VITE_API_BASE_URL` | D1 | [并行] | 默认 build 不再写死 10010/host;env 可覆盖 |
| Vite dev `/api` proxy → agent(经网关或 dev 直连),dev 用相对 base | L13/D1 | [并行] | `vite.config.ts` 有 `server.proxy['/api']`;dev 不依赖通配 CORS |
| 拆 `App.tsx` 巨石:feature 目录(`chat/`、`settings/`、`sidebar/`、`composer/`,一组件一文件)+ 抽 `useChat`(流式/abort/乐观更新)、`useSessions`、`useModelConfig` hooks;`App.tsx` 留薄壳 | M2 | [并行] | 单文件 < ~300 行;hooks 可单测;可懒加载/code-split |
| 顶层 ErrorBoundary | M18 | [并行] | 单点渲染错误不白屏整页,降级到错误面 |
| ESLint(typescript-eslint + react-hooks)+ Prettier 配置 | M18 | [并行] | `lint` 脚本绿;格式统一 |
| Vitest + React Testing Library:**先覆盖** `useChat` 流式 / `parseSsePayload`(SSE 分块/`[DONE]`/JSON 回退)与 `api.ts` 包络解包 | M18 | [并行] | 关键纯逻辑有测试;`test` 脚本绿 |

**P0 出口**:`App.tsx` 不再是巨石;无写死 10010 的默认 base;dev 有 `/api` proxy;有 ErrorBoundary + lint + format + 关键单测;`tsc -b`/lint/test/build 全绿。**这些与 S1 完全解耦,是 S2 当前可独立推进的全部工作。**

### P1 — 登录鉴权贯通 + 持久化(`[串行依赖 S1/S3 鉴权契约]`)
P1 全部依赖 D2/D3/D4/D5 的契约定稿(JWT 形态、`Authorization` 注入约定、网关注入 `X-User-Id`、统一包络/版本化、string 化 id)。**契约未定稿前 P1 不动**,只做 P0 与 P2 中不依赖鉴权的子项。

| 任务 | backlog | 标注 | 出口判据 |
| --- | --- | --- | --- |
| 登录 UI(account-first,DESIGN.md §Auth:邮箱/密码 + 验证码用一个 segmented control,验证码走 compact 文本链接而非第二个大按钮) | B2/D2 | [串行依赖 S1] | 登录页可提交,拿到 access/refresh token |
| 令牌存储 + `Authorization: Bearer` 注入 `api.ts request()`;令牌刷新(`POST /api/v1/user/refresh`,S3 提供) | B2/D2 | [串行依赖 S1/S3] | 所有调用带 JWT;过期透明续期 |
| 真实 userId 贯通:停止 body/query 传 `userId`,改由网关注入头解析;`setUserId` 接登录态 | B2/D3 | [串行依赖 S1] | 无写死 `userId=1`;per-user 隔离生效 |
| app 进入鉴权门后;model-config UI 加 admin 门(非 admin 隐藏/禁用该面) | B3/D2/D3 | [串行依赖 S1] | 匿名/非 admin 无法改全局模型 |
| `api.ts` 解包对齐 D4 统一包络 + 真实 HTTP 状态;消费版本化 SSE schema(与 S1 协调切换窗口,避免一次性全断) | D4 | [串行依赖 S1 包络] | 401/403/404/422/429/5xx 正确分流;包络切换平滑 |
| `types.ts` id 字段 `number → string`(D5) | D5 | [串行依赖 S1 切换] | 无 Long 精度风险;query 参数不再假设数值 |
| 持久化:lastSessionId、选中模型、apiBase 入 `localStorage`,启动恢复;apiBase 设为可编辑设置项 | L11 | [并行] | 刷新不丢会话上下文;可指向非默认后端 |

**P1 出口**:一次登录的 JWT 同时被网关认证;无端点信任客户端 `userId`;匿名无法改全局模型配置;刷新保留会话/身份/apiBase。

### P2 — 接通死端点 + agent 能力可达 + 设计系统(部分 `[并行]`,部分 `[串行依赖 S1/D8]`)

| 任务 | backlog | 标注 | 出口判据 |
| --- | --- | --- | --- |
| mode 选择接端点:把 CHAT_MODES/slash 命令解析为路由调用 —— `/chat`、`/rag/chat`、`/rag/adaptive/chat`、`/agent/chat`、`/chat`(direct);不再只 prepend 字面量 | M3 | [并行(可先连本地 agent),最终串行依赖 S1 SSE 增量契约 M14] | 用户可显式强制 RAG/Agent/Adaptive/Direct;死客户端全部接通或删除 |
| 工具确认 UX:列 `/agent/chat` 返回的待确认工具 → 用户勾选子集 → 带 `confirmedTools[]` 重调;后端 confirmedTools 闸真正生效(与 S1 M4 协同) | M4 | [串行依赖 S1 M4 闸修复] | 用户可审/批工具调用;无确认不执行副作用工具 |
| 用 ChainOfThought / ChatTool 渲染 reactTrace/toolTrace(替代当前 raw JSON code block) | M3/M4 | [串行依赖 S1 M14 流式增量] | trace 结构化展示,非裸 JSON |
| 富引用渲染:展示 Citation 的 scores/page/headingPath/retrievalSource + 点击跳源文档(现仅 fileName/snippet) | M3 | [并行] | 引用面板含分数/页码/标题路径/来源 |
| RAG 文档库:列已入库文档、删除/重索引(现仅 fire-and-forget ingest + 临时 job chip) | M3/L17 | [串行依赖 S1 文档列表/删除端点] | 可浏览/管理语料库 |
| 消费 `@infinitechat/design-system`:内联 HeroUI 封装 + 本地 token 复刻 → 改为引用设计系统包 | D8 | [串行依赖 S4 出包] | token 单一来源;不再本地复刻品牌 token |
| (按需)更多 DESIGN.md 产品面:专门的 assistant/agent 工作面、记忆管理深度(edit/correct/disable/reflection)等 —— 取决于"agent-frontend 定位"拍板(见 §6) | M3 | [并行,受定位约束] | 按拍板的 IA 深度补面 |

**P2 出口**:per-mode 能力(RAG/Agent/Adaptive/Direct)从 UI 可达;工具确认闭环;trace/引用结构化;UI 出自共享设计系统。

### P3 — a11y + 错误/加载/空态 + telemetry(`[并行]`,打磨层)

| 任务 | backlog | 标注 | 出口判据 |
| --- | --- | --- | --- |
| a11y:`prefers-reduced-motion`(媒体查询 / `useReducedMotion`)关闭 AnimatedWorkspaceView/TextShimmer 等动画 | L14 | [并行] | reduced-motion 用户无滑动/微光动画 |
| 错误 UX:失败回合可重试;内联/toast 错误组件;后端本地化错误串归一(不直接泄漏) | L12 | [并行] | 失败非死路;有重试入口 |
| 加载/空态:会话/模型加载骨架与 spinner;集中错误归一在 `api.ts` | L12 | [并行] | 一致的加载/空态 |
| telemetry/analytics 钩子 | M18/新 | [并行] | 关键交互可观测 |

**P3 出口**:a11y 达 reduced-motion;失败有重试/骨架/集中归一;关键路径有 telemetry。

---

## 5. 与后端契约对齐(消费 S1 的 envelope / SSE / auth)

S2 消费的端点(经网关 `/api`,前缀 `/agent|/rag|/memory|/chat`),全部依赖 S1 落地 D3/D4/D5:

| 端点 | 方法 | 现状 | 依赖 |
| --- | --- | --- | --- |
| `/actuator/health` | GET | 在用 | — |
| `/chat/model-status`、`/chat/models` | GET | 在用 | — |
| `/chat/model-config` | POST | 在用(**B3 需 admin 门**) | D2/D3 |
| `/chat/sessions`、`/chat/sessions/{id}`、`/chat/sessions`(POST)、`/chat/sessions/{id}/summarize` | GET/POST | 在用(现 query 带 `userId`) | D3(改注入头)、D5(id string 化) |
| `/chat/auto/stream` | POST(SSE) | **唯一真接通** | D4(SSE schema 版本化) |
| `/chat`、`/chat/auto`、`/rag/chat`、`/rag/adaptive/chat`、`/agent/chat`(带 `confirmedTools[]`)、`/agent/tools`、`/streamChat` | POST/GET | **死代码,P2 接通** | M14 流式增量、M4 confirmedTools 闸 |
| `/rag/documents/{text,local-ingest,upload,jobs/{id}}` | POST/GET | 在用(ingest);**缺列表/删除** | S1 补文档库端点 |
| `/memory/write`、`/memory/user/{userId}` | POST/GET | 在用(read/write only) | 后端另有 `/memory/{correct,disable,reflection,context}`、`/agent/context` 未消费 |

**协调要点(写入 STATUS.md "交接"):**
1. **包络切换(D4)走版本化**:S1 提供旧/新包络的版本切换窗口,S2 按版本切 `api.ts` 解包,避免一次性全断。
2. **SSE event schema 显式版本化**(D4):S1 定稿 schema 版本后 S2 才动 `parseSsePayload` 消费结构。
3. **confirmedTools 闸**(M4):S1 先修后端"第二次塞 confirmedTools 即放行"的伪闸,S2 的工具确认 UX 才有安全意义。
4. **流式增量**(M14):S1 让 rag/adaptive/agent 真增量(现整段一帧),S2 的 token-by-token UI 与 trace 渲染才不假死。

---

## 6. 给其他流的交接与依赖

| 方向 | 内容 |
| --- | --- |
| **S2 依赖 S1**(挡 P1/P2) | 鉴权契约(D2/D3:JWT 形态、`Authorization` 注入约定、网关注入 `X-User-Id`)、统一包络与版本化(D4)、string 化 id(D5)、流式增量(M14)、confirmedTools 闸(M4)、RAG 文档列表/删除端点。**未定稿前 S2 只做 P0 + P2 中不依赖鉴权的子项。** |
| **S2 依赖 S3**(挡 P1) | 令牌刷新端点 `POST /api/v1/user/refresh`(统一身份签发在 chat-backend 侧)。 |
| **S2 依赖 S4**(挡 P2 设计系统消费) | `@infinitechat/design-system` 包(D8,S4 牵头:DESIGN.md 品牌 token + HeroUI Pro 封装 + verify-ui)。S2 是消费方,不复刻 token。 |
| **S2 交付/反馈** | 作为设计系统首批消费方,向 S4 反馈封装缺口;向 S1 提出前端实际需要的 SSE/包络/文档库端点形状。 |
| **待用户拍板(影响 S2 IA 深度)** | `00-master-plan.md` §10.3 / STATUS.md 待拍板 #3:**agent-frontend 定位 = 面向终端用户的产品,还是内部 admin/power 控制台**。决定 P2 §"更多产品面"的锁紧程度与 IA 深度。 |

---

## 7. 完成约定

- 改动**仅在 `agent-frontend/` 目录内**;分支命名 `feat/agent-frontend-<topic>` / `fix/agent-frontend-...` / `docs/agent-frontend-...`(见 `00-master-plan.md` §9)。
- 默认**不合并 main、不强推**;提交信息结尾按仓库惯例附署名。
- 契约级问题(端口/鉴权/包络/ID)不在 S2 自行拍板,写入 STATUS.md "待中枢确认"。
- 跨流改动(若需动他流目录)先在 STATUS.md "交接" 写明。
- 完成一个工作单元后,在 `STATUS.md` 的 **S2 小节顶部追加**一条记录(模板见 STATUS.md;字段:完成/产出物/关键决策/阻塞/交接/待中枢确认),不改他流记录。
- **空壳 `frontend/`**:记为待清理项,不反复试删,句柄释放后一条 `Remove-Item` 即可。

---
*维护者:S2(agent-frontend)。契约级出处以 `00-master-plan.md` 为准,更新需同步 `STATUS.md`。*
