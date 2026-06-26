# InfiniteChat 端到端(E2E)测试环境配置方案

> **文档状态:草案 · 待审核(DRAFT, pending review)**
> **作者约定:** 本文由「统筹规划」对话产出。该对话只产出 md / 规划文件,**不在对话内执行任何构建、部署或对运行态的写操作**。下文中的命令是给**你或 CI** 执行的处方;我对 WSL 运行态只做了**只读探测**来核对事实。
> **评审回路:** 你审核后,把意见写到末尾 **§11 评审记录**,我会据此**重写本文档**(而不是新开一份)。
>
> 探测时间:2026-06-26 · WSL distro: `Debian` · 用户:`hanwen@DESKTOP-2H53KVD`

---

## 0′. 与 chat 后端流 E2E 实现的分工(2026-06-26 协调更新)

chat 后端流(S3)已独立产出**可执行的 chat 专项 E2E**:`chat/docs/E2E-TESTING.md` + `chat/e2e/`(`e2e.env.example`、`01-setup-infra.sh`…`04-smoke-test.sh`、`99-stop.sh`)。中枢据此裁定(详见 `STATUS.md` 冲突登记 C1):

- **本文 = 系统级 E2E 伞**:覆盖 agent + 两个前端 + 统一鉴权的**跨系统**端到端,以及总体环境策略。
- **`chat/e2e/` = chat 后端 E2E 的权威可执行实现**:本文 §3/§6.1 的 chat 部分以它为准,不重复造。
- **统一隔离约定(覆盖本文早期取值):** 采纳 S3 的**隔离并存**方案——库 `*_e2e`、Redis 独立 db、**Nacos 命名空间 `e2e`(非 group,因 NettyServer 固定 DEFAULT_GROUP)**、独立 Kafka、**端口 +100**(chat 网关 10110)。本文 §2.1 端口表里 agent 的 E2E 端口相应取 `18180`(prod 18080 +100),不再用 11010。线上(旧 jar)可不停,E2E 与之零冲突。

## 0. 结论先行(TL;DR)

1. **现状有坑:** WSL 里**同时存在两套并存、端口冲突的部署**——一套是可见的「裸进程」运行时(`~/projecta-runtime/`,脚本化 `java -jar`),一套是**当前真正在跑的 Docker 栈**(你说的「用 Docker 容器跑着旧 jar」)。两套的中间件端口互相打架(Redis 6379 vs 6380、MariaDB 3307 vs 13307、PgVector 5432 vs 5433、agent 11010 vs 10011)。**这就是端到端验证不可靠的根因。**
2. **阻断项:** 当前 `hanwen` **不在 docker 组**(`docker` 组存在但为空),所以任何人(包括子 Agent、包括我)都无法 `docker ps`/重建容器去验证。走 Docker 轨**必须先**:`sudo usermod -aG docker hanwen` 并重登。
3. **方案:** 本文确立**单一权威 E2E 环境**,并给出两条落地轨:
   - **轨道一 · 裸进程 E2E(立即可用,不需要 docker 权限):** 复用并刷新已存在、已验证可编译的 `~/projecta-runtime` 脚本体系,从**当前最新源码**重建 jar、固定端口、初始化库、跑冒烟与链路用例。**推荐作为本周即可跑通的基线。**
   - **轨道二 · Docker Compose E2E(目标 · 可复现 · 进 CI):** 用一份**权威 compose**(本文给出规格)一键拉起中间件 + 全部后端 + 两个前端,带健康检查、数据初始化、固定端口。**推荐作为面向生产的最终形态。**
4. **需要你拍板的 6 件事** 见 **§10 待你确认**。

---

## 1. 实测现状(只读探测结果)

### 1.1 WSL 基础环境

| 项 | 值 |
| --- | --- |
| 发行版 | Debian(WSL2),`systemd=true`(`/etc/wsl.conf`) |
| 用户 | `hanwen`(uid 1000),属组含 `sudo`,**不含 `docker`** |
| 内核 | `6.18.x microsoft-standard-WSL2` |
| JDK | OpenJDK **21.0.11**(`/usr/lib/jvm/java-21-openjdk-amd64`) |
| Maven | **3.9.9**(系统级 `/usr/share/maven`) |
| Node / npm | **v20.19.2** / 9.2.0 |
| eth0 | `100.122.46.119/32`(非典型 172.x,疑似镜像网络或叠加网卡;`.wslconfig` 在 Windows 侧,探测不到) |
| sudo | **需要密码**(非免密);docker 守护进程在跑但 socket 属 `root:docker`,`hanwen` 连不上 |

