# 更名说明 · agent → agent-backend(拟定)

> 本文件记录拟议的目录更名。**尚未在磁盘上执行**——本说明由「统筹规划」对话(2026-06-26)产出,只写文档不改目录。

| 项 | 现状 | 拟定 |
| --- | --- | --- |
| 目录 | `agent/` | **`agent-backend/`** |
| 定位 | Spring Boot 3.5 + LangChain4j 的 AI Agent 服务 | 不变(普通/流式聊天、RAG、Adaptive RAG、ReAct、长期记忆、工具治理、护轨、可观测) |
| 默认端口 | `SERVER_PORT:10010`(与 chat GateWay 冲突) | **`18080`**,context-path `/api`,置于统一网关之后(见总体规划端口表) |

## 为什么

与 `chat/`→`chat-backend`、`frontend/`→`agent-frontend` 一致地表达"这是后端"。更名属低风险但牵涉 IDE/脚本/CI 路径,建议与端口调整、置于网关之后一并在 P0/P1 落地。

## 关联

- 子项目计划:`docs/planning/10-agent-backend-plan.md`
- 既有审计:`agent/docs/IMPROVEMENTS.md`(22 条,对抗式复核)
- 总体规划:`docs/planning/00-master-plan.md`
