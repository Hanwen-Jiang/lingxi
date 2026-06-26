# 第 2 章 鉴权与网关链路

> 本章主题:**一条请求从"注册存库"到"被某个微服务可信地认作某用户"的全链路**——身份是怎么签出来的、网关怎么统一验签、下游服务凭什么相信"你是谁"。

学完你能回答这些问题:

- 用户密码在库里到底长什么样?为什么不是 MD5?
- 登录返回的 `token` 是什么?有效期多久?里面装了谁?
- 客户端调业务接口时,头要怎么带?网关对它做了什么?
- 业务服务为什么只信 `X-User-Id` 一个头?客户端自己塞一个 `X-User-Id` 能不能冒充别人?
- 服务之间互相调用(没有用户登录态)怎么过鉴权?`X-Internal-Token` 是干嘛的?
- 如果有人绕过网关、直连 `MessagingService:8081`,还能伪造身份吗?
- Netty WebSocket 的"粘连节点"为什么要拿验签后的 JWT subject 当哈希 key?

---

## 1. 为什么要把鉴权收敛到网关

InfiniteChat 是一套微服务后端,有 7 个业务服务(端口见下)。一个最朴素的做法是:**每个服务各自验 JWT**。但这会带来三个长期问题:

1. **重复且容易跑偏**:7 份验签代码,密钥配置、过期判断、Bearer 前缀解析各写一遍,迟早不一致。
2. **下游拿不到"干净"的身份**:每个服务都要重新解析 token,业务代码里到处是 `parseToken(...)`。
3. **难加白名单**:注册/登录这种"还没有 token"的接口,每个服务都要单独开口子。

InfiniteChat 的选择是:**鉴权只在网关做一次**。网关验签通过后,把"经过验证的用户ID"作为一个**可信请求头 `X-User-Id`** 注入到转发给下游的请求里;下游服务**不再碰 JWT**,只读这个头。这就是本章的核心链路。

> 一句话:**JWT 是"对外"的身份凭证,只在网关边界验一次;`X-User-Id` 是"对内"的身份事实,在内网里传递。**

涉及的服务与端口(事实基线):

| 服务 | HTTP 端口 | 备注 |
| --- | --- | --- |
| GateWay | 10010 | 统一入口,全局验签 |
| AuthenticationService | 8082 | 注册/登录/签发 JWT |
| ContactService | 8080 | 联系人 |
| MessagingService | 8081 | 消息 |
| RealTimeCommunicationService | 8083 (Netty WS 9000) | 实时通信 |
| OfflineDataStoreService | 8085 | 离线存储 |
| MomentService | 8086 | 朋友圈 |

网关路由(`GateWay/src/main/resources/application.yml:32-89`):

| 路径前缀 | 目标服务 |
| --- | --- |
| `/api/v1/user/**` | AuthenticationService |
| `/api/v1/contact/**` | ContactService |
| `/api/v1/chat/**` | MessagingService |
| `/api/v1/message/**` | RealTimeCommunicationService |
| `/api/v1/offline/**` | OfflineDataStoreService |
| `/api/v1/moment/**` | MomentService |
| `/api/v1/netty` | `lb:ws://NettyService`(WebSocket 握手) |

---

## 2. 全链路时序图

```
注册阶段(一次性):
  Client ──POST /api/v1/user/register {phone,password,code}──▶ GateWay
                                                                 │ register 在白名单 → 直接放行
                                                                 ▼
                                                          AuthenticationService
                                                                 │ BCrypt(password) 存库
                                                                 ▼
                                                              user 表

登录阶段:
  Client ──POST /api/v1/user/login {phone,password}──▶ GateWay ──(白名单放行)──▶ AuthenticationService
                                                                                    │ 1. 按 phone 查库
                                                                                    │ 2. BCrypt.matches 校验
                                                                                    │ 3. JwtUtil.generate(userId)
                                                                                    ▼
  Client ◀──────────────── Result{ data:{ userId, token, ... } } ────────────────┘
            (拿到 token,本地存起来)

调用业务接口阶段(以"改头像"为例):
  Client ─PATCH /api/v1/user/avatar
          Authorization: Bearer <token>
          X-User-Id: 999  ← 客户端就算自己塞了也没用
                 │
                 ▼
            ┌─────────────────────── GateWay: AuthGlobalFilter ───────────────────────┐
            │ 1. 路径不在白名单                                                          │
            │ 2. resolveToken(Authorization) → GatewayJwtUtil.parseSubject() 验签       │
            │ 3. 验签失败 → 401 直接返回                                                 │
            │ 4. 验签成功 → h.remove("X-User-Id"); h.set("X-User-Id", <验签出的subject>) │
            └───────────────────────────────────────┬─────────────────────────────────┘
                                                     │ 转发(此时 X-User-Id 已是可信值)
                                                     ▼
            ┌──────────── 下游服务: AuthContextInterceptor.preHandle ─────────────┐
            │ 命中 X-Internal-Token? → 直接放行(服务间调用)                       │
            │ 否则 X-User-Id 存在? → UserContext.set(uid),放行                    │
            │ 否则 → 401                                                          │
            └────────────────────────────────┬──────────────────────────────────┘
                                             ▼
                                    Controller: UserContext.get() 拿到本人 userId
```

