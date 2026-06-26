# 第 1 章 总览与架构基础

> 本章主题：用一张"地图"建立 InfiniteChat(千言)的全局心智模型——它是什么、由哪些服务组成、这些服务靠什么协作、本地怎么把它跑起来。

这是整套学习文档的"地图章"。后面每一章都会深入某一条具体链路(发消息、实时推送、离线补偿、好友群、红包、朋友圈),而本章帮你先把"哪些零件、各在哪、怎么连起来"看清楚。

**学完你能回答这些问题:**

- InfiniteChat 是个什么项目?它仿了微信的哪些功能?
- 它是 Maven 多模块,但模块之间为什么"几乎不互相 import"?那它们靠什么协作?
- 7 个微服务各自负责什么?分别监听哪个端口?网关怎么把请求分发给它们?
- MySQL / Redis / Kafka / Nacos / Netty 这 5 个基础设施,各自扮演什么角色?
- 所有接口都返回一个长得一样的 `Result<T>`,它长什么样?
- 鉴权是怎么做的?为什么下游服务"只认网关注入的 `X-User-Id`"?
- 本地要跑起来,得先装什么中间件、配哪些环境变量、按什么顺序启动?

---

## 1. 项目是什么

InfiniteChat(中文名"千言")是一套用 **Java + Spring Boot + Spring Cloud** 写的即时通讯(IM)后端,目标是仿微信的核心能力。根 `pom.xml`(`pom.xml:8-9`)里写得很直白:

```xml
<name>InfiniteChat</name>
<description>千言</description>
```

它覆盖的功能大致是:

| 功能域 | 说明 |
| --- | --- |
| 单聊 / 群聊 | 一对一与群组消息收发 |
| 实时推送 | 在线用户通过 WebSocket(Netty)即时收到消息 |
| 离线消息 | 用户不在线时消息落库,上线后补拉 |
| 好友 / 群组 | 加好友、建群、通讯录 |
| 红包 | 发红包、抢红包、过期退款 |
| 朋友圈 | 发动态、点赞、评论 |

对一个有 Spring Boot 基础、但没怎么碰过分布式/IM 的同学来说,这套系统最值得学的不是"某个接口怎么写",而是**多个独立服务如何协作完成一件事**——这正是后面各章要拆解的。

---

## 2. 核心设计思想:模块间不靠 Maven 依赖协作

打开根 `pom.xml`(`pom.xml:12-20`),你会看到 7 个 module:

```xml
<modules>
    <module>AuthenticationService</module>
    <module>GateWay</module>
    <module>RealTimeCommunicationService</module>
    <module>MessagingService</module>
    <module>OfflineDataStoreService</module>
    <module>ContactService</module>
    <module>MomentService</module>
</modules>
```

这里有个**关键认知**,初学者最容易误会:

> 虽然它们是同一个 Maven 工程下的多个 module,但**这些服务之间几乎不通过 Maven 依赖互相引用代码**。你不会看到 MessagingService 在 pom 里 `<dependency>` 了 ContactService 然后直接 `new` 它的某个类。

它们是 **7 个独立部署、独立进程的微服务**,Maven 多模块在这里只是"把 7 个项目放在一个仓库里方便一起构建"。真正让它们协作的,是下面这套"看不见的总线":

```
                          它们靠什么协作?
        ┌─────────────────────────────────────────────────┐
        │                                                   │
   ┌────┴─────┐   服务发现/注册    ┌──────────┐             │
   │  Nacos   │◄─────────────────►│ 每个服务  │             │
   └──────────┘   (谁在哪个IP端口) └──────────┘             │
                                                            │
   ┌──────────┐   统一入口/鉴权     客户端所有请求先打网关    │
   │ GateWay  │◄────────────────── (再按路径转发给下游)      │
   └──────────┘                                             │
                                                            │
   ┌──────────┐   异步消息总线      发消息服务"投递",        │
   │  Kafka   │◄────────────────── 离线服务"消费"           │
   └──────────┘                                             │
                                                            │
   ┌──────────┐   共享数据库        多个服务读写同一个       │
   │  MySQL   │◄────────────────── InfiniteChat 库          │
   └──────────┘                                             │
                                                            │
   ┌──────────┐   共享缓存/在线态    user:session:{uid}      │
   │  Redis   │◄────────────────── 记录谁在线、在哪台机器    │
   └──────────┘                                             │
        │                                                   │
        └───────────────────────────────────────────────────
```