### 1.2 当前监听端口实测(`ss -tln`)

| 端口 | 实测归属(curl 核对) | 备注 |
| ---: | --- | --- |
| 10010 | **chat GateWay**(Spring,`/actuator/health` 返回 404 路由) | chat 对外入口 |
| 10011 | **agent**(`/api/actuator/health` → `{"status":"UP", db:MySQL UP}`) | 当前 Docker 栈里 agent 的实际端口 |
| 8080 / 8081 / 8082 / 8083 / 8085 / 8086 | Contact / Messaging / **Auth(`{"status":"UP"}`)** / RealTime(HTTP)/ Offline / Moment | chat 微服务 |
| 9000 | RealTime 的 **Netty WebSocket**(非 MinIO) | chat 长连接 |
| 8848 / 9848 / 9849 | **Nacos 2.5.1**(HTTP + gRPC) | 注册/配置中心 |
| 9092 | **Kafka 3.9.1 KRaft** | 消息总线 |
| 3307 / 13307 | **MariaDB**(裸 3307;Docker 13307) | **两份** |
| 6379 / 6380 | **Redis**(裸 6379;Docker 6380) | **两份** |
| 5432 / 5433 | **PostgreSQL + PgVector**(裸 5432;Docker 5433) | **两份**,agent 向量库 db=`dp` |
| 4173 | Vite preview | 某前端预览残留 |
| 222 / 53 / 8388 / 28375 | sshd / WSL DNS / 代理类 | 与本项目无关 |

> **关键观察:中间件端口成对出现(6379+6380、3307+13307、5432+5433)+ agent 落在 10011 而非脚本里的 11010 → 现在跑的是 Docker 栈,与 `~/projecta-runtime` 裸进程脚本是两套不同部署。** 这是 E2E 不确定性的来源,必须二选一(见 §2.1)。

### 1.3 两套部署对照

| 维度 | 轨道 A:裸进程 `~/projecta-runtime`(脚本可见) | 轨道 B:当前在跑的 Docker 栈(不可见) |
| --- | --- | --- |
| 启动方式 | `start-apps.sh` → `nohup java -jar`,pidfile 在 `run/` | Docker 容器(`docker` 权限挡住,无法 `ps`/查 compose) |
| 源码快照 | `~/projecta-current`(**Jun 15-16 旧快照,仅 agent+chat**) | 「旧 jar」,版本未知 |
| 中间件 | systemd 的 MariaDB:3307 / Redis:6379 + 裸 Nacos:8848 / Kafka:9092 / PG:5432 | 容器内,映射到 13307 / 6380 / 5433 等 |
| agent 端口 | 脚本写 `--server.port=11010`(当前**未在该端口**响应) | **10011**(实测 UP) |
| chat 网关 | 10010 | 10010(实测 UP,与 A 抢同一端口) |
| 密钥 | `~/projecta-runtime/*.env`(600,可读) | compose/secret 我看不到 |
| 我的可见度 | **完全可见、可复述、已"验证可编译"** | **不可见**(docker 权限 + 无 compose) |

> 结论:**轨道 A 是我能完全掌控、可复现的基线;轨道 B 是事实在跑但黑盒。** E2E 不能脚踩两条船。

### 1.4 中间件与凭据现状(轨道 A 视角)

`~/projecta-runtime/README.md` 与脚本确认:

