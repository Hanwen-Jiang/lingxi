# InfiniteChat 状态台账(STATUS)

> **这是所有工作流唯一的异步同步点。** 开工前先读本文件;完成一个工作单元后,在自己所属小节**追加**一条记录(不要改别人的记录)。中枢据此协调、仲裁冲突、排期。

## 记录模板(复制到对应流小节顶部,最新在上)

```md
### YYYY-MM-DD · <一句话标题>
- 完成:<做了什么>
- 产出物:<路径/文件,逗号分隔>
- 关键决策:<本次自行做出的、可能影响他流的决定;无则写"无">
- 阻塞:<被什么挡住;无则写"无">
- 交接:<需要哪个流接力做什么;无则写"无">
- 待中枢确认:<需要中枢拍板的问题;无则写"无">
```

**规则:** ① 契约级决策(端口/鉴权/包络/ID/数据边界)不在这里拍板,写"待中枢确认",由中枢落到 `00-master-plan.md` 决策登记。② 改了他流目录里的东西(如跨流修复)必须在"交接"里写明。③ 提交代码遵循 `00-master-plan.md` §提交与版本约定。

---

## HUB · 规划协调中枢(owns docs/planning/)

### 2026-06-26 · 仓库重建 + 首次提交 + push
- 完成:根 `.git` 原为空/损坏,已 `git init` 重建;加根 `.gitignore`(排除 secrets/node_modules/target/dist/.artifacts 证书与日志);首提交 `099ad98`(727 文件,零密钥泄漏);创建私有仓库并推送(SSH 22 被 198.18 透明代理挡,改 HTTPS 成功)。
- 产出物:`.gitignore`;远端 **github.com/Hanwen-Jiang/lingxi(PRIVATE, main)**。
- 关键决策:默认 **私有**(可随时转公开);仓库名用新品牌 `lingxi`;`application-local.yml`/`.artifacts`/证书 JSON 一律不入库。
- 阻塞:无(SSH:22 走 198.18 代理不通——后续 git 操作用 HTTPS 远端)。
- 交接:各流 push 用 HTTPS 远端;遵循 master-plan §9 分支/提交约定。
- 待中枢确认:是否要转公开 / 改名 / 后续是否拆分子仓(默认单 monorepo)。

### 2026-06-26 · 产品定名 灵犀 / Lingxi(D12)
- 完成:产品名定为 **灵犀(Lingxi)**,取代 InfiniteChat(降为内部代号);建品牌命名表。
- 产出物:`docs/planning/02-branding.md`;master-plan §1/§5(D12)与 README 已更新。
- 关键决策:用户可见层即刻采用"灵犀/Lingxi"+助手人格名"灵犀"+Slogan;**包名/artifactId/projecta 代号先不动**(高 churn 低收益)。
- 交接:各流 UI 文案/README 顶部品牌改用"灵犀(Lingxi)";logo/wordmark 待 S4 设计系统落地。
- 待中枢确认:商标/域名查重由用户负责(见 02-branding §5)。

### 2026-06-26 · 用户决策落定(D5/D6/D7+/D10/D11)
- 完成:5 项契约级决策拍板并写入 master-plan §5/§10;向四流下发启动 prompt。
- 关键决策:分库(D6)、string snowflake(D5)、agent-frontend 终端产品(D10)、E2E 并跑+脚本化+实跑(D7+)、多设备延后/每用户游标(D11)。
- 待中枢确认:无;仅余两个非阻塞开放项(对象存储、编排目标)。

### 2026-06-26 · 规划套件完成 + 四流协调下达
- 完成:总体规划、综合改进清单、四份子项目计划全部落地;消化并仲裁了 S1–S4 四个流的最新交付;在本台账给每流写了"中枢下达"。
- 产出物:`docs/planning/00-master-plan.md`、`01-improvement-audit.md`、`10/20/30/40-*-plan.md`、`README.md`、`STATUS.md`;并把 `60-e2e-test-environment.md` 与 S3 的 `chat/docs/E2E-TESTING.md`+`chat/e2e/` 做了分层(C1 已裁)。
- 关键决策:落定 D1–D9(见 master-plan §5);确认 chat E2E 实现归 S3、系统级伞归中枢。
- 阻塞:无。
- 交接:四流按各自"中枢下达"推进;契约级破坏性变更等中枢拉齐(P1)。
- 待中枢确认:见本文件末"待用户拍板"(需用户回 5 项)。

