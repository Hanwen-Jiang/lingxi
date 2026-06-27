# 跨服务契约规格(chat-common / 统一契约)

> 中枢出的**跨栈契约单一事实来源**。**S3 在 `chat-common` 实现并导出**给 7 个 chat 服务;**S1(agent)独立实现同一线契约**(agent 是 Spring Boot 3、chat 是 2.6,无法共用同一 Maven 模块,故 agent 镜像本契约、对齐编号,不依赖 chat-common 工件)。S4/S2 前端按本契约消费。对应 master-plan D2/D3/D4/D5。
>
> 破坏性切换(真实 HTTP 状态、删 body userId)走 **expand/contract**:先并存(双读),**S1/S3 同步翻、翻前在 STATUS 通知 S2/S4**。

## 1. 身份头(网关注入,下游只信)

| 头 | 含义 | 规则 |
| --- | --- | --- |
| `X-User-Id` | 已认证主体(**string 化 snowflake**) | 网关验签后注入;**网关剥离客户端伪造值**;下游用户态路由缺失即 **401**(去掉 null 跳过) |
| `X-User-Roles` | 角色,**csv**,含 `admin` | 网关注入;model-config 等 admin 屏据此判 |
| `X-Trace-Id` | 链路 id | 网关生成/透传;各服务进 MDC、回写响应头 |
| `X-Internal-Token` | 服务间调用令牌 | 仅服务间;**且须带显式 acting-user 头**,不得回退信任 body userId |

- **客户端永不自带** `X-User-Id`/`X-User-Roles`(会被网关剥离)。
- agent **只消费**注入头,**不自验/不签发 JWT** → agent 不持 `JWT_SECRET_KEY`。

## 2. 响应包络(统一)

```json
{ "code": 0, "message": "ok", "data": { }, "traceId": "…", "timestamp": 1750000000000 }
```

- `code`:**0 = 成功**;非 0 = 业务/错误码(见 §3)。`timestamp`:epoch 毫秒。`data`:成功载荷或 `null`。
- `traceId` 同时在响应头 `X-Trace-Id`。
- **JsonInclude 策略全栈一致**(建议 NON_NULL)。

## 3. 错误码枚举 + HTTP 状态映射

**停止"全 200 + 体内 code"**:HTTP 状态反映类别,body 仍为包络。规范编号(`类别(3) + 子码(2)`):

| code | 含义 | HTTP |
| ---: | --- | ---: |
| 0 | OK | 200 |
| 40000 | BAD_REQUEST(参数/格式) | 400 |
| 40100 | UNAUTHENTICATED(无/失效身份) | 401 |
| 40300 | FORBIDDEN(越权) | 403 |
| 40400 | NOT_FOUND | 404 |
| 40900 | CONFLICT(重复/状态冲突) | 409 |
| 42200 | VALIDATION_FAILED(字段级) | 422 |
| 42900 | RATE_LIMITED | 429 |
| 50000 | INTERNAL | 500 |
| 50300 | DEPENDENCY_UNAVAILABLE(DB/Kafka/LLM 等) | 503 |

- **域子段**(在上表大类下细分,各服务自取连续区段,登记到 chat-common/本文件):`1xxxx` Auth、`2xxxx` Contact、`3xxxx` Messaging/RedPacket、`4xxxx` RealTime、`5xxxx` Offline、`6xxxx` Moment、`7xxxx` agent(chat/rag/agent/memory)。子码沿用 §3 的 HTTP 映射后两段语义。
- VALIDATION_FAILED(422)body 带 `data.fieldErrors: [{field,message}]`。

## 4. 分页约定(统一)

- **游标分页(首选,用于历史/会话/好友/feed)**:请求 `?cursor=&limit=`(`limit` 默认 20、上限 100);响应 `data`:
```json
{ "items": [ ], "nextCursor": "<opaque|null>", "hasMore": true }
```
- `nextCursor` 不透明(内部编码末条 id/时间);**禁止前导通配 LIKE 全表扫**。
- 仅在确需总数的管理列表用 offset 分页(`pageNum/pageSize` + `total`),并显式标注。

## 5. ID 编码

- **JSON 内所有 id 一律 string 化 snowflake**(userId/sessionId/messageId/...)。
- 服务在持久化边界再转内部类型(agent:String→内部;chat:用按实例 Snowflake 生成,见 D9)。

