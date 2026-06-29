package com.lou.infinitechatagent.ratelimit;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.lou.infinitechatagent.common.BaseResponse;
import com.lou.infinitechatagent.security.AuthPrincipal;
import com.lou.infinitechatagent.security.GatewayIdentityFilter;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.script.DefaultRedisScript;
import org.springframework.data.redis.core.script.RedisScript;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;
import org.springframework.web.servlet.HandlerInterceptor;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.concurrent.ConcurrentHashMap;

/**
 * LLM 计费端点按主体限流(L9/G08)。键 = 网关身份 userId(在场)否则客户端 IP。
 * 超限返回 HTTP 429 + 统一包络 {@code code=42900}(契约 §3 RATE_LIMITED)+ {@code Retry-After}。
 *
 * <p><b>多实例硬化(P6)</b>:首选 <b>Redis 令牌桶</b>(Lua 原子:刷新+取令牌一步完成,跨实例一致);
 * Redis bean 缺失或运行期异常时<b>降级进程内固定窗口</b>(单实例,优雅降级,与本工程既有降级一致)。
 * 令牌桶容量 = {@code capacity}(突发上限),稳态速率 = {@code capacity/window-seconds} 令牌/秒。
 *
 * <p>限流码用字面量 42900(不动 agent {@code ErrorCode} 枚举——错误码归一以 chat-common 为准,§10)。
 */
@Component
@Slf4j
public class RateLimitInterceptor implements HandlerInterceptor {

    /** 契约 §3:42900 = RATE_LIMITED = HTTP 429。 */
    private static final int RATE_LIMITED_CODE = 42900;
    private static final ObjectMapper OBJECT_MAPPER = new ObjectMapper();
    private static final String REDIS_KEY_PREFIX = "agent:ratelimit:llm:";

    /**
     * 令牌桶 Lua(原子,多实例一致)。KEYS[1]=bucket;ARGV=capacity, refillPerSec, nowMs, ttlMs。
     * 返回 1=放行 / 0=限流。按经过时间补充令牌(上限 capacity),取走 1 个则放行。
     */
    private static final String TOKEN_BUCKET_LUA =
            "local capacity = tonumber(ARGV[1])\n"
            + "local refill = tonumber(ARGV[2])\n"
            + "local now = tonumber(ARGV[3])\n"
            + "local ttl = tonumber(ARGV[4])\n"
            + "local tokens = tonumber(redis.call('hget', KEYS[1], 'tokens'))\n"
            + "local ts = tonumber(redis.call('hget', KEYS[1], 'ts'))\n"
            + "if tokens == nil then tokens = capacity; ts = now end\n"
            + "local elapsed = now - ts\n"
            + "if elapsed < 0 then elapsed = 0 end\n"
            + "tokens = math.min(capacity, tokens + (elapsed / 1000.0) * refill)\n"
            + "local allowed = 0\n"
            + "if tokens >= 1 then tokens = tokens - 1; allowed = 1 end\n"
            + "redis.call('hset', KEYS[1], 'tokens', tokens, 'ts', now)\n"
            + "redis.call('pexpire', KEYS[1], ttl)\n"
            + "return allowed\n";
    private static final RedisScript<Long> TOKEN_BUCKET_SCRIPT = new DefaultRedisScript<>(TOKEN_BUCKET_LUA, Long.class);

    private final boolean enabled;
    private final int capacity;
    private final long windowMillis;
    private final double refillPerSec;
    private final long retryAfterSeconds;
    private final ObjectProvider<StringRedisTemplate> redisTemplateProvider;

    /** 进程内固定窗口兜底(Redis 不可用时)。 */
    private final ConcurrentHashMap<String, Window> windows = new ConcurrentHashMap<>();

    public RateLimitInterceptor(
            @Value("${agent.ratelimit.llm.enabled:true}") boolean enabled,
            @Value("${agent.ratelimit.llm.capacity:30}") int capacity,
            @Value("${agent.ratelimit.llm.window-seconds:60}") long windowSeconds,
            ObjectProvider<StringRedisTemplate> redisTemplateProvider) {
        this.enabled = enabled;
        this.capacity = Math.max(1, capacity);
        long safeWindow = Math.max(1, windowSeconds);
        this.windowMillis = safeWindow * 1000L;
        this.refillPerSec = (double) this.capacity / safeWindow;
        this.retryAfterSeconds = Math.max(1, (long) Math.ceil(1.0 / this.refillPerSec));
        this.redisTemplateProvider = redisTemplateProvider;
    }

    @Override
    public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler) throws IOException {
        if (!enabled) {
            return true;
        }
        String key = subjectKey(request);
        Boolean redisAllowed = tryRedisTokenBucket(key);
        boolean allowed = redisAllowed != null ? redisAllowed : allowInProcess(key);
        if (!allowed) {
            writeTooManyRequests(request, response);
            return false;
        }
        return true;
    }

    /** Redis 令牌桶;Redis 不可用/异常返回 null(调用方降级进程内)。 */
    private Boolean tryRedisTokenBucket(String key) {
        StringRedisTemplate redis = redisTemplateProvider.getIfAvailable();
        if (redis == null) {
            return null;
        }
        try {
            Long allowed = redis.execute(
                    TOKEN_BUCKET_SCRIPT,
                    List.of(REDIS_KEY_PREFIX + key),
                    Integer.toString(capacity),
                    Double.toString(refillPerSec),
                    Long.toString(System.currentTimeMillis()),
                    Long.toString(windowMillis * 2));
            return allowed != null && allowed == 1L;
        } catch (RuntimeException e) {
            log.warn("[ratelimit] Redis 令牌桶失败,降级进程内固定窗口: {}", e.getMessage());
            return null;
        }
    }

    private boolean allowInProcess(String key) {
        long now = System.currentTimeMillis();
        Window window = windows.compute(key, (k, existing) -> {
            if (existing == null || now - existing.windowStart >= windowMillis) {
                return new Window(now);
            }
            existing.count++;
            return existing;
        });
        return window.count <= capacity;
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

    private void writeTooManyRequests(HttpServletRequest request, HttpServletResponse response) throws IOException {
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
