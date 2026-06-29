# Changelog — 灵犀(Lingxi)

本项目遵循语义化版本。完整阶段史(P0→P14)见 [`docs/planning/STATUS.md`](docs/planning/STATUS.md) 的 HUB 集成记录;发行说明见 [`docs/RELEASE-NOTES-v1.0.0.md`](docs/RELEASE-NOTES-v1.0.0.md)。

## [1.0.0] — 2026-06-30 🎉 首个功能版

**灵犀 = AI 原生的社交沟通产品**:即时通讯(IM)+ 内置「灵犀」AI 助手,统一网关 + 统一身份 + 共享设计系统的单一 monorepo。

### 验收(发行闸)
- **全栈 E2E 57/57 绿**(04 鉴权13 / 06 客户端10 / 07 IM14 / 08 实时4 / 10 agent入栈5 / 11 内助手5 / 12 翻转回归6)。
- **生产 Docker 真栈 runtime-smoke 12/12 绿**——含**真实 LLM 流式 delta** + F01 工具确认令牌一次性放行 + 跨源 CORS 实际 POST + IM 真实库落地。

### 累计能力(P0→P14)
- **统一鉴权**:网关单点验签 + 注入可信 `X-User-Id`(剥离客户端伪造);邮箱登录(邮箱+密码 / 邮箱验证码,无手机号);agent 置于网关后、不持 JWT 密钥;全栈统一响应包络 `{code,message,data,traceId,timestamp}`(`code=0` 成功)+ 真实 HTTP 状态。
- **IM**:实时收发(Netty WebSocket,浏览器 `?token=&userUuid=` 握手);**消息数据安全**(生产者与 outbox 同本地事务落库 + Kafka DLQ);会话/历史(游标分页)/好友/已读游标/媒体。
- **内置「灵犀」助手**:IM 内 @灵犀 → agent SSE §9 流式(真实 LLM);**F01 一次性挑战令牌**工具确认;RAG(Qwen `text-embedding-v4` 嵌入 + pgvector + RRF/重排三段式阈值)。
- **契约/工程**:JSON 内 string 化 snowflake(D5);共享 `@infinitechat/design-system`(D8);单一 monorepo(D13);可观测指标(Prometheus)。
- **上线**:生产 Docker 栈换成鉴权版(关闭 pre-P0 无鉴权安全洞)。

### 部署备注
- 生产 gateway 实际对外口为 **`:11010`**(agent `:11011`);历史文档的 `:10010` 因宿主 `netsh portproxy` 陈旧而返回空响应——属部署运维项,不影响 v1.0.0 代码验收。

### 仍开放(post-1.0,非阻断)
- deploy 配置固化(需 sudo 落盘 `chat/scripts/deploy/p10-deploy-config.diff`)、`:10010` portproxy 重定向、COS 媒体公开读策略、横向扩容(实时态 Redis 化、M5)、生产化基建(CI/CD、Flyway 迁移、备份/容灾、负载/SLO)。

---

> 里程碑 tag:`v0.1-e2e-green`(P7,首次全栈 E2E 绿)→ `v1.0.0`(P14,发行验收)。
