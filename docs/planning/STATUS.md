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

### 2026-06-29 · P12 集成:🎉 agent-frontend 浏览器级 F01 终于实证(CDP 真栈)+ 全模块 v1.0.0;v1.0.0 仅差 S3 末轮验收 → P13
- **本轮 P12 数字(git 核实)**:四条并入 `main`。**S2 `d58651d`(全新会话恢复成功)**:生产 Docker 真栈 **UI 卡片级 F01 实证(Chrome CDP 自动化,不 mock)**——真实登录 + string sessionId `s-lingxi` → 触发高危工具 → 确认卡 → 点确认 → 抓到 `confirmationToken`(无工具名)→ 一次性消费(重放签新 token 不执行)→ TTL 300s 过期重提示;§9 `v="1"` start/delta/done;版本 1.0.0;70 测试绿。**这是欠了 P7 起的 agent-frontend 浏览器 F01 验收,终于补齐**。S4 `05dede0`(发行打磨 + UI 终检:错误/空/暗色/移动,overflow 0)。S1 `113df11`(**HUB 代提**:v1.0.0 元数据 + 运行态复证 `s-lingxi`→200/F01 token 无 500/`mvnw test` 40/40)。S3 `bfa9894`(**HUB 代提**:全 chat 模块 v1.0.0 + 脚本同步)。
- **里程碑**:🎉 内置助手 F01 **前后端浏览器级全验证**(后端 11-assistant 5/5 + 前端 CDP 卡片级);全模块统一到 **v1.0.0**。
- **会话治理(本轮关键)**:S2 旧会话报废 → **起全新自包含会话恢复成功**(`019f139f`,完成了 F01 CDP 验收)。S1/S3 旧会话**跑完但没提交**(task_complete 后留 WIP 3.75h)→ **HUB 代提交**它们完成且一致的发行工作(S1 已自验 40/40 + BUILD SUCCESS;S3 版本号一致 bump)。
- **已集成**:四条并入 `main = b03fb52`(merge tips → agent-backend/chat-backend/chat-frontend/agent-frontend),零冲突,已 push。
- **🟡 距 v1.0.0 仅剩(P13)**:① **S3 末轮验收**——在集成后的 `main b03fb52` 上跑全栈 E2E 57/57 + 生产 :10010 冲烟(含 string sessionId/F01),**绿即 HUB 打 tag `v1.0.0`**(S3 本轮跑在 S2/S4 完成前,未做此验收);② deploy 配置固化需用户 sudo 应用 `p10-deploy-config.diff`;③ COS 公开读 `fileUrl` 403(用户基建);④ 真实 LLM delta 需部署提供受支持 model/key(S1 已显式化)。
- **路线**:功能版 v1.0·快。**P13 = S3 末轮验收 + 收尾 → 打 `v1.0.0`**。注入用英文 prompt;会话坏了才换新(S2 已换)。
- 阻塞:无。待中枢确认:deploy 固化 sudo;COS 公开读策略;是否提供 LLM key 验真 delta。

### 2026-06-29 · P11 集成(部分):D5 sessionId string 收口 + 生产网关 CORS/health 修复(S1+S3);S2 挂起/S4 空转(被 S1 修阻塞)→ 顺延 P12
- **本轮 P11 数字(git 核实)**:S1 `86a5295`(**D5 sessionId string 收口**:`AgentRequest/ChatRequest.sessionId`→String + `SessionIdCodec` 边界转 Long,client-only `s-lingxi` 稳定映射;修全部 agent 端点 sessionId 边界;LLM 模型显式可配/无 key 降级;`mvnw test -Plow-mem-test` **40/40**,本机 jar 实测 `s-lingxi`→200/SSE start);S3 `c229544`(**生产网关 CORS 真修**:根因=网关转发保留 Origin→agent 二次拦截,改 `RemoveRequestHeader=Origin` 使网关为唯一 CORS 边界,实测跨源 POST SSE 200;health smoke 收口;deploy diff 更新;**会话内全栈 E2E 57/57**)。**S2/S4 未交付**:S2 会话挂起(2 文件未提交、无 ledger、41min idle),S4 空转——二者「全 UI 卡片级 F01/§9 验收」**被 S1 的 sessionId 修阻塞**(S1 修本轮才提交,未在 S2/S4 起始的 main 上),属正常拓扑顺延。
- **里程碑**:v1.0.0 的两个技术前置已清——**D5 sessionId 契约收口** + **生产跨源 SSE 可用(CORS 修)**;全栈 E2E 仍 57/57。
- **已集成**:S1+S3 两条并入 `main`(merge tips → `<本集成>`,零冲突);S2/S4 无可并物。本 HUB 条目随后 docs 提交,已 push。
- **🟡 顺延 P12(已解阻)**:① **S2 全 UI 卡片级 F01 验收**(S1 sessionId 修已在 main→解阻;S2 会话需先理掉 p11 未提交 WIP);② **S4 全 UI 浏览器冒烟**(实时+内助手+媒体;CORS 已修→解阻)+ COS 公开读 `fileUrl` 403(属用户基建);③ **deploy 配置固化**仍需用户 sudo 应用 `chat/scripts/deploy/p10-deploy-config.diff`;④ 生产换上游受支持 LLM model/key 才有真 delta(S1 已显式化)。
- **路线**:功能版 v1.0·快。**P12 = S2/S4 全 UI 验收 + S3 末轮验收 → 全绿即 HUB 打 tag `v1.0.0`**。注入改用**英文 prompt**(用户拍板,防乱码;汇报仍中文)。
- 阻塞:无(P12 清单均已解阻或属用户基建)。待中枢确认:deploy 固化 sudo;COS 公开读策略。

### 2026-06-29 · P10 集成:🎉 go-live 收尾完成(生产 :10010 全栈冲烟 9/9 含内助手/F01)+ Redis:6399 根治;下轮 P11=发行打磨 → v1.0.0
- **本轮 P10 数字(git 核实)**:四条 `feat/*-p10` 并入 `main`(均 on-main/0-behind,零冲突)。S3 `87e16a2`(**go-live 收尾**:接 S1 镜像 `docker compose up -d agent`、**根治 Redis :6399**=脚本误写 :6379 拖 3 轮、生产 :10010 全栈冲烟 **9/9** 含内助手 SSE/F01、会话内 E2E **57/57**、产出 `p10-deploy-config.diff`);S1 `71dcbf4`(当前源 agent 镜像 `438deced` 交付 + **修 SSE 首帧/boundedElastic**(治内助手空挂)+ OpenAI-compat env 命名 + A1–A4 5/5 / runtime smoke 9/9);S4 `1679ada`(生产 :10010 浏览器真栈冲烟 + **修 client-only 助手线程抗 WS 抖动** + 挖出 3 个 infra 问题);S2 `9e415b4`(**生产 F01/§9 浏览器实证**:challengeToken 往返+一次性消费+TTL 300s,§9 v="1" start/delta/done + **修 Composer 嵌套 button bug**)。
- **里程碑**:🎉 **go-live 完整闭合**——生产 `:10010` 全功能鉴权版(IM + 内助手 + F01),冲烟 9/9 + 会话内 E2E 57/57;拖 3 轮的 Redis:6399 老坑根治。功能版 v1.0 仅剩发行打磨。
- **已集成**:merge tips agent-backend→chat-backend→chat-frontend→agent-frontend = `<本集成>`;本 HUB 条目随后 docs 提交,已 push。
- **🟡 P11 收口清单**:① **agent `AgentRequest.sessionId` 仍按 Long 反序列化**→ string sessionId 500,**违反 D5**(S2 实证;阻 agent 模式真 UI / 全 UI 卡片级 F01)= **P11 头号修**;② 3 个 infra 问题:生产网关**跨源实际 POST SSE 403**(预检过/POST 被 CORS 挡)、agent 上游 LLM 模型 `gpt-5.5` unsupported/timeout(换受支持模型/key)、COS 公开读 `fileUrl` 403(图片 bubble 不可见);③ deploy 配置固化需用户 sudo 应用 `chat/scripts/deploy/p10-deploy-config.diff`(否则重启丢鉴权 env);④ 生产 `/api/actuator/health` 经网关 404(健康走直连)。
- **用户拍板**:路线=**功能版 v1.0·快**;P11=发行打磨 → 打 tag `v1.0.0`;验收=S3 会话内全栈 E2E + 生产冲烟。本轮 prompt 经 `codex exec resume` 注入 4 个 codex 会话。
- **下一轮(P11)**:S1 修 agent sessionId string 双读(D5 收口)+ 换可用 LLM 模型;S3 修生产网关跨源 POST CORS + actuator health 路由 + 协助 deploy 固化;S4/S2 全 UI 卡片级 F01/§9 浏览器验收(sessionId 修后)+ COS 公开读;末轮打 `v1.0.0`。详见各流 prompt。
- 阻塞:无(P11 清单均非阻塞,属发行打磨)。待中枢确认:deploy 固化需你 sudo;COS 公开读策略需你定。

### 2026-06-29 · P9 集成:🎉 上线 chat 侧完成(Docker 生产 :10010 换鉴权版,P0 洞关闭)+ 前端 200 收缩;路线=功能版 v1.0(再 2 轮)
- **本轮 P9 数字(git 核实)**:四条 `feat/*-p9` 并入 `main`(均 on-main/0-behind,零冲突)。S3 `e8392e2`(**上线 chat 侧**:Docker 生产 `:10010` 重建 7 个 P8 鉴权镜像替换 pre-P0 无鉴权 + 鉴权 env override + DB 迁移 + 修 `user.status` 默认 0→1 真 bug;**上线冲烟 6/6**;go-live 工具脚本 `runtime-docker-golive/smoke/rollback`);S1 `f2e40fa`(agent 入运行态接真实库 `agent`/Redis + enforce + **可观测** RAG/记忆 AOP 指标 + 修 LLM 高基数 + A1–A4 5/5);S4 `94070b9`(包络 **200 收缩** `{0,200}→{0}` + regression);S2 `6850f8a`(收缩 + **修通 Vite dev proxy** 两真 bug:env loadEnv 链 + CORS Origin)。
- **里程碑**:🎉 **上线 chat 侧完成**——真在跑的 Docker 生产栈 `:10010` 从 pre-P0 无鉴权换成 P8 鉴权版,**运行态 P0 安全洞关闭**(无 token/garbage→401)。前端契约收缩完成。
- **已集成**:merge tips = `21f602e`;pre-merge 补提 S1 P9 ledger(又写进共享 main 工作树);本 HUB 条目随后 docs 提交,已 push。
- **🔴/🟡 go-live 最后一段(P10 收)**:① **agent docker 容器仍旧版**→ 生产内助手 SSE 404/F01 格式不符,需当前源**重建 agent 镜像 + `docker compose up -d agent`**(注:HUB 主树仅存 P6 旧 jar=缺 P9 可观测,且被进程占用锁定;**P10 由 S1 用当前源构建 agent jar+镜像**,其 P9 worktree 构建链已通);② **deploy 配置固化**(`D:\InfiniteChatDeploy` 只读,需 sudo/用户:`deploy/.env`+compose+`init-chat-schema.sql`,否则重启丢);③ **S2 浏览器级 F01/§9 E2E**(E2E 栈 Redis `:6399` down P7 起累积 + Win→WSL `:10010` NAT 不可达);④ DLQ lag gauge(L3)。
- **用户拍板(3 问)**:① 全合;② **路线=功能版 v1.0·快**(再 **2 轮**:P10 收尾 go-live + 前端验收 + 生产冲烟;P11 发行打磨 + 打 tag `v1.0.0`);③ P10 验收=**S3 会话内全栈 E2E + 生产冲烟**。
- **下一轮(P10)**:S3 主力(deploy 配置固化 + 协调重建 agent 镜像 up + 修 E2E Redis :6399 + 生产 :10010 全栈冲烟含内助手/F01);S1 重建 agent docker 镜像(当前源)交 S3 + DLQ lag gauge;S2 补跑浏览器 F01/§9 E2E(Redis 修后)+ 指向生产;S4 指向生产冲烟。详见各流 prompt。
- **进度**:核心功能 ~95%、上线 ~85%、生产硬化 ~40%。距功能版 `v1.0.0` ≈ 2 轮/2 次对话(诚实提醒:当前上线=本机 WSL Docker 运行态;面向外部真实用户另需真服务器/域名/TLS,属用户基建)。
- 阻塞:无(go-live 最后一段非阻塞,P10 收)。待中枢确认:无。

### 2026-06-29 · P8 集成:🎉 全栈契约收口完成(code=0+真实HTTP)+ 全栈 E2E 57 绿 + Mockito 测试债清除;下轮=上线(WSL 切 v0.x)
- **本轮 P8 数字(git 核实)**:四条 `feat/*-p8` 并入 `main`(均 on-main/0-behind,代码目录互不相交,STATUS 自动 union,**零冲突**)。S3 `cb526ae`(**item3 包络收口完成·同批翻**:Contact 14端点/Offline/Moment/RTC HTTP→chat-common Result code=0 + 真实 HTTP,收敛单一 advice;顺手修 `MomentService.getMomentList` 空 `IN()`→500 真 bug;**全栈 E2E**:04·13/06·10/07·14/08·4/10·5/11·5 + **新增 `12` 翻转回归 6/6 = 57 全绿**);S1 `8ff6c27`(包络**零 drift** 审计+live 双证无改;**清掉 Mockito OOM 测试债** opt-in `low-mem-test` profile→12 类 39 测试全绿;限流 Micrometer 指标 `agent.ratelimit.decisions{result,backend}`);S4 `c9dd42c`(**IM 内置助手浏览器级 E2E 实证**对真实 agent);S2 `8323b5d`(🛑 瞬时 Redis :6399 down 挡住 F01/§9 浏览器 E2E,拒 mock 伪造,仅 ledger)。
- **里程碑**:🎉 **全栈契约收口完成**——成功 `code=0` + 真实 HTTP 全栈一致(chat 4 服务翻完 + agent 零 drift),全栈 E2E **57 项全绿**(含翻转回归);**Mockito 测试债清除**。鉴权/IM/数据安全/内助手/契约 五块技术骨架已干净。
- **已集成**:merge tips agent-backend→agent-frontend→chat-frontend→chat-backend = `e5c1dbe`;pre-merge 补提 S1 P8 ledger(又被写进共享 main 工作树);本 HUB 条目随后 docs 提交,已 push。
- **🟡 仍欠(均小尾巴/已解阻)**:① 前端 **200 兼容收缩**(S2+S4 仍 `{0,200}`→S3 已点名"可关 200 兼容",P9 收掉);② **S2 浏览器级 F01/§9 E2E 补跑**(P8 被瞬时 Redis :6399 down 挡,现全栈已绿=已解阻);③ DLQ consumer-lag gauge(L3,chat 侧)。
- **用户拍板(3 问)**:① 全合(不另打 tag,`v0.1-e2e-green` 仍成立);② **下轮 P9 = 上线:WSL 运行态切到 v0.x**(替换 pre-P0 无鉴权旧栈),前端 200 收缩 + S2 补跑随之收掉;③ 下轮做完 **S3 会话内全栈 E2E + 上线冲烟** 验收。
- **下一轮(P9)**:S3 主力(把 E2E 绿的 main 部署到 WSL 开发运行态、替换无鉴权旧栈 + 上线冲烟)+ 点名前端收缩;S1 配合上线(agent 入运行态、enforce/降级/健康探针)+ 补 DLQ lag gauge;S4/S2 收缩 `{0,200}→{0}` + S2 补跑 F01/§9 浏览器 E2E。详见各流 prompt。
- 阻塞:无。待中枢确认:无(P9 即上线,线上不再 defer——目标=替换 WSL 无鉴权旧栈)。

### 2026-06-29 · P7 集成:🎉 J1 闭环 + 灵犀内置助手全链路 E2E 51/51 绿(LLM 在线);打 tag `v0.1-e2e-green`;下轮=契约收口 + 前端验收闭合
- **本轮 P7 数字(git 核实)**:四条 `feat/*-p7` 并入 `main`(均 on-main/0-behind,代码目录互不相交,STATUS 自动 union,**零冲突**)。S3 `b474ea4`(**收 J1**:`10-agent-smoke` 5/5 直连缺头401/网关注入身份放行/SSE 达 agent;**内助手全链路 `11-assistant-e2e` 5/5**:@灵犀→真实 agent SSE §9 + **F01 工具确认令牌往返**,**LLM 在线真流式**;修 E2E infra 跨会话存活 setsid + agent Redis e2e db6);S1 `9d1cfbf`(本机降级态实跑预验 J1 agent 侧 + **修 redis 无关 readiness/liveness 探针**——原 Redis 降级→主 /health 503 会误杀就绪门;agent 侧包络 code=0 复证);S4 `6adc891`(消费 S3 两缺口 `peerUserId`/图片历史 + 内助手端点对齐 `/api/chat/auto/stream` 自动路由 + §9 `v` 归一);S2 `e78c048`(SSE §9 `v` 类型回归到 string 对齐 backend wire + D5 回归扫零)。
- **里程碑**:🎉 **J1 闭环 + 内置助手全链路 E2E 51/51 绿**(`04`13+`06`10+`07`14+`08`4+`10`5+`11`5)——**鉴权 → IM 实时 → 数据安全(B4/B5)→ 内置助手(SSE+F01)** 整条核心链路端到端验证(LLM 在线)。打 tag **`v0.1-e2e-green`** 标记此里程碑。
- **已集成**:merge tips agent-backend→chat-frontend→agent-frontend→chat-backend = `6d31062`;另 pre-merge 补提 S1 P7 ledger(曾被写进共享 main 工作树)+ `.gitignore` 加 `.claude/worktrees/`;本 HUB 条目为随后 docs 提交,已 push + push tag。
- **🟡 仍欠**:① **S2/S4 浏览器级验收**——内助手流式渲染 + F01 确认 UX 的前端 UI E2E(S2/S4 跑时 S3 栈未起→当时阻塞,**现 J1 已通=已解阻,待补跑**;后端链路 S3 51/51 已证);② **item3 包络收口**——Contact/RTC/Offline/Moment 翻 code=0/真实 HTTP(S3 已**翻前点名**未翻,需 S1 同批 + S2/S4 ack,翻后前端收缩 `{0,200}→{0}`);③ CI 复跑 Mockito、DLQ consumer-lag gauge(L3)。
- **用户拍板(3 问)**:① 全合 + **打里程碑 tag `v0.1-e2e-green`**;② **下轮 P8 = 契约收口 + 前端验收闭合**;③ 下轮做完 **S3 会话内全链路 E2E 验收**。
- **下一轮(P8)**:S3+S1 **同批翻** item3 包络(Contact/RTC/Offline/Moment→code=0/真实 HTTP,翻前 STATUS 点名 S2/S4);S2/S4 收到点名后做 expand/contract **收缩**(`{0,200}→{0}`)+ 补**浏览器级内助手 E2E**(F01 确认 UX / §9 流式渲染);S3 会话内复跑全栈 E2E(含翻转后回归)验收。详见各流 prompt。
- 阻塞:无。待中枢确认:无(线上仍 defer;P8 后可议上线)。

### 2026-06-28 · P6 集成:灵犀内置助手四侧 code-complete + S3 IM E2E 首手全绿;唯一阻塞 J1(agent jar);下轮=收 J1 打通内助手端到端
- **本轮 P6/wave2 数字(git 核实)**:四条分支并入 `main`(代码目录互不相交,STATUS 自动 union,**零冲突**)。S1 `9f763ab`(F01 挑战令牌 + 限流**硬化为 Redis 多实例原子** + J1 对接文档 `agent/docs/E2E-INTEGRATION.md`);S2 `3f2648b`(**M4 切真 F01 令牌** + **D5 string id 一次翻净** + SSE §9 `v`/`buffered`/容忍未知 type);S3 `4584ae5`(**首手复跑 IM E2E 38/38 绿**=04 鉴权13+06 客户端10+07 IM/B4 11+08 实时4,随后补 S4 两缺口把 07 扩到 **14/14**;`peerUserId`/图片历史持久化;**J1 turnkey 工具 `09/10`**;生产硬化 **Snowflake 按实例 D9/M6** + 网关生产 CORS);S4 `0ffb026`(**IM 内置「灵犀」助手接真实 agent SSE §9**)。
- **里程碑**:🎉 P6 主题(IM 内置助手)**四侧 code-complete** + S3 **首手坐实 IM E2E 全绿**(此前为恢复条目,本轮一手复现)。
- **已集成**:merge tips `ffb06c6`(agent-backend)→ `a823092`(chat-frontend)→ `7141552`(agent-frontend)→ `a5bf143`(chat-backend);本 STATUS + 编排规范 `04-orchestration-playbook.md` 为随后 docs 提交,已 push。
- **🟢 J1 阻塞已解(构建侧)**:HUB 按用户拍板已**成功构建当前 agent jar**——`mvnw clean package -DskipTests` **BUILD SUCCESS**,SB3.5.13 repackage 胖 jar `E:\jhw\proj\agent\target\InfiniteChat-Agent-0.0.1-SNAPSHOT.jar`(96MB;WSL 路径 `/mnt/e/jhw/proj/agent/target/InfiniteChat-Agent-0.0.1-SNAPSHOT.jar`)。**交接 S3**:拷入 `~/projecta-e2e/agent/target/` 后 `AGENT_SKIP_BUILD=1 bash chat/e2e/09-agent-e2e.sh && bash chat/e2e/10-agent-smoke.sh` 跑 A1-A4 三断言;再跑内助手/F01/流式全链路 E2E。(jar 由当前 main agent 源构建,与 09 rsync 的源一致;无 `DASHSCOPE_API_KEY` 时 A4 验到"请求达 agent 且带 X-User-Id",填 key 验真实流式。)
- **🟡 仍欠**:剩余包络收口(Contact/RTC/Offline/Moment→code=0/真实 HTTP,与 S1 同批翻)、CI 复跑 Mockito(本机 OOM)、DLQ consumer-lag gauge(L3 可观测)。
- **用户拍板(3 问)**:① 现在全合 + **HUB 构建 agent jar 解 J1**;② **下轮 P7 = 打通内助手端到端 + 收 J1**;③ 下轮做完 **S3 会话内全链路 E2E 验收**(IM + 内助手)。
- **下一轮(P7)**:HUB 投放 agent jar → S3 `AGENT_SKIP_BUILD=1 bash 09 && bash 10` 跑 3 断言 + 内助手全链路 E2E 验收;S1 配合 agent E2E 起栈(降级/健康/enforce)+ 牵头剩余包络收口;S4/S2 待 J1 通后端到端验流式回复/F01 确认 UX;详见各流 prompt。
- **新增**:`04-orchestration-playbook.md`(编排规范:分工/拓扑/model+effort 配比/prompt 模板/收口格式);外部调度器设计在 `E:\jhw\routines`;系统学习文档在 `E:\jhw\proj-docs`。
- 阻塞:J1 构建侧已解(jar 就绪),待 S3 拷入 E2E 栈跑 09/10 验收。待中枢确认:无(线上仍 defer)。

### 2026-06-28 · P5 集成:IM 实时闭环 + 数据安全落地(B4/B5)+ STATUS 补录;下轮=灵犀内置助手端到端打通
- **本轮 P5 数字(git 核实)**:四条 `feat/*-p5` 全并入 `main`(无冲突,四目录互不相交;已 push)。S1 `0d36d43`(D5 string-id `@SnowflakeId` 出参串化+Jackson 双读 + SSE §9 信封版本化 `v`/`buffered` + **F01 服务端一次性挑战令牌**);S2 `6330828`(**首次用自己分支**:M3 真实模式路由 + dev-proxy CORS shim + **真实登录 E2E 浏览器实证全绿(:10110)** + M4 工具确认壳);S3 `d2f393c`(**B4/B5/M8 数据安全:同事务 outbox + Kafka DLQ**,git 核实 `persistMessageAndOutbox`+`KafkaConsumerConfig` 落地;B8 浏览器 WS 握手真修;发消息端点翻 code=0);S4 `0f86662`(实时收发闭环:发送/图片写路径接真实 + 收消息直写缓存去重)。
- **里程碑**:🎉 **IM 实时闭环 + 数据安全双双落地**——拖 4 轮的 B4/B5 数据丢失级修复终于进代码;live WS「发→对端实时收」端到端打通;S2 缠结(误落 chat-frontend)本轮解决。
- **已集成**:四 merge commit 无冲突 `df6b3b2`(agent-backend)→ `da5a681`(chat-backend)→ `2f1e57b`(agent-frontend)→ `c5a4bd3`(chat-frontend);本 STATUS 补录为随后 docs 提交。
- **STATUS 修复(本轮治理)**:S2/S3 的 P5 条目**此前从未提交**——S3 原始记录在共享工作树被 S4 `0f86662` 覆盖丢失,S2 条目仅存工作树未提交。中枢据 git 实况 + 上下文**补提交回 main**(S2 条目 + S3 三条带恢复标记)。**根因=多流共享一个工作树 + STATUS `commit -a`/checkout 互踩**。
- **仍欠(关键)**:🔴 **S3 IM E2E 绿数字是重建条目**(07-im 11/11 / 08-ws 4/4)——代码 git 核实安全,**实绿待 S3 会话内复跑确认**;🔴 **共享工作树踩踏**(本轮再发生)→ P6 起**强制各流独立 worktree + STATUS 各写各分支、HUB union**;🟡 **灵犀内置助手未端到端**(agent 不在 chat E2E 栈,S2 流式回复半侧 + S4 内助手 + F01 确认 UX 全卡此);🟡 剩余包络收口(Contact/RTC/Offline/Moment 仍 200+code)、生产硬化、图片历史持久化 + `peerUserId` 两后端缺口。
- **用户拍板(3 问)**:① 中枢现在合四条→main;② **下轮=灵犀内置助手端到端打通**(agent 入统一 E2E 栈,S4 接 IM 内助手流式、S2 接 F01 真确认令牌);③ 下轮做完 **S3 验收**(会话内跑 IM + 内助手全链路 E2E)。
- **下一轮(P6)**:S3 主力(复跑确认 P5 E2E + 把 agent 纳入 chat E2E 栈 + 剩余包络收口 + 两缺口 + 生产硬化);S4 接 IM 内助手流式(§9 SSE);S2 接 F01 真挑战令牌 + D5 翻 string + 流式回复端到端;S1 配合 agent 入 E2E 栈 + F01 真 Redis/SSE 联调 + F01/限流多实例 Redis 硬化。
- 阻塞:无。待中枢确认:无(线上仍 defer)。

### 2026-06-27 · P4 集成:鉴权 E2E 13/13 验收 + IM 前端吃真后端 + RAG 真嵌入;下轮=IM 实时闭环+数据安全
- **本轮 P4 数字(git 核实)**:S3 ① 邮箱登录 **E2E 13/13 绿(会话内)** ② 客户端读 API(ChatClientController 会话/历史/markRead + 好友 + 媒体 + cursor 分页 + ApiExceptionHandler 包络)③ WS 握手适配 + `06-client-api-smoke.sh`;S1 RAG **真嵌入**+阈值解耦(M15/F06/F07);S2 401→refresh→retry + dev proxy;S4 接通真实客户端**读 API + auth**(`api/{http,real}.ts` 真接缝)。
- **里程碑**:🎉 统一鉴权 **E2E 实测闭环(13/13)**;IM 前端开始消费真实后端读接口;RAG 可真语义检索。
- **已集成**:四条 p4 并入 `main = ae420c8`(无冲突,已 push);`feat/agent-frontend-p4` 空(S2 提交在 chat-frontend-p4,已随并)。
- **仍欠(关键)**:🔴 **数据丢失 B4/B5 未做(拖 4 轮)**——消息仍只靠 Kafka 消费者落库、无 DLQ;**IM 实时收发(live WS 发/收)+ 媒体发送未端到端**;其余 5 服务包络收口部分;S2/S4 分支仍缠。
- **用户拍板(3 问)**:① 中枢现在合→main;② **下轮=IM 实时闭环 + 数据安全 一起**;③ 下轮做完 **S3 会话内跑 IM 全链路 E2E 验收**。
- **下一轮**:S3 主力(live WS 收发推送 + B4/B5 + 余下包络收口 + IM E2E);S4 接 live 收发/媒体写路径(读已通);S2 验真实登录端到端 + 接 agent 死端点/工具确认 UX;S1 sync code=0 + 备 agent 给 IM 内助手 + 工具确认挑战令牌(F01)。
- 阻塞:无。待中枢确认:无(线上仍 defer)。

### 2026-06-27 · P3 集成(鉴权代码闭环)+ E2E 验收受限 + 下轮=解锁 S4
- **本轮 P3 数字(git 核实)**:S3 `04ec462` 邮箱登录(D14)+HS256 统一 JWT(chat-common)+/refresh+删 SMS;S1 `a68b2a7` enforce-identity=true+删 body userId+退役 admin token;S2 `4f1da78` agent-frontend D14 登录模型;S4 `53a2800` chat-frontend D14 登录+auth gate(Mock)。🎉 **统一鉴权代码层闭环**。
- **已集成**:四条 p3 并入 `main = cff5131`(无冲突,已 push);`feat/agent-frontend-p3` 空(S2 提交落在 chat-frontend-p3,已随之并入)。
- **E2E 验收(中枢实跑,部分成功)**:✅ 合并后 7 服务+chat-common **BUILD SUCCESS**(编译验证闭环可集成);✅ AuthenticationService 起来健康(200)。⚠️ **全栈鉴权 E2E 未能从 Windows→WSL 桥稳定跑通**——网关冷启动/进程生命周期跨桥调用不持久(每次 `wsl.exe` 调用退出即拆,网关反复 000;logback 关停噪音)。**结论:E2E 应由 S3 在其常驻 WSL 会话内跑**(S3 此前 11/11 绿)。
- 🔴 **新发现(DevOps)**:仓库 `.sh` 脚本被 **CRLF 污染**(Windows autocrlf 提交)→ `set -euo pipefail\r` 在 bash 下报 `pipefail: invalid option name`,须 `tr -d '\r'` 才能跑。**需加 `.gitattributes`:`*.sh text eol=lf`** 并重规范化既有脚本。交接 S3/中枢。
- **包络漂移仍在**:S3 只把 Auth 接了 chat-common Result;其余 5 服务 + §3 真实 HTTP 翻转未做。
- **用户拍板(3 问)**:① 中枢现在合→main;② 集成后中枢跑全栈鉴权 E2E(已尽力,见上,移交 S3 在会话内验);③ **下轮重心=解锁 S4(S3 出客户端 API + 浏览器 WS),数据安全 B4/B5 并行**。
- **下一轮**:S3 先(a)更新 E2E 冒烟为邮箱登录(D14)并在会话内跑绿验收闭环 +(b)加 `.gitattributes` 修 CRLF,再(c)客户端 API+浏览器 WS(解锁 S4)+数据丢失 B4/B5;S1 转 RAG 真嵌入/可观测;S2 接通真实邮箱登录(鉴权已闭环);S4 等 S3 客户端 API,续 Mock+对齐。
- 阻塞:无。待中枢确认:无(线上仍 defer)。

