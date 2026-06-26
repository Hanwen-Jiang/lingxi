package com.lou.realtimecommunicationservice.websocket;

import com.lou.realtimecommunicationservice.model.PendingAckMessage;
import io.netty.channel.Channel;
import io.netty.channel.ChannelFutureListener;
import io.netty.handler.codec.http.websocketx.TextWebSocketFrame;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@Slf4j
@Component
public class AckMessageManager {

    @Value("${ack.retry.timeout-ms:5000}")
    private long ackTimeoutMs;

    @Value("${ack.retry.max-count:3}")
    private int maxRetryCount;

    private final Map<String, PendingAckMessage> pendingAckMap = new ConcurrentHashMap<>();

    public void addPending(PendingAckMessage pendingAckMessage) {
        if (pendingAckMessage == null || pendingAckMessage.getAckId() == null) {
            return;
        }
        pendingAckMap.put(pendingAckMessage.getAckId(), pendingAckMessage);
    }

    public boolean ack(String ackId) {
        if (ackId == null) {
            return false;
        }
        PendingAckMessage removed = pendingAckMap.remove(ackId);
        return removed != null;
    }

    public int removeByUserId(String userId) {
        if (userId == null) {
            return 0;
        }
        int before = pendingAckMap.size();
        pendingAckMap.entrySet().removeIf(entry -> userId.equals(entry.getValue().getReceiveUserId()));
        return before - pendingAckMap.size();
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
                log.warn("ACK超时超过最大重试次数，放弃投递 ackId={}, receiveUserId={}",
                        pending.getAckId(), pending.getReceiveUserId());
                continue;
            }

            Channel channel = ChannelManager.getChannelByUserId(pending.getReceiveUserId());
            if (channel == null || !channel.isActive()) {
                pending.setRetryCount(pending.getRetryCount() + 1);
                pending.setLastSendTime(now);
                log.info("ACK重试时用户不在线，保留待确认消息 ackId={}, receiveUserId={}",
                        pending.getAckId(), pending.getReceiveUserId());
                continue;
            }

            pending.setRetryCount(pending.getRetryCount() + 1);
            pending.setLastSendTime(now);
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
}
