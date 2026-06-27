package com.lou.messagingservice.service;

import com.lou.messagingservice.model.Message;

public interface KafkaOutboxService {

    void saveAndSend(Long messageId, String topic, String messageKey, String payload);

    /**
     * B4:在同一本地事务内写 message 表 + message_outbox,Kafka 发布延后到事务提交后(M8)。
     * 使"消息已持久化"与"Kafka 是否已消费"解耦——离线消费者由此降为幂等投影。
     */
    void persistMessageAndOutbox(Message message, Long messageId, String topic, String messageKey, String payload);

    void retryUnsentMessages();
}