### 2026-06-27 · P2 集成 + D14 邮箱登录 + 下轮=鉴权闭环冲刺
- **本轮 P2 数字(git 核实,均单 commit)**:S3 `043c2bb` 网关 fronts agent 路由+注入 X-User-Id/Roles(**仅此片**:未做统一 JWT/LoginResponse 修/refresh/6 服务接 chat-common);S1 `50bad45` 错误码对齐 chat-common + 真实 HTTP 状态(**enforce 仍 false**);S2 `ab5c294` model-config admin 屏(D10);S4 `9421434` 流式"灵犀"助手壳(Mock,SSE-ready)。
- **如实评估**:🔴 **鉴权闭环本轮未闭**(网关路由有了,但 enforce 未翻、JWT 未统一、LoginResponse.userId 未修、/refresh 未做 → S2 真实登录仍接不通);**包络短暂漂移**(agent 已翻真实 HTTP,chat 仍 200+code,待 S3 把 chat-common Result 接进 6 服务收口,S2 已 {0,200} 双兼容兜底)。瓶颈持续在 S3 关键路径(每轮一薄片)。
- **用户拍板(3 问)**:① 中枢现在合四条→main;② **下轮=专注鉴权闭环冲刺**(数据丢失/客户端 API 暂停,S4 续 Mock);③ **D14 登录模型=邮箱+密码 且 邮箱验证码(注册/免密),去手机号/短信**。
- **已执行**:四条 `p2` 分支全部 merge 入 `main`(无冲突);**D14 落进 master-plan §5/§10 + `03-contracts.md §7.1`**(登录端点契约)。
- **下一轮唯一目标 = 端到端鉴权闭环**:S3 统一 JWT(HS256 单源)+ 修 LoginResponse.userId + `/refresh` + **邮箱登录(D14)** + 6 服务接 chat-common Result;S1 翻 enforce + 同步翻真实 HTTP/code=0;S2 接真实邮箱登录;中枢跑全栈鉴权 E2E。完成即闭环。
- 阻塞:无。待中枢确认:无(线上仍 defer)。