- **Redis 8** — systemd 服务,`127.0.0.1:6379`,带密码。
- **MariaDB 11** — systemd 服务,**`127.0.0.1:3307`**(3306 被宿主转发占用,项目自管库改 3307)。已建库:`InfiniteChat`(chat)、`agent`(agent)。账号 `infinite_chat`。
- **Nacos 2.5.1** — `~/.local/opt/nacos`,`start-nacos.sh`,`127.0.0.1:8848`(+9848/9849),standalone。
- **Kafka 3.9.1 KRaft** — `~/.local/opt/kafka`,`start-kafka.sh`,`127.0.0.1:9092`,数据在 `~/projecta-runtime/kafka-data`,`auto.create.topics.enable=true`。
- **PostgreSQL + PgVector** — `127.0.0.1:5432`,db `dp`,扩展 `vector`(agent 用)。
- **对象存储** — chat 用 **腾讯云 COS**(`TENCENT_CLOUD_COS_*`,非本地 MinIO);agent 邮件用 **Resend**(`RESEND_*`)。
- **数据初始化** — `~/projecta-runtime/chat-schema-bootstrap.sql`(从 MyBatis 实体反推、`CREATE TABLE IF NOT EXISTS`、可重复执行):`user`、`user_balance`、`friend`、`session` 等。

### 1.5 配置契约(env 键清单)

凭据在四个 600 权限的 env 文件里(**严禁提交进仓库**)。键结构如下(密值用占位符):

**`projecta-common.env` / `projecta-values.env`(两后端共用)**
```
SPRING_PROFILES_ACTIVE     # 例:local / prod
NACOS_SERVER_ADDR          # 127.0.0.1:8848
KAFKA_BOOTSTRAP_SERVERS    # 127.0.0.1:9092
REDIS_HOST=localhost  REDIS_PORT=6379  REDIS_DATABASE=0  REDIS_PASSWORD=<REDACTED>
REDISSON_ADDRESS           # redis://localhost:6379
MYSQL_USERNAME=infinite_chat  MYSQL_PASSWORD=<REDACTED>
AGENT_MYSQL_URL / CHAT_MYSQL_URL   # 仅 values.env:两库各自 JDBC URL
```

**`agent.env`(agent 专属)**
```
MYSQL_URL                                  # jdbc:mysql://...:3307/agent?...
PGVECTOR_HOST=localhost PGVECTOR_PORT=5432 PGVECTOR_DATABASE=dp PGVECTOR_USER=<..> PGVECTOR_PASSWORD=<REDACTED>
PGVECTOR_TABLE  PGVECTOR_DIMENSION         # 向量表名 / 维度(注意 IMPROVEMENTS.md F10:维度硬编码 1024)
AGENT_MODEL_PROVIDER=openai-compatible
OPENAI_COMPATIBLE_BASE_URL=https://ai.enodot.shop  OPENAI_COMPATIBLE_CHAT_MODEL=gpt-5.5
OPENAI_COMPATIBLE_API_KEY=<REDACTED>  OPENAI_COMPATIBLE_TEMPERATURE  OPENAI_COMPATIBLE_MAX_OUTPUT_TOKENS
DASHSCOPE_API_KEY=<REDACTED>               # 备用/嵌入
RESEND_API_KEY=<REDACTED> RESEND_API_URL RESEND_FROM   # 邮件工具
```

**`chat.env`(chat 专属)**
```
MYSQL_URL                                  # jdbc:mysql://...:3307/InfiniteChat?...
RESEND_API_KEY=<REDACTED> RESEND_API_URL RESEND_FROM    # 注册验证码邮件
TENCENT_CLOUD_COS_SECRET_ID/SECRET_KEY=<REDACTED>       # 头像/媒体对象存储
TENCENT_CLOUD_COS_REGION/BUCKET/*_DOMAIN                # COS 域名族
```

> 与既有审计呼应:`agent.env`/`chat.env` 把密钥外置到环境变量,**比仓库里硬编码好**;但 `chat` **源码内**仍有硬编码兜底(见 `PROJECT_AUDIT_ONBOARDING.md` P0「敏感配置硬编码」),E2E 前应确保运行时只读 env、源码默认值全部脱敏。

---

## 2. 目标 E2E 环境设计

### 2.1 单一权威栈 + 权威端口表(消解冲突)

**原则:E2E 期间只跑一套栈。** 推荐端口如下(裸进程与 Docker 两轨共用同一对外端口契约,内部中间件端口在 Docker 轨用容器网络、对宿主只暴露这一份):

