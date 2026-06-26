package com.lou.authenticationservice.data.user.register;

import lombok.Data;

/**
 * @ClassName RegisterRequest
 * @Description TODO
 * @Author Lou
 * @Date 2025/5/30 15:32
 */

@Data
public class RegisterRequest {

    private String phone;

    private String password;

    private String code;
}
