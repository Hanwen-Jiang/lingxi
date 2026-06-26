package com.lou.infinitechatagent.ratelimit;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.lou.infinitechatagent.common.BaseResponse;
import com.lou.infinitechatagent.security.AuthPrincipal;
import com.lou.infinitechatagent.security.GatewayIdentityFilter;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;
import org.springframework.web.servlet.HandlerInterceptor;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.ConcurrentHashMap;

/**
 * LLM 计费端点按主体限流(L9/G08)。固定窗口计数,键 = 网关身份 userId(在场)否则客户端 IP。
 * 超限返回 HTTP 429 + 统一包络 {@code code=42900}(契约 §3 RATE_LIMITED)+ {@code Retry-After}。
 *
 * <p>限流码用字面量 42900(不动 agent {@code ErrorCode} 枚举——错误码归一待 S3 chat-common,§10)。
 * 进程内计数(单实例);多实例/精确清理后续改 Redis 令牌桶。
 */
@Component
@Slf4j
public class RateLimitInterceptor implements HandlerInterceptor {

    /** 契约 §3:42900 = RATE_LIMITED = HTTP 429。 */
    private static final int RATE_LIMITED_CODE = 42900;
    private static final ObjectMapper OBJECT_MAPPER = new ObjectMapper();

    private final boolean enabled;
    private final int capacity;
    private final long windowMillis;
    private final ConcurrentHashMap<String, Window> windows = new ConcurrentHashMap<>();

    public RateLimitInterceptor(
            @Value("${agent.ratelimit.llm.enabled:true}") boolean enabled,
            @Value("${agent.ratelimit.llm.capacity:30}") int capacity,
            @Value("${agent.ratelimit.llm.window-seconds:60}") long windowSeconds) {
        this.enabled = enabled;
        this.capacity = Math.max(1, capacity);
        this.windowMillis = Math.max(1, windowSeconds) * 1000L;
    }

    @Override
    public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler) throws IOException {
        if (!enabled) {
            return true;
        }
        long now = System.currentTimeMillis();
        Window window = windows.compute(subjectKey(request), (key, existing) -> {
            if (existing == null || now - existing.windowStart >= windowMillis) {
                return new Window(now);
            }
            existing.count++;
            return existing;
        });
        if (window.count > capacity) {
            long retryAfterSeconds = Math.max(1, (windowMillis - (now - window.windowStart)) / 1000);
            writeTooManyRequests(request, response, retryAfterSeconds);
            return false;
        }
        return true;
    }

    private String subjectKey(HttpServletRequest request) {
        Object principal = request.getAttribute(GatewayIdentityFilter.PRINCIPAL_ATTRIBUTE);
        if (principal instanceof AuthPrincipal authPrincipal && authPrincipal.isPresent()) {
            return "u:" + authPrincipal.userId();
        }
        return "ip:" + clientIp(request);
    }

    private static String clientIp(HttpServletRequest request) {
        String forwarded = request.getHeader("X-Forwarded-For");
        if (StringUtils.hasText(forwarded)) {
            int comma = forwarded.indexOf(',');
            return (comma > 0 ? forwarded.substring(0, comma) : forwarded).trim();
        }
        return request.getRemoteAddr();
    }

    private void writeTooManyRequests(HttpServletRequest request, HttpServletResponse response, long retryAfterSeconds)
            throws IOException {
        log.warn("[ratelimit] 计费端点限流: {} {} subject={}", request.getMethod(), request.getRequestURI(), subjectKey(request));
        response.setStatus(HttpStatus.TOO_MANY_REQUESTS.value());
        response.setHeader(HttpHeaders.RETRY_AFTER, Long.toString(retryAfterSeconds));
        response.setContentType(MediaType.APPLICATION_JSON_VALUE);
        response.setCharacterEncoding(StandardCharsets.UTF_8.name());
        BaseResponse<Void> body = new BaseResponse<>(RATE_LIMITED_CODE, null, "请求过于频繁,请稍后再试");
        response.getWriter().write(OBJECT_MAPPER.writeValueAsString(body));
    }

    private static final class Window {
        private final long windowStart;
        private int count;

        private Window(long windowStart) {
            this.windowStart = windowStart;
            this.count = 1;
        }
    }
}