---

## 3. 关键类/方法一览

| 类(相对路径) | 职责 |
| --- | --- |
| `AuthenticationService/.../service/impl/UserServiceImpl.java` | 注册时 BCrypt 加密存库;登录时校验密码 + 调 `JwtUtil.generate` 签发 token |
| `AuthenticationService/.../utils/JwtUtil.java` | 生成/解析 JWT;`generate(userId)` 把 userId 放进 subject |
| `AuthenticationService/.../constants/config/TimeOutEnum.java` | `JWT_TIME_OUT=168`(小时)→ 有效期 7 天 |
| `AuthenticationService/.../controller/UserController.java` | 用户路由;`updateAvatar` 从 `UserContext` 取操作人 |
| `AuthenticationService/.../conf/AuthContextInterceptor.java` | 服务内鉴权拦截器:信任 `X-User-Id` 或 `X-Internal-Token` |
| `AuthenticationService/.../conf/Interceptors.java` | 注册拦截器,排除注册/登录等白名单路径 |
| `AuthenticationService/.../conf/UserContext.java` | `ThreadLocal<Long>`,在本次请求内持有可信 userId |
| `GateWay/.../filter/AuthGlobalFilter.java` | **全局验签入口**:白名单放行、验签、注入/剥离 `X-User-Id` |
| `GateWay/.../gatewaylb/GatewayJwtUtil.java` | 网关侧只读的 JWT 验签工具,`parseSubject(token)` |
| `GateWay/.../gatewaylb/NettyConsistentHashLoadBalancer.java` | Netty WS 一致性哈希路由,优先用验签后的 subject 当 key |
| `GateWay/.../gatewaylb/ConsistentHashRing.java` | 一致性哈希环(160 虚拟节点) |

---

## 4. 关键代码片段

### 4.1 注册:BCrypt 加密存库(不是 MD5)

`AuthenticationService/.../service/impl/UserServiceImpl.java:45,72-74`

```java
private static final BCryptPasswordEncoder PASSWORD_ENCODER = new BCryptPasswordEncoder();
// ...
String encryptedPassword = PASSWORD_ENCODER.encode(password);   // BCrypt
User user = new User().setUserId(snowflake.nextId())
        .setPassword(encryptedPassword)
        .setPhone(phone)
        .setUserName(NickNameGeneratorUtil.generateNickName());
```

要点:
- **BCrypt 自带随机盐**,每次 `encode` 同一个明文,结果都不同(以 `$2a$` 开头),所以库里看到的密文彼此不一样是正常的。这从根上防住了"彩虹表/同密码可比对"这类 MD5 的老问题。
- `userId` 用雪花算法(Snowflake)生成,是一个 64 位长整型——后面整条链路传的 `X-User-Id`、JWT subject 都是它。

### 4.2 登录:校验密码 + 签发 JWT

`AuthenticationService/.../service/impl/UserServiceImpl.java:110-118`

```java
User user = this.getOnly(queryWrapper, true);
if (user == null || !PASSWORD_ENCODER.matches(request.getPassword(), user.getPassword())) {
    throw new UserException(ErrorEnum.LOGIN_ERROR);   // 用户不存在/密码错,统一报"登录失败"
}
LoginResponse response = new LoginResponse();
BeanUtils.copyProperties(user, response);
String token = JwtUtil.generate(String.valueOf(user.getUserId()));   // subject = userId
response.setToken(token);
```

