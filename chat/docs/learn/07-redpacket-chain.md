# 第 7 章 红包链路（钱与一致性）

> 本章主题：一句话——**红包是一条"既要在 Redis 里抢得快、又要在 MySQL 里记得准"的链路；本章讲清它如何用 Lua + 补偿 + 条件 UPDATE + 唯一键把"双写一致性"兜住。**

学完你能回答这些问题：

- 发红包时余额是怎么"原子扣减"的？为什么一句 `UPDATE ... WHERE balance >= amount` 就够了，不需要先查再改？
- 普通红包和随机红包的金额是什么时候、按什么算法拆好的？拆出来放哪？
- 多人同时抢同一个红包，凭什么保证"不超发、不重复领、每人一份"？Lua 脚本到底锁住了什么？
- Redis 抢到了钱、但 MySQL 落库失败，钱会凭空消失吗？补偿脚本怎么把钱塞回去？
- 红包没抢完就过期了，剩余金额怎么退回给发送者？两条退款路径（过期事件 + 定时扫描）会不会把同一个红包退两次？
- `@PreventDuplicateSubmit` 现在是怎么实现幂等的？（提示：不是本地锁，是 Redis 分布式占位）

---

## 一、要解决什么问题

红包链路和普通发消息链路最大的不同，是它**动了钱**。钱有两个"账本"：

| 账本 | 存什么 | 角色 |
| --- | --- | --- |
| **Redis** | 预拆好的每一份金额（list）、已领用户集合（set）、剩余份数计数（string） | "抢"的现场——要快、要原子、要扛并发 |
| **MySQL** | 红包主表 `red_packet`、领取流水 `red_packet_receive`、用户余额 `user_balance`、余额流水 `balance_log` | "记账"的账本——要准、要持久、要可审计 |

难点全在"两个账本要保持一致"。典型的坏情况：

- **超发**：100 个人同时抢一个只剩 1 份的红包，如果只用 `if (剩余 > 0) 剩余--`，并发下会有多个线程同时读到"剩余 > 0"，结果发出去比预定多。
- **重复领**：同一个人狂点"抢"，领到两份。
- **Redis 抢到了、MySQL 没记上**：用户在 Redis 里被标记"已领、份额已弹出"，但写库时数据库挂了——这份钱就卡在中间，既没进用户余额，也回不到红包池里。
- **退款退两次**：红包过期时，Redis 的过期事件和后台定时扫描可能"同时"想给发送者退剩余金额。

InfiniteChat 的解法不是上一把大锁，而是**把每一步都做成"幂等 + 条件化"**：Redis 用 Lua 保证抢的原子性，MySQL 用条件 `UPDATE`（带 `WHERE`）+ 唯一键保证记账的原子性与去重，失败时用补偿脚本回滚 Redis。下面逐段看。

---

## 二、整体时序图

```
                          发红包 sendRedPacket()  (一个 MySQL 事务)
  Client ──POST /send──> RedPacketController
                              │ 1. 校验金额/数量/类型
                              │ 2. deductBalance: UPDATE user_balance ... WHERE balance>=amount  ← 原子扣减
                              │ 3. INSERT red_packet (status=UNCLAIMED, expire_at=+24h)
                              │ 4. INSERT balance_log (type=SEND, amount=-total)
                              │ 5. 预拆金额 → Redis:
                              │       amount:{id}  = [份1, 份2, ...]   (list)
                              │       count:{id}   = totalCount         (string, TTL=24h)  ← 过期触发器
                              │       users:{id}   =  ∅                 (set)
                              │ 6. 复用发消息链 messageService.sendMessage(红包消息体)
                              └──────────► 任一步抛异常 → 事务回滚 + 清掉 Redis 三个 key


                          抢红包 receiveRedPacket()
  Client ──POST /receive─> RedPacketController
                              │ A. CLAIM Lua (原子):  sismember 防重 → rpop 取一份 → sadd 记名
                              │       返回 "-1"已领 / "0"抢空 / "金额"成功
                              │ B. 若成功，进入 MySQL 事务:
                              │       decreaseRemaining: UPDATE red_packet SET remaining-=amt,
                              │                           remaining_count-=1 WHERE ... remaining>=amt
                              │       INSERT red_packet_receive  (唯一键 红包+领取人)
                              │       increaseBalance: UPDATE user_balance SET balance+=amt
                              │       INSERT balance_log (type=RECEIVE)
                              │  ┌── 事务失败 → COMPENSATE Lua: srem 用户 + lpush 份额  ← 把钱塞回 Redis
                              └──┘


                          过期退款 (两条路，互斥)
  ① Redis count:{id} 到 TTL → __keyevent@0__:expired → RedPacketExpireListener
  ② @Scheduled 每 60s 扫 selectExpiredUnclaimed()
         都调用 handleExpireRedPacket():
              markRefunding: UPDATE ... status=REFUNDING WHERE status=UNCLAIMED  ← 影响行数=1 才是赢家
              increaseBalance(发送者, 剩余) + balance_log(type=REFUND)
              markRefunded:  status=EXPIRED
```

