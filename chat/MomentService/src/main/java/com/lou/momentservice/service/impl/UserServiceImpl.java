package com.lou.momentservice.service.impl;

import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import com.lou.momentservice.model.User;
import com.lou.momentservice.service.UserService;
import com.lou.momentservice.mapper.UserMapper;
import org.springframework.stereotype.Service;

/**
* @author Lou
* @description 针对表【user(用户表)】的数据库操作Service实现
* @createDate 2025-06-21 21:19:22
*/
@Service
public class UserServiceImpl extends ServiceImpl<UserMapper, User>
    implements UserService{

}