一句话概括协作方式:**Nacos 负责"找到对方"、网关负责"统一入口和鉴权"、Kafka 负责"异步解耦"、共享 MySQL/Redis 负责"共享状态"**。需要同步互调时,服务之间通过网关或服务名发 HTTP(带 `X-Internal-Token` 标识内部调用),而不是编译期依赖。

这样设计的好处:每个服务可以单独改、单独重启、单独扩容,互不阻塞。代价是:你得习惯"一件事的逻辑散落在多个进程里",这也是 IM/分布式系统学习曲线的核心。

---

## 3. 七个服务:一句话职责

| 服务 | 一句话职责 | 你将在第几章细看 |
| --- | --- | --- |
| **GateWay** | 所有外部请求的唯一入口,统一鉴权(验签 JWT)、按路径路由、注入可信用户ID | 第 2 章 |
| **AuthenticationService** | 注册/登录/验证码/JWT 签发,用户账号体系 | 第 2 章 |
| **MessagingService** | 接收"发消息"请求,落库 + 投递到 Kafka,红包发/抢/退款 | 第 3、7 章 |
| **RealTimeCommunicationService(RTC)** | 维护 WebSocket(Netty)长连接,把消息实时推给在线用户,维护在线状态 | 第 4 章 |
| **OfflineDataStoreService** | 消费 Kafka 消息做离线落库,用户上线后补拉离线消息 | 第 5 章 |
| **ContactService** | 好友、群组、通讯录;给在线用户推送时查 Redis 找其所在 RTC 节点 | 第 6 章 |
| **MomentService** | 朋友圈:发动态、点赞、评论 | 第 8 章 |

---

## 4. 端口 / Nacos / 路由 总表

这张表是你以后排查问题时最常翻回来看的。所有端口都来自各服务 `application.yml` 的 `server.port`,可被环境变量覆盖。

### 4.1 服务与端口

| 服务(`spring.application.name`) | 端口 | 配置来源 |
| --- | --- | --- |
| GateWay | 10010 | `GateWay/src/main/resources/application.yml:2` |
| ContactService | 8080 | `ContactService/src/main/resources/application.yml:48` |
| MessagingService | 8081 | `MessagingService/src/main/resources/application.yml:48` |
| AuthenticationService | 8082 | `AuthenticationService/src/main/resources/application.yml:2` |
| RealTimeCommunicationService | HTTP 8083 + **Netty WS 9000** | `RealTimeCommunicationService/src/main/resources/application.yml:15,18` |
| OfflineDataStoreService | 8085 | `OfflineDataStoreService/src/main/resources/application.yml:54` |
| MomentService | 8086 | `MomentService/src/main/resources/application.yml:42` |
| Nacos(中间件) | 8848 | 各服务 `spring.cloud.nacos.discovery.server-addr` |

> **注意 RTC 比较特殊**:它同时是一个普通 Spring Boot HTTP 服务(8083)**和**一个 Netty WebSocket 服务(9000)。HTTP 端(8083)按 `spring.application.name=RealTimeCommunicationService` 注册到 Nacos;Netty 端(9000)则在 `NettyServer.java:72-73` 里**手动**再注册一个名为 `NettyService` 的实例到 Nacos:
>
> ```java
> NamingService namingService = nacosServiceManager.getNamingService();
> namingService.registerInstance(serverName, InetAddress.getLocalHost().getHostAddress(), this.port);
> ```
>
> 所以 Nacos 里你会看到两个相关服务名:`RealTimeCommunicationService`(8083)和 `NettyService`(9000)。网关的 WebSocket 路由就是冲着 `NettyService` 去的。

### 4.2 网关路由(`GateWay/src/main/resources/application.yml:32-89`)

网关用 `Path` 谓词把请求路由到对应服务的 `lb://服务名`(`lb` = load balance,负载均衡到 Nacos 里该服务的实例):

| 路径前缀 | 目标服务 | 路由 uri |
| --- | --- | --- |
| `/api/v1/user/**` | AuthenticationService | `lb://AuthenticationService` |
| `/api/v1/contact/**` | ContactService | `lb://ContactService` |
| `/api/v1/chat/**` | MessagingService | `lb://MessagingService` |
| `/api/v1/message/**` | RealTimeCommunicationService | `lb://RealTimeCommunicationService` |
| `/api/v1/netty` | NettyService(WebSocket) | `lb:ws://NettyService` |
| `/api/v1/offline/**` | OfflineDataStoreService | `lb://OfflineDataStoreService` |
| `/api/v1/moment/**` | MomentService | `lb://MomentService` |

