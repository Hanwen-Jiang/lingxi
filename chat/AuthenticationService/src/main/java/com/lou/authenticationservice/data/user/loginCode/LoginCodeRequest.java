package com.lou.authenticationservice.data.user.loginCode;

import lombok.Data;
import lombok.experimental.Accessors;

import javax.validation.constraints.Email;
import javax.validation.constraints.NotEmpty;

/**
 * @ClassName LoginCodeRequest
 * @Description 邮箱验证码免密登录(D14)
 * @Author Lou
 * @Date 2025/6/1 16:11
 */

@Data
@Accessors(chain = true)
public class LoginCodeRequest {

    @NotEmpty(message = "邮箱不能为空")
    @Email(message = "邮箱格式不正确")
    private String email;

    @NotEmpty(message = "验证码不能为空")
    private String code;
}
