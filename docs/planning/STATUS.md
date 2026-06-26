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

### 2026-06-26 · ★1 premise 纠正 + S1↔S3 契约仲裁 + greenlight chat-common
- **★1 premise 作废(中枢致歉,S3 复核正确):** 线上 `projecta-current` 跑的是 **pre-P0 无鉴权旧分支**(`dc9c8e3`,无 AuthGlobalFilter/AuthContextInterceptor,网关对 no-token 与 garbage-token 均 200)。**不是 jjwt×JDK21 崩溃**——那条验签路径只在带鉴权的 main/E2E 才有。故"给线上 4 jar 加 jaxb 重建"是空操作。线上真实状态=**完全无鉴权**(原始 P0 安全洞,但它是 WSL 开发运行态,非公网生产)。**是否把 main 全量 P0 部署上线=行为变更,待用户拍板**(中枢正在 AskUserQuestion)。S3 未擅动线上、已开 P1 worktree——正确。
- **S1↔S3 契约仲裁(两流照此对齐,避免各造一套):**
  1. **角色头 = `X-User-Roles`**(csv,含 `admin`),由网关注入。S1 提案采纳;S3 网关按此注入。
  2. **agent 定位 = 只消费网关注入头,不自验/不签发 JWT** → **agent 不需要 `JWT_SECRET_KEY`**;只有网关 + 各 chat 服务 + Auth 签发方持有同一密钥。确认 S1 P1-① 的定位。
  3. **错误码归一 = chat-common 为准**:S3 在 chat-common 定义错误码枚举 + Result 形状,**S1 对齐编号**(别两套)。S1 暂勿定死自己的 ErrorCode 编号,等 chat-common。
  4. **包络** `{code,message,data,traceId,timestamp}` 确认(S1 已加加法半);**真实 HTTP 状态(停 200)= 版本化一次性翻,S1/S3 同步翻、翻前在 STATUS 通知 S2**(防中途断)。
  5. **enforce-identity 翻 true 时机**:待 S3 网关 `/api/agent|memory|rag` 路由 + 验签就绪后,S1 翻 `AGENT_GATEWAY_ENFORCE_IDENTITY=true` 并验拒直连。
- **greenlight S3 chat-common(P1 unit 2)**:正确的 P1 首件,解锁 S1。包名/是否一并接 6 服务由 S3 定;把上述 1/3/4 的头名/错误码/包络作为 chat-common 的公开契约导出。
- 产出物:本条(STATUS);契约要点将择机并入 master-plan §5(D2/D3/D4 澄清)。
- 阻塞:无。
- **用户已拍板(defer):线上暂不动**(保持 pre-P0 无鉴权开发基线);**P1 整合检查点**(统一鉴权落地 + 前端可登录后)由中枢协调一次性把 main 部署上线并重启。**★1 对 S3 撤销**(不动线上)——S3 继续 chat-common 及 P1 其余单元。线上"无鉴权"为已知且被接受的风险(WSL 开发态、非公网)。

### 2026-06-26 · 第一轮收口:用户拍板 4 决策 + P0 整合入 main + 进入 P1
- 完成:用户拍板——①线上 jjwt 修复**现在同步并重启线上**;②**中枢收拢并合入 main**;③HeroUI Pro 用 **hpsetup + token**(已写回 `E:\HeroUI-Pro\HEROUI-PERSONAL-TOKEN.md`,勿删);④**Greenlight P1**。中枢已把四流 P0 全部整合入 `main`(539c9e5,零冲突,已 push):agent-backend(端口/止损/Flyway)+ agent-frontend(拆巨石/工具链)+ chat-frontend(设计系统/壳)+ chat-backend(jaxb-api jjwt 修复+E2E)。删除 stray 分支 `feat/agent-frontend-p0-foundation`。
- 关键决策:认可 S3 的 **jaxb-api** 方案(优于升级 jjwt0.11);设计系统包 P1 **上提为根级共享包**供 S2 消费(S4 牵头)。
- 阻塞:无。P0 四流全绿、已并入 main。
- 交接:**下一轮从 main 起新分支**(每流独立分支,建议各自 git worktree 避免再缠);S3 为 P1 关键路径(网关纳入 agent + 统一 JWT + chat-common 解锁 S1;客户端 API 解锁 S4)。四流 P1 prompt 已下发。
- 待中枢确认:线上 jjwt 部署结果由 S3 跑完贴回。

### 2026-06-26 · 中枢实跑 chat E2E 冒烟(交接 S3 修复)
- 完成:用户已建隔离库(方式 A);但 S3 已把 `01-setup-infra.sh` 改为**自带 :3308 MariaDB**(无需 sudo/共享库授权,方式 A 现已无关)。中枢续跑 01→03→04:01 ✅(:3308,InfiniteChat_e2e 14 表;Nacos ns e2e;Kafka :9192)、02 已构建、03 起 7 服务、04 冒烟一次 **PASS=7 / FAIL=1**。
- 关键发现(交接 S3,均属 chat-backend 域,中枢不代改其代码):
  1. **T2(真实缺陷):** 健康态下 T1 无令牌→401 正常,但 **T2 畸形 JWT(`garbage.token.x`)→ 000(连接被重置)而非 401**。`AuthGlobalFilter` 解析非法 JWT 抛异常未兜底 → 应 catch(Malformed/Signature 等)统一返 401。
  2. **T8 → T9–T11 被跳过:** 登录返回了 token,但冒烟脚本 `jnum userId` 取空(userId 按 D5 应为 **string 化** id 或字段名不符)→ 跳过了核心鉴权用例(带 token 放行 / 越权 403 / 伪造 X-User-Id 剥离)。修脚本用 `jstr userId` 并确认登录 JSON 形状后重跑,才能真正验到 T9–T11。
  3. **关停期噪音(低优先):** GateWay 关停时报 `ClassNotFoundException: ch.qos.logback.core.util.ContextUtil` 与 `reactor...MonoWhen$WhenCoordinator`,属 fat-jar 关停期类加载噪音,非冒烟失败主因;S3 可顺带确认依赖打包无碍。
