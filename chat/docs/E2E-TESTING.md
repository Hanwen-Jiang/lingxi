# InfiniteChat 端到端(E2E)测试环境

> 状态：**初稿，待你审核**。本文档描述一套与你 WSL 现有运行栈**完全隔离**的 E2E 测试环境，用来真正跑通并验证本轮的鉴权/正确性修复。配套脚本在 `chat/e2e/`。
> 你审核后的意见，我会直接改进本文档与脚本。

---

## 1. 背景：你现在的运行方式(我探测到的)

你的中间件与服务都在 WSL(Debian, `hanwen@asdf1476`)里，**原生进程**(非 Docker)运行,由 `~/projecta-runtime` 下的脚本管理：

| 组件 | 位置 | 说明 |
|---|---|---|
| OpenJDK 21 / Maven 3.9.9 | WSL | 构建工具链 |
| Redis 8 | `127.0.0.1:6379` (systemd) | |
| MariaDB 11 | `127.0.0.1:3307` (systemd) | 库 `InfiniteChat`(3306 被宿主占用) |
| Nacos 2.5.1 | `127.0.0.1:8848` | `start-nacos.sh` |
| Kafka 3.9.1 KRaft | `127.0.0.1:9092` | `start-kafka.sh` |
| 7 个 chat 服务 | 默认端口 8080-8086/9000/10010 | `start-apps.sh`，源码 `~/projecta-current/chat`，env 来自 `~/projecta-runtime/chat.env` |

**关键**：线上跑的是 `~/projecta-current/chat` 的旧 jar；本轮修复在 `/mnt/e/jhw/proj/chat`(Windows 挂载)。所以 E2E 必须**从修复后的源码构建**，并与线上栈隔离。

---

## 2. 隔离设计(E2E 不碰线上任何东西)

