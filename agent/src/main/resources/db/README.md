# 数据库迁移(Flyway)· agent-backend

agent 与 chat **分库**(D6):agent 自有 `agent`(MySQL)+ `dp`(PostgreSQL/PgVector),不共享表、无跨栈外键。本目录把此前"零 DDL"的 schema 版本化(M16)。

## 布局

| 路径 | 目标库 | 谁来执行 |
| --- | --- | --- |
| `db/migration/` | MySQL `agent`(主 `spring.datasource`) | **Flyway**(`FLYWAY_ENABLED=true` 时);`spring.flyway.locations=classpath:db/migration` |
| `db/pgvector/` | PostgreSQL `dp`(向量) | 当前由 **langchain4j** `PgVectorEmbeddingStore.createTable(true)` 在启动时自动建表;此 SQL 为版本化事实来源,留待将来挂独立 Postgres Flyway 数据源 |

> `db/pgvector/` 故意放在 `db/migration/` 之外,避免 MySQL 那条 Flyway 链去执行 Postgres 语法。

## 默认关闭(重要)

`spring.flyway.enabled=${FLYWAY_ENABLED:false}` —— **默认关闭**,原因:

- 本应用只有一个 `DataSource`(`RagJdbcConfig.ragDataSource`,Spring Boot 自动 DataSource 因 `@ConditionalOnMissingBean` 退避),它在 MySQL 不可用时**降级 H2**(`MODE=MySQL`)。
- 基线脚本是 MySQL 方言(`engine=InnoDB` 等),在 H2 上会失败。
- 因此 Flyway 仅应在**连得到真实 `agent` MySQL 库**时开启(如 docker-compose / 生产)。本地无中间件起服务时保持默认关闭,沿用 H2 降级路径,启动不受影响。

启用方式:`FLYWAY_ENABLED=true`(并确保 `MYSQL_URL/USERNAME/PASSWORD` 指向可达的 `agent` 库)。
`baseline-on-migrate=true` + `baseline-version=1`:既有库(已被 SchemaInitializer 建过表)会被基线到 V1 并跳过 `V1`;全新空库则执行 `V1` 建表。

## 与 SchemaInitializer 的关系(共存,退役待对齐)

`MemorySchemaInitializer` / `ToolGovernanceSchemaInitializer` / `RagSchemaInitializer` 仍在 `@PostConstruct` 用 `create table if not exists` 幂等建表。`V1` 同样使用 `IF NOT EXISTS`,两者**安全共存**:

- Flyway 关闭(本地 H2):仍由 SchemaInitializer 建表,行为与改造前一致。
- Flyway 开启(真实 MySQL):Flyway 先建,SchemaInitializer 随后 `if not exists` 全部 no-op。

> 退役 SchemaInitializer、改为 Flyway 单一所有权,是 **P1 跟进项**,需与 S3 的 `chat-common` Flyway 约定对齐后统一执行(见 STATUS 待中枢确认)。
