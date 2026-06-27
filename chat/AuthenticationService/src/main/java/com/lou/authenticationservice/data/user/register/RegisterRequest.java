package com.lou.authenticationservice.data.user.register;

import lombok.Data;
import lombok.experimental.Accessors;
import org.hibernate.validator.constraints.Length;

import javax.validation.constraints.Email;
import javax.validation.constraints.NotEmpty;

/**
 * @ClassName RegisterRequest
 * @Description 邮箱注册请求(D14:邮箱 + 密码 + 验证码)
 * @Author Lou
 * @Date 2025/5/30 15:32
 */

@Data
@Accessors(chain = true)
public class RegisterRequest {

    @NotEmpty(message = "邮箱不能为空")
    @Email(message = "邮箱格式不正确")
    private String email;

    @NotEmpty(message = "密码不能为空")
    @Length(min = 6, max = 16, message = "密码应为 6 - 16 位")
    private String password;

    @NotEmpty(message = "验证码不能为空")
    private String code;

    /** 兼容字段:不再用于注册校验。 */
    private String phone;
}