---

## 三、关键类与职责

| 类 / 文件 | 职责 |
| --- | --- |
| `controller/RedPacketController.java` | 三个入口：`/send`（带 `@PreventDuplicateSubmit`）、`/receive`、`GET /{id}`。用 `UserContext` 校验"不能代他人发/领"。 |
| `service/impl/RedPacketServiceImpl.java` | 发红包主流程；预拆金额（普通/随机）；过期退款（`handleExpireRedPacket` + `@Scheduled` 扫描）。 |
| `service/impl/RedPacketReceiveServiceImpl.java` | 抢红包主流程：CLAIM Lua → MySQL 事务记账 → 失败 COMPENSATE Lua。 |
| `service/impl/GetRedPacketServiceImpl.java` | 查红包详情（发送者信息 + 分页领取列表）。 |
| `mapper/RedPacketMapper.java` | 红包表的条件 UPDATE：`decreaseRemaining` / `markRefunding` / `markRefunded` / `selectExpiredUnclaimed`。 |
| `mapper/UserBalanceMapper.java` | 余额条件 UPDATE：`deductBalance`（`WHERE balance>=amount`）/ `increaseBalance`。 |
| `constants/RedPacketConstants.java` | 三段 Lua 脚本（CLAIM / COMPENSATE / 计数）、key 前缀、金额参数、过期 24h 等。 |
| `constants/RedPacketStatus.java` | 红包状态：1 未领完 / 2 已领完 / 3 已过期 / 4 退款中。 |
| `constants/BalanceLogType.java` | 余额流水类型：1 发 / 2 领 / 3 退。 |
| `util/RedPacketExpireListener.java` | 监听 Redis `__keyevent@0__:expired`，对 `count:` 前缀 key 触发过期退款。 |
| `config/RedisConfig.java` | 注册 `RedisMessageListenerContainer`，订阅 `__keyevent@0__:expired`。 |
| `config/PreventDuplicateSubmitAspect.java` | 基于 Redis `setIfAbsent` 的分布式幂等切面。 |
| `resources/sql/red_packet_consistency.sql` | 两条唯一键 + `expire_at` 列与索引——一致性的"数据库地基"。 |

---

## 四、发红包：原子扣减 + 预拆 + 复用发消息链

发红包整体包在一个 `@Transactional` 事务里（`RedPacketServiceImpl.java:94`），顺序是：**校验 → 扣余额 → 写红包 → 写余额流水 → 预拆进 Redis → 发红包消息**。

### 4.1 余额"原子扣减"——一句 SQL 顶一把锁

很多人第一反应是"先 `SELECT balance`，判断够不够，再 `UPDATE`"。在并发下这是经典的"查改竞态"：两个请求都读到余额 100，都觉得够扣，结果扣成负数。这里的写法是把"判断"和"扣减"合并进同一条 SQL，靠数据库行锁原子完成：

```sql
-- mapper/UserBalanceMapper.java:18
UPDATE user_balance SET balance = balance - #{amount}, updated_at = NOW()
WHERE user_id = #{userId} AND balance >= #{amount}
```

`WHERE balance >= #{amount}` 是关键：余额不够时这条 SQL **影响 0 行**。Service 层只看影响行数：

```java
// RedPacketServiceImpl.java:248
int updateCount = userBalanceMapper.deductBalance(userId, amount);
if (updateCount != 1) {
    throw new ServiceException("余额不足或扣减失败");  // 0 行 = 余额不足，直接回滚整个事务
}
```

