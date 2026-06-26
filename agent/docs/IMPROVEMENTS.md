# IMPROVEMENTS — 不足与改进建议

> 本文是对 InfiniteChat-Agent 的一次严肃工程审计。结论由「一个审计 Agent 通读源码罗列候选 → 每条再由一个独立 Agent 对抗式复核(默认怀疑、要求源码证据)」两步产生,共 **22 条**,**全部确认在当前代码中真实存在**。复核阶段对若干条的严重度做了校准,并纠正了原始审计里几处夸大或口径错误——这些都如实写在每条的「✅ 验证校准」里。

## 怎么读这份报告

- **严重度**:按复核后的校准值,分 `高 / 中 / 低` 三档。
- **🎛 有意取舍**:标记该问题是否属于「明显刻意的工程权衡」(如本地降级、演示用占位)。对一个教学 / 个人项目而言,有意取舍未必要改,但**上生产前必须重新评估**。
- 每条给出 `位置`(文件:行)、`现象`、`影响`、`建议`,以及对抗复核的结论。

> ⚠️ 一句话定调:这是一个**设计完整度很高、但安全与生产化尚未补齐**的学习型项目。它的护轨/治理/监控/降级设施齐全,唯独**身份认证与越权防护整体缺失**——这是上生产前的头号阻断项。

---

## 总览表

| ID | 严重度 | 类别 | 标题 | 有意取舍 |
| --- | --- | --- | --- | --- |
| F02 | 🔴 高 | 安全 | 全链路无鉴权,`userId` 客户端任意指定 → 水平越权(IDOR) | 否 |
| F03 | 🔴 高 | 安全 | CORS 同开 `allowCredentials` + 通配 `origin` | 否 |
| F01 | 🟠 中 | 安全 | 高风险工具「人工确认」无状态,客户端可自助绕过 | 🎛 是 |
| F04 | 🟠 中 | 性能 | 工具审计同步阻塞在请求主链路,每次一条 INSERT | 否 |
| F06 | 🟠 中 | 设计局限 | Embedding 是 SHA-256 哈希伪向量,无语义 | 🎛 是 |
| F07 | 🟠 中 | 正确性 | 向量检索 `minScore` 与哈希嵌入分布不匹配,召回近乎为 0 | 部分 |
| F08 | 🟠 中 | 性能 | 关键词检索 `LIKE %term%` 全表扫描 + 中文不分词 | 否 |
| F09 | 🟠 中 | 可靠性 | 文档入库跨 MySQL/向量库无事务无补偿,易脏数据 | 否 |
| F11 | 🟠 中 | 正确性 | 证据评估 `topScore` 混用四种不同量纲分数取 max | 否 |
| F13 | 🟠 中 | 设计局限 | ReAct 实为单步分发,无真正多步 TAO 循环 | 否 |
| F14 | 🟠 中 | 安全 | Prompt 注入检测仅固定子串黑名单,易绕过 | 否 |
| F21 | 🟠 中 | 测试缺口 | 核心编排/治理/检索几乎无单测 | 否 |
| F05 | 🟡 低 | 可靠性 | BGE 重排失败用进程级全局冷却,一次失败全员降级 60s | 🎛 是 |
| F10 | 🟡 低 | 可靠性 | 内存向量库降级后不重建;维度 1024 两处硬编码 | 🎛 是 |
| F12 | 🟡 低 | 设计局限 | 自适应 RAG `max-rounds=2` + 规则改写,深度有限 | 🎛 是 |
| F15 | 🟡 低 | 可维护性 | `InputSafetyService` 用 `new` 而非 Bean,规则硬编码 | 🎛 是 |
| F16 | 🟡 低 | 正确性 | 记忆去重/纠错只扫前 20 条活跃记忆,超出漏判 | 🎛 是 |
| F17 | 🟡 低 | 设计局限 | 记忆去重用 Jaccard 词集,对中文与改写鲁棒性差 | 🎛 是 |
| F18 | 🟡 低 | 可靠性 | `EmailTool` 吞异常返回字符串,成败靠 `contains("成功")` | 否 |
| F19 | 🟡 低 | 可维护性 | 历史落库手工拼 JSON,转义不完整 | 否 |
| F20 | 🟡 低 | 正确性 | RRF/Rerank 原地 mutate 共享对象(code smell) | 🎛 是 |
| F22 | 🟡 低 | 可维护性 | 多处会话窗口/魔法值硬编码,部分配置项未生效 | 否 |

