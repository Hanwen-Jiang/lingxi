# 项目结构文档重写设计稿

**总体说明：** 这份设计稿用于重写 `./agent` 和 `./chat` 的项目结构说明文档。它不是继续沿用“扫描类名、字段、注解、方法列表”的自动化堆料方式，而是把每个文件放回真实业务链路中解释：这个文件在系统中解决什么问题、对外暴露什么契约、依赖谁、被谁调用、运行时产生什么结果、排查问题时应该看什么。

---

## 1. 为什么之前文档写得很差

### 1.1 根本原因

之前文档的生成逻辑把“文件结构扫描结果”误当成“项目介绍”。它主要做了这些低价值动作：

```text
读取 Java 文件
├── 提取 class 名
├── 提取注解
├── 提取字段
├── 提取方法名
└── 拼成通用模板
```

这会导致文档看起来覆盖了很多文件，但实际没有回答读者最关心的问题：

```text
这个文件在系统里干什么？
这个接口怎么调？
入参和返回长什么样？
这个类处于哪一层？
它调用谁？
谁调用它？
失败时怎么返回？
它在核心业务链路中扮演什么角色？
排查问题时应该重点看哪里？
```

### 1.2 具体失败模式

#### 失败模式 A：把技术噪音当重点

例如 DTO 文档写成：

```text
主要注解：@Data、@NoArgsConstructor
关键方法：this()
```

这是错误的。对 DTO 来说，重点应该是：

```text
JSON 格式是什么？
字段分别代表什么？
哪些字段必填？
哪些字段用于 debug？
这个 DTO 出现在什么接口或服务返回中？
```

#### 失败模式 B：没有写分层关系

例如 `BaseResponse / ResultUtils / ErrorCode`，原文档把它们写成三个孤立文件，没有说明真实层次。

正确理解应该是：

```text
Controller / GlobalExceptionHandler       调用层
└── ResultUtils                           构造层：统一创建响应
    ├── success(data)                     成功分支
    └── error(ErrorCode)                  失败分支
        └── ErrorCode                     语义层：定义错误类型、错误码、默认文案
            ↓
        BaseResponse<T>                   协议底座：最终 JSON 外壳 {code,data,message}
```

所以文档应优先讲“层次和数据流”，而不是简单列字段。

#### 失败模式 C：Controller 没写接口文档

Controller 的重点不是：

```text
HTTP Controller，暴露 REST 接口并将请求转交给对应业务服务。
```

这句话几乎没有信息量。

Controller 应写：

```text
类级路径
每个接口的 HTTP 方法
完整路径
请求参数 / 请求体
返回类型
调用哪个 Service
业务调用链
异常和响应格式
典型用途
```

#### 失败模式 D：Service 没写业务流程

Service 文档如果只写：

```text
关键方法：write(), correct(), disable()
```

仍然不够。

Service 应写：

```text
这个 Service 是哪条业务链路的核心？
它维护什么状态？
它读写哪些表或外部组件？
主要方法的业务顺序是什么？
关键分支是什么？
失败时怎么处理？
和 Controller / Mapper / DTO 的关系是什么？
```

#### 失败模式 E：Mapper / XML 没写表和 SQL 语义

Mapper 文档不能只写“负责 CRUD”。应该写：

```text
对应哪张表？
有哪些自定义 SQL？
被哪些 Service 调用？
查询结果用于哪个接口返回？
哪些字段是状态字段、关系字段、时间字段？
```

#### 失败模式 F：没有按文件类型使用不同模板

不同文件的重点完全不同：

| 文件类型 | 应该写的重点 |
| --- | --- |
| Controller | 接口契约、路径、入参、返回、调用链 |
| Request/Response DTO | JSON 结构、字段含义、出现位置 |
| Service | 业务流程、状态变化、依赖组件、失败分支 |
| Mapper/XML | 表、SQL、查询语义、调用方 |
| Entity/Model | 表结构映射、字段业务含义、状态字段 |
| Config/YAML | 配置项、默认值、影响的运行行为 |
| Exception | 何时抛出、如何被全局处理、返回什么 |
| Utils | 输入输出、封装的外部能力、被谁使用 |
| Test | 验证目标、覆盖场景、缺口 |

