package com.lou.messagingservice.service;

public interface KafkaOutboxService {

    void saveAndSend(Long messageId, String topic, String messageKey, String payload);

    void retryUnsentMessages();
}