"用影响行数当返回值"是本章反复出现的套路——**让数据库做条件判断，应用层只关心成功了几行**。

### 4.2 预拆金额——抢之前就把每一份算好

红包没有"抢的时候现算金额"，而是在发的时候一次性把 `totalCount` 份金额全拆好，推进 Redis list（`initializeRedPacketToRedis`，`RedPacketServiceImpl.java:136`）。这样抢的时候只需 `rpop` 弹一份，O(1) 且天然不超发。

- **普通红包（type=1）**：均分，除不尽的零头给最后一份（`splitNormalRedPacketAmounts:165`）。
- **随机红包（type=2）**：经典"二倍均值法"——每次在 `[0.01, 剩余均值×2]` 区间随机取一份，并保证剩下的人至少各有 0.01，最后一份拿走全部余款（`splitRandomRedPacketAmounts:178`）。

拆完写入三个 key，并给计数 key 设 24h TTL（这个 TTL 后面是过期退款的触发器）：

```java
// RedPacketServiceImpl.java:144
stringRedisTemplate.delete(amountKey);
stringRedisTemplate.delete(userKey);
stringRedisTemplate.opsForList().rightPushAll(amountKey, amounts);        // 份额 list
stringRedisTemplate.opsForValue().set(expireMarkerKey,                    // 计数 + TTL
        String.valueOf(redPacket.getTotalCount()), expireDuration);
stringRedisTemplate.expire(amountKey, expireDuration);
stringRedisTemplate.expire(userKey, expireDuration);
```

### 4.3 复用发消息链——红包本质是一条特殊消息

发红包不另起一套投递机制，而是把红包 ID 包成消息体，调用第 5 章讲过的 `messageService.sendMessage(...)`（`sendRedPacketMessage:310`），让红包消息走和普通消息完全一样的"持久化 + Kafka + 实时推送"链路。这就是为什么聊天框里红包能像普通消息一样实时弹出。

### 4.4 失败兜底——事务回滚之外还要清 Redis

注意发红包里有个 `redisInitialized` 标志（`RedPacketServiceImpl.java:97`）。因为 Redis 写入**不在 MySQL 事务里**，万一"预拆已写进 Redis、但后面发消息抛异常"，光靠数据库回滚清不掉 Redis 残留，所以 catch 里要手动 `clearRedPacketRedis` 把三个 key 删掉：

```java
// RedPacketServiceImpl.java:125
} catch (Exception e) {
    if (redisInitialized && redPacket != null) {
        clearRedPacketRedis(redPacket.getRedPacketId());  // Redis 不归事务管，手动清
    }
    throw e;
}
```

---

## 五、抢红包：Lua 原子抢 + MySQL 事务记账 + 补偿回滚

这是全章最精彩的部分，分三段：**A 抢（Redis）→ B 记账（MySQL）→ C 失败补偿（Redis）**。

### 5.1 A 段：CLAIM Lua——一次原子完成"防重 + 取份 + 记名"

为什么要 Lua？因为"判断这人有没有领过 → 弹一份 → 把这人记进已领集合"是**三个 Redis 命令**，如果分开发，并发下会在命令之间被插队（比如两次判断都说"没领过"）。Lua 脚本在 Redis 里**单线程原子执行**，三步要么全做要么全不做：

```lua
-- RedPacketConstants.java:23  RED_PACKET_CLAIM_LUA_SCRIPT
if redis.call('sismember', KEYS[2], ARGV[1]) == 1 then  -- 已在 users 集合 = 领过
    return '-1'
end
local amount = redis.call('rpop', KEYS[1])              -- 从份额 list 弹一份
if amount == false then                                 -- list 空 = 抢光了
    return '0'
end
redis.call('sadd', KEYS[2], ARGV[1])                    -- 把这人记进 users 集合
return amount                                            -- 返回抢到的金额字符串
```

`KEYS[1]=amount:{id}`、`KEYS[2]=users:{id}`、`ARGV[1]=userId`。三种返回值被 Java 端翻译成 `RedPacketClaimResult`（`RedPacketReceiveServiceImpl.java:139`）：

