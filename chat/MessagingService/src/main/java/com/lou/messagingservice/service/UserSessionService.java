package com.lou.messagingservice.service;

import com.lou.messagingservice.model.UserSession;
import com.baomidou.mybatisplus.extension.service.IService;

import java.util.List;

/**
 * @author loujun
 * @description 针对表【user_session】的数据库操作Service
 * @createDate 2025-06-12 16:57:03
 */
public interface UserSessionService extends IService<UserSession> {

    List<Long> getUserIdsBySessionId(Long sessionId);
}
