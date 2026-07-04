package com.lou.realtimecommunicationservice.websocket;

import com.lou.realtimecommunicationservice.model.PendingAckMessage;
import io.netty.channel.Channel;
import io.netty.channel.ChannelFuture;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.data.redis.core.HashOperations;
import org.springframework.data.redis.core.StringRedisTemplate;

import java.util.LinkedHashMap;
import java.util.Map;
import java.util.concurrent.TimeUnit;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

/**
 * M5:实时待确认态持久化的单元测试。纯 Mockito(在 WSL/CI 跑),无需 Spring 上下文与真 Redis。
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class AckMessageManagerTest {

    @Mock
    private StringRedisTemplate redisTemplate;

    @Mock
    private HashOperations<String, Object, Object> hashOps;

    private PendingAckMessage pending(String ackId, String userId) {
        return new PendingAckMessage()
                .setAckId(ackId)
                .setReceiveUserId(userId)
                .setFrameText("{\"type\":2,\"msgUuid\":\"" + ackId + "\"}")
                .setRetryCount(0)
                .setLastSendTime(System.currentTimeMillis());
    }

    // ---- 纯逻辑:ackId -> userId 反解 ----

    @Test
    void userIdFromAckId_parsesSecondSegment() {
        assertEquals("12345", AckMessageManager.userIdFromAckId("2:12345:987654321"));
        assertEquals("777", AckMessageManager.userIdFromAckId("4:777:abcdefabcdef"));
    }

    @Test
    void userIdFromAckId_nullOrMalformed_returnsNull() {
        assertNull(AckMessageManager.userIdFromAckId(null));
        assertNull(AckMessageManager.userIdFromAckId("nocolons"));
        assertNull(AckMessageManager.userIdFromAckId("2::abc")); // 空 userId
    }

    // ---- durable 关闭:与历史实现等价,零 Redis 访问(回归护栏)----

    @Test
    void durableDisabled_neverTouchesRedis() {
        AckMessageManager m = new AckMessageManager();
        m.configureForTest(redisTemplate, false, 1440, 200, 3, 5000);

        m.addPending(pending("2:12345:987654321", "12345"));
        assertEquals(1, m.pendingSizeForTest());
        assertTrue(m.ack("2:12345:987654321"));
        assertEquals(0, m.pendingSizeForTest());
        m.removeByUserId("12345");

        verifyNoInteractions(redisTemplate);
    }

    // ---- durable 打开:写穿 Redis ----

    @Test
    void durableEnabled_addPending_writesThroughWithTtl() {
        when(redisTemplate.opsForHash()).thenReturn(hashOps);
        AckMessageManager m = new AckMessageManager();
        m.configureForTest(redisTemplate, true, 1440, 200, 3, 5000);

        String ackId = "2:12345:987654321";
        m.addPending(pending(ackId, "12345"));

        verify(hashOps).put(eq("user:pending:12345"), eq(ackId), anyString());
        verify(redisTemplate).expire(eq("user:pending:12345"), eq(1440L), eq(TimeUnit.MINUTES));
    }

    @Test
    void durableEnabled_ack_deletesFromRedis() {
        when(redisTemplate.opsForHash()).thenReturn(hashOps);
        AckMessageManager m = new AckMessageManager();
        m.configureForTest(redisTemplate, true, 1440, 200, 3, 5000);

        String ackId = "2:12345:987654321";
        m.addPending(pending(ackId, "12345"));
        assertTrue(m.ack(ackId));

        verify(hashOps).delete("user:pending:12345", ackId);
    }

    @Test
    void durableEnabled_ackAfterColdRestart_parsesUserIdAndCleansRedis() {
        when(redisTemplate.opsForHash()).thenReturn(hashOps);
        AckMessageManager m = new AckMessageManager();
        m.configureForTest(redisTemplate, true, 1440, 200, 3, 5000);

        // 内存里没有(模拟崩溃后新节点),ack 仍应按 ackId 反解 userId 清 Redis。
        String ackId = "2:777:abcdefabcdef";
        assertFalse(m.ack(ackId));
        verify(hashOps).delete("user:pending:777", ackId);
    }

    @Test
    void durableEnabled_removeByUserId_deletesWholeHash() {
        when(redisTemplate.opsForHash()).thenReturn(hashOps);
        AckMessageManager m = new AckMessageManager();
        m.configureForTest(redisTemplate, true, 1440, 200, 3, 5000);

        m.addPending(pending("2:12345:1", "12345"));
        m.removeByUserId("12345");

        verify(redisTemplate).delete("user:pending:12345");
    }

    // ---- 重连补投:从 Redis 载入 -> 重推 + 重挂内存 ----

    @Test
    void redeliverPending_pushesStoredMessagesAndRearms() {
        String ackId = "2:12345:987654321";
        PendingAckMessage stored = pending(ackId, "12345");
        Map<Object, Object> hash = new LinkedHashMap<>();
        hash.put(ackId, cn.hutool.json.JSONUtil.toJsonStr(stored));

        when(redisTemplate.opsForHash()).thenReturn(hashOps);
        when(hashOps.entries("user:pending:12345")).thenReturn(hash);

        Channel channel = mock(Channel.class);
        when(channel.isActive()).thenReturn(true);
        when(channel.writeAndFlush(any())).thenReturn(mock(ChannelFuture.class, invocation -> {
            // addListener(...) 返回自身即可,监听器不执行。
            if (invocation.getMethod().getName().equals("addListener")) {
                return invocation.getMock();
            }
            return null;
        }));

        AckMessageManager m = new AckMessageManager();
        m.configureForTest(redisTemplate, true, 1440, 200, 3, 5000);
        m.redeliverPending("12345", channel);

        verify(channel).writeAndFlush(any());
        assertEquals(1, m.pendingSizeForTest());
    }

    @Test
    void redeliverPending_durableDisabled_noop() {
        Channel channel = mock(Channel.class);
        lenient().when(channel.isActive()).thenReturn(true);

        AckMessageManager m = new AckMessageManager();
        m.configureForTest(redisTemplate, false, 1440, 200, 3, 5000);
        m.redeliverPending("12345", channel);

        assertEquals(0, m.pendingSizeForTest());
        verifyNoInteractions(redisTemplate);
        verify(channel, never()).writeAndFlush(any());
    }
}
