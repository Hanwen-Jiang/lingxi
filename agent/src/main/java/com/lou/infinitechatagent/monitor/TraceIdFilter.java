package com.lou.infinitechatagent.monitor;

import com.lou.infinitechatagent.common.TraceContext;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.slf4j.MDC;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.UUID;

/**
 * 链路 id 过滤器(可观测性地基,D4 包络 traceId / 结构化日志):
 * 入口取 {@code X-Trace-Id}(无则生成),写入 {@link TraceContext} + SLF4J MDC(key {@code traceId})+ 响应头,出口清理。
 *
 * <p>最高优先级,确保后续过滤器(含 {@link com.lou.infinitechatagent.security.GatewayIdentityFilter} 的 401 响应)
 * 与所有 {@link com.lou.infinitechatagent.common.BaseResponse} 都能带上 traceId。完整 OTel 链路追踪为后续单元。
 */
@Component
@Order(Ordered.HIGHEST_PRECEDENCE)
public class TraceIdFilter extends OncePerRequestFilter {

    public static final String TRACE_ID_HEADER = "X-Trace-Id";
    public static final String MDC_KEY = "traceId";

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
            throws ServletException, IOException {
        String traceId = trimToNull(request.getHeader(TRACE_ID_HEADER));
        if (traceId == null) {
            traceId = UUID.randomUUID().toString().replace("-", "");
        }
        TraceContext.set(traceId);
        MDC.put(MDC_KEY, traceId);
        response.setHeader(TRACE_ID_HEADER, traceId);
        try {
            filterChain.doFilter(request, response);
        } finally {
            MDC.remove(MDC_KEY);
            TraceContext.clear();
        }
    }

    private static String trimToNull(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }
}