| 组件 | 端口 | 对外/对内 | 说明 |
| --- | ---: | --- | --- |
| chat **GateWay** | **10010** | 对外 | chat 全部 REST 入口 `/api/v1/**` |
| chat Netty WS | **9000** | 对外 | 实时长连接 `ws://host:10010/api/v1/netty` 经网关代理 |
| **agent** | **11010** | 对外 | `/api/**`;**统一用 11010,废弃 10011 漂移** |
| chat Auth/Contact/Messaging/RealTime/Offline/Moment | 8082/8080/8081/8083/8085/8086 | 对内 | 仅网关与服务间访问,E2E 不直连 |
| MariaDB | 3307 | 对内 | 库 `InfiniteChat` + `agent` |
| Redis | 6379 | 对内 | db 0 |
| Nacos | 8848(+9848/9849) | 对内 | 注册/配置 |
| Kafka | 9092 | 对内 | KRaft standalone |
| PgVector(Postgres) | 5432 | 对内 | 库 `dp`,扩展 `vector` |
| **agent-frontend**(Vite,Windows) | 5173 | 对外 | → `http://<host>:11010/api` |
| **chat-frontend**(Vite,Windows) | 5273 | 对外 | → `http://<host>:10010/api/v1` |

> **冲突动作:** 启动权威栈前,**先停掉另一套**,否则 10010 / agent 端口 / 中间件双份会让用例打到错误实例。
> - 停裸进程:`~/projecta-runtime/stop-apps.sh all`
> - 停 Docker 栈:`docker compose -f <你的 compose> down`(需 docker 权限;见 §4.0)
> 选定权威栈后,把另一套的中间件容器/服务也停掉,避免 6380/13307/5433 误导。

> **⚠️ 前端默认地址 bug(E2E 必踩):** `frontend/src/api.ts` 的 `DEFAULT_API_BASE = http://localhost:10010/api` **指向了 chat 网关而非 agent**。E2E 必须用 `VITE_API_BASE_URL=http://localhost:11010/api` 覆盖(并在 agent-frontend 计划里修默认值)。

### 2.2 目标拓扑

```text
                Windows 宿主(E:\jhw\proj)
        ┌───────────────────────┬───────────────────────┐
        │ agent-frontend :5173  │ chat-frontend :5273    │   (Vite dev / preview)
        └──────────┬────────────┴───────────┬───────────┘
   VITE_API_BASE=  │ :11010/api             │ :10010/api/v1
                   ▼   (WSL2 localhost 转发) ▼
   ════════════════════════ WSL: Debian ════════════════════════
        agent :11010 (/api)        chat GateWay :10010 (/api/v1)
              │                          │  路由→ Auth/Contact/Messaging/
              │                          │        RealTime/Offline/Moment + Netty:9000
              ▼                          ▼
   ┌──────────────── 共享中间件(单份)────────────────┐
   │ MariaDB:3307(InfiniteChat, agent) Redis:6379    │
   │ Nacos:8848  Kafka:9092  PgVector:5432(dp)         │
   └───────────────────────────────────────────────────┘
   外部依赖:OpenAI 兼容网关 ai.enodot.shop(agent LLM)、Resend(邮件)、腾讯云 COS(chat 媒体)
```

### 2.3 数据面(schema / seed)

- **chat 库 `InfiniteChat`:** 用 `~/projecta-runtime/chat-schema-bootstrap.sql`(幂等)。E2E 需补 **种子数据**:2 个测试用户(便于发好友/发消息)、互为好友、一个会话。建议新增 `chat-seed-e2e.sql`(规格见 §6.1)。
- **agent 库 `agent`:** 由 agent 自身建表/迁移(MyBatis / 启动建表)。E2E 需:一份可入库的测试文档(md/txt)走 RAG;PgVector `dp.dp_embedding` 表存在且 `vector` 扩展可用。
- **隔离:** E2E 应在**独立库名后缀**(如 `InfiniteChat_e2e` / `agent_e2e`)或独立 schema 上跑,避免污染开发数据。轨道二用独立 compose 卷天然隔离。

### 2.4 配置与密钥管理

