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
import com.lou.authenticationservice.data.user.refresh.RefreshRequest;
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
import com.lou.authenticationservice.constants.config.JwtConstant;
import com.lou.common.api.ApiException;
import com.lou.common.api.CommonError;
import com.lou.common.security.JwtUtil;
import com.lou.authenticationservice.utils.NickNameGeneratorUtil;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.JwtException;
import org.springframework.beans.BeanUtils;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.time.LocalDateTime;

import static com.lou.authenticationservice.constants.user.registerConstant.VERIFY_EMAIL;

/**
 * @author Lou
 * @description 针对表【user(用户表)】的数据库操作Service实现
 * @createDate 2025-05-30 14:53:00
 */
@Service
public class UserServiceImpl extends ServiceImpl<UserMapper, User> implements UserService {

    /** 登录/注册成功签发的 access 暂无角色源,roles 传空串。 */
    private static final String EMPTY_ROLES = "";

    private static final BCryptPasswordEncoder PASSWORD_ENCODER = new BCryptPasswordEncoder();

    @Autowired
    private StringRedisTemplate redisTemplate;

    @Autowired
    private UserBalanceMapper userBalanceMapper;

    @Override
    public RegisterResponse register(RegisterRequest request) {
        String email = request.getEmail();
        String password = request.getPassword();

        if (isRegister(email)) {
            throw new UserException(ErrorEnum.REGISTER_ERROR);
        }

        // 校验邮箱验证码:verify:email:{email}
        String redisKey = VERIFY_EMAIL + email;
        String redisCode = redisTemplate.opsForValue().get(redisKey);
        if (redisCode == null || !redisCode.equals(request.getCode())) {
            throw new CodeException(ErrorEnum.CODE_ERROR);
        }
        // 校验通过后删除,防重放
        redisTemplate.delete(redisKey);

        //相等就存数据库
        Snowflake snowflake = IdUtil.getSnowflake(1, 1);

        //密文存储用户密码，BCrypt(password)
        String encryptedPassword = PASSWORD_ENCODER.encode(password);
        User user = new User().setUserId(snowflake.nextId())
                .setPassword(encryptedPassword)
                .setEmail(email)
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

        return new RegisterResponse().setEmail(email);
    }

    private boolean isRegister(String email) {
        QueryWrapper<User> queryWrapper = new QueryWrapper<>();
        queryWrapper.eq("email", email);
        long count = this.count(queryWrapper);

        return count > 0;
    }

    @Override
    public LoginResponse login(LoginRequest request) {
        QueryWrapper<User> queryWrapper = new QueryWrapper<>();
        queryWrapper.eq("email", request.getEmail());

        User user = this.getOnly(queryWrapper, true);
        if (user == null || !PASSWORD_ENCODER.matches(request.getPassword(), user.getPassword())) {
            throw new UserException(ErrorEnum.LOGIN_ERROR);
        }

        return buildLoginResponse(user);
    }

    @Override
    public LoginCodeResponse loginCode(LoginCodeRequest request) {
        String redisKey = VERIFY_EMAIL + request.getEmail();
        String redisCode = redisTemplate.opsForValue().get(redisKey);

        if (redisCode == null || !redisCode.equals(request.getCode())) {
            throw new CodeException(ErrorEnum.CODE_ERROR);
        }
        // 校验通过后删除,防重放
        redisTemplate.delete(redisKey);

        QueryWrapper<User> queryWrapper = new QueryWrapper<>();
        queryWrapper.eq("email", request.getEmail());
        User user = this.getOnly(queryWrapper, true);

        if (user == null) {
            throw new UserException(ErrorEnum.LOGIN_ERROR);
        }

        LoginCodeResponse response = new LoginCodeResponse();
        BeanUtils.copyProperties(user, response);
        response.setUserId(user.getUserId());

        String userIdStr = String.valueOf(user.getUserId());
        response.setToken(JwtUtil.generateAccessToken(userIdStr, EMPTY_ROLES, JwtConstant.ACCESS_TTL_MS));
        return response;
    }

    @Override
    public LoginResponse refresh(RefreshRequest request) {
        Claims claims;
        try {
            claims = JwtUtil.parse(request.getRefreshToken());
        } catch (JwtException | IllegalArgumentException e) {
            throw new ApiException(CommonError.UNAUTHENTICATED, "refreshToken 无效或已过期");
        }
        if (!JwtUtil.isRefreshToken(claims)) {
            throw new ApiException(CommonError.UNAUTHENTICATED, "令牌类型错误");
        }

        String userIdStr = claims.getSubject();
        if (userIdStr == null || userIdStr.isEmpty()) {
            throw new ApiException(CommonError.UNAUTHENTICATED, "refreshToken 缺少主体");
        }

        LoginResponse response = new LoginResponse();
        response.setUserId(userIdStr);
        response.setToken(JwtUtil.generateAccessToken(userIdStr, EMPTY_ROLES, JwtConstant.ACCESS_TTL_MS));
        response.setRefreshToken(JwtUtil.generateRefreshToken(userIdStr, JwtConstant.REFRESH_TTL_MS));
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

    /**
     * 由 User 构造登录响应:显式回填 userId 的 string、签发 access/refresh。
     */
    private LoginResponse buildLoginResponse(User user) {
        LoginResponse response = new LoginResponse();
        BeanUtils.copyProperties(user, response);
        // User.userId 为 Long,LoginResponse.userId 为 String,BeanUtils 不转换,显式回填
        String userIdStr = String.valueOf(user.getUserId());
        response.setUserId(userIdStr);
        response.setToken(JwtUtil.generateAccessToken(userIdStr, EMPTY_ROLES, JwtConstant.ACCESS_TTL_MS));
        response.setRefreshToken(JwtUtil.generateRefreshToken(userIdStr, JwtConstant.REFRESH_TTL_MS));
        return response;
    }

}