---

## 如果只做三件事(优先级建议)

1. **补上身份认证 + 越权防护(F02 / F03 / F01)**。这是上生产的硬门槛:目前任意调用方传 `userId=任意值` 即可读写/纂改他人长期记忆、读取他人工具审计(含 prompt 快照),CORS 又对任意源带凭据全开。先接入认证(JWT/Session),让 `userId` 来自已认证主体而非请求参数;CORS 换显式白名单。
2. **让「向量检索」名副其实(F06 / F07)**。把真实嵌入模型(DashScope `text-embedding-v4` / 本地 `bge-m3`)接为 `@Primary EmbeddingModel`,并把检索召回阈值与引用展示阈值解耦(检索用低阈值/不设阈值)。否则默认哈希嵌入下向量分支几乎召回空集,「混合检索」静默退化成只剩关键词一路。
3. **核心逻辑补单测(F21)**。治理决策矩阵、Planner 路由、证据评估阈值、RRF 融合都是确定性纯逻辑,极易测;它们恰恰是系统价值核心却零覆盖,改动极易引入静默回归。

---

## 🔴 高严重度

### F02 — 全链路无身份认证,`userId` 客户端任意指定(水平越权 / IDOR)

- **位置**:`agent/src/main/java/com/lou/infinitechatagent/controller/AgentController.java:47-54`、`controller/MemoryController.java`、`memory/LongTermMemoryService.java:164-192`
- **现象**:`AgentController.chat/toolAudit`、整个 `MemoryController` 都直接从请求体或 `@RequestParam` 读取 `userId`,据此读写 `agent_memory`、`agent_tool_audit`。`findActiveByUser` / `listAuditRecords` 仅按传入 `userId` 过滤,无任何登录态校验。
- **影响**:任意调用方传 `userId=任意值` 即可读取/合并/纠正/停用他人长期记忆(`/memory/correct` 会先把目标用户某类型全部活跃记忆停用再覆盖),或读取他人工具审计记录(prompt 快照可能含敏感信息)。典型 IDOR。
- **建议**:引入认证(JWT/Session),`userId` 从已认证主体获取;所有按 `userId` 的查询/写入都校验「当前主体 == 目标」。
- **✅ 验证校准**:**真实,维持高,且范围比原报告更广**。复核确认 `agent` 模块自带独立 `pom.xml`,无 `spring-boot-starter-security`,无 `SecurityFilterChain/@PreAuthorize/JWT filter`;唯一 filter 是全开放的 CORS。同仓 `chat` 微服务的 JWT 网关只代理 `/api/v1/**`,不覆盖 `agent` 的 `/agent/**`、`/memory/**`,故 `agent` 可被直连利用。代码里有 guardrail/治理/监控等生产化设施却独缺鉴权,判为**遗漏而非有意取舍**。

### F03 — CORS 同时开启 `allowCredentials` 与通配 `origin`

- **位置**:`agent/src/main/java/com/lou/infinitechatagent/config/CorsConfig.java:23-48`
- **现象**:`setAllowCredentials(true)` 同时 `addAllowedOriginPattern("*")`、`allowedOriginPatterns("*")`,对 `/**` 全量放行并暴露所有响应头;`@Order(HIGHEST_PRECEDENCE)` 的 `CorsFilter` 优先生效。
- **影响**:`allowedOriginPatterns(*) + allowCredentials(true)` 是 OWASP/Spring 明确点名的危险组合;配合 F02 的无鉴权接口,放大了浏览器侧跨域读取响应、数据外泄的攻击面。
- **建议**:用显式白名单 origin 替换 `*`;无需 Cookie 凭据则关闭 `allowCredentials`;按需收紧暴露头与方法。
- **✅ 验证校准**:**真实,维持高**。逐行核对属实。一处客观说明:因当前并无基于 cookie/session 的鉴权,接口本就对任意来源裸奔,CORS 主要放大的是浏览器跨域读取能力;但该配置本身即公认反模式,且无任何 profile/注释表明是有意降级。

