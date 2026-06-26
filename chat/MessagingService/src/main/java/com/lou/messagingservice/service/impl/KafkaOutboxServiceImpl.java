package com.lou.messagingservice.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.lou.messagingservice.constants.MessageOutboxStatus;
import com.lou.messagingservice.mapper.MessageOutboxMapper;
import com.lou.messagingservice.model.MessageOutbox;
import com.lou.messagingservice.service.KafkaOutboxService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.apache.commons.lang3.StringUtils;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.util.Arrays;
import java.util.Date;
import java.util.List;

@Service
@RequiredArgsConstructor
@Slf4j
public class KafkaOutboxServiceImpl implements KafkaOutboxService {

    private static final int DEFAULT_MAX_ERROR_LENGTH = 500;

    private final MessageOutboxMapper messageOutboxMapper;

    private final KafkaTemplate<String, String> kafkaTemplate;

    @Value("${message.outbox.max-retry-count:10}")
    private int maxRetryCount;

    @Value("${message.outbox.retry-batch-size:100}")
    private int retryBatchSize;

    @Value("${message.outbox.pending-timeout-millis:30000}")
    private long pendingTimeoutMillis;

    @Value("${message.outbox.retry-delay-millis:10000}")
    private long retryDelayMillis;

    @Override
    public void saveAndSend(Long messageId, String topic, String messageKey, String payload) {
        Date now = new Date();
        MessageOutbox outbox = new MessageOutbox()
                .setMessageId(messageId)
                .setTopic(topic)
                .setMessageKey(messageKey)
                .setPayload(payload)
                .setStatus(MessageOutboxStatus.INIT)
                .setRetryCount(0)
                .setNextRetryAt(now)
                .setCreatedAt(now)
                .setUpdatedAt(now);

        messageOutboxMapper.insert(outbox);
        sendOutboxMessage(outbox);
    }

    @Override
    @Scheduled(fixedDelayString = "${message.outbox.retry-fixed-delay:10000}")
    public void retryUnsentMessages() {
        Date now = new Date();
        Date pendingExpiredAt = new Date(now.getTime() - pendingTimeoutMillis);

        LambdaQueryWrapper<MessageOutbox> wrapper = new LambdaQueryWrapper<MessageOutbox>()
                .in(MessageOutbox::getStatus, Arrays.asList(
                        MessageOutboxStatus.INIT,
                        MessageOutboxStatus.FAILED,
                        MessageOutboxStatus.PENDING
                ))
                .lt(MessageOutbox::getRetryCount, maxRetryCount)
                .and(query -> query
                        .le(MessageOutbox::getNextRetryAt, now)
                        .or()
                        .and(pending -> pending
                                .eq(MessageOutbox::getStatus, MessageOutboxStatus.PENDING)
                                .le(MessageOutbox::getUpdatedAt, pendingExpiredAt)))
                .orderByAsc(MessageOutbox::getCreatedAt)
                .last("limit " + retryBatchSize);

        List<MessageOutbox> outboxMessages = messageOutboxMapper.selectList(wrapper);
        for (MessageOutbox outboxMessage : outboxMessages) {
            sendOutboxMessage(outboxMessage);
        }
    }

    private void sendOutboxMessage(MessageOutbox outbox) {
        markPending(outbox);
        try {
            kafkaTemplate.send(outbox.getTopic(), outbox.getMessageKey(), outbox.getPayload())
                    .addCallback(result -> markSent(outbox.getId()),
                            ex -> markFailed(outbox.getId(), ex));
        } catch (Exception ex) {
            markFailed(outbox.getId(), ex);
        }
    }

    private void markPending(MessageOutbox outbox) {
        Date now = new Date();
        Date nextRetryAt = new Date(now.getTime() + pendingTimeoutMillis);
        MessageOutbox update = new MessageOutbox()
                .setId(outbox.getId())
                .setStatus(MessageOutboxStatus.PENDING)
                .setRetryCount(outbox.getRetryCount() == null ? 1 : outbox.getRetryCount() + 1)
                .setNextRetryAt(nextRetryAt)
                .setUpdatedAt(now);

        messageOutboxMapper.updateById(update);
        outbox.setRetryCount(update.getRetryCount());
        outbox.setNextRetryAt(nextRetryAt);
    }

    private void markSent(Long id) {
        Date now = new Date();
        MessageOutbox update = new MessageOutbox()
                .setId(id)
                .setStatus(MessageOutboxStatus.SENT)
                .setLastError(null)
                .setUpdatedAt(now);

        messageOutboxMapper.updateById(update);
        log.info("Kafka outbox消息发送成功, outboxId: {}", id);
    }

    private void markFailed(Long id, Throwable ex) {
        MessageOutbox current = messageOutboxMapper.selectById(id);
        if (current == null || MessageOutboxStatus.SENT.equals(current.getStatus())) {
            return;
        }

        Date now = new Date();
        MessageOutbox update = new MessageOutbox()
                .setId(id)
                .setStatus(MessageOutboxStatus.FAILED)
                .setNextRetryAt(new Date(now.getTime() + retryDelayMillis))
                .setLastError(shortError(ex))
                .setUpdatedAt(now);

        messageOutboxMapper.updateById(update);
        log.error("Kafka outbox消息发送失败, outboxId: {}, error: {}", id, ex.getMessage());
    }

    private String shortError(Throwable ex) {
        String message = ex == null ? "unknown kafka error" : ex.getMessage();
        if (StringUtils.isBlank(message)) {
            message = ex.getClass().getSimpleName();
        }
        return StringUtils.left(message, DEFAULT_MAX_ERROR_LENGTH);
    }
}
