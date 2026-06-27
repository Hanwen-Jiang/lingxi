package com.lou.offlinedatastoreservice.config;

import lombok.extern.slf4j.Slf4j;
import org.apache.kafka.clients.admin.NewTopic;
import org.apache.kafka.common.serialization.StringDeserializer;
import org.springframework.boot.autoconfigure.kafka.KafkaProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.kafka.config.ConcurrentKafkaListenerContainerFactory;
import org.springframework.kafka.config.TopicBuilder;
import org.springframework.kafka.core.ConsumerFactory;
import org.springframework.kafka.core.DefaultKafkaConsumerFactory;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.kafka.listener.DeadLetterPublishingRecoverer;
import org.springframework.kafka.listener.DefaultErrorHandler;
import org.springframework.kafka.support.serializer.DeserializationException;
import org.springframework.kafka.support.serializer.ErrorHandlingDeserializer;
import org.springframework.util.backoff.FixedBackOff;

import java.util.Map;
import java.util.concurrent.atomic.AtomicLong;

/**
 * B5:Kafka 消费者可靠性配置。
 * <ul>
 *   <li>{@link ErrorHandlingDeserializer} 包裹 {@link StringDeserializer}:反序列化异常不毒化分区,转入错误处理。</li>
 *   <li>{@link DefaultErrorHandler} + {@link DeadLetterPublishingRecoverer}:重试耗尽/不可重试异常 → 死信主题 {@code <topic>.DLT},不阻塞分区。</li>
 *   <li>并发对齐分区数(3),提升消费吞吐。</li>
 *   <li>每条进入 DLT 的消息 ERROR 级告警 + 累计深度计数(可被日志采集/告警平台捕获)。</li>
 * </ul>
 * 本 @Bean(consumerFactory / kafkaListenerContainerFactory)覆盖 Spring Boot 自动装配的同名 bean,
 * 现有 {@code @KafkaListener}(未指定 containerFactory)自动改用本工厂,无需改监听器。
 */
@Slf4j
@Configuration
public class KafkaConsumerConfig {

    public static final String TOPIC = "thousands_word_message";
    public static final String DLT_TOPIC = TOPIC + ".DLT";

    /** DLT 累计深度(进程内)。真正的 lag/depth 监控属 L3 可观测(Micrometer/actuator),此处提供日志级告警信号。 */
    private final AtomicLong dltDepth = new AtomicLong();

    /** 显式声明 DLT 主题,避免 broker 关闭自动建 topic 时死信无处可投。 */
    @Bean
    public NewTopic messageDltTopic() {
        return TopicBuilder.name(DLT_TOPIC).partitions(3).replicas(1).build();
    }

    @Bean
    public ConsumerFactory<String, String> consumerFactory(KafkaProperties properties) {
        Map<String, Object> props = properties.buildConsumerProperties();
        // 直接注入 ErrorHandlingDeserializer 实例(委托 StringDeserializer),无需 trusted packages。
        return new DefaultKafkaConsumerFactory<>(
                props,
                new ErrorHandlingDeserializer<>(new StringDeserializer()),
                new ErrorHandlingDeserializer<>(new StringDeserializer()));
    }

    @Bean
    public DefaultErrorHandler kafkaErrorHandler(KafkaTemplate<Object, Object> kafkaTemplate) {
        DeadLetterPublishingRecoverer recoverer = new DeadLetterPublishingRecoverer(kafkaTemplate);
        // 重试 3 次、间隔 1s,仍失败才进 DLT(DB 抖动等瞬时故障可自愈,不立即死信)。
        DefaultErrorHandler handler = new DefaultErrorHandler((record, ex) -> {
            recoverer.accept(record, ex);
            long depth = dltDepth.incrementAndGet();
            log.error("[KAFKA-DLQ-ALARM] 消息进入死信 DLT={} 累计深度={} 源 topic={} partition={} offset={} err={}",
                    DLT_TOPIC, depth, record.topic(), record.partition(), record.offset(), ex.getMessage(), ex);
        }, new FixedBackOff(1000L, 3L));
        // 反序列化异常不可重试,直接进 DLT(避免无意义的重试占用分区)。
        handler.addNotRetryableExceptions(DeserializationException.class);
        return handler;
    }

    @Bean
    public ConcurrentKafkaListenerContainerFactory<String, String> kafkaListenerContainerFactory(
            ConsumerFactory<String, String> consumerFactory, DefaultErrorHandler kafkaErrorHandler) {
        ConcurrentKafkaListenerContainerFactory<String, String> factory =
                new ConcurrentKafkaListenerContainerFactory<>();
        factory.setConsumerFactory(consumerFactory);
        factory.setCommonErrorHandler(kafkaErrorHandler);
        factory.setConcurrency(3);
        return factory;
    }
}