- 产出物:无(只读跑脚本;未改 S3 代码)。E2E 服务当前已停(收到 shutdown hook,:10110 DOWN)。
- 阻塞:无。
- 交接:**S3** 修 T2(网关 401 兜底)+ T8(脚本/登录 userId 形状),重跑 01→04 把 T9–T11 跑绿;完成后在 S3 小节记录。中枢可在 S3 修好后再帮跑一轮验证。
- 待中枢确认:无。

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

### 2026-06-26 · P1-① 入网关身份(expand 相)+ 包络 traceId 加法
- 完成:P1 身份基础落地,**分支 `feat/agent-backend-p1-identity`(已 push origin,commit `9133ee5`,从 main ee8d4fb 起)**。
  - **GatewayIdentityFilter**:信任统一网关注入的 `X-User-Id`(+ `X-User-Roles`),解析为 `AuthPrincipal` 挂请求属性;`@CurrentUser` + `CurrentUserArgumentResolver`(经新 `WebConfig` 注册)。
  - **AiChat / Agent / Memory 控制器**:userId 一律经 `principal.resolveUserId(bodyUserId)`——**网关身份在场则忽略 body/param userId**(IDOR 闭环),否则回退 body(过渡)。`/memory/*`、`/agent/chat`、`/agent/tools/audit`、`/chat`、`/streamChat` 已接。
  - **model-config**:改为认可网关注入的 **admin 角色**;P0 的 `X-Admin-Token` 降为过渡回退(网关上线后移除)。
  - **包络加法(D4 非破坏半)**:`BaseResponse` 加 `traceId`+`timestamp`(构造时自动填充);新 `TraceIdFilter` 设 `X-Trace-Id`(进出)+ SLF4J MDC。
  - 8 个单测绿(`AuthPrincipal` 解析 + `GatewayIdentityFilter` 五场景:permissive/enforce-401/合法/公开路径/非法 id);离线 `mvnw compile` 绿。
- 产出物:新 `agent/.../security/{AuthPrincipal,CurrentUser,GatewayIdentityFilter,CurrentUserArgumentResolver}.java`、`common/TraceContext.java`、`monitor/TraceIdFilter.java`、`config/WebConfig.java`、test ×2;改 `common/BaseResponse.java`、`controller/{AiChat,Agent,Memory,ChatHistory}Controller.java`、`application.yml`、`.env.example`。
- 关键决策(expand/contract,可回滚):`agent.gateway.enforce-identity` **默认 false**——网关尚未 front agent 前不破直连、保留 body userId 回退;**contract 相**(硬 401 拒直连 + 删 body userId + 真实 HTTP 状态停 200)等 S3 网关上线后翻 flag,**未定死**。`X-User-Roles` 头名与包络/错误码均为 S1 提案,待对齐。**未 sweep**:ChatHistory `/sessions`、Rag、Auto 的 body userId(下一单元)。
- 阻塞:无(本单元自洽隔离;contract 相翻 flag 串行依赖 S3)。
- **待 S3 拉齐(已按"可对接"建,确认后才翻 contract):**
  1. **网关注入头契约**:`X-User-Id` 已证(T9/T11);请确认**角色头**——我提案 `X-User-Roles`(csv,含 `admin`)。若 S3 用别的(`X-User-Role`/JWT claim 透传),我一行改 `ROLES_HEADER`。
  2. **`/api/agent|memory|rag` 网关路由 + 验签到位** → 我翻 `AGENT_GATEWAY_ENFORCE_IDENTITY=true` 并验拒直连(伪造 `X-User-Id` 被网关剥离,同 T11)。
  3. **chat-common 错误码表**:我已实现 `{code,message,data,traceId,timestamp}` 形状,但错误码**暂沿用 agent 现有 `ErrorCode`(40xxx/50xxx…)**;给我 chat-common 错误码枚举,我对齐编号(别两套)。**真实 HTTP 状态映射(停 200)**等包络定稿后版本化一次性翻(避免 S2 中途断)。
  4. **JWT**:agent **只消费网关注入头、不自验/不签发 JWT**,故 agent 侧暂不需要 `JWT_SECRET_KEY`。请确认此定位(若要 agent 旁路直验 JWT 再取 secret)。