要点:
- 校验用 `PASSWORD_ENCODER.matches(明文, 库里密文)`,**绝不解密**——BCrypt 不可逆,只能"再算一遍看是否匹配"。
- "用户不存在"和"密码错误"都抛同一个 `LOGIN_ERROR`,避免暴露"这个手机号是否注册过"。
- 签发时 **subject 就是 userId**,这一步决定了后面网关验签后能直接拿 subject 当用户身份。

### 4.3 JWT 生成与有效期

`AuthenticationService/.../utils/JwtUtil.java:27,29-38`

```java
private final static Duration expiration = Duration.ofHours(TimeOutEnum.JWT_TIME_OUT.getTimeOut()); // 168h = 7天

public static String generate(String userID) {
    Date expiryDate = new Date(System.currentTimeMillis() + expiration.toMillis());
    return Jwts.builder()
            .setSubject(userID)
            .setIssuedAt(new Date())
            .setExpiration(expiryDate)
            .signWith(SignatureAlgorithm.HS512, signingKey())   // HS512 对称签名
            .compact();
}
```

要点:
- **有效期 7 天**(`TimeOutEnum.JWT_TIME_OUT=168` 小时,`TimeOutEnum.java:8`)。这是个合理的"会话级"时长——不是几分钟那么烦,也不是几十年那么危险。
- 签名密钥来自 `JWT_SECRET_KEY` 环境变量(或 `jwt.secret-key` 系统属性),见 `JwtUtil.signingKey()`。**网关和认证服务必须用同一把密钥**,否则网关验不过认证服务签的 token。
- 算法是对称的 **HS512**:同一把密钥既能签也能验,所以认证服务签、网关验,前提是密钥共享。

### 4.4 网关:统一验签 + 注入/剥离 X-User-Id

`GateWay/.../filter/AuthGlobalFilter.java:59-79`

```java
// 白名单:放行,但仍剥离客户端伪造的 X-User-Id
if (isWhitelisted(path)) {
    return chain.filter(exchange.mutate()
            .request(builder -> builder.headers(h -> h.remove(USER_ID_HEADER)))
            .build());
}

String token = resolveToken(request.getHeaders());
String userId = GatewayJwtUtil.parseSubject(token);   // 验签 + 取 subject,失败返回 null
if (!StringUtils.hasText(userId)) {
    return unauthorized(exchange);                     // 401
}

// 用经过验签的 subject 覆盖下游 X-User-Id
ServerWebExchange mutated = exchange.mutate()
        .request(builder -> builder.headers(h -> {
            h.remove(USER_ID_HEADER);                  // 先删客户端可能塞的
            h.set(USER_ID_HEADER, userId);             // 再设成可信值
        }))
        .build();
return chain.filter(mutated);
```

这段是全章最关键的 20 行,三个细节都要看懂:

1. **先 remove 再 set**(第 75-76 行):无论客户端在请求里塞没塞 `X-User-Id`,都先无条件删掉,再写入验签出来的真值。**客户端伪造的同名头到不了下游。**
2. **白名单也剥离**(第 60-63 行):注册/登录这种放行路径,虽然不验签,但**照样会把客户端带来的 `X-User-Id` 删掉**——否则有人可能在登录请求里偷偷塞个 `X-User-Id` 试图污染上下文。白名单 = "不要求 token",**不等于"信任你自带的身份头"**。
3. **过滤器顺序 `getOrder()=-100`**(第 110-113 行):保证它早于路由转发执行——必须在请求被转发出去**之前**完成头部改写。

白名单(`AuthGlobalFilter.java:39-47`):`register`、`login`、`loginCode`、`common/sendMail`、`common/check`、`/api/v1/netty`(WS 握手由 Netty 端校验)、`/actuator`。其余一律验签。

> 注意 `parseSubject` 内部对任何 `JwtException`(过期、签名不对、格式错)都 `return null`(`GatewayJwtUtil.java:29-31`),网关据此统一回 401。所以**token 过期 = 验不过 = 401**,客户端需要重新登录拿新 token。

### 4.5 下游服务:只信两类来源

`AuthenticationService/.../conf/AuthContextInterceptor.java:21-40`(各业务服务结构一致,可参照 `ContactService/.../config/AuthContextInterceptor.java`)

```java
String internal = request.getHeader("X-Internal-Token");
if (internal != null && internal.equals(internalToken)) {
    return true;                                  // ① 服务间调用,直接放行
}

String uid = request.getHeader("X-User-Id");
if (uid != null && !uid.trim().isEmpty()) {
    try {
        UserContext.set(Long.valueOf(uid.trim())); // ② 信任网关注入的 X-User-Id
        return true;
    } catch (NumberFormatException e) {
        writeUnauthorized(response); return false;  // X-User-Id 不是数字 → 401
    }
}
writeUnauthorized(response);                       // ③ 两者都没有 → 401
return false;
```

