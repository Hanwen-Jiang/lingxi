-- ============================================================================
-- V1 · PgVector 向量存储 schema(PostgreSQL,库:dp;表:dp_embedding)
-- ----------------------------------------------------------------------------
-- 注意:此脚本【不】由 MySQL 那条 Flyway 链执行(它在 classpath:db/migration 之外)。
-- 当前运行态由 langchain4j PgVectorEmbeddingStore(createTable(true))在启动时自动建表;
-- 本文件是该表结构的【版本化事实来源】,也便于将来挂一条独立的 Postgres Flyway 数据源。
--
-- 维度 1024 必须与 HashEmbeddingModel / 真实 EmbeddingModel(P2 接入)及
-- EmbeddingStoreConfig.dimension 保持一致;改维度需同步三处并重建表。
-- ============================================================================

-- pgvector 扩展(需 superuser 或已预装)
create extension if not exists vector;

-- langchain4j 默认列布局:embedding_id(uuid) / embedding(vector) / text / metadata(json)
create table if not exists dp_embedding (
    embedding_id uuid primary key,
    embedding    vector(1024),
    text         text,
    metadata     json
);

-- 召回性能优化(可选;数据量上来后再建,避免空表建索引)。
-- HNSW(pgvector >= 0.5):余弦距离
-- create index if not exists idx_dp_embedding_hnsw
--     on dp_embedding using hnsw (embedding vector_cosine_ops);
