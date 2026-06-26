# InfiniteChat 规划与协调中枢(docs/planning)

> 本目录是整个 InfiniteChat 大仓的**规划与协调中枢(control tower)**。它不放业务代码,只放:总体规划、综合改进清单、四个子项目的工作计划、E2E 测试规范,以及**各工作流的状态台账**。

## 0. 工作方式约定(重要)

1. **本"中枢"对话只产出 md / 规划文件**,不写业务代码、不执行目录重命名/删除等改动磁盘结构的操作。代码改动由各子项目工作流(见下)各自完成。
2. **唯一状态台账 = [`STATUS.md`](STATUS.md)。** 任何工作流(含中枢)完成一个工作单元后,**必须**在 `STATUS.md` 自己的小节追加一条记录(模板见该文件顶部)。这是各流之间唯一的异步同步点——开工前先读它,收工后写它。
3. **跨子项目的决策以本目录为准。** 端口表、统一鉴权、响应包络、ID 类型、数据边界等"契约级"决定记录在 [`00-master-plan.md`](00-master-plan.md) 的「决策登记」一节;任何流不得各自其是,有异议先在 `STATUS.md` 提"待中枢确认"。
4. **冲突由中枢仲裁。** 例如同一交付物被两个流各做一份(已发生:见 §冲突登记),由中枢确定归属与合并方式。

## 1. 角色与归属

| 角色 | 代号 | 拥有 | 工作文档落点 | 计划文档(中枢维护) |
| --- | --- | --- | --- | --- |
| 规划协调中枢 | **HUB** | `docs/planning/` | 本目录 | — |
| agent 后端流 | **S1** | `agent/`(→agent-backend) | `agent/docs/` | [10-agent-backend-plan.md](10-agent-backend-plan.md) |
| agent 前端流 | **S2** | `agent-frontend/` | `agent-frontend/`(含 RENAME.md) | [20-agent-frontend-plan.md](20-agent-frontend-plan.md) |
| chat 后端流 | **S3** | `chat/`(→chat-backend) | `chat/docs/`、`chat/e2e/` | [30-chat-backend-plan.md](30-chat-backend-plan.md) |
| chat 前端流 | **S4** | `chat-frontend/` | `chat-frontend/` | [40-chat-frontend-plan.md](40-chat-frontend-plan.md) |
| 设计原型 | — | `infinitechat-web/` | 降级为**不发布**的设计系统参考 | 见总体规划 §前端策略 |

## 2. 文档索引

| 文件 | 作用 |
| --- | --- |
| [`STATUS.md`](STATUS.md) | **状态台账**:各流完成情况、阻塞、交接、待确认(唯一同步点) |
| [`00-master-plan.md`](00-master-plan.md) | 总体规划:愿景、目标架构、统一鉴权、端口表、决策登记、路线图、协调模型 |
| [`01-improvement-audit.md`](01-improvement-audit.md) | 综合改进清单(严重→轻微,跨三个代码项目;并纠正过期审计) |
| [`02-branding.md`](02-branding.md) | 品牌命名表:**灵犀 / Lingxi**(产品正式名,取代 InfiniteChat),采用范围与查重清单 |
| [`10-agent-backend-plan.md`](10-agent-backend-plan.md) | S1 计划 |
| [`20-agent-frontend-plan.md`](20-agent-frontend-plan.md) | S2 计划 |
| [`30-chat-backend-plan.md`](30-chat-backend-plan.md) | S3 计划 |
| [`40-chat-frontend-plan.md`](40-chat-frontend-plan.md) | S4 计划 |
| [`60-e2e-test-environment.md`](60-e2e-test-environment.md) | **系统级** E2E 测试环境规范(伞);chat 专项实现见 `chat/docs/E2E-TESTING.md` + `chat/e2e/` |

## 3. 既有事实文档(非本中枢产出,但是规划依据)

- `agent/docs/IMPROVEMENTS.md` — agent 后端 22 条审计(对抗式复核)。
- `PROJECT_AUDIT_ONBOARDING.md` — 早期 agent+chat 审计;**部分 P0 已在现源码修复**(详见 `01-improvement-audit.md` 的"过期项纠正")。
- `docs/project-documentation-redesign-spec.md` — 文档重写规范。
- `infinitechat-web/DESIGN.md` — 视觉/品牌设计规范(将抽取为共享设计系统)。

---
*维护者:HUB(规划协调中枢)。最后更新:2026-06-26。*