### 2026-06-26 · 建立协调中枢 + 摸清 WSL 运行态
- 完成:对 WSL 真实部署做只读探测;产出系统级 E2E 规范、协调中枢(README/STATUS)、命名更名标记;启动总体规划+审计编写;深度跨项目分析(9-agent 工作流,已归档)。
- 产出物:`docs/planning/README.md`、`docs/planning/STATUS.md`、`docs/planning/60-e2e-test-environment.md`、`agent-frontend/RENAME.md`、`frontend/README.md`(tombstone)、`agent/docs/RENAME-NOTICE.md`、`chat/docs/RENAME-NOTICE.md`、`.artifacts/wf_extract.txt`(分析归档)。
- 关键决策:见 `00-master-plan.md` 决策登记(端口表、统一鉴权、数据边界、E2E 归属)。
- 阻塞:无。
- 交接:见各流下方"中枢下达"。
- 待中枢确认:无(中枢自身)。

---

## S1 · agent 后端(owns agent/ → agent-backend)

### 2026-06-26 · 重建 agent/docs 学习文档体系
- 完成:删旧文档地图(00-roadmap~06、project-structure v1/v2、旧 README、._ 垃圾),保留 Postman→`agent/docs/postman/`;并行 10-agent 重写 12 份文档(README+01-10 章+IMPROVEMENTS.md),15 张 mermaid,交叉链接校验无断链。
- 产出物:`agent/docs/README.md`、`agent/docs/01..10-*.md`、`agent/docs/IMPROVEMENTS.md`、`agent/docs/postman/`。
- 关键决策:文档结构按逻辑链组织(非扫类名)。
- 阻塞:无。
- 交接:IMPROVEMENTS.md 22 条作为 S1 改造 backlog,已并入 `01-improvement-audit.md`。
- 待中枢确认:**这套纯文档变更是否现在提交?**(中枢答复见下方"中枢下达 S1")。

### 中枢下达 S1(2026-06-26)
- 提交:**可提交**。纯文档、可 git checkout 找回、风险低。按 `00-master-plan.md` §提交约定:分支 `docs/agent-backend-learning`,信息 `docs(agent): rebuild learning docs + IMPROVEMENTS audit`。先提交,勿合并 main,等中枢统一拉齐。
- 下一步(P0,按依赖序):①端口默认 10010→18080(application.yml+.env.example);②补 Flyway/DDL(agent 当前零 DDL);③立刻收口滥用面:`/chat/model-config` 加 admin 校验且不收原始 apiKey、CORS 收白名单(profile 化)、`/memory/item|disable` 按主体限权。详见 `10-agent-backend-plan.md`。

---

## S2 · agent 前端(owns agent-frontend/)

### 2026-06-26 · P0-① 修 api base bug + Vite dev proxy
- 完成:`src/api.ts` 的 `DEFAULT_API_BASE` 由硬编码 `http://localhost:10010/api`(实为 chat 网关口,bug)改为**同源相对 `/api`**;`vite.config.ts` 加 `/api` dev proxy(目标 env 可配 `VITE_API_PROXY_TARGET`,默认 agent D1 口 18080);新增 `.env.example` 文档化 `VITE_API_BASE_URL`/`VITE_API_PROXY_TARGET`。`npm run build` exit 0。
- 产出物:`agent-frontend/src/api.ts`、`agent-frontend/vite.config.ts`、`agent-frontend/.env.example`。
- 关键决策:默认走相对 `/api`(prod 经网关、dev 经 Vite proxy);`VITE_API_BASE_URL` 仍可整体覆盖指向非默认后端;dev proxy 默认指 18080(D1),agent 在旧口时设 `VITE_API_PROXY_TARGET`。
- 阻塞:无(P0 与 S1 解耦)。
- 交接:S1——agent 落地 D1(18080)后 dev proxy 默认即对齐;前端按 `/api/<chat|agent|rag|memory>/...` 调用,D3 网关路由前缀需与 agent context-path `/api` 拉齐。
- 待中枢确认:无。