| 返回 | 含义 | 后续动作 |
| --- | --- | --- |
| `-1` | 该用户已领过 | 查库返回上次领取金额，不再记账 |
| `0` | 份额已抢光 | 返回 status=已领完 |
| 金额串 | 抢到一份 | 进入 B 段 MySQL 记账 |

注意：**到这一步钱已经"原子地"从 Redis 离开了**——超发和重复领在 Redis 层就被堵死了，根本到不了数据库。

### 5.2 B 段：MySQL 事务记账——四步都用"条件/唯一键"兜底

抢到金额后，在一个 `@Transactional` 事务里把账记准（`receiveRedPacket:92`）。四步，每步都不信任前一步：

```java
// RedPacketReceiveServiceImpl.java:117
updateRedPacketInfo(redPacketId, receivedAmount);  // 1. 扣红包剩余（条件 UPDATE）
logRedPacketReceive(redPacketId, userId, receivedAmount);  // 2. 写领取流水（唯一键去重）
adjustUserBalance(userId, receivedAmount);         // 3. 加用户余额
logBalanceChange(userId, receivedAmount, redPacketId);  // 4. 写余额流水（唯一键去重）
```

第 1 步的条件 UPDATE 同样用"影响行数"判定，并且在"领到最后一份"时顺手把状态改成"已领完"：

```sql
-- mapper/RedPacketMapper.java:21  decreaseRemaining
UPDATE red_packet
SET remaining_amount = remaining_amount - #{amount},
    remaining_count  = remaining_count  - 1,
    status = CASE WHEN remaining_count - 1 = 0 THEN #{claimedStatus} ELSE status END
WHERE red_packet_id = #{redPacketId}
  AND status = #{unclaimedStatus}
  AND remaining_count  > 0
  AND remaining_amount >= #{amount}     -- 条件全满足才扣，否则 0 行
```

第 2、4 步靠**数据库唯一键**做最后一道幂等防线（即便 Redis 防重万一漏了，DB 也插不进重复记录）：

```sql
-- resources/sql/red_packet_consistency.sql
ALTER TABLE red_packet_receive
  ADD UNIQUE KEY uk_red_packet_receiver (red_packet_id, receiver_id);   -- 一人一红包只能一条领取记录
ALTER TABLE balance_log
  ADD UNIQUE KEY uk_balance_related_type_user (related_id, type, user_id); -- 同一红包+类型+人只能一条流水
```

### 5.3 C 段：COMPENSATE Lua——MySQL 失败就把钱塞回 Redis

最棘手的场景：A 段 Redis 已经把份额弹出、把人记进集合，但 B 段 MySQL 事务抛异常回滚了。此时数据库一切如初，但 **Redis 里这份钱"不见了"**——既不在 list 里、用户又被标记成"领过"。如果不管，这份钱永久卡死，红包也永远抢不完（还会误触发过期退款少退）。

解决办法是 catch 里执行补偿 Lua，把 A 段的两个副作用**反向撤销**：从 users 集合移除该用户（让他能再抢）、把金额 `lpush` 回份额 list：

```java
// RedPacketReceiveServiceImpl.java:133
} catch (Exception e) {
    compensateRedisClaim(redPacketId, userId, receivedAmount);  // 撤销 A 段
    throw e;
}
```

```lua
-- RedPacketConstants.java:33  RED_PACKET_COMPENSATE_LUA_SCRIPT
if redis.call('sismember', KEYS[2], ARGV[1]) == 1 then  -- 确认这人确实被记过名
    redis.call('srem', KEYS[2], ARGV[1])                -- 移出已领集合
    redis.call('lpush', KEYS[1], ARGV[2])               -- 金额塞回份额 list
    return '1'
end
return '0'
```

这就是"**Redis + MySQL 双写一致性**"的核心闭环：**Redis 抢成功不代表交易成功，只有 MySQL 落库成功才算数；落库失败就用补偿脚本让 Redis 回到"没抢过"的状态。** 整体是一个"尽力而为 + 失败补偿"的最终一致性模型，而不是分布式事务（2PC）那种重量级方案。

### 5.4 已领用户的二次查询

如果 Lua 返回 `-1`（已领过），代码会再查一次 `red_packet_receive` 把上次领的金额返回给前端（`verifyUserHasNotReceived:208`），保证用户重复点"抢"时看到的是一致的金额，而不是报错。

