ALTER TABLE red_packet_receive
ADD UNIQUE KEY uk_red_packet_receiver (red_packet_id, receiver_id);

ALTER TABLE balance_log
ADD UNIQUE KEY uk_balance_related_type_user (related_id, type, user_id);

ALTER TABLE red_packet
ADD COLUMN expire_at DATETIME NOT NULL,
ADD KEY idx_status_expire_at (status, expire_at);
