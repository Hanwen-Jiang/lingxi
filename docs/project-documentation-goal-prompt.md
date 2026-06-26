# 可用于 Goal 模式的项目文档重写 Prompt

下面这段可以直接复制给 Goal 模式使用。

---

## Prompt

请在当前工作区中重写 `./agent` 和 `./chat` 两个项目的结构说明文档，产物放到新的 v2 目录，不要覆盖旧文档：

```text
agent/docs/project-structure-v2/
chat/docs/project-structure-v2/
```

目标不是机械扫描类名、字段、注解和方法，而是写出真正能帮助新人理解项目的“业务语义型逐文件文档”。请先阅读并严格遵守这份设计稿：

```text
/Users/haven/Documents/code/projecta/docs/project-documentation-redesign-spec.md
```

## 必须完成的工作

### 1. 先复盘和建模

在写文档前，先基于当前工作树建立项目地图：

- 读取根 `pom.xml`、各模块 `pom.xml`。
- 读取 `application.yml`、核心 Controller、核心 ServiceImpl、Mapper/XML、DTO、Entity/Model、Exception、Config。
- 梳理每个项目的模块划分、核心业务链路、接口清单、数据对象和外部依赖。
- 不要只依赖正则扫描；必须结合源码调用关系理解业务语义。

### 2. 文档目录要求

`agent` 文档目录建议：

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

`chat` 文档目录建议：

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

可以根据真实项目结构微调文件名，但必须保持“先总览、后分模块、逐文件”的结构。

### 3. 覆盖范围

纳入：

- 根目录工程文件。
- `src/main/java`。
- `src/main/resources`。
- `src/test/java`。
- 既有 docs、scripts、SQL、Mapper XML、静态页面等项目内有效文件。

排除：

- `target/`。
- `.git/`。
- `.idea/`。
- `.settings/`。
- `.mvn/`。
- `.DS_Store`。
- `__pycache__/`。
- `.pyc` / `.pyo`。
- 新生成的 `project-structure-v2/` 目录自身。

### 4. 每个文档必须先总后分

每个分类文档必须包含：

```text
总体说明
模块/分类定位
核心业务链路图
文件树
逐文件说明
```

### 5. 每个文件必须用正确模板写

不要所有文件套同一个模板。按文件类型写重点：

#### Controller

必须写：

- 类级路径。
- 每个接口的 HTTP 方法。
- 完整路径。
- 请求参数或请求体。
- 返回类型和返回格式。
- 调用的 Service / Orchestrator。
- 业务调用链。
- 异常和统一响应格式。

禁止只写：

```text
HTTP Controller，暴露 REST 接口并将请求转交给对应业务服务。
```

#### DTO / Request / Response / VO

必须写：

- JSON 示例。
- 字段含义表。
- 是否必填或可空。
- 被哪个接口接收或返回。
- 流向哪个 Service 或前端。

#### Service / ServiceImpl

必须写：

- 所在业务链路。
- 核心方法表。
- 关键业务流程图。
- 读写哪些表、Redis、Kafka、外部 HTTP、LLM 或其他组件。
- 状态变化和副作用。
- 失败分支。

#### Mapper / XML

必须写：

- 对应表或实体。
- SQL id / 方法。
- 查询条件。
- 返回数据。
- 被哪些 Service 调用。

#### Entity / Model

必须写：

- 映射表或业务对象。
- 主键。
- 字段含义。
- 状态字段含义。
- 被哪些 Mapper/Service/Response 使用。

#### Config / YAML

必须写：

- 关键配置项。
- 默认值。
- 影响的模块。
- 外部依赖，例如 MySQL、Redis、Nacos、Kafka、LLM、COS、邮件服务。

#### Exception

必须写：

- 表示什么失败场景。
- 由哪里抛出。
- 由哪里处理。
- 最终响应格式。

#### Enum / Constant

必须写：

- 每个枚举值或常量的含义。
- code/value 是什么。
- 被哪里使用。

尤其是 `ErrorCode` 这类文件，核心就是错误码总表，不能只写“枚举类型”。

### 6. 特别要求：统一响应体系必须写清分层

`BaseResponse`、`ResultUtils`、`ErrorCode` 必须按以下结构解释：

```text
Controller / GlobalExceptionHandler       调用层
└── ResultUtils                           构造层：统一创建响应
    ├── success(data)                     成功分支
    └── error(ErrorCode)                  失败分支
        └── ErrorCode                     语义层：定义错误类型、错误码、默认文案
            ↓
        BaseResponse<T>                   协议底座：最终 JSON 外壳 {code,data,message}
```

并分别说明：

- `BaseResponse<T>` 是最底层统一响应协议。
- `ErrorCode` 是失败语义层，必须遍历错误码。
- `ResultUtils` 是上层构造门面。

### 7. 禁止事项

不要让这些内容成为主要文档：

- Lombok 注解，例如 `@Data`、`@Builder`、`@NoArgsConstructor`。
- getter/setter。
- 构造函数。
- `equals/hashCode/toString`。
- `this()` 这类误识别方法。
- 枚举项伪方法，例如 `PARAMS_ERROR()`。
- “这个类属于某模块，核心字段包括...” 这种无业务语义的模板话。

这些内容最多只能放在最后的“技术结构”里，而且不是每个文件都必须写。

### 8. 质量验收

完成前必须执行检查，并在最终回复中报告结果：

- 每个纳入文件都有独立 section。
- 每个分类文档先总后分。
- 每个 Controller 都有接口表和业务调用链。
- 每个 DTO 都有 JSON 示例和字段含义。
- 每个核心 ServiceImpl 都有业务流程和副作用说明。
- 每个 Mapper/XML 都有表/SQL/调用方说明。
- 每个枚举都列出枚举值和含义。
- 配置文件列出关键配置、默认值和影响模块。
- 异常文件说明抛出位置、处理位置、最终响应。
- 不出现 `this()`、枚举项伪方法等扫描噪音。
- 不出现“HTTP Controller，暴露 REST 接口”这类空话模板。
- 至少抽查以下内容并展示摘要：
  - `agent` 的统一响应体系。
  - `agent` 的 `AgentController` 或 `MemoryController`。
  - `agent` 的一个核心 ServiceImpl。
  - `chat` 的 `GateWay` 路由。
  - `chat` 的 `MessagingService` 消息发送链路。
  - `chat` 的 `RealTimeCommunicationService` WebSocket/ACK 链路。

### 9. 最终输出

最终回复请包含：

- 新文档入口路径。
- 覆盖文件数量。
- 主要分类文档列表。
- 质量验收结果。
- 如果发现旧文档生成器质量不足，不要继续沿用旧生成器的模板；可以写新的辅助脚本，但脚本生成内容必须符合本 prompt 的业务语义要求。
```