- **交接 → S2(解锁登录 UI 的鉴权契约):**
  - **agent 不签发 token**。登录走 chat 的 Auth(S3)拿 JWT;调 agent 经统一网关,网关验签后注入可信 `X-User-Id`(+`X-User-Roles`)。**前端不要自己塞 `X-User-Id`**(网关会剥离伪造值)。
  - **过渡期**(`enforce-identity=false`,网关未 front agent):前端可继续在 body 带 userId(现状不变),agent 回退用它;**翻 enforce 后 body userId 被忽略并最终移除**——前端尽早转向"靠网关注入身份、不传 userId"。
  - **统一包络**:成功/失败响应均含 `code/message/data/traceId/timestamp`;`traceId` 同时在响应头 `X-Trace-Id`(可用于报错上报)。**真实 HTTP 状态(401/403…)尚未翻**(除网关身份 401),目前仍"200 + 体内 code"——前端先按 `body.code` 解析;切换前我再交接版本化节奏。
  - **model-config**(D10 admin 屏):需 admin 角色(网关注入)或过渡 `X-Admin-Token`;不接受/不回显 `apiKey`。
- 待中枢确认:① 何时翻 `enforce-identity=true`(待 S3 网关 front agent + 路由就绪)。② 错误码归一:agent `ErrorCode` vs chat-common 谁为准。③ 真实 HTTP 状态翻转的版本化节奏(防 S2 中途断)。

### 2026-06-26 · P0 落地:端口 18080 + 止损三件套 + Flyway 基线 DDL
- 完成:P0 三单元全部落地并提交,**分支 `feat/agent-backend-p0-hardening`(已 push origin,3 commits)**。
  - ① 端口:`SERVER_PORT` 默认 `10010→18080`(application.yml + .env.example);docs/postman/README 内 `10010` 全刷 `18080`(仅 `RENAME-NOTICE.md` 保留为迁移记录)。commit `843dfc0`。
  - ② 止损:CORS 去 `*`+credentials 改 env 白名单(默认 localhost:5173/5180,凭据默认关、含 `*` 强制关);`/chat/model-config` 加管理员闸(header `X-Admin-Token`,未配 `AGENT_ADMIN_TOKEN` 则 fail-closed 关闭该端点)+ 丢弃请求体原始 `apiKey`(只用 env key)+ 审计日志;`/memory/item|disable` 加 `userId` 归属校验(非属主按 404,堵猜 memoryId 越权)。commit `85e5319`,离线 `mvnw compile` 绿。
  - ③ Flyway:引入 `flyway-core`+`flyway-mysql`(BOM 版本),`db/migration/V1__agent_baseline_schema.sql`(5 张 MySQL 元数据/记忆/审计表,镜像现有 SchemaInitializer,全 IF NOT EXISTS)+ `db/pgvector/V1__pgvector_embedding_store.sql`(PgVector 表版本化事实来源)+ `db/README.md`。`spring.flyway.enabled=${FLYWAY_ENABLED:false}` **默认关**。commit `b927a00`,在线 `mvnw compile` 绿(依赖解析通过)。
- 产出物:`agent/{pom.xml,.env.example}`、`agent/src/main/resources/{application.yml,db/migration/V1__*.sql,db/pgvector/V1__*.sql,db/README.md}`、`agent/src/main/java/.../config/CorsConfig.java`、`.../controller/{ChatHistoryController,MemoryController}.java`;远端分支 `origin/feat/agent-backend-p0-hardening`。
- 关键决策(自行做出、可能影响他流):
  - **用 git worktree 隔离开干**:开工时主 checkout 在 `feat/chat-frontend-design-system-shell` 且工作树有 S2/S4 未提交改动,在其上切分支会破坏他流在途工作 → 从 `main` 拉独立 worktree(`E:/jhw/proj-agent-p0`),全部改动只落 `agent/`,主 checkout 与他流改动零扰动。
  - **Flyway 默认关闭**:本应用只有一个 DataSource(`ragDataSource`,Spring 自动 DataSource 因 `@ConditionalOnMissingBean` 退避),且带 H2 降级;MySQL 方言基线在 H2 会崩,故仅在连得到真实 `agent` MySQL 时由 `FLYWAY_ENABLED=true` 开启,默认关以保"本地无中间件也能起"。
  - **止损均为过渡机制**:`X-Admin-Token`、`/memory` 的 `userId` 归属校验都是 P0 临时闸,P1 网关身份闭环后由可信 `X-User-Id` + admin 角色取代。
- 阻塞:无(P0 全部自洽、隔离,无需他流前置)。
- 交接 → S3:① agent 现默认 `18080`;P1 网关需加 `/api/agent|memory|rag` 路由并纳入验签 + 共用同一 `JWT_SECRET_KEY`,agent 才能入网关拒直连(B1/M17 闭环,我已备好 `GatewayIdentityFilter` 的落点)。② Flyway 与 S3 `chat-common` 的 Flyway 约定需对齐后再退役 agent 的 SchemaInitializer(见下"待中枢确认")。③ docker-compose 的 `agent` MySQL 库建库需 `utf8mb4`。
- 交接 → S2:① agent 端口 `18080`(内网,前端走相对 `/api` 或经网关,勿再指 10010)。② CORS 现为白名单,默认仅 `localhost:5173/5180`;若 agent-frontend dev 端口不同需配 `AGENT_CORS_ALLOWED_ORIGINS`(或用 Vite proxy 走同源,CORS 即不参与)。③ `/chat/model-config` 现需 `X-Admin-Token` 且不再接受/回显 `apiKey`——与 D10「model-config 收为 admin-only 屏」对齐,前端按 admin 能力设计。
- 待中枢确认:① **Flyway 默认 off→何时翻 on**:docker-compose 落地后是否由 compose 设 `FLYWAY_ENABLED=true`,以及 compose 的 `agent` MySQL 库初始化(charset/创建)归谁(S1 还是基建伞)。② **SchemaInitializer 退役时机**:P1 是否统一退役三个 `*SchemaInitializer`、改 Flyway 单一所有权,与 S3 `chat-common` 对齐。③ **model-config 的 P0 admin 令牌**是否够用过渡,还是直接等 P1 上网关 admin 角色(当前未配 token 即该端点关闭,不影响普通链路)。

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