---

## 六、查红包详情

`GET /api/v1/chat/redPacket/{redPacketId}` 走 `GetRedPacketServiceImpl.getRedPacketDetails`（`GetRedPacketServiceImpl.java:34`）：读红包主表 + 分页查 `red_packet_receive` 领取列表 + 拼上发送者昵称头像，组成 `RedPacketResponse`（含 `totalAmount/remainingAmount/remainingCount/status` 等）。这是纯读路径，不涉及一致性，略。

---

## 七、过期退款：两条路 + "影响行数当锁"防双退

红包 24h 没抢完，剩余金额要退回发送者。系统有**两条触发路径**，互为兜底：

| 路径 | 触发方式 | 代码 |
| --- | --- | --- |
| ① Redis 过期事件 | `count:{id}` 到 TTL → Redis 发 `__keyevent@0__:expired` → 监听器收到 | `RedPacketExpireListener.java:21` |
| ② 定时扫描兜底 | `@Scheduled` 每 60s 扫 `expire_at <= now AND status=UNCLAIMED` | `RedPacketServiceImpl.java:339` |

为什么要两条？因为 Redis 的 keyspace 过期通知**不保证可靠**（重启、配置未开、网络抖动都可能漏事件），所以必须有数据库层面的定时扫描兜底。`scanExpiredRedPackets` 用 `selectExpiredUnclaimed`（`RedPacketMapper.java:49`）按 `idx_status_expire_at` 索引批量捞过期红包。

但两条路同时存在就带来新问题：**会不会把同一个红包退两次款？** 答案是不会，关键在 `markRefunding` 这条 UPDATE 充当了"乐观锁/抢占锁"：

```java
// RedPacketServiceImpl.java:355  refundExpiredRedPacket（包在 transactionTemplate 事务里）
int locked = baseMapper.markRefunding(redPacketId, now, UNCLAIMED, REFUNDING);
if (locked != 1) {
    return false;   // 影响 0 行 = 别人已抢先处理，本次直接放弃
}
// ... 只有抢到锁(locked==1)的线程才退款 ...
refundRemainingAmount(redPacket);                  // increaseBalance(发送者, 剩余) + balance_log(REFUND)
baseMapper.markRefunded(redPacketId, REFUNDING, EXPIRED);  // 状态推进到已过期
```

```sql
-- mapper/RedPacketMapper.java:33  markRefunding
UPDATE red_packet SET status = #{refundingStatus}
WHERE red_packet_id = #{redPacketId}
  AND status = #{unclaimedStatus}   -- 只有"未领完"才能被抢占
  AND expire_at <= #{now}
  AND remaining_amount > 0
```

状态机是 `UNCLAIMED(1) → REFUNDING(4) → EXPIRED(3)`。无论是过期事件还是定时扫描、无论多少个线程同时进来，`status=UNCLAIMED → REFUNDING` 这步**只有一个线程能让影响行数=1**，其余全部 0 行而提前返回。这就是"**用条件 UPDATE 的影响行数当分布式单赢者锁**"——不需要额外的锁服务，数据库自己就是仲裁者。

退款成功后还会 `clearRedPacketRedis` 清掉 Redis 残留（`handleExpireRedPacket:332`）。注意退款用 `increaseBalance` 是无条件加钱（余额加钱不需要 `WHERE balance>=`），但发送者退款流水靠 `balance_log` 的唯一键 `(related_id, type, user_id)` 兜住"同一红包的退款流水只会有一条"。

---

## 八、`@PreventDuplicateSubmit`——现在是 Redis 分布式幂等

`/send` 接口标了 `@PreventDuplicateSubmit`（`RedPacketController.java:36`）。它**不是本地内存锁**，而是基于 Redis `setIfAbsent` 的分布式占位，多实例部署下也有效：

```java
// config/PreventDuplicateSubmitAspect.java:33
String key = KEY_PREFIX + joinPoint.getSignature().toShortString() + Arrays.toString(joinPoint.getArgs());
// setIfAbsent 原子占位：返回 false 表示 key 已存在 = 重复提交
Boolean acquired = stringRedisTemplate.opsForValue()
        .setIfAbsent(key, "1", preventDuplicateSubmit.timeout(), TimeUnit.MILLISECONDS);
if (acquired == null || !acquired) {
    throw new ServiceException("请勿重复提交请求");
}
```