- 运行态密钥继续放 `~/projecta-runtime/*.env`(600,gitignored)。**仓库内只放 `*.env.example` 模板**(键名 + 占位),与 §1.5 对齐。
- E2E 专用 profile:`SPRING_PROFILES_ACTIVE=e2e`,对应 `application-e2e.yml`(指向 e2e 库、关闭外发邮件/改用 mailpit、COS 用测试桶或 stub)。
- **外呼降级:** E2E 默认应能**离线**——LLM 可指向一个 mock/录制响应,邮件用本地 mailpit,COS 用本地 stub 或跳过媒体用例——避免依赖 `ai.enodot.shop`/Resend/腾讯云的网络与额度(尤其本机有 198.18 透明代理问题,见 §5)。把「真实外呼」作为单独的可选用例集。

### 2.5 WSL ↔ Windows 网络(前端连后端)

- 前端在 **Windows** 跑(`E:\jhw\proj\frontend`、`chat-frontend`),后端/中间件在 **WSL**。WSL2 默认有 `localhostForwarding`,Windows 侧 `http://localhost:10010` / `:11010` 通常可直达 WSL 中监听 `0.0.0.0` 的服务(实测 8080-8086/10010/10011/9000 都是 `0.0.0.0`)。
- 若 `localhost` 不通(镜像网络/防火墙):取 WSL IP `wsl hostname -I`,用该 IP 配 `VITE_API_BASE_URL`。
- **CORS:** agent 后端当前 `allowedOriginPatterns("*") + allowCredentials(true)`(IMPROVEMENTS.md F03),E2E 能跑但生产必须收敛为显式白名单(`http://localhost:5173` 等)。chat 网关需确认对前端 origin 放行。

---

## 3. 轨道一:裸进程 E2E(立即可用,无需 docker 权限)

> 复用 `~/projecta-runtime`,但**从当前最新源码重建**(现有 `projecta-current` 是 Jun15-16 旧快照,且缺前端)。所有命令在 WSL 内执行。

**3.0 选栈与清场**
```bash
# 停掉另一套,释放端口(Docker 栈需 docker 权限,见 §4.0)
~/projecta-runtime/stop-apps.sh all
~/projecta-runtime/check-runtime.sh          # 确认 3307/5432/6379/8848/9092 在,应用端口空
```

**3.1 同步最新源码到 WSL**
> 当前 `~/projecta-current` 落后于 Windows 的 `E:\jhw\proj`。两选一:
> - (a) 直接在 `/mnt/e/jhw/proj` 上构建(避免拷贝,但 `/mnt` 编译 I/O 慢);或
> - (b) `rsync -a --delete /mnt/e/jhw/proj/{agent,chat}/ ~/projecta-current/`(推荐:WSL ext4 上编译快)。
> **二选一并写进本文(见 §10 第 3 问)。**

**3.2 重建 jar**(注意 §5 的构建陷阱)
```bash
cd ~/projecta-current/agent
set -a && . ~/projecta-runtime/agent.env && set +a
mvn -B -DskipTests package          # 用系统 mvn,不要 mvnw(见 §5)

cd ~/projecta-current/chat
set -a && . ~/projecta-runtime/chat.env && set +a
mvn -B -DskipTests package          # 7 模块聚合
```

**3.3 初始化数据**
```bash
set -a && . ~/projecta-runtime/chat.env && set +a
mariadb -h127.0.0.1 -P3307 -u"$MYSQL_USERNAME" -p"$MYSQL_PASSWORD" InfiniteChat < ~/projecta-runtime/chat-schema-bootstrap.sql
mariadb -h127.0.0.1 -P3307 -u"$MYSQL_USERNAME" -p"$MYSQL_PASSWORD" InfiniteChat < ~/projecta-runtime/chat-seed-e2e.sql   # 新增,见 §6.1
```

**3.4 启动**(脚本已先确保 Nacos/Kafka 在线)
```bash
~/projecta-runtime/start-apps.sh all    # 注意:把脚本里 agent 的 --server.port 统一成 11010
~/projecta-runtime/check-apps.sh        # 端口 + pid + health 探测
```

**3.5 起前端(Windows 侧)**
```powershell
# agent-frontend
cd E:\jhw\proj\frontend
$env:VITE_API_BASE_URL = "http://localhost:11010/api"   # 覆盖错误默认值
npm install ; npm run dev                                # http://localhost:5173

# chat-frontend(已脚手架)
cd E:\jhw\proj\chat-frontend
$env:VITE_API_BASE = "http://localhost:10010/api/v1"
npm install ; npm run dev                                # http://localhost:5273
```

