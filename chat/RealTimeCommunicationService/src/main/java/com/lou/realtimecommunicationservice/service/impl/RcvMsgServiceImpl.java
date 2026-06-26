package com.lou.realtimecommunicationservice.service.impl;

import com.lou.realtimecommunicationservice.data.ReceiveMessage.ReceiveMessageRequest;
import com.lou.realtimecommunicationservice.data.ReceiveMessage.ReceiveMessageResponse;
import com.lou.realtimecommunicationservice.service.RcvMsgService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

/**
 * @ClassName RcvMsgServiceImpl
 * @Description TODO
 * @Author Lou
 * @Date 2025/6/10 16:42
 */

@Service
@Slf4j
public class RcvMsgServiceImpl implements RcvMsgService {

    @Autowired
    private NettyMessageService nettyMessageService;

    @Override
    public ReceiveMessageResponse receiveMessage(ReceiveMessageRequest request) {
        nettyMessageService.sendMessageToUser(request);

        return new ReceiveMessageResponse();
    }
}
