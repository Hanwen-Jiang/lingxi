CREATE TABLE IF NOT EXISTS message_outbox (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    message_id BIGINT NOT NULL,
    topic VARCHAR(128) NOT NULL,
    message_key VARCHAR(128) NOT NULL,
    payload TEXT NOT NULL,
    status TINYINT NOT NULL COMMENT '0 INIT, 1 PENDING, 2 SENT, 3 FAILED',
    retry_count INT NOT NULL DEFAULT 0,
    next_retry_at DATETIME NOT NULL,
    last_error VARCHAR(500) NULL,
    created_at DATETIME NOT NULL,
    updated_at DATETIME NOT NULL,
    UNIQUE KEY uk_message_id (message_id),
    KEY idx_status_next_retry (status, next_retry_at),
    KEY idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