key 由"方法签名 + 全部入参"拼成，默认 5 秒 TTL（`PreventDuplicateSubmit.java:15`）。同样参数的请求在 5 秒内只放行第一个，挡住用户狂点导致的重复发红包。

---

## 九、数据落点速查

### MySQL 表

| 表 | 关键列 | 一致性手段 |
| --- | --- | --- |
| `user_balance` | `user_id`, `balance` | 扣减 `WHERE balance>=amount`；加款无条件 |
| `red_packet` | `red_packet_id`, `remaining_amount`, `remaining_count`, `status`, `expire_at` | 条件 UPDATE + `status` 状态机 + `idx_status_expire_at` |
| `red_packet_receive` | `red_packet_id`, `receiver_id`, `amount` | 唯一键 `uk_red_packet_receiver` |
| `balance_log` | `related_id`, `type`, `user_id`, `amount` | 唯一键 `uk_balance_related_type_user` |

### Redis key（前缀见 `RedPacketConstants.java:9`）

| key | 类型 | 含义 | TTL |
| --- | --- | --- | --- |
| `red_packet:amount:{id}` | list | 预拆的每一份金额 | 24h |
| `red_packet:users:{id}` | set | 已领取用户集合（防重复） | 24h |
| `red_packet:count:{id}` | string | 剩余份数计数（其 TTL 过期即触发退款） | 24h |
| `prevent-duplicate-submit:...` | string | 防重复提交占位 | 5s |

### 其他

- Kafka topic：红包消息复用普通消息链，最终走 `thousands_word_message`（见第 5 章）。
- Redis 过期事件 channel：`__keyevent@0__:expired`（需 Redis 开启 `notify-keyspace-events Ex`）。

---

## 十、失败与边界处理小结

| 场景 | 系统行为 |
| --- | --- |
| 余额不足 | `deductBalance` 影响 0 行 → 抛异常 → 整个发红包事务回滚 |
| 金额/数量/类型非法 | `validateSendRedPacketRequest:261` 校验，单份 < 0.01 或 > 200、类型非 1/2 直接拒 |
| 发红包中途失败 | 事务回滚 + catch 里手动清 Redis 三个 key |
| 重复点"抢" | CLAIM Lua `sismember` 返回 `-1`，查库返回原金额，不重复记账 |
| 红包抢光 | CLAIM Lua `rpop` 得 false 返回 `0`，提示已领完 |
| Redis 抢成功但 MySQL 失败 | COMPENSATE Lua 把金额 `lpush` 回 list、把用户 `srem` 出集合 |
| 连补偿都失败 | 抛 `"MySQL落库失败，Redis抢红包补偿也失败"`，需人工/日志介入（`RedPacketReceiveServiceImpl.java:171`） |
| 过期退款并发 | `markRefunding` 影响行数=1 才是赢家，其余放弃，杜绝双退 |
| Redis 过期事件丢失 | `@Scheduled` 60s 扫描兜底 |
| 代他人发/领 | Controller 用 `UserContext` 比对，不一致返回 403 |

---

## 十一、动手实践

> 前置：拿到一个有余额的用户的 JWT（参考第 2 章鉴权）。下面假设网关在 `localhost:10010`，发送者 userId=1001，会话 sessionId=2001。所有请求带 `Authorization: Bearer <JWT>`，网关验签后会把可信 `X-User-Id` 注入下游。

### 1. 发一个随机红包（5 份、共 10 元）

```bash
curl -X POST http://localhost:10010/api/v1/chat/redPacket/send \
  -H "Authorization: Bearer <JWT>" \
  -H "Content-Type: application/json" \
  -d '{
        "sessionId": 2001,
        "sendUserId": 1001,
        "sessionType": 1,
        "type": 1,
        "body": {
          "redPacketType": 2,
          "totalAmount": 10.00,
          "totalCount": 5,
          "redPacketWrapperText": "测试红包"
        }
      }'
```

返回里的 `data` 来自发消息链（含消息 id 等）。红包 ID 被写进了红包消息体的 `content`。

**验证落点：**

