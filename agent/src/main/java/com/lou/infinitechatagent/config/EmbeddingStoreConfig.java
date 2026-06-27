package com.lou.infinitechatagent.config;

import dev.langchain4j.data.segment.TextSegment;
import dev.langchain4j.store.embedding.EmbeddingStore;
import dev.langchain4j.store.embedding.inmemory.InMemoryEmbeddingStore;
import dev.langchain4j.store.embedding.pgvector.PgVectorEmbeddingStore;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
@RequiredArgsConstructor
@Slf4j
public class EmbeddingStoreConfig {

    @Value("${pgvector.host}")
    private String host;

    @Value("${pgvector.port}")
    private int port;

    @Value("${pgvector.database}")
    private String database;

    @Value("${pgvector.user}")
    private String user;

    @Value("${pgvector.password}")
    private String password;

    @Value("${pgvector.table}")
    private String table;

    @Value("${pgvector.dimension:1024}")
    private int dimension;

    @Value("${agent.local-fallback.enabled:true}")
    private boolean localFallbackEnabled;

    @Bean
    public EmbeddingStore<TextSegment> initEmbeddingStore() {
        try {
            return PgVectorEmbeddingStore.builder()
                    .table(table)
                    .dropTableFirst(false)
                    .createTable(true)
                    .host(host)
                    .port(port)
                    .user(user)
                    .password(password)
                    .dimension(dimension)
                    .database(database)
                    .build();
        } catch (RuntimeException e) {
            if (!localFallbackEnabled) {
                throw e;
            }
            log.warn("RAG Vector - PGVector is unavailable, using local in-memory embedding store: {}", e.getMessage());
            return new InMemoryEmbeddingStore<>();
        }
    }
}
