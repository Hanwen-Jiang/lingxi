package com.lou.messagingservice.data.getRedPacket;

import lombok.Data;
import lombok.experimental.Accessors;

@Data
@Accessors(chain = true)
public class RedPacketRequest {

    private Long redPacketId;

    private Integer pageNum = 1;

    private Integer pageSize = 10;
}

