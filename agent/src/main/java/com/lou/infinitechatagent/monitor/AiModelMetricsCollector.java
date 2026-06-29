package com.lou.infinitechatagent.monitor;

import java.time.Duration;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentMap;

import io.micrometer.core.instrument.Counter;
import io.micrometer.core.instrument.MeterRegistry;
import io.micrometer.core.instrument.Timer;
import jakarta.annotation.Resource;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

/**
 * LLM 调用指标采集(运行态可观测,P9 收尾)。
 *
 * <p><b>低基数原则</b>:指标标签只用<b>有界维度</b>(模型名 + 状态 / token 类型 / 错误类型)。
 * <b>不</b>按 {@code userId}/{@code sessionId}/原始 errorMessage 打标签——那些是无界维度,会让时间序列
 * 随用户与会话无限膨胀(Prometheus 撑爆 + 本进程缓存泄漏)。用户/会话维度走结构化日志,不进指标。
 */
@Component
@Slf4j
public class AiModelMetricsCollector {

    @Resource
    private MeterRegistry meterRegistry;

    // 缓存已创建的指标,避免重复创建(键为有界维度组合,缓存规模有界)
    private final ConcurrentMap<String, Counter> requestCountersCache = new ConcurrentHashMap<>();
    private final ConcurrentMap<String, Counter> errorCountersCache = new ConcurrentHashMap<>();
    private final ConcurrentMap<String, Counter> tokenCountersCache = new ConcurrentHashMap<>();
    private final ConcurrentMap<String, Timer> responseTimersCache = new ConcurrentHashMap<>();

    private static String safe(String v) {
        return (v == null || v.isBlank()) ? "unknown" : v;
    }

    /** 记录请求次数。tags: model_name, status(started|success|error)。 */
    public void recordRequest(String modelName, String status) {
        String model = safe(modelName);
        String safeStatus = safe(status);
        String key = model + "_" + safeStatus;
        requestCountersCache.computeIfAbsent(key, k ->
                Counter.builder("ai_model_requests_total")
                        .description("LLM 请求次数")
                        .tag("model_name", model)
                        .tag("status", safeStatus)
                        .register(meterRegistry)
        ).increment();
    }

    /** 记录错误次数。tags: model_name, error_type(异常类名,有界)。 */
    public void recordError(String modelName, String errorType) {
        String model = safe(modelName);
        String type = safe(errorType);
        String key = model + "_" + type;
        errorCountersCache.computeIfAbsent(key, k ->
                Counter.builder("ai_model_errors_total")
                        .description("LLM 错误次数")
                        .tag("model_name", model)
                        .tag("error_type", type)
                        .register(meterRegistry)
        ).increment();
    }

    /** 记录 Token 消耗。tags: model_name, token_type(input|output|total)。 */
    public void recordTokenUsage(String modelName, String tokenType, long tokenCount) {
        String model = safe(modelName);
        String type = safe(tokenType);
        String key = model + "_" + type;
        tokenCountersCache.computeIfAbsent(key, k ->
                Counter.builder("ai_model_tokens_total")
                        .description("LLM Token 消耗总数")
                        .tag("model_name", model)
                        .tag("token_type", type)
                        .register(meterRegistry)
        ).increment(tokenCount);
    }

    /** 记录响应时间。tag: model_name。 */
    public void recordResponseTime(String modelName, Duration duration) {
        String model = safe(modelName);
        responseTimersCache.computeIfAbsent(model, k ->
                Timer.builder("ai_model_response_duration_seconds")
                        .description("LLM 响应时间")
                        .tag("model_name", model)
                        .register(meterRegistry)
        ).record(duration);
    }
}
