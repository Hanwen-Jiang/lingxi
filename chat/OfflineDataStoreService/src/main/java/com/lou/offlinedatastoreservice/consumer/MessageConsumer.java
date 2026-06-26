package com.lou.offlinedatastoreservice.consumer;


import com.lou.offlinedatastoreservice.constants.kafka.KafkaConstants;
import com.lou.offlinedatastoreservice.service.MessageService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
@Slf4j
public class MessageConsumer {

    @Autowired
    private MessageService messageService;

    @KafkaListener(topics = KafkaConstants.topic, groupId = KafkaConstants.consumerGroupId)
    public void listen(String message) {
        messageService.saveOfflineMessage(message);
    }
}