之前生成器对所有 Java 文件使用同一套“注解/字段/方法”模板，所以必然写差。

#### 失败模式 G：覆盖率被误当成质量

“176 个文件都有 section”只能证明没有漏文件，不能证明文档有用。

新的验收必须同时检查：

```text
是否覆盖文件
是否讲清业务角色
是否讲清调用关系
是否讲清输入输出
是否讲清运行时行为
是否避免低价值注解/方法噪音
是否能帮助新人定位问题
```

---

## 2. 新文档的目标

### 2.1 文档目标

重写后的文档要让一个不了解项目的人可以做到：

1. 从总览看懂系统由哪些模块组成。
2. 从链路图看懂请求如何流转。
3. 从 Controller 文档知道每个接口怎么调。
4. 从 DTO 文档知道 JSON 结构和字段含义。
5. 从 Service 文档知道核心业务流程。
6. 从 Mapper/XML 文档知道数据来自哪里、写到哪里。
7. 从配置文档知道服务运行依赖哪些环境变量和中间件。
8. 从测试文档知道当前验证了什么、没验证什么。

### 2.2 文档不追求什么

不追求机械列出所有注解。
不追求把每个 getter/setter、构造函数、Lombok 生成能力写出来。
不追求每个文件字数一样长。
不追求把源码逐行翻译成中文。
不追求看起来“很全”但读完不知道系统怎么跑。

---

## 3. 总体文档结构设计

### 3.1 顶层入口文档

入口文档命名：

```text
docs/project-structure/README.md
```

必须包含：

```text
项目一句话定位
模块总览图
核心业务链路图
文档阅读顺序
分类文档索引
文件覆盖范围
质量验收说明
```

### 3.2 分类文档

`agent` 项目建议分类：

```text
00-overview.md                         总览和核心链路
01-api-common-exception-guardrail.md   API、统一响应、异常、安全护轨
02-react-agent.md                      ReAct Agent、Planner、工具治理
03-memory-agent.md                     Memory Agent、长期记忆、摘要、反思
04-rag.md                              RAG、检索、重排、引用
05-adaptive-rag.md                     Adaptive RAG、检索计划、证据评估、改写
06-model-config-monitor.md             模型配置、AI Chat、监控
07-resources-docs-tests.md             资源、脚本、既有文档、测试
```

`chat` 项目建议按微服务分类：

```text
00-overview.md
01-gateway.md
02-authentication-service.md
03-contact-service.md
04-messaging-service.md
05-realtime-communication-service.md
06-offline-data-store-service.md
07-moment-service.md
08-root-config-tests.md
```

### 3.3 每个分类文档的结构

每个分类文档必须先总后分：

```text
# 分类标题

总体说明
├── 这个分类解决什么问题
├── 在系统中处于哪一层
├── 主要入口文件
├── 主要数据流
└── 读者应该先看哪些文件

模块内链路图

文件树

逐文件说明
```

---

## 4. 逐文件文档模板设计

### 4.1 Controller 模板

适用文件：`*Controller.java`

```markdown
### `path/to/XxxController.java`

**总体说明：**
这个 Controller 是什么业务入口，不要只写“暴露 REST 接口”。

**接口总览：**
- 类级路径：`/xxx`
- 主要调用对象：`SomeService`

| 方法 | 完整路径 | 入参 | 返回 | 作用 |
| --- | --- | --- | --- | --- |
| POST | `/xxx/action` | `XxxRequest` JSON | `XxxResponse` | 做什么 |

**请求/响应格式：**
```json
{
  "field": "value"
}
```

**业务调用链：**
```text
XxxController.method
├── 校验参数
├── 调用 xxxService.xxx()
├── 处理异常或状态
└── 返回 XxxResponse / BaseResponse
```

**异常与返回：**
- 参数错误：抛什么异常 / 返回什么 code
- 业务失败：怎么表达
- 成功：返回什么结构

**相关文件：**
- Request DTO
- Response DTO
- Service
- Exception
```