```bash
# Redis：看预拆的 5 份金额、计数、TTL（把 {id} 换成真实红包ID）
redis-cli LRANGE red_packet:amount:{id} 0 -1     # 应有 5 个金额，加总=10.00
redis-cli GET   red_packet:count:{id}            # = 5
redis-cli TTL   red_packet:count:{id}            # ≈ 86400 秒

# MySQL：红包主表 + 发送方扣款流水
SELECT status, total_amount, remaining_amount, remaining_count, expire_at FROM red_packet WHERE red_packet_id={id};
SELECT amount, type FROM balance_log WHERE related_id={id};   -- amount=-10.00, type=1
SELECT balance FROM user_balance WHERE user_id=1001;          -- 已扣 10 元
```

### 2. 抢红包

```bash
curl -X POST http://localhost:10010/api/v1/chat/redPacket/receive \
  -H "Authorization: Bearer <JWT-of-1002>" \
  -H "Content-Type: application/json" \
  -d '{ "userId": 1002, "redPacketId": {id} }'
```

返回 `receivedAmount` 是抢到的金额，`status=0` 表示成功。

**验证落点：**

```bash
redis-cli LLEN  red_packet:amount:{id}           # 份额少 1
redis-cli SMEMBERS red_packet:users:{id}         # 出现 1002
redis-cli GET   red_packet:count:{id}            # 计数 -1

SELECT remaining_amount, remaining_count, status FROM red_packet WHERE red_packet_id={id};
SELECT * FROM red_packet_receive WHERE red_packet_id={id} AND receiver_id=1002;  -- 一条领取记录
SELECT amount, type FROM balance_log WHERE related_id={id} AND user_id=1002;     -- type=2
```

### 3. 验证幂等与防重

- **重复抢**：再次用 1002 调 `/receive`，返回的 `receivedAmount` 与首次一致，且 `red_packet_receive` 仍只有一条（CLAIM Lua + 唯一键双保险）。
- **重复发**：5 秒内用完全相同的 body 连发两次 `/send`，第二次返回"请勿重复提交请求"（`prevent-duplicate-submit:` key 占位生效）。

### 4. 验证过期退款（最直观的做法）

把某个红包的 `count:{id}` key 手动设短 TTL，触发过期事件：

```bash
redis-cli SET red_packet:count:{id} 3 EX 5       # 5 秒后过期
# 等几秒，看服务日志出现 "得到过期红包ID:{id}"
SELECT status, remaining_amount FROM red_packet WHERE red_packet_id={id};   -- status=3(EXPIRED), remaining=0
SELECT amount, type FROM balance_log WHERE related_id={id} AND type=3;      -- 退款流水, amount=剩余
SELECT balance FROM user_balance WHERE user_id=1001;                        -- 发送者余额涨回剩余金额
```

> 若 Redis 没开过期通知，事件路径不会触发，但 60s 内 `@Scheduled` 扫描会兜底退款——可以把红包的 `expire_at` 直接改成过去时间来观察扫描路径。开启通知需在 redis.conf 设 `notify-keyspace-events Ex`。

---

## 十二、小结

- **双账本**：Redis 管"抢得快"，MySQL 管"记得准"。红包链路的全部复杂度都来自"让这两个账本一致"。
- **三件武器**：① Lua 脚本保证 Redis 多命令原子（抢/补偿）；② 条件 `UPDATE ... WHERE` 用影响行数当"判断 + 锁"（扣余额、扣剩余、抢占退款）；③ 唯一键 + 状态机做幂等的最后防线。
- **失败模型是"补偿型最终一致"**，不是分布式事务：Redis 抢成功≠交易成功，MySQL 落库才算数，落库失败用补偿 Lua 回滚 Redis。
- **过期退款双路径 + 单赢者锁**：过期事件 + 定时扫描互为兜底，`markRefunding` 影响行数=1 杜绝双退。
- **幂等入口**：`@PreventDuplicateSubmit` 现为 Redis `setIfAbsent` 分布式占位，挡住重复发红包。

**下一步读哪篇**：红包消息是怎么"实时弹"到对方聊天框的？回到《第 5 章 发消息链路》看 `messageService.sendMessage` 的持久化 + Kafka + 推送；想了解推送的 WebSocket 落地与在线状态，看《第 6 章 实时通信与在线状态》。
