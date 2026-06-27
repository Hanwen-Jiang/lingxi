package com.lou.messagingservice.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.lou.messagingservice.constants.MessageOutboxStatus;
import com.lou.messagingservice.mapper.MessageMapper;
import com.lou.messagingservice.mapper.MessageOutboxMapper;
import com.lou.messagingservice.model.Message;
import com.lou.messagingservice.model.MessageOutbox;
import com.lou.messagingservice.service.KafkaOutboxService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.apache.commons.lang3.StringUtils;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import java.util.Arrays;
import java.util.Date;
import java.util.List;

@Service
@RequiredArgsConstructor
@Slf4j
public class KafkaOutboxServiceImpl implements KafkaOutboxService {

    private static final int DEFAULT_MAX_ERROR_LENGTH = 500;

    private final MessageMapper messageMapper;

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
    @Transactional(rollbackFor = Exception.class)
    public void persistMessageAndOutbox(Message message, Long messageId, String topic, String messageKey, String payload) {
        // B4: message 与 outbox 同一本地事务落库——持久化即"消息已存在",与 Kafka 消费解耦。
        messageMapper.insert(message);

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

        // M8: 发布延后到事务提交后,避免"提交前发布"导致消费者读到尚未提交/已回滚的消息。
        // 提交后发布失败也无妨——记录仍为 INIT,由 @Scheduled relay 补偿。
        publishAfterCommit(outbox);
    }

    /** 事务提交后再发 Kafka;无活动事务时(理论不应发生)立即发送兜底。 */
    private void publishAfterCommit(MessageOutbox outbox) {
        if (TransactionSynchronizationManager.isSynchronizationActive()) {
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override
                public void afterCommit() {
                    sendOutboxMessage(outbox);
                }
            });
        } else {
            sendOutboxMessage(outbox);
        }
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
            // M8: 仅"重试路径"才自增 retryCount(首发经 persistMessageAndOutbox/afterCommit 不计数)。
            bumpRetryCount(outboxMessage);
            sendOutboxMessage(outboxMessage);
        }
    }

    private void sendOutboxMessage(MessageOutbox outbox) {
        markInFlight(outbox);
        try {
            kafkaTemplate.send(outbox.getTopic(), outbox.getMessageKey(), outbox.getPayload())
                    .addCallback(result -> markSent(outbox.getId()),
                            ex -> markFailed(outbox.getId(), ex));
        } catch (Exception ex) {
            markFailed(outbox.getId(), ex);
        }
    }

    /** 标记在途(PENDING)+ 设置 pending 超时;M8:不在此自增 retryCount。 */
    private void markInFlight(MessageOutbox outbox) {
        Date now = new Date();
        Date nextRetryAt = new Date(now.getTime() + pendingTimeoutMillis);
        MessageOutbox update = new MessageOutbox()
                .setId(outbox.getId())
                .setStatus(MessageOutboxStatus.PENDING)
                .setNextRetryAt(nextRetryAt)
                .setUpdatedAt(now);

        messageOutboxMapper.updateById(update);
        outbox.setNextRetryAt(nextRetryAt);
    }

    /** M8:每次重试尝试自增一次 retryCount(首发不计),配合 lt(retryCount, maxRetryCount) 限流。 */
    private void bumpRetryCount(MessageOutbox outbox) {
        int next = (outbox.getRetryCount() == null ? 0 : outbox.getRetryCount()) + 1;
        MessageOutbox update = new MessageOutbox()
                .setId(outbox.getId())
                .setRetryCount(next)
                .setUpdatedAt(new Date());
        messageOutboxMapper.updateById(update);
        outbox.setRetryCount(next);
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