### 4.2 DTO 模板

适用文件：`*Request.java`、`*Response.java`、`*Result.java`、`*DTO.java`、`*VO.java`

```markdown
### `path/to/XxxRequest.java`

**总体说明：**
这个 DTO 是哪个接口/服务的入参或出参。

**JSON 结构：**
```json
{
  "userId": 1,
  "prompt": "..."
}
```

**字段含义：**
| 字段 | 类型 | 必填 | 含义 | 来源/去向 |
| --- | --- | --- | --- | --- |
| userId | Long | 是 | 用户 ID | Controller -> Service |

**使用位置：**
- 被哪个 Controller 接收
- 被哪个 Service 消费
- 出现在什么 debug 或响应字段中

**注意事项：**
- 默认值
- 可空字段
- 和其他 DTO 的关系
```

### 4.3 Service 模板

适用文件：`*Service.java`、`*ServiceImpl.java`

```markdown
### `path/to/XxxServiceImpl.java`

**总体说明：**
这个 Service 是哪条业务链路的核心，负责什么状态变化。

**所在链路：**
```text
Controller
└── XxxServiceImpl
    ├── Mapper / Redis / Kafka / LLM / 外部 HTTP
    └── Response DTO
```

**核心方法：**
| 方法 | 输入 | 输出 | 业务意义 |
| --- | --- | --- | --- |
| xxx | XxxRequest | XxxResponse | 做什么 |

**关键业务流程：**
```text
method()
├── 参数校验
├── 查询现有状态
├── 分支判断
├── 写入状态
├── 调用外部依赖
└── 返回结果
```

**状态和副作用：**
- 写数据库表
- 写 Redis
- 发 Kafka
- 调模型
- 调外部 HTTP

**失败分支：**
- 什么情况下抛异常
- 什么情况下返回空
- 什么情况下降级
```

### 4.4 Mapper / XML 模板

```markdown
### `path/to/XxxMapper.java` / `XxxMapper.xml`

**总体说明：**
这个 Mapper 访问哪张表，服务于哪个业务查询。

**数据表/实体：**
- 表：`xxx`
- 实体：`Xxx`

**SQL 能力：**
| 方法/SQL id | 类型 | 条件 | 返回 | 用途 |
| --- | --- | --- | --- | --- |

**调用方：**
- XxxServiceImpl.method()

**字段语义：**
- status：状态含义
- user_id：用户维度
- session_id：会话维度
```

### 4.5 Entity / Model 模板

```markdown
### `path/to/Xxx.java`

**总体说明：**
这个实体映射什么业务对象/数据库表。

**表/对象语义：**
- 表名：`xxx`
- 主键：`id`
- 生命周期：创建 -> 更新 -> 禁用/删除

**字段含义：**
| 字段 | 类型 | 含义 | 备注 |
| --- | --- | --- | --- |

**被谁使用：**
- Mapper
- Service
- Response DTO
```

### 4.6 Config / YAML 模板

```markdown
### `path/to/application.yml`

**总体说明：**
这个配置文件决定服务如何启动和连接外部依赖。

**关键配置：**
| 配置 | 默认值 | 作用 | 影响模块 |
| --- | --- | --- | --- |

**外部依赖：**
- MySQL
- Redis
- Nacos
- Kafka
- LLM

**运行影响：**
- 服务端口
- 超时
- token 预算
- 开关
```

### 4.7 Exception 模板

```markdown
### `path/to/XxxException.java`

**总体说明：**
这个异常表示什么失败场景。

**抛出位置：**
- 哪些 Service / Controller 会抛

**处理位置：**
- GlobalExceptionHandler 哪个方法处理

**最终响应：**
```json
{
  "code": 40000,
  "data": null,
  "message": "..."
}
```
```

---

## 5. 重写时必须遵守的质量规则

### 5.1 必须写业务语义

每个文件至少回答：

```text
它在系统里负责什么？
它在哪条链路上？
它的输入输出是什么？
它依赖谁？
谁会调用它？
```

### 5.2 禁止低价值内容占主导

