package com.lou.authenticationservice.data.user.loginCode;

import lombok.Data;
import lombok.experimental.Accessors;
import org.hibernate.validator.constraints.Length;

import javax.validation.constraints.NotEmpty;

/**
 * @ClassName LoginCodeRequest
 * @Description TODO
 * @Author Lou
 * @Date 2025/6/1 16:11
 */

@Data
@Accessors(chain = true)
public class LoginCodeRequest {

    @NotEmpty(message = "手机号不为空")
    @Length(min = 11, max = 11, message = "手机号应为 11 位")
    private String phone;

    @NotEmpty(message = "验证码不能为空")
    @Length(min = 6, max = 6, message = "验证码应为 6 位")
    private String code;
}
