package com.lou.infinitechatagent.monitor;

import io.micrometer.core.instrument.MeterRegistry;
import io.micrometer.core.instrument.Timer;
import org.aspectj.lang.ProceedingJoinPoint;
import org.aspectj.lang.annotation.Around;
import org.aspectj.lang.annotation.Aspect;
import org.springframework.stereotype.Component;

/**
 * RAG / 记忆调用指标切面(运行态可观测,P9 收尾)。零侵入业务逻辑:用 AOP 在服务入口
 * 计时 + 计数,得到<b>调用量、时延、错误率</b>。
 *
 * <p><b>低基数</b>:标签只用有界维度 {@code op} + {@code result(success|error)};
 * 不含 userId/sessionId/prompt 等无界维度(同 {@link AiModelMetricsCollector})。
 * <ul>
 *   <li>{@code agent_rag_query_duration_seconds{result}} —— RAG 带引用问答</li>
 *   <li>{@code agent_memory_op_duration_seconds{op,result}} —— 长期记忆写/纠错/检索</li>
 * </ul>
 * Timer 自带 {@code _count}(调用量)与 {@code _sum}(总耗时),按 {@code result} 切分即得错误率。
 */
@Aspect
@Component
public class AgentDomainMetricsAspect {

    private final MeterRegistry meterRegistry;

    public AgentDomainMetricsAspect(MeterRegistry meterRegistry) {
        this.meterRegistry = meterRegistry;
    }

    @Around("execution(* com.lou.infinitechatagent.rag.RagQueryService.chatWithCitations(..))")
    public Object aroundRagQuery(ProceedingJoinPoint pjp) throws Throwable {
        return timed(pjp, "agent.rag.query.duration", null);
    }

    @Around("execution(* com.lou.infinitechatagent.memory.LongTermMemoryService.write(..))"
            + " || execution(* com.lou.infinitechatagent.memory.LongTermMemoryService.writeWithDedup(..))"
            + " || execution(* com.lou.infinitechatagent.memory.LongTermMemoryService.correct(..))"
            + " || execution(* com.lou.infinitechatagent.memory.MemoryRetrievalService.retrieveRelevantMemories(..))")
    public Object aroundMemoryOp(ProceedingJoinPoint pjp) throws Throwable {
        return timed(pjp, "agent.memory.op.duration", pjp.getSignature().getName());
    }

    private Object timed(ProceedingJoinPoint pjp, String metric, String op) throws Throwable {
        Timer.Sample sample = Timer.start(meterRegistry);
        String result = "success";
        try {
            return pjp.proceed();
        } catch (Throwable t) {
            result = "error";
            throw t;
        } finally {
            Timer.Builder builder = Timer.builder(metric).tag("result", result);
            if (op != null) {
                builder.tag("op", op);
            }
            sample.stop(builder.register(meterRegistry));
        }
    }
}
