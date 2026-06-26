package com.lou.infinitechatagent.config;

import javax.sql.DataSource;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;

import java.sql.Connection;
import java.sql.SQLException;

@Configuration
@Slf4j
public class RagJdbcConfig {

    @Value("${spring.datasource.driver-class-name}")
    private String driverClassName;

    @Value("${spring.datasource.url}")
    private String url;

    @Value("${spring.datasource.username}")
    private String username;

    @Value("${spring.datasource.password}")
    private String password;

    @Value("${agent.local-fallback.enabled:true}")
    private boolean localFallbackEnabled;

    @Bean
    public DataSource ragDataSource() {
        DriverManagerDataSource dataSource = new DriverManagerDataSource();
        dataSource.setDriverClassName(driverClassName);
        dataSource.setUrl(url);
        dataSource.setUsername(username);
        dataSource.setPassword(password);
        if (canConnect(dataSource)) {
            return dataSource;
        }
        if (!localFallbackEnabled) {
            return dataSource;
        }
        log.warn("RAG JDBC - configured datasource is unavailable, using local H2 fallback for development");
        DriverManagerDataSource fallback = new DriverManagerDataSource();
        fallback.setDriverClassName("org.h2.Driver");
        fallback.setUrl("jdbc:h2:mem:infinitechat_agent;MODE=MySQL;DATABASE_TO_LOWER=TRUE;CASE_INSENSITIVE_IDENTIFIERS=TRUE;DB_CLOSE_DELAY=-1");
        fallback.setUsername("sa");
        fallback.setPassword("");
        return fallback;
    }

    private boolean canConnect(DataSource dataSource) {
        try (Connection ignored = dataSource.getConnection()) {
            return true;
        } catch (SQLException e) {
            log.warn("RAG JDBC - datasource connection failed: {}", e.getMessage());
            return false;
        }
    }

    public static boolean isH2(JdbcTemplate jdbcTemplate) {
        try (Connection connection = jdbcTemplate.getDataSource().getConnection()) {
            return "H2".equalsIgnoreCase(connection.getMetaData().getDatabaseProductName());
        } catch (Exception e) {
            return false;
        }
    }

    public static void createIndexIfMissing(JdbcTemplate jdbcTemplate, String tableName, String indexName, String columnName) {
        if (isH2(jdbcTemplate)) {
            jdbcTemplate.execute("create index if not exists " + indexName + " on " + tableName + "(" + columnName + ")");
            return;
        }
        Integer count = jdbcTemplate.queryForObject("""
                select count(1)
                from information_schema.statistics
                where table_schema = database()
                  and table_name = ?
                  and index_name = ?
                """, Integer.class, tableName, indexName);
        if (count != null && count > 0) {
            return;
        }
        jdbcTemplate.execute("create index " + indexName + " on " + tableName + "(" + columnName + ")");
    }

    public static void addColumnIfMissing(JdbcTemplate jdbcTemplate, String tableName, String columnName, String definition) {
        if (isH2(jdbcTemplate)) {
            jdbcTemplate.execute("alter table " + tableName + " add column if not exists " + columnName + " " + definition);
            return;
        }
        Integer count = jdbcTemplate.queryForObject("""
                select count(1)
                from information_schema.columns
                where table_schema = database()
                  and table_name = ?
                  and column_name = ?
                """, Integer.class, tableName, columnName);
        if (count != null && count > 0) {
            return;
        }
        jdbcTemplate.execute("alter table " + tableName + " add column " + columnName + " " + definition);
    }

    @Bean
    public JdbcTemplate ragJdbcTemplate(@Qualifier("ragDataSource") DataSource ragDataSource) {
        return new JdbcTemplate(ragDataSource);
    }
}
