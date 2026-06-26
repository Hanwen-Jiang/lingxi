package com.lou.messagingservice.service;

import com.lou.messagingservice.data.sendRedPacket.SendRedPacketRequest;
import com.lou.messagingservice.data.sendRedPacket.SendRedPacketResponse;
import com.lou.messagingservice.model.RedPacket;
import com.baomidou.mybatisplus.extension.service.IService;

/**
 * @author loujun
 * @description 针对表【red_packet(红包主表)】的数据库操作Service
 * @createDate 2025-06-14 18:35:21
 */
public interface RedPacketService extends IService<RedPacket> {

    /**
     * 发送红包
     *
     * @param request
     * @return
     * @throws Exception
     */
    SendRedPacketResponse sendRedPacket(SendRedPacketRequest request) throws Exception;

    /**
     * 红包过期处理
     *
     * @param redPacketId 红包Id
     */
    void handleExpireRedPacket(Long redPacketId);
}
