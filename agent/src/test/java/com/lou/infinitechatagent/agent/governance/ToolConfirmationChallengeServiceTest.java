package com.lou.infinitechatagent.agent.governance;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.data.redis.core.StringRedisTemplate;

import java.lang.reflect.Field;
import java.util.Collections;
import java.util.Iterator;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * F01 挑战令牌纯逻辑测试(内存降级路径,无 Redis、无 Mockito → 可 forkCount=0 跑)。
 */
class ToolConfirmationChallengeServiceTest {

    /** 无 Redis bean 的 provider(getIfAvailable→null),触发进程内内存兜底。 */
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

    private static ToolConfirmationChallengeService newService(long ttlSeconds, boolean failClosed) {
        ToolConfirmationChallengeService service = new ToolConfirmationChallengeService(noRedis());
        setField(service, "ttlSeconds", ttlSeconds);
        setField(service, "failClosedOnStoreError", failClosed);
        return service;
    }

    private static void setField(Object target, String name, Object value) {
        try {
            Field field = target.getClass().getDeclaredField(name);
            field.setAccessible(true);
            field.set(target, value);
        } catch (ReflectiveOperationException e) {
            throw new RuntimeException(e);
        }
    }

    @Test
    void issueThenConsume_onceOnly_inMemoryFallback() {
        ToolConfirmationChallengeService service = newService(300, false);
        String token = service.issueChallenge(1001L, 2002L, "email_send");
        assertThat(token).isNotBlank();

        // 指纹匹配 → 放行;一次性消费后再用同 token → 拒。
        assertThat(service.consume(token, 1001L, 2002L, "email_send")).isTrue();
        assertThat(service.consume(token, 1001L, 2002L, "email_send")).isFalse();
    }

    @Test
    void consume_rejectsForgedToolNameAndCrossUser() {
        ToolConfirmationChallengeService service = newService(300, false);
        String token = service.issueChallenge(1001L, 2002L, "email_send");

        // 工具名不是令牌:旧伪造手法(把工具名塞进去)无效。
        assertThat(service.consume("email_send", 1001L, 2002L, "email_send")).isFalse();
        // 他人无法用别人的会话指纹消费(指纹不符)。
        assertThat(service.consume(token, 9999L, 2002L, "email_send")).isFalse();
        // 不同工具指纹不符。
        assertThat(service.consume(token, 1001L, 2002L, "sql_exec")).isFalse();
        // 原 token 仍可被正确指纹消费(上面错误尝试不应误删 —— 见实现:内存路径只在 remove 后校验指纹)。
        // 注:错误指纹尝试会 remove 该 token(一次性、防探测),因此此处应为 false。
        assertThat(service.consume(token, 1001L, 2002L, "email_send")).isFalse();
    }

    @Test
    void consume_nullOrUnknownToken_returnsFalse() {
        ToolConfirmationChallengeService service = newService(300, false);
        assertThat(service.consume(null, 1L, 2L, "email_send")).isFalse();
        assertThat(service.consume("", 1L, 2L, "email_send")).isFalse();
        assertThat(service.consume("nonexistent-token", 1L, 2L, "email_send")).isFalse();
    }

    @Test
    void expiredToken_returnsFalse() {
        ToolConfirmationChallengeService service = newService(-5, false); // 负 ttl → 过期时刻在过去,确定性过期
        String token = service.issueChallenge(1L, 2L, "email_send");
        assertThat(service.consume(token, 1L, 2L, "email_send")).isFalse();
    }

    @Test
    void failClosed_withoutRedis_issuesNull() {
        ToolConfirmationChallengeService service = newService(300, true);
        // fail-closed 且无 Redis → 拒绝签发(调用方据 null 拒绝高风险工具)。
        assertThat(service.issueChallenge(1L, 2L, "email_send")).isNull();
    }
}