### 2026-06-26 · P1 单元 1 · 接入 @infinitechat/design-system + 灵犀品牌通刷
- 完成:从 main(ee8d4fb)起新分支 `feat/agent-frontend-p1-auth` 并 push origin(HTTPS)。① 通过 Vite alias + tsconfig path 接入 S4 设计系统包(在 `chat-frontend/packages/design-system`,不动包位置,与 S4 同方案),styles.css 只镜像 `--lx-*` 私有品牌 token(避免覆盖现有 HeroUI 语义层)。② 替换 P0 临时基元为 ds 原语:`ErrorBoundary` 用 `<ErrorState>`+`<LingxiGlyph>`(中文品牌降级卡)、空对话用 `<EmptyState>`(灵犀字符 + Slogan)、侧栏 logo 用 `LingxiGlyph`。③ 按 D12 全量品牌通刷可见层:`InfiniteChat`→`灵犀`,`<title>灵犀 · Lingxi</title>`,中文文案("和灵犀聊聊 / 懂你的,不只是消息" / "在线/连接中/离线" / "灵犀已就绪/灵犀还没接上模型" / "灵犀会根据你的问题..." 等),所有 aria-label/placeholder/tooltip 中文化。④ 收敛内部状态外泄:assistant 状态 chip 仅 error 时显示("出错了"),routeLabel/modeLabel fallback 中文化,useModelConfig 不再泄露后端原始错误串。⑤ 顺手:删除 `frontend/README.md` tombstone(watcher 已释放);修 `.claude/launch.json` 让 preview 用绝对 node 路径起 vite。**5 大门全绿**:tsc/lint/prettier/test(12)/build exit 0;**预览实测**:`englishLeak: []` 用户可见层零英文残留(技术字段如 API base / User ID 在 admin 区,P1 单元 3 处理)。提交 09a8108(已 push)。
- 产出物:`agent-frontend/{vite.config.ts,tsconfig.json,index.html,styles.css}`、`src/{components/ErrorBoundary,features/chat/*,features/settings/SettingsWorkspace,features/sidebar/GlobalSidebar,hooks/useModelConfig,lib/{chat,constants}}.{ts,tsx}`;`.claude/launch.json`;删除 `frontend/README.md`。
- 关键决策:**ds tokens.css 不整套导入,只镜像 `--lx-*`**——agent-frontend 走完整 HeroUI Pro 链(`@heroui/styles/css`+`@heroui-pro/react/css` 已经在用),整套导入会与 P0 校准好的 HeroUI 语义层冲突(双重 `--background`/`--surface` 等),且 ds light bg `#fafafa` 与 HeroUI 默认 `oklch(0.9702 0 0)` 不一致。改 styles.css 顶部追加 `--lx-*` 一段,源点跟 ds tokens.css 同步;真实 HeroUI Pro 工件到位后无需 token 改动。
- 阻塞:无(单元 1 与 S1/S3 解耦)。
- 交接:S4——agent-frontend 已是 ds 首批消费方,如 S4 后续要把 ds 上提为 root monorepo 包,我侧 alias 直接换 `peer dep import` 即可(零代码改动)。S1/S3——单元 2(登录 UI + token 管线 + Authorization 注入)与单元 3(model-config admin 门控)等 D2/D3 鉴权契约定稿后接通;未定稿前先搭壳。
- 待中枢确认:**无**(单元 1 完全自洽);单元 2/3 等 S1 P1 鉴权契约。

### 2026-06-26 · UI 打磨:设置下拉改用 HeroUI Select
- 完成:设置/模型配置面板的 Provider、Reasoning effort、Memory type 三个下拉由 HeroUI Pro `NativeSelect`(渲染原生 `<select>` → 浏览器原生弹层、无主题)改为 HeroUI `Select`(主题化弹层 + ListBox + 选中指示)。受控 `value`/`onChange`;标签用匹配的 field span + `aria-label`(避免把 Select 的 button trigger 包进 `<label>` 致弹层双触发)。tsc/lint/build exit 0,src 内已无 NativeSelect。提交 298dc2f。
- 产出物:`agent-frontend/src/features/settings/{ModelConfigPanel,MemoryPanel}.tsx`。
- 关键决策:用 OSS `@heroui/react/select`+`/list-box`(待 D8 设计系统出包后再对齐封装);`.native-select` 死 CSS 暂留。属 D10 admin-only 屏。
- 阻塞:无(预览 headless 难驱动 offcanvas 侧栏导航,未截到打开态;靠 build 绿 + 规范 compound 用法确认)。
- 交接:无。
- 待中枢确认:无。

