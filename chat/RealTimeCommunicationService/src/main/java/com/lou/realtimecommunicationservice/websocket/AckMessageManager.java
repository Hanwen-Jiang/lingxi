package com.lou.realtimecommunicationservice.websocket;

import cn.hutool.json.JSONUtil;
import com.lou.realtimecommunicationservice.model.PendingAckMessage;
import io.netty.channel.Channel;
import io.netty.channel.ChannelFutureListener;
import io.netty.handler.codec.http.websocketx.TextWebSocketFrame;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.TimeUnit;

/**
 * 待客户端 ACK 的实时消息管理器。
 *
 * <p>内存 {@link #pendingAckMap} 是本节点的快路径:超时重投扫描直接走内存,行为与历史一致。
 *
 * <p>M5(持久投递态):当 {@code ack.durable.enabled=true} 时,写穿到按用户分片的 Redis 哈希
 * {@code user:pending:{userId}}(field=ackId,value=JSON)。这样单节点崩溃/重启或用户跨节点重连后,
 * 未确认的实时消息不再静默丢失——重连时由 {@link #redeliverPending} 从 Redis 补投。
 * 默认关闭:关闭时本类与历史实现逐字节等价(Redis 依赖存在但零访问)。
 * 语义为"至少一次",客户端须按 messageId 去重(与 §离线拉取去重一致)。
 */
@Slf4j
@Component
public class AckMessageManager {

    /** 按用户分片的待确认哈希键前缀(与 {@code user:session:} 路由键同风格)。 */
    private static final String PENDING_KEY_PREFIX = "user:pending:";

    @Value("${ack.retry.timeout-ms:5000}")
    private long ackTimeoutMs;

    @Value("${ack.retry.max-count:3}")
    private int maxRetryCount;

    /** M5:是否把待确认态写穿到 Redis(默认关闭,保持 v1.0.0 基线不变)。 */
    @Value("${ack.durable.enabled:false}")
    private boolean durableEnabled;

    /** 待确认哈希的过期时间(分钟),防止无界增长;默认 24h。 */
    @Value("${ack.durable.ttl-minutes:1440}")
    private long durableTtlMinutes;

    /** 重连补投单用户单次上限,防止巨量积压压垮刚上线的连接;默认 200。 */
    @Value("${ack.durable.redelivery-batch:200}")
    private int redeliveryBatch;

    @Autowired(required = false)
    private StringRedisTemplate redisTemplate;

    private final Map<String, PendingAckMessage> pendingAckMap = new ConcurrentHashMap<>();

    public void addPending(PendingAckMessage pendingAckMessage) {
        if (pendingAckMessage == null || pendingAckMessage.getAckId() == null) {
            return;
        }
        pendingAckMap.put(pendingAckMessage.getAckId(), pendingAckMessage);
        durablePut(pendingAckMessage);
    }

    public boolean ack(String ackId) {
        if (ackId == null) {
            return false;
        }
        PendingAckMessage removed = pendingAckMap.remove(ackId);
        // 冷重启后本节点内存可能没有该项(消息 pending 在崩溃前的旧节点内存里),
        // 故从 ackId 解析 userId 兜底清理 Redis,保证 ACK 后不再被重连补投。
        String userId = removed != null ? removed.getReceiveUserId() : userIdFromAckId(ackId);
        durableRemove(userId, ackId);
        return removed != null;
    }

    public int removeByUserId(String userId) {
        if (userId == null) {
            return 0;
        }
        int before = pendingAckMap.size();
        pendingAckMap.entrySet().removeIf(entry -> userId.equals(entry.getValue().getReceiveUserId()));
        durableRemoveAll(userId);
        return before - pendingAckMap.size();
    }

    /**
     * 用户重连时的补投:从 Redis 载入其未确认消息,逐条重推并重挂内存,交由既有超时扫描继续兜底。
     * 关闭 durable 或无 Redis/通道不可用时静默返回。为"崩溃恢复"的实际落点。
     */
    public void redeliverPending(String userId, Channel channel) {
        if (!durableEnabled || redisTemplate == null || userId == null
                || channel == null || !channel.isActive()) {
            return;
        }
        Map<Object, Object> stored;
        try {
            stored = redisTemplate.opsForHash().entries(PENDING_KEY_PREFIX + userId);
        } catch (Exception e) {
            log.warn("重连补投读取 Redis 失败 userId={}", userId, e);
            return;
        }
        if (stored == null || stored.isEmpty()) {
            return;
        }
        long now = System.currentTimeMillis();
        int sent = 0;
        for (Map.Entry<Object, Object> entry : stored.entrySet()) {
            if (sent >= redeliveryBatch) {
                log.warn("重连补投达单次上限 {} userId={},剩余留待下次心跳/重连", redeliveryBatch, userId);
                break;
            }
            String ackId = String.valueOf(entry.getKey());
            PendingAckMessage pending = parsePending(entry.getValue());
            if (pending == null) {
                // 脏数据:删掉避免反复解析失败。
                durableRemove(userId, ackId);
                continue;
            }
            pending.setLastSendTime(now);
            pendingAckMap.put(ackId, pending);
            channel.writeAndFlush(new TextWebSocketFrame(pending.getFrameText()))
                    .addListener((ChannelFutureListener) future -> {
                        if (!future.isSuccess()) {
                            log.error("重连补投失败 ackId={}", ackId, future.cause());
                        }
                    });
            sent++;
        }
        if (sent > 0) {
            log.info("重连补投完成 userId={}, 补投 {} 条", userId, sent);
        }
    }