---

## 🟠 中严重度

### F01 — 高风险工具「人工确认」无状态,客户端可自助绕过

- **位置**:`agent/src/main/java/com/lou/infinitechatagent/agent/governance/ToolGovernanceService.java:90-106`、`agent/dto/AgentRequest.java:16`
- **现象**:`evaluate()` 判定 `confirmationRequired` 后,是否放行只取决于请求体自带的 `request.getConfirmedTools().contains(toolName)`,无服务端一次性挑战令牌、无二次校验、无鉴权。
- **影响**:`EMAIL_SEND` 等 HIGH 工具的「用户确认」形同虚设:第一次拿到 `confirmationRequired`,第二次把 `{"confirmedTools":["email_send"]}` 塞进去即可放行。
- **建议**:服务端生成一次性 confirmation challenge(带 `userId/sessionId/动作指纹 + TTL`,存 Redis),客户端必须回传 challenge token 而非工具名;确认请求须经认证。
- **✅ 验证校准**:**真实,高→中**。它是一个「人工确认」的 UX 闸门而非可信安全边界,属有意取舍;「越权」措辞已校准——本质是「确认护轨可被任意客户端伪造」。若部署到多租户已认证环境则应视为高。

### F04 — 工具审计同步阻塞在请求主链路

- **位置**:`agent/.../agent/governance/ToolGovernanceService.java:43-118,173-188`
- **现象**:`evaluate()` 的全部 6 个返回分支在 return 前都同步 `ragJdbcTemplate.update(insert ... agent_tool_audit ...)`,跑在 ReAct 主请求线程上,无 `@Async`。
- **影响**:审计写库延迟计入用户响应时延;MySQL 抖动/连接池打满会拖慢甚至阻塞所有 Agent 请求;高 QPS 下该表成写热点。
- **建议**:审计改异步(`@Async`/事件/写队列批量落库),写失败只告警不影响主流程。
- **✅ 验证校准**:**真实,维持中**。调用栈确为同步 Spring MVC,无线程切换。但单条小 INSERT 相对同请求内的 LLM/RAG 调用开销很小,稳态时延贡献边际,风险集中在 DB 退化的尾部,故不升高。

### F06 — Embedding 是 SHA-256 哈希伪向量,无语义

- **位置**:`agent/src/main/java/com/lou/infinitechatagent/config/HashEmbeddingModel.java:37-52`、`config/AiModelConfig.java:49-53`
- **现象**:`embeddingModel()` 被标 `@Primary` 固定返回 `new HashEmbeddingModel`,`vectorize()` 仅按 SHA-256 分桶累加符号、按空白切词(中文整段不分词);`application.yml` 里配的 `text-embedding-v4` 因自动配置被排除,从不被装配为活动 `EmbeddingModel`。
- **影响**:「向量检索」退化为词面哈希碰撞,无近义/语义召回;中文未分词时整段进同一桶。
- **建议**:把真实嵌入模型接为 `@Primary`,`HashEmbeddingModel` 仅作离线兜底并显式标注。
- **✅ 验证校准**:**真实,高→中**。这是有文档的有意取舍(类名即 `HashEmbeddingModel`,03/08 章已标注「生产请换真 Embedding」);且向量并非唯一召回路径,还有并行的关键词 + RRF 融合,RAG 不会完全失效,故降为中。

### F07 — 向量检索 `minScore` 与哈希嵌入分布不匹配,召回近乎为 0

- **位置**:`agent/src/main/java/com/lou/infinitechatagent/rag/VectorSearchService.java:26-38`
- **现象**:`search()` 用 `minScore`(`rag.citation.min-score` 默认 `0.75`)过滤,而默认哈希嵌入产生的稀疏符号向量间相似度极少达标。
- **影响**:默认配置下向量分支基本召回空集,Hybrid 退化为只剩关键词 LIKE 一路,违背「向量+关键词融合」设计目标且难以察觉。
- **建议**:检索召回阈值与引用展示阈值**解耦**(检索用更低/无阈值,引用展示再用高阈值);阈值随实际嵌入模型标定。
- **✅ 验证校准**:**真实,高→中,但原数值前提被纠正**。复核发现 LangChain4j 的 `minScore` 比的是 relevance score = `(cosine+1)/2`,故 `0.75` 等价于要求 `cosine≥0.5`(而非原报告说的 `cosine≥0.75`)。同款算法仿真显示:默认 500 字符 chunk 下,正常相关片段普遍过不了阈值,向量召回确被严重压制;阈值与嵌入不匹配是真实缺陷(死的 dashscope 配置佐证 0.75 是给真实嵌入用的),但接入真实嵌入即可恢复,故定中。

