package com.lou.messagingservice.service;

import com.lou.messagingservice.data.sendMsg.SendMsgRequest;
import com.lou.messagingservice.data.sendMsg.SendMsgResponse;
import com.lou.messagingservice.model.Message;
import com.baomidou.mybatisplus.extension.service.IService;

/**
 * @author loujun
 * @description 针对表【message】的数据库操作Service
 * @createDate 2025-06-12 16:49:16
 */
public interface MessageService extends IService<Message> {

    SendMsgResponse sendMessage(SendMsgRequest sendMsgRequest);
}