### 2026-06-26 · P0-③ ErrorBoundary + ESLint/Prettier/Vitest + 持久化
- 完成:① 顶层 `ErrorBoundary`(灵犀 品牌化降级卡 + Reload)包住 `<App/>`;② ESLint flat config(typescript-eslint+react-hooks+react-refresh+eslint-config-prettier)+ Prettier(对齐既有风格)+ lint/format 脚本 + 首次全仓 prettier;③ Vitest+RTL,12 测试(parseSsePayload / api 包络解包 / useChat 流式+onSettled),`parseSsePayload` 导出;④ 持久化 apiBase + lastSessionId 到 localStorage(`lingxi.*` 键,try/catch 守卫),启动恢复上次会话(不存在则优雅降级)。tsc/lint/format:check/test/build 五项 exit 0;dev 实跑:mount 于 boundary 下、localStorage 写入 apiBase+lastSessionId 已验。提交 4438bdc。
- 产出物:`agent-frontend/{eslint.config.js,.prettierrc.json,.prettierignore}`、`src/components/ErrorBoundary.tsx`、`src/lib/storage.ts`、`src/test/setup.ts`、`src/{lib/sse,api,hooks/useChat}.test.*`,改 `main.tsx`/`App.tsx`/`api.ts`/`vite.config.ts`/`package.json`。
- 关键决策:vitest 钉 ^3 / jsdom ^25(本机 Node 20.15.1 上 vitest4/jsdom29 崩溃);eslint `react-hooks/set-state-in-effect` 关闭(v7 React-Compiler 规则,误报既有合法 prop→state/响应式 reset,带注释);未用 eslint-disable/any/@ts-ignore 掩盖。**P0 三单元全部完成(87d7388/ccc950b/4438bdc)。**
- 阻塞:无。
- 交接:无。
- 待中枢确认:无。

### 2026-06-26 · P0-② 拆 App.tsx 巨石(2647→132 行)+ hooks
- 完成:把 2647 行 `App.tsx` 巨石(~40 内联组件 + 整个数据层)拆为 feature 目录 + hooks(26 文件):`lib/`(constants/format/chat/model)、`hooks/`(useChat/useSessions/useModelConfig/useIngestion/useMemory/useMediaQuery/useColorScheme)、`features/`(sidebar、sessions、chat[ChatHeader/MessageTimeline/ComposerDock/ComposerActionsPopover/ModelPicker/ModelPickerMobile]、insight、settings[SettingsWorkspace/ModelConfigPanel/IngestionPanel/MemoryPanel])、`components/`(AnimatedWorkspaceView、ui primitives)。`App.tsx` 留 132 行薄壳(组合 5 hooks + 渲染);api.ts 加 `ApiClient`、types.ts 加 `ChatStatus`。`tsc -b`+`npm run build` exit 0;dev 实跑 mount/渲染无控制台错误、无 vite error overlay。提交 ccc950b。
- 产出物:`agent-frontend/src/{lib,hooks,features,components}/*`,改 `App.tsx`/`api.ts`/`types.ts`。
- 关键决策:用 workflow(1 实现 + 3 对抗式 review)产出;**纠正了我自己 spec 的一处错误**——原令 jobs/memory 内化进 SettingsWorkspace,被 review 抓到两处回归(① chat composer 上传不再进 Ingestion 面板;② SettingsWorkspace 随 view 切换卸载致 jobs/memory 重置),已改为 App 级 `useIngestion`/`useMemory` hook 还原原行为+跨视图持久。另修 3 处 hook 微瑕。纯重构,行为 100% 保留。
- 阻塞:无。
- 交接:无。
- 待中枢确认:无。

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

### 2026-06-26 · P1 启动 + ★1 复核:线上跑的是 pre-P0 旧分支(无鉴权),jjwt 崩溃前提不成立
- 完成:从 main 开 `feat/chat-backend-p1` worktree(`E:/jhw/proj-chat-p1`)。执行★1前先复核线上运行态,**发现前提与实际不符**:
  - 线上 `~/projecta-current/chat` 在分支 `dc9c8e3 "fix chat build config and auth"`(原始基线),**无 `AuthGlobalFilter`、无 `AuthContextInterceptor`**;网关 jar 为 2026-06-16 旧构建。
  - 线上网关实测(经 10010):无 token → **200**、garbage token → **200**。即线上是**原始"网关不鉴权"态**——不校验 JWT,故**根本不触发 jjwt×JDK21 崩溃**(验签路径只在 P0 的 `AuthGlobalFilter` 里,仅 main/E2E 有)。
- 关键结论:★1 字面动作(给线上 4 jar 加 jaxb 重建)对当前线上是**空操作**(无验签路径可修)。线上真问题是**仍无鉴权**(原始安全洞)。让线上变安全 = 把 main 整套 P0(AuthGlobalFilter+各服务拦截器+BCrypt+jaxb)部署到 `projecta-current` 并重启 → 这是**更大的部署 + 行为变更**(开始强制鉴权,未带有效 JWT 的客户端会被 401),且 `projecta-current` 当前在别的分支。
- 阻塞:**★1 等中枢拍板**——是否授权把 main 的 P0 全量部署到线上(切/合 main→全量重建→重启 7 服务)?会让线上开始强制鉴权,可能打断仍在开发、未带 JWT 的前端联调。我**不擅自**切线上分支/改鉴权行为。
- 交接:无。
- 待中枢确认:① 确认线上=pre-P0 无鉴权旧分支(非 jjwt 崩溃);② 是否授权全量部署 P0 到线上(行为变更),还是线上留待正常合并流水线后再部署?**期间我在 worktree 内推进 P1 代码单元(从 chat-common 起,E2E 验证,不动线上)。**

