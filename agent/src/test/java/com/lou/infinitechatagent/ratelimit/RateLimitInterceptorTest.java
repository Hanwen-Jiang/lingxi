package com.lou.infinitechatagent.ratelimit;

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

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class RateLimitInterceptorTest {

    /** 无 Redis bean(getIfAvailable→null)→ 走进程内固定窗口兜底,验证降级路径。 */
    private static ObjectProvider<StringRedisTemplate> noRedis() {
        return new ObjectProvider<>() {
            @Override
            public StringRedisTemplate getObject(Object... args) {
                throw new IllegalStateException("no redis bean");
            }

            @Override
            public StringRedisTemplate getObject() {
                throw new IllegalStateException("no redis bean");
            }

            @Override
            public StringRedisTemplate getIfAvailable() {
                return null;
            }

            @Override
            public StringRedisTemplate getIfUnique() {
                return null;
            }

            @Override
            public Iterator<StringRedisTemplate> iterator() {
                return Collections.emptyIterator();
            }
        };
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
        RateLimitInterceptor interceptor = new RateLimitInterceptor(true, 3, 60, noRedis());
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
    }

    @Test
    void distinctSubjectsHaveIndependentBuckets() throws Exception {
        RateLimitInterceptor interceptor = new RateLimitInterceptor(true, 1, 60, noRedis());

        assertThat(interceptor.preHandle(requestFromIp("1.1.1.1"), mock(HttpServletResponse.class), new Object())).isTrue();
        assertThat(interceptor.preHandle(requestFromIp("2.2.2.2"), mock(HttpServletResponse.class), new Object())).isTrue();

        HttpServletResponse res = mock(HttpServletResponse.class);
        when(res.getWriter()).thenReturn(new PrintWriter(new StringWriter()));
        // 同一 IP 第二次超过 capacity=1
        assertThat(interceptor.preHandle(requestFromIp("1.1.1.1"), res, new Object())).isFalse();
    }

    @Test
    void disabledAlwaysAllows() throws Exception {
        RateLimitInterceptor interceptor = new RateLimitInterceptor(false, 1, 60, noRedis());
        HttpServletRequest req = requestFromIp("9.9.9.9");
        assertThat(interceptor.preHandle(req, mock(HttpServletResponse.class), new Object())).isTrue();
        assertThat(interceptor.preHandle(req, mock(HttpServletResponse.class), new Object())).isTrue();
    }
}
