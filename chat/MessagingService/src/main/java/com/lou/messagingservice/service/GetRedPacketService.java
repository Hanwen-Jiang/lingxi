package com.lou.messagingservice.service;


import com.lou.messagingservice.data.getRedPacket.RedPacketResponse;

public interface GetRedPacketService {
    /**
     * 获取红包详细信息，包括领取记录
     * @param redPacketId 红包ID
     * @param pageNum 页码
     * @param pageSize 每页大小
     * @return 红包详情响应
     */
    RedPacketResponse getRedPacketDetails(Long redPacketId, Integer pageNum, Integer pageSize);
}