**3.6 跑用例:** 见 §6。

---

## 4. 轨道二:Docker Compose E2E(目标 · 可复现 · 进 CI)

> 这是**面向生产**的最终形态:一键、隔离、可在 CI 复跑。**本对话不落 compose 文件(只产出文档)**;以下是规格,审核通过后再由实现对话落到 `deploy/e2e/`。

**4.0 前置:解开 docker 权限阻断**
```bash
sudo usermod -aG docker hanwen      # 需要 sudo 密码(你来执行)
# 重登 WSL 使组生效:wsl --shutdown(Windows) 后重开,或当前会话临时 newgrp docker
docker ps                            # 应不再 permission denied
```

**4.1 compose 规格(`deploy/e2e/docker-compose.e2e.yml`)**
- **services(中间件):** `mariadb:11`(:3307→3306,初始化挂 `chat-schema-bootstrap.sql`+seed)、`redis:8`、`nacos/nacos-server:v2.5.1`(standalone)、`bitnami/kafka:3.9`(KRaft)、`pgvector/pgvector:pg16`(库 dp,initdb 装 `vector`)。
- **services(应用):** `agent`(11010)、`gateway`(10010)、`auth/contact/messaging/realtime/offline/moment`(内网),都从各自 `Dockerfile` 构建当前源码;`depends_on` + `condition: service_healthy`。
- **healthcheck:** 中间件用各自 ping;Spring 服务用 `/actuator/health`(agent 用 `/api/actuator/health`,gateway 用某业务探活路由,因为它无 `/actuator/health`)。
- **env:** 用 `--env-file deploy/e2e/e2e.env`(从 `*.env.example` 派生,密值本地填),容器内 host 用服务名(`mariadb`/`redis`/`nacos`/`kafka`/`pgvector`)而非 localhost。
- **网络:** 单 `e2e-net` bridge;对宿主只暴露 10010 / 11010(+需要时 9000)。
- **数据隔离:** 命名卷 `e2e-mariadb`/`e2e-pg`/`e2e-kafka`;`down -v` 即彻底复位。

**4.2 一键入口(`Makefile` 或 `deploy/e2e/run.sh` 规格)**
```
make e2e-up      # build + up + 等 healthy + 跑 seed
make e2e-smoke   # §7 冒烟
make e2e-test    # §6 链路用例(Postman/newman 或 pytest)
make e2e-down    # down -v 复位
```

**4.3 与既跑 Docker 栈的关系:** 若你愿意,把现有「旧 jar」Docker 栈的 compose 给我,我直接在其上改造成本规格(复用你已有的镜像构建),而不是从零写。见 §10 第 1 问。

---

## 5. 构建与已知陷阱

| 陷阱 | 现象 | 处方 |
| --- | --- | --- |
| **mvnw 走 198.18 代理卡死** | 这台 WSL 的 DNS/路由把很多公网域名导向 `198.18.x` 透明代理,`mvnw` 下载 Maven 发行包易超时 | **用系统 `mvn`(3.9.9),不要 `./mvnw`**(`projecta-runtime/README.md` 已踩过) |
| **JDK 版本** | agent=Java 17(Spring Boot 3.5),chat=Spring Boot 2.6 旧栈;本机 JDK 21 | agent 在 21 上 OK;chat 需确认 Lombok 版本兼容 21(`PROJECT_AUDIT_ONBOARDING.md` P0:JDK25 下 Lombok 失效)。**E2E 锁 JDK 21,并显式钉 Lombok 版本** |
| **agent 缺 Lombok 依赖** | `PROJECT_AUDIT_ONBOARDING.md` 记录 agent `pom.xml` 缺 Lombok → 编不过 | 但 `projecta-runtime` 已"验证可编译" → 说明 WSL 上的源码/POM 已修;**以 WSL 实测为准**,同步回 Windows 源码 |
| **chat 无 Maven Wrapper** | chat 没有 `mvnw` | 用系统 mvn;或补 wrapper(后续) |
| **apt/大文件下载异常** | 同 198.18 | `sudo ~/projecta-runtime/fix-download-routes.sh` |
| **agent 默认 baseURL 错** | 指向 10010(网关)非 agent | 前端用 `VITE_API_BASE_URL` 覆盖,并修源码默认值 |

