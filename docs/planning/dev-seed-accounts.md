# Dev Seed 账户(开发/E2E 用)

> 本文件记录开发与 E2E 环境用的种子账户。**S3(chat-backend)是 user 表的所有者**,具体的 SQL 与 seed 时机由 S3 决定(SchemaInitializer/Flyway/启动 seeder 任选)。S2(agent-frontend)在登录页只是消费这些账户,不直接写表。
>
> 上游契约:`00-master-plan.md` §8「种子/系统主体」、`03-contracts.md` §7「JWT/令牌」。

## 1. 账户清单

| # | userId(snowflake) | 手机号 | 密码 | 角色 | 用途 |
| --- | --- | --- | --- | --- | --- |
| 1 | `100000000000000001` | `17614797418` | `asdf1476` | `user` | **agent-frontend dev 主账号**(用户日常登录看效果) |

> userId 取自 snowflake 范围内的固定值;不通过运行时 `IdUtil.getSnowflake().nextId()` 生成,以便跨环境复现(E2E 库与本地库可以拿一样的 id)。

## 2. BCrypt hash

`chat-backend` 用 Spring 的 `BCryptPasswordEncoder`(默认 strength=10,`$2a`/`$2b` 前缀互认)。

| 手机号 | 明文 | BCrypt hash |
| --- | --- | --- |
| `17614797418` | `asdf1476` | `$2b$10$RBa8.AaiZu5gp2E7NIqO4ubM6Zhza.n8RZeBX2Ag1th2nOciRd.SW` |

校验(Java):
```java
new BCryptPasswordEncoder().matches("asdf1476",
  "$2b$10$RBa8.AaiZu5gp2E7NIqO4ubM6Zhza.n8RZeBX2Ag1th2nOciRd.SW");
// → true
```

## 3. INSERT 模板(S3 据此 seed)

### 3.1 `user` 表

```sql
INSERT INTO user (user_id, user_name, password, phone, gender, status, created_at, updated_at)
VALUES (100000000000000001,
        '灵犀dev',
        '$2b$10$RBa8.AaiZu5gp2E7NIqO4ubM6Zhza.n8RZeBX2Ag1th2nOciRd.SW',
        '17614797418',
        0,
        1,
        NOW(),
        NOW())
ON DUPLICATE KEY UPDATE user_id = user_id;
```

> `gender`/`status` 取通用默认(0=未指定 / 1=正常)。`ON DUPLICATE KEY UPDATE user_id = user_id` 让重复 seed 是幂等的(不覆盖已存在的同手机号账户的密码/昵称)。

### 3.2 `user_balance` 表(register 时同步插)

```sql
INSERT INTO user_balance (user_id, balance, created_at, updated_at)
VALUES (100000000000000001, 1000.00, NOW(), NOW())
ON DUPLICATE KEY UPDATE user_id = user_id;
```

## 4. 落地建议(S3 选其一)

1. **SchemaInitializer 末尾追加 seed**(最快,与现状一致):在 `AuthenticationService.SchemaInitializer` 建表后追加上面两段 `INSERT ... ON DUPLICATE KEY` —— `dev`/`e2e` profile 才执行,`prod` 跳过。
2. **Flyway seed migration**(更规整,等 chat 全栈引入 Flyway 一起):`db/migration/V<N>__seed_dev_accounts.sql`,`spring.flyway.placeholders` 控制是否生效。
3. **独立 dev-seeder 脚本**(不耦合应用):`chat/scripts/seed-dev-accounts.sql` + `chat/e2e/` 在 setup-infra 完后执行一次。

> 哪种由 S3 拍。中枢倾向 **3**(脚本化、显式、跨环境一致),与 `chat/e2e/01-setup-infra.sh` 同风格。

## 5. 加新账户的步骤

1. 选一个 snowflake 区间内的固定 userId(避免和真实雪花碰撞 — dev 用 `1000000000000000XX`)。
2. 用 `BCryptPasswordEncoder` 生成密码 hash(或 Python `bcrypt.hashpw(pw, bcrypt.gensalt(rounds=10))`)。
3. 追加到 §1 与 §2 的表里 + 增量 INSERT。
4. 通知 S3 / 中枢按 §4 选定方案 seed。

## 6. 跨流交接

- **S2(我侧)**:不直接 INSERT 到 user 表(那是 S3 库)。前端登录页 UI + token 管线已就绪,只要 S3 把账户 seed 进去 + agent-frontend dev proxy 能打到 chat Auth(`/api/v1/user/login`),登录就通。
- **S3**:① 按 §4 选定方式把 §3 的两段 SQL 跑到 `InfiniteChat`(prod)与 `InfiniteChat_e2e`(E2E)库;② 修 `LoginResponse.userId = null` 让返回真实 sub(已在 03-contracts.md §7 / STATUS S3 交接里登记)。
- **HUB**:仲裁 dev proxy 是否要默认指网关(S2 当前 default 是 agent `:18080`,但 `/api/v1/user/login` 在 chat Auth 后面 — 见 §7「已知缺口」)。

## 7. 已知缺口(影响 dev 登录链路)

`agent-frontend` 当前 dev proxy(`vite.config.ts`)默认指 `http://127.0.0.1:18080`(agent),但 `/api/v1/user/login` 是 **chat-backend Auth** 的端点,不在 agent 上。要在 dev 里直接登录,需要二选一:

- **A. 起 chat 网关**(prod 10010 / E2E 10110)+ 把 `VITE_API_PROXY_TARGET` 改指网关 — 由网关分发到 chat 服务和 agent。
- **B. dev 同时起 chat Auth(`:8082`)+ agent(`:18080`)**,在 `vite.config.ts` 加多个 path-prefix proxy:`/api/v1/**` → `:8082`,`/api/agent|memory|rag/**` → `:18080`。

**长期方案是 A**(契约 §6:agent 入网关后所有流量都走网关)。**B 是 S3 网关未就绪前的 dev shortcut**。

本 issue 不阻塞本文件交付;前端只在 dev proxy 解决后 seed 账户才能登。
