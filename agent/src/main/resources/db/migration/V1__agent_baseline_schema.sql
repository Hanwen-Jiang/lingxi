-- ============================================================================
-- V1 · agent 元数据 / 记忆 / 审计 基线 schema(MySQL,库:agent;D6 分库)
-- ----------------------------------------------------------------------------
-- 来源:此前由各 *SchemaInitializer 在启动时以 `create table if not exists` 程序化建表
--      (MemorySchemaInitializer / ToolGovernanceSchemaInitializer / RagSchemaInitializer)。
-- 本迁移把它们版本化为 Flyway 基线(M16:现零 DDL → 版本化)。
-- 仅在 FLYWAY_ENABLED=true 且连到真实 MySQL `agent` 库时执行;baseline-on-migrate
-- 让既有库基线到 V1(跳过本脚本),全新库则执行本脚本建表。
-- 全部使用 IF NOT EXISTS,与仍存在的 SchemaInitializer 幂等共存(退役见 db/README.md)。
-- PgVector 向量表(Postgres)不在此 —— 见 db/pgvector/。
-- ============================================================================

-- 会话摘要
create table if not exists session_summary (
    id bigint primary key auto_increment,
    user_id bigint not null,
    session_id bigint not null,
    summary text not null,
    turn_count int not null default 0,
    last_message_at datetime null,
    created_at timestamp default current_timestamp,
    updated_at timestamp default current_timestamp on update current_timestamp,
    unique key uk_session_summary (user_id, session_id),
    key idx_session_summary_user (user_id),
    key idx_session_summary_session (session_id)
) engine=InnoDB default charset=utf8mb4;

-- 长期用户记忆(含反思 REFLECTION)
create table if not exists agent_memory (
    id bigint primary key auto_increment,
    memory_id varchar(128) not null unique,
    user_id bigint not null,
    session_id bigint null,
    memory_type varchar(64) not null,
    content text not null,
    summary varchar(512) null,
    confidence double not null default 0.8,
    source varchar(64) not null,
    status varchar(32) not null default 'ACTIVE',
    expires_at datetime null,
    created_at timestamp default current_timestamp,
    updated_at timestamp default current_timestamp on update current_timestamp,
    key idx_agent_memory_user_type (user_id, memory_type),
    key idx_agent_memory_session (session_id),
    key idx_agent_memory_status (status)
) engine=InnoDB default charset=utf8mb4;

-- 工具治理审计
create table if not exists agent_tool_audit (
    id bigint primary key auto_increment,
    user_id bigint null,
    session_id bigint null,
    tool_name varchar(128) not null,
    action_type varchar(64) not null,
    risk_level varchar(32) not null,
    decision varchar(32) not null,
    reason varchar(512) null,
    prompt_snippet varchar(512) null,
    created_at timestamp default current_timestamp,
    key idx_tool_audit_user_session (user_id, session_id),
    key idx_tool_audit_tool (tool_name),
    key idx_tool_audit_decision (decision)
) engine=InnoDB default charset=utf8mb4;

-- RAG 文档元数据
create table if not exists rag_document (
    id bigint primary key auto_increment,
    doc_id varchar(64) not null unique,
    file_name varchar(255) not null,
    file_path varchar(512),
    source_type varchar(64),
    content_hash varchar(64),
    created_at timestamp default current_timestamp,
    updated_at timestamp default current_timestamp on update current_timestamp
) engine=InnoDB default charset=utf8mb4;

-- RAG 切片元数据(embedding_id 指向 PgVector 中的向量行)
create table if not exists rag_chunk (
    id bigint primary key auto_increment,
    chunk_id varchar(64) not null unique,
    doc_id varchar(64) not null,
    file_name varchar(255) not null,
    chunk_index int not null,
    section_title varchar(255),
    heading_path varchar(512),
    chunk_type varchar(64),
    page_number int,
    char_count int,
    token_estimate int,
    content text not null,
    embedding_id varchar(128),
    created_at timestamp default current_timestamp,
    key idx_rag_chunk_doc_id (doc_id),
    key idx_rag_chunk_embedding_id (embedding_id)
) engine=InnoDB default charset=utf8mb4;