### F08 — 关键词检索 `LIKE %term%` 全表扫描 + 中文不分词

- **位置**:`agent/src/main/java/com/lou/infinitechatagent/rag/KeywordSearchService.java:21-73`
- **现象**:对每个关键词生成 `(content like ? or file_name like ? or chunk_id like ?)` 用 `or` 拼接,前导通配 `%kw%` 无法走索引;`rag_chunk.content` 无任何索引、无全文索引;`extractKeywords` 对无空格中文整句当作一个长「词」做子串匹配。
- **影响**:语料增大后检索延迟线性恶化;中文无真正分词,召回质量与性能双输。
- **建议**:改 MySQL 全文索引(ngram parser)或外部引擎(ES/PGroonga);中文接分词器;避免 `content` 上前导通配 LIKE。
- **✅ 验证校准**:**真实,维持中**。三项子声明全部核实。它是 RRF 的关键词分支(带 limit),向量仍可兜底语义,属性能/召回退化而非功能性 bug,故不升高;但全表扫描随语料变慢、中文无分词两点真实,不降低。

### F09 — 文档入库跨 MySQL/向量库无事务无补偿

- **位置**:`agent/src/main/java/com/lou/infinitechatagent/rag/DocumentIngestionService.java:110-213,671-682`
- **现象**:`ingestDocument` 先逐条 `insert rag_chunk`(MySQL,每条自动提交),再 `embeddingStore.addAll`(向量库);`purgeDocumentChunks` 先删向量再删行。全程无 `@Transactional`,且跨两套存储本就无法用单库事务覆盖。
- **影响**:向量写入抛异常 → chunk 已写入但向量缺失(`embedding_id` 悬空、检索取不到);purge 中途失败 → 孤儿行/丢向量。无补偿无回滚。
- **建议**:引入「先写状态再异步建向量」的 outbox/对账机制,或对单文档加失败清理;至少记录入库状态并提供重建/对账任务。
- **✅ 验证校准**:**真实,高→中**。复核纠正一处口径:即便加 `@Transactional` 也解决不了跨存储原子性(向量库不在 JDBC 事务内),真正缺口是无补偿/无最终一致性。另发现一个更隐蔽的恢复缺陷:某 chunk 已 insert 但向量未写入时,因内容哈希准幂等(`existed=true`)重跑会**永久跳过**其 embedding。触发面主要在异常/崩溃路径,正常路径不受影响,故定中。

### F11 — 证据评估 `topScore` 混用四种不同量纲分数

- **位置**:`agent/src/main/java/com/lou/infinitechatagent/rag/adaptive/RuleBasedEvidenceEvaluator.java:45-84`
- **现象**:`bestScore()` 对 `rerankScore / fusionScore / vectorScore / keywordScore` 取 `max` 作为 `topScore`,再与 `min-top-score=0.45` 比较。这四者量纲完全不同:fusion 是 RRF 分(量级约 0.016–0.033)、vector 是余弦、keyword 是命中比例 [0,1]、rerank 来自 BGE 可能 >1。
- **影响**:不同量纲取 max 比单一阈值,导致「证据是否充分」判定不可解释,直接影响是否改写/是否回答。
- **建议**:按来源分别归一化,或只用单一可比口径(如统一 rerank 归一分)评估,阈值与该口径绑定并文档化。
- **✅ 验证校准**:**真实,维持中,失效模式被纠正**。原报告说「无 rerank 时几乎总不过阈」不准:因 `vectorScore` 有 `min-score=0.75` 硬下限,只要召回里有任一向量来源 chunk,`bestScore≥0.75>0.45` 恒过阈。真实失效模式是 `min-top-score=0.45` 这道闸在常见路径上**几乎恒为真、近乎失效/不可解释**;但还有 coverage/citation 两道独立闸托底,不会灾难性翻转决策。