### 2026-06-26 · E2E 01→04 实跑全绿(11/11)+ 发现并修复关键线上鉴权 bug(jjwt×JDK21)
- 完成:E2E 隔离栈跑通,**冒烟 11 条断言全 PASS**:T1 网关挡无令牌→401 · T2 挡无效令牌→401 · T3 actuator 不被拦→200 · T4 直连业务服务无凭证→401 · T5 RTC 无内部令牌→401 · T6 带内部令牌→200 · T7 注册(BCrypt)→200 · T8 登录签发 JWT · T9 带 token 受保护接口→200(网关注入 X-User-Id+服务信任)· T10 越权(以他人 userId 发动态)→403 · T11 伪造 X-User-Id 被网关剥离覆盖→按 token 用户处理。**即:网关统一鉴权 / BCrypt / 操作人收敛 / 内部令牌 / actuator 放行 全部线上实测通过。**
- 🔴 **发现并修复关键 bug(波及线上):jjwt 0.9.1 在 JDK 21 上验签全崩**。`javax.xml.bind.DatatypeConverter` 在 JDK 11+ 已从 JRE 移除 → jjwt 0.9.1 验签任意 token 抛 `ClassNotFoundException` → 网关/RTC 验签连接重置(curl 000)。E2E 实测:无 jaxb 的旧 jar 在 JDK21 上任意 token 即崩;**线上 `projecta-current` 是同样的旧 jar 跑在 JDK21,故线上网关鉴权存在同一 P0 缺陷**(任何带 token 请求都会崩)。修复:给 4 个用 jjwt 的服务(GateWay/Auth/RTC/Messaging)加 `javax.xml.bind:jaxb-api:2.3.1`(自带 DatatypeConverter 实现,**零代码改动**)。修复后 T2/T9/T10/T11 由 000 转绿。
- DB 阻塞自行解阻(不需线上 DB 管理员/sudo):改起 **E2E 专属 MariaDB 实例 `:3308`**(`mariadb-install-db` 私有 datadir,归当前用户;AppArmor 在本 WSL 为 N 不拦)→ 隔离比共享线上库更彻底。`e2e.env` 的 MYSQL 指向 3308 + 用户 `e2e/e2e`。
- E2E 健壮性修复:① 服务改用 **`setsid`** 启动(否则 wsl 命令退出时整组被 SIGTERM,nohup 只挡 SIGHUP,导致服务在我命令结束后被杀);② 冒烟脚本改从 **JWT `sub`** 取 userId(发现既有 bug:`LoginResponse.userId` 恒为 null,真实 id 在 token sub)。
- 产出物:`chat/{GateWay,AuthenticationService,RealTimeCommunicationService,MessagingService}/pom.xml`(+jaxb-api)、`chat/e2e/{01-setup-infra,03-start-apps,04-smoke-test}.sh`、`chat/e2e/e2e.env`(gitignored)。
- 关键决策:jjwt×JDK21 用 **jaxb-api** 修(保守、不改密钥)而非升级 jjwt 0.11(后者要求 HS512 密钥 ≥64 字节,可能破坏线上现有短密钥)——此为运行期兼容 bug fix,非契约级。
- 阻塞:无。
- 交接 → 中枢/部署:**jaxb-api 修复需尽快重建并部署到线上**(否则线上 JDK21 上鉴权一用即崩);顺带核对线上 `JWT_SECRET_KEY` 长度。深度链路(好友→发→离线拉→已读、红包并发、群权限)脚本化为下一单元。
- 待中枢确认:① 认可 jaxb-api 方案(vs 升级 jjwt 0.11)? ② 线上"JDK21 上 jjwt 验签崩"是否已知?是否需要我把该修复同步到线上构建(projecta-current/runtime)?

### 2026-06-26 · E2E 实跑启动:构建 ✅ + DB 管理员权限阻塞
- 完成:按中枢下达开跑 `chat/e2e/` 01→04。①填好 `e2e.env`(E2E 专用 `JWT_SECRET_KEY`/`INTERNAL_SERVICE_TOKEN`);②middleware 探活在线(MariaDB 3307 / Redis 6379 / Nacos 8848 / Kafka 9092);③**`02-build.sh` 构建成功**——rsync 修复源码 `/mnt/e/jhw/proj/chat`→`~/projecta-e2e/chat` 后 `mvn package`,7 服务 jar 全部 `BUILD SUCCESS`(9.9s,WSL 仓库已热);④硬化 `01-setup-infra.sh`:建库+授权改用管理员账号(`E2E_DB_ADMIN_USER`/`E2E_DB_ADMIN_PASSWORD`,默认回退应用账号),建库后 `GRANT` 给应用账号。
- 产出物:`chat/e2e/e2e.env`(gitignored)、`chat/e2e/01-setup-infra.sh`(改:管理员建库+授权);E2E jar 在 `~/projecta-e2e/chat/*/target/`。
- 关键决策:无(契约级未动)。
- 阻塞:**建 `InfiniteChat_e2e` 需 MariaDB 管理员权限**——运行账号 `infinite_chat` 仅授于 `InfiniteChat` 库,无 `CREATE DATABASE`(实测 `ERROR 1044`);runtime env 仅含受限账号;`root` 需 socket/sudo(不可非交互)。需用户/中枢二选一:① 导出 `E2E_DB_ADMIN_USER`/`E2E_DB_ADMIN_PASSWORD` 后我重跑;或 ② 以管理员执行 `CREATE DATABASE InfiniteChat_e2e DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci; GRANT ALL ON InfiniteChat_e2e.* TO 'infinite_chat'@'%'; FLUSH PRIVILEGES;`。**解阻后自动续跑 01(剩余步骤)→04 + 深度场景脚本化**。
- 交接:无。
- 待中枢确认:E2E 数据库管理员授权方式(见阻塞)。

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