### 2026-06-26 · frontend → agent-frontend 更名完成
- 完成:磁盘更名完成(含 node_modules 无损迁移),`tsc -b` exit 0;更新引用:`.claude/launch.json`(--prefix agent-frontend)、package.json/lock 的 name、.codex skills 路径。
- 产出物:`agent-frontend/`(完整应用)、`agent-frontend/RENAME.md`(中枢补)、`frontend/`(空壳,见阻塞)。
- 关键决策:仅做点名的 frontend→agent-frontend;未动 agent/chat 更名(归 S1/S3)。
- 阻塞:**`E:\jhw\proj\frontend\` 空壳删不掉**——被目录监视句柄锁(疑似 Codex/Claude 预览面板,非文件锁)。需占用程序释放后才能删。过程中**停了若干遗留 dev server**(Vite 5173/5180/5182、esbuild 监视);重启用 `npm --prefix agent-frontend run dev`。
- 交接:无。
- 待中枢确认:**空壳现在再试删一次,还是先继续别的?**

### 中枢下达 S2(2026-06-26)
- 空壳:**先不要反复试删**。已留 tombstone `frontend/README.md` 解释;待用户关闭/重启 Codex 或 Claude 预览面板释放句柄后,一条 `Remove-Item` 即可。不阻塞任何工作,记为待清理项。
- 下一步(P0→P1):①修默认 API base:`agent-frontend/src/api.ts` 的 `http://localhost:10010/api`→相对 `/api`+`VITE_API_BASE_URL`(现指向了 chat 网关,是 bug);②加 Vite dev proxy;③拆 `App.tsx` 巨石(2647 行)为 feature 目录 + useChat/useSessions/useModelConfig hooks;④加 ErrorBoundary/ESLint/Prettier/Vitest。auth UI 待 S1 鉴权契约定稿后做。详见 `20-agent-frontend-plan.md`。

---

## S3 · chat 后端(owns chat/ → chat-backend)