### F13 — ReAct 实为单步分发,无真正多步循环

- **位置**:`agent/src/main/java/com/lou/infinitechatagent/agent/ReActAgentOrchestrator.java:89-116,135-166`
- **现象**:`chat()` 只 `plan()` 一次,`switch` 到单一 action 后立即产出 `FINAL_ANSWER`,`reactTrace` 永远只有 `step=1`;`AgentPlanner.plan(String)` 不接收历史 Observation,无法把工具结果回喂规划器。
- **影响**:无法处理「先查时间再发邮件」「先检索再总结」等多工具串联任务,能力上限被框死在单工具。`ReAct/REACT_*` 命名夸大了实际能力。
- **建议**:实现真正迭代循环:把每步 observation 拼回上下文交给 planner,直到 `FINAL_ANSWER` 或达步数上限;`reactTrace` 记录多步。
- **✅ 验证校准**:**真实,维持中**。在其支持范围(单工具任务,即真实主用例)内行为正确、不产生错误结果,故不升高;但「ReAct」在此更像路由标签,能力上限被框死的设计局限真实存在。

### F14 — Prompt 注入检测仅固定子串黑名单,易绕过

- **位置**:`agent/src/main/java/com/lou/infinitechatagent/guardrail/InputSafetyService.java:13-57`
- **现象**:`detectPromptInjection` 把输入 `toLowerCase` 后只做 8 个固定短语 `contains` 匹配;暴力意图仅靠 3 条正则。无全角/空格/同义/多语言归一化。
- **影响**:换语言、变体、插空格(如 `disregard earlier guidance`、`忽 略 系统 规则`)即可绕过;合法问题含这些字面又会被误杀。它是工具治理注入拦截的**唯一依据**。
- **建议**:用规范化 + 模糊匹配/分类模型/LLM 审查替代纯子串;注入检测与业务关键词解耦,降低误杀。
- **✅ 验证校准**:**真实,维持中**。证据全部属实,绕过示例成立。属纵深防御 guardrail 而非唯一防线(LLM 自身仍有安全约束),故不升高。

### F21 — 核心编排/治理/检索几乎无单测

- **位置**:`agent/src/test/java/com/lou/infinitechatagent/`(全部 7 个测试类)
- **现象**:`src/test` 仅 7 个测试(且 `ApplicationTests` 仅 `new` 一下应用、连上下文都不加载);`ReActAgentOrchestrator`、`ToolGovernanceService`、`AdaptiveRagOrchestrator`、`HybridSearchService`、`RuleBasedEvidenceEvaluator`、各 Planner 等关键类零单测。
- **影响**:占系统价值核心的逻辑无回归保护,F01/F11/F13 这类改动极易引入静默回归。
- **建议**:为治理决策矩阵(放行/拦截/需确认/注入命中)、planner 路由、证据评估阈值边界、RRF 融合与 token 预算补单测;mock `ChatModel`/`JdbcTemplate`。
- **✅ 验证校准**:**真实,维持中**。被点名类含大量确定性纯逻辑(如 RRF `1.0/(60+i+1)` 任一 off-by-one 会静默劣化排序),却零覆盖;无任何 `@Disabled`/demo-only 信号。非正确性/安全缺陷故不到高,但显著削弱回归保护故高于低。

---

## 🟡 低严重度(含若干有意取舍 / 潜伏隐患)

### F05 — BGE 重排失败用进程级全局冷却(🎛 有意取舍)
- **位置**:`rag/BgeRerankService.java:55,73-93`。单例 bean 的 `volatile unavailableUntilMs`,任一请求一次异常即设 `now+60000`,期间所有查询走规则重排。
- **校准**:**真实,中→低**。03 章明确把它描述为「优雅降级」,降级目标是纯本地规则打分仍能出结果(影响检索质量而非可用性),且窗口过后自动重试可自愈。真实缺陷是 blast radius 过粗(进程全局、单次瞬时异常即触发满 60s、无 half-open),属对一个有意 pattern 的过简实现。建议换 Resilience4j 带半开探测。

