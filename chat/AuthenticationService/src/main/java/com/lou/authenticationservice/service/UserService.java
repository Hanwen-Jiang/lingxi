package com.lou.authenticationservice.service;

import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.lou.authenticationservice.data.user.login.LoginRequest;
import com.lou.authenticationservice.data.user.login.LoginResponse;
import com.lou.authenticationservice.data.user.loginCode.LoginCodeRequest;
import com.lou.authenticationservice.data.user.loginCode.LoginCodeResponse;
import com.lou.authenticationservice.data.user.register.RegisterRequest;
import com.lou.authenticationservice.data.user.register.RegisterResponse;
import com.lou.authenticationservice.data.user.updateAvatar.UpdateAvatarRequest;
import com.lou.authenticationservice.data.user.updateAvatar.UpdateAvatarResponse;
import com.lou.authenticationservice.model.User;
import com.baomidou.mybatisplus.extension.service.IService;

/**
 * @author Lou
 * @description 针对表【user(用户表)】的数据库操作Service
 * @createDate 2025-05-30 14:53:00
 */
public interface UserService extends IService<User> {

    default User getOnly(QueryWrapper<User> wrapper,boolean throwEx){
        wrapper.last("limit 1");
        return this.getOne(wrapper,throwEx);
    }

    RegisterResponse register(RegisterRequest request);

    LoginResponse login(LoginRequest request);

    LoginCodeResponse loginCode(LoginCodeRequest request);

    UpdateAvatarResponse updateAvatar(String id,UpdateAvatarRequest request);


}