---

## 6. E2E 测试场景

> 分三层:**冒烟(进程/健康)→ 单系统链路 → 前后端联调**。每条给「步骤 / 预期 / 当前已知风险」。

### 6.1 chat 链路(IM 闭环)

`chat-seed-e2e.sql` 种子:用户 A(1001)、B(1002),互为好友,会话 2001。

| # | 场景 | 步骤(经网关 :10010) | 预期 | 已知风险 |
| --- | --- | --- | --- | --- |
| C1 | 注册/验证码 | `POST /api/v1/user/...` 发验证码→注册 | 收到码、建用户 | 邮件走 Resend,E2E 建议改 mailpit |
| C2 | 登录拿 token | `POST /api/v1/user/login` | 返回 JWT | **JWT 不验签**(ONBOARDING P0):token 形同虚设,用例需覆盖"伪造 token 应被拒"——当前会**失败**,记为缺陷 |
| C3 | 好友申请/同意 | `/api/v1/contact/apply` `/accept` | 关系建立 | 业务接口信任 body 里的 userId(IDOR) |
| C4 | WebSocket 上线 | `ws://localhost:10010/api/v1/netty` headers `userUuid,token` | Redis 写 `USER_SESSION:{uid}` | 多节点一致性路由依赖 JWT subject(密钥不一致风险) |
| C5 | 单聊发消息 | `POST /api/v1/chat/session` | 在线推送 + Kafka outbox + 离线落库 | outbox 幂等/重复 messageId 未覆盖 |
| C6 | 离线消息 | B 离线→A 发→B 上线拉 | `/api/v1/offline/**` 能取回 | 投递去重未验证 |
| C7 | 红包 | 发→领→过期退款 | 余额扣减/退款幂等 | 并发领取幂等未覆盖 |
| C8 | 朋友圈 | `POST /api/v1/moment/**` 发/赞/评 | 返回正确 momentId、推送好友 | **momentId 返回 bug**(ONBOARDING P2) |

### 6.2 agent 链路(助手闭环,经 :11010/api)

| # | 场景 | 步骤 | 预期 | 已知风险 |
| --- | --- | --- | --- | --- |
| A1 | 健康 | `GET /api/actuator/health` | UP(db/disk) | — |
| A2 | 普通/流式聊天 | `POST /api/chat`、`POST /api/streamChat`、`POST /api/chat/auto/stream` | 回答 / SSE delta 流 | LLM 走 `ai.enodot.shop`,需网络+额度;建议 mock |
| A3 | RAG 入库+问答 | `POST /api/rag/documents/text` 入库→`GET /api/rag/documents/jobs/{id}` 轮询→`POST /api/rag/chat` | 命中+引用 | 默认 `HashEmbeddingModel` 召回≈0(F06/F07):E2E 需接真实嵌入或断言"关键词路命中" |
| A4 | Adaptive RAG | `POST /api/rag/adaptive/chat` | strategy/rounds | 改写深度有限(F12) |
| A5 | ReAct + 工具治理 | `POST /api/agent/chat`(高风险工具→`confirmedTools`) | reactTrace / 治理结果 | "人工确认"可被客户端自助绕过(F01) |
| A6 | 记忆 | `POST /api/memory/write`→`GET /api/memory/user/{uid}` | 写入/检索 | 无鉴权,userId 客户端任填(F02 IDOR) |
| A7 | 运行时改模型 | `POST /api/chat/model-config` | 切换 provider | **未鉴权即可改全局 LLM/baseURL/key**(前端审计新发现)——记为高危,E2E 必须断言"应需鉴权" |

### 6.3 前后端联调

| # | 场景 | 预期 |
| --- | --- | --- |
| F1 | agent-frontend(5173,base→11010) 发一句话 | 流式回答渲染、引用展示、Stop 可中断 |
| F2 | agent-frontend 设置页:入库文档→问答引用到该文档 | 端到端 RAG 闭环 |
| F3 | chat-frontend(5273,base→10010/api/v1) 登录→发消息 | Mock 兜底关掉后打通真实网关(目前 chat-frontend 用 Mock,见 layout 记忆) |
| F4 | 跨域 | 浏览器无 CORS 报错(E2E 放行 5173/5273) |