### 2026-06-26 · 隔离式 E2E 测试环境(脚本+文档,未执行)
- 完成:摸清 WSL 原生部署(projecta-runtime,旧 jar 在跑,修复在 /mnt/e/jhw/proj/chat);设计**与线上零冲突**的隔离 E2E:库 InfiniteChat_e2e · Redis db5 · Nacos 命名空间 e2e · 独立 Kafka :9192 · 端口+100(网关10110)。用命名空间隔离(非 group),因 NettyServer 用 3 参 registerInstance 固定 DEFAULT_GROUP,只有命名空间能隔离 NettyService。顺手修了自引入回归:服务拦截器挂 /** 会 401 掉 /actuator/health,已给 5 个服务加 `excludePathPatterns("/actuator/**","/error")`,全量重编 exit 0。静态验证:5 脚本 bash -n 通过、e2e.env.example source 通过(修了 MYSQL_URL/JAVA_OPTS 引号 bug)、JSON 提取器实测、LF 换行。**未执行 01~04**(等审核)。
- 产出物:`docs/E2E-TESTING.md`(主交付,含 §9 审核清单)、`chat/e2e/{e2e.env.example,01-setup-infra.sh,02-build.sh,03-start-apps.sh,04-smoke-test.sh,99-stop.sh}`;并对 5 个服务加了 actuator 放行(代码改动)。
- 关键决策:E2E 采用**隔离并存**(不停线上)+ 端口+100 + Nacos 命名空间。
- 阻塞:无(等用户审核 §9)。
- 交接:S4(chat 前端)将依赖 chat-backend 的契约;但**当前后端缺会话列表/历史分页/好友列表/未读/浏览器可用 WS**,S4 真实联调要等这些补齐(见 `01-improvement-audit.md` 阻塞项)。
- 待中枢确认:①E2E 是否与线上同时跑;②端口段是否就用 +100;③深度场景是否脚本化;④`docs/E2E-TESTING.md` 与中枢的 `60-e2e-test-environment.md` 如何分工。

### 中枢下达 S3(2026-06-26)
- **E2E 归属与分工(仲裁):** 采纳 S3 的隔离并存方案为**chat 专项 E2E 的权威实现**。`chat/docs/E2E-TESTING.md` + `chat/e2e/` = chat 后端可执行 E2E;中枢的 `60-e2e-test-environment.md` = **系统级伞**(覆盖 agent+前端+统一鉴权的跨系统 E2E),已加一节指向 S3 实现并统一采用 +100 / 命名空间隔离约定。两者不重复、互为上下层。
- 端口段:**确认用 +100 隔离段**(网关 10110),与中枢端口表(prod:网关10010 / agent 18080)不冲突——E2E 段独立。
- 是否与线上并跑:**可并跑**(隔离设计已确保零冲突),由用户在 §9 拍板;中枢建议并跑以便对照旧 jar 行为。
- 执行:**等用户审核 §9 后再执行 01~04**(符合"先审核"约定)。
- 下一步(数据安全优先):把 IMPROVEMENTS 之外的**数据丢失级阻塞**前置——①消息持久化所有权(生产者与 outbox 同事务写 message,Offline 降为投影);②Kafka 消费者加 DLQ/ErrorHandler;③Snowflake workerId 按实例派生。这些应**先于** S4 联调。详见 `30-chat-backend-plan.md`。

---

## S4 · chat 前端(owns chat-frontend/)

### 2026-06-26 · 建立 HeroUI Pro 前端参考体系
- 完成:通读 3 个 skills(heroui-react-pro/native-pro/design-taste 78 原则)、两个 MCP(heroui-pro 135、native-pro 80)、整面 `E:\HeroUI-Pro` 镜像(21-agent 工作流,~1.96M tokens:5 指南+9 类目+62 Web+34 Native 组件文档+6 模板);产出单文件蒸馏索引。
- 产出物:`E:\HeroUI-Pro\AGENT-REFERENCE.md`(148KB/1206 行,可 grep)、镜像 README 指针、memory `heroui-pro-reference.md`。
- 关键决策:前端统一以 HeroUI Pro 为主参考(MCP→skills→镜像);工作流 list_components→get_component_docs→get_css/theme→design-taste。
- 阻塞:无;但 chat-frontend 仅有脚手架(`infinitechat-chat-frontend`),尚无真实页面。
- 交接:与 S2 共用设计系统——建议 S4 牵头沉淀 `@infinitechat/design-system`(token+HeroUI Pro 封装+verify-ui),S2 消费。
- 待中枢确认:设计系统包归属与 infinitechat-web 关系。

### 中枢下达 S4(2026-06-26)
- 设计系统:**S4 牵头**抽取 `@infinitechat/design-system`(来源:infinitechat-web/DESIGN.md 品牌 token + HeroUI Pro 封装),S2 作为消费方。infinitechat-web 降级为**不发布**的设计参考。
- 下一步(可并行不阻塞):①按 DESIGN.md IA 搭壳(home/messages/contacts/discover/assistant/settings/auth)+静态页 + 设计系统;②**真实数据联调要等 S3 补齐会话列表/历史分页/好友列表/未读 + 浏览器可用 WS 握手**——在此之前用 Mock。WS 客户端(重连/退避/离线缓冲)需与 S3 的握手改造(Sec-WebSocket-Protocol/?token=)协同设计。详见 `40-chat-frontend-plan.md`。

---

## 冲突 / 重叠登记(中枢维护)

| # | 冲突 | 涉及 | 裁定 |
| --- | --- | --- | --- |
| C1 | E2E 文档双份:中枢 `60-e2e-test-environment.md` vs S3 `docs/E2E-TESTING.md`+`chat/e2e/` | HUB,S3 | 分层:S3=chat 专项可执行实现(权威);60=系统级伞。统一采用 +100/命名空间隔离。已在 60 加指向。 |
| C2 | 空壳 `frontend/` 删不掉 | S2 | 留 tombstone,待句柄释放后删;不阻塞。 |
| C3 | agent 端口 10010 与 chat 网关 10010 冲突 | S1,S3 | prod 端口表:网关 10010、agent 18080(置于网关后);E2E 段 +100。见决策登记。 |

## 用户决策(2026-06-26 已拍板)

1. ✅ 数据边界 = **分库**(chat `InfiniteChat` / agent `agent`,不共享表,只在网关共享身份)→ D6。
2. ✅ 用户 ID = **全栈 string 化 snowflake**(expand/contract 迁移)→ D5。
3. ✅ agent-frontend = **终端用户产品**(完整消费 IA,model-config 收 admin-only)→ D10。
4. ✅ E2E = **与线上并跑 + 深度场景脚本化 + 现在实跑** → D7 补充;S3 可立即执行 01→04。
5. ✅ 多设备 = **延后**(每用户已读游标,单设备首版)→ D11。

仍开放(非阻塞):对象存储 prod(COS vs S3/MinIO)、编排目标(compose-on-VM vs k8s)、空壳 `frontend/` 删除时机(待句柄释放)。
