package com.lou.messagingservice.service.impl;

import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import com.lou.messagingservice.model.Session;
import com.lou.messagingservice.service.SessionService;
import com.lou.messagingservice.mapper.SessionMapper;
import org.springframework.stereotype.Service;

/**
* @author loujun
* @description 针对表【session(会话表)】的数据库操作Service实现
* @createDate 2025-06-12 16:56:56
*/
@Service
public class SessionServiceImpl extends ServiceImpl<SessionMapper, Session>
    implements SessionService{

}