### F10 — 内存向量库降级后不重建;维度 1024 两处硬编码(🎛 有意取舍)
- **位置**:`config/EmbeddingStoreConfig.java:39-60`、`config/AiModelConfig.java:28`。PgVector 异常时降级空的 `InMemoryEmbeddingStore` 不回灌(`rag_chunk` 也不存原始向量);`dimension(1024)` 写死,`application.yml` 无 `pgvector.dimension` 键。
- **校准**:**真实,中→低**。降级由 `agent.local-fallback.enabled`(默认 true)显式门控并打 warn,属有意本地降级;维度问题是潜在踩坑点(换嵌入模型需多处同步)而非当前活跃故障。建议降级时从 `rag_chunk` 重算重建或显式标记 RAG 不可用;维度由单一配置驱动。

### F12 — 自适应 RAG `max-rounds=2` + 规则改写,深度有限(🎛 有意取舍)
- **位置**:`rag/adaptive/AdaptiveRagOrchestrator.java:107-127`、`RuleBasedQueryRewriteService.java:111-129`。实际最多改写 1 次;改写靠正则抽错误码/配置项 + 硬编码 `504/409/错误` 词典;轮次间不切换检索策略。
- **校准**:**真实,维持低**。`max-rounds`、`rewrite.enabled` 均可配,planner 还可切 LLM,属刻意做成「轮次受限、低成本、规则兜底」。注意:改写器无条件走规则、无 LLM 备选(`LlmRetrievalPlanner` 只是「规划器」实现)。属已知能力边界,可提高 `max-rounds` 或接入 LLM 改写扩展。

### F15 — `InputSafetyService` 用 `new` 而非 Bean(🎛 部分被框架所迫)
- **位置**:`agent/governance/ToolGovernanceService.java:41`、`guardrail/SafeInputGuardrail.java:18`、`guardrail/InputSafetyService.java:13-28`。两处各 `new InputSafetyService()`,规则写死为 static 常量。
- **校准**:**真实,维持低**。`SafeInputGuardrail` 经 LangChain4j `@InputGuardrails(X.class)` 以 `.class` 注册、由框架反射无参实例化,这处 `new` 部分是注册方式所迫;两处 new 的是同一类逻辑不重复。真实的可维护性问题但范围小。建议把 `InputSafetyService` 注册为 Bean、敏感词外置可配。

### F16 — 记忆去重/纠错只扫前 20 条活跃记忆(🎛 有意取舍)
- **位置**:`memory/LongTermMemoryService.java:103-112,164-192`。`findActiveByUser` 的 `safeLimit=min(limit,20)` 硬封顶;去重/纠错/检索候选都基于这 ≤20 条。
- **校准**:**真实,中→低**。07 章已显式文档化「limit 硬卡 20…这是有意的保护」。排序按 `confidence desc` 优先保留重要项;`/correct` 不会因两次调用突破上限(第二次对已禁用行 no-op)。单用户单类型活跃记忆超 20 条是边缘场景。属有界退化。建议去重/纠错走数据库侧匹配(归一化内容/向量相似度)而非应用层取前 20。

### F17 — 记忆去重用 Jaccard 词集,对中文与改写鲁棒性差(🎛 有意取舍)
- **位置**:`memory/LongTermMemoryService.java:266-290,109`。token 集合 Jaccard,阈值写死 `0.72`;中文无分词。
- **校准**:**真实,维持低**。独立复现验证:「喜欢用 Java」vs「技术栈是 Java 后端」得分 0.25<0.72 判为不相似而重复写;无空格中文短语整段坍缩成单 token,甚至子串扩展也得 0.000,使 `mergeText` 的 contains 合并因 similarity 先返回 0 而永不可达。本工程无 embedding 去重备选(`HashEmbeddingModel` 对中文同样缺陷)。仅降低去重质量,不损坏数据。建议用嵌入相似度做语义去重 + 中文分词。

### F18 — `EmailTool` 吞异常返回字符串,成败靠 `contains("成功")`
- **位置**:`tool/EmailTool.java:30-48`、`agent/ReActAgentOrchestrator.java:317-328`。`catch(Exception)` 后返回 `"邮件发送失败: "+msg` 不抛出;上层用 `toolResult.contains("成功")` 判成败,并把整段结果(失败时即异常 message)原样拼进给用户的回答。
- **校准**:**真实,中→低**。当前失败串不含「成功」、与成功串互斥,`contains` 判定今天恰好正确,属潜在脆弱(改文案才失效)而非现行 bug;信息泄漏边界有限(SMTP 异常文本),邮件本是低频路径。建议工具返回结构化结果对象、`success` 用类型化字段、失败文案脱敏。