`lb://` 是 HTTP 负载均衡,`lb:ws://` 是 **WebSocket** 负载均衡——这是 IM 里少见但关键的一点:WebSocket 握手也要经过网关再转发到某个 Netty 节点。而且这个负载均衡不是简单轮询,后面第 4 章会讲到它用了**一致性哈希**(`NettyConsistentHashLoadBalancer.java`),保证同一个用户每次都粘到同一个 Netty 节点。

---

## 5. 基础设施:5 个零件各扮演什么角色

| 基础设施 | 角色 | 在本系统里具体干什么 |
| --- | --- | --- |
| **Nacos** | 服务注册与发现 | 每个服务启动时把"我是谁、在哪个 IP:端口"注册上去;网关和服务间互调时按服务名查实例 |
| **MySQL** | 持久化存储(共享库 `InfiniteChat`) | 用户、消息、好友、群、红包、朋友圈都落在同一个库,被多个服务读写 |
| **Redis** | 缓存 + 在线状态 + 分布式锁 | 关键用途:记录"谁在线、连在哪台 RTC 机器上"(`user:session:{userId}`);红包等场景用 Redisson 加锁 |
| **Kafka** | 异步消息总线 | MessagingService 把消息投到 topic `thousands_word_message`,OfflineDataStoreService 消费它做离线落库,实现"发"与"存"解耦 |
| **Netty** | 高性能长连接服务器 | RTC 用 Netty 在 9000 端口承载海量 WebSocket 长连接,做实时推送、心跳、ACK |

把这 5 个零件和上面的服务表对起来看,你就能猜到一条消息的旅程了:**客户端 → 网关(鉴权) → MessagingService(落 MySQL + 投 Kafka) → 一路给在线用户(查 Redis 找节点 → RTC/Netty 推送),一路给离线用户(OfflineDataStore 消费 Kafka 落库)。** 这正是第 3~5 章的主线。

---

## 6. 统一返回 Result

所有 HTTP 接口都返回同一个结构 `Result<T>`,字段固定为 `{code, msg, data}`。以 `MessagingService/src/main/java/com/lou/messagingservice/common/Result.java:16-46` 为例:

```java
@Data
@Accessors(chain = true)
public class Result<T> {
    private int code;
    private String msg;
    private T data;

    public static <T> Result<T> ok(T data) {                 // 成功:code=200,带 data
        return new Result<T>().setCode(HttpStatus.OK.value()).setData(data);
    }
    public static <T> Result<T> ValidError(String msg) {     // 参数校验失败:code=400
        return new Result<T>().setCode(HttpStatus.BAD_REQUEST.value()).setMsg(msg);
    }
    public static <T> Result<T> UserError(int code, String msg) { // 业务自定义错误码
        return new Result<T>().setCode(code).setMsg(msg);
    }
    // 还有 DatabaseError / ServerError ...
}
```

每个服务都有自己的一份 `Result`(包路径不同但结构一致),这也呼应了第 2 节的设计思想:**宁可各自复制一份小工具类,也不让服务之间产生编译期依赖。** 读返回值时记住一句话:`code==200` 是成功,业务数据在 `data` 里,出错时 `msg` 给人看。

---

## 7. 鉴权模型 v1 总述

鉴权是初学者读这套代码时最容易看晕的地方,这里先给"一句话 + 一张图",细节留给第 2 章。

**一句话:网关是唯一的鉴权关口;它验签 JWT 后,把可信用户ID 以 `X-User-Id` 头注入给下游;下游服务只信任这个头,绝不信客户端自带的同名头。**

```
客户端                  GateWay(AuthGlobalFilter)            下游业务服务
  │                            │                                  │
  │ Authorization: Bearer JWT  │                                  │
  ├───────────────────────────►│                                  │
  │                            │ ① 白名单? 直接放行(但先剥掉      │
  │                            │    客户端伪造的 X-User-Id)        │
  │                            │ ② 非白名单: 验签 JWT              │
  │                            │    - 失败 → 401                   │
  │                            │    - 成功 → 取 subject 当 userId  │
  │                            │ ③ 剥掉客户端的 X-User-Id,         │
  │                            │    重新 set 成验签得到的 userId    │
  │                            ├─────────────────────────────────►│
  │                            │       X-User-Id: <可信 userId>    │ AuthContextInterceptor:
  │                            │                                  │ - 命中 X-Internal-Token? 放行
  │                            │                                  │ - 有 X-User-Id? 写入 UserContext
  │                            │                                  │ - 都没有? → 401
```