### 2026-06-27 · P1b 集成检查点:四流并入 main + STATUS 消解分叉
- **本轮 P1b 数字(git 核实)**:S1 contract-safe 三件(userId sweep→@CurrentUser / @Valid / 按主体限流 / 结构化日志)✅;S2 品牌+a11y 收尾 + 登录壳+token 管线+Authorization 注入 ✅;S3 **chat-common 模块交付**(`chat/chat-common`,10 Java:Result/ErrorCode/Page/Snowflake/JwtUtil/IdentityHeaders/RequestContext/ApiException)✅(=#1 解锁件);S4 原生基元换真实 HeroUI Pro/OSS + 好友申请 mock action ✅。
- **用户拍板(3 问)**:① **中枢现在合四条→main + 消解 STATUS 分叉**;② **下轮 S3 鉴权闭环优先**;③ STATUS 治理 = 中枢每次集成时合并(现状)。
- **已执行**:四条 `p1b` 分支全部 merge 入 `main`(merge commits;无冲突);**STATUS 分叉已消解**(四流 P1b 条目均在统一 STATUS);`chat/chat-common` 已在 main。
- **下一轮重心 = 鉴权闭环**:S3 先做网关 agent 路由 + 统一 JWT(§6/§7)→ 解锁 S1 翻 `enforce-identity` + S2 接真实登录 → 目标本轮把统一鉴权端到端跑通(E2E 验)。客户端 API(解锁 S4)与数据丢失级 B4/B5 紧随。S1/S2/S4 **从新 main 起分支**。
- 关键提醒:S1 已声明 OTel 完整分布式 span 待系统级协调(避免与 X-Trace-Id MDC 撞键);错误码归一待 S1 按 chat-common 落地后对齐。
- 阻塞:无。待中枢确认:无(线上仍 defer)。

### 2026-06-27 · D13 保持单一 monorepo(拍板)+ 复核:集成+契约已落地
- **D13**:用户拍板**保持单一 monorepo**(不拆子仓),已写入 master-plan §5(D13)+§10。解决「仓库重建」条遗留的"是否拆分子仓"待确认项。
- **复核确认 ②(本轮无需重做)**:上一轮已执行的 P1 集成检查点 + chat-common 契约规格**均已在 main**:`main = ce8adc4(= origin/main)`——S4 根 workspace+真实 Pro+WS、S2 设计系统+品牌、S1 身份 expand 全部并入;**C4 已解**(agent-frontend alias 改指根 `packages/design-system`,`tsc -b` exit 0);`docs/planning/03-contracts.md` 在库。故本轮只补 D13 + 重发 prompt,不再重复合并。
- 阻塞:无。待中枢确认:无。

### 2026-06-27 · P1 集成检查点 + chat-common 契约规格 + 重心转 S3
- **本轮 P1 数字**:S1 身份 expand 相 ✅ / S2 接设计系统+灵犀品牌 ✅ / S4 设计系统上提根级+真实 Pro+WS 客户端 ✅ / **S3 仅 ★1 复核、P1 代码零提交**(关键路径未交付,3 流在等它)。
- **用户拍板(本轮 3 问)**:① 下轮**集中火力 S3 关键路径**;② **中枢现在做 P1 集成检查点**;③ **中枢出 chat-common 契约规格**。
- **已执行**:
  1. 写 `docs/planning/03-contracts.md`(跨栈契约单一事实来源:身份头/统一包络/错误码+HTTP 映射/游标分页/string id/网关 agent 路由/JWT/WS 握手/SSE)——S3 在 chat-common 实现并导出、S1 镜像对齐。
  2. **P1 集成检查点 → `main` = `a4114f0`(已 push)**:S4(根 workspace + 真实 Pro + WS)+ S2(设计系统+品牌)+ S1(身份 expand+traceId)全部并入;**解决 C4**——agent-frontend 的设计系统 alias 由 `chat-frontend/packages/` 改指根 `packages/design-system`,`tsc -b` exit 0 已验。S3 分支无 P1 提交、无需合并。
- **下一轮**:重心 = S3(chat-common→网关 agent 路由→数据丢失级→客户端 API)。S1/S2/S4 **从新 main(a4114f0)起分支/rebase**,只做契约安全活、等 S3 解锁件。四流 P2/续 prompt 已下发。
- 阻塞:无。
- 待中枢确认:无(线上部署仍按上条 defer 到 P1 整合就绪后)。

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

### 2026-06-30 · P13 release-close 支撑:1.0.0 jar 兼容别名 + 验收栈交接
- 完成:**分支 `feat/agent-backend-p13`(从 main `559d73d` 起,worktree `E:\jhw\proj-agent-p13`)**。确认 `agent/` 已是 v1.0.0(`pom`/OpenAPI/actuator info)。为支撑 S3 末轮验收,在 Maven `package` 阶段新增兼容别名:`target/InfiniteChat-Agent-0.0.1-SNAPSHOT.jar` 会从 `target/InfiniteChat-Agent-1.0.0.jar` 复制生成。这样当前仍写死旧 jar 名的 S3 E2E/deploy 脚本(`chat/e2e/09-agent-e2e.sh`、`chat/scripts/runtime-agent-golive.sh`、`runtime-deploy.sh`)即使未改脚本,也会拿到 1.0.0 字节内容。
- 验证:WSL `./mvnw clean package -DskipTests` **BUILD SUCCESS**;`InfiniteChat-Agent-1.0.0.jar` 与兼容别名 `InfiniteChat-Agent-0.0.1-SNAPSHOT.jar` sha256 均为 `c392678544849d72f74e64c93a72693e0fd0f6896333af0f3cf0a29c28cdc863`。WSL `./mvnw test -Plow-mem-test` **40/40 绿**。
- 镜像:用部署 Dockerfile 按旧脚本路径 `JAR_FILE=agent/target/InfiniteChat-Agent-0.0.1-SNAPSHOT.jar` 成功构建 `infinitechat/agent:local`=`sha256:c6db77da4175...`,旧镜像已留 `infinitechat/agent:pre-p13-*`。这证明旧 build arg 可得到 P13/1.0.0 jar。
- 验收栈现状:尝试 `docker compose ... up -d --no-build agent` 时,Docker 重新创建了 `infinitechat-agent`,但启动失败在宿主端口绑定:`listen tcp4 0.0.0.0:10011: bind: address already in use`。Windows 侧确认 `iphlpsvc` 持有 `netsh portproxy` 监听 `0.0.0.0:10011 -> 192.168.112.154:10011`(同时还有 `10010/4173/8848`),导致 Docker 不能重新绑定端口。当前这是 S3/运行态端口代理清理问题,不是 agent jar/image 内容问题。
- 发行说明输入(agent v1.0.0):① IM 内置助手走统一网关 `/api/chat/auto/stream`,支持 §9 SSE start/delta/done/error;② RAG 接真实嵌入/混合检索/引用阈值解耦;③ F01 高风险工具确认改为服务端一次性 `challengeToken`(绑定 userId/sessionId/tool,Redis GETDEL/内存降级);④ P9+ 可观测指标包括 `ai_model_*`、`agent_rag_query_duration_seconds`、`agent_memory_op_duration_seconds`、`agent_ratelimit_decisions_total`;⑤ P11/P12 完成 D5 string sessionId(`s-lingxi`)与 1.0.0 元数据。
- 交接:S3 最终验收前请先清理/刷新 Windows portproxy 或改 compose 端口,再启动 gateway/agent;agent 镜像当前已是 P13 构建。若验收环境提供受支持 upstream LLM model+key,继续验 `/api/chat/auto/stream` 真实 `delta`;否则按显式降级只验 readiness 200、SSE start/error、F01 token 往返无 500。
- 阻塞:代码侧无;运行态阻塞为宿主 `iphlpsvc` portproxy 占用 `10010/10011`。

### 2026-06-29 · P12 发行支撑:1.0.0 元数据 + string session/F01 运行态复证
- 完成:**分支 `feat/agent-backend-p12`(从 main `bfbd470` 起,worktree `E:\jhw\proj-agent-p12`)**。agent 发行元数据升到 **1.0.0**:`agent/pom.xml` 版本 `1.0.0`;OpenAPI `Info.version=1.0.0`;Spring Boot `build-info` 纳入 jar;`/api/actuator/info` 暴露 `app.component=agent-backend`、`app.version=1.0.0` 与 build version。
- 验证:WSL 执行 `./mvnw test -Plow-mem-test` **40/40 绿**;`./mvnw clean package -DskipTests` **BUILD SUCCESS**。发行 jar 路径变为 `agent/target/InfiniteChat-Agent-1.0.0.jar`,sha256=`103cc35771d947f6496ebf12d81d06d67a0fb720d7b6cdc3b252032a036d6c8d`。注意:S3/部署若复用旧脚本默认 `InfiniteChat-Agent-0.0.1-SNAPSHOT.jar`,需显式改 `AGENT_JAR`/`JAR_FILE` 到 1.0.0 jar。
- 运行态复证(E2E 栈 `gw=:10110`,agent `:18080`,client-only `sessionId:"s-lingxi"`):seed 登录后,直连带 `X-User-Id` `POST /api/agent/chat` → **200/code=0**,无 Jackson/sessionId 500;经网关 `POST /api/chat/auto/stream` → **SSE start**,首帧回传 `sessionId:"s-lingxi"`,随后因当前栈未配 OpenAI-compatible key/model 走显式 error 降级,未验证真实 delta。
- F01 复证:`/api/agent/chat` 直连与经网关均用 `sessionId:"s-lingxi"` 首轮命中 **200 + confirmationRequired + challengeToken**;二轮回传 `confirmationToken` 后**无 500**、sessionId/string/F01 token 绑定通过,当前运行态随后因 **AI 模型未配置** 返回 503 降级(非 D5/F01 问题)。若部署提供受支持 upstream LLM model+key,请在同一路径补验真实放行答案/真实 streaming delta。
- 健康/可观测:运行态 `:18080/api/actuator/health/readiness` **200**;Prometheus 导出 `agent_ratelimit_decisions_total`、`agent_memory_op_duration_seconds`、JVM/process 指标。P12 新 jar 临时 `:18290` 启动复证 readiness **200**;`/api/actuator/info` 返回 app/build version **1.0.0**;Prometheus 指标可抓取。
- 交接:**S2/S4 可继续全 UI 内助手/F01 验收**。若 UI 在确认后看到 503/显式 error,按当前证据优先归类为 LLM env 未配置/unsupported,不是 string sessionId 500;换受支持模型+key 后再验 `/api/chat/auto/stream` 真实 delta。
- 阻塞:无(agent 侧)。待 S3/部署:1.0.0 jar 路径/镜像 build arg 同步;若要真 delta/F01 确认后自然语言答案,提供受支持 LLM model+key。

### 2026-06-29 · P11 发行打磨:D5 sessionId string 收口 + LLM 配置显式化
- 完成:**分支 `feat/agent-backend-p11`(从 main `3016d90` 起,worktree `E:\jhw\proj-agent-p11`)**。把 agent 对外入口的 `sessionId` 收到 wire-level string:`AgentRequest.sessionId`、`ChatRequest.sessionId` 改为 String,Jackson 接受 JSON string/number;业务边界经 `SessionIdCodec` 转内部 Long。标准 session 仍为 string snowflake;前端 client-only 字符串(如 `s-lingxi`)稳定映射到高位内部 Long,用于记忆/F01 challenge token 绑定,不会再在反序列化阶段 500。`StreamChatEvent`/`ChatResponse` 出参保持 string sessionId。
- 完成:同步修 `/api/agent/chat`、`/api/chat`、`/api/streamChat`、`/api/chat/auto(/stream)`、`/api/rag/chat` 的内部 sessionId 边界;`/api/chat/auto/stream` 首帧继续回传原始 `sessionId:"s-lingxi"`。新增 `RAG_BOOTSTRAP_ENABLED` 可选启动开关(默认 true)便于轻量 smoke 跳过本地文档灌库,不改默认行为。
- 完成:LLM 上游配置改为**显式模型**:OpenAI-compatible 默认 `chat-model` 留空,避免带 key 后默认请求不受支持的占位模型;`.env.example`/README/E2E/模型工厂文档明确 `AGENT_MODEL_OPENAI_COMPATIBLE_*`、`stream-timeout-seconds`、`reasoning-effort` 留空策略。无 key/model 时 readiness 保持 200,聊天/SSE 走显式降级错误;`gpt-5.5` 这类 unsupported 模型需由部署 env 换成上游 `/v1/models` 实际支持的模型。
- 验证:WSL Java 21 执行 `./mvnw test -Plow-mem-test` **40/40 绿**;`./mvnw clean package -DskipTests` **BUILD SUCCESS**,jar `agent/target/InfiniteChat-Agent-0.0.1-SNAPSHOT.jar` sha256=`3bf6110e1bfa6e036309aef222e61b3bc1d6632e182d19c3515e57938af30317`。Windows JVM 仍受页面文件不足/Mockito self-attach 限制,本轮构建测试以 WSL 链为准。
- 验证:本机临时 P11 jar `:18280`(H2 + PgVector 降级 + 无 LLM key/model + `RAG_BOOTSTRAP_ENABLED=false`) readiness **200**;`POST /api/agent/chat` body `{"sessionId":"s-lingxi","prompt":"现在时间"}` + `X-User-Id` → **200/code=0**;`POST /api/chat/auto/stream` body `{"sessionId":"s-lingxi","prompt":"你好"}` → **200 text/event-stream**,首帧 `event:start` 且 `sessionId:"s-lingxi"`。
- 交接:**S2/S4:agent sessionId 现已支持 string,请恢复/重跑真实 UI 内助手与卡片级 F01**(含 client-only `s-lingxi` 场景,二次确认 token 会绑定稳定内部 sessionId)。**S3:若要验真实 delta,请把生产 OpenAI-compatible env 的 model/key 换成上游支持值;无 key/model 时只验 readiness/身份/SSE start+error 降级。**
- 阻塞:无。待中枢确认:无。

### 2026-06-29 · P10 收口:agent 当前源镜像上线 + 生产 :10010 内助手/F01 冲烟全绿
- 完成:**分支 `feat/agent-backend-p10`** 在 agent 侧补两个运行态修复后重新构建交付:① 兼容部署 env 的 `AGENT_MODEL_OPENAI_COMPATIBLE_*` 命名并加 `stream-timeout-seconds`(默认 15s),避免旧部署变量名与当前 Spring 配置脱节;② `/chat/auto/stream` 与 `/streamChat` 把阻塞模型调用放到 `boundedElastic` 并传播 `MonitorContext`,确保 **SSE start 首帧先发**、慢/不可用 LLM 转 error/metrics,不再让内助手空挂。
- 完成:最终 jar 由 WSL Java 21 执行 `./mvnw clean package -DskipTests` 成功构建(Windows JVM 受页面文件不足影响,改用同一 worktree 的 WSL 构建链);最终 jar `agent/target/InfiniteChat-Agent-0.0.1-SNAPSHOT.jar` sha256=`6bb12d552d957101a40965272926587089d32750f261de1c9d32bf800aefcba3`。用部署 Dockerfile 重建 `infinitechat/agent:local`=`438deced...`,旧镜像保留 `infinitechat/agent:pre-p10`=`ef8f707...`。
- 完成:S3 Docker 运行态已 `docker compose ... up -d --no-build agent`;容器 `infinitechat-agent` 运行新镜像 `438deced...`,容器内 `/app/app.jar` sha256 与最终 jar 一致。运行 env 实测 `AGENT_GATEWAY_ENFORCE_IDENTITY=true`,MySQL=`mysql:3306/agent`,Redis=`redis:6379`,PgVector=`postgres:5432`;无 `DASHSCOPE_API_KEY` 时嵌入显式降级 HashEmbeddingModel,readiness 保持 200。
- 验证:**A1-A4 生产冲烟 `PASS=5 FAIL=0`**:`:10011/api/actuator/health/readiness` 200;直连无头 `/api/agent/tools` 401;经生产网关 `:10010` 登录→`/api/agent/tools` 200/code=0;`/api/chat/auto/stream` 经网关达 agent 并立即产出 §9 `event:start` SSE(不再 404/空挂)。**完整 production runtime smoke `PASS=9 FAIL=0`**:无 token/garbage 401、邮箱登录、IM 发收落库/历史、内助手 SSE、F01 `confirmationRequired+challengeToken` 与二次持令牌放行全绿。
- 验证/可观测:`/api/actuator/prometheus` 导出 `agent_ratelimit_decisions_total{backend="redis",result="allowed"}`,`agent_memory_op_duration_seconds`,`ai_model_*` 错误指标;最终日志未再出现 `MonitorContext is null`/“监控上下文丢失”。当前部署的 OpenAI-compatible 上游对 `gpt-5.5` 返回 unsupported/timeout,已记录为 `ai_model_errors_total` 且不影响 readiness/鉴权/F01/SSE 首帧。
- 阻塞:无。交接:S3 可用 `infinitechat/agent:pre-p10` 回滚旧 agent 镜像;若要真实 delta,需把生产 env 的 OpenAI-compatible model/key 换成上游支持的模型。待中枢确认:无。

### 2026-06-29 · P10 unit1/2:当前源 agent jar + docker 镜像已交付 S3 容器
- 完成:**分支 `feat/agent-backend-p10`(从新 main `086f7593` 起独立 worktree `E:\jhw\proj-agent-p10`)**。按 P10 要求用当前 main agent 源执行 `.\mvnw.cmd clean package -DskipTests` → **BUILD SUCCESS**;胖 jar `agent/target/InfiniteChat-Agent-0.0.1-SNAPSHOT.jar` 大小 98,326,432 bytes,sha256=`418526fb51a2796621ead44da3764a196b851edce46e87e5696e5d9580816901`。
- 完成:用部署 Dockerfile `D:\InfiniteChatDeploy\projecta\deploy\dockerfiles\java-app.Dockerfile` 构建 `infinitechat/agent:local`(build context=P10 worktree,`JAR_FILE=agent/target/InfiniteChat-Agent-0.0.1-SNAPSHOT.jar`)；旧镜像已备份为 `infinitechat/agent:pre-p10`(`ef8f7077...`,6/23 旧版),新镜像为 `b58d78ff...`(2026-06-29 18:09,416MB)。
- 完成:交付 S3 Docker 运行态:`docker compose -f docker-compose.yml -f /mnt/e/jhw/proj-chatbe-p9/chat/scripts/deploy/docker-golive.override.yml --env-file ~/p9-deploy/.env up -d --no-build agent` 已重建 `infinitechat-agent`;容器实际镜像 `sha256:b58d78ff...`,端口 `10011`,jar 指纹与 P10 构建 jar 一致。运行 env 已确认 `AGENT_GATEWAY_ENFORCE_IDENTITY=true`,`MYSQL_URL=jdbc:mysql://mysql:3306/agent...`,`REDIS_HOST=redis/REDIS_PORT=6379`,`PGVECTOR_HOST=postgres/5432`;未配置 `DASHSCOPE_API_KEY` 时日志显式降级 HashEmbeddingModel。
- 验证:agent readiness `GET :10011/api/actuator/health/readiness` → **200**(`db=MySQL UP`);主 health → **UP**(`redis=UP`);直连无头 `/api/agent/tools` → **401**,带 `X-User-Id` → **200 code=0**。`/app/app.jar` sha256=`418526fb51a2796621ead44da3764a196b851edce46e87e5696e5d9580816901`。
- 阻塞:无。交接:S3 可继续以 `infinitechat/agent:pre-p10` 回滚旧 agent 镜像；我继续跑生产 `:10010` A1-A4 + 内助手/F01 冲烟。待中枢确认:无。

### 2026-06-29 · P9 agent 入运行态(WSL :18080 真实库)+ 可观测收尾;网关 A1–A4 一手全绿
- 完成:**分支 `feat/agent-backend-p9`(push origin,commit `f2e40fa`/`e1e1cda`,从新 main `14eaac0` 起独立 worktree)**。把 agent **真正部署到 WSL 运行态接真实库**,并补齐 RAG/记忆/LLM 运行态指标。
  - **① agent 上线(task1)= 实测在线**:WSL `:18080` 起当前 main 真实库实例(替换 S3 `09` 的 pre-P7 降级实例 db=H2)。**接真实库**:MySQL `agent` 库(3308,P9 `CREATE DATABASE agent`,SchemaInitializer 自建表)+ Redis(6379 db6 带密码);PgVector 无凭据→**显式降级内存**、无 DASHSCOPE→LLM/嵌入降级(均 readiness 仍 200)。enforce=true。**实证**:`health` `db=MySQL`/`redis=UP(8.0.2)`、`/health/readiness=200`;直连无头→**401**、带 `X-User-Id`→**200**。**亲跑 S3 网关冲烟 `10-agent-smoke` A1–A4 = `PASS=5 FAIL=0`**(A3 登录→网关→X-User-Id→agent 全链路;A4 SSE 经网关达 agent,无 key 回 model-not-configured)。
  - **② 可观测收尾(task2)**:(a) **修 LLM 指标高基数运行态隐患**——`AiModelMetricsCollector` 原以 `user_id`+`session_id`+自由文本 `errorMessage` 打标签(无界→时间序列爆炸+缓存泄漏),收为有界维度(`model_name`+`status`/`token_type`/`error_type`),用户/会话仅入日志。(b) **新增 RAG/记忆指标**——`AgentDomainMetricsAspect`(AOP @Around,**零侵入业务**)包 `RagQueryService.chatWithCitations`+`LongTermMemoryService.write/writeWithDedup/correct`+`MemoryRetrievalService.retrieve`,导出 `agent_rag_query_duration_seconds{result}`、`agent_memory_op_duration_seconds{op,result}`(Timer 自带 count/sum→错误率)。**运行态 prometheus 实证导出**:`agent_rag_query{result=success}`、`agent_memory_op{op=write|retrieveRelevantMemories}`、`agent_ratelimit_decisions{backend=redis,result=allowed}`(**backend=redis 证真令牌桶 live**)。
  - **③ actuator 姿态(task3)**:暴露面已最小(仅 `health,info,prometheus`,无 `env/heapdump/threaddump/loggers`);`/actuator/**` 在身份白名单内供内网抓取,依赖 agent:port 仅内网可达。**未加 Basic 鉴权**(不对外路由的内网口加鉴权只增摩擦且断 prometheus/health);若将来外露建议改 localhost 绑定独立 `management.server.port`。详见 E2E-INTEGRATION §6。
- 产出物:`agent/.../monitor/{AiModelMetricsCollector,AiModelMonitorListener,AgentDomainMetricsAspect}.java`、`agent/pom.xml`(starter-aop)、`agent/docs/E2E-INTEGRATION.md` §6。验证:全量 39 测试绿(`-Plow-mem-test`);在线打包(拉 aop 依赖,胖 jar 内置)。
- 🤝 **交接 → S3(关键):** ① **运行态 agent 已被 P9 替换为真实库实例**(setsid 常驻 :18080,jar 在 `/mnt/e/jhw/proj-agent-p9/agent/target/`);**重启请把 E2E-INTEGRATION §6 的真实库 env 烘进 `09-agent-e2e.sh`/`e2e.env`**(替换原硬编码 `MYSQL_URL→:3399`/`REDIS→:6399` 降级值;原 09 pidfile 已失效)。② A1–A4 我已亲跑全绿,你可纳入常驻验收。③ 填 `DASHSCOPE_API_KEY` 可验真实 delta + `ai_model_*` 指标。
- 🤝 **交接 → 运维/可观测:** prometheus 新增 `agent_rag_query_duration_seconds`、`agent_memory_op_duration_seconds`、`agent_ratelimit_decisions_total`;`ai_model_*` 已去高基数(填 key 后产真值)。
- 阻塞:无(运行态在线 + A1–A4 全绿)。待中枢确认:① S3 把真实库 env 固化进 09/e2e.env 接管 agent 生命周期;② 填 DASHSCOPE key 验真实 LLM 流式 + token/错误指标。

### 2026-06-29 · P8 同批翻确认无 drift + 收硬化债:Mockito 本机解 OOM 全绿 + 限流可观测
- 完成:**分支 `feat/agent-backend-p8`(push origin,commit `8ff6c27`,从新 main `f9e3812` 起独立 worktree)**。
  - **① 包络收口(task1)= agent 零 drift,无代码改**:审计 + live 双证。控制器**只返 `BaseResponse`(成功 200+`code=0`)、零 `ResultUtils.error`/`ResponseEntity` 直返**;错误**全抛 → `GlobalExceptionHandler` `ResponseEntity.status(httpStatusForCode)` 映射真实 HTTP**(401/403/404/422/429/5xx);`ErrorCode` **全码显式映射**含 agent 域 `SENSITIVE_WORD_ERROR 71000→400`(不落 `code/100` 兜底)。item3 翻的 Contact/RTC/Offline/Moment 是 **chat 侧**,agent 无可翻;翻转窗口在线配合,**翻前点名前端**(收缩 `{0,200}→{0}`)。
  - **② 收 Mockito OOM 债(task2)= 解了**:历史几轮因默认 G1 fork JVM 在小内存主机预留 ~1GB 虚拟地址失败而 defer 的 Mockito 测试,**本机用 SerialGC 配方跑通**。固化为 **opt-in Maven profile `low-mem-test`**(`pom.xml`,surefire argLine `-Xmx640m -XX:+UseSerialGC -XX:MaxMetaspaceSize=300m`,不改默认)。**`./mvnw -o test -Plow-mem-test` 全量 12 类 39 测试全绿**(0 失败/错误/跳过),含 `RateLimitInterceptorTest 3/3`、`GatewayIdentityFilterTest 5/5`。
  - **③ agent 限流可观测(task3,小步)**:`RateLimitInterceptor` 放行/限流决策点加 Micrometer 计数 `agent.ratelimit.decisions`{`result=allowed|blocked` × `backend=redis|in_process`}(低基数),经 `ObjectProvider<MeterRegistry>` 注入(与既有 redis provider 同款,缺失 no-op,**不改限流逻辑**);prometheus 端点已暴露。测试加断言验计数随标签累加。
- 产出物:`agent/pom.xml`(profile)、`agent/.../ratelimit/RateLimitInterceptor.java`(metrics)+`...Test.java`(5 参 + 计数断言)。
- 🤝 **交接 → S3(同批翻转 + CI):** ① **agent 已 code=0/真实 HTTP 零 drift**,你翻 Contact/RTC/Offline/Moment 时**翻前 STATUS 点名 S2/S4**,我在线同批确认;② **Mockito 本机已不再卡** —— CI 内存充裕可直接 `./mvnw test`,受限主机用 `-Plow-mem-test`;③ **F01 真 Redis + 网关 SSE 真路径回归仍需你在常驻 WSL 栈实跑**(本机无 Redis/网关)。
- 🤝 **交接 → 运维/可观测:** 新增指标 `agent_ratelimit_decisions_total{result,backend}`(prometheus),可看限流触发频率 + Redis/进程内降级占比。
- 阻塞:无。待中枢确认:① S3 同批翻 item3(翻前点名前端);② F01 真 Redis/网关 SSE 真路径回归(S3 WSL 栈);③ DLQ consumer-lag gauge 仍是 chat 侧(S3)的 L3 债,agent 侧限流指标本轮已补。

### 2026-06-29 · P7 支撑 agent 入 E2E 栈:本机实跑降级态全验 + 修就绪探针 + 包络收口配合
- 完成:**本机 `java -jar` 把当前 main agent jar 以 E2E 降级态实跑**,把 J1 的 agent 侧行为先验一遍(不依赖网关),发现并修一个真问题。**分支 `feat/agent-backend-p7`(push origin,commit `9d1cfbf`,从新 main `37a3760` 起独立 worktree)**:
  - **① J1 agent 侧本机实测全绿**(降级 env 对齐 S3 `09-agent-e2e.sh`:`MYSQL_URL→:3399`/`REDIS→:6399`/`PGVECTOR→:5499`/`FLYWAY_ENABLED=false`/`AGENT_GATEWAY_ENFORCE_IDENTITY=true`/无 `DASHSCOPE_API_KEY`):agent **正常起**;`db=H2 UP`(MySQL→H2 降级生效);**A2 直连无 `X-User-Id` `/api/agent/tools`→401**;**带 `X-User-Id`→200**(返 `code:0` + 工具列表 → 身份消费 + 包络 code=0 **双证 live**)。
  - **② 修 redis 无关就绪探针(本轮唯一代码改)**:主 `/api/actuator/health` 在 Redis 降级时返 **503**(redis 指示器 DOWN 拖垮聚合)——但契约里 Redis 可选(全降级),**503 会让 200-就绪门/LB/k8s 探针把「可服务但 Redis 降级」误判为宕机**。`application.yml` 加 `management.endpoint.health.group.{readiness:ping,db; liveness:ping}`,主 `/health` 保留诚实聚合。**实测**:`/health/readiness`=200、`/health/liveness`=200、主 `/health`=503。**构建出的 P7 jar 重跑同样通过**(YAML 内置,非 env 覆盖)。
  - **③ 包络收口(task2)**:agent **已 code=0 + 真实 HTTP**(本轮 live 复证:成功 `code:0`、未鉴权 `401`),**无 agent 侧改动**。剩余 Contact/RTC/Offline/Moment 是 chat 侧,agent 随 S3 同批节奏配合,**翻前 STATUS 点名前端**。
- 产出物:`agent/src/main/resources/application.yml`(health 分组)、`agent/docs/E2E-INTEGRATION.md`(健康端点段 + 探针选型 + P7 实测脚注)。
- 🤝 **交接 → S3(J1,据此跑 09/10):** ① **agent 入栈代码侧已本机验证可起 + 三鉴权行为(401/带头放行/code=0)就绪**,你拷 P7 重建的 jar 入 `~/projecta-e2e/agent/target/` 后 `AGENT_SKIP_BUILD=1 bash 09 && bash 10` 跑 A1–A4 + 内助手/F01/SSE 全链路。② **就绪门控请打 `/api/actuator/health/readiness`(降级态 200),勿用主 `/health`(Redis 降级 503)**;09/10 现打主 `/health` 仅查可达性不受影响,若加 HTTP-200 断言改打 readiness(或旧 jar 临时 env `MANAGEMENT_ENDPOINT_HEALTH_GROUP_READINESS_INCLUDE=ping,db`)。③ A3/A4(经网关注入身份 + SSE 真流式)需你在常驻 WSL 栈实跑(本机无网关);填 `DASHSCOPE_API_KEY` 验真实 delta。
- 🤝 **交接 → S4/S2:** §4 SSE §9 schema / §5 F01 令牌形状无变更(P6 已 live);待 S3 把 agent 接进 E2E 栈后,你们端到端验流式回复 / F01 确认 UX。
- 阻塞:无(agent 侧本机已验)。待中枢确认:① S3 跑 09/10 + 内助手全链路实绿。② CI/HUB 复跑 Mockito(限流/过滤器,本机 fork-JVM OOM 跑不了)+ F01/限流真 Redis + 网关 SSE 真路径。③ 其余包络真实 HTTP 翻转 agent 随时同批配合(翻前点名前端)。

### 2026-06-28 · P6 IM 内助手就绪:F01/限流 Redis 多实例硬化 + J1 入 E2E 栈对接清单
- 完成:在 P5 的 F01 挑战令牌/SSE §9 基础上做多实例硬化 + 产出 agent 入 E2E 栈对接清单。**分支 `feat/agent-backend-p6`(push origin,commit `9f763ab`,从新 main `902335d` 起)**:
  - **F01 一次性消费改原子 GETDEL**:`ToolConfirmationChallengeService.consume` 原为 Redis `get`→`delete`(**非原子,并发可双消费**),改 `opsForValue().getAndDelete`(Redis 6.2+ 原子),杜绝竞态;一次性/TTL/指纹语义不变。内存兜底路径不变。
  - **限流改 Redis 令牌桶**:`RateLimitInterceptor` 原进程内固定窗口(单实例),改 **Redis 令牌桶(Lua 原子,跨实例一致)**;Redis 缺失/异常**降级进程内固定窗口**。capacity=突发上限、refill=capacity/window-seconds。构造加 `ObjectProvider<StringRedisTemplate>`,测试同步改 4 参(noRedis→验降级路径)。
  - **SSE §9 复核(无需改码)**:`StreamChatEvent.v` @Builder.Default 恒带;`/chat/auto/stream` 的 agent/RAG 工具路由 `buffered=true` 整段、direct/`/streamChat` 逐 token 省略 buffered——与 §9 一致。
  - **J1 交付 `agent/docs/E2E-INTEGRATION.md`**:网关路由前缀(`/api/agent|rag|memory|chat/auto/stream|streamChat`,保留 `/api` 前缀)、agent E2E 启动 env(硬依赖极少、其余优雅降级、**agent 不持 JWT_SECRET_KEY**)、健康端点白名单、3 条鉴权断言、SSE §9 schema(给 S4)、F01 令牌形状(给 S2)。
- 产出物:`agent/.../governance/ToolConfirmationChallengeService.java`、`ratelimit/RateLimitInterceptor.java`+`...Test.java`、`agent/docs/E2E-INTEGRATION.md`。
- 关键决策:Redis 为 F01/限流主存储(多实例正确),进程内为优雅降级(单实例,与本工程一贯降级风格一致);限流码沿用字面量 42900(错误码归一以 chat-common 为准)。
- 验证:**离线 test-compile 全过**;纯逻辑测试(F01 内存路径 / AuthPrincipal / Snowflake)`forkCount=0` 绿。⚠️ **F01/限流的真 Redis 路径 + 网关 SSE 真路径需带 Redis/网关环境实跑**(本环境无,见 E2E-INTEGRATION.md);Mockito 测试(限流/过滤器)仍受本机 fork-JVM OOM,**请 CI/HUB 复跑**。
- 🤝 **交接 → S3(J1,关键):** 见 `agent/docs/E2E-INTEGRATION.md`。**请把 agent 加进 chat E2E 栈**:① E2E `e2e.env` 设 agent `SERVER_PORT`(建议 +100 段 `18180`)+ `AGENT_GATEWAY_ENFORCE_IDENTITY=true` + E2E Redis;② 网关 `AGENT_GATEWAY_URI` 指向该端口(路由 `/api/agent|rag|memory` 已在 main);③ 起 agent 服务(最小可达只需端口+enforce,其余降级);④ E2E 加 3 断言(经网关 200 / 直连无头 401 / 伪造头网关剥离)。agent:port 须仅内网可达。
- 🤝 **交接 → S4(内助手接 agent):** 端点 + SSE §9 schema 见 E2E-INTEGRATION.md §4——缓冲式 `POST /api/agent/chat`;SSE `POST /api/chat/auto/stream`(agent 工具路由 `buffered:true` 整段)或 `/api/streamChat`(逐 token);`v` 必带、未知 type 容忍;记忆/RAG 按 X-User-Id 隔离。
- 🤝 **交接 → S2(F01 令牌形状已 live):** `data.toolGovernance{confirmationRequired:true, challengeToken, challengeExpiresInSec}`;确认后原 prompt 重发带 `confirmationToken=<challengeToken>`(`AgentRequest.confirmationToken`,勿传工具名);一次性+TTL,过期重取。P6 起 Redis 路径原子,多实例安全。
- 阻塞:无(agent 侧就绪;端到端实跑需 S3 把 agent 拉进 E2E 栈)。
- 待中枢确认:① S3 按 J1 清单把 agent 纳入 E2E 栈并跑 3 断言。② CI/HUB 复跑 Mockito 测试 + F01/限流真 Redis 路径。③ D5 出参已 string(P5),其余包络真实 HTTP 翻转 agent 随时配合(翻前点名)。

### 2026-06-28 · P5 契约收尾(D5 string id + SSE §9 版本化)+ F01 工具确认挑战令牌 + 备 agent 给 IM 内助手
- 完成:**分支 `feat/agent-backend-p5`(push origin,2 commits `f751a2d`/`7a71171`,从新 main `7c5352b` 起,独立 worktree)**。三件:
  - **① D5 string id 收尾(§5,expand/contract 双读)**:新增 `@SnowflakeId` 元注解(`@JsonSerialize ToStringSerializer`)——出参 Long id → JSON **string**;入参靠 Jackson 标量强制**天然双读**(数字/字符串都收),老前端不破。全量标注请求/响应 DTO 的 id 字段(userId/sessionId/审计行 id/StreamChatEvent.sessionId 等),**只动 id**、不碰时间戳/计数/分数/token 等非 id Long(§5 边界);`BaseResponse.timestamp` 不动。✅ 确认 **agent 成功 `code=0` 自 P2 已 live、无 200 残留**(本轮无需再翻;S3 侧 Auth+发消息端点已 code=0,其余 Contact/RTC/Offline/Moment 待与 S1 同批翻——agent 已就绪,见交接)。
  - **② SSE §9 事件信封版本化**:`StreamChatEvent` 加 `v`(schema 版本,默认 `"1"`,随每事件下发)+ `buffered`(非真增量路由显式 `true`)。`AutoChatController` 按 `supportsTokenStreaming` 给 start/delta/done 标 `buffered`(整段一次性 delta 的 agent 路由 = `buffered:true`;`/streamChat` 逐 token = 省略)。`type ∈ start|delta|usage|done|error`(usage 当前保留:流式端点暂无 token 计数,前端须容忍未知 type)。
  - **③ F01 工具确认挑战令牌**:高风险工具(email_send 等)确认从无状态 `confirmedTools`(可伪造)改为**服务端一次性 challenge token**——首次命中签发随机 token 绑定 `(userId,sessionId,工具指纹)+TTL` 存 Redis,客户端二次请求回传 `confirmationToken`(而非工具名)经指纹校验后**一次性消费**才放行(不可重放/伪造)。决策回带 `challengeToken`+`challengeExpiresInSec`。`AgentRequest`/`ChatRequest` 加 `confirmationToken`(`/agent/chat` 与 `/chat/auto` 均可用);`confirmedTools` @Deprecated(challenge 启用时忽略)。
- 产出物:`common/json/SnowflakeId.java`、16 个 DTO(id 标注)、`model/dto/StreamChatEvent.java`、`controller/AutoChatController.java`;`agent/governance/ToolConfirmationChallengeService.java`、`agent/governance/{ToolGovernanceService,dto/ToolGovernanceDecision}.java`、`agent/ReActAgentOrchestrator.java`、`chat/AutoChatRouterService.java`、`dto/{AgentRequest,ChatRequest}.java`、`pom.xml`(+spring-boot-starter-data-redis)、`application.yml`、`.env.example`;测试 `SnowflakeIdSerializationTest`(5)、`ToolConfirmationChallengeServiceTest`(5)。
- 关键决策:**F01 Redis 降级 = 进程内内存兜底(默认,`fail-closed-on-store-error=false`)**——保「服务端生成+一次性消费」不可伪造性,代价是**单实例语义**(多实例生产须接 Redis);可置 `true` 改 fail-closed 拒绝高风险工具。D5 只 string 化 id 字段、双读靠 Jackson 默认强制(不写自定义反序列化器)。
- 验证:**离线 `mvnw compile` 绿**;`spring-boot-starter-data-redis` 需联网拉一次(已 resolve,后续离线 OK)。两个新测试类 **`forkCount=0` 10/10 绿**(纯逻辑,无 Mockito,规避本机 fork-JVM OOM)。⚠️ 既有 Mockito 测试(过滤器/限流)本轮未改、仍受本机 OOM 限制,**请 HUB/CI 复跑**。F01 真 Redis 路径 + SSE 真流式联调需带 Redis/网关环境实跑(本环境无)。
- **🤝 交接 → S2(D5 翻转通知,据此一次性翻 types/hooks):** agent 出参所有 id 现为 **JSON string**(userId/sessionId/审计 id/messageId 等);入参**双读过渡**(数字或字符串都收,你可分批翻)。TS 类型把这些 id 由 `number` 改 `string`。`AgentRequest.confirmationToken`(string)= F01 二次确认入参(对齐你 M4 确认 UX,见下)。`confirmedTools` 已废弃(challenge 启用时忽略)。
- **🤝 交接 → S2(F01 确认 UX,M4):** `/agent/chat` 或 `/chat/auto` 命中高风险工具 → 返回 `data.toolGovernance{confirmationRequired:true, challengeToken, challengeExpiresInSec}`;UI 提示用户确认后,**原 prompt 重发并带 `confirmationToken=<challengeToken>`**(勿再传工具名)。token 一次性、TTL 内有效;过期/失败需重新触发拿新 token。
- **🤝 交接 → S4(IM 内助手接 agent):** 经统一网关(注入 X-User-Id)调:① 缓冲式 `POST /api/agent/chat`(JSON 包络,真流式见②);② SSE 流式 `POST /api/chat/auto/stream`(自动路由,**agent 工具路由为 `buffered:true`** 整段)或 `POST /streamChat`(逐 token 真增量)。**SSE schema(§9)**:事件 `{v:"1", type:start|delta|usage|done|error, sessionId(string), text, buffered?, citations?, ...}`,SSE event 名=type,`v` 必带,未知 type 须容忍。**隔离保证**:记忆(四层)/RAG 全程按网关 `X-User-Id` 隔离(P3 已收敛 userId 来源,本轮复核 ReAct 编排/记忆/审计深层确为 `request.getUserId()`=principal,**无残留 body userId**);直连无网关身份 → 401。
- 阻塞:无(改动 agent-only、自洽)。
- 待中枢确认:① **HUB/CI 复跑 Mockito 测试 + F01 真 Redis/SSE 真流式联调**(本机跑不了)。② **D5 翻转节奏**:agent 出参已 string 化,S2 据交接一次性翻 types(双读过渡期老前端不破)。③ **其余包络真实 HTTP 翻转**:agent 侧已全 `code=0`+真实状态;S3 提议 Contact/RTC/Offline/Moment 翻转与 S1 同批——agent 无残留、随时可配合,翻前 STATUS 点名即可。

### 2026-06-27 · P4 RAG 真嵌入 + 检索/引用阈值解耦(主线 M15/F06/F07)
- 完成:补 agent 真实价值缺陷的主线。**分支 `feat/agent-backend-p4`(push origin,commit `9a875da`,从新 main `db84e48` 起)**:
  - **① 真实语义嵌入 @Primary(F06/M15)**:`AiModelConfig.embeddingModel()` 有 `DASHSCOPE_API_KEY` 时返回 **QwenEmbeddingModel(text-embedding-v4)**,dimension 对齐 `pgvector.dimension`;否则**显式降级** `HashEmbeddingModel`(WARN 日志,仅本地无网络跑通)。`langchain4j-community-dashscope` 已在 pom、`QwenEmbeddingModel` 类已核实存在(javap 确认 builder 有 apiKey/modelName/dimension)。
  - **② 检索召回阈值 ↔ 引用展示阈值解耦(F07)**:`VectorSearchService` 检索过滤改用 `rag.retrieval.min-score`(默认 **0.0**,广召回交 RRF+Rerank),不再用高的 `citation.min-score`(这正是"向量召回近乎为 0"的根因);`rag.citation.min-score`(0.75)改为 `RagQueryService` **重排后置展示门 + top-1 兜底**(高阈值永不把可答问题清空)。两旋钮均 env 可配,**待真模型 live 标定后上调**。
  - **③ 切模型自动重嵌入**:把嵌入模型签名(className)并入 `DocumentIngestionService` 内容哈希——切换 Hash↔真实嵌入时旧片段被 purge 重嵌入,避免"接了真模型但库里仍是旧哈希伪向量"导致检索失效。
  - `EmbeddingStoreConfig` 维度改从 `pgvector.dimension`(原写死 1024)。
- 产出物:`config/{AiModelConfig,EmbeddingStoreConfig}.java`、`rag/{VectorSearchService,RagQueryService,DocumentIngestionService}.java`、`application.yml`、`.env.example`。
- 关键决策:**检索低阈值 + 展示高阈值 + top-1 兜底** 的三段式——既修召回(检索 0.0)又不因未标定的高阈值再次把 RAG 打死(top-1 永不清空);嵌入签名入哈希让模型切换真正生效。
- 验证:**离线 `mvnw compile` 绿**。⚠️ **真嵌入的召回增益需 live `DASHSCOPE_API_KEY` + PgVector 才能验**(本环境无 key/无 PgVector,起不了);**请 HUB/CI 或在有 key 的环境实跑** `/rag/chat` 对比 hash vs 真嵌入召回,并据真实分布**标定 citation.min-score**。上轮 Mockito 测试的主机 OOM 仍在,本轮无新增测试。
- 阻塞:无(改动自洽、agent-only)。
- 本轮**未做 / 顺延**:
  - **F08 关键词全文索引 + 中文分词**:可选,属独立单元(MySQL ngram fulltext 需配套 Flyway 索引 + 分词器),未与嵌入主线捆绑。
  - **D5 string id 收尾**:仍需 S2 协同(S2 明确"需通知后一次性翻 types/hooks")+ 是响应全量 id 串化的大改 → 下个独立单元做,**翻前 STATUS 通知 S2**。
  - **item 3 成功 code=0**:P2 已落 main(确认 live);S3 chat 侧真实 HTTP/code=0 仍未翻(STATUS 记其包络漂移),但分库分前端,不影响 agent。
- 交接 → 中枢/运维:`DASHSCOPE_API_KEY` 现同时驱动 RAG 真实嵌入;**首次切到真嵌入需重新 ingest**(内容哈希已含嵌入签名,RagDataLoader 启动会自动重嵌入;PgVector 表维度须与 text-embedding-v4 的 1024 一致)。
- 待中枢确认:① 有 key 环境实跑 RAG 真嵌入召回 + 标定 citation.min-score。② D5 string id 翻转排期(我翻前通知 S2)。③ F08 是否排独立单元。

### 2026-06-27 · P3 鉴权闭环(agent 侧):翻 enforce + 删 body userId + 退役 X-Admin-Token
- 完成:S3 网关 front agent(`043c2bb` 在 main)后,完成 agent 侧 contract 相闭环。**分支 `feat/agent-backend-p3`(push origin,commit `a68b2a7`,从新 main `1c722aa` 起)**:
  - **翻 `enforce-identity` 默认 true(item 1)**:非公开请求缺失/非法网关注入的 `X-User-Id` 一律 **401**(拒直连/绕过);`GatewayIdentityFilter` @Value 默认 + `application.yml` + `.env.example` 全翻 true。本地无网关联调设 `AGENT_GATEWAY_ENFORCE_IDENTITY=false` 并自带 X-User-Id。
  - **删 body/param userId 回退(contract 相,B1)**:移除 `AuthPrincipal.resolveUserId`,控制器改用 `requireUserId()`(缺失 401);`/memory/user/{userId}` 用 `requireSelf`(越权 403);移除 sessions/memory/toolAudit 的 `@RequestParam userId`;请求体 userId 被主体覆盖(客户端值永不被信)。reflection 端点也主体化。**至此 agent 全栈只信网关身份。**
  - **退役 P0 `X-Admin-Token`**:`/chat/model-config` 仅认网关注入的 admin 角色(否则 403);删 token 字段/header/常量时比较 + `agent.admin.token`/`AGENT_ADMIN_TOKEN`。
  - **item 2(code=0 + 真实 HTTP 状态)**:P2 已落 main、本轮确认 live;错误码 7xxxx 域(P2 已做)。
- 产出物:`security/{AuthPrincipal,GatewayIdentityFilter}.java`、`controller/{AiChat,Agent,Memory,RagChat,AdaptiveRag,AutoChat,ChatHistory}Controller.java`、`application.yml`、`.env.example`、`AuthPrincipalTest`(改测 requireUserId/requireSelf)。
- 关键决策:**enforce 默认 true = secure by default**;body userId 字段保留为内部载体但客户端值总被 principal 覆盖(语义上"删 body userId")。
- 验证:**test-compile 全过**(全量 sweep 编译一致,无 resolveUserId 残留);`AuthPrincipalTest`(requireUserId→401 / requireSelf→403 / isAdmin)进程内**绿**。⚠️ **两个 Mockito 过滤器测试(GatewayIdentityFilter/RateLimit)本轮未能执行**——主机 OOM(G1 1GB mmap 失败)起不了 fork JVM,被迫 `forkCount=0` 又破 Mockito inline mock-maker;两者逻辑这轮未改、P2 已绿。**请 HUB/CI 在非受限主机复跑。**
- **配合全栈鉴权 E2E(item 3):agent 侧已就绪**——经网关带 token→注入 X-User-Id→200;直连无头→401;伪造 X-User-Id 由网关剥离(网关职责,同 T11)。**全栈 E2E(agent 经网关 200 / 直连 401)需中枢/S3 跑**(我无法在本环境起 WSL 中间件 + 多服务全栈)。
- **交接 → S2(重要,可能影响 dev 联调):**
  1. ⚠️ **enforce 已默认 true** → agent-frontend **必须经统一网关(:10010)访问 agent**(网关注入 X-User-Id);**直连 agent:18080 将 401**。dev proxy 应指向网关,而非直连 18080;或纯本地无网关时设 `AGENT_GATEWAY_ENFORCE_IDENTITY=false` 并自带 X-User-Id 头。
  2. **body/param userId 已彻底移除**——不要再传(已忽略),userId 来自网关身份。
  3. **model-config 仅 admin 角色**(网关 `X-User-Roles` 含 admin);`X-Admin-Token` 已废。
  4. 成功 `code=0` + 真实 HTTP 状态已 live(你 `{0,200}` 双兼容,无须改)。
- 阻塞:无(agent 侧闭环完成)。
- 待中枢确认:① **HUB/CI 复跑 Mockito 测试**(本机 OOM 跑不了)。② **全栈鉴权 E2E**(agent 经网关 200 / 直连 401)由中枢/S3 验。③ **D5 string id**(下轮做,翻前通知 S2)。④ **Flyway 退役 SchemaInitializer** 本轮未做(非冲刺必需;仍需 Flyway 双兼容 MySQL/H2 成单一 owner 的独立单元)。

### 2026-06-27 · P2 错误码归一 + 真实 HTTP 状态翻(items 2+3;依赖 S3 chat-common 已交付)
- 完成:吃透 S3 已交付的 chat-common(`a22c3b2`,unit1),按其最终 `CommonError` 表把 agent 包络/错误码**一次性版本化翻**,落分支 **`feat/agent-backend-p2`(push origin,commit `50bad45`,从新 main `e182a0c` 起)**:
  - **错误码归一(item 2)**:重写 `common/ErrorCode`,每码带真实 `httpStatus`,对齐 chat-common 规范码(`0/40000/40100/40300/40400/40900/42200/42900/50000/50300`)+ agent 域 `7xxxx`(`SENSITIVE_WORD_ERROR=71000→400`)。**删掉 chat 继承的死码**(`TOKEN_*`、`70xxx` 用户、`90xxx` WS 等,全 0 引用)——停用 agent 自有分叉。
  - **真实 HTTP 状态翻(item 3)**:成功包络 `code 200→0`(ResultUtils);`GlobalExceptionHandler` 改返 `ResponseEntity` 带真实状态(401/403/404/422/429/500/503),**停"全 200 + 体内 code"**;`@Valid` 失败→`422 + data.fieldErrors=[{field,message}]`(契约 §3);`spring.jackson.default-property-inclusion=non_null`(§2 全栈一致)。网关身份 401(40100)/限流 429(42900)本就真实状态,现全错误一致。
  - 测试:身份/限流/RagDocument/护轨 5 类绿;离线 `mvnw` 绿。
- 产出物:`common/{ErrorCode,ResultUtils}.java`、`exception/GlobalExceptionHandler.java`、`application.yml`(jackson)。
- 关键决策:错误码以 **03-contracts §3 为唯一基准**镜像(agent 不依赖 chat-common 工件);guardrail 拦截归 agent 域 `71000`(400)。**安全无破 S2**:S2 自述 D4 `{0,200}` 双兼容 + 真实状态自动适配(其 ledger),故 agent 单侧翻不破前端。
- 阻塞:无(本翻自洽;下列 gated 项等 S3)。
- **本轮 gated、未做(到位即接,不返工):**
  1. **item 1 翻 `enforce-identity=true`** — 等 **S3 网关 `/api/agent|memory|rag` 路由 + 验签(unit2,STATUS 记"进行中")**。就绪后我翻 enforce + 验拒直连(无 X-User-Id→401)、验伪造 X-User-Id 被剥离 + 退役 `X-Admin-Token`(改认网关 admin 角色)。**现在翻会 401 掉本地无网关的直连联调,故不翻。**
  2. **item 4 D5 string id** — chat-common 已落,但 S2 明确"D5 翻转**需通知**、之后一次性翻 types/hooks"。属独立单元:我下轮在持久化边界做 Long↔String 双读(expand/contract)+ 响应 id 串化,**翻前在 STATUS 通知 S2**。
  3. **item 5 退役 SchemaInitializer** — chat-common **未导出 Flyway/迁移约定**(分库 D6,各服务自管 schema);且退役与 P0 的"Flyway 默认 off + H2 降级保本地启动"耦合(退役后 Flyway-off 本地无人建表)。需单独一单元(让 Flyway 成 MySQL+H2 双兼容的唯一所有者),非快速件。**待中枢确认是否本轮范围。**
- **交接 → S2(本轮契约变更,S2 双兼容应无须改,但告知):**
  - 成功响应 `code` 现为 **`0`**(原 200;你已 `{0,200}` 双兼容);错误现返**真实 HTTP 状态**(401/403/404/422/429/5xx)+ 包络 code(你已自动适配)。
  - `@Valid` 失败:HTTP **422** + `data.fieldErrors=[{field,message}]`;限流:**429** + `Retry-After` + code `42900`;护轨拦截:**400** + code `71000`。
  - 响应 JSON 现 **NON_NULL**(null 字段省略)——按"缺失==null"解析。
  - **string id(D5)翻转我会单独提前通知**(你那时一次性翻 types/hooks)。
- 待中枢确认:① S3 网关 agent 路由(unit2)就绪时间 → 我翻 `enforce-identity`。② item 5 退役 SchemaInitializer 是否本轮范围(需让 Flyway 双兼容 MySQL/H2 成唯一 owner)。③ D5 string id 翻转节奏(我翻前通知 S2)。

### 2026-06-27 · P1b 不返工件:userId sweep 补全 + @Valid + 计费限流 + 结构化日志
- 完成:P1b item-1(非阻塞、不返工的契约安全活)落地,**分支 `feat/agent-backend-p1b`(push origin,3 commits)**,均从新 main `863af6b` 起。
  - **① body userId sweep 补全**(`b013906`):上轮未扫的 Rag(`/rag/chat`、`/rag/adaptive/chat`)、Auto(`/chat/auto`、`/chat/auto/stream`)、ChatHistory 会话(`/sessions`、`/sessions/{id}`、`/summarize`、create)全部接 `@CurrentUser`(principal 优先、body/param 回退)。RagDocument 端点不含 userId、无需扫。**至此 agent 全部按 userId 的端点都已收敛到网关身份(仍 expand 相)。**
  - **② @Valid 激活**(`ad5a8aa`):加 `spring-boot-starter-validation`(Boot3 web 不再传递→原 handler 是 L8 死代码);chat/agent/adaptive 的 `prompt` `@NotNull`;7 个 LLM 端点 `@RequestBody` 加 `@Valid`。保守约束(只 `@NotNull prompt`,保留"空 prompt 问候"路径)→ 不破任何合法请求。
  - **③ 计费限流**(`a3fa526`):`RateLimitInterceptor` 对 7 个 LLM 端点按主体(网关 userId,否则客户端 IP)固定窗口限流 → **429 + `Retry-After` + 体内 `code 42900`**(契约 §3 RATE_LIMITED,字面量、不动 `ErrorCode` 枚举);默认 30 次/60s 可配;进程内单实例(后续 Redis 令牌桶)。
  - **④ 结构化日志**(同上 commit):`logging.pattern.level` 注入 `[traceId=%X{traceId}]`(TraceIdFilter 的 MDC),每行带链路 id。
  - 测试:`RateLimitInterceptorTest` 3 例(capacity/独立桶/disabled)离线绿;`mvnw compile` 绿。
- 产出物:新 `agent/.../ratelimit/{RateLimitInterceptor,test}.java`;改 `config/WebConfig.java`、`controller/{RagChat,AdaptiveRag,AutoChat,ChatHistory}Controller.java`、`{AiChat,Agent}Controller`(@Valid)、`{ChatRequest,AgentRequest,AdaptiveRagRequest}`(@NotNull)、`pom.xml`、`application.yml`、`.env.example`。
- 关键决策:**错误码归一 / 真实 HTTP 状态 / 成功 code=0 全部未动**——遵仲裁"S1 暂勿定死 ErrorCode 编号,等 chat-common";限流码 42900 用字面量避免预占枚举。**OTel 完整分布式 span 故意不在 agent 单独半做**(会与已交付的 X-Trace-Id(MDC key `traceId`)撞键、且需 collector + 网关/chat 对齐)→ 作为系统级协调步骤后续;契约要求的 X-Trace-Id 透传+MDC+响应头已满足。
- 阻塞:无。
- **待 S3(gated,已"可对接",到位即翻、不返工):**
  1. **chat-common 交接** → 我按 §3 对齐 agent `ErrorCode` 编号(agent 用 `7xxxx` 域子段)并**同步翻**:成功 `code 200→0`、错误映射真实 HTTP 状态(停 200)、`@Valid` 失败→`422/42200/data.fieldErrors`。**翻前在 STATUS 通知 S2**。
  2. **网关 `/api/agent|memory|rag` 路由+验签就绪** → 翻 `AGENT_GATEWAY_ENFORCE_IDENTITY=true` 验拒直连 + 删 body/param userId(contract 相)。
  3. **chat-common Flyway 约定** → 退役 agent 三个 `*SchemaInitializer` 改 Flyway 单一所有权。
- 交接 → S2(补充):① **限流**:计费端点 `429 + Retry-After + code 42900`,前端应退避重试+提示;② **@Valid**:缺 `prompt` 会被拒(当前 50003+200,同步翻后转 422+42200+fieldErrors);③ ⚠️ **现状提醒**:agent 成功响应当前仍 `code=200`(P1-① 加法保留),与 §2 的 `code=0` 暂不一致——属"与 S3 同步翻"范畴,前端先按 `code===200` 判成功,我会在翻 `0` 前一轮通知。其余(不自塞 X-User-Id、过渡可带 body userId、包络含 traceId/响应头 X-Trace-Id)同 P1-① 记录。
- 待中枢确认:① S3 chat-common 交接时间(解锁错误码归一 + 同步翻)。② 真实 HTTP 状态 + 成功 `code 0` 同步翻的节奏窗口(S1↔S3 同步、翻前通知 S2)。

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

### 2026-06-29 · P12 · agent-frontend v1.0.0 + 生产 UI 卡片级 F01/§9 实证(分支 `feat/agent-frontend-p12`)
- 完成:从 `main` `bfbd470` 起独立 worktree `.claude/worktrees/agent-frontend-p12` + 分支 `feat/agent-frontend-p12`。前端发行打磨:版本号升到 `1.0.0`;F01 卡片增加 300s 失效窗口文案;`更多细节` 原始响应对 `challengeToken`/`confirmationToken` 递归脱敏,避免把一次性确认口令暴露到可复制调试块。F01 resend 代码路径保持 P10 语义:只回传服务端 `challengeToken` 到 `confirmationToken`,不传工具名。
- 完成:生产 Docker 真栈 UI 卡片级 F01 实证(不 mock):Vite `:5183` 代理到 WSL 生产 gateway `100.122.46.119:10010`;Chrome CDP 自动化真实 UI 登录临时账号 `s2_p12_220145@lingxi.test`;将 active session 设为真实 string sessionId `s-lingxi`;通过「更多操作」命令选择「智能助理 /agent-chat」;发送高风险邮件 prompt → UI 渲染确认卡 → 点击「确认并继续」。Network/CDP 捕获:首次 `/api/agent/chat` body 为 `{"userId","sessionId":"s-lingxi","prompt"}`;确认请求 body 为 `{"userId","sessionId":"s-lingxi","prompt","confirmationToken":"2x6_JDTETuDRc_-4jqRpepzv1o4HlTsG"}`;确认 body 无 `confirmedTools`/`toolName`/`toolNames`/`pendingTools`。确认后 UI 渲染真实后端结果 `邮件发送失败: Could not parse mail`。
- 完成:F01 一次性/TTL 实证(同生产 gateway + 同真实 JWT/session):同 token `2x6_JDTETuDRc_-4jqRpepzv1o4HlTsG` 重放 → 后端重新 `confirmationRequired=true` 并签发新 token `cvDYUHpsO010WXLFkbud1PEt7WJQCQtx`,未执行工具;另取 token `jYSBRg7p_y8fzODkC6bkQJJGz88aWt_2`,等待 `challengeExpiresInSec=300` + 8s 后携旧 token 请求 → 重新 `confirmationRequired=true`,新 token `x_aboPvuDuMY4VxbW1WiMrKWi30xpuQy`,`expiredSameToken=false`。
- 完成:§9 SSE 生产实证:直接打真实 `/api/chat/auto/stream` with `sessionId:"s-lingxi"` 返回 `text/event-stream`,帧含 `v:"1"` + `type:"start"|"delta"|"done"`;未知 type 容忍仍由现有 `api.test`/`useChat.test` 回归覆盖。
- 产出物:`agent-frontend/package.json`,`agent-frontend/package-lock.json`,`agent-frontend/src/features/chat/{ToolConfirmation.tsx,ToolConfirmation.test.tsx,MessageTimeline.tsx}`,`docs/planning/STATUS.md`。
- 验证:5 门绿: `npm run typecheck`;`npm run lint`;`npm run format:check`;`npm run test`(8 files / 70 tests);`npm run build`(exit 0,仅既有 HeroUI CSS `:is()` minify warning + chunk-size warning)。生产浏览器/网络实证 artifact 留在本 worktree `.artifacts/p12-cdp-ui-flow-5.json`,`p12-ttl-expiry.json`,`p12-sse.txt`(不入库)。
- 阻塞:无。风险/备注:Windows `127.0.0.1:10010` 仍偶发不可达/代理干扰,本轮用 WSL IP `100.122.46.119:10010` 做同一生产 Docker gateway 真栈验证;生产 `/api/actuator/health` 经 gateway 仍 404(既有),不影响 F01/§9。
- 交接:HUB 可并入/打 v1.0.0 tag 前复核本分支。S3 若要前端 dev proxy 默认避开 Windows NAT,可考虑在本机文档建议 `.env.local VITE_API_PROXY_TARGET=http://<WSL-IP>:10010`。
- 待中枢确认:无。

### 2026-06-29 · P10 · 生产 F01/§9 补验 + 命令 Popover 修复(分支 `feat/agent-frontend-p10`)
- 完成:从新 main `086f759` 起独立 worktree 分支 `feat/agent-frontend-p10`。按 `agent/docs/E2E-INTEGRATION.md` 复核 F01/§9 后,指向生产 Docker `:10010` 做验证；Windows host 直连 `127.0.0.1:10010` 曾超时,本轮采用本地捕获代理 `127.0.0.1:19010 -> WSL 100.122.46.119:10010` 且剥离上游 Origin(否则生产 gateway 对部分 chat 请求返 `Invalid CORS request`),浏览器 dev server `127.0.0.1:5182` 通过该代理访问生产。
- 完成:生产登录/会话/聊天冒烟:用 Redis 验证码注册临时生产账号并在浏览器 UI 完成密码登录；剥离 Origin 后 `/api/chat/model-status`、`/api/chat/sessions` 均返 `code:0`；`/api/chat/auto/stream` 在 agent 冷启动窗口曾出现 `agent:10011 connection refused`,agent ready 后用数字 sessionId 重试得到真实 `text/event-stream`。
- 完成:F01 生产实证(经生产 gateway + agent + Redis):高风险邮件 prompt 首次返回 `toolGovernance.confirmationRequired=true`、`challengeToken`、`challengeExpiresInSec=300`;确认请求体只有 `userId/sessionId/prompt/confirmationToken`,无 `toolName/toolNames/confirmedTools/pendingTools`;确认后不再要求确认并尝试执行邮件(因正文缺失返回 "Could not parse mail");同 token 重放不执行工具而重新进入确认态；TTL 等待 300s+ 后旧 token 确认同样重新进入确认态,重新触发可拿到新 challengeToken。
- 完成:§9 生产 SSE 实证:数字 sessionId 下 `/api/chat/auto/stream` 真实返回 `text/event-stream`,事件含 `v:"1"`、`type=start|delta|done`,direct route,UI/解析链路可消费该形状；后端本轮未实际发 `buffered:true` 或未知 `type`,这些兼容仍由现有 `api.test`/`useChat.test` 回归覆盖(未伪造生产网络事件)。
- 完成:修一个本轮浏览器阻断点: `ComposerActionsPopover` 原把 HeroUI `Button` 放进 `Popover.Trigger`(Trigger 自身渲染 `div role=button`)导致无效嵌套 button,点击后只 active 不挂命令列表；改为受控 Popover + Trigger 自身承载圆形按钮样式,命令选择后关闭。in-app browser DOM 复证:嵌套按钮数 0,`/agent-chat` 命令列表可见。后续 in-app browser 在选择 option 时崩到自身 `data:` crash interstitial,非应用/Vite 崩溃；本机 Playwright 包缺浏览器二进制,未再补完整 UI 卡片点击流。
- 产出物:`agent-frontend/src/features/chat/ComposerActionsPopover.tsx`,`agent-frontend/src/styles.css`,`docs/planning/STATUS.md`。
- 验证:5 门绿: `npm run typecheck`; `npm run lint`; `npm run format:check`; `npm run test`(8 files/69 tests); `npm run build`(exit 0,仅既有 CSS/chunk size warning)。生产只读/验证: `infinitechat-agent` health UP(db/redis UP),`infinitechat-gateway` 通过代理访问。
- 阻塞/风险:① E2E 栈 Redis `:6399` 仍 down(P7-P9 欠账未由 E2E 环境解阻),所以本轮改走生产镜像路径收口；② 生产 agent 的 `AgentRequest.sessionId` 仍按 `Long` 反序列化,字符串 sessionId 会 500,与 D5 string-id 契约不一致,前端 UI 当前按 string 发送会影响 F01/agent 模式真 UI；本轮 F01 生产语义用数字 sessionId 验通；③ 生产 `/api/actuator/health` 经 gateway 仍 404,健康用 WSL 直连 agent `:10011/api/actuator/health` 验。
- 交接:S1/S3 需要修 agent `AgentRequest.sessionId` string 双读/出参契约,并修 E2E Redis `:6399` 后再补真正 `:10110` 浏览器级 F01/§9；若要求完全 UI 卡片级 F01,需在后端 sessionId 契约修好后重跑。
- 待中枢确认:是否将本轮发现的生产 gateway CORS/Origin 约束固化到 dev proxy/部署配置；是否把 agent `sessionId Long` 作为 P10/P11 阻断项处理。

### 2026-06-29 · P9 unit 1+2 · envelope 200 收缩 + Vite proxy 修通(commit `c8ebec3`)
- 分支:`feat/agent-frontend-p9`(独立 worktree:`.claude/worktrees/agent-frontend-p9/`,从新 main `14eaac0` 起,HTTPS push,**未合 main**)。
- **unit 1 · envelope `{0,200}→{0}` 收缩(已被中枢点名,STATUS 行 28-29):** P8 集成 `14eaac0` 已完成全栈包络收口(Contact/RTC/Offline/Moment 翻 chat-common Result code=0 + 真实 HTTP;flip-regression E2E 12 6/6 绿)。本前端 D4 expand/contract 窗口收掉:`api.ts` `ENVELOPE_SUCCESS_CODES = new Set([0, 200])` → `new Set([0])`;原 D4 注释改写为引用 P8 closeout commit。**新增 regress 用例**(api.test.ts):envelope `code=200` 在 P8 后必须被 `ApiError` 拒绝 —— 防止某服务静默回归到把 200 当 success(那会吞真错误)。改老 fixture 把 `code:200` mock 翻成 `code:0`。
- **unit 2 · Vite dev proxy POST 500 真因 + 修通(P8 误诊订正):** P8 STATUS 把 dev proxy POST 500 写成 "Vite-5/Node-22 keep-alive 噪声 / 与 F01 无关",P9 实证发现是**两个独立 bug 叠加,与 Vite 自身无关**:
  - **① env 传递断链 — `process.env` → `loadEnv`:** vite.config.ts 用 `process.env.VITE_API_PROXY_TARGET` 读环境变量,但 dev launcher(preview MCP、部分 dev shim)对 launch config 的 `env:` 字段**透传不稳**,vite 拿默认 `:10010` → :10010 在 WSL 段未 routed (WSL2 NAT) → `connect ETIMEDOUT` → Vite 报 empty-body 500。**修:** 用 vite 的 `loadEnv(mode, __dirname, "")` 链式读 `.env.local` / `.env.development.local` / `.env.development` / `.env`,launcher env 断也能 work。开发者在 `.env.local`(gitignored)写 `VITE_API_PROXY_TARGET=<目标>` 即可锁定 dev proxy 目标。
  - **② 网关 CORS 收紧后 proxy 的 Origin 不再命中白名单:** P6 S3 `4584ae5` 把网关 CORS 硬化到 production `allowedOriginPatterns: http://localhost:[*]`(**任意 localhost 端口,不含 raw 127.0.0.1**)。本前端 Vite proxy 原来写 `Origin: <proxy target>`(P5 时命中"信任自身"那条),P6 后**全被网关 403 `Invalid CORS request`**。**修:** Vite proxy `configure` 钩子把 Origin 固定写成 `http://localhost:5173`(白名单内 hostname,与浏览器实际加载 host 解耦),无论浏览器走 localhost / 127.0.0.1 都过 CORS。原 `headers: {origin}` 改为 `configure: proxyReq.setHeader`,header 注入时机更稳健 + 便于后续加 5xx 调试 hook。
- **unit 3 浏览器 F01/§9 E2E · 部分阻塞:**
  - ✅ **登录 + token 注入 + Vite proxy + 网关 + 注入 X-User-Id 整条链路 wire-shape 通**(实证:spawn vite 5180 → `POST /api/v1/user/login` 经 proxy 200 + code:0 + string userId + access/refresh token;`POST /api/agent/chat` 不再 403 CORS,**直达 agent 业务层**)。
  - 🛑 **F01 真 token 往返 / §9 流式真渲染仍阻塞 Redis :6399 down**(P8/P7 同症):agent 业务路径返 `code:50000`,traceId 链回 `LettuceConnectionFactory → connect 127.0.0.1:6399 timed out`(F01 token / 记忆 / 会话写 Redis 全 fail)。**这是 S3 E2E 栈维护问题,非前端**,前端 wire-shape 已 Vitest+spawn-curl 双证 P5 wave2 起对齐 P7 `11-assistant-e2e` 5/5 后端形(toolGovernance 结构、`v="1"`、buffered、未知 type 容忍均在 useChat.test/ToolConfirmation.test 16+5 用例覆盖)。
- **task 3 (登录/聊天指向运行态 `:10010`)· 双重阻塞 S3 P9 上线:**
  - WSL 内部 `:10010` 在线但 **Windows host 不可达**(WSL2 NAT 转发问题,curl 4s timeout)。
  - 即便 reach,`:10010` 仍是 **pre-P0 旧栈**(WSL 内部 curl 返 `{code:40003, msg:"登录失败,用户名或者密码错误"}` — 旧 envelope:**字段 `msg` 不是 `message`、code `40003` 不在 chat-common Result 域、账号库与 E2E 段也不通**)。
  - 用户拍板(STATUS 行 28-29):"P9 = 上线:WSL 运行态切到 v0.x 替换 pre-P0 无鉴权旧栈" — 是 S3 P9 主活,本轮**未完成**。本前端 vite.config 默认 proxy target 仍是 `:10010`,S3 切到 v0.x 后**零代码改动**(`.env.local` 也无需写,默认就指 :10010)。
- 5 大门(逐轮):tsc / lint / prettier / vitest(**8 文件 / 69 测试**,新增 1 个 200-as-error regress)/ vite build 全 exit 0。
- 产出物:`agent-frontend/src/{api.ts, api.test.ts}` + `agent-frontend/vite.config.ts`(3 文件 / +80 / -43)。
- **🛑 给 S3(E2E 栈维护 — 同 P7/P8 交接):** WSL Redis e2e `:6399` 仍 down(P7 起一直 timeout 没改),是 F01/§9 真路径端到端唯一阻塞点。重启即可解阻 — 后端代码未动,P7 `11-assistant-e2e` 5/5 当时绿。重启后请在 STATUS 标"E2E Redis 已恢复",我即可 spawn vite + 浏览器一并跑 F01 token 真往返(网络面板验 `confirmationToken=<challengeToken>`、一次性消费、TTL 过期重取)+ §9 流式真渲染 6 步实证,补上 P7-P9 累积欠的"S2 浏览器级 E2E"。
- **🛑 给 S3(P9 上线主活 — 完成度):** `:10010` 当前仍 pre-P0 旧栈(WSL 内 curl 返 `code:40003 msg:登录失败` 旧 envelope)+ Windows host 不可达。**用户拍板 P9 = 上线 v0.x 替换无鉴权旧栈,本轮未到位。** 切完后请在 STATUS 标"运行态 `:10010` 已切 v0.x",前端不需要任何改动即可冒烟(vite.config default proxy target 仍 `:10010`)。
- 待中枢确认:无。


### 2026-06-29 · P8 unit 0 · F01/§9 浏览器 E2E 阻塞 + 包络收缩待点名(无代码变更)
- 分支:`feat/agent-frontend-p8`(独立 worktree:`.claude/worktrees/agent-frontend-p8/`,从新 main `f9e3812` 起,HTTPS push,**未合 main**)。
- **现状判断:** P8 prompt 两件主活在本轮**均无法 ship 真路径产出**,**不强行**(用户红线"网关/Auth 起不来时不硬上 mock 伪造通过"):
  1. **task1 F01/§9 浏览器 E2E**:**E2E 后端栈半挂**——agent(`:18080`)/网关(`:10110`)进程仍在(setsid 跨会话存活生效),但**Redis e2e `:6399` connection timeout**(`redis-cli -p 6399 ping` 超时;`agent.log` 重复 `LettuceConnectionFactory → Unable to connect to 127.0.0.1/<unresolved>:6399`)。**所有 chat 路径返 `code:50000`**(直连 `/api/agent/chat`、`/api/chat`、`/api/chat/auto/stream` 三条全 50000,底层在 Redis 写 F01 token/会话/记忆时抛 RuntimeException,被 GlobalExceptionHandler 兜底成 50000)。**鉴权管线本身仍活**:`/api/v1/user/login` curl 直打 :10110 返 `code:0` + string userId + token + refreshToken(envelope 双兼容路径仍 wire-compatible)。
  2. **task2 包络收缩 `{0,200}→{0}`**:**未到点名时机**——S3 P7 STATUS(行 493)`📣 P7 牵头 item3 包络收口——翻前点名 S2/S4/S1(待同批,**尚未翻**)`;P7 集成 commit `f9e3812` 摘要"🟡 item3 包络收口:Contact/RTC/Offline/Moment 翻 code=0/真实 HTTP(S3 已**翻前点名**未翻,需 S1 同批 + S2/S4 ack,**翻后**前端收缩 `{0,200}→{0}`)"。P8 prompt 写"收 S1/S3 点名后"——**今轮未点名,不动**。
- **本轮做了什么:**
  - 起独立 worktree + 分支(按 P6 收口规约,STATUS 写本分支)。
  - 拉新 main 后回归扫:tsc / D5 number id 残留(零)/`v` 类型(string,与 P7 unit 1 一致)。**前端代码已 wire-compatible P7 11-assistant-e2e 5/5 后端**(F01 形状 + §9 v="1"/buffered + envelope `{code,message,data,traceId,timestamp}` 全字段都对齐)— **无代码需改**。
  - 浏览器实证尝试:Vite dev server 起 5173,代理 `:10110`;在登录页填邮箱+密码 → 触发 POST `/api/v1/user/login` → **代理回 500**(curl 直打 :10110 同请求是 200;Vite 代理与上游 keep-alive/chunked 交互异常,属于 dev-proxy 噪声,与 F01 验收无关 — 改用 storage 直注 token 也可绕过 Vite 代理,但 agent 端 50000 仍堵真路径)。
- **🛑 给 S3(E2E 栈维护):** WSL Redis e2e `:6399` down 是当前**唯一**真路径阻塞点。重启 Redis(`e2e.env` 端口/密码/db6 隔离照旧)→ agent 恢复读写 → S2/S4 即可补跑浏览器级 E2E(`11-assistant-e2e` 5/5 当时绿过,后端代码未动,只是基础设施掉链)。重启前/后请在 STATUS 标"E2E Redis 已恢复",我即可起 Vite 浏览器实证:① 触发 `email_send` 风险 prompt → 验 `data.toolGovernance{confirmationRequired,challengeToken,challengeExpiresInSec}` → 点"确认并继续"→ Network panel 验 `AgentRequest.confirmationToken=<挑战令牌>`(**勿传工具名**)→ 一次性消费(同 token 重发被拒)+ TTL 过期(等过 expires 再发被拒,需要 S1 把 challengeExpiresInSec 调小到 30s 便测)。② 流式 prompt 验 `v="1"`、buffered:true/逐 token、未知 type 容忍。
- **🛑 给 S1/S3(包络翻转点名锚):** Contact/RTC/Offline/Moment 翻 code=0 + 真实 HTTP 后请在 STATUS 写"**S2 可关 200 兼容**"一行;我会做 P8 unit 2:`api.ts` `ENVELOPE_SUCCESS_CODES = new Set([0, 200])` → `new Set([0])` + 删 D4 expand/contract 注释 + 加一条 regress test(明确 200 不再被当作 success)。
- 待中枢确认:无。本轮**无代码 commit**(只 commit 本条 STATUS)。


### 2026-06-29 · P7 unit 1 · SSE §9 `v` 类型回归到 string + D5 回归扫零(commit `e78c048`)
- 分支:`feat/agent-frontend-p7`(独立 worktree:`.claude/worktrees/agent-frontend-p7/`,从新 main `37a3760` 起,HTTPS push,**未合 main**)。本流首次按 P6 收口的"强制独立 worktree + 各流 STATUS 各写各分支"规约起步。
- **回归扫(D5 string id):** grep 全代码树 `userId|sessionId|messageId|turnId:\s*number` / `Number(.*[Ii]d)` / `userIdToNumber` / 数字字面量 id —— **零残留**。wave2 unit2(commit `94a491c`)一次翻净到位,P7 不需补漏。
- **修(SSE §9 `v` 类型,unit 1):** P6 J1 文档(`agent/docs/E2E-INTEGRATION.md §4`)把 agent backend 真实 SSE wire 定为 `"v": "1"`(JSON string);wave2 unit3 类型签到 `number` 是错读 §9"schema 版本 1"(数字版本号 vs JSON 字面形式),从未在运行时爆栈(没有代码路径读 `v`),但 mis-typed 测试 fixture 让"客户端形与 backend 真实 emit 对齐"的回归覆盖失真。types.ts `StreamChatEvent.v: number → string` + 注释点明 E2E-INTEGRATION §4 是 SoT;api.test.ts/parseSsePayload §9 wire 4 处 + useChat.test.tsx/§9 conformance 6 处 `v: 1` → `v: "1"`。
- **包络双兼容现状:** api.ts `ENVELOPE_SUCCESS_CODES = {0, 200}` 仍在(D4 expand/contract 窗口)— **本前端已 wire-compatible**,S1/S3 完成 Contact/RTC/Offline/Moment 翻 code=0 后无需我动;收 S1/S3 包络翻转完成通知后做一次显式收缩(只剩 `{0}`)。
- 5 大门(逐轮):tsc / lint / prettier / vitest(**8 文件 / 68 测试**,数字不变 — 本轮纯类型 + fixture 字面值修正) / vite build,全 exit 0。
- 产出物:`agent-frontend/src/{types.ts, api.test.ts, hooks/useChat.test.tsx}`(3 文件 / +24 / -21)。
- **🛑 阻塞 P7 主任务(端到端验证)——等 S3 J1 起栈:** 探活 `:10110/:18180/:18080` 全部 connection refused(WSL E2E 栈未起 agent);P6 集成 commit `37a3760` 写"agent jar built → J1 unblocked",但 S3"drop into E2E stack and run 09/10"未发生。**故本轮 P7 task #1(M4 工具确认 UX 端到端 + §9 流式回复端到端渲染)无法实跑** — 这是 P5 wave2 起就声明的"WAVE 2 待 J1"位置,P7 应是闭合点但 S3 J1 入栈未跑;不硬上 mock 伪造通过(用户红线)。
- **交接 → S3(J1 起栈):** 按 `agent/docs/E2E-INTEGRATION.md §2`(`SERVER_PORT=18180` + `AGENT_GATEWAY_ENFORCE_IDENTITY=true` 最小可达)起 agent;`AGENT_SKIP_BUILD=1 bash 09 && bash 10` 跑 3 断言;通后通知本流即可端到端验:邮箱登录(:10110)→ 发送触发 high-risk 工具的 prompt → 浏览器实证 `data.toolGovernance{confirmationRequired, challengeToken, challengeExpiresInSec}` → 点"确认并继续"→ 网络面板验 `AgentRequest.confirmationToken=<challengeToken>`(**勿带工具名**)→ 一次性消费 + TTL 过期重取路径;再发流式 prompt 验 `v="1"`、`buffered:true`/逐 token、未知 type 容忍渲染。
- **交接 → S1/S3(包络翻转通知点):** Contact/RTC/Offline/Moment 翻完 code=0 后请在 STATUS 标"S2 可关 200 兼容";本前端会做 unit 2 把 `ENVELOPE_SUCCESS_CODES` 收缩到 `{0}` 并删 D4 expand/contract 注释。
- 待中枢确认:无。


### 2026-06-28 · P5 wave2 · M4 F01 切真 + D5 string id + SSE §9(commits `d142195`/`94a491c`/`1c8ad23`)
- 分支:`feat/agent-frontend-p5-wave2`(从 main `902335d` 起,HTTPS push,**未合 main**)。本轮三件主活全独立 commit 便于回滚;无跨流文件接触。
- **unit 1 · M4 切真 F01 挑战令牌(commit `d142195`):** S1 P5 已 ship F01(server 一次性 challengeToken,fingerprinted on prompt+session+confirmedToolSet,Redis 原子 GETDEL 多实例安全)。前端把 P5 wave1 的 `confirmedTools[]` 壳一次性切真——`AgentResponse.toolGovernance` 类型化为 `{confirmationRequired, challengeToken, challengeExpiresInSec, pendingTools?}`;`api.agentChat` payload 把 `confirmedTools?: string[]` 换成 `confirmationToken?: string`(从类型上禁掉旧字段,防 silent no-op)。`useChat.confirmTools(assistantId, selected)` → `useChat.confirmTurn(assistantId, shouldRelease)`,内部用 stash 的 challengeToken 重放(**不传工具名**);多轮治理:响应再带新 token 则重新 stash;取消路径不二次 call agentChat、写"已取消工具调用"+ `meta.confirmationCancelled`。`ToolConfirmation` 卡片拿掉复选框(F01 不看工具名,选无意义),改信息展示 list + 确认/取消两按钮 + in-flight 锁。**关键不变量:有 challengeToken 才 stash 待确认 turn**(光有 pendingTools 而无 token=no-op)。测试 +10(useChat.confirmTurn 5 + ToolConfirmation 4 改 + 1 空 tools)。
- **unit 2 · D5 string id 一次翻净(commit `94a491c`,13 文件 / 101+/111-):** S1(commit `1d29` P5)、S3(commit `22e0` P5)已把出参所有 id JSON string-encoded(雪花),入参在过渡期双读 number/string;前端把 types/hooks/components/tests 的 number id 一次翻 string 锁死,不再有歧义口子。types.ts:`ChatRequest.{userId,sessionId}` / `ChatResponse.sessionId` / `StreamChatEvent.sessionId` / `ChatSessionSummary` / `ChatTurnSummary` / `ChatSessionCreateRequest` / `MemoryItem` 全部 `number→string`。api.ts:`listSessions/getSession/summarizeSession/writeMemory/listUserMemories` signature 翻 string,`listUserMemories` 路径段补 `encodeURIComponent` 保护(原 number 直接拼,雪花 string 必须 escape)。hooks:`useChat/useSessions/useMemory` props 全 string;`useSessions.startNewSession` 用 `String(Date.now())` 作占位(server 雪花 minter = /chat/sessions,占位写完即被 server 返回值覆写)。App.tsx:**删 `userIdToNumber` 适配器**(雪花直接传不再降精度);`resolveInitialSession` 返 `{id:string, restored}`,storage 直存字符串。features:`ChatHeader/SessionList/MemoryPanel/SettingsWorkspace` props 全翻;`SessionList.onSelectionChange` 把 React-Aria 的 Key `String()` 归一(原 `Number(key) + isFinite` 守卫已无意义)。测试 ~30 处数字字面量翻字符串。
- **unit 3 · SSE §9(v / buffered / 未知 type)(commit `1c8ad23`):** 03-contracts.md §9 live since S1 P5。本前端的 `streamAutoMode` 本身已 §9 兼容(只 react `delta`/`error` + metadata 帧,其他静默 skip;`parseSsePayload` 把 JSON.parse 结果原样透传不做形归一)。本 commit 显式契约化 + 锁回归测试。types.ts `StreamChatEvent` 加 `v?: number`、`buffered?: boolean`,`type` 的 string fallback 用注释点明"未知 type 静默忽略"的协议口径。测试 +5:useChat.test §9 conformance(① unknown type tool_call/citation_delta 混在 delta 之间不爆栈不污染;② buffered:true 单帧路径作为正常完成 turn);api.test parseSsePayload(① v+buffered 透传;② 未知 type 不被强翻 delta;③ 非 JSON data 行兜底 synthetic delta)。
- 5 大门(逐轮):`tsc -b`/`eslint`/`prettier --check`/`vitest`(**68**,新增 15)/`vite build` 全 exit 0。
- 产出物:`agent-frontend/src/{types.ts, api.ts, App.tsx, lib/chat.ts, hooks/{useChat,useSessions,useMemory}.ts, features/{chat/{MessageTimeline,ChatHeader,ToolConfirmation}.tsx, sessions/SessionList.tsx, settings/{MemoryPanel,SettingsWorkspace}.tsx}}` + 5 测试文件刷新。
- **🛑 给 S1(F01 wire 一致性检查点):** 本前端按 S1 P5 ship 形 `{confirmationRequired, challengeToken, challengeExpiresInSec, pendingTools}` 接入;若 S1 后续重命名字段(特别是 `challengeExpiresInSec` 单位/前缀)请同时点名 S2 复测。本前端**只发 `confirmationToken`,绝不发 `confirmedTools[]`** — S1 端"客户端二次确认即放行"伪闸侧已可关闭(只靠 server token)。
- 阻塞:WAVE 2 流式回复**端到端实跑**待 J1(agent 入 S3 E2E 栈 `:10110`);本轮的 F01 / D5 / §9 都已 wire-compatible,J1 ready 后即可端到端验证(token 一次性 + TTL 过期路径、buffered:true 真路由)。
- 交接 → **HUB**:可下一轮集成检查点并入 `feat/agent-frontend-p5-wave2` → main(三件主活已分别 commit,zero file conflict)。
- 待中枢确认:无。


### 2026-06-28 · P5 · 真实登录 E2E 实证(:10110)+ M3 模式路由 + M4 工具确认壳(commits `6dcd361`、`6330828`)
- 分支:`feat/agent-frontend-p5`(从 main `7c5352b` 起,HTTPS push,**未合 main**)。⚠️ 中途共享工作树 HEAD 被外部(疑 S4)切到 `feat/chat-frontend-p5`,已自查并切回自己分支后才提交(改动全在 `agent-frontend/`,跨分支无冲突携带)。
- **unit 1 · 真实登录闭环 E2E(对 S3 E2E 栈 `:10110`,浏览器实证):**
  - 探活:`:10110` 网关活着(`X-Response-Source: InfiniteChat-GateWay`,login 返 chat-common 包络 `code=0`);`:10010`/`:18080` 未起。用 `dev-seed-accounts` 的 `17614797418@example.com / asdf1476`(seed 未落,自行经 Redis DB5 预置 `verify:email:` 验证码后 `register`→`code=0` 注册;Redis 6379 需密码,取自 `~/projecta-runtime/*.env`)。
  - **浏览器实证全绿:** 邮箱+密码登录 → token 持久化(`lingxi.auth.{access,refresh,user}`)→ 进 workspace;`loginCode` 免密登录、`/user/refresh` 续期(浏览器+curl 双证)、**完整 401→refresh→retry**(坏 token 打 `/api/v1/chat/sessions`→401 → `/refresh`→200 → 重放→200,对真实 chat 服务)、登出清 token→回登录页,均通过 `preview_eval` 实证。
  - **🔧 修真实 dev 阻断(已提交):** 网关 CORS 仅白名单**自身 origin**(实测只有 `http://127.0.0.1:10110` 过,所有 dev origin 403)。生产 SPA 同源在网关后故不触发;dev 下浏览器 Origin=Vite host 被网关 403。`vite.config.ts` 现把代理转发的 Origin 改写为代理目标(`headers:{origin:apiProxyTarget}`),网关视作同源——惯用 dev-proxy shim,非 mock。
  - **⚠️ 交接 S1/S3/HUB(流式聊天半侧阻塞):** agent 后端**不在 S3 chat-only E2E 栈**(`e2e.env` 无 agent 端口;`/api/agent|rag|memory` 带 token 经网关转发后 15s 超时=后端不在;`/api/chat/**` 网关**无路由**→404)。故"登录→流式回复"的回复半侧跑不通,**非前端问题**。鉴权管线本身已 live 全证(+ P4 的 13 api.test 单测)。
  - **⚠️ 交接 S3(后端不一致,D5/契约):** `loginCode` 响应 `userId` 是**数字**(login/register 返 string,违 D5 string id)**且不返 `refreshToken`**(login/register/refresh 都返)——免密登录后无法续期。建议 S3 对齐 `loginCode` 形状到其余端点。
- **unit 2 · M3 接 agent 死端点(模式真路由,commit `6dcd361`):**
  - `useChat` 现按 `mode` 分发真实端点:`auto/stream`→`/chat/auto/stream`(流式,原样);`direct`&`draft`→`/chat`;`agent`→`/agent/chat`;`rag`→`/rag/chat`;`adaptive-rag`→`/rag/adaptive/chat`。非流式模式整段一帧返回(各 DTO 拍平成 `{answer,citations?,meta(route/strategy/toolTrace)}`),in-flight 显 `ChatLoader.Dots`(M14 前不假死);显式 mode 记为 forced route。
  - **清死代码:** slash 命令原来是把字面串(如 `/agent-chat`)prepend 进 prompt 文本——现改为经 `SLASH_COMMAND_MODES` 真切 mode,prompt 文本不被污染。composer 模式 chip 反映当前 mode;actions 弹层成模式选择器(中文标签+slash)。
  - **浏览器实证:** 切到"智能助理"→ chip 更新且 prompt 不被污染 → 发送 dispatch `POST /api/agent/chat`(非流式端点)。draft 暂无专属端点,走 `/chat`(自有 route 标签)——S1 交接。
- **unit 3 · M4 工具确认壳(commit `6330828`,F01 未 ship→本地壳):**
  - `lib/chat.extractPendingTools`:**S1 未定 F01 形状的唯一防御性适配缝**——从 agent 响应 `toolGovernance` 里宽松解析待确认工具列表(容忍 pendingTools/pending、name/tool/toolName 等)。无则返 `[]`,后端不发即全程惰性。
  - `useChat.confirmTools(assistantId, selected)`:带 `confirmedTools[]`(契约字段;未来 F01 挑战令牌可并此处)重放原 agent 请求;气泡转 loader;后端再返新 pending 则重新入栈(多轮治理重现卡片)。
  - `ToolConfirmation` 卡片(MessageTimeline):勾选(默认全选,取消即不授权)+ 确认并继续/全部跳过 + in-flight 锁。直接用 HeroUI OSS Button(非 design-system 包装器——后者被 alias 到源码、vitest 下拉入第二个 React 副本,react-aria button 不容)。
  - 壳状态:F01 未 ship + agent 后端缺席 → 卡片无法端到端跑,行为由单测全覆盖(ToolConfirmation 3 RTL + confirmTools 3:浮现→重放/多轮重入栈/无 pending 时 no-op)。
- 5 大门(逐轮):`tsc -b`/`eslint`/`prettier --check`/`vitest`(**66**,新增 19)/`vite build` 全 exit 0。
- 产出物:`agent-frontend/{vite.config.ts, src/lib/constants.ts, src/hooks/useChat.ts(+test), src/App.tsx, src/features/chat/{ComposerDock,ComposerActionsPopover,MessageTimeline,ToolConfirmation(+test)}.tsx, src/lib/chat.ts, src/types.ts}`。
- 阻塞:流式聊天 + 工具确认的**端到端实跑**待 agent 后端(S1)进入可联调栈;F01 契约待 S1。
- 待中枢确认:无(线上仍 defer)。
- **🛑 给 HUB(STATUS 治理告警):** 本 session 起始时 main 工作树有 S3 的一条**未提交** P5 STATUS 记录(+21 行:发消息端点翻 code=0 解锁 S4、IM 实时 WS B8 真修、B4/B5 数据安全;引用 commits `d2f393c`/`415c317`/`be1535f`)。该未提交改动在 S4 的 commit `0f86662`(chat-frontend-p5,重写了 STATUS +15 行 S4 自己的记录)时**被覆盖丢失**——origin/feat/chat-backend-p5 上也无此条(S3 当时只 commit 了代码、未 commit STATUS)。S3 **代码安全**(d2f393c 在其分支),仅 STATUS 文档条目丢失。我已凭 session 上下文**原样恢复**该条到下方 S3 小节顶部(带恢复标记),请 HUB/S3 核对。**根因=多流共享同一工作树 + STATUS 各流 `commit -a`/checkout 互踩;建议 STATUS 改由各流只在自己分支 commit 自己的条目,HUB 集成时 union 合并,杜绝未提交跨流携带。**

### 2026-06-27 · P4 单元 1 · 401→refresh→retry 自动续期 + dev proxy 改指网关
- 完成:从新 main(db84e48)起 `feat/agent-frontend-p4` 分支并 push origin(HTTPS、未合 main)。**提交 7cca0bd**。配合 S3 P3 已 ship 的 `/v1/user/refresh`(commit `04ec462` in main)+ E2E 13/13 绿(S3 P4 item0),把"401 → 自动续期 → 重放"半侧接通。
  ① **`api.ts` refresh-retry 管线**:`ApiClientOptions` 加 `getRefreshToken`/`onRefreshed`;遇 401 时先 POST `/v1/user/refresh` 拿新 LoginResponse → `onRefreshed` 回传 → 用新 bearer 重放原请求一次;`refreshInFlight: Promise<string|null>|null` 共享,**并发 401 合并成单次 /refresh**;**重放仍 401 不再循环**(retryWithRefresh=false);兼容 `/refresh` 返 bare LoginResponse 或 envelope 包装两种形态(D4 expand/contract);**body code 40100 仍直接 onUnauthorized**(服务器已渲染 200,重放无意义)。
  ② **`lib/auth.ts authStore.applyRefresh`**:仅刷 access/refresh token,**不动 user.id/name/avatar**;从新 JWT re-parse roles(S3 可能轮换)合并;省略 refreshToken 时保留旧值。
  ③ **`App.tsx`**:`createApiClient` 多传 `getRefreshToken: () => authStore.get().refreshToken` + `onRefreshed: (res) => authStore.applyRefresh(...)`,让 api 客户端和 React 层共享单一事实来源。
  ④ **`vite.config.ts` + `.env.example`**:dev proxy 默认从 `:18080`(agent)改到 `:10010`(chat 网关)——03-contracts.md §6 网关已 front `/api/v1/**`→chat 服务 + `/api/agent|memory|rag/**`→agent 一处验签,**单一前门**;agent 直连仍可经 `VITE_API_PROXY_TARGET` 覆盖(用于网关未起时的开发,代价:`/v1/user/*` 登录端点 404 — 已在 .env.example 文档)。
  ⑤ **`api.test.ts` 新增 5 条 refresh-retry 用例**:① happy path(retry 带 rotated bearer、onUnauthorized 不调);② /refresh 自身失败 → 不重放 → onUnauthorized;③ 无 refresh token → 不调 /refresh → onUnauthorized;④ **并发 401 → 单次 /refresh**(in-flight dedup);⑤ 重放仍 401 → **不死循环**(单次重放守卫)。
  ⑥ Preview 实测:注入登录态 + reload → App 进 chat workspace(token 注入路径 + UI 切换链路完整),清掉登录态 → 回登录页。
- 5 大门:tsc / lint / prettier / **test (7 files / 47 测试,新增 5)** / build 全 exit 0。
- 产出物:`agent-frontend/{src/api.ts,src/api.test.ts,src/App.tsx,src/lib/auth.ts,vite.config.ts,.env.example}`。
- 关键决策:**dev proxy 默认走网关**(选 A 方案,因为 S3 P3 已让网关 front `/api/agent|memory|rag`)—— 之前 `dev-seed-accounts.md §7` 提的"等中枢拍 A/B" 自此自我 resolved。`/refresh` 不通过 `request()` 调用(避免 401 时 refresh 自身又递归触发 refresh);**body code 40100 不做 retry**(HTTP 200 已渲染,重放无意义,与 S3 真实 HTTP 41xx 路径区分)。
- 阻塞:无(P3 wire-compat 加上本 P4 unit 1 = 完整客户端鉴权管线;实跑 E2E 待 chat 网关 + Auth 起着 — 等 S3 P4 item0 验过的 WSL 栈或下个 unit 接通本地)。
- 交接 → **HUB**:可在下一轮集成检查点把 `feat/agent-frontend-p4`(本)并入 main → 配合 S3 P4 邮箱 E2E 完成"全栈鉴权 + 前端 401 续期"实证闭环。
- 交接 → **S3/中枢**:本前端默认 dev proxy `:10010`(网关)→ E2E 联调需保网关在 `:10010` 起着;否则前端 `/v1/user/*` 调用会 404。
- 待中枢确认:无。

### 2026-06-27 · P3 单元 1 · D14 邮箱登录 UI(close-loop-ready)
- 完成:从新 main(1c722aa)起 `feat/agent-frontend-p3` 分支并 push origin(HTTPS、未合 main)。**提交 4f1da78**。前端按 §7.1 D14 邮箱模型彻底改造,**与 S3 unit1b(`04ec462` `feat/chat-backend-p3`)的 5 个端点 wire-compatible**——S3 一合 main,前端零改即可端到端跑通邮箱登录链路。① `types.ts`:删 phone DTO,加 `LoginCodeRequest`/`RegisterRequest`/`SendMailRequest`/`SendMailResponse`,`LoginRequest.email` 取代 phone。② `api.ts`:加 `sendMail`/`register`/`loginCode` 三薄客户端到 `/v1/user/{sendMail,register,loginCode}`(已有 `login`/`refresh`)。③ `hooks/useAuth.ts`:重写为单 `applySession` 兜底任一 LoginResponse,新增 `loginPassword`/`loginCode`/`register`/`sendMail`/`logout` actions(保留 JWT sub fallback)。④ `features/auth/AuthScreen.tsx`:全屏重写邮箱模型,三模式(密码 / 邮箱验证码 / 注册)通过 `AuthMode` 驱动;**60s 重发倒计时**(props `resendCooldown`/`codeNotice`/`onSendCode`);"注册一个" / "已经有账号? 去登录"互转入口;**完全无手机号字段**;所有文案 zh-CN 品牌化、不回显后端原始串。⑤ `App.tsx`:`handleLogin` 拆 4 handler(sendCode/loginPassword/loginCode/register),共享 `mapAuthError(error, mode)` 映射 401/429/422/409(D4 包络 {0,200}↔真实 HTTP 双兼容),1Hz 倒计时 tick。⑥ 新增 13 测试:**`useAuth.test.tsx`(6 条)**——D14 路由 + sub fallback + missing-token rejection;**`AuthScreen.test.tsx`(7 条)**——三模式 UI 契约 + 邮箱有效性 gates submit + 错误 banner 品牌文案。⑦ preview 实测:邮箱 input 在、手机号 input 不在、两 tabs + 注册入口齐全,**零英文残留**(snippet 仅 name/example/Lingxi 是 placeholder + 品牌)。**5 大门**:tsc/lint/prettier/test(7 文件 / **42 测试**,新增 13)/build 全 exit 0。
- 产出物:`agent-frontend/src/{types.ts,api.ts}`、`agent-frontend/src/hooks/useAuth.ts`、`agent-frontend/src/features/auth/AuthScreen.tsx`、`agent-frontend/src/App.tsx`、新增 `agent-frontend/src/hooks/useAuth.test.tsx` + `agent-frontend/src/features/auth/AuthScreen.test.tsx`。
- 关键决策:**`register` 自动建立 session**(chat Auth /register 返回 LoginResponse 含 token)——避免注册→再登录两次往返。**`AuthMode` 类型导出**给 App 用,`handleModeChange` 在切登录/注册时清空 stale 错误/notice banner。
- 阻塞:无(client wire-compatible,等 S3 unit1b 合 main)。
- 交接 → **HUB**:可在下一轮集成检查点把 `feat/chat-backend-p3`(S3 unit1b)+ `feat/agent-frontend-p3`(本)+ 其他流并入 main → 集成测试时直接跑邮箱链路。
- 交接 → **S1**:S3 unit1a 已 front /api/agent,可以翻 `AGENT_GATEWAY_ENFORCE_IDENTITY=true`(本前端不发 X-User-Id,网关会注入)。
- 待中枢确认:dev proxy A/B 方案选定(见 `docs/planning/dev-seed-accounts.md §7`)——闭环测试前需要前端 dev proxy 能打到 chat Auth(`/v1/user/login`)。

### 2026-06-27 · P2 单元 1 · model-config admin 门控(D10)+ apiKey 字段移除 + 行为测试
- 完成:从新 main(e182a0c)起 `feat/agent-frontend-p2` 分支并 push origin(HTTPS、不合 main)。① `ModelConfigPanel` 加 `isAdmin` prop:非 admin 时显示"仅管理员可修改模型配置"的 Lock banner,不渲染表单。② **彻底移除 apiKey 字段**:input、placeholder、payload、`ModelConfigRequest` 类型字段全部删除 — D10 要求"前端不接收/回显 apiKey"(后端按 env 读)。③ `SettingsPanel` 内"运行环境"(API base/User ID/Session ID)同样 admin-only;**连接状态 chip 仍对所有用户可见**(应用是否在线是用户向);Ingestion + Memory 是用户自己的资源,保留可见。④ `App.tsx` 从 `auth.user` 派生 `isAdmin` + 新增 `VITE_DEV_ASSUME_ADMIN=true` dev-only 旁路(便于在 S3 unit2 ship `roles` claim 前本地测 admin 屏),`.env.example` 文档化。⑤ **新增 `SettingsWorkspace.test.tsx` 4 条 D10 行为测试**(普通用户态:连接 chip ✓/Ingestion ✓/Memory ✓/banner ✓/运行环境 ✗/模型配置 form ✗;admin 态:运行环境+表单 ✓/banner ✗;以及 apiKey 字段完全不渲染验证)。⑥ `test/setup.ts` 加 `matchMedia`/`scrollIntoView`/`ResizeObserver` polyfill(HeroUI Pro Sheet+Sidebar+ScrollShadow 挂载需要)。提交 ab5c294。**5 大门**:tsc/lint/prettier/test(5 文件 / **29 测试**,新增 4 条 admin gate)/build 全 exit 0。
- 产出物:`agent-frontend/src/{App,types}.tsx/ts`、`agent-frontend/src/features/settings/{ModelConfigPanel,SettingsWorkspace}.tsx`、新增 `agent-frontend/src/features/settings/SettingsWorkspace.test.tsx`、`agent-frontend/src/test/setup.ts`、`agent-frontend/.env.example`。
- 关键决策:**不动 ComposerDock 的"快速切模型/推理强度"**(它也调 `/chat/model-config`,但只发 `model`+`reasoningEffort`,且按 mode list 限定值)— 这是**契约/后端**问题(端点没区分"admin 全局配置" vs "用户态偏好",理想应出 `/chat/session-preference` 端点)。**flag 给 S1**:见 commit message 末段交接。本前端轮不返工(后端没分双端点之前,在前端拆开普通用户和 admin 是无意义的)。
- 阻塞:无(本单元不依赖任何契约)。
- 交接 → **S1**:模型配置端点考虑拆分 `/chat/model-config`(admin)+ `/chat/session-preference`(用户态);否则非 admin 的"切模型"会撞 admin 闸门。
- 交接 → **S3**:`useAuth.login()` 已从 JWT `sub` 兜底 `userId` + 解析 `roles` claim(`parseRoles`);S3 unit2 落 `roles=admin` JWT 后,前端直接生效(无需我侧改动)。
- 待中枢确认:无。

### 2026-06-27 · P1b 单元 1+2 · 复跑 5 大门 + 品牌通刷收尾 + a11y;登录壳 + token 管线 + Authorization 注入
- **从新 main(863af6b)起 `feat/agent-frontend-p1b` 分支并 push origin(HTTPS)**;ds 根级 alias 已自动指向 `packages/design-system`,源 tsc/build 绿。
- **单元 1(cba028b)**:① 修 `.prettierrc.json` 加 `endOfLine: auto`(根因:Windows checkout CRLF + 项目无 `.gitattributes`,导致 41 文件 prettier 失配,实际无格式差异)。② 上一轮品牌通刷遗漏的最后几处面向用户英文全部清干净:`ModelPicker/ModelPickerMobile` 的 `Reasoning effort`/`Choose model`/`Model` aria 译为中文;`SessionInsightPanel` 重写(`本次对话`/`对话总结`/`逐轮回顾`/`第 N 轮` + ds `<EmptyState>`,turn status 映射 zh);`SessionList` 全译(`我的对话`/`共 X 条对话` 等 + 空态友好文案);`IngestionPanel` 中文化(panel title `知识入库`、操作按钮、状态串、job status 映射);`MemoryPanel` 中文化 + 新增 `MEMORY_TYPE_LABELS`(wire enum→ 中文标签)+ `memoryStatusLabel`;`ModelConfigPanel` 中文化(每个 label/placeholder/button/status,后端原始错误串不再透传)。③ **a11y(L14)**:`AnimatedWorkspaceView` 接 `useReducedMotion()`,reduced-motion 用户立即降级到 instant cross-fade;`styles.css` 加全局 `@media (prefers-reduced-motion: reduce)` 兜底所有 CSS animation/transition。④ ds `<EmptyState>` 用上(SessionInsightPanel 空 turn 态)。**5 大门全绿** + preview eval 验过 `englishLeak: []`。
- **单元 2(f2c684b)**:① 新增 `src/lib/auth.ts` — 模块级 `authStore`(api client 与 React 共享单一事实源)+ `decodeJwt`(UTF-8 安全 + 不验签)+ `parseRoles`(csv/array)+ `isAdmin` helper。② `api.ts` 加 `ApiClientOptions={getAccessToken, onUnauthorized}`,所有请求(包括 streamChat/autoStreamChat/uploadDocument)自动注入 `Authorization: Bearer`;HTTP 401 OR body `code=40100` → 触发 `onUnauthorized` + 抛 `ApiError` 带 zh-CN 文案;**包络成功码 expand/contract = `{0, 200}` 双兼容**(等 S1/S3 翻 D4)。③ 新 endpoint `api.login`(POST `/v1/user/login`)+ `api.refresh`(POST `/v1/user/refresh`,壳就绪等 S3 提供)。④ `src/hooks/useAuth.ts` — `useSyncExternalStore` 接 authStore;`login()` 调用 api,**S3 已知 bug(LoginResponse.userId=null)兜底**:从 JWT sub claim 解 userId。⑤ `src/features/auth/AuthScreen.tsx` — 居中品牌化登录页(LingxiGlyph + Slogan + 密码/验证码 segmented tabs + 手机号/密码 + ds `<ErrorState>`);验证码 tab 是 layout intent 占位(D8 §Auth)。⑥ `App.tsx` 拆 `App`(鉴权门)+ `Workspace`(原工作台);未登录→只显 AuthScreen,登录后→工作台;**`handleUnauthorized` 走 `queueMicrotask`** 推 401 cleanup 到事件循环外,避免渲染期 unmount-during-render 触发 ErrorBoundary。⑦ `userId` 从 `auth.user.id`(JWT sub)派生,**不再写死 1**;wire string→number 在边缘 coerce,等 D5 翻全栈 string。⑧ `GlobalSidebar` 接 `onLogout?` prop,Footer 加 `退出登录` 行。⑨ `deleteStorage()` helper(写空串改真删除,防止 clear 后下次 mount 还能看到空串)。⑩ 测试:`api.test.ts` 加 5 case(成功码 0 / Authorization 注入 / 无 token 不注入 / HTTP-401 + body-40100 → onUnauthorized);新 `auth.test.ts` 8 case(JWT 中英文 round-trip / parseRoles / isAdmin)。共 **25/25 测试通过**。⑪ preview eval 端到端实测:登录壳渲染、注入 token + reload 进入工作台、捕获 fetch 见 `Authorization: Bearer ...` + `userId=10086`(从 sub 派生,不是 1)、mock 401 → storage 清空 + 回到登录壳 + 无 ErrorBoundary。
- 产出物:`agent-frontend/.prettierrc.json` + `src/{lib/{auth,storage,auth.test,constants}.ts,hooks/useAuth.ts,features/{auth/AuthScreen,sidebar/GlobalSidebar,chat/{ChatHeader,ComposerActionsPopover,ComposerDock,MessageTimeline,ModelPicker,ModelPickerMobile},insight/SessionInsightPanel,sessions/SessionList,settings/{IngestionPanel,MemoryPanel,ModelConfigPanel}}.tsx,components/AnimatedWorkspaceView.tsx,api.{ts,test.ts},App.tsx,types.ts,styles.css}`。提交 cba028b + f2c684b,已 push `origin/feat/agent-frontend-p1b`。
- 关键决策:① 包络成功码用 **`{0, 200}` 双兼容**(契约说 `0`,P0 是 `200`)— 不阻断 S1/S3 各自的翻包络节奏。② token 路径用 `queueMicrotask` 推 clear,**否则 401 同步触发 setState 导致 unmount-during-render 被 ErrorBoundary 接住**。③ `userId` 暂仍是 number(在 hooks 边缘 Number() coerce),**等 D5 翻 string 时一次 expand/contract**;snowflake 不能 fit Number 时已说明的精度风险无关本轮。④ 验证码 tab 只搭壳不接通 — S3 没 SMS endpoint 时点了会显示 "即将上线"。
- 阻塞:无。
- 交接 → S3:① **`/api/v1/user/login` 已对接**;需修 known bug:`LoginResponse.userId` 应返回 sub 的 string 化 id(我侧已从 JWT sub 兜底,但修了更干净)。② **`/api/v1/user/refresh` 端点**前端壳已搭好,S3 实现后无须改前端代码(走 envelope 同 `LoginResponse`)。③ **D4 真实 HTTP 状态翻转**(`200+code` → 真 4xx/5xx)走版本化时,我侧 `{0,200}` 双兼容自动适配,无需通知。④ **D5 全栈 string id** 翻转时(在 chat-common 落地),通知 S2 后我把 types/hooks 同步翻成 `string` 一次。
- 待中枢确认:无。

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

### 2026-06-29 · ✅ P11 发行打磨:生产 CORS actual POST 修复 + health 探针收口 + E2E/生产验收全绿
- 完成(unit1·生产 CORS):从新 main `3016d90` 起独立 worktree `E:\jhw\proj-chatbe-p11`/分支 `feat/chat-backend-p11`;开工先 `git checkout -- 'chat/e2e/*.sh' 'chat/scripts/*'`。复现 S4/S2 问题:生产 `:10010` 在 `Origin=http://127.0.0.1:5273` 下 `OPTIONS /api/chat/auto/stream` 200,但实际 POST 返回 **403 `Invalid CORS request`**。根因是 gateway 已放行,但转发时保留 `Origin`,下游 agent 再做二次 CORS 拦截。修复:Gateway `globalcors.allowedOriginPatterns` 改为逗号列表,默认 `http://localhost:[*],http://127.0.0.1:[*],http://100.*:[*]`;并加 `RemoveRequestHeader=Origin`,让 gateway 成为唯一浏览器 CORS 边界。生产重建并只重启 gateway:旧镜像备份 `infinitechat/gateway:pre-p11-20260629201329`,当前 `infinitechat/gateway:local`=`sha256:0c6e2ecd...`。
- 验证(unit1):CORS 复测全绿:preflight `http://127.0.0.1:5273`/`http://localhost:5273`/`http://100.122.46.119:5273` 均 **200**;actual POST SSE `Origin=http://127.0.0.1:5273` 与 WSL IP origin 均 **200 `text/event-stream`**,返回 §9 `event:start`/`data:{v:"1",type:"start"...}`,不再出现 `Invalid CORS request`。runtime env 已持久更新 `~/p9-deploy/.env`: `GATEWAY_CORS_ALLOWED_ORIGIN_PATTERNS=http://localhost:[*],http://127.0.0.1:[*],http://100.*:[*]`。
- 完成(unit2·health):不暴露新的公网 actuator,避免扩大健康面。生产实测 gateway `/actuator/health` 与 `/api/actuator/health` 仍 **404**;脚本统一改成安全 readiness:gateway 用受保护接口无 token **401**(`GET /api/v1/contact/1/applyCount`)证明网关+鉴权过滤链在线;agent 直连 readiness 用 `:10011/api/actuator/health/readiness` 或 E2E `:18080/api/actuator/health/readiness` **200**。已更新 `runtime-smoke/runtime-docker-golive/runtime-agent-golive/runtime-deploy/runtime-recutover` 与 E2E `04/06/07/08/09/10/11/12`。
- 完成(unit3·deploy 固化):`D:\InfiniteChatDeploy\projecta\deploy` 仍只读(WSL stat:目录 `dr-xr-xr-x`,`.env/docker-compose.yml/init-chat-schema.sql` 均 `-r-xr-xr-x`),本轮未强行 sudo/改外部文件。**需用户执行**:以管理员/sudo 先备份三文件,再应用 `chat/scripts/deploy/p10-deploy-config.diff`(本轮已把 CORS pattern 更新到 `localhost + 127.0.0.1 + 100.*`,并保留 `JWT_SECRET_KEY/INTERNAL_SERVICE_TOKEN/AGENT_GATEWAY_URI/AGENT_GATEWAY_ENFORCE_IDENTITY`、compose `&chat_env`/gateway/agent、`user.status DEFAULT 1`/`last_read_message_id`/outbox schema diff)。当前运行态由 `~/p9-deploy/.env` + committed override `chat/scripts/deploy/docker-golive.override.yml` 保证 `docker compose up -d gateway/agent` 不丢关键 env。
- 完成(unit4·Redis/E2E/生产验收):**E2E Redis 已恢复并保持**:`127.0.0.1:6399` pid `1066715`,按脚本加载 `chat.env + e2e.env` 后 db5/db6 `PING => PONG`。会话内 E2E 使用 P11 构建产物重启 7 个 chat 服务;agent E2E 以 `AGENT_SRC=/mnt/e/jhw/proj-agent-p11/agent` 重启,readiness 200。全栈 E2E **57/57 全绿**:`04-smoke` **13/13**,`06-client-api` **10/10**,`07-im` **14/14**,`08-ws-realtime` **4/4**,`10-agent-smoke` **5/5**,`11-assistant-e2e` **5/5**,`12-envelope-flip` **6/6**。
- 完成(unit4·生产 `:10010`):生产 runtime smoke **PASS=12 FAIL=0**:无 token 401、garbage 401、邮箱注册+登录、IM 发消息 code=0、B4 同事务落库、历史回显、内助手 SSE、真实 delta、CORS preflight 200、CORS actual POST SSE 到 agent、F01 `confirmationRequired+challengeToken`、持 `confirmationToken` 二次放行。D5 验收口径为 **numeric id 以 JSON string 传输**:`"sessionId":"9007199254740993"` 在 E2E `10/11` 与生产手工复测均通过;非数字 client-only sessionId(如 `"p11-string-session"`)当前生产 agent 仍 500,属 agent/frontend client-only 线程策略边界,本轮不作为 chat 后端 go/no-go 阻塞。
- 产出物:`chat/GateWay/src/main/resources/application.yml`;`chat/scripts/{runtime-smoke,runtime-docker-golive,runtime-agent-golive,runtime-deploy,runtime-recutover}.sh`;`chat/e2e/{04,06,07,08,09,10,11,12}*.sh`;`chat/scripts/deploy/p10-deploy-config.diff`。验证:Gateway Maven build **SUCCESS**;脚本 `bash -n` OK;生产 gateway 镜像重建并 `Up`;生产冲烟 **12/12**;会话内 E2E **57/57**。
- 交接:HUB 可按功能版 v1.0.0 go/no-go 采信 S3 侧结果:chat 后端/生产网关 CORS/health/deploy override/E2E Redis 均闭合。仍需用户或具 sudo 权限者把 `p10-deploy-config.diff` 应用到 `D:\InfiniteChatDeploy\projecta\deploy`,否则直接绕过 override 使用基座 compose 重启仍可能丢鉴权/gateway/agent env。

### 2026-06-29 · ✅ P10 go-live 收尾:agent 入生产 + E2E Redis :6399 恢复 + 生产冲烟/E2E 全绿
- 完成:从新 main `086f759` 起独立 worktree `E:\jhw\proj-chatbe-p10`/分支 `feat/chat-backend-p10`;开工先恢复 `chat/e2e/*.sh`、`chat/scripts/*` 为 LF 基线。接 S1 P10 jar(`/mnt/e/jhw/proj-agent-p10/agent/target/InfiniteChat-Agent-0.0.1-SNAPSHOT.jar`,sha256 前缀 `418526fb51a27966`),备份旧生产 agent 镜像为 `infinitechat/agent:pre-p10-20260629181647`,重建 `infinitechat/agent:local` 并 `docker compose up -d --no-build agent`;最终容器镜像 `sha256:438deced1bc...`,生产 `infinitechat-agent` 已 `Up`,`:10011` readiness 200。
- 完成:生产 `:10010` 全栈冲烟复跑 **PASS=9 FAIL=0**:无 token→401、garbage token→401、邮箱注册+登录、IM 发消息 code=0、B4 同事务落库、B 拉历史含消息、`/api/chat/auto/stream` 经网关达新版 agent SSE、F01 `confirmationRequired+challengeToken`、持 `confirmationToken` 重发放行(一次性)。旧 P9 遗留的 assistant SSE 404/F01 旧格式已消失;agent 直连无 `X-User-Id` 仍 401,带 `X-User-Id` 工具列表 `code=0`。
- 完成:**E2E Redis 已恢复**:启动隔离 Redis `127.0.0.1:6399`(pid `1066715`,密码沿用 `chat.env`,E2E db5/db6),`redis-cli -h 127.0.0.1 -p 6399 -a *** -n 5 ping => PONG`。修 `chat/e2e/{04,06,07,08,10,11,12}*.sh` 的 `redis-cli` 调用,统一带 `REDIS_HOST/REDIS_PORT/REDIS_PASSWORD/REDIS_DATABASE`;原脚本只带 `-n/-a` 会把验证码/WS 路由误写默认 `:6379`,是 P7 起 `:6399` down/绕不过的实际坑。
- 完成:会话内全栈 E2E 回归 **57/57 全绿**(本 worktree E2E env 显式指 `:6399`):`04-smoke` **13/13**,`06-client-api` **10/10**,`07-im` **14/14**,`08-ws-realtime` **4/4**,`10-agent-smoke` **5/5**,`11-assistant-e2e` **5/5**,`12-envelope-flip` **6/6**。E2E 库运行期补齐 `message_outbox`、`user_session.last_read_message_id`、`user.status DEFAULT 1` 后验证通过。
- 产出物:`chat/scripts/runtime-agent-golive.sh`(P10 agent 镜像 go-live 脚本),`chat/scripts/runtime-docker-golive.sh`(去掉 P9 worktree 硬编码 override 路径),`chat/scripts/deploy/p10-deploy-config.diff`(外部 deploy 固化精确 diff),`chat/e2e/{04,06,07,08,10,11,12}*.sh`(Redis host/port 修复)。
- 关键决策:Docker 生产继续沿用 P9 committed override + augmented env 保证当前重启不丢;外部 `D:\InfiniteChatDeploy\projecta\deploy` 在 WSL 下为 `dr-xr-xr-x`,三个目标文件 `-r-xr-xr-x`,普通用户无法备份/写入,未强行 sudo。已把需要固化到 `deploy/.env`、`docker-compose.yml`、`init-chat-schema.sql` 的精确 diff 放入 `chat/scripts/deploy/p10-deploy-config.diff`。
- 阻塞:外部部署配置永久落盘仍需用户/具 sudo 权限者在 `D:\InfiniteChatDeploy\projecta\deploy` 应用 `chat/scripts/deploy/p10-deploy-config.diff`;否则当前运行态靠 `~/p9-deploy/.env` + committed override 保持,但直接只用基座 compose 重启仍会丢鉴权/gateway/agent env。生产数据库运行期已补齐三项 schema。
- 交接:给 HUB/用户:执行外部固化前先备份 `.env/docker-compose.yml/init-chat-schema.sql`,然后应用 `p10-deploy-config.diff`;应用后可用 `docker compose --env-file .env up -d auth contact messaging realtime offline moment gateway agent` 验证重启不丢。给 S2/S4:E2E Redis `:6399` 已恢复且脚本尊重 host/port,可补浏览器 F01/§9 验收。待中枢确认:外部 deploy diff 何时由有权限者落盘。
### 2026-06-29 · ✅ P9 上线完成(chat 侧):Docker 栈 P8 鉴权镜像已替换 pre-P0 无鉴权旧栈(commit 见下)
- **解阻 + 切换:** 用户把 hanwen 加入 docker 组(选项 B)。实况:线上运行态是 **Docker Compose 栈**(`D:\InfiniteChatDeploy\projecta\deploy`,源在 main `14eaac0`=P8,但镜像是 4h 前 pre-P0 旧版),非 native projecta-current。
- **做法(无 sudo,docker 组;不改 D: 只读部署配置):** 用本地 P8 jar(`~/projecta-v0.9`)+ 部署 Dockerfile **自建 7 个 chat 镜像**(`:local`,旧镜像备份 `:pre-p9` 可回滚)→ **override compose + augmented env-file** 注入统一鉴权(基座 `&chat_env` 原缺 `JWT_SECRET_KEY`/`INTERNAL_SERVICE_TOKEN`/`AGENT_GATEWAY_URI`/CORS)→ `docker compose up -d --no-build` 重建 chat+agent 容器。脚本:`chat/scripts/runtime-docker-golive.sh` + `chat/scripts/deploy/docker-golive.override.yml` + `runtime-smoke.sh`(端口参数化)。
- **DB 迁移(docker mysql :13307 InfiniteChat,运行期补):** `message_outbox` 表 + `user_session.last_read_message_id`;并修 **`user.status` 默认值 0→1**(部署 schema `init-chat-schema.sql` 与 chat 仓库权威 schema 不一致,默认 0 导致注册即非活跃 → 发消息 `validateSender` 抛 500;已 ALTER + 激活存量)。
- **上线冲烟(:10010,真实 docker 库)绿:** **R1 无 token→401 · R2 garbage→401**(旧栈无鉴权 200 行为已消失,body=`{code:40100}`)· **R3 邮箱注册+登录** · **R4 IM 发消息 code=0 + B4 同事务落库 + 历史回显**。chat 侧 6/6。
- **🔔 给 S1/HUB(剩余 3 项,非 chat):** assistant SSE `/api/chat/auto/stream` → **404**,F01 令牌格式与 §5 文档(challengeToken)不符 —— 因 **agent 镜像仍是旧 4h 版**(本轮只重建了 chat 镜像)。F01 护轨本身**生效**(高风险工具被 `CONFIRMATION_REQUIRED` 拦截)。**解法:S1/HUB 用当前 agent 源重建 `infinitechat/agent:local` 镜像并 `docker compose up -d agent`**(agent 构建需 maven 网络/langchain4j 依赖,属 agent 流)。
- **🔔 部署配置待修(D: 只读,需 sudo/用户):** `deploy/.env` 永久加上述鉴权键、`docker-compose.yml` 把鉴权 env 并入 `&chat_env`+gateway+agent、`init-chat-schema.sql` 修 `user.status` 默认=1 / 补 `last_read`(本轮经 override+运行期迁移规避,未改 D: 原文件)。
- **native 侧遗留(无害):** 早先在 native 假设下改了 `projecta-runtime/chat.env`(加鉴权键)、symlink→`projecta-v0.9`、native mysql:3307 迁移 —— 均不影响 docker 线上栈(docker 自带库/redis/kafka),保留备查。
- 阻塞:无(chat 侧上线完结)。剩 agent 镜像重建归 S1/HUB。

### 2026-06-29 · 🔴 P9 上线受阻:旧栈是 **root Docker 容器**,我(hanwen)无权替换——已就绪可一键完成
- **关键发现:** WSL 运行态的 pre-P0 旧栈**不是** native projecta-current/start-apps,而是 **root 的 Docker 容器**(生产端口 10010/8082/8080/8081/9000 监听者 uid=0,进程 `java -jar app.jar`;`docker.service` active)。hanwen **不在 docker 组** + **sudo 需密码(无任何 NOPASSWD)** → 非交互下**无法 stop/替换 docker 旧栈**。native start-apps 起新栈时端口被占(`Port 10010 already in use`),旧无鉴权栈仍服务(冲烟 R1 无 token → **200**,证实旧栈未替换)。
- **已就绪(可回滚,均无害于运行中的 docker 栈):**
  - 构建 `~/projecta-v0.9`(P8 绿 main 全量 jar)+ 拷入 HUB agent jar;
  - **备份**:`InfiniteChat` mysqldump、chat.env/agent.env、旧 symlink 记录(`~/projecta-runtime/backups/`);
  - **DB 迁移(幂等已应用到真实 InfiniteChat:3307)**:`message_outbox` 表 + `user_session.last_read_message_id`(加法,旧码不读、无害);
  - **runtime env**:chat.env 注入 `JWT_SECRET_KEY`/`INTERNAL_SERVICE_TOKEN`/`AGENT_GATEWAY_URI`/`GATEWAY_CORS_ALLOWED_ORIGIN_PATTERNS`;agent.env `AGENT_GATEWAY_ENFORCE_IDENTITY=true`;
  - `projecta-current` symlink → `projecta-v0.9`(运行中 docker 栈不读 symlink,无害;待 native 切换用);
  - 部署工具(committed):`chat/scripts/runtime-deploy.sh`(stage/backup/migrate/env/cutover/health)、`runtime-recutover.sh`(fuser 释放端口)、`runtime-rollback.sh`、`runtime-smoke.sh`(:10010 冲烟)。
  - 已清理我起的孤儿 native 进程;**docker 旧栈保持原样未受损**。
- **🙋 需用户/中枢决定(privileged access)——解阻后我一键完成上线:** 任一:
  1.(推荐)用户停 docker 旧栈:`sudo docker compose down`(或 `sudo docker stop $(sudo docker ps -q)`)→ 我跑 `runtime-deploy.sh cutover && health && runtime-smoke.sh`(native 新栈占生产端口 + 冲烟);
  2. 把 hanwen 加入 docker 组(`sudo usermod -aG docker hanwen` + 重开 shell)→ 我用 docker 管栈(或仍走 native);
  3. 若**上线就该走 docker**(旧栈即 docker 部署模型)→ 需基于 P8 main 重建镜像 + compose(需 docker 访问,亦受同一阻塞)。
- **不影响:** 隔离 E2E 栈(:10110)与 P8 全栈 E2E 57 绿不受本次影响(独立)。
- 阻塞:**privileged access**(见上)。代码/迁移/env/构建/脚本全就绪,解阻即 1 步完成。

### 2026-06-29 · ✅ P8 item3 包络收口完成(同批翻)+ 全栈 E2E 验收(commit `ce1a4ba`)
- **同批翻转完成:** Contact(14 端点)、Offline(`/offline/message`)、Moment(发/赞/评/list)、RTC HTTP(`/api/v1/message/**` 内部)全部从 `200+体内 code` → **chat-common `Result` 成功 code=0 + §3 真实 HTTP**;id 一律 string 化(D5)。各服务收敛到**单一 advice**:领域异常按语义映射真实 HTTP(UserException/CodeException→400、Group→409、DB/不可用/发送失败→503、Service→500、MANV→422、越权→403);RTC/Moment 的重复/旧 advice 已停用(避免双 advice 冲突);RTC 内部令牌 401 仍在拦截器(不经 advice)。
- **🔔 S2/S4 可关 200 兼容:** 全栈成功包络现统一 `{code:0,data}`,错误走真实 4xx/5xx(非 200)。S4 的 `{0,200}` 双兼容可保留也可收敛为只认 code=0;**联系人/离线/朋友圈**端点已无 200+code 残留。RTC HTTP 为服务间内部(网关不暴露前端),无前端改动。
- **🔔 S1:** chat 侧已与 agent 侧 code=0 对齐(同批);全栈 code=0 一致,无半栈 drift。
- **顺手修真实 bug:** `MomentService.getMomentList` 当用户无动态时构造空 `IN()` → SQL 语法错 500;已加空集合守卫(新用户拉朋友圈即命中,属数据丢失级体验 bug)。
- **全栈 E2E 验收(常驻 WSL,含 agent):** `04` 13/13 · `06` 10/10 · `07` 14/14 · `08` 4/4 · `10` J1 5/5 · `11` 内助手 5/5 · **`12` 翻转回归 6/6**(Contact/Offline/Moment code=0 + Offline 跨用户真实 403 + 无 token 401)= **全绿**。
- 阻塞:无。item3 收口完结;chat 后端契约全栈 code=0 + 真实 HTTP 落地。

### 2026-06-29 · ✅ P7 收 J1 + 内助手全链路 E2E 验收(**51/51 全绿**,commit `86afa9b`)
- **J1 闭环(`10-agent-smoke` 5/5):** HUB 当前 agent jar 拷入 E2E 栈 + `AGENT_SKIP_BUILD=1 09-agent-e2e.sh` 起 agent(18080,enforce 开,H2 降级,Redis e2e db6 隔离)。A1 健康 200;**A2 直连缺 X-User-Id → 401(enforce)**;**A3 登录→网关带 token→注入 X-User-Id→`/api/agent/tools` 非401**;A4 `/api/chat/auto/stream` SSE 达 agent。网关路由补 `/api/chat,/api/chat/**,/api/streamChat`(不撞 chat 的 `/api/v1/chat/**`)。
- **内助手全链路(`11-assistant-e2e` 5/5):** 邮箱登录 → @灵犀 缓冲 `/api/agent/chat` + SSE `/api/chat/auto/stream`(§9)→ **F01 高风险工具确认令牌往返**:F01-1 命中 `confirmationRequired+challengeToken`,F01-2 持令牌重发放行(一次性消费)。**LLM 在线**(F01 路由到工具说明 DASHSCOPE key 生效)→ 真实流式 + 工具确认闭环。
- **全栈验收(常驻 WSL,对集成 main + HUB agent jar):** `04` 13/13 · `06` 10/10 · `07` 14/14 · `08` 4/4 · `10` 5/5 · `11` 5/5 = **51/51**。
- **环境根因修(本轮踩坑):** 跨 session WSL 重启杀掉了 E2E 私有 MariaDB(:3308)+Kafka(:9192)(`01-setup` 用 **nohup** 不抗会话退出)→ 登录 500(DB connect timeout)。已把 `01-setup-infra.sh` 的 mariadbd/kafka 改 **setsid**(同 03-start),infra 跨 session 不再被杀;`09` agent Redis 改 e2e db6(死端口曾致 actuator/health 阻塞 102s)。
- 阻塞:无。

### 2026-06-29 · 📣 P7 牵头 item3 包络收口——**翻前点名 S2/S4/S1**(待同批,尚未翻)
- **计划翻转(破坏性,expand/contract):** Contact(申请箱/群操作/查找)、Offline(`/api/v1/offline/message`)、Moment(发/赞/评/delta)、RTC HTTP(`/api/v1/message/**`,服务间内部)从各自 `200+体内 code` → **chat-common `Result`(成功 code=0)+ §3 真实 HTTP 状态**;id 一律 string 化(D5)。
- **🔔 点名 S2/S4:** 翻后这些端点成功包络变 `{code:0,...}`、错误走真实 4xx/5xx(非 200)。S4 的 HTTP 层已 `{0,200}` 双兼容(P5 `http.ts`),但**离线拉取/联系人/朋友圈**若有按 200 或 `code==200` 的硬判定需同步;请确认就绪。RTC HTTP 为内部(网关不暴露给前端),影响小。
- **🔔 点名 S1:** 与 agent 侧 code=0/真实 HTTP **同批翻**,避免一半栈翻一半未翻的 drift;翻转窗口请协调一个时间点。
- **做法:** 各服务接 chat-common(新端点已是)、旧端点逐个换 `Result`+`ApiException`→真实 HTTP;加 `ApiExceptionHandler`(Messaging/Auth 已有范式)。**本单元仅点名+计划,代码翻转待 S2/S4 ack + S1 同批确认后另起 commit。**
- 阻塞:等 S2/S4 ack + S1 同批窗口。

### 2026-06-28 · ✅ WAVE2 生产硬化:Snowflake 按实例 + 网关生产 CORS(commit `b232203`)
- **Snowflake 按实例(D9/M6):** `messageId` 改用 chat-common `SnowflakeIdGenerator.getInstance()`(worker/datacenter 取 `WORKER_ID`/`DATACENTER_ID` env 或 hostname 派生),替换原 Hutool `getSnowflake(1,1)`——多实例不再撞 message 主键。
- **网关生产 CORS:** `allowedOrigins`(单 localhost:10010)→ `allowedOriginPatterns`,默认 `http://localhost:[*]`(覆盖前端 5173/5180 dev 源),`GATEWAY_CORS_ALLOWED_ORIGIN_PATTERNS` 生产可设真实源;`allowCredentials=true` 必须用 pattern。**前端可直连网关,去掉 dev-proxy strip-Origin 依赖。**
- 验证:`07-im` 14/14(按实例 messageId 收发/落库正常);CORS 预检 `OPTIONS Origin=http://localhost:5173` → 200 + `Access-Control-Allow-Origin` 回显 + credentials。
- **DLT 深度可观测:** B5 已有逐条 ERROR 告警 + 进程内累计计数(actionable);真值 **consumer lag gauge 属 L3**(需 Micrometer/actuator on Offline),本轮未做,留观测专项。

### 2026-06-28 · 🟡 WAVE2 J1:agent 入网关 E2E 栈——chat 侧就绪 + turnkey 工具,**阻塞于 agent jar 构建**(commit `0686c6d`)
- **chat 侧已做(S3 owns):** 网关 `/api/agent|memory|rag` 路由已在(P1,直连 `AGENT_GATEWAY_URI` 保前缀);`e2e.env(.example)` 加 `AGENT_SERVICE_PORT=18080`/`AGENT_GATEWAY_URI`/`AGENT_GATEWAY_ENFORCE_IDENTITY=true`/`DASHSCOPE_API_KEY`(空)。
- **turnkey 工具:** `09-agent-e2e.sh`(rsync+构建/或 `AGENT_SKIP_BUILD=1` 用现成 jar + 隔离起:MySQL→H2、Redis→内存降级、enforce 开、setsid 常驻)、`10-agent-smoke.sh`(A1 健康 / A2 直连缺 X-User-Id→401 / **A3 登录→网关带 token→X-User-Id 注入→/api/agent/tools 非401** / A4 `/api/chat/auto/stream` SSE 达 agent)。
- **🔴 阻塞(给 HUB/S1):** **当前 agent jar 本 E2E 环境构建不出**——无 maven 镜像网络(huaweicloud/aliyun/central 全不可达)+ m2 缺 SB3.5.13/langchain4j/flyway-11/h2-2.3 依赖;仅有 **Jun-19 旧 jar**(pre-P0,无 enforce/降级/18080,不可用)。**解阻:S1/HUB 在有网环境构建当前 agent jar → 放 `~/projecta-e2e/agent/target/` → S3 跑 `AGENT_SKIP_BUILD=1 bash 09 && bash 10` 即闭环。** 无 LLM key 时 A4 验到"请求达 agent 且带身份"(SSE start/error),填 `DASHSCOPE_API_KEY` 可验真实流式。

### 2026-06-28 · ✅ WAVE2 两后端缺口(解锁 S4):SessionListItem.peerUserId + 图片历史持久化(commit `3929842`)
- **peerUserId:** 单聊会话项带对方 userId(string,群聊 null),S4 冷开单聊可直接取作 `receiveUserId` 发首条(real.ts 已注明需要)。
- **图片历史持久化:** 图片发送 body 为 `{url,size}` 无 `content`,B4 `buildMessageEntity` 原写 content=null → 刷新丢图;现媒体消息回退 `content=body.url`,url 落库 + 历史回显(S4 按 content=图片 url 渲染,与其 mock 契约一致)。
- E2E:`07-im-smoke` 扩到 **14/14**(peerUserId=对方;图片 url 落 message.content + 历史分页回显);`08` 实时 4/4 回归绿。

### 2026-06-28 · ✅ WAVE2 首件:P5 IM E2E **首手复跑确认**(对 integrated main `902335d`,覆盖 S2 恢复标记)
- 背景:HUB P5 集成时 S3 的 3 条 P5 ledger 曾被 S4 commit `0f86662` 覆盖丢失、由 S2 据上下文恢复(代码安全=`d2f393c` 一直在分支)。HUB 要求 S3 复跑坐实"二手绿"。**本条即 S3 自己首手复跑结果,覆盖恢复标记。**
- 方式:retire 已并入 main 的 `feat/chat-backend-p5` → 从 `main 902335d` 起 `feat/chat-backend-p5-wave2` → 对 **集成后 main 代码** 干净重建 E2E 栈(`02-build` clean,BUILD SUCCESS)+ 重启 → 常驻 WSL 实跑。
- **绿数字(首手):** `04` 鉴权 **13/13** · `06` 客户端 API **10/10** · `07` IM/B4 **11/11** · `08` 实时 WS **4/4** = **38/38 全绿**。B4 同事务落库 / B5 DLQ / B8 浏览器 WS / 发送 code=0 / 发→对端实时收 均在 integrated main 上复现绿,非二手。
- 阻塞:无。下一步:J1(agent 纳入 chat E2E 栈,登录→/api/agent 经网关→X-User-Id→流式)、S4 两缺口(SessionListItem.peerUserId / 图片消息历史持久化)。

### 2026-06-27 · ✅ P5 item3(部分)发消息端点翻 chat-common 包络——解锁 S4 真实发送(commit `d2f393c`)
- **`POST /api/v1/chat/session` 翻 code=0:** 返回 chat-common `Result`(原为服务自有 200+code);`messageId` string 化(D5);操作人校验改用 `RequestContext`(越权抛 `ApiException FORBIDDEN`→真实 403,经既有 `ApiExceptionHandler`)。调试端点(feign/hello)保留旧 Result(最小爆破面)。E2E:`07` 发送 **code=0**、11/11;`08` 实时 4/4。
- **🤝 交接 S4(可接真实发送):** `POST /api/v1/chat/session` body `{sessionId,sendUserId(=自己,须==X-User-Id),sessionType(1单/2群),type,receiveUserId(单聊),body:{content,replyId}}` → `{code:0,data:SendMsgResponse{sessionId(str),messageId(str),type,sessionType,body,createdAt}}`;越权 403、未认证 401。配合 item2 的浏览器 WS,**发→对端实时收**整链可真接。
- **⚠️ 通知 S2/S4 —— 其余包络翻转待协调(item3 余下):** Contact 旧端点(申请箱/群操作)、RTC HTTP、Offline 拉取、Moment 仍是各自 200+code 包络。这些**翻 code=0/真实 HTTP 是破坏性**,建议与 S1(agent enforce/code=0)同批、**翻前再发 STATUS 点名**。S4 现状:读端点(会话/历史/好友/markRead,p4)+ 发送(本单元)已是 chat-common;离线拉取 `GET /api/v1/offline/message` 仍旧包络(过渡,B6 历史分页已可替代)。
- 阻塞:无。下一步:item3 余下 4 处包络翻转(协调后)。

### 2026-06-27 · ✅ P5 item2 IM 实时 WS 闭环 + B8 浏览器握手修复(commit `415c317`)
- **B8 真修(p4 未竟):** `WebSocketTokenAuthenHeader` 之前只从 `?token=&userUuid=` **取**参数,却没把 query 从 URI 剥离;Netty `WebSocketServerProtocolHandler` 用**完整 uri**(`/api/v1/netty?token=...`)与配置路径(`/api/v1/netty`)比较不相等 → **从不升级握手**,浏览器/带 query 的连接静默挂起(原生端走握手头无 query 故能连)。修复:取参后 `request.setUri(decoder.path())` 改写为裸路径。**E2E 实证才发现此自 p4 起未生效的缺陷。**
- **IM 实时闭环实证(`08-ws-realtime-smoke`,4/4):** B 用浏览器式 `?token=&userUuid=` 连上 → 路由注册 `user:session:{B}` → A 发消息 → **B 的 WS 实时收到(内容匹配)+ 帧 type=2 MESSAGE_NOTIFICATION**。链路:发送→MessagingService→Redis 路由→OkHttp→RTC Netty 推送→对端 WS,全程打通。
- 工具:新增纯 stdlib python WS 客户端 `chat/e2e/_ws_recv.py`(环境无 websocat/ws 模块)。
- 🤝 交接 S4:浏览器 WS 现可直连 `ws://<网关或RTC>/api/v1/netty?token=<jwt>&userUuid=<uid>`(B8 真通);收到 `type=2` 帧须回 ACK(`{"type":1,"msgUuid":...}`)。
- 阻塞:无。下一步:item3 其余服务接 chat-common Result + 真实 HTTP 翻转(含**发消息端点翻 code=0 解锁 S4 真实发送**,翻前通知 S2/S4)。

### 2026-06-27 · ✅ P5 B4/B5/M8 数据安全(拖 4 轮收口)+ IM 链路 E2E(commit `be1535f`)
- **B4 消息持久化所有权(数据丢失级修复):** `MessageServiceImpl.sendMessage` 现经 `KafkaOutboxService.persistMessageAndOutbox`(`@Transactional`)在**同一本地事务**写 `message` + `message_outbox`——消息发送即落库,**与 Kafka 是否消费解耦**。离线消费者(OfflineDataStore)由"唯一写者"降为**幂等投影**(其原有 selectById+DuplicateKey 守卫使生产者预写成为 no-op,不产生主键毒消息)。
- **M8:** Kafka 发布移到 `afterCommit`(消除提交前发布);`retryCount` 仅在 `@Scheduled` 重试路径自增(首发不计);单聊实时推送改 **best-effort**(消息已持久化,推送失败不再抛回请求方)。生产者按与投影一致的字段映射建行(`content=body.content`/`replyId=body.replyId`/`senderId=sendUserId`)并显式写 `created_at`(修了投影 `createAt`/`createdAt` 名字错位导致的 null)。
- **B5 Kafka 可靠性:** OfflineDataStore 新增 `KafkaConsumerConfig`:`ErrorHandlingDeserializer(StringDeserializer)` + `DefaultErrorHandler` + `DeadLetterPublishingRecoverer`→死信主题 `thousands_word_message.DLT`(显式 `NewTopic`)+ `concurrency=3`(对齐分区)+ 每条进 DLT 的 ERROR 级告警(含累计深度)。毒消息/重试耗尽进 DLT,**不再阻塞分区**。
- **E2E 实证(常驻 WSL,`07-im-smoke` 11/11):** 注册 A/B → 种子好友+会话 → 发送 → **message 行由生产者事务写入(content/sender 正确)+ outbox 同事务行 + created_at 非空** → 历史分页含该消息 → markRead 推进 last_read → 离线拉取返回 → 媒体预签名。回归:`04` 鉴权 13/13、`06` 客户端 API 10/10。
- ⚠️ 给中枢:DLT 主题 `thousands_word_message.DLT` 需在线上 broker 存在(已声明 `NewTopic` 自动建,若线上关闭 auto-create 也能建);DLQ 深度真值监控(consumer lag)属 L3 可观测,本轮为日志级告警。
- 阻塞:无。下一步:item2 IM 实时 WS 闭环、item3(其余服务接 chat-common Result + 真实 HTTP 翻转)。

### 2026-06-27 · ✅ P4 item1【解锁 S4】客户端 API 已交付并运行期验证(commit `bd27c9e`)
- 完成:在 `feat/chat-backend-p4` 新增 5 个客户端端点(均 **chat-common `Result`/`PageResult`,成功 code=0;所有 id 字符串化;操作人取 `RequestContext` 绝不信 body;游标分页 base64 不透明;成员鉴权**)。旧端点不动(其自有 Result 保留到 item3 翻转)。
- E2E **双绿**:`04` 鉴权回归 **13/13**(新 API 部署后闭环不受影响)+ `06` 客户端 API **7/7**(C1 sessions code=0、C2 无 token 401、C3 friends code=0、C4 PageResult 形状、C5 非成员拉历史 403、C6 非成员 markRead 403)。

- **🤝 交接 S4 — 可直接联调的端点契约**(全部需 `Authorization: Bearer <access>`,经网关;成功 `{code:0,data:...}`,错误真实 HTTP 401/403/400):
  1. **会话/收件箱列表** `GET /api/v1/chat/sessions` → `Result<List<SessionListItem>>`;item:`{sessionId(str),type,name,avatar,lastMessage(可空),lastMessageTime(可空),unreadCount}`(单聊 name/avatar=对方;群聊=session.name+群头像[暂空])。
  2. **历史消息分页** `GET /api/v1/chat/session/{sessionId}/messages?cursor=&limit=` → `Result<PageResult<MessageItem>>`;item:`{messageId(str),sessionId(str),senderId(str),type,content,replyId(可空),createdAt}`;**非成员→403**;keyset `message_id DESC`;`limit` 默认 20 上限 100;`nextCursor` 不透明(仅 hasMore 时给)。
  3. **标记已读** `POST /api/v1/chat/sessions/{sessionId}/read` body 可选 `{lastReadMessageId}`(不传=该会话最新)→ `Result<String>`(新 last_read,单调只增);**非成员→403**。
  4. **好友列表** `GET /api/v1/contact/friends?cursor=&limit=&status=` → `Result<PageResult<FriendListItem>>`;item:`{friendId(str),nickname,avatar,signature,status}`;`status` 默认 1(好友);keyset 分页。
  5. **浏览器 WS 握手(B8)**:`token`/`userUuid` 可走 **URL 查询参数** `?token=&userUuid=`(浏览器 WS 不能设握手头),亦兼容握手头;服务端验签且 **sub==userUuid** 才放行。WS 路径见 §8(网关 `/api/v1/netty` 白名单,由 Netty 端校验)。
  6. **媒体上传契约(M11)** `POST /api/v1/user/media/upload-url`(需登录)body `{fileName,contentType,size?}` → `Result<{uploadUrl(预签名 PUT),fileUrl(上传后写入消息的 CDN URL),objectKey,method:"PUT",contentType,expiresInSec,maxSizeBytes}}`。**对象键服务端按当前用户隔离生成** `chat/{userId}/{date}/{uuid}.{ext}`(客户端无法指定 → 防跨用户覆盖/路径穿越);MIME 白名单(image/video/audio/pdf)+ 分类型大小上限,违规 → **422**。客户端流程:调本接口 → 用 `method`+`uploadUrl` 直传(带 `Content-Type`)→ 把 `fileUrl` 放进消息体。

- DB 迁移(已对 E2E 库执行,**待线上登记**):`ALTER TABLE user_session ADD COLUMN IF NOT EXISTS last_read_message_id BIGINT NULL;`
- item1 **6/6 端点全部交付且运行期验证**(`06` 冒烟 10/10:C1-C6 + M1-M3)。
- ⚠️ 给中枢:`02-build.sh` 已改 `mvn clean package`;另发现 **main 工作树 `chat/e2e/*.sh` 曾为 CRLF**(`set -euo pipefail\r` → `_restart` 静默 no-op,服务未起),现已规整为 LF(`.gitattributes *.sh eol=lf` 覆盖 `autocrlf=true`,后续 checkout 安全)。若再遇 `_restart` 无输出/不起服务,先查 `\r`。
- 阻塞:无。**item1 焦点(解锁 S4)已收口**。下一步:item2(B4 生产者+outbox 同事务写 message / B5 Kafka DefaultErrorHandler+DLQ)、item3(其余服务接 chat-common Result + §3 真实 HTTP 翻转,翻前 STATUS 通知 S2/S4)。

### 2026-06-27 · ✅ P4 item0 鉴权闭环验收:E2E 邮箱登录 01→04 全绿(13/13)
- 完成:常驻 WSL 会话内**实跑验收通过**。worktree `feat/chat-backend-p4`(from main `db84e48`)。干净重建(rm projecta-e2e/chat → fresh rsync → `mvn clean package`,8 模块 BUILD SUCCESS)+ 重启隔离栈,跑 `04-smoke`(已改 D14 邮箱 + refresh)**PASS=13 FAIL=0**:
  - T1/T2 网关挡无 token/无效 token → 401;T3 actuator 200;T4 直连业务服务 → 401;T5/T6 RTC 内部令牌;
  - **T7 邮箱注册 code=0**(BCrypt + `verify:email`);**T8 邮箱登录拿 access token**(userId=`2070816390297817088`);**T8b `LoginResponse.userId` 非空(bug 已修,运行期确认)**;
  - T9 带 token 经网关 → 非401(网关注入 X-User-Id);T10 越权 → 403;T11 伪造 X-User-Id 被剥离;**T12 refresh 换新 access code=0**。
- **根因澄清:** 上轮 Auth 的 `ModelAndViewDefiningException` ClassNotFound = **陈旧增量胖 jar**(`02-build` 用 `package` 非 `clean` + rsync `--exclude target` 保留旧 target → 半胖 jar),**非 P3 源码缺陷**。已把 `02-build.sh` 改 `mvn clean package` 杜绝。
- 产出物:`chat/e2e/04-smoke-test.sh`(D14 邮箱 + T12 refresh)、`chat/e2e/02-build.sh`(clean package)。
- 交接 → 中枢/S2:**统一鉴权闭环已端到端实证绿**(邮箱登录→token→经网关访问 chat→拒直连→拒伪造头→refresh)。S2 可放心接真实邮箱登录;跨 agent+chat 全栈 E2E 可在此基础上跑(agent enforce 已由 S1 翻)。
- 阻塞:无。下一步:item1 客户端 API(解锁 S4)。

### 2026-06-27 · ✅ P3 鉴权闭环(chat 侧):邮箱登录 D14 + 统一 HS256 JWT + refresh(已并入 main)+ 交接 S2
- 完成:Auth 一次性收口,**commit `04ec462` 已并入 main(`5e0dda1` merge,main=`cff5131`)**;full reactor build green(8 模块)。
  - **D14 邮箱登录**:`register{email,password,code}` / `login{email,password}` / `loginCode{email,code}`(免密);**删手机号/短信**(dysmsapi + SMS DTO/路径全删);`sendMail{email}` 写 `verify:email:{email}` + 校验后删 key(防重放);端点统一到 `/api/v1/user/*`(check/sendMail/uploadUrl 从 `/common/*` 迁出)。
  - **统一 JWT**:Auth 改用 chat-common `JwtUtil` 签 HS256 access(30m)+ refresh(7d),单源 `JWT_SECRET_KEY`(网关验签算法无关,兼容存量)。
  - **修 `LoginResponse.userId`**:返回 sub 的 string id;新增 `refreshToken`。新增 `POST /api/v1/user/refresh{refreshToken}`(验 isRefresh→签新 access+轮换 refresh)。
  - **包络/身份归一**:Auth 接 chat-common `Result`(成功 code=0)+ 真实 HTTP 状态(`GlobalExceptionHandler` ResponseEntity)+ `RequestContext`/`IdentityHeaders`;jackson `non_null`。网关白名单加 `/api/v1/user/sendMail`+`/check`。
- **交接 → S2(接真实邮箱登录):** 端点已就绪(均经网关 `:10010`,免登录白名单):
  - `POST /api/v1/user/register` ← `{email,password,code}`;`POST /api/v1/user/login` ← `{email,password}`;`POST /api/v1/user/loginCode` ← `{email,code}`;`POST /api/v1/user/sendMail` ← `{email}`;`POST /api/v1/user/refresh` ← `{refreshToken}`。
  - 登录/注册返回 `LoginResponse{userId(string,已修非空),userName,avatar,...,token,refreshToken}`;**成功 code=0**(你已 {0,200} 双兼容)。可去掉 JWT sub 兜底、直接用 `userId`;`refresh` 壳直接通。**无手机号输入**(phone 字段保留可空、不参与鉴权)。
- **交接 → S1:** 网关 front agent 路由 + 注入 X-User-Id/Roles 已在 main → S1 已翻 enforce(见 S1 `125` 行)。✅ 闭合。
- **运行验证(诚实记录):** 代码已合并 + 全量编译绿;**本地 E2E 邮箱登录冒烟未跑绿**——首跑 Auth 命中 **JDK21 + Spring Boot 2.6 WebMVC 胖 jar 的 `ModelAndViewDefiningException` ClassNotFound**(在 DispatcherServlet 异常处理路径,**无 com.lou 应用栈帧 → 属 Spring/loader 基础设施层,非 register 业务代码**;jar 内 spring-webmvc-5.3.23 + chat-common 均在);随后多轮重启 + 跨会话重启致 E2E 栈不稳(网关/Auth 间歇 000)。**判断:这是 E2E 运行期/打包(JDK21 胖 jar)环境问题,非 P3 源码缺陷。**
- 交接 → 中枢(item 5 全栈 E2E):建议**干净整栈重起**后跑(stop 全部 → `mvn clean package` 全量 → 03 起全部 → 等就绪 → `chat/e2e/05-email-login-smoke.sh` + 全栈鉴权场景)。若 Auth 仍 `ModelAndViewDefiningException`,候选解:① 用解包方式运行 Auth(`java -cp BOOT-INF/classes:BOOT-INF/lib/*`,绕开 SB2.6 嵌套 jar loader 在 JDK21 的惰性加载坑);② 或后续把 chat 服务 spring-boot-loader/启动方式与 JDK21 对齐。`05-email-login-smoke.sh` 已随 p3 入库,可直接复用。
- 待中枢确认:① item 5 全栈 E2E 由中枢主跑(我配合);② item 4(其余 5 服务接 chat-common Result/真实 HTTP)是否本轮继续,还是 E2E 闭环验证后再做。

### 2026-06-27 · ✅ unit1a 网关 front agent + 注入 X-User-Id/Roles(交接 S1:可翻 enforce)
- 完成:worktree `E:/jhw/proj-chat-p2`(分支 `feat/chat-backend-p2`,从 main `e182a0c`),**已 push**(commit `043c2bb`,GateWay+chat-common build green)。
  - `GateWay/application.yml`:新增路由 `/api/agent|memory|rag` → `${AGENT_GATEWAY_URI:http://localhost:18080}`(**保留 `/api` 前缀**转发;非白名单 → 走验签)。
  - `AuthGlobalFilter`:改用 chat-common `JwtUtil`/`IdentityHeaders`;验签通过注入 `X-User-Id`(sub)+ `X-User-Roles`(roles 声明 csv,有才注入);**剥离客户端伪造的 X-User-Id/X-User-Roles**;白名单加 `/api/v1/user/refresh`;401 包络改 `{code:40100,message,data:null,timestamp}`。
  - `NettyConsistentHashLoadBalancer`:路由 key 改用 chat-common `JwtUtil.parseSubject`。
  - 注:jjwt 验签**算法无关**(按 token 头 alg + 同一 `JWT_SECRET_KEY`),网关同时验 HS512(现存)与 HS256(unit1b 后 Auth 改签),无需原子切换。
- **交接 → S1(可翻 enforce):** 网关已 front `/api/agent|memory|rag` + 验签 + 注入 `X-User-Id`/`X-User-Roles` + 剥离伪造头 → **S1 可翻 `AGENT_GATEWAY_ENFORCE_IDENTITY=true` 验拒直连/拒伪造头**。注意:① 经网关到 agent **保留前缀** `/api/agent/**`(与 context-path `/api` 对齐);② `X-User-Roles` 当前可能为空(Auth 暂未签 roles,unit1b 补;admin 仍走你 P0 的 `X-Admin-Token` 过渡);③ 网关→agent 默认 `http://localhost:18080`,部署设 `AGENT_GATEWAY_URI`。
- 关键决策:agent 路由用**直连 URI**(非 lb://),因 agent SB3 与网关 SB2.6 跨版本 Nacos 互通不可靠;契约 §6 亦写 "agent:18080"。
- 阻塞:无。
- 下一单元(进行中,解锁 S2):**unit1b** = Auth 改签 chat-common HS256(+roles)+ 修 `LoginResponse.userId`(返回 sub 的 string id)+ `/api/v1/user/refresh`(S2 壳就绪,同 envelope)+ 短 access TTL。

### 2026-06-27 · ✅ unit1 `chat-common` 交付(解锁 S1)+ 交接 S1 附最终错误码枚举
- 完成:**chat-common 模块实现并导出**(实现 `03-contracts.md`),从新 main 起 worktree `E:/jhw/proj-chat-p1b`(分支 `feat/chat-backend-p1b`),**已 push origin**(commit `a22c3b2`,**full reactor build green** 8 模块)。导出公开契约:
  - `com.lou.common.api`:`Result<T>{code,message,data,traceId,timestamp}`(@JsonInclude NON_NULL,traceId 取自 RequestContext)、`PageResult<T>{items,nextCursor,hasMore}`、`FieldError{field,message}`、`ApiException(ErrorCode)`、`ErrorCode`(接口)、`CommonError`(枚举,见下)。
  - `com.lou.common.security`:`JwtUtil`(HS256,sub=string userId,roles,iss=lingxi,access/refresh,密钥 `JWT_SECRET_KEY` 单源)、`IdentityHeaders`、`RequestContext`(ThreadLocal:userId/roles/traceId;`requireUserId()` 缺失即 401、`requireSelf()` 越权 403、`requireAdmin()`)。
  - `com.lou.common.id`:`SnowflakeIdGenerator`(D9 按实例派生:env `WORKER_ID`/`DATACENTER_ID` 否则 hostname 哈希;`nextStr()` 出 string id)。
- 产出物:`chat/chat-common/**`、`chat/pom.xml`(reactor 置首)。坐标 `com.lou:chat-common:0.0.1-SNAPSHOT`。
- **交接 → S1(对齐编号,别两套):** agent(Spring Boot 3,不依赖 chat-common 工件)**镜像**以下最终错误码:
  ```
  CommonError(code → http):
   OK=0→200 · BAD_REQUEST=40000→400 · UNAUTHENTICATED=40100→401 · FORBIDDEN=40300→403
   NOT_FOUND=40400→404 · CONFLICT=40900→409 · VALIDATION_FAILED=42200→422
   RATE_LIMITED=42900→429 · INTERNAL=50000→500 · DEPENDENCY_UNAVAILABLE=50300→503
  域前导段(各域取连续子段,httpStatus 复用大类语义):
   1xxxx Auth · 2xxxx Contact · 3xxxx Messaging/RedPacket · 4xxxx RealTime
   5xxxx Offline · 6xxxx Moment · 7xxxx agent
  VALIDATION_FAILED(422):data.fieldErrors=[{field,message}]
  ```
  其余对齐:包络 `{code,message,data,traceId,timestamp}`(code=0 成功);分页 `{items,nextCursor,hasMore}`;JWT **HS256**/sub=string id/roles csv;身份头 `X-User-Id`/`X-User-Roles`/`X-Trace-Id`/`X-Internal-Token`(客户端永不自带前两者)。S1 可立即据此定死编号、停用临时的 agent 自有 ErrorCode 分叉。
- 关键决策:JWT 用 **HS256**(契约 §7,非现 chat 的 HS512——unit2 翻);错误码用「接口 + 通用枚举 + 各域自定义枚举」携 httpStatus,避免"全 200"。
- 阻塞:无。
- 下一单元(进行中):**unit2** 网关纳入 `/api/agent|memory|rag`→18080 + 统一 JWT(HS256/单源密钥)+ 修 `LoginResponse.userId`(返回 sub 的 string id)+ 刷新令牌端点——继续解锁 S1 的 enforce。

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

### 2026-06-29 · P12 unit3:release polish 验证收口(build/test/verify + UI final check)(分支 feat/chat-frontend-p12)
- 完成:① P12 改动验证完成:`npm run test -w chat-frontend` **4/4 绿**;`npm run build -w chat-frontend` **绿**(Vite 2152 modules,仅既有 HeroUI CSS minify `:is()` warning);`npm run verify:ui -w chat-frontend` **绿**(50 files);`git diff --check` 无空白错误(仅 Windows LF/CRLF 提示)。② UI final check 走真实 prod proxy:错误态(错误密码登录显示 `邮箱或密码不正确`,overflow 0);空态(真实新账号 `s4_p12_empty_221248@lingxi.test` 无会话,`还没有会话`,overflow 0);深色桌面(`?theme=dark`,html `data-theme=dark` + `.dark`,body bg `rgb(0,0,0)`,overflow 0);深色移动 375x812(`/messages?theme=dark`,bottom nav 存在,空态可见,overflow 0)。
- 产出物:本单元只写 STATUS;build 产物 `chat-frontend/dist/` 未纳入 git。
- 关键决策:继续不改根 `package.json`/lockfile,遵守 S4 只改 `chat-frontend/` 与 `packages/design-system/` 的范围;`docs/planning/STATUS.md` 作为本轮指定 ledger 例外。
- 阻塞:媒体图片发布验收仍被 unit2 的 COS CORS + public read/CDN 403 挡住;其余 release polish 绿。
- 交接:无代码交接;HUB 若要整体仓库版本/lockfile `1.0.0`,需在中枢分支统一处理。
- 待中枢确认:同 unit2 的 COS 路线 + 根包版本路线。

### 2026-06-29 · P12 unit2:生产 `:10010` 全 UI 浏览器烟测 + 媒体/COS 可见性定位(分支 feat/chat-frontend-p12)
- 完成:① 运行态基线:`SMOKE_ENV=~/p9-deploy/.env GATEWAY_PUBLIC_PORT=10010 bash chat/scripts/runtime-smoke.sh` 对 WSL prod `:10010` **11/11 绿**(无 token/garbage 401、注册登录、IM 发/落库/历史、agent SSE、跨源 OPTIONS+实际 POST SSE、F01 challenge/confirm/replay)。Windows `127.0.0.1:10010` 仍不可达,本轮浏览器访问方式为 Vite same-origin proxy `127.0.0.1:5273 -> http://100.122.46.119:10010`(不 mock)。② UI 真栈:账号 `live_b_213305@lingxi.test` 登录成功;会话 `99213305` 历史显示 `live-213305`;A 侧真实 API 发 `p12-ui-realtime-1782740951560` 后 B 浏览器无需刷新出现;IM 内助手 prompt `P12 UI SSE ...` 经 `/api/chat/auto/stream` 返回真实 §9/agent 答复并渲染;桌面与 mobile 视口 `scrollWidth-clientWidth=0`。③ 媒体:浏览器真实文件输入上传 PNG 时,`POST /api/v1/user/media/upload-url` 200,随后 COS 预签名 `PUT` 的浏览器 preflight 到 `https://infinite-chat-1306566676.cos.ap-guangzhou.myqcloud.com/...` 返回 **403 application/xml**,控制台 CORS 拦截,因此 UI 图片发送停在上传阶段、未进入 `POST /api/v1/chat/session`。④ direct API 补证(非 mock):修正脚本 `Content-Type` 后同账号 `upload-url` 200,Node 直传 presigned `PUT`=200,随后用后端返回 `fileUrl=https://img.infinitechat.nsnzd.cn/chat/2071587764226363392/20260629/117ac63dc3284b8383ef1bd9ef3e231e.png` 发图片消息成功(`messageId=347045399091740672`);但该 `fileUrl` 匿名 GET=**403 AccessDenied / application/xml**。重载 UI 历史页后 `<img alt="图片消息">` 存在,`src` 为该后端 `fileUrl`,但 `naturalWidth=0`;浏览器对 XML/403 图片响应报 `net::ERR_BLOCKED_BY_ORB`。
- 产出物:本单元只写 STATUS;未改前端媒体代码。
- 关键决策:确认前端已经使用后端返回的 M11 `fileUrl`/`uploadUrl`: `uploadMedia()` 拿 `fileUrl`,图片消息 body 为 `{url:fileUrl,size}`,`MessageBubble` 直接 `<img src={message.content}>`。当前 chat media 契约未返回 auth download URL,所以 S4 不做 URL 替换或签名绕过。
- 阻塞:🟡 用户/COS 基建挡媒体可见:1) **COS bucket CORS** 需允许浏览器从前端源对 presigned object URL 发 PUT:AllowedOrigins 至少含 `http://127.0.0.1:5273` 与正式前端域名;AllowedMethods `PUT,GET,HEAD`(预检 OPTIONS 由 COS 响应);AllowedHeaders 至少 `Content-Type`(建议 `*`);ExposeHeaders 建议 `ETag,x-cos-request-id`;MaxAgeSeconds 建议 `600`。2) **公开读/CDN** 需让匿名 GET `https://img.infinitechat.nsnzd.cn/chat/*` 返回图片而非 XML 403:将 COS bucket `infinite-chat-1306566676` 设为 public-read/private-write,或配置 bucket policy `Principal:*` + `Action:cos:GetObject` + `Resource:qcs::cos:ap-guangzhou:uid/1306566676:infinite-chat-1306566676/chat/*`;若 `img.infinitechat.nsnzd.cn` 是 CDN 域名,需确认 CDN 回源到同 bucket/path,关闭会拦普通 GET 的鉴权/防盗链,或配置 CDN 私有源回源鉴权但客户端访问 CDN URL 无需签名。验收命令:`curl -I https://img.infinitechat.nsnzd.cn/chat/...png` 应返回 `200 image/png|image/*`(当前 `403 application/xml`)。
- 交接:S3/HUB 无需再追 P11 CORS POST/SSE,本轮实测已通;媒体交给用户/COS 配置或 S3 deploy 文档固化。若后端未来改为私有桶,需由 S3 提供 auth download endpoint/短链字段,再由 S4 切渲染 URL。
- 待中枢确认:COS bucket/CDN 采用“公开读 chat/*”还是“后端 auth download URL”路线;当前前端按既有 M11 `fileUrl` 公开读契约验收。

### 2026-06-29 · P12 unit1:版本升 1.0.0 + D5 sessionId 前端请求收口(分支 feat/chat-frontend-p12,独立 worktree)
- 背景:从新 main `bfbd470` 起独立 worktree `E:\jhw\proj-chat-p12`,分支 `feat/chat-frontend-p12`。已先读 HUB P11 与 S4 P10: P11 已由 S1 修好 agent string `sessionId` 双读/边界映射,由 S3 修好生产跨源 POST/SSE CORS(`RemoveRequestHeader=Origin`,网关为唯一 CORS 边界);P10 仍待确认 COS/CDN `fileUrl` 403。
- 完成:① `chat-frontend` 与 `packages/design-system` 包版本升 `1.0.0`(根 `package.json`/`package-lock.json` 不动,因 S4 本轮只允许改两个前端目录)。② `realApi.streamAssistant` 恢复随请求发送 `sessionId: String(sessionId)`,包括 `s-lingxi` 这类 client-only 助手线程;P8/P10 为规避旧 agent Long 反序列化而省略非数字 sessionId 的逻辑已不再符合 P11 后契约。
- 产出物:`chat-frontend/package.json`,`packages/design-system/package.json`,`chat-frontend/src/api/real.ts`。
- 关键决策:IM 历史/read 仍只对数字后端会话命中真实接口;但 agent SSE 入口按 P11 D5 统一发送 string sessionId,前端不再保留旧阻塞期 workaround。
- 阻塞:无。
- 交接:无。
- 待中枢确认:根包版本/lockfile 是否由 HUB 统一升 `1.0.0`(S4 受目录约束未改)。

### 2026-06-29 · P10:指向生产 `:10010` 浏览器冲烟 + client-only 助手线程抗 WS 抖动(分支 feat/chat-frontend-p10,独立 worktree)
- 背景:P9 已把 chat Docker 生产栈切到鉴权版;P10 任务是前端指向 WSL 生产运行态 `:10010` 做真栈冒烟,不 mock。worktree `E:\jhw\proj-chat-p10`,分支 `feat/chat-frontend-p10`。
- 完成:① **访问方式坐实**:WSL 内 `127.0.0.1:10010` 正常(无 token→401);Windows `127.0.0.1:10010` 超时(NAT/localhost 转发不可用);Windows 浏览器可用 WSL IP `http://100.122.46.119:10010` 访问生产网关(该 IP 会随 WSL 网络变化)。② **生产后端基线**:标准 `chat/scripts/runtime-smoke.sh` 在 agent ready 后 **9/9 绿**(鉴权401/garbage401/邮箱注册登录/IM 发消息/落库/历史/SSE 到 agent/F01 challengeToken 往返);首次失败为 agent 容器启动窗口,网关 `agent:10011 connection refused`,ready 后消失。③ **浏览器真栈冒烟**(dev 前端 real branch 指生产):播种真实用户+会话 `SID=88181651`;B 登录成功→会话/历史显示 `p10-history-p10181650`;B 浏览器 WS 握手写入 Redis `user:session:2071538376586170368`;A 走真实 API 发 `p10-realtime-181845`→B UI **无刷新实时出现**;无水平溢出。④ **内助手 SSE**:绝对跨源直连 WSL IP 的实际 POST `/api/chat/auto/stream` 被网关返回 **403 `Invalid CORS request`**(OPTIONS 预检 200,实际 POST 403);同源 dev proxy(`VITE_API_BASE=1`,`VITE_GATEWAY=http://100.122.46.119:10010`)不 mock,真实 POST 返回 `200 text/event-stream`,§9 `start` 后 `error: request timed out`(agent/LLM provider 超时),UI 冷启动复测显示用户 prompt + `request timed out`。⑤ **媒体图片**:媒体预签名 `code=0`,有效 PNG 对 presigned `uploadUrl` PUT=200,图片消息发送 `code=0`,前端 bubble/历史 URL 均存在;但公开 `fileUrl=https://img.infinitechat.nsnzd.cn/...png` GET=**403 AccessDenied**(Tencent COS),浏览器 `<img alt="图片消息"> naturalWidth=0`。
- 产出物:改 `chat-frontend/src/api/queries.ts`、`chat-frontend/src/app/useWsBridge.ts`。
- 关键决策:把非数字 `sessionId`(如 `s-lingxi`)视为 **client-only 本地线程**:① `useMessages` 对 client-only 会话只读/保留 react-query 本地缓存,不再用真实历史空页覆盖流式消息;② WS reconnect backfill 只 invalidate 数字后端 session,避免生产/代理 WS 抖动时清空内助手进行中的 prompt/bubble。真实 IM 数字会话 backfill 不变。
- 阻塞/待:🟡 非前端阻塞:① 生产网关 CORS **预检过但实际 POST SSE 403**(直连 WSL IP + Origin `http://127.0.0.1:5273`);当前可用访问方式是同源代理/未来同源生产 Web,但若浏览器要绝对跨源直连 `:10010`,需 S3 修实际 POST CORS。② 生产 agent direct SSE 已到达但 LLM provider 返回 `request timed out`(非前端,前端已渲染 §9 error)。③ COS/CDN 公开读或域名权限导致 `fileUrl` 403,图片 bubble 有 URL 但不可见。
- 验证:**build(`tsc -b && vite build`)绿 + `test` 4/4 绿 + `verify:ui` 绿(50 文件)**;浏览器真栈冒烟覆盖登录/会话/历史/WS 实时收发/内助手 SSE/媒体图片。build 仍有既有 HeroUI CSS minify warning(`:is()` 空参数),未新增。
- 交接 → **S3**:修/确认生产网关 CORS actual POST(尤其 `/api/chat/auto/stream`/`/api/agent/chat`)与部署访问形态;排查 agent LLM provider 超时;修 COS `img.infinitechat.nsnzd.cn` 公开 GET 403(put 200 但 public read AccessDenied)。→ HUB:Windows→WSL `127.0.0.1:10010` 不可达属 NAT/转发问题,本轮使用 WSL IP/同源代理记录访问方式。
- 待中枢确认:无。

### 2026-06-29 · P9:200 兼容收缩(`{0,200}→{0}`)+ 回归测试;上线冲烟 gated(分支 feat/chat-frontend-p9,独立 worktree)
- 背景:S3 P8 已点名「可关 200 兼容」(全栈 item3 收口 code=0/真实 HTTP,57 E2E 绿);本轮收掉前端 200 兜底。上线运行态(:10010)冲烟待 S3 部署。
- 完成:① **expand→contract 收缩**:抽纯模块 `api/envelope.ts`(`SUCCESS_CODES={0}` + `isSuccessCode`,无 fetch/store/`import.meta.env` 耦合 → 可单测);`http.ts` 引入之,删本地 `{0,200}` 集合 + D4 兼容注释,**两处成功判定**(2xx 包络判定 + refresh 判定)改 `isSuccessCode`;**200 不再当 success**(HTTP 200 + body `code:200` 现按错误抛)。② **回归测试** `api/envelope.test.ts`(内置 `node:test` + `node --experimental-strip-types`,**零新依赖/零安装**):4 断言绿——code 0 成功、缺 code 成功、**legacy 200 不再 success**、40100 非 success;加 `test` 脚本。
- 产出物:`chat-frontend/src/api/{envelope.ts,envelope.test.ts}`(新)、改 `chat-frontend/src/api/http.ts` + `chat-frontend/package.json`(+`test` 脚本)。worktree `E:\jhw\proj-chat-p9`,分支 `feat/chat-frontend-p9`。
- 关键决策:测试用 node 内置 runner + `--experimental-strip-types`(node 22.23 支持)跑 `.ts`,**不引 vitest**(避免污染共享 junction node_modules + 不破 `tsc -b`);纯逻辑抽 `envelope.ts` 以解耦 `import.meta.env` 可测。
- 🔬 **收缩运行态安全(对 live :10110 实测)**:登录→token→客户端消费的**全部包络端点均 `code=0`**(login 200/code=0、chat/sessions 200/code=0、contact/friends 200/code=0)→ 收缩后 `isSuccessCode(0)=true` **零破坏**(无端点返 200-success 会被新客户端拒)。+ 单测锁 200 拒绝 + build 绿;P8 已浏览器实证全流程(同请求/响应,收缩仅窄化成功码集)。
- 阻塞/待:🟡 **task2 上线冲烟 gated**——`:10010` prod 运行态 **DOWN**(S3 P9 部署 main→WSL 替换无鉴权旧栈 + **上线点名未到**)。待 S3 起 `:10010`(prod CORS 已开)后,前端指向 `:10010` 过 登录/会话/历史/实时/内助手/媒体 冒烟;当前以 `:10110` 坐实收缩安全。
- 验证:**build(`tsc -b && vite build`)绿 + `test` 4/4 绿 + verify:ui 绿(50 文件,worktree)**;`:10110` 包络 `code=0` 实测(见上)。交接 → S3:`:10010` 起栈 + 上线点名后,S4 指向冒烟。

### 2026-06-29 · P8:浏览器级内助手 E2E 验收(真 agent SSE)+ 修 client-only 会话 bug;包络收缩 hold(分支 feat/chat-frontend-p8,独立 worktree)
- 背景:J1 已通(S3 51/51,LLM 在线);S3 播种可登账号 `17614797418@example.com / asdf1476`。本轮**浏览器级实测**内助手 + 修 E2E 暴露的致命 bug;包络收缩待 S3/S1 点名。
- 🔬 **浏览器 E2E(real 模式 worktree dev → 网关 :10110,逐步实测)**:① **真实登录绿**(seeded 账号→token→进应用,userId `2071126048501796864`「聪明的吗喽」);② **会话读路径绿**(`/api/v1/chat/sessions` 200/code=0;该账号无会话→空态「还没有会话」正确渲染);③ **内助手 SSE 端到端**:@灵犀→`POST /api/chat/auto/stream`→真实 agent §9 流(`event:start` + `data:{v:"1",type,route:"direct",…}`),解析器逐事件处理 start/delta/done/error **实测通过**(本机 agent 实例当前**未配 `DASHSCOPE_API_KEY`**→返 §9 error「AI 模型未配置」,客户端正确渲染该 error;真实 delta 渲染随 LLM key 在线即通——delta 走同一解析路径);④ **B8 WS 握手实测 OPEN**(`?token=&userUuid=` 经网关/Netty 放行;重连 backfill 机制有活 transport,reconnect 逻辑 P2 mock 已验)。
- 🐞 **修 bug(real 模式内助手致命)**:`AssistantPage` 硬编码 mock 会话 id `s-lingxi` → real 模式下 IM `messages`/`read` 端点 **400** + agent `auto/stream` 收非数字 sessionId **500**。修于 seam(`real.ts`):新增 `isBackendSessionId`(雪花=数字串判定)——**client-only 会话**(灵犀助手)`listMessages` 返空、`markRead` no-op、`streamAssistant` **省略 sessionId**(agent 省略 id 即以 direct 新轮流式,实测 200)。**UI 零改**(seam 吸收 real/mock 差异)。`queries.ts` 助手 error 态**透传 §9 error message**(原硬编码「出错了」掩盖真因)。
- 产出物:改 `chat-frontend/src/api/{real.ts,queries.ts}`(worktree `E:\jhw\proj-chat-p8`,分支 `feat/chat-frontend-p8`)。
- 关键决策:client-only 会话用「sessionId 非数字串」通用判定(避免魔法串耦合——全应用仅灵犀助手是非数字会话);默认仍 Mock。
- 阻塞/待:🟡 **真实 LLM delta 渲染** 待 agent 实例配 `DASHSCOPE_API_KEY`(本机当前未配;S3 51/51 时在线)——管线已实测,渲染随 key;🟡 **媒体/图片真链路 + 重连 backfill 浏览器实测** 待该账号有真实会话(当前无会话/无对端)——客户端码完备 + S3 后端 14/14 已证,归 S3 会话内 E2E。
- 📋 **task2 包络收缩(hold·gated)**:实测 S4 消费端点(auth / chat sessions·messages·read·media / contact friends)**已全 `code=0`**;但 item3 legacy(Contact/RTC/Offline/Moment)**翻转+点名未落 main**(S3/S1 P8 并发未到)。按「收点名后」**暂 hold** `{0,200}→{0}`——已预清(消费端全 0),S3/S1 落点名后一行收缩。**已核 client 无硬判 200**(全 `res.ok` + code 集合,§3 真实 HTTP)。
- 验证:**build(`tsc -b && vite build`)绿 + verify:ui 绿(48 文件,worktree)**;浏览器 real E2E 实测(见上)。交接 → S1/S3:agent E2E 实例补 `DASHSCOPE_API_KEY` 即可验真流式;item3 翻转**点名**后 S4 一行收缩 `{0,200}→{0}`。

### 2026-06-28 · P7:消费 S3 两缺口 + 内助手端点对齐 J1(§9)+ v 修正(分支 feat/chat-frontend-p7,独立 worktree)
- 背景:S3 `3929842` 已补两 S4 缺口(`SessionListItem.peerUserId`、图片历史 `content=url`);S1 J1 文档 `agent/docs/E2E-INTEGRATION.md` 定 §9 schema + 网关把 `/api/chat|chat/auto|chat/auto/stream`+`/api/agent|rag|memory` 路由到 agent(agent jar 已由 HUB 构建,**待 S3 拷入 E2E 栈起服务**)。本轮按契约消费/对齐;**真实流式 E2E 待 S3 agent 起栈 + 可登账号**。
- 完成:① **消费 `peerUserId`**:`SessionListItemRaw` 加 `peerUserId`,`mapConversation` 直落 `sessionPeerById` → **冷开单聊可发首条**(原「无法确定接收方」仅剩极端兜底;历史学习 peer 留作旧数据回退)。② **图片历史回显**:核对 `mapMessage`(PICTURE→image、`content`=S3 落库 url)+ `MessageBubble`(kind=image 渲染 `<a><img src=content></a>`)既有链路即支持刷新回显,**无需改码**(S3 `content=body.url` 落库)。③ **内助手端点对齐 J1**:`ASSISTANT_STREAM_PATH` 从 `/api/agent/chat`(P6 兜底,网关当时未路由 `/api/chat/**`,实测 404)翻 **`/api/chat/auto/stream`**(J1 文档 §1 已加路由;**自动路由**:direct 逐 token、agent/RAG 整段 `buffered:true`)——双模消费两态皆渲染。④ **§9 `v` 修正**:文档定 `v` 为字符串 `"1"`,`sse.ts` 改 `Number(raw.v)||默认` 归一、`RawSseEvent.v: number|string`。⑤ **静态核对** `sse.ts` vs §9 文档:命名事件(`event:type` + data JSON 携 `type`,解析读 data 的 type 而非 event 行)、`buffered`、`citations`(done)、未知 type(如保留未发的 `usage`)容忍——全覆盖。
- 产出物:改 `chat-frontend/src/api/{real.ts,sse.ts}`(worktree `E:\jhw\proj-chat-p7`,分支 `feat/chat-frontend-p7`)。
- 关键决策:端点用自动路由 `/api/chat/auto/stream`(优于 buffered-only `/api/agent/chat`——给 direct 真逐字流式);默认仍 Mock(CI 与后端解耦)。**首用独立 worktree**(P6 治理),`node_modules` junction 复用主树免重装,build/verify 绿。
- 阻塞/待:🟡 **真实流式 E2E + 媒体/图片真链路验证待 S3 起栈**——本机探测 `:10110` 全 DOWN(agent 未起栈/无 token:`sendMail` E2E 仍 500、无可登账号);J1 构建侧已解但需 S3 拷 jar 跑 `09/10` 起 agent。验收归 S3 会话内全链路 E2E(IM+内助手)。**task3 包络翻转**:S1/S3 尚未翻(HUB 标「与 S1 同批」),`http.ts` `{0,200}` 双兼容已预置,翻后零改。
- 验证:**build(`tsc -b && vite build`)绿 + verify:ui 绿(48 文件,worktree)**;§9 解析静态核对 vs J1 文档通过;图片渲染读码确认。真实流式渲染 / 重连 backfill / 媒体收发 E2E 待 S3 起栈。

### 2026-06-28 · P6 单元:IM 内置「灵犀」助手 Mock SSE → 真实 agent §9(分支 feat/chat-frontend-p6)
- 背景:S1 `0d36d43` 已交付 SSE §9 信封版本化(`v`/`buffered`/容忍 unknown);本轮把 IM 内"灵犀"助手 `streamAssistant` 从 Mock 切真接 agent——**先按契约建,真实 E2E 待 J1(agent 入统一 chat E2E 栈)**。
- 完成:① **§9 SSE 解析模块 `api/sse.ts`**(镜像 agent-frontend 已测解析器):`parseSseChunk`(按空行分块、取 `data:` 行、跳 `[DONE]`、JSON 解析、非 JSON 退化为 delta、不完整尾块回吐 `tail` 重缓冲)+ `mapAssistantEvent`(原始 §9 → `AssistantStreamEvent`:start/delta/usage[in+out tokens 合]/done[citations]/error;**unknown type 静默忽略**)+ `extractBufferedAnswer`(非 SSE 的 JSON 信封 `{code,data:{answer|content|…}}` → 整段答案文本)。② **`AssistantStreamEvent` 扩 §9**(types.ts):`v` 改可选(逐事件可缺、解析补默认)、`delta/start` 加 `buffered?`、`done` 加 `citations?: Citation[]` + `Citation` 类型(**解析齐备,UI 暂不渲染——后续单元**)。③ **`real.ts streamAssistant` 切真**:`POST` 经网关、带 `Authorization: Bearer`、body `{sessionId,prompt}`(**D3:不带 userId,网关注 X-User-Id**)、`AbortController` 中止;**双模消费**——`content-type: text/event-stream` 走流式(reader+TextDecoder+`parseSseChunk` 逐事件 emit,服务端无 done 帧也补 done 清流式态),否则按缓冲 JSON 渲染整段(单 delta + `buffered:true`)。默认仍 Mock(`isMock`),CI 与后端解耦。
- 🔎 **端点路由实测(交接 S3/J1)**:对 live E2E 网关 `:10110` 无 token POST 探测——**`/api/chat/auto/stream` → 404**(chat 网关不路由 `/api/chat/**` 到 agent)、**`/api/agent/chat` → 401**(§6 `/api/agent/**` 已路由)。故默认用 **`/api/agent/chat`**(plan-40 指定 + 当前唯一可达);该端点现为**整段一帧**(M14 待真流式),双模消费按缓冲渲染。**J1 待:** ① agent 纳入 chat E2E 栈(+ 可登账号);② 要逐字流式则在 `/api/agent/**` 下暴露 SSE(或网关把 `/chat/auto/stream` 路由到 agent)——SSE 分支已就绪,届时翻一行 `ASSISTANT_STREAM_PATH`。
- 产出物:`chat-frontend/src/api/sse.ts`(新)、改 `chat-frontend/src/api/{types,real}.ts`。分支 `feat/chat-frontend-p6`(off main `902335d`)。
- 关键决策:**双模消费(SSE/缓冲)**——whichever 网关路由皆可工作,适配 agent 当前缓冲态 + 未来真流式;端点设单一常量(J1 一行切);citations 解析齐备但未渲染(聚焦"切真",渲染留后续);默认 Mock 不变。**工作树**:本单元在共享树切分支(P6「各流独立 worktree」隔离待 node_modules 方案);已**只提交本流显式文件、未 `commit -a`**,避免 STATUS 互踩,完后还原 HEAD。
- 阻塞/待:🟡 **真实助手 E2E 待 J1**(agent 入 chat E2E 栈 + 可登账号;`sendMail` E2E 仍 500 取不到 token);WAVE2 authed 屏 + WS 端到端、`peerUserId`/图片历史持久化两后端缺口仍待 S3。
- 验证:**build(`tsc -b && vite build`)绿 + verify:ui 绿(48 文件)**;**端点路由 live 探测**(见上,据此定默认端点);默认 Mock 助手不受影响(mock.ts 未动、类型为加法可选、tsc 通过)。真实答案渲染 E2E 待 J1。

### 2026-06-28 · P5 实时收发闭环 + 媒体写路径接真实(分支 feat/chat-frontend-p5)
- 背景:S3 P5 已交付(STATUS S3 段):`POST /api/v1/chat/session` 翻 chat-common code=0(`d2f393c`)、B8 浏览器 WS 握手真修(`415c317`)、B4/B5 数据安全(`be1535f`)、媒体预签名 `POST /api/v1/user/media/upload-url`(P4 M11)。本轮按「同签名一处切」把**发送/媒体写路径**接真实,**收消息**走真实推送语义。
- 完成:
  - ① **真实发送(text)**:`real.sendMessage` 接 `POST /api/v1/chat/session`(原委托 mock)。体 `{sessionId,sendUserId(=自己),sessionType,type:1,receiveUserId(单聊),body:{content}}`,**id 全以 JSON 字符串发**(雪花超 JS 安全整数;网关 Jackson string→Long 强转,精度不丢——已核实 MessagingService `JsonConfig` Long↔String 序列化 + 默认 coercion 未禁)。乐观 UI→回执按 `clientTempId` reconcile(`useSendMessage` 既有,response.messageId 为串)。
  - ② **单聊 receiveUserId 派生**:`SessionListItem` 不带对端 userId(后端仅给 name/avatar),故从已加载历史的非我 senderId 学习 `sessionPeerById`、从会话列表学习 `sessionTypeById`。⚠️**交接 S3**:`SessionListItem` 暴露 `peerUserId` 可让**冷开单聊**(无对端历史消息)也能发;当前冷开单聊会提示「无法确定接收方,请打开会话后重试」。
  - ③ **媒体(M11 图片)**:`uploadMedia`=`POST /media/upload-url`→用响应 `method`+`uploadUrl` 预签名直传(带 `Content-Type`,`http.uploadToPresignedUrl`,**不走包络/Authorization**)→`sendImageMessage` 发 `type=2 PICTURE` body `{url:fileUrl,size}`。`useSendImage` 乐观(本地 objectURL 预览)→上传→发送→reconcile(成功 revoke,失败保留预览供重试,经 `pendingImages` 重跑全管线)。Composer 加图片附件键(image/*),`MessageBubble` 渲染 `kind:image`(`<img>` 限高 / 点开原图)。
  - ④ **收消息真实语义**:推送帧 `data`=RTC `TextMessage/PictureMessage`(`{messageId,sessionId,sendUserId?,type,createdAt,body}`)。新增 `normalizePushedMessage`(兼容 mock 域 Message 与 RTC 形,**id 强转 string** 使缓存键匹配);`useWsBridge` 由「invalidate→refetch」改为**直接 setQueryData upsert(按 id 去重)**——推送已带完整载荷(含图片 url,历史 refetch 会丢),更省;会话列表仍 invalidate 刷新预览/未读。WsClient 的 msgUuid 去重 + ack-after-cache + 重连 backfill(invalidate)不变。
  - ⑤ **type 枚举对齐**:`mapMessageKind` 修为真实 `MessageRcvTypeEnum`(2 图片 / 5 红包;原误把 3 当红包,实为 FILE)。
  - ⑥ **真实登录(D14)**:P4 已接,本轮回归确认仍工作(见验证)。
- 产出物:改 `chat-frontend/src/api/{contract,http,real,mock,queries}.ts`、`src/api/ws/transport.ts`、`src/app/useWsBridge.ts`、`src/features/messages/{MessagesPage,parts}.tsx`。分支 `feat/chat-frontend-p5`。design-system 无改动。
- 关键决策:**默认仍 Mock**(`VITE_API_BASE` 空,CI 门与后端解耦);媒体仅落地**图片**(RTC realtime 仅 TEXT/PICTURE 成形,FILE/VIDEO 后端 switch 未处理→不盲接,文件消息续等后端消息类型);收消息改**直写缓存**(满足「push→去重→写缓存→ACK」语义且让图片即时渲染)。
- ⚠️ **交接 S3/中枢(两处后端缺口,非阻塞前端但影响体验)**:① `SessionListItem` 加 `peerUserId`(冷开单聊可发)。② **图片历史持久化**:消息行 `content=body.content`,图片 body 仅有 `url` 无 `content`→历史 `listMessages` 重载丢图片 url(realtime 推送/乐观即时渲染正常,刷新后图片空)。建议图片消息把 url 落进 `content`(或 history 投影读 `body.url`)。
- 阻塞:无(前端自洽)。真实 authed E2E 仍受限(同 P4:E2E `sendMail`→500、无可登账号→拿不到 token;凡需 token 的真实渲染/发送/WS 握手自证受限)。需 S3 在常驻 WSL 播种可登账号或 dev-mode sendMail 返码,或在常驻会话内跑前后端联调。
- 验证:**build(`tsc -b && vite build`)绿 + verify:ui 绿(47 文件)**。**Mock 运行时实测**(默认形态,preview):邮箱+密码登录→进应用;打开会话→**文本发送**(乐观→回执入列);**WS 推送收消息**(`__lingxiIncoming`→新 bridge 直写缓存→对端消息即时入列,非 refetch);**图片发送**(注入 File→上传→乐观 blob 预览→reconcile→`<img>` 渲染 naturalWidth=1、无失败态);0 console error。**Live `:10110` 探活**:`GET /chat/sessions`、`POST /chat/session`、`POST /user/media/upload-url` 无 token 均 **401**(路由存在且鉴权,非 404)——新端点在部署后端可达,authed 全链路待可登账号。

### 2026-06-27 · P4 真实数据接入:客户端 read API + 鉴权全链路切真实(分支 feat/chat-frontend-p4)
- 背景:S3 `P4 item1`(commit `bd27c9e`)交付 5 客户端端点 + B8 定形(`?token=&userUuid=`),E2E `06` 7/7 绿;本轮按**「同签名一处切」把已交付的接真实,未交付的续 Mock**。
- 完成:① **真实 HTTP 客户端 `api/http.ts`**:一处持有 base-URL 解析(`VITE_API_BASE` 选真实分支 + 前缀:绝对 URL 直连 / 非绝对走 dev proxy 免 CORS)、`Authorization: Bearer`(**只带 token、绝不带 userId**,身份由网关注 X-User-Id)、**D4 包络解包**(`{code,data,…}`,code∈{0,200} 成功)、**HTTP 状态→中文文案映射**(400/401/403/404/409/422/429/503;**兼容空体**——网关级 401/403 无包络体)、**401→refresh→重放**(并发 401 合并为单次 `POST /user/refresh`,失败即 signOut)。② **真实 Api 分支 `api/real.ts`**(同 `Api` 签名,一处切):auth `sendMail/login/loginCode/register/refresh`(§7.1)+ **会话列表 / 历史分页 / 好友 / 标记已读**(item1;wire→domain 映射:`SessionType 1单2群`、id 全 string、历史 `message_id DESC`→渲染升序、游标 `{items,nextCursor,hasMore}`、markRead 不传 `lastReadMessageId`=最新)+ **B8 真实 WS transport**(`?token=&userUuid=`,token/userUuid 取自 auth store);`me()/userMap()` 由会话派生(+好友缓存)。③ **未交付续 Mock**:`sendMessage`(写侧待 S3 item2 B4 outbox,旧端点请求/响应形未定→**不盲接**)、好友申请 applies/respond、助手 SSE(agent/S1 域)→ realApi 内部委托 mockApi。④ **seam `api/index.ts`**:`api = isMock ? mockApi : realApi`,**默认仍 Mock**(`VITE_API_BASE` 空)→ CI build/verify 与后端解耦。⑤ **dev proxy 改进**:vite.config 用 `loadEnv` 让 `VITE_GATEWAY` 可由 `.env*` 配(proxy 在 Node 侧、`import.meta.env` 不可达);并 **strip `Origin` 头**(见下「发现」①)。
- 产出物:`chat-frontend/src/api/{http.ts,real.ts}`(新)、改 `chat-frontend/src/api/index.ts`、`chat-frontend/vite.config.ts`。分支 `feat/chat-frontend-p4`。
- 关键决策:**先接已交付、未交付续 Mock**(读侧 + 鉴权切真实;写侧/applies/助手暂留 Mock,合「不返工」);auth 错误**按上下文翻译**(登录屏 401/403/400→「邮箱或密码不正确」而非「会话过期」;读写侧 403 仍「没有权限」);默认 Mock 不变(离线可跑、门绿、可发布形态不变)。
- 🔎 **发现(交接 S3/中枢)**:① **网关对 POST 鉴权端点(`/user/login` 等)带 `Origin` 头的跨源请求回 403**(无 Origin→401/422 正常;GET `/chat/sessions` 带 Origin→仍 401,**非全局**,疑 CSRF/CORS 仅卡 POST)。dev 已在 proxy strip Origin 规避(浏览器→网关 E2E 可跑);**线上需网关对前端源开 CORS**,否则浏览器端 POST 一律 403。② **E2E 段 `/user/sendMail` 回 500**(该环境无邮件服务)→ 前端侧拿不到验证码 → 无法注册/换 token → **authed 屏(会话/历史/好友真实数据渲染)E2E 暂无法从本机自证**;需 S3 在 E2E 播种可登账号或 dev-mode `sendMail` 返码,或 S3 在常驻 WSL 会话内跑前后端联调。
- 阻塞/待:authed 屏真实数据渲染验证(待可登账号);**WS 推送 E2E**(连接→推送→去重→ACK→重连 backfill)待 S3 item2(B4 生产者→Kafka→推送)落 + 可登会话;`sendMessage` 真实化待 item2 旧端点翻 chat-common Result。
- 验证:**build(`tsc -b && vite build`)绿 + verify:ui 绿(47 文件)**。**Live `:10110`(S3 E2E 网关在运行)探测**:`/chat/sessions`、`/contact/friends` 无 token→真实 401(裸体无包络);`/user/login` 坏凭据(无 Origin)→401。**浏览器真实模式 E2E**(临时 `.env.local`:`VITE_API_BASE=1` + proxy→`:10110`,跑后即删、gitignored,**默认 Mock 不变**):① **确证真实非 Mock**——`test@lingxi.app/123456`(Mock 规则本会登入跳首页)在真实下→打到 `:10110`→401→停 `/auth` 显 `role=alert`「邮箱或密码不正确」;② proxy strip Origin 后 login 403→401、文案正确;③ network 确认 `real.ts/http.ts` 已 bundle、POST 经 `/api/v1/user/login` 走真实。注:本机 dev 慢、screenshot 偶超时,以文本快照 + network 状态码为准。

### 2026-06-27 · auth 对齐 D14 邮箱登录模型 + 鉴权门 + 会话持久化(分支 feat/chat-frontend-p3)
- 完成:① **D14 auth seam(契约+mock 同签名,P2 一处切真实)**:`sendMail{email}` / `login{email,password}` / `loginCode{email,code}`(免密)/ `register{email,password,code}` / `refresh{refreshToken}` → `AuthSession{userId(string),userName,avatar,token,refreshToken}`(`03-contracts §7.1`,**邮箱身份、无手机号/短信**);mock 校验邮箱格式 + 密码≥6 + 6 位码(短密码/坏码→错误态),会话保 ME 身份(IM「我」零扰动)。② **auth store**(zustand + localStorage `lingxi.auth` 持久化 + 启动恢复)+ mutation(`useSendMail/useLogin/useLoginCode/useRegister`,成功即 signIn)。③ **AuthPage 重写(D14)**:邮箱+密码 / 邮箱验证码(免密)两种登录 + 邮箱码注册,**无手机号**;发送验证码(60s 冷却 + 「已发送到 {email}」提示)、加载态(请稍候/发送中)、错误态(`role=alert`)、成功跳转;沿用 DESIGN.md account-first + 段控 + trust strip。④ **鉴权门(D2)**:`RequireAuth` 无会话→`/auth`、`RedirectIfAuthed` 已登→`/`;Settings「退出登录」清会话→`/auth`。
- 产出物:`chat-frontend/src/{store/auth.ts,api/auth.ts}`(新)、改 `chat-frontend/src/api/{types,contract,mock}.ts`、`.../features/auth/AuthPage.tsx`、`.../app/router.tsx`、`.../features/settings/SettingsPage.tsx`。分支 `feat/chat-frontend-p3`。
- 关键决策:auth 主体=邮箱(无手机号,合 D14);mock 会话沿用 ME 身份(零扰动既有 IM 数据);auth 表单仍用原生 DS `TextField`(HeroUI v3 `TextField` 是容器复合、type/value 落点 root vs Input,无 MCP 难核验,**不返工**)。
- 阻塞:无(Mock 全通)。**B8 仍 gated**(S3 本轮专注鉴权闭环、unit1a 网关 front agent;B8 未在 `30-plan §5` 定形)→ WS 真实 transport + 一行切待 S3。真实数据 wiring 待 S3 客户端 API(B6/B7/M9/M10/M11)。
- 交接 → **S3**:auth seam 就位;接真实 `/api/v1/user/{sendMail,login,loginCode,register,refresh}` 时一处切(`LoginResponse` 形已对齐 §7.1、`userId` string)。B8/客户端 API 就绪请在 STATUS 通知我。→ **S2**:如登录 UI 共栈,可复用同款 auth seam/store 形态。
- 验证:`build -w chat-frontend` 绿(2148 模块)+ `verify:ui` 绿(45 文件);运行时实测——**无会话→/auth 门**、**邮箱+密码登录→进应用+localStorage 持久化**、**错误态**(短密码 `role=alert`「邮箱或密码不正确」)、**验证码登录**(发送→「发送中…」→「重新发送 (52s)」冷却+「已发送到」提示→填 6 位→登录进应用)、**注册**(切「注册灵犀」→进应用)、**退出→清会话→/auth**;`/auth` 320 零横向溢出。注:本机 dev 偏慢(mock 延迟+慢 dev server,态切约 1–3s 才显),production 快。

### 2026-06-27 · 灵犀助手流式会话壳(Mock,SSE 就绪)+ 重连/收到推送态可演示(分支 feat/chat-frontend-p2)
- 完成:① **灵犀助手流式会话壳(P2 接 `/api/agent/chat` 零改 UI)**:加 `AssistantStreamEvent`(`03-contracts §9`:`{type,…}` + 版本 `v`,type∈start/delta/usage/done/error)+ `Message.streaming`;契约+mock 加 `streamAssistant(sessionId,content,onEvent): abort`(SSE 形:思考延迟→分块 delta→usage→done;**产品向文案**,无实现/网关字样);`useAssistantStream` hook 把流写进 react-query 消息缓存(乐观用户消息 + 逐块增长的助手消息;stop 中止留存已生成)。**助手会话(s-lingxi)在 IM 内流式**(ChatColumn 按 `kind==="assistant"` 走流式),`/assistant` 目的地重写为**真实流式聊天**(命令条 + 共享 s-lingxi 线程 + 流式 composer,与 IM 同一缓存)。流式 UI:思考点(原生 ThinkingDots)→ 增长文本 + 光标 → 完成;流中 composer 显「停止生成」。抽 `features/messages/parts.tsx`(`MessageBubble`+`Composer`)给 IM 与助手页复用;`MessageBubble` memo 化(流时只重渲染增长气泡)。② **重连/收到推送态可演示**:dev 钩子 `window.__lingxiDropWs()`(掉线→WsClient 重连→「重新连接…」横幅→恢复在线,**实测通过**)、`window.__lingxiIncoming()`(他人消息经 WS push→去重→会话列表末条+未读角标,**实测列表更新**);二者保留 `emit`/WS push 路径存活(P2 真实他人消息同此路径)。
- 关键决策:`/assistant` 与 `/messages/s-lingxi` 共享 s-lingxi 缓存(「消息+助手一个产品」,两入口同步);助手回复改**流式**(替代上轮的 WS 单条 push);流式指示器用**原生** ThinkingDots(`ChatLoader.Dots` 渲染正常但非必要,移除其 DS 再导出);消息线程用普通 overflow div(`ScrollShadow` 仅留在会话列表——线程流式频繁重渲染时无谓)。
- 产出物:`chat-frontend/src/features/messages/parts.tsx`(新)、改 `chat-frontend/src/features/{messages/MessagesPage,assistant/AssistantPage}.tsx`、`chat-frontend/src/api/{types,contract,mock,queries}.ts`、`packages/design-system/src/index.ts`。分支 `feat/chat-frontend-p2`。
- 阻塞:无(Mock 全通)。**B8 仍 gated**(S3 在做鉴权闭环、unit1a 网关 front agent;B8 未在 `30-plan §5` 定形)→ WS 真实 transport + 一行切待 S3。真实数据 wiring 待 S3 客户端 API(B6/B7/M9/M10/M11)。
- 交接 → **S3**:WS 握手适配层 + 流式 SSE 解析点就位;B8 定形/客户端 API 就绪请在 STATUS 通知我。→ **S2**:`/api/agent/chat` 流式接入时复用本 SSE 事件形(start/delta/usage/done/error + v);助手页预留复用 S2 的 trace/citation 组件位。
- 关键说明:**P1-4 剩余基元(Avatar/Field)本轮未换**——HeroUI v3 的 `TextField` 是容器型复合(type/value 落在 root vs Input,无 MCP 难核验,误置会破登录表单)、`Avatar` 无 `xl`/默认形状待核;为「不返工」保留原生(均 DESIGN.md 合规),待 MCP 恢复逐件核验后再换。
- 验证:`build -w chat-frontend` 绿(2146 模块)+ `verify:ui` 绿(43 文件);运行时实测——助手 `/assistant` 与 IM s-lingxi 均流式(思考点→逐块增长→完成、停止按钮)、掉线→「重新连接」横幅→恢复、他人消息 push→列表末条+未读、s-ada 线程 3 气泡、三端 6 路由 375/desktop 零横向溢出。注:**dev 流式偏慢**(本机 dev server 重渲染开销大,build 亦 ~7s;已把 delta 降到 ~5 块),production build 渲染快得多。

### 2026-06-27 · P1-4 原生基元换真实 HeroUI Pro/OSS + 好友申请接 mock action(分支 feat/chat-frontend-p1b)
- 完成:① **原生基元逐组件换真实 HeroUI**(本会话 heroui MCP 掉线,改按 `AGENT-REFERENCE.md` + 实读 installed `d.ts`/BEM CSS 核验 beta.6 API):**Button** → 包真实 `@heroui/react/button`(react-aria;变体 primary/secondary/tertiary/outline/ghost/danger/danger-soft;`onClick→onPress`、`disabled→isDisabled`、`iconOnly→isIconOnly`、`block→fullWidth` 映射,**调用点零改**);**Switch** → 新增 DS `Switch` 包真实 OSS Switch(v3.2 复合 `Content>Control>Thumb`,checked/onChange),Settings 四个开关换之;**ScrollShadow** → 会话列表 + 消息线程换真实 OSS ScrollShadow(`ref` 转发到滚动元素,线程自动滚底仍 OK)。Avatar/Field/Sheet 因形状/复合锚定风险留作下一增量(现原生件 DESIGN.md 合规)。② **好友申请「接受/忽略」接 mock action**:契约+mock 加 `respondApply(applyId,accept)`(接受加好友、忽略置 rejected),`useRespondApply` mutation 失效 applies+friends,ContactsPage 按钮接通(pending 禁用)。③ **`Page<T>` 对齐 `03-contracts §4`**:加 `hasMore`,mock 响应带 `hasMore:false`。
- **关键修复(workspace 坑):** 装真实 HeroUI(react-aria)后 dev 报 **Invalid hook call / dual-React**——symlink 的根 design-system 包引入 react-aria,Vite 解析出两份 React。`vite.config` 加 `resolve.dedupe:["react","react-dom"]` + 清 `.vite` 缓存解决(production build 本就过,仅 dev 暴露)。
- 产出物:`packages/design-system/src/components/{Button,Switch}.tsx`、`.../index.ts`(导出 Switch + 再导出 ScrollShadow)、改 `chat-frontend/src/features/{settings/SettingsPage,messages/MessagesPage,contacts/ContactsPage}.tsx`、`chat-frontend/src/api/{contract,mock,queries,types}.ts`、`chat-frontend/vite.config.ts`。分支 `feat/chat-frontend-p1b`。
- 关键决策:Button/Switch 包真实 OSS 件(与 agent-frontend 同款,D8),保留 DS 调用 API(onClick/disabled/iconOnly/block)使调用点零改;design-system 作单一 import 面(再导出 ScrollShadow)。
- 阻塞:无(Mock 全通)。**WS 握手 B8 仍 gated**——S3 unit2(网关+统一 JWT)进行中、**B8 未在 30-plan §5 定形**;定形后我按 ADR 0002 一行切并端到端验。真实数据 wiring 待 S3 客户端 API(B6/B7/M9/M10/M11)交接(Mock 同签名,交接后一处切)。
- 交接 → **S3**:WS 握手适配层就位(默认 `?token=&userUuid=`,合 `03-contracts §8`);B8 定形请在 STATUS 通知我。→ **S2**:DS 现含真实 HeroUI `Button`/`Switch`/`ScrollShadow`;若 agent-frontend 正式入根 workspace 消费 DS,token/组件 API 我(owner)配合对齐。
- 验证:`build -w chat-frontend` 绿(2145 模块)+ `verify:ui` 绿(42 文件);运行时实测——真实 Button(`button--primary` BEM,bg `#006FEE`)、真实 Switch(`input[role=switch]` 切主题+持久化 `lingxi-theme`)、ScrollShadow(滚动+自动滚到底)、助手回复经 WS 客户端仍**一次去重**、好友申请接受→加好友+申请消失、三端 6 路由 320/375/desktop 零横向溢出。

### 2026-06-27 · WS 客户端适配层(ADR 0002)+ 对抗式复核修 4 项潜伏 bug(P1-3 核心)
- 完成:按 ADR 0002 落地 WS 客户端适配层并对 Mock 推送测通:`WsClient`(指数退避+jitter 重连、心跳 30s、**收到 push 先落缓存再 ACK**、按 `msgUuid` 去重+有界淘汰、连接态机)+ 握手适配层(`buildHandshake`:`?token=&userUuid=` 默认 / `Sec-WebSocket-Protocol` 可切,待 S3 B8 定形)+ 线协议编解码(`MessageDTO{type,msgUuid,data}`、PushTypeEnum/MessageTypeEnum)+ 真实 `createWebSocketTransport`(P2 用)。api 契约 `connectWs`→`openWs(): WsTransport`(Mock=模拟单通道,真实=浏览器 WebSocket);`useWsBridge` 用 WsClient 把 push 桥进 react-query 缓存(push→失效→回填;重连→backfill),连接态→zustand→`ConnectionBanner`。
- **对抗式复核(9-agent workflow:3 lens 找 → 逐条对抗验证,6 raw→4 confirmed)抓出并修**(均真实但 Mock 下潜伏、P2 接真实后端才触发):① **type-5 撞号**:`OUT.HEART_BEAT=5` 与 `PUSH.NEW_GROUP_SESSION=5` 撞,`if type===HEART_BEAT return` 会把群会话推送当心跳回声丢弃且永不 ACK→服务端永久重投 → 改按「type5 且**无 msgUuid**」判心跳;② `frameNeedsAck` 同撞号 → 改为 `Boolean(msgUuid)`;③ **at-least-once 违反**:`remember(msgUuid)` 在 `onPush` 之前,若落缓存抛异常则消息被记为已见、下次重投被 ACK 丢弃(违反 ADR §4)→ 改为 onPush→remember→ack 顺序;④ Mock 增 at-least-once(解析客户端 ACK、未 ACK 则 600ms 重投一次),让去重路径对 Mock 也忠实。另自查并修一处 StrictMode 生命周期 bug(stop 后旧 transport 的 pending `onopen` 仍触发致心跳泄漏 → 加 `isCurrent` 守卫)。
- 产出物:`chat-frontend/src/api/ws/{transport.ts,WsClient.ts}`(新)、改 `chat-frontend/src/api/{mock.ts,contract.ts}`、`chat-frontend/src/app/useWsBridge.ts`。分支 `feat/chat-frontend-p1`。
- 关键决策:WS 握手默认 `?token=&userUuid=`(30-plan §5 首选项),接口隔离;S3 B8 定稿后一行切 `subprotocol` 并端到端验证。
- 阻塞:无(Mock 全通);真实联调待 S3 的 B6/B7/B8/M9/M10/M11。
- 交接 → **S3**:WS 握手适配层就位;请在 30-plan §5 定 B8 形态(`Sec-WebSocket-Protocol` vs `?token=&userUuid=`),我据此一行切换。
- 待中枢/下一单元:**P1-4「用真实 Pro 组件」尚未做**——真实工件+CSS 已就位(P1-2),原生基元→Pro 封装的逐组件替换留作下一聚焦单元(本会话 heroui MCP 掉线,且 beta.6 有 API 漂移如 PromptInput `variant`→`layout`,需逐件按 AGENT-REFERENCE 核验后替换,不宜在长 turn 末仓促);另 contacts 好友申请「接受/忽略」仍为静态,待接 mock action。
- 验证:build 绿(1879 模块)+ verify:ui 绿(41 文件);运行时实测——connecting→online(banner 自隐)、乐观发送→服务端协调→助手回复经完整 WS 路径(线帧解码→去重→push→缓存→ACK)且**仅渲染一次**(去重生效)、无控制台错误;三端×6 路由 `scrollWidth===clientWidth` 全过(真实 HeroUI CSS 后无溢出回归)。

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
