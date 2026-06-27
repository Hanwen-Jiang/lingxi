package com.lou.authenticationservice.controller;

import com.lou.common.api.Result;
import com.lou.common.security.RequestContext;
import com.lou.authenticationservice.data.user.login.LoginRequest;
import com.lou.authenticationservice.data.user.login.LoginResponse;
import com.lou.authenticationservice.data.user.loginCode.LoginCodeRequest;
import com.lou.authenticationservice.data.user.loginCode.LoginCodeResponse;
import com.lou.authenticationservice.data.user.refresh.RefreshRequest;
import com.lou.authenticationservice.data.user.register.RegisterRequest;
import com.lou.authenticationservice.data.user.register.RegisterResponse;
import com.lou.authenticationservice.data.user.updateAvatar.UpdateAvatarRequest;
import com.lou.authenticationservice.data.user.updateAvatar.UpdateAvatarResponse;
import com.lou.authenticationservice.service.UserService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;

import javax.validation.Valid;

/**
 * @ClassName UserController
 * @Description 用户类路由
 * @Author Lou
 * @Date 2025/5/30 13:41
 */

@Slf4j
@RestController
@RequestMapping("/api/v1/user")
public class UserController {

    @Autowired
    private UserService userService;

    @PostMapping("/register")
    public Result<RegisterResponse> register(@Valid @RequestBody RegisterRequest request) {
        RegisterResponse response = userService.register(request);

        return Result.ok(response);
    }

    @PostMapping("/login")
    public Result<LoginResponse> login(@Valid @RequestBody LoginRequest request) {
        LoginResponse response = userService.login(request);

        return Result.ok(response);
    }

    @PostMapping("/loginCode")
    public Result<LoginCodeResponse> loginCode(@Valid @RequestBody LoginCodeRequest request) {
        LoginCodeResponse response = userService.loginCode(request);

        return Result.ok(response);
    }

    @PostMapping("/refresh")
    public Result<LoginResponse> refresh(@Valid @RequestBody RefreshRequest request) {
        LoginResponse response = userService.refresh(request);

        return Result.ok(response);
    }

    @PatchMapping("/avatar")
    public Result<UpdateAvatarResponse> updateAvatar(@Valid @RequestBody UpdateAvatarRequest request) {
        String id = RequestContext.requireUserId();

        UpdateAvatarResponse response = userService.updateAvatar(id, request);

        return Result.ok(response);
    }


}