以下内容只能放在“技术结构”末尾，不能当主内容：

```text
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Getter
@Setter
构造函数
getter/setter
toString/hashCode/equals
```

### 5.3 Controller 必须有接口表

每个 Controller 必须有：

```text
类级路径
方法路径
HTTP 方法
入参
返回
调用 Service
业务调用链
```

没有这些就不算完成。

### 5.4 DTO 必须有 JSON/字段表

每个 Request/Response/DTO/VO 必须有：

```text
JSON 形态
字段含义
使用位置
```

### 5.5 Service 必须有业务流程

每个核心 ServiceImpl 必须有：

```text
所在链路
核心方法表
流程图
副作用
失败分支
```

### 5.6 ErrorCode / 常量 / 枚举必须遍历枚举值

枚举文档重点是：

```text
每个枚举值代表什么
对应 code/value 是什么
被哪里使用
```

不能只写“枚举类型”。

### 5.7 允许详略不同

不是每个文件都要写很长。标准是：

```text
链路核心文件：详细写
DTO/枚举/实体：结构化写
空壳/测试启动类：简洁写
```

---

## 6. 重写流程

### 6.1 第一阶段：建立项目地图

先读取：

```text
pom.xml
application.yml
Controller
ServiceImpl
Mapper/XML
核心 DTO
README / docs
```

输出：

```text
模块划分
核心业务链路
接口清单
数据表/模型清单
外部依赖清单
```

### 6.2 第二阶段：按文件类型套用正确模板

不要所有文件一套模板。按文件类型选择模板。

### 6.3 第三阶段：写逐文件说明

每个文件都要先总后分：

```text
总体说明
接口/数据/流程重点
字段/方法/依赖细节
相关文件
技术结构
```

### 6.4 第四阶段：交叉校验

校验项目：

```text
文件是否全覆盖
Controller 是否都有接口表
DTO 是否都有 JSON/字段表
ServiceImpl 是否都有流程
枚举是否列出值
统一响应/异常是否写清层次
是否还有“主要注解/关键方法”喧宾夺主
是否还有 this() 这类伪方法
```

---

## 7. 验收标准

文档完成必须同时满足：

```text
[ ] 每个纳入文件都有独立 section
[ ] 每个分类文档先总后分
[ ] 每个 Controller 有接口表和业务调用链
[ ] 每个 DTO 有 JSON 示例和字段含义
[ ] 每个核心 ServiceImpl 有业务流程和副作用说明
[ ] 每个 Mapper/XML 有表/SQL/调用方说明
[ ] 每个枚举列出枚举值和含义
[ ] 配置文件列出关键配置、默认值和影响模块
[ ] 异常文件说明抛出位置、处理位置、最终响应
[ ] 文档不以 Lombok 注解、构造函数、getter/setter 作为重点
[ ] 不出现 `this()`、枚举项伪方法等扫描噪音
[ ] 不出现“HTTP Controller，暴露 REST 接口”这类空话模板
[ ] 至少抽查 3 个核心链路，能从入口一路读到 Service / Mapper / DTO
```

---

## 8. 推荐产物

### 8.1 agent 项目

```text
agent/docs/project-structure-v2/
├── README.md
├── 00-overview.md
├── 01-api-common-exception-guardrail.md
├── 02-react-agent.md
├── 03-memory-agent.md
├── 04-rag.md
├── 05-adaptive-rag.md
├── 06-model-config-monitor.md
├── 07-resources-docs-tests.md
└── coverage-manifest.json
```

### 8.2 chat 项目

```text
chat/docs/project-structure-v2/
├── README.md
├── 00-overview.md
├── 01-gateway.md
├── 02-authentication-service.md
├── 03-contact-service.md
├── 04-messaging-service.md
├── 05-realtime-communication-service.md
├── 06-offline-data-store-service.md
├── 07-moment-service.md
├── 08-root-config-tests.md
└── coverage-manifest.json
```

---

## 9. 重写原则一句话版

```text
不要写“这个类长什么样”，要写“这个文件在系统运行时如何参与业务”。
```
