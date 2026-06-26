package com.lou.authenticationservice.data.user.login;

import lombok.Data;
import lombok.experimental.Accessors;

/**
 * @ClassName LoginResponse
 * @Description TODO
 * @Author Lou
 * @Date 2025/5/30 18:15
 */

@Data
@Accessors(chain = true)
public class LoginResponse {
    private String userId;
    private String userName;
    private String avatar;
    private String signature;
    private Integer gender;
    private Integer status;
    private String token;
}
