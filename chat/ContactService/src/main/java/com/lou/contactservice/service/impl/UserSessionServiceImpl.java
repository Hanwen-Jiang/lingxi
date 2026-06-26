package com.lou.contactservice.service.impl;

import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import com.lou.contactservice.model.UserSession;
import com.lou.contactservice.service.UserSessionService;
import com.lou.contactservice.mapper.UserSessionMapper;
import org.springframework.stereotype.Service;

/**
* @author Lou
* @description 针对表【user_session】的数据库操作Service实现
* @createDate 2025-06-26 21:06:14
*/
@Service
public class UserSessionServiceImpl extends ServiceImpl<UserSessionMapper, UserSession>
    implements UserSessionService{

}




