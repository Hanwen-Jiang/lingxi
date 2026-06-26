package com.lou.authenticationservice.data.user.login;

import lombok.Data;
import lombok.experimental.Accessors;
import org.hibernate.validator.constraints.Length;

import javax.validation.constraints.NotEmpty;

/**
 * @ClassName LoginRequest
 * @Description TODO
 * @Author Lou
 * @Date 2025/5/30 18:14
 */

@Data
@Accessors(chain = true)
public class LoginRequest {

    @NotEmpty(message = "手机号不能为空")
    @Length(min = 11, max = 11, message = "手机号应为 11 位")
    private String phone;

    @NotEmpty(message = "密码不能为空")
    @Length(min = 6, max = 16, message = "密码应为 6 - 16 位")
    private String password;

}