| 维度 | 线上 prod | E2E | 隔离手段 |
|---|---|---|---|
| 数据库 | `InfiniteChat` @3307 | `InfiniteChat_e2e` @3307 | 同实例不同库 |
| Redis | db 0 | db **5** | 不同 DB 索引 |
| Nacos | 默认命名空间 | 命名空间 **`e2e`** | 独立 namespace |
| Kafka | broker `:9092` | 独立 broker `:9192` | 独立进程+数据目录 |
| 服务端口 | 8080-8086/9000/10010 | **+100**：8180-8186/9100/**10110** | 端口段错开 |
| 源码/jar | `projecta-current/chat` | `projecta-e2e/chat`(含修复) | 独立构建副本 |
| 凭证 | `chat.env` | `chat.env` + `e2e.env`(只覆盖隔离项) | 复用真实密钥,叠加覆盖 |

**为什么用 Nacos「命名空间」而不是「分组(group)」隔离？**
RTC 的 `NettyServer.start()` 用 `nacosServiceManager.getNamingService().registerInstance(name, ip, port)`(3 参重载)注册 `NettyService` —— 这个重载固定走 `DEFAULT_GROUP`，所以**用 group 隔离对 NettyService 无效**，会让线上网关的一致性哈希环混入 E2E 的 Netty 节点，污染线上 WS 路由。而 `NamingService` 本身是按 `spring.cloud.nacos.discovery.namespace` 构建的，**命名空间能隔离包括 NettyService 在内的所有注册**。因此 E2E 用独立命名空间 `e2e`。

---

## 3. 前置条件

- 以 `hanwen` 身份在 WSL 内执行(脚本默认 `~/projecta-runtime`、`~/projecta-e2e`、`/mnt/e/jhw/proj/chat`)。
- 线上中间件已在跑：Redis、MariaDB(3307)、Nacos(8848)。可 `~/projecta-runtime/check-runtime.sh` 确认。
- 首次构建需联网(华为/alimaven 源)拉 `spring-security-crypto:5.6.8` 等依赖。
- `~/projecta-runtime/chat.env` 存在(提供 DB/Redis/COS/Resend 真实值)。

---

## 4. 操作步骤

```bash
cd /mnt/e/jhw/proj/chat/e2e

# 0) 规范脚本换行(从 Windows 写出的脚本可能带 CRLF)并赋可执行
sed -i 's/\r$//' *.sh
chmod +x *.sh

# 1) 准备隔离配置(改成你自己的强随机密钥)
cp e2e.env.example e2e.env
$EDITOR e2e.env          # 至少改 JWT_SECRET_KEY、INTERNAL_SERVICE_TOKEN
sed -i 's/\r$//' e2e.env # 若用 Windows 编辑器改过，去掉 CRLF(否则 source 会出错)

# 2) 准备隔离基础设施：建 InfiniteChat_e2e + 导 schema、建 Nacos 命名空间 e2e、起 E2E Kafka(9192)
./01-setup-infra.sh

# 3) 从修复后的源码构建 E2E jar(同步到 ~/projecta-e2e/chat 再 mvn package)
./02-build.sh

# 4) 拉起 7 个 E2E 服务(端口 +100)
./03-start-apps.sh
#   等 30-60s 让服务注册到 Nacos 命名空间 e2e；可 tail ~/projecta-e2e/logs/*.log 观察

# 5) 跑冒烟测试
./04-smoke-test.sh

# 6) 用完停掉(只停 E2E，不影响线上)
./99-stop.sh
```

---

## 5. 冒烟测试断言 ↔ 修复 对照

`04-smoke-test.sh` 每条断言对应一项本轮修复：

| 用例 | 断言 | 验证的修复 |
|---|---|---|
| T1 | 网关挡未带令牌请求 → 401 | A1 网关统一鉴权 |
| T2 | 网关挡无效令牌 → 401 | A1 验签 |
| T3 | 直连 Auth `/actuator/health` → 200 | 本次新增的 actuator 排除(健康检查不被拦) |
| T4 | 直连业务服务无凭证 → 401 | A3 服务信任化(被直连也挡) |
| T5 | 直连 RTC 推送接口无内部令牌 → 401 | A9 内部令牌 |
| T6 | 带 `X-Internal-Token` → 非 401 | A9 内部令牌放行 |
| T7 | 注册成功 | A5 BCrypt 注册路径 |
| T8 | 登录拿到 token | 登录+JWT 签发 |
| T9 | 带 token 访问受保护接口 → 非 401 | 网关注入 `X-User-Id` + 服务信任 |
| T10 | 以他人 userId 发动态(token 是自己) → 403 | A4 操作人收敛(Moment 越权防护) |
| T11 | 带正确 token + 伪造 `X-User-Id:999999` → 仍按 token 用户处理 | A2/A1 网关剥离并覆盖伪造头 |

> 注：T6 的 body 用 `{}`，会因 `@Valid` 失败返回 400 —— 这正好证明「过了鉴权、进入业务」，断言只判 `!=401`。

---

## 6. 深度场景(手动，可选)：发消息 → 离线落库

冒烟脚本之外，建议手动跑一遍核心链路确认端到端：

1. 注册两个用户 A、B(参考 T7：先 `redis-cli -n 5 set register:code:<phone> 123456 EX 300` 再注册)，各自登录拿 token。
2. A 加 B 好友并由 B 通过(`/api/v1/contact/...`)，使二人成为好友、生成单聊会话。
3. A 发消息：`POST $GW/api/v1/chat/session`，body `sendUserId=A`、`receiveUserId=B`、`sessionType=1`、`type=1`、`body.content=...`。
4. 验证落点：
   - `message_outbox` 出现一行(status 最终 2=SENT)：
     `mariadb -h127.0.0.1 -P3307 -uUSER -pPASS InfiniteChat_e2e -e "select message_id,status from message_outbox order by created_at desc limit 5;"`
   - 离线服务消费后 `message` 表有该消息(幂等：重复投递不会多插)。
   - 通过网关拉离线：`GET $GW/api/v1/offline/message?userId=B&time=<较早时间>` 能看到该消息。
   - E2E Kafka 主题：`~/.local/opt/kafka/bin/kafka-console-consumer.sh --bootstrap-server 127.0.0.1:9192 --topic thousands_word_message --from-beginning --max-messages 1`。

---

## 7. 注意事项与已知边界

- **红包过期退款(keyspace 路径)**：过期监听器硬编码 `__keyevent@0__`(db0)，E2E 用 db5 时该路径不触发；但 `@Scheduled` 兜底扫描(查 DB)仍会退款，可验证兜底退款。若要专测 keyspace 路径，把 `REDIS_DATABASE` 设为 0（会与线上共享 Redis 键，红包键按 snowflake id 基本不冲突，但 `user:session:{userId}` 在两个环境登录同一 userId 时可能互相覆盖，谨慎）。
- **Nacos 鉴权**：默认 standalone 通常未开鉴权，`01-setup-infra.sh` 直接建命名空间即可；若你的 Nacos 开了鉴权，请到控制台手动新建命名空间 id=`e2e`。
- **密钥**：`e2e.env` 里务必把 `JWT_SECRET_KEY`、`INTERNAL_SERVICE_TOKEN` 改成你自己的强随机值；DB/COS/Resend 等真实密钥仍从 `chat.env` 复用，不在 E2E 文件里重复。`chat/e2e/e2e.env` 已加入 `.gitignore`。
- **资源**：E2E 会额外多跑 7 个 JVM + 1 个 Kafka，确保 WSL 内存足够(每服务约 512MB 上限)；不用时 `./99-stop.sh`。
- **换行**：脚本从 Windows 仓库写出，先 `sed -i 's/\r$//' *.sh` 再运行。
- **Auth 的 Redisson**：仅地址隔离到 6379，db 仍默认 0（代码中 Redisson 实际未被业务使用，无影响）。

---

## 8. 故障排查

| 现象 | 排查 |
|---|---|
| 服务起不来 | `tail -n 200 ~/projecta-e2e/logs/<服务>.log`；多为端口占用或 env 未生效 |
| 全部 401 | `e2e.env` 的 `JWT_SECRET_KEY` 必须三方一致(网关/Auth/RTC 同一进程组已统一)；确认请求经网关 10110 |
| 服务互相调用失败 | 确认都注册到了命名空间 `e2e`(Nacos 控制台切到 e2e 命名空间看实例)；RTC 的 `NettyService` 也应在该命名空间 |
| 注册总失败 | 检查 `redis-cli -n 5` 是否成功写入验证码;`REDIS_PASSWORD` 是否正确 |
| Kafka 连不上 | `~/projecta-e2e/logs/kafka-e2e.log`;确认 9192 在监听 |

---

## 9. 审核清单(请你确认/批注)

- [ ] 隔离维度是否够(尤其 Nacos 命名空间 + 独立 Kafka 是否符合你预期)？
- [ ] 端口段 `+100`(10110/8180-8186/9100) 有无与你机器上其他服务冲突？
- [ ] E2E 是否要与线上**同时运行**(本设计支持)，还是只在停线上时跑(那样可简化为复用 9092/默认命名空间)？
- [ ] 是否需要把「发消息→离线」深度场景也脚本化进 `04`(目前是手动步骤)？
- [ ] 是否需要我把 `e2e` 目录的脚本改成可被 `~/projecta-runtime` 风格统一管理(例如生成 `start-e2e.sh` 软链)？

> 你在此打勾/批注后，我据此修订脚本与本文档。
