package com.lou.contactservice.service.impl;

import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import com.lou.contactservice.model.User;
import com.lou.contactservice.service.UserService;
import com.lou.contactservice.mapper.UserMapper;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

/**
* @author Lou
* @description 针对表【user(用户表)】的数据库操作Service实现
* @createDate 2025-06-26 20:01:48
*/
@Service
public class UserServiceImpl extends ServiceImpl<UserMapper, User>
    implements UserService{

}




