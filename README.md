# 灵犀(Lingxi)

> **一个 AI 原生的社交沟通产品** —— 把即时通讯(IM)和「懂你的」AI 助手做进同一个产品。
> **懂你的,不只是消息。**

[![release](https://img.shields.io/badge/release-v1.0.0-006FEE)](docs/RELEASE-NOTES-v1.0.0.md) · 单一 monorepo · 私有仓库

## 是什么

灵犀把两件事合成一个产品:**人对人的 IM** + **内置的「灵犀」AI 助手**(IM 内 @灵犀 即可对话,有真实 LLM、F01 工具确认、RAG 知识库)。工程上是一个大仓:两套后端运行栈 + 两个前端 + 统一网关 + 统一身份 + 共享设计系统。

## 架构(一张图)

```
            统一网关 GateWay :10010  ——  验 JWT 一次 → 注入可信 X-User-Id(剥离伪造)
              ├── /api/v1/**            → chat 栈(IM 微服务:Auth/Contact/Messaging/RealTime/Offline/Moment)
              └── /api/agent|rag|memory → agent 栈(:18080,Spring Boot 3 + LangChain4j;只信注入身份)
   共享中间件:MySQL(分库)· Redis · Nacos · Kafka(outbox+DLQ)· Postgres/PgVector(RAG)· 对象存储
   前端:chat-frontend(IM)· agent-frontend(助手)—— 共享 @infinitechat/design-system
```

## 仓库结构

| 目录 | 说明 |
|---|---|
| `chat/` | chat-backend:Spring Cloud Alibaba IM 微服务栈(7 单元 + chat-common + 网关) |
| `agent/` | agent-backend:Spring Boot 3.5 + LangChain4j(对话/RAG/工具/记忆) |
| `chat-frontend/` | IM 前端(Vite + React) |
| `agent-frontend/` | AI 助手前端(React 19 + HeroUI Pro) |
| `packages/design-system/` | 共享设计系统 `@infinitechat/design-system` |
| `docs/planning/` | 规划/契约/决策/状态台账(单一事实来源) |

## 状态

**v1.0.0(功能版)已发行** —— 全栈 E2E **57/57** + 生产 Docker 真栈冲烟 **12/12**(含真实 LLM delta 与 F01 工具确认)。详见 [发行说明](docs/RELEASE-NOTES-v1.0.0.md) 与 [CHANGELOG](CHANGELOG.md)。

## 文档

- [发行说明 v1.0.0](docs/RELEASE-NOTES-v1.0.0.md) · [CHANGELOG](CHANGELOG.md)
- [总体规划 + 决策登记 D1–D14](docs/planning/00-master-plan.md)
- [跨服务契约](docs/planning/03-contracts.md) · [编排规范](docs/planning/04-orchestration-playbook.md)
- [状态台账(阶段史 P0→v1.0.0)](docs/planning/STATUS.md)
- [E2E 测试环境](docs/planning/60-e2e-test-environment.md)

## 怎么跑

中间件部署在 WSL;在常驻 WSL 会话内按 `chat/e2e/01→03` 起栈、`04/06/07/08/10/11/12` 跑 E2E,生产冲烟用 `chat/scripts/runtime-smoke.sh`。详见 `docs/planning/60-e2e-test-environment.md`。

---

*产品名「灵犀 / Lingxi」(内部代号 InfiniteChat);品牌见 [`docs/planning/02-branding.md`](docs/planning/02-branding.md)。*