## 6. 网关路由(把 agent 纳入同一网关 + 鉴权)

| 网关路径 | 目标 | 鉴权 |
| --- | --- | --- |
| `/api/v1/**` | chat 6 服务(现状) | 验签(白名单除外) |
| `/api/v1/netty` | NettyService(WS) | 握手内 JWT 验(见 §7) |
| **`/api/agent/**`** | agent:18080 | **验签 + 注入 X-User-Id/Roles(新增,非白名单)** |
| **`/api/memory/**`** | agent:18080 | 同上 |
| **`/api/rag/**`** | agent:18080 | 同上 |

agent context-path 为 `/api`,网关转发保留前缀(`/api/agent/**`→agent `/api/agent/**`)。S1 网关身份就绪后翻 `AGENT_GATEWAY_ENFORCE_IDENTITY=true`。

## 7. JWT 与令牌

- HS256;`sub` = string snowflake userId;`roles` 声明(数组/csv);`iss`;`exp` 短(15–30 min)。
- **刷新令牌** + `POST /api/v1/user/refresh`(替代 ~500000h 长 token)。
- `JWT_SECRET_KEY` 在**网关 + 全部 chat 服务 + Auth 签发方**完全一致(由 chat-common 统一持有/读取);**agent 不持**。
- 修 `LoginResponse.userId` 恒 null:返回 `sub` 的 string id。

## 7.1 登录模型(D14:邮箱,去手机号/短信)

身份主体 = **邮箱**。**移除手机号/短信验证**(删 `loginCode` 的 SMS 路径)。支持两种登录 + 邮箱验证码注册:

| 端点 | 入参 | 说明 |
| --- | --- | --- |
| `POST /api/v1/user/sendMail` | `{email}` | 发邮箱验证码(写 Redis `verify:email:{email}`,已有) |
| `POST /api/v1/user/register` | `{email, password, code}` | 邮箱验证码注册(原 phone 改 email) |
| `POST /api/v1/user/login` | `{email, password}` | 邮箱+密码登录 |
| `POST /api/v1/user/loginCode` | `{email, code}` | 邮箱验证码**免密登录**(原 SMS 路径删除) |
| `POST /api/v1/user/refresh` | `{refreshToken}` | 刷新(§7) |

- 登录/注册成功返回 `LoginResponse{userId(string),userName,avatar,...,token,refreshToken}`(`userId` 修为 sub 的 string id)。
- 前端(S2/S4)登录 UI:邮箱+密码 与"邮箱验证码"两种方式,无手机号输入。`phone` 字段在 DTO 可保留为可空兼容,但**不作为验证/登录依据**。

## 8. WS 握手(浏览器可用)

- 默认 **`?token=&userUuid=` 查询参数**(浏览器 WebSocket 不能设自定义握手头);保留 header 给原生端;仍验 `sub == userUuid`。
- S4 的 WS 客户端适配层(ADR 0002)已按此默认 + 可切 `Sec-WebSocket-Protocol`;**S3 在 `30-plan §5` 定形 B8 后,S4 一行切换**。

## 9. SSE(agent 流式)

- 事件信封 `{type, ...}`;`type ∈ start|delta|usage|done|error`;**加 `v`(schema 版本)**。
- rag/adaptive/agent 路由实现**真增量**或显式 `buffered:true` 标注(避免假死后整段冒出)。

## 10. 落地分工

| 项 | S3(chat-common) | S1(agent 镜像) | 前端 |
| --- | --- | --- | --- |
| 包络/错误码/分页/ID | **定义并导出**(Result/ErrorCode/Page/Snowflake/JwtUtil/头常量) | 对齐编号与形状(已实现加法半) | 按 §2/§3/§4 解析 |
| 网关 agent 路由 + 统一 JWT | **实现** | 翻 enforce、消费注入头 | — |
| 真实 HTTP 状态翻转 | 与 S1 **同步版本化翻**,翻前通知 S2/S4 | 同左 | 收到通知后改 |
| WS 握手 B8 | **定形** | — | S4 一行切 |

> 编号/字段如需调整,改本文件并在 STATUS 通知 S1/S3;**两套实现以本文件为唯一对齐基准**。
