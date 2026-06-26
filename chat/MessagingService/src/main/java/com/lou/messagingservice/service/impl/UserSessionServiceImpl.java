package com.lou.messagingservice.service.impl;

import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import com.lou.messagingservice.model.UserSession;
import com.lou.messagingservice.service.UserSessionService;
import com.lou.messagingservice.mapper.UserSessionMapper;
import org.springframework.stereotype.Service;

import java.util.Collections;
import java.util.List;
import java.util.stream.Collectors;

/**
* @author loujun
* @description 针对表【user_session】的数据库操作Service实现
* @createDate 2025-06-12 16:57:03
*/
@Service
public class UserSessionServiceImpl extends ServiceImpl<UserSessionMapper, UserSession>
    implements UserSessionService{

    @Override
    public List<Long> getUserIdsBySessionId(Long sessionId) {
        List<UserSession> userSessionList = this.lambdaQuery().eq(UserSession::getSessionId, sessionId).list();
        return userSessionList.stream().map(UserSession::getUserId).collect(Collectors.toList());
    }
}




