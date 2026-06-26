package com.lou.authenticationservice.service.impl;

import cn.hutool.core.lang.Snowflake;
import cn.hutool.core.util.IdUtil;
import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import com.lou.authenticationservice.constants.user.ErrorEnum;
import com.lou.authenticationservice.data.user.login.LoginRequest;
import com.lou.authenticationservice.data.user.login.LoginResponse;
import com.lou.authenticationservice.data.user.loginCode.LoginCodeRequest;
import com.lou.authenticationservice.data.user.loginCode.LoginCodeResponse;
import com.lou.authenticationservice.data.user.register.RegisterRequest;
import com.lou.authenticationservice.data.user.register.RegisterResponse;
import com.lou.authenticationservice.data.user.updateAvatar.UpdateAvatarRequest;
import com.lou.authenticationservice.data.user.updateAvatar.UpdateAvatarResponse;
import com.lou.authenticationservice.exception.CodeException;
import com.lou.authenticationservice.exception.DatabaseException;
import com.lou.authenticationservice.exception.UserException;
import com.lou.authenticationservice.mapper.UserBalanceMapper;
import com.lou.authenticationservice.model.User;
import com.lou.authenticationservice.model.UserBalance;
import com.lou.authenticationservice.service.UserService;
import com.lou.authenticationservice.mapper.UserMapper;
import com.lou.authenticationservice.utils.JwtUtil;
import com.lou.authenticationservice.utils.NickNameGeneratorUtil;
import org.springframework.beans.BeanUtils;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.time.LocalDateTime;

import static com.lou.authenticationservice.constants.user.registerConstant.REGISTER_CODE;

/**
 * @author Lou
 * @description 针对表【user(用户表)】的数据库操作Service实现
 * @createDate 2025-05-30 14:53:00
 */
@Service
public class UserServiceImpl extends ServiceImpl<UserMapper, User> implements UserService {

    private static final BCryptPasswordEncoder PASSWORD_ENCODER = new BCryptPasswordEncoder();

    @Autowired
    private StringRedisTemplate redisTemplate;

    @Autowired
    private UserBalanceMapper userBalanceMapper;

    @Override
    public RegisterResponse register(RegisterRequest request) {
        String phone = request.getPhone();
        String password = request.getPassword();

        if (isRegister(phone)) {
            throw new UserException(ErrorEnum.REGISTER_ERROR);
        }

        //去查redis code == redisCode
        String redisCode = redisTemplate.opsForValue().get(REGISTER_CODE + phone);
        if (redisCode == null || !redisCode.equals(request.getCode())) {
            throw new CodeException(ErrorEnum.CODE_ERROR);
        }

        //相等就存数据库
        Snowflake snowflake = IdUtil.getSnowflake(1, 1);

        //密文存储用户密码，BCrypt(password)
        String encryptedPassword = PASSWORD_ENCODER.encode(password);
        User user = new User().setUserId(snowflake.nextId())
                .setPassword(encryptedPassword)
                .setPhone(phone)
                .setUserName(NickNameGeneratorUtil.generateNickName());

        boolean isUserSave = this.save(user);
        if (!isUserSave) {
            throw new DatabaseException("数据库异常，保存用户信息失败");
        }

        UserBalance userBalance = new UserBalance()
                .setUserId(user.getUserId())
                .setBalance(BigDecimal.valueOf(1000))
                .setUpdatedAt(LocalDateTime.now());

        int insert = userBalanceMapper.insert(userBalance);
        if (insert <= 0) {
            throw new DatabaseException("数据库异常，创建用户账户信息错误");
        }

        return new RegisterResponse().setPhone(phone);
        //不相等就报错
    }

    private boolean isRegister(String phone) {
        QueryWrapper<User> queryWrapper = new QueryWrapper<>();
        queryWrapper.eq("phone", phone);
        long count = this.count(queryWrapper);

        return count > 0;
    }

    @Override
    public LoginResponse login(LoginRequest request) {
        QueryWrapper<User> queryWrapper = new QueryWrapper<>();
        queryWrapper.eq("phone", request.getPhone());

        User user = this.getOnly(queryWrapper, true);
        if (user == null || !PASSWORD_ENCODER.matches(request.getPassword(), user.getPassword())) {
            throw new UserException(ErrorEnum.LOGIN_ERROR);
        }

        LoginResponse response = new LoginResponse();
        BeanUtils.copyProperties(user, response);
        String token = JwtUtil.generate(String.valueOf(user.getUserId()));
        response.setToken(token);
        return response;
    }

    @Override
    public LoginCodeResponse loginCode(LoginCodeRequest request) {
        String redisCode = redisTemplate.opsForValue().get(REGISTER_CODE + request.getPhone());

        if (redisCode == null || !redisCode.equals(request.getCode())) {
            throw new CodeException(ErrorEnum.CODE_ERROR);
        }

        QueryWrapper<User> queryWrapper = new QueryWrapper<>();
        queryWrapper.eq("phone", request.getPhone());
        User user = this.getOnly(queryWrapper, true);

        if (user == null) {
            throw new UserException(ErrorEnum.LOGIN_ERROR);
        }

        LoginCodeResponse response = new LoginCodeResponse();
        BeanUtils.copyProperties(user, response);

        String token = JwtUtil.generate(String.valueOf(response.getUserId()));
        response.setToken(token);
        return response;
    }

    @Override
    public UpdateAvatarResponse updateAvatar(String id, UpdateAvatarRequest request) {
        QueryWrapper<User> queryWrapper = new QueryWrapper<>();
        queryWrapper.eq("user_id", Long.valueOf(id));
        User user = this.getOnly(queryWrapper, true);

        if (user == null) {
            throw new UserException(ErrorEnum.NO_USER_ERROR);
        }

        user.setAvatar(request.avatarUrl);
        boolean isUpdate = this.updateById(user);
        if (!isUpdate) {
            throw new DatabaseException(ErrorEnum.UPDATE_AVATAR_ERROR);
        }

        UpdateAvatarResponse response = new UpdateAvatarResponse();
        BeanUtils.copyProperties(user, response);
        return response;
    }

}



