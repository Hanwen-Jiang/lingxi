# 更名说明 · chat → chat-backend(拟定)

> 本文件记录拟议的目录更名。**尚未在磁盘上执行**——由「统筹规划」对话(2026-06-26)产出,只写文档不改目录。

| 项 | 现状 | 拟定 |
| --- | --- | --- |
| 目录 | `chat/` | **`chat-backend/`** |
| 定位 | Spring Boot 2.6 + Spring Cloud Alibaba/Nacos 的 IM 微服务后端 | 不变(GateWay/Auth/Contact/Messaging/RealTime/Offline/Moment 共 7 个服务) |
| GateWay 端口 | `GATEWAY_PORT:10010` | 保持 **10010**,作为**全系统唯一对外入口**(agent 移到 18080 置于其后) |

## 为什么

`chat-backend` 明确其"IM 后端"角色,与 `chat-frontend`(IM 前端)对应。`chat/` 自带独立 Git 仓库,更名时注意子模块/CI/Nacos 服务名路径。

## 关联

- 子项目计划:`docs/planning/30-chat-backend-plan.md`
- 既有审计:`PROJECT_AUDIT_ONBOARDING.md`(注:其鉴权/构建/密钥等 P0 多已在现源码中修复,详见审计清单的"过期项纠正")
- 总体规划:`docs/planning/00-master-plan.md`
