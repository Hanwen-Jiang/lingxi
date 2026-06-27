package com.lou.authenticationservice.data.user.login;

import lombok.Data;
import lombok.experimental.Accessors;
import org.hibernate.validator.constraints.Length;

import javax.validation.constraints.Email;
import javax.validation.constraints.NotEmpty;

/**
 * @ClassName LoginRequest
 * @Description 邮箱 + 密码登录(D14)
 * @Author Lou
 * @Date 2025/5/30 18:14
 */

@Data
@Accessors(chain = true)
public class LoginRequest {

    @NotEmpty(message = "邮箱不能为空")
    @Email(message = "邮箱格式不正确")
    private String email;

    @NotEmpty(message = "密码不能为空")
    @Length(min = 6, max = 16, message = "密码应为 6 - 16 位")
    private String password;

}