两类可信来源,泾渭分明:

| 来源 | 头 | 含义 | 谁会发 |
| --- | --- | --- | --- |
| 用户请求 | `X-User-Id` | "这是用户 999 的操作" | **只有网关**注入(默认值 `infinite-chat-internal-dev-token`) |
| 服务间调用 | `X-Internal-Token` | "这是内网服务在调我,放行" | 别的微服务(`internal.service.token`,默认 `infinite-chat-internal-dev-token`) |

`afterCompletion` 里 `UserContext.clear()`(`AuthContextInterceptor.java:43-45`):请求结束清掉 ThreadLocal,**防止线程复用时把上一个用户的身份串给下一个请求**——这是用 ThreadLocal 做请求上下文的标准纪律。

### 4.6 控制器:用 UserContext 校验"操作人本人"

`AuthenticationService/.../controller/UserController.java:56-62`

```java
@PatchMapping("/avatar")
public Result<UpdateAvatarResponse> updateAvatar(@Valid @RequestBody UpdateAvatarRequest request) {
    String id = String.valueOf(UserContext.get());           // 操作人 = 网关验签出来的本人
    UpdateAvatarResponse response = userService.updateAvatar(id, request);
    return Result.ok(response);
}
```

要点:**改谁的头像,不是由请求体里的某个 userId 决定,而是由 `UserContext.get()` 决定**。`UserContext` 里的值一路追溯回去,源头是网关验签后的 JWT subject。所以**用户只能改自己的头像**,无法通过改请求体冒充他人。涉及"对本人操作"的接口都应这样取 userId,而不是信任客户端传来的 id。

---

## 5. 数据落点

| 落点 | 内容 |
| --- | --- |
| 表 `user` | 注册写入:`user_id`(雪花)、`phone`、`password`(BCrypt 密文)、`user_name` 等 |
| 表 `user_balance` | 注册时附带创建,初始 `balance=1000`(`UserServiceImpl.java:83-88`) |
| Redis `<REGISTER_CODE>+phone` | 注册/验证码登录用的短信/邮箱验证码(`UserServiceImpl.java:63,124`) |
| Redis `verify:email:<email>` | `common/check` 校验邮箱验证码用(`CommonController.java:61`) |
| JWT(不落库) | subject=userId,7 天过期,HS512 签名,由客户端自行保存并随请求携带 |
| 请求头 `X-User-Id` | 网关注入的"内网身份事实",不持久化,仅存活于单次请求链路 |

注意:**JWT 本身不存数据库、不存 Redis**。它是自包含的(签名保证完整性),网关靠密钥就地验签,无需查任何存储。这也是 JWT 相比"session + 集中存储"的主要好处:验签无状态、好水平扩展。

---

## 6. 失败与边界处理

| 场景 | 行为 | 代码位置 |
| --- | --- | --- |
| 没带 token 调业务接口 | 网关 401 `{"code":40101,"msg":"未认证或令牌无效"}` | `AuthGlobalFilter.java:99-107` |
| token 过期/签名错/格式坏 | `parseSubject` 返回 null → 网关 401 | `GatewayJwtUtil.java:29-31` |
| 客户端自带 `X-User-Id` 想冒充 | 网关无条件 remove 后 set 真值,伪造无效 | `AuthGlobalFilter.java:62,75-76` |
| 直连下游、不带任何身份头 | 下游 `AuthContextInterceptor` 401 | `AuthContextInterceptor.java:38-39` |
| `X-User-Id` 不是合法数字 | 下游 `NumberFormatException` → 401 | `AuthContextInterceptor.java:32-35` |
| 服务间调用没有用户登录态 | 带 `X-Internal-Token` 放行,不设 UserContext | `AuthContextInterceptor.java:22-25` |
| 登录:用户不存在 / 密码错 | 统一抛 `LOGIN_ERROR`,不区分 | `UserServiceImpl.java:111-112` |

### 重点:为什么"直连服务也无法伪造身份"

有人可能想:既然下游只看 `X-User-Id`,那我**绕过网关**,直接对 `MessagingService:8081` 发请求并自己加一个 `X-User-Id: 12345`,不就冒充成功了吗?