### 2026-06-27 · 设计系统上提根级 workspace ✅ + 装真实 HeroUI Pro 工件 ✅(P1-1/P1-2)
- 完成:① **上提完成**——`@infinitechat/design-system` 现为仓库**根级** workspace 包(新增根 `package.json` `workspaces:["packages/*","chat-frontend"]`,包在 `packages/design-system`);chat-frontend 经 workspace 依赖 + Vite alias 消费,build/verify 绿;`agent-frontend` **未动**(S2 就绪再纳入)。② **真实 Pro 工件落地**——`hpsetup@4.7.0` + `HEROUI_PERSONAL_TOKEN`(hp_…,token 在 `E:\HeroUI-Pro\HEROUI-PERSONAL-TOKEN.md`,未入库)替换公共镜像 stub:真实 `@heroui-pro/react@1.0.0-beta.6`(含 `dist/css`/`exports`/组件子路径)装入**根** `node_modules`(monorepo 检测→hoisted,chat-frontend 与设计系统共享);并装 20 个 Pro peer(recharts/react-aria-components/tiptap/embla/shiki/streamdown/react-resizable-panels…)。③ **CSS 改回 HeroUI 自有 token 体系 + 品牌覆盖**:`tailwindcss → @heroui/styles/css → @heroui-pro/react/css → tokens.css(品牌覆盖,最后)`;tokens.css 瘦身为只覆盖品牌关键项(`--accent #006FEE`、亮 `--background #FAFAFA`、暗 `--background #000`、`--lx-*`),surface/muted/separator/foreground 用 HeroUI 真值——**与 agent-frontend 校准一致**(D8 单一设计系统两端同款)。**P0 关于「@heroui/styles 是 stub」的结论作废**:其 `dist/index.css` 用 `@import` 分层加载真实 token,是完整 OSS 体系。
- 产出物:新增根 `package.json` + 根 `package-lock.json`;`git mv` `chat-frontend/packages/design-system`→`packages/design-system`;改 `chat-frontend/{package.json(+workspace dep +20 peers),vite.config.ts,tsconfig.json,src/styles.css}`、`packages/design-system/src/styles/tokens.css`、`.../scripts/verify-ui.mjs`(扫描路径 repo-root 相对)、`.claude/launch.json`(chat-frontend preview 改用 nvm node + 根 vite,旧 `npm` 入口在本机 nvm 下 ENOENT)。分支 `feat/chat-frontend-p1`。
- 关键决策(自行做出):根 workspace 只纳入 `packages/*`+`chat-frontend`(agent-frontend 暂不入,零扰动 S2);token 改为「HeroUI 自有 + 品牌覆盖」(放弃 P0 自给 token,换取与 S2 一致 + 真实 Pro/OSS 组件 BEM 可用)。
- 阻塞:无(已解 P0 的 stub 阻塞)。
- 交接 → **S2**:设计系统在根 `packages/design-system`(`import "@infinitechat/design-system"`);接入步骤见下条边界声明;接入后两端共享同一 token 校准。
- 待中枢确认:① agent-frontend 暂不入 workspace 可否(见边界声明);② **真实 `@heroui-pro/react` 工件不可由 `npm install` 复现**(licensed;公共 registry 仅 stub,root lock 指向 registry)——CI/他机须重跑 `hpsetup + HEROUI_PERSONAL_TOKEN`;建议在根 README/CI 文档化此前置(token 不入库)。
- 验证:`npm run build -w chat-frontend` 绿(CSS 33KB→760KB=全量真实 Pro BEM;HeroUI beta CSS 一处 `:not(:is())` 良性 warning,非阻断);`verify:ui` 绿(39 文件);workspace 符号链接 `node_modules/@infinitechat/design-system→packages/design-system` ✓;真实 token 渲染实测(亮 bodyBg `#FAFAFA`、暗纯黑 `#000`、surface/muted/separator 取 HeroUI oklch 真值、主按钮 `#006FEE`、无横向溢出);主题切换/持久化 OK。

### 2026-06-27 · 【边界声明·动手前】设计系统上提根级 workspace 包(跨目录)
- 完成(即将动手,先声明边界):把 `@infinitechat/design-system` 从 `chat-frontend/packages/design-system` 提到**仓库根级** `packages/design-system`,并引入根 `package.json`(`workspaces: ["packages/*","chat-frontend"]`)。中枢已批(STATUS HUB 2026-06-26「第一轮收口」§关键决策)。
- 影响面(将改动的路径):**新增** 根 `package.json` + 根 `package-lock.json` + 根 `node_modules`(hoisted,已被根 `.gitignore` 忽略);**移动** `chat-frontend/packages/design-system/` → `packages/design-system/`;**改** `chat-frontend/package.json`(加 workspace 依赖 `@infinitechat/design-system`、去 Vite alias)、`chat-frontend/{vite.config.ts,tsconfig.json,src/styles.css}`(路径)。
- 关键决策(自行做出、影响他流):根 workspace **暂只纳入 `packages/*` + `chat-frontend`**;**`agent-frontend/` 暂不入 workspace**——避免扰动 S2 的 node_modules/lock 与在途工作。Java 子项目(`agent/`、`chat/`)与 npm workspace 无关、零影响。
- 阻塞:无。
- 交接 → **S2**:设计系统届时位于仓库根 `packages/design-system`(`import "@infinitechat/design-system"`)。S2 接入时把 `agent-frontend` 加进根 `workspaces` 数组 + 在 `agent-frontend/package.json` 加 `"@infinitechat/design-system": "*"` 后根 `npm install`;我(S4,owner)配合对齐 token/组件 API。在那之前 S2 目录零改动。
- 待中枢确认:① 同意 `agent-frontend` 暂不入 workspace(S2 就绪再纳入)? ② 根 workspace 成员就用 `packages/* + chat-frontend`?

