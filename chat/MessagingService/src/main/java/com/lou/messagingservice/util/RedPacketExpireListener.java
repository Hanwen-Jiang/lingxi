package com.lou.messagingservice.util;

import com.lou.messagingservice.constants.RedPacketConstants;
import com.lou.messagingservice.service.RedPacketService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.redis.connection.Message;
import org.springframework.data.redis.connection.MessageListener;
import org.springframework.stereotype.Component;
import org.springframework.stereotype.Service;


@Component
@Slf4j
public class RedPacketExpireListener implements MessageListener {

    @Autowired
    private RedPacketService redPacketService;

    @Override
    public void onMessage(Message message, byte[] pattern) {
        String expiredKey = message.toString();

        log.info("得到过期的key：" + expiredKey);
        if (expiredKey.startsWith(RedPacketConstants.RED_PACKET_KEY_PREFIX.getValue())) {
            String substring = expiredKey.substring(RedPacketConstants.RED_PACKET_KEY_PREFIX.getValue().length());
            long redPacketID = Long.parseLong(substring);

            log.info("得到过期红包ID:" + redPacketID);

            try {
                redPacketService.handleExpireRedPacket(redPacketID);
            } catch (Exception e) {
                throw new RuntimeException(e);
            }
        }
    }
}
