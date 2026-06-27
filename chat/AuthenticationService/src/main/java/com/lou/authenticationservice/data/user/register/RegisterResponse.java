package com.lou.authenticationservice.data.user.register;

import lombok.Data;
import lombok.experimental.Accessors;

/**
 * @ClassName RegisterResponse
 * @Description 注册结果(D14:返回 email)
 * @Author Lou
 * @Date 2025/5/30 15:32
 */

@Data
@Accessors(chain = true)
public class RegisterResponse {
    private String email;
}
