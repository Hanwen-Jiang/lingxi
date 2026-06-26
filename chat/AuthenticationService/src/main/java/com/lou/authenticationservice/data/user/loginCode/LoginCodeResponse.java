package com.lou.authenticationservice.data.user.loginCode;

import lombok.Data;
import lombok.experimental.Accessors;

/**
 * @ClassName LoginCodeResponse
 * @Description TODO
 * @Author Lou
 * @Date 2025/6/1 16:12
 */

@Data
@Accessors(chain = true)
public class LoginCodeResponse {
    private Long userId;
    private String userName;
    private String avatar;
    private String signature;
    private Integer gender;
    private Integer status;
    private String token;
}
