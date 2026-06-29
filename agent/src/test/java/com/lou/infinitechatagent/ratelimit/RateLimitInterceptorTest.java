package com.lou.infinitechatagent.ratelimit;

import io.micrometer.core.instrument.MeterRegistry;
import io.micrometer.core.instrument.simple.SimpleMeterRegistry;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;

import java.io.PrintWriter;
import java.io.StringWriter;
import java.util.Collections;
import java.util.Iterator;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class RateLimitInterceptorTest {

    /** 通用 ObjectProvider 桩:value 为 null 时 getIfAvailable→null(模拟 bean 缺失/降级路径)。 */
    private static <T> ObjectProvider<T> provider(T value) {
        return new ObjectProvider<>() {
            @Override
            public T getObject(Object... args) {
                if (value == null) throw new IllegalStateException("no bean");
                return value;
            }

            @Override
            public T getObject() {
                if (value == null) throw new IllegalStateException("no bean");
                return value;
            }

            @Override
            public T getIfAvailable() {
                return value;
            }

            @Override
            public T getIfUnique() {
                return value;
            }

            @Override
            public Iterator<T> iterator() {
                return value == null ? Collections.emptyIterator() : List.of(value).iterator();
            }
        };
    }

    /** 无 Redis bean → 走进程内固定窗口兜底,验证降级路径。 */
    private static ObjectProvider<StringRedisTemplate> noRedis() {
        return provider((StringRedisTemplate) null);
    }

    /** 无 MeterRegistry → 计数 no-op(不影响限流逻辑)。 */
    private static ObjectProvider<MeterRegistry> noMeter() {
        return provider((MeterRegistry) null);
    }

    private HttpServletRequest requestFromIp(String ip) {
        HttpServletRequest req = mock(HttpServletRequest.class);
        when(req.getRemoteAddr()).thenReturn(ip);
        when(req.getMethod()).thenReturn("POST");
        when(req.getRequestURI()).thenReturn("/api/chat");
        return req;
    }

    @Test
    void underCapacityAllowed_thenBlockedWith429AndContractCode() throws Exception {
        SimpleMeterRegistry registry = new SimpleMeterRegistry();
        RateLimitInterceptor interceptor = new RateLimitInterceptor(true, 3, 60, noRedis(), provider(registry));
        HttpServletRequest req = requestFromIp("10.0.0.1");

        for (int i = 0; i < 3; i++) {
            assertThat(interceptor.preHandle(req, mock(HttpServletResponse.class), new Object())).isTrue();
        }

        HttpServletResponse res = mock(HttpServletResponse.class);
        StringWriter body = new StringWriter();
        when(res.getWriter()).thenReturn(new PrintWriter(body));

        assertThat(interceptor.preHandle(req, res, new Object())).isFalse();
        verify(res).setStatus(HttpStatus.TOO_MANY_REQUESTS.value());
        verify(res).setHeader(eq(HttpHeaders.RETRY_AFTER), anyString());
        assertThat(body.toString()).contains("42900");

        // 可观测(P8):限流决策计数随放行/限流分标签累加
        assertThat(registry.get("agent.ratelimit.decisions")
                .tags("result", "allowed", "backend", "in_process").counter().count()).isEqualTo(3.0);
        assertThat(registry.get("agent.ratelimit.decisions")
                .tags("result", "blocked", "backend", "in_process").counter().count()).isEqualTo(1.0);
    }

    @Test
    void distinctSubjectsHaveIndependentBuckets() throws Exception {
        RateLimitInterceptor interceptor = new RateLimitInterceptor(true, 1, 60, noRedis(), noMeter());

        assertThat(interceptor.preHandle(requestFromIp("1.1.1.1"), mock(HttpServletResponse.class), new Object())).isTrue();
        assertThat(interceptor.preHandle(requestFromIp("2.2.2.2"), mock(HttpServletResponse.class), new Object())).isTrue();

        HttpServletResponse res = mock(HttpServletResponse.class);
        when(res.getWriter()).thenReturn(new PrintWriter(new StringWriter()));
        // 同一 IP 第二次超过 capacity=1
        assertThat(interceptor.preHandle(requestFromIp("1.1.1.1"), res, new Object())).isFalse();
    }

    @Test
    void disabledAlwaysAllows() throws Exception {
        RateLimitInterceptor interceptor = new RateLimitInterceptor(false, 1, 60, noRedis(), noMeter());
        HttpServletRequest req = requestFromIp("9.9.9.9");
        assertThat(interceptor.preHandle(req, mock(HttpServletResponse.class), new Object())).isTrue();
        assertThat(interceptor.preHandle(req, mock(HttpServletResponse.class), new Object())).isTrue();
    }
}