### 6.4 跨系统(未来 · 统一身份后)

agent 与 chat **当前是两套独立鉴权**(chat 网关只代理 `/api/v1/**`,不覆盖 agent 的 `/agent,/memory,/rag`)。统一身份落地后补:同一 JWT 在两后端都被信任、userId 由认证主体派生。**这是 E2E 的将来增量,不在首版。**

---

## 7. 健康检查 / 冒烟

已有脚本可直接用:
```bash
~/projecta-runtime/check-runtime.sh   # 中间件:3307/5432/6379/8848/9092 + DB/Redis/Kafka/pgvector 探活
~/projecta-runtime/check-apps.sh      # 应用端口 + pidfile + /actuator/health
```
建议补一个 `e2e-smoke.sh`:对 §6 的 A1/C2/A2 各打一发并断言 HTTP 2xx + 关键字段,作为「环境就绪」门禁。

---

## 8. 清理 / 复位 / 数据隔离

- 裸进程:`~/projecta-runtime/stop-apps.sh all`;清数据 = drop `*_e2e` 库后重跑 §3.3。
- Docker:`make e2e-down`(`docker compose down -v`)一键销毁卷,天然干净。
- **强烈建议 E2E 用独立库/卷**,不要碰开发数据(MariaDB:3307 上的 `InfiniteChat`/`agent` 当前是开发库)。

---

## 9. 与既有审计/规划的衔接

- 本文是 `docs/planning/` 规划套件的一员,聚焦「跑得起来、验得了」。安全/功能缺陷的完整清单见 `docs/planning/01-improvement-audit.md`,各子项目改造见 `10/20/30/40-*-plan.md`,总体架构见 `00-master-plan.md`。
- E2E 里暴露的阻断项(JWT 不验签 C2、无鉴权改模型 A7、IDOR A6)与总体规划的 **P0 统一鉴权** 工作项是同一批,E2E 用例正好作为这些修复的回归门禁。

---

## 10. 待你确认(open questions)

1. **权威栈二选一:** 走**轨道一(裸进程,立即可用)**还是**轨道二(Docker,可复现)**作为首版 E2E?能否把现有「旧 jar」Docker 栈的 compose 发我,在其上改造(而非重写)?
2. **docker 权限:** 是否同意执行 `sudo usermod -aG docker hanwen` 解锁 Docker 轨?
3. **源码同步:** WSL 上 E2E 用 `rsync 到 ~/projecta-current` 还是直接构建 `/mnt/e/jhw/proj`?
4. **外呼策略:** E2E 默认**离线 mock**(LLM/邮件/COS 都打桩)还是允许打真实 `ai.enodot.shop`/Resend/腾讯云(耗额度+受 198.18 代理影响)?
5. **数据隔离:** 是否新建 `InfiniteChat_e2e`/`agent_e2e` 独立库?
6. **缺陷用例口径:** C2(JWT 不验签)、A6/A7(无鉴权)这类「当前一定失败」的安全用例,首版是标 `xfail`(记录但不阻断)还是直接作为 P0 阻断门禁?

---

## 11. 评审记录(你填,我据此重写本文)

> 在此写下你的审核意见(可逐条对应上面的 §编号)。我会把意见消化进正文,并在这里留一行变更摘要。

| 日期 | 评审意见 | 处理 |
| --- | --- | --- |
| _待填_ | _待填_ | _待填_ |

---

### 附录 A:端口冲突速查

| 端口 | 裸进程 A | Docker B(现跑) | 权威 E2E 取 |
| ---: | --- | --- | --- |
| agent | 11010 | **10011** | **11010** |
| gateway | 10010 | 10010 | 10010 |
| MariaDB | 3307 | 13307 | 3307(对内) |
| Redis | 6379 | 6380 | 6379(对内) |
| PgVector | 5432 | 5433 | 5432(对内) |

> 启动权威栈前务必停掉另一套,避免用例打到错误实例。
