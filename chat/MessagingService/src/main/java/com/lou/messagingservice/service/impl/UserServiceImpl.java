package com.lou.messagingservice.service.impl;

import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import com.lou.messagingservice.model.User;
import com.lou.messagingservice.service.UserService;
import com.lou.messagingservice.mapper.UserMapper;
import org.springframework.stereotype.Service;

/**
* @author loujun
* @description 针对表【user(用户表)】的数据库操作Service实现
* @createDate 2025-06-12 16:44:37
*/
@Service
public class UserServiceImpl extends ServiceImpl<UserMapper, User>
    implements UserService{

}