在当前(已修复)的设计下,这条路是**走不通的**,原因要分清楚两层:

- **应用层**:下游确实"信任 `X-User-Id`",但前提是该头**只能由网关注入**——网关一定会先 remove 客户端的再 set 真值。问题在于"直连"时绕过了网关这道清洗。所以真正的防线是 **`X-Internal-Token` 没有泄露 + 内网网络隔离**:业务服务端口(8080/8081/...)不对公网暴露,只有网关(10010)对外。攻击者从公网根本碰不到 8081,只能从 10010 进,而 10010 必过网关验签。
- **结论**:`X-User-Id` 是一个**内网信任头**,它的安全性由"谁能进内网"保证,而不是由头本身保证。这也是为什么本系统反复强调"统一从网关进、业务端口不暴露"。

> 这正是相比旧机制的关键改进:旧设计里曾用过"信任一个静态来源头(如 `X-Request-Source`)"这类做法——静态值一旦泄露就能伪造。现在改成"网关每次用验签后的 subject 重写 `X-User-Id`",身份的可信度直接绑定到 JWT 签名上,无法凭一个固定字符串伪造。

---

## 7. Netty WebSocket 的路由 key 为什么优先用验签 subject

实时消息走 WebSocket(`/api/v1/netty` → `lb:ws://NettyService`,Netty 监听 9000)。NettyService 可能有多个实例,**同一个用户的长连接必须始终落到同一个实例**(否则推送找不到他的连接)。这就是"会话粘连(sticky)",用**一致性哈希**实现:以"用户标识"为 key,在哈希环上找到固定的节点。

`GateWay/.../gatewaylb/NettyConsistentHashLoadBalancer.java:93-107`

```java
// 优先使用经过验签的 JWT subject,杜绝伪造 userUuid 头劫持他人的粘连节点。
String token = headers.getFirst("token");
if (token == null || token.trim().isEmpty()) {
    token = headers.getFirst(HttpHeaders.AUTHORIZATION);
}
String subject = GatewayJwtUtil.parseSubject(token);
if (subject != null && !subject.trim().isEmpty()) {
    return subject;                       // ← 路由 key 用验签出来的 userId
}
// 退化:无有效令牌时才回退到 userUuid 头(仅用于无法携带令牌的客户端)
String userUuid = headers.getFirst("userUuid");
if (userUuid != null && !userUuid.trim().isEmpty()) {
    return userUuid;
}
return null;                              // 都没有 → 随机节点(choose 里处理)
```

为什么 key 一定要用**验签后的 subject**,而不是客户端自报的 `userUuid` 头?

- 哈希 key 决定你被路由到哪个 Netty 实例。如果用客户端可任意填写的 `userUuid`,攻击者就能**故意把自己的 key 设成受害者的 userId**,从而被路由到"受害者所在的那个实例"上,这会带来连接劫持/探测风险。
- 用**验签后的 subject** 当 key,key 的取值就被 JWT 签名锁死了——你只能哈希到"你自己"对应的节点。`userUuid` 仅在"实在拿不到 token"的退化场景才用。
- 哈希环本身:160 个虚拟节点(`ConsistentHashRing.java:12`),节点列表变化时按"实例 host:port 排序后的签名"判断是否需要重建环(`NettyConsistentHashLoadBalancer.java:66-82`),避免实例增减时大面积重新分配。

> 即"WebSocket 握手在网关侧是 `/api/v1/netty` 白名单放行的(不在这里验业务签),但负载均衡器仍会顺手解析 token 取 subject 作为稳定的路由 key";真正的 WS 鉴权由 Netty 端在握手时完成。

---

## 8. 动手实践

> 前置:Nacos(8848)、各服务、网关(10010)都已启动,且**网关与认证服务配置了同一个 `JWT_SECRET_KEY`**。下面统一**只打网关 10010**。

### Step 1 — 登录拿 token

(假设已注册过手机号 `13800000000`、密码 `123456`;注册需要验证码,这里直接演示登录。)

```bash
curl -s -X POST http://localhost:10010/api/v1/user/login \
  -H "Content-Type: application/json" \
  -d '{"phone":"13800000000","password":"123456"}'
```

预期返回(`Result<LoginResponse>`):

```json
{"code":200,"msg":null,"data":{"userId":"19xxxxxxxxxxxxxxx","token":"eyJhbGciOiJIUzUxMiJ9....","userName":"..."}}
```