    @Scheduled(fixedDelayString = "${ack.retry.scan-interval-ms:5000}")
    public void retryTimeoutMessages() {
        long now = System.currentTimeMillis();
        for (PendingAckMessage pending : pendingAckMap.values()) {
            if (now - pending.getLastSendTime() < ackTimeoutMs) {
                continue;
            }

            if (pending.getRetryCount() >= maxRetryCount) {
                pendingAckMap.remove(pending.getAckId());
                durableRemove(pending.getReceiveUserId(), pending.getAckId());
                log.warn("ACK超时超过最大重试次数，放弃投递 ackId={}, receiveUserId={}",
                        pending.getAckId(), pending.getReceiveUserId());
                continue;
            }

            Channel channel = ChannelManager.getChannelByUserId(pending.getReceiveUserId());
            if (channel == null || !channel.isActive()) {
                pending.setRetryCount(pending.getRetryCount() + 1);
                pending.setLastSendTime(now);
                durablePut(pending);
                log.info("ACK重试时用户不在线，保留待确认消息 ackId={}, receiveUserId={}",
                        pending.getAckId(), pending.getReceiveUserId());
                continue;
            }

            pending.setRetryCount(pending.getRetryCount() + 1);
            pending.setLastSendTime(now);
            durablePut(pending);
            channel.writeAndFlush(new TextWebSocketFrame(pending.getFrameText()))
                    .addListener((ChannelFutureListener) future -> {
                        if (future.isSuccess()) {
                            log.info("ACK超时重投成功 ackId={}, retryCount={}",
                                    pending.getAckId(), pending.getRetryCount());
                        } else {
                            log.error("ACK超时重投失败 ackId={}", pending.getAckId(), future.cause());
                        }
                    });
        }
    }

    // ---- durable(Redis 写穿)辅助 · 关闭或无 Redis 时全部为空操作 ----

    private void durablePut(PendingAckMessage pending) {
        if (!durableEnabled || redisTemplate == null || pending.getReceiveUserId() == null) {
            return;
        }
        try {
            String key = PENDING_KEY_PREFIX + pending.getReceiveUserId();
            redisTemplate.opsForHash().put(key, pending.getAckId(), JSONUtil.toJsonStr(pending));
            redisTemplate.expire(key, durableTtlMinutes, TimeUnit.MINUTES);
        } catch (Exception e) {
            log.warn("待确认消息写 Redis 失败 ackId={}", pending.getAckId(), e);
        }
    }

    private void durableRemove(String userId, String ackId) {
        if (!durableEnabled || redisTemplate == null || userId == null || ackId == null) {
            return;
        }
        try {
            redisTemplate.opsForHash().delete(PENDING_KEY_PREFIX + userId, ackId);
        } catch (Exception e) {
            log.warn("待确认消息删 Redis 失败 userId={}, ackId={}", userId, ackId, e);
        }
    }

    private void durableRemoveAll(String userId) {
        if (!durableEnabled || redisTemplate == null || userId == null) {
            return;
        }
        try {
            redisTemplate.delete(PENDING_KEY_PREFIX + userId);
        } catch (Exception e) {
            log.warn("清理用户待确认哈希失败 userId={}", userId, e);
        }
    }

    private PendingAckMessage parsePending(Object raw) {
        if (raw == null) {
            return null;
        }
        try {
            PendingAckMessage pending = JSONUtil.toBean(String.valueOf(raw), PendingAckMessage.class);
            return (pending == null || pending.getAckId() == null || pending.getFrameText() == null)
                    ? null : pending;
        } catch (Exception e) {
            return null;
        }
    }

    /**
     * 从 ackId 反解 userId。ackId 形如 {@code code:userId:businessId}(见 NettyMessageService#buildAckId),
     * code 为整型、businessId 为雪花号/无横线 UUID,均不含冒号,故按冒号切分取第 2 段。
     */
    static String userIdFromAckId(String ackId) {
        if (ackId == null) {
            return null;
        }
        String[] parts = ackId.split(":");
        if (parts.length < 3 || parts[1].isEmpty()) {
            return null;
        }
        return parts[1];
    }

    // 供单测注入配置(避免拉起 Spring 上下文)。
    void configureForTest(StringRedisTemplate redisTemplate, boolean durableEnabled,
                          long durableTtlMinutes, int redeliveryBatch, int maxRetryCount, long ackTimeoutMs) {
        this.redisTemplate = redisTemplate;
        this.durableEnabled = durableEnabled;
        this.durableTtlMinutes = durableTtlMinutes;
        this.redeliveryBatch = redeliveryBatch;
        this.maxRetryCount = maxRetryCount;
        this.ackTimeoutMs = ackTimeoutMs;
    }

    // 供单测断言内存态。
    int pendingSizeForTest() {
        return pendingAckMap.size();
    }
}