### F19 — 历史落库手工拼 JSON,转义不完整
- **位置**:`controller/AgentController.java:61-69,87-89`。`recordSuccess` 的 metadata 用字符串拼 JSON,`safe()` 只替换双引号,不处理反斜杠/换行/控制字符。
- **校准**:**真实,维持低,影响被纠正**。复核发现 `finalAction` 是枚举(仅 `[A-Z_]+`)、`strategy` 全是硬编码字面量,均非用户可控,当前**无法**触发非法 JSON 或注入——`safe()` 的引号转义对现状基本是无效防御代码。属潜伏可维护性隐患(日后若把自由文本接入 `strategy` 就会产坏数据)。建议用 `ObjectMapper`/`Map` 序列化。

### F20 — RRF/Rerank 原地 mutate 共享对象(code smell)
- **位置**:`rag/HybridSearchService.java:69-98`、`rag/BgeRerankService.java:144-150`、`rag/RuleBasedRerankService.java:17-21`。融合/重排各阶段原地 `setFusionScore/setRerankScore` 同一 `RetrievedChunk` 实例,无不可变边界。
- **校准**:**真实,维持低,但两条具体危害被反驳**。复核确认:(1) `search()` 在 `fuse()` 前已对两个 future `join()`,融合是单线程串行,**不存在**并发写共享对象;(2) `debug.scoreDetails` 拷进全新不可变 DTO 且在 rerank 之后才快照,**不存在**「早期快照被回写」。`RagQueryService` 后续阶段又基于 `copyWithText` 深拷贝。对象别名客观存在属可接受取舍/轻微 smell,无可观测缺陷(原报告影响声明夸大,接近 invalid)。建议各阶段产出不可变副本、显式指定线程池。

### F22 — 多处会话窗口/魔法值硬编码,部分配置项未生效
- **位置**:`rag/RagQueryService.java:236-243,148-150`、`rag/adaptive/AdaptiveRagOrchestrator.java:498-499`。`buildChatMemory` 写死 `maxMessages(20)`(`rag` 块下根本没有 `memory-max-messages` 键,而 `AdaptiveRagOrchestrator` 读 `rag.adaptive.memory-max-messages`);`applyTokenBudget` 两路径 `fixedPromptChars` 一处 `+600` 一处 `+400`;`RuleBasedRerankService` 权重 `0.75/0.20/0.05` 硬编码。
- **校准**:**真实,维持低,一处证据被纠正**。复核确认 `maxMessages=20` 硬编码(因该类没接配置键,改 yml 不生效)、`+600/+400` 裸魔法数、权重硬编码均属实;但原报告称 `min-relevance 0.08` 硬编码**有误**——它在 `MemoryRetrievalService.java:29` 经 `@Value("${memory.context.min-relevance-score:0.08}")` 读取,改 yml **会**生效;阈值 `0.72` 的位置也应是 `LongTermMemoryService.java:109` 而非 rerank 服务。建议统一从配置注入窗口大小与各预算常量,magic number 命名为常量并注释。

---

## 审计方法说明

本报告由一次后台工作流产生:1 个审计 Agent 通读 `agent/`、`rag/`、`memory/`、`governance/`、`guardrail/`、`config/`、`monitor/`、`test/` 源码,罗列 22 条候选不足;随后 22 个独立 Agent 各自打开相关源码,对每条做对抗式复核(默认怀疑、要求行级证据、判断是否有意取舍、校准严重度)。**22 条全部确认真实存在**;复核期间下调了 8 条的严重度、纠正了 F07/F11/F16/F19/F20/F22 等处的夸大或口径错误,均已如实并入正文。

> 这些不足绝大多数对一个「学习 / 个人项目」是合理的演进阶段。**唯独 F02 / F03(无鉴权 + 危险 CORS)是上生产前的硬阻断项,建议优先处理。**