把 `data.token` 存到变量:

```bash
TOKEN=$(curl -s -X POST http://localhost:10010/api/v1/user/login \
  -H "Content-Type: application/json" \
  -d '{"phone":"13800000000","password":"123456"}' | grep -o '"token":"[^"]*"' | cut -d'"' -f4)
echo "$TOKEN"
```

### Step 2 — 带 token 调用受保护接口

```bash
curl -s -X PATCH http://localhost:10010/api/v1/user/avatar \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"avatarUrl":"https://example.com/a.png"}'
```

预期:`{"code":200,...}`,且 `user` 表中**当前登录用户**那行 `avatar` 被更新。注意改的是 token 里的那个人,不需要、也不能在请求体里指定 userId。

### Step 3 — 验证"伪造头无效"

故意自己塞一个 `X-User-Id` 想冒充别人:

```bash
curl -s -X PATCH http://localhost:10010/api/v1/user/avatar \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-User-Id: 999999999" \
  -d '{"avatarUrl":"https://example.com/hack.png"}'
```

预期:改的**仍然是 token 对应的那个用户**,而不是 `999999999`。因为网关把你塞的 `X-User-Id` 删掉了,换成了验签出来的真值。

### Step 4 — 验证"不带 token 被拒"

```bash
curl -s -X PATCH http://localhost:10010/api/v1/user/avatar \
  -H "Content-Type: application/json" \
  -d '{"avatarUrl":"x"}'
```

预期:`401`,`{"code":40101,"msg":"未认证或令牌无效","data":null}`(网关层拦下)。

### Step 5 — 验证"服务间调用"放行

模拟一个内网服务直连下游(以认证服务为例,绕过网关直打 8082):

```bash
curl -s -X PATCH http://localhost:8082/api/v1/user/avatar \
  -H "Content-Type: application/json" \
  -H "X-Internal-Token: infinite-chat-internal-dev-token" \
  -H "X-User-Id: <某个真实userId>" \
  -d '{"avatarUrl":"https://example.com/internal.png"}'
```

预期:放行成功。`X-Internal-Token` 命中后直接 `return true`(不验 JWT);此处 `X-User-Id` 由你这个"可信内网调用方"提供。这条命令也解释了为什么**生产环境业务端口绝不能暴露公网**——一旦暴露,加上默认 token,身份就能被绕过。

### 该看哪里验证

| 验证点 | 看什么 |
| --- | --- |
| token 是否签出 | 登录返回的 `data.token`,可丢到 jwt.io 看 `sub`(=userId)和 `exp`(7 天后) |
| 头像是否改对人 | `user` 表对应 `user_id` 行的 `avatar` 列 |
| 网关是否生效 | 网关日志;401 来自网关说明验签拦截在边界完成 |
| Netty 粘连路由 | NettyService 多实例时,网关日志:`Netty连接按一致性哈希路由, userId: ...` |

---

## 9. 小结

- **签发在认证服务,验签在网关,信任在下游**——这是 InfiniteChat 鉴权的三段式骨架。
- 密码 **BCrypt**(带盐、不可逆、不可比对);JWT **HS512、7 天、subject=userId**;网关与认证服务**共享密钥**。
- 网关 `AuthGlobalFilter` 做四件事:白名单放行、验签、**剥离客户端伪造的 `X-User-Id`、注入验签后的真值**;过滤器 `getOrder()=-100` 保证在转发前完成。
- 下游 `AuthContextInterceptor` 只认两类来源:`X-Internal-Token`(服务间)和 `X-User-Id`(用户,且只能由网关注入),其余 401;`UserContext`(ThreadLocal)在请求结束 `clear()`。
- "直连也无法伪造"靠的是**内网隔离 + 网关重写 `X-User-Id`**,而不是头本身可信;Netty 路由 key 优先用**验签 subject**,杜绝拿伪造 `userUuid` 劫持他人粘连节点。

## 下一步读哪篇

- **第 3 章 联系人与好友关系**(`/api/v1/contact/**` → ContactService):看一个"纯业务"服务如何在 `UserContext` 之上做"操作人 = 本人"的一致性校验。
- 之后进入 **消息发送链路**(`/api/v1/chat/**` → MessagingService、Kafka topic `thousands_word_message`)与 **实时通信/在线状态**(`user:session:{userId}` Redis key、Netty WS),把本章的身份链路接到真正的 IM 消息流上。