要点拆成三条:

1. **网关全局过滤器 `AuthGlobalFilter`**(`GateWay/src/main/java/com/lou/gateway/filter/AuthGlobalFilter.java`)对所有非白名单请求验签。白名单(`AuthGlobalFilter.java:39-47`)是这几条免登录路径:`register`、`login`、`loginCode`、`common/sendMail`、`common/check`、`netty`(WebSocket 握手由 Netty 端自己校验)、`actuator`。验签通过后,它做了最关键的一步——**先 `remove` 再 `set`**,把客户端可能伪造的 `X-User-Id` 头剥掉,换成 JWT subject 解出的真实 userId(`AuthGlobalFilter.java:72-78`):

   ```java
   ServerWebExchange mutated = exchange.mutate()
       .request(builder -> builder.headers(h -> {
           h.remove(USER_ID_HEADER);          // 剥离客户端伪造的 X-User-Id
           h.set(USER_ID_HEADER, userId);     // 写入验签得到的可信 userId
       }))
       .build();
   ```

2. **各业务服务的 `AuthContextInterceptor`**(如 `MessagingService/src/main/java/com/lou/messagingservice/config/AuthContextInterceptor.java`)是第二道关。逻辑(`AuthContextInterceptor.java:22-41`):
   - 命中 `X-Internal-Token`(服务间内部调用的共享密钥,默认 `internal.service.token=infinite-chat-internal-dev-token`)→ 直接放行;
   - 否则要求 `X-User-Id` 存在,存在就写入 `UserContext`(ThreadLocal),供本次请求随处取用;
   - 两者都没有 → 返回 401。

   控制器在做"操作人必须是本人"这类校验时,就拿 `UserContext` 里的 userId 和请求参数里的 userId 比对一致性,而不是相信客户端传来的 userId。

3. **JWT 与密码**:JWT 由 AuthenticationService 签发,有效期 **7 天**(`AuthenticationService/src/main/java/com/lou/authenticationservice/constants/config/TimeOutEnum.java:8`,`JWT_TIME_OUT=168` 小时)。密码用 **BCrypt** 存储(`AuthenticationService/src/main/java/com/lou/authenticationservice/service/impl/UserServiceImpl.java:45`,`BCryptPasswordEncoder`),不是明文也不是 MD5。网关验签和负载均衡所需的 JWT 密钥从环境变量 `JWT_SECRET_KEY` 读取(`GatewayJwtUtil.java:45-53`)。

> 顺带一提:网关给 `NettyService` 做 WebSocket 负载均衡时,路由 key 也**优先用验签后的 JWT subject**(`NettyConsistentHashLoadBalancer.java:93-99`),只有在客户端实在带不了令牌时才退化用 `userUuid` 头。这样别人就无法靠伪造 `userUuid` 把你的连接劫持到他想要的节点上。第 2、4 章会展开。

这套模型的精髓:**信任只产生于网关验签那一刻,之后在系统内部以 `X-User-Id` / `X-Internal-Token` 这两个头来传递信任**,任何来自外部的"我是谁"声明都不被直接采信。

---

## 8. 本地起步:中间件、环境变量、启动顺序

### 8.1 需要先准备的中间件

从各服务的 `application.yml` 和 `.env.example` 能反推出本地最少要跑起来的依赖:

| 中间件 | 默认地址 | 谁需要它 |
| --- | --- | --- |
| MySQL/MariaDB | `localhost:3307`(`.env.example` 默认) 或 3306 | Auth/Messaging/Offline/Contact/Moment |
| Redis | `localhost:6379` | 几乎所有服务 + RTC 在线态 |
| Nacos | `localhost:8848` | 全部 7 个服务(注册发现) |
| Kafka | `localhost:9092` | Messaging(生产)、Offline(消费)、Contact |

### 8.2 环境变量(参考 `.env.example`)

仓库根有 `.env.example`,**只放示例不放真实密钥**,本地复制成 `.env` 使用(`.env` 已在 `.gitignore`)。关键几组:

```bash
SPRING_PROFILES_ACTIVE=local

# MySQL
MYSQL_USERNAME=infinite_chat
MYSQL_PASSWORD=your_mysql_password
MYSQL_URL='jdbc:mysql://localhost:3307/InfiniteChat?...'

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=your_redis_password
REDISSON_ADDRESS=redis://localhost:6379

# Nacos / Kafka
NACOS_SERVER_ADDR=localhost:8848
KAFKA_BOOTSTRAP_SERVERS=localhost:9092

# 其它:Resend 发邮件、腾讯云 COS 存图等(`.env.example` 里都有示例占位)
```

注意 `.env.example` 里**没有** `JWT_SECRET_KEY`,但网关验签和 RTC 签发都需要它,本地启动前务必通过环境变量或 JVM 参数 `-Djwt.secret-key=...` 提供一个密钥(`GatewayJwtUtil.java:12-13` 两个来源都支持),且**网关与 Authentication/RTC 必须用同一个密钥**,否则签出来的 token 网关验不过。AuthenticationService 还提供了 `application-local.example.yml`,复制为 `application-local.yml` 后填本地值即可(该文件已被 gitignore)。

### 8.3 建议的启动顺序

```
1. 先起中间件:  Nacos → MySQL → Redis → Kafka
2. 再起业务服务: AuthenticationService(发 token 的源头)
3. 然后:        MessagingService / RealTimeCommunicationService /
                OfflineDataStoreService / ContactService / MomentService
4. 最后起网关:  GateWay(它要从 Nacos 发现上面这些服务才能路由)
```

原因:服务启动时要往 Nacos 注册、要连 MySQL/Redis/Kafka,所以**中间件必须先就绪**;网关放最后起,是因为它依赖 Nacos 里已经有下游实例才能 `lb://` 路由成功。其实 Spring Cloud 有重试和惰性发现,顺序不严格,但按上面来最省心。

### 8.4 验证是否起来了

- 打开 Nacos 控制台(`http://localhost:8848/nacos`),应看到 7 个服务名 + 额外的 `NettyService` 都已注册、健康。
- 各服务暴露了 `actuator`(网关白名单已放行),`curl http://localhost:10010/actuator/health` 之类可探活。
- 走一遍登录:`POST http://localhost:10010/api/v1/user/login` 拿到 JWT,后续请求带 `Authorization: Bearer <JWT>` 即可被网关放行——这正是第 2 章的"动手实践"。

---

## 9. 常见坑

| 现象 | 多半是因为 |
| --- | --- |
| 所有非登录接口都 401 | `JWT_SECRET_KEY` 没配,或网关与 Auth/RTC 用的密钥不一致 |
| 网关路由报 503/找不到实例 | 下游服务没注册到 Nacos,或 Nacos 地址配错 |
| WebSocket 连不上 | `NettyService` 没注册(RTC 的 Netty 端没起),或走错了 `/api/v1/netty` 路径 |
| 发消息成功但对方收不到 | 在线推送与离线落库是两条链路,要分别查 Redis `user:session:` 和 Kafka 消费,见第 4、5 章 |
| 下游服务拿不到用户ID | 直接打了下游端口绕过网关,导致没有 `X-User-Id` 注入 |

---

## 10. 小结 + 按链路阅读顺序

你现在应该有了这张"地图":7 个独立微服务,靠 **Nacos(发现)+ 网关(入口与鉴权)+ Kafka(异步)+ 共享 MySQL/Redis(状态)** 协作,而不是靠 Maven 互相依赖;所有接口返回统一的 `Result<T>`;信任只在网关验签那一刻产生,之后用 `X-User-Id`/`X-Internal-Token` 在内部传递。

接下来按**真实链路顺序**逐章深入,每一章都建立在前一章之上:

1. **第 2 章 鉴权**——JWT 怎么签、网关怎么验、`X-User-Id` 怎么贯穿全系统(把本章第 7 节展开)
2. **第 3 章 发消息**——MessagingService 落库 + 投 Kafka 的"发件箱"机制
3. **第 4 章 实时与在线**——Netty 长连接、一致性哈希路由、`user:session:` 在线态
4. **第 5 章 离线**——OfflineDataStore 消费 Kafka 落库与上线补拉
5. **第 6 章 好友与群**——ContactService 通讯录与给在线用户推送
6. **第 7 章 红包**——发/抢/过期退款与并发控制
7. **第 8 章 朋友圈**——MomentService 动态、点赞、评论

下一步请读:**`docs/learn/02-*`(鉴权)**。
