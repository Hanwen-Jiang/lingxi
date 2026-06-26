package com.lou.offlinedatastoreservice.service.impl;

import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import com.lou.offlinedatastoreservice.model.User;
import com.lou.offlinedatastoreservice.service.UserService;
import com.lou.offlinedatastoreservice.mapper.UserMapper;
import org.springframework.stereotype.Service;

/**
* @author loujun
* @description 针对表【user(用户表)】的数据库操作Service实现
* @createDate 2025-06-19 23:51:49
*/
@Service
public class UserServiceImpl extends ServiceImpl<UserMapper, User>
    implements UserService{

}




