package com.lou.offlinedatastoreservice.service;

import com.lou.offlinedatastoreservice.data.offlineMessage.OfflineMsgRequest;
import com.lou.offlinedatastoreservice.data.offlineMessage.OfflineMsgResponse;
import com.lou.offlinedatastoreservice.model.Message;
import com.baomidou.mybatisplus.extension.service.IService;

/**
 * @author loujun
 * @description 针对表【message】的数据库操作Service
 * @createDate 2025-06-19 23:51:28
 */
public interface MessageService extends IService<Message> {

    void saveOfflineMessage(String message);

    OfflineMsgResponse getOfflineMessage(OfflineMsgRequest request);
}
