# 灵犀(Lingxi)v1.0.0 发行说明

> 发布日期:2026-06-30 · 标签 `v1.0.0` · 仓库 `github.com/Hanwen-Jiang/lingxi`

## 这是什么
**灵犀 = 一个 AI 原生的社交沟通产品**:把「即时通讯(IM)」和「懂你的 AI 助手」做进同一个产品。单一 monorepo,两套后端运行栈(Spring Cloud IM + Spring Boot 3 / LangChain4j Agent)+ 两个前端,统一网关 + 统一身份 + 共享设计系统。Slogan:**懂你的,不只是消息。**

## v1.0.0 交付的能力
- **统一鉴权与登录**:邮箱+密码 / 邮箱验证码登录(无手机号);网关单点验签 + 注入可信身份;一次登录同时认证 IM 与 Agent 两栈;agent 拒直连。
- **即时通讯**:实时收发(发→对端无刷新到达)、消息**数据安全**(同事务 outbox + Kafka DLQ,消费中断/毒消息不丢历史)、会话/历史分页/好友/已读/媒体。
- **内置「灵犀」助手**:IM 内 @灵犀 → 真实 LLM 流式回答(SSE §9);高危工具走**一次性挑战令牌确认**(F01);RAG 知识检索(真实嵌入 + pgvector)。
- **统一契约**:全栈响应包络一致(`code=0` 成功 + 真实 HTTP 状态);JSON id 全 string 化。
- **可观测 + 上线**:Prometheus 指标;生产 Docker 栈为鉴权版。

## 验收证据(发行闸)
| 项 | 结果 |
|---|---|
| 全栈 E2E | **57/57 绿**(鉴权13 / 客户端10 / IM14 / 实时4 / agent入栈5 / 内助手5 / 翻转回归6) |
| 生产 Docker 真栈 runtime-smoke | **12/12 绿**(含**真实 LLM delta**、F01 令牌一次性放行、跨源 POST CORS、IM 真实库落地) |
| 版本化构建 | chat-common + 7 服务 + agent `InfiniteChat-Agent-1.0.0.jar`,BUILD SUCCESS |

验收在常驻 WSL 会话内首手跑通(中间件 MySQL/Redis/Nacos/Kafka/PgVector 均在 WSL)。E2E 脚本见 `chat/e2e/`,生产冲烟见 `chat/scripts/runtime-smoke.sh`。

## 已知事项 / 部署备注
- **对外端口**:生产 gateway 实际发布在主机 **`:11010`**(agent `:11011`)。文档历史写的 `:10010` 现被宿主 `netsh portproxy`(陈旧)占用、返回空响应。要固定回 `:10010` 需在宿主网络层调整后复跑冲烟——属部署运维项,不阻断 v1.0.0 代码验收。
- 面向**外部真实用户**还需真服务器 + 域名 + TLS(当前上线 = 本机 WSL Docker 运行态)。

## 仍开放(post-1.0 路线)
deploy 配置固化(sudo 落盘)、`:10010` portproxy、COS 媒体公开读、横向扩容(实时态 Redis 化 / Snowflake 多实例已做)、生产化基建(CI/CD + Flyway 迁移 + 备份/容灾 + 负载/SLO)、多设备(D11 延后)。

## 怎么跑(开发/验收)
中间件在 WSL;在常驻 WSL 会话内:`chat/e2e/01-setup-infra.sh` → `02-build.sh` → `03-start-apps.sh` → 冒烟 `04/06/07/08`,agent 入栈 `09/10`,内助手 `11`,契约 `12`;生产冲烟 `chat/scripts/runtime-smoke.sh`。详见 [`docs/planning/60-e2e-test-environment.md`](planning/60-e2e-test-environment.md) 与 `chat/docs/E2E-TESTING.md`。

---
*阶段史 P0→P14 见 [`docs/planning/STATUS.md`](planning/STATUS.md);决策登记 D1–D14 见 [`docs/planning/00-master-plan.md`](planning/00-master-plan.md);跨栈契约见 [`docs/planning/03-contracts.md`](planning/03-contracts.md)。*
