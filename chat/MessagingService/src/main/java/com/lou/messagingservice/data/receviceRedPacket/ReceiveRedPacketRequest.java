package com.lou.messagingservice.data.receviceRedPacket;

import lombok.Data;
import lombok.experimental.Accessors;

@Data
@Accessors(chain = true)
public class ReceiveRedPacketRequest {
    private Long userId;

    private Long redPacketId;
}