### 2026-06-26 · P0/P1 落地:设计系统 + IA 壳 + 7 静态页 + Mock 地基 + ADR(并行不阻塞)
- 完成:①抽 `@infinitechat/design-system`(品牌 token 来自 DESIGN.md:#006FEE/纯黑暗色/无渐变/Inter + **IM 真实态原语**:Skeleton/EmptyState/ErrorState(可重试不泄后端串)/ConnectionBanner/StatusDot/DeliveryTick(乐观发送态)/UnreadBadge/StatusPill + 品牌组件 Button/Panel/DividerRow/Field/Avatar + 灵犀 logo/glyph/wordmark + `#ic-rail-*` 图标精灵 + `verify-ui` 禁用模式扫描器);②按 DESIGN.md IA 搭壳(react-router 七目的地 home/messages/contacts/discover/assistant/settings/auth)+ 响应式布局(桌面四栏 rail·会话·主聊·助手 / 平板两栏 / 手机底部 dock)+ 七个静态高保真页;③技术栈 ADR ×2(栈选型 + WS 客户端策略)。④Mock 数据层 `src/api`= 唯一集成缝(Mock/真实同签名,含延迟/乐观/未读/断线→在线/助手 WS 推送回复);react-query(乐观发送+messageId 协调)+ zustand 接好。
- 产出物:`chat-frontend/packages/design-system/`(整包,源经 alias `@infinitechat/design-system` 引用)、`chat-frontend/src/{app,api,features,store,lib}/*`、`chat-frontend/docs/adr/{0001-tech-stack,0002-websocket-client}.md`、改 `package.json`/`vite.config.ts`/`tsconfig.json`/`index.html`/`src/styles.css`。分支 `feat/chat-frontend-design-system-shell`。
- 关键决策:**react-router(数据路由)+ react-query + zustand**(ADR 0001);设计系统暂落 `chat-frontend/packages/design-system` 经 Vite alias 引用(免 workspace 重排锁/EPERM,边界保持可上提);**token 自给**——按 DESIGN.md 在 `tokens.css` 定义全套语义变量,**变量名沿用 HeroUI 命名**(`--background/--surface/--foreground/--muted/--separator/--accent`),真实 Pro 包到位即可直接套件、无需改 token。
- 阻塞:① 真实数据联调仍待 S3 的 B6/B7/B8/M9/M10/M11(P2);② **新发现:chat-frontend `npm install` 从公共镜像装到的 `@heroui-pro/react@1.0.0-beta.6` 是 stub(无 `exports`、无 `dist/css`、无组件子路径),与 agent-frontend 里经 CN 代理装的真实 licensed 工件不同**——故本期设计系统做成原生(不 import 任何 HeroUI 组件),仅按 DESIGN.md 自给 token。要正式用 HeroUI Pro 组件(charts/sheet/sidebar 等)须先用 `hpsetup` + `HEROUI_PERSONAL_TOKEN` 装真实工件。
- 交接:**给 S2** —— `@infinitechat/design-system` 可消费(token + IM 真实态原语 + Button/Panel/Field/Avatar);若 S2 要 import,需中枢决定是否把包上提为根级 monorepo 包(跨目录,届时再写交接)。**与 S3** —— WS 握手适配层已按接口隔离(ADR 0002),待 B8 选型(`Sec-WebSocket-Protocol` vs `?token=&userUuid=`)定稿后一行切换。
- 待中枢确认:① 设计系统包是否(及何时)上提为根级 monorepo 包供 S2 直接消费;② **谁负责装真实 HeroUI Pro licensed 工件**(需 `HEROUI_PERSONAL_TOKEN`,中枢查不了 token)——不挡当前原生壳,但挡后续采用 Pro 组件。
- 验证(DESIGN.md §9):`npm run build` 绿(tsc+vite,1877 模块);`npm run verify:ui` 绿(39 文件零禁用模式);三端×routes `scrollWidth===clientWidth` 全过(桌面 1280 / 手机 375 / 窄屏 320 全部 6+1 路由零横向溢出);亮 `#FAFAFA`/暗 `#000000` 纯黑;主气泡 `rgb(0,111,238)`=#006FEE;主题切换持久化(`lingxi-theme`);核心流跑通(选会话→乐观发送→服务端协调→助手 WS 推送回复→缓存更新);桌面四栏(64/320/576/320)。注:preview 截图工具本会话一直超时(渲染器响应正常,eval/click/fill/snapshot 均可),已改用 eval/inspect 做权威校验。

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
