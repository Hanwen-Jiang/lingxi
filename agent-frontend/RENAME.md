# 更名说明 · frontend → agent-frontend

> 本文件记录目录更名信息(应用户要求,更名信息放在该前端自己的文档里)。

## 结论

| 项 | 旧 | 新 |
| --- | --- | --- |
| 目录 | `frontend/` | **`agent-frontend/`** |
| `package.json` 的 `name` | `infinitechat-frontend` | **`agent-frontend`** |
| 定位 | "前端"(易被误解为整个产品的前端) | **仅 agent 后端的前端**(AI 助手工作台) |

## 为什么改名

`frontend/` 这个名字会让人误以为它是整个 InfiniteChat 产品的前端。实际上它**只是 agent 后端**(`agent/`,LangChain4j AI 服务)的 UI——一个流式聊天 + 设置页的助手工作台。IM(即时通讯)部分有独立的 **`chat-frontend/`**。所以更名为 `agent-frontend` 以消歧。

## 现状(2026-06-26)

- 磁盘上更名**已完成**:`agent-frontend/` 为本应用,旧 `frontend/` 目录已清空(留有 tombstone `frontend/README.md`,建议后续删除空目录)。
- 后端对应关系:`agent-frontend` ↔ `agent/`(拟更名 `agent-backend`)。
- 默认 API base 待修:`agent-frontend/src/api.ts` 当前默认 `http://localhost:10010/api` 实际指向了 chat 网关端口;应改为相对 `/api` + `VITE_API_BASE_URL`,经统一网关访问 agent(详见 `docs/planning/20-agent-frontend-plan.md` 与 `docs/planning/00-master-plan.md` 端口表)。

## 关联文档

- 子项目计划:`docs/planning/20-agent-frontend-plan.md`
- 总体规划与命名表:`docs/planning/00-master-plan.md`
- 设计语言来源:`infinitechat-web/DESIGN.md`(将抽取为共享设计系统)
