package com.lou.messagingservice.service;

import com.lou.messagingservice.data.receviceRedPacket.ReceiveRedPacketResponse;

/**
* @author loujun
* @description 针对表【red_packet_receive(红包领取记录表)】的数据库操作Service
* @createDate 2025-06-15 16:48:46
*/
public interface RedPacketReceiveService {
    /**
     * 用户领取红包
     *
     * @param userId      用户ID
     * @param redPacketId 红包ID
     * @return 红包领取结果
     */
    ReceiveRedPacketResponse receiveRedPacket(Long userId, Long redPacketId);
}

